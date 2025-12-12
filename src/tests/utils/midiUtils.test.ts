// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import { describe, it, expect } from 'vitest';
import { 
  parseMidiMessage, 
  createMidiMessage, 
  noteOn, 
  noteOff, 
  MIDI_NOTE_ON, 
  MIDI_NOTE_OFF 
} from '../../utils/midiUtils';

describe('MIDI Utils', () => {
  describe('createMidiMessage', () => {
    it('should create a valid 3-byte MIDI message', () => {
      // Note On, Channel 0, Note 60 (C4), Velocity 100
      const msg = createMidiMessage(MIDI_NOTE_ON, 0, 60, 100);
      expect(msg).toBeInstanceOf(Uint8Array);
      expect(msg.length).toBe(3);
      expect(msg[0]).toBe(0x90); // 144
      expect(msg[1]).toBe(60);
      expect(msg[2]).toBe(100);
    });

    it('should create a valid 2-byte MIDI message', () => {
      // Program Change (0xC0), Channel 1, Program 5
      const msg = createMidiMessage(0xC0, 1, 5);
      expect(msg).toBeInstanceOf(Uint8Array);
      expect(msg.length).toBe(2);
      expect(msg[0]).toBe(0xC1); // 193
      expect(msg[1]).toBe(5);
    });

    it('should clamp data bytes to 7 bits', () => {
      const msg = createMidiMessage(MIDI_NOTE_ON, 0, 128, 255);
      expect(msg[1]).toBe(0); // 128 & 0x7F = 0
      expect(msg[2]).toBe(127); // 255 & 0x7F = 127
    });
  });

  describe('parseMidiMessage', () => {
    it('should parse a valid MIDI message', () => {
      const data = new Uint8Array([0x90, 60, 100]);
      const parsed = parseMidiMessage(data, 12345);
      
      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe(0x90);
      expect(parsed?.channel).toBe(0);
      expect(parsed?.data1).toBe(60);
      expect(parsed?.data2).toBe(100);
      expect(parsed?.timestamp).toBe(12345);
    });

    it('should return null for empty data', () => {
      const parsed = parseMidiMessage(new Uint8Array([]));
      expect(parsed).toBeNull();
    });
  });

  describe('Helper functions', () => {
    it('noteOn should create correct message', () => {
      const msg = noteOn(2, 64, 80);
      expect(msg[0]).toBe(0x92); // 0x90 | 0x02
      expect(msg[1]).toBe(64);
      expect(msg[2]).toBe(80);
    });

    it('noteOff should create correct message', () => {
      const msg = noteOff(5, 70, 0);
      expect(msg[0]).toBe(0x85); // 0x80 | 0x05
      expect(msg[1]).toBe(70);
      expect(msg[2]).toBe(0);
    });
  });
});
