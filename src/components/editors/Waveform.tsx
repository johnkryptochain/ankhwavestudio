// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import React, { useEffect, useRef, useState } from 'react';
import { getAudioEngineManager } from '../../audio/AudioEngineManager';

interface WaveformProps {
  sampleId: string;
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}

export const Waveform: React.FC<WaveformProps> = ({ 
  sampleId, 
  color = 'white', 
  width, 
  height,
  className 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const manager = getAudioEngineManager();
    
    const renderWaveform = () => {
      const sample = manager.getSample(sampleId);

      if (!sample) {
        // Sample might not be loaded yet. Retry in a bit.
        return false;
      }

      setIsLoaded(true);
      const buffer = sample.buffer;
      const data = buffer.getChannelData(0);
      
      // Use the parent's dimensions if width/height not provided
      let drawWidth = width || canvas.clientWidth || 100;
      const drawHeight = height || canvas.clientHeight || 50;
      
      // Cap width to avoid canvas limits
      if (drawWidth > 8000) drawWidth = 8000;
      
      // Set canvas resolution
      canvas.width = drawWidth;
      canvas.height = drawHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return true;

      ctx.clearRect(0, 0, drawWidth, drawHeight);
      ctx.fillStyle = color;
      
      // Draw waveform
      const step = Math.ceil(data.length / drawWidth);
      const amp = drawHeight / 2;
      
      ctx.beginPath();
      for (let i = 0; i < drawWidth; i++) {
        let min = 1.0;
        let max = -1.0;
        
        // Find min/max in this chunk
        for (let j = 0; j < step; j++) {
          const index = (i * step) + j;
          if (index < data.length) {
            const datum = data[index];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
          }
        }
        
        // If no data in chunk, skip
        if (min > max) continue;
        
        // Draw vertical line for this pixel
        // 1.0 -> 0 (top), -1.0 -> height (bottom)
        const y1 = (1 - max) * amp;
        const y2 = (1 - min) * amp;
        ctx.fillRect(i, y1, 1, Math.max(1, y2 - y1));
      }
      return true;
    };

    if (!renderWaveform()) {
      // Poll for sample loading
      const interval = setInterval(() => {
        if (renderWaveform()) {
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [sampleId, color, width, height]);

  if (!isLoaded) {
    // Generate a dense dummy waveform so it looks like audio even if not loaded
    // Use a fixed path to avoid hydration mismatches
    const points = [];
    for (let i = 0; i <= 100; i++) {
      // Create a "noisy" sine wave look
      const noise = (i % 3 === 0 ? 10 : (i % 2 === 0 ? -10 : 5)); 
      const y = 50 + Math.sin(i * 0.2) * 30 + noise;
      points.push(`L ${i} ${y}`);
    }
    const d = "M0 50 " + points.join(" ");
    
    return (
      <svg className={className} preserveAspectRatio="none" viewBox="0 0 100 100">
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          opacity="0.5"
        />
      </svg>
    );
  }

  return <canvas ref={canvasRef} className={className} />;
};
