// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Delay - Delay effect with tempo sync, ping-pong mode, and feedback filtering
 */

import { BaseEffect, EffectParameterDescriptor } from './BaseEffect';
import { clamp, bpmToMs } from '../utils/AudioMath';

/**
 * Delay effect with stereo ping-pong mode and filtered feedback
 */
export class Delay extends BaseEffect {
  private delayNodeL: DelayNode;
  private delayNodeR: DelayNode;
  private feedbackGainL: GainNode;
  private feedbackGainR: GainNode;
  private feedbackFilter: BiquadFilterNode;
  private crossFeedL: GainNode;
  private crossFeedR: GainNode;
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  private pingPong: boolean = false;
  private currentBpm: number = 120;
  private static readonly MAX_DELAY_TIME = 5.0;

  constructor(audioContext: AudioContext, id: string, name: string = 'Delay') {
    super(audioContext, id, name, 'delay');
    this.delayNodeL = audioContext.createDelay(Delay.MAX_DELAY_TIME);
    this.delayNodeR = audioContext.createDelay(Delay.MAX_DELAY_TIME);
    this.feedbackGainL = audioContext.createGain();
    this.feedbackGainR = audioContext.createGain();
    this.crossFeedL = audioContext.createGain();
    this.crossFeedR = audioContext.createGain();
    this.feedbackFilter = audioContext.createBiquadFilter();
    this.feedbackFilter.type = 'lowpass';
    this.feedbackFilter.frequency.value = 8000;
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    this.initializeEffect();
    this.setupRouting();
    this.addDefaultPresets();
  }

  protected initializeEffect(): void {
    this.params = {
      time: 0.25, feedback: 0.4, filterFreq: 8000,
      pingPong: 0, tempoSync: 0, noteValue: 0.25, spread: 0
    };
    this.applyDelayTime();
    this.applyFeedback();
    this.applyFilterFreq();
    this.applyPingPong();
  }

  private setupRouting(): void {
    this.inputNode.connect(this.splitter);
    this.splitter.connect(this.delayNodeL, 0);
    this.splitter.connect(this.delayNodeR, 1);
    this.delayNodeL.connect(this.feedbackGainL);
    this.delayNodeR.connect(this.feedbackGainR);
    this.feedbackGainL.connect(this.feedbackFilter);
    this.feedbackGainR.connect(this.feedbackFilter);
    this.feedbackFilter.connect(this.delayNodeL);
    this.feedbackFilter.connect(this.delayNodeR);
    this.delayNodeL.connect(this.crossFeedL);
    this.crossFeedL.connect(this.delayNodeR);
    this.delayNodeR.connect(this.crossFeedR);
    this.crossFeedR.connect(this.delayNodeL);
    this.crossFeedL.gain.value = 0;
    this.crossFeedR.gain.value = 0;
    this.delayNodeL.connect(this.merger, 0, 0);
    this.delayNodeR.connect(this.merger, 0, 1);
    this.merger.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { name: 'Delay Time', key: 'time', min: 0.001, max: 5, default: 0.25, unit: 's', type: 'logarithmic' },
      { name: 'Feedback', key: 'feedback', min: 0, max: 0.95, default: 0.4, type: 'linear' },
      { name: 'Filter', key: 'filterFreq', min: 200, max: 20000, default: 8000, unit: 'Hz', type: 'logarithmic' },
      { name: 'Ping-Pong', key: 'pingPong', min: 0, max: 1, default: 0, type: 'boolean' },
      { name: 'Tempo Sync', key: 'tempoSync', min: 0, max: 1, default: 0, type: 'boolean' },
      { name: 'Note Value', key: 'noteValue', min: 0.0625, max: 2, default: 0.25, type: 'linear' },
      { name: 'Spread', key: 'spread', min: 0, max: 1, default: 0, type: 'linear' }
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    if (key === 'time' || key === 'noteValue' || key === 'tempoSync') this.applyDelayTime();
    else if (key === 'feedback') this.applyFeedback();
    else if (key === 'filterFreq') this.applyFilterFreq();
    else if (key === 'pingPong' || key === 'spread') this.applyPingPong();
  }

  private applyDelayTime(): void {
    let delayTime = this.params.tempoSync > 0.5 
      ? bpmToMs(this.currentBpm, this.params.noteValue) / 1000 
      : this.params.time;
    delayTime = clamp(delayTime, 0.001, Delay.MAX_DELAY_TIME);
    const t = this.audioContext.currentTime;
    const time = this.pingPong ? delayTime / 2 : delayTime;
    this.delayNodeL.delayTime.setTargetAtTime(time, t, 0.01);
    this.delayNodeR.delayTime.setTargetAtTime(time, t, 0.01);
  }

  private applyFeedback(): void {
    const fb = clamp(this.params.feedback, 0, 0.95);
    const t = this.audioContext.currentTime;
    const val = this.pingPong ? 0 : fb;
    this.feedbackGainL.gain.setTargetAtTime(val, t, 0.01);
    this.feedbackGainR.gain.setTargetAtTime(val, t, 0.01);
  }

  private applyFilterFreq(): void {
    this.feedbackFilter.frequency.setTargetAtTime(
      clamp(this.params.filterFreq, 200, 20000), this.audioContext.currentTime, 0.01
    );
  }

  private applyPingPong(): void {
    this.pingPong = this.params.pingPong > 0.5;
    const fb = clamp(this.params.feedback, 0, 0.95);
    const t = this.audioContext.currentTime;
    this.crossFeedL.gain.setTargetAtTime(this.pingPong ? fb : 0, t, 0.01);
    this.crossFeedR.gain.setTargetAtTime(this.pingPong ? fb : 0, t, 0.01);
    this.feedbackGainL.gain.setTargetAtTime(this.pingPong ? 0 : fb, t, 0.01);
    this.feedbackGainR.gain.setTargetAtTime(this.pingPong ? 0 : fb, t, 0.01);
    this.applyDelayTime();
  }

  setTempo(bpm: number): void {
    this.currentBpm = clamp(bpm, 20, 999);
    if (this.params.tempoSync > 0.5) this.applyDelayTime();
  }

  private addDefaultPresets(): void {
    this.addPreset({ name: 'Short Slap', params: { time: 0.08, feedback: 0.2, filterFreq: 6000, pingPong: 0 } });
    this.addPreset({ name: 'Quarter Note', params: { time: 0.25, feedback: 0.4, filterFreq: 8000, pingPong: 0 } });
    this.addPreset({ name: 'Ping Pong', params: { time: 0.3, feedback: 0.5, filterFreq: 5000, pingPong: 1 } });
    this.addPreset({ name: 'Dub Delay', params: { time: 0.375, feedback: 0.7, filterFreq: 2000, pingPong: 0 } });
  }

  dispose(): void {
    super.dispose();
    this.delayNodeL.disconnect();
    this.delayNodeR.disconnect();
    this.feedbackGainL.disconnect();
    this.feedbackGainR.disconnect();
    this.feedbackFilter.disconnect();
    this.crossFeedL.disconnect();
    this.crossFeedR.disconnect();
    this.splitter.disconnect();
    this.merger.disconnect();
  }
}