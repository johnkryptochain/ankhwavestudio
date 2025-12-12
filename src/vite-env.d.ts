// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Audio Worklet types
interface AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare var AudioWorkletProcessor: {
  prototype: AudioWorkletProcessor;
  new (): AudioWorkletProcessor;
};

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor
): void;

// Web MIDI API types (if not available in lib.dom.d.ts)
interface MIDIAccess {
  inputs: Map<string, MIDIInput>;
  outputs: Map<string, MIDIOutput>;
  onstatechange: ((event: MIDIConnectionEvent) => void) | null;
  sysexEnabled: boolean;
}

interface MIDIPort {
  id: string;
  manufacturer?: string;
  name?: string;
  type: 'input' | 'output';
  version?: string;
  state: 'connected' | 'disconnected';
  connection: 'open' | 'closed' | 'pending';
  onstatechange: ((event: MIDIConnectionEvent) => void) | null;
  open(): Promise<MIDIPort>;
  close(): Promise<MIDIPort>;
}

interface MIDIInput extends MIDIPort {
  type: 'input';
  onmidimessage: ((event: MIDIMessageEvent) => void) | null;
}

interface MIDIOutput extends MIDIPort {
  type: 'output';
  send(data: number[] | Uint8Array, timestamp?: number): void;
  clear(): void;
}

interface MIDIMessageEvent extends Event {
  data: Uint8Array;
}

interface MIDIConnectionEvent extends Event {
  port: MIDIPort;
}

interface Navigator {
  requestMIDIAccess(options?: { sysex?: boolean }): Promise<MIDIAccess>;
}