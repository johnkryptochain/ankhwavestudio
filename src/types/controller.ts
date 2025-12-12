// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Controller types for AnkhWaveStudio
 * Based on AnkhWaveStudio Controller architecture
 */

/**
 * Controller types
 */
export enum ControllerType {
  LFO = 'lfo',
  Envelope = 'envelope',
  Peak = 'peak',
  MIDI = 'midi'
}

/**
 * LFO waveform types
 */
export enum LFOWaveform {
  Sine = 'sine',
  Triangle = 'triangle',
  Sawtooth = 'sawtooth',
  Square = 'square',
  Random = 'random',
  RandomSmooth = 'randomSmooth'
}

/**
 * Controller connection
 */
export interface ControllerConnection {
  id: string;
  targetType: 'instrument' | 'effect' | 'mixer';
  targetId: string;
  parameterId: string;
  parameterName: string;
  amount: number; // -1 to 1
  enabled: boolean;
}

/**
 * Base controller interface
 */
export interface BaseController {
  id: string;
  name: string;
  type: ControllerType;
  enabled: boolean;
  connections: ControllerConnection[];
}

/**
 * LFO controller
 */
export interface LFOController extends BaseController {
  type: ControllerType.LFO;
  waveform: LFOWaveform;
  frequency: number; // Hz
  phase: number; // 0-1
  amount: number; // 0-1
  offset: number; // -1 to 1
  syncToTempo: boolean;
  tempoSync: number; // Beats per cycle
}

/**
 * Envelope controller
 */
export interface EnvelopeController extends BaseController {
  type: ControllerType.Envelope;
  attack: number; // seconds
  decay: number; // seconds
  sustain: number; // 0-1
  release: number; // seconds
  amount: number; // 0-1
  loopEnabled: boolean;
  loopStart: number; // 0-3 (A, D, S, R)
  loopEnd: number; // 0-3 (A, D, S, R)
}

/**
 * Peak controller
 */
export interface PeakController extends BaseController {
  type: ControllerType.Peak;
  inputSource: string; // Track or mixer channel ID
  attack: number; // seconds
  release: number; // seconds
  amount: number; // 0-1
  threshold: number; // dB
  invert: boolean;
}

/**
 * MIDI controller
 */
export interface MIDIController extends BaseController {
  type: ControllerType.MIDI;
  channel: number; // 0-15
  ccNumber: number; // 0-127
  minValue: number; // 0-1
  maxValue: number; // 0-1
  defaultValue: number; // 0-1
  currentValue: number; // 0-1
}

/**
 * Controller union type
 */
export type ControllerData = LFOController | EnvelopeController | PeakController | MIDIController;

