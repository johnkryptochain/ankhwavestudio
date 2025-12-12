// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Track Commands - Commands for track operations in the song editor
 */

import { BaseCommand, Command, generateCommandId } from './Command';
import type { Track, Clip } from '../../types/song';

// Store reference type - will be set by the store
type TrackStore = {
  getTracks: () => Track[];
  getTrack: (trackId: string) => Track | undefined;
  addTrack: (track: Track) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  moveTrack: (trackId: string, newIndex: number) => void;
  addClip: (trackId: string, clip: Clip) => void;
  removeClip: (trackId: string, clipId: string) => void;
  updateClip: (trackId: string, clipId: string, updates: Partial<Clip>) => void;
};

let trackStore: TrackStore | null = null;

/**
 * Set the track store reference for commands to use
 */
export function setTrackStore(store: TrackStore): void {
  trackStore = store;
}

/**
 * Command to add a new track
 */
export class AddTrackCommand extends BaseCommand {
  private track: Track;
  
  constructor(track: Track) {
    super(`Add track "${track.name}"`);
    this.track = { ...track };
  }
  
  execute(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.addTrack(this.track);
  }
  
  undo(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.removeTrack(this.track.id);
  }
}

/**
 * Command to delete a track
 */
export class DeleteTrackCommand extends BaseCommand {
  private track: Track;
  private index: number;
  
  constructor(track: Track, index: number) {
    super(`Delete track "${track.name}"`);
    this.track = { ...track, clips: track.clips.map(c => ({ ...c })) };
    this.index = index;
  }
  
  execute(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.removeTrack(this.track.id);
  }
  
  undo(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.addTrack(this.track);
    // Restore position
    trackStore.moveTrack(this.track.id, this.index);
  }
}

/**
 * Command to rename a track
 */
export class RenameTrackCommand extends BaseCommand {
  private trackId: string;
  private oldName: string;
  private newName: string;
  
  constructor(trackId: string, oldName: string, newName: string) {
    super(`Rename track to "${newName}"`);
    this.trackId = trackId;
    this.oldName = oldName;
    this.newName = newName;
  }
  
  execute(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.updateTrack(this.trackId, { name: this.newName });
  }
  
  undo(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.updateTrack(this.trackId, { name: this.oldName });
  }
}

/**
 * Command to move a track to a new position
 */
export class MoveTrackCommand extends BaseCommand {
  private trackId: string;
  private oldIndex: number;
  private newIndex: number;
  
  constructor(trackId: string, oldIndex: number, newIndex: number) {
    super(`Move track`);
    this.trackId = trackId;
    this.oldIndex = oldIndex;
    this.newIndex = newIndex;
  }
  
  execute(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.moveTrack(this.trackId, this.newIndex);
  }
  
  undo(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.moveTrack(this.trackId, this.oldIndex);
  }
}

/**
 * Command to change track volume
 */
export class ChangeTrackVolumeCommand extends BaseCommand {
  private trackId: string;
  private oldVolume: number;
  private newVolume: number;
  
  constructor(trackId: string, oldVolume: number, newVolume: number) {
    super(`Change track volume`);
    this.trackId = trackId;
    this.oldVolume = oldVolume;
    this.newVolume = newVolume;
  }
  
  execute(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.updateTrack(this.trackId, { volume: this.newVolume });
  }
  
  undo(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.updateTrack(this.trackId, { volume: this.oldVolume });
  }
  
  canMergeWith(other: Command): boolean {
    return (
      other instanceof ChangeTrackVolumeCommand &&
      other.trackId === this.trackId &&
      other.timestamp - this.timestamp < 100
    );
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof ChangeTrackVolumeCommand)) return this;
    return new ChangeTrackVolumeCommand(this.trackId, this.oldVolume, other.newVolume);
  }
}

/**
 * Command to change track pan
 */
export class ChangeTrackPanCommand extends BaseCommand {
  private trackId: string;
  private oldPan: number;
  private newPan: number;
  
  constructor(trackId: string, oldPan: number, newPan: number) {
    super(`Change track pan`);
    this.trackId = trackId;
    this.oldPan = oldPan;
    this.newPan = newPan;
  }
  
  execute(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.updateTrack(this.trackId, { pan: this.newPan });
  }
  
  undo(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.updateTrack(this.trackId, { pan: this.oldPan });
  }
  
  canMergeWith(other: Command): boolean {
    return (
      other instanceof ChangeTrackPanCommand &&
      other.trackId === this.trackId &&
      other.timestamp - this.timestamp < 100
    );
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof ChangeTrackPanCommand)) return this;
    return new ChangeTrackPanCommand(this.trackId, this.oldPan, other.newPan);
  }
}

/**
 * Command to toggle track mute
 */
export class ToggleTrackMuteCommand extends BaseCommand {
  private trackId: string;
  private wasMuted: boolean;
  
  constructor(trackId: string, wasMuted: boolean) {
    super(wasMuted ? 'Unmute track' : 'Mute track');
    this.trackId = trackId;
    this.wasMuted = wasMuted;
  }
  
  execute(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.updateTrack(this.trackId, { muted: !this.wasMuted });
  }
  
  undo(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.updateTrack(this.trackId, { muted: this.wasMuted });
  }
}

/**
 * Command to toggle track solo
 */
export class ToggleTrackSoloCommand extends BaseCommand {
  private trackId: string;
  private wasSoloed: boolean;
  
  constructor(trackId: string, wasSoloed: boolean) {
    super(wasSoloed ? 'Unsolo track' : 'Solo track');
    this.trackId = trackId;
    this.wasSoloed = wasSoloed;
  }
  
  execute(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.updateTrack(this.trackId, { solo: !this.wasSoloed });
  }
  
  undo(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.updateTrack(this.trackId, { solo: this.wasSoloed });
  }
}

/**
 * Command to change track color
 */
export class ChangeTrackColorCommand extends BaseCommand {
  private trackId: string;
  private oldColor: string;
  private newColor: string;
  
  constructor(trackId: string, oldColor: string, newColor: string) {
    super(`Change track color`);
    this.trackId = trackId;
    this.oldColor = oldColor;
    this.newColor = newColor;
  }
  
  execute(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.updateTrack(this.trackId, { color: this.newColor });
  }
  
  undo(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.updateTrack(this.trackId, { color: this.oldColor });
  }
}

/**
 * Command to add a clip to a track
 */
export class AddClipCommand extends BaseCommand {
  private trackId: string;
  private clip: Clip;
  
  constructor(trackId: string, clip: Clip) {
    super(`Add clip "${clip.name}"`);
    this.trackId = trackId;
    this.clip = { ...clip };
  }
  
  execute(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.addClip(this.trackId, this.clip);
  }
  
  undo(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.removeClip(this.trackId, this.clip.id);
  }
}

/**
 * Command to delete a clip from a track
 */
export class DeleteClipCommand extends BaseCommand {
  private trackId: string;
  private clip: Clip;
  
  constructor(trackId: string, clip: Clip) {
    super(`Delete clip "${clip.name}"`);
    this.trackId = trackId;
    this.clip = { ...clip };
  }
  
  execute(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.removeClip(this.trackId, this.clip.id);
  }
  
  undo(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.addClip(this.trackId, this.clip);
  }
}

/**
 * Command to move a clip
 */
export class MoveClipCommand extends BaseCommand {
  private trackId: string;
  private clipId: string;
  private oldStartTick: number;
  private newStartTick: number;
  
  constructor(trackId: string, clipId: string, oldStartTick: number, newStartTick: number) {
    super(`Move clip`);
    this.trackId = trackId;
    this.clipId = clipId;
    this.oldStartTick = oldStartTick;
    this.newStartTick = newStartTick;
  }
  
  execute(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.updateClip(this.trackId, this.clipId, { startTick: this.newStartTick });
  }
  
  undo(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.updateClip(this.trackId, this.clipId, { startTick: this.oldStartTick });
  }
  
  canMergeWith(other: Command): boolean {
    return (
      other instanceof MoveClipCommand &&
      other.clipId === this.clipId &&
      other.timestamp - this.timestamp < 100
    );
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof MoveClipCommand)) return this;
    return new MoveClipCommand(this.trackId, this.clipId, this.oldStartTick, other.newStartTick);
  }
}

/**
 * Command to resize a clip
 */
export class ResizeClipCommand extends BaseCommand {
  private trackId: string;
  private clipId: string;
  private oldLength: number;
  private newLength: number;
  
  constructor(trackId: string, clipId: string, oldLength: number, newLength: number) {
    super(`Resize clip`);
    this.trackId = trackId;
    this.clipId = clipId;
    this.oldLength = oldLength;
    this.newLength = newLength;
  }
  
  execute(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.updateClip(this.trackId, this.clipId, { length: this.newLength });
  }
  
  undo(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    trackStore.updateClip(this.trackId, this.clipId, { length: this.oldLength });
  }
  
  canMergeWith(other: Command): boolean {
    return (
      other instanceof ResizeClipCommand &&
      other.clipId === this.clipId &&
      other.timestamp - this.timestamp < 100
    );
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof ResizeClipCommand)) return this;
    return new ResizeClipCommand(this.trackId, this.clipId, this.oldLength, other.newLength);
  }
}

/**
 * Command to duplicate a track
 */
export class DuplicateTrackCommand extends BaseCommand {
  private originalTrackId: string;
  private duplicatedTrack: Track | null = null;
  
  constructor(originalTrackId: string) {
    super(`Duplicate track`);
    this.originalTrackId = originalTrackId;
  }
  
  execute(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    const originalTrack = trackStore.getTrack(this.originalTrackId);
    if (!originalTrack) throw new Error('Original track not found');
    
    const newId = generateCommandId();
    this.duplicatedTrack = {
      ...originalTrack,
      id: newId,
      name: `${originalTrack.name} (Copy)`,
      clips: originalTrack.clips.map(clip => ({
        ...clip,
        id: generateCommandId(),
        trackId: newId,
      })),
    };
    
    trackStore.addTrack(this.duplicatedTrack);
  }
  
  undo(): void {
    if (!trackStore) throw new Error('Track store not initialized');
    if (this.duplicatedTrack) {
      trackStore.removeTrack(this.duplicatedTrack.id);
    }
  }
}