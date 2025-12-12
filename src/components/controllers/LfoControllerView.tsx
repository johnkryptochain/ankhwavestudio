// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import React, { useCallback } from 'react';
import { LFOController, LFOWaveform, useControllerStore } from '../../stores/controllerStore';
import { Knob, Button } from '../common';

interface LfoControllerViewProps {
  controller: LFOController;
}

export const LfoControllerView: React.FC<LfoControllerViewProps> = ({ controller }) => {
  const { updateController } = useControllerStore();

  const handleParamChange = useCallback((param: keyof LFOController, value: any) => {
    updateController(controller.id, { [param]: value });
  }, [controller.id, updateController]);

  return (
    <div className="flex flex-col gap-2 p-2 bg-daw-bg-surface rounded border border-daw-border">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-daw-text-primary">{controller.name}</span>
        <div className="flex gap-1">
          <Button 
            size="xs" 
            variant={controller.enabled ? 'primary' : 'secondary'}
            onClick={() => handleParamChange('enabled', !controller.enabled)}
          >
            {controller.enabled ? 'ON' : 'OFF'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="flex flex-col items-center">
          <Knob
            value={controller.amount}
            min={0}
            max={1}
            onChange={(v) => handleParamChange('amount', v)}
            size="sm"
            label="AMT"
          />
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={controller.frequency}
            min={0.1}
            max={20}
            onChange={(v) => handleParamChange('frequency', v)}
            size="sm"
            label="SPD"
          />
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={controller.phase}
            min={0}
            max={1}
            onChange={(v) => handleParamChange('phase', v)}
            size="sm"
            label="PHS"
          />
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={controller.offset}
            min={-1}
            max={1}
            onChange={(v) => handleParamChange('offset', v)}
            size="sm"
            label="OFF"
          />
        </div>
      </div>

      <div className="flex gap-1 mt-1">
        {Object.values(LFOWaveform).map((wave) => (
          <button
            key={wave}
            className={`w-6 h-6 rounded flex items-center justify-center text-[10px] ${
              controller.waveform === wave 
                ? 'bg-daw-accent-primary text-white' 
                : 'bg-daw-bg-input text-daw-text-secondary'
            }`}
            onClick={() => handleParamChange('waveform', wave)}
            title={wave}
          >
            {wave.substring(0, 1).toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
};
