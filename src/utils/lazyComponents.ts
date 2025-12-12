// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Lazy Loading Utilities for AnkhWaveStudio Web
 * Provides lazy loading with preloading capabilities for heavy components
 */

import React, { lazy, Suspense, ComponentType, ReactNode, useEffect, useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface LazyComponentOptions {
  /** Fallback component to show while loading */
  fallback?: ReactNode;
  /** Preload on hover delay in ms (0 = immediate) */
  preloadDelay?: number;
  /** Retry count on failure */
  retryCount?: number;
  /** Retry delay in ms */
  retryDelay?: number;
}

interface PreloadableComponent<T extends ComponentType<any>> {
  Component: React.LazyExoticComponent<T>;
  preload: () => Promise<{ default: T }>;
}

// ============================================================================
// Loading Fallbacks
// ============================================================================

/**
 * Default loading spinner component
 */
export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; message?: string }> = ({ 
  size = 'md', 
  message 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return React.createElement('div', {
    className: 'flex flex-col items-center justify-center p-4',
  }, [
    React.createElement('div', {
      key: 'spinner',
      className: `animate-spin rounded-full border-2 border-daw-border border-t-daw-accent-primary ${sizeClasses[size]}`,
    }),
    message && React.createElement('p', {
      key: 'message',
      className: 'mt-2 text-sm text-daw-text-muted',
    }, message),
  ]);
};

/**
 * Editor-specific loading fallback
 */
export const EditorLoadingFallback: React.FC<{ name: string }> = ({ name }) => {
  return React.createElement('div', {
    className: 'flex items-center justify-center h-full bg-daw-bg-secondary',
  }, React.createElement(LoadingSpinner, {
    size: 'lg',
    message: `Loading ${name}...`,
  }));
};

/**
 * Panel loading fallback
 */
export const PanelLoadingFallback: React.FC = () => {
  return React.createElement('div', {
    className: 'flex items-center justify-center h-full min-h-[200px] bg-daw-bg-tertiary',
  }, React.createElement(LoadingSpinner, {
    size: 'md',
  }));
};

// ============================================================================
// Lazy Loading Utilities
// ============================================================================

/**
 * Create a lazy component with retry logic
 */
function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retryCount = 3,
  retryDelay = 1000
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: Error | null = null;
    
    for (let i = 0; i < retryCount; i++) {
      try {
        return await importFn();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Failed to load component (attempt ${i + 1}/${retryCount}):`, error);
        
        if (i < retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    throw lastError;
  });
}

/**
 * Create a preloadable lazy component
 */
function createPreloadableComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyComponentOptions = {}
): PreloadableComponent<T> {
  const { retryCount = 3, retryDelay = 1000 } = options;
  
  let modulePromise: Promise<{ default: T }> | null = null;
  
  const preload = () => {
    if (!modulePromise) {
      modulePromise = importFn();
    }
    return modulePromise;
  };
  
  const Component = lazyWithRetry(() => preload(), retryCount, retryDelay);
  
  return { Component, preload };
}

// ============================================================================
// Lazy Editor Components
// ============================================================================

/**
 * Lazy-loaded Piano Roll editor
 */
export const LazyPianoRoll = createPreloadableComponent(
  () => import('../components/editors/PianoRoll').then(m => ({ default: m.PianoRoll }))
);

/**
 * Lazy-loaded Song Editor
 */
export const LazySongEditor = createPreloadableComponent(
  () => import('../components/editors/SongEditor').then(m => ({ default: m.SongEditor }))
);

/**
 * Lazy-loaded Pattern Editor
 */
export const LazyPatternEditor = createPreloadableComponent(
  () => import('../components/editors/PatternEditor').then(m => ({ default: m.PatternEditor }))
);

/**
 * Lazy-loaded Automation Editor
 */
export const LazyAutomationEditor = createPreloadableComponent(
  () => import('../components/editors/AutomationEditor').then(m => ({ default: m.AutomationEditor }))
);

/**
 * Lazy-loaded Mixer View
 */
export const LazyMixerView = createPreloadableComponent(
  () => import('../components/mixer/MixerView').then(m => ({ default: m.MixerView }))
);

/**
 * Lazy-loaded Instrument Rack
 */
export const LazyInstrumentRack = createPreloadableComponent(
  () => import('../components/instruments/InstrumentRack').then(m => ({ default: m.InstrumentRack }))
);

/**
 * Lazy-loaded Triple Oscillator
 */
export const LazyTripleOscillator = createPreloadableComponent(
  () => import('../components/instruments/TripleOscillator').then(m => ({ default: m.TripleOscillator }))
);

/**
 * Lazy-loaded Sample Player
 */
export const LazySamplePlayer = createPreloadableComponent(
  () => import('../components/instruments/SamplePlayer').then(m => ({ default: m.SamplePlayer }))
);

// ============================================================================
// Preloading Hooks
// ============================================================================

/**
 * Hook to preload a component on hover
 */
export function usePreloadOnHover(preloadFn: () => Promise<any>, delay = 200) {
  const [isHovering, setIsHovering] = useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
    timeoutRef.current = setTimeout(() => {
      preloadFn();
    }, delay);
  }, [preloadFn, delay]);
  
  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return {
    isHovering,
    hoverProps: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
  };
}

/**
 * Hook to preload components based on route/view
 */
export function usePreloadEditors(currentEditor: string) {
  useEffect(() => {
    // Preload adjacent editors based on current view
    const preloadMap: Record<string, (() => Promise<any>)[]> = {
      'song': [LazyPianoRoll.preload, LazyPatternEditor.preload],
      'piano-roll': [LazySongEditor.preload, LazyAutomationEditor.preload],
      'pattern': [LazySongEditor.preload, LazyPianoRoll.preload],
      'automation': [LazyPianoRoll.preload, LazySongEditor.preload],
    };
    
    const toPreload = preloadMap[currentEditor] || [];
    
    // Preload after a short delay to not block current render
    const timeout = setTimeout(() => {
      toPreload.forEach(preload => preload());
    }, 1000);
    
    return () => clearTimeout(timeout);
  }, [currentEditor]);
}

/**
 * Preload all critical components on app start
 */
export function preloadCriticalComponents() {
  // Preload editors after initial render
  setTimeout(() => {
    LazySongEditor.preload();
    LazyMixerView.preload();
  }, 2000);
  
  // Preload remaining editors after a longer delay
  setTimeout(() => {
    LazyPianoRoll.preload();
    LazyPatternEditor.preload();
    LazyAutomationEditor.preload();
    LazyInstrumentRack.preload();
  }, 5000);
}

// ============================================================================
// Error Boundary for Lazy Components
// ============================================================================

interface LazyErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface LazyErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

/**
 * Error boundary specifically for lazy-loaded components
 */
export class LazyErrorBoundary extends React.Component<
  LazyErrorBoundaryProps,
  LazyErrorBoundaryState
> {
  constructor(props: LazyErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): LazyErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy component failed to load:', error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return React.createElement('div', {
        className: 'flex flex-col items-center justify-center h-full p-4 bg-daw-bg-secondary',
      }, [
        React.createElement('div', {
          key: 'icon',
          className: 'text-4xl mb-4',
        }, '⚠️'),
        React.createElement('h3', {
          key: 'title',
          className: 'text-lg font-semibold text-daw-text-primary mb-2',
        }, 'Failed to load component'),
        React.createElement('p', {
          key: 'message',
          className: 'text-sm text-daw-text-muted mb-4',
        }, this.state.error?.message || 'An unexpected error occurred'),
        React.createElement('button', {
          key: 'retry',
          className: 'px-4 py-2 bg-daw-accent-primary text-white rounded hover:bg-blue-600 transition-colors',
          onClick: () => {
            this.setState({ hasError: false, error: null });
            window.location.reload();
          },
        }, 'Retry'),
      ]);
    }

    return this.props.children;
  }
}

// ============================================================================
// Wrapper Component for Lazy Loading
// ============================================================================

interface LazyWrapperProps {
  component: React.LazyExoticComponent<ComponentType<any>>;
  fallback?: ReactNode;
  componentProps?: Record<string, any>;
}

/**
 * Wrapper component that handles Suspense and error boundary
 */
export const LazyWrapper: React.FC<LazyWrapperProps> = ({
  component: LazyComponent,
  fallback = React.createElement(LoadingSpinner, {}),
  componentProps = {},
}) => {
  const suspenseElement = React.createElement(Suspense, { fallback },
    React.createElement(LazyComponent, componentProps)
  );
  return React.createElement(LazyErrorBoundary, { children: suspenseElement });
};

// ============================================================================
// Export all lazy components for easy access
// ============================================================================

export const LazyComponents = {
  PianoRoll: LazyPianoRoll,
  SongEditor: LazySongEditor,
  PatternEditor: LazyPatternEditor,
  AutomationEditor: LazyAutomationEditor,
  MixerView: LazyMixerView,
  InstrumentRack: LazyInstrumentRack,
  TripleOscillator: LazyTripleOscillator,
  SamplePlayer: LazySamplePlayer,
};

export default LazyComponents;