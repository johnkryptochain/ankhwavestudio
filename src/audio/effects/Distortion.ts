// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Distortion Effect - Multiple distortion types with tone control
 * Based on original AnkhWaveStudio distortion implementation
 */

import { BaseEffect, EffectParameterDescriptor, EffectPreset } from './BaseEffect';

/**
 * Distortion types
 */
export enum DistortionType {
  Overdrive = 0,
  Fuzz = 1,
  Tube = 2,
  Clip = 3,
  Fold = 4,
  Sine = 5,
  Bitcrush = 6,
}

/**
 * Distortion effect processor
 */
export class Distortion extends BaseEffect {
  // Audio nodes
  private preFilterNode: BiquadFilterNode;
  private postFilterNode: BiquadFilterNode;
  private waveShaperNode: WaveShaperNode;
  private preGainNode: GainNode;
  private postGainNode: GainNode;
  
  // Distortion curve
  private curveSize: number = 8192;
  
  // Default presets
  private static readonly defaultPresets: EffectPreset[] = [
    {
      name: 'Subtle Warmth',
      params: { type: DistortionType.Tube, drive: 0.3, tone: 0.5, output: 0.8, mix: 0.5 }
    },
    {
      name: 'Overdrive',
      params: { type: DistortionType.Overdrive, drive: 0.5, tone: 0.6, output: 0.7, mix: 0.7 }
    },
    {
      name: 'Heavy Fuzz',
      params: { type: DistortionType.Fuzz, drive: 0.8, tone: 0.4, output: 0.5, mix: 0.8 }
    },
    {
      name: 'Hard Clip',
      params: { type: DistortionType.Clip, drive: 0.6, tone: 0.5, output: 0.6, mix: 0.7 }
    },
    {
      name: 'Wave Folder',
      params: { type: DistortionType.Fold, drive: 0.5, tone: 0.5, output: 0.6, mix: 0.6 }
    },
    {
      name: 'Sine Shaper',
      params: { type: DistortionType.Sine, drive: 0.4, tone: 0.6, output: 0.7, mix: 0.5 }
    },
    {
      name: 'Lo-Fi Crush',
      params: { type: DistortionType.Bitcrush, drive: 0.6, bitDepth: 8, sampleRate: 0.5, output: 0.7, mix: 0.8 }
    },
  ];

  constructor(audioContext: AudioContext, id: string = 'distortion') {
    super(audioContext, id, 'Distortion', 'distortion');
    
    // Create audio nodes
    this.preFilterNode = audioContext.createBiquadFilter();
    this.postFilterNode = audioContext.createBiquadFilter();
    this.waveShaperNode = audioContext.createWaveShaper();
    this.preGainNode = audioContext.createGain();
    this.postGainNode = audioContext.createGain();
    
    // Configure filters
    this.preFilterNode.type = 'lowpass';
    this.preFilterNode.frequency.value = 20000;
    this.preFilterNode.Q.value = 0.707;
    
    this.postFilterNode.type = 'lowpass';
    this.postFilterNode.frequency.value = 8000;
    this.postFilterNode.Q.value = 0.707;
    
    // Set waveshaper oversample for better quality
    this.waveShaperNode.oversample = '4x';
    
    // Load default presets
    for (const preset of Distortion.defaultPresets) {
      this.addPreset(preset);
    }
    
    // Initialize effect
    this.initializeEffect();
    
    // Connect audio graph
    this.connectAudioGraph();
  }

  /**
   * Connect the audio graph
   */
  private connectAudioGraph(): void {
    // Input -> preGain -> preFilter -> waveShaper -> postFilter -> postGain -> wetGain -> output
    this.inputNode.connect(this.preGainNode);
    this.preGainNode.connect(this.preFilterNode);
    this.preFilterNode.connect(this.waveShaperNode);
    this.waveShaperNode.connect(this.postFilterNode);
    this.postFilterNode.connect(this.postGainNode);
    this.postGainNode.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  /**
   * Initialize effect with default parameters
   */
  protected initializeEffect(): void {
    // Set default parameters
    this.params = {
      type: DistortionType.Overdrive,
      drive: 0.5,
      tone: 0.5,
      output: 0.7,
      mix: 0.7,
      bitDepth: 16,
      sampleRate: 1.0,
    };
    
    // Apply initial settings
    this.updateDistortionCurve();
    this.updateTone();
    this.updateGains();
  }

  /**
   * Get parameter descriptors for UI generation
   */
  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'Type', key: 'type', min: 0, max: 6, default: 0, step: 1, type: 'enum', enumValues: ['Overdrive', 'Fuzz', 'Tube', 'Clip', 'Fold', 'Sine', 'Bitcrush'] },
      { name: 'Drive', key: 'drive', min: 0, max: 1, default: 0.5, step: 0.01, unit: '' },
      { name: 'Tone', key: 'tone', min: 0, max: 1, default: 0.5, step: 0.01, unit: '' },
      { name: 'Output', key: 'output', min: 0, max: 1, default: 0.7, step: 0.01, unit: '' },
      { name: 'Mix', key: 'mix', min: 0, max: 1, default: 0.7, step: 0.01, unit: '%' },
      { name: 'Bit Depth', key: 'bitDepth', min: 1, max: 16, default: 16, step: 1, unit: 'bits' },
      { name: 'Sample Rate', key: 'sampleRate', min: 0.1, max: 1, default: 1, step: 0.01, unit: '' },
    ];
  }

  /**
   * Handle parameter changes
   */
  protected onParameterChange(key: string, value: number): void {
    switch (key) {
      case 'type':
      case 'drive':
      case 'bitDepth':
      case 'sampleRate':
        this.updateDistortionCurve();
        break;
      case 'tone':
        this.updateTone();
        break;
      case 'output':
        this.updateGains();
        break;
      case 'mix':
        this.setWetDry(value);
        break;
    }
  }

  /**
   * Update distortion curve based on type and drive
   */
  private updateDistortionCurve(): void {
    const type = Math.round(this.params.type || 0) as DistortionType;
    const drive = this.params.drive || 0.5;
    
    const curve = new Float32Array(this.curveSize);
    const halfSize = this.curveSize / 2;
    
    for (let i = 0; i < this.curveSize; i++) {
      const x = (i - halfSize) / halfSize; // -1 to 1
      curve[i] = this.applyDistortion(x, type, drive);
    }
    
    this.waveShaperNode.curve = curve;
  }

  /**
   * Apply distortion algorithm based on type
   */
  private applyDistortion(x: number, type: DistortionType, drive: number): number {
    // Scale drive for different algorithms
    const k = drive * 50 + 1;
    
    switch (type) {
      case DistortionType.Overdrive:
        // Soft clipping using tanh
        return Math.tanh(x * k) / Math.tanh(k);
        
      case DistortionType.Fuzz:
        // Asymmetric clipping
        if (x >= 0) {
          return Math.tanh(x * k * 2) / Math.tanh(k * 2);
        } else {
          return Math.tanh(x * k) / Math.tanh(k);
        }
        
      case DistortionType.Tube:
        // Tube-like saturation
        const a = 1 + drive * 10;
        if (x >= 0) {
          return 1 - Math.exp(-a * x);
        } else {
          return -(1 - Math.exp(a * x));
        }
        
      case DistortionType.Clip:
        // Hard clipping
        const threshold = 1 - drive * 0.9;
        return Math.max(-threshold, Math.min(threshold, x)) / threshold;
        
      case DistortionType.Fold:
        // Wave folding
        const foldAmount = 1 + drive * 4;
        let folded = x * foldAmount;
        while (Math.abs(folded) > 1) {
          if (folded > 1) {
            folded = 2 - folded;
          } else if (folded < -1) {
            folded = -2 - folded;
          }
        }
        return folded;
        
      case DistortionType.Sine:
        // Sine waveshaping
        const sineAmount = 1 + drive * 3;
        return Math.sin(x * Math.PI * sineAmount / 2);
        
      case DistortionType.Bitcrush:
        // Bit crushing (quantization)
        const bitDepth = Math.round(this.params.bitDepth || 16);
        const levels = Math.pow(2, bitDepth);
        const quantized = Math.round(x * levels) / levels;
        // Add some drive-based saturation
        return Math.tanh(quantized * (1 + drive * 2));
        
      default:
        return x;
    }
  }

  /**
   * Update tone control (post-filter frequency)
   */
  private updateTone(): void {
    const tone = this.params.tone || 0.5;
    // Map tone 0-1 to frequency 1000-12000 Hz (logarithmic)
    const minFreq = 1000;
    const maxFreq = 12000;
    const freq = minFreq * Math.pow(maxFreq / minFreq, tone);
    
    const currentTime = this.audioContext.currentTime;
    this.postFilterNode.frequency.setTargetAtTime(freq, currentTime, 0.01);
  }

  /**
   * Update gain stages
   */
  private updateGains(): void {
    const drive = this.params.drive || 0.5;
    const output = this.params.output || 0.7;
    
    // Pre-gain increases with drive
    const preGain = 1 + drive * 3;
    
    // Post-gain compensates for increased level and applies output control
    const postGain = output / Math.sqrt(preGain);
    
    const currentTime = this.audioContext.currentTime;
    this.preGainNode.gain.setTargetAtTime(preGain, currentTime, 0.01);
    this.postGainNode.gain.setTargetAtTime(postGain, currentTime, 0.01);
  }

  /**
   * Set distortion type
   */
  setType(type: DistortionType): void {
    this.setParameter('type', type);
  }

  /**
   * Get distortion type
   */
  getDistortionType(): DistortionType {
    return Math.round(this.params.type || 0) as DistortionType;
  }

  /**
   * Get distortion type name
   */
  getDistortionTypeName(): string {
    const names = ['Overdrive', 'Fuzz', 'Tube', 'Clip', 'Fold', 'Sine', 'Bitcrush'];
    return names[this.getDistortionType()] || 'Unknown';
  }

  /**
   * Reset effect state
   */
  override reset(): void {
    super.reset();
    this.updateDistortionCurve();
    this.updateTone();
    this.updateGains();
  }

  /**
   * Dispose of resources
   */
  override dispose(): void {
    super.dispose();
    
    if (this.preFilterNode) {
      this.preFilterNode.disconnect();
    }
    
    if (this.postFilterNode) {
      this.postFilterNode.disconnect();
    }
    
    if (this.waveShaperNode) {
      this.waveShaperNode.disconnect();
    }
    
    if (this.preGainNode) {
      this.preGainNode.disconnect();
    }
    
    if (this.postGainNode) {
      this.postGainNode.disconnect();
    }
  }
}

export default Distortion;