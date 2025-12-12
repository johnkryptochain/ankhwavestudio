// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Sequencer - Pattern sequencer for scheduling note events
 */

import type { MidiNote, TimeSignature } from '../types/audio';
import { Transport } from './Transport';

/**
 * Pattern data structure
 */
export interface Pattern {
  id: string;
  name: string;
  length: number; // in ticks
  notes: MidiNote[];
  timeSignature: TimeSignature;
}

/**
 * Scheduled note event
 */
interface ScheduledNote {
  note: MidiNote;
  patternId: string;
  scheduledTime: number;
  endTime: number;
  triggered: boolean;
  released: boolean;
}

/**
 * Note event callback
 */
export type NoteEventCallback = (
  type: 'noteOn' | 'noteOff',
  note: MidiNote,
  time: number
) => void;

/**
 * Pattern change callback
 */
export type PatternChangeCallback = (patternId: string, position: number) => void;

/**
 * Quantization values in ticks (based on 480 PPQ)
 */
export const QUANTIZE_VALUES = {
  '1/1': 1920,
  '1/2': 960,
  '1/4': 480,
  '1/8': 240,
  '1/16': 120,
  '1/32': 60,
  '1/64': 30,
  '1/4T': 320,
  '1/8T': 160,
  '1/16T': 80
};

/**
 * Sequencer class for pattern playback and note scheduling
 */
export class Sequencer {
  private audioContext: AudioContext;
  private transport: Transport;
  
  // Patterns
  private patterns: Map<string, Pattern> = new Map();
  private currentPatternId: string | null = null;
  private patternQueue: string[] = [];
  
  // Scheduling
  private scheduledNotes: ScheduledNote[] = [];
  private scheduleAheadTime: number = 0.1; // seconds
  private lastScheduledTick: number = -1;
  private schedulerRunning: boolean = false;
  private schedulerInterval: number | null = null;
  
  // Quantization
  private inputQuantize: number = 0; // 0 = off
  private outputQuantize: number = 0; // 0 = off
  
  // Callbacks
  private noteCallbacks: NoteEventCallback[] = [];
  private patternChangeCallbacks: PatternChangeCallback[] = [];

  constructor(audioContext: AudioContext, transport: Transport) {
    this.audioContext = audioContext;
    this.transport = transport;
    
    // Listen to transport events
    this.transport.onPlay(() => this.start());
    this.transport.onStop(() => this.stop());
    this.transport.onPause(() => this.pause());
    this.transport.onPositionChange((position) => this.onPositionChange(position));
  }

  /**
   * Create a new pattern
   */
  createPattern(id: string, name: string, length: number = 1920): Pattern {
    const pattern: Pattern = {
      id,
      name,
      length,
      notes: [],
      timeSignature: { numerator: 4, denominator: 4 }
    };
    this.patterns.set(id, pattern);
    return pattern;
  }

  /**
   * Get a pattern by ID
   */
  getPattern(id: string): Pattern | undefined {
    return this.patterns.get(id);
  }

  /**
   * Get all patterns
   */
  getAllPatterns(): Pattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Delete a pattern
   */
  deletePattern(id: string): boolean {
    if (this.currentPatternId === id) {
      this.currentPatternId = null;
    }
    return this.patterns.delete(id);
  }

  /**
   * Set the current pattern for playback
   */
  setCurrentPattern(id: string): boolean {
    if (!this.patterns.has(id)) {
      console.warn(`[Sequencer] Pattern not found: ${id}`);
      return false;
    }
    this.currentPatternId = id;
    this.lastScheduledTick = -1;
    const pattern = this.patterns.get(id);
    console.log(`[Sequencer] Set current pattern: ${id}, notes: ${pattern?.notes.length || 0}`);
    this.emitPatternChange(id, 0);
    return true;
  }

  /**
   * Get the current pattern
   */
  getCurrentPattern(): Pattern | null {
    return this.currentPatternId ? this.patterns.get(this.currentPatternId) || null : null;
  }

  /**
   * Queue a pattern to play next
   */
  queuePattern(id: string): void {
    if (this.patterns.has(id)) {
      this.patternQueue.push(id);
    }
  }

  /**
   * Clear the pattern queue
   */
  clearQueue(): void {
    this.patternQueue = [];
  }

  /**
   * Add a note to a pattern
   */
  addNote(patternId: string, note: MidiNote): boolean {
    const pattern = this.patterns.get(patternId);
    if (!pattern) {
      console.warn(`[Sequencer] Cannot add note - pattern not found: ${patternId}`);
      return false;
    }
    
    // Apply input quantization
    const quantizedNote = this.inputQuantize > 0
      ? { ...note, startTick: this.quantizeTick(note.startTick, this.inputQuantize) }
      : note;
    
    pattern.notes.push(quantizedNote);
    pattern.notes.sort((a, b) => a.startTick - b.startTick);
    console.log(`[Sequencer] Added note to pattern ${patternId}: pitch=${note.pitch}, tick=${note.startTick}, trackId=${note.trackId}`);
    return true;
  }

  /**
   * Remove a note from a pattern
   */
  removeNote(patternId: string, noteIndex: number): boolean {
    const pattern = this.patterns.get(patternId);
    if (!pattern || noteIndex < 0 || noteIndex >= pattern.notes.length) return false;
    pattern.notes.splice(noteIndex, 1);
    return true;
  }

  /**
   * Update a note in a pattern
   */
  updateNote(patternId: string, noteIndex: number, updates: Partial<MidiNote>): boolean {
    const pattern = this.patterns.get(patternId);
    if (!pattern || noteIndex < 0 || noteIndex >= pattern.notes.length) return false;
    pattern.notes[noteIndex] = { ...pattern.notes[noteIndex], ...updates };
    pattern.notes.sort((a, b) => a.startTick - b.startTick);
    return true;
  }

  /**
   * Get notes in a tick range
   */
  getNotesInRange(patternId: string, startTick: number, endTick: number): MidiNote[] {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return [];
    return pattern.notes.filter(note => 
      note.startTick >= startTick && note.startTick < endTick
    );
  }

  /**
   * Set input quantization
   */
  setInputQuantize(ticks: number): void {
    this.inputQuantize = ticks;
  }

  /**
   * Set output quantization
   */
  setOutputQuantize(ticks: number): void {
    this.outputQuantize = ticks;
  }

  /**
   * Quantize a tick value
   */
  quantizeTick(tick: number, quantize: number): number {
    if (quantize <= 0) return tick;
    return Math.round(tick / quantize) * quantize;
  }

  /**
   * Start the sequencer
   */
  private start(): void {
    if (this.schedulerRunning) return;
    this.schedulerRunning = true;
    this.lastScheduledTick = this.transport.getPosition() - 1;
    this.startScheduler();
  }

  /**
   * Stop the sequencer
   */
  private stop(): void {
    this.schedulerRunning = false;
    this.stopScheduler();
    this.releaseAllNotes();
    this.scheduledNotes = [];
    this.lastScheduledTick = -1;
  }

  /**
   * Pause the sequencer
   */
  private pause(): void {
    this.schedulerRunning = false;
    this.stopScheduler();
    // Release all currently playing notes when pausing
    this.releaseAllNotes();
    this.scheduledNotes = [];
  }

  /**
   * Public method to stop all notes immediately
   */
  public stopAllNotes(): void {
    this.releaseAllNotes();
    this.scheduledNotes = [];
  }

  /**
   * Handle position change
   */
  private onPositionChange(position: number): void {
    // If position jumped back (e.g. loop), reset lastScheduledTick
    if (position < this.lastScheduledTick) {
      this.lastScheduledTick = position - 1;
    }

    // Check for pattern loop/switch
    const pattern = this.getCurrentPattern();
    if (pattern && position >= pattern.length) {
      // Check if there's a queued pattern
      if (this.patternQueue.length > 0) {
        const nextPatternId = this.patternQueue.shift()!;
        this.setCurrentPattern(nextPatternId);
      }
    }
  }

  /**
   * Start the scheduler loop
   */
  private startScheduler(): void {
    if (this.schedulerInterval !== null) return;
    
    console.log('[Sequencer] Starting scheduler');
    
    // Log initial state
    const initialPattern = this.getCurrentPattern();
    console.log(`[Sequencer] Initial pattern: ${initialPattern?.id || 'none'}, notes: ${initialPattern?.notes.length || 0}`);
    
    const scheduleNotes = () => {
      if (!this.schedulerRunning) return;
      
      const pattern = this.getCurrentPattern();
      if (!pattern) {
        return;
      }
      
      const currentTime = this.audioContext.currentTime;
      const currentTick = this.transport.getPosition();
      const scheduleAheadTicks = this.transport.secondsToTicks(this.scheduleAheadTime);
      const endTick = currentTick + scheduleAheadTicks;
      
      // Schedule notes that fall within the look-ahead window
      for (const note of pattern.notes) {
        const noteTick = note.startTick;
        
        // Check if this note tick falls within the scheduling window
        // and hasn't been scheduled yet
        if (noteTick > this.lastScheduledTick && noteTick <= endTick) {
          // Apply output quantization
          const scheduleTick = this.outputQuantize > 0
            ? this.quantizeTick(noteTick, this.outputQuantize)
            : noteTick;
          
          const noteOnTime = currentTime + this.transport.ticksToSeconds(scheduleTick - currentTick);
          const noteOffTime = noteOnTime + this.transport.ticksToSeconds(note.duration);
          
          // Only schedule if noteOnTime is in the future
          if (noteOnTime >= currentTime) {
            // Schedule the note
            this.scheduleNote(note, pattern.id, noteOnTime, noteOffTime);
          }
        }
      }
      
      this.lastScheduledTick = endTick;
      
      // Process scheduled notes
      this.processScheduledNotes(currentTime);
    };
    
    this.schedulerInterval = window.setInterval(scheduleNotes, 25);
  }

  /**
   * Stop the scheduler loop
   */
  private stopScheduler(): void {
    if (this.schedulerInterval !== null) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /**
   * Schedule a note for playback
   */
  private scheduleNote(note: MidiNote, patternId: string, noteOnTime: number, noteOffTime: number): void {
    this.scheduledNotes.push({
      note,
      patternId,
      scheduledTime: noteOnTime,
      endTime: noteOffTime,
      triggered: false,
      released: false
    });
  }

  /**
   * Process scheduled notes
   */
  private processScheduledNotes(currentTime: number): void {
    for (const scheduled of this.scheduledNotes) {
      // Trigger note on
      if (!scheduled.triggered && currentTime >= scheduled.scheduledTime - 0.01) {
        scheduled.triggered = true;
        this.emitNoteEvent('noteOn', scheduled.note, scheduled.scheduledTime);
      }
      
      // Trigger note off
      if (!scheduled.released && currentTime >= scheduled.endTime - 0.01) {
        scheduled.released = true;
        this.emitNoteEvent('noteOff', scheduled.note, scheduled.endTime);
      }
    }
    
    // Clean up old notes
    this.scheduledNotes = this.scheduledNotes.filter(s => !s.released);
  }

  /**
   * Release all currently playing notes
   */
  private releaseAllNotes(): void {
    const currentTime = this.audioContext.currentTime;
    for (const scheduled of this.scheduledNotes) {
      if (scheduled.triggered && !scheduled.released) {
        this.emitNoteEvent('noteOff', scheduled.note, currentTime);
      }
    }
  }

  /**
   * Register a note event callback
   */
  onNoteEvent(callback: NoteEventCallback): () => void {
    this.noteCallbacks.push(callback);
    return () => {
      const index = this.noteCallbacks.indexOf(callback);
      if (index !== -1) this.noteCallbacks.splice(index, 1);
    };
  }

  /**
   * Register a pattern change callback
   */
  onPatternChange(callback: PatternChangeCallback): () => void {
    this.patternChangeCallbacks.push(callback);
    return () => {
      const index = this.patternChangeCallbacks.indexOf(callback);
      if (index !== -1) this.patternChangeCallbacks.splice(index, 1);
    };
  }

  /**
   * Emit a note event
   */
  private emitNoteEvent(type: 'noteOn' | 'noteOff', note: MidiNote, time: number): void {
    for (const callback of this.noteCallbacks) {
      try { callback(type, note, time); } catch (e) { console.error('Note callback error:', e); }
    }
  }

  /**
   * Emit a pattern change event
   */
  private emitPatternChange(patternId: string, position: number): void {
    for (const callback of this.patternChangeCallbacks) {
      try { callback(patternId, position); } catch (e) { console.error('Pattern change callback error:', e); }
    }
  }

  /**
   * Import pattern from MIDI-like data
   */
  importPattern(id: string, name: string, notes: MidiNote[], length?: number): Pattern {
    const maxEndTick = notes.reduce((max, note) => Math.max(max, note.startTick + note.duration), 0);
    const patternLength = length || Math.ceil(maxEndTick / 1920) * 1920;
    
    const pattern = this.createPattern(id, name, patternLength);
    pattern.notes = [...notes].sort((a, b) => a.startTick - b.startTick);
    return pattern;
  }

  /**
   * Export pattern to MIDI-like data
   */
  exportPattern(patternId: string): { notes: MidiNote[]; length: number } | null {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return null;
    return { notes: [...pattern.notes], length: pattern.length };
  }

  /**
   * Clone a pattern
   */
  clonePattern(sourceId: string, newId: string, newName?: string): Pattern | null {
    const source = this.patterns.get(sourceId);
    if (!source) return null;
    
    const clone = this.createPattern(newId, newName || `${source.name} (copy)`, source.length);
    clone.notes = source.notes.map(note => ({ ...note }));
    clone.timeSignature = { ...source.timeSignature };
    return clone;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stop();
    this.patterns.clear();
    this.noteCallbacks = [];
    this.patternChangeCallbacks = [];
  }
}