// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * AudioEngine - Main audio engine class for AnkhWaveStudio Web
 * Manages the Web Audio API context, audio graph, and all audio processing
 */

import type { AudioEngineState } from '../types/audio';
import { AudioGraph } from './AudioGraph';
import { Transport } from './Transport';
import { Sequencer } from './Sequencer';
import { ControllerManager } from './controllers/ControllerManager';
import { dBToLinear, linearToDb, clamp } from './utils/AudioMath';

/**
 * Audio engine configuration options
 */
export interface AudioEngineConfig {
  sampleRate?: number;
  bufferSize?: number;
  latencyHint?: AudioContextLatencyCategory | number;
}

/**
 * Audio engine state change event
 */
export interface AudioEngineEvent {
  type: 'initialized' | 'suspended' | 'resumed' | 'closed' | 'error' | 'workletLoaded';
  data?: unknown;
}

export type AudioEngineEventCallback = (event: AudioEngineEvent) => void;

/**
 * Worklet registration info
 */
interface WorkletInfo {
  name: string;
  url: string;
  loaded: boolean;
}

export class AudioEngine {
  private static instance: AudioEngine | null = null;
  
  private audioContext: AudioContext | null = null;
  private audioGraph: AudioGraph | null = null;
  private transport: Transport | null = null;
  private sequencer: Sequencer | null = null;
  private controllerManager: ControllerManager | null = null;
  
  // Master chain
  private masterGain: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserL: AnalyserNode | null = null;
  private analyserR: AnalyserNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  
  // State
  private state: AudioEngineState = {
    isInitialized: false,
    sampleRate: 44100,
    bufferSize: 512,
    latency: 0,
  };
  
  // Manual latency compensation (in seconds)
  private latencyOffset: number = 0;

  private config: AudioEngineConfig = {
    sampleRate: 44100,
    bufferSize: 512,
    latencyHint: 'interactive'
  };
  
  // Worklets
  private registeredWorklets: Map<string, WorkletInfo> = new Map();
  
  // Event callbacks
  private eventCallbacks: AudioEngineEventCallback[] = [];

  private constructor() {}

  /**
   * Get the singleton instance of AudioEngine
   */
  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  /**
   * Set manual latency offset for recording compensation
   * @param offsetSeconds Latency offset in seconds
   */
  public setLatencyOffset(offsetSeconds: number) {
    this.latencyOffset = offsetSeconds;
    console.log(`Latency offset set to ${offsetSeconds * 1000}ms`);
  }

  /**
   * Get total effective latency (system + offset)
   */
  public getTotalLatency(): number {
    return (this.audioContext?.baseLatency || 0) + (this.audioContext?.outputLatency || 0) + this.latencyOffset;
  }

  /**
   * Initialize the audio engine
   * Must be called after a user gesture (click, keypress, etc.)
   */
  public async initialize(config?: AudioEngineConfig): Promise<void> {
    if (this.state.isInitialized) {
      console.warn('AudioEngine already initialized');
      return;
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    try {
      // Create AudioContext with preferred settings
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
        latencyHint: this.config.latencyHint,
      });

      // Wait for context to be running
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create master chain
      this.createMasterChain();

      // Initialize audio graph
      this.audioGraph = new AudioGraph(this.audioContext, this.masterGain!);

      // Initialize transport
      this.transport = new Transport(this.audioContext);

      // Initialize sequencer
      this.sequencer = new Sequencer(this.audioContext, this.transport);

      // Initialize controller manager
      this.controllerManager = new ControllerManager(this);
      this.controllerManager.start();

      // Update state
      this.state = {
        isInitialized: true,
        sampleRate: this.audioContext.sampleRate,
        bufferSize: this.config.bufferSize || 512,
        latency: this.audioContext.baseLatency || 0,
      };

      // Listen for context state changes
      this.audioContext.onstatechange = () => {
        this.handleContextStateChange();
      };

      this.emitEvent({ type: 'initialized', data: this.state });
      console.log('AudioEngine initialized successfully', this.state);
      
      // Test audio output with a quick beep
      this.testAudioOutput();
    } catch (error) {
      this.emitEvent({ type: 'error', data: error });
      console.error('Failed to initialize AudioEngine:', error);
      throw error;
    }
  }

  /**
   * Create the master output chain
   */
  private createMasterChain(): void {
    if (!this.audioContext) return;

    // Master gain
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 1.0;

    // Master limiter (prevents clipping)
    this.masterLimiter = this.audioContext.createDynamicsCompressor();
    this.masterLimiter.threshold.value = -1;
    this.masterLimiter.knee.value = 0;
    this.masterLimiter.ratio.value = 20;
    this.masterLimiter.attack.value = 0.001;
    this.masterLimiter.release.value = 0.1;

    // Main analyser (stereo)
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // Stereo split for L/R metering
    this.splitter = this.audioContext.createChannelSplitter(2);
    this.analyserL = this.audioContext.createAnalyser();
    this.analyserR = this.audioContext.createAnalyser();
    this.analyserL.fftSize = 256;
    this.analyserR.fftSize = 256;

    // Connect master chain
    this.masterGain.connect(this.masterLimiter);
    this.masterLimiter.connect(this.analyser);
    this.analyser.connect(this.splitter);
    this.splitter.connect(this.analyserL, 0);
    this.splitter.connect(this.analyserR, 1);
    this.analyser.connect(this.audioContext.destination);
    
    console.log('[AudioEngine] Master chain created and connected to destination');
    console.log('[AudioEngine] AudioContext state:', this.audioContext.state);
    console.log('[AudioEngine] Master gain value:', this.masterGain.gain.value);
  }

  /**
   * Handle audio context state changes
   */
  private handleContextStateChange(): void {
    if (!this.audioContext) return;
    
    switch (this.audioContext.state) {
      case 'suspended':
        this.emitEvent({ type: 'suspended' });
        break;
      case 'running':
        this.emitEvent({ type: 'resumed' });
        break;
      case 'closed':
        this.emitEvent({ type: 'closed' });
        break;
    }
  }

  /**
   * Get the current audio context
   */
  public getContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Get the audio graph
   */
  public getAudioGraph(): AudioGraph | null {
    return this.audioGraph;
  }

  /**
   * Get the transport
   */
  public getTransport(): Transport | null {
    return this.transport;
  }

  /**
   * Get the sequencer
   */
  public getSequencer(): Sequencer | null {
    return this.sequencer;
  }

  /**
   * Get the controller manager
   */
  public getControllerManager(): ControllerManager | null {
    return this.controllerManager;
  }

  /**
   * Set the output channel count
   * @param channels Number of channels (e.g., 2 for stereo, 6 for 5.1)
   * @returns True if successful, false if not supported
   */
  public setChannelCount(channels: number): boolean {
    if (!this.audioContext) return false;
    
    const max = this.audioContext.destination.maxChannelCount;
    if (channels > max) {
      console.warn(`[AudioEngine] Requested ${channels} channels, but device only supports ${max}`);
      return false;
    }
    
    try {
      this.audioContext.destination.channelCount = channels;
      console.log(`[AudioEngine] Output channels set to ${channels}`);
      return true;
    } catch (e) {
      console.error('[AudioEngine] Failed to set channel count:', e);
      return false;
    }
  }

  /**
   * Get the current output channel count
   */
  public getChannelCount(): number {
    return this.audioContext ? this.audioContext.destination.channelCount : 0;
  }

  /**
   * Get the maximum supported output channels
   */
  public getMaxChannelCount(): number {
    return this.audioContext ? this.audioContext.destination.maxChannelCount : 0;
  }

  /**
   * Get the master gain node
   */
  public getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  /**
   * Get the analyser node for visualization
   */
  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Get left channel analyser
   */
  public getAnalyserL(): AnalyserNode | null {
    return this.analyserL;
  }

  /**
   * Get right channel analyser
   */
  public getAnalyserR(): AnalyserNode | null {
    return this.analyserR;
  }

  /**
   * Get the current engine state
   */
  public getState(): AudioEngineState {
    return { ...this.state };
  }

  /**
   * Check if engine is initialized
   */
  public isInitialized(): boolean {
    return this.state.isInitialized;
  }

  /**
   * Check if audio context is running
   */
  public isRunning(): boolean {
    return this.audioContext?.state === 'running';
  }

  /**
   * Set master volume (0-1)
   */
  public setMasterVolume(volume: number): void {
    if (this.masterGain && this.audioContext) {
      const clampedVolume = clamp(volume, 0, 1);
      this.masterGain.gain.setTargetAtTime(
        clampedVolume,
        this.audioContext.currentTime,
        0.01
      );
    }
  }

  /**
   * Set master volume in dB
   */
  public setMasterVolumeDb(dB: number): void {
    this.setMasterVolume(dBToLinear(dB));
  }

  /**
   * Get master volume
   */
  public getMasterVolume(): number {
    return this.masterGain?.gain.value || 0;
  }

  /**
   * Get master volume in dB
   */
  public getMasterVolumeDb(): number {
    return linearToDb(this.getMasterVolume());
  }

  /**
   * Get current time from audio context
   */
  public getCurrentTime(): number {
    return this.audioContext?.currentTime || 0;
  }

  /**
   * Suspend the audio context (pause audio processing)
   */
  public async suspend(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'running') {
      await this.audioContext.suspend();
    }
  }

  /**
   * Resume the audio context
   */
  public async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Get frequency data for visualization
   */
  public getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  /**
   * Get time domain data for visualization
   */
  public getTimeDomainData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  /**
   * Get stereo peak levels
   */
  public getStereoLevels(): { left: number; right: number } {
    const getLevel = (analyser: AnalyserNode | null): number => {
      if (!analyser) return 0;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const value = Math.abs(data[i] - 128) / 128;
        if (value > peak) peak = value;
      }
      return peak;
    };
    
    return {
      left: getLevel(this.analyserL),
      right: getLevel(this.analyserR)
    };
  }

  /**
   * Register an AudioWorklet processor
   */
  public async registerWorklet(name: string, moduleUrl: string): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }
    
    // Check if already registered
    const existing = this.registeredWorklets.get(name);
    if (existing?.loaded) {
      console.log(`Worklet ${name} already registered`);
      return;
    }
    
    try {
      await this.audioContext.audioWorklet.addModule(moduleUrl);
      this.registeredWorklets.set(name, { name, url: moduleUrl, loaded: true });
      this.emitEvent({ type: 'workletLoaded', data: { name, url: moduleUrl } });
      console.log(`Worklet ${name} registered successfully`);
    } catch (error) {
      console.error(`Failed to register worklet ${name}:`, error);
      throw error;
    }
  }

  /**
   * Check if a worklet is registered
   */
  public isWorkletRegistered(name: string): boolean {
    return this.registeredWorklets.get(name)?.loaded || false;
  }

  /**
   * Create an AudioWorkletNode
   */
  public createWorkletNode(
    name: string,
    options?: AudioWorkletNodeOptions
  ): AudioWorkletNode | null {
    if (!this.audioContext) return null;
    if (!this.isWorkletRegistered(name)) {
      console.warn(`Worklet ${name} not registered`);
      return null;
    }
    return new AudioWorkletNode(this.audioContext, name, options);
  }

  /**
   * Register event callback
   */
  public onEvent(callback: AudioEngineEventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index !== -1) this.eventCallbacks.splice(index, 1);
    };
  }

  /**
   * Emit an event
   */
  private emitEvent(event: AudioEngineEvent): void {
    for (const callback of this.eventCallbacks) {
      try { callback(event); } catch (e) { console.error('Event callback error:', e); }
    }
  }

  /**
   * Decode audio data from ArrayBuffer
   */
  public async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }
    return this.audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Create an offline audio context for rendering
   */
  public createOfflineContext(
    numberOfChannels: number,
    length: number,
    sampleRate?: number
  ): OfflineAudioContext {
    return new OfflineAudioContext(
      numberOfChannels,
      length,
      sampleRate || this.state.sampleRate
    );
  }

  /**
   * Test audio output with a quick beep to verify audio is working
   */
  private testAudioOutput(): void {
    if (!this.audioContext) return;
    
    console.log('[AudioEngine] Testing audio output...');
    
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.audioContext.currentTime);
    
    gain.gain.setValueAtTime(0, this.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.2);
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    
    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + 0.2);
    
    console.log('[AudioEngine] Test beep played - if you heard a beep, audio is working');
  }

  /**
   * Dispose of the audio engine and clean up resources
   */
  public async dispose(): Promise<void> {
    // Stop transport
    if (this.transport) {
      this.transport.stop();
      this.transport.dispose();
    }

    // Dispose sequencer
    if (this.sequencer) {
      this.sequencer.dispose();
    }

    // Dispose audio graph
    if (this.audioGraph) {
      this.audioGraph.dispose();
    }

    // Disconnect master chain
    if (this.masterGain) this.masterGain.disconnect();
    if (this.masterLimiter) this.masterLimiter.disconnect();
    if (this.analyser) this.analyser.disconnect();
    if (this.analyserL) this.analyserL.disconnect();
    if (this.analyserR) this.analyserR.disconnect();
    if (this.splitter) this.splitter.disconnect();

    // Close audio context
    if (this.audioContext) {
      await this.audioContext.close();
    }

    // Reset state
    this.audioContext = null;
    this.audioGraph = null;
    this.transport = null;
    this.sequencer = null;
    this.masterGain = null;
    this.masterLimiter = null;
    this.analyser = null;
    this.analyserL = null;
    this.analyserR = null;
    this.splitter = null;
    this.state.isInitialized = false;
    this.registeredWorklets.clear();
    this.eventCallbacks = [];

    // Clear singleton
    AudioEngine.instance = null;
  }
}

// Export singleton getter
export const getAudioEngine = (): AudioEngine => AudioEngine.getInstance();