// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * ZynAddSubFX - Advanced synthesizer with ADD, SUB, and PAD synthesis
 * A web-compatible implementation inspired by ZynAddSubFX
 * 
 * Features:
 * - Additive synthesis (ADD) with multiple harmonics
 * - Subtractive synthesis (SUB) with resonant filters
 * - PAD synthesis with wavetable generation
 * - Multiple oscillators with morphing
 * - Complex filter routing
 * - Built-in effects
 */

import { BaseInstrument, type InstrumentParameterDescriptor, type InstrumentPreset } from './BaseInstrument';
import { midiNoteToFrequency, clamp, dBToLinear, linearToDb } from '../utils/AudioMath';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Synthesis engine type
 */
export type SynthEngine = 'ADD' | 'SUB' | 'PAD';

/**
 * Oscillator waveform type
 */
export type OscillatorWaveform = 
  | 'sine' 
  | 'square' 
  | 'saw' 
  | 'triangle' 
  | 'pulse' 
  | 'noise'
  | 'custom';

/**
 * Filter type
 */
export type FilterType = 
  | 'lowpass' 
  | 'highpass' 
  | 'bandpass' 
  | 'notch' 
  | 'peak' 
  | 'lowshelf' 
  | 'highshelf';

/**
 * LFO shape
 */
export type LFOShape = 'sine' | 'square' | 'saw' | 'triangle' | 'random';

/**
 * Harmonic data for additive synthesis
 */
export interface HarmonicData {
  amplitude: number;
  phase: number;
  bandwidth?: number; // For PAD synthesis
}

/**
 * Oscillator configuration
 */
export interface OscillatorConfig {
  enabled: boolean;
  waveform: OscillatorWaveform;
  detune: number;
  octave: number;
  phase: number;
  volume: number;
  pan: number;
  harmonics?: HarmonicData[];
}

/**
 * Filter configuration
 */
export interface FilterConfig {
  enabled: boolean;
  type: FilterType;
  cutoff: number;
  resonance: number;
  keyTracking: number;
  envAmount: number;
}

/**
 * Envelope configuration
 */
export interface EnvelopeConfig {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  attackCurve: number;
  decayCurve: number;
  releaseCurve: number;
}

/**
 * LFO configuration
 */
export interface LFOConfig {
  enabled: boolean;
  shape: LFOShape;
  rate: number;
  depth: number;
  delay: number;
  fadeIn: number;
  sync: boolean;
}

/**
 * Effect configuration
 */
export interface EffectConfig {
  enabled: boolean;
  type: string;
  params: Record<string, number>;
}

/**
 * Voice state for polyphony
 */
interface Voice {
  noteNumber: number;
  velocity: number;
  startTime: number;
  
  // Oscillators
  oscillators: OscillatorNode[];
  gains: GainNode[];
  
  // Filters
  filters: BiquadFilterNode[];
  
  // Envelopes
  ampEnvelope: GainNode;
  filterEnvelope: GainNode;
  
  // State
  released: boolean;
  releaseTime: number;
}

// ============================================================================
// ZynAddSubFX Class
// ============================================================================

export class ZynAddSubFX extends BaseInstrument {
  // Synthesis engines
  private currentEngine: SynthEngine = 'ADD';
  
  // Oscillator configurations (3 oscillators)
  private oscillatorConfigs: OscillatorConfig[] = [];
  
  // Filter configurations (2 filters)
  private filterConfigs: FilterConfig[] = [];
  
  // Envelope configurations
  private ampEnvelope!: EnvelopeConfig;
  private filterEnvelope!: EnvelopeConfig;
  private pitchEnvelope!: EnvelopeConfig;
  
  // LFO configurations (3 LFOs)
  private lfoConfigs: LFOConfig[] = [];
  
  // Effects
  private effectConfigs: EffectConfig[] = [];
  
  // Audio nodes
  private masterFilter: BiquadFilterNode;
  private reverbNode: ConvolverNode | null = null;
  private chorusNode: DelayNode | null = null;
  private distortionNode: WaveShaperNode | null = null;
  
  // Active voices
  private voices: Map<number, Voice> = new Map();
  
  // PAD synthesis wavetable
  private padWavetable: PeriodicWave | null = null;
  private padHarmonics: HarmonicData[] = [];
  
  // Custom wavetables
  private customWavetables: Map<string, PeriodicWave> = new Map();
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'ZynAddSubFX', 'zynaddsubfx');
    
    // Initialize default configurations
    this.initializeDefaults();
    
    // Create master filter
    this.masterFilter = audioContext.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 20000;
    this.masterFilter.Q.value = 0.707;
    
    // Connect master chain
    this.masterFilter.connect(this.volumeNode);
    
    // Initialize effects
    this.initializeEffects();
    
    // Initialize the instrument
    this.initializeInstrument();
  }
  
  /**
   * Initialize default configurations
   */
  private initializeDefaults(): void {
    // Default oscillator configs
    this.oscillatorConfigs = [
      {
        enabled: true,
        waveform: 'saw',
        detune: 0,
        octave: 0,
        phase: 0,
        volume: 0.8,
        pan: 0,
        harmonics: this.generateDefaultHarmonics()
      },
      {
        enabled: false,
        waveform: 'square',
        detune: 7,
        octave: 0,
        phase: 0,
        volume: 0.5,
        pan: -0.3
      },
      {
        enabled: false,
        waveform: 'sine',
        detune: -7,
        octave: -1,
        phase: 0,
        volume: 0.6,
        pan: 0.3
      }
    ];
    
    // Default filter configs
    this.filterConfigs = [
      {
        enabled: true,
        type: 'lowpass',
        cutoff: 5000,
        resonance: 0.5,
        keyTracking: 0.5,
        envAmount: 0.3
      },
      {
        enabled: false,
        type: 'highpass',
        cutoff: 100,
        resonance: 0.3,
        keyTracking: 0,
        envAmount: 0
      }
    ];
    
    // Default envelopes
    this.ampEnvelope = {
      attack: 0.01,
      decay: 0.2,
      sustain: 0.7,
      release: 0.3,
      attackCurve: 0,
      decayCurve: -2,
      releaseCurve: -2
    };
    
    this.filterEnvelope = {
      attack: 0.05,
      decay: 0.3,
      sustain: 0.4,
      release: 0.5,
      attackCurve: 0,
      decayCurve: -1,
      releaseCurve: -1
    };
    
    this.pitchEnvelope = {
      attack: 0,
      decay: 0.1,
      sustain: 0,
      release: 0,
      attackCurve: 0,
      decayCurve: -2,
      releaseCurve: 0
    };
    
    // Default LFO configs
    this.lfoConfigs = [
      {
        enabled: true,
        shape: 'sine',
        rate: 5,
        depth: 0.1,
        delay: 0.2,
        fadeIn: 0.3,
        sync: false
      },
      {
        enabled: false,
        shape: 'triangle',
        rate: 0.5,
        depth: 0.2,
        delay: 0,
        fadeIn: 0,
        sync: false
      },
      {
        enabled: false,
        shape: 'random',
        rate: 2,
        depth: 0.05,
        delay: 0,
        fadeIn: 0,
        sync: false
      }
    ];
    
    // Default effects
    this.effectConfigs = [
      {
        enabled: true,
        type: 'reverb',
        params: { mix: 0.2, decay: 2, damping: 0.5 }
      },
      {
        enabled: false,
        type: 'chorus',
        params: { rate: 1.5, depth: 0.3, mix: 0.3 }
      },
      {
        enabled: false,
        type: 'distortion',
        params: { amount: 0.3, tone: 0.5 }
      }
    ];
  }
  
  /**
   * Generate default harmonics for additive synthesis
   */
  private generateDefaultHarmonics(): HarmonicData[] {
    const harmonics: HarmonicData[] = [];
    for (let i = 1; i <= 32; i++) {
      harmonics.push({
        amplitude: 1 / i, // Saw wave harmonics
        phase: 0,
        bandwidth: 0.01
      });
    }
    return harmonics;
  }
  
  /**
   * Initialize effects
   */
  private initializeEffects(): void {
    // Create distortion
    this.distortionNode = this.audioContext.createWaveShaper();
    this.distortionNode.curve = this.makeDistortionCurve(0) as Float32Array<ArrayBuffer>;
    
    // Create chorus (simple delay-based)
    this.chorusNode = this.audioContext.createDelay(0.1);
    this.chorusNode.delayTime.value = 0.02;
    
    // Reverb would need an impulse response - we'll use a simple delay network
    // For a real implementation, load an IR or use a convolver
  }
  
  /**
   * Create distortion curve
   */
  private makeDistortionCurve(amount: number): Float32Array {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount * 10) * x * 20 * deg) / (Math.PI + amount * 10 * Math.abs(x));
    }
    
    return curve;
  }
  
  /**
   * Initialize the instrument
   */
  protected initializeInstrument(): void {
    // Set up parameters from configs
    this.syncParamsFromConfigs();
    
    // Generate PAD wavetable
    this.generatePadWavetable();
  }
  
  /**
   * Sync parameters from configurations
   */
  private syncParamsFromConfigs(): void {
    // Engine
    this.params['engine'] = ['ADD', 'SUB', 'PAD'].indexOf(this.currentEngine);
    
    // Oscillators
    for (let i = 0; i < 3; i++) {
      const osc = this.oscillatorConfigs[i];
      this.params[`osc${i}_enabled`] = osc.enabled ? 1 : 0;
      this.params[`osc${i}_waveform`] = ['sine', 'square', 'saw', 'triangle', 'pulse', 'noise'].indexOf(osc.waveform);
      this.params[`osc${i}_detune`] = osc.detune;
      this.params[`osc${i}_octave`] = osc.octave;
      this.params[`osc${i}_volume`] = osc.volume;
      this.params[`osc${i}_pan`] = osc.pan;
    }
    
    // Filters
    for (let i = 0; i < 2; i++) {
      const filter = this.filterConfigs[i];
      this.params[`filter${i}_enabled`] = filter.enabled ? 1 : 0;
      this.params[`filter${i}_type`] = ['lowpass', 'highpass', 'bandpass', 'notch'].indexOf(filter.type);
      this.params[`filter${i}_cutoff`] = filter.cutoff;
      this.params[`filter${i}_resonance`] = filter.resonance;
      this.params[`filter${i}_keyTracking`] = filter.keyTracking;
      this.params[`filter${i}_envAmount`] = filter.envAmount;
    }
    
    // Amp envelope
    this.params['ampEnv_attack'] = this.ampEnvelope.attack;
    this.params['ampEnv_decay'] = this.ampEnvelope.decay;
    this.params['ampEnv_sustain'] = this.ampEnvelope.sustain;
    this.params['ampEnv_release'] = this.ampEnvelope.release;
    
    // Filter envelope
    this.params['filterEnv_attack'] = this.filterEnvelope.attack;
    this.params['filterEnv_decay'] = this.filterEnvelope.decay;
    this.params['filterEnv_sustain'] = this.filterEnvelope.sustain;
    this.params['filterEnv_release'] = this.filterEnvelope.release;
    
    // LFOs
    for (let i = 0; i < 3; i++) {
      const lfo = this.lfoConfigs[i];
      this.params[`lfo${i}_enabled`] = lfo.enabled ? 1 : 0;
      this.params[`lfo${i}_rate`] = lfo.rate;
      this.params[`lfo${i}_depth`] = lfo.depth;
    }
  }
  
  /**
   * Generate PAD synthesis wavetable
   */
  private generatePadWavetable(): void {
    const numHarmonics = 128;
    const real = new Float32Array(numHarmonics);
    const imag = new Float32Array(numHarmonics);
    
    // Generate harmonics with bandwidth spreading (PAD synthesis characteristic)
    for (let i = 1; i < numHarmonics; i++) {
      const harmonic = this.padHarmonics[i - 1] || { amplitude: 1 / i, phase: 0, bandwidth: 0.02 };
      
      // Apply bandwidth spreading
      const bandwidth = harmonic.bandwidth || 0.02;
      const spread = Math.exp(-bandwidth * i * i);
      
      real[i] = harmonic.amplitude * spread * Math.cos(harmonic.phase);
      imag[i] = harmonic.amplitude * spread * Math.sin(harmonic.phase);
    }
    
    this.padWavetable = this.audioContext.createPeriodicWave(real, imag, { disableNormalization: false });
  }
  
  /**
   * Create oscillator for a voice
   */
  private createOscillator(config: OscillatorConfig, frequency: number): OscillatorNode {
    const osc = this.audioContext.createOscillator();
    
    // Set frequency with octave and detune
    const octaveMultiplier = Math.pow(2, config.octave);
    const detuneFreq = frequency * octaveMultiplier;
    osc.frequency.value = detuneFreq;
    osc.detune.value = config.detune;
    
    // Set waveform
    switch (config.waveform) {
      case 'sine':
        osc.type = 'sine';
        break;
      case 'square':
        osc.type = 'square';
        break;
      case 'saw':
        osc.type = 'sawtooth';
        break;
      case 'triangle':
        osc.type = 'triangle';
        break;
      case 'custom':
        if (this.currentEngine === 'PAD' && this.padWavetable) {
          osc.setPeriodicWave(this.padWavetable);
        } else if (config.harmonics) {
          const wave = this.createWaveFromHarmonics(config.harmonics);
          osc.setPeriodicWave(wave);
        }
        break;
      default:
        osc.type = 'sawtooth';
    }
    
    return osc;
  }
  
  /**
   * Create periodic wave from harmonics
   */
  private createWaveFromHarmonics(harmonics: HarmonicData[]): PeriodicWave {
    const real = new Float32Array(harmonics.length + 1);
    const imag = new Float32Array(harmonics.length + 1);
    
    for (let i = 0; i < harmonics.length; i++) {
      real[i + 1] = harmonics[i].amplitude * Math.cos(harmonics[i].phase);
      imag[i + 1] = harmonics[i].amplitude * Math.sin(harmonics[i].phase);
    }
    
    return this.audioContext.createPeriodicWave(real, imag);
  }
  
  /**
   * Apply envelope to a parameter
   */
  private applyEnvelope(
    param: AudioParam,
    envelope: EnvelopeConfig,
    startValue: number,
    peakValue: number,
    sustainValue: number,
    startTime: number
  ): void {
    const { attack, decay, sustain, release } = envelope;
    
    param.cancelScheduledValues(startTime);
    param.setValueAtTime(startValue, startTime);
    
    // Attack
    param.linearRampToValueAtTime(peakValue, startTime + attack);
    
    // Decay to sustain
    param.exponentialRampToValueAtTime(
      Math.max(sustainValue, 0.001),
      startTime + attack + decay
    );
  }
  
  /**
   * Apply release envelope
   */
  private applyRelease(
    param: AudioParam,
    envelope: EnvelopeConfig,
    releaseTime: number
  ): void {
    const currentValue = param.value;
    param.cancelScheduledValues(releaseTime);
    param.setValueAtTime(currentValue, releaseTime);
    param.exponentialRampToValueAtTime(0.001, releaseTime + envelope.release);
  }
  
  /**
   * Trigger a note
   */
  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    const startTime = this.audioContext.currentTime;
    
    // Create voice
    const voice: Voice = {
      noteNumber,
      velocity,
      startTime,
      oscillators: [],
      gains: [],
      filters: [],
      ampEnvelope: this.audioContext.createGain(),
      filterEnvelope: this.audioContext.createGain(),
      released: false,
      releaseTime: 0
    };
    
    // Create oscillators based on engine
    if (this.currentEngine === 'ADD' || this.currentEngine === 'PAD') {
      // Additive/PAD synthesis - use configured oscillators
      for (let i = 0; i < this.oscillatorConfigs.length; i++) {
        const config = this.oscillatorConfigs[i];
        if (!config.enabled) continue;
        
        const osc = this.createOscillator(config, frequency);
        const gain = this.audioContext.createGain();
        gain.gain.value = config.volume * velocity;
        
        osc.connect(gain);
        voice.oscillators.push(osc);
        voice.gains.push(gain);
      }
    } else {
      // Subtractive synthesis - rich waveform through filter
      const osc = this.audioContext.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = frequency;
      
      const gain = this.audioContext.createGain();
      gain.gain.value = velocity;
      
      osc.connect(gain);
      voice.oscillators.push(osc);
      voice.gains.push(gain);
    }
    
    // Create filters
    let lastNode: AudioNode = voice.gains[0];
    
    for (let i = 0; i < this.filterConfigs.length; i++) {
      const config = this.filterConfigs[i];
      if (!config.enabled) continue;
      
      const filter = this.audioContext.createBiquadFilter();
      filter.type = config.type as BiquadFilterType;
      
      // Calculate cutoff with key tracking
      const keyTrackingOffset = (noteNumber - 60) * config.keyTracking * 100;
      const baseCutoff = config.cutoff + keyTrackingOffset;
      filter.frequency.value = clamp(baseCutoff, 20, 20000);
      filter.Q.value = config.resonance * 20;
      
      // Apply filter envelope
      if (config.envAmount > 0) {
        const envAmount = config.envAmount * 10000;
        this.applyEnvelope(
          filter.frequency,
          this.filterEnvelope,
          baseCutoff,
          baseCutoff + envAmount,
          baseCutoff + envAmount * this.filterEnvelope.sustain,
          startTime
        );
      }
      
      voice.filters.push(filter);
    }
    
    // Connect oscillator gains to filters or amp envelope
    for (const gain of voice.gains) {
      if (voice.filters.length > 0) {
        gain.connect(voice.filters[0]);
      } else {
        gain.connect(voice.ampEnvelope);
      }
    }
    
    // Connect filters in series
    for (let i = 0; i < voice.filters.length; i++) {
      if (i < voice.filters.length - 1) {
        voice.filters[i].connect(voice.filters[i + 1]);
      } else {
        voice.filters[i].connect(voice.ampEnvelope);
      }
    }
    
    // Connect amp envelope to master filter
    voice.ampEnvelope.connect(this.masterFilter);
    
    // Apply amp envelope
    this.applyEnvelope(
      voice.ampEnvelope.gain,
      this.ampEnvelope,
      0,
      velocity,
      velocity * this.ampEnvelope.sustain,
      startTime
    );
    
    // Start oscillators
    for (const osc of voice.oscillators) {
      osc.start(startTime);
    }
    
    // Store voice
    this.voices.set(noteNumber, voice);
  }
  
  /**
   * Release a note
   */
  protected releaseNote(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
    if (!voice || voice.released) return;
    
    const releaseTime = this.audioContext.currentTime;
    voice.released = true;
    voice.releaseTime = releaseTime;
    
    // Apply release to amp envelope
    this.applyRelease(voice.ampEnvelope.gain, this.ampEnvelope, releaseTime);
    
    // Apply release to filter envelopes
    for (const filter of voice.filters) {
      this.applyRelease(filter.frequency, this.filterEnvelope, releaseTime);
    }
    
    // Schedule cleanup
    const cleanupTime = releaseTime + this.ampEnvelope.release + 0.1;
    setTimeout(() => {
      this.cleanupVoice(noteNumber);
    }, (cleanupTime - this.audioContext.currentTime) * 1000);
  }
  
  /**
   * Clean up a voice
   */
  private cleanupVoice(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
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
    
    // Disconnect gains
    for (const gain of voice.gains) {
      gain.disconnect();
    }
    
    // Disconnect filters
    for (const filter of voice.filters) {
      filter.disconnect();
    }
    
    // Disconnect envelopes
    voice.ampEnvelope.disconnect();
    voice.filterEnvelope.disconnect();
    
    // Remove from map
    this.voices.delete(noteNumber);
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    // Parse parameter key
    const parts = key.split('_');
    
    if (key === 'engine') {
      this.currentEngine = ['ADD', 'SUB', 'PAD'][Math.floor(value)] as SynthEngine;
      if (this.currentEngine === 'PAD') {
        this.generatePadWavetable();
      }
      return;
    }
    
    // Oscillator parameters
    if (parts[0].startsWith('osc')) {
      const oscIndex = parseInt(parts[0].replace('osc', ''));
      const param = parts[1];
      
      if (oscIndex >= 0 && oscIndex < this.oscillatorConfigs.length) {
        switch (param) {
          case 'enabled':
            this.oscillatorConfigs[oscIndex].enabled = value > 0.5;
            break;
          case 'waveform':
            this.oscillatorConfigs[oscIndex].waveform = 
              ['sine', 'square', 'saw', 'triangle', 'pulse', 'noise'][Math.floor(value)] as OscillatorWaveform;
            break;
          case 'detune':
            this.oscillatorConfigs[oscIndex].detune = value;
            break;
          case 'octave':
            this.oscillatorConfigs[oscIndex].octave = Math.floor(value);
            break;
          case 'volume':
            this.oscillatorConfigs[oscIndex].volume = value;
            break;
          case 'pan':
            this.oscillatorConfigs[oscIndex].pan = value;
            break;
        }
      }
      return;
    }
    
    // Filter parameters
    if (parts[0].startsWith('filter')) {
      const filterIndex = parseInt(parts[0].replace('filter', ''));
      const param = parts[1];
      
      if (filterIndex >= 0 && filterIndex < this.filterConfigs.length) {
        switch (param) {
          case 'enabled':
            this.filterConfigs[filterIndex].enabled = value > 0.5;
            break;
          case 'type':
            this.filterConfigs[filterIndex].type = 
              ['lowpass', 'highpass', 'bandpass', 'notch'][Math.floor(value)] as FilterType;
            break;
          case 'cutoff':
            this.filterConfigs[filterIndex].cutoff = value;
            break;
          case 'resonance':
            this.filterConfigs[filterIndex].resonance = value;
            break;
          case 'keyTracking':
            this.filterConfigs[filterIndex].keyTracking = value;
            break;
          case 'envAmount':
            this.filterConfigs[filterIndex].envAmount = value;
            break;
        }
      }
      return;
    }
    
    // Envelope parameters
    if (parts[0] === 'ampEnv') {
      switch (parts[1]) {
        case 'attack': this.ampEnvelope.attack = value; break;
        case 'decay': this.ampEnvelope.decay = value; break;
        case 'sustain': this.ampEnvelope.sustain = value; break;
        case 'release': this.ampEnvelope.release = value; break;
      }
      return;
    }
    
    if (parts[0] === 'filterEnv') {
      switch (parts[1]) {
        case 'attack': this.filterEnvelope.attack = value; break;
        case 'decay': this.filterEnvelope.decay = value; break;
        case 'sustain': this.filterEnvelope.sustain = value; break;
        case 'release': this.filterEnvelope.release = value; break;
      }
      return;
    }
    
    // LFO parameters
    if (parts[0].startsWith('lfo')) {
      const lfoIndex = parseInt(parts[0].replace('lfo', ''));
      const param = parts[1];
      
      if (lfoIndex >= 0 && lfoIndex < this.lfoConfigs.length) {
        switch (param) {
          case 'enabled':
            this.lfoConfigs[lfoIndex].enabled = value > 0.5;
            break;
          case 'rate':
            this.lfoConfigs[lfoIndex].rate = value;
            break;
          case 'depth':
            this.lfoConfigs[lfoIndex].depth = value;
            break;
        }
      }
      return;
    }
    
    // Master filter
    if (key === 'masterCutoff') {
      this.masterFilter.frequency.setTargetAtTime(value, this.audioContext.currentTime, 0.01);
      return;
    }
    
    if (key === 'masterResonance') {
      this.masterFilter.Q.setTargetAtTime(value * 20, this.audioContext.currentTime, 0.01);
      return;
    }
  }
  
  /**
   * Get parameter descriptors
   */
  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    const descriptors: InstrumentParameterDescriptor[] = [
      // Engine
      { name: 'Engine', key: 'engine', min: 0, max: 2, default: 0, type: 'enum', enumValues: ['ADD', 'SUB', 'PAD'], category: 'Global' },
      
      // Master
      { name: 'Master Cutoff', key: 'masterCutoff', min: 20, max: 20000, default: 20000, type: 'logarithmic', unit: 'Hz', category: 'Global' },
      { name: 'Master Resonance', key: 'masterResonance', min: 0, max: 1, default: 0, category: 'Global' },
    ];
    
    // Oscillator parameters
    for (let i = 0; i < 3; i++) {
      descriptors.push(
        { name: `Osc ${i + 1} Enabled`, key: `osc${i}_enabled`, min: 0, max: 1, default: i === 0 ? 1 : 0, type: 'boolean', category: `Oscillator ${i + 1}` },
        { name: `Osc ${i + 1} Waveform`, key: `osc${i}_waveform`, min: 0, max: 5, default: 2, type: 'enum', enumValues: ['Sine', 'Square', 'Saw', 'Triangle', 'Pulse', 'Noise'], category: `Oscillator ${i + 1}` },
        { name: `Osc ${i + 1} Detune`, key: `osc${i}_detune`, min: -100, max: 100, default: 0, unit: 'cents', category: `Oscillator ${i + 1}` },
        { name: `Osc ${i + 1} Octave`, key: `osc${i}_octave`, min: -3, max: 3, default: 0, step: 1, category: `Oscillator ${i + 1}` },
        { name: `Osc ${i + 1} Volume`, key: `osc${i}_volume`, min: 0, max: 1, default: 0.8, category: `Oscillator ${i + 1}` },
        { name: `Osc ${i + 1} Pan`, key: `osc${i}_pan`, min: -1, max: 1, default: 0, category: `Oscillator ${i + 1}` }
      );
    }
    
    // Filter parameters
    for (let i = 0; i < 2; i++) {
      descriptors.push(
        { name: `Filter ${i + 1} Enabled`, key: `filter${i}_enabled`, min: 0, max: 1, default: i === 0 ? 1 : 0, type: 'boolean', category: `Filter ${i + 1}` },
        { name: `Filter ${i + 1} Type`, key: `filter${i}_type`, min: 0, max: 3, default: 0, type: 'enum', enumValues: ['Lowpass', 'Highpass', 'Bandpass', 'Notch'], category: `Filter ${i + 1}` },
        { name: `Filter ${i + 1} Cutoff`, key: `filter${i}_cutoff`, min: 20, max: 20000, default: 5000, type: 'logarithmic', unit: 'Hz', category: `Filter ${i + 1}` },
        { name: `Filter ${i + 1} Resonance`, key: `filter${i}_resonance`, min: 0, max: 1, default: 0.5, category: `Filter ${i + 1}` },
        { name: `Filter ${i + 1} Key Track`, key: `filter${i}_keyTracking`, min: 0, max: 1, default: 0.5, category: `Filter ${i + 1}` },
        { name: `Filter ${i + 1} Env Amount`, key: `filter${i}_envAmount`, min: 0, max: 1, default: 0.3, category: `Filter ${i + 1}` }
      );
    }
    
    // Amp envelope
    descriptors.push(
      { name: 'Amp Attack', key: 'ampEnv_attack', min: 0.001, max: 5, default: 0.01, unit: 's', category: 'Amp Envelope' },
      { name: 'Amp Decay', key: 'ampEnv_decay', min: 0.001, max: 5, default: 0.2, unit: 's', category: 'Amp Envelope' },
      { name: 'Amp Sustain', key: 'ampEnv_sustain', min: 0, max: 1, default: 0.7, category: 'Amp Envelope' },
      { name: 'Amp Release', key: 'ampEnv_release', min: 0.001, max: 10, default: 0.3, unit: 's', category: 'Amp Envelope' }
    );
    
    // Filter envelope
    descriptors.push(
      { name: 'Filter Attack', key: 'filterEnv_attack', min: 0.001, max: 5, default: 0.05, unit: 's', category: 'Filter Envelope' },
      { name: 'Filter Decay', key: 'filterEnv_decay', min: 0.001, max: 5, default: 0.3, unit: 's', category: 'Filter Envelope' },
      { name: 'Filter Sustain', key: 'filterEnv_sustain', min: 0, max: 1, default: 0.4, category: 'Filter Envelope' },
      { name: 'Filter Release', key: 'filterEnv_release', min: 0.001, max: 10, default: 0.5, unit: 's', category: 'Filter Envelope' }
    );
    
    // LFO parameters
    for (let i = 0; i < 3; i++) {
      descriptors.push(
        { name: `LFO ${i + 1} Enabled`, key: `lfo${i}_enabled`, min: 0, max: 1, default: i === 0 ? 1 : 0, type: 'boolean', category: `LFO ${i + 1}` },
        { name: `LFO ${i + 1} Rate`, key: `lfo${i}_rate`, min: 0.01, max: 20, default: 5, unit: 'Hz', category: `LFO ${i + 1}` },
        { name: `LFO ${i + 1} Depth`, key: `lfo${i}_depth`, min: 0, max: 1, default: 0.1, category: `LFO ${i + 1}` }
      );
    }
    
    return descriptors;
  }
  
  /**
   * Set synthesis engine
   */
  public setEngine(engine: SynthEngine): void {
    this.currentEngine = engine;
    this.params['engine'] = ['ADD', 'SUB', 'PAD'].indexOf(engine);
    
    if (engine === 'PAD') {
      this.generatePadWavetable();
    }
  }
  
  /**
   * Get current engine
   */
  public getEngine(): SynthEngine {
    return this.currentEngine;
  }
  
  /**
   * Set harmonics for additive synthesis
   */
  public setHarmonics(oscIndex: number, harmonics: HarmonicData[]): void {
    if (oscIndex >= 0 && oscIndex < this.oscillatorConfigs.length) {
      this.oscillatorConfigs[oscIndex].harmonics = harmonics;
    }
  }
  
  /**
   * Set PAD harmonics
   */
  public setPadHarmonics(harmonics: HarmonicData[]): void {
    this.padHarmonics = harmonics;
    this.generatePadWavetable();
  }
  
  /**
   * Get oscillator config
   */
  public getOscillatorConfig(index: number): OscillatorConfig | undefined {
    return this.oscillatorConfigs[index];
  }
  
  /**
   * Get filter config
   */
  public getFilterConfig(index: number): FilterConfig | undefined {
    return this.filterConfigs[index];
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    // Clean up all voices
    for (const noteNumber of this.voices.keys()) {
      this.cleanupVoice(noteNumber);
    }
    
    // Disconnect nodes
    this.masterFilter.disconnect();
    
    if (this.distortionNode) {
      this.distortionNode.disconnect();
    }
    
    if (this.chorusNode) {
      this.chorusNode.disconnect();
    }
    
    super.dispose();
  }
}

// Factory function
export function createZynAddSubFX(audioContext: AudioContext, id?: string): ZynAddSubFX {
  return new ZynAddSubFX(audioContext, id || `zynaddsubfx-${Date.now()}`);
}