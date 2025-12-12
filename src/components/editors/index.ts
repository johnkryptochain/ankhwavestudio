// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Editor Components Index
 * Exports all editor components for the AnkhWaveStudio Web DAW
 */

export { SongEditor } from './SongEditor';
export { PianoRoll } from './PianoRoll';
export type { MidiNote, PianoRollProps } from './PianoRoll';
export { PatternEditor } from './PatternEditor';
export type { StepData, PatternRow, Pattern, PatternEditorProps } from './PatternEditor';
export { AutomationEditor } from './AutomationEditor';
export type { AutomationPoint, AutomationLane, AutomationEditorProps } from './AutomationEditor';

// Tier 2 editors
export { BeatBasslineEditor } from './BeatBasslineEditor';