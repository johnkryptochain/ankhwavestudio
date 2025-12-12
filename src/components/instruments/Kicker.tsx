// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Kicker UI Component - Interface pour le synthétiseur de grosse caisse Kicker
 */

import React, { useCallback, useState, useEffect, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

interface KickerParams {
  startFreq: number;
  endFreq: number;
  decay: number;
  distortion: number;
  click: number;
  clickFreq: number;
  clickDuration: number;
  slope: number;
  gain: number;
  noteTracking: number;
}

interface KickerPreset {
  name: string;
  params: Partial<KickerParams>;
}

interface KickerProps {
  params: KickerParams;
  onParamChange: (key: keyof KickerParams, value: number) => void;
  presets?: KickerPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  onTrigger?: () => void;
}

const defaultPresets: KickerPreset[] = [
  { name: '808 Classique', params: { startFreq: 300, endFreq: 35, decay: 0.3, distortion: 0.1, click: 0 } },
  { name: 'Kick Punchy', params: { startFreq: 500, endFreq: 50, decay: 0.15, distortion: 0.2, click: 1 } },
  { name: 'Sub Basse', params: { startFreq: 100, endFreq: 30, decay: 0.5, distortion: 0, click: 0 } },
  { name: 'Kick Techno', params: { startFreq: 800, endFreq: 45, decay: 0.2, distortion: 0.3, click: 1 } },
  { name: 'Kick Doux', params: { startFreq: 200, endFreq: 40, decay: 0.25, distortion: 0, click: 0 } },
  { name: 'Distordu', params: { startFreq: 400, endFreq: 50, decay: 0.18, distortion: 0.6, click: 1 } },
];

/**
 * Composant de prévisualisation de forme d'onde montrant l'enveloppe de hauteur
 */
const WaveformPreview: React.FC<{
  startFreq: number;
  endFreq: number;
  decay: number;
  slope: number;
}> = memo(({ startFreq, endFreq, decay, slope }) => {
  const width = 200;
  const height = 60;
  const padding = 4;
  
  // Générer le chemin pour l'enveloppe de hauteur
  const generatePath = useCallback(() => {
    const points: string[] = [];
    const steps = 50;
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = padding + t * (width - 2 * padding);
      
      // Calculer la fréquence à ce point
      let freq: number;
      if (slope < 0.5) {
        // Exponentiel
        freq = startFreq * Math.pow(endFreq / startFreq, t);
      } else {
        // Linéaire
        freq = startFreq + (endFreq - startFreq) * t;
      }
      
      // Normaliser à la hauteur (échelle logarithmique pour la fréquence)
      const minLog = Math.log(20);
      const maxLog = Math.log(20000);
      const freqLog = Math.log(Math.max(20, Math.min(20000, freq)));
      const normalizedFreq = (freqLog - minLog) / (maxLog - minLog);
      const y = height - padding - normalizedFreq * (height - 2 * padding);
      
      points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    
    return points.join(' ');
  }, [startFreq, endFreq, slope, width, height, padding]);
  
  // Générer le chemin de l'enveloppe d'amplitude
  const generateAmplitudePath = useCallback(() => {
    const points: string[] = [];
    const steps = 50;
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = padding + t * (width - 2 * padding);
      
      // Déclin exponentiel
      const amplitude = Math.exp(-t * 5 / decay);
      const y = height - padding - amplitude * (height - 2 * padding) * 0.3;
      
      points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    
    return points.join(' ');
  }, [decay, width, height, padding]);

  return (
    <svg
      width={width}
      height={height}
      className="bg-daw-bg-primary rounded border border-daw-border"
    >
      {/* Lignes de grille */}
      <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#333" strokeWidth="1" />
      <line x1={width/2} y1={padding} x2={width/2} y2={height-padding} stroke="#333" strokeWidth="1" />
      
      {/* Enveloppe de hauteur */}
      <path
        d={generatePath()}
        fill="none"
        stroke="#4ade80"
        strokeWidth="2"
        strokeLinecap="round"
      />
      
      {/* Enveloppe d'amplitude (atténuée) */}
      <path
        d={generateAmplitudePath()}
        fill="none"
        stroke="#60a5fa"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      
      {/* Étiquettes */}
      <text x={padding + 2} y={12} fill="#666" fontSize="8">Hauteur</text>
      <text x={width - 30} y={12} fill="#666" fontSize="8">Amp</text>
    </svg>
  );
});

WaveformPreview.displayName = 'WaveformPreview';

/**
 * Interface utilisateur de l'instrument Kicker
 */
export const KickerUI: React.FC<KickerProps> = memo(({
  params,
  onParamChange,
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
  onTrigger,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const handleKnobChange = useCallback((key: keyof KickerParams) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  const handleToggleClick = useCallback(() => {
    onParamChange('click', params.click > 0.5 ? 0 : 1);
  }, [onParamChange, params.click]);

  const handleToggleSlope = useCallback(() => {
    onParamChange('slope', params.slope > 0.5 ? 0 : 1);
  }, [onParamChange, params.slope]);

  return (
    <div className="bg-daw-bg-secondary rounded-lg p-4 border border-daw-border">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">K</span>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Kicker</h3>
            <p className="text-xs text-daw-text-muted">Synthétiseur de grosse caisse</p>
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

      {/* Prévisualisation de forme d'onde */}
      <div className="flex justify-center mb-4">
        <WaveformPreview
          startFreq={params.startFreq}
          endFreq={params.endFreq}
          decay={params.decay}
          slope={params.slope}
        />
      </div>

      {/* Contrôles principaux */}
      <div className="grid grid-cols-5 gap-4 mb-4">
      {/* Section hauteur */}
      <div className="col-span-2 bg-daw-bg-surface rounded p-3">
        <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide">Hauteur</h4>
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <Knob
              value={params.startFreq}
              min={20}
              max={2000}
              onChange={handleKnobChange('startFreq')}
              size="lg"
              label="Début"
              unit=" Hz"
            />
          </div>
          <div className="flex flex-col items-center">
            <Knob
              value={params.endFreq}
              min={20}
              max={500}
              onChange={handleKnobChange('endFreq')}
              size="lg"
              label="Fin"
              unit=" Hz"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="text-xs text-daw-text-muted">Pente :</span>
          <button
            className={`px-2 py-0.5 text-xs rounded ${
              params.slope < 0.5
                ? 'bg-daw-accent-primary text-white'
                : 'bg-daw-bg-primary text-daw-text-secondary'
            }`}
            onClick={handleToggleSlope}
          >
            {params.slope < 0.5 ? 'Exp' : 'Lin'}
          </button>
        </div>
      </div>

      {/* Section enveloppe */}
      <div className="bg-daw-bg-surface rounded p-3">
        <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide">Enveloppe</h4>
        <div className="flex flex-col items-center">
          <Knob
            value={params.decay}
            min={0.01}
            max={2}
            step={0.01}
            onChange={handleKnobChange('decay')}
            size="lg"
            label="Déclin"
            valueFormatter={(v: number) => `${(v * 1000).toFixed(0)} ms`}
          />
        </div>
      </div>

      {/* Section tonalité */}
      <div className="col-span-2 bg-daw-bg-surface rounded p-3">
        <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide">Tonalité</h4>
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <Knob
              value={params.distortion}
              min={0}
              max={1}
              step={0.01}
              onChange={handleKnobChange('distortion')}
              size="lg"
              label="Distorsion"
              valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
          </div>
          <div className="flex flex-col items-center">
            <Knob
              value={params.gain}
              min={0}
              max={1}
              step={0.01}
              onChange={handleKnobChange('gain')}
              size="lg"
              label="Gain"
              valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
          </div>
        </div>
      </div>
    </div>

    {/* Section clic */}
    <div className="bg-daw-bg-surface rounded p-3 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs text-daw-text-muted uppercase tracking-wide">Clic</h4>
        <button
          className={`px-3 py-1 text-xs rounded transition-colors ${
            params.click > 0.5
              ? 'bg-daw-accent-primary text-white'
              : 'bg-daw-bg-primary text-daw-text-muted'
          }`}
          onClick={handleToggleClick}
        >
          {params.click > 0.5 ? 'ON' : 'OFF'}
        </button>
      </div>
      
      {params.click > 0.5 && (
        <div className="flex gap-4 justify-center">
          <div className="flex flex-col items-center">
            <Knob
              value={params.clickFreq}
              min={500}
              max={5000}
              onChange={handleKnobChange('clickFreq')}
              size="md"
              label="Fréq"
              unit=" Hz"
            />
          </div>
          <div className="flex flex-col items-center">
            <Knob
              value={params.clickDuration}
              min={0.001}
              max={0.05}
              step={0.001}
              onChange={handleKnobChange('clickDuration')}
              size="md"
              label="Durée"
              valueFormatter={(v: number) => `${(v * 1000).toFixed(1)} ms`}
            />
          </div>
        </div>
      )}
    </div>

    {/* Section avancée */}
    <div className="bg-daw-bg-surface rounded p-3">
      <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide">Avancé</h4>
      <div className="flex justify-center">
        <div className="flex flex-col items-center">
          <Knob
            value={params.noteTracking}
            min={0}
            max={1}
            step={0.01}
            onChange={handleKnobChange('noteTracking')}
            size="md"
            label="Suivi note"
            valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
          />
        </div>
      </div>
    </div>

      {/* Bouton de déclenchement */}
      {onTrigger && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={onTrigger}
            className="px-8"
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

KickerUI.displayName = 'KickerUI';

export default KickerUI;
