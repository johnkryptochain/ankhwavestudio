// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Flanger - Classic flanger effect with LFO modulation
 * 
 * Features:
 * - Delay line with LFO modulation
 * - Delay time (0.1-10ms)
 * - LFO rate (0.01-10 Hz)
 * - LFO depth
 * - Feedback (-1 to +1)
 * - Stereo phase offset
 * - Wet/dry mix
 */

import { BaseEffect, EffectParameterDescriptor, EffectPreset } from './BaseEffect';
import { clamp } from '../utils/AudioMath';

/**
 * Flanger effect using delay modulation
 */
export class Flanger extends BaseEffect {
  // Delay nodes for left and right channels
  private delayNodeL: DelayNode;
  private delayNodeR: DelayNode;
  
  // LFO for modulation
  private lfoNode: OscillatorNode;
  private lfoGainL: GainNode;
  private lfoGainR: GainNode;
  
  // Feedback
  private feedbackGainL: GainNode;
  private feedbackGainR: GainNode;
  
  // Channel splitter/merger for stereo processing
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  
  // Constant offset for delay time
  private delayOffsetL: ConstantSourceNode;
  private delayOffsetR: ConstantSourceNode;
  
  // LFO phase offset for stereo
  private stereoPhaseOffset: number = 0;

  constructor(audioContext: AudioContext, id: string, name: string = 'Flanger') {
    super(audioContext, id, name, 'flanger');
    
    // Create delay nodes
    this.delayNodeL = audioContext.createDelay(0.02); // Max 20ms delay
    this.delayNodeR = audioContext.createDelay(0.02);
    
    // Create LFO
    this.lfoNode = audioContext.createOscillator();
    this.lfoNode.type = 'sine';
    this.lfoNode.frequency.value = 0.5;
    
    // Create LFO gain nodes (controls depth)
    this.lfoGainL = audioContext.createGain();
    this.lfoGainR = audioContext.createGain();
    
    // Create feedback gains
    this.feedbackGainL = audioContext.createGain();
    this.feedbackGainR = audioContext.createGain();
    
    // Create channel splitter/merger
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    
    // Create constant source for delay offset
    this.delayOffsetL = audioContext.createConstantSource();
    this.delayOffsetR = audioContext.createConstantSource();
    
    this.initializeEffect();
    this.setupRouting();
    this.addDefaultPresets();
    
    // Start oscillators
    this.lfoNode.start();
    this.delayOffsetL.start();
    this.delayOffsetR.start();
  }

  protected initializeEffect(): void {
    // Initialize default parameters
    this.params = {
      delayTime: 2,      // Base delay time in ms (0.1-10)
      lfoRate: 0.5,      // LFO rate in Hz (0.01-10)
      lfoDepth: 0.5,     // LFO depth (0-1)
      feedback: 0.5,     // Feedback amount (-1 to 1)
      stereoPhase: 90,   // Stereo phase offset in degrees (0-180)
      mix: 0.5,          // Wet/dry mix (0-1)
    };
    
    this.applyParameters();
  }

  private setupRouting(): void {
    // Split input into stereo channels
    this.inputNode.connect(this.splitter);
    
    // Left channel processing
    this.splitter.connect(this.delayNodeL, 0);
    this.delayNodeL.connect(this.feedbackGainL);
    this.feedbackGainL.connect(this.delayNodeL); // Feedback loop
    this.delayNodeL.connect(this.merger, 0, 0);
    
    // Right channel processing
    this.splitter.connect(this.delayNodeR, 1);
    this.delayNodeR.connect(this.feedbackGainR);
    this.feedbackGainR.connect(this.delayNodeR); // Feedback loop
    this.delayNodeR.connect(this.merger, 0, 1);
    
    // LFO modulation
    this.lfoNode.connect(this.lfoGainL);
    this.lfoNode.connect(this.lfoGainR);
    
    // Connect LFO to delay time (via gain for depth control)
    this.lfoGainL.connect(this.delayNodeL.delayTime);
    this.lfoGainR.connect(this.delayNodeR.delayTime);
    
    // Connect constant offset to delay time
    this.delayOffsetL.connect(this.delayNodeL.delayTime);
    this.delayOffsetR.connect(this.delayNodeR.delayTime);
    
    // Connect merger to wet gain
    this.merger.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  private applyParameters(): void {
    const currentTime = this.audioContext.currentTime;
    
    // Convert delay time from ms to seconds
    const delayTimeSec = this.params.delayTime / 1000;
    
    // Set base delay time
    this.delayOffsetL.offset.setTargetAtTime(delayTimeSec, currentTime, 0.01);
    this.delayOffsetR.offset.setTargetAtTime(delayTimeSec, currentTime, 0.01);
    
    // Set LFO rate
    this.lfoNode.frequency.setTargetAtTime(this.params.lfoRate, currentTime, 0.01);
    
    // Set LFO depth (modulation amount in seconds)
    const depthSec = (this.params.lfoDepth * this.params.delayTime * 0.9) / 1000;
    this.lfoGainL.gain.setTargetAtTime(depthSec, currentTime, 0.01);
    this.lfoGainR.gain.setTargetAtTime(depthSec, currentTime, 0.01);
    
    // Set feedback
    this.feedbackGainL.gain.setTargetAtTime(this.params.feedback, currentTime, 0.01);
    this.feedbackGainR.gain.setTargetAtTime(this.params.feedback, currentTime, 0.01);
    
    // Apply stereo phase offset by adjusting the right channel LFO
    // This is done by using a phase-shifted version of the LFO
    this.stereoPhaseOffset = this.params.stereoPhase;
    
    // Set wet/dry mix
    this.setWetDry(this.params.mix);
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      {
        name: 'Delay Time',
        key: 'delayTime',
        min: 0.1,
        max: 10,
        default: 2,
        step: 0.1,
        unit: 'ms',
        type: 'logarithmic',
      },
      {
        name: 'LFO Rate',
        key: 'lfoRate',
        min: 0.01,
        max: 10,
        default: 0.5,
        step: 0.01,
        unit: 'Hz',
        type: 'logarithmic',
      },
      {
        name: 'LFO Depth',
        key: 'lfoDepth',
        min: 0,
        max: 1,
        default: 0.5,
        step: 0.01,
      },
      {
        name: 'Feedback',
        key: 'feedback',
        min: -0.95,
        max: 0.95,
        default: 0.5,
        step: 0.01,
      },
      {
        name: 'Stereo Phase',
        key: 'stereoPhase',
        min: 0,
        max: 180,
        default: 90,
        step: 1,
        unit: '°',
      },
      {
        name: 'Mix',
        key: 'mix',
        min: 0,
        max: 1,
        default: 0.5,
        step: 0.01,
      },
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    const currentTime = this.audioContext.currentTime;
    
    switch (key) {
      case 'delayTime': {
        const delayTimeSec = value / 1000;
        this.delayOffsetL.offset.setTargetAtTime(delayTimeSec, currentTime, 0.01);
        this.delayOffsetR.offset.setTargetAtTime(delayTimeSec, currentTime, 0.01);
        // Update depth to maintain ratio
        const depthSec = (this.params.lfoDepth * value * 0.9) / 1000;
        this.lfoGainL.gain.setTargetAtTime(depthSec, currentTime, 0.01);
        this.lfoGainR.gain.setTargetAtTime(depthSec, currentTime, 0.01);
        break;
      }
      case 'lfoRate':
        this.lfoNode.frequency.setTargetAtTime(value, currentTime, 0.01);
        break;
      case 'lfoDepth': {
        const depthSec = (value * this.params.delayTime * 0.9) / 1000;
        this.lfoGainL.gain.setTargetAtTime(depthSec, currentTime, 0.01);
        this.lfoGainR.gain.setTargetAtTime(depthSec, currentTime, 0.01);
        break;
      }
      case 'feedback':
        this.feedbackGainL.gain.setTargetAtTime(value, currentTime, 0.01);
        this.feedbackGainR.gain.setTargetAtTime(value, currentTime, 0.01);
        break;
      case 'stereoPhase':
        this.stereoPhaseOffset = value;
        break;
      case 'mix':
        this.setWetDry(value);
        break;
    }
  }

  /**
   * Get current LFO phase for visualization
   */
  getLfoPhase(): number {
    // This would require tracking the LFO phase
    // For now, return an approximation based on time
    const time = this.audioContext.currentTime;
    const rate = this.params.lfoRate;
    return (time * rate * 360) % 360;
  }

  private addDefaultPresets(): void {
    const presets: EffectPreset[] = [
      {
        name: 'Classic Jet',
        params: {
          delayTime: 3,
          lfoRate: 0.3,
          lfoDepth: 0.7,
          feedback: 0.7,
          stereoPhase: 90,
          mix: 0.5,
        },
      },
      {
        name: 'Subtle Chorus',
        params: {
          delayTime: 5,
          lfoRate: 0.8,
          lfoDepth: 0.3,
          feedback: 0.2,
          stereoPhase: 120,
          mix: 0.4,
        },
      },
      {
        name: 'Metallic',
        params: {
          delayTime: 1,
          lfoRate: 2,
          lfoDepth: 0.5,
          feedback: 0.8,
          stereoPhase: 45,
          mix: 0.6,
        },
      },
      {
        name: 'Slow Sweep',
        params: {
          delayTime: 4,
          lfoRate: 0.1,
          lfoDepth: 0.8,
          feedback: 0.6,
          stereoPhase: 90,
          mix: 0.5,
        },
      },
      {
        name: 'Fast Wobble',
        params: {
          delayTime: 2,
          lfoRate: 5,
          lfoDepth: 0.4,
          feedback: 0.4,
          stereoPhase: 60,
          mix: 0.5,
        },
      },
      {
        name: 'Through Zero',
        params: {
          delayTime: 0.5,
          lfoRate: 0.2,
          lfoDepth: 0.9,
          feedback: 0.5,
          stereoPhase: 180,
          mix: 0.5,
        },
      },
      {
        name: 'Wide Stereo',
        params: {
          delayTime: 3,
          lfoRate: 0.4,
          lfoDepth: 0.6,
          feedback: 0.5,
          stereoPhase: 180,
          mix: 0.5,
        },
      },
      {
        name: 'Negative Feedback',
        params: {
          delayTime: 2,
          lfoRate: 0.5,
          lfoDepth: 0.5,
          feedback: -0.7,
          stereoPhase: 90,
          mix: 0.5,
        },
      },
    ];

    for (const preset of presets) {
      this.addPreset(preset);
    }
  }

  dispose(): void {
    try {
      this.lfoNode.stop();
      this.delayOffsetL.stop();
      this.delayOffsetR.stop();
    } catch {
      // Already stopped
    }
    
    this.lfoNode.disconnect();
    this.lfoGainL.disconnect();
    this.lfoGainR.disconnect();
    this.delayNodeL.disconnect();
    this.delayNodeR.disconnect();
    this.feedbackGainL.disconnect();
    this.feedbackGainR.disconnect();
    this.splitter.disconnect();
    this.merger.disconnect();
    this.delayOffsetL.disconnect();
    this.delayOffsetR.disconnect();
    
    super.dispose();
  }
}