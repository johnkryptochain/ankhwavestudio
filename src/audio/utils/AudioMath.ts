// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * AudioMath - Audio utility functions for AnkhWaveStudio Web
 * Provides common audio calculations and conversions
 */

// Constants
export const A4_FREQUENCY = 440;
export const A4_MIDI_NOTE = 69;
export const SEMITONES_PER_OCTAVE = 12;
export const CENTS_PER_SEMITONE = 100;
export const CENTS_PER_OCTAVE = SEMITONES_PER_OCTAVE * CENTS_PER_SEMITONE;

// Reference values for dB calculations
const DB_REFERENCE = 1.0;
const MIN_DB = -100;
const MAX_DB = 12;

/**
 * Convert decibels to linear gain
 * @param dB - Value in decibels
 * @returns Linear gain value (0 to ~4 for typical range)
 */
export function dBToLinear(dB: number): number {
  if (dB <= MIN_DB) return 0;
  return Math.pow(10, dB / 20);
}

/**
 * Convert linear gain to decibels
 * @param linear - Linear gain value
 * @returns Value in decibels
 */
export function linearToDb(linear: number): number {
  if (linear <= 0) return MIN_DB;
  const dB = 20 * Math.log10(linear / DB_REFERENCE);
  return Math.max(MIN_DB, Math.min(MAX_DB, dB));
}

/**
 * Convert MIDI note number to frequency in Hz
 * @param midiNote - MIDI note number (0-127)
 * @returns Frequency in Hz
 */
export function midiNoteToFrequency(midiNote: number): number {
  return A4_FREQUENCY * Math.pow(2, (midiNote - A4_MIDI_NOTE) / SEMITONES_PER_OCTAVE);
}

/**
 * Convert frequency in Hz to MIDI note number
 * @param frequency - Frequency in Hz
 * @returns MIDI note number (may be fractional)
 */
export function frequencyToMidiNote(frequency: number): number {
  if (frequency <= 0) return 0;
  return A4_MIDI_NOTE + SEMITONES_PER_OCTAVE * Math.log2(frequency / A4_FREQUENCY);
}

/**
 * Convert cents to frequency ratio
 * @param cents - Value in cents (100 cents = 1 semitone)
 * @returns Frequency ratio
 */
export function centsToRatio(cents: number): number {
  return Math.pow(2, cents / CENTS_PER_OCTAVE);
}

/**
 * Convert frequency ratio to cents
 * @param ratio - Frequency ratio
 * @returns Value in cents
 */
export function ratioToCents(ratio: number): number {
  if (ratio <= 0) return 0;
  return CENTS_PER_OCTAVE * Math.log2(ratio);
}

/**
 * Convert semitones to frequency ratio
 * @param semitones - Number of semitones
 * @returns Frequency ratio
 */
export function semitonesToRatio(semitones: number): number {
  return Math.pow(2, semitones / SEMITONES_PER_OCTAVE);
}

/**
 * Convert frequency ratio to semitones
 * @param ratio - Frequency ratio
 * @returns Number of semitones
 */
export function ratioToSemitones(ratio: number): number {
  if (ratio <= 0) return 0;
  return SEMITONES_PER_OCTAVE * Math.log2(ratio);
}

/**
 * Get note name from MIDI note number
 * @param midiNote - MIDI note number (0-127)
 * @returns Note name (e.g., "C4", "A#3")
 */
export function midiNoteToName(midiNote: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNote / SEMITONES_PER_OCTAVE) - 1;
  const noteName = noteNames[midiNote % SEMITONES_PER_OCTAVE];
  return `${noteName}${octave}`;
}

/**
 * Parse note name to MIDI note number
 * @param noteName - Note name (e.g., "C4", "A#3", "Bb2")
 * @returns MIDI note number or -1 if invalid
 */
export function noteNameToMidi(noteName: string): number {
  const noteMap: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4, 'E#': 5, 'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11, 'B#': 0
  };
  
  const match = noteName.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) return -1;
  
  const note = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const octave = parseInt(match[2], 10);
  
  const noteValue = noteMap[note];
  if (noteValue === undefined) return -1;
  
  return (octave + 1) * SEMITONES_PER_OCTAVE + noteValue;
}

/**
 * Clamp a value between min and max
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between two values
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated value
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Exponential interpolation between two values (useful for frequency/gain)
 * @param a - Start value (must be > 0)
 * @param b - End value (must be > 0)
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated value
 */
export function expInterp(a: number, b: number, t: number): number {
  if (a <= 0 || b <= 0) return lerp(a, b, t);
  return a * Math.pow(b / a, t);
}

/**
 * Smooth step function (ease in/out)
 * @param t - Input value (0-1)
 * @returns Smoothed value (0-1)
 */
export function smoothStep(t: number): number {
  const clamped = clamp(t, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Smoother step function (Ken Perlin's improved version)
 * @param t - Input value (0-1)
 * @returns Smoothed value (0-1)
 */
export function smootherStep(t: number): number {
  const clamped = clamp(t, 0, 1);
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

/**
 * Calculate RMS (Root Mean Square) of an audio buffer
 * @param buffer - Audio sample buffer
 * @returns RMS value
 */
export function calculateRMS(buffer: Float32Array): number {
  if (buffer.length === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

/**
 * Calculate peak level of an audio buffer
 * @param buffer - Audio sample buffer
 * @returns Peak value (absolute)
 */
export function calculatePeak(buffer: Float32Array): number {
  if (buffer.length === 0) return 0;
  
  let peak = 0;
  for (let i = 0; i < buffer.length; i++) {
    const abs = Math.abs(buffer[i]);
    if (abs > peak) peak = abs;
  }
  return peak;
}

/**
 * Apply soft clipping to a sample (tanh-based)
 * @param sample - Input sample
 * @param drive - Drive amount (1 = no drive, higher = more saturation)
 * @returns Clipped sample
 */
export function softClip(sample: number, drive: number = 1): number {
  return Math.tanh(sample * drive);
}

/**
 * Apply hard clipping to a sample
 * @param sample - Input sample
 * @param threshold - Clipping threshold (default 1.0)
 * @returns Clipped sample
 */
export function hardClip(sample: number, threshold: number = 1): number {
  return clamp(sample, -threshold, threshold);
}

/**
 * Create a parameter ramp helper for smooth automation
 */
export class ParameterRamp {
  private currentValue: number;
  private targetValue: number;
  private rampTime: number;
  private rampProgress: number;
  private isRamping: boolean;

  constructor(initialValue: number = 0) {
    this.currentValue = initialValue;
    this.targetValue = initialValue;
    this.rampTime = 0;
    this.rampProgress = 0;
    this.isRamping = false;
  }

  /**
   * Set target value with ramp time
   * @param target - Target value
   * @param timeInSeconds - Ramp time in seconds
   */
  setTarget(target: number, timeInSeconds: number): void {
    if (timeInSeconds <= 0) {
      this.currentValue = target;
      this.targetValue = target;
      this.isRamping = false;
      return;
    }
    
    this.targetValue = target;
    this.rampTime = timeInSeconds;
    this.rampProgress = 0;
    this.isRamping = true;
  }

  /**
   * Set value immediately without ramping
   * @param value - New value
   */
  setValue(value: number): void {
    this.currentValue = value;
    this.targetValue = value;
    this.isRamping = false;
  }

  /**
   * Process one sample of the ramp
   * @param sampleRate - Audio sample rate
   * @returns Current value
   */
  process(sampleRate: number): number {
    if (!this.isRamping) {
      return this.currentValue;
    }

    const increment = 1 / (this.rampTime * sampleRate);
    this.rampProgress += increment;

    if (this.rampProgress >= 1) {
      this.currentValue = this.targetValue;
      this.isRamping = false;
    } else {
      // Use smoothstep for natural-sounding ramps
      const t = smoothStep(this.rampProgress);
      this.currentValue = lerp(this.currentValue, this.targetValue, t * increment * sampleRate);
    }

    return this.currentValue;
  }

  /**
   * Get current value without processing
   */
  getValue(): number {
    return this.currentValue;
  }

  /**
   * Check if currently ramping
   */
  getIsRamping(): boolean {
    return this.isRamping;
  }
}

/**
 * One-pole lowpass filter for smoothing parameters
 * Useful for avoiding zipper noise in parameter changes
 */
export class OnePoleLowpass {
  private z1: number = 0;
  private a0: number = 1;
  private b1: number = 0;

  constructor(cutoffHz: number = 10, sampleRate: number = 44100) {
    this.setCutoff(cutoffHz, sampleRate);
  }

  /**
   * Set the cutoff frequency
   * @param cutoffHz - Cutoff frequency in Hz
   * @param sampleRate - Sample rate
   */
  setCutoff(cutoffHz: number, sampleRate: number): void {
    const fc = cutoffHz / sampleRate;
    this.b1 = Math.exp(-2 * Math.PI * fc);
    this.a0 = 1 - this.b1;
  }

  /**
   * Process a single sample
   * @param input - Input sample
   * @returns Filtered output
   */
  process(input: number): number {
    this.z1 = input * this.a0 + this.z1 * this.b1;
    return this.z1;
  }

  /**
   * Reset the filter state
   * @param value - Initial value (default 0)
   */
  reset(value: number = 0): void {
    this.z1 = value;
  }
}

/**
 * DC blocker filter to remove DC offset from audio
 */
export class DCBlocker {
  private x1: number = 0;
  private y1: number = 0;
  private coefficient: number;

  constructor(coefficient: number = 0.995) {
    this.coefficient = coefficient;
  }

  /**
   * Process a single sample
   * @param input - Input sample
   * @returns Output with DC removed
   */
  process(input: number): number {
    const output = input - this.x1 + this.coefficient * this.y1;
    this.x1 = input;
    this.y1 = output;
    return output;
  }

  /**
   * Reset the filter state
   */
  reset(): void {
    this.x1 = 0;
    this.y1 = 0;
  }
}

/**
 * Convert BPM and note value to milliseconds
 * @param bpm - Beats per minute
 * @param noteValue - Note value (1 = whole, 0.5 = half, 0.25 = quarter, etc.)
 * @returns Duration in milliseconds
 */
export function bpmToMs(bpm: number, noteValue: number = 0.25): number {
  const msPerBeat = 60000 / bpm;
  return msPerBeat * (noteValue * 4);
}

/**
 * Convert BPM and note value to samples
 * @param bpm - Beats per minute
 * @param sampleRate - Sample rate
 * @param noteValue - Note value (1 = whole, 0.5 = half, 0.25 = quarter, etc.)
 * @returns Duration in samples
 */
export function bpmToSamples(bpm: number, sampleRate: number, noteValue: number = 0.25): number {
  const seconds = (60 / bpm) * (noteValue * 4);
  return Math.round(seconds * sampleRate);
}

/**
 * Quantize a value to the nearest step
 * @param value - Value to quantize
 * @param step - Step size
 * @returns Quantized value
 */
export function quantize(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/**
 * Map a value from one range to another
 * @param value - Input value
 * @param inMin - Input range minimum
 * @param inMax - Input range maximum
 * @param outMin - Output range minimum
 * @param outMax - Output range maximum
 * @returns Mapped value
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

/**
 * Calculate equal power crossfade gains
 * @param position - Crossfade position (0 = full A, 1 = full B)
 * @returns [gainA, gainB] tuple
 */
export function equalPowerCrossfade(position: number): [number, number] {
  const clamped = clamp(position, 0, 1);
  const angle = clamped * Math.PI * 0.5;
  return [Math.cos(angle), Math.sin(angle)];
}