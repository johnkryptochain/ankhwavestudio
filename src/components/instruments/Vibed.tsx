// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Vibed UI Component - Physical modeling string synthesizer interface
 * Features 9 string controls with visual representation
 */

import React, { useCallback, useState, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

const NUM_STRINGS = 9;

// Harmonic options
const HARMONICS = ['0.25x', '0.5x', '1x', '2x', '3x', '4x', '5x', '6x', '7x', '8x', '9x'];

// Impulse types
const IMPULSE_TYPES = [
  { value: 0, name: 'Pluck', icon: '🎸' },
  { value: 1, name: 'Bow', icon: '🎻' },
  { value: 2, name: 'Hammer', icon: '🔨' },
];

// String colors
const STRING_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e'
];

interface VibedParams {
  [key: string]: number;
}

interface VibedPreset {
  name: string;
  params: Partial<VibedParams>;
}

interface VibedProps {
  params: VibedParams;
  onParamChange: (key: string, value: number) => void;
  presets?: VibedPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  onTrigger?: () => void;
}

/**
 * String visualization component
 */
const StringVisualization: React.FC<{
  stringIndex: number;
  active: boolean;
  pickPosition: number;
  pickupPosition: number;
  color: string;
}> = memo(({ stringIndex, active, pickPosition, pickupPosition, color }) => {
  const width = 120;
  const height = 30;
  
  if (!active) {
    return (
      <div 
        className="rounded bg-daw-bg-primary border border-daw-border opacity-30"
        style={{ width, height }}
      />
    );
  }
  
  return (
    <svg width={width} height={height} className="rounded bg-daw-bg-primary border border-daw-border">
      {/* String line */}
      <line
        x1={5}
        y1={height / 2}
        x2={width - 5}
        y2={height / 2}
        stroke={color}
        strokeWidth={2}
      />
      
      {/* Pick position marker */}
      <circle
        cx={5 + (pickPosition / 100) * (width - 10)}
        cy={height / 2}
        r={4}
        fill="#fff"
        stroke={color}
        strokeWidth={2}
      />
      
      {/* Pickup position marker */}
      <rect
        x={5 + (pickupPosition / 100) * (width - 10) - 3}
        y={height / 2 - 8}
        width={6}
        height={16}
        fill={color}
        opacity={0.5}
        rx={1}
      />
      
      {/* String number */}
      <text
        x={width - 12}
        y={height - 5}
        fill="#666"
        fontSize="10"
      >
        {stringIndex + 1}
      </text>
    </svg>
  );
});

StringVisualization.displayName = 'StringVisualization';

/**
 * String control panel
 */
const StringPanel: React.FC<{
  stringIndex: number;
  params: VibedParams;
  onParamChange: (key: string, value: number) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}> = memo(({ stringIndex, params, onParamChange, expanded, onToggleExpand }) => {
  const prefix = `str${stringIndex}`;
  const color = STRING_COLORS[stringIndex];
  
  const power = params[`${prefix}Power`] > 0.5;
  const vol = params[`${prefix}Vol`] || 100;
  const pan = params[`${prefix}Pan`] || 0;
  const pick = params[`${prefix}Pick`] || 50;
  const pickup = params[`${prefix}Pickup`] || 50;
  const harm = params[`${prefix}Harm`] || 2;
  const stiff = params[`${prefix}Stiff`] || 50;
  const impulse = params[`${prefix}Impulse`] || 0;
  
  return (
    <div className={`bg-daw-bg-surface rounded p-2 transition-opacity ${power ? '' : 'opacity-50'}`}>
      {/* Header with power toggle */}
      <div className="flex items-center justify-between mb-2">
        <button
          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            power ? 'text-white' : 'bg-daw-bg-primary text-daw-text-muted'
          }`}
          style={{ backgroundColor: power ? color : undefined }}
          onClick={() => onParamChange(`${prefix}Power`, power ? 0 : 1)}
        >
          {stringIndex + 1}
        </button>
        
        <button
          className="text-daw-text-muted hover:text-daw-text-primary text-xs"
          onClick={onToggleExpand}
        >
          {expanded ? '▼' : '▶'}
        </button>
      </div>
      
      {/* String visualization */}
      <StringVisualization
        stringIndex={stringIndex}
        active={power}
        pickPosition={pick}
        pickupPosition={pickup}
        color={color}
      />
      
      {/* Basic controls */}
      <div className="flex justify-center gap-2 mt-2">
        <Knob
          value={vol}
          min={0}
          max={100}
          onChange={(v) => onParamChange(`${prefix}Vol`, v)}
          size="xs"
          label="Vol"
          disabled={!power}
        />
        <Knob
          value={pan}
          min={-100}
          max={100}
          onChange={(v) => onParamChange(`${prefix}Pan`, v)}
          size="xs"
          label="Pan"
          bipolar
          disabled={!power}
        />
      </div>
      
      {/* Expanded controls */}
      {expanded && power && (
        <div className="mt-3 pt-3 border-t border-daw-border space-y-3">
          {/* Pick and Pickup positions */}
          <div className="flex justify-center gap-2">
            <Knob
              value={pick}
              min={0}
              max={100}
              onChange={(v) => onParamChange(`${prefix}Pick`, v)}
              size="xs"
              label="Pincer"
            />
            <Knob
              value={pickup}
              min={0}
              max={100}
              onChange={(v) => onParamChange(`${prefix}Pickup`, v)}
              size="xs"
              label="Capteur"
            />
          </div>
          
          {/* Harmonic selector */}
          <div>
            <span className="text-[10px] text-daw-text-muted block mb-1">Harmonique</span>
            <select
              className="w-full bg-daw-bg-primary border border-daw-border rounded px-2 py-1 text-xs text-daw-text-secondary"
              value={harm}
              onChange={(e) => onParamChange(`${prefix}Harm`, parseInt(e.target.value))}
            >
              {HARMONICS.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </div>
          
          {/* Stiffness */}
          <div className="flex justify-center">
            <Knob
              value={stiff}
              min={0}
              max={100}
              onChange={(v) => onParamChange(`${prefix}Stiff`, v)}
              size="xs"
              label="Rigidité"
            />
          </div>
          
          {/* Impulse type */}
          <div>
            <span className="text-[10px] text-daw-text-muted block mb-1">Impulsion</span>
            <div className="flex gap-1">
              {IMPULSE_TYPES.map((type) => (
                <button
                  key={type.value}
                  className={`flex-1 px-1 py-1 text-xs rounded transition-colors ${
                    impulse === type.value
                      ? 'text-white'
                      : 'bg-daw-bg-primary text-daw-text-secondary hover:bg-daw-bg-elevated'
                  }`}
                  style={{ backgroundColor: impulse === type.value ? color : undefined }}
                  onClick={() => onParamChange(`${prefix}Impulse`, type.value)}
                  title={type.name}
                >
                  {type.icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

StringPanel.displayName = 'StringPanel';

/**
 * Vibed instrument UI
 */
export const VibedUI: React.FC<VibedProps> = memo(({
  params,
  onParamChange,
  presets = [],
  onPresetSelect,
  currentPresetIndex = -1,
  onTrigger,
}) => {
  const [expandedString, setExpandedString] = useState<number | null>(0);
  const [showPresets, setShowPresets] = useState(false);

  const handleToggleExpand = useCallback((stringIndex: number) => {
    setExpandedString(expandedString === stringIndex ? null : stringIndex);
  }, [expandedString]);

  // Count active strings
  const activeStrings = Array.from({ length: NUM_STRINGS }, (_, i) => 
    params[`str${i}Power`] > 0.5
  ).filter(Boolean).length;

  return (
    <div className="bg-daw-bg-secondary rounded-lg p-4 border border-daw-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Vibed</h3>
            <p className="text-xs text-daw-text-muted">Cordes à modélisation physique</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-daw-text-muted">
            {activeStrings} corde{activeStrings !== 1 ? 's' : ''} active{activeStrings !== 1 ? 's' : ''}
          </span>
          
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
      </div>

      {/* String grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {Array.from({ length: NUM_STRINGS }, (_, i) => (
          <StringPanel
            key={i}
            stringIndex={i}
            params={params}
            onParamChange={onParamChange}
            expanded={expandedString === i}
            onToggleExpand={() => handleToggleExpand(i)}
          />
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-daw-bg-surface rounded p-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-daw-text-muted">Actions rapides</span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                // Enable all strings
                for (let i = 0; i < NUM_STRINGS; i++) {
                  onParamChange(`str${i}Power`, 1);
                }
              }}
            >
              Tout activer
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                // Disable all strings except first
                for (let i = 0; i < NUM_STRINGS; i++) {
                  onParamChange(`str${i}Power`, i === 0 ? 1 : 0);
                }
              }}
            >
              Solo 1
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                // Randomize active strings
                for (let i = 0; i < NUM_STRINGS; i++) {
                  if (params[`str${i}Power`] > 0.5) {
                    onParamChange(`str${i}Pick`, Math.random() * 100);
                    onParamChange(`str${i}Pickup`, Math.random() * 100);
                    onParamChange(`str${i}Stiff`, Math.random() * 100);
                  }
                }
              }}
            >
              Aléatoire
            </Button>
          </div>
        </div>
      </div>

      {/* Trigger button */}
      {onTrigger && (
        <div className="flex justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={onTrigger}
            className="px-8 bg-amber-500 hover:bg-amber-600"
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

VibedUI.displayName = 'VibedUI';

export default VibedUI;