//! ONNX model loading and management

use crate::config::{EmbedderConfig, ExecutionProvider, ModelSource};
use crate::{EmbeddingError, PretrainedModel, Result};
use indicatif::{ProgressBar, ProgressStyle};
use ort::{GraphOptimizationLevel, Session, SessionBuilder};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tracing::{debug, info, instrument, warn};

/// Information about a loaded model
#[derive(Debug, Clone)]
pub struct ModelInfo {
    /// Model name or identifier
    pub name: String,
    /// Embedding dimension
    pub dimension: usize,
    /// Maximum sequence length
    pub max_seq_length: usize,
    /// Model file size in bytes
    pub file_size: u64,
    /// Model input names
    pub input_names: Vec<String>,
    /// Model output names
    pub output_names: Vec<String>,
}

/// ONNX model wrapper with inference capabilities
pub struct OnnxModel {
    session: Session,
    info: ModelInfo,
}

impl OnnxModel {
    /// Load model from configuration
    #[instrument(skip_all)]
    pub async fn from_config(config: &EmbedderConfig) -> Result<Self> {
        match &config.model_source {
            ModelSource::Local {
                model_path,
                tokenizer_path: _,
            } => Self::from_file(model_path, config).await,

            ModelSource::Pretrained(model) => Self::from_pretrained(*model, config).await,

            ModelSource::HuggingFace { model_id, revision } => {
                Self::from_huggingface(model_id, revision.as_deref(), config).await
            }

            ModelSource::Url {
                model_url,
                tokenizer_url: _,
            } => Self::from_url(model_url, config).await,
        }
    }

    /// Load model from a local ONNX file
    #[instrument(skip_all, fields(path = %path.as_ref().display()))]
    pub async fn from_file(path: impl AsRef<Path>, config: &EmbedderConfig) -> Result<Self> {
        let path = path.as_ref();
        info!("Loading ONNX model from file: {}", path.display());

        if !path.exists() {
            return Err(EmbeddingError::model_not_found(path.display().to_string()));
        }

        let file_size = fs::metadata(path)?.len();
        let session = Self::create_session(path, config)?;
        let info = Self::extract_model_info(&session, path, file_size)?;

        Ok(Self { session, info })
    }

    /// Load a pretrained model (downloads if not cached)
    #[instrument(skip_all, fields(model = ?model))]
    pub async fn from_pretrained(model: PretrainedModel, config: &EmbedderConfig) -> Result<Self> {
        let model_id = model.model_id();
        info!("Loading pretrained model: {}", model_id);

        // Check cache first
        let cache_path = config.cache_dir.join(sanitize_model_id(model_id));
        let model_path = cache_path.join("model.onnx");

        if model_path.exists() {
            debug!("Found cached model at {}", model_path.display());
            return Self::from_file(&model_path, config).await;
        }

        // Download from HuggingFace
        Self::from_huggingface(model_id, None, config).await
    }

    /// Load model from HuggingFace Hub
    #[instrument(skip_all, fields(model_id = %model_id))]
    pub async fn from_huggingface(
        model_id: &str,
        revision: Option<&str>,
        config: &EmbedderConfig,
    ) -> Result<Self> {
        let cache_path = config.cache_dir.join(sanitize_model_id(model_id));
        fs::create_dir_all(&cache_path)?;

        let model_path = cache_path.join("model.onnx");

        if !model_path.exists() {
            info!("Downloading model from HuggingFace: {}", model_id);
            download_from_huggingface(model_id, revision, &cache_path, config.show_progress)
                .await?;
        }

        Self::from_file(&model_path, config).await
    }

    /// Load model from a URL
    #[instrument(skip_all, fields(url = %url))]
    pub async fn from_url(url: &str, config: &EmbedderConfig) -> Result<Self> {
        let hash = hash_url(url);
        let cache_path = config.cache_dir.join(&hash);
        fs::create_dir_all(&cache_path)?;

        let model_path = cache_path.join("model.onnx");

        if !model_path.exists() {
            info!("Downloading model from URL: {}", url);
            download_file(url, &model_path, config.show_progress).await?;
        }

        Self::from_file(&model_path, config).await
    }

    /// Create an ONNX session with the specified configuration
    fn create_session(path: &Path, config: &EmbedderConfig) -> Result<Session> {
        let mut builder = SessionBuilder::new()?;

        // Set optimization level
        if config.optimize_graph {
            builder = builder.with_optimization_level(GraphOptimizationLevel::Level3)?;
        }

        // Set number of threads
        builder = builder.with_intra_threads(config.num_threads)?;

        // Configure execution provider
        match config.execution_provider {
            ExecutionProvider::Cpu => {
                // Default CPU provider
            }
            #[cfg(feature = "cuda")]
            ExecutionProvider::Cuda { device_id } => {
                builder = builder.with_execution_providers([
                    ort::CUDAExecutionProvider::default()
                        .with_device_id(device_id)
                        .build(),
                ])?;
            }
            #[cfg(feature = "tensorrt")]
            ExecutionProvider::TensorRt { device_id } => {
                builder = builder.with_execution_providers([
                    ort::TensorRTExecutionProvider::default()
                        .with_device_id(device_id)
                        .build(),
                ])?;
            }
            #[cfg(feature = "coreml")]
            ExecutionProvider::CoreMl => {
                builder = builder.with_execution_providers([
                    ort::CoreMLExecutionProvider::default().build(),
                ])?;
            }
            _ => {
                warn!(
                    "Requested execution provider not available, falling back to CPU"
                );
            }
        }

        let session = builder.commit_from_file(path)?;
        Ok(session)
    }

    /// Extract model information from the session
    fn extract_model_info(session: &Session, path: &Path, file_size: u64) -> Result<ModelInfo> {
        let inputs = session.inputs.iter().map(|i| i.name.clone()).collect();
        let outputs = session.outputs.iter().map(|o| o.name.clone()).collect();

        // Try to determine embedding dimension from output shape
        let dimension = session
            .outputs
            .first()
            .and_then(|o| {
                o.output_type.tensor_dimensions().and_then(|dims| {
                    // Usually [batch, seq_len, dim] or [batch, dim]
                    dims.last().copied()
                })
            })
            .unwrap_or(384) as usize;

        let name = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        Ok(ModelInfo {
            name,
            dimension,
            max_seq_length: 512, // Default, may be overridden
            file_size,
            input_names: inputs,
            output_names: outputs,
        })
    }

    /// Run inference on encoded inputs
    #[instrument(skip_all, fields(batch_size, seq_length))]
    pub fn run(
        &self,
        input_ids: &[i64],
        attention_mask: &[i64],
        token_type_ids: &[i64],
        shape: &[usize],
    ) -> Result<Vec<Vec<f32>>> {
        use ndarray::Array2;
        use ort::inputs;

        let batch_size = shape[0];
        let seq_length = shape[1];

        debug!(
            "Running inference: batch_size={}, seq_length={}",
            batch_size, seq_length
        );

        // Create input tensors
        let input_ids_array = Array2::from_shape_vec(
            (batch_size, seq_length),
            input_ids.to_vec(),
        )?;
        let attention_mask_array = Array2::from_shape_vec(
            (batch_size, seq_length),
            attention_mask.to_vec(),
        )?;
        let token_type_ids_array = Array2::from_shape_vec(
            (batch_size, seq_length),
            token_type_ids.to_vec(),
        )?;

        // Run inference
        let outputs = self.session.run(inputs![
            "input_ids" => input_ids_array,
            "attention_mask" => attention_mask_array,
            "token_type_ids" => token_type_ids_array,
        ]?)?;

        // Extract output tensor
        // Usually the output is [batch, seq_len, hidden_size] or [batch, hidden_size]
        let output = outputs
            .get("last_hidden_state")
            .or_else(|| outputs.get("output"))
            .or_else(|| outputs.get("sentence_embedding"))
            .or_else(|| outputs.values().next())
            .ok_or_else(|| EmbeddingError::invalid_model("No output tensor found"))?;

        let tensor = output
            .try_extract_tensor::<f32>()
            .map_err(|e| EmbeddingError::invalid_model(e.to_string()))?;

        let view = tensor.view();
        let dims = view.shape();

        // Handle different output shapes
        let embeddings = if dims.len() == 3 {
            // [batch, seq_len, hidden] - need pooling
            let hidden_size = dims[2];
            (0..batch_size)
                .map(|i| {
                    let start = i * seq_length * hidden_size;
                    let end = start + seq_length * hidden_size;
                    view.as_slice()
                        .map(|s| s[start..end].to_vec())
                        .unwrap_or_default()
                })
                .collect()
        } else if dims.len() == 2 {
            // [batch, hidden] - already pooled
            let hidden_size = dims[1];
            (0..batch_size)
                .map(|i| {
                    let start = i * hidden_size;
                    let end = start + hidden_size;
                    view.as_slice()
                        .map(|s| s[start..end].to_vec())
                        .unwrap_or_default()
                })
                .collect()
        } else {
            return Err(EmbeddingError::invalid_model(format!(
                "Unexpected output shape: {:?}",
                dims
            )));
        };

        Ok(embeddings)
    }

    /// Get model info
    pub fn info(&self) -> &ModelInfo {
        &self.info
    }

    /// Get embedding dimension
    pub fn dimension(&self) -> usize {
        self.info.dimension
    }
}

/// Download model files from HuggingFace Hub
async fn download_from_huggingface(
    model_id: &str,
    revision: Option<&str>,
    cache_path: &Path,
    show_progress: bool,
) -> Result<()> {
    let revision = revision.unwrap_or("main");
    let base_url = format!(
        "https://huggingface.co/{}/resolve/{}",
        model_id, revision
    );

    // Files to download
    let files = ["model.onnx", "tokenizer.json", "config.json"];

    for file in files {
        let url = format!("{}/{}", base_url, file);
        let path = cache_path.join(file);

        if !path.exists() {
            match download_file(&url, &path, show_progress).await {
                Ok(_) => debug!("Downloaded {}", file),
                Err(e) => {
                    if file == "model.onnx" {
                        return Err(e);
                    }
                    warn!("Failed to download {}: {}", file, e);
                }
            }
        }
    }

    // Also try ONNX subfolder
    let onnx_model_url = format!("{}/onnx/model.onnx", base_url);
    let model_path = cache_path.join("model.onnx");

    if !model_path.exists() {
        download_file(&onnx_model_url, &model_path, show_progress).await?;
    }

    Ok(())
}

/// Download a file from URL with optional progress bar
async fn download_file(url: &str, path: &Path, show_progress: bool) -> Result<()> {
    let client = reqwest::Client::new();
    let response = client.get(url).send().await?;

    if !response.status().is_success() {
        return Err(EmbeddingError::download_failed(format!(
            "HTTP {}: {}",
            response.status(),
            url
        )));
    }

    let total_size = response.content_length().unwrap_or(0);

    let pb = if show_progress && total_size > 0 {
        let pb = ProgressBar::new(total_size);
        pb.set_style(
            ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta})")
                .unwrap()
                .progress_chars("#>-"),
        );
        Some(pb)
    } else {
        None
    };

    let mut file = fs::File::create(path)?;
    let mut downloaded = 0u64;

    use futures_util::StreamExt;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk)?;
        downloaded += chunk.len() as u64;
        if let Some(ref pb) = pb {
            pb.set_position(downloaded);
        }
    }

    if let Some(pb) = pb {
        pb.finish_with_message("Downloaded");
    }

    Ok(())
}

/// Sanitize model ID for use as directory name
fn sanitize_model_id(model_id: &str) -> String {
    model_id
        .replace('/', "_")
        .replace('\\', "_")
        .replace(':', "_")
}

/// Create a hash of a URL for caching
fn hash_url(url: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(url.as_bytes());
    hex::encode(&hasher.finalize()[..8])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_model_id() {
        assert_eq!(
            sanitize_model_id("sentence-transformers/all-MiniLM-L6-v2"),
            "sentence-transformers_all-MiniLM-L6-v2"
        );
    }

    #[test]
    fn test_hash_url() {
        let hash = hash_url("https://example.com/model.onnx");
        assert_eq!(hash.len(), 16); // 8 bytes = 16 hex chars
    }
}
