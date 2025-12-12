// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * MainContent - Main content area with editor views
 */

import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { useUIStore, useSongStore, useHistoryStore } from '../../stores';
import { SongEditor } from '../editors/SongEditor';
import { PianoRoll, MidiNote } from '../editors/PianoRoll';
import { PatternEditor } from '../editors/PatternEditor';
import { MixerView } from '../mixer/MixerView';
import { getAudioEngine } from '../../audio/AudioEngine';
import type { MidiClip, InstrumentTrack } from '../../types/song';
import { generateCommandId } from '../../utils/commands/Command';

export const MainContent: React.FC = () => {
  const { activeEditor, setActiveEditor } = useUIStore();
  const { selectedTrackId, tracks, addClipToTrack, updateTrack, removeClipFromTrack } = useSongStore();
  const { executeCommand } = useHistoryStore();
  
  // Pre-initialize audio engine when component mounts
  useEffect(() => {
    const initAudio = async () => {
      const audioEngine = getAudioEngine();
      if (!audioEngine.isInitialized()) {
        try {
          await audioEngine.initialize();
          console.log('[MainContent] Audio engine initialized');
        } catch (e) {
          console.warn('[MainContent] Failed to initialize audio engine:', e);
        }
      }
    };
    initAudio();
  }, []);

  const tabs = [
    { id: 'song' as const, label: 'Éditeur de morceau' },
    { id: 'piano-roll' as const, label: 'Piano roll' },
    { id: 'pattern' as const, label: 'Patterns' },
    { id: 'mixer' as const, label: 'Table de mixage' },
  ];

  // Get the selected track and its first clip (or create one)
  const selectedTrack = useMemo(() => {
    if (!selectedTrackId) return null;
    return tracks.find(t => t.id === selectedTrackId) || null;
  }, [selectedTrackId, tracks]);

  // Get or create a clip for the selected track
  const currentClip = useMemo((): MidiClip | null => {
    if (!selectedTrack || selectedTrack.type !== 'instrument') return null;
    
    // Find the first MIDI clip in the track
    const midiClip = selectedTrack.clips.find(c => 'notes' in c) as MidiClip | undefined;
    return midiClip || null;
  }, [selectedTrack]);

  // Get notes from the current clip
  const clipNotes = useMemo((): MidiNote[] => {
    if (!currentClip || !('notes' in currentClip)) return [];
    return currentClip.notes.map((note, index) => ({
      id: `note-${currentClip.id}-${index}`,
      pitch: note.pitch,
      startTick: note.startTick,
      duration: note.duration,
      velocity: note.velocity,
    }));
  }, [currentClip]);

  // Handle note add with undo support
  const handleNoteAdd = useCallback((note: Omit<MidiNote, 'id'>) => {
    if (!selectedTrackId || !selectedTrack) return;

    const newNote = {
      pitch: note.pitch,
      startTick: note.startTick,
      duration: note.duration,
      velocity: note.velocity,
      channel: 0, // Default MIDI channel
    };

    if (currentClip) {
      // Add note to existing clip with undo support
      const clipId = currentClip.id;
      const oldNotes = [...(currentClip as MidiClip).notes];
      const newNotes = [...oldNotes, newNote];
      
      executeCommand({
        id: generateCommandId(),
        description: 'Add note',
        timestamp: Date.now(),
        execute: () => {
          const track = useSongStore.getState().tracks.find(t => t.id === selectedTrackId);
          if (!track) return;
          const updatedClips = track.clips.map(c => {
            if (c.id === clipId && 'notes' in c) {
              return { ...c, notes: newNotes };
            }
            return c;
          });
          useSongStore.getState().updateTrack(selectedTrackId, { clips: updatedClips });
        },
        undo: () => {
          const track = useSongStore.getState().tracks.find(t => t.id === selectedTrackId);
          if (!track) return;
          const updatedClips = track.clips.map(c => {
            if (c.id === clipId && 'notes' in c) {
              return { ...c, notes: oldNotes };
            }
            return c;
          });
          useSongStore.getState().updateTrack(selectedTrackId, { clips: updatedClips });
        },
      });
    } else {
      // Create a new clip with the note with undo support
      const newClipId = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newClip: MidiClip = {
        id: newClipId,
        trackId: selectedTrackId,
        startTick: 0,
        length: 7680, // 4 bars at 480 ticks per beat
        offset: 0,
        name: `${selectedTrack.name} Clip 1`,
        notes: [newNote],
      };
      
      executeCommand({
        id: generateCommandId(),
        description: 'Add note (new clip)',
        timestamp: Date.now(),
        execute: () => {
          useSongStore.getState().addClipToTrack(selectedTrackId, newClip);
        },
        undo: () => {
          useSongStore.getState().removeClipFromTrack(selectedTrackId, newClipId);
        },
      });
    }
  }, [selectedTrackId, selectedTrack, currentClip, executeCommand]);

  // Handle note change with undo support
  const handleNoteChange = useCallback((noteId: string, changes: Partial<MidiNote>) => {
    if (!selectedTrackId || !selectedTrack || !currentClip) return;

    const noteIndex = parseInt(noteId.split('-').pop() || '0', 10);
    const clipId = currentClip.id;
    const oldNotes = [...(currentClip as MidiClip).notes];
    const newNotes = oldNotes.map((n, i) => {
      if (i === noteIndex) {
        return { ...n, ...changes };
      }
      return n;
    });
    
    executeCommand({
      id: generateCommandId(),
      description: 'Edit note',
      timestamp: Date.now(),
      execute: () => {
        const track = useSongStore.getState().tracks.find(t => t.id === selectedTrackId);
        if (!track) return;
        const updatedClips = track.clips.map(c => {
          if (c.id === clipId && 'notes' in c) {
            return { ...c, notes: newNotes };
          }
          return c;
        });
        useSongStore.getState().updateTrack(selectedTrackId, { clips: updatedClips });
      },
      undo: () => {
        const track = useSongStore.getState().tracks.find(t => t.id === selectedTrackId);
        if (!track) return;
        const updatedClips = track.clips.map(c => {
          if (c.id === clipId && 'notes' in c) {
            return { ...c, notes: oldNotes };
          }
          return c;
        });
        useSongStore.getState().updateTrack(selectedTrackId, { clips: updatedClips });
      },
    });
  }, [selectedTrackId, selectedTrack, currentClip, executeCommand]);

  // Handle note delete with undo support
  const handleNoteDelete = useCallback((noteId: string) => {
    if (!selectedTrackId || !selectedTrack || !currentClip) return;

    const noteIndex = parseInt(noteId.split('-').pop() || '0', 10);
    const clipId = currentClip.id;
    const oldNotes = [...(currentClip as MidiClip).notes];
    const deletedNote = oldNotes[noteIndex];
    const newNotes = oldNotes.filter((_, i) => i !== noteIndex);
    
    executeCommand({
      id: generateCommandId(),
      description: 'Delete note',
      timestamp: Date.now(),
      execute: () => {
        const track = useSongStore.getState().tracks.find(t => t.id === selectedTrackId);
        if (!track) return;
        const updatedClips = track.clips.map(c => {
          if (c.id === clipId && 'notes' in c) {
            return { ...c, notes: newNotes };
          }
          return c;
        });
        useSongStore.getState().updateTrack(selectedTrackId, { clips: updatedClips });
      },
      undo: () => {
        const track = useSongStore.getState().tracks.find(t => t.id === selectedTrackId);
        if (!track) return;
        const updatedClips = track.clips.map(c => {
          if (c.id === clipId && 'notes' in c) {
            // Insert the deleted note back at its original position
            const notes = [...(c as MidiClip).notes];
            notes.splice(noteIndex, 0, deletedNote);
            return { ...c, notes };
          }
          return c;
        });
        useSongStore.getState().updateTrack(selectedTrackId, { clips: updatedClips });
      },
    });
  }, [selectedTrackId, selectedTrack, currentClip, executeCommand]);

  // Handle pattern step trigger for drum sounds
  const handlePatternStepTrigger = useCallback((rowId: string, step: number, velocity: number) => {
    console.log('[PatternTrigger] Triggered:', rowId, step, velocity);
    
    // Get the audio engine
    const audioEngine = getAudioEngine();
    const audioContext = audioEngine.getContext();
    
    console.log('[PatternTrigger] AudioContext:', audioContext?.state);
    
    // If audio engine not initialized, skip (it should be initialized by useEffect)
    if (!audioContext) {
      console.warn('[PatternTrigger] AudioContext not available - initializing...');
      // Try to initialize asynchronously for next time
      audioEngine.initialize().catch(e => console.warn('Failed to init:', e));
      return;
    }
    
    // Resume if suspended (this is async but we fire and forget)
    if (audioContext.state === 'suspended') {
      console.log('[PatternTrigger] Resuming suspended AudioContext...');
      audioContext.resume().catch(e => console.warn('Failed to resume:', e));
      return; // Skip this trigger, next one should work
    }
    
    if (audioContext.state !== 'running') {
      console.warn('[PatternTrigger] AudioContext not running:', audioContext.state);
      return;
    }
    
    console.log('[PatternTrigger] Playing sound for', rowId);
    
    // Create a simple drum sound using Web Audio
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    // Different sounds for different drums
    if (rowId === 'row-0') {
      // Kick - low frequency with pitch drop
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.1);
      gain.gain.setValueAtTime((velocity / 127) * 0.6, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
    } else if (rowId === 'row-1') {
      // Snare - noise-like with higher frequency
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.05);
      gain.gain.setValueAtTime((velocity / 127) * 0.4, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
    } else if (rowId === 'row-2') {
      // HiHat - high frequency, short
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, audioContext.currentTime);
      gain.gain.setValueAtTime((velocity / 127) * 0.2, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);
    } else if (rowId === 'row-3') {
      // Clap - mid frequency
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, audioContext.currentTime);
      gain.gain.setValueAtTime((velocity / 127) * 0.3, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
    } else if (rowId === 'row-4') {
      // Tom - mid-low frequency with pitch drop
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + 0.15);
      gain.gain.setValueAtTime((velocity / 127) * 0.5, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
    } else {
      // Other drums - various frequencies
      const rowNum = parseInt(rowId.split('-')[1]) || 0;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300 + (rowNum * 100), audioContext.currentTime);
      gain.gain.setValueAtTime((velocity / 127) * 0.3, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
    }
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.3);
  }, []);

  const renderEditor = () => {
    switch (activeEditor) {
      case 'song':
        return <SongEditor />;
      case 'piano-roll':
      case 'pianoRoll':
        return (
          <PianoRoll
            notes={clipNotes}
            trackId={selectedTrackId || undefined}
            totalLength={currentClip?.length}
            onNoteAdd={handleNoteAdd}
            onNoteChange={handleNoteChange}
            onNoteDelete={handleNoteDelete}
          />
        );
      case 'pattern':
        return <PatternEditor onStepTrigger={handlePatternStepTrigger} />;
      case 'mixer':
        return <MixerView />;
      default:
        return <SongEditor />;
    }
  };

  return (
    <main className="flex-1 min-w-0 min-h-0 flex flex-col bg-daw-bg-primary overflow-hidden">
      {/* Editor tabs */}
      <div className="flex min-w-0 border-b border-daw-border bg-daw-bg-secondary">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveEditor(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeEditor === tab.id
                ? 'text-daw-text-primary bg-daw-bg-primary border-b-2 border-daw-accent-primary'
                : 'text-daw-text-muted hover:text-daw-text-secondary hover:bg-daw-bg-surface/50'
            }`}
          >
            <span className="block min-w-0 truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Editor content */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
        {renderEditor()}
      </div>
    </main>
  );
};

export default MainContent;