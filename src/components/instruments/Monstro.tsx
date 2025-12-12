// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Monstro UI Component - Modular 3-oscillator synthesizer interface
 * Features tabbed interface with Operators view and Matrix view
 */

import React, { useCallback, useState, memo } from 'react';
import { Knob } from '../common/Knob';
import { Button } from '../common/Button';

// Waveform options for oscillators
const OSC_WAVEFORMS = [
  { value: 0, name: 'Sine', icon: '∿' },
  { value: 1, name: 'Triangle', icon: '△' },
  { value: 2, name: 'Saw', icon: '⊿' },
  { value: 3, name: 'Ramp', icon: '⊿̅' },
  { value: 4, name: 'Square', icon: '□' },
  { value: 5, name: 'Moog', icon: '⋀' },
  { value: 6, name: 'Soft Sqr', icon: '◗' },
  { value: 7, name: 'Sin Abs', icon: '∩' },
  { value: 8, name: 'Exp', icon: '⌒' },
  { value: 9, name: 'Bruit', icon: '≋' },
  { value: 10, name: 'Tri BL', icon: '△' },
  { value: 11, name: 'Scie BL', icon: '⊿' },
  { value: 12, name: 'Rampe BL', icon: '⊿̅' },
  { value: 13, name: 'Carré BL', icon: '□' },
  { value: 14, name: 'Moog BL', icon: '⋀' },
];

// LFO waveform options
const LFO_WAVEFORMS = [
  { value: 0, name: 'Sine', icon: '∿' },
  { value: 1, name: 'Triangle', icon: '△' },
  { value: 2, name: 'Saw', icon: '⊿' },
  { value: 3, name: 'Ramp', icon: '⊿̅' },
  { value: 4, name: 'Square', icon: '□' },
  { value: 5, name: 'Moog', icon: '⋀' },
  { value: 6, name: 'Soft Sqr', icon: '◗' },
  { value: 7, name: 'Sin Abs', icon: '∩' },
  { value: 8, name: 'Exp', icon: '⌒' },
  { value: 9, name: 'Aléatoire', icon: '⚡' },
  { value: 10, name: 'Aléa lisse', icon: '〰' },
];

// Modulation types
const MOD_TYPES = [
  { value: 0, name: 'Mix' },
  { value: 1, name: 'AM' },
  { value: 2, name: 'FM' },
  { value: 3, name: 'PM' },
];

interface MonstroParams {
  // Oscillator 1
  osc1Vol: number;
  osc1Pan: number;
  osc1Crs: number;
  osc1FtL: number;
  osc1FtR: number;
  osc1Spo: number;
  osc1Pw: number;
  osc1SSR: number;
  osc1SSF: number;
  
  // Oscillator 2
  osc2Vol: number;
  osc2Pan: number;
  osc2Crs: number;
  osc2FtL: number;
  osc2FtR: number;
  osc2Spo: number;
  osc2Wave: number;
  osc2SyncH: number;
  osc2SyncR: number;
  
  // Oscillator 3
  osc3Vol: number;
  osc3Pan: number;
  osc3Crs: number;
  osc3Spo: number;
  osc3Sub: number;
  osc3Wave1: number;
  osc3Wave2: number;
  osc3SyncH: number;
  osc3SyncR: number;
  
  // LFOs
  lfo1Wave: number;
  lfo1Att: number;
  lfo1Rate: number;
  lfo1Phs: number;
  lfo2Wave: number;
  lfo2Att: number;
  lfo2Rate: number;
  lfo2Phs: number;
  
  // Envelopes
  env1Pre: number;
  env1Att: number;
  env1Hold: number;
  env1Dec: number;
  env1Sus: number;
  env1Rel: number;
  env1Slope: number;
  env2Pre: number;
  env2Att: number;
  env2Hold: number;
  env2Dec: number;
  env2Sus: number;
  env2Rel: number;
  env2Slope: number;
  
  // Modulation
  o23Mod: number;
  
  // Matrix - Volume
  vol1Env1: number;
  vol1Env2: number;
  vol1Lfo1: number;
  vol1Lfo2: number;
  vol2Env1: number;
  vol2Env2: number;
  vol2Lfo1: number;
  vol2Lfo2: number;
  vol3Env1: number;
  vol3Env2: number;
  vol3Lfo1: number;
  vol3Lfo2: number;
  
  // Matrix - Phase
  phs1Env1: number;
  phs1Env2: number;
  phs1Lfo1: number;
  phs1Lfo2: number;
  phs2Env1: number;
  phs2Env2: number;
  phs2Lfo1: number;
  phs2Lfo2: number;
  phs3Env1: number;
  phs3Env2: number;
  phs3Lfo1: number;
  phs3Lfo2: number;
  
  // Matrix - Pitch
  pit1Env1: number;
  pit1Env2: number;
  pit1Lfo1: number;
  pit1Lfo2: number;
  pit2Env1: number;
  pit2Env2: number;
  pit2Lfo1: number;
  pit2Lfo2: number;
  pit3Env1: number;
  pit3Env2: number;
  pit3Lfo1: number;
  pit3Lfo2: number;
  
  // Matrix - PW (osc1 only)
  pw1Env1: number;
  pw1Env2: number;
  pw1Lfo1: number;
  pw1Lfo2: number;
  
  // Matrix - Sub (osc3 only)
  sub3Env1: number;
  sub3Env2: number;
  sub3Lfo1: number;
  sub3Lfo2: number;
  
  // Output
  gain: number;
}

interface MonstroPreset {
  name: string;
  params: Partial<MonstroParams>;
}

interface MonstroProps {
  params: MonstroParams;
  onParamChange: (key: keyof MonstroParams, value: number) => void;
  presets?: MonstroPreset[];
  onPresetSelect?: (index: number) => void;
  currentPresetIndex?: number;
  onTrigger?: () => void;
}

/**
 * Waveform selector component
 */
const WaveformSelector: React.FC<{
  value: number;
  onChange: (value: number) => void;
  waveforms: typeof OSC_WAVEFORMS;
  label?: string;
}> = memo(({ value, onChange, waveforms, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selected = waveforms.find(w => w.value === value) || waveforms[0];
  
  return (
    <div className="relative">
      {label && <span className="text-[10px] text-daw-text-muted block mb-1">{label}</span>}
      <button
        className="flex items-center gap-1 px-2 py-1 bg-daw-bg-primary rounded border border-daw-border hover:border-daw-border-light text-xs"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-base">{selected.icon}</span>
        <span className="text-daw-text-secondary">{selected.name}</span>
        <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-daw-bg-elevated border border-daw-border rounded shadow-xl max-h-48 overflow-y-auto min-w-[120px]">
          {waveforms.map((wf) => (
            <button
              key={wf.value}
              className={`w-full px-2 py-1 text-left text-xs flex items-center gap-2 hover:bg-daw-bg-surface ${
                value === wf.value ? 'text-purple-400 bg-daw-bg-surface' : 'text-daw-text-secondary'
              }`}
              onClick={() => {
                onChange(wf.value);
                setIsOpen(false);
              }}
            >
              <span className="text-base">{wf.icon}</span>
              <span>{wf.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

WaveformSelector.displayName = 'WaveformSelector';

/**
 * Envelope display component
 */
const EnvelopeDisplay: React.FC<{
  pre: number;
  att: number;
  hold: number;
  dec: number;
  sus: number;
  rel: number;
  slope: number;
  color?: string;
}> = memo(({ pre, att, hold, dec, sus, rel, slope, color = '#a855f7' }) => {
  const width = 160;
  const height = 50;
  const padding = 4;
  
  // Normalize times
  const totalTime = pre + att + hold + dec + rel;
  const scale = totalTime > 0 ? (width - 2 * padding) / totalTime : 1;
  
  // Calculate points
  const points: string[] = [];
  let x = padding;
  
  // Pre-delay
  points.push(`M ${x} ${height - padding}`);
  x += pre * scale;
  points.push(`L ${x} ${height - padding}`);
  
  // Attack
  const attackEnd = x + att * scale;
  points.push(`L ${attackEnd} ${padding}`);
  x = attackEnd;
  
  // Hold
  x += hold * scale;
  points.push(`L ${x} ${padding}`);
  
  // Decay
  const susY = padding + (1 - sus / 100) * (height - 2 * padding);
  x += dec * scale;
  points.push(`L ${x} ${susY}`);
  
  // Sustain (shown as a portion)
  const susWidth = Math.min(20, (width - 2 * padding) * 0.1);
  x += susWidth;
  points.push(`L ${x} ${susY}`);
  
  // Release
  x += rel * scale;
  points.push(`L ${x} ${height - padding}`);
  
  return (
    <svg width={width} height={height} className="bg-daw-bg-primary rounded border border-daw-border">
      <path
        d={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

EnvelopeDisplay.displayName = 'EnvelopeDisplay';

/**
 * Oscillator section component
 */
const OscillatorSection: React.FC<{
  oscNum: 1 | 2 | 3;
  params: MonstroParams;
  onParamChange: (key: keyof MonstroParams, value: number) => void;
}> = memo(({ oscNum, params, onParamChange }) => {
  const prefix = `osc${oscNum}` as const;
  const color = oscNum === 1 ? 'text-purple-400' : oscNum === 2 ? 'text-blue-400' : 'text-green-400';
  
  return (
    <div className="bg-daw-bg-surface rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className={`text-xs font-semibold ${color}`}>OSC {oscNum}</h4>
        {oscNum === 1 && (
          <span className="text-[10px] text-daw-text-muted">Impulsion</span>
        )}
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        <Knob
          value={params[`${prefix}Vol` as keyof MonstroParams] as number}
          min={0}
          max={100}
          onChange={(v) => onParamChange(`${prefix}Vol` as keyof MonstroParams, v)}
          size="sm"
          label="Vol"
        />
        <Knob
          value={params[`${prefix}Pan` as keyof MonstroParams] as number}
          min={-100}
          max={100}
          onChange={(v) => onParamChange(`${prefix}Pan` as keyof MonstroParams, v)}
          size="sm"
          label="Pan"
          bipolar
        />
        <Knob
          value={params[`${prefix}Crs` as keyof MonstroParams] as number}
          min={-24}
          max={24}
          onChange={(v) => onParamChange(`${prefix}Crs` as keyof MonstroParams, v)}
          size="sm"
          label="Crs"
          bipolar
        />
        {oscNum !== 3 && (
          <Knob
            value={params[`${prefix}FtL` as keyof MonstroParams] as number}
            min={-100}
            max={100}
            onChange={(v) => onParamChange(`${prefix}FtL` as keyof MonstroParams, v)}
            size="sm"
            label="Fin G"
            bipolar
          />
        )}
        {oscNum === 3 && (
          <Knob
            value={params.osc3Sub}
            min={0}
            max={100}
            onChange={(v) => onParamChange('osc3Sub', v)}
            size="sm"
            label="Sub"
          />
        )}
      </div>
      
      <div className="grid grid-cols-4 gap-2 mt-2">
        {oscNum !== 3 && (
          <Knob
            value={params[`${prefix}FtR` as keyof MonstroParams] as number}
            min={-100}
            max={100}
            onChange={(v) => onParamChange(`${prefix}FtR` as keyof MonstroParams, v)}
            size="sm"
            label="Fin D"
            bipolar
          />
        )}
        <Knob
          value={params[`${prefix}Spo` as keyof MonstroParams] as number}
          min={0}
          max={360}
          onChange={(v) => onParamChange(`${prefix}Spo` as keyof MonstroParams, v)}
          size="sm"
          label="Phase"
        />
        {oscNum === 1 && (
          <Knob
            value={params.osc1Pw}
            min={1}
            max={99}
            onChange={(v) => onParamChange('osc1Pw', v)}
            size="sm"
            label="PW"
          />
        )}
        {oscNum === 2 && (
          <WaveformSelector
            value={params.osc2Wave}
            onChange={(v) => onParamChange('osc2Wave', v)}
            waveforms={OSC_WAVEFORMS}
            label="Onde"
          />
        )}
        {oscNum === 3 && (
          <>
            <WaveformSelector
              value={params.osc3Wave1}
              onChange={(v) => onParamChange('osc3Wave1', v)}
              waveforms={OSC_WAVEFORMS}
              label="Onde 1"
            />
            <WaveformSelector
              value={params.osc3Wave2}
              onChange={(v) => onParamChange('osc3Wave2', v)}
              waveforms={OSC_WAVEFORMS}
              label="Onde 2"
            />
          </>
        )}
      </div>
    </div>
  );
});

OscillatorSection.displayName = 'OscillatorSection';

/**
 * LFO section component
 */
const LFOSection: React.FC<{
  lfoNum: 1 | 2;
  params: MonstroParams;
  onParamChange: (key: keyof MonstroParams, value: number) => void;
}> = memo(({ lfoNum, params, onParamChange }) => {
  const prefix = `lfo${lfoNum}` as const;
  const color = lfoNum === 1 ? 'text-yellow-400' : 'text-orange-400';
  
  return (
    <div className="bg-daw-bg-surface rounded p-3">
      <h4 className={`text-xs font-semibold ${color} mb-2`}>LFO {lfoNum}</h4>
      
      <div className="flex items-center gap-3">
        <WaveformSelector
          value={params[`${prefix}Wave` as keyof MonstroParams] as number}
          onChange={(v) => onParamChange(`${prefix}Wave` as keyof MonstroParams, v)}
          waveforms={LFO_WAVEFORMS}
        />
        
        <Knob
          value={params[`${prefix}Rate` as keyof MonstroParams] as number}
          min={0.01}
          max={20}
          step={0.01}
          onChange={(v) => onParamChange(`${prefix}Rate` as keyof MonstroParams, v)}
          size="sm"
          label="Vitesse"
          unit="Hz"
        />
        <Knob
          value={params[`${prefix}Att` as keyof MonstroParams] as number}
          min={0}
          max={5000}
          onChange={(v) => onParamChange(`${prefix}Att` as keyof MonstroParams, v)}
          size="sm"
          label="Att"
          unit="ms"
        />
        <Knob
          value={params[`${prefix}Phs` as keyof MonstroParams] as number}
          min={0}
          max={360}
          onChange={(v) => onParamChange(`${prefix}Phs` as keyof MonstroParams, v)}
          size="sm"
          label="Phase"
        />
      </div>
    </div>
  );
});

LFOSection.displayName = 'LFOSection';

/**
 * Envelope section component
 */
const EnvelopeSection: React.FC<{
  envNum: 1 | 2;
  params: MonstroParams;
  onParamChange: (key: keyof MonstroParams, value: number) => void;
}> = memo(({ envNum, params, onParamChange }) => {
  const prefix = `env${envNum}` as const;
  const color = envNum === 1 ? 'text-red-400' : 'text-pink-400';
  
  return (
    <div className="bg-daw-bg-surface rounded p-3">
      <h4 className={`text-xs font-semibold ${color} mb-2`}>ENV {envNum}</h4>
      
      <EnvelopeDisplay
        pre={params[`${prefix}Pre` as keyof MonstroParams] as number}
        att={params[`${prefix}Att` as keyof MonstroParams] as number}
        hold={params[`${prefix}Hold` as keyof MonstroParams] as number}
        dec={params[`${prefix}Dec` as keyof MonstroParams] as number}
        sus={params[`${prefix}Sus` as keyof MonstroParams] as number}
        rel={params[`${prefix}Rel` as keyof MonstroParams] as number}
        slope={params[`${prefix}Slope` as keyof MonstroParams] as number}
        color={envNum === 1 ? '#f87171' : '#f472b6'}
      />
      
      <div className="grid grid-cols-7 gap-1 mt-2">
        <Knob
          value={params[`${prefix}Pre` as keyof MonstroParams] as number}
          min={0}
          max={2000}
          onChange={(v) => onParamChange(`${prefix}Pre` as keyof MonstroParams, v)}
          size="xs"
          label="Pre"
        />
        <Knob
          value={params[`${prefix}Att` as keyof MonstroParams] as number}
          min={1}
          max={5000}
          onChange={(v) => onParamChange(`${prefix}Att` as keyof MonstroParams, v)}
          size="xs"
          label="Att"
        />
        <Knob
          value={params[`${prefix}Hold` as keyof MonstroParams] as number}
          min={0}
          max={2000}
          onChange={(v) => onParamChange(`${prefix}Hold` as keyof MonstroParams, v)}
          size="xs"
          label="Tenue"
        />
        <Knob
          value={params[`${prefix}Dec` as keyof MonstroParams] as number}
          min={1}
          max={5000}
          onChange={(v) => onParamChange(`${prefix}Dec` as keyof MonstroParams, v)}
          size="xs"
          label="Dec"
        />
        <Knob
          value={params[`${prefix}Sus` as keyof MonstroParams] as number}
          min={0}
          max={100}
          onChange={(v) => onParamChange(`${prefix}Sus` as keyof MonstroParams, v)}
          size="xs"
          label="Sus"
        />
        <Knob
          value={params[`${prefix}Rel` as keyof MonstroParams] as number}
          min={1}
          max={5000}
          onChange={(v) => onParamChange(`${prefix}Rel` as keyof MonstroParams, v)}
          size="xs"
          label="Rel"
        />
        <Knob
          value={params[`${prefix}Slope` as keyof MonstroParams] as number}
          min={-1}
          max={1}
          step={0.01}
          onChange={(v) => onParamChange(`${prefix}Slope` as keyof MonstroParams, v)}
          size="xs"
          label="Pente"
          bipolar
        />
      </div>
    </div>
  );
});

EnvelopeSection.displayName = 'EnvelopeSection';

/**
 * Modulation matrix row component
 */
const MatrixRow: React.FC<{
  label: string;
  params: MonstroParams;
  onParamChange: (key: keyof MonstroParams, value: number) => void;
  env1Key: keyof MonstroParams;
  env2Key: keyof MonstroParams;
  lfo1Key: keyof MonstroParams;
  lfo2Key: keyof MonstroParams;
}> = memo(({ label, params, onParamChange, env1Key, env2Key, lfo1Key, lfo2Key }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-daw-text-muted w-16">{label}</span>
      <Knob
        value={params[env1Key] as number}
        min={-100}
        max={100}
        onChange={(v) => onParamChange(env1Key, v)}
        size="xs"
        bipolar
        showValue={false}
      />
      <Knob
        value={params[env2Key] as number}
        min={-100}
        max={100}
        onChange={(v) => onParamChange(env2Key, v)}
        size="xs"
        bipolar
        showValue={false}
      />
      <Knob
        value={params[lfo1Key] as number}
        min={-100}
        max={100}
        onChange={(v) => onParamChange(lfo1Key, v)}
        size="xs"
        bipolar
        showValue={false}
      />
      <Knob
        value={params[lfo2Key] as number}
        min={-100}
        max={100}
        onChange={(v) => onParamChange(lfo2Key, v)}
        size="xs"
        bipolar
        showValue={false}
      />
    </div>
  );
});

MatrixRow.displayName = 'MatrixRow';

/**
 * Operators view component
 */
const OperatorsView: React.FC<{
  params: MonstroParams;
  onParamChange: (key: keyof MonstroParams, value: number) => void;
}> = memo(({ params, onParamChange }) => {
  return (
    <div className="space-y-3">
      {/* Oscillators */}
      <div className="grid grid-cols-3 gap-3">
        <OscillatorSection oscNum={1} params={params} onParamChange={onParamChange} />
        <OscillatorSection oscNum={2} params={params} onParamChange={onParamChange} />
        <OscillatorSection oscNum={3} params={params} onParamChange={onParamChange} />
      </div>
      
      {/* Modulation type selector */}
      <div className="bg-daw-bg-surface rounded p-3">
        <div className="flex items-center gap-4">
          <span className="text-xs text-daw-text-muted">Modulation OSC 2/3 :</span>
          <div className="flex gap-1">
            {MOD_TYPES.map((mod) => (
              <button
                key={mod.value}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  params.o23Mod === mod.value
                    ? 'bg-purple-500 text-white'
                    : 'bg-daw-bg-primary text-daw-text-secondary hover:bg-daw-bg-elevated'
                }`}
                onClick={() => onParamChange('o23Mod', mod.value)}
              >
                {mod.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* LFOs */}
      <div className="grid grid-cols-2 gap-3">
        <LFOSection lfoNum={1} params={params} onParamChange={onParamChange} />
        <LFOSection lfoNum={2} params={params} onParamChange={onParamChange} />
      </div>
      
      {/* Envelopes */}
      <div className="grid grid-cols-2 gap-3">
        <EnvelopeSection envNum={1} params={params} onParamChange={onParamChange} />
        <EnvelopeSection envNum={2} params={params} onParamChange={onParamChange} />
      </div>
    </div>
  );
});

OperatorsView.displayName = 'OperatorsView';

/**
 * Matrix view component
 */
const MatrixView: React.FC<{
  params: MonstroParams;
  onParamChange: (key: keyof MonstroParams, value: number) => void;
}> = memo(({ params, onParamChange }) => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pl-16">
        <span className="text-xs text-red-400 w-8 text-center">E1</span>
        <span className="text-xs text-pink-400 w-8 text-center">E2</span>
        <span className="text-xs text-yellow-400 w-8 text-center">L1</span>
        <span className="text-xs text-orange-400 w-8 text-center">L2</span>
      </div>
      
      {/* Volume modulation */}
      <div className="bg-daw-bg-surface rounded p-3">
        <h4 className="text-xs font-semibold text-daw-text-primary mb-2">Volume</h4>
        <div className="space-y-1">
          <MatrixRow
            label="OSC 1"
            params={params}
            onParamChange={onParamChange}
            env1Key="vol1Env1"
            env2Key="vol1Env2"
            lfo1Key="vol1Lfo1"
            lfo2Key="vol1Lfo2"
          />
          <MatrixRow
            label="OSC 2"
            params={params}
            onParamChange={onParamChange}
            env1Key="vol2Env1"
            env2Key="vol2Env2"
            lfo1Key="vol2Lfo1"
            lfo2Key="vol2Lfo2"
          />
          <MatrixRow
            label="OSC 3"
            params={params}
            onParamChange={onParamChange}
            env1Key="vol3Env1"
            env2Key="vol3Env2"
            lfo1Key="vol3Lfo1"
            lfo2Key="vol3Lfo2"
          />
        </div>
      </div>
      
      {/* Phase modulation */}
      <div className="bg-daw-bg-surface rounded p-3">
        <h4 className="text-xs font-semibold text-daw-text-primary mb-2">Phase</h4>
        <div className="space-y-1">
          <MatrixRow
            label="OSC 1"
            params={params}
            onParamChange={onParamChange}
            env1Key="phs1Env1"
            env2Key="phs1Env2"
            lfo1Key="phs1Lfo1"
            lfo2Key="phs1Lfo2"
          />
          <MatrixRow
            label="OSC 2"
            params={params}
            onParamChange={onParamChange}
            env1Key="phs2Env1"
            env2Key="phs2Env2"
            lfo1Key="phs2Lfo1"
            lfo2Key="phs2Lfo2"
          />
          <MatrixRow
            label="OSC 3"
            params={params}
            onParamChange={onParamChange}
            env1Key="phs3Env1"
            env2Key="phs3Env2"
            lfo1Key="phs3Lfo1"
            lfo2Key="phs3Lfo2"
          />
        </div>
      </div>
      
      {/* Pitch modulation */}
      <div className="bg-daw-bg-surface rounded p-3">
        <h4 className="text-xs font-semibold text-daw-text-primary mb-2">Hauteur</h4>
        <div className="space-y-1">
          <MatrixRow
            label="OSC 1"
            params={params}
            onParamChange={onParamChange}
            env1Key="pit1Env1"
            env2Key="pit1Env2"
            lfo1Key="pit1Lfo1"
            lfo2Key="pit1Lfo2"
          />
          <MatrixRow
            label="OSC 2"
            params={params}
            onParamChange={onParamChange}
            env1Key="pit2Env1"
            env2Key="pit2Env2"
            lfo1Key="pit2Lfo1"
            lfo2Key="pit2Lfo2"
          />
          <MatrixRow
            label="OSC 3"
            params={params}
            onParamChange={onParamChange}
            env1Key="pit3Env1"
            env2Key="pit3Env2"
            lfo1Key="pit3Lfo1"
            lfo2Key="pit3Lfo2"
          />
        </div>
      </div>
      
      {/* PW modulation (OSC 1 only) */}
      <div className="bg-daw-bg-surface rounded p-3">
        <h4 className="text-xs font-semibold text-daw-text-primary mb-2">Largeur d'impulsion (OSC 1)</h4>
        <MatrixRow
          label="PW"
          params={params}
          onParamChange={onParamChange}
          env1Key="pw1Env1"
          env2Key="pw1Env2"
          lfo1Key="pw1Lfo1"
          lfo2Key="pw1Lfo2"
        />
      </div>
      
      {/* Sub modulation (OSC 3 only) */}
      <div className="bg-daw-bg-surface rounded p-3">
        <h4 className="text-xs font-semibold text-daw-text-primary mb-2">Mix Sub (OSC 3)</h4>
        <MatrixRow
          label="Sub"
          params={params}
          onParamChange={onParamChange}
          env1Key="sub3Env1"
          env2Key="sub3Env2"
          lfo1Key="sub3Lfo1"
          lfo2Key="sub3Lfo2"
        />
      </div>
    </div>
  );
});

MatrixView.displayName = 'MatrixView';

/**
 * Monstro instrument UI
 */
export const MonstroUI: React.FC<MonstroProps> = memo(({
  params,
  onParamChange,
  presets = [],
  onPresetSelect,
  currentPresetIndex = -1,
  onTrigger,
}) => {
  const [activeView, setActiveView] = useState<'operators' | 'matrix'>('operators');
  const [showPresets, setShowPresets] = useState(false);

  return (
    <div className="bg-daw-bg-secondary rounded-lg p-4 border border-daw-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <div>
            <h3 className="text-daw-text-primary font-semibold">Monstro</h3>
            <p className="text-xs text-daw-text-muted">Synthétiseur modulaire</p>
          </div>
        </div>
        
        {/* View tabs */}
        <div className="flex gap-1">
          <button
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              activeView === 'operators'
                ? 'bg-purple-500 text-white'
                : 'bg-daw-bg-surface text-daw-text-secondary hover:bg-daw-bg-elevated'
            }`}
            onClick={() => setActiveView('operators')}
          >
            Operators
          </button>
          <button
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              activeView === 'matrix'
                ? 'bg-purple-500 text-white'
                : 'bg-daw-bg-surface text-daw-text-secondary hover:bg-daw-bg-elevated'
            }`}
            onClick={() => setActiveView('matrix')}
          >
            Matrix
          </button>
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

      {/* Main content */}
      <div className="min-h-[400px]">
        {activeView === 'operators' ? (
          <OperatorsView params={params} onParamChange={onParamChange} />
        ) : (
          <MatrixView params={params} onParamChange={onParamChange} />
        )}
      </div>

      {/* Output section */}
      <div className="mt-4 pt-4 border-t border-daw-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Knob
            value={params.gain}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => onParamChange('gain', v)}
            size="md"
            label="Sortie"
            valueFormatter={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
        
        {onTrigger && (
          <Button
            variant="primary"
            size="lg"
            onClick={onTrigger}
            className="px-8 bg-purple-500 hover:bg-purple-600"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Trigger
          </Button>
        )}
      </div>
    </div>
  );
});

MonstroUI.displayName = 'MonstroUI';

export default MonstroUI;