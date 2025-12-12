// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * LB302 - TB-303 style bass synthesizer
 * Based on the original AnkhWaveStudio LB302 plugin
 * 
 * Features:
 * - Sawtooth and square wave oscillators (with band-limited variants)
 * - Resonant lowpass filter (12dB/oct and 24dB/oct modes)
 * - Filter cutoff frequency
 * - Filter resonance
 * - Filter envelope amount
 * - Accent
 * - Slide/portamento
 * - Decay time
 * - Distortion
 */

import { BaseInstrument, InstrumentParameterDescriptor, InstrumentPreset } from './BaseInstrument';
import { clamp, midiNoteToFrequency } from '../utils/AudioMath';

// Envelope recalculation period (samples)
const ENVINC = 64;

// Filter constants
const LB_DIST_RATIO = 4.0;
const LB_24_VOL_ADJUST = 3.0;

/**
 * Waveform types available in LB302
 */
export enum LB302Waveform {
  Sawtooth = 0,
  Triangle = 1,
  Square = 2,
  RoundSquare = 3,
  Moog = 4,
  Sine = 5,
  Exponential = 6,
  WhiteNoise = 7,
  BLSawtooth = 8,
  BLSquare = 9,
  BLTriangle = 10,
  BLMoog = 11,
}

/**
 * VCA (Voltage Controlled Amplifier) modes
 */
enum VcaMode {
  Attack = 0,
  Decay = 1,
  Idle = 2,
  NeverPlayed = 3,
}

/**
 * Filter state for LB302
 */
interface FilterState {
  cutoff: number;
  reso: number;
  envmod: number;
  envdecay: number;
  dist: number;
}

/**
 * Voice state for LB302
 */
interface LB302Voice {
  noteNumber: number;
  frequency: number;
  velocity: number;
  startTime: number;
  vcoInc: number;
  dead: boolean;
}

/**
 * LB302 - TB-303 style bass synthesizer
 */
export class LB302 extends BaseInstrument {
  private voices: Map<number, LB302Voice> = new Map();
  
  // Oscillator state
  private vcoC: number = 0;        // Oscillator phase [-0.5, 0.5]
  private vcoInc: number = 0;      // Phase increment per sample
  private vcoK: number = 0;        // Current oscillator output
  
  // Slide state
  private vcoSlide: number = 0;
  private vcoSlideInc: number = 0;
  private vcoSlideBase: number = 0;
  
  // Filter state
  private fs: FilterState = {
    cutoff: 0.75,
    reso: 0.75,
    envmod: 0.1,
    envdecay: 0.1,
    dist: 0,
  };
  
  // Filter coefficients (IIR2 - 12dB/oct)
  private vcfD1: number = 0;
  private vcfD2: number = 0;
  private vcfA: number = 0;
  private vcfB: number = 0;
  private vcfC: number = 1;
  
  // Filter coefficients (3-pole - 24dB/oct)
  private kfcn: number = 0;
  private kp: number = 0;
  private kp1: number = 0;
  private kp1h: number = 0;
  private kres: number = 0;
  private ay1: number = 0;
  private ay2: number = 0;
  private aout: number = 0;
  private lastin: number = 0;
  private filterValue: number = 1;
  
  // Filter envelope
  private vcfC0: number = 0;       // Envelope coefficient
  private vcfE0: number = 0;       // Base cutoff
  private vcfE1: number = 0;       // Envelope amount
  private vcfResCoeff: number = 0; // Resonance coefficient
  private vcfEnvPos: number = ENVINC;
  
  // VCA state
  private vcaMode: VcaMode = VcaMode.NeverPlayed;
  private vcaA: number = 0;        // Current amplitude
  private vcaA0: number = 0.5;     // Initial amplitude
  private vcaAttack: number = 1 - 0.96406088;
  
  // Sample counter
  private sampleCnt: number = 0;
  
  // Distortion waveshaper
  private distortionCurve: Float32Array;
  
  // Audio nodes
  private scriptProcessor: ScriptProcessorNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  
  constructor(audioContext: AudioContext, id: string, name: string = 'LB302') {
    super(audioContext, id, name, 'lb302');
    this.distortionCurve = this.createDistortionCurve(0);
    this.initializeInstrument();
    this.addDefaultPresets();
    this.setupAudioProcessing();
  }

  protected initializeInstrument(): void {
    // Initialize default parameters
    this.params = {
      cutoff: 0.75,        // VCF cutoff (0-1.5)
      resonance: 0.75,     // VCF resonance (0-1.25)
      envMod: 0.1,         // Envelope modulation (0-1)
      decay: 0.1,          // Envelope decay (0-1)
      distortion: 0,       // Distortion amount (0-1)
      waveform: LB302Waveform.BLSawtooth, // Waveform type
      slideDecay: 0.6,     // Slide decay (0-1)
      slide: 0,            // Slide toggle (0 or 1)
      accent: 0,           // Accent toggle (0 or 1)
      dead: 0,             // Dead note toggle (0 or 1)
      db24: 0,             // 24dB/oct filter toggle (0 or 1)
      gain: 0.8,           // Output gain (0-1)
    };
    
    // LB302 uses its own envelope system
    this.envelope = {
      attack: 0.001,
      decay: 0.2,
      sustain: 0,
      release: 0.01,
    };
    
    this.updateFilterState();
  }

  private setupAudioProcessing(): void {
    // Use ScriptProcessorNode for now (AudioWorklet would be better for production)
    const bufferSize = 256;
    this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 0, 1);
    
    this.scriptProcessor.onaudioprocess = (event) => {
      const output = event.outputBuffer.getChannelData(0);
      this.processAudio(output, output.length);
    };
    
    this.scriptProcessor.connect(this.volumeNode);
  }

  private processAudio(output: Float32Array, numSamples: number): void {
    const sampleRate = this.audioContext.sampleRate;
    const sampleRateCutoff = 44100; // Reference sample rate for filter
    const sampleRatio = 44100 / sampleRate;
    
    // Compute decay factor
    const decayFactor = this.computeDecayFactor(0.245260770975, 1 / 65536, sampleRate);
    
    for (let i = 0; i < numSamples; i++) {
      // Update filter envelope periodically
      if (this.vcfEnvPos >= ENVINC) {
        this.envRecalc(sampleRate, sampleRateCutoff);
        this.vcfEnvPos = 0;
        
        // Handle slide
        if (this.vcoSlide !== 0) {
          this.vcoInc = this.vcoSlideBase - this.vcoSlide;
          this.vcoSlide -= this.vcoSlide * (0.1 - this.params.slideDecay * 0.0999) * sampleRatio;
        }
      }
      
      this.sampleCnt++;
      this.vcfEnvPos++;
      
      // Update oscillator phase
      this.vcoC += this.vcoInc;
      if (this.vcoC > 0.5) {
        this.vcoC -= 1.0;
      }
      
      // Generate waveform
      this.generateWaveform();
      
      // Apply filter
      let sample: number;
      if (this.params.db24 > 0.5) {
        sample = this.process3PoleFilter(this.vcoK) * this.vcaA;
      } else {
        sample = this.processIIR2Filter(this.vcoK) * this.vcaA;
      }
      
      // Handle VCA envelope
      if (this.vcaMode === VcaMode.Attack) {
        this.vcaA += (this.vcaA0 - this.vcaA) * this.vcaAttack;
        if (this.sampleCnt >= 0.5 * sampleRate) {
          this.vcaMode = VcaMode.Idle;
        }
      } else if (this.vcaMode === VcaMode.Decay) {
        this.vcaA *= decayFactor;
        if (this.vcaA < 1 / 65536) {
          this.vcaA = 0;
          this.vcaMode = VcaMode.NeverPlayed;
        }
      }
      
      output[i] = sample;
    }
  }

  private computeDecayFactor(decayTimeInSeconds: number, targetedAttenuation: number, sampleRate: number): number {
    const samplesNeededForDecay = decayTimeInSeconds * sampleRate;
    return Math.pow(targetedAttenuation, 1 / samplesNeededForDecay);
  }

  private generateWaveform(): void {
    const waveform = Math.round(this.params.waveform) as LB302Waveform;
    
    switch (waveform) {
      case LB302Waveform.Sawtooth:
        this.vcoK = this.vcoC;
        break;
        
      case LB302Waveform.Triangle:
        this.vcoK = (this.vcoC * 2.0) + 0.5;
        if (this.vcoK > 0.5) {
          this.vcoK = 1.0 - this.vcoK;
        }
        break;
        
      case LB302Waveform.Square:
        this.vcoK = this.vcoC < 0 ? 0.5 : -0.5;
        break;
        
      case LB302Waveform.RoundSquare:
        this.vcoK = this.vcoC < 0 
          ? Math.sqrt(1 - this.vcoC * this.vcoC * 4) - 0.5 
          : -0.5;
        break;
        
      case LB302Waveform.Moog:
        this.vcoK = (this.vcoC * 2.0) + 0.5;
        if (this.vcoK > 1.0) {
          this.vcoK = -0.5;
        } else if (this.vcoK > 0.5) {
          const w = 2.0 * (this.vcoK - 0.5) - 1.0;
          this.vcoK = 0.5 - Math.sqrt(1.0 - w * w);
        }
        this.vcoK *= 2.0;
        break;
        
      case LB302Waveform.Sine:
        this.vcoK = 0.5 * Math.sin(this.vcoC * Math.PI * 2);
        break;
        
      case LB302Waveform.Exponential:
        this.vcoK = 0.5 * (Math.exp(Math.abs(this.vcoC) * 2) - 1) / (Math.E - 1) * Math.sign(this.vcoC);
        break;
        
      case LB302Waveform.WhiteNoise:
        this.vcoK = (Math.random() - 0.5);
        break;
        
      // Band-limited waveforms using PolyBLEP
      case LB302Waveform.BLSawtooth:
        this.vcoK = this.polyBlepSaw(this.vcoC, this.vcoInc);
        break;
        
      case LB302Waveform.BLSquare:
        this.vcoK = this.polyBlepSquare(this.vcoC, this.vcoInc);
        break;
        
      case LB302Waveform.BLTriangle:
        this.vcoK = this.polyBlepTriangle(this.vcoC, this.vcoInc);
        break;
        
      case LB302Waveform.BLMoog:
        this.vcoK = this.polyBlepMoog(this.vcoC, this.vcoInc);
        break;
        
      default:
        this.vcoK = this.vcoC;
    }
  }

  // PolyBLEP anti-aliasing function
  private polyBlep(t: number, dt: number): number {
    if (t < dt) {
      const t_dt = t / dt;
      return t_dt + t_dt - t_dt * t_dt - 1;
    } else if (t > 1 - dt) {
      const t_dt = (t - 1) / dt;
      return t_dt * t_dt + t_dt + t_dt + 1;
    }
    return 0;
  }

  private polyBlepSaw(phase: number, inc: number): number {
    const t = phase + 0.5; // Convert from [-0.5, 0.5] to [0, 1]
    let value = 2 * t - 1;
    value -= this.polyBlep(t, inc);
    return value * 0.5;
  }

  private polyBlepSquare(phase: number, inc: number): number {
    const t = phase + 0.5;
    let value = t < 0.5 ? 1 : -1;
    value += this.polyBlep(t, inc);
    value -= this.polyBlep((t + 0.5) % 1, inc);
    return value * 0.5;
  }

  private polyBlepTriangle(phase: number, inc: number): number {
    // Integrate square wave for triangle
    const square = this.polyBlepSquare(phase, inc);
    // Simple leaky integrator
    return square; // Simplified - full implementation would use proper integration
  }

  private polyBlepMoog(phase: number, inc: number): number {
    // Moog-style waveform with band limiting
    const saw = this.polyBlepSaw(phase, inc);
    return saw * 2; // Moog wave is essentially a louder saw
  }

  private updateFilterState(): void {
    this.fs.cutoff = this.params.cutoff;
    this.fs.reso = this.params.resonance;
    this.fs.envmod = this.params.envMod;
    this.fs.dist = LB_DIST_RATIO * this.params.distortion;
    
    const d = 0.2 + 2.3 * this.params.decay;
    const sampleRate = this.audioContext.sampleRate;
    this.fs.envdecay = Math.pow(0.1, 1.0 / (d * sampleRate) * ENVINC);
    
    this.recalcFilter();
  }

  private recalcFilter(): void {
    const sampleRate = this.audioContext.sampleRate;
    
    // Calculate filter envelope parameters
    this.vcfE1 = Math.exp(6.109 + 1.5876 * this.fs.envmod + 2.1553 * this.fs.cutoff - 1.2 * (1.0 - this.fs.reso));
    this.vcfE0 = Math.exp(5.613 - 0.8 * this.fs.envmod + 2.1553 * this.fs.cutoff - 0.7696 * (1.0 - this.fs.reso));
    this.vcfE0 *= Math.PI / sampleRate;
    this.vcfE1 *= Math.PI / sampleRate;
    this.vcfE1 -= this.vcfE0;
    
    this.vcfResCoeff = Math.exp(-1.20 + 3.455 * this.fs.reso);
    
    this.vcfEnvPos = ENVINC; // Trigger envelope recalc
  }

  private envRecalc(sampleRate: number, sampleRateCutoff: number): void {
    // Decay the envelope
    this.vcfC0 *= this.fs.envdecay;
    
    if (this.params.db24 > 0.5) {
      // 24dB/oct 3-pole filter
      const w = this.vcfE0 + this.vcfC0;
      const k = this.fs.cutoff > 0.975 ? 0.975 : this.fs.cutoff;
      
      const kfco = 50 + k * ((2300 - 1600 * this.fs.envmod) + w * 
        (700 + 1500 * k + (1500 + k * (sampleRateCutoff / 2 - 6000)) * this.fs.envmod));
      
      this.kfcn = 2.0 * kfco / sampleRate;
      this.kp = ((-2.7528 * this.kfcn + 3.0429) * this.kfcn + 1.718) * this.kfcn - 0.9984;
      this.kp1 = this.kp + 1.0;
      this.kp1h = 0.5 * this.kp1;
      this.kres = this.fs.reso * (((-2.7079 * this.kp1 + 10.963) * this.kp1 - 14.934) * this.kp1 + 8.4974);
      this.filterValue = 1.0 + this.fs.dist * (1.5 + 2.0 * this.kres * (1.0 - this.kfcn));
    } else {
      // 12dB/oct IIR2 filter
      const w = this.vcfE0 + this.vcfC0;
      const k = Math.exp(-w / this.vcfResCoeff);
      
      this.vcfA = 2.0 * Math.cos(2.0 * w) * k;
      this.vcfB = -k * k;
      this.vcfC = 1.0 - this.vcfA - this.vcfB;
    }
  }

  private processIIR2Filter(sample: number): number {
    let ret = this.vcfA * this.vcfD1 + this.vcfB * this.vcfD2 + this.vcfC * sample;
    this.vcfD2 = this.vcfD1;
    this.vcfD1 = ret;
    
    // Apply distortion if enabled
    if (this.fs.dist > 0) {
      ret = this.applyDistortion(ret);
    }
    
    return ret;
  }

  private process3PoleFilter(sample: number): number {
    const ax1 = this.lastin;
    const ay11 = this.ay1;
    const ay31 = this.ay2;
    
    this.lastin = sample - Math.tanh(this.kres * this.aout);
    this.ay1 = this.kp1h * (this.lastin + ax1) - this.kp * this.ay1;
    this.ay2 = this.kp1h * (this.ay1 + ay11) - this.kp * this.ay2;
    this.aout = this.kp1h * (this.ay2 + ay31) - this.kp * this.aout;
    
    return Math.tanh(this.aout * this.filterValue) * LB_24_VOL_ADJUST / (1.0 + this.fs.dist);
  }

  private applyDistortion(sample: number): number {
    const threshold = this.fs.dist * 75.0;
    if (threshold <= 0) return sample;
    
    // Soft clipping distortion
    const k = threshold;
    const deg = Math.PI / 180;
    return ((3 + k) * sample * 20 * deg) / (Math.PI + k * Math.abs(sample));
  }

  private createDistortionCurve(amount: number): Float32Array {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    if (amount === 0) {
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = x;
      }
    } else {
      const k = amount * 100;
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
    }
    
    return curve;
  }

  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    return [
      {
        name: 'VCF Cutoff',
        key: 'cutoff',
        min: 0,
        max: 1.5,
        default: 0.75,
        step: 0.005,
        category: 'Filter',
      },
      {
        name: 'VCF Resonance',
        key: 'resonance',
        min: 0,
        max: 1.25,
        default: 0.75,
        step: 0.005,
        category: 'Filter',
      },
      {
        name: 'Env Mod',
        key: 'envMod',
        min: 0,
        max: 1,
        default: 0.1,
        step: 0.005,
        category: 'Filter',
      },
      {
        name: 'Decay',
        key: 'decay',
        min: 0,
        max: 1,
        default: 0.1,
        step: 0.005,
        category: 'Filter',
      },
      {
        name: 'Distortion',
        key: 'distortion',
        min: 0,
        max: 1,
        default: 0,
        step: 0.01,
        category: 'Tone',
      },
      {
        name: 'Waveform',
        key: 'waveform',
        min: 0,
        max: 11,
        default: LB302Waveform.BLSawtooth,
        type: 'enum',
        enumValues: [
          'Sawtooth', 'Triangle', 'Square', 'Round Square',
          'Moog', 'Sine', 'Exponential', 'White Noise',
          'BL Sawtooth', 'BL Square', 'BL Triangle', 'BL Moog'
        ],
        category: 'Oscillator',
      },
      {
        name: 'Slide Decay',
        key: 'slideDecay',
        min: 0,
        max: 1,
        default: 0.6,
        step: 0.005,
        category: 'Slide',
      },
      {
        name: 'Slide',
        key: 'slide',
        min: 0,
        max: 1,
        default: 0,
        type: 'boolean',
        category: 'Slide',
      },
      {
        name: 'Accent',
        key: 'accent',
        min: 0,
        max: 1,
        default: 0,
        type: 'boolean',
        category: 'Tone',
      },
      {
        name: 'Dead',
        key: 'dead',
        min: 0,
        max: 1,
        default: 0,
        type: 'boolean',
        category: 'Tone',
      },
      {
        name: '24dB/oct',
        key: 'db24',
        min: 0,
        max: 1,
        default: 0,
        type: 'boolean',
        category: 'Filter',
      },
      {
        name: 'Gain',
        key: 'gain',
        min: 0,
        max: 1,
        default: 0.8,
        category: 'Output',
      },
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    switch (key) {
      case 'cutoff':
      case 'resonance':
      case 'envMod':
      case 'decay':
      case 'distortion':
      case 'db24':
        this.updateFilterState();
        break;
    }
  }

  protected silenceNote(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
    if (voice) {
      this.voices.delete(noteNumber);
      this.vcaMode = VcaMode.Idle;
      this.vcaA = 0;
    }
  }

  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    // Stop existing voice for this note
    if (this.voices.has(noteNumber)) {
      this.releaseNote(noteNumber);
    }

    const vcoInc = frequency / this.audioContext.sampleRate;
    const dead = this.params.dead > 0.5;
    
    // Store voice
    const voice: LB302Voice = {
      noteNumber,
      frequency,
      velocity,
      startTime: this.audioContext.currentTime,
      vcoInc,
      dead,
    };
    this.voices.set(noteNumber, voice);
    
    // Initialize note
    this.initNote(voice);
  }

  private initNote(note: LB302Voice): void {
    this.vcoInc = note.vcoInc;
    
    // Reset VCA on non-dead notes or when decayed
    if (!note.dead || this.vcaMode === VcaMode.Decay || this.vcaMode === VcaMode.NeverPlayed) {
      this.sampleCnt = 0;
      this.vcaMode = VcaMode.Attack;
    } else {
      this.vcaMode = VcaMode.Idle;
    }
    
    // Initialize slide
    this.initSlide();
    
    // Handle slide-from note
    if (this.params.slide > 0.5) {
      this.vcoSlideInc = this.vcoInc;
    }
    
    // Recalculate filter
    this.recalcFilter();
    
    if (!note.dead) {
      // Play note - reset filter envelope
      this.vcfC0 = this.vcfE1;
      this.vcfEnvPos = ENVINC;
    }
  }

  private initSlide(): void {
    if (this.vcoSlideInc !== 0) {
      this.vcoSlide = this.vcoInc - this.vcoSlideInc;
      this.vcoSlideBase = this.vcoInc;
      this.vcoSlideInc = 0;
    } else {
      this.vcoSlide = 0;
    }
  }

  protected releaseNote(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
    if (!voice) return;
    
    this.voices.delete(noteNumber);
    
    // Start decay
    this.vcaMode = VcaMode.Decay;
  }

  private addDefaultPresets(): void {
    const presets: InstrumentPreset[] = [
      {
        name: 'Classic Acid',
        params: {
          cutoff: 0.5,
          resonance: 0.9,
          envMod: 0.6,
          decay: 0.3,
          distortion: 0.2,
          waveform: LB302Waveform.BLSawtooth,
          slideDecay: 0.6,
          slide: 0,
          db24: 1,
          gain: 0.8,
        },
      },
      {
        name: 'Squelchy Bass',
        params: {
          cutoff: 0.3,
          resonance: 1.1,
          envMod: 0.8,
          decay: 0.2,
          distortion: 0.1,
          waveform: LB302Waveform.BLSquare,
          slideDecay: 0.5,
          slide: 1,
          db24: 1,
          gain: 0.75,
        },
      },
      {
        name: 'Deep Sub',
        params: {
          cutoff: 0.2,
          resonance: 0.5,
          envMod: 0.2,
          decay: 0.5,
          distortion: 0,
          waveform: LB302Waveform.Sine,
          slideDecay: 0.6,
          slide: 0,
          db24: 0,
          gain: 0.9,
        },
      },
      {
        name: 'Resonant Lead',
        params: {
          cutoff: 0.7,
          resonance: 1.0,
          envMod: 0.5,
          decay: 0.15,
          distortion: 0.3,
          waveform: LB302Waveform.BLSawtooth,
          slideDecay: 0.4,
          slide: 1,
          db24: 1,
          gain: 0.7,
        },
      },
      {
        name: 'Dirty Acid',
        params: {
          cutoff: 0.6,
          resonance: 1.2,
          envMod: 0.7,
          decay: 0.25,
          distortion: 0.6,
          waveform: LB302Waveform.BLSawtooth,
          slideDecay: 0.5,
          slide: 1,
          db24: 1,
          gain: 0.65,
        },
      },
      {
        name: 'Mellow Bass',
        params: {
          cutoff: 0.4,
          resonance: 0.3,
          envMod: 0.3,
          decay: 0.4,
          distortion: 0,
          waveform: LB302Waveform.Triangle,
          slideDecay: 0.6,
          slide: 0,
          db24: 0,
          gain: 0.85,
        },
      },
      {
        name: 'Screaming Lead',
        params: {
          cutoff: 0.9,
          resonance: 1.1,
          envMod: 0.4,
          decay: 0.1,
          distortion: 0.4,
          waveform: LB302Waveform.BLSquare,
          slideDecay: 0.3,
          slide: 1,
          db24: 1,
          gain: 0.6,
        },
      },
      {
        name: 'Warm Pad',
        params: {
          cutoff: 0.5,
          resonance: 0.4,
          envMod: 0.1,
          decay: 0.8,
          distortion: 0,
          waveform: LB302Waveform.BLTriangle,
          slideDecay: 0.7,
          slide: 0,
          db24: 0,
          gain: 0.8,
        },
      },
    ];

    for (const preset of presets) {
      this.addPreset(preset);
    }
  }

  dispose(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    this.voices.clear();
    super.dispose();
  }
}