//! Integration with RuVector vector database

use crate::{Embedder, EmbeddingError, Result};
use ruvector_core::{
    Distance, HnswConfig, IndexBuilder, MemoryStore, SearchParams,
    VectorEntry, VectorId, VectorIndex,
};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, info, instrument};

/// RuVector integration for ONNX embeddings
pub struct RuVectorEmbeddings {
    /// The embedder for generating vectors
    embedder: Arc<Embedder>,
    /// Vector index for similarity search
    index: VectorIndex<MemoryStore>,
    /// Mapping from vector ID to original text
    texts: HashMap<VectorId, String>,
    /// Index name
    name: String,
}

/// Search result with text and score
#[derive(Debug, Clone)]
pub struct SearchResult {
    /// Vector ID
    pub id: VectorId,
    /// Original text
    pub text: String,
    /// Similarity score
    pub score: f32,
    /// Optional metadata
    pub metadata: Option<serde_json::Value>,
}

/// Configuration for creating a RuVector index
#[derive(Debug, Clone)]
pub struct RuVectorConfig {
    /// Distance metric
    pub distance: Distance,
    /// HNSW M parameter (connections per layer)
    pub m: usize,
    /// HNSW ef_construction parameter
    pub ef_construction: usize,
    /// Maximum number of elements
    pub max_elements: usize,
}

impl Default for RuVectorConfig {
    fn default() -> Self {
        Self {
            distance: Distance::Cosine,
            m: 16,
            ef_construction: 100,
            max_elements: 100_000,
        }
    }
}

impl RuVectorEmbeddings {
    /// Create a new RuVector index with the given embedder
    #[instrument(skip(embedder), fields(name = %name))]
    pub fn new(
        name: impl Into<String>,
        embedder: Arc<Embedder>,
        config: RuVectorConfig,
    ) -> Result<Self> {
        let name = name.into();
        let dimension = embedder.dimension();

        info!(
            "Creating RuVector index '{}' with dimension {}",
            name, dimension
        );

        let hnsw_config = HnswConfig {
            m: config.m,
            ef_construction: config.ef_construction,
            max_elements: config.max_elements,
            ..Default::default()
        };

        let index = IndexBuilder::new()
            .with_dimension(dimension)
            .with_distance(config.distance)
            .with_hnsw_config(hnsw_config)
            .build_memory()
            .map_err(|e| EmbeddingError::ruvector(e.to_string()))?;

        Ok(Self {
            embedder,
            index,
            texts: HashMap::new(),
            name,
        })
    }

    /// Create with default configuration
    pub fn new_default(name: impl Into<String>, embedder: Arc<Embedder>) -> Result<Self> {
        Self::new(name, embedder, RuVectorConfig::default())
    }

    /// Insert a single text with optional metadata
    #[instrument(skip(self, text, metadata), fields(text_len = text.len()))]
    pub fn insert(
        &mut self,
        text: &str,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<VectorId> {
        let embedding = self.embedder.embed_one(text)?;
        self.insert_with_embedding(text, embedding, metadata)
    }

    /// Insert with pre-computed embedding
    pub fn insert_with_embedding(
        &mut self,
        text: &str,
        embedding: Vec<f32>,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) -> Result<VectorId> {
        let entry = VectorEntry {
            id: None,
            vector: embedding,
            metadata,
        };

        let id = self
            .index
            .insert(entry)
            .map_err(|e| EmbeddingError::ruvector(e.to_string()))?;

        self.texts.insert(id, text.to_string());

        debug!("Inserted text with ID {:?}", id);
        Ok(id)
    }

    /// Insert multiple texts
    #[instrument(skip(self, texts), fields(count = texts.len()))]
    pub fn insert_batch<S: AsRef<str>>(&mut self, texts: &[S]) -> Result<Vec<VectorId>> {
        let embeddings = self.embedder.embed(texts)?;
        self.insert_batch_with_embeddings(texts, embeddings.embeddings)
    }

    /// Insert batch with pre-computed embeddings
    pub fn insert_batch_with_embeddings<S: AsRef<str>>(
        &mut self,
        texts: &[S],
        embeddings: Vec<Vec<f32>>,
    ) -> Result<Vec<VectorId>> {
        if texts.len() != embeddings.len() {
            return Err(EmbeddingError::dimension_mismatch(
                texts.len(),
                embeddings.len(),
            ));
        }

        let entries: Vec<VectorEntry> = embeddings
            .into_iter()
            .map(|vector| VectorEntry {
                id: None,
                vector,
                metadata: None,
            })
            .collect();

        let ids = self
            .index
            .insert_batch(entries)
            .map_err(|e| EmbeddingError::ruvector(e.to_string()))?;

        for (id, text) in ids.iter().zip(texts.iter()) {
            self.texts.insert(*id, text.as_ref().to_string());
        }

        info!("Inserted {} vectors", ids.len());
        Ok(ids)
    }

    /// Search for similar texts
    #[instrument(skip(self, query), fields(k))]
    pub fn search(&self, query: &str, k: usize) -> Result<Vec<SearchResult>> {
        let query_embedding = self.embedder.embed_one(query)?;
        self.search_with_embedding(&query_embedding, k)
    }

    /// Search with pre-computed query embedding
    pub fn search_with_embedding(
        &self,
        query_embedding: &[f32],
        k: usize,
    ) -> Result<Vec<SearchResult>> {
        let params = SearchParams {
            k,
            ef_search: k * 2,
            ..Default::default()
        };

        let results = self
            .index
            .search(query_embedding, &params)
            .map_err(|e| EmbeddingError::ruvector(e.to_string()))?;

        let search_results: Vec<SearchResult> = results
            .into_iter()
            .filter_map(|r| {
                let text = self.texts.get(&r.id)?.clone();
                Some(SearchResult {
                    id: r.id,
                    text,
                    score: r.score,
                    metadata: r.metadata,
                })
            })
            .collect();

        debug!("Search returned {} results", search_results.len());
        Ok(search_results)
    }

    /// Search with metadata filter
    #[instrument(skip(self, query, filter), fields(k))]
    pub fn search_filtered(
        &self,
        query: &str,
        k: usize,
        filter: impl Fn(&serde_json::Value) -> bool,
    ) -> Result<Vec<SearchResult>> {
        let query_embedding = self.embedder.embed_one(query)?;

        let params = SearchParams {
            k: k * 4, // Fetch more to account for filtering
            ef_search: k * 4,
            ..Default::default()
        };

        let results = self
            .index
            .search(&query_embedding, &params)
            .map_err(|e| EmbeddingError::ruvector(e.to_string()))?;

        let filtered: Vec<SearchResult> = results
            .into_iter()
            .filter_map(|r| {
                let text = self.texts.get(&r.id)?.clone();

                // Apply filter
                if let Some(ref meta) = r.metadata {
                    if !filter(meta) {
                        return None;
                    }
                }

                Some(SearchResult {
                    id: r.id,
                    text,
                    score: r.score,
                    metadata: r.metadata,
                })
            })
            .take(k)
            .collect();

        Ok(filtered)
    }

    /// Get a vector by ID
    pub fn get(&self, id: VectorId) -> Result<Option<(String, Vec<f32>)>> {
        let vector = self
            .index
            .get(id)
            .map_err(|e| EmbeddingError::ruvector(e.to_string()))?;

        if let Some(v) = vector {
            if let Some(text) = self.texts.get(&id) {
                return Ok(Some((text.clone(), v.vector)));
            }
        }

        Ok(None)
    }

    /// Delete a vector by ID
    pub fn delete(&mut self, id: VectorId) -> Result<bool> {
        let deleted = self
            .index
            .delete(id)
            .map_err(|e| EmbeddingError::ruvector(e.to_string()))?;

        if deleted {
            self.texts.remove(&id);
        }

        Ok(deleted)
    }

    /// Get the number of vectors in the index
    pub fn len(&self) -> usize {
        self.index.len()
    }

    /// Check if the index is empty
    pub fn is_empty(&self) -> bool {
        self.index.is_empty()
    }

    /// Get index name
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Get the embedding dimension
    pub fn dimension(&self) -> usize {
        self.embedder.dimension()
    }

    /// Get reference to the embedder
    pub fn embedder(&self) -> &Embedder {
        &self.embedder
    }

    /// Clear all vectors
    pub fn clear(&mut self) -> Result<()> {
        self.index
            .clear()
            .map_err(|e| EmbeddingError::ruvector(e.to_string()))?;
        self.texts.clear();
        Ok(())
    }
}

/// Builder for creating RuVector indexes
pub struct RuVectorBuilder {
    name: String,
    embedder: Option<Arc<Embedder>>,
    config: RuVectorConfig,
}

impl RuVectorBuilder {
    /// Create a new builder
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            embedder: None,
            config: RuVectorConfig::default(),
        }
    }

    /// Set the embedder
    pub fn embedder(mut self, embedder: Arc<Embedder>) -> Self {
        self.embedder = Some(embedder);
        self
    }

    /// Set distance metric
    pub fn distance(mut self, distance: Distance) -> Self {
        self.config.distance = distance;
        self
    }

    /// Set HNSW M parameter
    pub fn m(mut self, m: usize) -> Self {
        self.config.m = m;
        self
    }

    /// Set ef_construction parameter
    pub fn ef_construction(mut self, ef: usize) -> Self {
        self.config.ef_construction = ef;
        self
    }

    /// Set max elements
    pub fn max_elements(mut self, max: usize) -> Self {
        self.config.max_elements = max;
        self
    }

    /// Build the index
    pub fn build(self) -> Result<RuVectorEmbeddings> {
        let embedder = self
            .embedder
            .ok_or_else(|| EmbeddingError::invalid_config("Embedder is required"))?;

        RuVectorEmbeddings::new(self.name, embedder, self.config)
    }
}

/// RAG (Retrieval-Augmented Generation) helper
pub struct RagPipeline {
    index: RuVectorEmbeddings,
    top_k: usize,
}

impl RagPipeline {
    /// Create a new RAG pipeline
    pub fn new(index: RuVectorEmbeddings, top_k: usize) -> Self {
        Self { index, top_k }
    }

    /// Retrieve context for a query
    pub fn retrieve(&self, query: &str) -> Result<Vec<String>> {
        let results = self.index.search(query, self.top_k)?;
        Ok(results.into_iter().map(|r| r.text).collect())
    }

    /// Format retrieved context as a prompt
    pub fn format_context(&self, query: &str) -> Result<String> {
        let contexts = self.retrieve(query)?;

        let mut prompt = String::from("Context:\n");
        for (i, ctx) in contexts.iter().enumerate() {
            prompt.push_str(&format!("[{}] {}\n", i + 1, ctx));
        }
        prompt.push_str(&format!("\nQuestion: {}", query));

        Ok(prompt)
    }

    /// Add documents to the index
    pub fn add_documents<S: AsRef<str>>(&mut self, documents: &[S]) -> Result<Vec<VectorId>> {
        self.index.insert_batch(documents)
    }

    /// Get reference to the underlying index
    pub fn index(&self) -> &RuVectorEmbeddings {
        &self.index
    }

    /// Get mutable reference to the underlying index
    pub fn index_mut(&mut self) -> &mut RuVectorEmbeddings {
        &mut self.index
    }
}

#[cfg(test)]
mod tests {
    // Integration tests would go here
    // Require running embedder which needs model files
}
