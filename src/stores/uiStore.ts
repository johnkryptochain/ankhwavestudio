// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * UI Store - Manages UI state
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  UIState,
  EditorView,
  ThemeMode,
  SelectionState,
  DialogState,
  EditorTool,
  GridSnapSettings,
  SnapValue,
  UserPreferences
} from '../types/ui';

interface UIStoreState extends UIState {
  // Current editor (alias for activeEditor)
  currentEditor: EditorView;
  
  // Editor actions
  setActiveEditor: (editor: EditorView) => void;
  setCurrentEditor: (editor: EditorView) => void;
  
  // Sidebar actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  
  // Bottom panel actions
  toggleBottomPanel: () => void;
  setBottomPanelOpen: (open: boolean) => void;
  setBottomPanelHeight: (height: number) => void;
  
  // Theme actions
  setTheme: (theme: ThemeMode) => void;
  
  // Zoom actions
  setZoom: (editor: keyof UIState['zoom'], zoom: number) => void;
  zoomIn: (editor: keyof UIState['zoom']) => void;
  zoomOut: (editor: keyof UIState['zoom']) => void;
  resetZoom: (editor: keyof UIState['zoom']) => void;
  
  // Selection actions
  setSelectedTracks: (trackIds: string[]) => void;
  setSelectedClips: (clipIds: string[]) => void;
  setSelectedNotes: (noteIds: string[]) => void;
  addToSelection: (type: 'tracks' | 'clips' | 'notes', ids: string[]) => void;
  removeFromSelection: (type: 'tracks' | 'clips' | 'notes', ids: string[]) => void;
  clearSelection: () => void;
  
  // Dialog actions
  openDialog: (dialog: keyof DialogState) => void;
  closeDialog: (dialog: keyof DialogState) => void;
  toggleDialog: (dialog: keyof DialogState) => void;
  
  // Tool actions
  setActiveTool: (tool: EditorTool) => void;
  
  // Grid snap actions
  setGridSnap: (enabled: boolean) => void;
  setSnapValue: (value: SnapValue) => void;

  // Preferences actions
  setPreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
}

const defaultPreferences: UserPreferences = {
  showTooltips: true,
  displayWaveform: true,
  showNoteLabels: true,
  compactTrackButtons: false,
  sidebarOnRight: false,
  openLastProject: true,
  language: 'fr',
  autoSaveEnabled: true,
  autoSaveInterval: 5,
  smoothScroll: true,
  animateAudioFileProcessor: true,
  audioInterface: 'Web Audio API',
  sampleRate: 44100,
  bufferSize: 512,
  midiInterface: 'Web MIDI API',
  midiAutoQuantize: false,
  workingDirectory: '',
  vstDirectory: '',
  samplesDirectory: '',
};

const defaultSelection: SelectionState = {
  selectedTrackIds: [],
  selectedClipIds: [],
  selectedNoteIds: [],
  selectedAutomationPointIds: [],
  selectionRange: null,
};

const defaultDialogs: DialogState = {
  projectSettings: false,
  exportDialog: false,
  importDialog: false,
  saveDialog: false,
  openDialog: false,
  preferences: false,
  about: false,
  instrumentBrowser: false,
  sampleBrowser: false,
};

const defaultZoom = {
  horizontal: 1,
  vertical: 1,
  songEditor: 1,
  pianoRoll: 1,
  patternEditor: 1,
};

export const useUIStore = create<UIStoreState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        preferences: defaultPreferences,
        activeEditor: 'song' as EditorView,
        currentEditor: 'song' as EditorView,
        sidebarOpen: true,
        sidebarWidth: 250,
        bottomPanelOpen: true,
        bottomPanelHeight: 200,
        theme: 'dark' as ThemeMode,
        zoom: { ...defaultZoom },
        selection: { ...defaultSelection },
        clipboard: { type: null, data: null },
        dialogs: { ...defaultDialogs },
        activeTool: 'select' as EditorTool,
        gridSnap: { enabled: true, value: '1/4' as SnapValue },

        // Editor actions
        setActiveEditor: (editor) => set({ activeEditor: editor, currentEditor: editor }),
        setCurrentEditor: (editor) => set({ currentEditor: editor, activeEditor: editor }),

        // Sidebar actions
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        setSidebarOpen: (open) => set({ sidebarOpen: open }),
        setSidebarWidth: (width) => set({ sidebarWidth: Math.max(150, Math.min(500, width)) }),

        // Bottom panel actions
        toggleBottomPanel: () => set((state) => ({ bottomPanelOpen: !state.bottomPanelOpen })),
        setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),
        setBottomPanelHeight: (height) => set({ bottomPanelHeight: Math.max(100, Math.min(600, height)) }),

        // Theme actions
        setTheme: (theme) => set({ theme }),

        // Zoom actions
        setZoom: (editor, zoom) => set((state) => ({
          zoom: { ...state.zoom, [editor]: Math.max(0.1, Math.min(10, zoom)) },
        })),
        
        zoomIn: (editor) => set((state) => ({
          zoom: { ...state.zoom, [editor]: Math.min(10, state.zoom[editor] * 1.2) },
        })),
        
        zoomOut: (editor) => set((state) => ({
          zoom: { ...state.zoom, [editor]: Math.max(0.1, state.zoom[editor] / 1.2) },
        })),
        
        resetZoom: (editor) => set((state) => ({
          zoom: { ...state.zoom, [editor]: 1 },
        })),

        // Selection actions
        setSelectedTracks: (trackIds) => set((state) => ({
          selection: { ...state.selection, selectedTrackIds: trackIds },
        })),
        
        setSelectedClips: (clipIds) => set((state) => ({
          selection: { ...state.selection, selectedClipIds: clipIds },
        })),
        
        setSelectedNotes: (noteIds) => set((state) => ({
          selection: { ...state.selection, selectedNoteIds: noteIds },
        })),
        
        addToSelection: (type, ids) => set((state) => {
          const key = type === 'tracks' ? 'selectedTrackIds' 
            : type === 'clips' ? 'selectedClipIds' 
            : 'selectedNoteIds';
          return {
            selection: {
              ...state.selection,
              [key]: [...new Set([...state.selection[key], ...ids])],
            },
          };
        }),
        
        removeFromSelection: (type, ids) => set((state) => {
          const key = type === 'tracks' ? 'selectedTrackIds' 
            : type === 'clips' ? 'selectedClipIds' 
            : 'selectedNoteIds';
          const idSet = new Set(ids);
          return {
            selection: {
              ...state.selection,
              [key]: state.selection[key].filter((id: string) => !idSet.has(id)),
            },
          };
        }),
        
        clearSelection: () => set({
          selection: { ...defaultSelection },
        }),

        // Dialog actions
        openDialog: (dialog) => set((state) => ({
          dialogs: { ...state.dialogs, [dialog]: true },
        })),
        
        closeDialog: (dialog) => set((state) => ({
          dialogs: { ...state.dialogs, [dialog]: false },
        })),
        
        toggleDialog: (dialog) => set((state) => ({
          dialogs: { ...state.dialogs, [dialog]: !state.dialogs[dialog] },
        })),

        // Tool actions
        setActiveTool: (tool) => {
          // Tool state would be managed here
          console.log('Setting active tool:', tool);
        },

        // Grid snap actions
        setGridSnap: (enabled) => {
          console.log('Setting grid snap:', enabled);
        },
        
        setSnapValue: (value) => {
          console.log('Setting snap value:', value);
        },

        // Preferences actions
        setPreference: (key, value) => set((state) => ({
          preferences: { ...state.preferences, [key]: value }
        })),

        setPreferences: (prefs) => set((state) => ({
          preferences: { ...state.preferences, ...prefs }
        })),
      }),
      {
        name: 'AnkhWaveStudio-web-ui',
        partialize: (state) => ({
          // Only persist certain UI preferences
          preferences: state.preferences,
          sidebarOpen: state.sidebarOpen,
          sidebarWidth: state.sidebarWidth,
          bottomPanelOpen: state.bottomPanelOpen,
          bottomPanelHeight: state.bottomPanelHeight,
          theme: state.theme,
          zoom: state.zoom,
        }),
      }
    ),
    { name: 'UIStore' }
  )
);

// Selector hooks
export const useActiveEditor = () => useUIStore((state) => state.activeEditor);
export const useSidebarOpen = () => useUIStore((state) => state.sidebarOpen);
export const useBottomPanelOpen = () => useUIStore((state) => state.bottomPanelOpen);
export const useTheme = () => useUIStore((state) => state.theme);
export const useZoom = (editor: keyof UIState['zoom']) => 
  useUIStore((state) => state.zoom[editor]);
export const useSelection = () => useUIStore((state) => state.selection);
export const useDialogs = () => useUIStore((state) => state.dialogs);