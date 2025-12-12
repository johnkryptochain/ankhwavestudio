// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Organic UI Component - Additive synthesizer interface
 * Features 8 harmonic oscillators with visual representation
 */

import React, { useCallback, useState, memo, useMemo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

// Harmonic names
const HARMONICS = [
  'Octave below', 'Fifth below', 'Fundamental', '2nd', '3rd', '4th', '5th', '6th',
  '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', '15th', '16th'
];

// Waveform options
const WAVEFORMS = [
  { value: 0, name: 'Sine', icon: '∿' },
  { value: 1, name: 'Saw', icon: '⊿' },
  { value: 2, name: 'Square', icon: '□' },
  { value: 3, name: 'Triangle', icon: '△' },
  { value: 4, name: 'Moog', icon: '⋀' },
  { value: 5, name: 'Exp', icon: '⌒' },
];

const NUM_OSCILLATORS = 8;

// Colors for each oscillator
const OSC_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8286ef', // violet -> theme
  '#8286ef', // pink -> theme
];

interface OrganicParams {
  volume: number;
  fx1: number;
  
  osc0Wave: number;
  osc0Harm: number;
  osc0Vol: number;
  osc0Pan: number;
  osc0Detune: number;
  
  osc1Wave: number;
  osc1Harm: number;
  osc1Vol: number;
  osc1Pan: number;
  osc1Detune: number;
  
  osc2Wave: number;
  osc2Harm: number;
  osc2Vol: number;
  osc2Pan: number;
  osc2Detune: number;
  
  osc3Wave: number;
  osc3Harm: number;
  osc3Vol: number;
  osc3Pan: number;
  osc3Detune: number;
  
  osc4Wave: number;
  osc4Harm: number;
  osc4Vol: number;
  osc4Pan: number;
  osc4Detune: number;
  
  osc5Wave: number;
  osc5Harm: number;
  osc5Vol: number;
  osc5Pan: number;
  osc5Detune: number;
  
  osc6Wave: number;
  osc6Harm: number;
  osc6Vol: number;
  osc6Pan: number;
  osc6Detune: number;
  
  osc7Wave: number;
  osc7Harm: number;
  osc7Vol: number;
  osc7Pan: number;
  osc7Detune: number;
}

interface OrganicPreset {
  name: string;
  params: Partial<OrganicParams>;
}

interface OrganicProps {
  params: OrganicParams;
  onParamChange: (key: keyof OrganicParams, value: number) => void;
  onRandomize?: () => void;
  presets?: OrganicPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  onTrigger?: () => void;
}

/**
 * Harmonic spectrum visualization
 */
const SpectrumDisplay: React.FC<{
  params: OrganicParams;
}> = memo(({ params }) => {
  const width = 320;
  const height = 100;
  const padding = 10;
  
  // Calculate bar positions based on harmonic ratios
  const bars = useMemo(() => {
    const result = [];
    for (let osc = 0; osc < NUM_OSCILLATORS; osc++) {
      const harmIndex = params[`osc${osc}Harm` as keyof OrganicParams] as number;
      const vol = params[`osc${osc}Vol` as keyof OrganicParams] as number;
      
      // Map harmonic index to x position (logarithmic scale)
      const harmRatio = [0.5, 0.667, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16][harmIndex] || 1;
      const x = padding + (Math.log2(harmRatio + 0.5) / Math.log2(17)) * (width - 2 * padding);
      const barHeight = (vol / 100) * (height - 2 * padding);
      
      result.push({
        x,
        height: barHeight,
        color: OSC_COLORS[osc],
        osc,
      });
    }
    return result;
  }, [params]);
  
  return (
    <svg width={width} height={height} className="bg-daw-bg-primary rounded border border-daw-border">
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((y) => (
        <line
          key={y}
          x1={padding}
          y1={height - padding - y * (height - 2 * padding)}
          x2={width - padding}
          y2={height - padding - y * (height - 2 * padding)}
          stroke="#333"
          strokeWidth="1"
          strokeDasharray="2,2"
        />
      ))}
      
      {/* Harmonic bars */}
      {bars.map((bar, i) => (
        <g key={i}>
          <rect
            x={bar.x - 8}
            y={height - padding - bar.height}
            width={16}
            height={bar.height}
            fill={bar.color}
            opacity={0.8}
            rx={2}
          />
          <text
            x={bar.x}
            y={height - 2}
            fill="#666"
            fontSize="8"
            textAnchor="middle"
          >
            {bar.osc + 1}
          </text>
        </g>
      ))}
      
      {/* Labels */}
      <text x={padding} y={10} fill="#666" fontSize="8">Spectre</text>
      <text x={width - padding} y={10} fill="#666" fontSize="8" textAnchor="end">Aigu</text>
    </svg>
  );
});

SpectrumDisplay.displayName = 'SpectrumDisplay';

/**
 * Vertical slider component for volume
 */
const VerticalSlider: React.FC<{
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  color: string;
  label?: string;
}> = memo(({ value, min, max, onChange, color, label }) => {
  const height = 120;
  const percentage = ((value - min) / (max - min)) * 100;
  
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    
    const updateValue = (clientY: number) => {
      const y = clientY - rect.top;
      const newPercentage = 1 - (y / rect.height);
      const newValue = min + newPercentage * (max - min);
      onChange(Math.max(min, Math.min(max, newValue)));
    };
    
    updateValue(e.clientY);
    
    const handleMouseMove = (e: MouseEvent) => {
      updateValue(e.clientY);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [min, max, onChange]);
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative w-6 bg-daw-bg-primary rounded cursor-ns-resize border border-daw-border"
        style={{ height }}
        onMouseDown={handleMouseDown}
      >
        {/* Fill */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-b transition-all"
          style={{
            height: `${percentage}%`,
            backgroundColor: color,
            opacity: 0.7,
          }}
        />
        {/* Handle */}
        <div
          className="absolute left-0 right-0 h-2 -translate-y-1/2 rounded"
          style={{
            bottom: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
      {label && <span className="text-[10px] text-daw-text-muted">{label}</span>}
      <span className="text-[10px] text-daw-text-secondary font-mono">{Math.round(value)}</span>
    </div>
  );
});

VerticalSlider.displayName = 'VerticalSlider';

/**
 * Oscillator control panel
 */
const OscillatorPanel: React.FC<{
  oscIndex: number;
  params: OrganicParams;
  onParamChange: (key: keyof OrganicParams, value: number) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}> = memo(({ oscIndex, params, onParamChange, expanded, onToggleExpand }) => {
  const prefix = `osc${oscIndex}` as const;
  const color = OSC_COLORS[oscIndex];
  
  const wave = params[`${prefix}Wave` as keyof OrganicParams] as number;
  const harm = params[`${prefix}Harm` as keyof OrganicParams] as number;
  const vol = params[`${prefix}Vol` as keyof OrganicParams] as number;
  const pan = params[`${prefix}Pan` as keyof OrganicParams] as number;
  const detune = params[`${prefix}Detune` as keyof OrganicParams] as number;
  
  return (
    <div className="flex flex-col items-center">
      {/* Volume slider */}
      <VerticalSlider
        value={vol}
        min={0}
        max={100}
        onChange={(v) => onParamChange(`${prefix}Vol` as keyof OrganicParams, v)}
        color={color}
        label={`${oscIndex + 1}`}
      />
      
      {/* Expand button */}
      <button
        className={`mt-1 w-6 h-6 rounded text-xs flex items-center justify-center transition-colors ${
          expanded ? 'bg-daw-bg-elevated text-daw-text-primary' : 'bg-daw-bg-surface text-daw-text-muted'
        }`}
        onClick={onToggleExpand}
        style={{ borderColor: expanded ? color : 'transparent', borderWidth: expanded ? 1 : 0 }}
      >
        ⚙
      </button>
      
      {/* Expanded controls */}
      {expanded && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-daw-bg-elevated border border-daw-border rounded-lg p-3 shadow-xl z-50 min-w-[160px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color }}>OSC {oscIndex + 1}</span>
            <button
              className="text-daw-text-muted hover:text-daw-text-primary text-xs"
              onClick={onToggleExpand}
            >
              ✕
            </button>
          </div>
          
          {/* Waveform selector */}
          <div className="mb-2">
            <span className="text-[10px] text-daw-text-muted block mb-1">Forme d'onde</span>
            <div className="grid grid-cols-3 gap-1">
              {WAVEFORMS.map((wf) => (
                <button
                  key={wf.value}
                  className={`px-1 py-0.5 text-xs rounded transition-colors ${
                    wave === wf.value
                      ? 'text-white'
                      : 'bg-daw-bg-primary text-daw-text-secondary hover:bg-daw-bg-surface'
                  }`}
                  style={{ backgroundColor: wave === wf.value ? color : undefined }}
                  onClick={() => onParamChange(`${prefix}Wave` as keyof OrganicParams, wf.value)}
                  title={wf.name}
                >
                  {wf.icon}
                </button>
              ))}
            </div>
          </div>
          
          {/* Harmonic selector */}
          <div className="mb-2">
            <span className="text-[10px] text-daw-text-muted block mb-1">Harmonique</span>
            <select
              className="w-full bg-daw-bg-primary border border-daw-border rounded px-2 py-1 text-xs text-daw-text-secondary"
              value={harm}
              onChange={(e) => onParamChange(`${prefix}Harm` as keyof OrganicParams, parseInt(e.target.value))}
            >
              {HARMONICS.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </div>
          
          {/* Pan and Detune */}
          <div className="flex gap-2">
            <Knob
              value={pan}
              min={-100}
              max={100}
              onChange={(v) => onParamChange(`${prefix}Pan` as keyof OrganicParams, v)}
              size="xs"
              label="Pan"
              bipolar
            />
            <Knob
              value={detune}
              min={-100}
              max={100}
              onChange={(v) => onParamChange(`${prefix}Detune` as keyof OrganicParams, v)}
              size="xs"
              label="Désaccord"
              bipolar
            />
          </div>
        </div>
      )}
    </div>
  );
});

OscillatorPanel.displayName = 'OscillatorPanel';

/**
 * Organic instrument UI
 */
export const OrganicUI: React.FC<OrganicProps> = memo(({
  params,
  onParamChange,
  onRandomize,
  presets = [],
  onPresetSelect,
  currentPresetIndex = -1,
  onTrigger,
}) => {
  const [expandedOsc, setExpandedOsc] = useState<number | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  const handleToggleExpand = useCallback((oscIndex: number) => {
    setExpandedOsc(expandedOsc === oscIndex ? null : oscIndex);
  }, [expandedOsc]);

  return (
    <div className="bg-daw-bg-secondary rounded-lg p-4 border border-daw-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">O</span>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Organic</h3>
            <p className="text-xs text-daw-text-muted">Synthétiseur additif</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Randomize button */}
          {onRandomize && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRandomize}
              tooltip="Randomiser tous les oscillateurs"
            >
              🎲 Aléatoire
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
      </div>

      {/* Spectrum display */}
      <div className="flex justify-center mb-4">
        <SpectrumDisplay params={params} />
      </div>

      {/* Oscillator sliders */}
      <div className="bg-daw-bg-surface rounded p-4 mb-4">
        <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide">Harmoniques</h4>
        <div className="flex justify-center gap-4 relative">
          {Array.from({ length: NUM_OSCILLATORS }, (_, i) => (
            <OscillatorPanel
              key={i}
              oscIndex={i}
              params={params}
              onParamChange={onParamChange}
              expanded={expandedOsc === i}
              onToggleExpand={() => handleToggleExpand(i)}
            />
          ))}
        </div>
      </div>

      {/* Global controls */}
      <div className="bg-daw-bg-surface rounded p-3">
        <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide">Global</h4>
        <div className="flex justify-center gap-6">
          <Knob
            value={params.volume}
            min={0}
            max={100}
            onChange={(v) => onParamChange('volume', v)}
            size="lg"
            label="Volume"
            valueFormatter={(v) => `${Math.round(v)}%`}
          />
          <Knob
            value={params.fx1}
            min={0}
            max={100}
            onChange={(v) => onParamChange('fx1', v)}
            size="lg"
            label="Distorsion"
            valueFormatter={(v) => `${Math.round(v)}%`}
          />
        </div>
      </div>

      {/* Trigger button */}
      {onTrigger && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={onTrigger}
            className="px-8 bg-green-500 hover:bg-green-600"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Trigger
          </Button>
        </div>
      )}
    </div>
  );
});

OrganicUI.displayName = 'OrganicUI';

export default OrganicUI;