// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Nes - NES APU Emulator UI
 * Retro NES-style interface for the NES instrument
 */

import React, { useState, useCallback } from 'react';
import { Knob } from '../ui/Knob';
import { Select } from '../ui/Select';
import { Switch } from '../ui/Switch';
import type { Nes as NesInstrument, NesChannel, NesDutyCycle } from '../../audio/instruments/Nes';

// ============================================================================
// Types
// ============================================================================

interface NesProps {
  instrument: NesInstrument;
  onParameterChange?: (key: string, value: number) => void;
}

interface ChannelState {
  enabled: boolean;
  volume: number;
  dutyCycle?: number;
  noiseMode?: number;
  noisePeriod?: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  octave: number;
  detune: number;
}

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    padding: '20px',
    fontFamily: '"Press Start 2P", "Courier New", monospace',
    color: '#e0e0e0',
    minWidth: '700px',
    border: '4px solid #c0c0c0',
    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
  } as React.CSSProperties,
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    borderBottom: '3px solid #c41e3a',
    paddingBottom: '10px',
  } as React.CSSProperties,
  
  title: {
    fontSize: '20px',
    color: '#c41e3a',
    textShadow: '2px 2px 0 #000',
    margin: 0,
  } as React.CSSProperties,
  
  subtitle: {
    fontSize: '8px',
    color: '#888',
    marginTop: '5px',
  } as React.CSSProperties,
  
  logo: {
    fontSize: '14px',
    color: '#c41e3a',
    fontWeight: 'bold',
    textShadow: '2px 2px 0 #000',
  } as React.CSSProperties,
  
  channelsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '15px',
  } as React.CSSProperties,
  
  channelPanel: {
    backgroundColor: '#1a1a1a',
    borderRadius: '6px',
    padding: '15px',
    border: '2px solid #444',
  } as React.CSSProperties,
  
  channelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  } as React.CSSProperties,
  
  channelTitle: {
    fontSize: '10px',
    margin: 0,
  } as React.CSSProperties,
  
  section: {
    marginBottom: '12px',
  } as React.CSSProperties,
  
  sectionTitle: {
    fontSize: '7px',
    color: '#666',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  } as React.CSSProperties,
  
  row: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  
  knobGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '4px',
  } as React.CSSProperties,
  
  knobLabel: {
    fontSize: '7px',
    color: '#888',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  
  led: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#333',
    boxShadow: 'inset 0 0 2px rgba(0,0,0,0.5)',
  } as React.CSSProperties,
  
  ledActive: {
    backgroundColor: '#c41e3a',
    boxShadow: '0 0 8px #c41e3a, inset 0 0 2px rgba(255,255,255,0.5)',
  } as React.CSSProperties,
  
  dutySelector: {
    display: 'flex',
    gap: '4px',
  } as React.CSSProperties,
  
  dutyButton: {
    width: '40px',
    height: '24px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #444',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '8px',
    color: '#888',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  
  dutyButtonActive: {
    backgroundColor: '#c41e3a',
    borderColor: '#c41e3a',
    color: '#fff',
  } as React.CSSProperties,
  
  adsrContainer: {
    display: 'flex',
    gap: '6px',
    backgroundColor: '#0f0f0f',
    padding: '8px',
    borderRadius: '4px',
  } as React.CSSProperties,
  
  waveformDisplay: {
    width: '100%',
    height: '30px',
    backgroundColor: '#0a0a0a',
    borderRadius: '3px',
    marginBottom: '8px',
    overflow: 'hidden',
  } as React.CSSProperties,
};

// ============================================================================
// Waveform Display Component
// ============================================================================

const WaveformDisplay: React.FC<{ type: 'pulse' | 'triangle' | 'noise'; dutyCycle?: number }> = ({ type, dutyCycle = 2 }) => {
  const getPath = (): string => {
    if (type === 'triangle') {
      return 'M0,15 L25,0 L50,15 L75,0 L100,15';
    }
    if (type === 'noise') {
      return 'M0,8 L5,3 L10,12 L15,5 L20,10 L25,2 L30,14 L35,6 L40,11 L45,4 L50,9 L55,1 L60,13 L65,7 L70,10 L75,3 L80,12 L85,5 L90,9 L95,2 L100,8';
    }
    // Pulse with duty cycle
    const dutyWidths = [12.5, 25, 50, 75];
    const width = dutyWidths[dutyCycle] || 50;
    return `M0,15 L0,0 L${width},0 L${width},15 L100,15`;
  };
  
  return (
    <div style={styles.waveformDisplay}>
      <svg viewBox="0 0 100 15" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        <path
          d={getPath()}
          fill="none"
          stroke="#c41e3a"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
};

// ============================================================================
// Channel Panel Component
// ============================================================================

interface ChannelPanelProps {
  channel: NesChannel;
  title: string;
  color: string;
  state: ChannelState;
  onParamChange: (param: string, value: number) => void;
  showDutyCycle?: boolean;
  showNoiseControls?: boolean;
}

const ChannelPanel: React.FC<ChannelPanelProps> = ({
  channel,
  title,
  color,
  state,
  onParamChange,
  showDutyCycle = false,
  showNoiseControls = false,
}) => {
  const dutyLabels = ['12.5%', '25%', '50%', '75%'];
  
  return (
    <div style={styles.channelPanel}>
      <div style={styles.channelHeader}>
        <h3 style={{ ...styles.channelTitle, color }}>{title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ ...styles.led, ...(state.enabled ? styles.ledActive : {}) }} />
          <Switch
            checked={state.enabled}
            onChange={(checked: boolean) => onParamChange('enabled', checked ? 1 : 0)}
            size="small"
            color={color}
          />
        </div>
      </div>
      
      {/* Waveform Display */}
      <WaveformDisplay 
        type={showNoiseControls ? 'noise' : showDutyCycle ? 'pulse' : 'triangle'} 
        dutyCycle={state.dutyCycle}
      />
      
      {/* Duty Cycle (Pulse channels only) */}
      {showDutyCycle && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>RAPPORT CYCLIQUE</div>
          <div style={styles.dutySelector}>
            {dutyLabels.map((label, idx) => (
              <button
                key={idx}
                style={{
                  ...styles.dutyButton,
                  ...(state.dutyCycle === idx ? styles.dutyButtonActive : {}),
                }}
                onClick={() => onParamChange('dutyCycle', idx)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Noise Controls */}
      {showNoiseControls && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>MODE BRUIT</div>
          <div style={styles.row}>
            <Select
              value={(state.noiseMode ?? 0).toString()}
              onChange={(v: string) => onParamChange('noiseMode', parseInt(v))}
              options={[
                { value: '0', label: 'LONG' },
                { value: '1', label: 'COURT' },
              ]}
              style={{ width: '80px' }}
            />
            <div style={styles.knobGroup}>
              <Knob
                value={state.noisePeriod ?? 8}
                min={0}
                max={15}
                step={1}
                onChange={(v: number) => onParamChange('noisePeriod', v)}
                size={30}
                color={color}
              />
              <span style={styles.knobLabel}>PÉRIODE</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Volume & Pitch */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>VOLUME & HAUTEUR</div>
        <div style={styles.row}>
          <div style={styles.knobGroup}>
            <Knob
              value={state.volume}
              min={0}
              max={1}
              onChange={(v: number) => onParamChange('volume', v)}
              size={35}
              color={color}
            />
            <span style={styles.knobLabel}>VOL</span>
          </div>
          <div style={styles.knobGroup}>
            <Knob
              value={state.octave}
              min={-3}
              max={3}
              step={1}
              onChange={(v: number) => onParamChange('octave', v)}
              size={35}
              color={color}
            />
            <span style={styles.knobLabel}>OCT</span>
          </div>
          <div style={styles.knobGroup}>
            <Knob
              value={state.detune}
              min={-100}
              max={100}
              onChange={(v: number) => onParamChange('detune', v)}
              size={35}
              color={color}
            />
            <span style={styles.knobLabel}>DET</span>
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
              onChange={(v: number) => onParamChange('attack', v)}
              size={28}
              color="#ff6666"
            />
            <span style={styles.knobLabel}>A</span>
          </div>
          <div style={styles.knobGroup}>
            <Knob
              value={state.decay}
              min={0}
              max={2}
              onChange={(v: number) => onParamChange('decay', v)}
              size={28}
              color="#ff6666"
            />
            <span style={styles.knobLabel}>D</span>
          </div>
          <div style={styles.knobGroup}>
            <Knob
              value={state.sustain}
              min={0}
              max={1}
              onChange={(v: number) => onParamChange('sustain', v)}
              size={28}
              color="#ff6666"
            />
            <span style={styles.knobLabel}>S</span>
          </div>
          <div style={styles.knobGroup}>
            <Knob
              value={state.release}
              min={0.001}
              max={5}
              onChange={(v: number) => onParamChange('release', v)}
              size={28}
              color="#ff6666"
            />
            <span style={styles.knobLabel}>R</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const NesUI: React.FC<NesProps> = ({ instrument, onParameterChange }) => {
  const getChannelState = useCallback((channel: NesChannel): ChannelState => {
    return {
      enabled: instrument.getParameter(`${channel}_enabled`) > 0.5,
      volume: instrument.getParameter(`${channel}_volume`),
      dutyCycle: instrument.getParameter(`${channel}_dutyCycle`),
      noiseMode: instrument.getParameter(`${channel}_noiseMode`),
      noisePeriod: instrument.getParameter(`${channel}_noisePeriod`),
      attack: instrument.getParameter(`${channel}_attack`),
      decay: instrument.getParameter(`${channel}_decay`),
      sustain: instrument.getParameter(`${channel}_sustain`),
      release: instrument.getParameter(`${channel}_release`),
      octave: instrument.getParameter(`${channel}_octave`),
      detune: instrument.getParameter(`${channel}_detune`),
    };
  }, [instrument]);
  
  const [channels, setChannels] = useState<Record<NesChannel, ChannelState>>({
    pulse1: getChannelState('pulse1'),
    pulse2: getChannelState('pulse2'),
    triangle: getChannelState('triangle'),
    noise: getChannelState('noise'),
  });
  
  const handleChannelParamChange = useCallback((channel: NesChannel, param: string, value: number) => {
    const key = `${channel}_${param}`;
    instrument.setParameter(key, value);
    onParameterChange?.(key, value);
    
    setChannels(prev => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [param]: param === 'enabled' ? value > 0.5 : value,
      },
    }));
  }, [instrument, onParameterChange]);
  
  const channelColors: Record<NesChannel, string> = {
    pulse1: '#c41e3a',
    pulse2: '#ff6b6b',
    triangle: '#4ecdc4',
    noise: '#ffe66d',
  };
  
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>NES APU</h1>
          <div style={styles.subtitle}>AUDIO NINTENDO ENTERTAINMENT SYSTEM</div>
        </div>
        <div style={styles.logo}>
          NINTENDO®
        </div>
      </div>
      
      {/* Channel Panels */}
      <div style={styles.channelsContainer}>
        <ChannelPanel
          channel="pulse1"
          title="IMPULSION 1"
          color={channelColors.pulse1}
          state={channels.pulse1}
          onParamChange={(param, value) => handleChannelParamChange('pulse1', param, value)}
          showDutyCycle
        />
        <ChannelPanel
          channel="pulse2"
          title="IMPULSION 2"
          color={channelColors.pulse2}
          state={channels.pulse2}
          onParamChange={(param, value) => handleChannelParamChange('pulse2', param, value)}
          showDutyCycle
        />
        <ChannelPanel
          channel="triangle"
          title="TRIANGLE"
          color={channelColors.triangle}
          state={channels.triangle}
          onParamChange={(param, value) => handleChannelParamChange('triangle', param, value)}
        />
        <ChannelPanel
          channel="noise"
          title="BRUIT"
          color={channelColors.noise}
          state={channels.noise}
          onParamChange={(param, value) => handleChannelParamChange('noise', param, value)}
          showNoiseControls
        />
      </div>
    </div>
  );
};

export default NesUI;