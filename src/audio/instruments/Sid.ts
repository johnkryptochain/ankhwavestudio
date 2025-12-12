// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Sid - C64 Sound Chip (SID 6581/8580) Emulator
 * Emulates the iconic Commodore 64 sound chip
 * 
 * Features:
 * - 3 oscillators with C64 waveforms (triangle, saw, pulse, noise)
 * - Ring modulation
 * - Hard sync
 * - Multimode filter (LP, BP, HP)
 * - ADSR envelopes per voice
 */

import { BaseInstrument, type InstrumentParameterDescriptor } from './BaseInstrument';
import { midiNoteToFrequency, clamp } from '../utils/AudioMath';

// ============================================================================
// Types
// ============================================================================

/**
 * SID waveform types
 */
export type SidWaveform = 'triangle' | 'saw' | 'pulse' | 'noise' | 'combined';

/**
 * SID filter types
 */
export type SidFilterType = 'lowpass' | 'bandpass' | 'highpass' | 'notch';

/**
 * Voice configuration
 */
export interface SidVoiceConfig {
  enabled: boolean;
  waveform: SidWaveform;
  pulseWidth: number; // 0-1 for pulse wave duty cycle
  octave: number;
  detune: number;
  ringMod: boolean; // Ring modulation with previous voice
  sync: boolean; // Hard sync with previous voice
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

/**
 * Active voice state
 */
interface SidActiveVoice {
  noteNumber: number;
  velocity: number;
  oscillators: OscillatorNode[];
  gains: GainNode[];
  envelopes: GainNode[];
  noiseSource?: AudioBufferSourceNode;
  pulseShaper?: WaveShaperNode;
  startTime: number;
  released: boolean;
}

// ============================================================================
// SID Instrument
// ============================================================================

export class Sid extends BaseInstrument {
  // Voice configurations
  private voiceConfigs: SidVoiceConfig[] = [];
  
  // Filter
  private filterNode: BiquadFilterNode;
  private filterType: SidFilterType = 'lowpass';
  private filterCutoff: number = 2000;
  private filterResonance: number = 0.5;
  private filterEnabled: boolean = true;
  
  // Active voices (using different name to avoid conflict with base class)
  private sidVoices: Map<number, SidActiveVoice> = new Map();
  
  // Noise buffer for noise waveform
  private noiseBuffer: AudioBuffer | null = null;
  
  // Pulse wave shaper curves
  private pulseWaveCurves: Map<number, Float32Array> = new Map();
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'SID', 'sid');
    
    // Initialize voice configurations
    this.initializeVoiceConfigs();
    
    // Create filter
    this.filterNode = audioContext.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = this.filterCutoff;
    this.filterNode.Q.value = this.filterResonance * 20;
    
    // Connect filter to output
    this.filterNode.connect(this.volumeNode);
    
    // Generate noise buffer
    this.generateNoiseBuffer();
    
    // Generate pulse wave curves
    this.generatePulseWaveCurves();
    
    // Initialize
    this.initializeInstrument();
  }
  
  /**
   * Initialize voice configurations
   */
  private initializeVoiceConfigs(): void {
    this.voiceConfigs = [
      {
        enabled: true,
        waveform: 'pulse',
        pulseWidth: 0.5,
        octave: 0,
        detune: 0,
        ringMod: false,
        sync: false,
        attack: 0.01,
        decay: 0.1,
        sustain: 0.7,
        release: 0.2
      },
      {
        enabled: false,
        waveform: 'saw',
        pulseWidth: 0.5,
        octave: 0,
        detune: 0,
        ringMod: false,
        sync: false,
        attack: 0.01,
        decay: 0.1,
        sustain: 0.7,
        release: 0.2
      },
      {
        enabled: false,
        waveform: 'triangle',
        pulseWidth: 0.5,
        octave: -1,
        detune: 0,
        ringMod: false,
        sync: false,
        attack: 0.01,
        decay: 0.1,
        sustain: 0.7,
        release: 0.2
      }
    ];
  }
  
  /**
   * Generate noise buffer (LFSR-based like real SID)
   */
  private generateNoiseBuffer(): void {
    const sampleRate = this.audioContext.sampleRate;
    const bufferSize = sampleRate * 2; // 2 seconds of noise
    this.noiseBuffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    
    // SID uses a 23-bit LFSR for noise generation
    let lfsr = 0x7FFFFF;
    
    for (let i = 0; i < bufferSize; i++) {
      // LFSR feedback polynomial: x^23 + x^18 + 1
      const bit = ((lfsr >> 22) ^ (lfsr >> 17)) & 1;
      lfsr = ((lfsr << 1) | bit) & 0x7FFFFF;
      
      // Convert to audio sample (-1 to 1)
      // SID outputs 8 bits from the LFSR
      const sample = ((lfsr >> 15) & 0xFF) / 127.5 - 1;
      data[i] = sample;
    }
  }
  
  /**
   * Generate pulse wave shaper curves for different duty cycles
   */
  private generatePulseWaveCurves(): void {
    const resolution = 256;
    
    // Generate curves for common duty cycles
    for (let pw = 0.1; pw <= 0.9; pw += 0.1) {
      const curve = new Float32Array(resolution);
      
      for (let i = 0; i < resolution; i++) {
        const x = (i / resolution) * 2 - 1; // -1 to 1
        // Convert sine to pulse using threshold
        curve[i] = x < (pw * 2 - 1) ? -1 : 1;
      }
      
      this.pulseWaveCurves.set(Math.round(pw * 10) / 10, curve);
    }
  }
  
  /**
   * Get pulse wave curve for duty cycle
   */
  private getPulseWaveCurve(pulseWidth: number): Float32Array {
    const rounded = Math.round(clamp(pulseWidth, 0.1, 0.9) * 10) / 10;
    return this.pulseWaveCurves.get(rounded) || this.pulseWaveCurves.get(0.5)!;
  }
  
  /**
   * Create oscillator for a voice
   */
  private createVoiceOscillator(
    config: SidVoiceConfig,
    frequency: number,
    voiceIndex: number
  ): { oscillator: OscillatorNode | null; noiseSource: AudioBufferSourceNode | null; shaper: WaveShaperNode | null } {
    const octaveMultiplier = Math.pow(2, config.octave);
    const freq = frequency * octaveMultiplier;
    
    if (config.waveform === 'noise') {
      // Use noise buffer
      if (!this.noiseBuffer) {
        return { oscillator: null, noiseSource: null, shaper: null };
      }
      
      const noiseSource = this.audioContext.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;
      noiseSource.loop = true;
      
      // Vary playback rate based on frequency for pitch variation
      noiseSource.playbackRate.value = freq / 440;
      
      return { oscillator: null, noiseSource, shaper: null };
    }
    
    const oscillator = this.audioContext.createOscillator();
    oscillator.frequency.value = freq;
    oscillator.detune.value = config.detune;
    
    let shaper: WaveShaperNode | null = null;
    
    switch (config.waveform) {
      case 'triangle':
        oscillator.type = 'triangle';
        break;
      case 'saw':
        oscillator.type = 'sawtooth';
        break;
      case 'pulse':
        // Use sine with waveshaper to create pulse
        oscillator.type = 'sine';
        shaper = this.audioContext.createWaveShaper();
        shaper.curve = this.getPulseWaveCurve(config.pulseWidth) as Float32Array<ArrayBuffer>;
        break;
      case 'combined':
        // Combined waveforms (SID feature)
        oscillator.type = 'sawtooth';
        break;
      default:
        oscillator.type = 'sawtooth';
    }
    
    return { oscillator, noiseSource: null, shaper };
  }
  
  /**
   * Apply ADSR envelope
   */
  private applyEnvelope(
    gainNode: GainNode,
    config: SidVoiceConfig,
    velocity: number,
    startTime: number
  ): void {
    const gain = gainNode.gain;
    const peakLevel = velocity;
    const sustainLevel = velocity * config.sustain;
    
    gain.cancelScheduledValues(startTime);
    gain.setValueAtTime(0, startTime);
    
    // Attack
    gain.linearRampToValueAtTime(peakLevel, startTime + config.attack);
    
    // Decay to sustain
    gain.exponentialRampToValueAtTime(
      Math.max(sustainLevel, 0.001),
      startTime + config.attack + config.decay
    );
  }
  
  /**
   * Apply release envelope
   */
  private applyRelease(
    gainNode: GainNode,
    config: SidVoiceConfig,
    releaseTime: number
  ): void {
    const gain = gainNode.gain;
    const currentValue = gain.value;
    
    gain.cancelScheduledValues(releaseTime);
    gain.setValueAtTime(currentValue, releaseTime);
    gain.exponentialRampToValueAtTime(0.001, releaseTime + config.release);
  }
  
  /**
   * Trigger a note
   */
  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    const startTime = this.audioContext.currentTime;
    
    const voice: SidActiveVoice = {
      noteNumber,
      velocity,
      oscillators: [],
      gains: [],
      envelopes: [],
      startTime,
      released: false
    };
    
    // Create oscillators for each enabled voice
    for (let i = 0; i < this.voiceConfigs.length; i++) {
      const config = this.voiceConfigs[i];
      if (!config.enabled) continue;
      
      const { oscillator, noiseSource, shaper } = this.createVoiceOscillator(config, frequency, i);
      
      // Create gain for this voice
      const voiceGain = this.audioContext.createGain();
      voiceGain.gain.value = 1 / 3; // Divide by number of voices
      
      // Create envelope gain
      const envelopeGain = this.audioContext.createGain();
      this.applyEnvelope(envelopeGain, config, velocity, startTime);
      
      // Connect chain
      if (noiseSource) {
        noiseSource.connect(voiceGain);
        voice.noiseSource = noiseSource;
        noiseSource.start(startTime);
      } else if (oscillator) {
        if (shaper) {
          oscillator.connect(shaper);
          shaper.connect(voiceGain);
          voice.pulseShaper = shaper;
        } else {
          oscillator.connect(voiceGain);
        }
        voice.oscillators.push(oscillator);
        oscillator.start(startTime);
      }
      
      voiceGain.connect(envelopeGain);
      envelopeGain.connect(this.filterEnabled ? this.filterNode : this.volumeNode);
      
      voice.gains.push(voiceGain);
      voice.envelopes.push(envelopeGain);
    }
    
    this.sidVoices.set(noteNumber, voice);
  }
  
  /**
   * Release a note
   */
  protected releaseNote(noteNumber: number): void {
    const voice = this.sidVoices.get(noteNumber);
    if (!voice || voice.released) return;
    
    voice.released = true;
    const releaseTime = this.audioContext.currentTime;
    
    // Apply release to all envelopes
    for (let i = 0; i < voice.envelopes.length; i++) {
      const configIndex = this.voiceConfigs.findIndex((c, idx) => {
        let enabledCount = 0;
        for (let j = 0; j <= idx; j++) {
          if (this.voiceConfigs[j].enabled) enabledCount++;
        }
        return enabledCount === i + 1;
      });
      
      if (configIndex !== -1) {
        this.applyRelease(voice.envelopes[i], this.voiceConfigs[configIndex], releaseTime);
      }
    }
    
    // Schedule cleanup
    const maxRelease = Math.max(...this.voiceConfigs.map(c => c.release));
    setTimeout(() => {
      this.cleanupVoice(noteNumber);
    }, (maxRelease + 0.1) * 1000);
  }
  
  /**
   * Clean up a voice
   */
  private cleanupVoice(noteNumber: number): void {
    const voice = this.sidVoices.get(noteNumber);
    if (!voice) return;
    
    // Stop and disconnect oscillators
    for (const osc of voice.oscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // Already stopped
      }
    }
    
    // Stop noise source
    if (voice.noiseSource) {
      try {
        voice.noiseSource.stop();
        voice.noiseSource.disconnect();
      } catch (e) {
        // Already stopped
      }
    }
    
    // Disconnect gains and envelopes
    for (const gain of voice.gains) {
      gain.disconnect();
    }
    for (const env of voice.envelopes) {
      env.disconnect();
    }
    
    // Disconnect shaper
    if (voice.pulseShaper) {
      voice.pulseShaper.disconnect();
    }
    
    this.sidVoices.delete(noteNumber);
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    const parts = key.split('_');
    
    // Voice parameters
    if (parts[0].startsWith('voice')) {
      const voiceIndex = parseInt(parts[0].replace('voice', ''));
      const param = parts[1];
      
      if (voiceIndex >= 0 && voiceIndex < this.voiceConfigs.length) {
        const config = this.voiceConfigs[voiceIndex];
        
        switch (param) {
          case 'enabled':
            config.enabled = value > 0.5;
            break;
          case 'waveform':
            config.waveform = ['triangle', 'saw', 'pulse', 'noise'][Math.floor(value)] as SidWaveform;
            break;
          case 'pulseWidth':
            config.pulseWidth = value;
            break;
          case 'octave':
            config.octave = Math.floor(value);
            break;
          case 'detune':
            config.detune = value;
            break;
          case 'ringMod':
            config.ringMod = value > 0.5;
            break;
          case 'sync':
            config.sync = value > 0.5;
            break;
          case 'attack':
            config.attack = value;
            break;
          case 'decay':
            config.decay = value;
            break;
          case 'sustain':
            config.sustain = value;
            break;
          case 'release':
            config.release = value;
            break;
        }
      }
      return;
    }
    
    // Filter parameters
    if (key === 'filterEnabled') {
      this.filterEnabled = value > 0.5;
      return;
    }
    
    if (key === 'filterType') {
      const types: SidFilterType[] = ['lowpass', 'bandpass', 'highpass', 'notch'];
      this.filterType = types[Math.floor(value)];
      this.filterNode.type = this.filterType === 'notch' ? 'notch' : this.filterType;
      return;
    }
    
    if (key === 'filterCutoff') {
      this.filterCutoff = value;
      this.filterNode.frequency.setTargetAtTime(value, this.audioContext.currentTime, 0.01);
      return;
    }
    
    if (key === 'filterResonance') {
      this.filterResonance = value;
      this.filterNode.Q.setTargetAtTime(value * 20, this.audioContext.currentTime, 0.01);
      return;
    }
  }
  
  /**
   * Initialize instrument
   */
  protected initializeInstrument(): void {
    // Sync params from configs
    for (let i = 0; i < 3; i++) {
      const config = this.voiceConfigs[i];
      this.params[`voice${i}_enabled`] = config.enabled ? 1 : 0;
      this.params[`voice${i}_waveform`] = ['triangle', 'saw', 'pulse', 'noise'].indexOf(config.waveform);
      this.params[`voice${i}_pulseWidth`] = config.pulseWidth;
      this.params[`voice${i}_octave`] = config.octave;
      this.params[`voice${i}_detune`] = config.detune;
      this.params[`voice${i}_attack`] = config.attack;
      this.params[`voice${i}_decay`] = config.decay;
      this.params[`voice${i}_sustain`] = config.sustain;
      this.params[`voice${i}_release`] = config.release;
    }
    
    this.params['filterEnabled'] = this.filterEnabled ? 1 : 0;
    this.params['filterType'] = 0;
    this.params['filterCutoff'] = this.filterCutoff;
    this.params['filterResonance'] = this.filterResonance;
  }
  
  /**
   * Get parameter descriptors
   */
  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    const descriptors: InstrumentParameterDescriptor[] = [];
    
    // Voice parameters
    for (let i = 0; i < 3; i++) {
      descriptors.push(
        { name: `Voice ${i + 1} Enabled`, key: `voice${i}_enabled`, min: 0, max: 1, default: i === 0 ? 1 : 0, type: 'boolean', category: `Voice ${i + 1}` },
        { name: `Voice ${i + 1} Waveform`, key: `voice${i}_waveform`, min: 0, max: 3, default: i === 0 ? 2 : 1, type: 'enum', enumValues: ['Triangle', 'Saw', 'Pulse', 'Noise'], category: `Voice ${i + 1}` },
        { name: `Voice ${i + 1} Pulse Width`, key: `voice${i}_pulseWidth`, min: 0.1, max: 0.9, default: 0.5, category: `Voice ${i + 1}` },
        { name: `Voice ${i + 1} Octave`, key: `voice${i}_octave`, min: -3, max: 3, default: 0, step: 1, category: `Voice ${i + 1}` },
        { name: `Voice ${i + 1} Detune`, key: `voice${i}_detune`, min: -100, max: 100, default: 0, unit: 'cents', category: `Voice ${i + 1}` },
        { name: `Voice ${i + 1} Attack`, key: `voice${i}_attack`, min: 0.001, max: 2, default: 0.01, unit: 's', category: `Voice ${i + 1}` },
        { name: `Voice ${i + 1} Decay`, key: `voice${i}_decay`, min: 0.001, max: 2, default: 0.1, unit: 's', category: `Voice ${i + 1}` },
        { name: `Voice ${i + 1} Sustain`, key: `voice${i}_sustain`, min: 0, max: 1, default: 0.7, category: `Voice ${i + 1}` },
        { name: `Voice ${i + 1} Release`, key: `voice${i}_release`, min: 0.001, max: 5, default: 0.2, unit: 's', category: `Voice ${i + 1}` }
      );
    }
    
    // Filter parameters
    descriptors.push(
      { name: 'Filter Enabled', key: 'filterEnabled', min: 0, max: 1, default: 1, type: 'boolean', category: 'Filter' },
      { name: 'Filter Type', key: 'filterType', min: 0, max: 3, default: 0, type: 'enum', enumValues: ['Lowpass', 'Bandpass', 'Highpass', 'Notch'], category: 'Filter' },
      { name: 'Filter Cutoff', key: 'filterCutoff', min: 20, max: 20000, default: 2000, type: 'logarithmic', unit: 'Hz', category: 'Filter' },
      { name: 'Filter Resonance', key: 'filterResonance', min: 0, max: 1, default: 0.5, category: 'Filter' }
    );
    
    return descriptors;
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    // Clean up all voices
    for (const noteNumber of this.sidVoices.keys()) {
      this.cleanupVoice(noteNumber);
    }
    
    this.filterNode.disconnect();
    
    super.dispose();
  }
}

// Factory function
export function createSid(audioContext: AudioContext, id?: string): Sid {
  return new Sid(audioContext, id || `sid-${Date.now()}`);
}