// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Kicker - Kick drum synthesizer with pitch envelope
 * Based on the original AnkhWaveStudio Kicker plugin
 * 
 * Features:
 * - Sine wave oscillator with pitch envelope
 * - Start and end frequency control
 * - Decay time control
 * - Distortion
 * - Click on/off
 * - Linear/exponential slope
 */

import { BaseInstrument, InstrumentParameterDescriptor, InstrumentPreset } from './BaseInstrument';
import { clamp, midiNoteToFrequency } from '../utils/AudioMath';

interface KickerVoice {
  oscillator: OscillatorNode;
  gainNode: GainNode;
  distortionNode: WaveShaperNode;
  clickOscillator: OscillatorNode | null;
  clickGain: GainNode | null;
  noteNumber: number;
  startTime: number;
}

/**
 * Kicker - Kick drum synthesizer
 */
export class Kicker extends BaseInstrument {
  private voices: Map<number, KickerVoice> = new Map();
  private distortionCurve: Float32Array<ArrayBuffer>;

  constructor(audioContext: AudioContext, id: string, name: string = 'Kicker') {
    super(audioContext, id, name, 'kicker');
    this.distortionCurve = this.createDistortionCurve(0);
    this.initializeInstrument();
    this.addDefaultPresets();
  }

  protected initializeInstrument(): void {
    // Initialize default parameters
    this.params = {
      startFreq: 400,      // Start frequency in Hz (20-20000)
      endFreq: 40,         // End frequency in Hz (20-20000)
      decay: 0.2,          // Decay time in seconds (0.01-2)
      distortion: 0,       // Distortion amount (0-1)
      click: 1,            // Click on/off (0 or 1)
      clickFreq: 1500,     // Click frequency in Hz
      clickDuration: 0.01, // Click duration in seconds
      slope: 0,            // Slope type: 0 = exponential, 1 = linear
      gain: 0.8,           // Output gain (0-1)
      noteTracking: 0,     // Note tracking amount (0-1)
    };
    
    // Kicker doesn't use traditional ADSR envelope
    this.envelope = {
      attack: 0.001,
      decay: 0.2,
      sustain: 0,
      release: 0.01,
    };
  }

  getParameterDescriptors(): InstrumentParameterDescriptor[] {
    return [
      {
        name: 'Start Frequency',
        key: 'startFreq',
        min: 20,
        max: 20000,
        default: 400,
        unit: 'Hz',
        type: 'logarithmic',
        category: 'Pitch',
      },
      {
        name: 'End Frequency',
        key: 'endFreq',
        min: 20,
        max: 20000,
        default: 40,
        unit: 'Hz',
        type: 'logarithmic',
        category: 'Pitch',
      },
      {
        name: 'Decay',
        key: 'decay',
        min: 0.01,
        max: 2,
        default: 0.2,
        unit: 's',
        type: 'logarithmic',
        category: 'Envelope',
      },
      {
        name: 'Distortion',
        key: 'distortion',
        min: 0,
        max: 1,
        default: 0,
        category: 'Tone',
      },
      {
        name: 'Click',
        key: 'click',
        min: 0,
        max: 1,
        default: 1,
        type: 'boolean',
        category: 'Tone',
      },
      {
        name: 'Click Frequency',
        key: 'clickFreq',
        min: 500,
        max: 5000,
        default: 1500,
        unit: 'Hz',
        category: 'Tone',
      },
      {
        name: 'Click Duration',
        key: 'clickDuration',
        min: 0.001,
        max: 0.05,
        default: 0.01,
        unit: 's',
        category: 'Tone',
      },
      {
        name: 'Slope',
        key: 'slope',
        min: 0,
        max: 1,
        default: 0,
        type: 'enum',
        enumValues: ['Exponential', 'Linear'],
        category: 'Pitch',
      },
      {
        name: 'Gain',
        key: 'gain',
        min: 0,
        max: 1,
        default: 0.8,
        category: 'Output',
      },
      {
        name: 'Note Tracking',
        key: 'noteTracking',
        min: 0,
        max: 1,
        default: 0,
        category: 'Pitch',
      },
    ];
  }

  protected onParameterChange(key: string, value: number): void {
    if (key === 'distortion') {
      this.distortionCurve = this.createDistortionCurve(value);
      // Update existing voices
      for (const voice of this.voices.values()) {
        voice.distortionNode.curve = this.distortionCurve;
      }
    }
  }

  protected triggerNote(noteNumber: number, frequency: number, velocity: number): void {
    // Stop existing voice for this note
    if (this.voices.has(noteNumber)) {
      this.releaseNote(noteNumber);
    }

    const t = this.audioContext.currentTime;
    const decay = this.params.decay;
    
    // Calculate frequencies with optional note tracking
    let startFreq = this.params.startFreq;
    let endFreq = this.params.endFreq;
    
    if (this.params.noteTracking > 0) {
      // Apply note tracking - shift frequencies based on MIDI note
      const baseNote = 36; // C2 as reference
      const semitoneShift = noteNumber - baseNote;
      const ratio = Math.pow(2, (semitoneShift * this.params.noteTracking) / 12);
      startFreq *= ratio;
      endFreq *= ratio;
    }
    
    // Clamp frequencies to valid range
    startFreq = clamp(startFreq, 20, 20000);
    endFreq = clamp(endFreq, 20, 20000);

    // Create main oscillator
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = 'sine';
    
    // Apply pitch envelope
    oscillator.frequency.setValueAtTime(startFreq, t);
    
    if (this.params.slope < 0.5) {
      // Exponential slope (more natural for kicks)
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(endFreq, 0.01), // Prevent 0 frequency
        t + decay
      );
    } else {
      // Linear slope
      oscillator.frequency.linearRampToValueAtTime(endFreq, t + decay);
    }

    // Create gain node for amplitude envelope
    const gainNode = this.audioContext.createGain();
    const outputGain = this.params.gain * velocity;
    gainNode.gain.setValueAtTime(outputGain, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + decay);

    // Create distortion node
    const distortionNode = this.audioContext.createWaveShaper();
    distortionNode.curve = this.distortionCurve;
    distortionNode.oversample = '2x';

    // Connect main oscillator chain
    oscillator.connect(distortionNode);
    distortionNode.connect(gainNode);
    gainNode.connect(this.volumeNode);

    // Start oscillator
    oscillator.start(t);
    oscillator.stop(t + decay + 0.1);

    // Create click if enabled
    let clickOscillator: OscillatorNode | null = null;
    let clickGain: GainNode | null = null;
    
    if (this.params.click > 0.5) {
      clickOscillator = this.audioContext.createOscillator();
      clickOscillator.type = 'square';
      clickOscillator.frequency.setValueAtTime(this.params.clickFreq, t);
      
      clickGain = this.audioContext.createGain();
      const clickDuration = this.params.clickDuration;
      clickGain.gain.setValueAtTime(outputGain * 0.5, t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + clickDuration);
      
      clickOscillator.connect(clickGain);
      clickGain.connect(this.volumeNode);
      
      clickOscillator.start(t);
      clickOscillator.stop(t + clickDuration + 0.01);
    }

    // Store voice
    const voice: KickerVoice = {
      oscillator,
      gainNode,
      distortionNode,
      clickOscillator,
      clickGain,
      noteNumber,
      startTime: t,
    };
    this.voices.set(noteNumber, voice);

    // Clean up after decay
    setTimeout(() => {
      this.cleanupVoice(noteNumber);
    }, (decay + 0.2) * 1000);
  }

  protected releaseNote(noteNumber: number): void {
    // Kicker is a one-shot instrument, so release just cleans up
    this.cleanupVoice(noteNumber);
  }

  private cleanupVoice(noteNumber: number): void {
    const voice = this.voices.get(noteNumber);
    if (!voice) return;

    try {
      voice.oscillator.stop();
      voice.oscillator.disconnect();
    } catch {
      // Already stopped
    }

    try {
      voice.gainNode.disconnect();
      voice.distortionNode.disconnect();
    } catch {
      // Already disconnected
    }

    if (voice.clickOscillator) {
      try {
        voice.clickOscillator.stop();
        voice.clickOscillator.disconnect();
      } catch {
        // Already stopped
      }
    }

    if (voice.clickGain) {
      try {
        voice.clickGain.disconnect();
      } catch {
        // Already disconnected
      }
    }

    this.voices.delete(noteNumber);
  }

  /**
   * Create a distortion curve for the waveshaper
   */
  private createDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const samples = 44100;
    const curve = new Float32Array(samples) as Float32Array<ArrayBuffer>;
    const deg = Math.PI / 180;
    
    if (amount === 0) {
      // Linear (no distortion)
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = x;
      }
    } else {
      // Soft clipping distortion
      const k = amount * 100;
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
    }
    
    return curve;
  }

  private addDefaultPresets(): void {
    const presets: InstrumentPreset[] = [
      {
        name: 'Classic 808',
        params: {
          startFreq: 300,
          endFreq: 35,
          decay: 0.3,
          distortion: 0.1,
          click: 0,
          slope: 0,
          gain: 0.8,
        },
      },
      {
        name: 'Punchy Kick',
        params: {
          startFreq: 500,
          endFreq: 50,
          decay: 0.15,
          distortion: 0.2,
          click: 1,
          clickFreq: 2000,
          clickDuration: 0.008,
          slope: 0,
          gain: 0.85,
        },
      },
      {
        name: 'Sub Bass',
        params: {
          startFreq: 100,
          endFreq: 30,
          decay: 0.5,
          distortion: 0,
          click: 0,
          slope: 0,
          gain: 0.9,
        },
      },
      {
        name: 'Techno Kick',
        params: {
          startFreq: 800,
          endFreq: 45,
          decay: 0.2,
          distortion: 0.3,
          click: 1,
          clickFreq: 3000,
          clickDuration: 0.005,
          slope: 0,
          gain: 0.8,
        },
      },
      {
        name: 'Soft Kick',
        params: {
          startFreq: 200,
          endFreq: 40,
          decay: 0.25,
          distortion: 0,
          click: 0,
          slope: 1,
          gain: 0.7,
        },
      },
      {
        name: 'Distorted',
        params: {
          startFreq: 400,
          endFreq: 50,
          decay: 0.18,
          distortion: 0.6,
          click: 1,
          clickFreq: 1500,
          slope: 0,
          gain: 0.75,
        },
      },
      {
        name: 'Boomy',
        params: {
          startFreq: 250,
          endFreq: 25,
          decay: 0.6,
          distortion: 0.15,
          click: 0,
          slope: 0,
          gain: 0.85,
        },
      },
      {
        name: 'Clicky',
        params: {
          startFreq: 600,
          endFreq: 60,
          decay: 0.12,
          distortion: 0.1,
          click: 1,
          clickFreq: 4000,
          clickDuration: 0.015,
          slope: 0,
          gain: 0.8,
        },
      },
    ];

    for (const preset of presets) {
      this.addPreset(preset);
    }
  }

  dispose(): void {
    for (const voice of this.voices.values()) {
      try {
        voice.oscillator.stop();
        voice.oscillator.disconnect();
        voice.gainNode.disconnect();
        voice.distortionNode.disconnect();
        if (voice.clickOscillator) {
          voice.clickOscillator.stop();
          voice.clickOscillator.disconnect();
        }
        if (voice.clickGain) {
          voice.clickGain.disconnect();
        }
      } catch {
        // Ignore cleanup errors
      }
    }
    this.voices.clear();
    super.dispose();
  }
}