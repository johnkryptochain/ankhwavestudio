// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * MixerView - Full mixer console
 * Features: Scrollable channel strip container, master channel, add channel button,
 * channel reordering (drag-and-drop), group/bus channels, send return channels
 */

import React, { useState, useCallback, useRef, memo } from 'react';
import { useMixerStore, useChannels, useMasterChannel, useHistoryStore } from '../../stores';
import { MixerChannel } from './MixerChannel';
import { Button } from '../common';
import type { MixerChannelData } from '../../types/song';
import { generateCommandId } from '../../utils/commands/Command';

interface DragState {
  channelId: string;
  startIndex: number;
  currentIndex: number;
}

export const MixerView: React.FC = memo(() => {
  const channels = useChannels();
  const masterChannel = useMasterChannel();
  const { addChannel, removeChannel, reorderChannels } = useMixerStore();
  const { executeCommand } = useHistoryStore();
  
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'full' | 'compact'>('full');
  const containerRef = useRef<HTMLDivElement>(null);

  // Add different channel types with undo support
  const handleAddChannel = useCallback((type: 'audio' | 'bus' | 'send' = 'audio') => {
    const colors = ['#8286ef', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#84cc16'];
    const channelCount = channels.filter(c => c.type === type).length;
    const channelId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const channelTypeLabel = type === 'audio' ? 'Audio' : type === 'bus' ? 'Bus' : 'Envoi';
    const channelName = `${channelTypeLabel} ${channelCount + 1}`;
    
    const newChannel: MixerChannelData = {
      id: channelId,
      name: channelName,
      type,
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      color: colors[channels.length % colors.length],
      effects: [],
      sends: [],
    };
    
    executeCommand({
      id: generateCommandId(),
      description: `Ajouter un canal ${channelTypeLabel.toLowerCase()} "${channelName}"`,
      timestamp: Date.now(),
      execute: () => {
        useMixerStore.getState().addChannel(newChannel);
      },
      undo: () => {
        useMixerStore.getState().removeChannel(channelId);
      },
    });
    setShowAddMenu(false);
  }, [channels, executeCommand]);

  // Handle drag start
  const handleDragStart = useCallback((channelId: string, index: number) => {
    setDragState({
      channelId,
      startIndex: index,
      currentIndex: index,
    });
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((index: number) => {
    if (dragState && dragState.currentIndex !== index) {
      setDragState(prev => prev ? { ...prev, currentIndex: index } : null);
    }
  }, [dragState]);

  // Handle drag end with undo support
  const handleDragEnd = useCallback(() => {
    if (dragState && dragState.startIndex !== dragState.currentIndex) {
      const fromIndex = dragState.startIndex;
      const toIndex = dragState.currentIndex;
      
      executeCommand({
        id: generateCommandId(),
        description: 'Réordonner les canaux de mixage',
        timestamp: Date.now(),
        execute: () => {
          useMixerStore.getState().reorderChannels(fromIndex, toIndex);
        },
        undo: () => {
          useMixerStore.getState().reorderChannels(toIndex, fromIndex);
        },
      });
    }
    setDragState(null);
  }, [dragState, executeCommand]);

  // Group channels by type
  const audioChannels = channels.filter(c => c.type === 'audio' || !c.type);
  const busChannels = channels.filter(c => c.type === 'bus');
  const sendChannels = channels.filter(c => c.type === 'send');

  // Render channel group
  const renderChannelGroup = (
    groupChannels: MixerChannelData[],
    title: string,
    startIndex: number
  ) => {
    if (groupChannels.length === 0) return null;

    return (
      <div className="flex flex-col">
        <div className="text-xxs text-daw-text-muted uppercase tracking-wider mb-2 px-1">
          {title}
        </div>
        <div className="flex gap-1">
          {groupChannels.map((channel, i) => {
            const globalIndex = startIndex + i;
            const isDragging = dragState?.channelId === channel.id;
            const isDragOver = dragState && dragState.currentIndex === globalIndex && !isDragging;

            return (
              <div
                key={channel.id}
                className={`transition-transform ${isDragging ? 'opacity-50' : ''} ${
                  isDragOver ? 'transform translate-x-2' : ''
                }`}
                draggable
                onDragStart={() => handleDragStart(channel.id, globalIndex)}
                onDragOver={(e) => {
                  e.preventDefault();
                  handleDragOver(globalIndex);
                }}
                onDragEnd={handleDragEnd}
              >
                <MixerChannel 
                  channel={channel} 
                  compact={viewMode === 'compact'}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-daw-bg-primary">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-daw-border bg-daw-bg-secondary">
        {/* Add channel dropdown */}
        <div className="relative">
          <Button
            size="sm"
            onClick={() => setShowAddMenu(!showAddMenu)}
          >
            + Ajouter un canal
            <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </Button>
          
          {showAddMenu && (
            <div className="absolute top-full left-0 mt-1 bg-daw-bg-elevated border border-daw-border rounded shadow-lg z-50">
              <button
                onClick={() => handleAddChannel('audio')}
                className="block w-full px-4 py-2 text-sm text-left text-daw-text-primary hover:bg-daw-bg-surface"
              >
                Canal audio
              </button>
              <button
                onClick={() => handleAddChannel('bus')}
                className="block w-full px-4 py-2 text-sm text-left text-daw-text-primary hover:bg-daw-bg-surface"
              >
                Canal bus
              </button>
              <button
                onClick={() => handleAddChannel('send')}
                className="block w-full px-4 py-2 text-sm text-left text-daw-text-primary hover:bg-daw-bg-surface"
              >
                Envoi/retour
              </button>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-daw-border mx-1" />

        {/* View mode toggle */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={viewMode === 'full' ? 'secondary' : 'ghost'}
            onClick={() => setViewMode('full')}
          >
            Complet
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'compact' ? 'secondary' : 'ghost'}
            onClick={() => setViewMode('compact')}
          >
            Compact
          </Button>
        </div>

        <div className="flex-1" />

        {/* Channel count */}
        <span className="text-xs text-daw-text-muted">
          {channels.length} {channels.length !== 1 ? 'canaux' : 'canal'}
        </span>
      </div>

      {/* Mixer channels */}
      <div ref={containerRef} className="flex-1 flex overflow-x-auto p-4">
        {/* Empty state */}
        {channels.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-daw-text-muted opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <p className="text-daw-text-muted mb-4">Aucun canal de mixage</p>
              <Button onClick={() => handleAddChannel('audio')}>
                + Ajouter un canal audio
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-4">
            {/* Audio channels */}
            {renderChannelGroup(audioChannels, 'Audio', 0)}

            {/* Bus channels */}
            {busChannels.length > 0 && (
              <>
                <div className="w-px bg-daw-border mx-2" />
                {renderChannelGroup(busChannels, 'Bus', audioChannels.length)}
              </>
            )}

            {/* Send/Return channels */}
            {sendChannels.length > 0 && (
              <>
                <div className="w-px bg-daw-border mx-2" />
                {renderChannelGroup(sendChannels, 'Envois', audioChannels.length + busChannels.length)}
              </>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-shrink-0 w-4" />

        {/* Master channel - always visible */}
        <div className="flex-shrink-0 border-l-2 border-daw-accent-primary pl-4 ml-auto sticky right-0 bg-daw-bg-primary">
          <div className="text-xxs text-daw-accent-primary uppercase tracking-wider mb-2 px-1">
            Master
          </div>
          <MixerChannel 
            channel={masterChannel} 
            isMaster 
            compact={viewMode === 'compact'}
          />
        </div>
      </div>

      {/* Click outside to close menu */}
      {showAddMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowAddMenu(false)}
        />
      )}
    </div>
  );
});

MixerView.displayName = 'MixerView';

export default MixerView;