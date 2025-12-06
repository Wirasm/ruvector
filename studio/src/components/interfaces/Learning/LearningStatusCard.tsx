import React from 'react';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Switch } from '../../ui/Switch';
import { LearningStatus } from './types';

interface LearningStatusCardProps {
  status: LearningStatus;
  onToggle: (tableName: string, enabled: boolean) => void;
  onSelect: () => void;
  isSelected: boolean;
}

export const LearningStatusCard: React.FC<LearningStatusCardProps> = ({
  status,
  onToggle,
  onSelect,
  isSelected
}) => {
  const percentage = (status.trajectoryCount / status.maxTrajectories) * 100;

  return (
    <Card
      className={`cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
      }`}
      onClick={onSelect}
    >
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {status.tableName}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Updated {formatRelativeTime(status.lastUpdate)}
            </p>
          </div>
          <Switch
            checked={status.enabled}
            onChange={(enabled) => onToggle(status.tableName, enabled)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Status Badge */}
        <div>
          <Badge variant={status.enabled ? 'success' : 'secondary'}>
            {status.enabled ? 'Active' : 'Disabled'}
          </Badge>
        </div>

        {/* Trajectory Progress */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">Trajectories</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {status.trajectoryCount} / {status.maxTrajectories}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Patterns Count */}
        <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Patterns Extracted
          </span>
          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {status.patternsExtracted}
          </span>
        </div>
      </div>
    </Card>
  );
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
