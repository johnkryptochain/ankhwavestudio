// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * GigPlayer - GIG (Gigasampler) File Player
 * Plays multi-sample instruments from GIG files
 * 
 * Features:
 * - Parse GIG (Gigasampler) files
 * - Multi-sample playback
 * - Velocity layers
 * - Key zones
 */

import { BaseInstrument, type InstrumentParameterDescriptor } from './BaseInstrument';
import { clamp } from '../utils/AudioMath';

// ============================================================================
// Types
// ============================================================================

/**
 * GIG file region (key zone)
 */
export interface GigRegion {
  keyRangeLow: number;
  keyRangeHigh: number;
  velocityRangeLow: number;
  velocityRangeHigh: number;
  sampleIndex: number;
  rootKey: number;
  fineTune: number;
  gain: number;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  attackTime: number;
  decayTime: number;
  sustainLevel: number;
  releaseTime: number;
}

/**
 * GIG file instrument
 */
export interface GigInstrument {
  name: string;
  regions: GigRegion[];
}

/**
 * GIG file sample
 */
export interface GigSample {
  name: string;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  data: Float32Array;
  loopStart: number;
  loopEnd: number;
}

/**
 * Parsed GIG file
 */
export interface GigFile {
  name: string;
  instruments: GigInstrument[];
  samples: GigSample[];
}

/**
 * Active voice state
 */
interface GigVoice {
  noteNumber: number;
  velocity: number;
  startTime: number;
  released: boolean;
  sources: AudioBufferSourceNode[];
  gains: GainNode[];
  envelopes: GainNode[];
}

// ============================================================================
// GigPlayer Instrument
// ============================================================================

export class GigPlayer extends BaseInstrument {
  // Loaded GIG file
  private gigFile: GigFile | null = null;
  
  // Current instrument index
  private currentInstrumentIndex: number = 0;
  
  // Audio buffers for samples
  private sampleBuffers: Map<number, AudioBuffer> = new Map();
  
  // Active voices
  private gigVoices: Map<number, GigVoice> = new Map();
  
  // Loading state
  private isLoading: boolean = false;
  private loadError: string | null = null;
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'GigPlayer', 'gigplayer');
    this.initializeInstrument();
  }
  
  /**
   * Load a GIG file from ArrayBuffer
   */
  async loadGigFile(data: ArrayBuffer, filename: string): Promise<boolean> {
    this.isLoading = true;
    this.loadError = null;
    
    try {
      // Parse the GIG file
      this.gigFile = await this.parseGigFile(data, filename);
      
      // Convert samples to AudioBuffers
      await this.createSampleBuffers();
      
      this.isLoading = false;
      return true;
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Unknown error loading GIG file';
      this.isLoading = false;
      console.error('Error loading GIG file:', error);
      return false;
    }
  }
  
  /**
   * Parse GIG file format
   * GIG files are based on the DLS (Downloadable Sounds) format with extensions
   */
  private async parseGigFile(data: ArrayBuffer, filename: string): Promise<GigFile> {
    const view = new DataView(data);
    
    // Check RIFF header
    const riffId = this.readFourCC(view, 0);
    if (riffId !== 'RIFF') {
      throw new Error('Invalid GIG file: Missing RIFF header');
    }
    
    const fileSize = view.getUint32(4, true);
    const formType = this.readFourCC(view, 8);
    
    if (formType !== 'DLS ' && formType !== 'GIG ') {
      throw new Error(`Invalid GIG file: Expected DLS or GIG format, got ${formType}`);
    }
    
    const gigFile: GigFile = {
      name: filename.replace(/\.gig$/i, ''),
      instruments: [],
      samples: []
    };
    
    // Parse chunks
    let offset = 12;
    while (offset < data.byteLength - 8) {
      const chunkId = this.readFourCC(view, offset);
      const chunkSize = view.getUint32(offset + 4, true);
      
      switch (chunkId) {
        case 'LIST':
          const listType = this.readFourCC(view, offset + 8);
          if (listType === 'lins') {
            // Instrument list
            this.parseInstrumentList(view, offset + 12, chunkSize - 4, gigFile);
          } else if (listType === 'wvpl') {
            // Wave pool (samples)
            this.parseWavePool(view, offset + 12, chunkSize - 4, gigFile);
          }
          break;
        case 'ptbl':
          // Pool table
          break;
      }
      
      offset += 8 + chunkSize;
      if (chunkSize % 2 !== 0) offset++; // Padding
    }
    
    // If no instruments/samples found, create a default
    if (gigFile.instruments.length === 0) {
      gigFile.instruments.push({
        name: 'Default',
        regions: [{
          keyRangeLow: 0,
          keyRangeHigh: 127,
          velocityRangeLow: 0,
          velocityRangeHigh: 127,
          sampleIndex: 0,
          rootKey: 60,
          fineTune: 0,
          gain: 1,
          loopEnabled: false,
          loopStart: 0,
          loopEnd: 0,
          attackTime: 0.01,
          decayTime: 0.1,
          sustainLevel: 0.8,
          releaseTime: 0.3
        }]
      });
    }
    
    return gigFile;
  }
  
  /**
   * Read a FourCC string from DataView
   */
  private readFourCC(view: DataView, offset: number): string {
    return String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
  }
  
  /**
   * Parse instrument list chunk
   */
  private parseInstrumentList(view: DataView, offset: number, size: number, gigFile: GigFile): void {
    const endOffset = offset + size;
    
    while (offset < endOffset - 8) {
      const chunkId = this.readFourCC(view, offset);
      const chunkSize = view.getUint32(offset + 4, true);
      
      if (chunkId === 'LIST') {
        const listType = this.readFourCC(view, offset + 8);
        if (listType === 'ins ') {
          const instrument = this.parseInstrument(view, offset + 12, chunkSize - 4);
          gigFile.instruments.push(instrument);
        }
      }
      
      offset += 8 + chunkSize;
      if (chunkSize % 2 !== 0) offset++;
    }
  }
  
  /**
   * Parse a single instrument
   */
  private parseInstrument(view: DataView, offset: number, size: number): GigInstrument {
    const instrument: GigInstrument = {
      name: 'Instrument',
      regions: []
    };
    
    const endOffset = offset + size;
    
    while (offset < endOffset - 8) {
      const chunkId = this.readFourCC(view, offset);
      const chunkSize = view.getUint32(offset + 4, true);
      
      if (chunkId === 'LIST') {
        const listType = this.readFourCC(view, offset + 8);
        if (listType === 'lrgn') {
          // Region list
          this.parseRegionList(view, offset + 12, chunkSize - 4, instrument);
        }
      } else if (chunkId === 'insh') {
        // Instrument header
        // Contains region count, bank, program
      } else if (chunkId === 'INFO') {
        // Info chunk with name
      }
      
      offset += 8 + chunkSize;
      if (chunkSize % 2 !== 0) offset++;
    }
    
    return instrument;
  }
  
  /**
   * Parse region list
   */
  private parseRegionList(view: DataView, offset: number, size: number, instrument: GigInstrument): void {
    const endOffset = offset + size;
    
    while (offset < endOffset - 8) {
      const chunkId = this.readFourCC(view, offset);
      const chunkSize = view.getUint32(offset + 4, true);
      
      if (chunkId === 'LIST') {
        const listType = this.readFourCC(view, offset + 8);
        if (listType === 'rgn ' || listType === 'rgn2') {
          const region = this.parseRegion(view, offset + 12, chunkSize - 4);
          instrument.regions.push(region);
        }
      }
      
      offset += 8 + chunkSize;
      if (chunkSize % 2 !== 0) offset++;
    }
  }
  
  /**
   * Parse a single region
   */
  private parseRegion(view: DataView, offset: number, size: number): GigRegion {
    const region: GigRegion = {
      keyRangeLow: 0,
      keyRangeHigh: 127,
      velocityRangeLow: 0,
      velocityRangeHigh: 127,
      sampleIndex: 0,
      rootKey: 60,
      fineTune: 0,
      gain: 1,
      loopEnabled: false,
      loopStart: 0,
      loopEnd: 0,
      attackTime: 0.01,
      decayTime: 0.1,
      sustainLevel: 0.8,
      releaseTime: 0.3
    };
    
    const endOffset = offset + size;
    
    while (offset < endOffset - 8) {
      const chunkId = this.readFourCC(view, offset);
      const chunkSize = view.getUint32(offset + 4, true);
      
      if (chunkId === 'rgnh') {
        // Region header
        region.keyRangeLow = view.getUint16(offset + 8, true);
        region.keyRangeHigh = view.getUint16(offset + 10, true);
        region.velocityRangeLow = view.getUint16(offset + 12, true);
        region.velocityRangeHigh = view.getUint16(offset + 14, true);
      } else if (chunkId === 'wlnk') {
        // Wave link
        region.sampleIndex = view.getUint32(offset + 16, true);
      } else if (chunkId === 'wsmp') {
        // Wave sample info
        region.rootKey = view.getUint16(offset + 12, true);
        region.fineTune = view.getInt16(offset + 14, true);
        region.gain = view.getInt32(offset + 16, true) / 655360; // Convert from DLS gain
        
        const loopCount = view.getUint32(offset + 24, true);
        if (loopCount > 0) {
          region.loopEnabled = true;
          region.loopStart = view.getUint32(offset + 36, true);
          region.loopEnd = region.loopStart + view.getUint32(offset + 40, true);
        }
      }
      
      offset += 8 + chunkSize;
      if (chunkSize % 2 !== 0) offset++;
    }
    
    return region;
  }
  
  /**
   * Parse wave pool (samples)
   */
  private parseWavePool(view: DataView, offset: number, size: number, gigFile: GigFile): void {
    const endOffset = offset + size;
    
    while (offset < endOffset - 8) {
      const chunkId = this.readFourCC(view, offset);
      const chunkSize = view.getUint32(offset + 4, true);
      
      if (chunkId === 'LIST') {
        const listType = this.readFourCC(view, offset + 8);
        if (listType === 'wave') {
          const sample = this.parseSample(view, offset + 12, chunkSize - 4);
          gigFile.samples.push(sample);
        }
      }
      
      offset += 8 + chunkSize;
      if (chunkSize % 2 !== 0) offset++;
    }
  }
  
  /**
   * Parse a single sample
   */
  private parseSample(view: DataView, offset: number, size: number): GigSample {
    const sample: GigSample = {
      name: 'Sample',
      sampleRate: 44100,
      channels: 1,
      bitDepth: 16,
      data: new Float32Array(0),
      loopStart: 0,
      loopEnd: 0
    };
    
    const endOffset = offset + size;
    
    while (offset < endOffset - 8) {
      const chunkId = this.readFourCC(view, offset);
      const chunkSize = view.getUint32(offset + 4, true);
      
      if (chunkId === 'fmt ') {
        // Format chunk
        const formatTag = view.getUint16(offset + 8, true);
        sample.channels = view.getUint16(offset + 10, true);
        sample.sampleRate = view.getUint32(offset + 12, true);
        sample.bitDepth = view.getUint16(offset + 22, true);
      } else if (chunkId === 'data') {
        // Sample data
        const dataOffset = offset + 8;
        const sampleCount = chunkSize / (sample.bitDepth / 8) / sample.channels;
        sample.data = new Float32Array(sampleCount);
        
        if (sample.bitDepth === 16) {
          for (let i = 0; i < sampleCount; i++) {
            const sampleValue = view.getInt16(dataOffset + i * 2, true);
            sample.data[i] = sampleValue / 32768;
          }
        } else if (sample.bitDepth === 24) {
          for (let i = 0; i < sampleCount; i++) {
            const byte1 = view.getUint8(dataOffset + i * 3);
            const byte2 = view.getUint8(dataOffset + i * 3 + 1);
            const byte3 = view.getInt8(dataOffset + i * 3 + 2);
            const sampleValue = (byte3 << 16) | (byte2 << 8) | byte1;
            sample.data[i] = sampleValue / 8388608;
          }
        }
        
        sample.loopEnd = sampleCount;
      }
      
      offset += 8 + chunkSize;
      if (chunkSize % 2 !== 0) offset++;
    }
    
    return sample;
  }
  
  /**
   * Create AudioBuffers from samples
   */
  private async createSampleBuffers(): Promise<void> {
    if (!this.gigFile) return;
    
    this.sampleBuffers.clear();
    
    for (let i = 0; i < this.gigFile.samples.length; i++) {
      const sample = this.gigFile.samples[i];
      
      const buffer = this.audioContext.createBuffer(
        sample.channels,
        sample.data.length,
        sample.sampleRate
      );
      
      // Copy data to buffer
      const channelData = buffer.getChannelData(0);
      channelData.set(sample.data);
      
      this.sampleBuffers.set(i, buffer);
    }
  }
  
  /**
   * Get list of instruments in loaded GIG file
   */
  getInstrumentList(): string[] {
    if (!this.gigFile) return [];
    return this.gigFile.instruments.map(inst => inst.name);
  }
  
  /**
   * Select an instrument by index
   */
  selectInstrument(index: number): void {
    if (!this.gigFile) return;
    if (index >= 0 && index < this.gigFile.instruments.length) {
      this.currentInstrumentIndex = index;
      this.params['instrumentIndex'] = index;
    }
  }
  
  /**
   * Get current instrument
   */
  getCurrentInstrument(): GigInstrument | null {
    if (!this.gigFile) return null;
    return this.gigFile.instruments[this.currentInstrumentIndex] || null;
  }
  
  /**
   * Find matching region for note and velocity
   */
  private findRegion(noteNumber: number, velocity: number): GigRegion | null {
    const instrument = this.getCurrentInstrument();
    if (!instrument) return null;
    
    for (const region of instrument.regions) {
      if (noteNumber >= region.keyRangeLow && noteNumber <= region.keyRangeHigh &&
          velocity >= region.velocityRangeLow && velocity <= region.velocityRangeHigh) {
        return region;
      }
    }
    
    return null;
  }
  
  /**
   * Trigger a note
   */
  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    const region = this.findRegion(noteNumber, Math.floor(velocity * 127));
    if (!region) return;
    
    const buffer = this.sampleBuffers.get(region.sampleIndex);
    if (!buffer) return;
    
    const startTime = this.audioContext.currentTime;
    
    // Create source
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    
    // Calculate playback rate based on pitch difference
    const pitchDiff = noteNumber - region.rootKey + region.fineTune / 100;
    source.playbackRate.value = Math.pow(2, pitchDiff / 12);
    
    // Set up looping
    if (region.loopEnabled) {
      source.loop = true;
      source.loopStart = region.loopStart / buffer.sampleRate;
      source.loopEnd = region.loopEnd / buffer.sampleRate;
    }
    
    // Create gain node
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = region.gain * velocity;
    
    // Create envelope
    const envelopeNode = this.audioContext.createGain();
    envelopeNode.gain.setValueAtTime(0, startTime);
    envelopeNode.gain.linearRampToValueAtTime(1, startTime + region.attackTime);
    envelopeNode.gain.linearRampToValueAtTime(
      region.sustainLevel,
      startTime + region.attackTime + region.decayTime
    );
    
    // Connect chain
    source.connect(gainNode);
    gainNode.connect(envelopeNode);
    envelopeNode.connect(this.volumeNode);
    
    // Start playback
    source.start(startTime);
    
    // Store voice
    const voice: GigVoice = {
      noteNumber,
      velocity,
      startTime,
      released: false,
      sources: [source],
      gains: [gainNode],
      envelopes: [envelopeNode]
    };
    
    this.gigVoices.set(noteNumber, voice);
  }
  
  /**
   * Release a note
   */
  protected releaseNote(noteNumber: number): void {
    const voice = this.gigVoices.get(noteNumber);
    if (!voice || voice.released) return;
    
    voice.released = true;
    const releaseTime = this.audioContext.currentTime;
    
    const region = this.findRegion(noteNumber, Math.floor(voice.velocity * 127));
    const releaseLength = region?.releaseTime || 0.3;
    
    // Apply release envelope
    for (const envelope of voice.envelopes) {
      envelope.gain.cancelScheduledValues(releaseTime);
      envelope.gain.setValueAtTime(envelope.gain.value, releaseTime);
      envelope.gain.exponentialRampToValueAtTime(0.001, releaseTime + releaseLength);
    }
    
    // Schedule cleanup
    setTimeout(() => {
      this.cleanupVoice(noteNumber);
    }, (releaseLength + 0.1) * 1000);
  }
  
  /**
   * Clean up a voice
   */
  private cleanupVoice(noteNumber: number): void {
    const voice = this.gigVoices.get(noteNumber);
    if (!voice) return;
    
    for (const source of voice.sources) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Already stopped
      }
    }
    
    for (const gain of voice.gains) {
      gain.disconnect();
    }
    
    for (const envelope of voice.envelopes) {
      envelope.disconnect();
    }
    
    this.gigVoices.delete(noteNumber);
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    switch (key) {
      case 'instrumentIndex':
        this.selectInstrument(Math.floor(value));
        break;
      case 'attack':
        // Update attack for all regions
        break;
      case 'decay':
        // Update decay for all regions
        break;
      case 'sustain':
        // Update sustain for all regions
        break;
      case 'release':
        // Update release for all regions
        break;
    }
  }
  
  /**
   * Initialize instrument
   */
  protected initializeInstrument(): void {
    this.params['instrumentIndex'] = 0;
    this.params['attack'] = 0.01;
    this.params['decay'] = 0.1;
    this.params['sustain'] = 0.8;
    this.params['release'] = 0.3;
    this.params['gain'] = 1;
  }
  
  /**
   * Get parameter descriptors
   */
  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    return [
      { name: 'Instrument', key: 'instrumentIndex', min: 0, max: 127, default: 0, step: 1, category: 'Instrument' },
      { name: 'Attack', key: 'attack', min: 0.001, max: 5, default: 0.01, unit: 's', category: 'Envelope' },
      { name: 'Decay', key: 'decay', min: 0.001, max: 5, default: 0.1, unit: 's', category: 'Envelope' },
      { name: 'Sustain', key: 'sustain', min: 0, max: 1, default: 0.8, category: 'Envelope' },
      { name: 'Release', key: 'release', min: 0.001, max: 10, default: 0.3, unit: 's', category: 'Envelope' },
      { name: 'Gain', key: 'gain', min: 0, max: 2, default: 1, category: 'Output' }
    ];
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
    return this.gigFile !== null;
  }
  
  /**
   * Get loaded file name
   */
  getFileName(): string | null {
    return this.gigFile?.name || null;
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    for (const noteNumber of this.gigVoices.keys()) {
      this.cleanupVoice(noteNumber);
    }
    this.sampleBuffers.clear();
    this.gigFile = null;
    super.dispose();
  }
}

// Factory function
export function createGigPlayer(audioContext: AudioContext, id?: string): GigPlayer {
  return new GigPlayer(audioContext, id || `gigplayer-${Date.now()}`);
}