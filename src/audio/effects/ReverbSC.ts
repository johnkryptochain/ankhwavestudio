// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * ReverbSC - Sean Costello Reverb
 * High-quality algorithmic reverb based on feedback delay networks
 * 
 * Features:
 * - Feedback delay network
 * - Input bandwidth control
 * - Damping
 * - Room size
 * - Dry/wet mix
 */

import { BaseEffect, type EffectParameterDescriptor } from './BaseEffect';
import { clamp } from '../utils/AudioMath';

// ============================================================================
// ReverbSC Effect
// ============================================================================

export class ReverbSC extends BaseEffect {
  // Delay lines for FDN
  private delayLines: DelayNode[] = [];
  private feedbackGains: GainNode[] = [];
  private dampingFilters: BiquadFilterNode[] = [];
  
  // Input processing
  private inputBandwidth: BiquadFilterNode;
  private inputGain: GainNode;
  
  // Output processing
  private outputGain: GainNode;
  
  // Mixing matrix gains
  private mixingGains: GainNode[][] = [];
  
  // Parameters
  private roomSize: number = 0.5;
  private damping: number = 0.5;
  private bandwidth: number = 0.9;
  private feedback: number = 0.85;
  
  // Delay times in ms (prime numbers for better diffusion)
  private readonly delayTimes = [29.7, 37.1, 41.1, 43.7, 53.0, 59.9, 61.7, 67.3];
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'ReverbSC', 'reverbsc');
    
    // Create input bandwidth filter
    this.inputBandwidth = audioContext.createBiquadFilter();
    this.inputBandwidth.type = 'lowpass';
    this.inputBandwidth.frequency.value = 18000;
    this.inputBandwidth.Q.value = 0.707;
    
    // Create input gain
    this.inputGain = audioContext.createGain();
    this.inputGain.gain.value = 0.5;
    
    // Create output gain
    this.outputGain = audioContext.createGain();
    this.outputGain.gain.value = 1;
    
    // Create FDN structure
    this.createFDN();
    
    // Connect input path
    this.inputNode.connect(this.inputBandwidth);
    this.inputBandwidth.connect(this.inputGain);
    
    // Connect FDN input
    for (let i = 0; i < 8; i++) {
      this.inputGain.connect(this.delayLines[i]);
    }
    
    // Connect output
    this.outputGain.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
    
    // Initialize
    this.initializeEffect();
  }
  
  /**
   * Create Feedback Delay Network
   */
  private createFDN(): void {
    // Create 8 delay lines with damping filters
    for (let i = 0; i < 8; i++) {
      // Delay line
      const delay = this.audioContext.createDelay(1);
      delay.delayTime.value = (this.delayTimes[i] * this.roomSize) / 1000;
      this.delayLines.push(delay);
      
      // Damping filter (lowpass)
      const damping = this.audioContext.createBiquadFilter();
      damping.type = 'lowpass';
      damping.frequency.value = 8000;
      damping.Q.value = 0.5;
      this.dampingFilters.push(damping);
      
      // Feedback gain
      const feedbackGain = this.audioContext.createGain();
      feedbackGain.gain.value = this.feedback;
      this.feedbackGains.push(feedbackGain);
      
      // Connect delay -> damping -> feedback
      delay.connect(damping);
      damping.connect(feedbackGain);
      
      // Connect to output
      feedbackGain.connect(this.outputGain);
    }
    
    // Create Hadamard-like mixing matrix
    // This creates the characteristic diffusion of FDN reverbs
    this.createMixingMatrix();
  }
  
  /**
   * Create mixing matrix for FDN
   * Uses a simplified Hadamard-like matrix for efficiency
   */
  private createMixingMatrix(): void {
    // Hadamard matrix coefficients (normalized)
    const h = 1 / Math.sqrt(8);
    const matrix = [
      [ h,  h,  h,  h,  h,  h,  h,  h],
      [ h, -h,  h, -h,  h, -h,  h, -h],
      [ h,  h, -h, -h,  h,  h, -h, -h],
      [ h, -h, -h,  h,  h, -h, -h,  h],
      [ h,  h,  h,  h, -h, -h, -h, -h],
      [ h, -h,  h, -h, -h,  h, -h,  h],
      [ h,  h, -h, -h, -h, -h,  h,  h],
      [ h, -h, -h,  h, -h,  h,  h, -h]
    ];
    
    // Create gain nodes for mixing
    for (let i = 0; i < 8; i++) {
      this.mixingGains[i] = [];
      for (let j = 0; j < 8; j++) {
        const gain = this.audioContext.createGain();
        gain.gain.value = matrix[i][j];
        this.mixingGains[i].push(gain);
        
        // Connect feedback output to mixing gain
        this.feedbackGains[j].connect(gain);
        
        // Connect mixing gain to delay input
        gain.connect(this.delayLines[i]);
      }
    }
  }
  
  /**
   * Update room size
   */
  private updateRoomSize(): void {
    const currentTime = this.audioContext.currentTime;
    
    for (let i = 0; i < 8; i++) {
      const delayTime = (this.delayTimes[i] * (0.5 + this.roomSize * 1.5)) / 1000;
      this.delayLines[i].delayTime.setTargetAtTime(delayTime, currentTime, 0.05);
    }
  }
  
  /**
   * Update damping
   */
  private updateDamping(): void {
    const currentTime = this.audioContext.currentTime;
    // Map damping 0-1 to frequency 20000-2000 Hz
    const frequency = 20000 - this.damping * 18000;
    
    for (const filter of this.dampingFilters) {
      filter.frequency.setTargetAtTime(frequency, currentTime, 0.05);
    }
  }
  
  /**
   * Update feedback
   */
  private updateFeedback(): void {
    const currentTime = this.audioContext.currentTime;
    
    for (const gain of this.feedbackGains) {
      gain.gain.setTargetAtTime(this.feedback, currentTime, 0.05);
    }
  }
  
  /**
   * Update input bandwidth
   */
  private updateBandwidth(): void {
    const currentTime = this.audioContext.currentTime;
    // Map bandwidth 0-1 to frequency 1000-20000 Hz
    const frequency = 1000 + this.bandwidth * 19000;
    this.inputBandwidth.frequency.setTargetAtTime(frequency, currentTime, 0.05);
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    switch (key) {
      case 'roomSize':
        this.roomSize = value;
        this.updateRoomSize();
        break;
      case 'damping':
        this.damping = value;
        this.updateDamping();
        break;
      case 'bandwidth':
        this.bandwidth = value;
        this.updateBandwidth();
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
    this.params['roomSize'] = this.roomSize;
    this.params['damping'] = this.damping;
    this.params['bandwidth'] = this.bandwidth;
    this.params['feedback'] = this.feedback;
    
    this.updateRoomSize();
    this.updateDamping();
    this.updateBandwidth();
    this.updateFeedback();
    
    // Add presets
    this.addPresets();
  }
  
  /**
   * Add presets
   */
  private addPresets(): void {
    this.presets.push({
      name: 'Small Room',
      params: { roomSize: 0.2, damping: 0.6, bandwidth: 0.9, feedback: 0.7 }
    });
    
    this.presets.push({
      name: 'Medium Hall',
      params: { roomSize: 0.5, damping: 0.4, bandwidth: 0.85, feedback: 0.8 }
    });
    
    this.presets.push({
      name: 'Large Hall',
      params: { roomSize: 0.8, damping: 0.3, bandwidth: 0.8, feedback: 0.85 }
    });
    
    this.presets.push({
      name: 'Cathedral',
      params: { roomSize: 1.0, damping: 0.2, bandwidth: 0.7, feedback: 0.9 }
    });
    
    this.presets.push({
      name: 'Plate',
      params: { roomSize: 0.3, damping: 0.1, bandwidth: 0.95, feedback: 0.75 }
    });
    
    this.presets.push({
      name: 'Ambient',
      params: { roomSize: 0.7, damping: 0.5, bandwidth: 0.6, feedback: 0.88 }
    });
  }
  
  /**
   * Get parameter descriptors
   */
  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'Room Size', key: 'roomSize', min: 0, max: 1, default: 0.5 },
      { name: 'Damping', key: 'damping', min: 0, max: 1, default: 0.5 },
      { name: 'Bandwidth', key: 'bandwidth', min: 0, max: 1, default: 0.9 },
      { name: 'Feedback', key: 'feedback', min: 0, max: 0.99, default: 0.85 }
    ];
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    for (const delay of this.delayLines) {
      delay.disconnect();
    }
    for (const filter of this.dampingFilters) {
      filter.disconnect();
    }
    for (const gain of this.feedbackGains) {
      gain.disconnect();
    }
    for (const row of this.mixingGains) {
      for (const gain of row) {
        gain.disconnect();
      }
    }
    this.inputBandwidth.disconnect();
    this.inputGain.disconnect();
    this.outputGain.disconnect();
    
    super.dispose();
  }
}

// Factory function
export function createReverbSC(audioContext: AudioContext, id?: string): ReverbSC {
  return new ReverbSC(audioContext, id || `reverbsc-${Date.now()}`);
}