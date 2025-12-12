// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Dispersion - All-Pass Filter Chain Effect
 * Creates frequency-dependent delay using cascaded all-pass filters
 * 
 * Features:
 * - Multiple all-pass filters in series
 * - Amount control
 * - Frequency control
 * - Spread control
 */

import { BaseEffect, type EffectParameterDescriptor } from './BaseEffect';
import { clamp } from '../utils/AudioMath';

// ============================================================================
// Dispersion Effect
// ============================================================================

export class Dispersion extends BaseEffect {
  // All-pass filters
  private allPassFilters: BiquadFilterNode[] = [];
  private filterCount: number = 8;
  
  // Parameters
  private amount: number = 0.5;
  private frequency: number = 1000;
  private spread: number = 0.5;
  private feedback: number = 0;
  
  // Feedback path
  private feedbackGain: GainNode;
  private feedbackDelay: DelayNode;
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'Dispersion', 'dispersion');
    
    // Create feedback path
    this.feedbackGain = audioContext.createGain();
    this.feedbackGain.gain.value = 0;
    
    this.feedbackDelay = audioContext.createDelay(0.1);
    this.feedbackDelay.delayTime.value = 0.001;
    
    // Create all-pass filter chain
    this.createFilterChain();
    
    // Connect input to first filter
    this.inputNode.connect(this.allPassFilters[0]);
    
    // Connect last filter to wet output
    this.allPassFilters[this.filterCount - 1].connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
    
    // Connect feedback path
    this.allPassFilters[this.filterCount - 1].connect(this.feedbackDelay);
    this.feedbackDelay.connect(this.feedbackGain);
    this.feedbackGain.connect(this.allPassFilters[0]);
    
    // Initialize
    this.initializeEffect();
  }
  
  /**
   * Create all-pass filter chain
   */
  private createFilterChain(): void {
    for (let i = 0; i < this.filterCount; i++) {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'allpass';
      filter.frequency.value = this.frequency;
      filter.Q.value = 0.707;
      this.allPassFilters.push(filter);
      
      // Connect filters in series
      if (i > 0) {
        this.allPassFilters[i - 1].connect(filter);
      }
    }
  }
  
  /**
   * Update filter frequencies with spread
   */
  private updateFilters(): void {
    const currentTime = this.audioContext.currentTime;
    
    for (let i = 0; i < this.filterCount; i++) {
      // Calculate frequency for this filter with spread
      const spreadFactor = 1 + (i - this.filterCount / 2) * this.spread * 0.2;
      const freq = this.frequency * spreadFactor;
      
      // Clamp frequency to valid range
      const clampedFreq = clamp(freq, 20, 20000);
      
      this.allPassFilters[i].frequency.setTargetAtTime(clampedFreq, currentTime, 0.02);
      
      // Q affects the amount of phase shift
      const q = 0.5 + this.amount * 2;
      this.allPassFilters[i].Q.setTargetAtTime(q, currentTime, 0.02);
    }
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
      case 'amount':
        this.amount = value;
        this.updateFilters();
        break;
      case 'frequency':
        this.frequency = value;
        this.updateFilters();
        break;
      case 'spread':
        this.spread = value;
        this.updateFilters();
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
    this.params['amount'] = this.amount;
    this.params['frequency'] = this.frequency;
    this.params['spread'] = this.spread;
    this.params['feedback'] = this.feedback;
    
    this.updateFilters();
    this.updateFeedback();
    
    // Add presets
    this.addPresets();
  }
  
  /**
   * Add presets
   */
  private addPresets(): void {
    this.presets.push({
      name: 'Subtle',
      params: { amount: 0.3, frequency: 1000, spread: 0.3, feedback: 0 }
    });
    
    this.presets.push({
      name: 'Medium',
      params: { amount: 0.5, frequency: 800, spread: 0.5, feedback: 0.1 }
    });
    
    this.presets.push({
      name: 'Heavy',
      params: { amount: 0.8, frequency: 600, spread: 0.7, feedback: 0.2 }
    });
    
    this.presets.push({
      name: 'High Frequency',
      params: { amount: 0.5, frequency: 3000, spread: 0.4, feedback: 0 }
    });
    
    this.presets.push({
      name: 'Low Frequency',
      params: { amount: 0.6, frequency: 300, spread: 0.6, feedback: 0.15 }
    });
    
    this.presets.push({
      name: 'Resonant',
      params: { amount: 0.9, frequency: 1000, spread: 0.8, feedback: 0.3 }
    });
  }
  
  /**
   * Get parameter descriptors
   */
  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'Amount', key: 'amount', min: 0, max: 1, default: 0.5 },
      { name: 'Frequency', key: 'frequency', min: 20, max: 20000, default: 1000, unit: 'Hz', type: 'logarithmic' },
      { name: 'Spread', key: 'spread', min: 0, max: 1, default: 0.5 },
      { name: 'Feedback', key: 'feedback', min: 0, max: 0.9, default: 0 }
    ];
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    for (const filter of this.allPassFilters) {
      filter.disconnect();
    }
    this.feedbackGain.disconnect();
    this.feedbackDelay.disconnect();
    
    super.dispose();
  }
}

// Factory function
export function createDispersion(audioContext: AudioContext, id?: string): Dispersion {
  return new Dispersion(audioContext, id || `dispersion-${Date.now()}`);
}