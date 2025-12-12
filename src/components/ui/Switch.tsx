// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Switch - Toggle switch component
 */

import React from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  color?: string;
  label?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  size = 'medium',
  color = '#00ff00',
  label,
}) => {
  const sizes = {
    small: { width: 32, height: 18, knob: 14 },
    medium: { width: 44, height: 24, knob: 20 },
    large: { width: 56, height: 30, knob: 26 },
  };
  
  const { width, height, knob } = sizes[size];
  const padding = (height - knob) / 2;
  
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width,
          height,
          backgroundColor: checked ? color : '#333',
          borderRadius: height / 2,
          position: 'relative',
          transition: 'background-color 0.2s',
          boxShadow: checked ? `0 0 8px ${color}` : 'inset 0 0 4px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            width: knob,
            height: knob,
            backgroundColor: '#fff',
            borderRadius: '50%',
            position: 'absolute',
            top: padding,
            left: checked ? width - knob - padding : padding,
            transition: 'left 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}
        />
      </div>
      {label && (
        <span
          style={{
            fontSize: size === 'small' ? '10px' : size === 'medium' ? '12px' : '14px',
            color: '#888',
          }}
        >
          {label}
        </span>
      )}
    </label>
  );
};

export default Switch;