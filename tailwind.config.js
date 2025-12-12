// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // AnkhWave - Modern 2025 Dark Theme
        'daw-bg': {
          primary: 'var(--daw-bg-primary)',
          secondary: 'var(--daw-bg-secondary)',
          tertiary: 'var(--daw-bg-tertiary)',
          surface: 'var(--daw-bg-surface)',
          elevated: 'var(--daw-bg-elevated)',
          hover: 'var(--daw-bg-hover)',
          active: 'var(--daw-bg-active)',
        },
        'daw-accent': {
          DEFAULT: 'var(--daw-accent)',
          primary: 'var(--daw-accent)',
          secondary: '#ef8286',
          success: 'var(--daw-success)',
          warning: 'var(--daw-warning)',
          error: 'var(--daw-error)',
          muted: 'var(--daw-text-muted)',
          hover: 'var(--daw-accent-hover)',
          dim: 'var(--daw-accent-dim)',
          glow: 'var(--daw-accent-glow)',
        },
        'daw-text': {
          primary: 'var(--daw-text-primary)',
          secondary: 'var(--daw-text-secondary)',
          muted: 'var(--daw-text-muted)',
          disabled: 'var(--daw-text-disabled)',
        },
        'daw-border': {
          DEFAULT: 'var(--daw-border)',
          light: 'var(--daw-border-light)',
          dark: 'var(--daw-border-dark)',
          focus: 'var(--daw-border-focus)',
        },
        // Override purple/pink to match the theme (User Request)
        purple: {
          300: '#a5a8f4',
          400: '#8286ef',
          500: '#8286ef',
          600: '#6a6ec7',
          700: '#5a5eb7',
        },
        pink: {
          400: '#8286ef',
          500: '#8286ef',
          600: '#8286ef',
        },
        fuchsia: {
          400: '#8286ef',
          500: '#8286ef',
          600: '#8286ef',
        },
        // Track colors - Modern vibrant palette
        'track': {
          blue: '#60a5fa',
          green: '#34d399',
          yellow: '#fbbf24',
          orange: '#fb923c',
          red: '#f87171',
          purple: '#a78bfa',
          pink: '#f472b6',
          cyan: '#22d3ee',
          teal: '#2dd4bf',
          indigo: '#818cf8',
        },
        // VU meter colors
        'meter': {
          green: '#4ade80',
          yellow: '#fbbf24',
          orange: '#f97316',
          red: '#ef4444',
          peak: '#ff0000',
        },
        // Piano keyboard colors
        'piano': {
          white: 'var(--piano-white)',
          'white-hover': 'var(--piano-white-hover)',
          'white-active': 'var(--piano-white-active)',
          black: 'var(--piano-black)',
          'black-hover': 'var(--piano-black-hover)',
          'black-active': 'var(--piano-black-active)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xxs': ['0.625rem', { lineHeight: '0.875rem' }],
        'tiny': ['0.6875rem', { lineHeight: '1rem' }],
      },
      spacing: {
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
        '88': '22rem',
        '100': '25rem',
        '112': '28rem',
        '128': '32rem',
      },
      minWidth: {
        '12': '3rem',
        '16': '4rem',
        '20': '5rem',
        '24': '6rem',
        '32': '8rem',
        '40': '10rem',
        '48': '12rem',
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },
      minHeight: {
        '8': '2rem',
        '10': '2.5rem',
        '12': '3rem',
        '16': '4rem',
        '20': '5rem',
        '24': '6rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'meter': 'meter 100ms ease-out',
        'meter-fall': 'meter-fall 300ms ease-out',
        'blink': 'blink 1s step-end infinite',
        'spin-slow': 'spin 3s linear infinite',
        'fade-in': 'fade-in 150ms ease-out',
        'fade-out': 'fade-out 150ms ease-in',
        'slide-in': 'slide-in 200ms ease-out',
        'slide-out': 'slide-out 200ms ease-in',
        'scale-in': 'scale-in 150ms ease-out',
        'playhead': 'playhead 16.67ms linear infinite',
      },
      keyframes: {
        meter: {
          '0%': { transform: 'scaleY(1)' },
          '100%': { transform: 'scaleY(0)' },
        },
        'meter-fall': {
          '0%': { transform: 'scaleY(var(--meter-level, 1))' },
          '100%': { transform: 'scaleY(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'slide-in': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-out': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-10px)', opacity: '0' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        playhead: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(var(--playhead-speed, 1px))' },
        },
      },
      boxShadow: {
        'inner-lg': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.25)',
        'inner-xl': 'inset 0 4px 8px 0 rgb(0 0 0 / 0.35)',
        'glow': '0 0 20px rgb(130 134 239 / 0.5)',
        'glow-sm': '0 0 10px rgb(130 134 239 / 0.3)',
        'glow-md': '0 0 15px rgb(130 134 239 / 0.4)',
        'glow-lg': '0 0 30px rgb(130 134 239 / 0.6)',
        'glow-xl': '0 0 40px rgb(130 134 239 / 0.7)',
        'glow-red': '0 0 15px rgb(248 113 113 / 0.5)',
        'glow-green': '0 0 15px rgb(110 231 183 / 0.5)',
        'panel': '0 8px 16px -4px rgb(0 0 0 / 0.4), 0 4px 8px -4px rgb(0 0 0 / 0.3)',
        'dropdown': '0 16px 32px -8px rgb(0 0 0 / 0.5), 0 8px 16px -8px rgb(0 0 0 / 0.4)',
        'modal': '0 32px 64px -16px rgb(0 0 0 / 0.6)',
        'card': '0 4px 12px -2px rgb(0 0 0 / 0.3)',
        'card-hover': '0 8px 24px -4px rgb(0 0 0 / 0.4)',
        'button': '0 2px 8px -2px rgb(130 134 239 / 0.4)',
        'button-hover': '0 4px 16px -4px rgb(130 134 239 / 0.5)',
      },
      borderRadius: {
        'sm': '0.125rem',
        'xs': '0.0625rem',
      },
      transitionDuration: {
        '25': '25ms',
        '50': '50ms',
        '75': '75ms',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
        'dropdown': '1000',
        'modal': '1100',
        'tooltip': '1200',
        'notification': '1300',
      },
      backdropBlur: {
        'xs': '2px',
      },
      aspectRatio: {
        'knob': '1 / 1',
        'waveform': '4 / 1',
      },
      gridTemplateColumns: {
        'mixer': 'repeat(auto-fill, minmax(80px, 1fr))',
        'browser': '1fr',
        'pattern': 'repeat(16, 1fr)',
        'pattern-32': 'repeat(32, 1fr)',
      },
      gridTemplateRows: {
        'editor': 'auto 1fr auto',
        'main': 'auto 1fr auto',
      },
    },
  },
  plugins: [],
}