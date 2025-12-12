// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * StereoEnhancer - Stereo width and imaging effect
 * 
 * Features:
 * - Mid/Side processing
 * - Stereo width control (0-200%)
 * - Bass mono (crossover frequency)
 * - Pan control
 * - Phase invert per channel
 */

import { BaseEffect, EffectParameterDescriptor, EffectPreset } from './BaseEffect';
import { clamp } from '../utils/AudioMath';

/**
 * StereoEnhancer effect using Mid/Side processing
 */
export class StereoEnhancer extends BaseEffect {
  // Channel splitter and merger
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  
  // Mid/Side encoding/decoding gains
  private leftToMid: GainNode;
  private rightToMid: GainNode;
  private leftToSide: GainNode;
  private rightToSide: GainNode;
  
  // Mid/Side level controls
  private midGain: GainNode;
  private sideGain: GainNode;
  
  // M/S to L/R decoding
  private midToLeft: GainNode;
  private midToRight: GainNode;
  private sideToLeft: GainNode;
  private sideToRight: GainNode;
  
  // Bass mono filter
  private bassMonoFilterL: BiquadFilterNode;
  private bassMonoFilterR: BiquadFilterNode;
  private bassMonoMerger: GainNode;
  
  // Pan control
  private pannerL: GainNode;
  private pannerR: GainNode;
  
  // Phase invert
  private phaseInvertL: GainNode;
  private phaseInvertR: GainNode;
  
  // Output
  private outputMerger: ChannelMergerNode;

  constructor(audioContext: AudioContext, id: string, name: string = 'Stereo Enhancer') {
    super(audioContext, id, name, 'stereoenhancer');
    
    // Create channel splitter (stereo to 2 mono)
    this.splitter = audioContext.createChannelSplitter(2);
    
    // Create M/S encoding gains
    // Mid = (L + R) / 2
    // Side = (L - R) / 2
    this.leftToMid = audioContext.createGain();
    this.rightToMid = audioContext.createGain();
    this.leftToSide = audioContext.createGain();
    this.rightToSide = audioContext.createGain();
    
    this.leftToMid.gain.value = 0.5;
    this.rightToMid.gain.value = 0.5;
    this.leftToSide.gain.value = 0.5;
    this.rightToSide.gain.value = -0.5;
    
    // Create M/S level controls
    this.midGain = audioContext.createGain();
    this.sideGain = audioContext.createGain();
    
    // Create M/S to L/R decoding gains
    // L = Mid + Side
    // R = Mid - Side
    this.midToLeft = audioContext.createGain();
    this.midToRight = audioContext.createGain();
    this.sideToLeft = audioContext.createGain();
    this.sideToRight = audioContext.createGain();
    
    this.midToLeft.gain.value = 1;
    this.midToRight.gain.value = 1;
    this.sideToLeft.gain.value = 1;
    this.sideToRight.gain.value = -1;
    
    // Create bass mono filters (lowpass to extract bass)
    this.bassMonoFilterL = audioContext.createBiquadFilter();
    this.bassMonoFilterR = audioContext.createBiquadFilter();
    this.bassMonoFilterL.type = 'lowpass';
    this.bassMonoFilterR.type = 'lowpass';
    this.bassMonoFilterL.Q.value = 0.7;
    this.bassMonoFilterR.Q.value = 0.7;
    
    this.bassMonoMerger = audioContext.createGain();
    this.bassMonoMerger.gain.value = 0.5;
    
    // Create pan controls
    this.pannerL = audioContext.createGain();
    this.pannerR = audioContext.createGain();
    
    // Create phase invert controls
    this.phaseInvertL = audioContext.createGain();
    this.phaseInvertR = audioContext.createGain();
    
    // Create output merger
    this.outputMerger = audioContext.createChannelMerger(2);
    this.merger = audioContext.createChannelMerger(2);
    
    this.initializeEffect();
    this.setupRouting();
    this.addDefaultPresets();
  }

  protected initializeEffect(): void {
    // Initialize default parameters
    this.params = {
      width: 1,              // Stereo width (0-2, 1 = normal)
      bassMonoFreq: 0,       // Bass mono crossover frequency (0 = disabled, 20-500 Hz)
      pan: 0,                // Pan position (-1 to 1)
      phaseInvertL: 0,       // Phase invert left (0 or 1)
      phaseInvertR: 0,       // Phase invert right (0 or 1)
      mix: 1,                // Wet/dry mix (0-1)
    };
    
    this.applyParameters();
  }

  private setupRouting(): void {
    // Split input into L/R channels
    this.inputNode.connect(this.splitter);
    
    // Encode to M/S
    this.splitter.connect(this.leftToMid, 0);
    this.splitter.connect(this.rightToMid, 1);
    this.splitter.connect(this.leftToSide, 0);
    this.splitter.connect(this.rightToSide, 1);
    
    // Sum to create Mid and Side signals
    const midSum = this.audioContext.createGain();
    const sideSum = this.audioContext.createGain();
    
    this.leftToMid.connect(midSum);
    this.rightToMid.connect(midSum);
    this.leftToSide.connect(sideSum);
    this.rightToSide.connect(sideSum);
    
    // Apply M/S level controls
    midSum.connect(this.midGain);
    sideSum.connect(this.sideGain);
    
    // Decode back to L/R
    this.midGain.connect(this.midToLeft);
    this.midGain.connect(this.midToRight);
    this.sideGain.connect(this.sideToLeft);
    this.sideGain.connect(this.sideToRight);
    
    // Sum to create L/R outputs
    const leftSum = this.audioContext.createGain();
    const rightSum = this.audioContext.createGain();
    
    this.midToLeft.connect(leftSum);
    this.sideToLeft.connect(leftSum);
    this.midToRight.connect(rightSum);
    this.sideToRight.connect(rightSum);
    
    // Apply phase invert
    leftSum.connect(this.phaseInvertL);
    rightSum.connect(this.phaseInvertR);
    
    // Apply pan
    this.phaseInvertL.connect(this.pannerL);
    this.phaseInvertR.connect(this.pannerR);
    
    // Merge back to stereo
    this.pannerL.connect(this.outputMerger, 0, 0);
    this.pannerR.connect(this.outputMerger, 0, 1);
    
    // Connect to wet output
    this.outputMerger.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  private applyParameters(): void {
    const currentTime = this.audioContext.currentTime;
    
    // Width control: adjust side level relative to mid
    // Width = 0: mono (no side)
    // Width = 1: normal stereo
    // Width = 2: extra wide (side boosted)
    const width = this.params.width;
    this.midGain.gain.setTargetAtTime(1, currentTime, 0.01);
    this.sideGain.gain.setTargetAtTime(width, currentTime, 0.01);
    
    // Bass mono frequency
    const bassMonoFreq = this.params.bassMonoFreq;
    if (bassMonoFreq > 0) {
      this.bassMonoFilterL.frequency.setTargetAtTime(bassMonoFreq, currentTime, 0.01);
      this.bassMonoFilterR.frequency.setTargetAtTime(bassMonoFreq, currentTime, 0.01);
    }
    
    // Pan control using constant power panning
    const pan = this.params.pan;
    const panAngle = (pan + 1) * Math.PI / 4; // 0 to PI/2
    this.pannerL.gain.setTargetAtTime(Math.cos(panAngle), currentTime, 0.01);
    this.pannerR.gain.setTargetAtTime(Math.sin(panAngle), currentTime, 0.01);
    
    // Phase invert
    this.phaseInvertL.gain.setTargetAtTime(this.params.phaseInvertL ? -1 : 1, currentTime, 0.01);
    this.phaseInvertR.gain.setTargetAtTime(this.params.phaseInvertR ? -1 : 1, currentTime, 0.01);
    
    // Set wet/dry mix
    this.setWetDry(this.params.mix);
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      {
        name: 'Width',
        key: 'width',
        min: 0,
        max: 2,
        default: 1,
        step: 0.01,
        unit: '',
        type: 'linear',
      },
      {
        name: 'Bass Mono',
        key: 'bassMonoFreq',
        min: 0,
        max: 500,
        default: 0,
        step: 1,
        unit: ' Hz',
        type: 'linear',
      },
      {
        name: 'Pan',
        key: 'pan',
        min: -1,
        max: 1,
        default: 0,
        step: 0.01,
      },
      {
        name: 'Phase Invert L',
        key: 'phaseInvertL',
        min: 0,
        max: 1,
        default: 0,
        step: 1,
      },
      {
        name: 'Phase Invert R',
        key: 'phaseInvertR',
        min: 0,
        max: 1,
        default: 0,
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
      case 'width':
        this.sideGain.gain.setTargetAtTime(value, currentTime, 0.01);
        break;
      case 'bassMonoFreq':
        if (value > 0) {
          this.bassMonoFilterL.frequency.setTargetAtTime(value, currentTime, 0.01);
          this.bassMonoFilterR.frequency.setTargetAtTime(value, currentTime, 0.01);
        }
        break;
      case 'pan':
        const panAngle = (value + 1) * Math.PI / 4;
        this.pannerL.gain.setTargetAtTime(Math.cos(panAngle), currentTime, 0.01);
        this.pannerR.gain.setTargetAtTime(Math.sin(panAngle), currentTime, 0.01);
        break;
      case 'phaseInvertL':
        this.phaseInvertL.gain.setTargetAtTime(value ? -1 : 1, currentTime, 0.01);
        break;
      case 'phaseInvertR':
        this.phaseInvertR.gain.setTargetAtTime(value ? -1 : 1, currentTime, 0.01);
        break;
      case 'mix':
        this.setWetDry(value);
        break;
    }
  }

  /**
   * Get the current stereo correlation (-1 to 1)
   * 1 = mono, 0 = uncorrelated, -1 = out of phase
   */
  getCorrelation(): number {
    // This would require an analyser node to compute in real-time
    // For now, estimate based on width setting
    const width = this.params.width;
    if (width === 0) return 1; // Mono
    if (width === 1) return 0.7; // Normal stereo
    return Math.max(-1, 1 - width); // Wide stereo
  }

  private addDefaultPresets(): void {
    const presets: EffectPreset[] = [
      {
        name: 'Subtle Wide',
        params: {
          width: 1.2,
          bassMonoFreq: 0,
          pan: 0,
          phaseInvertL: 0,
          phaseInvertR: 0,
          mix: 1,
        },
      },
      {
        name: 'Extra Wide',
        params: {
          width: 1.8,
          bassMonoFreq: 100,
          pan: 0,
          phaseInvertL: 0,
          phaseInvertR: 0,
          mix: 1,
        },
      },
      {
        name: 'Mono',
        params: {
          width: 0,
          bassMonoFreq: 0,
          pan: 0,
          phaseInvertL: 0,
          phaseInvertR: 0,
          mix: 1,
        },
      },
      {
        name: 'Bass Mono',
        params: {
          width: 1.3,
          bassMonoFreq: 150,
          pan: 0,
          phaseInvertL: 0,
          phaseInvertR: 0,
          mix: 1,
        },
      },
      {
        name: 'Narrow',
        params: {
          width: 0.5,
          bassMonoFreq: 0,
          pan: 0,
          phaseInvertL: 0,
          phaseInvertR: 0,
          mix: 1,
        },
      },
      {
        name: 'Maximum Width',
        params: {
          width: 2,
          bassMonoFreq: 80,
          pan: 0,
          phaseInvertL: 0,
          phaseInvertR: 0,
          mix: 0.8,
        },
      },
      {
        name: 'Phase Flip L',
        params: {
          width: 1,
          bassMonoFreq: 0,
          pan: 0,
          phaseInvertL: 1,
          phaseInvertR: 0,
          mix: 1,
        },
      },
      {
        name: 'Karaoke',
        params: {
          width: 0,
          bassMonoFreq: 0,
          pan: 0,
          phaseInvertL: 0,
          phaseInvertR: 1,
          mix: 1,
        },
      },
    ];

    for (const preset of presets) {
      this.addPreset(preset);
    }
  }

  dispose(): void {
    this.splitter.disconnect();
    this.merger.disconnect();
    this.leftToMid.disconnect();
    this.rightToMid.disconnect();
    this.leftToSide.disconnect();
    this.rightToSide.disconnect();
    this.midGain.disconnect();
    this.sideGain.disconnect();
    this.midToLeft.disconnect();
    this.midToRight.disconnect();
    this.sideToLeft.disconnect();
    this.sideToRight.disconnect();
    this.bassMonoFilterL.disconnect();
    this.bassMonoFilterR.disconnect();
    this.bassMonoMerger.disconnect();
    this.pannerL.disconnect();
    this.pannerR.disconnect();
    this.phaseInvertL.disconnect();
    this.phaseInvertR.disconnect();
    this.outputMerger.disconnect();
    
    super.dispose();
  }
}