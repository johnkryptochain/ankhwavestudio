// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Transport - Handles playback transport controls
 * Manages play, pause, stop, loop, position, and metronome
 */

import type { TransportState, TimeSignature } from '../types/audio';
import { clamp } from './utils/AudioMath';

// Ticks per quarter note (standard MIDI resolution)
const TICKS_PER_QUARTER_NOTE = 480;

/**
 * Transport state change event
 */
export interface TransportEvent {
  type: 'play' | 'pause' | 'stop' | 'position' | 'tempo' | 'timeSignature' | 'loop' | 'beat' | 'bar';
  data?: unknown;
}

export type TransportEventCallback = (event: TransportEvent) => void;

/**
 * Metronome configuration
 */
export interface MetronomeConfig {
  enabled: boolean;
  volume: number;
  accentDownbeat: boolean;
  countIn: number; // bars of count-in before recording
  sound: 'click' | 'beep' | 'woodblock';
}

export class Transport {
  private audioContext: AudioContext;
  private state: TransportState;
  
  // Timing
  private startTime: number = 0;
  private pauseTime: number = 0;
  private schedulerInterval: number | null = null;
  private scheduleAheadTime: number = 0.1; // seconds
  private lookAhead: number = 25; // milliseconds
  
  // Position tracking
  private lastBeat: number = -1;
  private lastBar: number = -1;
  
  // Metronome
  private metronome: MetronomeConfig = {
    enabled: false,
    volume: 0.5,
    accentDownbeat: true,
    countIn: 0,
    sound: 'click'
  };
  private metronomeGain: GainNode;
  private nextMetronomeTime: number = 0;
  private scheduledMetronomeBeats: Set<number> = new Set();
  
  // External sync (preparation for MIDI clock)
  private externalSync: boolean = false;
  private midiClockCallback: ((ticks: number) => void) | null = null;
  
  // Callbacks
  private eventCallbacks: TransportEventCallback[] = [];

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    
    // Create metronome gain
    this.metronomeGain = audioContext.createGain();
    this.metronomeGain.gain.value = this.metronome.volume;
    this.metronomeGain.connect(audioContext.destination);
    
    this.state = {
      isPlaying: false,
      isRecording: false,
      isPaused: false,
      position: 0,
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      loopEnabled: false,
      loopStart: 0,
      loopEnd: TICKS_PER_QUARTER_NOTE * 4 * 4, // 4 bars default
    };
  }

  /** Get current transport state */
  public getState(): TransportState {
    return { ...this.state };
  }

  /** Start playback */
  public play(): void {
    if (this.state.isPlaying) return;
    
    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.startTime = this.audioContext.currentTime - this.ticksToSeconds(this.state.position);
    this.lastBeat = -1;
    this.lastBar = -1;
    this.scheduledMetronomeBeats.clear();
    
    this.startScheduler();
    this.emitEvent({ type: 'play' });
  }

  /** Pause playback */
  public pause(): void {
    if (!this.state.isPlaying || this.state.isPaused) return;
    
    // Update position state to current playback position
    const elapsed = this.audioContext.currentTime - this.startTime;
    this.state.position = this.secondsToTicks(elapsed);
    
    this.state.isPaused = true;
    this.state.isPlaying = false;
    this.pauseTime = this.audioContext.currentTime;
    
    this.stopScheduler();
    this.emitEvent({ type: 'pause' });
  }

  /** Stop playback and reset position */
  public stop(): void {
    const wasPlaying = this.state.isPlaying;
    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.state.isRecording = false;
    this.state.position = 0;
    this.lastBeat = -1;
    this.lastBar = -1;
    
    this.stopScheduler();
    
    if (wasPlaying) {
      this.emitEvent({ type: 'stop' });
    }
    this.emitEvent({ type: 'position', data: { position: 0 } });
  }

  /** Toggle playback */
  public toggle(): void {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /** Set playback position in ticks */
  public setPosition(ticks: number): void {
    this.state.position = Math.max(0, ticks);
    
    if (this.state.isPlaying) {
      this.startTime = this.audioContext.currentTime - this.ticksToSeconds(this.state.position);
      this.scheduledMetronomeBeats.clear();
    }
    
    this.emitEvent({ type: 'position', data: { position: this.state.position } });
  }

  /** Get current position in ticks */
  public getPosition(): number {
    if (this.state.isPlaying) {
      const elapsed = this.audioContext.currentTime - this.startTime;
      return this.secondsToTicks(elapsed);
    }
    return this.state.position;
  }

  /** Set position in bars:beats:ticks format */
  public setPositionBBT(bars: number, beats: number, ticks: number): void {
    const ticksPerBeat = TICKS_PER_QUARTER_NOTE;
    const ticksPerBar = ticksPerBeat * this.state.timeSignature.numerator;
    const totalTicks = (bars - 1) * ticksPerBar + (beats - 1) * ticksPerBeat + ticks;
    this.setPosition(totalTicks);
  }

  /** Get position as bars:beats:ticks object */
  public getPositionBBT(): { bars: number; beats: number; ticks: number } {
    const position = this.getPosition();
    const ticksPerBeat = TICKS_PER_QUARTER_NOTE;
    const ticksPerBar = ticksPerBeat * this.state.timeSignature.numerator;
    
    const bars = Math.floor(position / ticksPerBar) + 1;
    const remainingTicks = position % ticksPerBar;
    const beats = Math.floor(remainingTicks / ticksPerBeat) + 1;
    const ticks = remainingTicks % ticksPerBeat;
    
    return { bars, beats, ticks };
  }

  /** Set tempo in BPM */
  public setTempo(bpm: number): void {
    const clampedBpm = clamp(bpm, 20, 999);
    const oldTempo = this.state.tempo;
    this.state.tempo = clampedBpm;
    
    // Recalculate start time to maintain position
    if (this.state.isPlaying) {
      const currentPosition = this.getPosition();
      this.startTime = this.audioContext.currentTime - this.ticksToSeconds(currentPosition);
    }
    
    this.emitEvent({ type: 'tempo', data: { tempo: clampedBpm, oldTempo } });
  }

  /** Get current tempo */
  public getTempo(): number {
    return this.state.tempo;
  }

  /** Tap tempo - call repeatedly to set tempo from taps */
  private tapTimes: number[] = [];
  public tapTempo(): void {
    const now = performance.now();
    this.tapTimes.push(now);
    
    // Keep only last 4 taps
    if (this.tapTimes.length > 4) {
      this.tapTimes.shift();
    }
    
    // Need at least 2 taps
    if (this.tapTimes.length >= 2) {
      let totalInterval = 0;
      for (let i = 1; i < this.tapTimes.length; i++) {
        totalInterval += this.tapTimes[i] - this.tapTimes[i - 1];
      }
      const avgInterval = totalInterval / (this.tapTimes.length - 1);
      const bpm = 60000 / avgInterval;
      this.setTempo(bpm);
    }
    
    // Clear taps after 2 seconds of inactivity
    setTimeout(() => {
      if (this.tapTimes.length > 0 && performance.now() - this.tapTimes[this.tapTimes.length - 1] > 2000) {
        this.tapTimes = [];
      }
    }, 2100);
  }

  /** Set time signature */
  public setTimeSignature(numerator: number, denominator: number): void {
    this.state.timeSignature = { 
      numerator: clamp(numerator, 1, 16), 
      denominator: clamp(denominator, 1, 16) 
    };
    this.emitEvent({ type: 'timeSignature', data: this.state.timeSignature });
  }

  /** Get time signature */
  public getTimeSignature(): TimeSignature {
    return { ...this.state.timeSignature };
  }

  /** Enable/disable loop */
  public setLoopEnabled(enabled: boolean): void {
    this.state.loopEnabled = enabled;
    this.emitEvent({ type: 'loop', data: { enabled, start: this.state.loopStart, end: this.state.loopEnd } });
  }

  /** Set loop start position in ticks */
  public setLoopStart(ticks: number): void {
    this.state.loopStart = Math.max(0, ticks);
    this.emitEvent({ type: 'loop', data: { enabled: this.state.loopEnabled, start: this.state.loopStart, end: this.state.loopEnd } });
  }

  /** Set loop end position in ticks */
  public setLoopEnd(ticks: number): void {
    this.state.loopEnd = Math.max(this.state.loopStart + TICKS_PER_QUARTER_NOTE, ticks);
    this.emitEvent({ type: 'loop', data: { enabled: this.state.loopEnabled, start: this.state.loopStart, end: this.state.loopEnd } });
  }

  /** Set loop region */
  public setLoopRegion(start: number, end: number): void {
    this.state.loopStart = Math.max(0, start);
    this.state.loopEnd = Math.max(this.state.loopStart + TICKS_PER_QUARTER_NOTE, end);
    this.emitEvent({ type: 'loop', data: { enabled: this.state.loopEnabled, start: this.state.loopStart, end: this.state.loopEnd } });
  }

  /** Start recording */
  public startRecording(): void {
    this.state.isRecording = true;
    if (!this.state.isPlaying) {
      this.play();
    }
  }

  /** Stop recording */
  public stopRecording(): void {
    this.state.isRecording = false;
  }

  /** Configure metronome */
  public setMetronome(config: Partial<MetronomeConfig>): void {
    this.metronome = { ...this.metronome, ...config };
    this.metronomeGain.gain.setTargetAtTime(
      this.metronome.enabled ? this.metronome.volume : 0,
      this.audioContext.currentTime,
      0.01
    );
  }

  /** Get metronome config */
  public getMetronome(): MetronomeConfig {
    return { ...this.metronome };
  }

  /** Toggle metronome */
  public toggleMetronome(): boolean {
    this.setMetronome({ enabled: !this.metronome.enabled });
    return this.metronome.enabled;
  }

  /** Play metronome click */
  private playMetronomeClick(time: number, isDownbeat: boolean): void {
    if (!this.metronome.enabled) return;
    
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    // Different sounds
    switch (this.metronome.sound) {
      case 'beep':
        osc.type = 'sine';
        osc.frequency.value = isDownbeat && this.metronome.accentDownbeat ? 1000 : 800;
        break;
      case 'woodblock':
        osc.type = 'triangle';
        osc.frequency.value = isDownbeat && this.metronome.accentDownbeat ? 1200 : 900;
        break;
      case 'click':
      default:
        osc.type = 'square';
        osc.frequency.value = isDownbeat && this.metronome.accentDownbeat ? 1500 : 1200;
        break;
    }
    
    // Envelope
    const volume = isDownbeat && this.metronome.accentDownbeat ? 1.0 : 0.7;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    
    osc.connect(gain);
    gain.connect(this.metronomeGain);
    
    osc.start(time);
    osc.stop(time + 0.05);
  }

  /** Convert ticks to seconds based on current tempo */
  public ticksToSeconds(ticks: number): number {
    const secondsPerBeat = 60 / this.state.tempo;
    const secondsPerTick = secondsPerBeat / TICKS_PER_QUARTER_NOTE;
    return ticks * secondsPerTick;
  }

  /** Convert seconds to ticks based on current tempo */
  public secondsToTicks(seconds: number): number {
    const secondsPerBeat = 60 / this.state.tempo;
    const ticksPerSecond = TICKS_PER_QUARTER_NOTE / secondsPerBeat;
    return Math.floor(seconds * ticksPerSecond);
  }

  /** Convert ticks to bars:beats:ticks string */
  public ticksToBarsBeatsTicks(ticks: number): string {
    const bbt = this.getPositionBBT();
    return `${bbt.bars}:${bbt.beats}:${bbt.ticks.toString().padStart(3, '0')}`;
  }

  /** Get ticks per quarter note */
  public getTicksPerQuarterNote(): number {
    return TICKS_PER_QUARTER_NOTE;
  }

  /** Get ticks per bar */
  public getTicksPerBar(): number {
    return TICKS_PER_QUARTER_NOTE * this.state.timeSignature.numerator;
  }

  /** Start the scheduler loop */
  private startScheduler(): void {
    if (this.schedulerInterval !== null) return;
    
    const scheduler = () => {
      const currentPosition = this.getPosition();
      
      // Handle looping
      if (this.state.loopEnabled && this.state.loopEnd > this.state.loopStart && currentPosition >= this.state.loopEnd) {
        this.setPosition(this.state.loopStart);
        return;
      }
      
      // Update position in state
      this.state.position = currentPosition;
      
      // Beat and bar callbacks
      const currentBeat = Math.floor(currentPosition / TICKS_PER_QUARTER_NOTE);
      const ticksPerBar = TICKS_PER_QUARTER_NOTE * this.state.timeSignature.numerator;
      const currentBar = Math.floor(currentPosition / ticksPerBar);
      
      if (currentBeat !== this.lastBeat) {
        this.lastBeat = currentBeat;
        this.emitEvent({ type: 'beat', data: { beat: currentBeat } });
        
        // Schedule metronome
        if (this.metronome.enabled && !this.scheduledMetronomeBeats.has(currentBeat)) {
          const beatTime = this.startTime + this.ticksToSeconds(currentBeat * TICKS_PER_QUARTER_NOTE);
          const isDownbeat = (currentBeat % this.state.timeSignature.numerator) === 0;
          this.playMetronomeClick(beatTime, isDownbeat);
          this.scheduledMetronomeBeats.add(currentBeat);
          
          // Clean up old scheduled beats
          if (this.scheduledMetronomeBeats.size > 16) {
            const oldBeats = Array.from(this.scheduledMetronomeBeats).filter(b => b < currentBeat - 4);
            oldBeats.forEach(b => this.scheduledMetronomeBeats.delete(b));
          }
        }
      }
      
      if (currentBar !== this.lastBar) {
        this.lastBar = currentBar;
        this.emitEvent({ type: 'bar', data: { bar: currentBar } });
      }
      
      // Position callback
      this.emitEvent({ type: 'position', data: { position: currentPosition } });
    };
    
    this.schedulerInterval = window.setInterval(scheduler, this.lookAhead);
  }

  /** Stop the scheduler loop */
  private stopScheduler(): void {
    if (this.schedulerInterval !== null) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /** Register event callback */
  public onEvent(callback: TransportEventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index !== -1) this.eventCallbacks.splice(index, 1);
    };
  }

  /** Convenience methods for specific events */
  public onPlay(callback: () => void): () => void {
    return this.onEvent(e => { if (e.type === 'play') callback(); });
  }

  public onPause(callback: () => void): () => void {
    return this.onEvent(e => { if (e.type === 'pause') callback(); });
  }

  public onStop(callback: () => void): () => void {
    return this.onEvent(e => { if (e.type === 'stop') callback(); });
  }

  public onPositionChange(callback: (position: number) => void): () => void {
    return this.onEvent(e => { 
      if (e.type === 'position') callback((e.data as { position: number }).position); 
    });
  }

  public onBeat(callback: (beat: number) => void): () => void {
    return this.onEvent(e => { 
      if (e.type === 'beat') callback((e.data as { beat: number }).beat); 
    });
  }

  public onBar(callback: (bar: number) => void): () => void {
    return this.onEvent(e => { 
      if (e.type === 'bar') callback((e.data as { bar: number }).bar); 
    });
  }

  /** Emit an event */
  private emitEvent(event: TransportEvent): void {
    for (const callback of this.eventCallbacks) {
      try { callback(event); } catch (e) { console.error('Transport event callback error:', e); }
    }
  }

  /** Enable external MIDI clock sync */
  public setExternalSync(enabled: boolean): void {
    this.externalSync = enabled;
  }

  /** Receive MIDI clock tick (24 PPQ) */
  public receiveMidiClock(): void {
    if (!this.externalSync) return;
    // Convert 24 PPQ to 480 PPQ
    const tickIncrement = TICKS_PER_QUARTER_NOTE / 24;
    this.state.position += tickIncrement;
    if (this.midiClockCallback) {
      this.midiClockCallback(this.state.position);
    }
  }

  /** Set MIDI clock callback */
  public onMidiClock(callback: (ticks: number) => void): void {
    this.midiClockCallback = callback;
  }

  /** Dispose of resources */
  public dispose(): void {
    this.stopScheduler();
    this.metronomeGain.disconnect();
    this.eventCallbacks = [];
    this.midiClockCallback = null;
  }
}