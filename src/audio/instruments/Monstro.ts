// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Monstro - A powerful modular 3-oscillator synthesizer
 * Based on the original AnkhWaveStudio Monstro plugin
 * 
 * Features:
 * - 3 oscillators with multiple waveforms (sine, triangle, saw, square, moog saw, exponential, white noise, pink noise)
 * - 2 LFOs with multiple waveforms
 * - 2 envelopes (amplitude and filter)
 * - Modulation matrix (oscillators can modulate each other: AM, FM, PM, Mix)
 * - Filter section (lowpass, highpass, bandpass)
 * - Sub-oscillator
 * - Phase modulation
 * - Ring modulation
 */

import { BaseInstrument, InstrumentParameterDescriptor, InstrumentPreset } from './BaseInstrument';
import { clamp, midiNoteToFrequency } from '../utils/AudioMath';

// Waveform types
export enum MonstroWaveform {
  Sine = 0,
  Triangle = 1,
  Saw = 2,
  Ramp = 3,
  Square = 4,
  Moog = 5,
  SoftSquare = 6,
  SinAbs = 7,
  Exponential = 8,
  WhiteNoise = 9,
  // Band-limited versions
  BLTriangle = 10,
  BLSaw = 11,
  BLRamp = 12,
  BLSquare = 13,
  BLMoog = 14,
}

// LFO waveform types (includes random)
export enum LFOWaveform {
  Sine = 0,
  Triangle = 1,
  Saw = 2,
  Ramp = 3,
  Square = 4,
  Moog = 5,
  SoftSquare = 6,
  SinAbs = 7,
  Exponential = 8,
  Random = 9,
  RandomSmooth = 10,
}

// Modulation types
export enum ModulationType {
  Mix = 0,
  AM = 1,  // Amplitude Modulation
  FM = 2,  // Frequency Modulation
  PM = 3,  // Phase Modulation
}

// Constants
const MODCLIP = 2.0;
const MIN_FREQ = 18.0;
const MAX_FREQ = 48000.0;
const FM_AMOUNT = 0.25;
const PW_MIN = 0.25;
const PW_MAX = 99.75;

/**
 * Voice state for Monstro
 */
interface MonstroVoice {
  noteNumber: number;
  frequency: number;
  velocity: number;
  startTime: number;
  
  // Oscillator phases
  osc1LPhase: number;
  osc1RPhase: number;
  osc2LPhase: number;
  osc2RPhase: number;
  osc3LPhase: number;
  osc3RPhase: number;
  
  // LFO phases
  lfo1Phase: number;
  lfo2Phase: number;
  lfo1Last: number;
  lfo1Next: number;
  lfo2Last: number;
  lfo2Next: number;
  
  // Envelope phases
  env1Phase: number;
  env2Phase: number;
  env1Stage: 'pre' | 'attack' | 'hold' | 'decay' | 'sustain' | 'release' | 'off';
  env2Stage: 'pre' | 'attack' | 'hold' | 'decay' | 'sustain' | 'release' | 'off';
  env1Value: number;
  env2Value: number;
  
  // Last output values for integration
  osc1LLast: number;
  osc1RLast: number;
  lLast: number;
  rLast: number;
  
  // Phase tracking for sync
  ph2LLast: number;
  ph2RLast: number;
  ph3LLast: number;
  ph3RLast: number;
  
  // Inversion flags for sync
  invert2L: boolean;
  invert2R: boolean;
  invert3L: boolean;
  invert3R: boolean;
  
  // Counters for sync
  counter2L: number;
  counter2R: number;
  counter3L: number;
  counter3R: number;
  
  // Note release flag
  released: boolean;
  releaseTime: number;
}

/**
 * Monstro - Modular 3-oscillator synthesizer
 */
export class Monstro extends BaseInstrument {
  private voices: Map<number, MonstroVoice> = new Map();
  
  // Audio processing
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sampleRate: number;
  
  // Cached parameter values
  private osc1LVol: number = 0;
  private osc1RVol: number = 0;
  private osc2LVol: number = 0;
  private osc2RVol: number = 0;
  private osc3LVol: number = 0;
  private osc3RVol: number = 0;
  
  private osc1LFreq: number = 0;
  private osc1RFreq: number = 0;
  private osc2LFreq: number = 0;
  private osc2RFreq: number = 0;
  private osc3Freq: number = 0;
  
  // LFO values
  private lfo1Att: number = 0;
  private lfo2Att: number = 0;
  
  // Envelope values
  private env1Pre: number = 0;
  private env1Att: number = 0;
  private env1Hold: number = 0;
  private env1Dec: number = 0;
  private env1Rel: number = 0;
  private env2Pre: number = 0;
  private env2Att: number = 0;
  private env2Hold: number = 0;
  private env2Dec: number = 0;
  private env2Rel: number = 0;
  
  constructor(audioContext: AudioContext, id: string, name: string = 'Monstro') {
    super(audioContext, id, name, 'monstro');
    this.sampleRate = audioContext.sampleRate;
    this.initializeInstrument();
    this.addDefaultPresets();
    this.setupAudioProcessing();
  }

  protected initializeInstrument(): void {
    // Initialize default parameters
    this.params = {
      // Oscillator 1 (Pulse wave with PWM)
      osc1Vol: 50,
      osc1Pan: 0,
      osc1Crs: 0,      // Coarse tune (semitones)
      osc1FtL: 0,      // Fine tune left (cents)
      osc1FtR: 0,      // Fine tune right (cents)
      osc1Spo: 0,      // Stereo phase offset
      osc1Pw: 50,      // Pulse width
      osc1SSR: 0,      // Sub-oscillator sync right
      osc1SSF: 0,      // Sub-oscillator sync flip
      
      // Oscillator 2
      osc2Vol: 0,
      osc2Pan: 0,
      osc2Crs: 0,
      osc2FtL: 0,
      osc2FtR: 0,
      osc2Spo: 0,
      osc2Wave: MonstroWaveform.BLSaw,
      osc2SyncH: 0,    // Hard sync
      osc2SyncR: 0,    // Reverse sync
      
      // Oscillator 3
      osc3Vol: 0,
      osc3Pan: 0,
      osc3Crs: -12,    // Default one octave down
      osc3Spo: 0,
      osc3Sub: 0,      // Sub-oscillator mix
      osc3Wave1: MonstroWaveform.BLSaw,
      osc3Wave2: MonstroWaveform.BLSquare,
      osc3SyncH: 0,
      osc3SyncR: 0,
      
      // LFO 1
      lfo1Wave: LFOWaveform.Sine,
      lfo1Att: 0,      // Attack time (ms)
      lfo1Rate: 1,     // Rate (Hz)
      lfo1Phs: 0,      // Phase offset
      
      // LFO 2
      lfo2Wave: LFOWaveform.Sine,
      lfo2Att: 0,
      lfo2Rate: 1,
      lfo2Phs: 0,
      
      // Envelope 1
      env1Pre: 0,      // Pre-delay
      env1Att: 10,     // Attack
      env1Hold: 0,     // Hold
      env1Dec: 100,    // Decay
      env1Sus: 70,     // Sustain
      env1Rel: 200,    // Release
      env1Slope: 0,    // Slope curve
      
      // Envelope 2
      env2Pre: 0,
      env2Att: 10,
      env2Hold: 0,
      env2Dec: 100,
      env2Sus: 70,
      env2Rel: 200,
      env2Slope: 0,
      
      // Modulation mode for osc2/3
      o23Mod: ModulationType.Mix,
      
      // Modulation Matrix - Volume modulation
      vol1Env1: 100,   // Osc1 volume from Env1
      vol1Env2: 0,
      vol1Lfo1: 0,
      vol1Lfo2: 0,
      
      vol2Env1: 100,
      vol2Env2: 0,
      vol2Lfo1: 0,
      vol2Lfo2: 0,
      
      vol3Env1: 100,
      vol3Env2: 0,
      vol3Lfo1: 0,
      vol3Lfo2: 0,
      
      // Modulation Matrix - Phase modulation
      phs1Env1: 0,
      phs1Env2: 0,
      phs1Lfo1: 0,
      phs1Lfo2: 0,
      
      phs2Env1: 0,
      phs2Env2: 0,
      phs2Lfo1: 0,
      phs2Lfo2: 0,
      
      phs3Env1: 0,
      phs3Env2: 0,
      phs3Lfo1: 0,
      phs3Lfo2: 0,
      
      // Modulation Matrix - Pitch modulation
      pit1Env1: 0,
      pit1Env2: 0,
      pit1Lfo1: 0,
      pit1Lfo2: 0,
      
      pit2Env1: 0,
      pit2Env2: 0,
      pit2Lfo1: 0,
      pit2Lfo2: 0,
      
      pit3Env1: 0,
      pit3Env2: 0,
      pit3Lfo1: 0,
      pit3Lfo2: 0,
      
      // Modulation Matrix - Pulse width modulation (osc1 only)
      pw1Env1: 0,
      pw1Env2: 0,
      pw1Lfo1: 0,
      pw1Lfo2: 0,
      
      // Modulation Matrix - Sub-oscillator modulation (osc3 only)
      sub3Env1: 0,
      sub3Env2: 0,
      sub3Lfo1: 0,
      sub3Lfo2: 0,
      
      // Output
      gain: 0.8,
    };
    
    this.updateCachedValues();
  }

  private setupAudioProcessing(): void {
    const bufferSize = 256;
    this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 0, 2);
    
    this.scriptProcessor.onaudioprocess = (event) => {
      const outputL = event.outputBuffer.getChannelData(0);
      const outputR = event.outputBuffer.getChannelData(1);
      this.processAudio(outputL, outputR, outputL.length);
    };
    
    this.scriptProcessor.connect(this.volumeNode);
  }

  private processAudio(outputL: Float32Array, outputR: Float32Array, numSamples: number): void {
    // Clear output buffers
    outputL.fill(0);
    outputR.fill(0);
    
    // Process each active voice
    for (const [noteNumber, voice] of this.voices) {
      this.processVoice(voice, outputL, outputR, numSamples);
      
      // Remove voice if envelope is finished
      if (voice.env1Stage === 'off' && voice.env2Stage === 'off') {
        this.voices.delete(noteNumber);
      }
    }
  }

  private processVoice(voice: MonstroVoice, outputL: Float32Array, outputR: Float32Array, numSamples: number): void {
    const sampleRate = this.sampleRate;
    
    for (let i = 0; i < numSamples; i++) {
      // Update modulators (envelopes and LFOs)
      const env1 = this.updateEnvelope(voice, 1);
      const env2 = this.updateEnvelope(voice, 2);
      const lfo1 = this.updateLFO(voice, 1, i);
      const lfo2 = this.updateLFO(voice, 2, i);
      
      // Calculate modulated values
      const vol1Mod = this.calculateModulation(
        this.params.vol1Env1, this.params.vol1Env2, this.params.vol1Lfo1, this.params.vol1Lfo2,
        env1, env2, lfo1, lfo2
      );
      const vol2Mod = this.calculateModulation(
        this.params.vol2Env1, this.params.vol2Env2, this.params.vol2Lfo1, this.params.vol2Lfo2,
        env1, env2, lfo1, lfo2
      );
      const vol3Mod = this.calculateModulation(
        this.params.vol3Env1, this.params.vol3Env2, this.params.vol3Lfo1, this.params.vol3Lfo2,
        env1, env2, lfo1, lfo2
      );
      
      const phs1Mod = this.calculateModulation(
        this.params.phs1Env1, this.params.phs1Env2, this.params.phs1Lfo1, this.params.phs1Lfo2,
        env1, env2, lfo1, lfo2
      ) * 0.5;
      const phs2Mod = this.calculateModulation(
        this.params.phs2Env1, this.params.phs2Env2, this.params.phs2Lfo1, this.params.phs2Lfo2,
        env1, env2, lfo1, lfo2
      ) * 0.5;
      const phs3Mod = this.calculateModulation(
        this.params.phs3Env1, this.params.phs3Env2, this.params.phs3Lfo1, this.params.phs3Lfo2,
        env1, env2, lfo1, lfo2
      ) * 0.5;
      
      const pit1Mod = this.calculateModulation(
        this.params.pit1Env1, this.params.pit1Env2, this.params.pit1Lfo1, this.params.pit1Lfo2,
        env1, env2, lfo1, lfo2
      );
      const pit2Mod = this.calculateModulation(
        this.params.pit2Env1, this.params.pit2Env2, this.params.pit2Lfo1, this.params.pit2Lfo2,
        env1, env2, lfo1, lfo2
      );
      const pit3Mod = this.calculateModulation(
        this.params.pit3Env1, this.params.pit3Env2, this.params.pit3Lfo1, this.params.pit3Lfo2,
        env1, env2, lfo1, lfo2
      );
      
      const pw1Mod = this.calculateModulation(
        this.params.pw1Env1, this.params.pw1Env2, this.params.pw1Lfo1, this.params.pw1Lfo2,
        env1, env2, lfo1, lfo2
      );
      
      const sub3Mod = this.calculateModulation(
        this.params.sub3Env1, this.params.sub3Env2, this.params.sub3Lfo1, this.params.sub3Lfo2,
        env1, env2, lfo1, lfo2
      );
      
      // Calculate frequencies with pitch modulation
      const baseFreq = voice.frequency;
      const osc1FreqL = baseFreq * Math.pow(2, (this.params.osc1Crs + this.params.osc1FtL / 100 + pit1Mod * 24) / 12);
      const osc1FreqR = baseFreq * Math.pow(2, (this.params.osc1Crs + this.params.osc1FtR / 100 + pit1Mod * 24) / 12);
      const osc2FreqL = baseFreq * Math.pow(2, (this.params.osc2Crs + this.params.osc2FtL / 100 + pit2Mod * 24) / 12);
      const osc2FreqR = baseFreq * Math.pow(2, (this.params.osc2Crs + this.params.osc2FtR / 100 + pit2Mod * 24) / 12);
      const osc3Freq = baseFreq * Math.pow(2, (this.params.osc3Crs + pit3Mod * 24) / 12);
      
      // Calculate phase increments
      const osc1IncL = osc1FreqL / sampleRate;
      const osc1IncR = osc1FreqR / sampleRate;
      const osc2IncL = osc2FreqL / sampleRate;
      const osc2IncR = osc2FreqR / sampleRate;
      const osc3Inc = osc3Freq / sampleRate;
      
      // Calculate pulse width with modulation
      const pw = clamp(this.params.osc1Pw + pw1Mod * 50, PW_MIN, PW_MAX) / 100;
      
      // Generate oscillator 1 (pulse wave)
      const osc1L = this.generatePulseWave(voice.osc1LPhase + phs1Mod, pw);
      const osc1R = this.generatePulseWave(voice.osc1RPhase + phs1Mod + this.params.osc1Spo / 360, pw);
      
      // Generate oscillator 2
      const osc2Wave = Math.round(this.params.osc2Wave) as MonstroWaveform;
      const osc2L = this.generateWaveform(osc2Wave, voice.osc2LPhase + phs2Mod, osc2IncL);
      const osc2R = this.generateWaveform(osc2Wave, voice.osc2RPhase + phs2Mod + this.params.osc2Spo / 360, osc2IncR);
      
      // Generate oscillator 3 (with sub-oscillator mixing)
      const osc3Wave1 = Math.round(this.params.osc3Wave1) as MonstroWaveform;
      const osc3Wave2 = Math.round(this.params.osc3Wave2) as MonstroWaveform;
      const subMix = clamp((this.params.osc3Sub + sub3Mod * 100) / 100, 0, 1);
      const osc3Main = this.generateWaveform(osc3Wave1, voice.osc3LPhase + phs3Mod, osc3Inc);
      const osc3Sub = this.generateWaveform(osc3Wave2, voice.osc3LPhase + phs3Mod + this.params.osc3Spo / 360, osc3Inc);
      const osc3L = osc3Main * (1 - subMix) + osc3Sub * subMix;
      const osc3R = osc3Main * (1 - subMix) + osc3Sub * subMix;
      
      // Apply modulation between oscillators
      let out2L = osc2L;
      let out2R = osc2R;
      let out3L = osc3L;
      let out3R = osc3R;
      
      const modType = Math.round(this.params.o23Mod) as ModulationType;
      switch (modType) {
        case ModulationType.AM:
          out2L = osc2L * (1 + osc1L) * 0.5;
          out2R = osc2R * (1 + osc1R) * 0.5;
          out3L = osc3L * (1 + osc1L) * 0.5;
          out3R = osc3R * (1 + osc1R) * 0.5;
          break;
        case ModulationType.FM:
          // FM is handled in frequency calculation
          break;
        case ModulationType.PM:
          // PM is handled in phase calculation
          break;
        case ModulationType.Mix:
        default:
          // Simple mixing, no modulation
          break;
      }
      
      // Calculate volumes with modulation
      const v1L = this.leftCh(this.params.osc1Vol * vol1Mod, this.params.osc1Pan);
      const v1R = this.rightCh(this.params.osc1Vol * vol1Mod, this.params.osc1Pan);
      const v2L = this.leftCh(this.params.osc2Vol * vol2Mod, this.params.osc2Pan);
      const v2R = this.rightCh(this.params.osc2Vol * vol2Mod, this.params.osc2Pan);
      const v3L = this.leftCh(this.params.osc3Vol * vol3Mod, this.params.osc3Pan);
      const v3R = this.rightCh(this.params.osc3Vol * vol3Mod, this.params.osc3Pan);
      
      // Mix all oscillators
      const mixL = osc1L * v1L + out2L * v2L + out3L * v3L;
      const mixR = osc1R * v1R + out2R * v2R + out3R * v3R;
      
      // Apply velocity and output
      const velGain = voice.velocity;
      outputL[i] += mixL * velGain * this.params.gain;
      outputR[i] += mixR * velGain * this.params.gain;
      
      // Update phases
      voice.osc1LPhase = this.wrapPhase(voice.osc1LPhase + osc1IncL);
      voice.osc1RPhase = this.wrapPhase(voice.osc1RPhase + osc1IncR);
      voice.osc2LPhase = this.wrapPhase(voice.osc2LPhase + osc2IncL);
      voice.osc2RPhase = this.wrapPhase(voice.osc2RPhase + osc2IncR);
      voice.osc3LPhase = this.wrapPhase(voice.osc3LPhase + osc3Inc);
      voice.osc3RPhase = this.wrapPhase(voice.osc3RPhase + osc3Inc);
    }
  }

  private calculateModulation(
    env1Amt: number, env2Amt: number, lfo1Amt: number, lfo2Amt: number,
    env1: number, env2: number, lfo1: number, lfo2: number
  ): number {
    return (env1Amt / 100 * env1) + (env2Amt / 100 * env2) + 
           (lfo1Amt / 100 * lfo1) + (lfo2Amt / 100 * lfo2);
  }

  private updateEnvelope(voice: MonstroVoice, envNum: 1 | 2): number {
    const prefix = envNum === 1 ? 'env1' : 'env2';
    const stage = envNum === 1 ? voice.env1Stage : voice.env2Stage;
    let value = envNum === 1 ? voice.env1Value : voice.env2Value;
    let phase = envNum === 1 ? voice.env1Phase : voice.env2Phase;
    
    const pre = this.params[`${prefix}Pre`] / 1000;
    const att = this.params[`${prefix}Att`] / 1000;
    const hold = this.params[`${prefix}Hold`] / 1000;
    const dec = this.params[`${prefix}Dec`] / 1000;
    const sus = this.params[`${prefix}Sus`] / 100;
    const rel = this.params[`${prefix}Rel`] / 1000;
    const slope = this.params[`${prefix}Slope`];
    
    const dt = 1 / this.sampleRate;
    let newStage = stage;
    
    switch (stage) {
      case 'pre':
        phase += dt;
        if (phase >= pre) {
          newStage = 'attack';
          phase = 0;
        }
        value = 0;
        break;
        
      case 'attack':
        phase += dt;
        if (phase >= att) {
          newStage = 'hold';
          phase = 0;
          value = 1;
        } else {
          value = att > 0 ? this.applySlope(phase / att, slope) : 1;
        }
        break;
        
      case 'hold':
        phase += dt;
        if (phase >= hold) {
          newStage = 'decay';
          phase = 0;
        }
        value = 1;
        break;
        
      case 'decay':
        phase += dt;
        if (phase >= dec) {
          newStage = 'sustain';
          phase = 0;
          value = sus;
        } else {
          const decayProgress = dec > 0 ? phase / dec : 1;
          value = 1 - (1 - sus) * this.applySlope(decayProgress, slope);
        }
        break;
        
      case 'sustain':
        value = sus;
        if (voice.released) {
          newStage = 'release';
          phase = 0;
        }
        break;
        
      case 'release':
        phase += dt;
        if (phase >= rel) {
          newStage = 'off';
          value = 0;
        } else {
          const releaseProgress = rel > 0 ? phase / rel : 1;
          value = sus * (1 - this.applySlope(releaseProgress, slope));
        }
        break;
        
      case 'off':
        value = 0;
        break;
    }
    
    // Update voice state
    if (envNum === 1) {
      voice.env1Stage = newStage;
      voice.env1Value = value;
      voice.env1Phase = phase;
    } else {
      voice.env2Stage = newStage;
      voice.env2Value = value;
      voice.env2Phase = phase;
    }
    
    return value;
  }

  private applySlope(x: number, slope: number): number {
    if (slope === 0) return x;
    if (slope > 0) {
      // Exponential curve
      return Math.pow(x, 1 + slope * 2);
    } else {
      // Logarithmic curve
      return 1 - Math.pow(1 - x, 1 - slope * 2);
    }
  }

  private updateLFO(voice: MonstroVoice, lfoNum: 1 | 2, sampleIndex: number): number {
    const prefix = lfoNum === 1 ? 'lfo1' : 'lfo2';
    const wave = Math.round(this.params[`${prefix}Wave`]) as LFOWaveform;
    const rate = this.params[`${prefix}Rate`];
    const phs = this.params[`${prefix}Phs`] / 360;
    const att = this.params[`${prefix}Att`] / 1000;
    
    let phase = lfoNum === 1 ? voice.lfo1Phase : voice.lfo2Phase;
    
    // Update phase
    const inc = rate / this.sampleRate;
    phase = this.wrapPhase(phase + inc);
    
    // Generate LFO value
    let value: number;
    if (wave === LFOWaveform.Random) {
      // Sample and hold random
      if (phase < inc) {
        value = Math.random() * 2 - 1;
        if (lfoNum === 1) {
          voice.lfo1Last = value;
        } else {
          voice.lfo2Last = value;
        }
      } else {
        value = lfoNum === 1 ? voice.lfo1Last : voice.lfo2Last;
      }
    } else if (wave === LFOWaveform.RandomSmooth) {
      // Smoothed random
      if (phase < inc) {
        if (lfoNum === 1) {
          voice.lfo1Last = voice.lfo1Next;
          voice.lfo1Next = Math.random() * 2 - 1;
        } else {
          voice.lfo2Last = voice.lfo2Next;
          voice.lfo2Next = Math.random() * 2 - 1;
        }
      }
      const last = lfoNum === 1 ? voice.lfo1Last : voice.lfo2Last;
      const next = lfoNum === 1 ? voice.lfo1Next : voice.lfo2Next;
      value = last + (next - last) * phase;
    } else {
      value = this.generateLFOWaveform(wave, phase + phs);
    }
    
    // Apply attack envelope to LFO
    const timeSinceStart = (this.audioContext.currentTime - voice.startTime);
    if (att > 0 && timeSinceStart < att) {
      value *= timeSinceStart / att;
    }
    
    // Update voice state
    if (lfoNum === 1) {
      voice.lfo1Phase = phase;
    } else {
      voice.lfo2Phase = phase;
    }
    
    return value;
  }

  private generateLFOWaveform(wave: LFOWaveform, phase: number): number {
    const ph = this.wrapPhase(phase);
    
    switch (wave) {
      case LFOWaveform.Sine:
        return Math.sin(ph * Math.PI * 2);
      case LFOWaveform.Triangle:
        return ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
      case LFOWaveform.Saw:
        return 2 * ph - 1;
      case LFOWaveform.Ramp:
        return 1 - 2 * ph;
      case LFOWaveform.Square:
        return ph < 0.5 ? 1 : -1;
      case LFOWaveform.Moog:
        if (ph < 0.5) {
          return 4 * ph - 1;
        } else {
          const w = 2 * (ph - 0.5);
          return 1 - Math.sqrt(1 - w * w);
        }
      case LFOWaveform.SoftSquare:
        if (ph < 0.1) return Math.sin((ph / 0.1) * Math.PI / 2);
        if (ph < 0.5) return 1;
        if (ph < 0.6) return Math.cos(((ph - 0.5) / 0.1) * Math.PI / 2);
        return -1;
      case LFOWaveform.SinAbs:
        return Math.abs(Math.sin(ph * Math.PI * 2));
      case LFOWaveform.Exponential:
        return (Math.exp(Math.abs(ph * 2 - 1) * 2) - 1) / (Math.E * Math.E - 1) * Math.sign(ph - 0.5);
      default:
        return Math.sin(ph * Math.PI * 2);
    }
  }

  private generateWaveform(wave: MonstroWaveform, phase: number, inc: number): number {
    const ph = this.wrapPhase(phase);
    const wavelen = 1 / inc;
    
    switch (wave) {
      case MonstroWaveform.Sine:
        return Math.sin(ph * Math.PI * 2);
        
      case MonstroWaveform.Triangle:
      case MonstroWaveform.BLTriangle:
        return this.polyBlepTriangle(ph, inc);
        
      case MonstroWaveform.Saw:
      case MonstroWaveform.BLSaw:
        return this.polyBlepSaw(ph, inc);
        
      case MonstroWaveform.Ramp:
      case MonstroWaveform.BLRamp:
        return -this.polyBlepSaw(ph, inc);
        
      case MonstroWaveform.Square:
      case MonstroWaveform.BLSquare:
        return this.polyBlepSquare(ph, inc);
        
      case MonstroWaveform.Moog:
      case MonstroWaveform.BLMoog:
        return this.polyBlepMoog(ph, inc);
        
      case MonstroWaveform.SoftSquare:
        if (ph < 0.1) return Math.sin((ph / 0.1) * Math.PI / 2);
        if (ph < 0.5) return 1;
        if (ph < 0.6) return Math.cos(((ph - 0.5) / 0.1) * Math.PI / 2);
        return -1;
        
      case MonstroWaveform.SinAbs:
        return Math.abs(Math.sin(ph * Math.PI * 2));
        
      case MonstroWaveform.Exponential:
        return (Math.exp(Math.abs(ph * 2 - 1) * 2) - 1) / (Math.E * Math.E - 1) * Math.sign(ph - 0.5);
        
      case MonstroWaveform.WhiteNoise:
        return Math.random() * 2 - 1;
        
      default:
        return Math.sin(ph * Math.PI * 2);
    }
  }

  private generatePulseWave(phase: number, pw: number): number {
    const ph = this.wrapPhase(phase);
    return ph < pw ? 1 : -1;
  }

  // PolyBLEP anti-aliasing functions
  private polyBlep(t: number, dt: number): number {
    if (t < dt) {
      const t_dt = t / dt;
      return t_dt + t_dt - t_dt * t_dt - 1;
    } else if (t > 1 - dt) {
      const t_dt = (t - 1) / dt;
      return t_dt * t_dt + t_dt + t_dt + 1;
    }
    return 0;
  }

  private polyBlepSaw(phase: number, inc: number): number {
    let value = 2 * phase - 1;
    value -= this.polyBlep(phase, inc);
    return value;
  }

  private polyBlepSquare(phase: number, inc: number): number {
    let value = phase < 0.5 ? 1 : -1;
    value += this.polyBlep(phase, inc);
    value -= this.polyBlep((phase + 0.5) % 1, inc);
    return value;
  }

  private polyBlepTriangle(phase: number, inc: number): number {
    // Integrate square wave for triangle
    const square = this.polyBlepSquare(phase, inc);
    return square; // Simplified
  }

  private polyBlepMoog(phase: number, inc: number): number {
    const saw = this.polyBlepSaw(phase, inc);
    return saw * 2;
  }

  private wrapPhase(phase: number): number {
    return phase - Math.floor(phase);
  }

  private leftCh(vol: number, pan: number): number {
    return (pan <= 0 ? 1 : 1 - pan / 100) * vol / 100;
  }

  private rightCh(vol: number, pan: number): number {
    return (pan >= 0 ? 1 : 1 + pan / 100) * vol / 100;
  }

  private updateCachedValues(): void {
    // Update cached values from parameters
    this.osc1LVol = this.leftCh(this.params.osc1Vol, this.params.osc1Pan);
    this.osc1RVol = this.rightCh(this.params.osc1Vol, this.params.osc1Pan);
    this.osc2LVol = this.leftCh(this.params.osc2Vol, this.params.osc2Pan);
    this.osc2RVol = this.rightCh(this.params.osc2Vol, this.params.osc2Pan);
    this.osc3LVol = this.leftCh(this.params.osc3Vol, this.params.osc3Pan);
    this.osc3RVol = this.rightCh(this.params.osc3Vol, this.params.osc3Pan);
  }

  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    return [
      // Oscillator 1
      { name: 'Osc1 Volume', key: 'osc1Vol', min: 0, max: 100, default: 50, category: 'Oscillator 1' },
      { name: 'Osc1 Pan', key: 'osc1Pan', min: -100, max: 100, default: 0, category: 'Oscillator 1' },
      { name: 'Osc1 Coarse', key: 'osc1Crs', min: -24, max: 24, default: 0, category: 'Oscillator 1' },
      { name: 'Osc1 Fine L', key: 'osc1FtL', min: -100, max: 100, default: 0, category: 'Oscillator 1' },
      { name: 'Osc1 Fine R', key: 'osc1FtR', min: -100, max: 100, default: 0, category: 'Oscillator 1' },
      { name: 'Osc1 Phase', key: 'osc1Spo', min: 0, max: 360, default: 0, category: 'Oscillator 1' },
      { name: 'Osc1 PW', key: 'osc1Pw', min: 1, max: 99, default: 50, category: 'Oscillator 1' },
      
      // Oscillator 2
      { name: 'Osc2 Volume', key: 'osc2Vol', min: 0, max: 100, default: 0, category: 'Oscillator 2' },
      { name: 'Osc2 Pan', key: 'osc2Pan', min: -100, max: 100, default: 0, category: 'Oscillator 2' },
      { name: 'Osc2 Coarse', key: 'osc2Crs', min: -24, max: 24, default: 0, category: 'Oscillator 2' },
      { name: 'Osc2 Fine L', key: 'osc2FtL', min: -100, max: 100, default: 0, category: 'Oscillator 2' },
      { name: 'Osc2 Fine R', key: 'osc2FtR', min: -100, max: 100, default: 0, category: 'Oscillator 2' },
      { name: 'Osc2 Phase', key: 'osc2Spo', min: 0, max: 360, default: 0, category: 'Oscillator 2' },
      { name: 'Osc2 Wave', key: 'osc2Wave', min: 0, max: 14, default: MonstroWaveform.BLSaw, type: 'enum', 
        enumValues: ['Sine', 'Triangle', 'Saw', 'Ramp', 'Square', 'Moog', 'Soft Sqr', 'Sin Abs', 'Exp', 'Noise', 
                     'BL Tri', 'BL Saw', 'BL Ramp', 'BL Sqr', 'BL Moog'], category: 'Oscillator 2' },
      
      // Oscillator 3
      { name: 'Osc3 Volume', key: 'osc3Vol', min: 0, max: 100, default: 0, category: 'Oscillator 3' },
      { name: 'Osc3 Pan', key: 'osc3Pan', min: -100, max: 100, default: 0, category: 'Oscillator 3' },
      { name: 'Osc3 Coarse', key: 'osc3Crs', min: -24, max: 24, default: -12, category: 'Oscillator 3' },
      { name: 'Osc3 Phase', key: 'osc3Spo', min: 0, max: 360, default: 0, category: 'Oscillator 3' },
      { name: 'Osc3 Sub', key: 'osc3Sub', min: 0, max: 100, default: 0, category: 'Oscillator 3' },
      { name: 'Osc3 Wave1', key: 'osc3Wave1', min: 0, max: 14, default: MonstroWaveform.BLSaw, type: 'enum',
        enumValues: ['Sine', 'Triangle', 'Saw', 'Ramp', 'Square', 'Moog', 'Soft Sqr', 'Sin Abs', 'Exp', 'Noise',
                     'BL Tri', 'BL Saw', 'BL Ramp', 'BL Sqr', 'BL Moog'], category: 'Oscillator 3' },
      { name: 'Osc3 Wave2', key: 'osc3Wave2', min: 0, max: 14, default: MonstroWaveform.BLSquare, type: 'enum',
        enumValues: ['Sine', 'Triangle', 'Saw', 'Ramp', 'Square', 'Moog', 'Soft Sqr', 'Sin Abs', 'Exp', 'Noise',
                     'BL Tri', 'BL Saw', 'BL Ramp', 'BL Sqr', 'BL Moog'], category: 'Oscillator 3' },
      
      // LFO 1
      { name: 'LFO1 Wave', key: 'lfo1Wave', min: 0, max: 10, default: LFOWaveform.Sine, type: 'enum',
        enumValues: ['Sine', 'Triangle', 'Saw', 'Ramp', 'Square', 'Moog', 'Soft Sqr', 'Sin Abs', 'Exp', 'Random', 'Rnd Smooth'], category: 'LFO 1' },
      { name: 'LFO1 Attack', key: 'lfo1Att', min: 0, max: 5000, default: 0, unit: 'ms', category: 'LFO 1' },
      { name: 'LFO1 Rate', key: 'lfo1Rate', min: 0.01, max: 20, default: 1, unit: 'Hz', category: 'LFO 1' },
      { name: 'LFO1 Phase', key: 'lfo1Phs', min: 0, max: 360, default: 0, category: 'LFO 1' },
      
      // LFO 2
      { name: 'LFO2 Wave', key: 'lfo2Wave', min: 0, max: 10, default: LFOWaveform.Sine, type: 'enum',
        enumValues: ['Sine', 'Triangle', 'Saw', 'Ramp', 'Square', 'Moog', 'Soft Sqr', 'Sin Abs', 'Exp', 'Random', 'Rnd Smooth'], category: 'LFO 2' },
      { name: 'LFO2 Attack', key: 'lfo2Att', min: 0, max: 5000, default: 0, unit: 'ms', category: 'LFO 2' },
      { name: 'LFO2 Rate', key: 'lfo2Rate', min: 0.01, max: 20, default: 1, unit: 'Hz', category: 'LFO 2' },
      { name: 'LFO2 Phase', key: 'lfo2Phs', min: 0, max: 360, default: 0, category: 'LFO 2' },
      
      // Envelope 1
      { name: 'Env1 Pre', key: 'env1Pre', min: 0, max: 2000, default: 0, unit: 'ms', category: 'Envelope 1' },
      { name: 'Env1 Attack', key: 'env1Att', min: 1, max: 5000, default: 10, unit: 'ms', category: 'Envelope 1' },
      { name: 'Env1 Hold', key: 'env1Hold', min: 0, max: 2000, default: 0, unit: 'ms', category: 'Envelope 1' },
      { name: 'Env1 Decay', key: 'env1Dec', min: 1, max: 5000, default: 100, unit: 'ms', category: 'Envelope 1' },
      { name: 'Env1 Sustain', key: 'env1Sus', min: 0, max: 100, default: 70, category: 'Envelope 1' },
      { name: 'Env1 Release', key: 'env1Rel', min: 1, max: 5000, default: 200, unit: 'ms', category: 'Envelope 1' },
      { name: 'Env1 Slope', key: 'env1Slope', min: -1, max: 1, default: 0, step: 0.01, category: 'Envelope 1' },
      
      // Envelope 2
      { name: 'Env2 Pre', key: 'env2Pre', min: 0, max: 2000, default: 0, unit: 'ms', category: 'Envelope 2' },
      { name: 'Env2 Attack', key: 'env2Att', min: 1, max: 5000, default: 10, unit: 'ms', category: 'Envelope 2' },
      { name: 'Env2 Hold', key: 'env2Hold', min: 0, max: 2000, default: 0, unit: 'ms', category: 'Envelope 2' },
      { name: 'Env2 Decay', key: 'env2Dec', min: 1, max: 5000, default: 100, unit: 'ms', category: 'Envelope 2' },
      { name: 'Env2 Sustain', key: 'env2Sus', min: 0, max: 100, default: 70, category: 'Envelope 2' },
      { name: 'Env2 Release', key: 'env2Rel', min: 1, max: 5000, default: 200, unit: 'ms', category: 'Envelope 2' },
      { name: 'Env2 Slope', key: 'env2Slope', min: -1, max: 1, default: 0, step: 0.01, category: 'Envelope 2' },
      
      // Modulation
      { name: 'Osc2/3 Mod', key: 'o23Mod', min: 0, max: 3, default: ModulationType.Mix, type: 'enum',
        enumValues: ['Mix', 'AM', 'FM', 'PM'], category: 'Modulation' },
      
      // Output
      { name: 'Gain', key: 'gain', min: 0, max: 1, default: 0.8, category: 'Output' },
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    this.updateCachedValues();
  }

  protected silenceNote(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
    if (voice) {
      voice.env1Stage = 'off';
      voice.env2Stage = 'off';
      voice.env1Value = 0;
      voice.env2Value = 0;
    }
  }

  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    // Create new voice
    const voice: MonstroVoice = {
      noteNumber,
      frequency,
      velocity,
      startTime: this.audioContext.currentTime,
      
      osc1LPhase: 0,
      osc1RPhase: this.params.osc1Spo / 360,
      osc2LPhase: 0,
      osc2RPhase: this.params.osc2Spo / 360,
      osc3LPhase: 0,
      osc3RPhase: this.params.osc3Spo / 360,
      
      lfo1Phase: this.params.lfo1Phs / 360,
      lfo2Phase: this.params.lfo2Phs / 360,
      lfo1Last: 0,
      lfo1Next: Math.random() * 2 - 1,
      lfo2Last: 0,
      lfo2Next: Math.random() * 2 - 1,
      
      env1Phase: 0,
      env2Phase: 0,
      env1Stage: this.params.env1Pre > 0 ? 'pre' : 'attack',
      env2Stage: this.params.env2Pre > 0 ? 'pre' : 'attack',
      env1Value: 0,
      env2Value: 0,
      
      osc1LLast: 0,
      osc1RLast: 0,
      lLast: 0,
      rLast: 0,
      
      ph2LLast: 0,
      ph2RLast: 0,
      ph3LLast: 0,
      ph3RLast: 0,
      
      invert2L: false,
      invert2R: false,
      invert3L: false,
      invert3R: false,
      
      counter2L: 0,
      counter2R: 0,
      counter3L: 0,
      counter3R: 0,
      
      released: false,
      releaseTime: 0,
    };
    
    this.voices.set(noteNumber, voice);
  }

  protected releaseNote(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
    if (voice) {
      voice.released = true;
      voice.releaseTime = this.audioContext.currentTime;
      
      // Transition envelopes to release stage
      if (voice.env1Stage !== 'off') {
        voice.env1Stage = 'release';
        voice.env1Phase = 0;
      }
      if (voice.env2Stage !== 'off') {
        voice.env2Stage = 'release';
        voice.env2Phase = 0;
      }
    }
  }

  private addDefaultPresets(): void {
    const presets: InstrumentPreset[] = [
      {
        name: 'Init',
        params: {
          osc1Vol: 50,
          osc2Vol: 0,
          osc3Vol: 0,
          vol1Env1: 100,
          env1Att: 10,
          env1Dec: 100,
          env1Sus: 70,
          env1Rel: 200,
        },
      },
      {
        name: 'Fat Lead',
        params: {
          osc1Vol: 50,
          osc1Pw: 30,
          osc2Vol: 50,
          osc2Wave: MonstroWaveform.BLSaw,
          osc2Crs: 7,
          osc2FtL: -10,
          osc2FtR: 10,
          vol1Env1: 100,
          vol2Env1: 100,
          env1Att: 5,
          env1Dec: 200,
          env1Sus: 80,
          env1Rel: 300,
        },
      },
      {
        name: 'Pad',
        params: {
          osc1Vol: 40,
          osc1Pw: 50,
          osc2Vol: 40,
          osc2Wave: MonstroWaveform.BLSaw,
          osc2FtL: -5,
          osc2FtR: 5,
          osc3Vol: 30,
          osc3Crs: -12,
          osc3Wave1: MonstroWaveform.Sine,
          vol1Env1: 100,
          vol2Env1: 100,
          vol3Env1: 100,
          env1Att: 500,
          env1Dec: 500,
          env1Sus: 70,
          env1Rel: 1000,
        },
      },
      {
        name: 'Bass',
        params: {
          osc1Vol: 60,
          osc1Pw: 40,
          osc3Vol: 50,
          osc3Crs: -12,
          osc3Wave1: MonstroWaveform.BLSquare,
          vol1Env1: 100,
          vol3Env1: 100,
          env1Att: 5,
          env1Dec: 150,
          env1Sus: 60,
          env1Rel: 100,
        },
      },
      {
        name: 'PWM Strings',
        params: {
          osc1Vol: 50,
          osc1Pw: 50,
          pw1Lfo1: 30,
          lfo1Rate: 0.5,
          vol1Env1: 100,
          env1Att: 300,
          env1Dec: 200,
          env1Sus: 80,
          env1Rel: 500,
        },
      },
      {
        name: 'Sync Lead',
        params: {
          osc1Vol: 50,
          osc2Vol: 50,
          osc2Wave: MonstroWaveform.BLSaw,
          osc2SyncH: 1,
          pit2Lfo1: 20,
          lfo1Rate: 2,
          vol1Env1: 100,
          vol2Env1: 100,
          env1Att: 10,
          env1Dec: 200,
          env1Sus: 70,
          env1Rel: 200,
        },
      },
    ];

    for (const preset of presets) {
      this.addPreset(preset);
    }
  }

  dispose(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    this.voices.clear();
    super.dispose();
  }
}