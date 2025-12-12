// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * PatternEditor - Beat/step sequencer
 * Features: Step grid, multiple instrument rows, velocity per step,
 * swing control, pattern length adjustment, copy/paste patterns
 */

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Button, Knob, Slider } from '../common';

const DEFAULT_STEPS = 16;
const DEFAULT_ROWS = 8;

export interface StepData {
  active: boolean;
  velocity: number;
  pitch?: number;
}

export interface PatternRow {
  id: string;
  name: string;
  color: string;
  instrumentId?: string;
  steps: StepData[];
  muted: boolean;
  solo: boolean;
}

export interface Pattern {
  id: string;
  name: string;
  steps: number;
  rows: PatternRow[];
  swing: number;
  bpm?: number;
}

export interface PatternEditorProps {
  /** Pattern to edit */
  pattern?: Pattern;
  /** Pattern change callback */
  onPatternChange?: (pattern: Pattern) => void;
  /** Step trigger callback (for preview) */
  onStepTrigger?: (rowId: string, step: number, velocity: number) => void;
  /** Additional CSS classes */
  className?: string;
}

const DEFAULT_ROW_LABELS = ['Kick', 'Snare', 'HiHat', 'Clap', 'Tom', 'Perc 1', 'Perc 2', 'FX'];
const DEFAULT_ROW_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#8286ef', '#a855f7', '#ec4899', '#06b6d4', '#84cc16'];

const createDefaultPattern = (): Pattern => ({
  id: `pattern-${Date.now()}`,
  name: 'Pattern 1',
  steps: DEFAULT_STEPS,
  swing: 0,
  rows: DEFAULT_ROW_LABELS.map((name, i) => ({
    id: `row-${i}`,
    name,
    color: DEFAULT_ROW_COLORS[i],
    steps: Array(DEFAULT_STEPS).fill(null).map(() => ({ active: false, velocity: 100 })),
    muted: false,
    solo: false,
  })),
});

export const PatternEditor = memo<PatternEditorProps>(({
  pattern: externalPattern,
  onPatternChange,
  onStepTrigger,
  className = '',
}) => {
  const [pattern, setPattern] = useState<Pattern>(externalPattern || createDefaultPattern());
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [editingVelocity, setEditingVelocity] = useState<{ rowId: string; step: number } | null>(null);
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVelocity, setShowVelocity] = useState(false);
  const [copyBuffer, setCopyBuffer] = useState<StepData[] | null>(null);
  
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const patternRef = useRef<Pattern>(pattern);
  const onStepTriggerRef = useRef(onStepTrigger);
  
  // Keep refs updated
  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);
  
  useEffect(() => {
    onStepTriggerRef.current = onStepTrigger;
  }, [onStepTrigger]);

  // Sync with external pattern
  useEffect(() => {
    if (externalPattern) {
      setPattern(externalPattern);
    }
  }, [externalPattern]);

  // Update external pattern
  const updatePattern = useCallback((updates: Partial<Pattern>) => {
    const newPattern = { ...pattern, ...updates };
    setPattern(newPattern);
    onPatternChange?.(newPattern);
  }, [pattern, onPatternChange]);

  // Toggle step
  const toggleStep = useCallback((rowId: string, step: number) => {
    const newRows = pattern.rows.map(row => {
      if (row.id !== rowId) return row;
      const newSteps = [...row.steps];
      newSteps[step] = {
        ...newSteps[step],
        active: !newSteps[step].active,
      };
      return { ...row, steps: newSteps };
    });
    updatePattern({ rows: newRows });
    
    // Trigger preview sound
    const row = pattern.rows.find(r => r.id === rowId);
    if (row && !row.steps[step].active) {
      onStepTrigger?.(rowId, step, row.steps[step].velocity);
    }
  }, [pattern, updatePattern, onStepTrigger]);

  // Set step velocity
  const setStepVelocity = useCallback((rowId: string, step: number, velocity: number) => {
    const newRows = pattern.rows.map(row => {
      if (row.id !== rowId) return row;
      const newSteps = [...row.steps];
      newSteps[step] = {
        ...newSteps[step],
        velocity: Math.max(1, Math.min(127, velocity)),
      };
      return { ...row, steps: newSteps };
    });
    updatePattern({ rows: newRows });
  }, [pattern, updatePattern]);

  // Toggle row mute
  const toggleRowMute = useCallback((rowId: string) => {
    const newRows = pattern.rows.map(row => 
      row.id === rowId ? { ...row, muted: !row.muted } : row
    );
    updatePattern({ rows: newRows });
  }, [pattern, updatePattern]);

  // Toggle row solo
  const toggleRowSolo = useCallback((rowId: string) => {
    const newRows = pattern.rows.map(row => 
      row.id === rowId ? { ...row, solo: !row.solo } : row
    );
    updatePattern({ rows: newRows });
  }, [pattern, updatePattern]);

  // Clear pattern
  const clearPattern = useCallback(() => {
    const newRows = pattern.rows.map(row => ({
      ...row,
      steps: row.steps.map(() => ({ active: false, velocity: 100 })),
    }));
    updatePattern({ rows: newRows });
  }, [pattern, updatePattern]);

  // Clear row
  const clearRow = useCallback((rowId: string) => {
    const newRows = pattern.rows.map(row => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        steps: row.steps.map(() => ({ active: false, velocity: 100 })),
      };
    });
    updatePattern({ rows: newRows });
  }, [pattern, updatePattern]);

  // Copy row
  const copyRow = useCallback((rowId: string) => {
    const row = pattern.rows.find(r => r.id === rowId);
    if (row) {
      setCopyBuffer([...row.steps]);
    }
  }, [pattern]);

  // Paste to row
  const pasteToRow = useCallback((rowId: string) => {
    if (!copyBuffer) return;
    
    const newRows = pattern.rows.map(row => {
      if (row.id !== rowId) return row;
      const newSteps = copyBuffer.slice(0, row.steps.length);
      while (newSteps.length < row.steps.length) {
        newSteps.push({ active: false, velocity: 100 });
      }
      return { ...row, steps: newSteps };
    });
    updatePattern({ rows: newRows });
  }, [pattern, copyBuffer, updatePattern]);

  // Change pattern length
  const setPatternLength = useCallback((steps: number) => {
    const newRows = pattern.rows.map(row => {
      const newSteps = [...row.steps];
      while (newSteps.length < steps) {
        newSteps.push({ active: false, velocity: 100 });
      }
      return { ...row, steps: newSteps.slice(0, steps) };
    });
    updatePattern({ steps, rows: newRows });
  }, [pattern, updatePattern]);

  // Play/stop pattern preview
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      setIsPlaying(false);
      setCurrentStep(-1);
    } else {
      setIsPlaying(true);
      setCurrentStep(0);
      
      const bpm = patternRef.current.bpm || 120;
      const stepDuration = (60 / bpm / 4) * 1000; // 16th notes
      
      playIntervalRef.current = setInterval(() => {
        setCurrentStep(prev => {
          const currentPattern = patternRef.current;
          const next = (prev + 1) % currentPattern.steps;
          
          // Trigger sounds for active steps
          currentPattern.rows.forEach(row => {
            if (!row.muted && row.steps[next]?.active) {
              const hasSolo = currentPattern.rows.some(r => r.solo);
              if (!hasSolo || row.solo) {
                onStepTriggerRef.current?.(row.id, next, row.steps[next].velocity);
              }
            }
          });
          
          return next;
        });
      }, stepDuration);
    }
  }, [isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, []);

  // Randomize row
  const randomizeRow = useCallback((rowId: string, density: number = 0.3) => {
    const newRows = pattern.rows.map(row => {
      if (row.id !== rowId) return row;
      const newSteps = row.steps.map(() => ({
        active: Math.random() < density,
        velocity: Math.floor(Math.random() * 64) + 64,
      }));
      return { ...row, steps: newSteps };
    });
    updatePattern({ rows: newRows });
  }, [pattern, updatePattern]);

  // Shift row left/right
  const shiftRow = useCallback((rowId: string, direction: 'left' | 'right') => {
    const newRows = pattern.rows.map(row => {
      if (row.id !== rowId) return row;
      const newSteps = [...row.steps];
      if (direction === 'left') {
        const first = newSteps.shift()!;
        newSteps.push(first);
      } else {
        const last = newSteps.pop()!;
        newSteps.unshift(last);
      }
      return { ...row, steps: newSteps };
    });
    updatePattern({ rows: newRows });
  }, [pattern, updatePattern]);

  return (
    <div className={`flex flex-col h-full bg-daw-bg-primary ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-daw-border bg-daw-bg-secondary">
        {/* Pattern selector */}
        <input
          type="text"
          value={pattern.name}
          onChange={(e) => updatePattern({ name: e.target.value })}
          className="bg-daw-bg-primary border border-daw-border rounded px-2 py-1 text-sm text-daw-text-primary w-32"
        />
        
        <div className="h-4 w-px bg-daw-border mx-1" />
        
        {/* Transport */}
        <Button
          variant={isPlaying ? 'danger' : 'primary'}
          size="sm"
          onClick={togglePlay}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </Button>
        
        <div className="h-4 w-px bg-daw-border mx-1" />
        
        {/* Pattern length */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-daw-text-muted">Pas :</span>
          <select
            value={pattern.steps}
            onChange={(e) => setPatternLength(Number(e.target.value))}
            className="bg-daw-bg-primary border border-daw-border rounded px-2 py-1 text-sm text-daw-text-primary"
          >
            <option value={8}>8</option>
            <option value={16}>16</option>
            <option value={32}>32</option>
            <option value={64}>64</option>
          </select>
        </div>
        
        {/* Swing */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-daw-text-muted">Swing :</span>
          <input
            type="range"
            min="0"
            max="100"
            value={pattern.swing}
            onChange={(e) => updatePattern({ swing: Number(e.target.value) })}
            className="w-20 h-1 bg-daw-bg-surface rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-daw-text-muted w-8">{pattern.swing}%</span>
        </div>
        
        <div className="flex-1" />
        
        {/* Actions */}
        <Button size="sm" variant="ghost" onClick={() => setShowVelocity(!showVelocity)}>
          {showVelocity ? 'Masquer vélocité' : 'Afficher vélocité'}
        </Button>
        <Button size="sm" variant="secondary" onClick={clearPattern}>
          Tout effacer
        </Button>
      </div>

      {/* Pattern grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="inline-block min-w-full">
          {/* Step numbers */}
          <div className="flex mb-2 sticky top-0 bg-daw-bg-primary z-10">
            <div className="w-32 flex-shrink-0" />
            {Array.from({ length: pattern.steps }).map((_, step) => (
              <div
                key={step}
                className={`w-8 h-6 flex items-center justify-center text-xxs transition-colors ${
                  step === currentStep
                    ? 'text-daw-accent-primary font-bold'
                    : step % 4 === 0
                      ? 'text-daw-text-secondary'
                      : 'text-daw-text-muted'
                }`}
              >
                {step + 1}
              </div>
            ))}
          </div>

          {/* Rows */}
          {pattern.rows.map((row) => {
            const hasSolo = pattern.rows.some(r => r.solo);
            const isActive = !row.muted && (!hasSolo || row.solo);
            
            return (
              <div key={row.id} className="mb-1">
                <div className="flex items-center">
                  {/* Row header */}
                  <div className="w-32 flex-shrink-0 pr-2 flex items-center gap-1">
                    <div
                      className="w-2 h-8 rounded-sm"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className={`text-xs flex-1 truncate ${isActive ? 'text-daw-text-secondary' : 'text-daw-text-muted'}`}>
                      {row.name}
                    </span>
                    <button
                      onClick={() => toggleRowMute(row.id)}
                      className={`px-1 py-0.5 text-xxs rounded ${
                        row.muted
                          ? 'bg-daw-accent-secondary text-white'
                          : 'bg-daw-bg-surface text-daw-text-muted hover:text-daw-text-secondary'
                      }`}
                      title="Muet"
                    >
                      M
                    </button>
                    <button
                      onClick={() => toggleRowSolo(row.id)}
                      className={`px-1 py-0.5 text-xxs rounded ${
                        row.solo
                          ? 'bg-daw-accent-warning text-black'
                          : 'bg-daw-bg-surface text-daw-text-muted hover:text-daw-text-secondary'
                      }`}
                      title="Solo"
                    >
                      S
                    </button>
                  </div>

                  {/* Steps */}
                  {row.steps.map((step, stepIndex) => (
                    <div key={stepIndex} className="relative">
                      <button
                        onClick={() => toggleStep(row.id, stepIndex)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setEditingVelocity({ rowId: row.id, step: stepIndex });
                        }}
                        className={`w-8 h-8 m-0.5 rounded transition-all ${
                          step.active
                            ? stepIndex === currentStep
                              ? 'shadow-glow-md'
                              : 'shadow-glow-sm'
                            : stepIndex % 4 === 0
                              ? 'bg-daw-bg-elevated hover:bg-daw-bg-surface'
                              : 'bg-daw-bg-surface hover:bg-daw-bg-elevated'
                        } ${stepIndex === currentStep ? 'ring-1 ring-daw-accent-primary' : ''}`}
                        style={{
                          backgroundColor: step.active ? row.color : undefined,
                          opacity: step.active ? 0.5 + (step.velocity / 127) * 0.5 : 1,
                        }}
                      />
                      
                      {/* Velocity indicator */}
                      {showVelocity && step.active && (
                        <div
                          className="absolute bottom-0 left-0.5 right-0.5 bg-white/30 rounded-b"
                          style={{ height: `${(step.velocity / 127) * 100}%`, maxHeight: '100%' }}
                        />
                      )}
                    </div>
                  ))}
                  
                  {/* Row actions */}
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => shiftRow(row.id, 'left')}
                      className="p-1 text-daw-text-muted hover:text-daw-text-secondary"
                      title="Décaler à gauche"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => shiftRow(row.id, 'right')}
                      className="p-1 text-daw-text-muted hover:text-daw-text-secondary"
                      title="Décaler à droite"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => randomizeRow(row.id)}
                      className="p-1 text-daw-text-muted hover:text-daw-text-secondary"
                      title="Aléatoire"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button
                      onClick={() => copyRow(row.id)}
                      className="p-1 text-daw-text-muted hover:text-daw-text-secondary"
                      title="Copier"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => pasteToRow(row.id)}
                      className={`p-1 ${copyBuffer ? 'text-daw-text-muted hover:text-daw-text-secondary' : 'text-daw-text-muted/30 cursor-not-allowed'}`}
                      title="Coller"
                      disabled={!copyBuffer}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </button>
                    <button
                      onClick={() => clearRow(row.id)}
                      className="p-1 text-daw-text-muted hover:text-daw-accent-danger"
                      title="Effacer la ligne"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Velocity editor modal */}
      {editingVelocity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-daw-bg-secondary rounded-lg p-4 shadow-xl">
            <h3 className="text-sm font-medium text-daw-text-primary mb-4">Modifier la vélocité</h3>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="127"
                value={pattern.rows.find(r => r.id === editingVelocity.rowId)?.steps[editingVelocity.step]?.velocity || 100}
                onChange={(e) => setStepVelocity(editingVelocity.rowId, editingVelocity.step, Number(e.target.value))}
                className="w-48"
              />
              <span className="text-sm text-daw-text-secondary w-12">
                {pattern.rows.find(r => r.id === editingVelocity.rowId)?.steps[editingVelocity.step]?.velocity || 100}
              </span>
            </div>
            <div className="flex justify-end mt-4">
              <Button size="sm" onClick={() => setEditingVelocity(null)}>
                Terminé
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

PatternEditor.displayName = 'PatternEditor';

export default PatternEditor;