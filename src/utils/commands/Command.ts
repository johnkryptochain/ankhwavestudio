// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Command Pattern - Base command interface for undo/redo system
 * All state-changing operations should be wrapped in commands
 */

/**
 * Base interface for all commands
 */
export interface Command {
  /** Unique identifier for the command */
  id: string;
  
  /** Human-readable description of the command */
  description: string;
  
  /** Timestamp when the command was created */
  timestamp: number;
  
  /** Execute the command (do) */
  execute(): void;
  
  /** Undo the command */
  undo(): void;
  
  /** Optional: Check if this command can be merged with another */
  canMergeWith?(other: Command): boolean;
  
  /** Optional: Merge this command with another (for compound operations) */
  mergeWith?(other: Command): Command;
}

/**
 * Abstract base class for commands with common functionality
 */
export abstract class BaseCommand implements Command {
  id: string;
  description: string;
  timestamp: number;
  
  constructor(description: string) {
    this.id = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.description = description;
    this.timestamp = Date.now();
  }
  
  abstract execute(): void;
  abstract undo(): void;
  
  canMergeWith(_other: Command): boolean {
    return false;
  }
  
  mergeWith(_other: Command): Command {
    return this;
  }
}

/**
 * Compound command that groups multiple commands together
 * Useful for operations that involve multiple state changes
 */
export class CompoundCommand extends BaseCommand {
  private commands: Command[];
  
  constructor(description: string, commands: Command[] = []) {
    super(description);
    this.commands = commands;
  }
  
  addCommand(command: Command): void {
    this.commands.push(command);
  }
  
  execute(): void {
    for (const command of this.commands) {
      command.execute();
    }
  }
  
  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
  
  isEmpty(): boolean {
    return this.commands.length === 0;
  }
  
  getCommands(): Command[] {
    return [...this.commands];
  }
}

/**
 * Command types for categorization
 */
export type CommandType = 
  | 'note'
  | 'track'
  | 'pattern'
  | 'mixer'
  | 'automation'
  | 'transport'
  | 'project'
  | 'selection'
  | 'compound';

/**
 * Command metadata for UI display
 */
export interface CommandMetadata {
  type: CommandType;
  icon?: string;
  category?: string;
}

/**
 * Extended command interface with metadata
 */
export interface MetadataCommand extends Command {
  metadata: CommandMetadata;
}

/**
 * Helper function to generate unique command IDs
 */
export function generateCommandId(): string {
  return `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper function to create a simple value change command
 */
export function createValueChangeCommand<T>(
  description: string,
  getValue: () => T,
  setValue: (value: T) => void,
  newValue: T
): Command {
  const oldValue = getValue();
  
  return {
    id: generateCommandId(),
    description,
    timestamp: Date.now(),
    execute: () => setValue(newValue),
    undo: () => setValue(oldValue),
  };
}