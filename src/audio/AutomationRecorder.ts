// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * AutomationRecorder - Records parameter changes in real-time
 * 
 * Features:
 * - Record parameter changes during playback
 * - Capture knob/slider movements
 * - Convert movements to automation points
 * - Smoothing/thinning of recorded data
 * - Arm/disarm recording per parameter
 */

import { clamp } from './utils/AudioMath';

/**
 * Automation recording modes
 */
export enum AutomationRecordMode {
  /** Read only - no recording, just playback */
  Read = 'read',
  /** Write - always record, overwriting existing data */
  Write = 'write',
  /** Touch - record only while parameter is being touched */
  Touch = 'touch',
  /** Latch - start recording on first touch, continue until stopped */
  Latch = 'latch',
}

/**
 * Single automation point
 */
export interface AutomationPoint {
  time: number;      // Time in seconds
  value: number;     // Parameter value (normalized 0-1)
  curve?: 'linear' | 'smooth' | 'step' | 'exponential' | 'bezier';  // Interpolation type
  tension?: number;  // Curve tension (-1 to 1) for bezier/exponential
}

/**
 * Automation lane for a single parameter
 */
export interface AutomationLane {
  id: string;
  trackId: string;
  parameterId: string;
  parameterName: string;
  points: AutomationPoint[];
  armed: boolean;
  mode: AutomationRecordMode;
  minValue: number;
  maxValue: number;
}

/**
 * Recording state for a parameter
 */
interface RecordingState {
  isRecording: boolean;
  isTouched: boolean;
  lastValue: number;
  lastTime: number;
  pendingPoints: AutomationPoint[];
}

/**
 * Automation recorder event
 */
export interface AutomationRecorderEvent {
  type: 'recordStart' | 'recordStop' | 'pointAdded' | 'armChanged' | 'modeChanged';
  laneId: string;
  data?: unknown;
}

export type AutomationRecorderCallback = (event: AutomationRecorderEvent) => void;

/**
 * AutomationRecorder class
 */
export class AutomationRecorder {
  private lanes: Map<string, AutomationLane> = new Map();
  private recordingStates: Map<string, RecordingState> = new Map();
  private isPlaying: boolean = false;
  private isGlobalRecordEnabled: boolean = false;
  private currentTime: number = 0;
  private callbacks: AutomationRecorderCallback[] = [];
  
  // Recording settings
  private minPointInterval: number = 0.01;  // Minimum time between points (seconds)
  private valueThreshold: number = 0.001;   // Minimum value change to record
  private smoothingEnabled: boolean = true;
  private thinningEnabled: boolean = true;
  private thinningThreshold: number = 0.005; // Threshold for point thinning

  constructor() {
    // Initialize
  }

  /**
   * Create a new automation lane
   */
  createLane(
    trackId: string,
    parameterId: string,
    parameterName: string,
    minValue: number = 0,
    maxValue: number = 1
  ): AutomationLane {
    const id = `${trackId}:${parameterId}`;
    
    const lane: AutomationLane = {
      id,
      trackId,
      parameterId,
      parameterName,
      points: [],
      armed: false,
      mode: AutomationRecordMode.Read,
      minValue,
      maxValue,
    };
    
    this.lanes.set(id, lane);
    
    // Initialize recording state
    this.recordingStates.set(id, {
      isRecording: false,
      isTouched: false,
      lastValue: 0,
      lastTime: 0,
      pendingPoints: [],
    });
    
    return lane;
  }

  /**
   * Get a lane by ID
   */
  getLane(laneId: string): AutomationLane | undefined {
    return this.lanes.get(laneId);
  }

  /**
   * Get all lanes for a track
   */
  getLanesForTrack(trackId: string): AutomationLane[] {
    return Array.from(this.lanes.values()).filter(lane => lane.trackId === trackId);
  }

  /**
   * Get all lanes
   */
  getAllLanes(): AutomationLane[] {
    return Array.from(this.lanes.values());
  }

  /**
   * Delete a lane
   */
  deleteLane(laneId: string): boolean {
    this.recordingStates.delete(laneId);
    return this.lanes.delete(laneId);
  }

  /**
   * Arm/disarm a lane for recording
   */
  setArmed(laneId: string, armed: boolean): void {
    const lane = this.lanes.get(laneId);
    if (lane) {
      lane.armed = armed;
      this.emitEvent({ type: 'armChanged', laneId, data: { armed } });
    }
  }

  /**
   * Set recording mode for a lane
   */
  setMode(laneId: string, mode: AutomationRecordMode): void {
    const lane = this.lanes.get(laneId);
    if (lane) {
      lane.mode = mode;
      this.emitEvent({ type: 'modeChanged', laneId, data: { mode } });
    }
  }

  /**
   * Set global record enable
   */
  setGlobalRecordEnabled(enabled: boolean): void {
    this.isGlobalRecordEnabled = enabled;
  }

  /**
   * Get global record enable state
   */
  isGlobalRecordingEnabled(): boolean {
    return this.isGlobalRecordEnabled;
  }

  /**
   * Start playback (called by transport)
   */
  startPlayback(): void {
    this.isPlaying = true;
    
    // Start recording on armed lanes in Write or Latch mode
    for (const [laneId, lane] of this.lanes) {
      if (lane.armed && this.isGlobalRecordEnabled) {
        if (lane.mode === AutomationRecordMode.Write) {
          this.startRecording(laneId);
        }
      }
    }
  }

  /**
   * Stop playback (called by transport)
   */
  stopPlayback(): void {
    this.isPlaying = false;
    
    // Stop all recording
    for (const laneId of this.lanes.keys()) {
      this.stopRecording(laneId);
    }
  }

  /**
   * Update current time (called by transport)
   */
  setCurrentTime(time: number): void {
    this.currentTime = time;
  }

  /**
   * Record a parameter touch (mouse down on control)
   */
  touchParameter(laneId: string): void {
    const lane = this.lanes.get(laneId);
    const state = this.recordingStates.get(laneId);
    
    if (!lane || !state) return;
    
    state.isTouched = true;
    
    if (lane.armed && this.isGlobalRecordEnabled && this.isPlaying) {
      if (lane.mode === AutomationRecordMode.Touch || lane.mode === AutomationRecordMode.Latch) {
        this.startRecording(laneId);
      }
    }
  }

  /**
   * Record a parameter release (mouse up on control)
   */
  releaseParameter(laneId: string): void {
    const lane = this.lanes.get(laneId);
    const state = this.recordingStates.get(laneId);
    
    if (!lane || !state) return;
    
    state.isTouched = false;
    
    // In Touch mode, stop recording on release
    if (lane.mode === AutomationRecordMode.Touch) {
      this.stopRecording(laneId);
    }
    // In Latch mode, continue recording until playback stops
  }

  /**
   * Record a parameter value change
   */
  recordValue(laneId: string, value: number): void {
    const lane = this.lanes.get(laneId);
    const state = this.recordingStates.get(laneId);
    
    if (!lane || !state) return;
    
    // Normalize value
    const normalizedValue = (value - lane.minValue) / (lane.maxValue - lane.minValue);
    const clampedValue = clamp(normalizedValue, 0, 1);
    
    // Check if we should record
    if (!state.isRecording) {
      // In Write mode with armed lane, start recording on value change
      if (lane.armed && this.isGlobalRecordEnabled && this.isPlaying && 
          lane.mode === AutomationRecordMode.Write) {
        this.startRecording(laneId);
      } else {
        return;
      }
    }
    
    // Check minimum interval
    const timeSinceLastPoint = this.currentTime - state.lastTime;
    if (timeSinceLastPoint < this.minPointInterval) {
      return;
    }
    
    // Check value threshold
    const valueDelta = Math.abs(clampedValue - state.lastValue);
    if (valueDelta < this.valueThreshold) {
      return;
    }
    
    // Create automation point
    const point: AutomationPoint = {
      time: this.currentTime,
      value: clampedValue,
      curve: 'linear',
    };
    
    // Add to pending points
    state.pendingPoints.push(point);
    state.lastValue = clampedValue;
    state.lastTime = this.currentTime;
    
    this.emitEvent({ type: 'pointAdded', laneId, data: { point } });
  }

  /**
   * Start recording on a lane
   */
  private startRecording(laneId: string): void {
    const state = this.recordingStates.get(laneId);
    if (!state || state.isRecording) return;
    
    state.isRecording = true;
    state.pendingPoints = [];
    state.lastTime = this.currentTime;
    
    this.emitEvent({ type: 'recordStart', laneId });
  }

  /**
   * Stop recording on a lane
   */
  private stopRecording(laneId: string): void {
    const lane = this.lanes.get(laneId);
    const state = this.recordingStates.get(laneId);
    
    if (!lane || !state || !state.isRecording) return;
    
    state.isRecording = false;
    
    // Process pending points
    if (state.pendingPoints.length > 0) {
      // Apply thinning if enabled
      let processedPoints = state.pendingPoints;
      if (this.thinningEnabled) {
        processedPoints = this.thinPoints(processedPoints);
      }
      
      // Merge with existing points
      this.mergePoints(lane, processedPoints);
      
      state.pendingPoints = [];
    }
    
    this.emitEvent({ type: 'recordStop', laneId });
  }

  /**
   * Thin automation points to reduce data
   */
  private thinPoints(points: AutomationPoint[]): AutomationPoint[] {
    if (points.length < 3) return points;
    
    const result: AutomationPoint[] = [points[0]];
    
    for (let i = 1; i < points.length - 1; i++) {
      const prev = result[result.length - 1];
      const curr = points[i];
      const next = points[i + 1];
      
      // Calculate expected value at current time using linear interpolation
      const t = (curr.time - prev.time) / (next.time - prev.time);
      const expectedValue = prev.value + t * (next.value - prev.value);
      
      // Keep point if it deviates significantly from expected
      if (Math.abs(curr.value - expectedValue) > this.thinningThreshold) {
        result.push(curr);
      }
    }
    
    // Always keep last point
    result.push(points[points.length - 1]);
    
    return result;
  }

  /**
   * Merge new points with existing lane points
   */
  private mergePoints(lane: AutomationLane, newPoints: AutomationPoint[]): void {
    if (newPoints.length === 0) return;
    
    const startTime = newPoints[0].time;
    const endTime = newPoints[newPoints.length - 1].time;
    
    // Remove existing points in the recorded range
    lane.points = lane.points.filter(p => p.time < startTime || p.time > endTime);
    
    // Add new points
    lane.points.push(...newPoints);
    
    // Sort by time
    lane.points.sort((a, b) => a.time - b.time);
  }

  /**
   * Get automation value at a specific time
   */
  getValueAtTime(laneId: string, time: number): number | undefined {
    const lane = this.lanes.get(laneId);
    if (!lane || lane.points.length === 0) return undefined;
    
    const points = lane.points;
    
    // Before first point
    if (time <= points[0].time) {
      return points[0].value * (lane.maxValue - lane.minValue) + lane.minValue;
    }
    
    // After last point
    if (time >= points[points.length - 1].time) {
      return points[points.length - 1].value * (lane.maxValue - lane.minValue) + lane.minValue;
    }
    
    // Find surrounding points
    let prevPoint = points[0];
    let nextPoint = points[1];
    
    for (let i = 1; i < points.length; i++) {
      if (points[i].time >= time) {
        prevPoint = points[i - 1];
        nextPoint = points[i];
        break;
      }
    }
    
    // Interpolate
    const t = (time - prevPoint.time) / (nextPoint.time - prevPoint.time);
    let value: number;
    
    switch (nextPoint.curve) {
      case 'step':
        value = prevPoint.value;
        break;
      case 'smooth':
        // Smooth step interpolation
        const smoothT = t * t * (3 - 2 * t);
        value = prevPoint.value + smoothT * (nextPoint.value - prevPoint.value);
        break;
      case 'exponential':
        // Exponential interpolation with tension
        const tension = nextPoint.tension || 0;
        let expT = t;
        if (Math.abs(tension) > 0.001) {
          // Map tension -1..1 to exponent 0.1..10
          const exponent = Math.pow(10, tension);
          expT = Math.pow(t, exponent);
        }
        value = prevPoint.value + expT * (nextPoint.value - prevPoint.value);
        break;
      case 'bezier':
        // Cubic Bezier-like interpolation with tension
        // Tension controls the "pull" towards the control point
        const bTension = (nextPoint.tension || 0) + 1; // 0..2
        // Simple ease-in-out if tension is 0
        // This is a simplified approximation
        const bezT = t * t * (3 - 2 * t); 
        // Adjust based on tension (simplified)
        const adjustedT = Math.pow(t, 1 / bTension);
        value = prevPoint.value + adjustedT * (nextPoint.value - prevPoint.value);
        break;
      case 'linear':
      default:
        value = prevPoint.value + t * (nextPoint.value - prevPoint.value);
    }
    
    // Denormalize
    return value * (lane.maxValue - lane.minValue) + lane.minValue;
  }

  /**
   * Clear all points from a lane
   */
  clearLane(laneId: string): void {
    const lane = this.lanes.get(laneId);
    if (lane) {
      lane.points = [];
    }
  }

  /**
   * Clear points in a time range
   */
  clearRange(laneId: string, startTime: number, endTime: number): void {
    const lane = this.lanes.get(laneId);
    if (lane) {
      lane.points = lane.points.filter(p => p.time < startTime || p.time > endTime);
    }
  }

  /**
   * Add a point manually
   */
  addPoint(
    laneId: string,
    time: number,
    value: number,
    curve: 'linear' | 'smooth' | 'step' | 'exponential' | 'bezier' = 'linear'
  ): void {
    const lane = this.lanes.get(laneId);
    if (!lane) return;
    
    // Normalize value
    const normalizedValue = (value - lane.minValue) / (lane.maxValue - lane.minValue);
    const clampedValue = clamp(normalizedValue, 0, 1);
    
    // Remove existing point at same time
    lane.points = lane.points.filter(p => Math.abs(p.time - time) > 0.001);
    
    // Add new point
    lane.points.push({ time, value: clampedValue, curve });
    
    // Sort by time
    lane.points.sort((a, b) => a.time - b.time);
  }

  /**
   * Remove a point
   */
  removePoint(laneId: string, time: number): void {
    const lane = this.lanes.get(laneId);
    if (lane) {
      lane.points = lane.points.filter(p => Math.abs(p.time - time) > 0.001);
    }
  }

  /**
   * Move a point
   */
  movePoint(laneId: string, oldTime: number, newTime: number, newValue?: number): void {
    const lane = this.lanes.get(laneId);
    if (!lane) return;
    
    const point = lane.points.find(p => Math.abs(p.time - oldTime) < 0.001);
    if (point) {
      point.time = newTime;
      if (newValue !== undefined) {
        const normalizedValue = (newValue - lane.minValue) / (lane.maxValue - lane.minValue);
        point.value = clamp(normalizedValue, 0, 1);
      }
      
      // Re-sort
      lane.points.sort((a, b) => a.time - b.time);
    }
  }

  /**
   * Set recording settings
   */
  setSettings(settings: {
    minPointInterval?: number;
    valueThreshold?: number;
    smoothingEnabled?: boolean;
    thinningEnabled?: boolean;
    thinningThreshold?: number;
  }): void {
    if (settings.minPointInterval !== undefined) {
      this.minPointInterval = settings.minPointInterval;
    }
    if (settings.valueThreshold !== undefined) {
      this.valueThreshold = settings.valueThreshold;
    }
    if (settings.smoothingEnabled !== undefined) {
      this.smoothingEnabled = settings.smoothingEnabled;
    }
    if (settings.thinningEnabled !== undefined) {
      this.thinningEnabled = settings.thinningEnabled;
    }
    if (settings.thinningThreshold !== undefined) {
      this.thinningThreshold = settings.thinningThreshold;
    }
  }

  /**
   * Register event callback
   */
  onEvent(callback: AutomationRecorderCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index !== -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Emit event to callbacks
   */
  private emitEvent(event: AutomationRecorderEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in automation recorder callback:', error);
      }
    }
  }

  /**
   * Export lane data
   */
  exportLane(laneId: string): AutomationLane | undefined {
    return this.lanes.get(laneId);
  }

  /**
   * Import lane data
   */
  importLane(lane: AutomationLane): void {
    this.lanes.set(lane.id, lane);
    
    // Initialize recording state
    this.recordingStates.set(lane.id, {
      isRecording: false,
      isTouched: false,
      lastValue: 0,
      lastTime: 0,
      pendingPoints: [],
    });
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.lanes.clear();
    this.recordingStates.clear();
    this.callbacks = [];
  }
}

// Singleton instance
let automationRecorderInstance: AutomationRecorder | null = null;

/**
 * Get the automation recorder instance
 */
export function getAutomationRecorder(): AutomationRecorder {
  if (!automationRecorderInstance) {
    automationRecorderInstance = new AutomationRecorder();
  }
  return automationRecorderInstance;
}