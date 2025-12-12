// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Sid - C64 Sound Chip (SID 6581/8580) Emulator UI
 * Retro C64-style interface for the SID instrument
 */

import React, { useState, useCallback } from 'react';
import { Knob } from '../ui/Knob';
import { Select } from '../ui/Select';
import { Switch } from '../ui/Switch';
import type { Sid as SidInstrument, SidWaveform, SidFilterType } from '../../audio/instruments/Sid';

// ============================================================================
// Types
// ============================================================================

interface SidProps {
  instrument: SidInstrument;
  onParameterChange?: (key: string, value: number) => void;
}

interface VoiceState {
  enabled: boolean;
  waveform: number;
  pulseWidth: number;
  octave: number;
  detune: number;
  ringMod: boolean;
  sync: boolean;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: '8px',
    padding: '20px',
    fontFamily: '"Press Start 2P", "Courier New", monospace',
    color: '#00ff00',
    minWidth: '800px',
    border: '3px solid #4a4a6a',
    boxShadow: '0 0 20px rgba(0, 255, 0, 0.2)',
  } as React.CSSProperties,
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    borderBottom: '2px solid #4a4a6a',
    paddingBottom: '10px',
  } as React.CSSProperties,
  
  title: {
    fontSize: '24px',
    color: '#00ff00',
    textShadow: '0 0 10px #00ff00',
    margin: 0,
  } as React.CSSProperties,
  
  subtitle: {
    fontSize: '10px',
    color: '#888',
    marginTop: '5px',
  } as React.CSSProperties,
  
  logo: {
    fontSize: '12px',
    color: '#ff6600',
    textShadow: '0 0 5px #ff6600',
  } as React.CSSProperties,
  
  voicesContainer: {
    display: 'flex',
    gap: '15px',
    marginBottom: '20px',
  } as React.CSSProperties,
  
  voicePanel: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    borderRadius: '6px',
    padding: '15px',
    border: '2px solid #3a3a5a',
  } as React.CSSProperties,
  
  voiceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
  } as React.CSSProperties,
  
  voiceTitle: {
    fontSize: '12px',
    color: '#00ccff',
    margin: 0,
  } as React.CSSProperties,
  
  section: {
    marginBottom: '15px',
  } as React.CSSProperties,
  
  sectionTitle: {
    fontSize: '8px',
    color: '#666',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  } as React.CSSProperties,
  
  row: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    marginBottom: '10px',
  } as React.CSSProperties,
  
  knobGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '5px',
  } as React.CSSProperties,
  
  knobLabel: {
    fontSize: '8px',
    color: '#888',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  
  filterPanel: {
    backgroundColor: '#0a0a1a',
    borderRadius: '6px',
    padding: '15px',
    border: '2px solid #ff6600',
  } as React.CSSProperties,
  
  filterTitle: {
    fontSize: '12px',
    color: '#ff6600',
    marginBottom: '15px',
    textShadow: '0 0 5px #ff6600',
  } as React.CSSProperties,
  
  filterControls: {
    display: 'flex',
    gap: '20px',
    alignItems: 'flex-start',
  } as React.CSSProperties,
  
  waveformSelector: {
    display: 'flex',
    gap: '5px',
  } as React.CSSProperties,
  
  waveformButton: {
    width: '40px',
    height: '30px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #4a4a6a',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  
  waveformButtonActive: {
    backgroundColor: '#00ff00',
    borderColor: '#00ff00',
  } as React.CSSProperties,
  
  waveformIcon: {
    width: '24px',
    height: '16px',
  } as React.CSSProperties,
  
  adsrContainer: {
    display: 'flex',
    gap: '8px',
    backgroundColor: '#0f0f1f',
    padding: '10px',
    borderRadius: '4px',
  } as React.CSSProperties,
  
  led: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#333',
    boxShadow: 'inset 0 0 2px rgba(0,0,0,0.5)',
  } as React.CSSProperties,
  
  ledActive: {
    backgroundColor: '#00ff00',
    boxShadow: '0 0 10px #00ff00, inset 0 0 2px rgba(255,255,255,0.5)',
  } as React.CSSProperties,
  
  modSwitch: {
    display: 'flex',
    gap: '15px',
    marginTop: '10px',
  } as React.CSSProperties,
  
  switchLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '8px',
    color: '#888',
  } as React.CSSProperties,
};

// ============================================================================
// Waveform Icons
// ============================================================================

const WaveformIcon: React.FC<{ type: SidWaveform; active: boolean }> = ({ type, active }) => {
  const color = active ? '#000' : '#00ff00';
  
  const paths: Record<SidWaveform, string> = {
    triangle: 'M2,14 L12,2 L22,14',
    saw: 'M2,14 L22,2 L22,14 L2,14',
    pulse: 'M2,14 L2,2 L12,2 L12,14 L22,14',
    noise: 'M2,8 L5,4 L8,12 L11,6 L14,10 L17,3 L20,11 L22,7',
    combined: 'M2,14 L7,2 L12,14 L17,2 L22,14',
  };
  
  return (
    <svg viewBox="0 0 24 16" style={styles.waveformIcon}>
      <path
        d={paths[type]}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ============================================================================
// Voice Panel Component
// ============================================================================

interface VoicePanelProps {
  voiceIndex: number;
  state: VoiceState;
  onParamChange: (param: string, value: number) => void;
}

const VoicePanel: React.FC<VoicePanelProps> = ({ voiceIndex, state, onParamChange }) => {
  const waveforms: SidWaveform[] = ['triangle', 'saw', 'pulse', 'noise'];
  
  return (
    <div style={styles.voicePanel}>
      <div style={styles.voiceHeader}>
        <h3 style={styles.voiceTitle}>VOIX {voiceIndex + 1}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ ...styles.led, ...(state.enabled ? styles.ledActive : {}) }} />
          <Switch
            checked={state.enabled}
            onChange={(checked) => onParamChange('enabled', checked ? 1 : 0)}
            size="small"
          />
        </div>
      </div>
      
      {/* Waveform Selection */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>FORME D'ONDE</div>
        <div style={styles.waveformSelector}>
          {waveforms.map((wf, idx) => (
            <button
              key={wf}
              style={{
                ...styles.waveformButton,
                ...(state.waveform === idx ? styles.waveformButtonActive : {}),
              }}
              onClick={() => onParamChange('waveform', idx)}
              title={wf.toUpperCase()}
            >
              <WaveformIcon type={wf} active={state.waveform === idx} />
            </button>
          ))}
        </div>
      </div>
      
      {/* Oscillator Controls */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>OSCILLATEUR</div>
        <div style={styles.row}>
          <div style={styles.knobGroup}>
            <Knob
              value={state.pulseWidth}
              min={0.1}
              max={0.9}
              onChange={(v) => onParamChange('pulseWidth', v)}
              size={40}
              color="#00ff00"
            />
            <span style={styles.knobLabel}>PW</span>
          </div>
          <div style={styles.knobGroup}>
            <Knob
              value={state.octave}
              min={-3}
              max={3}
              step={1}
              onChange={(v) => onParamChange('octave', v)}
              size={40}
              color="#00ccff"
            />
            <span style={styles.knobLabel}>OCT</span>
          </div>
          <div style={styles.knobGroup}>
            <Knob
              value={state.detune}
              min={-100}
              max={100}
              onChange={(v) => onParamChange('detune', v)}
              size={40}
              color="#ff6600"
            />
            <span style={styles.knobLabel}>DÉS</span>
          </div>
        </div>
      </div>
      
      {/* ADSR Envelope */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>ENVELOPPE</div>
        <div style={styles.adsrContainer}>
          <div style={styles.knobGroup}>
            <Knob
              value={state.attack}
              min={0.001}
              max={2}
              onChange={(v) => onParamChange('attack', v)}
              size={35}
              color="#ff0066"
            />
            <span style={styles.knobLabel}>A</span>
          </div>
          <div style={styles.knobGroup}>
            <Knob
              value={state.decay}
              min={0.001}
              max={2}
              onChange={(v) => onParamChange('decay', v)}
              size={35}
              color="#ff0066"
            />
            <span style={styles.knobLabel}>D</span>
          </div>
          <div style={styles.knobGroup}>
            <Knob
              value={state.sustain}
              min={0}
              max={1}
              onChange={(v) => onParamChange('sustain', v)}
              size={35}
              color="#ff0066"
            />
            <span style={styles.knobLabel}>S</span>
          </div>
          <div style={styles.knobGroup}>
            <Knob
              value={state.release}
              min={0.001}
              max={5}
              onChange={(v) => onParamChange('release', v)}
              size={35}
              color="#ff0066"
            />
            <span style={styles.knobLabel}>R</span>
          </div>
        </div>
      </div>
      
      {/* Modulation Switches */}
      <div style={styles.modSwitch}>
        <label style={styles.switchLabel}>
          <Switch
            checked={state.ringMod}
            onChange={(checked) => onParamChange('ringMod', checked ? 1 : 0)}
            size="small"
          />
          RING
        </label>
        <label style={styles.switchLabel}>
          <Switch
            checked={state.sync}
            onChange={(checked) => onParamChange('sync', checked ? 1 : 0)}
            size="small"
          />
          SYNC
        </label>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const SidUI: React.FC<SidProps> = ({ instrument, onParameterChange }) => {
  // Get initial state from instrument
  const getVoiceState = useCallback((voiceIndex: number): VoiceState => {
    return {
      enabled: instrument.getParameter(`voice${voiceIndex}_enabled`) > 0.5,
      waveform: instrument.getParameter(`voice${voiceIndex}_waveform`),
      pulseWidth: instrument.getParameter(`voice${voiceIndex}_pulseWidth`),
      octave: instrument.getParameter(`voice${voiceIndex}_octave`),
      detune: instrument.getParameter(`voice${voiceIndex}_detune`),
      ringMod: instrument.getParameter(`voice${voiceIndex}_ringMod`) > 0.5,
      sync: instrument.getParameter(`voice${voiceIndex}_sync`) > 0.5,
      attack: instrument.getParameter(`voice${voiceIndex}_attack`),
      decay: instrument.getParameter(`voice${voiceIndex}_decay`),
      sustain: instrument.getParameter(`voice${voiceIndex}_sustain`),
      release: instrument.getParameter(`voice${voiceIndex}_release`),
    };
  }, [instrument]);
  
  const [voices, setVoices] = useState<VoiceState[]>([
    getVoiceState(0),
    getVoiceState(1),
    getVoiceState(2),
  ]);
  
  const [filterEnabled, setFilterEnabled] = useState(
    instrument.getParameter('filterEnabled') > 0.5
  );
  const [filterType, setFilterType] = useState(
    instrument.getParameter('filterType')
  );
  const [filterCutoff, setFilterCutoff] = useState(
    instrument.getParameter('filterCutoff')
  );
  const [filterResonance, setFilterResonance] = useState(
    instrument.getParameter('filterResonance')
  );
  
  const handleVoiceParamChange = useCallback((voiceIndex: number, param: string, value: number) => {
    const key = `voice${voiceIndex}_${param}`;
    instrument.setParameter(key, value);
    onParameterChange?.(key, value);
    
    setVoices(prev => {
      const newVoices = [...prev];
      newVoices[voiceIndex] = {
        ...newVoices[voiceIndex],
        [param]: param === 'enabled' || param === 'ringMod' || param === 'sync' 
          ? value > 0.5 
          : value,
      };
      return newVoices;
    });
  }, [instrument, onParameterChange]);
  
  const handleFilterChange = useCallback((param: string, value: number) => {
    instrument.setParameter(param, value);
    onParameterChange?.(param, value);
    
    switch (param) {
      case 'filterEnabled':
        setFilterEnabled(value > 0.5);
        break;
      case 'filterType':
        setFilterType(value);
        break;
      case 'filterCutoff':
        setFilterCutoff(value);
        break;
      case 'filterResonance':
        setFilterResonance(value);
        break;
    }
  }, [instrument, onParameterChange]);
  
  const filterTypes: SidFilterType[] = ['lowpass', 'bandpass', 'highpass', 'notch'];
  
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>SID 6581</h1>
          <div style={styles.subtitle}>DISPOSITIF D'INTERFACE SONORE COMMODORE 64</div>
        </div>
        <div style={styles.logo}>
          C=64
        </div>
      </div>
      
      {/* Voice Panels */}
      <div style={styles.voicesContainer}>
        {voices.map((voice, idx) => (
          <VoicePanel
            key={idx}
            voiceIndex={idx}
            state={voice}
            onParamChange={(param, value) => handleVoiceParamChange(idx, param, value)}
          />
        ))}
      </div>
      
      {/* Filter Section */}
      <div style={styles.filterPanel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={styles.filterTitle}>FILTRE</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ ...styles.led, ...(filterEnabled ? styles.ledActive : {}) }} />
            <Switch
              checked={filterEnabled}
              onChange={(checked) => handleFilterChange('filterEnabled', checked ? 1 : 0)}
              size="small"
            />
          </div>
        </div>
        
        <div style={styles.filterControls}>
          {/* Filter Type */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>TYPE</div>
            <Select
              value={filterType.toString()}
              onChange={(v) => handleFilterChange('filterType', parseInt(v))}
              options={filterTypes.map((type, idx) => ({
                value: idx.toString(),
                label: type.toUpperCase(),
              }))}
              style={{ width: '120px' }}
            />
          </div>
          
          {/* Cutoff */}
          <div style={styles.knobGroup}>
            <Knob
              value={filterCutoff}
              min={20}
              max={20000}
              onChange={(v) => handleFilterChange('filterCutoff', v)}
              size={60}
              color="#ff6600"
              logarithmic
            />
            <span style={styles.knobLabel}>COUPURE</span>
            <span style={{ ...styles.knobLabel, color: '#ff6600' }}>
              {filterCutoff < 1000 
                ? `${Math.round(filterCutoff)} Hz`
                : `${(filterCutoff / 1000).toFixed(1)} kHz`
              }
            </span>
          </div>
          
          {/* Resonance */}
          <div style={styles.knobGroup}>
            <Knob
              value={filterResonance}
              min={0}
              max={1}
              onChange={(v) => handleFilterChange('filterResonance', v)}
              size={60}
              color="#ff6600"
            />
            <span style={styles.knobLabel}>RÉSONANCE</span>
            <span style={{ ...styles.knobLabel, color: '#ff6600' }}>
              {Math.round(filterResonance * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidUI;