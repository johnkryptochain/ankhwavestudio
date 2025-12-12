// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Mallets UI Component - Physical modeling percussion interface
 * Features instrument type selector with icons and parameter controls
 */

import React, { useCallback, useState, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';
import { MalletInstrument, MALLET_INSTRUMENT_NAMES } from '../../audio/instruments/Mallets';

// Instrument icons/emojis
const INSTRUMENT_ICONS: Record<MalletInstrument, string> = {
  [MalletInstrument.Marimba]: '🎹',
  [MalletInstrument.Vibraphone]: '🎵',
  [MalletInstrument.Agogo]: '🔔',
  [MalletInstrument.WoodBlocks]: '🪵',
  [MalletInstrument.TubularBells]: '🔔',
  [MalletInstrument.SteelDrum]: '🥁',
  [MalletInstrument.BandedWG]: '〰️',
  [MalletInstrument.GlassHarmonica]: '🍷',
  [MalletInstrument.Uniform]: '📊',
};

// Instrument colors
const INSTRUMENT_COLORS: Record<MalletInstrument, string> = {
  [MalletInstrument.Marimba]: '#8b4513',
  [MalletInstrument.Vibraphone]: '#c0c0c0',
  [MalletInstrument.Agogo]: '#ffd700',
  [MalletInstrument.WoodBlocks]: '#deb887',
  [MalletInstrument.TubularBells]: '#b8860b',
  [MalletInstrument.SteelDrum]: '#708090',
  [MalletInstrument.BandedWG]: '#4169e1',
  [MalletInstrument.GlassHarmonica]: '#87ceeb',
  [MalletInstrument.Uniform]: '#9370db',
};

interface MalletsParams {
  [key: string]: number;
}

interface MalletsPreset {
  name: string;
  params: Partial<MalletsParams>;
}

interface MalletsProps {
  params: MalletsParams;
  onParamChange: (key: string, value: number) => void;
  presets?: MalletsPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  onTrigger?: () => void;
}

/**
 * Mallet position visualization
 */
const MalletPositionDisplay: React.FC<{
  position: number;
  hardness: number;
  color: string;
}> = memo(({ position, hardness, color }) => {
  const width = 150;
  const height = 60;
  
  // Calculate mallet position
  const malletX = (position / 100) * (width - 20) + 10;
  const malletSize = 8 + (hardness / 100) * 8;
  
  return (
    <svg width={width} height={height} className="bg-daw-bg-primary rounded border border-daw-border">
      {/* Bar representation */}
      <rect
        x={10}
        y={height - 15}
        width={width - 20}
        height={10}
        fill={color}
        rx={2}
      />
      
      {/* Node markers */}
      {[0.25, 0.5, 0.75].map((pos, i) => (
        <circle
          key={i}
          cx={10 + pos * (width - 20)}
          cy={height - 10}
          r={3}
          fill="#333"
        />
      ))}
      
      {/* Mallet */}
      <line
        x1={malletX}
        y1={10}
        x2={malletX}
        y2={height - 20}
        stroke="#666"
        strokeWidth={3}
      />
      <circle
        cx={malletX}
        cy={10}
        r={malletSize}
        fill={hardness > 50 ? '#f59e0b' : '#8b5cf6'}
        stroke="#333"
        strokeWidth={1}
      />
      
      {/* Labels */}
      <text x={5} y={height - 20} fill="#666" fontSize="8">Bord</text>
      <text x={width - 30} y={height - 20} fill="#666" fontSize="8">Centre</text>
    </svg>
  );
});

MalletPositionDisplay.displayName = 'MalletPositionDisplay';

/**
 * Instrument selector grid
 */
const InstrumentSelector: React.FC<{
  selected: number;
  onSelect: (instrument: number) => void;
}> = memo(({ selected, onSelect }) => {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MALLET_INSTRUMENT_NAMES.map((name, index) => {
        const isSelected = selected === index;
        const color = INSTRUMENT_COLORS[index as MalletInstrument];
        const icon = INSTRUMENT_ICONS[index as MalletInstrument];
        
        return (
          <button
            key={index}
            className={`p-2 rounded transition-all ${
              isSelected
                ? 'ring-2 ring-offset-2 ring-offset-daw-bg-secondary'
                : 'hover:bg-daw-bg-elevated'
            }`}
            style={{
              backgroundColor: isSelected ? color : 'var(--daw-bg-surface)',
              color: isSelected ? '#fff' : 'var(--daw-text-secondary)',
              // @ts-ignore - Tailwind ring color via CSS variable
              '--tw-ring-color': color,
            } as React.CSSProperties}
            onClick={() => onSelect(index)}
          >
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-xs truncate">{name}</div>
          </button>
        );
      })}
    </div>
  );
});

InstrumentSelector.displayName = 'InstrumentSelector';

/**
 * Mallets instrument UI
 */
export const MalletsUI: React.FC<MalletsProps> = memo(({
  params,
  onParamChange,
  presets = [],
  onPresetSelect,
  currentPresetIndex = -1,
  onTrigger,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const instrument = Math.floor(params.instrument || 0) as MalletInstrument;
  const instrumentColor = INSTRUMENT_COLORS[instrument];
  const instrumentName = MALLET_INSTRUMENT_NAMES[instrument];

  return (
    <div className="bg-daw-bg-secondary rounded-lg p-4 border border-daw-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div 
            className="w-10 h-10 rounded flex items-center justify-center text-2xl"
            style={{ backgroundColor: instrumentColor }}
          >
            {INSTRUMENT_ICONS[instrument]}
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Mallets</h3>
            <p className="text-xs text-daw-text-muted">{instrumentName}</p>
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
                    index === currentPresetIndex ? 'text-amber-400' : 'text-daw-text-secondary'
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

      {/* Instrument selector */}
      <div className="bg-daw-bg-surface rounded p-3 mb-4">
        <div className="text-xs text-daw-text-muted mb-2">Type d'instrument</div>
        <InstrumentSelector
          selected={instrument}
          onSelect={(i) => onParamChange('instrument', i)}
        />
      </div>

      {/* Mallet controls */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Mallet section */}
        <div className="bg-daw-bg-surface rounded p-3">
          <div className="text-xs text-daw-text-muted mb-2">Maillet</div>
          
          {/* Position visualization */}
          <div className="flex justify-center mb-3">
            <MalletPositionDisplay
              position={params.position || 50}
              hardness={params.hardness || 50}
              color={instrumentColor}
            />
          </div>
          
          {/* Mallet controls */}
          <div className="grid grid-cols-3 gap-2">
            <Knob
              value={params.hardness || 50}
              min={0}
              max={100}
              onChange={(v) => onParamChange('hardness', v)}
              size="sm"
              label="Dureté"
            />
            <Knob
              value={params.position || 50}
              min={0}
              max={100}
              onChange={(v) => onParamChange('position', v)}
              size="sm"
              label="Position"
            />
            <Knob
              value={params.stickMix || 50}
              min={0}
              max={100}
              onChange={(v) => onParamChange('stickMix', v)}
              size="sm"
              label="Mix baguette"
            />
          </div>
        </div>

        {/* Vibrato section */}
        <div className="bg-daw-bg-surface rounded p-3">
          <div className="text-xs text-daw-text-muted mb-2">Vibrato</div>
          
          {/* Vibrato visualization */}
          <div className="h-[60px] flex items-center justify-center mb-3">
            <svg width={150} height={40} className="bg-daw-bg-primary rounded border border-daw-border">
              {/* Vibrato wave */}
              <path
                d={`M 0 20 ${Array.from({ length: 150 }, (_, i) => {
                  const freq = (params.vibratoFreq || 6) / 3;
                  const amp = (params.vibratoGain || 0) / 100 * 15;
                  const y = 20 + Math.sin(i * freq * 0.1) * amp;
                  return `L ${i} ${y}`;
                }).join(' ')}`}
                fill="none"
                stroke={instrumentColor}
                strokeWidth={2}
              />
            </svg>
          </div>
          
          {/* Vibrato controls */}
          <div className="grid grid-cols-2 gap-2">
            <Knob
              value={params.vibratoGain || 0}
              min={0}
              max={100}
              onChange={(v) => onParamChange('vibratoGain', v)}
              size="sm"
              label="Gain"
            />
            <Knob
              value={params.vibratoFreq || 6}
              min={0.1}
              max={20}
              onChange={(v) => onParamChange('vibratoFreq', v)}
              size="sm"
              label="Fréq"
            />
          </div>
        </div>
      </div>

      {/* Additional controls */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-daw-bg-surface rounded p-2">
          <Knob
            value={params.modulatorIndex || 0}
            min={0}
            max={100}
            onChange={(v) => onParamChange('modulatorIndex', v)}
            size="sm"
            label="Index mod"
          />
        </div>
        <div className="bg-daw-bg-surface rounded p-2">
          <Knob
            value={params.crossfade || 0}
            min={0}
            max={100}
            onChange={(v) => onParamChange('crossfade', v)}
            size="sm"
            label="Fondu"
          />
        </div>
        <div className="bg-daw-bg-surface rounded p-2">
          <Knob
            value={params.spread || 0}
            min={0}
            max={100}
            onChange={(v) => onParamChange('spread', v)}
            size="sm"
            label="Étendue"
          />
        </div>
        <div className="bg-daw-bg-surface rounded p-2">
          <Knob
            value={params.randomness || 0}
            min={0}
            max={100}
            onChange={(v) => onParamChange('randomness', v)}
            size="sm"
            label="Aléatoire"
          />
        </div>
      </div>

      {/* Trigger button */}
      {onTrigger && (
        <div className="flex justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={onTrigger}
            className="px-8"
            style={{ backgroundColor: instrumentColor }}
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Frapper
          </Button>
        </div>
      )}
    </div>
  );
});

MalletsUI.displayName = 'MalletsUI';

export default MalletsUI;
