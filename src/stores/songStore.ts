// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Song Store - Manages project/song state
 * Connected to Audio Engine for real-time audio updates
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  Track,
  InstrumentTrack,
  SampleTrack,
  Pattern,
  ProjectData,
  ProjectMetadata,
  SongSettings,
  MidiClip,
  AudioClip
} from '../types/song';
import type { TimeSignature, MidiNote } from '../types/audio';
import { getAudioEngineManager, AudioEngineManager } from '../audio/AudioEngineManager';
import { InstrumentType } from '../audio/InstrumentFactory';

// Helper to get audio engine manager (may be null if not initialized)
let audioEngineManager: AudioEngineManager | null = null;

const getManager = (): AudioEngineManager | null => {
  if (!audioEngineManager) {
    try {
      audioEngineManager = getAudioEngineManager();
    } catch {
      // Audio engine not initialized yet
      return null;
    }
  }
  return audioEngineManager;
};

export interface SongState {
  // Project metadata
  projectId: string | null;
  metadata: ProjectMetadata;
  
  // Song settings
  settings: SongSettings;
  
  // Tracks
  tracks: Track[];
  
  // Patterns
  patterns: Pattern[];
  
  // Selected track
  selectedTrackId: string | null;
  
  // Selected pattern
  selectedPatternId: string | null;
  
  // Dirty flag for unsaved changes
  isDirty: boolean;
  
  // Audio engine connected flag
  isAudioConnected: boolean;
  
  // Actions
  setProjectId: (id: string | null) => void;
  setSelectedTrackId: (trackId: string | null) => void;
  setSelectedPatternId: (patternId: string | null) => void;
  setMetadata: (metadata: Partial<ProjectMetadata>) => void;
  setTempo: (tempo: number) => void;
  setTimeSignature: (timeSignature: TimeSignature) => void;
  setMasterVolume: (volume: number) => void;
  
  // Track actions
  addTrack: (track: Track) => void;
  addInstrumentTrack: (name: string, instrumentType: InstrumentType, color?: string) => string;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  moveTrack: (trackId: string, newIndex: number) => void;
  duplicateTrack: (trackId: string) => string;
  setTrackVolume: (trackId: string, volume: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;
  setTrackMute: (trackId: string, muted: boolean) => void;
  setTrackSolo: (trackId: string, solo: boolean) => void;
  
  // Pattern actions
  addPattern: (pattern: Pattern) => void;
  createPattern: (trackId: string, name: string, length?: number) => string;
  removePattern: (patternId: string) => void;
  updatePattern: (patternId: string, updates: Partial<Pattern>) => void;
  
  // Note actions (for MIDI clips)
  addNoteToClip: (clipId: string, note: MidiNote) => void;
  removeNoteFromClip: (clipId: string, noteIndex: number) => void;
  updateNoteInClip: (clipId: string, noteIndex: number, updates: Partial<MidiNote>) => void;
  
  // Clip actions
  addClipToTrack: (trackId: string, clip: MidiClip) => void;
  removeClipFromTrack: (trackId: string, clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<MidiClip>) => void;
  removeClip: (clipId: string) => void;
  
  // Project actions
  newProject: () => void;
  loadProject: (data: ProjectData) => void;
  getProjectData: () => ProjectData;
  markDirty: () => void;
  markClean: () => void;
  
  // Audio engine connection
  connectAudioEngine: () => void;
  disconnectAudioEngine: () => void;
  syncToAudioEngine: () => void;
}

const defaultMetadata: ProjectMetadata = {
  name: 'Projet sans titre',
  author: '',
  description: '',
  createdAt: new Date().toISOString(),
  modifiedAt: new Date().toISOString(),
  version: '1.0.0',
  notes: '', // Project notes (markdown supported)
};

const defaultSettings: SongSettings = {
  tempo: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  masterVolume: 1.0,
  masterPitch: 0,
  length: 16, // 16 bars
};

// Track colors for auto-assignment
const TRACK_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

let colorIndex = 0;
const getNextColor = () => {
  const color = TRACK_COLORS[colorIndex % TRACK_COLORS.length];
  colorIndex++;
  return color;
};

export const useSongStore = create<SongState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        projectId: null,
        metadata: { ...defaultMetadata },
        settings: { ...defaultSettings },
        tracks: [],
        patterns: [],
        selectedTrackId: null,
        selectedPatternId: null,
        isDirty: false,
        isAudioConnected: false,

        // Metadata actions
        setProjectId: (id) => set({ projectId: id }),
        setSelectedTrackId: (trackId) => set({ selectedTrackId: trackId }),
        setSelectedPatternId: (patternId) => {
          set({ selectedPatternId: patternId });
          // Sync to audio engine
          const manager = getManager();
          if (manager && patternId) {
            manager.setCurrentPattern(patternId);
          }
        },
        
        setMetadata: (metadata) => set((state) => ({
          metadata: {
            ...state.metadata,
            ...metadata,
            modifiedAt: new Date().toISOString(),
          },
          isDirty: true,
        })),

        // Settings actions
        setTempo: (tempo) => {
          const clampedTempo = Math.max(20, Math.min(999, tempo));
          set((state) => ({
            settings: { ...state.settings, tempo: clampedTempo },
            isDirty: true,
          }));
          // Sync to audio engine
          const manager = getManager();
          if (manager) {
            manager.setTempo(clampedTempo);
          }
        },

        setTimeSignature: (timeSignature) => set((state) => ({
          settings: { ...state.settings, timeSignature },
          isDirty: true,
        })),

        setMasterVolume: (volume) => {
          const clampedVolume = Math.max(0, Math.min(1, volume));
          set((state) => ({
            settings: { ...state.settings, masterVolume: clampedVolume },
            isDirty: true,
          }));
          // Sync to audio engine
          const manager = getManager();
          if (manager) {
            manager.setMasterVolume(clampedVolume);
          }
        },

        // Track actions
        addTrack: (track) => set((state) => ({
          tracks: [...state.tracks, track],
          isDirty: true,
        })),

        // Add instrument track with audio engine integration
        addInstrumentTrack: (name, instrumentType, color) => {
          const trackId = `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const instrumentId = `inst-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const mixerChannelId = `mixer-${trackId}`;
          
          const track: InstrumentTrack = {
            id: trackId,
            type: 'instrument',
            name,
            color: color || getNextColor(),
            muted: false,
            solo: false,
            volume: 1.0,
            pan: 0,
            mixerChannelId,
            clips: [],
            instrumentId,
            instrument: {
              id: instrumentId,
              type: instrumentType,
              name: instrumentType,
              params: {
                volume: 1.0,
                pan: 0,
                pitch: 0,
              },
            },
          };
          
          set((state) => ({
            tracks: [...state.tracks, track],
            selectedTrackId: trackId,
            isDirty: true,
          }));
          
          // Create track in audio engine
          const manager = getManager();
          if (manager) {
            manager.createTrack(trackId, instrumentType, instrumentId);
          }
          
          return trackId;
        },

        removeTrack: (trackId) => {
          // Remove from audio engine first
          const manager = getManager();
          if (manager) {
            manager.deleteTrack(trackId);
          }
          
          set((state) => ({
            tracks: state.tracks.filter((t) => t.id !== trackId),
            selectedTrackId: state.selectedTrackId === trackId ? null : state.selectedTrackId,
            isDirty: true,
          }));
        },

        updateTrack: (trackId, updates) => {
          set((state) => ({
            tracks: state.tracks.map((t) =>
              t.id === trackId ? { ...t, ...updates } : t
            ),
            isDirty: true,
          }));
          
          // If instrument was updated, sync to audio engine
          if ('instrument' in updates) {
            const manager = getManager();
            if (manager) {
              const state = get();
              const track = state.tracks.find(t => t.id === trackId);
              // Check if it's an instrument track and has instrument data
              if (track && track.type === 'instrument' && (track as InstrumentTrack).instrument) {
                const instTrack = track as InstrumentTrack;
                manager.replaceTrackInstrument(
                  trackId, 
                  instTrack.instrument.type, 
                  instTrack.instrument.id
                );
              }
            }
          }

          // If clips were updated, sync notes to audio engine patterns
          if (updates.clips) {
            const manager = getManager();
            if (manager) {
              updates.clips.forEach(clip => {
                if ('notes' in clip) {
                  const midiClip = clip as MidiClip;
                  // Check if pattern exists, if not create it
                  const existingPattern = manager.getPattern(clip.id);
                  if (!existingPattern) {
                    const patternLength = midiClip.length || 7680;
                    manager.createPattern(clip.id, trackId, midiClip.name || 'Pattern', patternLength);
                  }
                  
                  // Clear existing notes and re-add all (simple sync approach)
                  // Note: A more efficient approach would track changes
                  const pattern = manager.getPattern(clip.id);
                  if (pattern) {
                    // Remove all existing notes
                    while (pattern.notes.length > 0) {
                      manager.removeNoteFromPattern(clip.id, 0);
                    }
                    
                    // Add all notes with trackId
                    midiClip.notes.forEach(note => {
                      const noteWithTrack: MidiNote = {
                        ...note,
                        trackId: trackId,
                      };
                      manager.addNoteToPattern(clip.id, noteWithTrack);
                    });
                    
                    // Set as current pattern
                    manager.setCurrentPattern(clip.id);
                  }
                }
              });
            }
          }
        },

        moveTrack: (trackId, newIndex) => set((state) => {
          const tracks = [...state.tracks];
          const currentIndex = tracks.findIndex((t) => t.id === trackId);
          if (currentIndex === -1) return state;
          
          const [track] = tracks.splice(currentIndex, 1);
          tracks.splice(newIndex, 0, track);
          
          return { tracks, isDirty: true };
        }),

        duplicateTrack: (trackId) => {
          const state = get();
          const track = state.tracks.find((t) => t.id === trackId);
          if (!track) return '';
          
          const newId = `track-${Date.now()}`;
          const newInstrumentId = `inst-${Date.now()}`;
          const newMixerChannelId = `mixer-${newId}`;
          
          const newTrack: Track = {
            ...track,
            id: newId,
            name: `${track.name} (Copy)`,
            mixerChannelId: newMixerChannelId,
            clips: track.clips.map((clip) => ({
              ...clip,
              id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              trackId: newId,
            })),
          };
          
          // If it's an instrument track, duplicate the instrument
          if (track.type === 'instrument') {
            const instTrack = track as InstrumentTrack;
            (newTrack as InstrumentTrack).instrumentId = newInstrumentId;
            (newTrack as InstrumentTrack).instrument = {
              ...instTrack.instrument,
              id: newInstrumentId,
            };
            
            // Create in audio engine
            const manager = getManager();
            if (manager) {
              manager.createTrack(newId, instTrack.instrument.type as InstrumentType, newInstrumentId);
            }
          }
          
          set((state) => ({
            tracks: [...state.tracks, newTrack],
            isDirty: true,
          }));
          
          return newId;
        },

        setTrackVolume: (trackId, volume) => {
          const clampedVolume = Math.max(0, Math.min(1, volume));
          set((state) => ({
            tracks: state.tracks.map((t) =>
              t.id === trackId ? { ...t, volume: clampedVolume } : t
            ),
            isDirty: true,
          }));
          
          // Sync to audio engine mixer channel
          const manager = getManager();
          const state = get();
          const track = state.tracks.find(t => t.id === trackId);
          if (manager && track) {
            manager.setChannelVolume(track.mixerChannelId, clampedVolume);
          }
        },

        setTrackPan: (trackId, pan) => {
          const clampedPan = Math.max(-1, Math.min(1, pan));
          set((state) => ({
            tracks: state.tracks.map((t) =>
              t.id === trackId ? { ...t, pan: clampedPan } : t
            ),
            isDirty: true,
          }));
          
          // Sync to audio engine mixer channel
          const manager = getManager();
          const state = get();
          const track = state.tracks.find(t => t.id === trackId);
          if (manager && track) {
            manager.setChannelPan(track.mixerChannelId, clampedPan);
          }
        },

        setTrackMute: (trackId, muted) => {
          set((state) => ({
            tracks: state.tracks.map((t) =>
              t.id === trackId ? { ...t, muted } : t
            ),
            isDirty: true,
          }));
          
          // Sync to audio engine mixer channel
          const manager = getManager();
          const state = get();
          const track = state.tracks.find(t => t.id === trackId);
          if (manager && track) {
            manager.setChannelMute(track.mixerChannelId, muted);
          }
        },

        setTrackSolo: (trackId, solo) => {
          set((state) => ({
            tracks: state.tracks.map((t) =>
              t.id === trackId ? { ...t, solo } : t
            ),
            isDirty: true,
          }));
          
          // Sync to audio engine mixer channel
          const manager = getManager();
          const state = get();
          const track = state.tracks.find(t => t.id === trackId);
          if (manager && track) {
            manager.setChannelSolo(track.mixerChannelId, solo);
          }
        },

        // Pattern actions
        addPattern: (pattern) => set((state) => ({
          patterns: [...state.patterns, pattern],
          isDirty: true,
        })),

        createPattern: (trackId, name, length = 64) => {
          const patternId = `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const pattern: Pattern = {
            id: patternId,
            name,
            length,
            steps: Array.from({ length }, (_, i) => ({
              index: i,
              enabled: false,
              velocity: 100,
              pan: 0,
              pitch: 0,
            })),
          };
          
          set((state) => ({
            patterns: [...state.patterns, pattern],
            selectedPatternId: patternId,
            isDirty: true,
          }));
          
          // Create pattern in audio engine
          const manager = getManager();
          if (manager) {
            manager.createPattern(patternId, trackId, name, length);
          }
          
          return patternId;
        },

        removePattern: (patternId) => {
          // Remove from audio engine
          const manager = getManager();
          if (manager) {
            manager.deletePattern(patternId);
          }
          
          set((state) => ({
            patterns: state.patterns.filter((p) => p.id !== patternId),
            selectedPatternId: state.selectedPatternId === patternId ? null : state.selectedPatternId,
            isDirty: true,
          }));
        },

        updatePattern: (patternId, updates) => set((state) => ({
          patterns: state.patterns.map((p) =>
            p.id === patternId ? { ...p, ...updates } : p
          ),
          isDirty: true,
        })),

        // Note actions for MIDI clips
        addNoteToClip: (clipId, note) => {
          set((state) => {
            const newTracks = state.tracks.map((track) => ({
              ...track,
              clips: track.clips.map((clip) => {
                if (clip.id === clipId && 'notes' in clip) {
                  const midiClip = clip as MidiClip;
                  return {
                    ...midiClip,
                    notes: [...midiClip.notes, note],
                  };
                }
                return clip;
              }),
            }));
            return { tracks: newTracks, isDirty: true };
          });
          
          // Add note to audio engine pattern
          const manager = getManager();
          const state = get();
          if (manager && state.selectedPatternId) {
            manager.addNoteToPattern(state.selectedPatternId, note);
          }
        },

        removeNoteFromClip: (clipId, noteIndex) => {
          set((state) => {
            const newTracks = state.tracks.map((track) => ({
              ...track,
              clips: track.clips.map((clip) => {
                if (clip.id === clipId && 'notes' in clip) {
                  const midiClip = clip as MidiClip;
                  return {
                    ...midiClip,
                    notes: midiClip.notes.filter((_, i) => i !== noteIndex),
                  };
                }
                return clip;
              }),
            }));
            return { tracks: newTracks, isDirty: true };
          });
          
          // Remove note from audio engine pattern
          const manager = getManager();
          const state = get();
          if (manager && state.selectedPatternId) {
            manager.removeNoteFromPattern(state.selectedPatternId, noteIndex);
          }
        },

        updateNoteInClip: (clipId, noteIndex, updates) => {
          set((state) => {
            const newTracks = state.tracks.map((track) => ({
              ...track,
              clips: track.clips.map((clip) => {
                if (clip.id === clipId && 'notes' in clip) {
                  const midiClip = clip as MidiClip;
                  return {
                    ...midiClip,
                    notes: midiClip.notes.map((note, i) =>
                      i === noteIndex ? { ...note, ...updates } : note
                    ),
                  };
                }
                return clip;
              }),
            }));
            return { tracks: newTracks, isDirty: true };
          });
        },

        // Clip actions
        addClipToTrack: (trackId, clip) => {
          set((state) => ({
            tracks: state.tracks.map((track) =>
              track.id === trackId
                ? { ...track, clips: [...track.clips, clip] }
                : track
            ),
            isDirty: true,
          }));
          
          // Create a pattern in the audio engine for this clip
          const manager = getManager();
          if (manager && 'notes' in clip) {
            const midiClip = clip as MidiClip;
            // Create pattern with clip's length (in ticks)
            const patternLength = midiClip.length || 7680; // Default 4 bars
            manager.createPattern(clip.id, trackId, midiClip.name || 'Pattern', patternLength);
            
            // Add all notes to the pattern with trackId
            midiClip.notes.forEach(note => {
              const noteWithTrack: MidiNote = {
                ...note,
                trackId: trackId,
              };
              manager.addNoteToPattern(clip.id, noteWithTrack);
            });
            
            // Set this as the current pattern for playback
            manager.setCurrentPattern(clip.id);
          }
        },

        removeClipFromTrack: (trackId, clipId) => {
          set((state) => ({
            tracks: state.tracks.map((track) =>
              track.id === trackId
                ? { ...track, clips: track.clips.filter((c) => c.id !== clipId) }
                : track
            ),
            isDirty: true,
          }));
        },

        updateClip: (clipId, updates) => {
          set((state) => ({
            tracks: state.tracks.map((track) => ({
              ...track,
              clips: track.clips.map((clip) =>
                clip.id === clipId ? { ...clip, ...updates } : clip
              ),
            })),
            isDirty: true,
          }));
        },

        removeClip: (clipId) => {
          set((state) => ({
            tracks: state.tracks.map((track) => ({
              ...track,
              clips: track.clips.filter((c) => c.id !== clipId),
            })),
            isDirty: true,
          }));
        },

        // Project actions
        newProject: () => {
          // Clear audio engine
          const manager = getManager();
          if (manager) {
            // Delete all existing tracks
            const state = get();
            state.tracks.forEach((track) => {
              manager.deleteTrack(track.id);
            });
          }
          
          set({
            projectId: null,
            metadata: {
              ...defaultMetadata,
              createdAt: new Date().toISOString(),
              modifiedAt: new Date().toISOString(),
            },
            settings: { ...defaultSettings },
            tracks: [],
            patterns: [],
            selectedTrackId: null,
            selectedPatternId: null,
            isDirty: false,
          });
          
          // Reset color index
          colorIndex = 0;
        },

        loadProject: (data) => {
          // Clear existing audio engine state
          const manager = getManager();
          if (manager) {
            const state = get();
            state.tracks.forEach((track) => {
              manager.deleteTrack(track.id);
            });
          }
          
          set({
            projectId: data.id || null,
            metadata: data.metadata,
            settings: data.song,
            tracks: data.tracks,
            patterns: data.patterns,
            selectedTrackId: null,
            selectedPatternId: null,
            isDirty: false,
          });
          
          // Sync loaded project to audio engine
          get().syncToAudioEngine();
        },

        getProjectData: () => {
          const state = get();
          return {
            id: state.projectId || `project-${Date.now()}`,
            name: state.metadata.name,
            version: '1.0.0',
            metadata: state.metadata,
            song: state.settings,
            tracks: state.tracks,
            controllers: [],
            mixer: { channels: [], masterChannel: { id: 'master', name: 'Master', volume: 1, pan: 0, mute: false, solo: false, effects: [], sends: [] } },
            automation: [],
            patterns: state.patterns,
          };
        },

        markDirty: () => set({ isDirty: true }),
        markClean: () => set({ isDirty: false }),

        // Audio engine connection
        connectAudioEngine: () => {
          const manager = getManager();
          if (manager) {
            set({ isAudioConnected: true });
            // Sync current state to audio engine
            get().syncToAudioEngine();
          }
        },

        disconnectAudioEngine: () => {
          set({ isAudioConnected: false });
          audioEngineManager = null;
        },

        syncToAudioEngine: () => {
          const manager = getManager();
          if (!manager) return;
          
          const state = get();
          
          // Sync tempo
          manager.setTempo(state.settings.tempo);
          
          // Sync master volume
          manager.setMasterVolume(state.settings.masterVolume);
          
          // Sync tracks
          state.tracks.forEach((track) => {
            if (track.type === 'instrument') {
              const instTrack = track as InstrumentTrack;
              // Create track in audio engine if it doesn't exist
              manager.createTrack(
                track.id,
                instTrack.instrument.type as InstrumentType,
                instTrack.instrumentId
              );
              
              // Sync track settings
              manager.setChannelVolume(track.mixerChannelId, track.volume);
              manager.setChannelPan(track.mixerChannelId, track.pan);
              manager.setChannelMute(track.mixerChannelId, track.muted);
              manager.setChannelSolo(track.mixerChannelId, track.solo);
            } else if (track.type === 'audio' || track.type === 'sample') {
              // Sync audio/sample tracks
              track.clips.forEach((clip) => {
                const audioClip = clip as AudioClip;
                if (audioClip.sampleId && audioClip.samplePath) {
                  // Load sample (async)
                  manager.loadSampleFromUrl(audioClip.sampleId, audioClip.name, audioClip.samplePath);
                  
                  // Register clip
                  manager.addSampleClip({
                    clipId: audioClip.id,
                    sampleId: audioClip.sampleId,
                    startTick: audioClip.startTick,
                    length: audioClip.length,
                    offset: audioClip.startOffset || 0,
                    gain: audioClip.gain || 1.0,
                    pitch: audioClip.pitch || 1.0,
                    fadeIn: audioClip.fadeIn || 0,
                    fadeOut: audioClip.fadeOut || 0,
                  });
                }
              });
            }
          });
          
          // Sync patterns
          state.patterns.forEach((pattern) => {
            // Find the track this pattern belongs to
            const track = state.tracks.find(t =>
              t.clips.some(c => c.id === pattern.id)
            );
            if (track) {
              manager.createPattern(pattern.id, track.id, pattern.name, pattern.length);
            }
          });
        },
      }),
      {
        name: 'AnkhWaveStudio-web-song',
        version: 1,
        migrate: (persistedState: any) => {
          // Migration FR: remplace l'ancien nom par défaut en anglais.
          if (persistedState?.metadata?.name === 'Untitled Project') {
            return {
              ...persistedState,
              metadata: {
                ...persistedState.metadata,
                name: 'Projet sans titre',
              },
            };
          }
          return persistedState;
        },
        partialize: (state) => ({
          // Only persist certain fields
          metadata: state.metadata,
          settings: state.settings,
        }),
      }
    ),
    { name: 'SongStore' }
  )
);

// Selector hooks for common use cases
export const useTempo = () => useSongStore((state) => state.settings.tempo);
export const useTimeSignature = () => useSongStore((state) => state.settings.timeSignature);
export const useTracks = () => useSongStore((state) => state.tracks);
export const usePatterns = () => useSongStore((state) => state.patterns);
export const useIsDirty = () => useSongStore((state) => state.isDirty);
export const useSelectedTrackId = () => useSongStore((state) => state.selectedTrackId);
export const useSelectedPatternId = () => useSongStore((state) => state.selectedPatternId);
export const useIsAudioConnected = () => useSongStore((state) => state.isAudioConnected);

// Get track by ID
export const useTrack = (trackId: string) => useSongStore((state) =>
  state.tracks.find((t) => t.id === trackId)
);

// Get pattern by ID
export const usePattern = (patternId: string) => useSongStore((state) =>
  state.patterns.find((p) => p.id === patternId)
);

// Get instrument tracks only
export const useInstrumentTracks = () => useSongStore((state) =>
  state.tracks.filter((t) => t.type === 'instrument') as InstrumentTrack[]
);