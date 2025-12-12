// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * AnkhWave - Main Entry Point
 * PWA initialization, service worker registration, and app bootstrap
 */

import React, { StrictMode, Suspense, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Platform optimizations
import { getKeyboardShortcuts } from './platform';

// Database
import { ProjectDB, SyncManager } from './db';

// Performance utilities
import { trackWebVitals, startPerformanceMonitoring } from './utils/performance';

// Theme Manager
import { ThemeManager } from './utils/ThemeManager';

// ============================================================================
// Loading Component
// ============================================================================

const LoadingScreen: React.FC = () => (
  <div className="fixed inset-0 bg-daw-bg-primary flex items-center justify-center">
    <div className="text-center">
      <div className="w-20 h-20 mx-auto mb-6 relative">
        {/* AnkhWave Logo */}
        <div className="absolute inset-0 bg-[#8286ef] rounded-2xl shadow-lg shadow-[#8286ef]/30">
          <svg viewBox="0 0 32 32" className="w-full h-full p-4">
            <defs>
              <linearGradient id="ankhGradientLoading" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1"/>
                <stop offset="100%" stopColor="#e0e0ff" stopOpacity="0.9"/>
              </linearGradient>
            </defs>
            <ellipse cx="16" cy="8" rx="5" ry="5" fill="none" stroke="url(#ankhGradientLoading)" strokeWidth="2.5"/>
            <line x1="16" y1="13" x2="16" y2="26" stroke="url(#ankhGradientLoading)" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M8 18 Q12 16 16 18 Q20 20 24 18" fill="none" stroke="url(#ankhGradientLoading)" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        {/* Spinning ring */}
        <div className="absolute -inset-2 border-4 border-transparent border-t-[#8286ef] rounded-full animate-spin"></div>
      </div>
      <h1 className="text-daw-text-primary text-2xl font-bold mb-1 tracking-wide">AnkhWave</h1>
      <p className="text-[#8286ef] text-xs font-medium tracking-widest uppercase mb-2">Studio</p>
      <p className="text-daw-text-secondary text-sm">Chargement…</p>
    </div>
  </div>
);

// ============================================================================
// Error Boundary
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  isOffline: boolean;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, isOffline: !navigator.onLine };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
    
    // Track error for analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: error.message,
        fatal: true,
      });
    }
  }

  componentDidMount() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  handleOnline = () => {
    this.setState({ isOffline: false });
    // Retry if error was network-related
    if (this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  };

  handleOffline = () => {
    this.setState({ isOffline: true });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-daw-bg-primary flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-daw-error/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-daw-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-daw-text-primary text-xl font-semibold mb-2">Une erreur est survenue</h1>
            <p className="text-daw-text-secondary mb-4">
              {this.state.isOffline 
                ? "Vous êtes hors ligne. Vérifiez votre connexion et réessayez."
                : "Une erreur inattendue s’est produite. Essayez de recharger la page."}
            </p>
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-daw-accent hover:bg-daw-accent-hover text-white rounded-lg font-medium transition-colors"
              >
                Recharger la page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full px-4 py-2 bg-daw-bg-elevated hover:bg-daw-bg-hover text-daw-text-primary rounded-lg font-medium transition-colors"
              >
                Réessayer
              </button>
            </div>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-daw-text-muted text-sm cursor-pointer">Détails de l’erreur</summary>
                <pre className="mt-2 p-2 bg-daw-bg-surface rounded text-xs text-daw-error overflow-auto">
                  {this.state.error.message}
                  {'\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// PWA Root Component
// ============================================================================

const PWARoot: React.FC = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize app
    initializeApp().then(() => {
      setIsReady(true);
    });
  }, []);

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <>
      <App />
    </>
  );
};

// ============================================================================
// App Initialization
// ============================================================================

async function initializeApp(): Promise<void> {
  console.log('[AnkhWave] Initializing...');

  // Initialize database
  try {
    const db = ProjectDB.getInstance();
    await db.initialize();
    console.log('[AnkhWave] Database initialized');
  } catch (error) {
    console.error('[AnkhWave] Database initialization failed:', error);
  }

  // Initialize sync manager
  try {
    const syncManager = SyncManager.getInstance();
    await syncManager.initialize({
      autoSync: true,
      syncIntervalMs: 5 * 60 * 1000, // 5 minutes
    });
    console.log('[AnkhWave] Sync manager initialized');
  } catch (error) {
    console.error('[AnkhWave] Sync manager initialization failed:', error);
  }

  // Initialize keyboard shortcuts
  const shortcuts = getKeyboardShortcuts();
  shortcuts.initialize();

  // Request persistent storage
  await requestPersistentStorage();

  // Track Web Vitals
  trackWebVitals((vitals) => {
    console.log('[Web Vitals]', vitals);
    
    // Send to analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      Object.entries(vitals).forEach(([name, value]) => {
        if (value !== null) {
          (window as any).gtag('event', name, {
            event_category: 'Web Vitals',
            value: Math.round(name === 'CLS' ? (value as number) * 1000 : (value as number)),
            non_interaction: true,
          });
        }
      });
    }
  });

  // Start performance monitoring in development
  if (import.meta.env.DEV) {
    startPerformanceMonitoring((metrics) => {
      if (metrics.fps < 30) {
        console.warn('[Performance] Low FPS:', metrics.fps);
      }
      if (metrics.longTasks > 0) {
        console.warn('[Performance] Long tasks detected:', metrics.longTasks);
      }
    }, 5000);
  }

  console.log('[AnkhWave] Initialization complete');
}

// ============================================================================
// Service Worker Registration
// ============================================================================

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service workers not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      type: 'module',
    });

    console.log('[SW] Registered:', registration.scope);

    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000); // Every hour

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[SW] Update available');
          
          // Dispatch event for UpdatePrompt component
          window.dispatchEvent(new CustomEvent('sw-update-available'));
        }
      });
    });

    // Handle controller change (after skipWaiting)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW] Controller changed');
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('[SW] Message:', event.data);
      
      if (event.data?.type === 'SYNC_COMPLETE') {
        window.dispatchEvent(new CustomEvent('sync-complete', {
          detail: event.data,
        }));
      }
    });

  } catch (error) {
    console.error('[SW] Registration failed:', error);
  }
}

// ============================================================================
// Persistent Storage Request
// ============================================================================

async function requestPersistentStorage(): Promise<void> {
  if (!('storage' in navigator && 'persist' in navigator.storage)) {
    return;
  }

  try {
    const isPersisted = await navigator.storage.persisted();
    
    if (!isPersisted) {
      const granted = await navigator.storage.persist();
      console.log('[Storage] Persistent storage:', granted ? 'granted' : 'denied');
    } else {
      console.log('[Storage] Already persisted');
    }
  } catch (error) {
    console.error('[Storage] Persistence request failed:', error);
  }
}

// ============================================================================
// Handle Launch Queue (File Handlers)
// ============================================================================

function setupLaunchQueue(): void {
  if (!('launchQueue' in window)) {
    return;
  }

  (window as any).launchQueue.setConsumer(async (params: any) => {
    if (!params.files || params.files.length === 0) {
      return;
    }

    console.log('[Launch Queue] Files received:', params.files.length);

    // Dispatch event for the app to handle
    window.dispatchEvent(new CustomEvent('files-received', {
      detail: { files: params.files },
    }));
  });
}

// ============================================================================
// Handle Share Target
// ============================================================================

function handleShareTarget(): void {
  const url = new URL(window.location.href);
  
  if (url.searchParams.get('share') === 'pending') {
    console.log('[Share Target] Processing shared files');
    
    // Dispatch event for the app to handle
    window.dispatchEvent(new CustomEvent('share-target-received'));
    
    // Clean up URL
    url.searchParams.delete('share');
    window.history.replaceState({}, '', url.toString());
  }
}

// ============================================================================
// Handle URL Actions
// ============================================================================

function handleURLActions(): void {
  const url = new URL(window.location.href);
  const action = url.searchParams.get('action');
  
  if (action) {
    console.log('[URL Action]', action);
    
    window.dispatchEvent(new CustomEvent('url-action', {
      detail: { action },
    }));
    
    // Clean up URL
    url.searchParams.delete('action');
    window.history.replaceState({}, '', url.toString());
  }
}

// ============================================================================
// Bootstrap
// ============================================================================

// Register service worker
if (import.meta.env.PROD) {
  registerServiceWorker();
}

// Set up launch queue for file handlers
setupLaunchQueue();

// Handle share target
handleShareTarget();

// Handle URL actions
handleURLActions();

// Initialize Theme
ThemeManager.initialize();

// Render app
const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
          <PWARoot />
        </Suspense>
      </ErrorBoundary>
    </StrictMode>
  );
} else {
  console.error('[AnkhWave] Root element not found');
}

// Export for HMR
export {};