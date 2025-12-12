// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * MixerChannel - Represents a single mixer channel
 * Handles volume, pan, mute, solo, and effect chain with proper gain staging
 */

import type { EffectParams, MixerSend } from '../types/audio';
import { dBToLinear, linearToDb, clamp, calculatePeak, calculateRMS } from './utils/AudioMath';

/**
 * Channel state change event
 */
export interface ChannelStateEvent {
  type: 'volume' | 'pan' | 'mute' | 'solo' | 'effect' | 'send';
  channelId: string;
  data: unknown;
}

export type ChannelStateCallback = (event: ChannelStateEvent) => void;

/**
 * VU meter data
 */
export interface VUMeterData {
  peakL: number;
  peakR: number;
  rmsL: number;
  rmsR: number;
  peakHoldL: number;
  peakHoldR: number;
}

export class MixerChannel {
  private audioContext: AudioContext;
  private id: string;
  private name: string;
  
  // Audio nodes - proper gain staging order
  private inputGain: GainNode;           // Input trim
  private highPassFilter: BiquadFilterNode; // HP filter for rumble removal
  private preEffectGain: GainNode;       // Pre-fader level
  private effectChainInput: GainNode;    // Effect chain input
  private effectChainOutput: GainNode;   // Effect chain output
  private postEffectGain: GainNode;      // Post-effect level
  private pannerNode: StereoPannerNode;  // Stereo panning
  private faderGain: GainNode;           // Main fader
  private muteGain: GainNode;            // Mute control
  private outputGain: GainNode;          // Final output
  private analyserL: AnalyserNode;       // Left channel analysis
  private analyserR: AnalyserNode;       // Right channel analysis
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  
  // State
  private volume: number = 1.0;          // Linear gain (0-1 maps to -inf to 0dB)
  private volumeDb: number = 0;          // Volume in dB
  private pan: number = 0;               // -1 (left) to 1 (right)
  private muted: boolean = false;
  private soloed: boolean = false;
  private inputTrim: number = 1.0;       // Input gain trim
  private highPassEnabled: boolean = false;
  private highPassFreq: number = 80;     // HP filter frequency
  
  // Effects
  private effects: EffectParams[] = [];
  private effectNodes: AudioNode[] = [];
  
  // Sends
  private sends: MixerSend[] = [];
  private sendNodes: Map<string, GainNode> = new Map();
  
  // Metering
  private vuData: VUMeterData = {
    peakL: 0, peakR: 0, rmsL: 0, rmsR: 0, peakHoldL: 0, peakHoldR: 0
  };
  private peakHoldTime: number = 1500; // ms
  private peakHoldTimerL: number | null = null;
  private peakHoldTimerR: number | null = null;
  private meterUpdateInterval: number | null = null;
  
  // Callbacks
  private stateCallbacks: ChannelStateCallback[] = [];

  constructor(audioContext: AudioContext, id: string, name: string) {
    this.audioContext = audioContext;
    this.id = id;
    this.name = name;
    
    // Create all audio nodes
    this.inputGain = audioContext.createGain();
    this.highPassFilter = audioContext.createBiquadFilter();
    this.preEffectGain = audioContext.createGain();
    this.effectChainInput = audioContext.createGain();
    this.effectChainOutput = audioContext.createGain();
    this.postEffectGain = audioContext.createGain();
    this.pannerNode = audioContext.createStereoPanner();
    this.faderGain = audioContext.createGain();
    this.muteGain = audioContext.createGain();
    this.outputGain = audioContext.createGain();
    
    // Configure high-pass filter
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = this.highPassFreq;
    this.highPassFilter.Q.value = 0.707;
    
    // Create analysers for metering
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    this.analyserL = audioContext.createAnalyser();
    this.analyserR = audioContext.createAnalyser();
    this.analyserL.fftSize = 256;
    this.analyserR.fftSize = 256;
    this.analyserL.smoothingTimeConstant = 0.3;
    this.analyserR.smoothingTimeConstant = 0.3;
    
    // Set initial gains
    this.inputGain.gain.value = this.inputTrim;
    this.preEffectGain.gain.value = 1.0;
    this.effectChainInput.gain.value = 1.0;
    this.effectChainOutput.gain.value = 1.0;
    this.postEffectGain.gain.value = 1.0;
    this.faderGain.gain.value = this.volume;
    this.muteGain.gain.value = 1.0;
    this.outputGain.gain.value = 1.0;
    
    // Connect the signal chain
    this.connectSignalChain();
    
    // Start metering
    this.startMetering();
  }

  /**
   * Connect the internal signal chain
   */
  private connectSignalChain(): void {
    // Main signal path
    this.inputGain.connect(this.highPassFilter);
    this.highPassFilter.connect(this.preEffectGain);
    this.preEffectGain.connect(this.effectChainInput);
    this.effectChainInput.connect(this.effectChainOutput); // Direct connection when no effects
    this.effectChainOutput.connect(this.postEffectGain);
    this.postEffectGain.connect(this.pannerNode);
    this.pannerNode.connect(this.faderGain);
    this.faderGain.connect(this.muteGain);
    this.muteGain.connect(this.outputGain);
    
    // Metering path (post-fader)
    this.outputGain.connect(this.splitter);
    this.splitter.connect(this.analyserL, 0);
    this.splitter.connect(this.analyserR, 1);
  }

  /**
   * Start the metering update loop
   */
  private startMetering(): void {
    const updateMeters = () => {
      const dataL = new Float32Array(this.analyserL.fftSize);
      const dataR = new Float32Array(this.analyserR.fftSize);
      this.analyserL.getFloatTimeDomainData(dataL);
      this.analyserR.getFloatTimeDomainData(dataR);
      
      const peakL = calculatePeak(dataL);
      const peakR = calculatePeak(dataR);
      const rmsL = calculateRMS(dataL);
      const rmsR = calculateRMS(dataR);
      
      this.vuData.peakL = peakL;
      this.vuData.peakR = peakR;
      this.vuData.rmsL = rmsL;
      this.vuData.rmsR = rmsR;
      
      // Update peak hold
      if (peakL > this.vuData.peakHoldL) {
        this.vuData.peakHoldL = peakL;
        if (this.peakHoldTimerL) clearTimeout(this.peakHoldTimerL);
        this.peakHoldTimerL = window.setTimeout(() => {
          this.vuData.peakHoldL = 0;
        }, this.peakHoldTime);
      }
      
      if (peakR > this.vuData.peakHoldR) {
        this.vuData.peakHoldR = peakR;
        if (this.peakHoldTimerR) clearTimeout(this.peakHoldTimerR);
        this.peakHoldTimerR = window.setTimeout(() => {
          this.vuData.peakHoldR = 0;
        }, this.peakHoldTime);
      }
    };
    
    this.meterUpdateInterval = window.setInterval(updateMeters, 50);
  }

  /** Get the channel ID */
  public getId(): string { return this.id; }

  /** Get the channel name */
  public getName(): string { return this.name; }

  /** Set the channel name */
  public setName(name: string): void { this.name = name; }

  /** Get the input node (for connecting sources) */
  public getInput(): GainNode {
    console.log(`[MixerChannel] getInput() called for channel: ${this.name}`);
    return this.inputGain;
  }

  /** Get the output node (for connecting to destination) */
  public getOutput(): GainNode { return this.outputGain; }

  /** Connect the channel output to a destination */
  public connect(destination: AudioNode): void {
    console.log(`[MixerChannel] Connecting channel ${this.name} output to destination`);
    this.outputGain.connect(destination);
  }

  /** Disconnect the channel output */
  public disconnect(): void {
    this.outputGain.disconnect();
  }

  /**
   * Set input trim (0-2, 1 = unity)
   */
  public setInputTrim(trim: number): void {
    this.inputTrim = clamp(trim, 0, 2);
    this.inputGain.gain.setTargetAtTime(this.inputTrim, this.audioContext.currentTime, 0.01);
  }

  /** Get input trim */
  public getInputTrim(): number { return this.inputTrim; }

  /**
   * Set volume (0-1 linear)
   */
  public setVolume(volume: number): void {
    this.volume = clamp(volume, 0, 1);
    this.volumeDb = linearToDb(this.volume);
    if (!this.muted) {
      this.faderGain.gain.setTargetAtTime(this.volume, this.audioContext.currentTime, 0.01);
    }
    this.emitEvent({ type: 'volume', channelId: this.id, data: { volume: this.volume, dB: this.volumeDb } });
  }

  /** Get current volume (linear) */
  public getVolume(): number { return this.volume; }

  /**
   * Set volume in dB (-60 to +6)
   */
  public setVolumeDb(dB: number): void {
    this.volumeDb = clamp(dB, -60, 6);
    this.volume = dBToLinear(this.volumeDb);
    if (!this.muted) {
      this.faderGain.gain.setTargetAtTime(this.volume, this.audioContext.currentTime, 0.01);
    }
    this.emitEvent({ type: 'volume', channelId: this.id, data: { volume: this.volume, dB: this.volumeDb } });
  }

  /** Get volume in dB */
  public getVolumeDb(): number { return this.volumeDb; }

  /**
   * Set pan (-1 to 1)
   */
  public setPan(pan: number): void {
    this.pan = clamp(pan, -1, 1);
    this.pannerNode.pan.setTargetAtTime(this.pan, this.audioContext.currentTime, 0.01);
    this.emitEvent({ type: 'pan', channelId: this.id, data: { pan: this.pan } });
  }

  /** Get current pan */
  public getPan(): number { return this.pan; }

  /**
   * Set mute state
   */
  public setMute(muted: boolean): void {
    this.muted = muted;
    this.muteGain.gain.setTargetAtTime(muted ? 0 : 1, this.audioContext.currentTime, 0.01);
    this.emitEvent({ type: 'mute', channelId: this.id, data: { muted } });
  }

  /** Get mute state */
  public isMuted(): boolean { return this.muted; }

  /** Toggle mute */
  public toggleMute(): boolean {
    this.setMute(!this.muted);
    return this.muted;
  }

  /**
   * Set solo state
   */
  public setSolo(soloed: boolean): void {
    this.soloed = soloed;
    this.emitEvent({ type: 'solo', channelId: this.id, data: { soloed } });
  }

  /** Get solo state */
  public isSoloed(): boolean { return this.soloed; }

  /** Toggle solo */
  public toggleSolo(): boolean {
    this.setSolo(!this.soloed);
    return this.soloed;
  }

  /**
   * Enable/disable high-pass filter
   */
  public setHighPassEnabled(enabled: boolean): void {
    this.highPassEnabled = enabled;
    // Bypass by setting frequency very low when disabled
    this.highPassFilter.frequency.setTargetAtTime(
      enabled ? this.highPassFreq : 1,
      this.audioContext.currentTime,
      0.01
    );
  }

  /**
   * Set high-pass filter frequency
   */
  public setHighPassFrequency(freq: number): void {
    this.highPassFreq = clamp(freq, 20, 500);
    if (this.highPassEnabled) {
      this.highPassFilter.frequency.setTargetAtTime(this.highPassFreq, this.audioContext.currentTime, 0.01);
    }
  }

  /**
   * Get VU meter data
   */
  public getVUMeterData(): VUMeterData {
    return { ...this.vuData };
  }

  /**
   * Get peak level (0-1) - max of L and R
   */
  public getPeakLevel(): number {
    return Math.max(this.vuData.peakL, this.vuData.peakR);
  }

  /**
   * Get RMS level (0-1) - average of L and R
   */
  public getRMSLevel(): number {
    return (this.vuData.rmsL + this.vuData.rmsR) / 2;
  }

  /**
   * Add an effect to the chain
   */
  public addEffect(effect: EffectParams): void {
    this.effects.push(effect);
    this.rebuildEffectChain();
    this.emitEvent({ type: 'effect', channelId: this.id, data: { action: 'add', effect } });
  }

  /**
   * Remove an effect from the chain
   */
  public removeEffect(effectId: string): void {
    this.effects = this.effects.filter(e => e.id !== effectId);
    this.rebuildEffectChain();
    this.emitEvent({ type: 'effect', channelId: this.id, data: { action: 'remove', effectId } });
  }

  /**
   * Reorder effects
   */
  public reorderEffects(effectIds: string[]): void {
    const reordered: EffectParams[] = [];
    for (const id of effectIds) {
      const effect = this.effects.find(e => e.id === id);
      if (effect) reordered.push(effect);
    }
    this.effects = reordered;
    this.rebuildEffectChain();
  }

  /** Get all effects */
  public getEffects(): EffectParams[] { return [...this.effects]; }

  /**
   * Rebuild the effect chain after changes
   */
  private rebuildEffectChain(): void {
    // Disconnect existing effect nodes
    this.effectChainInput.disconnect();
    this.effectNodes.forEach(node => {
      try { node.disconnect(); } catch {}
    });
    this.effectNodes = [];
    
    // If no effects, connect directly
    if (this.effects.length === 0) {
      this.effectChainInput.connect(this.effectChainOutput);
      return;
    }
    
    // TODO: Create actual effect nodes based on effect params
    // For now, just connect directly
    this.effectChainInput.connect(this.effectChainOutput);
  }

  /**
   * Add a send
   */
  public addSend(send: MixerSend, destinationNode?: AudioNode): void {
    // Remove existing send to same target
    this.removeSend(send.targetId);
    
    this.sends.push(send);
    
    // Create send gain node
    const sendGain = this.audioContext.createGain();
    sendGain.gain.value = send.amount;
    this.sendNodes.set(send.targetId, sendGain);
    
    // Connect from post-fader
    this.faderGain.connect(sendGain);
    
    // Connect to destination if provided
    if (destinationNode) {
      sendGain.connect(destinationNode);
    }
    
    this.emitEvent({ type: 'send', channelId: this.id, data: { action: 'add', send } });
  }

  /**
   * Remove a send
   */
  public removeSend(targetId: string): void {
    this.sends = this.sends.filter(s => s.targetId !== targetId);
    const sendGain = this.sendNodes.get(targetId);
    if (sendGain) {
      sendGain.disconnect();
      this.sendNodes.delete(targetId);
    }
    this.emitEvent({ type: 'send', channelId: this.id, data: { action: 'remove', targetId } });
  }

  /**
   * Set send amount
   */
  public setSendAmount(targetId: string, amount: number): void {
    const send = this.sends.find(s => s.targetId === targetId);
    const sendGain = this.sendNodes.get(targetId);
    if (send && sendGain) {
      send.amount = clamp(amount, 0, 1);
      sendGain.gain.setTargetAtTime(send.amount, this.audioContext.currentTime, 0.01);
    }
  }

  /** Get all sends */
  public getSends(): MixerSend[] { return [...this.sends]; }

  /**
   * Register state change callback
   */
  public onStateChange(callback: ChannelStateCallback): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      const index = this.stateCallbacks.indexOf(callback);
      if (index !== -1) this.stateCallbacks.splice(index, 1);
    };
  }

  /**
   * Emit state change event
   */
  private emitEvent(event: ChannelStateEvent): void {
    for (const callback of this.stateCallbacks) {
      try { callback(event); } catch (e) { console.error('Channel state callback error:', e); }
    }
  }

  /**
   * Get channel state as serializable object
   */
  public getState(): {
    id: string; name: string; volume: number; volumeDb: number;
    pan: number; muted: boolean; soloed: boolean;
    inputTrim: number; effects: EffectParams[]; sends: MixerSend[];
  } {
    return {
      id: this.id, name: this.name, volume: this.volume, volumeDb: this.volumeDb,
      pan: this.pan, muted: this.muted, soloed: this.soloed,
      inputTrim: this.inputTrim, effects: [...this.effects], sends: [...this.sends]
    };
  }

  /**
   * Restore channel state
   */
  public setState(state: Partial<ReturnType<MixerChannel['getState']>>): void {
    if (state.name !== undefined) this.name = state.name;
    if (state.volume !== undefined) this.setVolume(state.volume);
    if (state.pan !== undefined) this.setPan(state.pan);
    if (state.muted !== undefined) this.setMute(state.muted);
    if (state.soloed !== undefined) this.setSolo(state.soloed);
    if (state.inputTrim !== undefined) this.setInputTrim(state.inputTrim);
  }

  /**
   * Reset channel to default state
   */
  public reset(): void {
    this.setVolume(1.0);
    this.setPan(0);
    this.setMute(false);
    this.setSolo(false);
    this.setInputTrim(1.0);
    this.setHighPassEnabled(false);
    this.effects = [];
    this.rebuildEffectChain();
    this.sends.forEach(s => this.removeSend(s.targetId));
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    // Stop metering
    if (this.meterUpdateInterval) {
      clearInterval(this.meterUpdateInterval);
    }
    if (this.peakHoldTimerL) clearTimeout(this.peakHoldTimerL);
    if (this.peakHoldTimerR) clearTimeout(this.peakHoldTimerR);
    
    // Disconnect all nodes
    this.disconnect();
    this.inputGain.disconnect();
    this.highPassFilter.disconnect();
    this.preEffectGain.disconnect();
    this.effectChainInput.disconnect();
    this.effectChainOutput.disconnect();
    this.postEffectGain.disconnect();
    this.pannerNode.disconnect();
    this.faderGain.disconnect();
    this.muteGain.disconnect();
    this.splitter.disconnect();
    this.analyserL.disconnect();
    this.analyserR.disconnect();
    
    // Disconnect effect nodes
    this.effectNodes.forEach(node => { try { node.disconnect(); } catch {} });
    this.effectNodes = [];
    
    // Disconnect send nodes
    this.sendNodes.forEach(node => { try { node.disconnect(); } catch {} });
    this.sendNodes.clear();
    
    // Clear callbacks
    this.stateCallbacks = [];
  }
}