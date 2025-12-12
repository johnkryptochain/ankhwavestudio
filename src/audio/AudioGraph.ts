// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * AudioGraph - Manages the audio routing graph
 * Handles connections between instruments, effects, and mixer channels
 */

import type { AudioConnection } from '../types/audio';
import { MixerChannel } from './MixerChannel';
import { BaseEffect } from './effects/BaseEffect';
import { BaseInstrument } from './instruments/BaseInstrument';

/**
 * Audio node wrapper with metadata
 */
interface AudioNodeEntry {
  id: string;
  node: AudioNode;
  type: 'instrument' | 'effect' | 'mixer' | 'utility' | 'send' | 'return';
  name?: string;
}

/**
 * Send bus configuration
 */
interface SendBus {
  id: string;
  name: string;
  inputGain: GainNode;
  returnGain: GainNode;
  effect: BaseEffect | null;
}

/**
 * Audio graph state change event
 */
export interface AudioGraphEvent {
  type: 'nodeAdded' | 'nodeRemoved' | 'connected' | 'disconnected' | 'channelAdded' | 'channelRemoved';
  data: unknown;
}

export type AudioGraphEventCallback = (event: AudioGraphEvent) => void;

export class AudioGraph {
  private audioContext: AudioContext;
  private masterOutput: GainNode;
  private nodes: Map<string, AudioNodeEntry> = new Map();
  private connections: AudioConnection[] = [];
  private mixerChannels: Map<string, MixerChannel> = new Map();
  private instruments: Map<string, BaseInstrument> = new Map();
  private effects: Map<string, BaseEffect> = new Map();
  private sendBuses: Map<string, SendBus> = new Map();
  private eventCallbacks: AudioGraphEventCallback[] = [];

  constructor(audioContext: AudioContext, masterOutput: GainNode) {
    this.audioContext = audioContext;
    this.masterOutput = masterOutput;
    
    // Create default master mixer channel
    this.createMixerChannel('master', 'Master');
  }

  /**
   * Create a new mixer channel
   */
  public createMixerChannel(id: string, name: string): MixerChannel {
    const channel = new MixerChannel(this.audioContext, id, name);
    this.mixerChannels.set(id, channel);
    
    // Connect to master output if not the master channel
    if (id !== 'master') {
      const masterChannel = this.mixerChannels.get('master');
      if (masterChannel) {
        console.log(`[AudioGraph] Connecting channel ${name} to master channel input`);
        channel.connect(masterChannel.getInput());
      } else {
        console.warn(`[AudioGraph] Master channel not found when creating channel ${name}`);
      }
    } else {
      // Master channel connects to the actual master output
      console.log(`[AudioGraph] Connecting master channel to masterOutput`);
      channel.connect(this.masterOutput);
    }
    
    this.emitEvent({ type: 'channelAdded', data: { id, name } });
    return channel;
  }

  /**
   * Get a mixer channel by ID
   */
  public getMixerChannel(id: string): MixerChannel | undefined {
    return this.mixerChannels.get(id);
  }

  /**
   * Get all mixer channels
   */
  public getAllMixerChannels(): MixerChannel[] {
    return Array.from(this.mixerChannels.values());
  }

  /**
   * Remove a mixer channel
   */
  public removeMixerChannel(id: string): boolean {
    if (id === 'master') {
      console.warn('Cannot remove master channel');
      return false;
    }
    
    const channel = this.mixerChannels.get(id);
    if (channel) {
      channel.dispose();
      this.mixerChannels.delete(id);
      this.emitEvent({ type: 'channelRemoved', data: { id } });
      return true;
    }
    return false;
  }

  /**
   * Route a mixer channel to another channel
   */
  public routeChannel(sourceId: string, targetId: string): boolean {
    const source = this.mixerChannels.get(sourceId);
    const target = this.mixerChannels.get(targetId);
    
    if (!source || !target || sourceId === targetId) {
      return false;
    }
    
    source.disconnect();
    source.connect(target.getInput());
    return true;
  }

  /**
   * Create a send bus for effects
   */
  public createSendBus(id: string, name: string, effect?: BaseEffect): SendBus {
    const inputGain = this.audioContext.createGain();
    const returnGain = this.audioContext.createGain();
    inputGain.gain.value = 1.0;
    returnGain.gain.value = 1.0;
    
    const bus: SendBus = {
      id,
      name,
      inputGain,
      returnGain,
      effect: effect || null
    };
    
    // Connect the bus
    if (effect) {
      inputGain.connect(effect.getInput());
      effect.connect(returnGain);
    } else {
      inputGain.connect(returnGain);
    }
    
    // Connect return to master
    const masterChannel = this.mixerChannels.get('master');
    if (masterChannel) {
      returnGain.connect(masterChannel.getInput());
    }
    
    this.sendBuses.set(id, bus);
    return bus;
  }

  /**
   * Get a send bus
   */
  public getSendBus(id: string): SendBus | undefined {
    return this.sendBuses.get(id);
  }

  /**
   * Remove a send bus
   */
  public removeSendBus(id: string): boolean {
    const bus = this.sendBuses.get(id);
    if (bus) {
      bus.inputGain.disconnect();
      bus.returnGain.disconnect();
      if (bus.effect) {
        bus.effect.dispose();
      }
      this.sendBuses.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Connect a channel to a send bus
   */
  public connectToSend(channelId: string, sendId: string, amount: number = 0.5): boolean {
    const channel = this.mixerChannels.get(channelId);
    const send = this.sendBuses.get(sendId);
    
    if (!channel || !send) {
      return false;
    }
    
    // Use the updated addSend method to connect directly to the send bus input
    channel.addSend({ targetId: sendId, amount }, send.inputGain);
    
    return true;
  }

  /**
   * Add an instrument to the graph
   */
  public addInstrument(instrument: BaseInstrument, channelId?: string): void {
    const id = instrument.getId();
    this.instruments.set(id, instrument);
    
    // Connect to specified channel or master
    const targetChannel = channelId 
      ? this.mixerChannels.get(channelId) 
      : this.mixerChannels.get('master');
    
    if (targetChannel) {
      instrument.connect(targetChannel.getInput());
    }
    
    this.addNode(id, instrument.getOutput(), 'instrument', instrument.getName());
  }

  /**
   * Remove an instrument from the graph
   */
  public removeInstrument(id: string): boolean {
    const instrument = this.instruments.get(id);
    if (instrument) {
      instrument.dispose();
      this.instruments.delete(id);
      this.removeNode(id);
      return true;
    }
    return false;
  }

  /**
   * Get an instrument by ID
   */
  public getInstrument(id: string): BaseInstrument | undefined {
    return this.instruments.get(id);
  }

  /**
   * Get all instruments
   */
  public getAllInstruments(): BaseInstrument[] {
    return Array.from(this.instruments.values());
  }

  /**
   * Add an effect to a mixer channel
   */
  public addEffectToChannel(effect: BaseEffect, channelId: string): boolean {
    const channel = this.mixerChannels.get(channelId);
    if (!channel) return false;
    
    this.effects.set(effect.getId(), effect);
    channel.addEffect(effect.getState());
    
    // The actual audio routing is handled by MixerChannel
    return true;
  }

  /**
   * Remove an effect from a channel
   */
  public removeEffectFromChannel(effectId: string, channelId: string): boolean {
    const channel = this.mixerChannels.get(channelId);
    const effect = this.effects.get(effectId);
    
    if (!channel || !effect) return false;
    
    channel.removeEffect(effectId);
    effect.dispose();
    this.effects.delete(effectId);
    return true;
  }

  /**
   * Add a node to the graph
   */
  public addNode(
    id: string,
    node: AudioNode,
    type: 'instrument' | 'effect' | 'mixer' | 'utility' | 'send' | 'return',
    name?: string
  ): void {
    this.nodes.set(id, { id, node, type, name });
    this.emitEvent({ type: 'nodeAdded', data: { id, type, name } });
  }

  /**
   * Remove a node from the graph
   */
  public removeNode(id: string): boolean {
    const entry = this.nodes.get(id);
    if (entry) {
      try {
        entry.node.disconnect();
      } catch {}
      this.nodes.delete(id);
      
      // Remove associated connections
      this.connections = this.connections.filter(
        conn => conn.sourceId !== id && conn.targetId !== id
      );
      
      this.emitEvent({ type: 'nodeRemoved', data: { id } });
      return true;
    }
    return false;
  }

  /**
   * Connect two nodes
   */
  public connect(
    sourceId: string,
    targetId: string,
    sourceOutput: number = 0,
    targetInput: number = 0
  ): boolean {
    const source = this.nodes.get(sourceId);
    const target = this.nodes.get(targetId);
    
    if (!source || !target) {
      console.warn(`Cannot connect: source or target not found`);
      return false;
    }
    
    try {
      source.node.connect(target.node as AudioNode, sourceOutput, targetInput);
      
      this.connections.push({
        sourceId,
        targetId,
        sourceOutput,
        targetInput,
      });
      
      this.emitEvent({ type: 'connected', data: { sourceId, targetId } });
      return true;
    } catch (error) {
      console.error('Failed to connect nodes:', error);
      return false;
    }
  }

  /**
   * Disconnect two nodes
   */
  public disconnect(sourceId: string, targetId?: string): boolean {
    const source = this.nodes.get(sourceId);
    
    if (!source) return false;
    
    try {
      if (targetId) {
        const target = this.nodes.get(targetId);
        if (target) {
          source.node.disconnect(target.node);
        }
        this.connections = this.connections.filter(
          conn => !(conn.sourceId === sourceId && conn.targetId === targetId)
        );
      } else {
        source.node.disconnect();
        this.connections = this.connections.filter(conn => conn.sourceId !== sourceId);
      }
      
      this.emitEvent({ type: 'disconnected', data: { sourceId, targetId } });
      return true;
    } catch (error) {
      console.error('Failed to disconnect nodes:', error);
      return false;
    }
  }

  /**
   * Connect a node to a mixer channel
   */
  public connectToMixer(nodeId: string, channelId: string): boolean {
    const node = this.nodes.get(nodeId);
    const channel = this.mixerChannels.get(channelId);
    
    if (!node || !channel) {
      console.warn(`Cannot connect to mixer: node or channel not found`);
      return false;
    }
    
    try {
      node.node.connect(channel.getInput());
      return true;
    } catch (error) {
      console.error('Failed to connect to mixer:', error);
      return false;
    }
  }

  /**
   * Create a gain node
   */
  public createGainNode(id: string, initialGain: number = 1.0): GainNode {
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = initialGain;
    this.addNode(id, gainNode, 'utility');
    return gainNode;
  }

  /**
   * Create a stereo panner node
   */
  public createPannerNode(id: string, initialPan: number = 0): StereoPannerNode {
    const pannerNode = this.audioContext.createStereoPanner();
    pannerNode.pan.value = initialPan;
    this.addNode(id, pannerNode, 'utility');
    return pannerNode;
  }

  /**
   * Create a biquad filter node
   */
  public createFilterNode(
    id: string,
    type: BiquadFilterType = 'lowpass',
    frequency: number = 1000,
    Q: number = 1
  ): BiquadFilterNode {
    const filterNode = this.audioContext.createBiquadFilter();
    filterNode.type = type;
    filterNode.frequency.value = frequency;
    filterNode.Q.value = Q;
    this.addNode(id, filterNode, 'utility');
    return filterNode;
  }

  /**
   * Get all connections
   */
  public getConnections(): AudioConnection[] {
    return [...this.connections];
  }

  /**
   * Get the audio context
   */
  public getAudioContext(): AudioContext {
    return this.audioContext;
  }

  /**
   * Register event callback
   */
  public onEvent(callback: AudioGraphEventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index !== -1) this.eventCallbacks.splice(index, 1);
    };
  }

  /**
   * Emit an event
   */
  private emitEvent(event: AudioGraphEvent): void {
    for (const callback of this.eventCallbacks) {
      try { callback(event); } catch (e) { console.error('Graph event callback error:', e); }
    }
  }

  /**
   * Get graph state for serialization
   */
  public getState(): {
    channels: { id: string; name: string; volume: number; pan: number; muted: boolean; soloed: boolean }[];
    connections: AudioConnection[];
    sendBuses: { id: string; name: string }[];
  } {
    return {
      channels: Array.from(this.mixerChannels.values()).map(ch => ({
        id: ch.getId(),
        name: ch.getName(),
        volume: ch.getVolume(),
        pan: ch.getPan(),
        muted: ch.isMuted(),
        soloed: ch.isSoloed()
      })),
      connections: [...this.connections],
      sendBuses: Array.from(this.sendBuses.values()).map(bus => ({
        id: bus.id,
        name: bus.name
      }))
    };
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    // Dispose all instruments
    this.instruments.forEach(inst => inst.dispose());
    this.instruments.clear();
    
    // Dispose all effects
    this.effects.forEach(effect => effect.dispose());
    this.effects.clear();
    
    // Dispose all send buses
    this.sendBuses.forEach(bus => {
      bus.inputGain.disconnect();
      bus.returnGain.disconnect();
      if (bus.effect) bus.effect.dispose();
    });
    this.sendBuses.clear();
    
    // Dispose all mixer channels
    this.mixerChannels.forEach(channel => channel.dispose());
    this.mixerChannels.clear();
    
    // Disconnect all nodes
    this.nodes.forEach(entry => {
      try { entry.node.disconnect(); } catch {}
    });
    this.nodes.clear();
    
    // Clear connections and callbacks
    this.connections = [];
    this.eventCallbacks = [];
  }
}