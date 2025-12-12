// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Spectrograph UI Component - Visual interface for the Spectrograph analyzer
 */

import React, { useCallback, useState, useEffect, useRef, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

type DisplayMode = 'spectrum' | 'spectrogram' | 'oscilloscope';
type FrequencyScale = 'linear' | 'logarithmic';

interface SpectrographParams {
  fftSize: number;
  smoothing: number;
  minDb: number;
  maxDb: number;
  displayMode: number;
  windowFunction: number;
  frequencyScale: number;
  peakHold: number;
  frozen: number;
}

interface SpectrographProps {
  params: SpectrographParams;
  onParamChange: (key: keyof SpectrographParams, value: number) => void;
  getFrequencyData?: () => { left: Uint8Array; right: Uint8Array; combined: Uint8Array };
  getTimeDomainData?: () => { left: Float32Array; right: Float32Array };
  getPeakHoldData?: () => Float32Array;
  getSpectrogramHistory?: () => Uint8Array[];
  onResetPeakHold?: () => void;
  sampleRate?: number;
  bypassed?: boolean;
  onBypassToggle?: () => void;
}

const displayModes = ['Spectre', 'Spectrogramme', 'Oscilloscope'];
const windowFunctions = ['Rectangulaire', 'Hann', 'Hamming', 'Blackman', 'Blackman-Harris'];
const fftSizes = [256, 512, 1024, 2048, 4096, 8192, 16384];

const colorSchemes = {
  default: ['#1a1a2e', '#22d3ee', '#a855f7', '#f472b6', '#ef4444'],
  fire: ['#1a1a2e', '#ef4444', '#f59e0b', '#fbbf24', '#ffffff'],
  ice: ['#1a1a2e', '#3b82f6', '#22d3ee', '#a5f3fc', '#ffffff'],
  green: ['#1a1a2e', '#22c55e', '#4ade80', '#86efac', '#ffffff'],
};

/**
 * Spectrum analyzer display
 */
const SpectrumDisplay: React.FC<{
  frequencyData: Uint8Array;
  peakHoldData?: Float32Array;
  width: number;
  height: number;
  frequencyScale: FrequencyScale;
  sampleRate: number;
  showPeakHold: boolean;
}> = memo(({ frequencyData, peakHoldData, width, height, frequencyScale, sampleRate, showPeakHold }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const padding = 30;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding - 10;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Frequency grid lines
    const freqs = frequencyScale === 'logarithmic' 
      ? [100, 1000, 10000] 
      : [5000, 10000, 15000, 20000];
    
    const nyquist = sampleRate / 2;
    
    freqs.forEach(freq => {
      if (freq > nyquist) return;
      
      let x: number;
      if (frequencyScale === 'logarithmic') {
        x = padding + (Math.log10(freq / 20) / Math.log10(nyquist / 20)) * graphWidth;
      } else {
        x = padding + (freq / nyquist) * graphWidth;
      }
      
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
      
      // Label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(freq >= 1000 ? `${freq / 1000}k` : `${freq}`, x, height - padding + 12);
    });
    
    // dB grid lines
    for (let db = 0; db <= 100; db += 20) {
      const y = 10 + (db / 100) * graphHeight;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      
      // Label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${-db}`, padding - 5, y + 3);
    }
    
    // Draw spectrum bars
    const barCount = frequencyData.length;
    const gradient = ctx.createLinearGradient(0, height - padding, 0, 10);
    gradient.addColorStop(0, '#22d3ee');
    gradient.addColorStop(0.5, '#a855f7');
    gradient.addColorStop(1, '#ef4444');
    
    ctx.fillStyle = gradient;
    
    for (let i = 0; i < barCount; i++) {
      const freq = (i / barCount) * nyquist;
      
      let x: number;
      let nextX: number;
      
      if (frequencyScale === 'logarithmic') {
        if (freq < 20) continue;
        x = padding + (Math.log10(freq / 20) / Math.log10(nyquist / 20)) * graphWidth;
        const nextFreq = ((i + 1) / barCount) * nyquist;
        nextX = padding + (Math.log10(Math.max(20, nextFreq) / 20) / Math.log10(nyquist / 20)) * graphWidth;
      } else {
        x = padding + (i / barCount) * graphWidth;
        nextX = padding + ((i + 1) / barCount) * graphWidth;
      }
      
      const barWidth = Math.max(1, nextX - x - 1);
      const barHeight = (frequencyData[i] / 255) * graphHeight;
      
      ctx.fillRect(x, height - padding - barHeight, barWidth, barHeight);
    }
    
    // Draw peak hold
    if (showPeakHold && peakHoldData) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      for (let i = 0; i < peakHoldData.length; i++) {
        const freq = (i / peakHoldData.length) * nyquist;
        
        let x: number;
        if (frequencyScale === 'logarithmic') {
          if (freq < 20) continue;
          x = padding + (Math.log10(freq / 20) / Math.log10(nyquist / 20)) * graphWidth;
        } else {
          x = padding + (i / peakHoldData.length) * graphWidth;
        }
        
        const y = height - padding - peakHoldData[i] * graphHeight;
        
        if (i === 0 || (frequencyScale === 'logarithmic' && freq < 20)) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    
  }, [frequencyData, peakHoldData, width, height, frequencyScale, sampleRate, showPeakHold]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded border border-daw-border"
    />
  );
});

SpectrumDisplay.displayName = 'SpectrumDisplay';

/**
 * Spectrogram display (waterfall)
 */
const SpectrogramDisplay: React.FC<{
  history: Uint8Array[];
  width: number;
  height: number;
}> = memo(({ history, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    if (history.length === 0) return;
    
    const rowHeight = height / history.length;
    const binCount = history[0]?.length || 0;
    const colWidth = width / binCount;
    
    history.forEach((row, rowIndex) => {
      const y = rowIndex * rowHeight;
      
      for (let i = 0; i < row.length; i++) {
        const x = i * colWidth;
        const value = row[i] / 255;
        
        // Color mapping
        const hue = 240 - value * 240; // Blue to red
        const saturation = 80;
        const lightness = value * 50;
        
        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        ctx.fillRect(x, y, Math.ceil(colWidth), Math.ceil(rowHeight));
      }
    });
    
  }, [history, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded border border-daw-border"
    />
  );
});

SpectrogramDisplay.displayName = 'SpectrogramDisplay';

/**
 * Oscilloscope display
 */
const OscilloscopeDisplay: React.FC<{
  leftData: Float32Array;
  rightData: Float32Array;
  width: number;
  height: number;
}> = memo(({ leftData, rightData, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const padding = 10;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;
    const centerY = height / 2;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Center line
    ctx.beginPath();
    ctx.moveTo(padding, centerY);
    ctx.lineTo(width - padding, centerY);
    ctx.stroke();
    
    // Vertical divisions
    for (let i = 0; i <= 8; i++) {
      const x = padding + (i / 8) * graphWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }
    
    // Draw left channel (cyan)
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const samplesPerPixel = Math.floor(leftData.length / graphWidth);
    
    for (let x = 0; x < graphWidth; x++) {
      const sampleIndex = Math.floor(x * samplesPerPixel);
      const sample = leftData[sampleIndex] || 0;
      const y = centerY - sample * (graphHeight / 2);
      
      if (x === 0) {
        ctx.moveTo(padding + x, y);
      } else {
        ctx.lineTo(padding + x, y);
      }
    }
    ctx.stroke();
    
    // Draw right channel (pink)
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let x = 0; x < graphWidth; x++) {
      const sampleIndex = Math.floor(x * samplesPerPixel);
      const sample = rightData[sampleIndex] || 0;
      const y = centerY - sample * (graphHeight / 2);
      
      if (x === 0) {
        ctx.moveTo(padding + x, y);
      } else {
        ctx.lineTo(padding + x, y);
      }
    }
    ctx.stroke();
    
  }, [leftData, rightData, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded border border-daw-border"
    />
  );
});

OscilloscopeDisplay.displayName = 'OscilloscopeDisplay';

/**
 * Spectrograph analyzer UI
 */
export const SpectrographUI: React.FC<SpectrographProps> = memo(({
  params,
  onParamChange,
  getFrequencyData,
  getTimeDomainData,
  getPeakHoldData,
  getSpectrogramHistory,
  onResetPeakHold,
  sampleRate = 44100,
  bypassed = false,
  onBypassToggle,
}) => {
  const [frequencyData, setFrequencyData] = useState<Uint8Array>(new Uint8Array(1024));
  const [timeDomainData, setTimeDomainData] = useState<{ left: Float32Array; right: Float32Array }>({
    left: new Float32Array(2048),
    right: new Float32Array(2048)
  });
  const [peakHoldData, setPeakHoldData] = useState<Float32Array>(new Float32Array(1024));
  const [spectrogramHistory, setSpectrogramHistory] = useState<Uint8Array[]>([]);
  
  const animationRef = useRef<number>(0);
  
  // Animation loop for updating display
  useEffect(() => {
    const updateDisplay = () => {
      if (getFrequencyData) {
        const data = getFrequencyData();
        setFrequencyData(data.combined);
      }
      
      if (getTimeDomainData) {
        setTimeDomainData(getTimeDomainData());
      }
      
      if (getPeakHoldData) {
        setPeakHoldData(getPeakHoldData());
      }
      
      if (getSpectrogramHistory) {
        setSpectrogramHistory(getSpectrogramHistory());
      }
      
      animationRef.current = requestAnimationFrame(updateDisplay);
    };
    
    animationRef.current = requestAnimationFrame(updateDisplay);
    
    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [getFrequencyData, getTimeDomainData, getPeakHoldData, getSpectrogramHistory]);

  const handleParamChange = useCallback((key: keyof SpectrographParams) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  const displayMode = params.displayMode;
  const frequencyScale: FrequencyScale = params.frequencyScale > 0.5 ? 'logarithmic' : 'linear';

  return (
    <div className={`bg-daw-bg-secondary rounded-lg p-4 border border-daw-border ${bypassed ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#8286ef] rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Spectrograph</h3>
            <p className="text-xs text-daw-text-muted">{displayModes[displayMode]}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Freeze button */}
          <Button
            variant={params.frozen > 0.5 ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onParamChange('frozen', params.frozen > 0.5 ? 0 : 1)}
          >
            {params.frozen > 0.5 ? '▶' : '⏸'}
          </Button>
          
          {/* Reset peak hold */}
          {onResetPeakHold && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetPeakHold}
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
        </div>
      </div>

      {/* Display */}
      <div className="flex justify-center mb-4">
        {displayMode === 0 && (
          <SpectrumDisplay
            frequencyData={frequencyData}
            peakHoldData={peakHoldData}
            width={450}
            height={200}
            frequencyScale={frequencyScale}
            sampleRate={sampleRate}
            showPeakHold={params.peakHold > 0.5}
          />
        )}
        
        {displayMode === 1 && (
          <SpectrogramDisplay
            history={spectrogramHistory}
            width={450}
            height={200}
          />
        )}
        
        {displayMode === 2 && (
          <OscilloscopeDisplay
            leftData={timeDomainData.left}
            rightData={timeDomainData.right}
            width={450}
            height={200}
          />
        )}
      </div>

      {/* Mode selector */}
      <div className="flex justify-center gap-2 mb-4">
        {displayModes.map((mode, index) => (
          <button
            key={mode}
            className={`px-3 py-1 text-sm rounded ${
              displayMode === index ? 'bg-daw-accent text-white' : 'bg-daw-bg-surface text-daw-text-secondary'
            }`}
            onClick={() => onParamChange('displayMode', index)}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Settings */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-daw-bg-surface rounded p-2">
          <h4 className="text-[10px] text-daw-text-muted mb-1 text-center uppercase">Taille FFT</h4>
          <select
            className="w-full bg-daw-bg-primary text-daw-text-primary text-sm rounded px-2 py-1"
            value={params.fftSize}
            onChange={(e) => onParamChange('fftSize', parseInt(e.target.value))}
          >
            {fftSizes.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        
        <div className="bg-daw-bg-surface rounded p-2">
          <h4 className="text-[10px] text-daw-text-muted mb-1 text-center uppercase">Lissage</h4>
          <Knob
            value={params.smoothing}
            min={0}
            max={0.99}
            step={0.01}
            onChange={handleParamChange('smoothing')}
            size="sm"
            valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
          />
        </div>
        
        <div className="bg-daw-bg-surface rounded p-2">
          <h4 className="text-[10px] text-daw-text-muted mb-1 text-center uppercase">Échelle</h4>
          <div className="flex gap-1">
            <button
              className={`flex-1 px-1 py-1 text-[10px] rounded ${
                params.frequencyScale <= 0.5 ? 'bg-daw-accent text-white' : 'bg-daw-bg-primary text-daw-text-muted'
              }`}
              onClick={() => onParamChange('frequencyScale', 0)}
            >
              Lin
            </button>
            <button
              className={`flex-1 px-1 py-1 text-[10px] rounded ${
                params.frequencyScale > 0.5 ? 'bg-daw-accent text-white' : 'bg-daw-bg-primary text-daw-text-muted'
              }`}
              onClick={() => onParamChange('frequencyScale', 1)}
            >
              Log
            </button>
          </div>
        </div>
        
        <div className="bg-daw-bg-surface rounded p-2">
          <h4 className="text-[10px] text-daw-text-muted mb-1 text-center uppercase">Maintien crête</h4>
          <Button
            variant={params.peakHold > 0.5 ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onParamChange('peakHold', params.peakHold > 0.5 ? 0 : 1)}
            className="w-full"
          >
            {params.peakHold > 0.5 ? 'ON' : 'OFF'}
          </Button>
        </div>
      </div>
    </div>
  );
});

SpectrographUI.displayName = 'SpectrographUI';

export default SpectrographUI;