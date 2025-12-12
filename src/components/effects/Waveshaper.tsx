// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Waveshaper UI Component
 * 
 * Curve type selector, interactive curve editor,
 * drive and output controls
 */

import React, { memo, useCallback, useRef, useEffect, useState } from 'react';
import { Waveshaper as WaveshaperEffect, WaveshaperCurveType } from '../../audio/effects/Waveshaper';
import { Knob } from '../common/Knob';
import { Slider } from '../common/Slider';

interface WaveshaperProps {
  effect: WaveshaperEffect;
  onParameterChange?: (key: string, value: number) => void;
}

/**
 * Curve visualization component
 */
const CurveDisplay: React.FC<{
  curve: Float32Array;
  curveType: string;
}> = memo(({ curve, curveType }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !curve) return;
    
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
    ctx.strokeStyle = '#333355';
    ctx.lineWidth = 1;
    
    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const x = (i / 4) * width;
      const y = (i / 4) * height;
      
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Draw center lines (axes)
    ctx.strokeStyle = '#555577';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    
    // Draw linear reference line
    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw curve
    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const step = Math.max(1, Math.floor(curve.length / width));
    
    for (let x = 0; x < width; x++) {
      const curveIndex = Math.floor((x / width) * curve.length);
      const y = centerY - (curve[curveIndex] * centerY);
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Draw glow effect
    ctx.strokeStyle = 'rgba(255, 152, 0, 0.3)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    
    for (let x = 0; x < width; x++) {
      const curveIndex = Math.floor((x / width) * curve.length);
      const y = centerY - (curve[curveIndex] * centerY);
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Draw labels
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    
    ctx.fillText('-1', 10, centerY + 12);
    ctx.fillText('+1', width - 10, centerY + 12);
    ctx.fillText('+1', centerX + 12, 12);
    ctx.fillText('-1', centerX + 12, height - 5);
    
    // Draw curve type name
    ctx.fillStyle = '#ff9800';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(curveType, 8, 16);
    
  }, [curve, curveType]);
  
  return (
    <canvas
      ref={canvasRef}
      width={250}
      height={200}
      style={{
        width: '100%',
        height: '200px',
        borderRadius: '4px',
        border: '1px solid #333',
      }}
    />
  );
});

CurveDisplay.displayName = 'CurveDisplay';

/**
 * Curve type button component
 */
const CurveTypeButton: React.FC<{
  type: string;
  index: number;
  selected: boolean;
  onClick: () => void;
}> = memo(({ type, index, selected, onClick }) => {
  // Get icon for curve type
  const getIcon = () => {
    switch (type) {
      case 'softclip': return '〰️';
      case 'hardclip': return '📐';
      case 'sine': return '🌊';
      case 'tanh': return '📈';
      case 'atan': return '📉';
      case 'fuzz': return '⚡';
      case 'asymmetric': return '↗️';
      case 'tube': return '🔥';
      case 'rectify': return '⬆️';
      case 'custom': return '✏️';
      default: return '?';
    }
  };
  
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 8px',
        fontSize: '11px',
        backgroundColor: selected ? '#ff9800' : '#333',
        color: selected ? '#000' : '#fff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        minWidth: '50px',
        transition: 'all 0.2s',
      }}
      title={type}
    >
      <span style={{ fontSize: '14px' }}>{getIcon()}</span>
      <span style={{ textTransform: 'capitalize', fontSize: '9px' }}>
        {type.replace('clip', '')}
      </span>
    </button>
  );
});

CurveTypeButton.displayName = 'CurveTypeButton';

/**
 * Main Waveshaper component
 */
export const WaveshaperComponent: React.FC<WaveshaperProps> = memo(({ effect, onParameterChange }) => {
  const [params, setParams] = useState(effect.getParameters());
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [curve, setCurve] = useState<Float32Array>(effect.getCurve());
  
  const presets = effect.getPresets();
  const curveTypes = WaveshaperEffect.getCurveTypeNames();
  
  // Update curve when parameters change
  useEffect(() => {
    setCurve(effect.getCurve());
  }, [effect, params.curveType, params.drive]);
  
  const handleParameterChange = useCallback((key: string, value: number) => {
    effect.setParameter(key, value);
    setParams({ ...effect.getParameters() });
    onParameterChange?.(key, value);
    
    // Update curve display
    if (key === 'curveType' || key === 'drive') {
      setCurve(effect.getCurve());
    }
  }, [effect, onParameterChange]);
  
  const handlePresetChange = useCallback((presetName: string) => {
    if (presetName) {
      const presetIndex = presets.findIndex(p => p.name === presetName);
      if (presetIndex >= 0) {
        effect.loadPreset(presetIndex);
        setParams({ ...effect.getParameters() });
        setSelectedPreset(presetName);
        setCurve(effect.getCurve());
      }
    }
  }, [effect, presets]);
  
  // Get oversample label
  const getOversampleLabel = (value: number): string => {
    switch (Math.floor(value)) {
      case 0: return 'Aucun';
      case 1: return '2x';
      case 2: return '4x';
      default: return 'None';
    }
  };
  
  return (
    <div className="waveshaper" style={{
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
        <h3 style={{ margin: 0, fontSize: '16px', color: '#ff9800' }}>
          🔊 Waveshaper
        </h3>
        <select
          value={selectedPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
          style={{
            width: '120px',
            backgroundColor: '#333',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '12px',
          }}
        >
          <option value="">Préréglages...</option>
          {presets.map(p => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>
      
      {/* Curve Display */}
      <div style={{ marginBottom: '16px' }}>
        <CurveDisplay
          curve={curve}
          curveType={effect.getCurveTypeName()}
        />
      </div>
      
      {/* Curve Type Selector */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          fontSize: '12px',
          color: '#888',
          marginBottom: '8px',
        }}>
          Type de courbe
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '4px',
        }}>
          {curveTypes.slice(0, 10).map((type, index) => (
            <CurveTypeButton
              key={type}
              type={type}
              index={index}
              selected={Math.floor(params.curveType) === index}
              onClick={() => handleParameterChange('curveType', index)}
            />
          ))}
        </div>
      </div>
      
      {/* Main Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '16px',
      }}>
        {/* Drive */}
        <div style={{ textAlign: 'center' }}>
          <Knob
            value={params.drive}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => handleParameterChange('drive', v)}
            size="md"
            color="warning"
            label="Saturation"
            valueFormatter={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
        
        {/* Output */}
        <div style={{ textAlign: 'center' }}>
          <Knob
            value={params.outputLevel}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => handleParameterChange('outputLevel', v)}
            size="md"
            color="success"
            label="Sortie"
            valueFormatter={(v) => `${Math.round(v * 100)}%`}
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
            color="primary"
            label="Mélange"
            valueFormatter={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      </div>
      
      {/* Oversample Control */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}>
          <span style={{ fontSize: '12px', color: '#888' }}>Suréchantillonnage</span>
          <span style={{ fontSize: '12px', color: '#2196F3' }}>
            {getOversampleLabel(params.oversample)}
          </span>
        </div>
        <div style={{
          display: 'flex',
          gap: '8px',
        }}>
          {['Aucun', '2x', '4x'].map((label, index) => (
            <button
              key={label}
              onClick={() => handleParameterChange('oversample', index)}
              style={{
                flex: 1,
                padding: '6px',
                fontSize: '12px',
                backgroundColor: Math.floor(params.oversample) === index ? '#2196F3' : '#333',
                color: Math.floor(params.oversample) === index ? '#000' : '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{
          fontSize: '10px',
          color: '#666',
          marginTop: '4px',
          textAlign: 'center',
        }}>
          Plus élevé = meilleure qualité, plus de CPU
        </div>
      </div>
      
      {/* Quick Presets */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        paddingTop: '12px',
        borderTop: '1px solid #333',
      }}>
        {['Warm', 'Crunch', 'Fuzz', 'Tube'].map(presetName => (
          <button
            key={presetName}
            onClick={() => handlePresetChange(presetName)}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: selectedPreset === presetName ? '#ff9800' : '#333',
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

WaveshaperComponent.displayName = 'WaveshaperComponent';

export default WaveshaperComponent;