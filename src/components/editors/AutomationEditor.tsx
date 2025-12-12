// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * AutomationEditor - Automation lanes editor component
 * Features: Point-based automation curves, curve types, drawing tools, recording
 */

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Button } from '../common';
import { AutomationRecordMode } from '../../audio/AutomationRecorder';

export interface AutomationPoint {
  id: string;
  tick: number;
  value: number;
  curveType: 'linear' | 'smooth' | 'step';
}

export interface AutomationLane {
  id: string;
  parameterId: string;
  parameterName: string;
  trackId?: string;
  points: AutomationPoint[];
  min: number;
  max: number;
  defaultValue: number;
  color: string;
  armed?: boolean;
  mode?: AutomationRecordMode;
}

export interface AutomationEditorProps {
  /** Automation lanes to display */
  lanes?: AutomationLane[];
  /** Currently selected lane ID */
  selectedLaneId?: string;
  /** Zoom level */
  zoom?: number;
  /** Scroll offset in ticks */
  scrollOffset?: number;
  /** Ticks per beat */
  ticksPerBeat?: number;
  /** Beats per bar */
  beatsPerBar?: number;
  /** Total length in ticks */
  totalLength?: number;
  /** Point change callback */
  onPointChange?: (laneId: string, pointId: string, value: number, tick: number) => void;
  /** Point add callback */
  onPointAdd?: (laneId: string, tick: number, value: number) => void;
  /** Point delete callback */
  onPointDelete?: (laneId: string, pointId: string) => void;
  /** Lane select callback */
  onLaneSelect?: (laneId: string) => void;
  /** Recording state */
  isRecording?: boolean;
  /** Global record enabled */
  globalRecordEnabled?: boolean;
  /** Recording lanes */
  recordingLanes?: string[];
  /** Set lane armed callback */
  onSetLaneArmed?: (laneId: string, armed: boolean) => void;
  /** Set lane mode callback */
  onSetLaneMode?: (laneId: string, mode: AutomationRecordMode) => void;
  /** Set global record enabled callback */
  onSetGlobalRecordEnabled?: (enabled: boolean) => void;
  /** Clear lane callback */
  onClearLane?: (laneId: string) => void;
  /** Thin automation callback */
  onThinAutomation?: (laneId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

type DrawTool = 'select' | 'draw' | 'line' | 'erase';

const GRID_SUBDIVISIONS = [1, 2, 4, 8, 16];

export const AutomationEditor = memo<AutomationEditorProps>(({
  lanes = [],
  selectedLaneId,
  zoom = 1,
  scrollOffset = 0,
  ticksPerBeat = 480,
  beatsPerBar = 4,
  totalLength = 7680,
  onPointChange,
  onPointAdd,
  onPointDelete,
  onLaneSelect,
  isRecording = false,
  globalRecordEnabled = false,
  recordingLanes = [],
  onSetLaneArmed,
  onSetLaneMode,
  onSetGlobalRecordEnabled,
  onClearLane,
  onThinAutomation,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTool, setActiveTool] = useState<DrawTool>('draw');
  const [gridSnap, setGridSnap] = useState(true);
  const [gridSubdivision, setGridSubdivision] = useState(4);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const selectedLane = lanes.find(l => l.id === selectedLaneId);
  const ticksPerBar = ticksPerBeat * beatsPerBar;
  const pixelsPerTick = (zoom * 100) / ticksPerBeat;

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Snap tick to grid
  const snapToGrid = useCallback((tick: number): number => {
    if (!gridSnap) return tick;
    const snapInterval = ticksPerBeat / gridSubdivision;
    return Math.round(tick / snapInterval) * snapInterval;
  }, [gridSnap, gridSubdivision, ticksPerBeat]);

  // Convert tick to X position
  const tickToX = useCallback((tick: number): number => {
    return (tick - scrollOffset) * pixelsPerTick;
  }, [scrollOffset, pixelsPerTick]);

  // Convert X position to tick
  const xToTick = useCallback((x: number): number => {
    return scrollOffset + x / pixelsPerTick;
  }, [scrollOffset, pixelsPerTick]);

  // Convert value to Y position
  const valueToY = useCallback((value: number, lane: AutomationLane, height: number): number => {
    const normalized = (value - lane.min) / (lane.max - lane.min);
    return height - normalized * height;
  }, []);

  // Convert Y position to value
  const yToValue = useCallback((y: number, lane: AutomationLane, height: number): number => {
    const normalized = 1 - y / height;
    return lane.min + normalized * (lane.max - lane.min);
  }, []);

  // Draw automation curve
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedLane) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    // Vertical grid lines (beats/bars)
    const startTick = Math.floor(scrollOffset / ticksPerBar) * ticksPerBar;
    for (let tick = startTick; tick < scrollOffset + width / pixelsPerTick; tick += ticksPerBeat / gridSubdivision) {
      const x = tickToX(tick);
      if (x < 0 || x > width) continue;

      const isBar = tick % ticksPerBar === 0;
      const isBeat = tick % ticksPerBeat === 0;

      ctx.strokeStyle = isBar 
        ? 'rgba(255, 255, 255, 0.3)' 
        : isBeat 
          ? 'rgba(255, 255, 255, 0.15)' 
          : 'rgba(255, 255, 255, 0.05)';
      
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid lines (value)
    const valueSteps = 10;
    for (let i = 0; i <= valueSteps; i++) {
      const y = (i / valueSteps) * height;
      ctx.strokeStyle = i === valueSteps / 2 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw automation curve
    const points = selectedLane.points.sort((a, b) => a.tick - b.tick);
    
    if (points.length > 0) {
      ctx.strokeStyle = selectedLane.color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      // Draw from start to first point
      const firstPoint = points[0];
      const firstX = tickToX(firstPoint.tick);
      const firstY = valueToY(firstPoint.value, selectedLane, height);
      
      ctx.moveTo(0, valueToY(selectedLane.defaultValue, selectedLane, height));
      ctx.lineTo(firstX, valueToY(selectedLane.defaultValue, selectedLane, height));

      // Draw between points
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const x = tickToX(point.tick);
        const y = valueToY(point.value, selectedLane, height);

        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          const prevPoint = points[i - 1];
          const prevX = tickToX(prevPoint.tick);
          const prevY = valueToY(prevPoint.value, selectedLane, height);

          switch (prevPoint.curveType) {
            case 'step':
              ctx.lineTo(x, prevY);
              ctx.lineTo(x, y);
              break;
            case 'smooth':
              const cpX = (prevX + x) / 2;
              ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
              break;
            case 'linear':
            default:
              ctx.lineTo(x, y);
              break;
          }
        }
      }

      // Draw from last point to end
      const lastPoint = points[points.length - 1];
      ctx.lineTo(width, valueToY(lastPoint.value, selectedLane, height));

      ctx.stroke();

      // Fill area under curve
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = selectedLane.color + '20';
      ctx.fill();

      // Draw points
      points.forEach(point => {
        const x = tickToX(point.tick);
        const y = valueToY(point.value, selectedLane, height);
        const isSelected = point.id === selectedPointId;

        ctx.beginPath();
        ctx.arc(x, y, isSelected ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#ffffff' : selectedLane.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();
      });
    }

  }, [selectedLane, containerSize, zoom, scrollOffset, gridSubdivision, selectedPointId, tickToX, valueToY, pixelsPerTick, ticksPerBar, ticksPerBeat]);

  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedLane || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const tick = snapToGrid(xToTick(x));
    const value = yToValue(y, selectedLane, rect.height);

    // Check if clicking on existing point
    const clickedPoint = selectedLane.points.find(point => {
      const px = tickToX(point.tick);
      const py = valueToY(point.value, selectedLane, rect.height);
      return Math.abs(px - x) < 10 && Math.abs(py - y) < 10;
    });

    if (clickedPoint) {
      if (activeTool === 'erase') {
        onPointDelete?.(selectedLane.id, clickedPoint.id);
      } else {
        setSelectedPointId(clickedPoint.id);
      }
    } else if (activeTool === 'draw') {
      onPointAdd?.(selectedLane.id, tick, Math.max(selectedLane.min, Math.min(selectedLane.max, value)));
    }
  }, [selectedLane, activeTool, snapToGrid, xToTick, yToValue, tickToX, valueToY, onPointAdd, onPointDelete]);

  // Handle mouse down for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedLane || !canvasRef.current || activeTool !== 'select') return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedPoint = selectedLane.points.find(point => {
      const px = tickToX(point.tick);
      const py = valueToY(point.value, selectedLane, rect.height);
      return Math.abs(px - x) < 10 && Math.abs(py - y) < 10;
    });

    if (clickedPoint) {
      setSelectedPointId(clickedPoint.id);
      setIsDragging(true);
    }
  }, [selectedLane, activeTool, tickToX, valueToY]);

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedLane || !selectedPointId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const tick = snapToGrid(xToTick(x));
    const value = Math.max(selectedLane.min, Math.min(selectedLane.max, yToValue(y, selectedLane, rect.height)));

    onPointChange?.(selectedLane.id, selectedPointId, value, tick);
  }, [isDragging, selectedLane, selectedPointId, snapToGrid, xToTick, yToValue, onPointChange]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className={`flex flex-col h-full bg-daw-bg-primary ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-daw-border bg-daw-bg-secondary">
        {/* Recording controls */}
        <div className="flex items-center gap-1 border-r border-daw-border pr-2">
          {/* Global record enable */}
          <Button
            variant={globalRecordEnabled ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onSetGlobalRecordEnabled?.(!globalRecordEnabled)}
            title="Activer l'enregistrement"
            className={globalRecordEnabled ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            <svg className="w-4 h-4" fill={globalRecordEnabled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="6" strokeWidth={2} />
            </svg>
          </Button>
          
          {/* Recording indicator */}
          {isRecording && recordingLanes && recordingLanes.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-red-600/20 rounded">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-red-400">REC</span>
            </div>
          )}
        </div>
        
        {/* Tool selection */}
        <div className="flex items-center gap-1 border-r border-daw-border pr-2">
          <Button
            variant={activeTool === 'select' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTool('select')}
            title="Outil de sélection (V)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'draw' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTool('draw')}
            title="Outil de dessin (D)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'line' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTool('line')}
            title="Outil ligne (L)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20l16-16" />
            </svg>
          </Button>
          <Button
            variant={activeTool === 'erase' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTool('erase')}
            title="Outil gomme (E)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        </div>

        {/* Grid snap */}
        <div className="flex items-center gap-2 border-r border-daw-border pr-2">
          <Button
            variant={gridSnap ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setGridSnap(!gridSnap)}
            title="Activer/Désactiver l'alignement sur la grille"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </Button>
          <select
            value={gridSubdivision}
            onChange={(e) => setGridSubdivision(Number(e.target.value))}
            className="bg-daw-bg-primary border border-daw-border rounded px-2 py-1 text-xs text-daw-text-primary"
          >
            {GRID_SUBDIVISIONS.map(sub => (
              <option key={sub} value={sub}>1/{sub}</option>
            ))}
          </select>
        </div>

        {/* Parameter selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-daw-text-muted">Paramètre :</span>
          <select
            value={selectedLaneId || ''}
            onChange={(e) => onLaneSelect?.(e.target.value)}
            className="bg-daw-bg-primary border border-daw-border rounded px-2 py-1 text-sm text-daw-text-primary min-w-[150px]"
          >
            <option value="">Sélectionner un paramètre...</option>
            {lanes.map(lane => (
              <option key={lane.id} value={lane.id}>{lane.parameterName}</option>
            ))}
          </select>
        </div>

        <div className="flex-1" />
        
        {/* Lane actions */}
        {selectedLane && (
          <div className="flex items-center gap-2 border-l border-daw-border pl-2">
            {/* Arm for recording */}
            <Button
              variant={selectedLane.armed ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onSetLaneArmed?.(selectedLane.id, !selectedLane.armed)}
              title="Armer pour l'enregistrement"
              className={selectedLane.armed ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              <svg className="w-4 h-4" fill={selectedLane.armed ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4" strokeWidth={2} />
              </svg>
            </Button>
            
            {/* Recording mode selector */}
            <select
              value={selectedLane.mode || AutomationRecordMode.Read}
              onChange={(e) => onSetLaneMode?.(selectedLane.id, e.target.value as AutomationRecordMode)}
              className="bg-daw-bg-primary border border-daw-border rounded px-2 py-1 text-xs text-daw-text-primary"
              title="Mode d'enregistrement"
            >
              <option value={AutomationRecordMode.Read}>Lecture</option>
              <option value={AutomationRecordMode.Write}>Écriture</option>
              <option value={AutomationRecordMode.Touch}>Toucher</option>
              <option value={AutomationRecordMode.Latch}>Verrouillage</option>
            </select>
            
            {/* Clear automation */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onClearLane?.(selectedLane.id)}
              title="Effacer l'automation"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </Button>
            
            {/* Thin automation */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onThinAutomation?.(selectedLane.id)}
              title="Réduire l'automation (diminuer les points)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
              </svg>
            </Button>
          </div>
        )}

        {/* Info */}
        {selectedLane && (
          <span className="text-xs text-daw-text-muted ml-2">
            {selectedLane.points.length} point{selectedLane.points.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {selectedLane ? (
          <canvas
            ref={canvasRef}
            width={containerSize.width * (window.devicePixelRatio || 1)}
            height={containerSize.height * (window.devicePixelRatio || 1)}
            style={{ width: '100%', height: '100%' }}
            className="cursor-crosshair"
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-daw-text-muted">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 18h2V6H7v12zm4 4h2V2h-2v20zm-8-8h2v-4H3v4zm12 4h2V6h-2v12zm4-8v4h2v-4h-2z" />
              </svg>
              <p className="text-sm">Sélectionnez un paramètre pour éditer l'automation</p>
            </div>
          </div>
        )}
      </div>

      {/* Value display */}
      {selectedLane && (
        <div className="flex items-center justify-between px-2 py-1 border-t border-daw-border bg-daw-bg-secondary text-xs">
          <span className="text-daw-text-muted">
            Plage : {selectedLane.min} - {selectedLane.max}
          </span>
          <span className="text-daw-text-muted">
            Défaut : {selectedLane.defaultValue}
          </span>
        </div>
      )}
    </div>
  );
});

AutomationEditor.displayName = 'AutomationEditor';

export default AutomationEditor;