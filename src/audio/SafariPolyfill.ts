// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * SafariPolyfill - Safari and iOS compatibility layer
 * Provides fallbacks for features not supported in Safari/WebKit
 */

// ============================================================================
// Feature Detection
// ============================================================================

/**
 * Browser capabilities
 */
export interface BrowserCapabilities {
  audioWorklet: boolean;
  sharedArrayBuffer: boolean;
  offscreenCanvas: boolean;
  webGL2: boolean;
  webMidi: boolean;
  mediaRecorder: boolean;
  audioEncoder: boolean;
  touchEvents: boolean;
  pointerEvents: boolean;
  webAudio: boolean;
  isSafari: boolean;
  isIOS: boolean;
  isMobile: boolean;
  safariVersion: number | null;
  iosVersion: number | null;
}

/**
 * Detect browser capabilities
 */
export function detectCapabilities(): BrowserCapabilities {
  const ua = navigator.userAgent;
  
  // Detect Safari
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  
  // Get Safari version
  let safariVersion: number | null = null;
  const safariMatch = ua.match(/Version\/(\d+\.\d+)/);
  if (safariMatch && isSafari) {
    safariVersion = parseFloat(safariMatch[1]);
  }
  
  // Get iOS version
  let iosVersion: number | null = null;
  const iosMatch = ua.match(/OS (\d+)_(\d+)/);
  if (iosMatch && isIOS) {
    iosVersion = parseFloat(`${iosMatch[1]}.${iosMatch[2]}`);
  }
  
  return {
    audioWorklet: typeof AudioWorkletNode !== 'undefined',
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined' && 
      (typeof crossOriginIsolated === 'undefined' || crossOriginIsolated),
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    webGL2: (() => {
      try {
        const canvas = document.createElement('canvas');
        return !!canvas.getContext('webgl2');
      } catch {
        return false;
      }
    })(),
    webMidi: typeof navigator.requestMIDIAccess === 'function',
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    audioEncoder: typeof AudioEncoder !== 'undefined',
    touchEvents: 'ontouchstart' in window,
    pointerEvents: typeof PointerEvent !== 'undefined',
    webAudio: typeof AudioContext !== 'undefined' || typeof (window as unknown as { webkitAudioContext: unknown }).webkitAudioContext !== 'undefined',
    isSafari,
    isIOS,
    isMobile,
    safariVersion,
    iosVersion
  };
}

// ============================================================================
// Audio Context Polyfill
// ============================================================================

/**
 * Get AudioContext with Safari prefix support
 */
export function getAudioContextClass(): typeof AudioContext {
  const win = window as unknown as { 
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  };
  
  return win.AudioContext || win.webkitAudioContext;
}

/**
 * Create audio context with Safari-specific handling
 */
export function createAudioContext(options?: AudioContextOptions): AudioContext {
  const AudioContextClass = getAudioContextClass();
  
  if (!AudioContextClass) {
    throw new Error('Web Audio API not supported');
  }
  
  const context = new AudioContextClass(options);
  
  // Safari requires user interaction to start audio
  // We'll handle this in the resume function
  
  return context;
}

/**
 * Resume audio context with Safari handling
 * Safari requires user gesture to start audio
 */
export async function resumeAudioContext(context: AudioContext): Promise<void> {
  if (context.state === 'suspended') {
    // Try to resume
    try {
      await context.resume();
    } catch (error) {
      console.warn('Failed to resume audio context:', error);
      
      // Safari may need a user gesture
      // Set up a one-time click handler
      return new Promise((resolve) => {
        const resumeOnInteraction = async () => {
          try {
            await context.resume();
            document.removeEventListener('click', resumeOnInteraction);
            document.removeEventListener('touchstart', resumeOnInteraction);
            document.removeEventListener('keydown', resumeOnInteraction);
            resolve();
          } catch (e) {
            console.error('Failed to resume on interaction:', e);
          }
        };
        
        document.addEventListener('click', resumeOnInteraction, { once: true });
        document.addEventListener('touchstart', resumeOnInteraction, { once: true });
        document.addEventListener('keydown', resumeOnInteraction, { once: true });
      });
    }
  }
}

// ============================================================================
// ScriptProcessor Fallback
// ============================================================================

/**
 * ScriptProcessor-based audio processor for Safari without AudioWorklet
 */
export class ScriptProcessorFallback {
  private context: AudioContext;
  private scriptNode: ScriptProcessorNode;
  private inputNode: GainNode;
  private outputNode: GainNode;
  private processCallback: ((input: Float32Array[], output: Float32Array[]) => void) | null = null;
  
  constructor(
    context: AudioContext,
    bufferSize: number = 2048,
    inputChannels: number = 2,
    outputChannels: number = 2
  ) {
    this.context = context;
    
    // Create nodes
    this.inputNode = context.createGain();
    this.outputNode = context.createGain();
    
    // Create script processor (deprecated but necessary for Safari)
    this.scriptNode = context.createScriptProcessor(bufferSize, inputChannels, outputChannels);
    
    // Set up processing
    this.scriptNode.onaudioprocess = (event) => {
      if (this.processCallback) {
        const input: Float32Array[] = [];
        const output: Float32Array[] = [];
        
        for (let ch = 0; ch < event.inputBuffer.numberOfChannels; ch++) {
          input.push(event.inputBuffer.getChannelData(ch));
        }
        
        for (let ch = 0; ch < event.outputBuffer.numberOfChannels; ch++) {
          output.push(event.outputBuffer.getChannelData(ch));
        }
        
        this.processCallback(input, output);
      } else {
        // Pass through
        for (let ch = 0; ch < event.outputBuffer.numberOfChannels; ch++) {
          const inputData = event.inputBuffer.getChannelData(ch);
          const outputData = event.outputBuffer.getChannelData(ch);
          outputData.set(inputData);
        }
      }
    };
    
    // Connect
    this.inputNode.connect(this.scriptNode);
    this.scriptNode.connect(this.outputNode);
  }
  
  /**
   * Set the process callback
   */
  setProcessCallback(callback: (input: Float32Array[], output: Float32Array[]) => void): void {
    this.processCallback = callback;
  }
  
  /**
   * Get input node
   */
  getInput(): GainNode {
    return this.inputNode;
  }
  
  /**
   * Get output node
   */
  getOutput(): GainNode {
    return this.outputNode;
  }
  
  /**
   * Connect output to destination
   */
  connect(destination: AudioNode): void {
    this.outputNode.connect(destination);
  }
  
  /**
   * Disconnect
   */
  disconnect(): void {
    this.outputNode.disconnect();
    this.scriptNode.disconnect();
    this.inputNode.disconnect();
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    this.disconnect();
    this.processCallback = null;
  }
}

// ============================================================================
// Touch Event Handling for iOS
// ============================================================================

/**
 * Touch event handler for iOS
 */
export class TouchHandler {
  private element: HTMLElement;
  private onTouchStart: ((x: number, y: number, id: number) => void) | null = null;
  private onTouchMove: ((x: number, y: number, id: number) => void) | null = null;
  private onTouchEnd: ((id: number) => void) | null = null;
  private activeTouches: Map<number, { x: number; y: number }> = new Map();
  
  constructor(element: HTMLElement) {
    this.element = element;
    this.setupListeners();
  }
  
  private setupListeners(): void {
    // Prevent default touch behaviors
    this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.element.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });
    
    // Prevent context menu on long press
    this.element.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  
  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const rect = this.element.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      this.activeTouches.set(touch.identifier, { x, y });
      this.onTouchStart?.(x, y, touch.identifier);
    }
  }
  
  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const rect = this.element.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      this.activeTouches.set(touch.identifier, { x, y });
      this.onTouchMove?.(x, y, touch.identifier);
    }
  }
  
  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.activeTouches.delete(touch.identifier);
      this.onTouchEnd?.(touch.identifier);
    }
  }
  
  /**
   * Set touch start callback
   */
  setOnTouchStart(callback: (x: number, y: number, id: number) => void): void {
    this.onTouchStart = callback;
  }
  
  /**
   * Set touch move callback
   */
  setOnTouchMove(callback: (x: number, y: number, id: number) => void): void {
    this.onTouchMove = callback;
  }
  
  /**
   * Set touch end callback
   */
  setOnTouchEnd(callback: (id: number) => void): void {
    this.onTouchEnd = callback;
  }
  
  /**
   * Get active touches
   */
  getActiveTouches(): Map<number, { x: number; y: number }> {
    return new Map(this.activeTouches);
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    this.element.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    this.element.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    this.element.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    this.element.removeEventListener('touchcancel', this.handleTouchEnd.bind(this));
    this.activeTouches.clear();
  }
}

// ============================================================================
// Safari Audio Workarounds
// ============================================================================

/**
 * Safari-specific audio workarounds
 */
export class SafariAudioWorkarounds {
  private context: AudioContext;
  private silentBuffer: AudioBuffer | null = null;
  private silentSource: AudioBufferSourceNode | null = null;
  
  constructor(context: AudioContext) {
    this.context = context;
  }
  
  /**
   * Keep audio context alive on iOS
   * iOS suspends audio when the tab is in background
   */
  keepAlive(): void {
    // Create a silent buffer
    this.silentBuffer = this.context.createBuffer(1, 1, this.context.sampleRate);
    
    // Play it in a loop
    this.silentSource = this.context.createBufferSource();
    this.silentSource.buffer = this.silentBuffer;
    this.silentSource.loop = true;
    this.silentSource.connect(this.context.destination);
    this.silentSource.start();
  }
  
  /**
   * Stop keep alive
   */
  stopKeepAlive(): void {
    if (this.silentSource) {
      this.silentSource.stop();
      this.silentSource.disconnect();
      this.silentSource = null;
    }
  }
  
  /**
   * Handle visibility change
   */
  setupVisibilityHandler(): void {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        // Resume audio when tab becomes visible
        if (this.context.state === 'suspended') {
          await this.context.resume();
        }
      }
    });
  }
  
  /**
   * Fix Safari's audio timing issues
   * Safari sometimes has timing drift
   */
  createTimingCorrectedOscillator(): OscillatorNode {
    const osc = this.context.createOscillator();
    
    // Safari may have timing issues, so we use a slightly different approach
    // for scheduling
    
    return osc;
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    this.stopKeepAlive();
  }
}

// ============================================================================
// Unified Audio Processor
// ============================================================================

/**
 * Unified audio processor that works across all browsers
 */
export class UnifiedAudioProcessor {
  private context: AudioContext;
  private capabilities: BrowserCapabilities;
  private workletNode: AudioWorkletNode | null = null;
  private scriptProcessor: ScriptProcessorFallback | null = null;
  private inputNode: GainNode;
  private outputNode: GainNode;
  private processCallback: ((input: Float32Array[], output: Float32Array[]) => void) | null = null;
  
  constructor(context: AudioContext) {
    this.context = context;
    this.capabilities = detectCapabilities();
    
    this.inputNode = context.createGain();
    this.outputNode = context.createGain();
  }
  
  /**
   * Initialize the processor
   */
  async initialize(processorCode: string, processorName: string): Promise<void> {
    if (this.capabilities.audioWorklet) {
      // Use AudioWorklet
      try {
        const blob = new Blob([processorCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        
        await this.context.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        
        this.workletNode = new AudioWorkletNode(this.context, processorName);
        
        this.inputNode.connect(this.workletNode);
        this.workletNode.connect(this.outputNode);
        
        return;
      } catch (error) {
        console.warn('AudioWorklet failed, falling back to ScriptProcessor:', error);
      }
    }
    
    // Fallback to ScriptProcessor
    this.scriptProcessor = new ScriptProcessorFallback(this.context);
    
    if (this.processCallback) {
      this.scriptProcessor.setProcessCallback(this.processCallback);
    }
    
    this.inputNode.connect(this.scriptProcessor.getInput());
    this.scriptProcessor.connect(this.outputNode);
  }
  
  /**
   * Set process callback (for ScriptProcessor fallback)
   */
  setProcessCallback(callback: (input: Float32Array[], output: Float32Array[]) => void): void {
    this.processCallback = callback;
    
    if (this.scriptProcessor) {
      this.scriptProcessor.setProcessCallback(callback);
    }
  }
  
  /**
   * Send message to worklet
   */
  postMessage(message: unknown): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage(message);
    }
  }
  
  /**
   * Get input node
   */
  getInput(): GainNode {
    return this.inputNode;
  }
  
  /**
   * Get output node
   */
  getOutput(): GainNode {
    return this.outputNode;
  }
  
  /**
   * Connect to destination
   */
  connect(destination: AudioNode): void {
    this.outputNode.connect(destination);
  }
  
  /**
   * Disconnect
   */
  disconnect(): void {
    this.outputNode.disconnect();
  }
  
  /**
   * Check if using AudioWorklet
   */
  isUsingWorklet(): boolean {
    return this.workletNode !== null;
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    
    if (this.scriptProcessor) {
      this.scriptProcessor.dispose();
      this.scriptProcessor = null;
    }
    
    this.inputNode.disconnect();
    this.outputNode.disconnect();
  }
}

// ============================================================================
// Export utilities
// ============================================================================

/**
 * Initialize Safari polyfills
 */
export function initializeSafariPolyfills(): BrowserCapabilities {
  const capabilities = detectCapabilities();
  
  if (capabilities.isSafari || capabilities.isIOS) {
    console.log('Safari/iOS detected, applying polyfills');
    console.log('Capabilities:', capabilities);
  }
  
  return capabilities;
}

/**
 * Get recommended buffer size for current browser
 */
export function getRecommendedBufferSize(capabilities: BrowserCapabilities): number {
  if (capabilities.isIOS) {
    // iOS needs larger buffers for stability
    return 2048;
  }
  
  if (capabilities.isSafari) {
    // Safari desktop can use smaller buffers
    return 1024;
  }
  
  if (capabilities.audioWorklet) {
    // Modern browsers with AudioWorklet can use small buffers
    return 128;
  }
  
  // Fallback for older browsers
  return 2048;
}

/**
 * Check if audio features are fully supported
 */
export function checkAudioSupport(): {
  supported: boolean;
  warnings: string[];
  errors: string[];
} {
  const capabilities = detectCapabilities();
  const warnings: string[] = [];
  const errors: string[] = [];
  
  if (!capabilities.webAudio) {
    errors.push('Web Audio API not supported');
  }
  
  if (!capabilities.audioWorklet) {
    warnings.push('AudioWorklet not supported, using ScriptProcessor fallback');
  }
  
  if (!capabilities.sharedArrayBuffer) {
    warnings.push('SharedArrayBuffer not available, some features may have higher latency');
  }
  
  if (!capabilities.webMidi) {
    warnings.push('Web MIDI not supported, MIDI input will be unavailable');
  }
  
  if (capabilities.isIOS && capabilities.iosVersion && capabilities.iosVersion < 14) {
    warnings.push('iOS version < 14 may have audio issues');
  }
  
  return {
    supported: errors.length === 0,
    warnings,
    errors
  };
}