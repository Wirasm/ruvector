# RuVector

**A distributed vector database that learns.** The complete AI infrastructure platform combining vector search, graph queries, neural networks, intelligent routing, and PostgreSQL — all in one container.

## Quick Start

```bash
# Run RuVector (PostgreSQL + HTTP Server)
docker run -d --name ruvector \
  -p 5432:5432 \
  -p 8080:8080 \
  ruvnet/ruvector:latest

# Connect to PostgreSQL
psql -h localhost -U ruvector -d ruvector_db
# Password: ruvector

# Or use the HTTP API
curl http://localhost:8080/health
```

## What's Included

This single image provides the complete RuVector platform:

| Component | Description |
|-----------|-------------|
| **ruvector-core** | High-performance vector operations with SIMD (AVX-512/NEON) |
| **ruvector-server** | HTTP/gRPC API server for vector operations |
| **ruvector-postgres** | PostgreSQL extension (pgvector-compatible drop-in) |
| **ruvector-gnn** | Graph Neural Networks (GCN, GraphSAGE, GAT) |
| **ruvector-attention** | 39 attention mechanisms (Flash, Linear, Sparse, etc.) |
| **ruvector-tiny-dancer** | Intelligent AI agent routing |
| **ruvector-graph** | Graph storage with Cypher query support |
| **ruvector-cluster** | Distributed clustering with Raft consensus |
| **sona** | Self-learning with LoRA, EWC++, and ReasoningBank |

## Why RuVector?

| Feature | RuVector | Pinecone | Qdrant | Milvus | ChromaDB |
|---------|----------|----------|--------|--------|----------|
| **Latency (p50)** | **61µs** | ~2ms | ~1ms | ~5ms | ~50ms |
| **Memory (1M vectors)** | **200MB*** | 2GB | 1.5GB | 1GB | 3GB |
| **Graph Queries (Cypher)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Self-Learning (GNN)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **39 Attention Mechanisms** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Hyperbolic Embeddings** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **AI Agent Routing** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **PostgreSQL Extension** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Runtime Adaptation (SONA)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Raft Consensus** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **SIMD Optimization** | ✅ Full | Partial | ✅ | ✅ | ❌ |
| **Sparse Vectors / BM25** | ✅ | ✅ | ✅ | ✅ | ❌ |

*With adaptive tiered compression (2-32x reduction)

## Run Modes

```bash
# Full platform (PostgreSQL + HTTP Server)
docker run -d -p 5432:5432 -p 8080:8080 ruvnet/ruvector:latest

# PostgreSQL only
docker run -d -p 5432:5432 ruvnet/ruvector:latest postgres

# HTTP Server only
docker run -d -p 8080:8080 ruvnet/ruvector:latest server

# CLI interactive mode
docker run -it ruvnet/ruvector:latest cli
```

## Tutorial 1: Vector Search with PostgreSQL

```sql
-- Connect: psql -h localhost -U ruvector -d ruvector_db

-- Create extension
CREATE EXTENSION ruvector;

-- Create table with vector column
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    title TEXT,
    content TEXT,
    embedding ruvector(1536)
);

-- Insert documents (embeddings from OpenAI, Cohere, etc.)
INSERT INTO documents (title, content, embedding) VALUES
    ('AI Guide', 'Introduction to artificial intelligence...', '[0.1, 0.2, ...]'::ruvector),
    ('ML Basics', 'Machine learning fundamentals...', '[0.3, 0.1, ...]'::ruvector);

-- Create HNSW index for fast similarity search
CREATE INDEX ON documents USING ruhnsw (embedding ruvector_l2_ops)
WITH (m = 16, ef_construction = 64);

-- Find similar documents
SELECT title, content, embedding <-> $query_embedding AS distance
FROM documents
ORDER BY distance
LIMIT 10;
```

## Tutorial 2: Graph Neural Network Search

```sql
-- GNN-enhanced search improves over time
-- The network learns from query patterns

-- Create graph structure
SELECT ruvector_create_graph('knowledge_graph');
SELECT ruvector_add_node('knowledge_graph', 'concept', '{"name": "AI"}', $embedding);

-- GCN layer for graph-aware embeddings
SELECT ruvector_gcn_forward(
    node_features,
    adjacency_matrix,
    trained_weights
) AS enhanced_embeddings
FROM graph_nodes;

-- GraphSAGE for inductive learning
SELECT ruvector_graphsage_forward(features, neighbor_features, weights);
```

## Tutorial 3: Hybrid Search (Vector + BM25)

```sql
-- Combine semantic similarity with keyword matching

SELECT
    title,
    content,
    -- 70% vector similarity + 30% BM25 text score
    0.7 * (1.0 / (1.0 + embedding <-> $query_vector)) +
    0.3 * ruvector_bm25_score(terms, doc_freqs, length, avg_len, total) AS score
FROM documents
WHERE content @@ to_tsquery('machine & learning')
ORDER BY score DESC
LIMIT 10;
```

## Tutorial 4: Hyperbolic Embeddings for Hierarchies

```sql
-- Hyperbolic space preserves hierarchical relationships
-- Perfect for taxonomies, org charts, knowledge graphs

CREATE TABLE taxonomy (
    id SERIAL PRIMARY KEY,
    name TEXT,
    parent_id INTEGER,
    embedding ruvector(128)  -- Poincaré ball embeddings
);

-- Distance in hyperbolic space
SELECT name, ruvector_poincare_distance(embedding, $query, -1.0) AS distance
FROM taxonomy
ORDER BY distance
LIMIT 10;

-- Hyperbolic operations
SELECT ruvector_mobius_add(a, b, -1.0);        -- Hyperbolic translation
SELECT ruvector_exp_map(base, tangent, -1.0); -- Map to manifold
SELECT ruvector_log_map(base, target, -1.0);  -- Map to tangent space
```

## Tutorial 5: AI Agent Routing (Tiny Dancer)

```sql
-- Intelligently route queries to specialized AI agents

-- Register agents with capabilities
SELECT ruvector_register_agent('code_expert',
    ARRAY['coding', 'debugging', 'refactoring'],
    $code_embedding);

SELECT ruvector_register_agent('math_expert',
    ARRAY['mathematics', 'statistics', 'calculus'],
    $math_embedding);

SELECT ruvector_register_agent('writer',
    ARRAY['writing', 'editing', 'storytelling'],
    $writer_embedding);

-- Route user query to best agent
SELECT ruvector_route_query($user_query_embedding,
    (SELECT array_agg(row(name, capabilities)) FROM agents)
) AS best_agent;

-- Get routing statistics
SELECT * FROM ruvector_get_routing_stats();
```

## Tutorial 6: Self-Learning with SONA

```sql
-- Enable adaptive learning that improves search over time

-- Enable learning mode
SELECT ruvector_enable_learning('adaptive_search');

-- Record successful queries for training
SELECT ruvector_record_trajectory(
    input_embedding,
    output_results,
    success_score,
    context_metadata
);

-- Adaptive search uses learned patterns
SELECT ruvector_adaptive_search(query, context, ef_search);

-- View learning statistics
SELECT * FROM ruvector_learning_stats();
```

## Tutorial 7: Attention Mechanisms

```sql
-- 39 attention types for custom model inference

-- Scaled dot-product attention
SELECT ruvector_attention_scaled_dot(query, keys, values);

-- Multi-head attention (8 heads)
SELECT ruvector_attention_multi_head(query, keys, values, 8);

-- Flash attention (memory efficient)
SELECT ruvector_attention_flash(query, keys, values, 64);

-- Linear attention (O(n) complexity)
SELECT ruvector_attention_linear(query, keys, values);

-- Sparse attention
SELECT ruvector_attention_sparse(query, keys, values, sparsity_pattern);
```

## Tutorial 8: Graph Queries with Cypher

```sql
-- Neo4j-style graph queries

-- Create graph
SELECT ruvector_create_graph('social');

-- Add nodes and edges
SELECT ruvector_add_node('social', 'Person', '{"name": "Alice"}', $embedding);
SELECT ruvector_add_edge('social', 1, 2, 'KNOWS', '{"since": 2020}');

-- Cypher-style queries
SELECT ruvector_cypher('social',
    'MATCH (a:Person)-[:KNOWS]->(b:Person)
     WHERE a.name = "Alice"
     RETURN b.name'
);

-- Find shortest path
SELECT ruvector_shortest_path('social', 1, 10);

-- PageRank
SELECT ruvector_graph_pagerank('social', 0.85, 20);
```

## HTTP API Examples

```bash
# Health check
curl http://localhost:8080/health

# Insert vectors
curl -X POST http://localhost:8080/vectors \
  -H "Content-Type: application/json" \
  -d '{"id": "doc1", "vector": [0.1, 0.2, 0.3, ...], "metadata": {"title": "Example"}}'

# Search similar vectors
curl -X POST http://localhost:8080/search \
  -H "Content-Type: application/json" \
  -d '{"vector": [0.1, 0.2, 0.3, ...], "limit": 10}'

# Create index
curl -X POST http://localhost:8080/index \
  -H "Content-Type: application/json" \
  -d '{"type": "hnsw", "m": 16, "ef_construction": 64}'
```

## Distance Operators

| Operator | Distance | Best For |
|----------|----------|----------|
| `<->` | L2 (Euclidean) | General similarity |
| `<=>` | Cosine | Text embeddings |
| `<#>` | Inner Product | Normalized vectors |
| `<+>` | Manhattan (L1) | Sparse features |

## Index Types

### HNSW (Recommended for most use cases)
```sql
CREATE INDEX ON items USING ruhnsw (embedding ruvector_l2_ops)
WITH (m = 16, ef_construction = 64);

SET ruvector.ef_search = 100;  -- Tune recall vs speed
```

### IVFFlat (Better for very large datasets)
```sql
CREATE INDEX ON items USING ruivfflat (embedding ruvector_l2_ops)
WITH (lists = 100);

SET ruvector.ivfflat_probes = 10;
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | ruvector | PostgreSQL username |
| `POSTGRES_PASSWORD` | ruvector | PostgreSQL password |
| `POSTGRES_DB` | ruvector_db | Default database |
| `RUVECTOR_LOG_LEVEL` | info | Log level (debug, info, warn, error) |
| `RUVECTOR_DATA_DIR` | /var/lib/ruvector | Data directory |

## Volumes

```bash
# Persist data across restarts
docker run -d \
  -v ruvector-data:/var/lib/postgresql/data \
  -v ruvector-index:/var/lib/ruvector \
  -p 5432:5432 -p 8080:8080 \
  ruvnet/ruvector:latest
```

## Performance

| Operation | 10K vectors | 100K vectors | 1M vectors |
|-----------|-------------|--------------|------------|
| HNSW Build | 0.8s | 8.2s | 95s |
| HNSW Search (top-10) | 0.3ms | 0.5ms | 1.2ms |
| Cosine Distance | 0.01ms | 0.01ms | 0.01ms |
| GCN Forward | 2.1ms | 18ms | 180ms |
| Attention (1K seq) | 0.5ms | - | - |

## Related Packages

### npm
- [`ruvector`](https://npmjs.com/package/ruvector) - Main JavaScript/TypeScript package
- [`@ruvector/sona`](https://npmjs.com/package/@ruvector/sona) - Self-learning neural adaptation
- [`@ruvector/postgres-cli`](https://npmjs.com/package/@ruvector/postgres-cli) - PostgreSQL CLI tool
- [`ruvllm`](https://npmjs.com/package/ruvllm) - LLM integration utilities

### crates.io (Rust)
- [`ruvector-core`](https://crates.io/crates/ruvector-core) - Core vector operations
- [`ruvector-postgres`](https://crates.io/crates/ruvector-postgres) - PostgreSQL extension
- [`ruvector-sona`](https://crates.io/crates/ruvector-sona) - SONA learning system
- [`ruvector-tiny-dancer`](https://crates.io/crates/ruvector-tiny-dancer) - Agent routing

## Links

- [GitHub](https://github.com/ruvnet/ruvector)
- [Documentation](https://github.com/ruvnet/ruvector/tree/main/docs)
- [PostgreSQL Extension](https://hub.docker.com/r/ruvnet/ruvector-postgres)
- [npm Packages](https://www.npmjs.com/org/ruvector)
- [crates.io](https://crates.io/crates/ruvector-core)

## License

MIT License - See [LICENSE](https://github.com/ruvnet/ruvector/blob/main/LICENSE)
