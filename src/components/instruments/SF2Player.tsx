// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * SF2Player - SoundFont 2 Player UI
 * Interface for loading and playing SoundFont files
 */

import React, { useState, useCallback, useRef } from 'react';
import { Knob } from '../ui/Knob';
import { Select } from '../ui/Select';
import type { SF2Player as SF2PlayerInstrument } from '../../audio/instruments/SF2Player';

// ============================================================================
// Types
// ============================================================================

interface SF2PlayerProps {
  instrument: SF2PlayerInstrument;
  onParameterChange?: (key: string, value: number) => void;
}

interface PresetInfo {
  bank: number;
  preset: number;
  name: string;
}

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    backgroundColor: '#1a2a3a',
    borderRadius: '8px',
    padding: '20px',
    fontFamily: '"Segoe UI", Arial, sans-serif',
    color: '#e0e0e0',
    minWidth: '550px',
    border: '2px solid #2a4a6a',
  } as React.CSSProperties,
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    borderBottom: '2px solid #2a4a6a',
    paddingBottom: '10px',
  } as React.CSSProperties,
  
  title: {
    fontSize: '24px',
    color: '#4a9eff',
    margin: 0,
    fontWeight: 'bold',
  } as React.CSSProperties,
  
  subtitle: {
    fontSize: '11px',
    color: '#888',
    marginTop: '4px',
  } as React.CSSProperties,
  
  loadSection: {
    backgroundColor: '#0a1a2a',
    borderRadius: '6px',
    padding: '15px',
    marginBottom: '20px',
    border: '1px dashed #2a4a6a',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  
  loadSectionActive: {
    borderColor: '#4a9eff',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
  } as React.CSSProperties,
  
  loadButton: {
    backgroundColor: '#4a9eff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '10px 20px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,
  
  sf2Info: {
    backgroundColor: '#0a1a2a',
    borderRadius: '6px',
    padding: '15px',
    marginBottom: '20px',
  } as React.CSSProperties,
  
  sf2Name: {
    fontSize: '16px',
    color: '#4a9eff',
    marginBottom: '10px',
  } as React.CSSProperties,
  
  presetSection: {
    marginBottom: '15px',
  } as React.CSSProperties,
  
  sectionTitle: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  } as React.CSSProperties,
  
  presetSelector: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  } as React.CSSProperties,
  
  effectsSection: {
    backgroundColor: '#0a1a2a',
    borderRadius: '6px',
    padding: '15px',
  } as React.CSSProperties,
  
  row: {
    display: 'flex',
    gap: '30px',
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
  
  dropText: {
    color: '#888',
    fontSize: '14px',
    marginBottom: '10px',
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
  
  stats: {
    display: 'flex',
    gap: '20px',
    marginTop: '10px',
  } as React.CSSProperties,
  
  stat: {
    backgroundColor: '#1a2a3a',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '12px',
  } as React.CSSProperties,
  
  statLabel: {
    color: '#888',
    marginRight: '5px',
  } as React.CSSProperties,
  
  statValue: {
    color: '#4a9eff',
    fontWeight: 'bold',
  } as React.CSSProperties,
  
  currentPreset: {
    backgroundColor: '#1a2a3a',
    padding: '10px 15px',
    borderRadius: '4px',
    marginTop: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as React.CSSProperties,
  
  presetName: {
    color: '#4a9eff',
    fontWeight: 'bold',
  } as React.CSSProperties,
  
  presetBank: {
    color: '#888',
    fontSize: '11px',
  } as React.CSSProperties,
};

// ============================================================================
// Main Component
// ============================================================================

export const SF2PlayerUI: React.FC<SF2PlayerProps> = ({ instrument, onParameterChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sf2Info, setSf2Info] = useState<{ name: string; presetCount: number; sampleCount: number } | null>(
    instrument.getSF2Info()
  );
  const [presets, setPresets] = useState<PresetInfo[]>(instrument.getPresetList());
  const [currentPreset, setCurrentPreset] = useState<PresetInfo | null>(instrument.getCurrentPreset());
  const [reverbAmount, setReverbAmount] = useState(instrument.getParameter('reverbAmount'));
  const [chorusAmount, setChorusAmount] = useState(instrument.getParameter('chorusAmount'));
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    try {
      const data = await file.arrayBuffer();
      const success = await instrument.loadSF2(data);
      
      if (success) {
        setSf2Info(instrument.getSF2Info());
        setPresets(instrument.getPresetList());
        setCurrentPreset(instrument.getCurrentPreset());
      } else {
        alert('Échec du chargement du fichier SoundFont. Vérifiez que le fichier SF2 est valide.');
      }
    } catch (error) {
      console.error('Error loading SF2:', error);
      alert('Erreur lors du chargement du fichier SoundFont.');
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
  
  const handlePresetChange = useCallback((value: string) => {
    const [bank, preset] = value.split(':').map(Number);
    if (instrument.selectPreset(bank, preset)) {
      setCurrentPreset(instrument.getCurrentPreset());
    }
  }, [instrument]);
  
  const handleReverbChange = useCallback((value: number) => {
    instrument.setParameter('reverbAmount', value);
    setReverbAmount(value);
    onParameterChange?.('reverbAmount', value);
  }, [instrument, onParameterChange]);
  
  const handleChorusChange = useCallback((value: number) => {
    instrument.setParameter('chorusAmount', value);
    setChorusAmount(value);
    onParameterChange?.('chorusAmount', value);
  }, [instrument, onParameterChange]);
  
  const handleLoadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  
  const presetOptions = presets.map((p) => ({
    value: `${p.bank}:${p.preset}`,
    label: `${p.bank}:${p.preset} - ${p.name}`,
  }));
  
  return (
    <div style={styles.container}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".sf2,.SF2"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />
      
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>SF2 Player</h1>
          <div style={styles.subtitle}>LECTEUR SOUNDFONT 2</div>
        </div>
      </div>
      
      {/* Load Section */}
      <div
        style={{
          ...styles.loadSection,
          ...(isDragging ? styles.loadSectionActive : {}),
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleLoadClick}
      >
        {isLoading ? (
          <div style={styles.dropText}>Chargement du SoundFont...</div>
        ) : (
          <>
            <div style={styles.dropText}>
              Déposez un fichier SF2 ici ou cliquez pour parcourir
            </div>
            <button style={styles.loadButton}>
              Charger un SoundFont
            </button>
          </>
        )}
      </div>
      
      {/* SF2 Info */}
      {sf2Info ? (
        <div style={styles.sf2Info}>
          <div style={styles.sf2Name}>
            🎹 {sf2Info.name}
          </div>
          
          <div style={styles.stats}>
            <div style={styles.stat}>
              <span style={styles.statLabel}>Préréglages :</span>
              <span style={styles.statValue}>{sf2Info.presetCount}</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statLabel}>Échantillons :</span>
              <span style={styles.statValue}>{sf2Info.sampleCount}</span>
            </div>
          </div>
          
          {/* Preset Selector */}
          <div style={styles.presetSection}>
            <div style={styles.sectionTitle}>SÉLECTIONNER UN PRÉRÉGLAGE</div>
            <div style={styles.presetSelector}>
              <Select
                value={currentPreset ? `${currentPreset.bank}:${currentPreset.preset}` : ''}
                onChange={handlePresetChange}
                options={presetOptions}
                style={{ flex: 1 }}
                placeholder="Sélectionner un préréglage..."
              />
            </div>
            
            {currentPreset && (
              <div style={styles.currentPreset}>
                <div>
                  <div style={styles.presetName}>{currentPreset.name}</div>
                  <div style={styles.presetBank}>
                    Banque {currentPreset.bank}, Programme {currentPreset.preset}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🎵</div>
          <div>Aucun SoundFont chargé</div>
          <div style={{ fontSize: '12px', marginTop: '5px' }}>
            Chargez un fichier SF2 pour commencer
          </div>
        </div>
      )}
      
      {/* Effects */}
      <div style={styles.effectsSection}>
        <div style={styles.sectionTitle}>EFFETS</div>
        <div style={styles.row}>
          <div style={styles.knobGroup}>
            <Knob
              value={reverbAmount}
              min={0}
              max={1}
              onChange={handleReverbChange}
              size={50}
              color="#4a9eff"
            />
            <span style={styles.knobLabel}>RÉVERB</span>
            <span style={{ ...styles.knobLabel, color: '#4a9eff' }}>
              {Math.round(reverbAmount * 100)}%
            </span>
          </div>
          <div style={styles.knobGroup}>
            <Knob
              value={chorusAmount}
              min={0}
              max={1}
              onChange={handleChorusChange}
              size={50}
              color="#9eff4a"
            />
            <span style={styles.knobLabel}>CHORUS</span>
            <span style={{ ...styles.knobLabel, color: '#9eff4a' }}>
              {Math.round(chorusAmount * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SF2PlayerUI;