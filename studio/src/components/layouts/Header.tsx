import React, { useState } from 'react';
import {
  Menu,
  Sun,
  Moon,
  Settings,
  ChevronDown,
  Wifi,
  WifiOff
} from 'lucide-react';
import Badge from '../ui/Badge';
import Select from '../ui/Select';

interface HeaderProps {
  onToggleSidebar: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, theme, onToggleTheme }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [selectedDatabase, setSelectedDatabase] = useState('ruvector_dev');

  const databases = [
    { value: 'ruvector_dev', label: 'ruvector_dev' },
    { value: 'ruvector_prod', label: 'ruvector_prod' },
    { value: 'ruvector_test', label: 'ruvector_test' },
  ];

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          {/* Mobile Menu Button */}
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <>
                <Wifi className="w-5 h-5 text-green-500" />
                <Badge variant="success">Connected</Badge>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5 text-red-500" />
                <Badge variant="error">Disconnected</Badge>
              </>
            )}
          </div>

          {/* Database Selector */}
          <div className="hidden md:block">
            <div className="relative">
              <button className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600">
                <span className="text-sm font-medium">{selectedDatabase}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-2">
          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

          {/* Settings */}
          <button
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
