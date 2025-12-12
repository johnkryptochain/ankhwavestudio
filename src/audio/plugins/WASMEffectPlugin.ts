// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * WASMEffectPlugin - Base class for WASM-based audio effects
 * Provides LADSPA/LV2-like functionality using WebAssembly
 */

import { BaseEffect, type EffectParameterDescriptor, type EffectPreset } from '../effects/BaseEffect';
import type { WAPManifest, WAPParameterDescriptor } from './PluginHost';

/**
 * WASM Effect configuration
 */
export interface WASMEffectConfig {
  manifest: WAPManifest;
  wasmBuffer?: ArrayBuffer;
  workletUrl?: string;
}

/**
 * WASM Effect state
 */
export interface WASMEffectState {
  initialized: boolean;
  processing: boolean;
  latency: number;
  error?: string;
}

/**
 * WASMEffectPlugin - Base class for WASM-based effects
 * Compatible with existing effect chain, hot-swappable
 */
export class WASMEffectPlugin extends BaseEffect {
  protected manifest: WAPManifest;
  protected wasmModule: WebAssembly.Module | null = null;
  protected wasmInstance: WebAssembly.Instance | null = null;
  protected wasmMemory: WebAssembly.Memory | null = null;
  protected workletNode: AudioWorkletNode | null = null;
  
  // Buffer pointers in WASM memory
  protected inputPtr: number = 0;
  protected outputPtr: number = 0;
  protected bufferSize: number = 128;
  
  // State
  protected wasmState: WASMEffectState = {
    initialized: false,
    processing: false,
    latency: 0
  };
  
  // Worklet processor URL
  private static workletRegistered: boolean = false;
  private static workletUrl: string | null = null;
  
  constructor(
    audioContext: AudioContext,
    id: string,
    config: WASMEffectConfig
  ) {
    super(audioContext, id, config.manifest.name, 'wasm-effect');
    this.manifest = config.manifest;
    
    // Initialize parameters from manifest
    this.initializeFromManifest();
    
    // Load WASM if buffer provided
    if (config.wasmBuffer) {
      this.loadWasm(config.wasmBuffer);
    }
  }
  
  /**
   * Initialize parameters from manifest
   */
  private initializeFromManifest(): void {
    for (const param of this.manifest.parameters) {
      this.params[param.id] = param.default;
    }
    
    // Convert manifest presets to effect presets
    if (this.manifest.presets) {
      for (const preset of this.manifest.presets) {
        this.presets.push({
          name: preset.name,
          params: { ...preset.params }
        });
      }
    }
  }
  
  /**
   * Load WASM module
   */
  public async loadWasm(buffer: ArrayBuffer): Promise<void> {
    try {
      // Compile WASM module
      this.wasmModule = await WebAssembly.compile(buffer);
      
      // Create memory
      this.wasmMemory = new WebAssembly.Memory({
        initial: 256,
        maximum: 512
      });
      
      // Import object
      const importObject = {
        env: {
          memory: this.wasmMemory,
          abort: () => console.error('WASM abort'),
          consoleLog: (value: number) => console.log('WASM:', value),
          sin: Math.sin,
          cos: Math.cos,
          tan: Math.tan,
          exp: Math.exp,
          ln: Math.log,
          log10: Math.log10,
          pow: Math.pow,
          sqrt: Math.sqrt,
          floor: Math.floor,
          ceil: Math.ceil,
          round: Math.round,
          abs: Math.abs,
          min: Math.min,
          max: Math.max,
          tanh: Math.tanh,
          sinh: Math.sinh,
          cosh: Math.cosh,
          atan: Math.atan,
          atan2: Math.atan2,
          asin: Math.asin,
          acos: Math.acos
        }
      };
      
      // Instantiate
      this.wasmInstance = await WebAssembly.instantiate(this.wasmModule, importObject);
      
      // Initialize
      const exports = this.wasmInstance.exports as {
        init?: (sampleRate: number, bufferSize: number) => void;
        malloc?: (size: number) => number;
        getLatency?: () => number;
      };
      
      if (exports.init) {
        exports.init(this.audioContext.sampleRate, this.bufferSize);
      }
      
      // Allocate buffers
      if (exports.malloc) {
        const bufferBytes = this.bufferSize * 2 * 4; // stereo, float32
        this.inputPtr = exports.malloc(bufferBytes);
        this.outputPtr = exports.malloc(bufferBytes);
      }
      
      // Get latency
      if (exports.getLatency) {
        this.wasmState.latency = exports.getLatency();
      }
      
      this.wasmState.initialized = true;
      
      // Set up audio processing
      await this.setupAudioProcessing();
      
    } catch (error) {
      this.wasmState.error = error instanceof Error ? error.message : 'Failed to load WASM';
      console.error('Failed to load WASM effect:', error);
      throw error;
    }
  }
  
  /**
   * Set up audio processing using AudioWorklet
   */
  private async setupAudioProcessing(): Promise<void> {
    // Register worklet if not already done
    if (!WASMEffectPlugin.workletRegistered) {
      await this.registerWorklet();
    }
    
    // Create worklet node
    this.workletNode = new AudioWorkletNode(
      this.audioContext,
      'wasm-effect-processor',
      {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      }
    );
    
    // Send WASM module to worklet
    if (this.wasmModule) {
      // We need to send the compiled module or buffer
      // For now, we'll use ScriptProcessorNode as fallback
      this.setupScriptProcessor();
    }
    
    // Connect to effect chain
    this.inputNode.connect(this.workletNode);
    this.workletNode.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
    
    this.wasmState.processing = true;
  }
  
  /**
   * Register the AudioWorklet processor
   */
  private async registerWorklet(): Promise<void> {
    const processorCode = `
      class WASMEffectProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.wasmExports = null;
          this.inputPtr = 0;
          this.outputPtr = 0;
          this.memory = null;
          
          this.port.onmessage = (event) => {
            this.handleMessage(event.data);
          };
        }
        
        handleMessage(data) {
          if (data.type === 'setParameter' && this.wasmExports?.setParameter) {
            this.wasmExports.setParameter(data.index, data.value);
          }
        }
        
        process(inputs, outputs, parameters) {
          const input = inputs[0];
          const output = outputs[0];
          
          if (!input || !output || input.length === 0) {
            return true;
          }
          
          // If WASM not loaded, pass through
          if (!this.wasmExports) {
            for (let ch = 0; ch < output.length; ch++) {
              if (input[ch]) {
                output[ch].set(input[ch]);
              }
            }
            return true;
          }
          
          // Process with WASM
          // ... WASM processing code ...
          
          return true;
        }
      }
      
      registerProcessor('wasm-effect-processor', WASMEffectProcessor);
    `;
    
    const blob = new Blob([processorCode], { type: 'application/javascript' });
    WASMEffectPlugin.workletUrl = URL.createObjectURL(blob);
    
    await this.audioContext.audioWorklet.addModule(WASMEffectPlugin.workletUrl);
    WASMEffectPlugin.workletRegistered = true;
  }
  
  /**
   * Fallback to ScriptProcessorNode for browsers without AudioWorklet
   */
  private setupScriptProcessor(): void {
    // ScriptProcessorNode is deprecated but provides fallback
    const scriptNode = this.audioContext.createScriptProcessor(this.bufferSize, 2, 2);
    
    scriptNode.onaudioprocess = (event) => {
      if (!this.wasmInstance || !this.wasmMemory) {
        // Pass through
        for (let ch = 0; ch < event.outputBuffer.numberOfChannels; ch++) {
          const input = event.inputBuffer.getChannelData(ch);
          const output = event.outputBuffer.getChannelData(ch);
          output.set(input);
        }
        return;
      }
      
      const exports = this.wasmInstance.exports as {
        process?: (inputPtr: number, outputPtr: number, numSamples: number) => void;
        processBlock?: (inputPtr: number, outputPtr: number, numSamples: number, numChannels: number) => void;
      };
      
      const numSamples = event.inputBuffer.length;
      const numChannels = Math.min(event.inputBuffer.numberOfChannels, 2);
      
      // Copy input to WASM memory
      const inputView = new Float32Array(
        this.wasmMemory.buffer,
        this.inputPtr,
        numSamples * numChannels
      );
      
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = event.inputBuffer.getChannelData(ch);
        for (let i = 0; i < numSamples; i++) {
          inputView[ch * numSamples + i] = channelData[i];
        }
      }
      
      // Process
      if (exports.processBlock) {
        exports.processBlock(this.inputPtr, this.outputPtr, numSamples, numChannels);
      } else if (exports.process) {
        exports.process(this.inputPtr, this.outputPtr, numSamples);
      }
      
      // Copy output from WASM memory
      const outputView = new Float32Array(
        this.wasmMemory.buffer,
        this.outputPtr,
        numSamples * numChannels
      );
      
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = event.outputBuffer.getChannelData(ch);
        for (let i = 0; i < numSamples; i++) {
          channelData[i] = outputView[ch * numSamples + i];
        }
      }
    };
    
    // Connect script processor
    this.inputNode.disconnect();
    this.inputNode.connect(scriptNode);
    scriptNode.connect(this.wetGain);
  }
  
  /**
   * Get parameter descriptors from manifest
   */
  getParameterDescriptors(): EffectParameterDescriptor[] {
    return this.manifest.parameters.map(param => ({
      name: param.name,
      key: param.id,
      min: param.min,
      max: param.max,
      default: param.default,
      step: param.step,
      unit: param.unit,
      type: param.type
    }));
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    if (!this.wasmInstance) return;
    
    const paramIndex = this.manifest.parameters.findIndex(p => p.id === key);
    if (paramIndex === -1) return;
    
    const exports = this.wasmInstance.exports as {
      setParameter?: (index: number, value: number) => void;
    };
    
    if (exports.setParameter) {
      exports.setParameter(paramIndex, value);
    }
    
    // Also send to worklet
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'setParameter',
        index: paramIndex,
        value
      });
    }
  }
  
  /**
   * Initialize effect
   */
  protected initializeEffect(): void {
    // Already initialized in constructor
  }
  
  /**
   * Get WASM state
   */
  public getWasmState(): WASMEffectState {
    return { ...this.wasmState };
  }
  
  /**
   * Get manifest
   */
  public getManifest(): WAPManifest {
    return this.manifest;
  }
  
  /**
   * Hot-swap the WASM module
   */
  public async hotSwap(newBuffer: ArrayBuffer): Promise<void> {
    // Store current parameters
    const currentParams = { ...this.params };
    
    // Dispose current WASM
    this.disposeWasm();
    
    // Load new WASM
    await this.loadWasm(newBuffer);
    
    // Restore parameters
    for (const [key, value] of Object.entries(currentParams)) {
      this.setParameter(key, value);
    }
  }
  
  /**
   * Dispose WASM resources
   */
  private disposeWasm(): void {
    if (this.wasmInstance) {
      const exports = this.wasmInstance.exports as {
        dispose?: () => void;
        free?: (ptr: number) => void;
      };
      
      if (exports.free) {
        if (this.inputPtr) exports.free(this.inputPtr);
        if (this.outputPtr) exports.free(this.outputPtr);
      }
      
      if (exports.dispose) {
        exports.dispose();
      }
    }
    
    this.wasmInstance = null;
    this.wasmModule = null;
    this.wasmMemory = null;
    this.inputPtr = 0;
    this.outputPtr = 0;
    this.wasmState.initialized = false;
    this.wasmState.processing = false;
  }
  
  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.disposeWasm();
    
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    
    super.dispose();
  }
}

/**
 * Create a WASM effect from a manifest
 */
export async function createWASMEffect(
  audioContext: AudioContext,
  manifest: WAPManifest,
  wasmBuffer?: ArrayBuffer
): Promise<WASMEffectPlugin> {
  const id = `wasm-effect-${Date.now()}`;
  const effect = new WASMEffectPlugin(audioContext, id, { manifest, wasmBuffer });
  
  if (wasmBuffer) {
    await effect.loadWasm(wasmBuffer);
  }
  
  return effect;
}