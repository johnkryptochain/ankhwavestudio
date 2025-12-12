// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * SamplePlayer - Sample-based instrument UI
 * Features: Waveform display, sample selection, start/end points,
 * loop controls, pitch/tune controls, ADSR envelope, filter section
 */

import React, { useState, useCallback, useRef, memo } from 'react';
import { Knob, Slider, Button, Waveform } from '../common';

type LoopMode = 'off' | 'forward' | 'pingpong' | 'reverse';
type FilterType = 'lowpass' | 'highpass' | 'bandpass';

interface SampleData {
  id: string;
  name: string;
  url?: string;
  duration: number;
  sampleRate: number;
  channels: number;
  waveformData?: number[];
}

interface EnvelopeState {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

interface SamplePlayerState {
  sample: SampleData | null;
  startPoint: number;
  endPoint: number;
  loopStart: number;
  loopEnd: number;
  loopMode: LoopMode;
  rootNote: number;
  tune: number;
  fineTune: number;
  volume: number;
  pan: number;
  reversed: boolean;
  envelope: EnvelopeState;
  filterEnabled: boolean;
  filterType: FilterType;
  filterCutoff: number;
  filterResonance: number;
}

interface SamplePlayerProps {
  state?: Partial<SamplePlayerState>;
  onStateChange?: (state: SamplePlayerState) => void;
  onSampleLoad?: (file: File) => void;
  onSampleSelect?: () => void;
  className?: string;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const defaultState: SamplePlayerState = {
  sample: null,
  startPoint: 0,
  endPoint: 1,
  loopStart: 0,
  loopEnd: 1,
  loopMode: 'off',
  rootNote: 60, // Middle C
  tune: 0,
  fineTune: 0,
  volume: 0.8,
  pan: 0,
  reversed: false,
  envelope: {
    attack: 0.01,
    decay: 0.1,
    sustain: 1,
    release: 0.1,
  },
  filterEnabled: false,
  filterType: 'lowpass',
  filterCutoff: 1,
  filterResonance: 0,
};

export const SamplePlayer: React.FC<SamplePlayerProps> = memo(({
  state: externalState,
  onStateChange,
  onSampleLoad,
  onSampleSelect,
  className = '',
}) => {
  const [state, setState] = useState<SamplePlayerState>({
    ...defaultState,
    ...externalState,
  });
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update state and notify parent
  const updateState = useCallback((updates: Partial<SamplePlayerState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      onStateChange?.(newState);
      return newState;
    });
  }, [onStateChange]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      onSampleLoad?.(file);
    }
  }, [onSampleLoad]);

  // Handle file select
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSampleLoad?.(file);
    }
  }, [onSampleLoad]);

  // Get note name from MIDI number
  const getNoteNameFromMidi = (midi: number): string => {
    const octave = Math.floor(midi / 12) - 1;
    const note = NOTE_NAMES[midi % 12];
    return `${note}${octave}`;
  };

  // Render waveform section
  const renderWaveformSection = () => (
    <div
      className={`relative h-32 bg-daw-bg-primary rounded-lg overflow-hidden border-2 transition-colors ${
        isDraggingOver ? 'border-daw-accent-primary border-dashed' : 'border-transparent'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
    >
      {state.sample ? (
        <>
          {/* Waveform display */}
          <Waveform
            audioData={state.sample.waveformData ? new Float32Array(state.sample.waveformData) : undefined}
            duration={state.sample.duration}
            height={128}
            color="#3b82f6"
            backgroundColor="transparent"
            selectionStart={state.startPoint}
            selectionEnd={state.endPoint}
            onSelectionChange={(start, end) => updateState({ startPoint: start, endPoint: end })}
          />
          
          {/* Loop region overlay */}
          {state.loopMode !== 'off' && (
            <div
              className="absolute top-0 bottom-0 bg-green-500/20 border-l-2 border-r-2 border-green-500"
              style={{
                left: `${state.loopStart * 100}%`,
                width: `${(state.loopEnd - state.loopStart) * 100}%`,
              }}
            />
          )}
          
          {/* Sample info */}
          <div className="absolute bottom-1 left-1 right-1 flex justify-between text-xxs text-daw-text-muted bg-daw-bg-primary/80 px-1 rounded">
            <span>{state.sample.name}</span>
            <span>{state.sample.duration.toFixed(2)}s | {state.sample.sampleRate}Hz | {state.sample.channels}ch</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-daw-text-muted">
          <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p className="text-sm">Déposez un échantillon ici</p>
          <p className="text-xs mt-1">ou cliquez pour parcourir</p>
        </div>
      )}
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      
      {/* Click overlay */}
      {!state.sample && (
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        />
      )}
    </div>
  );

  // Render sample controls
  const renderSampleControls = () => (
    <div className="grid grid-cols-2 gap-4">
      {/* Start/End points */}
      <div className="space-y-2">
        <div className="text-xs text-daw-text-muted">Région d'échantillon</div>
        <div className="flex items-center gap-2">
          <span className="text-xxs text-daw-text-muted w-8">Début</span>
          <Slider
            value={state.startPoint * 100}
            min={0}
            max={100}
            size="sm"
            onChange={(v) => updateState({ startPoint: Math.min((typeof v === 'number' ? v : v[1]) / 100, state.endPoint - 0.01) })}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xxs text-daw-text-muted w-8">Fin</span>
          <Slider
            value={state.endPoint * 100}
            min={0}
            max={100}
            size="sm"
            onChange={(v) => updateState({ endPoint: Math.max((typeof v === 'number' ? v : v[1]) / 100, state.startPoint + 0.01) })}
          />
        </div>
      </div>

      {/* Loop controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-daw-text-muted">Boucle</span>
          <div className="flex gap-0.5">
            {(['off', 'forward', 'pingpong', 'reverse'] as LoopMode[]).map(mode => (
              <button
                key={mode}
                className={`px-2 py-0.5 rounded text-xxs transition-colors ${
                  state.loopMode === mode
                    ? 'bg-daw-accent-primary text-white'
                    : 'bg-daw-bg-surface text-daw-text-muted hover:bg-daw-bg-elevated'
                }`}
                onClick={() => updateState({ loopMode: mode })}
              >
                {mode === 'off' ? 'Off' : mode === 'forward' ? '→' : mode === 'pingpong' ? '↔' : '←'}
              </button>
            ))}
          </div>
        </div>
        {state.loopMode !== 'off' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xxs text-daw-text-muted w-8">Déb.B</span>
              <Slider
                value={state.loopStart * 100}
                min={0}
                max={100}
                size="sm"
                onChange={(v) => updateState({ loopStart: Math.min((typeof v === 'number' ? v : v[1]) / 100, state.loopEnd - 0.01) })}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xxs text-daw-text-muted w-8">Fin B</span>
              <Slider
                value={state.loopEnd * 100}
                min={0}
                max={100}
                size="sm"
                onChange={(v) => updateState({ loopEnd: Math.max((typeof v === 'number' ? v : v[1]) / 100, state.loopStart + 0.01) })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Render pitch controls
  const renderPitchControls = () => (
    <div className="p-3 bg-daw-bg-surface rounded-lg">
      <div className="text-xs text-daw-text-muted mb-3">HAUTEUR</div>
      <div className="grid grid-cols-4 gap-3">
        <div className="flex flex-col items-center">
          <div className="text-sm font-mono text-daw-text-primary mb-1">
            {getNoteNameFromMidi(state.rootNote)}
          </div>
          <Knob
            value={state.rootNote}
            min={0}
            max={127}
            size="sm"
            onChange={(v) => updateState({ rootNote: Math.round(v) })}
          />
          <span className="text-xxs text-daw-text-muted mt-1">Racine</span>
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={state.tune + 24}
            min={0}
            max={48}
            size="sm"
            bipolar
            onChange={(v) => updateState({ tune: v - 24 })}
          />
          <span className="text-xxs text-daw-text-muted mt-1">Accord</span>
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={state.fineTune + 100}
            min={0}
            max={200}
            size="sm"
            bipolar
            onChange={(v) => updateState({ fineTune: v - 100 })}
          />
          <span className="text-xxs text-daw-text-muted mt-1">Fine</span>
        </div>
        <div className="flex flex-col items-center">
          <button
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              state.reversed
                ? 'bg-daw-accent-primary text-white'
                : 'bg-daw-bg-primary text-daw-text-muted hover:bg-daw-bg-elevated'
            }`}
            onClick={() => updateState({ reversed: !state.reversed })}
            title="Inverser"
          >
            ⟲
          </button>
          <span className="text-xxs text-daw-text-muted mt-1">Inv</span>
        </div>
      </div>
    </div>
  );

  // Render envelope
  const renderEnvelope = () => (
    <div className="p-3 bg-daw-bg-surface rounded-lg">
      <div className="text-xs text-daw-text-muted mb-3">ENVELOPPE</div>
      <div className="grid grid-cols-4 gap-2">
        <div className="flex flex-col items-center">
          <Knob
            value={state.envelope.attack * 20}
            min={0}
            max={100}
            size="sm"
            onChange={(v) => updateState({
              envelope: { ...state.envelope, attack: v / 20 }
            })}
          />
          <span className="text-xxs text-daw-text-muted mt-1">A</span>
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={state.envelope.decay * 20}
            min={0}
            max={100}
            size="sm"
            onChange={(v) => updateState({
              envelope: { ...state.envelope, decay: v / 20 }
            })}
          />
          <span className="text-xxs text-daw-text-muted mt-1">D</span>
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={state.envelope.sustain * 100}
            min={0}
            max={100}
            size="sm"
            onChange={(v) => updateState({
              envelope: { ...state.envelope, sustain: v / 100 }
            })}
          />
          <span className="text-xxs text-daw-text-muted mt-1">S</span>
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={state.envelope.release * 20}
            min={0}
            max={100}
            size="sm"
            onChange={(v) => updateState({
              envelope: { ...state.envelope, release: v / 20 }
            })}
          />
          <span className="text-xxs text-daw-text-muted mt-1">R</span>
        </div>
      </div>
    </div>
  );

  // Render filter
  const renderFilter = () => (
    <div className="p-3 bg-daw-bg-surface rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            className={`w-4 h-4 rounded-full transition-colors ${
              state.filterEnabled ? 'bg-green-500' : 'bg-daw-bg-primary border border-daw-border'
            }`}
            onClick={() => updateState({ filterEnabled: !state.filterEnabled })}
          />
          <span className="text-xs text-daw-text-muted">FILTRE</span>
        </div>
        <div className="flex gap-0.5">
          {(['lowpass', 'highpass', 'bandpass'] as FilterType[]).map(type => (
            <button
              key={type}
              className={`px-2 py-0.5 rounded text-xxs transition-colors ${
                state.filterType === type
                  ? 'bg-daw-accent-primary text-white'
                  : 'bg-daw-bg-primary text-daw-text-muted hover:bg-daw-bg-elevated'
              } ${!state.filterEnabled ? 'opacity-50' : ''}`}
              onClick={() => updateState({ filterType: type })}
              disabled={!state.filterEnabled}
            >
              {type === 'lowpass' ? 'LP' : type === 'highpass' ? 'HP' : 'BP'}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col items-center">
          <Knob
            value={state.filterCutoff * 100}
            min={0}
            max={100}
            size="md"
            onChange={(v) => updateState({ filterCutoff: v / 100 })}
            disabled={!state.filterEnabled}
          />
          <span className="text-xxs text-daw-text-muted mt-1">Coupure</span>
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={state.filterResonance * 100}
            min={0}
            max={100}
            size="md"
            onChange={(v) => updateState({ filterResonance: v / 100 })}
            disabled={!state.filterEnabled}
          />
          <span className="text-xxs text-daw-text-muted mt-1">Reso</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col bg-daw-bg-secondary rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-daw-bg-elevated border-b border-daw-border">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎵</span>
          <span className="text-sm font-bold text-daw-text-primary">Lecteur d'échantillons</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            Load Sample
          </Button>
          {state.sample && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => updateState({ sample: null })}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Waveform */}
        {renderWaveformSection()}

        {/* Sample controls */}
        {state.sample && renderSampleControls()}

        {/* Pitch controls */}
        {renderPitchControls()}

        {/* Envelope and Filter */}
        <div className="grid grid-cols-2 gap-3">
          {renderEnvelope()}
          {renderFilter()}
        </div>
      </div>

      {/* Volume/Pan footer */}
      <div className="flex items-center gap-4 p-3 border-t border-daw-border bg-daw-bg-elevated">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-daw-text-muted">Vol</span>
          <Slider
            value={state.volume * 100}
            min={0}
            max={100}
            size="sm"
            onChange={(v) => updateState({ volume: (typeof v === 'number' ? v : v[1]) / 100 })}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-daw-text-muted">Pan</span>
          <Knob
            value={(state.pan + 1) * 50}
            min={0}
            max={100}
            size="sm"
            bipolar
            onChange={(v) => updateState({ pan: (v / 50) - 1 })}
          />
        </div>
      </div>
    </div>
  );
});

SamplePlayer.displayName = 'SamplePlayer';

export default SamplePlayer;