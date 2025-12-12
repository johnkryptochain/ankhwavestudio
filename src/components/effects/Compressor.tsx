// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Compressor UI Component - Professional compressor interface with metering
 */

import React, { useCallback, useState, useEffect, useRef, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

interface CompressorParams {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  knee: number;
  makeupGain: number;
  autoMakeup: number;
  mix: number;
}

interface CompressorMeteringData {
  inputLevel: number;
  outputLevel: number;
  gainReduction: number;
}

interface CompressorPreset {
  name: string;
  params: Partial<CompressorParams>;
}

interface CompressorProps {
  params: CompressorParams;
  onParamChange: (key: keyof CompressorParams, value: number) => void;
  meteringData?: CompressorMeteringData;
  presets?: CompressorPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  bypassed?: boolean;
  onBypassToggle?: () => void;
}

const defaultPresets: CompressorPreset[] = [
  { name: 'Gentle', params: { threshold: -20, ratio: 2, attack: 0.01, release: 0.2, knee: 10, makeupGain: 2, mix: 100 } },
  { name: 'Vocal', params: { threshold: -18, ratio: 3, attack: 0.005, release: 0.15, knee: 6, makeupGain: 4, mix: 100 } },
  { name: 'Drums', params: { threshold: -24, ratio: 4, attack: 0.001, release: 0.1, knee: 3, makeupGain: 6, mix: 100 } },
  { name: 'Bass', params: { threshold: -20, ratio: 4, attack: 0.02, release: 0.3, knee: 6, makeupGain: 4, mix: 100 } },
  { name: 'Master Bus', params: { threshold: -12, ratio: 2, attack: 0.03, release: 0.3, knee: 12, makeupGain: 2, mix: 100 } },
  { name: 'Limiter', params: { threshold: -6, ratio: 20, attack: 0.001, release: 0.05, knee: 0, makeupGain: 6, mix: 100 } },
  { name: 'Parallel Crush', params: { threshold: -30, ratio: 10, attack: 0.001, release: 0.05, knee: 0, makeupGain: 12, mix: 50 } },
  { name: 'NY Compression', params: { threshold: -24, ratio: 8, attack: 0.005, release: 0.1, knee: 0, makeupGain: 10, mix: 40 } },
];

/**
 * Vertical meter component
 */
const VerticalMeter: React.FC<{
  value: number;
  min?: number;
  max?: number;
  label: string;
  color?: string;
  showPeak?: boolean;
  inverted?: boolean;
}> = memo(({ value, min = -60, max = 0, label, color = '#4ade80', showPeak = false, inverted = false }) => {
  const [peak, setPeak] = useState(value);
  const peakDecay = useRef<number | null>(null);
  
  useEffect(() => {
    if (showPeak && value > peak) {
      setPeak(value);
      if (peakDecay.current) {
        clearTimeout(peakDecay.current);
      }
      peakDecay.current = window.setTimeout(() => {
        setPeak(value);
      }, 1000);
    }
    return () => {
      if (peakDecay.current) {
        clearTimeout(peakDecay.current);
      }
    };
  }, [value, peak, showPeak]);
  
  const normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const normalizedPeak = Math.max(0, Math.min(1, (peak - min) / (max - min)));
  const height = inverted ? normalizedValue * 100 : (1 - normalizedValue) * 100;
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-4 h-32 bg-daw-bg-primary rounded border border-daw-border relative overflow-hidden">
        {/* Meter fill */}
        <div
          className="absolute left-0 right-0 transition-all duration-50"
          style={{
            backgroundColor: color,
            top: inverted ? 0 : `${height}%`,
            bottom: inverted ? `${100 - normalizedValue * 100}%` : 0,
          }}
        />
        
        {/* Peak indicator */}
        {showPeak && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-white"
            style={{
              top: `${(1 - normalizedPeak) * 100}%`,
            }}
          />
        )}
        
        {/* Scale markers */}
        <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
          {[0, -12, -24, -36, -48, -60].map((db) => (
            <div key={db} className="w-full h-px bg-daw-border opacity-50" />
          ))}
        </div>
      </div>
      <span className="text-[10px] text-daw-text-muted">{label}</span>
      <span className="text-[10px] text-daw-text-secondary font-mono">
        {value > -100 ? `${value.toFixed(1)}` : '-∞'}
      </span>
    </div>
  );
});

VerticalMeter.displayName = 'VerticalMeter';

/**
 * Gain reduction meter (horizontal)
 */
const GainReductionMeter: React.FC<{
  value: number;
}> = memo(({ value }) => {
  const normalizedValue = Math.max(0, Math.min(1, Math.abs(value) / 24));
  
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-daw-text-muted">GR</span>
        <span className="text-[10px] text-daw-text-secondary font-mono">
          {value.toFixed(1)} dB
        </span>
      </div>
      <div className="h-3 bg-daw-bg-primary rounded border border-daw-border relative overflow-hidden">
        {/* Meter fill (from right to left) */}
        <div
          className="absolute top-0 bottom-0 right-0 bg-orange-500 transition-all duration-50"
          style={{
            width: `${normalizedValue * 100}%`,
          }}
        />
        
        {/* Scale markers */}
        <div className="absolute inset-0 flex justify-between px-1 pointer-events-none">
          {[0, 6, 12, 18, 24].map((db) => (
            <div key={db} className="w-px h-full bg-daw-border opacity-50" />
          ))}
        </div>
      </div>
    </div>
  );
});

GainReductionMeter.displayName = 'GainReductionMeter';

/**
 * Compression curve visualization
 */
const CompressionCurve: React.FC<{
  threshold: number;
  ratio: number;
  knee: number;
}> = memo(({ threshold, ratio, knee }) => {
  const width = 120;
  const height = 120;
  const padding = 10;
  
  const generatePath = useCallback(() => {
    const points: string[] = [];
    const steps = 60;
    
    for (let i = 0; i <= steps; i++) {
      const inputDb = -60 + (i / steps) * 60; // -60 to 0 dB
      const x = padding + ((inputDb + 60) / 60) * (width - 2 * padding);
      
      let outputDb: number;
      
      // Calculate output based on compression curve
      if (knee === 0) {
        // Hard knee
        if (inputDb <= threshold) {
          outputDb = inputDb;
        } else {
          outputDb = threshold + (inputDb - threshold) / ratio;
        }
      } else {
        // Soft knee
        const kneeStart = threshold - knee / 2;
        const kneeEnd = threshold + knee / 2;
        
        if (inputDb <= kneeStart) {
          outputDb = inputDb;
        } else if (inputDb >= kneeEnd) {
          outputDb = threshold + (inputDb - threshold) / ratio;
        } else {
          // In the knee region - smooth transition
          const kneeProgress = (inputDb - kneeStart) / knee;
          const linearOutput = inputDb;
          const compressedOutput = threshold + (inputDb - threshold) / ratio;
          outputDb = linearOutput + (compressedOutput - linearOutput) * kneeProgress * kneeProgress;
        }
      }
      
      const y = height - padding - ((outputDb + 60) / 60) * (height - 2 * padding);
      points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    
    return points.join(' ');
  }, [threshold, ratio, knee, width, height, padding]);
  
  return (
    <svg
      width={width}
      height={height}
      className="bg-daw-bg-primary rounded border border-daw-border"
    >
      {/* Grid */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#333" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect x={padding} y={padding} width={width - 2 * padding} height={height - 2 * padding} fill="url(#grid)" />
      
      {/* 1:1 reference line */}
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={padding}
        stroke="#444"
        strokeWidth="1"
        strokeDasharray="4,4"
      />
      
      {/* Threshold line */}
      <line
        x1={padding + ((threshold + 60) / 60) * (width - 2 * padding)}
        y1={padding}
        x2={padding + ((threshold + 60) / 60) * (width - 2 * padding)}
        y2={height - padding}
        stroke="#666"
        strokeWidth="1"
        strokeDasharray="2,2"
      />
      
      {/* Compression curve */}
      <path
        d={generatePath()}
        fill="none"
        stroke="#4ade80"
        strokeWidth="2"
        strokeLinecap="round"
      />
      
      {/* Labels */}
      <text x={width / 2} y={height - 2} fill="#666" fontSize="8" textAnchor="middle">Entrée</text>
      <text x={4} y={height / 2} fill="#666" fontSize="8" textAnchor="middle" transform={`rotate(-90, 4, ${height / 2})`}>Sortie</text>
    </svg>
  );
});

CompressionCurve.displayName = 'CompressionCurve';

/**
 * Compressor effect UI
 */
export const CompressorUI: React.FC<CompressorProps> = memo(({
  params,
  onParamChange,
  meteringData = { inputLevel: -60, outputLevel: -60, gainReduction: 0 },
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
  bypassed = false,
  onBypassToggle,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const handleKnobChange = useCallback((key: keyof CompressorParams) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  const handleToggleAutoMakeup = useCallback(() => {
    onParamChange('autoMakeup', params.autoMakeup > 0.5 ? 0 : 1);
  }, [onParamChange, params.autoMakeup]);

  return (
    <div className={`bg-daw-bg-secondary rounded-lg p-4 border border-daw-border ${bypassed ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#8286ef] rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Compressor</h3>
            <p className="text-xs text-daw-text-muted">Processeur de dynamique</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Bypass button */}
          {onBypassToggle && (
            <Button
              variant={bypassed ? 'secondary' : 'ghost'}
              size="sm"
              onClick={onBypassToggle}
            >
              {bypassed ? 'Désactivé' : 'Actif'}
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
                      index === currentPresetIndex ? 'text-daw-accent-primary' : 'text-daw-text-secondary'
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

      <div className="flex gap-4">
        {/* Metering section */}
        <div className="flex gap-2 p-3 bg-daw-bg-surface rounded">
          <VerticalMeter
            value={meteringData.inputLevel}
            label="In"
            color="#60a5fa"
            showPeak
          />
          <VerticalMeter
            value={meteringData.outputLevel}
            label="Out"
            color="#4ade80"
            showPeak
          />
        </div>

        {/* Main controls */}
        <div className="flex-1">
          {/* Compression curve */}
          <div className="flex justify-center mb-4">
            <CompressionCurve
              threshold={params.threshold}
              ratio={params.ratio}
              knee={params.knee}
            />
          </div>

          {/* Gain reduction meter */}
          <div className="mb-4">
            <GainReductionMeter value={meteringData.gainReduction} />
          </div>

          {/* Knobs - First row */}
          <div className="grid grid-cols-4 gap-4">
            <div className="flex flex-col items-center">
              <Knob
                value={params.threshold}
                min={-60}
                max={0}
                onChange={handleKnobChange('threshold')}
                size="md"
                label="Seuil"
                unit=" dB"
              />
            </div>
            <div className="flex flex-col items-center">
              <Knob
                value={params.ratio}
                min={1}
                max={20}
                onChange={handleKnobChange('ratio')}
                size="md"
                label="Ratio"
                valueFormatter={(v: number) => `${v.toFixed(1)}:1`}
              />
            </div>
            <div className="flex flex-col items-center">
              <Knob
                value={params.attack}
                min={0.001}
                max={1}
                step={0.001}
                onChange={handleKnobChange('attack')}
                size="md"
                label="Attaque"
                valueFormatter={(v: number) => `${(v * 1000).toFixed(1)} ms`}
              />
            </div>
            <div className="flex flex-col items-center">
              <Knob
                value={params.release}
                min={0.01}
                max={3}
                step={0.01}
                onChange={handleKnobChange('release')}
                size="md"
                label="Relâchement"
                valueFormatter={(v: number) => `${(v * 1000).toFixed(0)} ms`}
              />
            </div>
          </div>

          {/* Second row of knobs */}
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="flex flex-col items-center">
              <Knob
                value={params.knee}
                min={0}
                max={40}
                onChange={handleKnobChange('knee')}
                size="sm"
                label="Coude"
                unit=" dB"
              />
            </div>
            <div className="flex flex-col items-center">
              <Knob
                value={params.makeupGain}
                min={0}
                max={40}
                onChange={handleKnobChange('makeupGain')}
                size="sm"
                label="Compensation"
                unit=" dB"
                disabled={params.autoMakeup > 0.5}
              />
            </div>
            <div className="flex flex-col items-center">
              <Knob
                value={params.mix}
                min={0}
                max={100}
                onChange={handleKnobChange('mix')}
                size="sm"
                label="Mélange"
                unit="%"
              />
            </div>
            <div className="flex flex-col items-center justify-center">
              <button
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  params.autoMakeup > 0.5
                    ? 'bg-daw-accent-primary text-white'
                    : 'bg-daw-bg-primary text-daw-text-muted'
                }`}
                onClick={handleToggleAutoMakeup}
              >
                Auto Makeup
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

CompressorUI.displayName = 'CompressorUI';

export default CompressorUI;
