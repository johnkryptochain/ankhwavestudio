// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * History Store - Manages undo/redo functionality using the command pattern
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Command } from '../utils/commands/Command';

// Maximum number of actions to keep in history
const MAX_HISTORY_SIZE = 100;

interface HistoryState {
  // Undo stack (most recent at the end)
  undoStack: Command[];
  
  // Redo stack (most recent at the end)
  redoStack: Command[];
  
  // Whether we're currently executing a command (to prevent recursion)
  isExecuting: boolean;
  
  // Current action group ID (for grouping compound operations)
  currentGroupId: string | null;
  
  // Pending commands in the current group
  pendingGroupCommands: Command[];
  
  // Actions
  executeCommand: (command: Command) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getUndoDescription: () => string | null;
  getRedoDescription: () => string | null;
  clear: () => void;
  
  // Action grouping
  beginGroup: (groupId?: string) => void;
  endGroup: (description?: string) => void;
  cancelGroup: () => void;
  
  // Internal
  _pushToUndoStack: (command: Command) => void;
}

export const useHistoryStore = create<HistoryState>()(
  devtools(
    (set, get) => ({
      undoStack: [],
      redoStack: [],
      isExecuting: false,
      currentGroupId: null,
      pendingGroupCommands: [],

      /**
       * Execute a command and add it to the undo stack
       */
      executeCommand: (command: Command) => {
        const state = get();
        
        // If we're in a group, add to pending commands
        if (state.currentGroupId !== null) {
          set((s) => ({
            pendingGroupCommands: [...s.pendingGroupCommands, command],
          }));
          
          // Execute the command
          try {
            command.execute();
          } catch (error) {
            console.error('Command execution failed:', error);
            // Remove from pending on failure
            set((s) => ({
              pendingGroupCommands: s.pendingGroupCommands.filter(c => c.id !== command.id),
            }));
          }
          return;
        }
        
        // Prevent recursive execution
        if (state.isExecuting) {
          console.warn('Recursive command execution detected');
          return;
        }
        
        set({ isExecuting: true });
        
        try {
          // Execute the command
          command.execute();
          
          // Try to merge with the last command
          const lastCommand = state.undoStack[state.undoStack.length - 1];
          if (lastCommand && command.canMergeWith?.(lastCommand)) {
            const mergedCommand = lastCommand.mergeWith?.(command) || command;
            set((s) => ({
              undoStack: [...s.undoStack.slice(0, -1), mergedCommand],
              redoStack: [], // Clear redo stack on new action
            }));
          } else {
            // Add to undo stack
            get()._pushToUndoStack(command);
            set({ redoStack: [] }); // Clear redo stack on new action
          }
        } catch (error) {
          console.error('Command execution failed:', error);
        } finally {
          set({ isExecuting: false });
        }
      },

      /**
       * Undo the last command
       */
      undo: () => {
        const state = get();
        
        if (state.undoStack.length === 0 || state.isExecuting) {
          return false;
        }
        
        set({ isExecuting: true });
        
        try {
          const command = state.undoStack[state.undoStack.length - 1];
          command.undo();
          
          set((s) => ({
            undoStack: s.undoStack.slice(0, -1),
            redoStack: [...s.redoStack, command],
          }));
          
          return true;
        } catch (error) {
          console.error('Undo failed:', error);
          return false;
        } finally {
          set({ isExecuting: false });
        }
      },

      /**
       * Redo the last undone command
       */
      redo: () => {
        const state = get();
        
        if (state.redoStack.length === 0 || state.isExecuting) {
          return false;
        }
        
        set({ isExecuting: true });
        
        try {
          const command = state.redoStack[state.redoStack.length - 1];
          command.execute();
          
          set((s) => ({
            redoStack: s.redoStack.slice(0, -1),
            undoStack: [...s.undoStack, command],
          }));
          
          return true;
        } catch (error) {
          console.error('Redo failed:', error);
          return false;
        } finally {
          set({ isExecuting: false });
        }
      },

      /**
       * Check if undo is available
       */
      canUndo: () => {
        return get().undoStack.length > 0;
      },

      /**
       * Check if redo is available
       */
      canRedo: () => {
        return get().redoStack.length > 0;
      },

      /**
       * Get the description of the next undo action
       */
      getUndoDescription: () => {
        const state = get();
        if (state.undoStack.length === 0) return null;
        return state.undoStack[state.undoStack.length - 1].description;
      },

      /**
       * Get the description of the next redo action
       */
      getRedoDescription: () => {
        const state = get();
        if (state.redoStack.length === 0) return null;
        return state.redoStack[state.redoStack.length - 1].description;
      },

      /**
       * Clear all history
       */
      clear: () => {
        set({
          undoStack: [],
          redoStack: [],
          currentGroupId: null,
          pendingGroupCommands: [],
        });
      },

      /**
       * Begin a group of commands that will be undone/redone together
       */
      beginGroup: (groupId?: string) => {
        const id = groupId || `group-${Date.now()}`;
        set({
          currentGroupId: id,
          pendingGroupCommands: [],
        });
      },

      /**
       * End the current group and create a compound command
       */
      endGroup: (description?: string) => {
        const state = get();
        
        if (state.currentGroupId === null) {
          console.warn('No active group to end');
          return;
        }
        
        const commands = state.pendingGroupCommands;
        
        if (commands.length === 0) {
          set({
            currentGroupId: null,
            pendingGroupCommands: [],
          });
          return;
        }
        
        // Create a compound command
        const compoundCommand: Command = {
          id: state.currentGroupId,
          description: description || `${commands.length} actions`,
          timestamp: Date.now(),
          execute: () => {
            for (const cmd of commands) {
              cmd.execute();
            }
          },
          undo: () => {
            // Undo in reverse order
            for (let i = commands.length - 1; i >= 0; i--) {
              commands[i].undo();
            }
          },
        };
        
        // Add to undo stack (commands already executed)
        set((s) => ({
          currentGroupId: null,
          pendingGroupCommands: [],
          undoStack: [...s.undoStack.slice(-(MAX_HISTORY_SIZE - 1)), compoundCommand],
          redoStack: [],
        }));
      },

      /**
       * Cancel the current group and undo all pending commands
       */
      cancelGroup: () => {
        const state = get();
        
        if (state.currentGroupId === null) {
          return;
        }
        
        // Undo all pending commands in reverse order
        const commands = state.pendingGroupCommands;
        for (let i = commands.length - 1; i >= 0; i--) {
          try {
            commands[i].undo();
          } catch (error) {
            console.error('Failed to undo command during group cancel:', error);
          }
        }
        
        set({
          currentGroupId: null,
          pendingGroupCommands: [],
        });
      },

      /**
       * Internal: Push a command to the undo stack with size limit
       */
      _pushToUndoStack: (command: Command) => {
        set((s) => ({
          undoStack: [...s.undoStack.slice(-(MAX_HISTORY_SIZE - 1)), command],
        }));
      },
    }),
    { name: 'HistoryStore' }
  )
);

// Selector hooks
export const useCanUndo = () => useHistoryStore((state) => state.undoStack.length > 0);
export const useCanRedo = () => useHistoryStore((state) => state.redoStack.length > 0);
export const useUndoDescription = () => useHistoryStore((state) => 
  state.undoStack.length > 0 ? state.undoStack[state.undoStack.length - 1].description : null
);
export const useRedoDescription = () => useHistoryStore((state) => 
  state.redoStack.length > 0 ? state.redoStack[state.redoStack.length - 1].description : null
);

// Convenience functions for use outside of React components
export const executeCommand = (command: Command) => useHistoryStore.getState().executeCommand(command);
export const undo = () => useHistoryStore.getState().undo();
export const redo = () => useHistoryStore.getState().redo();
export const beginGroup = (groupId?: string) => useHistoryStore.getState().beginGroup(groupId);
export const endGroup = (description?: string) => useHistoryStore.getState().endGroup(description);
export const cancelGroup = () => useHistoryStore.getState().cancelGroup();