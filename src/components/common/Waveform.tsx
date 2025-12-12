// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Waveform - Canvas-based waveform display component
 * Features: Zoom, scroll, selection, playhead, loop region display
 */

import React, { useRef, useEffect, useState, useCallback, memo } from 'react';

export interface WaveformProps {
  /** Audio data (normalized -1 to 1) */
  audioData?: Float32Array | number[];
  /** Sample rate of the audio */
  sampleRate?: number;
  /** Duration in seconds */
  duration?: number;
  /** Current playhead position (0-1 normalized) */
  playheadPosition?: number;
  /** Selection start (0-1 normalized) */
  selectionStart?: number;
  /** Selection end (0-1 normalized) */
  selectionEnd?: number;
  /** Loop region start (0-1 normalized) */
  loopStart?: number;
  /** Loop region end (0-1 normalized) */
  loopEnd?: number;
  /** Show loop region */
  showLoop?: boolean;
  /** Zoom level (1 = fit to width) */
  zoom?: number;
  /** Scroll offset (0-1 normalized) */
  scrollOffset?: number;
  /** Waveform color */
  color?: string;
  /** Background color */
  backgroundColor?: string;
  /** Playhead color */
  playheadColor?: string;
  /** Selection color */
  selectionColor?: string;
  /** Loop region color */
  loopColor?: string;
  /** Height of the component */
  height?: number;
  /** Show center line */
  showCenterLine?: boolean;
  /** Show time markers */
  showTimeMarkers?: boolean;
  /** Enable selection */
  enableSelection?: boolean;
  /** Selection change callback */
  onSelectionChange?: (start: number, end: number) => void;
  /** Click callback (position 0-1) */
  onClick?: (position: number) => void;
  /** Additional CSS classes */
  className?: string;
}

// Format time as mm:ss.ms
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export const Waveform = memo<WaveformProps>(({
  audioData,
  sampleRate = 44100,
  duration = 0,
  playheadPosition = 0,
  selectionStart,
  selectionEnd,
  loopStart = 0,
  loopEnd = 1,
  showLoop = false,
  zoom = 1,
  scrollOffset = 0,
  color = '#4a90d9',
  backgroundColor = '#1a1a2e',
  playheadColor = '#ffffff',
  selectionColor = 'rgba(74, 144, 217, 0.3)',
  loopColor = 'rgba(74, 217, 128, 0.2)',
  height = 80,
  showCenterLine = true,
  showTimeMarkers = true,
  enableSelection = true,
  onSelectionChange,
  onClick,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState(0);
  const [localSelection, setLocalSelection] = useState<{ start: number; end: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Calculate visible range based on zoom and scroll
  const visibleStart = scrollOffset;
  const visibleEnd = Math.min(1, scrollOffset + 1 / zoom);
  const visibleRange = visibleEnd - visibleStart;

  // Resize observer for container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(container);
    setContainerWidth(container.clientWidth);

    return () => resizeObserver.disconnect();
  }, []);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const canvasHeight = canvas.height;
    const centerY = canvasHeight / 2;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, canvasHeight);

    // Draw center line
    if (showCenterLine) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
    }

    // Draw loop region
    if (showLoop && loopStart !== undefined && loopEnd !== undefined) {
      const loopStartX = ((loopStart - visibleStart) / visibleRange) * width;
      const loopEndX = ((loopEnd - visibleStart) / visibleRange) * width;
      
      if (loopEndX > 0 && loopStartX < width) {
        ctx.fillStyle = loopColor;
        ctx.fillRect(
          Math.max(0, loopStartX),
          0,
          Math.min(width, loopEndX) - Math.max(0, loopStartX),
          canvasHeight
        );
        
        // Loop markers
        ctx.strokeStyle = 'rgba(74, 217, 128, 0.8)';
        ctx.lineWidth = 2;
        
        if (loopStartX >= 0 && loopStartX <= width) {
          ctx.beginPath();
          ctx.moveTo(loopStartX, 0);
          ctx.lineTo(loopStartX, canvasHeight);
          ctx.stroke();
        }
        
        if (loopEndX >= 0 && loopEndX <= width) {
          ctx.beginPath();
          ctx.moveTo(loopEndX, 0);
          ctx.lineTo(loopEndX, canvasHeight);
          ctx.stroke();
        }
      }
    }

    // Draw selection
    const selection = localSelection || (selectionStart !== undefined && selectionEnd !== undefined 
      ? { start: selectionStart, end: selectionEnd } 
      : null);
    
    if (selection) {
      const selStartX = ((selection.start - visibleStart) / visibleRange) * width;
      const selEndX = ((selection.end - visibleStart) / visibleRange) * width;
      
      if (selEndX > 0 && selStartX < width) {
        ctx.fillStyle = selectionColor;
        ctx.fillRect(
          Math.max(0, selStartX),
          0,
          Math.min(width, selEndX) - Math.max(0, selStartX),
          canvasHeight
        );
      }
    }

    // Draw waveform
    if (audioData && audioData.length > 0) {
      const data = audioData instanceof Float32Array ? audioData : new Float32Array(audioData);
      const samplesPerPixel = Math.ceil((data.length * visibleRange) / width);
      const startSample = Math.floor(visibleStart * data.length);
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let x = 0; x < width; x++) {
        const sampleIndex = startSample + Math.floor(x * samplesPerPixel);
        
        // Find min/max in this pixel's sample range
        let min = 0;
        let max = 0;
        
        for (let i = 0; i < samplesPerPixel && sampleIndex + i < data.length; i++) {
          const sample = data[sampleIndex + i] || 0;
          if (sample < min) min = sample;
          if (sample > max) max = sample;
        }
        
        const minY = centerY - min * centerY;
        const maxY = centerY - max * centerY;
        
        if (x === 0) {
          ctx.moveTo(x, minY);
        }
        ctx.lineTo(x, minY);
        ctx.lineTo(x, maxY);
      }
      
      ctx.stroke();
      
      // Fill waveform
      ctx.fillStyle = color + '40'; // Add transparency
      ctx.beginPath();
      
      for (let x = 0; x < width; x++) {
        const sampleIndex = startSample + Math.floor(x * samplesPerPixel);
        let max = 0;
        
        for (let i = 0; i < samplesPerPixel && sampleIndex + i < data.length; i++) {
          const sample = Math.abs(data[sampleIndex + i] || 0);
          if (sample > max) max = sample;
        }
        
        const y = centerY - max * centerY;
        
        if (x === 0) {
          ctx.moveTo(x, centerY);
          ctx.lineTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      // Mirror for bottom half
      for (let x = width - 1; x >= 0; x--) {
        const sampleIndex = startSample + Math.floor(x * samplesPerPixel);
        let max = 0;
        
        for (let i = 0; i < samplesPerPixel && sampleIndex + i < data.length; i++) {
          const sample = Math.abs(data[sampleIndex + i] || 0);
          if (sample > max) max = sample;
        }
        
        const y = centerY + max * centerY;
        ctx.lineTo(x, y);
      }
      
      ctx.closePath();
      ctx.fill();
    } else {
      // Draw placeholder
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No audio data', width / 2, centerY);
    }

    // Draw playhead
    if (playheadPosition >= visibleStart && playheadPosition <= visibleEnd) {
      const playheadX = ((playheadPosition - visibleStart) / visibleRange) * width;
      
      ctx.strokeStyle = playheadColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, canvasHeight);
      ctx.stroke();
      
      // Playhead triangle
      ctx.fillStyle = playheadColor;
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
    }

  }, [
    audioData, containerWidth, height, zoom, scrollOffset,
    playheadPosition, selectionStart, selectionEnd, localSelection,
    loopStart, loopEnd, showLoop, showCenterLine,
    color, backgroundColor, playheadColor, selectionColor, loopColor,
    visibleStart, visibleEnd, visibleRange
  ]);

  // Handle mouse events for selection
  const getPositionFromEvent = useCallback((e: React.MouseEvent): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const normalizedX = x / rect.width;
    
    return visibleStart + normalizedX * visibleRange;
  }, [visibleStart, visibleRange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!enableSelection) {
      const position = getPositionFromEvent(e);
      onClick?.(position);
      return;
    }
    
    const position = getPositionFromEvent(e);
    setIsSelecting(true);
    setSelectionAnchor(position);
    setLocalSelection({ start: position, end: position });
  }, [enableSelection, getPositionFromEvent, onClick]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting) return;
    
    const position = getPositionFromEvent(e);
    const start = Math.min(selectionAnchor, position);
    const end = Math.max(selectionAnchor, position);
    
    setLocalSelection({ start, end });
  }, [isSelecting, selectionAnchor, getPositionFromEvent]);

  const handleMouseUp = useCallback(() => {
    if (!isSelecting) return;
    
    setIsSelecting(false);
    
    if (localSelection) {
      if (Math.abs(localSelection.end - localSelection.start) < 0.001) {
        // Click, not drag
        onClick?.(localSelection.start);
        setLocalSelection(null);
      } else {
        onSelectionChange?.(localSelection.start, localSelection.end);
      }
    }
  }, [isSelecting, localSelection, onClick, onSelectionChange]);

  const handleMouseLeave = useCallback(() => {
    if (isSelecting) {
      handleMouseUp();
    }
  }, [isSelecting, handleMouseUp]);

  // Time markers
  const renderTimeMarkers = useCallback(() => {
    if (!showTimeMarkers || duration <= 0) return null;
    
    const markerCount = Math.min(10, Math.ceil(duration / zoom));
    const markers = [];
    
    for (let i = 0; i <= markerCount; i++) {
      const position = visibleStart + (i / markerCount) * visibleRange;
      const time = position * duration;
      
      markers.push(
        <span
          key={i}
          className="absolute text-[9px] text-daw-text-muted transform -translate-x-1/2"
          style={{ left: `${(i / markerCount) * 100}%` }}
        >
          {formatTime(time)}
        </span>
      );
    }
    
    return (
      <div className="relative h-4 border-t border-daw-border">
        {markers}
      </div>
    );
  }, [showTimeMarkers, duration, zoom, visibleStart, visibleRange]);

  return (
    <div 
      ref={containerRef}
      className={`flex flex-col bg-daw-bg-primary rounded overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        width={containerWidth * (window.devicePixelRatio || 1)}
        height={height * (window.devicePixelRatio || 1)}
        style={{ width: '100%', height }}
        className="cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      {renderTimeMarkers()}
    </div>
  );
});

Waveform.displayName = 'Waveform';

export default Waveform;