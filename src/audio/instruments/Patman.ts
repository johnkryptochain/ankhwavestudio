// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Patman - GUS/PAT Patch File Player
 * Plays Gravis Ultrasound patch files
 * 
 * Features:
 * - Load GUS/PAT patch files
 * - Multi-sample support
 * - Velocity layers
 * - Loop points
 * - Sample interpolation
 */

import { BaseInstrument, type InstrumentParameterDescriptor } from './BaseInstrument';
import { midiNoteToFrequency, clamp } from '../utils/AudioMath';

// ============================================================================
// Types
// ============================================================================

/**
 * GUS Patch sample data
 */
export interface PatSample {
  name: string;
  data: Float32Array;
  sampleRate: number;
  rootKey: number; // MIDI note number for original pitch
  lowKey: number;
  highKey: number;
  lowVelocity: number;
  highVelocity: number;
  loopStart: number;
  loopEnd: number;
  loopMode: 'none' | 'forward' | 'pingpong';
  volume: number;
  pan: number;
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
}

/**
 * GUS Patch file structure
 */
export interface PatPatch {
  name: string;
  samples: PatSample[];
  volume: number;
}

/**
 * Active voice state
 */
interface PatmanActiveVoice {
  noteNumber: number;
  velocity: number;
  source: AudioBufferSourceNode;
  gain: GainNode;
  envelope: GainNode;
  sample: PatSample;
  startTime: number;
  released: boolean;
}

// ============================================================================
// Patman Instrument
// ============================================================================

export class Patman extends BaseInstrument {
  // Loaded patch
  private patch: PatPatch | null = null;
  
  // Audio buffers for samples
  private sampleBuffers: Map<PatSample, AudioBuffer> = new Map();
  
  // Active voices
  private patmanVoices: Map<number, PatmanActiveVoice> = new Map();
  
  // Tuning
  private tuning: number = 0; // cents
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'Patman', 'patman');
    
    // Initialize
    this.initializeInstrument();
  }
  
  /**
   * Load a PAT patch file
   */
  async loadPatch(data: ArrayBuffer): Promise<boolean> {
    try {
      const patch = this.parsePatchFile(data);
      if (!patch) return false;
      
      this.patch = patch;
      
      // Create audio buffers for all samples
      for (const sample of patch.samples) {
        const buffer = this.audioContext.createBuffer(
          1,
          sample.data.length,
          sample.sampleRate
        );
        buffer.getChannelData(0).set(sample.data);
        this.sampleBuffers.set(sample, buffer);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to load patch:', error);
      return false;
    }
  }
  
  /**
   * Load patch from URL
   */
  async loadPatchFromUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url);
      const data = await response.arrayBuffer();
      return this.loadPatch(data);
    } catch (error) {
      console.error('Failed to load patch from URL:', error);
      return false;
    }
  }
  
  /**
   * Parse GUS PAT file format
   * This is a simplified parser - real PAT files have more complex structure
   */
  private parsePatchFile(data: ArrayBuffer): PatPatch | null {
    const view = new DataView(data);
    const decoder = new TextDecoder('ascii');
    
    // Check magic number "GF1PATCH110"
    const magic = decoder.decode(new Uint8Array(data, 0, 12));
    if (!magic.startsWith('GF1PATCH')) {
      // Try to parse as raw audio data
      return this.parseRawAudio(data);
    }
    
    try {
      let offset = 12;
      
      // Read header
      const gravisId = decoder.decode(new Uint8Array(data, offset, 10));
      offset += 10;
      
      // Patch name
      const patchName = decoder.decode(new Uint8Array(data, offset, 64)).replace(/\0/g, '').trim();
      offset += 64;
      
      // Skip some header bytes
      offset += 2; // size
      offset += 1; // layers
      offset += 40; // reserved
      
      // Number of instruments
      const numInstruments = view.getUint8(offset);
      offset += 1;
      
      // Voices
      const voices = view.getUint8(offset);
      offset += 1;
      
      // Channels
      const channels = view.getUint8(offset);
      offset += 1;
      
      // Number of waveforms
      const numWaveforms = view.getUint16(offset, true);
      offset += 2;
      
      // Master volume
      const masterVolume = view.getUint16(offset, true) / 32768;
      offset += 2;
      
      // Skip more header
      offset += 36;
      
      // Read instrument header
      offset += 63; // instrument name
      offset += 1; // instrument number
      
      const numLayers = view.getUint8(offset);
      offset += 1;
      
      offset += 40; // reserved
      
      // Read layer header
      offset += 1; // previous
      offset += 1; // id
      
      const numSamples = view.getUint32(offset, true);
      offset += 4;
      
      offset += 40; // reserved
      
      const samples: PatSample[] = [];
      
      // Read samples
      for (let i = 0; i < numSamples && i < 128; i++) {
        // Wave name
        const waveName = decoder.decode(new Uint8Array(data, offset, 7)).replace(/\0/g, '').trim();
        offset += 7;
        
        // Fractions
        offset += 1;
        
        // Data size
        const dataSize = view.getUint32(offset, true);
        offset += 4;
        
        // Loop start
        const loopStart = view.getUint32(offset, true);
        offset += 4;
        
        // Loop end
        const loopEnd = view.getUint32(offset, true);
        offset += 4;
        
        // Sample rate
        const sampleRate = view.getUint16(offset, true);
        offset += 2;
        
        // Low frequency
        offset += 4;
        
        // High frequency
        offset += 4;
        
        // Root frequency
        const rootFreq = view.getUint32(offset, true);
        offset += 4;
        
        // Tune
        offset += 2;
        
        // Pan
        const pan = (view.getUint8(offset) - 7) / 7;
        offset += 1;
        
        // Envelope rates
        const envRates = new Uint8Array(data, offset, 6);
        offset += 6;
        
        // Envelope offsets
        const envOffsets = new Uint8Array(data, offset, 6);
        offset += 6;
        
        // Tremolo
        offset += 3;
        
        // Vibrato
        offset += 3;
        
        // Modes
        const modes = view.getUint8(offset);
        offset += 1;
        
        // Scale frequency
        offset += 2;
        
        // Scale factor
        offset += 2;
        
        // Reserved
        offset += 36;
        
        // Read sample data
        const sampleData = new Float32Array(dataSize);
        const is16bit = (modes & 0x01) !== 0;
        const isUnsigned = (modes & 0x02) === 0;
        const isLooping = (modes & 0x04) !== 0;
        const isPingPong = (modes & 0x08) !== 0;
        
        if (is16bit) {
          for (let j = 0; j < dataSize / 2; j++) {
            let sample = view.getInt16(offset + j * 2, true);
            if (isUnsigned) sample -= 32768;
            sampleData[j] = sample / 32768;
          }
          offset += dataSize;
        } else {
          for (let j = 0; j < dataSize; j++) {
            let sample = view.getUint8(offset + j);
            if (!isUnsigned) sample = (sample + 128) & 0xFF;
            sampleData[j] = (sample - 128) / 128;
          }
          offset += dataSize;
        }
        
        // Convert root frequency to MIDI note
        const rootKey = Math.round(12 * Math.log2(rootFreq / 440) + 69);
        
        samples.push({
          name: waveName || `Sample ${i + 1}`,
          data: sampleData,
          sampleRate: sampleRate || 44100,
          rootKey: clamp(rootKey, 0, 127),
          lowKey: 0,
          highKey: 127,
          lowVelocity: 0,
          highVelocity: 127,
          loopStart: is16bit ? loopStart / 2 : loopStart,
          loopEnd: is16bit ? loopEnd / 2 : loopEnd,
          loopMode: isLooping ? (isPingPong ? 'pingpong' : 'forward') : 'none',
          volume: 1,
          pan,
          envelope: {
            attack: envRates[0] / 63 * 2,
            decay: envRates[1] / 63 * 2,
            sustain: envOffsets[2] / 255,
            release: envRates[3] / 63 * 2,
          },
        });
      }
      
      return {
        name: patchName || 'Untitled Patch',
        samples,
        volume: masterVolume,
      };
    } catch (error) {
      console.error('Error parsing PAT file:', error);
      return null;
    }
  }
  
  /**
   * Parse raw audio data as a simple patch
   */
  private parseRawAudio(data: ArrayBuffer): PatPatch | null {
    // Try to decode as standard audio format
    return new Promise((resolve) => {
      this.audioContext.decodeAudioData(data)
        .then((buffer) => {
          const sampleData = buffer.getChannelData(0);
          
          const sample: PatSample = {
            name: 'Sample',
            data: sampleData,
            sampleRate: buffer.sampleRate,
            rootKey: 60, // Middle C
            lowKey: 0,
            highKey: 127,
            lowVelocity: 0,
            highVelocity: 127,
            loopStart: 0,
            loopEnd: sampleData.length,
            loopMode: 'none',
            volume: 1,
            pan: 0,
            envelope: {
              attack: 0.01,
              decay: 0.1,
              sustain: 0.8,
              release: 0.3,
            },
          };
          
          resolve({
            name: 'Audio Sample',
            samples: [sample],
            volume: 1,
          });
        })
        .catch(() => resolve(null));
    }) as unknown as PatPatch | null;
  }
  
  /**
   * Find the best sample for a note and velocity
   */
  private findSample(noteNumber: number, velocity: number): PatSample | null {
    if (!this.patch) return null;
    
    const vel = velocity * 127;
    
    // Find samples that match the note and velocity range
    const matches = this.patch.samples.filter(
      (s) =>
        noteNumber >= s.lowKey &&
        noteNumber <= s.highKey &&
        vel >= s.lowVelocity &&
        vel <= s.highVelocity
    );
    
    if (matches.length === 0) {
      // Fall back to any sample
      return this.patch.samples[0] || null;
    }
    
    // Return the sample with the closest root key
    return matches.reduce((best, current) =>
      Math.abs(current.rootKey - noteNumber) < Math.abs(best.rootKey - noteNumber)
        ? current
        : best
    );
  }
  
  /**
   * Trigger a note
   */
  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    const sample = this.findSample(noteNumber, velocity);
    if (!sample) return;
    
    const buffer = this.sampleBuffers.get(sample);
    if (!buffer) return;
    
    const startTime = this.audioContext.currentTime;
    
    // Create source
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    
    // Calculate playback rate for pitch shifting
    const semitones = noteNumber - sample.rootKey + this.tuning / 100;
    source.playbackRate.value = Math.pow(2, semitones / 12);
    
    // Set up looping
    if (sample.loopMode !== 'none' && sample.loopEnd > sample.loopStart) {
      source.loop = true;
      source.loopStart = sample.loopStart / sample.sampleRate;
      source.loopEnd = sample.loopEnd / sample.sampleRate;
    }
    
    // Create gain nodes
    const gain = this.audioContext.createGain();
    gain.gain.value = sample.volume * (this.patch?.volume || 1);
    
    const envelope = this.audioContext.createGain();
    this.applyEnvelope(envelope, sample.envelope, velocity, startTime);
    
    // Connect
    source.connect(gain);
    gain.connect(envelope);
    envelope.connect(this.volumeNode);
    
    // Start
    source.start(startTime);
    
    const voice: PatmanActiveVoice = {
      noteNumber,
      velocity,
      source,
      gain,
      envelope,
      sample,
      startTime,
      released: false,
    };
    
    this.patmanVoices.set(noteNumber, voice);
  }
  
  /**
   * Apply ADSR envelope
   */
  private applyEnvelope(
    gainNode: GainNode,
    env: PatSample['envelope'],
    velocity: number,
    startTime: number
  ): void {
    const gain = gainNode.gain;
    const peakLevel = velocity;
    const sustainLevel = velocity * env.sustain;
    
    gain.cancelScheduledValues(startTime);
    gain.setValueAtTime(0, startTime);
    
    // Attack
    gain.linearRampToValueAtTime(peakLevel, startTime + env.attack);
    
    // Decay to sustain
    gain.exponentialRampToValueAtTime(
      Math.max(sustainLevel, 0.001),
      startTime + env.attack + env.decay
    );
  }
  
  /**
   * Release a note
   */
  protected releaseNote(noteNumber: number): void {
    const voice = this.patmanVoices.get(noteNumber);
    if (!voice || voice.released) return;
    
    voice.released = true;
    const releaseTime = this.audioContext.currentTime;
    const release = voice.sample.envelope.release;
    
    // Apply release
    const gain = voice.envelope.gain;
    const currentValue = gain.value;
    
    gain.cancelScheduledValues(releaseTime);
    gain.setValueAtTime(currentValue, releaseTime);
    gain.exponentialRampToValueAtTime(0.001, releaseTime + release);
    
    // Schedule cleanup
    setTimeout(() => {
      this.cleanupVoice(noteNumber);
    }, (release + 0.1) * 1000);
  }
  
  /**
   * Clean up a voice
   */
  private cleanupVoice(noteNumber: number): void {
    const voice = this.patmanVoices.get(noteNumber);
    if (!voice) return;
    
    try {
      voice.source.stop();
      voice.source.disconnect();
    } catch (e) {
      // Already stopped
    }
    
    voice.gain.disconnect();
    voice.envelope.disconnect();
    
    this.patmanVoices.delete(noteNumber);
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    switch (key) {
      case 'tuning':
        this.tuning = value;
        break;
    }
  }
  
  /**
   * Initialize instrument
   */
  protected initializeInstrument(): void {
    this.params['tuning'] = this.tuning;
  }
  
  /**
   * Get parameter descriptors
   */
  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    return [
      { name: 'Tuning', key: 'tuning', min: -100, max: 100, default: 0, unit: 'cents', category: 'Global' },
    ];
  }
  
  /**
   * Get loaded patch info
   */
  getPatchInfo(): { name: string; sampleCount: number } | null {
    if (!this.patch) return null;
    return {
      name: this.patch.name,
      sampleCount: this.patch.samples.length,
    };
  }
  
  /**
   * Get sample list
   */
  getSamples(): { name: string; rootKey: number; loopMode: string }[] {
    if (!this.patch) return [];
    return this.patch.samples.map((s) => ({
      name: s.name,
      rootKey: s.rootKey,
      loopMode: s.loopMode,
    }));
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    // Clean up all voices
    for (const noteNumber of this.patmanVoices.keys()) {
      this.cleanupVoice(noteNumber);
    }
    
    this.sampleBuffers.clear();
    this.patch = null;
    
    super.dispose();
  }
}

// Factory function
export function createPatman(audioContext: AudioContext, id?: string): Patman {
  return new Patman(audioContext, id || `patman-${Date.now()}`);
}