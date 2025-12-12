// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Waveshaper - Distortion/saturation effect using waveshaping
 * 
 * Features:
 * - Multiple curve types (soft clip, hard clip, sine, etc.)
 * - Drive/input gain
 * - Output gain
 * - Oversample (2x, 4x) for anti-aliasing
 * - Custom curve editor
 * - Wet/dry mix
 */

import { BaseEffect, EffectParameterDescriptor, EffectPreset } from './BaseEffect';
import { clamp, dBToLinear, linearToDb } from '../utils/AudioMath';

/**
 * Curve types for waveshaping
 */
export enum WaveshaperCurveType {
  SoftClip = 'softclip',
  HardClip = 'hardclip',
  Sine = 'sine',
  Tanh = 'tanh',
  Atan = 'atan',
  Fuzz = 'fuzz',
  Asymmetric = 'asymmetric',
  Tube = 'tube',
  Rectify = 'rectify',
  Custom = 'custom',
}

/**
 * Waveshaper effect using Web Audio WaveShaperNode
 */
export class Waveshaper extends BaseEffect {
  // Waveshaper node
  private waveshaper: WaveShaperNode;
  
  // Input/output gain
  private inputGain: GainNode;
  private outputGain: GainNode;
  
  // Current curve
  private currentCurve: Float32Array<ArrayBuffer>;
  private customCurve: Float32Array<ArrayBuffer> | null = null;
  
  // Curve resolution
  private readonly curveResolution = 44100;

  constructor(audioContext: AudioContext, id: string, name: string = 'Waveshaper') {
    super(audioContext, id, name, 'waveshaper');
    
    // Create input gain (drive)
    this.inputGain = audioContext.createGain();
    
    // Create waveshaper
    this.waveshaper = audioContext.createWaveShaper();
    this.currentCurve = this.createCurve(WaveshaperCurveType.SoftClip, 0.5);
    this.waveshaper.curve = this.currentCurve;
    this.waveshaper.oversample = '2x';
    
    // Create output gain
    this.outputGain = audioContext.createGain();
    
    this.initializeEffect();
    this.setupRouting();
    this.addDefaultPresets();
  }

  protected initializeEffect(): void {
    // Initialize default parameters
    this.params = {
      curveType: 0,          // Curve type index (0-9)
      drive: 0.5,            // Drive amount (0-1)
      outputLevel: 0.7,      // Output level (0-1)
      oversample: 1,         // Oversample mode (0=none, 1=2x, 2=4x)
      mix: 1,                // Wet/dry mix (0-1)
    };
    
    this.applyParameters();
  }

  private setupRouting(): void {
    // Routing: input -> inputGain -> waveshaper -> outputGain -> wetGain -> output
    this.inputNode.connect(this.inputGain);
    this.inputGain.connect(this.waveshaper);
    this.waveshaper.connect(this.outputGain);
    this.outputGain.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  private applyParameters(): void {
    const currentTime = this.audioContext.currentTime;
    
    // Set drive (input gain)
    const driveGain = 1 + this.params.drive * 10; // 1x to 11x
    this.inputGain.gain.setTargetAtTime(driveGain, currentTime, 0.01);
    
    // Set output level
    this.outputGain.gain.setTargetAtTime(this.params.outputLevel, currentTime, 0.01);
    
    // Set oversample mode
    const oversampleModes: OverSampleType[] = ['none', '2x', '4x'];
    this.waveshaper.oversample = oversampleModes[Math.floor(this.params.oversample)];
    
    // Update curve
    const curveTypes = Object.values(WaveshaperCurveType);
    const curveType = curveTypes[Math.floor(this.params.curveType)] || WaveshaperCurveType.SoftClip;
    this.currentCurve = this.createCurve(curveType, this.params.drive);
    this.waveshaper.curve = this.currentCurve;
    
    // Set wet/dry mix
    this.setWetDry(this.params.mix);
  }

  /**
   * Create a waveshaping curve
   */
  private createCurve(type: WaveshaperCurveType, drive: number): Float32Array<ArrayBuffer> {
    const samples = this.curveResolution;
    const curve = new Float32Array(samples);
    const k = drive * 50; // Drive factor
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1; // -1 to 1
      
      switch (type) {
        case WaveshaperCurveType.SoftClip:
          // Soft clipping using tanh
          curve[i] = Math.tanh(x * (1 + k * 0.5));
          break;
          
        case WaveshaperCurveType.HardClip:
          // Hard clipping
          const threshold = 1 / (1 + k * 0.1);
          curve[i] = clamp(x * (1 + k * 0.2), -threshold, threshold) / threshold;
          break;
          
        case WaveshaperCurveType.Sine:
          // Sine waveshaping
          curve[i] = Math.sin(x * Math.PI * (0.5 + k * 0.1));
          break;
          
        case WaveshaperCurveType.Tanh:
          // Pure tanh
          curve[i] = Math.tanh(x * (1 + k));
          break;
          
        case WaveshaperCurveType.Atan:
          // Arctangent
          curve[i] = (2 / Math.PI) * Math.atan(x * (1 + k * 2));
          break;
          
        case WaveshaperCurveType.Fuzz:
          // Fuzz distortion
          const sign = x >= 0 ? 1 : -1;
          const absX = Math.abs(x);
          curve[i] = sign * (1 - Math.exp(-absX * (3 + k * 5)));
          break;
          
        case WaveshaperCurveType.Asymmetric:
          // Asymmetric clipping (tube-like)
          if (x >= 0) {
            curve[i] = Math.tanh(x * (1 + k * 0.3));
          } else {
            curve[i] = Math.tanh(x * (1 + k));
          }
          break;
          
        case WaveshaperCurveType.Tube:
          // Tube saturation approximation
          if (x >= 0) {
            curve[i] = 1 - Math.exp(-x * (2 + k));
          } else {
            curve[i] = -1 + Math.exp(x * (2 + k * 0.5));
          }
          break;
          
        case WaveshaperCurveType.Rectify:
          // Full wave rectification with smoothing
          curve[i] = Math.tanh(Math.abs(x) * (1 + k * 0.5)) * (x >= 0 ? 1 : -0.5);
          break;
          
        case WaveshaperCurveType.Custom:
          // Use custom curve if available, otherwise linear
          if (this.customCurve) {
            curve[i] = this.customCurve[i];
          } else {
            curve[i] = x;
          }
          break;
          
        default:
          curve[i] = x;
      }
    }
    
    return curve;
  }

  /**
   * Set a custom curve
   */
  setCustomCurve(curve: Float32Array<ArrayBuffer>): void {
    this.customCurve = curve;
    if (this.params.curveType === Object.values(WaveshaperCurveType).indexOf(WaveshaperCurveType.Custom)) {
      this.waveshaper.curve = curve;
    }
  }

  /**
   * Get the current curve for visualization
   */
  getCurve(): Float32Array<ArrayBuffer> {
    return this.currentCurve;
  }

  /**
   * Get curve type name
   */
  getCurveTypeName(): string {
    const curveTypes = Object.values(WaveshaperCurveType);
    return curveTypes[Math.floor(this.params.curveType)] || 'Unknown';
  }

  /**
   * Get all curve type names
   */
  static getCurveTypeNames(): string[] {
    return Object.values(WaveshaperCurveType);
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      {
        name: 'Curve Type',
        key: 'curveType',
        min: 0,
        max: 9,
        default: 0,
        step: 1,
      },
      {
        name: 'Drive',
        key: 'drive',
        min: 0,
        max: 1,
        default: 0.5,
        step: 0.01,
      },
      {
        name: 'Output',
        key: 'outputLevel',
        min: 0,
        max: 1,
        default: 0.7,
        step: 0.01,
      },
      {
        name: 'Oversample',
        key: 'oversample',
        min: 0,
        max: 2,
        default: 1,
        step: 1,
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
      case 'curveType':
        const curveTypes = Object.values(WaveshaperCurveType);
        const curveType = curveTypes[Math.floor(value)] || WaveshaperCurveType.SoftClip;
        this.currentCurve = this.createCurve(curveType, this.params.drive);
        this.waveshaper.curve = this.currentCurve;
        break;
      case 'drive':
        const driveGain = 1 + value * 10;
        this.inputGain.gain.setTargetAtTime(driveGain, currentTime, 0.01);
        // Also update curve
        const curveTypesForDrive = Object.values(WaveshaperCurveType);
        const curveTypeForDrive = curveTypesForDrive[Math.floor(this.params.curveType)] || WaveshaperCurveType.SoftClip;
        this.currentCurve = this.createCurve(curveTypeForDrive, value);
        this.waveshaper.curve = this.currentCurve;
        break;
      case 'outputLevel':
        this.outputGain.gain.setTargetAtTime(value, currentTime, 0.01);
        break;
      case 'oversample':
        const oversampleModes: OverSampleType[] = ['none', '2x', '4x'];
        this.waveshaper.oversample = oversampleModes[Math.floor(value)];
        break;
      case 'mix':
        this.setWetDry(value);
        break;
    }
  }

  private addDefaultPresets(): void {
    const presets: EffectPreset[] = [
      {
        name: 'Warm',
        params: {
          curveType: 0, // SoftClip
          drive: 0.3,
          outputLevel: 0.8,
          oversample: 1,
          mix: 0.7,
        },
      },
      {
        name: 'Crunch',
        params: {
          curveType: 3, // Tanh
          drive: 0.6,
          outputLevel: 0.6,
          oversample: 1,
          mix: 1,
        },
      },
      {
        name: 'Fuzz',
        params: {
          curveType: 5, // Fuzz
          drive: 0.8,
          outputLevel: 0.5,
          oversample: 2,
          mix: 1,
        },
      },
      {
        name: 'Tube',
        params: {
          curveType: 7, // Tube
          drive: 0.4,
          outputLevel: 0.75,
          oversample: 1,
          mix: 0.8,
        },
      },
      {
        name: 'Hard Clip',
        params: {
          curveType: 1, // HardClip
          drive: 0.5,
          outputLevel: 0.6,
          oversample: 2,
          mix: 1,
        },
      },
      {
        name: 'Subtle',
        params: {
          curveType: 4, // Atan
          drive: 0.2,
          outputLevel: 0.9,
          oversample: 1,
          mix: 0.5,
        },
      },
      {
        name: 'Extreme',
        params: {
          curveType: 5, // Fuzz
          drive: 1,
          outputLevel: 0.4,
          oversample: 2,
          mix: 1,
        },
      },
      {
        name: 'Asymmetric',
        params: {
          curveType: 6, // Asymmetric
          drive: 0.5,
          outputLevel: 0.7,
          oversample: 1,
          mix: 0.9,
        },
      },
    ];

    for (const preset of presets) {
      this.addPreset(preset);
    }
  }

  dispose(): void {
    this.inputGain.disconnect();
    this.waveshaper.disconnect();
    this.outputGain.disconnect();
    
    super.dispose();
  }
}