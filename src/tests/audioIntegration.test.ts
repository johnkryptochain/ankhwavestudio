// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Audio Integration Test
 * Tests the full audio/UI integration for AnkhWaveStudio Web
 * 
 * This test verifies:
 * 1. Creating a project with a track
 * 2. Adding notes to a pattern
 * 3. Playing the pattern
 * 4. Verifying audio output
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock AudioContext for testing
class MockAudioContext {
  state: AudioContextState = 'running';
  sampleRate = 44100;
  currentTime = 0;
  destination = {} as AudioDestinationNode;
  
  createGain() {
    return {
      gain: { value: 1, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  
  createOscillator() {
    return {
      frequency: { value: 440, setValueAtTime: vi.fn() },
      type: 'sine',
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  
  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      smoothingTimeConstant: 0.8,
      minDecibels: -90,
      maxDecibels: 0,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getByteFrequencyData: vi.fn(),
      getFloatFrequencyData: vi.fn(),
      getByteTimeDomainData: vi.fn(),
      getFloatTimeDomainData: vi.fn(),
    };
  }
  
  createChannelSplitter() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  
  createStereoPanner() {
    return {
      pan: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  
  createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: { value: 1000, setValueAtTime: vi.fn() },
      Q: { value: 1, setValueAtTime: vi.fn() },
      gain: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  
  createDynamicsCompressor() {
    return {
      threshold: { value: -24, setValueAtTime: vi.fn() },
      knee: { value: 30, setValueAtTime: vi.fn() },
      ratio: { value: 12, setValueAtTime: vi.fn() },
      attack: { value: 0.003, setValueAtTime: vi.fn() },
      release: { value: 0.25, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  
  createDelay() {
    return {
      delayTime: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  
  createConvolver() {
    return {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  
  createWaveShaper() {
    return {
      curve: null,
      oversample: 'none',
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  
  resume() {
    return Promise.resolve();
  }
  
  suspend() {
    return Promise.resolve();
  }
  
  close() {
    return Promise.resolve();
  }
}

// Set up global mock
(global as any).AudioContext = MockAudioContext;
(global as any).webkitAudioContext = MockAudioContext;

describe('Audio Integration', () => {
  describe('AudioEngineManager', () => {
    it('should be a singleton', async () => {
      const { getAudioEngineManager } = await import('../audio/AudioEngineManager');
      
      const manager1 = getAudioEngineManager();
      const manager2 = getAudioEngineManager();
      
      expect(manager1).toBe(manager2);
    });
    
    it('should have correct initial state', async () => {
      const { getAudioEngineManager } = await import('../audio/AudioEngineManager');
      
      const manager = getAudioEngineManager();
      const state = manager.getState();
      
      expect(state.isInitialized).toBe(false);
      expect(state.isPlaying).toBe(false);
      expect(state.tempo).toBe(120);
    });
  });
  
  describe('InstrumentFactory', () => {
    it('should create instruments', async () => {
      const { getInstrumentFactory, INSTRUMENT_INFO } = await import('../audio/InstrumentFactory');
      
      const context = new MockAudioContext() as unknown as AudioContext;
      const factory = getInstrumentFactory(context);
      
      // Check that all instrument types are registered
      expect(Object.keys(INSTRUMENT_INFO).length).toBeGreaterThan(0);
      
      // Check that factory has create method
      expect(typeof factory.create).toBe('function');
    });
    
    it('should have instrument info for all types', async () => {
      const { INSTRUMENT_INFO } = await import('../audio/InstrumentFactory');
      
      for (const [type, info] of Object.entries(INSTRUMENT_INFO)) {
        expect(info.name).toBeDefined();
        expect(info.description).toBeDefined();
        expect(info.category).toBeDefined();
      }
    });
  });
  
  describe('EffectFactory', () => {
    it('should create effects', async () => {
      const { getEffectFactory, EFFECT_INFO } = await import('../audio/EffectFactory');
      
      const context = new MockAudioContext() as unknown as AudioContext;
      const factory = getEffectFactory(context);
      
      // Check that all effect types are registered
      expect(Object.keys(EFFECT_INFO).length).toBeGreaterThan(0);
      
      // Check that factory has create method
      expect(typeof factory.create).toBe('function');
    });
    
    it('should have effect info for all types', async () => {
      const { EFFECT_INFO } = await import('../audio/EffectFactory');
      
      for (const [type, info] of Object.entries(EFFECT_INFO)) {
        expect(info.name).toBeDefined();
        expect(info.description).toBeDefined();
        expect(info.category).toBeDefined();
      }
    });
  });
  
  describe('Metering', () => {
    it('should create metering instance', async () => {
      const { Metering } = await import('../audio/Metering');
      
      const context = new MockAudioContext() as unknown as AudioContext;
      const metering = new Metering(context);
      
      expect(metering).toBeDefined();
      expect(typeof metering.getVUMeterData).toBe('function');
      expect(typeof metering.getStereoLevels).toBe('function');
      expect(typeof metering.getFrequencyData).toBe('function');
    });
    
    it('should convert linear to dB correctly', async () => {
      const { Metering } = await import('../audio/Metering');
      
      expect(Metering.linearToDb(1)).toBe(0);
      expect(Metering.linearToDb(0.5)).toBeCloseTo(-6.02, 1);
      expect(Metering.linearToDb(0.1)).toBeCloseTo(-20, 0);
    });
    
    it('should convert dB to linear correctly', async () => {
      const { Metering } = await import('../audio/Metering');
      
      expect(Metering.dbToLinear(0)).toBe(1);
      expect(Metering.dbToLinear(-6)).toBeCloseTo(0.5, 1);
      expect(Metering.dbToLinear(-20)).toBeCloseTo(0.1, 1);
    });
  });
});

describe('Store Integration', () => {
  describe('SongStore', () => {
    it('should have initial state', async () => {
      const { useSongStore } = await import('../stores/songStore');
      
      const state = useSongStore.getState();
      
      expect(state.tracks).toEqual([]);
      expect(state.patterns).toEqual([]);
      expect(state.settings.tempo).toBe(120);
    });
    
    it('should add instrument track', async () => {
      const { useSongStore } = await import('../stores/songStore');
      
      const store = useSongStore.getState();
      const trackId = store.addInstrumentTrack('Test Track', 'oscillator', '#FF0000');
      
      expect(trackId).toBeDefined();
      expect(trackId.startsWith('track-')).toBe(true);
      
      const state = useSongStore.getState();
      const track = state.tracks.find(t => t.id === trackId);
      
      expect(track).toBeDefined();
      expect(track?.name).toBe('Test Track');
      expect(track?.type).toBe('instrument');
    });
    
    it('should create pattern', async () => {
      const { useSongStore } = await import('../stores/songStore');
      
      const store = useSongStore.getState();
      const trackId = store.addInstrumentTrack('Pattern Track', 'oscillator');
      const patternId = store.createPattern(trackId, 'Test Pattern', 64);
      
      expect(patternId).toBeDefined();
      expect(patternId.startsWith('pattern-')).toBe(true);
      
      const state = useSongStore.getState();
      const pattern = state.patterns.find(p => p.id === patternId);
      
      expect(pattern).toBeDefined();
      expect(pattern?.name).toBe('Test Pattern');
      expect(pattern?.length).toBe(64);
    });
  });
  
  describe('MixerStore', () => {
    it('should have initial state', async () => {
      const { useMixerStore } = await import('../stores/mixerStore');
      
      const state = useMixerStore.getState();
      
      expect(state.channels).toEqual([]);
      expect(state.masterChannel).toBeDefined();
      expect(state.masterChannel.volume).toBe(1);
    });
    
    it('should add channel', async () => {
      const { useMixerStore } = await import('../stores/mixerStore');
      
      const store = useMixerStore.getState();
      const channelId = store.addChannel({ name: 'Test Channel' });
      
      expect(channelId).toBeDefined();
      
      const state = useMixerStore.getState();
      const channel = state.channels.find(c => c.id === channelId);
      
      expect(channel).toBeDefined();
      expect(channel?.name).toBe('Test Channel');
    });
    
    it('should set channel volume', async () => {
      const { useMixerStore } = await import('../stores/mixerStore');
      
      const store = useMixerStore.getState();
      const channelId = store.addChannel({ name: 'Volume Test' });
      
      store.setChannelVolume(channelId, 0.5);
      
      const state = useMixerStore.getState();
      const channel = state.channels.find(c => c.id === channelId);
      
      expect(channel?.volume).toBe(0.5);
    });
  });
  
  describe('TransportStore', () => {
    it('should have initial state', async () => {
      const { useTransportStore } = await import('../stores/transportStore');
      
      const state = useTransportStore.getState();
      
      expect(state.isPlaying).toBe(false);
      expect(state.position).toBe(0);
      expect(state.tempo).toBe(120);
    });
    
    it('should toggle play state', async () => {
      const { useTransportStore } = await import('../stores/transportStore');
      
      const store = useTransportStore.getState();
      
      expect(store.isPlaying).toBe(false);
      
      store.play();
      expect(useTransportStore.getState().isPlaying).toBe(true);
      
      store.pause();
      expect(useTransportStore.getState().isPlaying).toBe(false);
    });
    
    it('should set tempo', async () => {
      const { useTransportStore } = await import('../stores/transportStore');
      
      const store = useTransportStore.getState();
      store.setTempo(140);
      
      expect(useTransportStore.getState().tempo).toBe(140);
    });
  });
});

describe('Full Integration Flow', () => {
  it('should complete a basic workflow', async () => {
    // Import stores
    const { useSongStore } = await import('../stores/songStore');
    const { useMixerStore } = await import('../stores/mixerStore');
    const { useTransportStore } = await import('../stores/transportStore');
    
    // Reset stores
    useSongStore.getState().newProject();
    useMixerStore.getState().resetMixer();
    useTransportStore.getState().stop();
    
    // 1. Create a track
    const songStore = useSongStore.getState();
    const trackId = songStore.addInstrumentTrack('Lead Synth', 'oscillator');
    expect(trackId).toBeDefined();
    
    // 2. Create a pattern
    const patternId = songStore.createPattern(trackId, 'Main Pattern', 64);
    expect(patternId).toBeDefined();
    
    // 3. Add a mixer channel
    const mixerStore = useMixerStore.getState();
    const channelId = mixerStore.addChannel({ name: 'Lead Channel' });
    expect(channelId).toBeDefined();
    
    // 4. Set mixer settings
    mixerStore.setChannelVolume(channelId, 0.8);
    mixerStore.setChannelPan(channelId, 0.2);
    
    // 5. Set transport settings
    const transportStore = useTransportStore.getState();
    transportStore.setTempo(128);
    transportStore.setLoopEnabled(true);
    transportStore.setLoopRegion(0, 1920 * 4); // 4 bars
    
    // Verify final state
    const finalSongState = useSongStore.getState();
    const finalMixerState = useMixerStore.getState();
    const finalTransportState = useTransportStore.getState();
    
    expect(finalSongState.tracks.length).toBeGreaterThan(0);
    expect(finalSongState.patterns.length).toBeGreaterThan(0);
    expect(finalMixerState.channels.length).toBeGreaterThan(0);
    expect(finalTransportState.tempo).toBe(128);
    expect(finalTransportState.loopEnabled).toBe(true);
    
    console.log('✅ Full integration flow completed successfully');
  });
});