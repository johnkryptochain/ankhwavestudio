// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Metering - Real-time audio metering utilities
 * Provides VU meter data extraction, peak detection, RMS calculation, and spectrum analysis
 */

/**
 * VU Meter data structure
 */
export interface VUMeterData {
  peakL: number;
  peakR: number;
  rmsL: number;
  rmsR: number;
  clipL: boolean;
  clipR: boolean;
}

/**
 * Spectrum data structure
 */
export interface SpectrumData {
  frequencies: Float32Array;
  magnitudes: Float32Array;
  binCount: number;
}

/**
 * Metering configuration
 */
export interface MeteringConfig {
  fftSize: number;
  smoothingTimeConstant: number;
  minDecibels: number;
  maxDecibels: number;
  peakHoldTime: number;
  peakFalloff: number;
}

const DEFAULT_CONFIG: MeteringConfig = {
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  minDecibels: -90,
  maxDecibels: 0,
  peakHoldTime: 1000, // ms
  peakFalloff: 0.95, // per frame
};

/**
 * Metering class for real-time audio analysis
 */
export class Metering {
  private context: AudioContext;
  private analyserL: AnalyserNode;
  private analyserR: AnalyserNode;
  private splitter: ChannelSplitterNode;
  private config: MeteringConfig;
  
  // Data buffers
  private timeDomainDataL: Float32Array<ArrayBuffer>;
  private timeDomainDataR: Float32Array<ArrayBuffer>;
  private frequencyDataL: Float32Array<ArrayBuffer>;
  private frequencyDataR: Float32Array<ArrayBuffer>;
  
  // Peak hold
  private peakL: number = 0;
  private peakR: number = 0;
  private peakHoldTimeL: number = 0;
  private peakHoldTimeR: number = 0;
  private lastUpdateTime: number = 0;
  
  // Clip detection
  private clipThreshold: number = 0.99;
  private clipL: boolean = false;
  private clipR: boolean = false;
  private clipHoldTime: number = 500; // ms
  private clipTimeL: number = 0;
  private clipTimeR: number = 0;

  constructor(context: AudioContext, config: Partial<MeteringConfig> = {}) {
    this.context = context;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Create analyser nodes
    this.analyserL = context.createAnalyser();
    this.analyserR = context.createAnalyser();
    
    this.configureAnalyser(this.analyserL);
    this.configureAnalyser(this.analyserR);
    
    // Create channel splitter
    this.splitter = context.createChannelSplitter(2);
    this.splitter.connect(this.analyserL, 0);
    this.splitter.connect(this.analyserR, 1);
    
    // Initialize data buffers
    const bufferLength = this.analyserL.fftSize;
    this.timeDomainDataL = new Float32Array(new ArrayBuffer(bufferLength * 4));
    this.timeDomainDataR = new Float32Array(new ArrayBuffer(bufferLength * 4));
    this.frequencyDataL = new Float32Array(new ArrayBuffer(this.analyserL.frequencyBinCount * 4));
    this.frequencyDataR = new Float32Array(new ArrayBuffer(this.analyserR.frequencyBinCount * 4));
    
    this.lastUpdateTime = performance.now();
  }

  /**
   * Configure an analyser node
   */
  private configureAnalyser(analyser: AnalyserNode): void {
    analyser.fftSize = this.config.fftSize;
    analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;
    analyser.minDecibels = this.config.minDecibels;
    analyser.maxDecibels = this.config.maxDecibels;
  }

  /**
   * Get the input node for connecting audio sources
   */
  getInput(): ChannelSplitterNode {
    return this.splitter;
  }

  /**
   * Connect an audio source to the metering
   */
  connect(source: AudioNode): void {
    source.connect(this.splitter);
  }

  /**
   * Disconnect from an audio source
   */
  disconnect(source?: AudioNode): void {
    if (source) {
      source.disconnect(this.splitter);
    }
  }

  /**
   * Get VU meter data
   */
  getVUMeterData(): VUMeterData {
    const now = performance.now();
    const deltaTime = now - this.lastUpdateTime;
    this.lastUpdateTime = now;
    
    // Get time domain data
    this.analyserL.getFloatTimeDomainData(this.timeDomainDataL);
    this.analyserR.getFloatTimeDomainData(this.timeDomainDataR);
    
    // Calculate RMS and peak for left channel
    const { rms: rmsL, peak: currentPeakL, clipped: clippedL } = this.analyzeChannel(this.timeDomainDataL);
    
    // Calculate RMS and peak for right channel
    const { rms: rmsR, peak: currentPeakR, clipped: clippedR } = this.analyzeChannel(this.timeDomainDataR);
    
    // Update peak hold for left channel
    if (currentPeakL >= this.peakL) {
      this.peakL = currentPeakL;
      this.peakHoldTimeL = now;
    } else if (now - this.peakHoldTimeL > this.config.peakHoldTime) {
      this.peakL *= this.config.peakFalloff;
    }
    
    // Update peak hold for right channel
    if (currentPeakR >= this.peakR) {
      this.peakR = currentPeakR;
      this.peakHoldTimeR = now;
    } else if (now - this.peakHoldTimeR > this.config.peakHoldTime) {
      this.peakR *= this.config.peakFalloff;
    }
    
    // Update clip indicators
    if (clippedL) {
      this.clipL = true;
      this.clipTimeL = now;
    } else if (now - this.clipTimeL > this.clipHoldTime) {
      this.clipL = false;
    }
    
    if (clippedR) {
      this.clipR = true;
      this.clipTimeR = now;
    } else if (now - this.clipTimeR > this.clipHoldTime) {
      this.clipR = false;
    }
    
    return {
      peakL: this.peakL,
      peakR: this.peakR,
      rmsL,
      rmsR,
      clipL: this.clipL,
      clipR: this.clipR,
    };
  }

  /**
   * Analyze a single channel
   */
  private analyzeChannel(data: Float32Array): { rms: number; peak: number; clipped: boolean } {
    let sum = 0;
    let peak = 0;
    let clipped = false;
    
    for (let i = 0; i < data.length; i++) {
      const sample = data[i];
      const absSample = Math.abs(sample);
      
      sum += sample * sample;
      
      if (absSample > peak) {
        peak = absSample;
      }
      
      if (absSample >= this.clipThreshold) {
        clipped = true;
      }
    }
    
    const rms = Math.sqrt(sum / data.length);
    
    return { rms, peak, clipped };
  }

  /**
   * Get stereo levels (simplified VU data)
   */
  getStereoLevels(): { left: number; right: number } {
    const data = this.getVUMeterData();
    return {
      left: data.rmsL,
      right: data.rmsR,
    };
  }

  /**
   * Get frequency data for spectrum visualization
   */
  getFrequencyData(): Uint8Array {
    const data = new Uint8Array(this.analyserL.frequencyBinCount);
    this.analyserL.getByteFrequencyData(data);
    return data;
  }

  /**
   * Get detailed spectrum data
   */
  getSpectrumData(): SpectrumData {
    this.analyserL.getFloatFrequencyData(this.frequencyDataL);
    
    const binCount = this.analyserL.frequencyBinCount;
    const frequencies = new Float32Array(binCount);
    const nyquist = this.context.sampleRate / 2;
    
    for (let i = 0; i < binCount; i++) {
      frequencies[i] = (i / binCount) * nyquist;
    }
    
    return {
      frequencies,
      magnitudes: this.frequencyDataL.slice(),
      binCount,
    };
  }

  /**
   * Get time domain data for waveform visualization
   */
  getTimeDomainData(): Uint8Array {
    const data = new Uint8Array(this.analyserL.fftSize);
    this.analyserL.getByteTimeDomainData(data);
    return data;
  }

  /**
   * Get float time domain data
   */
  getFloatTimeDomainData(): Float32Array {
    this.analyserL.getFloatTimeDomainData(this.timeDomainDataL);
    return this.timeDomainDataL.slice();
  }

  /**
   * Convert linear amplitude to decibels
   */
  static linearToDb(linear: number): number {
    if (linear <= 0) return -Infinity;
    return 20 * Math.log10(linear);
  }

  /**
   * Convert decibels to linear amplitude
   */
  static dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  /**
   * Reset peak hold values
   */
  resetPeaks(): void {
    this.peakL = 0;
    this.peakR = 0;
    this.peakHoldTimeL = 0;
    this.peakHoldTimeR = 0;
  }

  /**
   * Reset clip indicators
   */
  resetClip(): void {
    this.clipL = false;
    this.clipR = false;
    this.clipTimeL = 0;
    this.clipTimeR = 0;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.splitter.disconnect();
    this.analyserL.disconnect();
    this.analyserR.disconnect();
  }
}

/**
 * Create a simple VU meter for a mono source
 */
export class MonoMeter {
  private analyser: AnalyserNode;
  private timeDomainData: Float32Array<ArrayBuffer>;
  private peak: number = 0;
  private peakHoldTime: number = 0;
  private config: MeteringConfig;

  constructor(context: AudioContext, config: Partial<MeteringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = this.config.fftSize;
    this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;
    
    this.timeDomainData = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
  }

  getInput(): AnalyserNode {
    return this.analyser;
  }

  connect(source: AudioNode): void {
    source.connect(this.analyser);
  }

  getLevel(): { rms: number; peak: number } {
    const now = performance.now();
    this.analyser.getFloatTimeDomainData(this.timeDomainData);
    
    let sum = 0;
    let currentPeak = 0;
    
    for (let i = 0; i < this.timeDomainData.length; i++) {
      const sample = this.timeDomainData[i];
      sum += sample * sample;
      const absSample = Math.abs(sample);
      if (absSample > currentPeak) {
        currentPeak = absSample;
      }
    }
    
    const rms = Math.sqrt(sum / this.timeDomainData.length);
    
    // Update peak hold
    if (currentPeak >= this.peak) {
      this.peak = currentPeak;
      this.peakHoldTime = now;
    } else if (now - this.peakHoldTime > this.config.peakHoldTime) {
      this.peak *= this.config.peakFalloff;
    }
    
    return { rms, peak: this.peak };
  }

  dispose(): void {
    this.analyser.disconnect();
  }
}

/**
 * Spectrum analyzer for visualization
 */
export class SpectrumAnalyzer {
  private analyser: AnalyserNode;
  private frequencyData: Uint8Array<ArrayBuffer>;
  private floatFrequencyData: Float32Array<ArrayBuffer>;

  constructor(context: AudioContext, fftSize: number = 2048) {
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = fftSize;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;
    
    this.frequencyData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    this.floatFrequencyData = new Float32Array(new ArrayBuffer(this.analyser.frequencyBinCount * 4));
  }

  getInput(): AnalyserNode {
    return this.analyser;
  }

  connect(source: AudioNode): void {
    source.connect(this.analyser);
  }

  /**
   * Get byte frequency data (0-255)
   */
  getByteFrequencyData(): Uint8Array {
    this.analyser.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }

  /**
   * Get float frequency data (in dB)
   */
  getFloatFrequencyData(): Float32Array {
    this.analyser.getFloatFrequencyData(this.floatFrequencyData);
    return this.floatFrequencyData;
  }

  /**
   * Get frequency bin count
   */
  getBinCount(): number {
    return this.analyser.frequencyBinCount;
  }

  /**
   * Get frequency for a specific bin
   */
  getFrequencyForBin(bin: number, sampleRate: number): number {
    return (bin / this.analyser.frequencyBinCount) * (sampleRate / 2);
  }

  dispose(): void {
    this.analyser.disconnect();
  }
}

export default Metering;