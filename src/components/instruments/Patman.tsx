// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Patman - GUS Patch Player UI
 * Interface for loading and playing GUS/PAT patch files
 */

import React, { useState, useCallback, useRef } from 'react';
import { Knob } from '../ui/Knob';
import type { Patman as PatmanInstrument } from '../../audio/instruments/Patman';

// ============================================================================
// Types
// ============================================================================

interface PatmanProps {
  instrument: PatmanInstrument;
  onParameterChange?: (key: string, value: number) => void;
}

interface SampleInfo {
  name: string;
  rootKey: number;
  loopMode: string;
}

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    backgroundColor: '#2d2d3a',
    borderRadius: '8px',
    padding: '20px',
    fontFamily: '"Segoe UI", Arial, sans-serif',
    color: '#e0e0e0',
    minWidth: '500px',
    border: '2px solid #4a4a6a',
  } as React.CSSProperties,
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    borderBottom: '2px solid #4a4a6a',
    paddingBottom: '10px',
  } as React.CSSProperties,
  
  title: {
    fontSize: '24px',
    color: '#7b68ee',
    margin: 0,
    fontWeight: 'bold',
  } as React.CSSProperties,
  
  subtitle: {
    fontSize: '11px',
    color: '#888',
    marginTop: '4px',
  } as React.CSSProperties,
  
  loadSection: {
    backgroundColor: '#1a1a2a',
    borderRadius: '6px',
    padding: '15px',
    marginBottom: '20px',
    border: '1px dashed #4a4a6a',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  
  loadButton: {
    backgroundColor: '#7b68ee',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '10px 20px',
    fontSize: '14px',
    cursor: 'pointer',
    marginRight: '10px',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,
  
  loadButtonHover: {
    backgroundColor: '#6a5acd',
  } as React.CSSProperties,
  
  patchInfo: {
    backgroundColor: '#1a1a2a',
    borderRadius: '6px',
    padding: '15px',
    marginBottom: '20px',
  } as React.CSSProperties,
  
  patchName: {
    fontSize: '16px',
    color: '#7b68ee',
    marginBottom: '10px',
  } as React.CSSProperties,
  
  sampleList: {
    maxHeight: '200px',
    overflowY: 'auto' as const,
    backgroundColor: '#0a0a1a',
    borderRadius: '4px',
    padding: '10px',
  } as React.CSSProperties,
  
  sampleItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px',
    borderBottom: '1px solid #2a2a3a',
    fontSize: '12px',
  } as React.CSSProperties,
  
  sampleName: {
    color: '#e0e0e0',
  } as React.CSSProperties,
  
  sampleInfo: {
    color: '#888',
    fontSize: '10px',
  } as React.CSSProperties,
  
  controlsSection: {
    backgroundColor: '#1a1a2a',
    borderRadius: '6px',
    padding: '15px',
  } as React.CSSProperties,
  
  sectionTitle: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  } as React.CSSProperties,
  
  row: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
  } as React.CSSProperties,
  
  knobGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '6px',
  } as React.CSSProperties,
  
  knobLabel: {
    fontSize: '10px',
    color: '#888',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  
  dropZone: {
    border: '2px dashed #4a4a6a',
    borderRadius: '8px',
    padding: '30px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  
  dropZoneActive: {
    borderColor: '#7b68ee',
    backgroundColor: 'rgba(123, 104, 238, 0.1)',
  } as React.CSSProperties,
  
  dropText: {
    color: '#888',
    fontSize: '14px',
    marginBottom: '10px',
  } as React.CSSProperties,
  
  noteDisplay: {
    display: 'inline-block',
    backgroundColor: '#2a2a3a',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    color: '#7b68ee',
  } as React.CSSProperties,
  
  loopBadge: {
    display: 'inline-block',
    backgroundColor: '#3a3a4a',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '9px',
    marginLeft: '5px',
  } as React.CSSProperties,
  
  emptyState: {
    textAlign: 'center' as const,
    padding: '40px',
    color: '#666',
  } as React.CSSProperties,
  
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '10px',
  } as React.CSSProperties,
};

// ============================================================================
// Helper Functions
// ============================================================================

const midiNoteToName = (note: number): string => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(note / 12) - 1;
  const noteName = noteNames[note % 12];
  return `${noteName}${octave}`;
};

// ============================================================================
// Main Component
// ============================================================================

export const PatmanUI: React.FC<PatmanProps> = ({ instrument, onParameterChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [patchInfo, setPatchInfo] = useState<{ name: string; sampleCount: number } | null>(
    instrument.getPatchInfo()
  );
  const [samples, setSamples] = useState<SampleInfo[]>(instrument.getSamples());
  const [tuning, setTuning] = useState(instrument.getParameter('tuning'));
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    try {
      const data = await file.arrayBuffer();
      const success = await instrument.loadPatch(data);
      
      if (success) {
        setPatchInfo(instrument.getPatchInfo());
        setSamples(instrument.getSamples());
      } else {
        alert('Échec du chargement du fichier patch. Vérifiez que le fichier est un GUS/PAT valide ou un fichier audio valide.');
      }
    } catch (error) {
      console.error('Error loading patch:', error);
      alert('Erreur lors du chargement du fichier patch.');
    }
    setIsLoading(false);
  }, [instrument]);
  
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  const handleTuningChange = useCallback((value: number) => {
    instrument.setParameter('tuning', value);
    setTuning(value);
    onParameterChange?.('tuning', value);
  }, [instrument, onParameterChange]);
  
  const handleLoadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  
  return (
    <div style={styles.container}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pat,.PAT,.wav,.mp3,.ogg,.flac"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />
      
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Patman</h1>
          <div style={styles.subtitle}>LECTEUR DE PATCH GUS</div>
        </div>
      </div>
      
      {/* Load Section */}
      <div
        style={{
          ...styles.loadSection,
          ...styles.dropZone,
          ...(isDragging ? styles.dropZoneActive : {}),
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleLoadClick}
      >
        {isLoading ? (
          <div style={styles.dropText}>Chargement...</div>
        ) : (
          <>
            <div style={styles.dropText}>
              Déposez un fichier PAT ici ou cliquez pour parcourir
            </div>
            <button style={styles.loadButton}>
              Charger un patch
            </button>
          </>
        )}
      </div>
      
      {/* Patch Info */}
      {patchInfo ? (
        <div style={styles.patchInfo}>
          <div style={styles.patchName}>
            📁 {patchInfo.name}
          </div>
          <div style={styles.sectionTitle}>
            ÉCHANTILLONS ({patchInfo.sampleCount})
          </div>
          <div style={styles.sampleList}>
            {samples.map((sample, idx) => (
              <div key={idx} style={styles.sampleItem}>
                <span style={styles.sampleName}>{sample.name}</span>
                <div>
                  <span style={styles.noteDisplay}>
                    {midiNoteToName(sample.rootKey)}
                  </span>
                  {sample.loopMode !== 'none' && (
                    <span style={styles.loopBadge}>
                      {sample.loopMode === 'forward' ? '🔁' : '🔄'} {sample.loopMode}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🎹</div>
          <div>Aucun patch chargé</div>
          <div style={{ fontSize: '12px', marginTop: '5px' }}>
            Chargez un fichier GUS/PAT ou un échantillon audio pour commencer
          </div>
        </div>
      )}
      
      {/* Controls */}
      <div style={styles.controlsSection}>
        <div style={styles.sectionTitle}>CONTRÔLES</div>
        <div style={styles.row}>
          <div style={styles.knobGroup}>
            <Knob
              value={tuning}
              min={-100}
              max={100}
              onChange={handleTuningChange}
              size={50}
              color="#7b68ee"
            />
            <span style={styles.knobLabel}>ACCORDAGE</span>
            <span style={{ ...styles.knobLabel, color: '#7b68ee' }}>
              {tuning > 0 ? '+' : ''}{Math.round(tuning)} cents
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatmanUI;