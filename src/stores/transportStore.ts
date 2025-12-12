// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Transport Store - Manages playback transport state
 * Connected to Audio Engine for real-time audio updates
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { TransportState, TimeSignature } from '../types/audio';
import { getAudioEngineManager, AudioEngineManager } from '../audio/AudioEngineManager';

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

interface TransportStoreState extends TransportState {
  // Additional state
  isAudioConnected: boolean;
  metronomeEnabled: boolean;
  
  // Actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  toggle: () => void;
  setPosition: (position: number) => void;
  setTempo: (tempo: number) => void;
  setTimeSignature: (timeSignature: TimeSignature) => void;
  setLoopEnabled: (enabled: boolean) => void;
  setLoopStart: (start: number) => void;
  setLoopEnd: (end: number) => void;
  setLoopRegion: (start: number, end: number) => void;
  startRecording: () => void;
  stopRecording: () => void;
  toggleMetronome: () => void;
  
  // Internal update (called by audio engine)
  _updateFromEngine: (state: Partial<TransportState>) => void;
  
  // Audio engine connection
  connectAudioEngine: () => void;
  disconnectAudioEngine: () => void;
}

const TICKS_PER_QUARTER_NOTE = 480;

export const useTransportStore = create<TransportStoreState>()(
  devtools(
    (set, get) => ({
      // Initial state
      isPlaying: false,
      isRecording: false,
      isPaused: false,
      position: 0,
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      loopEnabled: false,
      loopStart: 0,
      loopEnd: TICKS_PER_QUARTER_NOTE * 4 * 4, // 4 bars
      isAudioConnected: false,
      metronomeEnabled: false,

      // Actions - with audio engine sync
      play: () => {
        const manager = getManager();
        if (manager) {
          manager.play();
        }
        set({ isPlaying: true, isPaused: false });
      },
      
      pause: () => {
        const manager = getManager();
        if (manager) {
          manager.pause();
        }
        set({ isPlaying: false, isPaused: true });
      },
      
      stop: () => {
        const manager = getManager();
        if (manager) {
          manager.stop();
        }
        set({
          isPlaying: false,
          isPaused: false,
          isRecording: false,
          position: 0
        });
      },
      
      toggle: () => {
        const state = get();
        const manager = getManager();
        if (manager) {
          manager.toggle();
        }
        if (state.isPlaying) {
          set({ isPlaying: false, isPaused: true });
        } else {
          set({ isPlaying: true, isPaused: false });
        }
      },
      
      setPosition: (position) => {
        const clampedPosition = Math.max(0, position);
        const manager = getManager();
        if (manager) {
          manager.setPosition(clampedPosition);
        }
        set({ position: clampedPosition });
      },
      
      setTempo: (tempo) => {
        const clampedTempo = Math.max(20, Math.min(999, tempo));
        const manager = getManager();
        if (manager) {
          manager.setTempo(clampedTempo);
        }
        set({ tempo: clampedTempo });
      },
      
      setTimeSignature: (timeSignature) => set({ timeSignature }),
      
      setLoopEnabled: (enabled) => {
        const manager = getManager();
        if (manager) {
          manager.setLoopEnabled(enabled);
        }
        set({ loopEnabled: enabled });
      },
      
      setLoopStart: (start) => {
        const clampedStart = Math.max(0, start);
        const state = get();
        const manager = getManager();
        if (manager) {
          manager.setLoopRegion(clampedStart, state.loopEnd);
        }
        set({ loopStart: clampedStart });
      },
      
      setLoopEnd: (end) => {
        const state = get();
        const clampedEnd = Math.max(state.loopStart + TICKS_PER_QUARTER_NOTE, end);
        const manager = getManager();
        if (manager) {
          manager.setLoopRegion(state.loopStart, clampedEnd);
        }
        set({ loopEnd: clampedEnd });
      },
      
      setLoopRegion: (start, end) => {
        const clampedStart = Math.max(0, start);
        const clampedEnd = Math.max(start + TICKS_PER_QUARTER_NOTE, end);
        const manager = getManager();
        if (manager) {
          manager.setLoopRegion(clampedStart, clampedEnd);
        }
        set({
          loopStart: clampedStart,
          loopEnd: clampedEnd,
        });
      },
      
      startRecording: () => {
        set({ isRecording: true });
      },
      
      stopRecording: () => set({ isRecording: false }),
      
      toggleMetronome: () => {
        const manager = getManager();
        let enabled = false;
        if (manager) {
          enabled = manager.toggleMetronome();
        }
        set({ metronomeEnabled: enabled });
      },
      
      // Internal update from audio engine
      _updateFromEngine: (state) => set(state),
      
      // Audio engine connection
      connectAudioEngine: () => {
        const manager = getManager();
        if (manager) {
          // Set up event listeners for position updates
          manager.onEvent((event) => {
            switch (event.type) {
              case 'stateChange': {
                const data = event.data as { isPlaying?: boolean; position?: number };
                set({
                  isPlaying: data.isPlaying ?? get().isPlaying,
                  position: data.position ?? get().position,
                });
                break;
              }
              case 'positionUpdate': {
                const posData = event.data as { position: number };
                set({ position: posData.position });
                break;
              }
            }
          });
          
          // Sync current state to audio engine
          const state = get();
          manager.setTempo(state.tempo);
          manager.setLoopEnabled(state.loopEnabled);
          manager.setLoopRegion(state.loopStart, state.loopEnd);
          
          set({ isAudioConnected: true });
        }
      },
      
      disconnectAudioEngine: () => {
        set({ isAudioConnected: false });
        audioEngineManager = null;
      },
    }),
    { name: 'TransportStore' }
  )
);

// Selector hooks
export const useIsPlaying = () => useTransportStore((state) => state.isPlaying);
export const useIsRecording = () => useTransportStore((state) => state.isRecording);
export const usePosition = () => useTransportStore((state) => state.position);
export const useTransportTempo = () => useTransportStore((state) => state.tempo);
export const useLoopEnabled = () => useTransportStore((state) => state.loopEnabled);
export const useMetronomeEnabled = () => useTransportStore((state) => state.metronomeEnabled);
export const useIsAudioConnected = () => useTransportStore((state) => state.isAudioConnected);

// Utility functions
export const ticksToSeconds = (ticks: number, tempo: number): number => {
  const secondsPerBeat = 60 / tempo;
  const secondsPerTick = secondsPerBeat / TICKS_PER_QUARTER_NOTE;
  return ticks * secondsPerTick;
};

export const secondsToTicks = (seconds: number, tempo: number): number => {
  const secondsPerBeat = 60 / tempo;
  const ticksPerSecond = TICKS_PER_QUARTER_NOTE / secondsPerBeat;
  return Math.floor(seconds * ticksPerSecond);
};

export const ticksToBarsBeatsTicks = (
  ticks: number, 
  timeSignature: TimeSignature
): { bars: number; beats: number; ticks: number } => {
  const ticksPerBeat = TICKS_PER_QUARTER_NOTE;
  const ticksPerBar = ticksPerBeat * timeSignature.numerator;
  
  const bars = Math.floor(ticks / ticksPerBar) + 1;
  const remainingTicks = ticks % ticksPerBar;
  const beats = Math.floor(remainingTicks / ticksPerBeat) + 1;
  const subTicks = remainingTicks % ticksPerBeat;
  
  return { bars, beats, ticks: subTicks };
};

export const formatPosition = (
  ticks: number, 
  timeSignature: TimeSignature
): string => {
  const { bars, beats, ticks: subTicks } = ticksToBarsBeatsTicks(ticks, timeSignature);
  return `${bars}:${beats}:${subTicks.toString().padStart(3, '0')}`;
};