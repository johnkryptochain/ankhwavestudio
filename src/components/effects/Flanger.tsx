// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Flanger UI Component - Visual interface for the Flanger effect
 */

import React, { useCallback, useState, useEffect, useRef, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

interface FlangerParams {
  delayTime: number;
  lfoRate: number;
  lfoDepth: number;
  feedback: number;
  stereoPhase: number;
  mix: number;
}

interface FlangerPreset {
  name: string;
  params: Partial<FlangerParams>;
}

interface FlangerProps {
  params: FlangerParams;
  onParamChange: (key: keyof FlangerParams, value: number) => void;
  presets?: FlangerPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  bypassed?: boolean;
  onBypassToggle?: () => void;
}

const defaultPresets: FlangerPreset[] = [
  { name: 'Classic Jet', params: { delayTime: 3, lfoRate: 0.3, lfoDepth: 0.7, feedback: 0.7, stereoPhase: 90, mix: 0.5 } },
  { name: 'Subtle Chorus', params: { delayTime: 5, lfoRate: 0.8, lfoDepth: 0.3, feedback: 0.2, stereoPhase: 120, mix: 0.4 } },
  { name: 'Metallic', params: { delayTime: 1, lfoRate: 2, lfoDepth: 0.5, feedback: 0.8, stereoPhase: 45, mix: 0.6 } },
  { name: 'Slow Sweep', params: { delayTime: 4, lfoRate: 0.1, lfoDepth: 0.8, feedback: 0.6, stereoPhase: 90, mix: 0.5 } },
  { name: 'Fast Wobble', params: { delayTime: 2, lfoRate: 5, lfoDepth: 0.4, feedback: 0.4, stereoPhase: 60, mix: 0.5 } },
];

/**
 * LFO visualization component
 */
const LfoDisplay: React.FC<{
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
      
      // Draw left channel LFO (cyan)
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
      
      // Draw right channel LFO (magenta) with phase offset
      const phaseOffsetRad = (stereoPhase / 180) * Math.PI;
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let x = 0; x < width; x++) {
        const t = (x / width) * Math.PI * 4 + phaseRef.current + phaseOffsetRad;
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
      const currentYR = centerY - Math.sin(phaseRef.current + phaseOffsetRad) * (height / 2 - 4) * depth;
      
      // Left indicator
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(width / 2, currentYL, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Right indicator
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
        width={180}
        height={60}
        className="bg-daw-bg-primary rounded border border-daw-border"
      />
      <div className="absolute bottom-1 left-2 flex items-center gap-2 text-[10px]">
        <span className="text-cyan-400">L</span>
        <span className="text-pink-400">R</span>
      </div>
    </div>
  );
});

LfoDisplay.displayName = 'LfoDisplay';

/**
 * Flanger effect UI
 */
export const FlangerUI: React.FC<FlangerProps> = memo(({
  params,
  onParamChange,
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
  bypassed = false,
  onBypassToggle,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const handleKnobChange = useCallback((key: keyof FlangerParams) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  return (
    <div className={`bg-daw-bg-secondary rounded-lg p-4 border border-daw-border ${bypassed ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Flanger</h3>
            <p className="text-xs text-daw-text-muted">Délai modulé</p>
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

      {/* LFO Display */}
      <div className="flex justify-center mb-4">
        <LfoDisplay
          rate={params.lfoRate}
          depth={params.lfoDepth}
          stereoPhase={params.stereoPhase}
        />
      </div>

      {/* Main controls */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Delay section */}
        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide text-center">Délai</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.delayTime}
              min={0.1}
              max={10}
              step={0.1}
              onChange={handleKnobChange('delayTime')}
              size="lg"
              label="Temps"
              unit=" ms"
            />
          </div>
        </div>

        {/* LFO section */}
        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide text-center">LFO</h4>
          <div className="flex gap-3 justify-center">
            <div className="flex flex-col items-center">
              <Knob
                value={params.lfoRate}
                min={0.01}
                max={10}
                step={0.01}
                onChange={handleKnobChange('lfoRate')}
                size="md"
                label="Vitesse"
                unit=" Hz"
              />
            </div>
            <div className="flex flex-col items-center">
              <Knob
                value={params.lfoDepth}
                min={0}
                max={1}
                step={0.01}
                onChange={handleKnobChange('lfoDepth')}
                size="md"
                label="Profondeur"
                valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
            </div>
          </div>
        </div>

        {/* Feedback section */}
        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide text-center">Rétroaction</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.feedback}
              min={-0.95}
              max={0.95}
              step={0.01}
              onChange={handleKnobChange('feedback')}
              size="lg"
              label="Quantité"
              valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
          </div>
        </div>
      </div>

      {/* Stereo and Mix */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide text-center">Stéréo</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.stereoPhase}
              min={0}
              max={180}
              step={1}
              onChange={handleKnobChange('stereoPhase')}
              size="md"
              label="Phase"
              unit="°"
            />
          </div>
        </div>

        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide text-center">Sortie</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.mix}
              min={0}
              max={1}
              step={0.01}
              onChange={handleKnobChange('mix')}
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

FlangerUI.displayName = 'FlangerUI';

export default FlangerUI;