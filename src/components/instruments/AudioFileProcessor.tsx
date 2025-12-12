// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * AudioFileProcessor UI Component - Interface de lecteur d'échantillons
 * Affichage de forme d'onde avec marqueurs de boucle et navigateur de fichiers
 */

import React, { useCallback, useState, useRef, memo, useMemo, useEffect } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';
import { LoopMode, InterpolationMode } from '../../audio/instruments/AudioFileProcessor';

// Note names for base note selector
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteNumberToName(note: number): string {
  const octave = Math.floor(note / 12) - 1;
  const noteName = NOTE_NAMES[note % 12];
  return `${noteName}${octave}`;
}

interface AFPParams {
  [key: string]: number;
}

interface AFPPreset {
  name: string;
  params: Partial<AFPParams>;
}

interface SampleInfo {
  fileName: string;
  duration: number;
  sampleRate: number;
  channels: number;
}

interface AudioFileProcessorProps {
  params: AFPParams;
  onParamChange: (key: string, value: number) => void;
  presets?: AFPPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  sampleData?: Float32Array | null;
  sampleInfo?: SampleInfo | null;
  onLoadFile?: (file: File) => void;
  onTrigger?: () => void;
}

/**
 * Affichage de forme d'onde avec marqueurs de boucle
 */
const WaveformDisplay: React.FC<{
  data: Float32Array | null;
  startPoint: number;
  endPoint: number;
  loopStart: number;
  loopEnd: number;
  loopMode: number;
  onStartPointChange: (value: number) => void;
  onEndPointChange: (value: number) => void;
  onLoopStartChange: (value: number) => void;
  onLoopEndChange: (value: number) => void;
}> = memo(({
  data,
  startPoint,
  endPoint,
  loopStart,
  loopEnd,
  loopMode,
  onStartPointChange,
  onEndPointChange,
  onLoopStartChange,
  onLoopEndChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(0);
  
  const width = 500;
  const height = 120;
  
  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw center line
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    if (!data || data.length === 0) {
      // Draw placeholder text
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Déposez un fichier audio ici ou cliquez pour charger', width / 2, height / 2);
      return;
    }
    
    // Calculate visible range
    const visibleStart = offset;
    const visibleEnd = Math.min(1, offset + 1 / zoom);
    const startSample = Math.floor(visibleStart * data.length);
    const endSample = Math.floor(visibleEnd * data.length);
    const samplesPerPixel = (endSample - startSample) / width;
    
    // Draw waveform
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    for (let x = 0; x < width; x++) {
      const sampleIndex = startSample + Math.floor(x * samplesPerPixel);
      
      // Find min/max in this pixel's range
      let min = 0;
      let max = 0;
      const rangeEnd = Math.min(sampleIndex + Math.ceil(samplesPerPixel), data.length);
      
      for (let i = sampleIndex; i < rangeEnd; i++) {
        const sample = data[i] || 0;
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }
      
      const yMin = height / 2 - min * (height / 2 - 5);
      const yMax = height / 2 - max * (height / 2 - 5);
      
      if (x === 0) {
        ctx.moveTo(x, yMin);
      }
      ctx.lineTo(x, yMin);
      ctx.lineTo(x, yMax);
    }
    
    ctx.stroke();
    
    // Draw start/end points
    const startX = ((startPoint / 100) - visibleStart) * zoom * width;
    const endX = ((endPoint / 100) - visibleStart) * zoom * width;
    
    // Start region (before start point)
    if (startX > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, startX, height);
    }
    
    // End region (after end point)
    if (endX < width) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(endX, 0, width - endX, height);
    }
    
    // Draw loop region if enabled
    if (loopMode !== LoopMode.Off) {
      const loopStartX = ((startPoint / 100) + (loopStart / 100) * ((endPoint - startPoint) / 100) - visibleStart) * zoom * width;
      const loopEndX = ((startPoint / 100) + (loopEnd / 100) * ((endPoint - startPoint) / 100) - visibleStart) * zoom * width;
      
      // Loop region highlight
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.fillRect(loopStartX, 0, loopEndX - loopStartX, height);
      
      // Loop markers
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      
      // Loop start marker
      ctx.beginPath();
      ctx.moveTo(loopStartX, 0);
      ctx.lineTo(loopStartX, height);
      ctx.stroke();
      
      // Loop end marker
      ctx.beginPath();
      ctx.moveTo(loopEndX, 0);
      ctx.lineTo(loopEndX, height);
      ctx.stroke();
    }
    
    // Draw start/end markers
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    
    // Start marker
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    ctx.stroke();
    
    // End marker
    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, height);
    ctx.stroke();
    
  }, [data, startPoint, endPoint, loopStart, loopEnd, loopMode, zoom, offset, width, height]);
  
  // Handle mouse events for dragging markers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const pos = (x / width) / zoom + offset;
    
    // Check which marker is closest
    const startPos = startPoint / 100;
    const endPos = endPoint / 100;
    const loopStartPos = startPos + (loopStart / 100) * (endPos - startPos);
    const loopEndPos = startPos + (loopEnd / 100) * (endPos - startPos);
    
    const threshold = 0.02;
    
    if (Math.abs(pos - startPos) < threshold) {
      setDragging('start');
    } else if (Math.abs(pos - endPos) < threshold) {
      setDragging('end');
    } else if (loopMode !== LoopMode.Off && Math.abs(pos - loopStartPos) < threshold) {
      setDragging('loopStart');
    } else if (loopMode !== LoopMode.Off && Math.abs(pos - loopEndPos) < threshold) {
      setDragging('loopEnd');
    }
  }, [startPoint, endPoint, loopStart, loopEnd, loopMode, zoom, offset, width]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const pos = Math.max(0, Math.min(1, (x / width) / zoom + offset)) * 100;
    
    switch (dragging) {
      case 'start':
        onStartPointChange(Math.min(pos, endPoint - 1));
        break;
      case 'end':
        onEndPointChange(Math.max(pos, startPoint + 1));
        break;
      case 'loopStart':
        onLoopStartChange(Math.min(pos, loopEnd - 1));
        break;
      case 'loopEnd':
        onLoopEndChange(Math.max(pos, loopStart + 1));
        break;
    }
  }, [dragging, startPoint, endPoint, loopStart, loopEnd, zoom, offset, width, onStartPointChange, onEndPointChange, onLoopStartChange, onLoopEndChange]);
  
  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);
  
  return (
    <div ref={containerRef} className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded border border-daw-border cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      
      {/* Contrôles de zoom */}
      <div className="absolute top-2 right-2 flex gap-1">
        <button
          className="w-6 h-6 bg-daw-bg-elevated rounded text-xs hover:bg-daw-bg-surface"
          onClick={() => setZoom(Math.max(1, zoom / 2))}
        >
          -
        </button>
        <button
          className="w-6 h-6 bg-daw-bg-elevated rounded text-xs hover:bg-daw-bg-surface"
          onClick={() => setZoom(Math.min(16, zoom * 2))}
        >
          +
        </button>
      </div>
      
      {/* Légende */}
      <div className="flex gap-4 mt-2 text-xs text-daw-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-red-500"></span> Début
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-green-500"></span> Fin
        </span>
        {loopMode !== LoopMode.Off && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-500"></span> Boucle
          </span>
        )}
      </div>
    </div>
  );
});

WaveformDisplay.displayName = 'WaveformDisplay';

/**
 * Composant d'affichage d'enveloppe
 */
const EnvelopeDisplay: React.FC<{
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}> = memo(({ attack, decay, sustain, release }) => {
  const width = 120;
  const height = 50;
  
  const pathD = useMemo(() => {
    const totalTime = attack + decay + 200 + release;
    const scale = width / totalTime;
    
    const attackX = attack * scale;
    const decayX = attackX + decay * scale;
    const sustainX = decayX + 200 * scale;
    const releaseX = sustainX + release * scale;
    
    const sustainY = height - (sustain / 100) * (height - 10);
    
    return `M 0 ${height} L ${attackX} 10 L ${decayX} ${sustainY} L ${sustainX} ${sustainY} L ${releaseX} ${height}`;
  }, [attack, decay, sustain, release]);
  
  return (
    <svg width={width} height={height} className="bg-daw-bg-primary rounded border border-daw-border">
      <path d={pathD} fill="none" stroke="#4ade80" strokeWidth={2} />
    </svg>
  );
});

EnvelopeDisplay.displayName = 'EnvelopeDisplay';

/**
 * Interface utilisateur de l'instrument AudioFileProcessor
 */
export const AudioFileProcessorUI: React.FC<AudioFileProcessorProps> = memo(({
  params,
  onParamChange,
  presets = [],
  onPresetSelect,
  currentPresetIndex = -1,
  sampleData,
  sampleInfo,
  onLoadFile,
  onTrigger,
}) => {
  const [showPresets, setShowPresets] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onLoadFile) {
      onLoadFile(file);
    }
  }, [onLoadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && onLoadFile) {
      onLoadFile(file);
    }
  }, [onLoadFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  return (
    <div className="bg-daw-bg-secondary rounded-lg p-4 border border-daw-border">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">AFP</span>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">AudioFileProcessor</h3>
            <p className="text-xs text-daw-text-muted">Lecteur d'échantillons</p>
          </div>
        </div>
        
        {/* Sélecteur de préréglages */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPresets(!showPresets)}
          >
            {currentPresetIndex >= 0 ? presets[currentPresetIndex]?.name : 'Préréglages'}
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </Button>
          
          {showPresets && presets.length > 0 && (
            <div className="absolute right-0 top-full mt-1 bg-daw-bg-elevated border border-daw-border rounded-lg shadow-xl z-50 min-w-[150px] py-1">
              {presets.map((preset, index) => (
                <button
                  key={index}
                  className={`w-full px-3 py-1.5 text-sm text-left hover:bg-daw-bg-surface ${
                    index === currentPresetIndex ? 'text-green-400' : 'text-daw-text-secondary'
                  }`}
                  onClick={() => {
                    onPresetSelect?.(index);
                    setShowPresets(false);
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info fichier et chargeur */}
      <div 
        className="bg-daw-bg-surface rounded p-3 mb-4 cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        
        {sampleInfo ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-daw-text-primary font-medium">{sampleInfo.fileName}</div>
              <div className="text-xs text-daw-text-muted">
                {formatDuration(sampleInfo.duration)} • {sampleInfo.sampleRate}Hz • {sampleInfo.channels}ch
              </div>
            </div>
            <Button variant="ghost" size="sm">
              Changer
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <svg className="w-8 h-8 mx-auto mb-2 text-daw-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="text-sm text-daw-text-muted">Cliquez ou déposez un fichier audio</div>
          </div>
        )}
      </div>

      {/* Affichage de forme d'onde */}
      <div className="mb-4">
        <WaveformDisplay
          data={sampleData || null}
          startPoint={params.startPoint || 0}
          endPoint={params.endPoint || 100}
          loopStart={params.loopStart || 0}
          loopEnd={params.loopEnd || 100}
          loopMode={params.loopMode || 0}
          onStartPointChange={(v) => onParamChange('startPoint', v)}
          onEndPointChange={(v) => onParamChange('endPoint', v)}
          onLoopStartChange={(v) => onParamChange('loopStart', v)}
          onLoopEndChange={(v) => onParamChange('loopEnd', v)}
        />
      </div>

      {/* Grille de contrôles */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Section enveloppe */}
        <div className="bg-daw-bg-surface rounded p-3">
          <div className="text-xs text-daw-text-muted mb-2">Enveloppe</div>
          <div className="flex justify-center mb-2">
            <EnvelopeDisplay
              attack={params.attack || 0}
              decay={params.decay || 0}
              sustain={params.sustain || 100}
              release={params.release || 0}
            />
          </div>
          <div className="grid grid-cols-4 gap-1">
            <Knob
              value={params.attack || 0}
              min={0}
              max={5000}
              onChange={(v) => onParamChange('attack', v)}
              size="xs"
              label="A"
            />
            <Knob
              value={params.decay || 0}
              min={0}
              max={5000}
              onChange={(v) => onParamChange('decay', v)}
              size="xs"
              label="D"
            />
            <Knob
              value={params.sustain || 100}
              min={0}
              max={100}
              onChange={(v) => onParamChange('sustain', v)}
              size="xs"
              label="S"
            />
            <Knob
              value={params.release || 0}
              min={0}
              max={5000}
              onChange={(v) => onParamChange('release', v)}
              size="xs"
              label="R"
            />
          </div>
        </div>

        {/* Section boucle */}
        <div className="bg-daw-bg-surface rounded p-3">
          <div className="text-xs text-daw-text-muted mb-2">Boucle</div>
          <div className="mb-2">
            <select
              className="w-full bg-daw-bg-primary border border-daw-border rounded px-2 py-1 text-xs text-daw-text-secondary"
              value={params.loopMode || 0}
              onChange={(e) => onParamChange('loopMode', parseInt(e.target.value))}
            >
              <option value={LoopMode.Off}>Désactivé</option>
              <option value={LoopMode.Forward}>Avant</option>
              <option value={LoopMode.PingPong}>Ping-Pong</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Knob
              value={params.loopStart || 0}
              min={0}
              max={100}
              onChange={(v) => onParamChange('loopStart', v)}
              size="sm"
              label="Début"
              disabled={params.loopMode === LoopMode.Off}
            />
            <Knob
              value={params.loopEnd || 100}
              min={0}
              max={100}
              onChange={(v) => onParamChange('loopEnd', v)}
              size="sm"
              label="Fin"
              disabled={params.loopMode === LoopMode.Off}
            />
          </div>
        </div>

        {/* Section lecture */}
        <div className="bg-daw-bg-surface rounded p-3">
          <div className="text-xs text-daw-text-muted mb-2">Lecture</div>
          <div className="flex items-center gap-2 mb-2">
            <button
              className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                params.reverse > 0.5
                  ? 'bg-green-500 text-white'
                  : 'bg-daw-bg-primary text-daw-text-secondary hover:bg-daw-bg-elevated'
              }`}
              onClick={() => onParamChange('reverse', params.reverse > 0.5 ? 0 : 1)}
            >
              Inverser
            </button>
            <select
              className="flex-1 bg-daw-bg-primary border border-daw-border rounded px-2 py-1 text-xs text-daw-text-secondary"
              value={params.interpolation || 1}
              onChange={(e) => onParamChange('interpolation', parseInt(e.target.value))}
            >
              <option value={InterpolationMode.None}>Sans interp.</option>
              <option value={InterpolationMode.Linear}>Linéaire</option>
              <option value={InterpolationMode.Cubic}>Cubique</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Knob
              value={params.startPoint || 0}
              min={0}
              max={100}
              onChange={(v) => onParamChange('startPoint', v)}
              size="sm"
              label="Début"
            />
            <Knob
              value={params.endPoint || 100}
              min={0}
              max={100}
              onChange={(v) => onParamChange('endPoint', v)}
              size="sm"
              label="Fin"
            />
          </div>
        </div>
      </div>

      {/* Rangée du bas */}
      <div className="grid grid-cols-3 gap-4">
        {/* Section accordage */}
        <div className="bg-daw-bg-surface rounded p-3">
          <div className="text-xs text-daw-text-muted mb-2">Accordage</div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <span className="text-xs text-daw-text-muted">Note de base</span>
              <select
                className="w-full bg-daw-bg-primary border border-daw-border rounded px-2 py-1 text-xs text-daw-text-secondary mt-1"
                value={params.baseNote || 60}
                onChange={(e) => onParamChange('baseNote', parseInt(e.target.value))}
              >
                {Array.from({ length: 128 }, (_, i) => (
                  <option key={i} value={i}>{noteNumberToName(i)} ({i})</option>
                ))}
              </select>
            </div>
            <Knob
              value={params.tune || 0}
              min={-100}
              max={100}
              onChange={(v) => onParamChange('tune', v)}
              size="sm"
              label="Fin"
              bipolar
            />
          </div>
        </div>

        {/* Section bégaiement */}
        <div className="bg-daw-bg-surface rounded p-3">
          <div className="text-xs text-daw-text-muted mb-2">Bégaiement</div>
          <div className="flex items-center gap-2">
            <button
              className={`px-3 py-1 text-xs rounded transition-colors ${
                params.stutterEnabled > 0.5
                  ? 'bg-purple-500 text-white'
                  : 'bg-daw-bg-primary text-daw-text-secondary hover:bg-daw-bg-elevated'
              }`}
              onClick={() => onParamChange('stutterEnabled', params.stutterEnabled > 0.5 ? 0 : 1)}
            >
              {params.stutterEnabled > 0.5 ? 'ON' : 'OFF'}
            </button>
            <Knob
              value={params.stutterSpeed || 50}
              min={0}
              max={100}
              onChange={(v) => onParamChange('stutterSpeed', v)}
              size="sm"
              label="Vitesse"
              disabled={params.stutterEnabled <= 0.5}
            />
          </div>
        </div>

        {/* Section sortie */}
        <div className="bg-daw-bg-surface rounded p-3">
          <div className="text-xs text-daw-text-muted mb-2">Sortie</div>
          <div className="flex items-center justify-center">
            <Knob
              value={params.amplitude || 100}
              min={0}
              max={200}
              onChange={(v) => onParamChange('amplitude', v)}
              size="md"
              label="Amplitude"
            />
          </div>
        </div>
      </div>

      {/* Bouton de déclenchement */}
      {onTrigger && (
        <div className="flex justify-center mt-4">
          <Button
            variant="primary"
            size="lg"
            onClick={onTrigger}
            className="px-8 bg-green-500 hover:bg-green-600"
            disabled={!sampleData}
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Déclencher
          </Button>
        </div>
      )}
    </div>
  );
});

AudioFileProcessorUI.displayName = 'AudioFileProcessorUI';

export default AudioFileProcessorUI;
