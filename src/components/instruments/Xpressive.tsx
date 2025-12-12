// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Xpressive UI Component - Expressive synthesizer interface
 * Features modulation wheel, pitch bend, and aftertouch controls
 */

import React, { useCallback, useState, memo, useMemo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';
import { XpressiveWaveform, XPRESSIVE_WAVEFORM_NAMES, FilterType } from '../../audio/instruments/Xpressive';

// Filter type names
const FILTER_TYPE_NAMES = ['Passe-bas', 'Passe-haut', 'Passe-bande'];

interface XpressiveParams {
  [key: string]: number;
}

interface XpressivePreset {
  name: string;
  params: Partial<XpressiveParams>;
}

interface XpressiveProps {
  params: XpressiveParams;
  onParamChange: (key: string, value: number) => void;
  presets?: XpressivePreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  modWheel?: number;
  pitchBend?: number;
  aftertouch?: number;
  onModWheelChange?: (value: number) => void;
  onPitchBendChange?: (value: number) => void;
  onAftertouchChange?: (value: number) => void;
  onTrigger?: () => void;
}

/**
 * Waveform selector component
 */
const WaveformSelector: React.FC<{
  value: number;
  onChange: (value: number) => void;
  label: string;
}> = memo(({ value, onChange, label }) => {
  return (
    <div>
      <span className="text-xs text-daw-text-muted block mb-1">{label}</span>
      <div className="flex gap-1">
        {XPRESSIVE_WAVEFORM_NAMES.map((name, i) => (
          <button
            key={i}
            className={`w-8 h-8 rounded text-xs transition-colors ${
              value === i
                ? 'bg-purple-500 text-white'
                : 'bg-daw-bg-primary text-daw-text-secondary hover:bg-daw-bg-elevated'
            }`}
            onClick={() => onChange(i)}
            title={name}
          >
            {name.charAt(0)}
          </button>
        ))}
      </div>
    </div>
  );
});

WaveformSelector.displayName = 'WaveformSelector';

/**
 * Envelope display component
 */
const EnvelopeDisplay: React.FC<{
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  color: string;
}> = memo(({ attack, decay, sustain, release, color }) => {
  const width = 120;
  const height = 50;
  
  const pathD = useMemo(() => {
    const totalTime = attack + decay + 200 + release;
    const scale = width / totalTime;
    
    const attackX = attack * scale;
    const decayX = attackX + decay * scale;
    const sustainX = decayX + 200 * scale;
    const releaseX = sustainX + release * scale;
    
    const sustainY = height - (sustain / 100) * (height - 10);
    
    return `M 0 ${height} L ${attackX} 10 L ${decayX} ${sustainY} L ${sustainX} ${sustainY} L ${releaseX} ${height}`;
  }, [attack, decay, sustain, release]);
  
  return (
    <svg width={width} height={height} className="bg-daw-bg-primary rounded border border-daw-border">
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
});

EnvelopeDisplay.displayName = 'EnvelopeDisplay';

/**
 * Mod wheel component
 */
const ModWheel: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = memo(({ value, onChange }) => {
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const updateValue = (clientY: number) => {
      const y = clientY - rect.top;
      const newValue = 1 - Math.max(0, Math.min(1, y / rect.height));
      onChange(newValue);
    };
    
    updateValue(e.clientY);
    
    const handleMouseMove = (e: MouseEvent) => updateValue(e.clientY);
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onChange]);
  
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-daw-text-muted mb-1">Mod</span>
      <div
        className="w-8 h-24 bg-daw-bg-primary rounded border border-daw-border relative cursor-ns-resize"
        onMouseDown={handleMouseDown}
      >
        {/* Track */}
        <div 
          className="absolute bottom-0 left-0 right-0 bg-purple-500 rounded-b transition-all"
          style={{ height: `${value * 100}%` }}
        />
        {/* Thumb */}
        <div 
          className="absolute left-0 right-0 h-2 bg-white rounded shadow"
          style={{ bottom: `calc(${value * 100}% - 4px)` }}
        />
      </div>
      <span className="text-xs text-daw-text-muted mt-1">{Math.round(value * 127)}</span>
    </div>
  );
});

ModWheel.displayName = 'ModWheel';

/**
 * Pitch bend wheel component
 */
const PitchBendWheel: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = memo(({ value, onChange }) => {
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const updateValue = (clientY: number) => {
      const y = clientY - rect.top;
      const newValue = 1 - 2 * Math.max(0, Math.min(1, y / rect.height));
      onChange(newValue);
    };
    
    updateValue(e.clientY);
    
    const handleMouseMove = (e: MouseEvent) => updateValue(e.clientY);
    const handleMouseUp = () => {
      // Spring back to center
      onChange(0);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onChange]);
  
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-daw-text-muted mb-1">Bend</span>
      <div
        className="w-8 h-24 bg-daw-bg-primary rounded border border-daw-border relative cursor-ns-resize"
        onMouseDown={handleMouseDown}
      >
        {/* Center line */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-daw-border" />
        {/* Value indicator */}
        <div 
          className="absolute left-1 right-1 bg-blue-500 rounded transition-all"
          style={{
            top: value < 0 ? '50%' : `${50 - value * 50}%`,
            height: `${Math.abs(value) * 50}%`,
          }}
        />
        {/* Thumb */}
        <div 
          className="absolute left-0 right-0 h-2 bg-white rounded shadow"
          style={{ top: `calc(${50 - value * 50}% - 4px)` }}
        />
      </div>
      <span className="text-xs text-daw-text-muted mt-1">{value > 0 ? '+' : ''}{(value * 100).toFixed(0)}%</span>
    </div>
  );
});

PitchBendWheel.displayName = 'PitchBendWheel';

/**
 * Aftertouch slider component
 */
const AftertouchSlider: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = memo(({ value, onChange }) => {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-daw-text-muted mb-1">AT</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-20 h-2 appearance-none bg-daw-bg-primary rounded cursor-pointer"
        style={{
          background: `linear-gradient(to right, #ec4899 ${value * 100}%, var(--daw-bg-primary) ${value * 100}%)`
        }}
      />
      <span className="text-xs text-daw-text-muted mt-1">{Math.round(value * 127)}</span>
    </div>
  );
});

AftertouchSlider.displayName = 'AftertouchSlider';

/**
 * Xpressive instrument UI
 */
export const XpressiveUI: React.FC<XpressiveProps> = memo(({
  params,
  onParamChange,
  presets = [],
  onPresetSelect,
  currentPresetIndex = -1,
  modWheel = 0,
  pitchBend = 0,
  aftertouch = 0,
  onModWheelChange,
  onPitchBendChange,
  onAftertouchChange,
  onTrigger,
}) => {
  const [showPresets, setShowPresets] = useState(false);
  const [activeTab, setActiveTab] = useState<'osc' | 'filter' | 'mod'>('osc');

  return (
    <div className="bg-daw-bg-secondary rounded-lg p-4 border border-daw-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[#8286ef] rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">X</span>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Xpressive</h3>
            <p className="text-xs text-daw-text-muted">Synthétiseur expressif</p>
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
          
          {showPresets && presets.length > 0 && (
            <div className="absolute right-0 top-full mt-1 bg-daw-bg-elevated border border-daw-border rounded-lg shadow-xl z-50 min-w-[150px] py-1">
              {presets.map((preset, index) => (
                <button
                  key={index}
                  className={`w-full px-3 py-1.5 text-sm text-left hover:bg-daw-bg-surface ${
                    index === currentPresetIndex ? 'text-purple-400' : 'text-daw-text-secondary'
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

      {/* Expression controls */}
      <div className="flex gap-4 mb-4">
        {/* Mod wheel and pitch bend */}
        <div className="bg-daw-bg-surface rounded p-3 flex gap-3">
          {onModWheelChange && (
            <ModWheel value={modWheel} onChange={onModWheelChange} />
          )}
          {onPitchBendChange && (
            <PitchBendWheel value={pitchBend} onChange={onPitchBendChange} />
          )}
          {onAftertouchChange && (
            <AftertouchSlider value={aftertouch} onChange={onAftertouchChange} />
          )}
        </div>
        
        {/* Master volume */}
        <div className="bg-daw-bg-surface rounded p-3 flex items-center">
          <Knob
            value={params.masterVol || 80}
            min={0}
            max={100}
            onChange={(v) => onParamChange('masterVol', v)}
            size="md"
            label="Principal"
          />
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 mb-4">
        {(['osc', 'filter', 'mod'] as const).map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-purple-500 text-white'
                : 'bg-daw-bg-surface text-daw-text-secondary hover:bg-daw-bg-elevated'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'osc' ? 'Oscillateurs' : tab === 'filter' ? 'Filtre' : 'Modulation'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'osc' && (
        <div className="grid grid-cols-3 gap-4">
          {/* Main oscillator */}
          <div className="bg-daw-bg-surface rounded p-3">
            <div className="text-xs text-daw-text-muted mb-2">Oscillateur principal</div>
            <WaveformSelector
              value={params.mainWave || 0}
              onChange={(v) => onParamChange('mainWave', v)}
              label="Waveform"
            />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Knob
                value={params.mainVol || 100}
                min={0}
                max={100}
                onChange={(v) => onParamChange('mainVol', v)}
                size="sm"
                label="Volume"
              />
              <Knob
                value={params.mainDetune || 0}
                min={-100}
                max={100}
                onChange={(v) => onParamChange('mainDetune', v)}
                size="sm"
                label="Detune"
                bipolar
              />
              {params.mainWave === XpressiveWaveform.Pulse && (
                <Knob
                  value={params.mainPulseWidth || 50}
                  min={5}
                  max={95}
                  onChange={(v) => onParamChange('mainPulseWidth', v)}
                  size="sm"
                  label="PW"
                />
              )}
            </div>
          </div>

          {/* Sub oscillator */}
          <div className="bg-daw-bg-surface rounded p-3">
            <div className="text-xs text-daw-text-muted mb-2">Sous-oscillateur</div>
            <WaveformSelector
              value={params.subWave || 0}
              onChange={(v) => onParamChange('subWave', v)}
              label="Waveform"
            />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Knob
                value={params.subVol || 0}
                min={0}
                max={100}
                onChange={(v) => onParamChange('subVol', v)}
                size="sm"
                label="Volume"
              />
              <Knob
                value={params.subOctave || -1}
                min={-2}
                max={2}
                onChange={(v) => onParamChange('subOctave', Math.round(v))}
                size="sm"
                label="Octave"
                bipolar
              />
              <Knob
                value={params.subDetune || 0}
                min={-100}
                max={100}
                onChange={(v) => onParamChange('subDetune', v)}
                size="sm"
                label="Detune"
                bipolar
              />
            </div>
          </div>

          {/* Noise */}
          <div className="bg-daw-bg-surface rounded p-3">
            <div className="text-xs text-daw-text-muted mb-2">Bruit</div>
            <div className="grid grid-cols-2 gap-2">
              <Knob
                value={params.noiseVol || 0}
                min={0}
                max={100}
                onChange={(v) => onParamChange('noiseVol', v)}
                size="sm"
                label="Volume"
              />
              <Knob
                value={params.noiseColor || 50}
                min={0}
                max={100}
                onChange={(v) => onParamChange('noiseColor', v)}
                size="sm"
                label="Couleur"
              />
            </div>
            <div className="text-xs text-daw-text-muted mt-2 text-center">
              Blanc ← → Rose
            </div>
          </div>
        </div>
      )}

      {activeTab === 'filter' && (
        <div className="grid grid-cols-2 gap-4">
          {/* Filter controls */}
          <div className="bg-daw-bg-surface rounded p-3">
            <div className="text-xs text-daw-text-muted mb-2">Filtre</div>
            <div className="mb-3">
              <select
                className="w-full bg-daw-bg-primary border border-daw-border rounded px-2 py-1 text-sm text-daw-text-secondary"
                value={params.filterType || 0}
                onChange={(e) => onParamChange('filterType', parseInt(e.target.value))}
              >
                {FILTER_TYPE_NAMES.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Knob
                value={params.filterCutoff || 100}
                min={0}
                max={100}
                onChange={(v) => onParamChange('filterCutoff', v)}
                size="md"
                label="Coupure"
              />
              <Knob
                value={params.filterResonance || 0}
                min={0}
                max={100}
                onChange={(v) => onParamChange('filterResonance', v)}
                size="md"
                label="Résonance"
              />
              <Knob
                value={params.filterEnvAmount || 0}
                min={-100}
                max={100}
                onChange={(v) => onParamChange('filterEnvAmount', v)}
                size="sm"
                label="Qte Env"
                bipolar
              />
              <Knob
                value={params.filterKeyTrack || 0}
                min={0}
                max={100}
                onChange={(v) => onParamChange('filterKeyTrack', v)}
                size="sm"
                label="Suivi clavier"
              />
            </div>
          </div>

          {/* Envelopes */}
          <div className="space-y-3">
            {/* Filter envelope */}
            <div className="bg-daw-bg-surface rounded p-3">
              <div className="text-xs text-daw-text-muted mb-2">Enveloppe du filtre</div>
              <div className="flex justify-center mb-2">
                <EnvelopeDisplay
                  attack={params.filterAttack || 10}
                  decay={params.filterDecay || 200}
                  sustain={params.filterSustain || 50}
                  release={params.filterRelease || 200}
                  color="#8b5cf6"
                />
              </div>
              <div className="grid grid-cols-4 gap-1">
                <Knob
                  value={params.filterAttack || 10}
                  min={0}
                  max={5000}
                  onChange={(v) => onParamChange('filterAttack', v)}
                  size="xs"
                  label="A"
                />
                <Knob
                  value={params.filterDecay || 200}
                  min={0}
                  max={5000}
                  onChange={(v) => onParamChange('filterDecay', v)}
                  size="xs"
                  label="D"
                />
                <Knob
                  value={params.filterSustain || 50}
                  min={0}
                  max={100}
                  onChange={(v) => onParamChange('filterSustain', v)}
                  size="xs"
                  label="S"
                />
                <Knob
                  value={params.filterRelease || 200}
                  min={0}
                  max={5000}
                  onChange={(v) => onParamChange('filterRelease', v)}
                  size="xs"
                  label="R"
                />
              </div>
            </div>

            {/* Amp envelope */}
            <div className="bg-daw-bg-surface rounded p-3">
              <div className="text-xs text-daw-text-muted mb-2">Enveloppe d'amplitude</div>
              <div className="flex justify-center mb-2">
                <EnvelopeDisplay
                  attack={params.ampAttack || 10}
                  decay={params.ampDecay || 100}
                  sustain={params.ampSustain || 80}
                  release={params.ampRelease || 200}
                  color="#ec4899"
                />
              </div>
              <div className="grid grid-cols-4 gap-1">
                <Knob
                  value={params.ampAttack || 10}
                  min={0}
                  max={5000}
                  onChange={(v) => onParamChange('ampAttack', v)}
                  size="xs"
                  label="A"
                />
                <Knob
                  value={params.ampDecay || 100}
                  min={0}
                  max={5000}
                  onChange={(v) => onParamChange('ampDecay', v)}
                  size="xs"
                  label="D"
                />
                <Knob
                  value={params.ampSustain || 80}
                  min={0}
                  max={100}
                  onChange={(v) => onParamChange('ampSustain', v)}
                  size="xs"
                  label="S"
                />
                <Knob
                  value={params.ampRelease || 200}
                  min={0}
                  max={5000}
                  onChange={(v) => onParamChange('ampRelease', v)}
                  size="xs"
                  label="R"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'mod' && (
        <div className="grid grid-cols-2 gap-4">
          {/* Modulation routing */}
          <div className="bg-daw-bg-surface rounded p-3">
            <div className="text-xs text-daw-text-muted mb-2">Routage molette de modulation</div>
            <div className="grid grid-cols-2 gap-2">
              <Knob
                value={params.modWheelToCutoff || 0}
                min={0}
                max={100}
                onChange={(v) => onParamChange('modWheelToCutoff', v)}
                size="sm"
                label="→ Cutoff"
              />
              <Knob
                value={params.modWheelToVibrato || 50}
                min={0}
                max={100}
                onChange={(v) => onParamChange('modWheelToVibrato', v)}
                size="sm"
                label="→ Vibrato"
              />
            </div>
            
            <div className="text-xs text-daw-text-muted mt-4 mb-2">Vibrato</div>
            <div className="grid grid-cols-2 gap-2">
              <Knob
                value={params.vibratoRate || 5}
                min={0.1}
                max={20}
                onChange={(v) => onParamChange('vibratoRate', v)}
                size="sm"
                label="Vitesse"
              />
              <Knob
                value={params.vibratoDepth || 0}
                min={0}
                max={100}
                onChange={(v) => onParamChange('vibratoDepth', v)}
                size="sm"
                label="Profondeur"
              />
            </div>
          </div>

          {/* Expression routing */}
          <div className="bg-daw-bg-surface rounded p-3">
            <div className="text-xs text-daw-text-muted mb-2">Routage aftertouch</div>
            <div className="grid grid-cols-2 gap-2">
              <Knob
                value={params.aftertouchToCutoff || 0}
                min={0}
                max={100}
                onChange={(v) => onParamChange('aftertouchToCutoff', v)}
                size="sm"
                label="→ Cutoff"
              />
              <Knob
                value={params.aftertouchToVolume || 0}
                min={0}
                max={100}
                onChange={(v) => onParamChange('aftertouchToVolume', v)}
                size="sm"
                label="→ Volume"
              />
            </div>
            
            <div className="text-xs text-daw-text-muted mt-4 mb-2">Pitch Bend</div>
            <div className="flex items-center gap-2">
              <Knob
                value={params.pitchBendRange || 2}
                min={1}
                max={24}
                onChange={(v) => onParamChange('pitchBendRange', Math.round(v))}
                size="sm"
                label="Plage"
              />
              <span className="text-xs text-daw-text-muted">demi-tons</span>
            </div>
            
            <div className="text-xs text-daw-text-muted mt-4 mb-2">Glissando</div>
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  params.glideEnabled > 0.5
                    ? 'bg-purple-500 text-white'
                    : 'bg-daw-bg-primary text-daw-text-secondary hover:bg-daw-bg-elevated'
                }`}
                onClick={() => onParamChange('glideEnabled', params.glideEnabled > 0.5 ? 0 : 1)}
              >
                {params.glideEnabled > 0.5 ? 'ON' : 'OFF'}
              </button>
              <Knob
                value={params.glideTime || 0}
                min={0}
                max={1000}
                onChange={(v) => onParamChange('glideTime', v)}
                size="sm"
                label="Temps"
                disabled={params.glideEnabled <= 0.5}
              />
            </div>
          </div>
        </div>
      )}

      {/* Trigger button */}
      {onTrigger && (
        <div className="flex justify-center mt-4">
          <Button
            variant="primary"
            size="lg"
            onClick={onTrigger}
            className="px-8 bg-purple-500 hover:bg-purple-600"
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

XpressiveUI.displayName = 'XpressiveUI';

export default XpressiveUI;