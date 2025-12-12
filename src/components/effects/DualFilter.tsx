// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * DualFilter UI Component - Visual interface for the DualFilter effect
 */

import React, { useCallback, useState, useEffect, useRef, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';
type FilterMixMode = 'serial' | 'parallel';

interface DualFilterParams {
  filter1Type: number;
  filter1Freq: number;
  filter1Res: number;
  filter1Enabled: number;
  filter2Type: number;
  filter2Freq: number;
  filter2Res: number;
  filter2Enabled: number;
  mixMode: number;
  filterMix: number;
  lfo1Rate: number;
  lfo1Depth: number;
  lfo1Target: number;
  lfo2Rate: number;
  lfo2Depth: number;
  lfo2Target: number;
  envelopeEnabled: number;
  envelopeAmount: number;
  envelopeTarget: number;
}

interface DualFilterPreset {
  name: string;
  params: Partial<DualFilterParams>;
}

interface DualFilterProps {
  params: DualFilterParams;
  onParamChange: (key: keyof DualFilterParams, value: number) => void;
  presets?: DualFilterPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  bypassed?: boolean;
  onBypassToggle?: () => void;
  getFrequencyResponse?: () => { filter1: Float32Array; filter2: Float32Array } | null;
}

const filterTypes = ['Passe-bas', 'Passe-haut', 'Passe-bande', 'Coupe-bande'];
const lfoTargets = ['Filtre 1', 'Filtre 2', 'Les deux'];

const defaultPresets: DualFilterPreset[] = [
  { name: 'Bandpass Sweep', params: { filter1Type: 0, filter1Freq: 1000, filter2Type: 1, filter2Freq: 500, lfo1Depth: 0.5 } },
  { name: 'Parallel Filters', params: { filter1Type: 0, filter1Freq: 800, filter2Type: 1, filter2Freq: 2000, mixMode: 1 } },
  { name: 'Wah Effect', params: { filter1Type: 2, filter1Freq: 1500, filter1Res: 15, lfo1Rate: 2, lfo1Depth: 0.8 } },
  { name: 'Notch Sweep', params: { filter1Type: 3, filter2Type: 3, lfo1Depth: 0.6, lfo2Depth: 0.6 } },
];

/**
 * Frequency response visualization
 */
const FrequencyResponseDisplay: React.FC<{
  filter1Freq: number;
  filter1Res: number;
  filter1Type: number;
  filter1Enabled: boolean;
  filter2Freq: number;
  filter2Res: number;
  filter2Type: number;
  filter2Enabled: boolean;
  mixMode: FilterMixMode;
}> = memo(({ filter1Freq, filter1Res, filter1Type, filter1Enabled, filter2Freq, filter2Res, filter2Type, filter2Enabled, mixMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = 10;
    
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
    for (let db = -24; db <= 12; db += 12) {
      const y = height / 2 - (db / 36) * (height - padding * 2);
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
    
    // Helper function to calculate filter response (simplified)
    const calculateResponse = (freq: number, cutoff: number, res: number, type: number): number => {
      const ratio = freq / cutoff;
      const q = res;
      
      switch (type) {
        case 0: // Lowpass
          return 1 / Math.sqrt(1 + Math.pow(ratio, 4) * (1 - 1 / (q * q)));
        case 1: // Highpass
          return Math.pow(ratio, 2) / Math.sqrt(1 + Math.pow(ratio, 4) * (1 - 1 / (q * q)));
        case 2: // Bandpass
          return (ratio / q) / Math.sqrt(1 + Math.pow(ratio - 1 / ratio, 2) * q * q);
        case 3: // Notch
          return Math.abs(1 - ratio * ratio) / Math.sqrt(1 + Math.pow(ratio - 1 / ratio, 2) * q * q);
        default:
          return 1;
      }
    };
    
    // Draw filter 1 response
    if (filter1Enabled) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < width - padding * 2; i++) {
        const freq = 20 * Math.pow(20000 / 20, i / (width - padding * 2));
        const response = calculateResponse(freq, filter1Freq, filter1Res, filter1Type);
        const db = 20 * Math.log10(Math.max(0.001, response));
        const y = height / 2 - (db / 36) * (height - padding * 2);
        
        if (i === 0) {
          ctx.moveTo(padding + i, y);
        } else {
          ctx.lineTo(padding + i, y);
        }
      }
      ctx.stroke();
    }
    
    // Draw filter 2 response
    if (filter2Enabled) {
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < width - padding * 2; i++) {
        const freq = 20 * Math.pow(20000 / 20, i / (width - padding * 2));
        const response = calculateResponse(freq, filter2Freq, filter2Res, filter2Type);
        const db = 20 * Math.log10(Math.max(0.001, response));
        const y = height / 2 - (db / 36) * (height - padding * 2);
        
        if (i === 0) {
          ctx.moveTo(padding + i, y);
        } else {
          ctx.lineTo(padding + i, y);
        }
      }
      ctx.stroke();
    }
    
    // Draw combined response
    if (filter1Enabled && filter2Enabled) {
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      
      for (let i = 0; i < width - padding * 2; i++) {
        const freq = 20 * Math.pow(20000 / 20, i / (width - padding * 2));
        const response1 = calculateResponse(freq, filter1Freq, filter1Res, filter1Type);
        const response2 = calculateResponse(freq, filter2Freq, filter2Res, filter2Type);
        
        let combined: number;
        if (mixMode === 'serial') {
          combined = response1 * response2;
        } else {
          combined = (response1 + response2) / 2;
        }
        
        const db = 20 * Math.log10(Math.max(0.001, combined));
        const y = height / 2 - (db / 36) * (height - padding * 2);
        
        if (i === 0) {
          ctx.moveTo(padding + i, y);
        } else {
          ctx.lineTo(padding + i, y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Draw frequency labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('100', padding + (Math.log10(100 / 20) / Math.log10(20000 / 20)) * (width - padding * 2), height - 2);
    ctx.fillText('1k', padding + (Math.log10(1000 / 20) / Math.log10(20000 / 20)) * (width - padding * 2), height - 2);
    ctx.fillText('10k', padding + (Math.log10(10000 / 20) / Math.log10(20000 / 20)) * (width - padding * 2), height - 2);
    
  }, [filter1Freq, filter1Res, filter1Type, filter1Enabled, filter2Freq, filter2Res, filter2Type, filter2Enabled, mixMode]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={320}
        height={100}
        className="bg-daw-bg-primary rounded border border-daw-border"
      />
      <div className="absolute bottom-1 right-2 flex items-center gap-2 text-[10px]">
        <span className="text-cyan-400">F1</span>
        <span className="text-pink-400">F2</span>
        <span className="text-purple-400">Combiné</span>
      </div>
    </div>
  );
});

FrequencyResponseDisplay.displayName = 'FrequencyResponseDisplay';

/**
 * Filter section component
 */
const FilterSection: React.FC<{
  filterNum: 1 | 2;
  type: number;
  freq: number;
  res: number;
  enabled: boolean;
  onTypeChange: (type: number) => void;
  onFreqChange: (freq: number) => void;
  onResChange: (res: number) => void;
  onEnabledChange: (enabled: boolean) => void;
  color: string;
}> = memo(({ filterNum, type, freq, res, enabled, onTypeChange, onFreqChange, onResChange, onEnabledChange, color }) => {
  return (
    <div className={`bg-daw-bg-surface rounded p-3 ${!enabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className={`text-sm font-medium ${color}`}>Filtre {filterNum}</h4>
        <Button
          variant={enabled ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onEnabledChange(!enabled)}
        >
          {enabled ? 'ON' : 'OFF'}
        </Button>
      </div>
      
      {/* Filter type selector */}
      <div className="flex gap-1 mb-3">
        {filterTypes.map((typeName, idx) => (
          <button
            key={idx}
            className={`flex-1 px-1 py-1 text-[10px] rounded ${
              type === idx ? `bg-daw-accent text-white` : 'bg-daw-bg-primary text-daw-text-secondary'
            }`}
            onClick={() => onTypeChange(idx)}
          >
            {typeName.slice(0, 2).toUpperCase()}
          </button>
        ))}
      </div>
      
      {/* Frequency and Resonance */}
      <div className="flex gap-3 justify-center">
        <Knob
          value={freq}
          min={20}
          max={20000}
          step={1}
          onChange={onFreqChange}
          size="md"
          label="Fréq"
          valueFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`}
        />
        <Knob
          value={res}
          min={0.1}
          max={30}
          step={0.1}
          onChange={onResChange}
          size="md"
          label="Rés"
          valueFormatter={(v: number) => v.toFixed(1)}
        />
      </div>
    </div>
  );
});

FilterSection.displayName = 'FilterSection';

/**
 * LFO section component
 */
const LfoSection: React.FC<{
  lfoNum: 1 | 2;
  rate: number;
  depth: number;
  target: number;
  onRateChange: (rate: number) => void;
  onDepthChange: (depth: number) => void;
  onTargetChange: (target: number) => void;
}> = memo(({ lfoNum, rate, depth, target, onRateChange, onDepthChange, onTargetChange }) => {
  return (
    <div className="bg-daw-bg-surface rounded p-3">
      <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">LFO {lfoNum}</h4>
      
      <div className="flex gap-2 justify-center mb-2">
        <Knob
          value={rate}
          min={0.01}
          max={20}
          step={0.01}
          onChange={onRateChange}
          size="sm"
          label="Vitesse"
          valueFormatter={(v: number) => `${v.toFixed(2)}Hz`}
        />
        <Knob
          value={depth}
          min={0}
          max={1}
          step={0.01}
          onChange={onDepthChange}
          size="sm"
          label="Profondeur"
          valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
        />
      </div>
      
      {/* Target selector */}
      <div className="flex gap-1">
        {lfoTargets.map((targetName, idx) => (
          <button
            key={idx}
            className={`flex-1 px-1 py-1 text-[10px] rounded ${
              target === idx ? 'bg-daw-accent text-white' : 'bg-daw-bg-primary text-daw-text-secondary'
            }`}
            onClick={() => onTargetChange(idx)}
          >
            {targetName}
          </button>
        ))}
      </div>
    </div>
  );
});

LfoSection.displayName = 'LfoSection';

/**
 * DualFilter effect UI
 */
export const DualFilterUI: React.FC<DualFilterProps> = memo(({
  params,
  onParamChange,
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
  bypassed = false,
  onBypassToggle,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const handleParamChange = useCallback((key: keyof DualFilterParams) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  return (
    <div className={`bg-daw-bg-secondary rounded-lg p-4 border border-daw-border ${bypassed ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-pink-500 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">DualFilter</h3>
            <p className="text-xs text-daw-text-muted">
              Mode {params.mixMode > 0.5 ? 'Parallèle' : 'Série'}
            </p>
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
                      index === currentPresetIndex ? 'text-cyan-400' : 'text-daw-text-secondary'
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

      {/* Frequency Response Display */}
      <div className="flex justify-center mb-4">
        <FrequencyResponseDisplay
          filter1Freq={params.filter1Freq}
          filter1Res={params.filter1Res}
          filter1Type={params.filter1Type}
          filter1Enabled={params.filter1Enabled > 0.5}
          filter2Freq={params.filter2Freq}
          filter2Res={params.filter2Res}
          filter2Type={params.filter2Type}
          filter2Enabled={params.filter2Enabled > 0.5}
          mixMode={params.mixMode > 0.5 ? 'parallel' : 'serial'}
        />
      </div>

      {/* Mix Mode Selector */}
      <div className="flex justify-center gap-2 mb-4">
        <button
          className={`px-4 py-1 text-sm rounded ${
            params.mixMode <= 0.5 ? 'bg-daw-accent text-white' : 'bg-daw-bg-surface text-daw-text-secondary'
          }`}
          onClick={() => onParamChange('mixMode', 0)}
        >
          Serial
        </button>
        <button
          className={`px-4 py-1 text-sm rounded ${
            params.mixMode > 0.5 ? 'bg-daw-accent text-white' : 'bg-daw-bg-surface text-daw-text-secondary'
          }`}
          onClick={() => onParamChange('mixMode', 1)}
        >
          Parallel
        </button>
        
        {params.mixMode > 0.5 && (
          <div className="flex items-center gap-2 ml-4">
            <span className="text-xs text-daw-text-muted">Mélange :</span>
            <Knob
              value={params.filterMix}
              min={0}
              max={1}
              step={0.01}
              onChange={handleParamChange('filterMix')}
              size="sm"
              valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
          </div>
        )}
      </div>

      {/* Filter Sections */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <FilterSection
          filterNum={1}
          type={params.filter1Type}
          freq={params.filter1Freq}
          res={params.filter1Res}
          enabled={params.filter1Enabled > 0.5}
          onTypeChange={handleParamChange('filter1Type')}
          onFreqChange={handleParamChange('filter1Freq')}
          onResChange={handleParamChange('filter1Res')}
          onEnabledChange={(enabled) => onParamChange('filter1Enabled', enabled ? 1 : 0)}
          color="text-cyan-400"
        />
        
        <FilterSection
          filterNum={2}
          type={params.filter2Type}
          freq={params.filter2Freq}
          res={params.filter2Res}
          enabled={params.filter2Enabled > 0.5}
          onTypeChange={handleParamChange('filter2Type')}
          onFreqChange={handleParamChange('filter2Freq')}
          onResChange={handleParamChange('filter2Res')}
          onEnabledChange={(enabled) => onParamChange('filter2Enabled', enabled ? 1 : 0)}
          color="text-pink-400"
        />
      </div>

      {/* LFO Sections */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <LfoSection
          lfoNum={1}
          rate={params.lfo1Rate}
          depth={params.lfo1Depth}
          target={params.lfo1Target}
          onRateChange={handleParamChange('lfo1Rate')}
          onDepthChange={handleParamChange('lfo1Depth')}
          onTargetChange={handleParamChange('lfo1Target')}
        />
        
        <LfoSection
          lfoNum={2}
          rate={params.lfo2Rate}
          depth={params.lfo2Depth}
          target={params.lfo2Target}
          onRateChange={handleParamChange('lfo2Rate')}
          onDepthChange={handleParamChange('lfo2Depth')}
          onTargetChange={handleParamChange('lfo2Target')}
        />
      </div>

      {/* Envelope Follower */}
      <div className="bg-daw-bg-surface rounded p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs text-daw-text-muted uppercase tracking-wide">Suiveur d'enveloppe</h4>
          <Button
            variant={params.envelopeEnabled > 0.5 ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onParamChange('envelopeEnabled', params.envelopeEnabled > 0.5 ? 0 : 1)}
          >
            {params.envelopeEnabled > 0.5 ? 'ON' : 'OFF'}
          </Button>
        </div>
        
        <div className="flex items-center gap-4">
          <Knob
            value={params.envelopeAmount}
            min={0}
            max={1}
            step={0.01}
            onChange={handleParamChange('envelopeAmount')}
            size="sm"
            label="Quantité"
            valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
          />
          
          <div className="flex gap-1 flex-1">
            {lfoTargets.map((targetName, idx) => (
              <button
                key={idx}
                className={`flex-1 px-1 py-1 text-[10px] rounded ${
                  params.envelopeTarget === idx ? 'bg-daw-accent text-white' : 'bg-daw-bg-primary text-daw-text-secondary'
                }`}
                onClick={() => onParamChange('envelopeTarget', idx)}
              >
                {targetName}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

DualFilterUI.displayName = 'DualFilterUI';

export default DualFilterUI;