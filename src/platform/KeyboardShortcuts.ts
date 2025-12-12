// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Keyboard Shortcuts Manager
 * Chrome OS specific shortcuts and customizable keyboard handling
 */

export interface ShortcutDefinition {
  id: string;
  name: string;
  description: string;
  keys: string[];
  category: string;
  action: () => void;
  enabled?: boolean;
}

export interface ShortcutCategory {
  id: string;
  name: string;
  icon?: string;
}

type ShortcutCallback = (shortcut: ShortcutDefinition) => void;

// Key code mappings for Chrome OS
const CHROME_OS_KEY_MAP: Record<string, string> = {
  'Search': 'Meta', // Chrome OS Search key maps to Meta
  'Launcher': 'Meta',
  'Assistant': 'Meta+a',
};

// Default shortcut categories
export const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  { id: 'file', name: 'File', icon: '📁' },
  { id: 'edit', name: 'Edit', icon: '✏️' },
  { id: 'view', name: 'View', icon: '👁️' },
  { id: 'playback', name: 'Playback', icon: '▶️' },
  { id: 'tools', name: 'Tools', icon: '🔧' },
  { id: 'navigation', name: 'Navigation', icon: '🧭' },
];

// Default shortcuts for AnkhWaveStudio Web
export const DEFAULT_SHORTCUTS: Omit<ShortcutDefinition, 'action'>[] = [
  // File operations
  { id: 'new-project', name: 'New Project', description: 'Create a new project', keys: ['Ctrl+N'], category: 'file' },
  { id: 'open-project', name: 'Open Project', description: 'Open an existing project', keys: ['Ctrl+O'], category: 'file' },
  { id: 'save-project', name: 'Save Project', description: 'Save current project', keys: ['Ctrl+S'], category: 'file' },
  { id: 'save-as', name: 'Save As', description: 'Save project with new name', keys: ['Ctrl+Shift+S'], category: 'file' },
  { id: 'export', name: 'Export', description: 'Export project', keys: ['Ctrl+E'], category: 'file' },
  { id: 'import', name: 'Import', description: 'Import file', keys: ['Ctrl+I'], category: 'file' },

  // Edit operations
  { id: 'undo', name: 'Undo', description: 'Undo last action', keys: ['Ctrl+Z'], category: 'edit' },
  { id: 'redo', name: 'Redo', description: 'Redo last action', keys: ['Ctrl+Y', 'Ctrl+Shift+Z'], category: 'edit' },
  { id: 'cut', name: 'Cut', description: 'Cut selection', keys: ['Ctrl+X'], category: 'edit' },
  { id: 'copy', name: 'Copy', description: 'Copy selection', keys: ['Ctrl+C'], category: 'edit' },
  { id: 'paste', name: 'Paste', description: 'Paste from clipboard', keys: ['Ctrl+V'], category: 'edit' },
  { id: 'delete', name: 'Delete', description: 'Delete selection', keys: ['Delete', 'Backspace'], category: 'edit' },
  { id: 'select-all', name: 'Select All', description: 'Select all items', keys: ['Ctrl+A'], category: 'edit' },
  { id: 'duplicate', name: 'Duplicate', description: 'Duplicate selection', keys: ['Ctrl+D'], category: 'edit' },

  // View operations
  { id: 'zoom-in', name: 'Zoom In', description: 'Zoom in', keys: ['Ctrl+=', 'Ctrl++'], category: 'view' },
  { id: 'zoom-out', name: 'Zoom Out', description: 'Zoom out', keys: ['Ctrl+-'], category: 'view' },
  { id: 'zoom-fit', name: 'Zoom to Fit', description: 'Fit content in view', keys: ['Ctrl+0'], category: 'view' },
  { id: 'fullscreen', name: 'Fullscreen', description: 'Toggle fullscreen', keys: ['F11'], category: 'view' },
  { id: 'toggle-sidebar', name: 'Toggle Sidebar', description: 'Show/hide sidebar', keys: ['Ctrl+B'], category: 'view' },
  { id: 'toggle-mixer', name: 'Toggle Mixer', description: 'Show/hide mixer', keys: ['Ctrl+M'], category: 'view' },
  { id: 'toggle-piano-roll', name: 'Toggle Piano Roll', description: 'Show/hide piano roll', keys: ['Ctrl+P'], category: 'view' },

  // Playback operations
  { id: 'play-pause', name: 'Play/Pause', description: 'Toggle playback', keys: ['Space'], category: 'playback' },
  { id: 'stop', name: 'Stop', description: 'Stop playback', keys: ['Escape'], category: 'playback' },
  { id: 'record', name: 'Record', description: 'Toggle recording', keys: ['R'], category: 'playback' },
  { id: 'loop', name: 'Loop', description: 'Toggle loop mode', keys: ['L'], category: 'playback' },
  { id: 'rewind', name: 'Rewind', description: 'Go to beginning', keys: ['Home'], category: 'playback' },
  { id: 'forward', name: 'Forward', description: 'Go to end', keys: ['End'], category: 'playback' },
  { id: 'tempo-up', name: 'Tempo Up', description: 'Increase tempo', keys: ['Ctrl+Up'], category: 'playback' },
  { id: 'tempo-down', name: 'Tempo Down', description: 'Decrease tempo', keys: ['Ctrl+Down'], category: 'playback' },

  // Tools
  { id: 'select-tool', name: 'Select Tool', description: 'Switch to select tool', keys: ['V'], category: 'tools' },
  { id: 'draw-tool', name: 'Draw Tool', description: 'Switch to draw tool', keys: ['D'], category: 'tools' },
  { id: 'erase-tool', name: 'Erase Tool', description: 'Switch to erase tool', keys: ['E'], category: 'tools' },
  { id: 'split-tool', name: 'Split Tool', description: 'Switch to split tool', keys: ['S'], category: 'tools' },
  { id: 'mute-tool', name: 'Mute Tool', description: 'Switch to mute tool', keys: ['M'], category: 'tools' },

  // Navigation
  { id: 'next-track', name: 'Next Track', description: 'Select next track', keys: ['Down'], category: 'navigation' },
  { id: 'prev-track', name: 'Previous Track', description: 'Select previous track', keys: ['Up'], category: 'navigation' },
  { id: 'scroll-left', name: 'Scroll Left', description: 'Scroll timeline left', keys: ['Left'], category: 'navigation' },
  { id: 'scroll-right', name: 'Scroll Right', description: 'Scroll timeline right', keys: ['Right'], category: 'navigation' },

  // Chrome OS specific
  { id: 'keyboard-shortcuts', name: 'Keyboard Shortcuts', description: 'Show keyboard shortcuts', keys: ['Ctrl+/', 'Ctrl+?'], category: 'view' },
  { id: 'search', name: 'Search', description: 'Open search', keys: ['Ctrl+F', 'Meta+F'], category: 'navigation' },
  { id: 'settings', name: 'Settings', description: 'Open settings', keys: ['Ctrl+,'], category: 'file' },
];

/**
 * Keyboard Shortcuts Manager
 */
export class KeyboardShortcuts {
  private static instance: KeyboardShortcuts | null = null;
  private shortcuts: Map<string, ShortcutDefinition> = new Map();
  private keyBindings: Map<string, string> = new Map(); // key combo -> shortcut id
  private callbacks: Map<string, ShortcutCallback[]> = new Map();
  private isEnabled: boolean = true;
  private overlayVisible: boolean = false;
  private customBindings: Map<string, string[]> = new Map(); // shortcut id -> custom keys

  private constructor() {
    this.loadCustomBindings();
  }

  static getInstance(): KeyboardShortcuts {
    if (!KeyboardShortcuts.instance) {
      KeyboardShortcuts.instance = new KeyboardShortcuts();
    }
    return KeyboardShortcuts.instance;
  }

  /**
   * Initialize keyboard shortcuts
   */
  initialize(): void {
    // Add event listener
    document.addEventListener('keydown', this.handleKeyDown.bind(this));

    // Register default shortcuts
    this.registerDefaultShortcuts();

    console.log('[Keyboard] Shortcuts initialized');
  }

  /**
   * Register default shortcuts
   */
  private registerDefaultShortcuts(): void {
    for (const shortcut of DEFAULT_SHORTCUTS) {
      this.register({
        ...shortcut,
        action: () => this.emitShortcut(shortcut.id),
      });
    }
  }

  /**
   * Register a shortcut
   */
  register(shortcut: ShortcutDefinition): void {
    // Check for custom bindings
    const customKeys = this.customBindings.get(shortcut.id);
    const keys = customKeys || shortcut.keys;

    this.shortcuts.set(shortcut.id, { ...shortcut, keys });

    // Register key bindings
    for (const key of keys) {
      const normalized = this.normalizeKeyCombo(key);
      this.keyBindings.set(normalized, shortcut.id);
    }
  }

  /**
   * Unregister a shortcut
   */
  unregister(id: string): void {
    const shortcut = this.shortcuts.get(id);
    if (shortcut) {
      for (const key of shortcut.keys) {
        const normalized = this.normalizeKeyCombo(key);
        this.keyBindings.delete(normalized);
      }
      this.shortcuts.delete(id);
    }
  }

  /**
   * Handle keydown event
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isEnabled) return;

    // Don't handle shortcuts when typing in input fields
    const target = event.target as HTMLElement;
    if (this.isInputElement(target)) {
      // Allow some shortcuts even in input fields
      if (!this.isGlobalShortcut(event)) {
        return;
      }
    }

    const keyCombo = this.getKeyCombo(event);
    const shortcutId = this.keyBindings.get(keyCombo);

    if (shortcutId) {
      const shortcut = this.shortcuts.get(shortcutId);
      if (shortcut && shortcut.enabled !== false) {
        event.preventDefault();
        event.stopPropagation();
        shortcut.action();
      }
    }
  }

  /**
   * Check if element is an input element
   */
  private isInputElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      element.isContentEditable
    );
  }

  /**
   * Check if shortcut should work globally (even in input fields)
   */
  private isGlobalShortcut(event: KeyboardEvent): boolean {
    // Escape always works
    if (event.key === 'Escape') return true;

    // Ctrl+S for save
    if (event.ctrlKey && event.key === 's') return true;

    // Space for play/pause (when not in text input)
    if (event.key === ' ' && !(event.target as HTMLElement).isContentEditable) {
      const target = event.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        return true;
      }
    }

    return false;
  }

  /**
   * Get key combo string from event
   */
  private getKeyCombo(event: KeyboardEvent): string {
    const parts: string[] = [];

    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');

    // Get the key
    let key = event.key;
    
    // Normalize single characters to uppercase for consistent matching
    if (key.length === 1) {
      key = key.toUpperCase();
    }

    // Normalize key names
    if (key === ' ') key = 'Space';
    if (key === 'ArrowUp') key = 'Up';
    if (key === 'ArrowDown') key = 'Down';
    if (key === 'ArrowLeft') key = 'Left';
    if (key === 'ArrowRight') key = 'Right';

    // Don't add modifier keys as the main key
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
      parts.push(key);
    }

    return parts.join('+');
  }

  /**
   * Normalize key combo string
   */
  private normalizeKeyCombo(combo: string): string {
    // Handle Chrome OS key mappings
    for (const [chromeKey, standardKey] of Object.entries(CHROME_OS_KEY_MAP)) {
      combo = combo.replace(chromeKey, standardKey);
    }

    // Split and sort modifiers
    const parts = combo.split('+').map(p => p.trim());
    const modifiers: string[] = [];
    let mainKey = '';

    for (const part of parts) {
      const normalized = part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      if (['Ctrl', 'Alt', 'Shift', 'Meta'].includes(normalized)) {
        modifiers.push(normalized);
      } else {
        // Normalize single characters to uppercase
        mainKey = part.length === 1 ? part.toUpperCase() : part;
      }
    }

    // Sort modifiers for consistent comparison
    modifiers.sort();

    return [...modifiers, mainKey].join('+');
  }

  /**
   * Subscribe to shortcut events
   */
  onShortcut(id: string, callback: ShortcutCallback): () => void {
    if (!this.callbacks.has(id)) {
      this.callbacks.set(id, []);
    }
    this.callbacks.get(id)!.push(callback);

    return () => {
      const callbacks = this.callbacks.get(id);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit shortcut event
   */
  private emitShortcut(id: string): void {
    const shortcut = this.shortcuts.get(id);
    if (!shortcut) return;

    const callbacks = this.callbacks.get(id);
    if (callbacks) {
      callbacks.forEach(cb => cb(shortcut));
    }

    // Also emit to 'all' listeners
    const allCallbacks = this.callbacks.get('all');
    if (allCallbacks) {
      allCallbacks.forEach(cb => cb(shortcut));
    }
  }

  /**
   * Get all shortcuts
   */
  getShortcuts(): ShortcutDefinition[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get shortcuts by category
   */
  getShortcutsByCategory(category: string): ShortcutDefinition[] {
    return this.getShortcuts().filter(s => s.category === category);
  }

  /**
   * Get shortcut by ID
   */
  getShortcut(id: string): ShortcutDefinition | undefined {
    return this.shortcuts.get(id);
  }

  /**
   * Update shortcut keys
   */
  updateShortcutKeys(id: string, keys: string[]): void {
    const shortcut = this.shortcuts.get(id);
    if (!shortcut) return;

    // Remove old bindings
    for (const key of shortcut.keys) {
      const normalized = this.normalizeKeyCombo(key);
      this.keyBindings.delete(normalized);
    }

    // Add new bindings
    shortcut.keys = keys;
    for (const key of keys) {
      const normalized = this.normalizeKeyCombo(key);
      this.keyBindings.set(normalized, id);
    }

    // Save custom binding
    this.customBindings.set(id, keys);
    this.saveCustomBindings();
  }

  /**
   * Reset shortcut to default
   */
  resetShortcut(id: string): void {
    const defaultShortcut = DEFAULT_SHORTCUTS.find(s => s.id === id);
    if (defaultShortcut) {
      this.updateShortcutKeys(id, defaultShortcut.keys);
      this.customBindings.delete(id);
      this.saveCustomBindings();
    }
  }

  /**
   * Reset all shortcuts to defaults
   */
  resetAllShortcuts(): void {
    this.customBindings.clear();
    this.saveCustomBindings();

    // Re-register all shortcuts
    this.shortcuts.clear();
    this.keyBindings.clear();
    this.registerDefaultShortcuts();
  }

  /**
   * Enable/disable shortcuts
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Check if shortcuts are enabled
   */
  isShortcutsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Show keyboard shortcuts overlay
   */
  showOverlay(): void {
    if (this.overlayVisible) return;

    this.overlayVisible = true;
    this.createOverlay();
  }

  /**
   * Hide keyboard shortcuts overlay
   */
  hideOverlay(): void {
    if (!this.overlayVisible) return;

    this.overlayVisible = false;
    const overlay = document.getElementById('keyboard-shortcuts-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * Toggle keyboard shortcuts overlay
   */
  toggleOverlay(): void {
    if (this.overlayVisible) {
      this.hideOverlay();
    } else {
      this.showOverlay();
    }
  }

  /**
   * Create overlay element
   */
  private createOverlay(): void {
    const overlay = document.createElement('div');
    overlay.id = 'keyboard-shortcuts-overlay';
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm';
    overlay.innerHTML = this.generateOverlayHTML();

    // Close on click outside or Escape
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.hideOverlay();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlayVisible) {
        this.hideOverlay();
      }
    }, { once: true });

    document.body.appendChild(overlay);
  }

  /**
   * Generate overlay HTML
   */
  private generateOverlayHTML(): string {
    const categories = SHORTCUT_CATEGORIES;
    
    let html = `
      <div class="bg-daw-bg-surface rounded-xl shadow-2xl border border-daw-border max-w-4xl max-h-[80vh] overflow-hidden">
        <div class="p-4 border-b border-daw-border flex items-center justify-between">
          <h2 class="text-daw-text-primary font-semibold text-lg">Keyboard Shortcuts</h2>
          <button onclick="document.getElementById('keyboard-shortcuts-overlay').remove()" class="text-daw-text-secondary hover:text-daw-text-primary">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div class="grid grid-cols-2 gap-6">
    `;

    for (const category of categories) {
      const shortcuts = this.getShortcutsByCategory(category.id);
      if (shortcuts.length === 0) continue;

      html += `
        <div>
          <h3 class="text-blue-400 font-medium mb-3 flex items-center gap-2">
            <span>${category.icon || ''}</span>
            ${category.name}
          </h3>
          <div class="space-y-2">
      `;

      for (const shortcut of shortcuts) {
        const keys = shortcut.keys.map(k => 
          `<kbd class="px-2 py-1 bg-daw-bg-elevated rounded text-xs font-mono text-daw-text-primary border border-daw-border">${k}</kbd>`
        ).join(' or ');

        html += `
          <div class="flex items-center justify-between text-sm">
            <span class="text-daw-text-secondary">${shortcut.name}</span>
            <div class="flex gap-1">${keys}</div>
          </div>
        `;
      }

      html += `
          </div>
        </div>
      `;
    }

    html += `
          </div>
        </div>
        <div class="p-4 border-t border-daw-border text-center text-daw-text-muted text-sm">
          Press <kbd class="px-2 py-1 bg-daw-bg-elevated rounded text-xs font-mono text-daw-text-primary border border-daw-border">Ctrl+/</kbd> to toggle this overlay
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Load custom bindings from localStorage
   */
  private loadCustomBindings(): void {
    try {
      const stored = localStorage.getItem('keyboard-shortcuts-custom');
      if (stored) {
        const bindings = JSON.parse(stored);
        this.customBindings = new Map(Object.entries(bindings));
      }
    } catch (e) {
      console.error('[Keyboard] Failed to load custom bindings:', e);
    }
  }

  /**
   * Save custom bindings to localStorage
   */
  private saveCustomBindings(): void {
    try {
      const bindings = Object.fromEntries(this.customBindings);
      localStorage.setItem('keyboard-shortcuts-custom', JSON.stringify(bindings));
    } catch (e) {
      console.error('[Keyboard] Failed to save custom bindings:', e);
    }
  }

  /**
   * Export shortcuts configuration
   */
  exportConfig(): string {
    const config = {
      version: 1,
      customBindings: Object.fromEntries(this.customBindings),
    };
    return JSON.stringify(config, null, 2);
  }

  /**
   * Import shortcuts configuration
   */
  importConfig(configJson: string): boolean {
    try {
      const config = JSON.parse(configJson);
      if (config.version !== 1) {
        throw new Error('Unsupported config version');
      }

      this.customBindings = new Map(Object.entries(config.customBindings));
      this.saveCustomBindings();

      // Re-register shortcuts with new bindings
      this.shortcuts.clear();
      this.keyBindings.clear();
      this.registerDefaultShortcuts();

      return true;
    } catch (e) {
      console.error('[Keyboard] Failed to import config:', e);
      return false;
    }
  }

  /**
   * Destroy and clean up
   */
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    this.hideOverlay();
    this.shortcuts.clear();
    this.keyBindings.clear();
    this.callbacks.clear();
  }
}

// Export singleton getter
export function getKeyboardShortcuts(): KeyboardShortcuts {
  return KeyboardShortcuts.getInstance();
}

export default KeyboardShortcuts;