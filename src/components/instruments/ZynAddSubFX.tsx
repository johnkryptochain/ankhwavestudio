// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * ZynAddSubFX Component - Complex UI for the ZynAddSubFX synthesizer
 * Features multiple tabs for oscillators, filters, envelopes, and effects
 */

import React, { useState, useCallback, useEffect } from 'react';
import { 
  ZynAddSubFX as ZynAddSubFXEngine, 
  type SynthEngine, 
  type OscillatorWaveform,
  type FilterType,
  type HarmonicData
} from '../../audio/instruments/ZynAddSubFX';
import { Knob } from '../common/Knob';
import { Slider } from '../common/Slider';

// ============================================================================
// Types
// ============================================================================

interface ZynAddSubFXProps {
  instrument: ZynAddSubFXEngine;
  onParameterChange?: (key: string, value: number) => void;
}

type TabId = 'global' | 'osc1' | 'osc2' | 'osc3' | 'filter' | 'envelope' | 'lfo' | 'effects' | 'harmonics';

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Tab button component
 */
const TabButton: React.FC<{
  id: TabId;
  label: string;
  active: boolean;
  onClick: (id: TabId) => void;
}> = ({ id, label, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    style={{
      padding: '8px 16px',
      border: 'none',
      borderBottom: active ? '2px solid #4a9eff' : '2px solid transparent',
      backgroundColor: active ? '#2a2a3a' : 'transparent',
      color: active ? '#fff' : '#888',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: active ? 'bold' : 'normal',
      transition: 'all 0.2s'
    }}
  >
    {label}
  </button>
);

/**
 * Parameter knob with label
 */
const ParamKnob: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  unit?: string;
  logarithmic?: boolean;
}> = ({ label, value, min, max, onChange, unit, logarithmic }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '8px' }}>
    <Knob
      value={value}
      min={min}
      max={max}
      onChange={onChange}
      size="sm"
    />
    <span style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>{label}</span>
    <span style={{ fontSize: '9px', color: '#666' }}>
      {logarithmic ? value.toFixed(0) : value.toFixed(2)} {unit || ''}
    </span>
  </div>
);

/**
 * Toggle switch
 */
const Toggle: React.FC<{
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, value, onChange }) => (
  <div 
    style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      cursor: 'pointer'
    }}
    onClick={() => onChange(!value)}
  >
    <div style={{
      width: '36px',
      height: '20px',
      borderRadius: '10px',
      backgroundColor: value ? '#4a9eff' : '#444',
      position: 'relative',
      transition: 'background-color 0.2s'
    }}>
      <div style={{
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        backgroundColor: '#fff',
        position: 'absolute',
        top: '2px',
        left: value ? '18px' : '2px',
        transition: 'left 0.2s'
      }} />
    </div>
    <span style={{ fontSize: '12px', color: '#aaa' }}>{label}</span>
  </div>
);

/**
 * Waveform selector
 */
const WaveformSelector: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = ({ value, onChange }) => {
  const waveforms = ['Sinus', 'Carré', 'Scie', 'Triangle', 'Impulsion', 'Bruit'];
  
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {waveforms.map((wf, index) => (
        <button
          key={wf}
          onClick={() => onChange(index)}
          style={{
            padding: '6px 12px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: value === index ? '#4a9eff' : '#333',
            color: value === index ? '#fff' : '#888',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          {wf}
        </button>
      ))}
    </div>
  );
};

/**
 * Filter type selector
 */
const FilterTypeSelector: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = ({ value, onChange }) => {
  const types = ['Passe-bas', 'Passe-haut', 'Passe-bande', 'Coupe-bande'];
  
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {types.map((type, index) => (
        <button
          key={type}
          onClick={() => onChange(index)}
          style={{
            padding: '6px 12px',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: value === index ? '#9b59b6' : '#333',
            color: value === index ? '#fff' : '#888',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          {type}
        </button>
      ))}
    </div>
  );
};

/**
 * Engine selector
 */
const EngineSelector: React.FC<{
  value: number;
  onChange: (value: number) => void;
}> = ({ value, onChange }) => {
  const engines = [
    { name: 'ADD', description: 'Additive Synthesis' },
    { name: 'SUB', description: 'Subtractive Synthesis' },
    { name: 'PAD', description: 'PAD Synthesis' }
  ];
  
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {engines.map((engine, index) => (
        <button
          key={engine.name}
          onClick={() => onChange(index)}
          style={{
            padding: '12px 24px',
            border: value === index ? '2px solid #4a9eff' : '2px solid #444',
            borderRadius: '8px',
            backgroundColor: value === index ? '#2a2a3a' : '#1a1a2a',
            color: value === index ? '#fff' : '#888',
            cursor: 'pointer',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{engine.name}</div>
          <div style={{ fontSize: '10px', marginTop: '4px' }}>{engine.description}</div>
        </button>
      ))}
    </div>
  );
};

/**
 * ADSR Envelope editor
 */
const EnvelopeEditor: React.FC<{
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  onAttackChange: (value: number) => void;
  onDecayChange: (value: number) => void;
  onSustainChange: (value: number) => void;
  onReleaseChange: (value: number) => void;
  label: string;
}> = ({ attack, decay, sustain, release, onAttackChange, onDecayChange, onSustainChange, onReleaseChange, label }) => {
  // Draw envelope visualization
  const width = 200;
  const height = 80;
  const padding = 10;
  
  const totalTime = attack + decay + 0.5 + release;
  const xScale = (width - 2 * padding) / totalTime;
  
  const attackX = padding + attack * xScale;
  const decayX = attackX + decay * xScale;
  const sustainX = decayX + 0.5 * xScale;
  const releaseX = sustainX + release * xScale;
  
  const sustainY = padding + (1 - sustain) * (height - 2 * padding);
  
  const pathD = `
    M ${padding} ${height - padding}
    L ${attackX} ${padding}
    L ${decayX} ${sustainY}
    L ${sustainX} ${sustainY}
    L ${releaseX} ${height - padding}
  `;
  
  return (
    <div style={{ marginBottom: '16px' }}>
      <h4 style={{ margin: '0 0 8px 0', color: '#888', fontSize: '12px' }}>{label}</h4>
      
      {/* Envelope visualization */}
      <svg width={width} height={height} style={{ backgroundColor: '#1a1a2a', borderRadius: '4px', marginBottom: '8px' }}>
        <path d={pathD} fill="none" stroke="#4a9eff" strokeWidth="2" />
        <circle cx={attackX} cy={padding} r="4" fill="#4a9eff" />
        <circle cx={decayX} cy={sustainY} r="4" fill="#4a9eff" />
        <circle cx={sustainX} cy={sustainY} r="4" fill="#4a9eff" />
      </svg>
      
      {/* Knobs */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <ParamKnob label="Attaque" value={attack} min={0.001} max={5} onChange={onAttackChange} unit="s" />
        <ParamKnob label="Déclin" value={decay} min={0.001} max={5} onChange={onDecayChange} unit="s" />
        <ParamKnob label="Maintien" value={sustain} min={0} max={1} onChange={onSustainChange} />
        <ParamKnob label="Relâchement" value={release} min={0.001} max={10} onChange={onReleaseChange} unit="s" />
      </div>
    </div>
  );
};

/**
 * Harmonic editor for additive synthesis
 */
const HarmonicEditor: React.FC<{
  harmonics: number[];
  onChange: (index: number, value: number) => void;
}> = ({ harmonics, onChange }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '150px', padding: '8px', backgroundColor: '#1a1a2a', borderRadius: '4px' }}>
      {harmonics.slice(0, 32).map((amp, index) => (
        <div
          key={index}
          style={{
            width: '12px',
            height: `${amp * 100}%`,
            backgroundColor: index === 0 ? '#4a9eff' : '#666',
            cursor: 'ns-resize',
            borderRadius: '2px 2px 0 0'
          }}
          onMouseDown={(e) => {
            const startY = e.clientY;
            const startValue = amp;
            
            const handleMouseMove = (moveEvent: MouseEvent) => {
              const deltaY = startY - moveEvent.clientY;
              const newValue = Math.max(0, Math.min(1, startValue + deltaY / 100));
              onChange(index, newValue);
            };
            
            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        />
      ))}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ZynAddSubFXComponent: React.FC<ZynAddSubFXProps> = ({ instrument, onParameterChange }) => {
  const [activeTab, setActiveTab] = useState<TabId>('global');
  const [params, setParams] = useState<Record<string, number>>({});
  const [harmonics, setHarmonics] = useState<number[]>(Array(32).fill(0).map((_, i) => 1 / (i + 1)));
  
  // Initialize params from instrument
  useEffect(() => {
    const descriptors = instrument.getParameterDescriptors();
    const initialParams: Record<string, number> = {};
    for (const desc of descriptors) {
      initialParams[desc.key] = instrument.getParameter(desc.key);
    }
    setParams(initialParams);
  }, [instrument]);
  
  // Handle parameter change
  const handleParamChange = useCallback((key: string, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
    instrument.setParameter(key, value);
    onParameterChange?.(key, value);
  }, [instrument, onParameterChange]);
  
  // Handle harmonic change
  const handleHarmonicChange = useCallback((index: number, value: number) => {
    setHarmonics(prev => {
      const newHarmonics = [...prev];
      newHarmonics[index] = value;
      return newHarmonics;
    });
    
    // Update instrument harmonics
    const harmonicData: HarmonicData[] = harmonics.map((amp, i) => ({
      amplitude: amp,
      phase: 0,
      bandwidth: 0.02
    }));
    instrument.setHarmonics(0, harmonicData);
  }, [instrument, harmonics]);
  
  // Render oscillator tab
  const renderOscillatorTab = (oscIndex: number) => {
    const prefix = `osc${oscIndex}`;
    
    return (
      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: '16px' }}>
          <Toggle
            label={`Oscillateur ${oscIndex + 1} activé`}
            value={params[`${prefix}_enabled`] > 0.5}
            onChange={(v) => handleParamChange(`${prefix}_enabled`, v ? 1 : 0)}
          />
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#888', fontSize: '12px' }}>Forme d'onde</h4>
          <WaveformSelector
            value={params[`${prefix}_waveform`] || 0}
            onChange={(v) => handleParamChange(`${prefix}_waveform`, v)}
          />
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          <ParamKnob
            label="Volume"
            value={params[`${prefix}_volume`] || 0.8}
            min={0}
            max={1}
            onChange={(v) => handleParamChange(`${prefix}_volume`, v)}
          />
          <ParamKnob
            label="Balance"
            value={params[`${prefix}_pan`] || 0}
            min={-1}
            max={1}
            onChange={(v) => handleParamChange(`${prefix}_pan`, v)}
          />
          <ParamKnob
            label="Désaccord"
            value={params[`${prefix}_detune`] || 0}
            min={-100}
            max={100}
            onChange={(v) => handleParamChange(`${prefix}_detune`, v)}
            unit="cents"
          />
          <ParamKnob
            label="Octave"
            value={params[`${prefix}_octave`] || 0}
            min={-3}
            max={3}
            onChange={(v) => handleParamChange(`${prefix}_octave`, Math.round(v))}
          />
        </div>
      </div>
    );
  };
  
  // Render filter tab
  const renderFilterTab = () => (
    <div style={{ padding: '16px' }}>
      {[0, 1].map(filterIndex => (
        <div key={filterIndex} style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#1a1a2a', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '14px' }}>Filtre {filterIndex + 1}</h3>
            <Toggle
              label="Enabled"
              value={params[`filter${filterIndex}_enabled`] > 0.5}
              onChange={(v) => handleParamChange(`filter${filterIndex}_enabled`, v ? 1 : 0)}
            />
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <FilterTypeSelector
              value={params[`filter${filterIndex}_type`] || 0}
              onChange={(v) => handleParamChange(`filter${filterIndex}_type`, v)}
            />
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <ParamKnob
              label="Coupure"
              value={params[`filter${filterIndex}_cutoff`] || 5000}
              min={20}
              max={20000}
              onChange={(v) => handleParamChange(`filter${filterIndex}_cutoff`, v)}
              unit="Hz"
              logarithmic
            />
            <ParamKnob
              label="Résonance"
              value={params[`filter${filterIndex}_resonance`] || 0.5}
              min={0}
              max={1}
              onChange={(v) => handleParamChange(`filter${filterIndex}_resonance`, v)}
            />
            <ParamKnob
              label="Suivi clavier"
              value={params[`filter${filterIndex}_keyTracking`] || 0.5}
              min={0}
              max={1}
              onChange={(v) => handleParamChange(`filter${filterIndex}_keyTracking`, v)}
            />
            <ParamKnob
              label="Qte Env"
              value={params[`filter${filterIndex}_envAmount`] || 0.3}
              min={0}
              max={1}
              onChange={(v) => handleParamChange(`filter${filterIndex}_envAmount`, v)}
            />
          </div>
        </div>
      ))}
    </div>
  );
  
  // Render envelope tab
  const renderEnvelopeTab = () => (
    <div style={{ padding: '16px' }}>
      <EnvelopeEditor
        label="Enveloppe d'amplitude"
        attack={params['ampEnv_attack'] || 0.01}
        decay={params['ampEnv_decay'] || 0.2}
        sustain={params['ampEnv_sustain'] || 0.7}
        release={params['ampEnv_release'] || 0.3}
        onAttackChange={(v) => handleParamChange('ampEnv_attack', v)}
        onDecayChange={(v) => handleParamChange('ampEnv_decay', v)}
        onSustainChange={(v) => handleParamChange('ampEnv_sustain', v)}
        onReleaseChange={(v) => handleParamChange('ampEnv_release', v)}
      />
      
      <EnvelopeEditor
        label="Enveloppe du filtre"
        attack={params['filterEnv_attack'] || 0.05}
        decay={params['filterEnv_decay'] || 0.3}
        sustain={params['filterEnv_sustain'] || 0.4}
        release={params['filterEnv_release'] || 0.5}
        onAttackChange={(v) => handleParamChange('filterEnv_attack', v)}
        onDecayChange={(v) => handleParamChange('filterEnv_decay', v)}
        onSustainChange={(v) => handleParamChange('filterEnv_sustain', v)}
        onReleaseChange={(v) => handleParamChange('filterEnv_release', v)}
      />
    </div>
  );
  
  // Render LFO tab
  const renderLFOTab = () => (
    <div style={{ padding: '16px' }}>
      {[0, 1, 2].map(lfoIndex => (
        <div key={lfoIndex} style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#1a1a2a', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '14px' }}>LFO {lfoIndex + 1}</h3>
            <Toggle
              label="Enabled"
              value={params[`lfo${lfoIndex}_enabled`] > 0.5}
              onChange={(v) => handleParamChange(`lfo${lfoIndex}_enabled`, v ? 1 : 0)}
            />
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <ParamKnob
              label="Vitesse"
              value={params[`lfo${lfoIndex}_rate`] || 5}
              min={0.01}
              max={20}
              onChange={(v) => handleParamChange(`lfo${lfoIndex}_rate`, v)}
              unit="Hz"
            />
            <ParamKnob
              label="Profondeur"
              value={params[`lfo${lfoIndex}_depth`] || 0.1}
              min={0}
              max={1}
              onChange={(v) => handleParamChange(`lfo${lfoIndex}_depth`, v)}
            />
          </div>
        </div>
      ))}
    </div>
  );
  
  // Render harmonics tab
  const renderHarmonicsTab = () => (
    <div style={{ padding: '16px' }}>
      <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>Éditeur d'harmoniques</h3>
      <p style={{ color: '#888', fontSize: '12px', marginBottom: '16px' }}>
        Faites glisser les barres pour ajuster les amplitudes harmoniques. Cela affecte les modes de synthèse ADD et PAD.
      </p>
      <HarmonicEditor harmonics={harmonics} onChange={handleHarmonicChange} />
      
      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <button
          onClick={() => {
            // Saw wave harmonics
            const newHarmonics = Array(32).fill(0).map((_, i) => 1 / (i + 1));
            setHarmonics(newHarmonics);
          }}
          style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', backgroundColor: '#333', color: '#fff', cursor: 'pointer' }}
        >
          Saw
        </button>
        <button
          onClick={() => {
            // Square wave harmonics (odd only)
            const newHarmonics = Array(32).fill(0).map((_, i) => i % 2 === 0 ? 1 / (i + 1) : 0);
            setHarmonics(newHarmonics);
          }}
          style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', backgroundColor: '#333', color: '#fff', cursor: 'pointer' }}
        >
          Square
        </button>
        <button
          onClick={() => {
            // Sine (fundamental only)
            const newHarmonics = Array(32).fill(0);
            newHarmonics[0] = 1;
            setHarmonics(newHarmonics);
          }}
          style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', backgroundColor: '#333', color: '#fff', cursor: 'pointer' }}
        >
          Sine
        </button>
        <button
          onClick={() => {
            // Random harmonics
            const newHarmonics = Array(32).fill(0).map(() => Math.random());
            setHarmonics(newHarmonics);
          }}
          style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', backgroundColor: '#333', color: '#fff', cursor: 'pointer' }}
        >
          Random
        </button>
      </div>
    </div>
  );
  
  // Render global tab
  const renderGlobalTab = () => (
    <div style={{ padding: '16px' }}>
      <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>Moteur de synthèse</h3>
      <EngineSelector
        value={params['engine'] || 0}
        onChange={(v) => handleParamChange('engine', v)}
      />
      
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>Principal</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          <ParamKnob
            label="Coupure principale"
            value={params['masterCutoff'] || 20000}
            min={20}
            max={20000}
            onChange={(v) => handleParamChange('masterCutoff', v)}
            unit="Hz"
            logarithmic
          />
          <ParamKnob
            label="Résonance principale"
            value={params['masterResonance'] || 0}
            min={0}
            max={1}
            onChange={(v) => handleParamChange('masterResonance', v)}
          />
        </div>
      </div>
    </div>
  );
  
  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'global':
        return renderGlobalTab();
      case 'osc1':
        return renderOscillatorTab(0);
      case 'osc2':
        return renderOscillatorTab(1);
      case 'osc3':
        return renderOscillatorTab(2);
      case 'filter':
        return renderFilterTab();
      case 'envelope':
        return renderEnvelopeTab();
      case 'lfo':
        return renderLFOTab();
      case 'harmonics':
        return renderHarmonicsTab();
      default:
        return null;
    }
  };
  
  return (
    <div
      className="zynaddsubfx"
      style={{
        width: '600px',
        backgroundColor: '#0a0a1a',
        borderRadius: '8px',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '16px',
        backgroundColor: '#1a1a2a',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>ZynAddSubFX</h2>
          <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '11px' }}>
            Synthétiseur avancé • {['ADD', 'SUB', 'PAD'][params['engine'] || 0]} Mode
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => instrument.reset()}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#333',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            Reset
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div style={{
        display: 'flex',
        backgroundColor: '#1a1a2a',
        borderBottom: '1px solid #333',
        overflowX: 'auto'
      }}>
        <TabButton id="global" label="Global" active={activeTab === 'global'} onClick={setActiveTab} />
        <TabButton id="osc1" label="OSC 1" active={activeTab === 'osc1'} onClick={setActiveTab} />
        <TabButton id="osc2" label="OSC 2" active={activeTab === 'osc2'} onClick={setActiveTab} />
        <TabButton id="osc3" label="OSC 3" active={activeTab === 'osc3'} onClick={setActiveTab} />
        <TabButton id="filter" label="Filtre" active={activeTab === 'filter'} onClick={setActiveTab} />
        <TabButton id="envelope" label="Enveloppe" active={activeTab === 'envelope'} onClick={setActiveTab} />
        <TabButton id="lfo" label="LFO" active={activeTab === 'lfo'} onClick={setActiveTab} />
        <TabButton id="harmonics" label="Harmoniques" active={activeTab === 'harmonics'} onClick={setActiveTab} />
      </div>
      
      {/* Tab content */}
      <div style={{ minHeight: '300px' }}>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default ZynAddSubFXComponent;