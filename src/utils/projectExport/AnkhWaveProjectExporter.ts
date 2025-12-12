// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * AnkhWaveStudio Project Exporter
 * Exports AnkhWaveStudio Web projects to .mmp (XML) and .mmpz (compressed) formats
 */

import type { ProjectData, Track, InstrumentTrack, SampleTrack, AutomationTrack, PatternTrack } from '../../types/song';
import type { MidiNote } from '../../types/audio';

/**
 * Export options
 */
export interface ExportOptions {
  format: 'mmp' | 'mmpz';
  embedSamples: boolean;
  includeAutomation: boolean;
}

/**
 * AnkhWaveStudio waveform mapping (reverse of import)
 */
const WAVEFORM_TO_AnkhWaveStudio: Record<string, number> = {
  'sine': 0,
  'triangle': 1,
  'sawtooth': 2,
  'square': 3,
  'moog': 4,
  'exponential': 5,
  'noise': 6,
  'custom': 7,
};

/**
 * AnkhWaveStudio Project Exporter class
 */
export class AnkhWaveStudioProjectExporter {
  private sampleData: Map<string, string> = new Map(); // path -> base64 data

  constructor() {
    // No initialization needed
  }

  /**
   * Export project to AnkhWaveStudio format
   */
  async export(project: ProjectData, options: ExportOptions): Promise<Blob> {
    // Create XML document
    const xmlString = this.createProjectXML(project, options);

    if (options.format === 'mmpz') {
      // Compress with gzip
      return this.compressGzip(xmlString);
    }

    // Return as plain XML
    return new Blob([xmlString], { type: 'application/xml' });
  }

  /**
   * Create the project XML string
   */
  private createProjectXML(project: ProjectData, options: ExportOptions): string {
    const lines: string[] = [];

    // XML declaration
    lines.push('<?xml version="1.0"?>');

    // Root element
    lines.push(`<AnkhWaveStudio-project version="1.0" type="song" creator="AnkhWaveStudio Web" creatorversion="1.0.0">`);

    // Head section
    lines.push('  <head');
    lines.push(`    bpm="${project.song.tempo}"`);
    lines.push(`    timesig_numerator="${project.song.timeSignature.numerator}"`);
    lines.push(`    timesig_denominator="${project.song.timeSignature.denominator}"`);
    lines.push(`    mastervol="${Math.round(project.song.masterVolume * 100)}"`);
    lines.push(`    masterpitch="${project.song.masterPitch}"`);
    lines.push('  />');

    // Song section
    lines.push('  <song>');
    lines.push('    <trackcontainer>');

    // Export tracks
    for (const track of project.tracks) {
      const trackXML = this.exportTrack(track, options);
      lines.push(trackXML);
    }

    lines.push('    </trackcontainer>');
    lines.push('  </song>');

    // FX Mixer section
    lines.push('  <fxmixer>');
    lines.push(this.exportMixer(project));
    lines.push('  </fxmixer>');

    lines.push('</AnkhWaveStudio-project>');

    return lines.join('\n');
  }

  /**
   * Export a single track
   */
  private exportTrack(track: Track, options: ExportOptions): string {
    const lines: string[] = [];
    const indent = '      ';

    switch (track.type) {
      case 'instrument':
        lines.push(this.exportInstrumentTrack(track as InstrumentTrack, indent));
        break;
      case 'sample':
        lines.push(this.exportSampleTrack(track as SampleTrack, indent, options));
        break;
      case 'automation':
        if (options.includeAutomation) {
          lines.push(this.exportAutomationTrack(track as AutomationTrack, indent));
        }
        break;
      case 'pattern':
        lines.push(this.exportPatternTrack(track as PatternTrack, indent));
        break;
    }

    return lines.join('\n');
  }

  /**
   * Export instrument track
   */
  private exportInstrumentTrack(track: InstrumentTrack, indent: string): string {
    const lines: string[] = [];
    const color = this.colorToAnkhWaveStudio(track.color);

    lines.push(`${indent}<track type="0" name="${this.escapeXML(track.name)}" muted="${track.muted ? 1 : 0}" solo="${track.solo ? 1 : 0}"${color ? ` color="${color}"` : ''}>`);
    
    // Instrument track data
    lines.push(`${indent}  <instrumenttrack`);
    lines.push(`${indent}    vol="${Math.round(track.volume * 100)}"`);
    lines.push(`${indent}    pan="${Math.round(track.pan * 100)}"`);
    lines.push(`${indent}    pitch="${track.instrument.params.pitch || 0}"`);
    lines.push(`${indent}    pitchrange="1"`);
    lines.push(`${indent}    fxch="0"`);
    lines.push(`${indent}    basenote="57"`);
    lines.push(`${indent}    usemasterpitch="1"`);
    lines.push(`${indent}  >`);

    // Instrument
    const instrumentName = this.mapInstrumentToAnkhWaveStudio(track.instrument.type);
    lines.push(`${indent}    <instrument name="${instrumentName}">`);
    lines.push(this.exportInstrumentParams(track.instrument, indent + '      '));
    lines.push(`${indent}    </instrument>`);

    // Envelope/LFO data
    lines.push(`${indent}    <eldata>`);
    lines.push(`${indent}      <elvol pdel="0" att="0" hold="0.5" dec="0.5" sustain="0.5" rel="0.1" amt="0" />`);
    lines.push(`${indent}      <elcut pdel="0" att="0" hold="0.5" dec="0.5" sustain="0.5" rel="0.1" amt="0" />`);
    lines.push(`${indent}      <elres pdel="0" att="0" hold="0.5" dec="0.5" sustain="0.5" rel="0.1" amt="0" />`);
    lines.push(`${indent}    </eldata>`);

    lines.push(`${indent}  </instrumenttrack>`);

    // Patterns
    for (const clip of track.clips) {
      if ('notes' in clip) {
        lines.push(this.exportPattern(clip as { notes: MidiNote[]; startTick: number; length: number; name: string }, indent + '  '));
      }
    }

    lines.push(`${indent}</track>`);

    return lines.join('\n');
  }

  /**
   * Export instrument parameters
   */
  private exportInstrumentParams(instrument: InstrumentTrack['instrument'], indent: string): string {
    const lines: string[] = [];
    const name = this.mapInstrumentToAnkhWaveStudio(instrument.type);

    // Build parameter string
    const params: string[] = [];

    if (name === 'tripleoscillator') {
      // Export TripleOscillator parameters
      const osc1 = instrument.params.osc1 as Record<string, unknown> || {};
      const osc2 = instrument.params.osc2 as Record<string, unknown> || {};
      const osc3 = instrument.params.osc3 as Record<string, unknown> || {};

      params.push(`osc1_vol="${Math.round((osc1.volume as number || 0.33) * 100)}"`);
      params.push(`osc1_pan="${Math.round((osc1.pan as number || 0) * 100)}"`);
      params.push(`osc1_coarse="${osc1.detune || 0}"`);
      params.push(`osc1_finel="0"`);
      params.push(`osc1_finer="0"`);
      params.push(`osc1_phoffset="${osc1.phase || 0}"`);
      params.push(`osc1_stphdetun="0"`);
      params.push(`osc1_wave="${WAVEFORM_TO_AnkhWaveStudio[osc1.waveform as string] || 0}"`);

      params.push(`osc2_vol="${Math.round((osc2.volume as number || 0.33) * 100)}"`);
      params.push(`osc2_pan="${Math.round((osc2.pan as number || 0) * 100)}"`);
      params.push(`osc2_coarse="${osc2.detune || 0}"`);
      params.push(`osc2_finel="0"`);
      params.push(`osc2_finer="0"`);
      params.push(`osc2_phoffset="${osc2.phase || 0}"`);
      params.push(`osc2_stphdetun="0"`);
      params.push(`osc2_wave="${WAVEFORM_TO_AnkhWaveStudio[osc2.waveform as string] || 0}"`);

      params.push(`osc3_vol="${Math.round((osc3.volume as number || 0.33) * 100)}"`);
      params.push(`osc3_pan="${Math.round((osc3.pan as number || 0) * 100)}"`);
      params.push(`osc3_coarse="${osc3.detune || 0}"`);
      params.push(`osc3_finel="0"`);
      params.push(`osc3_finer="0"`);
      params.push(`osc3_phoffset="${osc3.phase || 0}"`);
      params.push(`osc3_stphdetun="0"`);
      params.push(`osc3_wave="${WAVEFORM_TO_AnkhWaveStudio[osc3.waveform as string] || 0}"`);

      params.push(`osc2_mod="0"`);
      params.push(`osc3_mod="0"`);
    } else {
      // Generic parameter export
      for (const [key, value] of Object.entries(instrument.params)) {
        if (key !== 'volume' && key !== 'pan' && key !== 'pitch') {
          if (typeof value === 'number') {
            params.push(`${key}="${value}"`);
          } else if (typeof value === 'boolean') {
            params.push(`${key}="${value ? 1 : 0}"`);
          } else if (typeof value === 'string') {
            params.push(`${key}="${this.escapeXML(value)}"`);
          }
        }
      }
    }

    lines.push(`${indent}<${name} ${params.join(' ')} />`);

    return lines.join('\n');
  }

  /**
   * Export pattern with notes
   */
  private exportPattern(
    clip: { notes: MidiNote[]; startTick: number; length: number; name: string },
    indent: string
  ): string {
    const lines: string[] = [];

    lines.push(`${indent}<pattern pos="${clip.startTick}" len="${clip.length}" name="${this.escapeXML(clip.name)}">`);

    for (const note of clip.notes) {
      const vol = Math.round((note.velocity / 127) * 100);
      lines.push(`${indent}  <note pos="${note.startTick}" len="${note.duration}" key="${note.pitch}" vol="${vol}" pan="0" />`);
    }

    lines.push(`${indent}</pattern>`);

    return lines.join('\n');
  }

  /**
   * Export sample track
   */
  private exportSampleTrack(track: SampleTrack, indent: string, options: ExportOptions): string {
    const lines: string[] = [];
    const color = this.colorToAnkhWaveStudio(track.color);

    lines.push(`${indent}<track type="2" name="${this.escapeXML(track.name)}" muted="${track.muted ? 1 : 0}" solo="${track.solo ? 1 : 0}"${color ? ` color="${color}"` : ''}>`);
    
    lines.push(`${indent}  <sampletrack`);
    lines.push(`${indent}    vol="${Math.round(track.volume * 100)}"`);
    lines.push(`${indent}    pan="${Math.round(track.pan * 100)}"`);
    lines.push(`${indent}    fxch="0"`);
    lines.push(`${indent}  />`);

    // Sample clips
    for (const clip of track.clips) {
      if ('sampleId' in clip) {
        const audioClip = clip as { sampleId: string; startTick: number; length: number; name: string; startOffset?: number };
        const dataAttr = options.embedSamples && this.sampleData.has(audioClip.sampleId)
          ? ` data="${this.sampleData.get(audioClip.sampleId)}"`
          : '';
        
        lines.push(`${indent}  <sampletco pos="${audioClip.startTick}" len="${audioClip.length}" src="${this.escapeXML(audioClip.sampleId)}" off="${audioClip.startOffset || 0}"${dataAttr} />`);
      }
    }

    lines.push(`${indent}</track>`);

    return lines.join('\n');
  }

  /**
   * Export automation track
   */
  private exportAutomationTrack(track: AutomationTrack, indent: string): string {
    const lines: string[] = [];
    const color = this.colorToAnkhWaveStudio(track.color);

    lines.push(`${indent}<track type="5" name="${this.escapeXML(track.name)}" muted="${track.muted ? 1 : 0}" solo="${track.solo ? 1 : 0}"${color ? ` color="${color}"` : ''}>`);

    // Automation patterns
    for (const clip of track.clips) {
      if ('points' in clip) {
        const autoClip = clip as { points: Array<{ tick: number; value: number }>; startTick: number; length: number; name: string };
        lines.push(`${indent}  <automationpattern pos="${autoClip.startTick}" len="${autoClip.length}" name="${this.escapeXML(autoClip.name)}" prog="0" tens="0">`);
        
        for (const point of autoClip.points) {
          lines.push(`${indent}    <time pos="${point.tick}" value="${point.value}" />`);
        }
        
        lines.push(`${indent}  </automationpattern>`);
      }
    }

    lines.push(`${indent}</track>`);

    return lines.join('\n');
  }

  /**
   * Export pattern track (BB track)
   */
  private exportPatternTrack(track: PatternTrack, indent: string): string {
    const lines: string[] = [];
    const color = this.colorToAnkhWaveStudio(track.color);

    lines.push(`${indent}<track type="1" name="${this.escapeXML(track.name)}" muted="${track.muted ? 1 : 0}" solo="${track.solo ? 1 : 0}"${color ? ` color="${color}"` : ''}>`);
    
    lines.push(`${indent}  <bbtrack>`);
    lines.push(`${indent}    <trackcontainer>`);
    lines.push(`${indent}    </trackcontainer>`);
    lines.push(`${indent}  </bbtrack>`);

    // BB pattern references
    for (const clip of track.clips) {
      lines.push(`${indent}  <bbtco pos="${clip.startTick}" len="${clip.length}" name="${this.escapeXML(clip.name)}" />`);
    }

    lines.push(`${indent}</track>`);

    return lines.join('\n');
  }

  /**
   * Export mixer
   */
  private exportMixer(project: ProjectData): string {
    const lines: string[] = [];
    const indent = '    ';

    // Master channel
    lines.push(`${indent}<fxchannel num="0" name="Master" volume="${project.mixer.masterChannel.volume}" muted="${project.mixer.masterChannel.mute ? 1 : 0}">`);
    lines.push(this.exportFxChain(project.mixer.masterChannel.effects, indent + '  '));
    lines.push(`${indent}</fxchannel>`);

    // Other channels
    for (let i = 0; i < project.mixer.channels.length; i++) {
      const channel = project.mixer.channels[i];
      lines.push(`${indent}<fxchannel num="${i + 1}" name="${this.escapeXML(channel.name)}" volume="${channel.volume}" muted="${channel.mute ? 1 : 0}">`);
      lines.push(this.exportFxChain(channel.effects, indent + '  '));
      
      // Sends
      for (const send of channel.sends) {
        lines.push(`${indent}  <send channel="0" amount="${send.amount}" />`);
      }
      
      lines.push(`${indent}</fxchannel>`);
    }

    return lines.join('\n');
  }

  /**
   * Export FX chain
   */
  private exportFxChain(effects: ProjectData['mixer']['masterChannel']['effects'], indent: string): string {
    if (effects.length === 0) return '';

    const lines: string[] = [];
    lines.push(`${indent}<fxchain>`);

    for (const effect of effects) {
      const name = this.mapEffectToAnkhWaveStudio(effect.type);
      lines.push(`${indent}  <effect name="${name}" on="${effect.enabled ? 1 : 0}" wet="${effect.wet}">`);
      
      // Effect parameters
      const params: string[] = [];
      for (const [key, value] of Object.entries(effect.params)) {
        params.push(`${key}="${value}"`);
      }
      
      if (params.length > 0) {
        lines.push(`${indent}    <${name} ${params.join(' ')} />`);
      }
      
      lines.push(`${indent}  </effect>`);
    }

    lines.push(`${indent}</fxchain>`);

    return lines.join('\n');
  }

  /**
   * Map web instrument name to AnkhWaveStudio name
   */
  private mapInstrumentToAnkhWaveStudio(webName: string): string {
    const map: Record<string, string> = {
      'TripleOscillator': 'tripleoscillator',
      'Kicker': 'kicker',
      'AudioFileProcessor': 'audiofileprocessor',
      'BitInvader': 'bitinvader',
      'LB302': 'lb302',
      'Mallets': 'malletsstk',
      'Monstro': 'monstro',
      'NES': 'nes',
      'Organic': 'organic',
      'Papu': 'papu',
      'SF2Player': 'sf2player',
      'Sfxr': 'sfxr',
      'SID': 'sid',
      'Vibed': 'vibedstrings',
      'Watsyn': 'watsyn',
      'Xpressive': 'xpressive',
    };
    return map[webName] || 'tripleoscillator';
  }

  /**
   * Map web effect name to AnkhWaveStudio name
   */
  private mapEffectToAnkhWaveStudio(webName: string): string {
    const map: Record<string, string> = {
      'Amplifier': 'amplifier',
      'BassBooster': 'bassbooster',
      'Bitcrush': 'bitcrush',
      'CrossoverEQ': 'crossovereq',
      'Delay': 'delay',
      'DualFilter': 'dualfilter',
      'DynamicsProcessor': 'dynamicsprocessor',
      'EQ': 'eq',
      'Flanger': 'flanger',
      'MultitapEcho': 'multitapecho',
      'Reverb': 'reverbsc',
      'StereoEnhancer': 'stereoenhancer',
      'StereoMatrix': 'stereomatrix',
      'Waveshaper': 'waveshaper',
    };
    return map[webName] || webName.toLowerCase();
  }

  /**
   * Convert color to AnkhWaveStudio format
   */
  private colorToAnkhWaveStudio(color: string): string | null {
    if (!color) return null;

    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return String((r << 16) | (g << 8) | b);
      }
    }

    // Handle hsl colors
    if (color.startsWith('hsl')) {
      // Convert HSL to RGB (simplified)
      const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (match) {
        const h = parseInt(match[1]) / 360;
        const s = parseInt(match[2]) / 100;
        const l = parseInt(match[3]) / 100;
        
        const { r, g, b } = this.hslToRgb(h, s, l);
        return String((r << 16) | (g << 8) | b);
      }
    }

    return null;
  }

  /**
   * Convert HSL to RGB
   */
  private hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Compress string with gzip
   */
  private async compressGzip(data: string): Promise<Blob> {
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(data);

    // Use CompressionStream if available
    if ('CompressionStream' in window) {
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      await writer.write(new Uint8Array(uint8Array.buffer) as unknown as BufferSource);
      await writer.close();

      const reader = cs.readable.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      return new Blob([result.buffer], { type: 'application/gzip' });
    }

    // Fallback: return uncompressed with warning
    console.warn('CompressionStream not available, returning uncompressed data');
    return new Blob([new Uint8Array(uint8Array)], { type: 'application/xml' });
  }

  /**
   * Add sample data for embedding
   */
  addSampleData(path: string, data: ArrayBuffer): void {
    const base64 = this.arrayBufferToBase64(data);
    this.sampleData.set(path, base64);
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

/**
 * Export project to AnkhWaveStudio format
 */
export async function exportAnkhWaveStudioProject(
  project: ProjectData,
  options: ExportOptions
): Promise<Blob> {
  const exporter = new AnkhWaveStudioProjectExporter();
  return exporter.export(project, options);
}

/**
 * Get file extension for format
 */
export function getExportExtension(format: 'mmp' | 'mmpz'): string {
  return format === 'mmpz' ? '.mmpz' : '.mmp';
}

export default AnkhWaveStudioProjectExporter;