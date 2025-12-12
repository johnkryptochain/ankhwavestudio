// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * StereoMatrix - 2x2 matrix for stereo manipulation
 * Based on original AnkhWaveStudio StereoMatrix plugin
 */

import { BaseEffect, EffectParameterDescriptor } from './BaseEffect';
import { clamp } from '../utils/AudioMath';

/**
 * StereoMatrix effect for stereo field manipulation
 */
export class StereoMatrix extends BaseEffect {
  // Channel splitter and merger
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  
  // Matrix gain nodes
  private llGain: GainNode;  // Left to Left
  private lrGain: GainNode;  // Left to Right
  private rlGain: GainNode;  // Right to Left
  private rrGain: GainNode;  // Right to Right
  
  // Summing nodes for each output channel
  private leftSum: GainNode;
  private rightSum: GainNode;

  constructor(audioContext: AudioContext, id: string, name: string = 'StereoMatrix') {
    super(audioContext, id, name, 'stereomatrix');
    
    // Create splitter and merger
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    
    // Create matrix gain nodes
    this.llGain = audioContext.createGain();
    this.lrGain = audioContext.createGain();
    this.rlGain = audioContext.createGain();
    this.rrGain = audioContext.createGain();
    
    // Create summing nodes
    this.leftSum = audioContext.createGain();
    this.rightSum = audioContext.createGain();
    
    this.initializeEffect();
    this.setupRouting();
    this.addDefaultPresets();
  }

  protected initializeEffect(): void {
    this.params = {
      ll: 1,    // Left to Left
      lr: 0,    // Left to Right
      rl: 0,    // Right to Left
      rr: 1     // Right to Right
    };
    
    this.applyMatrix();
  }

  private setupRouting(): void {
    // Split input into L and R
    this.inputNode.connect(this.splitter);
    
    // Left input to matrix
    this.splitter.connect(this.llGain, 0);  // L -> LL
    this.splitter.connect(this.lrGain, 0);  // L -> LR
    
    // Right input to matrix
    this.splitter.connect(this.rlGain, 1);  // R -> RL
    this.splitter.connect(this.rrGain, 1);  // R -> RR
    
    // Sum to left output: LL + RL
    this.llGain.connect(this.leftSum);
    this.rlGain.connect(this.leftSum);
    
    // Sum to right output: LR + RR
    this.lrGain.connect(this.rightSum);
    this.rrGain.connect(this.rightSum);
    
    // Merge back to stereo
    this.leftSum.connect(this.merger, 0, 0);
    this.rightSum.connect(this.merger, 0, 1);
    
    // Connect to wet output
    this.merger.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  private applyMatrix(): void {
    const t = this.audioContext.currentTime;
    
    this.llGain.gain.setTargetAtTime(clamp(this.params.ll, -2, 2), t, 0.01);
    this.lrGain.gain.setTargetAtTime(clamp(this.params.lr, -2, 2), t, 0.01);
    this.rlGain.gain.setTargetAtTime(clamp(this.params.rl, -2, 2), t, 0.01);
    this.rrGain.gain.setTargetAtTime(clamp(this.params.rr, -2, 2), t, 0.01);
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'L → L', key: 'll', min: -2, max: 2, default: 1, type: 'linear' },
      { name: 'L → R', key: 'lr', min: -2, max: 2, default: 0, type: 'linear' },
      { name: 'R → L', key: 'rl', min: -2, max: 2, default: 0, type: 'linear' },
      { name: 'R → R', key: 'rr', min: -2, max: 2, default: 1, type: 'linear' }
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    this.applyMatrix();
  }

  /**
   * Set the entire matrix at once
   */
  setMatrix(ll: number, lr: number, rl: number, rr: number): void {
    this.params.ll = clamp(ll, -2, 2);
    this.params.lr = clamp(lr, -2, 2);
    this.params.rl = clamp(rl, -2, 2);
    this.params.rr = clamp(rr, -2, 2);
    this.applyMatrix();
  }

  /**
   * Get the current matrix values
   */
  getMatrix(): { ll: number; lr: number; rl: number; rr: number } {
    return {
      ll: this.params.ll,
      lr: this.params.lr,
      rl: this.params.rl,
      rr: this.params.rr
    };
  }

  /**
   * Apply a preset matrix configuration
   */
  applyPresetMatrix(preset: string): void {
    switch (preset) {
      case 'stereo':
        // Normal stereo (identity matrix)
        this.setMatrix(1, 0, 0, 1);
        break;
        
      case 'mono':
        // Mono (sum L+R to both channels)
        this.setMatrix(0.5, 0.5, 0.5, 0.5);
        break;
        
      case 'swap':
        // Swap channels
        this.setMatrix(0, 1, 1, 0);
        break;
        
      case 'leftOnly':
        // Left channel only
        this.setMatrix(1, 1, 0, 0);
        break;
        
      case 'rightOnly':
        // Right channel only
        this.setMatrix(0, 0, 1, 1);
        break;
        
      case 'wide':
        // Wider stereo
        this.setMatrix(1.2, -0.2, -0.2, 1.2);
        break;
        
      case 'narrow':
        // Narrower stereo
        this.setMatrix(0.7, 0.3, 0.3, 0.7);
        break;
        
      case 'midSide':
        // Mid/Side encoding
        this.setMatrix(0.5, 0.5, 0.5, -0.5);
        break;
        
      case 'sideOnly':
        // Side signal only (difference)
        this.setMatrix(0.5, -0.5, -0.5, 0.5);
        break;
        
      case 'midOnly':
        // Mid signal only (sum)
        this.setMatrix(0.5, 0.5, 0.5, 0.5);
        break;
        
      case 'invertLeft':
        // Invert left channel phase
        this.setMatrix(-1, 0, 0, 1);
        break;
        
      case 'invertRight':
        // Invert right channel phase
        this.setMatrix(1, 0, 0, -1);
        break;
        
      case 'invertBoth':
        // Invert both channels
        this.setMatrix(-1, 0, 0, -1);
        break;
        
      default:
        // Default to stereo
        this.setMatrix(1, 0, 0, 1);
    }
  }

  /**
   * Set stereo width (0 = mono, 1 = normal, 2 = extra wide)
   */
  setStereoWidth(width: number): void {
    const w = clamp(width, 0, 2);
    const mid = 1 - w * 0.5;
    const side = w * 0.5;
    
    this.setMatrix(
      mid + side,  // LL
      mid - side,  // LR
      mid - side,  // RL
      mid + side   // RR
    );
  }

  /**
   * Get current stereo width (approximate)
   */
  getStereoWidth(): number {
    const ll = this.params.ll;
    const lr = this.params.lr;
    
    // Estimate width from matrix values
    if (ll === lr) return 0; // Mono
    if (lr === 0) return 1;  // Normal stereo
    
    return clamp((ll - lr) / ll, 0, 2);
  }

  private addDefaultPresets(): void {
    this.addPreset({
      name: 'Stereo',
      params: { ll: 1, lr: 0, rl: 0, rr: 1 }
    });
    
    this.addPreset({
      name: 'Mono',
      params: { ll: 0.5, lr: 0.5, rl: 0.5, rr: 0.5 }
    });
    
    this.addPreset({
      name: 'Swap Channels',
      params: { ll: 0, lr: 1, rl: 1, rr: 0 }
    });
    
    this.addPreset({
      name: 'Wide Stereo',
      params: { ll: 1.2, lr: -0.2, rl: -0.2, rr: 1.2 }
    });
    
    this.addPreset({
      name: 'Narrow Stereo',
      params: { ll: 0.7, lr: 0.3, rl: 0.3, rr: 0.7 }
    });
    
    this.addPreset({
      name: 'Left Only',
      params: { ll: 1, lr: 1, rl: 0, rr: 0 }
    });
    
    this.addPreset({
      name: 'Right Only',
      params: { ll: 0, lr: 0, rl: 1, rr: 1 }
    });
    
    this.addPreset({
      name: 'Mid/Side',
      params: { ll: 0.5, lr: 0.5, rl: 0.5, rr: -0.5 }
    });
    
    this.addPreset({
      name: 'Side Only',
      params: { ll: 0.5, lr: -0.5, rl: -0.5, rr: 0.5 }
    });
  }

  dispose(): void {
    super.dispose();
    
    this.splitter.disconnect();
    this.merger.disconnect();
    this.llGain.disconnect();
    this.lrGain.disconnect();
    this.rlGain.disconnect();
    this.rrGain.disconnect();
    this.leftSum.disconnect();
    this.rightSum.disconnect();
  }
}