// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Performance Utilities
 * Lazy loading, code splitting, memory management, and Web Vitals tracking
 */

import { lazy, ComponentType, LazyExoticComponent } from 'react';

// ============================================================================
// Lazy Loading Utilities
// ============================================================================

/**
 * Create a lazy-loaded component with retry logic
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries: number = 3,
  delay: number = 1000
): LazyExoticComponent<T> {
  return lazy(() => retryImport(importFn, retries, delay));
}

/**
 * Retry import with exponential backoff
 */
async function retryImport<T>(
  importFn: () => Promise<T>,
  retries: number,
  delay: number
): Promise<T> {
  try {
    return await importFn();
  } catch (error) {
    if (retries === 0) {
      throw error;
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryImport(importFn, retries - 1, delay * 2);
  }
}

/**
 * Preload a lazy component
 */
export function preloadComponent(
  importFn: () => Promise<{ default: ComponentType<any> }>
): void {
  importFn().catch(() => {
    // Silently fail preload
  });
}

// ============================================================================
// Memory Management
// ============================================================================

export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usagePercent: number;
}

/**
 * Get current memory usage (Chrome only)
 */
export function getMemoryInfo(): MemoryInfo | null {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usagePercent: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
    };
  }
  return null;
}

/**
 * Check if memory usage is high
 */
export function isMemoryHigh(threshold: number = 80): boolean {
  const info = getMemoryInfo();
  return info ? info.usagePercent > threshold : false;
}

/**
 * Request garbage collection (Chrome with --expose-gc flag only)
 */
export function requestGC(): void {
  if ('gc' in window) {
    (window as any).gc();
  }
}

/**
 * Memory pressure handler
 */
export function onMemoryPressure(callback: () => void): () => void {
  // Use Performance Observer for memory warnings
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'memory') {
            callback();
          }
        }
      });
      
      observer.observe({ entryTypes: ['memory'] });
      
      return () => observer.disconnect();
    } catch {
      // Memory observation not supported
    }
  }
  
  // Fallback: periodic memory check
  const interval = setInterval(() => {
    if (isMemoryHigh(85)) {
      callback();
    }
  }, 30000);
  
  return () => clearInterval(interval);
}

// ============================================================================
// Web Vitals Tracking
// ============================================================================

export interface WebVitals {
  CLS: number | null;  // Cumulative Layout Shift
  FID: number | null;  // First Input Delay
  FCP: number | null;  // First Contentful Paint
  LCP: number | null;  // Largest Contentful Paint
  TTFB: number | null; // Time to First Byte
  INP: number | null;  // Interaction to Next Paint
}

type VitalsCallback = (vitals: Partial<WebVitals>) => void;

/**
 * Track Web Vitals
 */
export function trackWebVitals(callback: VitalsCallback): void {
  // First Contentful Paint
  trackFCP(callback);
  
  // Largest Contentful Paint
  trackLCP(callback);
  
  // First Input Delay
  trackFID(callback);
  
  // Cumulative Layout Shift
  trackCLS(callback);
  
  // Time to First Byte
  trackTTFB(callback);
  
  // Interaction to Next Paint
  trackINP(callback);
}

function trackFCP(callback: VitalsCallback): void {
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            callback({ FCP: entry.startTime });
            observer.disconnect();
          }
        }
      });
      observer.observe({ type: 'paint', buffered: true });
    } catch {
      // Not supported
    }
  }
}

function trackLCP(callback: VitalsCallback): void {
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        callback({ LCP: lastEntry.startTime });
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // Not supported
    }
  }
}

function trackFID(callback: VitalsCallback): void {
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fidEntry = entry as PerformanceEventTiming;
          callback({ FID: fidEntry.processingStart - fidEntry.startTime });
          observer.disconnect();
        }
      });
      observer.observe({ type: 'first-input', buffered: true });
    } catch {
      // Not supported
    }
  }
}

function trackCLS(callback: VitalsCallback): void {
  if ('PerformanceObserver' in window) {
    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
            callback({ CLS: clsValue });
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // Not supported
    }
  }
}

function trackTTFB(callback: VitalsCallback): void {
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const navEntry = entry as PerformanceNavigationTiming;
          callback({ TTFB: navEntry.responseStart - navEntry.requestStart });
          observer.disconnect();
        }
      });
      observer.observe({ type: 'navigation', buffered: true });
    } catch {
      // Not supported
    }
  }
}

function trackINP(callback: VitalsCallback): void {
  if ('PerformanceObserver' in window) {
    try {
      let maxINP = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const eventEntry = entry as PerformanceEventTiming;
          const inp = eventEntry.processingEnd - eventEntry.startTime;
          if (inp > maxINP) {
            maxINP = inp;
            callback({ INP: maxINP });
          }
        }
      });
      observer.observe({ type: 'event', buffered: true });
    } catch {
      // Not supported
    }
  }
}

// ============================================================================
// Performance Monitoring
// ============================================================================

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  longTasks: number;
  memoryUsage: number | null;
}

type MetricsCallback = (metrics: PerformanceMetrics) => void;

/**
 * Start performance monitoring
 */
export function startPerformanceMonitoring(
  callback: MetricsCallback,
  intervalMs: number = 1000
): () => void {
  let frameCount = 0;
  let lastTime = performance.now();
  let longTaskCount = 0;
  let animationFrameId: number;
  
  // Count frames for FPS
  const countFrame = () => {
    frameCount++;
    animationFrameId = requestAnimationFrame(countFrame);
  };
  animationFrameId = requestAnimationFrame(countFrame);
  
  // Track long tasks
  let longTaskObserver: PerformanceObserver | null = null;
  if ('PerformanceObserver' in window) {
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        longTaskCount += list.getEntries().length;
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch {
      // Not supported
    }
  }
  
  // Report metrics periodically
  const interval = setInterval(() => {
    const now = performance.now();
    const elapsed = now - lastTime;
    const fps = Math.round((frameCount / elapsed) * 1000);
    const frameTime = elapsed / frameCount;
    
    const memory = getMemoryInfo();
    
    callback({
      fps,
      frameTime,
      longTasks: longTaskCount,
      memoryUsage: memory?.usagePercent ?? null,
    });
    
    // Reset counters
    frameCount = 0;
    lastTime = now;
    longTaskCount = 0;
  }, intervalMs);
  
  // Return cleanup function
  return () => {
    cancelAnimationFrame(animationFrameId);
    clearInterval(interval);
    longTaskObserver?.disconnect();
  };
}

// ============================================================================
// Resource Loading
// ============================================================================

/**
 * Preload critical resources
 */
export function preloadResources(urls: string[]): void {
  for (const url of urls) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    
    // Determine resource type
    if (url.endsWith('.js')) {
      link.as = 'script';
    } else if (url.endsWith('.css')) {
      link.as = 'style';
    } else if (url.match(/\.(woff2?|ttf|eot)$/)) {
      link.as = 'font';
      link.crossOrigin = 'anonymous';
    } else if (url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) {
      link.as = 'image';
    } else if (url.match(/\.(wav|mp3|ogg)$/)) {
      link.as = 'audio';
    }
    
    document.head.appendChild(link);
  }
}

/**
 * Prefetch resources for future navigation
 */
export function prefetchResources(urls: string[]): void {
  for (const url of urls) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  }
}

/**
 * Load script dynamically
 */
export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

// ============================================================================
// Idle Callback Utilities
// ============================================================================

/**
 * Run task when browser is idle
 */
export function runWhenIdle(
  callback: () => void,
  timeout: number = 5000
): number {
  if ('requestIdleCallback' in window) {
    return (window as any).requestIdleCallback(callback, { timeout });
  }
  // Fallback to setTimeout
  return globalThis.setTimeout(callback, 1) as unknown as number;
}

/**
 * Cancel idle callback
 */
export function cancelIdle(id: number): void {
  if ('cancelIdleCallback' in window) {
    (window as any).cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

/**
 * Defer non-critical work
 */
export function deferWork<T>(
  work: () => T,
  priority: 'high' | 'normal' | 'low' = 'normal'
): Promise<T> {
  return new Promise((resolve) => {
    const timeout = priority === 'high' ? 100 : priority === 'normal' ? 1000 : 5000;
    
    runWhenIdle(() => {
      resolve(work());
    }, timeout);
  });
}

// ============================================================================
// Debounce and Throttle
// ============================================================================

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * RAF throttle (throttle to animation frame)
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  
  return (...args: Parameters<T>) => {
    if (rafId !== null) return;
    
    rafId = requestAnimationFrame(() => {
      fn(...args);
      rafId = null;
    });
  };
}

// ============================================================================
// Export all utilities
// ============================================================================

export default {
  lazyWithRetry,
  preloadComponent,
  getMemoryInfo,
  isMemoryHigh,
  requestGC,
  onMemoryPressure,
  trackWebVitals,
  startPerformanceMonitoring,
  preloadResources,
  prefetchResources,
  loadScript,
  runWhenIdle,
  cancelIdle,
  deferWork,
  debounce,
  throttle,
  rafThrottle,
};