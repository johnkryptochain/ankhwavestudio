// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Commands module - Export all command types and utilities
 */

// Base command types
export { 
  type Command, 
  BaseCommand, 
  CompoundCommand, 
  type CommandType, 
  type CommandMetadata, 
  type MetadataCommand,
  generateCommandId,
  createValueChangeCommand 
} from './Command';

// Note commands
export {
  type NoteWithId,
  setNoteStore,
  AddNoteCommand,
  DeleteNoteCommand,
  DeleteNotesCommand,
  MoveNoteCommand,
  MoveNotesCommand,
  ResizeNoteCommand,
  ChangeNoteVelocityCommand,
  QuantizeNotesCommand,
  TransposeNotesCommand,
  createNoteWithId,
} from './NoteCommands';

// Track commands
export {
  setTrackStore,
  AddTrackCommand,
  DeleteTrackCommand,
  RenameTrackCommand,
  MoveTrackCommand,
  ChangeTrackVolumeCommand,
  ChangeTrackPanCommand,
  ToggleTrackMuteCommand,
  ToggleTrackSoloCommand,
  ChangeTrackColorCommand,
  AddClipCommand,
  DeleteClipCommand,
  MoveClipCommand,
  ResizeClipCommand,
  DuplicateTrackCommand,
} from './TrackCommands';

// Pattern commands
export {
  setPatternStore,
  AddPatternCommand,
  DeletePatternCommand,
  RenamePatternCommand,
  ChangePatternLengthCommand,
  TogglePatternStepCommand,
  ChangeStepVelocityCommand,
  ChangeStepPanCommand,
  ChangeStepPitchCommand,
  ClearPatternCommand,
  DuplicatePatternCommand,
  SetPatternStepsCommand,
  RandomizePatternCommand,
} from './PatternCommands';

// Mixer commands
export {
  setMixerStore,
  AddMixerChannelCommand,
  RemoveMixerChannelCommand,
  RenameMixerChannelCommand,
  ChangeChannelVolumeCommand,
  ChangeChannelPanCommand,
  ToggleChannelMuteCommand,
  ToggleChannelSoloCommand,
  AddEffectCommand,
  RemoveEffectCommand,
  UpdateEffectCommand,
  ToggleEffectBypassCommand,
  MoveEffectCommand,
  AddSendCommand,
  RemoveSendCommand,
  ChangeSendAmountCommand,
  ReorderMixerChannelsCommand,
} from './MixerCommands';