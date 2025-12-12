// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Phaser UI Component - Visual interface for the Phaser effect
 */

import React, { useCallback, useState, useEffect, useRef, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

interface PhaserParams {
  stages: number;
  lfoRate: number;
  lfoDepth: number;
  feedback: number;
  stereoPhase: number;
  minFreq: number;
  maxFreq: number;
  mix: number;
}

interface PhaserPreset {
  name: string;
  params: Partial<PhaserParams>;
}

interface PhaserProps {
  params: PhaserParams;
  onParamChange: (key: keyof PhaserParams, value: number) => void;
  presets?: PhaserPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  bypassed?: boolean;
  onBypassToggle?: () => void;
}

const defaultPresets: PhaserPreset[] = [
  { name: 'Subtle', params: { stages: 4, lfoRate: 0.3, lfoDepth: 0.4, feedback: 0.3, mix: 0.5 } },
  { name: 'Classic', params: { stages: 6, lfoRate: 0.5, lfoDepth: 0.6, feedback: 0.5, mix: 0.5 } },
  { name: 'Deep', params: { stages: 8, lfoRate: 0.2, lfoDepth: 0.8, feedback: 0.7, mix: 0.6 } },
  { name: 'Fast Sweep', params: { stages: 4, lfoRate: 2, lfoDepth: 0.5, feedback: 0.4, mix: 0.5 } },
  { name: 'Jet', params: { stages: 12, lfoRate: 0.1, lfoDepth: 0.9, feedback: 0.8, mix: 0.7 } },
];

/**
 * LFO visualization component
 */
const LfoVisualization: React.FC<{
  rate: number;
  depth: number;
  stereoPhase: number;
}> = memo(({ rate, depth, stereoPhase }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const phaseRef = useRef<number>(0);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    
    let lastTime = performance.now();
    
    const draw = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      
      // Update phase
      phaseRef.current += rate * deltaTime * Math.PI * 2;
      if (phaseRef.current > Math.PI * 2) {
        phaseRef.current -= Math.PI * 2;
      }
      
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
      
      // Draw left channel LFO
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let x = 0; x < width; x++) {
        const t = (x / width) * Math.PI * 4 + phaseRef.current;
        const y = centerY - Math.sin(t) * (height / 2 - 4) * depth;
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      
      // Draw right channel LFO (with stereo phase offset)
      const stereoOffset = (stereoPhase * Math.PI) / 180;
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let x = 0; x < width; x++) {
        const t = (x / width) * Math.PI * 4 + phaseRef.current + stereoOffset;
        const y = centerY - Math.sin(t) * (height / 2 - 4) * depth;
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      
      // Draw current position indicators
      const currentYL = centerY - Math.sin(phaseRef.current) * (height / 2 - 4) * depth;
      const currentYR = centerY - Math.sin(phaseRef.current + stereoOffset) * (height / 2 - 4) * depth;
      
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(width / 2, currentYL, 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(width / 2, currentYR, 4, 0, Math.PI * 2);
      ctx.fill();
      
      animationRef.current = requestAnimationFrame(draw);
    };
    
    animationRef.current = requestAnimationFrame(draw);
    
    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [rate, depth, stereoPhase]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={200}
        height={80}
        className="bg-daw-bg-primary rounded border border-daw-border"
      />
      <div className="absolute bottom-1 left-2 text-[10px] text-cyan-400">L</div>
      <div className="absolute bottom-1 right-2 text-[10px] text-pink-400">R</div>
    </div>
  );
});

LfoVisualization.displayName = 'LfoVisualization';

/**
 * Stage selector component
 */
const StageSelector: React.FC<{
  stages: number;
  onChange: (stages: number) => void;
}> = memo(({ stages, onChange }) => {
  const stageOptions = [2, 4, 6, 8, 10, 12];
  
  return (
    <div className="flex gap-1">
      {stageOptions.map((s) => (
        <button
          key={s}
          className={`w-7 h-7 rounded flex items-center justify-center text-xs font-medium ${
            stages === s ? 'bg-daw-accent text-white' : 'bg-daw-bg-primary text-daw-text-secondary'
          }`}
          onClick={() => onChange(s)}
        >
          {s}
        </button>
      ))}
    </div>
  );
});

StageSelector.displayName = 'StageSelector';

/**
 * Frequency range visualization
 */
const FrequencyRange: React.FC<{
  minFreq: number;
  maxFreq: number;
}> = memo(({ minFreq, maxFreq }) => {
  // Calculate positions on logarithmic scale (20Hz - 20kHz)
  const minLog = Math.log10(20);
  const maxLog = Math.log10(20000);
  const range = maxLog - minLog;
  
  const minPos = ((Math.log10(minFreq) - minLog) / range) * 100;
  const maxPos = ((Math.log10(maxFreq) - minLog) / range) * 100;
  
  return (
    <div className="relative h-4 bg-daw-bg-primary rounded">
      <div
        className="absolute h-full bg-[#8286ef] rounded opacity-60"
        style={{
          left: `${minPos}%`,
          width: `${maxPos - minPos}%`,
        }}
      />
      <div className="absolute inset-0 flex justify-between items-center px-1 text-[8px] text-daw-text-muted">
        <span>20</span>
        <span>200</span>
        <span>2k</span>
        <span>20k</span>
      </div>
    </div>
  );
});

FrequencyRange.displayName = 'FrequencyRange';

/**
 * Phaser effect UI
 */
export const PhaserUI: React.FC<PhaserProps> = memo(({
  params,
  onParamChange,
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
  bypassed = false,
  onBypassToggle,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const handleParamChange = useCallback((key: keyof PhaserParams) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  return (
    <div className={`bg-daw-bg-secondary rounded-lg p-4 border border-daw-border ${bypassed ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#8286ef] rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Phaser</h3>
            <p className="text-xs text-daw-text-muted">{params.stages} Étages</p>
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

      {/* LFO Visualization */}
      <div className="flex justify-center mb-4">
        <LfoVisualization
          rate={params.lfoRate}
          depth={params.lfoDepth}
          stereoPhase={params.stereoPhase}
        />
      </div>

      {/* Stage selector */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <span className="text-xs text-daw-text-muted">Étages :</span>
        <StageSelector
          stages={params.stages}
          onChange={handleParamChange('stages')}
        />
      </div>

      {/* Main controls */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">LFO</h4>
          <div className="flex gap-2 justify-center">
            <Knob
              value={params.lfoRate}
              min={0.01}
              max={10}
              step={0.01}
              onChange={handleParamChange('lfoRate')}
              size="sm"
              label="Vitesse"
              valueFormatter={(v: number) => `${v.toFixed(2)}Hz`}
            />
            <Knob
              value={params.lfoDepth}
              min={0}
              max={1}
              step={0.01}
              onChange={handleParamChange('lfoDepth')}
              size="sm"
              label="Profondeur"
              valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
          </div>
        </div>

        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Stéréo</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.stereoPhase}
              min={0}
              max={180}
              step={1}
              onChange={handleParamChange('stereoPhase')}
              size="md"
              label="Phase"
              valueFormatter={(v: number) => `${Math.round(v)}°`}
            />
          </div>
        </div>
      </div>

      {/* Frequency range */}
      <div className="bg-daw-bg-surface rounded p-3 mb-4">
        <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Plage de balayage</h4>
        <FrequencyRange minFreq={params.minFreq} maxFreq={params.maxFreq} />
        <div className="flex gap-4 justify-center mt-2">
          <Knob
            value={params.minFreq}
            min={100}
            max={1000}
            step={10}
            onChange={handleParamChange('minFreq')}
            size="sm"
            label="Min"
            valueFormatter={(v: number) => `${Math.round(v)}Hz`}
          />
          <Knob
            value={params.maxFreq}
            min={1000}
            max={10000}
            step={100}
            onChange={handleParamChange('maxFreq')}
            size="sm"
            label="Max"
            valueFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}kHz` : `${Math.round(v)}Hz`}
          />
        </div>
      </div>

      {/* Feedback and Mix */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Rétroaction</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.feedback}
              min={-0.9}
              max={0.9}
              step={0.01}
              onChange={handleParamChange('feedback')}
              size="md"
              label="Quantité"
              valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
          </div>
        </div>

        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Sortie</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.mix}
              min={0}
              max={1}
              step={0.01}
              onChange={handleParamChange('mix')}
              size="md"
              label="Mélange"
              valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

PhaserUI.displayName = 'PhaserUI';

export default PhaserUI;