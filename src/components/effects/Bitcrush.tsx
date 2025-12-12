// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Bitcrush UI Component - Visual interface for the Bitcrush effect
 */

import React, { useCallback, useState, useEffect, useRef, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

interface BitcrushParams {
  bitDepth: number;
  sampleRate: number;
  inputGain: number;
  outputGain: number;
  noiseGate: number;
  mix: number;
}

interface BitcrushPreset {
  name: string;
  params: Partial<BitcrushParams>;
}

interface BitcrushProps {
  params: BitcrushParams;
  onParamChange: (key: keyof BitcrushParams, value: number) => void;
  presets?: BitcrushPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  bypassed?: boolean;
  onBypassToggle?: () => void;
  audioContext?: AudioContext;
}

const defaultPresets: BitcrushPreset[] = [
  { name: '8-bit Classic', params: { bitDepth: 8, sampleRate: 0.5, inputGain: 0, outputGain: 0, mix: 1 } },
  { name: '4-bit Retro', params: { bitDepth: 4, sampleRate: 0.25, inputGain: 3, outputGain: -3, mix: 1 } },
  { name: 'Lo-Fi', params: { bitDepth: 12, sampleRate: 0.3, inputGain: 0, outputGain: 0, noiseGate: 0.05, mix: 0.7 } },
  { name: 'Telephone', params: { bitDepth: 8, sampleRate: 0.18, inputGain: 6, outputGain: -6, noiseGate: 0.1, mix: 1 } },
  { name: 'Extreme Crush', params: { bitDepth: 2, sampleRate: 0.1, inputGain: 6, outputGain: -12, mix: 1 } },
];

/**
 * Waveform visualization showing the effect of bitcrushing
 */
const WaveformPreview: React.FC<{
  bitDepth: number;
  sampleRate: number;
}> = memo(({ bitDepth, sampleRate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    
    // Draw original sine wave (faded)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    for (let x = 0; x < width; x++) {
      const t = (x / width) * Math.PI * 4;
      const y = centerY - Math.sin(t) * (height / 2 - 8);
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Draw crushed waveform
    const levels = Math.pow(2, bitDepth);
    const sampleReduction = Math.max(1, Math.round(1 / Math.max(0.01, sampleRate)));
    
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    let lastSample = 0;
    let sampleCounter = 0;
    
    for (let x = 0; x < width; x++) {
      const t = (x / width) * Math.PI * 4;
      let sample = Math.sin(t);
      
      // Sample rate reduction
      if (sampleCounter >= sampleReduction) {
        sampleCounter = 0;
        // Bit depth reduction
        lastSample = Math.round((sample + 1) * 0.5 * (levels - 1)) / (levels - 1) * 2 - 1;
      }
      sampleCounter++;
      
      const y = centerY - lastSample * (height / 2 - 8);
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
  }, [bitDepth, sampleRate]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={60}
      className="bg-daw-bg-primary rounded border border-daw-border"
    />
  );
});

WaveformPreview.displayName = 'WaveformPreview';

/**
 * Bit depth visualization
 */
const BitDepthDisplay: React.FC<{
  bitDepth: number;
}> = memo(({ bitDepth }) => {
  const levels = Math.pow(2, Math.round(bitDepth));
  const displayLevels = Math.min(16, levels);
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5">
        {Array.from({ length: displayLevels }).map((_, i) => (
          <div
            key={i}
            className="w-1.5 bg-purple-500"
            style={{
              height: `${4 + (i / (displayLevels - 1)) * 20}px`,
              opacity: 0.5 + (i / (displayLevels - 1)) * 0.5,
            }}
          />
        ))}
      </div>
      <span className="text-xs text-daw-text-muted">{levels} niveaux</span>
    </div>
  );
});

BitDepthDisplay.displayName = 'BitDepthDisplay';

/**
 * Bitcrush effect UI
 */
export const BitcrushUI: React.FC<BitcrushProps> = memo(({
  params,
  onParamChange,
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
  bypassed = false,
  onBypassToggle,
  audioContext,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const handleKnobChange = useCallback((key: keyof BitcrushParams) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  // Calculate effective sample rate
  const effectiveSampleRate = audioContext 
    ? Math.round(audioContext.sampleRate / Math.max(1, Math.round(1 / Math.max(0.01, params.sampleRate))))
    : Math.round(44100 * params.sampleRate);

  return (
    <div className={`bg-daw-bg-secondary rounded-lg p-4 border border-daw-border ${bypassed ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Bitcrush</h3>
            <p className="text-xs text-daw-text-muted">Dégradation Lo-Fi</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Bypass button */}
          {onBypassToggle && (
            <Button
              variant={bypassed ? 'ghost' : 'secondary'}
              size="sm"
              onClick={onBypassToggle}
            >
              {bypassed ? 'OFF' : 'ON'}
            </Button>
          )}
          
          {/* Preset selector */}
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
            
            {showPresets && (
              <div className="absolute right-0 top-full mt-1 bg-daw-bg-elevated border border-daw-border rounded-lg shadow-xl z-50 min-w-[150px] py-1">
                {presets.map((preset, index) => (
                  <button
                    key={index}
                    className={`w-full px-3 py-1.5 text-sm text-left hover:bg-daw-bg-surface ${
                      index === currentPresetIndex ? 'text-purple-400' : 'text-daw-text-secondary'
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
      </div>

      {/* Waveform Preview */}
      <div className="flex justify-center mb-4">
        <WaveformPreview
          bitDepth={params.bitDepth}
          sampleRate={params.sampleRate}
        />
      </div>

      {/* Main controls */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Bit Depth section */}
        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide text-center">Profondeur de bits</h4>
          <div className="flex flex-col items-center gap-3">
            <Knob
              value={params.bitDepth}
              min={1}
              max={16}
              step={1}
              onChange={handleKnobChange('bitDepth')}
              size="lg"
              label="Bits"
              unit=" bit"
            />
            <BitDepthDisplay bitDepth={params.bitDepth} />
          </div>
        </div>

        {/* Sample Rate section */}
        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide text-center">Taux d'échantillonnage</h4>
          <div className="flex flex-col items-center gap-2">
            <Knob
              value={params.sampleRate}
              min={0.01}
              max={1}
              step={0.01}
              onChange={handleKnobChange('sampleRate')}
              size="lg"
              label="Taux"
              valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
            <span className="text-xs text-daw-text-muted">
              ~{(effectiveSampleRate / 1000).toFixed(1)} kHz
            </span>
          </div>
        </div>
      </div>

      {/* Gain controls */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide text-center">Entrée</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.inputGain}
              min={-24}
              max={24}
              step={0.5}
              onChange={handleKnobChange('inputGain')}
              size="md"
              label="Gain"
              unit=" dB"
            />
          </div>
        </div>

        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide text-center">Porte</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.noiseGate}
              min={0}
              max={0.5}
              step={0.01}
              onChange={handleKnobChange('noiseGate')}
              size="md"
              label="Seuil"
              valueFormatter={(v: number) => v === 0 ? 'Off' : `${Math.round(v * 200)}%`}
            />
          </div>
        </div>

        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide text-center">Sortie</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.outputGain}
              min={-24}
              max={24}
              step={0.5}
              onChange={handleKnobChange('outputGain')}
              size="md"
              label="Gain"
              unit=" dB"
            />
          </div>
        </div>
      </div>

      {/* Mix */}
      <div className="bg-daw-bg-surface rounded p-3">
        <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide text-center">Mélange</h4>
        <div className="flex items-center gap-4">
          <span className="text-xs text-daw-text-muted">Sec</span>
          <div className="flex-1">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={params.mix}
              onChange={(e) => onParamChange('mix', parseFloat(e.target.value))}
              className="w-full h-2 bg-daw-bg-primary rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>
          <span className="text-xs text-daw-text-muted">Mouillé</span>
          <span className="text-xs text-daw-text-primary w-12 text-right">
            {Math.round(params.mix * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
});

BitcrushUI.displayName = 'BitcrushUI';

export default BitcrushUI;