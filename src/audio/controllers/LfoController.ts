// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * LFO Controller
 * Low Frequency Oscillator for modulation
 */

import { Controller } from './Controller';
import { LFOWaveform } from '../../types/controller';

export class LfoController extends Controller {
  private waveform: LFOWaveform = LFOWaveform.Sine;
  private frequency: number = 1.0;
  private phase: number = 0.0;
  private amount: number = 1.0;
  private offset: number = 0.0;
  
  // Tempo sync
  private syncToTempo: boolean = false;
  private tempoSync: number = 1.0; // Beats per cycle
  private currentBpm: number = 120;

  constructor(id: string, sampleRate: number) {
    super(id, sampleRate);
  }

  public setParams(params: {
    waveform?: LFOWaveform;
    frequency?: number;
    phase?: number;
    amount?: number;
    offset?: number;
    syncToTempo?: boolean;
    tempoSync?: number;
  }) {
    if (params.waveform !== undefined) this.waveform = params.waveform;
    if (params.frequency !== undefined) this.frequency = params.frequency;
    if (params.phase !== undefined) this.phase = params.phase;
    if (params.amount !== undefined) this.amount = params.amount;
    if (params.offset !== undefined) this.offset = params.offset;
    if (params.syncToTempo !== undefined) this.syncToTempo = params.syncToTempo;
    if (params.tempoSync !== undefined) this.tempoSync = params.tempoSync;
  }

  public setBpm(bpm: number) {
    this.currentBpm = bpm;
  }

  public getValue(time: number): number {
    if (!this.enabled) return 0;

    let freq = this.frequency;
    if (this.syncToTempo) {
      // Calculate frequency from BPM and beats per cycle
      // BPM / 60 = Beats per second
      // Frequency = (Beats per second) / Beats per cycle
      freq = (this.currentBpm / 60.0) / this.tempoSync;
    }

    // Calculate phase
    // time * freq * 2PI + phaseOffset
    const t = time * freq + this.phase;
    const phase = t - Math.floor(t); // 0..1

    let oscValue = 0;

    switch (this.waveform) {
      case LFOWaveform.Sine:
        oscValue = Math.sin(phase * Math.PI * 2);
        break;
      case LFOWaveform.Triangle:
        // 0..0.25 -> 0..1
        // 0.25..0.75 -> 1..-1
        // 0.75..1 -> -1..0
        oscValue = 1 - 4 * Math.abs(Math.round(phase) - phase);
        break;
      case LFOWaveform.Sawtooth:
        // 0..1 -> -1..1
        oscValue = 2 * (phase - Math.floor(phase + 0.5));
        break;
      case LFOWaveform.Square:
        oscValue = phase < 0.5 ? 1 : -1;
        break;
      case LFOWaveform.Random:
        // Sample and hold noise (simplified)
        // Needs state to be proper S&H
        oscValue = Math.random() * 2 - 1; 
        break;
      default:
        oscValue = Math.sin(phase * Math.PI * 2);
    }

    // Apply amount and offset
    return oscValue * this.amount + this.offset;
  }
}
