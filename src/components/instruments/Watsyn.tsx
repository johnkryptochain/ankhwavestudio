// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Watsyn UI Component - 4-oscillator wavetable synthesizer interface
 * Features A/B crossfade and dual envelopes
 */

import React, { useCallback, useState, memo, useMemo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';
import { WAVETABLE_NAMES } from '../../audio/instruments/Watsyn';

// Wavetable display names
const WAVETABLE_DISPLAY_NAMES = [
  'Sine', 'Triangle', 'Saw', 'Square', 'Moog Saw',
  'Exponential', 'Soft Square', 'Pulse 25%', 'Pulse 12.5%', 'Stairs', 'Random'
];

interface WatsynParams {
  [key: string]: number;
}

interface WatsynPreset {
  name: string;
  params: Partial<WatsynParams>;
}

interface WatsynProps {
  params: WatsynParams;
  onParamChange: (key: string, value: number) => void;
  presets?: WatsynPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  getWavetableData?: (index: number) => Float32Array;
}

/**
 * Wavetable visualization component
 */
const WavetableDisplay: React.FC<{
  data: Float32Array | null;
  color: string;
  width?: number;
  height?: number;
}> = memo(({ data, color, width = 100, height = 40 }) => {
  const pathD = useMemo(() => {
    if (!data) return '';
    
    const points: string[] = [];
    const step = data.length / width;
    
    for (let i = 0; i < width; i++) {
      const index = Math.floor(i * step);
      const value = data[index] || 0;
      const x = i;
      const y = height / 2 - (value * height / 2 * 0.8);
      
      if (i === 0) {
        points.push(`M ${x} ${y}`);
      } else {
        points.push(`L ${x} ${y}`);
      }
    }
    
    return points.join(' ');
  }, [data, width, height]);
  
  return (
    <svg width={width} height={height} className="bg-daw-bg-primary rounded border border-daw-border">
      {/* Center line */}
      <line
        x1={0}
        y1={height / 2}
        x2={width}
        y2={height / 2}
        stroke="#333"
        strokeWidth={1}
      />
      {/* Waveform */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
      />
    </svg>
  );
});

WavetableDisplay.displayName = 'WavetableDisplay';

/**
 * Oscillator panel component
 */
const OscillatorPanel: React.FC<{
  name: string;
  prefix: string;
  color: string;
  params: WatsynParams;
  onParamChange: (key: string, value: number) => void;
  wavetableData: Float32Array | null;
}> = memo(({ name, prefix, color, params, onParamChange, wavetableData }) => {
  const wave = params[`${prefix}Wave`] || 0;
  const vol = params[`${prefix}Vol`] || 0;
  const pan = params[`${prefix}Pan`] || 0;
  const detune = params[`${prefix}Detune`] || 0;
  const phase = params[`${prefix}Phase`] || 0;
  
  return (
    <div className="bg-daw-bg-surface rounded p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm" style={{ color }}>{name}</span>
        <span className="text-xs text-daw-text-muted">{WAVETABLE_DISPLAY_NAMES[wave]}</span>
      </div>
      
      {/* Wavetable display */}
      <div className="mb-3">
        <WavetableDisplay data={wavetableData} color={color} />
      </div>
      
      {/* Wavetable selector */}
      <div className="mb-3">
        <select
          className="w-full bg-daw-bg-primary border border-daw-border rounded px-2 py-1 text-xs text-daw-text-secondary"
          value={wave}
          onChange={(e) => onParamChange(`${prefix}Wave`, parseInt(e.target.value))}
        >
          {WAVETABLE_DISPLAY_NAMES.map((name, i) => (
            <option key={i} value={i}>{name}</option>
          ))}
        </select>
      </div>
      
      {/* Controls */}
      <div className="grid grid-cols-2 gap-2">
        <Knob
          value={vol}
          min={0}
          max={100}
          onChange={(v) => onParamChange(`${prefix}Vol`, v)}
          size="sm"
          label="Volume"
        />
        <Knob
          value={pan}
          min={-100}
          max={100}
          onChange={(v) => onParamChange(`${prefix}Pan`, v)}
          size="sm"
          label="Pan"
          bipolar
        />
        <Knob
          value={detune}
          min={-1200}
          max={1200}
          onChange={(v) => onParamChange(`${prefix}Detune`, v)}
          size="sm"
          label="Désaccord"
          bipolar
        />
        <Knob
          value={phase}
          min={0}
          max={360}
          onChange={(v) => onParamChange(`${prefix}Phase`, v)}
          size="sm"
          label="Phase"
        />
      </div>
    </div>
  );
});

OscillatorPanel.displayName = 'OscillatorPanel';

/**
 * Envelope display component
 */
const EnvelopeDisplay: React.FC<{
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  color: string;
  width?: number;
  height?: number;
}> = memo(({ attack, decay, sustain, release, color, width = 150, height = 60 }) => {
  const pathD = useMemo(() => {
    const totalTime = attack + decay + 200 + release; // 200ms sustain display
    const scale = width / totalTime;
    
    const attackX = attack * scale;
    const decayX = attackX + decay * scale;
    const sustainX = decayX + 200 * scale;
    const releaseX = sustainX + release * scale;
    
    const sustainY = height - (sustain / 100) * (height - 10);
    
    return `M 0 ${height} L ${attackX} 10 L ${decayX} ${sustainY} L ${sustainX} ${sustainY} L ${releaseX} ${height}`;
  }, [attack, decay, sustain, release, width, height]);
  
  return (
    <svg width={width} height={height} className="bg-daw-bg-primary rounded border border-daw-border">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
      />
      {/* Labels */}
      <text x={5} y={height - 5} fill="#666" fontSize="8">A</text>
      <text x={width * 0.25} y={height - 5} fill="#666" fontSize="8">D</text>
      <text x={width * 0.5} y={height - 5} fill="#666" fontSize="8">S</text>
      <text x={width * 0.75} y={height - 5} fill="#666" fontSize="8">R</text>
    </svg>
  );
});

EnvelopeDisplay.displayName = 'EnvelopeDisplay';

/**
 * Envelope panel component
 */
const EnvelopePanel: React.FC<{
  name: string;
  prefix: string;
  color: string;
  params: WatsynParams;
  onParamChange: (key: string, value: number) => void;
}> = memo(({ name, prefix, color, params, onParamChange }) => {
  const attack = params[`${prefix}Attack`] || 10;
  const decay = params[`${prefix}Decay`] || 100;
  const sustain = params[`${prefix}Sustain`] || 80;
  const release = params[`${prefix}Release`] || 200;
  
  return (
    <div className="bg-daw-bg-surface rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm" style={{ color }}>{name}</span>
      </div>
      
      {/* Envelope display */}
      <div className="mb-3 flex justify-center">
        <EnvelopeDisplay
          attack={attack}
          decay={decay}
          sustain={sustain}
          release={release}
          color={color}
        />
      </div>
      
      {/* ADSR controls */}
      <div className="grid grid-cols-4 gap-1">
        <Knob
          value={attack}
          min={0}
          max={2000}
          onChange={(v) => onParamChange(`${prefix}Attack`, v)}
          size="xs"
          label="A"
        />
        <Knob
          value={decay}
          min={0}
          max={2000}
          onChange={(v) => onParamChange(`${prefix}Decay`, v)}
          size="xs"
          label="D"
        />
        <Knob
          value={sustain}
          min={0}
          max={100}
          onChange={(v) => onParamChange(`${prefix}Sustain`, v)}
          size="xs"
          label="S"
        />
        <Knob
          value={release}
          min={0}
          max={5000}
          onChange={(v) => onParamChange(`${prefix}Release`, v)}
          size="xs"
          label="R"
        />
      </div>
    </div>
  );
});

EnvelopePanel.displayName = 'EnvelopePanel';

/**
 * A/B Crossfader component
 */
const ABCrossfader: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = memo(({ value, onChange }) => {
  return (
    <div className="bg-daw-bg-surface rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-blue-400">A</span>
        <span className="text-xs text-daw-text-muted">Fondu enchaîné</span>
        <span className="text-sm font-semibold text-green-400">B</span>
      </div>
      
      {/* Crossfade slider */}
      <div className="relative h-8 bg-daw-bg-primary rounded border border-daw-border">
        {/* Gradient background */}
        <div 
          className="absolute inset-0 rounded"
          style={{
            background: 'linear-gradient(to right, #3b82f6, #22c55e)'
          }}
        />
        
        {/* Slider track */}
        <input
          type="range"
          min={-100}
          max={100}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        {/* Slider thumb indicator */}
        <div 
          className="absolute top-1 bottom-1 w-2 bg-white rounded shadow-lg transition-all"
          style={{
            left: `calc(${(value + 100) / 2}% - 4px)`
          }}
        />
      </div>
      
      {/* Value display */}
      <div className="text-center mt-1 text-xs text-daw-text-muted">
        {value === 0 ? 'Égal' : value < 0 ? `A: ${Math.abs(value)}%` : `B: ${value}%`}
      </div>
    </div>
  );
});

ABCrossfader.displayName = 'ABCrossfader';

/**
 * Watsyn instrument UI
 */
export const WatsynUI: React.FC<WatsynProps> = memo(({
  params,
  onParamChange,
  presets = [],
  onPresetSelect,
  currentPresetIndex = -1,
  getWavetableData,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  // Get wavetable data for each oscillator
  const a1Data = useMemo(() => getWavetableData?.(params.a1Wave || 0) || null, [getWavetableData, params.a1Wave]);
  const a2Data = useMemo(() => getWavetableData?.(params.a2Wave || 0) || null, [getWavetableData, params.a2Wave]);
  const b1Data = useMemo(() => getWavetableData?.(params.b1Wave || 0) || null, [getWavetableData, params.b1Wave]);
  const b2Data = useMemo(() => getWavetableData?.(params.b2Wave || 0) || null, [getWavetableData, params.b2Wave]);

  return (
    <div className="bg-daw-bg-secondary rounded-lg p-4 border border-daw-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-green-500 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Watsyn</h3>
            <p className="text-xs text-daw-text-muted">Table d'ondes à 4 oscillateurs</p>
          </div>
        </div>
        
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
                    index === currentPresetIndex ? 'text-blue-400' : 'text-daw-text-secondary'
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

      {/* Main layout */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Group A */}
        <div className="space-y-3">
          <div className="text-center text-sm font-semibold text-blue-400 mb-2">Groupe A</div>
          <OscillatorPanel
            name="A1"
            prefix="a1"
            color="#3b82f6"
            params={params}
            onParamChange={onParamChange}
            wavetableData={a1Data}
          />
          <OscillatorPanel
            name="A2"
            prefix="a2"
            color="#60a5fa"
            params={params}
            onParamChange={onParamChange}
            wavetableData={a2Data}
          />
          <EnvelopePanel
            name="Enveloppe A"
            prefix="envA"
            color="#3b82f6"
            params={params}
            onParamChange={onParamChange}
          />
        </div>
        
        {/* Group B */}
        <div className="space-y-3">
          <div className="text-center text-sm font-semibold text-green-400 mb-2">Groupe B</div>
          <OscillatorPanel
            name="B1"
            prefix="b1"
            color="#22c55e"
            params={params}
            onParamChange={onParamChange}
            wavetableData={b1Data}
          />
          <OscillatorPanel
            name="B2"
            prefix="b2"
            color="#4ade80"
            params={params}
            onParamChange={onParamChange}
            wavetableData={b2Data}
          />
          <EnvelopePanel
            name="Enveloppe B"
            prefix="envB"
            color="#22c55e"
            params={params}
            onParamChange={onParamChange}
          />
        </div>
      </div>

      {/* A/B Crossfader */}
      <ABCrossfader
        value={params.abMix || 0}
        onChange={(v) => onParamChange('abMix', v)}
      />
    </div>
  );
});

WatsynUI.displayName = 'WatsynUI';

export default WatsynUI;