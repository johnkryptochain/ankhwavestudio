// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Mixer Store - Manages mixer state
 * Connected to Audio Engine for real-time audio updates
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { MixerChannelData, MixerData, SendData } from '../types/song';
import type { EffectParams } from '../types/audio';
import { getAudioEngineManager, AudioEngineManager } from '../audio/AudioEngineManager';
import { getEffectFactory, EffectType } from '../audio/EffectFactory';
import { BaseEffect } from '../audio/effects/BaseEffect';

// Helper to get audio engine manager (may be null if not initialized)
let audioEngineManager: AudioEngineManager | null = null;

const getManager = (): AudioEngineManager | null => {
  if (!audioEngineManager) {
    try {
      audioEngineManager = getAudioEngineManager();
    } catch {
      // Audio engine not initialized yet
      return null;
    }
  }
  return audioEngineManager;
};

// Map to track audio effect instances
const effectInstances: Map<string, BaseEffect> = new Map();

interface MixerStoreState {
  // State
  channels: MixerChannelData[];
  masterChannel: MixerChannelData;
  soloedChannelIds: Set<string>;
  isAudioConnected: boolean;
  
  // Channel actions
  addChannel: (channel?: Partial<MixerChannelData>) => string;
  removeChannel: (channelId: string) => void;
  updateChannel: (channelId: string, updates: Partial<MixerChannelData>) => void;
  reorderChannels: (fromIndex: number, toIndex: number) => void;
  
  // Volume/Pan
  setChannelVolume: (channelId: string, volume: number) => void;
  setChannelPan: (channelId: string, pan: number) => void;
  
  // Mute/Solo
  setChannelMute: (channelId: string, muted: boolean) => void;
  setChannelSolo: (channelId: string, soloed: boolean) => void;
  clearAllSolo: () => void;
  
  // Effects
  addEffect: (channelId: string, effect: EffectParams) => void;
  addEffectByType: (channelId: string, effectType: EffectType, name?: string) => string | null;
  removeEffect: (channelId: string, effectId: string) => void;
  updateEffect: (channelId: string, effectId: string, updates: Partial<EffectParams>) => void;
  moveEffect: (channelId: string, effectId: string, newIndex: number) => void;
  setEffectBypass: (channelId: string, effectId: string, bypassed: boolean) => void;
  
  // Sends
  addSend: (channelId: string, targetChannelId: string, amount?: number) => void;
  removeSend: (channelId: string, targetChannelId: string) => void;
  updateSend: (channelId: string, targetChannelId: string, amount: number) => void;
  
  // Master
  setMasterVolume: (volume: number) => void;
  setMasterPan: (pan: number) => void;
  
  // Bulk operations
  loadMixerData: (data: MixerData) => void;
  getMixerData: () => MixerData;
  resetMixer: () => void;
  
  // Audio engine connection
  connectAudioEngine: () => void;
  disconnectAudioEngine: () => void;
  syncToAudioEngine: () => void;
}

const createDefaultChannel = (id: string, name: string): MixerChannelData => ({
  id,
  name,
  volume: 0.8,
  pan: 0,
  mute: false,
  solo: false,
  effects: [],
  sends: [],
});

const createMasterChannel = (): MixerChannelData => ({
  id: 'master',
  name: 'Master',
  volume: 1.0,
  pan: 0,
  mute: false,
  solo: false,
  effects: [],
  sends: [],
});

export const useMixerStore = create<MixerStoreState>()(
  devtools(
    (set, get) => ({
      // Initial state
      channels: [],
      masterChannel: createMasterChannel(),
      soloedChannelIds: new Set<string>(),
      isAudioConnected: false,

      // Channel actions
      addChannel: (channelData) => {
        const id = channelData?.id || `channel-${Date.now()}`;
        const channelName = channelData?.name || `Channel ${get().channels.length + 1}`;
        const channel: MixerChannelData = {
          ...createDefaultChannel(id, channelName),
          ...channelData,
          id,
          name: channelName,
        };
        
        set((state) => ({
          channels: [...state.channels, channel],
        }));
        
        return id;
      },

      removeChannel: (channelId) => {
        // Remove effects from audio engine
        const state = get();
        const channel = state.channels.find(c => c.id === channelId);
        if (channel) {
          const manager = getManager();
          channel.effects.forEach(effect => {
            if (manager) {
              manager.removeEffectFromChannel(channelId, effect.id);
            }
            effectInstances.delete(effect.id);
          });
        }
        
        set((state) => ({
          channels: state.channels.filter((c) => c.id !== channelId),
          soloedChannelIds: new Set(
            [...state.soloedChannelIds].filter((id) => id !== channelId)
          ),
        }));
      },

      updateChannel: (channelId, updates) => {
        set((state) => ({
          channels: state.channels.map((c) =>
            c.id === channelId ? { ...c, ...updates } : c
          ),
        }));
      },

      reorderChannels: (fromIndex, toIndex) => {
        set((state) => {
          const channels = [...state.channels];
          const [removed] = channels.splice(fromIndex, 1);
          channels.splice(toIndex, 0, removed);
          return { channels };
        });
      },

      // Volume/Pan - with audio engine sync
      setChannelVolume: (channelId, volume) => {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        
        // Sync to audio engine
        const manager = getManager();
        if (manager) {
          if (channelId === 'master') {
            manager.setMasterVolume(clampedVolume);
          } else {
            manager.setChannelVolume(channelId, clampedVolume);
          }
        }
        
        if (channelId === 'master') {
          set((state) => ({
            masterChannel: { ...state.masterChannel, volume: clampedVolume },
          }));
        } else {
          set((state) => ({
            channels: state.channels.map((c) =>
              c.id === channelId ? { ...c, volume: clampedVolume } : c
            ),
          }));
        }
      },

      setChannelPan: (channelId, pan) => {
        const clampedPan = Math.max(-1, Math.min(1, pan));
        
        // Sync to audio engine
        const manager = getManager();
        if (manager && channelId !== 'master') {
          manager.setChannelPan(channelId, clampedPan);
        }
        
        if (channelId === 'master') {
          set((state) => ({
            masterChannel: { ...state.masterChannel, pan: clampedPan },
          }));
        } else {
          set((state) => ({
            channels: state.channels.map((c) =>
              c.id === channelId ? { ...c, pan: clampedPan } : c
            ),
          }));
        }
      },

      // Mute/Solo - with audio engine sync
      setChannelMute: (channelId, muted) => {
        // Sync to audio engine
        const manager = getManager();
        if (manager && channelId !== 'master') {
          manager.setChannelMute(channelId, muted);
        }
        
        if (channelId === 'master') {
          set((state) => ({
            masterChannel: { ...state.masterChannel, mute: muted },
          }));
        } else {
          set((state) => ({
            channels: state.channels.map((c) =>
              c.id === channelId ? { ...c, mute: muted } : c
            ),
          }));
        }
      },

      setChannelSolo: (channelId, soloed) => {
        // Sync to audio engine
        const manager = getManager();
        if (manager && channelId !== 'master') {
          manager.setChannelSolo(channelId, soloed);
        }
        
        set((state) => {
          const newSoloedIds = new Set(state.soloedChannelIds);
          if (soloed) {
            newSoloedIds.add(channelId);
          } else {
            newSoloedIds.delete(channelId);
          }
          
          return {
            channels: state.channels.map((c) =>
              c.id === channelId ? { ...c, solo: soloed } : c
            ),
            soloedChannelIds: newSoloedIds,
          };
        });
      },

      clearAllSolo: () => {
        // Sync to audio engine
        const manager = getManager();
        const state = get();
        if (manager) {
          state.channels.forEach(channel => {
            if (channel.solo) {
              manager.setChannelSolo(channel.id, false);
            }
          });
        }
        
        set((state) => ({
          channels: state.channels.map((c) => ({ ...c, solo: false })),
          soloedChannelIds: new Set<string>(),
        }));
      },

      // Effects - with audio engine sync
      addEffect: (channelId, effect) => {
        const updateEffects = (channel: MixerChannelData) => ({
          ...channel,
          effects: [...channel.effects, effect],
        });

        if (channelId === 'master') {
          set((state) => ({
            masterChannel: updateEffects(state.masterChannel),
          }));
        } else {
          set((state) => ({
            channels: state.channels.map((c) =>
              c.id === channelId ? updateEffects(c) : c
            ),
          }));
        }
      },

      // Add effect by type - creates audio effect instance
      addEffectByType: (channelId, effectType, name) => {
        const manager = getManager();
        if (!manager || !manager.isInitialized()) return null;
        
        try {
          // Get audio context from manager
          const context = (manager as any).audioEngine?.getContext();
          if (!context) return null;
          
          const factory = getEffectFactory(context);
          const effectId = `effect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const effectName = name || effectType;
          
          // Create audio effect instance
          const audioEffect = factory.create(effectType, effectId, effectName);
          if (!audioEffect) return null;
          
          // Store the instance
          effectInstances.set(effectId, audioEffect);
          
          // Add to audio engine
          manager.addEffectToChannel(channelId, audioEffect);
          
          // Create effect params for store
          const effectParams: EffectParams = {
            id: effectId,
            type: effectType,
            name: effectName,
            enabled: true,
            params: audioEffect.getParameters(),
          };
          
          // Add to store
          get().addEffect(channelId, effectParams);
          
          return effectId;
        } catch (error) {
          console.error('Failed to add effect:', error);
          return null;
        }
      },

      removeEffect: (channelId, effectId) => {
        // Remove from audio engine
        const manager = getManager();
        if (manager) {
          manager.removeEffectFromChannel(channelId, effectId);
        }
        
        // Dispose and remove instance
        const instance = effectInstances.get(effectId);
        if (instance) {
          instance.dispose();
          effectInstances.delete(effectId);
        }
        
        const updateEffects = (channel: MixerChannelData) => ({
          ...channel,
          effects: channel.effects.filter((e) => e.id !== effectId),
        });

        if (channelId === 'master') {
          set((state) => ({
            masterChannel: updateEffects(state.masterChannel),
          }));
        } else {
          set((state) => ({
            channels: state.channels.map((c) =>
              c.id === channelId ? updateEffects(c) : c
            ),
          }));
        }
      },

      updateEffect: (channelId, effectId, updates) => {
        // Update audio effect instance parameters
        const instance = effectInstances.get(effectId);
        if (instance && updates.params) {
          Object.entries(updates.params).forEach(([key, value]) => {
            instance.setParameter(key, value as number);
          });
        }
        
        const updateEffects = (channel: MixerChannelData) => ({
          ...channel,
          effects: channel.effects.map((e) =>
            e.id === effectId ? { ...e, ...updates } : e
          ),
        });

        if (channelId === 'master') {
          set((state) => ({
            masterChannel: updateEffects(state.masterChannel),
          }));
        } else {
          set((state) => ({
            channels: state.channels.map((c) =>
              c.id === channelId ? updateEffects(c) : c
            ),
          }));
        }
      },

      moveEffect: (channelId, effectId, newIndex) => {
        const moveEffectInList = (channel: MixerChannelData) => {
          const effects = [...channel.effects];
          const currentIndex = effects.findIndex((e) => e.id === effectId);
          if (currentIndex === -1) return channel;
          
          const [effect] = effects.splice(currentIndex, 1);
          effects.splice(newIndex, 0, effect);
          
          return { ...channel, effects };
        };

        if (channelId === 'master') {
          set((state) => ({
            masterChannel: moveEffectInList(state.masterChannel),
          }));
        } else {
          set((state) => ({
            channels: state.channels.map((c) =>
              c.id === channelId ? moveEffectInList(c) : c
            ),
          }));
        }
      },

      setEffectBypass: (channelId, effectId, bypassed) => {
        // Update audio effect instance
        const instance = effectInstances.get(effectId);
        if (instance) {
          instance.setBypass(bypassed);
        }
        
        // Update store
        get().updateEffect(channelId, effectId, { enabled: !bypassed });
      },

      // Sends
      addSend: (channelId, targetChannelId, amount = 0.5) => {
        set((state) => ({
          channels: state.channels.map((c) =>
            c.id === channelId
              ? {
                  ...c,
                  sends: [
                    ...c.sends,
                    { targetChannelId, amount, preFader: false },
                  ],
                }
              : c
          ),
        }));
      },

      removeSend: (channelId, targetChannelId) => {
        set((state) => ({
          channels: state.channels.map((c) =>
            c.id === channelId
              ? {
                  ...c,
                  sends: c.sends.filter((s) => s.targetChannelId !== targetChannelId),
                }
              : c
          ),
        }));
      },

      updateSend: (channelId, targetChannelId, amount) => {
        set((state) => ({
          channels: state.channels.map((c) =>
            c.id === channelId
              ? {
                  ...c,
                  sends: c.sends.map((s) =>
                    s.targetChannelId === targetChannelId
                      ? { ...s, amount: Math.max(0, Math.min(1, amount)) }
                      : s
                  ),
                }
              : c
          ),
        }));
      },

      // Master - with audio engine sync
      setMasterVolume: (volume) => {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        
        // Sync to audio engine
        const manager = getManager();
        if (manager) {
          manager.setMasterVolume(clampedVolume);
        }
        
        set((state) => ({
          masterChannel: {
            ...state.masterChannel,
            volume: clampedVolume,
          },
        }));
      },

      setMasterPan: (pan) => {
        set((state) => ({
          masterChannel: {
            ...state.masterChannel,
            pan: Math.max(-1, Math.min(1, pan)),
          },
        }));
      },

      // Bulk operations
      loadMixerData: (data) => {
        // Clear existing effect instances
        effectInstances.forEach(effect => effect.dispose());
        effectInstances.clear();
        
        set({
          channels: data.channels,
          masterChannel: data.masterChannel,
          soloedChannelIds: new Set(
            data.channels.filter((c) => c.solo).map((c) => c.id)
          ),
        });
        
        // Sync to audio engine
        get().syncToAudioEngine();
      },

      getMixerData: () => {
        const state = get();
        return {
          channels: state.channels,
          masterChannel: state.masterChannel,
        };
      },

      resetMixer: () => {
        // Clear effect instances
        effectInstances.forEach(effect => effect.dispose());
        effectInstances.clear();
        
        set({
          channels: [],
          masterChannel: createMasterChannel(),
          soloedChannelIds: new Set<string>(),
        });
      },

      // Audio engine connection
      connectAudioEngine: () => {
        const manager = getManager();
        if (manager) {
          set({ isAudioConnected: true });
          get().syncToAudioEngine();
        }
      },

      disconnectAudioEngine: () => {
        set({ isAudioConnected: false });
        audioEngineManager = null;
      },

      syncToAudioEngine: () => {
        const manager = getManager();
        if (!manager) return;
        
        const state = get();
        
        // Sync master volume
        manager.setMasterVolume(state.masterChannel.volume);
        
        // Sync channels
        state.channels.forEach(channel => {
          manager.setChannelVolume(channel.id, channel.volume);
          manager.setChannelPan(channel.id, channel.pan);
          manager.setChannelMute(channel.id, channel.mute);
          manager.setChannelSolo(channel.id, channel.solo);
          
          // Note: Effects would need to be recreated here if loading a project
          // This is handled by loadMixerData
        });
      },
    }),
    { name: 'MixerStore' }
  )
);

// Selector hooks
export const useChannels = () => useMixerStore((state) => state.channels);
export const useMasterChannel = () => useMixerStore((state) => state.masterChannel);
export const useChannel = (channelId: string) => 
  useMixerStore((state) => 
    channelId === 'master' 
      ? state.masterChannel 
      : state.channels.find((c) => c.id === channelId)
  );
export const useHasSoloedChannels = () => 
  useMixerStore((state) => state.soloedChannelIds.size > 0);