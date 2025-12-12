// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * EQ3Band - Professional 3-band parametric equalizer
 * 
 * Features:
 * - Low band: Low shelf filter (20-500 Hz)
 * - Mid band: Peaking filter (200-5000 Hz)
 * - High band: High shelf filter (1000-20000 Hz)
 * - Per-band gain, frequency, and Q controls
 * - Output gain control
 * - Real-time frequency response calculation
 */

import { BaseEffect, EffectParameterDescriptor, EffectPreset } from './BaseEffect';
import { clamp, dBToLinear } from '../utils/AudioMath';

/**
 * EQ3Band parameters interface
 */
export interface EQ3BandParams {
  // Low band
  lowGain: number;      // -24 to +24 dB
  lowFreq: number;      // 20-500 Hz
  lowQ: number;         // 0.1-10
  
  // Mid band
  midGain: number;      // -24 to +24 dB
  midFreq: number;      // 200-5000 Hz
  midQ: number;         // 0.1-10
  
  // High band
  highGain: number;     // -24 to +24 dB
  highFreq: number;     // 1000-20000 Hz
  highQ: number;        // 0.1-10
  
  // Output
  outputGain: number;   // -24 to +24 dB
}

/**
 * Frequency response point for visualization
 */
export interface FrequencyResponsePoint {
  frequency: number;
  magnitude: number;  // dB
  phase: number;      // radians
}

/**
 * 3-Band Parametric EQ
 */
export class EQ3Band extends BaseEffect {
  private lowFilter: BiquadFilterNode;
  private midFilter: BiquadFilterNode;
  private highFilter: BiquadFilterNode;
  private outputGainNode: GainNode;
  private analyserNode: AnalyserNode;
  private analyserBuffer: Float32Array<ArrayBuffer>;
  
  // For frequency response calculation
  private frequencyArray: Float32Array<ArrayBuffer>;
  private magResponseArray: Float32Array<ArrayBuffer>;
  private phaseResponseArray: Float32Array<ArrayBuffer>;
  
  private static readonly RESPONSE_POINTS = 256;

  constructor(audioContext: AudioContext, id: string, name: string = '3-Band EQ') {
    super(audioContext, id, name, 'eq3band');
    
    // Create filter nodes
    this.lowFilter = audioContext.createBiquadFilter();
    this.lowFilter.type = 'lowshelf';
    
    this.midFilter = audioContext.createBiquadFilter();
    this.midFilter.type = 'peaking';
    
    this.highFilter = audioContext.createBiquadFilter();
    this.highFilter.type = 'highshelf';
    
    // Create output gain node
    this.outputGainNode = audioContext.createGain();
    this.outputGainNode.gain.value = 1.0;
    
    // Create analyser for spectrum display
    this.analyserNode = audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;
    this.analyserBuffer = new Float32Array(this.analyserNode.frequencyBinCount) as Float32Array<ArrayBuffer>;
    
    // Create arrays for frequency response calculation
    this.frequencyArray = new Float32Array(EQ3Band.RESPONSE_POINTS) as Float32Array<ArrayBuffer>;
    this.magResponseArray = new Float32Array(EQ3Band.RESPONSE_POINTS) as Float32Array<ArrayBuffer>;
    this.phaseResponseArray = new Float32Array(EQ3Band.RESPONSE_POINTS) as Float32Array<ArrayBuffer>;
    
    // Initialize frequency array (logarithmic scale from 20Hz to 20kHz)
    for (let i = 0; i < EQ3Band.RESPONSE_POINTS; i++) {
      const t = i / (EQ3Band.RESPONSE_POINTS - 1);
      this.frequencyArray[i] = 20 * Math.pow(1000, t); // 20Hz to 20kHz
    }
    
    this.initializeEffect();
    this.setupRouting();
    this.addDefaultPresets();
  }

  protected initializeEffect(): void {
    // Initialize default parameters
    this.params = {
      // Low band
      lowGain: 0,
      lowFreq: 100,
      lowQ: 0.7,
      
      // Mid band
      midGain: 0,
      midFreq: 1000,
      midQ: 1.0,
      
      // High band
      highGain: 0,
      highFreq: 8000,
      highQ: 0.7,
      
      // Output
      outputGain: 0,
    };
    
    // Apply initial parameters
    this.applyLowBand();
    this.applyMidBand();
    this.applyHighBand();
    this.applyOutputGain();
  }

  private setupRouting(): void {
    // Input -> Low Filter -> Mid Filter -> High Filter -> Output Gain -> Analyser -> Wet Gain -> Output
    this.inputNode.connect(this.lowFilter);
    this.lowFilter.connect(this.midFilter);
    this.midFilter.connect(this.highFilter);
    this.highFilter.connect(this.outputGainNode);
    this.outputGainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      // Low band
      {
        name: 'Low Gain',
        key: 'lowGain',
        min: -24,
        max: 24,
        default: 0,
        unit: 'dB',
        type: 'linear',
      },
      {
        name: 'Low Frequency',
        key: 'lowFreq',
        min: 20,
        max: 500,
        default: 100,
        unit: 'Hz',
        type: 'logarithmic',
      },
      {
        name: 'Low Q',
        key: 'lowQ',
        min: 0.1,
        max: 10,
        default: 0.7,
        type: 'logarithmic',
      },
      
      // Mid band
      {
        name: 'Mid Gain',
        key: 'midGain',
        min: -24,
        max: 24,
        default: 0,
        unit: 'dB',
        type: 'linear',
      },
      {
        name: 'Mid Frequency',
        key: 'midFreq',
        min: 200,
        max: 5000,
        default: 1000,
        unit: 'Hz',
        type: 'logarithmic',
      },
      {
        name: 'Mid Q',
        key: 'midQ',
        min: 0.1,
        max: 10,
        default: 1.0,
        type: 'logarithmic',
      },
      
      // High band
      {
        name: 'High Gain',
        key: 'highGain',
        min: -24,
        max: 24,
        default: 0,
        unit: 'dB',
        type: 'linear',
      },
      {
        name: 'High Frequency',
        key: 'highFreq',
        min: 1000,
        max: 20000,
        default: 8000,
        unit: 'Hz',
        type: 'logarithmic',
      },
      {
        name: 'High Q',
        key: 'highQ',
        min: 0.1,
        max: 10,
        default: 0.7,
        type: 'logarithmic',
      },
      
      // Output
      {
        name: 'Output Gain',
        key: 'outputGain',
        min: -24,
        max: 24,
        default: 0,
        unit: 'dB',
        type: 'linear',
      },
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    switch (key) {
      case 'lowGain':
      case 'lowFreq':
      case 'lowQ':
        this.applyLowBand();
        break;
      case 'midGain':
      case 'midFreq':
      case 'midQ':
        this.applyMidBand();
        break;
      case 'highGain':
      case 'highFreq':
      case 'highQ':
        this.applyHighBand();
        break;
      case 'outputGain':
        this.applyOutputGain();
        break;
    }
  }

  private applyLowBand(): void {
    const t = this.audioContext.currentTime;
    const gain = clamp(this.params.lowGain, -24, 24);
    const freq = clamp(this.params.lowFreq, 20, 500);
    const q = clamp(this.params.lowQ, 0.1, 10);
    
    this.lowFilter.gain.setTargetAtTime(gain, t, 0.01);
    this.lowFilter.frequency.setTargetAtTime(freq, t, 0.01);
    this.lowFilter.Q.setTargetAtTime(q, t, 0.01);
  }

  private applyMidBand(): void {
    const t = this.audioContext.currentTime;
    const gain = clamp(this.params.midGain, -24, 24);
    const freq = clamp(this.params.midFreq, 200, 5000);
    const q = clamp(this.params.midQ, 0.1, 10);
    
    this.midFilter.gain.setTargetAtTime(gain, t, 0.01);
    this.midFilter.frequency.setTargetAtTime(freq, t, 0.01);
    this.midFilter.Q.setTargetAtTime(q, t, 0.01);
  }

  private applyHighBand(): void {
    const t = this.audioContext.currentTime;
    const gain = clamp(this.params.highGain, -24, 24);
    const freq = clamp(this.params.highFreq, 1000, 20000);
    const q = clamp(this.params.highQ, 0.1, 10);
    
    this.highFilter.gain.setTargetAtTime(gain, t, 0.01);
    this.highFilter.frequency.setTargetAtTime(freq, t, 0.01);
    this.highFilter.Q.setTargetAtTime(q, t, 0.01);
  }

  private applyOutputGain(): void {
    const t = this.audioContext.currentTime;
    const gain = clamp(this.params.outputGain, -24, 24);
    const linearGain = dBToLinear(gain);
    
    this.outputGainNode.gain.setTargetAtTime(linearGain, t, 0.01);
  }

  /**
   * Get the current EQ parameters
   */
  getEQParams(): EQ3BandParams {
    return {
      lowGain: this.params.lowGain,
      lowFreq: this.params.lowFreq,
      lowQ: this.params.lowQ,
      midGain: this.params.midGain,
      midFreq: this.params.midFreq,
      midQ: this.params.midQ,
      highGain: this.params.highGain,
      highFreq: this.params.highFreq,
      highQ: this.params.highQ,
      outputGain: this.params.outputGain,
    };
  }

  /**
   * Calculate the combined frequency response of all bands
   */
  getFrequencyResponse(): FrequencyResponsePoint[] {
    const response: FrequencyResponsePoint[] = [];
    
    // Get response from each filter
    const lowMag = new Float32Array(EQ3Band.RESPONSE_POINTS);
    const lowPhase = new Float32Array(EQ3Band.RESPONSE_POINTS);
    const midMag = new Float32Array(EQ3Band.RESPONSE_POINTS);
    const midPhase = new Float32Array(EQ3Band.RESPONSE_POINTS);
    const highMag = new Float32Array(EQ3Band.RESPONSE_POINTS);
    const highPhase = new Float32Array(EQ3Band.RESPONSE_POINTS);
    
    this.lowFilter.getFrequencyResponse(this.frequencyArray, lowMag, lowPhase);
    this.midFilter.getFrequencyResponse(this.frequencyArray, midMag, midPhase);
    this.highFilter.getFrequencyResponse(this.frequencyArray, highMag, highPhase);
    
    // Combine responses (multiply magnitudes, add phases)
    for (let i = 0; i < EQ3Band.RESPONSE_POINTS; i++) {
      const combinedMag = lowMag[i] * midMag[i] * highMag[i];
      const combinedPhase = lowPhase[i] + midPhase[i] + highPhase[i];
      
      response.push({
        frequency: this.frequencyArray[i],
        magnitude: 20 * Math.log10(combinedMag) + this.params.outputGain,
        phase: combinedPhase,
      });
    }
    
    return response;
  }

  /**
   * Get individual band frequency response
   */
  getBandResponse(band: 'low' | 'mid' | 'high'): FrequencyResponsePoint[] {
    const response: FrequencyResponsePoint[] = [];
    const filter = band === 'low' ? this.lowFilter : band === 'mid' ? this.midFilter : this.highFilter;
    
    filter.getFrequencyResponse(this.frequencyArray, this.magResponseArray, this.phaseResponseArray);
    
    for (let i = 0; i < EQ3Band.RESPONSE_POINTS; i++) {
      response.push({
        frequency: this.frequencyArray[i],
        magnitude: 20 * Math.log10(this.magResponseArray[i]),
        phase: this.phaseResponseArray[i],
      });
    }
    
    return response;
  }

  /**
   * Get spectrum data from the analyser
   */
  getSpectrumData(): Float32Array<ArrayBuffer> {
    this.analyserNode.getFloatFrequencyData(this.analyserBuffer);
    return this.analyserBuffer;
  }

  private addDefaultPresets(): void {
    const presets: EffectPreset[] = [
      {
        name: 'Flat',
        params: {
          lowGain: 0,
          lowFreq: 100,
          lowQ: 0.7,
          midGain: 0,
          midFreq: 1000,
          midQ: 1.0,
          highGain: 0,
          highFreq: 8000,
          highQ: 0.7,
          outputGain: 0,
        },
      },
      {
        name: 'Bass Boost',
        params: {
          lowGain: 6,
          lowFreq: 80,
          lowQ: 0.7,
          midGain: 0,
          midFreq: 1000,
          midQ: 1.0,
          highGain: 0,
          highFreq: 8000,
          highQ: 0.7,
          outputGain: 0,
        },
      },
      {
        name: 'Treble Boost',
        params: {
          lowGain: 0,
          lowFreq: 100,
          lowQ: 0.7,
          midGain: 0,
          midFreq: 1000,
          midQ: 1.0,
          highGain: 6,
          highFreq: 8000,
          highQ: 0.7,
          outputGain: 0,
        },
      },
      {
        name: 'Vocal Presence',
        params: {
          lowGain: -2,
          lowFreq: 100,
          lowQ: 0.7,
          midGain: 4,
          midFreq: 2500,
          midQ: 1.5,
          highGain: 2,
          highFreq: 10000,
          highQ: 0.7,
          outputGain: 0,
        },
      },
      {
        name: 'Warm',
        params: {
          lowGain: 3,
          lowFreq: 150,
          lowQ: 0.7,
          midGain: -2,
          midFreq: 3000,
          midQ: 1.0,
          highGain: -3,
          highFreq: 8000,
          highQ: 0.7,
          outputGain: 0,
        },
      },
      {
        name: 'Bright',
        params: {
          lowGain: -2,
          lowFreq: 100,
          lowQ: 0.7,
          midGain: 2,
          midFreq: 2000,
          midQ: 1.0,
          highGain: 5,
          highFreq: 10000,
          highQ: 0.7,
          outputGain: 0,
        },
      },
      {
        name: 'Scooped Mids',
        params: {
          lowGain: 4,
          lowFreq: 100,
          lowQ: 0.7,
          midGain: -4,
          midFreq: 800,
          midQ: 1.5,
          highGain: 4,
          highFreq: 8000,
          highQ: 0.7,
          outputGain: 0,
        },
      },
      {
        name: 'Telephone',
        params: {
          lowGain: -18,
          lowFreq: 300,
          lowQ: 0.7,
          midGain: 6,
          midFreq: 1500,
          midQ: 2.0,
          highGain: -18,
          highFreq: 3000,
          highQ: 0.7,
          outputGain: 0,
        },
      },
    ];

    for (const preset of presets) {
      this.addPreset(preset);
    }
  }

  dispose(): void {
    super.dispose();
    
    this.lowFilter.disconnect();
    this.midFilter.disconnect();
    this.highFilter.disconnect();
    this.outputGainNode.disconnect();
    this.analyserNode.disconnect();
  }
}

/**
 * Factory function to create an EQ3Band instance
 */
export function createEQ3Band(audioContext: AudioContext, id: string, name?: string): EQ3Band {
  return new EQ3Band(audioContext, id, name);
}
