// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Import Project Dialog
 * UI for importing AnkhWaveStudio project files (.mmp/.mmpz)
 */

import React, { useState, useCallback, useRef, memo } from 'react';
import { Button } from '../common/Button';
import { 
  importAnkhWaveStudioProject, 
  isAnkhWaveStudioProjectFile,
  getAnkhWaveStudioProjectInfo,
} from '../../utils/projectImport';
import type { ImportResult } from '../../utils/projectImport';
import type { AnkhWaveStudioImportWarning } from '../../types/ankhWaveProject';
import type { ProjectData } from '../../types/song';

interface ImportProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (project: ProjectData) => void;
}

type ImportPhase = 'select' | 'preview' | 'importing' | 'complete' | 'error';

interface ProjectPreview {
  fileName: string;
  version: string;
  creator: string;
  bpm: number;
  trackCount: number;
  file: File;
}

export const ImportProjectDialog: React.FC<ImportProjectDialogProps> = memo(({
  isOpen,
  onClose,
  onImport,
}) => {
  const [phase, setPhase] = useState<ImportPhase>('select');
  const [preview, setPreview] = useState<ProjectPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens/closes
  const resetState = useCallback(() => {
    setPhase('select');
    setPreview(null);
    setImportResult(null);
    setError(null);
    setProgress(0);
    setIsDragging(false);
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    if (!isAnkhWaveStudioProjectFile(file)) {
      setError('Veuillez sélectionner un fichier projet AnkhWaveStudio valide (.mmp ou .mmpz)');
      return;
    }

    try {
      setPhase('preview');
      setError(null);

      // Get project info for preview
      const info = await getAnkhWaveStudioProjectInfo(file);
      
      setPreview({
        fileName: file.name,
        version: info.version,
        creator: info.creator,
        bpm: info.bpm,
        trackCount: info.trackCount,
        file,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la lecture du fichier projet');
      setPhase('error');
    }
  }, []);

  // Handle file input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // Handle import
  const handleImport = useCallback(async () => {
    if (!preview) return;

    try {
      setPhase('importing');
      setProgress(0);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const result = await importAnkhWaveStudioProject(preview.file);
      
      clearInterval(progressInterval);
      setProgress(100);
      setImportResult(result);
      setPhase('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l\'importation du projet');
      setPhase('error');
    }
  }, [preview]);

  // Handle confirm import
  const handleConfirmImport = useCallback(() => {
    if (importResult) {
      onImport(importResult.project);
      resetState();
      onClose();
    }
  }, [importResult, onImport, onClose, resetState]);

  // Handle close
  const handleClose = useCallback(() => {
    if (phase !== 'importing') {
      resetState();
      onClose();
    }
  }, [phase, resetState, onClose]);

  // Handle back to selection
  const handleBack = useCallback(() => {
    setPhase('select');
    setPreview(null);
    setError(null);
  }, []);

  // Render warning item
  const renderWarning = (warning: AnkhWaveStudioImportWarning, index: number) => {
    const iconMap: Record<AnkhWaveStudioImportWarning['type'], string> = {
      instrument: '🎹',
      effect: '🎛️',
      sample: '🔊',
      feature: '⚙️',
      version: '📋',
    };

    return (
      <div 
        key={index}
        className="flex items-start gap-2 p-2 bg-daw-bg-primary rounded text-sm"
      >
        <span className="flex-shrink-0">{iconMap[warning.type]}</span>
        <div>
          <p className="text-daw-text-secondary">{warning.message}</p>
          {warning.details && (
            <p className="text-daw-text-muted text-xs mt-1">{warning.details}</p>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-daw-bg-elevated rounded-lg shadow-2xl border border-daw-border w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-daw-border">
          <h2 className="text-lg font-semibold text-daw-text-primary">
            {phase === 'select' && 'Importer un projet AnkhWaveStudio'}
            {phase === 'preview' && 'Aperçu du projet'}
            {phase === 'importing' && 'Importation en cours...'}
            {phase === 'complete' && 'Importation terminée'}
            {phase === 'error' && 'Erreur d\'importation'}
          </h2>
          <button
            onClick={handleClose}
            disabled={phase === 'importing'}
            className="text-daw-text-muted hover:text-daw-text-primary disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {/* File Selection Phase */}
          {phase === 'select' && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-daw-accent-primary bg-daw-accent-primary/10'
                  : 'border-daw-border hover:border-daw-text-muted'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="text-4xl mb-4">📁</div>
              <p className="text-daw-text-primary mb-2">
                Glissez-déposez un fichier projet AnkhWaveStudio ici
              </p>
              <p className="text-daw-text-muted text-sm mb-4">
                ou cliquez pour parcourir
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mmp,.mmpz"
                onChange={handleInputChange}
                className="hidden"
              />
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                Parcourir les fichiers
              </Button>
              <p className="text-daw-text-muted text-xs mt-4">
                Formats supportés : .mmp, .mmpz
              </p>
            </div>
          )}

          {/* Preview Phase */}
          {phase === 'preview' && preview && (
            <div className="space-y-4">
              <div className="bg-daw-bg-primary rounded-lg p-4">
                <h3 className="text-daw-text-primary font-medium mb-3">
                  Informations du projet
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-daw-text-muted">Fichier :</div>
                  <div className="text-daw-text-secondary">{preview.fileName}</div>
                  
                  <div className="text-daw-text-muted">Créateur :</div>
                  <div className="text-daw-text-secondary">{preview.creator}</div>
                  
                  <div className="text-daw-text-muted">Version :</div>
                  <div className="text-daw-text-secondary">{preview.version}</div>
                  
                  <div className="text-daw-text-muted">Tempo :</div>
                  <div className="text-daw-text-secondary">{preview.bpm} BPM</div>
                  
                  <div className="text-daw-text-muted">Pistes :</div>
                  <div className="text-daw-text-secondary">{preview.trackCount}</div>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <span className="text-yellow-500">⚠️</span>
                  <div className="text-sm">
                    <p className="text-yellow-500 font-medium">Avis d'importation</p>
                    <p className="text-daw-text-secondary mt-1">
                      Certaines fonctionnalités peuvent ne pas être entièrement supportées. Les instruments 
                      non supportés seront remplacés par TripleOscillator.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Importing Phase */}
          {phase === 'importing' && (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-daw-accent-primary mx-auto mb-4" />
              <p className="text-daw-text-primary mb-4">Importation du projet...</p>
              <div className="h-2 bg-daw-bg-primary rounded-full overflow-hidden">
                <div
                  className="h-full bg-daw-accent-primary transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-daw-text-muted text-sm mt-2">{progress}%</p>
            </div>
          )}

          {/* Complete Phase */}
          {phase === 'complete' && importResult && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-daw-text-primary font-medium">
                  Projet importé avec succès !
                </p>
              </div>

              {/* Summary */}
              <div className="bg-daw-bg-primary rounded-lg p-4">
                <h3 className="text-daw-text-primary font-medium mb-3">Résumé</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-daw-text-muted">Pistes :</div>
                  <div className="text-daw-text-secondary">
                    {importResult.project.tracks.length}
                  </div>
                  
                  <div className="text-daw-text-muted">Échantillons intégrés :</div>
                  <div className="text-daw-text-secondary">
                    {importResult.embeddedSamplesCount}
                  </div>
                  
                  {importResult.missingSamples.length > 0 && (
                    <>
                      <div className="text-daw-text-muted">Échantillons manquants :</div>
                      <div className="text-yellow-500">
                        {importResult.missingSamples.length}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {importResult.warnings.length > 0 && (
                <div>
                  <h3 className="text-daw-text-primary font-medium mb-2">
                    Avertissements ({importResult.warnings.length})
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {importResult.warnings.map((warning, index) => 
                      renderWarning(warning, index)
                    )}
                  </div>
                </div>
              )}

              {/* Unsupported Features */}
              {(importResult.unsupportedInstruments.length > 0 || 
                importResult.unsupportedEffects.length > 0) && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                  <h4 className="text-orange-500 font-medium text-sm mb-2">
                    Fonctionnalités non supportées
                  </h4>
                  {importResult.unsupportedInstruments.length > 0 && (
                    <div className="text-sm mb-2">
                      <span className="text-daw-text-muted">Instruments : </span>
                      <span className="text-daw-text-secondary">
                        {importResult.unsupportedInstruments.join(', ')}
                      </span>
                    </div>
                  )}
                  {importResult.unsupportedEffects.length > 0 && (
                    <div className="text-sm">
                      <span className="text-daw-text-muted">Effets : </span>
                      <span className="text-daw-text-secondary">
                        {importResult.unsupportedEffects.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error Phase */}
          {phase === 'error' && (
            <div className="py-8 text-center">
              <div className="text-4xl mb-4">❌</div>
              <p className="text-red-500 font-medium mb-2">Échec de l'importation</p>
              <p className="text-daw-text-secondary text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-daw-border">
          {phase === 'select' && (
            <Button variant="ghost" onClick={handleClose}>
              Annuler
            </Button>
          )}

          {phase === 'preview' && (
            <>
              <Button variant="ghost" onClick={handleBack}>
                Retour
              </Button>
              <Button variant="primary" onClick={handleImport}>
                Importer le projet
              </Button>
            </>
          )}

          {phase === 'complete' && (
            <>
              <Button variant="ghost" onClick={handleClose}>
                Fermer
              </Button>
              <Button variant="primary" onClick={handleConfirmImport}>
                Ouvrir le projet
              </Button>
            </>
          )}

          {phase === 'error' && (
            <>
              <Button variant="ghost" onClick={handleClose}>
                Annuler
              </Button>
              <Button variant="secondary" onClick={handleBack}>
                Réessayer
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

ImportProjectDialog.displayName = 'ImportProjectDialog';

export default ImportProjectDialog;
