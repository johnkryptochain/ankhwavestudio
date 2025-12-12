// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * OscillatorWorklet - AudioWorklet processor for wavetable oscillator synthesis
 * Provides low-latency wavetable oscillator with multiple waveforms, FM/PM, and interpolation
 */

// Waveform types
const WAVEFORM_SINE = 0;
const WAVEFORM_SQUARE = 1;
const WAVEFORM_SAWTOOTH = 2;
const WAVEFORM_TRIANGLE = 3;
const WAVEFORM_NOISE = 4;

// Wavetable size
const TABLE_SIZE = 2048;

/**
 * Generate band-limited wavetable for a given waveform type
 * Uses additive synthesis to avoid aliasing
 */
function generateWavetable(type: number, size: number = TABLE_SIZE, harmonics: number = 64): Float32Array {
  const table = new Float32Array(size);
  
  switch (type) {
    case WAVEFORM_SINE:
      for (let i = 0; i < size; i++) {
        table[i] = Math.sin((2 * Math.PI * i) / size);
      }
      break;
      
    case WAVEFORM_SQUARE:
      // Band-limited square wave (odd harmonics only)
      for (let h = 1; h <= harmonics; h += 2) {
        const amplitude = 1 / h;
        for (let i = 0; i < size; i++) {
          table[i] += amplitude * Math.sin((2 * Math.PI * h * i) / size);
        }
      }
      // Normalize
      normalizeTable(table);
      break;
      
    case WAVEFORM_SAWTOOTH:
      // Band-limited sawtooth wave
      for (let h = 1; h <= harmonics; h++) {
        const amplitude = (h % 2 === 0 ? -1 : 1) / h;
        for (let i = 0; i < size; i++) {
          table[i] += amplitude * Math.sin((2 * Math.PI * h * i) / size);
        }
      }
      normalizeTable(table);
      break;
      
    case WAVEFORM_TRIANGLE:
      // Band-limited triangle wave (odd harmonics, alternating sign)
      for (let h = 1; h <= harmonics; h += 2) {
        const sign = ((h - 1) / 2) % 2 === 0 ? 1 : -1;
        const amplitude = sign / (h * h);
        for (let i = 0; i < size; i++) {
          table[i] += amplitude * Math.sin((2 * Math.PI * h * i) / size);
        }
      }
      normalizeTable(table);
      break;
      
    default:
      // Default to sine
      for (let i = 0; i < size; i++) {
        table[i] = Math.sin((2 * Math.PI * i) / size);
      }
  }
  
  return table;
}

/**
 * Normalize wavetable to -1 to 1 range
 */
function normalizeTable(table: Float32Array): void {
  let max = 0;
  for (let i = 0; i < table.length; i++) {
    const abs = Math.abs(table[i]);
    if (abs > max) max = abs;
  }
  if (max > 0) {
    for (let i = 0; i < table.length; i++) {
      table[i] /= max;
    }
  }
}

/**
 * Voice state for polyphonic operation
 */
interface Voice {
  active: boolean;
  noteNumber: number;
  frequency: number;
  velocity: number;
  phase: number;
  envelopePhase: 'idle' | 'attack' | 'decay' | 'sustain' | 'release';
  envelopeValue: number;
  envelopeTime: number;
  releaseStartValue: number;
}

/**
 * OscillatorProcessor - AudioWorkletProcessor for wavetable oscillator
 */
class OscillatorProcessor extends AudioWorkletProcessor {
  private wavetables: Map<number, Float32Array> = new Map();
  private currentWaveform: number = WAVEFORM_SAWTOOTH;
  private voices: Voice[] = [];
  private maxVoices: number = 16;
  
  // Envelope parameters (in seconds)
  private attack: number = 0.01;
  private decay: number = 0.1;
  private sustain: number = 0.7;
  private release: number = 0.3;
  
  // Modulation
  private fmAmount: number = 0;
  private pmAmount: number = 0;
  
  // Noise generator state
  private noiseState: number = 1;

  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 440, minValue: 20, maxValue: 20000, automationRate: 'a-rate' },
      { name: 'detune', defaultValue: 0, minValue: -1200, maxValue: 1200, automationRate: 'k-rate' },
      { name: 'volume', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'waveform', defaultValue: 1, minValue: 0, maxValue: 4, automationRate: 'k-rate' },
      { name: 'fmInput', defaultValue: 0, minValue: -1, maxValue: 1, automationRate: 'a-rate' },
      { name: 'pmInput', defaultValue: 0, minValue: -1, maxValue: 1, automationRate: 'a-rate' },
    ];
  }

  constructor() {
    super();
    
    // Pre-generate wavetables
    this.wavetables.set(WAVEFORM_SINE, generateWavetable(WAVEFORM_SINE));
    this.wavetables.set(WAVEFORM_SQUARE, generateWavetable(WAVEFORM_SQUARE));
    this.wavetables.set(WAVEFORM_SAWTOOTH, generateWavetable(WAVEFORM_SAWTOOTH));
    this.wavetables.set(WAVEFORM_TRIANGLE, generateWavetable(WAVEFORM_TRIANGLE));
    
    // Initialize voice pool
    for (let i = 0; i < this.maxVoices; i++) {
      this.voices.push(this.createVoice());
    }
    
    // Handle messages from main thread
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  private createVoice(): Voice {
    return {
      active: false,
      noteNumber: 0,
      frequency: 440,
      velocity: 1,
      phase: 0,
      envelopePhase: 'idle',
      envelopeValue: 0,
      envelopeTime: 0,
      releaseStartValue: 0
    };
  }

  private handleMessage(data: { type: string; [key: string]: unknown }): void {
    switch (data.type) {
      case 'noteOn':
        this.noteOn(data.noteNumber as number, data.frequency as number, data.velocity as number);
        break;
      case 'noteOff':
        this.noteOff(data.noteNumber as number);
        break;
      case 'allNotesOff':
        this.allNotesOff();
        break;
      case 'setWaveform':
        this.currentWaveform = data.waveform as number;
        break;
      case 'setEnvelope':
        this.attack = (data.attack as number) ?? this.attack;
        this.decay = (data.decay as number) ?? this.decay;
        this.sustain = (data.sustain as number) ?? this.sustain;
        this.release = (data.release as number) ?? this.release;
        break;
      case 'setModulation':
        this.fmAmount = (data.fmAmount as number) ?? this.fmAmount;
        this.pmAmount = (data.pmAmount as number) ?? this.pmAmount;
        break;
      case 'loadWavetable':
        // Load custom wavetable
        const tableData = data.table as Float32Array;
        const tableIndex = (data.index as number) ?? 5;
        this.wavetables.set(tableIndex, tableData);
        break;
    }
  }

  private noteOn(noteNumber: number, frequency: number, velocity: number = 1): void {
    // Find a free voice or steal the oldest one
    let voice = this.voices.find(v => !v.active);
    if (!voice) {
      // Steal oldest voice
      voice = this.voices.reduce((oldest, v) => 
        v.envelopeTime > oldest.envelopeTime ? v : oldest
      );
    }
    
    voice.active = true;
    voice.noteNumber = noteNumber;
    voice.frequency = frequency;
    voice.velocity = velocity;
    voice.phase = 0;
    voice.envelopePhase = 'attack';
    voice.envelopeTime = 0;
    voice.envelopeValue = 0;
  }

  private noteOff(noteNumber: number): void {
    for (const voice of this.voices) {
      if (voice.active && voice.noteNumber === noteNumber && voice.envelopePhase !== 'release') {
        voice.envelopePhase = 'release';
        voice.envelopeTime = 0;
        voice.releaseStartValue = voice.envelopeValue;
      }
    }
  }

  private allNotesOff(): void {
    for (const voice of this.voices) {
      if (voice.active) {
        voice.envelopePhase = 'release';
        voice.envelopeTime = 0;
        voice.releaseStartValue = voice.envelopeValue;
      }
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
        if (voice.envelopeTime >= this.release) {
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
   * Generate white noise sample
   */
  private generateNoise(): number {
    // Simple xorshift PRNG for noise
    this.noiseState ^= this.noiseState << 13;
    this.noiseState ^= this.noiseState >> 17;
    this.noiseState ^= this.noiseState << 5;
    return (this.noiseState / 2147483647) * 2 - 1;
  }

  /**
   * Cubic interpolation for smooth wavetable lookup
   */
  private cubicInterpolate(table: Float32Array, phase: number): number {
    const size = table.length;
    const index = phase * size;
    const i0 = Math.floor(index) % size;
    const i1 = (i0 + 1) % size;
    const i2 = (i0 + 2) % size;
    const im1 = (i0 - 1 + size) % size;
    
    const frac = index - Math.floor(index);
    
    const y0 = table[im1];
    const y1 = table[i0];
    const y2 = table[i1];
    const y3 = table[i2];
    
    // Cubic interpolation
    const c0 = y1;
    const c1 = 0.5 * (y2 - y0);
    const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
    const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    
    return ((c3 * frac + c2) * frac + c1) * frac + c0;
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    
    const outputL = output[0];
    const outputR = output.length > 1 ? output[1] : output[0];
    
    // Clear output
    outputL.fill(0);
    if (outputR !== outputL) outputR.fill(0);
    
    const volume = parameters.volume[0];
    const detune = parameters.detune[0];
    const waveformParam = parameters.waveform[0];
    const fmInput = parameters.fmInput;
    const pmInput = parameters.pmInput;
    
    // Update waveform if changed
    const newWaveform = Math.round(waveformParam);
    if (newWaveform !== this.currentWaveform && newWaveform >= 0 && newWaveform <= 4) {
      this.currentWaveform = newWaveform;
    }
    
    const wavetable = this.wavetables.get(this.currentWaveform);
    const sampleRate = 44100; // Should get from context
    const deltaTime = 1 / sampleRate;
    const detuneMultiplier = Math.pow(2, detune / 1200);
    
    // Process each active voice
    for (const voice of this.voices) {
      if (!voice.active) continue;
      
      for (let i = 0; i < outputL.length; i++) {
        // Update envelope
        const envelope = this.updateEnvelope(voice, deltaTime);
        if (!voice.active) break;
        
        // Get modulation inputs
        const fm = fmInput.length > 1 ? fmInput[i] : fmInput[0];
        const pm = pmInput.length > 1 ? pmInput[i] : pmInput[0];
        
        // Calculate frequency with FM
        const freq = voice.frequency * detuneMultiplier * (1 + fm * this.fmAmount);
        
        // Calculate phase with PM
        let phase = voice.phase + pm * this.pmAmount;
        phase = phase - Math.floor(phase); // Wrap to 0-1
        
        // Generate sample
        let sample: number;
        if (this.currentWaveform === WAVEFORM_NOISE) {
          sample = this.generateNoise();
        } else if (wavetable) {
          sample = this.cubicInterpolate(wavetable, phase);
        } else {
          sample = 0;
        }
        
        // Apply envelope and velocity
        const gain = envelope * voice.velocity * volume;
        outputL[i] += sample * gain;
        outputR[i] += sample * gain;
        
        // Update phase
        voice.phase += freq / sampleRate;
        if (voice.phase >= 1) voice.phase -= 1;
      }
    }
    
    return true;
  }
}

// Register the processor
registerProcessor('oscillator-processor', OscillatorProcessor);

export { OscillatorProcessor, generateWavetable };