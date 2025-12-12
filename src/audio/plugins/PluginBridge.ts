// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * PluginBridge - Bridge between WASM plugins and Web Audio API
 * Handles audio buffer transfer, parameter automation, and MIDI events
 */

import type { WAPManifest, WASMPluginInstance, WAPParameterDescriptor } from './PluginHost';
import { clamp } from '../utils/AudioMath';

/**
 * Automation point for parameter automation
 */
export interface AutomationPoint {
  time: number;
  value: number;
  curve?: 'linear' | 'exponential' | 'step';
}

/**
 * Automation lane for a parameter
 */
export interface AutomationLane {
  paramId: string;
  points: AutomationPoint[];
  enabled: boolean;
}

/**
 * MIDI event types
 */
export type MidiEventType = 
  | 'noteOn' 
  | 'noteOff' 
  | 'controlChange' 
  | 'pitchBend' 
  | 'programChange'
  | 'aftertouch'
  | 'channelPressure';

/**
 * MIDI event structure
 */
export interface MidiEvent {
  type: MidiEventType;
  channel: number;
  time: number;
  data: {
    note?: number;
    velocity?: number;
    cc?: number;
    value?: number;
    program?: number;
    pressure?: number;
  };
}

/**
 * Audio buffer configuration
 */
export interface AudioBufferConfig {
  sampleRate: number;
  bufferSize: number;
  numChannels: number;
}

/**
 * Plugin bridge state
 */
export interface PluginBridgeState {
  connected: boolean;
  processing: boolean;
  latency: number;
  cpuUsage: number;
}

/**
 * Bridge event types
 */
export interface BridgeEvent {
  type: 'connected' | 'disconnected' | 'parameterChanged' | 'midiReceived' | 'error';
  instanceId: string;
  data?: unknown;
}

export type BridgeEventCallback = (event: BridgeEvent) => void;

/**
 * PluginBridge - Manages communication between WASM plugins and Web Audio
 */
export class PluginBridge {
  private audioContext: AudioContext;
  private instance: WASMPluginInstance;
  private manifest: WAPManifest;
  
  // Audio nodes
  private inputGain: GainNode;
  private outputGain: GainNode;
  private analyser: AnalyserNode;
  
  // Buffer management
  private bufferConfig: AudioBufferConfig;
  private inputBuffer: Float32Array;
  private outputBuffer: Float32Array;
  private inputPtr: number = 0;
  private outputPtr: number = 0;
  
  // Automation
  private automationLanes: Map<string, AutomationLane> = new Map();
  private parameterValues: Map<string, number> = new Map();
  
  // MIDI
  private midiQueue: MidiEvent[] = [];
  private midiInputEnabled: boolean = true;
  
  // State
  private state: PluginBridgeState = {
    connected: false,
    processing: false,
    latency: 0,
    cpuUsage: 0
  };
  
  // Event callbacks
  private eventCallbacks: BridgeEventCallback[] = [];
  
  // Performance monitoring
  private lastProcessTime: number = 0;
  private processTimeAccumulator: number = 0;
  private processCount: number = 0;
  
  constructor(
    audioContext: AudioContext,
    instance: WASMPluginInstance,
    config?: Partial<AudioBufferConfig>
  ) {
    this.audioContext = audioContext;
    this.instance = instance;
    this.manifest = instance.manifest;
    
    // Set up buffer configuration
    this.bufferConfig = {
      sampleRate: config?.sampleRate || audioContext.sampleRate,
      bufferSize: config?.bufferSize || 128,
      numChannels: config?.numChannels || 2
    };
    
    // Create audio buffers
    const bufferLength = this.bufferConfig.bufferSize * this.bufferConfig.numChannels;
    this.inputBuffer = new Float32Array(bufferLength);
    this.outputBuffer = new Float32Array(bufferLength);
    
    // Create audio nodes
    this.inputGain = audioContext.createGain();
    this.outputGain = audioContext.createGain();
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    
    // Initialize parameter values from manifest defaults
    this.initializeParameters();
    
    // Allocate WASM memory for buffers
    this.allocateWasmBuffers();
    
    // Connect to worklet if available
    this.connectToWorklet();
  }
  
  /**
   * Initialize parameter values from manifest
   */
  private initializeParameters(): void {
    for (const param of this.manifest.parameters) {
      this.parameterValues.set(param.id, param.default);
      
      // Create automation lane
      this.automationLanes.set(param.id, {
        paramId: param.id,
        points: [],
        enabled: false
      });
    }
  }
  
  /**
   * Allocate buffers in WASM memory
   */
  private allocateWasmBuffers(): void {
    const bytesPerSample = 4; // float32
    const bufferBytes = this.bufferConfig.bufferSize * this.bufferConfig.numChannels * bytesPerSample;
    
    if (this.instance.exports.malloc) {
      this.inputPtr = this.instance.exports.malloc(bufferBytes);
      this.outputPtr = this.instance.exports.malloc(bufferBytes);
    }
  }
  
  /**
   * Connect to the AudioWorklet node
   */
  private connectToWorklet(): void {
    if (!this.instance.workletNode) return;
    
    // Connect audio routing
    this.inputGain.connect(this.instance.workletNode);
    this.instance.workletNode.connect(this.outputGain);
    this.outputGain.connect(this.analyser);
    
    // Handle messages from worklet
    this.instance.workletNode.port.onmessage = (event) => {
      this.handleWorkletMessage(event.data);
    };
    
    this.state.connected = true;
    this.emitEvent({ type: 'connected', instanceId: this.instance.id });
  }
  
  /**
   * Handle messages from the AudioWorklet
   */
  private handleWorkletMessage(data: { type: string; [key: string]: unknown }): void {
    switch (data.type) {
      case 'initialized':
        this.state.processing = true;
        break;
      case 'parameterChanged':
        this.parameterValues.set(data.paramId as string, data.value as number);
        this.emitEvent({
          type: 'parameterChanged',
          instanceId: this.instance.id,
          data: { paramId: data.paramId, value: data.value }
        });
        break;
      case 'error':
        this.emitEvent({
          type: 'error',
          instanceId: this.instance.id,
          data: { error: data.error }
        });
        break;
    }
  }
  
  /**
   * Get the input node for connecting audio sources
   */
  public getInput(): GainNode {
    return this.inputGain;
  }
  
  /**
   * Get the output node for connecting to destinations
   */
  public getOutput(): GainNode {
    return this.outputGain;
  }
  
  /**
   * Get the analyser node for visualization
   */
  public getAnalyser(): AnalyserNode {
    return this.analyser;
  }
  
  /**
   * Connect the bridge output to a destination
   */
  public connect(destination: AudioNode): void {
    this.analyser.connect(destination);
  }
  
  /**
   * Disconnect the bridge output
   */
  public disconnect(): void {
    this.analyser.disconnect();
  }
  
  /**
   * Set a parameter value
   */
  public setParameter(paramId: string, value: number): void {
    const param = this.manifest.parameters.find(p => p.id === paramId);
    if (!param) return;
    
    const clampedValue = clamp(value, param.min, param.max);
    this.parameterValues.set(paramId, clampedValue);
    
    // Send to WASM
    const paramIndex = this.manifest.parameters.findIndex(p => p.id === paramId);
    if (paramIndex !== -1 && this.instance.exports.setParameter) {
      this.instance.exports.setParameter(paramIndex, clampedValue);
    }
    
    // Send to worklet
    if (this.instance.workletNode) {
      this.instance.workletNode.port.postMessage({
        type: 'setParameter',
        index: paramIndex,
        value: clampedValue
      });
    }
    
    this.emitEvent({
      type: 'parameterChanged',
      instanceId: this.instance.id,
      data: { paramId, value: clampedValue }
    });
  }
  
  /**
   * Get a parameter value
   */
  public getParameter(paramId: string): number {
    return this.parameterValues.get(paramId) ?? 0;
  }
  
  /**
   * Get all parameter values
   */
  public getParameters(): Record<string, number> {
    const params: Record<string, number> = {};
    for (const [key, value] of this.parameterValues) {
      params[key] = value;
    }
    return params;
  }
  
  /**
   * Get parameter descriptor
   */
  public getParameterDescriptor(paramId: string): WAPParameterDescriptor | undefined {
    return this.manifest.parameters.find(p => p.id === paramId);
  }
  
  /**
   * Set automation points for a parameter
   */
  public setAutomation(paramId: string, points: AutomationPoint[]): void {
    const lane = this.automationLanes.get(paramId);
    if (lane) {
      lane.points = points.sort((a, b) => a.time - b.time);
      lane.enabled = points.length > 0;
    }
  }
  
  /**
   * Add an automation point
   */
  public addAutomationPoint(paramId: string, point: AutomationPoint): void {
    const lane = this.automationLanes.get(paramId);
    if (lane) {
      lane.points.push(point);
      lane.points.sort((a, b) => a.time - b.time);
      lane.enabled = true;
    }
  }
  
  /**
   * Clear automation for a parameter
   */
  public clearAutomation(paramId: string): void {
    const lane = this.automationLanes.get(paramId);
    if (lane) {
      lane.points = [];
      lane.enabled = false;
    }
  }
  
  /**
   * Get automation lane for a parameter
   */
  public getAutomationLane(paramId: string): AutomationLane | undefined {
    return this.automationLanes.get(paramId);
  }
  
  /**
   * Process automation at a given time
   */
  public processAutomation(time: number): void {
    for (const [paramId, lane] of this.automationLanes) {
      if (!lane.enabled || lane.points.length === 0) continue;
      
      const value = this.interpolateAutomation(lane, time);
      if (value !== null) {
        this.setParameter(paramId, value);
      }
    }
  }
  
  /**
   * Interpolate automation value at a given time
   */
  private interpolateAutomation(lane: AutomationLane, time: number): number | null {
    const points = lane.points;
    if (points.length === 0) return null;
    
    // Before first point
    if (time <= points[0].time) {
      return points[0].value;
    }
    
    // After last point
    if (time >= points[points.length - 1].time) {
      return points[points.length - 1].value;
    }
    
    // Find surrounding points
    let prevPoint = points[0];
    let nextPoint = points[1];
    
    for (let i = 1; i < points.length; i++) {
      if (points[i].time >= time) {
        prevPoint = points[i - 1];
        nextPoint = points[i];
        break;
      }
    }
    
    // Interpolate based on curve type
    const t = (time - prevPoint.time) / (nextPoint.time - prevPoint.time);
    const curve = nextPoint.curve || 'linear';
    
    switch (curve) {
      case 'step':
        return prevPoint.value;
      case 'exponential':
        return prevPoint.value * Math.pow(nextPoint.value / prevPoint.value, t);
      case 'linear':
      default:
        return prevPoint.value + (nextPoint.value - prevPoint.value) * t;
    }
  }
  
  /**
   * Send a MIDI event to the plugin
   */
  public sendMidiEvent(event: MidiEvent): void {
    if (!this.midiInputEnabled) return;
    
    // Queue the event
    this.midiQueue.push(event);
    
    // Process immediately if not in a render callback
    this.processMidiEvent(event);
    
    this.emitEvent({
      type: 'midiReceived',
      instanceId: this.instance.id,
      data: event
    });
  }
  
  /**
   * Process a MIDI event
   */
  private processMidiEvent(event: MidiEvent): void {
    switch (event.type) {
      case 'noteOn':
        if (this.instance.exports.noteOn && event.data.note !== undefined) {
          this.instance.exports.noteOn(
            event.data.note,
            event.data.velocity ?? 100,
            event.channel
          );
        }
        if (this.instance.workletNode) {
          this.instance.workletNode.port.postMessage({
            type: 'noteOn',
            note: event.data.note,
            velocity: event.data.velocity ?? 100,
            channel: event.channel
          });
        }
        break;
        
      case 'noteOff':
        if (this.instance.exports.noteOff && event.data.note !== undefined) {
          this.instance.exports.noteOff(event.data.note, event.channel);
        }
        if (this.instance.workletNode) {
          this.instance.workletNode.port.postMessage({
            type: 'noteOff',
            note: event.data.note,
            channel: event.channel
          });
        }
        break;
        
      case 'controlChange':
        if (this.instance.exports.controlChange && event.data.cc !== undefined) {
          this.instance.exports.controlChange(
            event.data.cc,
            event.data.value ?? 0,
            event.channel
          );
        }
        if (this.instance.workletNode) {
          this.instance.workletNode.port.postMessage({
            type: 'controlChange',
            cc: event.data.cc,
            value: event.data.value ?? 0,
            channel: event.channel
          });
        }
        break;
        
      case 'pitchBend':
        if (this.instance.exports.pitchBend && event.data.value !== undefined) {
          this.instance.exports.pitchBend(event.data.value, event.channel);
        }
        break;
    }
  }
  
  /**
   * Send note on
   */
  public noteOn(note: number, velocity: number = 100, channel: number = 0): void {
    this.sendMidiEvent({
      type: 'noteOn',
      channel,
      time: this.audioContext.currentTime,
      data: { note, velocity }
    });
  }
  
  /**
   * Send note off
   */
  public noteOff(note: number, channel: number = 0): void {
    this.sendMidiEvent({
      type: 'noteOff',
      channel,
      time: this.audioContext.currentTime,
      data: { note }
    });
  }
  
  /**
   * Send control change
   */
  public controlChange(cc: number, value: number, channel: number = 0): void {
    this.sendMidiEvent({
      type: 'controlChange',
      channel,
      time: this.audioContext.currentTime,
      data: { cc, value }
    });
  }
  
  /**
   * Send pitch bend
   */
  public pitchBend(value: number, channel: number = 0): void {
    this.sendMidiEvent({
      type: 'pitchBend',
      channel,
      time: this.audioContext.currentTime,
      data: { value }
    });
  }
  
  /**
   * Enable/disable MIDI input
   */
  public setMidiInputEnabled(enabled: boolean): void {
    this.midiInputEnabled = enabled;
  }
  
  /**
   * Check if MIDI input is enabled
   */
  public isMidiInputEnabled(): boolean {
    return this.midiInputEnabled;
  }
  
  /**
   * Clear MIDI queue
   */
  public clearMidiQueue(): void {
    this.midiQueue = [];
  }
  
  /**
   * Get bridge state
   */
  public getState(): PluginBridgeState {
    return { ...this.state };
  }
  
  /**
   * Get CPU usage estimate
   */
  public getCpuUsage(): number {
    if (this.processCount === 0) return 0;
    
    const avgProcessTime = this.processTimeAccumulator / this.processCount;
    const bufferDuration = this.bufferConfig.bufferSize / this.bufferConfig.sampleRate;
    
    return (avgProcessTime / bufferDuration) * 100;
  }
  
  /**
   * Reset CPU usage statistics
   */
  public resetCpuStats(): void {
    this.processTimeAccumulator = 0;
    this.processCount = 0;
  }
  
  /**
   * Get latency in samples
   */
  public getLatencySamples(): number {
    return this.bufferConfig.bufferSize;
  }
  
  /**
   * Get latency in seconds
   */
  public getLatencySeconds(): number {
    return this.bufferConfig.bufferSize / this.bufferConfig.sampleRate;
  }
  
  /**
   * Set input gain
   */
  public setInputGain(gain: number): void {
    this.inputGain.gain.setTargetAtTime(
      clamp(gain, 0, 2),
      this.audioContext.currentTime,
      0.01
    );
  }
  
  /**
   * Set output gain
   */
  public setOutputGain(gain: number): void {
    this.outputGain.gain.setTargetAtTime(
      clamp(gain, 0, 2),
      this.audioContext.currentTime,
      0.01
    );
  }
  
  /**
   * Get frequency data from analyser
   */
  public getFrequencyData(): Uint8Array {
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }
  
  /**
   * Get time domain data from analyser
   */
  public getTimeDomainData(): Uint8Array {
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }
  
  /**
   * Register an event callback
   */
  public onEvent(callback: BridgeEventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index !== -1) {
        this.eventCallbacks.splice(index, 1);
      }
    };
  }
  
  /**
   * Emit an event
   */
  private emitEvent(event: BridgeEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in bridge event callback:', error);
      }
    }
  }
  
  /**
   * Save plugin state
   */
  public saveState(): { params: Record<string, number>; automation: Record<string, AutomationLane> } {
    const automation: Record<string, AutomationLane> = {};
    for (const [key, lane] of this.automationLanes) {
      automation[key] = { ...lane, points: [...lane.points] };
    }
    
    return {
      params: this.getParameters(),
      automation
    };
  }
  
  /**
   * Restore plugin state
   */
  public restoreState(state: { params: Record<string, number>; automation?: Record<string, AutomationLane> }): void {
    // Restore parameters
    for (const [paramId, value] of Object.entries(state.params)) {
      this.setParameter(paramId, value);
    }
    
    // Restore automation
    if (state.automation) {
      for (const [paramId, lane] of Object.entries(state.automation)) {
        this.automationLanes.set(paramId, { ...lane, points: [...lane.points] });
      }
    }
  }
  
  /**
   * Dispose of the bridge
   */
  public dispose(): void {
    // Disconnect audio nodes
    this.inputGain.disconnect();
    this.outputGain.disconnect();
    this.analyser.disconnect();
    
    // Free WASM memory
    if (this.instance.exports.free) {
      if (this.inputPtr) this.instance.exports.free(this.inputPtr);
      if (this.outputPtr) this.instance.exports.free(this.outputPtr);
    }
    
    // Clear state
    this.automationLanes.clear();
    this.parameterValues.clear();
    this.midiQueue = [];
    this.eventCallbacks = [];
    
    this.state.connected = false;
    this.state.processing = false;
    
    this.emitEvent({ type: 'disconnected', instanceId: this.instance.id });
  }
}

/**
 * Create a plugin bridge for an instance
 */
export function createPluginBridge(
  audioContext: AudioContext,
  instance: WASMPluginInstance,
  config?: Partial<AudioBufferConfig>
): PluginBridge {
  return new PluginBridge(audioContext, instance, config);
}