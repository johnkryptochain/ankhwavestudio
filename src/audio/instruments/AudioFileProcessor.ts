// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * AudioFileProcessor - Sample player instrument
 * Based on original AnkhWaveStudio AudioFileProcessor
 * 
 * Features:
 * - Load audio files (WAV, MP3, OGG, FLAC)
 * - Amplitude envelope (ADSR)
 * - Loop modes (off, forward, ping-pong)
 * - Loop start/end points
 * - Reverse playback
 * - Interpolation modes
 * - Stutter effect
 * - Start/end trim
 */

import { BaseInstrument, InstrumentParameterDescriptor } from './BaseInstrument';

// Loop modes
export enum LoopMode {
  Off = 0,
  Forward = 1,
  PingPong = 2,
}

// Interpolation modes
export enum InterpolationMode {
  None = 0,
  Linear = 1,
  Cubic = 2,
}

// Voice for polyphony
interface AFPVoice {
  noteNumber: number;
  velocity: number;
  frequency: number;
  baseFrequency: number;
  
  // Playback state
  position: number;
  direction: 1 | -1;
  
  // Envelope state
  envStage: 'attack' | 'decay' | 'sustain' | 'release' | 'off';
  envValue: number;
  envTime: number;
  
  // Note state
  released: boolean;
}

/**
 * AudioFileProcessor - Sample player instrument
 */
export class AudioFileProcessor extends BaseInstrument {
  private voices: Map<number, AFPVoice> = new Map();
  private processor: ScriptProcessorNode | null = null;
  private sampleRate: number = 44100;
  
  // Sample data
  private sampleBuffer: AudioBuffer | null = null;
  private sampleData: Float32Array | null = null;
  private sampleDataR: Float32Array | null = null; // Right channel for stereo
  private sampleLength: number = 0;
  private sampleSampleRate: number = 44100;
  private baseNote: number = 60; // Middle C
  
  // File info
  private fileName: string = '';
  private fileDuration: number = 0;
  
  constructor(audioContext: AudioContext, id: string = 'afp') {
    super(audioContext, id, 'AudioFileProcessor', 'sampler');
    this.sampleRate = audioContext.sampleRate;
    this.initializeInstrument();
  }
  
  protected initializeInstrument(): void {
    // Initialize default parameters
    this.params = {
      // Amplitude envelope
      attack: 0,
      decay: 0,
      sustain: 100,
      release: 0,
      
      // Loop settings
      loopMode: LoopMode.Off,
      loopStart: 0,
      loopEnd: 100,
      
      // Playback settings
      reverse: 0,
      startPoint: 0,
      endPoint: 100,
      
      // Interpolation
      interpolation: InterpolationMode.Linear,
      
      // Stutter
      stutterEnabled: 0,
      stutterSpeed: 50,
      
      // Tuning
      baseNote: 60,
      tune: 0,
      
      // Amplitude
      amplitude: 100,
    };
    
    // Create script processor for synthesis
    const bufferSize = 2048;
    this.processor = this.audioContext.createScriptProcessor(bufferSize, 0, 2);
    this.processor.onaudioprocess = this.processAudio.bind(this);
    
    // Connect to volume node
    this.processor.connect(this.volumeNode);
    
    // Load default presets
    this.loadDefaultPresets();
  }
  
  private loadDefaultPresets(): void {
    this.presets = [
      {
        name: 'Default',
        params: { ...this.params }
      },
      {
        name: 'Pad (Long Attack)',
        params: {
          attack: 500,
          decay: 200,
          sustain: 80,
          release: 1000,
          loopMode: LoopMode.Forward,
        }
      },
      {
        name: 'Pluck',
        params: {
          attack: 0,
          decay: 300,
          sustain: 0,
          release: 100,
          loopMode: LoopMode.Off,
        }
      },
      {
        name: 'Loop Forward',
        params: {
          loopMode: LoopMode.Forward,
          loopStart: 10,
          loopEnd: 90,
        }
      },
      {
        name: 'Loop Ping-Pong',
        params: {
          loopMode: LoopMode.PingPong,
          loopStart: 10,
          loopEnd: 90,
        }
      },
      {
        name: 'Reverse',
        params: {
          reverse: 1,
        }
      },
      {
        name: 'Stutter',
        params: {
          stutterEnabled: 1,
          stutterSpeed: 75,
        }
      },
    ];
  }
  
  private processAudio(event: AudioProcessingEvent): void {
    const outputL = event.outputBuffer.getChannelData(0);
    const outputR = event.outputBuffer.getChannelData(1);
    const bufferSize = outputL.length;
    
    // Clear buffers
    outputL.fill(0);
    outputR.fill(0);
    
    if (this.voices.size === 0 || !this.sampleData) return;
    
    const amplitude = this.params.amplitude / 100;
    const startPoint = (this.params.startPoint / 100) * this.sampleLength;
    const endPoint = (this.params.endPoint / 100) * this.sampleLength;
    const loopStart = startPoint + ((this.params.loopStart / 100) * (endPoint - startPoint));
    const loopEnd = startPoint + ((this.params.loopEnd / 100) * (endPoint - startPoint));
    const loopMode = this.params.loopMode;
    const reverse = this.params.reverse > 0.5;
    const interpolation = this.params.interpolation;
    const stutterEnabled = this.params.stutterEnabled > 0.5;
    const stutterSpeed = this.params.stutterSpeed / 100;
    
    // Process each voice
    const voicesToRemove: number[] = [];
    
    for (const [note, voice] of this.voices) {
      const velocityGain = voice.velocity;
      const pitchRatio = voice.frequency / voice.baseFrequency;
      const playbackRate = pitchRatio * (this.sampleSampleRate / this.sampleRate);
      
      for (let i = 0; i < bufferSize; i++) {
        // Update envelope
        this.updateEnvelope(voice);
        
        // Check if voice is done
        if (voice.envStage === 'off') {
          voicesToRemove.push(note);
          break;
        }
        
        // Calculate sample position
        let pos = voice.position;
        
        // Stutter effect
        if (stutterEnabled) {
          const stutterPeriod = (1 - stutterSpeed) * 0.5 * this.sampleRate;
          if (stutterPeriod > 0) {
            pos = startPoint + ((pos - startPoint) % stutterPeriod);
          }
        }
        
        // Read sample with interpolation
        let sampleL = 0;
        let sampleR = 0;
        
        if (pos >= 0 && pos < this.sampleLength) {
          switch (interpolation) {
            case InterpolationMode.None:
              sampleL = this.sampleData[Math.floor(pos)];
              sampleR = this.sampleDataR ? this.sampleDataR[Math.floor(pos)] : sampleL;
              break;
              
            case InterpolationMode.Linear:
              sampleL = this.linearInterpolate(this.sampleData, pos);
              sampleR = this.sampleDataR ? this.linearInterpolate(this.sampleDataR, pos) : sampleL;
              break;
              
            case InterpolationMode.Cubic:
              sampleL = this.cubicInterpolate(this.sampleData, pos);
              sampleR = this.sampleDataR ? this.cubicInterpolate(this.sampleDataR, pos) : sampleL;
              break;
          }
        }
        
        // Apply envelope and velocity
        const envGain = voice.envValue * velocityGain * amplitude;
        outputL[i] += sampleL * envGain;
        outputR[i] += sampleR * envGain;
        
        // Update position
        const direction = reverse ? -voice.direction : voice.direction;
        voice.position += direction * playbackRate;
        
        // Handle loop/end
        if (loopMode === LoopMode.Off) {
          // No loop - check if we've reached the end
          if (reverse) {
            if (voice.position < startPoint) {
              voice.released = true;
              voice.envStage = 'release';
              voice.envTime = 0;
            }
          } else {
            if (voice.position >= endPoint) {
              voice.released = true;
              voice.envStage = 'release';
              voice.envTime = 0;
            }
          }
        } else if (loopMode === LoopMode.Forward) {
          // Forward loop
          if (voice.position >= loopEnd) {
            voice.position = loopStart + (voice.position - loopEnd);
          } else if (voice.position < loopStart && voice.direction === -1) {
            voice.position = loopEnd - (loopStart - voice.position);
          }
        } else if (loopMode === LoopMode.PingPong) {
          // Ping-pong loop
          if (voice.position >= loopEnd) {
            voice.position = loopEnd - (voice.position - loopEnd);
            voice.direction = -1;
          } else if (voice.position < loopStart) {
            voice.position = loopStart + (loopStart - voice.position);
            voice.direction = 1;
          }
        }
      }
    }
    
    // Remove finished voices
    for (const note of voicesToRemove) {
      this.voices.delete(note);
    }
  }
  
  private linearInterpolate(data: Float32Array, pos: number): number {
    const index = Math.floor(pos);
    const frac = pos - index;
    
    if (index < 0 || index >= data.length - 1) return 0;
    
    return data[index] + (data[index + 1] - data[index]) * frac;
  }
  
  private cubicInterpolate(data: Float32Array, pos: number): number {
    const index = Math.floor(pos);
    const frac = pos - index;
    
    if (index < 1 || index >= data.length - 2) {
      return this.linearInterpolate(data, pos);
    }
    
    const y0 = data[index - 1];
    const y1 = data[index];
    const y2 = data[index + 1];
    const y3 = data[index + 2];
    
    const a0 = y3 - y2 - y0 + y1;
    const a1 = y0 - y1 - a0;
    const a2 = y2 - y0;
    const a3 = y1;
    
    return a0 * frac * frac * frac + a1 * frac * frac + a2 * frac + a3;
  }
  
  private updateEnvelope(voice: AFPVoice): void {
    const attack = this.params.attack;
    const decay = this.params.decay;
    const sustain = this.params.sustain / 100;
    const release = this.params.release;
    
    const timeIncrement = 1000 / this.sampleRate; // ms per sample
    
    switch (voice.envStage) {
      case 'attack':
        voice.envTime += timeIncrement;
        if (attack <= 0) {
          voice.envValue = 1;
          voice.envStage = 'decay';
          voice.envTime = 0;
        } else {
          voice.envValue = Math.min(1, voice.envTime / attack);
          if (voice.envValue >= 1) {
            voice.envStage = 'decay';
            voice.envTime = 0;
          }
        }
        break;
        
      case 'decay':
        voice.envTime += timeIncrement;
        if (decay <= 0) {
          voice.envValue = sustain;
          voice.envStage = 'sustain';
        } else {
          voice.envValue = 1 - (1 - sustain) * Math.min(1, voice.envTime / decay);
          if (voice.envTime >= decay) {
            voice.envStage = 'sustain';
          }
        }
        break;
        
      case 'sustain':
        voice.envValue = sustain;
        if (voice.released) {
          voice.envStage = 'release';
          voice.envTime = 0;
        }
        break;
        
      case 'release':
        voice.envTime += timeIncrement;
        if (release <= 0) {
          voice.envValue = 0;
          voice.envStage = 'off';
        } else {
          const startValue = sustain;
          voice.envValue = startValue * (1 - Math.min(1, voice.envTime / release));
          if (voice.envTime >= release) {
            voice.envStage = 'off';
            voice.envValue = 0;
          }
        }
        break;
        
      case 'off':
        voice.envValue = 0;
        break;
    }
  }
  
  // BaseInstrument abstract method implementations
  
  protected silenceNote(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
    if (voice) {
      voice.envStage = 'off';
      voice.envValue = 0;
    }
  }

  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    if (!this.sampleData) return;
    
    const baseNote = this.params.baseNote;
    const tune = this.params.tune;
    const baseFrequency = 440 * Math.pow(2, (baseNote - 69 + tune / 100) / 12);
    
    const reverse = this.params.reverse > 0.5;
    const startPoint = (this.params.startPoint / 100) * this.sampleLength;
    const endPoint = (this.params.endPoint / 100) * this.sampleLength;
    
    const voice: AFPVoice = {
      noteNumber,
      velocity,
      frequency,
      baseFrequency,
      position: reverse ? endPoint - 1 : startPoint,
      direction: 1,
      envStage: 'attack',
      envValue: 0,
      envTime: 0,
      released: false,
    };
    
    this.voices.set(noteNumber, voice);
  }
  
  protected releaseNote(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
    if (voice) {
      voice.released = true;
    }
  }
  
  protected onParameterChange(key: string, value: number): void {
    if (key === 'baseNote') {
      this.baseNote = value;
    }
  }
  
  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    return [
      // Envelope
      { name: 'Attack', key: 'attack', min: 0, max: 5000, default: 0, unit: 'ms', category: 'Envelope' },
      { name: 'Decay', key: 'decay', min: 0, max: 5000, default: 0, unit: 'ms', category: 'Envelope' },
      { name: 'Sustain', key: 'sustain', min: 0, max: 100, default: 100, unit: '%', category: 'Envelope' },
      { name: 'Release', key: 'release', min: 0, max: 5000, default: 0, unit: 'ms', category: 'Envelope' },
      
      // Loop
      { name: 'Loop Mode', key: 'loopMode', min: 0, max: 2, default: 0, step: 1, type: 'enum', enumValues: ['Off', 'Forward', 'Ping-Pong'], category: 'Loop' },
      { name: 'Loop Start', key: 'loopStart', min: 0, max: 100, default: 0, unit: '%', category: 'Loop' },
      { name: 'Loop End', key: 'loopEnd', min: 0, max: 100, default: 100, unit: '%', category: 'Loop' },
      
      // Playback
      { name: 'Reverse', key: 'reverse', min: 0, max: 1, default: 0, step: 1, type: 'boolean', category: 'Playback' },
      { name: 'Start Point', key: 'startPoint', min: 0, max: 100, default: 0, unit: '%', category: 'Playback' },
      { name: 'End Point', key: 'endPoint', min: 0, max: 100, default: 100, unit: '%', category: 'Playback' },
      
      // Interpolation
      { name: 'Interpolation', key: 'interpolation', min: 0, max: 2, default: 1, step: 1, type: 'enum', enumValues: ['None', 'Linear', 'Cubic'], category: 'Quality' },
      
      // Stutter
      { name: 'Stutter', key: 'stutterEnabled', min: 0, max: 1, default: 0, step: 1, type: 'boolean', category: 'Effects' },
      { name: 'Stutter Speed', key: 'stutterSpeed', min: 0, max: 100, default: 50, unit: '%', category: 'Effects' },
      
      // Tuning
      { name: 'Base Note', key: 'baseNote', min: 0, max: 127, default: 60, category: 'Tuning' },
      { name: 'Fine Tune', key: 'tune', min: -100, max: 100, default: 0, unit: 'cents', category: 'Tuning' },
      
      // Amplitude
      { name: 'Amplitude', key: 'amplitude', min: 0, max: 200, default: 100, unit: '%', category: 'Output' },
    ];
  }
  
  /**
   * Load an audio file
   */
  async loadFile(file: File): Promise<boolean> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.sampleBuffer = audioBuffer;
      this.sampleData = audioBuffer.getChannelData(0);
      this.sampleDataR = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;
      this.sampleLength = audioBuffer.length;
      this.sampleSampleRate = audioBuffer.sampleRate;
      this.fileName = file.name;
      this.fileDuration = audioBuffer.duration;
      
      return true;
    } catch (error) {
      console.error('Failed to load audio file:', error);
      return false;
    }
  }
  
  /**
   * Load audio from URL
   */
  async loadUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.sampleBuffer = audioBuffer;
      this.sampleData = audioBuffer.getChannelData(0);
      this.sampleDataR = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;
      this.sampleLength = audioBuffer.length;
      this.sampleSampleRate = audioBuffer.sampleRate;
      this.fileName = url.split('/').pop() || 'sample';
      this.fileDuration = audioBuffer.duration;
      
      return true;
    } catch (error) {
      console.error('Failed to load audio from URL:', error);
      return false;
    }
  }
  
  /**
   * Load audio from ArrayBuffer
   */
  async loadArrayBuffer(buffer: ArrayBuffer, name: string = 'sample'): Promise<boolean> {
    try {
      const audioBuffer = await this.audioContext.decodeAudioData(buffer);
      
      this.sampleBuffer = audioBuffer;
      this.sampleData = audioBuffer.getChannelData(0);
      this.sampleDataR = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;
      this.sampleLength = audioBuffer.length;
      this.sampleSampleRate = audioBuffer.sampleRate;
      this.fileName = name;
      this.fileDuration = audioBuffer.duration;
      
      return true;
    } catch (error) {
      console.error('Failed to load audio buffer:', error);
      return false;
    }
  }
  
  /**
   * Get sample data for waveform display
   */
  getSampleData(): Float32Array | null {
    return this.sampleData;
  }
  
  /**
   * Get sample info
   */
  getSampleInfo(): { fileName: string; duration: number; sampleRate: number; channels: number } | null {
    if (!this.sampleBuffer) return null;
    
    return {
      fileName: this.fileName,
      duration: this.fileDuration,
      sampleRate: this.sampleSampleRate,
      channels: this.sampleBuffer.numberOfChannels,
    };
  }
  
  /**
   * Check if a sample is loaded
   */
  hasSample(): boolean {
    return this.sampleData !== null;
  }
  
  dispose(): void {
    this.voices.clear();
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    this.sampleBuffer = null;
    this.sampleData = null;
    this.sampleDataR = null;
    
    super.dispose();
  }
}

export default AudioFileProcessor;