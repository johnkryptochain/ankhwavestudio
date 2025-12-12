// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Bitcrush - Bit depth and sample rate reduction effect
 * 
 * Features:
 * - Bit depth reduction (1-16 bits)
 * - Sample rate reduction
 * - Input/output gain
 * - Wet/dry mix
 * - Optional noise gate
 */

import { BaseEffect, EffectParameterDescriptor, EffectPreset } from './BaseEffect';
import { clamp, dBToLinear } from '../utils/AudioMath';

/**
 * Bitcrush effect using AudioWorklet for sample-accurate processing
 */
export class Bitcrush extends BaseEffect {
  private scriptProcessor: ScriptProcessorNode | null = null;
  private inputGainNode: GainNode;
  private outputGainNode: GainNode;
  
  // Processing state
  private sampleHoldL: number = 0;
  private sampleHoldR: number = 0;
  private sampleCounter: number = 0;
  
  // Noise gate state
  private gateOpenL: boolean = false;
  private gateOpenR: boolean = false;

  constructor(audioContext: AudioContext, id: string, name: string = 'Bitcrush') {
    super(audioContext, id, name, 'bitcrush');
    
    // Create gain nodes
    this.inputGainNode = audioContext.createGain();
    this.outputGainNode = audioContext.createGain();
    
    this.initializeEffect();
    this.setupRouting();
    this.addDefaultPresets();
  }

  protected initializeEffect(): void {
    // Initialize default parameters
    this.params = {
      bitDepth: 8,         // Bit depth (1-16)
      sampleRate: 0.5,     // Sample rate reduction factor (0-1, where 1 = no reduction)
      inputGain: 0,        // Input gain in dB (-24 to 24)
      outputGain: 0,       // Output gain in dB (-24 to 24)
      noiseGate: 0,        // Noise gate threshold (0 = off, 0-1)
      mix: 1,              // Wet/dry mix (0-1)
    };
    
    this.applyGains();
  }

  private setupRouting(): void {
    // Create ScriptProcessorNode for bitcrushing
    // Note: In production, this should use AudioWorklet for better performance
    const bufferSize = 256;
    this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 2, 2);
    
    this.scriptProcessor.onaudioprocess = (event) => {
      this.processAudio(event);
    };
    
    // Routing: input -> inputGain -> scriptProcessor -> outputGain -> wetGain -> output
    this.inputNode.connect(this.inputGainNode);
    this.inputGainNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.outputGainNode);
    this.outputGainNode.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);
  }

  private processAudio(event: AudioProcessingEvent): void {
    const inputL = event.inputBuffer.getChannelData(0);
    const inputR = event.inputBuffer.getChannelData(1);
    const outputL = event.outputBuffer.getChannelData(0);
    const outputR = event.outputBuffer.getChannelData(1);
    
    const bitDepth = Math.round(this.params.bitDepth);
    const levels = Math.pow(2, bitDepth);
    const sampleRateReduction = Math.max(1, Math.round(1 / Math.max(0.01, this.params.sampleRate)));
    const noiseGateThreshold = this.params.noiseGate;
    
    for (let i = 0; i < inputL.length; i++) {
      // Sample rate reduction (sample and hold)
      if (this.sampleCounter >= sampleRateReduction) {
        this.sampleCounter = 0;
        
        // Get input samples
        let sampleL = inputL[i];
        let sampleR = inputR[i];
        
        // Apply noise gate if enabled
        if (noiseGateThreshold > 0) {
          const absL = Math.abs(sampleL);
          const absR = Math.abs(sampleR);
          
          // Simple gate with hysteresis
          if (absL > noiseGateThreshold) {
            this.gateOpenL = true;
          } else if (absL < noiseGateThreshold * 0.5) {
            this.gateOpenL = false;
          }
          
          if (absR > noiseGateThreshold) {
            this.gateOpenR = true;
          } else if (absR < noiseGateThreshold * 0.5) {
            this.gateOpenR = false;
          }
          
          if (!this.gateOpenL) sampleL = 0;
          if (!this.gateOpenR) sampleR = 0;
        }
        
        // Bit depth reduction (quantization)
        // Map from [-1, 1] to [0, levels-1], quantize, then map back
        this.sampleHoldL = Math.round((sampleL + 1) * 0.5 * (levels - 1)) / (levels - 1) * 2 - 1;
        this.sampleHoldR = Math.round((sampleR + 1) * 0.5 * (levels - 1)) / (levels - 1) * 2 - 1;
        
        // Clamp to prevent overflow
        this.sampleHoldL = clamp(this.sampleHoldL, -1, 1);
        this.sampleHoldR = clamp(this.sampleHoldR, -1, 1);
      }
      
      this.sampleCounter++;
      
      // Output the held sample
      outputL[i] = this.sampleHoldL;
      outputR[i] = this.sampleHoldR;
    }
  }

  private applyGains(): void {
    const currentTime = this.audioContext.currentTime;
    
    const inputGainLinear = dBToLinear(this.params.inputGain);
    const outputGainLinear = dBToLinear(this.params.outputGain);
    
    this.inputGainNode.gain.setTargetAtTime(inputGainLinear, currentTime, 0.01);
    this.outputGainNode.gain.setTargetAtTime(outputGainLinear, currentTime, 0.01);
    
    this.setWetDry(this.params.mix);
  }

  getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      {
        name: 'Bit Depth',
        key: 'bitDepth',
        min: 1,
        max: 16,
        default: 8,
        step: 1,
        unit: ' bits',
        type: 'linear',
      },
      {
        name: 'Sample Rate',
        key: 'sampleRate',
        min: 0.01,
        max: 1,
        default: 0.5,
        step: 0.01,
        type: 'logarithmic',
      },
      {
        name: 'Input Gain',
        key: 'inputGain',
        min: -24,
        max: 24,
        default: 0,
        step: 0.5,
        unit: ' dB',
        type: 'linear',
      },
      {
        name: 'Output Gain',
        key: 'outputGain',
        min: -24,
        max: 24,
        default: 0,
        step: 0.5,
        unit: ' dB',
        type: 'linear',
      },
      {
        name: 'Noise Gate',
        key: 'noiseGate',
        min: 0,
        max: 0.5,
        default: 0,
        step: 0.01,
      },
      {
        name: 'Mix',
        key: 'mix',
        min: 0,
        max: 1,
        default: 1,
        step: 0.01,
      },
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    switch (key) {
      case 'inputGain':
      case 'outputGain':
        this.applyGains();
        break;
      case 'mix':
        this.setWetDry(value);
        break;
      // bitDepth, sampleRate, and noiseGate are read directly in processAudio
    }
  }

  /**
   * Get the effective sample rate after reduction
   */
  getEffectiveSampleRate(): number {
    const reduction = Math.max(1, Math.round(1 / Math.max(0.01, this.params.sampleRate)));
    return this.audioContext.sampleRate / reduction;
  }

  /**
   * Get the number of quantization levels
   */
  getQuantizationLevels(): number {
    return Math.pow(2, Math.round(this.params.bitDepth));
  }

  private addDefaultPresets(): void {
    const presets: EffectPreset[] = [
      {
        name: '8-bit Classic',
        params: {
          bitDepth: 8,
          sampleRate: 0.5,
          inputGain: 0,
          outputGain: 0,
          noiseGate: 0,
          mix: 1,
        },
      },
      {
        name: '4-bit Retro',
        params: {
          bitDepth: 4,
          sampleRate: 0.25,
          inputGain: 3,
          outputGain: -3,
          noiseGate: 0,
          mix: 1,
        },
      },
      {
        name: 'Lo-Fi',
        params: {
          bitDepth: 12,
          sampleRate: 0.3,
          inputGain: 0,
          outputGain: 0,
          noiseGate: 0.05,
          mix: 0.7,
        },
      },
      {
        name: 'Telephone',
        params: {
          bitDepth: 8,
          sampleRate: 0.18,
          inputGain: 6,
          outputGain: -6,
          noiseGate: 0.1,
          mix: 1,
        },
      },
      {
        name: 'Extreme Crush',
        params: {
          bitDepth: 2,
          sampleRate: 0.1,
          inputGain: 6,
          outputGain: -12,
          noiseGate: 0,
          mix: 1,
        },
      },
      {
        name: 'Subtle Grit',
        params: {
          bitDepth: 14,
          sampleRate: 0.8,
          inputGain: 0,
          outputGain: 0,
          noiseGate: 0,
          mix: 0.3,
        },
      },
      {
        name: 'Sample Rate Only',
        params: {
          bitDepth: 16,
          sampleRate: 0.2,
          inputGain: 0,
          outputGain: 0,
          noiseGate: 0,
          mix: 1,
        },
      },
      {
        name: 'Bit Depth Only',
        params: {
          bitDepth: 6,
          sampleRate: 1,
          inputGain: 0,
          outputGain: 0,
          noiseGate: 0,
          mix: 1,
        },
      },
    ];

    for (const preset of presets) {
      this.addPreset(preset);
    }
  }

  dispose(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    
    this.inputGainNode.disconnect();
    this.outputGainNode.disconnect();
    
    super.dispose();
  }
}