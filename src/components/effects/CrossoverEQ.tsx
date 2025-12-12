// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * CrossoverEQ UI Component - Visual interface for the CrossoverEQ effect
 */

import React, { useCallback, useState, useEffect, useRef, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

interface CrossoverEQParams {
  freq1: number;
  freq2: number;
  freq3: number;
  lowGain: number;
  lowMidGain: number;
  highMidGain: number;
  highGain: number;
  lowMute: number;
  lowMidMute: number;
  highMidMute: number;
  highMute: number;
  lowSolo: number;
  lowMidSolo: number;
  highMidSolo: number;
  highSolo: number;
}

interface CrossoverEQPreset {
  name: string;
  params: Partial<CrossoverEQParams>;
}

interface CrossoverEQProps {
  params: CrossoverEQParams;
  onParamChange: (key: keyof CrossoverEQParams, value: number) => void;
  presets?: CrossoverEQPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  bypassed?: boolean;
  onBypassToggle?: () => void;
}

const defaultPresets: CrossoverEQPreset[] = [
  { name: 'Flat', params: { lowGain: 0, lowMidGain: 0, highMidGain: 0, highGain: 0 } },
  { name: 'Bass Boost', params: { lowGain: 6, lowMidGain: 0, highMidGain: 0, highGain: 0 } },
  { name: 'Treble Boost', params: { lowGain: 0, lowMidGain: 0, highMidGain: 0, highGain: 6 } },
  { name: 'Mid Scoop', params: { lowGain: 3, lowMidGain: -4, highMidGain: -4, highGain: 3 } },
  { name: 'Presence', params: { lowGain: 0, lowMidGain: 0, highMidGain: 4, highGain: 2 } },
];

const bandColors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'];
const bandNames = ['Grave', 'Grave-Médium', 'Aigu-Médium', 'Aigu'];

/**
 * Frequency response visualization
 */
const FrequencyDisplay: React.FC<{
  freq1: number;
  freq2: number;
  freq3: number;
  gains: number[];
  mutes: boolean[];
  solos: boolean[];
}> = memo(({ freq1, freq2, freq3, gains, mutes, solos }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = 20;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Frequency grid lines (logarithmic)
    const freqs = [100, 1000, 10000];
    freqs.forEach(freq => {
      const x = padding + (Math.log10(freq / 20) / Math.log10(20000 / 20)) * (width - padding * 2);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    });
    
    // dB grid lines
    for (let db = -24; db <= 24; db += 12) {
      const y = height / 2 - (db / 48) * (height - padding * 2);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    // Draw 0dB line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(padding, height / 2);
    ctx.lineTo(width - padding, height / 2);
    ctx.stroke();
    
    // Draw crossover frequency markers
    const crossovers = [freq1, freq2, freq3];
    crossovers.forEach((freq, i) => {
      const x = padding + (Math.log10(freq / 20) / Math.log10(20000 / 20)) * (width - padding * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(freq >= 1000 ? `${(freq / 1000).toFixed(1)}k` : `${freq}`, x, height - 5);
    });
    
    // Check if any band is soloed
    const anySolo = solos.some(s => s);
    
    // Draw band regions with gain
    const bandFreqs = [20, freq1, freq2, freq3, 20000];
    
    for (let i = 0; i < 4; i++) {
      const isMuted = mutes[i] || (anySolo && !solos[i]);
      if (isMuted) continue;
      
      const startFreq = bandFreqs[i];
      const endFreq = bandFreqs[i + 1];
      const gain = gains[i];
      
      const startX = padding + (Math.log10(startFreq / 20) / Math.log10(20000 / 20)) * (width - padding * 2);
      const endX = padding + (Math.log10(endFreq / 20) / Math.log10(20000 / 20)) * (width - padding * 2);
      const gainY = height / 2 - (gain / 48) * (height - padding * 2);
      
      // Fill band region
      ctx.fillStyle = `${bandColors[i]}33`;
      ctx.beginPath();
      ctx.moveTo(startX, height / 2);
      ctx.lineTo(startX, gainY);
      ctx.lineTo(endX, gainY);
      ctx.lineTo(endX, height / 2);
      ctx.closePath();
      ctx.fill();
      
      // Draw band line
      ctx.strokeStyle = bandColors[i];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, gainY);
      ctx.lineTo(endX, gainY);
      ctx.stroke();
    }
    
    // Draw frequency labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('100', padding + (Math.log10(100 / 20) / Math.log10(20000 / 20)) * (width - padding * 2), height - 5);
    ctx.fillText('1k', padding + (Math.log10(1000 / 20) / Math.log10(20000 / 20)) * (width - padding * 2), height - 5);
    ctx.fillText('10k', padding + (Math.log10(10000 / 20) / Math.log10(20000 / 20)) * (width - padding * 2), height - 5);
    
  }, [freq1, freq2, freq3, gains, mutes, solos]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={120}
      className="bg-daw-bg-primary rounded border border-daw-border"
    />
  );
});

FrequencyDisplay.displayName = 'FrequencyDisplay';

/**
 * Band control component
 */
const BandControl: React.FC<{
  name: string;
  color: string;
  gain: number;
  muted: boolean;
  soloed: boolean;
  onGainChange: (gain: number) => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
}> = memo(({ name, color, gain, muted, soloed, onGainChange, onMuteToggle, onSoloToggle }) => {
  return (
    <div className={`bg-daw-bg-surface rounded p-2 ${muted ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color }}>{name}</span>
        <div className="flex gap-1">
          <button
            className={`w-6 h-5 text-[10px] rounded ${muted ? 'bg-red-500 text-white' : 'bg-daw-bg-primary text-daw-text-muted'}`}
            onClick={onMuteToggle}
          >
            M
          </button>
          <button
            className={`w-6 h-5 text-[10px] rounded ${soloed ? 'bg-yellow-500 text-black' : 'bg-daw-bg-primary text-daw-text-muted'}`}
            onClick={onSoloToggle}
          >
            S
          </button>
        </div>
      </div>
      
      <div className="flex flex-col items-center">
        <Knob
          value={gain}
          min={-24}
          max={24}
          step={0.5}
          onChange={onGainChange}
          size="md"
          valueFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`}
        />
        <span className="text-[10px] text-daw-text-muted mt-1">dB</span>
      </div>
    </div>
  );
});

BandControl.displayName = 'BandControl';

/**
 * CrossoverEQ effect UI
 */
export const CrossoverEQUI: React.FC<CrossoverEQProps> = memo(({
  params,
  onParamChange,
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
  bypassed = false,
  onBypassToggle,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const handleParamChange = useCallback((key: keyof CrossoverEQParams) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  const gains = [params.lowGain, params.lowMidGain, params.highMidGain, params.highGain];
  const mutes = [params.lowMute > 0.5, params.lowMidMute > 0.5, params.highMidMute > 0.5, params.highMute > 0.5];
  const solos = [params.lowSolo > 0.5, params.lowMidSolo > 0.5, params.highMidSolo > 0.5, params.highSolo > 0.5];

  return (
    <div className={`bg-daw-bg-secondary rounded-lg p-4 border border-daw-border ${bypassed ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">CrossoverEQ</h3>
            <p className="text-xs text-daw-text-muted">Crossover 4 bandes</p>
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
                      index === currentPresetIndex ? 'text-orange-400' : 'text-daw-text-secondary'
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

      {/* Frequency Display */}
      <div className="flex justify-center mb-4">
        <FrequencyDisplay
          freq1={params.freq1}
          freq2={params.freq2}
          freq3={params.freq3}
          gains={gains}
          mutes={mutes}
          solos={solos}
        />
      </div>

      {/* Crossover Frequency Controls */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-daw-bg-surface rounded p-2">
          <h4 className="text-[10px] text-daw-text-muted mb-1 text-center uppercase">Séparation 1</h4>
          <Knob
            value={params.freq1}
            min={20}
            max={500}
            step={1}
            onChange={handleParamChange('freq1')}
            size="sm"
            valueFormatter={(v: number) => `${Math.round(v)}Hz`}
          />
        </div>
        
        <div className="bg-daw-bg-surface rounded p-2">
          <h4 className="text-[10px] text-daw-text-muted mb-1 text-center uppercase">Séparation 2</h4>
          <Knob
            value={params.freq2}
            min={200}
            max={5000}
            step={10}
            onChange={handleParamChange('freq2')}
            size="sm"
            valueFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`}
          />
        </div>
        
        <div className="bg-daw-bg-surface rounded p-2">
          <h4 className="text-[10px] text-daw-text-muted mb-1 text-center uppercase">Séparation 3</h4>
          <Knob
            value={params.freq3}
            min={2000}
            max={20000}
            step={100}
            onChange={handleParamChange('freq3')}
            size="sm"
            valueFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
          />
        </div>
      </div>

      {/* Band Controls */}
      <div className="grid grid-cols-4 gap-2">
        <BandControl
          name={bandNames[0]}
          color={bandColors[0]}
          gain={params.lowGain}
          muted={params.lowMute > 0.5}
          soloed={params.lowSolo > 0.5}
          onGainChange={handleParamChange('lowGain')}
          onMuteToggle={() => onParamChange('lowMute', params.lowMute > 0.5 ? 0 : 1)}
          onSoloToggle={() => onParamChange('lowSolo', params.lowSolo > 0.5 ? 0 : 1)}
        />
        
        <BandControl
          name={bandNames[1]}
          color={bandColors[1]}
          gain={params.lowMidGain}
          muted={params.lowMidMute > 0.5}
          soloed={params.lowMidSolo > 0.5}
          onGainChange={handleParamChange('lowMidGain')}
          onMuteToggle={() => onParamChange('lowMidMute', params.lowMidMute > 0.5 ? 0 : 1)}
          onSoloToggle={() => onParamChange('lowMidSolo', params.lowMidSolo > 0.5 ? 0 : 1)}
        />
        
        <BandControl
          name={bandNames[2]}
          color={bandColors[2]}
          gain={params.highMidGain}
          muted={params.highMidMute > 0.5}
          soloed={params.highMidSolo > 0.5}
          onGainChange={handleParamChange('highMidGain')}
          onMuteToggle={() => onParamChange('highMidMute', params.highMidMute > 0.5 ? 0 : 1)}
          onSoloToggle={() => onParamChange('highMidSolo', params.highMidSolo > 0.5 ? 0 : 1)}
        />
        
        <BandControl
          name={bandNames[3]}
          color={bandColors[3]}
          gain={params.highGain}
          muted={params.highMute > 0.5}
          soloed={params.highSolo > 0.5}
          onGainChange={handleParamChange('highGain')}
          onMuteToggle={() => onParamChange('highMute', params.highMute > 0.5 ? 0 : 1)}
          onSoloToggle={() => onParamChange('highSolo', params.highSolo > 0.5 ? 0 : 1)}
        />
      </div>
    </div>
  );
});

CrossoverEQUI.displayName = 'CrossoverEQUI';

export default CrossoverEQUI;