import React from 'react';
import { Card } from '../../ui/Card';
import { TrajectoryStatistics } from './types';

interface TrajectoryStatsProps {
  stats: TrajectoryStatistics;
}

export const TrajectoryStats: React.FC<TrajectoryStatsProps> = ({ stats }) => {
  const feedbackPercentage = stats.total > 0
    ? (stats.withFeedback / stats.total) * 100
    : 0;

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Trajectory Statistics
        </h3>

        <div className="space-y-4">
          {/* Total Trajectories */}
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Total Trajectories</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.total.toLocaleString()}
            </span>
          </div>

          {/* With Feedback */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600 dark:text-gray-400">With Feedback</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {stats.withFeedback.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${feedbackPercentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {feedbackPercentage.toFixed(1)}% of trajectories have feedback
            </p>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Precision</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {(stats.avgPrecision * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Recall</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {(stats.avgRecall * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Latency</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {stats.avgLatency.toFixed(1)}ms
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
