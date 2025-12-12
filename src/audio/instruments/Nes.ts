// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Nes - NES APU (Audio Processing Unit) Emulator
 * Emulates the Nintendo Entertainment System sound chip
 * 
 * Features:
 * - 2 pulse channels with duty cycle control
 * - 1 triangle channel
 * - 1 noise channel
 * - DPCM channel (sample playback)
 * - Authentic NES sound characteristics
 */

import { BaseInstrument, type InstrumentParameterDescriptor } from './BaseInstrument';
import { midiNoteToFrequency, clamp } from '../utils/AudioMath';

// ============================================================================
// Types
// ============================================================================

/**
 * NES channel types
 */
export type NesChannel = 'pulse1' | 'pulse2' | 'triangle' | 'noise';

/**
 * Pulse duty cycle options (NES has 4 duty cycles)
 */
export type NesDutyCycle = 0 | 1 | 2 | 3; // 12.5%, 25%, 50%, 75%

/**
 * Noise mode (short or long period)
 */
export type NesNoiseMode = 'long' | 'short';

/**
 * Channel configuration
 */
export interface NesChannelConfig {
  enabled: boolean;
  volume: number;
  // Pulse specific
  dutyCycle?: NesDutyCycle;
  // Noise specific
  noiseMode?: NesNoiseMode;
  noisePeriod?: number;
  // Envelope
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  // Pitch
  octave: number;
  detune: number;
}

/**
 * Active voice state
 */
interface NesActiveVoice {
  noteNumber: number;
  velocity: number;
  oscillators: OscillatorNode[];
  gains: GainNode[];
  envelopes: GainNode[];
  noiseSource?: AudioBufferSourceNode;
  startTime: number;
  released: boolean;
}

// ============================================================================
// NES Instrument
// ============================================================================

export class Nes extends BaseInstrument {
  // Channel configurations
  private channelConfigs: Map<NesChannel, NesChannelConfig> = new Map();
  
  // Active voices
  private nesVoices: Map<number, NesActiveVoice> = new Map();
  
  // Noise buffers (long and short period)
  private longNoiseBuffer: AudioBuffer | null = null;
  private shortNoiseBuffer: AudioBuffer | null = null;
  
  // Pulse wave periodic waves for different duty cycles
  private pulseWaves: Map<NesDutyCycle, PeriodicWave> = new Map();
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'NES', 'nes');
    
    // Initialize channel configurations
    this.initializeChannelConfigs();
    
    // Generate noise buffers
    this.generateNoiseBuffers();
    
    // Generate pulse waves
    this.generatePulseWaves();
    
    // Initialize
    this.initializeInstrument();
  }
  
  /**
   * Initialize channel configurations
   */
  private initializeChannelConfigs(): void {
    // Pulse 1
    this.channelConfigs.set('pulse1', {
      enabled: true,
      volume: 0.8,
      dutyCycle: 2, // 50%
      attack: 0.01,
      decay: 0.1,
      sustain: 0.7,
      release: 0.2,
      octave: 0,
      detune: 0,
    });
    
    // Pulse 2
    this.channelConfigs.set('pulse2', {
      enabled: false,
      volume: 0.8,
      dutyCycle: 1, // 25%
      attack: 0.01,
      decay: 0.1,
      sustain: 0.7,
      release: 0.2,
      octave: 0,
      detune: 0,
    });
    
    // Triangle
    this.channelConfigs.set('triangle', {
      enabled: false,
      volume: 0.8,
      attack: 0.001,
      decay: 0,
      sustain: 1,
      release: 0.1,
      octave: -1,
      detune: 0,
    });
    
    // Noise
    this.channelConfigs.set('noise', {
      enabled: false,
      volume: 0.5,
      noiseMode: 'long',
      noisePeriod: 8,
      attack: 0.01,
      decay: 0.1,
      sustain: 0.5,
      release: 0.2,
      octave: 0,
      detune: 0,
    });
  }
  
  /**
   * Generate NES-style noise buffers using LFSR
   */
  private generateNoiseBuffers(): void {
    const sampleRate = this.audioContext.sampleRate;
    const bufferSize = sampleRate * 2;
    
    // Long period noise (15-bit LFSR, taps at bits 0 and 1)
    this.longNoiseBuffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
    const longData = this.longNoiseBuffer.getChannelData(0);
    let lfsr = 0x7FFF;
    
    for (let i = 0; i < bufferSize; i++) {
      // NES LFSR: feedback = bit0 XOR bit1
      const feedback = (lfsr & 1) ^ ((lfsr >> 1) & 1);
      lfsr = (lfsr >> 1) | (feedback << 14);
      longData[i] = (lfsr & 1) ? 1 : -1;
    }
    
    // Short period noise (15-bit LFSR, taps at bits 0 and 6)
    this.shortNoiseBuffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
    const shortData = this.shortNoiseBuffer.getChannelData(0);
    lfsr = 0x7FFF;
    
    for (let i = 0; i < bufferSize; i++) {
      // Short mode: feedback = bit0 XOR bit6
      const feedback = (lfsr & 1) ^ ((lfsr >> 6) & 1);
      lfsr = (lfsr >> 1) | (feedback << 14);
      shortData[i] = (lfsr & 1) ? 1 : -1;
    }
  }
  
  /**
   * Generate NES pulse waves with different duty cycles
   */
  private generatePulseWaves(): void {
    const harmonics = 32;
    
    // Duty cycle patterns: 12.5%, 25%, 50%, 75%
    const dutyPatterns: Record<NesDutyCycle, number[]> = {
      0: [0, 1, 0, 0, 0, 0, 0, 0], // 12.5%
      1: [0, 1, 1, 0, 0, 0, 0, 0], // 25%
      2: [0, 1, 1, 1, 1, 0, 0, 0], // 50%
      3: [0, 1, 1, 1, 1, 1, 1, 0], // 75%
    };
    
    for (const [duty, pattern] of Object.entries(dutyPatterns)) {
      const real = new Float32Array(harmonics);
      const imag = new Float32Array(harmonics);
      
      // Calculate Fourier coefficients for the duty cycle
      for (let n = 1; n < harmonics; n++) {
        let sum = 0;
        for (let k = 0; k < 8; k++) {
          sum += pattern[k] * Math.sin(2 * Math.PI * n * k / 8);
        }
        imag[n] = sum / 4;
      }
      
      const wave = this.audioContext.createPeriodicWave(real, imag, { disableNormalization: false });
      this.pulseWaves.set(parseInt(duty) as NesDutyCycle, wave);
    }
  }
  
  /**
   * Create oscillator for a channel
   */
  private createChannelOscillator(
    channel: NesChannel,
    frequency: number
  ): { oscillator: OscillatorNode | null; noiseSource: AudioBufferSourceNode | null } {
    const config = this.channelConfigs.get(channel)!;
    const octaveMultiplier = Math.pow(2, config.octave);
    const freq = frequency * octaveMultiplier;
    
    if (channel === 'noise') {
      const buffer = config.noiseMode === 'short' ? this.shortNoiseBuffer : this.longNoiseBuffer;
      if (!buffer) {
        return { oscillator: null, noiseSource: null };
      }
      
      const noiseSource = this.audioContext.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;
      
      // NES noise period affects playback rate
      // Period values 0-15 map to different frequencies
      const periodMultiplier = Math.pow(2, (config.noisePeriod || 8) / 4 - 2);
      noiseSource.playbackRate.value = periodMultiplier;
      
      return { oscillator: null, noiseSource };
    }
    
    const oscillator = this.audioContext.createOscillator();
    oscillator.frequency.value = freq;
    oscillator.detune.value = config.detune;
    
    if (channel === 'triangle') {
      oscillator.type = 'triangle';
    } else {
      // Pulse channels use custom periodic waves
      const dutyCycle = config.dutyCycle ?? 2;
      const wave = this.pulseWaves.get(dutyCycle);
      if (wave) {
        oscillator.setPeriodicWave(wave);
      } else {
        oscillator.type = 'square';
      }
    }
    
    return { oscillator, noiseSource: null };
  }
  
  /**
   * Apply ADSR envelope
   */
  private applyEnvelope(
    gainNode: GainNode,
    config: NesChannelConfig,
    velocity: number,
    startTime: number
  ): void {
    const gain = gainNode.gain;
    const peakLevel = velocity * config.volume;
    const sustainLevel = peakLevel * config.sustain;
    
    gain.cancelScheduledValues(startTime);
    gain.setValueAtTime(0, startTime);
    
    // Attack
    gain.linearRampToValueAtTime(peakLevel, startTime + config.attack);
    
    // Decay to sustain
    if (config.decay > 0) {
      gain.exponentialRampToValueAtTime(
        Math.max(sustainLevel, 0.001),
        startTime + config.attack + config.decay
      );
    }
  }
  
  /**
   * Apply release envelope
   */
  private applyRelease(
    gainNode: GainNode,
    config: NesChannelConfig,
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
    
    const voice: NesActiveVoice = {
      noteNumber,
      velocity,
      oscillators: [],
      gains: [],
      envelopes: [],
      startTime,
      released: false,
    };
    
    const channels: NesChannel[] = ['pulse1', 'pulse2', 'triangle', 'noise'];
    
    for (const channel of channels) {
      const config = this.channelConfigs.get(channel)!;
      if (!config.enabled) continue;
      
      const { oscillator, noiseSource } = this.createChannelOscillator(channel, frequency);
      
      // Create gain for this channel
      const channelGain = this.audioContext.createGain();
      channelGain.gain.value = 1 / 4; // Divide by number of channels
      
      // Create envelope gain
      const envelopeGain = this.audioContext.createGain();
      this.applyEnvelope(envelopeGain, config, velocity, startTime);
      
      // Connect chain
      if (noiseSource) {
        noiseSource.connect(channelGain);
        voice.noiseSource = noiseSource;
        noiseSource.start(startTime);
      } else if (oscillator) {
        oscillator.connect(channelGain);
        voice.oscillators.push(oscillator);
        oscillator.start(startTime);
      }
      
      channelGain.connect(envelopeGain);
      envelopeGain.connect(this.volumeNode);
      
      voice.gains.push(channelGain);
      voice.envelopes.push(envelopeGain);
    }
    
    this.nesVoices.set(noteNumber, voice);
  }
  
  /**
   * Release a note
   */
  protected releaseNote(noteNumber: number): void {
    const voice = this.nesVoices.get(noteNumber);
    if (!voice || voice.released) return;
    
    voice.released = true;
    const releaseTime = this.audioContext.currentTime;
    
    const channels: NesChannel[] = ['pulse1', 'pulse2', 'triangle', 'noise'];
    let envIndex = 0;
    
    for (const channel of channels) {
      const config = this.channelConfigs.get(channel)!;
      if (!config.enabled) continue;
      
      if (envIndex < voice.envelopes.length) {
        this.applyRelease(voice.envelopes[envIndex], config, releaseTime);
        envIndex++;
      }
    }
    
    // Schedule cleanup
    const maxRelease = Math.max(
      ...Array.from(this.channelConfigs.values()).map(c => c.release)
    );
    setTimeout(() => {
      this.cleanupVoice(noteNumber);
    }, (maxRelease + 0.1) * 1000);
  }
  
  /**
   * Clean up a voice
   */
  private cleanupVoice(noteNumber: number): void {
    const voice = this.nesVoices.get(noteNumber);
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
    
    this.nesVoices.delete(noteNumber);
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    const parts = key.split('_');
    const channel = parts[0] as NesChannel;
    const param = parts[1];
    
    const config = this.channelConfigs.get(channel);
    if (!config) return;
    
    switch (param) {
      case 'enabled':
        config.enabled = value > 0.5;
        break;
      case 'volume':
        config.volume = value;
        break;
      case 'dutyCycle':
        config.dutyCycle = Math.floor(value) as NesDutyCycle;
        break;
      case 'noiseMode':
        config.noiseMode = value > 0.5 ? 'short' : 'long';
        break;
      case 'noisePeriod':
        config.noisePeriod = Math.floor(value);
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
      case 'octave':
        config.octave = Math.floor(value);
        break;
      case 'detune':
        config.detune = value;
        break;
    }
  }
  
  /**
   * Initialize instrument
   */
  protected initializeInstrument(): void {
    const channels: NesChannel[] = ['pulse1', 'pulse2', 'triangle', 'noise'];
    
    for (const channel of channels) {
      const config = this.channelConfigs.get(channel)!;
      this.params[`${channel}_enabled`] = config.enabled ? 1 : 0;
      this.params[`${channel}_volume`] = config.volume;
      this.params[`${channel}_attack`] = config.attack;
      this.params[`${channel}_decay`] = config.decay;
      this.params[`${channel}_sustain`] = config.sustain;
      this.params[`${channel}_release`] = config.release;
      this.params[`${channel}_octave`] = config.octave;
      this.params[`${channel}_detune`] = config.detune;
      
      if (channel === 'pulse1' || channel === 'pulse2') {
        this.params[`${channel}_dutyCycle`] = config.dutyCycle ?? 2;
      }
      
      if (channel === 'noise') {
        this.params[`${channel}_noiseMode`] = config.noiseMode === 'short' ? 1 : 0;
        this.params[`${channel}_noisePeriod`] = config.noisePeriod ?? 8;
      }
    }
  }
  
  /**
   * Get parameter descriptors
   */
  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    const descriptors: InstrumentParameterDescriptor[] = [];
    
    // Pulse 1 parameters
    descriptors.push(
      { name: 'Pulse 1 Enabled', key: 'pulse1_enabled', min: 0, max: 1, default: 1, type: 'boolean', category: 'Pulse 1' },
      { name: 'Pulse 1 Volume', key: 'pulse1_volume', min: 0, max: 1, default: 0.8, category: 'Pulse 1' },
      { name: 'Pulse 1 Duty Cycle', key: 'pulse1_dutyCycle', min: 0, max: 3, default: 2, step: 1, type: 'enum', enumValues: ['12.5%', '25%', '50%', '75%'], category: 'Pulse 1' },
      { name: 'Pulse 1 Octave', key: 'pulse1_octave', min: -3, max: 3, default: 0, step: 1, category: 'Pulse 1' },
      { name: 'Pulse 1 Detune', key: 'pulse1_detune', min: -100, max: 100, default: 0, unit: 'cents', category: 'Pulse 1' },
      { name: 'Pulse 1 Attack', key: 'pulse1_attack', min: 0.001, max: 2, default: 0.01, unit: 's', category: 'Pulse 1' },
      { name: 'Pulse 1 Decay', key: 'pulse1_decay', min: 0, max: 2, default: 0.1, unit: 's', category: 'Pulse 1' },
      { name: 'Pulse 1 Sustain', key: 'pulse1_sustain', min: 0, max: 1, default: 0.7, category: 'Pulse 1' },
      { name: 'Pulse 1 Release', key: 'pulse1_release', min: 0.001, max: 5, default: 0.2, unit: 's', category: 'Pulse 1' }
    );
    
    // Pulse 2 parameters
    descriptors.push(
      { name: 'Pulse 2 Enabled', key: 'pulse2_enabled', min: 0, max: 1, default: 0, type: 'boolean', category: 'Pulse 2' },
      { name: 'Pulse 2 Volume', key: 'pulse2_volume', min: 0, max: 1, default: 0.8, category: 'Pulse 2' },
      { name: 'Pulse 2 Duty Cycle', key: 'pulse2_dutyCycle', min: 0, max: 3, default: 1, step: 1, type: 'enum', enumValues: ['12.5%', '25%', '50%', '75%'], category: 'Pulse 2' },
      { name: 'Pulse 2 Octave', key: 'pulse2_octave', min: -3, max: 3, default: 0, step: 1, category: 'Pulse 2' },
      { name: 'Pulse 2 Detune', key: 'pulse2_detune', min: -100, max: 100, default: 0, unit: 'cents', category: 'Pulse 2' },
      { name: 'Pulse 2 Attack', key: 'pulse2_attack', min: 0.001, max: 2, default: 0.01, unit: 's', category: 'Pulse 2' },
      { name: 'Pulse 2 Decay', key: 'pulse2_decay', min: 0, max: 2, default: 0.1, unit: 's', category: 'Pulse 2' },
      { name: 'Pulse 2 Sustain', key: 'pulse2_sustain', min: 0, max: 1, default: 0.7, category: 'Pulse 2' },
      { name: 'Pulse 2 Release', key: 'pulse2_release', min: 0.001, max: 5, default: 0.2, unit: 's', category: 'Pulse 2' }
    );
    
    // Triangle parameters
    descriptors.push(
      { name: 'Triangle Enabled', key: 'triangle_enabled', min: 0, max: 1, default: 0, type: 'boolean', category: 'Triangle' },
      { name: 'Triangle Volume', key: 'triangle_volume', min: 0, max: 1, default: 0.8, category: 'Triangle' },
      { name: 'Triangle Octave', key: 'triangle_octave', min: -3, max: 3, default: -1, step: 1, category: 'Triangle' },
      { name: 'Triangle Detune', key: 'triangle_detune', min: -100, max: 100, default: 0, unit: 'cents', category: 'Triangle' },
      { name: 'Triangle Attack', key: 'triangle_attack', min: 0.001, max: 2, default: 0.001, unit: 's', category: 'Triangle' },
      { name: 'Triangle Decay', key: 'triangle_decay', min: 0, max: 2, default: 0, unit: 's', category: 'Triangle' },
      { name: 'Triangle Sustain', key: 'triangle_sustain', min: 0, max: 1, default: 1, category: 'Triangle' },
      { name: 'Triangle Release', key: 'triangle_release', min: 0.001, max: 5, default: 0.1, unit: 's', category: 'Triangle' }
    );
    
    // Noise parameters
    descriptors.push(
      { name: 'Noise Enabled', key: 'noise_enabled', min: 0, max: 1, default: 0, type: 'boolean', category: 'Noise' },
      { name: 'Noise Volume', key: 'noise_volume', min: 0, max: 1, default: 0.5, category: 'Noise' },
      { name: 'Noise Mode', key: 'noise_noiseMode', min: 0, max: 1, default: 0, type: 'enum', enumValues: ['Long', 'Short'], category: 'Noise' },
      { name: 'Noise Period', key: 'noise_noisePeriod', min: 0, max: 15, default: 8, step: 1, category: 'Noise' },
      { name: 'Noise Attack', key: 'noise_attack', min: 0.001, max: 2, default: 0.01, unit: 's', category: 'Noise' },
      { name: 'Noise Decay', key: 'noise_decay', min: 0, max: 2, default: 0.1, unit: 's', category: 'Noise' },
      { name: 'Noise Sustain', key: 'noise_sustain', min: 0, max: 1, default: 0.5, category: 'Noise' },
      { name: 'Noise Release', key: 'noise_release', min: 0.001, max: 5, default: 0.2, unit: 's', category: 'Noise' }
    );
    
    return descriptors;
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    // Clean up all voices
    for (const noteNumber of this.nesVoices.keys()) {
      this.cleanupVoice(noteNumber);
    }
    
    super.dispose();
  }
}

// Factory function
export function createNes(audioContext: AudioContext, id?: string): Nes {
  return new Nes(audioContext, id || `nes-${Date.now()}`);
}