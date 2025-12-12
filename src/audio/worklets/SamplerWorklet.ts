// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * SamplerWorklet - AudioWorklet processor for sample playback
 * Provides low-latency sample playback with pitch shifting, looping, and ADSR envelope
 */

/**
 * Sample data structure
 */
interface SampleData {
  id: string;
  buffer: Float32Array[];
  sampleRate: number;
  channels: number;
  length: number;
  rootNote: number;      // MIDI note number for original pitch
  loopStart: number;     // Loop start in samples
  loopEnd: number;       // Loop end in samples
  loopEnabled: boolean;
  loopCrossfade: number; // Crossfade length for smooth looping
}

/**
 * Voice state for polyphonic playback
 */
interface Voice {
  active: boolean;
  sampleId: string;
  noteNumber: number;
  position: number;
  velocity: number;
  pitchRatio: number;
  
  // Envelope state
  envelopePhase: 'idle' | 'attack' | 'decay' | 'sustain' | 'release';
  envelopeValue: number;
  envelopeTime: number;
  releaseStartValue: number;
  
  // Loop state
  loopCount: number;
  
  // Filter state (per-voice filter)
  filterZ1L: number;
  filterZ1R: number;
}

/**
 * Interpolation modes
 */
const INTERP_NONE = 0;
const INTERP_LINEAR = 1;
const INTERP_CUBIC = 2;
const INTERP_SINC = 3;

/**
 * SamplerProcessor - AudioWorkletProcessor for sample playback
 */
class SamplerProcessor extends AudioWorkletProcessor {
  private samples: Map<string, SampleData> = new Map();
  private voices: Voice[] = [];
  private maxVoices: number = 32;
  
  // Envelope parameters (in seconds)
  private attack: number = 0.001;
  private decay: number = 0.1;
  private sustain: number = 1.0;
  private release: number = 0.1;
  
  // Playback settings
  private interpolation: number = INTERP_LINEAR;
  private oneShot: boolean = false; // If true, ignore note off
  
  // Filter settings (simple lowpass for velocity-based brightness)
  private filterEnabled: boolean = false;
  private filterCutoff: number = 1.0; // 0-1, normalized

  static get parameterDescriptors() {
    return [
      { name: 'volume', defaultValue: 1.0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'pitch', defaultValue: 0, minValue: -48, maxValue: 48, automationRate: 'k-rate' },
      { name: 'pan', defaultValue: 0, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
      { name: 'filterCutoff', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    
    // Initialize voice pool
    for (let i = 0; i < this.maxVoices; i++) {
      this.voices.push(this.createVoice());
    }
    
    // Handle messages from main thread
    this.port.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data);
    };
  }

  private createVoice(): Voice {
    return {
      active: false,
      sampleId: '',
      noteNumber: 60,
      position: 0,
      velocity: 1,
      pitchRatio: 1,
      envelopePhase: 'idle',
      envelopeValue: 0,
      envelopeTime: 0,
      releaseStartValue: 0,
      loopCount: 0,
      filterZ1L: 0,
      filterZ1R: 0
    };
  }

  private handleMessage(data: { type: string; [key: string]: unknown }): void {
    switch (data.type) {
      case 'loadSample':
        this.loadSample(
          data.id as string,
          data.buffer as Float32Array[],
          data.sampleRate as number,
          data.rootNote as number | undefined,
          data.loopStart as number | undefined,
          data.loopEnd as number | undefined,
          data.loopEnabled as boolean | undefined
        );
        break;
        
      case 'unloadSample':
        this.samples.delete(data.id as string);
        break;
        
      case 'noteOn':
        this.noteOn(
          data.sampleId as string,
          data.noteNumber as number,
          data.velocity as number
        );
        break;
        
      case 'noteOff':
        this.noteOff(data.noteNumber as number);
        break;
        
      case 'stopAll':
        this.stopAll();
        break;
        
      case 'setEnvelope':
        this.attack = (data.attack as number) ?? this.attack;
        this.decay = (data.decay as number) ?? this.decay;
        this.sustain = (data.sustain as number) ?? this.sustain;
        this.release = (data.release as number) ?? this.release;
        break;
        
      case 'setLoop':
        this.setLoopPoints(
          data.sampleId as string,
          data.loopStart as number,
          data.loopEnd as number,
          data.loopEnabled as boolean,
          data.loopCrossfade as number | undefined
        );
        break;
        
      case 'setInterpolation':
        this.interpolation = data.mode as number;
        break;
        
      case 'setOneShot':
        this.oneShot = data.enabled as boolean;
        break;
        
      case 'setFilter':
        this.filterEnabled = data.enabled as boolean;
        this.filterCutoff = data.cutoff as number ?? this.filterCutoff;
        break;
    }
  }

  private loadSample(
    id: string,
    buffer: Float32Array[],
    sampleRate: number,
    rootNote: number = 60,
    loopStart: number = 0,
    loopEnd?: number,
    loopEnabled: boolean = false
  ): void {
    const length = buffer[0]?.length || 0;
    this.samples.set(id, {
      id,
      buffer,
      sampleRate,
      channels: buffer.length,
      length,
      rootNote,
      loopStart,
      loopEnd: loopEnd ?? length,
      loopEnabled,
      loopCrossfade: 64 // Default crossfade samples
    });
  }

  private setLoopPoints(
    sampleId: string,
    loopStart: number,
    loopEnd: number,
    loopEnabled: boolean,
    loopCrossfade?: number
  ): void {
    const sample = this.samples.get(sampleId);
    if (sample) {
      sample.loopStart = loopStart;
      sample.loopEnd = loopEnd;
      sample.loopEnabled = loopEnabled;
      if (loopCrossfade !== undefined) {
        sample.loopCrossfade = loopCrossfade;
      }
    }
  }

  private noteOn(sampleId: string, noteNumber: number, velocity: number = 1): void {
    const sample = this.samples.get(sampleId);
    if (!sample) return;
    
    // Find a free voice or steal the oldest one
    let voice = this.voices.find(v => !v.active);
    if (!voice) {
      // Steal oldest voice in release phase, or oldest overall
      voice = this.voices.find(v => v.envelopePhase === 'release') ||
              this.voices.reduce((oldest, v) => v.envelopeTime > oldest.envelopeTime ? v : oldest);
    }
    
    // Calculate pitch ratio based on note difference from root
    const semitones = noteNumber - sample.rootNote;
    const pitchRatio = Math.pow(2, semitones / 12) * (sample.sampleRate / 44100);
    
    voice.active = true;
    voice.sampleId = sampleId;
    voice.noteNumber = noteNumber;
    voice.position = 0;
    voice.velocity = velocity;
    voice.pitchRatio = pitchRatio;
    voice.envelopePhase = 'attack';
    voice.envelopeTime = 0;
    voice.envelopeValue = 0;
    voice.loopCount = 0;
    voice.filterZ1L = 0;
    voice.filterZ1R = 0;
  }

  private noteOff(noteNumber: number): void {
    if (this.oneShot) return; // Ignore note off in one-shot mode
    
    for (const voice of this.voices) {
      if (voice.active && voice.noteNumber === noteNumber && voice.envelopePhase !== 'release') {
        voice.envelopePhase = 'release';
        voice.envelopeTime = 0;
        voice.releaseStartValue = voice.envelopeValue;
      }
    }
  }

  private stopAll(): void {
    for (const voice of this.voices) {
      voice.active = false;
      voice.envelopePhase = 'idle';
      voice.envelopeValue = 0;
    }
  }

  private updateEnvelope(voice: Voice, deltaTime: number): number {
    voice.envelopeTime += deltaTime;
    
    switch (voice.envelopePhase) {
      case 'attack':
        voice.envelopeValue = Math.min(1, voice.envelopeTime / this.attack);
        if (voice.envelopeValue >= 1) {
          voice.envelopePhase = 'decay';
          voice.envelopeTime = 0;
        }
        break;
        
      case 'decay':
        voice.envelopeValue = 1 - (1 - this.sustain) * Math.min(1, voice.envelopeTime / this.decay);
        if (voice.envelopeTime >= this.decay) {
          voice.envelopePhase = 'sustain';
        }
        break;
        
      case 'sustain':
        voice.envelopeValue = this.sustain;
        break;
        
      case 'release':
        voice.envelopeValue = voice.releaseStartValue * (1 - Math.min(1, voice.envelopeTime / this.release));
        if (voice.envelopeTime >= this.release || voice.envelopeValue <= 0.0001) {
          voice.envelopePhase = 'idle';
          voice.active = false;
          voice.envelopeValue = 0;
        }
        break;
        
      case 'idle':
      default:
        voice.envelopeValue = 0;
        break;
    }
    
    return Math.max(0, Math.min(1, voice.envelopeValue));
  }

  /**
   * Linear interpolation
   */
  private linearInterpolate(buffer: Float32Array, position: number): number {
    const index = Math.floor(position);
    const frac = position - index;
    const s1 = buffer[index] || 0;
    const s2 = buffer[index + 1] || 0;
    return s1 + frac * (s2 - s1);
  }

  /**
   * Cubic interpolation for higher quality
   */
  private cubicInterpolate(buffer: Float32Array, position: number): number {
    const index = Math.floor(position);
    const frac = position - index;
    
    const y0 = buffer[index - 1] || buffer[index] || 0;
    const y1 = buffer[index] || 0;
    const y2 = buffer[index + 1] || 0;
    const y3 = buffer[index + 2] || buffer[index + 1] || 0;
    
    const c0 = y1;
    const c1 = 0.5 * (y2 - y0);
    const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
    const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    
    return ((c3 * frac + c2) * frac + c1) * frac + c0;
  }

  /**
   * Get sample value with interpolation
   */
  private getSampleValue(buffer: Float32Array, position: number): number {
    switch (this.interpolation) {
      case INTERP_NONE:
        return buffer[Math.floor(position)] || 0;
      case INTERP_CUBIC:
        return this.cubicInterpolate(buffer, position);
      case INTERP_LINEAR:
      default:
        return this.linearInterpolate(buffer, position);
    }
  }

  /**
   * Simple one-pole lowpass filter
   */
  private applyFilter(sample: number, z1: number, cutoff: number): [number, number] {
    const fc = Math.min(0.99, cutoff);
    const b1 = Math.exp(-2 * Math.PI * fc);
    const a0 = 1 - b1;
    const output = sample * a0 + z1 * b1;
    return [output, output];
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    
    const volume = parameters.volume[0];
    const globalPitch = parameters.pitch[0];
    const pan = parameters.pan[0];
    const filterCutoff = parameters.filterCutoff[0];
    
    const outputL = output[0];
    const outputR = output.length > 1 ? output[1] : output[0];
    
    // Clear output
    outputL.fill(0);
    if (outputR !== outputL) outputR.fill(0);
    
    const sampleRate = 44100; // Should get from context
    const deltaTime = 1 / sampleRate;
    
    // Calculate pan gains
    const panAngle = pan * Math.PI * 0.25;
    const panL = Math.cos(panAngle + Math.PI * 0.25);
    const panR = Math.sin(panAngle + Math.PI * 0.25);
    
    // Process each active voice
    for (const voice of this.voices) {
      if (!voice.active) continue;
      
      const sample = this.samples.get(voice.sampleId);
      if (!sample) {
        voice.active = false;
        continue;
      }
      
      // Calculate pitch ratio with global pitch offset
      const pitchRatio = voice.pitchRatio * Math.pow(2, globalPitch / 12);
      
      for (let i = 0; i < outputL.length; i++) {
        // Update envelope
        const envelope = this.updateEnvelope(voice, deltaTime);
        if (!voice.active) break;
        
        // Get sample position
        const pos = voice.position;
        
        // Check for end of sample or loop
        if (pos >= sample.length - 1) {
          if (sample.loopEnabled && sample.loopEnd > sample.loopStart) {
            // Loop back with crossfade
            const loopLength = sample.loopEnd - sample.loopStart;
            voice.position = sample.loopStart + ((pos - sample.loopEnd) % loopLength);
            voice.loopCount++;
          } else {
            // End of sample
            voice.active = false;
            voice.envelopePhase = 'idle';
            break;
          }
        }
        
        // Handle loop point with crossfade
        let valueL: number;
        let valueR: number;
        
        if (sample.loopEnabled && pos >= sample.loopEnd - sample.loopCrossfade && pos < sample.loopEnd) {
          // Crossfade region
          const fadePos = (pos - (sample.loopEnd - sample.loopCrossfade)) / sample.loopCrossfade;
          const loopPos = sample.loopStart + (pos - (sample.loopEnd - sample.loopCrossfade));
          
          const mainL = this.getSampleValue(sample.buffer[0], pos);
          const loopL = this.getSampleValue(sample.buffer[0], loopPos);
          valueL = mainL * (1 - fadePos) + loopL * fadePos;
          
          if (sample.channels > 1) {
            const mainR = this.getSampleValue(sample.buffer[1], pos);
            const loopR = this.getSampleValue(sample.buffer[1], loopPos);
            valueR = mainR * (1 - fadePos) + loopR * fadePos;
          } else {
            valueR = valueL;
          }
        } else {
          // Normal playback
          valueL = this.getSampleValue(sample.buffer[0], pos);
          valueR = sample.channels > 1 
            ? this.getSampleValue(sample.buffer[1], pos) 
            : valueL;
        }
        
        // Apply velocity-based filter
        if (this.filterEnabled) {
          const velocityCutoff = filterCutoff * (0.3 + voice.velocity * 0.7);
          [valueL, voice.filterZ1L] = this.applyFilter(valueL, voice.filterZ1L, velocityCutoff);
          [valueR, voice.filterZ1R] = this.applyFilter(valueR, voice.filterZ1R, velocityCutoff);
        }
        
        // Apply envelope, velocity, and volume
        const gain = envelope * voice.velocity * volume;
        outputL[i] += valueL * gain * panL;
        outputR[i] += valueR * gain * panR;
        
        // Advance position
        voice.position += pitchRatio;
        
        // Handle looping during playback
        if (sample.loopEnabled && voice.position >= sample.loopEnd) {
          voice.position = sample.loopStart + (voice.position - sample.loopEnd);
          voice.loopCount++;
        }
      }
    }
    
    return true;
  }
}

// Register the processor
registerProcessor('sampler-processor', SamplerProcessor);

export { SamplerProcessor };