// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * SlicerT - Beat Slicer Instrument
 * Slices audio files into segments for beat manipulation
 * 
 * Features:
 * - Load audio file
 * - Automatic beat detection
 * - Manual slice markers
 * - Slice playback via MIDI
 * - Time-stretch slices
 * - Reverse slices
 */

import { BaseInstrument, type InstrumentParameterDescriptor } from './BaseInstrument';
import { clamp } from '../utils/AudioMath';

// ============================================================================
// Types
// ============================================================================

/**
 * Slice marker
 */
export interface SliceMarker {
  id: number;
  startSample: number;
  endSample: number;
  startTime: number;
  endTime: number;
  midiNote: number;
  enabled: boolean;
}

/**
 * Beat detection result
 */
export interface BeatDetectionResult {
  bpm: number;
  beats: number[];
  confidence: number;
}

/**
 * Active voice state
 */
interface SlicerVoice {
  noteNumber: number;
  velocity: number;
  startTime: number;
  released: boolean;
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  sliceIndex: number;
}

// ============================================================================
// SlicerT Instrument
// ============================================================================

export class SlicerT extends BaseInstrument {
  // Audio buffer
  private audioBuffer: AudioBuffer | null = null;
  private fileName: string = '';
  
  // Slice markers
  private slices: SliceMarker[] = [];
  private nextSliceId: number = 1;
  
  // Beat detection
  private detectedBpm: number = 120;
  private detectedBeats: number[] = [];
  
  // Active voices
  private slicerVoices: Map<number, SlicerVoice> = new Map();
  
  // Settings
  private sliceCount: number = 16;
  private fadeTime: number = 0.005; // 5ms fade
  private timeStretch: number = 1;
  private reverseSlices: boolean = false;
  private snapToZeroCrossing: boolean = true;
  
  // Loading state
  private isLoading: boolean = false;
  private loadError: string | null = null;
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'SlicerT', 'slicert');
    this.initializeInstrument();
  }
  
  /**
   * Load an audio file
   */
  async loadAudioFile(data: ArrayBuffer, filename: string): Promise<boolean> {
    this.isLoading = true;
    this.loadError = null;
    
    try {
      // Decode audio data
      this.audioBuffer = await this.audioContext.decodeAudioData(data);
      this.fileName = filename;
      
      // Detect beats
      await this.detectBeats();
      
      // Create initial slices
      this.createSlicesFromBeats();
      
      this.isLoading = false;
      return true;
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Unknown error loading audio file';
      this.isLoading = false;
      console.error('Error loading audio file:', error);
      return false;
    }
  }
  
  /**
   * Detect beats in the audio
   */
  private async detectBeats(): Promise<void> {
    if (!this.audioBuffer) return;
    
    const channelData = this.audioBuffer.getChannelData(0);
    const sampleRate = this.audioBuffer.sampleRate;
    
    // Simple onset detection using energy
    const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows
    const hopSize = Math.floor(windowSize / 2);
    const energies: number[] = [];
    
    // Calculate energy for each window
    for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
      let energy = 0;
      for (let j = 0; j < windowSize; j++) {
        energy += channelData[i + j] * channelData[i + j];
      }
      energies.push(energy / windowSize);
    }
    
    // Find peaks (onsets)
    const threshold = this.calculateAdaptiveThreshold(energies);
    const onsets: number[] = [];
    
    for (let i = 1; i < energies.length - 1; i++) {
      if (energies[i] > energies[i - 1] && 
          energies[i] > energies[i + 1] && 
          energies[i] > threshold) {
        const samplePosition = i * hopSize;
        const timePosition = samplePosition / sampleRate;
        
        // Minimum distance between onsets (50ms)
        if (onsets.length === 0 || timePosition - onsets[onsets.length - 1] > 0.05) {
          onsets.push(timePosition);
        }
      }
    }
    
    this.detectedBeats = onsets;
    
    // Estimate BPM
    this.detectedBpm = this.estimateBpm(onsets);
  }
  
  /**
   * Calculate adaptive threshold for onset detection
   */
  private calculateAdaptiveThreshold(energies: number[]): number {
    const sorted = [...energies].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return median * 2;
  }
  
  /**
   * Estimate BPM from onset times
   */
  private estimateBpm(onsets: number[]): number {
    if (onsets.length < 2) return 120;
    
    // Calculate inter-onset intervals
    const intervals: number[] = [];
    for (let i = 1; i < onsets.length; i++) {
      intervals.push(onsets[i] - onsets[i - 1]);
    }
    
    // Find most common interval (histogram approach)
    const histogram: Map<number, number> = new Map();
    const binSize = 0.01; // 10ms bins
    
    for (const interval of intervals) {
      const bin = Math.round(interval / binSize) * binSize;
      histogram.set(bin, (histogram.get(bin) || 0) + 1);
    }
    
    // Find peak
    let maxCount = 0;
    let peakInterval = 0.5; // Default to 120 BPM
    
    for (const [interval, count] of histogram) {
      if (count > maxCount && interval > 0.1 && interval < 2) {
        maxCount = count;
        peakInterval = interval;
      }
    }
    
    // Convert to BPM
    const bpm = 60 / peakInterval;
    
    // Constrain to reasonable range
    if (bpm < 60) return bpm * 2;
    if (bpm > 200) return bpm / 2;
    
    return Math.round(bpm);
  }
  
  /**
   * Create slices from detected beats
   */
  private createSlicesFromBeats(): void {
    if (!this.audioBuffer) return;
    
    this.slices = [];
    const duration = this.audioBuffer.duration;
    const sampleRate = this.audioBuffer.sampleRate;
    
    if (this.detectedBeats.length >= 2) {
      // Use detected beats
      for (let i = 0; i < this.detectedBeats.length; i++) {
        const startTime = this.detectedBeats[i];
        const endTime = i < this.detectedBeats.length - 1 
          ? this.detectedBeats[i + 1] 
          : duration;
        
        this.slices.push({
          id: this.nextSliceId++,
          startSample: Math.floor(startTime * sampleRate),
          endSample: Math.floor(endTime * sampleRate),
          startTime,
          endTime,
          midiNote: 60 + i, // Start from C4
          enabled: true
        });
      }
    } else {
      // Create equal slices
      this.createEqualSlices(this.sliceCount);
    }
  }
  
  /**
   * Create equal-sized slices
   */
  createEqualSlices(count: number): void {
    if (!this.audioBuffer) return;
    
    this.slices = [];
    const duration = this.audioBuffer.duration;
    const sampleRate = this.audioBuffer.sampleRate;
    const sliceDuration = duration / count;
    
    for (let i = 0; i < count; i++) {
      const startTime = i * sliceDuration;
      const endTime = (i + 1) * sliceDuration;
      
      let startSample = Math.floor(startTime * sampleRate);
      let endSample = Math.floor(endTime * sampleRate);
      
      // Snap to zero crossing if enabled
      if (this.snapToZeroCrossing) {
        startSample = this.findZeroCrossing(startSample);
        endSample = this.findZeroCrossing(endSample);
      }
      
      this.slices.push({
        id: this.nextSliceId++,
        startSample,
        endSample,
        startTime: startSample / sampleRate,
        endTime: endSample / sampleRate,
        midiNote: 60 + i,
        enabled: true
      });
    }
    
    this.sliceCount = count;
  }
  
  /**
   * Find nearest zero crossing
   */
  private findZeroCrossing(sample: number): number {
    if (!this.audioBuffer) return sample;
    
    const channelData = this.audioBuffer.getChannelData(0);
    const searchRange = 1000; // Search within 1000 samples
    
    let bestSample = sample;
    let minValue = Math.abs(channelData[sample] || 0);
    
    for (let i = Math.max(0, sample - searchRange); 
         i < Math.min(channelData.length, sample + searchRange); 
         i++) {
      const value = Math.abs(channelData[i]);
      if (value < minValue) {
        minValue = value;
        bestSample = i;
      }
    }
    
    return bestSample;
  }
  
  /**
   * Add a manual slice marker
   */
  addSliceMarker(timePosition: number): SliceMarker | null {
    if (!this.audioBuffer) return null;
    
    const sampleRate = this.audioBuffer.sampleRate;
    let samplePosition = Math.floor(timePosition * sampleRate);
    
    if (this.snapToZeroCrossing) {
      samplePosition = this.findZeroCrossing(samplePosition);
    }
    
    // Find where to insert
    let insertIndex = this.slices.length;
    for (let i = 0; i < this.slices.length; i++) {
      if (this.slices[i].startSample > samplePosition) {
        insertIndex = i;
        break;
      }
    }
    
    // Update previous slice's end
    if (insertIndex > 0) {
      this.slices[insertIndex - 1].endSample = samplePosition;
      this.slices[insertIndex - 1].endTime = samplePosition / sampleRate;
    }
    
    // Calculate end sample
    const endSample = insertIndex < this.slices.length 
      ? this.slices[insertIndex].startSample 
      : this.audioBuffer.length;
    
    const newSlice: SliceMarker = {
      id: this.nextSliceId++,
      startSample: samplePosition,
      endSample,
      startTime: samplePosition / sampleRate,
      endTime: endSample / sampleRate,
      midiNote: 60 + insertIndex,
      enabled: true
    };
    
    this.slices.splice(insertIndex, 0, newSlice);
    
    // Update MIDI notes
    this.updateMidiNotes();
    
    return newSlice;
  }
  
  /**
   * Remove a slice marker
   */
  removeSliceMarker(sliceId: number): boolean {
    const index = this.slices.findIndex(s => s.id === sliceId);
    if (index === -1) return false;
    
    // Merge with previous slice
    if (index > 0) {
      this.slices[index - 1].endSample = this.slices[index].endSample;
      this.slices[index - 1].endTime = this.slices[index].endTime;
    }
    
    this.slices.splice(index, 1);
    this.updateMidiNotes();
    
    return true;
  }
  
  /**
   * Update MIDI note assignments
   */
  private updateMidiNotes(): void {
    for (let i = 0; i < this.slices.length; i++) {
      this.slices[i].midiNote = 60 + i;
    }
  }
  
  /**
   * Get slice by MIDI note
   */
  private getSliceByNote(noteNumber: number): SliceMarker | null {
    return this.slices.find(s => s.midiNote === noteNumber && s.enabled) || null;
  }
  
  /**
   * Get slice by index
   */
  getSlice(index: number): SliceMarker | null {
    return this.slices[index] || null;
  }
  
  /**
   * Get all slices
   */
  getSlices(): SliceMarker[] {
    return [...this.slices];
  }
  
  /**
   * Trigger a note (play a slice)
   */
  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    if (!this.audioBuffer) return;
    
    const slice = this.getSliceByNote(noteNumber);
    if (!slice) return;
    
    const startTime = this.audioContext.currentTime;
    
    // Create buffer source
    const source = this.audioContext.createBufferSource();
    
    // Create slice buffer
    const sliceLength = slice.endSample - slice.startSample;
    const sliceBuffer = this.audioContext.createBuffer(
      this.audioBuffer.numberOfChannels,
      sliceLength,
      this.audioBuffer.sampleRate
    );
    
    // Copy slice data
    for (let channel = 0; channel < this.audioBuffer.numberOfChannels; channel++) {
      const sourceData = this.audioBuffer.getChannelData(channel);
      const destData = sliceBuffer.getChannelData(channel);
      
      if (this.reverseSlices) {
        // Copy in reverse
        for (let i = 0; i < sliceLength; i++) {
          destData[i] = sourceData[slice.endSample - 1 - i];
        }
      } else {
        // Copy normally
        for (let i = 0; i < sliceLength; i++) {
          destData[i] = sourceData[slice.startSample + i];
        }
      }
    }
    
    source.buffer = sliceBuffer;
    source.playbackRate.value = this.timeStretch;
    
    // Create gain node
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = velocity;
    
    // Apply fade in/out
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(velocity, startTime + this.fadeTime);
    
    const sliceDuration = sliceLength / this.audioBuffer.sampleRate / this.timeStretch;
    gainNode.gain.setValueAtTime(velocity, startTime + sliceDuration - this.fadeTime);
    gainNode.gain.linearRampToValueAtTime(0, startTime + sliceDuration);
    
    // Connect chain
    source.connect(gainNode);
    gainNode.connect(this.volumeNode);
    
    // Start playback
    source.start(startTime);
    
    // Store voice
    const voice: SlicerVoice = {
      noteNumber,
      velocity,
      startTime,
      released: false,
      source,
      gainNode,
      sliceIndex: this.slices.indexOf(slice)
    };
    
    this.slicerVoices.set(noteNumber, voice);
    
    // Auto-cleanup when slice ends
    source.onended = () => {
      this.cleanupVoice(noteNumber);
    };
  }
  
  /**
   * Release a note
   */
  protected releaseNote(noteNumber: number): void {
    const voice = this.slicerVoices.get(noteNumber);
    if (!voice || voice.released) return;
    
    voice.released = true;
    const releaseTime = this.audioContext.currentTime;
    
    // Quick fade out
    voice.gainNode.gain.cancelScheduledValues(releaseTime);
    voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, releaseTime);
    voice.gainNode.gain.linearRampToValueAtTime(0, releaseTime + this.fadeTime);
    
    // Schedule cleanup
    setTimeout(() => {
      this.cleanupVoice(noteNumber);
    }, (this.fadeTime + 0.05) * 1000);
  }
  
  /**
   * Clean up a voice
   */
  private cleanupVoice(noteNumber: number): void {
    const voice = this.slicerVoices.get(noteNumber);
    if (!voice) return;
    
    try {
      voice.source.stop();
      voice.source.disconnect();
    } catch (e) {
      // Already stopped
    }
    
    voice.gainNode.disconnect();
    this.slicerVoices.delete(noteNumber);
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    switch (key) {
      case 'sliceCount':
        this.createEqualSlices(Math.floor(value));
        break;
      case 'timeStretch':
        this.timeStretch = value;
        break;
      case 'reverse':
        this.reverseSlices = value > 0.5;
        break;
      case 'fadeTime':
        this.fadeTime = value;
        break;
      case 'snapToZero':
        this.snapToZeroCrossing = value > 0.5;
        break;
    }
  }
  
  /**
   * Initialize instrument
   */
  protected initializeInstrument(): void {
    this.params['sliceCount'] = this.sliceCount;
    this.params['timeStretch'] = this.timeStretch;
    this.params['reverse'] = this.reverseSlices ? 1 : 0;
    this.params['fadeTime'] = this.fadeTime;
    this.params['snapToZero'] = this.snapToZeroCrossing ? 1 : 0;
  }
  
  /**
   * Get parameter descriptors
   */
  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    return [
      { name: 'Slice Count', key: 'sliceCount', min: 1, max: 128, default: 16, step: 1, category: 'Slicing' },
      { name: 'Time Stretch', key: 'timeStretch', min: 0.25, max: 4, default: 1, category: 'Playback' },
      { name: 'Reverse', key: 'reverse', min: 0, max: 1, default: 0, type: 'boolean', category: 'Playback' },
      { name: 'Fade Time', key: 'fadeTime', min: 0, max: 0.1, default: 0.005, unit: 's', category: 'Playback' },
      { name: 'Snap to Zero', key: 'snapToZero', min: 0, max: 1, default: 1, type: 'boolean', category: 'Slicing' }
    ];
  }
  
  /**
   * Get audio buffer
   */
  getAudioBuffer(): AudioBuffer | null {
    return this.audioBuffer;
  }
  
  /**
   * Get detected BPM
   */
  getDetectedBpm(): number {
    return this.detectedBpm;
  }
  
  /**
   * Get detected beats
   */
  getDetectedBeats(): number[] {
    return [...this.detectedBeats];
  }
  
  /**
   * Get loading state
   */
  isFileLoading(): boolean {
    return this.isLoading;
  }
  
  /**
   * Get load error
   */
  getLoadError(): string | null {
    return this.loadError;
  }
  
  /**
   * Check if a file is loaded
   */
  isFileLoaded(): boolean {
    return this.audioBuffer !== null;
  }
  
  /**
   * Get loaded file name
   */
  getFileName(): string {
    return this.fileName;
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    for (const noteNumber of this.slicerVoices.keys()) {
      this.cleanupVoice(noteNumber);
    }
    this.audioBuffer = null;
    this.slices = [];
    super.dispose();
  }
}

// Factory function
export function createSlicerT(audioContext: AudioContext, id?: string): SlicerT {
  return new SlicerT(audioContext, id || `slicert-${Date.now()}`);
}