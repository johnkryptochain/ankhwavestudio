// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Knob - Enhanced rotary control component for DAW parameters
 * Features: SVG-based, mouse drag, double-click reset, keyboard control, touch support
 */

import React, { useCallback, useRef, useState, useEffect, memo, forwardRef } from 'react';

export interface KnobProps {
  /** Current value */
  value: number;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step increment */
  step?: number;
  /** Default value for reset on double-click */
  defaultValue?: number;
  /** Knob size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Label text */
  label?: string;
  /** Show value display */
  showValue?: boolean;
  /** Custom value formatter */
  valueFormatter?: (value: number) => string;
  /** Value change callback */
  onChange?: (value: number) => void;
  /** Double-click callback (defaults to reset to defaultValue) */
  onDoubleClick?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Use logarithmic scaling */
  logarithmic?: boolean;
  /** Sensitivity multiplier for drag */
  sensitivity?: number;
  /** Color variant */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  /** Show bipolar indicator (center line) */
  bipolar?: boolean;
  /** Unit suffix for value display */
  unit?: string;
  /** Tooltip text */
  tooltip?: string;
}

const sizeConfigs = {
  xs: { size: 24, strokeWidth: 2, fontSize: 'text-[9px]', indicatorSize: 1, indicatorLength: 4, innerPadding: 4 },
  sm: { size: 32, strokeWidth: 2.5, fontSize: 'text-[10px]', indicatorSize: 1.5, indicatorLength: 5, innerPadding: 5 },
  md: { size: 44, strokeWidth: 3, fontSize: 'text-xs', indicatorSize: 2, indicatorLength: 6, innerPadding: 6 },
  lg: { size: 56, strokeWidth: 3.5, fontSize: 'text-sm', indicatorSize: 2.5, indicatorLength: 8, innerPadding: 8 },
  xl: { size: 72, strokeWidth: 4, fontSize: 'text-base', indicatorSize: 3, indicatorLength: 10, innerPadding: 10 },
};

const colorClasses = {
  primary: 'text-daw-accent-primary',
  secondary: 'text-daw-text-secondary',
  success: 'text-daw-accent-success',
  warning: 'text-daw-accent-warning',
  danger: 'text-daw-accent-secondary',
};

export const Knob = memo(forwardRef<HTMLDivElement, KnobProps>(({
  value,
  min = 0,
  max = 100,
  step = 1,
  defaultValue,
  size = 'md',
  label,
  showValue = true,
  valueFormatter,
  onChange,
  onDoubleClick,
  disabled = false,
  className = '',
  logarithmic = false,
  sensitivity = 1,
  color = 'primary',
  bipolar = false,
  unit = '',
  tooltip,
}, ref) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const startY = useRef(0);
  const startValue = useRef(0);
  const accumulatedDelta = useRef(0);

  const config = sizeConfigs[size];
  const radius = (config.size - config.strokeWidth) / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  const startAngle = 135;
  const endAngle = 405;
  const angleRange = endAngle - startAngle;

  // Calculate default value
  const resetValue = defaultValue !== undefined ? defaultValue : (bipolar ? (min + max) / 2 : min);

  // Format value for display
  const formatValue = useCallback((v: number): string => {
    if (valueFormatter) return valueFormatter(v);
    
    // Smart formatting based on range and step
    const range = max - min;
    if (step < 1 || range < 10) {
      return v.toFixed(1) + unit;
    }
    return Math.round(v).toString() + unit;
  }, [valueFormatter, max, min, step, unit]);

  // Convert between linear and logarithmic values
  const toLinear = useCallback((logValue: number): number => {
    if (!logarithmic) return logValue;
    const minLog = Math.log(Math.max(min, 0.001));
    const maxLog = Math.log(max);
    return (Math.log(Math.max(logValue, 0.001)) - minLog) / (maxLog - minLog);
  }, [logarithmic, min, max]);

  const fromLinear = useCallback((linearValue: number): number => {
    if (!logarithmic) return linearValue;
    const minLog = Math.log(Math.max(min, 0.001));
    const maxLog = Math.log(max);
    return Math.exp(minLog + linearValue * (maxLog - minLog));
  }, [logarithmic, min, max]);

  // Calculate the rotation angle based on value
  const normalizedValue = logarithmic ? toLinear(value) : (value - min) / (max - min);
  const clampedNormalized = Math.max(0, Math.min(1, normalizedValue));
  const rotation = startAngle + clampedNormalized * angleRange;

  // Calculate arc for value indicator
  const arcLength = clampedNormalized * (circumference * (angleRange / 360));

  // Calculate bipolar center position
  const bipolarCenter = bipolar ? 0.5 : 0;
  const bipolarArcStart = bipolar ? Math.min(clampedNormalized, 0.5) : 0;
  const bipolarArcLength = bipolar
    ? Math.abs(clampedNormalized - 0.5) * (circumference * (angleRange / 360))
    : arcLength;

  const clampValue = useCallback((v: number): number => {
    const clamped = Math.max(min, Math.min(max, v));
    return Math.round(clamped / step) * step;
  }, [min, max, step]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;
    accumulatedDelta.current = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startY.current - e.clientY;
      const baseSensitivity = (max - min) / 150;
      const adjustedSensitivity = baseSensitivity * sensitivity * (e.shiftKey ? 0.1 : 1);
      
      let newValue: number;
      if (logarithmic) {
        const linearStart = toLinear(startValue.current);
        const linearDelta = deltaY * adjustedSensitivity / (max - min);
        newValue = fromLinear(Math.max(0, Math.min(1, linearStart + linearDelta)));
      } else {
        newValue = startValue.current + deltaY * adjustedSensitivity;
      }
      
      onChange?.(clampValue(newValue));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ns-resize';
  }, [disabled, value, min, max, sensitivity, logarithmic, toLinear, fromLinear, clampValue, onChange]);

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    setIsDragging(true);
    startY.current = touch.clientY;
    startValue.current = value;

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const deltaY = startY.current - touch.clientY;
      const baseSensitivity = (max - min) / 150;
      
      let newValue: number;
      if (logarithmic) {
        const linearStart = toLinear(startValue.current);
        const linearDelta = deltaY * baseSensitivity * sensitivity / (max - min);
        newValue = fromLinear(Math.max(0, Math.min(1, linearStart + linearDelta)));
      } else {
        newValue = startValue.current + deltaY * baseSensitivity * sensitivity;
      }
      
      onChange?.(clampValue(newValue));
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }, [disabled, value, min, max, sensitivity, logarithmic, toLinear, fromLinear, clampValue, onChange]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (disabled) return;
    e.preventDefault();
    
    const direction = e.deltaY > 0 ? -1 : 1;
    const multiplier = e.shiftKey ? 0.1 : 1;
    const delta = step * direction * multiplier;
    
    onChange?.(clampValue(value + delta));
  }, [disabled, value, step, clampValue, onChange]);

  const handleDoubleClick = useCallback(() => {
    if (disabled) return;
    if (onDoubleClick) {
      onDoubleClick();
    } else {
      onChange?.(resetValue);
    }
  }, [disabled, onDoubleClick, onChange, resetValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    
    const multiplier = e.shiftKey ? 10 : 1;
    let newValue = value;
    
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        e.preventDefault();
        newValue = value + step * multiplier;
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        e.preventDefault();
        newValue = value - step * multiplier;
        break;
      case 'Home':
        e.preventDefault();
        newValue = min;
        break;
      case 'End':
        e.preventDefault();
        newValue = max;
        break;
      case 'PageUp':
        e.preventDefault();
        newValue = value + (max - min) * 0.1;
        break;
      case 'PageDown':
        e.preventDefault();
        newValue = value - (max - min) * 0.1;
        break;
      default:
        return;
    }
    
    onChange?.(clampValue(newValue));
  }, [disabled, value, min, max, step, clampValue, onChange]);

  // Prevent scroll when hovering over knob
  useEffect(() => {
    const element = knobRef.current;
    if (!element) return;

    const preventScroll = (e: WheelEvent) => {
      if (!disabled) {
        e.preventDefault();
      }
    };

    element.addEventListener('wheel', preventScroll, { passive: false });
    return () => element.removeEventListener('wheel', preventScroll);
  }, [disabled]);

  const centerX = config.size / 2;
  const centerY = config.size / 2;

  return (
    <div
      ref={ref}
      className={`flex flex-col items-center gap-0.5 ${className}`}
      title={tooltip}
    >
      {label && (
        <span className={`${config.fontSize} text-daw-text-muted truncate max-w-full leading-tight`}>
          {label}
        </span>
      )}
      <div
        ref={knobRef}
        className={`
          relative select-none outline-none
          ${disabled ? 'opacity-40 cursor-not-allowed' : (isDragging ? 'cursor-grabbing' : 'cursor-grab')}
          ${isFocused ? 'ring-2 ring-daw-accent-primary ring-offset-1 ring-offset-daw-bg-primary rounded-full' : ''}
        `.trim().replace(/\s+/g, ' ')}
        style={{ width: config.size, height: config.size }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        tabIndex={disabled ? -1 : 0}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={formatValue(value)}
        aria-label={label}
        aria-disabled={disabled}
      >
        <svg
          width={config.size}
          height={config.size}
          viewBox={`0 0 ${config.size} ${config.size}`}
          className="transform -rotate-90"
        >
          {/* Background track */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-daw-bg-surface"
            strokeDasharray={`${circumference * (angleRange / 360)} ${circumference}`}
            strokeDashoffset={-circumference * (startAngle / 360)}
            strokeLinecap="round"
          />
          
          {/* Bipolar center marker */}
          {bipolar && (
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={config.strokeWidth}
              className="text-daw-text-muted opacity-50"
              strokeDasharray={`2 ${circumference}`}
              strokeDashoffset={-circumference * ((startAngle + angleRange * 0.5) / 360)}
              strokeLinecap="round"
            />
          )}
          
          {/* Value arc */}
          {bipolar ? (
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={config.strokeWidth}
              className={`${colorClasses[color]} transition-all duration-50`}
              strokeDasharray={`${bipolarArcLength} ${circumference}`}
              strokeDashoffset={-circumference * ((startAngle + angleRange * Math.min(clampedNormalized, 0.5)) / 360)}
              strokeLinecap="round"
            />
          ) : (
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={config.strokeWidth}
              className={`${colorClasses[color]} transition-all duration-50`}
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={-circumference * (startAngle / 360)}
              strokeLinecap="round"
            />
          )}
        </svg>
        
        {/* Knob body */}
        <div
          className={`
            absolute rounded-full bg-gradient-to-b from-daw-bg-elevated to-daw-bg-tertiary
            border border-daw-border shadow-md
            transition-transform duration-50
            ${isDragging ? 'shadow-lg' : ''}
          `.trim().replace(/\s+/g, ' ')}
          style={{
            top: config.innerPadding,
            left: config.innerPadding,
            right: config.innerPadding,
            bottom: config.innerPadding,
            transform: `rotate(${rotation}deg)`,
          }}
        >
          {/* Indicator line */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 rounded-full ${colorClasses[color].replace('text-', 'bg-')}`}
            style={{
              top: 2,
              width: config.indicatorSize,
              height: config.indicatorLength,
            }}
          />
        </div>
      </div>
      
      {showValue && (
        <span className={`${config.fontSize} text-daw-text-secondary font-mono leading-tight tabular-nums`}>
          {formatValue(value)}
        </span>
      )}
    </div>
  );
}));

Knob.displayName = 'Knob';

export default Knob;