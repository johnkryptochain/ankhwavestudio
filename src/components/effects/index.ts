// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Effects Components Index
 * Exports all effect UI components for the AnkhWaveStudio Web DAW
 */

// Core effects
export { CompressorUI } from './Compressor';
export { ParametricEQUI } from './ParametricEQ';
export { EQ3BandUI } from './EQ3Band';

// Tier 2 effects
export { default as FlangerComponent } from './Flanger';
export { default as BitcrushComponent } from './Bitcrush';
export { default as BassBoosterComponent } from './BassBooster';
export { default as StereoEnhancerComponent } from './StereoEnhancer';
export { default as WaveshaperComponent } from './Waveshaper';

// Tier 4 effects - Additional effects for 100% feature parity
export { MultitapEchoUI } from './MultitapEcho';
export { DualFilterUI } from './DualFilter';
export { AmplifierUI } from './Amplifier';
export { CrossoverEQUI } from './CrossoverEQ';
export { SpectrographUI } from './Spectrograph';
export { StereoMatrixUI } from './StereoMatrix';
export { PeakControllerUI } from './PeakController';
export { DynamicsProcessorUI } from './DynamicsProcessor';
export { ChorusUI } from './Chorus';
export { PhaserUI } from './Phaser';
export { DistortionUI } from './Distortion';
