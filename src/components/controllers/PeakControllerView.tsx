// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import React, { useState, useEffect, useRef } from 'react';
import { PeakController, useControllerStore } from '../../stores/controllerStore';
import { Knob, Button } from '../common';

interface PeakControllerViewProps {
  controller: PeakController;
}

export const PeakControllerView: React.FC<PeakControllerViewProps> = ({ controller }) => {
  const { updateController } = useControllerStore();
  const [simulatedLevel, setSimulatedLevel] = useState(0);
  const animationRef = useRef<number>();

  // Simulate peak level for visualization (since we don't have real audio metering connected to UI yet)
  useEffect(() => {
    const animate = () => {
      // Random fluctuation for demo purposes
      const target = Math.random() * 0.8;
      setSimulatedLevel(prev => prev + (target - prev) * 0.1);
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const handleParamChange = (param: keyof PeakController, value: any) => {
    updateController(controller.id, { [param]: value });
  };

  return (
    <div className="flex flex-col gap-3 p-3 bg-daw-bg-surface rounded-lg border border-daw-border shadow-sm">
      <div className="flex items-center justify-between border-b border-daw-border pb-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">📈</span>
          <span className="text-xs font-bold text-daw-text-primary uppercase tracking-wider">{controller.name}</span>
        </div>
        <div className="flex gap-1">
          <Button size="xs" variant="ghost" className="h-6 w-6 p-0" title="Settings">⚙️</Button>
        </div>
      </div>

      {/* Meter Visualization */}
      <div className="bg-daw-bg-tertiary rounded p-2 border border-daw-border-dark">
        <div className="flex justify-between text-[10px] text-daw-text-muted mb-1">
          <span>IN</span>
          <span>{Math.round(simulatedLevel * 100)}%</span>
        </div>
        <div className="h-4 bg-daw-bg-dark rounded-sm overflow-hidden relative w-full">
          <div 
            className="h-full bg-gradient-to-r from-daw-accent-success to-daw-accent-warning transition-all duration-75 ease-out"
            style={{ width: `${simulatedLevel * 100}%` }}
          />
          {/* Threshold Line */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-daw-text-primary z-10 shadow-[0_0_4px_rgba(255,255,255,0.5)]"
            style={{ left: `${((controller.threshold + 48) / 54) * 100}%` }} // Mapping -48dB to +6dB roughly
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-daw-text-secondary uppercase">Base</label>
            <Knob
              value={controller.amount}
              min={0}
              max={1}
              step={0.01}
              size="sm"
              onChange={(v) => handleParamChange('amount', v)}
              label="AMT"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-daw-text-secondary uppercase">Thr</label>
            <Knob
              value={controller.threshold}
              min={-48}
              max={6}
              step={0.1}
              size="sm"
              onChange={(v) => handleParamChange('threshold', v)}
              label="dB"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-daw-text-secondary uppercase">Atk</label>
            <Knob
              value={controller.attack}
              min={0.001}
              max={1}
              step={0.001}
              size="sm"
              onChange={(v) => handleParamChange('attack', v)}
              label="ms"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[10px] text-daw-text-secondary uppercase">Rel</label>
            <Knob
              value={controller.release}
              min={0.001}
              max={2}
              step={0.001}
              size="sm"
              onChange={(v) => handleParamChange('release', v)}
              label="ms"
            />
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="flex items-center gap-2 mt-1 pt-2 border-t border-daw-border-light">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input 
            type="checkbox" 
            checked={controller.invert}
            onChange={(e) => handleParamChange('invert', e.target.checked)}
            className="w-3 h-3 rounded border-daw-border bg-daw-bg-dark text-daw-accent-primary focus:ring-0 focus:ring-offset-0"
          />
          <span className="text-xs text-daw-text-secondary group-hover:text-daw-text-primary transition-colors">Invert Output</span>
        </label>
      </div>
    </div>
  );
};
