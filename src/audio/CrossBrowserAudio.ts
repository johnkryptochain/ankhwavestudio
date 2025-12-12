// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * CrossBrowserAudio - Unified API for all browsers
 * Provides feature detection, graceful degradation, and performance warnings
 */

import {
  detectCapabilities,
  createAudioContext,
  resumeAudioContext,
  ScriptProcessorFallback,
  SafariAudioWorkarounds,
  UnifiedAudioProcessor,
  getRecommendedBufferSize,
  checkAudioSupport,
  type BrowserCapabilities
} from './SafariPolyfill';

// ============================================================================
// Types
// ============================================================================

/**
 * Audio engine configuration
 */
export interface CrossBrowserAudioConfig {
  sampleRate?: number;
  bufferSize?: number;
  latencyHint?: AudioContextLatencyCategory | number;
  autoResume?: boolean;
  enableWorkarounds?: boolean;
}

/**
 * Audio engine state
 */
export interface AudioEngineState {
  initialized: boolean;
  running: boolean;
  sampleRate: number;
  bufferSize: number;
  latency: number;
  usingWorklet: boolean;
  usingFallback: boolean;
}

/**
 * Performance warning
 */
export interface PerformanceWarning {
  type: 'latency' | 'cpu' | 'buffer' | 'compatibility';
  message: string;
  severity: 'low' | 'medium' | 'high';
  suggestion?: string;
}

/**
 * Audio event
 */
export interface AudioEvent {
  type: 'initialized' | 'resumed' | 'suspended' | 'error' | 'warning' | 'stateChange';
  data?: unknown;
}

export type AudioEventCallback = (event: AudioEvent) => void;

// ============================================================================
// CrossBrowserAudio Class
// ============================================================================

/**
 * CrossBrowserAudio - Main class for cross-browser audio support
 */
export class CrossBrowserAudio {
  private static instance: CrossBrowserAudio | null = null;
  
  private audioContext: AudioContext | null = null;
  private capabilities: BrowserCapabilities;
  private config: CrossBrowserAudioConfig;
  
  // State
  private state: AudioEngineState = {
    initialized: false,
    running: false,
    sampleRate: 44100,
    bufferSize: 128,
    latency: 0,
    usingWorklet: false,
    usingFallback: false
  };
  
  // Workarounds
  private safariWorkarounds: SafariAudioWorkarounds | null = null;
  
  // Processors
  private processors: Map<string, UnifiedAudioProcessor> = new Map();
  
  // Event callbacks
  private eventCallbacks: AudioEventCallback[] = [];
  
  // Performance monitoring
  private warnings: PerformanceWarning[] = [];
  private lastPerformanceCheck: number = 0;
  
  private constructor(config: CrossBrowserAudioConfig = {}) {
    this.capabilities = detectCapabilities();
    this.config = {
      sampleRate: config.sampleRate || 44100,
      bufferSize: config.bufferSize || getRecommendedBufferSize(this.capabilities),
      latencyHint: config.latencyHint || 'interactive',
      autoResume: config.autoResume ?? true,
      enableWorkarounds: config.enableWorkarounds ?? true
    };
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(config?: CrossBrowserAudioConfig): CrossBrowserAudio {
    if (!CrossBrowserAudio.instance) {
      CrossBrowserAudio.instance = new CrossBrowserAudio(config);
    }
    return CrossBrowserAudio.instance;
  }
  
  /**
   * Initialize the audio engine
   */
  public async initialize(): Promise<void> {
    if (this.state.initialized) {
      console.warn('CrossBrowserAudio already initialized');
      return;
    }
    
    // Check support
    const support = checkAudioSupport();
    if (!support.supported) {
      const error = new Error(`Audio not supported: ${support.errors.join(', ')}`);
      this.emitEvent({ type: 'error', data: error });
      throw error;
    }
    
    // Log warnings
    for (const warning of support.warnings) {
      this.addWarning({
        type: 'compatibility',
        message: warning,
        severity: 'medium'
      });
    }
    
    try {
      // Create audio context
      this.audioContext = createAudioContext({
        sampleRate: this.config.sampleRate,
        latencyHint: this.config.latencyHint
      });
      
      // Update state
      this.state.sampleRate = this.audioContext.sampleRate;
      this.state.latency = this.audioContext.baseLatency || 0;
      
      // Set up Safari workarounds if needed
      if (this.config.enableWorkarounds && (this.capabilities.isSafari || this.capabilities.isIOS)) {
        this.safariWorkarounds = new SafariAudioWorkarounds(this.audioContext);
        this.safariWorkarounds.setupVisibilityHandler();
        
        if (this.capabilities.isIOS) {
          this.safariWorkarounds.keepAlive();
        }
      }
      
      // Auto-resume if configured
      if (this.config.autoResume) {
        await this.resume();
      }
      
      this.state.initialized = true;
      this.state.usingWorklet = this.capabilities.audioWorklet;
      this.state.usingFallback = !this.capabilities.audioWorklet;
      
      this.emitEvent({ type: 'initialized', data: this.state });
      
      // Start performance monitoring
      this.startPerformanceMonitoring();
      
    } catch (error) {
      this.emitEvent({ type: 'error', data: error });
      throw error;
    }
  }
  
  /**
   * Resume audio context
   */
  public async resume(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }
    
    await resumeAudioContext(this.audioContext);
    this.state.running = this.audioContext.state === 'running';
    
    if (this.state.running) {
      this.emitEvent({ type: 'resumed' });
    }
  }
  
  /**
   * Suspend audio context
   */
  public async suspend(): Promise<void> {
    if (!this.audioContext) return;
    
    await this.audioContext.suspend();
    this.state.running = false;
    
    this.emitEvent({ type: 'suspended' });
  }
  
  /**
   * Get audio context
   */
  public getContext(): AudioContext | null {
    return this.audioContext;
  }
  
  /**
   * Get browser capabilities
   */
  public getCapabilities(): BrowserCapabilities {
    return { ...this.capabilities };
  }
  
  /**
   * Get current state
   */
  public getState(): AudioEngineState {
    return { ...this.state };
  }
  
  /**
   * Check if running
   */
  public isRunning(): boolean {
    return this.state.running;
  }
  
  /**
   * Create a unified audio processor
   */
  public async createProcessor(
    id: string,
    processorCode: string,
    processorName: string
  ): Promise<UnifiedAudioProcessor> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }
    
    const processor = new UnifiedAudioProcessor(this.audioContext);
    await processor.initialize(processorCode, processorName);
    
    this.processors.set(id, processor);
    
    // Update state
    this.state.usingWorklet = processor.isUsingWorklet();
    this.state.usingFallback = !processor.isUsingWorklet();
    
    return processor;
  }
  
  /**
   * Get a processor by ID
   */
  public getProcessor(id: string): UnifiedAudioProcessor | undefined {
    return this.processors.get(id);
  }
  
  /**
   * Remove a processor
   */
  public removeProcessor(id: string): void {
    const processor = this.processors.get(id);
    if (processor) {
      processor.dispose();
      this.processors.delete(id);
    }
  }
  
  /**
   * Create a gain node
   */
  public createGain(): GainNode | null {
    return this.audioContext?.createGain() || null;
  }
  
  /**
   * Create an oscillator
   */
  public createOscillator(): OscillatorNode | null {
    return this.audioContext?.createOscillator() || null;
  }
  
  /**
   * Create a biquad filter
   */
  public createBiquadFilter(): BiquadFilterNode | null {
    return this.audioContext?.createBiquadFilter() || null;
  }
  
  /**
   * Create a delay node
   */
  public createDelay(maxDelayTime?: number): DelayNode | null {
    return this.audioContext?.createDelay(maxDelayTime) || null;
  }
  
  /**
   * Create a convolver
   */
  public createConvolver(): ConvolverNode | null {
    return this.audioContext?.createConvolver() || null;
  }
  
  /**
   * Create a dynamics compressor
   */
  public createDynamicsCompressor(): DynamicsCompressorNode | null {
    return this.audioContext?.createDynamicsCompressor() || null;
  }
  
  /**
   * Create an analyser
   */
  public createAnalyser(): AnalyserNode | null {
    return this.audioContext?.createAnalyser() || null;
  }
  
  /**
   * Create a buffer source
   */
  public createBufferSource(): AudioBufferSourceNode | null {
    return this.audioContext?.createBufferSource() || null;
  }
  
  /**
   * Create an audio buffer
   */
  public createBuffer(
    numberOfChannels: number,
    length: number,
    sampleRate?: number
  ): AudioBuffer | null {
    return this.audioContext?.createBuffer(
      numberOfChannels,
      length,
      sampleRate || this.state.sampleRate
    ) || null;
  }
  
  /**
   * Decode audio data
   */
  public async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }
    
    return this.audioContext.decodeAudioData(arrayBuffer);
  }
  
  /**
   * Get current time
   */
  public getCurrentTime(): number {
    return this.audioContext?.currentTime || 0;
  }
  
  /**
   * Get destination
   */
  public getDestination(): AudioDestinationNode | null {
    return this.audioContext?.destination || null;
  }
  
  /**
   * Add performance warning
   */
  private addWarning(warning: PerformanceWarning): void {
    this.warnings.push(warning);
    this.emitEvent({ type: 'warning', data: warning });
    
    // Keep only last 100 warnings
    if (this.warnings.length > 100) {
      this.warnings.shift();
    }
  }
  
  /**
   * Get all warnings
   */
  public getWarnings(): PerformanceWarning[] {
    return [...this.warnings];
  }
  
  /**
   * Clear warnings
   */
  public clearWarnings(): void {
    this.warnings = [];
  }
  
  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    const checkPerformance = () => {
      if (!this.audioContext || !this.state.running) return;
      
      const now = performance.now();
      
      // Check every 5 seconds
      if (now - this.lastPerformanceCheck < 5000) return;
      this.lastPerformanceCheck = now;
      
      // Check latency
      const latency = (this.audioContext.baseLatency || 0) + (this.audioContext.outputLatency || 0);
      if (latency > 0.05) { // > 50ms
        this.addWarning({
          type: 'latency',
          message: `High audio latency detected: ${(latency * 1000).toFixed(1)}ms`,
          severity: latency > 0.1 ? 'high' : 'medium',
          suggestion: 'Try reducing buffer size or closing other applications'
        });
      }
      
      // Check if using fallback
      if (this.state.usingFallback && !this.warnings.some(w => w.message.includes('ScriptProcessor'))) {
        this.addWarning({
          type: 'compatibility',
          message: 'Using ScriptProcessor fallback (higher latency)',
          severity: 'medium',
          suggestion: 'Update your browser for better audio performance'
        });
      }
    };
    
    // Check periodically
    setInterval(checkPerformance, 1000);
  }
  
  /**
   * Register event callback
   */
  public onEvent(callback: AudioEventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index !== -1) {
        this.eventCallbacks.splice(index, 1);
      }
    };
  }
  
  /**
   * Emit event
   */
  private emitEvent(event: AudioEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in audio event callback:', error);
      }
    }
  }
  
  /**
   * Get recommended settings for current browser
   */
  public getRecommendedSettings(): {
    bufferSize: number;
    sampleRate: number;
    latencyHint: AudioContextLatencyCategory;
  } {
    return {
      bufferSize: getRecommendedBufferSize(this.capabilities),
      sampleRate: this.capabilities.isIOS ? 44100 : 48000,
      latencyHint: this.capabilities.isMobile ? 'playback' : 'interactive'
    };
  }
  
  /**
   * Get browser-specific notes
   */
  public getBrowserNotes(): string[] {
    const notes: string[] = [];
    
    if (this.capabilities.isSafari) {
      notes.push('Safari detected - using WebKit-specific optimizations');
    }
    
    if (this.capabilities.isIOS) {
      notes.push("iOS détecté - l’audio nécessite une interaction utilisateur pour démarrer");
      notes.push('iOS detected - using larger buffer size for stability');
    }
    
    if (!this.capabilities.audioWorklet) {
      notes.push('AudioWorklet not supported - using ScriptProcessor fallback');
    }
    
    if (!this.capabilities.sharedArrayBuffer) {
      notes.push('SharedArrayBuffer not available - some features may have higher latency');
    }
    
    if (!this.capabilities.webMidi) {
      notes.push('Web MIDI not supported - MIDI input unavailable');
    }
    
    return notes;
  }
  
  /**
   * Dispose
   */
  public async dispose(): Promise<void> {
    // Dispose processors
    for (const processor of this.processors.values()) {
      processor.dispose();
    }
    this.processors.clear();
    
    // Dispose workarounds
    if (this.safariWorkarounds) {
      this.safariWorkarounds.dispose();
      this.safariWorkarounds = null;
    }
    
    // Close audio context
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    
    // Reset state
    this.state = {
      initialized: false,
      running: false,
      sampleRate: 44100,
      bufferSize: 128,
      latency: 0,
      usingWorklet: false,
      usingFallback: false
    };
    
    this.eventCallbacks = [];
    this.warnings = [];
    
    CrossBrowserAudio.instance = null;
  }
}

// ============================================================================
// Export utilities
// ============================================================================

/**
 * Get CrossBrowserAudio instance
 */
export function getCrossBrowserAudio(config?: CrossBrowserAudioConfig): CrossBrowserAudio {
  return CrossBrowserAudio.getInstance(config);
}

/**
 * Quick check if audio is supported
 */
export function isAudioSupported(): boolean {
  return checkAudioSupport().supported;
}

/**
 * Get browser audio capabilities
 */
export function getAudioCapabilities(): BrowserCapabilities {
  return detectCapabilities();
}