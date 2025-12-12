// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * LB302 UI Component - TB-303 style bass synthesizer interface
 */

import React, { useCallback, useState, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

// Waveform types
const WAVEFORMS = [
  { value: 0, name: 'Scie', icon: '⊿' },
  { value: 1, name: 'Tri', icon: '△' },
  { value: 2, name: 'Carré', icon: '□' },
  { value: 3, name: 'CarréAléa', icon: '◗' },
  { value: 4, name: 'Moog', icon: '⋀' },
  { value: 5, name: 'Sin', icon: '∿' },
  { value: 6, name: 'Exp', icon: '⌒' },
  { value: 7, name: 'Bruit', icon: '≋' },
  { value: 8, name: 'Scie BL', icon: '⊿' },
  { value: 9, name: 'Carré BL', icon: '□' },
  { value: 10, name: 'Tri BL', icon: '△' },
  { value: 11, name: 'Moog BL', icon: '⋀' },
];

interface LB302Params {
  cutoff: number;
  resonance: number;
  envMod: number;
  decay: number;
  distortion: number;
  waveform: number;
  slideDecay: number;
  slide: number;
  accent: number;
  dead: number;
  db24: number;
  gain: number;
}

interface LB302Preset {
  name: string;
  params: Partial<LB302Params>;
}

interface LB302Props {
  params: LB302Params;
  onParamChange: (key: keyof LB302Params, value: number) => void;
  presets?: LB302Preset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  onTrigger?: () => void;
}

const defaultPresets: LB302Preset[] = [
  { name: 'Acid Classique', params: { cutoff: 0.5, resonance: 0.9, envMod: 0.6, decay: 0.3, distortion: 0.2, waveform: 8, db24: 1 } },
  { name: 'Basse Squelchy', params: { cutoff: 0.3, resonance: 1.1, envMod: 0.8, decay: 0.2, distortion: 0.1, waveform: 9, slide: 1, db24: 1 } },
  { name: 'Sub Profond', params: { cutoff: 0.2, resonance: 0.5, envMod: 0.2, decay: 0.5, distortion: 0, waveform: 5, db24: 0 } },
  { name: 'Lead Résonant', params: { cutoff: 0.7, resonance: 1.0, envMod: 0.5, decay: 0.15, distortion: 0.3, waveform: 8, slide: 1, db24: 1 } },
  { name: 'Acid Sale', params: { cutoff: 0.6, resonance: 1.2, envMod: 0.7, decay: 0.25, distortion: 0.6, waveform: 8, slide: 1, db24: 1 } },
  { name: 'Basse Douce', params: { cutoff: 0.4, resonance: 0.3, envMod: 0.3, decay: 0.4, distortion: 0, waveform: 1, db24: 0 } },
];

/**
 * Filter visualization component
 */
const FilterDisplay: React.FC<{
  cutoff: number;
  resonance: number;
  envMod: number;
  db24: boolean;
}> = memo(({ cutoff, resonance, envMod, db24 }) => {
  const width = 180;
  const height = 80;
  const padding = 8;
  
  // Generate filter response curve
  const generatePath = useCallback(() => {
    const points: string[] = [];
    const steps = 100;
    
    // Normalize cutoff to frequency position
    const cutoffX = padding + cutoff * (width - 2 * padding);
    
    for (let i = 0; i <= steps; i++) {
      const x = padding + (i / steps) * (width - 2 * padding);
      
      // Simple lowpass filter response approximation
      const freq = i / steps;
      const cutoffNorm = cutoff;
      
      let response: number;
      if (freq < cutoffNorm) {
        response = 1;
      } else {
        const rolloff = db24 ? 4 : 2; // 24dB vs 12dB per octave
        const distance = (freq - cutoffNorm) / (1 - cutoffNorm + 0.01);
        response = Math.max(0, 1 - Math.pow(distance, rolloff));
      }
      
      // Add resonance peak
      const resPeak = Math.exp(-Math.pow((freq - cutoffNorm) * 10, 2)) * resonance * 0.5;
      response = Math.min(1.2, response + resPeak);
      
      const y = height - padding - response * (height - 2 * padding);
      points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    
    return points.join(' ');
  }, [cutoff, resonance, db24, width, height, padding]);

  return (
    <svg
      width={width}
      height={height}
      className="bg-daw-bg-primary rounded border border-daw-border"
    >
      {/* Grid lines */}
      <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#333" strokeWidth="1" strokeDasharray="2,2" />
      <line x1={width/4} y1={padding} x2={width/4} y2={height-padding} stroke="#333" strokeWidth="1" strokeDasharray="2,2" />
      <line x1={width/2} y1={padding} x2={width/2} y2={height-padding} stroke="#333" strokeWidth="1" strokeDasharray="2,2" />
      <line x1={3*width/4} y1={padding} x2={3*width/4} y2={height-padding} stroke="#333" strokeWidth="1" strokeDasharray="2,2" />
      
      {/* Filter response curve */}
      <path
        d={generatePath()}
        fill="none"
        stroke="#f97316"
        strokeWidth="2"
        strokeLinecap="round"
      />
      
      {/* Cutoff indicator */}
      <line 
        x1={padding + cutoff * (width - 2 * padding)} 
        y1={padding} 
        x2={padding + cutoff * (width - 2 * padding)} 
        y2={height - padding} 
        stroke="#f97316" 
        strokeWidth="1" 
        strokeDasharray="4,2"
        opacity="0.5"
      />
      
      {/* Labels */}
      <text x={padding} y={height - 2} fill="#666" fontSize="8">20Hz</text>
      <text x={width - 30} y={height - 2} fill="#666" fontSize="8">20kHz</text>
      <text x={padding} y={10} fill="#666" fontSize="8">{db24 ? '24dB' : '12dB'}</text>
    </svg>
  );
});

FilterDisplay.displayName = 'FilterDisplay';

/**
 * Waveform selector component
 */
const WaveformSelector: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = memo(({ value, onChange }) => {
  const [showAll, setShowAll] = useState(false);
  
  // Show only band-limited waveforms by default
  const basicWaveforms = WAVEFORMS.slice(0, 8);
  const blWaveforms = WAVEFORMS.slice(8);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-daw-text-muted uppercase tracking-wide">Forme d'onde</span>
        <button
          className="text-xs text-daw-text-secondary hover:text-daw-text-primary"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Voir moins' : 'Voir tout'}
        </button>
      </div>
      
      {/* Band-limited waveforms (recommended) */}
      <div className="grid grid-cols-4 gap-1">
        {blWaveforms.map((wf) => (
          <button
            key={wf.value}
            className={`px-2 py-1.5 text-xs rounded transition-colors ${
              value === wf.value
                ? 'bg-orange-500 text-white'
                : 'bg-daw-bg-primary text-daw-text-secondary hover:bg-daw-bg-surface'
            }`}
            onClick={() => onChange(wf.value)}
            title={wf.name}
          >
            <span className="text-lg">{wf.icon}</span>
          </button>
        ))}
      </div>
      
      {/* Basic waveforms (optional) */}
      {showAll && (
        <div className="grid grid-cols-4 gap-1 pt-1 border-t border-daw-border">
          {basicWaveforms.map((wf) => (
            <button
              key={wf.value}
              className={`px-2 py-1.5 text-xs rounded transition-colors ${
                value === wf.value
                  ? 'bg-orange-500 text-white'
                  : 'bg-daw-bg-primary text-daw-text-secondary hover:bg-daw-bg-surface'
              }`}
              onClick={() => onChange(wf.value)}
              title={wf.name}
            >
              <span className="text-lg">{wf.icon}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

WaveformSelector.displayName = 'WaveformSelector';

/**
 * LB302 instrument UI
 */
export const LB302UI: React.FC<LB302Props> = memo(({
  params,
  onParamChange,
  presets = defaultPresets,
  onPresetSelect,
  currentPresetIndex = -1,
  onTrigger,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const handleKnobChange = useCallback((key: keyof LB302Params) => (value: number) => {
    onParamChange(key, value);
  }, [onParamChange]);

  const handleToggle = useCallback((key: keyof LB302Params) => () => {
    onParamChange(key, params[key] > 0.5 ? 0 : 1);
  }, [onParamChange, params]);

  return (
    <div className="bg-daw-bg-secondary rounded-lg p-4 border border-daw-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-yellow-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">303</span>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">LB302</h3>
            <p className="text-xs text-daw-text-muted">Synthé basse TB-303</p>
          </div>
        </div>
        
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
                    index === currentPresetIndex ? 'text-orange-500' : 'text-daw-text-secondary'
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

      {/* Filter display */}
      <div className="flex justify-center mb-4">
        <FilterDisplay
          cutoff={params.cutoff / 1.5}
          resonance={params.resonance}
          envMod={params.envMod}
          db24={params.db24 > 0.5}
        />
      </div>

      {/* Main controls */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Filter section */}
        <div className="bg-daw-bg-surface rounded p-3">
          <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide">Filtre VCF</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center">
              <Knob
                value={params.cutoff}
                min={0}
                max={1.5}
                step={0.005}
                onChange={handleKnobChange('cutoff')}
                size="lg"
                label="Coupure"
                valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
            </div>
            <div className="flex flex-col items-center">
              <Knob
                value={params.resonance}
                min={0}
                max={1.25}
                step={0.005}
                onChange={handleKnobChange('resonance')}
                size="lg"
                label="Réso"
                valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
            </div>
            <div className="flex flex-col items-center">
              <Knob
                value={params.envMod}
                min={0}
                max={1}
                step={0.005}
                onChange={handleKnobChange('envMod')}
                size="md"
                label="Mod Env"
                valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
            </div>
            <div className="flex flex-col items-center">
              <Knob
                value={params.decay}
                min={0}
                max={1}
                step={0.005}
                onChange={handleKnobChange('decay')}
                size="md"
                label="Déclin"
                valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
            </div>
          </div>
          
          {/* Filter mode toggle */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-xs text-daw-text-muted">Filtre :</span>
            <button
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                params.db24 < 0.5
                  ? 'bg-orange-500 text-white'
                  : 'bg-daw-bg-primary text-daw-text-secondary'
              }`}
              onClick={handleToggle('db24')}
            >
              12dB
            </button>
            <button
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                params.db24 > 0.5
                  ? 'bg-orange-500 text-white'
                  : 'bg-daw-bg-primary text-daw-text-secondary'
              }`}
              onClick={handleToggle('db24')}
            >
              24dB
            </button>
          </div>
        </div>

        {/* Oscillator section */}
        <div className="bg-daw-bg-surface rounded p-3">
          <WaveformSelector
            value={params.waveform}
            onChange={handleKnobChange('waveform')}
          />
          
          <div className="mt-3 flex justify-center">
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
        </div>
      </div>

      {/* Slide section */}
      <div className="bg-daw-bg-surface rounded p-3 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs text-daw-text-muted uppercase tracking-wide">Glissé / Portamento</h4>
          <button
            className={`px-3 py-1 text-xs rounded transition-colors ${
              params.slide > 0.5
                ? 'bg-orange-500 text-white'
                : 'bg-daw-bg-primary text-daw-text-muted'
            }`}
            onClick={handleToggle('slide')}
          >
            {params.slide > 0.5 ? 'ON' : 'OFF'}
          </button>
        </div>
        
        {params.slide > 0.5 && (
          <div className="flex justify-center">
            <Knob
              value={params.slideDecay}
              min={0}
              max={1}
              step={0.005}
              onChange={handleKnobChange('slideDecay')}
              size="md"
              label="Déclin glissé"
              valueFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
          </div>
        )}
      </div>

      {/* Note options */}
      <div className="bg-daw-bg-surface rounded p-3 mb-4">
        <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide">Options de note</h4>
        <div className="flex justify-center gap-4">
          <button
            className={`px-4 py-2 text-xs rounded transition-colors ${
              params.accent > 0.5
                ? 'bg-orange-500 text-white'
                : 'bg-daw-bg-primary text-daw-text-muted'
            }`}
            onClick={handleToggle('accent')}
          >
            Accent
          </button>
          <button
            className={`px-4 py-2 text-xs rounded transition-colors ${
              params.dead > 0.5
                ? 'bg-orange-500 text-white'
                : 'bg-daw-bg-primary text-daw-text-muted'
            }`}
            onClick={handleToggle('dead')}
          >
            Muet
          </button>
        </div>
      </div>

      {/* Output section */}
      <div className="bg-daw-bg-surface rounded p-3">
        <h4 className="text-xs text-daw-text-muted mb-3 uppercase tracking-wide">Sortie</h4>
        <div className="flex justify-center">
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

      {/* Trigger button */}
      {onTrigger && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={onTrigger}
            className="px-8 bg-orange-500 hover:bg-orange-600"
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

LB302UI.displayName = 'LB302UI';

export default LB302UI;
