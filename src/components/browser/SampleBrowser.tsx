// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * SampleBrowser - Sample browser with preview functionality
 * 
 * Features:
 * - Folder navigation
 * - Sample preview on hover/click
 * - Waveform preview
 * - Sample info (duration, sample rate, channels)
 * - Drag and drop to tracks
 * - Favorites/recent samples
 */

import React, { memo, useCallback, useRef, useEffect, useMemo, useState } from 'react';
import { SamplePreview, SampleInfo, createSamplePreview } from '../../audio/SamplePreview';
import { Button, Slider } from '../common';

interface SampleFile {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  extension?: string;
}

interface SampleBrowserProps {
  audioContext: AudioContext | null;
  onSampleSelect?: (path: string) => void;
  onSampleDrop?: (path: string, targetTrackId?: string) => void;
}

interface SampleManifest {
  version: number;
  generatedAt: string;
  files: Array<{ path: string; size: number }>;
}

/**
 * Waveform display component
 */
const WaveformDisplay: React.FC<{
  waveformData: Float32Array | null;
  isPlaying: boolean;
}> = memo(({ waveformData, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    const rootStyle = getComputedStyle(document.documentElement);
    const bg = rootStyle.getPropertyValue('--daw-bg-secondary').trim() || '#14141b';
    const border = rootStyle.getPropertyValue('--daw-border').trim() || '#2a2a3a';
    const muted = rootStyle.getPropertyValue('--daw-text-muted').trim() || '#68687a';
    const accent = rootStyle.getPropertyValue('--daw-accent').trim() || '#8286ef';
    const success = rootStyle.getPropertyValue('--daw-success').trim() || '#6ee7b7';

    // Clear canvas
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    
    if (!waveformData || waveformData.length === 0) {
      // Draw placeholder
      ctx.fillStyle = muted;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Aucun sample chargé', width / 2, height / 2);
      return;
    }
    
    // Draw waveform
    const step = Math.ceil(waveformData.length / width);
    const amp = height / 2;
    
    ctx.strokeStyle = isPlaying ? success : accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    for (let i = 0; i < width; i++) {
      const dataIndex = Math.floor(i * step);
      
      // Find min/max in this segment
      let min = 1;
      let max = -1;
      for (let j = 0; j < step && dataIndex + j < waveformData.length; j++) {
        const value = waveformData[dataIndex + j];
        if (value < min) min = value;
        if (value > max) max = value;
      }
      
      const y1 = (1 - max) * amp;
      const y2 = (1 - min) * amp;
      
      ctx.moveTo(i, y1);
      ctx.lineTo(i, y2);
    }
    
    ctx.stroke();
    
    // Draw center line
    ctx.strokeStyle = border;
    ctx.beginPath();
    ctx.moveTo(0, amp);
    ctx.lineTo(width, amp);
    ctx.stroke();
    
  }, [waveformData, isPlaying]);
  
  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={60}
      className="w-full h-[60px] rounded border border-daw-border bg-daw-bg-secondary"
    />
  );
});

WaveformDisplay.displayName = 'WaveformDisplay';

/**
 * Sample info display component
 */
const SampleInfoDisplay: React.FC<{
  info: SampleInfo | null;
}> = memo(({ info }) => {
  if (!info) {
    return (
      <div className="p-2 text-xs text-daw-text-muted text-center">
        Sélectionnez un sample pour pré-écouter
      </div>
    );
  }
  
  const formatDuration = (seconds: number): string => {
    if (seconds < 1) {
      return `${Math.round(seconds * 1000)}ms`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return mins > 0 ? `${mins}:${secs.padStart(4, '0')}` : `${secs}s`;
  };
  
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  return (
    <div className="grid grid-cols-2 gap-1 p-2 text-[10px] text-daw-text-muted">
      <div>
        <span style={{ color: '#666' }}>Durée : </span>
        <span className="text-daw-text-primary">{formatDuration(info.duration)}</span>
      </div>
      <div>
        <span style={{ color: '#666' }}>Fréq. : </span>
        <span className="text-daw-text-primary">{info.sampleRate} Hz</span>
      </div>
      <div>
        <span style={{ color: '#666' }}>Canaux : </span>
        <span className="text-daw-text-primary">{info.channels === 1 ? 'Mono' : 'Stéréo'}</span>
      </div>
      <div>
        <span style={{ color: '#666' }}>Taille : </span>
        <span className="text-daw-text-primary">{formatSize(info.size)}</span>
      </div>
    </div>
  );
});

SampleInfoDisplay.displayName = 'SampleInfoDisplay';

/**
 * Sample file item component
 */
const SampleFileItem: React.FC<{
  file: SampleFile;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
  onToggleFavorite: () => void;
  onDragStart: (e: React.DragEvent) => void;
}> = memo(({ file, isSelected, isFavorite, onSelect, onDoubleClick, onToggleFavorite, onDragStart }) => {
  const icon = file.type === 'folder' ? (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M10 4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h6z" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  );
  
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors group ${
        isSelected ? 'bg-daw-bg-surface' : 'hover:bg-daw-bg-hover/40'
      }`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      draggable={file.type === 'file'}
      onDragStart={onDragStart}
    >
      <div
        className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
          file.type === 'folder' ? 'bg-daw-bg-elevated text-daw-text-secondary' : 'bg-green-500/20 text-green-400'
        }`}
      >
        {icon}
      </div>
      <span className={`flex-1 min-w-0 text-sm truncate ${isSelected ? 'text-daw-text-primary' : 'text-daw-text-secondary group-hover:text-daw-text-primary'}`}>
        {file.name}
      </span>
      {file.type === 'file' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`p-1 rounded hover:bg-daw-bg-elevated transition-colors ${isFavorite ? 'text-daw-accent-warning' : 'text-daw-text-muted opacity-60 hover:opacity-100'}`}
          title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <svg className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l2.049 6.31a1 1 0 00.95.69h6.63c.969 0 1.371 1.24.588 1.81l-5.364 3.9a1 1 0 00-.364 1.118l2.049 6.31c.3.921-.755 1.688-1.539 1.118l-5.364-3.9a1 1 0 00-1.176 0l-5.364 3.9c-.784.57-1.838-.197-1.539-1.118l2.049-6.31a1 1 0 00-.364-1.118l-5.364-3.9c-.783-.57-.38-1.81.588-1.81h6.63a1 1 0 00.95-.69l2.049-6.31z" />
          </svg>
        </button>
      )}
    </div>
  );
});

SampleFileItem.displayName = 'SampleFileItem';

/**
 * Main SampleBrowser component
 */
export const SampleBrowser: React.FC<SampleBrowserProps> = memo(({ 
  audioContext, 
  onSampleSelect, 
  onSampleDrop 
}) => {
  const [samplePreview, setSamplePreview] = useState<SamplePreview | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('/samples');
  const [files, setFiles] = useState<SampleFile[]>([]);
  const [manifestFiles, setManifestFiles] = useState<SampleManifest['files']>([]);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<SampleFile | null>(null);
  const [sampleInfo, setSampleInfo] = useState<SampleInfo | null>(null);
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentSamples, setRecentSamples] = useState<string[]>([]);
  const [volume, setVolume] = useState(0.8);
  const [isLooping, setIsLooping] = useState(false);
  const [viewMode, setViewMode] = useState<'browser' | 'favorites' | 'recent'>('browser');
  
  // Initialize sample preview
  useEffect(() => {
    if (audioContext) {
      const preview = createSamplePreview(audioContext);
      preview.setOnPlayStateChange(setIsPlaying);
      preview.setOnError((error) => console.error('Sample preview error:', error));
      setSamplePreview(preview);
      
      return () => {
        preview.dispose();
      };
    }
  }, [audioContext]);
  
  // Load sample manifest generated into public/samples
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/samples/manifest.json');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const manifest = (await response.json()) as SampleManifest;
        if (!cancelled) {
          setManifestFiles(Array.isArray(manifest.files) ? manifest.files : []);
          setManifestError(null);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!cancelled) {
          setManifestFiles([]);
          setManifestError(message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const allSampleFiles = useMemo<SampleFile[]>(() => {
    return manifestFiles.map((f) => {
      const name = f.path.split('/').pop() || f.path;
      const extension = name.includes('.') ? name.split('.').pop() : undefined;
      return {
        name,
        path: f.path,
        type: 'file',
        extension,
        size: f.size,
      };
    });
  }, [manifestFiles]);

  // Build folder listing for currentPath
  useEffect(() => {
    const root = '/samples';
    const normalizedCurrent = currentPath.startsWith(root) ? currentPath : root;
    const prefix = normalizedCurrent === root ? `${root}/` : `${normalizedCurrent}/`;

    const items = new Map<string, SampleFile>();

    if (normalizedCurrent !== root) {
      const lastSlash = normalizedCurrent.lastIndexOf('/');
      const parent = lastSlash <= root.length ? root : normalizedCurrent.slice(0, lastSlash);
      items.set('..', { name: '..', path: parent, type: 'folder' });
    }

    for (const f of manifestFiles) {
      if (!f.path.startsWith(prefix)) continue;
      const rest = f.path.slice(prefix.length);
      if (!rest) continue;

      const parts = rest.split('/').filter(Boolean);
      if (parts.length === 0) continue;

      const first = parts[0];
      if (parts.length > 1) {
        const folderPath = `${normalizedCurrent}/${first}`;
        if (!items.has(folderPath)) {
          items.set(folderPath, { name: first, path: folderPath, type: 'folder' });
        }
      } else {
        const extension = first.includes('.') ? first.split('.').pop() : undefined;
        items.set(f.path, {
          name: first,
          path: f.path,
          type: 'file',
          extension,
          size: f.size,
        });
      }
    }

    const list = Array.from(items.values()).sort((a, b) => {
      if (a.name === '..') return -1;
      if (b.name === '..') return 1;
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    setFiles(list);
  }, [currentPath, manifestFiles]);
  
  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('sampleBrowser_favorites');
    if (savedFavorites) {
      setFavorites(new Set(JSON.parse(savedFavorites)));
    }
    
    const savedRecent = localStorage.getItem('sampleBrowser_recent');
    if (savedRecent) {
      setRecentSamples(JSON.parse(savedRecent));
    }
  }, []);
  
  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('sampleBrowser_favorites', JSON.stringify([...favorites]));
  }, [favorites]);
  
  // Save recent to localStorage
  useEffect(() => {
    localStorage.setItem('sampleBrowser_recent', JSON.stringify(recentSamples));
  }, [recentSamples]);
  
  const handleFileSelect = useCallback(async (file: SampleFile) => {
    setSelectedFile(file);
    
    if (file.type === 'file' && samplePreview) {
      setIsLoading(true);
      try {
        const info = await samplePreview.preview(file.path, true);
        setSampleInfo(info);
        setWaveformData(samplePreview.getWaveformData());
        
        // Add to recent
        setRecentSamples(prev => {
          const filtered = prev.filter(p => p !== file.path);
          return [file.path, ...filtered].slice(0, 20);
        });
        
        onSampleSelect?.(file.path);
      } catch (error) {
        console.error('Failed to preview sample:', error);
        setSampleInfo(null);
        setWaveformData(null);
      } finally {
        setIsLoading(false);
      }
    }
  }, [samplePreview, onSampleSelect]);
  
  const handleFileDoubleClick = useCallback((file: SampleFile) => {
    if (file.type === 'folder') {
      setCurrentPath(file.path);
    } else {
      // Add to track or trigger action
      onSampleDrop?.(file.path);
    }
  }, [onSampleDrop]);
  
  const handleToggleFavorite = useCallback((path: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(path)) {
        newFavorites.delete(path);
      } else {
        newFavorites.add(path);
      }
      return newFavorites;
    });
  }, []);
  
  const handleDragStart = useCallback((e: React.DragEvent, file: SampleFile) => {
    const duration = selectedFile?.path === file.path ? sampleInfo?.duration : undefined;
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'sample',
      path: file.path,
      name: file.name,
      duration,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  }, [selectedFile?.path, sampleInfo?.duration]);
  
  const handlePlayPause = useCallback(() => {
    samplePreview?.toggle();
  }, [samplePreview]);
  
  const handleStop = useCallback(() => {
    samplePreview?.stop();
  }, [samplePreview]);
  
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    samplePreview?.setVolume(newVolume);
  }, [samplePreview]);
  
  const handleLoopToggle = useCallback(() => {
    const newLoop = !isLooping;
    setIsLooping(newLoop);
    samplePreview?.setLoop(newLoop);
  }, [isLooping, samplePreview]);
  
  // Get files to display based on view mode
  const displayFiles = viewMode === 'browser' 
    ? files 
    : viewMode === 'favorites'
    ? allSampleFiles.filter(f => favorites.has(f.path))
    : allSampleFiles.filter(f => recentSamples.includes(f.path));
  
  return (
    <div className="sample-browser flex flex-col h-full bg-daw-bg-secondary text-daw-text-primary">
      {/* View Mode Tabs */}
      <div className="flex border-b border-daw-border">
        {(['browser', 'favorites', 'recent'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 px-2 py-2 text-xs border-b-2 transition-colors ${
              viewMode === mode
                ? 'bg-daw-bg-surface text-daw-text-primary border-daw-accent-primary'
                : 'text-daw-text-muted border-transparent hover:text-daw-text-secondary hover:bg-daw-bg-hover/30'
            }`}
          >
            {mode === 'favorites' ? 'Favoris' : mode === 'recent' ? 'Récents' : 'Explorateur'}
          </button>
        ))}
      </div>
      
      {/* Path breadcrumb */}
      {viewMode === 'browser' && (
        <div className="px-2 py-2 text-xs text-daw-text-muted border-b border-daw-border truncate">
          {currentPath}
        </div>
      )}

      {manifestError && viewMode === 'browser' && (
        <div className="px-2 py-2 text-xs text-daw-accent-warning border-b border-daw-border">
          Impossible de charger la liste des samples : {manifestError}
        </div>
      )}
      
      {/* File list */}
      <div className="flex-1 overflow-y-auto p-1">
        {displayFiles.length === 0 ? (
          <div className="p-4 text-center text-daw-text-muted text-sm">
            {viewMode === 'favorites' ? 'Aucun favori pour le moment' : 
             viewMode === 'recent' ? 'Aucun sample récent' : 
             'Aucun fichier trouvé'}
          </div>
        ) : (
          displayFiles.map(file => (
            <SampleFileItem
              key={file.path}
              file={file}
              isSelected={selectedFile?.path === file.path}
              isFavorite={favorites.has(file.path)}
              onSelect={() => handleFileSelect(file)}
              onDoubleClick={() => handleFileDoubleClick(file)}
              onToggleFavorite={() => handleToggleFavorite(file.path)}
              onDragStart={(e) => handleDragStart(e, file)}
            />
          ))
        )}
      </div>
      
      {/* Preview section */}
      <div className="border-t border-daw-border p-2">
        {/* Waveform */}
        <WaveformDisplay
          waveformData={waveformData}
          isPlaying={isPlaying}
        />
        
        {/* Sample info */}
        <SampleInfoDisplay info={sampleInfo} />
        
        {/* Playback controls */}
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant={isPlaying ? 'success' : 'primary'}
            size="sm"
            onClick={handlePlayPause}
            disabled={!sampleInfo}
            icon={
              isPlaying ? (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" /></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )
            }
          >
            {isPlaying ? 'Pause' : 'Lecture'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleStop}
            disabled={!isPlaying}
            icon={<svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>}
          >
            Stop
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLoopToggle}
            active={isLooping}
            tooltip="Boucle"
            icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 1l4 4-4 4" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 11V9a4 4 0 014-4h14" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 23l-4-4 4-4" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13v2a4 4 0 01-4 4H3" /></svg>}
          />

          <div className="flex-1" />

          <span className="text-[10px] text-daw-text-muted">Vol</span>
          <Slider
            size="sm"
            value={Math.round(volume * 100)}
            min={0}
            max={100}
            step={1}
            showValue={false}
            onChange={(v) => {
              const next = (typeof v === 'number' ? v : v[1]) / 100;
              setVolume(next);
              samplePreview?.setVolume(next);
            }}
            className="w-20"
          />
        </div>
      </div>
    </div>
  );
});

SampleBrowser.displayName = 'SampleBrowser';

export default SampleBrowser;