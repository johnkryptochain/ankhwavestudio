// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Touch Optimizations for Convertible Devices
 * Enhanced touch support, stylus handling, and gesture recognition
 */

export interface TouchConfig {
  enablePinchZoom: boolean;
  enableTwoFingerScroll: boolean;
  enableStylusSupport: boolean;
  enablePalmRejection: boolean;
  touchTargetSize: number;
  longPressDelay: number;
  doubleTapDelay: number;
}

export interface GestureState {
  type: 'none' | 'pan' | 'pinch' | 'rotate' | 'longpress';
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  scale: number;
  rotation: number;
  velocity: { x: number; y: number };
}

export interface StylusState {
  isActive: boolean;
  pressure: number;
  tiltX: number;
  tiltY: number;
  twist: number;
  pointerType: 'pen' | 'touch' | 'mouse';
}

type GestureCallback = (state: GestureState) => void;
type StylusCallback = (state: StylusState, event: PointerEvent) => void;

const DEFAULT_CONFIG: TouchConfig = {
  enablePinchZoom: true,
  enableTwoFingerScroll: true,
  enableStylusSupport: true,
  enablePalmRejection: true,
  touchTargetSize: 44,
  longPressDelay: 500,
  doubleTapDelay: 300,
};

/**
 * Touch optimization manager
 */
export class TouchOptimizations {
  private static instance: TouchOptimizations | null = null;
  private config: TouchConfig;
  private gestureState: GestureState;
  private stylusState: StylusState;
  private gestureCallbacks: Map<string, GestureCallback[]> = new Map();
  private stylusCallbacks: StylusCallback[] = [];
  private longPressTimer: number | null = null;
  private lastTapTime: number = 0;
  private lastTapPosition: { x: number; y: number } = { x: 0, y: 0 };
  private touchStartPositions: Map<number, { x: number; y: number; time: number }> = new Map();
  private isInitialized: boolean = false;

  private constructor(config: Partial<TouchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.gestureState = this.createInitialGestureState();
    this.stylusState = this.createInitialStylusState();
  }

  static getInstance(config?: Partial<TouchConfig>): TouchOptimizations {
    if (!TouchOptimizations.instance) {
      TouchOptimizations.instance = new TouchOptimizations(config);
    }
    return TouchOptimizations.instance;
  }

  private createInitialGestureState(): GestureState {
    return {
      type: 'none',
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      scale: 1,
      rotation: 0,
      velocity: { x: 0, y: 0 },
    };
  }

  private createInitialStylusState(): StylusState {
    return {
      isActive: false,
      pressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      pointerType: 'touch',
    };
  }

  /**
   * Initialize touch optimizations
   */
  initialize(element: HTMLElement = document.body): void {
    if (this.isInitialized) return;

    console.log('[Touch] Initializing touch optimizations');

    // Add touch event listeners
    element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    element.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });

    // Add pointer event listeners for stylus
    if (this.config.enableStylusSupport) {
      element.addEventListener('pointerdown', this.handlePointerDown.bind(this));
      element.addEventListener('pointermove', this.handlePointerMove.bind(this));
      element.addEventListener('pointerup', this.handlePointerUp.bind(this));
      element.addEventListener('pointercancel', this.handlePointerCancel.bind(this));
    }

    // Apply CSS optimizations
    this.applyCSSOptimizations(element);

    this.isInitialized = true;
  }

  /**
   * Apply CSS optimizations for touch
   */
  private applyCSSOptimizations(element: HTMLElement): void {
    const style = document.createElement('style');
    style.id = 'touch-optimizations';
    style.textContent = `
      /* Prevent text selection during touch */
      .touch-active {
        user-select: none;
        -webkit-user-select: none;
      }

      /* Touch-friendly sizing */
      .touch-target {
        min-width: ${this.config.touchTargetSize}px;
        min-height: ${this.config.touchTargetSize}px;
        padding: 8px;
      }

      /* Smooth touch scrolling */
      .touch-scroll {
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        scroll-behavior: smooth;
      }

      /* Disable default touch behaviors */
      .touch-none {
        touch-action: none;
      }

      /* Pan only (for scrollable areas) */
      .touch-pan {
        touch-action: pan-x pan-y;
      }

      /* Pinch zoom enabled */
      .touch-pinch {
        touch-action: pinch-zoom;
      }

      /* Stylus-specific styles */
      .stylus-active {
        cursor: crosshair;
      }

      /* Touch feedback */
      .touch-feedback {
        transition: transform 0.1s ease-out, opacity 0.1s ease-out;
      }

      .touch-feedback:active {
        transform: scale(0.97);
        opacity: 0.9;
      }

      /* Palm rejection indicator */
      .palm-rejected {
        pointer-events: none;
        opacity: 0.5;
      }

      /* Gesture visualization (debug) */
      .gesture-indicator {
        position: fixed;
        pointer-events: none;
        z-index: 9999;
        border: 2px solid rgba(74, 158, 255, 0.5);
        border-radius: 50%;
        background: rgba(74, 158, 255, 0.1);
      }
    `;
    document.head.appendChild(style);

    // Add touch-scroll class to scrollable containers
    element.classList.add('touch-scroll');
  }

  /**
   * Handle touch start
   */
  private handleTouchStart(event: TouchEvent): void {
    const touches = event.touches;

    // Store touch positions
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      this.touchStartPositions.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      });
    }

    if (touches.length === 1) {
      // Single touch - potential long press or tap
      const touch = touches[0];
      this.gestureState.startX = touch.clientX;
      this.gestureState.startY = touch.clientY;
      this.gestureState.currentX = touch.clientX;
      this.gestureState.currentY = touch.clientY;

      // Start long press timer
      this.longPressTimer = window.setTimeout(() => {
        this.gestureState.type = 'longpress';
        this.emitGesture('longpress', this.gestureState);
      }, this.config.longPressDelay);

    } else if (touches.length === 2) {
      // Two finger gesture - pinch or scroll
      this.cancelLongPress();
      this.gestureState.type = 'pinch';
      this.gestureState.scale = 1;
      this.gestureState.rotation = 0;
    }

    document.body.classList.add('touch-active');
  }

  /**
   * Handle touch move
   */
  private handleTouchMove(event: TouchEvent): void {
    const touches = event.touches;

    if (touches.length === 1) {
      const touch = touches[0];
      const deltaX = touch.clientX - this.gestureState.startX;
      const deltaY = touch.clientY - this.gestureState.startY;

      // Cancel long press if moved too much
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        this.cancelLongPress();
        this.gestureState.type = 'pan';
      }

      this.gestureState.currentX = touch.clientX;
      this.gestureState.currentY = touch.clientY;

      // Calculate velocity
      const startPos = this.touchStartPositions.get(touch.identifier);
      if (startPos) {
        const timeDelta = (Date.now() - startPos.time) / 1000;
        if (timeDelta > 0) {
          this.gestureState.velocity = {
            x: deltaX / timeDelta,
            y: deltaY / timeDelta,
          };
        }
      }

      if (this.gestureState.type === 'pan') {
        this.emitGesture('pan', this.gestureState);
      }

    } else if (touches.length === 2 && this.config.enablePinchZoom) {
      // Calculate pinch scale and rotation
      const touch1 = touches[0];
      const touch2 = touches[1];

      const currentDistance = this.getDistance(
        touch1.clientX, touch1.clientY,
        touch2.clientX, touch2.clientY
      );

      const start1 = this.touchStartPositions.get(touch1.identifier);
      const start2 = this.touchStartPositions.get(touch2.identifier);

      if (start1 && start2) {
        const startDistance = this.getDistance(
          start1.x, start1.y,
          start2.x, start2.y
        );

        if (startDistance > 0) {
          this.gestureState.scale = currentDistance / startDistance;
        }

        // Calculate rotation
        const currentAngle = Math.atan2(
          touch2.clientY - touch1.clientY,
          touch2.clientX - touch1.clientX
        );
        const startAngle = Math.atan2(
          start2.y - start1.y,
          start2.x - start1.x
        );
        this.gestureState.rotation = (currentAngle - startAngle) * (180 / Math.PI);
      }

      // Update center position
      this.gestureState.currentX = (touch1.clientX + touch2.clientX) / 2;
      this.gestureState.currentY = (touch1.clientY + touch2.clientY) / 2;

      this.emitGesture('pinch', this.gestureState);

      // Prevent default to stop browser zoom
      if (this.config.enablePinchZoom) {
        event.preventDefault();
      }
    }
  }

  /**
   * Handle touch end
   */
  private handleTouchEnd(event: TouchEvent): void {
    this.cancelLongPress();

    const changedTouches = event.changedTouches;
    for (let i = 0; i < changedTouches.length; i++) {
      this.touchStartPositions.delete(changedTouches[i].identifier);
    }

    if (event.touches.length === 0) {
      // All touches ended
      document.body.classList.remove('touch-active');

      // Check for double tap
      const now = Date.now();
      const touch = changedTouches[0];
      const tapDistance = this.getDistance(
        touch.clientX, touch.clientY,
        this.lastTapPosition.x, this.lastTapPosition.y
      );

      if (now - this.lastTapTime < this.config.doubleTapDelay && tapDistance < 30) {
        this.emitGesture('doubletap', {
          ...this.gestureState,
          currentX: touch.clientX,
          currentY: touch.clientY,
        });
      }

      this.lastTapTime = now;
      this.lastTapPosition = { x: touch.clientX, y: touch.clientY };

      // Emit gesture end
      this.emitGesture('end', this.gestureState);

      // Reset state
      this.gestureState = this.createInitialGestureState();
    }
  }

  /**
   * Handle touch cancel
   */
  private handleTouchCancel(_event: TouchEvent): void {
    this.cancelLongPress();
    this.touchStartPositions.clear();
    document.body.classList.remove('touch-active');
    this.gestureState = this.createInitialGestureState();
  }

  /**
   * Handle pointer down (for stylus)
   */
  private handlePointerDown(event: PointerEvent): void {
    if (event.pointerType === 'pen') {
      this.stylusState = {
        isActive: true,
        pressure: event.pressure,
        tiltX: event.tiltX,
        tiltY: event.tiltY,
        twist: event.twist,
        pointerType: 'pen',
      };

      document.body.classList.add('stylus-active');
      this.emitStylusEvent(this.stylusState, event);

      // Palm rejection - ignore touch events while stylus is active
      if (this.config.enablePalmRejection) {
        this.enablePalmRejection();
      }
    }
  }

  /**
   * Handle pointer move (for stylus)
   */
  private handlePointerMove(event: PointerEvent): void {
    if (event.pointerType === 'pen' && this.stylusState.isActive) {
      this.stylusState.pressure = event.pressure;
      this.stylusState.tiltX = event.tiltX;
      this.stylusState.tiltY = event.tiltY;
      this.stylusState.twist = event.twist;

      this.emitStylusEvent(this.stylusState, event);
    }
  }

  /**
   * Handle pointer up (for stylus)
   */
  private handlePointerUp(event: PointerEvent): void {
    if (event.pointerType === 'pen') {
      this.stylusState.isActive = false;
      this.stylusState.pressure = 0;

      document.body.classList.remove('stylus-active');
      this.emitStylusEvent(this.stylusState, event);

      // Disable palm rejection after stylus is lifted
      if (this.config.enablePalmRejection) {
        setTimeout(() => this.disablePalmRejection(), 500);
      }
    }
  }

  /**
   * Handle pointer cancel (for stylus)
   */
  private handlePointerCancel(event: PointerEvent): void {
    if (event.pointerType === 'pen') {
      this.stylusState = this.createInitialStylusState();
      document.body.classList.remove('stylus-active');
      this.disablePalmRejection();
    }
  }

  /**
   * Enable palm rejection
   */
  private enablePalmRejection(): void {
    document.body.classList.add('palm-rejection-active');
    
    // Temporarily ignore touch events
    const handler = (e: TouchEvent) => {
      if (this.stylusState.isActive) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('touchstart', handler, { capture: true });
    document.addEventListener('touchmove', handler, { capture: true });

    // Store handler for removal
    (this as any)._palmRejectionHandler = handler;
  }

  /**
   * Disable palm rejection
   */
  private disablePalmRejection(): void {
    document.body.classList.remove('palm-rejection-active');
    
    const handler = (this as any)._palmRejectionHandler;
    if (handler) {
      document.removeEventListener('touchstart', handler, { capture: true });
      document.removeEventListener('touchmove', handler, { capture: true });
      delete (this as any)._palmRejectionHandler;
    }
  }

  /**
   * Cancel long press timer
   */
  private cancelLongPress(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  /**
   * Calculate distance between two points
   */
  private getDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  /**
   * Register gesture callback
   */
  onGesture(type: string, callback: GestureCallback): () => void {
    if (!this.gestureCallbacks.has(type)) {
      this.gestureCallbacks.set(type, []);
    }
    this.gestureCallbacks.get(type)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.gestureCallbacks.get(type);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Register stylus callback
   */
  onStylus(callback: StylusCallback): () => void {
    this.stylusCallbacks.push(callback);

    return () => {
      const index = this.stylusCallbacks.indexOf(callback);
      if (index > -1) {
        this.stylusCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Emit gesture event
   */
  private emitGesture(type: string, state: GestureState): void {
    const callbacks = this.gestureCallbacks.get(type);
    if (callbacks) {
      callbacks.forEach(cb => cb(state));
    }

    // Also emit to 'all' listeners
    const allCallbacks = this.gestureCallbacks.get('all');
    if (allCallbacks) {
      allCallbacks.forEach(cb => cb({ ...state, type: type as GestureState['type'] }));
    }
  }

  /**
   * Emit stylus event
   */
  private emitStylusEvent(state: StylusState, event: PointerEvent): void {
    this.stylusCallbacks.forEach(cb => cb(state, event));
  }

  /**
   * Get current gesture state
   */
  getGestureState(): GestureState {
    return { ...this.gestureState };
  }

  /**
   * Get current stylus state
   */
  getStylusState(): StylusState {
    return { ...this.stylusState };
  }

  /**
   * Check if stylus is currently active
   */
  isStylusActive(): boolean {
    return this.stylusState.isActive;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TouchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Destroy and clean up
   */
  destroy(): void {
    this.cancelLongPress();
    this.touchStartPositions.clear();
    this.gestureCallbacks.clear();
    this.stylusCallbacks = [];
    this.disablePalmRejection();

    const style = document.getElementById('touch-optimizations');
    if (style) {
      style.remove();
    }

    document.body.classList.remove('touch-active', 'stylus-active', 'touch-scroll');
    this.isInitialized = false;
  }
}

/**
 * React hook for touch gestures
 */
export function useTouchGestures(
  elementRef: React.RefObject<HTMLElement>,
  callbacks: {
    onPan?: GestureCallback;
    onPinch?: GestureCallback;
    onLongPress?: GestureCallback;
    onDoubleTap?: GestureCallback;
  }
) {
  const { useEffect } = require('react');

  useEffect(() => {
    const touch = TouchOptimizations.getInstance();
    
    if (elementRef.current) {
      touch.initialize(elementRef.current);
    }

    const unsubscribers: (() => void)[] = [];

    if (callbacks.onPan) {
      unsubscribers.push(touch.onGesture('pan', callbacks.onPan));
    }
    if (callbacks.onPinch) {
      unsubscribers.push(touch.onGesture('pinch', callbacks.onPinch));
    }
    if (callbacks.onLongPress) {
      unsubscribers.push(touch.onGesture('longpress', callbacks.onLongPress));
    }
    if (callbacks.onDoubleTap) {
      unsubscribers.push(touch.onGesture('doubletap', callbacks.onDoubleTap));
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [elementRef, callbacks]);
}

/**
 * React hook for stylus input
 */
export function useStylusInput(
  callback: StylusCallback
) {
  const { useEffect } = require('react');

  useEffect(() => {
    const touch = TouchOptimizations.getInstance();
    touch.initialize();

    const unsubscribe = touch.onStylus(callback);

    return () => {
      unsubscribe();
    };
  }, [callback]);
}

export default TouchOptimizations;