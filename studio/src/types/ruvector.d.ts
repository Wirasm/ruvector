/**
 * RuVector TypeScript Type Definitions
 * Complete type definitions for RuVector PostgreSQL extension
 */

// Extension Info
export interface ExtensionInfo {
  version: string;
  name: string;
  installed: boolean;
  schema: string;
  description?: string;
}

export interface MemoryStats {
  totalMemory: number;
  usedMemory: number;
  freeMemory: number;
  indexMemory: number;
  cacheMemory: number;
}

// Vector Index Types
export interface VectorIndex {
  name: string;
  tableName: string;
  columnName: string;
  indexType: 'hnsw' | 'ivfflat';
  dimension: number;
  metric: 'l2' | 'cosine' | 'ip';
  size: number;
  createdAt: Date;
}

export interface HNSWConfig {
  m?: number;
  efConstruction?: number;
  efSearch?: number;
  metric?: 'l2' | 'cosine' | 'ip';
  dimension?: number;
}

export interface IVFFlatConfig {
  lists?: number;
  probes?: number;
  metric?: 'l2' | 'cosine' | 'ip';
  dimension?: number;
}

export interface IndexStats {
  name: string;
  size: number;
  tuples: number;
  pages: number;
  avgTupleSize: number;
  fragmentation: number;
  lastVacuum?: Date;
  lastAnalyze?: Date;
}

// Search Results
export interface SearchResult {
  id: number | string;
  distance: number;
  data: Record<string, any>;
}

// Attention Operations
export interface AttentionType {
  name: string;
  description: string;
  supportsMultiHead: boolean;
  requiresConfig: boolean;
}

// GNN Operations
export interface GNNConfig {
  hiddenDim?: number;
  outputDim?: number;
  activation?: string;
  dropout?: number;
  aggregation?: 'mean' | 'sum' | 'max';
}

export interface GNNLayer {
  name: string;
  type: 'gcn' | 'gat' | 'sage' | 'gin';
  inputDim: number;
  outputDim: number;
  config: GNNConfig;
  createdAt: Date;
}

// Learning Operations
export interface LearningConfig {
  enableAdaptive?: boolean;
  enablePatternExtraction?: boolean;
  maxSamples?: number;
  updateInterval?: number;
  minSamples?: number;
}

export interface LearningStats {
  tableName: string;
  totalQueries: number;
  totalSamples: number;
  avgLatency: number;
  accuracy: number;
  lastUpdate: Date;
  patternsFound: number;
}

export interface TuneResult {
  previousParams: SearchParams;
  newParams: SearchParams;
  improvement: number;
  estimatedSpeedup: number;
}

export interface SearchParams {
  efSearch?: number;
  probes?: number;
  metric?: string;
  optimized?: boolean;
}

// Agent Routing
export interface AgentConfig {
  name: string;
  capabilities: string[];
  embedding: number[];
  metadata?: Record<string, any>;
  maxConcurrent?: number;
  priority?: number;
}

export interface Agent {
  name: string;
  capabilities: string[];
  embedding: number[];
  metadata: Record<string, any>;
  metrics: AgentMetrics;
  active: boolean;
  createdAt: Date;
  lastSeen: Date;
}

export interface AgentMetrics {
  totalRequests?: number;
  successRate?: number;
  avgResponseTime?: number;
  errorCount?: number;
  lastRequestTime?: Date;
  load?: number;
}

export interface RoutingOptions {
  topK?: number;
  minSimilarity?: number;
  requireCapability?: string;
  excludeAgents?: string[];
  loadBalancing?: 'round-robin' | 'least-loaded' | 'similarity';
}

export interface RoutingDecision {
  agent: Agent;
  similarity: number;
  reason: string;
  alternatives: Array<{
    agent: Agent;
    similarity: number;
  }>;
}

export interface RoutingStats {
  totalRoutes: number;
  avgResponseTime: number;
  successRate: number;
  topAgents: Array<{
    name: string;
    requests: number;
    successRate: number;
  }>;
  capabilityDistribution: Record<string, number>;
}

// Sparse Vector
export interface SparseVector {
  indices: number[];
  values: number[];
  dimension: number;
}

// Database Operations
export interface TableInfo {
  schema: string;
  name: string;
  rowCount: number;
  size: string;
  hasVectorColumns: boolean;
  vectorColumns?: string[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  isVector: boolean;
  dimension?: number;
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields: Array<{
    name: string;
    dataTypeID: number;
  }>;
  command: string;
}

// Connection Options
export interface ConnectionOptions {
  connectionString: string;
  poolSize?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  ssl?: boolean | {
    rejectUnauthorized?: boolean;
    ca?: string;
    key?: string;
    cert?: string;
  };
}

// Error Types
export interface RuVectorError {
  message: string;
  code?: string;
  detail?: string;
  hint?: string;
  query?: string;
}
