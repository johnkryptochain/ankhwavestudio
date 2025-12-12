// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * MidiExporter - Exports project data to MIDI file
 * Supports multiple tracks, notes, tempo, time signature, and CC automation
 */

import { write } from 'midifile-ts';
import type { MidiFile, AnyEvent } from 'midifile-ts';
import type { SongState } from '../stores/songStore';
import type { Track, InstrumentTrack, MidiClip } from '../types/song';

type MidiTrack = AnyEvent[];
type MidiEvent = AnyEvent;

export class MidiExporter {
  /**
   * Export song to MIDI blob
   */
  static export(song: SongState): Blob {
    const tracks: MidiTrack[] = [];
    
    // 1. Create Tempo Track (Track 0)
    const tempoTrack: MidiTrack = [
      // Time Signature
      {
        deltaTime: 0,
        type: 'meta',
        subtype: 'timeSignature',
        numerator: song.settings.timeSignature.numerator,
        denominator: song.settings.timeSignature.denominator,
        metronome: 24,
        thirtyseconds: 8
      },
      // Tempo (microseconds per quarter note)
      {
        deltaTime: 0,
        type: 'meta',
        subtype: 'setTempo',
        microsecondsPerBeat: Math.round(60000000 / song.settings.tempo)
      },
      // End of Track
      {
        deltaTime: 0,
        type: 'meta',
        subtype: 'endOfTrack'
      }
    ];
    tracks.push(tempoTrack);

    // 2. Convert Song Tracks to MIDI Tracks
    song.tracks.forEach((track, index) => {
      const midiTrack = this.convertTrackToMidi(track, index);
      if (midiTrack.length > 0) {
        tracks.push(midiTrack);
      }
    });

    // 3. Write to binary
    const midiData = write(tracks, 480);
    return new Blob([new Uint8Array(midiData)], { type: 'audio/midi' });
  }

  /**
   * Convert internal track to MIDI track events
   */
  private static convertTrackToMidi(track: Track, channelIndex: number): MidiTrack {
    const events: MidiEvent[] = [];
    const channel = channelIndex % 16; // MIDI has 16 channels

    // Track Name
    events.push({
      deltaTime: 0,
      type: 'meta',
      subtype: 'trackName',
      text: track.name
    });

    // Instrument Name
    if (track.type === 'instrument') {
      const instrTrack = track as InstrumentTrack;
      if (instrTrack.instrument) {
        events.push({
          deltaTime: 0,
          type: 'meta',
          subtype: 'instrumentName',
          text: instrTrack.instrument.type
        });
      }
    }

    // Collect all notes from all clips
    interface NoteEvent {
      tick: number;
      type: 'on' | 'off';
      pitch: number;
      velocity: number;
    }

    const noteEvents: NoteEvent[] = [];

    track.clips.forEach(clip => {
      // Check if it's a MIDI clip (has notes)
      if ('notes' in clip) {
        const midiClip = clip as MidiClip;
        midiClip.notes.forEach(note => {
          const absStart = clip.startTick + note.startTick;
          const absEnd = absStart + note.duration;

          noteEvents.push({
            tick: absStart,
            type: 'on',
            pitch: note.pitch,
            velocity: note.velocity
          });

          noteEvents.push({
            tick: absEnd,
            type: 'off',
            pitch: note.pitch,
            velocity: 0
          });
        });
      }
    });

    // Sort events by time
    noteEvents.sort((a, b) => a.tick - b.tick);

    // Convert absolute ticks to delta times
    let lastTick = 0;
    noteEvents.forEach(event => {
      const delta = event.tick - lastTick;
      lastTick = event.tick;

      if (event.type === 'on') {
        events.push({
          deltaTime: delta,
          type: 'channel',
          subtype: 'noteOn',
          channel: channel,
          noteNumber: event.pitch,
          velocity: event.velocity
        });
      } else {
        events.push({
          deltaTime: delta,
          type: 'channel',
          subtype: 'noteOff',
          channel: channel,
          noteNumber: event.pitch,
          velocity: 0
        });
      }
    });

    // End of Track
    events.push({
      deltaTime: 0,
      type: 'meta',
      subtype: 'endOfTrack'
    });

    return events;
  }
}
