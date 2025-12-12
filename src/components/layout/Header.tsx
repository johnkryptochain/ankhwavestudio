// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Header - AnkhWave main application header with transport controls, menus, and toolbar
 * Features: File/Edit/View menus, transport controls, tempo/time signature, CPU indicator
 * Includes: Undo/Redo buttons, Export dialog integration
 */

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Button } from '../common';
import { useTransportStore, useSongStore, useUIStore, useHistoryStore, useClipboardStore } from '../../stores';
import { copyClips, cutClips, copyTracks } from '../../stores/clipboardStore';
import { ThemeManager } from '../../utils/ThemeManager';
import { MidiExporter } from '../../audio/MidiExporter';

interface MenuItemData {
  id: string;
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  separator?: boolean;
  action?: () => void;
  submenu?: MenuItemData[];
}

interface DropdownMenuProps {
  label: string;
  items: MenuItemData[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ label, items, isOpen, onToggle, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div ref={menuRef} className="relative">
      <button
        className={`px-3 py-1 text-sm rounded transition-colors ${
          isOpen
            ? 'bg-daw-bg-surface text-daw-text-primary'
            : 'text-daw-text-secondary hover:text-daw-text-primary hover:bg-daw-bg-surface'
        }`}
        onClick={onToggle}
      >
        {label}
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-daw-bg-elevated border border-daw-border rounded-lg shadow-xl z-50 py-1">
          {items.map((item, index) => (
            item.separator ? (
              <div key={index} className="my-1 border-t border-daw-border" />
            ) : (
              <button
                key={item.id}
                className={`w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 ${
                  item.disabled
                    ? 'text-daw-text-muted cursor-not-allowed'
                    : 'text-daw-text-secondary hover:text-daw-text-primary hover:bg-daw-bg-surface'
                }`}
                onClick={() => {
                  if (!item.disabled && item.action) {
                    item.action();
                    onClose();
                  }
                }}
                disabled={item.disabled}
              >
                {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="text-xs text-daw-text-muted font-mono">{item.shortcut}</span>
                )}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
};

export const Header = memo(() => {
  const { isPlaying, isRecording, tempo, position, timeSignature, play, pause, stop, setTempo, startRecording, stopRecording, setLoopEnabled, loopEnabled } = useTransportStore();
  const { metadata, isDirty, newProject, settings, tracks, removeTrack, removeClipFromTrack, setMetadata } = useSongStore();
  const { toggleSidebar, sidebarOpen, toggleBottomPanel, bottomPanelOpen, setActiveEditor, openDialog, selection, clearSelection, setSelectedTracks, setSelectedClips } = useUIStore();
  const { undo, redo, undoStack, redoStack } = useHistoryStore();
  
  // Compute canUndo and canRedo from stack lengths
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const { hasData, data: clipboardData, isCut } = useClipboardStore();

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [cpuUsage, setCpuUsage] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  
  // Get last action names for tooltips
  const lastUndoAction = undoStack.length > 0 ? undoStack[undoStack.length - 1].description : null;
  const lastRedoAction = redoStack.length > 0 ? redoStack[redoStack.length - 1].description : null;

  // Simulate CPU monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage(Math.random() * 30 + (isPlaying ? 20 : 5));
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const handleRecord = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleTempoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTempo = parseInt(e.target.value, 10);
    if (!isNaN(newTempo) && newTempo >= 20 && newTempo <= 999) {
      setTempo(newTempo);
    }
  }, [setTempo]);

  const handleTempoWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    const newTempo = Math.max(20, Math.min(999, tempo + delta * (e.shiftKey ? 10 : 1)));
    setTempo(newTempo);
  }, [tempo, setTempo]);

  const startEditingName = useCallback(() => {
    setTempName(metadata.name);
    setIsEditingName(true);
  }, [metadata.name]);

  const saveName = useCallback(() => {
    if (tempName.trim()) {
      setMetadata({ name: tempName.trim() });
    }
    setIsEditingName(false);
  }, [tempName, setMetadata]);

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveName();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
    }
  }, [saveName]);

  // Format position as bars:beats:ticks
  const formatPosition = useCallback((ticks: number): string => {
    const ticksPerBeat = 480;
    const beatsPerBar = timeSignature.numerator;
    const ticksPerBar = ticksPerBeat * beatsPerBar;
    
    const bars = Math.floor(ticks / ticksPerBar) + 1;
    const remainingTicks = ticks % ticksPerBar;
    const beats = Math.floor(remainingTicks / ticksPerBeat) + 1;
    const subTicks = remainingTicks % ticksPerBeat;
    
    return `${bars}:${beats}:${subTicks.toString().padStart(3, '0')}`;
  }, [timeSignature.numerator]);

  const handleExportMidi = useCallback(() => {
    try {
      const song = useSongStore.getState();
      const blob = MidiExporter.export(song);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${song.metadata.name || 'project'}.mid`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export MIDI:', error);
      alert('Failed to export MIDI file');
    }
  }, []);

  // Menu definitions
  const fileMenuItems: MenuItemData[] = [
    { id: 'new', label: 'Nouveau projet', shortcut: 'Ctrl+N', action: newProject },
    { id: 'open', label: 'Ouvrir...', shortcut: 'Ctrl+O', action: () => openDialog('importDialog') },
    { id: 'sep1', label: '', separator: true },
    { id: 'save', label: 'Enregistrer', shortcut: 'Ctrl+S', action: () => openDialog('saveDialog') },
    { id: 'saveAs', label: 'Enregistrer sous...', shortcut: 'Ctrl+Shift+S', action: () => openDialog('saveDialog') },
    { id: 'sep2', label: '', separator: true },
    { id: 'export', label: 'Exporter l’audio...', shortcut: 'Ctrl+E', action: () => openDialog('exportDialog') },
    { id: 'exportMidi', label: 'Exporter le MIDI...', action: handleExportMidi },
    { id: 'sep3', label: '', separator: true },
    { id: 'settings', label: 'Paramètres du projet...', action: () => openDialog('projectSettings') },
  ];

  // Check if there's any selection
  const hasSelection = selection.selectedTrackIds.length > 0 ||
                       selection.selectedClipIds.length > 0 ||
                       selection.selectedNoteIds.length > 0;

  // Handle Cut
  const handleCut = useCallback(() => {
    if (selection.selectedClipIds.length > 0) {
      // Find clips from tracks
      const selectedClips: Array<{ clip: any; trackId: string }> = [];
      tracks.forEach(track => {
        track.clips.forEach(clip => {
          if (selection.selectedClipIds.includes(clip.id)) {
            selectedClips.push({ clip, trackId: track.id });
          }
        });
      });
      
      if (selectedClips.length > 0) {
        cutClips(selectedClips.map(c => c.clip), selectedClips[0].trackId);
        // Remove clips after cutting
        selectedClips.forEach(({ clip, trackId }) => {
          removeClipFromTrack(trackId, clip.id);
        });
        clearSelection();
        console.log('Cut', selectedClips.length, 'clips');
      }
    } else if (selection.selectedTrackIds.length > 0) {
      // Copy tracks (we don't actually remove them on cut for safety)
      const selectedTracks = tracks.filter(t => selection.selectedTrackIds.includes(t.id));
      copyTracks(selectedTracks);
      console.log('Cut', selectedTracks.length, 'tracks (copied to clipboard)');
    } else {
      console.log('Nothing selected to cut');
    }
  }, [selection, tracks, removeClipFromTrack, clearSelection]);

  // Handle Copy
  const handleCopy = useCallback(() => {
    if (selection.selectedClipIds.length > 0) {
      // Find clips from tracks
      const selectedClips: Array<{ clip: any; trackId: string }> = [];
      tracks.forEach(track => {
        track.clips.forEach(clip => {
          if (selection.selectedClipIds.includes(clip.id)) {
            selectedClips.push({ clip, trackId: track.id });
          }
        });
      });
      
      if (selectedClips.length > 0) {
        copyClips(selectedClips.map(c => c.clip), selectedClips[0].trackId);
        console.log('Copied', selectedClips.length, 'clips');
      }
    } else if (selection.selectedTrackIds.length > 0) {
      const selectedTracks = tracks.filter(t => selection.selectedTrackIds.includes(t.id));
      copyTracks(selectedTracks);
      console.log('Copied', selectedTracks.length, 'tracks');
    } else {
      console.log('Nothing selected to copy');
    }
  }, [selection, tracks]);

  // Handle Paste
  const handlePaste = useCallback(() => {
    if (!clipboardData) {
      console.log('Nothing to paste');
      return;
    }

    if (clipboardData.type === 'clips') {
      // For now, just log - actual paste would need to add clips to a track
      console.log('Paste clips:', clipboardData.clips.length, 'clips');
      // TODO: Add clips to selected track or first track
    } else if (clipboardData.type === 'tracks') {
      console.log('Paste tracks:', clipboardData.tracks.length, 'tracks');
      // TODO: Add tracks to project
    } else if (clipboardData.type === 'notes') {
      console.log('Paste notes:', clipboardData.notes.length, 'notes');
      // TODO: Add notes to piano roll
    }
  }, [clipboardData]);

  // Handle Delete
  const handleDelete = useCallback(() => {
    if (selection.selectedClipIds.length > 0) {
      // Remove selected clips
      tracks.forEach(track => {
        track.clips.forEach(clip => {
          if (selection.selectedClipIds.includes(clip.id)) {
            removeClipFromTrack(track.id, clip.id);
          }
        });
      });
      clearSelection();
      console.log('Deleted', selection.selectedClipIds.length, 'clips');
    } else if (selection.selectedTrackIds.length > 0) {
      // Remove selected tracks
      selection.selectedTrackIds.forEach(trackId => {
        removeTrack(trackId);
      });
      clearSelection();
      console.log('Deleted', selection.selectedTrackIds.length, 'tracks');
    } else {
      console.log('Nothing selected to delete');
    }
  }, [selection, tracks, removeClipFromTrack, removeTrack, clearSelection]);

  // Handle Select All
  const handleSelectAll = useCallback(() => {
    // Select all tracks
    const allTrackIds = tracks.map(t => t.id);
    setSelectedTracks(allTrackIds);
    
    // Select all clips
    const allClipIds: string[] = [];
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        allClipIds.push(clip.id);
      });
    });
    setSelectedClips(allClipIds);
    
    console.log('Selected all:', allTrackIds.length, 'tracks,', allClipIds.length, 'clips');
  }, [tracks, setSelectedTracks, setSelectedClips]);

  const editMenuItems: MenuItemData[] = [
    { id: 'undo', label: lastUndoAction ? `Annuler ${lastUndoAction}` : 'Annuler', shortcut: 'Ctrl+Z', action: undo, disabled: !canUndo },
    { id: 'redo', label: lastRedoAction ? `Rétablir ${lastRedoAction}` : 'Rétablir', shortcut: 'Ctrl+Y', action: redo, disabled: !canRedo },
    { id: 'sep1', label: '', separator: true },
    { id: 'cut', label: 'Couper', shortcut: 'Ctrl+X', action: handleCut, disabled: !hasSelection },
    { id: 'copy', label: 'Copier', shortcut: 'Ctrl+C', action: handleCopy, disabled: !hasSelection },
    { id: 'paste', label: 'Coller', shortcut: 'Ctrl+V', action: handlePaste, disabled: !hasData() },
    { id: 'delete', label: 'Supprimer', shortcut: 'Del', action: handleDelete, disabled: !hasSelection },
    { id: 'sep2', label: '', separator: true },
    { id: 'selectAll', label: 'Tout sélectionner', shortcut: 'Ctrl+A', action: handleSelectAll },
  ];

  const viewMenuItems: MenuItemData[] = [
    { id: 'sidebar', label: sidebarOpen ? 'Masquer la barre latérale' : 'Afficher la barre latérale', shortcut: 'Ctrl+B', action: toggleSidebar },
    { id: 'bottomPanel', label: bottomPanelOpen ? 'Masquer le panneau inférieur' : 'Afficher le panneau inférieur', action: toggleBottomPanel },
    { id: 'sep1', label: '', separator: true },
    { id: 'songEditor', label: 'Éditeur de morceau', shortcut: 'F5', action: () => setActiveEditor('song') },
    { id: 'pianoRoll', label: 'Piano roll', shortcut: 'F6', action: () => setActiveEditor('piano-roll') },
    { id: 'pattern', label: 'Éditeur de patterns', shortcut: 'F7', action: () => setActiveEditor('pattern') },
    { id: 'mixer', label: 'Table de mixage', shortcut: 'F9', action: () => setActiveEditor('mixer') },
    { id: 'sep2', label: '', separator: true },
    { id: 'theme', label: 'Changer de thème', action: () => ThemeManager.toggleTheme() },
  ];

  const handleMenuToggle = useCallback((menu: string) => {
    setOpenMenu(prev => prev === menu ? null : menu);
  }, []);

  const handleMenuClose = useCallback(() => {
    setOpenMenu(null);
  }, []);

  return (
    <header className="relative z-40 h-12 bg-daw-bg-secondary/80 backdrop-blur-sm border-b border-daw-border flex items-center px-2 gap-2 select-none">
      {/* Logo */}
      <div className="flex items-center gap-2.5 pr-3 border-r border-daw-border">
        <div className="w-8 h-8 relative group">
          {/* Ankh-inspired logo with wave element */}
          <div className="absolute inset-0 bg-[#8286ef] rounded-lg shadow-lg shadow-daw-accent-primary/30 group-hover:shadow-daw-accent-primary/50 transition-shadow">
            <svg viewBox="0 0 32 32" className="w-full h-full p-1.5">
              {/* Ankh symbol stylized with wave */}
              <defs>
                <linearGradient id="ankhGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1"/>
                  <stop offset="100%" stopColor="#e0e0ff" stopOpacity="0.9"/>
                </linearGradient>
              </defs>
              {/* Ankh loop (top circle) */}
              <ellipse cx="16" cy="8" rx="5" ry="5" fill="none" stroke="url(#ankhGradient)" strokeWidth="2.5"/>
              {/* Ankh vertical stem */}
              <line x1="16" y1="13" x2="16" y2="26" stroke="url(#ankhGradient)" strokeWidth="2.5" strokeLinecap="round"/>
              {/* Ankh horizontal arms with wave curve */}
              <path d="M8 18 Q12 16 16 18 Q20 20 24 18" fill="none" stroke="url(#ankhGradient)" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
        <div className="hidden md:flex flex-col">
          <span className="text-daw-text-primary font-bold text-sm tracking-wide">AnkhWave</span>
          <span className="text-daw-text-muted text-[9px] -mt-0.5 tracking-widest uppercase">Studio</span>
        </div>
      </div>

      {/* Menus */}
      <div className="flex items-center gap-0.5">
        <DropdownMenu
          label="Fichier"
          items={fileMenuItems}
          isOpen={openMenu === 'file'}
          onToggle={() => handleMenuToggle('file')}
          onClose={handleMenuClose}
        />
        <DropdownMenu
          label="Édition"
          items={editMenuItems}
          isOpen={openMenu === 'edit'}
          onToggle={() => handleMenuToggle('edit')}
          onClose={handleMenuClose}
        />
        <DropdownMenu
          label="Affichage"
          items={viewMenuItems}
          isOpen={openMenu === 'view'}
          onToggle={() => handleMenuToggle('view')}
          onClose={handleMenuClose}
        />
      </div>

      {/* Undo/Redo buttons */}
      <div className="flex items-center gap-0.5 px-2 border-l border-daw-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={undo}
          disabled={!canUndo}
          title={lastUndoAction ? `Annuler : ${lastUndoAction} (Ctrl+Z)` : 'Rien à annuler'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={redo}
          disabled={!canRedo}
          title={lastRedoAction ? `Rétablir : ${lastRedoAction} (Ctrl+Shift+Z)` : 'Rien à rétablir'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </Button>
      </div>

      {/* Project name */}
      <div className="flex items-center gap-1 px-2 border-l border-daw-border">
        {isEditingName ? (
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={saveName}
            onKeyDown={handleNameKeyDown}
            className="bg-daw-bg-surface text-daw-text-primary text-sm px-1 rounded border border-daw-border focus:border-daw-accent outline-none w-[150px]"
            autoFocus
          />
        ) : (
          <span 
            className="text-sm text-daw-text-secondary truncate max-w-[150px] cursor-pointer hover:text-daw-text-primary hover:bg-daw-bg-surface px-1 rounded transition-colors" 
            title="Cliquez pour renommer"
            onClick={startEditingName}
          >
            {metadata.name || 'Projet sans titre'}
          </span>
        )}
        {isDirty && <span className="text-daw-accent-secondary text-lg leading-none">•</span>}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Transport controls */}
      <div className="flex items-center gap-1 px-2 border-x border-daw-border">
        {/* Rewind button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => useTransportStore.getState().setPosition(0)}
          title="Aller au début (Home)"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </Button>

        {/* Stop button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={stop}
          title="Arrêter (Espace)"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </Button>

        {/* Play/Pause button */}
        <Button
          variant={isPlaying ? 'secondary' : 'primary'}
          size="sm"
          onClick={handlePlayPause}
          title={isPlaying ? 'Pause (Espace)' : 'Lecture (Espace)'}
          active={isPlaying}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </Button>

        {/* Record button */}
        <Button
          variant={isRecording ? 'danger' : 'ghost'}
          size="sm"
          onClick={handleRecord}
          title={isRecording ? 'Arrêter l’enregistrement (R)' : 'Enregistrer (R)'}
          active={isRecording}
        >
          <svg className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`} fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" />
          </svg>
        </Button>

        {/* Loop toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLoopEnabled(!loopEnabled)}
          title={loopEnabled ? 'Désactiver la boucle (L)' : 'Activer la boucle (L)'}
          active={loopEnabled}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </Button>
      </div>

      {/* Position display */}
      <div
        className="bg-daw-bg-primary px-3 py-1 rounded font-mono text-sm text-daw-text-primary min-w-[100px] text-center border border-daw-border cursor-default"
        title="Position (Mesures:Temps:Tics)"
      >
        {formatPosition(position)}
      </div>

      {/* Tempo control */}
      <div className="flex items-center gap-1.5 px-2 border-l border-daw-border">
        <span className="text-xs text-daw-text-muted">BPM</span>
        <input
          type="number"
          value={tempo}
          onChange={handleTempoChange}
          onWheel={handleTempoWheel}
          min={20}
          max={999}
          className="w-14 bg-daw-bg-primary border border-daw-border rounded px-2 py-0.5 text-sm text-daw-text-primary text-center font-mono focus:outline-none focus:ring-1 focus:ring-daw-accent-primary"
        />
      </div>

      {/* Time signature */}
      <div className="flex items-center gap-1 px-2 border-l border-daw-border">
        <span className="text-xs text-daw-text-muted">Mesure</span>
        <span className="text-sm text-daw-text-secondary font-mono">
          {settings.timeSignature.numerator}/{settings.timeSignature.denominator}
        </span>
      </div>

      {/* CPU indicator */}
      <div className="flex items-center gap-1 px-2 border-l border-daw-border" title="Utilisation CPU">
        <svg className="w-3.5 h-3.5 text-daw-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
        <span className={`text-xs font-mono min-w-[30px] ${cpuUsage > 80 ? 'text-red-500' : cpuUsage > 50 ? 'text-yellow-500' : 'text-daw-text-secondary'}`}>
          {cpuUsage.toFixed(0)}%
        </span>
      </div>

      {/* Settings button */}
      <Button variant="ghost" size="sm" title="Paramètres" onClick={() => openDialog('preferences')}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </Button>
    </header>
  );
});

Header.displayName = 'Header';

export default Header;