// TypeScript interfaces for Learning Panel

export interface LearningStatus {
  tableName: string;
  enabled: boolean;
  trajectoryCount: number;
  maxTrajectories: number;
  patternsExtracted: number;
  lastUpdate: Date;
}

export interface PerformanceMetric {
  timestamp: Date;
  recall10: number;
  avgLatency: number;
  precision: number;
}

export interface TrajectoryStatistics {
  total: number;
  withFeedback: number;
  avgPrecision: number;
  avgRecall: number;
  avgLatency: number;
}

export interface PatternStatistics {
  numClusters: number;
  avgConfidence: number;
  totalSamples: number;
  usageCount: number;
}

export interface LearningConfig {
  tableName: string;
  enabled: boolean;
  maxTrajectories: number;
  numClusters: number;
}

export interface AutoTuneRecommendation {
  target: 'speed' | 'accuracy' | 'balanced';
  currentParams: {
    efConstruction?: number;
    efSearch?: number;
    m?: number;
    numClusters?: number;
  };
  recommendedParams: {
    efConstruction?: number;
    efSearch?: number;
    m?: number;
    numClusters?: number;
  };
  expectedImprovement: {
    recall?: number;
    latency?: number;
  };
  confidence: number;
}

export type TimeRange = 'day' | 'week' | 'month';
