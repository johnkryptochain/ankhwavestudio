// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * UI-related TypeScript types for AnkhWaveStudio Web
 */

// Editor view types
export type EditorView = 'song' | 'piano-roll' | 'pianoRoll' | 'pattern' | 'automation' | 'mixer';

// Panel positions
export type PanelPosition = 'left' | 'right' | 'bottom' | 'floating';

// Theme types
export type ThemeMode = 'dark' | 'light' | 'system';

// User Preferences
export interface UserPreferences {
  showTooltips: boolean;
  displayWaveform: boolean;
  showNoteLabels: boolean;
  compactTrackButtons: boolean;
  sidebarOnRight: boolean;
  openLastProject: boolean;
  language: string;
  autoSaveEnabled: boolean;
  autoSaveInterval: number;
  smoothScroll: boolean;
  animateAudioFileProcessor: boolean;
  
  // Audio
  audioInterface: string;
  sampleRate: number;
  bufferSize: number;
  
  // MIDI
  midiInterface: string;
  midiAutoQuantize: boolean;
  
  // Paths
  workingDirectory: string;
  vstDirectory: string;
  samplesDirectory: string;
}

// UI State
export interface UIState {
  activeEditor: EditorView;
  sidebarOpen: boolean;
  sidebarWidth: number;
  bottomPanelOpen: boolean;
  bottomPanelHeight: number;
  theme: ThemeMode;
  zoom: ZoomState;
  selection: SelectionState;
  clipboard: ClipboardState;
  dialogs: DialogState;
  preferences: UserPreferences;
}

// Zoom state for editors
export interface ZoomState {
  horizontal: number;  // 0.1 - 10
  vertical: number;    // 0.1 - 10
  songEditor: number;
  pianoRoll: number;
  patternEditor: number;
}

// Selection state
export interface SelectionState {
  selectedTrackIds: string[];
  selectedClipIds: string[];
  selectedNoteIds: string[];
  selectedAutomationPointIds: string[];
  selectionRange: SelectionRange | null;
}

// Selection range (for marquee selection)
export interface SelectionRange {
  startTick: number;
  endTick: number;
  startPitch?: number;
  endPitch?: number;
}

// Clipboard state
export interface ClipboardState {
  type: 'clips' | 'notes' | 'automation' | null;
  data: unknown;
}

// Dialog state
export interface DialogState {
  projectSettings: boolean;
  exportDialog: boolean;
  importDialog: boolean;
  saveDialog: boolean;
  openDialog: boolean;
  preferences: boolean;
  about: boolean;
  instrumentBrowser: boolean;
  sampleBrowser: boolean;
}

// Keyboard shortcut
export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: string;
  description: string;
}

// Context menu item
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  submenu?: ContextMenuItem[];
  action?: () => void;
}

// Toast notification
export interface ToastNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Drag and drop data
export interface DragData {
  type: 'track' | 'clip' | 'note' | 'sample' | 'instrument' | 'effect';
  id: string;
  data?: unknown;
}

// Grid snap settings
export interface GridSnapSettings {
  enabled: boolean;
  value: SnapValue;
}

// Snap values
export type SnapValue = 
  | '1/1'   // whole note
  | '1/2'   // half note
  | '1/4'   // quarter note
  | '1/8'   // eighth note
  | '1/16'  // sixteenth note
  | '1/32'  // thirty-second note
  | '1/64'  // sixty-fourth note
  | '1/3'   // triplet
  | '1/6'   // triplet eighth
  | 'none'; // no snap

// Piano roll settings
export interface PianoRollSettings {
  noteHeight: number;
  showVelocity: boolean;
  showPan: boolean;
  ghostNotes: boolean;
  gridSnap: GridSnapSettings;
}

// Song editor settings
export interface SongEditorSettings {
  trackHeight: number;
  showAutomation: boolean;
  followPlayhead: boolean;
  gridSnap: GridSnapSettings;
}

// Mixer view settings
export interface MixerViewSettings {
  channelWidth: number;
  showMeters: boolean;
  showSends: boolean;
  showEffects: boolean;
}

// Window/panel dimensions
export interface PanelDimensions {
  width: number;
  height: number;
  x: number;
  y: number;
  minimized: boolean;
  maximized: boolean;
}

// Tool types for editors
export type EditorTool = 
  | 'select'
  | 'draw'
  | 'erase'
  | 'cut'
  | 'move'
  | 'resize'
  | 'automation';

// Editor tool state
export interface EditorToolState {
  activeTool: EditorTool;
  previousTool: EditorTool;
}