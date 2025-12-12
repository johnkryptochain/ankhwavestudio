// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Compressor - Dynamic range compressor effect
 * Uses Web Audio DynamicsCompressorNode with additional features
 * 
 * Features:
 * - Threshold, Ratio, Attack, Release, Knee controls
 * - Makeup gain
 * - Mix control for parallel compression
 * - Input/output metering
 * - Gain reduction metering
 * - Auto makeup gain option
 */

import { BaseEffect, EffectParameterDescriptor, EffectPreset } from './BaseEffect';
import { clamp, dBToLinear, linearToDb } from '../utils/AudioMath';

/**
 * Compressor metering data
 */
export interface CompressorMeteringData {
  inputLevel: number;      // Input level in dB
  outputLevel: number;     // Output level in dB
  gainReduction: number;   // Gain reduction in dB (negative value)
}

/**
 * Compressor effect with metering
 */
export class Compressor extends BaseEffect {
  private compressorNode: DynamicsCompressorNode;
  private makeupGainNode: GainNode;
  private inputAnalyser: AnalyserNode;
  private outputAnalyser: AnalyserNode;
  
  // Mix (parallel compression) nodes
  private mixDryGain: GainNode;
  private mixWetGain: GainNode;
  private mixMerger: GainNode;
  
  // Metering
  private inputBuffer: Float32Array<ArrayBuffer>;
  private outputBuffer: Float32Array<ArrayBuffer>;
  private meteringCallback: ((data: CompressorMeteringData) => void) | null = null;
  private meteringInterval: number | null = null;
  
  // Auto makeup gain
  private autoMakeupEnabled: boolean = false;

  constructor(audioContext: AudioContext, id: string, name: string = 'Compressor') {
    super(audioContext, id, name, 'compressor');
    
    // Create compressor node
    this.compressorNode = audioContext.createDynamicsCompressor();
    
    // Create makeup gain node
    this.makeupGainNode = audioContext.createGain();
    this.makeupGainNode.gain.value = 1.0;
    
    // Create mix (parallel compression) nodes
    this.mixDryGain = audioContext.createGain();
    this.mixDryGain.gain.value = 0; // Start with 100% wet
    this.mixWetGain = audioContext.createGain();
    this.mixWetGain.gain.value = 1.0;
    this.mixMerger = audioContext.createGain();
    this.mixMerger.gain.value = 1.0;
    
    // Create analysers for metering
    this.inputAnalyser = audioContext.createAnalyser();
    this.inputAnalyser.fftSize = 256;
    this.inputAnalyser.smoothingTimeConstant = 0.8;
    
    this.outputAnalyser = audioContext.createAnalyser();
    this.outputAnalyser.fftSize = 256;
    this.outputAnalyser.smoothingTimeConstant = 0.8;
    
    // Create buffers for metering
    this.inputBuffer = new Float32Array(this.inputAnalyser.fftSize) as Float32Array<ArrayBuffer>;
    this.outputBuffer = new Float32Array(this.outputAnalyser.fftSize) as Float32Array<ArrayBuffer>;
    
    this.initializeEffect();
    this.setupRouting();
    this.addDefaultPresets();
  }

  protected initializeEffect(): void {
    // Initialize default parameters
    this.params = {
      threshold: -24,    // dB (-60 to 0)
      ratio: 4,          // 1:1 to 20:1
      attack: 0.003,     // seconds (0.001-1)
      release: 0.25,     // seconds (0.01-3)
      knee: 6,           // dB (0-40)
      makeupGain: 0,     // dB (0-40)
      autoMakeup: 0,     // boolean (0 or 1)
      mix: 100,          // 0-100% (dry/wet for parallel compression)
    };
    
    // Apply initial parameters
    this.applyThreshold();
    this.applyRatio();
    this.applyAttack();
    this.applyRelease();
    this.applyKnee();
    this.applyMakeupGain();
    this.applyMix();
  }

  private setupRouting(): void {
    // Input -> Input Analyser -> [Compressor -> Makeup Gain -> Mix Wet] + [Mix Dry] -> Mix Merger -> Output Analyser -> Wet Gain -> Output
    this.inputNode.connect(this.inputAnalyser);
    
    // Wet path (compressed signal)
    this.inputAnalyser.connect(this.compressorNode);
    this.compressorNode.connect(this.makeupGainNode);
    this.makeupGainNode.connect(this.mixWetGain);
    this.mixWetGain.connect(this.mixMerger);
    
    // Dry path (uncompressed signal for parallel compression)
    this.inputAnalyser.connect(this.mixDryGain);
    this.mixDryGain.connect(this.mixMerger);
    
    // Output path
    this.mixMerger.connect(this.outputAnalyser);
    this.outputAnalyser.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      {
        name: 'Threshold',
        key: 'threshold',
        min: -60,
        max: 0,
        default: -24,
        unit: 'dB',
        type: 'linear',
      },
      {
        name: 'Ratio',
        key: 'ratio',
        min: 1,
        max: 20,
        default: 4,
        unit: ':1',
        type: 'logarithmic',
      },
      {
        name: 'Attack',
        key: 'attack',
        min: 0.001,
        max: 1,
        default: 0.003,
        step: 0.001,
        unit: 's',
        type: 'logarithmic',
      },
      {
        name: 'Release',
        key: 'release',
        min: 0.01,
        max: 3,
        default: 0.25,
        step: 0.01,
        unit: 's',
        type: 'logarithmic',
      },
      {
        name: 'Knee',
        key: 'knee',
        min: 0,
        max: 40,
        default: 6,
        unit: 'dB',
        type: 'linear',
      },
      {
        name: 'Makeup Gain',
        key: 'makeupGain',
        min: 0,
        max: 40,
        default: 0,
        unit: 'dB',
        type: 'linear',
      },
      {
        name: 'Auto Makeup',
        key: 'autoMakeup',
        min: 0,
        max: 1,
        default: 0,
        type: 'boolean',
      },
      {
        name: 'Mix',
        key: 'mix',
        min: 0,
        max: 100,
        default: 100,
        unit: '%',
        type: 'linear',
      },
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    switch (key) {
      case 'threshold':
        this.applyThreshold();
        if (this.autoMakeupEnabled) {
          this.calculateAutoMakeup();
        }
        break;
      case 'ratio':
        this.applyRatio();
        if (this.autoMakeupEnabled) {
          this.calculateAutoMakeup();
        }
        break;
      case 'attack':
        this.applyAttack();
        break;
      case 'release':
        this.applyRelease();
        break;
      case 'knee':
        this.applyKnee();
        break;
      case 'makeupGain':
        this.applyMakeupGain();
        break;
      case 'autoMakeup':
        this.autoMakeupEnabled = value > 0.5;
        if (this.autoMakeupEnabled) {
          this.calculateAutoMakeup();
        }
        break;
      case 'mix':
        this.applyMix();
        break;
    }
  }

  private applyThreshold(): void {
    const threshold = clamp(this.params.threshold, -60, 0);
    this.compressorNode.threshold.setTargetAtTime(
      threshold,
      this.audioContext.currentTime,
      0.01
    );
  }

  private applyRatio(): void {
    const ratio = clamp(this.params.ratio, 1, 20);
    this.compressorNode.ratio.setTargetAtTime(
      ratio,
      this.audioContext.currentTime,
      0.01
    );
  }

  private applyAttack(): void {
    const attack = clamp(this.params.attack, 0.001, 1);
    this.compressorNode.attack.setTargetAtTime(
      attack,
      this.audioContext.currentTime,
      0.01
    );
  }

  private applyRelease(): void {
    const release = clamp(this.params.release, 0.01, 3);
    this.compressorNode.release.setTargetAtTime(
      release,
      this.audioContext.currentTime,
      0.01
    );
  }

  private applyKnee(): void {
    const knee = clamp(this.params.knee, 0, 40);
    this.compressorNode.knee.setTargetAtTime(
      knee,
      this.audioContext.currentTime,
      0.01
    );
  }

  private applyMakeupGain(): void {
    if (this.autoMakeupEnabled) return;
    
    const makeupGain = clamp(this.params.makeupGain, 0, 40);
    const linearGain = dBToLinear(makeupGain);
    this.makeupGainNode.gain.setTargetAtTime(
      linearGain,
      this.audioContext.currentTime,
      0.01
    );
  }

  /**
   * Apply mix (parallel compression) setting
   */
  private applyMix(): void {
    const mix = clamp(this.params.mix, 0, 100) / 100;
    const t = this.audioContext.currentTime;
    
    // Equal power crossfade for smooth mixing
    const wetGain = Math.cos((1 - mix) * Math.PI / 2);
    const dryGain = Math.cos(mix * Math.PI / 2);
    
    this.mixWetGain.gain.setTargetAtTime(wetGain, t, 0.01);
    this.mixDryGain.gain.setTargetAtTime(dryGain, t, 0.01);
  }

  /**
   * Calculate and apply auto makeup gain based on threshold and ratio
   */
  private calculateAutoMakeup(): void {
    // Estimate makeup gain based on threshold and ratio
    // This is a simplified calculation - real compressors use more complex algorithms
    const threshold = this.params.threshold;
    const ratio = this.params.ratio;
    
    // Estimate average gain reduction at -12dB input
    const inputLevel = -12;
    let gainReduction = 0;
    
    if (inputLevel > threshold) {
      const excess = inputLevel - threshold;
      gainReduction = excess - (excess / ratio);
    }
    
    // Apply makeup gain to compensate
    const makeupGain = gainReduction * 0.7; // 70% compensation
    const linearGain = dBToLinear(makeupGain);
    
    this.makeupGainNode.gain.setTargetAtTime(
      linearGain,
      this.audioContext.currentTime,
      0.01
    );
  }

  /**
   * Get current gain reduction in dB
   */
  getGainReduction(): number {
    return this.compressorNode.reduction;
  }

  /**
   * Get current metering data
   */
  getMeteringData(): CompressorMeteringData {
    // Get input level
    this.inputAnalyser.getFloatTimeDomainData(this.inputBuffer);
    let inputSum = 0;
    for (let i = 0; i < this.inputBuffer.length; i++) {
      inputSum += this.inputBuffer[i] * this.inputBuffer[i];
    }
    const inputRms = Math.sqrt(inputSum / this.inputBuffer.length);
    const inputLevel = inputRms > 0 ? linearToDb(inputRms) : -100;
    
    // Get output level
    this.outputAnalyser.getFloatTimeDomainData(this.outputBuffer);
    let outputSum = 0;
    for (let i = 0; i < this.outputBuffer.length; i++) {
      outputSum += this.outputBuffer[i] * this.outputBuffer[i];
    }
    const outputRms = Math.sqrt(outputSum / this.outputBuffer.length);
    const outputLevel = outputRms > 0 ? linearToDb(outputRms) : -100;
    
    return {
      inputLevel: clamp(inputLevel, -100, 0),
      outputLevel: clamp(outputLevel, -100, 0),
      gainReduction: this.compressorNode.reduction,
    };
  }

  /**
   * Start metering updates
   */
  startMetering(callback: (data: CompressorMeteringData) => void, intervalMs: number = 50): void {
    this.stopMetering();
    this.meteringCallback = callback;
    
    this.meteringInterval = window.setInterval(() => {
      if (this.meteringCallback) {
        this.meteringCallback(this.getMeteringData());
      }
    }, intervalMs);
  }

  /**
   * Stop metering updates
   */
  stopMetering(): void {
    if (this.meteringInterval !== null) {
      clearInterval(this.meteringInterval);
      this.meteringInterval = null;
    }
    this.meteringCallback = null;
  }

  private addDefaultPresets(): void {
    const presets: EffectPreset[] = [
      {
        name: 'Gentle',
        params: {
          threshold: -20,
          ratio: 2,
          attack: 0.01,
          release: 0.2,
          knee: 10,
          makeupGain: 2,
          mix: 100,
        },
      },
      {
        name: 'Vocal',
        params: {
          threshold: -18,
          ratio: 3,
          attack: 0.005,
          release: 0.15,
          knee: 6,
          makeupGain: 4,
          mix: 100,
        },
      },
      {
        name: 'Drums',
        params: {
          threshold: -24,
          ratio: 4,
          attack: 0.001,
          release: 0.1,
          knee: 3,
          makeupGain: 6,
          mix: 100,
        },
      },
      {
        name: 'Bass',
        params: {
          threshold: -20,
          ratio: 4,
          attack: 0.02,
          release: 0.3,
          knee: 6,
          makeupGain: 4,
          mix: 100,
        },
      },
      {
        name: 'Master Bus',
        params: {
          threshold: -12,
          ratio: 2,
          attack: 0.03,
          release: 0.3,
          knee: 12,
          makeupGain: 2,
          mix: 100,
        },
      },
      {
        name: 'Limiter',
        params: {
          threshold: -6,
          ratio: 20,
          attack: 0.001,
          release: 0.05,
          knee: 0,
          makeupGain: 6,
          mix: 100,
        },
      },
      {
        name: 'Parallel Crush',
        params: {
          threshold: -30,
          ratio: 10,
          attack: 0.001,
          release: 0.05,
          knee: 0,
          makeupGain: 12,
          mix: 50, // 50% mix for parallel compression
        },
      },
      {
        name: 'NY Compression',
        params: {
          threshold: -24,
          ratio: 8,
          attack: 0.005,
          release: 0.1,
          knee: 0,
          makeupGain: 10,
          mix: 40, // Classic NY compression mix
        },
      },
      {
        name: 'Transparent',
        params: {
          threshold: -24,
          ratio: 2,
          attack: 0.02,
          release: 0.4,
          knee: 20,
          makeupGain: 3,
          mix: 100,
        },
      },
    ];

    for (const preset of presets) {
      this.addPreset(preset);
    }
  }

  dispose(): void {
    this.stopMetering();
    super.dispose();
    
    this.compressorNode.disconnect();
    this.makeupGainNode.disconnect();
    this.mixDryGain.disconnect();
    this.mixWetGain.disconnect();
    this.mixMerger.disconnect();
    this.inputAnalyser.disconnect();
    this.outputAnalyser.disconnect();
  }
}
