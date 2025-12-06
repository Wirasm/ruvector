import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: 'primary' | 'white' | 'gray';
}

const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className = '',
  color = 'primary',
}) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const colors = {
    primary: 'border-purple-600 dark:border-purple-400',
    white: 'border-white',
    gray: 'border-gray-600 dark:border-gray-400',
  };

  return (
    <div className={`inline-block ${className}`}>
      <div
        className={`
          ${sizes[size]}
          border-4 border-t-transparent
          ${colors[color]}
          rounded-full
          animate-spin
        `}
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
};

export default Spinner;
