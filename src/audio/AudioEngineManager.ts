// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * AudioEngineManager - Singleton that manages the entire audio system
 * Connects all audio components (AudioEngine, Transport, Sequencer, Mixer)
 * and provides a unified interface for the UI
 */

import { AudioEngine, getAudioEngine } from './AudioEngine';
import { AudioGraph } from './AudioGraph';
import { Transport } from './Transport';
import { Sequencer, Pattern } from './Sequencer';
import { MixerChannel } from './MixerChannel';
import { BaseInstrument } from './instruments/BaseInstrument';
import { BaseEffect } from './effects/BaseEffect';
import { InstrumentFactory, InstrumentType } from './InstrumentFactory';
import { SamplePlayer, SampleClipData, LoadedSample } from './SamplePlayer';
import type { MidiNote, EffectParams } from '../types/audio';

/**
 * Track audio data - links a track to its audio components
 */
export interface TrackAudioData {
  trackId: string;
  instrument: BaseInstrument | null;
  mixerChannelId: string;
  patternIds: string[];
}

/**
 * Audio engine manager state
 */
export interface AudioEngineManagerState {
  isInitialized: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  currentPosition: number;
  tempo: number;
  masterVolume: number;
}

/**
 * Audio engine manager event
 */
export interface AudioEngineManagerEvent {
  type: 'initialized' | 'stateChange' | 'trackAdded' | 'trackRemoved' | 
        'effectAdded' | 'effectRemoved' | 'positionUpdate' | 'beat' | 'bar';
  data?: unknown;
}

export type AudioEngineManagerEventCallback = (event: AudioEngineManagerEvent) => void;

/**
 * Singleton class that manages the entire audio system
 */
export class AudioEngineManager {
  private static instance: AudioEngineManager | null = null;
  
  // Core audio components
  private audioEngine: AudioEngine | null = null;
  private audioGraph: AudioGraph | null = null;
  private transport: Transport | null = null;
  private sequencer: Sequencer | null = null;
  private samplePlayer: SamplePlayer | null = null;
  
  // Track management
  private trackAudioData: Map<string, TrackAudioData> = new Map();
  private instrumentInstances: Map<string, BaseInstrument> = new Map();
  private effectInstances: Map<string, BaseEffect> = new Map();
  
  // State
  private state: AudioEngineManagerState = {
    isInitialized: false,
    isPlaying: false,
    isRecording: false,
    currentPosition: 0,
    tempo: 120,
    masterVolume: 1.0,
  };
  
  // Event callbacks
  private eventCallbacks: AudioEngineManagerEventCallback[] = [];
  
  // Position update interval
  private positionUpdateInterval: number | null = null;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): AudioEngineManager {
    if (!AudioEngineManager.instance) {
      AudioEngineManager.instance = new AudioEngineManager();
    }
    return AudioEngineManager.instance;
  }

  /**
   * Initialize the audio engine manager
   * Must be called after a user gesture
   */
  public async initialize(): Promise<void> {
    if (this.state.isInitialized) {
      console.warn('AudioEngineManager already initialized');
      return;
    }

    try {
      // Initialize the core audio engine
      this.audioEngine = getAudioEngine();
      await this.audioEngine.initialize();
      
      // Get references to sub-components
      this.audioGraph = this.audioEngine.getAudioGraph();
      this.transport = this.audioEngine.getTransport();
      this.sequencer = this.audioEngine.getSequencer();
      
      if (!this.audioGraph || !this.transport || !this.sequencer) {
        throw new Error('Failed to get audio engine components');
      }
      
      // Initialize sample player
      const masterGain = this.audioEngine.getMasterGain();
      if (masterGain) {
        this.samplePlayer = new SamplePlayer(this.audioEngine.getContext()!, masterGain);
        this.samplePlayer.setTransportFunctions(
          () => this.transport!.getPosition(),
          (ticks) => this.transport!.ticksToSeconds(ticks),
          () => this.state.isPlaying
        );
      }
      
      // Set up transport event listeners
      this.setupTransportListeners();
      
      // Set up sequencer event listeners
      this.setupSequencerListeners();
      
      // Update state
      this.state.isInitialized = true;
      this.state.tempo = this.transport.getTempo();
      
      // Start position update loop
      this.startPositionUpdates();
      
      this.emitEvent({ type: 'initialized' });
      console.log('AudioEngineManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AudioEngineManager:', error);
      throw error;
    }
  }

  /**
   * Set up transport event listeners
   */
  private setupTransportListeners(): void {
    if (!this.transport) return;
    
    this.transport.onPlay(() => {
      this.state.isPlaying = true;
      // Start sample player
      if (this.samplePlayer) {
        this.samplePlayer.start();
      }
      this.emitEvent({ type: 'stateChange', data: { isPlaying: true } });
    });
    
    this.transport.onPause(() => {
      this.state.isPlaying = false;
      // Pause sample player
      if (this.samplePlayer) {
        this.samplePlayer.pause();
      }
      // Stop all notes on all instruments
      this.stopAllInstrumentNotes();
      this.emitEvent({ type: 'stateChange', data: { isPlaying: false } });
    });
    
    this.transport.onStop(() => {
      this.state.isPlaying = false;
      this.state.currentPosition = 0;
      // Stop sample player
      if (this.samplePlayer) {
        this.samplePlayer.stop();
      }
      // Stop all notes on all instruments
      this.stopAllInstrumentNotes();
      this.emitEvent({ type: 'stateChange', data: { isPlaying: false, position: 0 } });
    });
    
    this.transport.onBeat((beat) => {
      this.emitEvent({ type: 'beat', data: { beat } });
    });
    
    this.transport.onBar((bar) => {
      this.emitEvent({ type: 'bar', data: { bar } });
    });
  }

  /**
   * Set up sequencer event listeners
   */
  private setupSequencerListeners(): void {
    if (!this.sequencer) return;
    
    // Listen for note events and route to instruments
    this.sequencer.onNoteEvent((type, note, time) => {
      this.handleNoteEvent(type, note, time);
    });
  }

  /**
   * Handle note events from sequencer
   */
  private handleNoteEvent(type: 'noteOn' | 'noteOff', note: MidiNote, time: number): void {
    console.log(`[AudioEngineManager] Note event: ${type}, pitch: ${note.pitch}, trackId: ${note.trackId}`);
    
    // Find the instrument for this note's track
    const trackData = this.trackAudioData.get(note.trackId || '');
    if (!trackData) {
      console.warn(`[AudioEngineManager] No track data found for trackId: ${note.trackId}`);
      console.log('[AudioEngineManager] Available tracks:', Array.from(this.trackAudioData.keys()));
      return;
    }
    if (!trackData.instrument) {
      console.warn(`[AudioEngineManager] No instrument found for track: ${note.trackId}`);
      return;
    }
    
    console.log(`[AudioEngineManager] Triggering ${type} on instrument: ${trackData.instrument.getName()}`);
    
    if (type === 'noteOn') {
      trackData.instrument.noteOn(note.pitch, note.velocity);
    } else {
      trackData.instrument.noteOff(note.pitch);
    }
  }

  /**
   * Start position update loop
   */
  private startPositionUpdates(): void {
    if (this.positionUpdateInterval) return;
    
    this.positionUpdateInterval = window.setInterval(() => {
      if (this.transport && this.state.isPlaying) {
        // Double check transport state to ensure sync
        const transportState = this.transport.getState();
        if (!transportState.isPlaying && !transportState.isPaused) {
           // Transport stopped but we think we are playing
           this.state.isPlaying = false;
           this.emitEvent({ type: 'stateChange', data: { isPlaying: false } });
           return;
        }

        const position = this.transport.getPosition();
        if (position !== this.state.currentPosition) {
          this.state.currentPosition = position;
          this.emitEvent({ type: 'positionUpdate', data: { position } });
        }
      }
    }, 50); // Update every 50ms
  }

  /**
   * Stop position update loop
   */
  private stopPositionUpdates(): void {
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
  }

  // ==================== Transport Controls ====================

  /**
   * Start playback
   */
  public play(): void {
    if (!this.transport) return;
    this.transport.play();
  }

  /**
   * Pause playback
   */
  public pause(): void {
    if (!this.transport) return;
    this.transport.pause();
    // Stop all notes on all instruments
    this.stopAllInstrumentNotes();
  }

  /**
   * Stop all notes on all instruments
   */
  public stopAllInstrumentNotes(): void {
    for (const trackData of this.trackAudioData.values()) {
      if (trackData.instrument) {
        trackData.instrument.allNotesOff();
      }
    }
  }

  /**
   * Stop playback and reset position
   */
  public stop(): void {
    if (!this.transport) return;
    this.transport.stop();
    // Stop all notes on all instruments
    this.stopAllInstrumentNotes();
  }

  /**
   * Toggle playback
   */
  public toggle(): void {
    if (!this.transport) return;
    this.transport.toggle();
  }

  /**
   * Set playback position in ticks
   */
  public setPosition(ticks: number): void {
    if (!this.transport) return;
    this.transport.setPosition(ticks);
    this.state.currentPosition = ticks;
  }

  /**
   * Get current position in ticks
   */
  public getPosition(): number {
    return this.transport?.getPosition() || 0;
  }

  /**
   * Set tempo in BPM
   */
  public setTempo(bpm: number): void {
    if (!this.transport) return;
    this.transport.setTempo(bpm);
    this.state.tempo = bpm;
  }

  /**
   * Get current tempo
   */
  public getTempo(): number {
    return this.transport?.getTempo() || 120;
  }

  /**
   * Set loop enabled
   */
  public setLoopEnabled(enabled: boolean): void {
    if (!this.transport) return;
    this.transport.setLoopEnabled(enabled);
  }

  /**
   * Set loop region
   */
  public setLoopRegion(start: number, end: number): void {
    if (!this.transport) return;
    this.transport.setLoopRegion(start, end);
  }

  /**
   * Toggle metronome
   */
  public toggleMetronome(): boolean {
    if (!this.transport) return false;
    return this.transport.toggleMetronome();
  }

  // ==================== Track Management ====================

  /**
   * Create a track with an instrument
   */
  public createTrack(
    trackId: string,
    instrumentType: string,
    instrumentId: string,
    mixerChannelId?: string
  ): TrackAudioData | null {
    if (!this.audioGraph || !this.audioEngine) return null;
    
    // Create mixer channel if not specified
    const channelId = mixerChannelId || `channel-${trackId}`;
    let mixerChannel = this.audioGraph.getMixerChannel(channelId);
    if (!mixerChannel) {
      console.log(`[AudioEngineManager] Creating mixer channel: ${channelId}`);
      mixerChannel = this.audioGraph.createMixerChannel(channelId, `Track ${trackId}`);
    }
    
    // Create the instrument using InstrumentFactory
    const audioContext = this.audioEngine.getContext();
    if (!audioContext) {
      console.error('AudioContext not available');
      return null;
    }
    
    console.log(`[AudioEngineManager] AudioContext state: ${audioContext.state}`);
    
    const factory = new InstrumentFactory(audioContext);
    const instrument = factory.create(
      instrumentType as InstrumentType,
      instrumentId,
      instrumentType
    );
    
    console.log(`[AudioEngineManager] Created instrument: ${instrument.getName()}, type: ${instrument.getType()}`);
    
    // Connect instrument to mixer channel
    if (mixerChannel) {
      console.log(`[AudioEngineManager] Connecting instrument ${instrument.getName()} to mixer channel ${channelId}`);
      const mixerInput = mixerChannel.getInput();
      console.log(`[AudioEngineManager] Mixer input gain value: ${mixerInput.gain.value}`);
      instrument.connect(mixerInput);
    }
    
    // Create track audio data with the instrument
    const trackData: TrackAudioData = {
      trackId,
      instrument,
      mixerChannelId: channelId,
      patternIds: [],
    };
    
    this.trackAudioData.set(trackId, trackData);
    this.instrumentInstances.set(instrumentId, instrument);
    this.emitEvent({ type: 'trackAdded', data: { trackId, instrumentType } });
    
    console.log(`[AudioEngineManager] Created track ${trackId} with instrument ${instrumentType} (${instrumentId})`);
    console.log(`[AudioEngineManager] Total tracks: ${this.trackAudioData.size}`);
    
    return trackData;
  }

  /**
   * Replace the instrument for a track
   */
  public replaceTrackInstrument(
    trackId: string,
    instrumentType: string,
    instrumentId: string
  ): BaseInstrument | null {
    if (!this.audioGraph || !this.audioEngine) return null;
    
    const audioContext = this.audioEngine.getContext();
    if (!audioContext) return null;
    
    const factory = new InstrumentFactory(audioContext);
    const instrument = factory.create(
      instrumentType as InstrumentType,
      instrumentId,
      instrumentType
    );
    
    this.setTrackInstrument(trackId, instrument);
    return instrument;
  }

  /**
   * Set the instrument for a track
   */
  public setTrackInstrument(trackId: string, instrument: BaseInstrument): void {
    const trackData = this.trackAudioData.get(trackId);
    if (!trackData || !this.audioGraph) return;
    
    // Dispose old instrument if exists
    if (trackData.instrument) {
      trackData.instrument.dispose();
      this.instrumentInstances.delete(trackData.instrument.getId());
    }
    
    // Set new instrument
    trackData.instrument = instrument;
    this.instrumentInstances.set(instrument.getId(), instrument);
    
    // Connect instrument to mixer channel
    const mixerChannel = this.audioGraph.getMixerChannel(trackData.mixerChannelId);
    if (mixerChannel) {
      instrument.connect(mixerChannel.getInput());
    }
  }

  /**
   * Get the instrument for a track
   */
  public getTrackInstrument(trackId: string): BaseInstrument | null {
    return this.trackAudioData.get(trackId)?.instrument || null;
  }

  /**
   * Delete a track and its audio components
   */
  public deleteTrack(trackId: string): void {
    const trackData = this.trackAudioData.get(trackId);
    if (!trackData) return;
    
    // Dispose instrument
    if (trackData.instrument) {
      trackData.instrument.dispose();
      this.instrumentInstances.delete(trackData.instrument.getId());
    }
    
    // Remove mixer channel
    if (this.audioGraph) {
      this.audioGraph.removeMixerChannel(trackData.mixerChannelId);
    }
    
    // Remove patterns from sequencer
    if (this.sequencer) {
      for (const patternId of trackData.patternIds) {
        this.sequencer.deletePattern(patternId);
      }
    }
    
    this.trackAudioData.delete(trackId);
    this.emitEvent({ type: 'trackRemoved', data: { trackId } });
  }

  /**
   * Get track audio data
   */
  public getTrackAudioData(trackId: string): TrackAudioData | undefined {
    return this.trackAudioData.get(trackId);
  }

  // ==================== Pattern Management ====================

  /**
   * Create a pattern for a track
   */
  public createPattern(
    patternId: string,
    trackId: string,
    name: string,
    length: number = 1920
  ): Pattern | null {
    if (!this.sequencer) return null;
    
    const pattern = this.sequencer.createPattern(patternId, name, length);
    
    // Associate pattern with track
    const trackData = this.trackAudioData.get(trackId);
    if (trackData) {
      trackData.patternIds.push(patternId);
    }
    
    return pattern;
  }

  /**
   * Add a note to a pattern
   */
  public addNoteToPattern(patternId: string, note: MidiNote): boolean {
    if (!this.sequencer) return false;
    return this.sequencer.addNote(patternId, note);
  }

  /**
   * Remove a note from a pattern
   */
  public removeNoteFromPattern(patternId: string, noteIndex: number): boolean {
    if (!this.sequencer) return false;
    return this.sequencer.removeNote(patternId, noteIndex);
  }

  /**
   * Update a note in a pattern
   */
  public updateNoteInPattern(
    patternId: string,
    noteIndex: number,
    updates: Partial<MidiNote>
  ): boolean {
    if (!this.sequencer) return false;
    return this.sequencer.updateNote(patternId, noteIndex, updates);
  }

  /**
   * Set the current pattern for playback
   */
  public setCurrentPattern(patternId: string): boolean {
    if (!this.sequencer) return false;
    return this.sequencer.setCurrentPattern(patternId);
  }

  /**
   * Delete a pattern
   */
  public deletePattern(patternId: string): boolean {
    if (!this.sequencer) return false;
    
    // Remove pattern from track data
    for (const trackData of this.trackAudioData.values()) {
      const index = trackData.patternIds.indexOf(patternId);
      if (index !== -1) {
        trackData.patternIds.splice(index, 1);
        break;
      }
    }
    
    return this.sequencer.deletePattern(patternId);
  }

  /**
   * Get a pattern
   */
  public getPattern(patternId: string): Pattern | undefined {
    return this.sequencer?.getPattern(patternId);
  }

  // ==================== Sample Management ====================

  /**
   * Load a sample from a URL
   */
  public async loadSampleFromUrl(id: string, name: string, url: string): Promise<LoadedSample | null> {
    if (!this.samplePlayer) return null;
    return this.samplePlayer.loadSampleFromUrl(id, name, url);
  }

  /**
   * Load a sample from a File object
   */
  public async loadSampleFromFile(id: string, file: File): Promise<LoadedSample | null> {
    if (!this.samplePlayer) return null;
    return this.samplePlayer.loadSampleFromFile(id, file);
  }

  /**
   * Load a sample from an ArrayBuffer
   */
  public async loadSampleFromBuffer(id: string, name: string, buffer: ArrayBuffer): Promise<LoadedSample | null> {
    if (!this.samplePlayer) return null;
    return this.samplePlayer.loadSampleFromBuffer(id, name, buffer);
  }

  /**
   * Get a loaded sample
   */
  public getSample(id: string): LoadedSample | undefined {
    return this.samplePlayer?.getSample(id);
  }

  /**
   * Check if a sample is loaded
   */
  public hasSample(id: string): boolean {
    return this.samplePlayer?.hasSample(id) || false;
  }

  /**
   * Add a sample clip to be played
   */
  public addSampleClip(clip: SampleClipData): void {
    if (this.samplePlayer) {
      this.samplePlayer.addSampleClip(clip);
    }
  }

  /**
   * Remove a sample clip
   */
  public removeSampleClip(clipId: string): void {
    if (this.samplePlayer) {
      this.samplePlayer.removeSampleClip(clipId);
    }
  }

  /**
   * Update a sample clip
   */
  public updateSampleClip(clipId: string, updates: Partial<SampleClipData>): void {
    if (this.samplePlayer) {
      this.samplePlayer.updateSampleClip(clipId, updates);
    }
  }

  /**
   * Play a sample preview
   */
  public playSamplePreview(sampleId: string, gain: number = 1.0): AudioBufferSourceNode | null {
    if (!this.samplePlayer) return null;
    return this.samplePlayer.playSamplePreview(sampleId, gain);
  }

  /**
   * Get all loaded samples
   */
  public getAllSamples(): LoadedSample[] {
    return this.samplePlayer?.getAllSamples() || [];
  }

  /**
   * Get the sample player instance
   */
  public getSamplePlayer(): SamplePlayer | null {
    return this.samplePlayer;
  }

  // ==================== Mixer Management ====================

  /**
   * Get a mixer channel
   */
  public getMixerChannel(channelId: string): MixerChannel | undefined {
    return this.audioGraph?.getMixerChannel(channelId);
  }

  /**
   * Get all mixer channels
   */
  public getAllMixerChannels(): MixerChannel[] {
    return this.audioGraph?.getAllMixerChannels() || [];
  }

  /**
   * Set channel volume
   */
  public setChannelVolume(channelId: string, volume: number): void {
    const channel = this.audioGraph?.getMixerChannel(channelId);
    if (channel) {
      channel.setVolume(volume);
    }
  }

  /**
   * Set channel pan
   */
  public setChannelPan(channelId: string, pan: number): void {
    const channel = this.audioGraph?.getMixerChannel(channelId);
    if (channel) {
      channel.setPan(pan);
    }
  }

  /**
   * Set channel mute
   */
  public setChannelMute(channelId: string, muted: boolean): void {
    const channel = this.audioGraph?.getMixerChannel(channelId);
    if (channel) {
      channel.setMute(muted);
    }
  }

  /**
   * Set channel solo
   */
  public setChannelSolo(channelId: string, soloed: boolean): void {
    const channel = this.audioGraph?.getMixerChannel(channelId);
    if (channel) {
      channel.setSolo(soloed);
    }
  }

  /**
   * Set master volume
   */
  public setMasterVolume(volume: number): void {
    if (this.audioEngine) {
      this.audioEngine.setMasterVolume(volume);
      this.state.masterVolume = volume;
    }
  }

  /**
   * Get master volume
   */
  public getMasterVolume(): number {
    return this.audioEngine?.getMasterVolume() || 1.0;
  }

  // ==================== Effect Management ====================

  /**
   * Add an effect to a mixer channel
   */
  public addEffectToChannel(
    channelId: string,
    effect: BaseEffect
  ): boolean {
    if (!this.audioGraph) return false;
    
    this.effectInstances.set(effect.getId(), effect);
    const result = this.audioGraph.addEffectToChannel(effect, channelId);
    
    if (result) {
      this.emitEvent({ type: 'effectAdded', data: { channelId, effectId: effect.getId() } });
    }
    
    return result;
  }

  /**
   * Remove an effect from a mixer channel
   */
  public removeEffectFromChannel(channelId: string, effectId: string): boolean {
    if (!this.audioGraph) return false;
    
    const result = this.audioGraph.removeEffectFromChannel(effectId, channelId);
    
    if (result) {
      this.effectInstances.delete(effectId);
      this.emitEvent({ type: 'effectRemoved', data: { channelId, effectId } });
    }
    
    return result;
  }

  /**
   * Get an effect instance
   */
  public getEffect(effectId: string): BaseEffect | undefined {
    return this.effectInstances.get(effectId);
  }

  // ==================== Note Preview ====================

  /**
   * Play a note preview (for piano roll, etc.)
   */
  public playNotePreview(trackId: string, noteNumber: number, velocity: number = 100): void {
    const trackData = this.trackAudioData.get(trackId);
    if (trackData?.instrument) {
      trackData.instrument.noteOn(noteNumber, velocity);
    }
  }

  /**
   * Stop a note preview
   */
  public stopNotePreview(trackId: string, noteNumber: number): void {
    const trackData = this.trackAudioData.get(trackId);
    if (trackData?.instrument) {
      trackData.instrument.noteOff(noteNumber);
    }
  }

  /**
   * Stop all note previews for a track
   */
  public stopAllNotePreviews(trackId: string): void {
    const trackData = this.trackAudioData.get(trackId);
    if (trackData?.instrument) {
      trackData.instrument.allNotesOff();
    }
  }

  // ==================== Audio Rendering ====================

  /**
   * Render the project to an audio buffer
   */
  public async renderToBuffer(
    startTick: number,
    endTick: number,
    sampleRate: number = 44100
  ): Promise<AudioBuffer | null> {
    if (!this.audioEngine || !this.transport) return null;
    
    // Calculate duration in seconds
    const duration = this.transport.ticksToSeconds(endTick - startTick);
    const length = Math.ceil(duration * sampleRate);
    
    // Create offline context
    const offlineContext = this.audioEngine.createOfflineContext(2, length, sampleRate);
    
    // TODO: Implement full offline rendering
    // This would involve:
    // 1. Creating offline versions of all instruments and effects
    // 2. Scheduling all notes from patterns
    // 3. Rendering the offline context
    
    return offlineContext.startRendering();
  }

  // ==================== Metering ====================

  /**
   * Get stereo levels from master output
   */
  public getStereoLevels(): { left: number; right: number } {
    return this.audioEngine?.getStereoLevels() || { left: 0, right: 0 };
  }

  /**
   * Get frequency data for visualization
   */
  public getFrequencyData(): Uint8Array {
    return this.audioEngine?.getFrequencyData() || new Uint8Array(0);
  }

  /**
   * Get time domain data for visualization
   */
  public getTimeDomainData(): Uint8Array {
    return this.audioEngine?.getTimeDomainData() || new Uint8Array(0);
  }

  /**
   * Get VU meter data for a channel
   */
  public getChannelVUMeterData(channelId: string): { peakL: number; peakR: number; rmsL: number; rmsR: number } | null {
    const channel = this.audioGraph?.getMixerChannel(channelId);
    if (!channel) return null;
    return channel.getVUMeterData();
  }

  // ==================== State & Events ====================

  /**
   * Get current state
   */
  public getState(): AudioEngineManagerState {
    return { ...this.state };
  }

  /**
   * Check if initialized
   */
  public isInitialized(): boolean {
    return this.state.isInitialized;
  }

  /**
   * Register event callback
   */
  public onEvent(callback: AudioEngineManagerEventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index !== -1) this.eventCallbacks.splice(index, 1);
    };
  }

  /**
   * Emit an event
   */
  private emitEvent(event: AudioEngineManagerEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error('AudioEngineManager event callback error:', e);
      }
    }
  }

  // ==================== Cleanup ====================

  /**
   * Dispose of all resources
   */
  public async dispose(): Promise<void> {
    this.stopPositionUpdates();
    
    // Dispose all instruments
    this.instrumentInstances.forEach(inst => inst.dispose());
    this.instrumentInstances.clear();
    
    // Dispose all effects
    this.effectInstances.forEach(effect => effect.dispose());
    this.effectInstances.clear();
    
    // Dispose sample player
    if (this.samplePlayer) {
      this.samplePlayer.dispose();
      this.samplePlayer = null;
    }
    
    // Clear track data
    this.trackAudioData.clear();
    
    // Dispose audio engine
    if (this.audioEngine) {
      await this.audioEngine.dispose();
    }
    
    // Reset state
    this.audioEngine = null;
    this.audioGraph = null;
    this.transport = null;
    this.sequencer = null;
    this.state.isInitialized = false;
    this.eventCallbacks = [];
    
    // Clear singleton
    AudioEngineManager.instance = null;
  }
}

// Export singleton getter
export const getAudioEngineManager = (): AudioEngineManager => AudioEngineManager.getInstance();