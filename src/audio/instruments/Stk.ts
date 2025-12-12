// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Stk - Synthesis Toolkit Physical Modeling Instruments
 * Based on the STK (Synthesis Toolkit) by Perry R. Cook and Gary P. Scavone
 * 
 * Features:
 * - Physical modeling instruments
 * - Multiple instrument types (strings, winds, percussion, etc.)
 * - Realistic acoustic simulation
 */

import { BaseInstrument, type InstrumentParameterDescriptor } from './BaseInstrument';
import { clamp } from '../utils/AudioMath';

// ============================================================================
// Types
// ============================================================================

/**
 * STK instrument types
 */
export enum StkInstrumentType {
  BandedWG = 'bandedwg',      // Bowed bar model
  BeeThree = 'beethree',      // FM organ
  BlowBotl = 'blowbotl',      // Bottle model
  BlowHole = 'blowhole',      // Clarinet model
  Bowed = 'bowed',            // Bowed string model
  Brass = 'brass',            // Brass instrument model
  Clarinet = 'clarinet',      // Clarinet model
  Flute = 'flute',            // Flute model
  Mandolin = 'mandolin',      // Mandolin model
  ModalBar = 'modalbar',      // Modal bar model
  Moog = 'moog',              // Moog-style synth
  Plucked = 'plucked',        // Plucked string model
  Resonate = 'resonate',      // Resonance model
  Rhodey = 'rhodey',          // Rhodes piano model
  Saxofony = 'saxofony',      // Saxophone model
  Shakers = 'shakers',        // Shaker model
  Simple = 'simple',          // Simple oscillator
  Sitar = 'sitar',            // Sitar model
  StifKarp = 'stifkarp',      // Stiff string model
  TubeBell = 'tubebell',      // Tubular bell model
  Voicer = 'voicer',          // Voice model
  VoicForm = 'voicform',      // Formant voice model
  Whistle = 'whistle',        // Whistle model
  Wurley = 'wurley'           // Wurlitzer piano model
}

/**
 * STK instrument names for display
 */
export const STK_INSTRUMENT_NAMES: Record<StkInstrumentType, string> = {
  [StkInstrumentType.BandedWG]: 'Banded Waveguide (Bowed Bar)',
  [StkInstrumentType.BeeThree]: 'BeeThree (FM Organ)',
  [StkInstrumentType.BlowBotl]: 'Blown Bottle',
  [StkInstrumentType.BlowHole]: 'Clarinet (BlowHole)',
  [StkInstrumentType.Bowed]: 'Bowed String',
  [StkInstrumentType.Brass]: 'Brass',
  [StkInstrumentType.Clarinet]: 'Clarinet',
  [StkInstrumentType.Flute]: 'Flute',
  [StkInstrumentType.Mandolin]: 'Mandolin',
  [StkInstrumentType.ModalBar]: 'Modal Bar',
  [StkInstrumentType.Moog]: 'Moog Synthesizer',
  [StkInstrumentType.Plucked]: 'Plucked String',
  [StkInstrumentType.Resonate]: 'Resonator',
  [StkInstrumentType.Rhodey]: 'Rhodes Piano',
  [StkInstrumentType.Saxofony]: 'Saxophone',
  [StkInstrumentType.Shakers]: 'Shakers',
  [StkInstrumentType.Simple]: 'Simple Oscillator',
  [StkInstrumentType.Sitar]: 'Sitar',
  [StkInstrumentType.StifKarp]: 'Stiff String (Karplus-Strong)',
  [StkInstrumentType.TubeBell]: 'Tubular Bell',
  [StkInstrumentType.Voicer]: 'Voice',
  [StkInstrumentType.VoicForm]: 'Formant Voice',
  [StkInstrumentType.Whistle]: 'Whistle',
  [StkInstrumentType.Wurley]: 'Wurlitzer Piano'
};

/**
 * Active voice state
 */
interface StkVoice {
  noteNumber: number;
  velocity: number;
  frequency: number;
  startTime: number;
  released: boolean;
  
  // Audio nodes
  oscillators: OscillatorNode[];
  gains: GainNode[];
  filters: BiquadFilterNode[];
  delays: DelayNode[];
  
  // Physical model state
  excitation?: AudioBufferSourceNode;
  resonator?: ConvolverNode;
  
  // Envelope
  envelopeGain: GainNode;
}

// ============================================================================
// Stk Instrument
// ============================================================================

export class Stk extends BaseInstrument {
  // Current instrument type
  private instrumentType: StkInstrumentType = StkInstrumentType.Plucked;
  
  // Active voices
  private stkVoices: Map<number, StkVoice> = new Map();
  
  // Noise buffer for excitation
  private noiseBuffer: AudioBuffer | null = null;
  
  // Impulse responses for resonators
  private impulseResponses: Map<string, AudioBuffer> = new Map();
  
  // Physical model parameters
  private bowPressure: number = 0.5;
  private bowPosition: number = 0.2;
  private breathPressure: number = 0.5;
  private reedStiffness: number = 0.5;
  private pluckPosition: number = 0.4;
  private stringDamping: number = 0.5;
  private stringLoopGain: number = 0.995;
  private vibratoFrequency: number = 5;
  private vibratoGain: number = 0;
  private modIndex: number = 1;
  private modFreqRatio: number = 1;
  
  constructor(audioContext: AudioContext, id: string) {
    super(audioContext, id, 'STK', 'stk');
    
    // Generate noise buffer
    this.generateNoiseBuffer();
    
    // Generate impulse responses
    this.generateImpulseResponses();
    
    // Initialize
    this.initializeInstrument();
  }
  
  /**
   * Generate noise buffer for excitation
   */
  private generateNoiseBuffer(): void {
    const sampleRate = this.audioContext.sampleRate;
    const bufferSize = sampleRate;
    
    this.noiseBuffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  
  /**
   * Generate impulse responses for resonators
   */
  private generateImpulseResponses(): void {
    const sampleRate = this.audioContext.sampleRate;
    
    // String resonance
    const stringIR = this.audioContext.createBuffer(1, sampleRate * 0.5, sampleRate);
    const stringData = stringIR.getChannelData(0);
    for (let i = 0; i < stringData.length; i++) {
      const t = i / sampleRate;
      stringData[i] = Math.exp(-t * 5) * Math.sin(2 * Math.PI * 440 * t);
    }
    this.impulseResponses.set('string', stringIR);
    
    // Tube resonance
    const tubeIR = this.audioContext.createBuffer(1, sampleRate * 0.3, sampleRate);
    const tubeData = tubeIR.getChannelData(0);
    for (let i = 0; i < tubeData.length; i++) {
      const t = i / sampleRate;
      tubeData[i] = Math.exp(-t * 10) * (Math.sin(2 * Math.PI * 220 * t) + 0.5 * Math.sin(2 * Math.PI * 660 * t));
    }
    this.impulseResponses.set('tube', tubeIR);
    
    // Bar resonance
    const barIR = this.audioContext.createBuffer(1, sampleRate * 1, sampleRate);
    const barData = barIR.getChannelData(0);
    for (let i = 0; i < barData.length; i++) {
      const t = i / sampleRate;
      barData[i] = Math.exp(-t * 2) * (
        Math.sin(2 * Math.PI * 440 * t) +
        0.7 * Math.sin(2 * Math.PI * 440 * 2.76 * t) +
        0.5 * Math.sin(2 * Math.PI * 440 * 5.4 * t)
      );
    }
    this.impulseResponses.set('bar', barIR);
  }
  
  /**
   * Set instrument type
   */
  setInstrumentType(type: StkInstrumentType): void {
    this.instrumentType = type;
    this.params['instrumentType'] = Object.values(StkInstrumentType).indexOf(type);
  }
  
  /**
   * Get instrument type
   */
  getInstrumentType(): StkInstrumentType {
    return this.instrumentType;
  }
  
  /**
   * Create Karplus-Strong plucked string model
   */
  private createPluckedString(frequency: number, velocity: number): StkVoice {
    const startTime = this.audioContext.currentTime;
    
    // Calculate delay time for pitch
    const delayTime = 1 / frequency;
    
    // Create noise burst for excitation
    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;
    
    // Excitation envelope (short burst)
    const excitationGain = this.audioContext.createGain();
    excitationGain.gain.setValueAtTime(velocity, startTime);
    excitationGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.01);
    
    // Delay line for string
    const delay = this.audioContext.createDelay(1);
    delay.delayTime.value = delayTime;
    
    // Lowpass filter for damping
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 5000 * (1 - this.stringDamping);
    filter.Q.value = 0.5;
    
    // Feedback gain
    const feedbackGain = this.audioContext.createGain();
    feedbackGain.gain.value = this.stringLoopGain;
    
    // Output envelope
    const envelopeGain = this.audioContext.createGain();
    envelopeGain.gain.value = 1;
    
    // Connect excitation
    noiseSource.connect(excitationGain);
    excitationGain.connect(delay);
    
    // Connect feedback loop
    delay.connect(filter);
    filter.connect(feedbackGain);
    feedbackGain.connect(delay);
    
    // Connect to output
    filter.connect(envelopeGain);
    envelopeGain.connect(this.volumeNode);
    
    // Start
    noiseSource.start(startTime);
    noiseSource.stop(startTime + 0.02);
    
    return {
      noteNumber: 0,
      velocity,
      frequency,
      startTime,
      released: false,
      oscillators: [],
      gains: [excitationGain, feedbackGain],
      filters: [filter],
      delays: [delay],
      excitation: noiseSource,
      envelopeGain
    };
  }
  
  /**
   * Create bowed string model
   */
  private createBowedString(frequency: number, velocity: number): StkVoice {
    const startTime = this.audioContext.currentTime;
    
    // Main oscillator (sawtooth for bowed sound)
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = frequency;
    
    // Bow pressure modulation
    const pressureLfo = this.audioContext.createOscillator();
    pressureLfo.frequency.value = 3 + Math.random() * 2;
    const pressureGain = this.audioContext.createGain();
    pressureGain.gain.value = frequency * 0.01 * this.bowPressure;
    pressureLfo.connect(pressureGain);
    pressureGain.connect(oscillator.frequency);
    
    // Vibrato
    const vibratoLfo = this.audioContext.createOscillator();
    vibratoLfo.frequency.value = this.vibratoFrequency;
    const vibratoGain = this.audioContext.createGain();
    vibratoGain.gain.value = frequency * this.vibratoGain * 0.02;
    vibratoLfo.connect(vibratoGain);
    vibratoGain.connect(oscillator.frequency);
    
    // Body resonance filter
    const bodyFilter = this.audioContext.createBiquadFilter();
    bodyFilter.type = 'peaking';
    bodyFilter.frequency.value = 300;
    bodyFilter.Q.value = 2;
    bodyFilter.gain.value = 6;
    
    // Envelope
    const envelopeGain = this.audioContext.createGain();
    envelopeGain.gain.setValueAtTime(0, startTime);
    envelopeGain.gain.linearRampToValueAtTime(velocity, startTime + 0.1);
    
    // Connect
    oscillator.connect(bodyFilter);
    bodyFilter.connect(envelopeGain);
    envelopeGain.connect(this.volumeNode);
    
    // Start
    oscillator.start(startTime);
    pressureLfo.start(startTime);
    vibratoLfo.start(startTime);
    
    return {
      noteNumber: 0,
      velocity,
      frequency,
      startTime,
      released: false,
      oscillators: [oscillator, pressureLfo, vibratoLfo],
      gains: [pressureGain, vibratoGain],
      filters: [bodyFilter],
      delays: [],
      envelopeGain
    };
  }
  
  /**
   * Create wind instrument model (flute/clarinet)
   */
  private createWindInstrument(frequency: number, velocity: number, type: 'flute' | 'clarinet'): StkVoice {
    const startTime = this.audioContext.currentTime;
    
    // Main oscillator
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = type === 'flute' ? 'sine' : 'square';
    oscillator.frequency.value = frequency;
    
    // Breath noise
    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;
    noiseSource.loop = true;
    
    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = frequency * 2;
    noiseFilter.Q.value = 1;
    
    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.value = this.breathPressure * 0.1;
    
    // Vibrato
    const vibratoLfo = this.audioContext.createOscillator();
    vibratoLfo.frequency.value = this.vibratoFrequency;
    const vibratoGain = this.audioContext.createGain();
    vibratoGain.gain.value = frequency * this.vibratoGain * 0.02;
    vibratoLfo.connect(vibratoGain);
    vibratoGain.connect(oscillator.frequency);
    
    // Tube resonance
    const tubeFilter = this.audioContext.createBiquadFilter();
    tubeFilter.type = 'bandpass';
    tubeFilter.frequency.value = frequency;
    tubeFilter.Q.value = 5;
    
    // Envelope
    const envelopeGain = this.audioContext.createGain();
    envelopeGain.gain.setValueAtTime(0, startTime);
    envelopeGain.gain.linearRampToValueAtTime(velocity, startTime + 0.05);
    
    // Mix
    const mixer = this.audioContext.createGain();
    mixer.gain.value = 1;
    
    // Connect
    oscillator.connect(tubeFilter);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(mixer);
    tubeFilter.connect(mixer);
    mixer.connect(envelopeGain);
    envelopeGain.connect(this.volumeNode);
    
    // Start
    oscillator.start(startTime);
    noiseSource.start(startTime);
    vibratoLfo.start(startTime);
    
    return {
      noteNumber: 0,
      velocity,
      frequency,
      startTime,
      released: false,
      oscillators: [oscillator, vibratoLfo],
      gains: [noiseGain, mixer],
      filters: [noiseFilter, tubeFilter],
      delays: [],
      excitation: noiseSource,
      envelopeGain
    };
  }
  
  /**
   * Create FM synthesis model (Rhodes/Wurley)
   */
  private createFMPiano(frequency: number, velocity: number, type: 'rhodes' | 'wurley'): StkVoice {
    const startTime = this.audioContext.currentTime;
    
    // Carrier oscillator
    const carrier = this.audioContext.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = frequency;
    
    // Modulator oscillator
    const modulator = this.audioContext.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.value = frequency * this.modFreqRatio;
    
    // Modulation depth
    const modGain = this.audioContext.createGain();
    modGain.gain.value = frequency * this.modIndex;
    
    // Modulation envelope
    const modEnvelope = this.audioContext.createGain();
    modEnvelope.gain.setValueAtTime(1, startTime);
    modEnvelope.gain.exponentialRampToValueAtTime(0.1, startTime + (type === 'rhodes' ? 2 : 1));
    
    // Connect modulator to carrier frequency
    modulator.connect(modGain);
    modGain.connect(modEnvelope);
    modEnvelope.connect(carrier.frequency);
    
    // Amplitude envelope
    const envelopeGain = this.audioContext.createGain();
    envelopeGain.gain.setValueAtTime(0, startTime);
    envelopeGain.gain.linearRampToValueAtTime(velocity, startTime + 0.01);
    envelopeGain.gain.exponentialRampToValueAtTime(velocity * 0.7, startTime + 0.1);
    
    // Tremolo for Wurley
    if (type === 'wurley') {
      const tremoloLfo = this.audioContext.createOscillator();
      tremoloLfo.frequency.value = 5;
      const tremoloGain = this.audioContext.createGain();
      tremoloGain.gain.value = 0.1;
      tremoloLfo.connect(tremoloGain);
      tremoloGain.connect(envelopeGain.gain);
      tremoloLfo.start(startTime);
    }
    
    // Connect
    carrier.connect(envelopeGain);
    envelopeGain.connect(this.volumeNode);
    
    // Start
    carrier.start(startTime);
    modulator.start(startTime);
    
    return {
      noteNumber: 0,
      velocity,
      frequency,
      startTime,
      released: false,
      oscillators: [carrier, modulator],
      gains: [modGain],
      filters: [],
      delays: [],
      envelopeGain
    };
  }
  
  /**
   * Create modal bar model (vibraphone, marimba, etc.)
   */
  private createModalBar(frequency: number, velocity: number): StkVoice {
    const startTime = this.audioContext.currentTime;
    
    // Modal ratios for bar
    const modeRatios = [1, 2.76, 5.4, 8.93];
    const modeAmplitudes = [1, 0.7, 0.5, 0.3];
    const modeDecays = [2, 1.5, 1, 0.5];
    
    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    
    // Create oscillator for each mode
    for (let i = 0; i < modeRatios.length; i++) {
      const osc = this.audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency * modeRatios[i];
      
      const gain = this.audioContext.createGain();
      gain.gain.setValueAtTime(velocity * modeAmplitudes[i], startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + modeDecays[i]);
      
      osc.connect(gain);
      oscillators.push(osc);
      gains.push(gain);
    }
    
    // Envelope
    const envelopeGain = this.audioContext.createGain();
    envelopeGain.gain.value = 1;
    
    // Connect all modes to output
    for (const gain of gains) {
      gain.connect(envelopeGain);
    }
    envelopeGain.connect(this.volumeNode);
    
    // Start all oscillators
    for (const osc of oscillators) {
      osc.start(startTime);
    }
    
    return {
      noteNumber: 0,
      velocity,
      frequency,
      startTime,
      released: false,
      oscillators,
      gains,
      filters: [],
      delays: [],
      envelopeGain
    };
  }
  
  /**
   * Create brass model
   */
  private createBrass(frequency: number, velocity: number): StkVoice {
    const startTime = this.audioContext.currentTime;
    
    // Main oscillator (sawtooth for brass)
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = frequency;
    
    // Lip tension modulation
    const lipLfo = this.audioContext.createOscillator();
    lipLfo.frequency.value = 2 + Math.random();
    const lipGain = this.audioContext.createGain();
    lipGain.gain.value = frequency * 0.005;
    lipLfo.connect(lipGain);
    lipGain.connect(oscillator.frequency);
    
    // Vibrato
    const vibratoLfo = this.audioContext.createOscillator();
    vibratoLfo.frequency.value = this.vibratoFrequency;
    const vibratoGain = this.audioContext.createGain();
    vibratoGain.gain.value = frequency * this.vibratoGain * 0.02;
    vibratoLfo.connect(vibratoGain);
    vibratoGain.connect(oscillator.frequency);
    
    // Bell filter
    const bellFilter = this.audioContext.createBiquadFilter();
    bellFilter.type = 'lowpass';
    bellFilter.frequency.setValueAtTime(500, startTime);
    bellFilter.frequency.linearRampToValueAtTime(3000, startTime + 0.1);
    bellFilter.Q.value = 1;
    
    // Envelope
    const envelopeGain = this.audioContext.createGain();
    envelopeGain.gain.setValueAtTime(0, startTime);
    envelopeGain.gain.linearRampToValueAtTime(velocity, startTime + 0.05);
    
    // Connect
    oscillator.connect(bellFilter);
    bellFilter.connect(envelopeGain);
    envelopeGain.connect(this.volumeNode);
    
    // Start
    oscillator.start(startTime);
    lipLfo.start(startTime);
    vibratoLfo.start(startTime);
    
    return {
      noteNumber: 0,
      velocity,
      frequency,
      startTime,
      released: false,
      oscillators: [oscillator, lipLfo, vibratoLfo],
      gains: [lipGain, vibratoGain],
      filters: [bellFilter],
      delays: [],
      envelopeGain
    };
  }
  
  /**
   * Create simple oscillator
   */
  private createSimple(frequency: number, velocity: number): StkVoice {
    const startTime = this.audioContext.currentTime;
    
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    
    const envelopeGain = this.audioContext.createGain();
    envelopeGain.gain.setValueAtTime(0, startTime);
    envelopeGain.gain.linearRampToValueAtTime(velocity, startTime + 0.01);
    
    oscillator.connect(envelopeGain);
    envelopeGain.connect(this.volumeNode);
    
    oscillator.start(startTime);
    
    return {
      noteNumber: 0,
      velocity,
      frequency,
      startTime,
      released: false,
      oscillators: [oscillator],
      gains: [],
      filters: [],
      delays: [],
      envelopeGain
    };
  }
  
  /**
   * Trigger a note
   */
  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    let voice: StkVoice;
    
    switch (this.instrumentType) {
      case StkInstrumentType.Plucked:
      case StkInstrumentType.Mandolin:
      case StkInstrumentType.Sitar:
      case StkInstrumentType.StifKarp:
        voice = this.createPluckedString(frequency, velocity);
        break;
      case StkInstrumentType.Bowed:
        voice = this.createBowedString(frequency, velocity);
        break;
      case StkInstrumentType.Flute:
      case StkInstrumentType.Whistle:
        voice = this.createWindInstrument(frequency, velocity, 'flute');
        break;
      case StkInstrumentType.Clarinet:
      case StkInstrumentType.BlowHole:
      case StkInstrumentType.Saxofony:
        voice = this.createWindInstrument(frequency, velocity, 'clarinet');
        break;
      case StkInstrumentType.Rhodey:
      case StkInstrumentType.BeeThree:
        voice = this.createFMPiano(frequency, velocity, 'rhodes');
        break;
      case StkInstrumentType.Wurley:
        voice = this.createFMPiano(frequency, velocity, 'wurley');
        break;
      case StkInstrumentType.ModalBar:
      case StkInstrumentType.TubeBell:
      case StkInstrumentType.BandedWG:
        voice = this.createModalBar(frequency, velocity);
        break;
      case StkInstrumentType.Brass:
        voice = this.createBrass(frequency, velocity);
        break;
      default:
        voice = this.createSimple(frequency, velocity);
    }
    
    voice.noteNumber = noteNumber;
    this.stkVoices.set(noteNumber, voice);
  }
  
  /**
   * Release a note
   */
  protected releaseNote(noteNumber: number): void {
    const voice = this.stkVoices.get(noteNumber);
    if (!voice || voice.released) return;
    
    voice.released = true;
    const releaseTime = this.audioContext.currentTime;
    
    // Apply release envelope
    voice.envelopeGain.gain.cancelScheduledValues(releaseTime);
    voice.envelopeGain.gain.setValueAtTime(voice.envelopeGain.gain.value, releaseTime);
    voice.envelopeGain.gain.exponentialRampToValueAtTime(0.001, releaseTime + 0.3);
    
    // Schedule cleanup
    setTimeout(() => {
      this.cleanupVoice(noteNumber);
    }, 400);
  }
  
  /**
   * Clean up a voice
   */
  private cleanupVoice(noteNumber: number): void {
    const voice = this.stkVoices.get(noteNumber);
    if (!voice) return;
    
    for (const osc of voice.oscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // Already stopped
      }
    }
    
    if (voice.excitation) {
      try {
        voice.excitation.stop();
        voice.excitation.disconnect();
      } catch (e) {
        // Already stopped
      }
    }
    
    for (const gain of voice.gains) {
      gain.disconnect();
    }
    
    for (const filter of voice.filters) {
      filter.disconnect();
    }
    
    for (const delay of voice.delays) {
      delay.disconnect();
    }
    
    voice.envelopeGain.disconnect();
    
    this.stkVoices.delete(noteNumber);
  }
  
  /**
   * Handle parameter change
   */
  protected onParameterChange(key: string, value: number): void {
    switch (key) {
      case 'instrumentType':
        const types = Object.values(StkInstrumentType);
        if (value >= 0 && value < types.length) {
          this.instrumentType = types[Math.floor(value)];
        }
        break;
      case 'bowPressure':
        this.bowPressure = value;
        break;
      case 'bowPosition':
        this.bowPosition = value;
        break;
      case 'breathPressure':
        this.breathPressure = value;
        break;
      case 'reedStiffness':
        this.reedStiffness = value;
        break;
      case 'pluckPosition':
        this.pluckPosition = value;
        break;
      case 'stringDamping':
        this.stringDamping = value;
        break;
      case 'stringLoopGain':
        this.stringLoopGain = value;
        break;
      case 'vibratoFrequency':
        this.vibratoFrequency = value;
        break;
      case 'vibratoGain':
        this.vibratoGain = value;
        break;
      case 'modIndex':
        this.modIndex = value;
        break;
      case 'modFreqRatio':
        this.modFreqRatio = value;
        break;
    }
  }
  
  /**
   * Initialize instrument
   */
  protected initializeInstrument(): void {
    this.params['instrumentType'] = 0;
    this.params['bowPressure'] = this.bowPressure;
    this.params['bowPosition'] = this.bowPosition;
    this.params['breathPressure'] = this.breathPressure;
    this.params['reedStiffness'] = this.reedStiffness;
    this.params['pluckPosition'] = this.pluckPosition;
    this.params['stringDamping'] = this.stringDamping;
    this.params['stringLoopGain'] = this.stringLoopGain;
    this.params['vibratoFrequency'] = this.vibratoFrequency;
    this.params['vibratoGain'] = this.vibratoGain;
    this.params['modIndex'] = this.modIndex;
    this.params['modFreqRatio'] = this.modFreqRatio;
  }
  
  /**
   * Get parameter descriptors
   */
  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    return [
      { name: 'Instrument Type', key: 'instrumentType', min: 0, max: 23, default: 0, step: 1, type: 'enum',
        enumValues: Object.values(STK_INSTRUMENT_NAMES), category: 'Instrument' },
      
      // Bowed string parameters
      { name: 'Bow Pressure', key: 'bowPressure', min: 0, max: 1, default: 0.5, category: 'Bowed' },
      { name: 'Bow Position', key: 'bowPosition', min: 0, max: 1, default: 0.2, category: 'Bowed' },
      
      // Wind parameters
      { name: 'Breath Pressure', key: 'breathPressure', min: 0, max: 1, default: 0.5, category: 'Wind' },
      { name: 'Reed Stiffness', key: 'reedStiffness', min: 0, max: 1, default: 0.5, category: 'Wind' },
      
      // Plucked string parameters
      { name: 'Pluck Position', key: 'pluckPosition', min: 0, max: 1, default: 0.4, category: 'Plucked' },
      { name: 'String Damping', key: 'stringDamping', min: 0, max: 1, default: 0.5, category: 'Plucked' },
      { name: 'String Loop Gain', key: 'stringLoopGain', min: 0.9, max: 0.9999, default: 0.995, category: 'Plucked' },
      
      // Vibrato
      { name: 'Vibrato Frequency', key: 'vibratoFrequency', min: 0.1, max: 20, default: 5, unit: 'Hz', category: 'Vibrato' },
      { name: 'Vibrato Gain', key: 'vibratoGain', min: 0, max: 1, default: 0, category: 'Vibrato' },
      
      // FM parameters
      { name: 'Mod Index', key: 'modIndex', min: 0, max: 10, default: 1, category: 'FM' },
      { name: 'Mod Freq Ratio', key: 'modFreqRatio', min: 0.5, max: 8, default: 1, category: 'FM' }
    ];
  }
  
  /**
   * Dispose
   */
  dispose(): void {
    for (const noteNumber of this.stkVoices.keys()) {
      this.cleanupVoice(noteNumber);
    }
    super.dispose();
  }
}

// Factory function
export function createStk(audioContext: AudioContext, id?: string): Stk {
  return new Stk(audioContext, id || `stk-${Date.now()}`);
}