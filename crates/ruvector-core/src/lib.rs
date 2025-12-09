//! # Ruvector Core
//!
//! High-performance Rust-native vector database with HNSW indexing and SIMD-optimized operations.
//!
//! ## Working Features (Tested & Benchmarked)
//!
//! - **HNSW Indexing**: Approximate nearest neighbor search with O(log n) complexity
//! - **SIMD Distance**: SimSIMD-powered distance calculations (~16M ops/sec for 512-dim)
//! - **Quantization**: Scalar (4x) and binary (32x) compression with distance support
//! - **Persistence**: REDB-based storage with config persistence
//! - **Search**: ~2.5K queries/sec on 10K vectors (benchmarked)
//!
//! ## Experimental/Incomplete Features
//!
//! - **AgenticDB**: Uses placeholder hash-based embeddings (NOT semantic)
//!   - Replace `generate_text_embedding` with real model for production use
//! - **Advanced Features**: Conformal prediction, hybrid search - functional but less tested
//!
//! ## What This Is NOT
//!
//! - This is NOT a complete RAG solution - you need external embedding models
//! - Examples use mock embeddings for demonstration only

#![warn(missing_docs)]
#![warn(clippy::all)]

pub mod advanced_features;

// AgenticDB requires storage feature
#[cfg(feature = "storage")]
pub mod agenticdb;

pub mod distance;
pub mod error;
pub mod index;
pub mod quantization;

// Storage backends - conditional compilation based on features
#[cfg(feature = "storage")]
pub mod storage;

#[cfg(not(feature = "storage"))]
pub mod storage_memory;

#[cfg(not(feature = "storage"))]
pub use storage_memory as storage;

pub mod types;
pub mod vector_db;

// Performance optimization modules
pub mod arena;
pub mod cache_optimized;
pub mod lockfree;
pub mod simd_intrinsics;

/// Advanced techniques: hypergraphs, learned indexes, neural hashing, TDA (Phase 6)
pub mod advanced;

// Re-exports
pub use advanced_features::{
    ConformalConfig, ConformalPredictor, EnhancedPQ, FilterExpression, FilterStrategy,
    FilteredSearch, HybridConfig, HybridSearch, MMRConfig, MMRSearch, PQConfig, PredictionSet,
    BM25,
};

#[cfg(feature = "storage")]
pub use agenticdb::AgenticDB;

pub use error::{Result, RuvectorError};
pub use types::{DistanceMetric, SearchQuery, SearchResult, VectorEntry, VectorId};
pub use vector_db::VectorDB;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        // Verify version matches workspace - use dynamic check instead of hardcoded value
        let version = env!("CARGO_PKG_VERSION");
        assert!(!version.is_empty(), "Version should not be empty");
        assert!(version.starts_with("0.1."), "Version should be 0.1.x");
    }
}
