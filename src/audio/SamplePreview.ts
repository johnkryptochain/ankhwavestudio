// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * SamplePreview - Quick sample playback for browser preview
 * 
 * Features:
 * - Quick sample playback
 * - Stop on new selection
 * - Volume control
 * - Loop preview option
 */

import { clamp } from './utils/AudioMath';

export interface SampleInfo {
  name: string;
  path: string;
  duration: number;
  sampleRate: number;
  channels: number;
  size: number;
}

/**
 * SamplePreview class for previewing audio samples
 */
export class SamplePreview {
  private audioContext: AudioContext;
  private currentSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private analyserNode: AnalyserNode;
  
  private currentBuffer: AudioBuffer | null = null;
  private isPlaying: boolean = false;
  private isLooping: boolean = false;
  private volume: number = 0.8;
  
  // Cache for loaded samples
  private sampleCache: Map<string, AudioBuffer> = new Map();
  private maxCacheSize: number = 50;
  
  // Callbacks
  private onPlayStateChange?: (playing: boolean) => void;
  private onLoadProgress?: (progress: number) => void;
  private onError?: (error: Error) => void;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    
    // Create gain node for volume control
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.value = this.volume;
    
    // Create analyser for waveform display
    this.analyserNode = audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    
    // Connect nodes
    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(audioContext.destination);
  }

  /**
   * Load and preview a sample
   */
  async preview(path: string, autoPlay: boolean = true): Promise<SampleInfo> {
    // Stop any currently playing sample
    this.stop();
    
    try {
      // Check cache first
      let buffer = this.sampleCache.get(path);
      
      if (!buffer) {
        // Load the sample
        buffer = await this.loadSample(path);
        
        // Add to cache
        this.addToCache(path, buffer);
      }
      
      this.currentBuffer = buffer;
      
      // Get sample info
      const info: SampleInfo = {
        name: path.split('/').pop() || path,
        path,
        duration: buffer.duration,
        sampleRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
        size: buffer.length * buffer.numberOfChannels * 4, // Approximate size in bytes
      };
      
      // Auto-play if requested
      if (autoPlay) {
        this.play();
      }
      
      return info;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.onError?.(err);
      throw err;
    }
  }

  /**
   * Load a sample from URL
   */
  private async loadSample(path: string): Promise<AudioBuffer> {
    this.onLoadProgress?.(0);
    
    const response = await fetch(path);
    
    if (!response.ok) {
      throw new Error(`Failed to load sample: ${response.statusText}`);
    }
    
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    
    let loaded = 0;
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        loaded += value.length;
        
        if (total > 0) {
          this.onLoadProgress?.(loaded / total);
        }
      }
    }
    
    // Combine chunks
    const arrayBuffer = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      arrayBuffer.set(chunk, offset);
      offset += chunk.length;
    }
    
    this.onLoadProgress?.(1);
    
    // Decode audio data
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.buffer);
    
    return audioBuffer;
  }

  /**
   * Add a sample to the cache
   */
  private addToCache(path: string, buffer: AudioBuffer): void {
    // Remove oldest entries if cache is full
    if (this.sampleCache.size >= this.maxCacheSize) {
      const firstKey = this.sampleCache.keys().next().value;
      if (firstKey) {
        this.sampleCache.delete(firstKey);
      }
    }
    
    this.sampleCache.set(path, buffer);
  }

  /**
   * Play the current sample
   */
  play(): void {
    if (!this.currentBuffer) return;
    
    // Stop any currently playing source
    this.stop();
    
    // Create new source
    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = this.currentBuffer;
    this.currentSource.loop = this.isLooping;
    
    // Connect to gain node
    this.currentSource.connect(this.gainNode);
    
    // Handle playback end
    this.currentSource.onended = () => {
      if (!this.isLooping) {
        this.isPlaying = false;
        this.onPlayStateChange?.(false);
      }
    };
    
    // Start playback
    this.currentSource.start(0);
    this.isPlaying = true;
    this.onPlayStateChange?.(true);
  }

  /**
   * Stop playback
   */
  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (e) {
        // Ignore errors if source already stopped
      }
      this.currentSource = null;
    }
    
    this.isPlaying = false;
    this.onPlayStateChange?.(false);
  }

  /**
   * Toggle playback
   */
  toggle(): void {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.play();
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    this.volume = clamp(volume, 0, 1);
    this.gainNode.gain.setTargetAtTime(this.volume, this.audioContext.currentTime, 0.01);
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Set loop mode
   */
  setLoop(loop: boolean): void {
    this.isLooping = loop;
    if (this.currentSource) {
      this.currentSource.loop = loop;
    }
  }

  /**
   * Get loop mode
   */
  getLoop(): boolean {
    return this.isLooping;
  }

  /**
   * Check if currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get the current audio buffer
   */
  getCurrentBuffer(): AudioBuffer | null {
    return this.currentBuffer;
  }

  /**
   * Get waveform data for visualization
   */
  getWaveformData(): Float32Array | null {
    if (!this.currentBuffer) return null;
    
    // Get the first channel's data
    return this.currentBuffer.getChannelData(0);
  }

  /**
   * Get real-time analyser data
   */
  getAnalyserData(): Uint8Array {
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(data);
    return data;
  }

  /**
   * Set callback for play state changes
   */
  setOnPlayStateChange(callback: (playing: boolean) => void): void {
    this.onPlayStateChange = callback;
  }

  /**
   * Set callback for load progress
   */
  setOnLoadProgress(callback: (progress: number) => void): void {
    this.onLoadProgress = callback;
  }

  /**
   * Set callback for errors
   */
  setOnError(callback: (error: Error) => void): void {
    this.onError = callback;
  }

  /**
   * Clear the sample cache
   */
  clearCache(): void {
    this.sampleCache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.sampleCache.size;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stop();
    this.gainNode.disconnect();
    this.analyserNode.disconnect();
    this.sampleCache.clear();
    this.currentBuffer = null;
  }
}

/**
 * Create a sample preview instance
 */
export function createSamplePreview(audioContext: AudioContext): SamplePreview {
  return new SamplePreview(audioContext);
}