// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * StereoMatrix UI Component - Visual interface for the StereoMatrix effect
 */

import React, { useCallback, useState, useEffect, useRef, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

interface StereoMatrixParams {
  ll: number;
  lr: number;
  rl: number;
  rr: number;
}

interface StereoMatrixPreset {
  name: string;
  params: Partial<StereoMatrixParams>;
}

interface StereoMatrixProps {
  params: StereoMatrixParams;
  onParamChange: (key: keyof StereoMatrixParams, value: number) => void;
  onPresetApply?: (preset: string) => void;
  presets?: StereoMatrixPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  bypassed?: boolean;
  onBypassToggle?: () => void;
}

const defaultPresets: StereoMatrixPreset[] = [
  { name: 'Stereo', params: { ll: 1, lr: 0, rl: 0, rr: 1 } },
  { name: 'Mono', params: { ll: 0.5, lr: 0.5, rl: 0.5, rr: 0.5 } },
  { name: 'Swap', params: { ll: 0, lr: 1, rl: 1, rr: 0 } },
  { name: 'Wide', params: { ll: 1.2, lr: -0.2, rl: -0.2, rr: 1.2 } },
  { name: 'Narrow', params: { ll: 0.7, lr: 0.3, rl: 0.3, rr: 0.7 } },
];

const quickPresets = [
  { name: 'Stereo', value: 'stereo' },
  { name: 'Mono', value: 'mono' },
  { name: 'Swap', value: 'swap' },
  { name: 'Wide', value: 'wide' },
  { name: 'Narrow', value: 'narrow' },
  { name: 'L Only', value: 'leftOnly' },
  { name: 'R Only', value: 'rightOnly' },
  { name: 'M/S', value: 'midSide' },
];

/**
 * Stereo field visualization
 */
const StereoFieldDisplay: React.FC<{
  ll: number;
  lr: number;
  rl: number;
  rr: number;
}> = memo(({ ll, lr, rl, rr }) => {
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
    const radius = Math.min(width, height) / 2 - 20;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw background circle
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw cross
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.stroke();
    
    // Draw L and R labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('L', centerX - radius - 10, centerY + 4);
    ctx.fillText('R', centerX + radius + 10, centerY + 4);
    
    // Calculate stereo field representation
    // Left channel output position
    const leftOutX = centerX + (lr - ll) * radius * 0.5;
    const leftOutY = centerY - (ll + lr) * radius * 0.3;
    
    // Right channel output position
    const rightOutX = centerX + (rr - rl) * radius * 0.5;
    const rightOutY = centerY - (rl + rr) * radius * 0.3;
    
    // Draw stereo field shape
    ctx.fillStyle = 'rgba(34, 211, 238, 0.2)';
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(centerX - radius * 0.3, centerY);
    ctx.lineTo(leftOutX, leftOutY);
    ctx.lineTo(centerX, centerY - radius * 0.5);
    ctx.lineTo(rightOutX, rightOutY);
    ctx.lineTo(centerX + radius * 0.3, centerY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Draw input indicators
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(centerX - radius * 0.3, centerY, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(centerX + radius * 0.3, centerY, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw output indicators
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(leftOutX, leftOutY, 6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(rightOutX, rightOutY, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '10px sans-serif';
    ctx.fillText('In L', centerX - radius * 0.3, centerY + 15);
    ctx.fillText('In R', centerX + radius * 0.3, centerY + 15);
    
  }, [ll, lr, rl, rr]);

  return (
    <canvas
      ref={canvasRef}
      width={180}
      height={180}
      className="rounded border border-daw-border"
    />
  );
});

StereoFieldDisplay.displayName = 'StereoFieldDisplay';

/**
 * Matrix grid component
 */
const MatrixGrid: React.FC<{
  ll: number;
  lr: number;
  rl: number;
  rr: number;
  onLLChange: (value: number) => void;
  onLRChange: (value: number) => void;
  onRLChange: (value: number) => void;
  onRRChange: (value: number) => void;
}> = memo(({ ll, lr, rl, rr, onLLChange, onLRChange, onRLChange, onRRChange }) => {
  return (
    <div className="bg-daw-bg-surface rounded p-3">
      <div className="grid grid-cols-3 gap-2 items-center">
        {/* Header row */}
        <div></div>
        <div className="text-center text-xs text-cyan-400 font-medium">Sortie G</div>
        <div className="text-center text-xs text-pink-400 font-medium">Sortie D</div>
        
        {/* Left input row */}
        <div className="text-right text-xs text-cyan-400 font-medium pr-2">Entrée G</div>
        <div className="flex justify-center">
          <Knob
            value={ll}
            min={-2}
            max={2}
            step={0.01}
            onChange={onLLChange}
            size="md"
            valueFormatter={(v: number) => v.toFixed(2)}
          />
        </div>
        <div className="flex justify-center">
          <Knob
            value={lr}
            min={-2}
            max={2}
            step={0.01}
            onChange={onLRChange}
            size="md"
            valueFormatter={(v: number) => v.toFixed(2)}
          />
        </div>
        
        {/* Right input row */}
        <div className="text-right text-xs text-pink-400 font-medium pr-2">Entrée D</div>
        <div className="flex justify-center">
          <Knob
            value={rl}
            min={-2}
            max={2}
            step={0.01}
            onChange={onRLChange}
            size="md"
            valueFormatter={(v: number) => v.toFixed(2)}
          />
        </div>
        <div className="flex justify-center">
          <Knob
            value={rr}
            min={-2}
            max={2}
            step={0.01}
            onChange={onRRChange}
            size="md"
            valueFormatter={(v: number) => v.toFixed(2)}
          />
        </div>
      </div>
    </div>
  );
});

MatrixGrid.displayName = 'MatrixGrid';

/**
 * StereoMatrix effect UI
 */
export const StereoMatrixUI: React.FC<StereoMatrixProps> = memo(({
  params,
  onParamChange,
  onPresetApply,
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
  bypassed = false,
  onBypassToggle,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const handleParamChange = useCallback((key: keyof StereoMatrixParams) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  return (
    <div className={`bg-daw-bg-secondary rounded-lg p-4 border border-daw-border ${bypassed ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#8286ef] rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">StereoMatrix</h3>
            <p className="text-xs text-daw-text-muted">Matrice 2x2</p>
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

      {/* Main content */}
      <div className="flex gap-4">
        {/* Stereo field display */}
        <div className="flex flex-col items-center">
          <StereoFieldDisplay
            ll={params.ll}
            lr={params.lr}
            rl={params.rl}
            rr={params.rr}
          />
          <span className="text-xs text-daw-text-muted mt-2">Champ stéréo</span>
        </div>

        {/* Matrix grid */}
        <div className="flex-1">
          <MatrixGrid
            ll={params.ll}
            lr={params.lr}
            rl={params.rl}
            rr={params.rr}
            onLLChange={handleParamChange('ll')}
            onLRChange={handleParamChange('lr')}
            onRLChange={handleParamChange('rl')}
            onRRChange={handleParamChange('rr')}
          />
        </div>
      </div>

      {/* Quick presets */}
      <div className="mt-4">
        <h4 className="text-xs text-daw-text-muted mb-2 uppercase tracking-wide">Préréglages rapides</h4>
        <div className="flex flex-wrap gap-1">
          {quickPresets.map((preset) => (
            <button
              key={preset.value}
              className="px-2 py-1 text-xs bg-daw-bg-surface hover:bg-daw-bg-primary text-daw-text-secondary rounded"
              onClick={() => onPresetApply?.(preset.value)}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Matrix explanation */}
      <div className="mt-4 p-2 bg-daw-bg-surface rounded text-xs text-daw-text-muted">
        <p className="mb-1"><strong>Matrice :</strong> Contrôle comment les canaux d'entrée sont routés vers les sorties</p>
        <p>• <span className="text-cyan-400">G→G</span> + <span className="text-pink-400">D→G</span> = Sortie gauche</p>
        <p>• <span className="text-cyan-400">G→D</span> + <span className="text-pink-400">D→D</span> = Sortie droite</p>
      </div>
    </div>
  );
});

StereoMatrixUI.displayName = 'StereoMatrixUI';

export default StereoMatrixUI;