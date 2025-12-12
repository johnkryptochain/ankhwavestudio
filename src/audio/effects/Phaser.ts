// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Phaser Effect - Multi-stage phaser with LFO modulation
 * Based on original AnkhWaveStudio phaser implementation
 */

import { BaseEffect, EffectParameterDescriptor, EffectPreset } from './BaseEffect';

interface AllpassFilter {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

/**
 * Phaser effect processor
 */
export class Phaser extends BaseEffect {
  // Additional audio nodes
  private wetGainL: GainNode;
  private wetGainR: GainNode;
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  
  // Allpass filter states (manual processing)
  private allpassFiltersL: AllpassFilter[] = [];
  private allpassFiltersR: AllpassFilter[] = [];
  
  // LFO state
  private lfoPhaseL: number = 0;
  private lfoPhaseR: number = 0;
  
  // ScriptProcessor for manual allpass processing
  private scriptProcessor: ScriptProcessorNode;
  
  // Feedback buffers
  private feedbackL: number = 0;
  private feedbackR: number = 0;
  
  // Default presets
  private static readonly defaultPresets: EffectPreset[] = [
    {
      name: 'Subtle',
      params: { stages: 4, lfoRate: 0.3, lfoDepth: 0.4, feedback: 0.3, stereoPhase: 90, minFreq: 200, maxFreq: 2000, mix: 0.5 }
    },
    {
      name: 'Classic',
      params: { stages: 6, lfoRate: 0.5, lfoDepth: 0.6, feedback: 0.5, stereoPhase: 90, minFreq: 300, maxFreq: 3000, mix: 0.5 }
    },
    {
      name: 'Deep',
      params: { stages: 8, lfoRate: 0.2, lfoDepth: 0.8, feedback: 0.7, stereoPhase: 120, minFreq: 100, maxFreq: 4000, mix: 0.6 }
    },
    {
      name: 'Fast Sweep',
      params: { stages: 4, lfoRate: 2, lfoDepth: 0.5, feedback: 0.4, stereoPhase: 45, minFreq: 400, maxFreq: 2500, mix: 0.5 }
    },
    {
      name: 'Jet',
      params: { stages: 12, lfoRate: 0.1, lfoDepth: 0.9, feedback: 0.8, stereoPhase: 180, minFreq: 100, maxFreq: 5000, mix: 0.7 }
    },
    {
      name: 'Stereo Wide',
      params: { stages: 6, lfoRate: 0.4, lfoDepth: 0.6, feedback: 0.5, stereoPhase: 180, minFreq: 200, maxFreq: 3500, mix: 0.5 }
    },
  ];

  constructor(audioContext: AudioContext, id: string = 'phaser') {
    super(audioContext, id, 'Phaser', 'phaser');
    
    // Create additional gain nodes for stereo wet signal
    this.wetGainL = audioContext.createGain();
    this.wetGainR = audioContext.createGain();
    
    // Create channel splitter/merger
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    
    // Create script processor for allpass filtering
    // Using 2048 buffer size for balance between latency and performance
    this.scriptProcessor = audioContext.createScriptProcessor(2048, 2, 2);
    this.scriptProcessor.onaudioprocess = this.processAudio.bind(this);
    
    // Initialize allpass filters
    this.initializeAllpassFilters();
    
    // Load default presets
    for (const preset of Phaser.defaultPresets) {
      this.addPreset(preset);
    }
    
    // Initialize effect
    this.initializeEffect();
    
    // Connect audio graph
    this.connectAudioGraph();
  }

  /**
   * Connect the audio graph
   */
  private connectAudioGraph(): void {
    // Input -> script processor -> splitter
    this.inputNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.splitter);
    
    // Split wet signal
    this.splitter.connect(this.wetGainL, 0);
    this.splitter.connect(this.wetGainR, 1);
    
    // Merge wet signal
    this.wetGainL.connect(this.merger, 0, 0);
    this.wetGainR.connect(this.merger, 0, 1);
    
    // Wet to wetGain (from base class)
    this.merger.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  /**
   * Initialize allpass filter states
   */
  private initializeAllpassFilters(): void {
    this.allpassFiltersL = [];
    this.allpassFiltersR = [];
    
    for (let i = 0; i < 12; i++) {
      this.allpassFiltersL.push({ x1: 0, x2: 0, y1: 0, y2: 0 });
      this.allpassFiltersR.push({ x1: 0, x2: 0, y1: 0, y2: 0 });
    }
  }

  /**
   * Initialize effect with default parameters
   */
  protected initializeEffect(): void {
    // Set default parameters
    this.params = {
      stages: 6,
      lfoRate: 0.5,
      lfoDepth: 0.6,
      feedback: 0.5,
      stereoPhase: 90,
      minFreq: 300,
      maxFreq: 3000,
      mix: 0.5,
    };
    
    // Apply initial wet gain
    this.wetGainL.gain.value = 1;
    this.wetGainR.gain.value = 1;
  }

  /**
   * Get parameter descriptors for UI generation
   */
  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'Stages', key: 'stages', min: 2, max: 12, default: 6, step: 2, unit: '' },
      { name: 'LFO Rate', key: 'lfoRate', min: 0.01, max: 10, default: 0.5, step: 0.01, unit: 'Hz', type: 'logarithmic' },
      { name: 'LFO Depth', key: 'lfoDepth', min: 0, max: 1, default: 0.6, step: 0.01, unit: '%' },
      { name: 'Feedback', key: 'feedback', min: -0.9, max: 0.9, default: 0.5, step: 0.01, unit: '' },
      { name: 'Stereo Phase', key: 'stereoPhase', min: 0, max: 180, default: 90, step: 1, unit: '°' },
      { name: 'Min Frequency', key: 'minFreq', min: 100, max: 1000, default: 300, step: 10, unit: 'Hz', type: 'logarithmic' },
      { name: 'Max Frequency', key: 'maxFreq', min: 1000, max: 10000, default: 3000, step: 100, unit: 'Hz', type: 'logarithmic' },
      { name: 'Mix', key: 'mix', min: 0, max: 1, default: 0.5, step: 0.01, unit: '%' },
    ];
  }

  /**
   * Handle parameter changes
   */
  protected onParameterChange(key: string, value: number): void {
    switch (key) {
      case 'stages':
        // Stages are handled in processAudio
        break;
      case 'mix':
        this.setWetDry(value);
        break;
      // Other parameters are read directly in processAudio
    }
  }

  /**
   * Process audio through allpass filters
   */
  private processAudio(event: AudioProcessingEvent): void {
    const inputL = event.inputBuffer.getChannelData(0);
    const inputR = event.inputBuffer.getChannelData(1);
    const outputL = event.outputBuffer.getChannelData(0);
    const outputR = event.outputBuffer.getChannelData(1);
    
    const sampleRate = this.audioContext.sampleRate;
    const bufferSize = inputL.length;
    
    const stages = Math.round(this.params.stages || 6);
    const lfoRate = this.params.lfoRate || 0.5;
    const lfoDepth = this.params.lfoDepth || 0.6;
    const feedback = this.params.feedback || 0.5;
    const stereoPhase = this.params.stereoPhase || 90;
    const minFreq = this.params.minFreq || 300;
    const maxFreq = this.params.maxFreq || 3000;
    
    const lfoIncrement = (lfoRate * Math.PI * 2) / sampleRate;
    const stereoPhaseOffset = (stereoPhase * Math.PI) / 180;
    
    for (let i = 0; i < bufferSize; i++) {
      // Update LFO phases
      this.lfoPhaseL += lfoIncrement;
      if (this.lfoPhaseL > Math.PI * 2) {
        this.lfoPhaseL -= Math.PI * 2;
      }
      this.lfoPhaseR = this.lfoPhaseL + stereoPhaseOffset;
      
      // Calculate LFO values (0 to 1)
      const lfoL = (Math.sin(this.lfoPhaseL) + 1) * 0.5;
      const lfoR = (Math.sin(this.lfoPhaseR) + 1) * 0.5;
      
      // Calculate sweep frequencies
      const freqL = minFreq + (maxFreq - minFreq) * lfoL * lfoDepth;
      const freqR = minFreq + (maxFreq - minFreq) * lfoR * lfoDepth;
      
      // Calculate allpass coefficients
      const coeffL = this.calculateAllpassCoeff(freqL, sampleRate);
      const coeffR = this.calculateAllpassCoeff(freqR, sampleRate);
      
      // Process left channel
      let sampleL = inputL[i] + this.feedbackL * feedback;
      for (let s = 0; s < stages; s++) {
        sampleL = this.processAllpass(sampleL, this.allpassFiltersL[s], coeffL);
      }
      this.feedbackL = sampleL;
      outputL[i] = sampleL;
      
      // Process right channel
      let sampleR = inputR[i] + this.feedbackR * feedback;
      for (let s = 0; s < stages; s++) {
        sampleR = this.processAllpass(sampleR, this.allpassFiltersR[s], coeffR);
      }
      this.feedbackR = sampleR;
      outputR[i] = sampleR;
    }
  }

  /**
   * Calculate allpass filter coefficient for given frequency
   */
  private calculateAllpassCoeff(freq: number, sampleRate: number): number {
    const w0 = (2 * Math.PI * freq) / sampleRate;
    const tan_w0_2 = Math.tan(w0 / 2);
    return (tan_w0_2 - 1) / (tan_w0_2 + 1);
  }

  /**
   * Process sample through first-order allpass filter
   */
  private processAllpass(input: number, filter: AllpassFilter, coeff: number): number {
    const output = coeff * input + filter.x1 - coeff * filter.y1;
    filter.x1 = input;
    filter.y1 = output;
    return output;
  }

  /**
   * Reset effect state
   */
  override reset(): void {
    super.reset();
    
    // Reset LFO phases
    this.lfoPhaseL = 0;
    this.lfoPhaseR = 0;
    
    // Reset feedback
    this.feedbackL = 0;
    this.feedbackR = 0;
    
    // Reset allpass filter states
    this.initializeAllpassFilters();
  }

  /**
   * Dispose of resources
   */
  override dispose(): void {
    super.dispose();
    
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor.onaudioprocess = null;
    }
    
    if (this.wetGainL) {
      this.wetGainL.disconnect();
    }
    
    if (this.wetGainR) {
      this.wetGainR.disconnect();
    }
    
    if (this.splitter) {
      this.splitter.disconnect();
    }
    
    if (this.merger) {
      this.merger.disconnect();
    }
    
    this.allpassFiltersL = [];
    this.allpassFiltersR = [];
  }
}

export default Phaser;