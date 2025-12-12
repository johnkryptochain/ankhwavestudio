// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * DynamicsProcessor - Advanced dynamics processing with compressor, expander, and limiter
 * Based on original AnkhWaveStudio dynamics processing
 */

import { BaseEffect, EffectParameterDescriptor } from './BaseEffect';
import { clamp, dBToLinear, linearToDb, calculateRMS, calculatePeak } from '../utils/AudioMath';

/**
 * DynamicsProcessor effect with compressor, gate, and limiter sections
 */
export class DynamicsProcessor extends BaseEffect {
  // Analysis
  private analyser: AnalyserNode;
  private analyserBuffer: Float32Array;
  
  // Sidechain
  private sidechainInput: GainNode;
  private sidechainFilter: BiquadFilterNode;
  private useSidechain: boolean = false;
  
  // Dynamics processing (using DynamicsCompressorNode as base)
  private compressor: DynamicsCompressorNode;
  
  // Additional processing nodes
  private inputGain: GainNode;
  private outputGain: GainNode;
  private limiter: DynamicsCompressorNode;
  
  // Gate (implemented with gain node controlled by envelope)
  private gateGain: GainNode;
  private gateEnvelope: number = 0;
  
  // Metering
  private inputLevel: number = 0;
  private outputLevel: number = 0;
  private gainReduction: number = 0;
  
  // Processing
  private processingInterval: number | null = null;
  private lastProcessTime: number = 0;

  constructor(audioContext: AudioContext, id: string, name: string = 'DynamicsProcessor') {
    super(audioContext, id, name, 'dynamicsprocessor');
    
    // Create analyser for input level
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyserBuffer = new Float32Array(this.analyser.fftSize);
    
    // Create sidechain nodes
    this.sidechainInput = audioContext.createGain();
    this.sidechainFilter = audioContext.createBiquadFilter();
    this.sidechainFilter.type = 'highpass';
    this.sidechainFilter.frequency.value = 100;
    
    // Create gain nodes
    this.inputGain = audioContext.createGain();
    this.outputGain = audioContext.createGain();
    this.gateGain = audioContext.createGain();
    
    // Create compressor
    this.compressor = audioContext.createDynamicsCompressor();
    
    // Create limiter (brick wall)
    this.limiter = audioContext.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.01;
    
    this.initializeEffect();
    this.setupRouting();
    this.startProcessing();
    this.addDefaultPresets();
  }

  protected initializeEffect(): void {
    this.params = {
      // Compressor
      compThreshold: -24,
      compRatio: 4,
      compAttack: 0.003,
      compRelease: 0.25,
      compKnee: 6,
      compEnabled: 1,
      
      // Gate/Expander
      gateThreshold: -60,
      gateRatio: 10,
      gateAttack: 0.001,
      gateRelease: 0.1,
      gateEnabled: 0,
      
      // Limiter
      limiterThreshold: -1,
      limiterEnabled: 1,
      
      // Sidechain
      sidechainEnabled: 0,
      sidechainFilterFreq: 100,
      sidechainFilterType: 0, // 0=HP, 1=LP, 2=BP
      
      // Gain
      inputGain: 0,
      outputGain: 0,
      autoMakeup: 1,
      
      // Lookahead (simulated with delay)
      lookahead: 0
    };
    
    this.applyAllParameters();
  }

  private setupRouting(): void {
    // Input -> Input Gain -> Analyser
    this.inputNode.connect(this.inputGain);
    this.inputGain.connect(this.analyser);
    
    // Input Gain -> Gate -> Compressor -> Limiter -> Output Gain -> Wet
    this.inputGain.connect(this.gateGain);
    this.gateGain.connect(this.compressor);
    this.compressor.connect(this.limiter);
    this.limiter.connect(this.outputGain);
    this.outputGain.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
    
    // Sidechain path
    this.sidechainInput.connect(this.sidechainFilter);
  }

  private applyAllParameters(): void {
    const t = this.audioContext.currentTime;
    
    // Input/Output gain
    this.inputGain.gain.setTargetAtTime(dBToLinear(this.params.inputGain), t, 0.01);
    
    // Calculate makeup gain if auto
    let makeupGain = this.params.outputGain;
    if (this.params.autoMakeup > 0.5 && this.params.compEnabled > 0.5) {
      // Estimate makeup gain based on threshold and ratio
      const thresholdReduction = Math.abs(this.params.compThreshold) * (1 - 1 / this.params.compRatio);
      makeupGain += thresholdReduction * 0.5;
    }
    this.outputGain.gain.setTargetAtTime(dBToLinear(makeupGain), t, 0.01);
    
    // Compressor settings
    if (this.params.compEnabled > 0.5) {
      this.compressor.threshold.setTargetAtTime(this.params.compThreshold, t, 0.01);
      this.compressor.ratio.setTargetAtTime(this.params.compRatio, t, 0.01);
      this.compressor.attack.setTargetAtTime(this.params.compAttack, t, 0.01);
      this.compressor.release.setTargetAtTime(this.params.compRelease, t, 0.01);
      this.compressor.knee.setTargetAtTime(this.params.compKnee, t, 0.01);
    } else {
      // Bypass compressor
      this.compressor.threshold.setTargetAtTime(0, t, 0.01);
      this.compressor.ratio.setTargetAtTime(1, t, 0.01);
    }
    
    // Limiter settings
    if (this.params.limiterEnabled > 0.5) {
      this.limiter.threshold.setTargetAtTime(this.params.limiterThreshold, t, 0.01);
      this.limiter.ratio.setTargetAtTime(20, t, 0.01);
    } else {
      this.limiter.threshold.setTargetAtTime(0, t, 0.01);
      this.limiter.ratio.setTargetAtTime(1, t, 0.01);
    }
    
    // Sidechain filter
    const filterTypes: BiquadFilterType[] = ['highpass', 'lowpass', 'bandpass'];
    this.sidechainFilter.type = filterTypes[Math.floor(this.params.sidechainFilterType)] || 'highpass';
    this.sidechainFilter.frequency.setTargetAtTime(this.params.sidechainFilterFreq, t, 0.01);
  }

  private startProcessing(): void {
    const processGate = () => {
      const now = performance.now();
      const deltaTime = (now - this.lastProcessTime) / 1000;
      this.lastProcessTime = now;
      
      if (deltaTime <= 0 || deltaTime > 1) {
        this.processingInterval = requestAnimationFrame(processGate);
        return;
      }
      
      // Get input level
      this.analyser.getFloatTimeDomainData(this.analyserBuffer as Float32Array<ArrayBuffer>);
      const inputPeak = calculatePeak(this.analyserBuffer);
      this.inputLevel = linearToDb(inputPeak);
      
      // Process gate if enabled
      if (this.params.gateEnabled > 0.5) {
        const gateThresholdLinear = dBToLinear(this.params.gateThreshold);
        
        if (inputPeak > gateThresholdLinear) {
          // Open gate (attack)
          const attackCoeff = 1 - Math.exp(-deltaTime / Math.max(0.001, this.params.gateAttack));
          this.gateEnvelope += (1 - this.gateEnvelope) * attackCoeff;
        } else {
          // Close gate (release)
          const releaseCoeff = 1 - Math.exp(-deltaTime / Math.max(0.001, this.params.gateRelease));
          this.gateEnvelope += (0 - this.gateEnvelope) * releaseCoeff;
        }
        
        this.gateGain.gain.setTargetAtTime(this.gateEnvelope, this.audioContext.currentTime, 0.005);
      } else {
        this.gateEnvelope = 1;
        this.gateGain.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.005);
      }
      
      // Get gain reduction from compressor
      this.gainReduction = this.compressor.reduction;
      
      this.processingInterval = requestAnimationFrame(processGate);
    };
    
    this.lastProcessTime = performance.now();
    this.processingInterval = requestAnimationFrame(processGate);
  }

  private stopProcessing(): void {
    if (this.processingInterval !== null) {
      cancelAnimationFrame(this.processingInterval);
      this.processingInterval = null;
    }
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      // Compressor
      { name: 'Comp Threshold', key: 'compThreshold', min: -60, max: 0, default: -24, unit: 'dB', type: 'linear' },
      { name: 'Comp Ratio', key: 'compRatio', min: 1, max: 20, default: 4, type: 'logarithmic' },
      { name: 'Comp Attack', key: 'compAttack', min: 0.001, max: 1, default: 0.003, unit: 's', type: 'logarithmic' },
      { name: 'Comp Release', key: 'compRelease', min: 0.01, max: 2, default: 0.25, unit: 's', type: 'logarithmic' },
      { name: 'Comp Knee', key: 'compKnee', min: 0, max: 40, default: 6, unit: 'dB', type: 'linear' },
      { name: 'Comp Enabled', key: 'compEnabled', min: 0, max: 1, default: 1, type: 'boolean' },
      
      // Gate
      { name: 'Gate Threshold', key: 'gateThreshold', min: -80, max: 0, default: -60, unit: 'dB', type: 'linear' },
      { name: 'Gate Ratio', key: 'gateRatio', min: 1, max: 100, default: 10, type: 'logarithmic' },
      { name: 'Gate Attack', key: 'gateAttack', min: 0.001, max: 0.5, default: 0.001, unit: 's', type: 'logarithmic' },
      { name: 'Gate Release', key: 'gateRelease', min: 0.01, max: 2, default: 0.1, unit: 's', type: 'logarithmic' },
      { name: 'Gate Enabled', key: 'gateEnabled', min: 0, max: 1, default: 0, type: 'boolean' },
      
      // Limiter
      { name: 'Limiter Threshold', key: 'limiterThreshold', min: -12, max: 0, default: -1, unit: 'dB', type: 'linear' },
      { name: 'Limiter Enabled', key: 'limiterEnabled', min: 0, max: 1, default: 1, type: 'boolean' },
      
      // Sidechain
      { name: 'Sidechain', key: 'sidechainEnabled', min: 0, max: 1, default: 0, type: 'boolean' },
      { name: 'SC Filter Freq', key: 'sidechainFilterFreq', min: 20, max: 20000, default: 100, unit: 'Hz', type: 'logarithmic' },
      { name: 'SC Filter Type', key: 'sidechainFilterType', min: 0, max: 2, default: 0, type: 'enum', enumValues: ['Highpass', 'Lowpass', 'Bandpass'] },
      
      // Gain
      { name: 'Input Gain', key: 'inputGain', min: -24, max: 24, default: 0, unit: 'dB', type: 'linear' },
      { name: 'Output Gain', key: 'outputGain', min: -24, max: 24, default: 0, unit: 'dB', type: 'linear' },
      { name: 'Auto Makeup', key: 'autoMakeup', min: 0, max: 1, default: 1, type: 'boolean' },
      
      // Lookahead
      { name: 'Lookahead', key: 'lookahead', min: 0, max: 20, default: 0, unit: 'ms', type: 'linear' }
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    this.applyAllParameters();
  }

  /**
   * Get current input level in dB
   */
  getInputLevel(): number {
    return this.inputLevel;
  }

  /**
   * Get current gain reduction in dB
   */
  getGainReduction(): number {
    return this.gainReduction;
  }

  /**
   * Get gate envelope (0-1)
   */
  getGateEnvelope(): number {
    return this.gateEnvelope;
  }

  /**
   * Get sidechain input node for external sidechain
   */
  getSidechainInput(): GainNode {
    return this.sidechainInput;
  }

  /**
   * Enable/disable external sidechain
   */
  setSidechainEnabled(enabled: boolean): void {
    this.useSidechain = enabled;
    this.setParameter('sidechainEnabled', enabled ? 1 : 0);
  }

  private addDefaultPresets(): void {
    this.addPreset({
      name: 'Gentle Compression',
      params: {
        compThreshold: -18, compRatio: 2, compAttack: 0.01, compRelease: 0.3,
        compKnee: 10, compEnabled: 1, gateEnabled: 0, limiterEnabled: 1
      }
    });
    
    this.addPreset({
      name: 'Heavy Compression',
      params: {
        compThreshold: -30, compRatio: 8, compAttack: 0.003, compRelease: 0.2,
        compKnee: 3, compEnabled: 1, gateEnabled: 0, limiterEnabled: 1
      }
    });
    
    this.addPreset({
      name: 'Limiting',
      params: {
        compThreshold: -6, compRatio: 20, compAttack: 0.001, compRelease: 0.1,
        compKnee: 0, compEnabled: 1, limiterThreshold: -0.5, limiterEnabled: 1
      }
    });
    
    this.addPreset({
      name: 'Gate + Compression',
      params: {
        compThreshold: -20, compRatio: 4, compAttack: 0.005, compRelease: 0.25,
        gateThreshold: -40, gateAttack: 0.001, gateRelease: 0.1,
        compEnabled: 1, gateEnabled: 1, limiterEnabled: 1
      }
    });
    
    this.addPreset({
      name: 'Vocal',
      params: {
        compThreshold: -24, compRatio: 3, compAttack: 0.01, compRelease: 0.3,
        compKnee: 6, compEnabled: 1, gateThreshold: -50, gateEnabled: 1
      }
    });
    
    this.addPreset({
      name: 'Drums',
      params: {
        compThreshold: -18, compRatio: 4, compAttack: 0.001, compRelease: 0.15,
        compKnee: 3, compEnabled: 1, gateThreshold: -35, gateEnabled: 1
      }
    });
  }

  dispose(): void {
    this.stopProcessing();
    
    super.dispose();
    
    this.analyser.disconnect();
    this.sidechainInput.disconnect();
    this.sidechainFilter.disconnect();
    this.inputGain.disconnect();
    this.outputGain.disconnect();
    this.gateGain.disconnect();
    this.compressor.disconnect();
    this.limiter.disconnect();
  }
}