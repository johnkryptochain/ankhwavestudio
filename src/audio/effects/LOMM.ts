// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * LOMM - Loudness Maximizer
 * Multi-band loudness maximizer for mastering
 * 
 * Features:
 * - Multi-band processing
 * - Input gain
 * - Output ceiling
 * - Release time
 * - Lookahead
 */

import { BaseEffect, type EffectParameterDescriptor } from './BaseEffect';
import { clamp } from '../utils/AudioMath';

// ============================================================================
// LOMM Effect
// ============================================================================

export class LOMM extends BaseEffect {
  // Parameters
  private inputGain: number = 0; // dB
  private outputCeiling: number = -0.3; // dB
  private releaseTime: number = 100; // ms
  private lookahead: number = 5; // ms
  private depth: number = 0; // dB of gain reduction
  
  // Audio nodes
  private inputGainNode: GainNode;
  private lookaheadDelay: DelayNode;
  private limiterNode: DynamicsCompressorNode;
  private outputGainNode: GainNode;
  private makeupGainNode: GainNode;
  
  // Multi-band processing
  private lowBandFilter: BiquadFilterNode;
  private midBandFilterLow: BiquadFilterNode;
  private midBandFilterHigh: BiquadFilterNode;
  private highBandFilter: BiquadFilterNode;
  
  private lowBandCompressor: DynamicsCompressorNode;
  private midBandCompressor: DynamicsCompressorNode;
  private highBandCompressor: DynamicsCompressorNode;
  
  private lowBandGain: GainNode;
  private midBandGain: GainNode;
  private highBandGain: GainNode;
  
  // Crossover frequencies
  private lowCrossover: number = 200;
  private highCrossover: number = 3000;
  
  // Metering
  private analyser: AnalyserNode;
  private meterData: Float32Array<ArrayBuffer>;
  private currentGainReduction: number = 0;
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'LOMM', 'lomm');
    
    // Create input gain
    this.inputGainNode = audioContext.createGain();
    this.inputGainNode.gain.value = 1;
    
    // Create lookahead delay
    this.lookaheadDelay = audioContext.createDelay(0.1);
    this.lookaheadDelay.delayTime.value = this.lookahead / 1000;
    
    // Create crossover filters
    this.lowBandFilter = audioContext.createBiquadFilter();
    this.lowBandFilter.type = 'lowpass';
    this.lowBandFilter.frequency.value = this.lowCrossover;
    this.lowBandFilter.Q.value = 0.707;
    
    this.midBandFilterLow = audioContext.createBiquadFilter();
    this.midBandFilterLow.type = 'highpass';
    this.midBandFilterLow.frequency.value = this.lowCrossover;
    this.midBandFilterLow.Q.value = 0.707;
    
    this.midBandFilterHigh = audioContext.createBiquadFilter();
    this.midBandFilterHigh.type = 'lowpass';
    this.midBandFilterHigh.frequency.value = this.highCrossover;
    this.midBandFilterHigh.Q.value = 0.707;
    
    this.highBandFilter = audioContext.createBiquadFilter();
    this.highBandFilter.type = 'highpass';
    this.highBandFilter.frequency.value = this.highCrossover;
    this.highBandFilter.Q.value = 0.707;
    
    // Create band compressors
    this.lowBandCompressor = this.createBandCompressor();
    this.midBandCompressor = this.createBandCompressor();
    this.highBandCompressor = this.createBandCompressor();
    
    // Create band gains
    this.lowBandGain = audioContext.createGain();
    this.lowBandGain.gain.value = 1;
    
    this.midBandGain = audioContext.createGain();
    this.midBandGain.gain.value = 1;
    
    this.highBandGain = audioContext.createGain();
    this.highBandGain.gain.value = 1;
    
    // Create main limiter
    this.limiterNode = audioContext.createDynamicsCompressor();
    this.limiterNode.threshold.value = this.outputCeiling;
    this.limiterNode.knee.value = 0;
    this.limiterNode.ratio.value = 20;
    this.limiterNode.attack.value = 0.001;
    this.limiterNode.release.value = this.releaseTime / 1000;
    
    // Create makeup gain
    this.makeupGainNode = audioContext.createGain();
    this.makeupGainNode.gain.value = 1;
    
    // Create output gain
    this.outputGainNode = audioContext.createGain();
    this.outputGainNode.gain.value = Math.pow(10, this.outputCeiling / 20);
    
    // Create analyser for metering
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.meterData = new Float32Array(this.analyser.frequencyBinCount);
    
    // Connect signal path
    this.connectSignalPath();
    
    // Initialize
    this.initializeEffect();
  }
  
  /**
   * Create a band compressor
   */
  private createBandCompressor(): DynamicsCompressorNode {
    const compressor = this.audioContext.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 6;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.1;
    return compressor;
  }
  
  /**
   * Connect signal path
   */
  private connectSignalPath(): void {
    // Input -> Input Gain -> Lookahead Delay
    this.inputNode.connect(this.inputGainNode);
    this.inputGainNode.connect(this.lookaheadDelay);
    
    // Split into bands
    this.lookaheadDelay.connect(this.lowBandFilter);
    this.lookaheadDelay.connect(this.midBandFilterLow);
    this.lookaheadDelay.connect(this.highBandFilter);
    
    // Mid band needs both filters
    this.midBandFilterLow.connect(this.midBandFilterHigh);
    
    // Band processing
    this.lowBandFilter.connect(this.lowBandCompressor);
    this.midBandFilterHigh.connect(this.midBandCompressor);
    this.highBandFilter.connect(this.highBandCompressor);
    
    // Band gains
    this.lowBandCompressor.connect(this.lowBandGain);
    this.midBandCompressor.connect(this.midBandGain);
    this.highBandCompressor.connect(this.highBandGain);
    
    // Sum bands
    this.lowBandGain.connect(this.makeupGainNode);
    this.midBandGain.connect(this.makeupGainNode);
    this.highBandGain.connect(this.makeupGainNode);
    
    // Final limiting
    this.makeupGainNode.connect(this.limiterNode);
    this.limiterNode.connect(this.outputGainNode);
    
    // Output
    this.outputGainNode.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
    
    // Metering
    this.limiterNode.connect(this.analyser);
  }
  
  /**
   * Update input gain
   */
  private updateInputGain(): void {
    const currentTime = this.audioContext.currentTime;
    const linearGain = Math.pow(10, this.inputGain / 20);
    this.inputGainNode.gain.setTargetAtTime(linearGain, currentTime, 0.02);
  }
  
  /**
   * Update output ceiling
   */
  private updateOutputCeiling(): void {
    const currentTime = this.audioContext.currentTime;
    this.limiterNode.threshold.setTargetAtTime(this.outputCeiling, currentTime, 0.02);
    
    // Adjust output gain to match ceiling
    const linearGain = Math.pow(10, this.outputCeiling / 20);
    this.outputGainNode.gain.setTargetAtTime(linearGain, currentTime, 0.02);
  }
  
  /**
   * Update release time
   */
  private updateReleaseTime(): void {
    const currentTime = this.audioContext.currentTime;
    const releaseSeconds = this.releaseTime / 1000;
    this.limiterNode.release.setTargetAtTime(releaseSeconds, currentTime, 0.02);
    
    // Update band compressors too
    this.lowBandCompressor.release.setTargetAtTime(releaseSeconds * 1.5, currentTime, 0.02);
    this.midBandCompressor.release.setTargetAtTime(releaseSeconds, currentTime, 0.02);
    this.highBandCompressor.release.setTargetAtTime(releaseSeconds * 0.7, currentTime, 0.02);
  }
  
  /**
   * Update lookahead
   */
  private updateLookahead(): void {
    const currentTime = this.audioContext.currentTime;
    this.lookaheadDelay.delayTime.setTargetAtTime(this.lookahead / 1000, currentTime, 0.02);
  }
  
  /**
   * Update depth (compression amount)
   */
  private updateDepth(): void {
    const currentTime = this.audioContext.currentTime;
    
    // Depth controls the threshold of band compressors
    const threshold = -20 - this.depth;
    this.lowBandCompressor.threshold.setTargetAtTime(threshold, currentTime, 0.02);
    this.midBandCompressor.threshold.setTargetAtTime(threshold, currentTime, 0.02);
    this.highBandCompressor.threshold.setTargetAtTime(threshold, currentTime, 0.02);
    
    // Makeup gain to compensate
    const makeupGain = Math.pow(10, (this.depth * 0.5) / 20);
    this.makeupGainNode.gain.setTargetAtTime(makeupGain, currentTime, 0.02);
  }
  
  /**
   * Get current gain reduction in dB
   */
  getGainReduction(): number {
    return this.limiterNode.reduction;
  }
  
  /**
   * Get current output level in dB
   */
  getOutputLevel(): number {
    this.analyser.getFloatTimeDomainData(this.meterData);
    
    let sum = 0;
    for (let i = 0; i < this.meterData.length; i++) {
      sum += this.meterData[i] * this.meterData[i];
    }
    const rms = Math.sqrt(sum / this.meterData.length);
    
    return 20 * Math.log10(rms + 0.0001);
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    switch (key) {
      case 'inputGain':
        this.inputGain = value;
        this.updateInputGain();
        break;
      case 'outputCeiling':
        this.outputCeiling = value;
        this.updateOutputCeiling();
        break;
      case 'releaseTime':
        this.releaseTime = value;
        this.updateReleaseTime();
        break;
      case 'lookahead':
        this.lookahead = value;
        this.updateLookahead();
        break;
      case 'depth':
        this.depth = value;
        this.updateDepth();
        break;
    }
  }
  
  /**
   * Initialize effect
   */
  protected initializeEffect(): void {
    this.params['inputGain'] = this.inputGain;
    this.params['outputCeiling'] = this.outputCeiling;
    this.params['releaseTime'] = this.releaseTime;
    this.params['lookahead'] = this.lookahead;
    this.params['depth'] = this.depth;
    
    this.updateInputGain();
    this.updateOutputCeiling();
    this.updateReleaseTime();
    this.updateLookahead();
    this.updateDepth();
    
    // Add presets
    this.addPresets();
  }
  
  /**
   * Add presets
   */
  private addPresets(): void {
    this.presets.push({
      name: 'Gentle',
      params: { inputGain: 0, outputCeiling: -0.3, releaseTime: 200, lookahead: 5, depth: 3 }
    });
    
    this.presets.push({
      name: 'Moderate',
      params: { inputGain: 3, outputCeiling: -0.3, releaseTime: 100, lookahead: 5, depth: 6 }
    });
    
    this.presets.push({
      name: 'Aggressive',
      params: { inputGain: 6, outputCeiling: -0.1, releaseTime: 50, lookahead: 3, depth: 10 }
    });
    
    this.presets.push({
      name: 'Broadcast',
      params: { inputGain: 0, outputCeiling: -1, releaseTime: 150, lookahead: 5, depth: 8 }
    });
    
    this.presets.push({
      name: 'Streaming',
      params: { inputGain: 0, outputCeiling: -1.5, releaseTime: 100, lookahead: 5, depth: 5 }
    });
    
    this.presets.push({
      name: 'Mastering',
      params: { inputGain: 0, outputCeiling: -0.3, releaseTime: 100, lookahead: 5, depth: 4 }
    });
  }
  
  /**
   * Get parameter descriptors
   */
  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'Input Gain', key: 'inputGain', min: -12, max: 24, default: 0, unit: 'dB' },
      { name: 'Output Ceiling', key: 'outputCeiling', min: -6, max: 0, default: -0.3, unit: 'dB' },
      { name: 'Release Time', key: 'releaseTime', min: 10, max: 500, default: 100, unit: 'ms' },
      { name: 'Lookahead', key: 'lookahead', min: 0, max: 20, default: 5, unit: 'ms' },
      { name: 'Depth', key: 'depth', min: 0, max: 20, default: 0, unit: 'dB' }
    ];
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    this.inputGainNode.disconnect();
    this.lookaheadDelay.disconnect();
    this.lowBandFilter.disconnect();
    this.midBandFilterLow.disconnect();
    this.midBandFilterHigh.disconnect();
    this.highBandFilter.disconnect();
    this.lowBandCompressor.disconnect();
    this.midBandCompressor.disconnect();
    this.highBandCompressor.disconnect();
    this.lowBandGain.disconnect();
    this.midBandGain.disconnect();
    this.highBandGain.disconnect();
    this.limiterNode.disconnect();
    this.makeupGainNode.disconnect();
    this.outputGainNode.disconnect();
    this.analyser.disconnect();
    
    super.dispose();
  }
}

// Factory function
export function createLOMM(audioContext: AudioContext, id?: string): LOMM {
  return new LOMM(audioContext, id || `lomm-${Date.now()}`);
}