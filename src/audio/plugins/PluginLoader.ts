// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * PluginLoader - Load and manage WebAssembly plugins
 * Handles loading from URLs, local storage, and plugin sandboxing
 */

import type { WAPManifest, WAPParameterDescriptor, WAPPreset } from './PluginHost';

/**
 * Plugin source types
 */
export type PluginSource = 'url' | 'local' | 'builtin' | 'marketplace';

/**
 * Plugin load result
 */
export interface PluginLoadResult {
  success: boolean;
  manifest?: WAPManifest;
  error?: string;
  source: PluginSource;
  loadTime: number;
}

/**
 * Plugin cache entry
 */
export interface PluginCacheEntry {
  manifest: WAPManifest;
  wasmBuffer: ArrayBuffer;
  timestamp: number;
  source: PluginSource;
}

/**
 * Plugin validation result
 */
export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Plugin sandbox configuration
 */
export interface PluginSandboxConfig {
  maxMemoryMB: number;
  maxCPUPercent: number;
  allowNetworkAccess: boolean;
  allowFileAccess: boolean;
  allowedOrigins: string[];
}

/**
 * Default sandbox configuration
 */
const DEFAULT_SANDBOX_CONFIG: PluginSandboxConfig = {
  maxMemoryMB: 256,
  maxCPUPercent: 50,
  allowNetworkAccess: false,
  allowFileAccess: false,
  allowedOrigins: []
};

/**
 * Plugin parameter mapping for automation
 */
export interface ParameterMapping {
  pluginParamId: string;
  automationTrackId?: string;
  midiCC?: number;
  min: number;
  max: number;
  curve?: 'linear' | 'logarithmic' | 'exponential';
}

/**
 * PluginLoader class - handles loading and caching of plugins
 */
export class PluginLoader {
  private static instance: PluginLoader | null = null;
  
  private cache: Map<string, PluginCacheEntry> = new Map();
  private sandboxConfig: PluginSandboxConfig = DEFAULT_SANDBOX_CONFIG;
  private trustedOrigins: Set<string> = new Set([
    'https://plugins.AnkhWaveStudio.io',
    'https://wap.AnkhWaveStudio.io'
  ]);
  
  // IndexedDB for persistent storage
  private dbName = 'AnkhWaveStudio-plugins';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  
  private constructor() {}
  
  /**
   * Get singleton instance
   */
  public static getInstance(): PluginLoader {
    if (!PluginLoader.instance) {
      PluginLoader.instance = new PluginLoader();
    }
    return PluginLoader.instance;
  }
  
  /**
   * Initialize the plugin loader
   */
  public async initialize(): Promise<void> {
    await this.openDatabase();
    await this.loadCachedManifests();
  }
  
  /**
   * Open IndexedDB for plugin storage
   */
  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => {
        console.error('Failed to open plugin database:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('manifests')) {
          db.createObjectStore('manifests', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('wasm')) {
          db.createObjectStore('wasm', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('presets')) {
          const presetStore = db.createObjectStore('presets', { keyPath: 'id' });
          presetStore.createIndex('pluginId', 'pluginId', { unique: false });
        }
      };
    });
  }
  
  /**
   * Load cached manifests from IndexedDB
   */
  private async loadCachedManifests(): Promise<void> {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['manifests'], 'readonly');
      const store = transaction.objectStore('manifests');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const entries = request.result as Array<{ id: string; data: PluginCacheEntry }>;
        for (const entry of entries) {
          this.cache.set(entry.id, entry.data);
        }
        resolve();
      };
      
      request.onerror = () => {
        console.error('Failed to load cached manifests:', request.error);
        reject(request.error);
      };
    });
  }
  
  /**
   * Load a plugin from a URL
   */
  public async loadFromUrl(manifestUrl: string): Promise<PluginLoadResult> {
    const startTime = performance.now();
    
    try {
      // Validate URL
      const url = new URL(manifestUrl);
      if (!this.isOriginTrusted(url.origin) && !this.sandboxConfig.allowNetworkAccess) {
        return {
          success: false,
          error: `Untrusted origin: ${url.origin}`,
          source: 'url',
          loadTime: performance.now() - startTime
        };
      }
      
      // Fetch manifest
      const manifestResponse = await fetch(manifestUrl);
      if (!manifestResponse.ok) {
        return {
          success: false,
          error: `Failed to fetch manifest: ${manifestResponse.statusText}`,
          source: 'url',
          loadTime: performance.now() - startTime
        };
      }
      
      const manifest = await manifestResponse.json() as WAPManifest;
      
      // Validate manifest
      const validation = this.validateManifest(manifest);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid manifest: ${validation.errors.join(', ')}`,
          source: 'url',
          loadTime: performance.now() - startTime
        };
      }
      
      // Resolve WASM URL relative to manifest
      const wasmUrl = new URL(manifest.wasmUrl, manifestUrl).href;
      
      // Fetch WASM module
      const wasmResponse = await fetch(wasmUrl);
      if (!wasmResponse.ok) {
        return {
          success: false,
          error: `Failed to fetch WASM module: ${wasmResponse.statusText}`,
          source: 'url',
          loadTime: performance.now() - startTime
        };
      }
      
      const wasmBuffer = await wasmResponse.arrayBuffer();
      
      // Validate WASM module
      const wasmValidation = await this.validateWasmModule(wasmBuffer);
      if (!wasmValidation.valid) {
        return {
          success: false,
          error: `Invalid WASM module: ${wasmValidation.errors.join(', ')}`,
          source: 'url',
          loadTime: performance.now() - startTime
        };
      }
      
      // Cache the plugin
      const pluginId = `${manifest.author}/${manifest.name}`;
      const cacheEntry: PluginCacheEntry = {
        manifest,
        wasmBuffer,
        timestamp: Date.now(),
        source: 'url'
      };
      
      this.cache.set(pluginId, cacheEntry);
      await this.saveToDB(pluginId, cacheEntry);
      
      return {
        success: true,
        manifest,
        source: 'url',
        loadTime: performance.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'url',
        loadTime: performance.now() - startTime
      };
    }
  }
  
  /**
   * Load a plugin from local storage (File API)
   */
  public async loadFromFile(file: File): Promise<PluginLoadResult> {
    const startTime = performance.now();
    
    try {
      // Check if it's a .wap file (zip archive) or manifest.json
      if (file.name.endsWith('.wap')) {
        return await this.loadFromWapFile(file, startTime);
      } else if (file.name.endsWith('.json')) {
        return await this.loadFromManifestFile(file, startTime);
      } else {
        return {
          success: false,
          error: 'Unsupported file type. Expected .wap or .json',
          source: 'local',
          loadTime: performance.now() - startTime
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'local',
        loadTime: performance.now() - startTime
      };
    }
  }
  
  /**
   * Load from a .wap file (zip archive containing manifest and WASM)
   */
  private async loadFromWapFile(file: File, startTime: number): Promise<PluginLoadResult> {
    // For now, we'll use a simple approach without zip library
    // In production, you'd use JSZip or similar
    return {
      success: false,
      error: '.wap file support requires JSZip library. Use manifest.json instead.',
      source: 'local',
      loadTime: performance.now() - startTime
    };
  }
  
  /**
   * Load from a manifest.json file
   */
  private async loadFromManifestFile(file: File, startTime: number): Promise<PluginLoadResult> {
    const text = await file.text();
    const manifest = JSON.parse(text) as WAPManifest;
    
    // Validate manifest
    const validation = this.validateManifest(manifest);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid manifest: ${validation.errors.join(', ')}`,
        source: 'local',
        loadTime: performance.now() - startTime
      };
    }
    
    // For local files, WASM must be loaded separately
    return {
      success: true,
      manifest,
      source: 'local',
      loadTime: performance.now() - startTime
    };
  }
  
  /**
   * Load WASM buffer for a manifest
   */
  public async loadWasmBuffer(manifest: WAPManifest, wasmFile?: File): Promise<ArrayBuffer | null> {
    if (wasmFile) {
      return await wasmFile.arrayBuffer();
    }
    
    // Try to load from URL
    try {
      const response = await fetch(manifest.wasmUrl);
      if (response.ok) {
        return await response.arrayBuffer();
      }
    } catch (error) {
      console.error('Failed to load WASM from URL:', error);
    }
    
    // Try to load from cache
    const pluginId = `${manifest.author}/${manifest.name}`;
    const cached = this.cache.get(pluginId);
    if (cached) {
      return cached.wasmBuffer;
    }
    
    return null;
  }
  
  /**
   * Validate a plugin manifest
   */
  public validateManifest(manifest: WAPManifest): PluginValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields
    if (!manifest.name) errors.push('Missing required field: name');
    if (!manifest.version) errors.push('Missing required field: version');
    if (!manifest.author) errors.push('Missing required field: author');
    if (!manifest.type) errors.push('Missing required field: type');
    if (!manifest.wasmUrl) errors.push('Missing required field: wasmUrl');
    
    // Type validation
    const validTypes = ['instrument', 'effect', 'analyzer', 'utility'];
    if (manifest.type && !validTypes.includes(manifest.type)) {
      errors.push(`Invalid type: ${manifest.type}. Must be one of: ${validTypes.join(', ')}`);
    }
    
    // Audio I/O validation
    if (manifest.type === 'instrument' && manifest.audioInputs > 0) {
      warnings.push('Instruments typically have 0 audio inputs');
    }
    
    if (manifest.type === 'effect' && manifest.audioInputs < 1) {
      errors.push('Effects must have at least 1 audio input');
    }
    
    if (manifest.audioOutputs < 1) {
      errors.push('Plugin must have at least 1 audio output');
    }
    
    // Parameter validation
    if (manifest.parameters) {
      for (const param of manifest.parameters) {
        const paramErrors = this.validateParameter(param);
        errors.push(...paramErrors);
      }
    }
    
    // Version format
    if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
      warnings.push('Version should follow semver format (e.g., 1.0.0)');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Validate a parameter descriptor
   */
  private validateParameter(param: WAPParameterDescriptor): string[] {
    const errors: string[] = [];
    
    if (!param.id) errors.push('Parameter missing id');
    if (!param.name) errors.push('Parameter missing name');
    if (param.min === undefined) errors.push(`Parameter ${param.id}: missing min`);
    if (param.max === undefined) errors.push(`Parameter ${param.id}: missing max`);
    if (param.default === undefined) errors.push(`Parameter ${param.id}: missing default`);
    
    if (param.min !== undefined && param.max !== undefined) {
      if (param.min >= param.max) {
        errors.push(`Parameter ${param.id}: min must be less than max`);
      }
      
      if (param.default !== undefined) {
        if (param.default < param.min || param.default > param.max) {
          errors.push(`Parameter ${param.id}: default must be between min and max`);
        }
      }
    }
    
    return errors;
  }
  
  /**
   * Validate a WASM module
   */
  public async validateWasmModule(buffer: ArrayBuffer): Promise<PluginValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Try to compile the module
      const module = await WebAssembly.compile(buffer);
      
      // Check exports
      const exports = WebAssembly.Module.exports(module);
      const exportNames = exports.map(e => e.name);
      
      // Required exports
      const requiredExports = ['init', 'process'];
      for (const required of requiredExports) {
        if (!exportNames.includes(required)) {
          errors.push(`Missing required export: ${required}`);
        }
      }
      
      // Recommended exports
      const recommendedExports = ['dispose', 'setParameter', 'getParameter'];
      for (const recommended of recommendedExports) {
        if (!exportNames.includes(recommended)) {
          warnings.push(`Missing recommended export: ${recommended}`);
        }
      }
      
      // Check memory requirements
      const imports = WebAssembly.Module.imports(module);
      const memoryImport = imports.find(i => i.kind === 'memory');
      if (!memoryImport) {
        warnings.push('Module does not import memory - will use default allocation');
      }
      
    } catch (error) {
      errors.push(`Failed to compile WASM module: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Check if an origin is trusted
   */
  public isOriginTrusted(origin: string): boolean {
    return this.trustedOrigins.has(origin);
  }
  
  /**
   * Add a trusted origin
   */
  public addTrustedOrigin(origin: string): void {
    this.trustedOrigins.add(origin);
  }
  
  /**
   * Remove a trusted origin
   */
  public removeTrustedOrigin(origin: string): void {
    this.trustedOrigins.delete(origin);
  }
  
  /**
   * Get sandbox configuration
   */
  public getSandboxConfig(): PluginSandboxConfig {
    return { ...this.sandboxConfig };
  }
  
  /**
   * Update sandbox configuration
   */
  public setSandboxConfig(config: Partial<PluginSandboxConfig>): void {
    this.sandboxConfig = { ...this.sandboxConfig, ...config };
  }
  
  /**
   * Save plugin to IndexedDB
   */
  private async saveToDB(pluginId: string, entry: PluginCacheEntry): Promise<void> {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['manifests', 'wasm'], 'readwrite');
      
      // Save manifest
      const manifestStore = transaction.objectStore('manifests');
      manifestStore.put({ id: pluginId, data: { ...entry, wasmBuffer: null } });
      
      // Save WASM separately (large binary)
      const wasmStore = transaction.objectStore('wasm');
      wasmStore.put({ id: pluginId, buffer: entry.wasmBuffer });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
  
  /**
   * Load WASM buffer from IndexedDB
   */
  public async loadWasmFromDB(pluginId: string): Promise<ArrayBuffer | null> {
    if (!this.db) return null;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['wasm'], 'readonly');
      const store = transaction.objectStore('wasm');
      const request = store.get(pluginId);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.buffer);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => {
        console.error('Failed to load WASM from DB:', request.error);
        reject(request.error);
      };
    });
  }
  
  /**
   * Delete a plugin from cache and storage
   */
  public async deletePlugin(pluginId: string): Promise<void> {
    this.cache.delete(pluginId);
    
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['manifests', 'wasm', 'presets'], 'readwrite');
      
      transaction.objectStore('manifests').delete(pluginId);
      transaction.objectStore('wasm').delete(pluginId);
      
      // Delete associated presets
      const presetStore = transaction.objectStore('presets');
      const index = presetStore.index('pluginId');
      const request = index.openCursor(IDBKeyRange.only(pluginId));
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
  
  /**
   * Get cached plugin
   */
  public getCached(pluginId: string): PluginCacheEntry | undefined {
    return this.cache.get(pluginId);
  }
  
  /**
   * Get all cached plugins
   */
  public getAllCached(): Map<string, PluginCacheEntry> {
    return new Map(this.cache);
  }
  
  /**
   * Clear all cached plugins
   */
  public async clearCache(): Promise<void> {
    this.cache.clear();
    
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['manifests', 'wasm'], 'readwrite');
      transaction.objectStore('manifests').clear();
      transaction.objectStore('wasm').clear();
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
  
  /**
   * Save a preset for a plugin
   */
  public async savePreset(pluginId: string, preset: WAPPreset): Promise<void> {
    if (!this.db) return;
    
    const presetId = `${pluginId}/${preset.name}`;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['presets'], 'readwrite');
      const store = transaction.objectStore('presets');
      
      store.put({
        id: presetId,
        pluginId,
        preset
      });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
  
  /**
   * Load presets for a plugin
   */
  public async loadPresets(pluginId: string): Promise<WAPPreset[]> {
    if (!this.db) return [];
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['presets'], 'readonly');
      const store = transaction.objectStore('presets');
      const index = store.index('pluginId');
      const request = index.getAll(pluginId);
      
      request.onsuccess = () => {
        const results = request.result as Array<{ preset: WAPPreset }>;
        resolve(results.map(r => r.preset));
      };
      
      request.onerror = () => {
        console.error('Failed to load presets:', request.error);
        reject(request.error);
      };
    });
  }
  
  /**
   * Create parameter mappings for automation
   */
  public createParameterMappings(manifest: WAPManifest): ParameterMapping[] {
    return manifest.parameters.map(param => ({
      pluginParamId: param.id,
      min: param.min,
      max: param.max,
      curve: param.type === 'logarithmic' ? 'logarithmic' : 'linear'
    }));
  }
  
  /**
   * Dispose of the plugin loader
   */
  public dispose(): void {
    this.cache.clear();
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    
    PluginLoader.instance = null;
  }
}

// Export singleton getter
export const getPluginLoader = (): PluginLoader => PluginLoader.getInstance();