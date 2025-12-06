/**
 * RuVector API Client
 * Complete TypeScript client for RuVector PostgreSQL extension
 */

import { Pool, PoolConfig, QueryResult as PgQueryResult } from 'pg';
import type {
  ExtensionInfo,
  MemoryStats,
  VectorIndex,
  HNSWConfig,
  IVFFlatConfig,
  IndexStats,
  SearchResult,
  AttentionType,
  GNNConfig,
  GNNLayer,
  LearningConfig,
  LearningStats,
  TuneResult,
  SearchParams,
  AgentConfig,
  Agent,
  AgentMetrics,
  RoutingOptions,
  RoutingDecision,
  RoutingStats,
  TableInfo,
  ColumnInfo,
  QueryResult,
  ConnectionOptions,
  RuVectorError,
} from '../../types/ruvector';

export class RuVectorAPI {
  private pool: Pool;
  private connected: boolean = false;

  constructor(connectionString: string);
  constructor(options: ConnectionOptions);
  constructor(connectionStringOrOptions: string | ConnectionOptions) {
    const config: PoolConfig = typeof connectionStringOrOptions === 'string'
      ? { connectionString: connectionStringOrOptions }
      : {
          connectionString: connectionStringOrOptions.connectionString,
          max: connectionStringOrOptions.poolSize || 10,
          connectionTimeoutMillis: connectionStringOrOptions.connectionTimeout || 5000,
          idleTimeoutMillis: connectionStringOrOptions.idleTimeout || 30000,
          ssl: connectionStringOrOptions.ssl,
        };

    this.pool = new Pool(config);
    this.pool.on('error', (err) => {
      console.error('Unexpected pool error:', err);
    });
  }

  // Connection Management
  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      client.release();
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw this.handleError(error, 'Failed to connect to database');
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.connected = false;
    } catch (error) {
      throw this.handleError(error, 'Failed to disconnect from database');
    }
  }

  async testConnection(): Promise<{ connected: boolean; version?: string; error?: string }> {
    try {
      const result = await this.query('SELECT version()');
      return {
        connected: true,
        version: result.rows[0]?.version,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Extension Info
  async getExtensionInfo(): Promise<ExtensionInfo> {
    const result = await this.query(`
      SELECT
        e.extname as name,
        e.extversion as version,
        n.nspname as schema,
        c.description
      FROM pg_extension e
      JOIN pg_namespace n ON e.extnamespace = n.oid
      LEFT JOIN pg_description c ON e.oid = c.objoid
      WHERE e.extname = 'ruvector'
    `);

    if (result.rows.length === 0) {
      return {
        name: 'ruvector',
        version: 'unknown',
        installed: false,
        schema: 'public',
      };
    }

    const row = result.rows[0];
    return {
      name: row.name,
      version: row.version,
      installed: true,
      schema: row.schema,
      description: row.description,
    };
  }

  async getMemoryStats(): Promise<MemoryStats> {
    const result = await this.query(`
      SELECT
        pg_database_size(current_database()) as total_memory,
        pg_database_size(current_database()) - pg_database_size(current_database()) as used_memory,
        0 as free_memory,
        COALESCE(SUM(pg_relation_size(indexrelid)), 0) as index_memory,
        0 as cache_memory
      FROM pg_stat_user_indexes
    `);

    const row = result.rows[0];
    return {
      totalMemory: parseInt(row.total_memory) || 0,
      usedMemory: parseInt(row.used_memory) || 0,
      freeMemory: parseInt(row.free_memory) || 0,
      indexMemory: parseInt(row.index_memory) || 0,
      cacheMemory: parseInt(row.cache_memory) || 0,
    };
  }

  // Vector Index Operations
  async listIndexes(): Promise<VectorIndex[]> {
    const result = await this.query(`
      SELECT
        i.indexname as name,
        i.tablename as table_name,
        a.attname as column_name,
        am.amname as index_type,
        pg_relation_size(i.indexrelid) as size
      FROM pg_indexes i
      JOIN pg_class c ON c.relname = i.indexname
      JOIN pg_am am ON c.relam = am.oid
      JOIN pg_attribute a ON a.attrelid = (i.schemaname || '.' || i.tablename)::regclass
      WHERE i.schemaname = 'public'
        AND am.amname IN ('hnsw', 'ivfflat')
    `);

    return result.rows.map(row => ({
      name: row.name,
      tableName: row.table_name,
      columnName: row.column_name,
      indexType: row.index_type as 'hnsw' | 'ivfflat',
      dimension: 0, // Would need to parse from column type
      metric: 'l2' as const,
      size: parseInt(row.size) || 0,
      createdAt: new Date(),
    }));
  }

  async createHNSWIndex(table: string, column: string, config: HNSWConfig = {}): Promise<void> {
    const {
      m = 16,
      efConstruction = 64,
      metric = 'l2',
    } = config;

    const indexName = `${table}_${column}_hnsw_idx`;
    const ops = metric === 'l2' ? 'vector_l2_ops' :
                 metric === 'cosine' ? 'vector_cosine_ops' : 'vector_ip_ops';

    await this.query(`
      CREATE INDEX ${indexName} ON ${table}
      USING hnsw (${column} ${ops})
      WITH (m = ${m}, ef_construction = ${efConstruction})
    `);
  }

  async createIVFFlatIndex(table: string, column: string, config: IVFFlatConfig = {}): Promise<void> {
    const {
      lists = 100,
      metric = 'l2',
    } = config;

    const indexName = `${table}_${column}_ivfflat_idx`;
    const ops = metric === 'l2' ? 'vector_l2_ops' :
                 metric === 'cosine' ? 'vector_cosine_ops' : 'vector_ip_ops';

    await this.query(`
      CREATE INDEX ${indexName} ON ${table}
      USING ivfflat (${column} ${ops})
      WITH (lists = ${lists})
    `);
  }

  async dropIndex(name: string): Promise<void> {
    await this.query(`DROP INDEX IF EXISTS ${name}`);
  }

  async getIndexStats(name: string): Promise<IndexStats> {
    const result = await this.query(`
      SELECT
        indexrelname as name,
        pg_relation_size(indexrelid) as size,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch,
        last_idx_scan,
        last_vacuum,
        last_analyze
      FROM pg_stat_user_indexes
      WHERE indexrelname = $1
    `, [name]);

    if (result.rows.length === 0) {
      throw new Error(`Index ${name} not found`);
    }

    const row = result.rows[0];
    return {
      name: row.name,
      size: parseInt(row.size) || 0,
      tuples: parseInt(row.idx_tup_read) || 0,
      pages: 0,
      avgTupleSize: 0,
      fragmentation: 0,
      lastVacuum: row.last_vacuum ? new Date(row.last_vacuum) : undefined,
      lastAnalyze: row.last_analyze ? new Date(row.last_analyze) : undefined,
    };
  }

  async rebuildIndex(name: string): Promise<void> {
    await this.query(`REINDEX INDEX ${name}`);
  }

  // Vector Operations
  async vectorSearch(
    table: string,
    query: number[],
    topK: number = 10,
    metric: string = 'l2'
  ): Promise<SearchResult[]> {
    const operator = metric === 'l2' ? '<->' :
                     metric === 'cosine' ? '<=>' : '<#>';

    const result = await this.query(`
      SELECT *, embedding ${operator} $1::vector as distance
      FROM ${table}
      ORDER BY distance
      LIMIT $2
    `, [`[${query.join(',')}]`, topK]);

    return result.rows.map(row => ({
      id: row.id,
      distance: parseFloat(row.distance),
      data: row,
    }));
  }

  async computeDistance(a: number[], b: number[], metric: string): Promise<number> {
    const operator = metric === 'l2' ? '<->' :
                     metric === 'cosine' ? '<=>' : '<#>';

    const result = await this.query(`
      SELECT $1::vector ${operator} $2::vector as distance
    `, [`[${a.join(',')}]`, `[${b.join(',')}]`]);

    return parseFloat(result.rows[0].distance);
  }

  async normalizeVector(vector: number[]): Promise<number[]> {
    const result = await this.query(`
      SELECT vector_normalize($1::vector) as normalized
    `, [`[${vector.join(',')}]`]);

    const normalized = result.rows[0].normalized;
    return normalized.replace(/[[\]]/g, '').split(',').map(Number);
  }

  // Attention Operations
  async listAttentionTypes(): Promise<AttentionType[]> {
    return [
      {
        name: 'scaled_dot_product',
        description: 'Standard scaled dot-product attention',
        supportsMultiHead: true,
        requiresConfig: false,
      },
      {
        name: 'multi_head',
        description: 'Multi-head attention mechanism',
        supportsMultiHead: true,
        requiresConfig: true,
      },
    ];
  }

  async computeAttention(
    type: string,
    query: number[][],
    keys: number[][],
    values: number[][]
  ): Promise<number[][]> {
    const result = await this.query(`
      SELECT ruvector_attention($1, $2::vector[], $3::vector[], $4::vector[]) as output
    `, [
      type,
      query.map(v => `[${v.join(',')}]`),
      keys.map(v => `[${v.join(',')}]`),
      values.map(v => `[${v.join(',')}]`),
    ]);

    return result.rows[0].output;
  }

  // GNN Operations
  async createGNNLayer(name: string, type: string, config: GNNConfig): Promise<void> {
    await this.query(`
      SELECT ruvector_gnn_create_layer($1, $2, $3)
    `, [name, type, JSON.stringify(config)]);
  }

  async listGNNLayers(): Promise<GNNLayer[]> {
    const result = await this.query(`
      SELECT * FROM ruvector_gnn_layers
    `);

    return result.rows.map(row => ({
      name: row.name,
      type: row.type,
      inputDim: row.input_dim,
      outputDim: row.output_dim,
      config: JSON.parse(row.config),
      createdAt: new Date(row.created_at),
    }));
  }

  async forwardGNN(
    layer: string,
    features: number[][],
    edges: [number, number][]
  ): Promise<number[][]> {
    const result = await this.query(`
      SELECT ruvector_gnn_forward($1, $2::vector[], $3::int[][]) as output
    `, [
      layer,
      features.map(v => `[${v.join(',')}]`),
      edges,
    ]);

    return result.rows[0].output;
  }

  // Hyperbolic Operations
  async poincareDistance(a: number[], b: number[], curvature: number = 1.0): Promise<number> {
    const result = await this.query(`
      SELECT ruvector_poincare_distance($1::vector, $2::vector, $3) as distance
    `, [`[${a.join(',')}]`, `[${b.join(',')}]`, curvature]);

    return parseFloat(result.rows[0].distance);
  }

  async lorentzDistance(a: number[], b: number[], curvature: number = 1.0): Promise<number> {
    const result = await this.query(`
      SELECT ruvector_lorentz_distance($1::vector, $2::vector, $3) as distance
    `, [`[${a.join(',')}]`, `[${b.join(',')}]`, curvature]);

    return parseFloat(result.rows[0].distance);
  }

  async mobiusAdd(a: number[], b: number[], curvature: number = 1.0): Promise<number[]> {
    const result = await this.query(`
      SELECT ruvector_mobius_add($1::vector, $2::vector, $3) as result
    `, [`[${a.join(',')}]`, `[${b.join(',')}]`, curvature]);

    const vec = result.rows[0].result;
    return vec.replace(/[[\]]/g, '').split(',').map(Number);
  }

  async expMap(base: number[], tangent: number[], curvature: number = 1.0): Promise<number[]> {
    const result = await this.query(`
      SELECT ruvector_exp_map($1::vector, $2::vector, $3) as result
    `, [`[${base.join(',')}]`, `[${tangent.join(',')}]`, curvature]);

    const vec = result.rows[0].result;
    return vec.replace(/[[\]]/g, '').split(',').map(Number);
  }

  async logMap(base: number[], target: number[], curvature: number = 1.0): Promise<number[]> {
    const result = await this.query(`
      SELECT ruvector_log_map($1::vector, $2::vector, $3) as result
    `, [`[${base.join(',')}]`, `[${target.join(',')}]`, curvature]);

    const vec = result.rows[0].result;
    return vec.replace(/[[\]]/g, '').split(',').map(Number);
  }

  async poincareToLorentz(vector: number[], curvature: number = 1.0): Promise<number[]> {
    const result = await this.query(`
      SELECT ruvector_poincare_to_lorentz($1::vector, $2) as result
    `, [`[${vector.join(',')}]`, curvature]);

    const vec = result.rows[0].result;
    return vec.replace(/[[\]]/g, '').split(',').map(Number);
  }

  async lorentzToPoincare(vector: number[], curvature: number = 1.0): Promise<number[]> {
    const result = await this.query(`
      SELECT ruvector_lorentz_to_poincare($1::vector, $2) as result
    `, [`[${vector.join(',')}]`, curvature]);

    const vec = result.rows[0].result;
    return vec.replace(/[[\]]/g, '').split(',').map(Number);
  }

  // Learning Operations
  async enableLearning(table: string, config: LearningConfig): Promise<void> {
    await this.query(`
      SELECT ruvector_enable_learning($1, $2)
    `, [table, JSON.stringify(config)]);
  }

  async disableLearning(table: string): Promise<void> {
    await this.query(`
      SELECT ruvector_disable_learning($1)
    `, [table]);
  }

  async getLearningStats(table: string): Promise<LearningStats> {
    const result = await this.query(`
      SELECT * FROM ruvector_learning_stats WHERE table_name = $1
    `, [table]);

    if (result.rows.length === 0) {
      throw new Error(`No learning stats found for table ${table}`);
    }

    const row = result.rows[0];
    return {
      tableName: row.table_name,
      totalQueries: parseInt(row.total_queries) || 0,
      totalSamples: parseInt(row.total_samples) || 0,
      avgLatency: parseFloat(row.avg_latency) || 0,
      accuracy: parseFloat(row.accuracy) || 0,
      lastUpdate: new Date(row.last_update),
      patternsFound: parseInt(row.patterns_found) || 0,
    };
  }

  async extractPatterns(table: string, clusters: number): Promise<string> {
    const result = await this.query(`
      SELECT ruvector_extract_patterns($1, $2) as patterns
    `, [table, clusters]);

    return result.rows[0].patterns;
  }

  async autoTune(table: string, target: 'speed' | 'accuracy' | 'balanced'): Promise<TuneResult> {
    const result = await this.query(`
      SELECT * FROM ruvector_auto_tune($1, $2)
    `, [table, target]);

    const row = result.rows[0];
    return {
      previousParams: JSON.parse(row.previous_params),
      newParams: JSON.parse(row.new_params),
      improvement: parseFloat(row.improvement),
      estimatedSpeedup: parseFloat(row.estimated_speedup),
    };
  }

  async getSearchParams(table: string, query: number[]): Promise<SearchParams> {
    const result = await this.query(`
      SELECT * FROM ruvector_get_search_params($1, $2::vector)
    `, [table, `[${query.join(',')}]`]);

    return result.rows[0];
  }

  async clearLearning(table: string): Promise<void> {
    await this.query(`
      SELECT ruvector_clear_learning($1)
    `, [table]);
  }

  // Agent Routing Operations
  async registerAgent(config: AgentConfig): Promise<void> {
    await this.query(`
      INSERT INTO ruvector_agents (name, capabilities, embedding, metadata, max_concurrent, priority)
      VALUES ($1, $2, $3::vector, $4, $5, $6)
      ON CONFLICT (name) DO UPDATE SET
        capabilities = EXCLUDED.capabilities,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        max_concurrent = EXCLUDED.max_concurrent,
        priority = EXCLUDED.priority
    `, [
      config.name,
      config.capabilities,
      `[${config.embedding.join(',')}]`,
      JSON.stringify(config.metadata || {}),
      config.maxConcurrent || 10,
      config.priority || 1,
    ]);
  }

  async updateAgentMetrics(name: string, metrics: AgentMetrics): Promise<void> {
    await this.query(`
      UPDATE ruvector_agents
      SET
        total_requests = COALESCE($2, total_requests),
        success_rate = COALESCE($3, success_rate),
        avg_response_time = COALESCE($4, avg_response_time),
        error_count = COALESCE($5, error_count),
        last_request_time = COALESCE($6, last_request_time),
        load = COALESCE($7, load),
        last_seen = NOW()
      WHERE name = $1
    `, [
      name,
      metrics.totalRequests,
      metrics.successRate,
      metrics.avgResponseTime,
      metrics.errorCount,
      metrics.lastRequestTime,
      metrics.load,
    ]);
  }

  async removeAgent(name: string): Promise<void> {
    await this.query(`
      DELETE FROM ruvector_agents WHERE name = $1
    `, [name]);
  }

  async setAgentActive(name: string, active: boolean): Promise<void> {
    await this.query(`
      UPDATE ruvector_agents SET active = $2 WHERE name = $1
    `, [name, active]);
  }

  async listAgents(): Promise<Agent[]> {
    const result = await this.query(`
      SELECT * FROM ruvector_agents ORDER BY name
    `);

    return result.rows.map(row => this.parseAgent(row));
  }

  async getAgent(name: string): Promise<Agent> {
    const result = await this.query(`
      SELECT * FROM ruvector_agents WHERE name = $1
    `, [name]);

    if (result.rows.length === 0) {
      throw new Error(`Agent ${name} not found`);
    }

    return this.parseAgent(result.rows[0]);
  }

  async routeRequest(embedding: number[], options: RoutingOptions = {}): Promise<RoutingDecision> {
    const {
      topK = 5,
      minSimilarity = 0.0,
      requireCapability,
      excludeAgents = [],
      loadBalancing = 'similarity',
    } = options;

    const result = await this.query(`
      SELECT * FROM ruvector_route_request(
        $1::vector, $2, $3, $4, $5, $6
      )
    `, [
      `[${embedding.join(',')}]`,
      topK,
      minSimilarity,
      requireCapability,
      excludeAgents,
      loadBalancing,
    ]);

    const row = result.rows[0];
    return {
      agent: this.parseAgent(row.agent),
      similarity: parseFloat(row.similarity),
      reason: row.reason,
      alternatives: row.alternatives.map((alt: any) => ({
        agent: this.parseAgent(alt.agent),
        similarity: parseFloat(alt.similarity),
      })),
    };
  }

  async findAgentsByCapability(capability: string, limit: number = 10): Promise<Agent[]> {
    const result = await this.query(`
      SELECT * FROM ruvector_agents
      WHERE $1 = ANY(capabilities)
      ORDER BY priority DESC, success_rate DESC
      LIMIT $2
    `, [capability, limit]);

    return result.rows.map(row => this.parseAgent(row));
  }

  async getRoutingStats(): Promise<RoutingStats> {
    const result = await this.query(`
      SELECT * FROM ruvector_routing_stats
    `);

    const row = result.rows[0];
    return {
      totalRoutes: parseInt(row.total_routes) || 0,
      avgResponseTime: parseFloat(row.avg_response_time) || 0,
      successRate: parseFloat(row.success_rate) || 0,
      topAgents: JSON.parse(row.top_agents || '[]'),
      capabilityDistribution: JSON.parse(row.capability_distribution || '{}'),
    };
  }

  async clearAgents(): Promise<void> {
    await this.query(`DELETE FROM ruvector_agents`);
  }

  // Sparse Vector Operations
  async createSparseVector(indices: number[], values: number[], dim: number): Promise<string> {
    const result = await this.query(`
      SELECT ruvector_sparse_vector($1::int[], $2::float[], $3) as sparse
    `, [indices, values, dim]);

    return result.rows[0].sparse;
  }

  async sparseDistance(a: string, b: string, metric: string): Promise<number> {
    const result = await this.query(`
      SELECT ruvector_sparse_distance($1, $2, $3) as distance
    `, [a, b, metric]);

    return parseFloat(result.rows[0].distance);
  }

  async bm25Score(
    query: string,
    doc: string,
    docLen: number,
    avgDocLen: number,
    k1: number = 1.2,
    b: number = 0.75
  ): Promise<number> {
    const result = await this.query(`
      SELECT ruvector_bm25($1, $2, $3, $4, $5, $6) as score
    `, [query, doc, docLen, avgDocLen, k1, b]);

    return parseFloat(result.rows[0].score);
  }

  // Quantization
  async binaryQuantize(vector: number[]): Promise<Uint8Array> {
    const result = await this.query(`
      SELECT ruvector_binary_quantize($1::vector) as quantized
    `, [`[${vector.join(',')}]`]);

    return new Uint8Array(result.rows[0].quantized);
  }

  async scalarQuantize(vector: number[]): Promise<number[]> {
    const result = await this.query(`
      SELECT ruvector_scalar_quantize($1::vector) as quantized
    `, [`[${vector.join(',')}]`]);

    const quantized = result.rows[0].quantized;
    return quantized.replace(/[[\]]/g, '').split(',').map(Number);
  }

  // Database Operations
  async listTables(): Promise<TableInfo[]> {
    const result = await this.query(`
      SELECT
        schemaname as schema,
        tablename as name,
        pg_relation_size(schemaname || '.' || tablename) as size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    return result.rows.map(row => ({
      schema: row.schema,
      name: row.name,
      rowCount: 0, // Would need separate query
      size: this.formatBytes(parseInt(row.size) || 0),
      hasVectorColumns: false, // Would need to check columns
    }));
  }

  async getTableSchema(table: string): Promise<ColumnInfo[]> {
    const result = await this.query(`
      SELECT
        column_name as name,
        data_type as type,
        is_nullable = 'YES' as nullable,
        column_default as default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    return result.rows.map(row => ({
      name: row.name,
      type: row.type,
      nullable: row.nullable,
      default: row.default,
      isVector: row.type.includes('vector'),
      dimension: row.type.includes('vector') ? this.parseDimension(row.type) : undefined,
    }));
  }

  async executeSQL(sql: string): Promise<QueryResult> {
    const result = await this.query(sql);
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
      fields: result.fields.map(f => ({
        name: f.name,
        dataTypeID: f.dataTypeID,
      })),
      command: result.command,
    };
  }

  // Helper Methods
  private async query(text: string, params?: any[]): Promise<PgQueryResult> {
    try {
      return await this.pool.query(text, params);
    } catch (error) {
      throw this.handleError(error, `Query failed: ${text}`);
    }
  }

  private handleError(error: unknown, context: string): RuVectorError {
    if (error instanceof Error) {
      const pgError = error as any;
      return {
        message: `${context}: ${error.message}`,
        code: pgError.code,
        detail: pgError.detail,
        hint: pgError.hint,
      };
    }
    return {
      message: `${context}: ${String(error)}`,
    };
  }

  private parseAgent(row: any): Agent {
    const embedding = row.embedding.replace(/[[\]]/g, '').split(',').map(Number);

    return {
      name: row.name,
      capabilities: row.capabilities,
      embedding,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      metrics: {
        totalRequests: parseInt(row.total_requests) || 0,
        successRate: parseFloat(row.success_rate) || 0,
        avgResponseTime: parseFloat(row.avg_response_time) || 0,
        errorCount: parseInt(row.error_count) || 0,
        lastRequestTime: row.last_request_time ? new Date(row.last_request_time) : undefined,
        load: parseFloat(row.load) || 0,
      },
      active: row.active,
      createdAt: new Date(row.created_at),
      lastSeen: new Date(row.last_seen),
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  private parseDimension(type: string): number | undefined {
    const match = type.match(/vector\((\d+)\)/);
    return match ? parseInt(match[1]) : undefined;
  }
}

// Export types for convenience
export type * from '../../types/ruvector';
