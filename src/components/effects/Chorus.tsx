// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Chorus UI Component - Visual interface for the Chorus effect
 */

import React, { useCallback, useState, useEffect, useRef, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

interface ChorusParams {
  voices: number;
  delayTime: number;
  lfoRate: number;
  lfoDepth: number;
  feedback: number;
  stereoSpread: number;
  mix: number;
}

interface ChorusPreset {
  name: string;
  params: Partial<ChorusParams>;
}

interface ChorusProps {
  params: ChorusParams;
  onParamChange: (key: keyof ChorusParams, value: number) => void;
  presets?: ChorusPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  bypassed?: boolean;
  onBypassToggle?: () => void;
}

const defaultPresets: ChorusPreset[] = [
  { name: 'Subtle', params: { voices: 2, delayTime: 15, lfoRate: 0.5, lfoDepth: 0.3, mix: 0.3 } },
  { name: 'Classic', params: { voices: 2, delayTime: 20, lfoRate: 1, lfoDepth: 0.5, mix: 0.5 } },
  { name: 'Rich', params: { voices: 4, delayTime: 25, lfoRate: 0.8, lfoDepth: 0.6, mix: 0.5 } },
  { name: 'Wide', params: { voices: 3, delayTime: 30, lfoRate: 0.6, lfoDepth: 0.7, stereoSpread: 1, mix: 0.6 } },
  { name: 'Fast Shimmer', params: { voices: 2, delayTime: 10, lfoRate: 5, lfoDepth: 0.4, mix: 0.4 } },
];

/**
 * LFO visualization component
 */
const LfoVisualization: React.FC<{
  rate: number;
  depth: number;
  voices: number;
}> = memo(({ rate, depth, voices }) => {
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
      
      // Draw each voice's LFO
      const colors = ['#22d3ee', '#a855f7', '#f472b6', '#22c55e'];
      
      for (let v = 0; v < voices; v++) {
        const voicePhase = phaseRef.current + (v / voices) * Math.PI * 2;
        
        ctx.strokeStyle = colors[v % colors.length];
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let x = 0; x < width; x++) {
          const t = (x / width) * Math.PI * 4 + voicePhase;
          const y = centerY - Math.sin(t) * (height / 2 - 4) * depth;
          
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
      
      // Draw voice indicators
      for (let v = 0; v < voices; v++) {
        const voicePhase = phaseRef.current + (v / voices) * Math.PI * 2;
        const currentY = centerY - Math.sin(voicePhase) * (height / 2 - 4) * depth;
        
        ctx.fillStyle = colors[v % colors.length];
        ctx.beginPath();
        ctx.arc(width / 2, currentY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      
      animationRef.current = requestAnimationFrame(draw);
    };
    
    animationRef.current = requestAnimationFrame(draw);
    
    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [rate, depth, voices]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={200}
        height={80}
        className="bg-daw-bg-primary rounded border border-daw-border"
      />
      <div className="absolute bottom-1 left-2 text-[10px] text-daw-text-muted">
        {voices} voix
      </div>
    </div>
  );
});

LfoVisualization.displayName = 'LfoVisualization';

/**
 * Voice selector component
 */
const VoiceSelector: React.FC<{
  voices: number;
  onChange: (voices: number) => void;
}> = memo(({ voices, onChange }) => {
  return (
    <div className="flex gap-1">
      {[2, 3, 4].map((v) => (
        <button
          key={v}
          className={`w-8 h-8 rounded flex items-center justify-center text-sm font-medium ${
            voices === v ? 'bg-daw-accent text-white' : 'bg-daw-bg-primary text-daw-text-secondary'
          }`}
          onClick={() => onChange(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
});

VoiceSelector.displayName = 'VoiceSelector';

/**
 * Chorus effect UI
 */
export const ChorusUI: React.FC<ChorusProps> = memo(({
  params,
  onParamChange,
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
  bypassed = false,
  onBypassToggle,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const handleParamChange = useCallback((key: keyof ChorusParams) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  return (
    <div className={`bg-daw-bg-secondary rounded-lg p-4 border border-daw-border ${bypassed ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-purple-600 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Chorus</h3>
            <p className="text-xs text-daw-text-muted">{params.voices} Voix</p>
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
          voices={params.voices}
        />
      </div>

      {/* Voice selector */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <span className="text-xs text-daw-text-muted">Voix :</span>
        <VoiceSelector
          voices={params.voices}
          onChange={handleParamChange('voices')}
        />
      </div>

      {/* Main controls */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Délai</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.delayTime}
              min={5}
              max={50}
              step={0.5}
              onChange={handleParamChange('delayTime')}
              size="md"
              label="Temps"
              unit=" ms"
            />
          </div>
        </div>

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
          <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Rétroaction</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.feedback}
              min={0}
              max={0.9}
              step={0.01}
              onChange={handleParamChange('feedback')}
              size="md"
              label="Quantité"
              valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
          </div>
        </div>
      </div>

      {/* Stereo and Mix */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Stéréo</h4>
          <div className="flex flex-col items-center">
            <Knob
              value={params.stereoSpread}
              min={0}
              max={1}
              step={0.01}
              onChange={handleParamChange('stereoSpread')}
              size="md"
              label="Élargissement"
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

ChorusUI.displayName = 'ChorusUI';

export default ChorusUI;