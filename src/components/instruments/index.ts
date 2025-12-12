// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Instrument Components Index
 * Exports all instrument components for the AnkhWaveStudio Web DAW
 */

export { InstrumentRack } from './InstrumentRack';
export type { InstrumentInstance } from './InstrumentRack';
export { TripleOscillator } from './TripleOscillator';
export { SamplePlayer } from './SamplePlayer';
export { KickerUI } from './Kicker';

// Tier 2 instruments
export { default as LB302Component } from './LB302';

// Tier 3 instruments - Additional synthesizers for 100% feature parity
export { MonstroUI, default as MonstroComponent } from './Monstro';
export { OrganicUI, default as OrganicComponent } from './Organic';
export { BitInvaderUI, default as BitInvaderComponent } from './BitInvader';
export { VibedUI, default as VibedComponent } from './Vibed';
export { WatsynUI, default as WatsynComponent } from './Watsyn';
export { AudioFileProcessorUI, default as AudioFileProcessorComponent } from './AudioFileProcessor';
export { MalletsUI, default as MalletsComponent } from './Mallets';
export { XpressiveUI, default as XpressiveComponent } from './Xpressive';