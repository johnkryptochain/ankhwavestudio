// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Audio utility functions for AnkhWaveStudio Web
 */

/**
 * Convert decibels to linear gain
 */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Convert linear gain to decibels
 */
export function gainToDb(gain: number): number {
  if (gain <= 0) return -Infinity;
  return 20 * Math.log10(gain);
}

/**
 * Convert MIDI note number to frequency (Hz)
 * A4 (MIDI note 69) = 440 Hz
 */
export function midiToFrequency(midiNote: number, tuning: number = 440): number {
  return tuning * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * Convert frequency (Hz) to MIDI note number
 */
export function frequencyToMidi(frequency: number, tuning: number = 440): number {
  return 69 + 12 * Math.log2(frequency / tuning);
}

/**
 * Convert MIDI note number to note name
 */
export function midiToNoteName(midiNote: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteName = noteNames[midiNote % 12];
  return `${noteName}${octave}`;
}

/**
 * Convert note name to MIDI note number
 */
export function noteNameToMidi(noteName: string): number {
  const noteMap: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  };
  
  const match = noteName.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) return -1;
  
  const note = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const octave = parseInt(match[2], 10);
  
  const noteValue = noteMap[note];
  if (noteValue === undefined) return -1;
  
  return (octave + 1) * 12 + noteValue;
}

/**
 * Convert beats to seconds
 */
export function beatsToSeconds(beats: number, tempo: number): number {
  return (beats * 60) / tempo;
}

/**
 * Convert seconds to beats
 */
export function secondsToBeats(seconds: number, tempo: number): number {
  return (seconds * tempo) / 60;
}

/**
 * Convert bars to beats
 */
export function barsToBeats(bars: number, beatsPerBar: number = 4): number {
  return bars * beatsPerBar;
}

/**
 * Convert beats to bars
 */
export function beatsToBar(beats: number, beatsPerBar: number = 4): number {
  return beats / beatsPerBar;
}

/**
 * Format time as MM:SS.mmm
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Format position as BAR:BEAT:TICK
 */
export function formatPosition(beats: number, beatsPerBar: number = 4, ticksPerBeat: number = 480): string {
  const totalTicks = beats * ticksPerBeat;
  const bar = Math.floor(totalTicks / (beatsPerBar * ticksPerBeat)) + 1;
  const beat = Math.floor((totalTicks % (beatsPerBar * ticksPerBeat)) / ticksPerBeat) + 1;
  const tick = Math.floor(totalTicks % ticksPerBeat);
  return `${bar}:${beat}:${tick.toString().padStart(3, '0')}`;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Map a value from one range to another
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
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create an audio buffer from an array of samples
 */
export function createAudioBuffer(
  context: AudioContext,
  samples: Float32Array[],
  sampleRate?: number
): AudioBuffer {
  const numChannels = samples.length;
  const length = samples[0].length;
  const buffer = context.createBuffer(numChannels, length, sampleRate || context.sampleRate);
  
  for (let channel = 0; channel < numChannels; channel++) {
    // Create a new Float32Array with explicit ArrayBuffer to satisfy TypeScript
    const channelData = new Float32Array(samples[channel]);
    buffer.copyToChannel(channelData, channel);
  }
  
  return buffer;
}

/**
 * Normalize audio samples to a target peak level
 */
export function normalizeAudio(samples: Float32Array, targetPeak: number = 1.0): Float32Array {
  let maxPeak = 0;
  for (let i = 0; i < samples.length; i++) {
    maxPeak = Math.max(maxPeak, Math.abs(samples[i]));
  }
  
  if (maxPeak === 0) return samples;
  
  const scale = targetPeak / maxPeak;
  const normalized = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    normalized[i] = samples[i] * scale;
  }
  
  return normalized;
}

/**
 * Apply a fade in/out to audio samples
 */
export function applyFade(
  samples: Float32Array,
  fadeInSamples: number,
  fadeOutSamples: number
): Float32Array {
  const result = new Float32Array(samples);
  
  // Fade in
  for (let i = 0; i < fadeInSamples && i < result.length; i++) {
    result[i] *= i / fadeInSamples;
  }
  
  // Fade out
  for (let i = 0; i < fadeOutSamples && i < result.length; i++) {
    const idx = result.length - 1 - i;
    result[idx] *= i / fadeOutSamples;
  }
  
  return result;
}