// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Sync Manager
 * Handles background sync, conflict resolution, and offline data synchronization
 */

import { ProjectDB } from './ProjectDB';

export interface SyncStatus {
  lastSyncTime: number | null;
  pendingChanges: number;
  isSyncing: boolean;
  lastError: string | null;
  syncProgress: number;
}

export interface SyncConflict {
  id: string;
  type: 'project' | 'sample' | 'preset' | 'settings';
  localVersion: unknown;
  remoteVersion: unknown;
  localTimestamp: number;
  remoteTimestamp: number;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  conflicts: SyncConflict[];
  errors: string[];
}

type SyncCallback = (status: SyncStatus) => void;
type ConflictResolver = (conflict: SyncConflict) => Promise<'local' | 'remote' | 'merge'>;

// Sync queue item
interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'project' | 'sample' | 'preset' | 'settings';
  data: unknown;
  timestamp: number;
  retryCount: number;
}

const SYNC_QUEUE_KEY = 'AnkhWaveStudio-sync-queue';
const SYNC_STATUS_KEY = 'AnkhWaveStudio-sync-status';
const MAX_RETRY_COUNT = 5;
const RETRY_DELAYS = [1000, 5000, 15000, 60000, 300000]; // Exponential backoff

/**
 * Sync Manager class
 */
export class SyncManager {
  private static instance: SyncManager | null = null;
  private db: ProjectDB;
  private syncQueue: SyncQueueItem[] = [];
  private status: SyncStatus;
  private callbacks: SyncCallback[] = [];
  private conflictResolver: ConflictResolver | null = null;
  private syncInterval: number | null = null;
  private isOnline: boolean = navigator.onLine;
  private apiEndpoint: string = '/api';

  private constructor() {
    this.db = ProjectDB.getInstance();
    this.status = this.loadStatus();
    this.loadQueue();
    this.setupEventListeners();
  }

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  /**
   * Initialize sync manager
   */
  async initialize(options?: {
    apiEndpoint?: string;
    conflictResolver?: ConflictResolver;
    autoSync?: boolean;
    syncIntervalMs?: number;
  }): Promise<void> {
    if (options?.apiEndpoint) {
      this.apiEndpoint = options.apiEndpoint;
    }

    if (options?.conflictResolver) {
      this.conflictResolver = options.conflictResolver;
    }

    await this.db.initialize();

    // Start auto-sync if enabled
    if (options?.autoSync !== false) {
      this.startAutoSync(options?.syncIntervalMs || 5 * 60 * 1000); // 5 minutes default
    }

    // Process any pending items if online
    if (this.isOnline && this.syncQueue.length > 0) {
      this.processQueue();
    }

    console.log('[SyncManager] Initialized');
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Online/offline detection
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[SyncManager] Online - processing queue');
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[SyncManager] Offline - queuing changes');
    });

    // Listen for service worker sync events
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_COMPLETE') {
          this.handleSyncComplete(event.data);
        }
      });
    }
  }

  /**
   * Queue a change for sync
   */
  queueChange(
    type: 'create' | 'update' | 'delete',
    entity: 'project' | 'sample' | 'preset' | 'settings',
    id: string,
    data?: unknown
  ): void {
    // Remove any existing queue item for the same entity
    this.syncQueue = this.syncQueue.filter(
      item => !(item.entity === entity && item.id === id)
    );

    // Add new queue item
    const item: SyncQueueItem = {
      id,
      type,
      entity,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.syncQueue.push(item);
    this.saveQueue();
    this.updateStatus({ pendingChanges: this.syncQueue.length });

    // Try to sync immediately if online
    if (this.isOnline) {
      this.processQueue();
    }
  }

  /**
   * Process the sync queue
   */
  async processQueue(): Promise<SyncResult> {
    if (!this.isOnline || this.status.isSyncing || this.syncQueue.length === 0) {
      return { success: true, synced: 0, conflicts: [], errors: [] };
    }

    this.updateStatus({ isSyncing: true, syncProgress: 0 });

    const result: SyncResult = {
      success: true,
      synced: 0,
      conflicts: [],
      errors: [],
    };

    const itemsToProcess = [...this.syncQueue];
    const processedIds: string[] = [];

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      this.updateStatus({ syncProgress: (i / itemsToProcess.length) * 100 });

      try {
        const syncResult = await this.syncItem(item);

        if (syncResult.success) {
          processedIds.push(item.id);
          result.synced++;
        } else if (syncResult.conflict) {
          result.conflicts.push(syncResult.conflict);
        } else if (syncResult.error) {
          // Handle retry logic
          item.retryCount++;
          if (item.retryCount >= MAX_RETRY_COUNT) {
            result.errors.push(`Failed to sync ${item.entity} ${item.id}: ${syncResult.error}`);
            processedIds.push(item.id); // Remove from queue after max retries
          } else {
            // Schedule retry with exponential backoff
            const delay = RETRY_DELAYS[Math.min(item.retryCount - 1, RETRY_DELAYS.length - 1)];
            setTimeout(() => this.processQueue(), delay);
          }
        }
      } catch (error) {
        result.errors.push(`Error syncing ${item.entity} ${item.id}: ${error}`);
        result.success = false;
      }
    }

    // Remove processed items from queue
    this.syncQueue = this.syncQueue.filter(item => !processedIds.includes(item.id));
    this.saveQueue();

    this.updateStatus({
      isSyncing: false,
      syncProgress: 100,
      lastSyncTime: Date.now(),
      pendingChanges: this.syncQueue.length,
      lastError: result.errors.length > 0 ? result.errors[0] : null,
    });

    // Handle conflicts
    if (result.conflicts.length > 0) {
      await this.handleConflicts(result.conflicts);
    }

    return result;
  }

  /**
   * Sync a single item
   */
  private async syncItem(item: SyncQueueItem): Promise<{
    success: boolean;
    conflict?: SyncConflict;
    error?: string;
  }> {
    const endpoint = `${this.apiEndpoint}/${item.entity}s/${item.id}`;

    try {
      let response: Response;

      switch (item.type) {
        case 'create':
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data),
          });
          break;

        case 'update':
          response = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data),
          });
          break;

        case 'delete':
          response = await fetch(endpoint, {
            method: 'DELETE',
          });
          break;

        default:
          return { success: false, error: 'Unknown sync type' };
      }

      if (response.ok) {
        return { success: true };
      }

      if (response.status === 409) {
        // Conflict detected
        const remoteData = await response.json();
        return {
          success: false,
          conflict: {
            id: item.id,
            type: item.entity,
            localVersion: item.data,
            remoteVersion: remoteData,
            localTimestamp: item.timestamp,
            remoteTimestamp: remoteData.updatedAt || Date.now(),
          },
        };
      }

      return { success: false, error: `HTTP ${response.status}` };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Handle sync conflicts
   */
  private async handleConflicts(conflicts: SyncConflict[]): Promise<void> {
    for (const conflict of conflicts) {
      let resolution: 'local' | 'remote' | 'merge' = 'remote';

      if (this.conflictResolver) {
        resolution = await this.conflictResolver(conflict);
      } else {
        // Default: use most recent version
        resolution = conflict.localTimestamp > conflict.remoteTimestamp ? 'local' : 'remote';
      }

      await this.resolveConflict(conflict, resolution);
    }
  }

  /**
   * Resolve a single conflict
   */
  private async resolveConflict(
    conflict: SyncConflict,
    resolution: 'local' | 'remote' | 'merge'
  ): Promise<void> {
    switch (resolution) {
      case 'local':
        // Re-queue the local version for sync
        this.queueChange('update', conflict.type, conflict.id, conflict.localVersion);
        break;

      case 'remote':
        // Apply remote version to local database
        await this.applyRemoteVersion(conflict);
        break;

      case 'merge':
        // Merge versions (implementation depends on data type)
        const merged = this.mergeVersions(conflict);
        await this.applyRemoteVersion({ ...conflict, remoteVersion: merged });
        this.queueChange('update', conflict.type, conflict.id, merged);
        break;
    }
  }

  /**
   * Apply remote version to local database
   */
  private async applyRemoteVersion(conflict: SyncConflict): Promise<void> {
    switch (conflict.type) {
      case 'project':
        await this.db.saveProject(conflict.remoteVersion as any);
        break;
      case 'sample':
        // Handle sample update
        break;
      case 'preset':
        // Handle preset update
        break;
      case 'settings':
        // Handle settings update
        break;
    }
  }

  /**
   * Merge two versions of data
   */
  private mergeVersions(conflict: SyncConflict): unknown {
    // Simple merge strategy: combine properties, prefer newer values
    const local = conflict.localVersion as Record<string, unknown>;
    const remote = conflict.remoteVersion as Record<string, unknown>;

    return {
      ...remote,
      ...local,
      // Always use remote ID and timestamps
      id: remote.id,
      updatedAt: Date.now(),
    };
  }

  /**
   * Handle sync complete message from service worker
   */
  private handleSyncComplete(data: { target: string }): void {
    console.log('[SyncManager] Sync complete for:', data.target);
    this.updateStatus({ lastSyncTime: Date.now() });
    this.notifyCallbacks();
  }

  /**
   * Start auto-sync interval
   */
  startAutoSync(intervalMs: number): void {
    this.stopAutoSync();
    this.syncInterval = window.setInterval(() => {
      if (this.isOnline) {
        this.processQueue();
      }
    }, intervalMs);
  }

  /**
   * Stop auto-sync interval
   */
  stopAutoSync(): void {
    if (this.syncInterval !== null) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Force sync now
   */
  async syncNow(): Promise<SyncResult> {
    return this.processQueue();
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return { ...this.status };
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: SyncCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Update status and notify callbacks
   */
  private updateStatus(updates: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...updates };
    this.saveStatus();
    this.notifyCallbacks();
  }

  /**
   * Notify all callbacks
   */
  private notifyCallbacks(): void {
    this.callbacks.forEach(cb => cb(this.status));
  }

  /**
   * Load sync queue from storage
   */
  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(SYNC_QUEUE_KEY);
      if (stored) {
        this.syncQueue = JSON.parse(stored);
      }
    } catch (e) {
      console.error('[SyncManager] Failed to load queue:', e);
      this.syncQueue = [];
    }
  }

  /**
   * Save sync queue to storage
   */
  private saveQueue(): void {
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
    } catch (e) {
      console.error('[SyncManager] Failed to save queue:', e);
    }
  }

  /**
   * Load sync status from storage
   */
  private loadStatus(): SyncStatus {
    try {
      const stored = localStorage.getItem(SYNC_STATUS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('[SyncManager] Failed to load status:', e);
    }

    return {
      lastSyncTime: null,
      pendingChanges: 0,
      isSyncing: false,
      lastError: null,
      syncProgress: 0,
    };
  }

  /**
   * Save sync status to storage
   */
  private saveStatus(): void {
    try {
      localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(this.status));
    } catch (e) {
      console.error('[SyncManager] Failed to save status:', e);
    }
  }

  /**
   * Clear sync queue
   */
  clearQueue(): void {
    this.syncQueue = [];
    this.saveQueue();
    this.updateStatus({ pendingChanges: 0 });
  }

  /**
   * Get pending changes count
   */
  getPendingCount(): number {
    return this.syncQueue.length;
  }

  /**
   * Check if there are pending changes
   */
  hasPendingChanges(): boolean {
    return this.syncQueue.length > 0;
  }

  /**
   * Export sync data for debugging
   */
  exportSyncData(): {
    status: SyncStatus;
    queue: SyncQueueItem[];
  } {
    return {
      status: this.status,
      queue: this.syncQueue,
    };
  }
}

export default SyncManager;