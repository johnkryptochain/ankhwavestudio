// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * ParametricEQ - 8-band parametric equalizer
 * 
 * Features:
 * - 8 fully parametric bands
 * - Multiple filter types per band (Low shelf, High shelf, Peak, Low pass, High pass)
 * - Real-time frequency response calculation
 * - Per-band bypass
 * - Spectrum analyzer integration
 */

import { BaseEffect, EffectParameterDescriptor, EffectPreset } from './BaseEffect';
import { clamp } from '../utils/AudioMath';

/**
 * Filter types available for each band
 */
export type EQFilterType = 'lowshelf' | 'highshelf' | 'peaking' | 'lowpass' | 'highpass' | 'notch' | 'bandpass';

/**
 * Single EQ band configuration
 */
export interface EQBand {
  enabled: boolean;
  type: EQFilterType;
  frequency: number;  // Hz (20-20000)
  gain: number;       // dB (-24 to +24)
  q: number;          // Q factor (0.1 to 18)
}

/**
 * Frequency response point
 */
export interface FrequencyResponsePoint {
  frequency: number;
  magnitude: number;  // dB
  phase: number;      // radians
}

/**
 * 8-band Parametric EQ
 */
export class ParametricEQ extends BaseEffect {
  private filterNodes: BiquadFilterNode[];
  private bands: EQBand[];
  private analyserNode: AnalyserNode;
  private analyserBuffer: Float32Array<ArrayBuffer>;
  
  // For frequency response calculation
  private frequencyArray: Float32Array<ArrayBuffer>;
  private magResponseArray: Float32Array<ArrayBuffer>;
  private phaseResponseArray: Float32Array<ArrayBuffer>;
  
  private static readonly NUM_BANDS = 8;
  private static readonly RESPONSE_POINTS = 256;

  constructor(audioContext: AudioContext, id: string, name: string = 'Parametric EQ') {
    super(audioContext, id, name, 'parametricEQ');
    
    // Create filter nodes for each band
    this.filterNodes = [];
    for (let i = 0; i < ParametricEQ.NUM_BANDS; i++) {
      const filter = audioContext.createBiquadFilter();
      filter.type = 'peaking';
      this.filterNodes.push(filter);
    }
    
    // Create analyser for spectrum display
    this.analyserNode = audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;
    this.analyserBuffer = new Float32Array(this.analyserNode.frequencyBinCount) as Float32Array<ArrayBuffer>;
    
    // Create arrays for frequency response calculation
    this.frequencyArray = new Float32Array(ParametricEQ.RESPONSE_POINTS) as Float32Array<ArrayBuffer>;
    this.magResponseArray = new Float32Array(ParametricEQ.RESPONSE_POINTS) as Float32Array<ArrayBuffer>;
    this.phaseResponseArray = new Float32Array(ParametricEQ.RESPONSE_POINTS) as Float32Array<ArrayBuffer>;
    
    // Initialize frequency array (logarithmic scale from 20Hz to 20kHz)
    for (let i = 0; i < ParametricEQ.RESPONSE_POINTS; i++) {
      const t = i / (ParametricEQ.RESPONSE_POINTS - 1);
      this.frequencyArray[i] = 20 * Math.pow(1000, t); // 20Hz to 20kHz
    }
    
    // Initialize bands with default values
    this.bands = this.createDefaultBands();
    
    this.initializeEffect();
    this.setupRouting();
    this.addDefaultPresets();
  }

  private createDefaultBands(): EQBand[] {
    // Default band frequencies spread across the spectrum
    const defaultFrequencies = [60, 170, 350, 700, 1400, 2800, 5600, 11200];
    
    return defaultFrequencies.map((freq, index) => ({
      enabled: true,
      type: index === 0 ? 'lowshelf' : index === 7 ? 'highshelf' : 'peaking' as EQFilterType,
      frequency: freq,
      gain: 0,
      q: 1.0,
    }));
  }

  protected initializeEffect(): void {
    // Initialize parameters for all bands
    this.params = {};
    
    for (let i = 0; i < ParametricEQ.NUM_BANDS; i++) {
      const band = this.bands[i];
      this.params[`band${i}_enabled`] = band.enabled ? 1 : 0;
      this.params[`band${i}_type`] = this.filterTypeToNumber(band.type);
      this.params[`band${i}_frequency`] = band.frequency;
      this.params[`band${i}_gain`] = band.gain;
      this.params[`band${i}_q`] = band.q;
      
      this.applyBandSettings(i);
    }
  }

  private setupRouting(): void {
    // Connect filters in series: input -> filter0 -> filter1 -> ... -> filter7 -> analyser -> wet -> output
    let previousNode: AudioNode = this.inputNode;
    
    for (const filter of this.filterNodes) {
      previousNode.connect(filter);
      previousNode = filter;
    }
    
    previousNode.connect(this.analyserNode);
    this.analyserNode.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  private filterTypeToNumber(type: EQFilterType): number {
    const types: EQFilterType[] = ['lowshelf', 'highshelf', 'peaking', 'lowpass', 'highpass', 'notch', 'bandpass'];
    return types.indexOf(type);
  }

  private numberToFilterType(num: number): EQFilterType {
    const types: EQFilterType[] = ['lowshelf', 'highshelf', 'peaking', 'lowpass', 'highpass', 'notch', 'bandpass'];
    return types[Math.round(num)] || 'peaking';
  }

  private filterTypeToBiquadType(type: EQFilterType): BiquadFilterType {
    const mapping: Record<EQFilterType, BiquadFilterType> = {
      'lowshelf': 'lowshelf',
      'highshelf': 'highshelf',
      'peaking': 'peaking',
      'lowpass': 'lowpass',
      'highpass': 'highpass',
      'notch': 'notch',
      'bandpass': 'bandpass',
    };
    return mapping[type];
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    const descriptors: EffectParameterDescriptor[] = [];
    
    for (let i = 0; i < ParametricEQ.NUM_BANDS; i++) {
      descriptors.push(
        {
          name: `Band ${i + 1} Enabled`,
          key: `band${i}_enabled`,
          min: 0,
          max: 1,
          default: 1,
          type: 'boolean',
        },
        {
          name: `Band ${i + 1} Type`,
          key: `band${i}_type`,
          min: 0,
          max: 6,
          default: i === 0 ? 0 : i === 7 ? 1 : 2,
          type: 'enum',
          enumValues: ['Low Shelf', 'High Shelf', 'Peak', 'Low Pass', 'High Pass', 'Notch', 'Band Pass'],
        },
        {
          name: `Band ${i + 1} Frequency`,
          key: `band${i}_frequency`,
          min: 20,
          max: 20000,
          default: this.bands[i]?.frequency || 1000,
          unit: 'Hz',
          type: 'logarithmic',
        },
        {
          name: `Band ${i + 1} Gain`,
          key: `band${i}_gain`,
          min: -24,
          max: 24,
          default: 0,
          unit: 'dB',
          type: 'linear',
        },
        {
          name: `Band ${i + 1} Q`,
          key: `band${i}_q`,
          min: 0.1,
          max: 18,
          default: 1.0,
          type: 'logarithmic',
        }
      );
    }
    
    return descriptors;
  }

  protected onParameterChange(key: string, value: number): void {
    // Parse band index from key
    const match = key.match(/^band(\d+)_(\w+)$/);
    if (!match) return;
    
    const bandIndex = parseInt(match[1], 10);
    const param = match[2];
    
    if (bandIndex < 0 || bandIndex >= ParametricEQ.NUM_BANDS) return;
    
    const band = this.bands[bandIndex];
    
    switch (param) {
      case 'enabled':
        band.enabled = value > 0.5;
        break;
      case 'type':
        band.type = this.numberToFilterType(value);
        break;
      case 'frequency':
        band.frequency = clamp(value, 20, 20000);
        break;
      case 'gain':
        band.gain = clamp(value, -24, 24);
        break;
      case 'q':
        band.q = clamp(value, 0.1, 18);
        break;
    }
    
    this.applyBandSettings(bandIndex);
  }

  private applyBandSettings(bandIndex: number): void {
    const band = this.bands[bandIndex];
    const filter = this.filterNodes[bandIndex];
    const t = this.audioContext.currentTime;
    
    // Set filter type
    filter.type = this.filterTypeToBiquadType(band.type);
    
    // Set frequency
    filter.frequency.setTargetAtTime(band.frequency, t, 0.01);
    
    // Set Q
    filter.Q.setTargetAtTime(band.q, t, 0.01);
    
    // Set gain (only applies to peaking and shelf filters)
    if (band.enabled) {
      filter.gain.setTargetAtTime(band.gain, t, 0.01);
    } else {
      filter.gain.setTargetAtTime(0, t, 0.01);
    }
  }

  /**
   * Get the current band settings
   */
  getBand(index: number): EQBand | null {
    if (index < 0 || index >= ParametricEQ.NUM_BANDS) return null;
    return { ...this.bands[index] };
  }

  /**
   * Get all band settings
   */
  getAllBands(): EQBand[] {
    return this.bands.map(band => ({ ...band }));
  }

  /**
   * Set a band's settings directly
   */
  setBand(index: number, settings: Partial<EQBand>): void {
    if (index < 0 || index >= ParametricEQ.NUM_BANDS) return;
    
    const band = this.bands[index];
    
    if (settings.enabled !== undefined) {
      band.enabled = settings.enabled;
      this.params[`band${index}_enabled`] = settings.enabled ? 1 : 0;
    }
    if (settings.type !== undefined) {
      band.type = settings.type;
      this.params[`band${index}_type`] = this.filterTypeToNumber(settings.type);
    }
    if (settings.frequency !== undefined) {
      band.frequency = clamp(settings.frequency, 20, 20000);
      this.params[`band${index}_frequency`] = band.frequency;
    }
    if (settings.gain !== undefined) {
      band.gain = clamp(settings.gain, -24, 24);
      this.params[`band${index}_gain`] = band.gain;
    }
    if (settings.q !== undefined) {
      band.q = clamp(settings.q, 0.1, 18);
      this.params[`band${index}_q`] = band.q;
    }
    
    this.applyBandSettings(index);
  }

  /**
   * Calculate the combined frequency response of all bands
   */
  getFrequencyResponse(): FrequencyResponsePoint[] {
    const response: FrequencyResponsePoint[] = [];
    
    // Initialize combined response
    const combinedMag = new Float32Array(ParametricEQ.RESPONSE_POINTS);
    const combinedPhase = new Float32Array(ParametricEQ.RESPONSE_POINTS);
    
    // Get response from each enabled band and combine
    for (let bandIndex = 0; bandIndex < ParametricEQ.NUM_BANDS; bandIndex++) {
      const band = this.bands[bandIndex];
      if (!band.enabled) continue;
      
      const filter = this.filterNodes[bandIndex];
      filter.getFrequencyResponse(this.frequencyArray, this.magResponseArray, this.phaseResponseArray);
      
      for (let i = 0; i < ParametricEQ.RESPONSE_POINTS; i++) {
        // Combine magnitudes (multiply in linear, add in dB)
        combinedMag[i] += 20 * Math.log10(this.magResponseArray[i]);
        combinedPhase[i] += this.phaseResponseArray[i];
      }
    }
    
    // Convert to response points
    for (let i = 0; i < ParametricEQ.RESPONSE_POINTS; i++) {
      response.push({
        frequency: this.frequencyArray[i],
        magnitude: combinedMag[i],
        phase: combinedPhase[i],
      });
    }
    
    return response;
  }

  /**
   * Get spectrum data from the analyser
   */
  getSpectrumData(): Float32Array<ArrayBuffer> {
    this.analyserNode.getFloatFrequencyData(this.analyserBuffer);
    return this.analyserBuffer;
  }

  /**
   * Get the frequency bin for a given frequency
   */
  getFrequencyBin(frequency: number): number {
    const nyquist = this.audioContext.sampleRate / 2;
    const binCount = this.analyserNode.frequencyBinCount;
    return Math.round((frequency / nyquist) * binCount);
  }

  private addDefaultPresets(): void {
    const presets: EffectPreset[] = [
      {
        name: 'Flat',
        params: this.createFlatPreset(),
      },
      {
        name: 'Bass Boost',
        params: {
          band0_gain: 6,
          band1_gain: 4,
          band2_gain: 2,
        },
      },
      {
        name: 'Treble Boost',
        params: {
          band5_gain: 2,
          band6_gain: 4,
          band7_gain: 6,
        },
      },
      {
        name: 'Vocal Presence',
        params: {
          band2_gain: -2,
          band3_gain: 3,
          band4_gain: 4,
          band5_gain: 2,
        },
      },
      {
        name: 'Smiley Face',
        params: {
          band0_gain: 4,
          band1_gain: 2,
          band2_gain: -1,
          band3_gain: -2,
          band4_gain: -2,
          band5_gain: -1,
          band6_gain: 2,
          band7_gain: 4,
        },
      },
      {
        name: 'Mid Scoop',
        params: {
          band0_gain: 3,
          band1_gain: 1,
          band2_gain: -3,
          band3_gain: -4,
          band4_gain: -4,
          band5_gain: -3,
          band6_gain: 1,
          band7_gain: 3,
        },
      },
      {
        name: 'Telephone',
        params: {
          band0_enabled: 0,
          band0_type: 4, // highpass
          band0_frequency: 300,
          band7_enabled: 0,
          band7_type: 3, // lowpass
          band7_frequency: 3400,
        },
      },
      {
        name: 'De-Mud',
        params: {
          band1_gain: -3,
          band2_gain: -4,
          band3_gain: -2,
        },
      },
    ];

    for (const preset of presets) {
      this.addPreset(preset);
    }
  }

  private createFlatPreset(): Record<string, number> {
    const params: Record<string, number> = {};
    for (let i = 0; i < ParametricEQ.NUM_BANDS; i++) {
      params[`band${i}_gain`] = 0;
    }
    return params;
  }

  dispose(): void {
    super.dispose();
    
    for (const filter of this.filterNodes) {
      filter.disconnect();
    }
    this.analyserNode.disconnect();
  }
}