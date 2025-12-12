// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * GranularPitchShifter - Granular Synthesis-based Pitch Shifting
 * Uses granular synthesis for high-quality pitch shifting
 * 
 * Features:
 * - Pitch shift amount (semitones)
 * - Grain size
 * - Grain overlap
 * - Spray (randomization)
 * - Feedback
 */

import { BaseEffect, type EffectParameterDescriptor } from './BaseEffect';
import { clamp } from '../utils/AudioMath';

// ============================================================================
// GranularPitchShifter Effect
// ============================================================================

export class GranularPitchShifter extends BaseEffect {
  // Grain parameters
  private pitchShift: number = 0; // semitones
  private grainSize: number = 50; // ms
  private grainOverlap: number = 0.5;
  private spray: number = 0;
  private feedback: number = 0;
  
  // Audio nodes
  private inputBuffer: DelayNode;
  private grainGains: GainNode[] = [];
  private grainDelays: DelayNode[] = [];
  private feedbackGain: GainNode;
  private feedbackDelay: DelayNode;
  private outputMixer: GainNode;
  
  // Grain scheduling
  private grainCount: number = 4;
  private grainPhases: number[] = [];
  private schedulerInterval: number | null = null;
  
  // ScriptProcessor for granular synthesis (fallback)
  private scriptProcessor: ScriptProcessorNode | null = null;
  private circularBuffer: Float32Array;
  private bufferWriteIndex: number = 0;
  private bufferReadIndex: number = 0;
  private bufferSize: number = 65536;
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'GranularPitchShifter', 'granularpitchshifter');
    
    // Initialize circular buffer
    this.circularBuffer = new Float32Array(this.bufferSize);
    
    // Create input buffer delay
    this.inputBuffer = audioContext.createDelay(1);
    this.inputBuffer.delayTime.value = 0.1;
    
    // Create output mixer
    this.outputMixer = audioContext.createGain();
    this.outputMixer.gain.value = 1;
    
    // Create feedback path
    this.feedbackGain = audioContext.createGain();
    this.feedbackGain.gain.value = 0;
    
    this.feedbackDelay = audioContext.createDelay(1);
    this.feedbackDelay.delayTime.value = 0.1;
    
    // Create grain voices
    this.createGrainVoices();
    
    // Connect input
    this.inputNode.connect(this.inputBuffer);
    
    // Connect output
    this.outputMixer.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
    
    // Connect feedback
    this.outputMixer.connect(this.feedbackDelay);
    this.feedbackDelay.connect(this.feedbackGain);
    this.feedbackGain.connect(this.inputBuffer);
    
    // Initialize grain phases
    for (let i = 0; i < this.grainCount; i++) {
      this.grainPhases[i] = i / this.grainCount;
    }
    
    // Start grain scheduler
    this.startGrainScheduler();
    
    // Initialize
    this.initializeEffect();
  }
  
  /**
   * Create grain voices
   */
  private createGrainVoices(): void {
    for (let i = 0; i < this.grainCount; i++) {
      // Delay for grain position
      const delay = this.audioContext.createDelay(1);
      delay.delayTime.value = 0;
      this.grainDelays.push(delay);
      
      // Gain for grain envelope
      const gain = this.audioContext.createGain();
      gain.gain.value = 0;
      this.grainGains.push(gain);
      
      // Connect
      this.inputBuffer.connect(delay);
      delay.connect(gain);
      gain.connect(this.outputMixer);
    }
  }
  
  /**
   * Start grain scheduler
   */
  private startGrainScheduler(): void {
    const scheduleGrains = () => {
      const currentTime = this.audioContext.currentTime;
      const grainDuration = this.grainSize / 1000;
      const overlapTime = grainDuration * this.grainOverlap;
      
      for (let i = 0; i < this.grainCount; i++) {
        // Update grain phase
        this.grainPhases[i] += 0.016 / (grainDuration / this.grainOverlap);
        if (this.grainPhases[i] >= 1) {
          this.grainPhases[i] -= 1;
          this.triggerGrain(i, currentTime);
        }
      }
    };
    
    // Schedule grains at 60fps
    this.schedulerInterval = window.setInterval(scheduleGrains, 16);
  }
  
  /**
   * Trigger a grain
   */
  private triggerGrain(grainIndex: number, time: number): void {
    const grainDuration = this.grainSize / 1000;
    const gain = this.grainGains[grainIndex];
    const delay = this.grainDelays[grainIndex];
    
    // Calculate pitch shift as delay modulation
    // Pitch shift = 2^(semitones/12)
    const pitchRatio = Math.pow(2, this.pitchShift / 12);
    const delayModulation = (1 - pitchRatio) * grainDuration;
    
    // Add spray (randomization)
    const sprayAmount = this.spray * grainDuration * 0.5 * (Math.random() * 2 - 1);
    
    // Set delay time
    const baseDelay = 0.1;
    const targetDelay = clamp(baseDelay + delayModulation + sprayAmount, 0.001, 0.999);
    
    delay.delayTime.cancelScheduledValues(time);
    delay.delayTime.setValueAtTime(delay.delayTime.value, time);
    delay.delayTime.linearRampToValueAtTime(targetDelay, time + grainDuration);
    
    // Grain envelope (Hann window)
    gain.gain.cancelScheduledValues(time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(1 / this.grainCount, time + grainDuration * 0.25);
    gain.gain.setValueAtTime(1 / this.grainCount, time + grainDuration * 0.75);
    gain.gain.linearRampToValueAtTime(0, time + grainDuration);
  }
  
  /**
   * Update feedback
   */
  private updateFeedback(): void {
    const currentTime = this.audioContext.currentTime;
    this.feedbackGain.gain.setTargetAtTime(this.feedback, currentTime, 0.02);
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    switch (key) {
      case 'pitchShift':
        this.pitchShift = value;
        break;
      case 'grainSize':
        this.grainSize = value;
        break;
      case 'grainOverlap':
        this.grainOverlap = value;
        break;
      case 'spray':
        this.spray = value;
        break;
      case 'feedback':
        this.feedback = value;
        this.updateFeedback();
        break;
    }
  }
  
  /**
   * Initialize effect
   */
  protected initializeEffect(): void {
    this.params['pitchShift'] = this.pitchShift;
    this.params['grainSize'] = this.grainSize;
    this.params['grainOverlap'] = this.grainOverlap;
    this.params['spray'] = this.spray;
    this.params['feedback'] = this.feedback;
    
    this.updateFeedback();
    
    // Add presets
    this.addPresets();
  }
  
  /**
   * Add presets
   */
  private addPresets(): void {
    this.presets.push({
      name: 'Octave Up',
      params: { pitchShift: 12, grainSize: 50, grainOverlap: 0.5, spray: 0, feedback: 0 }
    });
    
    this.presets.push({
      name: 'Octave Down',
      params: { pitchShift: -12, grainSize: 80, grainOverlap: 0.6, spray: 0, feedback: 0 }
    });
    
    this.presets.push({
      name: 'Fifth Up',
      params: { pitchShift: 7, grainSize: 50, grainOverlap: 0.5, spray: 0, feedback: 0 }
    });
    
    this.presets.push({
      name: 'Fourth Down',
      params: { pitchShift: -5, grainSize: 60, grainOverlap: 0.5, spray: 0, feedback: 0 }
    });
    
    this.presets.push({
      name: 'Shimmer',
      params: { pitchShift: 12, grainSize: 100, grainOverlap: 0.7, spray: 0.3, feedback: 0.4 }
    });
    
    this.presets.push({
      name: 'Chorus-like',
      params: { pitchShift: 0.1, grainSize: 30, grainOverlap: 0.8, spray: 0.5, feedback: 0 }
    });
    
    this.presets.push({
      name: 'Granular Texture',
      params: { pitchShift: 0, grainSize: 20, grainOverlap: 0.3, spray: 0.8, feedback: 0.2 }
    });
    
    this.presets.push({
      name: 'Frozen',
      params: { pitchShift: 0, grainSize: 200, grainOverlap: 0.9, spray: 0.1, feedback: 0.6 }
    });
  }
  
  /**
   * Get parameter descriptors
   */
  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'Pitch Shift', key: 'pitchShift', min: -24, max: 24, default: 0, unit: 'st', step: 0.1 },
      { name: 'Grain Size', key: 'grainSize', min: 10, max: 500, default: 50, unit: 'ms' },
      { name: 'Grain Overlap', key: 'grainOverlap', min: 0.1, max: 0.9, default: 0.5 },
      { name: 'Spray', key: 'spray', min: 0, max: 1, default: 0 },
      { name: 'Feedback', key: 'feedback', min: 0, max: 0.9, default: 0 }
    ];
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    // Stop scheduler
    if (this.schedulerInterval !== null) {
      clearInterval(this.schedulerInterval);
    }
    
    // Disconnect nodes
    this.inputBuffer.disconnect();
    for (const delay of this.grainDelays) {
      delay.disconnect();
    }
    for (const gain of this.grainGains) {
      gain.disconnect();
    }
    this.feedbackGain.disconnect();
    this.feedbackDelay.disconnect();
    this.outputMixer.disconnect();
    
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
    }
    
    super.dispose();
  }
}

// Factory function
export function createGranularPitchShifter(audioContext: AudioContext, id?: string): GranularPitchShifter {
  return new GranularPitchShifter(audioContext, id || `granularpitchshifter-${Date.now()}`);
}