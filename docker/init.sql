-- RuVector Initialization Script
-- This script runs automatically when the container starts

-- Create the RuVector extension
CREATE EXTENSION IF NOT EXISTS ruvector;

-- Display version
DO $$
BEGIN
    RAISE NOTICE 'RuVector extension loaded: %', (SELECT ruvector_version());
END $$;

-- Create demo schema
CREATE SCHEMA IF NOT EXISTS ruvector_demo;

-- Demo table for vector search
CREATE TABLE IF NOT EXISTS ruvector_demo.documents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    embedding ruvector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Demo table for smaller embeddings (OpenAI ada-002 compatible)
CREATE TABLE IF NOT EXISTS ruvector_demo.embeddings_384 (
    id SERIAL PRIMARY KEY,
    source_id TEXT,
    embedding ruvector(384),
    metadata JSONB DEFAULT '{}'
);

-- Demo table for hyperbolic embeddings (hierarchical data)
CREATE TABLE IF NOT EXISTS ruvector_demo.taxonomy (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES ruvector_demo.taxonomy(id),
    embedding ruvector(128),  -- Poincaré ball embeddings
    level INTEGER DEFAULT 0
);

-- Note: HNSW indexes can be created after data is inserted
-- Example:
-- CREATE INDEX ON ruvector_demo.documents USING hnsw (embedding ruvector_l2_ops)
-- WITH (m = 16, ef_construction = 64);

-- Grant permissions
GRANT USAGE ON SCHEMA ruvector_demo TO ruvector;
GRANT ALL ON ALL TABLES IN SCHEMA ruvector_demo TO ruvector;
GRANT ALL ON ALL SEQUENCES IN SCHEMA ruvector_demo TO ruvector;

-- Show available functions
DO $$
BEGIN
    RAISE NOTICE 'RuVector initialized with 53+ SQL functions including:';
    RAISE NOTICE '  - Vector: ruvector_l2_distance, ruvector_cosine_distance, ruvector_normalize';
    RAISE NOTICE '  - Hyperbolic: ruvector_poincare_distance, ruvector_mobius_add, ruvector_exp_map';
    RAISE NOTICE '  - Sparse: ruvector_sparse_dot, ruvector_bm25_score';
    RAISE NOTICE '  - GNN: ruvector_gcn_forward, ruvector_graphsage_forward';
    RAISE NOTICE '  - Attention: attention_score, attention_softmax';
    RAISE NOTICE '  - Graph: ruvector_create_graph, ruvector_cypher, ruvector_shortest_path';
    RAISE NOTICE '  - Routing: ruvector_route, ruvector_register_agent';
    RAISE NOTICE '  - Learning: ruvector_enable_learning, ruvector_record_feedback';
END $$;
