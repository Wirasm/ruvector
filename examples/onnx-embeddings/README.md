# RuVector ONNX Embeddings

> **Reimagined embedding generation for RuVector using ONNX Runtime in pure Rust**

This example demonstrates a complete, production-ready ONNX-based embedding system designed specifically for RuVector. It provides native Rust embedding generation without Python dependencies, enabling seamless integration with RuVector's vector database.

## 🌟 Features

- **Native ONNX Inference**: Run embedding models directly in Rust via `ort` (ONNX Runtime)
- **HuggingFace Integration**: Automatic model download and caching from HuggingFace Hub
- **Multiple Pooling Strategies**: Mean, CLS, Max, MeanSqrtLen, LastToken, WeightedMean
- **SIMD Optimization**: Hardware-accelerated distance calculations via `simsimd`
- **Batch Processing**: Efficient parallel embedding generation with `rayon`
- **RuVector Integration**: Direct integration with RuVector's HNSW index
- **RAG Support**: Built-in retrieval-augmented generation pipeline
- **GPU Acceleration**: Optional CUDA, TensorRT, and CoreML support

## 📦 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     RuVector ONNX Embeddings                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌───────────┐ │
│  │    Text     │ -> │  Tokenizer  │ -> │    ONNX     │ -> │  Pooling  │ │
│  │   Input     │    │ (HF Rust)   │    │   Runtime   │    │  Strategy │ │
│  └─────────────┘    └─────────────┘    └─────────────┘    └───────────┘ │
│                                                                  │       │
│                                                                  v       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌───────────┐ │
│  │   Search    │ <- │   RuVector  │ <- │  Normalize  │ <- │ Embedding │ │
│  │  Results    │    │    Index    │    │   (L2)      │    │  Vector   │ │
│  └─────────────┘    └─────────────┘    └─────────────┘    └───────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Basic Usage

```rust
use ruvector_onnx_embeddings::{Embedder, EmbedderConfig};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Create embedder with default model (all-MiniLM-L6-v2)
    let embedder = Embedder::default_model().await?;

    // Generate embedding for a single text
    let embedding = embedder.embed_one("Hello, RuVector!")?;
    println!("Dimension: {}", embedding.len());  // 384

    // Compare similarity between texts
    let sim = embedder.similarity(
        "Rust is a systems programming language",
        "Rust focuses on safety and performance"
    )?;
    println!("Similarity: {:.4}", sim);  // ~0.85

    Ok(())
}
```

### Semantic Search with RuVector

```rust
use ruvector_onnx_embeddings::{Embedder, RuVectorEmbeddings};
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let embedder = Arc::new(Embedder::default_model().await?);
    let mut index = RuVectorEmbeddings::new_default("my_index", embedder)?;

    // Add documents
    let docs = vec![
        "Rust provides memory safety without garbage collection",
        "Python is great for machine learning",
        "JavaScript powers the web",
    ];
    index.insert_batch(&docs)?;

    // Search
    let results = index.search("memory safe programming language", 2)?;
    for r in results {
        println!("{:.4}: {}", r.score, r.text);
    }

    Ok(())
}
```

### RAG Pipeline

```rust
use ruvector_onnx_embeddings::{Embedder, RuVectorEmbeddings, RagPipeline};
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let embedder = Arc::new(Embedder::default_model().await?);
    let index = RuVectorEmbeddings::new_default("rag", embedder)?;
    let mut rag = RagPipeline::new(index, 3);

    // Add knowledge base
    rag.add_documents(&[
        "RuVector uses HNSW for fast approximate nearest neighbor search",
        "Embeddings are generated using ONNX models",
        "The default dimension is 384",
    ])?;

    // Generate context for LLM
    let context = rag.format_context("How does RuVector search work?")?;
    println!("{}", context);

    Ok(())
}
```

## 📋 Supported Models

| Model | ID | Dimension | Use Case |
|-------|-----|-----------|----------|
| all-MiniLM-L6-v2 | `AllMiniLmL6V2` | 384 | General purpose (default) |
| all-MiniLM-L12-v2 | `AllMiniLmL12V2` | 384 | Better quality |
| all-mpnet-base-v2 | `AllMpnetBaseV2` | 768 | High quality |
| multi-qa-MiniLM-L6 | `MultiQaMiniLmL6` | 384 | Question answering |
| paraphrase-MiniLM-L6-v2 | `ParaphraseMiniLmL6V2` | 384 | Paraphrase detection |
| BGE-small-en-v1.5 | `BgeSmallEnV15` | 384 | BAAI embeddings |
| E5-small-v2 | `E5SmallV2` | 384 | Microsoft E5 |
| GTE-small | `GteSmall` | 384 | Alibaba GTE |

### Using Different Models

```rust
use ruvector_onnx_embeddings::{Embedder, EmbedderConfig, PretrainedModel};

// Use a specific model
let config = EmbedderConfig::pretrained(PretrainedModel::BgeSmallEnV15);
let embedder = Embedder::new(config).await?;

// Or from HuggingFace
let config = EmbedderConfig::huggingface("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2");
let embedder = Embedder::new(config).await?;
```

## ⚙️ Configuration

### Embedder Configuration

```rust
use ruvector_onnx_embeddings::{
    EmbedderConfig, ModelSource, PoolingStrategy, ExecutionProvider
};

let config = EmbedderConfig {
    model_source: ModelSource::Pretrained(PretrainedModel::AllMiniLmL6V2),
    pooling: PoolingStrategy::Mean,
    normalize: true,
    max_length: 256,
    batch_size: 32,
    num_threads: 8,
    execution_provider: ExecutionProvider::Cpu,
    cache_dir: PathBuf::from("~/.cache/ruvector/models"),
    show_progress: true,
    use_fp16: false,
    optimize_graph: true,
};
```

### Pooling Strategies

| Strategy | Description |
|----------|-------------|
| `Mean` | Average of all token embeddings (default) |
| `Cls` | Use [CLS] token embedding |
| `Max` | Max pooling across tokens |
| `MeanSqrtLen` | Mean pooling scaled by sqrt(length) |
| `LastToken` | Use last token (for decoder models) |
| `WeightedMean` | Position-weighted mean |

### GPU Acceleration

```rust
// CUDA
let config = EmbedderConfig {
    execution_provider: ExecutionProvider::Cuda { device_id: 0 },
    ..Default::default()
};

// TensorRT (requires feature)
let config = EmbedderConfig {
    execution_provider: ExecutionProvider::TensorRt { device_id: 0 },
    ..Default::default()
};
```

## 📊 Performance

Benchmarks on AMD Ryzen 9 / 32GB RAM:

| Operation | Dimension | Time | Throughput |
|-----------|-----------|------|------------|
| Single embedding | 384 | ~5ms | 200/sec |
| Batch (32) | 384 | ~40ms | 800/sec |
| Batch (32) parallel | 384 | ~15ms | 2,100/sec |
| Cosine similarity | 384 | ~100ns | 10M/sec |

## 🔧 Building

```bash
# Basic build
cargo build --release

# With CUDA support
cargo build --release --features cuda

# With TensorRT
cargo build --release --features tensorrt

# With CoreML (macOS)
cargo build --release --features coreml

# Run examples
cargo run --example basic
cargo run --example semantic_search

# Run benchmarks
cargo bench
```

## 📁 Project Structure

```
onnx-embeddings/
├── Cargo.toml              # Dependencies
├── README.md               # This file
├── src/
│   ├── lib.rs              # Library root
│   ├── config.rs           # Configuration types
│   ├── error.rs            # Error handling
│   ├── tokenizer.rs        # HuggingFace tokenizer wrapper
│   ├── model.rs            # ONNX model loading
│   ├── pooling.rs          # Pooling strategies
│   ├── embedder.rs         # Main embedder implementation
│   ├── ruvector_integration.rs  # RuVector integration
│   └── main.rs             # Example usage
├── examples/
│   ├── basic.rs            # Basic embedding
│   ├── batch.rs            # Batch processing
│   └── semantic_search.rs  # Full search example
├── benches/
│   └── embedding_benchmark.rs  # Performance benchmarks
└── models/                 # Cached models (auto-downloaded)
```

## 🔗 Integration with RuVector

This module is designed to integrate seamlessly with RuVector's ecosystem:

- **ruvector-core**: Direct integration with HNSW index
- **ruvector-gnn**: GNN-enhanced embeddings for improved search
- **ruvector-graph**: Embedding-aware graph queries
- **ruvector-wasm**: WebAssembly-compatible embedding (with tract backend)

## 📚 Related Resources

- [ONNX Runtime](https://onnxruntime.ai/)
- [HuggingFace Tokenizers](https://github.com/huggingface/tokenizers)
- [Sentence Transformers](https://www.sbert.net/)
- [RuVector Documentation](../../docs/)

## 📄 License

MIT License - see the main RuVector repository for details.
