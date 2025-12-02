-- RuVector PostgreSQL Extension
-- Version: 0.1.0
-- High-performance vector similarity search with SIMD optimizations

-- Complain if script is sourced in psql, rather than via CREATE EXTENSION
\echo Use "CREATE EXTENSION ruvector" to load this file. \quit

-- ============================================================================
-- Utility Functions
-- ============================================================================

-- Get extension version
CREATE OR REPLACE FUNCTION ruvector_version()
RETURNS text
AS 'MODULE_PATHNAME', 'ruvector_version_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Get SIMD info
CREATE OR REPLACE FUNCTION ruvector_simd_info()
RETURNS text
AS 'MODULE_PATHNAME', 'ruvector_simd_info_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Get memory stats
CREATE OR REPLACE FUNCTION ruvector_memory_stats()
RETURNS jsonb
AS 'MODULE_PATHNAME', 'ruvector_memory_stats_wrapper'
LANGUAGE C VOLATILE PARALLEL SAFE;

-- ============================================================================
-- Native RuVector Type (pgvector-compatible)
-- ============================================================================

-- Create the ruvector type using low-level I/O functions
CREATE TYPE ruvector;

CREATE OR REPLACE FUNCTION ruvector_in(cstring) RETURNS ruvector
AS 'MODULE_PATHNAME', 'ruvector_in' LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

CREATE OR REPLACE FUNCTION ruvector_out(ruvector) RETURNS cstring
AS 'MODULE_PATHNAME', 'ruvector_out' LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

CREATE OR REPLACE FUNCTION ruvector_recv(internal) RETURNS ruvector
AS 'MODULE_PATHNAME', 'ruvector_recv' LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

CREATE OR REPLACE FUNCTION ruvector_send(ruvector) RETURNS bytea
AS 'MODULE_PATHNAME', 'ruvector_send' LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

CREATE OR REPLACE FUNCTION ruvector_typmod_in(cstring[]) RETURNS int
AS 'MODULE_PATHNAME', 'ruvector_typmod_in' LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

CREATE OR REPLACE FUNCTION ruvector_typmod_out(int) RETURNS cstring
AS 'MODULE_PATHNAME', 'ruvector_typmod_out' LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

CREATE TYPE ruvector (
    INPUT = ruvector_in,
    OUTPUT = ruvector_out,
    RECEIVE = ruvector_recv,
    SEND = ruvector_send,
    TYPMOD_IN = ruvector_typmod_in,
    TYPMOD_OUT = ruvector_typmod_out,
    STORAGE = extended,
    INTERNALLENGTH = VARIABLE,
    ALIGNMENT = double
);

-- ============================================================================
-- Native RuVector Distance Functions (SIMD-optimized)
-- ============================================================================

-- L2 distance for native ruvector type
CREATE OR REPLACE FUNCTION ruvector_l2_distance(a ruvector, b ruvector)
RETURNS real
AS 'MODULE_PATHNAME', 'ruvector_l2_distance_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Cosine distance for native ruvector type
CREATE OR REPLACE FUNCTION ruvector_cosine_distance(a ruvector, b ruvector)
RETURNS real
AS 'MODULE_PATHNAME', 'ruvector_cosine_distance_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Inner product for native ruvector type
CREATE OR REPLACE FUNCTION ruvector_inner_product(a ruvector, b ruvector)
RETURNS real
AS 'MODULE_PATHNAME', 'ruvector_inner_product_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Manhattan (L1) distance for native ruvector type
CREATE OR REPLACE FUNCTION ruvector_l1_distance(a ruvector, b ruvector)
RETURNS real
AS 'MODULE_PATHNAME', 'ruvector_l1_distance_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Get dimensions of ruvector
CREATE OR REPLACE FUNCTION ruvector_dims(v ruvector)
RETURNS int
AS 'MODULE_PATHNAME', 'ruvector_dims_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Get L2 norm of ruvector
CREATE OR REPLACE FUNCTION ruvector_norm(v ruvector)
RETURNS real
AS 'MODULE_PATHNAME', 'ruvector_norm_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Normalize ruvector
CREATE OR REPLACE FUNCTION ruvector_normalize(v ruvector)
RETURNS ruvector
AS 'MODULE_PATHNAME', 'ruvector_normalize_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Add two ruvectors
CREATE OR REPLACE FUNCTION ruvector_add(a ruvector, b ruvector)
RETURNS ruvector
AS 'MODULE_PATHNAME', 'ruvector_add_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Subtract two ruvectors
CREATE OR REPLACE FUNCTION ruvector_sub(a ruvector, b ruvector)
RETURNS ruvector
AS 'MODULE_PATHNAME', 'ruvector_sub_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Multiply ruvector by scalar
CREATE OR REPLACE FUNCTION ruvector_mul_scalar(v ruvector, s real)
RETURNS ruvector
AS 'MODULE_PATHNAME', 'ruvector_mul_scalar_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- ============================================================================
-- Operators for Native RuVector Type
-- ============================================================================

-- L2 distance operator (<->)
CREATE OPERATOR <-> (
    LEFTARG = ruvector,
    RIGHTARG = ruvector,
    FUNCTION = ruvector_l2_distance,
    COMMUTATOR = '<->'
);

-- Cosine distance operator (<=>)
CREATE OPERATOR <=> (
    LEFTARG = ruvector,
    RIGHTARG = ruvector,
    FUNCTION = ruvector_cosine_distance,
    COMMUTATOR = '<=>'
);

-- Inner product operator (<#>)
CREATE OPERATOR <#> (
    LEFTARG = ruvector,
    RIGHTARG = ruvector,
    FUNCTION = ruvector_inner_product,
    COMMUTATOR = '<#>'
);

-- Addition operator (+)
CREATE OPERATOR + (
    LEFTARG = ruvector,
    RIGHTARG = ruvector,
    FUNCTION = ruvector_add,
    COMMUTATOR = '+'
);

-- Subtraction operator (-)
CREATE OPERATOR - (
    LEFTARG = ruvector,
    RIGHTARG = ruvector,
    FUNCTION = ruvector_sub
);

-- ============================================================================
-- Distance Functions (array-based with SIMD optimization)
-- ============================================================================

-- L2 (Euclidean) distance between two float arrays
CREATE OR REPLACE FUNCTION l2_distance_arr(a real[], b real[])
RETURNS real
AS 'MODULE_PATHNAME', 'l2_distance_arr_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Inner product between two float arrays
CREATE OR REPLACE FUNCTION inner_product_arr(a real[], b real[])
RETURNS real
AS 'MODULE_PATHNAME', 'inner_product_arr_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Negative inner product (for ORDER BY ASC nearest neighbor)
CREATE OR REPLACE FUNCTION neg_inner_product_arr(a real[], b real[])
RETURNS real
AS 'MODULE_PATHNAME', 'neg_inner_product_arr_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Cosine distance between two float arrays
CREATE OR REPLACE FUNCTION cosine_distance_arr(a real[], b real[])
RETURNS real
AS 'MODULE_PATHNAME', 'cosine_distance_arr_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Cosine similarity between two float arrays
CREATE OR REPLACE FUNCTION cosine_similarity_arr(a real[], b real[])
RETURNS real
AS 'MODULE_PATHNAME', 'cosine_similarity_arr_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- L1 (Manhattan) distance between two float arrays
CREATE OR REPLACE FUNCTION l1_distance_arr(a real[], b real[])
RETURNS real
AS 'MODULE_PATHNAME', 'l1_distance_arr_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- ============================================================================
-- Vector Utility Functions
-- ============================================================================

-- Normalize a vector to unit length
CREATE OR REPLACE FUNCTION vector_normalize(v real[])
RETURNS real[]
AS 'MODULE_PATHNAME', 'vector_normalize_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Add two vectors element-wise
CREATE OR REPLACE FUNCTION vector_add(a real[], b real[])
RETURNS real[]
AS 'MODULE_PATHNAME', 'vector_add_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Subtract two vectors element-wise
CREATE OR REPLACE FUNCTION vector_sub(a real[], b real[])
RETURNS real[]
AS 'MODULE_PATHNAME', 'vector_sub_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Multiply vector by scalar
CREATE OR REPLACE FUNCTION vector_mul_scalar(v real[], scalar real)
RETURNS real[]
AS 'MODULE_PATHNAME', 'vector_mul_scalar_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Get vector dimensions
CREATE OR REPLACE FUNCTION vector_dims(v real[])
RETURNS int
AS 'MODULE_PATHNAME', 'vector_dims_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Get vector L2 norm
CREATE OR REPLACE FUNCTION vector_norm(v real[])
RETURNS real
AS 'MODULE_PATHNAME', 'vector_norm_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Average two vectors
CREATE OR REPLACE FUNCTION vector_avg2(a real[], b real[])
RETURNS real[]
AS 'MODULE_PATHNAME', 'vector_avg2_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- ============================================================================
-- Quantization Functions
-- ============================================================================

-- Binary quantize a vector
CREATE OR REPLACE FUNCTION binary_quantize_arr(v real[])
RETURNS bytea
AS 'MODULE_PATHNAME', 'binary_quantize_arr_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Scalar quantize a vector (SQ8)
CREATE OR REPLACE FUNCTION scalar_quantize_arr(v real[])
RETURNS jsonb
AS 'MODULE_PATHNAME', 'scalar_quantize_arr_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- ============================================================================
-- Aggregate Functions
-- ============================================================================

-- State transition function for vector sum
CREATE OR REPLACE FUNCTION vector_sum_state(state real[], value real[])
RETURNS real[]
AS $$
SELECT CASE
    WHEN state IS NULL THEN value
    WHEN value IS NULL THEN state
    ELSE vector_add(state, value)
END;
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;

-- Final function for vector average
CREATE OR REPLACE FUNCTION vector_avg_final(state real[], count bigint)
RETURNS real[]
AS $$
SELECT CASE
    WHEN state IS NULL OR count = 0 THEN NULL
    ELSE vector_mul_scalar(state, 1.0 / count::real)
END;
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;

-- Vector sum aggregate
CREATE AGGREGATE vector_sum(real[]) (
    SFUNC = vector_sum_state,
    STYPE = real[],
    PARALLEL = SAFE
);

-- ============================================================================
-- Fast Pre-Normalized Cosine Distance (3x faster)
-- ============================================================================

-- Cosine distance for pre-normalized vectors (only dot product)
CREATE OR REPLACE FUNCTION cosine_distance_normalized_arr(a real[], b real[])
RETURNS real
AS 'MODULE_PATHNAME', 'cosine_distance_normalized_arr_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- ============================================================================
-- Temporal Compression Functions
-- ============================================================================

-- Compute delta between two consecutive vectors
CREATE OR REPLACE FUNCTION temporal_delta(current real[], previous real[])
RETURNS real[]
AS 'MODULE_PATHNAME', 'temporal_delta_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Reconstruct vector from delta and previous vector
CREATE OR REPLACE FUNCTION temporal_undelta(delta real[], previous real[])
RETURNS real[]
AS 'MODULE_PATHNAME', 'temporal_undelta_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Exponential moving average update
CREATE OR REPLACE FUNCTION temporal_ema_update(current real[], ema_prev real[], alpha real)
RETURNS real[]
AS 'MODULE_PATHNAME', 'temporal_ema_update_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Compute temporal drift (rate of change)
CREATE OR REPLACE FUNCTION temporal_drift(v1 real[], v2 real[], time_delta real)
RETURNS real
AS 'MODULE_PATHNAME', 'temporal_drift_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Compute velocity (first derivative)
CREATE OR REPLACE FUNCTION temporal_velocity(v_t0 real[], v_t1 real[], dt real)
RETURNS real[]
AS 'MODULE_PATHNAME', 'temporal_velocity_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- ============================================================================
-- Attention Mechanism Functions
-- ============================================================================

-- Compute scaled attention score between query and key
CREATE OR REPLACE FUNCTION attention_score(query real[], key real[])
RETURNS real
AS 'MODULE_PATHNAME', 'attention_score_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Apply softmax to scores array
CREATE OR REPLACE FUNCTION attention_softmax(scores real[])
RETURNS real[]
AS 'MODULE_PATHNAME', 'attention_softmax_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Weighted vector addition for attention
CREATE OR REPLACE FUNCTION attention_weighted_add(accumulator real[], value real[], weight real)
RETURNS real[]
AS 'MODULE_PATHNAME', 'attention_weighted_add_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Initialize attention accumulator
CREATE OR REPLACE FUNCTION attention_init(dim int)
RETURNS real[]
AS 'MODULE_PATHNAME', 'attention_init_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Compute single attention (returns JSON with score and value)
CREATE OR REPLACE FUNCTION attention_single(query real[], key real[], value real[], score_offset real)
RETURNS jsonb
AS 'MODULE_PATHNAME', 'attention_single_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- ============================================================================
-- Graph Traversal Functions
-- ============================================================================

-- Compute edge similarity between two vectors
CREATE OR REPLACE FUNCTION graph_edge_similarity(source real[], target real[])
RETURNS real
AS 'MODULE_PATHNAME', 'graph_edge_similarity_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- PageRank contribution calculation
CREATE OR REPLACE FUNCTION graph_pagerank_contribution(importance real, num_neighbors int, damping real)
RETURNS real
AS 'MODULE_PATHNAME', 'graph_pagerank_contribution_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- PageRank base importance
CREATE OR REPLACE FUNCTION graph_pagerank_base(num_nodes int, damping real)
RETURNS real
AS 'MODULE_PATHNAME', 'graph_pagerank_base_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Check semantic connection
CREATE OR REPLACE FUNCTION graph_is_connected(v1 real[], v2 real[], threshold real)
RETURNS boolean
AS 'MODULE_PATHNAME', 'graph_is_connected_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Centroid update for clustering
CREATE OR REPLACE FUNCTION graph_centroid_update(centroid real[], neighbor real[], weight real)
RETURNS real[]
AS 'MODULE_PATHNAME', 'graph_centroid_update_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- Bipartite matching score for RAG
CREATE OR REPLACE FUNCTION graph_bipartite_score(query real[], node real[], edge_weight real)
RETURNS real
AS 'MODULE_PATHNAME', 'graph_bipartite_score_wrapper'
LANGUAGE C IMMUTABLE STRICT PARALLEL SAFE;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION ruvector_version() IS 'Returns RuVector extension version';
COMMENT ON FUNCTION ruvector_simd_info() IS 'Returns SIMD capability information';
COMMENT ON FUNCTION ruvector_memory_stats() IS 'Returns memory statistics for the extension';
COMMENT ON FUNCTION l2_distance_arr(real[], real[]) IS 'Compute L2 (Euclidean) distance between two vectors';
COMMENT ON FUNCTION cosine_distance_arr(real[], real[]) IS 'Compute cosine distance between two vectors';
COMMENT ON FUNCTION cosine_distance_normalized_arr(real[], real[]) IS 'Fast cosine distance for pre-normalized vectors (3x faster)';
COMMENT ON FUNCTION inner_product_arr(real[], real[]) IS 'Compute inner product between two vectors';
COMMENT ON FUNCTION l1_distance_arr(real[], real[]) IS 'Compute L1 (Manhattan) distance between two vectors';
COMMENT ON FUNCTION vector_normalize(real[]) IS 'Normalize a vector to unit length';
COMMENT ON FUNCTION vector_add(real[], real[]) IS 'Add two vectors element-wise';
COMMENT ON FUNCTION vector_sub(real[], real[]) IS 'Subtract two vectors element-wise';
COMMENT ON FUNCTION vector_mul_scalar(real[], real) IS 'Multiply vector by scalar';
COMMENT ON FUNCTION vector_dims(real[]) IS 'Get vector dimensions';
COMMENT ON FUNCTION vector_norm(real[]) IS 'Get vector L2 norm';
COMMENT ON FUNCTION binary_quantize_arr(real[]) IS 'Binary quantize a vector (32x compression)';
COMMENT ON FUNCTION scalar_quantize_arr(real[]) IS 'Scalar quantize a vector (4x compression)';
COMMENT ON FUNCTION temporal_delta(real[], real[]) IS 'Compute delta between consecutive vectors for compression';
COMMENT ON FUNCTION temporal_undelta(real[], real[]) IS 'Reconstruct vector from delta encoding';
COMMENT ON FUNCTION temporal_ema_update(real[], real[], real) IS 'Exponential moving average update step';
COMMENT ON FUNCTION temporal_drift(real[], real[], real) IS 'Compute temporal drift (rate of change) between vectors';
COMMENT ON FUNCTION temporal_velocity(real[], real[], real) IS 'Compute velocity (first derivative) of vector';
COMMENT ON FUNCTION attention_score(real[], real[]) IS 'Compute scaled attention score between query and key';
COMMENT ON FUNCTION attention_softmax(real[]) IS 'Apply softmax to scores array';
COMMENT ON FUNCTION attention_weighted_add(real[], real[], real) IS 'Weighted vector addition for attention';
COMMENT ON FUNCTION attention_init(int) IS 'Initialize zero-vector accumulator for attention';
COMMENT ON FUNCTION attention_single(real[], real[], real[], real) IS 'Single key-value attention with score';
COMMENT ON FUNCTION graph_edge_similarity(real[], real[]) IS 'Compute edge similarity (cosine) between vectors';
COMMENT ON FUNCTION graph_pagerank_contribution(real, int, real) IS 'Calculate PageRank contribution to neighbors';
COMMENT ON FUNCTION graph_pagerank_base(int, real) IS 'Initialize PageRank base importance';
COMMENT ON FUNCTION graph_is_connected(real[], real[], real) IS 'Check if vectors are semantically connected';
COMMENT ON FUNCTION graph_centroid_update(real[], real[], real) IS 'Update centroid with neighbor contribution';
COMMENT ON FUNCTION graph_bipartite_score(real[], real[], real) IS 'Compute bipartite matching score for RAG';
