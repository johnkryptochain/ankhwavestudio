// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * ErrorBoundary - Global error handling component
 * Catches JavaScript errors anywhere in the child component tree
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Log error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRetry?: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  onRetry,
}) => {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div className="flex items-center justify-center min-h-screen bg-daw-bg-primary p-4">
      <div className="bg-daw-bg-elevated rounded-lg shadow-xl p-8 max-w-lg w-full">
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-daw-text-primary mb-2">
            Une erreur est survenue
          </h1>
          <p className="text-daw-text-secondary">
            Une erreur inattendue s’est produite. Votre travail a été enregistré automatiquement.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={onRetry}
            className="w-full px-4 py-3 bg-daw-accent-primary text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            Réessayer
          </button>

          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-3 bg-daw-bg-surface text-daw-text-primary rounded-lg hover:bg-daw-bg-secondary transition-colors"
          >
            Recharger l’application
          </button>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full px-4 py-2 text-daw-text-muted hover:text-daw-text-secondary text-sm"
          >
            {showDetails ? 'Masquer' : 'Afficher'} les détails de l’erreur
          </button>
        </div>

        {showDetails && error && (
          <div className="mt-4 p-4 bg-daw-bg-surface rounded-lg overflow-auto max-h-64">
            <p className="text-red-400 font-mono text-sm mb-2">
              {error.name}: {error.message}
            </p>
            {errorInfo && (
              <pre className="text-daw-text-muted text-xs whitespace-pre-wrap">
                {errorInfo.componentStack}
              </pre>
            )}
          </div>
        )}

        <p className="text-center text-daw-text-muted text-xs mt-6">
          Si le problème persiste, veuillez{' '}
          <a
            href="https://github.com/AnkhWaveStudio/AnkhWaveStudio-web/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-daw-accent-primary hover:underline"
          >
            signaler un problème
          </a>
        </p>
      </div>
    </div>
  );
};

/**
 * Audio-specific error component
 */
interface AudioErrorProps {
  error: string;
  onRetry?: () => void;
}

export const AudioError: React.FC<AudioErrorProps> = ({ error, onRetry }) => {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-daw-bg-elevated rounded-lg shadow-xl p-8 max-w-md text-center">
        <div className="text-5xl mb-4">🔇</div>
        <h2 className="text-xl font-bold text-daw-text-primary mb-2">
          Erreur du moteur audio
        </h2>
        <p className="text-daw-text-secondary mb-4">{error}</p>
        
        <div className="space-y-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full px-4 py-2 bg-daw-accent-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Réessayer
            </button>
          )}
          
          <div className="text-daw-text-muted text-sm">
            <p className="mb-2">Conseils de dépannage :</p>
            <ul className="text-left list-disc list-inside space-y-1">
              <li>Vérifiez que votre navigateur supporte l’API Web Audio</li>
              <li>Assurez-vous que les permissions audio sont accordées</li>
              <li>Essayez d’actualiser la page</li>
              <li>Vérifiez si d’autres applications audio bloquent l’accès</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * File import error component
 */
interface ImportErrorProps {
  fileName: string;
  error: string;
  onDismiss: () => void;
}

export const ImportError: React.FC<ImportErrorProps> = ({
  fileName,
  error,
  onDismiss,
}) => {
  return (
    <div className="fixed top-4 right-4 bg-red-900/90 text-white rounded-lg shadow-xl p-4 max-w-sm z-50 animate-slide-in">
      <div className="flex items-start gap-3">
        <div className="text-2xl">❌</div>
        <div className="flex-1">
          <h3 className="font-medium mb-1">Échec de l’importation</h3>
          <p className="text-sm text-red-200 mb-1">
            Impossible d’importer "{fileName}"
          </p>
          <p className="text-xs text-red-300">{error}</p>
        </div>
        <button
          onClick={onDismiss}
          className="text-red-200 hover:text-white"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

/**
 * Browser compatibility warning
 */
interface BrowserWarningProps {
  feature: string;
  onDismiss: () => void;
}

export const BrowserWarning: React.FC<BrowserWarningProps> = ({
  feature,
  onDismiss,
}) => {
  return (
    <div className="fixed bottom-4 left-4 bg-yellow-900/90 text-white rounded-lg shadow-xl p-4 max-w-sm z-50">
      <div className="flex items-start gap-3">
        <div className="text-2xl">⚠️</div>
        <div className="flex-1">
          <h3 className="font-medium mb-1">Compatibilité navigateur limitée</h3>
          <p className="text-sm text-yellow-200">
            {feature} peut ne pas fonctionner correctement dans votre navigateur.
            Pour une meilleure expérience, utilisez Chrome, Edge ou Firefox.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-yellow-200 hover:text-white"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default ErrorBoundary;