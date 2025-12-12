// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Amplifier UI Component - Visual interface for the Amplifier effect
 */

import React, { useCallback, useState, useEffect, useRef, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

interface AmplifierParams {
  inputGain: number;
  outputGain: number;
  pan: number;
  leftRight: number;
  phaseInvertL: number;
  phaseInvertR: number;
}

interface MeterLevels {
  leftRMS: number;
  rightRMS: number;
  leftPeak: number;
  rightPeak: number;
  leftClipped: boolean;
  rightClipped: boolean;
}

interface AmplifierPreset {
  name: string;
  params: Partial<AmplifierParams>;
}

interface AmplifierProps {
  params: AmplifierParams;
  onParamChange: (key: keyof AmplifierParams, value: number) => void;
  getMeterLevels?: () => MeterLevels;
  onResetClip?: () => void;
  presets?: AmplifierPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  bypassed?: boolean;
  onBypassToggle?: () => void;
}

const defaultPresets: AmplifierPreset[] = [
  { name: 'Unity', params: { inputGain: 0, outputGain: 0, pan: 0 } },
  { name: 'Boost +6dB', params: { inputGain: 6, outputGain: 0 } },
  { name: 'Cut -6dB', params: { inputGain: -6, outputGain: 0 } },
  { name: 'Pan Left', params: { pan: -0.7 } },
  { name: 'Pan Right', params: { pan: 0.7 } },
];

/**
 * VU Meter component
 */
const VUMeter: React.FC<{
  level: number;
  peak: number;
  clipped: boolean;
  label: string;
  onResetClip?: () => void;
}> = memo(({ level, peak, clipped, label, onResetClip }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw meter background
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(4, 4, width - 8, height - 8);
    
    // Calculate meter height based on dB level
    // Map -60dB to 0dB to 0-100%
    const normalizedLevel = Math.max(0, Math.min(1, (level + 60) / 60));
    const normalizedPeak = Math.max(0, Math.min(1, (peak + 60) / 60));
    
    const meterHeight = (height - 8) * normalizedLevel;
    const peakY = height - 4 - (height - 8) * normalizedPeak;
    
    // Draw gradient meter
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#22c55e');    // Green
    gradient.addColorStop(0.6, '#22c55e');  // Green
    gradient.addColorStop(0.8, '#eab308');  // Yellow
    gradient.addColorStop(0.95, '#ef4444'); // Red
    gradient.addColorStop(1, '#ef4444');    // Red
    
    ctx.fillStyle = gradient;
    ctx.fillRect(4, height - 4 - meterHeight, width - 8, meterHeight);
    
    // Draw peak indicator
    ctx.fillStyle = clipped ? '#ef4444' : '#ffffff';
    ctx.fillRect(4, peakY - 1, width - 8, 2);
    
    // Draw dB scale markers
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    const dbMarkers = [0, -6, -12, -24, -48];
    dbMarkers.forEach(db => {
      const y = height - 4 - (height - 8) * ((db + 60) / 60);
      ctx.fillRect(0, y, 3, 1);
      ctx.fillRect(width - 3, y, 3, 1);
    });
    
  }, [level, peak, clipped]);

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        width={24}
        height={120}
        className="rounded border border-daw-border cursor-pointer"
        onClick={onResetClip}
        title="Cliquez pour réinitialiser l'indicateur de saturation"
      />
      <span className="text-[10px] text-daw-text-muted mt-1">{label}</span>
      {clipped && (
        <span className="text-[10px] text-red-500 font-bold">CLIP</span>
      )}
    </div>
  );
});

VUMeter.displayName = 'VUMeter';

/**
 * Pan visualization
 */
const PanDisplay: React.FC<{
  pan: number;
}> = memo(({ pan }) => {
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
    
    // Draw background arc
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(centerX, centerY + 20, 35, Math.PI, 0);
    ctx.stroke();
    
    // Draw pan position
    const angle = Math.PI - (pan + 1) * Math.PI / 2;
    const indicatorX = centerX + Math.cos(angle) * 35;
    const indicatorY = centerY + 20 + Math.sin(angle) * 35;
    
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw center marker
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(centerX, centerY + 20 - 35, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw L and R labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('L', 10, centerY + 25);
    ctx.fillText('R', width - 10, centerY + 25);
    
  }, [pan]);

  return (
    <canvas
      ref={canvasRef}
      width={80}
      height={50}
      className="rounded"
    />
  );
});

PanDisplay.displayName = 'PanDisplay';

/**
 * Amplifier effect UI
 */
export const AmplifierUI: React.FC<AmplifierProps> = memo(({
  params,
  onParamChange,
  getMeterLevels,
  onResetClip,
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
  bypassed = false,
  onBypassToggle,
}) => {
  const [showPresets, setShowPresets] = useState(false);
  const [meterLevels, setMeterLevels] = useState<MeterLevels>({
    leftRMS: -60,
    rightRMS: -60,
    leftPeak: -60,
    rightPeak: -60,
    leftClipped: false,
    rightClipped: false
  });
  
  // Update meters
  useEffect(() => {
    if (!getMeterLevels) return;
    
    const updateMeters = () => {
      const levels = getMeterLevels();
      setMeterLevels(levels);
    };
    
    const interval = setInterval(updateMeters, 50);
    return () => clearInterval(interval);
  }, [getMeterLevels]);

  const handleKnobChange = useCallback((key: keyof AmplifierParams) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  return (
    <div className={`bg-daw-bg-secondary rounded-lg p-4 border border-daw-border ${bypassed ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Amplifier</h3>
            <p className="text-xs text-daw-text-muted">Gain & Panoramique</p>
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
                      index === currentPresetIndex ? 'text-green-400' : 'text-daw-text-secondary'
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

      {/* Main controls */}
      <div className="flex gap-4">
        {/* VU Meters */}
        <div className="flex gap-2">
          <VUMeter
            level={meterLevels.leftRMS}
            peak={meterLevels.leftPeak}
            clipped={meterLevels.leftClipped}
            label="L"
            onResetClip={onResetClip}
          />
          <VUMeter
            level={meterLevels.rightRMS}
            peak={meterLevels.rightPeak}
            clipped={meterLevels.rightClipped}
            label="R"
            onResetClip={onResetClip}
          />
        </div>

        {/* Gain controls */}
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-daw-bg-surface rounded p-3">
              <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Entrée</h4>
              <div className="flex flex-col items-center">
                <Knob
                  value={params.inputGain}
                  min={-60}
                  max={24}
                  step={0.1}
                  onChange={handleKnobChange('inputGain')}
                  size="lg"
                  label="Gain"
                  unit=" dB"
                  valueFormatter={(v: number) => v.toFixed(1)}
                />
              </div>
            </div>

            <div className="bg-daw-bg-surface rounded p-3">
              <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Sortie</h4>
              <div className="flex flex-col items-center">
                <Knob
                  value={params.outputGain}
                  min={-60}
                  max={24}
                  step={0.1}
                  onChange={handleKnobChange('outputGain')}
                  size="lg"
                  label="Gain"
                  unit=" dB"
                  valueFormatter={(v: number) => v.toFixed(1)}
                />
              </div>
            </div>
          </div>

          {/* Pan and Balance */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-daw-bg-surface rounded p-3">
              <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Pan</h4>
              <div className="flex flex-col items-center">
                <PanDisplay pan={params.pan} />
                <Knob
                  value={params.pan}
                  min={-1}
                  max={1}
                  step={0.01}
                  onChange={handleKnobChange('pan')}
                  size="md"
                  valueFormatter={(v: number) => {
                    if (Math.abs(v) < 0.05) return 'C';
                    return v < 0 ? `L${Math.round(Math.abs(v) * 100)}` : `R${Math.round(v * 100)}`;
                  }}
                />
              </div>
            </div>

            <div className="bg-daw-bg-surface rounded p-3">
              <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Balance</h4>
              <div className="flex flex-col items-center">
                <Knob
                  value={params.leftRight}
                  min={-1}
                  max={1}
                  step={0.01}
                  onChange={handleKnobChange('leftRight')}
                  size="lg"
                  label="L/R"
                  valueFormatter={(v: number) => {
                    if (Math.abs(v) < 0.05) return 'C';
                    return v < 0 ? `L${Math.round(Math.abs(v) * 100)}` : `R${Math.round(v * 100)}`;
                  }}
                />
              </div>
            </div>
          </div>

          {/* Phase Invert */}
          <div className="bg-daw-bg-surface rounded p-3">
            <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide text-center">Inversion de phase</h4>
            <div className="flex justify-center gap-4">
              <Button
                variant={params.phaseInvertL > 0.5 ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => onParamChange('phaseInvertL', params.phaseInvertL > 0.5 ? 0 : 1)}
                className="w-20"
              >
                <span className={params.phaseInvertL > 0.5 ? 'text-yellow-400' : ''}>
                  Ø L
                </span>
              </Button>
              <Button
                variant={params.phaseInvertR > 0.5 ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => onParamChange('phaseInvertR', params.phaseInvertR > 0.5 ? 0 : 1)}
                className="w-20"
              >
                <span className={params.phaseInvertR > 0.5 ? 'text-yellow-400' : ''}>
                  Ø R
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

AmplifierUI.displayName = 'AmplifierUI';

export default AmplifierUI;