// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * JemaOS Optimizations
 * Platform-specific optimizations for JemaOS devices
 */

export interface PlatformInfo {
  isChromeOS: boolean;
  isJemaOS: boolean;
  isAndroidApp: boolean;
  hasLinuxContainer: boolean;
  isLowPowerDevice: boolean;
  screenSize: 'small' | 'medium' | 'large';
  hasTouch: boolean;
  hasStylus: boolean;
  memoryGB: number;
  cpuCores: number;
}

export interface PerformanceProfile {
  maxPolyphony: number;
  maxTracks: number;
  bufferSize: number;
  sampleRate: number;
  enableEffects: boolean;
  enableVisualization: boolean;
  renderQuality: 'low' | 'medium' | 'high';
}

/**
 * Detect Chrome OS / JemaOS environment
 */
export function detectPlatform(): PlatformInfo {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';
  
  // Detect Chrome OS
  const isChromeOS = userAgent.includes('cros') || 
                     platform.includes('cros') ||
                     /\bcros\b/.test(userAgent);
  
  // Detect JemaOS (FydeOS-based)
  const isJemaOS = userAgent.includes('jemaos') || 
                   userAgent.includes('fydeos') ||
                   document.documentElement.getAttribute('data-os') === 'jemaos';
  
  // Detect if running as Android app (via ARC++ or ARCVM)
  const isAndroidApp = userAgent.includes('wv') && isJemaOS;
  
  // Check for Linux container (Crostini)
  const hasLinuxContainer = checkLinuxContainer();
  
  // Detect device capabilities
  const memoryGB = getDeviceMemory();
  const cpuCores = navigator.hardwareConcurrency || 2;
  const isLowPowerDevice = memoryGB <= 4 || cpuCores <= 2;
  
  // Screen size detection
  const screenWidth = window.screen.width;
  const screenSize: 'small' | 'medium' | 'large' = 
    screenWidth < 1024 ? 'small' : 
    screenWidth < 1920 ? 'medium' : 'large';
  
  // Touch and stylus detection
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasStylus = checkStylusSupport();
  
  return {
    isChromeOS,
    isJemaOS,
    isAndroidApp,
    hasLinuxContainer,
    isLowPowerDevice,
    screenSize,
    hasTouch,
    hasStylus,
    memoryGB,
    cpuCores,
  };
}

/**
 * Check for Linux container availability
 */
function checkLinuxContainer(): boolean {
  // This is a heuristic - actual detection would require system APIs
  try {
    // Check if we can access certain Linux-specific features
    const hasLinuxFeatures = 'showDirectoryPicker' in window;
    return hasLinuxFeatures;
  } catch {
    return false;
  }
}

/**
 * Get device memory in GB
 */
function getDeviceMemory(): number {
  if ('deviceMemory' in navigator) {
    return (navigator as any).deviceMemory || 4;
  }
  // Estimate based on other factors
  return 4; // Default assumption
}

/**
 * Check for stylus support
 */
function checkStylusSupport(): boolean {
  // Check for pointer events with pen support
  if ('PointerEvent' in window) {
    // Create a test to see if pen input is available
    return window.matchMedia('(pointer: fine)').matches && 
           window.matchMedia('(hover: none)').matches;
  }
  return false;
}

/**
 * Get optimized performance profile based on device capabilities
 */
export function getPerformanceProfile(platform: PlatformInfo): PerformanceProfile {
  if (platform.isLowPowerDevice) {
    return {
      maxPolyphony: 32,
      maxTracks: 16,
      bufferSize: 2048,
      sampleRate: 44100,
      enableEffects: true,
      enableVisualization: false,
      renderQuality: 'low',
    };
  }
  
  if (platform.memoryGB <= 8) {
    return {
      maxPolyphony: 64,
      maxTracks: 32,
      bufferSize: 1024,
      sampleRate: 44100,
      enableEffects: true,
      enableVisualization: true,
      renderQuality: 'medium',
    };
  }
  
  return {
    maxPolyphony: 128,
    maxTracks: 64,
    bufferSize: 512,
    sampleRate: 48000,
    enableEffects: true,
    enableVisualization: true,
    renderQuality: 'high',
  };
}

/**
 * Apply Chrome OS specific optimizations
 */
export function applyJemaOSOptimizations(platform: PlatformInfo): void {
  if (!platform.isJemaOS && !platform.isJemaOS) {
    return;
  }
  
  console.log('[JemaOS] Applying platform optimizations');
  
  // Optimize for Chrome OS file system
  setupJemaOSFileSystem();
  
  // Apply memory optimizations
  if (platform.isLowPowerDevice) {
    applyLowPowerOptimizations();
  }
  
  // Set up Android app compatibility if needed
  if (platform.isAndroidApp) {
    setupAndroidCompatibility();
  }
  
  // Apply touch optimizations if device has touch
  if (platform.hasTouch) {
    applyTouchOptimizations();
  }
}

/**
 * Set up Chrome OS file system integration
 */
function setupJemaOSFileSystem(): void {
  // Chrome OS has specific file system behaviors
  // Set up handlers for Chrome OS file manager integration
  
  // Listen for file system events
  if ('launchQueue' in window) {
    console.log('[JemaOS] File handler integration available');
  }
  
  // Set up drag and drop from Chrome OS Files app
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  });
  
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    
    const items = e.dataTransfer?.items;
    if (!items) return;
    
    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          // Dispatch event for file handling
          window.dispatchEvent(new CustomEvent('jemaos-file-drop', {
            detail: { file },
          }));
        }
      }
    }
  });
}

/**
 * Apply optimizations for low-power devices
 */
function applyLowPowerOptimizations(): void {
  console.log('[JemaOS] Applying low-power optimizations');
  
  // Reduce animation frame rate
  const style = document.createElement('style');
  style.textContent = `
    /* Reduce animations on low-power devices */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
    
    /* Optimize for low-power */
    .low-power-mode {
      will-change: auto !important;
    }
    
    .low-power-mode * {
      transform: none !important;
      filter: none !important;
    }
  `;
  document.head.appendChild(style);
  
  // Add low-power class to body
  document.body.classList.add('low-power-mode');
  
  // Reduce canvas rendering quality
  const canvases = document.querySelectorAll('canvas');
  canvases.forEach(canvas => {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      (ctx as any).imageSmoothingEnabled = false;
    }
  });
}

/**
 * Set up Android app compatibility layer
 */
function setupAndroidCompatibility(): void {
  console.log('[JemaOS] Setting up Android compatibility');
  
  // Handle Android-specific behaviors
  // Adjust viewport for Android container
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    );
  }
  
  // Handle Android back button
  window.addEventListener('popstate', (e) => {
    // Dispatch custom event for app to handle
    window.dispatchEvent(new CustomEvent('android-back-button'));
  });
}

/**
 * Apply touch-specific optimizations
 */
function applyTouchOptimizations(): void {
  console.log('[JemaOS] Applying touch optimizations');
  
  // Add touch-specific styles
  const style = document.createElement('style');
  style.textContent = `
    /* Touch-friendly targets */
    .touch-mode button,
    .touch-mode [role="button"],
    .touch-mode input,
    .touch-mode select {
      min-height: 44px;
      min-width: 44px;
    }
    
    /* Disable hover effects on touch */
    @media (hover: none) {
      .touch-mode *:hover {
        background-color: inherit !important;
      }
    }
    
    /* Improve touch scrolling */
    .touch-mode {
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
    }
    
    /* Touch feedback */
    .touch-mode button:active,
    .touch-mode [role="button"]:active {
      transform: scale(0.98);
      opacity: 0.9;
    }
  `;
  document.head.appendChild(style);
  
  // Add touch mode class
  document.body.classList.add('touch-mode');
  
  // Prevent double-tap zoom
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
}

/**
 * Get Chrome OS specific storage paths
 */
export function getJemaOSPaths(): {
  downloads: string;
  documents: string;
  music: string;
} {
  // Chrome OS uses specific paths
  return {
    downloads: '/home/chronos/user/Downloads',
    documents: '/home/chronos/user/MyFiles/Documents',
    music: '/home/chronos/user/MyFiles/Music',
  };
}

/**
 * Check if running in tablet mode
 */
export function isTabletMode(): boolean {
  // Check for tablet mode indicators
  const isPortrait = window.matchMedia('(orientation: portrait)').matches;
  const hasTouch = 'ontouchstart' in window;
  const isSmallScreen = window.innerWidth < 1024;
  
  return hasTouch && (isPortrait || isSmallScreen);
}

/**
 * Request wake lock to prevent screen from sleeping during playback
 */
export async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  if (!('wakeLock' in navigator)) {
    console.warn('[JemaOS] Wake Lock API not supported');
    return null;
  }
  
  try {
    const wakeLock = await navigator.wakeLock.request('screen');
    console.log('[JemaOS] Wake lock acquired');
    
    // Re-acquire wake lock if visibility changes
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        try {
          await navigator.wakeLock.request('screen');
        } catch (e) {
          console.warn('[JemaOS] Failed to re-acquire wake lock');
        }
      }
    });
    
    return wakeLock;
  } catch (error) {
    console.warn('[JemaOS] Failed to acquire wake lock:', error);
    return null;
  }
}

/**
 * Release wake lock
 */
export async function releaseWakeLock(wakeLock: WakeLockSentinel | null): Promise<void> {
  if (wakeLock) {
    await wakeLock.release();
    console.log('[JemaOS] Wake lock released');
  }
}

// Export singleton instance
let platformInfo: PlatformInfo | null = null;

export function getPlatformInfo(): PlatformInfo {
  if (!platformInfo) {
    platformInfo = detectPlatform();
  }
  return platformInfo;
}

export function initializeJemaOSOptimizations(): void {
  const platform = getPlatformInfo();
  applyJemaOSOptimizations(platform);
  
  // Log platform info
  console.log('[JemaOS] Platform detected:', {
    isChromeOS: platform.isChromeOS,
    isJemaOS: platform.isJemaOS,
    isLowPowerDevice: platform.isLowPowerDevice,
    memoryGB: platform.memoryGB,
    cpuCores: platform.cpuCores,
  });
}