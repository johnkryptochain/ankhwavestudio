// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Organic - Additive synthesizer for organ-like sounds
 * Based on the original AnkhWaveStudio Organic plugin
 * 
 * Features:
 * - 8 harmonic oscillators
 * - Per-harmonic volume control
 * - Per-harmonic detune
 * - Per-harmonic panning
 * - Randomize function
 * - Waveform selection per harmonic
 * - Global volume envelope
 */

import { BaseInstrument, InstrumentParameterDescriptor, InstrumentPreset } from './BaseInstrument';
import { clamp, midiNoteToFrequency } from '../utils/AudioMath';

// Number of oscillators
const NUM_OSCILLATORS = 8;

// Harmonic names and ratios
const HARMONICS = [
  { name: 'Octave below', ratio: 0.5 },
  { name: 'Fifth below', ratio: 0.667 },
  { name: 'Fundamental', ratio: 1 },
  { name: '2nd harmonic', ratio: 2 },
  { name: '3rd harmonic', ratio: 3 },
  { name: '4th harmonic', ratio: 4 },
  { name: '5th harmonic', ratio: 5 },
  { name: '6th harmonic', ratio: 6 },
  { name: '7th harmonic', ratio: 7 },
  { name: '8th harmonic', ratio: 8 },
  { name: '9th harmonic', ratio: 9 },
  { name: '10th harmonic', ratio: 10 },
  { name: '11th harmonic', ratio: 11 },
  { name: '12th harmonic', ratio: 12 },
  { name: '13th harmonic', ratio: 13 },
  { name: '14th harmonic', ratio: 14 },
  { name: '15th harmonic', ratio: 15 },
  { name: '16th harmonic', ratio: 16 },
];

// Waveform types
export enum OrganicWaveform {
  Sine = 0,
  Saw = 1,
  Square = 2,
  Triangle = 3,
  MoogSaw = 4,
  Exponential = 5,
}

const WAVEFORM_NAMES = ['Sine', 'Saw', 'Square', 'Triangle', 'Moog Saw', 'Exponential'];

// Cent to ratio conversion
const CENT = 1.0 / 1200.0;

/**
 * Voice state for Organic
 */
interface OrganicVoice {
  noteNumber: number;
  frequency: number;
  velocity: number;
  startTime: number;
  
  // Per-oscillator phases
  phasesL: number[];
  phasesR: number[];
  
  // Envelope state
  envPhase: number;
  envStage: 'attack' | 'decay' | 'sustain' | 'release' | 'off';
  envValue: number;
  
  // Release flag
  released: boolean;
  releaseTime: number;
}

/**
 * Organic - Additive synthesizer
 */
export class Organic extends BaseInstrument {
  private voices: Map<number, OrganicVoice> = new Map();
  
  // Audio processing
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sampleRate: number;
  
  // Cached oscillator settings
  private oscVolumesL: number[] = new Array(NUM_OSCILLATORS).fill(0);
  private oscVolumesR: number[] = new Array(NUM_OSCILLATORS).fill(0);
  private oscDetuneL: number[] = new Array(NUM_OSCILLATORS).fill(0);
  private oscDetuneR: number[] = new Array(NUM_OSCILLATORS).fill(0);
  
  constructor(audioContext: AudioContext, id: string, name: string = 'Organic') {
    super(audioContext, id, name, 'organic');
    this.sampleRate = audioContext.sampleRate;
    this.initializeInstrument();
    this.addDefaultPresets();
    this.setupAudioProcessing();
  }

  protected initializeInstrument(): void {
    // Initialize default parameters
    this.params = {
      // Global
      volume: 80,
      fx1: 0,  // Distortion/waveshaping amount
      
      // Per-oscillator parameters (8 oscillators)
      // Oscillator 0
      osc0Wave: OrganicWaveform.Sine,
      osc0Harm: 2,  // Harmonic index (0-17)
      osc0Vol: 100,
      osc0Pan: 0,
      osc0Detune: 0,
      
      // Oscillator 1
      osc1Wave: OrganicWaveform.Sine,
      osc1Harm: 3,
      osc1Vol: 80,
      osc1Pan: 0,
      osc1Detune: 0,
      
      // Oscillator 2
      osc2Wave: OrganicWaveform.Sine,
      osc2Harm: 4,
      osc2Vol: 60,
      osc2Pan: 0,
      osc2Detune: 0,
      
      // Oscillator 3
      osc3Wave: OrganicWaveform.Sine,
      osc3Harm: 5,
      osc3Vol: 40,
      osc3Pan: 0,
      osc3Detune: 0,
      
      // Oscillator 4
      osc4Wave: OrganicWaveform.Sine,
      osc4Harm: 6,
      osc4Vol: 30,
      osc4Pan: 0,
      osc4Detune: 0,
      
      // Oscillator 5
      osc5Wave: OrganicWaveform.Sine,
      osc5Harm: 7,
      osc5Vol: 20,
      osc5Pan: 0,
      osc5Detune: 0,
      
      // Oscillator 6
      osc6Wave: OrganicWaveform.Sine,
      osc6Harm: 8,
      osc6Vol: 10,
      osc6Pan: 0,
      osc6Detune: 0,
      
      // Oscillator 7
      osc7Wave: OrganicWaveform.Sine,
      osc7Harm: 9,
      osc7Vol: 5,
      osc7Pan: 0,
      osc7Detune: 0,
    };
    
    // Set up envelope
    this.envelope = {
      attack: 0.01,
      decay: 0.1,
      sustain: 0.8,
      release: 0.3,
    };
    
    this.updateCachedValues();
  }

  private setupAudioProcessing(): void {
    const bufferSize = 256;
    this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 0, 2);
    
    this.scriptProcessor.onaudioprocess = (event) => {
      const outputL = event.outputBuffer.getChannelData(0);
      const outputR = event.outputBuffer.getChannelData(1);
      this.processAudio(outputL, outputR, outputL.length);
    };
    
    this.scriptProcessor.connect(this.volumeNode);
  }

  private processAudio(outputL: Float32Array, outputR: Float32Array, numSamples: number): void {
    // Clear output buffers
    outputL.fill(0);
    outputR.fill(0);
    
    // Process each active voice
    for (const [noteNumber, voice] of this.voices) {
      this.processVoice(voice, outputL, outputR, numSamples);
      
      // Remove voice if envelope is finished
      if (voice.envStage === 'off') {
        this.voices.delete(noteNumber);
      }
    }
  }

  private processVoice(voice: OrganicVoice, outputL: Float32Array, outputR: Float32Array, numSamples: number): void {
    const sampleRate = this.sampleRate;
    const globalVol = this.params.volume / 100;
    const fx1 = this.params.fx1 / 100;
    
    for (let i = 0; i < numSamples; i++) {
      // Update envelope
      const envValue = this.updateEnvelope(voice);
      
      let sampleL = 0;
      let sampleR = 0;
      
      // Process each oscillator
      for (let osc = 0; osc < NUM_OSCILLATORS; osc++) {
        const waveform = Math.round(this.params[`osc${osc}Wave`]) as OrganicWaveform;
        const harmIndex = Math.round(this.params[`osc${osc}Harm`]);
        const harmRatio = HARMONICS[harmIndex]?.ratio || 1;
        
        // Calculate frequency with harmonic and detune
        const baseFreq = voice.frequency * harmRatio;
        const freqL = baseFreq * Math.pow(2, this.oscDetuneL[osc] * CENT);
        const freqR = baseFreq * Math.pow(2, this.oscDetuneR[osc] * CENT);
        
        // Calculate phase increments
        const incL = freqL / sampleRate;
        const incR = freqR / sampleRate;
        
        // Generate waveform
        const oscL = this.generateWaveform(waveform, voice.phasesL[osc]);
        const oscR = this.generateWaveform(waveform, voice.phasesR[osc]);
        
        // Apply volume and pan
        sampleL += oscL * this.oscVolumesL[osc];
        sampleR += oscR * this.oscVolumesR[osc];
        
        // Update phases
        voice.phasesL[osc] = this.wrapPhase(voice.phasesL[osc] + incL);
        voice.phasesR[osc] = this.wrapPhase(voice.phasesR[osc] + incR);
      }
      
      // Apply waveshaping/distortion
      if (fx1 > 0) {
        sampleL = this.waveshape(sampleL, fx1);
        sampleR = this.waveshape(sampleR, fx1);
      }
      
      // Apply envelope and global volume
      const gain = envValue * globalVol * voice.velocity;
      outputL[i] += sampleL * gain;
      outputR[i] += sampleR * gain;
    }
  }

  private generateWaveform(waveform: OrganicWaveform, phase: number): number {
    const ph = this.wrapPhase(phase);
    
    switch (waveform) {
      case OrganicWaveform.Sine:
        return Math.sin(ph * Math.PI * 2);
        
      case OrganicWaveform.Saw:
        return 2 * ph - 1;
        
      case OrganicWaveform.Square:
        return ph < 0.5 ? 1 : -1;
        
      case OrganicWaveform.Triangle:
        return ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
        
      case OrganicWaveform.MoogSaw:
        if (ph < 0.5) {
          return 4 * ph - 1;
        } else {
          const w = 2 * (ph - 0.5);
          return 1 - Math.sqrt(1 - w * w);
        }
        
      case OrganicWaveform.Exponential:
        return (Math.exp(Math.abs(ph * 2 - 1) * 2) - 1) / (Math.E * Math.E - 1) * Math.sign(ph - 0.5);
        
      default:
        return Math.sin(ph * Math.PI * 2);
    }
  }

  private waveshape(input: number, amount: number): number {
    // Fast atan-based waveshaping
    const k = amount * 10;
    return this.fastAtan(input * (1 + k)) / this.fastAtan(1 + k);
  }

  private fastAtan(x: number): number {
    return x / (1.0 + 0.28 * x * x);
  }

  private updateEnvelope(voice: OrganicVoice): number {
    const dt = 1 / this.sampleRate;
    let value = voice.envValue;
    let stage = voice.envStage;
    let phase = voice.envPhase;
    
    const att = this.envelope.attack;
    const dec = this.envelope.decay;
    const sus = this.envelope.sustain;
    const rel = this.envelope.release;
    
    switch (stage) {
      case 'attack':
        phase += dt;
        if (phase >= att) {
          stage = 'decay';
          phase = 0;
          value = 1;
        } else {
          value = att > 0 ? phase / att : 1;
        }
        break;
        
      case 'decay':
        phase += dt;
        if (phase >= dec) {
          stage = 'sustain';
          phase = 0;
          value = sus;
        } else {
          const progress = dec > 0 ? phase / dec : 1;
          value = 1 - (1 - sus) * progress;
        }
        break;
        
      case 'sustain':
        value = sus;
        if (voice.released) {
          stage = 'release';
          phase = 0;
        }
        break;
        
      case 'release':
        phase += dt;
        if (phase >= rel) {
          stage = 'off';
          value = 0;
        } else {
          const progress = rel > 0 ? phase / rel : 1;
          value = sus * (1 - progress);
        }
        break;
        
      case 'off':
        value = 0;
        break;
    }
    
    voice.envStage = stage;
    voice.envValue = value;
    voice.envPhase = phase;
    
    return value;
  }

  private wrapPhase(phase: number): number {
    return phase - Math.floor(phase);
  }

  private updateCachedValues(): void {
    for (let osc = 0; osc < NUM_OSCILLATORS; osc++) {
      const vol = this.params[`osc${osc}Vol`] / 100;
      const pan = this.params[`osc${osc}Pan`] / 100;
      const detune = this.params[`osc${osc}Detune`];
      
      // Calculate stereo volumes
      this.oscVolumesL[osc] = vol * (pan <= 0 ? 1 : 1 - pan);
      this.oscVolumesR[osc] = vol * (pan >= 0 ? 1 : 1 + pan);
      
      // Calculate stereo detune (slight spread)
      this.oscDetuneL[osc] = detune - 5;
      this.oscDetuneR[osc] = detune + 5;
    }
  }

  /**
   * Randomize all oscillator settings
   */
  randomize(): void {
    for (let osc = 0; osc < NUM_OSCILLATORS; osc++) {
      this.setParameter(`osc${osc}Wave`, Math.floor(Math.random() * 6));
      this.setParameter(`osc${osc}Harm`, Math.floor(Math.random() * HARMONICS.length));
      this.setParameter(`osc${osc}Vol`, Math.random() * 100);
      this.setParameter(`osc${osc}Pan`, (Math.random() - 0.5) * 200);
      this.setParameter(`osc${osc}Detune`, (Math.random() - 0.5) * 200);
    }
  }

  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    const descriptors: InstrumentParameterDescriptor[] = [
      { name: 'Volume', key: 'volume', min: 0, max: 100, default: 80, category: 'Global' },
      { name: 'FX1 (Distortion)', key: 'fx1', min: 0, max: 100, default: 0, category: 'Global' },
    ];
    
    // Add per-oscillator parameters
    for (let osc = 0; osc < NUM_OSCILLATORS; osc++) {
      const category = `Oscillator ${osc + 1}`;
      descriptors.push(
        { name: 'Waveform', key: `osc${osc}Wave`, min: 0, max: 5, default: 0, type: 'enum',
          enumValues: WAVEFORM_NAMES, category },
        { name: 'Harmonic', key: `osc${osc}Harm`, min: 0, max: 17, default: osc + 2, type: 'enum',
          enumValues: HARMONICS.map(h => h.name), category },
        { name: 'Volume', key: `osc${osc}Vol`, min: 0, max: 100, default: 100 - osc * 10, category },
        { name: 'Pan', key: `osc${osc}Pan`, min: -100, max: 100, default: 0, category },
        { name: 'Detune', key: `osc${osc}Detune`, min: -100, max: 100, default: 0, unit: 'cents', category },
      );
    }
    
    return descriptors;
  }

  protected onParameterChange(key: string, value: number): void {
    this.updateCachedValues();
  }

  protected silenceNote(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
    if (voice) {
      voice.envStage = 'off';
      voice.envValue = 0;
    }
  }

  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    // Create new voice
    const voice: OrganicVoice = {
      noteNumber,
      frequency,
      velocity,
      startTime: this.audioContext.currentTime,
      
      phasesL: new Array(NUM_OSCILLATORS).fill(0),
      phasesR: new Array(NUM_OSCILLATORS).fill(0),
      
      envPhase: 0,
      envStage: 'attack',
      envValue: 0,
      
      released: false,
      releaseTime: 0,
    };
    
    // Initialize phases with slight random offset for each oscillator
    for (let osc = 0; osc < NUM_OSCILLATORS; osc++) {
      voice.phasesL[osc] = Math.random() * 0.1;
      voice.phasesR[osc] = Math.random() * 0.1;
    }
    
    this.voices.set(noteNumber, voice);
  }

  protected releaseNote(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
    if (voice) {
      voice.released = true;
      voice.releaseTime = this.audioContext.currentTime;
      
      if (voice.envStage !== 'off') {
        voice.envStage = 'release';
        voice.envPhase = 0;
      }
    }
  }

  private addDefaultPresets(): void {
    const presets: InstrumentPreset[] = [
      {
        name: 'Classic Organ',
        params: {
          volume: 80,
          osc0Wave: 0, osc0Harm: 2, osc0Vol: 100, osc0Pan: 0, osc0Detune: 0,
          osc1Wave: 0, osc1Harm: 3, osc1Vol: 80, osc1Pan: 0, osc1Detune: 0,
          osc2Wave: 0, osc2Harm: 4, osc2Vol: 60, osc2Pan: 0, osc2Detune: 0,
          osc3Wave: 0, osc3Harm: 5, osc3Vol: 40, osc3Pan: 0, osc3Detune: 0,
          osc4Wave: 0, osc4Harm: 6, osc4Vol: 30, osc4Pan: 0, osc4Detune: 0,
          osc5Wave: 0, osc5Harm: 7, osc5Vol: 20, osc5Pan: 0, osc5Detune: 0,
          osc6Wave: 0, osc6Harm: 8, osc6Vol: 10, osc6Pan: 0, osc6Detune: 0,
          osc7Wave: 0, osc7Harm: 9, osc7Vol: 5, osc7Pan: 0, osc7Detune: 0,
        },
      },
      {
        name: 'Drawbar Full',
        params: {
          volume: 70,
          osc0Wave: 0, osc0Harm: 0, osc0Vol: 80, osc0Pan: 0, osc0Detune: 0,
          osc1Wave: 0, osc1Harm: 1, osc1Vol: 80, osc1Pan: 0, osc1Detune: 0,
          osc2Wave: 0, osc2Harm: 2, osc2Vol: 100, osc2Pan: 0, osc2Detune: 0,
          osc3Wave: 0, osc3Harm: 3, osc3Vol: 100, osc3Pan: 0, osc3Detune: 0,
          osc4Wave: 0, osc4Harm: 4, osc4Vol: 80, osc4Pan: 0, osc4Detune: 0,
          osc5Wave: 0, osc5Harm: 5, osc5Vol: 60, osc5Pan: 0, osc5Detune: 0,
          osc6Wave: 0, osc6Harm: 6, osc6Vol: 40, osc6Pan: 0, osc6Detune: 0,
          osc7Wave: 0, osc7Harm: 7, osc7Vol: 20, osc7Pan: 0, osc7Detune: 0,
        },
      },
      {
        name: 'Bright Organ',
        params: {
          volume: 75,
          fx1: 20,
          osc0Wave: 0, osc0Harm: 2, osc0Vol: 100, osc0Pan: 0, osc0Detune: 0,
          osc1Wave: 0, osc1Harm: 4, osc1Vol: 90, osc1Pan: 0, osc1Detune: 0,
          osc2Wave: 0, osc2Harm: 6, osc2Vol: 80, osc2Pan: 0, osc2Detune: 0,
          osc3Wave: 0, osc3Harm: 8, osc3Vol: 70, osc3Pan: 0, osc3Detune: 0,
          osc4Wave: 0, osc4Harm: 10, osc4Vol: 60, osc4Pan: 0, osc4Detune: 0,
          osc5Wave: 0, osc5Harm: 12, osc5Vol: 50, osc5Pan: 0, osc5Detune: 0,
          osc6Wave: 0, osc6Harm: 14, osc6Vol: 40, osc6Pan: 0, osc6Detune: 0,
          osc7Wave: 0, osc7Harm: 16, osc7Vol: 30, osc7Pan: 0, osc7Detune: 0,
        },
      },
      {
        name: 'Detuned Pad',
        params: {
          volume: 70,
          osc0Wave: 0, osc0Harm: 2, osc0Vol: 100, osc0Pan: -30, osc0Detune: -10,
          osc1Wave: 0, osc1Harm: 2, osc1Vol: 100, osc1Pan: 30, osc1Detune: 10,
          osc2Wave: 0, osc2Harm: 3, osc2Vol: 60, osc2Pan: -50, osc2Detune: -15,
          osc3Wave: 0, osc3Harm: 3, osc3Vol: 60, osc3Pan: 50, osc3Detune: 15,
          osc4Wave: 0, osc4Harm: 4, osc4Vol: 40, osc4Pan: -70, osc4Detune: -20,
          osc5Wave: 0, osc5Harm: 4, osc5Vol: 40, osc5Pan: 70, osc5Detune: 20,
          osc6Wave: 0, osc6Harm: 5, osc6Vol: 20, osc6Pan: -90, osc6Detune: -25,
          osc7Wave: 0, osc7Harm: 5, osc7Vol: 20, osc7Pan: 90, osc7Detune: 25,
        },
        envelope: { attack: 0.5, decay: 0.3, sustain: 0.7, release: 1.0 },
      },
      {
        name: 'Saw Organ',
        params: {
          volume: 60,
          fx1: 10,
          osc0Wave: 1, osc0Harm: 2, osc0Vol: 100, osc0Pan: 0, osc0Detune: 0,
          osc1Wave: 1, osc1Harm: 3, osc1Vol: 70, osc1Pan: 0, osc1Detune: 0,
          osc2Wave: 1, osc2Harm: 4, osc2Vol: 50, osc2Pan: 0, osc2Detune: 0,
          osc3Wave: 1, osc3Harm: 5, osc3Vol: 35, osc3Pan: 0, osc3Detune: 0,
          osc4Wave: 1, osc4Harm: 6, osc4Vol: 25, osc4Pan: 0, osc4Detune: 0,
          osc5Wave: 1, osc5Harm: 7, osc5Vol: 18, osc5Pan: 0, osc5Detune: 0,
          osc6Wave: 1, osc6Harm: 8, osc6Vol: 12, osc6Pan: 0, osc6Detune: 0,
          osc7Wave: 1, osc7Harm: 9, osc7Vol: 8, osc7Pan: 0, osc7Detune: 0,
        },
      },
      {
        name: 'Bell Tones',
        params: {
          volume: 70,
          osc0Wave: 0, osc0Harm: 2, osc0Vol: 100, osc0Pan: 0, osc0Detune: 0,
          osc1Wave: 0, osc1Harm: 5, osc1Vol: 80, osc1Pan: 0, osc1Detune: 0,
          osc2Wave: 0, osc2Harm: 8, osc2Vol: 60, osc2Pan: 0, osc2Detune: 0,
          osc3Wave: 0, osc3Harm: 11, osc3Vol: 40, osc3Pan: 0, osc3Detune: 0,
          osc4Wave: 0, osc4Harm: 14, osc4Vol: 30, osc4Pan: 0, osc4Detune: 0,
          osc5Wave: 0, osc5Harm: 17, osc5Vol: 20, osc5Pan: 0, osc5Detune: 0,
          osc6Wave: 0, osc6Harm: 3, osc6Vol: 50, osc6Pan: 0, osc6Detune: 0,
          osc7Wave: 0, osc7Harm: 6, osc7Vol: 35, osc7Pan: 0, osc7Detune: 0,
        },
        envelope: { attack: 0.001, decay: 2.0, sustain: 0.0, release: 2.0 },
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
    this.voices.clear();
    super.dispose();
  }
}