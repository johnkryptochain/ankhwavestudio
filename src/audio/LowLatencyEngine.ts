// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * LowLatencyEngine - Optimized audio engine for minimal latency
 * Uses SharedArrayBuffer for lock-free audio processing
 * Implements double-buffering and ring buffers for optimal performance
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Low latency configuration
 */
export interface LowLatencyConfig {
  bufferSize: 32 | 64 | 128 | 256 | 512;
  sampleRate: number;
  numChannels: number;
  useSharedArrayBuffer: boolean;
  useDoubleBuffering: boolean;
  workerUrl?: string;
}

/**
 * Audio buffer state
 */
export interface BufferState {
  writeIndex: number;
  readIndex: number;
  bufferSize: number;
  underruns: number;
  overruns: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  cpuUsage: number;
  bufferUnderruns: number;
  gcPauses: number;
  lastProcessTime: number;
}

/**
 * Ring buffer for lock-free audio processing
 */
export class RingBuffer {
  private buffer: Float32Array;
  private writeIndex: number = 0;
  private readIndex: number = 0;
  private size: number;
  
  constructor(size: number) {
    this.size = size;
    this.buffer = new Float32Array(size);
  }
  
  /**
   * Write samples to the buffer
   */
  write(samples: Float32Array): number {
    const available = this.availableWrite();
    const toWrite = Math.min(samples.length, available);
    
    for (let i = 0; i < toWrite; i++) {
      this.buffer[this.writeIndex] = samples[i];
      this.writeIndex = (this.writeIndex + 1) % this.size;
    }
    
    return toWrite;
  }
  
  /**
   * Read samples from the buffer
   */
  read(output: Float32Array): number {
    const available = this.availableRead();
    const toRead = Math.min(output.length, available);
    
    for (let i = 0; i < toRead; i++) {
      output[i] = this.buffer[this.readIndex];
      this.readIndex = (this.readIndex + 1) % this.size;
    }
    
    // Fill remaining with zeros if not enough samples
    for (let i = toRead; i < output.length; i++) {
      output[i] = 0;
    }
    
    return toRead;
  }
  
  /**
   * Get available samples to read
   */
  availableRead(): number {
    if (this.writeIndex >= this.readIndex) {
      return this.writeIndex - this.readIndex;
    }
    return this.size - this.readIndex + this.writeIndex;
  }
  
  /**
   * Get available space to write
   */
  availableWrite(): number {
    return this.size - this.availableRead() - 1;
  }
  
  /**
   * Clear the buffer
   */
  clear(): void {
    this.writeIndex = 0;
    this.readIndex = 0;
    this.buffer.fill(0);
  }
  
  /**
   * Get buffer state
   */
  getState(): BufferState {
    return {
      writeIndex: this.writeIndex,
      readIndex: this.readIndex,
      bufferSize: this.size,
      underruns: 0,
      overruns: 0
    };
  }
}

/**
 * Lock-free ring buffer using SharedArrayBuffer
 * For use with AudioWorklet in a separate thread
 */
export class SharedRingBuffer {
  private buffer: Float32Array;
  private stateBuffer: Int32Array;
  private size: number;
  
  // State indices
  private static readonly WRITE_INDEX = 0;
  private static readonly READ_INDEX = 1;
  private static readonly UNDERRUNS = 2;
  private static readonly OVERRUNS = 3;
  
  constructor(sharedBuffer: SharedArrayBuffer, size: number) {
    this.size = size;
    
    // First 16 bytes for state (4 Int32 values)
    this.stateBuffer = new Int32Array(sharedBuffer, 0, 4);
    
    // Rest for audio data
    this.buffer = new Float32Array(sharedBuffer, 16, size);
  }
  
  /**
   * Create a new SharedRingBuffer with its own SharedArrayBuffer
   */
  static create(size: number): { buffer: SharedRingBuffer; sharedBuffer: SharedArrayBuffer } {
    const byteLength = 16 + size * 4; // 16 bytes state + float32 audio
    const sharedBuffer = new SharedArrayBuffer(byteLength);
    const buffer = new SharedRingBuffer(sharedBuffer, size);
    return { buffer, sharedBuffer };
  }
  
  /**
   * Write samples atomically
   */
  write(samples: Float32Array): number {
    const writeIndex = Atomics.load(this.stateBuffer, SharedRingBuffer.WRITE_INDEX);
    const readIndex = Atomics.load(this.stateBuffer, SharedRingBuffer.READ_INDEX);
    
    const available = this.calculateAvailableWrite(writeIndex, readIndex);
    const toWrite = Math.min(samples.length, available);
    
    if (toWrite < samples.length) {
      Atomics.add(this.stateBuffer, SharedRingBuffer.OVERRUNS, 1);
    }
    
    let currentWrite = writeIndex;
    for (let i = 0; i < toWrite; i++) {
      this.buffer[currentWrite] = samples[i];
      currentWrite = (currentWrite + 1) % this.size;
    }
    
    Atomics.store(this.stateBuffer, SharedRingBuffer.WRITE_INDEX, currentWrite);
    
    return toWrite;
  }
  
  /**
   * Read samples atomically
   */
  read(output: Float32Array): number {
    const writeIndex = Atomics.load(this.stateBuffer, SharedRingBuffer.WRITE_INDEX);
    const readIndex = Atomics.load(this.stateBuffer, SharedRingBuffer.READ_INDEX);
    
    const available = this.calculateAvailableRead(writeIndex, readIndex);
    const toRead = Math.min(output.length, available);
    
    if (toRead < output.length) {
      Atomics.add(this.stateBuffer, SharedRingBuffer.UNDERRUNS, 1);
    }
    
    let currentRead = readIndex;
    for (let i = 0; i < toRead; i++) {
      output[i] = this.buffer[currentRead];
      currentRead = (currentRead + 1) % this.size;
    }
    
    // Fill remaining with zeros
    for (let i = toRead; i < output.length; i++) {
      output[i] = 0;
    }
    
    Atomics.store(this.stateBuffer, SharedRingBuffer.READ_INDEX, currentRead);
    
    return toRead;
  }
  
  private calculateAvailableRead(writeIndex: number, readIndex: number): number {
    if (writeIndex >= readIndex) {
      return writeIndex - readIndex;
    }
    return this.size - readIndex + writeIndex;
  }
  
  private calculateAvailableWrite(writeIndex: number, readIndex: number): number {
    return this.size - this.calculateAvailableRead(writeIndex, readIndex) - 1;
  }
  
  /**
   * Get underrun count
   */
  getUnderruns(): number {
    return Atomics.load(this.stateBuffer, SharedRingBuffer.UNDERRUNS);
  }
  
  /**
   * Get overrun count
   */
  getOverruns(): number {
    return Atomics.load(this.stateBuffer, SharedRingBuffer.OVERRUNS);
  }
  
  /**
   * Reset counters
   */
  resetCounters(): void {
    Atomics.store(this.stateBuffer, SharedRingBuffer.UNDERRUNS, 0);
    Atomics.store(this.stateBuffer, SharedRingBuffer.OVERRUNS, 0);
  }
}

/**
 * Double buffer for smooth audio processing
 */
export class DoubleBuffer {
  private bufferA: Float32Array;
  private bufferB: Float32Array;
  private activeBuffer: 'A' | 'B' = 'A';
  private size: number;
  
  constructor(size: number) {
    this.size = size;
    this.bufferA = new Float32Array(size);
    this.bufferB = new Float32Array(size);
  }
  
  /**
   * Get the buffer for writing (inactive buffer)
   */
  getWriteBuffer(): Float32Array {
    return this.activeBuffer === 'A' ? this.bufferB : this.bufferA;
  }
  
  /**
   * Get the buffer for reading (active buffer)
   */
  getReadBuffer(): Float32Array {
    return this.activeBuffer === 'A' ? this.bufferA : this.bufferB;
  }
  
  /**
   * Swap buffers
   */
  swap(): void {
    this.activeBuffer = this.activeBuffer === 'A' ? 'B' : 'A';
  }
  
  /**
   * Clear both buffers
   */
  clear(): void {
    this.bufferA.fill(0);
    this.bufferB.fill(0);
  }
}

// ============================================================================
// Low Latency Engine
// ============================================================================

/**
 * LowLatencyEngine - Main class for optimized audio processing
 */
export class LowLatencyEngine {
  private audioContext: AudioContext | null = null;
  private config: LowLatencyConfig;
  
  // Buffers
  private inputRingBuffer: RingBuffer | SharedRingBuffer | null = null;
  private outputRingBuffer: RingBuffer | SharedRingBuffer | null = null;
  private doubleBuffer: DoubleBuffer | null = null;
  
  // SharedArrayBuffers for worklet communication
  private inputSharedBuffer: SharedArrayBuffer | null = null;
  private outputSharedBuffer: SharedArrayBuffer | null = null;
  
  // Worklet
  private workletNode: AudioWorkletNode | null = null;
  private workletRegistered: boolean = false;
  
  // Performance tracking
  private metrics: PerformanceMetrics = {
    averageLatency: 0,
    maxLatency: 0,
    minLatency: Infinity,
    cpuUsage: 0,
    bufferUnderruns: 0,
    gcPauses: 0,
    lastProcessTime: 0
  };
  
  private latencyHistory: number[] = [];
  private processTimeHistory: number[] = [];
  
  constructor(config: Partial<LowLatencyConfig> = {}) {
    this.config = {
      bufferSize: config.bufferSize || 128,
      sampleRate: config.sampleRate || 44100,
      numChannels: config.numChannels || 2,
      useSharedArrayBuffer: config.useSharedArrayBuffer ?? this.isSharedArrayBufferSupported(),
      useDoubleBuffering: config.useDoubleBuffering ?? true,
      workerUrl: config.workerUrl
    };
  }
  
  /**
   * Check if SharedArrayBuffer is supported
   */
  private isSharedArrayBufferSupported(): boolean {
    try {
      // Check for SharedArrayBuffer support
      if (typeof SharedArrayBuffer === 'undefined') {
        return false;
      }
      
      // Check for cross-origin isolation (required for SharedArrayBuffer)
      if (typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated) {
        console.warn('SharedArrayBuffer requires cross-origin isolation');
        return false;
      }
      
      // Test creating a SharedArrayBuffer
      new SharedArrayBuffer(1);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Initialize the low latency engine
   */
  async initialize(audioContext: AudioContext): Promise<void> {
    this.audioContext = audioContext;
    
    // Calculate buffer sizes
    const ringBufferSize = this.config.bufferSize * 8; // 8x buffer for safety
    const doubleBufferSize = this.config.bufferSize * this.config.numChannels;
    
    // Create buffers
    if (this.config.useSharedArrayBuffer) {
      const inputResult = SharedRingBuffer.create(ringBufferSize);
      const outputResult = SharedRingBuffer.create(ringBufferSize);
      
      this.inputRingBuffer = inputResult.buffer;
      this.outputRingBuffer = outputResult.buffer;
      this.inputSharedBuffer = inputResult.sharedBuffer;
      this.outputSharedBuffer = outputResult.sharedBuffer;
    } else {
      this.inputRingBuffer = new RingBuffer(ringBufferSize);
      this.outputRingBuffer = new RingBuffer(ringBufferSize);
    }
    
    if (this.config.useDoubleBuffering) {
      this.doubleBuffer = new DoubleBuffer(doubleBufferSize);
    }
    
    // Register and create worklet
    await this.setupWorklet();
  }
  
  /**
   * Set up the AudioWorklet for low-latency processing
   */
  private async setupWorklet(): Promise<void> {
    if (!this.audioContext) return;
    
    // Create worklet processor code
    const processorCode = `
      class LowLatencyProcessor extends AudioWorkletProcessor {
        constructor(options) {
          super();
          
          this.bufferSize = options.processorOptions?.bufferSize || 128;
          this.numChannels = options.processorOptions?.numChannels || 2;
          this.useSharedBuffer = options.processorOptions?.useSharedBuffer || false;
          
          // Ring buffer state
          this.inputBuffer = new Float32Array(this.bufferSize * this.numChannels * 8);
          this.outputBuffer = new Float32Array(this.bufferSize * this.numChannels * 8);
          this.inputWriteIndex = 0;
          this.inputReadIndex = 0;
          this.outputWriteIndex = 0;
          this.outputReadIndex = 0;
          
          // Performance tracking
          this.processCount = 0;
          this.totalProcessTime = 0;
          this.underruns = 0;
          
          // Handle messages
          this.port.onmessage = (event) => {
            this.handleMessage(event.data);
          };
          
          // Report ready
          this.port.postMessage({ type: 'ready' });
        }
        
        handleMessage(data) {
          switch (data.type) {
            case 'setSharedBuffers':
              // Set up shared buffers for lock-free communication
              if (data.inputBuffer && data.outputBuffer) {
                this.inputSharedBuffer = new Float32Array(data.inputBuffer, 16);
                this.outputSharedBuffer = new Float32Array(data.outputBuffer, 16);
                this.inputStateBuffer = new Int32Array(data.inputBuffer, 0, 4);
                this.outputStateBuffer = new Int32Array(data.outputBuffer, 0, 4);
                this.useSharedBuffer = true;
              }
              break;
              
            case 'getMetrics':
              this.port.postMessage({
                type: 'metrics',
                processCount: this.processCount,
                averageProcessTime: this.processCount > 0 ? this.totalProcessTime / this.processCount : 0,
                underruns: this.underruns
              });
              break;
              
            case 'reset':
              this.processCount = 0;
              this.totalProcessTime = 0;
              this.underruns = 0;
              break;
          }
        }
        
        process(inputs, outputs, parameters) {
          const startTime = performance.now();
          
          const input = inputs[0];
          const output = outputs[0];
          
          if (!output || output.length === 0) {
            return true;
          }
          
          const numSamples = output[0].length;
          const numChannels = Math.min(output.length, this.numChannels);
          
          // Process audio
          if (this.useSharedBuffer && this.outputSharedBuffer) {
            // Read from shared output buffer
            this.readFromSharedBuffer(output, numSamples, numChannels);
            
            // Write input to shared input buffer
            if (input && input.length > 0) {
              this.writeToSharedBuffer(input, numSamples, numChannels);
            }
          } else {
            // Simple pass-through with processing
            for (let ch = 0; ch < numChannels; ch++) {
              if (input && input[ch]) {
                output[ch].set(input[ch]);
              } else {
                output[ch].fill(0);
              }
            }
          }
          
          // Track performance
          const processTime = performance.now() - startTime;
          this.totalProcessTime += processTime;
          this.processCount++;
          
          // Report metrics periodically
          if (this.processCount % 100 === 0) {
            this.port.postMessage({
              type: 'metrics',
              processTime,
              averageProcessTime: this.totalProcessTime / this.processCount,
              underruns: this.underruns
            });
          }
          
          return true;
        }
        
        readFromSharedBuffer(output, numSamples, numChannels) {
          const readIndex = Atomics.load(this.outputStateBuffer, 1);
          const writeIndex = Atomics.load(this.outputStateBuffer, 0);
          
          let available;
          if (writeIndex >= readIndex) {
            available = writeIndex - readIndex;
          } else {
            available = this.outputSharedBuffer.length - readIndex + writeIndex;
          }
          
          const needed = numSamples * numChannels;
          
          if (available < needed) {
            this.underruns++;
            // Fill with zeros
            for (let ch = 0; ch < numChannels; ch++) {
              output[ch].fill(0);
            }
            return;
          }
          
          let currentRead = readIndex;
          for (let i = 0; i < numSamples; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
              output[ch][i] = this.outputSharedBuffer[currentRead];
              currentRead = (currentRead + 1) % this.outputSharedBuffer.length;
            }
          }
          
          Atomics.store(this.outputStateBuffer, 1, currentRead);
        }
        
        writeToSharedBuffer(input, numSamples, numChannels) {
          const writeIndex = Atomics.load(this.inputStateBuffer, 0);
          
          let currentWrite = writeIndex;
          for (let i = 0; i < numSamples; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
              this.inputSharedBuffer[currentWrite] = input[ch] ? input[ch][i] : 0;
              currentWrite = (currentWrite + 1) % this.inputSharedBuffer.length;
            }
          }
          
          Atomics.store(this.inputStateBuffer, 0, currentWrite);
        }
      }
      
      registerProcessor('low-latency-processor', LowLatencyProcessor);
    `;
    
    const blob = new Blob([processorCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    
    await this.audioContext.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    
    this.workletRegistered = true;
    
    // Create worklet node
    this.workletNode = new AudioWorkletNode(this.audioContext, 'low-latency-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [this.config.numChannels],
      processorOptions: {
        bufferSize: this.config.bufferSize,
        numChannels: this.config.numChannels,
        useSharedBuffer: this.config.useSharedArrayBuffer
      }
    });
    
    // Set up shared buffers if available
    if (this.config.useSharedArrayBuffer && this.inputSharedBuffer && this.outputSharedBuffer) {
      this.workletNode.port.postMessage({
        type: 'setSharedBuffers',
        inputBuffer: this.inputSharedBuffer,
        outputBuffer: this.outputSharedBuffer
      });
    }
    
    // Handle messages from worklet
    this.workletNode.port.onmessage = (event) => {
      this.handleWorkletMessage(event.data);
    };
  }
  
  /**
   * Handle messages from the worklet
   */
  private handleWorkletMessage(data: { type: string; [key: string]: unknown }): void {
    switch (data.type) {
      case 'ready':
        console.log('Low latency processor ready');
        break;
        
      case 'metrics':
        this.updateMetrics(data);
        break;
    }
  }
  
  /**
   * Update performance metrics
   */
  private updateMetrics(data: { [key: string]: unknown }): void {
    const processTime = data.processTime as number;
    
    if (processTime !== undefined) {
      this.processTimeHistory.push(processTime);
      if (this.processTimeHistory.length > 100) {
        this.processTimeHistory.shift();
      }
      
      this.metrics.lastProcessTime = processTime;
      
      // Calculate latency (buffer size / sample rate)
      const latency = (this.config.bufferSize / this.config.sampleRate) * 1000;
      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > 100) {
        this.latencyHistory.shift();
      }
      
      // Update metrics
      this.metrics.averageLatency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
      this.metrics.maxLatency = Math.max(...this.latencyHistory);
      this.metrics.minLatency = Math.min(...this.latencyHistory);
      
      // Estimate CPU usage
      const bufferDuration = (this.config.bufferSize / this.config.sampleRate) * 1000;
      this.metrics.cpuUsage = (processTime / bufferDuration) * 100;
    }
    
    if (data.underruns !== undefined) {
      this.metrics.bufferUnderruns = data.underruns as number;
    }
  }
  
  /**
   * Get the worklet node for connection
   */
  getWorkletNode(): AudioWorkletNode | null {
    return this.workletNode;
  }
  
  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Get current latency in milliseconds
   */
  getLatency(): number {
    return (this.config.bufferSize / this.config.sampleRate) * 1000;
  }
  
  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.config.bufferSize;
  }
  
  /**
   * Set buffer size (requires reinitialization)
   */
  async setBufferSize(size: 32 | 64 | 128 | 256 | 512): Promise<void> {
    this.config.bufferSize = size;
    
    if (this.audioContext) {
      await this.initialize(this.audioContext);
    }
  }
  
  /**
   * Write audio to the output buffer
   */
  writeOutput(samples: Float32Array): number {
    if (this.outputRingBuffer) {
      return this.outputRingBuffer.write(samples);
    }
    return 0;
  }
  
  /**
   * Read audio from the input buffer
   */
  readInput(output: Float32Array): number {
    if (this.inputRingBuffer) {
      return this.inputRingBuffer.read(output);
    }
    return 0;
  }
  
  /**
   * Request metrics from worklet
   */
  requestMetrics(): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'getMetrics' });
    }
  }
  
  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      averageLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      cpuUsage: 0,
      bufferUnderruns: 0,
      gcPauses: 0,
      lastProcessTime: 0
    };
    
    this.latencyHistory = [];
    this.processTimeHistory = [];
    
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'reset' });
    }
    
    if (this.inputRingBuffer instanceof SharedRingBuffer) {
      this.inputRingBuffer.resetCounters();
    }
    if (this.outputRingBuffer instanceof SharedRingBuffer) {
      this.outputRingBuffer.resetCounters();
    }
  }
  
  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    
    this.inputRingBuffer = null;
    this.outputRingBuffer = null;
    this.doubleBuffer = null;
    this.inputSharedBuffer = null;
    this.outputSharedBuffer = null;
    this.audioContext = null;
  }
}

// Export singleton getter
let lowLatencyEngineInstance: LowLatencyEngine | null = null;

export function getLowLatencyEngine(config?: Partial<LowLatencyConfig>): LowLatencyEngine {
  if (!lowLatencyEngineInstance) {
    lowLatencyEngineInstance = new LowLatencyEngine(config);
  }
  return lowLatencyEngineInstance;
}