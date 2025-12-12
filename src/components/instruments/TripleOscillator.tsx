// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * TripleOscillator - Classic AnkhWaveStudio synthesizer with 3 oscillators
 * Features: 3 oscillator sections, waveform selector, volume/pan/tune knobs,
 * oscillator mix modes, filter section, ADSR envelopes, LFO section, preset browser
 */

import React, { useState, useCallback, memo } from 'react';
import { Knob, Slider, Button } from '../common';

type WaveformType = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'noise' | 'moog' | 'exp';
type MixMode = 'add' | 'am' | 'fm' | 'pm';
type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';

interface OscillatorState {
  enabled: boolean;
  waveform: WaveformType;
  volume: number;
  pan: number;
  coarse: number;
  fine: number;
  phaseOffset: number;
  stereoPhase: number;
}

interface EnvelopeState {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  amount: number;
}

interface FilterState {
  type: FilterType;
  cutoff: number;
  resonance: number;
  envelope: EnvelopeState;
}

interface LFOState {
  enabled: boolean;
  waveform: WaveformType;
  speed: number;
  amount: number;
  target: 'volume' | 'pitch' | 'filter' | 'pan';
}

interface TripleOscillatorState {
  oscillators: OscillatorState[];
  mixMode: MixMode;
  filter: FilterState;
  ampEnvelope: EnvelopeState;
  lfo: LFOState;
  masterVolume: number;
}

interface TripleOscillatorProps {
  state?: Partial<TripleOscillatorState>;
  onStateChange?: (state: TripleOscillatorState) => void;
  onPresetLoad?: (presetName: string) => void;
  onPresetSave?: (presetName: string) => void;
  className?: string;
}

const WAVEFORMS: { type: WaveformType; label: string; icon: string }[] = [
  { type: 'sine', label: 'Sinus', icon: '∿' },
  { type: 'triangle', label: 'Triangle', icon: '△' },
  { type: 'sawtooth', label: 'Scie', icon: '⊿' },
  { type: 'square', label: 'Carré', icon: '⊓' },
  { type: 'noise', label: 'Bruit', icon: '⋯' },
  { type: 'moog', label: 'Moog', icon: '⌇' },
  { type: 'exp', label: 'Exp', icon: '⌒' },
];

const MIX_MODES: { mode: MixMode; label: string }[] = [
  { mode: 'add', label: 'Ajouter' },
  { mode: 'am', label: 'AM' },
  { mode: 'fm', label: 'FM' },
  { mode: 'pm', label: 'PM' },
];

const FILTER_TYPES: { type: FilterType; label: string }[] = [
  { type: 'lowpass', label: 'LP' },
  { type: 'highpass', label: 'HP' },
  { type: 'bandpass', label: 'BP' },
  { type: 'notch', label: 'Encoche' },
];

const defaultOscillator: OscillatorState = {
  enabled: true,
  waveform: 'sine',
  volume: 0.33,
  pan: 0,
  coarse: 0,
  fine: 0,
  phaseOffset: 0,
  stereoPhase: 0,
};

const defaultEnvelope: EnvelopeState = {
  attack: 0.01,
  decay: 0.1,
  sustain: 0.7,
  release: 0.3,
  amount: 1,
};

const defaultState: TripleOscillatorState = {
  oscillators: [
    { ...defaultOscillator },
    { ...defaultOscillator, enabled: false },
    { ...defaultOscillator, enabled: false },
  ],
  mixMode: 'add',
  filter: {
    type: 'lowpass',
    cutoff: 1,
    resonance: 0,
    envelope: { ...defaultEnvelope, amount: 0 },
  },
  ampEnvelope: { ...defaultEnvelope },
  lfo: {
    enabled: false,
    waveform: 'sine',
    speed: 1,
    amount: 0,
    target: 'volume',
  },
  masterVolume: 0.8,
};

export const TripleOscillator: React.FC<TripleOscillatorProps> = memo(({
  state: externalState,
  onStateChange,
  onPresetLoad,
  onPresetSave,
  className = '',
}) => {
  const [state, setState] = useState<TripleOscillatorState>({
    ...defaultState,
    ...externalState,
  });
  const [showPresets, setShowPresets] = useState(false);
  const [activeSection, setActiveSection] = useState<'osc' | 'filter' | 'env' | 'lfo'>('osc');

  // Update state and notify parent
  const updateState = useCallback((updates: Partial<TripleOscillatorState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      onStateChange?.(newState);
      return newState;
    });
  }, [onStateChange]);

  // Update oscillator
  const updateOscillator = useCallback((index: number, updates: Partial<OscillatorState>) => {
    setState(prev => {
      const newOscs = [...prev.oscillators];
      newOscs[index] = { ...newOscs[index], ...updates };
      const newState = { ...prev, oscillators: newOscs };
      onStateChange?.(newState);
      return newState;
    });
  }, [onStateChange]);

  // Render waveform selector
  const renderWaveformSelector = (
    currentWaveform: WaveformType,
    onChange: (wf: WaveformType) => void,
    disabled?: boolean
  ) => (
    <div className="flex gap-0.5">
      {WAVEFORMS.map(wf => (
        <button
          key={wf.type}
          className={`w-6 h-6 rounded text-xs font-mono transition-colors ${
            currentWaveform === wf.type
              ? 'bg-daw-accent-primary text-white'
              : 'bg-daw-bg-surface text-daw-text-muted hover:bg-daw-bg-elevated'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => !disabled && onChange(wf.type)}
          title={wf.label}
          disabled={disabled}
        >
          {wf.icon}
        </button>
      ))}
    </div>
  );

  // Render oscillator section
  const renderOscillator = (osc: OscillatorState, index: number) => (
    <div
      key={index}
      className={`p-3 rounded-lg transition-opacity ${
        osc.enabled ? 'bg-daw-bg-surface' : 'bg-daw-bg-secondary opacity-50'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            className={`w-5 h-5 rounded-full transition-colors ${
              osc.enabled ? 'bg-green-500' : 'bg-daw-bg-primary border border-daw-border'
            }`}
            onClick={() => updateOscillator(index, { enabled: !osc.enabled })}
            title={osc.enabled ? 'Désactiver' : 'Activer'}
          />
          <span className="text-sm font-bold text-daw-text-primary">OSC {index + 1}</span>
        </div>
        {renderWaveformSelector(
          osc.waveform,
          (wf) => updateOscillator(index, { waveform: wf }),
          !osc.enabled
        )}
      </div>

      {/* Knobs row 1 */}
      <div className="grid grid-cols-4 gap-3 mb-2">
        <div className="flex flex-col items-center">
          <Knob
            value={osc.volume * 100}
            min={0}
            max={100}
            size="sm"
            onChange={(v) => updateOscillator(index, { volume: v / 100 })}
            disabled={!osc.enabled}
          />
          <span className="text-xxs text-daw-text-muted mt-1">Vol</span>
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={(osc.pan + 1) * 50}
            min={0}
            max={100}
            size="sm"
            bipolar
            onChange={(v) => updateOscillator(index, { pan: (v / 50) - 1 })}
            disabled={!osc.enabled}
          />
          <span className="text-xxs text-daw-text-muted mt-1">Pan</span>
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={osc.coarse + 24}
            min={0}
            max={48}
            size="sm"
            bipolar
            onChange={(v) => updateOscillator(index, { coarse: v - 24 })}
            disabled={!osc.enabled}
          />
          <span className="text-xxs text-daw-text-muted mt-1">Grossier</span>
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={osc.fine + 100}
            min={0}
            max={200}
            size="sm"
            bipolar
            onChange={(v) => updateOscillator(index, { fine: v - 100 })}
            disabled={!osc.enabled}
          />
          <span className="text-xxs text-daw-text-muted mt-1">Fin</span>
        </div>
      </div>

      {/* Knobs row 2 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center">
          <Knob
            value={osc.phaseOffset}
            min={0}
            max={360}
            size="sm"
            onChange={(v) => updateOscillator(index, { phaseOffset: v })}
            disabled={!osc.enabled}
          />
          <span className="text-xxs text-daw-text-muted mt-1">Phase</span>
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={osc.stereoPhase}
            min={0}
            max={360}
            size="sm"
            onChange={(v) => updateOscillator(index, { stereoPhase: v })}
            disabled={!osc.enabled}
          />
          <span className="text-xxs text-daw-text-muted mt-1">Stéréo</span>
        </div>
      </div>
    </div>
  );

  // Render envelope
  const renderEnvelope = (
    envelope: EnvelopeState,
    onChange: (updates: Partial<EnvelopeState>) => void,
    label: string,
    showAmount?: boolean
  ) => (
    <div className="p-3 bg-daw-bg-surface rounded-lg">
      <div className="text-xs font-medium text-daw-text-muted mb-3">{label}</div>
      <div className="grid grid-cols-4 gap-2">
        <div className="flex flex-col items-center">
          <Knob
            value={envelope.attack * 20}
            min={0}
            max={100}
            size="sm"
            onChange={(v) => onChange({ attack: v / 20 })}
          />
          <span className="text-xxs text-daw-text-muted mt-1">A</span>
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={envelope.decay * 20}
            min={0}
            max={100}
            size="sm"
            onChange={(v) => onChange({ decay: v / 20 })}
          />
          <span className="text-xxs text-daw-text-muted mt-1">D</span>
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={envelope.sustain * 100}
            min={0}
            max={100}
            size="sm"
            onChange={(v) => onChange({ sustain: v / 100 })}
          />
          <span className="text-xxs text-daw-text-muted mt-1">S</span>
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={envelope.release * 20}
            min={0}
            max={100}
            size="sm"
            onChange={(v) => onChange({ release: v / 20 })}
          />
          <span className="text-xxs text-daw-text-muted mt-1">R</span>
        </div>
      </div>
      {showAmount && (
        <div className="flex justify-center mt-2">
          <div className="flex flex-col items-center">
            <Knob
              value={(envelope.amount + 1) * 50}
              min={0}
              max={100}
              size="sm"
              bipolar
              onChange={(v) => onChange({ amount: (v / 50) - 1 })}
            />
            <span className="text-xxs text-daw-text-muted mt-1">Amt</span>
          </div>
        </div>
      )}
    </div>
  );

  // Render filter section
  const renderFilter = () => (
    <div className="p-3 bg-daw-bg-surface rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-daw-text-muted">FILTRE</span>
        <div className="flex gap-0.5">
          {FILTER_TYPES.map(ft => (
            <button
              key={ft.type}
              className={`px-2 py-1 rounded text-xxs transition-colors ${
                state.filter.type === ft.type
                  ? 'bg-daw-accent-primary text-white'
                  : 'bg-daw-bg-primary text-daw-text-muted hover:bg-daw-bg-elevated'
              }`}
              onClick={() => updateState({
                filter: { ...state.filter, type: ft.type }
              })}
            >
              {ft.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col items-center">
          <Knob
            value={state.filter.cutoff * 100}
            min={0}
            max={100}
            size="md"
            onChange={(v) => updateState({
              filter: { ...state.filter, cutoff: v / 100 }
            })}
          />
          <span className="text-xxs text-daw-text-muted mt-1">Coupure</span>
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={state.filter.resonance * 100}
            min={0}
            max={100}
            size="md"
            onChange={(v) => updateState({
              filter: { ...state.filter, resonance: v / 100 }
            })}
          />
          <span className="text-xxs text-daw-text-muted mt-1">Reso</span>
        </div>
      </div>
    </div>
  );

  // Render LFO section
  const renderLFO = () => (
    <div className="p-3 bg-daw-bg-surface rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            className={`w-4 h-4 rounded-full transition-colors ${
              state.lfo.enabled ? 'bg-green-500' : 'bg-daw-bg-primary border border-daw-border'
            }`}
            onClick={() => updateState({
              lfo: { ...state.lfo, enabled: !state.lfo.enabled }
            })}
          />
          <span className="text-xs font-medium text-daw-text-muted">LFO</span>
        </div>
        {renderWaveformSelector(
          state.lfo.waveform,
          (wf) => updateState({ lfo: { ...state.lfo, waveform: wf } }),
          !state.lfo.enabled
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center">
          <Knob
            value={state.lfo.speed * 10}
            min={0}
            max={100}
            size="sm"
            onChange={(v) => updateState({
              lfo: { ...state.lfo, speed: v / 10 }
            })}
            disabled={!state.lfo.enabled}
          />
          <span className="text-xxs text-daw-text-muted mt-1">Vitesse</span>
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={state.lfo.amount * 100}
            min={0}
            max={100}
            size="sm"
            onChange={(v) => updateState({
              lfo: { ...state.lfo, amount: v / 100 }
            })}
            disabled={!state.lfo.enabled}
          />
          <span className="text-xxs text-daw-text-muted mt-1">Quantité</span>
        </div>
        <div className="flex flex-col items-center">
          <select
            value={state.lfo.target}
            onChange={(e) => updateState({
              lfo: { ...state.lfo, target: e.target.value as LFOState['target'] }
            })}
            className="bg-daw-bg-primary border border-daw-border rounded px-1 py-0.5 text-xxs text-daw-text-primary"
            disabled={!state.lfo.enabled}
          >
            <option value="volume">Vol</option>
            <option value="pitch">Hauteur</option>
            <option value="filter">Filtre</option>
            <option value="pan">Pan</option>
          </select>
          <span className="text-xxs text-daw-text-muted mt-1">Cible</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col bg-daw-bg-secondary rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-daw-bg-elevated border-b border-daw-border">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎹</span>
          <span className="text-sm font-bold text-daw-text-primary">Triple Oscillator</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mix mode selector */}
          <div className="flex gap-0.5">
            {MIX_MODES.map(mm => (
              <button
                key={mm.mode}
                className={`px-2 py-1 rounded text-xxs transition-colors ${
                  state.mixMode === mm.mode
                    ? 'bg-daw-accent-primary text-white'
                    : 'bg-daw-bg-surface text-daw-text-muted hover:bg-daw-bg-primary'
                }`}
                onClick={() => updateState({ mixMode: mm.mode })}
                title={`Mode de mixage : ${mm.label}`}
              >
                {mm.label}
              </button>
            ))}
          </div>
          
          {/* Presets button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowPresets(!showPresets)}
          >
            Presets
          </Button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex border-b border-daw-border">
        {(['osc', 'filter', 'env', 'lfo'] as const).map(section => (
          <button
            key={section}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeSection === section
                ? 'bg-daw-bg-surface text-daw-text-primary border-b-2 border-daw-accent-primary'
                : 'text-daw-text-muted hover:text-daw-text-secondary'
            }`}
            onClick={() => setActiveSection(section)}
          >
            {section.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-3">
        {activeSection === 'osc' && (
          <div className="space-y-2">
            {state.oscillators.map((osc, index) => renderOscillator(osc, index))}
          </div>
        )}

        {activeSection === 'filter' && (
          <div className="space-y-3">
            {renderFilter()}
            {renderEnvelope(
              state.filter.envelope,
              (updates) => updateState({
                filter: { ...state.filter, envelope: { ...state.filter.envelope, ...updates } }
              }),
              'ENVELOPPE DU FILTRE',
              true
            )}
          </div>
        )}

        {activeSection === 'env' && (
          <div className="space-y-3">
            {renderEnvelope(
              state.ampEnvelope,
              (updates) => updateState({
                ampEnvelope: { ...state.ampEnvelope, ...updates }
              }),
              "ENVELOPPE D'AMPLITUDE"
            )}
          </div>
        )}

        {activeSection === 'lfo' && (
          <div className="space-y-3">
            {renderLFO()}
          </div>
        )}
      </div>

      {/* Master volume */}
      <div className="flex items-center gap-3 p-3 border-t border-daw-border bg-daw-bg-elevated">
        <span className="text-xs text-daw-text-muted">Principal</span>
        <Slider
          value={state.masterVolume * 100}
          min={0}
          max={100}
          size="sm"
          onChange={(v) => {
            const value = Array.isArray(v) ? v[0] : v;
            updateState({ masterVolume: value / 100 });
          }}
        />
        <span className="text-xs text-daw-text-muted w-8">
          {Math.round(state.masterVolume * 100)}%
        </span>
      </div>

      {/* Presets dropdown */}
      {showPresets && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPresets(false)} />
          <div className="absolute top-12 right-2 bg-daw-bg-elevated border border-daw-border rounded shadow-lg z-50 w-48">
            <div className="p-2 border-b border-daw-border">
              <span className="text-xs font-medium text-daw-text-primary">Préréglages</span>
            </div>
            <div className="max-h-48 overflow-auto">
              {['Init', 'Bass', 'Lead', 'Pad', 'Pluck', 'Keys', 'Strings', 'Brass'].map(preset => (
                <button
                  key={preset}
                  onClick={() => {
                    onPresetLoad?.(preset);
                    setShowPresets(false);
                  }}
                  className="block w-full px-3 py-2 text-sm text-left text-daw-text-primary hover:bg-daw-bg-surface"
                >
                  {preset}
                </button>
              ))}
            </div>
            <div className="p-2 border-t border-daw-border">
              <Button size="sm" variant="secondary" className="w-full" onClick={() => onPresetSave?.('New Preset')}>
                Enregistrer le préréglage
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

TripleOscillator.displayName = 'TripleOscillator';

export default TripleOscillator;