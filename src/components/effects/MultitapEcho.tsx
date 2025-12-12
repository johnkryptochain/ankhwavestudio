// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * MultitapEcho UI Component - Visual interface for the MultitapEcho effect
 */

import React, { useCallback, useState, useEffect, useRef, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

interface TapConfig {
  enabled: boolean;
  delayTime: number;
  volume: number;
  pan: number;
  feedback: number;
  filterFreq: number;
}

interface MultitapEchoParams {
  wet: number;
  tempoSync: number;
  masterFeedback: number;
}

interface MultitapEchoPreset {
  name: string;
  params: Partial<MultitapEchoParams>;
}

interface MultitapEchoProps {
  params: MultitapEchoParams;
  taps: TapConfig[];
  onParamChange: (key: keyof MultitapEchoParams, value: number) => void;
  onTapChange: (index: number, config: Partial<TapConfig>) => void;
  onTapPresetLoad?: (presetName: string) => void;
  presets?: MultitapEchoPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  bypassed?: boolean;
  onBypassToggle?: () => void;
  tempo?: number;
}

const MAX_TAPS = 8;

const defaultPresets: MultitapEchoPreset[] = [
  { name: 'Simple Echo', params: { wet: 0.4, tempoSync: 0, masterFeedback: 0.3 } },
  { name: 'Ping Pong', params: { wet: 0.5, tempoSync: 0, masterFeedback: 0.4 } },
  { name: 'Rhythmic', params: { wet: 0.5, tempoSync: 1, masterFeedback: 0.35 } },
  { name: 'Ambient Wash', params: { wet: 0.6, tempoSync: 0, masterFeedback: 0.6 } },
  { name: 'Slapback', params: { wet: 0.3, tempoSync: 0, masterFeedback: 0.1 } },
];

const tapPresets = [
  { name: 'Default', value: 'default' },
  { name: 'Ping Pong', value: 'pingpong' },
  { name: 'Rhythmic', value: 'rhythmic' },
  { name: 'Ambient', value: 'ambient' },
  { name: 'Slapback', value: 'slapback' },
];

/**
 * Visual tap editor showing all taps graphically
 */
const TapVisualizer: React.FC<{
  taps: TapConfig[];
  selectedTap: number;
  onTapSelect: (index: number) => void;
  onTapChange: (index: number, config: Partial<TapConfig>) => void;
}> = memo(({ taps, selectedTap, onTapSelect, onTapChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = 20;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Vertical grid lines (time divisions)
    for (let i = 0; i <= 8; i++) {
      const x = padding + (i / 8) * graphWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }
    
    // Horizontal grid lines (volume divisions)
    for (let i = 0; i <= 4; i++) {
      const y = padding + (i / 4) * graphHeight;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    // Draw center line for pan
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(padding, height / 2);
    ctx.lineTo(width - padding, height / 2);
    ctx.stroke();
    
    // Draw taps
    const maxDelayTime = 2000; // ms
    
    taps.forEach((tap, index) => {
      if (!tap.enabled) return;
      
      const x = padding + (tap.delayTime / maxDelayTime) * graphWidth;
      const y = padding + (1 - tap.volume) * graphHeight;
      
      // Draw tap line
      const isSelected = index === selectedTap;
      ctx.strokeStyle = isSelected ? '#22d3ee' : `hsl(${index * 45}, 70%, 60%)`;
      ctx.lineWidth = isSelected ? 3 : 2;
      
      ctx.beginPath();
      ctx.moveTo(x, height - padding);
      ctx.lineTo(x, y);
      ctx.stroke();
      
      // Draw tap head (circle)
      ctx.fillStyle = isSelected ? '#22d3ee' : `hsl(${index * 45}, 70%, 60%)`;
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw pan indicator
      const panOffset = tap.pan * 15;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(x + panOffset, y, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw tap number
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${index + 1}`, x, height - padding + 12);
    });
    
    // Draw time labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const time = (i / 4) * maxDelayTime;
      const x = padding + (i / 4) * graphWidth;
      ctx.fillText(`${time}ms`, x, height - 2);
    }
    
  }, [taps, selectedTap]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const padding = 20;
    const graphWidth = canvas.width - padding * 2;
    const graphHeight = canvas.height - padding * 2;
    const maxDelayTime = 2000;
    
    // Find closest tap
    let closestTap = -1;
    let closestDist = Infinity;
    
    taps.forEach((tap, index) => {
      if (!tap.enabled) return;
      
      const tapX = padding + (tap.delayTime / maxDelayTime) * graphWidth;
      const tapY = padding + (1 - tap.volume) * graphHeight;
      
      const dist = Math.sqrt((x - tapX) ** 2 + (y - tapY) ** 2);
      if (dist < closestDist && dist < 20) {
        closestDist = dist;
        closestTap = index;
      }
    });
    
    if (closestTap >= 0) {
      onTapSelect(closestTap);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={150}
      className="bg-daw-bg-primary rounded border border-daw-border cursor-pointer"
      onClick={handleCanvasClick}
    />
  );
});

TapVisualizer.displayName = 'TapVisualizer';

/**
 * Individual tap control panel
 */
const TapControls: React.FC<{
  tap: TapConfig;
  index: number;
  onChange: (config: Partial<TapConfig>) => void;
}> = memo(({ tap, index, onChange }) => {
  return (
    <div className={`bg-daw-bg-surface rounded p-3 ${!tap.enabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-daw-text-primary">Tap {index + 1}</span>
        <Button
          variant={tap.enabled ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onChange({ enabled: !tap.enabled })}
        >
          {tap.enabled ? 'ON' : 'OFF'}
        </Button>
      </div>
      
      <div className="grid grid-cols-5 gap-2">
        <div className="flex flex-col items-center">
          <Knob
            value={tap.delayTime}
            min={1}
            max={2000}
            step={1}
            onChange={(v) => onChange({ delayTime: v })}
            size="sm"
            label="Temps"
            unit="ms"
          />
        </div>
        
        <div className="flex flex-col items-center">
          <Knob
            value={tap.volume}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => onChange({ volume: v })}
            size="sm"
            label="Vol"
            valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
          />
        </div>
        
        <div className="flex flex-col items-center">
          <Knob
            value={tap.pan}
            min={-1}
            max={1}
            step={0.01}
            onChange={(v) => onChange({ pan: v })}
            size="sm"
            label="Pan"
            valueFormatter={(v: number) => {
              if (Math.abs(v) < 0.05) return 'C';
              return v < 0 ? `L${Math.round(Math.abs(v) * 100)}` : `R${Math.round(v * 100)}`;
            }}
          />
        </div>
        
        <div className="flex flex-col items-center">
          <Knob
            value={tap.feedback}
            min={0}
            max={0.95}
            step={0.01}
            onChange={(v) => onChange({ feedback: v })}
            size="sm"
            label="Rétro"
            valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
          />
        </div>
        
        <div className="flex flex-col items-center">
          <Knob
            value={tap.filterFreq}
            min={200}
            max={20000}
            step={100}
            onChange={(v) => onChange({ filterFreq: v })}
            size="sm"
            label="Filter"
            valueFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`}
          />
        </div>
      </div>
    </div>
  );
});

TapControls.displayName = 'TapControls';

/**
 * MultitapEcho effect UI
 */
export const MultitapEchoUI: React.FC<MultitapEchoProps> = memo(({
  params,
  taps,
  onParamChange,
  onTapChange,
  onTapPresetLoad,
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
  bypassed = false,
  onBypassToggle,
  tempo = 120,
}) => {
  const [showPresets, setShowPresets] = useState(false);
  const [showTapPresets, setShowTapPresets] = useState(false);
  const [selectedTap, setSelectedTap] = useState(0);
  const [viewMode, setViewMode] = useState<'visual' | 'list'>('visual');

  const handleKnobChange = useCallback((key: keyof MultitapEchoParams) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  const handleTapChange = useCallback((index: number) => (config: Partial<TapConfig>) => {
    onTapChange(index, config);
  }, [onTapChange]);

  return (
    <div className={`bg-daw-bg-secondary rounded-lg p-4 border border-daw-border ${bypassed ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#8286ef] rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">MultitapEcho</h3>
            <p className="text-xs text-daw-text-muted">{taps.filter(t => t.enabled).length} taps actifs</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-daw-bg-surface rounded overflow-hidden">
            <button
              className={`px-2 py-1 text-xs ${viewMode === 'visual' ? 'bg-daw-accent text-white' : 'text-daw-text-secondary'}`}
              onClick={() => setViewMode('visual')}
            >
              Visual
            </button>
            <button
              className={`px-2 py-1 text-xs ${viewMode === 'list' ? 'bg-daw-accent text-white' : 'text-daw-text-secondary'}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
          
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

      {/* Tap Visualizer */}
      {viewMode === 'visual' && (
        <div className="flex justify-center mb-4">
          <TapVisualizer
            taps={taps}
            selectedTap={selectedTap}
            onTapSelect={setSelectedTap}
            onTapChange={onTapChange}
          />
        </div>
      )}

      {/* Tap Presets */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-daw-text-muted">Motifs de taps :</span>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTapPresets(!showTapPresets)}
          >
            Select Pattern
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </Button>
          
          {showTapPresets && (
            <div className="absolute left-0 top-full mt-1 bg-daw-bg-elevated border border-daw-border rounded-lg shadow-xl z-50 min-w-[120px] py-1">
              {tapPresets.map((preset) => (
                <button
                  key={preset.value}
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-daw-bg-surface text-daw-text-secondary"
                  onClick={() => {
                    onTapPresetLoad?.(preset.value);
                    setShowTapPresets(false);
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {params.tempoSync > 0.5 && (
          <span className="text-xs text-purple-400 ml-auto">
            Synchronisé à {tempo} BPM
          </span>
        )}
      </div>

      {/* Selected Tap Controls (Visual Mode) */}
      {viewMode === 'visual' && (
        <div className="mb-4">
          <TapControls
            tap={taps[selectedTap]}
            index={selectedTap}
            onChange={handleTapChange(selectedTap)}
          />
        </div>
      )}

      {/* All Tap Controls (List Mode) */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-2 gap-2 mb-4 max-h-[300px] overflow-y-auto">
          {taps.map((tap, index) => (
            <TapControls
              key={index}
              tap={tap}
              index={index}
              onChange={handleTapChange(index)}
            />
          ))}
        </div>
      )}

      {/* Master Controls */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide text-center">Mélange</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.wet}
              min={0}
              max={1}
              step={0.01}
              onChange={handleKnobChange('wet')}
              size="lg"
              label="Mouillé"
              valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
          </div>
        </div>

        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide text-center">Rétroaction</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.masterFeedback}
              min={0}
              max={0.95}
              step={0.01}
              onChange={handleKnobChange('masterFeedback')}
              size="lg"
              label="Principal"
              valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
          </div>
        </div>

        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide text-center">Synchro</h4>
          <div className="flex flex-col items-center gap-2">
            <Button
              variant={params.tempoSync > 0.5 ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onParamChange('tempoSync', params.tempoSync > 0.5 ? 0 : 1)}
              className="w-full"
            >
              {params.tempoSync > 0.5 ? 'SYNCHRO ON' : 'SYNCHRO OFF'}
            </Button>
            <span className="text-xs text-daw-text-muted">{tempo} BPM</span>
          </div>
        </div>
      </div>
    </div>
  );
});

MultitapEchoUI.displayName = 'MultitapEchoUI';

export default MultitapEchoUI;