// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Sfxr - Retro 8-bit Sound Effect Generator
 * Based on the original sfxr by DrPetter
 * 
 * Features:
 * - Pickup/coin, laser/shoot, explosion, powerup, hit/hurt, jump, blip/select sounds
 * - Randomize function
 * - Mutation function
 * - All parameters: wave type, envelope, frequency, vibrato, arpeggiation, duty cycle, retrigger, flanger, low-pass filter
 */

import { BaseInstrument, type InstrumentParameterDescriptor, type InstrumentPreset } from './BaseInstrument';
import { clamp } from '../utils/AudioMath';

// ============================================================================
// Types
// ============================================================================

/**
 * Sfxr wave types
 */
export enum SfxrWaveType {
  Square = 0,
  Sawtooth = 1,
  Sine = 2,
  Noise = 3,
  Triangle = 4,
  PinkNoise = 5,
  Tan = 6,
  Whistle = 7,
  Breaker = 8
}

/**
 * Sound effect categories
 */
export enum SfxrCategory {
  PickupCoin = 'pickup',
  LaserShoot = 'laser',
  Explosion = 'explosion',
  Powerup = 'powerup',
  HitHurt = 'hit',
  Jump = 'jump',
  BlipSelect = 'blip',
  Random = 'random'
}

/**
 * Sfxr parameters interface
 */
export interface SfxrParams {
  // Wave type
  waveType: SfxrWaveType;
  
  // Envelope
  attackTime: number;
  sustainTime: number;
  sustainPunch: number;
  decayTime: number;
  
  // Frequency
  startFrequency: number;
  minFrequency: number;
  slide: number;
  deltaSlide: number;
  
  // Vibrato
  vibratoDepth: number;
  vibratoSpeed: number;
  
  // Arpeggiation
  changeAmount: number;
  changeSpeed: number;
  
  // Duty cycle (for square wave)
  squareDuty: number;
  dutySweep: number;
  
  // Retrigger
  repeatSpeed: number;
  
  // Flanger
  flangerOffset: number;
  flangerSweep: number;
  
  // Low-pass filter
  lpFilterCutoff: number;
  lpFilterCutoffSweep: number;
  lpFilterResonance: number;
  
  // High-pass filter
  hpFilterCutoff: number;
  hpFilterCutoffSweep: number;
  
  // Master
  masterVolume: number;
}

/**
 * Active voice state
 */
interface SfxrVoice {
  noteNumber: number;
  velocity: number;
  startTime: number;
  released: boolean;
  
  // Audio nodes
  oscillator?: OscillatorNode;
  noiseSource?: AudioBufferSourceNode;
  gainNode: GainNode;
  filterNode: BiquadFilterNode;
  
  // State for synthesis
  phase: number;
  period: number;
  periodMax: number;
  enableFrequencyCutoff: boolean;
  periodMult: number;
  periodMultSlide: number;
  dutyCycle: number;
  dutyCycleSlide: number;
  arpeggioMultiplier: number;
  arpeggioTime: number;
  
  // Vibrato
  vibratoPhase: number;
  vibratoAmplitude: number;
  vibratoSpeed: number;
  
  // Flanger
  flangerBuffer: Float32Array;
  flangerPos: number;
  flangerOffset: number;
  flangerOffsetSlide: number;
  
  // Repeat
  repeatTime: number;
  repeatLimit: number;
  
  // Envelope
  envelopeStage: number;
  envelopeTime: number;
  envelopeLength: number[];
  envelopeVolume: number;
  sustainPunch: number;
  
  // Filter
  filterPos: number;
  filterDeltaPos: number;
  filterCutoff: number;
  filterCutoffSlide: number;
  filterDamping: number;
  filterOn: boolean;
  hpFilterPos: number;
  hpFilterCutoff: number;
  hpFilterCutoffSlide: number;
  
  // Noise
  noiseBuffer: Float32Array;
  
  // Processor
  scriptProcessor?: ScriptProcessorNode;
}

// ============================================================================
// Sfxr Instrument
// ============================================================================

export class Sfxr extends BaseInstrument {
  // Current parameters
  private sfxrParams: SfxrParams;
  
  // Active voices
  private sfxrVoices: Map<number, SfxrVoice> = new Map();
  
  // Noise buffer
  private noiseBuffer: AudioBuffer | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'Sfxr', 'sfxr');
    
    // Initialize default parameters
    this.sfxrParams = this.getDefaultParams();
    
    // Generate noise buffers
    this.generateNoiseBuffers();
    
    // Initialize
    this.initializeInstrument();
    
    // Add presets
    this.addDefaultPresets();
  }
  
  /**
   * Get default parameters
   */
  private getDefaultParams(): SfxrParams {
    return {
      waveType: SfxrWaveType.Square,
      attackTime: 0,
      sustainTime: 0.3,
      sustainPunch: 0,
      decayTime: 0.4,
      startFrequency: 0.3,
      minFrequency: 0,
      slide: 0,
      deltaSlide: 0,
      vibratoDepth: 0,
      vibratoSpeed: 0,
      changeAmount: 0,
      changeSpeed: 0,
      squareDuty: 0.5,
      dutySweep: 0,
      repeatSpeed: 0,
      flangerOffset: 0,
      flangerSweep: 0,
      lpFilterCutoff: 1,
      lpFilterCutoffSweep: 0,
      lpFilterResonance: 0,
      hpFilterCutoff: 0,
      hpFilterCutoffSweep: 0,
      masterVolume: 0.5
    };
  }
  
  /**
   * Generate noise buffers
   */
  private generateNoiseBuffers(): void {
    const sampleRate = this.audioContext.sampleRate;
    const bufferSize = sampleRate * 2;
    
    // White noise
    this.noiseBuffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
    const whiteData = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      whiteData[i] = Math.random() * 2 - 1;
    }
    
    // Pink noise (using Paul Kellet's algorithm)
    this.pinkNoiseBuffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
    const pinkData = this.pinkNoiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pinkData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }
  
  /**
   * Add default presets
   */
  private addDefaultPresets(): void {
    // Pickup/Coin preset
    this.presets.push({
      name: 'Pickup Coin',
      params: {
        waveType: SfxrWaveType.Square,
        attackTime: 0,
        sustainTime: 0.1,
        sustainPunch: 0.3,
        decayTime: 0.15,
        startFrequency: 0.5,
        minFrequency: 0,
        slide: 0.2,
        deltaSlide: 0,
        vibratoDepth: 0,
        vibratoSpeed: 0,
        changeAmount: 0.3,
        changeSpeed: 0.4,
        squareDuty: 0.5,
        dutySweep: 0,
        repeatSpeed: 0,
        flangerOffset: 0,
        flangerSweep: 0,
        lpFilterCutoff: 1,
        lpFilterCutoffSweep: 0,
        lpFilterResonance: 0,
        hpFilterCutoff: 0,
        hpFilterCutoffSweep: 0,
        masterVolume: 0.5
      }
    });
    
    // Laser preset
    this.presets.push({
      name: 'Laser Shoot',
      params: {
        waveType: SfxrWaveType.Square,
        attackTime: 0,
        sustainTime: 0.1,
        sustainPunch: 0,
        decayTime: 0.2,
        startFrequency: 0.6,
        minFrequency: 0.1,
        slide: -0.3,
        deltaSlide: 0,
        vibratoDepth: 0,
        vibratoSpeed: 0,
        changeAmount: 0,
        changeSpeed: 0,
        squareDuty: 0.5,
        dutySweep: 0,
        repeatSpeed: 0,
        flangerOffset: 0,
        flangerSweep: 0,
        lpFilterCutoff: 1,
        lpFilterCutoffSweep: 0,
        lpFilterResonance: 0,
        hpFilterCutoff: 0,
        hpFilterCutoffSweep: 0,
        masterVolume: 0.5
      }
    });
    
    // Explosion preset
    this.presets.push({
      name: 'Explosion',
      params: {
        waveType: SfxrWaveType.Noise,
        attackTime: 0,
        sustainTime: 0.3,
        sustainPunch: 0.3,
        decayTime: 0.5,
        startFrequency: 0.2,
        minFrequency: 0,
        slide: -0.1,
        deltaSlide: 0,
        vibratoDepth: 0,
        vibratoSpeed: 0,
        changeAmount: 0,
        changeSpeed: 0,
        squareDuty: 0.5,
        dutySweep: 0,
        repeatSpeed: 0,
        flangerOffset: 0,
        flangerSweep: 0,
        lpFilterCutoff: 0.5,
        lpFilterCutoffSweep: -0.1,
        lpFilterResonance: 0,
        hpFilterCutoff: 0,
        hpFilterCutoffSweep: 0,
        masterVolume: 0.5
      }
    });
    
    // Powerup preset
    this.presets.push({
      name: 'Powerup',
      params: {
        waveType: SfxrWaveType.Square,
        attackTime: 0,
        sustainTime: 0.2,
        sustainPunch: 0,
        decayTime: 0.4,
        startFrequency: 0.3,
        minFrequency: 0,
        slide: 0.3,
        deltaSlide: 0.1,
        vibratoDepth: 0,
        vibratoSpeed: 0,
        changeAmount: 0,
        changeSpeed: 0,
        squareDuty: 0.5,
        dutySweep: 0,
        repeatSpeed: 0.4,
        flangerOffset: 0,
        flangerSweep: 0,
        lpFilterCutoff: 1,
        lpFilterCutoffSweep: 0,
        lpFilterResonance: 0,
        hpFilterCutoff: 0,
        hpFilterCutoffSweep: 0,
        masterVolume: 0.5
      }
    });
    
    // Hit/Hurt preset
    this.presets.push({
      name: 'Hit Hurt',
      params: {
        waveType: SfxrWaveType.Sawtooth,
        attackTime: 0,
        sustainTime: 0.1,
        sustainPunch: 0.5,
        decayTime: 0.2,
        startFrequency: 0.4,
        minFrequency: 0.2,
        slide: -0.3,
        deltaSlide: 0,
        vibratoDepth: 0,
        vibratoSpeed: 0,
        changeAmount: 0,
        changeSpeed: 0,
        squareDuty: 0.5,
        dutySweep: 0,
        repeatSpeed: 0,
        flangerOffset: 0,
        flangerSweep: 0,
        lpFilterCutoff: 1,
        lpFilterCutoffSweep: 0,
        lpFilterResonance: 0,
        hpFilterCutoff: 0,
        hpFilterCutoffSweep: 0,
        masterVolume: 0.5
      }
    });
    
    // Jump preset
    this.presets.push({
      name: 'Jump',
      params: {
        waveType: SfxrWaveType.Square,
        attackTime: 0,
        sustainTime: 0.15,
        sustainPunch: 0,
        decayTime: 0.2,
        startFrequency: 0.3,
        minFrequency: 0,
        slide: 0.2,
        deltaSlide: 0,
        vibratoDepth: 0,
        vibratoSpeed: 0,
        changeAmount: 0,
        changeSpeed: 0,
        squareDuty: 0.5,
        dutySweep: 0,
        repeatSpeed: 0,
        flangerOffset: 0,
        flangerSweep: 0,
        lpFilterCutoff: 1,
        lpFilterCutoffSweep: 0,
        lpFilterResonance: 0,
        hpFilterCutoff: 0,
        hpFilterCutoffSweep: 0,
        masterVolume: 0.5
      }
    });
    
    // Blip/Select preset
    this.presets.push({
      name: 'Blip Select',
      params: {
        waveType: SfxrWaveType.Square,
        attackTime: 0,
        sustainTime: 0.05,
        sustainPunch: 0,
        decayTime: 0.1,
        startFrequency: 0.5,
        minFrequency: 0,
        slide: 0,
        deltaSlide: 0,
        vibratoDepth: 0,
        vibratoSpeed: 0,
        changeAmount: 0,
        changeSpeed: 0,
        squareDuty: 0.5,
        dutySweep: 0,
        repeatSpeed: 0,
        flangerOffset: 0,
        flangerSweep: 0,
        lpFilterCutoff: 1,
        lpFilterCutoffSweep: 0,
        lpFilterResonance: 0,
        hpFilterCutoff: 0,
        hpFilterCutoffSweep: 0,
        masterVolume: 0.5
      }
    });
  }
  
  /**
   * Generate random sound for a category
   */
  generateSound(category: SfxrCategory): void {
    switch (category) {
      case SfxrCategory.PickupCoin:
        this.generatePickupCoin();
        break;
      case SfxrCategory.LaserShoot:
        this.generateLaserShoot();
        break;
      case SfxrCategory.Explosion:
        this.generateExplosion();
        break;
      case SfxrCategory.Powerup:
        this.generatePowerup();
        break;
      case SfxrCategory.HitHurt:
        this.generateHitHurt();
        break;
      case SfxrCategory.Jump:
        this.generateJump();
        break;
      case SfxrCategory.BlipSelect:
        this.generateBlipSelect();
        break;
      case SfxrCategory.Random:
        this.randomize();
        break;
    }
  }
  
  /**
   * Generate pickup/coin sound
   */
  generatePickupCoin(): void {
    this.resetParams();
    this.sfxrParams.startFrequency = 0.4 + Math.random() * 0.5;
    this.sfxrParams.sustainTime = Math.random() * 0.1;
    this.sfxrParams.decayTime = 0.1 + Math.random() * 0.4;
    this.sfxrParams.sustainPunch = 0.3 + Math.random() * 0.3;
    
    if (Math.random() < 0.5) {
      this.sfxrParams.changeSpeed = 0.5 + Math.random() * 0.2;
      this.sfxrParams.changeAmount = 0.2 + Math.random() * 0.4;
    }
    
    this.syncParamsToState();
  }
  
  /**
   * Generate laser/shoot sound
   */
  generateLaserShoot(): void {
    this.resetParams();
    this.sfxrParams.waveType = Math.floor(Math.random() * 3) as SfxrWaveType;
    if (this.sfxrParams.waveType === SfxrWaveType.Sine && Math.random() < 0.5) {
      this.sfxrParams.waveType = Math.floor(Math.random() * 2) as SfxrWaveType;
    }
    
    this.sfxrParams.startFrequency = 0.5 + Math.random() * 0.5;
    this.sfxrParams.minFrequency = this.sfxrParams.startFrequency - 0.2 - Math.random() * 0.6;
    if (this.sfxrParams.minFrequency < 0.2) this.sfxrParams.minFrequency = 0.2;
    
    this.sfxrParams.slide = -0.15 - Math.random() * 0.2;
    
    if (Math.random() < 0.33) {
      this.sfxrParams.startFrequency = Math.random() * 0.6;
      this.sfxrParams.minFrequency = Math.random() * 0.1;
      this.sfxrParams.slide = -0.35 - Math.random() * 0.3;
    }
    
    if (Math.random() < 0.5) {
      this.sfxrParams.squareDuty = Math.random() * 0.5;
      this.sfxrParams.dutySweep = Math.random() * 0.2;
    } else {
      this.sfxrParams.squareDuty = 0.4 + Math.random() * 0.5;
      this.sfxrParams.dutySweep = -Math.random() * 0.7;
    }
    
    this.sfxrParams.sustainTime = 0.1 + Math.random() * 0.2;
    this.sfxrParams.decayTime = Math.random() * 0.4;
    
    if (Math.random() < 0.5) {
      this.sfxrParams.sustainPunch = Math.random() * 0.3;
    }
    
    if (Math.random() < 0.33) {
      this.sfxrParams.flangerOffset = Math.random() * 0.2;
      this.sfxrParams.flangerSweep = -Math.random() * 0.2;
    }
    
    if (Math.random() < 0.5) {
      this.sfxrParams.hpFilterCutoff = Math.random() * 0.3;
    }
    
    this.syncParamsToState();
  }
  
  /**
   * Generate explosion sound
   */
  generateExplosion(): void {
    this.resetParams();
    this.sfxrParams.waveType = SfxrWaveType.Noise;
    
    if (Math.random() < 0.5) {
      this.sfxrParams.startFrequency = 0.1 + Math.random() * 0.4;
      this.sfxrParams.slide = -0.1 + Math.random() * 0.4;
    } else {
      this.sfxrParams.startFrequency = 0.2 + Math.random() * 0.7;
      this.sfxrParams.slide = -0.2 - Math.random() * 0.2;
    }
    
    this.sfxrParams.startFrequency *= this.sfxrParams.startFrequency;
    
    if (Math.random() < 0.2) {
      this.sfxrParams.slide = 0;
    }
    
    if (Math.random() < 0.33) {
      this.sfxrParams.repeatSpeed = 0.3 + Math.random() * 0.5;
    }
    
    this.sfxrParams.sustainTime = 0.1 + Math.random() * 0.3;
    this.sfxrParams.decayTime = Math.random() * 0.5;
    this.sfxrParams.sustainPunch = 0.2 + Math.random() * 0.6;
    
    if (Math.random() < 0.5) {
      this.sfxrParams.flangerOffset = -0.3 + Math.random() * 0.9;
      this.sfxrParams.flangerSweep = -Math.random() * 0.3;
    }
    
    if (Math.random() < 0.33) {
      this.sfxrParams.changeSpeed = 0.6 + Math.random() * 0.3;
      this.sfxrParams.changeAmount = 0.8 - Math.random() * 1.6;
    }
    
    this.syncParamsToState();
  }
  
  /**
   * Generate powerup sound
   */
  generatePowerup(): void {
    this.resetParams();
    
    if (Math.random() < 0.5) {
      this.sfxrParams.waveType = SfxrWaveType.Sawtooth;
    } else {
      this.sfxrParams.squareDuty = Math.random() * 0.6;
    }
    
    if (Math.random() < 0.5) {
      this.sfxrParams.startFrequency = 0.2 + Math.random() * 0.3;
      this.sfxrParams.slide = 0.1 + Math.random() * 0.4;
      this.sfxrParams.repeatSpeed = 0.4 + Math.random() * 0.4;
    } else {
      this.sfxrParams.startFrequency = 0.2 + Math.random() * 0.3;
      this.sfxrParams.slide = 0.05 + Math.random() * 0.2;
      
      if (Math.random() < 0.5) {
        this.sfxrParams.vibratoDepth = Math.random() * 0.7;
        this.sfxrParams.vibratoSpeed = Math.random() * 0.6;
      }
    }
    
    this.sfxrParams.sustainTime = Math.random() * 0.4;
    this.sfxrParams.decayTime = 0.1 + Math.random() * 0.4;
    
    this.syncParamsToState();
  }
  
  /**
   * Generate hit/hurt sound
   */
  generateHitHurt(): void {
    this.resetParams();
    this.sfxrParams.waveType = Math.floor(Math.random() * 3) as SfxrWaveType;
    if (this.sfxrParams.waveType === SfxrWaveType.Sine) {
      this.sfxrParams.waveType = SfxrWaveType.Noise;
    }
    if (this.sfxrParams.waveType === SfxrWaveType.Square) {
      this.sfxrParams.squareDuty = Math.random() * 0.6;
    }
    
    this.sfxrParams.startFrequency = 0.2 + Math.random() * 0.6;
    this.sfxrParams.slide = -0.3 - Math.random() * 0.4;
    
    this.sfxrParams.sustainTime = Math.random() * 0.1;
    this.sfxrParams.decayTime = 0.1 + Math.random() * 0.2;
    
    if (Math.random() < 0.5) {
      this.sfxrParams.hpFilterCutoff = Math.random() * 0.3;
    }
    
    this.syncParamsToState();
  }
  
  /**
   * Generate jump sound
   */
  generateJump(): void {
    this.resetParams();
    this.sfxrParams.waveType = SfxrWaveType.Square;
    this.sfxrParams.squareDuty = Math.random() * 0.6;
    
    this.sfxrParams.startFrequency = 0.3 + Math.random() * 0.3;
    this.sfxrParams.slide = 0.1 + Math.random() * 0.2;
    
    this.sfxrParams.sustainTime = 0.1 + Math.random() * 0.3;
    this.sfxrParams.decayTime = 0.1 + Math.random() * 0.2;
    
    if (Math.random() < 0.5) {
      this.sfxrParams.hpFilterCutoff = Math.random() * 0.3;
    }
    
    if (Math.random() < 0.3) {
      this.sfxrParams.lpFilterCutoff = 1 - Math.random() * 0.6;
    }
    
    this.syncParamsToState();
  }
  
  /**
   * Generate blip/select sound
   */
  generateBlipSelect(): void {
    this.resetParams();
    this.sfxrParams.waveType = Math.floor(Math.random() * 2) as SfxrWaveType;
    if (this.sfxrParams.waveType === SfxrWaveType.Square) {
      this.sfxrParams.squareDuty = Math.random() * 0.6;
    }
    
    this.sfxrParams.startFrequency = 0.2 + Math.random() * 0.4;
    
    this.sfxrParams.sustainTime = 0.1 + Math.random() * 0.1;
    this.sfxrParams.decayTime = Math.random() * 0.2;
    
    this.sfxrParams.hpFilterCutoff = 0.1;
    
    this.syncParamsToState();
  }
  
  /**
   * Randomize all parameters
   */
  randomize(): void {
    this.sfxrParams.waveType = Math.floor(Math.random() * 4) as SfxrWaveType;
    
    this.sfxrParams.attackTime = Math.pow(Math.random() * 2 - 1, 3);
    this.sfxrParams.sustainTime = Math.pow(Math.random() * 2 - 1, 2);
    this.sfxrParams.sustainPunch = Math.pow(Math.random() * 0.8, 2);
    this.sfxrParams.decayTime = Math.random();
    
    this.sfxrParams.startFrequency = Math.random() < 0.5 ? Math.pow(Math.random() * 2 - 1, 2) : Math.pow(Math.random() * 0.5, 3) + 0.5;
    this.sfxrParams.minFrequency = 0;
    this.sfxrParams.slide = Math.pow(Math.random() * 2 - 1, 5);
    this.sfxrParams.deltaSlide = Math.pow(Math.random() * 2 - 1, 3);
    
    this.sfxrParams.vibratoDepth = Math.pow(Math.random() * 2 - 1, 3);
    this.sfxrParams.vibratoSpeed = Math.random() * 2 - 1;
    
    this.sfxrParams.changeAmount = Math.random() * 2 - 1;
    this.sfxrParams.changeSpeed = Math.random() * 2 - 1;
    
    this.sfxrParams.squareDuty = Math.random() * 2 - 1;
    this.sfxrParams.dutySweep = Math.pow(Math.random() * 2 - 1, 3);
    
    this.sfxrParams.repeatSpeed = Math.random() * 2 - 1;
    
    this.sfxrParams.flangerOffset = Math.pow(Math.random() * 2 - 1, 3);
    this.sfxrParams.flangerSweep = Math.pow(Math.random() * 2 - 1, 3);
    
    this.sfxrParams.lpFilterCutoff = 1 - Math.pow(Math.random(), 3);
    this.sfxrParams.lpFilterCutoffSweep = Math.pow(Math.random() * 2 - 1, 3);
    this.sfxrParams.lpFilterResonance = Math.random() * 2 - 1;
    
    this.sfxrParams.hpFilterCutoff = Math.pow(Math.random(), 5);
    this.sfxrParams.hpFilterCutoffSweep = Math.pow(Math.random() * 2 - 1, 5);
    
    // Clamp values
    if (this.sfxrParams.attackTime < 0) this.sfxrParams.attackTime = 0;
    if (this.sfxrParams.sustainTime < 0.01) this.sfxrParams.sustainTime = 0.01;
    if (this.sfxrParams.decayTime < 0) this.sfxrParams.decayTime = 0;
    
    this.syncParamsToState();
  }
  
  /**
   * Mutate current parameters slightly
   */
  mutate(): void {
    const mutateAmount = 0.05;
    
    const mutate = (value: number, min: number = -1, max: number = 1): number => {
      value += (Math.random() * 2 - 1) * mutateAmount;
      return clamp(value, min, max);
    };
    
    if (Math.random() < 0.5) this.sfxrParams.startFrequency = mutate(this.sfxrParams.startFrequency, 0, 1);
    if (Math.random() < 0.5) this.sfxrParams.minFrequency = mutate(this.sfxrParams.minFrequency, 0, 1);
    if (Math.random() < 0.5) this.sfxrParams.slide = mutate(this.sfxrParams.slide);
    if (Math.random() < 0.5) this.sfxrParams.deltaSlide = mutate(this.sfxrParams.deltaSlide);
    if (Math.random() < 0.5) this.sfxrParams.squareDuty = mutate(this.sfxrParams.squareDuty, 0, 1);
    if (Math.random() < 0.5) this.sfxrParams.dutySweep = mutate(this.sfxrParams.dutySweep);
    if (Math.random() < 0.5) this.sfxrParams.vibratoDepth = mutate(this.sfxrParams.vibratoDepth, 0, 1);
    if (Math.random() < 0.5) this.sfxrParams.vibratoSpeed = mutate(this.sfxrParams.vibratoSpeed, 0, 1);
    if (Math.random() < 0.5) this.sfxrParams.attackTime = mutate(this.sfxrParams.attackTime, 0, 1);
    if (Math.random() < 0.5) this.sfxrParams.sustainTime = mutate(this.sfxrParams.sustainTime, 0, 1);
    if (Math.random() < 0.5) this.sfxrParams.decayTime = mutate(this.sfxrParams.decayTime, 0, 1);
    if (Math.random() < 0.5) this.sfxrParams.sustainPunch = mutate(this.sfxrParams.sustainPunch, 0, 1);
    if (Math.random() < 0.5) this.sfxrParams.lpFilterResonance = mutate(this.sfxrParams.lpFilterResonance, 0, 1);
    if (Math.random() < 0.5) this.sfxrParams.lpFilterCutoff = mutate(this.sfxrParams.lpFilterCutoff, 0, 1);
    if (Math.random() < 0.5) this.sfxrParams.lpFilterCutoffSweep = mutate(this.sfxrParams.lpFilterCutoffSweep);
    if (Math.random() < 0.5) this.sfxrParams.hpFilterCutoff = mutate(this.sfxrParams.hpFilterCutoff, 0, 1);
    if (Math.random() < 0.5) this.sfxrParams.hpFilterCutoffSweep = mutate(this.sfxrParams.hpFilterCutoffSweep);
    if (Math.random() < 0.5) this.sfxrParams.flangerOffset = mutate(this.sfxrParams.flangerOffset);
    if (Math.random() < 0.5) this.sfxrParams.flangerSweep = mutate(this.sfxrParams.flangerSweep);
    if (Math.random() < 0.5) this.sfxrParams.changeAmount = mutate(this.sfxrParams.changeAmount);
    if (Math.random() < 0.5) this.sfxrParams.changeSpeed = mutate(this.sfxrParams.changeSpeed, 0, 1);
    if (Math.random() < 0.5) this.sfxrParams.repeatSpeed = mutate(this.sfxrParams.repeatSpeed, 0, 1);
    
    this.syncParamsToState();
  }
  
  /**
   * Reset parameters to defaults
   */
  resetParams(): void {
    this.sfxrParams = this.getDefaultParams();
  }
  
  /**
   * Sync sfxrParams to the params state
   */
  private syncParamsToState(): void {
    for (const [key, value] of Object.entries(this.sfxrParams)) {
      this.params[key] = value;
    }
  }
  
  /**
   * Play the current sound effect
   */
  playSound(): void {
    this.noteOn(60, 100);
    // Auto release after sound duration
    const duration = (this.sfxrParams.attackTime + this.sfxrParams.sustainTime + this.sfxrParams.decayTime) * 1000 + 100;
    setTimeout(() => {
      this.noteOff(60);
    }, duration);
  }
  
  /**
   * Trigger a note
   */
  protected silenceNote(noteNumber: number): void {
    this.cleanupVoice(noteNumber);
  }

  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    const startTime = this.audioContext.currentTime;
    
    // Create gain node
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0;
    
    // Create filter node
    const filterNode = this.audioContext.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = this.sfxrParams.lpFilterCutoff * 20000;
    filterNode.Q.value = this.sfxrParams.lpFilterResonance * 20;
    
    // Calculate envelope times
    const attackTime = this.sfxrParams.attackTime * this.sfxrParams.attackTime * 100000 / this.audioContext.sampleRate;
    const sustainTime = this.sfxrParams.sustainTime * this.sfxrParams.sustainTime * 100000 / this.audioContext.sampleRate;
    const decayTime = this.sfxrParams.decayTime * this.sfxrParams.decayTime * 100000 / this.audioContext.sampleRate;
    
    const totalTime = attackTime + sustainTime + decayTime;
    
    // Apply envelope
    const peakVolume = velocity * this.sfxrParams.masterVolume;
    const sustainVolume = peakVolume * (1 - this.sfxrParams.sustainPunch);
    
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(peakVolume, startTime + attackTime);
    gainNode.gain.linearRampToValueAtTime(sustainVolume, startTime + attackTime + 0.001);
    gainNode.gain.linearRampToValueAtTime(sustainVolume, startTime + attackTime + sustainTime);
    gainNode.gain.linearRampToValueAtTime(0, startTime + totalTime);
    
    // Create oscillator or noise source
    let oscillator: OscillatorNode | undefined;
    let noiseSource: AudioBufferSourceNode | undefined;
    
    const baseFreq = this.sfxrParams.startFrequency * this.sfxrParams.startFrequency * 1600;
    
    if (this.sfxrParams.waveType === SfxrWaveType.Noise || this.sfxrParams.waveType === SfxrWaveType.PinkNoise) {
      // Use noise buffer
      const buffer = this.sfxrParams.waveType === SfxrWaveType.PinkNoise ? this.pinkNoiseBuffer : this.noiseBuffer;
      if (buffer) {
        noiseSource = this.audioContext.createBufferSource();
        noiseSource.buffer = buffer;
        noiseSource.loop = true;
        noiseSource.connect(filterNode);
        noiseSource.start(startTime);
        noiseSource.stop(startTime + totalTime + 0.1);
      }
    } else {
      // Use oscillator
      oscillator = this.audioContext.createOscillator();
      
      switch (this.sfxrParams.waveType) {
        case SfxrWaveType.Square:
          oscillator.type = 'square';
          break;
        case SfxrWaveType.Sawtooth:
          oscillator.type = 'sawtooth';
          break;
        case SfxrWaveType.Sine:
          oscillator.type = 'sine';
          break;
        case SfxrWaveType.Triangle:
          oscillator.type = 'triangle';
          break;
        default:
          oscillator.type = 'square';
      }
      
      oscillator.frequency.value = baseFreq;
      
      // Apply frequency slide
      if (this.sfxrParams.slide !== 0) {
        const endFreq = Math.max(baseFreq * (1 + this.sfxrParams.slide * 10), 20);
        oscillator.frequency.linearRampToValueAtTime(endFreq, startTime + totalTime);
      }
      
      // Apply vibrato
      if (this.sfxrParams.vibratoDepth > 0) {
        const vibratoLfo = this.audioContext.createOscillator();
        const vibratoGain = this.audioContext.createGain();
        vibratoLfo.frequency.value = this.sfxrParams.vibratoSpeed * 10;
        vibratoGain.gain.value = this.sfxrParams.vibratoDepth * baseFreq * 0.1;
        vibratoLfo.connect(vibratoGain);
        vibratoGain.connect(oscillator.frequency);
        vibratoLfo.start(startTime);
        vibratoLfo.stop(startTime + totalTime + 0.1);
      }
      
      oscillator.connect(filterNode);
      oscillator.start(startTime);
      oscillator.stop(startTime + totalTime + 0.1);
    }
    
    // Connect chain
    filterNode.connect(gainNode);
    gainNode.connect(this.volumeNode);
    
    // Store voice
    const voice: SfxrVoice = {
      noteNumber,
      velocity,
      startTime,
      released: false,
      oscillator,
      noiseSource,
      gainNode,
      filterNode,
      phase: 0,
      period: 0,
      periodMax: 0,
      enableFrequencyCutoff: false,
      periodMult: 0,
      periodMultSlide: 0,
      dutyCycle: this.sfxrParams.squareDuty,
      dutyCycleSlide: this.sfxrParams.dutySweep,
      arpeggioMultiplier: 1,
      arpeggioTime: 0,
      vibratoPhase: 0,
      vibratoAmplitude: this.sfxrParams.vibratoDepth,
      vibratoSpeed: this.sfxrParams.vibratoSpeed,
      flangerBuffer: new Float32Array(1024),
      flangerPos: 0,
      flangerOffset: this.sfxrParams.flangerOffset,
      flangerOffsetSlide: this.sfxrParams.flangerSweep,
      repeatTime: 0,
      repeatLimit: 0,
      envelopeStage: 0,
      envelopeTime: 0,
      envelopeLength: [attackTime, sustainTime, decayTime],
      envelopeVolume: 0,
      sustainPunch: this.sfxrParams.sustainPunch,
      filterPos: 0,
      filterDeltaPos: 0,
      filterCutoff: this.sfxrParams.lpFilterCutoff,
      filterCutoffSlide: this.sfxrParams.lpFilterCutoffSweep,
      filterDamping: 1 - this.sfxrParams.lpFilterResonance,
      filterOn: this.sfxrParams.lpFilterCutoff < 1,
      hpFilterPos: 0,
      hpFilterCutoff: this.sfxrParams.hpFilterCutoff,
      hpFilterCutoffSlide: this.sfxrParams.hpFilterCutoffSweep,
      noiseBuffer: new Float32Array(32)
    };
    
    this.sfxrVoices.set(noteNumber, voice);
    
    // Schedule cleanup
    setTimeout(() => {
      this.cleanupVoice(noteNumber);
    }, (totalTime + 0.2) * 1000);
  }
  
  /**
   * Release a note
   */
  protected releaseNote(noteNumber: number): void {
    const voice = this.sfxrVoices.get(noteNumber);
    if (!voice || voice.released) return;
    
    voice.released = true;
    // Sfxr sounds are typically one-shot, so we don't need to do much here
  }
  
  /**
   * Clean up a voice
   */
  private cleanupVoice(noteNumber: number): void {
    const voice = this.sfxrVoices.get(noteNumber);
    if (!voice) return;
    
    try {
      if (voice.oscillator) {
        voice.oscillator.disconnect();
      }
      if (voice.noiseSource) {
        voice.noiseSource.disconnect();
      }
      voice.filterNode.disconnect();
      voice.gainNode.disconnect();
    } catch (e) {
      // Already disconnected
    }
    
    this.sfxrVoices.delete(noteNumber);
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    if (key in this.sfxrParams) {
      (this.sfxrParams as unknown as Record<string, number>)[key] = value;
    }
  }
  
  /**
   * Initialize instrument
   */
  protected initializeInstrument(): void {
    this.syncParamsToState();
  }
  
  /**
   * Get parameter descriptors
   */
  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    return [
      // Wave type
      { name: 'Wave Type', key: 'waveType', min: 0, max: 8, default: 0, step: 1, type: 'enum', 
        enumValues: ['Square', 'Sawtooth', 'Sine', 'Noise', 'Triangle', 'Pink Noise', 'Tan', 'Whistle', 'Breaker'], category: 'Wave' },
      
      // Envelope
      { name: 'Attack Time', key: 'attackTime', min: 0, max: 1, default: 0, category: 'Envelope' },
      { name: 'Sustain Time', key: 'sustainTime', min: 0, max: 1, default: 0.3, category: 'Envelope' },
      { name: 'Sustain Punch', key: 'sustainPunch', min: 0, max: 1, default: 0, category: 'Envelope' },
      { name: 'Decay Time', key: 'decayTime', min: 0, max: 1, default: 0.4, category: 'Envelope' },
      
      // Frequency
      { name: 'Start Frequency', key: 'startFrequency', min: 0, max: 1, default: 0.3, category: 'Frequency' },
      { name: 'Min Frequency', key: 'minFrequency', min: 0, max: 1, default: 0, category: 'Frequency' },
      { name: 'Slide', key: 'slide', min: -1, max: 1, default: 0, category: 'Frequency' },
      { name: 'Delta Slide', key: 'deltaSlide', min: -1, max: 1, default: 0, category: 'Frequency' },
      
      // Vibrato
      { name: 'Vibrato Depth', key: 'vibratoDepth', min: 0, max: 1, default: 0, category: 'Vibrato' },
      { name: 'Vibrato Speed', key: 'vibratoSpeed', min: 0, max: 1, default: 0, category: 'Vibrato' },
      
      // Arpeggiation
      { name: 'Change Amount', key: 'changeAmount', min: -1, max: 1, default: 0, category: 'Arpeggiation' },
      { name: 'Change Speed', key: 'changeSpeed', min: 0, max: 1, default: 0, category: 'Arpeggiation' },
      
      // Duty Cycle
      { name: 'Square Duty', key: 'squareDuty', min: 0, max: 1, default: 0.5, category: 'Duty Cycle' },
      { name: 'Duty Sweep', key: 'dutySweep', min: -1, max: 1, default: 0, category: 'Duty Cycle' },
      
      // Retrigger
      { name: 'Repeat Speed', key: 'repeatSpeed', min: 0, max: 1, default: 0, category: 'Retrigger' },
      
      // Flanger
      { name: 'Flanger Offset', key: 'flangerOffset', min: -1, max: 1, default: 0, category: 'Flanger' },
      { name: 'Flanger Sweep', key: 'flangerSweep', min: -1, max: 1, default: 0, category: 'Flanger' },
      
      // Low-pass Filter
      { name: 'LP Filter Cutoff', key: 'lpFilterCutoff', min: 0, max: 1, default: 1, category: 'Low-pass Filter' },
      { name: 'LP Filter Cutoff Sweep', key: 'lpFilterCutoffSweep', min: -1, max: 1, default: 0, category: 'Low-pass Filter' },
      { name: 'LP Filter Resonance', key: 'lpFilterResonance', min: 0, max: 1, default: 0, category: 'Low-pass Filter' },
      
      // High-pass Filter
      { name: 'HP Filter Cutoff', key: 'hpFilterCutoff', min: 0, max: 1, default: 0, category: 'High-pass Filter' },
      { name: 'HP Filter Cutoff Sweep', key: 'hpFilterCutoffSweep', min: -1, max: 1, default: 0, category: 'High-pass Filter' },
      
      // Master
      { name: 'Master Volume', key: 'masterVolume', min: 0, max: 1, default: 0.5, category: 'Master' }
    ];
  }
  
  /**
   * Get current sfxr parameters
   */
  getSfxrParams(): SfxrParams {
    return { ...this.sfxrParams };
  }
  
  /**
   * Set sfxr parameters
   */
  setSfxrParams(params: Partial<SfxrParams>): void {
    Object.assign(this.sfxrParams, params);
    this.syncParamsToState();
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    for (const noteNumber of this.sfxrVoices.keys()) {
      this.cleanupVoice(noteNumber);
    }
    super.dispose();
  }
}

// Factory function
export function createSfxr(audioContext: AudioContext, id?: string): Sfxr {
  return new Sfxr(audioContext, id || `sfxr-${Date.now()}`);
}

// Export types
export { SfxrWaveType as WaveType, SfxrCategory as Category };