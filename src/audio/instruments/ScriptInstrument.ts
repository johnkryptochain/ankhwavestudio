// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import { BaseInstrument } from './BaseInstrument';
import type { InstrumentParameterDescriptor } from './BaseInstrument';

/**
 * ScriptInstrument - Allows users to write custom audio processing code
 * This is a "home-made" solution for the lack of VST support, allowing
 * users to implement their own DSP algorithms in JavaScript.
 */
export class ScriptInstrument extends BaseInstrument {
  private scriptNode: ScriptProcessorNode | null = null;
  private processFunction: Function | null = null;
  private code: string = '';
  
  // Default code example
  private static readonly DEFAULT_CODE = `
// Available variables:
// output: Float32Array[] (output buffers for each channel)
// time: number (current time in seconds)
// sampleRate: number (audio sample rate)
// note: number (current MIDI note, 0 if none)
// velocity: number (current velocity 0-1)
// params: object (knob values)

const freq = note > 0 ? 440 * Math.pow(2, (note - 69) / 12) : 0;
const amp = velocity;

for (let channel = 0; channel < output.length; channel++) {
  const outputData = output[channel];
  for (let i = 0; i < outputData.length; i++) {
    if (freq > 0) {
      // Simple sine wave
      outputData[i] = Math.sin(2 * Math.PI * freq * (time + i / sampleRate)) * amp;
    } else {
      outputData[i] = 0;
    }
  }
}
`;

  constructor(audioContext: AudioContext, id: string, name: string) {
    super(audioContext, id, name, 'script');
    
    // Initialize parameters
    this.params = {
      p1: 0.5,
      p2: 0.5,
      p3: 0.5,
      p4: 0.5
    };
    
    this.code = ScriptInstrument.DEFAULT_CODE;
    this.compileCode();
    this.initAudio();
  }

  private initAudio() {
    // Use ScriptProcessorNode (deprecated but easiest for dynamic JS without build steps)
    // Buffer size 4096 to minimize main thread blocking frequency
    this.scriptNode = this.audioContext.createScriptProcessor(4096, 0, 2);
    
    this.scriptNode.onaudioprocess = (e) => {
      const output = [
        e.outputBuffer.getChannelData(0),
        e.outputBuffer.getChannelData(1)
      ];
      
      if (this.processFunction) {
        try {
          // Get active note info (monophonic for this simple script)
          let currentNote = 0;
          let currentVel = 0;
          
          // Find the most recent active voice
          if (this.activeVoices.size > 0) {
            const voices = Array.from(this.activeVoices.values());
            const lastVoice = voices[voices.length - 1];
            currentNote = lastVoice.noteNumber;
            currentVel = lastVoice.velocity;
          }
          
          this.processFunction(
            output, 
            this.audioContext.currentTime, 
            this.audioContext.sampleRate,
            currentNote,
            currentVel,
            this.params
          );
        } catch (err) {
          console.error('Script execution error:', err);
          // Disable to prevent console spam
          this.processFunction = null;
        }
      }
    };
    
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
      // We wrap it to provide the arguments
      this.processFunction = new Function(
        'output', 'time', 'sampleRate', 'note', 'velocity', 'params',
        this.code
      );
    } catch (err) {
      console.error('Script compilation error:', err);
      this.processFunction = null;
    }
  }

  public getParameterDescriptors(): InstrumentParameterDescriptor[] {
    return [
      { name: 'Param 1', key: 'p1', min: 0, max: 1, default: 0.5, type: 'linear' },
      { name: 'Param 2', key: 'p2', min: 0, max: 1, default: 0.5, type: 'linear' },
      { name: 'Param 3', key: 'p3', min: 0, max: 1, default: 0.5, type: 'linear' },
      { name: 'Param 4', key: 'p4', min: 0, max: 1, default: 0.5, type: 'linear' },
    ];
  }

  public dispose() {
    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    super.dispose();
  }

  // Abstract method implementations
  
  protected initializeInstrument(): void {
    // Already done in constructor/initAudio
  }

  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    // The script processor reads from activeVoices map which is updated by BaseInstrument.noteOn
    // We don't need to do anything specific here unless we want to trigger an envelope
  }

  protected releaseNote(noteNumber: number): void {
    // The script processor reads from activeVoices map which is updated by BaseInstrument.noteOff
  }

  protected onParameterChange(paramKey: string, value: number): void {
    // Parameters are read directly from this.params in the audio loop
  }
}
