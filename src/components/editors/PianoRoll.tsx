// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * PianoRoll - MIDI note editor
 * Features: Note grid with piano keyboard, note drawing/editing/deleting,
 * velocity editing, note selection, quantize, scale highlighting, ghost notes,
 * note nudging with arrow keys, copy/paste, chord tool, step recording
 */

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Button, Slider, Knob } from '../common';
import { useTransportStore, useSongStore, useUIStore } from '../../stores';
import { useAudioContext } from '../../contexts/AudioContext';
import { getAudioEngineManager } from '../../audio/AudioEngineManager';
import { copyNotes, cutNotes, useClipboardStore, type NotesClipboardData, generatePasteId } from '../../stores/clipboardStore';
import { useHistoryStore } from '../../stores/historyStore';
import { MoveNotesCommand, AddNoteCommand, DeleteNotesCommand } from '../../utils/commands/NoteCommands';
import type { NoteWithId } from '../../utils/commands/NoteCommands';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [8, 7, 6, 5, 4, 3, 2, 1, 0];
const NOTE_HEIGHT = 16;
const BEAT_WIDTH = 40;

export interface MidiNote {
  id: string;
  pitch: number;
  startTick: number;
  duration: number;
  velocity: number;
}

// Stable empty arrays to prevent infinite re-renders when used as default props
const EMPTY_NOTES: MidiNote[] = [];
const EMPTY_GHOST_NOTES: MidiNote[] = [];

export interface PianoRollProps {
  /** Notes to display */
  notes?: MidiNote[];
  /** Ghost notes from other patterns */
  ghostNotes?: MidiNote[];
  /** Pattern ID */
  patternId?: string;
  /** Track ID for instrument preview */
  trackId?: string;
  /** Ticks per beat */
  ticksPerBeat?: number;
  /** Total length in ticks */
  totalLength?: number;
  /** Note change callback */
  onNoteChange?: (noteId: string, changes: Partial<MidiNote>) => void;
  /** Note add callback */
  onNoteAdd?: (note: Omit<MidiNote, 'id'>) => void;
  /** Note delete callback */
  onNoteDelete?: (noteId: string) => void;
  /** Note select callback */
  onNoteSelect?: (noteIds: string[]) => void;
  /** Additional CSS classes */
  className?: string;
}

type Tool = 'select' | 'draw' | 'erase' | 'chord' | 'stepRecord';

// Chord definitions: intervals from root note in semitones
const CHORD_TYPES: Record<string, { name: string; intervals: number[] }> = {
  'major': { name: 'Major', intervals: [0, 4, 7] },
  'minor': { name: 'Minor', intervals: [0, 3, 7] },
  'diminished': { name: 'Diminished', intervals: [0, 3, 6] },
  'augmented': { name: 'Augmented', intervals: [0, 4, 8] },
  'major7': { name: 'Major 7th', intervals: [0, 4, 7, 11] },
  'minor7': { name: 'Minor 7th', intervals: [0, 3, 7, 10] },
  'dominant7': { name: 'Dominant 7th', intervals: [0, 4, 7, 10] },
  'sus2': { name: 'Sus2', intervals: [0, 2, 7] },
  'sus4': { name: 'Sus4', intervals: [0, 5, 7] },
};

const SCALES: Record<string, number[]> = {
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Minor': [0, 2, 3, 5, 7, 8, 10],
  'Pentatonic': [0, 2, 4, 7, 9],
  'Blues': [0, 3, 5, 6, 7, 10],
  'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const SNAP_VALUES = [
  { label: '1/1', value: 4 },
  { label: '1/2', value: 2 },
  { label: '1/4', value: 1 },
  { label: '1/8', value: 0.5 },
  { label: '1/16', value: 0.25 },
  { label: '1/32', value: 0.125 },
];

// Computer keyboard to MIDI note mapping
// Lower row: A=C, W=C#, S=D, E=D#, D=E, F=F, T=F#, G=G, Y=G#, H=A, U=A#, J=B
// Upper row: K=C (next octave), O=C#, L=D, P=D#, ;=E
const KEY_TO_NOTE_OFFSET: Record<string, number> = {
  'a': 0,  // C
  'w': 1,  // C#
  's': 2,  // D
  'e': 3,  // D#
  'd': 4,  // E
  'f': 5,  // F
  't': 6,  // F#
  'g': 7,  // G
  'y': 8,  // G#
  'h': 9,  // A
  'u': 10, // A#
  'j': 11, // B
  'k': 12, // C (next octave)
  'o': 13, // C#
  'l': 14, // D
  'p': 15, // D#
  ';': 16, // E
};

interface NoteDragState {
  noteId: string;
  startX: number;
  startY: number;
  startTick: number;
  startPitch: number;
  mode: 'move' | 'resize';
}

export const PianoRoll = memo<PianoRollProps>(({
  notes = EMPTY_NOTES,
  ghostNotes = EMPTY_GHOST_NOTES,
  patternId,
  trackId,
  ticksPerBeat = 480,
  totalLength = 7680,
  onNoteChange,
  onNoteAdd,
  onNoteDelete,
  onNoteSelect,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  
  // Audio context for note preview
  const { isInitialized, engine } = useAudioContext();
  const previewOscRef = useRef<Map<number, { osc: OscillatorNode; gain: GainNode }>>(new Map());
  
  const [localNotes, setLocalNotes] = useState<MidiNote[]>(notes);
  const localNotesRef = useRef<MidiNote[]>(localNotes);
  
  // Clipboard and history stores
  const clipboardStore = useClipboardStore();
  const historyStore = useHistoryStore();
  
  // Transport store
  const { isPlaying, play, pause, stop, position } = useTransportStore();
  
  // Song store for track info
  const { tracks, updateTrack } = useSongStore();
  const track = tracks.find(t => t.id === trackId);

  // Keep ref in sync with state
  useEffect(() => {
    localNotesRef.current = localNotes;
  }, [localNotes]);

  // Sync localNotes with notes prop when it changes (for store-connected mode)
  useEffect(() => {
    // Only sync if we have callbacks (store-connected mode)
    if (onNoteAdd || onNoteChange || onNoteDelete) {
      setLocalNotes(notes);
    }
  }, [notes, onNoteAdd, onNoteChange, onNoteDelete]);

  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<Tool>('draw');
  const [snapValue, setSnapValue] = useState(1);
  const { zoom: uiZoom, setZoom: setUIZoom, preferences } = useUIStore();
  const pianoZoom = uiZoom.pianoRoll;
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(4 * 12 * NOTE_HEIGHT); // Start at middle C
  const [scale, setScale] = useState<string>('Chromatic');
  const [rootNote, setRootNote] = useState(0); // C
  const [showVelocity, setShowVelocity] = useState(true);
  const [dragState, setDragState] = useState<NoteDragState | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [playingNotes, setPlayingNotes] = useState<Set<number>>(new Set());

  const defaultVelocity = localNotes.some((n) => n.velocity <= 1) ? 100 / 127 : 100;

  const toVelocity127 = useCallback((velocity: number): number => {
    if (!Number.isFinite(velocity)) return 100;
    return velocity <= 1 ? velocity * 127 : velocity;
  }, []);

  const fromVelocity127 = useCallback(
    (velocity127: number, previousVelocity?: number): number => {
      const clamped = Math.max(1, Math.min(127, velocity127));
      const preferNormalized =
        (previousVelocity !== undefined && previousVelocity <= 1) || localNotes.some((n) => n.velocity <= 1);
      return preferNormalized ? clamped / 127 : clamped;
    },
    [localNotes]
  );
  
  // Chord tool state
  const [selectedChordType, setSelectedChordType] = useState<string>('major');
  const [showChordMenu, setShowChordMenu] = useState(false);
  const [chordMenuPosition, setChordMenuPosition] = useState<{ x: number; y: number; tick: number; pitch: number } | null>(null);

  // Step recording state
  const [stepRecordEnabled, setStepRecordEnabled] = useState(false);
  const [stepRecordPosition, setStepRecordPosition] = useState(0); // Position in ticks
  const [stepRecordOctave, setStepRecordOctave] = useState(4); // Current octave for computer keyboard input
  const [stepRecordHistory, setStepRecordHistory] = useState<string[]>([]); // Track note IDs for undo

  const pixelsPerBeat = BEAT_WIDTH * pianoZoom;
  const pixelsPerTick = pixelsPerBeat / ticksPerBeat;
  const totalBeats = totalLength / ticksPerBeat;

  // Make sure the grid is always long enough to contain existing notes.
  // (Some call sites may pass a short/default totalLength, causing notes to render "outside" the grid.)
  const contentLengthTicks = React.useMemo(() => {
    let maxEnd = Math.max(0, totalLength);
    for (const n of localNotes) {
      const end = (Number.isFinite(n.startTick) ? n.startTick : 0) + (Number.isFinite(n.duration) ? n.duration : 0);
      if (end > maxEnd) maxEnd = end;
    }
    for (const n of ghostNotes) {
      const end = (Number.isFinite(n.startTick) ? n.startTick : 0) + (Number.isFinite(n.duration) ? n.duration : 0);
      if (end > maxEnd) maxEnd = end;
    }
    // Add a larger pad so there's always space to scroll into (16 bars)
    return maxEnd + ticksPerBeat * 4 * 16;
  }, [totalLength, ticksPerBeat, localNotes, ghostNotes]);
  const contentBeats = contentLengthTicks / ticksPerBeat;

  const syncScrollFromViewport = useCallback(() => {
    const el = scrollViewportRef.current;
    if (!el) return;
    setScrollX(el.scrollLeft);
    setScrollY(el.scrollTop);
  }, []);

  // Apply programmatic scroll changes (arrow keys / initial position) to the native scrollbar viewport
  useEffect(() => {
    const el = scrollViewportRef.current;
    if (!el) return;
    if (Math.abs(el.scrollLeft - scrollX) > 0.5) el.scrollLeft = scrollX;
    if (Math.abs(el.scrollTop - scrollY) > 0.5) el.scrollTop = scrollY;
  }, [scrollX, scrollY]);

  // Ensure scroll positions remain valid when zoom/content changes
  useEffect(() => {
    const el = scrollViewportRef.current;
    if (!el) return;
    const gridHeight = 128 * NOTE_HEIGHT;
    const gridWidth = contentBeats * pixelsPerBeat;
    const maxLeft = Math.max(0, gridWidth - el.clientWidth);
    const maxTop = Math.max(0, gridHeight - el.clientHeight);
    if (el.scrollLeft > maxLeft) el.scrollLeft = maxLeft;
    if (el.scrollTop > maxTop) el.scrollTop = maxTop;
    syncScrollFromViewport();
  }, [pixelsPerBeat, contentBeats, syncScrollFromViewport]);

  // Note: Removed the sync useEffect that was causing infinite loops.
  // The component initializes localNotes from props in useState.
  // If parent needs to control notes, it should pass onNoteAdd/onNoteChange/onNoteDelete callbacks.

  // Check if note is in scale
  const isInScale = useCallback((pitch: number): boolean => {
    const scaleNotes = SCALES[scale];
    const noteInOctave = pitch % 12;
    const adjustedNote = (noteInOctave - rootNote + 12) % 12;
    return scaleNotes.includes(adjustedNote);
  }, [scale, rootNote]);

  // Check if key is black
  const isBlackKey = (note: string) => note.includes('#');

  // Snap tick to grid
  const snapToGrid = useCallback((tick: number): number => {
    const snapTicks = ticksPerBeat * snapValue;
    return Math.round(tick / snapTicks) * snapTicks;
  }, [ticksPerBeat, snapValue]);

  // Convert tick to X position
  const tickToX = useCallback((tick: number): number => {
    return tick * pixelsPerTick;
  }, [pixelsPerTick]);

  // Convert X position to tick
  const xToTick = useCallback((x: number): number => {
    return x / pixelsPerTick;
  }, [pixelsPerTick]);

  // Convert pitch to Y position
  const pitchToY = useCallback((pitch: number): number => {
    return (127 - pitch) * NOTE_HEIGHT;
  }, []);

  // Convert Y position to pitch
  const yToPitch = useCallback((y: number): number => {
    return 127 - Math.floor(y / NOTE_HEIGHT);
  }, []);

  // Convert MIDI note to frequency
  const midiToFrequency = useCallback((midi: number): number => {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }, []);

  // Handle piano key click - play note preview
  const handlePianoKeyClick = useCallback((pitch: number) => {
    setPlayingNotes(prev => {
      const next = new Set(prev);
      next.add(pitch);
      return next;
    });

    // Try to use the track's instrument for preview
    if (trackId && isInitialized) {
      try {
        const manager = getAudioEngineManager();
        if (manager.isInitialized()) {
          // Use the track's instrument for preview
          manager.playNotePreview(trackId, pitch, 100);
          
          // Stop the note after a short duration
          setTimeout(() => {
            manager.stopNotePreview(trackId, pitch);
            setPlayingNotes(p => {
              const n = new Set(p);
              n.delete(pitch);
              return n;
            });
          }, 500);
          return;
        }
      } catch (e) {
        // Fall through to fallback
        console.log('Track instrument preview not available, using fallback');
      }
    }

    // Fallback: Play audio preview using simple oscillator
    if (isInitialized && engine) {
      const context = engine.getContext();
      if (context) {
        // Stop any existing note at this pitch
        const existing = previewOscRef.current.get(pitch);
        if (existing) {
          try {
            existing.gain.gain.setValueAtTime(existing.gain.gain.value, context.currentTime);
            existing.gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.05);
            existing.osc.stop(context.currentTime + 0.1);
          } catch {}
          previewOscRef.current.delete(pitch);
        }

        // Create new oscillator for preview
        const osc = context.createOscillator();
        const gain = context.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(midiToFrequency(pitch), context.currentTime);
        
        // Quick attack, sustain, then release
        gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, context.currentTime + 0.01);
        gain.gain.linearRampToValueAtTime(0.2, context.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
        
        osc.connect(gain);
        gain.connect(context.destination);
        
        osc.start(context.currentTime);
        osc.stop(context.currentTime + 0.5);
        
        previewOscRef.current.set(pitch, { osc, gain });
        
        // Clean up after note ends
        setTimeout(() => {
          previewOscRef.current.delete(pitch);
          setPlayingNotes(p => {
            const n = new Set(p);
            n.delete(pitch);
            return n;
          });
        }, 500);
      }
    } else {
      // Fallback: just update visual state
      setTimeout(() => {
        setPlayingNotes(p => {
          const n = new Set(p);
          n.delete(pitch);
          return n;
        });
      }, 200);
    }
  }, [trackId, isInitialized, engine, midiToFrequency]);

  // Get selected notes
  const getSelectedNotes = useCallback((): MidiNote[] => {
    return localNotes.filter(n => selectedNoteIds.has(n.id));
  }, [localNotes, selectedNoteIds]);

  // Handle copy notes
  const handleCopyNotes = useCallback(() => {
    const selectedNotes = getSelectedNotes();
    if (selectedNotes.length === 0) return;
    
    copyNotes(selectedNotes as NoteWithId[], patternId || 'default');
  }, [getSelectedNotes, patternId]);

  // Handle cut notes
  const handleCutNotes = useCallback(() => {
    const selectedNotes = getSelectedNotes();
    if (selectedNotes.length === 0) return;
    
    cutNotes(selectedNotes as NoteWithId[], patternId || 'default');
    
    // Delete the selected notes
    selectedNotes.forEach(note => {
      if (onNoteDelete) {
        onNoteDelete(note.id);
      } else {
        setLocalNotes(prev => prev.filter(n => n.id !== note.id));
      }
    });
    setSelectedNoteIds(new Set());
  }, [getSelectedNotes, patternId, onNoteDelete]);

  // Handle paste notes
  const handlePasteNotes = useCallback((pasteAtTick?: number, pasteAtPitch?: number) => {
    const clipboardData = clipboardStore.getDataOfType<NotesClipboardData>('notes');
    if (!clipboardData) return;
    
    const { notes: clipboardNotes, minStartTick, minPitch } = clipboardData;
    
    // Calculate paste position - use provided position or current scroll position
    const targetTick = pasteAtTick ?? snapToGrid(xToTick(scrollX));
    const targetPitch = pasteAtPitch ?? yToPitch(scrollY + 200); // Roughly center of view
    
    // Calculate offsets
    const tickOffset = targetTick - minStartTick;
    const pitchOffset = targetPitch - minPitch;
    
    // Create new notes with new IDs and adjusted positions
    const newNotes: MidiNote[] = clipboardNotes.map(note => ({
      ...note,
      id: generatePasteId(),
      startTick: Math.max(0, note.startTick + tickOffset),
      pitch: Math.max(0, Math.min(127, note.pitch + pitchOffset)),
    }));
    
    // Add the new notes
    newNotes.forEach(note => {
      if (onNoteAdd) {
        onNoteAdd(note);
      } else {
        setLocalNotes(prev => [...prev, note]);
      }
    });
    
    // Select the pasted notes
    setSelectedNoteIds(new Set(newNotes.map(n => n.id)));
    
    // If it was a cut operation, clear the clipboard
    if (clipboardStore.isCut) {
      clipboardStore.clear();
    }
  }, [clipboardStore, snapToGrid, xToTick, scrollX, yToPitch, scrollY, onNoteAdd]);

  // Insert chord at position
  const insertChord = useCallback((tick: number, rootPitch: number, chordType: string) => {
    const chord = CHORD_TYPES[chordType];
    if (!chord) return;
    
    const duration = ticksPerBeat * snapValue;
    const velocity = defaultVelocity;
    
    const newNotes: MidiNote[] = chord.intervals.map(interval => ({
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pitch: Math.max(0, Math.min(127, rootPitch + interval)),
      startTick: tick,
      duration,
      velocity,
    }));
    
    // Add all chord notes
    newNotes.forEach(note => {
      if (onNoteAdd) {
        onNoteAdd(note);
      } else {
        setLocalNotes(prev => [...prev, note]);
      }
    });
    
    // Select the new chord notes
    setSelectedNoteIds(new Set(newNotes.map(n => n.id)));
    
    // Close chord menu
    setShowChordMenu(false);
    setChordMenuPosition(null);
  }, [ticksPerBeat, snapValue, onNoteAdd, defaultVelocity]);

  // Handle step record note insertion
  const handleStepRecordNote = useCallback((pitch: number) => {
    if (!stepRecordEnabled) return;
    
    // Clamp pitch to valid MIDI range
    const clampedPitch = Math.max(0, Math.min(127, pitch));
    
    // Create note at current step position
    const duration = ticksPerBeat * snapValue;
    const newNote: MidiNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pitch: clampedPitch,
      startTick: stepRecordPosition,
      duration,
      velocity: defaultVelocity,
    };
    
    // Add note to pattern
    if (onNoteAdd) {
      onNoteAdd(newNote);
    } else {
      setLocalNotes(prev => [...prev, newNote]);
    }
    
    // Track for undo
    setStepRecordHistory(prev => [...prev, newNote.id]);
    
    // Play preview of the note
    handlePianoKeyClick(clampedPitch);
    
    // Advance position by snap value (in ticks)
    const advanceTicks = ticksPerBeat * snapValue;
    setStepRecordPosition(prev => prev + advanceTicks);
  }, [stepRecordEnabled, stepRecordPosition, ticksPerBeat, snapValue, onNoteAdd, handlePianoKeyClick, defaultVelocity]);

  // Handle step record rest (advance without inserting note)
  const handleStepRecordRest = useCallback(() => {
    if (!stepRecordEnabled) return;
    const advanceTicks = ticksPerBeat * snapValue;
    setStepRecordPosition(prev => prev + advanceTicks);
  }, [stepRecordEnabled, ticksPerBeat, snapValue]);

  // Handle step record undo (go back one step and delete last note)
  const handleStepRecordUndo = useCallback(() => {
    if (!stepRecordEnabled || stepRecordHistory.length === 0) return;
    
    // Get the last note ID
    const lastNoteId = stepRecordHistory[stepRecordHistory.length - 1];
    
    // Delete the note
    if (onNoteDelete) {
      onNoteDelete(lastNoteId);
    } else {
      setLocalNotes(prev => prev.filter(n => n.id !== lastNoteId));
    }
    
    // Remove from history
    setStepRecordHistory(prev => prev.slice(0, -1));
    
    // Go back one step
    const advanceTicks = ticksPerBeat * snapValue;
    setStepRecordPosition(prev => Math.max(0, prev - advanceTicks));
  }, [stepRecordEnabled, stepRecordHistory, ticksPerBeat, snapValue, onNoteDelete]);

  // Toggle step recording mode
  const toggleStepRecord = useCallback(() => {
    setStepRecordEnabled(prev => {
      if (!prev) {
        // When enabling, reset position to 0 and clear history
        setStepRecordPosition(0);
        setStepRecordHistory([]);
      }
      return !prev;
    });
  }, []);

  // Handle grid click
  const handleGridClick = useCallback((e: React.MouseEvent) => {
    if (!gridRef.current) return;

    const viewport = scrollViewportRef.current;
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + (viewport?.scrollLeft ?? 0);
    const y = e.clientY - rect.top + (viewport?.scrollTop ?? 0);
    const tick = snapToGrid(xToTick(x));
    const pitch = yToPitch(y);

    if (pitch < 0 || pitch > 127) return;

    if (activeTool === 'draw') {
      const newNote: Omit<MidiNote, 'id'> = {
        pitch,
        startTick: tick,
        duration: ticksPerBeat * snapValue,
        velocity: defaultVelocity,
      };
      
      if (onNoteAdd) {
        onNoteAdd(newNote);
      } else {
        const noteWithId: MidiNote = {
          ...newNote,
          id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        setLocalNotes(prev => [...prev, noteWithId]);
      }
    } else if (activeTool === 'select') {
      setSelectedNoteIds(new Set());
    } else if (activeTool === 'chord') {
      // Show chord menu at click position
      setChordMenuPosition({
        x: e.clientX,
        y: e.clientY,
        tick,
        pitch,
      });
      setShowChordMenu(true);
    }
  }, [activeTool, snapToGrid, xToTick, yToPitch, ticksPerBeat, snapValue, onNoteAdd, defaultVelocity]);

  // Handle note click
  const handleNoteClick = useCallback((e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();

    if (activeTool === 'erase') {
      if (onNoteDelete) {
        onNoteDelete(noteId);
      } else {
        setLocalNotes(prev => prev.filter(n => n.id !== noteId));
      }
      return;
    }

    if (e.shiftKey) {
      setSelectedNoteIds(prev => {
        const next = new Set(prev);
        if (next.has(noteId)) {
          next.delete(noteId);
        } else {
          next.add(noteId);
        }
        return next;
      });
    } else {
      setSelectedNoteIds(new Set([noteId]));
    }
  }, [activeTool, onNoteDelete]);

  // Handle note drag start
  const handleNoteDragStart = useCallback((e: React.MouseEvent, noteId: string, mode: 'move' | 'resize') => {
    e.stopPropagation();
    e.preventDefault();

    const note = localNotes.find(n => n.id === noteId);
    if (!note) return;

    setDragState({
      noteId,
      startX: e.clientX,
      startY: e.clientY,
      startTick: note.startTick,
      startPitch: note.pitch,
      mode,
    });
  }, [localNotes]);

  // Handle mouse move for dragging
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;
      
      // Use ref to get current notes without adding to dependencies
      const note = localNotesRef.current.find(n => n.id === dragState.noteId);
      if (!note) return;

      if (dragState.mode === 'move') {
        const deltaTicks = deltaX / pixelsPerTick;
        const deltaPitch = -Math.round(deltaY / NOTE_HEIGHT);
        
        let newStartTick = Math.max(0, snapToGrid(dragState.startTick + deltaTicks));
        
        // Clamp to total length if provided
        if (totalLength) {
          newStartTick = Math.min(newStartTick, totalLength - note.duration);
        }

        const newPitch = Math.max(0, Math.min(127, dragState.startPitch + deltaPitch));

        const changes = { startTick: newStartTick, pitch: newPitch };
        
        if (onNoteChange) {
          onNoteChange(dragState.noteId, changes);
        } else {
          setLocalNotes(prev => prev.map(n =>
            n.id === dragState.noteId ? { ...n, ...changes } : n
          ));
        }
      } else if (dragState.mode === 'resize') {
        const deltaTicks = deltaX / pixelsPerTick;
        let newDuration = Math.max(ticksPerBeat * 0.25, snapToGrid(note.duration + deltaTicks));
        
        // Clamp to total length if provided
        if (totalLength) {
          newDuration = Math.min(newDuration, totalLength - note.startTick);
        }
        
        if (onNoteChange) {
          onNoteChange(dragState.noteId, { duration: newDuration });
        } else {
          setLocalNotes(prev => prev.map(n =>
            n.id === dragState.noteId ? { ...n, duration: newDuration } : n
          ));
        }
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, pixelsPerTick, snapToGrid, ticksPerBeat, onNoteChange]);

  // Handle velocity change
  const handleVelocityChange = useCallback(
    (noteId: string, velocity127: number) => {
      const clamped127 = Math.max(1, Math.min(127, velocity127));
      const current = localNotes.find((n) => n.id === noteId);
      const storedVelocity = fromVelocity127(clamped127, current?.velocity);

      if (onNoteChange) {
        onNoteChange(noteId, { velocity: storedVelocity });
      }

      setLocalNotes((prev) =>
        prev.map((n) =>
          n.id === noteId ? { ...n, velocity: fromVelocity127(clamped127, n.velocity) } : n
        )
      );
    },
    [localNotes, onNoteChange, fromVelocity127]
  );

  // Nudge selected notes
  const nudgeSelectedNotes = useCallback((deltaPitch: number, deltaTicks: number) => {
    if (selectedNoteIds.size === 0) return;
    
    const selectedNotes = localNotes.filter(n => selectedNoteIds.has(n.id));
    
    selectedNotes.forEach(note => {
      const newPitch = Math.max(0, Math.min(127, note.pitch + deltaPitch));
      const newStartTick = Math.max(0, note.startTick + deltaTicks);
      
      if (onNoteChange) {
        onNoteChange(note.id, { pitch: newPitch, startTick: newStartTick });
      } else {
        setLocalNotes(prev => prev.map(n =>
          n.id === note.id ? { ...n, pitch: newPitch, startTick: newStartTick } : n
        ));
      }
    });
  }, [selectedNoteIds, localNotes, onNoteChange]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent handling if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Step recording mode keyboard handling
      if (stepRecordEnabled) {
        const key = e.key.toLowerCase();
        
        // Octave change with Z/X
        if (key === 'z') {
          e.preventDefault();
          setStepRecordOctave(prev => Math.max(0, prev - 1));
          return;
        }
        if (key === 'x') {
          e.preventDefault();
          setStepRecordOctave(prev => Math.min(9, prev + 1));
          return;
        }
        
        // Space for rest (advance without note)
        if (e.key === ' ') {
          e.preventDefault();
          handleStepRecordRest();
          return;
        }
        
        // Backspace to undo last step
        if (e.key === 'Backspace') {
          e.preventDefault();
          handleStepRecordUndo();
          return;
        }
        
        // R to toggle step recording off
        if (key === 'r' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          toggleStepRecord();
          return;
        }
        
        // Check for note keys
        if (KEY_TO_NOTE_OFFSET.hasOwnProperty(key)) {
          e.preventDefault();
          const noteOffset = KEY_TO_NOTE_OFFSET[key];
          const pitch = (stepRecordOctave * 12) + noteOffset;
          handleStepRecordNote(pitch);
          return;
        }
        
        // Escape to exit step recording
        if (e.key === 'Escape') {
          e.preventDefault();
          setStepRecordEnabled(false);
          return;
        }
        
        return; // Don't process other shortcuts while step recording
      }

      // R to toggle step recording on
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleStepRecord();
        return;
      }

      // Delete selected notes
      if (e.key === 'Delete' || e.key === 'Backspace') {
        selectedNoteIds.forEach(noteId => {
          if (onNoteDelete) {
            onNoteDelete(noteId);
          } else {
            setLocalNotes(prev => prev.filter(n => n.id !== noteId));
          }
        });
        setSelectedNoteIds(new Set());
        return;
      }

      // Tool shortcuts
      if (e.key === 'd' && !e.ctrlKey && !e.metaKey) {
        setActiveTool('draw');
        return;
      }
      if (e.key === 'v' && !e.ctrlKey && !e.metaKey) {
        setActiveTool('select');
        return;
      }
      if (e.key === 'e' && !e.ctrlKey && !e.metaKey) {
        setActiveTool('erase');
        return;
      }
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey) {
        setActiveTool('chord');
        return;
      }

      // Select all (Ctrl+A)
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSelectedNoteIds(new Set(localNotes.map(n => n.id)));
        return;
      }

      // Copy (Ctrl+C)
      if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleCopyNotes();
        return;
      }

      // Cut (Ctrl+X)
      if (e.key === 'x' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleCutNotes();
        return;
      }

      // Paste (Ctrl+V)
      if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handlePasteNotes();
        return;
      }

      // Arrow key nudging
      if (selectedNoteIds.size > 0) {
        const snapTicks = ticksPerBeat * snapValue;
        const largeTickMove = ticksPerBeat * 4; // One bar
        const largePitchMove = 12; // One octave

        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            nudgeSelectedNotes(e.shiftKey ? largePitchMove : 1, 0);
            break;
          case 'ArrowDown':
            e.preventDefault();
            nudgeSelectedNotes(e.shiftKey ? -largePitchMove : -1, 0);
            break;
          case 'ArrowLeft':
            e.preventDefault();
            nudgeSelectedNotes(0, e.shiftKey ? -largeTickMove : -snapTicks);
            break;
          case 'ArrowRight':
            e.preventDefault();
            nudgeSelectedNotes(0, e.shiftKey ? largeTickMove : snapTicks);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteIds, localNotes, onNoteDelete, handleCopyNotes, handleCutNotes, handlePasteNotes, nudgeSelectedNotes, ticksPerBeat, snapValue, stepRecordEnabled, stepRecordOctave, handleStepRecordNote, handleStepRecordRest, handleStepRecordUndo, toggleStepRecord]);

  // Close chord menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showChordMenu) {
        setShowChordMenu(false);
        setChordMenuPosition(null);
      }
    };

    if (showChordMenu) {
      // Delay to prevent immediate close
      setTimeout(() => {
        window.addEventListener('click', handleClickOutside);
      }, 100);
    }

    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [showChordMenu]);

  // Cleanup preview oscillators on unmount
  useEffect(() => {
    return () => {
      previewOscRef.current.forEach(({ osc, gain }) => {
        try {
          osc.stop();
          osc.disconnect();
          gain.disconnect();
        } catch {}
      });
      previewOscRef.current.clear();
    };
  }, []);

  // Check if clipboard has notes
  const hasClipboardNotes = clipboardStore.hasDataOfType('notes');

  // Render piano keyboard
  const renderPianoKeyboard = () => {
    return (
      <div
        className="w-16 flex-shrink-0 bg-daw-bg-secondary border-r border-daw-border overflow-hidden"
        onWheel={(e) => {
          // Scroll the main viewport when hovering the keyboard
          if (e.ctrlKey || e.metaKey) return;
          const el = scrollViewportRef.current;
          if (!el) return;
          const absX = Math.abs(e.deltaX);
          const absY = Math.abs(e.deltaY);
          if (e.shiftKey || absX > absY) {
            const delta = e.shiftKey ? e.deltaY : e.deltaX;
            el.scrollLeft += delta;
          } else {
            el.scrollTop += e.deltaY;
          }
          e.preventDefault();
        }}
      >
        <div style={{ transform: `translateY(-${scrollY}px)` }}>
          {Array.from({ length: 128 }).map((_, i) => {
            const pitch = 127 - i;
            const octave = Math.floor(pitch / 12);
            const noteInOctave = pitch % 12;
            const noteName = NOTES[noteInOctave];
            const isBlack = isBlackKey(noteName);
            const isPlaying = playingNotes.has(pitch);
            const inScale = isInScale(pitch);

            return (
              <div
                key={pitch}
                className={`flex items-center justify-end pr-1 border-b border-daw-border cursor-pointer transition-colors ${
                  isPlaying
                    ? 'bg-daw-accent-primary'
                    : isBlack
                      ? 'bg-daw-bg-primary text-daw-text-muted hover:bg-daw-bg-surface'
                      : 'bg-daw-bg-surface text-daw-text-secondary hover:bg-daw-bg-elevated'
                } ${!inScale && scale !== 'Chromatic' ? 'opacity-50' : ''}`}
                style={{ height: NOTE_HEIGHT }}
                onClick={() => handlePianoKeyClick(pitch)}
              >
                {noteInOctave === 0 && (
                  <span className="text-xxs font-medium">C{octave}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render playhead
  const renderPlayhead = () => {
    const x = tickToX(position);
    
    return (
      <div
        className="absolute top-0 bottom-0 w-px bg-daw-accent-primary z-30 pointer-events-none"
        style={{ left: `${x}px`, height: '100%' }}
      >
        <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-daw-accent-primary transform rotate-45" />
      </div>
    );
  };

  // Render grid
  const renderGrid = () => {
    const gridWidth = contentBeats * pixelsPerBeat;
    const gridHeight = 128 * NOTE_HEIGHT;
    const octaveHeight = 12 * NOTE_HEIGHT;
    const octaveCount = Math.ceil(128 / 12);

    return (
      <div className="flex-1 min-w-0 min-h-0 relative">
        <div
          ref={scrollViewportRef}
          className="absolute inset-0 overflow-scroll bg-daw-bg-primary"
          onScroll={syncScrollFromViewport}
          onWheel={(e) => {
            // Ensure wheel always scrolls this viewport (some nested flex layouts / overlays can swallow native scrolling).
            if (e.ctrlKey || e.metaKey) return;
            const el = scrollViewportRef.current;
            if (!el) return;
            const absX = Math.abs(e.deltaX);
            const absY = Math.abs(e.deltaY);
            if (e.shiftKey || absX > absY) {
              const delta = e.shiftKey ? e.deltaY : e.deltaX;
              el.scrollLeft += delta;
            } else {
              el.scrollTop += e.deltaY;
            }
            e.preventDefault();
          }}
          style={{ 
            scrollbarWidth: 'auto', 
            scrollbarColor: 'var(--daw-text-muted) var(--daw-bg-primary)',
            scrollbarGutter: 'stable both-edges',
            scrollBehavior: preferences.smoothScroll ? 'smooth' : 'auto'
          } as React.CSSProperties}
        >
          <div
            ref={gridRef}
            className="relative cursor-crosshair"
            style={{ 
              minWidth: '100%', 
              minHeight: '100%',
              width: Math.max(gridWidth, 1), 
              height: Math.max(gridHeight, 1) 
            }}
            onClick={handleGridClick}
          >
          {/* Background octave bands (Ableton-like readability) */}
          {Array.from({ length: octaveCount }).map((_, octaveIndex) => {
            const top = octaveIndex * octaveHeight;
            const height = Math.min(octaveHeight, gridHeight - top);
            if (height <= 0) return null;

            return (
              <div
                key={`octave-band-${octaveIndex}`}
                className={`absolute left-0 ${octaveIndex % 2 === 0 ? 'bg-daw-bg-secondary' : ''}`}
                style={{ top, height, width: gridWidth }}
              />
            );
          })}

          {/* Horizontal lines (notes) */}
          {Array.from({ length: 128 }).map((_, i) => {
            const pitch = 127 - i;
            const noteInOctave = pitch % 12;
            void pitch;

            return (
              <div
                key={`row-${pitch}`}
                className={`absolute left-0 border-b ${
                  noteInOctave === 0 ? 'border-b-2 border-daw-border-light' : 'border-daw-border'
                }`}
                style={{
                  top: i * NOTE_HEIGHT,
                  height: NOTE_HEIGHT,
                  width: gridWidth,
                }}
              />
            );
          })}

          {/* Vertical lines (beats) */}
          {Array.from({ length: Math.ceil(contentBeats) + 1 }).map((_, beat) => (
            <div
              key={`beat-${beat}`}
              className={`absolute top-0 ${
                beat % 4 === 0 ? 'border-l-2 border-daw-border-light' : 'border-l border-daw-border'
              }`}
              style={{ left: beat * pixelsPerBeat, height: gridHeight }}
            />
          ))}

          {/* Step record position indicator */}
          {stepRecordEnabled && (
            <div
              className="absolute top-0 w-0.5 bg-daw-accent-warning z-20 pointer-events-none"
              style={{
                left: tickToX(stepRecordPosition),
                height: gridHeight,
              }}
            >
              {/* Triangle indicator at top */}
              <div
                className="absolute -top-1 -left-1.5 w-0 h-0"
                style={{
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '8px solid rgb(234, 179, 8)', // daw-accent-warning color
                }}
              />
            </div>
          )}

          {/* Ghost notes */}
          {ghostNotes.map((note) => (
            <div
              key={`ghost-${note.id}`}
              className="absolute bg-daw-text-muted/20 rounded-sm pointer-events-none"
              style={{
                top: pitchToY(note.pitch) + 1,
                left: tickToX(note.startTick),
                width: tickToX(note.duration) - 1,
                height: NOTE_HEIGHT - 2,
              }}
            />
          ))}

          {/* Playhead */}
          {renderPlayhead()}

          {/* Notes */}
          {localNotes.map((note) => {
            const isSelected = selectedNoteIds.has(note.id);
            const velocity127 = toVelocity127(note.velocity);
            const velocityBrightness = 0.45 + (velocity127 / 127) * 0.55;

            return (
              <div
                key={note.id}
                className={`absolute rounded-sm cursor-pointer transition-shadow ${
                  isSelected ? 'ring-2 ring-white shadow-lg z-10' : 'hover:brightness-110'
                }`}
                style={{
                  top: pitchToY(note.pitch) + 1,
                  left: tickToX(note.startTick),
                  width: Math.max(8, tickToX(note.duration) - 1),
                  height: NOTE_HEIGHT - 2,
                  backgroundColor: `rgba(59, 130, 246, ${velocityBrightness})`,
                }}
                onClick={(e) => handleNoteClick(e, note.id)}
                onMouseDown={(e) => handleNoteDragStart(e, note.id, 'move')}
              >
                {/* Note Label */}
                {preferences.showNoteLabels && (
                  <div className="absolute left-1 top-0 bottom-0 flex items-center text-[10px] text-white font-medium pointer-events-none select-none overflow-hidden whitespace-nowrap">
                    {NOTES[note.pitch % 12]}{Math.floor(note.pitch / 12) - 1}
                  </div>
                )}

                {/* Resize handle */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleNoteDragStart(e, note.id, 'resize');
                  }}
                />
              </div>
            );
          })}
          </div>
        </div>
      </div>
    );
  };

  // Render velocity lane
  const renderVelocityLane = () => {
    if (!showVelocity) return null;

    return (
      <div
        className="h-20 border-t border-daw-border bg-daw-bg-secondary flex"
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) return;
          const el = scrollViewportRef.current;
          if (!el) return;
          const absX = Math.abs(e.deltaX);
          const absY = Math.abs(e.deltaY);
          if (e.shiftKey || absX > absY) {
            const delta = e.shiftKey ? e.deltaY : e.deltaX;
            el.scrollLeft += delta;
          } else {
            el.scrollTop += e.deltaY;
          }
          e.preventDefault();
        }}
      >
        <div className="w-24 flex-shrink-0 flex items-center justify-center border-r border-daw-border px-2">
          <div className="text-xs leading-tight text-daw-text-secondary">
            <div>Vélocité</div>
            <div>de la note :</div>
          </div>
        </div>
        <div 
          className="flex-1 relative overflow-hidden cursor-crosshair"
          onMouseDown={(e) => {
            e.preventDefault();
            
            const rect = e.currentTarget.getBoundingClientRect();
            const containerLeft = rect.left;
            const containerTop = rect.top;
            const containerHeight = rect.height;
            
            const updateVelocityAtPoint = (clientX: number, clientY: number) => {
              // Calculate X relative to the scrolled content
              const x = clientX - containerLeft + scrollX;
              const tick = xToTick(x);
              
              // Calculate velocity from Y (0 at bottom, 127 at top)
              const y = clientY - containerTop;
              const normalizedY = 1 - (y / containerHeight);
              const velocity127 = Math.max(1, Math.min(127, Math.round(normalizedY * 127)));
              
              // Find note at this tick
              // We look for a note that overlaps this tick
              // Use ref to get latest notes if needed, but closure capture is usually fine for position
              const targetNote = localNotesRef.current.find(n => 
                tick >= n.startTick && tick < (n.startTick + (n.duration || ticksPerBeat))
              );
              
              if (targetNote) {
                handleVelocityChange(targetNote.id, velocity127);
              }
            };
            
            // Initial update
            updateVelocityAtPoint(e.clientX, e.clientY);
            
            const handleMove = (moveEvent: MouseEvent) => {
              updateVelocityAtPoint(moveEvent.clientX, moveEvent.clientY);
            };
            
            const handleUp = () => {
              window.removeEventListener('mousemove', handleMove);
              window.removeEventListener('mouseup', handleUp);
            };
            
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleUp);
          }}
        >
          <div
            className="absolute inset-0"
            style={{ transform: `translateX(-${scrollX}px)` }}
          >
            {localNotes.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-daw-text-muted">
                Aucune note
              </div>
            ) : (
            localNotes.map((note) => {
              const isSelected = selectedNoteIds.has(note.id);
              const x = tickToX(note.startTick);
              const height = (toVelocity127(note.velocity) / 127) * 100;

              return (
                <div
                  key={`vel-${note.id}`}
                  className={`absolute bottom-0 w-3 rounded-t transition-colors pointer-events-none ${
                    isSelected ? 'bg-white' : 'bg-[#8286ef]'
                  }`}
                  style={{
                    left: x,
                    height: `${height}%`,
                  }}
                />
              );
            }))}
          </div>
        </div>
      </div>
    );
  };

  // Render chord menu
  const renderChordMenu = () => {
    if (!showChordMenu || !chordMenuPosition) return null;

    return (
      <div
        className="fixed z-50 bg-daw-bg-elevated border border-daw-border rounded-lg shadow-xl py-1 min-w-[160px]"
        style={{
          left: chordMenuPosition.x,
          top: chordMenuPosition.y,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-1 text-xs text-daw-text-muted border-b border-daw-border mb-1">
          Insérer un accord
        </div>
        {Object.entries(CHORD_TYPES).map(([key, chord]) => (
          <button
            key={key}
            className={`w-full px-3 py-1.5 text-left text-sm hover:bg-daw-bg-surface transition-colors ${
              selectedChordType === key ? 'bg-daw-accent-primary/20 text-daw-accent-primary' : 'text-daw-text-primary'
            }`}
            onClick={() => {
              insertChord(chordMenuPosition.tick, chordMenuPosition.pitch, key);
            }}
          >
            {chord.name}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-daw-bg-primary ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-daw-border bg-daw-bg-secondary">
        {/* Transport controls */}
        <div className="flex items-center gap-1 border-r border-daw-border pr-2">
          <Button
            variant={isPlaying ? 'primary' : 'ghost'}
            size="sm"
            onClick={isPlaying ? pause : play}
            title={isPlaying ? 'Pause (Espace)' : 'Lecture (Espace)'}
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={stop}
            title="Arrêter (Espace)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </Button>
        </div>

        {/* Track Controls (Volume/Pan) */}
        {track && (
          <div className="flex items-center gap-2 border-r border-daw-border pr-2">
            <Knob
              value={track.volume}
              min={0}
              max={1}
              step={0.01}
              size="sm"
              label="Vol"
              onChange={(val) => updateTrack(track.id, { volume: val })}
            />
            <Knob
              value={track.pan}
              min={-1}
              max={1}
              step={0.01}
              size="sm"
              label="Pan"
              onChange={(val) => updateTrack(track.id, { pan: val })}
            />
          </div>
        )}

        {/* Tool selection */}
        <div className="flex items-center gap-1 border-r border-daw-border pr-2">
          <Button
            variant={activeTool === 'select' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTool('select')}
            title="Outil de sélection (V)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'draw' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTool('draw')}
            title="Outil de dessin (D)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'erase' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTool('erase')}
            title="Outil gomme (E)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'chord' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTool('chord')}
            title="Outil accord (C)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </Button>
          <Button
            variant={stepRecordEnabled ? 'primary' : 'ghost'}
            size="sm"
            onClick={toggleStepRecord}
            title="Enregistrement pas à pas (R)"
            className={stepRecordEnabled ? 'bg-daw-accent-warning hover:bg-daw-accent-warning/80' : ''}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l2 2" />
            </svg>
          </Button>
        </div>

        {/* Step recording controls (visible when step recording is active) */}
        {stepRecordEnabled && (
          <div className="flex items-center gap-2 border-r border-daw-border pr-2 bg-daw-accent-warning/10 px-2 py-1 rounded">
            <span className="text-xs text-daw-accent-warning font-medium">STEP REC</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStepRecordOctave(prev => Math.max(0, prev - 1))}
                title="Octave inférieure (Z)"
                className="px-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </Button>
              <span className="text-xs text-daw-text-primary font-mono min-w-[40px] text-center">
                Oct: {stepRecordOctave}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStepRecordOctave(prev => Math.min(9, prev + 1))}
                title="Octave supérieure (X)"
                className="px-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </Button>
            </div>
            <span className="text-xs text-daw-text-muted">|</span>
            <span className="text-xs text-daw-text-secondary font-mono">
              Pos: {(stepRecordPosition / ticksPerBeat).toFixed(2)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStepRecordPosition(0)}
              title="Réinitialiser la position"
              className="px-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
          </div>
        )}

        {/* Chord type selector (visible when chord tool is active) */}
        {activeTool === 'chord' && (
          <div className="flex items-center gap-2 border-r border-daw-border pr-2">
            <span className="text-xs text-daw-text-muted">Accord :</span>
            <select
              value={selectedChordType}
              onChange={(e) => setSelectedChordType(e.target.value)}
              className="bg-daw-bg-primary border border-daw-border rounded px-2 py-1 text-xs text-daw-text-primary"
            >
              {Object.entries(CHORD_TYPES).map(([key, chord]) => (
                <option key={key} value={key}>{chord.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Copy/Cut/Paste buttons */}
        <div className="flex items-center gap-1 border-r border-daw-border pr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyNotes}
            disabled={selectedNoteIds.size === 0}
            title="Copier (Ctrl+C)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCutNotes}
            disabled={selectedNoteIds.size === 0}
            title="Couper (Ctrl+X)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handlePasteNotes()}
            disabled={!hasClipboardNotes}
            title="Coller (Ctrl+V)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </Button>
        </div>

        {/* Snap */}
        <div className="flex items-center gap-2 border-r border-daw-border pr-2">
          <span className="text-xs text-daw-text-muted">Aligner :</span>
          <select
            value={snapValue}
            onChange={(e) => setSnapValue(Number(e.target.value))}
            className="bg-daw-bg-primary border border-daw-border rounded px-2 py-1 text-xs text-daw-text-primary"
          >
            {SNAP_VALUES.map(({ label, value }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Scale */}
        <div className="flex items-center gap-2 border-r border-daw-border pr-2">
          <span className="text-xs text-daw-text-muted">Gamme :</span>
          <select
            value={rootNote}
            onChange={(e) => setRootNote(Number(e.target.value))}
            className="bg-daw-bg-primary border border-daw-border rounded px-2 py-1 text-xs text-daw-text-primary"
          >
            {NOTES.map((note, i) => (
              <option key={i} value={i}>{note}</option>
            ))}
          </select>
          <select
            value={scale}
            onChange={(e) => setScale(e.target.value)}
            className="bg-daw-bg-primary border border-daw-border rounded px-2 py-1 text-xs text-daw-text-primary"
          >
            {Object.keys(SCALES).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-daw-text-muted">Zoom :</span>
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.25"
            value={pianoZoom}
            onChange={(e) => setUIZoom('pianoRoll', Number(e.target.value))}
            className="w-20 h-1 bg-daw-bg-surface rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="flex-1" />

        {/* Toggle velocity */}
        <Button
          variant={showVelocity ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setShowVelocity(!showVelocity)}
        >
          Vélocité
        </Button>

        <span className="text-xs text-daw-text-muted">
          {localNotes.length} note{localNotes.length !== 1 ? 's' : ''}
          {selectedNoteIds.size > 0 && ` (${selectedNoteIds.size} sélectionnée${selectedNoteIds.size !== 1 ? 's' : ''})`}
        </span>
      </div>

      {/* Piano roll content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {renderPianoKeyboard()}
        {renderGrid()}
      </div>

      {/* Velocity lane */}
      {renderVelocityLane()}

      {/* Chord menu */}
      {renderChordMenu()}
    </div>
  );
});

PianoRoll.displayName = 'PianoRoll';

export default PianoRoll;
