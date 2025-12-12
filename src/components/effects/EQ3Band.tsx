// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * EQ3Band UI Component - Professional 3-band parametric EQ interface
 */

import React, { useCallback, useState, useEffect, useRef, memo, useMemo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

interface EQ3BandParams {
  lowGain: number;
  lowFreq: number;
  lowQ: number;
  midGain: number;
  midFreq: number;
  midQ: number;
  highGain: number;
  highFreq: number;
  highQ: number;
  outputGain: number;
}

interface FrequencyResponsePoint {
  frequency: number;
  magnitude: number;
}

interface EQ3BandPreset {
  name: string;
  params: Partial<EQ3BandParams>;
}

interface EQ3BandProps {
  params: EQ3BandParams;
  onParamChange: (key: keyof EQ3BandParams, value: number) => void;
  frequencyResponse?: FrequencyResponsePoint[];
  presets?: EQ3BandPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  bypassed?: boolean;
  onBypassToggle?: () => void;
}

const defaultPresets: EQ3BandPreset[] = [
  { name: 'Flat', params: { lowGain: 0, midGain: 0, highGain: 0, outputGain: 0 } },
  { name: 'Bass Boost', params: { lowGain: 6, midGain: 0, highGain: 0 } },
  { name: 'Treble Boost', params: { lowGain: 0, midGain: 0, highGain: 6 } },
  { name: 'Vocal Presence', params: { lowGain: -2, midGain: 4, highGain: 2 } },
  { name: 'Warm', params: { lowGain: 3, midGain: -2, highGain: -3 } },
  { name: 'Bright', params: { lowGain: -2, midGain: 2, highGain: 5 } },
];

/**
 * Frequency response curve visualization
 */
const FrequencyResponseCurve: React.FC<{
  response?: FrequencyResponsePoint[];
  params: EQ3BandParams;
  width?: number;
  height?: number;
}> = memo(({ response, params, width = 400, height = 150 }) => {
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  
  // Generate approximate response curve if no real data provided
  const generateApproximateCurve = useCallback(() => {
    const points: string[] = [];
    const numPoints = 100;
    
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      // Logarithmic frequency scale from 20Hz to 20kHz
      const freq = 20 * Math.pow(1000, t);
      const x = padding.left + t * graphWidth;
      
      // Approximate the combined response
      let magnitude = 0;
      
      // Low shelf contribution
      const lowRatio = freq / params.lowFreq;
      if (lowRatio < 1) {
        magnitude += params.lowGain * (1 - Math.pow(lowRatio, 2));
      } else {
        magnitude += params.lowGain * Math.exp(-Math.pow(Math.log10(lowRatio) * params.lowQ, 2));
      }
      
      // Mid peaking contribution
      const midRatio = Math.log10(freq / params.midFreq);
      magnitude += params.midGain * Math.exp(-Math.pow(midRatio * params.midQ * 2, 2));
      
      // High shelf contribution
      const highRatio = freq / params.highFreq;
      if (highRatio > 1) {
        magnitude += params.highGain * (1 - Math.pow(1 / highRatio, 2));
      } else {
        magnitude += params.highGain * Math.exp(-Math.pow(Math.log10(1 / highRatio) * params.highQ, 2));
      }
      
      // Add output gain
      magnitude += params.outputGain;
      
      // Clamp and convert to Y position
      magnitude = Math.max(-24, Math.min(24, magnitude));
      const y = padding.top + graphHeight / 2 - (magnitude / 24) * (graphHeight / 2);
      
      points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    
    return points.join(' ');
  }, [params, graphWidth, graphHeight, padding.left, padding.top]);
  
  // Use real response data if available, otherwise approximate
  const pathData = useMemo(() => {
    if (response && response.length > 0) {
      const points: string[] = [];
      for (let i = 0; i < response.length; i++) {
        const point = response[i];
        const t = Math.log10(point.frequency / 20) / 3; // 20Hz to 20kHz
        const x = padding.left + t * graphWidth;
        const magnitude = Math.max(-24, Math.min(24, point.magnitude));
        const y = padding.top + graphHeight / 2 - (magnitude / 24) * (graphHeight / 2);
        points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
      }
      return points.join(' ');
    }
    return generateApproximateCurve();
  }, [response, generateApproximateCurve, graphWidth, graphHeight, padding.left, padding.top]);
  
  // Frequency labels
  const freqLabels = [20, 50, 100, 200, 500, '1k', '2k', '5k', '10k', '20k'];
  const freqValues = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  
  // dB labels
  const dbLabels = [24, 12, 0, -12, -24];
  
  return (
    <svg width={width} height={height} className="bg-daw-bg-primary rounded border border-daw-border">
      {/* Grid lines */}
      <defs>
        <pattern id="eq-grid" width="40" height="30" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#333" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect x={padding.left} y={padding.top} width={graphWidth} height={graphHeight} fill="url(#eq-grid)" />
      
      {/* Zero line */}
      <line
        x1={padding.left}
        y1={padding.top + graphHeight / 2}
        x2={padding.left + graphWidth}
        y2={padding.top + graphHeight / 2}
        stroke="#555"
        strokeWidth="1"
      />
      
      {/* Band frequency markers */}
      {[params.lowFreq, params.midFreq, params.highFreq].map((freq, index) => {
        const t = Math.log10(freq / 20) / 3;
        const x = padding.left + t * graphWidth;
        const colors = ['#f97316', '#22c55e', '#3b82f6'];
        return (
          <line
            key={index}
            x1={x}
            y1={padding.top}
            x2={x}
            y2={padding.top + graphHeight}
            stroke={colors[index]}
            strokeWidth="1"
            strokeDasharray="4,4"
            opacity="0.5"
          />
        );
      })}
      
      {/* Frequency response curve */}
      <path
        d={pathData}
        fill="none"
        stroke="#4ade80"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Frequency labels */}
      {freqLabels.map((label, index) => {
        const t = Math.log10(freqValues[index] / 20) / 3;
        const x = padding.left + t * graphWidth;
        return (
          <text
            key={index}
            x={x}
            y={height - 8}
            fill="#666"
            fontSize="9"
            textAnchor="middle"
          >
            {label}
          </text>
        );
      })}
      
      {/* dB labels */}
      {dbLabels.map((db, index) => {
        const y = padding.top + (index / (dbLabels.length - 1)) * graphHeight;
        return (
          <text
            key={index}
            x={padding.left - 5}
            y={y + 3}
            fill="#666"
            fontSize="9"
            textAnchor="end"
          >
            {db > 0 ? `+${db}` : db}
          </text>
        );
      })}
      
      {/* Axis labels */}
      <text x={width / 2} y={height - 2} fill="#666" fontSize="8" textAnchor="middle">Hz</text>
      <text x={8} y={height / 2} fill="#666" fontSize="8" textAnchor="middle" transform={`rotate(-90, 8, ${height / 2})`}>dB</text>
    </svg>
  );
});

FrequencyResponseCurve.displayName = 'FrequencyResponseCurve';

/**
 * Band control section
 */
const BandSection: React.FC<{
  title: string;
  color: string;
  gain: number;
  freq: number;
  q: number;
  freqMin: number;
  freqMax: number;
  onGainChange: (value: number) => void;
  onFreqChange: (value: number) => void;
  onQChange: (value: number) => void;
}> = memo(({ title, color, gain, freq, q, freqMin, freqMax, onGainChange, onFreqChange, onQChange }) => {
  const formatFreq = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return `${Math.round(value)}`;
  };
  
  return (
    <div className="flex flex-col items-center p-3 bg-daw-bg-surface rounded-lg border border-daw-border">
      {/* Band title with color indicator */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium text-daw-text-primary">{title}</span>
      </div>
      
      {/* Gain knob (main) */}
      <div className="mb-3">
        <Knob
          value={gain}
          min={-24}
          max={24}
          onChange={onGainChange}
          size="lg"
          label="Gain"
          unit=" dB"
          bipolar
        />
      </div>
      
      {/* Frequency and Q knobs */}
      <div className="flex gap-3">
        <Knob
          value={freq}
          min={freqMin}
          max={freqMax}
          onChange={onFreqChange}
          size="sm"
          label="Freq"
          valueFormatter={formatFreq}
          logarithmic
        />
        <Knob
          value={q}
          min={0.1}
          max={10}
          step={0.1}
          onChange={onQChange}
          size="sm"
          label="Q"
          valueFormatter={(v: number) => v.toFixed(1)}
          logarithmic
        />
      </div>
    </div>
  );
});

BandSection.displayName = 'BandSection';

/**
 * EQ3Band effect UI
 */
export const EQ3BandUI: React.FC<EQ3BandProps> = memo(({
  params,
  onParamChange,
  frequencyResponse,
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
  bypassed = false,
  onBypassToggle,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const handleKnobChange = useCallback((key: keyof EQ3BandParams) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  return (
    <div className={`bg-daw-bg-secondary rounded-lg p-4 border border-daw-border ${bypassed ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">EQ</span>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">3-Band EQ</h3>
            <p className="text-xs text-daw-text-muted">Égaliseur paramétrique</p>
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

      {/* Frequency response curve */}
      <div className="mb-4 flex justify-center">
        <FrequencyResponseCurve
          response={frequencyResponse}
          params={params}
          width={420}
          height={140}
        />
      </div>

      {/* Band controls */}
      <div className="flex gap-4 justify-center mb-4">
        <BandSection
          title="Grave"
          color="#f97316"
          gain={params.lowGain}
          freq={params.lowFreq}
          q={params.lowQ}
          freqMin={20}
          freqMax={500}
          onGainChange={handleKnobChange('lowGain')}
          onFreqChange={handleKnobChange('lowFreq')}
          onQChange={handleKnobChange('lowQ')}
        />
        
        <BandSection
          title="Médium"
          color="#22c55e"
          gain={params.midGain}
          freq={params.midFreq}
          q={params.midQ}
          freqMin={200}
          freqMax={5000}
          onGainChange={handleKnobChange('midGain')}
          onFreqChange={handleKnobChange('midFreq')}
          onQChange={handleKnobChange('midQ')}
        />
        
        <BandSection
          title="Aigu"
          color="#3b82f6"
          gain={params.highGain}
          freq={params.highFreq}
          q={params.highQ}
          freqMin={1000}
          freqMax={20000}
          onGainChange={handleKnobChange('highGain')}
          onFreqChange={handleKnobChange('highFreq')}
          onQChange={handleKnobChange('highQ')}
        />
      </div>

      {/* Output gain */}
      <div className="flex justify-center pt-3 border-t border-daw-border">
        <Knob
          value={params.outputGain}
          min={-24}
          max={24}
          onChange={handleKnobChange('outputGain')}
          size="md"
          label="Sortie"
          unit=" dB"
          bipolar
        />
      </div>
    </div>
  );
});

EQ3BandUI.displayName = 'EQ3BandUI';

export default EQ3BandUI;
