// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * OpulenZ - OPL2/OPL3 FM Synthesizer UI
 * FM synthesis interface with operator controls
 */

import React, { useState, useCallback } from 'react';
import { Knob } from '../ui/Knob';
import { Select } from '../ui/Select';
import { Switch } from '../ui/Switch';
import type { OpulenZ as OpulenZInstrument, OplWaveform, FmAlgorithm } from '../../audio/instruments/OpulenZ';

// ============================================================================
// Types
// ============================================================================

interface OpulenZProps {
  instrument: OpulenZInstrument;
  onParameterChange?: (key: string, value: number) => void;
}

interface OperatorState {
  enabled: boolean;
  waveform: number;
  level: number;
  multiple: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  feedback: number;
}

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    backgroundColor: '#1e1e2e',
    borderRadius: '8px',
    padding: '20px',
    fontFamily: '"Segoe UI", Arial, sans-serif',
    color: '#e0e0e0',
    minWidth: '800px',
    border: '2px solid #3a3a5a',
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
    color: '#ffd700',
    margin: 0,
    fontWeight: 'bold',
  } as React.CSSProperties,
  
  subtitle: {
    fontSize: '11px',
    color: '#888',
    marginTop: '4px',
  } as React.CSSProperties,
  
  globalSection: {
    display: 'flex',
    gap: '20px',
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: '#2a2a3e',
    borderRadius: '6px',
  } as React.CSSProperties,
  
  algorithmDisplay: {
    width: '200px',
    height: '80px',
    backgroundColor: '#1a1a2a',
    borderRadius: '4px',
    padding: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  
  operatorsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '15px',
  } as React.CSSProperties,
  
  operatorPanel: {
    backgroundColor: '#2a2a3e',
    borderRadius: '6px',
    padding: '15px',
    border: '1px solid #4a4a6a',
  } as React.CSSProperties,
  
  operatorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  } as React.CSSProperties,
  
  operatorTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    margin: 0,
  } as React.CSSProperties,
  
  section: {
    marginBottom: '12px',
  } as React.CSSProperties,
  
  sectionTitle: {
    fontSize: '10px',
    color: '#888',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  } as React.CSSProperties,
  
  row: {
    display: 'flex',
    gap: '10px',
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
    fontSize: '9px',
    color: '#888',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  
  led: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#333',
  } as React.CSSProperties,
  
  ledActive: {
    backgroundColor: '#ffd700',
    boxShadow: '0 0 8px #ffd700',
  } as React.CSSProperties,
  
  waveformSelector: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '4px',
  } as React.CSSProperties,
  
  waveformButton: {
    padding: '6px 8px',
    backgroundColor: '#1a1a2a',
    border: '1px solid #4a4a6a',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '8px',
    color: '#888',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  
  waveformButtonActive: {
    backgroundColor: '#ffd700',
    borderColor: '#ffd700',
    color: '#000',
  } as React.CSSProperties,
  
  adsrContainer: {
    display: 'flex',
    gap: '8px',
    backgroundColor: '#1a1a2a',
    padding: '10px',
    borderRadius: '4px',
  } as React.CSSProperties,
};

// ============================================================================
// Algorithm Display Component
// ============================================================================

const AlgorithmDisplay: React.FC<{ algorithm: number; is4Op: boolean }> = ({ algorithm, is4Op }) => {
  const getAlgorithmSvg = () => {
    if (!is4Op) {
      // 2-operator algorithms
      switch (algorithm) {
        case 0: // Serial FM
          return (
            <svg viewBox="0 0 100 40" style={{ width: '100%', height: '100%' }}>
              <rect x="5" y="10" width="25" height="20" fill="#4a90d9" rx="3" />
              <text x="17.5" y="24" textAnchor="middle" fill="#fff" fontSize="10">M</text>
              <line x1="30" y1="20" x2="45" y2="20" stroke="#ffd700" strokeWidth="2" />
              <polygon points="43,16 50,20 43,24" fill="#ffd700" />
              <rect x="50" y="10" width="25" height="20" fill="#d94a4a" rx="3" />
              <text x="62.5" y="24" textAnchor="middle" fill="#fff" fontSize="10">C</text>
              <line x1="75" y1="20" x2="95" y2="20" stroke="#4ade80" strokeWidth="2" />
            </svg>
          );
        case 1: // Additive
          return (
            <svg viewBox="0 0 100 40" style={{ width: '100%', height: '100%' }}>
              <rect x="10" y="5" width="25" height="15" fill="#4a90d9" rx="3" />
              <text x="22.5" y="15" textAnchor="middle" fill="#fff" fontSize="8">Op1</text>
              <rect x="10" y="22" width="25" height="15" fill="#d94a4a" rx="3" />
              <text x="22.5" y="32" textAnchor="middle" fill="#fff" fontSize="8">Op2</text>
              <line x1="35" y1="12" x2="60" y2="20" stroke="#4ade80" strokeWidth="2" />
              <line x1="35" y1="30" x2="60" y2="20" stroke="#4ade80" strokeWidth="2" />
              <line x1="60" y1="20" x2="95" y2="20" stroke="#4ade80" strokeWidth="2" />
            </svg>
          );
        default:
          return null;
      }
    } else {
      // 4-operator algorithms
      switch (algorithm) {
        case 0: // Serial
          return (
            <svg viewBox="0 0 100 40" style={{ width: '100%', height: '100%' }}>
              <rect x="2" y="12" width="18" height="16" fill="#4a90d9" rx="2" />
              <text x="11" y="23" textAnchor="middle" fill="#fff" fontSize="7">1</text>
              <rect x="24" y="12" width="18" height="16" fill="#4a90d9" rx="2" />
              <text x="33" y="23" textAnchor="middle" fill="#fff" fontSize="7">2</text>
              <rect x="46" y="12" width="18" height="16" fill="#4a90d9" rx="2" />
              <text x="55" y="23" textAnchor="middle" fill="#fff" fontSize="7">3</text>
              <rect x="68" y="12" width="18" height="16" fill="#d94a4a" rx="2" />
              <text x="77" y="23" textAnchor="middle" fill="#fff" fontSize="7">4</text>
              <line x1="20" y1="20" x2="24" y2="20" stroke="#ffd700" strokeWidth="1.5" />
              <line x1="42" y1="20" x2="46" y2="20" stroke="#ffd700" strokeWidth="1.5" />
              <line x1="64" y1="20" x2="68" y2="20" stroke="#ffd700" strokeWidth="1.5" />
              <line x1="86" y1="20" x2="98" y2="20" stroke="#4ade80" strokeWidth="1.5" />
            </svg>
          );
        case 3: // Additive
          return (
            <svg viewBox="0 0 100 40" style={{ width: '100%', height: '100%' }}>
              <rect x="5" y="2" width="15" height="12" fill="#4a90d9" rx="2" />
              <rect x="5" y="16" width="15" height="12" fill="#4a90d9" rx="2" />
              <rect x="5" y="30" width="15" height="12" fill="#4a90d9" rx="2" />
              <rect x="25" y="16" width="15" height="12" fill="#d94a4a" rx="2" />
              <line x1="20" y1="8" x2="50" y2="20" stroke="#4ade80" strokeWidth="1.5" />
              <line x1="20" y1="22" x2="50" y2="20" stroke="#4ade80" strokeWidth="1.5" />
              <line x1="20" y1="36" x2="50" y2="20" stroke="#4ade80" strokeWidth="1.5" />
              <line x1="40" y1="22" x2="50" y2="20" stroke="#4ade80" strokeWidth="1.5" />
              <line x1="50" y1="20" x2="98" y2="20" stroke="#4ade80" strokeWidth="1.5" />
            </svg>
          );
        default:
          return null;
      }
    }
  };
  
  return (
    <div style={styles.algorithmDisplay}>
      {getAlgorithmSvg()}
    </div>
  );
};

// ============================================================================
// Operator Panel Component
// ============================================================================

interface OperatorPanelProps {
  opIndex: number;
  state: OperatorState;
  color: string;
  isCarrier: boolean;
  onParamChange: (param: string, value: number) => void;
}

const OperatorPanel: React.FC<OperatorPanelProps> = ({
  opIndex,
  state,
  color,
  isCarrier,
  onParamChange,
}) => {
  const waveforms = ['SIN', 'H-SIN', 'A-SIN', 'P-SIN', 'S-EVN', 'A-EVN', 'SQR', 'D-SQR'];
  const multiples = ['0.5', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '10', '12', '12', '15', '15'];
  
  return (
    <div style={{ ...styles.operatorPanel, borderColor: color }}>
      <div style={styles.operatorHeader}>
        <h3 style={{ ...styles.operatorTitle, color }}>
          OPÉRATEUR {opIndex + 1} {isCarrier ? '(Porteuse)' : '(Modulateur)'}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ ...styles.led, ...(state.enabled ? { ...styles.ledActive, backgroundColor: color, boxShadow: `0 0 8px ${color}` } : {}) }} />
          <Switch
            checked={state.enabled}
            onChange={(checked: boolean) => onParamChange('enabled', checked ? 1 : 0)}
            size="small"
            color={color}
          />
        </div>
      </div>
      
      {/* Waveform Selection */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>FORME D'ONDE</div>
        <div style={styles.waveformSelector}>
          {waveforms.map((wf, idx) => (
            <button
              key={idx}
              style={{
                ...styles.waveformButton,
                ...(state.waveform === idx ? { ...styles.waveformButtonActive, backgroundColor: color } : {}),
              }}
              onClick={() => onParamChange('waveform', idx)}
            >
              {wf}
            </button>
          ))}
        </div>
      </div>
      
      {/* Level & Multiple */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>SORTIE</div>
        <div style={styles.row}>
          <div style={styles.knobGroup}>
            <Knob
              value={state.level}
              min={0}
              max={1}
              onChange={(v: number) => onParamChange('level', v)}
              size={40}
              color={color}
            />
            <span style={styles.knobLabel}>NIVEAU</span>
          </div>
          <div style={styles.knobGroup}>
            <Knob
              value={state.multiple}
              min={0}
              max={15}
              step={1}
              onChange={(v: number) => onParamChange('multiple', v)}
              size={40}
              color={color}
            />
            <span style={styles.knobLabel}>MULT</span>
            <span style={{ ...styles.knobLabel, color }}>{multiples[Math.floor(state.multiple)]}</span>
          </div>
          <div style={styles.knobGroup}>
            <Knob
              value={state.feedback}
              min={0}
              max={7}
              step={1}
              onChange={(v: number) => onParamChange('feedback', v)}
              size={40}
              color={color}
            />
            <span style={styles.knobLabel}>FB</span>
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
              size={32}
              color="#ff6b6b"
            />
            <span style={styles.knobLabel}>A</span>
          </div>
          <div style={styles.knobGroup}>
            <Knob
              value={state.decay}
              min={0.001}
              max={2}
              onChange={(v: number) => onParamChange('decay', v)}
              size={32}
              color="#feca57"
            />
            <span style={styles.knobLabel}>D</span>
          </div>
          <div style={styles.knobGroup}>
            <Knob
              value={state.sustain}
              min={0}
              max={1}
              onChange={(v: number) => onParamChange('sustain', v)}
              size={32}
              color="#48dbfb"
            />
            <span style={styles.knobLabel}>S</span>
          </div>
          <div style={styles.knobGroup}>
            <Knob
              value={state.release}
              min={0.001}
              max={5}
              onChange={(v: number) => onParamChange('release', v)}
              size={32}
              color="#ff9ff3"
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

export const OpulenZUI: React.FC<OpulenZProps> = ({ instrument, onParameterChange }) => {
  const getOperatorState = useCallback((opIndex: number): OperatorState => {
    const prefix = `op${opIndex + 1}`;
    return {
      enabled: instrument.getParameter(`${prefix}_enabled`) > 0.5,
      waveform: instrument.getParameter(`${prefix}_waveform`),
      level: instrument.getParameter(`${prefix}_level`),
      multiple: instrument.getParameter(`${prefix}_multiple`),
      attack: instrument.getParameter(`${prefix}_attack`),
      decay: instrument.getParameter(`${prefix}_decay`),
      sustain: instrument.getParameter(`${prefix}_sustain`),
      release: instrument.getParameter(`${prefix}_release`),
      feedback: instrument.getParameter(`${prefix}_feedback`),
    };
  }, [instrument]);
  
  const [algorithm, setAlgorithm] = useState(instrument.getParameter('algorithm'));
  const [is4Op, setIs4Op] = useState(instrument.getParameter('is4Op') > 0.5);
  const [operators, setOperators] = useState<OperatorState[]>([
    getOperatorState(0),
    getOperatorState(1),
    getOperatorState(2),
    getOperatorState(3),
  ]);
  
  const handleGlobalChange = useCallback((param: string, value: number) => {
    instrument.setParameter(param, value);
    onParameterChange?.(param, value);
    
    if (param === 'algorithm') {
      setAlgorithm(value);
    } else if (param === 'is4Op') {
      setIs4Op(value > 0.5);
    }
  }, [instrument, onParameterChange]);
  
  const handleOperatorChange = useCallback((opIndex: number, param: string, value: number) => {
    const key = `op${opIndex + 1}_${param}`;
    instrument.setParameter(key, value);
    onParameterChange?.(key, value);
    
    setOperators(prev => {
      const newOps = [...prev];
      newOps[opIndex] = {
        ...newOps[opIndex],
        [param]: param === 'enabled' ? value > 0.5 : value,
      };
      return newOps;
    });
  }, [instrument, onParameterChange]);
  
  const operatorColors = ['#4a90d9', '#d94a4a', '#4ad98a', '#d9a04a'];
  const algorithmOptions = is4Op
    ? [
        { value: '0', label: 'Série (1→2→3→4)' },
        { value: '1', label: 'Mod parallèle (1+2→3→4)' },
        { value: '2', label: 'FM double (1→2, 3→4)' },
        { value: '3', label: 'Additif (1+2+3+4)' },
      ]
    : [
        { value: '0', label: 'FM (Mod→Port)' },
        { value: '1', label: 'Additif (Op1+Op2)' },
      ];
  
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>OpulenZ</h1>
          <div style={styles.subtitle}>SYNTHÉTISEUR FM OPL2/OPL3</div>
        </div>
      </div>
      
      {/* Global Controls */}
      <div style={styles.globalSection}>
        <div>
          <div style={styles.sectionTitle}>MODE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: is4Op ? '#666' : '#ffd700' }}>2-OP</span>
            <Switch
              checked={is4Op}
              onChange={(checked: boolean) => handleGlobalChange('is4Op', checked ? 1 : 0)}
              color="#ffd700"
            />
            <span style={{ fontSize: '12px', color: is4Op ? '#ffd700' : '#666' }}>4-OP</span>
          </div>
          <div style={styles.sectionTitle}>ALGORITHME</div>
          <Select
            value={algorithm.toString()}
            onChange={(v: string) => handleGlobalChange('algorithm', parseInt(v))}
            options={algorithmOptions}
            style={{ width: '180px' }}
          />
        </div>
        <div>
          <div style={styles.sectionTitle}>ROUTAGE</div>
          <AlgorithmDisplay algorithm={algorithm} is4Op={is4Op} />
        </div>
      </div>
      
      {/* Operator Panels */}
      <div style={styles.operatorsContainer}>
        {operators.slice(0, is4Op ? 4 : 2).map((op, idx) => (
          <OperatorPanel
            key={idx}
            opIndex={idx}
            state={op}
            color={operatorColors[idx]}
            isCarrier={is4Op ? idx === 3 : idx === 1}
            onParamChange={(param, value) => handleOperatorChange(idx, param, value)}
          />
        ))}
      </div>
    </div>
  );
};

export default OpulenZUI;