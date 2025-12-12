// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import React, { useState, useEffect } from 'react';
import { MIDIController, useControllerStore } from '../../stores/controllerStore';
import { Knob, Button } from '../common';

interface MIDIControllerViewProps {
  controller: MIDIController;
}

export const MIDIControllerView: React.FC<MIDIControllerViewProps> = ({ controller }) => {
  const { updateController } = useControllerStore();
  const [isLearning, setIsLearning] = useState(false);
  const [lastActivity, setLastActivity] = useState(0);

  // Simulate MIDI activity for visualization
  useEffect(() => {
    // In a real app, this would subscribe to MIDI events
    const interval = setInterval(() => {
      if (Math.random() > 0.9) {
        setLastActivity(Date.now());
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const isActive = Date.now() - lastActivity < 200;

  const handleParamChange = (param: keyof MIDIController, value: any) => {
    updateController(controller.id, { [param]: value });
  };

  return (
    <div className="flex flex-col gap-3 p-3 bg-daw-bg-surface rounded-lg border border-daw-border shadow-sm">
      <div className="flex items-center justify-between border-b border-daw-border pb-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎹</span>
          <span className="text-xs font-bold text-daw-text-primary uppercase tracking-wider">{controller.name}</span>
        </div>
        <div className="flex gap-1">
          <Button 
            size="xs" 
            variant={isLearning ? 'primary' : 'secondary'}
            className={isLearning ? 'animate-pulse' : ''}
            onClick={() => setIsLearning(!isLearning)}
            title="MIDI Learn"
          >
            {isLearning ? 'LEARNING...' : 'LEARN'}
          </Button>
        </div>
      </div>

      {/* MIDI Status & Value */}
      <div className="flex items-center gap-3 bg-daw-bg-tertiary p-2 rounded border border-daw-border-dark">
        <div className="flex flex-col items-center justify-center w-12">
          <div className={`w-3 h-3 rounded-full transition-colors duration-100 ${isActive ? 'bg-daw-accent-primary shadow-[0_0_8px_rgba(78,205,196,0.8)]' : 'bg-daw-bg-active'}`} />
          <span className="text-[9px] text-daw-text-muted mt-1">MIDI IN</span>
        </div>
        
        <div className="flex-1 h-8 bg-daw-bg-dark rounded relative overflow-hidden border border-daw-border-dark">
          <div 
            className="h-full bg-daw-accent-primary opacity-20"
            style={{ width: `${controller.currentValue * 100}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-mono text-daw-accent-primary font-bold">
              {Math.round(controller.currentValue * 127)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* MIDI Settings */}
        <div className="space-y-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-daw-text-secondary uppercase">Channel</label>
            <select 
              value={controller.channel}
              onChange={(e) => handleParamChange('channel', parseInt(e.target.value))}
              className="bg-daw-bg-dark border border-daw-border rounded px-2 py-1 text-xs text-daw-text-primary focus:border-daw-accent-primary outline-none"
            >
              <option value={-1}>Omni (All)</option>
              {Array.from({ length: 16 }, (_, i) => (
                <option key={i} value={i}>Ch {i + 1}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-daw-text-secondary uppercase">CC Number</label>
            <input 
              type="number" 
              min={0} 
              max={127}
              value={controller.ccNumber}
              onChange={(e) => handleParamChange('ccNumber', parseInt(e.target.value))}
              className="bg-daw-bg-dark border border-daw-border rounded px-2 py-1 text-xs text-daw-text-primary focus:border-daw-accent-primary outline-none"
            />
          </div>
        </div>

        {/* Range Controls */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center">
            <Knob
              value={controller.minValue}
              min={0}
              max={1}
              step={0.01}
              size="sm"
              onChange={(v) => handleParamChange('minValue', v)}
              label="MIN"
            />
          </div>
          <div className="flex flex-col items-center">
            <Knob
              value={controller.maxValue}
              min={0}
              max={1}
              step={0.01}
              size="sm"
              onChange={(v) => handleParamChange('maxValue', v)}
              label="MAX"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
