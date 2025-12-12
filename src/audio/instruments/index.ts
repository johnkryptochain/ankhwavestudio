// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Audio Instruments Index
 * Exports all audio instrument classes for the AnkhWaveStudio Web DAW
 */

// Base instrument class
export { BaseInstrument } from './BaseInstrument';
export type { InstrumentParameterDescriptor, InstrumentPreset } from './BaseInstrument';

// Oscillator utilities
export { Oscillator } from './Oscillator';

// Core instruments
export { Kicker } from './Kicker';

// Tier 2 instruments
export { LB302 } from './LB302';

// Tier 3 instruments - Additional synthesizers for 100% feature parity
export { Monstro } from './Monstro';
export { Organic } from './Organic';
export { BitInvader } from './BitInvader';
export { Vibed } from './Vibed';
export { Watsyn, WAVETABLE_NAMES } from './Watsyn';
export { AudioFileProcessor, LoopMode, InterpolationMode } from './AudioFileProcessor';
export { Mallets, MalletInstrument, MALLET_INSTRUMENT_NAMES } from './Mallets';
export { Xpressive, XpressiveWaveform, XPRESSIVE_WAVEFORM_NAMES, FilterType } from './Xpressive';

// Tier 4 instruments - Final feature parity instruments
export { Sfxr, SfxrWaveType, SfxrCategory, createSfxr } from './Sfxr';
export { ScriptInstrument } from './ScriptInstrument';
export { FreeBoy, createFreeBoy } from './FreeBoy';
export { GigPlayer, createGigPlayer } from './GigPlayer';
export { SlicerT, createSlicerT } from './SlicerT';
export { Stk, StkInstrumentType, STK_INSTRUMENT_NAMES, createStk } from './Stk';