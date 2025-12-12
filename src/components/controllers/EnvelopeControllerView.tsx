// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import React, { useRef, useEffect } from 'react';
import { EnvelopeController, useControllerStore } from '../../stores/controllerStore';
import { Knob, Button } from '../common';

interface EnvelopeControllerViewProps {
  controller: EnvelopeController;
}

const EnvelopePreview: React.FC<{ controller: EnvelopeController }> = ({ controller }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { attack, decay, sustain, release, loopEnabled } = controller;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 8;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Calculate total time and scale
    // Normalize values for visualization
    const totalTime = attack + decay + release + 0.5; // +0.5 for sustain visualization
    const sustainTime = 0.5; 
    const fullTime = attack + decay + sustainTime + release;
    const timeScale = (width - padding * 2) / fullTime;

    // Calculate points
    const startY = height - padding;
    const peakY = padding;
    const sustainY = padding + (1 - sustain) * (height - padding * 2);
    
    const points = [
      { x: padding, y: startY }, // Start
      { x: padding + attack * timeScale, y: peakY }, // Attack peak
      { x: padding + (attack + decay) * timeScale, y: sustainY }, // Decay end
      { x: padding + (attack + decay + sustainTime) * timeScale, y: sustainY }, // Sustain end
      { x: padding + fullTime * timeScale, y: startY }, // Release end
    ];

    // Draw grid/background
    ctx.fillStyle = '#1e1e2e'; // daw-bg-dark
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = '#2a2a3c'; // daw-border
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw envelope fill
    ctx.fillStyle = 'rgba(255, 107, 107, 0.1)'; // daw-accent-error with opacity
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    // Attack (exponential curve approximation)
    ctx.quadraticCurveTo(
      points[0].x + (points[1].x - points[0].x) * 0.2, 
      points[1].y + (points[0].y - points[1].y) * 0.2,
      points[1].x, 
      points[1].y
    );
    
    // Decay (exponential curve approximation)
    ctx.quadraticCurveTo(
      points[1].x + (points[2].x - points[1].x) * 0.2, 
      points[2].y + (points[1].y - points[2].y) * 0.2,
      points[2].x, 
      points[2].y
    );
    
    // Sustain
    ctx.lineTo(points[3].x, points[3].y);
    
    // Release (exponential curve approximation)
    ctx.quadraticCurveTo(
      points[3].x + (points[4].x - points[3].x) * 0.2, 
      points[4].y + (points[3].y - points[4].y) * 0.2,
      points[4].x, 
      points[4].y
    );
    
    ctx.lineTo(points[4].x, height - padding);
    ctx.lineTo(points[0].x, height - padding);
    ctx.fill();

    // Draw envelope stroke
    ctx.strokeStyle = '#ff6b6b'; // daw-accent-error
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    // Attack
    ctx.quadraticCurveTo(
      points[0].x + (points[1].x - points[0].x) * 0.2, 
      points[1].y + (points[0].y - points[1].y) * 0.2,
      points[1].x, 
      points[1].y
    );
    
    // Decay
    ctx.quadraticCurveTo(
      points[1].x + (points[2].x - points[1].x) * 0.2, 
      points[2].y + (points[1].y - points[2].y) * 0.2,
      points[2].x, 
      points[2].y
    );
    
    // Sustain
    ctx.lineTo(points[3].x, points[3].y);
    
    // Release
    ctx.quadraticCurveTo(
      points[3].x + (points[4].x - points[3].x) * 0.2, 
      points[4].y + (points[3].y - points[4].y) * 0.2,
      points[4].x, 
      points[4].y
    );
    
    ctx.stroke();

  }, [attack, decay, sustain, release, loopEnabled]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={80} 
      className="w-full h-20 rounded border border-daw-border bg-daw-bg-dark"
    />
  );
};

export const EnvelopeControllerView: React.FC<EnvelopeControllerViewProps> = ({ controller }) => {
  const { updateController } = useControllerStore();

  const handleParamChange = (param: keyof EnvelopeController, value: any) => {
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

      <EnvelopePreview controller={controller} />

      <div className="grid grid-cols-5 gap-2">
        <div className="flex flex-col items-center">
          <Knob
            value={controller.attack}
            min={0}
            max={2}
            step={0.01}
            size="sm"
            onChange={(v) => handleParamChange('attack', v)}
            label="ATK"
          />
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={controller.decay}
            min={0}
            max={2}
            step={0.01}
            size="sm"
            onChange={(v) => handleParamChange('decay', v)}
            label="DEC"
          />
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={controller.sustain}
            min={0}
            max={1}
            step={0.01}
            size="sm"
            onChange={(v) => handleParamChange('sustain', v)}
            label="SUS"
          />
        </div>
        <div className="flex flex-col items-center">
          <Knob
            value={controller.release}
            min={0}
            max={5}
            step={0.01}
            size="sm"
            onChange={(v) => handleParamChange('release', v)}
            label="REL"
          />
        </div>
        <div className="flex flex-col items-center border-l border-daw-border pl-2">
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
      </div>

      {/* Options */}
      <div className="flex items-center gap-2 mt-1 pt-2 border-t border-daw-border-light">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input 
            type="checkbox" 
            checked={controller.loopEnabled}
            onChange={(e) => handleParamChange('loopEnabled', e.target.checked)}
            className="w-3 h-3 rounded border-daw-border bg-daw-bg-dark text-daw-accent-primary focus:ring-0 focus:ring-offset-0"
          />
          <span className="text-xs text-daw-text-secondary group-hover:text-daw-text-primary transition-colors">Loop Envelope</span>
        </label>
      </div>
    </div>
  );
};
