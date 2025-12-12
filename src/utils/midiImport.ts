// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * MIDI Import Utility
 * Parses MIDI files (Type 0 and Type 1) and converts to AnkhWaveStudio Web format
 */

// MIDI Event Types
const MIDI_EVENT = {
  NOTE_OFF: 0x80,
  NOTE_ON: 0x90,
  POLY_AFTERTOUCH: 0xA0,
  CONTROL_CHANGE: 0xB0,
  PROGRAM_CHANGE: 0xC0,
  CHANNEL_AFTERTOUCH: 0xD0,
  PITCH_BEND: 0xE0,
  SYSEX: 0xF0,
  META: 0xFF,
};

// Meta Event Types
const META_EVENT = {
  SEQUENCE_NUMBER: 0x00,
  TEXT: 0x01,
  COPYRIGHT: 0x02,
  TRACK_NAME: 0x03,
  INSTRUMENT_NAME: 0x04,
  LYRIC: 0x05,
  MARKER: 0x06,
  CUE_POINT: 0x07,
  CHANNEL_PREFIX: 0x20,
  END_OF_TRACK: 0x2F,
  SET_TEMPO: 0x51,
  SMPTE_OFFSET: 0x54,
  TIME_SIGNATURE: 0x58,
  KEY_SIGNATURE: 0x59,
  SEQUENCER_SPECIFIC: 0x7F,
};

// Control Change Numbers
const CC = {
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
};

// Interfaces
export interface MidiNote {
  pitch: number;
  velocity: number;
  startTick: number;
  duration: number;
  channel: number;
}

export interface MidiControlChange {
  controller: number;
  value: number;
  tick: number;
  channel: number;
}

export interface MidiProgramChange {
  program: number;
  tick: number;
  channel: number;
}

export interface MidiPitchBend {
  value: number; // -8192 to 8191
  tick: number;
  channel: number;
}

export interface MidiTempoChange {
  tempo: number; // BPM
  tick: number;
}

export interface MidiTimeSignature {
  numerator: number;
  denominator: number;
  tick: number;
}

export interface MidiTrack {
  name: string;
  channel: number;
  notes: MidiNote[];
  controlChanges: MidiControlChange[];
  programChanges: MidiProgramChange[];
  pitchBends: MidiPitchBend[];
}

export interface MidiFile {
  format: number; // 0, 1, or 2
  ticksPerBeat: number;
  tracks: MidiTrack[];
  tempoChanges: MidiTempoChange[];
  timeSignatures: MidiTimeSignature[];
  name?: string;
  copyright?: string;
  duration: number; // Total duration in ticks
}

// AnkhWaveStudio Web format interfaces
export interface AnkhWaveStudioNote {
  id: string;
  pitch: number;
  position: number; // In ticks
  length: number;
  velocity: number;
  panning: number;
}

export interface AnkhWaveStudioPattern {
  id: string;
  name: string;
  notes: AnkhWaveStudioNote[];
  length: number;
}

export interface AnkhWaveStudioTrack {
  id: string;
  name: string;
  type: 'instrument' | 'sample' | 'automation';
  patterns: AnkhWaveStudioPattern[];
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
}

export interface AnkhWaveStudioProject {
  name: string;
  tempo: number;
  timeSignature: { numerator: number; denominator: number };
  tracks: AnkhWaveStudioTrack[];
}

/**
 * MIDI File Parser
 */
class MidiParser {
  private data: DataView;
  private position: number = 0;

  constructor(arrayBuffer: ArrayBuffer) {
    this.data = new DataView(arrayBuffer);
  }

  /**
   * Parse the MIDI file
   */
  parse(): MidiFile {
    // Parse header
    const header = this.parseHeader();
    
    // Parse tracks
    const tracks: MidiTrack[] = [];
    const tempoChanges: MidiTempoChange[] = [];
    const timeSignatures: MidiTimeSignature[] = [];
    let name: string | undefined;
    let copyright: string | undefined;
    let maxTick = 0;

    for (let i = 0; i < header.numTracks; i++) {
      const trackData = this.parseTrack();
      
      // Extract global events from first track (or all tracks for Type 0)
      if (i === 0 || header.format === 0) {
        tempoChanges.push(...trackData.tempoChanges);
        timeSignatures.push(...trackData.timeSignatures);
        if (trackData.name && !name) name = trackData.name;
        if (trackData.copyright && !copyright) copyright = trackData.copyright;
      }

      // Only add tracks with notes
      if (trackData.track.notes.length > 0 || trackData.track.controlChanges.length > 0) {
        tracks.push(trackData.track);
      }

      // Track max tick
      const trackMaxTick = Math.max(
        ...trackData.track.notes.map(n => n.startTick + n.duration),
        0
      );
      maxTick = Math.max(maxTick, trackMaxTick);
    }

    // Default tempo if none specified
    if (tempoChanges.length === 0) {
      tempoChanges.push({ tempo: 120, tick: 0 });
    }

    // Default time signature if none specified
    if (timeSignatures.length === 0) {
      timeSignatures.push({ numerator: 4, denominator: 4, tick: 0 });
    }

    return {
      format: header.format,
      ticksPerBeat: header.ticksPerBeat,
      tracks,
      tempoChanges,
      timeSignatures,
      name,
      copyright,
      duration: maxTick,
    };
  }

  /**
   * Parse MIDI header chunk
   */
  private parseHeader(): { format: number; numTracks: number; ticksPerBeat: number } {
    // Check for "MThd" magic
    const magic = this.readString(4);
    if (magic !== 'MThd') {
      throw new Error('Invalid MIDI file: Missing MThd header');
    }

    const headerLength = this.readUint32();
    if (headerLength < 6) {
      throw new Error('Invalid MIDI header length');
    }

    const format = this.readUint16();
    const numTracks = this.readUint16();
    const division = this.readUint16();

    // Check if SMPTE timing (we only support ticks per beat)
    if (division & 0x8000) {
      throw new Error('SMPTE timing not supported');
    }

    // Skip any extra header bytes
    if (headerLength > 6) {
      this.position += headerLength - 6;
    }

    return {
      format,
      numTracks,
      ticksPerBeat: division,
    };
  }

  /**
   * Parse a MIDI track chunk
   */
  private parseTrack(): {
    track: MidiTrack;
    tempoChanges: MidiTempoChange[];
    timeSignatures: MidiTimeSignature[];
    name?: string;
    copyright?: string;
  } {
    // Check for "MTrk" magic
    const magic = this.readString(4);
    if (magic !== 'MTrk') {
      throw new Error('Invalid MIDI file: Missing MTrk header');
    }

    const trackLength = this.readUint32();
    const trackEnd = this.position + trackLength;

    const notes: MidiNote[] = [];
    const controlChanges: MidiControlChange[] = [];
    const programChanges: MidiProgramChange[] = [];
    const pitchBends: MidiPitchBend[] = [];
    const tempoChanges: MidiTempoChange[] = [];
    const timeSignatures: MidiTimeSignature[] = [];
    
    // Track active notes for calculating duration
    const activeNotes: Map<string, { pitch: number; velocity: number; startTick: number; channel: number }> = new Map();
    
    let trackName = '';
    let copyright: string | undefined;
    let currentTick = 0;
    let runningStatus = 0;
    let trackChannel = 0;

    while (this.position < trackEnd) {
      // Read delta time
      const deltaTime = this.readVariableLength();
      currentTick += deltaTime;

      // Read event
      let eventByte = this.readUint8();

      // Handle running status
      if (eventByte < 0x80) {
        // Use running status
        this.position--;
        eventByte = runningStatus;
      } else if (eventByte < 0xF0) {
        // Update running status for channel messages
        runningStatus = eventByte;
      }

      const eventType = eventByte & 0xF0;
      const channel = eventByte & 0x0F;

      if (eventType === MIDI_EVENT.NOTE_OFF || (eventType === MIDI_EVENT.NOTE_ON)) {
        const pitch = this.readUint8();
        const velocity = this.readUint8();
        const noteKey = `${channel}-${pitch}`;

        if (eventType === MIDI_EVENT.NOTE_OFF || velocity === 0) {
          // Note off
          const activeNote = activeNotes.get(noteKey);
          if (activeNote) {
            notes.push({
              pitch: activeNote.pitch,
              velocity: activeNote.velocity,
              startTick: activeNote.startTick,
              duration: currentTick - activeNote.startTick,
              channel: activeNote.channel,
            });
            activeNotes.delete(noteKey);
          }
        } else {
          // Note on
          activeNotes.set(noteKey, {
            pitch,
            velocity,
            startTick: currentTick,
            channel,
          });
          trackChannel = channel;
        }
      } else if (eventType === MIDI_EVENT.POLY_AFTERTOUCH) {
        this.readUint8(); // note
        this.readUint8(); // pressure
      } else if (eventType === MIDI_EVENT.CONTROL_CHANGE) {
        const controller = this.readUint8();
        const value = this.readUint8();
        controlChanges.push({ controller, value, tick: currentTick, channel });
      } else if (eventType === MIDI_EVENT.PROGRAM_CHANGE) {
        const program = this.readUint8();
        programChanges.push({ program, tick: currentTick, channel });
      } else if (eventType === MIDI_EVENT.CHANNEL_AFTERTOUCH) {
        this.readUint8(); // pressure
      } else if (eventType === MIDI_EVENT.PITCH_BEND) {
        const lsb = this.readUint8();
        const msb = this.readUint8();
        const value = ((msb << 7) | lsb) - 8192;
        pitchBends.push({ value, tick: currentTick, channel });
      } else if (eventByte === MIDI_EVENT.SYSEX) {
        // System exclusive
        const length = this.readVariableLength();
        this.position += length;
      } else if (eventByte === 0xF7) {
        // Escaped sysex
        const length = this.readVariableLength();
        this.position += length;
      } else if (eventByte === MIDI_EVENT.META) {
        const metaType = this.readUint8();
        const length = this.readVariableLength();
        const dataStart = this.position;

        switch (metaType) {
          case META_EVENT.TRACK_NAME:
            trackName = this.readString(length);
            break;
          case META_EVENT.COPYRIGHT:
            copyright = this.readString(length);
            break;
          case META_EVENT.SET_TEMPO:
            if (length >= 3) {
              const microsecondsPerBeat = (this.readUint8() << 16) | (this.readUint8() << 8) | this.readUint8();
              const tempo = 60000000 / microsecondsPerBeat;
              tempoChanges.push({ tempo, tick: currentTick });
            }
            break;
          case META_EVENT.TIME_SIGNATURE:
            if (length >= 2) {
              const numerator = this.readUint8();
              const denominator = Math.pow(2, this.readUint8());
              timeSignatures.push({ numerator, denominator, tick: currentTick });
            }
            break;
          case META_EVENT.END_OF_TRACK:
            // End any remaining active notes
            for (const [key, activeNote] of activeNotes) {
              notes.push({
                pitch: activeNote.pitch,
                velocity: activeNote.velocity,
                startTick: activeNote.startTick,
                duration: currentTick - activeNote.startTick,
                channel: activeNote.channel,
              });
            }
            activeNotes.clear();
            break;
        }

        // Ensure we've read exactly the right number of bytes
        this.position = dataStart + length;
      }
    }

    // Ensure position is at track end
    this.position = trackEnd;

    return {
      track: {
        name: trackName || `Track ${trackChannel + 1}`,
        channel: trackChannel,
        notes,
        controlChanges,
        programChanges,
        pitchBends,
      },
      tempoChanges,
      timeSignatures,
      name: trackName,
      copyright,
    };
  }

  /**
   * Read a variable-length quantity
   */
  private readVariableLength(): number {
    let value = 0;
    let byte: number;
    
    do {
      byte = this.readUint8();
      value = (value << 7) | (byte & 0x7F);
    } while (byte & 0x80);

    return value;
  }

  /**
   * Read an unsigned 8-bit integer
   */
  private readUint8(): number {
    const value = this.data.getUint8(this.position);
    this.position++;
    return value;
  }

  /**
   * Read an unsigned 16-bit integer (big-endian)
   */
  private readUint16(): number {
    const value = this.data.getUint16(this.position, false);
    this.position += 2;
    return value;
  }

  /**
   * Read an unsigned 32-bit integer (big-endian)
   */
  private readUint32(): number {
    const value = this.data.getUint32(this.position, false);
    this.position += 4;
    return value;
  }

  /**
   * Read a string of specified length
   */
  private readString(length: number): string {
    let str = '';
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(this.readUint8());
    }
    return str;
  }
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Convert MIDI file to AnkhWaveStudio Web project format
 */
export function convertMidiToAnkhWaveStudio(midiFile: MidiFile): AnkhWaveStudioProject {
  const tracks: AnkhWaveStudioTrack[] = [];
  
  // Get initial tempo and time signature
  const initialTempo = midiFile.tempoChanges[0]?.tempo || 120;
  const initialTimeSig = midiFile.timeSignatures[0] || { numerator: 4, denominator: 4 };
  
  // Convert each MIDI track
  for (const midiTrack of midiFile.tracks) {
    if (midiTrack.notes.length === 0) continue;

    // Group notes into patterns (one pattern per track for simplicity)
    const notes: AnkhWaveStudioNote[] = midiTrack.notes.map(note => ({
      id: generateId(),
      pitch: note.pitch,
      position: note.startTick,
      length: note.duration,
      velocity: note.velocity / 127, // Normalize to 0-1
      panning: 0, // Default center
    }));

    // Calculate pattern length (round up to nearest bar)
    const ticksPerBar = midiFile.ticksPerBeat * initialTimeSig.numerator;
    const maxTick = Math.max(...notes.map(n => n.position + n.length));
    const patternLength = Math.ceil(maxTick / ticksPerBar) * ticksPerBar;

    // Get initial volume from control changes
    const volumeCC = midiTrack.controlChanges.find(cc => cc.controller === CC.VOLUME);
    const volume = volumeCC ? volumeCC.value / 127 : 1;

    // Get initial pan from control changes
    const panCC = midiTrack.controlChanges.find(cc => cc.controller === CC.PAN);
    const pan = panCC ? (panCC.value - 64) / 64 : 0; // Convert 0-127 to -1 to 1

    const pattern: AnkhWaveStudioPattern = {
      id: generateId(),
      name: midiTrack.name,
      notes,
      length: patternLength,
    };

    const track: AnkhWaveStudioTrack = {
      id: generateId(),
      name: midiTrack.name,
      type: 'instrument',
      patterns: [pattern],
      volume,
      pan,
      muted: false,
      solo: false,
    };

    tracks.push(track);
  }

  return {
    name: midiFile.name || 'Imported MIDI',
    tempo: initialTempo,
    timeSignature: {
      numerator: initialTimeSig.numerator,
      denominator: initialTimeSig.denominator,
    },
    tracks,
  };
}

/**
 * Parse a MIDI file from ArrayBuffer
 */
export function parseMidiFile(arrayBuffer: ArrayBuffer): MidiFile {
  const parser = new MidiParser(arrayBuffer);
  return parser.parse();
}

/**
 * Import MIDI file and convert to AnkhWaveStudio Web format
 */
export async function importMidiFile(file: File): Promise<AnkhWaveStudioProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const midiFile = parseMidiFile(arrayBuffer);
        const project = convertMidiToAnkhWaveStudio(midiFile);
        resolve(project);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read MIDI file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Check if a file is a MIDI file
 */
export function isMidiFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.mid') || 
         file.name.toLowerCase().endsWith('.midi') ||
         file.type === 'audio/midi' ||
         file.type === 'audio/x-midi';
}

/**
 * Get MIDI file info without full parsing
 */
export async function getMidiFileInfo(file: File): Promise<{
  format: number;
  numTracks: number;
  ticksPerBeat: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const data = new DataView(arrayBuffer);
        
        // Check magic
        const magic = String.fromCharCode(
          data.getUint8(0),
          data.getUint8(1),
          data.getUint8(2),
          data.getUint8(3)
        );
        
        if (magic !== 'MThd') {
          throw new Error('Invalid MIDI file');
        }
        
        const format = data.getUint16(8, false);
        const numTracks = data.getUint16(10, false);
        const ticksPerBeat = data.getUint16(12, false);
        
        resolve({ format, numTracks, ticksPerBeat });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read MIDI file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Convert ticks to seconds based on tempo map
 */
export function ticksToSeconds(
  ticks: number,
  ticksPerBeat: number,
  tempoChanges: MidiTempoChange[]
): number {
  let seconds = 0;
  let currentTick = 0;
  let currentTempo = tempoChanges[0]?.tempo || 120;
  
  // Sort tempo changes by tick
  const sortedTempos = [...tempoChanges].sort((a, b) => a.tick - b.tick);
  
  for (const tempoChange of sortedTempos) {
    if (tempoChange.tick >= ticks) break;
    
    // Add time for ticks at current tempo
    const ticksAtTempo = tempoChange.tick - currentTick;
    const secondsPerBeat = 60 / currentTempo;
    const secondsPerTick = secondsPerBeat / ticksPerBeat;
    seconds += ticksAtTempo * secondsPerTick;
    
    currentTick = tempoChange.tick;
    currentTempo = tempoChange.tempo;
  }
  
  // Add remaining ticks at final tempo
  const remainingTicks = ticks - currentTick;
  const secondsPerBeat = 60 / currentTempo;
  const secondsPerTick = secondsPerBeat / ticksPerBeat;
  seconds += remainingTicks * secondsPerTick;
  
  return seconds;
}

/**
 * Get General MIDI instrument name from program number
 */
export function getGMInstrumentName(program: number): string {
  const instruments = [
    // Piano
    'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano',
    'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavinet',
    // Chromatic Percussion
    'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone',
    'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
    // Organ
    'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ',
    'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
    // Guitar
    'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)',
    'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
    // Bass
    'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass',
    'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
    // Strings
    'Violin', 'Viola', 'Cello', 'Contrabass',
    'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
    // Ensemble
    'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2',
    'Choir Aahs', 'Voice Oohs', 'Synth Choir', 'Orchestra Hit',
    // Brass
    'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet',
    'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
    // Reed
    'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax',
    'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
    // Pipe
    'Piccolo', 'Flute', 'Recorder', 'Pan Flute',
    'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
    // Synth Lead
    'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)',
    'Lead 5 (charang)', 'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
    // Synth Pad
    'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)',
    'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)',
    // Synth Effects
    'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)',
    'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
    // Ethnic
    'Sitar', 'Banjo', 'Shamisen', 'Koto',
    'Kalimba', 'Bagpipe', 'Fiddle', 'Shanai',
    // Percussive
    'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock',
    'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
    // Sound Effects
    'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet',
    'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot',
  ];
  
  return instruments[program] || `Program ${program}`;
}

export default {
  parseMidiFile,
  importMidiFile,
  convertMidiToAnkhWaveStudio,
  isMidiFile,
  getMidiFileInfo,
  ticksToSeconds,
  getGMInstrumentName,
};