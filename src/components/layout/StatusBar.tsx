// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * StatusBar - AnkhWave bottom status bar component
 * Features: Position display, selection info, zoom controls, notifications
 */

import React, { memo, useState, useCallback } from 'react';
import { useTransportStore, useSongStore, useUIStore } from '../../stores';
import { Button } from '../common';

export interface StatusBarProps {
  /** Additional CSS classes */
  className?: string;
}

// Format position as bars:beats:ticks
const formatPosition = (ticks: number, beatsPerBar: number = 4): string => {
  const ticksPerBeat = 480;
  const ticksPerBar = ticksPerBeat * beatsPerBar;
  
  const bars = Math.floor(ticks / ticksPerBar) + 1;
  const remainingTicks = ticks % ticksPerBar;
  const beats = Math.floor(remainingTicks / ticksPerBeat) + 1;
  const subTicks = remainingTicks % ticksPerBeat;
  
  return `${bars}:${beats}:${subTicks.toString().padStart(3, '0')}`;
};

// Format time as mm:ss.ms
const formatTime = (ticks: number, tempo: number): string => {
  const ticksPerBeat = 480;
  const secondsPerBeat = 60 / tempo;
  const seconds = (ticks / ticksPerBeat) * secondsPerBeat;
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export const StatusBar = memo<StatusBarProps>(({ className = '' }) => {
  const { position, tempo, isPlaying, isRecording } = useTransportStore();
  const { settings, metadata, isDirty } = useSongStore();
  const { zoom, activeEditor, zoomIn, zoomOut, resetZoom, selection } = useUIStore();
  
  const [cpuUsage, setCpuUsage] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [notifications, setNotifications] = useState<string[]>([]);

  // Simulate CPU/memory monitoring (in real app, this would come from audio engine)
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage(Math.random() * 30 + (isPlaying ? 20 : 5));
      setMemoryUsage(Math.random() * 10 + 40);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const zoomKey = React.useMemo(() => {
    switch (activeEditor) {
      case 'song':
        return 'songEditor' as const;
      case 'piano-roll':
      case 'pianoRoll':
        return 'pianoRoll' as const;
      case 'pattern':
        return 'patternEditor' as const;
      default:
        return 'horizontal' as const;
    }
  }, [activeEditor]);

  const currentZoom = zoom[zoomKey] || 1;

  const handleZoomIn = useCallback(() => {
    zoomIn(zoomKey);
  }, [zoomIn, zoomKey]);

  const handleZoomOut = useCallback(() => {
    zoomOut(zoomKey);
  }, [zoomOut, zoomKey]);

  const handleResetZoom = useCallback(() => {
    resetZoom(zoomKey);
  }, [resetZoom, zoomKey]);

  // Selection info
  const selectionInfo = React.useMemo(() => {
    const { selectedTrackIds, selectedClipIds, selectedNoteIds } = selection;
    const parts = [];
    
    if (selectedTrackIds.length > 0) {
      parts.push(`${selectedTrackIds.length} track${selectedTrackIds.length > 1 ? 's' : ''}`);
    }
    if (selectedClipIds.length > 0) {
      parts.push(`${selectedClipIds.length} clip${selectedClipIds.length > 1 ? 's' : ''}`);
    }
    if (selectedNoteIds.length > 0) {
      parts.push(`${selectedNoteIds.length} note${selectedNoteIds.length > 1 ? 's' : ''}`);
    }
    
    return parts.length > 0 ? parts.join(', ') : 'No selection';
  }, [selection]);

  return (
    <div className={`h-6 bg-daw-bg-secondary border-t border-daw-border flex items-center px-2 gap-4 text-xs select-none ${className}`}>
      {/* Status indicators */}
      <div className="flex items-center gap-2">
        {/* Audio status */}
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : isPlaying ? 'bg-green-500' : 'bg-daw-text-muted'}`} />
          <span className="text-daw-text-muted">
            {isRecording ? 'Recording' : isPlaying ? 'Playing' : 'Stopped'}
          </span>
        </div>
        
        {/* Dirty indicator */}
        {isDirty && (
          <span className="text-daw-accent-warning" title="Unsaved changes">
            ●
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-daw-border" />

      {/* Position display */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-daw-text-muted">Pos:</span>
          <span className="font-mono text-daw-text-secondary min-w-[70px]">
            {formatPosition(position, settings.timeSignature.numerator)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-daw-text-muted">Time:</span>
          <span className="font-mono text-daw-text-secondary min-w-[60px]">
            {formatTime(position, tempo)}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-daw-border" />

      {/* Selection info */}
      <div className="flex items-center gap-1">
        <span className="text-daw-text-muted">Selection:</span>
        <span className="text-daw-text-secondary">{selectionInfo}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <span className="text-daw-text-muted">Zoom:</span>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleZoomOut}
          disabled={currentZoom <= 0.1}
          title="Zoom Out"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </Button>
        <button
          className="px-1.5 py-0.5 text-daw-text-secondary font-mono min-w-[40px] text-center hover:bg-daw-bg-surface rounded"
          onClick={handleResetZoom}
          title="Reset Zoom"
        >
          {Math.round(currentZoom * 100)}%
        </button>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleZoomIn}
          disabled={currentZoom >= 10}
          title="Zoom In"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </Button>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-daw-border" />

      {/* Performance indicators */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1" title="CPU Usage">
          <span className="text-daw-text-muted">CPU:</span>
          <span className={`font-mono min-w-[35px] ${cpuUsage > 80 ? 'text-red-500' : cpuUsage > 50 ? 'text-yellow-500' : 'text-daw-text-secondary'}`}>
            {cpuUsage.toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center gap-1" title="Memory Usage">
          <span className="text-daw-text-muted">MEM:</span>
          <span className="font-mono text-daw-text-secondary min-w-[35px]">
            {memoryUsage.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-daw-border" />

      {/* Version */}
      <span className="text-daw-text-muted">
        AnkhWave v1.0.0
      </span>
    </div>
  );
});

StatusBar.displayName = 'StatusBar';

export default StatusBar;