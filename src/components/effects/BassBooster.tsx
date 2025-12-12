// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * BassBooster UI Component
 *
 * Simple UI with frequency and gain controls,
 * visual frequency response, and presets
 */

import React, { memo, useCallback, useRef, useEffect, useState } from 'react';
import { BassBooster as BassBoosterEffect } from '../../audio/effects/BassBooster';
import { Knob } from '../common/Knob';
import { Slider } from '../common/Slider';

interface BassBoosterProps {
  effect: BassBoosterEffect;
  onParameterChange?: (key: string, value: number) => void;
}

/**
 * Frequency response visualization component
 */
const FrequencyResponse: React.FC<{
  frequency: number;
  gain: number;
  saturation: number;
}> = memo(({ frequency, gain, saturation }) => {
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
    
    // Draw grid
    ctx.strokeStyle = '#333355';
    ctx.lineWidth = 1;
    
    // Vertical grid lines (frequency)
    const freqMarkers = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    for (const freq of freqMarkers) {
      const x = freqToX(freq, width);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Horizontal grid lines (dB)
    const dbMarkers = [-20, -10, 0, 10, 20];
    for (const db of dbMarkers) {
      const y = dbToY(db, height);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Draw 0dB line
    ctx.strokeStyle = '#555577';
    ctx.lineWidth = 2;
    const zeroY = dbToY(0, height);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.stroke();
    
    // Draw frequency response curve
    ctx.strokeStyle = gain >= 0 ? '#4CAF50' : '#f44336';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    for (let x = 0; x < width; x++) {
      const freq = xToFreq(x, width);
      const response = calculateResponse(freq, frequency, gain);
      const y = dbToY(response, height);
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Draw fill under curve
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (gain >= 0) {
      gradient.addColorStop(0, 'rgba(76, 175, 80, 0.3)');
      gradient.addColorStop(1, 'rgba(76, 175, 80, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(244, 67, 54, 0)');
      gradient.addColorStop(1, 'rgba(244, 67, 54, 0.3)');
    }
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    
    for (let x = 0; x < width; x++) {
      const freq = xToFreq(x, width);
      const response = calculateResponse(freq, frequency, gain);
      const y = dbToY(response, height);
      ctx.lineTo(x, y);
    }
    
    ctx.lineTo(width, zeroY);
    ctx.closePath();
    ctx.fill();
    
    // Draw cutoff frequency marker
    const cutoffX = freqToX(frequency, width);
    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(cutoffX, 0);
    ctx.lineTo(cutoffX, height);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw saturation indicator
    if (saturation > 0) {
      ctx.fillStyle = `rgba(255, 152, 0, ${saturation * 0.5})`;
      ctx.fillRect(0, height - 10, width * saturation, 10);
    }
    
    // Draw frequency labels
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    
    const labelFreqs = [50, 100, 200, 500, 1000, 5000];
    for (const freq of labelFreqs) {
      const x = freqToX(freq, width);
      const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
      ctx.fillText(label, x, height - 15);
    }
    
    // Draw dB labels
    ctx.textAlign = 'left';
    for (const db of [-15, 0, 15]) {
      const y = dbToY(db, height);
      ctx.fillText(`${db > 0 ? '+' : ''}${db}dB`, 5, y - 3);
    }
    
  }, [frequency, gain, saturation]);
  
  // Convert frequency to X position (logarithmic scale)
  function freqToX(freq: number, width: number): number {
    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logFreq = Math.log10(freq);
    return ((logFreq - logMin) / (logMax - logMin)) * width;
  }
  
  // Convert X position to frequency
  function xToFreq(x: number, width: number): number {
    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logFreq = logMin + (x / width) * (logMax - logMin);
    return Math.pow(10, logFreq);
  }
  
  // Convert dB to Y position
  function dbToY(db: number, height: number): number {
    const minDb = -25;
    const maxDb = 25;
    return height - ((db - minDb) / (maxDb - minDb)) * height;
  }
  
  // Calculate low shelf response at a given frequency
  function calculateResponse(freq: number, cutoff: number, gainDb: number): number {
    if (freq <= cutoff * 0.5) {
      return gainDb;
    } else if (freq >= cutoff * 2) {
      return 0;
    } else {
      // Transition region
      const ratio = Math.log2(freq / (cutoff * 0.5)) / Math.log2(4);
      return gainDb * (1 - ratio);
    }
  }
  
  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={150}
      style={{
        width: '100%',
        height: '150px',
        borderRadius: '4px',
        border: '1px solid #333',
      }}
    />
  );
});

FrequencyResponse.displayName = 'FrequencyResponse';

/**
 * Main BassBooster component
 */
export const BassBoosterComponent: React.FC<BassBoosterProps> = memo(({ effect, onParameterChange }) => {
  const [params, setParams] = useState(effect.getParameters());
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  
  const presets = effect.getPresets();
  
  const handleParameterChange = useCallback((key: string, value: number) => {
    effect.setParameter(key, value);
    setParams({ ...effect.getParameters() });
    onParameterChange?.(key, value);
  }, [effect, onParameterChange]);
  
  const handlePresetChange = useCallback((presetName: string) => {
    if (presetName) {
      const presetIndex = presets.findIndex(p => p.name === presetName);
      if (presetIndex >= 0) {
        effect.loadPreset(presetIndex);
        setParams({ ...effect.getParameters() });
        setSelectedPreset(presetName);
      }
    }
  }, [effect, presets]);
  
  // Format frequency display
  const formatFrequency = (freq: number): string => {
    return `${Math.round(freq)} Hz`;
  };
  
  // Format gain display
  const formatGain = (gain: number): string => {
    const sign = gain >= 0 ? '+' : '';
    return `${sign}${gain.toFixed(1)} dB`;
  };
  
  return (
    <div className="bass-booster" style={{
      backgroundColor: '#1a1a2e',
      borderRadius: '8px',
      padding: '16px',
      color: '#fff',
      fontFamily: 'sans-serif',
      width: '320px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        borderBottom: '1px solid #333',
        paddingBottom: '8px',
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', color: '#4CAF50' }}>
          🔊 Bass Booster
        </h3>
        <select
          value={selectedPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
          style={{
            width: '140px',
            backgroundColor: '#333',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '12px',
          }}
        >
          <option value="">Sélectionner un préréglage...</option>
          {presets.map(p => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>
      
      {/* Frequency Response Display */}
      <div style={{ marginBottom: '16px' }}>
        <FrequencyResponse
          frequency={params.frequency}
          gain={params.gain}
          saturation={params.saturation}
        />
      </div>
      
      {/* Main Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px',
        marginBottom: '16px',
      }}>
        {/* Frequency Control */}
        <div style={{ textAlign: 'center' }}>
          <Knob
            value={params.frequency}
            min={20}
            max={500}
            onChange={(v) => handleParameterChange('frequency', v)}
            size="lg"
            color="warning"
            logarithmic
          />
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '12px', color: '#888' }}>Fréquence</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#ff9800' }}>
              {formatFrequency(params.frequency)}
            </div>
          </div>
        </div>
        
        {/* Gain Control */}
        <div style={{ textAlign: 'center' }}>
          <Knob
            value={params.gain}
            min={-20}
            max={20}
            onChange={(v) => handleParameterChange('gain', v)}
            size="lg"
            color={params.gain >= 0 ? 'success' : 'danger'}
            bipolar
          />
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '12px', color: '#888' }}>Gain</div>
            <div style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: params.gain >= 0 ? '#4CAF50' : '#f44336'
            }}>
              {formatGain(params.gain)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Saturation Slider */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}>
          <span style={{ fontSize: '12px', color: '#888' }}>Saturation</span>
          <span style={{ fontSize: '12px', color: '#ff9800' }}>
            {Math.round(params.saturation * 100)}%
          </span>
        </div>
        <Slider
          value={params.saturation}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => handleParameterChange('saturation', typeof v === 'number' ? v : v[1])}
          color="warning"
          showValue={false}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: '#666',
          marginTop: '2px',
        }}>
          <span>Net</span>
          <span>Chaud</span>
        </div>
      </div>
      
      {/* Mix Slider */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}>
          <span style={{ fontSize: '12px', color: '#888' }}>Mélange</span>
          <span style={{ fontSize: '12px', color: '#4CAF50' }}>
            {Math.round(params.mix * 100)}%
          </span>
        </div>
        <Slider
          value={params.mix}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => handleParameterChange('mix', typeof v === 'number' ? v : v[1])}
          color="success"
          showValue={false}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: '#666',
          marginTop: '2px',
        }}>
          <span>Sec</span>
          <span>Mouillé</span>
        </div>
      </div>
      
      {/* Quick Presets */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: '1px solid #333',
      }}>
        {['Subtle Warmth', 'Deep Bass', 'Sub Boost', 'Warm Tube'].map(presetName => (
          <button
            key={presetName}
            onClick={() => handlePresetChange(presetName)}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: selectedPreset === presetName ? '#4CAF50' : '#333',
              color: selectedPreset === presetName ? '#000' : '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {presetName}
          </button>
        ))}
      </div>
    </div>
  );
});

BassBoosterComponent.displayName = 'BassBoosterComponent';

export default BassBoosterComponent;