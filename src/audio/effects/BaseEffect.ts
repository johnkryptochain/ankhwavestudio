// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * BaseEffect - Abstract base class for audio effects
 * Provides common functionality for all effects including wet/dry mix and bypass
 */

import type { EffectParams } from '../../types/audio';
import { clamp, equalPowerCrossfade } from '../utils/AudioMath';

/**
 * Effect parameter descriptor for UI generation
 */
export interface EffectParameterDescriptor {
  name: string;
  key: string;
  min: number;
  max: number;
  default: number;
  step?: number;
  unit?: string;
  type?: 'linear' | 'logarithmic' | 'boolean' | 'enum';
  enumValues?: string[];
}

/**
 * Effect preset interface
 */
export interface EffectPreset {
  name: string;
  params: Record<string, number>;
}

/**
 * Effect state change event
 */
export interface EffectStateEvent {
  type: 'paramChange' | 'bypass' | 'wetDry' | 'preset';
  effectId: string;
  data: unknown;
}

/**
 * Effect state change callback
 */
export type EffectStateCallback = (event: EffectStateEvent) => void;

/**
 * Abstract base class for all audio effects
 */
export abstract class BaseEffect {
  protected audioContext: AudioContext;
  protected id: string;
  protected name: string;
  protected type: string;
  
  // Audio nodes
  protected inputNode: GainNode;
  protected outputNode: GainNode;
  protected dryGain: GainNode;
  protected wetGain: GainNode;
  protected bypassNode: GainNode;
  
  // State
  protected enabled: boolean = true;
  protected bypassed: boolean = false;
  protected wetAmount: number = 1.0;
  protected params: Record<string, number> = {};
  
  // Presets
  protected presets: EffectPreset[] = [];
  protected currentPresetIndex: number = -1;
  
  // Event callbacks
  protected stateCallbacks: EffectStateCallback[] = [];

  constructor(audioContext: AudioContext, id: string, name: string, type: string) {
    this.audioContext = audioContext;
    this.id = id;
    this.name = name;
    this.type = type;
    
    // Create base audio nodes
    this.inputNode = audioContext.createGain();
    this.outputNode = audioContext.createGain();
    this.dryGain = audioContext.createGain();
    this.wetGain = audioContext.createGain();
    this.bypassNode = audioContext.createGain();
    
    // Set initial gains
    this.inputNode.gain.value = 1.0;
    this.outputNode.gain.value = 1.0;
    this.bypassNode.gain.value = 0.0; // Bypass off by default
    
    // Set up wet/dry mix (equal power crossfade)
    this.setWetDry(this.wetAmount);
    
    // Connect bypass path: input -> bypass -> output
    this.inputNode.connect(this.bypassNode);
    this.bypassNode.connect(this.outputNode);
    
    // Connect dry path: input -> dry -> output
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);
    
    // Wet path will be connected by subclasses through their effect chain
    // input -> [effect chain] -> wet -> output
  }

  /**
   * Get the effect ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get the effect name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Set the effect name
   */
  setName(name: string): void {
    this.name = name;
  }

  /**
   * Get the effect type
   */
  getType(): string {
    return this.type;
  }

  /**
   * Get the input node for connecting sources
   */
  getInput(): GainNode {
    return this.inputNode;
  }

  /**
   * Get the output node for connecting to destinations
   */
  getOutput(): GainNode {
    return this.outputNode;
  }

  /**
   * Connect the effect output to a destination
   */
  connect(destination: AudioNode): void {
    this.outputNode.connect(destination);
  }

  /**
   * Disconnect the effect output
   */
  disconnect(): void {
    this.outputNode.disconnect();
  }

  /**
   * Set wet/dry mix (0 = fully dry, 1 = fully wet)
   */
  setWetDry(wet: number): void {
    this.wetAmount = clamp(wet, 0, 1);
    
    // Use equal power crossfade for smooth mixing
    const [dryGain, wetGain] = equalPowerCrossfade(this.wetAmount);
    
    const currentTime = this.audioContext.currentTime;
    this.dryGain.gain.setTargetAtTime(dryGain, currentTime, 0.01);
    this.wetGain.gain.setTargetAtTime(wetGain, currentTime, 0.01);
    
    this.emitStateEvent({
      type: 'wetDry',
      effectId: this.id,
      data: { wet: this.wetAmount }
    });
  }

  /**
   * Get current wet/dry mix
   */
  getWetDry(): number {
    return this.wetAmount;
  }

  /**
   * Set bypass state
   */
  setBypass(bypassed: boolean): void {
    this.bypassed = bypassed;
    
    const currentTime = this.audioContext.currentTime;
    
    if (bypassed) {
      // Enable bypass: mute wet/dry, enable bypass
      this.dryGain.gain.setTargetAtTime(0, currentTime, 0.01);
      this.wetGain.gain.setTargetAtTime(0, currentTime, 0.01);
      this.bypassNode.gain.setTargetAtTime(1, currentTime, 0.01);
    } else {
      // Disable bypass: restore wet/dry, disable bypass
      this.bypassNode.gain.setTargetAtTime(0, currentTime, 0.01);
      this.setWetDry(this.wetAmount);
    }
    
    this.emitStateEvent({
      type: 'bypass',
      effectId: this.id,
      data: { bypassed }
    });
  }

  /**
   * Get bypass state
   */
  isBypassed(): boolean {
    return this.bypassed;
  }

  /**
   * Toggle bypass state
   */
  toggleBypass(): boolean {
    this.setBypass(!this.bypassed);
    return this.bypassed;
  }

  /**
   * Set enabled state
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    // When disabled, act as if bypassed
    if (!enabled) {
      this.setBypass(true);
    }
  }

  /**
   * Get enabled state
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set a parameter value
   */
  setParameter(key: string, value: number): void {
    const descriptor = this.getParameterDescriptors().find(d => d.key === key);
    if (descriptor) {
      const clampedValue = clamp(value, descriptor.min, descriptor.max);
      this.params[key] = clampedValue;
      this.onParameterChange(key, clampedValue);
      
      this.emitStateEvent({
        type: 'paramChange',
        effectId: this.id,
        data: { key, value: clampedValue }
      });
    }
  }

  /**
   * Get a parameter value
   */
  getParameter(key: string): number {
    return this.params[key] ?? 0;
  }

  /**
   * Get all parameters
   */
  getParameters(): Record<string, number> {
    return { ...this.params };
  }

  /**
   * Set multiple parameters at once
   */
  setParameters(params: Record<string, number>): void {
    for (const [key, value] of Object.entries(params)) {
      this.setParameter(key, value);
    }
  }

  /**
   * Get parameter descriptors for UI generation
   * Must be implemented by subclasses
   */
  abstract getParameterDescriptors(): EffectParameterDescriptor[];

  /**
   * Called when a parameter changes
   * Must be implemented by subclasses to update audio nodes
   */
  protected abstract onParameterChange(key: string, value: number): void;

  /**
   * Initialize the effect with default parameters
   * Must be implemented by subclasses
   */
  protected abstract initializeEffect(): void;

  /**
   * Add a preset
   */
  addPreset(preset: EffectPreset): void {
    this.presets.push(preset);
  }

  /**
   * Get all presets
   */
  getPresets(): EffectPreset[] {
    return [...this.presets];
  }

  /**
   * Load a preset by index
   */
  loadPreset(index: number): boolean {
    if (index < 0 || index >= this.presets.length) {
      return false;
    }
    
    const preset = this.presets[index];
    this.setParameters(preset.params);
    this.currentPresetIndex = index;
    
    this.emitStateEvent({
      type: 'preset',
      effectId: this.id,
      data: { index, name: preset.name }
    });
    
    return true;
  }

  /**
   * Load a preset by name
   */
  loadPresetByName(name: string): boolean {
    const index = this.presets.findIndex(p => p.name === name);
    return this.loadPreset(index);
  }

  /**
   * Save current settings as a preset
   */
  saveAsPreset(name: string): EffectPreset {
    const preset: EffectPreset = {
      name,
      params: { ...this.params }
    };
    this.presets.push(preset);
    return preset;
  }

  /**
   * Get current preset index (-1 if no preset loaded)
   */
  getCurrentPresetIndex(): number {
    return this.currentPresetIndex;
  }

  /**
   * Register a state change callback
   */
  onStateChange(callback: EffectStateCallback): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      const index = this.stateCallbacks.indexOf(callback);
      if (index !== -1) {
        this.stateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Emit a state change event
   */
  protected emitStateEvent(event: EffectStateEvent): void {
    for (const callback of this.stateCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in effect state callback:', error);
      }
    }
  }

  /**
   * Get effect state as serializable object
   */
  getState(): EffectParams {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      enabled: this.enabled,
      wet: this.wetAmount,
      params: { ...this.params }
    };
  }

  /**
   * Restore effect state from serialized object
   */
  setState(state: Partial<EffectParams>): void {
    if (state.enabled !== undefined) {
      this.setEnabled(state.enabled);
    }
    if (state.wet !== undefined) {
      this.setWetDry(state.wet);
    }
    if (state.params) {
      this.setParameters(state.params);
    }
  }

  /**
   * Reset effect to default state
   */
  reset(): void {
    const descriptors = this.getParameterDescriptors();
    for (const descriptor of descriptors) {
      this.setParameter(descriptor.key, descriptor.default);
    }
    this.setWetDry(1.0);
    this.setBypass(false);
    this.currentPresetIndex = -1;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.disconnect();
    
    // Disconnect all internal nodes
    this.inputNode.disconnect();
    this.dryGain.disconnect();
    this.wetGain.disconnect();
    this.bypassNode.disconnect();
    
    // Clear callbacks
    this.stateCallbacks = [];
  }
}

/**
 * Helper function to create a gain node with initial value
 */
export function createGainNode(context: AudioContext, gain: number = 1.0): GainNode {
  const node = context.createGain();
  node.gain.value = gain;
  return node;
}

/**
 * Helper function to connect nodes in series
 */
export function connectInSeries(...nodes: AudioNode[]): void {
  for (let i = 0; i < nodes.length - 1; i++) {
    nodes[i].connect(nodes[i + 1]);
  }
}