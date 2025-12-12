// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import { describe, it, expect } from 'vitest';
import { dbToGain, gainToDb, midiToFrequency, frequencyToMidi, midiToNoteName } from '../../utils/audioUtils';

describe('Audio Utils', () => {
  describe('dbToGain', () => {
    it('should convert 0 dB to 1.0 gain', () => {
      expect(dbToGain(0)).toBe(1.0);
    });

    it('should convert -6 dB to approx 0.5 gain', () => {
      expect(dbToGain(-6.0206)).toBeCloseTo(0.5, 4);
    });

    it('should convert -20 dB to 0.1 gain', () => {
      expect(dbToGain(-20)).toBe(0.1);
    });
  });

  describe('gainToDb', () => {
    it('should convert 1.0 gain to 0 dB', () => {
      expect(gainToDb(1.0)).toBe(0);
    });

    it('should convert 0.5 gain to approx -6 dB', () => {
      expect(gainToDb(0.5)).toBeCloseTo(-6.0206, 4);
    });

    it('should convert 0 gain to -Infinity dB', () => {
      expect(gainToDb(0)).toBe(-Infinity);
    });
  });

  describe('midiToFrequency', () => {
    it('should convert MIDI 69 (A4) to 440 Hz', () => {
      expect(midiToFrequency(69)).toBe(440);
    });

    it('should convert MIDI 57 (A3) to 220 Hz', () => {
      expect(midiToFrequency(57)).toBe(220);
    });

    it('should handle custom tuning', () => {
      expect(midiToFrequency(69, 442)).toBe(442);
    });
  });

  describe('frequencyToMidi', () => {
    it('should convert 440 Hz to MIDI 69', () => {
      expect(frequencyToMidi(440)).toBe(69);
    });

    it('should convert 220 Hz to MIDI 57', () => {
      expect(frequencyToMidi(220)).toBe(57);
    });
  });

  describe('midiToNoteName', () => {
    it('should convert MIDI 60 to C4', () => {
      expect(midiToNoteName(60)).toBe('C4');
    });

    it('should convert MIDI 69 to A4', () => {
      expect(midiToNoteName(69)).toBe('A4');
    });

    it('should convert MIDI 0 to C-1', () => {
      expect(midiToNoteName(0)).toBe('C-1');
    });
  });
});
