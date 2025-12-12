// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * CrossoverEQ - 4-band crossover equalizer with Linkwitz-Riley filters
 * Based on original AnkhWaveStudio CrossoverEQ plugin
 */

import { BaseEffect, EffectParameterDescriptor } from './BaseEffect';
import { clamp, dBToLinear } from '../utils/AudioMath';

/**
 * Band configuration
 */
interface BandConfig {
  gain: number;      // dB
  muted: boolean;
  solo: boolean;
}

/**
 * CrossoverEQ effect with 4 bands and Linkwitz-Riley crossover filters
 */
export class CrossoverEQ extends BaseEffect {
  // Crossover filters (Linkwitz-Riley = cascaded Butterworth)
  // Low band: lowpass at freq1
  private lowLP1: BiquadFilterNode;
  private lowLP2: BiquadFilterNode;
  
  // Low-mid band: highpass at freq1, lowpass at freq2
  private lowMidHP1: BiquadFilterNode;
  private lowMidHP2: BiquadFilterNode;
  private lowMidLP1: BiquadFilterNode;
  private lowMidLP2: BiquadFilterNode;
  
  // High-mid band: highpass at freq2, lowpass at freq3
  private highMidHP1: BiquadFilterNode;
  private highMidHP2: BiquadFilterNode;
  private highMidLP1: BiquadFilterNode;
  private highMidLP2: BiquadFilterNode;
  
  // High band: highpass at freq3
  private highHP1: BiquadFilterNode;
  private highHP2: BiquadFilterNode;
  
  // Band gain nodes
  private lowGain: GainNode;
  private lowMidGain: GainNode;
  private highMidGain: GainNode;
  private highGain: GainNode;
  
  // Band mute nodes
  private lowMute: GainNode;
  private lowMidMute: GainNode;
  private highMidMute: GainNode;
  private highMute: GainNode;
  
  // Mixer
  private mixer: GainNode;
  
  // Band configurations
  private bands: BandConfig[] = [
    { gain: 0, muted: false, solo: false },
    { gain: 0, muted: false, solo: false },
    { gain: 0, muted: false, solo: false },
    { gain: 0, muted: false, solo: false }
  ];

  constructor(audioContext: AudioContext, id: string, name: string = 'CrossoverEQ') {
    super(audioContext, id, name, 'crossovereq');
    
    // Create Linkwitz-Riley filters (cascaded 2nd order Butterworth = 4th order LR)
    // Low band filters
    this.lowLP1 = this.createButterworthLP(200);
    this.lowLP2 = this.createButterworthLP(200);
    
    // Low-mid band filters
    this.lowMidHP1 = this.createButterworthHP(200);
    this.lowMidHP2 = this.createButterworthHP(200);
    this.lowMidLP1 = this.createButterworthLP(2000);
    this.lowMidLP2 = this.createButterworthLP(2000);
    
    // High-mid band filters
    this.highMidHP1 = this.createButterworthHP(2000);
    this.highMidHP2 = this.createButterworthHP(2000);
    this.highMidLP1 = this.createButterworthLP(6000);
    this.highMidLP2 = this.createButterworthLP(6000);
    
    // High band filters
    this.highHP1 = this.createButterworthHP(6000);
    this.highHP2 = this.createButterworthHP(6000);
    
    // Create gain nodes
    this.lowGain = audioContext.createGain();
    this.lowMidGain = audioContext.createGain();
    this.highMidGain = audioContext.createGain();
    this.highGain = audioContext.createGain();
    
    // Create mute nodes
    this.lowMute = audioContext.createGain();
    this.lowMidMute = audioContext.createGain();
    this.highMidMute = audioContext.createGain();
    this.highMute = audioContext.createGain();
    
    // Create mixer
    this.mixer = audioContext.createGain();
    this.mixer.gain.value = 1;
    
    this.initializeEffect();
    this.setupRouting();
    this.addDefaultPresets();
  }

  private createButterworthLP(freq: number): BiquadFilterNode {
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.707; // Butterworth Q
    return filter;
  }

  private createButterworthHP(freq: number): BiquadFilterNode {
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.707; // Butterworth Q
    return filter;
  }

  protected initializeEffect(): void {
    this.params = {
      freq1: 200,      // Low/Low-mid crossover
      freq2: 2000,     // Low-mid/High-mid crossover
      freq3: 6000,     // High-mid/High crossover
      lowGain: 0,
      lowMidGain: 0,
      highMidGain: 0,
      highGain: 0,
      lowMute: 0,
      lowMidMute: 0,
      highMidMute: 0,
      highMute: 0,
      lowSolo: 0,
      lowMidSolo: 0,
      highMidSolo: 0,
      highSolo: 0
    };
    
    this.applyAllParameters();
  }

  private setupRouting(): void {
    // Low band: Input -> LP1 -> LP2 -> Gain -> Mute -> Mixer
    this.inputNode.connect(this.lowLP1);
    this.lowLP1.connect(this.lowLP2);
    this.lowLP2.connect(this.lowGain);
    this.lowGain.connect(this.lowMute);
    this.lowMute.connect(this.mixer);
    
    // Low-mid band: Input -> HP1 -> HP2 -> LP1 -> LP2 -> Gain -> Mute -> Mixer
    this.inputNode.connect(this.lowMidHP1);
    this.lowMidHP1.connect(this.lowMidHP2);
    this.lowMidHP2.connect(this.lowMidLP1);
    this.lowMidLP1.connect(this.lowMidLP2);
    this.lowMidLP2.connect(this.lowMidGain);
    this.lowMidGain.connect(this.lowMidMute);
    this.lowMidMute.connect(this.mixer);
    
    // High-mid band: Input -> HP1 -> HP2 -> LP1 -> LP2 -> Gain -> Mute -> Mixer
    this.inputNode.connect(this.highMidHP1);
    this.highMidHP1.connect(this.highMidHP2);
    this.highMidHP2.connect(this.highMidLP1);
    this.highMidLP1.connect(this.highMidLP2);
    this.highMidLP2.connect(this.highMidGain);
    this.highMidGain.connect(this.highMidMute);
    this.highMidMute.connect(this.mixer);
    
    // High band: Input -> HP1 -> HP2 -> Gain -> Mute -> Mixer
    this.inputNode.connect(this.highHP1);
    this.highHP1.connect(this.highHP2);
    this.highHP2.connect(this.highGain);
    this.highGain.connect(this.highMute);
    this.highMute.connect(this.mixer);
    
    // Mixer -> Wet -> Output
    this.mixer.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  private applyAllParameters(): void {
    this.applyCrossoverFrequencies();
    this.applyBandGains();
    this.applyMuteSolo();
  }

  private applyCrossoverFrequencies(): void {
    const t = this.audioContext.currentTime;
    const freq1 = clamp(this.params.freq1, 20, 500);
    const freq2 = clamp(this.params.freq2, 200, 5000);
    const freq3 = clamp(this.params.freq3, 2000, 20000);
    
    // Low band (lowpass at freq1)
    this.lowLP1.frequency.setTargetAtTime(freq1, t, 0.01);
    this.lowLP2.frequency.setTargetAtTime(freq1, t, 0.01);
    
    // Low-mid band (highpass at freq1, lowpass at freq2)
    this.lowMidHP1.frequency.setTargetAtTime(freq1, t, 0.01);
    this.lowMidHP2.frequency.setTargetAtTime(freq1, t, 0.01);
    this.lowMidLP1.frequency.setTargetAtTime(freq2, t, 0.01);
    this.lowMidLP2.frequency.setTargetAtTime(freq2, t, 0.01);
    
    // High-mid band (highpass at freq2, lowpass at freq3)
    this.highMidHP1.frequency.setTargetAtTime(freq2, t, 0.01);
    this.highMidHP2.frequency.setTargetAtTime(freq2, t, 0.01);
    this.highMidLP1.frequency.setTargetAtTime(freq3, t, 0.01);
    this.highMidLP2.frequency.setTargetAtTime(freq3, t, 0.01);
    
    // High band (highpass at freq3)
    this.highHP1.frequency.setTargetAtTime(freq3, t, 0.01);
    this.highHP2.frequency.setTargetAtTime(freq3, t, 0.01);
  }

  private applyBandGains(): void {
    const t = this.audioContext.currentTime;
    
    this.lowGain.gain.setTargetAtTime(dBToLinear(this.params.lowGain), t, 0.01);
    this.lowMidGain.gain.setTargetAtTime(dBToLinear(this.params.lowMidGain), t, 0.01);
    this.highMidGain.gain.setTargetAtTime(dBToLinear(this.params.highMidGain), t, 0.01);
    this.highGain.gain.setTargetAtTime(dBToLinear(this.params.highGain), t, 0.01);
  }

  private applyMuteSolo(): void {
    const t = this.audioContext.currentTime;
    
    // Check if any band is soloed
    const anySolo = this.params.lowSolo > 0.5 || 
                    this.params.lowMidSolo > 0.5 || 
                    this.params.highMidSolo > 0.5 || 
                    this.params.highSolo > 0.5;
    
    // Calculate mute states
    let lowMuted = this.params.lowMute > 0.5;
    let lowMidMuted = this.params.lowMidMute > 0.5;
    let highMidMuted = this.params.highMidMute > 0.5;
    let highMuted = this.params.highMute > 0.5;
    
    // If any band is soloed, mute non-soloed bands
    if (anySolo) {
      lowMuted = lowMuted || this.params.lowSolo <= 0.5;
      lowMidMuted = lowMidMuted || this.params.lowMidSolo <= 0.5;
      highMidMuted = highMidMuted || this.params.highMidSolo <= 0.5;
      highMuted = highMuted || this.params.highSolo <= 0.5;
    }
    
    this.lowMute.gain.setTargetAtTime(lowMuted ? 0 : 1, t, 0.01);
    this.lowMidMute.gain.setTargetAtTime(lowMidMuted ? 0 : 1, t, 0.01);
    this.highMidMute.gain.setTargetAtTime(highMidMuted ? 0 : 1, t, 0.01);
    this.highMute.gain.setTargetAtTime(highMuted ? 0 : 1, t, 0.01);
    
    // Update band configs
    this.bands[0].muted = lowMuted;
    this.bands[1].muted = lowMidMuted;
    this.bands[2].muted = highMidMuted;
    this.bands[3].muted = highMuted;
    this.bands[0].solo = this.params.lowSolo > 0.5;
    this.bands[1].solo = this.params.lowMidSolo > 0.5;
    this.bands[2].solo = this.params.highMidSolo > 0.5;
    this.bands[3].solo = this.params.highSolo > 0.5;
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'Crossover 1', key: 'freq1', min: 20, max: 500, default: 200, unit: 'Hz', type: 'logarithmic' },
      { name: 'Crossover 2', key: 'freq2', min: 200, max: 5000, default: 2000, unit: 'Hz', type: 'logarithmic' },
      { name: 'Crossover 3', key: 'freq3', min: 2000, max: 20000, default: 6000, unit: 'Hz', type: 'logarithmic' },
      { name: 'Low Gain', key: 'lowGain', min: -24, max: 24, default: 0, unit: 'dB', type: 'linear' },
      { name: 'Low-Mid Gain', key: 'lowMidGain', min: -24, max: 24, default: 0, unit: 'dB', type: 'linear' },
      { name: 'High-Mid Gain', key: 'highMidGain', min: -24, max: 24, default: 0, unit: 'dB', type: 'linear' },
      { name: 'High Gain', key: 'highGain', min: -24, max: 24, default: 0, unit: 'dB', type: 'linear' },
      { name: 'Low Mute', key: 'lowMute', min: 0, max: 1, default: 0, type: 'boolean' },
      { name: 'Low-Mid Mute', key: 'lowMidMute', min: 0, max: 1, default: 0, type: 'boolean' },
      { name: 'High-Mid Mute', key: 'highMidMute', min: 0, max: 1, default: 0, type: 'boolean' },
      { name: 'High Mute', key: 'highMute', min: 0, max: 1, default: 0, type: 'boolean' },
      { name: 'Low Solo', key: 'lowSolo', min: 0, max: 1, default: 0, type: 'boolean' },
      { name: 'Low-Mid Solo', key: 'lowMidSolo', min: 0, max: 1, default: 0, type: 'boolean' },
      { name: 'High-Mid Solo', key: 'highMidSolo', min: 0, max: 1, default: 0, type: 'boolean' },
      { name: 'High Solo', key: 'highSolo', min: 0, max: 1, default: 0, type: 'boolean' }
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    if (key.startsWith('freq')) {
      this.applyCrossoverFrequencies();
    } else if (key.includes('Gain')) {
      this.applyBandGains();
    } else if (key.includes('Mute') || key.includes('Solo')) {
      this.applyMuteSolo();
    }
  }

  /**
   * Get crossover frequencies
   */
  getCrossoverFrequencies(): { freq1: number; freq2: number; freq3: number } {
    return {
      freq1: this.params.freq1,
      freq2: this.params.freq2,
      freq3: this.params.freq3
    };
  }

  /**
   * Set crossover frequency
   */
  setCrossoverFrequency(index: 1 | 2 | 3, freq: number): void {
    this.setParameter(`freq${index}`, freq);
  }

  /**
   * Get band gain in dB
   */
  getBandGain(band: 0 | 1 | 2 | 3): number {
    const keys = ['lowGain', 'lowMidGain', 'highMidGain', 'highGain'];
    return this.params[keys[band]];
  }

  /**
   * Set band gain in dB
   */
  setBandGain(band: 0 | 1 | 2 | 3, gain: number): void {
    const keys = ['lowGain', 'lowMidGain', 'highMidGain', 'highGain'];
    this.setParameter(keys[band], gain);
  }

  /**
   * Toggle band mute
   */
  toggleBandMute(band: 0 | 1 | 2 | 3): boolean {
    const keys = ['lowMute', 'lowMidMute', 'highMidMute', 'highMute'];
    const newValue = this.params[keys[band]] > 0.5 ? 0 : 1;
    this.setParameter(keys[band], newValue);
    return newValue > 0.5;
  }

  /**
   * Toggle band solo
   */
  toggleBandSolo(band: 0 | 1 | 2 | 3): boolean {
    const keys = ['lowSolo', 'lowMidSolo', 'highMidSolo', 'highSolo'];
    const newValue = this.params[keys[band]] > 0.5 ? 0 : 1;
    this.setParameter(keys[band], newValue);
    return newValue > 0.5;
  }

  /**
   * Get band configuration
   */
  getBandConfig(band: 0 | 1 | 2 | 3): BandConfig {
    return { ...this.bands[band] };
  }

  /**
   * Get all band configurations
   */
  getAllBandConfigs(): BandConfig[] {
    return this.bands.map(b => ({ ...b }));
  }

  /**
   * Clear all solos
   */
  clearAllSolos(): void {
    this.setParameter('lowSolo', 0);
    this.setParameter('lowMidSolo', 0);
    this.setParameter('highMidSolo', 0);
    this.setParameter('highSolo', 0);
  }

  /**
   * Clear all mutes
   */
  clearAllMutes(): void {
    this.setParameter('lowMute', 0);
    this.setParameter('lowMidMute', 0);
    this.setParameter('highMidMute', 0);
    this.setParameter('highMute', 0);
  }

  private addDefaultPresets(): void {
    this.addPreset({
      name: 'Flat',
      params: { lowGain: 0, lowMidGain: 0, highMidGain: 0, highGain: 0 }
    });
    
    this.addPreset({
      name: 'Bass Boost',
      params: { lowGain: 6, lowMidGain: 0, highMidGain: 0, highGain: 0 }
    });
    
    this.addPreset({
      name: 'Treble Boost',
      params: { lowGain: 0, lowMidGain: 0, highMidGain: 0, highGain: 6 }
    });
    
    this.addPreset({
      name: 'Mid Scoop',
      params: { lowGain: 3, lowMidGain: -4, highMidGain: -4, highGain: 3 }
    });
    
    this.addPreset({
      name: 'Presence',
      params: { lowGain: 0, lowMidGain: 0, highMidGain: 4, highGain: 2 }
    });
    
    this.addPreset({
      name: 'Warmth',
      params: { lowGain: 2, lowMidGain: 3, highMidGain: -2, highGain: -3 }
    });
  }

  dispose(): void {
    super.dispose();
    
    this.lowLP1.disconnect();
    this.lowLP2.disconnect();
    this.lowMidHP1.disconnect();
    this.lowMidHP2.disconnect();
    this.lowMidLP1.disconnect();
    this.lowMidLP2.disconnect();
    this.highMidHP1.disconnect();
    this.highMidHP2.disconnect();
    this.highMidLP1.disconnect();
    this.highMidLP2.disconnect();
    this.highHP1.disconnect();
    this.highHP2.disconnect();
    this.lowGain.disconnect();
    this.lowMidGain.disconnect();
    this.highMidGain.disconnect();
    this.highGain.disconnect();
    this.lowMute.disconnect();
    this.lowMidMute.disconnect();
    this.highMidMute.disconnect();
    this.highMute.disconnect();
    this.mixer.disconnect();
  }
}