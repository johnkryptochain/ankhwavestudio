// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Knob - Rotary control component for audio parameters
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';

export interface KnobProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  size?: number;
  color?: string;
  backgroundColor?: string;
  logarithmic?: boolean;
  disabled?: boolean;
  label?: string;
}

export const Knob: React.FC<KnobProps> = ({
  value,
  min,
  max,
  step,
  onChange,
  size = 50,
  color = '#00ff00',
  backgroundColor = '#1a1a2e',
  logarithmic = false,
  disabled = false,
  label,
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startValue, setStartValue] = useState(0);
  
  // Convert value to normalized (0-1) range
  const normalizeValue = useCallback((val: number): number => {
    if (logarithmic && min > 0) {
      const logMin = Math.log(min);
      const logMax = Math.log(max);
      return (Math.log(val) - logMin) / (logMax - logMin);
    }
    return (val - min) / (max - min);
  }, [min, max, logarithmic]);
  
  // Convert normalized value back to actual value
  const denormalizeValue = useCallback((normalized: number): number => {
    if (logarithmic && min > 0) {
      const logMin = Math.log(min);
      const logMax = Math.log(max);
      return Math.exp(logMin + normalized * (logMax - logMin));
    }
    return min + normalized * (max - min);
  }, [min, max, logarithmic]);
  
  // Calculate rotation angle from value (-135 to 135 degrees)
  const getRotation = useCallback((): number => {
    const normalized = normalizeValue(value);
    return -135 + normalized * 270;
  }, [value, normalizeValue]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    setStartY(e.clientY);
    setStartValue(normalizeValue(value));
  }, [disabled, value, normalizeValue]);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const deltaY = startY - e.clientY;
    const sensitivity = 0.005;
    let newNormalized = startValue + deltaY * sensitivity;
    newNormalized = Math.max(0, Math.min(1, newNormalized));
    
    let newValue = denormalizeValue(newNormalized);
    
    // Apply step if specified
    if (step) {
      newValue = Math.round(newValue / step) * step;
    }
    
    // Clamp to range
    newValue = Math.max(min, Math.min(max, newValue));
    
    onChange(newValue);
  }, [isDragging, startY, startValue, denormalizeValue, step, min, max, onChange]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Handle wheel events
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (disabled) return;
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? -1 : 1;
    const stepSize = step || (max - min) / 100;
    let newValue = value + delta * stepSize;
    newValue = Math.max(min, Math.min(max, newValue));
    
    onChange(newValue);
  }, [disabled, value, min, max, step, onChange]);
  
  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  const rotation = getRotation();
  
  return (
    <div
      ref={knobRef}
      style={{
        width: size,
        height: size,
        position: 'relative',
        cursor: disabled ? 'not-allowed' : (isDragging ? 'grabbing' : 'grab'),
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
    >
      {/* Background circle */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* Track */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#333"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="188.5"
          strokeDashoffset="47"
          transform="rotate(135 50 50)"
        />
        
        {/* Value arc */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${normalizeValue(value) * 188.5} 188.5`}
          strokeDashoffset="0"
          transform="rotate(135 50 50)"
          style={{
            filter: `drop-shadow(0 0 3px ${color})`,
          }}
        />
        
        {/* Center circle */}
        <circle
          cx="50"
          cy="50"
          r="30"
          fill={backgroundColor}
          stroke="#444"
          strokeWidth="2"
        />
        
        {/* Indicator line */}
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="25"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          transform={`rotate(${rotation} 50 50)`}
          style={{
            filter: `drop-shadow(0 0 2px ${color})`,
          }}
        />
      </svg>
      
      {label && (
        <div
          style={{
            position: 'absolute',
            bottom: -16,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: '10px',
            color: '#888',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

export default Knob;