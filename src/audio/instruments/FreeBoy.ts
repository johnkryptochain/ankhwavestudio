// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * FreeBoy - GameBoy APU Emulator
 * Emulates the Nintendo GameBoy sound chip
 * 
 * Features:
 * - 2 pulse wave channels with duty cycle
 * - 1 wave channel with custom waveform
 * - 1 noise channel
 * - GameBoy-accurate sound
 */

import { BaseInstrument, type InstrumentParameterDescriptor } from './BaseInstrument';
import { clamp } from '../utils/AudioMath';

// ============================================================================
// Types
// ============================================================================

/**
 * FreeBoy channel types
 */
export type FreeBoyChannel = 'pulse1' | 'pulse2' | 'wave' | 'noise';

/**
 * Pulse duty cycle options (GameBoy has 4 duty cycles)
 */
export type FreeBoyDutyCycle = 0 | 1 | 2 | 3; // 12.5%, 25%, 50%, 75%

/**
 * Channel configuration
 */
export interface FreeBoyChannelConfig {
  enabled: boolean;
  volume: number;
  // Pulse specific
  dutyCycle?: FreeBoyDutyCycle;
  // Wave specific
  waveform?: number[]; // 32 4-bit samples
  // Noise specific
  noiseShift?: number;
  noiseWidth?: boolean; // true = 7-bit, false = 15-bit
  noiseDivisor?: number;
  // Envelope
  envelopeInitial: number;
  envelopeDirection: number; // 1 = increase, -1 = decrease
  envelopeSweep: number;
  // Length
  lengthEnabled: boolean;
  lengthValue: number;
  // Sweep (pulse1 only)
  sweepTime?: number;
  sweepDirection?: number;
  sweepShift?: number;
  // Frequency
  frequency: number;
}

/**
 * Active voice state
 */
interface FreeBoyVoice {
  noteNumber: number;
  velocity: number;
  startTime: number;
  released: boolean;
  oscillators: OscillatorNode[];
  gains: GainNode[];
  noiseSource?: AudioBufferSourceNode;
  waveSource?: OscillatorNode;
}

// ============================================================================
// FreeBoy Instrument
// ============================================================================

export class FreeBoy extends BaseInstrument {
  // Channel configurations
  private channelConfigs: Map<FreeBoyChannel, FreeBoyChannelConfig> = new Map();
  
  // Active voices
  private freeBoyVoices: Map<number, FreeBoyVoice> = new Map();
  
  // Noise buffers
  private noise15BitBuffer: AudioBuffer | null = null;
  private noise7BitBuffer: AudioBuffer | null = null;
  
  // Pulse wave periodic waves
  private pulseWaves: Map<FreeBoyDutyCycle, PeriodicWave> = new Map();
  
  // Custom wave table
  private customWaveform: number[] = [];
  private customWave: PeriodicWave | null = null;
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'FreeBoy', 'freeboy');
    
    // Initialize channel configurations
    this.initializeChannelConfigs();
    
    // Generate noise buffers
    this.generateNoiseBuffers();
    
    // Generate pulse waves
    this.generatePulseWaves();
    
    // Initialize custom waveform
    this.initializeCustomWaveform();
    
    // Initialize
    this.initializeInstrument();
  }
  
  /**
   * Initialize channel configurations
   */
  private initializeChannelConfigs(): void {
    // Pulse 1 (with sweep)
    this.channelConfigs.set('pulse1', {
      enabled: true,
      volume: 0.8,
      dutyCycle: 2, // 50%
      envelopeInitial: 15,
      envelopeDirection: -1,
      envelopeSweep: 3,
      lengthEnabled: false,
      lengthValue: 64,
      sweepTime: 0,
      sweepDirection: 0,
      sweepShift: 0,
      frequency: 440
    });
    
    // Pulse 2
    this.channelConfigs.set('pulse2', {
      enabled: false,
      volume: 0.8,
      dutyCycle: 1, // 25%
      envelopeInitial: 15,
      envelopeDirection: -1,
      envelopeSweep: 3,
      lengthEnabled: false,
      lengthValue: 64,
      frequency: 440
    });
    
    // Wave
    this.channelConfigs.set('wave', {
      enabled: false,
      volume: 0.8,
      envelopeInitial: 15,
      envelopeDirection: 0,
      envelopeSweep: 0,
      lengthEnabled: false,
      lengthValue: 256,
      frequency: 440,
      waveform: this.getDefaultWaveform()
    });
    
    // Noise
    this.channelConfigs.set('noise', {
      enabled: false,
      volume: 0.5,
      noiseShift: 0,
      noiseWidth: false, // 15-bit
      noiseDivisor: 0,
      envelopeInitial: 15,
      envelopeDirection: -1,
      envelopeSweep: 3,
      lengthEnabled: false,
      lengthValue: 64,
      frequency: 440
    });
  }
  
  /**
   * Get default waveform (triangle-like)
   */
  private getDefaultWaveform(): number[] {
    const waveform: number[] = [];
    for (let i = 0; i < 32; i++) {
      if (i < 16) {
        waveform.push(i);
      } else {
        waveform.push(31 - i);
      }
    }
    return waveform;
  }
  
  /**
   * Generate GameBoy-style noise buffers using LFSR
   */
  private generateNoiseBuffers(): void {
    const sampleRate = this.audioContext.sampleRate;
    const bufferSize = sampleRate * 2;
    
    // 15-bit LFSR noise
    this.noise15BitBuffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
    const data15 = this.noise15BitBuffer.getChannelData(0);
    let lfsr = 0x7FFF;
    
    for (let i = 0; i < bufferSize; i++) {
      // GameBoy LFSR: feedback = bit0 XOR bit1
      const feedback = (lfsr & 1) ^ ((lfsr >> 1) & 1);
      lfsr = (lfsr >> 1) | (feedback << 14);
      data15[i] = (lfsr & 1) ? 1 : -1;
    }
    
    // 7-bit LFSR noise (more metallic/tonal)
    this.noise7BitBuffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
    const data7 = this.noise7BitBuffer.getChannelData(0);
    lfsr = 0x7F;
    
    for (let i = 0; i < bufferSize; i++) {
      // 7-bit mode: feedback = bit0 XOR bit1, but only 7 bits
      const feedback = (lfsr & 1) ^ ((lfsr >> 1) & 1);
      lfsr = ((lfsr >> 1) | (feedback << 6)) & 0x7F;
      data7[i] = (lfsr & 1) ? 1 : -1;
    }
  }
  
  /**
   * Generate GameBoy pulse waves with different duty cycles
   */
  private generatePulseWaves(): void {
    const harmonics = 64;
    
    // Duty cycle patterns: 12.5%, 25%, 50%, 75%
    const dutyRatios: Record<FreeBoyDutyCycle, number> = {
      0: 0.125, // 12.5%
      1: 0.25,  // 25%
      2: 0.5,   // 50%
      3: 0.75   // 75%
    };
    
    for (const [duty, ratio] of Object.entries(dutyRatios)) {
      const real = new Float32Array(harmonics);
      const imag = new Float32Array(harmonics);
      
      // Calculate Fourier coefficients for pulse wave
      for (let n = 1; n < harmonics; n++) {
        // Pulse wave Fourier series
        imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * ratio);
      }
      
      const wave = this.audioContext.createPeriodicWave(real, imag, { disableNormalization: false });
      this.pulseWaves.set(parseInt(duty) as FreeBoyDutyCycle, wave);
    }
  }
  
  /**
   * Initialize custom waveform
   */
  private initializeCustomWaveform(): void {
    this.customWaveform = this.getDefaultWaveform();
    this.updateCustomWave();
  }
  
  /**
   * Update custom wave from waveform data
   */
  private updateCustomWave(): void {
    const harmonics = 32;
    const real = new Float32Array(harmonics);
    const imag = new Float32Array(harmonics);
    
    // Convert 4-bit samples to Fourier coefficients
    for (let n = 1; n < harmonics; n++) {
      let sumReal = 0;
      let sumImag = 0;
      
      for (let k = 0; k < 32; k++) {
        const sample = (this.customWaveform[k] / 15) * 2 - 1; // Convert to -1 to 1
        const angle = (2 * Math.PI * n * k) / 32;
        sumReal += sample * Math.cos(angle);
        sumImag += sample * Math.sin(angle);
      }
      
      real[n] = sumReal / 32;
      imag[n] = sumImag / 32;
    }
    
    this.customWave = this.audioContext.createPeriodicWave(real, imag, { disableNormalization: false });
  }
  
  /**
   * Set custom waveform sample
   */
  setWaveformSample(index: number, value: number): void {
    if (index >= 0 && index < 32) {
      this.customWaveform[index] = clamp(Math.floor(value), 0, 15);
      this.updateCustomWave();
      
      // Update channel config
      const waveConfig = this.channelConfigs.get('wave');
      if (waveConfig) {
        waveConfig.waveform = [...this.customWaveform];
      }
    }
  }
  
  /**
   * Get custom waveform
   */
  getWaveform(): number[] {
    return [...this.customWaveform];
  }
  
  /**
   * Set entire waveform
   */
  setWaveform(waveform: number[]): void {
    if (waveform.length === 32) {
      this.customWaveform = waveform.map(v => clamp(Math.floor(v), 0, 15));
      this.updateCustomWave();
      
      const waveConfig = this.channelConfigs.get('wave');
      if (waveConfig) {
        waveConfig.waveform = [...this.customWaveform];
      }
    }
  }
  
  /**
   * Load preset waveform
   */
  loadPresetWaveform(preset: 'triangle' | 'sawtooth' | 'square' | 'sine' | 'random'): void {
    const waveform: number[] = [];
    
    switch (preset) {
      case 'triangle':
        for (let i = 0; i < 32; i++) {
          if (i < 16) {
            waveform.push(i);
          } else {
            waveform.push(31 - i);
          }
        }
        break;
      case 'sawtooth':
        for (let i = 0; i < 32; i++) {
          waveform.push(Math.floor(i / 2));
        }
        break;
      case 'square':
        for (let i = 0; i < 32; i++) {
          waveform.push(i < 16 ? 15 : 0);
        }
        break;
      case 'sine':
        for (let i = 0; i < 32; i++) {
          waveform.push(Math.floor((Math.sin(2 * Math.PI * i / 32) + 1) * 7.5));
        }
        break;
      case 'random':
        for (let i = 0; i < 32; i++) {
          waveform.push(Math.floor(Math.random() * 16));
        }
        break;
    }
    
    this.setWaveform(waveform);
  }
  
  /**
   * Create oscillator for a channel
   */
  private createChannelOscillator(
    channel: FreeBoyChannel,
    frequency: number
  ): { oscillator: OscillatorNode | null; noiseSource: AudioBufferSourceNode | null } {
    const config = this.channelConfigs.get(channel)!;
    
    if (channel === 'noise') {
      const buffer = config.noiseWidth ? this.noise7BitBuffer : this.noise15BitBuffer;
      if (!buffer) {
        return { oscillator: null, noiseSource: null };
      }
      
      const noiseSource = this.audioContext.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;
      
      // Calculate playback rate based on noise parameters
      // GameBoy noise frequency = 524288 / r / 2^(s+1) Hz
      // where r = divisor ratio (0=0.5, 1-7=r), s = shift clock frequency
      const r = config.noiseDivisor === 0 ? 0.5 : config.noiseDivisor!;
      const s = config.noiseShift || 0;
      const noiseFreq = 524288 / r / Math.pow(2, s + 1);
      noiseSource.playbackRate.value = noiseFreq / 44100;
      
      return { oscillator: null, noiseSource };
    }
    
    const oscillator = this.audioContext.createOscillator();
    oscillator.frequency.value = frequency;
    
    if (channel === 'wave') {
      if (this.customWave) {
        oscillator.setPeriodicWave(this.customWave);
      } else {
        oscillator.type = 'triangle';
      }
    } else {
      // Pulse channels
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
   * Apply GameBoy envelope
   */
  private applyEnvelope(
    gainNode: GainNode,
    config: FreeBoyChannelConfig,
    velocity: number,
    startTime: number
  ): void {
    const gain = gainNode.gain;
    const initialVolume = (config.envelopeInitial / 15) * velocity * config.volume;
    
    gain.cancelScheduledValues(startTime);
    gain.setValueAtTime(initialVolume, startTime);
    
    // GameBoy envelope: changes volume by 1 every (sweep * 1/64) seconds
    if (config.envelopeSweep > 0 && config.envelopeDirection !== 0) {
      const stepTime = config.envelopeSweep / 64;
      const steps = config.envelopeInitial;
      
      if (config.envelopeDirection < 0) {
        // Decrease
        for (let i = 1; i <= steps; i++) {
          const newVolume = ((config.envelopeInitial - i) / 15) * velocity * config.volume;
          gain.linearRampToValueAtTime(Math.max(newVolume, 0), startTime + i * stepTime);
        }
      } else {
        // Increase
        for (let i = 1; i <= (15 - config.envelopeInitial); i++) {
          const newVolume = ((config.envelopeInitial + i) / 15) * velocity * config.volume;
          gain.linearRampToValueAtTime(Math.min(newVolume, velocity * config.volume), startTime + i * stepTime);
        }
      }
    }
  }
  
  /**
   * Trigger a note
   */
  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    const startTime = this.audioContext.currentTime;
    
    const voice: FreeBoyVoice = {
      noteNumber,
      velocity,
      startTime,
      released: false,
      oscillators: [],
      gains: []
    };
    
    const channels: FreeBoyChannel[] = ['pulse1', 'pulse2', 'wave', 'noise'];
    
    for (const channel of channels) {
      const config = this.channelConfigs.get(channel)!;
      if (!config.enabled) continue;
      
      const { oscillator, noiseSource } = this.createChannelOscillator(channel, frequency);
      
      // Create gain for this channel
      const channelGain = this.audioContext.createGain();
      this.applyEnvelope(channelGain, config, velocity, startTime);
      
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
      
      channelGain.connect(this.volumeNode);
      voice.gains.push(channelGain);
    }
    
    this.freeBoyVoices.set(noteNumber, voice);
  }
  
  /**
   * Release a note
   */
  protected releaseNote(noteNumber: number): void {
    const voice = this.freeBoyVoices.get(noteNumber);
    if (!voice || voice.released) return;
    
    voice.released = true;
    const releaseTime = this.audioContext.currentTime;
    
    // Quick release
    for (const gain of voice.gains) {
      gain.gain.cancelScheduledValues(releaseTime);
      gain.gain.setValueAtTime(gain.gain.value, releaseTime);
      gain.gain.exponentialRampToValueAtTime(0.001, releaseTime + 0.1);
    }
    
    // Schedule cleanup
    setTimeout(() => {
      this.cleanupVoice(noteNumber);
    }, 200);
  }
  
  /**
   * Clean up a voice
   */
  private cleanupVoice(noteNumber: number): void {
    const voice = this.freeBoyVoices.get(noteNumber);
    if (!voice) return;
    
    for (const osc of voice.oscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // Already stopped
      }
    }
    
    if (voice.noiseSource) {
      try {
        voice.noiseSource.stop();
        voice.noiseSource.disconnect();
      } catch (e) {
        // Already stopped
      }
    }
    
    for (const gain of voice.gains) {
      gain.disconnect();
    }
    
    this.freeBoyVoices.delete(noteNumber);
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    const parts = key.split('_');
    const channel = parts[0] as FreeBoyChannel;
    const param = parts.slice(1).join('_');
    
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
        config.dutyCycle = Math.floor(value) as FreeBoyDutyCycle;
        break;
      case 'envelopeInitial':
        config.envelopeInitial = Math.floor(value);
        break;
      case 'envelopeDirection':
        config.envelopeDirection = value > 0.5 ? 1 : value < -0.5 ? -1 : 0;
        break;
      case 'envelopeSweep':
        config.envelopeSweep = Math.floor(value);
        break;
      case 'lengthEnabled':
        config.lengthEnabled = value > 0.5;
        break;
      case 'lengthValue':
        config.lengthValue = Math.floor(value);
        break;
      case 'sweepTime':
        config.sweepTime = Math.floor(value);
        break;
      case 'sweepDirection':
        config.sweepDirection = value > 0.5 ? 1 : -1;
        break;
      case 'sweepShift':
        config.sweepShift = Math.floor(value);
        break;
      case 'noiseShift':
        config.noiseShift = Math.floor(value);
        break;
      case 'noiseWidth':
        config.noiseWidth = value > 0.5;
        break;
      case 'noiseDivisor':
        config.noiseDivisor = Math.floor(value);
        break;
    }
  }
  
  /**
   * Initialize instrument
   */
  protected initializeInstrument(): void {
    const channels: FreeBoyChannel[] = ['pulse1', 'pulse2', 'wave', 'noise'];
    
    for (const channel of channels) {
      const config = this.channelConfigs.get(channel)!;
      this.params[`${channel}_enabled`] = config.enabled ? 1 : 0;
      this.params[`${channel}_volume`] = config.volume;
      this.params[`${channel}_envelopeInitial`] = config.envelopeInitial;
      this.params[`${channel}_envelopeDirection`] = config.envelopeDirection;
      this.params[`${channel}_envelopeSweep`] = config.envelopeSweep;
      this.params[`${channel}_lengthEnabled`] = config.lengthEnabled ? 1 : 0;
      this.params[`${channel}_lengthValue`] = config.lengthValue;
      
      if (channel === 'pulse1' || channel === 'pulse2') {
        this.params[`${channel}_dutyCycle`] = config.dutyCycle ?? 2;
      }
      
      if (channel === 'pulse1') {
        this.params[`${channel}_sweepTime`] = config.sweepTime ?? 0;
        this.params[`${channel}_sweepDirection`] = config.sweepDirection ?? 0;
        this.params[`${channel}_sweepShift`] = config.sweepShift ?? 0;
      }
      
      if (channel === 'noise') {
        this.params[`${channel}_noiseShift`] = config.noiseShift ?? 0;
        this.params[`${channel}_noiseWidth`] = config.noiseWidth ? 1 : 0;
        this.params[`${channel}_noiseDivisor`] = config.noiseDivisor ?? 0;
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
      { name: 'Pulse 1 Envelope Initial', key: 'pulse1_envelopeInitial', min: 0, max: 15, default: 15, step: 1, category: 'Pulse 1' },
      { name: 'Pulse 1 Envelope Direction', key: 'pulse1_envelopeDirection', min: -1, max: 1, default: -1, step: 1, type: 'enum', enumValues: ['Decrease', 'None', 'Increase'], category: 'Pulse 1' },
      { name: 'Pulse 1 Envelope Sweep', key: 'pulse1_envelopeSweep', min: 0, max: 7, default: 3, step: 1, category: 'Pulse 1' },
      { name: 'Pulse 1 Sweep Time', key: 'pulse1_sweepTime', min: 0, max: 7, default: 0, step: 1, category: 'Pulse 1' },
      { name: 'Pulse 1 Sweep Direction', key: 'pulse1_sweepDirection', min: -1, max: 1, default: 0, step: 1, type: 'enum', enumValues: ['Down', 'None', 'Up'], category: 'Pulse 1' },
      { name: 'Pulse 1 Sweep Shift', key: 'pulse1_sweepShift', min: 0, max: 7, default: 0, step: 1, category: 'Pulse 1' }
    );
    
    // Pulse 2 parameters
    descriptors.push(
      { name: 'Pulse 2 Enabled', key: 'pulse2_enabled', min: 0, max: 1, default: 0, type: 'boolean', category: 'Pulse 2' },
      { name: 'Pulse 2 Volume', key: 'pulse2_volume', min: 0, max: 1, default: 0.8, category: 'Pulse 2' },
      { name: 'Pulse 2 Duty Cycle', key: 'pulse2_dutyCycle', min: 0, max: 3, default: 1, step: 1, type: 'enum', enumValues: ['12.5%', '25%', '50%', '75%'], category: 'Pulse 2' },
      { name: 'Pulse 2 Envelope Initial', key: 'pulse2_envelopeInitial', min: 0, max: 15, default: 15, step: 1, category: 'Pulse 2' },
      { name: 'Pulse 2 Envelope Direction', key: 'pulse2_envelopeDirection', min: -1, max: 1, default: -1, step: 1, type: 'enum', enumValues: ['Decrease', 'None', 'Increase'], category: 'Pulse 2' },
      { name: 'Pulse 2 Envelope Sweep', key: 'pulse2_envelopeSweep', min: 0, max: 7, default: 3, step: 1, category: 'Pulse 2' }
    );
    
    // Wave parameters
    descriptors.push(
      { name: 'Wave Enabled', key: 'wave_enabled', min: 0, max: 1, default: 0, type: 'boolean', category: 'Wave' },
      { name: 'Wave Volume', key: 'wave_volume', min: 0, max: 1, default: 0.8, category: 'Wave' }
    );
    
    // Noise parameters
    descriptors.push(
      { name: 'Noise Enabled', key: 'noise_enabled', min: 0, max: 1, default: 0, type: 'boolean', category: 'Noise' },
      { name: 'Noise Volume', key: 'noise_volume', min: 0, max: 1, default: 0.5, category: 'Noise' },
      { name: 'Noise Shift', key: 'noise_noiseShift', min: 0, max: 15, default: 0, step: 1, category: 'Noise' },
      { name: 'Noise Width (7-bit)', key: 'noise_noiseWidth', min: 0, max: 1, default: 0, type: 'boolean', category: 'Noise' },
      { name: 'Noise Divisor', key: 'noise_noiseDivisor', min: 0, max: 7, default: 0, step: 1, category: 'Noise' },
      { name: 'Noise Envelope Initial', key: 'noise_envelopeInitial', min: 0, max: 15, default: 15, step: 1, category: 'Noise' },
      { name: 'Noise Envelope Direction', key: 'noise_envelopeDirection', min: -1, max: 1, default: -1, step: 1, type: 'enum', enumValues: ['Decrease', 'None', 'Increase'], category: 'Noise' },
      { name: 'Noise Envelope Sweep', key: 'noise_envelopeSweep', min: 0, max: 7, default: 3, step: 1, category: 'Noise' }
    );
    
    return descriptors;
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    for (const noteNumber of this.freeBoyVoices.keys()) {
      this.cleanupVoice(noteNumber);
    }
    super.dispose();
  }
}

// Factory function
export function createFreeBoy(audioContext: AudioContext, id?: string): FreeBoy {
  return new FreeBoy(audioContext, id || `freeboy-${Date.now()}`);
}