// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * MixerChannel - Individual channel strip
 * Features: Channel name (editable), input selector, insert effect slots,
 * send knobs, pan knob, volume fader, VU meter, mute/solo/record arm buttons
 */

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useMixerStore, useTransportStore, useHistoryStore } from '../../stores';
import { Slider, Knob, VUMeter, Button } from '../common';
import type { MixerChannelData } from '../../types/song';
import type { EffectType } from '../../audio/EffectFactory';
import { generateCommandId } from '../../utils/commands/Command';

interface EffectSlot {
  id: string;
  name: string;
  enabled: boolean;
}

interface SendSlot {
  id: string;
  targetId: string;
  targetName: string;
  amount: number;
}

interface MixerChannelProps {
  channel: MixerChannelData;
  isMaster?: boolean;
  compact?: boolean;
}

export const MixerChannel: React.FC<MixerChannelProps> = memo(({
  channel,
  isMaster = false,
  compact = false,
}) => {
  const {
    setChannelVolume,
    setChannelPan,
    setChannelMute,
    setChannelSolo,
    removeChannel,
    updateChannel,
    addEffectByType,
    addSend,
    channels,
  } = useMixerStore();
  
  const isPlaying = useTransportStore((state) => state.isPlaying);
  
  const [meterLevelL, setMeterLevelL] = useState(0);
  const [meterLevelR, setMeterLevelR] = useState(0);
  const [peakL, setPeakL] = useState(0);
  const [peakR, setPeakR] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [showSends, setShowSends] = useState(false);
  const [recordArm, setRecordArm] = useState(false);
  
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Simulate meter animation - only when playing and not muted
  // Using refs for peaks to avoid infinite loop from state dependencies
  const peakLRef = useRef(peakL);
  const peakRRef = useRef(peakR);
  
  useEffect(() => {
    peakLRef.current = peakL;
    peakRRef.current = peakR;
  }, [peakL, peakR]);
  
  useEffect(() => {
    // Only animate meters when playing and not muted
    if (isPlaying && !channel.mute) {
      const interval = setInterval(() => {
        const baseLevel = channel.volume * 0.8;
        const newLevelL = Math.random() * baseLevel;
        const newLevelR = Math.random() * baseLevel;
        
        setMeterLevelL(newLevelL);
        setMeterLevelR(newLevelR);
        
        // Update peaks using refs to avoid dependency issues
        if (newLevelL > peakLRef.current) setPeakL(newLevelL);
        if (newLevelR > peakRRef.current) setPeakR(newLevelR);
      }, 50);
      
      // Decay peaks
      const peakDecay = setInterval(() => {
        setPeakL(prev => Math.max(0, prev - 0.02));
        setPeakR(prev => Math.max(0, prev - 0.02));
      }, 100);
      
      return () => {
        clearInterval(interval);
        clearInterval(peakDecay);
      };
    } else {
      // Reset meters when not playing or muted
      setMeterLevelL(0);
      setMeterLevelR(0);
      setPeakL(0);
      setPeakR(0);
    }
  }, [isPlaying, channel.mute, channel.volume]);

  // Focus name input when editing
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleVolumeChange = useCallback((value: number) => {
    setChannelVolume(channel.id, value);
  }, [channel.id, setChannelVolume]);

  const handlePanChange = useCallback((value: number) => {
    setChannelPan(channel.id, value);
  }, [channel.id, setChannelPan]);

  // Get executeCommand from history store
  const executeCommand = useHistoryStore((state) => state.executeCommand);

  const handleMuteToggle = useCallback(() => {
    const wasMuted = channel.mute;
    executeCommand({
      id: generateCommandId(),
      description: wasMuted ? 'Unmute channel' : 'Mute channel',
      timestamp: Date.now(),
      execute: () => {
        useMixerStore.getState().setChannelMute(channel.id, !wasMuted);
      },
      undo: () => {
        useMixerStore.getState().setChannelMute(channel.id, wasMuted);
      },
    });
  }, [channel.id, channel.mute, executeCommand]);

  const handleSoloToggle = useCallback(() => {
    const wasSoloed = channel.solo;
    executeCommand({
      id: generateCommandId(),
      description: wasSoloed ? 'Unsolo channel' : 'Solo channel',
      timestamp: Date.now(),
      execute: () => {
        useMixerStore.getState().setChannelSolo(channel.id, !wasSoloed);
      },
      undo: () => {
        useMixerStore.getState().setChannelSolo(channel.id, wasSoloed);
      },
    });
  }, [channel.id, channel.solo, executeCommand]);

  const handleRemove = useCallback(() => {
    if (!isMaster) {
      const channelCopy = JSON.parse(JSON.stringify(channel));
      executeCommand({
        id: generateCommandId(),
        description: `Remove channel "${channel.name}"`,
        timestamp: Date.now(),
        execute: () => {
          useMixerStore.getState().removeChannel(channel.id);
        },
        undo: () => {
          useMixerStore.getState().addChannel(channelCopy);
        },
      });
    }
  }, [channel, isMaster, executeCommand]);

  const handleNameChange = useCallback((name: string) => {
    updateChannel(channel.id, { name });
    setIsEditingName(false);
  }, [channel.id, updateChannel]);

  // Convert volume to dB display
  const volumeToDb = (volume: number): string => {
    if (volume === 0) return '-∞';
    const db = 20 * Math.log10(volume);
    return db.toFixed(1);
  };

  // Compact view
  if (compact) {
    return (
      <div 
        className={`flex flex-col w-12 bg-daw-bg-secondary rounded p-1 ${
          isMaster ? 'bg-daw-bg-tertiary ring-1 ring-daw-accent-primary' : ''
        }`}
      >
        {/* Name */}
        <div className="text-center mb-1">
          <span className={`text-xxs font-medium truncate block ${
            isMaster ? 'text-daw-accent-primary' : 'text-daw-text-primary'
          }`}>
            {channel.name.substring(0, 4)}
          </span>
        </div>

        {/* Mini meter and fader */}
        <div className="flex-1 flex justify-center items-center gap-0.5 min-h-[60px]">
          <div className="w-1 h-full bg-daw-bg-primary rounded overflow-hidden">
            <div
              className="w-full bg-gradient-to-t from-green-500 via-yellow-500 to-red-500 transition-all duration-75"
              style={{ height: `${meterLevelL * 100}%` }}
            />
          </div>
          <Slider
            value={channel.volume * 100}
            min={0}
            max={100}
            orientation="vertical"
            size="sm"
            onChange={(v) => handleVolumeChange((typeof v === 'number' ? v : v[1]) / 100)}
          />
        </div>

        {/* Mute button only */}
        <button
          onClick={handleMuteToggle}
          className={`w-full h-4 text-xxs font-bold rounded mt-1 ${
            channel.mute
              ? 'bg-daw-accent-secondary text-white'
              : 'bg-daw-bg-surface text-daw-text-muted'
          }`}
        >
          M
        </button>
      </div>
    );
  }

  // Full view
  return (
    <div 
      className={`flex flex-col w-24 bg-daw-bg-secondary rounded-lg p-2 ${
        isMaster ? 'bg-daw-bg-tertiary ring-2 ring-daw-accent-primary' : ''
      }`}
      style={{ borderTop: `3px solid ${channel.color || '#8286ef'}` }}
    >
      {/* Channel name */}
      <div className="text-center mb-2">
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            defaultValue={channel.name}
            onBlur={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameChange(e.currentTarget.value);
              if (e.key === 'Escape') setIsEditingName(false);
            }}
            className="w-full bg-daw-bg-primary border border-daw-border rounded px-1 text-xs text-daw-text-primary text-center"
          />
        ) : (
          <span 
            className={`text-xs font-medium truncate block cursor-pointer hover:text-daw-text-secondary ${
              isMaster ? 'text-daw-accent-primary' : 'text-daw-text-primary'
            }`}
            onDoubleClick={() => !isMaster && setIsEditingName(true)}
            title={channel.name}
          >
            {channel.name}
          </span>
        )}
      </div>

      {/* Input selector (not for master) */}
      {!isMaster && (
        <select className="w-full bg-daw-bg-primary border border-daw-border rounded px-1 py-0.5 text-xxs text-daw-text-primary mb-2">
          <option>No Input</option>
          <option>Input 1</option>
          <option>Input 2</option>
          <option>Stereo In</option>
        </select>
      )}

      {/* Effect slots toggle and content */}
      {!isMaster && (
        <div className="mb-1">
          <button
            onClick={() => setShowEffects(!showEffects)}
            className={`w-full text-xxs py-1 rounded transition-colors ${
              showEffects ? 'bg-daw-accent-primary text-white' : 'bg-daw-bg-surface text-daw-text-muted hover:text-daw-text-secondary'
            }`}
          >
            FX {channel.effects?.length || 0}
          </button>
          
          {/* Effect slots (expandable) */}
          {showEffects && (
            <div className="mt-1 space-y-1 bg-daw-bg-primary rounded p-1">
              {(channel.effects || []).map((effect: EffectSlot, i: number) => (
                <div
                  key={effect.id || i}
                  className="flex items-center gap-1 bg-daw-bg-surface rounded px-1 py-0.5"
                >
                  <button
                    className={`w-3 h-3 rounded-full ${effect.enabled ? 'bg-green-500' : 'bg-daw-bg-tertiary'}`}
                  />
                  <span className="text-xxs text-daw-text-secondary truncate flex-1">
                    {effect.name}
                  </span>
                </div>
              ))}
              <button
                type="button"
                className="w-full text-xxs text-daw-accent-primary hover:text-white bg-daw-bg-surface hover:bg-daw-accent-primary py-2 rounded border border-daw-border transition-colors cursor-pointer"
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  console.log('Add Effect clicked for channel:', channel.id);
                  // Add a default reverb effect
                  const effectId = addEffectByType(channel.id, 'reverb' as EffectType, 'Reverb');
                  console.log('Effect added:', effectId);
                }}
              >
                + Add Effect
              </button>
            </div>
          )}
        </div>
      )}

      {/* Send knobs toggle and content */}
      {!isMaster && (
        <div className="mb-2">
          <button
            onClick={() => setShowSends(!showSends)}
            className={`w-full text-xxs py-1 rounded transition-colors ${
              showSends ? 'bg-daw-accent-primary text-white' : 'bg-daw-bg-surface text-daw-text-muted hover:text-daw-text-secondary'
            }`}
          >
            Sends {channel.sends?.length || 0}
          </button>
          
          {/* Send knobs (expandable) */}
          {showSends && (
            <div className="mt-1 space-y-2 bg-daw-bg-primary rounded p-1">
              {(channel.sends || []).map((send, i: number) => (
                <div key={send.targetChannelId || i} className="flex items-center gap-1">
                  <span className="text-xxs text-daw-text-muted w-8 truncate">{send.targetChannelId}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={send.amount * 100}
                    className="flex-1 h-1"
                    readOnly
                  />
                </div>
              ))}
              <button
                type="button"
                className="w-full text-xxs text-daw-accent-primary hover:text-white bg-daw-bg-surface hover:bg-daw-accent-primary py-2 rounded border border-daw-border transition-colors cursor-pointer"
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  console.log('Add Send clicked for channel:', channel.id);
                  // Find available send targets (other channels or master)
                  const availableTargets = channels.filter(c => c.id !== channel.id && c.type === 'send');
                  if (availableTargets.length > 0) {
                    addSend(channel.id, availableTargets[0].id, 0.5);
                    console.log('Send added to:', availableTargets[0].id);
                  } else {
                    // If no send channels exist, send to master
                    addSend(channel.id, 'master', 0.5);
                    console.log('Send added to master');
                  }
                }}
              >
                + Ajouter un envoi
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pan knob */}
      <div className="flex justify-center mb-2">
        <Knob
          value={(channel.pan + 1) * 50}
          min={0}
          max={100}
          size="sm"
          label="Panoramique"
          showValue={false}
          bipolar
          onChange={(v) => handlePanChange((v / 50) - 1)}
          onDoubleClick={() => handlePanChange(0)}
        />
      </div>

      {/* Fader and meter */}
      <div className="flex-1 flex justify-center items-center gap-1 min-h-[120px]">
        {/* Stereo VU Meter */}
        <VUMeter
          level={meterLevelL}
          levelRight={meterLevelR}
          peak={peakL}
          peakRight={peakR}
          stereo
          showScale={false}
          size="md"
        />

        {/* Fader */}
        <Slider
          value={channel.volume * 100}
          min={0}
          max={125}
          orientation="vertical"
          size="md"
          onChange={(v) => handleVolumeChange((typeof v === 'number' ? v : v[1]) / 100)}
        />
      </div>

      {/* Volume display */}
      <div className="text-center my-1">
        <span className="text-xxs text-daw-text-muted font-mono">
          {volumeToDb(channel.volume)} dB
        </span>
      </div>

      {/* Mute/Solo/Record buttons */}
      <div className="flex justify-center gap-1 mb-2">
        <button
          onClick={handleMuteToggle}
          className={`w-6 h-6 text-xxs font-bold rounded transition-colors ${
            channel.mute
              ? 'bg-daw-accent-secondary text-white'
              : 'bg-daw-bg-surface text-daw-text-muted hover:text-daw-text-secondary'
          }`}
          title="Mute (M)"
        >
          M
        </button>
        {!isMaster && (
          <>
            <button
              onClick={handleSoloToggle}
              className={`w-6 h-6 text-xxs font-bold rounded transition-colors ${
                channel.solo
                  ? 'bg-daw-accent-warning text-black'
                  : 'bg-daw-bg-surface text-daw-text-muted hover:text-daw-text-secondary'
              }`}
              title="Solo (S)"
            >
              S
            </button>
            <button
              onClick={() => setRecordArm(!recordArm)}
              className={`w-6 h-6 text-xxs font-bold rounded transition-colors ${
                recordArm
                  ? 'bg-daw-accent-danger text-white'
                  : 'bg-daw-bg-surface text-daw-text-muted hover:text-daw-text-secondary'
              }`}
              title="Record Arm (R)"
            >
              R
            </button>
          </>
        )}
      </div>

      {/* Channel color indicator */}
      {!isMaster && (
        <div 
          className="h-1 rounded-full mb-2"
          style={{ backgroundColor: channel.color || '#8286ef' }}
        />
      )}

      {/* Remove button (not for master) */}
      {!isMaster && (
        <button
          onClick={handleRemove}
          className="text-xxs text-daw-text-muted hover:text-daw-accent-danger transition-colors"
        >
          Remove
        </button>
      )}
    </div>
  );
});

MixerChannel.displayName = 'MixerChannel';

export default MixerChannel;