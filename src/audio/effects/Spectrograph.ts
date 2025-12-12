// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Spectrograph - FFT-based spectrum analyzer
 * Based on original AnkhWaveStudio Spectrograph plugin
 */

import { BaseEffect, EffectParameterDescriptor } from './BaseEffect';
import { clamp } from '../utils/AudioMath';

/**
 * Display modes for the spectrograph
 */
export type DisplayMode = 'spectrum' | 'spectrogram' | 'oscilloscope';

/**
 * Window function types for FFT
 */
export type WindowFunction = 'rectangular' | 'hann' | 'hamming' | 'blackman' | 'blackmanHarris';

/**
 * Frequency scale types
 */
export type FrequencyScale = 'linear' | 'logarithmic';

/**
 * Spectrograph analyzer effect
 */
export class Spectrograph extends BaseEffect {
  // Analyser nodes
  private analyserL: AnalyserNode;
  private analyserR: AnalyserNode;
  private splitter: ChannelSplitterNode;
  
  // Data buffers
  private frequencyDataL: Uint8Array;
  private frequencyDataR: Uint8Array;
  private timeDomainDataL: Float32Array;
  private timeDomainDataR: Float32Array;
  
  // Spectrogram history
  private spectrogramHistory: Uint8Array[] = [];
  private spectrogramHistorySize: number = 256;
  
  // Peak hold
  private peakHoldData: Float32Array;
  private peakHoldDecay: number = 0.995;
  
  // Settings
  private displayMode: DisplayMode = 'spectrum';
  private windowFunction: WindowFunction = 'hann';
  private frequencyScale: FrequencyScale = 'logarithmic';
  private frozen: boolean = false;
  
  // FFT size options
  private static readonly FFT_SIZES = [256, 512, 1024, 2048, 4096, 8192, 16384];

  constructor(audioContext: AudioContext, id: string, name: string = 'Spectrograph') {
    super(audioContext, id, name, 'spectrograph');
    
    // Create analyser nodes
    this.analyserL = audioContext.createAnalyser();
    this.analyserR = audioContext.createAnalyser();
    
    // Default FFT size
    this.analyserL.fftSize = 2048;
    this.analyserR.fftSize = 2048;
    this.analyserL.smoothingTimeConstant = 0.8;
    this.analyserR.smoothingTimeConstant = 0.8;
    
    // Create splitter
    this.splitter = audioContext.createChannelSplitter(2);
    
    // Initialize data buffers
    this.frequencyDataL = new Uint8Array(this.analyserL.frequencyBinCount);
    this.frequencyDataR = new Uint8Array(this.analyserR.frequencyBinCount);
    this.timeDomainDataL = new Float32Array(this.analyserL.fftSize);
    this.timeDomainDataR = new Float32Array(this.analyserR.fftSize);
    this.peakHoldData = new Float32Array(this.analyserL.frequencyBinCount);
    
    this.initializeEffect();
    this.setupRouting();
  }

  protected initializeEffect(): void {
    this.params = {
      fftSize: 2048,
      smoothing: 0.8,
      minDb: -90,
      maxDb: -10,
      displayMode: 0,      // 0=spectrum, 1=spectrogram, 2=oscilloscope
      windowFunction: 1,   // 0=rect, 1=hann, 2=hamming, 3=blackman, 4=blackmanHarris
      frequencyScale: 1,   // 0=linear, 1=logarithmic
      peakHold: 1,
      frozen: 0
    };
    
    this.applyAllParameters();
  }

  private setupRouting(): void {
    // Input -> Splitter -> Analysers
    this.inputNode.connect(this.splitter);
    this.splitter.connect(this.analyserL, 0);
    this.splitter.connect(this.analyserR, 1);
    
    // Pass through to output (analyzer doesn't modify audio)
    this.inputNode.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  private applyAllParameters(): void {
    // Apply FFT size
    const fftSize = this.getClosestFFTSize(this.params.fftSize);
    if (this.analyserL.fftSize !== fftSize) {
      this.analyserL.fftSize = fftSize;
      this.analyserR.fftSize = fftSize;
      
      // Resize buffers
      this.frequencyDataL = new Uint8Array(this.analyserL.frequencyBinCount);
      this.frequencyDataR = new Uint8Array(this.analyserR.frequencyBinCount);
      this.timeDomainDataL = new Float32Array(fftSize);
      this.timeDomainDataR = new Float32Array(fftSize);
      this.peakHoldData = new Float32Array(this.analyserL.frequencyBinCount);
    }
    
    // Apply smoothing
    this.analyserL.smoothingTimeConstant = clamp(this.params.smoothing, 0, 0.99);
    this.analyserR.smoothingTimeConstant = clamp(this.params.smoothing, 0, 0.99);
    
    // Apply dB range
    this.analyserL.minDecibels = this.params.minDb;
    this.analyserL.maxDecibels = this.params.maxDb;
    this.analyserR.minDecibels = this.params.minDb;
    this.analyserR.maxDecibels = this.params.maxDb;
    
    // Apply display mode
    const modes: DisplayMode[] = ['spectrum', 'spectrogram', 'oscilloscope'];
    this.displayMode = modes[Math.floor(this.params.displayMode)] || 'spectrum';
    
    // Apply window function
    const windows: WindowFunction[] = ['rectangular', 'hann', 'hamming', 'blackman', 'blackmanHarris'];
    this.windowFunction = windows[Math.floor(this.params.windowFunction)] || 'hann';
    
    // Apply frequency scale
    this.frequencyScale = this.params.frequencyScale > 0.5 ? 'logarithmic' : 'linear';
    
    // Apply frozen state
    this.frozen = this.params.frozen > 0.5;
  }

  private getClosestFFTSize(size: number): number {
    return Spectrograph.FFT_SIZES.reduce((prev, curr) => 
      Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev
    );
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'FFT Size', key: 'fftSize', min: 256, max: 16384, default: 2048, type: 'enum', enumValues: ['256', '512', '1024', '2048', '4096', '8192', '16384'] },
      { name: 'Smoothing', key: 'smoothing', min: 0, max: 0.99, default: 0.8, type: 'linear' },
      { name: 'Min dB', key: 'minDb', min: -120, max: -30, default: -90, unit: 'dB', type: 'linear' },
      { name: 'Max dB', key: 'maxDb', min: -30, max: 0, default: -10, unit: 'dB', type: 'linear' },
      { name: 'Display Mode', key: 'displayMode', min: 0, max: 2, default: 0, type: 'enum', enumValues: ['Spectrum', 'Spectrogram', 'Oscilloscope'] },
      { name: 'Window', key: 'windowFunction', min: 0, max: 4, default: 1, type: 'enum', enumValues: ['Rectangular', 'Hann', 'Hamming', 'Blackman', 'Blackman-Harris'] },
      { name: 'Freq Scale', key: 'frequencyScale', min: 0, max: 1, default: 1, type: 'enum', enumValues: ['Linear', 'Logarithmic'] },
      { name: 'Peak Hold', key: 'peakHold', min: 0, max: 1, default: 1, type: 'boolean' },
      { name: 'Frozen', key: 'frozen', min: 0, max: 1, default: 0, type: 'boolean' }
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    this.applyAllParameters();
  }

  /**
   * Get frequency data for visualization
   */
  getFrequencyData(): { left: Uint8Array; right: Uint8Array; combined: Uint8Array } {
    if (!this.frozen) {
      this.analyserL.getByteFrequencyData(this.frequencyDataL as Uint8Array<ArrayBuffer>);
      this.analyserR.getByteFrequencyData(this.frequencyDataR as Uint8Array<ArrayBuffer>);
    }
    
    // Create combined (average) data
    const combined = new Uint8Array(this.frequencyDataL.length);
    for (let i = 0; i < combined.length; i++) {
      combined[i] = Math.round((this.frequencyDataL[i] + this.frequencyDataR[i]) / 2);
    }
    
    // Update peak hold
    if (this.params.peakHold > 0.5 && !this.frozen) {
      for (let i = 0; i < this.peakHoldData.length; i++) {
        const current = combined[i] / 255;
        if (current > this.peakHoldData[i]) {
          this.peakHoldData[i] = current;
        } else {
          this.peakHoldData[i] *= this.peakHoldDecay;
        }
      }
    }
    
    // Update spectrogram history
    if (this.displayMode === 'spectrogram' && !this.frozen) {
      this.spectrogramHistory.push(new Uint8Array(combined));
      if (this.spectrogramHistory.length > this.spectrogramHistorySize) {
        this.spectrogramHistory.shift();
      }
    }
    
    return {
      left: this.frequencyDataL,
      right: this.frequencyDataR,
      combined
    };
  }

  /**
   * Get time domain data for oscilloscope
   */
  getTimeDomainData(): { left: Float32Array; right: Float32Array } {
    if (!this.frozen) {
      this.analyserL.getFloatTimeDomainData(this.timeDomainDataL as Float32Array<ArrayBuffer>);
      this.analyserR.getFloatTimeDomainData(this.timeDomainDataR as Float32Array<ArrayBuffer>);
    }
    
    return {
      left: this.timeDomainDataL,
      right: this.timeDomainDataR
    };
  }

  /**
   * Get peak hold data
   */
  getPeakHoldData(): Float32Array {
    return this.peakHoldData;
  }

  /**
   * Get spectrogram history
   */
  getSpectrogramHistory(): Uint8Array[] {
    return this.spectrogramHistory;
  }

  /**
   * Reset peak hold
   */
  resetPeakHold(): void {
    this.peakHoldData.fill(0);
  }

  /**
   * Clear spectrogram history
   */
  clearSpectrogramHistory(): void {
    this.spectrogramHistory = [];
  }

  /**
   * Get current display mode
   */
  getDisplayMode(): DisplayMode {
    return this.displayMode;
  }

  /**
   * Set display mode
   */
  setDisplayMode(mode: DisplayMode): void {
    const modeMap: Record<DisplayMode, number> = {
      'spectrum': 0,
      'spectrogram': 1,
      'oscilloscope': 2
    };
    this.setParameter('displayMode', modeMap[mode]);
  }

  /**
   * Get frequency scale
   */
  getFrequencyScale(): FrequencyScale {
    return this.frequencyScale;
  }

  /**
   * Set frequency scale
   */
  setFrequencyScale(scale: FrequencyScale): void {
    this.setParameter('frequencyScale', scale === 'logarithmic' ? 1 : 0);
  }

  /**
   * Toggle freeze
   */
  toggleFreeze(): boolean {
    const newValue = this.frozen ? 0 : 1;
    this.setParameter('frozen', newValue);
    return newValue > 0.5;
  }

  /**
   * Check if frozen
   */
  isFrozen(): boolean {
    return this.frozen;
  }

  /**
   * Get FFT size
   */
  getFFTSize(): number {
    return this.analyserL.fftSize;
  }

  /**
   * Set FFT size
   */
  setFFTSize(size: number): void {
    this.setParameter('fftSize', size);
  }

  /**
   * Get frequency bin count
   */
  getFrequencyBinCount(): number {
    return this.analyserL.frequencyBinCount;
  }

  /**
   * Get frequency for a given bin index
   */
  getFrequencyForBin(binIndex: number): number {
    const nyquist = this.audioContext.sampleRate / 2;
    return (binIndex / this.analyserL.frequencyBinCount) * nyquist;
  }

  /**
   * Get bin index for a given frequency
   */
  getBinForFrequency(frequency: number): number {
    const nyquist = this.audioContext.sampleRate / 2;
    return Math.round((frequency / nyquist) * this.analyserL.frequencyBinCount);
  }

  /**
   * Get sample rate
   */
  getSampleRate(): number {
    return this.audioContext.sampleRate;
  }

  dispose(): void {
    super.dispose();
    
    this.analyserL.disconnect();
    this.analyserR.disconnect();
    this.splitter.disconnect();
    
    this.spectrogramHistory = [];
  }
}