// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Mixer Commands - Commands for mixer operations
 */

import { BaseCommand, Command, generateCommandId } from './Command';
import type { MixerChannelData, SendData } from '../../types/song';
import type { EffectParams } from '../../types/audio';

// Store reference type - will be set by the store
type MixerStore = {
  getChannels: () => MixerChannelData[];
  getMasterChannel: () => MixerChannelData;
  getChannel: (channelId: string) => MixerChannelData | undefined;
  addChannel: (channel: MixerChannelData) => void;
  removeChannel: (channelId: string) => void;
  updateChannel: (channelId: string, updates: Partial<MixerChannelData>) => void;
  reorderChannels: (fromIndex: number, toIndex: number) => void;
  addEffect: (channelId: string, effect: EffectParams) => void;
  removeEffect: (channelId: string, effectId: string) => void;
  updateEffect: (channelId: string, effectId: string, updates: Partial<EffectParams>) => void;
  moveEffect: (channelId: string, effectId: string, newIndex: number) => void;
  addSend: (channelId: string, send: SendData) => void;
  removeSend: (channelId: string, targetChannelId: string) => void;
  updateSend: (channelId: string, targetChannelId: string, amount: number) => void;
};

let mixerStore: MixerStore | null = null;

/**
 * Set the mixer store reference for commands to use
 */
export function setMixerStore(store: MixerStore): void {
  mixerStore = store;
}

/**
 * Command to add a mixer channel
 */
export class AddMixerChannelCommand extends BaseCommand {
  private channel: MixerChannelData;
  
  constructor(channel: MixerChannelData) {
    super(`Add mixer channel "${channel.name}"`);
    this.channel = { ...channel, effects: [...channel.effects], sends: [...channel.sends] };
  }
  
  execute(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.addChannel(this.channel);
  }
  
  undo(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.removeChannel(this.channel.id);
  }
}

/**
 * Command to remove a mixer channel
 */
export class RemoveMixerChannelCommand extends BaseCommand {
  private channel: MixerChannelData;
  private index: number;
  
  constructor(channel: MixerChannelData, index: number) {
    super(`Remove mixer channel "${channel.name}"`);
    this.channel = { 
      ...channel, 
      effects: channel.effects.map(e => ({ ...e })), 
      sends: channel.sends.map(s => ({ ...s })) 
    };
    this.index = index;
  }
  
  execute(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.removeChannel(this.channel.id);
  }
  
  undo(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.addChannel(this.channel);
    // Restore position
    const channels = mixerStore.getChannels();
    const currentIndex = channels.findIndex(c => c.id === this.channel.id);
    if (currentIndex !== -1 && currentIndex !== this.index) {
      mixerStore.reorderChannels(currentIndex, this.index);
    }
  }
}

/**
 * Command to rename a mixer channel
 */
export class RenameMixerChannelCommand extends BaseCommand {
  private channelId: string;
  private oldName: string;
  private newName: string;
  
  constructor(channelId: string, oldName: string, newName: string) {
    super(`Rename channel to "${newName}"`);
    this.channelId = channelId;
    this.oldName = oldName;
    this.newName = newName;
  }
  
  execute(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.updateChannel(this.channelId, { name: this.newName });
  }
  
  undo(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.updateChannel(this.channelId, { name: this.oldName });
  }
}

/**
 * Command to change channel volume
 */
export class ChangeChannelVolumeCommand extends BaseCommand {
  private channelId: string;
  private oldVolume: number;
  private newVolume: number;
  
  constructor(channelId: string, oldVolume: number, newVolume: number) {
    super(`Change channel volume`);
    this.channelId = channelId;
    this.oldVolume = oldVolume;
    this.newVolume = newVolume;
  }
  
  execute(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.updateChannel(this.channelId, { volume: this.newVolume });
  }
  
  undo(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.updateChannel(this.channelId, { volume: this.oldVolume });
  }
  
  canMergeWith(other: Command): boolean {
    return (
      other instanceof ChangeChannelVolumeCommand &&
      other.channelId === this.channelId &&
      other.timestamp - this.timestamp < 100
    );
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof ChangeChannelVolumeCommand)) return this;
    return new ChangeChannelVolumeCommand(this.channelId, this.oldVolume, other.newVolume);
  }
}

/**
 * Command to change channel pan
 */
export class ChangeChannelPanCommand extends BaseCommand {
  private channelId: string;
  private oldPan: number;
  private newPan: number;
  
  constructor(channelId: string, oldPan: number, newPan: number) {
    super(`Change channel pan`);
    this.channelId = channelId;
    this.oldPan = oldPan;
    this.newPan = newPan;
  }
  
  execute(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.updateChannel(this.channelId, { pan: this.newPan });
  }
  
  undo(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.updateChannel(this.channelId, { pan: this.oldPan });
  }
  
  canMergeWith(other: Command): boolean {
    return (
      other instanceof ChangeChannelPanCommand &&
      other.channelId === this.channelId &&
      other.timestamp - this.timestamp < 100
    );
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof ChangeChannelPanCommand)) return this;
    return new ChangeChannelPanCommand(this.channelId, this.oldPan, other.newPan);
  }
}

/**
 * Command to toggle channel mute
 */
export class ToggleChannelMuteCommand extends BaseCommand {
  private channelId: string;
  private wasMuted: boolean;
  
  constructor(channelId: string, wasMuted: boolean) {
    super(wasMuted ? 'Unmute channel' : 'Mute channel');
    this.channelId = channelId;
    this.wasMuted = wasMuted;
  }
  
  execute(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.updateChannel(this.channelId, { mute: !this.wasMuted });
  }
  
  undo(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.updateChannel(this.channelId, { mute: this.wasMuted });
  }
}

/**
 * Command to toggle channel solo
 */
export class ToggleChannelSoloCommand extends BaseCommand {
  private channelId: string;
  private wasSoloed: boolean;
  
  constructor(channelId: string, wasSoloed: boolean) {
    super(wasSoloed ? 'Unsolo channel' : 'Solo channel');
    this.channelId = channelId;
    this.wasSoloed = wasSoloed;
  }
  
  execute(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.updateChannel(this.channelId, { solo: !this.wasSoloed });
  }
  
  undo(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.updateChannel(this.channelId, { solo: this.wasSoloed });
  }
}

/**
 * Command to add an effect to a channel
 */
export class AddEffectCommand extends BaseCommand {
  private channelId: string;
  private effect: EffectParams;
  
  constructor(channelId: string, effect: EffectParams) {
    super(`Add ${effect.type} effect`);
    this.channelId = channelId;
    this.effect = { ...effect };
  }
  
  execute(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.addEffect(this.channelId, this.effect);
  }
  
  undo(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.removeEffect(this.channelId, this.effect.id);
  }
}

/**
 * Command to remove an effect from a channel
 */
export class RemoveEffectCommand extends BaseCommand {
  private channelId: string;
  private effect: EffectParams;
  private index: number;
  
  constructor(channelId: string, effect: EffectParams, index: number) {
    super(`Remove ${effect.type} effect`);
    this.channelId = channelId;
    this.effect = { ...effect };
    this.index = index;
  }
  
  execute(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.removeEffect(this.channelId, this.effect.id);
  }
  
  undo(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.addEffect(this.channelId, this.effect);
    // Restore position
    mixerStore.moveEffect(this.channelId, this.effect.id, this.index);
  }
}

/**
 * Command to update effect parameters
 */
export class UpdateEffectCommand extends BaseCommand {
  private channelId: string;
  private effectId: string;
  private oldParams: Partial<EffectParams>;
  private newParams: Partial<EffectParams>;
  
  constructor(
    channelId: string,
    effectId: string,
    oldParams: Partial<EffectParams>,
    newParams: Partial<EffectParams>
  ) {
    super(`Update effect`);
    this.channelId = channelId;
    this.effectId = effectId;
    this.oldParams = { ...oldParams };
    this.newParams = { ...newParams };
  }
  
  execute(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.updateEffect(this.channelId, this.effectId, this.newParams);
  }
  
  undo(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.updateEffect(this.channelId, this.effectId, this.oldParams);
  }
  
  canMergeWith(other: Command): boolean {
    return (
      other instanceof UpdateEffectCommand &&
      other.channelId === this.channelId &&
      other.effectId === this.effectId &&
      other.timestamp - this.timestamp < 100
    );
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof UpdateEffectCommand)) return this;
    return new UpdateEffectCommand(
      this.channelId,
      this.effectId,
      this.oldParams,
      other.newParams
    );
  }
}

/**
 * Command to toggle effect bypass
 */
export class ToggleEffectBypassCommand extends BaseCommand {
  private channelId: string;
  private effectId: string;
  private wasEnabled: boolean;
  
  constructor(channelId: string, effectId: string, wasEnabled: boolean) {
    super(wasEnabled ? 'Bypass effect' : 'Enable effect');
    this.channelId = channelId;
    this.effectId = effectId;
    this.wasEnabled = wasEnabled;
  }
  
  execute(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.updateEffect(this.channelId, this.effectId, { enabled: !this.wasEnabled });
  }
  
  undo(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.updateEffect(this.channelId, this.effectId, { enabled: this.wasEnabled });
  }
}

/**
 * Command to move an effect in the chain
 */
export class MoveEffectCommand extends BaseCommand {
  private channelId: string;
  private effectId: string;
  private oldIndex: number;
  private newIndex: number;
  
  constructor(channelId: string, effectId: string, oldIndex: number, newIndex: number) {
    super(`Move effect`);
    this.channelId = channelId;
    this.effectId = effectId;
    this.oldIndex = oldIndex;
    this.newIndex = newIndex;
  }
  
  execute(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.moveEffect(this.channelId, this.effectId, this.newIndex);
  }
  
  undo(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.moveEffect(this.channelId, this.effectId, this.oldIndex);
  }
}

/**
 * Command to add a send
 */
export class AddSendCommand extends BaseCommand {
  private channelId: string;
  private send: SendData;
  
  constructor(channelId: string, send: SendData) {
    super(`Add send`);
    this.channelId = channelId;
    this.send = { ...send };
  }
  
  execute(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.addSend(this.channelId, this.send);
  }
  
  undo(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.removeSend(this.channelId, this.send.targetChannelId);
  }
}

/**
 * Command to remove a send
 */
export class RemoveSendCommand extends BaseCommand {
  private channelId: string;
  private send: SendData;
  
  constructor(channelId: string, send: SendData) {
    super(`Remove send`);
    this.channelId = channelId;
    this.send = { ...send };
  }
  
  execute(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.removeSend(this.channelId, this.send.targetChannelId);
  }
  
  undo(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.addSend(this.channelId, this.send);
  }
}

/**
 * Command to change send amount
 */
export class ChangeSendAmountCommand extends BaseCommand {
  private channelId: string;
  private targetChannelId: string;
  private oldAmount: number;
  private newAmount: number;
  
  constructor(channelId: string, targetChannelId: string, oldAmount: number, newAmount: number) {
    super(`Change send amount`);
    this.channelId = channelId;
    this.targetChannelId = targetChannelId;
    this.oldAmount = oldAmount;
    this.newAmount = newAmount;
  }
  
  execute(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.updateSend(this.channelId, this.targetChannelId, this.newAmount);
  }
  
  undo(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.updateSend(this.channelId, this.targetChannelId, this.oldAmount);
  }
  
  canMergeWith(other: Command): boolean {
    return (
      other instanceof ChangeSendAmountCommand &&
      other.channelId === this.channelId &&
      other.targetChannelId === this.targetChannelId &&
      other.timestamp - this.timestamp < 100
    );
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof ChangeSendAmountCommand)) return this;
    return new ChangeSendAmountCommand(
      this.channelId,
      this.targetChannelId,
      this.oldAmount,
      other.newAmount
    );
  }
}

/**
 * Command to reorder mixer channels
 */
export class ReorderMixerChannelsCommand extends BaseCommand {
  private fromIndex: number;
  private toIndex: number;
  
  constructor(fromIndex: number, toIndex: number) {
    super(`Reorder mixer channels`);
    this.fromIndex = fromIndex;
    this.toIndex = toIndex;
  }
  
  execute(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.reorderChannels(this.fromIndex, this.toIndex);
  }
  
  undo(): void {
    if (!mixerStore) throw new Error('Mixer store not initialized');
    mixerStore.reorderChannels(this.toIndex, this.fromIndex);
  }
}