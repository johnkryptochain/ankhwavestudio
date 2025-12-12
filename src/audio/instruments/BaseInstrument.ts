// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * BaseInstrument - Abstract base class for all instruments
 * Provides common functionality for note handling, parameter automation, and presets
 */

import type { EnvelopeParams, MidiNote } from '../../types/audio';
import { midiNoteToFrequency, clamp, dBToLinear } from '../utils/AudioMath';

/**
 * Instrument parameter descriptor for UI generation
 */
export interface InstrumentParameterDescriptor {
  name: string;
  key: string;
  min: number;
  max: number;
  default: number;
  step?: number;
  unit?: string;
  type?: 'linear' | 'logarithmic' | 'boolean' | 'enum';
  enumValues?: string[];
  category?: string;
}

/**
 * Instrument preset interface
 */
export interface InstrumentPreset {
  name: string;
  params: Record<string, number>;
  envelope?: EnvelopeParams;
}

/**
 * Active voice information
 */
export interface ActiveVoice {
  noteNumber: number;
  velocity: number;
  startTime: number;
  channel: number;
}

/**
 * MIDI CC mapping
 */
export interface MidiCCMapping {
  cc: number;
  paramKey: string;
  min?: number;
  max?: number;
}

/**
 * Instrument state change event
 */
export interface InstrumentStateEvent {
  type: 'noteOn' | 'noteOff' | 'paramChange' | 'preset' | 'allNotesOff';
  instrumentId: string;
  data: unknown;
}

export type InstrumentStateCallback = (event: InstrumentStateEvent) => void;

/**
 * Abstract base class for all instruments
 */
export abstract class BaseInstrument {
  protected audioContext: AudioContext;
  protected id: string;
  protected name: string;
  protected type: string;
  
  // Audio nodes
  protected outputNode: GainNode;
  protected volumeNode: GainNode;
  
  // State
  protected params: Record<string, number> = {};
  protected envelope: EnvelopeParams = { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 };
  protected activeVoices: Map<number, ActiveVoice> = new Map();
  protected maxPolyphony: number = 16;
  protected volume: number = 0.8;
  protected pan: number = 0;
  
  // Presets
  protected presets: InstrumentPreset[] = [];
  protected currentPresetIndex: number = -1;
  
  // MIDI CC mappings
  protected ccMappings: MidiCCMapping[] = [];
  
  // Event callbacks
  protected stateCallbacks: InstrumentStateCallback[] = [];

  constructor(audioContext: AudioContext, id: string, name: string, type: string) {
    this.audioContext = audioContext;
    this.id = id;
    this.name = name;
    this.type = type;
    
    // Create output nodes
    this.outputNode = audioContext.createGain();
    this.volumeNode = audioContext.createGain();
    this.volumeNode.gain.value = this.volume;
    this.volumeNode.connect(this.outputNode);
    
    // Set up default CC mappings
    this.setupDefaultCCMappings();
  }

  /** Get the instrument ID */
  getId(): string { return this.id; }

  /** Get the instrument name */
  getName(): string { return this.name; }

  /** Set the instrument name */
  setName(name: string): void { this.name = name; }

  /** Get the instrument type */
  getType(): string { return this.type; }

  /** Get the output node for connecting to mixer */
  getOutput(): GainNode { return this.outputNode; }

  /** Connect the instrument output to a destination */
  connect(destination: AudioNode): void {
    console.log(`[BaseInstrument] Connecting ${this.name} output to destination`);
    this.outputNode.connect(destination);
  }

  /** Disconnect the instrument output */
  disconnect(): void { this.outputNode.disconnect(); }

  /** Set master volume (0-1) */
  setVolume(volume: number): void {
    this.volume = clamp(volume, 0, 1);
    this.volumeNode.gain.setTargetAtTime(this.volume, this.audioContext.currentTime, 0.01);
  }

  /** Get current volume */
  getVolume(): number { return this.volume; }

  /** Set volume in dB */
  setVolumeDb(dB: number): void { this.setVolume(dBToLinear(dB)); }

  /**
   * Trigger a note on event
   * @param noteNumber - MIDI note number (0-127)
   * @param velocity - Note velocity (0-127)
   * @param channel - MIDI channel (0-15)
   */
  noteOn(noteNumber: number, velocity: number = 100, channel: number = 0): void {
    const normalizedVelocity = clamp(velocity, 0, 127) / 127;
    const frequency = midiNoteToFrequency(noteNumber);
    
    // Check polyphony limit
    if (this.activeVoices.size >= this.maxPolyphony) {
      this.stealVoice();
    }
    
    // Store active voice
    const voice: ActiveVoice = {
      noteNumber,
      velocity: normalizedVelocity,
      startTime: this.audioContext.currentTime,
      channel
    };
    this.activeVoices.set(noteNumber, voice);
    
    // Trigger the actual note (implemented by subclasses)
    this.triggerNote(noteNumber, frequency, normalizedVelocity);
    
    this.emitStateEvent({ type: 'noteOn', instrumentId: this.id, data: { noteNumber, velocity, channel } });
  }

  /**
   * Trigger a note off event
   * @param noteNumber - MIDI note number (0-127)
   * @param channel - MIDI channel (0-15)
   */
  noteOff(noteNumber: number, channel: number = 0): void {
    const voice = this.activeVoices.get(noteNumber);
    if (!voice) return;
    
    this.activeVoices.delete(noteNumber);
    this.releaseNote(noteNumber);
    
    this.emitStateEvent({ type: 'noteOff', instrumentId: this.id, data: { noteNumber, channel } });
  }

  /** Stop all notes immediately */
  allNotesOff(): void {
    for (const [noteNumber] of this.activeVoices) {
      this.silenceNote(noteNumber);
    }
    this.activeVoices.clear();
    this.emitStateEvent({ type: 'allNotesOff', instrumentId: this.id, data: {} });
  }

  /** Steal the oldest voice when polyphony limit is reached */
  protected stealVoice(): void {
    let oldestNote = -1;
    let oldestTime = Infinity;
    
    for (const [noteNumber, voice] of this.activeVoices) {
      if (voice.startTime < oldestTime) {
        oldestTime = voice.startTime;
        oldestNote = noteNumber;
      }
    }
    
    if (oldestNote !== -1) {
      this.noteOff(oldestNote);
    }
  }

  /** Trigger a note - must be implemented by subclasses */
  protected abstract triggerNote(noteNumber: number, frequency: number, velocity: number): void;

  /** Release a note - must be implemented by subclasses */
  protected abstract releaseNote(noteNumber: number): void;

  /** Silence a note immediately (used for pause/stop) */
  protected silenceNote(noteNumber: number): void {
    this.releaseNote(noteNumber);
  }

  /** Set envelope parameters */
  setEnvelope(envelope: Partial<EnvelopeParams>): void {
    if (envelope.attack !== undefined) this.envelope.attack = clamp(envelope.attack, 0.001, 10);
    if (envelope.decay !== undefined) this.envelope.decay = clamp(envelope.decay, 0.001, 10);
    if (envelope.sustain !== undefined) this.envelope.sustain = clamp(envelope.sustain, 0, 1);
    if (envelope.release !== undefined) this.envelope.release = clamp(envelope.release, 0.001, 10);
    this.onEnvelopeChange();
  }

  /** Get current envelope parameters */
  getEnvelope(): EnvelopeParams { return { ...this.envelope }; }

  /** Called when envelope changes - can be overridden by subclasses */
  protected onEnvelopeChange(): void {}

  /** Set a parameter value */
  setParameter(key: string, value: number): void {
    const descriptor = this.getParameterDescriptors().find(d => d.key === key);
    if (descriptor) {
      const clampedValue = clamp(value, descriptor.min, descriptor.max);
      this.params[key] = clampedValue;
      this.onParameterChange(key, clampedValue);
      this.emitStateEvent({ type: 'paramChange', instrumentId: this.id, data: { key, value: clampedValue } });
    }
  }

  /** Get a parameter value */
  getParameter(key: string): number { return this.params[key] ?? 0; }

  /** Get all parameters */
  getParameters(): Record<string, number> { return { ...this.params }; }

  /** Set multiple parameters at once */
  setParameters(params: Record<string, number>): void {
    for (const [key, value] of Object.entries(params)) {
      this.setParameter(key, value);
    }
  }

  /** Get parameter descriptors for UI - must be implemented by subclasses */
  abstract getParameterDescriptors(): InstrumentParameterDescriptor[];

  /** Called when a parameter changes - must be implemented by subclasses */
  protected abstract onParameterChange(key: string, value: number): void;

  /** Initialize the instrument - must be implemented by subclasses */
  protected abstract initializeInstrument(): void;

  /** Set up default MIDI CC mappings */
  protected setupDefaultCCMappings(): void {
    this.ccMappings = [
      { cc: 1, paramKey: 'modulation', min: 0, max: 1 },
      { cc: 7, paramKey: 'volume', min: 0, max: 1 },
      { cc: 10, paramKey: 'pan', min: -1, max: 1 },
      { cc: 74, paramKey: 'filterCutoff', min: 0, max: 1 },
      { cc: 71, paramKey: 'filterResonance', min: 0, max: 1 }
    ];
  }

  /** Handle MIDI CC message */
  handleCC(cc: number, value: number): void {
    const mapping = this.ccMappings.find(m => m.cc === cc);
    if (mapping) {
      const normalizedValue = value / 127;
      const min = mapping.min ?? 0;
      const max = mapping.max ?? 1;
      const mappedValue = min + normalizedValue * (max - min);
      
      if (mapping.paramKey === 'volume') {
        this.setVolume(mappedValue);
      } else {
        this.setParameter(mapping.paramKey, mappedValue);
      }
    }
  }

  /** Add a CC mapping */
  addCCMapping(mapping: MidiCCMapping): void {
    const existing = this.ccMappings.findIndex(m => m.cc === mapping.cc);
    if (existing !== -1) {
      this.ccMappings[existing] = mapping;
    } else {
      this.ccMappings.push(mapping);
    }
  }

  /** Remove a CC mapping */
  removeCCMapping(cc: number): void {
    this.ccMappings = this.ccMappings.filter(m => m.cc !== cc);
  }

  /** Get all CC mappings */
  getCCMappings(): MidiCCMapping[] { return [...this.ccMappings]; }

  /** Add a preset */
  addPreset(preset: InstrumentPreset): void { this.presets.push(preset); }

  /** Get all presets */
  getPresets(): InstrumentPreset[] { return [...this.presets]; }

  /** Load a preset by index */
  loadPreset(index: number): boolean {
    if (index < 0 || index >= this.presets.length) return false;
    const preset = this.presets[index];
    this.setParameters(preset.params);
    if (preset.envelope) this.setEnvelope(preset.envelope);
    this.currentPresetIndex = index;
    this.emitStateEvent({ type: 'preset', instrumentId: this.id, data: { index, name: preset.name } });
    return true;
  }

  /** Save current settings as a preset */
  saveAsPreset(name: string): InstrumentPreset {
    const preset: InstrumentPreset = { name, params: { ...this.params }, envelope: { ...this.envelope } };
    this.presets.push(preset);
    return preset;
  }

  /** Register a state change callback */
  onStateChange(callback: InstrumentStateCallback): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      const index = this.stateCallbacks.indexOf(callback);
      if (index !== -1) this.stateCallbacks.splice(index, 1);
    };
  }

  /** Emit a state change event */
  protected emitStateEvent(event: InstrumentStateEvent): void {
    for (const callback of this.stateCallbacks) {
      try { callback(event); } catch (error) { console.error('Error in instrument state callback:', error); }
    }
  }

  /** Get instrument state as serializable object */
  getState(): { id: string; name: string; type: string; volume: number; params: Record<string, number>; envelope: EnvelopeParams } {
    return { id: this.id, name: this.name, type: this.type, volume: this.volume, params: { ...this.params }, envelope: { ...this.envelope } };
  }

  /** Reset instrument to default state */
  reset(): void {
    this.allNotesOff();
    const descriptors = this.getParameterDescriptors();
    for (const descriptor of descriptors) {
      this.setParameter(descriptor.key, descriptor.default);
    }
    this.setEnvelope({ attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 });
    this.currentPresetIndex = -1;
  }

  /** Dispose of all resources */
  dispose(): void {
    this.allNotesOff();
    this.disconnect();
    this.volumeNode.disconnect();
    this.stateCallbacks = [];
  }
}