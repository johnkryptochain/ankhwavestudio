// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * BassBooster - Low frequency enhancement effect
 * 
 * Features:
 * - Low shelf filter
 * - Frequency control (20-500 Hz)
 * - Gain control (-20 to +20 dB)
 * - Ratio/saturation for warmth
 * - Wet/dry mix
 */

import { BaseEffect, EffectParameterDescriptor, EffectPreset } from './BaseEffect';
import { clamp, dBToLinear } from '../utils/AudioMath';

/**
 * BassBooster effect using low shelf filter and saturation
 */
export class BassBooster extends BaseEffect {
  // Low shelf filter
  private lowShelfFilter: BiquadFilterNode;
  
  // Saturation waveshaper
  private waveshaper: WaveShaperNode;
  private saturationCurve: Float32Array<ArrayBuffer>;
  
  // High pass filter to prevent DC offset
  private highPassFilter: BiquadFilterNode;
  
  // Output gain compensation
  private outputGain: GainNode;

  constructor(audioContext: AudioContext, id: string, name: string = 'Bass Booster') {
    super(audioContext, id, name, 'bassbooster');
    
    // Create low shelf filter
    this.lowShelfFilter = audioContext.createBiquadFilter();
    this.lowShelfFilter.type = 'lowshelf';
    
    // Create waveshaper for saturation
    this.waveshaper = audioContext.createWaveShaper();
    this.saturationCurve = this.createSaturationCurve(0);
    this.waveshaper.curve = this.saturationCurve;
    this.waveshaper.oversample = '2x';
    
    // Create high pass filter to remove DC offset
    this.highPassFilter = audioContext.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = 20;
    this.highPassFilter.Q.value = 0.7;
    
    // Create output gain
    this.outputGain = audioContext.createGain();
    
    this.initializeEffect();
    this.setupRouting();
    this.addDefaultPresets();
  }

  protected initializeEffect(): void {
    // Initialize default parameters
    this.params = {
      frequency: 100,      // Center frequency in Hz (20-500)
      gain: 6,             // Boost amount in dB (-20 to 20)
      saturation: 0.2,     // Saturation/warmth amount (0-1)
      mix: 1,              // Wet/dry mix (0-1)
    };
    
    this.applyParameters();
  }

  private setupRouting(): void {
    // Routing: input -> lowShelf -> waveshaper -> highPass -> outputGain -> wetGain -> output
    this.inputNode.connect(this.lowShelfFilter);
    this.lowShelfFilter.connect(this.waveshaper);
    this.waveshaper.connect(this.highPassFilter);
    this.highPassFilter.connect(this.outputGain);
    this.outputGain.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  private applyParameters(): void {
    const currentTime = this.audioContext.currentTime;
    
    // Set low shelf filter parameters
    this.lowShelfFilter.frequency.setTargetAtTime(this.params.frequency, currentTime, 0.01);
    this.lowShelfFilter.gain.setTargetAtTime(this.params.gain, currentTime, 0.01);
    
    // Update saturation curve
    this.saturationCurve = this.createSaturationCurve(this.params.saturation);
    this.waveshaper.curve = this.saturationCurve;
    
    // Compensate output gain based on boost amount
    const compensation = this.params.gain > 0 ? dBToLinear(-this.params.gain * 0.3) : 1;
    this.outputGain.gain.setTargetAtTime(compensation, currentTime, 0.01);
    
    // Set wet/dry mix
    this.setWetDry(this.params.mix);
  }

  /**
   * Create a saturation curve for the waveshaper
   * Uses soft clipping with adjustable amount
   */
  private createSaturationCurve(amount: number): Float32Array<ArrayBuffer> {
    const samples = 44100;
    const curve = new Float32Array(samples);
    
    if (amount === 0) {
      // Linear (no saturation)
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = x;
      }
    } else {
      // Soft saturation using tanh-like curve
      const k = amount * 10;
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        // Asymmetric saturation for warmth
        if (x >= 0) {
          curve[i] = Math.tanh(x * (1 + k * 0.5));
        } else {
          curve[i] = Math.tanh(x * (1 + k));
        }
      }
    }
    
    return curve;
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      {
        name: 'Frequency',
        key: 'frequency',
        min: 20,
        max: 500,
        default: 100,
        step: 1,
        unit: ' Hz',
        type: 'logarithmic',
      },
      {
        name: 'Gain',
        key: 'gain',
        min: -20,
        max: 20,
        default: 6,
        step: 0.5,
        unit: ' dB',
        type: 'linear',
      },
      {
        name: 'Saturation',
        key: 'saturation',
        min: 0,
        max: 1,
        default: 0.2,
        step: 0.01,
      },
      {
        name: 'Mix',
        key: 'mix',
        min: 0,
        max: 1,
        default: 1,
        step: 0.01,
      },
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    const currentTime = this.audioContext.currentTime;
    
    switch (key) {
      case 'frequency':
        this.lowShelfFilter.frequency.setTargetAtTime(value, currentTime, 0.01);
        break;
      case 'gain':
        this.lowShelfFilter.gain.setTargetAtTime(value, currentTime, 0.01);
        // Compensate output
        const compensation = value > 0 ? dBToLinear(-value * 0.3) : 1;
        this.outputGain.gain.setTargetAtTime(compensation, currentTime, 0.01);
        break;
      case 'saturation':
        this.saturationCurve = this.createSaturationCurve(value);
        this.waveshaper.curve = this.saturationCurve;
        break;
      case 'mix':
        this.setWetDry(value);
        break;
    }
  }

  /**
   * Get the frequency response at a given frequency
   */
  getFrequencyResponse(frequency: number): number {
    // Approximate the low shelf response
    const fc = this.params.frequency;
    const gain = this.params.gain;
    
    if (frequency <= fc) {
      return gain;
    } else {
      // Gradual rolloff above cutoff
      const octaves = Math.log2(frequency / fc);
      return gain * Math.max(0, 1 - octaves * 0.5);
    }
  }

  private addDefaultPresets(): void {
    const presets: EffectPreset[] = [
      {
        name: 'Subtle Warmth',
        params: {
          frequency: 80,
          gain: 3,
          saturation: 0.1,
          mix: 1,
        },
      },
      {
        name: 'Deep Bass',
        params: {
          frequency: 60,
          gain: 9,
          saturation: 0.2,
          mix: 1,
        },
      },
      {
        name: 'Sub Boost',
        params: {
          frequency: 40,
          gain: 12,
          saturation: 0.1,
          mix: 1,
        },
      },
      {
        name: 'Warm Tube',
        params: {
          frequency: 120,
          gain: 6,
          saturation: 0.5,
          mix: 0.8,
        },
      },
      {
        name: 'Punchy Kick',
        params: {
          frequency: 100,
          gain: 8,
          saturation: 0.3,
          mix: 1,
        },
      },
      {
        name: 'Bass Cut',
        params: {
          frequency: 150,
          gain: -12,
          saturation: 0,
          mix: 1,
        },
      },
      {
        name: 'Vintage',
        params: {
          frequency: 200,
          gain: 4,
          saturation: 0.7,
          mix: 0.7,
        },
      },
      {
        name: 'Maximum Bass',
        params: {
          frequency: 80,
          gain: 18,
          saturation: 0.4,
          mix: 1,
        },
      },
    ];

    for (const preset of presets) {
      this.addPreset(preset);
    }
  }

  dispose(): void {
    this.lowShelfFilter.disconnect();
    this.waveshaper.disconnect();
    this.highPassFilter.disconnect();
    this.outputGain.disconnect();
    
    super.dispose();
  }
}