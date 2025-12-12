// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * DynamicsProcessor UI Component - Visual interface for the DynamicsProcessor effect
 */

import React, { useCallback, useState, useEffect, useRef, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

interface DynamicsProcessorParams {
  compThreshold: number;
  compRatio: number;
  compAttack: number;
  compRelease: number;
  compKnee: number;
  compEnabled: number;
  gateThreshold: number;
  gateRatio: number;
  gateAttack: number;
  gateRelease: number;
  gateEnabled: number;
  limiterThreshold: number;
  limiterEnabled: number;
  sidechainEnabled: number;
  sidechainFilterFreq: number;
  sidechainFilterType: number;
  inputGain: number;
  outputGain: number;
  autoMakeup: number;
  lookahead: number;
}

interface DynamicsProcessorPreset {
  name: string;
  params: Partial<DynamicsProcessorParams>;
}

interface DynamicsProcessorProps {
  params: DynamicsProcessorParams;
  onParamChange: (key: keyof DynamicsProcessorParams, value: number) => void;
  getInputLevel?: () => number;
  getGainReduction?: () => number;
  getGateEnvelope?: () => number;
  presets?: DynamicsProcessorPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  bypassed?: boolean;
  onBypassToggle?: () => void;
}

const defaultPresets: DynamicsProcessorPreset[] = [
  { name: 'Gentle', params: { compThreshold: -18, compRatio: 2, compKnee: 10 } },
  { name: 'Heavy', params: { compThreshold: -30, compRatio: 8, compKnee: 3 } },
  { name: 'Limiting', params: { compThreshold: -6, compRatio: 20, compKnee: 0 } },
  { name: 'Vocal', params: { compThreshold: -24, compRatio: 3, gateEnabled: 1 } },
  { name: 'Drums', params: { compThreshold: -18, compRatio: 4, gateEnabled: 1 } },
];

/**
 * Transfer curve display
 */
const TransferCurveDisplay: React.FC<{
  threshold: number;
  ratio: number;
  knee: number;
  gateThreshold: number;
  gateEnabled: boolean;
}> = memo(({ threshold, ratio, knee, gateThreshold, gateEnabled }) => {
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
    
    // Grid lines every 12dB
    for (let db = -60; db <= 0; db += 12) {
      const x = padding + ((db + 60) / 60) * (width - padding * 2);
      const y = height - padding - ((db + 60) / 60) * (height - padding * 2);
      
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    // Draw 1:1 line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, padding);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw transfer curve
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i <= width - padding * 2; i++) {
      const inputDb = -60 + (i / (width - padding * 2)) * 60;
      let outputDb: number;
      
      // Gate region
      if (gateEnabled && inputDb < gateThreshold) {
        outputDb = -60;
      }
      // Below threshold (1:1)
      else if (inputDb < threshold - knee / 2) {
        outputDb = inputDb;
      }
      // Knee region
      else if (inputDb < threshold + knee / 2 && knee > 0) {
        const kneeStart = threshold - knee / 2;
        const kneeProgress = (inputDb - kneeStart) / knee;
        const kneeRatio = 1 + (ratio - 1) * kneeProgress;
        outputDb = kneeStart + (inputDb - kneeStart) / kneeRatio;
      }
      // Above threshold (compressed)
      else {
        outputDb = threshold + (inputDb - threshold) / ratio;
      }
      
      const x = padding + i;
      const y = height - padding - ((outputDb + 60) / 60) * (height - padding * 2);
      
      if (i === 0) {
        ctx.moveTo(x, Math.max(padding, Math.min(height - padding, y)));
      } else {
        ctx.lineTo(x, Math.max(padding, Math.min(height - padding, y)));
      }
    }
    ctx.stroke();
    
    // Draw threshold marker
    const threshX = padding + ((threshold + 60) / 60) * (width - padding * 2);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(threshX, padding);
    ctx.lineTo(threshX, height - padding);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw gate threshold marker
    if (gateEnabled) {
      const gateX = padding + ((gateThreshold + 60) / 60) * (width - padding * 2);
      ctx.strokeStyle = '#f59e0b';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(gateX, padding);
      ctx.lineTo(gateX, height - padding);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Entrée (dB)', width / 2, height - 3);
    
    ctx.save();
    ctx.translate(8, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Sortie (dB)', 0, 0);
    ctx.restore();
    
  }, [threshold, ratio, knee, gateThreshold, gateEnabled]);

  return (
    <canvas
      ref={canvasRef}
      width={180}
      height={180}
      className="rounded border border-daw-border"
    />
  );
});

TransferCurveDisplay.displayName = 'TransferCurveDisplay';

/**
 * Gain reduction meter
 */
const GainReductionMeter: React.FC<{
  reduction: number;
  inputLevel: number;
}> = memo(({ reduction, inputLevel }) => {
  const reductionDb = Math.abs(reduction);
  const reductionPct = Math.min(100, (reductionDb / 24) * 100);
  const inputPct = Math.min(100, ((inputLevel + 60) / 60) * 100);
  
  return (
    <div className="flex gap-2">
      {/* Input meter */}
      <div className="flex flex-col items-center">
        <div className="w-4 h-32 bg-daw-bg-primary rounded border border-daw-border relative overflow-hidden">
          <div
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 via-yellow-500 to-red-500 transition-all duration-75"
            style={{ height: `${inputPct}%` }}
          />
        </div>
        <span className="text-[9px] text-daw-text-muted mt-1">IN</span>
      </div>
      
      {/* GR meter */}
      <div className="flex flex-col items-center">
        <div className="w-4 h-32 bg-daw-bg-primary rounded border border-daw-border relative overflow-hidden">
          <div
            className="absolute top-0 left-0 right-0 bg-gradient-to-b from-red-500 to-orange-500 transition-all duration-75"
            style={{ height: `${reductionPct}%` }}
          />
        </div>
        <span className="text-[9px] text-daw-text-muted mt-1">GR</span>
      </div>
    </div>
  );
});

GainReductionMeter.displayName = 'GainReductionMeter';

/**
 * DynamicsProcessor effect UI
 */
export const DynamicsProcessorUI: React.FC<DynamicsProcessorProps> = memo(({
  params,
  onParamChange,
  getInputLevel,
  getGainReduction,
  getGateEnvelope,
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
  bypassed = false,
  onBypassToggle,
}) => {
  const [showPresets, setShowPresets] = useState(false);
  const [activeSection, setActiveSection] = useState<'comp' | 'gate' | 'limiter' | 'sidechain'>('comp');
  const [inputLevel, setInputLevel] = useState(-60);
  const [gainReduction, setGainReduction] = useState(0);
  
  const animationRef = useRef<number>(0);
  
  // Update meters
  useEffect(() => {
    const updateMeters = () => {
      if (getInputLevel) setInputLevel(getInputLevel());
      if (getGainReduction) setGainReduction(getGainReduction());
      
      animationRef.current = requestAnimationFrame(updateMeters);
    };
    
    animationRef.current = requestAnimationFrame(updateMeters);
    
    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [getInputLevel, getGainReduction]);

  const handleParamChange = useCallback((key: keyof DynamicsProcessorParams) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  return (
    <div className={`bg-daw-bg-secondary rounded-lg p-4 border border-daw-border ${bypassed ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-600 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Dynamics</h3>
            <p className="text-xs text-daw-text-muted">Compresseur + Porte + Limiteur</p>
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
                      index === currentPresetIndex ? 'text-red-400' : 'text-daw-text-secondary'
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

      {/* Main display */}
      <div className="flex gap-4 mb-4">
        <TransferCurveDisplay
          threshold={params.compThreshold}
          ratio={params.compRatio}
          knee={params.compKnee}
          gateThreshold={params.gateThreshold}
          gateEnabled={params.gateEnabled > 0.5}
        />
        
        <GainReductionMeter
          reduction={gainReduction}
          inputLevel={inputLevel}
        />
        
        {/* Quick info */}
        <div className="flex-1 flex flex-col justify-center gap-2">
          <div className="text-xs text-daw-text-muted">
            <span className="text-cyan-400">Comp:</span> {params.compEnabled > 0.5 ? 'ON' : 'OFF'}
          </div>
          <div className="text-xs text-daw-text-muted">
            <span className="text-yellow-400">Gate:</span> {params.gateEnabled > 0.5 ? 'ON' : 'OFF'}
          </div>
          <div className="text-xs text-daw-text-muted">
            <span className="text-red-400">Limiter:</span> {params.limiterEnabled > 0.5 ? 'ON' : 'OFF'}
          </div>
          <div className="text-xs text-daw-text-muted mt-2">
            GR: <span className="text-red-400 font-mono">{gainReduction.toFixed(1)} dB</span>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-4">
        {(['comp', 'gate', 'limiter', 'sidechain'] as const).map((section) => (
          <button
            key={section}
            className={`flex-1 px-2 py-1 text-xs rounded ${
              activeSection === section ? 'bg-daw-accent text-white' : 'bg-daw-bg-surface text-daw-text-secondary'
            }`}
            onClick={() => setActiveSection(section)}
          >
            {section === 'comp' ? 'Compressor' : 
             section === 'gate' ? 'Gate' : 
             section === 'limiter' ? 'Limiter' : 'Sidechain'}
          </button>
        ))}
      </div>

      {/* Compressor section */}
      {activeSection === 'comp' && (
        <div className="bg-daw-bg-surface rounded p-3">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-cyan-400">Compresseur</h4>
            <Button
              variant={params.compEnabled > 0.5 ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onParamChange('compEnabled', params.compEnabled > 0.5 ? 0 : 1)}
            >
              {params.compEnabled > 0.5 ? 'ON' : 'OFF'}
            </Button>
          </div>
          
          <div className="grid grid-cols-5 gap-2">
            <Knob value={params.compThreshold} min={-60} max={0} step={0.5} onChange={handleParamChange('compThreshold')} size="sm" label="Thresh" unit=" dB" />
            <Knob value={params.compRatio} min={1} max={20} step={0.1} onChange={handleParamChange('compRatio')} size="sm" label="Ratio" valueFormatter={(v: number) => `${v.toFixed(1)}:1`} />
            <Knob value={params.compAttack} min={0.001} max={1} step={0.001} onChange={handleParamChange('compAttack')} size="sm" label="Attack" valueFormatter={(v: number) => v < 0.1 ? `${(v*1000).toFixed(0)}ms` : `${v.toFixed(2)}s`} />
            <Knob value={params.compRelease} min={0.01} max={2} step={0.01} onChange={handleParamChange('compRelease')} size="sm" label="Release" valueFormatter={(v: number) => `${v.toFixed(2)}s`} />
            <Knob value={params.compKnee} min={0} max={40} step={0.5} onChange={handleParamChange('compKnee')} size="sm" label="Coude" unit=" dB" />
          </div>
        </div>
      )}

      {/* Gate section */}
      {activeSection === 'gate' && (
        <div className="bg-daw-bg-surface rounded p-3">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-yellow-400">Porte / Expandeur</h4>
            <Button
              variant={params.gateEnabled > 0.5 ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onParamChange('gateEnabled', params.gateEnabled > 0.5 ? 0 : 1)}
            >
              {params.gateEnabled > 0.5 ? 'ON' : 'OFF'}
            </Button>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            <Knob value={params.gateThreshold} min={-80} max={0} step={0.5} onChange={handleParamChange('gateThreshold')} size="sm" label="Thresh" unit=" dB" />
            <Knob value={params.gateRatio} min={1} max={100} step={1} onChange={handleParamChange('gateRatio')} size="sm" label="Ratio" valueFormatter={(v: number) => `${v.toFixed(0)}:1`} />
            <Knob value={params.gateAttack} min={0.001} max={0.5} step={0.001} onChange={handleParamChange('gateAttack')} size="sm" label="Attack" valueFormatter={(v: number) => `${(v*1000).toFixed(0)}ms`} />
            <Knob value={params.gateRelease} min={0.01} max={2} step={0.01} onChange={handleParamChange('gateRelease')} size="sm" label="Release" valueFormatter={(v: number) => `${v.toFixed(2)}s`} />
          </div>
        </div>
      )}

      {/* Limiter section */}
      {activeSection === 'limiter' && (
        <div className="bg-daw-bg-surface rounded p-3">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-red-400">Limiteur</h4>
            <Button
              variant={params.limiterEnabled > 0.5 ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onParamChange('limiterEnabled', params.limiterEnabled > 0.5 ? 0 : 1)}
            >
              {params.limiterEnabled > 0.5 ? 'ON' : 'OFF'}
            </Button>
          </div>
          
          <div className="flex justify-center">
            <Knob value={params.limiterThreshold} min={-12} max={0} step={0.1} onChange={handleParamChange('limiterThreshold')} size="lg" label="Plafond" unit=" dB" />
          </div>
        </div>
      )}

      {/* Sidechain section */}
      {activeSection === 'sidechain' && (
        <div className="bg-daw-bg-surface rounded p-3">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-purple-400">Filtre Sidechain</h4>
            <Button
              variant={params.sidechainEnabled > 0.5 ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onParamChange('sidechainEnabled', params.sidechainEnabled > 0.5 ? 0 : 1)}
            >
              {params.sidechainEnabled > 0.5 ? 'ON' : 'OFF'}
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Knob value={params.sidechainFilterFreq} min={20} max={20000} step={10} onChange={handleParamChange('sidechainFilterFreq')} size="md" label="Fréquence" valueFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${Math.round(v)}`} />
            
            <div>
              <span className="text-xs text-daw-text-muted block mb-2">Type de filtre</span>
              <div className="flex gap-1">
                {['HP', 'LP', 'BP'].map((type, idx) => (
                  <button
                    key={type}
                    className={`flex-1 px-2 py-1 text-xs rounded ${
                      params.sidechainFilterType === idx ? 'bg-daw-accent text-white' : 'bg-daw-bg-primary text-daw-text-muted'
                    }`}
                    onClick={() => onParamChange('sidechainFilterType', idx)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gain controls */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="bg-daw-bg-surface rounded p-2">
          <Knob value={params.inputGain} min={-24} max={24} step={0.5} onChange={handleParamChange('inputGain')} size="sm" label="Entrée" unit=" dB" />
        </div>
        <div className="bg-daw-bg-surface rounded p-2">
          <Knob value={params.outputGain} min={-24} max={24} step={0.5} onChange={handleParamChange('outputGain')} size="sm" label="Sortie" unit=" dB" />
        </div>
        <div className="bg-daw-bg-surface rounded p-2 flex flex-col items-center justify-center">
          <Button
            variant={params.autoMakeup > 0.5 ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onParamChange('autoMakeup', params.autoMakeup > 0.5 ? 0 : 1)}
          >
            Auto Makeup
          </Button>
        </div>
      </div>
    </div>
  );
});

DynamicsProcessorUI.displayName = 'DynamicsProcessorUI';

export default DynamicsProcessorUI;