// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Vitest Test Setup
 * Mocks for Web Audio API, IndexedDB, Service Worker, and other browser APIs
 */

import { vi, beforeAll, afterAll, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// ============================================================================
// Web Audio API Mocks
// ============================================================================

class MockAudioContext {
  state: AudioContextState = 'running';
  sampleRate = 44100;
  currentTime = 0;
  baseLatency = 0.01;
  destination = {
    channelCount: 2,
    channelCountMode: 'explicit' as ChannelCountMode,
    channelInterpretation: 'speakers' as ChannelInterpretation,
    maxChannelCount: 2,
    numberOfInputs: 1,
    numberOfOutputs: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  private _onstatechange: ((this: AudioContext, ev: Event) => void) | null = null;

  get onstatechange() {
    return this._onstatechange;
  }

  set onstatechange(handler: ((this: AudioContext, ev: Event) => void) | null) {
    this._onstatechange = handler;
  }

  createGain(): GainNode {
    return {
      gain: {
        value: 1,
        setValueAtTime: vi.fn().mockReturnThis(),
        linearRampToValueAtTime: vi.fn().mockReturnThis(),
        exponentialRampToValueAtTime: vi.fn().mockReturnThis(),
        setTargetAtTime: vi.fn().mockReturnThis(),
        cancelScheduledValues: vi.fn().mockReturnThis(),
      },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      channelCount: 2,
      channelCountMode: 'max' as ChannelCountMode,
      channelInterpretation: 'speakers' as ChannelInterpretation,
      numberOfInputs: 1,
      numberOfOutputs: 1,
    } as unknown as GainNode;
  }

  createOscillator(): OscillatorNode {
    return {
      type: 'sine',
      frequency: {
        value: 440,
        setValueAtTime: vi.fn().mockReturnThis(),
        linearRampToValueAtTime: vi.fn().mockReturnThis(),
        exponentialRampToValueAtTime: vi.fn().mockReturnThis(),
      },
      detune: {
        value: 0,
        setValueAtTime: vi.fn().mockReturnThis(),
      },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    } as unknown as OscillatorNode;
  }

  createBiquadFilter(): BiquadFilterNode {
    return {
      type: 'lowpass',
      frequency: { value: 350, setValueAtTime: vi.fn() },
      Q: { value: 1, setValueAtTime: vi.fn() },
      gain: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    } as unknown as BiquadFilterNode;
  }

  createDynamicsCompressor(): DynamicsCompressorNode {
    return {
      threshold: { value: -24, setValueAtTime: vi.fn() },
      knee: { value: 30, setValueAtTime: vi.fn() },
      ratio: { value: 12, setValueAtTime: vi.fn() },
      attack: { value: 0.003, setValueAtTime: vi.fn() },
      release: { value: 0.25, setValueAtTime: vi.fn() },
      reduction: 0,
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    } as unknown as DynamicsCompressorNode;
  }

  createAnalyser(): AnalyserNode {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      minDecibels: -100,
      maxDecibels: -30,
      smoothingTimeConstant: 0.8,
      getByteFrequencyData: vi.fn((array: Uint8Array) => {
        array.fill(128);
      }),
      getByteTimeDomainData: vi.fn((array: Uint8Array) => {
        array.fill(128);
      }),
      getFloatFrequencyData: vi.fn(),
      getFloatTimeDomainData: vi.fn(),
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    } as unknown as AnalyserNode;
  }

  createChannelSplitter(numberOfOutputs = 2): ChannelSplitterNode {
    return {
      numberOfInputs: 1,
      numberOfOutputs,
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    } as unknown as ChannelSplitterNode;
  }

  createChannelMerger(numberOfInputs = 2): ChannelMergerNode {
    return {
      numberOfInputs,
      numberOfOutputs: 1,
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    } as unknown as ChannelMergerNode;
  }

  createDelay(maxDelayTime = 1): DelayNode {
    return {
      delayTime: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    } as unknown as DelayNode;
  }

  createConvolver(): ConvolverNode {
    return {
      buffer: null,
      normalize: true,
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    } as unknown as ConvolverNode;
  }

  createStereoPanner(): StereoPannerNode {
    return {
      pan: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    } as unknown as StereoPannerNode;
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBuffer {
    return {
      numberOfChannels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: vi.fn(() => new Float32Array(length)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    } as unknown as AudioBuffer;
  }

  createBufferSource(): AudioBufferSourceNode {
    return {
      buffer: null,
      playbackRate: { value: 1, setValueAtTime: vi.fn() },
      detune: { value: 0, setValueAtTime: vi.fn() },
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    } as unknown as AudioBufferSourceNode;
  }

  decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return Promise.resolve(this.createBuffer(2, 44100, 44100));
  }

  async resume(): Promise<void> {
    this.state = 'running';
    if (this._onstatechange) {
      this._onstatechange.call(this as unknown as AudioContext, new Event('statechange'));
    }
  }

  async suspend(): Promise<void> {
    this.state = 'suspended';
    if (this._onstatechange) {
      this._onstatechange.call(this as unknown as AudioContext, new Event('statechange'));
    }
  }

  async close(): Promise<void> {
    this.state = 'closed';
    if (this._onstatechange) {
      this._onstatechange.call(this as unknown as AudioContext, new Event('statechange'));
    }
  }
}

class MockOfflineAudioContext extends MockAudioContext {
  constructor(
    public numberOfChannels: number,
    public length: number,
    sampleRate: number
  ) {
    super();
    this.sampleRate = sampleRate;
  }

  startRendering(): Promise<AudioBuffer> {
    return Promise.resolve(this.createBuffer(this.numberOfChannels, this.length, this.sampleRate));
  }
}

// ============================================================================
// IndexedDB Mock
// ============================================================================

class MockIDBRequest {
  result: unknown = null;
  error: DOMException | null = null;
  onsuccess: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
}

class MockIDBObjectStore {
  name: string;
  keyPath: string | string[] | null = null;
  indexNames: DOMStringList = [] as unknown as DOMStringList;
  autoIncrement = false;

  constructor(name: string) {
    this.name = name;
  }

  put(value: unknown, key?: IDBValidKey): IDBRequest {
    const request = new MockIDBRequest();
    setTimeout(() => {
      request.result = key || 'mock-key';
      request.onsuccess?.(new Event('success'));
    }, 0);
    return request as unknown as IDBRequest;
  }

  get(key: IDBValidKey): IDBRequest {
    const request = new MockIDBRequest();
    setTimeout(() => {
      request.result = null;
      request.onsuccess?.(new Event('success'));
    }, 0);
    return request as unknown as IDBRequest;
  }

  delete(key: IDBValidKey): IDBRequest {
    const request = new MockIDBRequest();
    setTimeout(() => {
      request.onsuccess?.(new Event('success'));
    }, 0);
    return request as unknown as IDBRequest;
  }

  getAll(): IDBRequest {
    const request = new MockIDBRequest();
    setTimeout(() => {
      request.result = [];
      request.onsuccess?.(new Event('success'));
    }, 0);
    return request as unknown as IDBRequest;
  }

  createIndex(): IDBIndex {
    return {} as IDBIndex;
  }
}

class MockIDBTransaction {
  objectStore(name: string): IDBObjectStore {
    return new MockIDBObjectStore(name) as unknown as IDBObjectStore;
  }

  oncomplete: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
}

class MockIDBDatabase {
  name: string;
  version: number;
  objectStoreNames: DOMStringList = [] as unknown as DOMStringList;

  constructor(name: string, version: number) {
    this.name = name;
    this.version = version;
  }

  createObjectStore(name: string, options?: IDBObjectStoreParameters): IDBObjectStore {
    return new MockIDBObjectStore(name) as unknown as IDBObjectStore;
  }

  transaction(storeNames: string | string[], mode?: IDBTransactionMode): IDBTransaction {
    return new MockIDBTransaction() as unknown as IDBTransaction;
  }

  close(): void {}
}

class MockIDBOpenDBRequest extends MockIDBRequest {
  onupgradeneeded: ((event: IDBVersionChangeEvent) => void) | null = null;
  onblocked: ((event: Event) => void) | null = null;
}

const mockIndexedDB = {
  open(name: string, version?: number): IDBOpenDBRequest {
    const request = new MockIDBOpenDBRequest();
    setTimeout(() => {
      request.result = new MockIDBDatabase(name, version || 1);
      request.onsuccess?.(new Event('success'));
    }, 0);
    return request as unknown as IDBOpenDBRequest;
  },
  deleteDatabase(name: string): IDBOpenDBRequest {
    const request = new MockIDBOpenDBRequest();
    setTimeout(() => {
      request.onsuccess?.(new Event('success'));
    }, 0);
    return request as unknown as IDBOpenDBRequest;
  },
};

// ============================================================================
// Service Worker Mock
// ============================================================================

const mockServiceWorkerContainer = {
  controller: null as ServiceWorker | null,
  ready: Promise.resolve({
    active: null,
    installing: null,
    waiting: null,
    scope: '/',
    updateViaCache: 'none' as ServiceWorkerUpdateViaCache,
    update: vi.fn().mockResolvedValue(undefined),
    unregister: vi.fn().mockResolvedValue(true),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as ServiceWorkerRegistration),
  register: vi.fn().mockResolvedValue({
    scope: '/',
    active: null,
    installing: null,
    waiting: null,
    update: vi.fn(),
    unregister: vi.fn(),
  }),
  getRegistration: vi.fn().mockResolvedValue(undefined),
  getRegistrations: vi.fn().mockResolvedValue([]),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  startMessages: vi.fn(),
};

// ============================================================================
// Storage Mock
// ============================================================================

const mockStorage = {
  persisted: vi.fn().mockResolvedValue(false),
  persist: vi.fn().mockResolvedValue(true),
  estimate: vi.fn().mockResolvedValue({
    quota: 1024 * 1024 * 1024,
    usage: 0,
  }),
};

// ============================================================================
// Media Devices Mock
// ============================================================================

const mockMediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue({
    getTracks: () => [],
    getAudioTracks: () => [],
    getVideoTracks: () => [],
  }),
  enumerateDevices: vi.fn().mockResolvedValue([]),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// ============================================================================
// ResizeObserver Mock
// ============================================================================

class MockResizeObserver {
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// ============================================================================
// IntersectionObserver Mock
// ============================================================================

class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  root: Element | null = null;
  rootMargin = '0px';
  thresholds: ReadonlyArray<number> = [0];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}

// ============================================================================
// matchMedia Mock
// ============================================================================

const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// ============================================================================
// requestAnimationFrame Mock
// ============================================================================

let rafId = 0;
const mockRequestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  rafId++;
  setTimeout(() => callback(performance.now()), 16);
  return rafId;
});

const mockCancelAnimationFrame = vi.fn((id: number) => {
  // No-op in tests
});

// ============================================================================
// Setup and Teardown
// ============================================================================

beforeAll(() => {
  // Web Audio API
  global.AudioContext = MockAudioContext as unknown as typeof AudioContext;
  global.OfflineAudioContext = MockOfflineAudioContext as unknown as typeof OfflineAudioContext;
  (global as any).webkitAudioContext = MockAudioContext;

  // IndexedDB
  global.indexedDB = mockIndexedDB as unknown as IDBFactory;

  // Service Worker
  Object.defineProperty(navigator, 'serviceWorker', {
    value: mockServiceWorkerContainer,
    writable: true,
    configurable: true,
  });

  // Storage
  Object.defineProperty(navigator, 'storage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });

  // Media Devices
  Object.defineProperty(navigator, 'mediaDevices', {
    value: mockMediaDevices,
    writable: true,
    configurable: true,
  });

  // ResizeObserver
  global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

  // IntersectionObserver
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

  // matchMedia
  global.matchMedia = mockMatchMedia;

  // requestAnimationFrame
  global.requestAnimationFrame = mockRequestAnimationFrame;
  global.cancelAnimationFrame = mockCancelAnimationFrame;

  // URL.createObjectURL
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();

  // Clipboard API
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
      write: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue([]),
    },
    writable: true,
    configurable: true,
  });

  // Vibration API
  Object.defineProperty(navigator, 'vibrate', {
    value: vi.fn().mockReturnValue(true),
    writable: true,
    configurable: true,
  });

  // Online status
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Wait for all pending promises to resolve
 */
export const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Create a mock audio buffer
 */
export const createMockAudioBuffer = (
  channels = 2,
  length = 44100,
  sampleRate = 44100
): AudioBuffer => {
  const ctx = new MockAudioContext();
  return ctx.createBuffer(channels, length, sampleRate);
};

/**
 * Simulate user interaction for audio context
 */
export const simulateUserInteraction = async () => {
  const event = new MouseEvent('click', { bubbles: true });
  document.body.dispatchEvent(event);
  await flushPromises();
};

/**
 * Create a mock file
 */
export const createMockFile = (
  name: string,
  content: string,
  type = 'text/plain'
): File => {
  return new File([content], name, { type });
};

/**
 * Create a mock audio file
 */
export const createMockAudioFile = (name = 'test.wav'): File => {
  const buffer = new ArrayBuffer(44);
  return new File([buffer], name, { type: 'audio/wav' });
};