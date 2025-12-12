// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Store exports for AnkhWaveStudio Web
 */

export { useSongStore, useTempo, useTimeSignature, useTracks, usePatterns, useIsDirty, useSelectedTrackId } from './songStore';
export {
  useTransportStore,
  useIsPlaying,
  useIsRecording,
  usePosition,
  useTransportTempo,
  useLoopEnabled,
  ticksToSeconds,
  secondsToTicks,
  ticksToBarsBeatsTicks,
  formatPosition
} from './transportStore';
export {
  useMixerStore,
  useChannels,
  useMasterChannel,
  useChannel,
  useHasSoloedChannels
} from './mixerStore';
export {
  useUIStore,
  useActiveEditor,
  useSidebarOpen,
  useBottomPanelOpen,
  useTheme,
  useZoom,
  useSelection,
  useDialogs
} from './uiStore';
export {
  useHistoryStore,
  useCanUndo,
  useCanRedo,
  useUndoDescription,
  useRedoDescription,
  executeCommand,
  undo,
  redo,
  beginGroup,
  endGroup,
  cancelGroup,
} from './historyStore';
export {
  useClipboardStore,
  useClipboardData,
  useClipboardHasData,
  useClipboardIsCut,
  copyNotes,
  cutNotes,
  copyClips,
  cutClips,
  copyTracks,
  copyPatterns,
  copyPatternSteps,
  readFromSystemClipboard,
  generatePasteId,
  type ClipboardData,
  type ClipboardDataType,
  type NotesClipboardData,
  type ClipsClipboardData,
  type TracksClipboardData,
  type PatternsClipboardData,
  type PatternStepsClipboardData,
} from './clipboardStore';

// Automation store (Tier 2)
export {
  useAutomationStore,
  type AutomationCurveType,
  type AutomationLaneState,
} from './automationStore';

// Controller store
export {
  useControllerStore,
  ControllerType,
  LFOWaveform,
  type Controller,
  type LFOController,
  type EnvelopeController,
  type PeakController,
  type MIDIController,
  type ControllerConnection,
} from './controllerStore';