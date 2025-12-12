// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * PluginHost - WebAssembly-based plugin system for AnkhWaveStudio Web
 * Provides VST/VSTi-like functionality using WebAssembly plugins
 */

import type { EnvelopeParams } from '../../types/audio';

/**
 * Plugin types
 */
export type PluginType = 'instrument' | 'effect' | 'analyzer' | 'utility';

/**
 * Plugin format - Web Audio Plugin (.wap)
 */
export interface WAPManifest {
  name: string;
  version: string;
  author: string;
  description: string;
  type: PluginType;
  category: string;
  tags: string[];
  
  // WASM module info
  wasmUrl: string;
  wasmSize?: number;
  
  // Audio configuration
  audioInputs: number;
  audioOutputs: number;
  sampleRate?: number;
  
  // Parameters
  parameters: WAPParameterDescriptor[];
  
  // MIDI support
  midiInput: boolean;
  midiOutput: boolean;
  
  // UI
  hasCustomUI: boolean;
  uiUrl?: string;
  uiWidth?: number;
  uiHeight?: number;
  
  // Presets
  presets?: WAPPreset[];
  
  // License and metadata
  license?: string;
  homepage?: string;
  repository?: string;
}

/**
 * Plugin parameter descriptor
 */
export interface WAPParameterDescriptor {
  id: string;
  name: string;
  min: number;
  max: number;
  default: number;
  step?: number;
  unit?: string;
  type?: 'linear' | 'logarithmic' | 'boolean' | 'enum';
  enumValues?: string[];
  automatable?: boolean;
}

/**
 * Plugin preset
 */
export interface WAPPreset {
  name: string;
  author?: string;
  params: Record<string, number>;
}

/**
 * Plugin instance state
 */
export interface PluginInstanceState {
  id: string;
  pluginId: string;
  name: string;
  enabled: boolean;
  params: Record<string, number>;
  preset?: string;
}

/**
 * Plugin event types
 */
export interface PluginEvent {
  type: 'loaded' | 'unloaded' | 'paramChange' | 'midiEvent' | 'error' | 'stateChange';
  pluginId: string;
  instanceId?: string;
  data?: unknown;
}

export type PluginEventCallback = (event: PluginEvent) => void;

/**
 * WASM Plugin Instance - represents a loaded plugin
 */
export interface WASMPluginInstance {
  id: string;
  manifest: WAPManifest;
  wasmModule: WebAssembly.Module;
  wasmInstance: WebAssembly.Instance;
  workletNode?: AudioWorkletNode;
  memory: WebAssembly.Memory;
  
  // Function exports from WASM
  exports: {
    // Lifecycle
    init: (sampleRate: number, bufferSize: number) => void;
    dispose: () => void;
    reset: () => void;
    
    // Audio processing
    process: (inputPtr: number, outputPtr: number, numSamples: number) => void;
    processBlock: (inputPtr: number, outputPtr: number, numSamples: number, numChannels: number) => void;
    
    // Parameters
    getParameterCount: () => number;
    getParameter: (index: number) => number;
    setParameter: (index: number, value: number) => void;
    
    // MIDI (for instruments)
    noteOn?: (note: number, velocity: number, channel: number) => void;
    noteOff?: (note: number, channel: number) => void;
    controlChange?: (cc: number, value: number, channel: number) => void;
    pitchBend?: (value: number, channel: number) => void;
    
    // State
    getStateSize?: () => number;
    getState?: (ptr: number) => void;
    setState?: (ptr: number, size: number) => void;
    
    // Memory management
    malloc: (size: number) => number;
    free: (ptr: number) => void;
  };
}

/**
 * Plugin Host - manages loading and running WASM plugins
 */
export class PluginHost {
  private static instance: PluginHost | null = null;
  
  private audioContext: AudioContext | null = null;
  private loadedPlugins: Map<string, WASMPluginInstance> = new Map();
  private pluginManifests: Map<string, WAPManifest> = new Map();
  private eventCallbacks: PluginEventCallback[] = [];
  
  // Worklet processor URL
  private workletProcessorUrl: string | null = null;
  private workletRegistered: boolean = false;
  
  private constructor() {}
  
  /**
   * Get singleton instance
   */
  public static getInstance(): PluginHost {
    if (!PluginHost.instance) {
      PluginHost.instance = new PluginHost();
    }
    return PluginHost.instance;
  }
  
  /**
   * Initialize the plugin host with an audio context
   */
  public async initialize(audioContext: AudioContext): Promise<void> {
    this.audioContext = audioContext;
    
    // Register the WASM plugin worklet processor
    if (!this.workletRegistered) {
      await this.registerWorkletProcessor();
    }
  }
  
  /**
   * Register the AudioWorklet processor for WASM plugins
   */
  private async registerWorkletProcessor(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }
    
    // Create the worklet processor code as a blob
    const processorCode = `
      class WASMPluginProcessor extends AudioWorkletProcessor {
        constructor(options) {
          super();
          
          this.pluginId = options.processorOptions?.pluginId || '';
          this.wasmMemory = null;
          this.inputPtr = 0;
          this.outputPtr = 0;
          this.bufferSize = 128;
          this.numChannels = 2;
          this.initialized = false;
          
          // Handle messages from main thread
          this.port.onmessage = (event) => {
            this.handleMessage(event.data);
          };
        }
        
        handleMessage(data) {
          switch (data.type) {
            case 'init':
              this.initializeWASM(data);
              break;
            case 'setParameter':
              if (this.wasmExports?.setParameter) {
                this.wasmExports.setParameter(data.index, data.value);
              }
              break;
            case 'noteOn':
              if (this.wasmExports?.noteOn) {
                this.wasmExports.noteOn(data.note, data.velocity, data.channel);
              }
              break;
            case 'noteOff':
              if (this.wasmExports?.noteOff) {
                this.wasmExports.noteOff(data.note, data.channel);
              }
              break;
            case 'controlChange':
              if (this.wasmExports?.controlChange) {
                this.wasmExports.controlChange(data.cc, data.value, data.channel);
              }
              break;
            case 'dispose':
              this.dispose();
              break;
          }
        }
        
        async initializeWASM(data) {
          try {
            // Instantiate WASM module from transferred buffer
            const wasmModule = await WebAssembly.compile(data.wasmBuffer);
            
            // Create shared memory
            this.wasmMemory = new WebAssembly.Memory({
              initial: 256,
              maximum: 512,
              shared: true
            });
            
            // Import object for WASM
            const importObject = {
              env: {
                memory: this.wasmMemory,
                abort: () => console.error('WASM abort called'),
                log: (value) => console.log('WASM log:', value),
                sin: Math.sin,
                cos: Math.cos,
                tan: Math.tan,
                exp: Math.exp,
                log: Math.log,
                pow: Math.pow,
                sqrt: Math.sqrt,
                floor: Math.floor,
                ceil: Math.ceil,
                round: Math.round,
                abs: Math.abs,
                min: Math.min,
                max: Math.max
              }
            };
            
            const wasmInstance = await WebAssembly.instantiate(wasmModule, importObject);
            this.wasmExports = wasmInstance.exports;
            
            // Initialize the plugin
            if (this.wasmExports.init) {
              this.wasmExports.init(sampleRate, this.bufferSize);
            }
            
            // Allocate audio buffers in WASM memory
            const bytesPerSample = 4; // float32
            const bufferBytes = this.bufferSize * this.numChannels * bytesPerSample;
            
            if (this.wasmExports.malloc) {
              this.inputPtr = this.wasmExports.malloc(bufferBytes);
              this.outputPtr = this.wasmExports.malloc(bufferBytes);
            }
            
            this.initialized = true;
            this.port.postMessage({ type: 'initialized' });
          } catch (error) {
            this.port.postMessage({ type: 'error', error: error.message });
          }
        }
        
        dispose() {
          if (this.wasmExports) {
            if (this.wasmExports.free) {
              if (this.inputPtr) this.wasmExports.free(this.inputPtr);
              if (this.outputPtr) this.wasmExports.free(this.outputPtr);
            }
            if (this.wasmExports.dispose) {
              this.wasmExports.dispose();
            }
          }
          this.initialized = false;
        }
        
        process(inputs, outputs, parameters) {
          if (!this.initialized || !this.wasmExports) {
            // Pass through or silence
            const output = outputs[0];
            for (let channel = 0; channel < output.length; channel++) {
              output[channel].fill(0);
            }
            return true;
          }
          
          const input = inputs[0];
          const output = outputs[0];
          const numSamples = output[0]?.length || 128;
          
          try {
            // Copy input to WASM memory
            if (input && input.length > 0 && this.wasmMemory) {
              const inputView = new Float32Array(
                this.wasmMemory.buffer,
                this.inputPtr,
                numSamples * this.numChannels
              );
              
              for (let ch = 0; ch < Math.min(input.length, this.numChannels); ch++) {
                for (let i = 0; i < numSamples; i++) {
                  inputView[ch * numSamples + i] = input[ch][i];
                }
              }
            }
            
            // Process audio
            if (this.wasmExports.processBlock) {
              this.wasmExports.processBlock(
                this.inputPtr,
                this.outputPtr,
                numSamples,
                this.numChannels
              );
            } else if (this.wasmExports.process) {
              this.wasmExports.process(this.inputPtr, this.outputPtr, numSamples);
            }
            
            // Copy output from WASM memory
            if (this.wasmMemory) {
              const outputView = new Float32Array(
                this.wasmMemory.buffer,
                this.outputPtr,
                numSamples * this.numChannels
              );
              
              for (let ch = 0; ch < Math.min(output.length, this.numChannels); ch++) {
                for (let i = 0; i < numSamples; i++) {
                  output[ch][i] = outputView[ch * numSamples + i];
                }
              }
            }
          } catch (error) {
            // On error, output silence
            for (let channel = 0; channel < output.length; channel++) {
              output[channel].fill(0);
            }
          }
          
          return true;
        }
      }
      
      registerProcessor('wasm-plugin-processor', WASMPluginProcessor);
    `;
    
    const blob = new Blob([processorCode], { type: 'application/javascript' });
    this.workletProcessorUrl = URL.createObjectURL(blob);
    
    await this.audioContext.audioWorklet.addModule(this.workletProcessorUrl);
    this.workletRegistered = true;
  }
  
  /**
   * Register a plugin manifest
   */
  public registerManifest(manifest: WAPManifest): void {
    const pluginId = `${manifest.author}/${manifest.name}`;
    this.pluginManifests.set(pluginId, manifest);
    this.emitEvent({ type: 'loaded', pluginId, data: manifest });
  }
  
  /**
   * Load a plugin from a manifest URL
   */
  public async loadPluginFromUrl(manifestUrl: string): Promise<WAPManifest> {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      throw new Error(`Failed to load plugin manifest: ${response.statusText}`);
    }
    
    const manifest = await response.json() as WAPManifest;
    this.registerManifest(manifest);
    return manifest;
  }
  
  /**
   * Create a plugin instance
   */
  public async createInstance(
    pluginId: string,
    instanceId?: string
  ): Promise<WASMPluginInstance> {
    if (!this.audioContext) {
      throw new Error('PluginHost not initialized');
    }
    
    const manifest = this.pluginManifests.get(pluginId);
    if (!manifest) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    // Load WASM module
    const wasmResponse = await fetch(manifest.wasmUrl);
    if (!wasmResponse.ok) {
      throw new Error(`Failed to load WASM module: ${wasmResponse.statusText}`);
    }
    
    const wasmBuffer = await wasmResponse.arrayBuffer();
    const wasmModule = await WebAssembly.compile(wasmBuffer);
    
    // Create shared memory for audio processing
    const memory = new WebAssembly.Memory({
      initial: 256,
      maximum: 512
    });
    
    // Import object for WASM instantiation
    const importObject = {
      env: {
        memory,
        abort: () => console.error('WASM abort called'),
        consoleLog: (value: number) => console.log('WASM log:', value),
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        exp: Math.exp,
        ln: Math.log,
        pow: Math.pow,
        sqrt: Math.sqrt,
        floor: Math.floor,
        ceil: Math.ceil,
        round: Math.round,
        abs: Math.abs,
        min: Math.min,
        max: Math.max
      }
    };
    
    const wasmInstance = await WebAssembly.instantiate(wasmModule, importObject);
    
    // Create AudioWorkletNode for real-time processing
    const workletNode = new AudioWorkletNode(
      this.audioContext,
      'wasm-plugin-processor',
      {
        numberOfInputs: manifest.audioInputs,
        numberOfOutputs: manifest.audioOutputs,
        outputChannelCount: [2],
        processorOptions: {
          pluginId
        }
      }
    );
    
    // Send WASM buffer to worklet
    workletNode.port.postMessage({
      type: 'init',
      wasmBuffer
    }, [wasmBuffer.slice(0)]);
    
    // Create instance object
    const id = instanceId || `${pluginId}-${Date.now()}`;
    const instance: WASMPluginInstance = {
      id,
      manifest,
      wasmModule,
      wasmInstance,
      workletNode,
      memory,
      exports: wasmInstance.exports as WASMPluginInstance['exports']
    };
    
    // Initialize the plugin
    if (instance.exports.init) {
      instance.exports.init(this.audioContext.sampleRate, 128);
    }
    
    this.loadedPlugins.set(id, instance);
    
    return instance;
  }
  
  /**
   * Get a plugin instance by ID
   */
  public getInstance(instanceId: string): WASMPluginInstance | undefined {
    return this.loadedPlugins.get(instanceId);
  }
  
  /**
   * Get all loaded plugin instances
   */
  public getInstances(): WASMPluginInstance[] {
    return Array.from(this.loadedPlugins.values());
  }
  
  /**
   * Get all registered plugin manifests
   */
  public getManifests(): WAPManifest[] {
    return Array.from(this.pluginManifests.values());
  }
  
  /**
   * Get manifests by type
   */
  public getManifestsByType(type: PluginType): WAPManifest[] {
    return Array.from(this.pluginManifests.values()).filter(m => m.type === type);
  }
  
  /**
   * Set a parameter on a plugin instance
   */
  public setParameter(instanceId: string, paramId: string, value: number): void {
    const instance = this.loadedPlugins.get(instanceId);
    if (!instance) return;
    
    const paramIndex = instance.manifest.parameters.findIndex(p => p.id === paramId);
    if (paramIndex === -1) return;
    
    // Set parameter in WASM
    if (instance.exports.setParameter) {
      instance.exports.setParameter(paramIndex, value);
    }
    
    // Also send to worklet
    if (instance.workletNode) {
      instance.workletNode.port.postMessage({
        type: 'setParameter',
        index: paramIndex,
        value
      });
    }
    
    this.emitEvent({
      type: 'paramChange',
      pluginId: instance.manifest.name,
      instanceId,
      data: { paramId, value }
    });
  }
  
  /**
   * Get a parameter value from a plugin instance
   */
  public getParameter(instanceId: string, paramId: string): number | undefined {
    const instance = this.loadedPlugins.get(instanceId);
    if (!instance) return undefined;
    
    const paramIndex = instance.manifest.parameters.findIndex(p => p.id === paramId);
    if (paramIndex === -1) return undefined;
    
    if (instance.exports.getParameter) {
      return instance.exports.getParameter(paramIndex);
    }
    
    return undefined;
  }
  
  /**
   * Send MIDI note on to a plugin instance
   */
  public noteOn(instanceId: string, note: number, velocity: number, channel: number = 0): void {
    const instance = this.loadedPlugins.get(instanceId);
    if (!instance || instance.manifest.type !== 'instrument') return;
    
    if (instance.exports.noteOn) {
      instance.exports.noteOn(note, velocity, channel);
    }
    
    if (instance.workletNode) {
      instance.workletNode.port.postMessage({
        type: 'noteOn',
        note,
        velocity,
        channel
      });
    }
  }
  
  /**
   * Send MIDI note off to a plugin instance
   */
  public noteOff(instanceId: string, note: number, channel: number = 0): void {
    const instance = this.loadedPlugins.get(instanceId);
    if (!instance || instance.manifest.type !== 'instrument') return;
    
    if (instance.exports.noteOff) {
      instance.exports.noteOff(note, channel);
    }
    
    if (instance.workletNode) {
      instance.workletNode.port.postMessage({
        type: 'noteOff',
        note,
        channel
      });
    }
  }
  
  /**
   * Send MIDI control change to a plugin instance
   */
  public controlChange(instanceId: string, cc: number, value: number, channel: number = 0): void {
    const instance = this.loadedPlugins.get(instanceId);
    if (!instance) return;
    
    if (instance.exports.controlChange) {
      instance.exports.controlChange(cc, value, channel);
    }
    
    if (instance.workletNode) {
      instance.workletNode.port.postMessage({
        type: 'controlChange',
        cc,
        value,
        channel
      });
    }
  }
  
  /**
   * Dispose of a plugin instance
   */
  public disposeInstance(instanceId: string): void {
    const instance = this.loadedPlugins.get(instanceId);
    if (!instance) return;
    
    // Dispose WASM resources
    if (instance.exports.dispose) {
      instance.exports.dispose();
    }
    
    // Disconnect and dispose worklet
    if (instance.workletNode) {
      instance.workletNode.port.postMessage({ type: 'dispose' });
      instance.workletNode.disconnect();
    }
    
    this.loadedPlugins.delete(instanceId);
    
    this.emitEvent({
      type: 'unloaded',
      pluginId: instance.manifest.name,
      instanceId
    });
  }
  
  /**
   * Register an event callback
   */
  public onEvent(callback: PluginEventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index !== -1) {
        this.eventCallbacks.splice(index, 1);
      }
    };
  }
  
  /**
   * Emit an event
   */
  private emitEvent(event: PluginEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in plugin event callback:', error);
      }
    }
  }
  
  /**
   * Dispose of the plugin host
   */
  public dispose(): void {
    // Dispose all instances
    for (const instanceId of this.loadedPlugins.keys()) {
      this.disposeInstance(instanceId);
    }
    
    // Clean up worklet URL
    if (this.workletProcessorUrl) {
      URL.revokeObjectURL(this.workletProcessorUrl);
    }
    
    this.pluginManifests.clear();
    this.eventCallbacks = [];
    this.audioContext = null;
    this.workletRegistered = false;
    
    PluginHost.instance = null;
  }
}

// Export singleton getter
export const getPluginHost = (): PluginHost => PluginHost.getInstance();