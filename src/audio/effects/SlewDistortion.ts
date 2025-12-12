// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * SlewDistortion - Slew Rate Limiting Distortion
 * Creates distortion by limiting the rate of change of the signal
 * 
 * Features:
 * - Rise rate limiting
 * - Fall rate limiting
 * - Input gain
 * - Output gain
 */

import { BaseEffect, type EffectParameterDescriptor } from './BaseEffect';
import { clamp } from '../utils/AudioMath';

// ============================================================================
// SlewDistortion Effect
// ============================================================================

export class SlewDistortion extends BaseEffect {
  // Parameters
  private riseRate: number = 0.5;
  private fallRate: number = 0.5;
  private inputGain: number = 1;
  private outputGain: number = 1;
  
  // Audio nodes
  private inputGainNode: GainNode;
  private outputGainNode: GainNode;
  private waveShaperNode: WaveShaperNode;
  
  // Worklet node (if available)
  private workletNode: AudioWorkletNode | null = null;
  
  // ScriptProcessor fallback
  private scriptProcessor: ScriptProcessorNode | null = null;
  private lastSample: number = 0;
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'SlewDistortion', 'slewdistortion');
    
    // Create input gain
    this.inputGainNode = audioContext.createGain();
    this.inputGainNode.gain.value = this.inputGain;
    
    // Create output gain
    this.outputGainNode = audioContext.createGain();
    this.outputGainNode.gain.value = this.outputGain;
    
    // Create waveshaper for additional saturation
    this.waveShaperNode = audioContext.createWaveShaper();
    this.waveShaperNode.curve = this.createSaturationCurve();
    this.waveShaperNode.oversample = '2x';
    
    // Create slew rate limiter using ScriptProcessor
    // (AudioWorklet would be better but requires separate file)
    this.createSlewProcessor();
    
    // Connect signal path
    this.inputNode.connect(this.inputGainNode);
    
    if (this.scriptProcessor) {
      this.inputGainNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.waveShaperNode);
    } else {
      this.inputGainNode.connect(this.waveShaperNode);
    }
    
    this.waveShaperNode.connect(this.outputGainNode);
    this.outputGainNode.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
    
    // Initialize
    this.initializeEffect();
  }
  
  /**
   * Create slew rate processor
   */
  private createSlewProcessor(): void {
    // Use ScriptProcessorNode (deprecated but widely supported)
    const bufferSize = 256;
    this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
    
    let lastSampleLeft = 0;
    let lastSampleRight = 0;
    
    this.scriptProcessor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer;
      const outputBuffer = event.outputBuffer;
      
      for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
        const inputData = inputBuffer.getChannelData(channel);
        const outputData = outputBuffer.getChannelData(channel);
        
        let lastSample = channel === 0 ? lastSampleLeft : lastSampleRight;
        
        // Calculate max change per sample based on slew rates
        const maxRise = this.riseRate;
        const maxFall = this.fallRate;
        
        for (let i = 0; i < inputData.length; i++) {
          const input = inputData[i];
          const diff = input - lastSample;
          
          let output: number;
          if (diff > 0) {
            // Rising edge
            output = lastSample + Math.min(diff, maxRise);
          } else {
            // Falling edge
            output = lastSample + Math.max(diff, -maxFall);
          }
          
          outputData[i] = output;
          lastSample = output;
        }
        
        if (channel === 0) {
          lastSampleLeft = lastSample;
        } else {
          lastSampleRight = lastSample;
        }
      }
    };
  }
  
  /**
   * Create saturation curve for waveshaper
   */
  private createSaturationCurve(): Float32Array<ArrayBuffer> {
    const samples = 8192;
    const curve = new Float32Array(samples) as Float32Array<ArrayBuffer>;
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Soft clipping using tanh
      curve[i] = Math.tanh(x * 1.5);
    }
    
    return curve;
  }
  
  /**
   * Update input gain
   */
  private updateInputGain(): void {
    const currentTime = this.audioContext.currentTime;
    this.inputGainNode.gain.setTargetAtTime(this.inputGain, currentTime, 0.02);
  }
  
  /**
   * Update output gain
   */
  private updateOutputGain(): void {
    const currentTime = this.audioContext.currentTime;
    this.outputGainNode.gain.setTargetAtTime(this.outputGain, currentTime, 0.02);
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    switch (key) {
      case 'riseRate':
        this.riseRate = value;
        break;
      case 'fallRate':
        this.fallRate = value;
        break;
      case 'inputGain':
        this.inputGain = value;
        this.updateInputGain();
        break;
      case 'outputGain':
        this.outputGain = value;
        this.updateOutputGain();
        break;
    }
  }
  
  /**
   * Initialize effect
   */
  protected initializeEffect(): void {
    this.params['riseRate'] = this.riseRate;
    this.params['fallRate'] = this.fallRate;
    this.params['inputGain'] = this.inputGain;
    this.params['outputGain'] = this.outputGain;
    
    this.updateInputGain();
    this.updateOutputGain();
    
    // Add presets
    this.addPresets();
  }
  
  /**
   * Add presets
   */
  private addPresets(): void {
    this.presets.push({
      name: 'Subtle',
      params: { riseRate: 0.8, fallRate: 0.8, inputGain: 1, outputGain: 1 }
    });
    
    this.presets.push({
      name: 'Warm',
      params: { riseRate: 0.5, fallRate: 0.6, inputGain: 1.2, outputGain: 0.9 }
    });
    
    this.presets.push({
      name: 'Aggressive',
      params: { riseRate: 0.2, fallRate: 0.2, inputGain: 1.5, outputGain: 0.7 }
    });
    
    this.presets.push({
      name: 'Asymmetric',
      params: { riseRate: 0.3, fallRate: 0.7, inputGain: 1.3, outputGain: 0.8 }
    });
    
    this.presets.push({
      name: 'Lo-Fi',
      params: { riseRate: 0.1, fallRate: 0.1, inputGain: 2, outputGain: 0.5 }
    });
    
    this.presets.push({
      name: 'Tape Saturation',
      params: { riseRate: 0.6, fallRate: 0.5, inputGain: 1.4, outputGain: 0.85 }
    });
  }
  
  /**
   * Get parameter descriptors
   */
  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'Rise Rate', key: 'riseRate', min: 0.01, max: 1, default: 0.5 },
      { name: 'Fall Rate', key: 'fallRate', min: 0.01, max: 1, default: 0.5 },
      { name: 'Input Gain', key: 'inputGain', min: 0.1, max: 4, default: 1 },
      { name: 'Output Gain', key: 'outputGain', min: 0.1, max: 2, default: 1 }
    ];
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    this.inputGainNode.disconnect();
    this.outputGainNode.disconnect();
    this.waveShaperNode.disconnect();
    
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor.onaudioprocess = null;
    }
    
    if (this.workletNode) {
      this.workletNode.disconnect();
    }
    
    super.dispose();
  }
}

// Factory function
export function createSlewDistortion(audioContext: AudioContext, id?: string): SlewDistortion {
  return new SlewDistortion(audioContext, id || `slewdistortion-${Date.now()}`);
}