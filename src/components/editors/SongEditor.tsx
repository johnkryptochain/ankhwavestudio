// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * SongEditor - Main timeline/arrangement view
 * Features: Timeline with bar/beat grid, track lanes, pattern/clip placement,
 * drag to move/resize clips, multi-track selection, zoom controls, playhead
 */

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useTracks, useSongStore, useTransportStore, useUIStore, useHistoryStore } from '../../stores';
import { Button } from '../common';
import type { MidiClip, AudioClip, Track } from '../../types/song';
import { getAudioEngineManager } from '../../audio/AudioEngineManager';
import { generateCommandId } from '../../utils/commands/Command';
import { Waveform } from './Waveform';

interface ClipDragState {
  clipId: string;
  trackId: string;
  startX: number;
  startTick: number;
  mode: 'move' | 'resize-start' | 'resize-end';
}

interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export const SongEditor: React.FC = memo(() => {
  const tracks = useTracks();
  const { addTrack, addInstrumentTrack, updateTrack, removeTrack, removeClipFromTrack, addClipToTrack, setSelectedTrackId, selectedTrackId } = useSongStore();
  const { position, isPlaying, loopStart, loopEnd, loopEnabled } = useTransportStore();
  const { setActiveEditor, zoom: uiZoom, setZoom: setUIZoom, preferences } = useUIStore();
  const { executeCommand } = useHistoryStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const horizontalZoom = uiZoom.songEditor;
  const verticalZoom = uiZoom.vertical;
  // const [scrollOffset, setScrollOffset] = useState(0); // Removed for native scroll
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<ClipDragState | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [editingTrackName, setEditingTrackName] = useState<string | null>(null);
  
  const ticksPerBeat = 480;
  const beatsPerBar = 4;
  const ticksPerBar = ticksPerBeat * beatsPerBar;
  const totalBars = 64;
  const totalTicks = totalBars * ticksPerBar;
  const pixelsPerTick = (horizontalZoom * 100) / ticksPerBeat;
  const trackHeight = 64 * verticalZoom;

  const handleWheelScrollTracks = useCallback((e: React.WheelEvent) => {
    // Don't interfere with browser zoom
    if (e.ctrlKey || e.metaKey) return;

    // Don't hijack wheel over interactive controls
    const target = e.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (target.closest('input[type="range"]')) return;
      if (target.getAttribute('role') === 'slider') return;
    }

    const el = containerRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 1) return;

    const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
    const nextTop = Math.max(0, Math.min(maxTop, el.scrollTop + e.deltaY));
    if (nextTop === el.scrollTop) return;

    el.scrollTop = nextTop;
    e.preventDefault();
  }, []);

  // Convert tick to X position
  const tickToX = useCallback((tick: number): number => {
    return tick * pixelsPerTick;
  }, [pixelsPerTick]);

  // Convert X position to tick
  const xToTick = useCallback((x: number): number => {
    return x / pixelsPerTick;
  }, [pixelsPerTick]);

  // Snap tick to grid
  const snapToGrid = useCallback((tick: number, subdivision: number = 4): number => {
    const snapInterval = ticksPerBeat / subdivision;
    return Math.round(tick / snapInterval) * snapInterval;
  }, [ticksPerBeat]);

  // Handle add track with undo support
  const handleAddTrack = useCallback((type: 'instrument' | 'audio' | 'automation' = 'instrument') => {
    const colors = ['#8286ef', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#84cc16'];
    const trackCount = tracks.length;
    const trackColor = colors[trackCount % colors.length];
    
    if (type === 'instrument') {
      const trackName = `Instrument ${trackCount + 1}`;
      let createdTrackId: string | null = null;
      
      executeCommand({
        id: generateCommandId(),
        description: `Add instrument track "${trackName}"`,
        timestamp: Date.now(),
        execute: () => {
          createdTrackId = useSongStore.getState().addInstrumentTrack(
            trackName,
            'tripleoscillator',
            trackColor
          );
        },
        undo: () => {
          if (createdTrackId) {
            useSongStore.getState().removeTrack(createdTrackId);
          }
        },
      });
    } else {
      const trackId = `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const trackName = `${type.charAt(0).toUpperCase() + type.slice(1)} ${trackCount + 1}`;
      const newTrack: Track = {
        id: trackId,
        type,
        name: trackName,
        color: trackColor,
        muted: false,
        solo: false,
        volume: 0.8,
        pan: 0,
        mixerChannelId: 'master',
        clips: [],
      };
      
      executeCommand({
        id: generateCommandId(),
        description: `Add ${type} track "${trackName}"`,
        timestamp: Date.now(),
        execute: () => {
          useSongStore.getState().addTrack(newTrack);
        },
        undo: () => {
          useSongStore.getState().removeTrack(trackId);
        },
      });
    }
  }, [tracks.length, executeCommand]);

  // Handle track mute toggle with undo support
  const handleToggleMute = useCallback((trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      const wasMuted = track.muted;
      executeCommand({
        id: generateCommandId(),
        description: wasMuted ? 'Unmute track' : 'Mute track',
        timestamp: Date.now(),
        execute: () => {
          useSongStore.getState().updateTrack(trackId, { muted: !wasMuted });
        },
        undo: () => {
          useSongStore.getState().updateTrack(trackId, { muted: wasMuted });
        },
      });
    }
  }, [tracks, executeCommand]);

  // Handle track solo toggle with undo support
  const handleToggleSolo = useCallback((trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      const wasSoloed = track.solo;
      executeCommand({
        id: generateCommandId(),
        description: wasSoloed ? 'Unsolo track' : 'Solo track',
        timestamp: Date.now(),
        execute: () => {
          useSongStore.getState().updateTrack(trackId, { solo: !wasSoloed });
        },
        undo: () => {
          useSongStore.getState().updateTrack(trackId, { solo: wasSoloed });
        },
      });
    }
  }, [tracks, executeCommand]);

  // Handle clip selection
  const handleClipClick = useCallback((e: React.MouseEvent, clipId: string, trackId: string) => {
    e.stopPropagation();
    
    if (e.shiftKey) {
      // Add to selection
      setSelectedClipIds(prev => {
        const next = new Set(prev);
        if (next.has(clipId)) {
          next.delete(clipId);
        } else {
          next.add(clipId);
        }
        return next;
      });
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      setSelectedClipIds(prev => {
        const next = new Set(prev);
        if (next.has(clipId)) {
          next.delete(clipId);
        } else {
          next.add(clipId);
        }
        return next;
      });
    } else {
      // Single selection
      setSelectedClipIds(new Set([clipId]));
    }
  }, []);

  // Handle clip drag start
  const handleClipDragStart = useCallback((e: React.MouseEvent, clipId: string, trackId: string, mode: ClipDragState['mode']) => {
    e.stopPropagation();
    e.preventDefault();
    
    const track = tracks.find(t => t.id === trackId);
    const clip = track?.clips.find(c => c.id === clipId);
    if (!clip) return;

    setDragState({
      clipId,
      trackId,
      startX: e.clientX,
      startTick: clip.startTick,
      mode,
    });
  }, [tracks]);

  // Handle mouse move for dragging
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaTicks = deltaX / pixelsPerTick;
      
      const track = tracks.find(t => t.id === dragState.trackId);
      const clip = track?.clips.find(c => c.id === dragState.clipId);
      if (!clip) return;

      if (dragState.mode === 'move') {
        const newStartTick = Math.max(0, snapToGrid(dragState.startTick + deltaTicks));
        // Update clip in track
        updateTrack(dragState.trackId, {
          clips: tracks.find(t => t.id === dragState.trackId)?.clips.map(c =>
            c.id === dragState.clipId ? { ...c, startTick: newStartTick } : c
          ) || []
        });
      } else if (dragState.mode === 'resize-end') {
        const newLength = Math.max(ticksPerBeat, snapToGrid(clip.length + deltaTicks));
        // Update clip in track
        updateTrack(dragState.trackId, {
          clips: tracks.find(t => t.id === dragState.trackId)?.clips.map(c =>
            c.id === dragState.clipId ? { ...c, length: newLength } : c
          ) || []
        });
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
  }, [dragState, pixelsPerTick, snapToGrid, tracks, updateTrack, ticksPerBeat]);

  // Handle timeline click (set playhead)
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const tick = snapToGrid(xToTick(x));
    
    useTransportStore.getState().setPosition(tick);
  }, [xToTick, snapToGrid]);

  // Handle track area click (deselect)
  const handleTrackAreaClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setSelectedClipIds(new Set());
    }
  }, []);

  // Handle double-click on track area to create a new clip with undo support
  const handleTrackAreaDoubleClick = useCallback((e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const tick = snapToGrid(xToTick(x));
    
    // Create a new MIDI clip at the clicked position
    const clipId = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const track = tracks.find(t => t.id === trackId);
    
    const newClip: MidiClip = {
      id: clipId,
      trackId: trackId,
      startTick: Math.max(0, tick),
      length: ticksPerBar, // Default to 1 bar length
      offset: 0,
      name: `${track?.name || 'Clip'} ${(track?.clips.length || 0) + 1}`,
      notes: [],
    };
    
    executeCommand({
      id: generateCommandId(),
      description: `Add clip "${newClip.name}"`,
      timestamp: Date.now(),
      execute: () => {
        useSongStore.getState().addClipToTrack(trackId, newClip);
      },
      undo: () => {
        useSongStore.getState().removeClipFromTrack(trackId, clipId);
      },
    });
    setSelectedClipIds(new Set([clipId]));
  }, [snapToGrid, xToTick, ticksPerBar, tracks, executeCommand]);

  // Handle sample drop on track
  const handleTrackDrop = useCallback(async (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      console.log('Dropped data:', data);
      
      if (data.type === 'sample') {
        // Calculate drop position
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const tick = snapToGrid(xToTick(x));
        
        // Create an audio clip for the sample
        const clipId = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const sampleId = data.id || `sample-${Date.now()}`;
        
        // Calculate clip length based on sample duration (fallback to at least 1 bar)
        const tempo = useTransportStore.getState().tempo || 120;
        const ticksPerSecond = (tempo / 60) * ticksPerBeat;
        const durationSeconds = Number(data.duration);
        const clipLength = Number.isFinite(durationSeconds)
          ? Math.max(ticksPerBar, Math.round(durationSeconds * ticksPerSecond))
          : ticksPerBar;
        
        // Load the sample into the audio engine
        try {
          const manager = getAudioEngineManager();
          if (manager.isInitialized()) {
            // Check if sample is already loaded
            if (!manager.hasSample(sampleId)) {
              console.log(`[SongEditor] Loading sample: ${data.name} from ${data.path}`);
              const loadedSample = await manager.loadSampleFromUrl(sampleId, data.name, data.path);
              if (loadedSample) {
                console.log(`[SongEditor] Sample loaded successfully: ${loadedSample.name}, duration: ${loadedSample.duration}s`);
              } else {
                console.error(`[SongEditor] Failed to load sample: ${data.name}`);
              }
            }
            
            // Register the sample clip for playback
            manager.addSampleClip({
              clipId: clipId,
              sampleId: sampleId,
              startTick: Math.max(0, tick),
              length: clipLength,
              offset: 0,
              gain: 1.0,
              pitch: 1.0,
              fadeIn: 0,
              fadeOut: 0,
            });
            console.log(`[SongEditor] Sample clip registered for playback: ${clipId}`);
          }
        } catch (audioErr) {
          console.error('[SongEditor] Audio engine error:', audioErr);
        }
        
        // Create the visual clip
        const newClip: MidiClip = {
          id: clipId,
          trackId: trackId,
          startTick: Math.max(0, tick),
          length: clipLength,
          offset: 0,
          name: data.name || 'Audio Clip',
          notes: [],
          color: '#22c55e', // Green color for audio clips
        };
        
        // Store sample reference in clip (extend with sample info)
        (newClip as any).sampleId = sampleId;
        (newClip as any).samplePath = data.path;
        (newClip as any).sampleDuration = Number.isFinite(durationSeconds) ? durationSeconds : 0;
        
        addClipToTrack(trackId, newClip);
        setSelectedClipIds(new Set([clipId]));
        console.log('Audio clip created:', newClip, 'Sample:', data.name);
      } else if (data.type === 'instrument') {
        // Handle instrument drop - create a new instrument track
        const colors = ['#8286ef', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#84cc16'];
        const instrumentTypeMap: Record<string, string> = {
          'triple-osc': 'tripleoscillator',
          'bitinvader': 'bitinvader',
          'kicker': 'kicker',
          'sample-player': 'audiofileprocessor',
          'organic': 'organic',
          'lb302': 'lb302',
          'sfxr': 'oscillator',
          'zynaddsubfx': 'monstro',
        };
        const instrumentType = instrumentTypeMap[data.id] || 'oscillator';
        addInstrumentTrack(data.name, instrumentType as any, colors[tracks.length % colors.length]);
      }
    } catch (err) {
      console.error('Failed to parse drop data:', err);
    }
  }, [tracks, snapToGrid, xToTick, ticksPerBeat, ticksPerBar, addClipToTrack, addInstrumentTrack]);

  // Handle drag over for tracks
  const handleTrackDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // Handle double-click on clip to open Piano Roll
  const handleClipDoubleClick = useCallback((e: React.MouseEvent, clipId: string, trackId: string) => {
    e.stopPropagation();
    
    // Select the track and open Piano Roll
    setSelectedTrackId(trackId);
    setActiveEditor('piano-roll');
  }, [setSelectedTrackId, setActiveEditor]);

  // Handle delete selected clips with undo support
  const handleDeleteSelected = useCallback(() => {
    // Collect all clips to delete with their track info
    const clipsToDelete: Array<{ trackId: string; clip: MidiClip }> = [];
    
    selectedClipIds.forEach(clipId => {
      tracks.forEach(track => {
        const clip = track.clips.find(c => c.id === clipId);
        if (clip) {
          clipsToDelete.push({ trackId: track.id, clip: clip as MidiClip });
        }
      });
    });
    
    if (clipsToDelete.length === 0) return;
    
    executeCommand({
      id: generateCommandId(),
      description: `Delete ${clipsToDelete.length} clip${clipsToDelete.length > 1 ? 's' : ''}`,
      timestamp: Date.now(),
      execute: () => {
        clipsToDelete.forEach(({ trackId, clip }) => {
          useSongStore.getState().removeClipFromTrack(trackId, clip.id);
        });
      },
      undo: () => {
        clipsToDelete.forEach(({ trackId, clip }) => {
          useSongStore.getState().addClipToTrack(trackId, clip);
        });
      },
    });
    setSelectedClipIds(new Set());
  }, [selectedClipIds, tracks, executeCommand]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipIds.size > 0) {
          handleDeleteSelected();
        }
      }
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        // Select all clips
        const allClipIds = new Set<string>();
        tracks.forEach(track => {
          track.clips.forEach(clip => {
            allClipIds.add(clip.id);
          });
        });
        setSelectedClipIds(allClipIds);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipIds, handleDeleteSelected, tracks]);

  // Auto-scroll with playhead
  useEffect(() => {
    if (!isPlaying) return;
    
    const playheadX = tickToX(position);
    const container = containerRef.current;
    if (!container) return;
    
    const scrollLeft = container.scrollLeft;
    const clientWidth = container.clientWidth;
    
    // If playhead moves near the right edge, scroll
    if (playheadX > scrollLeft + clientWidth * 0.9) {
      container.scrollLeft = playheadX - clientWidth * 0.2;
    }
  }, [position, isPlaying, tickToX]);

  // Sync timeline header scroll
  const handleScroll = useCallback(() => {
    if (containerRef.current && timelineRef.current) {
      timelineRef.current.scrollLeft = containerRef.current.scrollLeft;
    }
  }, []);

  // Render bar markers
  const renderBarMarkers = () => {
    const markers = [];
    // Render all bars for native scroll
    for (let i = 0; i < totalBars; i++) {
      const x = tickToX(i * ticksPerBar);
      markers.push(
        <div
          key={i}
          className="absolute top-0 bottom-0 border-l border-daw-border"
          style={{ left: `${x}px` }}
        >
          <span className="text-xxs text-daw-text-muted ml-1">{i + 1}</span>
        </div>
      );
      
      // Beat markers
      for (let beat = 1; beat < beatsPerBar; beat++) {
        const beatX = tickToX(i * ticksPerBar + beat * ticksPerBeat);
        markers.push(
          <div
            key={`${i}-${beat}`}
            className="absolute top-0 bottom-0 border-l border-daw-border opacity-30"
            style={{ left: `${beatX}px` }}
          />
        );
      }
    }
    
    return markers;
  };

  // Render playhead
  const renderPlayhead = () => {
    const x = tickToX(position);
    if (x < 0) return null;
    
    return (
      <div
        className="absolute top-0 bottom-0 w-px bg-daw-accent-primary z-20 pointer-events-none"
        style={{ left: `${x}px` }}
      >
        <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-daw-accent-primary transform rotate-45" />
      </div>
    );
  };

  // Render loop region
  const renderLoopRegion = () => {
    if (!loopEnabled) return null;
    
    const startX = tickToX(loopStart);
    const endX = tickToX(loopEnd);
    const width = endX - startX;
    
    if (width <= 0) return null;
    
    return (
      <div
        className="absolute top-0 bottom-0 bg-daw-accent-primary opacity-10 pointer-events-none"
        style={{ left: `${startX}px`, width: `${width}px` }}
      />
    );
  };

  return (
    <div className="flex flex-col h-full bg-daw-bg-primary">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-daw-border bg-daw-bg-secondary">
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={() => handleAddTrack('instrument')}>
            + Piste instrument
          </Button>
          <Button size="sm" variant="secondary" onClick={() => handleAddTrack('audio')}>
            + Piste audio
          </Button>
        </div>
        
        <div className="h-4 w-px bg-daw-border mx-2" />
        
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-daw-text-muted">H :</span>
          <input
            type="range"
            min="0.25"
            max="4"
            step="0.25"
            value={horizontalZoom}
            onChange={(e) => setUIZoom('songEditor', Number(e.target.value))}
            className="w-20 h-1 bg-daw-bg-surface rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-daw-text-muted">V :</span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.25"
            value={verticalZoom}
            onChange={(e) => setUIZoom('vertical', Number(e.target.value))}
            className="w-20 h-1 bg-daw-bg-surface rounded-lg appearance-none cursor-pointer"
          />
        </div>
        
        <div className="flex-1" />
        
        {selectedClipIds.size > 0 && (
          <Button size="sm" variant="danger" onClick={handleDeleteSelected}>
            Supprimer ({selectedClipIds.size})
          </Button>
        )}
        
        <span className="text-xs text-daw-text-muted">
          {tracks.length} piste{tracks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Timeline header */}
      <div className="flex border-b border-daw-border">
        <div className="w-48 flex-shrink-0 bg-daw-bg-secondary border-r border-daw-border flex items-center px-2 z-20">
          <span className="text-xs text-daw-text-muted">Pistes</span>
        </div>
        <div 
          ref={timelineRef}
          className="flex-1 h-6 bg-daw-bg-surface relative overflow-hidden cursor-pointer"
          onClick={handleTimelineClick}
        >
          <div style={{ width: totalTicks * pixelsPerTick, height: '100%', position: 'relative' }}>
            {renderBarMarkers()}
            {renderPlayhead()}
            {renderLoopRegion()}
          </div>
        </div>
      </div>

      {/* Track list */}
      <div 
        ref={containerRef} 
        className="flex-1 overflow-scroll relative"
        style={{ 
          scrollbarWidth: 'auto', 
          scrollbarColor: 'var(--daw-text-muted) var(--daw-bg-primary)',
          scrollBehavior: preferences.smoothScroll ? 'smooth' : 'auto'
        }}
        onScroll={handleScroll}
      >
        <div style={{ minWidth: '100%', width: 'max-content' }}>
        {tracks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-daw-text-muted">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <p className="text-lg mb-2">Aucune piste pour l'instant</p>
              <p className="text-sm mb-4">Cliquez sur « Ajouter une piste » pour commencer</p>
              <Button onClick={() => handleAddTrack('instrument')}>
                + Ajouter une piste d'instrument
              </Button>
            </div>
          </div>
        ) : (
          tracks.map((track, index) => (
            <div
              key={track.id}
              className={`flex border-b border-daw-border ${
                selectedTrackId === track.id ? 'bg-daw-bg-surface' : ''
              }`}
              style={{ height: `${trackHeight}px` }}
              onClick={() => setSelectedTrackId(track.id)}
            >
              {/* Track header */}
              <div className="w-48 flex-shrink-0 bg-daw-bg-secondary border-r border-daw-border p-2 flex flex-col sticky left-0 z-10">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded cursor-pointer hover:ring-2 ring-white/30"
                    style={{ backgroundColor: track.color }}
                    title="Cliquez pour changer la couleur"
                  />
                  {editingTrackName === track.id ? (
                    <input
                      type="text"
                      value={track.name}
                      onChange={(e) => {
                        // Direct update during editing (no undo for each keystroke)
                        updateTrack(track.id, { name: e.target.value });
                      }}
                      onBlur={(e) => {
                        // Create undo command when editing is complete
                        const newName = e.target.value;
                        const oldName = tracks.find(t => t.id === track.id)?.name || '';
                        if (newName !== oldName) {
                          // Note: The name was already updated, so we just need to record for undo
                          // We'll handle this by storing the original name when editing starts
                        }
                        setEditingTrackName(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingTrackName(null)}
                      className="flex-1 bg-daw-bg-primary border border-daw-border rounded px-1 text-sm text-daw-text-primary"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="text-sm text-daw-text-primary truncate flex-1 cursor-pointer hover:text-daw-text-secondary"
                      onDoubleClick={() => setEditingTrackName(track.id)}
                    >
                      {track.name}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      // Delete track with undo support
                      const trackToDelete = tracks.find(t => t.id === track.id);
                      if (!trackToDelete) return;
                      const trackIndex = tracks.findIndex(t => t.id === track.id);
                      const trackCopy = JSON.parse(JSON.stringify(trackToDelete));
                      
                      executeCommand({
                        id: generateCommandId(),
                        description: `Delete track "${trackToDelete.name}"`,
                        timestamp: Date.now(),
                        execute: () => {
                          useSongStore.getState().removeTrack(track.id);
                        },
                        undo: () => {
                          // Re-add the track
                          useSongStore.getState().addTrack(trackCopy);
                          // Move it back to its original position if needed
                          if (trackIndex >= 0) {
                            useSongStore.getState().moveTrack(trackCopy.id, trackIndex);
                          }
                        },
                      });
                    }}
                    className="text-daw-text-muted hover:text-daw-accent-danger p-0.5"
                    title="Supprimer la piste"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <button
                    onClick={() => handleToggleMute(track.id)}
                    className={`${preferences.compactTrackButtons ? 'px-1' : 'px-2'} py-0.5 text-xxs rounded font-medium transition-colors ${
                      track.muted
                        ? 'bg-daw-accent-secondary text-white'
                        : 'bg-daw-bg-surface text-daw-text-muted hover:text-daw-text-secondary'
                    }`}
                    title="Muet"
                  >
                    M
                  </button>
                  <button
                    onClick={() => handleToggleSolo(track.id)}
                    className={`${preferences.compactTrackButtons ? 'px-1' : 'px-2'} py-0.5 text-xxs rounded font-medium transition-colors ${
                      track.solo
                        ? 'bg-daw-accent-warning text-black'
                        : 'bg-daw-bg-surface text-daw-text-muted hover:text-daw-text-secondary'
                    }`}
                    title="Solo"
                  >
                    S
                  </button>
                  <button
                    className={`${preferences.compactTrackButtons ? 'px-1' : 'px-2'} py-0.5 text-xxs rounded bg-daw-bg-surface text-daw-text-muted hover:text-daw-text-secondary`}
                    title="Armer l'enregistrement"
                  >
                    R
                  </button>
                </div>
                <div className="flex-1" />
                <div className="text-xxs text-daw-text-muted">
                  {track.type}
                </div>
              </div>
              
              {/* Track content area */}
              <div
                className="bg-daw-bg-primary relative overflow-hidden"
                style={{ width: totalTicks * pixelsPerTick }}
                onClick={handleTrackAreaClick}
                onDoubleClick={(e) => handleTrackAreaDoubleClick(e, track.id)}
                onDrop={(e) => handleTrackDrop(e, track.id)}
                onDragOver={handleTrackDragOver}
              >
                {/* Grid lines */}
                {renderBarMarkers()}
                
                {/* Clips */}
                {track.clips.map((clip) => {
                  const clipX = tickToX(clip.startTick);
                  const clipWidth = clip.length * pixelsPerTick;
                  const isSelected = selectedClipIds.has(clip.id);
                  
                  return (
                    <div
                      key={clip.id}
                      className={`absolute top-1 bottom-1 rounded cursor-pointer transition-shadow ${
                        isSelected ? 'ring-2 ring-white shadow-lg' : 'hover:ring-1 hover:ring-white/50'
                      }`}
                      style={{
                        left: `${clipX}px`,
                        width: `${Math.max(20, clipWidth)}px`,
                        backgroundColor: track.color,
                        opacity: track.muted ? 0.4 : 0.8,
                      }}
                      onClick={(e) => handleClipClick(e, clip.id, track.id)}
                      onDoubleClick={(e) => handleClipDoubleClick(e, clip.id, track.id)}
                      onMouseDown={(e) => handleClipDragStart(e, clip.id, track.id, 'move')}
                    >
                      {/* Waveform visualization */}
                      {preferences.displayWaveform && (track.type === 'audio' || track.type === 'sample') && (
                        <div className="absolute inset-0 opacity-80 pointer-events-none flex items-center overflow-hidden text-white">
                          <Waveform 
                            sampleId={(clip as AudioClip).sampleId} 
                            width={Math.max(20, clipWidth)} 
                            height={100} 
                            color="rgba(255, 255, 255, 0.9)" 
                            className="w-full h-full"
                          />
                        </div>
                      )}

                      <div className="px-1 py-0.5 overflow-hidden relative z-10">
                        <span className="text-xxs text-white font-medium truncate block">
                          {clip.name}
                        </span>
                      </div>
                      
                      {/* Resize handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleClipDragStart(e, clip.id, track.id, 'resize-end');
                        }}
                      />
                    </div>
                  );
                })}
                
                {/* Playhead */}
                {renderPlayhead()}
                
                {/* Loop region */}
                {renderLoopRegion()}
              </div>
            </div>
          ))
        )}
        </div>
      </div>
    </div>
  );
});

SongEditor.displayName = 'SongEditor';

export default SongEditor;