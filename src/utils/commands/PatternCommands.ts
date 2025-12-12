// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Pattern Commands - Commands for pattern operations in the pattern editor
 */

import { BaseCommand, Command, generateCommandId } from './Command';
import type { Pattern, PatternStep } from '../../types/song';

// Store reference type - will be set by the store
type PatternStore = {
  getPatterns: () => Pattern[];
  getPattern: (patternId: string) => Pattern | undefined;
  addPattern: (pattern: Pattern) => void;
  removePattern: (patternId: string) => void;
  updatePattern: (patternId: string, updates: Partial<Pattern>) => void;
  setPatternSteps: (patternId: string, steps: PatternStep[]) => void;
  updatePatternStep: (patternId: string, stepIndex: number, updates: Partial<PatternStep>) => void;
};

let patternStore: PatternStore | null = null;

/**
 * Set the pattern store reference for commands to use
 */
export function setPatternStore(store: PatternStore): void {
  patternStore = store;
}

/**
 * Command to add a new pattern
 */
export class AddPatternCommand extends BaseCommand {
  private pattern: Pattern;
  
  constructor(pattern: Pattern) {
    super(`Add pattern "${pattern.name}"`);
    this.pattern = { ...pattern, steps: pattern.steps.map(s => ({ ...s })) };
  }
  
  execute(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.addPattern(this.pattern);
  }
  
  undo(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.removePattern(this.pattern.id);
  }
}

/**
 * Command to delete a pattern
 */
export class DeletePatternCommand extends BaseCommand {
  private pattern: Pattern;
  
  constructor(pattern: Pattern) {
    super(`Delete pattern "${pattern.name}"`);
    this.pattern = { ...pattern, steps: pattern.steps.map(s => ({ ...s })) };
  }
  
  execute(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.removePattern(this.pattern.id);
  }
  
  undo(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.addPattern(this.pattern);
  }
}

/**
 * Command to rename a pattern
 */
export class RenamePatternCommand extends BaseCommand {
  private patternId: string;
  private oldName: string;
  private newName: string;
  
  constructor(patternId: string, oldName: string, newName: string) {
    super(`Rename pattern to "${newName}"`);
    this.patternId = patternId;
    this.oldName = oldName;
    this.newName = newName;
  }
  
  execute(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.updatePattern(this.patternId, { name: this.newName });
  }
  
  undo(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.updatePattern(this.patternId, { name: this.oldName });
  }
}

/**
 * Command to change pattern length
 */
export class ChangePatternLengthCommand extends BaseCommand {
  private patternId: string;
  private oldLength: number;
  private newLength: number;
  private oldSteps: PatternStep[];
  private newSteps: PatternStep[];
  
  constructor(
    patternId: string,
    oldLength: number,
    newLength: number,
    oldSteps: PatternStep[],
    newSteps: PatternStep[]
  ) {
    super(`Change pattern length to ${newLength}`);
    this.patternId = patternId;
    this.oldLength = oldLength;
    this.newLength = newLength;
    this.oldSteps = oldSteps.map(s => ({ ...s }));
    this.newSteps = newSteps.map(s => ({ ...s }));
  }
  
  execute(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.updatePattern(this.patternId, { length: this.newLength });
    patternStore.setPatternSteps(this.patternId, this.newSteps);
  }
  
  undo(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.updatePattern(this.patternId, { length: this.oldLength });
    patternStore.setPatternSteps(this.patternId, this.oldSteps);
  }
}

/**
 * Command to toggle a pattern step
 */
export class TogglePatternStepCommand extends BaseCommand {
  private patternId: string;
  private stepIndex: number;
  private wasEnabled: boolean;
  
  constructor(patternId: string, stepIndex: number, wasEnabled: boolean) {
    super(wasEnabled ? `Disable step ${stepIndex + 1}` : `Enable step ${stepIndex + 1}`);
    this.patternId = patternId;
    this.stepIndex = stepIndex;
    this.wasEnabled = wasEnabled;
  }
  
  execute(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.updatePatternStep(this.patternId, this.stepIndex, { enabled: !this.wasEnabled });
  }
  
  undo(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.updatePatternStep(this.patternId, this.stepIndex, { enabled: this.wasEnabled });
  }
}

/**
 * Command to change step velocity
 */
export class ChangeStepVelocityCommand extends BaseCommand {
  private patternId: string;
  private stepIndex: number;
  private oldVelocity: number;
  private newVelocity: number;
  
  constructor(patternId: string, stepIndex: number, oldVelocity: number, newVelocity: number) {
    super(`Change step ${stepIndex + 1} velocity`);
    this.patternId = patternId;
    this.stepIndex = stepIndex;
    this.oldVelocity = oldVelocity;
    this.newVelocity = newVelocity;
  }
  
  execute(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.updatePatternStep(this.patternId, this.stepIndex, { velocity: this.newVelocity });
  }
  
  undo(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.updatePatternStep(this.patternId, this.stepIndex, { velocity: this.oldVelocity });
  }
  
  canMergeWith(other: Command): boolean {
    return (
      other instanceof ChangeStepVelocityCommand &&
      other.patternId === this.patternId &&
      other.stepIndex === this.stepIndex &&
      other.timestamp - this.timestamp < 100
    );
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof ChangeStepVelocityCommand)) return this;
    return new ChangeStepVelocityCommand(
      this.patternId,
      this.stepIndex,
      this.oldVelocity,
      other.newVelocity
    );
  }
}

/**
 * Command to change step pan
 */
export class ChangeStepPanCommand extends BaseCommand {
  private patternId: string;
  private stepIndex: number;
  private oldPan: number;
  private newPan: number;
  
  constructor(patternId: string, stepIndex: number, oldPan: number, newPan: number) {
    super(`Change step ${stepIndex + 1} pan`);
    this.patternId = patternId;
    this.stepIndex = stepIndex;
    this.oldPan = oldPan;
    this.newPan = newPan;
  }
  
  execute(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.updatePatternStep(this.patternId, this.stepIndex, { pan: this.newPan });
  }
  
  undo(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.updatePatternStep(this.patternId, this.stepIndex, { pan: this.oldPan });
  }
  
  canMergeWith(other: Command): boolean {
    return (
      other instanceof ChangeStepPanCommand &&
      other.patternId === this.patternId &&
      other.stepIndex === this.stepIndex &&
      other.timestamp - this.timestamp < 100
    );
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof ChangeStepPanCommand)) return this;
    return new ChangeStepPanCommand(
      this.patternId,
      this.stepIndex,
      this.oldPan,
      other.newPan
    );
  }
}

/**
 * Command to change step pitch
 */
export class ChangeStepPitchCommand extends BaseCommand {
  private patternId: string;
  private stepIndex: number;
  private oldPitch: number;
  private newPitch: number;
  
  constructor(patternId: string, stepIndex: number, oldPitch: number, newPitch: number) {
    super(`Change step ${stepIndex + 1} pitch`);
    this.patternId = patternId;
    this.stepIndex = stepIndex;
    this.oldPitch = oldPitch;
    this.newPitch = newPitch;
  }
  
  execute(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.updatePatternStep(this.patternId, this.stepIndex, { pitch: this.newPitch });
  }
  
  undo(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.updatePatternStep(this.patternId, this.stepIndex, { pitch: this.oldPitch });
  }
  
  canMergeWith(other: Command): boolean {
    return (
      other instanceof ChangeStepPitchCommand &&
      other.patternId === this.patternId &&
      other.stepIndex === this.stepIndex &&
      other.timestamp - this.timestamp < 100
    );
  }
  
  mergeWith(other: Command): Command {
    if (!(other instanceof ChangeStepPitchCommand)) return this;
    return new ChangeStepPitchCommand(
      this.patternId,
      this.stepIndex,
      this.oldPitch,
      other.newPitch
    );
  }
}

/**
 * Command to clear all steps in a pattern
 */
export class ClearPatternCommand extends BaseCommand {
  private patternId: string;
  private oldSteps: PatternStep[];
  
  constructor(patternId: string, oldSteps: PatternStep[]) {
    super(`Clear pattern`);
    this.patternId = patternId;
    this.oldSteps = oldSteps.map(s => ({ ...s }));
  }
  
  execute(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    const pattern = patternStore.getPattern(this.patternId);
    if (!pattern) throw new Error('Pattern not found');
    
    const clearedSteps = pattern.steps.map((step, index) => ({
      index,
      enabled: false,
      velocity: 100,
      pan: 0,
      pitch: 0,
    }));
    patternStore.setPatternSteps(this.patternId, clearedSteps);
  }
  
  undo(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.setPatternSteps(this.patternId, this.oldSteps);
  }
}

/**
 * Command to duplicate a pattern
 */
export class DuplicatePatternCommand extends BaseCommand {
  private originalPatternId: string;
  private duplicatedPattern: Pattern | null = null;
  
  constructor(originalPatternId: string) {
    super(`Duplicate pattern`);
    this.originalPatternId = originalPatternId;
  }
  
  execute(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    const originalPattern = patternStore.getPattern(this.originalPatternId);
    if (!originalPattern) throw new Error('Original pattern not found');
    
    this.duplicatedPattern = {
      ...originalPattern,
      id: generateCommandId(),
      name: `${originalPattern.name} (Copy)`,
      steps: originalPattern.steps.map(s => ({ ...s })),
    };
    
    patternStore.addPattern(this.duplicatedPattern);
  }
  
  undo(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    if (this.duplicatedPattern) {
      patternStore.removePattern(this.duplicatedPattern.id);
    }
  }
}

/**
 * Command to set multiple steps at once (for paste operations)
 */
export class SetPatternStepsCommand extends BaseCommand {
  private patternId: string;
  private oldSteps: PatternStep[];
  private newSteps: PatternStep[];
  
  constructor(patternId: string, oldSteps: PatternStep[], newSteps: PatternStep[]) {
    super(`Set pattern steps`);
    this.patternId = patternId;
    this.oldSteps = oldSteps.map(s => ({ ...s }));
    this.newSteps = newSteps.map(s => ({ ...s }));
  }
  
  execute(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.setPatternSteps(this.patternId, this.newSteps);
  }
  
  undo(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.setPatternSteps(this.patternId, this.oldSteps);
  }
}

/**
 * Command to randomize pattern steps
 */
export class RandomizePatternCommand extends BaseCommand {
  private patternId: string;
  private oldSteps: PatternStep[];
  private newSteps: PatternStep[];
  
  constructor(patternId: string, oldSteps: PatternStep[], newSteps: PatternStep[]) {
    super(`Randomize pattern`);
    this.patternId = patternId;
    this.oldSteps = oldSteps.map(s => ({ ...s }));
    this.newSteps = newSteps.map(s => ({ ...s }));
  }
  
  execute(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.setPatternSteps(this.patternId, this.newSteps);
  }
  
  undo(): void {
    if (!patternStore) throw new Error('Pattern store not initialized');
    patternStore.setPatternSteps(this.patternId, this.oldSteps);
  }
}