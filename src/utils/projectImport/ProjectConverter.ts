// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Project Converter
 * Converts parsed AnkhWaveStudio project data to AnkhWaveStudio Web format
 */

import type {
  AnkhWaveStudioProjectFile,
  AnkhWaveStudioTrack,
  AnkhWaveStudioInstrumentTrack,
  AnkhWaveStudioBBTrack,
  AnkhWaveStudioSampleTrack,
  AnkhWaveStudioAutomationTrack,
  AnkhWaveStudioPattern,
  AnkhWaveStudioEffect,
  AnkhWaveStudioImportWarning,
} from '../../types/ankhWaveProject';

import type {
  ProjectData,
  ProjectMetadata,
  SongSettings,
  Track,
  InstrumentTrack,
  SampleTrack,
  AutomationTrack,
  PatternTrack,
  MidiClip,
  AudioClip,
  AutomationClip,
  AutomationPoint,
  Pattern,
  InstrumentData,
  MixerData,
  MixerChannelData,
} from '../../types/song';

import type { MidiNote, EffectParams } from '../../types/audio';

/**
 * Generate a unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

/**
 * Convert AnkhWaveStudio color string to hex
 */
function convertColor(ankhWaveStudioColor: string | undefined): string {
  if (!ankhWaveStudioColor) {
    // Generate a random color
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 50%)`;
  }
  
  // AnkhWaveStudio uses various color formats
  if (ankhWaveStudioColor.startsWith('#')) {
    return ankhWaveStudioColor;
  }
  
  // Try to parse as integer (ARGB format)
  const colorInt = parseInt(ankhWaveStudioColor, 10);
  if (!isNaN(colorInt)) {
    const r = (colorInt >> 16) & 0xFF;
    const g = (colorInt >> 8) & 0xFF;
    const b = colorInt & 0xFF;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  
  return '#4a90d9'; // Default blue
}

/**
 * Map AnkhWaveStudio instrument name to web equivalent
 */
function mapInstrumentName(ankhWaveStudioName: string): { name: string; supported: boolean } {
  const instrumentMap: Record<string, string> = {
    'tripleoscillator': 'TripleOscillator',
    'kicker': 'Kicker',
    'audiofileprocessor': 'AudioFileProcessor',
    'bitinvader': 'BitInvader',
    'lb302': 'LB302',
    'malletsstk': 'Mallets',
    'monstro': 'Monstro',
    'nes': 'NES',
    'organic': 'Organic',
    'papu': 'Papu',
    'sf2player': 'SF2Player',
    'sfxr': 'Sfxr',
    'sid': 'SID',
    'vibedstrings': 'Vibed',
    'watsyn': 'Watsyn',
    'xpressive': 'Xpressive',
  };

  const webName = instrumentMap[ankhWaveStudioName.toLowerCase()];
  if (webName) {
    return { name: webName, supported: true };
  }

  // Unsupported instruments fallback to TripleOscillator
  return { name: 'TripleOscillator', supported: false };
}

/**
 * Map AnkhWaveStudio effect name to web equivalent
 */
function mapEffectName(ankhWaveStudioName: string): { name: string; supported: boolean } {
  const effectMap: Record<string, string> = {
    'amplifier': 'Amplifier',
    'bassbooster': 'BassBooster',
    'bitcrush': 'Bitcrush',
    'crossovereq': 'CrossoverEQ',
    'delay': 'Delay',
    'dualfilter': 'DualFilter',
    'dynamicsprocessor': 'DynamicsProcessor',
    'eq': 'EQ',
    'flanger': 'Flanger',
    'multitapecho': 'MultitapEcho',
    'reverbsc': 'Reverb',
    'stereoenhancer': 'StereoEnhancer',
    'stereomatrix': 'StereoMatrix',
    'waveshaper': 'Waveshaper',
  };

  const webName = effectMap[ankhWaveStudioName.toLowerCase()];
  if (webName) {
    return { name: webName, supported: true };
  }

  return { name: ankhWaveStudioName, supported: false };
}

/**
 * Conversion result
 */
export interface ConversionResult {
  project: ProjectData;
  warnings: AnkhWaveStudioImportWarning[];
  unsupportedInstruments: string[];
  unsupportedEffects: string[];
}

/**
 * Project Converter class
 */
export class ProjectConverter {
  private warnings: AnkhWaveStudioImportWarning[] = [];
  private unsupportedInstruments: Set<string> = new Set();
  private unsupportedEffects: Set<string> = new Set();
  private trackIdMap: Map<string, string> = new Map();
  private mixerChannelIdMap: Map<number, string> = new Map();

  /**
   * Convert AnkhWaveStudio project to AnkhWaveStudio Web format
   */
  convert(ankhWaveStudioProject: AnkhWaveStudioProjectFile, fileName: string): ConversionResult {
    this.warnings = [];
    this.unsupportedInstruments.clear();
    this.unsupportedEffects.clear();
    this.trackIdMap.clear();
    this.mixerChannelIdMap.clear();

    const projectId = generateId();
    const now = new Date().toISOString();

    // Convert metadata
    const metadata: ProjectMetadata = {
      name: fileName.replace(/\.(mmp|mmpz)$/i, ''),
      author: ankhWaveStudioProject.creator,
      description: `Imported from AnkhWaveStudio ${ankhWaveStudioProject.creatorVersion || ankhWaveStudioProject.version}`,
      createdAt: now,
      modifiedAt: now,
      version: '1.0.0',
    };

    // Convert song settings
    const song: SongSettings = {
      tempo: ankhWaveStudioProject.head.bpm,
      timeSignature: {
        numerator: ankhWaveStudioProject.head.timesigNumerator,
        denominator: ankhWaveStudioProject.head.timesigDenominator,
      },
      masterVolume: ankhWaveStudioProject.head.mastervol / 100,
      masterPitch: ankhWaveStudioProject.head.masterpitch,
      length: this.calculateProjectLength(ankhWaveStudioProject),
    };

    // Convert mixer first to get channel IDs
    const mixer = this.convertMixer(ankhWaveStudioProject.fxmixer);

    // Convert tracks
    const tracks = this.convertTracks(ankhWaveStudioProject.song.trackcontainer.tracks);

    // Convert patterns (BB tracks become patterns)
    const patterns = this.extractPatterns(ankhWaveStudioProject.song.trackcontainer.tracks);

    // Build automation data
    const automation = this.extractAutomation(ankhWaveStudioProject.song.trackcontainer.tracks);

    const project: ProjectData = {
      id: projectId,
      name: metadata.name,
      version: '1.0.0',
      metadata,
      song,
      tracks,
      mixer,
      controllers: [],
      automation,
      patterns,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return {
      project,
      warnings: this.warnings,
      unsupportedInstruments: Array.from(this.unsupportedInstruments),
      unsupportedEffects: Array.from(this.unsupportedEffects),
    };
  }

  /**
   * Calculate project length in bars
   */
  private calculateProjectLength(ankhWaveStudioProject: AnkhWaveStudioProjectFile): number {
    let maxTick = 0;
    const ticksPerBar = 192; // AnkhWaveStudio default

    for (const track of ankhWaveStudioProject.song.trackcontainer.tracks) {
      if (track.type === 0) {
        const instTrack = track as AnkhWaveStudioInstrumentTrack;
        for (const pattern of instTrack.instrumenttrack.patterns) {
          const patternEnd = pattern.pos + (pattern.len || this.calculatePatternLength(pattern));
          maxTick = Math.max(maxTick, patternEnd);
        }
      } else if (track.type === 2) {
        const sampleTrack = track as AnkhWaveStudioSampleTrack;
        for (const clip of sampleTrack.sampletrack.clips) {
          const clipEnd = clip.pos + clip.len;
          maxTick = Math.max(maxTick, clipEnd);
        }
      }
    }

    return Math.ceil(maxTick / ticksPerBar) || 16;
  }

  /**
   * Calculate pattern length from notes
   */
  private calculatePatternLength(pattern: AnkhWaveStudioPattern): number {
    if (pattern.notes.length === 0) return 192;
    
    let maxEnd = 0;
    for (const note of pattern.notes) {
      maxEnd = Math.max(maxEnd, note.pos + note.len);
    }
    
    // Round up to nearest bar
    return Math.ceil(maxEnd / 192) * 192;
  }

  /**
   * Convert mixer
   */
  private convertMixer(fxmixer: AnkhWaveStudioProjectFile['fxmixer']): MixerData {
    const channels: MixerChannelData[] = [];
    
    // Create master channel
    const masterId = generateId();
    this.mixerChannelIdMap.set(0, masterId);
    
    const masterChannel: MixerChannelData = {
      id: masterId,
      name: 'Master',
      volume: 1,
      pan: 0,
      mute: false,
      solo: false,
      effects: [],
      sends: [],
    };

    if (fxmixer && fxmixer.channels.length > 0) {
      for (const channel of fxmixer.channels) {
        const channelId = generateId();
        this.mixerChannelIdMap.set(channel.num, channelId);

        const convertedChannel: MixerChannelData = {
          id: channelId,
          name: channel.name || `FX ${channel.num}`,
          volume: channel.volume,
          pan: 0,
          mute: channel.muted || false,
          solo: channel.soloed || false,
          effects: this.convertEffects(channel.effects),
          sends: channel.sends.map(send => ({
            targetChannelId: this.mixerChannelIdMap.get(send.channel) || masterId,
            amount: send.amount,
            preFader: false,
          })),
        };

        if (channel.num === 0) {
          // This is the master channel
          masterChannel.volume = channel.volume;
          masterChannel.effects = convertedChannel.effects;
        } else {
          channels.push(convertedChannel);
        }
      }
    }

    return {
      channels,
      masterChannel,
    };
  }

  /**
   * Convert effects
   */
  private convertEffects(effects: AnkhWaveStudioEffect[]): EffectParams[] {
    return effects.map(effect => {
      const { name, supported } = mapEffectName(effect.name);
      
      if (!supported) {
        this.unsupportedEffects.add(effect.name);
        this.addWarning('effect', `Effect "${effect.name}" is not supported and will be skipped`);
      }

      return {
        id: generateId(),
        type: name,
        name: name,
        enabled: effect.enabled,
        wet: effect.wet,
        params: effect.params as Record<string, number>,
      };
    }).filter(effect => {
      // Filter out unsupported effects
      const { supported } = mapEffectName(effect.type);
      return supported;
    });
  }

  /**
   * Convert tracks
   */
  private convertTracks(ankhWaveStudioTracks: AnkhWaveStudioTrack[]): Track[] {
    const tracks: Track[] = [];

    for (const ankhWaveStudioTrack of ankhWaveStudioTracks) {
      const track = this.convertTrack(ankhWaveStudioTrack);
      if (track) {
        tracks.push(track);
      }
    }

    return tracks;
  }

  /**
   * Convert a single track
   */
  private convertTrack(ankhWaveStudioTrack: AnkhWaveStudioTrack): Track | null {
    switch (ankhWaveStudioTrack.type) {
      case 0:
        return this.convertInstrumentTrack(ankhWaveStudioTrack as AnkhWaveStudioInstrumentTrack);
      case 1:
        // BB tracks are converted to pattern tracks
        return this.convertBBTrack(ankhWaveStudioTrack as AnkhWaveStudioBBTrack);
      case 2:
        return this.convertSampleTrack(ankhWaveStudioTrack as AnkhWaveStudioSampleTrack);
      case 5:
        return this.convertAutomationTrack(ankhWaveStudioTrack as AnkhWaveStudioAutomationTrack);
      default:
        this.addWarning('feature', `Unknown track type: ${ankhWaveStudioTrack.type}`);
        return null;
    }
  }

  /**
   * Convert instrument track
   */
  private convertInstrumentTrack(ankhWaveStudioTrack: AnkhWaveStudioInstrumentTrack): InstrumentTrack {
    const trackId = generateId();
    const instrumentId = generateId();
    this.trackIdMap.set(ankhWaveStudioTrack.name, trackId);

    const { name: instrumentType, supported } = mapInstrumentName(
      ankhWaveStudioTrack.instrumenttrack.instrument.name
    );

    if (!supported) {
      this.unsupportedInstruments.add(ankhWaveStudioTrack.instrumenttrack.instrument.name);
      this.addWarning(
        'instrument',
        `Instrument "${ankhWaveStudioTrack.instrumenttrack.instrument.name}" is not supported, using ${instrumentType} as fallback`
      );
    }

    // Convert patterns to clips
    const clips: MidiClip[] = ankhWaveStudioTrack.instrumenttrack.patterns.map(pattern => {
      const clipId = generateId();
      const notes: MidiNote[] = pattern.notes.map(note => ({
        pitch: note.key,
        velocity: Math.round((note.vol / 100) * 127),
        startTick: note.pos,
        duration: note.len,
        channel: 0,
      }));

      return {
        id: clipId,
        trackId,
        startTick: pattern.pos,
        length: pattern.len || this.calculatePatternLength(pattern),
        offset: 0,
        name: pattern.name || 'Pattern',
        notes,
      };
    });

    // Get mixer channel ID
    const fxch = ankhWaveStudioTrack.instrumenttrack.fxch;
    const mixerChannelId = this.mixerChannelIdMap.get(fxch) || this.mixerChannelIdMap.get(0) || '';

    // Convert instrument data
    const instrument: InstrumentData = {
      id: instrumentId,
      type: instrumentType,
      name: instrumentType,
      params: {
        volume: ankhWaveStudioTrack.instrumenttrack.vol / 100,
        pan: ankhWaveStudioTrack.instrumenttrack.pan / 100,
        pitch: ankhWaveStudioTrack.instrumenttrack.pitch,
        ...this.convertInstrumentParams(
          ankhWaveStudioTrack.instrumenttrack.instrument.name,
          ankhWaveStudioTrack.instrumenttrack.instrument.params
        ),
      },
    };

    return {
      id: trackId,
      type: 'instrument',
      name: ankhWaveStudioTrack.name,
      color: convertColor(ankhWaveStudioTrack.color),
      muted: ankhWaveStudioTrack.muted || false,
      solo: ankhWaveStudioTrack.solo || false,
      volume: ankhWaveStudioTrack.instrumenttrack.vol / 100,
      pan: ankhWaveStudioTrack.instrumenttrack.pan / 100,
      mixerChannelId,
      clips,
      instrumentId,
      instrument,
    };
  }

  /**
   * Convert instrument-specific parameters
   */
  private convertInstrumentParams(
    instrumentName: string,
    params: Record<string, unknown>
  ): Record<string, unknown> {
    // Convert AnkhWaveStudio parameter names to web format
    const converted: Record<string, unknown> = {};

    switch (instrumentName.toLowerCase()) {
      case 'tripleoscillator':
        // Map TripleOscillator parameters
        converted.osc1 = {
          waveform: this.mapWaveform(params['osc1_wave'] as number),
          volume: (params['osc1_vol'] as number) / 100 || 0.33,
          pan: (params['osc1_pan'] as number) / 100 || 0,
          detune: (params['osc1_coarse'] as number) || 0,
          phase: (params['osc1_phoffset'] as number) || 0,
        };
        converted.osc2 = {
          waveform: this.mapWaveform(params['osc2_wave'] as number),
          volume: (params['osc2_vol'] as number) / 100 || 0.33,
          pan: (params['osc2_pan'] as number) / 100 || 0,
          detune: (params['osc2_coarse'] as number) || 0,
          phase: (params['osc2_phoffset'] as number) || 0,
        };
        converted.osc3 = {
          waveform: this.mapWaveform(params['osc3_wave'] as number),
          volume: (params['osc3_vol'] as number) / 100 || 0.33,
          pan: (params['osc3_pan'] as number) / 100 || 0,
          detune: (params['osc3_coarse'] as number) || 0,
          phase: (params['osc3_phoffset'] as number) || 0,
        };
        break;

      case 'kicker':
        converted.startFreq = params['startfreq'] || 400;
        converted.endFreq = params['endfreq'] || 40;
        converted.decay = params['decay'] || 0.2;
        converted.distortion = params['dist'] || 0;
        converted.gain = params['gain'] || 1;
        break;

      default:
        // Pass through all parameters
        Object.assign(converted, params);
    }

    return converted;
  }

  /**
   * Map AnkhWaveStudio waveform number to name
   */
  private mapWaveform(waveNum: number | undefined): string {
    const waveforms: Record<number, string> = {
      0: 'sine',
      1: 'triangle',
      2: 'sawtooth',
      3: 'square',
      4: 'moog',
      5: 'exponential',
      6: 'noise',
      7: 'custom',
    };
    return waveforms[waveNum || 0] || 'sine';
  }

  /**
   * Convert BB track to pattern track
   */
  private convertBBTrack(ankhWaveStudioTrack: AnkhWaveStudioBBTrack): PatternTrack {
    const trackId = generateId();
    const patternId = generateId();
    this.trackIdMap.set(ankhWaveStudioTrack.name, trackId);

    // BB tracks reference patterns
    const clips = ankhWaveStudioTrack.bbtrack.patterns.map(pattern => ({
      id: generateId(),
      trackId,
      startTick: pattern.pos,
      length: pattern.len,
      offset: 0,
      name: pattern.name || 'BB Pattern',
    }));

    return {
      id: trackId,
      type: 'pattern',
      name: ankhWaveStudioTrack.name,
      color: convertColor(ankhWaveStudioTrack.color),
      muted: ankhWaveStudioTrack.muted || false,
      solo: ankhWaveStudioTrack.solo || false,
      volume: 1,
      pan: 0,
      mixerChannelId: this.mixerChannelIdMap.get(0) || '',
      clips,
      patternId,
    };
  }

  /**
   * Convert sample track
   */
  private convertSampleTrack(ankhWaveStudioTrack: AnkhWaveStudioSampleTrack): SampleTrack {
    const trackId = generateId();
    this.trackIdMap.set(ankhWaveStudioTrack.name, trackId);

    const clips: AudioClip[] = ankhWaveStudioTrack.sampletrack.clips.map(clip => ({
      id: generateId(),
      trackId,
      startTick: clip.pos,
      length: clip.len,
      offset: 0,
      name: clip.src.split('/').pop() || 'Sample',
      sampleId: clip.src, // Will be resolved later
      startOffset: clip.off || 0,
      fadeIn: 0,
      fadeOut: 0,
      gain: 1,
      pitch: 0,
    }));

    const fxch = ankhWaveStudioTrack.sampletrack.fxch;
    const mixerChannelId = this.mixerChannelIdMap.get(fxch) || this.mixerChannelIdMap.get(0) || '';

    return {
      id: trackId,
      type: 'sample',
      name: ankhWaveStudioTrack.name,
      color: convertColor(ankhWaveStudioTrack.color),
      muted: ankhWaveStudioTrack.muted || false,
      solo: ankhWaveStudioTrack.solo || false,
      volume: ankhWaveStudioTrack.sampletrack.vol / 100,
      pan: ankhWaveStudioTrack.sampletrack.pan / 100,
      mixerChannelId,
      clips,
      sampleId: '', // Will be set when samples are loaded
    };
  }

  /**
   * Convert automation track
   */
  private convertAutomationTrack(ankhWaveStudioTrack: AnkhWaveStudioAutomationTrack): AutomationTrack {
    const trackId = generateId();
    this.trackIdMap.set(ankhWaveStudioTrack.name, trackId);

    const clips: AutomationClip[] = ankhWaveStudioTrack.automationtrack.patterns.map(pattern => {
      const points: AutomationPoint[] = pattern.points.map(point => ({
        tick: point.pos,
        value: point.value,
        curve: 'linear' as const,
      }));

      return {
        id: generateId(),
        trackId,
        startTick: pattern.pos,
        length: pattern.len,
        offset: 0,
        name: pattern.name || 'Automation',
        points,
      };
    });

    return {
      id: trackId,
      type: 'automation',
      name: ankhWaveStudioTrack.name,
      color: convertColor(ankhWaveStudioTrack.color),
      muted: ankhWaveStudioTrack.muted || false,
      solo: ankhWaveStudioTrack.solo || false,
      volume: 1,
      pan: 0,
      mixerChannelId: this.mixerChannelIdMap.get(0) || '',
      clips,
      targetTrackId: '', // Will be resolved from automation objects
      targetParameter: '',
    };
  }

  /**
   * Extract patterns from BB tracks
   */
  private extractPatterns(ankhWaveStudioTracks: AnkhWaveStudioTrack[]): Pattern[] {
    const patterns: Pattern[] = [];

    for (const track of ankhWaveStudioTracks) {
      if (track.type === 1) {
        const bbTrack = track as AnkhWaveStudioBBTrack;
        
        // Each BB track contains instrument tracks that define the pattern
        for (const innerTrack of bbTrack.bbtrack.trackcontainer.tracks) {
          if (innerTrack.type === 0) {
            const instTrack = innerTrack as AnkhWaveStudioInstrumentTrack;
            
            for (const ankhWaveStudioPattern of instTrack.instrumenttrack.patterns) {
              const pattern: Pattern = {
                id: generateId(),
                name: ankhWaveStudioPattern.name || bbTrack.name,
                length: ankhWaveStudioPattern.steps || 16,
                steps: ankhWaveStudioPattern.notes.map((note, index) => ({
                  index,
                  enabled: true,
                  velocity: note.vol / 100,
                  pan: (note.pan || 0) / 100,
                  pitch: note.key,
                })),
              };
              patterns.push(pattern);
            }
          }
        }
      }
    }

    return patterns;
  }

  /**
   * Extract automation data
   */
  private extractAutomation(ankhWaveStudioTracks: AnkhWaveStudioTrack[]): ProjectData['automation'] {
    const automation: ProjectData['automation'] = [];

    for (const track of ankhWaveStudioTracks) {
      if (track.type === 5) {
        const autoTrack = track as AnkhWaveStudioAutomationTrack;
        
        for (const pattern of autoTrack.automationtrack.patterns) {
          automation.push({
            id: generateId(),
            trackId: this.trackIdMap.get(autoTrack.name) || '',
            parameter: pattern.objects[0]?.id || '',
            points: pattern.points.map(point => ({
              tick: point.pos,
              value: point.value,
              curve: 'linear' as const,
            })),
          });
        }
      }
    }

    return automation;
  }

  /**
   * Add a warning
   */
  private addWarning(type: AnkhWaveStudioImportWarning['type'], message: string, details?: string): void {
    this.warnings.push({ type, message, details });
  }
}

/**
 * Convert AnkhWaveStudio project file to AnkhWaveStudio Web format
 */
export function convertAnkhWaveStudioProject(
  ankhWaveStudioProject: AnkhWaveStudioProjectFile,
  fileName: string
): ConversionResult {
  const converter = new ProjectConverter();
  return converter.convert(ankhWaveStudioProject, fileName);
}

export default ProjectConverter;