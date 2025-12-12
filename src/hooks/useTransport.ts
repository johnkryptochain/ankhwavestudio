// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * useTransport - Hook for controlling playback transport
 */

import { useCallback } from 'react';
import { useTransportStore } from '../stores/transportStore';

interface UseTransportReturn {
  // State
  isPlaying: boolean;
  isPaused: boolean;
  isRecording: boolean;
  tempo: number;
  timeSignature: { numerator: number; denominator: number };
  currentPosition: number;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  
  // Actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  toggleRecord: () => void;
  setTempo: (tempo: number) => void;
  setTimeSignature: (numerator: number, denominator: number) => void;
  setPosition: (position: number) => void;
  setLoop: (enabled: boolean, start?: number, end?: number) => void;
}

export function useTransport(): UseTransportReturn {
  const {
    isPlaying,
    isPaused,
    isRecording,
    tempo,
    timeSignature,
    position,
    loopEnabled,
    loopStart,
    loopEnd,
    play: storePlay,
    pause: storePause,
    stop: storeStop,
    setTempo: storeSetTempo,
    setTimeSignature: storeSetTimeSignature,
    setPosition: storeSetPosition,
    setLoopEnabled,
    setLoopStart,
    setLoopEnd,
    startRecording,
    stopRecording,
  } = useTransportStore();

  const play = useCallback(() => {
    storePlay();
  }, [storePlay]);

  const pause = useCallback(() => {
    storePause();
  }, [storePause]);

  const stop = useCallback(() => {
    storeStop();
  }, [storeStop]);

  const toggleRecord = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const setTempo = useCallback((newTempo: number) => {
    storeSetTempo(Math.max(20, Math.min(999, newTempo)));
  }, [storeSetTempo]);

  const setTimeSignature = useCallback((numerator: number, denominator: number) => {
    storeSetTimeSignature({ numerator, denominator });
  }, [storeSetTimeSignature]);

  const setPosition = useCallback((position: number) => {
    storeSetPosition(Math.max(0, position));
  }, [storeSetPosition]);

  const setLoop = useCallback((enabled: boolean, start?: number, end?: number) => {
    setLoopEnabled(enabled);
    if (start !== undefined) {
      setLoopStart(start);
    }
    if (end !== undefined) {
      setLoopEnd(end);
    }
  }, [setLoopEnabled, setLoopStart, setLoopEnd]);

  return {
    isPlaying,
    isPaused,
    isRecording,
    tempo,
    timeSignature,
    currentPosition: position,
    loopEnabled,
    loopStart,
    loopEnd,
    play,
    pause,
    stop,
    toggleRecord,
    setTempo,
    setTimeSignature,
    setPosition,
    setLoop,
  };
}

export default useTransport;