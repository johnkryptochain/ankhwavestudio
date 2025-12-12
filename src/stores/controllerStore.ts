// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Controller Store - Zustand store for controller management
 * 
 * Features:
 * - Controller definitions
 * - MIDI CC mapping
 * - LFO controllers
 * - Envelope controllers
 * - Peak controllers
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
  ControllerType, 
  LFOWaveform, 
  ControllerData as Controller, 
  LFOController, 
  EnvelopeController, 
  PeakController, 
  MIDIController,
  ControllerConnection 
} from '../types/controller';

export { ControllerType, LFOWaveform };
export type { Controller, LFOController, EnvelopeController, PeakController, MIDIController, ControllerConnection };

// ============================================================================
// Store State
// ============================================================================

interface ControllerState {
  // Controllers
  controllers: Record<string, Controller>;
  
  // Selection
  selectedControllerId: string | null;
  
  // Global state
  globalEnabled: boolean;
  
  // Actions - Controller management
  createController: (type: ControllerType, name?: string) => string;
  deleteController: (id: string) => void;
  duplicateController: (id: string) => string | null;
  getController: (id: string) => Controller | undefined;
  getAllControllers: () => Controller[];
  
  // Actions - Controller settings
  setControllerEnabled: (id: string, enabled: boolean) => void;
  setControllerName: (id: string, name: string) => void;
  updateController: (id: string, updates: Partial<Controller>) => void;
  
  // Actions - LFO specific
  setLFOWaveform: (id: string, waveform: LFOWaveform) => void;
  setLFOFrequency: (id: string, frequency: number) => void;
  setLFOPhase: (id: string, phase: number) => void;
  setLFOAmount: (id: string, amount: number) => void;
  setLFOOffset: (id: string, offset: number) => void;
  setLFOTempoSync: (id: string, sync: boolean, beats?: number) => void;
  
  // Actions - Envelope specific
  setEnvelopeADSR: (id: string, attack: number, decay: number, sustain: number, release: number) => void;
  setEnvelopeAmount: (id: string, amount: number) => void;
  setEnvelopeLoop: (id: string, enabled: boolean, start?: number, end?: number) => void;
  
  // Actions - Peak specific
  setPeakSource: (id: string, source: string) => void;
  setPeakAttackRelease: (id: string, attack: number, release: number) => void;
  setPeakThreshold: (id: string, threshold: number) => void;
  setPeakInvert: (id: string, invert: boolean) => void;
  
  // Actions - MIDI specific
  setMIDIChannel: (id: string, channel: number) => void;
  setMIDICCNumber: (id: string, ccNumber: number) => void;
  setMIDIRange: (id: string, min: number, max: number) => void;
  setMIDIValue: (id: string, value: number) => void;
  
  // Actions - Connections
  addConnection: (controllerId: string, connection: Omit<ControllerConnection, 'id'>) => string;
  removeConnection: (controllerId: string, connectionId: string) => void;
  updateConnection: (controllerId: string, connectionId: string, updates: Partial<ControllerConnection>) => void;
  getConnectionsForTarget: (targetType: string, targetId: string) => { controller: Controller; connection: ControllerConnection }[];
  
  // Actions - Selection
  selectController: (id: string | null) => void;
  
  // Actions - Global
  setGlobalEnabled: (enabled: boolean) => void;
  
  // Actions - Import/Export
  exportControllers: () => Controller[];
  importControllers: (controllers: Controller[]) => void;
  
  // Actions - Get value
  getControllerValue: (id: string, time: number, tempo: number) => number;
}

// ============================================================================
// Helper Functions
// ============================================================================

let controllerIdCounter = 0;
const generateControllerId = () => `controller-${++controllerIdCounter}`;

let connectionIdCounter = 0;
const generateConnectionId = () => `connection-${++connectionIdCounter}`;

/**
 * Create default LFO controller
 */
const createDefaultLFO = (name: string): LFOController => ({
  id: generateControllerId(),
  name,
  type: ControllerType.LFO,
  enabled: true,
  connections: [],
  waveform: LFOWaveform.Sine,
  frequency: 1,
  phase: 0,
  amount: 1,
  offset: 0,
  syncToTempo: false,
  tempoSync: 4
});

/**
 * Create default envelope controller
 */
const createDefaultEnvelope = (name: string): EnvelopeController => ({
  id: generateControllerId(),
  name,
  type: ControllerType.Envelope,
  enabled: true,
  connections: [],
  attack: 0.1,
  decay: 0.2,
  sustain: 0.7,
  release: 0.3,
  amount: 1,
  loopEnabled: false,
  loopStart: 0,
  loopEnd: 2
});

/**
 * Create default peak controller
 */
const createDefaultPeak = (name: string): PeakController => ({
  id: generateControllerId(),
  name,
  type: ControllerType.Peak,
  enabled: true,
  connections: [],
  inputSource: '',
  attack: 0.01,
  release: 0.1,
  amount: 1,
  threshold: -20,
  invert: false
});

/**
 * Create default MIDI controller
 */
const createDefaultMIDI = (name: string): MIDIController => ({
  id: generateControllerId(),
  name,
  type: ControllerType.MIDI,
  enabled: true,
  connections: [],
  channel: 0,
  ccNumber: 1,
  minValue: 0,
  maxValue: 1,
  defaultValue: 0.5,
  currentValue: 0.5
});

/**
 * Calculate LFO value at time
 */
const calculateLFOValue = (lfo: LFOController, time: number, tempo: number): number => {
  let frequency = lfo.frequency;
  
  if (lfo.syncToTempo) {
    // Convert tempo sync to frequency
    const beatsPerSecond = tempo / 60;
    frequency = beatsPerSecond / lfo.tempoSync;
  }
  
  const phase = (time * frequency + lfo.phase) % 1;
  let value: number;
  
  switch (lfo.waveform) {
    case LFOWaveform.Sine:
      value = Math.sin(phase * Math.PI * 2);
      break;
    case LFOWaveform.Triangle:
      value = phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4;
      break;
    case LFOWaveform.Sawtooth:
      value = phase * 2 - 1;
      break;
    case LFOWaveform.Square:
      value = phase < 0.5 ? 1 : -1;
      break;
    case LFOWaveform.Random:
      // Use time-based seed for consistent random
      value = (Math.sin(Math.floor(time * frequency) * 12.9898) * 43758.5453) % 1 * 2 - 1;
      break;
    case LFOWaveform.RandomSmooth:
      // Interpolated random
      const t = phase;
      const seed1 = Math.floor(time * frequency);
      const seed2 = seed1 + 1;
      const v1 = (Math.sin(seed1 * 12.9898) * 43758.5453) % 1 * 2 - 1;
      const v2 = (Math.sin(seed2 * 12.9898) * 43758.5453) % 1 * 2 - 1;
      value = v1 + (v2 - v1) * t;
      break;
    default:
      value = 0;
  }
  
  // Apply amount and offset
  return (value * lfo.amount + lfo.offset + 1) / 2; // Normalize to 0-1
};

/**
 * Calculate envelope value at time
 */
const calculateEnvelopeValue = (env: EnvelopeController, time: number): number => {
  const totalTime = env.attack + env.decay + env.release;
  let t = time;
  
  if (env.loopEnabled && time > 0) {
    // Calculate loop time
    const loopPoints = [0, env.attack, env.attack + env.decay, totalTime];
    const loopStart = loopPoints[env.loopStart];
    const loopEnd = loopPoints[env.loopEnd];
    const loopLength = loopEnd - loopStart;
    
    if (loopLength > 0 && time > loopStart) {
      t = loopStart + ((time - loopStart) % loopLength);
    }
  }
  
  let value: number;
  
  if (t < env.attack) {
    // Attack phase
    value = t / env.attack;
  } else if (t < env.attack + env.decay) {
    // Decay phase
    const decayProgress = (t - env.attack) / env.decay;
    value = 1 - (1 - env.sustain) * decayProgress;
  } else if (t < env.attack + env.decay + env.release) {
    // Release phase (or sustain if looping)
    if (env.loopEnabled) {
      value = env.sustain;
    } else {
      const releaseProgress = (t - env.attack - env.decay) / env.release;
      value = env.sustain * (1 - releaseProgress);
    }
  } else {
    value = 0;
  }
  
  return value * env.amount;
};

// ============================================================================
// Store
// ============================================================================

export const useControllerStore = create<ControllerState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    controllers: {},
    selectedControllerId: null,
    globalEnabled: true,
    
    // Create controller
    createController: (type, name) => {
      let controller: Controller;
      const defaultName = name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${Object.keys(get().controllers).length + 1}`;
      
      switch (type) {
        case ControllerType.LFO:
          controller = createDefaultLFO(defaultName);
          break;
        case ControllerType.Envelope:
          controller = createDefaultEnvelope(defaultName);
          break;
        case ControllerType.Peak:
          controller = createDefaultPeak(defaultName);
          break;
        case ControllerType.MIDI:
          controller = createDefaultMIDI(defaultName);
          break;
        default:
          controller = createDefaultLFO(defaultName);
      }
      
      set(state => ({
        controllers: { ...state.controllers, [controller.id]: controller }
      }));
      
      return controller.id;
    },
    
    // Delete controller
    deleteController: (id) => {
      set(state => {
        const { [id]: _, ...rest } = state.controllers;
        return {
          controllers: rest,
          selectedControllerId: state.selectedControllerId === id ? null : state.selectedControllerId
        };
      });
    },
    
    // Duplicate controller
    duplicateController: (id) => {
      const controller = get().controllers[id];
      if (!controller) return null;
      
      const newController = {
        ...controller,
        id: generateControllerId(),
        name: `${controller.name} (Copy)`,
        connections: controller.connections.map(c => ({
          ...c,
          id: generateConnectionId()
        }))
      };
      
      set(state => ({
        controllers: { ...state.controllers, [newController.id]: newController }
      }));
      
      return newController.id;
    },
    
    // Get controller
    getController: (id) => get().controllers[id],
    
    // Get all controllers
    getAllControllers: () => Object.values(get().controllers),
    
    // Set controller enabled
    setControllerEnabled: (id, enabled) => {
      set(state => ({
        controllers: {
          ...state.controllers,
          [id]: { ...state.controllers[id], enabled }
        }
      }));
    },
    
    // Set controller name
    setControllerName: (id, name) => {
      set(state => ({
        controllers: {
          ...state.controllers,
          [id]: { ...state.controllers[id], name }
        }
      }));
    },
    
    // Update controller
    updateController: (id, updates) => {
      set(state => {
        const controller = state.controllers[id];
        if (!controller) return state;
        return {
          controllers: {
            ...state.controllers,
            [id]: { ...controller, ...updates } as Controller
          }
        };
      });
    },
    
    // LFO specific
    setLFOWaveform: (id, waveform) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.LFO) {
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: { ...state.controllers[id], waveform } as LFOController
          }
        }));
      }
    },
    
    setLFOFrequency: (id, frequency) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.LFO) {
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: { ...state.controllers[id], frequency } as LFOController
          }
        }));
      }
    },
    
    setLFOPhase: (id, phase) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.LFO) {
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: { ...state.controllers[id], phase } as LFOController
          }
        }));
      }
    },
    
    setLFOAmount: (id, amount) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.LFO) {
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: { ...state.controllers[id], amount } as LFOController
          }
        }));
      }
    },
    
    setLFOOffset: (id, offset) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.LFO) {
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: { ...state.controllers[id], offset } as LFOController
          }
        }));
      }
    },
    
    setLFOTempoSync: (id, sync, beats) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.LFO) {
        const lfoController = controller as LFOController;
        const updated: LFOController = {
          ...lfoController,
          syncToTempo: sync,
          tempoSync: beats !== undefined ? beats : lfoController.tempoSync
        };
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: updated
          }
        }));
      }
    },
    
    // Envelope specific
    setEnvelopeADSR: (id, attack, decay, sustain, release) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.Envelope) {
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: { ...state.controllers[id], attack, decay, sustain, release } as EnvelopeController
          }
        }));
      }
    },
    
    setEnvelopeAmount: (id, amount) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.Envelope) {
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: { ...state.controllers[id], amount } as EnvelopeController
          }
        }));
      }
    },
    
    setEnvelopeLoop: (id, enabled, start, end) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.Envelope) {
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: { 
              ...state.controllers[id], 
              loopEnabled: enabled,
              ...(start !== undefined ? { loopStart: start } : {}),
              ...(end !== undefined ? { loopEnd: end } : {})
            } as EnvelopeController
          }
        }));
      }
    },
    
    // Peak specific
    setPeakSource: (id, source) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.Peak) {
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: { ...state.controllers[id], inputSource: source } as PeakController
          }
        }));
      }
    },
    
    setPeakAttackRelease: (id, attack, release) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.Peak) {
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: { ...state.controllers[id], attack, release } as PeakController
          }
        }));
      }
    },
    
    setPeakThreshold: (id, threshold) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.Peak) {
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: { ...state.controllers[id], threshold } as PeakController
          }
        }));
      }
    },
    
    setPeakInvert: (id, invert) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.Peak) {
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: { ...state.controllers[id], invert } as PeakController
          }
        }));
      }
    },
    
    // MIDI specific
    setMIDIChannel: (id, channel) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.MIDI) {
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: { ...state.controllers[id], channel } as MIDIController
          }
        }));
      }
    },
    
    setMIDICCNumber: (id, ccNumber) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.MIDI) {
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: { ...state.controllers[id], ccNumber } as MIDIController
          }
        }));
      }
    },
    
    setMIDIRange: (id, min, max) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.MIDI) {
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: { ...state.controllers[id], minValue: min, maxValue: max } as MIDIController
          }
        }));
      }
    },
    
    setMIDIValue: (id, value) => {
      const controller = get().controllers[id];
      if (controller?.type === ControllerType.MIDI) {
        set(state => ({
          controllers: {
            ...state.controllers,
            [id]: { ...state.controllers[id], currentValue: value } as MIDIController
          }
        }));
      }
    },
    
    // Connections
    addConnection: (controllerId, connection) => {
      const connectionId = generateConnectionId();
      const newConnection: ControllerConnection = {
        ...connection,
        id: connectionId
      };
      
      set(state => {
        const controller = state.controllers[controllerId];
        if (!controller) return state;
        
        return {
          controllers: {
            ...state.controllers,
            [controllerId]: {
              ...controller,
              connections: [...controller.connections, newConnection]
            }
          }
        };
      });
      
      return connectionId;
    },
    
    removeConnection: (controllerId, connectionId) => {
      set(state => {
        const controller = state.controllers[controllerId];
        if (!controller) return state;
        
        return {
          controllers: {
            ...state.controllers,
            [controllerId]: {
              ...controller,
              connections: controller.connections.filter(c => c.id !== connectionId)
            }
          }
        };
      });
    },
    
    updateConnection: (controllerId, connectionId, updates) => {
      set(state => {
        const controller = state.controllers[controllerId];
        if (!controller) return state;
        
        return {
          controllers: {
            ...state.controllers,
            [controllerId]: {
              ...controller,
              connections: controller.connections.map(c =>
                c.id === connectionId ? { ...c, ...updates } : c
              )
            }
          }
        };
      });
    },
    
    getConnectionsForTarget: (targetType, targetId) => {
      const result: { controller: Controller; connection: ControllerConnection }[] = [];
      
      for (const controller of Object.values(get().controllers)) {
        for (const connection of controller.connections) {
          if (connection.targetType === targetType && connection.targetId === targetId) {
            result.push({ controller, connection });
          }
        }
      }
      
      return result;
    },
    
    // Selection
    selectController: (id) => {
      set({ selectedControllerId: id });
    },
    
    // Global
    setGlobalEnabled: (enabled) => {
      set({ globalEnabled: enabled });
    },
    
    // Export
    exportControllers: () => Object.values(get().controllers),
    
    // Import
    importControllers: (controllers) => {
      const controllersRecord: Record<string, Controller> = {};
      for (const controller of controllers) {
        controllersRecord[controller.id] = controller;
      }
      set({ controllers: controllersRecord });
    },
    
    // Get value
    getControllerValue: (id, time, tempo) => {
      const controller = get().controllers[id];
      if (!controller || !controller.enabled || !get().globalEnabled) {
        return 0.5; // Default neutral value
      }
      
      switch (controller.type) {
        case ControllerType.LFO:
          return calculateLFOValue(controller, time, tempo);
        case ControllerType.Envelope:
          return calculateEnvelopeValue(controller, time);
        case ControllerType.MIDI:
          return controller.currentValue;
        case ControllerType.Peak:
          // Peak controller value is set externally based on audio analysis
          return 0.5;
        default:
          return 0.5;
      }
    }
  }))
);

export default useControllerStore;