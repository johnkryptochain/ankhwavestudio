// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Button - Enhanced reusable button component for DAW UI
 */

import React, { forwardRef, memo, useCallback } from 'react';
import { useUIStore } from '../../stores/uiStore';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button visual variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  /** Button size */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Icon to display */
  icon?: React.ReactNode;
  /** Icon position relative to text */
  iconPosition?: 'left' | 'right';
  /** Show loading spinner */
  loading?: boolean;
  /** Make button full width */
  fullWidth?: boolean;
  /** Keyboard shortcut to display */
  shortcut?: string;
  /** Active/pressed state */
  active?: boolean;
  /** Tooltip text */
  tooltip?: string;
}

const LoadingSpinner: React.FC<{ size: string }> = ({ size }) => {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <svg className={`animate-spin ${sizeClasses[size as keyof typeof sizeClasses] || 'h-4 w-4'}`} viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

export const Button = memo(forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  fullWidth = false,
  shortcut,
  active = false,
  tooltip,
  className = '',
  disabled,
  onClick,
  onKeyDown,
  title,
  ...props
}, ref) => {
  const showTooltips = useUIStore((state) => state.preferences.showTooltips);

  const baseStyles = `
    inline-flex items-center justify-center font-medium rounded
    transition-all duration-150 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-daw-bg-primary
    select-none cursor-pointer
    disabled:cursor-not-allowed disabled:opacity-50
  `.trim().replace(/\s+/g, ' ');
  
  const variantStyles = {
    primary: `
      bg-daw-accent-primary text-white
      hover:bg-purple-500 active:bg-purple-700
      focus:ring-daw-accent-primary
      ${active ? 'bg-purple-700 ring-2 ring-purple-400' : ''}
    `,
    secondary: `
      bg-daw-bg-elevated text-daw-text-primary
      border border-daw-border
      hover:bg-daw-bg-surface hover:border-daw-border-light
      active:bg-daw-bg-tertiary
      focus:ring-daw-accent-primary
      ${active ? 'bg-daw-bg-tertiary border-daw-accent-primary' : ''}
    `,
    ghost: `
      text-daw-text-secondary bg-transparent
      hover:text-daw-text-primary hover:bg-daw-bg-surface
      active:bg-daw-bg-elevated
      focus:ring-daw-accent-primary
      ${active ? 'text-daw-text-primary bg-daw-bg-surface' : ''}
    `,
    danger: `
      bg-daw-accent-secondary text-white
      hover:bg-red-500 active:bg-red-700
      focus:ring-daw-accent-secondary
      ${active ? 'bg-red-700' : ''}
    `,
    success: `
      bg-daw-accent-success text-white
      hover:bg-green-500 active:bg-green-700
      focus:ring-daw-accent-success
      ${active ? 'bg-green-700' : ''}
    `,
  };
  
  const sizeStyles = {
    xs: 'px-1.5 py-0.5 text-xs gap-1 min-h-[22px]',
    sm: 'px-2 py-1 text-xs gap-1 min-h-[26px]',
    md: 'px-3 py-1.5 text-sm gap-1.5 min-h-[32px]',
    lg: 'px-4 py-2 text-base gap-2 min-h-[40px]',
  };
  
  const widthStyles = fullWidth ? 'w-full' : '';

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    // Allow Enter and Space to trigger click
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled && !loading && onClick) {
        onClick(e as unknown as React.MouseEvent<HTMLButtonElement>);
      }
    }
    onKeyDown?.(e);
  }, [disabled, loading, onClick, onKeyDown]);
  
  return (
    <button
      ref={ref}
      className={`
        ${baseStyles}
        ${variantStyles[variant].trim().replace(/\s+/g, ' ')}
        ${sizeStyles[size]}
        ${widthStyles}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      disabled={disabled || loading}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      title={showTooltips ? (tooltip || title) : undefined}
      aria-pressed={active}
      aria-busy={loading}
      {...props}
    >
      {loading && <LoadingSpinner size={size} />}
      {!loading && icon && iconPosition === 'left' && (
        <span className="flex-shrink-0">{icon}</span>
      )}
      {children && <span className="truncate">{children}</span>}
      {!loading && icon && iconPosition === 'right' && (
        <span className="flex-shrink-0">{icon}</span>
      )}
      {shortcut && (
        <kbd className="ml-auto pl-2 text-[10px] opacity-60 font-mono tracking-wide">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}));

Button.displayName = 'Button';

export default Button;