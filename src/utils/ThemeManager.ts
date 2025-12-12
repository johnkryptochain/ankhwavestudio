// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import { useUIStore } from '../stores/uiStore';
import type { ThemeMode } from '../types/ui';

/**
 * Theme Manager
 * Handles switching between Light and Dark themes
 */

export type Theme = 'dark' | 'light';

export class ThemeManager {
  private static readonly STORAGE_KEY = 'ankhwave_theme';

  static resolveTheme(mode: ThemeMode): Theme {
    if (mode === 'system') {
      try {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? 'dark' : 'light';
      } catch {
        return 'dark';
      }
    }
    return mode;
  }

  /**
   * Initialize theme from local storage or system preference
   */
  static initialize(): void {
    let savedTheme: Theme | null = null;
    try {
      savedTheme = localStorage.getItem(this.STORAGE_KEY) as Theme;
    } catch {
      savedTheme = null;
    }

    if (savedTheme === 'dark' || savedTheme === 'light') {
      this.setTheme(savedTheme);
      return;
    }

    // Check system preference
    this.setTheme(this.resolveTheme('system'));
  }

  /**
   * Set the current theme
   */
  static applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;

    try {
      localStorage.setItem(this.STORAGE_KEY, theme);
    } catch {
      // ignore
    }

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0d0d12' : '#f3f4f6');
    }
  }

  static setTheme(theme: Theme): void {
    this.applyTheme(theme);
    // Sync with UI Store (avoid throwing if store isn't ready)
    try {
      useUIStore.getState().setTheme(theme);
    } catch {
      // ignore
    }
  }

  static setThemeMode(mode: ThemeMode): void {
    this.setTheme(this.resolveTheme(mode));
  }

  /**
   * Get the current theme
   */
  static getTheme(): Theme {
    return (document.documentElement.getAttribute('data-theme') as Theme) || 'dark';
  }

  /**
   * Toggle between light and dark themes
   */
  static toggleTheme(): void {
    const current = this.getTheme();
    this.setTheme(current === 'dark' ? 'light' : 'dark');
  }
}
