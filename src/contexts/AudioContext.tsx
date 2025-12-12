// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * AudioContext - React context for audio engine access
 * Provides audio engine to all components and handles audio context state
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AudioEngineManager, getAudioEngineManager, AudioEngineManagerState, AudioEngineManagerEvent } from '../audio/AudioEngineManager';
import { InstrumentFactory, getInstrumentFactory, InstrumentType } from '../audio/InstrumentFactory';
import { EffectFactory, getEffectFactory, EffectType } from '../audio/EffectFactory';
import { AudioEngine, getAudioEngine } from '../audio/AudioEngine';

/**
 * Audio context value interface
 */
export interface AudioContextValue {
  // State
  isInitialized: boolean;
  isInitializing: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  currentPosition: number;
  tempo: number;
  masterVolume: number;
  audioContextState: AudioContextState | null;
  
  // Initialization
  initialize: () => Promise<void>;
  
  // Manager access
  manager: AudioEngineManager | null;
  engine: AudioEngine | null;
  instrumentFactory: InstrumentFactory | null;
  effectFactory: EffectFactory | null;
  
  // Transport controls
  play: () => void;
  pause: () => void;
  stop: () => void;
  toggle: () => void;
  setPosition: (ticks: number) => void;
  setTempo: (bpm: number) => void;
  
  // Metering
  getStereoLevels: () => { left: number; right: number };
  getFrequencyData: () => Uint8Array;
  
  // Instrument helpers
  createInstrument: (type: InstrumentType, id: string, name?: string) => ReturnType<InstrumentFactory['create']> | null;
  
  // Effect helpers
  createEffect: (type: EffectType, id: string, name?: string) => ReturnType<EffectFactory['create']> | null;
}

// Create the context with default values
const AudioContextReact = createContext<AudioContextValue | null>(null);

/**
 * Audio context provider props
 */
interface AudioProviderProps {
  children: React.ReactNode;
}

/**
 * Audio context provider component
 */
export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [tempo, setTempoState] = useState(120);
  const [masterVolume, setMasterVolumeState] = useState(1.0);
  const [audioContextState, setAudioContextState] = useState<AudioContextState | null>(null);
  
  // Refs for manager and factories
  const managerRef = useRef<AudioEngineManager | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const instrumentFactoryRef = useRef<InstrumentFactory | null>(null);
  const effectFactoryRef = useRef<EffectFactory | null>(null);
  
  // Position update interval
  const positionIntervalRef = useRef<number | null>(null);

  /**
   * Initialize the audio engine
   */
  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) return;
    
    setIsInitializing(true);
    
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
        setAudioContextState(context.state);
        
        // Listen for context state changes
        context.onstatechange = () => {
          setAudioContextState(context.state);
        };
      }
      
      // Set up event listener
      manager.onEvent((event: AudioEngineManagerEvent) => {
        switch (event.type) {
          case 'stateChange':
            const data = event.data as { isPlaying?: boolean; position?: number };
            if (data.isPlaying !== undefined) setIsPlaying(data.isPlaying);
            if (data.position !== undefined) setCurrentPosition(data.position);
            break;
          case 'positionUpdate':
            const posData = event.data as { position: number };
            setCurrentPosition(posData.position);
            break;
        }
      });
      
      // Update state from manager
      const state = manager.getState();
      setIsPlaying(state.isPlaying);
      setIsRecording(state.isRecording);
      setCurrentPosition(state.currentPosition);
      setTempoState(state.tempo);
      setMasterVolumeState(state.masterVolume);
      
      setIsInitialized(true);
      setIsInitializing(false);
      console.log('Audio context initialized');
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      setIsInitializing(false);
      throw error;
    }
  }, [isInitialized, isInitializing]);

  /**
   * Clean up on unmount
   */
  useEffect(() => {
    return () => {
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
      }
      // Don't dispose the manager here - it's a singleton
    };
  }, []);

  // Transport controls
  const play = useCallback(() => {
    managerRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    managerRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    managerRef.current?.stop();
  }, []);

  const toggle = useCallback(() => {
    managerRef.current?.toggle();
  }, []);

  const setPosition = useCallback((ticks: number) => {
    managerRef.current?.setPosition(ticks);
    setCurrentPosition(ticks);
  }, []);

  const setTempo = useCallback((bpm: number) => {
    managerRef.current?.setTempo(bpm);
    setTempoState(bpm);
  }, []);

  // Metering
  const getStereoLevels = useCallback(() => {
    return managerRef.current?.getStereoLevels() || { left: 0, right: 0 };
  }, []);

  const getFrequencyData = useCallback(() => {
    return managerRef.current?.getFrequencyData() || new Uint8Array(0);
  }, []);

  // Instrument creation helper
  const createInstrument = useCallback((type: InstrumentType, id: string, name?: string) => {
    if (!instrumentFactoryRef.current) return null;
    return instrumentFactoryRef.current.create(type, id, name);
  }, []);

  // Effect creation helper
  const createEffect = useCallback((type: EffectType, id: string, name?: string) => {
    if (!effectFactoryRef.current) return null;
    return effectFactoryRef.current.create(type, id, name);
  }, []);

  // Context value
  const value: AudioContextValue = {
    isInitialized,
    isInitializing,
    isPlaying,
    isRecording,
    currentPosition,
    tempo,
    masterVolume,
    audioContextState,
    initialize,
    manager: managerRef.current,
    engine: engineRef.current,
    instrumentFactory: instrumentFactoryRef.current,
    effectFactory: effectFactoryRef.current,
    play,
    pause,
    stop,
    toggle,
    setPosition,
    setTempo,
    getStereoLevels,
    getFrequencyData,
    createInstrument,
    createEffect,
  };

  return (
    <AudioContextReact.Provider value={value}>
      {children}
    </AudioContextReact.Provider>
  );
};

/**
 * Hook to access the audio context
 */
export const useAudioContext = (): AudioContextValue => {
  const context = useContext(AudioContextReact);
  if (!context) {
    throw new Error('useAudioContext must be used within an AudioProvider');
  }
  return context;
};

/**
 * Hook to check if audio is initialized
 */
export const useAudioInitialized = (): boolean => {
  const context = useContext(AudioContextReact);
  return context?.isInitialized || false;
};

/**
 * Hook to get audio transport state
 */
export const useAudioTransport = () => {
  const context = useContext(AudioContextReact);
  return {
    isPlaying: context?.isPlaying || false,
    isRecording: context?.isRecording || false,
    currentPosition: context?.currentPosition || 0,
    tempo: context?.tempo || 120,
    play: context?.play || (() => {}),
    pause: context?.pause || (() => {}),
    stop: context?.stop || (() => {}),
    toggle: context?.toggle || (() => {}),
    setPosition: context?.setPosition || (() => {}),
    setTempo: context?.setTempo || (() => {}),
  };
};

export default AudioProvider;