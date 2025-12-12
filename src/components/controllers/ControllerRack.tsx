// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
﻿import React, { useState } from 'react';
import { useControllerStore, ControllerType } from '../../stores/controllerStore';
import { LfoControllerView } from './LfoControllerView';
import { PeakControllerView } from './PeakControllerView';
import { EnvelopeControllerView } from './EnvelopeControllerView';
import { MIDIControllerView } from './MIDIControllerView';
import { Button } from '../common';

export const ControllerRack: React.FC = () => {
  const { controllers, createController, deleteController } = useControllerStore();
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Convert object to array if needed (handling both array and record structures)
  const controllerList = Array.isArray(controllers) 
    ? controllers 
    : Object.values(controllers || {});

  return (
    <div className="flex flex-col h-full bg-daw-bg-secondary border-r border-daw-border w-full">
      <div className="flex items-center justify-between p-3 border-b border-daw-border bg-daw-bg-tertiary">
        <div className="flex items-center gap-2">
          <span className="text-lg"></span>
          <h2 className="text-xs font-bold text-daw-text-primary uppercase tracking-wider">Rack de contrôleurs</h2>
        </div>
        <div className="relative">
          <Button 
            size="sm" 
            variant="primary"
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-1 bg-daw-accent-primary hover:bg-daw-accent-hover text-white shadow-lg shadow-daw-accent-glow"
          >
            <span className="text-lg leading-none">+</span> Ajouter
          </Button>
          
          {showAddMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)}></div>
              <div className="absolute right-0 top-full mt-2 w-40 bg-daw-bg-elevated border border-daw-border rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 text-[10px] font-bold text-daw-text-muted uppercase tracking-wider bg-daw-bg-tertiary border-b border-daw-border">
                  Nouveau contrôleur
                </div>
                                <button 
                  className="w-full text-left px-3 py-2.5 text-xs hover:bg-daw-bg-hover text-daw-text-primary transition-colors flex items-center gap-2"
                  onClick={() => { createController(ControllerType.LFO); setShowAddMenu(false); }}
                >
                  <span className="text-daw-accent-primary">∿</span> Contrôleur LFO
                </button>
                <button 
                  className="w-full text-left px-3 py-2.5 text-xs hover:bg-daw-bg-hover text-daw-text-primary transition-colors flex items-center gap-2"
                  onClick={() => { createController(ControllerType.Peak); setShowAddMenu(false); }}
                >
                  <span className="text-daw-accent-warning">📈</span> Contrôleur de crête
                </button>
                <button 
                  className="w-full text-left px-3 py-2.5 text-xs hover:bg-daw-bg-hover text-daw-text-primary transition-colors flex items-center gap-2"
                  onClick={() => { createController(ControllerType.Envelope); setShowAddMenu(false); }}
                >
                  <span className="text-daw-accent-error">📉</span> Contrôleur d’enveloppe
                </button>
                <button 
                  className="w-full text-left px-3 py-2.5 text-xs hover:bg-daw-bg-hover text-daw-text-primary transition-colors flex items-center gap-2"
                  onClick={() => { createController(ControllerType.MIDI); setShowAddMenu(false); }}
                >
                  <span className="text-daw-accent-info">🎹</span> Contrôleur MIDI
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-daw-bg-active scrollbar-track-transparent">
        {controllerList.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-center p-4 border-2 border-dashed border-daw-border-light rounded-xl bg-daw-bg-surface/50">
            <span className="text-2xl mb-2 opacity-50"></span>
            <p className="text-sm font-medium text-daw-text-secondary">Aucun contrôleur</p>
            <p className="text-xs text-daw-text-muted mt-1">Ajoutez un contrôleur pour commencer à moduler des paramètres</p>
          </div>
        )}

        {controllerList.map((controller) => (
          <div key={controller.id} className="relative group animate-in slide-in-from-left-2 duration-200">
            <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button 
                className="w-6 h-6 flex items-center justify-center rounded-full bg-daw-bg-tertiary text-daw-text-muted hover:text-daw-error hover:bg-daw-bg-elevated transition-colors shadow-sm border border-daw-border"
                onClick={() => deleteController(controller.id)}
                title="Supprimer le contrôleur"
              >
                ×
              </button>
            </div>
            
            {controller.type === ControllerType.LFO && (
              <LfoControllerView controller={controller as any} />
            )}
            {controller.type === ControllerType.Peak && (
              <PeakControllerView controller={controller as any} />
            )}
            {controller.type === ControllerType.Envelope && (
              <EnvelopeControllerView controller={controller as any} />
            )}
            {controller.type === ControllerType.MIDI && (
              <MIDIControllerView controller={controller as any} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ControllerRack;
