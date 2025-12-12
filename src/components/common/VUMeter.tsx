// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * VUMeter - Level meter component for audio visualization
 * Features: Peak hold, gradient coloring, stereo mode, dB scale, clip indicator
 */

import React, { useEffect, useRef, useState, memo, useCallback } from 'react';

export interface VUMeterProps {
  /** Current level (0-1 normalized) */
  level: number;
  /** Right channel level for stereo mode (0-1 normalized) */
  levelRight?: number;
  /** Peak level (0-1 normalized) */
  peak?: number;
  /** Right channel peak for stereo mode */
  peakRight?: number;
  /** Meter orientation */
  orientation?: 'vertical' | 'horizontal';
  /** Meter size */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Show stereo mode (L/R) */
  stereo?: boolean;
  /** Show dB scale markings */
  showScale?: boolean;
  /** Show peak hold indicator */
  showPeak?: boolean;
  /** Peak hold time in ms */
  peakHoldTime?: number;
  /** Show clip indicator */
  showClip?: boolean;
  /** Clip threshold (0-1) */
  clipThreshold?: number;
  /** Number of segments (0 for smooth) */
  segments?: number;
  /** Additional CSS classes */
  className?: string;
  /** Label text */
  label?: string;
}

const sizeConfigs = {
  xs: { width: 4, height: 60, gap: 1, fontSize: 'text-[8px]' },
  sm: { width: 6, height: 80, gap: 2, fontSize: 'text-[9px]' },
  md: { width: 8, height: 120, gap: 2, fontSize: 'text-[10px]' },
  lg: { width: 12, height: 160, gap: 3, fontSize: 'text-xs' },
};

// dB scale markings
const dbMarks = [0, -3, -6, -12, -18, -24, -36, -48];

// Convert linear level to dB
const linearToDb = (level: number): number => {
  if (level <= 0) return -Infinity;
  return 20 * Math.log10(level);
};

// Convert dB to linear level
const dbToLinear = (db: number): number => {
  return Math.pow(10, db / 20);
};

// Get color based on level
const getLevelColor = (normalizedPosition: number): string => {
  if (normalizedPosition > 0.9) return '#ef4444'; // Red - clip zone
  if (normalizedPosition > 0.75) return '#f97316'; // Orange - warning
  if (normalizedPosition > 0.5) return '#eab308'; // Yellow - caution
  return '#22c55e'; // Green - safe
};

export const VUMeter = memo<VUMeterProps>(({
  level,
  levelRight,
  peak,
  peakRight,
  orientation = 'vertical',
  size = 'md',
  stereo = false,
  showScale = false,
  showPeak = true,
  peakHoldTime = 1500,
  showClip = true,
  clipThreshold = 0.99,
  segments = 0,
  className = '',
  label,
}) => {
  const config = sizeConfigs[size];
  const isVertical = orientation === 'vertical';
  
  // Peak hold state
  const [peakHoldL, setPeakHoldL] = useState(0);
  const [peakHoldR, setPeakHoldR] = useState(0);
  const [isClippingL, setIsClippingL] = useState(false);
  const [isClippingR, setIsClippingR] = useState(false);
  
  const peakTimerL = useRef<NodeJS.Timeout | null>(null);
  const peakTimerR = useRef<NodeJS.Timeout | null>(null);
  const clipTimerL = useRef<NodeJS.Timeout | null>(null);
  const clipTimerR = useRef<NodeJS.Timeout | null>(null);

  // Update peak hold for left channel
  useEffect(() => {
    const currentPeak = peak !== undefined ? peak : level;
    
    if (currentPeak > peakHoldL) {
      setPeakHoldL(currentPeak);
      
      if (peakTimerL.current) {
        clearTimeout(peakTimerL.current);
      }
      
      peakTimerL.current = setTimeout(() => {
        setPeakHoldL(0);
      }, peakHoldTime);
    }
    
    // Check for clipping
    if (currentPeak >= clipThreshold) {
      setIsClippingL(true);
      
      if (clipTimerL.current) {
        clearTimeout(clipTimerL.current);
      }
      
      clipTimerL.current = setTimeout(() => {
        setIsClippingL(false);
      }, 2000);
    }
    
    return () => {
      if (peakTimerL.current) clearTimeout(peakTimerL.current);
      if (clipTimerL.current) clearTimeout(clipTimerL.current);
    };
  }, [level, peak, peakHoldL, peakHoldTime, clipThreshold]);

  // Update peak hold for right channel
  useEffect(() => {
    if (!stereo) return;
    
    const currentPeak = peakRight !== undefined ? peakRight : (levelRight ?? 0);
    
    if (currentPeak > peakHoldR) {
      setPeakHoldR(currentPeak);
      
      if (peakTimerR.current) {
        clearTimeout(peakTimerR.current);
      }
      
      peakTimerR.current = setTimeout(() => {
        setPeakHoldR(0);
      }, peakHoldTime);
    }
    
    // Check for clipping
    if (currentPeak >= clipThreshold) {
      setIsClippingR(true);
      
      if (clipTimerR.current) {
        clearTimeout(clipTimerR.current);
      }
      
      clipTimerR.current = setTimeout(() => {
        setIsClippingR(false);
      }, 2000);
    }
    
    return () => {
      if (peakTimerR.current) clearTimeout(peakTimerR.current);
      if (clipTimerR.current) clearTimeout(clipTimerR.current);
    };
  }, [stereo, levelRight, peakRight, peakHoldR, peakHoldTime, clipThreshold]);

  const renderMeterBar = useCallback((
    currentLevel: number,
    currentPeakHold: number,
    isClipping: boolean,
    channelLabel?: string
  ) => {
    const clampedLevel = Math.max(0, Math.min(1, currentLevel));
    const percentage = clampedLevel * 100;
    
    return (
      <div className="flex flex-col items-center gap-0.5">
        {/* Clip indicator */}
        {showClip && (
          <div
            className={`
              rounded-sm transition-colors duration-100
              ${isClipping ? 'bg-red-500 shadow-glow-sm' : 'bg-daw-bg-surface'}
            `}
            style={{
              width: config.width,
              height: 4,
            }}
          />
        )}
        
        {/* Meter bar container */}
        <div
          className="relative bg-daw-bg-primary rounded-sm overflow-hidden"
          style={{
            width: isVertical ? config.width : config.height,
            height: isVertical ? config.height : config.width,
          }}
        >
          {/* Segmented or smooth meter */}
          {segments > 0 ? (
            // Segmented meter
            <div className={`absolute inset-0 flex ${isVertical ? 'flex-col-reverse' : 'flex-row'} gap-px p-px`}>
              {Array.from({ length: segments }).map((_, i) => {
                const segmentPosition = (i + 1) / segments;
                const isActive = clampedLevel >= segmentPosition - (1 / segments);
                const color = getLevelColor(segmentPosition);
                
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-sm transition-opacity duration-50"
                    style={{
                      backgroundColor: isActive ? color : 'transparent',
                      opacity: isActive ? 1 : 0.1,
                    }}
                  />
                );
              })}
            </div>
          ) : (
            // Smooth gradient meter
            <div
              className="absolute transition-all duration-50"
              style={{
                background: isVertical
                  ? 'linear-gradient(to top, #22c55e 0%, #22c55e 50%, #eab308 70%, #f97316 85%, #ef4444 100%)'
                  : 'linear-gradient(to right, #22c55e 0%, #22c55e 50%, #eab308 70%, #f97316 85%, #ef4444 100%)',
                ...(isVertical
                  ? { bottom: 0, left: 0, right: 0, height: `${percentage}%` }
                  : { top: 0, bottom: 0, left: 0, width: `${percentage}%` }),
              }}
            />
          )}
          
          {/* Peak hold indicator */}
          {showPeak && currentPeakHold > 0 && (
            <div
              className="absolute bg-white shadow-sm"
              style={{
                ...(isVertical
                  ? {
                      bottom: `${currentPeakHold * 100}%`,
                      left: 0,
                      right: 0,
                      height: 2,
                      transform: 'translateY(50%)',
                    }
                  : {
                      left: `${currentPeakHold * 100}%`,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      transform: 'translateX(-50%)',
                    }),
              }}
            />
          )}
        </div>
        
        {/* Channel label */}
        {channelLabel && (
          <span className={`${config.fontSize} text-daw-text-muted`}>
            {channelLabel}
          </span>
        )}
      </div>
    );
  }, [config, isVertical, segments, showClip, showPeak]);

  const renderScale = useCallback(() => {
    if (!showScale) return null;
    
    return (
      <div
        className={`flex ${isVertical ? 'flex-col justify-between' : 'flex-row justify-between'} ${config.fontSize} text-daw-text-muted`}
        style={{
          height: isVertical ? config.height : 'auto',
          width: isVertical ? 'auto' : config.height,
        }}
      >
        {dbMarks.map((db) => {
          const position = db === -Infinity ? 0 : dbToLinear(db);
          return (
            <span
              key={db}
              className="leading-none"
              style={{
                ...(isVertical
                  ? { transform: `translateY(${(1 - position) * 100}%)` }
                  : { transform: `translateX(${position * 100}%)` }),
              }}
            >
              {db === -Infinity ? '-∞' : db}
            </span>
          );
        })}
      </div>
    );
  }, [showScale, isVertical, config]);

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      {label && (
        <span className={`${config.fontSize} text-daw-text-muted`}>
          {label}
        </span>
      )}
      
      <div className={`flex ${isVertical ? 'flex-row' : 'flex-col'} items-end gap-${config.gap}`}>
        {/* Scale (left/top) */}
        {showScale && renderScale()}
        
        {/* Meter bars */}
        <div className={`flex ${isVertical ? 'flex-row' : 'flex-col'} gap-px`}>
          {renderMeterBar(level, peakHoldL, isClippingL, stereo ? 'L' : undefined)}
          {stereo && renderMeterBar(levelRight ?? 0, peakHoldR, isClippingR, 'R')}
        </div>
      </div>
    </div>
  );
});

VUMeter.displayName = 'VUMeter';

export default VUMeter;