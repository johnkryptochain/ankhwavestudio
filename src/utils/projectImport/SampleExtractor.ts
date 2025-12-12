// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Sample Extractor
 * Extracts and manages samples from AnkhWaveStudio project files
 */

import type {
  AnkhWaveStudioProjectFile,
  AnkhWaveStudioInstrumentTrack,
  AnkhWaveStudioSampleTrack,
} from '../../types/ankhWaveProject';

/**
 * Extracted sample data
 */
export interface ExtractedSample {
  id: string;
  name: string;
  path: string;
  embedded: boolean;
  data?: ArrayBuffer;
  mimeType: string;
  size: number;
  missing: boolean;
}

/**
 * Sample extraction result
 */
export interface SampleExtractionResult {
  samples: ExtractedSample[];
  missingSamples: string[];
  embeddedCount: number;
  externalCount: number;
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

/**
 * Get MIME type from file extension
 */
function getMimeType(path: string): string {
  const ext = path.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'wav': 'audio/wav',
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    'aif': 'audio/aiff',
    'aiff': 'audio/aiff',
    'm4a': 'audio/mp4',
    'wma': 'audio/x-ms-wma',
  };
  return mimeTypes[ext || ''] || 'audio/wav';
}

/**
 * Get file name from path
 */
function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

/**
 * Sample Extractor class
 */
export class SampleExtractor {
  private samples: Map<string, ExtractedSample> = new Map();
  private missingSamples: Set<string> = new Set();

  /**
   * Extract all samples from an AnkhWaveStudio project
   */
  extract(project: AnkhWaveStudioProjectFile): SampleExtractionResult {
    this.samples.clear();
    this.missingSamples.clear();

    // Extract from instrument tracks (AudioFileProcessor, SF2Player)
    for (const track of project.song.trackcontainer.tracks) {
      if (track.type === 0) {
        this.extractFromInstrumentTrack(track as AnkhWaveStudioInstrumentTrack);
      } else if (track.type === 2) {
        this.extractFromSampleTrack(track as AnkhWaveStudioSampleTrack);
      }
    }

    const samples = Array.from(this.samples.values());
    const embeddedCount = samples.filter(s => s.embedded).length;
    const externalCount = samples.filter(s => !s.embedded && !s.missing).length;

    return {
      samples,
      missingSamples: Array.from(this.missingSamples),
      embeddedCount,
      externalCount,
    };
  }

  /**
   * Extract samples from instrument track
   */
  private extractFromInstrumentTrack(track: AnkhWaveStudioInstrumentTrack): void {
    const instrument = track.instrumenttrack.instrument;
    const params = instrument.params;

    // AudioFileProcessor
    if (instrument.name === 'audiofileprocessor') {
      const src = params['src'] as string;
      if (src) {
        this.addSample(src, false);
      }
    }

    // SF2Player (SoundFont)
    if (instrument.name === 'sf2player') {
      const src = params['src'] as string;
      if (src) {
        this.addSample(src, false);
      }
    }
  }

  /**
   * Extract samples from sample track
   */
  private extractFromSampleTrack(track: AnkhWaveStudioSampleTrack): void {
    for (const clip of track.sampletrack.clips) {
      if (clip.src) {
        const embedded = !!clip.data;
        const data = clip.data ? this.base64ToArrayBuffer(clip.data) : undefined;
        this.addSample(clip.src, embedded, data);
      }
    }
  }

  /**
   * Add a sample to the collection
   */
  private addSample(path: string, embedded: boolean, data?: ArrayBuffer): void {
    // Skip if already added
    if (this.samples.has(path)) {
      return;
    }

    const sample: ExtractedSample = {
      id: generateId(),
      name: getFileName(path),
      path,
      embedded,
      data,
      mimeType: getMimeType(path),
      size: data?.byteLength || 0,
      missing: !embedded && !data,
    };

    this.samples.set(path, sample);

    if (sample.missing) {
      this.missingSamples.add(path);
    }
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Get a sample by path
   */
  getSample(path: string): ExtractedSample | undefined {
    return this.samples.get(path);
  }

  /**
   * Get all samples
   */
  getAllSamples(): ExtractedSample[] {
    return Array.from(this.samples.values());
  }

  /**
   * Check if a sample is missing
   */
  isMissing(path: string): boolean {
    return this.missingSamples.has(path);
  }

  /**
   * Provide a replacement for a missing sample
   */
  provideSample(path: string, data: ArrayBuffer): void {
    const existing = this.samples.get(path);
    if (existing) {
      existing.data = data;
      existing.size = data.byteLength;
      existing.missing = false;
      this.missingSamples.delete(path);
    }
  }

  /**
   * Create a Blob URL for a sample
   */
  createBlobUrl(sample: ExtractedSample): string | null {
    if (!sample.data) return null;
    const blob = new Blob([sample.data], { type: sample.mimeType });
    return URL.createObjectURL(blob);
  }

  /**
   * Decode sample data to AudioBuffer
   */
  async decodeAudio(
    sample: ExtractedSample,
    audioContext: AudioContext
  ): Promise<AudioBuffer | null> {
    if (!sample.data) return null;
    
    try {
      return await audioContext.decodeAudioData(sample.data.slice(0));
    } catch (error) {
      console.error(`Failed to decode audio for ${sample.name}:`, error);
      return null;
    }
  }
}

/**
 * Store samples in IndexedDB
 */
export class SampleStorage {
  private dbName = 'AnkhWaveStudio-web-samples';
  private storeName = 'samples';
  private db: IDBDatabase | null = null;

  /**
   * Open the database
   */
  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Store a sample
   */
  async store(sample: ExtractedSample): Promise<void> {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(sample);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Store multiple samples
   */
  async storeAll(samples: ExtractedSample[]): Promise<void> {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      for (const sample of samples) {
        store.put(sample);
      }
    });
  }

  /**
   * Get a sample by ID
   */
  async get(id: string): Promise<ExtractedSample | undefined> {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Get all samples
   */
  async getAll(): Promise<ExtractedSample[]> {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Delete a sample
   */
  async delete(id: string): Promise<void> {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Clear all samples
   */
  async clear(): Promise<void> {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Close the database
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

/**
 * Extract samples from AnkhWaveStudio project and store in IndexedDB
 */
export async function extractAndStoreSamples(
  project: AnkhWaveStudioProjectFile
): Promise<SampleExtractionResult> {
  const extractor = new SampleExtractor();
  const result = extractor.extract(project);

  // Store embedded samples in IndexedDB
  const storage = new SampleStorage();
  await storage.open();

  const embeddedSamples = result.samples.filter(s => s.embedded && s.data);
  if (embeddedSamples.length > 0) {
    await storage.storeAll(embeddedSamples);
  }

  storage.close();

  return result;
}

export default SampleExtractor;