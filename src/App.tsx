// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * AnkhWave - Main Application Component
 * A modern web-based digital audio workstation
 * Features: Integrated layout with resizable panels, keyboard shortcuts,
 * audio engine initialization, global state management
 * Includes: Undo/Redo, Copy/Paste, MIDI import, AnkhWaveStudio project import, Audio export
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';
import { StatusBar } from './components/layout/StatusBar';
import { MixerView } from './components/mixer/MixerView';
import { InstrumentRack } from './components/instruments/InstrumentRack';
import { ExportDialog, ImportProjectDialog, SaveProjectDialog, SettingsDialog, ProjectSettingsDialog } from './components/dialogs';
import { AudioProvider, useAudioContext } from './contexts/AudioContext';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useUIStore } from './stores/uiStore';
import { useTransportStore } from './stores/transportStore';
import { useSongStore } from './stores/songStore';
import { useMixerStore } from './stores/mixerStore';
import { useHistoryStore } from './stores/historyStore';
import { useClipboardStore } from './stores/clipboardStore';
import { getKeyboardShortcuts } from './platform';
import { importMidiFile, isMidiFile } from './utils/midiImport';
import { isAnkhWaveStudioProjectFile, importAnkhWaveStudioProject } from './utils/projectImport';
import { AudioExporter, ExportOptions, ExportProgress } from './audio/AudioExporter';
import { ThemeManager } from './utils/ThemeManager';
import type { ProjectData } from './types/song';

type BottomPanel = 'mixer' | 'instruments' | 'none';

/**
 * Inner App component that uses the audio context
 */
const AppContent: React.FC = () => {
  const { initialize, isInitialized, isInitializing: audioInitializing } = useAudioContext();
  const { state: audioState } = useAudioEngine();
  const { sidebarOpen, sidebarWidth, setSidebarWidth, currentEditor, setSidebarOpen, setCurrentEditor, dialogs, closeDialog, theme, preferences } = useUIStore();
  const { play, pause, stop, isPlaying, loopEnabled, setLoopEnabled, connectAudioEngine: connectTransport } = useTransportStore();
  const { selectedTrackId, metadata, connectAudioEngine: connectSong, loadProject, tracks, updateTrack, markClean } = useSongStore();
  const { connectAudioEngine: connectMixer } = useMixerStore();
  const { undo, redo } = useHistoryStore();
  const canUndo = useHistoryStore((state) => state.canUndo);
  const canRedo = useHistoryStore((state) => state.canRedo);
  const { hasData } = useClipboardStore();
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>('none');
  const [instrumentStates, setInstrumentStates] = useState<Record<string, { minimized: boolean; enabled: boolean }>>({});

  const handleInstrumentAdd = useCallback((type: string) => {
    if (!selectedTrackId) return;
    const track = tracks.find(t => t.id === selectedTrackId);
    if (!track || track.type !== 'instrument') return;
    
    const newInstrumentId = `inst-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newInstrument = {
        id: newInstrumentId,
        type: type,
        name: type,
        params: { volume: 1.0, pan: 0, pitch: 0 }
    };
    
    updateTrack(selectedTrackId, { instrument: newInstrument } as any);
  }, [selectedTrackId, tracks, updateTrack]);

  const handleInstrumentMinimize = useCallback((instrumentId: string, minimized: boolean) => {
    setInstrumentStates(prev => ({
      ...prev,
      [instrumentId]: { ...prev[instrumentId], minimized }
    }));
  }, []);

  const handleInstrumentToggle = useCallback((instrumentId: string, enabled: boolean) => {
    setInstrumentStates(prev => ({
      ...prev,
      [instrumentId]: { ...prev[instrumentId], enabled }
    }));
  }, []);

  const handleInstrumentRemove = useCallback((instrumentId: string) => {
    if (!selectedTrackId) return;
    updateTrack(selectedTrackId, { instrument: undefined } as any);
  }, [selectedTrackId, updateTrack]);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(250);
  const [isResizingBottom, setIsResizingBottom] = useState(false);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const audioConnectedRef = useRef(false);

  // Apply theme changes to the document (keeps ThemeManager + persisted UI store in sync)
  useEffect(() => {
    ThemeManager.applyTheme(ThemeManager.resolveTheme(theme));
  }, [theme]);

  // Keyboard shortcuts (zoom, settings)
  useEffect(() => {
    const shortcuts = getKeyboardShortcuts();

    const getZoomKeyForActiveEditor = (): keyof ReturnType<typeof useUIStore.getState>['zoom'] => {
      const editor = useUIStore.getState().activeEditor;
      switch (editor) {
        case 'song':
          return 'songEditor';
        case 'piano-roll':
        case 'pianoRoll':
          return 'pianoRoll';
        case 'pattern':
          return 'patternEditor';
        default:
          return 'horizontal';
      }
    };

    const unsubs = [
      shortcuts.onShortcut('play-pause', () => {
        useTransportStore.getState().toggle();
      }),
      shortcuts.onShortcut('stop', () => {
        const { dialogs, closeDialog } = useUIStore.getState();
        const openDialogName = (Object.keys(dialogs) as Array<keyof typeof dialogs>).find(key => dialogs[key]);
        
        if (openDialogName) {
          closeDialog(openDialogName);
        } else {
          useTransportStore.getState().stop();
        }
      }),
      shortcuts.onShortcut('undo', () => {
        useHistoryStore.getState().undo();
      }),
      shortcuts.onShortcut('redo', () => {
        useHistoryStore.getState().redo();
      }),
      shortcuts.onShortcut('save-project', () => {
        useUIStore.getState().openDialog('saveDialog');
      }),
      shortcuts.onShortcut('zoom-in', () => {
        useUIStore.getState().zoomIn(getZoomKeyForActiveEditor());
      }),
      shortcuts.onShortcut('zoom-out', () => {
        useUIStore.getState().zoomOut(getZoomKeyForActiveEditor());
      }),
      shortcuts.onShortcut('zoom-fit', () => {
        useUIStore.getState().resetZoom(getZoomKeyForActiveEditor());
      }),
      shortcuts.onShortcut('settings', () => {
        useUIStore.getState().openDialog('preferences');
      }),
      shortcuts.onShortcut('record', () => {
        const { isRecording, startRecording, stopRecording } = useTransportStore.getState();
        if (isRecording) {
          stopRecording();
        } else {
          startRecording();
        }
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  // Initialize application
  useEffect(() => {
    const init = async () => {
      try {
        // Load last project if enabled
        const { preferences } = useUIStore.getState();
        if (preferences.openLastProject) {
          const lastProject = localStorage.getItem('ankhwave-autosave');
          if (lastProject) {
            try {
              const project = JSON.parse(lastProject);
              loadProject(project);
              console.log('Restored last session');
            } catch (e) {
              console.error('Failed to restore session:', e);
            }
          }
        }
        setIsInitializing(false);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setIsInitializing(false);
      }
    };
    init();
  }, [loadProject]);

  // Get current project for save dialog
  const getCurrentProject = useCallback((): ProjectData => {
    // TODO: Get actual project from song store
    return {
      id: 'current-project',
      name: metadata.name || 'Sans titre',
      version: '1.0.0',
      metadata: {
        name: metadata.name || 'Sans titre',
        author: metadata.author || '',
        description: metadata.description || '',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        version: '1.0.0',
      },
      song: {
        tempo: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        masterVolume: 1,
        masterPitch: 0,
        length: 16,
      },
      tracks: [],
      controllers: [],
      mixer: {
        channels: [],
        masterChannel: {
          id: 'master',
          name: 'Master',
          volume: 1,
          pan: 0,
          mute: false,
          solo: false,
          effects: [],
          sends: [],
        },
      },
      automation: [],
      patterns: [],
    };
  }, [metadata]);

  // Auto-save
  useEffect(() => {
    const { preferences } = useUIStore.getState();
    if (!preferences.autoSaveEnabled) return;

    const interval = setInterval(() => {
      const project = getCurrentProject();
      localStorage.setItem('ankhwave-autosave', JSON.stringify(project));
      console.log('Auto-saved project');
    }, preferences.autoSaveInterval * 60 * 1000);

    return () => clearInterval(interval);
  }, [preferences.autoSaveEnabled, preferences.autoSaveInterval, getCurrentProject]);

  // Connect stores to audio engine when initialized
  useEffect(() => {
    if (isInitialized && !audioConnectedRef.current) {
      console.log('Connecting stores to audio engine...');
      connectTransport();
      connectSong();
      connectMixer();
      audioConnectedRef.current = true;
      console.log('All stores connected to audio engine');
    }
  }, [isInitialized, connectTransport, connectSong, connectMixer]);

  // Initialize audio on user interaction
  const handleInitAudio = useCallback(async () => {
    if (!isInitialized && !audioInitializing) {
      await initialize();
    }
  }, [isInitialized, audioInitializing, initialize]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Transport controls
      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) {
          pause();
        } else {
          play();
        }
      }
      
      // Stop (Enter or Escape)
      if (e.code === 'Enter' || e.code === 'Escape') {
        stop();
      }
      
      // Loop toggle (L)
      if (e.code === 'KeyL' && !e.ctrlKey && !e.metaKey) {
        setLoopEnabled(!loopEnabled);
      }

      // View shortcuts
      if (e.code === 'KeyB' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }
      
      if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey) {
        setBottomPanel(prev => prev === 'mixer' ? 'none' : 'mixer');
      }
      
      if (e.code === 'KeyI' && !e.ctrlKey && !e.metaKey) {
        setBottomPanel(prev => prev === 'instruments' ? 'none' : 'instruments');
      }

      // Editor shortcuts (F5-F9)
      if (e.code === 'F5') {
        e.preventDefault();
        setCurrentEditor('song');
      }
      if (e.code === 'F6') {
        e.preventDefault();
        setCurrentEditor('piano-roll');
      }
      if (e.code === 'F7') {
        e.preventDefault();
        setCurrentEditor('pattern');
      }
      if (e.code === 'F9') {
        e.preventDefault();
        setCurrentEditor('mixer');
      }
      
      // Number shortcuts for editors (without modifiers)
      if (e.code === 'Digit1' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setCurrentEditor('song');
      }
      if (e.code === 'Digit2' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setCurrentEditor('piano-roll');
      }
      if (e.code === 'Digit3' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setCurrentEditor('pattern');
      }
      if (e.code === 'Digit4' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setCurrentEditor('automation');
      }

      // Save (Ctrl+S)
      if (e.code === 'KeyS' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        useUIStore.getState().openDialog('saveDialog');
      }

      // New Project (Ctrl+N)
      if (e.code === 'KeyN' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        useSongStore.getState().newProject();
      }

      // Open Project (Ctrl+O)
      if (e.code === 'KeyO' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        useUIStore.getState().openDialog('importDialog');
      }

      // Undo (Ctrl+Z)
      if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Redo (Ctrl+Shift+Z or Ctrl+Y)
      if ((e.code === 'KeyZ' && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
          (e.code === 'KeyY' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        redo();
      }

      // Copy (Ctrl+C)
      if (e.code === 'KeyC' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        // Get selection from UI store and copy
        const { selection } = useUIStore.getState();
        const { tracks } = useSongStore.getState();
        
        if (selection.selectedClipIds.length > 0) {
          const selectedClips: any[] = [];
          tracks.forEach(track => {
            track.clips.forEach(clip => {
              if (selection.selectedClipIds.includes(clip.id)) {
                selectedClips.push(clip);
              }
            });
          });
          if (selectedClips.length > 0) {
            const { copyClips } = require('./stores/clipboardStore');
            copyClips(selectedClips, tracks[0]?.id || '');
            console.log('Copied', selectedClips.length, 'clips');
          }
        } else if (selection.selectedTrackIds.length > 0) {
          const selectedTracks = tracks.filter(t => selection.selectedTrackIds.includes(t.id));
          const { copyTracks } = require('./stores/clipboardStore');
          copyTracks(selectedTracks);
          console.log('Copied', selectedTracks.length, 'tracks');
        }
      }

      // Cut (Ctrl+X)
      if (e.code === 'KeyX' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const { selection, clearSelection } = useUIStore.getState();
        const { tracks, removeClipFromTrack } = useSongStore.getState();
        
        if (selection.selectedClipIds.length > 0) {
          const selectedClips: Array<{ clip: any; trackId: string }> = [];
          tracks.forEach(track => {
            track.clips.forEach(clip => {
              if (selection.selectedClipIds.includes(clip.id)) {
                selectedClips.push({ clip, trackId: track.id });
              }
            });
          });
          if (selectedClips.length > 0) {
            const { cutClips } = require('./stores/clipboardStore');
            cutClips(selectedClips.map(c => c.clip), selectedClips[0].trackId);
            selectedClips.forEach(({ clip, trackId }) => {
              removeClipFromTrack(trackId, clip.id);
            });
            clearSelection();
            console.log('Cut', selectedClips.length, 'clips');
          }
        }
      }

      // Paste (Ctrl+V)
      if (e.code === 'KeyV' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const clipboardStore = useClipboardStore.getState();
        if (clipboardStore.hasData()) {
          console.log('Paste - clipboard has data:', clipboardStore.data?.type);
          // TODO: Implement actual paste based on clipboard data type
        }
      }

      // Delete (Del or Backspace)
      if (e.code === 'Delete' || e.code === 'Backspace') {
        // Don't prevent default for backspace in case user is in an input
        if (e.code === 'Delete') {
          e.preventDefault();
        }
        
        const { selection, clearSelection } = useUIStore.getState();
        const { tracks, removeClipFromTrack, removeTrack } = useSongStore.getState();
        
        if (selection.selectedClipIds.length > 0) {
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
          selection.selectedTrackIds.forEach(trackId => {
            removeTrack(trackId);
          });
          clearSelection();
          console.log('Deleted', selection.selectedTrackIds.length, 'tracks');
        }
      }

      // Select All (Ctrl+A)
      if (e.code === 'KeyA' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const { tracks } = useSongStore.getState();
        const { setSelectedTracks, setSelectedClips } = useUIStore.getState();
        
        const allTrackIds = tracks.map(t => t.id);
        setSelectedTracks(allTrackIds);
        
        const allClipIds: string[] = [];
        tracks.forEach(track => {
          track.clips.forEach(clip => {
            allClipIds.push(clip.id);
          });
        });
        setSelectedClips(allClipIds);
        console.log('Selected all:', allTrackIds.length, 'tracks,', allClipIds.length, 'clips');
      }

      // Export (Ctrl+E)
      if (e.code === 'KeyE' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        useUIStore.getState().openDialog('exportDialog');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, play, pause, stop, loopEnabled, setLoopEnabled, sidebarOpen, setSidebarOpen, setCurrentEditor, undo, redo, hasData]);

  // Handle file drag and drop for MIDI import
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if this is an internal drag (instrument/sample from sidebar)
    const jsonData = e.dataTransfer.types.includes('application/json');
    if (jsonData) {
      // Don't show the file drop overlay for internal drags
      return;
    }
    
    // Only show overlay for file drops
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  }, []);

  // Map sidebar item IDs to InstrumentType values
  const instrumentTypeMap: Record<string, string> = {
    'triple-osc': 'tripleoscillator',
    'bitinvader': 'bitinvader',
    'kicker': 'kicker',
    'sample-player': 'audiofileprocessor',
    'organic': 'organic',
    'lb302': 'lb302',
    'sfxr': 'oscillator', // Map to oscillator as fallback
    'zynaddsubfx': 'monstro', // Map to monstro as closest equivalent
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    // Check for internal drag data (instrument/sample from sidebar)
    const jsonData = e.dataTransfer.getData('application/json');
    if (jsonData) {
      try {
        const data = JSON.parse(jsonData);
        
        // Handle instrument drop
        if (data.type === 'instrument') {
          console.log('Instrument dropped:', data);
          // Create a new track with this instrument
          const { addInstrumentTrack } = useSongStore.getState();
          const colors = ['#8286ef', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#84cc16'];
          const trackCount = useSongStore.getState().tracks.length;
          // Map the sidebar item ID to the correct InstrumentType
          const instrumentType = instrumentTypeMap[data.id] || 'oscillator';
          addInstrumentTrack(
            data.name,
            instrumentType as import('./audio/InstrumentFactory').InstrumentType,
            colors[trackCount % colors.length]
          );
          setImportStatus(`Instrument ajouté : ${data.name}`);
          setTimeout(() => setImportStatus(null), 2000);
          return;
        }
        
        // Handle sample drop
        if (data.type === 'sample') {
          console.log('Sample dropped:', data);
          // Create a new audio track or sample player track
          setImportStatus(`Sample : ${data.name} — glissez vers une piste pour l’utiliser`);
          setTimeout(() => setImportStatus(null), 2000);
          return;
        }
        
        // Handle effect drop
        if (data.type === 'effect') {
          console.log('Effect dropped:', data);
          setImportStatus(`Effet : ${data.name} — glissez vers une piste de mixage pour l’ajouter`);
          setTimeout(() => setImportStatus(null), 2000);
          return;
        }
      } catch (err) {
        console.warn('Failed to parse drag data:', err);
      }
    }

    const files = Array.from(e.dataTransfer.files);
    
    // Check for AnkhWaveStudio project file first
    const ankhWaveStudioFile = files.find(isAnkhWaveStudioProjectFile);
    if (ankhWaveStudioFile) {
      setImportStatus('Import du projet AnkhWaveStudio…');
      try {
        const result = await importAnkhWaveStudioProject(ankhWaveStudioFile);
        console.log('Imported AnkhWaveStudio project:', result);
        setImportStatus(`Importé : ${result.project.name} (${result.project.tracks.length} pistes)`);
        // Load the imported project into the song store
        loadProject(result.project);
        if (result.warnings.length > 0) {
          console.warn('Import warnings:', result.warnings);
        }
        setTimeout(() => setImportStatus(null), 3000);
      } catch (error) {
        console.error('Failed to import AnkhWaveStudio project:', error);
        setImportStatus('Échec de l’import du projet AnkhWaveStudio');
        setTimeout(() => setImportStatus(null), 3000);
      }
      return;
    }

    // Check for MIDI file
    const midiFile = files.find(isMidiFile);
    if (midiFile) {
      setImportStatus('Import du fichier MIDI…');
      try {
        const midiProject = await importMidiFile(midiFile);
        console.log('Imported MIDI project:', midiProject);
        setImportStatus(`Importé : ${midiProject.name} (${midiProject.tracks.length} pistes)`);
        // Note: MIDI import returns a different format, would need conversion
        // For now, just log it - full conversion would be needed
        console.log('MIDI project needs conversion to ProjectData format');
        setTimeout(() => setImportStatus(null), 3000);
      } catch (error) {
        console.error('Failed to import MIDI:', error);
        setImportStatus('Échec de l’import du fichier MIDI');
        setTimeout(() => setImportStatus(null), 3000);
      }
    }
  }, [loadProject]);

  // Handle AnkhWaveStudio project import from dialog
  const handleProjectImport = useCallback((project: ProjectData) => {
    console.log('Project imported:', project);
    // Load the imported project into the song store
    loadProject(project);
    setImportStatus(`Chargé : ${project.name}`);
    setTimeout(() => setImportStatus(null), 3000);
  }, [loadProject]);



  // Handle audio export
  const handleExport = useCallback(async (
    options: ExportOptions,
    onProgress: (progress: ExportProgress) => void
  ): Promise<Blob> => {
    const exporter = new AudioExporter();
    
    // Calculate project duration (placeholder - should come from song store)
    const duration = 60; // 60 seconds placeholder
    
    return exporter.export(
      async (context, destination) => {
        // This is where we would render the entire project
        // For now, create a simple test tone
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        
        oscillator.frequency.value = 440;
        gain.gain.value = 0.3;
        
        oscillator.connect(gain);
        gain.connect(destination);
        
        oscillator.start(0);
        oscillator.stop(duration);
      },
      duration,
      options,
      onProgress
    );
  }, []);

  // Handle bottom panel resize
  useEffect(() => {
    if (!isResizingBottom) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const newHeight = containerRect.bottom - e.clientY;
      setBottomPanelHeight(Math.max(150, Math.min(500, newHeight)));
    };

    const handleMouseUp = () => {
      setIsResizingBottom(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingBottom]);

  // Handle sidebar resize
  useEffect(() => {
    if (!isResizingSidebar) return;

    const handleMouseMove = (e: MouseEvent) => {
      setSidebarWidth(Math.max(200, Math.min(500, e.clientX)));
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, setSidebarWidth]);

  // Loading screen
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-daw-bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-daw-accent-primary mx-auto mb-4" />
          <p className="text-daw-text-secondary">Loading AnkhWave...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-screen bg-daw-bg-primary text-daw-text-primary overflow-hidden select-none ${
        isDraggingFile ? 'ring-2 ring-daw-accent-primary ring-inset' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* File drop overlay */}
      {isDraggingFile && (
        <div className="fixed inset-0 bg-daw-accent-primary/20 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-daw-bg-elevated p-8 rounded-lg shadow-xl border border-daw-accent-primary">
            <div className="text-4xl mb-4 text-center">🎵</div>
            <p className="text-daw-text-primary text-lg">Drop MIDI or AnkhWaveStudio project file to import</p>
            <p className="text-daw-text-muted text-sm mt-2 text-center">Supported: .mid, .midi, .mmp, .mmpz</p>
          </div>
        </div>
      )}

      {/* Import status notification */}
      {importStatus && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 bg-daw-bg-elevated px-4 py-2 rounded-lg shadow-xl border border-daw-border z-50">
          <p className="text-daw-text-primary text-sm">{importStatus}</p>
        </div>
      )}

      {/* Export dialog */}
      <ExportDialog
        isOpen={dialogs.exportDialog}
        onClose={() => closeDialog('exportDialog')}
        projectName={metadata.name}
        duration={60} // TODO: Get actual project duration
        onExport={handleExport}
      />

      {/* Import project dialog */}
      <ImportProjectDialog
        isOpen={dialogs.importDialog || false}
        onClose={() => closeDialog('importDialog')}
        onImport={handleProjectImport}
      />

      {/* Save project dialog */}
      <SaveProjectDialog
        isOpen={dialogs.saveDialog || false}
        onClose={() => closeDialog('saveDialog')}
        project={getCurrentProject()}
        onSaveComplete={(fileName) => {
          setImportStatus(`Saved: ${fileName}`);
          setTimeout(() => setImportStatus(null), 3000);
          markClean();
        }}
      />

      {/* Settings dialog */}
      <SettingsDialog
        isOpen={dialogs.preferences || false}
        onClose={() => closeDialog('preferences')}
      />

      {/* Project Settings dialog */}
      <ProjectSettingsDialog
        isOpen={dialogs.projectSettings || false}
        onClose={() => closeDialog('projectSettings')}
      />
      {/* Audio initialization overlay */}
      {!isInitialized && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 cursor-pointer"
          onClick={handleInitAudio}
        >
          <div className="text-center p-10 bg-gradient-to-b from-daw-bg-secondary to-daw-bg-primary rounded-2xl shadow-2xl max-w-md border border-daw-border/50">
            {/* AnkhWave Logo */}
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 bg-[#8286ef] rounded-2xl shadow-lg shadow-daw-accent-primary/40">
                <svg viewBox="0 0 32 32" className="w-full h-full p-4">
                  <defs>
                    <linearGradient id="ankhGradientLarge" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="1"/>
                      <stop offset="100%" stopColor="#e0e0ff" stopOpacity="0.9"/>
                    </linearGradient>
                  </defs>
                  <ellipse cx="16" cy="8" rx="5" ry="5" fill="none" stroke="url(#ankhGradientLarge)" strokeWidth="2.5"/>
                  <line x1="16" y1="13" x2="16" y2="26" stroke="url(#ankhGradientLarge)" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M8 18 Q12 16 16 18 Q20 20 24 18" fill="none" stroke="url(#ankhGradientLarge)" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-daw-text-primary mb-1 tracking-wide">AnkhWave</h2>
            <p className="text-xs text-daw-accent-primary font-medium tracking-widest uppercase mb-4">
              Studio
            </p>
            <p className="text-daw-text-secondary mb-6">
              {audioInitializing ? "Initialisation du moteur audio..." : "Cliquez n’importe où pour démarrer"}
            </p>
            <button
              className="px-8 py-3 bg-gradient-to-r from-daw-accent-primary to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-daw-accent-primary transition-all font-medium disabled:opacity-50 shadow-lg shadow-daw-accent-primary/30 hover:shadow-daw-accent-primary/50"
              onClick={handleInitAudio}
              disabled={audioInitializing}
            >
              {audioInitializing ? 'Démarrage...' : 'Démarrer le moteur audio'}
            </button>
            <p className="text-[10px] text-daw-text-muted mt-6 opacity-60">
              L’audio nécessite une interaction utilisateur pour démarrer
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <Header />

      {/* Main content area */}
      <div className={`flex flex-1 overflow-hidden relative isolate ${preferences.sidebarOnRight ? 'flex-row-reverse' : ''}`}>
        {/* Sidebar */}
        {sidebarOpen && (
          <>
            <div style={{ width: sidebarWidth }} className="flex-shrink-0 relative z-20 overflow-hidden">
              <Sidebar />
            </div>
            {/* Sidebar resize handle */}
            <div
              className="w-1 bg-daw-border hover:bg-daw-accent-primary cursor-col-resize flex-shrink-0 transition-colors relative z-30"
              onMouseDown={() => setIsResizingSidebar(true)}
            />
          </>
        )}

        {/* Main editor area */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative z-10">
          {/* Editor content */}
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
            <MainContent />
          </div>

          {/* Bottom panel resize handle */}
          {bottomPanel !== 'none' && (
            <div
              className="h-1 bg-daw-border hover:bg-daw-accent-primary cursor-row-resize flex-shrink-0 transition-colors"
              onMouseDown={() => setIsResizingBottom(true)}
            />
          )}

          {/* Bottom panel */}
          {bottomPanel !== 'none' && (
            <div 
              className="flex-shrink-0 border-t border-daw-border overflow-hidden"
              style={{ height: bottomPanelHeight }}
            >
              {bottomPanel === 'mixer' && <MixerView />}
              {bottomPanel === 'instruments' && (
                <InstrumentRack
                  trackId={selectedTrackId || undefined}
                  instruments={(() => {
                    if (!selectedTrackId) return [];
                    const track = tracks.find(t => t.id === selectedTrackId);
                    if (!track || track.type !== 'instrument') return [];
                    const instTrack = track as import('./types/song').InstrumentTrack;
                    if (!instTrack.instrument) return [];
                    return [{
                      id: instTrack.instrument.id,
                      type: instTrack.instrument.type,
                      name: instTrack.instrument.name || instTrack.instrument.type,
                      minimized: instrumentStates[instTrack.instrument.id]?.minimized || false,
                      enabled: instrumentStates[instTrack.instrument.id]?.enabled ?? true,
                    }];
                  })()}
                  onInstrumentAdd={handleInstrumentAdd}
                  onInstrumentRemove={handleInstrumentRemove}
                  onInstrumentToggle={handleInstrumentToggle}
                  onInstrumentMinimize={handleInstrumentMinimize}
                  onClose={() => setBottomPanel('none')}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom panel tabs */}
      <div className="h-8 bg-daw-bg-secondary border-t border-daw-border flex items-center px-2 gap-1">
        <button
          onClick={() => setBottomPanel(prev => prev === 'mixer' ? 'none' : 'mixer')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            bottomPanel === 'mixer'
              ? 'bg-daw-accent-primary text-white'
              : 'text-daw-text-muted hover:text-daw-text-secondary hover:bg-daw-bg-surface'
          }`}
        >
          Table de mixage (M)
        </button>
        <button
          onClick={() => setBottomPanel(prev => prev === 'instruments' ? 'none' : 'instruments')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            bottomPanel === 'instruments'
              ? 'bg-daw-accent-primary text-white'
              : 'text-daw-text-muted hover:text-daw-text-secondary hover:bg-daw-bg-surface'
          }`}
        >
          Instruments (I)
        </button>
        
        <div className="flex-1" />
        
        {/* Editor tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentEditor('song')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              currentEditor === 'song'
                ? 'bg-daw-bg-surface text-daw-text-primary'
                : 'text-daw-text-muted hover:text-daw-text-secondary'
            }`}
          >
            Morceau (1)
          </button>
          <button
            onClick={() => setCurrentEditor('piano-roll')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              currentEditor === 'piano-roll'
                ? 'bg-daw-bg-surface text-daw-text-primary'
                : 'text-daw-text-muted hover:text-daw-text-secondary'
            }`}
          >
            Piano roll (2)
          </button>
          <button
            onClick={() => setCurrentEditor('pattern')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              currentEditor === 'pattern'
                ? 'bg-daw-bg-surface text-daw-text-primary'
                : 'text-daw-text-muted hover:text-daw-text-secondary'
            }`}
          >
            Patterns (3)
          </button>
          <button
            onClick={() => setCurrentEditor('automation')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              currentEditor === 'automation'
                ? 'bg-daw-bg-surface text-daw-text-primary'
                : 'text-daw-text-muted hover:text-daw-text-secondary'
            }`}
          >
            Automatisation (4)
          </button>
        </div>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
};

/**
 * Main App component wrapped with AudioProvider
 */
const App: React.FC = () => {
  return (
    <AudioProvider>
      <AppContent />
    </AudioProvider>
  );
};

export default App;