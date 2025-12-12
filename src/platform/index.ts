// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Platform Module Exports
 * Central export point for all platform-specific optimizations
 */

export {
  TouchOptimizations,
  useTouchGestures,
  useStylusInput,
  type TouchConfig,
  type GestureState,
  type StylusState,
} from './TouchOptimizations';

export {
  KeyboardShortcuts,
  getKeyboardShortcuts,
  SHORTCUT_CATEGORIES,
  DEFAULT_SHORTCUTS,
  type ShortcutDefinition,
  type ShortcutCategory,
} from './KeyboardShortcuts';

export {
  detectPlatform,
  type PlatformInfo,
  type PerformanceProfile
} from './JemaOSOptimizations';
