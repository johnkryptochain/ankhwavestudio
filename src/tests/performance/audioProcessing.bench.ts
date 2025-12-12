// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import { bench, describe } from 'vitest';
import { createMidiMessage } from '../../utils/midiUtils';

describe('Audio Processing Performance', () => {
  bench('createMidiMessage 1000 times', () => {
    for (let i = 0; i < 1000; i++) {
      createMidiMessage(0x90, 60, 100);
    }
  });

  bench('createMidiMessage 10000 times', () => {
    for (let i = 0; i < 10000; i++) {
      createMidiMessage(0x90, 60, 100);
    }
  });
});
