// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Clipboard Store - Manages copy/paste functionality
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { MidiNote } from '../types/audio';
import type { Track, Clip, Pattern, PatternStep } from '../types/song';
import type { NoteWithId } from '../utils/commands/NoteCommands';

/**
 * Types of data that can be stored in the clipboard
 */
export type ClipboardDataType = 
  | 'notes'
  | 'clips'
  | 'tracks'
  | 'patterns'
  | 'patternSteps'
  | 'automation';

/**
 * Clipboard data for notes
 */
export interface NotesClipboardData {
  type: 'notes';
  notes: NoteWithId[];
  sourcePatternId: string;
  // Relative position info for pasting
  minStartTick: number;
  minPitch: number;
}

/**
 * Clipboard data for clips
 */
export interface ClipsClipboardData {
  type: 'clips';
  clips: Clip[];
  sourceTrackId: string;
  minStartTick: number;
}

/**
 * Clipboard data for tracks
 */
export interface TracksClipboardData {
  type: 'tracks';
  tracks: Track[];
}

/**
 * Clipboard data for patterns
 */
export interface PatternsClipboardData {
  type: 'patterns';
  patterns: Pattern[];
}

/**
 * Clipboard data for pattern steps
 */
export interface PatternStepsClipboardData {
  type: 'patternSteps';
  steps: PatternStep[];
  sourcePatternId: string;
  startIndex: number;
}

/**
 * Clipboard data for automation points
 */
export interface AutomationClipboardData {
  type: 'automation';
  points: Array<{ tick: number; value: number }>;
  minTick: number;
}

/**
 * Union type for all clipboard data
 */
export type ClipboardData = 
  | NotesClipboardData
  | ClipsClipboardData
  | TracksClipboardData
  | PatternsClipboardData
  | PatternStepsClipboardData
  | AutomationClipboardData;

interface ClipboardState {
  // Current clipboard data
  data: ClipboardData | null;
  
  // Timestamp of when data was copied
  copiedAt: number | null;
  
  // Whether the data was cut (should be removed from source on paste)
  isCut: boolean;
  
  // Actions
  copy: (data: ClipboardData) => void;
  cut: (data: ClipboardData) => void;
  clear: () => void;
  
  // Getters
  hasData: () => boolean;
  hasDataOfType: (type: ClipboardDataType) => boolean;
  getData: <T extends ClipboardData>() => T | null;
  getDataOfType: <T extends ClipboardData>(type: ClipboardDataType) => T | null;
}

export const useClipboardStore = create<ClipboardState>()(
  devtools(
    (set, get) => ({
      data: null,
      copiedAt: null,
      isCut: false,

      /**
       * Copy data to clipboard
       */
      copy: (data: ClipboardData) => {
        set({
          data,
          copiedAt: Date.now(),
          isCut: false,
        });
        
        // Also try to copy to system clipboard as JSON
        try {
          const jsonData = JSON.stringify({
            type: 'AnkhWaveStudio-web-clipboard',
            data,
          });
          navigator.clipboard.writeText(jsonData).catch(() => {
            // Silently fail if clipboard access is denied
          });
        } catch {
          // Ignore errors
        }
      },

      /**
       * Cut data to clipboard (mark for removal on paste)
       */
      cut: (data: ClipboardData) => {
        set({
          data,
          copiedAt: Date.now(),
          isCut: true,
        });
        
        // Also try to copy to system clipboard as JSON
        try {
          const jsonData = JSON.stringify({
            type: 'AnkhWaveStudio-web-clipboard',
            data,
            isCut: true,
          });
          navigator.clipboard.writeText(jsonData).catch(() => {
            // Silently fail if clipboard access is denied
          });
        } catch {
          // Ignore errors
        }
      },

      /**
       * Clear the clipboard
       */
      clear: () => {
        set({
          data: null,
          copiedAt: null,
          isCut: false,
        });
      },

      /**
       * Check if clipboard has any data
       */
      hasData: () => {
        return get().data !== null;
      },

      /**
       * Check if clipboard has data of a specific type
       */
      hasDataOfType: (type: ClipboardDataType) => {
        const data = get().data;
        return data !== null && data.type === type;
      },

      /**
       * Get clipboard data
       */
      getData: <T extends ClipboardData>() => {
        return get().data as T | null;
      },

      /**
       * Get clipboard data of a specific type
       */
      getDataOfType: <T extends ClipboardData>(type: ClipboardDataType) => {
        const data = get().data;
        if (data && data.type === type) {
          return data as T;
        }
        return null;
      },
    }),
    { name: 'ClipboardStore' }
  )
);

// Selector hooks
export const useClipboardData = () => useClipboardStore((state) => state.data);
export const useClipboardHasData = () => useClipboardStore((state) => state.data !== null);
export const useClipboardIsCut = () => useClipboardStore((state) => state.isCut);

/**
 * Helper function to copy notes to clipboard
 */
export function copyNotes(notes: NoteWithId[], sourcePatternId: string): void {
  if (notes.length === 0) return;
  
  const minStartTick = Math.min(...notes.map(n => n.startTick));
  const minPitch = Math.min(...notes.map(n => n.pitch));
  
  useClipboardStore.getState().copy({
    type: 'notes',
    notes: notes.map(n => ({ ...n })),
    sourcePatternId,
    minStartTick,
    minPitch,
  });
}

/**
 * Helper function to cut notes to clipboard
 */
export function cutNotes(notes: NoteWithId[], sourcePatternId: string): void {
  if (notes.length === 0) return;
  
  const minStartTick = Math.min(...notes.map(n => n.startTick));
  const minPitch = Math.min(...notes.map(n => n.pitch));
  
  useClipboardStore.getState().cut({
    type: 'notes',
    notes: notes.map(n => ({ ...n })),
    sourcePatternId,
    minStartTick,
    minPitch,
  });
}

/**
 * Helper function to copy clips to clipboard
 */
export function copyClips(clips: Clip[], sourceTrackId: string): void {
  if (clips.length === 0) return;
  
  const minStartTick = Math.min(...clips.map(c => c.startTick));
  
  useClipboardStore.getState().copy({
    type: 'clips',
    clips: clips.map(c => ({ ...c })),
    sourceTrackId,
    minStartTick,
  });
}

/**
 * Helper function to cut clips to clipboard
 */
export function cutClips(clips: Clip[], sourceTrackId: string): void {
  if (clips.length === 0) return;
  
  const minStartTick = Math.min(...clips.map(c => c.startTick));
  
  useClipboardStore.getState().cut({
    type: 'clips',
    clips: clips.map(c => ({ ...c })),
    sourceTrackId,
    minStartTick,
  });
}

/**
 * Helper function to copy tracks to clipboard
 */
export function copyTracks(tracks: Track[]): void {
  if (tracks.length === 0) return;
  
  useClipboardStore.getState().copy({
    type: 'tracks',
    tracks: tracks.map(t => ({
      ...t,
      clips: t.clips.map(c => ({ ...c })),
    })),
  });
}

/**
 * Helper function to copy patterns to clipboard
 */
export function copyPatterns(patterns: Pattern[]): void {
  if (patterns.length === 0) return;
  
  useClipboardStore.getState().copy({
    type: 'patterns',
    patterns: patterns.map(p => ({
      ...p,
      steps: p.steps.map(s => ({ ...s })),
    })),
  });
}

/**
 * Helper function to copy pattern steps to clipboard
 */
export function copyPatternSteps(
  steps: PatternStep[],
  sourcePatternId: string,
  startIndex: number
): void {
  if (steps.length === 0) return;
  
  useClipboardStore.getState().copy({
    type: 'patternSteps',
    steps: steps.map(s => ({ ...s })),
    sourcePatternId,
    startIndex,
  });
}

/**
 * Try to read clipboard data from system clipboard
 */
export async function readFromSystemClipboard(): Promise<ClipboardData | null> {
  try {
    const text = await navigator.clipboard.readText();
    const parsed = JSON.parse(text);
    
    if (parsed.type === 'AnkhWaveStudio-web-clipboard' && parsed.data) {
      return parsed.data as ClipboardData;
    }
  } catch {
    // Ignore errors - clipboard might not be accessible or contain non-JSON data
  }
  
  return null;
}

/**
 * Generate new IDs for pasted items
 */
export function generatePasteId(): string {
  return `paste-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}