// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Export Dialog - UI for audio export settings and progress
 */

import React, { useState, useCallback, useEffect, memo } from 'react';
import { Button } from '../common/Button';
import { 
  AudioExporter, 
  ExportFormat, 
  ExportOptions, 
  ExportProgress,
  BitDepth,
  SampleRate 
} from '../../audio/AudioExporter';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  duration: number; // in seconds
  onExport: (
    options: ExportOptions,
    onProgress: (progress: ExportProgress) => void
  ) => Promise<Blob>;
}

const formatOptions: { value: ExportFormat; label: string; description: string }[] = [
  { value: 'wav', label: 'WAV', description: 'Non compressé, qualité maximale' },
  { value: 'flac', label: 'FLAC', description: 'Compression sans perte' },
  { value: 'mp3', label: 'MP3', description: 'Compressé, très compatible' },
  { value: 'ogg', label: 'OGG Vorbis', description: 'Compressé, format ouvert' },
];

const sampleRateOptions: { value: SampleRate; label: string }[] = [
  { value: 22050, label: '22 050 Hz' },
  { value: 44100, label: '44 100 Hz (Qualité CD)' },
  { value: 48000, label: '48 000 Hz (Qualité DVD)' },
  { value: 96000, label: '96 000 Hz (Haute résolution)' },
];

const bitDepthOptions: { value: BitDepth; label: string }[] = [
  { value: 16, label: '16 bits (Qualité CD)' },
  { value: 24, label: '24 bits (Professionnel)' },
  { value: 32, label: '32 bits flottant (Maximum)' },
];

const qualityPresets = [
  { value: 0.5, label: 'Basse (fichier plus petit)' },
  { value: 0.7, label: 'Moyenne' },
  { value: 0.8, label: 'Haute (recommandée)' },
  { value: 0.95, label: 'Maximale (fichier plus gros)' },
];

const flacCompressionLevels = [
  { value: 0, label: '0 - Plus rapide (fichier plus gros)' },
  { value: 3, label: '3 - Rapide' },
  { value: 5, label: '5 - Par défaut (recommandé)' },
  { value: 8, label: '8 - Meilleure compression (plus lent)' },
];

export const ExportDialog: React.FC<ExportDialogProps> = memo(({
  isOpen,
  onClose,
  projectName,
  duration,
  onExport,
}) => {
  // Export settings
  const [format, setFormat] = useState<ExportFormat>('wav');
  const [sampleRate, setSampleRate] = useState<SampleRate>(44100);
  const [bitDepth, setBitDepth] = useState<BitDepth>(16);
  const [channels, setChannels] = useState<1 | 2>(2);
  const [quality, setQuality] = useState(0.8);
  const [normalize, setNormalize] = useState(true);
  const [dithering, setDithering] = useState(true);
  const [flacCompressionLevel, setFlacCompressionLevel] = useState(5);
  const [filename, setFilename] = useState(projectName);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exporter, setExporter] = useState<AudioExporter | null>(null);

  // Update filename when project name changes
  useEffect(() => {
    setFilename(projectName || 'sans-titre');
  }, [projectName]);

  // Calculate estimated file size
  const estimatedSize = AudioExporter.estimateFileSize(duration, {
    format,
    sampleRate,
    bitDepth,
    channels,
    quality,
    flacCompressionLevel,
  });

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle export
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setProgress({ phase: 'rendering', progress: 0, message: 'Démarrage de l\'exportation...' });

    const exporterInstance = new AudioExporter();
    setExporter(exporterInstance);

    try {
      const options: ExportOptions = {
        format,
        sampleRate,
        bitDepth,
        channels,
        quality,
        normalize,
        dithering,
        flacCompressionLevel,
      };

      const blob = await onExport(options, setProgress);

      // Download the file
      const fullFilename = filename + AudioExporter.getFileExtension(format);
      AudioExporter.downloadBlob(blob, fullFilename);

      // Close dialog after successful export
      setTimeout(() => {
        setIsExporting(false);
        setProgress(null);
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Export failed:', error);
      setProgress({
        phase: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Échec de l\'exportation',
      });
      setIsExporting(false);
    }

    setExporter(null);
  }, [format, sampleRate, bitDepth, channels, quality, normalize, dithering, flacCompressionLevel, filename, onExport, onClose]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (exporter) {
      exporter.cancel();
    }
    setIsExporting(false);
    setProgress(null);
  }, [exporter]);

  // Handle close
  const handleClose = useCallback(() => {
    if (!isExporting) {
      onClose();
    }
  }, [isExporting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-daw-bg-elevated rounded-lg shadow-2xl border border-daw-border w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-daw-border">
          <h2 className="text-lg font-semibold text-daw-text-primary">Exporter l'audio</h2>
          <button
            onClick={handleClose}
            disabled={isExporting}
            className="text-daw-text-muted hover:text-daw-text-primary disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Filename */}
          <div>
            <label className="block text-sm font-medium text-daw-text-secondary mb-1">
              Nom du fichier
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              disabled={isExporting}
              className="w-full px-3 py-2 bg-daw-bg-primary border border-daw-border rounded text-daw-text-primary focus:outline-none focus:border-daw-accent-primary disabled:opacity-50"
            />
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-daw-text-secondary mb-2">
              Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {formatOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFormat(opt.value)}
                  disabled={isExporting}
                  className={`p-3 rounded border text-center transition-colors ${
                    format === opt.value
                      ? 'border-daw-accent-primary bg-daw-accent-primary/10 text-daw-accent-primary'
                      : 'border-daw-border bg-daw-bg-primary text-daw-text-secondary hover:bg-daw-bg-surface'
                  } disabled:opacity-50`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs opacity-70 mt-1">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sample Rate */}
          <div>
            <label className="block text-sm font-medium text-daw-text-secondary mb-1">
              Fréquence d'échantillonnage
            </label>
            <select
              value={sampleRate}
              onChange={(e) => setSampleRate(Number(e.target.value) as SampleRate)}
              disabled={isExporting}
              className="w-full px-3 py-2 bg-daw-bg-primary border border-daw-border rounded text-daw-text-primary focus:outline-none focus:border-daw-accent-primary disabled:opacity-50"
            >
              {sampleRateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Bit Depth (WAV and FLAC) */}
          {(format === 'wav' || format === 'flac') && (
            <div>
              <label className="block text-sm font-medium text-daw-text-secondary mb-1">
                Résolution
              </label>
              <select
                value={bitDepth}
                onChange={(e) => setBitDepth(Number(e.target.value) as BitDepth)}
                disabled={isExporting}
                className="w-full px-3 py-2 bg-daw-bg-primary border border-daw-border rounded text-daw-text-primary focus:outline-none focus:border-daw-accent-primary disabled:opacity-50"
              >
                {bitDepthOptions
                  .filter(opt => format !== 'flac' || opt.value !== 32) // FLAC doesn't support 32-bit float
                  .map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
              </select>
            </div>
          )}

          {/* FLAC Compression Level */}
          {format === 'flac' && (
            <div>
              <label className="block text-sm font-medium text-daw-text-secondary mb-1">
                Niveau de compression
              </label>
              <select
                value={flacCompressionLevel}
                onChange={(e) => setFlacCompressionLevel(Number(e.target.value))}
                disabled={isExporting}
                className="w-full px-3 py-2 bg-daw-bg-primary border border-daw-border rounded text-daw-text-primary focus:outline-none focus:border-daw-accent-primary disabled:opacity-50"
              >
                {flacCompressionLevels.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-daw-text-muted mt-1">
                Compression plus élevée = fichier plus petit mais encodage plus lent
              </p>
            </div>
          )}

          {/* Quality (MP3/OGG only) */}
          {(format === 'mp3' || format === 'ogg') && (
            <div>
              <label className="block text-sm font-medium text-daw-text-secondary mb-1">
                Qualité
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                disabled={isExporting}
                className="w-full px-3 py-2 bg-daw-bg-primary border border-daw-border rounded text-daw-text-primary focus:outline-none focus:border-daw-accent-primary disabled:opacity-50"
              >
                {qualityPresets.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Channels */}
          <div>
            <label className="block text-sm font-medium text-daw-text-secondary mb-1">
              Canaux
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="channels"
                  checked={channels === 2}
                  onChange={() => setChannels(2)}
                  disabled={isExporting}
                  className="text-daw-accent-primary"
                />
                <span className="text-daw-text-secondary">Stéréo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="channels"
                  checked={channels === 1}
                  onChange={() => setChannels(1)}
                  disabled={isExporting}
                  className="text-daw-accent-primary"
                />
                <span className="text-daw-text-secondary">Mono</span>
              </label>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={normalize}
                onChange={(e) => setNormalize(e.target.checked)}
                disabled={isExporting}
                className="text-daw-accent-primary rounded"
              />
              <span className="text-daw-text-secondary text-sm">Normaliser (maximiser le volume)</span>
            </label>
            {(format === 'wav' || format === 'flac') && bitDepth < 32 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dithering}
                  onChange={(e) => setDithering(e.target.checked)}
                  disabled={isExporting}
                  className="text-daw-accent-primary rounded"
                />
                <span className="text-daw-text-secondary text-sm">Appliquer le dithering</span>
              </label>
            )}
          </div>

          {/* Info */}
          <div className="bg-daw-bg-primary rounded p-3 text-sm">
            <div className="flex justify-between text-daw-text-muted">
              <span>Durée :</span>
              <span className="text-daw-text-secondary">{formatDuration(duration)}</span>
            </div>
            <div className="flex justify-between text-daw-text-muted mt-1">
              <span>Taille estimée :</span>
              <span className="text-daw-text-secondary">{AudioExporter.formatFileSize(estimatedSize)}</span>
            </div>
          </div>

          {/* Progress */}
          {progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-daw-text-secondary">{progress.message}</span>
                <span className="text-daw-text-muted">{Math.round(progress.progress * 100)}%</span>
              </div>
              <div className="h-2 bg-daw-bg-primary rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    progress.phase === 'error' ? 'bg-red-500' :
                    progress.phase === 'complete' ? 'bg-green-500' :
                    'bg-daw-accent-primary'
                  }`}
                  style={{ width: `${progress.progress * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-daw-border">
          {isExporting ? (
            <Button variant="secondary" onClick={handleCancel}>
              Annuler
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={handleClose}>
                Annuler
              </Button>
              <Button variant="primary" onClick={handleExport}>
                Exporter
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

ExportDialog.displayName = 'ExportDialog';

export default ExportDialog;
