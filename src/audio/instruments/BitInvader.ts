// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * BitInvader - Wavetable synthesizer with custom waveform drawing
 * Based on the original AnkhWaveStudio BitInvader plugin
 * 
 * Features:
 * - Custom wavetable drawing
 * - Wavetable interpolation
 * - Sample length (32-256 samples)
 * - Normalize function
 * - Smooth function
 * - Multiple preset waveforms
 * - Wavetable morphing
 */

import { BaseInstrument, InstrumentParameterDescriptor, InstrumentPreset } from './BaseInstrument';
import { clamp, midiNoteToFrequency } from '../utils/AudioMath';

// Default wavetable length
const DEFAULT_SAMPLE_LENGTH = 128;
const MIN_SAMPLE_LENGTH = 32;
const MAX_SAMPLE_LENGTH = 256;

/**
 * Voice state for BitInvader
 */
interface BitInvaderVoice {
  noteNumber: number;
  frequency: number;
  velocity: number;
  startTime: number;
  
  // Wavetable position
  sampleIndex: number;
  sampleRealIndex: number;
  
  // Envelope state
  envPhase: number;
  envStage: 'attack' | 'decay' | 'sustain' | 'release' | 'off';
  envValue: number;
  
  // Release flag
  released: boolean;
  releaseTime: number;
}

/**
 * BitInvader - Wavetable synthesizer
 */
export class BitInvader extends BaseInstrument {
  private voices: Map<number, BitInvaderVoice> = new Map();
  
  // Audio processing
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sampleRate: number;
  
  // Wavetable
  private wavetable: Float32Array;
  private sampleLength: number = DEFAULT_SAMPLE_LENGTH;
  private normalizeFactor: number = 1;
  
  constructor(audioContext: AudioContext, id: string, name: string = 'BitInvader') {
    super(audioContext, id, name, 'bitinvader');
    this.sampleRate = audioContext.sampleRate;
    this.wavetable = new Float32Array(MAX_SAMPLE_LENGTH);
    this.initializeInstrument();
    this.addDefaultPresets();
    this.setupAudioProcessing();
  }

  protected initializeInstrument(): void {
    // Initialize default parameters
    this.params = {
      sampleLength: DEFAULT_SAMPLE_LENGTH,
      interpolation: 1,  // 0 = off, 1 = on
      normalize: 0,      // 0 = off, 1 = on
    };
    
    // Set up envelope
    this.envelope = {
      attack: 0.01,
      decay: 0.1,
      sustain: 0.8,
      release: 0.3,
    };
    
    // Initialize with sine wave
    this.generateSineWave();
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

  private processVoice(voice: BitInvaderVoice, outputL: Float32Array, outputR: Float32Array, numSamples: number): void {
    const sampleRate = this.sampleRate;
    const interpolation = this.params.interpolation > 0.5;
    
    for (let i = 0; i < numSamples; i++) {
      // Update envelope
      const envValue = this.updateEnvelope(voice);
      
      // Calculate sample increment based on frequency
      const sampleIncrement = (voice.frequency * this.sampleLength) / sampleRate;
      
      // Get sample from wavetable
      let sample: number;
      if (interpolation) {
        // Linear interpolation
        const index = Math.floor(voice.sampleRealIndex);
        const frac = voice.sampleRealIndex - index;
        const s1 = this.wavetable[index % this.sampleLength];
        const s2 = this.wavetable[(index + 1) % this.sampleLength];
        sample = s1 + (s2 - s1) * frac;
      } else {
        // No interpolation
        sample = this.wavetable[Math.floor(voice.sampleRealIndex) % this.sampleLength];
      }
      
      // Apply normalization factor
      sample *= this.normalizeFactor;
      
      // Apply envelope and velocity
      const gain = envValue * voice.velocity;
      outputL[i] += sample * gain;
      outputR[i] += sample * gain;
      
      // Update sample position
      voice.sampleRealIndex += sampleIncrement;
      if (voice.sampleRealIndex >= this.sampleLength) {
        voice.sampleRealIndex -= this.sampleLength;
      }
    }
  }

  private updateEnvelope(voice: BitInvaderVoice): number {
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

  /**
   * Get the current wavetable data
   */
  getWavetable(): Float32Array {
    return this.wavetable.slice(0, this.sampleLength);
  }

  /**
   * Set wavetable data from an array
   */
  setWavetable(data: number[] | Float32Array): void {
    const length = Math.min(data.length, MAX_SAMPLE_LENGTH);
    for (let i = 0; i < length; i++) {
      this.wavetable[i] = clamp(data[i], -1, 1);
    }
    this.sampleLength = length;
    this.params.sampleLength = length;
    
    if (this.params.normalize > 0.5) {
      this.normalize();
    }
  }

  /**
   * Set a single sample in the wavetable
   */
  setSample(index: number, value: number): void {
    if (index >= 0 && index < this.sampleLength) {
      this.wavetable[index] = clamp(value, -1, 1);
      
      if (this.params.normalize > 0.5) {
        this.normalize();
      }
    }
  }

  /**
   * Generate a sine wave
   */
  generateSineWave(): void {
    for (let i = 0; i < this.sampleLength; i++) {
      this.wavetable[i] = Math.sin((i / this.sampleLength) * Math.PI * 2);
    }
    this.normalizeFactor = 1;
  }

  /**
   * Generate a triangle wave
   */
  generateTriangleWave(): void {
    for (let i = 0; i < this.sampleLength; i++) {
      const t = i / this.sampleLength;
      this.wavetable[i] = t < 0.5 ? 4 * t - 1 : 3 - 4 * t;
    }
    this.normalizeFactor = 1;
  }

  /**
   * Generate a sawtooth wave
   */
  generateSawWave(): void {
    for (let i = 0; i < this.sampleLength; i++) {
      this.wavetable[i] = 2 * (i / this.sampleLength) - 1;
    }
    this.normalizeFactor = 1;
  }

  /**
   * Generate a square wave
   */
  generateSquareWave(): void {
    for (let i = 0; i < this.sampleLength; i++) {
      this.wavetable[i] = i < this.sampleLength / 2 ? 1 : -1;
    }
    this.normalizeFactor = 1;
  }

  /**
   * Generate white noise
   */
  generateNoiseWave(): void {
    for (let i = 0; i < this.sampleLength; i++) {
      this.wavetable[i] = Math.random() * 2 - 1;
    }
    this.normalizeFactor = 1;
  }

  /**
   * Normalize the wavetable
   */
  normalize(): void {
    let maxAbs = 0;
    for (let i = 0; i < this.sampleLength; i++) {
      maxAbs = Math.max(maxAbs, Math.abs(this.wavetable[i]));
    }
    this.normalizeFactor = maxAbs > 0 ? 1 / maxAbs : 1;
  }

  /**
   * Smooth the wavetable
   */
  smooth(): void {
    const temp = new Float32Array(this.sampleLength);
    
    for (let i = 0; i < this.sampleLength; i++) {
      const prev = this.wavetable[(i - 1 + this.sampleLength) % this.sampleLength];
      const curr = this.wavetable[i];
      const next = this.wavetable[(i + 1) % this.sampleLength];
      temp[i] = (prev + curr * 2 + next) / 4;
    }
    
    for (let i = 0; i < this.sampleLength; i++) {
      this.wavetable[i] = temp[i];
    }
    
    if (this.params.normalize > 0.5) {
      this.normalize();
    }
  }

  /**
   * Set sample length
   */
  setSampleLength(length: number): void {
    const newLength = clamp(Math.round(length), MIN_SAMPLE_LENGTH, MAX_SAMPLE_LENGTH);
    
    if (newLength !== this.sampleLength) {
      // Resample the wavetable
      const oldLength = this.sampleLength;
      const temp = new Float32Array(newLength);
      
      for (let i = 0; i < newLength; i++) {
        const oldIndex = (i / newLength) * oldLength;
        const index = Math.floor(oldIndex);
        const frac = oldIndex - index;
        const s1 = this.wavetable[index % oldLength];
        const s2 = this.wavetable[(index + 1) % oldLength];
        temp[i] = s1 + (s2 - s1) * frac;
      }
      
      for (let i = 0; i < newLength; i++) {
        this.wavetable[i] = temp[i];
      }
      
      this.sampleLength = newLength;
      this.params.sampleLength = newLength;
    }
  }

  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    return [
      { name: 'Sample Length', key: 'sampleLength', min: MIN_SAMPLE_LENGTH, max: MAX_SAMPLE_LENGTH, 
        default: DEFAULT_SAMPLE_LENGTH, step: 1, category: 'Wavetable' },
      { name: 'Interpolation', key: 'interpolation', min: 0, max: 1, default: 1, 
        type: 'boolean', category: 'Wavetable' },
      { name: 'Normalize', key: 'normalize', min: 0, max: 1, default: 0, 
        type: 'boolean', category: 'Wavetable' },
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    if (key === 'sampleLength') {
      this.setSampleLength(value);
    } else if (key === 'normalize' && value > 0.5) {
      this.normalize();
    }
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
    const voice: BitInvaderVoice = {
      noteNumber,
      frequency,
      velocity,
      startTime: this.audioContext.currentTime,
      
      sampleIndex: 0,
      sampleRealIndex: 0,
      
      envPhase: 0,
      envStage: 'attack',
      envValue: 0,
      
      released: false,
      releaseTime: 0,
    };
    
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
        name: 'Sine',
        params: {
          sampleLength: 128,
          interpolation: 1,
          normalize: 0,
        },
      },
      {
        name: 'Triangle',
        params: {
          sampleLength: 128,
          interpolation: 1,
          normalize: 0,
        },
      },
      {
        name: 'Sawtooth',
        params: {
          sampleLength: 128,
          interpolation: 1,
          normalize: 0,
        },
      },
      {
        name: 'Square',
        params: {
          sampleLength: 128,
          interpolation: 1,
          normalize: 0,
        },
      },
      {
        name: 'Lo-Fi',
        params: {
          sampleLength: 32,
          interpolation: 0,
          normalize: 1,
        },
      },
      {
        name: 'Hi-Fi',
        params: {
          sampleLength: 256,
          interpolation: 1,
          normalize: 1,
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
    this.voices.clear();
    super.dispose();
  }
}