// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Reverb - Reverb effect with convolution and algorithmic modes
 */

import { BaseEffect, EffectParameterDescriptor } from './BaseEffect';
import { clamp } from '../utils/AudioMath';

/**
 * Reverb effect supporting both convolution and algorithmic reverb
 */
export class Reverb extends BaseEffect {
  private convolver: ConvolverNode;
  private preDelay: DelayNode;
  private dampingFilter: BiquadFilterNode;
  private earlyReflections: GainNode;
  private lateReflections: GainNode;
  private impulseBuffer: AudioBuffer | null = null;
  private useConvolution: boolean = false;
  private algorithmicNodes: AlgorithmicReverbNodes | null = null;

  constructor(audioContext: AudioContext, id: string, name: string = 'Reverb') {
    super(audioContext, id, name, 'reverb');
    this.convolver = audioContext.createConvolver();
    this.preDelay = audioContext.createDelay(0.1);
    this.dampingFilter = audioContext.createBiquadFilter();
    this.dampingFilter.type = 'lowpass';
    this.dampingFilter.frequency.value = 8000;
    this.earlyReflections = audioContext.createGain();
    this.lateReflections = audioContext.createGain();
    this.initializeEffect();
    this.setupAlgorithmicReverb();
    this.setupRouting();
    this.addDefaultPresets();
  }

  protected initializeEffect(): void {
    this.params = {
      roomSize: 0.5, damping: 0.5, preDelay: 0.02, earlyLevel: 0.5,
      lateLevel: 0.8, highCut: 8000, lowCut: 200, decay: 2.0, diffusion: 0.7
    };
    this.applyParameters();
  }

  private setupAlgorithmicReverb(): void {
    const ctx = this.audioContext;
    const delays: DelayNode[] = [];
    const feedbacks: GainNode[] = [];
    const filters: BiquadFilterNode[] = [];
    const delayTimes = [0.029, 0.037, 0.041, 0.043, 0.047, 0.053, 0.059, 0.061];
    
    for (let i = 0; i < 8; i++) {
      const delay = ctx.createDelay(0.1);
      delay.delayTime.value = delayTimes[i];
      const feedback = ctx.createGain();
      feedback.gain.value = 0.5;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 8000;
      delays.push(delay);
      feedbacks.push(feedback);
      filters.push(filter);
    }
    
    const inputMixer = ctx.createGain();
    const outputMixer = ctx.createGain();
    const allpassDelays: DelayNode[] = [];
    const allpassGains: GainNode[] = [];
    const allpassTimes = [0.005, 0.012, 0.004, 0.017];
    
    for (let i = 0; i < 4; i++) {
      const delay = ctx.createDelay(0.05);
      delay.delayTime.value = allpassTimes[i];
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      allpassDelays.push(delay);
      allpassGains.push(gain);
    }
    
    this.algorithmicNodes = { delays, feedbacks, filters, inputMixer, outputMixer, allpassDelays, allpassGains };
    this.connectAlgorithmicReverb();
  }

  private connectAlgorithmicReverb(): void {
    if (!this.algorithmicNodes) return;
    const { delays, feedbacks, filters, inputMixer, outputMixer, allpassDelays, allpassGains } = this.algorithmicNodes;
    
    // Connect allpass diffusers in series
    let lastNode: AudioNode = inputMixer;
    for (let i = 0; i < allpassDelays.length; i++) {
      lastNode.connect(allpassDelays[i]);
      allpassDelays[i].connect(allpassGains[i]);
      allpassGains[i].connect(allpassDelays[i]);
      lastNode = allpassDelays[i];
    }
    
    // Connect parallel comb filters
    for (let i = 0; i < delays.length; i++) {
      lastNode.connect(delays[i]);
      delays[i].connect(filters[i]);
      filters[i].connect(feedbacks[i]);
      feedbacks[i].connect(delays[i]);
      delays[i].connect(outputMixer);
    }
  }

  private setupRouting(): void {
    // Pre-delay path
    this.inputNode.connect(this.preDelay);
    this.preDelay.connect(this.dampingFilter);
    
    if (this.useConvolution && this.impulseBuffer) {
      this.dampingFilter.connect(this.convolver);
      this.convolver.connect(this.wetGain);
    } else if (this.algorithmicNodes) {
      this.dampingFilter.connect(this.algorithmicNodes.inputMixer);
      this.algorithmicNodes.outputMixer.connect(this.wetGain);
    }
    
    this.wetGain.connect(this.outputNode);
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'Room Size', key: 'roomSize', min: 0, max: 1, default: 0.5, type: 'linear' },
      { name: 'Damping', key: 'damping', min: 0, max: 1, default: 0.5, type: 'linear' },
      { name: 'Pre-Delay', key: 'preDelay', min: 0, max: 0.1, default: 0.02, unit: 's', type: 'linear' },
      { name: 'Early Level', key: 'earlyLevel', min: 0, max: 1, default: 0.5, type: 'linear' },
      { name: 'Late Level', key: 'lateLevel', min: 0, max: 1, default: 0.8, type: 'linear' },
      { name: 'High Cut', key: 'highCut', min: 1000, max: 20000, default: 8000, unit: 'Hz', type: 'logarithmic' },
      { name: 'Decay', key: 'decay', min: 0.1, max: 10, default: 2.0, unit: 's', type: 'logarithmic' },
      { name: 'Diffusion', key: 'diffusion', min: 0, max: 1, default: 0.7, type: 'linear' }
    ];
  }

  protected onParameterChange(key: string, _value: number): void {
    this.applyParameters();
  }

  private applyParameters(): void {
    const t = this.audioContext.currentTime;
    this.preDelay.delayTime.setTargetAtTime(clamp(this.params.preDelay, 0, 0.1), t, 0.01);
    this.dampingFilter.frequency.setTargetAtTime(clamp(this.params.highCut, 1000, 20000), t, 0.01);
    
    if (this.algorithmicNodes) {
      const roomSize = clamp(this.params.roomSize, 0, 1);
      const decay = clamp(this.params.decay, 0.1, 10);
      const damping = clamp(this.params.damping, 0, 1);
      const diffusion = clamp(this.params.diffusion, 0, 1);
      const baseFeedback = 0.3 + roomSize * 0.65;
      const decayFactor = Math.pow(0.001, 1 / (decay * this.audioContext.sampleRate));
      
      for (let i = 0; i < this.algorithmicNodes.delays.length; i++) {
        const baseTime = [0.029, 0.037, 0.041, 0.043, 0.047, 0.053, 0.059, 0.061][i];
        this.algorithmicNodes.delays[i].delayTime.setTargetAtTime(baseTime * (0.5 + roomSize), t, 0.01);
        this.algorithmicNodes.feedbacks[i].gain.setTargetAtTime(baseFeedback * decayFactor, t, 0.01);
        this.algorithmicNodes.filters[i].frequency.setTargetAtTime(20000 - damping * 18000, t, 0.01);
      }
      
      for (let i = 0; i < this.algorithmicNodes.allpassGains.length; i++) {
        this.algorithmicNodes.allpassGains[i].gain.setTargetAtTime(0.3 + diffusion * 0.4, t, 0.01);
      }
    }
  }

  async loadImpulseResponse(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.impulseBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.convolver.buffer = this.impulseBuffer;
      this.useConvolution = true;
      this.reconnect();
    } catch (error) {
      console.error('Failed to load impulse response:', error);
      this.useConvolution = false;
    }
  }

  setConvolutionMode(useConvolution: boolean): void {
    if (useConvolution && !this.impulseBuffer) {
      console.warn('No impulse response loaded, staying in algorithmic mode');
      return;
    }
    this.useConvolution = useConvolution;
    this.reconnect();
  }

  private reconnect(): void {
    this.preDelay.disconnect();
    this.dampingFilter.disconnect();
    if (this.algorithmicNodes) this.algorithmicNodes.outputMixer.disconnect();
    this.convolver.disconnect();
    this.setupRouting();
  }

  private addDefaultPresets(): void {
    this.addPreset({ name: 'Small Room', params: { roomSize: 0.2, damping: 0.7, decay: 0.5, preDelay: 0.005 } });
    this.addPreset({ name: 'Medium Hall', params: { roomSize: 0.5, damping: 0.5, decay: 1.5, preDelay: 0.02 } });
    this.addPreset({ name: 'Large Hall', params: { roomSize: 0.8, damping: 0.3, decay: 3.0, preDelay: 0.04 } });
    this.addPreset({ name: 'Cathedral', params: { roomSize: 1.0, damping: 0.2, decay: 6.0, preDelay: 0.06 } });
    this.addPreset({ name: 'Plate', params: { roomSize: 0.4, damping: 0.6, decay: 2.0, diffusion: 0.9 } });
  }

  dispose(): void {
    super.dispose();
    this.convolver.disconnect();
    this.preDelay.disconnect();
    this.dampingFilter.disconnect();
    if (this.algorithmicNodes) {
      this.algorithmicNodes.delays.forEach(d => d.disconnect());
      this.algorithmicNodes.feedbacks.forEach(f => f.disconnect());
      this.algorithmicNodes.filters.forEach(f => f.disconnect());
      this.algorithmicNodes.allpassDelays.forEach(d => d.disconnect());
      this.algorithmicNodes.inputMixer.disconnect();
      this.algorithmicNodes.outputMixer.disconnect();
    }
  }
}

interface AlgorithmicReverbNodes {
  delays: DelayNode[];
  feedbacks: GainNode[];
  filters: BiquadFilterNode[];
  inputMixer: GainNode;
  outputMixer: GainNode;
  allpassDelays: DelayNode[];
  allpassGains: GainNode[];
}