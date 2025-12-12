// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Slider - Enhanced horizontal/vertical slider component (Fader)
 * Features: Marks/ticks, range slider, touch support, keyboard control
 */

import React, { useCallback, useRef, useState, useEffect, memo, forwardRef } from 'react';

export interface SliderMark {
  value: number;
  label?: string;
}

export interface SliderProps {
  /** Current value (or [min, max] for range slider) */
  value: number | [number, number];
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step increment */
  step?: number;
  /** Default value for reset on double-click */
  defaultValue?: number | [number, number];
  /** Slider orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Slider size */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Label text */
  label?: string;
  /** Show value display */
  showValue?: boolean;
  /** Custom value formatter */
  valueFormatter?: (value: number) => string;
  /** Value change callback */
  onChange?: (value: number | [number, number]) => void;
  /** Double-click callback (defaults to reset) */
  onDoubleClick?: () => void;
  /** Change end callback (on mouse up) */
  onChangeEnd?: (value: number | [number, number]) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Marks/ticks to display */
  marks?: SliderMark[];
  /** Show marks */
  showMarks?: boolean;
  /** Range slider mode (two thumbs) */
  range?: boolean;
  /** Color variant */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  /** Show tooltip on hover/drag */
  showTooltip?: boolean;
  /** Track thickness */
  trackThickness?: number;
  /** Thumb size */
  thumbSize?: number;
  /** Unit suffix for value display */
  unit?: string;
}

const sizeConfigs = {
  xs: {
    track: { h: 'h-0.5', w: 'w-12', vH: 'h-12', vW: 'w-0.5' },
    thumb: 'w-2.5 h-2.5',
    fontSize: 'text-[9px]'
  },
  sm: {
    track: { h: 'h-1', w: 'w-16', vH: 'h-16', vW: 'w-1' },
    thumb: 'w-3 h-3',
    fontSize: 'text-[10px]'
  },
  md: {
    track: { h: 'h-1.5', w: 'w-24', vH: 'h-24', vW: 'w-1.5' },
    thumb: 'w-4 h-4',
    fontSize: 'text-xs'
  },
  lg: {
    track: { h: 'h-2', w: 'w-32', vH: 'h-32', vW: 'w-2' },
    thumb: 'w-5 h-5',
    fontSize: 'text-sm'
  },
};

const colorClasses = {
  primary: 'bg-daw-accent-primary',
  secondary: 'bg-daw-text-secondary',
  success: 'bg-daw-accent-success',
  warning: 'bg-daw-accent-warning',
  danger: 'bg-daw-accent-secondary',
};

export const Slider = memo(forwardRef<HTMLDivElement, SliderProps>(({
  value,
  min = 0,
  max = 100,
  step = 1,
  defaultValue,
  orientation = 'horizontal',
  size = 'md',
  label,
  showValue = true,
  valueFormatter,
  onChange,
  onDoubleClick,
  onChangeEnd,
  disabled = false,
  className = '',
  marks,
  showMarks = false,
  range = false,
  color = 'primary',
  showTooltip = false,
  unit = '',
}, ref) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeThumb, setActiveThumb] = useState<'start' | 'end' | null>(null);
  const [showTooltipState, setShowTooltipState] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isVertical = orientation === 'vertical';
  const config = sizeConfigs[size];

  // Normalize value to array for range slider
  const valueArray: [number, number] = range
    ? (Array.isArray(value) ? value : [min, value])
    : [min, typeof value === 'number' ? value : value[1]];

  const [startValue, endValue] = valueArray;

  // Calculate percentages
  const startPercentage = ((startValue - min) / (max - min)) * 100;
  const endPercentage = ((endValue - min) / (max - min)) * 100;

  // Format value for display
  const formatValue = useCallback((v: number): string => {
    if (valueFormatter) return valueFormatter(v);
    if (step < 1) return v.toFixed(1) + unit;
    return Math.round(v).toString() + unit;
  }, [valueFormatter, step, unit]);

  // Clamp and step value
  const clampValue = useCallback((v: number): number => {
    const clamped = Math.max(min, Math.min(max, v));
    return Math.round(clamped / step) * step;
  }, [min, max, step]);

  // Get value from position
  const getValueFromPosition = useCallback((clientX: number, clientY: number): number => {
    if (!sliderRef.current) return min;
    
    const rect = sliderRef.current.getBoundingClientRect();
    let ratio: number;

    if (isVertical) {
      ratio = 1 - (clientY - rect.top) / rect.height;
    } else {
      ratio = (clientX - rect.left) / rect.width;
    }

    ratio = Math.max(0, Math.min(1, ratio));
    return clampValue(min + ratio * (max - min));
  }, [isVertical, min, max, clampValue]);

  // Handle value change
  const handleValueChange = useCallback((newValue: number, thumb: 'start' | 'end') => {
    if (range) {
      const newRange: [number, number] = thumb === 'start'
        ? [Math.min(newValue, endValue), endValue]
        : [startValue, Math.max(newValue, startValue)];
      onChange?.(newRange);
    } else {
      onChange?.(newValue);
    }
  }, [range, startValue, endValue, onChange]);

  // Mouse down handler
  const handleMouseDown = useCallback((e: React.MouseEvent, thumb?: 'start' | 'end') => {
    if (disabled || !sliderRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    setShowTooltipState(true);

    const newValue = getValueFromPosition(e.clientX, e.clientY);
    
    // Determine which thumb to move
    let targetThumb: 'start' | 'end' = thumb || 'end';
    if (range && !thumb) {
      const distToStart = Math.abs(newValue - startValue);
      const distToEnd = Math.abs(newValue - endValue);
      targetThumb = distToStart < distToEnd ? 'start' : 'end';
    }
    
    setActiveThumb(targetThumb);
    handleValueChange(newValue, targetThumb);

    const handleMouseMove = (e: MouseEvent) => {
      const newVal = getValueFromPosition(e.clientX, e.clientY);
      handleValueChange(newVal, targetThumb);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setActiveThumb(null);
      setShowTooltipState(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      
      if (range) {
        onChangeEnd?.([startValue, endValue]);
      } else {
        onChangeEnd?.(endValue);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = isVertical ? 'ns-resize' : 'ew-resize';
  }, [disabled, isVertical, range, startValue, endValue, getValueFromPosition, handleValueChange, onChangeEnd]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent, thumb?: 'start' | 'end') => {
    if (disabled || !sliderRef.current) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    setIsDragging(true);
    setShowTooltipState(true);

    const newValue = getValueFromPosition(touch.clientX, touch.clientY);
    
    let targetThumb: 'start' | 'end' = thumb || 'end';
    if (range && !thumb) {
      const distToStart = Math.abs(newValue - startValue);
      const distToEnd = Math.abs(newValue - endValue);
      targetThumb = distToStart < distToEnd ? 'start' : 'end';
    }
    
    setActiveThumb(targetThumb);
    handleValueChange(newValue, targetThumb);

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const newVal = getValueFromPosition(touch.clientX, touch.clientY);
      handleValueChange(newVal, targetThumb);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      setActiveThumb(null);
      setShowTooltipState(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      
      if (range) {
        onChangeEnd?.([startValue, endValue]);
      } else {
        onChangeEnd?.(endValue);
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }, [disabled, range, startValue, endValue, getValueFromPosition, handleValueChange, onChangeEnd]);

  // Wheel handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (disabled) return;
    e.preventDefault();
    
    const direction = e.deltaY > 0 ? -1 : 1;
    const multiplier = e.shiftKey ? 0.1 : 1;
    const delta = step * direction * multiplier;
    
    if (range) {
      // Move both thumbs together
      const newStart = clampValue(startValue + delta);
      const newEnd = clampValue(endValue + delta);
      onChange?.([newStart, newEnd]);
    } else {
      onChange?.(clampValue(endValue + delta));
    }
  }, [disabled, step, range, startValue, endValue, clampValue, onChange]);

  // Double click handler
  const handleDoubleClick = useCallback(() => {
    if (disabled) return;
    
    if (onDoubleClick) {
      onDoubleClick();
    } else if (defaultValue !== undefined) {
      onChange?.(defaultValue);
    }
  }, [disabled, onDoubleClick, defaultValue, onChange]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    
    const multiplier = e.shiftKey ? 10 : 1;
    let delta = 0;
    
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        e.preventDefault();
        delta = step * multiplier;
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        e.preventDefault();
        delta = -step * multiplier;
        break;
      case 'Home':
        e.preventDefault();
        onChange?.(range ? [min, min] : min);
        return;
      case 'End':
        e.preventDefault();
        onChange?.(range ? [max, max] : max);
        return;
      default:
        return;
    }
    
    if (range) {
      onChange?.([clampValue(startValue + delta), clampValue(endValue + delta)]);
    } else {
      onChange?.(clampValue(endValue + delta));
    }
  }, [disabled, step, range, min, max, startValue, endValue, clampValue, onChange]);

  // Prevent scroll when hovering
  useEffect(() => {
    const element = sliderRef.current;
    if (!element) return;

    const preventScroll = (e: WheelEvent) => {
      if (!disabled) e.preventDefault();
    };

    element.addEventListener('wheel', preventScroll, { passive: false });
    return () => element.removeEventListener('wheel', preventScroll);
  }, [disabled]);

  // Render thumb
  const renderThumb = (position: number, thumb: 'start' | 'end') => {
    const isActive = activeThumb === thumb;
    
    return (
      <div
        className={`
          absolute ${config.thumb} rounded-full shadow-md
          bg-white border-2 ${colorClasses[color].replace('bg-', 'border-')}
          transform -translate-x-1/2 -translate-y-1/2
          transition-transform duration-50
          ${isActive ? 'scale-125 z-20' : 'z-10'}
          ${disabled ? '' : 'hover:scale-110'}
        `.trim().replace(/\s+/g, ' ')}
        style={
          isVertical
            ? { bottom: `${position}%`, left: '50%', transform: 'translate(-50%, 50%)' }
            : { left: `${position}%`, top: '50%', transform: 'translate(-50%, -50%)' }
        }
        onMouseDown={(e) => handleMouseDown(e, thumb)}
        onTouchStart={(e) => handleTouchStart(e, thumb)}
      >
        {/* Tooltip */}
        {showTooltip && showTooltipState && isActive && (
          <div
            className={`
              absolute px-1.5 py-0.5 rounded text-[10px] font-mono
              bg-daw-bg-tertiary text-daw-text-primary shadow-lg
              whitespace-nowrap pointer-events-none
              ${isVertical ? 'left-full ml-2' : 'bottom-full mb-2 left-1/2 -translate-x-1/2'}
            `}
          >
            {formatValue(thumb === 'start' ? startValue : endValue)}
          </div>
        )}
      </div>
    );
  };

  // Render marks
  const renderMarks = () => {
    if (!showMarks || !marks) return null;
    
    return marks.map((mark, index) => {
      const position = ((mark.value - min) / (max - min)) * 100;
      
      return (
        <div
          key={index}
          className="absolute"
          style={
            isVertical
              ? { bottom: `${position}%`, left: '100%', transform: 'translateY(50%)' }
              : { left: `${position}%`, top: '100%', transform: 'translateX(-50%)' }
          }
        >
          <div className={`w-0.5 h-1.5 bg-daw-text-muted ${isVertical ? 'ml-1' : 'mx-auto mb-0.5'}`} />
          {mark.label && (
            <span className={`${config.fontSize} text-daw-text-muted whitespace-nowrap`}>
              {mark.label}
            </span>
          )}
        </div>
      );
    });
  };

  const trackClasses = isVertical
    ? `${config.track.vW} ${config.track.vH}`
    : `${config.track.h} ${config.track.w}`;

  return (
    <div
      ref={ref}
      className={`flex ${isVertical ? 'flex-col' : 'flex-row'} items-center gap-2 ${className}`}
    >
      {label && (
        <span className={`${config.fontSize} text-daw-text-muted truncate`}>
          {label}
        </span>
      )}
      
      <div
        ref={sliderRef}
        className={`
          relative ${trackClasses} bg-daw-bg-surface rounded-full
          ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
          ${isFocused ? 'ring-2 ring-daw-accent-primary ring-offset-1 ring-offset-daw-bg-primary' : ''}
        `.trim().replace(/\s+/g, ' ')}
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
        aria-valuenow={range ? undefined : endValue}
        aria-valuetext={range ? `${formatValue(startValue)} to ${formatValue(endValue)}` : formatValue(endValue)}
        aria-label={label}
        aria-disabled={disabled}
      >
        {/* Filled track */}
        <div
          className={`absolute ${colorClasses[color]} rounded-full transition-all duration-50`}
          style={
            isVertical
              ? {
                  bottom: `${range ? startPercentage : 0}%`,
                  left: 0,
                  right: 0,
                  height: `${endPercentage - (range ? startPercentage : 0)}%`
                }
              : {
                  left: `${range ? startPercentage : 0}%`,
                  top: 0,
                  bottom: 0,
                  width: `${endPercentage - (range ? startPercentage : 0)}%`
                }
          }
        />
        
        {/* Thumbs */}
        {range && renderThumb(startPercentage, 'start')}
        {renderThumb(endPercentage, 'end')}
        
        {/* Marks */}
        {renderMarks()}
      </div>
      
      {showValue && (
        <span className={`${config.fontSize} text-daw-text-secondary font-mono min-w-[3ch] text-center tabular-nums`}>
          {range ? `${formatValue(startValue)}-${formatValue(endValue)}` : formatValue(endValue)}
        </span>
      )}
    </div>
  );
}));

Slider.displayName = 'Slider';

export default Slider;