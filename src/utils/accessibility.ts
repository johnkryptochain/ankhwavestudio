// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Accessibility Utilities
 * Helper functions for ARIA labels, screen reader support, and keyboard navigation
 */

/**
 * Generate a unique ID for ARIA relationships
 */
export function generateAriaId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Announce a message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement is made
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Focus trap for modal dialogs
 */
export function createFocusTrap(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };
  
  container.addEventListener('keydown', handleKeyDown);
  firstElement?.focus();
  
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Skip link for keyboard navigation
 */
export function createSkipLink(targetId: string, label: string = 'Skip to main content'): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = `#${targetId}`;
  link.className = 'sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-daw-bg-primary focus:text-daw-text-primary';
  link.textContent = label;
  return link;
}

/**
 * ARIA labels for common DAW elements
 */
export const ariaLabels = {
  // Transport controls
  play: 'Play',
  pause: 'Pause',
  stop: 'Stop',
  record: 'Record',
  loop: 'Toggle loop',
  rewind: 'Rewind to start',
  forward: 'Fast forward to end',
  
  // Mixer controls
  volume: (channel: string) => `${channel} volume`,
  pan: (channel: string) => `${channel} pan`,
  mute: (channel: string) => `Mute ${channel}`,
  solo: (channel: string) => `Solo ${channel}`,
  
  // Editor controls
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  zoomFit: 'Zoom to fit',
  selectTool: 'Select tool',
  drawTool: 'Draw tool',
  eraseTool: 'Erase tool',
  
  // File operations
  newProject: 'Create new project',
  openProject: 'Open project',
  saveProject: 'Save project',
  exportAudio: 'Export audio',
  importFile: 'Import file',
  
  // Navigation
  sidebar: 'Sidebar',
  mixer: 'Mixer panel',
  pianoRoll: 'Piano roll editor',
  songEditor: 'Song editor',
  patternEditor: 'Pattern editor',
  automationEditor: 'Automation editor',
};

/**
 * Keyboard navigation helpers
 */
export const keyboardNavigation = {
  /**
   * Handle arrow key navigation in a list
   */
  handleListNavigation: (
    e: KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    onSelect: (index: number) => void
  ): void => {
    let newIndex = currentIndex;
    
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        break;
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = items.length - 1;
        break;
    }
    
    if (newIndex !== currentIndex) {
      items[newIndex]?.focus();
      onSelect(newIndex);
    }
  },
  
  /**
   * Handle grid navigation (2D)
   */
  handleGridNavigation: (
    e: KeyboardEvent,
    columns: number,
    totalItems: number,
    currentIndex: number,
    onSelect: (index: number) => void
  ): void => {
    let newIndex = currentIndex;
    const row = Math.floor(currentIndex / columns);
    const col = currentIndex % columns;
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        newIndex = row > 0 ? currentIndex - columns : currentIndex;
        break;
      case 'ArrowDown':
        e.preventDefault();
        newIndex = currentIndex + columns < totalItems ? currentIndex + columns : currentIndex;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = col > 0 ? currentIndex - 1 : currentIndex;
        break;
      case 'ArrowRight':
        e.preventDefault();
        newIndex = col < columns - 1 && currentIndex + 1 < totalItems ? currentIndex + 1 : currentIndex;
        break;
    }
    
    if (newIndex !== currentIndex) {
      onSelect(newIndex);
    }
  },
};

/**
 * Screen reader only CSS class
 * Add this to tailwind.config.js or use inline
 */
export const srOnlyStyles = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: '0',
} as const;

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: more)').matches;
}

/**
 * Get appropriate animation duration based on user preferences
 */
export function getAnimationDuration(defaultMs: number): number {
  return prefersReducedMotion() ? 0 : defaultMs;
}

export default {
  generateAriaId,
  announceToScreenReader,
  createFocusTrap,
  createSkipLink,
  ariaLabels,
  keyboardNavigation,
  srOnlyStyles,
  prefersReducedMotion,
  prefersHighContrast,
  getAnimationDuration,
};