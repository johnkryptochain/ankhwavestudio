// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * DualFilter - Dual filter effect with LFO modulation
 * Based on original AnkhWaveStudio DualFilter plugin
 */

import { BaseEffect, EffectParameterDescriptor } from './BaseEffect';
import { clamp } from '../utils/AudioMath';

/**
 * Filter types available
 */
export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';

/**
 * Filter mix modes
 */
export type FilterMixMode = 'serial' | 'parallel';

/**
 * DualFilter effect with two independent filters and LFO modulation
 */
export class DualFilter extends BaseEffect {
  // Filter 1 nodes
  private filter1: BiquadFilterNode;
  private filter1Gain: GainNode;
  
  // Filter 2 nodes
  private filter2: BiquadFilterNode;
  private filter2Gain: GainNode;
  
  // LFO nodes
  private lfo1: OscillatorNode;
  private lfo1Gain: GainNode;
  private lfo2: OscillatorNode;
  private lfo2Gain: GainNode;
  
  // Envelope follower (using analyser)
  private analyser: AnalyserNode;
  private envelopeBuffer: Float32Array;
  private envelopeFollowerEnabled: boolean = false;
  private envelopeAmount: number = 0;
  
  // Mix mode
  private mixMode: FilterMixMode = 'serial';
  
  // Parallel mix node
  private parallelMixer: GainNode;

  constructor(audioContext: AudioContext, id: string, name: string = 'DualFilter') {
    super(audioContext, id, name, 'dualfilter');
    
    // Create Filter 1
    this.filter1 = audioContext.createBiquadFilter();
    this.filter1.type = 'lowpass';
    this.filter1.frequency.value = 2000;
    this.filter1.Q.value = 1;
    this.filter1Gain = audioContext.createGain();
    this.filter1Gain.gain.value = 1;
    
    // Create Filter 2
    this.filter2 = audioContext.createBiquadFilter();
    this.filter2.type = 'highpass';
    this.filter2.frequency.value = 500;
    this.filter2.Q.value = 1;
    this.filter2Gain = audioContext.createGain();
    this.filter2Gain.gain.value = 1;
    
    // Create LFO 1
    this.lfo1 = audioContext.createOscillator();
    this.lfo1.type = 'sine';
    this.lfo1.frequency.value = 1;
    this.lfo1Gain = audioContext.createGain();
    this.lfo1Gain.gain.value = 0;
    this.lfo1.start();
    
    // Create LFO 2
    this.lfo2 = audioContext.createOscillator();
    this.lfo2.type = 'sine';
    this.lfo2.frequency.value = 1;
    this.lfo2Gain = audioContext.createGain();
    this.lfo2Gain.gain.value = 0;
    this.lfo2.start();
    
    // Create envelope follower analyser
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.envelopeBuffer = new Float32Array(this.analyser.fftSize) as Float32Array<ArrayBuffer>;
    
    // Create parallel mixer
    this.parallelMixer = audioContext.createGain();
    this.parallelMixer.gain.value = 0.5;
    
    this.initializeEffect();
    this.setupRouting();
    this.addDefaultPresets();
  }

  protected initializeEffect(): void {
    this.params = {
      // Filter 1
      filter1Type: 0,        // 0=LP, 1=HP, 2=BP, 3=Notch
      filter1Freq: 2000,
      filter1Res: 1,
      filter1Enabled: 1,
      
      // Filter 2
      filter2Type: 1,        // 0=LP, 1=HP, 2=BP, 3=Notch
      filter2Freq: 500,
      filter2Res: 1,
      filter2Enabled: 1,
      
      // Mix
      mixMode: 0,            // 0=serial, 1=parallel
      filterMix: 0.5,        // Balance between filters in parallel mode
      
      // LFO 1
      lfo1Rate: 1,
      lfo1Depth: 0,
      lfo1Target: 0,         // 0=filter1, 1=filter2, 2=both
      
      // LFO 2
      lfo2Rate: 0.5,
      lfo2Depth: 0,
      lfo2Target: 1,
      
      // Envelope follower
      envelopeEnabled: 0,
      envelopeAmount: 0,
      envelopeTarget: 0      // 0=filter1, 1=filter2, 2=both
    };
    
    this.applyAllParameters();
  }

  private setupRouting(): void {
    // Connect LFOs to filter frequencies
    this.lfo1.connect(this.lfo1Gain);
    this.lfo2.connect(this.lfo2Gain);
    
    // Initial serial routing
    this.updateRouting();
    
    // Connect to wet output
    this.filter2Gain.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
    
    // Connect analyser for envelope following
    this.inputNode.connect(this.analyser);
  }

  private updateRouting(): void {
    // Disconnect existing connections
    try {
      this.inputNode.disconnect(this.filter1);
      this.inputNode.disconnect(this.filter2);
      this.filter1.disconnect();
      this.filter1Gain.disconnect();
      this.filter2.disconnect();
      this.filter2Gain.disconnect();
      this.parallelMixer.disconnect();
    } catch (e) {
      // Ignore disconnection errors
    }
    
    if (this.mixMode === 'serial') {
      // Serial: Input -> Filter1 -> Filter2 -> Output
      this.inputNode.connect(this.filter1);
      this.filter1.connect(this.filter1Gain);
      this.filter1Gain.connect(this.filter2);
      this.filter2.connect(this.filter2Gain);
      this.filter2Gain.connect(this.wetGain);
    } else {
      // Parallel: Input -> Filter1 -> Mixer
      //           Input -> Filter2 -> Mixer -> Output
      this.inputNode.connect(this.filter1);
      this.inputNode.connect(this.filter2);
      this.filter1.connect(this.filter1Gain);
      this.filter2.connect(this.filter2Gain);
      this.filter1Gain.connect(this.parallelMixer);
      this.filter2Gain.connect(this.parallelMixer);
      this.parallelMixer.connect(this.wetGain);
    }
    
    // Reconnect LFO modulation
    this.updateLfoRouting();
  }

  private updateLfoRouting(): void {
    // Disconnect LFO gains
    try {
      this.lfo1Gain.disconnect();
      this.lfo2Gain.disconnect();
    } catch (e) {
      // Ignore
    }
    
    const lfo1Target = this.params.lfo1Target;
    const lfo2Target = this.params.lfo2Target;
    
    // Connect LFO 1
    if (lfo1Target === 0 || lfo1Target === 2) {
      this.lfo1Gain.connect(this.filter1.frequency);
    }
    if (lfo1Target === 1 || lfo1Target === 2) {
      this.lfo1Gain.connect(this.filter2.frequency);
    }
    
    // Connect LFO 2
    if (lfo2Target === 0 || lfo2Target === 2) {
      this.lfo2Gain.connect(this.filter1.frequency);
    }
    if (lfo2Target === 1 || lfo2Target === 2) {
      this.lfo2Gain.connect(this.filter2.frequency);
    }
  }

  private applyAllParameters(): void {
    this.applyFilter1Settings();
    this.applyFilter2Settings();
    this.applyLfoSettings();
    this.applyMixSettings();
  }

  private applyFilter1Settings(): void {
    const t = this.audioContext.currentTime;
    
    // Set filter type
    const types: BiquadFilterType[] = ['lowpass', 'highpass', 'bandpass', 'notch'];
    this.filter1.type = types[Math.floor(this.params.filter1Type)] || 'lowpass';
    
    // Set frequency and resonance
    this.filter1.frequency.setTargetAtTime(
      clamp(this.params.filter1Freq, 20, 20000),
      t,
      0.01
    );
    this.filter1.Q.setTargetAtTime(
      clamp(this.params.filter1Res, 0.1, 30),
      t,
      0.01
    );
    
    // Set enabled state
    this.filter1Gain.gain.setTargetAtTime(
      this.params.filter1Enabled > 0.5 ? 1 : 0,
      t,
      0.01
    );
  }

  private applyFilter2Settings(): void {
    const t = this.audioContext.currentTime;
    
    // Set filter type
    const types: BiquadFilterType[] = ['lowpass', 'highpass', 'bandpass', 'notch'];
    this.filter2.type = types[Math.floor(this.params.filter2Type)] || 'highpass';
    
    // Set frequency and resonance
    this.filter2.frequency.setTargetAtTime(
      clamp(this.params.filter2Freq, 20, 20000),
      t,
      0.01
    );
    this.filter2.Q.setTargetAtTime(
      clamp(this.params.filter2Res, 0.1, 30),
      t,
      0.01
    );
    
    // Set enabled state
    this.filter2Gain.gain.setTargetAtTime(
      this.params.filter2Enabled > 0.5 ? 1 : 0,
      t,
      0.01
    );
  }

  private applyLfoSettings(): void {
    const t = this.audioContext.currentTime;
    
    // LFO 1
    this.lfo1.frequency.setTargetAtTime(
      clamp(this.params.lfo1Rate, 0.01, 20),
      t,
      0.01
    );
    
    // LFO depth is scaled by filter frequency for meaningful modulation
    const lfo1DepthHz = this.params.lfo1Depth * this.params.filter1Freq * 0.5;
    this.lfo1Gain.gain.setTargetAtTime(lfo1DepthHz, t, 0.01);
    
    // LFO 2
    this.lfo2.frequency.setTargetAtTime(
      clamp(this.params.lfo2Rate, 0.01, 20),
      t,
      0.01
    );
    
    const lfo2DepthHz = this.params.lfo2Depth * this.params.filter2Freq * 0.5;
    this.lfo2Gain.gain.setTargetAtTime(lfo2DepthHz, t, 0.01);
    
    this.updateLfoRouting();
  }

  private applyMixSettings(): void {
    const newMode: FilterMixMode = this.params.mixMode > 0.5 ? 'parallel' : 'serial';
    
    if (newMode !== this.mixMode) {
      this.mixMode = newMode;
      this.updateRouting();
    }
    
    // In parallel mode, adjust the mix between filters
    if (this.mixMode === 'parallel') {
      const mix = clamp(this.params.filterMix, 0, 1);
      const t = this.audioContext.currentTime;
      this.filter1Gain.gain.setTargetAtTime(1 - mix, t, 0.01);
      this.filter2Gain.gain.setTargetAtTime(mix, t, 0.01);
    }
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      // Filter 1
      { name: 'Filter 1 Type', key: 'filter1Type', min: 0, max: 3, default: 0, type: 'enum', enumValues: ['Lowpass', 'Highpass', 'Bandpass', 'Notch'] },
      { name: 'Filter 1 Freq', key: 'filter1Freq', min: 20, max: 20000, default: 2000, unit: 'Hz', type: 'logarithmic' },
      { name: 'Filter 1 Res', key: 'filter1Res', min: 0.1, max: 30, default: 1, type: 'logarithmic' },
      { name: 'Filter 1 On', key: 'filter1Enabled', min: 0, max: 1, default: 1, type: 'boolean' },
      
      // Filter 2
      { name: 'Filter 2 Type', key: 'filter2Type', min: 0, max: 3, default: 1, type: 'enum', enumValues: ['Lowpass', 'Highpass', 'Bandpass', 'Notch'] },
      { name: 'Filter 2 Freq', key: 'filter2Freq', min: 20, max: 20000, default: 500, unit: 'Hz', type: 'logarithmic' },
      { name: 'Filter 2 Res', key: 'filter2Res', min: 0.1, max: 30, default: 1, type: 'logarithmic' },
      { name: 'Filter 2 On', key: 'filter2Enabled', min: 0, max: 1, default: 1, type: 'boolean' },
      
      // Mix
      { name: 'Mix Mode', key: 'mixMode', min: 0, max: 1, default: 0, type: 'enum', enumValues: ['Serial', 'Parallel'] },
      { name: 'Filter Mix', key: 'filterMix', min: 0, max: 1, default: 0.5, type: 'linear' },
      
      // LFO 1
      { name: 'LFO 1 Rate', key: 'lfo1Rate', min: 0.01, max: 20, default: 1, unit: 'Hz', type: 'logarithmic' },
      { name: 'LFO 1 Depth', key: 'lfo1Depth', min: 0, max: 1, default: 0, type: 'linear' },
      { name: 'LFO 1 Target', key: 'lfo1Target', min: 0, max: 2, default: 0, type: 'enum', enumValues: ['Filter 1', 'Filter 2', 'Both'] },
      
      // LFO 2
      { name: 'LFO 2 Rate', key: 'lfo2Rate', min: 0.01, max: 20, default: 0.5, unit: 'Hz', type: 'logarithmic' },
      { name: 'LFO 2 Depth', key: 'lfo2Depth', min: 0, max: 1, default: 0, type: 'linear' },
      { name: 'LFO 2 Target', key: 'lfo2Target', min: 0, max: 2, default: 1, type: 'enum', enumValues: ['Filter 1', 'Filter 2', 'Both'] },
      
      // Envelope
      { name: 'Envelope On', key: 'envelopeEnabled', min: 0, max: 1, default: 0, type: 'boolean' },
      { name: 'Envelope Amount', key: 'envelopeAmount', min: 0, max: 1, default: 0, type: 'linear' },
      { name: 'Envelope Target', key: 'envelopeTarget', min: 0, max: 2, default: 0, type: 'enum', enumValues: ['Filter 1', 'Filter 2', 'Both'] }
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    if (key.startsWith('filter1')) {
      this.applyFilter1Settings();
    } else if (key.startsWith('filter2')) {
      this.applyFilter2Settings();
    } else if (key.startsWith('lfo')) {
      this.applyLfoSettings();
    } else if (key === 'mixMode' || key === 'filterMix') {
      this.applyMixSettings();
    } else if (key.startsWith('envelope')) {
      this.envelopeFollowerEnabled = this.params.envelopeEnabled > 0.5;
      this.envelopeAmount = this.params.envelopeAmount;
    }
  }

  /**
   * Get current envelope level (for visualization)
   */
  getEnvelopeLevel(): number {
    this.analyser.getFloatTimeDomainData(this.envelopeBuffer as Float32Array<ArrayBuffer>);
    
    let sum = 0;
    for (let i = 0; i < this.envelopeBuffer.length; i++) {
      sum += this.envelopeBuffer[i] * this.envelopeBuffer[i];
    }
    
    return Math.sqrt(sum / this.envelopeBuffer.length);
  }

  /**
   * Get frequency response data for visualization
   */
  getFrequencyResponse(frequencies: Float32Array<ArrayBuffer>): { filter1: Float32Array; filter2: Float32Array } {
    const magResponse1 = new Float32Array(frequencies.length) as Float32Array<ArrayBuffer>;
    const phaseResponse1 = new Float32Array(frequencies.length) as Float32Array<ArrayBuffer>;
    const magResponse2 = new Float32Array(frequencies.length) as Float32Array<ArrayBuffer>;
    const phaseResponse2 = new Float32Array(frequencies.length) as Float32Array<ArrayBuffer>;
    
    this.filter1.getFrequencyResponse(frequencies, magResponse1, phaseResponse1);
    this.filter2.getFrequencyResponse(frequencies, magResponse2, phaseResponse2);
    
    return {
      filter1: magResponse1,
      filter2: magResponse2
    };
  }

  /**
   * Set filter 1 type
   */
  setFilter1Type(type: FilterType): void {
    const typeMap: Record<FilterType, number> = {
      'lowpass': 0,
      'highpass': 1,
      'bandpass': 2,
      'notch': 3
    };
    this.setParameter('filter1Type', typeMap[type]);
  }

  /**
   * Set filter 2 type
   */
  setFilter2Type(type: FilterType): void {
    const typeMap: Record<FilterType, number> = {
      'lowpass': 0,
      'highpass': 1,
      'bandpass': 2,
      'notch': 3
    };
    this.setParameter('filter2Type', typeMap[type]);
  }

  /**
   * Set mix mode
   */
  setMixMode(mode: FilterMixMode): void {
    this.setParameter('mixMode', mode === 'parallel' ? 1 : 0);
  }

  private addDefaultPresets(): void {
    this.addPreset({
      name: 'Bandpass Sweep',
      params: {
        filter1Type: 0, filter1Freq: 1000, filter1Res: 5, filter1Enabled: 1,
        filter2Type: 1, filter2Freq: 500, filter2Res: 5, filter2Enabled: 1,
        mixMode: 0, lfo1Rate: 0.5, lfo1Depth: 0.5, lfo1Target: 2
      }
    });
    
    this.addPreset({
      name: 'Parallel Filters',
      params: {
        filter1Type: 0, filter1Freq: 800, filter1Res: 8, filter1Enabled: 1,
        filter2Type: 1, filter2Freq: 2000, filter2Res: 8, filter2Enabled: 1,
        mixMode: 1, filterMix: 0.5
      }
    });
    
    this.addPreset({
      name: 'Wah Effect',
      params: {
        filter1Type: 2, filter1Freq: 1500, filter1Res: 15, filter1Enabled: 1,
        filter2Type: 2, filter2Freq: 1500, filter2Res: 15, filter2Enabled: 0,
        mixMode: 0, lfo1Rate: 2, lfo1Depth: 0.8, lfo1Target: 0
      }
    });
    
    this.addPreset({
      name: 'Notch Sweep',
      params: {
        filter1Type: 3, filter1Freq: 1000, filter1Res: 10, filter1Enabled: 1,
        filter2Type: 3, filter2Freq: 2000, filter2Res: 10, filter2Enabled: 1,
        mixMode: 0, lfo1Rate: 0.2, lfo1Depth: 0.6, lfo1Target: 0,
        lfo2Rate: 0.3, lfo2Depth: 0.6, lfo2Target: 1
      }
    });
  }

  dispose(): void {
    super.dispose();
    
    this.lfo1.stop();
    this.lfo2.stop();
    
    this.filter1.disconnect();
    this.filter1Gain.disconnect();
    this.filter2.disconnect();
    this.filter2Gain.disconnect();
    this.lfo1.disconnect();
    this.lfo1Gain.disconnect();
    this.lfo2.disconnect();
    this.lfo2Gain.disconnect();
    this.analyser.disconnect();
    this.parallelMixer.disconnect();
  }
}