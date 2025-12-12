// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * InstrumentFactory - Factory pattern for creating instrument instances
 * Maps instrument type names to classes and handles initialization
 */

import { BaseInstrument } from './instruments/BaseInstrument';
import { Oscillator } from './instruments/Oscillator';
import { Kicker } from './instruments/Kicker';
import { LB302 } from './instruments/LB302';
import { Monstro } from './instruments/Monstro';
import { Organic } from './instruments/Organic';
import { BitInvader } from './instruments/BitInvader';
import { Vibed } from './instruments/Vibed';
import { Watsyn } from './instruments/Watsyn';
import { AudioFileProcessor } from './instruments/AudioFileProcessor';
import { Mallets } from './instruments/Mallets';
import { Xpressive } from './instruments/Xpressive';
import { ScriptInstrument } from './instruments/ScriptInstrument';

/**
 * Instrument type identifiers
 */
export type InstrumentType = 
  | 'oscillator'
  | 'tripleoscillator'
  | 'kicker'
  | 'lb302'
  | 'monstro'
  | 'organic'
  | 'bitinvader'
  | 'vibed'
  | 'watsyn'
  | 'audiofileprocessor'
  | 'mallets'
  | 'xpressive'
  | 'script';

/**
 * Instrument metadata for UI
 */
export interface InstrumentInfo {
  type: InstrumentType;
  name: string;
  description: string;
  category: 'synth' | 'sampler' | 'drum' | 'bass' | 'other';
  icon?: string;
}

/**
 * Available instruments with metadata
 */
export const INSTRUMENT_INFO: Record<InstrumentType, InstrumentInfo> = {
  oscillator: {
    type: 'oscillator',
    name: 'Oscillator',
    description: 'Simple oscillator with basic waveforms',
    category: 'synth',
  },
  tripleoscillator: {
    type: 'tripleoscillator',
    name: 'Triple Oscillator',
    description: 'Three oscillators with mixing and modulation',
    category: 'synth',
  },
  kicker: {
    type: 'kicker',
    name: 'Kicker',
    description: 'Kick drum synthesizer',
    category: 'drum',
  },
  lb302: {
    type: 'lb302',
    name: 'LB302',
    description: 'Bass synthesizer inspired by TB-303',
    category: 'bass',
  },
  monstro: {
    type: 'monstro',
    name: 'Monstro',
    description: 'Powerful 3-oscillator subtractive synthesizer',
    category: 'synth',
  },
  organic: {
    type: 'organic',
    name: 'Organic',
    description: 'Additive synthesizer with 8 harmonics',
    category: 'synth',
  },
  bitinvader: {
    type: 'bitinvader',
    name: 'BitInvader',
    description: 'Wavetable synthesizer with drawable waveforms',
    category: 'synth',
  },
  vibed: {
    type: 'vibed',
    name: 'Vibed',
    description: 'Vibrating string physical modeling synthesizer',
    category: 'synth',
  },
  watsyn: {
    type: 'watsyn',
    name: 'Watsyn',
    description: '4-oscillator wavetable synthesizer',
    category: 'synth',
  },
  audiofileprocessor: {
    type: 'audiofileprocessor',
    name: 'Audio File Processor',
    description: 'Sample playback with loop and pitch controls',
    category: 'sampler',
  },
  mallets: {
    type: 'mallets',
    name: 'Mallets',
    description: 'Physical modeling mallet percussion',
    category: 'other',
  },
  xpressive: {
    type: 'xpressive',
    name: 'Xpressive',
    description: 'Expressive synthesizer with multiple algorithms',
    category: 'synth',
  },
  script: {
    type: 'script',
    name: 'Script Instrument',
    description: 'Custom DSP using JavaScript (Home-made VST)',
    category: 'other',
  },
};

/**
 * Default presets for each instrument type
 */
export const DEFAULT_PRESETS: Record<InstrumentType, Record<string, number>> = {
  oscillator: {
    waveform: 0, // sine
    volume: 0.8,
    detune: 0,
  },
  tripleoscillator: {
    osc1_waveform: 0,
    osc1_volume: 0.33,
    osc1_detune: 0,
    osc2_waveform: 1,
    osc2_volume: 0.33,
    osc2_detune: 0,
    osc3_waveform: 2,
    osc3_volume: 0.33,
    osc3_detune: 0,
  },
  kicker: {
    startFreq: 150,
    endFreq: 40,
    decay: 0.3,
    distortion: 0.2,
    click: 0.5,
  },
  lb302: {
    cutoff: 0.5,
    resonance: 0.5,
    envMod: 0.5,
    decay: 0.3,
    accent: 0.5,
  },
  monstro: {
    osc1_waveform: 0,
    osc2_waveform: 1,
    osc3_waveform: 2,
    filterCutoff: 0.7,
    filterResonance: 0.3,
  },
  organic: {
    harmonic1: 1.0,
    harmonic2: 0.5,
    harmonic3: 0.25,
    harmonic4: 0.125,
    harmonic5: 0.0625,
    harmonic6: 0.03125,
    harmonic7: 0.015625,
    harmonic8: 0.0078125,
  },
  bitinvader: {
    sampleLength: 128,
    interpolation: 1,
  },
  vibed: {
    stringLength: 0.5,
    pickPosition: 0.3,
    pickupPosition: 0.7,
    damping: 0.1,
  },
  watsyn: {
    a_wave: 0,
    b_wave: 1,
    a_b_mix: 0.5,
    env_amount: 0.5,
  },
  audiofileprocessor: {
    startPoint: 0,
    endPoint: 1,
    loopStart: 0,
    loopEnd: 1,
    reverse: 0,
  },
  mallets: {
    hardness: 0.5,
    position: 0.5,
    vibrato: 0,
    vibratoFreq: 5,
    stickMix: 0.5,
  },
  xpressive: {
    waveform: 0,
    modAmount: 0.5,
    modFreq: 5,
    filterCutoff: 0.7,
    filterResonance: 0.3,
  },
  script: {},
};

/**
 * Factory class for creating instrument instances
 */
export class InstrumentFactory {
  private audioContext: AudioContext;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  /**
   * Create an instrument instance
   */
  public create(
    type: InstrumentType,
    id: string,
    name?: string,
    preset?: Record<string, number>
  ): BaseInstrument {
    const instrumentName = name || INSTRUMENT_INFO[type]?.name || type;
    const defaultPreset = DEFAULT_PRESETS[type] || {};
    const finalPreset = { ...defaultPreset, ...preset };

    let instrument: BaseInstrument;

    switch (type) {
      case 'oscillator':
      case 'tripleoscillator':
        instrument = new Oscillator(this.audioContext, id, instrumentName);
        break;

      case 'kicker':
        instrument = new Kicker(this.audioContext, id, instrumentName);
        break;

      case 'lb302':
        instrument = new LB302(this.audioContext, id, instrumentName);
        break;

      case 'monstro':
        instrument = new Monstro(this.audioContext, id, instrumentName);
        break;

      case 'organic':
        instrument = new Organic(this.audioContext, id, instrumentName);
        break;

      case 'bitinvader':
        instrument = new BitInvader(this.audioContext, id, instrumentName);
        break;

      case 'vibed':
        instrument = new Vibed(this.audioContext, id, instrumentName);
        break;

      case 'watsyn':
        instrument = new Watsyn(this.audioContext, id);
        instrument.setName(instrumentName);
        break;

      case 'audiofileprocessor':
        instrument = new AudioFileProcessor(this.audioContext, id);
        instrument.setName(instrumentName);
        break;

      case 'mallets':
        instrument = new Mallets(this.audioContext, id);
        instrument.setName(instrumentName);
        break;

      case 'xpressive':
        instrument = new Xpressive(this.audioContext, id);
        instrument.setName(instrumentName);
        break;

      case 'script':
        instrument = new ScriptInstrument(this.audioContext, id, instrumentName);
        break;

      default:
        // Default to simple oscillator
        console.warn(`Unknown instrument type: ${type}, defaulting to Oscillator`);
        instrument = new Oscillator(this.audioContext, id, instrumentName);
    }

    // Apply preset parameters
    instrument.setParameters(finalPreset);

    return instrument;
  }

  /**
   * Get list of available instrument types
   */
  public static getAvailableTypes(): InstrumentType[] {
    return Object.keys(INSTRUMENT_INFO) as InstrumentType[];
  }

  /**
   * Get instrument info by type
   */
  public static getInfo(type: InstrumentType): InstrumentInfo | undefined {
    return INSTRUMENT_INFO[type];
  }

  /**
   * Get all instrument info
   */
  public static getAllInfo(): InstrumentInfo[] {
    return Object.values(INSTRUMENT_INFO);
  }

  /**
   * Get instruments by category
   */
  public static getByCategory(category: InstrumentInfo['category']): InstrumentInfo[] {
    return Object.values(INSTRUMENT_INFO).filter(info => info.category === category);
  }

  /**
   * Get default preset for an instrument type
   */
  public static getDefaultPreset(type: InstrumentType): Record<string, number> {
    return DEFAULT_PRESETS[type] ? { ...DEFAULT_PRESETS[type] } : {};
  }
}

// Export singleton factory getter
let factoryInstance: InstrumentFactory | null = null;

export const getInstrumentFactory = (audioContext: AudioContext): InstrumentFactory => {
  if (!factoryInstance || factoryInstance['audioContext'] !== audioContext) {
    factoryInstance = new InstrumentFactory(audioContext);
  }
  return factoryInstance;
};