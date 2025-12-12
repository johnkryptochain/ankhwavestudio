// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * InstrumentRack - Conteneur pour les plugins d'instruments
 * Fonctionnalités : Liste des instruments chargés, bouton d'ajout d'instrument, menu déroulant de préréglages,
 * réduire/agrandir les instruments, glisser pour réorganiser
 */

import React, { useState, useCallback, memo } from 'react';
import { Button } from '../common';

export interface InstrumentInstance {
  id: string;
  type: string;
  name: string;
  preset?: string;
  minimized: boolean;
  enabled: boolean;
}

interface InstrumentRackProps {
  trackId?: string;
  instruments?: InstrumentInstance[];
  onInstrumentAdd?: (type: string) => void;
  onInstrumentRemove?: (instrumentId: string) => void;
  onInstrumentToggle?: (instrumentId: string, enabled: boolean) => void;
  onInstrumentMinimize?: (instrumentId: string, minimized: boolean) => void;
  onInstrumentReorder?: (fromIndex: number, toIndex: number) => void;
  onPresetChange?: (instrumentId: string, preset: string) => void;
  onClose?: () => void;
  className?: string;
}

const AVAILABLE_INSTRUMENTS = [
  { type: 'triple-oscillator', name: 'Triple Oscillateur', icon: '🎹' },
  { type: 'sample-player', name: 'Lecteur d\'échantillons', icon: '🎵' },
  { type: 'bitinvader', name: 'BitInvader', icon: '👾' },
  { type: 'kicker', name: 'Kicker', icon: '🥁' },
  { type: 'lb302', name: 'LB302', icon: '🎸' },
  { type: 'mallets', name: 'Mallets', icon: '🔔' },
  { type: 'organic', name: 'Organic', icon: '🌿' },
  { type: 'sfxr', name: 'Sfxr', icon: '🎮' },
];

export const InstrumentRack: React.FC<InstrumentRackProps> = memo(({
  trackId,
  instruments = [],
  onInstrumentAdd,
  onInstrumentRemove,
  onInstrumentToggle,
  onInstrumentMinimize,
  onInstrumentReorder,
  onPresetChange,
  onClose,
  className = '',
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Gérer l'ajout d'instrument
  const handleAddInstrument = useCallback((type: string) => {
    onInstrumentAdd?.(type);
    setShowAddMenu(false);
  }, [onInstrumentAdd]);

  // Gérer le début du glissement
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  // Gérer le survol pendant le glissement
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      setDragOverIndex(index);
    }
  }, [dragIndex]);

  // Gérer la fin du glissement
  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      onInstrumentReorder?.(dragIndex, dragOverIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverIndex, onInstrumentReorder]);

  // Afficher un élément d'instrument
  const renderInstrument = (instrument: InstrumentInstance, index: number) => {
    const isDragging = dragIndex === index;
    const isDragOver = dragOverIndex === index;

    return (
      <div
        key={instrument.id}
        className={`bg-daw-bg-surface rounded-lg overflow-hidden transition-all ${
          isDragging ? 'opacity-50' : ''
        } ${isDragOver ? 'ring-2 ring-daw-accent-primary' : ''}`}
        draggable
        onDragStart={() => handleDragStart(index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragEnd={handleDragEnd}
      >
        {/* En-tête de l'instrument */}
        <div className="flex items-center gap-2 p-2 bg-daw-bg-elevated cursor-move">
          {/* Bouton d'activation */}
          <button
            onClick={() => onInstrumentToggle?.(instrument.id, !instrument.enabled)}
            className={`w-4 h-4 rounded-full transition-colors ${
              instrument.enabled ? 'bg-green-500' : 'bg-daw-bg-primary'
            }`}
            title={instrument.enabled ? 'Désactiver' : 'Activer'}
          />

          {/* Nom de l'instrument */}
          <span className={`text-sm font-medium flex-1 ${
            instrument.enabled ? 'text-daw-text-primary' : 'text-daw-text-muted'
          }`}>
            {instrument.name}
          </span>

          {/* Sélecteur de préréglage */}
          <select
            value={instrument.preset || ''}
            onChange={(e) => onPresetChange?.(instrument.id, e.target.value)}
            className="bg-daw-bg-primary border border-daw-border rounded px-1 py-0.5 text-xxs text-daw-text-primary"
          >
            <option value="">Par défaut</option>
            <option value="preset1">Préréglage 1</option>
            <option value="preset2">Préréglage 2</option>
            <option value="preset3">Préréglage 3</option>
          </select>

          {/* Bouton réduire */}
          <button
            onClick={() => onInstrumentMinimize?.(instrument.id, !instrument.minimized)}
            className="p-1 text-daw-text-muted hover:text-daw-text-secondary"
            title={instrument.minimized ? 'Agrandir' : 'Réduire'}
          >
            <svg className={`w-3 h-3 transition-transform ${instrument.minimized ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Bouton supprimer */}
          <button
            onClick={() => onInstrumentRemove?.(instrument.id)}
            className="p-1 text-daw-text-muted hover:text-daw-accent-danger"
            title="Supprimer"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenu de l'instrument (quand agrandi) */}
        {!instrument.minimized && (
          <div className="p-3 border-t border-daw-border">
            {/* Espace réservé pour l'interface de l'instrument - afficherait le composant réel */}
            <div className="text-center text-daw-text-muted py-4">
              <span className="text-2xl block mb-2">
                {AVAILABLE_INSTRUMENTS.find(i => i.type === instrument.type)?.icon || '🎹'}
              </span>
              <span className="text-xs">Interface {instrument.type}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-daw-bg-secondary ${className}`}>
      {/* En-tête */}
      <div className="flex items-center justify-between p-2 border-b border-daw-border bg-daw-bg-elevated">
        <span className="text-sm font-medium text-daw-text-primary">Rack d'instruments</span>
        <div className="flex items-center gap-2">
          {trackId && (
            <span className="text-xxs text-daw-text-muted">Piste : {trackId}</span>
          )}
          <button 
            onClick={onClose}
            className="text-daw-text-muted hover:text-daw-text-secondary p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-auto p-2">
        {!trackId ? (
          <div className="flex items-center justify-center h-full text-daw-text-muted">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <p className="text-sm">Sélectionnez une piste pour voir ses instruments</p>
            </div>
          </div>
        ) : instruments.length === 0 ? (
          <div className="flex items-center justify-center h-full text-daw-text-muted">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v16m8-8H4" />
              </svg>
              <p className="text-sm mb-2">Aucun instrument chargé</p>
              <p className="text-xs mb-4">Ajoutez un instrument pour commencer</p>
              <Button size="sm" onClick={() => setShowAddMenu(true)}>
                + Ajouter un instrument
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {instruments.map((instrument, index) => renderInstrument(instrument, index))}
          </div>
        )}
      </div>

      {/* Bouton d'ajout d'instrument */}
      {trackId && instruments.length > 0 && (
        <div className="p-2 border-t border-daw-border">
          <div className="relative">
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={() => setShowAddMenu(!showAddMenu)}
            >
              + Ajouter un instrument
            </Button>

            {showAddMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-daw-bg-elevated border border-daw-border rounded shadow-lg z-50 max-h-48 overflow-auto">
                {AVAILABLE_INSTRUMENTS.map(inst => (
                  <button
                    key={inst.type}
                    onClick={() => handleAddInstrument(inst.type)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-daw-text-primary hover:bg-daw-bg-surface"
                  >
                    <span>{inst.icon}</span>
                    <span>{inst.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cliquer à l'extérieur pour fermer le menu */}
      {showAddMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowAddMenu(false)}
        />
      )}
    </div>
  );
});

InstrumentRack.displayName = 'InstrumentRack';

export default InstrumentRack;
