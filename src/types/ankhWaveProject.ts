// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * AnkhWaveStudio Project File Type Definitions
 * Defines TypeScript interfaces for all AnkhWaveStudio project elements (.mmp/.mmpz files)
 */

// ============================================================================
// Project Root
// ============================================================================

/**
 * Root AnkhWaveStudio project structure
 */
export interface AnkhWaveStudioProjectFile {
  version: string;
  type: 'song';
  creator: string;
  creatorVersion?: string;
  head: AnkhWaveStudioProjectHead;
  song: AnkhWaveStudioSong;
  fxmixer?: AnkhWaveStudioFxMixer;
}

/**
 * Project header with global settings
 */
export interface AnkhWaveStudioProjectHead {
  bpm: number;
  timesigNumerator: number;
  timesigDenominator: number;
  mastervol: number;
  masterpitch: number;
}

// ============================================================================
// Song Structure
// ============================================================================

/**
 * Song container with tracks
 */
export interface AnkhWaveStudioSong {
  trackcontainer: AnkhWaveStudioTrackContainer;
}

/**
 * Container for all tracks
 */
export interface AnkhWaveStudioTrackContainer {
  tracks: AnkhWaveStudioTrack[];
}

// ============================================================================
// Track Types
// ============================================================================

/**
 * AnkhWaveStudio Track types
 * 0 = Instrument track
 * 1 = BB track (Beat/Bassline)
 * 2 = Sample track
 * 5 = Automation track
 */
export type AnkhWaveStudioTrackType = 0 | 1 | 2 | 5;

/**
 * Base track interface
 */
export interface AnkhWaveStudioTrack {
  type: AnkhWaveStudioTrackType;
  name: string;
  muted?: boolean;
  solo?: boolean;
  color?: string;
}

/**
 * Instrument track (type 0)
 */
export interface AnkhWaveStudioInstrumentTrack extends AnkhWaveStudioTrack {
  type: 0;
  instrumenttrack: AnkhWaveStudioInstrumentTrackData;
}

/**
 * Beat/Bassline track (type 1)
 */
export interface AnkhWaveStudioBBTrack extends AnkhWaveStudioTrack {
  type: 1;
  bbtrack: AnkhWaveStudioBBTrackData;
}

/**
 * Sample track (type 2)
 */
export interface AnkhWaveStudioSampleTrack extends AnkhWaveStudioTrack {
  type: 2;
  sampletrack: AnkhWaveStudioSampleTrackData;
}

/**
 * Automation track (type 5)
 */
export interface AnkhWaveStudioAutomationTrack extends AnkhWaveStudioTrack {
  type: 5;
  automationtrack: AnkhWaveStudioAutomationTrackData;
}

// ============================================================================
// Instrument Track Data
// ============================================================================

/**
 * Instrument track data
 */
export interface AnkhWaveStudioInstrumentTrackData {
  vol: number;
  pan: number;
  pitch: number;
  pitchrange: number;
  fxch: number;  // FX mixer channel
  basenote: number;
  usemasterpitch: boolean;
  instrument: AnkhWaveStudioInstrument;
  eldata?: AnkhWaveStudioEnvelopeLfoData;
  chordcreator?: AnkhWaveStudioChordCreator;
  arpeggiator?: AnkhWaveStudioArpeggiator;
  midiport?: AnkhWaveStudioMidiPort;
  patterns: AnkhWaveStudioPattern[];
}

/**
 * Instrument definition
 */
export interface AnkhWaveStudioInstrument {
  name: string;
  params: Record<string, unknown>;
}

/**
 * Envelope and LFO data
 */
export interface AnkhWaveStudioEnvelopeLfoData {
  // Volume envelope
  elvol: AnkhWaveStudioEnvelope;
  // Cutoff envelope
  elcut: AnkhWaveStudioEnvelope;
  // Resonance envelope
  elres: AnkhWaveStudioEnvelope;
}

/**
 * Envelope parameters
 */
export interface AnkhWaveStudioEnvelope {
  pdel: number;  // Pre-delay
  att: number;   // Attack
  hold: number;  // Hold
  dec: number;   // Decay
  sustain: number;
  rel: number;   // Release
  amt: number;   // Amount
  // LFO parameters
  lpdel?: number;
  latt?: number;
  lspd?: number;  // LFO speed
  lamt?: number;  // LFO amount
  lshp?: number;  // LFO shape
  x100?: boolean;
}

/**
 * Chord creator settings
 */
export interface AnkhWaveStudioChordCreator {
  chord: number;
  chordrange: number;
  enabled: boolean;
}

/**
 * Arpeggiator settings
 */
export interface AnkhWaveStudioArpeggiator {
  arpdir: number;
  arprange: number;
  arpcycle: number;
  arpskip: number;
  arpmiss: number;
  arptime: number;
  arpgate: number;
  arpmode: number;
  enabled: boolean;
}

/**
 * MIDI port settings
 */
export interface AnkhWaveStudioMidiPort {
  inputchannel: number;
  outputchannel: number;
  inputcontroller: number;
  outputcontroller: number;
  fixedinputvelocity: number;
  fixedoutputvelocity: number;
  fixedoutputnote: number;
  outputprogram: number;
  basevelocity: number;
  readable: boolean;
  writable: boolean;
}

// ============================================================================
// Pattern and Note Data
// ============================================================================

/**
 * Pattern (MIDI clip)
 */
export interface AnkhWaveStudioPattern {
  pos: number;      // Position in ticks
  len?: number;     // Length in ticks (optional, calculated from notes)
  name?: string;
  muted?: boolean;
  steps?: number;   // For step sequencer patterns
  notes: AnkhWaveStudioNote[];
}

/**
 * Note data
 */
export interface AnkhWaveStudioNote {
  pos: number;      // Position in ticks (relative to pattern start)
  len: number;      // Length in ticks
  key: number;      // MIDI note number (0-127)
  vol: number;      // Volume (0-100)
  pan?: number;     // Panning (-100 to 100)
  detuning?: AnkhWaveStudioDetuning;
}

/**
 * Note detuning/automation
 */
export interface AnkhWaveStudioDetuning {
  time: number[];
  value: number[];
}

// ============================================================================
// BB Track Data
// ============================================================================

/**
 * Beat/Bassline track data
 */
export interface AnkhWaveStudioBBTrackData {
  trackcontainer: AnkhWaveStudioTrackContainer;
  patterns: AnkhWaveStudioBBPattern[];
}

/**
 * BB pattern reference
 */
export interface AnkhWaveStudioBBPattern {
  pos: number;
  len: number;
  name?: string;
}

// ============================================================================
// Sample Track Data
// ============================================================================

/**
 * Sample track data
 */
export interface AnkhWaveStudioSampleTrackData {
  vol: number;
  pan: number;
  fxch: number;
  clips: AnkhWaveStudioSampleClip[];
}

/**
 * Sample clip
 */
export interface AnkhWaveStudioSampleClip {
  pos: number;
  len: number;
  src: string;        // Sample file path
  off?: number;       // Start offset
  muted?: boolean;
  reversed?: boolean;
  looped?: boolean;
  samplerate?: number;
  data?: string;      // Base64 encoded sample data (embedded)
}

// ============================================================================
// Automation Track Data
// ============================================================================

/**
 * Automation track data
 */
export interface AnkhWaveStudioAutomationTrackData {
  patterns: AnkhWaveStudioAutomationPattern[];
}

/**
 * Automation pattern
 */
export interface AnkhWaveStudioAutomationPattern {
  pos: number;
  len: number;
  name?: string;
  prog: number;       // Progression type
  tens: number;       // Tension
  mute?: boolean;
  objects: AnkhWaveStudioAutomationObject[];
  points: AnkhWaveStudioAutomationPoint[];
}

/**
 * Automation target object
 */
export interface AnkhWaveStudioAutomationObject {
  id: string;
}

/**
 * Automation point
 */
export interface AnkhWaveStudioAutomationPoint {
  pos: number;
  value: number;
}

// ============================================================================
// FX Mixer
// ============================================================================

/**
 * FX Mixer
 */
export interface AnkhWaveStudioFxMixer {
  channels: AnkhWaveStudioFxChannel[];
}

/**
 * FX Mixer channel
 */
export interface AnkhWaveStudioFxChannel {
  num: number;
  name?: string;
  volume: number;
  muted?: boolean;
  soloed?: boolean;
  effects: AnkhWaveStudioEffect[];
  sends: AnkhWaveStudioFxSend[];
}

/**
 * Effect in FX chain
 */
export interface AnkhWaveStudioEffect {
  name: string;
  enabled: boolean;
  wet: number;
  gate: number;
  params: Record<string, unknown>;
}

/**
 * FX channel send
 */
export interface AnkhWaveStudioFxSend {
  channel: number;
  amount: number;
}

// ============================================================================
// Instrument-Specific Types
// ============================================================================

/**
 * AnkhWaveStudio TripleOscillator parameters (raw format)
 */
export interface AnkhWaveStudioTripleOscillatorParams {
  // Oscillator 1
  osc1_vol: number;
  osc1_pan: number;
  osc1_coarse: number;
  osc1_finel: number;
  osc1_finer: number;
  osc1_phoffset: number;
  osc1_stphdetun: number;
  osc1_wave: number;
  // Oscillator 2
  osc2_vol: number;
  osc2_pan: number;
  osc2_coarse: number;
  osc2_finel: number;
  osc2_finer: number;
  osc2_phoffset: number;
  osc2_stphdetun: number;
  osc2_wave: number;
  // Oscillator 3
  osc3_vol: number;
  osc3_pan: number;
  osc3_coarse: number;
  osc3_finel: number;
  osc3_finer: number;
  osc3_phoffset: number;
  osc3_stphdetun: number;
  osc3_wave: number;
  // Modulation
  osc2_mod: number;
  osc3_mod: number;
}

/**
 * AnkhWaveStudio Kicker parameters (raw format)
 */
export interface AnkhWaveStudioKickerParams {
  startfreq: number;
  endfreq: number;
  decay: number;
  dist: number;
  distend: number;
  gain: number;
  env: number;
  noise: number;
  click: number;
  slope: number;
  startnotefreq: boolean;
  endnotefreq: boolean;
}

/**
 * AnkhWaveStudio AudioFileProcessor parameters (raw format)
 */
export interface AnkhWaveStudioAudioFileProcessorParams {
  src: string;
  reversed: boolean;
  amp: number;
  sframe: number;
  eframe: number;
  looped: boolean;
  stutter: boolean;
}

/**
 * AnkhWaveStudio SF2 Player parameters (raw format)
 */
export interface AnkhWaveStudioSF2PlayerParams {
  src: string;
  bank: number;
  patch: number;
  gain: number;
  reverbOn: boolean;
  reverbRoomSize: number;
  reverbDamping: number;
  reverbWidth: number;
  reverbLevel: number;
  chorusOn: boolean;
  chorusNum: number;
  chorusLevel: number;
  chorusSpeed: number;
  chorusDepth: number;
}

// ============================================================================
// Import/Export Types
// ============================================================================

/**
 * Import result with warnings
 */
export interface AnkhWaveStudioImportResult {
  project: AnkhWaveStudioProjectFile;
  warnings: AnkhWaveStudioImportWarning[];
  unsupportedFeatures: string[];
}

/**
 * Import warning
 */
export interface AnkhWaveStudioImportWarning {
  type: 'instrument' | 'effect' | 'sample' | 'feature' | 'version';
  message: string;
  details?: string;
}

/**
 * Sample reference for import
 */
export interface AnkhWaveStudioSampleReference {
  path: string;
  embedded: boolean;
  data?: ArrayBuffer;
  missing?: boolean;
}

// ============================================================================
// Supported Instruments Map
// ============================================================================

/**
 * Map of AnkhWaveStudio instrument names to web equivalents
 */
export const INSTRUMENT_MAP: Record<string, string> = {
  'tripleoscillator': 'TripleOscillator',
  'kicker': 'Kicker',
  'audiofileprocessor': 'AudioFileProcessor',
  'bitinvader': 'BitInvader',
  'lb302': 'LB302',
  'malletsstk': 'Mallets',
  'monstro': 'Monstro',
  'nes': 'NES',
  'organic': 'Organic',
  'papu': 'Papu',
  'sf2player': 'SF2Player',
  'sfxr': 'Sfxr',
  'sid': 'SID',
  'vibedstrings': 'Vibed',
  'watsyn': 'Watsyn',
  'xpressive': 'Xpressive',
  // Unsupported - will fallback to TripleOscillator
  'zynaddsubfx': 'TripleOscillator',
  'vestige': 'TripleOscillator',
  'carlabase': 'TripleOscillator',
  'ladspa': 'TripleOscillator',
};

/**
 * Map of AnkhWaveStudio effect names to web equivalents
 */
export const EFFECT_MAP: Record<string, string> = {
  'amplifier': 'Amplifier',
  'bassbooster': 'BassBooster',
  'bitcrush': 'Bitcrush',
  'crossovereq': 'CrossoverEQ',
  'delay': 'Delay',
  'dualfilter': 'DualFilter',
  'dynamicsprocessor': 'DynamicsProcessor',
  'eq': 'EQ',
  'flanger': 'Flanger',
  'ladspaeffect': 'LADSPA',
  'multitapecho': 'MultitapEcho',
  'peakcontrollereffect': 'PeakController',
  'reverbsc': 'Reverb',
  'spectrumanalyzer': 'SpectrumAnalyzer',
  'stereoenhancer': 'StereoEnhancer',
  'stereomatrix': 'StereoMatrix',
  'waveshaper': 'Waveshaper',
};

/**
 * AnkhWaveStudio waveform types
 */
export const WAVEFORM_TYPES = {
  0: 'sine',
  1: 'triangle',
  2: 'sawtooth',
  3: 'square',
  4: 'moog',
  5: 'exponential',
  6: 'noise',
  7: 'custom',
} as const;

/**
 * AnkhWaveStudio modulation types
 */
export const MODULATION_TYPES = {
  0: 'none',
  1: 'pm',   // Phase modulation
  2: 'am',   // Amplitude modulation
  3: 'mix',  // Mix
  4: 'sync', // Sync
  5: 'fm',   // Frequency modulation
} as const;