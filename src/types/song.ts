// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Song and project-related TypeScript types for AnkhWaveStudio Web
 */

import type { MidiNote, EnvelopeParams, FilterParams, OscillatorParams, EffectParams, TimeSignature } from './audio';
import type { ControllerData } from './controller';

// Track types
export type TrackType = 'instrument' | 'sample' | 'automation' | 'pattern' | 'audio';

// Project metadata
export interface ProjectMetadata {
  name: string;
  author: string;
  description: string;
  createdAt: string;
  modifiedAt: string;
  version: string;
  notes?: string; // Project notes (markdown supported)
  tags?: string[]; // Project tags for organization
}

// Main project/song data structure
export interface ProjectData {
  id: string;
  name: string;
  version: string;
  metadata: ProjectMetadata;
  song: SongSettings;
  tracks: Track[];
  mixer: MixerData;
  controllers: ControllerData[];
  automation: AutomationData[];
  patterns: Pattern[];
  createdAt?: number;
  updatedAt?: number;
}

// Song-level settings
export interface SongSettings {
  tempo: number;
  timeSignature: TimeSignature;
  masterVolume: number;
  masterPitch: number;
  length: number;  // in bars
}

// Base track interface
export interface Track {
  id: string;
  type: TrackType;
  name: string;
  color: string;
  muted: boolean;
  solo: boolean;
  volume: number;
  pan: number;
  mixerChannelId: string;
  clips: Clip[];
}

// Instrument track
export interface InstrumentTrack extends Track {
  type: 'instrument';
  instrumentId: string;
  instrument: InstrumentData;
}

// Sample track
export interface SampleTrack extends Track {
  type: 'sample';
  sampleId: string;
}

// Automation track
export interface AutomationTrack extends Track {
  type: 'automation';
  targetTrackId: string;
  targetParameter: string;
}

// Pattern track
export interface PatternTrack extends Track {
  type: 'pattern';
  patternId: string;
}

// Clip (region on timeline)
export interface Clip {
  id: string;
  trackId: string;
  startTick: number;
  length: number;
  offset: number;
  name: string;
  color?: string;
}

// MIDI clip
export interface MidiClip extends Clip {
  notes: MidiNote[];
}

// Audio clip
export interface AudioClip extends Clip {
  sampleId: string;
  samplePath?: string;
  sampleDuration?: number;
  startOffset: number;
  fadeIn: number;
  fadeOut: number;
  gain: number;
  pitch: number;
}

// Automation clip
export interface AutomationClip extends Clip {
  points: AutomationPoint[];
}

// Automation point
export interface AutomationPoint {
  tick: number;
  value: number;
  curve: AutomationCurve;
}

// Automation curve types
export type AutomationCurve = 'linear' | 'discrete' | 'exponential' | 'bezier';

// Pattern data
export interface Pattern {
  id: string;
  name: string;
  length: number;  // in steps
  steps: PatternStep[];
}

// Pattern step
export interface PatternStep {
  index: number;
  enabled: boolean;
  velocity: number;
  pan: number;
  pitch: number;
}

// Instrument data
export interface InstrumentData {
  id: string;
  type: string;
  name: string;
  preset?: string;
  params: InstrumentParams;
}

// Generic instrument parameters
export interface InstrumentParams {
  volume: number;
  pan: number;
  pitch: number;
  [key: string]: unknown;
}

// Triple Oscillator specific params
export interface TripleOscillatorParams extends InstrumentParams {
  osc1: OscillatorParams;
  osc2: OscillatorParams;
  osc3: OscillatorParams;
  osc1Enabled: boolean;
  osc2Enabled: boolean;
  osc3Enabled: boolean;
  envelope: EnvelopeParams;
  filter: FilterParams;
  filterEnabled: boolean;
}

// Mixer data
export interface MixerData {
  channels: MixerChannelData[];
  masterChannel: MixerChannelData;
}

// Mixer channel data
export interface MixerChannelData {
  id: string;
  name: string;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  effects: EffectParams[];
  sends: SendData[];
  color?: string;
  type?: 'regular' | 'master' | 'send' | 'audio' | 'bus';
}

// Send data
export interface SendData {
  targetChannelId: string;
  amount: number;
  preFader: boolean;
}

// Automation data
export interface AutomationData {
  id: string;
  trackId: string;
  parameter: string;
  points: AutomationPoint[];
}

// Sample reference in project
export interface SampleReference {
  id: string;
  name: string;
  path: string;
  embedded: boolean;
  data?: ArrayBuffer;
}

// Preset data
export interface PresetData {
  id: string;
  name: string;
  instrumentType: string;
  params: InstrumentParams;
  tags: string[];
}