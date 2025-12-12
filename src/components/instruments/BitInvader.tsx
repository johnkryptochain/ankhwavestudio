// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * BitInvader UI Component - Interface de synthétiseur à table d'ondes
 * Éditeur de table d'ondes interactif avec capacité de dessin
 */

import React, { useCallback, useState, useRef, useEffect, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

interface BitInvaderParams {
  sampleLength: number;
  interpolation: number;
  normalize: number;
}

interface BitInvaderPreset {
  name: string;
  params: Partial<BitInvaderParams>;
}

interface BitInvaderProps {
  params: BitInvaderParams;
  wavetable: Float32Array | number[];
  onParamChange: (key: keyof BitInvaderParams, value: number) => void;
  onWavetableChange: (data: number[]) => void;
  onSampleChange?: (index: number, value: number) => void;
  onGenerateSine?: () => void;
  onGenerateTriangle?: () => void;
  onGenerateSaw?: () => void;
  onGenerateSquare?: () => void;
  onGenerateNoise?: () => void;
  onSmooth?: () => void;
  onNormalize?: () => void;
  presets?: BitInvaderPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  onTrigger?: () => void;
}

/**
 * Composant éditeur de table d'ondes interactif
 */
const WavetableEditor: React.FC<{
  wavetable: Float32Array | number[];
  sampleLength: number;
  onChange: (data: number[]) => void;
  onSampleChange?: (index: number, value: number) => void;
}> = memo(({ wavetable, sampleLength, onChange, onSampleChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  
  const width = 440;
  const height = 200;
  const padding = 10;
  
  // Dessiner la table d'ondes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Effacer le canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Dessiner la grille
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    // Ligne centrale horizontale
    ctx.beginPath();
    ctx.moveTo(padding, height / 2);
    ctx.lineTo(width - padding, height / 2);
    ctx.stroke();
    
    // Lignes de grille verticales
    const gridLines = 8;
    for (let i = 0; i <= gridLines; i++) {
      const x = padding + (i / gridLines) * (width - 2 * padding);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }
    
    // Dessiner la forme d'onde
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const effectiveLength = Math.min(sampleLength, wavetable.length);
    for (let i = 0; i < effectiveLength; i++) {
      const x = padding + (i / (effectiveLength - 1)) * (width - 2 * padding);
      const y = height / 2 - wavetable[i] * (height / 2 - padding);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Dessiner les points d'échantillons
    ctx.fillStyle = '#22d3ee';
    for (let i = 0; i < effectiveLength; i++) {
      const x = padding + (i / (effectiveLength - 1)) * (width - 2 * padding);
      const y = height / 2 - wavetable[i] * (height / 2 - padding);
      
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [wavetable, sampleLength, width, height, padding]);
  
  // Convertir la position de la souris en index et valeur d'échantillon
  const positionToSample = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // Calculer l'index d'échantillon
    const normalizedX = (x - padding) / (width - 2 * padding);
    const index = Math.round(normalizedX * (sampleLength - 1));
    
    // Calculer la valeur d'échantillon
    const normalizedY = (height / 2 - y) / (height / 2 - padding);
    const value = Math.max(-1, Math.min(1, normalizedY));
    
    return { index: Math.max(0, Math.min(sampleLength - 1, index)), value };
  }, [sampleLength, width, height, padding]);
  
  // Gérer le dessin
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const sample = positionToSample(e.clientX, e.clientY);
    if (sample) {
      setLastPoint({ x: sample.index, y: sample.value });
      if (onSampleChange) {
        onSampleChange(sample.index, sample.value);
      } else {
        const newData = Array.from(wavetable).slice(0, sampleLength);
        newData[sample.index] = sample.value;
        onChange(newData);
      }
    }
  }, [positionToSample, wavetable, sampleLength, onChange, onSampleChange]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const sample = positionToSample(e.clientX, e.clientY);
    if (sample && lastPoint) {
      // Interpoler entre le dernier point et le point actuel
      const newData = Array.from(wavetable).slice(0, sampleLength);
      
      const startIndex = Math.min(lastPoint.x, sample.index);
      const endIndex = Math.max(lastPoint.x, sample.index);
      
      for (let i = startIndex; i <= endIndex; i++) {
        const t = endIndex === startIndex ? 0 : (i - startIndex) / (endIndex - startIndex);
        const value = lastPoint.x < sample.index
          ? lastPoint.y + t * (sample.value - lastPoint.y)
          : sample.value + t * (lastPoint.y - sample.value);
        newData[i] = value;
      }
      
      onChange(newData);
      setLastPoint({ x: sample.index, y: sample.value });
    }
  }, [isDrawing, lastPoint, positionToSample, wavetable, sampleLength, onChange]);
  
  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
    setLastPoint(null);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    setIsDrawing(false);
    setLastPoint(null);
  }, []);
  
  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded border border-daw-border cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      <div className="absolute bottom-2 right-2 text-xs text-daw-text-muted">
        Dessinez pour modifier la forme d'onde
      </div>
    </div>
  );
});

WavetableEditor.displayName = 'WavetableEditor';

/**
 * Boutons de préréglages de forme d'onde
 */
const WaveformButtons: React.FC<{
  onSine?: () => void;
  onTriangle?: () => void;
  onSaw?: () => void;
  onSquare?: () => void;
  onNoise?: () => void;
}> = memo(({ onSine, onTriangle, onSaw, onSquare, onNoise }) => {
  return (
    <div className="flex gap-1">
      <button
        className="px-2 py-1 text-xs bg-daw-bg-primary rounded hover:bg-daw-bg-surface transition-colors"
        onClick={onSine}
        title="Onde sinusoïdale"
      >
        ∿
      </button>
      <button
        className="px-2 py-1 text-xs bg-daw-bg-primary rounded hover:bg-daw-bg-surface transition-colors"
        onClick={onTriangle}
        title="Onde triangulaire"
      >
        △
      </button>
      <button
        className="px-2 py-1 text-xs bg-daw-bg-primary rounded hover:bg-daw-bg-surface transition-colors"
        onClick={onSaw}
        title="Onde en dents de scie"
      >
        ⊿
      </button>
      <button
        className="px-2 py-1 text-xs bg-daw-bg-primary rounded hover:bg-daw-bg-surface transition-colors"
        onClick={onSquare}
        title="Onde carrée"
      >
        □
      </button>
      <button
        className="px-2 py-1 text-xs bg-daw-bg-primary rounded hover:bg-daw-bg-surface transition-colors"
        onClick={onNoise}
        title="Bruit"
      >
        ≋
      </button>
    </div>
  );
});

WaveformButtons.displayName = 'WaveformButtons';

/**
 * Interface utilisateur de l'instrument BitInvader
 */
export const BitInvaderUI: React.FC<BitInvaderProps> = memo(({
  params,
  wavetable,
  onParamChange,
  onWavetableChange,
  onSampleChange,
  onGenerateSine,
  onGenerateTriangle,
  onGenerateSaw,
  onGenerateSquare,
  onGenerateNoise,
  onSmooth,
  onNormalize,
  presets = [],
  onPresetSelect,
  currentPresetIndex = -1,
  onTrigger,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  return (
    <div className="bg-daw-bg-secondary rounded-lg p-4 border border-daw-border">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">BitInvader</h3>
            <p className="text-xs text-daw-text-muted">Synthétiseur à table d'ondes</p>
          </div>
        </div>
        
        {/* Sélecteur de préréglages */}
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
          
          {showPresets && presets.length > 0 && (
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

      {/* Éditeur de table d'ondes */}
      <div className="bg-daw-bg-surface rounded p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs text-daw-text-muted uppercase tracking-wide">Éditeur de table d'ondes</h4>
          <WaveformButtons
            onSine={onGenerateSine}
            onTriangle={onGenerateTriangle}
            onSaw={onGenerateSaw}
            onSquare={onGenerateSquare}
            onNoise={onGenerateNoise}
          />
        </div>
        
        <WavetableEditor
          wavetable={wavetable}
          sampleLength={params.sampleLength}
          onChange={onWavetableChange}
          onSampleChange={onSampleChange}
        />
        
        {/* Outils de l'éditeur */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="xs"
              onClick={onSmooth}
            >
              Lisser
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={onNormalize}
            >
              Normaliser
            </Button>
          </div>
          
          <span className="text-xs text-daw-text-muted">
            {params.sampleLength} échantillons
          </span>
        </div>
      </div>

      {/* Contrôles */}
      <div className="bg-daw-bg-surface rounded p-3 mb-4">
        <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide">Paramètres</h4>
        <div className="flex items-center justify-center gap-6">
          <Knob
            value={params.sampleLength}
            min={32}
            max={256}
            step={1}
            onChange={(v) => onParamChange('sampleLength', v)}
            size="md"
            label="Longueur"
            valueFormatter={(v) => `${Math.round(v)}`}
          />
          
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-daw-text-muted">Interpolation</span>
            <button
              className={`px-4 py-1.5 text-xs rounded transition-colors ${
                params.interpolation > 0.5
                  ? 'bg-cyan-500 text-white'
                  : 'bg-daw-bg-primary text-daw-text-muted'
              }`}
              onClick={() => onParamChange('interpolation', params.interpolation > 0.5 ? 0 : 1)}
            >
              {params.interpolation > 0.5 ? 'ON' : 'OFF'}
            </button>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-daw-text-muted">Normalisation auto</span>
            <button
              className={`px-4 py-1.5 text-xs rounded transition-colors ${
                params.normalize > 0.5
                  ? 'bg-cyan-500 text-white'
                  : 'bg-daw-bg-primary text-daw-text-muted'
              }`}
              onClick={() => onParamChange('normalize', params.normalize > 0.5 ? 0 : 1)}
            >
              {params.normalize > 0.5 ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* Bouton de déclenchement */}
      {onTrigger && (
        <div className="flex justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={onTrigger}
            className="px-8 bg-cyan-500 hover:bg-cyan-600"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Déclencher
          </Button>
        </div>
      )}
    </div>
  );
});

BitInvaderUI.displayName = 'BitInvaderUI';

export default BitInvaderUI;
