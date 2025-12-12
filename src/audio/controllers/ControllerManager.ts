// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import { AudioEngine } from '../AudioEngine';
import { Controller } from './Controller';
import { LfoController } from './LfoController';
import { ControllerData, ControllerType, LFOController } from '../../types/controller';
import { useControllerStore } from '../../stores/controllerStore';

export class ControllerManager {
  private engine: AudioEngine;
  private controllers: Map<string, Controller> = new Map();
  private isRunning: boolean = false;
  private updateInterval: number | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(engine: AudioEngine) {
    this.engine = engine;
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    // Subscribe to store changes
    this.unsubscribe = useControllerStore.subscribe(
      (state) => state.controllers,
      (controllers) => {
        this.syncControllers(controllers);
      }
    );
  }

  private syncControllers(controllersData: Record<string, ControllerData>): void {
    const currentIds = new Set(this.controllers.keys());
    const newIds = new Set(Object.keys(controllersData));

    // Remove deleted controllers
    currentIds.forEach(id => {
      if (!newIds.has(id)) {
        this.removeController(id);
      }
    });

    // Add or update controllers
    Object.values(controllersData).forEach(data => {
      if (this.controllers.has(data.id)) {
        this.updateController(data);
      } else {
        this.addController(data);
      }
    });
  }

  public addController(data: ControllerData): void {
    let controller: Controller | null = null;

    switch (data.type) {
      case ControllerType.LFO:
        controller = new LfoController(data.id, this.engine.getContext()?.sampleRate || 44100);
        this.updateLfoParams(controller as LfoController, data as LFOController);
        break;
      // Add other types here
    }

    if (controller) {
      this.controllers.set(data.id, controller);
    }
  }

  public removeController(id: string): void {
    this.controllers.delete(id);
  }

  public updateController(data: ControllerData): void {
    const controller = this.controllers.get(data.id);
    if (!controller) return;

    if (data.type === ControllerType.LFO && controller instanceof LfoController) {
      this.updateLfoParams(controller, data as LFOController);
    }
    
    controller.setEnabled(data.enabled);
  }

  private updateLfoParams(controller: LfoController, data: LFOController): void {
    controller.setParams({
      waveform: data.waveform,
      frequency: data.frequency,
      phase: data.phase,
      amount: data.amount,
      offset: data.offset,
      syncToTempo: data.syncToTempo,
      tempoSync: data.tempoSync
    });
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Update loop (approx 60fps for UI/Control updates)
    // For audio-rate modulation, we would need AudioWorklets
    this.updateInterval = window.setInterval(() => {
      this.process();
    }, 16);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private process(): void {
    const context = this.engine.getContext();
    if (!context) return;

    const time = context.currentTime;
    const transport = this.engine.getTransport();
    
    // Update BPM if needed
    if (transport) {
      // this.controllers.forEach(c => {
      //   if (c instanceof LfoController) {
      //     c.setBpm(transport.getBpm());
      //   }
      // });
    }

    // Calculate values and apply to targets
    this.controllers.forEach(controller => {
      if (!controller.isEnabled()) return;

      const value = controller.getValue(time);
      
      // TODO: Apply value to connected parameters
      // This requires a system to look up AudioParams by ID
      // console.log(`Controller ${controller.getId()} value: ${value}`);
    });
  }
}
