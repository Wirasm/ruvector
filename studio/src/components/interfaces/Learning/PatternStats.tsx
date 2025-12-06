import React from 'react';
import { Card } from '../../ui/Card';
import { PatternStatistics } from './types';

interface PatternStatsProps {
  stats: PatternStatistics;
}

export const PatternStats: React.FC<PatternStatsProps> = ({ stats }) => {
  const avgSamplesPerCluster = stats.numClusters > 0
    ? stats.totalSamples / stats.numClusters
    : 0;

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Pattern Statistics
        </h3>

        <div className="space-y-4">
          {/* Clusters */}
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Number of Clusters</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.numClusters}
            </span>
          </div>

          {/* Confidence */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600 dark:text-gray-400">Average Confidence</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {(stats.avgConfidence * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${stats.avgConfidence * 100}%` }}
              />
            </div>
          </div>

          {/* Samples and Usage */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Samples</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {stats.totalSamples.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Usage Count</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {stats.usageCount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Additional Metric */}
          <div className="pt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Avg Samples per Cluster
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {avgSamplesPerCluster.toFixed(1)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};
