// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Audio-related TypeScript types for AnkhWaveStudio Web
 */

// Waveform types for oscillators
export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise' | 'custom';

// Audio engine state
export interface AudioEngineState {
  isInitialized: boolean;
  sampleRate: number;
  bufferSize: number;
  latency: number;
}

// Oscillator parameters
export interface OscillatorParams {
  waveform: WaveformType;
  frequency: number;
  detune: number;
  volume: number;
  pan: number;
  phase: number;
}

// Envelope (ADSR) parameters
export interface EnvelopeParams {
  attack: number;   // seconds
  decay: number;    // seconds
  sustain: number;  // 0-1
  release: number;  // seconds
}

// Filter parameters
export interface FilterParams {
  type: BiquadFilterType;
  frequency: number;
  Q: number;
  gain: number;
}

// LFO parameters
export interface LFOParams {
  waveform: WaveformType;
  frequency: number;
  amount: number;
  destination: string;
}

// Effect base interface
export interface EffectParams {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  wet?: number;
  params: Record<string, number>;
}

// Delay effect parameters
export interface DelayParams extends EffectParams {
  type: 'delay';
  params: {
    time: number;
    feedback: number;
    mix: number;
  };
}

// Reverb effect parameters
export interface ReverbParams extends EffectParams {
  type: 'reverb';
  params: {
    roomSize: number;
    damping: number;
    mix: number;
  };
}

// Mixer channel interface
export interface MixerChannelParams {
  id: string;
  name: string;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  effects: EffectParams[];
  sends: MixerSend[];
}

// Mixer send/return
export interface MixerSend {
  targetId: string;
  amount: number;
}

// Audio node connection
export interface AudioConnection {
  sourceId: string;
  sourceOutput: number;
  targetId: string;
  targetInput: number;
}

// Transport state
export interface TransportState {
  isPlaying: boolean;
  isRecording: boolean;
  isPaused: boolean;
  position: number;      // in ticks
  tempo: number;         // BPM
  timeSignature: TimeSignature;
  loopEnabled: boolean;
  loopStart: number;     // in ticks
  loopEnd: number;       // in ticks
}

// Time signature
export interface TimeSignature {
  numerator: number;
  denominator: number;
}

// MIDI note
export interface MidiNote {
  pitch: number;         // 0-127
  velocity: number;      // 0-127
  startTick: number;
  duration: number;      // in ticks
  channel: number;
  trackId?: string;      // Optional track ID for routing
}

// Audio buffer with metadata
export interface AudioSample {
  id: string;
  name: string;
  buffer: AudioBuffer | null;
  sampleRate: number;
  channels: number;
  duration: number;
  data?: ArrayBuffer;
}

// Worklet message types
export type WorkletMessageType = 
  | 'init'
  | 'noteOn'
  | 'noteOff'
  | 'paramChange'
  | 'reset'
  | 'dispose';

export interface WorkletMessage {
  type: WorkletMessageType;
  data?: unknown;
}

// Audio processing callback
export type AudioProcessCallback = (
  inputs: Float32Array[][],
  outputs: Float32Array[][],
  parameters: Record<string, Float32Array>
) => boolean;