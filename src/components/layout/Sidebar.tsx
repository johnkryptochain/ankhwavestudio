// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Sidebar - Enhanced left sidebar with instrument/sample/effect browser
 * Features: Collapsible sections, search/filter, drag-and-drop, project tree
 */

import React, { useState, useCallback, useMemo, memo, useRef } from 'react';
import { useUIStore, useSongStore } from '../../stores';
import { Button } from '../common';
import { AudioEngineManager } from '../../audio/AudioEngineManager';
import { SampleBrowser } from '../browser';
import { 
  Reverb, Delay, Compressor, ParametricEQ, Chorus, Distortion, 
  Flanger, Bitcrush, BassBooster, StereoEnhancer, Waveshaper,
  MultitapEcho, DualFilter, Amplifier, CrossoverEQ, Spectrograph,
  StereoMatrix, PeakController, DynamicsProcessor, Phaser, EQ3Band,
  ReverbSC, Dispersion, GranularPitchShifter, LOMM, SlewDistortion
} from '../../audio/effects';

import ControllerRack from '../controllers/ControllerRack';

type SidebarTab = 'instruments' | 'samples' | 'effects' | 'project' | 'controllers';

interface BrowserItem {
  id: string;
  name: string;
  category: string;
  type: 'instrument' | 'sample' | 'effect';
  icon?: string;
  description?: string;
  tags?: string[];
}

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  defaultOpen = true,
  children,
  count,
  action
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-daw-border last:border-b-0">
      <button
        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-daw-text-secondary hover:bg-daw-bg-surface transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
        <span className="flex-1 text-left">{title}</span>
        {count !== undefined && (
          <span className="text-daw-text-muted text-[10px]">({count})</span>
        )}
        {action && (
          <span onClick={(e) => e.stopPropagation()}>
            {action}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="pb-1">
          {children}
        </div>
      )}
    </div>
  );
};

const BrowserItemComponent: React.FC<{
  item: BrowserItem;
  onDragStart?: (item: BrowserItem) => void;
  onDoubleClick?: (item: BrowserItem) => void;
  onClick?: (item: BrowserItem) => void;
}> = memo(({ item, onDragStart, onDoubleClick, onClick }) => {
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart?.(item);
  }, [item, onDragStart]);

  const getIcon = () => {
    switch (item.type) {
      case 'instrument':
        return (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
          </svg>
        );
      case 'sample':
        return (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        );
      case 'effect':
        return (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 18h2V6H7v12zm4 4h2V2h-2v20zm-8-8h2v-4H3v4zm12 4h2V6h-2v12zm4-8v4h2v-4h-2z" />
          </svg>
        );
    }
  };

  const getColorClass = () => {
    switch (item.type) {
      case 'instrument': return 'bg-purple-500/20 text-purple-400';
      case 'sample': return 'bg-green-500/20 text-green-400';
      case 'effect': return 'bg-cyan-500/20 text-cyan-400';
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 mx-1 rounded cursor-grab hover:bg-daw-bg-surface active:cursor-grabbing transition-colors group"
      draggable
      onDragStart={handleDragStart}
      onDoubleClick={() => onDoubleClick?.(item)}
      onClick={() => onClick?.(item)}
      title={item.description || item.name}
    >
      <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${getColorClass()}`}>
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-daw-text-primary truncate group-hover:text-white transition-colors">
          {item.name}
        </div>
        <div className="text-[10px] text-daw-text-muted truncate">
          {item.category}
        </div>
      </div>
    </div>
  );
});

BrowserItemComponent.displayName = 'BrowserItemComponent';

interface LoadedSample {
  id: string;
  name: string;
  path: string;
  duration: number;
  size: number;
  type: string;
}

// Effect factory function to create effect instances
const createEffect = (effectType: string, audioContext: AudioContext): import('../../audio/effects').BaseEffect | null => {
  const effectId = `effect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  switch (effectType.toLowerCase()) {
    case 'reverb':
      return new Reverb(audioContext, effectId);
    case 'delay':
      return new Delay(audioContext, effectId);
    case 'compressor':
      return new Compressor(audioContext, effectId);
    case 'eq':
    case 'equalizer':
      return new ParametricEQ(audioContext, effectId);
    case 'chorus':
      return new Chorus(audioContext, effectId);
    case 'distortion':
      return new Distortion(audioContext, effectId);
    case 'flanger':
      return new Flanger(audioContext, effectId);
    case 'bitcrush':
      return new Bitcrush(audioContext, effectId);
    case 'bassbooster':
      return new BassBooster(audioContext, effectId);
    case 'stereoenhancer':
      return new StereoEnhancer(audioContext, effectId);
    case 'waveshaper':
      return new Waveshaper(audioContext, effectId);
    case 'multitapecho':
      return new MultitapEcho(audioContext, effectId);
    case 'dualfilter':
      return new DualFilter(audioContext, effectId);
    case 'amplifier':
      return new Amplifier(audioContext, effectId);
    case 'crossovereq':
      return new CrossoverEQ(audioContext, effectId);
    case 'spectrograph':
      return new Spectrograph(audioContext, effectId);
    case 'stereomatrix':
      return new StereoMatrix(audioContext, effectId);
    case 'peakcontroller':
      return new PeakController(audioContext, effectId);
    case 'dynamicsprocessor':
      return new DynamicsProcessor(audioContext, effectId);
    case 'phaser':
      return new Phaser(audioContext, effectId);
    case 'eq3band':
      return new EQ3Band(audioContext, effectId);
    case 'reverbsc':
      return new ReverbSC(audioContext, effectId);
    case 'dispersion':
      return new Dispersion(audioContext, effectId);
    case 'granularpitchshifter':
      return new GranularPitchShifter(audioContext, effectId);
    case 'lomm':
      return new LOMM(audioContext, effectId);
    case 'slewdistortion':
      return new SlewDistortion(audioContext, effectId);
    case 'filter':
      return new DualFilter(audioContext, effectId);
    case 'limiter':
      return new DynamicsProcessor(audioContext, effectId);
    default:
      console.warn(`Unknown effect type: ${effectType}`);
      return null;
  }
};

export const Sidebar = memo(() => {
  const { sidebarOpen, sidebarWidth, setSidebarWidth } = useUIStore();
  const { tracks, patterns, selectedTrackId, createPattern } = useSongStore();
  const [activeTab, setActiveTab] = useState<SidebarTab>('instruments');
  const [searchQuery, setSearchQuery] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const [loadedSamples, setLoadedSamples] = useState<LoadedSample[]>([]);
  const [previewingAudio, setPreviewingAudio] = useState<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Instrument definitions - Complete list of all 22 instruments
  const instruments: BrowserItem[] = useMemo(() => [
    // Synthesizers
    { id: 'triple-osc', name: 'TripleOscillator', category: 'Synthétiseur', type: 'instrument', description: 'Synthétiseur classique à 3 oscillateurs' },
    { id: 'bitinvader', name: 'BitInvader', category: 'Synthétiseur', type: 'instrument', description: 'Synthétiseur à tables d’ondes avec formes d’onde dessinables' },
    { id: 'organic', name: 'Organic', category: 'Synthétiseur', type: 'instrument', description: 'Synthétiseur d’orgue additif à 8 harmoniques' },
    { id: 'monstro', name: 'Monstro', category: 'Synthétiseur', type: 'instrument', description: 'Puissant synthétiseur soustractif à 3 oscillateurs' },
    { id: 'vibed', name: 'Vibed', category: 'Synthétiseur', type: 'instrument', description: 'Synthétiseur de modélisation physique de cordes vibrantes' },
    { id: 'watsyn', name: 'Watsyn', category: 'Synthétiseur', type: 'instrument', description: 'Synthétiseur à tables d’ondes à 4 oscillateurs' },
    { id: 'xpressive', name: 'Xpressive', category: 'Synthétiseur', type: 'instrument', description: 'Synthétiseur expressif avec modulation' },
    { id: 'zynaddsubfx', name: 'ZynAddSubFX', category: 'Synthétiseur', type: 'instrument', description: 'Synthétiseur logiciel avancé' },
    { id: 'opulenz', name: 'OpulenZ', category: 'Synthétiseur', type: 'instrument', description: 'Synthétiseur FM OPL2/OPL3' },
    
    // Bass
    { id: 'lb302', name: 'LB302', category: 'Basse', type: 'instrument', description: 'Synthétiseur de basse style TB-303' },
    
    // Drums
    { id: 'kicker', name: 'Kicker', category: 'Batterie', type: 'instrument', description: 'Synthétiseur de grosse caisse' },
    
    // Samplers
    { id: 'sample-player', name: 'AudioFileProcessor', category: 'Échantillonneur', type: 'instrument', description: 'Instrument de lecture d’échantillons' },
    { id: 'gigplayer', name: 'GigPlayer', category: 'Échantillonneur', type: 'instrument', description: 'Lecteur d’échantillons au format GIG' },
    { id: 'patman', name: 'Patman', category: 'Échantillonneur', type: 'instrument', description: 'Lecteur d’échantillons au format PAT' },
    { id: 'sf2player', name: 'SF2Player', category: 'Échantillonneur', type: 'instrument', description: 'Lecteur SoundFont 2' },
    { id: 'slicert', name: 'SlicerT', category: 'Échantillonneur', type: 'instrument', description: 'Instrument de découpe de beats' },
    
    // Sound Effects
    { id: 'sfxr', name: 'Sfxr', category: 'Effets sonores', type: 'instrument', description: 'Générateur d’effets sonores rétro' },
    
    // Chiptune
    { id: 'nes', name: 'Nes', category: 'Chiptune', type: 'instrument', description: 'Émulateur de puce sonore NES/Famicom' },
    { id: 'freeboy', name: 'FreeBoy', category: 'Chiptune', type: 'instrument', description: 'Émulateur de puce sonore Game Boy' },
    { id: 'sid', name: 'Sid', category: 'Chiptune', type: 'instrument', description: 'Émulateur de puce SID (C64)' },
    
    // Physical Modeling
    { id: 'mallets', name: 'Mallets', category: 'Modélisation physique', type: 'instrument', description: 'Percussions à maillets en modélisation physique' },
    { id: 'stk', name: 'Stk', category: 'Modélisation physique', type: 'instrument', description: 'Instruments du Synthesis ToolKit' },
  ], []);

  // Effect definitions - Complete list of all effects
  const effects: BrowserItem[] = useMemo(() => [
    // Spatial
    { id: 'reverb', name: 'Reverb', category: 'Spatialisation', type: 'effect', description: 'Effet de réverbération de salle' },
    { id: 'reverbsc', name: 'ReverbSC', category: 'Spatialisation', type: 'effect', description: 'Algorithme de réverbération Sean Costello' },
    { id: 'delay', name: 'Delay', category: 'Temps', type: 'effect', description: 'Effet d’écho/délai' },
    { id: 'multitapecho', name: 'MultitapEcho', category: 'Temps', type: 'effect', description: 'Effet de délai multi-tap' },
    
    // Dynamics
    { id: 'compressor', name: 'Compressor', category: 'Dynamique', type: 'effect', description: 'Compresseur de dynamique' },
    { id: 'limiter', name: 'Limiter', category: 'Dynamique', type: 'effect', description: 'Limiteur de crête' },
    { id: 'dynamicsprocessor', name: 'DynamicsProcessor', category: 'Dynamique', type: 'effect', description: 'Processeur de dynamique avancé' },
    { id: 'peakcontroller', name: 'PeakController', category: 'Dynamique', type: 'effect', description: 'Contrôleur de niveau de crête' },
    
    // Filter/EQ
    { id: 'eq', name: 'Equalizer', category: 'Filtre', type: 'effect', description: 'Égaliseur paramétrique' },
    { id: 'eq3band', name: 'EQ3Band', category: 'Filtre', type: 'effect', description: 'Égaliseur 3 bandes' },
    { id: 'crossovereq', name: 'CrossoverEQ', category: 'Filtre', type: 'effect', description: 'Égaliseur de crossover' },
    { id: 'filter', name: 'Filter', category: 'Filtre', type: 'effect', description: 'Filtre multi-modes' },
    { id: 'dualfilter', name: 'DualFilter', category: 'Filtre', type: 'effect', description: 'Effet de filtre double' },
    { id: 'bassbooster', name: 'BassBooster', category: 'Filtre', type: 'effect', description: 'Amplificateur de basses fréquences' },
    
    // Modulation
    { id: 'chorus', name: 'Chorus', category: 'Modulation', type: 'effect', description: 'Effet chorus' },
    { id: 'flanger', name: 'Flanger', category: 'Modulation', type: 'effect', description: 'Effet flanger' },
    { id: 'phaser', name: 'Phaser', category: 'Modulation', type: 'effect', description: 'Effet phaser' },
    
    // Distortion
    { id: 'distortion', name: 'Distortion', category: 'Distorsion', type: 'effect', description: 'Distorsion/overdrive' },
    { id: 'bitcrush', name: 'Bitcrush', category: 'Distorsion', type: 'effect', description: 'Bit crusher/réducteur de fréquence d’échantillonnage' },
    { id: 'waveshaper', name: 'Waveshaper', category: 'Distorsion', type: 'effect', description: 'Distorsion par waveshaping' },
    { id: 'slewdistortion', name: 'SlewDistortion', category: 'Distorsion', type: 'effect', description: 'Distorsion de slew rate' },
    
    // Stereo
    { id: 'stereoenhancer', name: 'StereoEnhancer', category: 'Stéréo', type: 'effect', description: 'Amélioration de la largeur stéréo' },
    { id: 'stereomatrix', name: 'StereoMatrix', category: 'Stéréo', type: 'effect', description: 'Processeur de matrice stéréo' },
    
    // Utility
    { id: 'amplifier', name: 'Amplifier', category: 'Utilitaires', type: 'effect', description: 'Amplificateur de volume' },
    { id: 'spectrograph', name: 'Spectrograph', category: 'Utilitaires', type: 'effect', description: 'Analyseur de spectre' },
    
    // Special
    { id: 'dispersion', name: 'Dispersion', category: 'Spécial', type: 'effect', description: 'Effet de dispersion' },
    { id: 'granularpitchshifter', name: 'GranularPitchShifter', category: 'Spécial', type: 'effect', description: 'Pitch shifter granulaire' },
    { id: 'lomm', name: 'LOMM', category: 'Spécial', type: 'effect', description: 'Limiteur/maximiseur à anticipation' },
  ], []);

  // Filter items based on search
  const filteredInstruments = useMemo(() => {
    if (!searchQuery) return instruments;
    const query = searchQuery.toLowerCase();
    return instruments.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  }, [instruments, searchQuery]);

  const filteredEffects = useMemo(() => {
    if (!searchQuery) return effects;
    const query = searchQuery.toLowerCase();
    return effects.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  }, [effects, searchQuery]);

  // Group items by category
  const groupedInstruments = useMemo(() => {
    const groups: Record<string, BrowserItem[]> = {};
    filteredInstruments.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredInstruments]);

  const groupedEffects = useMemo(() => {
    const groups: Record<string, BrowserItem[]> = {};
    filteredEffects.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredEffects]);

  // Resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      setSidebarWidth(Math.max(180, Math.min(400, startWidth + delta)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth, setSidebarWidth]);

  // Map sidebar item IDs to InstrumentType values
  const instrumentTypeMap: Record<string, string> = {
    'triple-osc': 'tripleoscillator',
    'bitinvader': 'bitinvader',
    'kicker': 'kicker',
    'sample-player': 'audiofileprocessor',
    'organic': 'organic',
    'lb302': 'lb302',
    'sfxr': 'oscillator',
    'zynaddsubfx': 'monstro',
    'monstro': 'monstro',
    'vibed': 'vibed',
    'watsyn': 'watsyn',
    'xpressive': 'xpressive',
    'mallets': 'mallets',
    'opulenz': 'oscillator',
    'gigplayer': 'audiofileprocessor',
    'patman': 'audiofileprocessor',
    'sf2player': 'audiofileprocessor',
    'slicert': 'audiofileprocessor',
    'nes': 'oscillator',
    'freeboy': 'oscillator',
    'sid': 'oscillator',
    'stk': 'mallets',
  };

  // Handle adding effect to selected track
  const handleAddEffectToTrack = useCallback((effectType: string) => {
    const songStore = useSongStore.getState();
    const trackId = songStore.selectedTrackId;
    
    if (!trackId) {
      console.warn('No track selected. Please select a track first.');
      return;
    }
    
    const track = songStore.tracks.find(t => t.id === trackId);
    if (!track) {
      console.warn('Selected track not found.');
      return;
    }
    
    try {
      const audioEngine = AudioEngineManager.getInstance();
      if (!audioEngine.isInitialized()) {
        console.warn('Audio engine not initialized. Please start playback first.');
        return;
      }
      
      // Get the audio context from the audio engine
      const audioContext = (audioEngine as any).audioEngine?.getContext();
      if (!audioContext) {
        console.warn('Audio context not available.');
        return;
      }
      
      // Create the effect
      const effect = createEffect(effectType, audioContext);
      if (!effect) {
        console.warn(`Failed to create effect: ${effectType}`);
        return;
      }
      
      // Add effect to the track's mixer channel
      const mixerChannelId = track.mixerChannelId;
      const success = audioEngine.addEffectToChannel(mixerChannelId, effect);
      
      if (success) {
        console.log(`Added ${effectType} effect to track: ${track.name}`);
      } else {
        console.warn(`Failed to add ${effectType} effect to track: ${track.name}`);
      }
    } catch (error) {
      console.error('Error adding effect to track:', error);
    }
  }, []);

  const handleItemDoubleClick = useCallback((item: BrowserItem) => {
    console.log('Add item to project:', item);
    
    if (item.type === 'instrument') {
      // Add instrument track to the project
      const { addInstrumentTrack, tracks } = useSongStore.getState();
      const colors = ['#8286ef', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#f97316'];
      const trackCount = tracks.length;
      // Map the sidebar item ID to the correct InstrumentType
      const instrumentType = instrumentTypeMap[item.id] || 'oscillator';
      addInstrumentTrack(item.name, instrumentType as import('../../audio/InstrumentFactory').InstrumentType, colors[trackCount % colors.length]);
    } else if (item.type === 'effect') {
      // Add effect to selected track's effect chain
      handleAddEffectToTrack(item.id);
    }
  }, [handleAddEffectToTrack]);

  // Handle file browse button click
  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      // Validate file type
      const validTypes = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/flac', 'audio/x-wav', 'audio/mp3'];
      const validExtensions = ['.wav', '.mp3', '.ogg', '.flac'];
      const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (!validTypes.includes(file.type) && !validExtensions.includes(extension)) {
        console.warn(`Unsupported file type: ${file.name}`);
        return;
      }

      // Create object URL for the file
      const url = URL.createObjectURL(file);
      
      // Create audio element to get duration
      const audio = new Audio();
      audio.src = url;
      
      audio.addEventListener('loadedmetadata', () => {
        const newSample: LoadedSample = {
          id: `sample-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          path: url,
          duration: audio.duration,
          size: file.size,
          type: file.type || extension.replace('.', 'audio/')
        };
        
        setLoadedSamples(prev => [...prev, newSample]);
        console.log('Sample loaded:', newSample);
      });

      audio.addEventListener('error', () => {
        console.error(`Failed to load audio file: ${file.name}`);
        URL.revokeObjectURL(url);
      });
    });

    // Reset input so the same file can be selected again
    e.target.value = '';
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // Create a synthetic event to reuse handleFileSelect logic
    const syntheticEvent = {
      target: { files, value: '' }
    } as React.ChangeEvent<HTMLInputElement>;
    
    handleFileSelect(syntheticEvent);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Format file size
  const formatSize = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  // Format duration
  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Handle sample preview (play audio on click)
  const handleSamplePreview = useCallback((sample: LoadedSample) => {
    // Stop any currently playing preview
    if (previewingAudio) {
      previewingAudio.pause();
      previewingAudio.currentTime = 0;
    }
    
    // Try to use AudioEngineManager's sample player first
    try {
      const audioEngine = AudioEngineManager.getInstance();
      if (audioEngine.isInitialized()) {
        const samplePlayer = audioEngine.getSamplePlayer();
        if (samplePlayer) {
          // Check if sample is already loaded in the engine
          if (audioEngine.hasSample(sample.id)) {
            audioEngine.playSamplePreview(sample.id, 1.0);
            return;
          }
        }
      }
    } catch (error) {
      // Audio engine not initialized, fall back to HTML5 Audio
    }
    
    // Fallback: Use HTML5 Audio for preview
    const audio = new Audio(sample.path);
    audio.volume = 0.8;
    audio.play().catch(err => {
      console.error('Failed to play sample preview:', err);
    });
    
    setPreviewingAudio(audio);
    
    // Clean up when audio ends
    audio.addEventListener('ended', () => {
      setPreviewingAudio(null);
    });
  }, [previewingAudio]);

  // Handle sample drag start for drag-and-drop to tracks
  const handleSampleDragStart = useCallback((e: React.DragEvent, sample: LoadedSample) => {
    const { type: _fileType, ...sampleData } = sample;
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'sample',
      ...sampleData,
      fileType: sample.type
    }));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Handle creating a new pattern
  const handleCreatePattern = useCallback(() => {
    const songStore = useSongStore.getState();
    const trackId = songStore.selectedTrackId;
    
    // If no track is selected, use the first track or create a default pattern
    const targetTrackId = trackId || (songStore.tracks.length > 0 ? songStore.tracks[0].id : '');
    
    if (!targetTrackId) {
      console.warn('No tracks available. Please create a track first.');
      return;
    }
    
    const patternCount = songStore.patterns.length;
    const patternName = `Pattern ${patternCount + 1}`;
    
    createPattern(targetTrackId, patternName, 64);
    console.log(`Created new pattern: ${patternName}`);
  }, [createPattern]);

  if (!sidebarOpen) return null;

  const tabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'instruments',
      label: 'Instruments',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      ),
    },
    {
      id: 'samples',
      label: 'Samples',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      ),
    },
    {
      id: 'effects',
      label: 'Effets',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 18h2V6H7v12zm4 4h2V2h-2v20zm-8-8h2v-4H3v4zm12 4h2V6h-2v12zm4-8v4h2v-4h-2z" />
        </svg>
      ),
    },
    {
      id: 'controllers',
      label: 'Contrôleurs',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
    },
    {
      id: 'project',
      label: 'Projet',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
    },
  ];

  return (
    <aside
      className="bg-daw-bg-secondary border-r border-daw-border flex flex-col relative select-none"
      style={{ width: sidebarWidth }}
    >
      {/* Tab bar */}
      <div className="flex border-b border-daw-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1 px-1 py-2 text-xs transition-colors ${
              activeTab === tab.id
                ? 'bg-daw-bg-surface text-daw-text-primary border-b-2 border-daw-accent-primary -mb-px'
                : 'text-daw-text-muted hover:text-daw-text-secondary hover:bg-daw-bg-surface/50'
            }`}
            title={tab.label}
          >
            {tab.icon}
            <span className="hidden xl:inline truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="p-2 border-b border-daw-border">
        <div className="relative">
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-daw-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-daw-bg-primary border border-daw-border rounded pl-7 pr-2 py-1 text-sm text-daw-text-primary placeholder-daw-text-muted focus:outline-none focus:ring-1 focus:ring-daw-accent-primary"
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-daw-text-muted hover:text-daw-text-secondary"
              onClick={() => setSearchQuery('')}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'instruments' && (
          <div className="py-1">
            {Object.entries(groupedInstruments).map(([category, items]) => (
              <CollapsibleSection key={category} title={category} count={items.length}>
                {items.map((item) => (
                  <BrowserItemComponent
                    key={item.id}
                    item={item}
                    onDoubleClick={handleItemDoubleClick}
                  />
                ))}
              </CollapsibleSection>
            ))}
            {filteredInstruments.length === 0 && (
              <div className="p-4 text-center text-daw-text-muted text-sm">
                Aucun instrument trouvé
              </div>
            )}
          </div>
        )}

        {activeTab === 'samples' && (
          <div className="p-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.mp3,.ogg,.flac,audio/*"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            
            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-daw-border rounded-lg p-4 mb-3 hover:border-daw-accent-primary/50 transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={handleBrowseClick}
            >
              <svg className="w-8 h-8 mx-auto mb-2 text-daw-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-daw-text-muted text-sm text-center">Déposez des fichiers audio ici</p>
              <p className="text-daw-text-muted text-xs mt-1 text-center">WAV, MP3, OGG, FLAC</p>
            </div>
            
            <Button variant="secondary" size="sm" fullWidth onClick={handleBrowseClick}>
              Parcourir les fichiers...
            </Button>

            {/* Built-in sample library (./samples -> public/samples) */}
            <div className="mt-3 h-96 overflow-hidden rounded-lg bg-daw-bg-secondary border border-daw-border">
              <SampleBrowser
                audioContext={(() => {
                  try {
                    const engine = AudioEngineManager.getInstance();
                    if (!engine.isInitialized()) return null;
                    return (engine as any).audioEngine?.getContext() ?? null;
                  } catch {
                    return null;
                  }
                })()}
              />
            </div>

            {/* Loaded samples list */}
            {loadedSamples.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-daw-text-muted mb-2 px-1">
                  Samples chargés ({loadedSamples.length})
                </div>
                <div className="space-y-1">
                  {loadedSamples.map(sample => (
                    <div
                      key={sample.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded cursor-grab hover:bg-daw-bg-surface active:cursor-grabbing transition-colors group"
                      draggable
                      onDragStart={(e) => handleSampleDragStart(e, sample)}
                      onClick={() => handleSamplePreview(sample)}
                      title={`${sample.name}\nDurée: ${formatDuration(sample.duration)}\nTaille: ${formatSize(sample.size)}\nCliquer pour préécouter`}
                    >
                      <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-green-500/20 text-green-400">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-daw-text-primary truncate group-hover:text-white transition-colors">
                          {sample.name}
                        </div>
                        <div className="text-[10px] text-daw-text-muted">
                          {formatDuration(sample.duration)} • {formatSize(sample.size)}
                        </div>
                      </div>
                      {/* Play indicator */}
                      <div className="w-4 h-4 flex items-center justify-center text-green-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'effects' && (
          <div className="py-1">
            {selectedTrackId && (
              <div className="px-2 py-1 mb-1 text-xs text-daw-text-muted bg-daw-bg-surface/50">
                Double-cliquez pour ajouter un effet à la piste sélectionnée
              </div>
            )}
            {!selectedTrackId && (
              <div className="px-2 py-1 mb-1 text-xs text-yellow-500/80 bg-yellow-500/10">
                Sélectionnez d’abord une piste pour ajouter des effets
              </div>
            )}
            {Object.entries(groupedEffects).map(([category, items]) => (
              <CollapsibleSection key={category} title={category} count={items.length}>
                {items.map((item) => (
                  <BrowserItemComponent
                    key={item.id}
                    item={item}
                    onDoubleClick={handleItemDoubleClick}
                  />
                ))}
              </CollapsibleSection>
            ))}
            {filteredEffects.length === 0 && (
              <div className="p-4 text-center text-daw-text-muted text-sm">
                Aucun effet trouvé
              </div>
            )}
          </div>
        )}

        {activeTab === 'controllers' && (
        <div className="flex-1 overflow-hidden">
          <ControllerRack />
        </div>
      )}

      {activeTab === 'project' && (
          <div className="py-1">
            <CollapsibleSection title="Pistes" count={tracks.length}>
              {tracks.length === 0 ? (
                <div className="px-3 py-2 text-xs text-daw-text-muted">Aucune piste</div>
              ) : (
                tracks.map((track) => (
                  <div
                    key={track.id}
                    className={`flex items-center gap-2 px-3 py-1.5 mx-1 rounded cursor-pointer hover:bg-daw-bg-surface text-sm ${
                      selectedTrackId === track.id ? 'bg-daw-bg-surface ring-1 ring-daw-accent-primary' : ''
                    }`}
                    onClick={() => useSongStore.getState().setSelectedTrackId(track.id)}
                  >
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: track.color }}
                    />
                    <span className="text-daw-text-primary truncate">{track.name}</span>
                  </div>
                ))
              )}
            </CollapsibleSection>
            
            <CollapsibleSection 
              title="Patterns" 
              count={patterns.length}
              action={
                <button
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-daw-accent-primary/20 text-daw-text-muted hover:text-daw-accent-primary transition-colors"
                  onClick={handleCreatePattern}
                  title="Créer un nouveau pattern"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              }
            >
              {patterns.length === 0 ? (
                <div className="px-3 py-2">
                  <div className="text-xs text-daw-text-muted mb-2">Aucun pattern</div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    fullWidth 
                    onClick={handleCreatePattern}
                  >
                    + Nouveau pattern
                  </Button>
                </div>
              ) : (
                patterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    className="flex items-center gap-2 px-3 py-1.5 mx-1 rounded cursor-pointer hover:bg-daw-bg-surface text-sm"
                    onClick={() => useSongStore.getState().setSelectedPatternId(pattern.id)}
                  >
                    <svg className="w-3.5 h-3.5 text-daw-text-muted" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
                    </svg>
                    <span className="text-daw-text-primary truncate">{pattern.name}</span>
                  </div>
                ))
              )}
            </CollapsibleSection>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        className={`absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-daw-accent-primary/50 transition-colors ${isResizing ? 'bg-daw-accent-primary' : ''}`}
        onMouseDown={handleResizeStart}
      />
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;
