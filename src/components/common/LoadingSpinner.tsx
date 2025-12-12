// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * LoadingSpinner - Reusable loading indicator component
 */

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'white';
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-3',
  xl: 'h-16 w-16 border-4',
};

const colorClasses = {
  primary: 'border-daw-accent-primary',
  secondary: 'border-daw-text-secondary',
  white: 'border-white',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className = '',
}) => {
  return (
    <div
      className={`animate-spin rounded-full border-t-transparent ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

interface LoadingOverlayProps {
  message?: string;
  progress?: number;
  subMessage?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = 'Loading...',
  progress,
  subMessage,
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-daw-bg-elevated p-8 rounded-lg shadow-xl text-center max-w-sm">
        <LoadingSpinner size="lg" className="mx-auto mb-4" />
        <p className="text-daw-text-primary font-medium">{message}</p>
        {progress !== undefined && (
          <div className="mt-4">
            <div className="w-full bg-daw-bg-surface rounded-full h-2 overflow-hidden">
              <div
                className="bg-daw-accent-primary h-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <p className="text-daw-text-muted text-sm mt-2">{Math.round(progress)}%</p>
          </div>
        )}
        {subMessage && (
          <p className="text-daw-text-muted text-sm mt-2">{subMessage}</p>
        )}
      </div>
    </div>
  );
};

interface LoadingCardProps {
  message?: string;
  className?: string;
}

export const LoadingCard: React.FC<LoadingCardProps> = ({
  message = 'Loading...',
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <LoadingSpinner size="lg" className="mb-4" />
      <p className="text-daw-text-secondary">{message}</p>
    </div>
  );
};

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
}) => {
  const baseClasses = 'animate-pulse bg-daw-bg-surface';
  const variantClasses = {
    text: 'rounded',
    rectangular: 'rounded',
    circular: 'rounded-full',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
};

export default LoadingSpinner;