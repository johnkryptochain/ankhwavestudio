// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import { BaseEffect } from './BaseEffect';
import type { EffectParameterDescriptor } from './BaseEffect';

/**
 * ScriptEffect - Allows users to write custom audio processing code for effects
 * This is a "home-made" solution for the lack of VST Effect support.
 */
export class ScriptEffect extends BaseEffect {
  private scriptNode: ScriptProcessorNode | null = null;
  private processFunction: Function | null = null;
  private code: string = '';
  
  // Default code example
  private static readonly DEFAULT_CODE = `
// Available variables:
// input: Float32Array[] (input buffers for each channel)
// output: Float32Array[] (output buffers for each channel)
// time: number (current time in seconds)
// sampleRate: number (audio sample rate)
// params: object (knob values)

// Example: Simple Gain + Distortion
const gain = params.p1 * 2.0; // 0.0 to 2.0
const threshold = params.p2; // 0.0 to 1.0

for (let channel = 0; channel < output.length; channel++) {
  const inputData = input[channel];
  const outputData = output[channel];
  
  for (let i = 0; i < outputData.length; i++) {
    // Apply gain
    let sample = inputData[i] * gain;
    
    // Apply soft clipping if threshold > 0
    if (threshold > 0.01) {
      if (sample > threshold) sample = threshold + (sample - threshold) / (1 + Math.pow(sample - threshold, 2));
      if (sample < -threshold) sample = -threshold + (sample + threshold) / (1 + Math.pow(-sample - threshold, 2));
    }
    
    outputData[i] = sample;
  }
}
`;

  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'Script Effect', 'script');
    
    // Initialize parameters
    this.params = {
      p1: 0.5, // Generic parameter 1
      p2: 0.5, // Generic parameter 2
      p3: 0.5, // Generic parameter 3
      p4: 0.5  // Generic parameter 4
    };
    
    this.code = ScriptEffect.DEFAULT_CODE;
    this.compileCode();
    this.initializeEffect();
  }

  protected initializeEffect() {
    this.initAudio();
  }

  protected onParameterChange(paramId: string, value: number) {
    // Parameters are accessed directly from this.params in the audio thread
    // so we just need to ensure the value is updated
    this.params[paramId] = value;
  }

  private initAudio() {
    // Use ScriptProcessorNode (deprecated but easiest for dynamic JS without build steps)
    // Buffer size 4096 to minimize main thread blocking frequency
    this.scriptNode = this.audioContext.createScriptProcessor(4096, 2, 2);
    
    this.scriptNode.onaudioprocess = (e) => {
      const input = [
        e.inputBuffer.getChannelData(0),
        e.inputBuffer.getChannelData(1)
      ];
      
      const output = [
        e.outputBuffer.getChannelData(0),
        e.outputBuffer.getChannelData(1)
      ];
      
      if (this.processFunction) {
        try {
          this.processFunction(
            input,
            output, 
            this.audioContext.currentTime, 
            this.audioContext.sampleRate,
            this.params
          );
        } catch (err) {
          console.error('Script execution error:', err);
          // Disable to prevent console spam
          this.processFunction = null;
        }
      } else {
        // Passthrough if no script
        for (let channel = 0; channel < output.length; channel++) {
          output[channel].set(input[channel]);
        }
      }
    };
    
    // Connect input -> script -> output
    this.inputNode.connect(this.scriptNode);
    this.scriptNode.connect(this.outputNode);
  }

  public setCode(newCode: string) {
    this.code = newCode;
    this.compileCode();
  }

  public getCode(): string {
    return this.code;
  }

  private compileCode() {
    try {
      // Create a function from the code string
      // We wrap it to provide the variables
      this.processFunction = new Function(
        'input', 'output', 'time', 'sampleRate', 'params',
        this.code
      );
    } catch (err) {
      console.error('Failed to compile script:', err);
      this.processFunction = null;
    }
  }

  public getParameterDescriptors(): EffectParameterDescriptor[] {
    return [
      { key: 'p1', name: 'Param 1', min: 0, max: 1, default: 0.5 },
      { key: 'p2', name: 'Param 2', min: 0, max: 1, default: 0.5 },
      { key: 'p3', name: 'Param 3', min: 0, max: 1, default: 0.5 },
      { key: 'p4', name: 'Param 4', min: 0, max: 1, default: 0.5 }
    ];
  }

  public dispose() {
    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    super.dispose();
  }
}
