// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Audio module exports for AnkhWaveStudio Web
 * Central export point for all audio-related classes and utilities
 */

// Core audio engine
export { AudioEngine, getAudioEngine } from './AudioEngine';
export type { AudioEngineConfig, AudioEngineEvent, AudioEngineEventCallback } from './AudioEngine';

// Audio graph and routing
export { AudioGraph } from './AudioGraph';
export type { AudioGraphEvent, AudioGraphEventCallback } from './AudioGraph';

// Mixer
export { MixerChannel } from './MixerChannel';
export type { ChannelStateEvent, ChannelStateCallback, VUMeterData } from './MixerChannel';

// Transport
export { Transport } from './Transport';
export type { TransportEvent, TransportEventCallback, MetronomeConfig } from './Transport';

// Sequencer
export { Sequencer, QUANTIZE_VALUES } from './Sequencer';
export type { Pattern, NoteEventCallback, PatternChangeCallback } from './Sequencer';

// Instruments
export { BaseInstrument } from './instruments/BaseInstrument';
export type {
  InstrumentParameterDescriptor,
  InstrumentPreset,
  ActiveVoice,
  MidiCCMapping,
  InstrumentStateEvent,
  InstrumentStateCallback
} from './instruments/BaseInstrument';

export { Oscillator } from './instruments/Oscillator';
export { Kicker } from './instruments/Kicker';

// New instruments (Tier 3)
export { Sfxr } from './instruments/Sfxr';
export { FreeBoy } from './instruments/FreeBoy';
export { GigPlayer } from './instruments/GigPlayer';
export { SlicerT } from './instruments/SlicerT';
export { Stk } from './instruments/Stk';

// Effects
export { BaseEffect, createGainNode, connectInSeries } from './effects/BaseEffect';
export type {
  EffectParameterDescriptor,
  EffectPreset,
  EffectStateEvent,
  EffectStateCallback
} from './effects/BaseEffect';

export { Delay } from './effects/Delay';
export { Reverb } from './effects/Reverb';
export { Compressor } from './effects/Compressor';
export type { CompressorMeteringData } from './effects/Compressor';
export { ParametricEQ } from './effects/ParametricEQ';
export type { EQBand } from './effects/ParametricEQ';

// New effects (Tier 3)
export { ReverbSC } from './effects/ReverbSC';
export { Dispersion } from './effects/Dispersion';
export { GranularPitchShifter } from './effects/GranularPitchShifter';
export { LOMM } from './effects/LOMM';
export { SlewDistortion } from './effects/SlewDistortion';
export { Vectorscope } from './effects/Vectorscope';

// Sample Player
export { SamplePlayer } from './SamplePlayer';
export type { LoadedSample, ScheduledSample, SampleClipData } from './SamplePlayer';

// Audio Exporter
export { AudioExporter } from './AudioExporter';
export type { ExportFormat, ExportOptions, ExportProgress, BitDepth, SampleRate } from './AudioExporter';

// Audio utilities
export {
  // Constants
  A4_FREQUENCY,
  A4_MIDI_NOTE,
  SEMITONES_PER_OCTAVE,
  CENTS_PER_SEMITONE,
  CENTS_PER_OCTAVE,
  
  // Conversions
  dBToLinear,
  linearToDb,
  midiNoteToFrequency,
  frequencyToMidiNote,
  centsToRatio,
  ratioToCents,
  semitonesToRatio,
  ratioToSemitones,
  midiNoteToName,
  noteNameToMidi,
  
  // Math utilities
  clamp,
  lerp,
  expInterp,
  smoothStep,
  smootherStep,
  
  // Audio analysis
  calculateRMS,
  calculatePeak,
  
  // Clipping
  softClip,
  hardClip,
  
  // Timing
  bpmToMs,
  bpmToSamples,
  quantize,
  mapRange,
  equalPowerCrossfade,
  
  // Classes
  ParameterRamp,
  OnePoleLowpass,
  DCBlocker
} from './utils/AudioMath';

// Worklet paths for dynamic loading
export const WORKLET_PATHS = {
  oscillator: new URL('./worklets/OscillatorWorklet.ts', import.meta.url).href,
  sampler: new URL('./worklets/SamplerWorklet.ts', import.meta.url).href,
};

// Re-export types from types/audio
export type {
  WaveformType,
  AudioEngineState,
  OscillatorParams,
  EnvelopeParams,
  FilterParams,
  LFOParams,
  EffectParams,
  DelayParams,
  ReverbParams,
  MixerChannelParams,
  MixerSend,
  AudioConnection,
  TransportState,
  TimeSignature,
  MidiNote,
  AudioSample,
  WorkletMessageType,
  WorkletMessage,
  AudioProcessCallback
} from '../types/audio';