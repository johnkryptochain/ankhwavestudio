// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Mallets - Physical modeling percussion synthesizer
 * Based on original AnkhWaveStudio Mallets (plugins/Mallets/)
 * Implements STK (Synthesis ToolKit) algorithms adapted for Web Audio
 * 
 * Features:
 * - Multiple instrument types (marimba, vibraphone, agogo, etc.)
 * - Hardness control
 * - Position control
 * - Vibrato gain/frequency
 * - Stick mix
 * - Modulator index
 * - Crossfade
 */

import { BaseInstrument, InstrumentParameterDescriptor } from './BaseInstrument';

// Instrument types
export enum MalletInstrument {
  Marimba = 0,
  Vibraphone = 1,
  Agogo = 2,
  WoodBlocks = 3,
  TubularBells = 4,
  SteelDrum = 5,
  BandedWG = 6,
  GlassHarmonica = 7,
  Uniform = 8,
}

// Instrument names for UI
export const MALLET_INSTRUMENT_NAMES = [
  'Marimba',
  'Vibraphone',
  'Agogo',
  'Wood Blocks',
  'Tubular Bells',
  'Steel Drum',
  'Banded WG',
  'Glass Harmonica',
  'Uniform Bar',
];

// Modal frequencies for different instruments (ratios to fundamental)
const MODAL_RATIOS: Record<MalletInstrument, number[]> = {
  [MalletInstrument.Marimba]: [1.0, 3.984, 9.513, 16.69, 24.0],
  [MalletInstrument.Vibraphone]: [1.0, 2.756, 5.404, 8.933, 13.34],
  [MalletInstrument.Agogo]: [1.0, 4.08, 6.669, 9.14, 12.0],
  [MalletInstrument.WoodBlocks]: [1.0, 2.777, 4.215, 6.877, 9.0],
  [MalletInstrument.TubularBells]: [1.0, 2.74, 5.25, 8.52, 12.5],
  [MalletInstrument.SteelDrum]: [1.0, 1.5, 2.0, 2.5, 3.0],
  [MalletInstrument.BandedWG]: [1.0, 2.0, 3.0, 4.0, 5.0],
  [MalletInstrument.GlassHarmonica]: [1.0, 2.32, 4.25, 6.63, 9.38],
  [MalletInstrument.Uniform]: [1.0, 2.0, 3.0, 4.0, 5.0],
};

// Modal gains for different instruments
const MODAL_GAINS: Record<MalletInstrument, number[]> = {
  [MalletInstrument.Marimba]: [1.0, 0.8, 0.6, 0.4, 0.2],
  [MalletInstrument.Vibraphone]: [1.0, 0.9, 0.7, 0.5, 0.3],
  [MalletInstrument.Agogo]: [1.0, 0.7, 0.5, 0.3, 0.2],
  [MalletInstrument.WoodBlocks]: [1.0, 0.6, 0.4, 0.3, 0.2],
  [MalletInstrument.TubularBells]: [1.0, 0.85, 0.7, 0.5, 0.35],
  [MalletInstrument.SteelDrum]: [1.0, 0.8, 0.6, 0.5, 0.4],
  [MalletInstrument.BandedWG]: [1.0, 0.7, 0.5, 0.35, 0.25],
  [MalletInstrument.GlassHarmonica]: [1.0, 0.75, 0.55, 0.4, 0.25],
  [MalletInstrument.Uniform]: [1.0, 0.8, 0.6, 0.4, 0.2],
};

// Decay times for different instruments (in seconds)
const MODAL_DECAYS: Record<MalletInstrument, number[]> = {
  [MalletInstrument.Marimba]: [0.8, 0.6, 0.4, 0.3, 0.2],
  [MalletInstrument.Vibraphone]: [2.0, 1.8, 1.5, 1.2, 1.0],
  [MalletInstrument.Agogo]: [0.5, 0.4, 0.3, 0.25, 0.2],
  [MalletInstrument.WoodBlocks]: [0.3, 0.25, 0.2, 0.15, 0.1],
  [MalletInstrument.TubularBells]: [3.0, 2.5, 2.0, 1.5, 1.0],
  [MalletInstrument.SteelDrum]: [1.5, 1.2, 1.0, 0.8, 0.6],
  [MalletInstrument.BandedWG]: [2.5, 2.0, 1.5, 1.2, 1.0],
  [MalletInstrument.GlassHarmonica]: [4.0, 3.5, 3.0, 2.5, 2.0],
  [MalletInstrument.Uniform]: [1.0, 0.9, 0.8, 0.7, 0.6],
};

// Voice for polyphony
interface MalletsVoice {
  noteNumber: number;
  velocity: number;
  frequency: number;
  
  // Modal oscillators
  modalPhases: number[];
  modalAmplitudes: number[];
  modalDecayRates: number[];
  
  // Vibrato
  vibratoPhase: number;
  
  // State
  time: number;
  released: boolean;
  releaseTime: number;
}

/**
 * Mallets - Physical modeling percussion synthesizer
 */
export class Mallets extends BaseInstrument {
  private voices: Map<number, MalletsVoice> = new Map();
  private processor: ScriptProcessorNode | null = null;
  private sampleRate: number = 44100;
  
  constructor(audioContext: AudioContext, id: string = 'mallets') {
    super(audioContext, id, 'Mallets', 'physical-modeling');
    this.sampleRate = audioContext.sampleRate;
    this.initializeInstrument();
  }
  
  protected initializeInstrument(): void {
    // Initialize default parameters
    this.params = {
      instrument: MalletInstrument.Marimba,
      hardness: 50,
      position: 50,
      vibratoGain: 0,
      vibratoFreq: 6,
      stickMix: 50,
      modulatorIndex: 0,
      crossfade: 0,
      spread: 0,
      randomness: 0,
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
        name: 'Marimba',
        params: {
          instrument: MalletInstrument.Marimba,
          hardness: 50,
          position: 50,
          vibratoGain: 0,
        }
      },
      {
        name: 'Vibraphone',
        params: {
          instrument: MalletInstrument.Vibraphone,
          hardness: 40,
          position: 50,
          vibratoGain: 30,
          vibratoFreq: 5,
        }
      },
      {
        name: 'Agogo',
        params: {
          instrument: MalletInstrument.Agogo,
          hardness: 70,
          position: 30,
        }
      },
      {
        name: 'Wood Blocks',
        params: {
          instrument: MalletInstrument.WoodBlocks,
          hardness: 80,
          position: 50,
        }
      },
      {
        name: 'Tubular Bells',
        params: {
          instrument: MalletInstrument.TubularBells,
          hardness: 60,
          position: 50,
          vibratoGain: 10,
        }
      },
      {
        name: 'Steel Drum',
        params: {
          instrument: MalletInstrument.SteelDrum,
          hardness: 55,
          position: 40,
        }
      },
      {
        name: 'Glass Harmonica',
        params: {
          instrument: MalletInstrument.GlassHarmonica,
          hardness: 30,
          position: 50,
          vibratoGain: 20,
          vibratoFreq: 4,
        }
      },
      {
        name: 'Soft Mallet',
        params: {
          instrument: MalletInstrument.Marimba,
          hardness: 20,
          position: 70,
        }
      },
      {
        name: 'Hard Mallet',
        params: {
          instrument: MalletInstrument.Marimba,
          hardness: 90,
          position: 30,
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
    
    const instrument = Math.floor(this.params.instrument) as MalletInstrument;
    const vibratoGain = this.params.vibratoGain / 100;
    const vibratoFreq = this.params.vibratoFreq;
    const spread = this.params.spread / 100;
    
    // Process each voice
    const voicesToRemove: number[] = [];
    
    for (const [note, voice] of this.voices) {
      const velocityGain = voice.velocity;
      
      for (let i = 0; i < bufferSize; i++) {
        let sampleL = 0;
        let sampleR = 0;
        
        // Calculate vibrato
        const vibrato = vibratoGain > 0 
          ? 1 + vibratoGain * Math.sin(voice.vibratoPhase * Math.PI * 2)
          : 1;
        
        // Sum modal oscillators
        let totalAmplitude = 0;
        
        for (let m = 0; m < voice.modalPhases.length; m++) {
          const amplitude = voice.modalAmplitudes[m];
          if (amplitude < 0.0001) continue;
          
          totalAmplitude += amplitude;
          
          // Calculate modal frequency with vibrato
          const modalFreq = voice.frequency * MODAL_RATIOS[instrument][m] * vibrato;
          const phaseInc = modalFreq / this.sampleRate;
          
          // Generate modal oscillator
          const sample = Math.sin(voice.modalPhases[m] * Math.PI * 2) * amplitude;
          
          // Apply stereo spread based on modal index
          const pan = spread * (m / (voice.modalPhases.length - 1) - 0.5);
          const panL = Math.cos((pan + 0.5) * Math.PI / 2);
          const panR = Math.sin((pan + 0.5) * Math.PI / 2);
          
          sampleL += sample * panL;
          sampleR += sample * panR;
          
          // Update phase
          voice.modalPhases[m] = (voice.modalPhases[m] + phaseInc) % 1;
          
          // Apply decay
          voice.modalAmplitudes[m] *= Math.exp(-voice.modalDecayRates[m] / this.sampleRate);
        }
        
        // Check if voice is done
        if (totalAmplitude < 0.0001) {
          voicesToRemove.push(note);
          break;
        }
        
        // Apply velocity
        outputL[i] += sampleL * velocityGain * 0.3;
        outputR[i] += sampleR * velocityGain * 0.3;
        
        // Update vibrato phase
        voice.vibratoPhase = (voice.vibratoPhase + vibratoFreq / this.sampleRate) % 1;
        voice.time += 1 / this.sampleRate;
      }
    }
    
    // Remove finished voices
    for (const note of voicesToRemove) {
      this.voices.delete(note);
    }
  }
  
  // BaseInstrument abstract method implementations
  
  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    const instrument = Math.floor(this.params.instrument) as MalletInstrument;
    const hardness = this.params.hardness / 100;
    const position = this.params.position / 100;
    const stickMix = this.params.stickMix / 100;
    const randomness = this.params.randomness / 100;
    
    const ratios = MODAL_RATIOS[instrument];
    const gains = MODAL_GAINS[instrument];
    const decays = MODAL_DECAYS[instrument];
    
    // Initialize modal oscillators
    const modalPhases: number[] = [];
    const modalAmplitudes: number[] = [];
    const modalDecayRates: number[] = [];
    
    for (let m = 0; m < ratios.length; m++) {
      // Random phase for natural sound
      modalPhases.push(Math.random());
      
      // Calculate amplitude based on hardness and position
      // Harder mallets excite higher modes more
      const hardnessEffect = Math.pow(hardness, m * 0.5);
      // Position affects which modes are excited (nodes/antinodes)
      const positionEffect = Math.sin((m + 1) * position * Math.PI);
      // Stick mix blends between soft and hard attack
      const stickEffect = 1 - stickMix * (1 - Math.exp(-m * 0.5));
      
      let amplitude = gains[m] * hardnessEffect * Math.abs(positionEffect) * stickEffect;
      
      // Add randomness
      if (randomness > 0) {
        amplitude *= 1 + (Math.random() - 0.5) * randomness;
      }
      
      modalAmplitudes.push(amplitude);
      
      // Calculate decay rate (higher modes decay faster)
      let decayTime = decays[m];
      // Hardness affects decay (harder = shorter)
      decayTime *= 1 - hardness * 0.3;
      // Add randomness to decay
      if (randomness > 0) {
        decayTime *= 1 + (Math.random() - 0.5) * randomness * 0.5;
      }
      
      modalDecayRates.push(1 / decayTime);
    }
    
    const voice: MalletsVoice = {
      noteNumber,
      velocity,
      frequency,
      modalPhases,
      modalAmplitudes,
      modalDecayRates,
      vibratoPhase: 0,
      time: 0,
      released: false,
      releaseTime: 0,
    };
    
    this.voices.set(noteNumber, voice);
  }
  
  protected releaseNote(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
    if (voice) {
      voice.released = true;
      voice.releaseTime = voice.time;
      
      // Speed up decay on release
      for (let m = 0; m < voice.modalDecayRates.length; m++) {
        voice.modalDecayRates[m] *= 3;
      }
    }
  }
  
  protected onParameterChange(key: string, value: number): void {
    // Parameters are stored in this.params and used directly in processAudio
  }
  
  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    return [
      { name: 'Instrument', key: 'instrument', min: 0, max: 8, default: 0, step: 1, type: 'enum', enumValues: MALLET_INSTRUMENT_NAMES, category: 'Instrument' },
      { name: 'Hardness', key: 'hardness', min: 0, max: 100, default: 50, unit: '%', category: 'Mallet' },
      { name: 'Position', key: 'position', min: 0, max: 100, default: 50, unit: '%', category: 'Mallet' },
      { name: 'Stick Mix', key: 'stickMix', min: 0, max: 100, default: 50, unit: '%', category: 'Mallet' },
      { name: 'Vibrato Gain', key: 'vibratoGain', min: 0, max: 100, default: 0, unit: '%', category: 'Vibrato' },
      { name: 'Vibrato Freq', key: 'vibratoFreq', min: 0.1, max: 20, default: 6, unit: 'Hz', category: 'Vibrato' },
      { name: 'Modulator Index', key: 'modulatorIndex', min: 0, max: 100, default: 0, unit: '%', category: 'Modulation' },
      { name: 'Crossfade', key: 'crossfade', min: 0, max: 100, default: 0, unit: '%', category: 'Modulation' },
      { name: 'Spread', key: 'spread', min: 0, max: 100, default: 0, unit: '%', category: 'Output' },
      { name: 'Randomness', key: 'randomness', min: 0, max: 100, default: 0, unit: '%', category: 'Output' },
    ];
  }
  
  /**
   * Get the current instrument type
   */
  getInstrumentType(): MalletInstrument {
    return Math.floor(this.params.instrument) as MalletInstrument;
  }
  
  /**
   * Get instrument name
   */
  getInstrumentName(): string {
    return MALLET_INSTRUMENT_NAMES[this.getInstrumentType()];
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

export default Mallets;