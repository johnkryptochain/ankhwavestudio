// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * useAudioEngine - Enhanced hook for accessing the audio engine
 * Provides comprehensive audio engine access and state management
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { AudioEngine, getAudioEngine } from '../audio/AudioEngine';
import { AudioEngineManager, getAudioEngineManager, AudioEngineManagerState, AudioEngineManagerEvent, TrackAudioData } from '../audio/AudioEngineManager';
import { InstrumentFactory, getInstrumentFactory, InstrumentType } from '../audio/InstrumentFactory';
import { EffectFactory, getEffectFactory, EffectType } from '../audio/EffectFactory';
import { BaseInstrument } from '../audio/instruments/BaseInstrument';
import { BaseEffect } from '../audio/effects/BaseEffect';
import { Pattern } from '../audio/Sequencer';
import type { MidiNote } from '../types/audio';

/**
 * Audio engine state for the hook
 */
interface AudioEngineHookState {
  isInitialized: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  currentPosition: number;
  tempo: number;
  masterVolume: number;
  sampleRate: number;
  latency: number;
}

/**
 * Return type for useAudioEngine hook
 */
interface UseAudioEngineReturn {
  // State
  state: AudioEngineHookState;
  
  // Initialization
  initialize: () => Promise<void>;
  
  // Core access
  engine: AudioEngine | null;
  manager: AudioEngineManager | null;
  
  // Transport controls
  play: () => void;
  pause: () => void;
  stop: () => void;
  toggle: () => void;
  setPosition: (ticks: number) => void;
  setTempo: (bpm: number) => void;
  setLoopEnabled: (enabled: boolean) => void;
  setLoopRegion: (start: number, end: number) => void;
  toggleMetronome: () => boolean;
  
  // Track management
  createTrack: (trackId: string, instrumentType: InstrumentType, instrumentId: string) => TrackAudioData | null;
  deleteTrack: (trackId: string) => void;
  getTrackInstrument: (trackId: string) => BaseInstrument | null;
  setTrackInstrument: (trackId: string, instrument: BaseInstrument) => void;
  
  // Pattern management
  createPattern: (patternId: string, trackId: string, name: string, length?: number) => Pattern | null;
  addNoteToPattern: (patternId: string, note: MidiNote) => boolean;
  removeNoteFromPattern: (patternId: string, noteIndex: number) => boolean;
  setCurrentPattern: (patternId: string) => boolean;
  
  // Mixer
  setChannelVolume: (channelId: string, volume: number) => void;
  setChannelPan: (channelId: string, pan: number) => void;
  setChannelMute: (channelId: string, muted: boolean) => void;
  setChannelSolo: (channelId: string, soloed: boolean) => void;
  setMasterVolume: (volume: number) => void;
  
  // Effects
  addEffectToChannel: (channelId: string, effect: BaseEffect) => boolean;
  removeEffectFromChannel: (channelId: string, effectId: string) => boolean;
  
  // Note preview
  playNotePreview: (trackId: string, noteNumber: number, velocity?: number) => void;
  stopNotePreview: (trackId: string, noteNumber: number) => void;
  stopAllNotePreviews: (trackId: string) => void;
  
  // Metering
  getStereoLevels: () => { left: number; right: number };
  getFrequencyData: () => Uint8Array;
  getTimeDomainData: () => Uint8Array;
  getChannelVUMeterData: (channelId: string) => { peakL: number; peakR: number; rmsL: number; rmsR: number } | null;
  
  // Factories
  createInstrument: (type: InstrumentType, id: string, name?: string) => BaseInstrument | null;
  createEffect: (type: EffectType, id: string, name?: string) => BaseEffect | null;
  
  // Suspend/Resume
  suspend: () => Promise<void>;
  resume: () => Promise<void>;
}

/**
 * Main hook for audio engine access
 */
export function useAudioEngine(): UseAudioEngineReturn {
  const [state, setState] = useState<AudioEngineHookState>({
    isInitialized: false,
    isPlaying: false,
    isRecording: false,
    currentPosition: 0,
    tempo: 120,
    masterVolume: 1.0,
    sampleRate: 44100,
    latency: 0,
  });

  const managerRef = useRef<AudioEngineManager | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const instrumentFactoryRef = useRef<InstrumentFactory | null>(null);
  const effectFactoryRef = useRef<EffectFactory | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize the audio engine
  const initialize = useCallback(async () => {
    if (state.isInitialized) return;

    try {
      // Get the audio engine manager
      const manager = getAudioEngineManager();
      await manager.initialize();
      
      managerRef.current = manager;
      engineRef.current = getAudioEngine();
      
      // Create factories
      const context = engineRef.current.getContext();
      if (context) {
        instrumentFactoryRef.current = getInstrumentFactory(context);
        effectFactoryRef.current = getEffectFactory(context);
      }
      
      // Set up event listener
      unsubscribeRef.current = manager.onEvent((event: AudioEngineManagerEvent) => {
        switch (event.type) {
          case 'stateChange':
            const data = event.data as { isPlaying?: boolean; position?: number };
            setState(prev => ({
              ...prev,
              isPlaying: data.isPlaying ?? prev.isPlaying,
              currentPosition: data.position ?? prev.currentPosition,
            }));
            break;
          case 'positionUpdate':
            const posData = event.data as { position: number };
            setState(prev => ({ ...prev, currentPosition: posData.position }));
            break;
        }
      });
      
      // Update state from manager
      const managerState = manager.getState();
      const engineState = engineRef.current.getState();
      
      setState({
        isInitialized: true,
        isPlaying: managerState.isPlaying,
        isRecording: managerState.isRecording,
        currentPosition: managerState.currentPosition,
        tempo: managerState.tempo,
        masterVolume: managerState.masterVolume,
        sampleRate: engineState.sampleRate,
        latency: engineState.latency,
      });
    } catch (error) {
      console.error('Failed to initialize audio engine:', error);
      throw error;
    }
  }, [state.isInitialized]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Transport controls
  const play = useCallback(() => managerRef.current?.play(), []);
  const pause = useCallback(() => managerRef.current?.pause(), []);
  const stop = useCallback(() => managerRef.current?.stop(), []);
  const toggle = useCallback(() => managerRef.current?.toggle(), []);
  
  const setPosition = useCallback((ticks: number) => {
    managerRef.current?.setPosition(ticks);
    setState(prev => ({ ...prev, currentPosition: ticks }));
  }, []);
  
  const setTempo = useCallback((bpm: number) => {
    managerRef.current?.setTempo(bpm);
    setState(prev => ({ ...prev, tempo: bpm }));
  }, []);
  
  const setLoopEnabled = useCallback((enabled: boolean) => {
    managerRef.current?.setLoopEnabled(enabled);
  }, []);
  
  const setLoopRegion = useCallback((start: number, end: number) => {
    managerRef.current?.setLoopRegion(start, end);
  }, []);
  
  const toggleMetronome = useCallback(() => {
    return managerRef.current?.toggleMetronome() || false;
  }, []);

  // Track management
  const createTrack = useCallback((trackId: string, instrumentType: InstrumentType, instrumentId: string) => {
    return managerRef.current?.createTrack(trackId, instrumentType, instrumentId) || null;
  }, []);
  
  const deleteTrack = useCallback((trackId: string) => {
    managerRef.current?.deleteTrack(trackId);
  }, []);
  
  const getTrackInstrument = useCallback((trackId: string) => {
    return managerRef.current?.getTrackInstrument(trackId) || null;
  }, []);
  
  const setTrackInstrument = useCallback((trackId: string, instrument: BaseInstrument) => {
    managerRef.current?.setTrackInstrument(trackId, instrument);
  }, []);

  // Pattern management
  const createPattern = useCallback((patternId: string, trackId: string, name: string, length?: number) => {
    return managerRef.current?.createPattern(patternId, trackId, name, length) || null;
  }, []);
  
  const addNoteToPattern = useCallback((patternId: string, note: MidiNote) => {
    return managerRef.current?.addNoteToPattern(patternId, note) || false;
  }, []);
  
  const removeNoteFromPattern = useCallback((patternId: string, noteIndex: number) => {
    return managerRef.current?.removeNoteFromPattern(patternId, noteIndex) || false;
  }, []);
  
  const setCurrentPattern = useCallback((patternId: string) => {
    return managerRef.current?.setCurrentPattern(patternId) || false;
  }, []);

  // Mixer
  const setChannelVolume = useCallback((channelId: string, volume: number) => {
    managerRef.current?.setChannelVolume(channelId, volume);
  }, []);
  
  const setChannelPan = useCallback((channelId: string, pan: number) => {
    managerRef.current?.setChannelPan(channelId, pan);
  }, []);
  
  const setChannelMute = useCallback((channelId: string, muted: boolean) => {
    managerRef.current?.setChannelMute(channelId, muted);
  }, []);
  
  const setChannelSolo = useCallback((channelId: string, soloed: boolean) => {
    managerRef.current?.setChannelSolo(channelId, soloed);
  }, []);
  
  const setMasterVolume = useCallback((volume: number) => {
    managerRef.current?.setMasterVolume(volume);
    setState(prev => ({ ...prev, masterVolume: volume }));
  }, []);

  // Effects
  const addEffectToChannel = useCallback((channelId: string, effect: BaseEffect) => {
    return managerRef.current?.addEffectToChannel(channelId, effect) || false;
  }, []);
  
  const removeEffectFromChannel = useCallback((channelId: string, effectId: string) => {
    return managerRef.current?.removeEffectFromChannel(channelId, effectId) || false;
  }, []);

  // Note preview
  const playNotePreview = useCallback((trackId: string, noteNumber: number, velocity: number = 100) => {
    managerRef.current?.playNotePreview(trackId, noteNumber, velocity);
  }, []);
  
  const stopNotePreview = useCallback((trackId: string, noteNumber: number) => {
    managerRef.current?.stopNotePreview(trackId, noteNumber);
  }, []);
  
  const stopAllNotePreviews = useCallback((trackId: string) => {
    managerRef.current?.stopAllNotePreviews(trackId);
  }, []);

  // Metering
  const getStereoLevels = useCallback(() => {
    return managerRef.current?.getStereoLevels() || { left: 0, right: 0 };
  }, []);
  
  const getFrequencyData = useCallback(() => {
    return managerRef.current?.getFrequencyData() || new Uint8Array(0);
  }, []);
  
  const getTimeDomainData = useCallback(() => {
    return managerRef.current?.getTimeDomainData() || new Uint8Array(0);
  }, []);
  
  const getChannelVUMeterData = useCallback((channelId: string) => {
    return managerRef.current?.getChannelVUMeterData(channelId) || null;
  }, []);

  // Factories
  const createInstrument = useCallback((type: InstrumentType, id: string, name?: string) => {
    if (!instrumentFactoryRef.current) return null;
    return instrumentFactoryRef.current.create(type, id, name);
  }, []);
  
  const createEffect = useCallback((type: EffectType, id: string, name?: string) => {
    if (!effectFactoryRef.current) return null;
    return effectFactoryRef.current.create(type, id, name);
  }, []);

  // Suspend/Resume
  const suspend = useCallback(async () => {
    await engineRef.current?.suspend();
  }, []);
  
  const resume = useCallback(async () => {
    await engineRef.current?.resume();
  }, []);

  return {
    state,
    initialize,
    engine: engineRef.current,
    manager: managerRef.current,
    play,
    pause,
    stop,
    toggle,
    setPosition,
    setTempo,
    setLoopEnabled,
    setLoopRegion,
    toggleMetronome,
    createTrack,
    deleteTrack,
    getTrackInstrument,
    setTrackInstrument,
    createPattern,
    addNoteToPattern,
    removeNoteFromPattern,
    setCurrentPattern,
    setChannelVolume,
    setChannelPan,
    setChannelMute,
    setChannelSolo,
    setMasterVolume,
    addEffectToChannel,
    removeEffectFromChannel,
    playNotePreview,
    stopNotePreview,
    stopAllNotePreviews,
    getStereoLevels,
    getFrequencyData,
    getTimeDomainData,
    getChannelVUMeterData,
    createInstrument,
    createEffect,
    suspend,
    resume,
  };
}

/**
 * Hook for note preview functionality
 */
export function useNotePreview(trackId: string) {
  const { playNotePreview, stopNotePreview, stopAllNotePreviews, state } = useAudioEngine();
  
  const playNote = useCallback((noteNumber: number, velocity: number = 100) => {
    if (state.isInitialized) {
      playNotePreview(trackId, noteNumber, velocity);
    }
  }, [trackId, playNotePreview, state.isInitialized]);
  
  const stopNote = useCallback((noteNumber: number) => {
    if (state.isInitialized) {
      stopNotePreview(trackId, noteNumber);
    }
  }, [trackId, stopNotePreview, state.isInitialized]);
  
  const stopAll = useCallback(() => {
    if (state.isInitialized) {
      stopAllNotePreviews(trackId);
    }
  }, [trackId, stopAllNotePreviews, state.isInitialized]);
  
  return { playNote, stopNote, stopAll };
}

/**
 * Hook for metering data with animation frame updates
 */
export function useMeteringData(channelId?: string) {
  const { getStereoLevels, getChannelVUMeterData, state } = useAudioEngine();
  const [levels, setLevels] = useState({ left: 0, right: 0, peakL: 0, peakR: 0 });
  const animationFrameRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!state.isInitialized) return;
    
    const updateLevels = () => {
      if (channelId) {
        const vuData = getChannelVUMeterData(channelId);
        if (vuData) {
          setLevels({
            left: vuData.rmsL,
            right: vuData.rmsR,
            peakL: vuData.peakL,
            peakR: vuData.peakR,
          });
        }
      } else {
        const stereo = getStereoLevels();
        setLevels({
          left: stereo.left,
          right: stereo.right,
          peakL: stereo.left,
          peakR: stereo.right,
        });
      }
      animationFrameRef.current = requestAnimationFrame(updateLevels);
    };
    
    animationFrameRef.current = requestAnimationFrame(updateLevels);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state.isInitialized, channelId, getStereoLevels, getChannelVUMeterData]);
  
  return levels;
}

export default useAudioEngine;