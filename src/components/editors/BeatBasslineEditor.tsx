// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * BeatBasslineEditor - Step sequencer for beat and bassline patterns
 * 
 * Based on original AnkhWaveStudio BB Editor:
 * - Multiple instrument tracks
 * - Step sequencer grid (16/32/64 steps)
 * - Per-step velocity
 * - Per-step note (for melodic instruments)
 * - Pattern management (add, clone, delete)
 * - Pattern length control
 * - Swing control
 * - Triplet mode
 */

import React, { memo, useCallback, useRef, useEffect, useState } from 'react';
import { useSongStore } from '../../stores';

interface BBStep {
  active: boolean;
  velocity: number;
  note: number;
  length: number;
}

interface BBTrack {
  id: string;
  name: string;
  instrumentId: string;
  color: string;
  muted: boolean;
  solo: boolean;
  steps: BBStep[];
}

interface BBPattern {
  id: string;
  name: string;
  tracks: BBTrack[];
  length: number; // Number of steps
  swing: number; // 0-100
  triplet: boolean;
}

interface BeatBasslineEditorProps {
  patternId?: string;
  onPatternChange?: (pattern: BBPattern) => void;
}

// Default step
const createDefaultStep = (): BBStep => ({
  active: false,
  velocity: 100,
  note: 60, // Middle C
  length: 1,
});

// Default track
const createDefaultTrack = (id: string, name: string, instrumentId: string, steps: number): BBTrack => ({
  id,
  name,
  instrumentId,
  color: `hsl(${Math.random() * 360}, 70%, 50%)`,
  muted: false,
  solo: false,
  steps: Array(steps).fill(null).map(() => createDefaultStep()),
});

// Default pattern
const createDefaultPattern = (id: string, name: string): BBPattern => ({
  id,
  name,
  tracks: [],
  length: 16,
  swing: 0,
  triplet: false,
});

/**
 * Step button component
 */
const StepButton: React.FC<{
  step: BBStep;
  index: number;
  isCurrentStep: boolean;
  trackColor: string;
  onToggle: () => void;
  onVelocityChange: (velocity: number) => void;
  onRightClick: (e: React.MouseEvent) => void;
}> = memo(({ step, index, isCurrentStep, trackColor, onToggle, onVelocityChange, onRightClick }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startVelocity = useRef(0);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      e.preventDefault();
      onRightClick(e);
      return;
    }
    
    if (e.button === 0) {
      if (e.shiftKey && step.active) {
        // Start velocity drag
        setIsDragging(true);
        startY.current = e.clientY;
        startVelocity.current = step.velocity;
        
        const handleMouseMove = (e: MouseEvent) => {
          const delta = startY.current - e.clientY;
          const newVelocity = Math.max(1, Math.min(127, startVelocity.current + delta));
          onVelocityChange(newVelocity);
        };
        
        const handleMouseUp = () => {
          setIsDragging(false);
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      } else {
        onToggle();
      }
    }
  }, [step, onToggle, onVelocityChange, onRightClick]);
  
  // Determine background color based on beat position
  const getBeatColor = () => {
    if (index % 4 === 0) return '#2a2a4e'; // Beat 1
    if (index % 2 === 0) return '#252540'; // Beat 2, 4
    return '#1e1e38'; // Off-beat
  };
  
  return (
    <div
      className="step-button"
      style={{
        width: '24px',
        height: '24px',
        backgroundColor: step.active ? trackColor : getBeatColor(),
        border: isCurrentStep ? '2px solid #fff' : '1px solid #333',
        borderRadius: '2px',
        cursor: 'pointer',
        position: 'relative',
        opacity: step.active ? (step.velocity / 127) * 0.5 + 0.5 : 1,
        transition: 'opacity 0.1s, background-color 0.1s',
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
      title={step.active ? `Vélocité : ${step.velocity}` : 'Cliquez pour ajouter un pas'}
    >
      {/* Velocity indicator */}
      {step.active && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${(step.velocity / 127) * 100}%`,
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
});

StepButton.displayName = 'StepButton';

/**
 * Track row component
 */
const TrackRow: React.FC<{
  track: BBTrack;
  currentStep: number;
  onStepToggle: (stepIndex: number) => void;
  onStepVelocityChange: (stepIndex: number, velocity: number) => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
  onNameChange: (name: string) => void;
  onDelete: () => void;
}> = memo(({ 
  track, 
  currentStep, 
  onStepToggle, 
  onStepVelocityChange, 
  onMuteToggle, 
  onSoloToggle,
  onNameChange,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(track.name);
  
  const handleNameSubmit = useCallback(() => {
    onNameChange(editName);
    setIsEditing(false);
  }, [editName, onNameChange]);
  
  return (
    <div
      className="track-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 0',
        borderBottom: '1px solid #333',
        opacity: track.muted ? 0.5 : 1,
      }}
    >
      {/* Track controls */}
      <div style={{
        width: '120px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexShrink: 0,
      }}>
        {/* Color indicator */}
        <div
          style={{
            width: '8px',
            height: '24px',
            backgroundColor: track.color,
            borderRadius: '2px',
          }}
        />
        
        {/* Track name */}
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
            autoFocus
            style={{
              flex: 1,
              backgroundColor: '#333',
              border: '1px solid #555',
              borderRadius: '2px',
              color: '#fff',
              fontSize: '11px',
              padding: '2px 4px',
            }}
          />
        ) : (
          <span
            style={{
              flex: 1,
              fontSize: '11px',
              color: '#ccc',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
            onDoubleClick={() => setIsEditing(true)}
          >
            {track.name}
          </span>
        )}
        
        {/* Mute button */}
        <button
          onClick={onMuteToggle}
          style={{
            width: '20px',
            height: '20px',
            fontSize: '10px',
            backgroundColor: track.muted ? '#f44336' : '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
          }}
          title="Muet"
        >
          M
        </button>
        
        {/* Solo button */}
        <button
          onClick={onSoloToggle}
          style={{
            width: '20px',
            height: '20px',
            fontSize: '10px',
            backgroundColor: track.solo ? '#FFC107' : '#333',
            color: track.solo ? '#000' : '#fff',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
          }}
          title="Solo"
        >
          S
        </button>
      </div>
      
      {/* Steps */}
      <div style={{
        display: 'flex',
        gap: '2px',
        flex: 1,
        overflowX: 'auto',
      }}>
        {track.steps.map((step, index) => (
          <StepButton
            key={index}
            step={step}
            index={index}
            isCurrentStep={index === currentStep}
            trackColor={track.color}
            onToggle={() => onStepToggle(index)}
            onVelocityChange={(velocity) => onStepVelocityChange(index, velocity)}
            onRightClick={() => {}}
          />
        ))}
      </div>
      
      {/* Delete button */}
      <button
        onClick={onDelete}
        style={{
          width: '20px',
          height: '20px',
          fontSize: '12px',
          backgroundColor: 'transparent',
          color: '#666',
          border: 'none',
          cursor: 'pointer',
        }}
        title="Supprimer la piste"
      >
        ×
      </button>
    </div>
  );
});

TrackRow.displayName = 'TrackRow';

/**
 * Main BeatBasslineEditor component
 */
export const BeatBasslineEditor: React.FC<BeatBasslineEditorProps> = memo(({ 
  patternId, 
  onPatternChange 
}) => {
  const [pattern, setPattern] = useState<BBPattern>(() => 
    createDefaultPattern('bb-1', 'Beat/Bassline 1')
  );
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [selectedLength, setSelectedLength] = useState(16);
  
  const playIntervalRef = useRef<number | null>(null);
  
  // Update pattern length
  const handleLengthChange = useCallback((newLength: number) => {
    setSelectedLength(newLength);
    setPattern(prev => ({
      ...prev,
      length: newLength,
      tracks: prev.tracks.map(track => ({
        ...track,
        steps: Array(newLength).fill(null).map((_, i) => 
          track.steps[i] || createDefaultStep()
        ),
      })),
    }));
  }, []);
  
  // Add new track
  const handleAddTrack = useCallback(() => {
    const trackId = `track-${Date.now()}`;
    const newTrack = createDefaultTrack(
      trackId,
      `Track ${pattern.tracks.length + 1}`,
      'default',
      pattern.length
    );
    
    setPattern(prev => ({
      ...prev,
      tracks: [...prev.tracks, newTrack],
    }));
  }, [pattern.length, pattern.tracks.length]);
  
  // Delete track
  const handleDeleteTrack = useCallback((trackId: string) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.filter(t => t.id !== trackId),
    }));
  }, []);
  
  // Toggle step
  const handleStepToggle = useCallback((trackId: string, stepIndex: number) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => {
        if (track.id !== trackId) return track;
        return {
          ...track,
          steps: track.steps.map((step, i) => {
            if (i !== stepIndex) return step;
            return { ...step, active: !step.active };
          }),
        };
      }),
    }));
  }, []);
  
  // Change step velocity
  const handleStepVelocityChange = useCallback((trackId: string, stepIndex: number, velocity: number) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => {
        if (track.id !== trackId) return track;
        return {
          ...track,
          steps: track.steps.map((step, i) => {
            if (i !== stepIndex) return step;
            return { ...step, velocity };
          }),
        };
      }),
    }));
  }, []);
  
  // Toggle mute
  const handleMuteToggle = useCallback((trackId: string) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => {
        if (track.id !== trackId) return track;
        return { ...track, muted: !track.muted };
      }),
    }));
  }, []);
  
  // Toggle solo
  const handleSoloToggle = useCallback((trackId: string) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => {
        if (track.id !== trackId) return track;
        return { ...track, solo: !track.solo };
      }),
    }));
  }, []);
  
  // Change track name
  const handleTrackNameChange = useCallback((trackId: string, name: string) => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => {
        if (track.id !== trackId) return track;
        return { ...track, name };
      }),
    }));
  }, []);
  
  // Change swing
  const handleSwingChange = useCallback((swing: number) => {
    setPattern(prev => ({ ...prev, swing }));
  }, []);
  
  // Toggle triplet mode
  const handleTripletToggle = useCallback(() => {
    setPattern(prev => ({ ...prev, triplet: !prev.triplet }));
  }, []);
  
  // Play/Stop
  const handlePlayStop = useCallback(() => {
    if (isPlaying) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      setCurrentStep(-1);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      setCurrentStep(0);
      
      const stepDuration = (60 / bpm / 4) * 1000; // 16th note duration
      
      playIntervalRef.current = window.setInterval(() => {
        setCurrentStep(prev => (prev + 1) % pattern.length);
      }, stepDuration);
    }
  }, [isPlaying, bpm, pattern.length]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, []);
  
  // Notify parent of pattern changes
  useEffect(() => {
    onPatternChange?.(pattern);
  }, [pattern, onPatternChange]);
  
  // Clear pattern
  const handleClearPattern = useCallback(() => {
    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => ({
        ...track,
        steps: track.steps.map(() => createDefaultStep()),
      })),
    }));
  }, []);
  
  // Clone pattern
  const handleClonePattern = useCallback(() => {
    const newPattern = {
      ...pattern,
      id: `bb-${Date.now()}`,
      name: `${pattern.name} (Copie)`,
    };
    setPattern(newPattern);
  }, [pattern]);
  
  return (
    <div className="beat-bassline-editor" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#1a1a2e',
      color: '#fff',
      fontFamily: 'sans-serif',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px',
        borderBottom: '1px solid #333',
        flexWrap: 'wrap',
      }}>
        {/* Play/Stop */}
        <button
          onClick={handlePlayStop}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: isPlaying ? '#f44336' : '#4CAF50',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {isPlaying ? '⏹ Arrêt' : '▶ Lecture'}
        </button>
        
        {/* BPM */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#888' }}>BPM :</span>
          <input
            type="number"
            value={bpm}
            onChange={(e) => setBpm(Math.max(20, Math.min(300, parseInt(e.target.value) || 120)))}
            style={{
              width: '50px',
              backgroundColor: '#333',
              border: '1px solid #555',
              borderRadius: '2px',
              color: '#fff',
              fontSize: '11px',
              padding: '4px',
              textAlign: 'center',
            }}
          />
        </div>
        
        {/* Pattern length */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#888' }}>Pas :</span>
          <select
            value={selectedLength}
            onChange={(e) => handleLengthChange(parseInt(e.target.value))}
            style={{
              backgroundColor: '#333',
              border: '1px solid #555',
              borderRadius: '2px',
              color: '#fff',
              fontSize: '11px',
              padding: '4px',
            }}
          >
            <option value={8}>8</option>
            <option value={16}>16</option>
            <option value={32}>32</option>
            <option value={64}>64</option>
          </select>
        </div>
        
        {/* Swing */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#888' }}>Swing :</span>
          <input
            type="range"
            min="0"
            max="100"
            value={pattern.swing}
            onChange={(e) => handleSwingChange(parseInt(e.target.value))}
            style={{ width: '60px' }}
          />
          <span style={{ fontSize: '10px', color: '#666', width: '30px' }}>
            {pattern.swing}%
          </span>
        </div>
        
        {/* Triplet toggle */}
        <button
          onClick={handleTripletToggle}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: pattern.triplet ? '#2196F3' : '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Triolet
        </button>
        
        <div style={{ flex: 1 }} />
        
        {/* Pattern actions */}
        <button
          onClick={handleAddTrack}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: '#4CAF50',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          + Ajouter une piste
        </button>
        
        <button
          onClick={handleClearPattern}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Effacer
        </button>
        
        <button
          onClick={handleClonePattern}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Cloner
        </button>
      </div>
      
      {/* Step numbers header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 0',
        borderBottom: '1px solid #333',
      }}>
        <div style={{ width: '120px', flexShrink: 0 }} />
        <div style={{
          display: 'flex',
          gap: '2px',
          flex: 1,
          overflowX: 'auto',
          paddingLeft: '4px',
        }}>
          {Array(pattern.length).fill(null).map((_, i) => (
            <div
              key={i}
              style={{
                width: '24px',
                textAlign: 'center',
                fontSize: '9px',
                color: i % 4 === 0 ? '#888' : '#555',
                fontWeight: i % 4 === 0 ? 'bold' : 'normal',
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <div style={{ width: '20px' }} />
      </div>
      
      {/* Tracks */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '4px',
      }}>
        {pattern.tracks.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px',
            color: '#666',
          }}>
            <p style={{ fontSize: '14px', marginBottom: '16px' }}>
              Aucune piste pour l'instant. Ajoutez une piste pour commencer à créer des beats !
            </p>
            <button
              onClick={handleAddTrack}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: '#4CAF50',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              + Ajouter une piste
            </button>
          </div>
        ) : (
          pattern.tracks.map(track => (
            <TrackRow
              key={track.id}
              track={track}
              currentStep={currentStep}
              onStepToggle={(stepIndex) => handleStepToggle(track.id, stepIndex)}
              onStepVelocityChange={(stepIndex, velocity) => 
                handleStepVelocityChange(track.id, stepIndex, velocity)
              }
              onMuteToggle={() => handleMuteToggle(track.id)}
              onSoloToggle={() => handleSoloToggle(track.id)}
              onNameChange={(name) => handleTrackNameChange(track.id, name)}
              onDelete={() => handleDeleteTrack(track.id)}
            />
          ))
        )}
      </div>
      
      {/* Status bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 8px',
        borderTop: '1px solid #333',
        fontSize: '10px',
        color: '#666',
      }}>
        <span>Pattern : {pattern.name}</span>
        <span>{pattern.tracks.length} pistes | {pattern.length} pas</span>
        <span>Maj+Clic pour ajuster la vélocité</span>
      </div>
    </div>
  );
});

BeatBasslineEditor.displayName = 'BeatBasslineEditor';

export default BeatBasslineEditor;