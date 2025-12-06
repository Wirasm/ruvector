import { useQuery } from '@tanstack/react-query';
import Head from 'next/head';
import Link from 'next/link';
import {
  Database,
  Network,
  Brain,
  Users,
  Activity,
  Table,
  ArrowRight,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface DashboardStats {
  totalTables: number;
  totalVectorIndexes: number;
  learningEnabledTables: number;
  registeredAgents: number;
  connectionStatus: 'connected' | 'disconnected' | 'error';
}

interface RecentActivity {
  id: string;
  type: 'query' | 'index' | 'learning' | 'agent';
  description: string;
  timestamp: string;
  status: 'success' | 'error' | 'pending';
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await fetch('/api/ruvector/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<RecentActivity[]>({
    queryKey: ['recent-activities'],
    queryFn: async () => {
      const response = await fetch('/api/ruvector/activities');
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json();
    },
  });

  const quickActions = [
    { label: 'Create Table', href: '/tables?action=create', icon: Table, color: 'bg-blue-500' },
    { label: 'New Vector Index', href: '/vector-indexes?action=create', icon: Network, color: 'bg-purple-500' },
    { label: 'SQL Editor', href: '/sql-editor', icon: Database, color: 'bg-green-500' },
    { label: 'Run Benchmark', href: '/benchmarks', icon: Activity, color: 'bg-orange-500' },
  ];

  const statCards = [
    {
      label: 'Total Tables',
      value: stats?.totalTables ?? 0,
      icon: Table,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Vector Indexes',
      value: stats?.totalVectorIndexes ?? 0,
      icon: Network,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Learning Tables',
      value: stats?.learningEnabledTables ?? 0,
      icon: Brain,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Agents',
      value: stats?.registeredAgents ?? 0,
      icon: Users,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  const getConnectionStatusIcon = () => {
    switch (stats?.connectionStatus) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'disconnected':
        return <XCircle className="w-5 h-5 text-gray-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getActivityIcon = (activity: RecentActivity) => {
    const iconClass = "w-4 h-4";
    switch (activity.type) {
      case 'query': return <Database className={iconClass} />;
      case 'index': return <Network className={iconClass} />;
      case 'learning': return <Brain className={iconClass} />;
      case 'agent': return <Users className={iconClass} />;
    }
  };

  const getActivityStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-500';
      case 'error': return 'text-red-500';
      case 'pending': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <>
      <Head>
        <title>Dashboard - RuVector Studio</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Welcome to RuVector Studio
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Advanced PostgreSQL Vector Database Management
            </p>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            {getConnectionStatusIcon()}
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {stats?.connectionStatus === 'connected' ? 'Connected' :
               stats?.connectionStatus === 'error' ? 'Connection Error' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                      {statsLoading ? '...' : stat.value.toLocaleString()}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors group"
                >
                  <div className={`p-2 rounded-lg ${action.color}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {action.label}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h2>

          {activitiesLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading activities...
            </div>
          ) : !activities || activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No recent activity
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                    {getActivityIcon(activity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className={`text-xs font-medium ${getActivityStatusColor(activity.status)}`}>
                    {activity.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
