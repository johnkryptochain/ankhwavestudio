// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * MultitapEcho - Multi-tap delay effect with per-tap controls
 * Based on original AnkhWaveStudio MultitapEcho plugin
 */

import { BaseEffect, EffectParameterDescriptor } from './BaseEffect';
import { clamp, bpmToMs } from '../utils/AudioMath';

/**
 * Configuration for a single delay tap
 */
export interface TapConfig {
  enabled: boolean;
  delayTime: number;      // 0-2000ms
  volume: number;         // 0-1
  pan: number;            // -1 to 1
  feedback: number;       // 0-0.95
  filterFreq: number;     // 200-20000 Hz
}

/**
 * Default tap configuration
 */
const DEFAULT_TAP: TapConfig = {
  enabled: true,
  delayTime: 250,
  volume: 0.5,
  pan: 0,
  feedback: 0.3,
  filterFreq: 8000
};

/**
 * Maximum number of taps supported
 */
export const MAX_TAPS = 8;

/**
 * Maximum delay time in seconds
 */
const MAX_DELAY_TIME = 5.0;

/**
 * MultitapEcho effect with up to 8 independent delay taps
 */
export class MultitapEcho extends BaseEffect {
  // Per-tap nodes
  private delayNodes: DelayNode[] = [];
  private gainNodes: GainNode[] = [];
  private panNodes: StereoPannerNode[] = [];
  private feedbackNodes: GainNode[] = [];
  private filterNodes: BiquadFilterNode[] = [];
  
  // Mixing
  private tapMixer: GainNode;
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  
  // Tap configurations
  private taps: TapConfig[] = [];
  
  // Tempo sync
  private currentBpm: number = 120;
  private tempoSync: boolean = false;

  constructor(audioContext: AudioContext, id: string, name: string = 'MultitapEcho') {
    super(audioContext, id, name, 'multitapecho');
    
    // Create mixer node
    this.tapMixer = audioContext.createGain();
    this.tapMixer.gain.value = 1.0;
    
    // Create splitter and merger for stereo processing
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    
    // Initialize taps
    this.initializeTaps();
    this.initializeEffect();
    this.setupRouting();
    this.addDefaultPresets();
  }

  /**
   * Initialize all tap nodes
   */
  private initializeTaps(): void {
    for (let i = 0; i < MAX_TAPS; i++) {
      // Create nodes for this tap
      const delayNode = this.audioContext.createDelay(MAX_DELAY_TIME);
      const gainNode = this.audioContext.createGain();
      const panNode = this.audioContext.createStereoPanner();
      const feedbackNode = this.audioContext.createGain();
      const filterNode = this.audioContext.createBiquadFilter();
      
      // Configure filter
      filterNode.type = 'lowpass';
      filterNode.frequency.value = 8000;
      filterNode.Q.value = 0.707;
      
      // Store nodes
      this.delayNodes.push(delayNode);
      this.gainNodes.push(gainNode);
      this.panNodes.push(panNode);
      this.feedbackNodes.push(feedbackNode);
      this.filterNodes.push(filterNode);
      
      // Initialize tap config with staggered delay times
      this.taps.push({
        ...DEFAULT_TAP,
        delayTime: (i + 1) * 125, // 125ms, 250ms, 375ms, etc.
        volume: Math.max(0.1, 0.8 - i * 0.1), // Decreasing volume
        pan: (i % 2 === 0 ? -1 : 1) * (i * 0.15), // Alternating pan
        enabled: i < 4 // Only first 4 taps enabled by default
      });
    }
  }

  /**
   * Set up audio routing
   */
  private setupRouting(): void {
    // Connect each tap
    for (let i = 0; i < MAX_TAPS; i++) {
      // Input -> Delay -> Filter -> Gain -> Pan -> Mixer
      this.inputNode.connect(this.delayNodes[i]);
      this.delayNodes[i].connect(this.filterNodes[i]);
      this.filterNodes[i].connect(this.gainNodes[i]);
      this.gainNodes[i].connect(this.panNodes[i]);
      this.panNodes[i].connect(this.tapMixer);
      
      // Feedback path: Filter -> Feedback Gain -> Delay
      this.filterNodes[i].connect(this.feedbackNodes[i]);
      this.feedbackNodes[i].connect(this.delayNodes[i]);
    }
    
    // Mixer -> Wet -> Output
    this.tapMixer.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  protected initializeEffect(): void {
    this.params = {
      wet: 0.5,
      tempoSync: 0,
      masterFeedback: 0.3
    };
    
    // Apply initial tap settings
    this.applyAllTaps();
  }

  /**
   * Apply settings for all taps
   */
  private applyAllTaps(): void {
    for (let i = 0; i < MAX_TAPS; i++) {
      this.applyTapSettings(i);
    }
  }

  /**
   * Apply settings for a specific tap
   */
  private applyTapSettings(tapIndex: number): void {
    if (tapIndex < 0 || tapIndex >= MAX_TAPS) return;
    
    const tap = this.taps[tapIndex];
    const t = this.audioContext.currentTime;
    
    // Calculate delay time (with tempo sync if enabled)
    let delayTime = tap.delayTime / 1000; // Convert to seconds
    if (this.tempoSync) {
      // Quantize to beat divisions
      const beatMs = 60000 / this.currentBpm;
      const divisions = [0.0625, 0.125, 0.25, 0.5, 1, 2]; // 1/16 to 2 beats
      const closestDivision = divisions.reduce((prev, curr) => 
        Math.abs(curr * beatMs - tap.delayTime) < Math.abs(prev * beatMs - tap.delayTime) ? curr : prev
      );
      delayTime = (closestDivision * beatMs) / 1000;
    }
    
    // Apply delay time
    this.delayNodes[tapIndex].delayTime.setTargetAtTime(
      clamp(delayTime, 0.001, MAX_DELAY_TIME),
      t,
      0.01
    );
    
    // Apply volume (0 if disabled)
    this.gainNodes[tapIndex].gain.setTargetAtTime(
      tap.enabled ? clamp(tap.volume, 0, 1) : 0,
      t,
      0.01
    );
    
    // Apply pan
    this.panNodes[tapIndex].pan.setTargetAtTime(
      clamp(tap.pan, -1, 1),
      t,
      0.01
    );
    
    // Apply feedback
    this.feedbackNodes[tapIndex].gain.setTargetAtTime(
      clamp(tap.feedback, 0, 0.95),
      t,
      0.01
    );
    
    // Apply filter frequency
    this.filterNodes[tapIndex].frequency.setTargetAtTime(
      clamp(tap.filterFreq, 200, 20000),
      t,
      0.01
    );
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'Wet Mix', key: 'wet', min: 0, max: 1, default: 0.5, type: 'linear' },
      { name: 'Tempo Sync', key: 'tempoSync', min: 0, max: 1, default: 0, type: 'boolean' },
      { name: 'Master Feedback', key: 'masterFeedback', min: 0, max: 0.95, default: 0.3, type: 'linear' }
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    if (key === 'wet') {
      this.setWetDry(value);
    } else if (key === 'tempoSync') {
      this.tempoSync = value > 0.5;
      this.applyAllTaps();
    } else if (key === 'masterFeedback') {
      // Apply master feedback to all taps
      for (let i = 0; i < MAX_TAPS; i++) {
        this.taps[i].feedback = value;
        this.applyTapSettings(i);
      }
    }
  }

  /**
   * Get tap configuration
   */
  getTap(index: number): TapConfig | null {
    if (index < 0 || index >= MAX_TAPS) return null;
    return { ...this.taps[index] };
  }

  /**
   * Get all tap configurations
   */
  getAllTaps(): TapConfig[] {
    return this.taps.map(tap => ({ ...tap }));
  }

  /**
   * Set tap configuration
   */
  setTap(index: number, config: Partial<TapConfig>): void {
    if (index < 0 || index >= MAX_TAPS) return;
    
    this.taps[index] = {
      ...this.taps[index],
      ...config
    };
    
    this.applyTapSettings(index);
  }

  /**
   * Enable or disable a tap
   */
  setTapEnabled(index: number, enabled: boolean): void {
    if (index < 0 || index >= MAX_TAPS) return;
    this.taps[index].enabled = enabled;
    this.applyTapSettings(index);
  }

  /**
   * Set tap delay time
   */
  setTapDelayTime(index: number, delayMs: number): void {
    if (index < 0 || index >= MAX_TAPS) return;
    this.taps[index].delayTime = clamp(delayMs, 1, 2000);
    this.applyTapSettings(index);
  }

  /**
   * Set tap volume
   */
  setTapVolume(index: number, volume: number): void {
    if (index < 0 || index >= MAX_TAPS) return;
    this.taps[index].volume = clamp(volume, 0, 1);
    this.applyTapSettings(index);
  }

  /**
   * Set tap pan
   */
  setTapPan(index: number, pan: number): void {
    if (index < 0 || index >= MAX_TAPS) return;
    this.taps[index].pan = clamp(pan, -1, 1);
    this.applyTapSettings(index);
  }

  /**
   * Set tap feedback
   */
  setTapFeedback(index: number, feedback: number): void {
    if (index < 0 || index >= MAX_TAPS) return;
    this.taps[index].feedback = clamp(feedback, 0, 0.95);
    this.applyTapSettings(index);
  }

  /**
   * Set tap filter frequency
   */
  setTapFilterFreq(index: number, freq: number): void {
    if (index < 0 || index >= MAX_TAPS) return;
    this.taps[index].filterFreq = clamp(freq, 200, 20000);
    this.applyTapSettings(index);
  }

  /**
   * Set tempo for sync
   */
  setTempo(bpm: number): void {
    this.currentBpm = clamp(bpm, 20, 999);
    if (this.tempoSync) {
      this.applyAllTaps();
    }
  }

  /**
   * Get current tempo
   */
  getTempo(): number {
    return this.currentBpm;
  }

  /**
   * Check if tempo sync is enabled
   */
  isTempoSyncEnabled(): boolean {
    return this.tempoSync;
  }

  /**
   * Set tempo sync
   */
  setTempoSync(enabled: boolean): void {
    this.tempoSync = enabled;
    this.params.tempoSync = enabled ? 1 : 0;
    this.applyAllTaps();
  }

  /**
   * Get number of enabled taps
   */
  getEnabledTapCount(): number {
    return this.taps.filter(tap => tap.enabled).length;
  }

  private addDefaultPresets(): void {
    this.addPreset({
      name: 'Simple Echo',
      params: { wet: 0.4, tempoSync: 0, masterFeedback: 0.3 }
    });
    
    this.addPreset({
      name: 'Ping Pong',
      params: { wet: 0.5, tempoSync: 0, masterFeedback: 0.4 }
    });
    
    this.addPreset({
      name: 'Rhythmic',
      params: { wet: 0.5, tempoSync: 1, masterFeedback: 0.35 }
    });
    
    this.addPreset({
      name: 'Ambient Wash',
      params: { wet: 0.6, tempoSync: 0, masterFeedback: 0.6 }
    });
    
    this.addPreset({
      name: 'Slapback',
      params: { wet: 0.3, tempoSync: 0, masterFeedback: 0.1 }
    });
  }

  /**
   * Load a tap preset configuration
   */
  loadTapPreset(presetName: string): void {
    switch (presetName) {
      case 'pingpong':
        // Alternating left-right delays
        for (let i = 0; i < MAX_TAPS; i++) {
          this.setTap(i, {
            enabled: i < 4,
            delayTime: (i + 1) * 150,
            volume: 0.7 - i * 0.15,
            pan: i % 2 === 0 ? -0.8 : 0.8,
            feedback: 0.3,
            filterFreq: 6000
          });
        }
        break;
        
      case 'rhythmic':
        // Syncopated rhythm
        const rhythmTimes = [125, 250, 375, 500, 625, 750, 875, 1000];
        for (let i = 0; i < MAX_TAPS; i++) {
          this.setTap(i, {
            enabled: i < 6,
            delayTime: rhythmTimes[i],
            volume: i % 2 === 0 ? 0.6 : 0.4,
            pan: (i - 3.5) * 0.2,
            feedback: 0.2,
            filterFreq: 8000
          });
        }
        break;
        
      case 'ambient':
        // Long, diffuse delays
        for (let i = 0; i < MAX_TAPS; i++) {
          this.setTap(i, {
            enabled: true,
            delayTime: 200 + i * 250,
            volume: 0.4 - i * 0.04,
            pan: Math.sin(i * 0.8) * 0.6,
            feedback: 0.5,
            filterFreq: 3000 - i * 200
          });
        }
        break;
        
      case 'slapback':
        // Quick single slap
        for (let i = 0; i < MAX_TAPS; i++) {
          this.setTap(i, {
            enabled: i === 0,
            delayTime: 80,
            volume: 0.5,
            pan: 0,
            feedback: 0.1,
            filterFreq: 10000
          });
        }
        break;
        
      default:
        // Reset to default
        for (let i = 0; i < MAX_TAPS; i++) {
          this.setTap(i, {
            ...DEFAULT_TAP,
            delayTime: (i + 1) * 125,
            volume: Math.max(0.1, 0.8 - i * 0.1),
            pan: (i % 2 === 0 ? -1 : 1) * (i * 0.15),
            enabled: i < 4
          });
        }
    }
  }

  dispose(): void {
    super.dispose();
    
    // Disconnect all tap nodes
    for (let i = 0; i < MAX_TAPS; i++) {
      this.delayNodes[i].disconnect();
      this.gainNodes[i].disconnect();
      this.panNodes[i].disconnect();
      this.feedbackNodes[i].disconnect();
      this.filterNodes[i].disconnect();
    }
    
    this.tapMixer.disconnect();
    this.splitter.disconnect();
    this.merger.disconnect();
  }
}