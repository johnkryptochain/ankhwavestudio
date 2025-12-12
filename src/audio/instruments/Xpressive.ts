// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Xpressive - Expressive synthesizer
 * Based on original AnkhWaveStudio Xpressive
 * 
 * Features:
 * - Main oscillator with multiple waveforms
 * - Sub oscillator
 * - Noise generator
 * - Filter with envelope
 * - Amplitude envelope
 * - Modulation wheel support
 * - Pitch bend support
 * - Aftertouch support
 */

import { BaseInstrument, InstrumentParameterDescriptor } from './BaseInstrument';

// Waveform types
export enum XpressiveWaveform {
  Sine = 0,
  Triangle = 1,
  Saw = 2,
  Square = 3,
  Pulse = 4,
  Noise = 5,
}

// Waveform names for UI
export const XPRESSIVE_WAVEFORM_NAMES = [
  'Sine', 'Triangle', 'Saw', 'Square', 'Pulse', 'Noise'
];

// Filter types
export enum FilterType {
  Lowpass = 0,
  Highpass = 1,
  Bandpass = 2,
}

// Voice for polyphony
interface XpressiveVoice {
  noteNumber: number;
  velocity: number;
  frequency: number;
  
  // Oscillator phases
  mainPhase: number;
  subPhase: number;
  noiseValue: number;
  
  // Filter state
  filterState: [number, number]; // Two-pole filter state
  
  // Envelope states
  ampEnvStage: 'attack' | 'decay' | 'sustain' | 'release' | 'off';
  ampEnvValue: number;
  ampEnvTime: number;
  
  filterEnvStage: 'attack' | 'decay' | 'sustain' | 'release' | 'off';
  filterEnvValue: number;
  filterEnvTime: number;
  
  // Expression
  aftertouch: number;
  
  // State
  released: boolean;
}

/**
 * Xpressive - Expressive synthesizer
 */
export class Xpressive extends BaseInstrument {
  private voices: Map<number, XpressiveVoice> = new Map();
  private processor: ScriptProcessorNode | null = null;
  private sampleRate: number = 44100;
  
  // Expression controls (global)
  private modWheel: number = 0;
  private pitchBend: number = 0;
  private channelAftertouch: number = 0;
  
  constructor(audioContext: AudioContext, id: string = 'xpressive') {
    super(audioContext, id, 'Xpressive', 'expressive-synth');
    this.sampleRate = audioContext.sampleRate;
    this.initializeInstrument();
  }
  
  protected initializeInstrument(): void {
    // Initialize default parameters
    this.params = {
      // Main oscillator
      mainWave: XpressiveWaveform.Saw,
      mainVol: 100,
      mainDetune: 0,
      mainPulseWidth: 50,
      
      // Sub oscillator
      subWave: XpressiveWaveform.Square,
      subVol: 0,
      subOctave: -1,
      subDetune: 0,
      
      // Noise
      noiseVol: 0,
      noiseColor: 50, // 0 = white, 100 = pink
      
      // Filter
      filterType: FilterType.Lowpass,
      filterCutoff: 100,
      filterResonance: 0,
      filterEnvAmount: 0,
      filterKeyTrack: 0,
      
      // Filter envelope
      filterAttack: 10,
      filterDecay: 200,
      filterSustain: 50,
      filterRelease: 200,
      
      // Amplitude envelope
      ampAttack: 10,
      ampDecay: 100,
      ampSustain: 80,
      ampRelease: 200,
      
      // Modulation
      modWheelToCutoff: 0,
      modWheelToVibrato: 50,
      vibratoRate: 5,
      vibratoDepth: 0,
      
      // Pitch bend
      pitchBendRange: 2, // semitones
      
      // Aftertouch
      aftertouchToCutoff: 0,
      aftertouchToVolume: 0,
      
      // Glide
      glideTime: 0,
      glideEnabled: 0,
      
      // Output
      masterVol: 80,
    };
    
    // Create script processor for synthesis
    const bufferSize = 2048;
    this.processor = this.audioContext.createScriptProcessor(bufferSize, 0, 2);
    this.processor.onaudioprocess = this.processAudio.bind(this);
    
    // Connect to volume node
    this.processor.connect(this.volumeNode);
    
    // Load default presets
    this.loadDefaultPresets();
  }
  
  private loadDefaultPresets(): void {
    this.presets = [
      {
        name: 'Init',
        params: { ...this.params }
      },
      {
        name: 'Classic Lead',
        params: {
          mainWave: XpressiveWaveform.Saw,
          mainVol: 100,
          filterCutoff: 70,
          filterResonance: 30,
          filterEnvAmount: 40,
          filterAttack: 5,
          filterDecay: 300,
          filterSustain: 30,
          ampAttack: 5,
          ampDecay: 100,
          ampSustain: 80,
          ampRelease: 200,
          modWheelToVibrato: 80,
          vibratoRate: 5,
        }
      },
      {
        name: 'Fat Bass',
        params: {
          mainWave: XpressiveWaveform.Saw,
          mainVol: 80,
          subWave: XpressiveWaveform.Square,
          subVol: 60,
          subOctave: -1,
          filterCutoff: 40,
          filterResonance: 20,
          filterEnvAmount: 50,
          filterAttack: 1,
          filterDecay: 200,
          filterSustain: 20,
          ampAttack: 1,
          ampDecay: 50,
          ampSustain: 90,
          ampRelease: 100,
        }
      },
      {
        name: 'Pad',
        params: {
          mainWave: XpressiveWaveform.Saw,
          mainVol: 70,
          mainDetune: 10,
          filterCutoff: 50,
          filterResonance: 10,
          ampAttack: 500,
          ampDecay: 300,
          ampSustain: 70,
          ampRelease: 800,
          modWheelToCutoff: 50,
        }
      },
      {
        name: 'Pluck',
        params: {
          mainWave: XpressiveWaveform.Square,
          mainVol: 100,
          filterCutoff: 80,
          filterResonance: 40,
          filterEnvAmount: 60,
          filterAttack: 1,
          filterDecay: 150,
          filterSustain: 0,
          ampAttack: 1,
          ampDecay: 200,
          ampSustain: 0,
          ampRelease: 100,
        }
      },
      {
        name: 'Expressive Lead',
        params: {
          mainWave: XpressiveWaveform.Saw,
          mainVol: 100,
          filterCutoff: 60,
          filterResonance: 25,
          filterEnvAmount: 30,
          modWheelToCutoff: 40,
          modWheelToVibrato: 100,
          vibratoRate: 6,
          aftertouchToCutoff: 50,
          aftertouchToVolume: 20,
          pitchBendRange: 2,
        }
      },
      {
        name: 'Noise Sweep',
        params: {
          mainWave: XpressiveWaveform.Saw,
          mainVol: 50,
          noiseVol: 50,
          noiseColor: 30,
          filterCutoff: 20,
          filterResonance: 60,
          filterEnvAmount: 80,
          filterAttack: 500,
          filterDecay: 1000,
          filterSustain: 20,
          ampAttack: 100,
          ampDecay: 500,
          ampSustain: 60,
          ampRelease: 500,
        }
      },
      {
        name: 'PWM Lead',
        params: {
          mainWave: XpressiveWaveform.Pulse,
          mainVol: 100,
          mainPulseWidth: 30,
          filterCutoff: 70,
          filterResonance: 20,
          modWheelToVibrato: 60,
          vibratoRate: 5,
        }
      },
    ];
  }
  
  private processAudio(event: AudioProcessingEvent): void {
    const outputL = event.outputBuffer.getChannelData(0);
    const outputR = event.outputBuffer.getChannelData(1);
    const bufferSize = outputL.length;
    
    // Clear buffers
    outputL.fill(0);
    outputR.fill(0);
    
    if (this.voices.size === 0) return;
    
    const masterVol = this.params.masterVol / 100;
    
    // Process each voice
    const voicesToRemove: number[] = [];
    
    for (const [note, voice] of this.voices) {
      // Calculate expression modulation
      const modWheelCutoff = this.modWheel * (this.params.modWheelToCutoff / 100);
      const modWheelVibrato = this.modWheel * (this.params.modWheelToVibrato / 100);
      const aftertouchCutoff = voice.aftertouch * (this.params.aftertouchToCutoff / 100);
      const aftertouchVol = 1 + voice.aftertouch * (this.params.aftertouchToVolume / 100);
      
      // Calculate pitch with bend
      const pitchBendSemitones = this.pitchBend * this.params.pitchBendRange;
      const pitchMultiplier = Math.pow(2, pitchBendSemitones / 12);
      
      // Calculate vibrato
      const vibratoAmount = (this.params.vibratoDepth / 100 + modWheelVibrato * 0.1);
      
      for (let i = 0; i < bufferSize; i++) {
        // Update envelopes
        this.updateAmpEnvelope(voice);
        this.updateFilterEnvelope(voice);
        
        // Check if voice is done
        if (voice.ampEnvStage === 'off') {
          voicesToRemove.push(note);
          break;
        }
        
        // Calculate vibrato
        const vibratoPhase = (voice.mainPhase * this.params.vibratoRate) % 1;
        const vibrato = 1 + vibratoAmount * Math.sin(vibratoPhase * Math.PI * 2) * 0.02;
        
        // Calculate frequency with all modulations
        const freq = voice.frequency * pitchMultiplier * vibrato;
        
        // Generate main oscillator
        let mainSample = this.generateOscillator(
          this.params.mainWave,
          voice.mainPhase,
          this.params.mainPulseWidth / 100
        );
        
        // Generate sub oscillator
        let subSample = 0;
        if (this.params.subVol > 0) {
          const subFreq = freq * Math.pow(2, this.params.subOctave);
          subSample = this.generateOscillator(
            this.params.subWave,
            voice.subPhase,
            0.5
          );
        }
        
        // Generate noise
        let noiseSample = 0;
        if (this.params.noiseVol > 0) {
          // Simple colored noise using filtering
          const white = Math.random() * 2 - 1;
          const color = this.params.noiseColor / 100;
          voice.noiseValue = voice.noiseValue * color + white * (1 - color);
          noiseSample = voice.noiseValue;
        }
        
        // Mix oscillators
        let sample = 
          mainSample * (this.params.mainVol / 100) +
          subSample * (this.params.subVol / 100) +
          noiseSample * (this.params.noiseVol / 100);
        
        // Apply filter
        const baseCutoff = this.params.filterCutoff / 100;
        const envCutoff = voice.filterEnvValue * (this.params.filterEnvAmount / 100);
        const keyTrackCutoff = ((voice.noteNumber - 60) / 60) * (this.params.filterKeyTrack / 100);
        const totalCutoff = Math.max(0, Math.min(1, baseCutoff + envCutoff + modWheelCutoff + aftertouchCutoff + keyTrackCutoff));
        
        sample = this.applyFilter(
          sample,
          voice,
          totalCutoff,
          this.params.filterResonance / 100,
          this.params.filterType
        );
        
        // Apply amplitude envelope and expression
        sample *= voice.ampEnvValue * voice.velocity * aftertouchVol;
        
        // Output (mono to stereo)
        outputL[i] += sample * masterVol;
        outputR[i] += sample * masterVol;
        
        // Update phases
        const mainPhaseInc = freq * Math.pow(2, this.params.mainDetune / 1200) / this.sampleRate;
        const subPhaseInc = freq * Math.pow(2, this.params.subOctave + this.params.subDetune / 1200) / this.sampleRate;
        
        voice.mainPhase = (voice.mainPhase + mainPhaseInc) % 1;
        voice.subPhase = (voice.subPhase + subPhaseInc) % 1;
      }
    }
    
    // Remove finished voices
    for (const note of voicesToRemove) {
      this.voices.delete(note);
    }
  }
  
  private generateOscillator(waveform: number, phase: number, pulseWidth: number): number {
    switch (waveform) {
      case XpressiveWaveform.Sine:
        return Math.sin(phase * Math.PI * 2);
        
      case XpressiveWaveform.Triangle:
        if (phase < 0.25) return phase * 4;
        if (phase < 0.75) return 2 - phase * 4;
        return phase * 4 - 4;
        
      case XpressiveWaveform.Saw:
        return 2 * phase - 1;
        
      case XpressiveWaveform.Square:
        return phase < 0.5 ? 1 : -1;
        
      case XpressiveWaveform.Pulse:
        return phase < pulseWidth ? 1 : -1;
        
      case XpressiveWaveform.Noise:
        return Math.random() * 2 - 1;
        
      default:
        return 0;
    }
  }
  
  private applyFilter(
    sample: number,
    voice: XpressiveVoice,
    cutoff: number,
    resonance: number,
    filterType: number
  ): number {
    // Simple two-pole filter (Chamberlin state variable)
    const f = 2 * Math.sin(Math.PI * cutoff * cutoff * 0.5);
    const q = 1 - resonance * 0.9;
    
    const low = voice.filterState[0] + f * voice.filterState[1];
    const high = sample - low - q * voice.filterState[1];
    const band = f * high + voice.filterState[1];
    
    voice.filterState[0] = low;
    voice.filterState[1] = band;
    
    switch (filterType) {
      case FilterType.Lowpass:
        return low;
      case FilterType.Highpass:
        return high;
      case FilterType.Bandpass:
        return band;
      default:
        return low;
    }
  }
  
  private updateAmpEnvelope(voice: XpressiveVoice): void {
    const attack = this.params.ampAttack;
    const decay = this.params.ampDecay;
    const sustain = this.params.ampSustain / 100;
    const release = this.params.ampRelease;
    
    const timeIncrement = 1000 / this.sampleRate;
    
    switch (voice.ampEnvStage) {
      case 'attack':
        voice.ampEnvTime += timeIncrement;
        if (attack <= 0) {
          voice.ampEnvValue = 1;
          voice.ampEnvStage = 'decay';
          voice.ampEnvTime = 0;
        } else {
          voice.ampEnvValue = Math.min(1, voice.ampEnvTime / attack);
          if (voice.ampEnvValue >= 1) {
            voice.ampEnvStage = 'decay';
            voice.ampEnvTime = 0;
          }
        }
        break;
        
      case 'decay':
        voice.ampEnvTime += timeIncrement;
        if (decay <= 0) {
          voice.ampEnvValue = sustain;
          voice.ampEnvStage = 'sustain';
        } else {
          voice.ampEnvValue = 1 - (1 - sustain) * Math.min(1, voice.ampEnvTime / decay);
          if (voice.ampEnvTime >= decay) {
            voice.ampEnvStage = 'sustain';
          }
        }
        break;
        
      case 'sustain':
        voice.ampEnvValue = sustain;
        if (voice.released) {
          voice.ampEnvStage = 'release';
          voice.ampEnvTime = 0;
        }
        break;
        
      case 'release':
        voice.ampEnvTime += timeIncrement;
        if (release <= 0) {
          voice.ampEnvValue = 0;
          voice.ampEnvStage = 'off';
        } else {
          voice.ampEnvValue = sustain * (1 - Math.min(1, voice.ampEnvTime / release));
          if (voice.ampEnvTime >= release) {
            voice.ampEnvStage = 'off';
            voice.ampEnvValue = 0;
          }
        }
        break;
        
      case 'off':
        voice.ampEnvValue = 0;
        break;
    }
  }
  
  private updateFilterEnvelope(voice: XpressiveVoice): void {
    const attack = this.params.filterAttack;
    const decay = this.params.filterDecay;
    const sustain = this.params.filterSustain / 100;
    const release = this.params.filterRelease;
    
    const timeIncrement = 1000 / this.sampleRate;
    
    switch (voice.filterEnvStage) {
      case 'attack':
        voice.filterEnvTime += timeIncrement;
        if (attack <= 0) {
          voice.filterEnvValue = 1;
          voice.filterEnvStage = 'decay';
          voice.filterEnvTime = 0;
        } else {
          voice.filterEnvValue = Math.min(1, voice.filterEnvTime / attack);
          if (voice.filterEnvValue >= 1) {
            voice.filterEnvStage = 'decay';
            voice.filterEnvTime = 0;
          }
        }
        break;
        
      case 'decay':
        voice.filterEnvTime += timeIncrement;
        if (decay <= 0) {
          voice.filterEnvValue = sustain;
          voice.filterEnvStage = 'sustain';
        } else {
          voice.filterEnvValue = 1 - (1 - sustain) * Math.min(1, voice.filterEnvTime / decay);
          if (voice.filterEnvTime >= decay) {
            voice.filterEnvStage = 'sustain';
          }
        }
        break;
        
      case 'sustain':
        voice.filterEnvValue = sustain;
        if (voice.released) {
          voice.filterEnvStage = 'release';
          voice.filterEnvTime = 0;
        }
        break;
        
      case 'release':
        voice.filterEnvTime += timeIncrement;
        if (release <= 0) {
          voice.filterEnvValue = 0;
          voice.filterEnvStage = 'off';
        } else {
          voice.filterEnvValue = sustain * (1 - Math.min(1, voice.filterEnvTime / release));
          if (voice.filterEnvTime >= release) {
            voice.filterEnvStage = 'off';
            voice.filterEnvValue = 0;
          }
        }
        break;
        
      case 'off':
        voice.filterEnvValue = 0;
        break;
    }
  }
  
  // BaseInstrument abstract method implementations
  
  protected silenceNote(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
    if (voice) {
      voice.ampEnvStage = 'off';
      voice.ampEnvValue = 0;
    }
  }

  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    const voice: XpressiveVoice = {
      noteNumber,
      velocity,
      frequency,
      mainPhase: 0,
      subPhase: 0,
      noiseValue: 0,
      filterState: [0, 0],
      ampEnvStage: 'attack',
      ampEnvValue: 0,
      ampEnvTime: 0,
      filterEnvStage: 'attack',
      filterEnvValue: 0,
      filterEnvTime: 0,
      aftertouch: 0,
      released: false,
    };
    
    this.voices.set(noteNumber, voice);
  }
  
  protected releaseNote(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
    if (voice) {
      voice.released = true;
    }
  }
  
  protected onParameterChange(key: string, value: number): void {
    // Parameters are stored in this.params and used directly in processAudio
  }
  
  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    return [
      // Main oscillator
      { name: 'Main Wave', key: 'mainWave', min: 0, max: 5, default: 2, step: 1, type: 'enum', enumValues: XPRESSIVE_WAVEFORM_NAMES, category: 'Main Osc' },
      { name: 'Main Volume', key: 'mainVol', min: 0, max: 100, default: 100, unit: '%', category: 'Main Osc' },
      { name: 'Main Detune', key: 'mainDetune', min: -100, max: 100, default: 0, unit: 'cents', category: 'Main Osc' },
      { name: 'Pulse Width', key: 'mainPulseWidth', min: 5, max: 95, default: 50, unit: '%', category: 'Main Osc' },
      
      // Sub oscillator
      { name: 'Sub Wave', key: 'subWave', min: 0, max: 5, default: 3, step: 1, type: 'enum', enumValues: XPRESSIVE_WAVEFORM_NAMES, category: 'Sub Osc' },
      { name: 'Sub Volume', key: 'subVol', min: 0, max: 100, default: 0, unit: '%', category: 'Sub Osc' },
      { name: 'Sub Octave', key: 'subOctave', min: -2, max: 2, default: -1, step: 1, category: 'Sub Osc' },
      { name: 'Sub Detune', key: 'subDetune', min: -100, max: 100, default: 0, unit: 'cents', category: 'Sub Osc' },
      
      // Noise
      { name: 'Noise Volume', key: 'noiseVol', min: 0, max: 100, default: 0, unit: '%', category: 'Noise' },
      { name: 'Noise Color', key: 'noiseColor', min: 0, max: 100, default: 50, unit: '%', category: 'Noise' },
      
      // Filter
      { name: 'Filter Type', key: 'filterType', min: 0, max: 2, default: 0, step: 1, type: 'enum', enumValues: ['Lowpass', 'Highpass', 'Bandpass'], category: 'Filter' },
      { name: 'Cutoff', key: 'filterCutoff', min: 0, max: 100, default: 100, unit: '%', category: 'Filter' },
      { name: 'Resonance', key: 'filterResonance', min: 0, max: 100, default: 0, unit: '%', category: 'Filter' },
      { name: 'Env Amount', key: 'filterEnvAmount', min: -100, max: 100, default: 0, unit: '%', category: 'Filter' },
      { name: 'Key Track', key: 'filterKeyTrack', min: 0, max: 100, default: 0, unit: '%', category: 'Filter' },
      
      // Filter envelope
      { name: 'Filter Attack', key: 'filterAttack', min: 0, max: 5000, default: 10, unit: 'ms', category: 'Filter Env' },
      { name: 'Filter Decay', key: 'filterDecay', min: 0, max: 5000, default: 200, unit: 'ms', category: 'Filter Env' },
      { name: 'Filter Sustain', key: 'filterSustain', min: 0, max: 100, default: 50, unit: '%', category: 'Filter Env' },
      { name: 'Filter Release', key: 'filterRelease', min: 0, max: 5000, default: 200, unit: 'ms', category: 'Filter Env' },
      
      // Amplitude envelope
      { name: 'Amp Attack', key: 'ampAttack', min: 0, max: 5000, default: 10, unit: 'ms', category: 'Amp Env' },
      { name: 'Amp Decay', key: 'ampDecay', min: 0, max: 5000, default: 100, unit: 'ms', category: 'Amp Env' },
      { name: 'Amp Sustain', key: 'ampSustain', min: 0, max: 100, default: 80, unit: '%', category: 'Amp Env' },
      { name: 'Amp Release', key: 'ampRelease', min: 0, max: 5000, default: 200, unit: 'ms', category: 'Amp Env' },
      
      // Modulation
      { name: 'Mod → Cutoff', key: 'modWheelToCutoff', min: 0, max: 100, default: 0, unit: '%', category: 'Modulation' },
      { name: 'Mod → Vibrato', key: 'modWheelToVibrato', min: 0, max: 100, default: 50, unit: '%', category: 'Modulation' },
      { name: 'Vibrato Rate', key: 'vibratoRate', min: 0.1, max: 20, default: 5, unit: 'Hz', category: 'Modulation' },
      { name: 'Vibrato Depth', key: 'vibratoDepth', min: 0, max: 100, default: 0, unit: '%', category: 'Modulation' },
      
      // Pitch bend
      { name: 'Bend Range', key: 'pitchBendRange', min: 1, max: 24, default: 2, unit: 'semi', category: 'Expression' },
      
      // Aftertouch
      { name: 'AT → Cutoff', key: 'aftertouchToCutoff', min: 0, max: 100, default: 0, unit: '%', category: 'Expression' },
      { name: 'AT → Volume', key: 'aftertouchToVolume', min: 0, max: 100, default: 0, unit: '%', category: 'Expression' },
      
      // Glide
      { name: 'Glide Time', key: 'glideTime', min: 0, max: 1000, default: 0, unit: 'ms', category: 'Expression' },
      { name: 'Glide', key: 'glideEnabled', min: 0, max: 1, default: 0, step: 1, type: 'boolean', category: 'Expression' },
      
      // Output
      { name: 'Master Volume', key: 'masterVol', min: 0, max: 100, default: 80, unit: '%', category: 'Output' },
    ];
  }
  
  /**
   * Set modulation wheel value (0-1)
   */
  setModWheel(value: number): void {
    this.modWheel = Math.max(0, Math.min(1, value));
  }
  
  /**
   * Set pitch bend value (-1 to 1)
   */
  setPitchBend(value: number): void {
    this.pitchBend = Math.max(-1, Math.min(1, value));
  }
  
  /**
   * Set channel aftertouch (0-1)
   */
  setChannelAftertouch(value: number): void {
    this.channelAftertouch = Math.max(0, Math.min(1, value));
    // Apply to all voices
    for (const voice of this.voices.values()) {
      voice.aftertouch = this.channelAftertouch;
    }
  }
  
  /**
   * Set polyphonic aftertouch for a specific note (0-1)
   */
  setPolyAftertouch(noteNumber: number, value: number): void {
    const voice = this.voices.get(noteNumber);
    if (voice) {
      voice.aftertouch = Math.max(0, Math.min(1, value));
    }
  }
  
  /**
   * Get current expression values
   */
  getExpressionValues(): { modWheel: number; pitchBend: number; aftertouch: number } {
    return {
      modWheel: this.modWheel,
      pitchBend: this.pitchBend,
      aftertouch: this.channelAftertouch,
    };
  }
  
  dispose(): void {
    this.voices.clear();
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    super.dispose();
  }
}

export default Xpressive;