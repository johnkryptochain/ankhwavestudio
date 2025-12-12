// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Vibed - String/Physical modeling synthesizer
 * Based on the original AnkhWaveStudio Vibed plugin
 * 
 * Features:
 * - 9 strings/oscillators using Karplus-Strong algorithm
 * - Per-string volume
 * - Per-string pan
 * - Per-string detune
 * - Per-string harmonics
 * - Per-string pick position
 * - Per-string pickup position
 * - Impulse type (pluck, bow, hammer)
 * - String length/pitch
 */

import { BaseInstrument, InstrumentParameterDescriptor, InstrumentPreset } from './BaseInstrument';
import { clamp, midiNoteToFrequency } from '../utils/AudioMath';

// Number of strings
const NUM_STRINGS = 9;
const SAMPLE_LENGTH = 128;

// Harmonic multipliers
const HARMONIC_RATIOS = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Karplus-Strong string model
 */
class KarplusStrongString {
  private buffer: Float32Array;
  private bufferSize: number;
  private writeIndex: number = 0;
  private readIndex: number = 0;
  private feedback: number = 0.996;
  private dampening: number = 0.5;
  private lastOutput: number = 0;
  
  constructor(sampleRate: number, frequency: number) {
    this.bufferSize = Math.round(sampleRate / frequency);
    this.buffer = new Float32Array(this.bufferSize);
  }
  
  /**
   * Initialize the string with an impulse
   */
  pluck(impulse: Float32Array, pickPosition: number = 0.5): void {
    // Clear buffer
    this.buffer.fill(0);
    
    // Apply impulse at pick position
    const pickIndex = Math.floor(pickPosition * this.bufferSize);
    const impulseLength = Math.min(impulse.length, this.bufferSize);
    
    for (let i = 0; i < impulseLength; i++) {
      const index = (pickIndex + i) % this.bufferSize;
      this.buffer[index] = impulse[i];
    }
    
    this.writeIndex = 0;
    this.readIndex = 0;
    this.lastOutput = 0;
  }
  
  /**
   * Process one sample
   */
  process(pickupPosition: number = 0.5): number {
    // Read from buffer at pickup position
    const pickupIndex = Math.floor(pickupPosition * this.bufferSize);
    const readPos = (this.readIndex + pickupIndex) % this.bufferSize;
    
    // Get current sample
    const current = this.buffer[this.readIndex];
    const next = this.buffer[(this.readIndex + 1) % this.bufferSize];
    
    // Karplus-Strong averaging filter with dampening
    const filtered = (current + next) * 0.5 * this.feedback;
    const output = this.lastOutput + this.dampening * (filtered - this.lastOutput);
    this.lastOutput = output;
    
    // Write back to buffer
    this.buffer[this.writeIndex] = output;
    
    // Advance indices
    this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
    this.readIndex = (this.readIndex + 1) % this.bufferSize;
    
    // Return sample at pickup position
    return this.buffer[readPos];
  }
  
  /**
   * Set feedback (sustain)
   */
  setFeedback(feedback: number): void {
    this.feedback = clamp(feedback, 0.9, 0.9999);
  }
  
  /**
   * Set dampening (brightness)
   */
  setDampening(dampening: number): void {
    this.dampening = clamp(dampening, 0.1, 0.9);
  }
  
  /**
   * Resize buffer for new frequency
   */
  resize(sampleRate: number, frequency: number): void {
    const newSize = Math.max(2, Math.round(sampleRate / frequency));
    if (newSize !== this.bufferSize) {
      this.bufferSize = newSize;
      this.buffer = new Float32Array(this.bufferSize);
      this.writeIndex = 0;
      this.readIndex = 0;
    }
  }
}

/**
 * Voice state for Vibed
 */
interface VibedVoice {
  noteNumber: number;
  frequency: number;
  velocity: number;
  startTime: number;
  
  // Per-string state
  strings: KarplusStrongString[];
  stringActive: boolean[];
  
  // Envelope state
  envPhase: number;
  envStage: 'attack' | 'decay' | 'sustain' | 'release' | 'off';
  envValue: number;
  
  // Release flag
  released: boolean;
  releaseTime: number;
}

/**
 * Vibed - Physical modeling string synthesizer
 */
export class Vibed extends BaseInstrument {
  private voices: Map<number, VibedVoice> = new Map();
  
  // Audio processing
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sampleRate: number;
  
  // Impulse waveforms for each string
  private impulses: Float32Array[] = [];
  
  constructor(audioContext: AudioContext, id: string, name: string = 'Vibed') {
    super(audioContext, id, name, 'vibed');
    this.sampleRate = audioContext.sampleRate;
    this.initializeInstrument();
    this.addDefaultPresets();
    this.setupAudioProcessing();
  }

  protected initializeInstrument(): void {
    // Initialize default parameters
    this.params = {};
    
    // Initialize per-string parameters
    for (let s = 0; s < NUM_STRINGS; s++) {
      this.params[`str${s}Power`] = s === 0 ? 1 : 0;  // Only first string active by default
      this.params[`str${s}Vol`] = 100;
      this.params[`str${s}Pan`] = 0;
      this.params[`str${s}Detune`] = 0;
      this.params[`str${s}Pick`] = 50;      // Pick position (0-100)
      this.params[`str${s}Pickup`] = 50;    // Pickup position (0-100)
      this.params[`str${s}Harm`] = 2;       // Harmonic index (0-10)
      this.params[`str${s}Stiff`] = 50;     // Stiffness/brightness
      this.params[`str${s}Length`] = 100;   // String length modifier
      this.params[`str${s}Random`] = 0;     // Randomness in impulse
      this.params[`str${s}Impulse`] = 0;    // Impulse type (0=pluck, 1=bow, 2=hammer)
    }
    
    // Set up envelope
    this.envelope = {
      attack: 0.001,
      decay: 0.1,
      sustain: 0.9,
      release: 0.5,
    };
    
    // Initialize impulse waveforms
    this.initializeImpulses();
  }

  private initializeImpulses(): void {
    this.impulses = [];
    
    for (let s = 0; s < NUM_STRINGS; s++) {
      const impulse = new Float32Array(SAMPLE_LENGTH);
      // Default to sine impulse
      for (let i = 0; i < SAMPLE_LENGTH; i++) {
        impulse[i] = Math.sin((i / SAMPLE_LENGTH) * Math.PI * 2);
      }
      this.impulses.push(impulse);
    }
  }

  /**
   * Set impulse waveform for a string
   */
  setImpulse(stringIndex: number, data: number[] | Float32Array): void {
    if (stringIndex >= 0 && stringIndex < NUM_STRINGS) {
      const length = Math.min(data.length, SAMPLE_LENGTH);
      for (let i = 0; i < length; i++) {
        this.impulses[stringIndex][i] = clamp(data[i], -1, 1);
      }
    }
  }

  /**
   * Generate impulse based on type
   */
  private generateImpulse(stringIndex: number): Float32Array {
    const impulseType = Math.round(this.params[`str${stringIndex}Impulse`]);
    const randomness = this.params[`str${stringIndex}Random`] / 100;
    const impulse = new Float32Array(SAMPLE_LENGTH);
    
    switch (impulseType) {
      case 0: // Pluck - sharp attack
        for (let i = 0; i < SAMPLE_LENGTH; i++) {
          const t = i / SAMPLE_LENGTH;
          impulse[i] = Math.sin(t * Math.PI * 2) * Math.exp(-t * 3);
          impulse[i] += (Math.random() - 0.5) * randomness;
        }
        break;
        
      case 1: // Bow - sustained friction
        for (let i = 0; i < SAMPLE_LENGTH; i++) {
          const t = i / SAMPLE_LENGTH;
          impulse[i] = Math.sin(t * Math.PI * 4) * (1 - Math.exp(-t * 5));
          impulse[i] += (Math.random() - 0.5) * randomness;
        }
        break;
        
      case 2: // Hammer - percussive
        for (let i = 0; i < SAMPLE_LENGTH; i++) {
          const t = i / SAMPLE_LENGTH;
          impulse[i] = Math.sin(t * Math.PI) * Math.exp(-t * 8);
          impulse[i] += (Math.random() - 0.5) * randomness;
        }
        break;
        
      default:
        // Use stored impulse
        return this.impulses[stringIndex];
    }
    
    return impulse;
  }

  private setupAudioProcessing(): void {
    const bufferSize = 256;
    this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 0, 2);
    
    this.scriptProcessor.onaudioprocess = (event) => {
      const outputL = event.outputBuffer.getChannelData(0);
      const outputR = event.outputBuffer.getChannelData(1);
      this.processAudio(outputL, outputR, outputL.length);
    };
    
    this.scriptProcessor.connect(this.volumeNode);
  }

  private processAudio(outputL: Float32Array, outputR: Float32Array, numSamples: number): void {
    // Clear output buffers
    outputL.fill(0);
    outputR.fill(0);
    
    // Process each active voice
    for (const [noteNumber, voice] of this.voices) {
      this.processVoice(voice, outputL, outputR, numSamples);
      
      // Remove voice if envelope is finished
      if (voice.envStage === 'off') {
        this.voices.delete(noteNumber);
      }
    }
  }

  private processVoice(voice: VibedVoice, outputL: Float32Array, outputR: Float32Array, numSamples: number): void {
    for (let i = 0; i < numSamples; i++) {
      // Update envelope
      const envValue = this.updateEnvelope(voice);
      
      let sampleL = 0;
      let sampleR = 0;
      
      // Process each active string
      for (let s = 0; s < NUM_STRINGS; s++) {
        if (!voice.stringActive[s]) continue;
        
        const vol = this.params[`str${s}Vol`] / 100;
        const pan = this.params[`str${s}Pan`] / 100;
        const pickup = this.params[`str${s}Pickup`] / 100;
        
        // Get sample from string
        const stringSample = voice.strings[s].process(pickup);
        
        // Apply volume and pan
        const volL = vol * (pan <= 0 ? 1 : 1 - pan);
        const volR = vol * (pan >= 0 ? 1 : 1 + pan);
        
        sampleL += stringSample * volL;
        sampleR += stringSample * volR;
      }
      
      // Apply envelope and velocity
      const gain = envValue * voice.velocity;
      outputL[i] += sampleL * gain;
      outputR[i] += sampleR * gain;
    }
  }

  private updateEnvelope(voice: VibedVoice): number {
    const dt = 1 / this.sampleRate;
    let value = voice.envValue;
    let stage = voice.envStage;
    let phase = voice.envPhase;
    
    const att = this.envelope.attack;
    const dec = this.envelope.decay;
    const sus = this.envelope.sustain;
    const rel = this.envelope.release;
    
    switch (stage) {
      case 'attack':
        phase += dt;
        if (phase >= att) {
          stage = 'decay';
          phase = 0;
          value = 1;
        } else {
          value = att > 0 ? phase / att : 1;
        }
        break;
        
      case 'decay':
        phase += dt;
        if (phase >= dec) {
          stage = 'sustain';
          phase = 0;
          value = sus;
        } else {
          const progress = dec > 0 ? phase / dec : 1;
          value = 1 - (1 - sus) * progress;
        }
        break;
        
      case 'sustain':
        value = sus;
        if (voice.released) {
          stage = 'release';
          phase = 0;
        }
        break;
        
      case 'release':
        phase += dt;
        if (phase >= rel) {
          stage = 'off';
          value = 0;
        } else {
          const progress = rel > 0 ? phase / rel : 1;
          value = sus * (1 - progress);
        }
        break;
        
      case 'off':
        value = 0;
        break;
    }
    
    voice.envStage = stage;
    voice.envValue = value;
    voice.envPhase = phase;
    
    return value;
  }

  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    const descriptors: InstrumentParameterDescriptor[] = [];
    
    for (let s = 0; s < NUM_STRINGS; s++) {
      const category = `String ${s + 1}`;
      descriptors.push(
        { name: 'Power', key: `str${s}Power`, min: 0, max: 1, default: s === 0 ? 1 : 0, type: 'boolean', category },
        { name: 'Volume', key: `str${s}Vol`, min: 0, max: 100, default: 100, category },
        { name: 'Pan', key: `str${s}Pan`, min: -100, max: 100, default: 0, category },
        { name: 'Detune', key: `str${s}Detune`, min: -100, max: 100, default: 0, unit: 'cents', category },
        { name: 'Pick Position', key: `str${s}Pick`, min: 0, max: 100, default: 50, category },
        { name: 'Pickup Position', key: `str${s}Pickup`, min: 0, max: 100, default: 50, category },
        { name: 'Harmonic', key: `str${s}Harm`, min: 0, max: 10, default: 2, type: 'enum',
          enumValues: HARMONIC_RATIOS.map(r => `${r}x`), category },
        { name: 'Stiffness', key: `str${s}Stiff`, min: 0, max: 100, default: 50, category },
        { name: 'Length', key: `str${s}Length`, min: 10, max: 200, default: 100, category },
        { name: 'Random', key: `str${s}Random`, min: 0, max: 100, default: 0, category },
        { name: 'Impulse', key: `str${s}Impulse`, min: 0, max: 2, default: 0, type: 'enum',
          enumValues: ['Pluck', 'Bow', 'Hammer'], category },
      );
    }
    
    return descriptors;
  }

  protected onParameterChange(key: string, value: number): void {
    // Update string parameters in real-time if needed
  }

  protected silenceNote(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
    if (voice) {
      voice.envStage = 'off';
      voice.envValue = 0;
    }
  }

  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    // Create strings for this voice
    const strings: KarplusStrongString[] = [];
    const stringActive: boolean[] = [];
    
    for (let s = 0; s < NUM_STRINGS; s++) {
      const power = this.params[`str${s}Power`] > 0.5;
      stringActive.push(power);
      
      if (power) {
        const harmIndex = Math.round(this.params[`str${s}Harm`]);
        const harmRatio = HARMONIC_RATIOS[harmIndex] || 1;
        const detune = this.params[`str${s}Detune`];
        const lengthMod = this.params[`str${s}Length`] / 100;
        const stiffness = this.params[`str${s}Stiff`] / 100;
        const pickPos = this.params[`str${s}Pick`] / 100;
        
        // Calculate string frequency
        const stringFreq = frequency * harmRatio * Math.pow(2, detune / 1200) / lengthMod;
        
        // Create string
        const string = new KarplusStrongString(this.sampleRate, stringFreq);
        string.setDampening(0.1 + stiffness * 0.8);
        string.setFeedback(0.99 + (1 - stiffness) * 0.009);
        
        // Generate and apply impulse
        const impulse = this.generateImpulse(s);
        string.pluck(impulse, pickPos);
        
        strings.push(string);
      } else {
        // Placeholder for inactive strings
        strings.push(new KarplusStrongString(this.sampleRate, 440));
      }
    }
    
    // Create voice
    const voice: VibedVoice = {
      noteNumber,
      frequency,
      velocity,
      startTime: this.audioContext.currentTime,
      
      strings,
      stringActive,
      
      envPhase: 0,
      envStage: 'attack',
      envValue: 0,
      
      released: false,
      releaseTime: 0,
    };
    
    this.voices.set(noteNumber, voice);
  }

  protected releaseNote(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
    if (voice) {
      voice.released = true;
      voice.releaseTime = this.audioContext.currentTime;
      
      if (voice.envStage !== 'off') {
        voice.envStage = 'release';
        voice.envPhase = 0;
      }
    }
  }

  private addDefaultPresets(): void {
    const presets: InstrumentPreset[] = [
      {
        name: 'Plucked String',
        params: {
          str0Power: 1, str0Vol: 100, str0Harm: 2, str0Pick: 30, str0Pickup: 70, str0Stiff: 40, str0Impulse: 0,
          str1Power: 0, str2Power: 0, str3Power: 0, str4Power: 0, str5Power: 0, str6Power: 0, str7Power: 0, str8Power: 0,
        },
      },
      {
        name: 'Guitar',
        params: {
          str0Power: 1, str0Vol: 100, str0Harm: 2, str0Pick: 20, str0Pickup: 80, str0Stiff: 30, str0Impulse: 0,
          str1Power: 1, str1Vol: 50, str1Harm: 3, str1Pick: 25, str1Pickup: 75, str1Stiff: 35, str1Impulse: 0,
          str2Power: 1, str2Vol: 30, str2Harm: 4, str2Pick: 30, str2Pickup: 70, str2Stiff: 40, str2Impulse: 0,
          str3Power: 0, str4Power: 0, str5Power: 0, str6Power: 0, str7Power: 0, str8Power: 0,
        },
      },
      {
        name: 'Bowed String',
        params: {
          str0Power: 1, str0Vol: 100, str0Harm: 2, str0Pick: 50, str0Pickup: 50, str0Stiff: 60, str0Impulse: 1,
          str1Power: 1, str1Vol: 40, str1Harm: 3, str1Pick: 50, str1Pickup: 50, str1Stiff: 55, str1Impulse: 1,
          str2Power: 0, str3Power: 0, str4Power: 0, str5Power: 0, str6Power: 0, str7Power: 0, str8Power: 0,
        },
      },
      {
        name: 'Piano',
        params: {
          str0Power: 1, str0Vol: 100, str0Harm: 2, str0Pick: 10, str0Pickup: 90, str0Stiff: 70, str0Impulse: 2,
          str1Power: 1, str1Vol: 80, str1Harm: 3, str1Pick: 10, str1Pickup: 85, str1Stiff: 65, str1Impulse: 2,
          str2Power: 1, str2Vol: 50, str2Harm: 4, str2Pick: 10, str2Pickup: 80, str2Stiff: 60, str2Impulse: 2,
          str3Power: 0, str4Power: 0, str5Power: 0, str6Power: 0, str7Power: 0, str8Power: 0,
        },
      },
      {
        name: 'Harp',
        params: {
          str0Power: 1, str0Vol: 100, str0Harm: 2, str0Pick: 40, str0Pickup: 60, str0Stiff: 20, str0Impulse: 0,
          str1Power: 1, str1Vol: 60, str1Harm: 4, str1Pick: 45, str1Pickup: 55, str1Stiff: 25, str1Impulse: 0,
          str2Power: 1, str2Vol: 40, str2Harm: 6, str2Pick: 50, str2Pickup: 50, str2Stiff: 30, str2Impulse: 0,
          str3Power: 0, str4Power: 0, str5Power: 0, str6Power: 0, str7Power: 0, str8Power: 0,
        },
      },
      {
        name: 'Full Strings',
        params: {
          str0Power: 1, str0Vol: 100, str0Harm: 0, str0Pan: -80, str0Stiff: 40,
          str1Power: 1, str1Vol: 90, str1Harm: 1, str1Pan: -60, str1Stiff: 45,
          str2Power: 1, str2Vol: 100, str2Harm: 2, str2Pan: -30, str2Stiff: 50,
          str3Power: 1, str3Vol: 100, str3Harm: 2, str3Pan: 0, str3Stiff: 50,
          str4Power: 1, str4Vol: 100, str4Harm: 2, str4Pan: 30, str4Stiff: 50,
          str5Power: 1, str5Vol: 90, str5Harm: 3, str5Pan: 60, str5Stiff: 55,
          str6Power: 1, str6Vol: 80, str6Harm: 4, str6Pan: 80, str6Stiff: 60,
          str7Power: 0, str8Power: 0,
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
    this.voices.clear();
    super.dispose();
  }
}