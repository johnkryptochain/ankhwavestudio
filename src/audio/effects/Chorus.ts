// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Chorus - Multi-voice chorus effect with LFO modulation
 * Based on original AnkhWaveStudio chorus effect
 */

import { BaseEffect, EffectParameterDescriptor } from './BaseEffect';
import { clamp } from '../utils/AudioMath';

/**
 * Chorus effect with multiple voices
 */
export class Chorus extends BaseEffect {
  // Delay nodes for each voice
  private delayNodes: DelayNode[] = [];
  private voiceGains: GainNode[] = [];
  
  // LFO for modulation
  private lfo: OscillatorNode;
  private lfoGains: GainNode[] = [];
  
  // Feedback
  private feedbackGain: GainNode;
  
  // Stereo processing
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  private panNodes: StereoPannerNode[] = [];
  
  // Voice count
  private voiceCount: number = 2;
  private static readonly MAX_VOICES = 4;
  private static readonly MAX_DELAY = 0.05; // 50ms max delay

  constructor(audioContext: AudioContext, id: string, name: string = 'Chorus') {
    super(audioContext, id, name, 'chorus');
    
    // Create LFO
    this.lfo = audioContext.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 1;
    this.lfo.start();
    
    // Create feedback
    this.feedbackGain = audioContext.createGain();
    this.feedbackGain.gain.value = 0;
    
    // Create stereo nodes
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    
    // Create voice nodes
    for (let i = 0; i < Chorus.MAX_VOICES; i++) {
      // Delay node
      const delay = audioContext.createDelay(Chorus.MAX_DELAY);
      delay.delayTime.value = 0.02;
      this.delayNodes.push(delay);
      
      // Voice gain
      const gain = audioContext.createGain();
      gain.gain.value = i < 2 ? 0.5 : 0;
      this.voiceGains.push(gain);
      
      // LFO gain (modulation depth per voice)
      const lfoGain = audioContext.createGain();
      lfoGain.gain.value = 0.002;
      this.lfoGains.push(lfoGain);
      
      // Pan node for stereo spread
      const pan = audioContext.createStereoPanner();
      pan.pan.value = 0;
      this.panNodes.push(pan);
    }
    
    this.initializeEffect();
    this.setupRouting();
    this.addDefaultPresets();
  }

  protected initializeEffect(): void {
    this.params = {
      voices: 2,
      delayTime: 20,      // ms
      lfoRate: 1,         // Hz
      lfoDepth: 0.5,      // 0-1
      feedback: 0,        // 0-0.9
      stereoSpread: 0.5,  // 0-1
      mix: 0.5            // 0-1
    };
    
    this.applyAllParameters();
  }

  private setupRouting(): void {
    // Connect LFO to all voice delay modulation
    for (let i = 0; i < Chorus.MAX_VOICES; i++) {
      this.lfo.connect(this.lfoGains[i]);
      this.lfoGains[i].connect(this.delayNodes[i].delayTime);
    }
    
    // Connect input to all voices
    for (let i = 0; i < Chorus.MAX_VOICES; i++) {
      this.inputNode.connect(this.delayNodes[i]);
      this.delayNodes[i].connect(this.voiceGains[i]);
      this.voiceGains[i].connect(this.panNodes[i]);
      this.panNodes[i].connect(this.wetGain);
    }
    
    // Feedback path (from first voice back to input)
    this.delayNodes[0].connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNodes[0]);
    
    // Connect wet to output
    this.wetGain.connect(this.outputNode);
  }

  private applyAllParameters(): void {
    const t = this.audioContext.currentTime;
    
    // Update voice count
    this.voiceCount = Math.floor(clamp(this.params.voices, 2, Chorus.MAX_VOICES));
    
    // Base delay time in seconds
    const baseDelay = this.params.delayTime / 1000;
    
    // LFO rate
    this.lfo.frequency.setTargetAtTime(clamp(this.params.lfoRate, 0.01, 10), t, 0.01);
    
    // LFO depth (in seconds)
    const depthSeconds = this.params.lfoDepth * 0.01; // Max 10ms modulation
    
    // Configure each voice
    for (let i = 0; i < Chorus.MAX_VOICES; i++) {
      const isActive = i < this.voiceCount;
      
      // Voice gain
      const voiceGain = isActive ? (1 / this.voiceCount) : 0;
      this.voiceGains[i].gain.setTargetAtTime(voiceGain, t, 0.01);
      
      if (isActive) {
        // Slightly different delay time per voice for richness
        const voiceDelay = baseDelay + (i * 0.002);
        this.delayNodes[i].delayTime.setTargetAtTime(
          clamp(voiceDelay, 0.001, Chorus.MAX_DELAY),
          t,
          0.01
        );
        
        // Different LFO phase per voice (achieved by different depth)
        const phaseOffset = (i / this.voiceCount) * Math.PI * 2;
        const voiceDepth = depthSeconds * (1 + Math.sin(phaseOffset) * 0.3);
        this.lfoGains[i].gain.setTargetAtTime(voiceDepth, t, 0.01);
        
        // Stereo spread
        const spread = this.params.stereoSpread;
        const panPosition = spread * ((i / (this.voiceCount - 1)) * 2 - 1);
        this.panNodes[i].pan.setTargetAtTime(
          clamp(panPosition, -1, 1),
          t,
          0.01
        );
      }
    }
    
    // Feedback
    this.feedbackGain.gain.setTargetAtTime(
      clamp(this.params.feedback, 0, 0.9),
      t,
      0.01
    );
    
    // Mix
    this.setWetDry(this.params.mix);
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'Voices', key: 'voices', min: 2, max: 4, default: 2, step: 1, type: 'linear' },
      { name: 'Delay Time', key: 'delayTime', min: 5, max: 50, default: 20, unit: 'ms', type: 'linear' },
      { name: 'LFO Rate', key: 'lfoRate', min: 0.01, max: 10, default: 1, unit: 'Hz', type: 'logarithmic' },
      { name: 'LFO Depth', key: 'lfoDepth', min: 0, max: 1, default: 0.5, type: 'linear' },
      { name: 'Feedback', key: 'feedback', min: 0, max: 0.9, default: 0, type: 'linear' },
      { name: 'Stereo Spread', key: 'stereoSpread', min: 0, max: 1, default: 0.5, type: 'linear' },
      { name: 'Mix', key: 'mix', min: 0, max: 1, default: 0.5, type: 'linear' }
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    this.applyAllParameters();
  }

  /**
   * Set number of voices
   */
  setVoices(count: number): void {
    this.setParameter('voices', count);
  }

  /**
   * Get number of active voices
   */
  getVoices(): number {
    return this.voiceCount;
  }

  /**
   * Set delay time in milliseconds
   */
  setDelayTime(ms: number): void {
    this.setParameter('delayTime', ms);
  }

  /**
   * Set LFO rate in Hz
   */
  setLfoRate(hz: number): void {
    this.setParameter('lfoRate', hz);
  }

  /**
   * Set LFO depth (0-1)
   */
  setLfoDepth(depth: number): void {
    this.setParameter('lfoDepth', depth);
  }

  /**
   * Set feedback amount (0-0.9)
   */
  setFeedback(feedback: number): void {
    this.setParameter('feedback', feedback);
  }

  /**
   * Set stereo spread (0-1)
   */
  setStereoSpread(spread: number): void {
    this.setParameter('stereoSpread', spread);
  }

  private addDefaultPresets(): void {
    this.addPreset({
      name: 'Subtle',
      params: { voices: 2, delayTime: 15, lfoRate: 0.5, lfoDepth: 0.3, feedback: 0, stereoSpread: 0.3, mix: 0.3 }
    });
    
    this.addPreset({
      name: 'Classic',
      params: { voices: 2, delayTime: 20, lfoRate: 1, lfoDepth: 0.5, feedback: 0.1, stereoSpread: 0.5, mix: 0.5 }
    });
    
    this.addPreset({
      name: 'Rich',
      params: { voices: 4, delayTime: 25, lfoRate: 0.8, lfoDepth: 0.6, feedback: 0.2, stereoSpread: 0.8, mix: 0.5 }
    });
    
    this.addPreset({
      name: 'Wide',
      params: { voices: 3, delayTime: 30, lfoRate: 0.6, lfoDepth: 0.7, feedback: 0.15, stereoSpread: 1, mix: 0.6 }
    });
    
    this.addPreset({
      name: 'Fast Shimmer',
      params: { voices: 2, delayTime: 10, lfoRate: 5, lfoDepth: 0.4, feedback: 0.3, stereoSpread: 0.5, mix: 0.4 }
    });
    
    this.addPreset({
      name: 'Slow & Deep',
      params: { voices: 4, delayTime: 35, lfoRate: 0.2, lfoDepth: 0.8, feedback: 0.25, stereoSpread: 0.7, mix: 0.5 }
    });
  }

  dispose(): void {
    super.dispose();
    
    this.lfo.stop();
    this.lfo.disconnect();
    
    for (let i = 0; i < Chorus.MAX_VOICES; i++) {
      this.delayNodes[i].disconnect();
      this.voiceGains[i].disconnect();
      this.lfoGains[i].disconnect();
      this.panNodes[i].disconnect();
    }
    
    this.feedbackGain.disconnect();
    this.splitter.disconnect();
    this.merger.disconnect();
  }
}