// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * LatencyCompensation - Automatic latency detection and plugin delay compensation
 * Ensures all audio paths are time-aligned for proper mixing
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Latency source information
 */
export interface LatencySource {
  id: string;
  name: string;
  type: 'plugin' | 'effect' | 'instrument' | 'system' | 'network';
  latencySamples: number;
  latencyMs: number;
  compensated: boolean;
}

/**
 * Audio path with latency information
 */
export interface AudioPath {
  id: string;
  sources: LatencySource[];
  totalLatencySamples: number;
  totalLatencyMs: number;
  compensationDelaySamples: number;
}

/**
 * Latency detection result
 */
export interface LatencyDetectionResult {
  inputLatency: number;
  outputLatency: number;
  roundTripLatency: number;
  bufferLatency: number;
  totalLatency: number;
  confidence: number;
}

/**
 * Compensation settings
 */
export interface CompensationSettings {
  enabled: boolean;
  automaticDetection: boolean;
  manualOffset: number;
  lookahead: number;
  maxCompensation: number;
}

// ============================================================================
// Delay Line for Compensation
// ============================================================================

/**
 * Simple delay line for latency compensation
 */
export class DelayLine {
  private buffer: Float32Array;
  private writeIndex: number = 0;
  private delaySamples: number;
  private maxDelay: number;
  
  constructor(maxDelaySamples: number) {
    this.maxDelay = maxDelaySamples;
    this.buffer = new Float32Array(maxDelaySamples);
    this.delaySamples = 0;
  }
  
  /**
   * Set delay in samples
   */
  setDelay(samples: number): void {
    this.delaySamples = Math.min(Math.max(0, Math.floor(samples)), this.maxDelay - 1);
  }
  
  /**
   * Get current delay in samples
   */
  getDelay(): number {
    return this.delaySamples;
  }
  
  /**
   * Process a single sample
   */
  process(input: number): number {
    // Write to buffer
    this.buffer[this.writeIndex] = input;
    
    // Calculate read position
    let readIndex = this.writeIndex - this.delaySamples;
    if (readIndex < 0) {
      readIndex += this.maxDelay;
    }
    
    // Read from buffer
    const output = this.buffer[readIndex];
    
    // Advance write position
    this.writeIndex = (this.writeIndex + 1) % this.maxDelay;
    
    return output;
  }
  
  /**
   * Process a block of samples
   */
  processBlock(input: Float32Array, output: Float32Array): void {
    for (let i = 0; i < input.length; i++) {
      output[i] = this.process(input[i]);
    }
  }
  
  /**
   * Clear the delay buffer
   */
  clear(): void {
    this.buffer.fill(0);
    this.writeIndex = 0;
  }
}

/**
 * Stereo delay line
 */
export class StereoDelayLine {
  private leftDelay: DelayLine;
  private rightDelay: DelayLine;
  
  constructor(maxDelaySamples: number) {
    this.leftDelay = new DelayLine(maxDelaySamples);
    this.rightDelay = new DelayLine(maxDelaySamples);
  }
  
  setDelay(samples: number): void {
    this.leftDelay.setDelay(samples);
    this.rightDelay.setDelay(samples);
  }
  
  getDelay(): number {
    return this.leftDelay.getDelay();
  }
  
  processBlock(
    inputL: Float32Array,
    inputR: Float32Array,
    outputL: Float32Array,
    outputR: Float32Array
  ): void {
    this.leftDelay.processBlock(inputL, outputL);
    this.rightDelay.processBlock(inputR, outputR);
  }
  
  clear(): void {
    this.leftDelay.clear();
    this.rightDelay.clear();
  }
}

// ============================================================================
// Latency Compensation Manager
// ============================================================================

/**
 * LatencyCompensation - Manages latency detection and compensation
 */
export class LatencyCompensation {
  private audioContext: AudioContext | null = null;
  private sampleRate: number = 44100;
  
  // Latency sources
  private sources: Map<string, LatencySource> = new Map();
  
  // Audio paths
  private paths: Map<string, AudioPath> = new Map();
  
  // Compensation delay lines
  private delayLines: Map<string, StereoDelayLine> = new Map();
  
  // Settings
  private settings: CompensationSettings = {
    enabled: true,
    automaticDetection: true,
    manualOffset: 0,
    lookahead: 0,
    maxCompensation: 44100 // 1 second max
  };
  
  // Detection state
  private detectionResult: LatencyDetectionResult | null = null;
  private isDetecting: boolean = false;
  
  // Maximum latency across all paths
  private maxPathLatency: number = 0;
  
  constructor() {}
  
  /**
   * Initialize with audio context
   */
  initialize(audioContext: AudioContext): void {
    this.audioContext = audioContext;
    this.sampleRate = audioContext.sampleRate;
    
    // Get base latency from audio context
    const baseLatency = audioContext.baseLatency || 0;
    const outputLatency = audioContext.outputLatency || 0;
    
    // Register system latency
    this.registerSource({
      id: 'system-output',
      name: 'System Output',
      type: 'system',
      latencySamples: Math.round((baseLatency + outputLatency) * this.sampleRate),
      latencyMs: (baseLatency + outputLatency) * 1000,
      compensated: false
    });
  }
  
  /**
   * Register a latency source
   */
  registerSource(source: LatencySource): void {
    this.sources.set(source.id, source);
    this.recalculatePaths();
  }
  
  /**
   * Unregister a latency source
   */
  unregisterSource(id: string): void {
    this.sources.delete(id);
    this.recalculatePaths();
  }
  
  /**
   * Update a source's latency
   */
  updateSourceLatency(id: string, latencySamples: number): void {
    const source = this.sources.get(id);
    if (source) {
      source.latencySamples = latencySamples;
      source.latencyMs = (latencySamples / this.sampleRate) * 1000;
      this.recalculatePaths();
    }
  }
  
  /**
   * Register an audio path
   */
  registerPath(pathId: string, sourceIds: string[]): void {
    const sources = sourceIds
      .map(id => this.sources.get(id))
      .filter((s): s is LatencySource => s !== undefined);
    
    const totalLatencySamples = sources.reduce((sum, s) => sum + s.latencySamples, 0);
    
    const path: AudioPath = {
      id: pathId,
      sources,
      totalLatencySamples,
      totalLatencyMs: (totalLatencySamples / this.sampleRate) * 1000,
      compensationDelaySamples: 0
    };
    
    this.paths.set(pathId, path);
    
    // Create delay line for this path
    this.delayLines.set(pathId, new StereoDelayLine(this.settings.maxCompensation));
    
    this.recalculateCompensation();
  }
  
  /**
   * Unregister an audio path
   */
  unregisterPath(pathId: string): void {
    this.paths.delete(pathId);
    
    const delayLine = this.delayLines.get(pathId);
    if (delayLine) {
      delayLine.clear();
      this.delayLines.delete(pathId);
    }
    
    this.recalculateCompensation();
  }
  
  /**
   * Recalculate all path latencies
   */
  private recalculatePaths(): void {
    for (const [pathId, path] of this.paths) {
      const totalLatencySamples = path.sources.reduce((sum, s) => {
        const source = this.sources.get(s.id);
        return sum + (source?.latencySamples || 0);
      }, 0);
      
      path.totalLatencySamples = totalLatencySamples;
      path.totalLatencyMs = (totalLatencySamples / this.sampleRate) * 1000;
    }
    
    this.recalculateCompensation();
  }
  
  /**
   * Recalculate compensation delays
   */
  private recalculateCompensation(): void {
    if (!this.settings.enabled) {
      // Clear all compensation
      for (const [pathId, delayLine] of this.delayLines) {
        delayLine.setDelay(0);
        const path = this.paths.get(pathId);
        if (path) {
          path.compensationDelaySamples = 0;
        }
      }
      return;
    }
    
    // Find maximum latency
    this.maxPathLatency = 0;
    for (const path of this.paths.values()) {
      if (path.totalLatencySamples > this.maxPathLatency) {
        this.maxPathLatency = path.totalLatencySamples;
      }
    }
    
    // Add lookahead
    const targetLatency = this.maxPathLatency + this.settings.lookahead + this.settings.manualOffset;
    
    // Set compensation delays
    for (const [pathId, path] of this.paths) {
      const compensationDelay = targetLatency - path.totalLatencySamples;
      path.compensationDelaySamples = Math.max(0, compensationDelay);
      
      const delayLine = this.delayLines.get(pathId);
      if (delayLine) {
        delayLine.setDelay(path.compensationDelaySamples);
      }
    }
  }
  
  /**
   * Get delay line for a path
   */
  getDelayLine(pathId: string): StereoDelayLine | undefined {
    return this.delayLines.get(pathId);
  }
  
  /**
   * Process audio through compensation delay
   */
  processPath(
    pathId: string,
    inputL: Float32Array,
    inputR: Float32Array,
    outputL: Float32Array,
    outputR: Float32Array
  ): void {
    const delayLine = this.delayLines.get(pathId);
    if (delayLine && this.settings.enabled) {
      delayLine.processBlock(inputL, inputR, outputL, outputR);
    } else {
      // Pass through
      outputL.set(inputL);
      outputR.set(inputR);
    }
  }
  
  /**
   * Detect system latency using loopback test
   */
  async detectLatency(): Promise<LatencyDetectionResult> {
    if (!this.audioContext || this.isDetecting) {
      throw new Error('Cannot detect latency');
    }
    
    this.isDetecting = true;
    
    try {
      // Create test signal
      const testDuration = 0.5; // 500ms
      const testSamples = Math.floor(this.sampleRate * testDuration);
      const testBuffer = this.audioContext.createBuffer(1, testSamples, this.sampleRate);
      const testData = testBuffer.getChannelData(0);
      
      // Generate impulse
      testData[0] = 1.0;
      
      // Create nodes
      const source = this.audioContext.createBufferSource();
      source.buffer = testBuffer;
      
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 2048;
      
      // Connect
      source.connect(analyser);
      analyser.connect(this.audioContext.destination);
      
      // Record start time
      const startTime = this.audioContext.currentTime;
      source.start(startTime);
      
      // Wait for playback
      await new Promise(resolve => setTimeout(resolve, testDuration * 1000 + 100));
      
      // Calculate latencies
      const bufferLatency = (this.audioContext.baseLatency || 0) * 1000;
      const outputLatency = (this.audioContext.outputLatency || 0) * 1000;
      
      // Estimate input latency (typically similar to output)
      const inputLatency = outputLatency;
      
      const result: LatencyDetectionResult = {
        inputLatency,
        outputLatency,
        roundTripLatency: inputLatency + outputLatency,
        bufferLatency,
        totalLatency: inputLatency + outputLatency + bufferLatency,
        confidence: 0.8 // Estimated confidence
      };
      
      this.detectionResult = result;
      
      // Update system latency source
      this.updateSourceLatency(
        'system-output',
        Math.round(result.totalLatency * this.sampleRate / 1000)
      );
      
      return result;
    } finally {
      this.isDetecting = false;
    }
  }
  
  /**
   * Get detection result
   */
  getDetectionResult(): LatencyDetectionResult | null {
    return this.detectionResult;
  }
  
  /**
   * Get all latency sources
   */
  getSources(): LatencySource[] {
    return Array.from(this.sources.values());
  }
  
  /**
   * Get all audio paths
   */
  getPaths(): AudioPath[] {
    return Array.from(this.paths.values());
  }
  
  /**
   * Get maximum path latency
   */
  getMaxPathLatency(): number {
    return this.maxPathLatency;
  }
  
  /**
   * Get maximum path latency in milliseconds
   */
  getMaxPathLatencyMs(): number {
    return (this.maxPathLatency / this.sampleRate) * 1000;
  }
  
  /**
   * Get settings
   */
  getSettings(): CompensationSettings {
    return { ...this.settings };
  }
  
  /**
   * Update settings
   */
  setSettings(settings: Partial<CompensationSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.recalculateCompensation();
  }
  
  /**
   * Enable/disable compensation
   */
  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    this.recalculateCompensation();
  }
  
  /**
   * Set manual offset
   */
  setManualOffset(samples: number): void {
    this.settings.manualOffset = samples;
    this.recalculateCompensation();
  }
  
  /**
   * Set lookahead
   */
  setLookahead(samples: number): void {
    this.settings.lookahead = samples;
    this.recalculateCompensation();
  }
  
  /**
   * Convert samples to milliseconds
   */
  samplesToMs(samples: number): number {
    return (samples / this.sampleRate) * 1000;
  }
  
  /**
   * Convert milliseconds to samples
   */
  msToSamples(ms: number): number {
    return Math.round((ms / 1000) * this.sampleRate);
  }
  
  /**
   * Get report of all latencies
   */
  getLatencyReport(): {
    sources: LatencySource[];
    paths: AudioPath[];
    maxLatency: number;
    maxLatencyMs: number;
    compensationEnabled: boolean;
  } {
    return {
      sources: this.getSources(),
      paths: this.getPaths(),
      maxLatency: this.maxPathLatency,
      maxLatencyMs: this.getMaxPathLatencyMs(),
      compensationEnabled: this.settings.enabled
    };
  }
  
  /**
   * Clear all delay lines
   */
  clearDelayLines(): void {
    for (const delayLine of this.delayLines.values()) {
      delayLine.clear();
    }
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    this.clearDelayLines();
    this.sources.clear();
    this.paths.clear();
    this.delayLines.clear();
    this.audioContext = null;
  }
}

// Export singleton
let latencyCompensationInstance: LatencyCompensation | null = null;

export function getLatencyCompensation(): LatencyCompensation {
  if (!latencyCompensationInstance) {
    latencyCompensationInstance = new LatencyCompensation();
  }
  return latencyCompensationInstance;
}