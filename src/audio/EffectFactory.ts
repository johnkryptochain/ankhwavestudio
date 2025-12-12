// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * EffectFactory - Factory pattern for creating effect instances
 * Maps effect type names to classes and handles initialization
 */

import { BaseEffect } from './effects/BaseEffect';
import { Delay } from './effects/Delay';
import { Reverb } from './effects/Reverb';
import { Compressor } from './effects/Compressor';
import { ParametricEQ } from './effects/ParametricEQ';
import { Flanger } from './effects/Flanger';
import { Bitcrush } from './effects/Bitcrush';
import { BassBooster } from './effects/BassBooster';
import { StereoEnhancer } from './effects/StereoEnhancer';
import { Waveshaper } from './effects/Waveshaper';
import { MultitapEcho } from './effects/MultitapEcho';
import { DualFilter } from './effects/DualFilter';
import { Amplifier } from './effects/Amplifier';
import { CrossoverEQ } from './effects/CrossoverEQ';
import { Spectrograph } from './effects/Spectrograph';
import { StereoMatrix } from './effects/StereoMatrix';
import { PeakController } from './effects/PeakController';
import { DynamicsProcessor } from './effects/DynamicsProcessor';
import { Chorus } from './effects/Chorus';
import { Phaser } from './effects/Phaser';
import { Distortion } from './effects/Distortion';

/**
 * Effect type identifiers
 */
export type EffectType = 
  | 'delay'
  | 'reverb'
  | 'compressor'
  | 'parametriceq'
  | 'flanger'
  | 'bitcrush'
  | 'bassbooster'
  | 'stereoenhancer'
  | 'waveshaper'
  | 'multitapecho'
  | 'dualfilter'
  | 'amplifier'
  | 'crossovereq'
  | 'spectrograph'
  | 'stereomatrix'
  | 'peakcontroller'
  | 'dynamicsprocessor'
  | 'chorus'
  | 'phaser'
  | 'distortion';

/**
 * Effect metadata for UI
 */
export interface EffectInfo {
  type: EffectType;
  name: string;
  description: string;
  category: 'dynamics' | 'eq' | 'modulation' | 'delay' | 'distortion' | 'utility' | 'analysis';
  icon?: string;
}

/**
 * Available effects with metadata
 */
export const EFFECT_INFO: Record<EffectType, EffectInfo> = {
  delay: {
    type: 'delay',
    name: 'Delay',
    description: 'Echo/delay effect with feedback',
    category: 'delay',
  },
  reverb: {
    type: 'reverb',
    name: 'Reverb',
    description: 'Room/hall reverb simulation',
    category: 'delay',
  },
  compressor: {
    type: 'compressor',
    name: 'Compressor',
    description: 'Dynamic range compression',
    category: 'dynamics',
  },
  parametriceq: {
    type: 'parametriceq',
    name: 'Parametric EQ',
    description: 'Multi-band parametric equalizer',
    category: 'eq',
  },
  flanger: {
    type: 'flanger',
    name: 'Flanger',
    description: 'Flanging modulation effect',
    category: 'modulation',
  },
  bitcrush: {
    type: 'bitcrush',
    name: 'Bitcrush',
    description: 'Bit depth and sample rate reduction',
    category: 'distortion',
  },
  bassbooster: {
    type: 'bassbooster',
    name: 'Bass Booster',
    description: 'Low frequency enhancement',
    category: 'eq',
  },
  stereoenhancer: {
    type: 'stereoenhancer',
    name: 'Stereo Enhancer',
    description: 'Stereo width enhancement',
    category: 'utility',
  },
  waveshaper: {
    type: 'waveshaper',
    name: 'Waveshaper',
    description: 'Waveshaping distortion',
    category: 'distortion',
  },
  multitapecho: {
    type: 'multitapecho',
    name: 'Multitap Echo',
    description: 'Multiple delay taps with individual controls',
    category: 'delay',
  },
  dualfilter: {
    type: 'dualfilter',
    name: 'Dual Filter',
    description: 'Two filters with crossfade',
    category: 'eq',
  },
  amplifier: {
    type: 'amplifier',
    name: 'Amplifier',
    description: 'Gain and saturation',
    category: 'dynamics',
  },
  crossovereq: {
    type: 'crossovereq',
    name: 'Crossover EQ',
    description: 'Multi-band crossover equalizer',
    category: 'eq',
  },
  spectrograph: {
    type: 'spectrograph',
    name: 'Spectrograph',
    description: 'Spectrum analyzer visualization',
    category: 'analysis',
  },
  stereomatrix: {
    type: 'stereomatrix',
    name: 'Stereo Matrix',
    description: 'Mid/side processing and stereo manipulation',
    category: 'utility',
  },
  peakcontroller: {
    type: 'peakcontroller',
    name: 'Peak Controller',
    description: 'Peak detection for automation',
    category: 'utility',
  },
  dynamicsprocessor: {
    type: 'dynamicsprocessor',
    name: 'Dynamics Processor',
    description: 'Advanced dynamics processing',
    category: 'dynamics',
  },
  chorus: {
    type: 'chorus',
    name: 'Chorus',
    description: 'Chorus modulation effect',
    category: 'modulation',
  },
  phaser: {
    type: 'phaser',
    name: 'Phaser',
    description: 'Phase shifting modulation effect',
    category: 'modulation',
  },
  distortion: {
    type: 'distortion',
    name: 'Distortion',
    description: 'Overdrive and distortion',
    category: 'distortion',
  },
};

/**
 * Default presets for each effect type
 */
export const DEFAULT_EFFECT_PRESETS: Record<EffectType, Record<string, number>> = {
  delay: {
    time: 0.25,
    feedback: 0.4,
    mix: 0.3,
  },
  reverb: {
    roomSize: 0.5,
    damping: 0.5,
    mix: 0.3,
  },
  compressor: {
    threshold: -20,
    ratio: 4,
    attack: 10,
    release: 100,
    makeupGain: 0,
  },
  parametriceq: {
    lowGain: 0,
    lowMidGain: 0,
    highMidGain: 0,
    highGain: 0,
  },
  flanger: {
    rate: 0.5,
    depth: 0.5,
    feedback: 0.3,
    mix: 0.5,
  },
  bitcrush: {
    bitDepth: 8,
    sampleRate: 0.5,
    mix: 1.0,
  },
  bassbooster: {
    frequency: 100,
    gain: 6,
  },
  stereoenhancer: {
    width: 1.5,
  },
  waveshaper: {
    amount: 0.5,
    mix: 0.5,
  },
  multitapecho: {
    tap1Time: 0.125,
    tap1Level: 0.8,
    tap2Time: 0.25,
    tap2Level: 0.6,
    tap3Time: 0.375,
    tap3Level: 0.4,
    feedback: 0.3,
  },
  dualfilter: {
    filter1Cutoff: 0.5,
    filter2Cutoff: 0.5,
    mix: 0.5,
  },
  amplifier: {
    gain: 0,
    saturation: 0,
  },
  crossovereq: {
    lowFreq: 200,
    highFreq: 4000,
    lowGain: 0,
    midGain: 0,
    highGain: 0,
  },
  spectrograph: {
    // No parameters - visualization only
  },
  stereomatrix: {
    midGain: 1.0,
    sideGain: 1.0,
  },
  peakcontroller: {
    attack: 1,
    release: 100,
    amount: 1.0,
  },
  dynamicsprocessor: {
    threshold: -20,
    ratio: 4,
    attack: 10,
    release: 100,
    knee: 6,
  },
  chorus: {
    rate: 1.0,
    depth: 0.5,
    mix: 0.5,
  },
  phaser: {
    rate: 0.5,
    depth: 0.5,
    feedback: 0.3,
    stages: 4,
  },
  distortion: {
    drive: 0.5,
    tone: 0.5,
    mix: 1.0,
  },
};

/**
 * Factory class for creating effect instances
 */
export class EffectFactory {
  private audioContext: AudioContext;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  /**
   * Create an effect instance
   */
  public create(
    type: EffectType,
    id: string,
    name?: string,
    preset?: Record<string, number>
  ): BaseEffect {
    const effectName = name || EFFECT_INFO[type]?.name || type;
    const defaultPreset = DEFAULT_EFFECT_PRESETS[type] || {};
    const finalPreset = { ...defaultPreset, ...preset };

    let effect: BaseEffect;

    switch (type) {
      case 'delay':
        effect = new Delay(this.audioContext, id, effectName);
        break;

      case 'reverb':
        effect = new Reverb(this.audioContext, id, effectName);
        break;

      case 'compressor':
        effect = new Compressor(this.audioContext, id, effectName);
        break;

      case 'parametriceq':
        effect = new ParametricEQ(this.audioContext, id, effectName);
        break;

      case 'flanger':
        effect = new Flanger(this.audioContext, id);
        effect.setName(effectName);
        break;

      case 'bitcrush':
        effect = new Bitcrush(this.audioContext, id);
        effect.setName(effectName);
        break;

      case 'bassbooster':
        effect = new BassBooster(this.audioContext, id);
        effect.setName(effectName);
        break;

      case 'stereoenhancer':
        effect = new StereoEnhancer(this.audioContext, id);
        effect.setName(effectName);
        break;

      case 'waveshaper':
        effect = new Waveshaper(this.audioContext, id);
        effect.setName(effectName);
        break;

      case 'multitapecho':
        effect = new MultitapEcho(this.audioContext, id);
        effect.setName(effectName);
        break;

      case 'dualfilter':
        effect = new DualFilter(this.audioContext, id);
        effect.setName(effectName);
        break;

      case 'amplifier':
        effect = new Amplifier(this.audioContext, id);
        effect.setName(effectName);
        break;

      case 'crossovereq':
        effect = new CrossoverEQ(this.audioContext, id);
        effect.setName(effectName);
        break;

      case 'spectrograph':
        effect = new Spectrograph(this.audioContext, id);
        effect.setName(effectName);
        break;

      case 'stereomatrix':
        effect = new StereoMatrix(this.audioContext, id);
        effect.setName(effectName);
        break;

      case 'peakcontroller':
        effect = new PeakController(this.audioContext, id);
        effect.setName(effectName);
        break;

      case 'dynamicsprocessor':
        effect = new DynamicsProcessor(this.audioContext, id);
        effect.setName(effectName);
        break;

      case 'chorus':
        effect = new Chorus(this.audioContext, id);
        effect.setName(effectName);
        break;

      case 'phaser':
        effect = new Phaser(this.audioContext, id);
        effect.setName(effectName);
        break;

      case 'distortion':
        effect = new Distortion(this.audioContext, id);
        effect.setName(effectName);
        break;

      default:
        // Default to delay
        console.warn(`Unknown effect type: ${type}, defaulting to Delay`);
        effect = new Delay(this.audioContext, id, effectName);
    }

    // Apply preset parameters
    effect.setParameters(finalPreset);

    return effect;
  }

  /**
   * Get list of available effect types
   */
  public static getAvailableTypes(): EffectType[] {
    return Object.keys(EFFECT_INFO) as EffectType[];
  }

  /**
   * Get effect info by type
   */
  public static getInfo(type: EffectType): EffectInfo | undefined {
    return EFFECT_INFO[type];
  }

  /**
   * Get all effect info
   */
  public static getAllInfo(): EffectInfo[] {
    return Object.values(EFFECT_INFO);
  }

  /**
   * Get effects by category
   */
  public static getByCategory(category: EffectInfo['category']): EffectInfo[] {
    return Object.values(EFFECT_INFO).filter(info => info.category === category);
  }

  /**
   * Get default preset for an effect type
   */
  public static getDefaultPreset(type: EffectType): Record<string, number> {
    return DEFAULT_EFFECT_PRESETS[type] ? { ...DEFAULT_EFFECT_PRESETS[type] } : {};
  }

  /**
   * Get all categories
   */
  public static getCategories(): EffectInfo['category'][] {
    return ['dynamics', 'eq', 'modulation', 'delay', 'distortion', 'utility', 'analysis'];
  }
}

// Export singleton factory getter
let factoryInstance: EffectFactory | null = null;

export const getEffectFactory = (audioContext: AudioContext): EffectFactory => {
  if (!factoryInstance || factoryInstance['audioContext'] !== audioContext) {
    factoryInstance = new EffectFactory(audioContext);
  }
  return factoryInstance;
};