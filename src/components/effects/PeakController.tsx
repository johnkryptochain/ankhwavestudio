// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * PeakController UI Component - Visual interface for the PeakController effect
 */

import React, { useCallback, useState, useEffect, useRef, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

interface PeakControllerParams {
  attack: number;
  release: number;
  threshold: number;
  amount: number;
  tilt: number;
  muteOutput: number;
  invert: number;
  absolute: number;
}

interface PeakControllerPreset {
  name: string;
  params: Partial<PeakControllerParams>;
}

interface PeakControllerProps {
  params: PeakControllerParams;
  onParamChange: (key: keyof PeakControllerParams, value: number) => void;
  getOutputValue?: () => number;
  getEnvelopeLevel?: () => number;
  getPeakLevel?: () => number;
  onResetPeak?: () => void;
  presets?: PeakControllerPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  bypassed?: boolean;
  onBypassToggle?: () => void;
}

const defaultPresets: PeakControllerPreset[] = [
  { name: 'Fast Response', params: { attack: 0.005, release: 0.05, threshold: -20, amount: 1 } },
  { name: 'Slow Response', params: { attack: 0.1, release: 0.5, threshold: -30, amount: 1 } },
  { name: 'Bass Follower', params: { attack: 0.02, release: 0.1, tilt: -0.8 } },
  { name: 'Treble Follower', params: { attack: 0.005, release: 0.05, tilt: 0.8 } },
  { name: 'Ducking', params: { attack: 0.01, release: 0.2, invert: 1 } },
];

/**
 * Envelope display component
 */
const EnvelopeDisplay: React.FC<{
  envelopeLevel: number;
  peakLevel: number;
  outputValue: number;
  threshold: number;
  invert: boolean;
}> = memo(({ envelopeLevel, peakLevel, outputValue, threshold, invert }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>([]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = 10;
    
    // Update history
    historyRef.current.push(envelopeLevel);
    if (historyRef.current.length > width - padding * 2) {
      historyRef.current.shift();
    }
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 4; i++) {
      const y = padding + (i / 4) * (height - padding * 2);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    // Draw threshold line
    const thresholdLinear = Math.pow(10, threshold / 20);
    const thresholdY = height - padding - thresholdLinear * (height - padding * 2);
    ctx.strokeStyle = '#ef4444';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding, thresholdY);
    ctx.lineTo(width - padding, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw envelope history
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const history = historyRef.current;
    for (let i = 0; i < history.length; i++) {
      const x = padding + i;
      const y = height - padding - history[i] * (height - padding * 2);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Draw peak line
    const peakY = height - padding - peakLevel * (height - padding * 2);
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, peakY);
    ctx.lineTo(width - padding, peakY);
    ctx.stroke();
    
    // Draw current level indicator
    const currentY = height - padding - envelopeLevel * (height - padding * 2);
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(width - padding - 5, currentY, 5, 0, Math.PI * 2);
    ctx.fill();
    
  }, [envelopeLevel, peakLevel, threshold]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={200}
        height={100}
        className="bg-daw-bg-primary rounded border border-daw-border"
      />
      <div className="absolute bottom-1 left-2 text-[10px] text-daw-text-muted">
        Enveloppe
      </div>
    </div>
  );
});

EnvelopeDisplay.displayName = 'EnvelopeDisplay';

/**
 * Output meter component
 */
const OutputMeter: React.FC<{
  value: number;
  invert: boolean;
}> = memo(({ value, invert }) => {
  const displayValue = invert ? 1 - value : value;
  
  return (
    <div className="flex flex-col items-center">
      <div className="w-8 h-24 bg-daw-bg-primary rounded border border-daw-border relative overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-75"
          style={{
            height: `${displayValue * 100}%`,
            background: `linear-gradient(to top, #22c55e, #eab308, #ef4444)`
          }}
        />
        {/* Scale markers */}
        {[0, 25, 50, 75, 100].map(pct => (
          <div
            key={pct}
            className="absolute left-0 right-0 border-t border-white/10"
            style={{ bottom: `${pct}%` }}
          />
        ))}
      </div>
      <span className="text-[10px] text-daw-text-muted mt-1">Sortie</span>
      <span className="text-xs text-daw-text-primary font-mono">
        {(displayValue * 100).toFixed(0)}%
      </span>
    </div>
  );
});

OutputMeter.displayName = 'OutputMeter';

/**
 * PeakController effect UI
 */
export const PeakControllerUI: React.FC<PeakControllerProps> = memo(({
  params,
  onParamChange,
  getOutputValue,
  getEnvelopeLevel,
  getPeakLevel,
  onResetPeak,
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
  bypassed = false,
  onBypassToggle,
}) => {
  const [showPresets, setShowPresets] = useState(false);
  const [outputValue, setOutputValue] = useState(0);
  const [envelopeLevel, setEnvelopeLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  
  const animationRef = useRef<number>(0);
  
  // Update display values
  useEffect(() => {
    const updateValues = () => {
      if (getOutputValue) setOutputValue(getOutputValue());
      if (getEnvelopeLevel) setEnvelopeLevel(getEnvelopeLevel());
      if (getPeakLevel) setPeakLevel(getPeakLevel());
      
      animationRef.current = requestAnimationFrame(updateValues);
    };
    
    animationRef.current = requestAnimationFrame(updateValues);
    
    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [getOutputValue, getEnvelopeLevel, getPeakLevel]);

  const handleParamChange = useCallback((key: keyof PeakControllerParams) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  return (
    <div className={`bg-daw-bg-secondary rounded-lg p-4 border border-daw-border ${bypassed ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-600 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">PeakController</h3>
            <p className="text-xs text-daw-text-muted">Suiveur d'enveloppe</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Reset peak */}
          {onResetPeak && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetPeak}
            >
              Réinitialiser
            </Button>
          )}
          
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
                      index === currentPresetIndex ? 'text-yellow-400' : 'text-daw-text-secondary'
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

      {/* Display section */}
      <div className="flex gap-4 mb-4">
        <EnvelopeDisplay
          envelopeLevel={envelopeLevel}
          peakLevel={peakLevel}
          outputValue={outputValue}
          threshold={params.threshold}
          invert={params.invert > 0.5}
        />
        
        <OutputMeter
          value={outputValue}
          invert={params.invert > 0.5}
        />
      </div>

      {/* Main controls */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Attaque</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.attack}
              min={0.001}
              max={1}
              step={0.001}
              onChange={handleParamChange('attack')}
              size="md"
              valueFormatter={(v: number) => v < 0.1 ? `${(v * 1000).toFixed(0)}ms` : `${v.toFixed(2)}s`}
            />
          </div>
        </div>

        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Relâchement</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.release}
              min={0.001}
              max={2}
              step={0.001}
              onChange={handleParamChange('release')}
              size="md"
              valueFormatter={(v: number) => v < 0.1 ? `${(v * 1000).toFixed(0)}ms` : `${v.toFixed(2)}s`}
            />
          </div>
        </div>

        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Seuil</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.threshold}
              min={-60}
              max={0}
              step={0.5}
              onChange={handleParamChange('threshold')}
              size="md"
              unit=" dB"
              valueFormatter={(v: number) => v.toFixed(1)}
            />
          </div>
        </div>

        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Quantité</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.amount}
              min={0}
              max={2}
              step={0.01}
              onChange={handleParamChange('amount')}
              size="md"
              valueFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            />
          </div>
        </div>
      </div>

      {/* Secondary controls */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Inclinaison</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.tilt}
              min={-1}
              max={1}
              step={0.01}
              onChange={handleParamChange('tilt')}
              size="md"
              valueFormatter={(v: number) => {
                if (Math.abs(v) < 0.05) return 'Plat';
                return v < 0 ? `Grave ${Math.round(Math.abs(v) * 100)}%` : `Aigu ${Math.round(v * 100)}%`;
              }}
            />
          </div>
        </div>

        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Options</h4>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              variant={params.muteOutput > 0.5 ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onParamChange('muteOutput', params.muteOutput > 0.5 ? 0 : 1)}
            >
              Muet
            </Button>
            <Button
              variant={params.invert > 0.5 ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onParamChange('invert', params.invert > 0.5 ? 0 : 1)}
            >
              Inverser
            </Button>
            <Button
              variant={params.absolute > 0.5 ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onParamChange('absolute', params.absolute > 0.5 ? 0 : 1)}
            >
              Abs
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

PeakControllerUI.displayName = 'PeakControllerUI';

export default PeakControllerUI;