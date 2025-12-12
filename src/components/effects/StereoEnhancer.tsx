// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * StereoEnhancer UI Component
 * 
 * Width slider with visual stereo field,
 * correlation meter, bass mono frequency control
 */

import React, { memo, useCallback, useRef, useEffect, useState } from 'react';
import { StereoEnhancer as StereoEnhancerEffect } from '../../audio/effects/StereoEnhancer';
import { Knob } from '../common/Knob';
import { Slider } from '../common/Slider';

interface StereoEnhancerProps {
  effect: StereoEnhancerEffect;
  onParameterChange?: (key: string, value: number) => void;
}

/**
 * Stereo field visualization component
 */
const StereoField: React.FC<{
  width: number;
  pan: number;
  correlation: number;
}> = memo(({ width, pan, correlation }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);
    
    // Draw grid
    ctx.strokeStyle = '#333355';
    ctx.lineWidth = 1;
    
    // Center lines
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, h);
    ctx.moveTo(0, centerY);
    ctx.lineTo(w, centerY);
    ctx.stroke();
    
    // Draw L/R labels
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('L', 15, centerY + 4);
    ctx.fillText('R', w - 15, centerY + 4);
    ctx.fillText('M', centerX, 15);
    ctx.fillText('S', centerX, h - 8);
    
    // Draw stereo field ellipse
    const maxRadius = Math.min(w, h) / 2 - 20;
    const widthRadius = maxRadius * Math.min(width, 2) / 2;
    const heightRadius = maxRadius * 0.8;
    
    // Calculate pan offset
    const panOffset = pan * (maxRadius - widthRadius);
    
    // Draw outer boundary
    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, maxRadius, maxRadius, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw stereo field
    const gradient = ctx.createRadialGradient(
      centerX + panOffset, centerY, 0,
      centerX + panOffset, centerY, widthRadius
    );
    
    // Color based on correlation
    if (correlation > 0.5) {
      gradient.addColorStop(0, 'rgba(76, 175, 80, 0.8)');
      gradient.addColorStop(1, 'rgba(76, 175, 80, 0.2)');
    } else if (correlation > 0) {
      gradient.addColorStop(0, 'rgba(255, 193, 7, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 193, 7, 0.2)');
    } else {
      gradient.addColorStop(0, 'rgba(244, 67, 54, 0.8)');
      gradient.addColorStop(1, 'rgba(244, 67, 54, 0.2)');
    }
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(centerX + panOffset, centerY, widthRadius, heightRadius, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw stereo field outline
    ctx.strokeStyle = correlation > 0.5 ? '#4CAF50' : correlation > 0 ? '#FFC107' : '#f44336';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(centerX + panOffset, centerY, widthRadius, heightRadius, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw center dot
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(centerX + panOffset, centerY, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw width percentage
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(width * 100)}%`, centerX + panOffset, centerY + 4);
    
  }, [width, pan, correlation]);
  
  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={200}
      style={{
        width: '200px',
        height: '200px',
        borderRadius: '50%',
        border: '2px solid #333',
      }}
    />
  );
});

StereoField.displayName = 'StereoField';

/**
 * Correlation meter component
 */
const CorrelationMeter: React.FC<{ correlation: number }> = memo(({ correlation }) => {
  // Correlation: -1 (out of phase) to 1 (mono)
  const position = ((correlation + 1) / 2) * 100;
  
  const getColor = () => {
    if (correlation > 0.5) return '#4CAF50';
    if (correlation > 0) return '#FFC107';
    return '#f44336';
  };
  
  return (
    <div style={{ width: '100%', marginBottom: '8px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '10px',
        color: '#666',
        marginBottom: '4px',
      }}>
        <span>-1</span>
        <span style={{ color: '#888' }}>Corrélation</span>
        <span>+1</span>
      </div>
      <div style={{
        height: '8px',
        backgroundColor: '#333',
        borderRadius: '4px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Gradient background */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to right, #f44336, #FFC107 50%, #4CAF50)',
          opacity: 0.3,
        }} />
        
        {/* Center marker */}
        <div style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '50%',
          width: '2px',
          backgroundColor: '#666',
          transform: 'translateX(-50%)',
        }} />
        
        {/* Position indicator */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: `${position}%`,
          width: '12px',
          height: '12px',
          backgroundColor: getColor(),
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          boxShadow: `0 0 8px ${getColor()}`,
        }} />
      </div>
    </div>
  );
});

CorrelationMeter.displayName = 'CorrelationMeter';

/**
 * Main StereoEnhancer component
 */
export const StereoEnhancerComponent: React.FC<StereoEnhancerProps> = memo(({ effect, onParameterChange }) => {
  const [params, setParams] = useState(effect.getParameters());
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [correlation, setCorrelation] = useState(0.7);
  
  const presets = effect.getPresets();
  
  // Update correlation estimate when width changes
  useEffect(() => {
    setCorrelation(effect.getCorrelation());
  }, [effect, params.width]);
  
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
  
  // Format width display
  const formatWidth = (width: number): string => {
    return `${Math.round(width * 100)}%`;
  };
  
  return (
    <div className="stereo-enhancer" style={{
      backgroundColor: '#1a1a2e',
      borderRadius: '8px',
      padding: '16px',
      color: '#fff',
      fontFamily: 'sans-serif',
      width: '340px',
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
        <h3 style={{ margin: 0, fontSize: '16px', color: '#2196F3' }}>
          🔊 Stereo Enhancer
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
      
      {/* Stereo Field Visualization */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '16px',
      }}>
        <StereoField
          width={params.width}
          pan={params.pan}
          correlation={correlation}
        />
      </div>
      
      {/* Correlation Meter */}
      <CorrelationMeter correlation={correlation} />
      
      {/* Width Slider */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}>
          <span style={{ fontSize: '12px', color: '#888' }}>Largeur stéréo</span>
          <span style={{ fontSize: '12px', color: '#2196F3', fontWeight: 'bold' }}>
            {formatWidth(params.width)}
          </span>
        </div>
        <Slider
          value={params.width}
          min={0}
          max={2}
          step={0.01}
          onChange={(v) => handleParameterChange('width', typeof v === 'number' ? v : v[1])}
          color="primary"
          showValue={false}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: '#666',
          marginTop: '2px',
        }}>
          <span>Mono</span>
          <span>Normal</span>
          <span>Large</span>
        </div>
      </div>
      
      {/* Controls Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '16px',
      }}>
        {/* Pan Control */}
        <div style={{ textAlign: 'center' }}>
          <Knob
            value={params.pan}
            min={-1}
            max={1}
            step={0.01}
            onChange={(v) => handleParameterChange('pan', v)}
            size="md"
            color="primary"
            bipolar
            label="Balance"
          />
        </div>
        
        {/* Bass Mono Frequency */}
        <div style={{ textAlign: 'center' }}>
          <Knob
            value={params.bassMonoFreq}
            min={0}
            max={500}
            step={1}
            onChange={(v) => handleParameterChange('bassMonoFreq', v)}
            size="md"
            color="warning"
            label="Grave mono"
            valueFormatter={(v) => v === 0 ? 'Désactivé' : `${Math.round(v)}Hz`}
          />
        </div>
        
        {/* Mix */}
        <div style={{ textAlign: 'center' }}>
          <Knob
            value={params.mix}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => handleParameterChange('mix', v)}
            size="md"
            color="success"
            label="Mélange"
            valueFormatter={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      </div>
      
      {/* Phase Invert Buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
      }}>
        <button
          onClick={() => handleParameterChange('phaseInvertL', params.phaseInvertL ? 0 : 1)}
          style={{
            flex: 1,
            padding: '8px',
            backgroundColor: params.phaseInvertL ? '#f44336' : '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: params.phaseInvertL ? 'bold' : 'normal',
          }}
        >
          ⟲ Phase L
        </button>
        <button
          onClick={() => handleParameterChange('phaseInvertR', params.phaseInvertR ? 0 : 1)}
          style={{
            flex: 1,
            padding: '8px',
            backgroundColor: params.phaseInvertR ? '#f44336' : '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: params.phaseInvertR ? 'bold' : 'normal',
          }}
        >
          ⟲ Phase R
        </button>
      </div>
      
      {/* Quick Presets */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        paddingTop: '12px',
        borderTop: '1px solid #333',
      }}>
        {['Mono', 'Subtle Wide', 'Extra Wide', 'Bass Mono'].map(presetName => (
          <button
            key={presetName}
            onClick={() => handlePresetChange(presetName)}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: selectedPreset === presetName ? '#2196F3' : '#333',
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

StereoEnhancerComponent.displayName = 'StereoEnhancerComponent';

export default StereoEnhancerComponent;