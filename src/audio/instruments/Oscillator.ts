// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Oscillator - Basic oscillator instrument with multiple waveforms and unison
 */

import { BaseInstrument, InstrumentParameterDescriptor } from './BaseInstrument';
import type { WaveformType } from '../../types/audio';
import { clamp, semitonesToRatio, centsToRatio } from '../utils/AudioMath';

interface OscillatorVoice {
  oscillators: OscillatorNode[];
  gainNodes: GainNode[];
  envelopeGain: GainNode;
  filterNode: BiquadFilterNode;
  noteNumber: number;
  frequency: number;
}

/**
 * Oscillator instrument with multiple waveforms, detune, and unison
 */
export class Oscillator extends BaseInstrument {
  private voices: Map<number, OscillatorVoice> = new Map();
  private waveform: OscillatorType = 'sawtooth';
  private unisonCount: number = 1;
  private unisonSpread: number = 0;
  private filterEnabled: boolean = true;

  constructor(audioContext: AudioContext, id: string, name: string = 'Oscillator') {
    super(audioContext, id, name, 'oscillator');
    this.initializeInstrument();
    this.addDefaultPresets();
  }

  protected initializeInstrument(): void {
    this.params = {
      waveform: 1, detune: 0, fineTune: 0, octave: 0,
      unisonVoices: 1, unisonSpread: 10, unisonMix: 0.5,
      filterCutoff: 1, filterResonance: 0, filterEnvAmount: 0,
      attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3
    };
    this.envelope = { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 };
    this.applyParameters();
  }

  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    return [
      { name: 'Waveform', key: 'waveform', min: 0, max: 3, default: 1, type: 'enum', enumValues: ['sine', 'sawtooth', 'square', 'triangle'], category: 'Oscillator' },
      { name: 'Detune', key: 'detune', min: -1200, max: 1200, default: 0, unit: 'cents', category: 'Oscillator' },
      { name: 'Fine Tune', key: 'fineTune', min: -100, max: 100, default: 0, unit: 'cents', category: 'Oscillator' },
      { name: 'Octave', key: 'octave', min: -3, max: 3, default: 0, category: 'Oscillator' },
      { name: 'Unison Voices', key: 'unisonVoices', min: 1, max: 8, default: 1, category: 'Unison' },
      { name: 'Unison Spread', key: 'unisonSpread', min: 0, max: 100, default: 10, unit: 'cents', category: 'Unison' },
      { name: 'Unison Mix', key: 'unisonMix', min: 0, max: 1, default: 0.5, category: 'Unison' },
      { name: 'Filter Cutoff', key: 'filterCutoff', min: 0, max: 1, default: 1, category: 'Filter' },
      { name: 'Filter Resonance', key: 'filterResonance', min: 0, max: 1, default: 0, category: 'Filter' },
      { name: 'Filter Env Amount', key: 'filterEnvAmount', min: -1, max: 1, default: 0, category: 'Filter' },
      { name: 'Attack', key: 'attack', min: 0.001, max: 5, default: 0.01, unit: 's', category: 'Envelope' },
      { name: 'Decay', key: 'decay', min: 0.001, max: 5, default: 0.1, unit: 's', category: 'Envelope' },
      { name: 'Sustain', key: 'sustain', min: 0, max: 1, default: 0.7, category: 'Envelope' },
      { name: 'Release', key: 'release', min: 0.001, max: 10, default: 0.3, unit: 's', category: 'Envelope' }
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    if (key === 'waveform') {
      const waveforms: OscillatorType[] = ['sine', 'sawtooth', 'square', 'triangle'];
      this.waveform = waveforms[Math.round(value)] || 'sawtooth';
      this.updateAllVoiceWaveforms();
    } else if (key === 'unisonVoices') {
      this.unisonCount = Math.round(value);
    } else if (key === 'unisonSpread') {
      this.unisonSpread = value;
      this.updateAllVoiceDetune();
    } else if (['attack', 'decay', 'sustain', 'release'].includes(key)) {
      this.envelope[key as keyof typeof this.envelope] = value;
    } else if (key === 'filterCutoff' || key === 'filterResonance') {
      this.updateAllVoiceFilters();
    } else if (['detune', 'fineTune', 'octave'].includes(key)) {
      this.updateAllVoiceDetune();
    }
  }

  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    // Stop existing voice for this note
    if (this.voices.has(noteNumber)) {
      this.releaseNote(noteNumber);
    }

    const t = this.audioContext.currentTime;
    const octaveShift = semitonesToRatio(this.params.octave * 12);
    const detuneRatio = centsToRatio(this.params.detune + this.params.fineTune);
    const baseFreq = frequency * octaveShift * detuneRatio;

    // Create envelope gain
    const envelopeGain = this.audioContext.createGain();
    envelopeGain.gain.setValueAtTime(0, t);
    envelopeGain.gain.linearRampToValueAtTime(velocity, t + this.envelope.attack);
    envelopeGain.gain.linearRampToValueAtTime(velocity * this.envelope.sustain, t + this.envelope.attack + this.envelope.decay);

    // Create filter
    const filterNode = this.audioContext.createBiquadFilter();
    filterNode.type = 'lowpass';
    const cutoffFreq = 200 + this.params.filterCutoff * 19800;
    filterNode.frequency.setValueAtTime(cutoffFreq, t);
    filterNode.Q.value = this.params.filterResonance * 20;

    // Apply filter envelope
    if (this.params.filterEnvAmount !== 0) {
      const envAmount = this.params.filterEnvAmount * 10000;
      filterNode.frequency.linearRampToValueAtTime(cutoffFreq + envAmount, t + this.envelope.attack);
      filterNode.frequency.linearRampToValueAtTime(cutoffFreq + envAmount * this.envelope.sustain, t + this.envelope.attack + this.envelope.decay);
    }

    // Create oscillators for unison
    const oscillators: OscillatorNode[] = [];
    const gainNodes: GainNode[] = [];
    const unisonGain = 1 / Math.sqrt(this.unisonCount);

    for (let i = 0; i < this.unisonCount; i++) {
      const osc = this.audioContext.createOscillator();
      osc.type = this.waveform;

      // Calculate detune for unison spread
      let unisonDetune = 0;
      if (this.unisonCount > 1) {
        const spreadRange = this.unisonSpread;
        unisonDetune = ((i / (this.unisonCount - 1)) - 0.5) * 2 * spreadRange;
      }
      
      // Set frequency directly on the oscillator (not scheduled)
      const finalFreq = baseFreq * centsToRatio(unisonDetune);
      osc.frequency.value = finalFreq;

      const gain = this.audioContext.createGain();
      gain.gain.value = unisonGain;

      osc.connect(gain);
      gain.connect(filterNode);
      osc.start(t);
      
      oscillators.push(osc);
      gainNodes.push(gain);
    }

    filterNode.connect(envelopeGain);
    envelopeGain.connect(this.volumeNode);

    this.voices.set(noteNumber, { oscillators, gainNodes, envelopeGain, filterNode, noteNumber, frequency: baseFreq });
  }

  protected releaseNote(noteNumber: number): void {
    this.doReleaseNote(noteNumber, this.envelope.release);
  }

  protected silenceNote(noteNumber: number): void {
    // Immediate release (10ms to avoid clicks)
    this.doReleaseNote(noteNumber, 0.01);
  }

  private doReleaseNote(noteNumber: number, releaseTime: number): void {
    const voice = this.voices.get(noteNumber);
    if (!voice) return;

    const t = this.audioContext.currentTime;

    voice.envelopeGain.gain.cancelScheduledValues(t);
    voice.envelopeGain.gain.setValueAtTime(voice.envelopeGain.gain.value, t);
    voice.envelopeGain.gain.linearRampToValueAtTime(0, t + releaseTime);

    // Stop oscillators after release
    voice.oscillators.forEach(osc => {
      try { osc.stop(t + releaseTime + 0.1); } catch {}
    });

    // Clean up after release
    setTimeout(() => {
      voice.oscillators.forEach(osc => { try { osc.disconnect(); } catch {} });
      voice.gainNodes.forEach(gain => { try { gain.disconnect(); } catch {} });
      voice.filterNode.disconnect();
      voice.envelopeGain.disconnect();
      this.voices.delete(noteNumber);
    }, (releaseTime + 0.2) * 1000);
  }

  private updateAllVoiceWaveforms(): void {
    for (const voice of this.voices.values()) {
      voice.oscillators.forEach(osc => { osc.type = this.waveform; });
    }
  }

  private updateAllVoiceDetune(): void {
    const octaveShift = semitonesToRatio(this.params.octave * 12);
    const detuneRatio = centsToRatio(this.params.detune + this.params.fineTune);
    const t = this.audioContext.currentTime;

    for (const voice of this.voices.values()) {
      const baseFreq = voice.frequency * octaveShift * detuneRatio / voice.frequency * voice.frequency;
      voice.oscillators.forEach((osc, i) => {
        let unisonDetune = 0;
        if (this.unisonCount > 1) {
          unisonDetune = ((i / (this.unisonCount - 1)) - 0.5) * 2 * this.unisonSpread;
        }
        osc.frequency.setTargetAtTime(baseFreq * centsToRatio(unisonDetune), t, 0.01);
      });
    }
  }

  private updateAllVoiceFilters(): void {
    const cutoffFreq = 200 + this.params.filterCutoff * 19800;
    const t = this.audioContext.currentTime;

    for (const voice of this.voices.values()) {
      voice.filterNode.frequency.setTargetAtTime(cutoffFreq, t, 0.01);
      voice.filterNode.Q.setTargetAtTime(this.params.filterResonance * 20, t, 0.01);
    }
  }

  private applyParameters(): void {
    const waveforms: OscillatorType[] = ['sine', 'sawtooth', 'square', 'triangle'];
    this.waveform = waveforms[Math.round(this.params.waveform)] || 'sawtooth';
    this.unisonCount = Math.round(this.params.unisonVoices);
    this.unisonSpread = this.params.unisonSpread;
  }

  private addDefaultPresets(): void {
    this.addPreset({ name: 'Init', params: { waveform: 1, detune: 0, unisonVoices: 1, filterCutoff: 1 }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 } });
    this.addPreset({ name: 'Supersaw', params: { waveform: 1, unisonVoices: 7, unisonSpread: 15, filterCutoff: 0.8 }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.4 } });
    this.addPreset({ name: 'Square Lead', params: { waveform: 2, unisonVoices: 3, unisonSpread: 8, filterCutoff: 0.7 }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.2 } });
    this.addPreset({ name: 'Soft Pad', params: { waveform: 0, unisonVoices: 4, unisonSpread: 20, filterCutoff: 0.5 }, envelope: { attack: 0.5, decay: 0.3, sustain: 0.7, release: 1.0 } });
    this.addPreset({ name: 'Pluck', params: { waveform: 1, filterCutoff: 0.6, filterEnvAmount: 0.5 }, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 } });
  }

  dispose(): void {
    for (const voice of this.voices.values()) {
      voice.oscillators.forEach(osc => { try { osc.stop(); osc.disconnect(); } catch {} });
      voice.gainNodes.forEach(gain => { try { gain.disconnect(); } catch {} });
      voice.filterNode.disconnect();
      voice.envelopeGain.disconnect();
    }
    this.voices.clear();
    super.dispose();
  }
}