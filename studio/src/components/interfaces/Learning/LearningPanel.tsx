import React, { useState, useEffect } from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { LearningStatusCard } from './LearningStatusCard';
import { PerformanceCharts } from './PerformanceCharts';
import { TrajectoryStats } from './TrajectoryStats';
import { PatternStats } from './PatternStats';
import { LearningConfigForm } from './LearningConfigForm';
import { AutoTunePanel } from './AutoTunePanel';
import {
  LearningStatus,
  PerformanceMetric,
  TrajectoryStatistics,
  PatternStatistics,
  TimeRange
} from './types';

export const LearningPanel: React.FC = () => {
  const [learningStatuses, setLearningStatuses] = useState<LearningStatus[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [trajectoryStats, setTrajectoryStats] = useState<TrajectoryStatistics | null>(null);
  const [patternStats, setPatternStats] = useState<PatternStatistics | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [showConfig, setShowConfig] = useState(false);
  const [showAutoTune, setShowAutoTune] = useState(false);

  useEffect(() => {
    fetchLearningStatuses();
    fetchPerformanceMetrics();
    fetchTrajectoryStats();
    fetchPatternStats();
  }, [timeRange]);

  const fetchLearningStatuses = async () => {
    try {
      const response = await fetch('/api/learning/status');
      const data = await response.json();
      setLearningStatuses(data.map((item: any) => ({
        ...item,
        lastUpdate: new Date(item.lastUpdate)
      })));
    } catch (error) {
      console.error('Failed to fetch learning statuses:', error);
    }
  };

  const fetchPerformanceMetrics = async () => {
    try {
      const response = await fetch(`/api/learning/metrics?range=${timeRange}`);
      const data = await response.json();
      setPerformanceMetrics(data.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      })));
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
    }
  };

  const fetchTrajectoryStats = async () => {
    try {
      const response = await fetch('/api/learning/trajectory-stats');
      const data = await response.json();
      setTrajectoryStats(data);
    } catch (error) {
      console.error('Failed to fetch trajectory stats:', error);
    }
  };

  const fetchPatternStats = async () => {
    try {
      const response = await fetch('/api/learning/pattern-stats');
      const data = await response.json();
      setPatternStats(data);
    } catch (error) {
      console.error('Failed to fetch pattern stats:', error);
    }
  };

  const handleToggleLearning = async (tableName: string, enabled: boolean) => {
    try {
      await fetch(`/api/learning/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName, enabled })
      });
      await fetchLearningStatuses();
    } catch (error) {
      console.error('Failed to toggle learning:', error);
    }
  };

  const handleClearTrajectories = async () => {
    if (!confirm('Are you sure you want to clear all learning trajectories?')) return;

    try {
      await fetch('/api/learning/clear', { method: 'POST' });
      await fetchLearningStatuses();
      await fetchTrajectoryStats();
    } catch (error) {
      console.error('Failed to clear trajectories:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Self-Learning & Reasoning Bank
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor and optimize vector search learning
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setShowAutoTune(true)}
          >
            Auto-Tune
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowConfig(true)}
          >
            Configure
          </Button>
          <Button
            variant="danger"
            onClick={handleClearTrajectories}
          >
            Clear Trajectories
          </Button>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {trajectoryStats && <TrajectoryStats stats={trajectoryStats} />}
        {patternStats && <PatternStats stats={patternStats} />}
      </div>

      {/* Performance Charts */}
      <Card>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Performance Trends
            </h3>
            <div className="flex gap-2">
              {(['day', 'week', 'month'] as TimeRange[]).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          <PerformanceCharts metrics={performanceMetrics} />
        </div>
      </Card>

      {/* Learning Status Cards */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Table Learning Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {learningStatuses.map((status) => (
            <LearningStatusCard
              key={status.tableName}
              status={status}
              onToggle={handleToggleLearning}
              onSelect={() => setSelectedTable(status.tableName)}
              isSelected={selectedTable === status.tableName}
            />
          ))}
        </div>
      </div>

      {/* Config Modal */}
      {showConfig && (
        <LearningConfigForm
          tableName={selectedTable}
          onClose={() => setShowConfig(false)}
          onSave={() => {
            setShowConfig(false);
            fetchLearningStatuses();
          }}
        />
      )}

      {/* Auto-Tune Modal */}
      {showAutoTune && (
        <AutoTunePanel
          tableName={selectedTable}
          onClose={() => setShowAutoTune(false)}
          onApply={() => {
            setShowAutoTune(false);
            fetchLearningStatuses();
          }}
        />
      )}
    </div>
  );
};
