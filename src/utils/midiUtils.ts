// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * MIDI utility functions for AnkhWaveStudio Web
 */

// MIDI message types
export const MIDI_NOTE_OFF = 0x80;
export const MIDI_NOTE_ON = 0x90;
export const MIDI_POLY_AFTERTOUCH = 0xA0;
export const MIDI_CONTROL_CHANGE = 0xB0;
export const MIDI_PROGRAM_CHANGE = 0xC0;
export const MIDI_CHANNEL_AFTERTOUCH = 0xD0;
export const MIDI_PITCH_BEND = 0xE0;
export const MIDI_SYSTEM = 0xF0;

// Common MIDI CC numbers
export const MIDI_CC = {
  BANK_SELECT_MSB: 0,
  MODULATION: 1,
  BREATH: 2,
  FOOT: 4,
  PORTAMENTO_TIME: 5,
  DATA_ENTRY_MSB: 6,
  VOLUME: 7,
  BALANCE: 8,
  PAN: 10,
  EXPRESSION: 11,
  BANK_SELECT_LSB: 32,
  SUSTAIN: 64,
  PORTAMENTO: 65,
  SOSTENUTO: 66,
  SOFT_PEDAL: 67,
  LEGATO: 68,
  HOLD_2: 69,
  ALL_SOUND_OFF: 120,
  RESET_ALL_CONTROLLERS: 121,
  LOCAL_CONTROL: 122,
  ALL_NOTES_OFF: 123,
  OMNI_OFF: 124,
  OMNI_ON: 125,
  MONO_ON: 126,
  POLY_ON: 127,
};

/**
 * MIDI message interface
 */
export interface MidiMessage {
  type: number;
  channel: number;
  data1: number;
  data2: number;
  timestamp: number;
}

/**
 * Parse a MIDI message from raw bytes
 */
export function parseMidiMessage(data: Uint8Array, timestamp: number = 0): MidiMessage | null {
  if (data.length < 1) return null;
  
  const status = data[0];
  const type = status & 0xF0;
  const channel = status & 0x0F;
  
  return {
    type,
    channel,
    data1: data.length > 1 ? data[1] : 0,
    data2: data.length > 2 ? data[2] : 0,
    timestamp,
  };
}

/**
 * Create a MIDI message as Uint8Array
 */
export function createMidiMessage(
  type: number,
  channel: number,
  data1: number,
  data2?: number
): Uint8Array {
  const status = (type & 0xF0) | (channel & 0x0F);
  if (data2 !== undefined) {
    return new Uint8Array([status, data1 & 0x7F, data2 & 0x7F]);
  }
  return new Uint8Array([status, data1 & 0x7F]);
}

/**
 * Create a Note On message
 */
export function noteOn(channel: number, note: number, velocity: number): Uint8Array {
  return createMidiMessage(MIDI_NOTE_ON, channel, note, velocity);
}

/**
 * Create a Note Off message
 */
export function noteOff(channel: number, note: number, velocity: number = 0): Uint8Array {
  return createMidiMessage(MIDI_NOTE_OFF, channel, note, velocity);
}

/**
 * Create a Control Change message
 */
export function controlChange(channel: number, controller: number, value: number): Uint8Array {
  return createMidiMessage(MIDI_CONTROL_CHANGE, channel, controller, value);
}

/**
 * Create a Program Change message
 */
export function programChange(channel: number, program: number): Uint8Array {
  return createMidiMessage(MIDI_PROGRAM_CHANGE, channel, program);
}

/**
 * Create a Pitch Bend message
 * @param value - Pitch bend value from -8192 to 8191 (0 = center)
 */
export function pitchBend(channel: number, value: number): Uint8Array {
  const centered = value + 8192;
  const lsb = centered & 0x7F;
  const msb = (centered >> 7) & 0x7F;
  return createMidiMessage(MIDI_PITCH_BEND, channel, lsb, msb);
}

/**
 * Check if a message is a Note On
 */
export function isNoteOn(message: MidiMessage): boolean {
  return message.type === MIDI_NOTE_ON && message.data2 > 0;
}

/**
 * Check if a message is a Note Off
 */
export function isNoteOff(message: MidiMessage): boolean {
  return message.type === MIDI_NOTE_OFF || 
         (message.type === MIDI_NOTE_ON && message.data2 === 0);
}

/**
 * Check if a message is a Control Change
 */
export function isControlChange(message: MidiMessage): boolean {
  return message.type === MIDI_CONTROL_CHANGE;
}

/**
 * Get MIDI input devices
 */
export async function getMidiInputs(): Promise<MIDIInput[]> {
  if (!navigator.requestMIDIAccess) {
    console.warn('Web MIDI API not supported');
    return [];
  }
  
  try {
    const access = await navigator.requestMIDIAccess();
    return Array.from(access.inputs.values());
  } catch (error) {
    console.error('Failed to get MIDI access:', error);
    return [];
  }
}

/**
 * Get MIDI output devices
 */
export async function getMidiOutputs(): Promise<MIDIOutput[]> {
  if (!navigator.requestMIDIAccess) {
    console.warn('Web MIDI API not supported');
    return [];
  }
  
  try {
    const access = await navigator.requestMIDIAccess();
    return Array.from(access.outputs.values());
  } catch (error) {
    console.error('Failed to get MIDI access:', error);
    return [];
  }
}

/**
 * Convert velocity (0-127) to gain (0-1)
 */
export function velocityToGain(velocity: number): number {
  return velocity / 127;
}

/**
 * Convert gain (0-1) to velocity (0-127)
 */
export function gainToVelocity(gain: number): number {
  return Math.round(gain * 127);
}

/**
 * Quantize a time value to the nearest grid position
 * @param time - Time in beats
 * @param gridSize - Grid size in beats (e.g., 0.25 for 16th notes)
 */
export function quantize(time: number, gridSize: number): number {
  return Math.round(time / gridSize) * gridSize;
}

/**
 * Calculate the duration of a note in beats
 * @param noteValue - Note value (1 = whole, 2 = half, 4 = quarter, etc.)
 * @param dotted - Whether the note is dotted
 * @param triplet - Whether the note is a triplet
 */
export function noteDuration(noteValue: number, dotted: boolean = false, triplet: boolean = false): number {
  let duration = 4 / noteValue; // 4 beats per whole note
  
  if (dotted) {
    duration *= 1.5;
  }
  
  if (triplet) {
    duration *= 2 / 3;
  }
  
  return duration;
}