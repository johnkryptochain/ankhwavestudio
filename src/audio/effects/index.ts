// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Audio Effects Index
 * Exports all audio effect classes for the AnkhWaveStudio Web DAW
 */

// Base effect class
export { BaseEffect } from './BaseEffect';
export type { EffectParameterDescriptor, EffectPreset } from './BaseEffect';

// Core effects
export { Compressor } from './Compressor';
export { ParametricEQ } from './ParametricEQ';
export { EQ3Band, createEQ3Band } from './EQ3Band';
export { Reverb } from './Reverb';
export { Delay } from './Delay';

// Tier 2 effects
export { Flanger } from './Flanger';
export { Bitcrush } from './Bitcrush';
export { BassBooster } from './BassBooster';
export { StereoEnhancer } from './StereoEnhancer';
export { Waveshaper, WaveshaperCurveType } from './Waveshaper';

// Tier 4 effects - Additional effects for 100% feature parity
export { MultitapEcho } from './MultitapEcho';
export { DualFilter } from './DualFilter';
export { Amplifier } from './Amplifier';
export { CrossoverEQ } from './CrossoverEQ';
export { Spectrograph } from './Spectrograph';
export { StereoMatrix } from './StereoMatrix';
export { PeakController } from './PeakController';
export { DynamicsProcessor } from './DynamicsProcessor';
export { Chorus } from './Chorus';
export { Phaser } from './Phaser';
export { Distortion, DistortionType } from './Distortion';

// Tier 5 effects - Final feature parity effects
export { ReverbSC, createReverbSC } from './ReverbSC';
export { Dispersion, createDispersion } from './Dispersion';
export { GranularPitchShifter, createGranularPitchShifter } from './GranularPitchShifter';
export { LOMM, createLOMM } from './LOMM';
export { SlewDistortion, createSlewDistortion } from './SlewDistortion';
export { Vectorscope, VectorscopeMode, VectorscopeColorScheme, createVectorscope } from './Vectorscope';

// Homemade solutions for "Impossible" features
export { ScriptEffect } from './ScriptEffect';
