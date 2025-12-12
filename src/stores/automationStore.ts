// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Automation Store - Zustand store for automation data management
 * 
 * Features:
 * - Store automation data per track/parameter
 * - Automation curves (linear, smooth, step)
 * - Automation lanes management
 * - Read/write/touch/latch modes
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
  AutomationRecorder, 
  AutomationRecordMode, 
  AutomationLane, 
  AutomationPoint,
  getAutomationRecorder 
} from '../audio/AutomationRecorder';

/**
 * Automation curve types
 */
export type AutomationCurveType = 'linear' | 'smooth' | 'step' | 'exponential' | 'bezier';

/**
 * Automation lane UI state
 */
export interface AutomationLaneState {
  id: string;
  trackId: string;
  parameterId: string;
  parameterName: string;
  points: AutomationPoint[];
  armed: boolean;
  mode: AutomationRecordMode;
  minValue: number;
  maxValue: number;
  visible: boolean;
  color: string;
  height: number;
  collapsed: boolean;
}

/**
 * Automation store state
 */
interface AutomationState {
  // Lanes
  lanes: Record<string, AutomationLaneState>;
  
  // Global state
  globalRecordEnabled: boolean;
  selectedLaneId: string | null;
  selectedPointIndex: number | null;
  
  // Recording state
  isRecording: boolean;
  recordingLanes: string[];
  
  // Default settings
  defaultCurveType: AutomationCurveType;
  snapToGrid: boolean;
  gridSize: number; // In beats
  
  // Actions
  createLane: (trackId: string, parameterId: string, parameterName: string, minValue?: number, maxValue?: number) => string;
  deleteLane: (laneId: string) => void;
  getLane: (laneId: string) => AutomationLaneState | undefined;
  getLanesForTrack: (trackId: string) => AutomationLaneState[];
  
  // Lane settings
  setLaneArmed: (laneId: string, armed: boolean) => void;
  setLaneMode: (laneId: string, mode: AutomationRecordMode) => void;
  setLaneVisible: (laneId: string, visible: boolean) => void;
  setLaneColor: (laneId: string, color: string) => void;
  setLaneHeight: (laneId: string, height: number) => void;
  setLaneCollapsed: (laneId: string, collapsed: boolean) => void;
  
  // Point management
  addPoint: (laneId: string, time: number, value: number, curve?: AutomationCurveType) => void;
  removePoint: (laneId: string, pointIndex: number) => void;
  movePoint: (laneId: string, pointIndex: number, time: number, value: number) => void;
  setPointCurve: (laneId: string, pointIndex: number, curve: AutomationCurveType) => void;
  clearLane: (laneId: string) => void;
  clearRange: (laneId: string, startTime: number, endTime: number) => void;
  
  // Selection
  selectLane: (laneId: string | null) => void;
  selectPoint: (laneId: string, pointIndex: number | null) => void;
  
  // Global settings
  setGlobalRecordEnabled: (enabled: boolean) => void;
  setDefaultCurveType: (curveType: AutomationCurveType) => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridSize: (size: number) => void;
  
  // Recording
  startRecording: () => void;
  stopRecording: () => void;
  recordValue: (laneId: string, value: number) => void;
  touchParameter: (laneId: string) => void;
  releaseParameter: (laneId: string) => void;
  
  // Playback
  getValueAtTime: (laneId: string, time: number) => number | undefined;
  
  // Sync with recorder
  syncFromRecorder: () => void;
  syncToRecorder: () => void;
  
  // Import/Export
  exportLanes: () => AutomationLaneState[];
  importLanes: (lanes: AutomationLaneState[]) => void;
}

// Color palette for automation lanes
const LANE_COLORS = [
  '#f97316', // Orange
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#eab308', // Yellow
  '#ef4444', // Red
];

let colorIndex = 0;
const getNextColor = () => {
  const color = LANE_COLORS[colorIndex % LANE_COLORS.length];
  colorIndex++;
  return color;
};

/**
 * Automation store
 */
export const useAutomationStore = create<AutomationState>()(
  subscribeWithSelector((set, get) => {
    // Get recorder instance
    const recorder = getAutomationRecorder();
    
    return {
      // Initial state
      lanes: {},
      globalRecordEnabled: false,
      selectedLaneId: null,
      selectedPointIndex: null,
      isRecording: false,
      recordingLanes: [],
      defaultCurveType: 'linear',
      snapToGrid: true,
      gridSize: 0.25, // Quarter note
      
      // Create a new automation lane
      createLane: (trackId, parameterId, parameterName, minValue = 0, maxValue = 1) => {
        const id = `${trackId}:${parameterId}`;
        
        // Create in recorder
        recorder.createLane(trackId, parameterId, parameterName, minValue, maxValue);
        
        // Create in store
        const lane: AutomationLaneState = {
          id,
          trackId,
          parameterId,
          parameterName,
          points: [],
          armed: false,
          mode: AutomationRecordMode.Read,
          minValue,
          maxValue,
          visible: true,
          color: getNextColor(),
          height: 80,
          collapsed: false,
        };
        
        set(state => ({
          lanes: { ...state.lanes, [id]: lane }
        }));
        
        return id;
      },
      
      // Delete a lane
      deleteLane: (laneId) => {
        recorder.deleteLane(laneId);
        
        set(state => {
          const { [laneId]: _, ...rest } = state.lanes;
          return {
            lanes: rest,
            selectedLaneId: state.selectedLaneId === laneId ? null : state.selectedLaneId,
          };
        });
      },
      
      // Get a lane
      getLane: (laneId) => {
        return get().lanes[laneId];
      },
      
      // Get lanes for a track
      getLanesForTrack: (trackId) => {
        return Object.values(get().lanes).filter(lane => lane.trackId === trackId);
      },
      
      // Set lane armed state
      setLaneArmed: (laneId, armed) => {
        recorder.setArmed(laneId, armed);
        
        set(state => ({
          lanes: {
            ...state.lanes,
            [laneId]: { ...state.lanes[laneId], armed }
          }
        }));
      },
      
      // Set lane mode
      setLaneMode: (laneId, mode) => {
        recorder.setMode(laneId, mode);
        
        set(state => ({
          lanes: {
            ...state.lanes,
            [laneId]: { ...state.lanes[laneId], mode }
          }
        }));
      },
      
      // Set lane visibility
      setLaneVisible: (laneId, visible) => {
        set(state => ({
          lanes: {
            ...state.lanes,
            [laneId]: { ...state.lanes[laneId], visible }
          }
        }));
      },
      
      // Set lane color
      setLaneColor: (laneId, color) => {
        set(state => ({
          lanes: {
            ...state.lanes,
            [laneId]: { ...state.lanes[laneId], color }
          }
        }));
      },
      
      // Set lane height
      setLaneHeight: (laneId, height) => {
        set(state => ({
          lanes: {
            ...state.lanes,
            [laneId]: { ...state.lanes[laneId], height }
          }
        }));
      },
      
      // Set lane collapsed
      setLaneCollapsed: (laneId, collapsed) => {
        set(state => ({
          lanes: {
            ...state.lanes,
            [laneId]: { ...state.lanes[laneId], collapsed }
          }
        }));
      },
      
      // Add a point
      addPoint: (laneId, time, value, curve) => {
        const state = get();
        const lane = state.lanes[laneId];
        if (!lane) return;
        
        // Snap to grid if enabled
        let snappedTime = time;
        if (state.snapToGrid) {
          snappedTime = Math.round(time / state.gridSize) * state.gridSize;
        }
        
        recorder.addPoint(laneId, snappedTime, value, curve || state.defaultCurveType);
        
        // Sync from recorder
        get().syncFromRecorder();
      },
      
      // Remove a point
      removePoint: (laneId, pointIndex) => {
        const lane = get().lanes[laneId];
        if (!lane || pointIndex < 0 || pointIndex >= lane.points.length) return;
        
        const point = lane.points[pointIndex];
        recorder.removePoint(laneId, point.time);
        
        // Sync from recorder
        get().syncFromRecorder();
      },
      
      // Move a point
      movePoint: (laneId, pointIndex, time, value) => {
        const state = get();
        const lane = state.lanes[laneId];
        if (!lane || pointIndex < 0 || pointIndex >= lane.points.length) return;
        
        const point = lane.points[pointIndex];
        
        // Snap to grid if enabled
        let snappedTime = time;
        if (state.snapToGrid) {
          snappedTime = Math.round(time / state.gridSize) * state.gridSize;
        }
        
        recorder.movePoint(laneId, point.time, snappedTime, value);
        
        // Sync from recorder
        get().syncFromRecorder();
      },
      
      // Set point curve type
      setPointCurve: (laneId, pointIndex, curve) => {
        const lane = get().lanes[laneId];
        if (!lane || pointIndex < 0 || pointIndex >= lane.points.length) return;
        
        set(state => {
          const newPoints = [...state.lanes[laneId].points];
          newPoints[pointIndex] = { ...newPoints[pointIndex], curve };
          
          return {
            lanes: {
              ...state.lanes,
              [laneId]: { ...state.lanes[laneId], points: newPoints }
            }
          };
        });
      },
      
      // Clear all points from a lane
      clearLane: (laneId) => {
        recorder.clearLane(laneId);
        
        set(state => ({
          lanes: {
            ...state.lanes,
            [laneId]: { ...state.lanes[laneId], points: [] }
          }
        }));
      },
      
      // Clear points in a range
      clearRange: (laneId, startTime, endTime) => {
        recorder.clearRange(laneId, startTime, endTime);
        
        // Sync from recorder
        get().syncFromRecorder();
      },
      
      // Select a lane
      selectLane: (laneId) => {
        set({ selectedLaneId: laneId, selectedPointIndex: null });
      },
      
      // Select a point
      selectPoint: (laneId, pointIndex) => {
        set({ selectedLaneId: laneId, selectedPointIndex: pointIndex });
      },
      
      // Set global record enabled
      setGlobalRecordEnabled: (enabled) => {
        recorder.setGlobalRecordEnabled(enabled);
        set({ globalRecordEnabled: enabled });
      },
      
      // Set default curve type
      setDefaultCurveType: (curveType) => {
        set({ defaultCurveType: curveType });
      },
      
      // Set snap to grid
      setSnapToGrid: (snap) => {
        set({ snapToGrid: snap });
      },
      
      // Set grid size
      setGridSize: (size) => {
        set({ gridSize: size });
      },
      
      // Start recording
      startRecording: () => {
        recorder.startPlayback();
        
        const armedLanes = Object.values(get().lanes)
          .filter(lane => lane.armed)
          .map(lane => lane.id);
        
        set({ isRecording: true, recordingLanes: armedLanes });
      },
      
      // Stop recording
      stopRecording: () => {
        recorder.stopPlayback();
        
        // Sync from recorder to get recorded points
        get().syncFromRecorder();
        
        set({ isRecording: false, recordingLanes: [] });
      },
      
      // Record a value
      recordValue: (laneId, value) => {
        recorder.recordValue(laneId, value);
      },
      
      // Touch parameter (start potential recording)
      touchParameter: (laneId) => {
        recorder.touchParameter(laneId);
      },
      
      // Release parameter (end touch recording)
      releaseParameter: (laneId) => {
        recorder.releaseParameter(laneId);
        
        // Sync from recorder
        get().syncFromRecorder();
      },
      
      // Get value at time
      getValueAtTime: (laneId, time) => {
        return recorder.getValueAtTime(laneId, time);
      },
      
      // Sync state from recorder
      syncFromRecorder: () => {
        const allLanes = recorder.getAllLanes();
        
        set(state => {
          const updatedLanes = { ...state.lanes };
          
          for (const recorderLane of allLanes) {
            if (updatedLanes[recorderLane.id]) {
              updatedLanes[recorderLane.id] = {
                ...updatedLanes[recorderLane.id],
                points: [...recorderLane.points],
                armed: recorderLane.armed,
                mode: recorderLane.mode,
              };
            }
          }
          
          return { lanes: updatedLanes };
        });
      },
      
      // Sync state to recorder
      syncToRecorder: () => {
        const lanes = get().lanes;
        
        for (const lane of Object.values(lanes)) {
          const recorderLane = recorder.getLane(lane.id);
          
          if (!recorderLane) {
            // Create lane in recorder
            recorder.createLane(lane.trackId, lane.parameterId, lane.parameterName, lane.minValue, lane.maxValue);
          }
          
          // Update armed and mode
          recorder.setArmed(lane.id, lane.armed);
          recorder.setMode(lane.id, lane.mode);
          
          // Import points
          const importLane: AutomationLane = {
            id: lane.id,
            trackId: lane.trackId,
            parameterId: lane.parameterId,
            parameterName: lane.parameterName,
            points: lane.points,
            armed: lane.armed,
            mode: lane.mode,
            minValue: lane.minValue,
            maxValue: lane.maxValue,
          };
          recorder.importLane(importLane);
        }
      },
      
      // Export all lanes
      exportLanes: () => {
        return Object.values(get().lanes);
      },
      
      // Import lanes
      importLanes: (lanes) => {
        const lanesRecord: Record<string, AutomationLaneState> = {};
        
        for (const lane of lanes) {
          lanesRecord[lane.id] = lane;
          
          // Import to recorder
          const recorderLane: AutomationLane = {
            id: lane.id,
            trackId: lane.trackId,
            parameterId: lane.parameterId,
            parameterName: lane.parameterName,
            points: lane.points,
            armed: lane.armed,
            mode: lane.mode,
            minValue: lane.minValue,
            maxValue: lane.maxValue,
          };
          recorder.importLane(recorderLane);
        }
        
        set({ lanes: lanesRecord });
      },
    };
  })
);

// Subscribe to recorder events
const recorder = getAutomationRecorder();
recorder.onEvent((event) => {
  const store = useAutomationStore.getState();
  
  switch (event.type) {
    case 'pointAdded':
      store.syncFromRecorder();
      break;
    case 'recordStart':
      useAutomationStore.setState(state => ({
        recordingLanes: [...state.recordingLanes, event.laneId]
      }));
      break;
    case 'recordStop':
      store.syncFromRecorder();
      useAutomationStore.setState(state => ({
        recordingLanes: state.recordingLanes.filter(id => id !== event.laneId)
      }));
      break;
  }
});

export default useAutomationStore;