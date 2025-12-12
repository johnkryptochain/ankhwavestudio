// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * ParametricEQ UI Component - Interactive 8-band parametric equalizer
 */

import React, { useCallback, useState, useEffect, useRef, memo, useMemo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

type EQFilterType = 'lowshelf' | 'highshelf' | 'peaking' | 'lowpass' | 'highpass' | 'notch' | 'bandpass';

interface EQBand {
  enabled: boolean;
  type: EQFilterType;
  frequency: number;
  gain: number;
  q: number;
}

interface FrequencyResponsePoint {
  frequency: number;
  magnitude: number;
}

interface ParametricEQProps {
  bands: EQBand[];
  onBandChange: (index: number, settings: Partial<EQBand>) => void;
  frequencyResponse?: FrequencyResponsePoint[];
  spectrumData?: Float32Array;
  sampleRate?: number;
  bypassed?: boolean;
  onBypassToggle?: () => void;
  presets?: Array<{ name: string }>;
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
}

const filterTypeLabels: Record<EQFilterType, string> = {
  lowshelf: 'Low Shelf',
  highshelf: 'High Shelf',
  peaking: 'Peak',
  lowpass: 'Low Pass',
  highpass: 'High Pass',
  notch: 'Notch',
  bandpass: 'Band Pass',
};

const filterTypeColors = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8286ef', // violet -> theme
  '#8286ef', // pink -> theme
];

const defaultPresets = [
  { name: 'Flat' },
  { name: 'Bass Boost' },
  { name: 'Treble Boost' },
  { name: 'Vocal Presence' },
  { name: 'Smiley Face' },
  { name: 'Mid Scoop' },
];

/**
 * Frequency response graph with draggable EQ points
 */
const FrequencyGraph: React.FC<{
  bands: EQBand[];
  frequencyResponse?: FrequencyResponsePoint[];
  spectrumData?: Float32Array;
  sampleRate?: number;
  selectedBand: number | null;
  onBandSelect: (index: number | null) => void;
  onBandDrag: (index: number, frequency: number, gain: number) => void;
}> = memo(({ bands, frequencyResponse, spectrumData, sampleRate = 44100, selectedBand, onBandSelect, onBandDrag }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragBand, setDragBand] = useState<number | null>(null);
  
  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  
  // Convert frequency to x position (logarithmic scale)
  const freqToX = useCallback((freq: number) => {
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);
    const freqLog = Math.log10(Math.max(20, Math.min(20000, freq)));
    return padding.left + ((freqLog - minLog) / (maxLog - minLog)) * graphWidth;
  }, [graphWidth, padding.left]);
  
  // Convert x position to frequency
  const xToFreq = useCallback((x: number) => {
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);
    const normalized = (x - padding.left) / graphWidth;
    return Math.pow(10, minLog + normalized * (maxLog - minLog));
  }, [graphWidth, padding.left]);
  
  // Convert gain to y position
  const gainToY = useCallback((gain: number) => {
    const maxGain = 24;
    const normalized = (gain + maxGain) / (2 * maxGain);
    return padding.top + (1 - normalized) * graphHeight;
  }, [graphHeight, padding.top]);
  
  // Convert y position to gain
  const yToGain = useCallback((y: number) => {
    const maxGain = 24;
    const normalized = 1 - (y - padding.top) / graphHeight;
    return normalized * 2 * maxGain - maxGain;
  }, [graphHeight, padding.top]);
  
  // Generate frequency response path
  const responsePath = useMemo(() => {
    if (!frequencyResponse || frequencyResponse.length === 0) {
      // Generate flat line if no response data
      return `M ${padding.left} ${gainToY(0)} L ${width - padding.right} ${gainToY(0)}`;
    }
    
    const points = frequencyResponse.map((point, i) => {
      const x = freqToX(point.frequency);
      const y = gainToY(Math.max(-24, Math.min(24, point.magnitude)));
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    });
    
    return points.join(' ');
  }, [frequencyResponse, freqToX, gainToY, padding.left, padding.right, width]);
  
  // Generate spectrum path
  const spectrumPath = useMemo(() => {
    if (!spectrumData || spectrumData.length === 0) return '';
    
    const points: string[] = [];
    const binCount = spectrumData.length;
    const nyquist = sampleRate / 2;
    
    for (let i = 0; i < binCount; i++) {
      const freq = (i / binCount) * nyquist;
      if (freq < 20 || freq > 20000) continue;
      
      const x = freqToX(freq);
      const db = spectrumData[i];
      const normalizedDb = Math.max(-60, Math.min(0, db));
      const y = padding.top + ((normalizedDb + 60) / 60) * graphHeight;
      
      points.push(`${points.length === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    
    return points.join(' ');
  }, [spectrumData, sampleRate, freqToX, graphHeight, padding.top]);
  
  // Handle mouse events for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent, bandIndex: number) => {
    e.preventDefault();
    setIsDragging(true);
    setDragBand(bandIndex);
    onBandSelect(bandIndex);
  }, [onBandSelect]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || dragBand === null || !svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const freq = xToFreq(x);
    const gain = yToGain(y);
    
    onBandDrag(dragBand, freq, gain);
  }, [isDragging, dragBand, xToFreq, yToGain, onBandDrag]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragBand(null);
  }, []);
  
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => {
        setIsDragging(false);
        setDragBand(null);
      };
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);
  
  // Frequency labels
  const freqLabels = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  
  // Gain labels
  const gainLabels = [-24, -12, 0, 12, 24];

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="bg-daw-bg-primary rounded border border-daw-border"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid */}
      <defs>
        <pattern id="eqGrid" width="50" height="25" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 25" fill="none" stroke="#333" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect
        x={padding.left}
        y={padding.top}
        width={graphWidth}
        height={graphHeight}
        fill="url(#eqGrid)"
      />
      
      {/* Zero line */}
      <line
        x1={padding.left}
        y1={gainToY(0)}
        x2={width - padding.right}
        y2={gainToY(0)}
        stroke="#555"
        strokeWidth="1"
      />
      
      {/* Spectrum analyzer (background) */}
      {spectrumPath && (
        <path
          d={spectrumPath}
          fill="none"
          stroke="#4ade80"
          strokeWidth="1"
          opacity="0.3"
        />
      )}
      
      {/* Frequency response curve */}
      <path
        d={responsePath}
        fill="none"
        stroke="#60a5fa"
        strokeWidth="2"
        strokeLinecap="round"
      />
      
      {/* Band control points */}
      {bands.map((band, index) => {
        if (!band.enabled) return null;
        
        const x = freqToX(band.frequency);
        const y = gainToY(band.gain);
        const isSelected = selectedBand === index;
        const color = filterTypeColors[index];
        
        return (
          <g key={index}>
            {/* Vertical line from point to zero */}
            <line
              x1={x}
              y1={y}
              x2={x}
              y2={gainToY(0)}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="4,4"
              opacity="0.5"
            />
            
            {/* Control point */}
            <circle
              cx={x}
              cy={y}
              r={isSelected ? 10 : 8}
              fill={color}
              stroke={isSelected ? '#fff' : '#000'}
              strokeWidth={isSelected ? 2 : 1}
              style={{ cursor: 'pointer' }}
              onMouseDown={(e) => handleMouseDown(e, index)}
              onClick={() => onBandSelect(index)}
            />
            
            {/* Band number */}
            <text
              x={x}
              y={y + 4}
              fill="#fff"
              fontSize="10"
              textAnchor="middle"
              style={{ pointerEvents: 'none' }}
            >
              {index + 1}
            </text>
          </g>
        );
      })}
      
      {/* Frequency labels */}
      {freqLabels.map((freq) => (
        <text
          key={freq}
          x={freqToX(freq)}
          y={height - 8}
          fill="#666"
          fontSize="9"
          textAnchor="middle"
        >
          {freq >= 1000 ? `${freq / 1000}k` : freq}
        </text>
      ))}
      
      {/* Gain labels */}
      {gainLabels.map((gain) => (
        <text
          key={gain}
          x={padding.left - 8}
          y={gainToY(gain) + 3}
          fill="#666"
          fontSize="9"
          textAnchor="end"
        >
          {gain > 0 ? `+${gain}` : gain}
        </text>
      ))}
      
      {/* Axis labels */}
      <text x={width / 2} y={height - 2} fill="#666" fontSize="10" textAnchor="middle">
        Frequency (Hz)
      </text>
      <text
        x={8}
        y={height / 2}
        fill="#666"
        fontSize="10"
        textAnchor="middle"
        transform={`rotate(-90, 8, ${height / 2})`}
      >
        Gain (dB)
      </text>
    </svg>
  );
});

FrequencyGraph.displayName = 'FrequencyGraph';

/**
 * Band control panel
 */
const BandControls: React.FC<{
  band: EQBand;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (settings: Partial<EQBand>) => void;
}> = memo(({ band, index, isSelected, onSelect, onChange }) => {
  const color = filterTypeColors[index];
  
  const handleTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ type: e.target.value as EQFilterType });
  }, [onChange]);
  
  const handleToggleEnabled = useCallback(() => {
    onChange({ enabled: !band.enabled });
  }, [onChange, band.enabled]);

  return (
    <div
      className={`p-2 rounded border transition-colors cursor-pointer ${
        isSelected
          ? 'border-daw-accent-primary bg-daw-bg-surface'
          : 'border-daw-border bg-daw-bg-secondary hover:bg-daw-bg-surface'
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs font-medium text-daw-text-primary">
            Band {index + 1}
          </span>
        </div>
        <button
          className={`w-6 h-6 rounded text-xs ${
            band.enabled
              ? 'bg-daw-accent-primary text-white'
              : 'bg-daw-bg-primary text-daw-text-muted'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            handleToggleEnabled();
          }}
        >
          {band.enabled ? '●' : '○'}
        </button>
      </div>
      
      {/* Type selector */}
      <select
        className="w-full mb-2 px-2 py-1 text-xs bg-daw-bg-primary border border-daw-border rounded text-daw-text-secondary"
        value={band.type}
        onChange={handleTypeChange}
        onClick={(e) => e.stopPropagation()}
      >
        {Object.entries(filterTypeLabels).map(([type, label]) => (
          <option key={type} value={type}>{label}</option>
        ))}
      </select>
      
      {/* Knobs */}
      <div className="flex gap-2 justify-center">
        <Knob
          value={band.frequency}
          min={20}
          max={20000}
          onChange={(v) => onChange({ frequency: v })}
          size="xs"
          label="Freq"
          logarithmic
          valueFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`}
        />
        <Knob
          value={band.gain}
          min={-24}
          max={24}
          onChange={(v) => onChange({ gain: v })}
          size="xs"
          label="Gain"
          bipolar
          unit=" dB"
        />
        <Knob
          value={band.q}
          min={0.1}
          max={18}
          onChange={(v) => onChange({ q: v })}
          size="xs"
          label="Q"
          logarithmic
          valueFormatter={(v: number) => v.toFixed(1)}
        />
      </div>
    </div>
  );
});

BandControls.displayName = 'BandControls';

/**
 * Parametric EQ UI
 */
export const ParametricEQUI: React.FC<ParametricEQProps> = memo(({
  bands,
  onBandChange,
  frequencyResponse,
  spectrumData,
  sampleRate,
  bypassed = false,
  onBypassToggle,
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
}) => {
  const [selectedBand, setSelectedBand] = useState<number | null>(0);
  const [showPresets, setShowPresets] = useState(false);

  const handleBandDrag = useCallback((index: number, frequency: number, gain: number) => {
    onBandChange(index, {
      frequency: Math.max(20, Math.min(20000, frequency)),
      gain: Math.max(-24, Math.min(24, gain)),
    });
  }, [onBandChange]);

  return (
    <div className={`bg-daw-bg-secondary rounded-lg p-4 border border-daw-border ${bypassed ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">EQ</span>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Parametric EQ</h3>
            <p className="text-xs text-daw-text-muted">Égaliseur 8 bandes</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onBypassToggle && (
            <Button
              variant={bypassed ? 'secondary' : 'ghost'}
              size="sm"
              onClick={onBypassToggle}
            >
              {bypassed ? 'Désactivé' : 'Actif'}
            </Button>
          )}
          
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

      {/* Frequency response graph */}
      <div className="mb-4 flex justify-center">
        <FrequencyGraph
          bands={bands}
          frequencyResponse={frequencyResponse}
          spectrumData={spectrumData}
          sampleRate={sampleRate}
          selectedBand={selectedBand}
          onBandSelect={setSelectedBand}
          onBandDrag={handleBandDrag}
        />
      </div>

      {/* Band controls */}
      <div className="grid grid-cols-4 gap-2">
        {bands.map((band, index) => (
          <BandControls
            key={index}
            band={band}
            index={index}
            isSelected={selectedBand === index}
            onSelect={() => setSelectedBand(index)}
            onChange={(settings) => onBandChange(index, settings)}
          />
        ))}
      </div>
    </div>
  );
});

ParametricEQUI.displayName = 'ParametricEQUI';

export default ParametricEQUI;