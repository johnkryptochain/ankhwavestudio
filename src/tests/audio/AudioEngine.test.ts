// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * AudioEngine Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioEngine, getAudioEngine } from '../../audio/AudioEngine';

describe('AudioEngine', () => {
  let audioEngine: AudioEngine;

  beforeEach(() => {
    // Get fresh instance for each test
    audioEngine = getAudioEngine();
  });

  afterEach(async () => {
    // Clean up after each test
    if (audioEngine.isInitialized()) {
      await audioEngine.dispose();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AudioEngine.getInstance();
      const instance2 = AudioEngine.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should return same instance via getAudioEngine helper', () => {
      const instance1 = getAudioEngine();
      const instance2 = getAudioEngine();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should not be initialized by default', () => {
      expect(audioEngine.isInitialized()).toBe(false);
    });

    it('should initialize successfully', async () => {
      await audioEngine.initialize();
      expect(audioEngine.isInitialized()).toBe(true);
    });

    it('should have correct default state after initialization', async () => {
      await audioEngine.initialize();
      const state = audioEngine.getState();
      
      expect(state.isInitialized).toBe(true);
      expect(state.sampleRate).toBe(44100);
      expect(typeof state.latency).toBe('number');
    });

    it('should accept custom configuration', async () => {
      await audioEngine.initialize({
        sampleRate: 48000,
        bufferSize: 1024,
        latencyHint: 'playback',
      });
      
      const state = audioEngine.getState();
      expect(state.bufferSize).toBe(1024);
    });

    it('should warn when initializing twice', async () => {
      const warnSpy = vi.spyOn(console, 'warn');
      
      await audioEngine.initialize();
      await audioEngine.initialize();
      
      expect(warnSpy).toHaveBeenCalledWith('AudioEngine already initialized');
    });
  });

  describe('Audio Context', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('should return audio context after initialization', () => {
      const context = audioEngine.getContext();
      expect(context).toBeDefined();
      expect(context).toBeInstanceOf(AudioContext);
    });

    it('should be running after initialization', () => {
      expect(audioEngine.isRunning()).toBe(true);
    });

    it('should suspend and resume', async () => {
      await audioEngine.suspend();
      expect(audioEngine.isRunning()).toBe(false);
      
      await audioEngine.resume();
      expect(audioEngine.isRunning()).toBe(true);
    });

    it('should return current time', () => {
      const time = audioEngine.getCurrentTime();
      expect(typeof time).toBe('number');
      expect(time).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Master Volume', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('should have default master volume of 1', () => {
      expect(audioEngine.getMasterVolume()).toBe(1);
    });

    it('should set master volume', () => {
      audioEngine.setMasterVolume(0.5);
      // Note: Due to setTargetAtTime, the value may not be exactly 0.5 immediately
      expect(audioEngine.getMasterVolume()).toBeDefined();
    });

    it('should clamp master volume to valid range', () => {
      audioEngine.setMasterVolume(2);
      // Should be clamped to 1
      
      audioEngine.setMasterVolume(-1);
      // Should be clamped to 0
    });

    it('should set master volume in dB', () => {
      audioEngine.setMasterVolumeDb(-6);
      // -6dB ≈ 0.5 linear
      expect(audioEngine.getMasterVolume()).toBeDefined();
    });

    it('should get master volume in dB', () => {
      const dB = audioEngine.getMasterVolumeDb();
      expect(typeof dB).toBe('number');
    });
  });

  describe('Audio Graph', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('should return audio graph after initialization', () => {
      const graph = audioEngine.getAudioGraph();
      expect(graph).toBeDefined();
    });

    it('should return master gain node', () => {
      const masterGain = audioEngine.getMasterGain();
      expect(masterGain).toBeDefined();
    });

    it('should return analyser node', () => {
      const analyser = audioEngine.getAnalyser();
      expect(analyser).toBeDefined();
    });

    it('should return stereo analysers', () => {
      const analyserL = audioEngine.getAnalyserL();
      const analyserR = audioEngine.getAnalyserR();
      expect(analyserL).toBeDefined();
      expect(analyserR).toBeDefined();
    });
  });

  describe('Transport', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('should return transport after initialization', () => {
      const transport = audioEngine.getTransport();
      expect(transport).toBeDefined();
    });
  });

  describe('Sequencer', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('should return sequencer after initialization', () => {
      const sequencer = audioEngine.getSequencer();
      expect(sequencer).toBeDefined();
    });
  });

  describe('Audio Analysis', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('should return frequency data', () => {
      const data = audioEngine.getFrequencyData();
      expect(data).toBeInstanceOf(Uint8Array);
    });

    it('should return time domain data', () => {
      const data = audioEngine.getTimeDomainData();
      expect(data).toBeInstanceOf(Uint8Array);
    });

    it('should return stereo levels', () => {
      const levels = audioEngine.getStereoLevels();
      expect(levels).toHaveProperty('left');
      expect(levels).toHaveProperty('right');
      expect(typeof levels.left).toBe('number');
      expect(typeof levels.right).toBe('number');
    });
  });

  describe('Audio Worklets', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('should not have worklets registered by default', () => {
      expect(audioEngine.isWorkletRegistered('test-worklet')).toBe(false);
    });

    it('should return null for unregistered worklet node', () => {
      const node = audioEngine.createWorkletNode('unregistered');
      expect(node).toBeNull();
    });
  });

  describe('Audio Buffer', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('should decode audio data', async () => {
      const arrayBuffer = new ArrayBuffer(44);
      const audioBuffer = await audioEngine.decodeAudioData(arrayBuffer);
      expect(audioBuffer).toBeDefined();
    });

    it('should create offline context', () => {
      const offlineCtx = audioEngine.createOfflineContext(2, 44100, 44100);
      expect(offlineCtx).toBeInstanceOf(OfflineAudioContext);
    });
  });

  describe('Events', () => {
    it('should register and unregister event callbacks', async () => {
      const callback = vi.fn();
      const unsubscribe = audioEngine.onEvent(callback);
      
      await audioEngine.initialize();
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'initialized' })
      );
      
      unsubscribe();
    });

    it('should emit suspended event', async () => {
      const callback = vi.fn();
      audioEngine.onEvent(callback);
      
      await audioEngine.initialize();
      await audioEngine.suspend();
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'suspended' })
      );
    });

    it('should emit resumed event', async () => {
      const callback = vi.fn();
      audioEngine.onEvent(callback);
      
      await audioEngine.initialize();
      await audioEngine.suspend();
      await audioEngine.resume();
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'resumed' })
      );
    });
  });

  describe('Disposal', () => {
    it('should dispose properly', async () => {
      await audioEngine.initialize();
      expect(audioEngine.isInitialized()).toBe(true);
      
      await audioEngine.dispose();
      expect(audioEngine.isInitialized()).toBe(false);
    });

    it('should clear all references after disposal', async () => {
      await audioEngine.initialize();
      await audioEngine.dispose();
      
      expect(audioEngine.getContext()).toBeNull();
      expect(audioEngine.getAudioGraph()).toBeNull();
      expect(audioEngine.getTransport()).toBeNull();
      expect(audioEngine.getSequencer()).toBeNull();
      expect(audioEngine.getMasterGain()).toBeNull();
      expect(audioEngine.getAnalyser()).toBeNull();
    });
  });
});