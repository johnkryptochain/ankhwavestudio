// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * AnkhWaveStudio Project File Parser
 * Parses .mmp (XML) and .mmpz (compressed XML) project files
 */

import type {
  AnkhWaveStudioProjectFile,
  AnkhWaveStudioProjectHead,
  AnkhWaveStudioSong,
  AnkhWaveStudioTrack,
  AnkhWaveStudioInstrumentTrack,
  AnkhWaveStudioBBTrack,
  AnkhWaveStudioSampleTrack,
  AnkhWaveStudioAutomationTrack,
  AnkhWaveStudioInstrumentTrackData,
  AnkhWaveStudioPattern,
  AnkhWaveStudioNote,
  AnkhWaveStudioInstrument,
  AnkhWaveStudioEnvelopeLfoData,
  AnkhWaveStudioEnvelope,
  AnkhWaveStudioFxMixer,
  AnkhWaveStudioFxChannel,
  AnkhWaveStudioEffect,
  AnkhWaveStudioFxSend,
  AnkhWaveStudioSampleClip,
  AnkhWaveStudioAutomationPattern,
  AnkhWaveStudioAutomationPoint,
  AnkhWaveStudioImportResult,
  AnkhWaveStudioImportWarning,
  AnkhWaveStudioSampleReference,
  AnkhWaveStudioTrackType,
} from '../../types/ankhWaveProject';

/**
 * Decompress gzip data using native DecompressionStream API
 * Falls back to manual decompression if not available
 */
async function decompressGzip(data: ArrayBuffer): Promise<ArrayBuffer> {
  // Try native DecompressionStream first (modern browsers)
  if ('DecompressionStream' in window) {
    try {
      const ds = new DecompressionStream('gzip');
      const writer = ds.writable.getWriter();
      writer.write(new Uint8Array(data));
      writer.close();
      
      const reader = ds.readable.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      // Combine chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      return result.buffer;
    } catch (e) {
      console.warn('DecompressionStream failed, trying manual decompression:', e);
    }
  }
  
  // Manual gzip decompression (simplified implementation)
  // For full support, we'd need pako library
  throw new Error('Gzip decompression not supported in this browser. Please use a .mmp file instead of .mmpz');
}

/**
 * Parse XML string to Document
 */
function parseXML(xmlString: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');
  
  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML Parse Error: ${parseError.textContent}`);
  }
  
  return doc;
}

/**
 * Get attribute value from element with default
 */
function getAttr(element: Element, name: string, defaultValue: string = ''): string {
  return element.getAttribute(name) ?? defaultValue;
}

/**
 * Get numeric attribute value from element with default
 */
function getNumAttr(element: Element, name: string, defaultValue: number = 0): number {
  const value = element.getAttribute(name);
  if (value === null) return defaultValue;
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Get boolean attribute value from element
 */
function getBoolAttr(element: Element, name: string, defaultValue: boolean = false): boolean {
  const value = element.getAttribute(name);
  if (value === null) return defaultValue;
  return value === '1' || value === 'true';
}

/**
 * AnkhWaveStudio Project Parser class
 */
export class AnkhWaveStudioProjectParser {
  private warnings: AnkhWaveStudioImportWarning[] = [];
  private unsupportedFeatures: string[] = [];
  private sampleReferences: AnkhWaveStudioSampleReference[] = [];

  /**
   * Parse an AnkhWaveStudio project file (.mmp or .mmpz)
   */
  async parse(file: File): Promise<AnkhWaveStudioImportResult> {
    this.warnings = [];
    this.unsupportedFeatures = [];
    this.sampleReferences = [];

    let xmlString: string;

    if (file.name.toLowerCase().endsWith('.mmpz')) {
      // Compressed file - decompress first
      const arrayBuffer = await file.arrayBuffer();
      const decompressed = await decompressGzip(arrayBuffer);
      xmlString = new TextDecoder('utf-8').decode(decompressed);
    } else {
      // Plain XML file
      xmlString = await file.text();
    }

    const doc = parseXML(xmlString);
    const project = this.parseProject(doc);

    return {
      project,
      warnings: this.warnings,
      unsupportedFeatures: this.unsupportedFeatures,
    };
  }

  /**
   * Parse project from XML document
   */
  private parseProject(doc: Document): AnkhWaveStudioProjectFile {
    const root = doc.documentElement;
    
    if (root.tagName !== 'AnkhWaveStudio-project') {
      throw new Error('Invalid AnkhWaveStudio project file: Missing AnkhWaveStudio-project root element');
    }

    const version = getAttr(root, 'version', '1.0');
    const type = getAttr(root, 'type', 'song');
    const creator = getAttr(root, 'creator', 'AnkhWaveStudio');
    const creatorVersion = getAttr(root, 'creatorversion');

    if (type !== 'song') {
      this.addWarning('feature', `Project type "${type}" may not be fully supported`);
    }

    // Parse head
    const headElement = root.querySelector('head');
    const head = this.parseHead(headElement);

    // Parse song
    const songElement = root.querySelector('song');
    const song = this.parseSong(songElement);

    // Parse FX mixer
    const fxmixerElement = root.querySelector('fxmixer');
    const fxmixer = fxmixerElement ? this.parseFxMixer(fxmixerElement) : undefined;

    return {
      version,
      type: 'song',
      creator,
      creatorVersion,
      head,
      song,
      fxmixer,
    };
  }

  /**
   * Parse project head (global settings)
   */
  private parseHead(element: Element | null): AnkhWaveStudioProjectHead {
    if (!element) {
      return {
        bpm: 140,
        timesigNumerator: 4,
        timesigDenominator: 4,
        mastervol: 100,
        masterpitch: 0,
      };
    }

    return {
      bpm: getNumAttr(element, 'bpm', 140),
      timesigNumerator: getNumAttr(element, 'timesig_numerator', 4),
      timesigDenominator: getNumAttr(element, 'timesig_denominator', 4),
      mastervol: getNumAttr(element, 'mastervol', 100),
      masterpitch: getNumAttr(element, 'masterpitch', 0),
    };
  }

  /**
   * Parse song container
   */
  private parseSong(element: Element | null): AnkhWaveStudioSong {
    if (!element) {
      return { trackcontainer: { tracks: [] } };
    }

    const trackcontainerElement = element.querySelector('trackcontainer');
    const tracks = this.parseTrackContainer(trackcontainerElement);

    return {
      trackcontainer: { tracks },
    };
  }

  /**
   * Parse track container
   */
  private parseTrackContainer(element: Element | null): AnkhWaveStudioTrack[] {
    if (!element) return [];

    const trackElements = element.querySelectorAll(':scope > track');
    const tracks: AnkhWaveStudioTrack[] = [];

    for (const trackElement of trackElements) {
      const track = this.parseTrack(trackElement);
      if (track) {
        tracks.push(track);
      }
    }

    return tracks;
  }

  /**
   * Parse a single track
   */
  private parseTrack(element: Element): AnkhWaveStudioTrack | null {
    const type = getNumAttr(element, 'type', 0) as AnkhWaveStudioTrackType;
    const name = getAttr(element, 'name', 'Untitled Track');
    const muted = getBoolAttr(element, 'muted');
    const solo = getBoolAttr(element, 'solo');
    const color = getAttr(element, 'color');

    const baseTrack = { type, name, muted, solo, color };

    switch (type) {
      case 0: // Instrument track
        return this.parseInstrumentTrack(element, baseTrack);
      case 1: // BB track
        return this.parseBBTrack(element, baseTrack);
      case 2: // Sample track
        return this.parseSampleTrack(element, baseTrack);
      case 5: // Automation track
        return this.parseAutomationTrack(element, baseTrack);
      default:
        this.addWarning('feature', `Unknown track type: ${type}`);
        return null;
    }
  }

  /**
   * Parse instrument track
   */
  private parseInstrumentTrack(element: Element, baseTrack: AnkhWaveStudioTrack): AnkhWaveStudioInstrumentTrack {
    const instrumenttrackElement = element.querySelector('instrumenttrack');
    
    const instrumenttrack: AnkhWaveStudioInstrumentTrackData = {
      vol: getNumAttr(instrumenttrackElement!, 'vol', 100),
      pan: getNumAttr(instrumenttrackElement!, 'pan', 0),
      pitch: getNumAttr(instrumenttrackElement!, 'pitch', 0),
      pitchrange: getNumAttr(instrumenttrackElement!, 'pitchrange', 1),
      fxch: getNumAttr(instrumenttrackElement!, 'fxch', 0),
      basenote: getNumAttr(instrumenttrackElement!, 'basenote', 57),
      usemasterpitch: getBoolAttr(instrumenttrackElement!, 'usemasterpitch', true),
      instrument: this.parseInstrument(instrumenttrackElement!),
      eldata: this.parseEnvelopeLfoData(instrumenttrackElement!),
      patterns: this.parsePatterns(element),
    };

    return {
      ...baseTrack,
      type: 0,
      instrumenttrack,
    };
  }

  /**
   * Parse instrument definition
   */
  private parseInstrument(trackElement: Element): AnkhWaveStudioInstrument {
    const instrumentElement = trackElement.querySelector('instrument');
    
    if (!instrumentElement) {
      return { name: 'tripleoscillator', params: {} };
    }

    const name = getAttr(instrumentElement, 'name', 'tripleoscillator');
    
    // Get the instrument-specific element (e.g., <tripleoscillator>)
    const paramsElement = instrumentElement.querySelector(name);
    const params = this.parseInstrumentParams(paramsElement, name);

    return { name, params };
  }

  /**
   * Parse instrument-specific parameters
   */
  private parseInstrumentParams(element: Element | null, instrumentName: string): Record<string, unknown> {
    if (!element) return {};

    const params: Record<string, unknown> = {};
    
    // Get all attributes as parameters
    for (const attr of element.attributes) {
      const value = attr.value;
      // Try to parse as number
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        params[attr.name] = numValue;
      } else if (value === 'true' || value === '1') {
        params[attr.name] = true;
      } else if (value === 'false' || value === '0') {
        params[attr.name] = false;
      } else {
        params[attr.name] = value;
      }
    }

    // Handle special cases for certain instruments
    if (instrumentName === 'audiofileprocessor' || instrumentName === 'sf2player') {
      const src = params['src'] as string;
      if (src) {
        this.sampleReferences.push({
          path: src,
          embedded: false,
        });
      }
    }

    return params;
  }

  /**
   * Parse envelope and LFO data
   */
  private parseEnvelopeLfoData(trackElement: Element): AnkhWaveStudioEnvelopeLfoData | undefined {
    const eldataElement = trackElement.querySelector('eldata');
    if (!eldataElement) return undefined;

    return {
      elvol: this.parseEnvelope(eldataElement, 'elvol'),
      elcut: this.parseEnvelope(eldataElement, 'elcut'),
      elres: this.parseEnvelope(eldataElement, 'elres'),
    };
  }

  /**
   * Parse a single envelope
   */
  private parseEnvelope(eldataElement: Element, prefix: string): AnkhWaveStudioEnvelope {
    const element = eldataElement.querySelector(prefix);
    
    if (!element) {
      return {
        pdel: 0,
        att: 0,
        hold: 0.5,
        dec: 0.5,
        sustain: 0.5,
        rel: 0.1,
        amt: 0,
      };
    }

    return {
      pdel: getNumAttr(element, 'pdel', 0),
      att: getNumAttr(element, 'att', 0),
      hold: getNumAttr(element, 'hold', 0.5),
      dec: getNumAttr(element, 'dec', 0.5),
      sustain: getNumAttr(element, 'sustain', 0.5),
      rel: getNumAttr(element, 'rel', 0.1),
      amt: getNumAttr(element, 'amt', 0),
      lpdel: getNumAttr(element, 'lpdel', 0),
      latt: getNumAttr(element, 'latt', 0),
      lspd: getNumAttr(element, 'lspd', 0.1),
      lamt: getNumAttr(element, 'lamt', 0),
      lshp: getNumAttr(element, 'lshp', 0),
      x100: getBoolAttr(element, 'x100', false),
    };
  }

  /**
   * Parse patterns from track
   */
  private parsePatterns(trackElement: Element): AnkhWaveStudioPattern[] {
    const patternElements = trackElement.querySelectorAll(':scope > pattern');
    const patterns: AnkhWaveStudioPattern[] = [];

    for (const patternElement of patternElements) {
      const pattern = this.parsePattern(patternElement);
      patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * Parse a single pattern
   */
  private parsePattern(element: Element): AnkhWaveStudioPattern {
    const pos = getNumAttr(element, 'pos', 0);
    const len = getNumAttr(element, 'len');
    const name = getAttr(element, 'name');
    const muted = getBoolAttr(element, 'muted');
    const steps = getNumAttr(element, 'steps');

    const noteElements = element.querySelectorAll(':scope > note');
    const notes: AnkhWaveStudioNote[] = [];

    for (const noteElement of noteElements) {
      const note = this.parseNote(noteElement);
      notes.push(note);
    }

    return {
      pos,
      len: len || undefined,
      name: name || undefined,
      muted: muted || undefined,
      steps: steps || undefined,
      notes,
    };
  }

  /**
   * Parse a single note
   */
  private parseNote(element: Element): AnkhWaveStudioNote {
    return {
      pos: getNumAttr(element, 'pos', 0),
      len: getNumAttr(element, 'len', 48),
      key: getNumAttr(element, 'key', 60),
      vol: getNumAttr(element, 'vol', 100),
      pan: getNumAttr(element, 'pan', 0),
    };
  }

  /**
   * Parse BB track
   */
  private parseBBTrack(element: Element, baseTrack: AnkhWaveStudioTrack): AnkhWaveStudioBBTrack {
    const bbtrackElement = element.querySelector('bbtrack');
    
    // BB tracks contain their own track container
    const trackcontainerElement = bbtrackElement?.querySelector('trackcontainer');
    const tracks = this.parseTrackContainer(trackcontainerElement ?? null);

    // Parse BB pattern references
    const bbtcoElements = element.querySelectorAll(':scope > bbtco');
    const patterns = Array.from(bbtcoElements).map(el => ({
      pos: getNumAttr(el, 'pos', 0),
      len: getNumAttr(el, 'len', 192),
      name: getAttr(el, 'name') || undefined,
    }));

    return {
      ...baseTrack,
      type: 1,
      bbtrack: {
        trackcontainer: { tracks },
        patterns,
      },
    };
  }

  /**
   * Parse sample track
   */
  private parseSampleTrack(element: Element, baseTrack: AnkhWaveStudioTrack): AnkhWaveStudioSampleTrack {
    const sampletrackElement = element.querySelector('sampletrack');
    
    const vol = getNumAttr(sampletrackElement!, 'vol', 100);
    const pan = getNumAttr(sampletrackElement!, 'pan', 0);
    const fxch = getNumAttr(sampletrackElement!, 'fxch', 0);

    // Parse sample clips
    const sampletcoElements = element.querySelectorAll(':scope > sampletco');
    const clips: AnkhWaveStudioSampleClip[] = [];

    for (const clipElement of sampletcoElements) {
      const clip = this.parseSampleClip(clipElement);
      clips.push(clip);
    }

    return {
      ...baseTrack,
      type: 2,
      sampletrack: {
        vol,
        pan,
        fxch,
        clips,
      },
    };
  }

  /**
   * Parse sample clip
   */
  private parseSampleClip(element: Element): AnkhWaveStudioSampleClip {
    const src = getAttr(element, 'src', '');
    const data = getAttr(element, 'data');

    // Track sample reference
    if (src) {
      this.sampleReferences.push({
        path: src,
        embedded: !!data,
        data: data ? this.base64ToArrayBuffer(data) : undefined,
      });
    }

    return {
      pos: getNumAttr(element, 'pos', 0),
      len: getNumAttr(element, 'len', 0),
      src,
      off: getNumAttr(element, 'off', 0),
      muted: getBoolAttr(element, 'muted'),
      reversed: getBoolAttr(element, 'reversed'),
      looped: getBoolAttr(element, 'looped'),
      samplerate: getNumAttr(element, 'sample_rate'),
      data: data || undefined,
    };
  }

  /**
   * Parse automation track
   */
  private parseAutomationTrack(element: Element, baseTrack: AnkhWaveStudioTrack): AnkhWaveStudioAutomationTrack {
    const automationpatternElements = element.querySelectorAll(':scope > automationpattern');
    const patterns: AnkhWaveStudioAutomationPattern[] = [];

    for (const patternElement of automationpatternElements) {
      const pattern = this.parseAutomationPattern(patternElement);
      patterns.push(pattern);
    }

    return {
      ...baseTrack,
      type: 5,
      automationtrack: { patterns },
    };
  }

  /**
   * Parse automation pattern
   */
  private parseAutomationPattern(element: Element): AnkhWaveStudioAutomationPattern {
    const pos = getNumAttr(element, 'pos', 0);
    const len = getNumAttr(element, 'len', 192);
    const name = getAttr(element, 'name');
    const prog = getNumAttr(element, 'prog', 0);
    const tens = getNumAttr(element, 'tens', 0);
    const mute = getBoolAttr(element, 'mute');

    // Parse automation objects (targets)
    const objectElements = element.querySelectorAll(':scope > object');
    const objects = Array.from(objectElements).map(el => ({
      id: getAttr(el, 'id', ''),
    }));

    // Parse automation points
    const timeElement = element.querySelector('time');
    const points: AnkhWaveStudioAutomationPoint[] = [];

    if (timeElement) {
      // Points are stored as attributes like pos="0" value="0.5"
      const pointElements = element.querySelectorAll(':scope > time');
      for (const pointEl of pointElements) {
        points.push({
          pos: getNumAttr(pointEl, 'pos', 0),
          value: getNumAttr(pointEl, 'value', 0),
        });
      }
    }

    return {
      pos,
      len,
      name: name || undefined,
      prog,
      tens,
      mute: mute || undefined,
      objects,
      points,
    };
  }

  /**
   * Parse FX mixer
   */
  private parseFxMixer(element: Element): AnkhWaveStudioFxMixer {
    const channelElements = element.querySelectorAll(':scope > fxchannel');
    const channels: AnkhWaveStudioFxChannel[] = [];

    for (const channelElement of channelElements) {
      const channel = this.parseFxChannel(channelElement);
      channels.push(channel);
    }

    return { channels };
  }

  /**
   * Parse FX channel
   */
  private parseFxChannel(element: Element): AnkhWaveStudioFxChannel {
    const num = getNumAttr(element, 'num', 0);
    const name = getAttr(element, 'name');
    const volume = getNumAttr(element, 'volume', 1);
    const muted = getBoolAttr(element, 'muted');
    const soloed = getBoolAttr(element, 'soloed');

    // Parse effects
    const fxchainElement = element.querySelector('fxchain');
    const effects = this.parseFxChain(fxchainElement);

    // Parse sends
    const sendElements = element.querySelectorAll(':scope > send');
    const sends: AnkhWaveStudioFxSend[] = Array.from(sendElements).map(el => ({
      channel: getNumAttr(el, 'channel', 0),
      amount: getNumAttr(el, 'amount', 0),
    }));

    return {
      num,
      name: name || undefined,
      volume,
      muted: muted || undefined,
      soloed: soloed || undefined,
      effects,
      sends,
    };
  }

  /**
   * Parse FX chain
   */
  private parseFxChain(element: Element | null): AnkhWaveStudioEffect[] {
    if (!element) return [];

    const effectElements = element.querySelectorAll(':scope > effect');
    const effects: AnkhWaveStudioEffect[] = [];

    for (const effectElement of effectElements) {
      const effect = this.parseEffect(effectElement);
      if (effect) {
        effects.push(effect);
      }
    }

    return effects;
  }

  /**
   * Parse a single effect
   */
  private parseEffect(element: Element): AnkhWaveStudioEffect | null {
    const name = getAttr(element, 'name', '');
    const enabled = getBoolAttr(element, 'on', true);
    const wet = getNumAttr(element, 'wet', 1);
    const gate = getNumAttr(element, 'gate', 0);

    // Get effect-specific parameters
    const paramsElement = element.querySelector(name);
    const params: Record<string, unknown> = {};

    if (paramsElement) {
      for (const attr of paramsElement.attributes) {
        const value = attr.value;
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          params[attr.name] = numValue;
        } else {
          params[attr.name] = value;
        }
      }
    }

    return {
      name,
      enabled,
      wet,
      gate,
      params,
    };
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Add a warning
   */
  private addWarning(type: AnkhWaveStudioImportWarning['type'], message: string, details?: string): void {
    this.warnings.push({ type, message, details });
  }

  /**
   * Get sample references found during parsing
   */
  getSampleReferences(): AnkhWaveStudioSampleReference[] {
    return this.sampleReferences;
  }
}

/**
 * Check if a file is an AnkhWaveStudio project file
 */
export function isAnkhWaveStudioProjectFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.mmp') || name.endsWith('.mmpz');
}

/**
 * Get AnkhWaveStudio project file info without full parsing
 */
export async function getAnkhWaveStudioProjectInfo(file: File): Promise<{
  version: string;
  creator: string;
  bpm: number;
  trackCount: number;
}> {
  const parser = new AnkhWaveStudioProjectParser();
  const result = await parser.parse(file);
  
  return {
    version: result.project.version,
    creator: result.project.creator,
    bpm: result.project.head.bpm,
    trackCount: result.project.song.trackcontainer.tracks.length,
  };
}

export default AnkhWaveStudioProjectParser;