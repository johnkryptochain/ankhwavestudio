// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Save Project Dialog
 * UI for saving/exporting AnkhWaveStudio Web projects
 */

import React, { useState, useCallback, memo, useEffect } from 'react';
import { Button } from '../common/Button';
import { exportAnkhWaveStudioProject, getExportExtension } from '../../utils/projectExport';
import type { ExportOptions } from '../../utils/projectExport/AnkhWaveProjectExporter';
import type { ProjectData } from '../../types/song';

interface SaveProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectData;
  onSaveComplete?: (fileName: string) => void;
}

type SaveLocation = 'download' | 'indexeddb';

export const SaveProjectDialog: React.FC<SaveProjectDialogProps> = memo(({
  isOpen,
  onClose,
  project,
  onSaveComplete,
}) => {
  const [fileName, setFileName] = useState(project.name || 'sans-titre');
  const [format, setFormat] = useState<'mmp' | 'mmpz'>('mmpz');
  const [embedSamples, setEmbedSamples] = useState(true);
  const [includeAutomation, setIncludeAutomation] = useState(true);
  const [saveLocation, setSaveLocation] = useState<SaveLocation>('download');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Update filename when project changes
  useEffect(() => {
    setFileName(project.name || 'sans-titre');
  }, [project.name]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(false);
      setIsSaving(false);
    }
  }, [isOpen]);

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    try {
      const options: ExportOptions = {
        format,
        embedSamples,
        includeAutomation,
      };

      const blob = await exportAnkhWaveStudioProject(project, options);
      const fullFileName = fileName + getExportExtension(format);

      if (saveLocation === 'download') {
        // Download the file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fullFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Save to IndexedDB
        await saveToIndexedDB(fullFileName, blob);
      }

      setSuccess(true);
      onSaveComplete?.(fullFileName);

      // Close dialog after short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l\'enregistrement du projet');
    } finally {
      setIsSaving(false);
    }
  }, [fileName, format, embedSamples, includeAutomation, saveLocation, project, onSaveComplete, onClose]);

  // Save to IndexedDB
  const saveToIndexedDB = async (name: string, blob: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AnkhWaveStudio-web-projects', 1);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'name' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['projects'], 'readwrite');
        const store = transaction.objectStore('projects');

        const data = {
          name,
          blob,
          savedAt: Date.now(),
        };

        const putRequest = store.put(data);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  };

  // Calculate estimated file size
  const estimateFileSize = (): string => {
    // Rough estimate based on project complexity
    const trackCount = project.tracks.length;
    const baseSize = 2048; // Base XML overhead
    const perTrackSize = 1024; // Average per track
    const compressionRatio = format === 'mmpz' ? 0.3 : 1;
    
    const estimatedBytes = (baseSize + trackCount * perTrackSize) * compressionRatio;
    
    if (estimatedBytes < 1024) {
      return `~${Math.round(estimatedBytes)} o`;
    } else if (estimatedBytes < 1024 * 1024) {
      return `~${Math.round(estimatedBytes / 1024)} Ko`;
    } else {
      return `~${(estimatedBytes / (1024 * 1024)).toFixed(1)} Mo`;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-daw-bg-elevated rounded-lg shadow-2xl border border-daw-border w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-daw-border">
          <h2 className="text-lg font-semibold text-daw-text-primary">Enregistrer le projet</h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-daw-text-muted hover:text-daw-text-primary disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Success message */}
          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">✅</div>
              <p className="text-green-500 font-medium">Projet enregistré avec succès !</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          {!success && (
            <>
              {/* Filename */}
              <div>
                <label className="block text-sm font-medium text-daw-text-secondary mb-1">
                  Nom du projet
                </label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-daw-bg-primary border border-daw-border rounded text-daw-text-primary focus:outline-none focus:border-daw-accent-primary disabled:opacity-50"
                  placeholder="Entrez le nom du projet"
                />
              </div>

              {/* Format */}
              <div>
                <label className="block text-sm font-medium text-daw-text-secondary mb-2">
                  Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFormat('mmpz')}
                    disabled={isSaving}
                    className={`p-3 rounded border text-center transition-colors ${
                      format === 'mmpz'
                        ? 'border-daw-accent-primary bg-daw-accent-primary/10 text-daw-accent-primary'
                        : 'border-daw-border bg-daw-bg-primary text-daw-text-secondary hover:bg-daw-bg-surface'
                    } disabled:opacity-50`}
                  >
                    <div className="font-medium">.mmpz</div>
                    <div className="text-xs opacity-70 mt-1">Compressé</div>
                  </button>
                  <button
                    onClick={() => setFormat('mmp')}
                    disabled={isSaving}
                    className={`p-3 rounded border text-center transition-colors ${
                      format === 'mmp'
                        ? 'border-daw-accent-primary bg-daw-accent-primary/10 text-daw-accent-primary'
                        : 'border-daw-border bg-daw-bg-primary text-daw-text-secondary hover:bg-daw-bg-surface'
                    } disabled:opacity-50`}
                  >
                    <div className="font-medium">.mmp</div>
                    <div className="text-xs opacity-70 mt-1">Non compressé</div>
                  </button>
                </div>
              </div>

              {/* Save Location */}
              <div>
                <label className="block text-sm font-medium text-daw-text-secondary mb-2">
                  Enregistrer dans
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSaveLocation('download')}
                    disabled={isSaving}
                    className={`p-3 rounded border text-center transition-colors ${
                      saveLocation === 'download'
                        ? 'border-daw-accent-primary bg-daw-accent-primary/10 text-daw-accent-primary'
                        : 'border-daw-border bg-daw-bg-primary text-daw-text-secondary hover:bg-daw-bg-surface'
                    } disabled:opacity-50`}
                  >
                    <div className="text-lg mb-1">💾</div>
                    <div className="font-medium text-sm">Télécharger</div>
                  </button>
                  <button
                    onClick={() => setSaveLocation('indexeddb')}
                    disabled={isSaving}
                    className={`p-3 rounded border text-center transition-colors ${
                      saveLocation === 'indexeddb'
                        ? 'border-daw-accent-primary bg-daw-accent-primary/10 text-daw-accent-primary'
                        : 'border-daw-border bg-daw-bg-primary text-daw-text-secondary hover:bg-daw-bg-surface'
                    } disabled:opacity-50`}
                  >
                    <div className="text-lg mb-1">🗄️</div>
                    <div className="font-medium text-sm">Stockage navigateur</div>
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={embedSamples}
                    onChange={(e) => setEmbedSamples(e.target.checked)}
                    disabled={isSaving}
                    className="text-daw-accent-primary rounded"
                  />
                  <span className="text-daw-text-secondary text-sm">Intégrer les échantillons dans le fichier projet</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAutomation}
                    onChange={(e) => setIncludeAutomation(e.target.checked)}
                    disabled={isSaving}
                    className="text-daw-accent-primary rounded"
                  />
                  <span className="text-daw-text-secondary text-sm">Inclure les données d'automation</span>
                </label>
              </div>

              {/* Info */}
              <div className="bg-daw-bg-primary rounded p-3 text-sm">
                <div className="flex justify-between text-daw-text-muted">
                  <span>Pistes :</span>
                  <span className="text-daw-text-secondary">{project.tracks.length}</span>
                </div>
                <div className="flex justify-between text-daw-text-muted mt-1">
                  <span>Taille estimée :</span>
                  <span className="text-daw-text-secondary">{estimateFileSize()}</span>
                </div>
                <div className="flex justify-between text-daw-text-muted mt-1">
                  <span>Fichier de sortie :</span>
                  <span className="text-daw-text-secondary">{fileName}{getExportExtension(format)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-daw-border">
          {!success && (
            <>
              <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                Annuler
              </Button>
              <Button 
                variant="primary" 
                onClick={handleSave} 
                disabled={isSaving || !fileName.trim()}
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer le projet'}
              </Button>
            </>
          )}
          {success && (
            <Button variant="primary" onClick={onClose}>
              Terminé
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

SaveProjectDialog.displayName = 'SaveProjectDialog';

export default SaveProjectDialog;
