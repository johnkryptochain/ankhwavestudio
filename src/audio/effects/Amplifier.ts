// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Amplifier - Simple gain/pan/phase effect
 * Based on original AnkhWaveStudio Amplifier plugin
 */

import { BaseEffect, EffectParameterDescriptor } from './BaseEffect';
import { clamp, dBToLinear, linearToDb, calculatePeak, calculateRMS } from '../utils/AudioMath';

/**
 * Amplifier effect with input/output gain, pan, and phase invert
 */
export class Amplifier extends BaseEffect {
  // Gain nodes
  private inputGainNode: GainNode;
  private outputGainNode: GainNode;
  private panNode: StereoPannerNode;
  
  // Channel processing
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  private leftGain: GainNode;
  private rightGain: GainNode;
  private leftPhaseInvert: GainNode;
  private rightPhaseInvert: GainNode;
  
  // Metering
  private analyserL: AnalyserNode;
  private analyserR: AnalyserNode;
  private meterBufferL: Float32Array;
  private meterBufferR: Float32Array;
  
  // Clipping detection
  private clippedL: boolean = false;
  private clippedR: boolean = false;
  private clipHoldTime: number = 1000; // ms
  private lastClipTimeL: number = 0;
  private lastClipTimeR: number = 0;

  constructor(audioContext: AudioContext, id: string, name: string = 'Amplifier') {
    super(audioContext, id, name, 'amplifier');
    
    // Create gain nodes
    this.inputGainNode = audioContext.createGain();
    this.outputGainNode = audioContext.createGain();
    this.panNode = audioContext.createStereoPanner();
    
    // Create channel processing nodes
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    this.leftGain = audioContext.createGain();
    this.rightGain = audioContext.createGain();
    this.leftPhaseInvert = audioContext.createGain();
    this.rightPhaseInvert = audioContext.createGain();
    
    // Create analysers for metering
    this.analyserL = audioContext.createAnalyser();
    this.analyserL.fftSize = 256;
    this.analyserR = audioContext.createAnalyser();
    this.analyserR.fftSize = 256;
    
    this.meterBufferL = new Float32Array(this.analyserL.fftSize);
    this.meterBufferR = new Float32Array(this.analyserR.fftSize);
    
    this.initializeEffect();
    this.setupRouting();
    this.addDefaultPresets();
  }

  protected initializeEffect(): void {
    this.params = {
      inputGain: 0,      // dB
      outputGain: 0,     // dB
      pan: 0,            // -1 to 1
      leftRight: 0,      // Balance: -1 = left only, 1 = right only
      phaseInvertL: 0,   // 0 or 1
      phaseInvertR: 0    // 0 or 1
    };
    
    this.applyAllParameters();
  }

  private setupRouting(): void {
    // Input -> Input Gain -> Splitter
    this.inputNode.connect(this.inputGainNode);
    this.inputGainNode.connect(this.splitter);
    
    // Split to left and right channels
    this.splitter.connect(this.leftGain, 0);
    this.splitter.connect(this.rightGain, 1);
    
    // Apply phase inversion
    this.leftGain.connect(this.leftPhaseInvert);
    this.rightGain.connect(this.rightPhaseInvert);
    
    // Merge back to stereo
    this.leftPhaseInvert.connect(this.merger, 0, 0);
    this.rightPhaseInvert.connect(this.merger, 0, 1);
    
    // Merger -> Pan -> Output Gain -> Wet
    this.merger.connect(this.panNode);
    this.panNode.connect(this.outputGainNode);
    this.outputGainNode.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
    
    // Connect analysers for metering (after output gain)
    this.outputGainNode.connect(this.splitter);
    // Re-split for metering
    const meterSplitter = this.audioContext.createChannelSplitter(2);
    this.outputGainNode.connect(meterSplitter);
    meterSplitter.connect(this.analyserL, 0);
    meterSplitter.connect(this.analyserR, 1);
  }

  private applyAllParameters(): void {
    const t = this.audioContext.currentTime;
    
    // Apply input gain (dB to linear)
    const inputLinear = dBToLinear(clamp(this.params.inputGain, -60, 24));
    this.inputGainNode.gain.setTargetAtTime(inputLinear, t, 0.01);
    
    // Apply output gain (dB to linear)
    const outputLinear = dBToLinear(clamp(this.params.outputGain, -60, 24));
    this.outputGainNode.gain.setTargetAtTime(outputLinear, t, 0.01);
    
    // Apply pan
    this.panNode.pan.setTargetAtTime(clamp(this.params.pan, -1, 1), t, 0.01);
    
    // Apply left/right balance
    const balance = clamp(this.params.leftRight, -1, 1);
    const leftLevel = balance < 0 ? 1 : 1 - balance;
    const rightLevel = balance > 0 ? 1 : 1 + balance;
    this.leftGain.gain.setTargetAtTime(leftLevel, t, 0.01);
    this.rightGain.gain.setTargetAtTime(rightLevel, t, 0.01);
    
    // Apply phase inversion
    this.leftPhaseInvert.gain.setTargetAtTime(
      this.params.phaseInvertL > 0.5 ? -1 : 1,
      t,
      0.01
    );
    this.rightPhaseInvert.gain.setTargetAtTime(
      this.params.phaseInvertR > 0.5 ? -1 : 1,
      t,
      0.01
    );
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'Input Gain', key: 'inputGain', min: -60, max: 24, default: 0, unit: 'dB', type: 'linear' },
      { name: 'Output Gain', key: 'outputGain', min: -60, max: 24, default: 0, unit: 'dB', type: 'linear' },
      { name: 'Pan', key: 'pan', min: -1, max: 1, default: 0, type: 'linear' },
      { name: 'L/R Balance', key: 'leftRight', min: -1, max: 1, default: 0, type: 'linear' },
      { name: 'Phase Invert L', key: 'phaseInvertL', min: 0, max: 1, default: 0, type: 'boolean' },
      { name: 'Phase Invert R', key: 'phaseInvertR', min: 0, max: 1, default: 0, type: 'boolean' }
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    this.applyAllParameters();
  }

  /**
   * Get current meter levels
   * @returns Object with left and right RMS and peak levels in dB
   */
  getMeterLevels(): { 
    leftRMS: number; 
    rightRMS: number; 
    leftPeak: number; 
    rightPeak: number;
    leftClipped: boolean;
    rightClipped: boolean;
  } {
    // Get time domain data
    this.analyserL.getFloatTimeDomainData(this.meterBufferL as Float32Array<ArrayBuffer>);
    this.analyserR.getFloatTimeDomainData(this.meterBufferR as Float32Array<ArrayBuffer>);
    
    // Calculate RMS
    const leftRMS = calculateRMS(this.meterBufferL);
    const rightRMS = calculateRMS(this.meterBufferR);
    
    // Calculate peak
    const leftPeak = calculatePeak(this.meterBufferL);
    const rightPeak = calculatePeak(this.meterBufferR);
    
    // Check for clipping
    const now = performance.now();
    if (leftPeak >= 0.99) {
      this.clippedL = true;
      this.lastClipTimeL = now;
    } else if (now - this.lastClipTimeL > this.clipHoldTime) {
      this.clippedL = false;
    }
    
    if (rightPeak >= 0.99) {
      this.clippedR = true;
      this.lastClipTimeR = now;
    } else if (now - this.lastClipTimeR > this.clipHoldTime) {
      this.clippedR = false;
    }
    
    return {
      leftRMS: linearToDb(leftRMS),
      rightRMS: linearToDb(rightRMS),
      leftPeak: linearToDb(leftPeak),
      rightPeak: linearToDb(rightPeak),
      leftClipped: this.clippedL,
      rightClipped: this.clippedR
    };
  }

  /**
   * Reset clip indicators
   */
  resetClipIndicators(): void {
    this.clippedL = false;
    this.clippedR = false;
  }

  /**
   * Set input gain in dB
   */
  setInputGain(dB: number): void {
    this.setParameter('inputGain', dB);
  }

  /**
   * Set output gain in dB
   */
  setOutputGain(dB: number): void {
    this.setParameter('outputGain', dB);
  }

  /**
   * Set pan position (-1 = left, 0 = center, 1 = right)
   */
  setPan(pan: number): void {
    this.setParameter('pan', pan);
  }

  /**
   * Set left/right balance (-1 = left only, 0 = both, 1 = right only)
   */
  setBalance(balance: number): void {
    this.setParameter('leftRight', balance);
  }

  /**
   * Set phase inversion for left channel
   */
  setPhaseInvertLeft(invert: boolean): void {
    this.setParameter('phaseInvertL', invert ? 1 : 0);
  }

  /**
   * Set phase inversion for right channel
   */
  setPhaseInvertRight(invert: boolean): void {
    this.setParameter('phaseInvertR', invert ? 1 : 0);
  }

  /**
   * Toggle phase inversion for left channel
   */
  togglePhaseInvertLeft(): boolean {
    const newValue = this.params.phaseInvertL > 0.5 ? 0 : 1;
    this.setParameter('phaseInvertL', newValue);
    return newValue > 0.5;
  }

  /**
   * Toggle phase inversion for right channel
   */
  togglePhaseInvertRight(): boolean {
    const newValue = this.params.phaseInvertR > 0.5 ? 0 : 1;
    this.setParameter('phaseInvertR', newValue);
    return newValue > 0.5;
  }

  private addDefaultPresets(): void {
    this.addPreset({
      name: 'Unity',
      params: { inputGain: 0, outputGain: 0, pan: 0, leftRight: 0, phaseInvertL: 0, phaseInvertR: 0 }
    });
    
    this.addPreset({
      name: 'Boost +6dB',
      params: { inputGain: 6, outputGain: 0, pan: 0, leftRight: 0, phaseInvertL: 0, phaseInvertR: 0 }
    });
    
    this.addPreset({
      name: 'Cut -6dB',
      params: { inputGain: -6, outputGain: 0, pan: 0, leftRight: 0, phaseInvertL: 0, phaseInvertR: 0 }
    });
    
    this.addPreset({
      name: 'Pan Left',
      params: { inputGain: 0, outputGain: 0, pan: -0.7, leftRight: 0, phaseInvertL: 0, phaseInvertR: 0 }
    });
    
    this.addPreset({
      name: 'Pan Right',
      params: { inputGain: 0, outputGain: 0, pan: 0.7, leftRight: 0, phaseInvertL: 0, phaseInvertR: 0 }
    });
    
    this.addPreset({
      name: 'Mono (L+R)',
      params: { inputGain: 0, outputGain: 0, pan: 0, leftRight: 0, phaseInvertL: 0, phaseInvertR: 0 }
    });
    
    this.addPreset({
      name: 'Phase Flip L',
      params: { inputGain: 0, outputGain: 0, pan: 0, leftRight: 0, phaseInvertL: 1, phaseInvertR: 0 }
    });
  }

  dispose(): void {
    super.dispose();
    
    this.inputGainNode.disconnect();
    this.outputGainNode.disconnect();
    this.panNode.disconnect();
    this.splitter.disconnect();
    this.merger.disconnect();
    this.leftGain.disconnect();
    this.rightGain.disconnect();
    this.leftPhaseInvert.disconnect();
    this.rightPhaseInvert.disconnect();
    this.analyserL.disconnect();
    this.analyserR.disconnect();
  }
}