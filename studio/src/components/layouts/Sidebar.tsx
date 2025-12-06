import React from 'react';
import {
  Home,
  Database,
  Layers,
  Brain,
  GitBranch,
  Globe,
  TrendingUp,
  Route,
  Terminal,
  Activity,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Dashboard', path: '/' },
  { icon: Database, label: 'Tables', path: '/tables' },
  { icon: Layers, label: 'Vector Indexes', path: '/indexes' },
  { icon: Brain, label: 'Attention', path: '/attention' },
  { icon: GitBranch, label: 'GNN', path: '/gnn' },
  { icon: Globe, label: 'Hyperbolic', path: '/hyperbolic' },
  { icon: TrendingUp, label: 'Learning', path: '/learning' },
  { icon: Route, label: 'Agent Routing', path: '/routing' },
  { icon: Terminal, label: 'SQL Editor', path: '/sql' },
  { icon: Activity, label: 'Benchmarks', path: '/benchmarks' },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const [activeRoute, setActiveRoute] = React.useState('/');

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          flex flex-col w-64
          bg-white dark:bg-gray-800
          border-r border-gray-200 dark:border-gray-700
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-20'}
        `}
      >
        {/* Logo Section */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            {isOpen && (
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                RuVector
              </span>
            )}
          </div>
          <button
            onClick={onToggle}
            className="hidden lg:flex p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          >
            {isOpen ? (
              <ChevronLeft className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeRoute === item.path;

              return (
                <li key={item.path}>
                  <button
                    onClick={() => setActiveRoute(item.path)}
                    className={`
                      w-full flex items-center px-3 py-2.5 rounded-lg
                      transition-colors duration-150
                      ${isActive
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isOpen ? 'mr-3' : ''}`} />
                    {isOpen && (
                      <span className="text-sm font-medium">{item.label}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className={`text-xs text-gray-500 dark:text-gray-400 ${isOpen ? '' : 'text-center'}`}>
            {isOpen ? 'v1.0.0' : 'v1.0'}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
