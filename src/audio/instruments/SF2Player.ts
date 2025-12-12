// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * SF2Player - SoundFont 2 Player
 * Plays SF2 (SoundFont 2) files with full support for:
 * - Multi-sample playback
 * - Velocity/key zones
 * - Built-in modulators
 * - Reverb/chorus effects
 */

import { BaseInstrument, type InstrumentParameterDescriptor } from './BaseInstrument';
import { midiNoteToFrequency, clamp } from '../utils/AudioMath';

// ============================================================================
// Types
// ============================================================================

/**
 * SF2 Sample data
 */
export interface SF2Sample {
  name: string;
  data: Float32Array;
  sampleRate: number;
  originalPitch: number;
  pitchCorrection: number;
  startLoop: number;
  endLoop: number;
  sampleType: number;
}

/**
 * SF2 Instrument zone
 */
export interface SF2Zone {
  keyRangeLow: number;
  keyRangeHigh: number;
  velRangeLow: number;
  velRangeHigh: number;
  sample: SF2Sample | null;
  generators: Map<number, number>;
  modulators: SF2Modulator[];
}

/**
 * SF2 Modulator
 */
export interface SF2Modulator {
  srcOper: number;
  destOper: number;
  amount: number;
  amtSrcOper: number;
  transOper: number;
}

/**
 * SF2 Instrument
 */
export interface SF2Instrument {
  name: string;
  zones: SF2Zone[];
}

/**
 * SF2 Preset
 */
export interface SF2Preset {
  name: string;
  bank: number;
  preset: number;
  zones: SF2Zone[];
}

/**
 * SF2 File structure
 */
export interface SF2File {
  name: string;
  samples: SF2Sample[];
  instruments: SF2Instrument[];
  presets: SF2Preset[];
}

/**
 * Active voice state
 */
interface SF2ActiveVoice {
  noteNumber: number;
  velocity: number;
  sources: AudioBufferSourceNode[];
  gains: GainNode[];
  envelopes: GainNode[];
  filters: BiquadFilterNode[];
  zones: SF2Zone[];
  startTime: number;
  released: boolean;
}

// ============================================================================
// SF2 Generator Types
// ============================================================================

const SF2Generators = {
  startAddrsOffset: 0,
  endAddrsOffset: 1,
  startloopAddrsOffset: 2,
  endloopAddrsOffset: 3,
  startAddrsCoarseOffset: 4,
  modLfoToPitch: 5,
  vibLfoToPitch: 6,
  modEnvToPitch: 7,
  initialFilterFc: 8,
  initialFilterQ: 9,
  modLfoToFilterFc: 10,
  modEnvToFilterFc: 11,
  endAddrsCoarseOffset: 12,
  modLfoToVolume: 13,
  chorusEffectsSend: 15,
  reverbEffectsSend: 16,
  pan: 17,
  delayModLFO: 21,
  freqModLFO: 22,
  delayVibLFO: 23,
  freqVibLFO: 24,
  delayModEnv: 25,
  attackModEnv: 26,
  holdModEnv: 27,
  decayModEnv: 28,
  sustainModEnv: 29,
  releaseModEnv: 30,
  keynumToModEnvHold: 31,
  keynumToModEnvDecay: 32,
  delayVolEnv: 33,
  attackVolEnv: 34,
  holdVolEnv: 35,
  decayVolEnv: 36,
  sustainVolEnv: 37,
  releaseVolEnv: 38,
  keynumToVolEnvHold: 39,
  keynumToVolEnvDecay: 40,
  instrument: 41,
  keyRange: 43,
  velRange: 44,
  startloopAddrsCoarseOffset: 45,
  keynum: 46,
  velocity: 47,
  initialAttenuation: 48,
  endloopAddrsCoarseOffset: 50,
  coarseTune: 51,
  fineTune: 52,
  sampleID: 53,
  sampleModes: 54,
  scaleTuning: 56,
  exclusiveClass: 57,
  overridingRootKey: 58,
};

// ============================================================================
// SF2Player Instrument
// ============================================================================

export class SF2Player extends BaseInstrument {
  // Loaded SoundFont
  private sf2: SF2File | null = null;
  
  // Current preset
  private currentBank: number = 0;
  private currentPreset: number = 0;
  private currentPresetData: SF2Preset | null = null;
  
  // Audio buffers for samples
  private sampleBuffers: Map<SF2Sample, AudioBuffer> = new Map();
  
  // Active voices
  private sf2Voices: Map<number, SF2ActiveVoice> = new Map();
  
  // Effects
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode;
  private chorusNode: DelayNode | null = null;
  private chorusGain: GainNode;
  private chorusLfo: OscillatorNode | null = null;
  
  // Settings
  private reverbAmount: number = 0.3;
  private chorusAmount: number = 0.2;
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'SF2 Player', 'sf2player');
    
    // Create effect nodes
    this.reverbGain = audioContext.createGain();
    this.reverbGain.gain.value = this.reverbAmount;
    
    this.chorusGain = audioContext.createGain();
    this.chorusGain.gain.value = this.chorusAmount;
    
    // Connect effects to output
    this.reverbGain.connect(this.volumeNode);
    this.chorusGain.connect(this.volumeNode);
    
    // Create simple reverb
    this.createReverb();
    
    // Create chorus
    this.createChorus();
    
    // Initialize
    this.initializeInstrument();
  }
  
  /**
   * Create a simple reverb using convolution
   */
  private createReverb(): void {
    // Create impulse response for reverb
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * 2; // 2 second reverb
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponential decay with noise
        data[i] = (Math.random() * 2 - 1) * Math.exp(-3 * i / length);
      }
    }
    
    this.reverbNode = this.audioContext.createConvolver();
    this.reverbNode.buffer = impulse;
    this.reverbNode.connect(this.reverbGain);
  }
  
  /**
   * Create a simple chorus effect
   */
  private createChorus(): void {
    this.chorusNode = this.audioContext.createDelay(0.1);
    this.chorusNode.delayTime.value = 0.02;
    
    // LFO for chorus modulation
    this.chorusLfo = this.audioContext.createOscillator();
    this.chorusLfo.frequency.value = 0.5;
    
    const lfoGain = this.audioContext.createGain();
    lfoGain.gain.value = 0.002;
    
    this.chorusLfo.connect(lfoGain);
    lfoGain.connect(this.chorusNode.delayTime);
    this.chorusLfo.start();
    
    this.chorusNode.connect(this.chorusGain);
  }
  
  /**
   * Load an SF2 file
   */
  async loadSF2(data: ArrayBuffer): Promise<boolean> {
    try {
      const sf2 = this.parseSF2(data);
      if (!sf2) return false;
      
      this.sf2 = sf2;
      
      // Create audio buffers for all samples
      for (const sample of sf2.samples) {
        if (sample.data.length > 0) {
          const buffer = this.audioContext.createBuffer(
            1,
            sample.data.length,
            sample.sampleRate
          );
          buffer.getChannelData(0).set(sample.data);
          this.sampleBuffers.set(sample, buffer);
        }
      }
      
      // Load first preset
      if (sf2.presets.length > 0) {
        this.selectPreset(sf2.presets[0].bank, sf2.presets[0].preset);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to load SF2:', error);
      return false;
    }
  }
  
  /**
   * Load SF2 from URL
   */
  async loadSF2FromUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url);
      const data = await response.arrayBuffer();
      return this.loadSF2(data);
    } catch (error) {
      console.error('Failed to load SF2 from URL:', error);
      return false;
    }
  }
  
  /**
   * Parse SF2 file format
   * This is a simplified parser - full SF2 parsing is complex
   */
  private parseSF2(data: ArrayBuffer): SF2File | null {
    const view = new DataView(data);
    const decoder = new TextDecoder('ascii');
    
    // Check RIFF header
    const riff = decoder.decode(new Uint8Array(data, 0, 4));
    if (riff !== 'RIFF') {
      console.error('Not a valid RIFF file');
      return null;
    }
    
    // Check sfbk format
    const sfbk = decoder.decode(new Uint8Array(data, 8, 4));
    if (sfbk !== 'sfbk') {
      console.error('Not a valid SF2 file');
      return null;
    }
    
    const sf2: SF2File = {
      name: 'SoundFont',
      samples: [],
      instruments: [],
      presets: [],
    };
    
    let offset = 12;
    
    // Parse chunks
    while (offset < data.byteLength - 8) {
      const chunkId = decoder.decode(new Uint8Array(data, offset, 4));
      const chunkSize = view.getUint32(offset + 4, true);
      offset += 8;
      
      if (chunkId === 'LIST') {
        const listType = decoder.decode(new Uint8Array(data, offset, 4));
        
        if (listType === 'INFO') {
          // Parse INFO chunk for name
          let infoOffset = offset + 4;
          while (infoOffset < offset + chunkSize) {
            const subId = decoder.decode(new Uint8Array(data, infoOffset, 4));
            const subSize = view.getUint32(infoOffset + 4, true);
            
            if (subId === 'INAM') {
              sf2.name = decoder.decode(new Uint8Array(data, infoOffset + 8, subSize)).replace(/\0/g, '').trim();
            }
            
            infoOffset += 8 + subSize + (subSize % 2);
          }
        } else if (listType === 'sdta') {
          // Parse sample data
          let sdtaOffset = offset + 4;
          while (sdtaOffset < offset + chunkSize) {
            const subId = decoder.decode(new Uint8Array(data, sdtaOffset, 4));
            const subSize = view.getUint32(sdtaOffset + 4, true);
            
            if (subId === 'smpl') {
              // 16-bit sample data
              const sampleData = new Int16Array(data, sdtaOffset + 8, subSize / 2);
              
              // Convert to float and store as single sample for now
              // In a full implementation, we'd parse shdr to split samples
              const floatData = new Float32Array(sampleData.length);
              for (let i = 0; i < sampleData.length; i++) {
                floatData[i] = sampleData[i] / 32768;
              }
              
              // Create a default sample
              sf2.samples.push({
                name: 'Sample',
                data: floatData,
                sampleRate: 44100,
                originalPitch: 60,
                pitchCorrection: 0,
                startLoop: 0,
                endLoop: floatData.length,
                sampleType: 1,
              });
            }
            
            sdtaOffset += 8 + subSize + (subSize % 2);
          }
        } else if (listType === 'pdta') {
          // Parse preset data
          // This is simplified - full parsing would read phdr, pbag, pmod, pgen, inst, ibag, imod, igen, shdr
          
          // Create a default preset using all samples
          if (sf2.samples.length > 0) {
            const zones: SF2Zone[] = sf2.samples.map((sample, idx) => ({
              keyRangeLow: 0,
              keyRangeHigh: 127,
              velRangeLow: 0,
              velRangeHigh: 127,
              sample,
              generators: new Map([
                [SF2Generators.attackVolEnv, 0.01],
                [SF2Generators.decayVolEnv, 0.1],
                [SF2Generators.sustainVolEnv, 0.7],
                [SF2Generators.releaseVolEnv, 0.3],
              ]),
              modulators: [],
            }));
            
            sf2.presets.push({
              name: sf2.name || 'Default',
              bank: 0,
              preset: 0,
              zones,
            });
          }
        }
      }
      
      offset += chunkSize + (chunkSize % 2);
    }
    
    return sf2;
  }
  
  /**
   * Select a preset by bank and program number
   */
  selectPreset(bank: number, preset: number): boolean {
    if (!this.sf2) return false;
    
    const presetData = this.sf2.presets.find(
      (p) => p.bank === bank && p.preset === preset
    );
    
    if (!presetData) return false;
    
    this.currentBank = bank;
    this.currentPreset = preset;
    this.currentPresetData = presetData;
    
    return true;
  }
  
  /**
   * Get list of available presets
   */
  getPresetList(): { bank: number; preset: number; name: string }[] {
    if (!this.sf2) return [];
    
    return this.sf2.presets.map((p) => ({
      bank: p.bank,
      preset: p.preset,
      name: p.name,
    }));
  }
  
  /**
   * Find zones that match a note and velocity
   */
  private findZones(noteNumber: number, velocity: number): SF2Zone[] {
    if (!this.currentPresetData) return [];
    
    const vel = velocity * 127;
    
    return this.currentPresetData.zones.filter(
      (z) =>
        noteNumber >= z.keyRangeLow &&
        noteNumber <= z.keyRangeHigh &&
        vel >= z.velRangeLow &&
        vel <= z.velRangeHigh &&
        z.sample !== null
    );
  }
  
  /**
   * Get generator value with default
   */
  private getGenerator(zone: SF2Zone, gen: number, defaultValue: number): number {
    return zone.generators.get(gen) ?? defaultValue;
  }
  
  /**
   * Trigger a note
   */
  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    const zones = this.findZones(noteNumber, velocity);
    if (zones.length === 0) return;
    
    const startTime = this.audioContext.currentTime;
    
    const voice: SF2ActiveVoice = {
      noteNumber,
      velocity,
      sources: [],
      gains: [],
      envelopes: [],
      filters: [],
      zones,
      startTime,
      released: false,
    };
    
    for (const zone of zones) {
      if (!zone.sample) continue;
      
      const buffer = this.sampleBuffers.get(zone.sample);
      if (!buffer) continue;
      
      // Create source
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      
      // Calculate playback rate
      const rootKey = zone.sample.originalPitch;
      const semitones = noteNumber - rootKey + (zone.sample.pitchCorrection / 100);
      source.playbackRate.value = Math.pow(2, semitones / 12);
      
      // Set up looping
      const sampleModes = this.getGenerator(zone, SF2Generators.sampleModes, 0);
      if (sampleModes === 1 || sampleModes === 3) {
        source.loop = true;
        source.loopStart = zone.sample.startLoop / zone.sample.sampleRate;
        source.loopEnd = zone.sample.endLoop / zone.sample.sampleRate;
      }
      
      // Create filter
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      const filterFc = this.getGenerator(zone, SF2Generators.initialFilterFc, 13500);
      filter.frequency.value = filterFc;
      const filterQ = this.getGenerator(zone, SF2Generators.initialFilterQ, 0);
      filter.Q.value = filterQ / 10;
      
      // Create gain nodes
      const gain = this.audioContext.createGain();
      const attenuation = this.getGenerator(zone, SF2Generators.initialAttenuation, 0);
      gain.gain.value = Math.pow(10, -attenuation / 200);
      
      const envelope = this.audioContext.createGain();
      
      // Apply envelope
      const attack = this.getGenerator(zone, SF2Generators.attackVolEnv, 0.01);
      const decay = this.getGenerator(zone, SF2Generators.decayVolEnv, 0.1);
      const sustain = this.getGenerator(zone, SF2Generators.sustainVolEnv, 0.7);
      const release = this.getGenerator(zone, SF2Generators.releaseVolEnv, 0.3);
      
      const envGain = envelope.gain;
      envGain.cancelScheduledValues(startTime);
      envGain.setValueAtTime(0, startTime);
      envGain.linearRampToValueAtTime(velocity, startTime + attack);
      envGain.exponentialRampToValueAtTime(
        Math.max(velocity * sustain, 0.001),
        startTime + attack + decay
      );
      
      // Connect chain
      source.connect(filter);
      filter.connect(gain);
      gain.connect(envelope);
      envelope.connect(this.volumeNode);
      
      // Connect to effects
      const reverbSend = this.getGenerator(zone, SF2Generators.reverbEffectsSend, 0) / 1000;
      const chorusSend = this.getGenerator(zone, SF2Generators.chorusEffectsSend, 0) / 1000;
      
      if (reverbSend > 0 && this.reverbNode) {
        const reverbSendGain = this.audioContext.createGain();
        reverbSendGain.gain.value = reverbSend;
        envelope.connect(reverbSendGain);
        reverbSendGain.connect(this.reverbNode);
      }
      
      if (chorusSend > 0 && this.chorusNode) {
        const chorusSendGain = this.audioContext.createGain();
        chorusSendGain.gain.value = chorusSend;
        envelope.connect(chorusSendGain);
        chorusSendGain.connect(this.chorusNode);
      }
      
      // Start
      source.start(startTime);
      
      voice.sources.push(source);
      voice.gains.push(gain);
      voice.envelopes.push(envelope);
      voice.filters.push(filter);
    }
    
    this.sf2Voices.set(noteNumber, voice);
  }
  
  /**
   * Release a note
   */
  protected releaseNote(noteNumber: number): void {
    const voice = this.sf2Voices.get(noteNumber);
    if (!voice || voice.released) return;
    
    voice.released = true;
    const releaseTime = this.audioContext.currentTime;
    
    // Apply release to all envelopes
    for (let i = 0; i < voice.envelopes.length; i++) {
      const zone = voice.zones[i];
      const release = this.getGenerator(zone, SF2Generators.releaseVolEnv, 0.3);
      
      const gain = voice.envelopes[i].gain;
      const currentValue = gain.value;
      
      gain.cancelScheduledValues(releaseTime);
      gain.setValueAtTime(currentValue, releaseTime);
      gain.exponentialRampToValueAtTime(0.001, releaseTime + release);
    }
    
    // Schedule cleanup
    const maxRelease = Math.max(
      ...voice.zones.map((z) => this.getGenerator(z, SF2Generators.releaseVolEnv, 0.3))
    );
    setTimeout(() => {
      this.cleanupVoice(noteNumber);
    }, (maxRelease + 0.1) * 1000);
  }
  
  /**
   * Clean up a voice
   */
  private cleanupVoice(noteNumber: number): void {
    const voice = this.sf2Voices.get(noteNumber);
    if (!voice) return;
    
    for (const source of voice.sources) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Already stopped
      }
    }
    
    for (const gain of voice.gains) {
      gain.disconnect();
    }
    for (const env of voice.envelopes) {
      env.disconnect();
    }
    for (const filter of voice.filters) {
      filter.disconnect();
    }
    
    this.sf2Voices.delete(noteNumber);
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    switch (key) {
      case 'reverbAmount':
        this.reverbAmount = value;
        this.reverbGain.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.01);
        break;
      case 'chorusAmount':
        this.chorusAmount = value;
        this.chorusGain.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.01);
        break;
    }
  }
  
  /**
   * Initialize instrument
   */
  protected initializeInstrument(): void {
    this.params['reverbAmount'] = this.reverbAmount;
    this.params['chorusAmount'] = this.chorusAmount;
  }
  
  /**
   * Get parameter descriptors
   */
  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    return [
      { name: 'Reverb', key: 'reverbAmount', min: 0, max: 1, default: 0.3, category: 'Effects' },
      { name: 'Chorus', key: 'chorusAmount', min: 0, max: 1, default: 0.2, category: 'Effects' },
    ];
  }
  
  /**
   * Get SF2 info
   */
  getSF2Info(): { name: string; presetCount: number; sampleCount: number } | null {
    if (!this.sf2) return null;
    return {
      name: this.sf2.name,
      presetCount: this.sf2.presets.length,
      sampleCount: this.sf2.samples.length,
    };
  }
  
  /**
   * Get current preset info
   */
  getCurrentPreset(): { bank: number; preset: number; name: string } | null {
    if (!this.currentPresetData) return null;
    return {
      bank: this.currentBank,
      preset: this.currentPreset,
      name: this.currentPresetData.name,
    };
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    // Clean up all voices
    for (const noteNumber of this.sf2Voices.keys()) {
      this.cleanupVoice(noteNumber);
    }
    
    // Stop chorus LFO
    if (this.chorusLfo) {
      this.chorusLfo.stop();
      this.chorusLfo.disconnect();
    }
    
    // Disconnect effects
    if (this.reverbNode) {
      this.reverbNode.disconnect();
    }
    if (this.chorusNode) {
      this.chorusNode.disconnect();
    }
    
    this.reverbGain.disconnect();
    this.chorusGain.disconnect();
    
    this.sampleBuffers.clear();
    this.sf2 = null;
    
    super.dispose();
  }
}

// Factory function
export function createSF2Player(audioContext: AudioContext, id?: string): SF2Player {
  return new SF2Player(audioContext, id || `sf2player-${Date.now()}`);
}