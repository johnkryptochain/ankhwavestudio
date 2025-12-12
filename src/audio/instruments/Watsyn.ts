// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Watsyn - 4-oscillator wavetable synthesizer
 * Based on original AnkhWaveStudio Watsyn (plugins/Watsyn/)
 * 
 * Features:
 * - 4 wavetable oscillators (A1, A2, B1, B2)
 * - Wavetable selection per oscillator
 * - Volume, pan, detune per oscillator
 * - A/B crossfade
 * - Envelope per oscillator pair
 */

import { BaseInstrument, InstrumentParameterDescriptor, InstrumentPreset } from './BaseInstrument';

// Wavetable size
const WAVETABLE_SIZE = 256;

// Built-in wavetables
const WAVETABLES = {
  sine: generateSineTable(),
  triangle: generateTriangleTable(),
  saw: generateSawTable(),
  square: generateSquareTable(),
  moogSaw: generateMoogSawTable(),
  exponential: generateExponentialTable(),
  softSquare: generateSoftSquareTable(),
  pulse25: generatePulseTable(0.25),
  pulse12: generatePulseTable(0.125),
  stairs: generateStairsTable(),
  random: generateRandomTable(),
};

type WavetableName = keyof typeof WAVETABLES;

// Generate wavetables
function generateSineTable(): Float32Array {
  const table = new Float32Array(WAVETABLE_SIZE);
  for (let i = 0; i < WAVETABLE_SIZE; i++) {
    table[i] = Math.sin((i / WAVETABLE_SIZE) * Math.PI * 2);
  }
  return table;
}

function generateTriangleTable(): Float32Array {
  const table = new Float32Array(WAVETABLE_SIZE);
  for (let i = 0; i < WAVETABLE_SIZE; i++) {
    const phase = i / WAVETABLE_SIZE;
    if (phase < 0.25) {
      table[i] = phase * 4;
    } else if (phase < 0.75) {
      table[i] = 2 - phase * 4;
    } else {
      table[i] = phase * 4 - 4;
    }
  }
  return table;
}

function generateSawTable(): Float32Array {
  const table = new Float32Array(WAVETABLE_SIZE);
  for (let i = 0; i < WAVETABLE_SIZE; i++) {
    table[i] = 2 * (i / WAVETABLE_SIZE) - 1;
  }
  return table;
}

function generateSquareTable(): Float32Array {
  const table = new Float32Array(WAVETABLE_SIZE);
  for (let i = 0; i < WAVETABLE_SIZE; i++) {
    table[i] = i < WAVETABLE_SIZE / 2 ? 1 : -1;
  }
  return table;
}

function generateMoogSawTable(): Float32Array {
  const table = new Float32Array(WAVETABLE_SIZE);
  for (let i = 0; i < WAVETABLE_SIZE; i++) {
    const phase = i / WAVETABLE_SIZE;
    // Moog-style saw with slight curve
    table[i] = 2 * Math.pow(phase, 0.8) - 1;
  }
  return table;
}

function generateExponentialTable(): Float32Array {
  const table = new Float32Array(WAVETABLE_SIZE);
  for (let i = 0; i < WAVETABLE_SIZE; i++) {
    const phase = i / WAVETABLE_SIZE;
    table[i] = Math.exp(-phase * 4) * 2 - 1;
  }
  return table;
}

function generateSoftSquareTable(): Float32Array {
  const table = new Float32Array(WAVETABLE_SIZE);
  for (let i = 0; i < WAVETABLE_SIZE; i++) {
    const phase = i / WAVETABLE_SIZE;
    // Soft square using tanh
    table[i] = Math.tanh(Math.sin(phase * Math.PI * 2) * 3);
  }
  return table;
}

function generatePulseTable(width: number): Float32Array {
  const table = new Float32Array(WAVETABLE_SIZE);
  for (let i = 0; i < WAVETABLE_SIZE; i++) {
    table[i] = (i / WAVETABLE_SIZE) < width ? 1 : -1;
  }
  return table;
}

function generateStairsTable(): Float32Array {
  const table = new Float32Array(WAVETABLE_SIZE);
  const steps = 8;
  for (let i = 0; i < WAVETABLE_SIZE; i++) {
    const step = Math.floor((i / WAVETABLE_SIZE) * steps);
    table[i] = (step / (steps - 1)) * 2 - 1;
  }
  return table;
}

function generateRandomTable(): Float32Array {
  const table = new Float32Array(WAVETABLE_SIZE);
  for (let i = 0; i < WAVETABLE_SIZE; i++) {
    table[i] = Math.random() * 2 - 1;
  }
  return table;
}

// Wavetable names for UI
export const WAVETABLE_NAMES: WavetableName[] = [
  'sine', 'triangle', 'saw', 'square', 'moogSaw',
  'exponential', 'softSquare', 'pulse25', 'pulse12', 'stairs', 'random'
];

// Voice for polyphony
interface WatsynVoice {
  note: number;
  velocity: number;
  frequency: number;
  
  // Oscillator phases
  a1Phase: number;
  a2Phase: number;
  b1Phase: number;
  b2Phase: number;
  
  // Envelope states
  envAStage: 'attack' | 'decay' | 'sustain' | 'release' | 'off';
  envAValue: number;
  envATime: number;
  
  envBStage: 'attack' | 'decay' | 'sustain' | 'release' | 'off';
  envBValue: number;
  envBTime: number;
  
  // Note state
  released: boolean;
}

/**
 * Watsyn - 4-oscillator wavetable synthesizer
 */
export class Watsyn extends BaseInstrument {
  private voices: Map<number, WatsynVoice> = new Map();
  private processor: ScriptProcessorNode | null = null;
  private sampleRate: number = 44100;
  
  // Custom wavetables (can be loaded)
  private customWavetables: Map<string, Float32Array> = new Map();
  
  constructor(audioContext: AudioContext, id: string = 'watsyn') {
    super(audioContext, id, 'Watsyn', 'wavetable-synth');
    this.sampleRate = audioContext.sampleRate;
    this.initializeInstrument();
  }
  
  protected initializeInstrument(): void {
    // Initialize default parameters
    this.params = {
      // Oscillator A1
      a1Wave: 0,
      a1Vol: 100,
      a1Pan: 0,
      a1Detune: 0,
      a1Phase: 0,
      
      // Oscillator A2
      a2Wave: 2,
      a2Vol: 0,
      a2Pan: 0,
      a2Detune: 0,
      a2Phase: 0,
      
      // Oscillator B1
      b1Wave: 3,
      b1Vol: 100,
      b1Pan: 0,
      b1Detune: 0,
      b1Phase: 0,
      
      // Oscillator B2
      b2Wave: 1,
      b2Vol: 0,
      b2Pan: 0,
      b2Detune: 0,
      b2Phase: 0,
      
      // A/B Crossfade
      abMix: 0,
      
      // Envelope A
      envAAttack: 10,
      envADecay: 100,
      envASustain: 80,
      envARelease: 200,
      
      // Envelope B
      envBAttack: 10,
      envBDecay: 100,
      envBSustain: 80,
      envBRelease: 200,
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
        name: 'Init',
        params: { ...this.params }
      },
      {
        name: 'Dual Saw',
        params: {
          a1Wave: 2, a1Vol: 100, a1Detune: -10, a1Pan: 0, a1Phase: 0,
          a2Wave: 2, a2Vol: 100, a2Detune: 10, a2Pan: 0, a2Phase: 0,
          b1Wave: 2, b1Vol: 0, b1Detune: 0, b1Pan: 0, b1Phase: 0,
          b2Wave: 2, b2Vol: 0, b2Detune: 0, b2Pan: 0, b2Phase: 0,
          abMix: -100,
          envAAttack: 5, envADecay: 200, envASustain: 70, envARelease: 300,
          envBAttack: 10, envBDecay: 100, envBSustain: 80, envBRelease: 200,
        }
      },
      {
        name: 'Square Lead',
        params: {
          a1Wave: 3, a1Vol: 100, a1Detune: 0, a1Pan: 0, a1Phase: 0,
          a2Wave: 3, a2Vol: 50, a2Detune: 7, a2Pan: 0, a2Phase: 0,
          b1Wave: 0, b1Vol: 30, b1Detune: 0, b1Pan: 0, b1Phase: 0,
          b2Wave: 0, b2Vol: 0, b2Detune: 0, b2Pan: 0, b2Phase: 0,
          abMix: -50,
          envAAttack: 2, envADecay: 100, envASustain: 80, envARelease: 150,
          envBAttack: 10, envBDecay: 100, envBSustain: 80, envBRelease: 200,
        }
      },
      {
        name: 'Pad Morph',
        params: {
          a1Wave: 0, a1Vol: 100, a1Detune: 0, a1Pan: 0, a1Phase: 0,
          a2Wave: 1, a2Vol: 100, a2Detune: 0, a2Pan: 0, a2Phase: 0,
          b1Wave: 2, b1Vol: 100, b1Detune: 0, b1Pan: 0, b1Phase: 0,
          b2Wave: 3, b2Vol: 100, b2Detune: 0, b2Pan: 0, b2Phase: 0,
          abMix: 0,
          envAAttack: 500, envADecay: 300, envASustain: 80, envARelease: 800,
          envBAttack: 800, envBDecay: 400, envBSustain: 70, envBRelease: 1000,
        }
      },
      {
        name: 'Pluck',
        params: {
          a1Wave: 2, a1Vol: 100, a1Detune: 0, a1Pan: 0, a1Phase: 0,
          a2Wave: 3, a2Vol: 50, a2Detune: 0, a2Pan: 0, a2Phase: 0,
          b1Wave: 0, b1Vol: 0, b1Detune: 0, b1Pan: 0, b1Phase: 0,
          b2Wave: 0, b2Vol: 0, b2Detune: 0, b2Pan: 0, b2Phase: 0,
          abMix: -100,
          envAAttack: 1, envADecay: 150, envASustain: 0, envARelease: 100,
          envBAttack: 10, envBDecay: 100, envBSustain: 80, envBRelease: 200,
        }
      },
      {
        name: 'Organ',
        params: {
          a1Wave: 0, a1Vol: 100, a1Detune: 0, a1Pan: 0, a1Phase: 0,
          a2Wave: 0, a2Vol: 50, a2Detune: 1200, a2Pan: 0, a2Phase: 0,
          b1Wave: 0, b1Vol: 30, b1Detune: 1902, b1Pan: 0, b1Phase: 0,
          b2Wave: 0, b2Vol: 20, b2Detune: 2400, b2Pan: 0, b2Phase: 0,
          abMix: 0,
          envAAttack: 5, envADecay: 50, envASustain: 100, envARelease: 50,
          envBAttack: 5, envBDecay: 50, envBSustain: 100, envBRelease: 50,
        }
      },
      {
        name: 'Detuned Strings',
        params: {
          a1Wave: 2, a1Vol: 100, a1Pan: -50, a1Detune: -15, a1Phase: 0,
          a2Wave: 2, a2Vol: 100, a2Pan: 50, a2Detune: 15, a2Phase: 0,
          b1Wave: 2, b1Vol: 80, b1Pan: -30, b1Detune: -8, b1Phase: 0,
          b2Wave: 2, b2Vol: 80, b2Pan: 30, b2Detune: 8, b2Phase: 0,
          abMix: 0,
          envAAttack: 200, envADecay: 300, envASustain: 80, envARelease: 500,
          envBAttack: 250, envBDecay: 350, envBSustain: 75, envBRelease: 550,
        }
      },
      {
        name: 'Digital Bell',
        params: {
          a1Wave: 0, a1Vol: 100, a1Detune: 0, a1Pan: 0, a1Phase: 0,
          a2Wave: 5, a2Vol: 60, a2Detune: 1200, a2Pan: 0, a2Phase: 0,
          b1Wave: 0, b1Vol: 40, b1Detune: 1902, b1Pan: 0, b1Phase: 0,
          b2Wave: 5, b2Vol: 30, b2Detune: 2400, b2Pan: 0, b2Phase: 0,
          abMix: 0,
          envAAttack: 1, envADecay: 800, envASustain: 0, envARelease: 500,
          envBAttack: 1, envBDecay: 1200, envBSustain: 0, envBRelease: 800,
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
    
    if (this.voices.size === 0) return;
    
    // Get wavetables
    const a1Table = this.getWavetable(this.params.a1Wave);
    const a2Table = this.getWavetable(this.params.a2Wave);
    const b1Table = this.getWavetable(this.params.b1Wave);
    const b2Table = this.getWavetable(this.params.b2Wave);
    
    // Calculate A/B mix
    const abMix = this.params.abMix / 100; // -1 to 1
    const aGain = Math.cos((abMix + 1) * Math.PI / 4); // Crossfade curve
    const bGain = Math.sin((abMix + 1) * Math.PI / 4);
    
    // Process each voice
    const voicesToRemove: number[] = [];
    
    for (const [note, voice] of this.voices) {
      const velocityGain = voice.velocity;
      
      // Calculate phase increments
      const a1PhaseInc = (voice.frequency * Math.pow(2, this.params.a1Detune / 1200)) / this.sampleRate;
      const a2PhaseInc = (voice.frequency * Math.pow(2, this.params.a2Detune / 1200)) / this.sampleRate;
      const b1PhaseInc = (voice.frequency * Math.pow(2, this.params.b1Detune / 1200)) / this.sampleRate;
      const b2PhaseInc = (voice.frequency * Math.pow(2, this.params.b2Detune / 1200)) / this.sampleRate;
      
      // Calculate pan values
      const a1PanL = Math.cos((this.params.a1Pan / 100 + 1) * Math.PI / 4);
      const a1PanR = Math.sin((this.params.a1Pan / 100 + 1) * Math.PI / 4);
      const a2PanL = Math.cos((this.params.a2Pan / 100 + 1) * Math.PI / 4);
      const a2PanR = Math.sin((this.params.a2Pan / 100 + 1) * Math.PI / 4);
      const b1PanL = Math.cos((this.params.b1Pan / 100 + 1) * Math.PI / 4);
      const b1PanR = Math.sin((this.params.b1Pan / 100 + 1) * Math.PI / 4);
      const b2PanL = Math.cos((this.params.b2Pan / 100 + 1) * Math.PI / 4);
      const b2PanR = Math.sin((this.params.b2Pan / 100 + 1) * Math.PI / 4);
      
      for (let i = 0; i < bufferSize; i++) {
        // Update envelopes
        this.updateEnvelopeA(voice);
        this.updateEnvelopeB(voice);
        
        // Check if voice is done
        if (voice.envAStage === 'off' && voice.envBStage === 'off') {
          voicesToRemove.push(note);
          break;
        }
        
        // Read wavetables with linear interpolation
        const a1Sample = this.readWavetable(a1Table, voice.a1Phase + this.params.a1Phase / 360);
        const a2Sample = this.readWavetable(a2Table, voice.a2Phase + this.params.a2Phase / 360);
        const b1Sample = this.readWavetable(b1Table, voice.b1Phase + this.params.b1Phase / 360);
        const b2Sample = this.readWavetable(b2Table, voice.b2Phase + this.params.b2Phase / 360);
        
        // Mix oscillators within groups
        const a1Vol = this.params.a1Vol / 100;
        const a2Vol = this.params.a2Vol / 100;
        const b1Vol = this.params.b1Vol / 100;
        const b2Vol = this.params.b2Vol / 100;
        
        // Group A output (stereo)
        const aOutL = (a1Sample * a1Vol * a1PanL + a2Sample * a2Vol * a2PanL) * voice.envAValue;
        const aOutR = (a1Sample * a1Vol * a1PanR + a2Sample * a2Vol * a2PanR) * voice.envAValue;
        
        // Group B output (stereo)
        const bOutL = (b1Sample * b1Vol * b1PanL + b2Sample * b2Vol * b2PanL) * voice.envBValue;
        const bOutR = (b1Sample * b1Vol * b1PanR + b2Sample * b2Vol * b2PanR) * voice.envBValue;
        
        // Mix A and B with crossfade
        const sampleL = (aOutL * aGain + bOutL * bGain) * velocityGain * 0.25;
        const sampleR = (aOutR * aGain + bOutR * bGain) * velocityGain * 0.25;
        
        outputL[i] += sampleL;
        outputR[i] += sampleR;
        
        // Update phases
        voice.a1Phase = (voice.a1Phase + a1PhaseInc) % 1;
        voice.a2Phase = (voice.a2Phase + a2PhaseInc) % 1;
        voice.b1Phase = (voice.b1Phase + b1PhaseInc) % 1;
        voice.b2Phase = (voice.b2Phase + b2PhaseInc) % 1;
      }
    }
    
    // Remove finished voices
    for (const note of voicesToRemove) {
      this.voices.delete(note);
    }
  }
  
  private getWavetable(index: number): Float32Array {
    const name = WAVETABLE_NAMES[Math.floor(index) % WAVETABLE_NAMES.length];
    return WAVETABLES[name];
  }
  
  private readWavetable(table: Float32Array, phase: number): number {
    // Normalize phase
    phase = phase - Math.floor(phase);
    
    // Calculate position
    const pos = phase * WAVETABLE_SIZE;
    const index = Math.floor(pos);
    const frac = pos - index;
    
    // Linear interpolation
    const sample1 = table[index % WAVETABLE_SIZE];
    const sample2 = table[(index + 1) % WAVETABLE_SIZE];
    
    return sample1 + (sample2 - sample1) * frac;
  }
  
  private updateEnvelopeA(voice: WatsynVoice): void {
    const attack = this.params.envAAttack;
    const decay = this.params.envADecay;
    const sustain = this.params.envASustain / 100;
    const release = this.params.envARelease;
    
    const timeIncrement = 1000 / this.sampleRate; // ms per sample
    
    switch (voice.envAStage) {
      case 'attack':
        voice.envATime += timeIncrement;
        if (attack <= 0) {
          voice.envAValue = 1;
          voice.envAStage = 'decay';
          voice.envATime = 0;
        } else {
          voice.envAValue = Math.min(1, voice.envATime / attack);
          if (voice.envAValue >= 1) {
            voice.envAStage = 'decay';
            voice.envATime = 0;
          }
        }
        break;
        
      case 'decay':
        voice.envATime += timeIncrement;
        if (decay <= 0) {
          voice.envAValue = sustain;
          voice.envAStage = 'sustain';
        } else {
          voice.envAValue = 1 - (1 - sustain) * Math.min(1, voice.envATime / decay);
          if (voice.envATime >= decay) {
            voice.envAStage = 'sustain';
          }
        }
        break;
        
      case 'sustain':
        voice.envAValue = sustain;
        if (voice.released) {
          voice.envAStage = 'release';
          voice.envATime = 0;
        }
        break;
        
      case 'release':
        voice.envATime += timeIncrement;
        if (release <= 0) {
          voice.envAValue = 0;
          voice.envAStage = 'off';
        } else {
          voice.envAValue = sustain * (1 - Math.min(1, voice.envATime / release));
          if (voice.envATime >= release) {
            voice.envAStage = 'off';
            voice.envAValue = 0;
          }
        }
        break;
        
      case 'off':
        voice.envAValue = 0;
        break;
    }
  }
  
  private updateEnvelopeB(voice: WatsynVoice): void {
    const attack = this.params.envBAttack;
    const decay = this.params.envBDecay;
    const sustain = this.params.envBSustain / 100;
    const release = this.params.envBRelease;
    
    const timeIncrement = 1000 / this.sampleRate; // ms per sample
    
    switch (voice.envBStage) {
      case 'attack':
        voice.envBTime += timeIncrement;
        if (attack <= 0) {
          voice.envBValue = 1;
          voice.envBStage = 'decay';
          voice.envBTime = 0;
        } else {
          voice.envBValue = Math.min(1, voice.envBTime / attack);
          if (voice.envBValue >= 1) {
            voice.envBStage = 'decay';
            voice.envBTime = 0;
          }
        }
        break;
        
      case 'decay':
        voice.envBTime += timeIncrement;
        if (decay <= 0) {
          voice.envBValue = sustain;
          voice.envBStage = 'sustain';
        } else {
          voice.envBValue = 1 - (1 - sustain) * Math.min(1, voice.envBTime / decay);
          if (voice.envBTime >= decay) {
            voice.envBStage = 'sustain';
          }
        }
        break;
        
      case 'sustain':
        voice.envBValue = sustain;
        if (voice.released) {
          voice.envBStage = 'release';
          voice.envBTime = 0;
        }
        break;
        
      case 'release':
        voice.envBTime += timeIncrement;
        if (release <= 0) {
          voice.envBValue = 0;
          voice.envBStage = 'off';
        } else {
          voice.envBValue = sustain * (1 - Math.min(1, voice.envBTime / release));
          if (voice.envBTime >= release) {
            voice.envBStage = 'off';
            voice.envBValue = 0;
          }
        }
        break;
        
      case 'off':
        voice.envBValue = 0;
        break;
    }
  }
  
  // BaseInstrument abstract method implementations
  
  protected silenceNote(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
    if (voice) {
      voice.envAStage = 'off';
      voice.envBStage = 'off';
      voice.envAValue = 0;
      voice.envBValue = 0;
    }
  }

  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    const voice: WatsynVoice = {
      note: noteNumber,
      velocity,
      frequency,
      a1Phase: 0,
      a2Phase: 0,
      b1Phase: 0,
      b2Phase: 0,
      envAStage: 'attack',
      envAValue: 0,
      envATime: 0,
      envBStage: 'attack',
      envBValue: 0,
      envBTime: 0,
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
    // Parameters are stored in this.params and used directly in processAudio
  }
  
  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    return [
      // Oscillator A1
      { name: 'A1 Wave', key: 'a1Wave', min: 0, max: 10, default: 0, step: 1, type: 'enum', enumValues: WAVETABLE_NAMES, category: 'Oscillator A1' },
      { name: 'A1 Volume', key: 'a1Vol', min: 0, max: 100, default: 100, unit: '%', category: 'Oscillator A1' },
      { name: 'A1 Pan', key: 'a1Pan', min: -100, max: 100, default: 0, category: 'Oscillator A1' },
      { name: 'A1 Detune', key: 'a1Detune', min: -1200, max: 1200, default: 0, unit: 'cents', category: 'Oscillator A1' },
      { name: 'A1 Phase', key: 'a1Phase', min: 0, max: 360, default: 0, unit: '°', category: 'Oscillator A1' },
      
      // Oscillator A2
      { name: 'A2 Wave', key: 'a2Wave', min: 0, max: 10, default: 2, step: 1, type: 'enum', enumValues: WAVETABLE_NAMES, category: 'Oscillator A2' },
      { name: 'A2 Volume', key: 'a2Vol', min: 0, max: 100, default: 0, unit: '%', category: 'Oscillator A2' },
      { name: 'A2 Pan', key: 'a2Pan', min: -100, max: 100, default: 0, category: 'Oscillator A2' },
      { name: 'A2 Detune', key: 'a2Detune', min: -1200, max: 1200, default: 0, unit: 'cents', category: 'Oscillator A2' },
      { name: 'A2 Phase', key: 'a2Phase', min: 0, max: 360, default: 0, unit: '°', category: 'Oscillator A2' },
      
      // Oscillator B1
      { name: 'B1 Wave', key: 'b1Wave', min: 0, max: 10, default: 3, step: 1, type: 'enum', enumValues: WAVETABLE_NAMES, category: 'Oscillator B1' },
      { name: 'B1 Volume', key: 'b1Vol', min: 0, max: 100, default: 100, unit: '%', category: 'Oscillator B1' },
      { name: 'B1 Pan', key: 'b1Pan', min: -100, max: 100, default: 0, category: 'Oscillator B1' },
      { name: 'B1 Detune', key: 'b1Detune', min: -1200, max: 1200, default: 0, unit: 'cents', category: 'Oscillator B1' },
      { name: 'B1 Phase', key: 'b1Phase', min: 0, max: 360, default: 0, unit: '°', category: 'Oscillator B1' },
      
      // Oscillator B2
      { name: 'B2 Wave', key: 'b2Wave', min: 0, max: 10, default: 1, step: 1, type: 'enum', enumValues: WAVETABLE_NAMES, category: 'Oscillator B2' },
      { name: 'B2 Volume', key: 'b2Vol', min: 0, max: 100, default: 0, unit: '%', category: 'Oscillator B2' },
      { name: 'B2 Pan', key: 'b2Pan', min: -100, max: 100, default: 0, category: 'Oscillator B2' },
      { name: 'B2 Detune', key: 'b2Detune', min: -1200, max: 1200, default: 0, unit: 'cents', category: 'Oscillator B2' },
      { name: 'B2 Phase', key: 'b2Phase', min: 0, max: 360, default: 0, unit: '°', category: 'Oscillator B2' },
      
      // A/B Mix
      { name: 'A/B Mix', key: 'abMix', min: -100, max: 100, default: 0, category: 'Mix' },
      
      // Envelope A
      { name: 'Env A Attack', key: 'envAAttack', min: 0, max: 2000, default: 10, unit: 'ms', category: 'Envelope A' },
      { name: 'Env A Decay', key: 'envADecay', min: 0, max: 2000, default: 100, unit: 'ms', category: 'Envelope A' },
      { name: 'Env A Sustain', key: 'envASustain', min: 0, max: 100, default: 80, unit: '%', category: 'Envelope A' },
      { name: 'Env A Release', key: 'envARelease', min: 0, max: 5000, default: 200, unit: 'ms', category: 'Envelope A' },
      
      // Envelope B
      { name: 'Env B Attack', key: 'envBAttack', min: 0, max: 2000, default: 10, unit: 'ms', category: 'Envelope B' },
      { name: 'Env B Decay', key: 'envBDecay', min: 0, max: 2000, default: 100, unit: 'ms', category: 'Envelope B' },
      { name: 'Env B Sustain', key: 'envBSustain', min: 0, max: 100, default: 80, unit: '%', category: 'Envelope B' },
      { name: 'Env B Release', key: 'envBRelease', min: 0, max: 5000, default: 200, unit: 'ms', category: 'Envelope B' },
    ];
  }
  
  /**
   * Load a custom wavetable
   */
  loadCustomWavetable(name: string, data: Float32Array): void {
    // Resample to WAVETABLE_SIZE if needed
    if (data.length !== WAVETABLE_SIZE) {
      const resampled = new Float32Array(WAVETABLE_SIZE);
      for (let i = 0; i < WAVETABLE_SIZE; i++) {
        const srcPos = (i / WAVETABLE_SIZE) * data.length;
        const srcIndex = Math.floor(srcPos);
        const frac = srcPos - srcIndex;
        resampled[i] = data[srcIndex] + (data[(srcIndex + 1) % data.length] - data[srcIndex]) * frac;
      }
      this.customWavetables.set(name, resampled);
    } else {
      this.customWavetables.set(name, data);
    }
  }
  
  /**
   * Get wavetable data for visualization
   */
  getWavetableData(index: number): Float32Array {
    return this.getWavetable(index);
  }
  
  dispose(): void {
    this.voices.clear();
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    super.dispose();
  }
}

export default Watsyn;