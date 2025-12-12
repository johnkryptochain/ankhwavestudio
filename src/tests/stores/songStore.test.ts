// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Song Store Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useSongStore } from '../../stores/songStore';
import type { Track, Pattern } from '../../types/song';

describe('songStore', () => {
  // Reset store before each test
  beforeEach(() => {
    useSongStore.getState().newProject();
  });

  describe('Initial State', () => {
    it('should have default metadata', () => {
      const state = useSongStore.getState();
      expect(state.metadata.name).toBe('Projet sans titre');
      expect(state.metadata.author).toBe('');
      expect(state.metadata.version).toBe('1.0.0');
    });

    it('should have default settings', () => {
      const state = useSongStore.getState();
      expect(state.settings.tempo).toBe(120);
      expect(state.settings.timeSignature).toEqual({ numerator: 4, denominator: 4 });
      expect(state.settings.masterVolume).toBe(1.0);
    });

    it('should have empty tracks and patterns', () => {
      const state = useSongStore.getState();
      expect(state.tracks).toEqual([]);
      expect(state.patterns).toEqual([]);
    });

    it('should not be dirty initially', () => {
      const state = useSongStore.getState();
      expect(state.isDirty).toBe(false);
    });

    it('should have no selected track', () => {
      const state = useSongStore.getState();
      expect(state.selectedTrackId).toBeNull();
    });
  });

  describe('Metadata Actions', () => {
    it('should set project ID', () => {
      useSongStore.getState().setProjectId('test-project-123');
      expect(useSongStore.getState().projectId).toBe('test-project-123');
    });

    it('should update metadata', () => {
      useSongStore.getState().setMetadata({
        name: 'My Song',
        author: 'Test Author',
      });
      
      const state = useSongStore.getState();
      expect(state.metadata.name).toBe('My Song');
      expect(state.metadata.author).toBe('Test Author');
      expect(state.isDirty).toBe(true);
    });

    it('should update modifiedAt when metadata changes', () => {
      const beforeTime = new Date().toISOString();
      useSongStore.getState().setMetadata({ name: 'Updated' });
      const afterTime = new Date().toISOString();
      
      const modifiedAt = useSongStore.getState().metadata.modifiedAt;
      expect(modifiedAt >= beforeTime).toBe(true);
      expect(modifiedAt <= afterTime).toBe(true);
    });
  });

  describe('Settings Actions', () => {
    it('should set tempo', () => {
      useSongStore.getState().setTempo(140);
      expect(useSongStore.getState().settings.tempo).toBe(140);
      expect(useSongStore.getState().isDirty).toBe(true);
    });

    it('should clamp tempo to valid range', () => {
      useSongStore.getState().setTempo(10);
      expect(useSongStore.getState().settings.tempo).toBe(20);
      
      useSongStore.getState().setTempo(1500);
      expect(useSongStore.getState().settings.tempo).toBe(999);
    });

    it('should set time signature', () => {
      useSongStore.getState().setTimeSignature({ numerator: 3, denominator: 4 });
      expect(useSongStore.getState().settings.timeSignature).toEqual({
        numerator: 3,
        denominator: 4,
      });
    });

    it('should set master volume', () => {
      useSongStore.getState().setMasterVolume(0.8);
      expect(useSongStore.getState().settings.masterVolume).toBe(0.8);
    });

    it('should clamp master volume to valid range', () => {
      useSongStore.getState().setMasterVolume(-0.5);
      expect(useSongStore.getState().settings.masterVolume).toBe(0);
      
      useSongStore.getState().setMasterVolume(1.5);
      expect(useSongStore.getState().settings.masterVolume).toBe(1);
    });
  });

  describe('Track Actions', () => {
    const createTestTrack = (id: string, name: string): Track => ({
      id,
      type: 'instrument',
      name,
      color: '#ff0000',
      muted: false,
      solo: false,
      volume: 1,
      pan: 0,
      mixerChannelId: 'mixer-1',
      clips: [],
    });

    it('should add a track', () => {
      const track = createTestTrack('track-1', 'Track 1');
      useSongStore.getState().addTrack(track);
      
      expect(useSongStore.getState().tracks).toHaveLength(1);
      expect(useSongStore.getState().tracks[0]).toEqual(track);
      expect(useSongStore.getState().isDirty).toBe(true);
    });

    it('should remove a track', () => {
      const track1 = createTestTrack('track-1', 'Track 1');
      const track2 = createTestTrack('track-2', 'Track 2');
      
      useSongStore.getState().addTrack(track1);
      useSongStore.getState().addTrack(track2);
      useSongStore.getState().removeTrack('track-1');
      
      expect(useSongStore.getState().tracks).toHaveLength(1);
      expect(useSongStore.getState().tracks[0].id).toBe('track-2');
    });

    it('should update a track', () => {
      const track = createTestTrack('track-1', 'Track 1');
      useSongStore.getState().addTrack(track);
      
      useSongStore.getState().updateTrack('track-1', {
        name: 'Updated Track',
        muted: true,
      });
      
      const updatedTrack = useSongStore.getState().tracks[0];
      expect(updatedTrack.name).toBe('Updated Track');
      expect(updatedTrack.muted).toBe(true);
    });

    it('should move a track', () => {
      const track1 = createTestTrack('track-1', 'Track 1');
      const track2 = createTestTrack('track-2', 'Track 2');
      const track3 = createTestTrack('track-3', 'Track 3');
      
      useSongStore.getState().addTrack(track1);
      useSongStore.getState().addTrack(track2);
      useSongStore.getState().addTrack(track3);
      
      useSongStore.getState().moveTrack('track-3', 0);
      
      const tracks = useSongStore.getState().tracks;
      expect(tracks[0].id).toBe('track-3');
      expect(tracks[1].id).toBe('track-1');
      expect(tracks[2].id).toBe('track-2');
    });

    it('should duplicate a track', () => {
      const track = createTestTrack('track-1', 'Track 1');
      useSongStore.getState().addTrack(track);
      
      const newId = useSongStore.getState().duplicateTrack('track-1');
      
      expect(newId).toBeTruthy();
      expect(useSongStore.getState().tracks).toHaveLength(2);
      expect(useSongStore.getState().tracks[1].name).toBe('Track 1 (Copy)');
    });

    it('should return empty string when duplicating non-existent track', () => {
      const newId = useSongStore.getState().duplicateTrack('non-existent');
      expect(newId).toBe('');
    });

    it('should set selected track ID', () => {
      useSongStore.getState().setSelectedTrackId('track-1');
      expect(useSongStore.getState().selectedTrackId).toBe('track-1');
    });
  });

  describe('Pattern Actions', () => {
    const createTestPattern = (id: string, name: string): Pattern => ({
      id,
      name,
      length: 16,
      steps: [],
    });

    it('should add a pattern', () => {
      const pattern = createTestPattern('pattern-1', 'Pattern 1');
      useSongStore.getState().addPattern(pattern);
      
      expect(useSongStore.getState().patterns).toHaveLength(1);
      expect(useSongStore.getState().patterns[0]).toEqual(pattern);
    });

    it('should remove a pattern', () => {
      const pattern1 = createTestPattern('pattern-1', 'Pattern 1');
      const pattern2 = createTestPattern('pattern-2', 'Pattern 2');
      
      useSongStore.getState().addPattern(pattern1);
      useSongStore.getState().addPattern(pattern2);
      useSongStore.getState().removePattern('pattern-1');
      
      expect(useSongStore.getState().patterns).toHaveLength(1);
      expect(useSongStore.getState().patterns[0].id).toBe('pattern-2');
    });

    it('should update a pattern', () => {
      const pattern = createTestPattern('pattern-1', 'Pattern 1');
      useSongStore.getState().addPattern(pattern);
      
      useSongStore.getState().updatePattern('pattern-1', {
        name: 'Updated Pattern',
        length: 32,
      });
      
      const updatedPattern = useSongStore.getState().patterns[0];
      expect(updatedPattern.name).toBe('Updated Pattern');
      expect(updatedPattern.length).toBe(32);
    });
  });

  describe('Project Actions', () => {
    it('should create new project', () => {
      // Add some data first
      useSongStore.getState().setMetadata({ name: 'Test Project' });
      useSongStore.getState().addTrack({
        id: 'track-1',
        type: 'instrument',
        name: 'Track 1',
        color: '#ff0000',
        muted: false,
        solo: false,
        volume: 1,
        pan: 0,
        mixerChannelId: 'mixer-1',
        clips: [],
      });
      
      // Create new project
      useSongStore.getState().newProject();
      
      const state = useSongStore.getState();
      expect(state.metadata.name).toBe('Projet sans titre');
      expect(state.tracks).toEqual([]);
      expect(state.patterns).toEqual([]);
      expect(state.isDirty).toBe(false);
    });

    it('should load project data', () => {
      const projectData = {
        id: 'test-project-id',
        name: 'Loaded Project',
        version: '1.0.0',
        metadata: {
          name: 'Loaded Project',
          author: 'Test Author',
          description: 'Test description',
          createdAt: '2024-01-01T00:00:00.000Z',
          modifiedAt: '2024-01-01T00:00:00.000Z',
          version: '1.0.0',
        },
        song: {
          tempo: 140,
          timeSignature: { numerator: 4, denominator: 4 },
          masterVolume: 0.8,
          masterPitch: 0,
          length: 32,
        },
        tracks: [
          {
            id: 'track-1',
            type: 'instrument' as const,
            name: 'Loaded Track',
            color: '#00ff00',
            muted: false,
            solo: false,
            volume: 1,
            pan: 0,
            mixerChannelId: 'mixer-1',
            clips: [],
          },
        ],
        mixer: { channels: [], masterChannel: { id: 'master', name: 'Master', volume: 1, pan: 0, mute: false, solo: false, effects: [], sends: [] } },
        controllers: [],
        automation: [],
        patterns: [],
      };
      
      useSongStore.getState().loadProject(projectData);
      
      const state = useSongStore.getState();
      expect(state.metadata.name).toBe('Loaded Project');
      expect(state.settings.tempo).toBe(140);
      expect(state.tracks).toHaveLength(1);
      expect(state.isDirty).toBe(false);
    });

    it('should get project data', () => {
      useSongStore.getState().setMetadata({ name: 'Export Test' });
      useSongStore.getState().setTempo(150);
      
      const projectData = useSongStore.getState().getProjectData();
      
      expect(projectData.version).toBe('1.0.0');
      expect(projectData.metadata.name).toBe('Export Test');
      expect(projectData.song.tempo).toBe(150);
    });
  });

  describe('Dirty Flag', () => {
    it('should mark as dirty', () => {
      useSongStore.getState().markDirty();
      expect(useSongStore.getState().isDirty).toBe(true);
    });

    it('should mark as clean', () => {
      useSongStore.getState().markDirty();
      useSongStore.getState().markClean();
      expect(useSongStore.getState().isDirty).toBe(false);
    });
  });

  describe('Selector Hooks', () => {
    it('should provide tempo selector', () => {
      useSongStore.getState().setTempo(160);
      // In a real test with React, we'd use renderHook
      // For now, just verify the state
      expect(useSongStore.getState().settings.tempo).toBe(160);
    });

    it('should provide time signature selector', () => {
      useSongStore.getState().setTimeSignature({ numerator: 6, denominator: 8 });
      expect(useSongStore.getState().settings.timeSignature).toEqual({
        numerator: 6,
        denominator: 8,
      });
    });

    it('should provide tracks selector', () => {
      const track = {
        id: 'track-1',
        type: 'instrument' as const,
        name: 'Track 1',
        color: '#ff0000',
        muted: false,
        solo: false,
        volume: 1,
        pan: 0,
        mixerChannelId: 'mixer-1',
        clips: [],
      };
      useSongStore.getState().addTrack(track);
      expect(useSongStore.getState().tracks).toHaveLength(1);
    });
  });
});