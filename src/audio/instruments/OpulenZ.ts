// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * OpulenZ - OPL2/OPL3 FM Synthesizer Emulator
 * Emulates the Yamaha OPL2/OPL3 FM synthesis chips
 * 
 * Features:
 * - 2-operator FM synthesis (OPL2)
 * - 4-operator FM synthesis (OPL3)
 * - Multiple FM algorithms
 * - Percussion mode
 * - Authentic OPL waveforms
 */

import { BaseInstrument, type InstrumentParameterDescriptor } from './BaseInstrument';
import { midiNoteToFrequency, clamp } from '../utils/AudioMath';

// ============================================================================
// Types
// ============================================================================

/**
 * OPL waveform types
 */
export type OplWaveform = 'sine' | 'half-sine' | 'abs-sine' | 'pulse-sine' | 
                          'sine-even' | 'abs-sine-even' | 'square' | 'derived-square';

/**
 * FM algorithm types
 */
export type FmAlgorithm = 0 | 1 | 2 | 3; // Different operator connections

/**
 * Operator configuration
 */
export interface OplOperator {
  enabled: boolean;
  waveform: OplWaveform;
  level: number; // 0-1 output level
  multiple: number; // Frequency multiplier (0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15)
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  feedback: number; // Self-modulation amount (0-7)
  tremolo: boolean;
  vibrato: boolean;
  sustainMode: boolean; // EG type
  ksr: boolean; // Key scale rate
}

/**
 * Active voice state
 */
interface OpulenZActiveVoice {
  noteNumber: number;
  velocity: number;
  operators: OscillatorNode[];
  gains: GainNode[];
  envelopes: GainNode[];
  modulators: GainNode[];
  startTime: number;
  released: boolean;
}

// ============================================================================
// OpulenZ Instrument
// ============================================================================

export class OpulenZ extends BaseInstrument {
  // Operators (4 for OPL3 mode)
  private operators: OplOperator[] = [];
  
  // FM settings
  private algorithm: FmAlgorithm = 0;
  private is4Op: boolean = false; // OPL3 4-operator mode
  
  // Active voices
  private opulenZVoices: Map<number, OpulenZActiveVoice> = new Map();
  
  // OPL waveform periodic waves
  private oplWaves: Map<OplWaveform, PeriodicWave> = new Map();
  
  // Frequency multipliers available in OPL
  private readonly freqMultipliers = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 12, 12, 15, 15];
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'OpulenZ', 'opulenz');
    
    // Initialize operators
    this.initializeOperators();
    
    // Generate OPL waveforms
    this.generateOplWaveforms();
    
    // Initialize
    this.initializeInstrument();
  }
  
  /**
   * Initialize operator configurations
   */
  private initializeOperators(): void {
    // Default 2-operator FM setup
    this.operators = [
      // Modulator (Operator 1)
      {
        enabled: true,
        waveform: 'sine',
        level: 0.8,
        multiple: 1,
        attack: 0.01,
        decay: 0.2,
        sustain: 0.5,
        release: 0.3,
        feedback: 0,
        tremolo: false,
        vibrato: false,
        sustainMode: true,
        ksr: false,
      },
      // Carrier (Operator 2)
      {
        enabled: true,
        waveform: 'sine',
        level: 0.8,
        multiple: 1,
        attack: 0.01,
        decay: 0.1,
        sustain: 0.7,
        release: 0.3,
        feedback: 0,
        tremolo: false,
        vibrato: false,
        sustainMode: true,
        ksr: false,
      },
      // Operator 3 (OPL3 only)
      {
        enabled: false,
        waveform: 'sine',
        level: 0.5,
        multiple: 2,
        attack: 0.01,
        decay: 0.1,
        sustain: 0.6,
        release: 0.3,
        feedback: 0,
        tremolo: false,
        vibrato: false,
        sustainMode: true,
        ksr: false,
      },
      // Operator 4 (OPL3 only)
      {
        enabled: false,
        waveform: 'sine',
        level: 0.8,
        multiple: 1,
        attack: 0.01,
        decay: 0.1,
        sustain: 0.7,
        release: 0.3,
        feedback: 0,
        tremolo: false,
        vibrato: false,
        sustainMode: true,
        ksr: false,
      },
    ];
  }
  
  /**
   * Generate OPL-style waveforms
   */
  private generateOplWaveforms(): void {
    const harmonics = 64;
    
    // Sine wave
    this.createPeriodicWave('sine', (n) => n === 1 ? 1 : 0);
    
    // Half-sine (only positive half)
    this.createPeriodicWave('half-sine', (n) => {
      if (n === 0) return 0.5;
      return n % 2 === 1 ? 2 / (Math.PI * (1 - n * n)) : 0;
    });
    
    // Absolute sine (full-wave rectified)
    this.createPeriodicWave('abs-sine', (n) => {
      if (n === 0) return 2 / Math.PI;
      return n % 2 === 0 ? -4 / (Math.PI * (n * n - 1)) : 0;
    });
    
    // Pulse sine (quarter sine repeated)
    this.createPeriodicWave('pulse-sine', (n) => {
      return Math.sin(n * Math.PI / 4) / n || 0;
    });
    
    // Sine (even harmonics only)
    this.createPeriodicWave('sine-even', (n) => n === 2 ? 1 : 0);
    
    // Absolute sine (even harmonics)
    this.createPeriodicWave('abs-sine-even', (n) => {
      if (n % 2 === 0 && n > 0) return 1 / n;
      return 0;
    });
    
    // Square wave
    this.createPeriodicWave('square', (n) => n % 2 === 1 ? 4 / (Math.PI * n) : 0);
    
    // Derived square (logarithmic)
    this.createPeriodicWave('derived-square', (n) => {
      if (n % 2 === 1) return 1 / (n * n);
      return 0;
    });
  }
  
  /**
   * Create a periodic wave from harmonic function
   */
  private createPeriodicWave(name: OplWaveform, harmonicFn: (n: number) => number): void {
    const harmonics = 64;
    const real = new Float32Array(harmonics);
    const imag = new Float32Array(harmonics);
    
    for (let n = 0; n < harmonics; n++) {
      imag[n] = harmonicFn(n);
    }
    
    const wave = this.audioContext.createPeriodicWave(real, imag, { disableNormalization: false });
    this.oplWaves.set(name, wave);
  }
  
  /**
   * Apply ADSR envelope
   */
  private applyEnvelope(
    gainNode: GainNode,
    op: OplOperator,
    velocity: number,
    startTime: number
  ): void {
    const gain = gainNode.gain;
    const peakLevel = velocity * op.level;
    const sustainLevel = peakLevel * op.sustain;
    
    gain.cancelScheduledValues(startTime);
    gain.setValueAtTime(0, startTime);
    
    // Attack
    gain.linearRampToValueAtTime(peakLevel, startTime + op.attack);
    
    // Decay to sustain
    gain.exponentialRampToValueAtTime(
      Math.max(sustainLevel, 0.001),
      startTime + op.attack + op.decay
    );
  }
  
  /**
   * Apply release envelope
   */
  private applyRelease(
    gainNode: GainNode,
    op: OplOperator,
    releaseTime: number
  ): void {
    const gain = gainNode.gain;
    const currentValue = gain.value;
    
    gain.cancelScheduledValues(releaseTime);
    gain.setValueAtTime(currentValue, releaseTime);
    gain.exponentialRampToValueAtTime(0.001, releaseTime + op.release);
  }
  
  /**
   * Create FM voice based on algorithm
   */
  private createFmVoice(
    frequency: number,
    velocity: number,
    startTime: number
  ): OpulenZActiveVoice {
    const voice: OpulenZActiveVoice = {
      noteNumber: 0,
      velocity,
      operators: [],
      gains: [],
      envelopes: [],
      modulators: [],
      startTime,
      released: false,
    };
    
    const numOps = this.is4Op ? 4 : 2;
    const activeOps: { osc: OscillatorNode; gain: GainNode; env: GainNode; mod: GainNode }[] = [];
    
    // Create oscillators for each operator
    for (let i = 0; i < numOps; i++) {
      const op = this.operators[i];
      if (!op.enabled) continue;
      
      const osc = this.audioContext.createOscillator();
      const freq = frequency * this.freqMultipliers[Math.floor(op.multiple)];
      osc.frequency.value = freq;
      
      // Set waveform
      const wave = this.oplWaves.get(op.waveform);
      if (wave) {
        osc.setPeriodicWave(wave);
      }
      
      // Create gain nodes
      const gain = this.audioContext.createGain();
      gain.gain.value = 1;
      
      const env = this.audioContext.createGain();
      this.applyEnvelope(env, op, velocity, startTime);
      
      const mod = this.audioContext.createGain();
      mod.gain.value = op.level * 1000; // Modulation depth
      
      voice.operators.push(osc);
      voice.gains.push(gain);
      voice.envelopes.push(env);
      voice.modulators.push(mod);
      
      activeOps.push({ osc, gain, env, mod });
    }
    
    // Connect based on algorithm
    if (this.is4Op && activeOps.length >= 4) {
      this.connect4OpAlgorithm(activeOps, this.algorithm);
    } else if (activeOps.length >= 2) {
      this.connect2OpAlgorithm(activeOps, this.algorithm);
    } else if (activeOps.length === 1) {
      // Single operator - direct output
      activeOps[0].osc.connect(activeOps[0].gain);
      activeOps[0].gain.connect(activeOps[0].env);
      activeOps[0].env.connect(this.volumeNode);
    }
    
    // Start oscillators
    for (const { osc } of activeOps) {
      osc.start(startTime);
    }
    
    return voice;
  }
  
  /**
   * Connect 2-operator FM algorithm
   */
  private connect2OpAlgorithm(
    ops: { osc: OscillatorNode; gain: GainNode; env: GainNode; mod: GainNode }[],
    algorithm: FmAlgorithm
  ): void {
    const [op1, op2] = ops;
    
    switch (algorithm) {
      case 0:
        // Algorithm 0: Op1 -> Op2 -> Output (standard FM)
        op1.osc.connect(op1.mod);
        op1.mod.connect(op2.osc.frequency);
        op2.osc.connect(op2.gain);
        op2.gain.connect(op2.env);
        op2.env.connect(this.volumeNode);
        break;
        
      case 1:
        // Algorithm 1: Op1 + Op2 -> Output (additive)
        op1.osc.connect(op1.gain);
        op1.gain.connect(op1.env);
        op1.env.connect(this.volumeNode);
        
        op2.osc.connect(op2.gain);
        op2.gain.connect(op2.env);
        op2.env.connect(this.volumeNode);
        break;
        
      default:
        // Default to algorithm 0
        op1.osc.connect(op1.mod);
        op1.mod.connect(op2.osc.frequency);
        op2.osc.connect(op2.gain);
        op2.gain.connect(op2.env);
        op2.env.connect(this.volumeNode);
    }
  }
  
  /**
   * Connect 4-operator FM algorithm
   */
  private connect4OpAlgorithm(
    ops: { osc: OscillatorNode; gain: GainNode; env: GainNode; mod: GainNode }[],
    algorithm: FmAlgorithm
  ): void {
    const [op1, op2, op3, op4] = ops;
    
    switch (algorithm) {
      case 0:
        // Algorithm 0: Op1 -> Op2 -> Op3 -> Op4 -> Output (serial)
        op1.osc.connect(op1.mod);
        op1.mod.connect(op2.osc.frequency);
        op2.osc.connect(op2.mod);
        op2.mod.connect(op3.osc.frequency);
        op3.osc.connect(op3.mod);
        op3.mod.connect(op4.osc.frequency);
        op4.osc.connect(op4.gain);
        op4.gain.connect(op4.env);
        op4.env.connect(this.volumeNode);
        break;
        
      case 1:
        // Algorithm 1: (Op1 + Op2) -> Op3 -> Op4 -> Output
        op1.osc.connect(op1.mod);
        op2.osc.connect(op2.mod);
        op1.mod.connect(op3.osc.frequency);
        op2.mod.connect(op3.osc.frequency);
        op3.osc.connect(op3.mod);
        op3.mod.connect(op4.osc.frequency);
        op4.osc.connect(op4.gain);
        op4.gain.connect(op4.env);
        op4.env.connect(this.volumeNode);
        break;
        
      case 2:
        // Algorithm 2: Op1 -> Op2, Op3 -> Op4, both to output
        op1.osc.connect(op1.mod);
        op1.mod.connect(op2.osc.frequency);
        op2.osc.connect(op2.gain);
        op2.gain.connect(op2.env);
        op2.env.connect(this.volumeNode);
        
        op3.osc.connect(op3.mod);
        op3.mod.connect(op4.osc.frequency);
        op4.osc.connect(op4.gain);
        op4.gain.connect(op4.env);
        op4.env.connect(this.volumeNode);
        break;
        
      case 3:
        // Algorithm 3: All operators to output (additive)
        for (const op of ops) {
          op.osc.connect(op.gain);
          op.gain.connect(op.env);
          op.env.connect(this.volumeNode);
        }
        break;
    }
  }
  
  /**
   * Trigger a note
   */
  protected silenceNote(noteNumber: number): void {
    this.cleanupVoice(noteNumber);
  }

  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    const startTime = this.audioContext.currentTime;
    
    const voice = this.createFmVoice(frequency, velocity, startTime);
    voice.noteNumber = noteNumber;
    
    this.opulenZVoices.set(noteNumber, voice);
  }
  
  /**
   * Release a note
   */
  protected releaseNote(noteNumber: number): void {
    const voice = this.opulenZVoices.get(noteNumber);
    if (!voice || voice.released) return;
    
    voice.released = true;
    const releaseTime = this.audioContext.currentTime;
    
    // Apply release to all envelopes
    const numOps = this.is4Op ? 4 : 2;
    let envIndex = 0;
    
    for (let i = 0; i < numOps; i++) {
      const op = this.operators[i];
      if (!op.enabled) continue;
      
      if (envIndex < voice.envelopes.length) {
        this.applyRelease(voice.envelopes[envIndex], op, releaseTime);
        envIndex++;
      }
    }
    
    // Schedule cleanup
    const maxRelease = Math.max(...this.operators.map(op => op.release));
    setTimeout(() => {
      this.cleanupVoice(noteNumber);
    }, (maxRelease + 0.1) * 1000);
  }
  
  /**
   * Clean up a voice
   */
  private cleanupVoice(noteNumber: number): void {
    const voice = this.opulenZVoices.get(noteNumber);
    if (!voice) return;
    
    // Stop and disconnect oscillators
    for (const osc of voice.operators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // Already stopped
      }
    }
    
    // Disconnect all nodes
    for (const gain of voice.gains) {
      gain.disconnect();
    }
    for (const env of voice.envelopes) {
      env.disconnect();
    }
    for (const mod of voice.modulators) {
      mod.disconnect();
    }
    
    this.opulenZVoices.delete(noteNumber);
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    // Global parameters
    if (key === 'algorithm') {
      this.algorithm = Math.floor(value) as FmAlgorithm;
      return;
    }
    
    if (key === 'is4Op') {
      this.is4Op = value > 0.5;
      // Enable/disable operators 3 and 4
      this.operators[2].enabled = this.is4Op;
      this.operators[3].enabled = this.is4Op;
      return;
    }
    
    // Operator parameters
    const parts = key.split('_');
    if (parts[0].startsWith('op')) {
      const opIndex = parseInt(parts[0].replace('op', '')) - 1;
      const param = parts[1];
      
      if (opIndex >= 0 && opIndex < this.operators.length) {
        const op = this.operators[opIndex];
        
        switch (param) {
          case 'enabled':
            op.enabled = value > 0.5;
            break;
          case 'waveform':
            const waveforms: OplWaveform[] = ['sine', 'half-sine', 'abs-sine', 'pulse-sine', 
                                               'sine-even', 'abs-sine-even', 'square', 'derived-square'];
            op.waveform = waveforms[Math.floor(value)] || 'sine';
            break;
          case 'level':
            op.level = value;
            break;
          case 'multiple':
            op.multiple = Math.floor(value);
            break;
          case 'attack':
            op.attack = value;
            break;
          case 'decay':
            op.decay = value;
            break;
          case 'sustain':
            op.sustain = value;
            break;
          case 'release':
            op.release = value;
            break;
          case 'feedback':
            op.feedback = Math.floor(value);
            break;
          case 'tremolo':
            op.tremolo = value > 0.5;
            break;
          case 'vibrato':
            op.vibrato = value > 0.5;
            break;
        }
      }
    }
  }
  
  /**
   * Initialize instrument
   */
  protected initializeInstrument(): void {
    this.params['algorithm'] = this.algorithm;
    this.params['is4Op'] = this.is4Op ? 1 : 0;
    
    for (let i = 0; i < 4; i++) {
      const op = this.operators[i];
      const prefix = `op${i + 1}`;
      
      this.params[`${prefix}_enabled`] = op.enabled ? 1 : 0;
      this.params[`${prefix}_waveform`] = 0; // sine
      this.params[`${prefix}_level`] = op.level;
      this.params[`${prefix}_multiple`] = op.multiple;
      this.params[`${prefix}_attack`] = op.attack;
      this.params[`${prefix}_decay`] = op.decay;
      this.params[`${prefix}_sustain`] = op.sustain;
      this.params[`${prefix}_release`] = op.release;
      this.params[`${prefix}_feedback`] = op.feedback;
    }
  }
  
  /**
   * Get parameter descriptors
   */
  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    const descriptors: InstrumentParameterDescriptor[] = [];
    
    // Global parameters
    descriptors.push(
      { name: 'Algorithm', key: 'algorithm', min: 0, max: 3, default: 0, step: 1, type: 'enum', enumValues: ['Serial', 'Parallel Mod', 'Dual FM', 'Additive'], category: 'Global' },
      { name: '4-Operator Mode', key: 'is4Op', min: 0, max: 1, default: 0, type: 'boolean', category: 'Global' }
    );
    
    // Operator parameters
    const waveformNames = ['Sine', 'Half-Sine', 'Abs-Sine', 'Pulse-Sine', 'Sine-Even', 'Abs-Sine-Even', 'Square', 'Derived-Square'];
    
    for (let i = 0; i < 4; i++) {
      const prefix = `op${i + 1}`;
      const category = `Operator ${i + 1}`;
      const isCarrier = i === 1 || i === 3;
      
      descriptors.push(
        { name: `Op ${i + 1} Enabled`, key: `${prefix}_enabled`, min: 0, max: 1, default: i < 2 ? 1 : 0, type: 'boolean', category },
        { name: `Op ${i + 1} Waveform`, key: `${prefix}_waveform`, min: 0, max: 7, default: 0, step: 1, type: 'enum', enumValues: waveformNames, category },
        { name: `Op ${i + 1} Level`, key: `${prefix}_level`, min: 0, max: 1, default: isCarrier ? 0.8 : 0.5, category },
        { name: `Op ${i + 1} Multiple`, key: `${prefix}_multiple`, min: 0, max: 15, default: 1, step: 1, category },
        { name: `Op ${i + 1} Attack`, key: `${prefix}_attack`, min: 0.001, max: 2, default: 0.01, unit: 's', category },
        { name: `Op ${i + 1} Decay`, key: `${prefix}_decay`, min: 0.001, max: 2, default: isCarrier ? 0.1 : 0.2, unit: 's', category },
        { name: `Op ${i + 1} Sustain`, key: `${prefix}_sustain`, min: 0, max: 1, default: isCarrier ? 0.7 : 0.5, category },
        { name: `Op ${i + 1} Release`, key: `${prefix}_release`, min: 0.001, max: 5, default: 0.3, unit: 's', category },
        { name: `Op ${i + 1} Feedback`, key: `${prefix}_feedback`, min: 0, max: 7, default: 0, step: 1, category }
      );
    }
    
    return descriptors;
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    // Clean up all voices
    for (const noteNumber of this.opulenZVoices.keys()) {
      this.cleanupVoice(noteNumber);
    }
    
    super.dispose();
  }
}

// Factory function
export function createOpulenZ(audioContext: AudioContext, id?: string): OpulenZ {
  return new OpulenZ(audioContext, id || `opulenz-${Date.now()}`);
}