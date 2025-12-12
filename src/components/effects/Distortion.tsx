// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Distortion UI Component - Visual interface for the Distortion effect
 */

import React, { useCallback, useState, useEffect, useRef, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

// Distortion types matching the audio class
enum DistortionType {
  Overdrive = 0,
  Fuzz = 1,
  Tube = 2,
  Clip = 3,
  Fold = 4,
  Sine = 5,
  Bitcrush = 6,
}

interface DistortionParams {
  type: number;
  drive: number;
  tone: number;
  output: number;
  mix: number;
  bitDepth: number;
  sampleRate: number;
}

interface DistortionPreset {
  name: string;
  params: Partial<DistortionParams>;
}

interface DistortionProps {
  params: DistortionParams;
  onParamChange: (key: keyof DistortionParams, value: number) => void;
  presets?: DistortionPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  bypassed?: boolean;
  onBypassToggle?: () => void;
}

const defaultPresets: DistortionPreset[] = [
  { name: 'Subtle Warmth', params: { type: DistortionType.Tube, drive: 0.3, tone: 0.5, mix: 0.5 } },
  { name: 'Overdrive', params: { type: DistortionType.Overdrive, drive: 0.5, tone: 0.6, mix: 0.7 } },
  { name: 'Heavy Fuzz', params: { type: DistortionType.Fuzz, drive: 0.8, tone: 0.4, mix: 0.8 } },
  { name: 'Hard Clip', params: { type: DistortionType.Clip, drive: 0.6, tone: 0.5, mix: 0.7 } },
  { name: 'Wave Folder', params: { type: DistortionType.Fold, drive: 0.5, tone: 0.5, mix: 0.6 } },
  { name: 'Lo-Fi Crush', params: { type: DistortionType.Bitcrush, drive: 0.6, bitDepth: 8, mix: 0.8 } },
];

const distortionTypeNames = ['Overdrive', 'Fuzz', 'Tube', 'Clip', 'Fold', 'Sine', 'Bitcrush'];
const distortionTypeIcons = ['🎸', '⚡', '📻', '✂️', '🔄', '〰️', '👾'];

/**
 * Waveshaper visualization component
 */
const WaveshaperVisualization: React.FC<{
  type: number;
  drive: number;
}> = memo(({ type, drive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Vertical center line
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();
    
    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    
    // Draw linear reference (diagonal)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw distortion curve
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const k = drive * 50 + 1;
    
    for (let px = 0; px < width; px++) {
      const x = (px / width) * 2 - 1; // -1 to 1
      let y: number;
      
      switch (type) {
        case DistortionType.Overdrive:
          y = Math.tanh(x * k) / Math.tanh(k);
          break;
        case DistortionType.Fuzz:
          if (x >= 0) {
            y = Math.tanh(x * k * 2) / Math.tanh(k * 2);
          } else {
            y = Math.tanh(x * k) / Math.tanh(k);
          }
          break;
        case DistortionType.Tube:
          const a = 1 + drive * 10;
          if (x >= 0) {
            y = 1 - Math.exp(-a * x);
          } else {
            y = -(1 - Math.exp(a * x));
          }
          break;
        case DistortionType.Clip:
          const threshold = 1 - drive * 0.9;
          y = Math.max(-threshold, Math.min(threshold, x)) / threshold;
          break;
        case DistortionType.Fold:
          const foldAmount = 1 + drive * 4;
          let folded = x * foldAmount;
          while (Math.abs(folded) > 1) {
            if (folded > 1) {
              folded = 2 - folded;
            } else if (folded < -1) {
              folded = -2 - folded;
            }
          }
          y = folded;
          break;
        case DistortionType.Sine:
          const sineAmount = 1 + drive * 3;
          y = Math.sin(x * Math.PI * sineAmount / 2);
          break;
        case DistortionType.Bitcrush:
          const levels = Math.pow(2, 8);
          y = Math.round(x * levels) / levels;
          y = Math.tanh(y * (1 + drive * 2));
          break;
        default:
          y = x;
      }
      
      // Map y from -1..1 to canvas coordinates
      const py = centerY - y * (height / 2 - 4);
      
      if (px === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    
  }, [type, drive]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={100}
      className="bg-daw-bg-primary rounded border border-daw-border"
    />
  );
});

WaveshaperVisualization.displayName = 'WaveshaperVisualization';

/**
 * Distortion type selector
 */
const TypeSelector: React.FC<{
  type: number;
  onChange: (type: number) => void;
}> = memo(({ type, onChange }) => {
  return (
    <div className="grid grid-cols-4 gap-1">
      {distortionTypeNames.map((name, index) => (
        <button
          key={index}
          className={`px-2 py-1.5 rounded text-xs font-medium flex flex-col items-center gap-0.5 ${
            type === index 
              ? 'bg-orange-500 text-white' 
              : 'bg-daw-bg-primary text-daw-text-secondary hover:bg-daw-bg-surface'
          }`}
          onClick={() => onChange(index)}
          title={name}
        >
          <span className="text-base">{distortionTypeIcons[index]}</span>
          <span className="text-[10px]">{name}</span>
        </button>
      ))}
    </div>
  );
});

TypeSelector.displayName = 'TypeSelector';

/**
 * Drive meter visualization
 */
const DriveMeter: React.FC<{
  drive: number;
}> = memo(({ drive }) => {
  const segments = 10;
  const activeSegments = Math.round(drive * segments);
  
  return (
    <div className="flex gap-0.5 h-20 items-end">
      {Array.from({ length: segments }).map((_, i) => {
        const isActive = i < activeSegments;
        const intensity = i / segments;
        let color = 'bg-green-500';
        if (intensity > 0.6) color = 'bg-yellow-500';
        if (intensity > 0.8) color = 'bg-red-500';
        
        return (
          <div
            key={i}
            className={`w-2 rounded-sm transition-all ${
              isActive ? color : 'bg-daw-bg-primary'
            }`}
            style={{ height: `${(i + 1) * 10}%` }}
          />
        );
      })}
    </div>
  );
});

DriveMeter.displayName = 'DriveMeter';

/**
 * Distortion effect UI
 */
export const DistortionUI: React.FC<DistortionProps> = memo(({
  params,
  onParamChange,
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
  bypassed = false,
  onBypassToggle,
}) => {
  const [showPresets, setShowPresets] = useState(false);
  const isBitcrush = params.type === DistortionType.Bitcrush;

  const handleParamChange = useCallback((key: keyof DistortionParams) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  return (
    <div className={`bg-daw-bg-secondary rounded-lg p-4 border border-daw-border ${bypassed ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Distortion</h3>
            <p className="text-xs text-daw-text-muted">{distortionTypeNames[params.type]}</p>
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
                      index === currentPresetIndex ? 'text-orange-400' : 'text-daw-text-secondary'
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

      {/* Type selector */}
      <div className="mb-4">
        <TypeSelector
          type={params.type}
          onChange={handleParamChange('type')}
        />
      </div>

      {/* Visualization and Drive */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <WaveshaperVisualization
            type={params.type}
            drive={params.drive}
          />
        </div>
        <div className="flex flex-col items-center">
          <DriveMeter drive={params.drive} />
          <span className="text-xs text-daw-text-muted mt-1">Saturation</span>
        </div>
      </div>

      {/* Main controls */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-daw-bg-surface rounded p-2 flex flex-col items-center">
          <Knob
            value={params.drive}
            min={0}
            max={1}
            step={0.01}
            onChange={handleParamChange('drive')}
            size="md"
            label="Saturation"
            valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
          />
        </div>

        <div className="bg-daw-bg-surface rounded p-2 flex flex-col items-center">
          <Knob
            value={params.tone}
            min={0}
            max={1}
            step={0.01}
            onChange={handleParamChange('tone')}
            size="md"
            label="Tonalité"
            valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
          />
        </div>

        <div className="bg-daw-bg-surface rounded p-2 flex flex-col items-center">
          <Knob
            value={params.output}
            min={0}
            max={1}
            step={0.01}
            onChange={handleParamChange('output')}
            size="md"
            label="Sortie"
            valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
          />
        </div>

        <div className="bg-daw-bg-surface rounded p-2 flex flex-col items-center">
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

      {/* Bitcrush-specific controls */}
      {isBitcrush && (
        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Paramètres Bitcrush</h4>
          <div className="flex gap-4 justify-center">
            <Knob
              value={params.bitDepth}
              min={1}
              max={16}
              step={1}
              onChange={handleParamChange('bitDepth')}
              size="sm"
              label="Profondeur de bits"
              valueFormatter={(v: number) => `${Math.round(v)} bits`}
            />
            <Knob
              value={params.sampleRate}
              min={0.1}
              max={1}
              step={0.01}
              onChange={handleParamChange('sampleRate')}
              size="sm"
              label="Taux d'échantillonnage"
              valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
          </div>
        </div>
      )}
    </div>
  );
});

DistortionUI.displayName = 'DistortionUI';

export default DistortionUI;