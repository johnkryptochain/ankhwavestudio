// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Note Commands - Commands for note operations in the piano roll
 */

import { BaseCommand, Command, CompoundCommand, generateCommandId } from './Command';
import type { MidiNote } from '../../types/audio';

/**
 * Extended MidiNote with ID for tracking
 */
export interface NoteWithId extends MidiNote {
  id: string;
}

// Store reference type - will be set by the store
type NoteStore = {
  getNotes: (patternId: string) => NoteWithId[];
  addNote: (patternId: string, note: NoteWithId) => void;
  removeNote: (patternId: string, noteId: string) => void;
  updateNote: (patternId: string, noteId: string, updates: Partial<NoteWithId>) => void;
  setNotes: (patternId: string, notes: NoteWithId[]) => void;
};

let noteStore: NoteStore | null = null;

/**
 * Set the note store reference for commands to use
 */
export function setNoteStore(store: NoteStore): void {
  noteStore = store;
}


/**
 * Command to add a single note
 */
export class AddNoteCommand extends BaseCommand {
  private patternId: string;
  private note: NoteWithId;
  
  constructor(patternId: string, note: NoteWithId) {
    super(`Add note ${note.pitch}`);
    this.patternId = patternId;
    this.note = { ...note };
  }
  
  execute(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    noteStore.addNote(this.patternId, this.note);
  }
  
  undo(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    noteStore.removeNote(this.patternId, this.note.id);
  }
  
  canMergeWith(other: Command): boolean {
    // Can merge consecutive note additions within 500ms
    return (
      other instanceof AddNoteCommand &&
      other.patternId === this.patternId &&
      other.timestamp - this.timestamp < 500
    );
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof AddNoteCommand)) return this;
    
    const compound = new CompoundCommand('Add multiple notes', [this, other]);
    return compound;
  }
}

/**
 * Command to delete a single note
 */
export class DeleteNoteCommand extends BaseCommand {
  private patternId: string;
  private note: NoteWithId;
  
  constructor(patternId: string, note: NoteWithId) {
    super(`Delete note ${note.pitch}`);
    this.patternId = patternId;
    this.note = { ...note };
  }
  
  execute(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    noteStore.removeNote(this.patternId, this.note.id);
  }
  
  undo(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    noteStore.addNote(this.patternId, this.note);
  }
}

/**
 * Command to delete multiple notes
 */
export class DeleteNotesCommand extends BaseCommand {
  private patternId: string;
  private notes: NoteWithId[];
  
  constructor(patternId: string, notes: NoteWithId[]) {
    super(`Delete ${notes.length} notes`);
    this.patternId = patternId;
    this.notes = notes.map(n => ({ ...n }));
  }
  
  execute(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    for (const note of this.notes) {
      noteStore.removeNote(this.patternId, note.id);
    }
  }
  
  undo(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    for (const note of this.notes) {
      noteStore.addNote(this.patternId, note);
    }
  }
}

/**
 * Command to move a note (change position and/or pitch)
 */
export class MoveNoteCommand extends BaseCommand {
  private patternId: string;
  private noteId: string;
  private oldPosition: { startTick: number; pitch: number };
  private newPosition: { startTick: number; pitch: number };
  
  constructor(
    patternId: string,
    noteId: string,
    oldPosition: { startTick: number; pitch: number },
    newPosition: { startTick: number; pitch: number }
  ) {
    super(`Move note to ${newPosition.pitch}`);
    this.patternId = patternId;
    this.noteId = noteId;
    this.oldPosition = { ...oldPosition };
    this.newPosition = { ...newPosition };
  }
  
  execute(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    noteStore.updateNote(this.patternId, this.noteId, this.newPosition);
  }
  
  undo(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    noteStore.updateNote(this.patternId, this.noteId, this.oldPosition);
  }
  
  canMergeWith(other: Command): boolean {
    // Merge consecutive moves of the same note within 100ms (dragging)
    return (
      other instanceof MoveNoteCommand &&
      other.noteId === this.noteId &&
      other.timestamp - this.timestamp < 100
    );
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof MoveNoteCommand)) return this;
    
    // Keep the original old position, use the new position from the other command
    return new MoveNoteCommand(
      this.patternId,
      this.noteId,
      this.oldPosition,
      other.newPosition
    );
  }
}

/**
 * Command to move multiple notes
 */
export class MoveNotesCommand extends BaseCommand {
  private patternId: string;
  private moves: Array<{
    noteId: string;
    oldPosition: { startTick: number; pitch: number };
    newPosition: { startTick: number; pitch: number };
  }>;
  
  constructor(
    patternId: string,
    moves: Array<{
      noteId: string;
      oldPosition: { startTick: number; pitch: number };
      newPosition: { startTick: number; pitch: number };
    }>
  ) {
    super(`Move ${moves.length} notes`);
    this.patternId = patternId;
    this.moves = moves.map(m => ({
      noteId: m.noteId,
      oldPosition: { ...m.oldPosition },
      newPosition: { ...m.newPosition },
    }));
  }
  
  execute(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    for (const move of this.moves) {
      noteStore.updateNote(this.patternId, move.noteId, move.newPosition);
    }
  }
  
  undo(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    for (const move of this.moves) {
      noteStore.updateNote(this.patternId, move.noteId, move.oldPosition);
    }
  }
}

/**
 * Command to resize a note (change duration)
 */
export class ResizeNoteCommand extends BaseCommand {
  private patternId: string;
  private noteId: string;
  private oldDuration: number;
  private newDuration: number;
  
  constructor(
    patternId: string,
    noteId: string,
    oldDuration: number,
    newDuration: number
  ) {
    super(`Resize note`);
    this.patternId = patternId;
    this.noteId = noteId;
    this.oldDuration = oldDuration;
    this.newDuration = newDuration;
  }
  
  execute(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    noteStore.updateNote(this.patternId, this.noteId, { duration: this.newDuration });
  }
  
  undo(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    noteStore.updateNote(this.patternId, this.noteId, { duration: this.oldDuration });
  }
  
  canMergeWith(other: Command): boolean {
    return (
      other instanceof ResizeNoteCommand &&
      other.noteId === this.noteId &&
      other.timestamp - this.timestamp < 100
    );
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof ResizeNoteCommand)) return this;
    
    return new ResizeNoteCommand(
      this.patternId,
      this.noteId,
      this.oldDuration,
      other.newDuration
    );
  }
}

/**
 * Command to change note velocity
 */
export class ChangeNoteVelocityCommand extends BaseCommand {
  private patternId: string;
  private noteId: string;
  private oldVelocity: number;
  private newVelocity: number;
  
  constructor(
    patternId: string,
    noteId: string,
    oldVelocity: number,
    newVelocity: number
  ) {
    super(`Change velocity to ${newVelocity}`);
    this.patternId = patternId;
    this.noteId = noteId;
    this.oldVelocity = oldVelocity;
    this.newVelocity = newVelocity;
  }
  
  execute(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    noteStore.updateNote(this.patternId, this.noteId, { velocity: this.newVelocity });
  }
  
  undo(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    noteStore.updateNote(this.patternId, this.noteId, { velocity: this.oldVelocity });
  }
}

/**
 * Command to quantize notes
 */
export class QuantizeNotesCommand extends BaseCommand {
  private patternId: string;
  private originalNotes: NoteWithId[];
  private quantizedNotes: NoteWithId[];
  
  constructor(
    patternId: string,
    originalNotes: NoteWithId[],
    quantizedNotes: NoteWithId[]
  ) {
    super(`Quantize ${originalNotes.length} notes`);
    this.patternId = patternId;
    this.originalNotes = originalNotes.map(n => ({ ...n }));
    this.quantizedNotes = quantizedNotes.map(n => ({ ...n }));
  }
  
  execute(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    noteStore.setNotes(this.patternId, this.quantizedNotes);
  }
  
  undo(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    noteStore.setNotes(this.patternId, this.originalNotes);
  }
}

/**
 * Command to transpose notes
 */
export class TransposeNotesCommand extends BaseCommand {
  private patternId: string;
  private noteIds: string[];
  private semitones: number;
  
  constructor(patternId: string, noteIds: string[], semitones: number) {
    super(`Transpose ${semitones > 0 ? '+' : ''}${semitones} semitones`);
    this.patternId = patternId;
    this.noteIds = [...noteIds];
    this.semitones = semitones;
  }
  
  execute(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    const notes = noteStore.getNotes(this.patternId);
    for (const noteId of this.noteIds) {
      const note = notes.find((n) => n.id === noteId);
      if (note) {
        const newPitch = Math.max(0, Math.min(127, note.pitch + this.semitones));
        noteStore.updateNote(this.patternId, noteId, { pitch: newPitch });
      }
    }
  }
  
  undo(): void {
    if (!noteStore) throw new Error('Note store not initialized');
    const notes = noteStore.getNotes(this.patternId);
    for (const noteId of this.noteIds) {
      const note = notes.find((n) => n.id === noteId);
      if (note) {
        const newPitch = Math.max(0, Math.min(127, note.pitch - this.semitones));
        noteStore.updateNote(this.patternId, noteId, { pitch: newPitch });
      }
    }
  }
}

/**
 * Helper function to create a note with a unique ID
 */
export function createNoteWithId(note: MidiNote): NoteWithId {
  return {
    ...note,
    id: generateCommandId(),
  };
}