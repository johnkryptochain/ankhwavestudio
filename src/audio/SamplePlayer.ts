// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * SamplePlayer - Handles loading and playback of audio samples
 * Used for audio clips in the timeline
 */

export interface LoadedSample {
  id: string;
  name: string;
  buffer: AudioBuffer;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
}

export interface ScheduledSample {
  id: string;
  sampleId: string;
  source: AudioBufferSourceNode | null;
  gainNode: GainNode;
  startTime: number;
  endTime: number;
  started: boolean;
  stopped: boolean;
}

export interface SampleClipData {
  clipId: string;
  sampleId: string;
  startTick: number;
  length: number;
  offset: number; // Start offset within the sample (in seconds)
  gain: number;
  pitch: number; // Playback rate multiplier (1.0 = normal)
  fadeIn: number; // Fade in duration in seconds
  fadeOut: number; // Fade out duration in seconds
}

/**
 * SamplePlayer class for loading and playing audio samples
 */
export class SamplePlayer {
  private audioContext: AudioContext;
  private outputNode: GainNode;
  
  // Loaded samples cache
  private samples: Map<string, LoadedSample> = new Map();
  
  // Currently scheduled/playing samples
  private scheduledSamples: Map<string, ScheduledSample> = new Map();
  
  // Sample clips to play
  private sampleClips: Map<string, SampleClipData> = new Map();
  
  // Scheduling
  private scheduleAheadTime: number = 0.1; // seconds
  private lastScheduledTick: number = -1;
  private schedulerRunning: boolean = false;
  private schedulerInterval: number | null = null;
  
  // Transport reference for timing
  private getPosition: () => number = () => 0;
  private ticksToSeconds: (ticks: number) => number = (t) => t / 480;
  private isPlaying: () => boolean = () => false;

  constructor(audioContext: AudioContext, outputNode: GainNode) {
    this.audioContext = audioContext;
    this.outputNode = outputNode;
  }

  /**
   * Set transport functions for timing
   */
  setTransportFunctions(
    getPosition: () => number,
    ticksToSeconds: (ticks: number) => number,
    isPlaying: () => boolean
  ): void {
    this.getPosition = getPosition;
    this.ticksToSeconds = ticksToSeconds;
    this.isPlaying = isPlaying;
  }

  /**
   * Load a sample from a URL
   */
  async loadSampleFromUrl(id: string, name: string, url: string): Promise<LoadedSample | null> {
    try {
      console.log(`[SamplePlayer] Loading sample from URL: ${url}`);
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return this.loadSampleFromBuffer(id, name, arrayBuffer);
    } catch (error) {
      console.error(`[SamplePlayer] Failed to load sample from URL: ${url}`, error);
      return null;
    }
  }

  /**
   * Load a sample from a File object
   */
  async loadSampleFromFile(id: string, file: File): Promise<LoadedSample | null> {
    try {
      console.log(`[SamplePlayer] Loading sample from file: ${file.name}`);
      const arrayBuffer = await file.arrayBuffer();
      return this.loadSampleFromBuffer(id, file.name, arrayBuffer);
    } catch (error) {
      console.error(`[SamplePlayer] Failed to load sample from file: ${file.name}`, error);
      return null;
    }
  }

  /**
   * Load a sample from an ArrayBuffer
   */
  async loadSampleFromBuffer(id: string, name: string, arrayBuffer: ArrayBuffer): Promise<LoadedSample | null> {
    try {
      console.log(`[SamplePlayer] Decoding audio data for: ${name}`);
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      const sample: LoadedSample = {
        id,
        name,
        buffer: audioBuffer,
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
      };
      
      this.samples.set(id, sample);
      console.log(`[SamplePlayer] Sample loaded: ${name}, duration: ${audioBuffer.duration.toFixed(2)}s, channels: ${audioBuffer.numberOfChannels}`);
      
      return sample;
    } catch (error) {
      console.error(`[SamplePlayer] Failed to decode audio data for: ${name}`, error);
      return null;
    }
  }

  /**
   * Get a loaded sample
   */
  getSample(id: string): LoadedSample | undefined {
    return this.samples.get(id);
  }

  /**
   * Check if a sample is loaded
   */
  hasSample(id: string): boolean {
    return this.samples.has(id);
  }

  /**
   * Unload a sample
   */
  unloadSample(id: string): void {
    this.samples.delete(id);
  }

  /**
   * Add a sample clip to be played
   */
  addSampleClip(clip: SampleClipData): void {
    this.sampleClips.set(clip.clipId, clip);
    console.log(`[SamplePlayer] Added sample clip: ${clip.clipId}, sampleId: ${clip.sampleId}, startTick: ${clip.startTick}`);
  }

  /**
   * Remove a sample clip
   */
  removeSampleClip(clipId: string): void {
    this.sampleClips.delete(clipId);
    // Stop if currently playing
    const scheduled = this.scheduledSamples.get(clipId);
    if (scheduled && scheduled.source) {
      try {
        scheduled.source.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    }
    this.scheduledSamples.delete(clipId);
  }

  /**
   * Update a sample clip
   */
  updateSampleClip(clipId: string, updates: Partial<SampleClipData>): void {
    const clip = this.sampleClips.get(clipId);
    if (clip) {
      Object.assign(clip, updates);
    }
  }

  /**
   * Start the sample scheduler
   */
  start(): void {
    if (this.schedulerRunning) return;
    this.schedulerRunning = true;
    this.lastScheduledTick = this.getPosition() - 1;
    this.startScheduler();
    console.log('[SamplePlayer] Scheduler started');
  }

  /**
   * Stop the sample scheduler and all playing samples
   */
  stop(): void {
    this.schedulerRunning = false;
    this.stopScheduler();
    this.stopAllSamples();
    this.lastScheduledTick = -1;
    console.log('[SamplePlayer] Scheduler stopped');
  }

  /**
   * Pause the sample scheduler and stop all playing samples
   */
  pause(): void {
    this.schedulerRunning = false;
    this.stopScheduler();
    // Stop all currently playing samples when pausing
    this.stopAllSamples();
    console.log('[SamplePlayer] Scheduler paused, all samples stopped');
  }

  /**
   * Start the scheduler loop
   */
  private startScheduler(): void {
    if (this.schedulerInterval !== null) return;
    
    const scheduleClips = () => {
      if (!this.schedulerRunning || !this.isPlaying()) return;
      
      const currentTime = this.audioContext.currentTime;
      const currentTick = this.getPosition();
      const scheduleAheadTicks = Math.ceil(this.scheduleAheadTime / this.ticksToSeconds(1));
      const endTick = currentTick + scheduleAheadTicks;
      
      // Schedule sample clips that fall within the look-ahead window
      for (const [clipId, clip] of this.sampleClips) {
        // Check if this clip should be scheduled
        if (clip.startTick > this.lastScheduledTick && clip.startTick <= endTick) {
          // Check if sample is loaded
          const sample = this.samples.get(clip.sampleId);
          if (!sample) {
            console.warn(`[SamplePlayer] Sample not loaded for clip: ${clipId}, sampleId: ${clip.sampleId}`);
            continue;
          }
          
          // Calculate timing
          const startTime = currentTime + this.ticksToSeconds(clip.startTick - currentTick);
          const clipDuration = this.ticksToSeconds(clip.length);
          const sampleDuration = sample.duration - clip.offset;
          const playDuration = Math.min(clipDuration, sampleDuration);
          
          if (startTime >= currentTime) {
            console.log(`[SamplePlayer] Scheduling sample: ${sample.name}, startTime: ${startTime.toFixed(3)}, duration: ${playDuration.toFixed(3)}`);
            this.scheduleSample(clipId, clip, sample, startTime, playDuration);
          }
        }
      }
      
      this.lastScheduledTick = endTick;
    };
    
    this.schedulerInterval = window.setInterval(scheduleClips, 25);
  }

  /**
   * Stop the scheduler loop
   */
  private stopScheduler(): void {
    if (this.schedulerInterval !== null) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /**
   * Schedule a sample for playback
   */
  private scheduleSample(
    clipId: string,
    clip: SampleClipData,
    sample: LoadedSample,
    startTime: number,
    duration: number
  ): void {
    // Create audio nodes
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    // Set up source
    source.buffer = sample.buffer;
    source.playbackRate.value = clip.pitch || 1.0;
    
    // Set up gain with fades
    gainNode.gain.value = clip.gain || 1.0;
    
    // Apply fade in
    if (clip.fadeIn > 0) {
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(clip.gain || 1.0, startTime + clip.fadeIn);
    }
    
    // Apply fade out
    if (clip.fadeOut > 0) {
      const fadeOutStart = startTime + duration - clip.fadeOut;
      gainNode.gain.setValueAtTime(clip.gain || 1.0, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
    }
    
    // Connect nodes
    source.connect(gainNode);
    gainNode.connect(this.outputNode);
    
    // Schedule playback
    source.start(startTime, clip.offset || 0, duration);
    
    // Track scheduled sample
    const scheduled: ScheduledSample = {
      id: clipId,
      sampleId: clip.sampleId,
      source,
      gainNode,
      startTime,
      endTime: startTime + duration,
      started: false,
      stopped: false,
    };
    
    this.scheduledSamples.set(clipId, scheduled);
    
    // Clean up when done
    source.onended = () => {
      scheduled.stopped = true;
      gainNode.disconnect();
      this.scheduledSamples.delete(clipId);
    };
  }

  /**
   * Stop all currently playing samples
   */
  private stopAllSamples(): void {
    for (const [clipId, scheduled] of this.scheduledSamples) {
      if (scheduled.source) {
        try {
          scheduled.source.stop();
        } catch (e) {
          // Ignore if already stopped
        }
      }
      scheduled.gainNode.disconnect();
    }
    this.scheduledSamples.clear();
  }

  /**
   * Play a sample immediately (for preview)
   */
  playSamplePreview(sampleId: string, gain: number = 1.0): AudioBufferSourceNode | null {
    const sample = this.samples.get(sampleId);
    if (!sample) {
      console.warn(`[SamplePlayer] Sample not found for preview: ${sampleId}`);
      return null;
    }
    
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    source.buffer = sample.buffer;
    gainNode.gain.value = gain;
    
    source.connect(gainNode);
    gainNode.connect(this.outputNode);
    
    source.start();
    
    source.onended = () => {
      gainNode.disconnect();
    };
    
    return source;
  }

  /**
   * Get all loaded samples
   */
  getAllSamples(): LoadedSample[] {
    return Array.from(this.samples.values());
  }

  /**
   * Get all sample clips
   */
  getAllSampleClips(): SampleClipData[] {
    return Array.from(this.sampleClips.values());
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stop();
    this.samples.clear();
    this.sampleClips.clear();
  }
}