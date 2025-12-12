// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * WindowSyncManager - Handles synchronization between multiple browser windows
 * Allows "detaching" panels (Mixer, Piano Roll) into separate windows while keeping state in sync.
 * Uses BroadcastChannel API.
 */

import { StoreApi, UseBoundStore } from 'zustand';

export class WindowSyncManager {
  private static instance: WindowSyncManager;
  private channel: BroadcastChannel;
  private windowId: string;
  private isMain: boolean;
  private stores: Map<string, UseBoundStore<StoreApi<any>>> = new Map();

  private constructor() {
    this.windowId = Math.random().toString(36).substring(7);
    this.channel = new BroadcastChannel('ankhwave_sync');
    this.isMain = !window.opener;

    this.channel.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    // If we are a child window, request initial state
    if (!this.isMain) {
      this.channel.postMessage({ type: 'REQUEST_STATE', sender: this.windowId });
    }
  }

  public static getInstance(): WindowSyncManager {
    if (!WindowSyncManager.instance) {
      WindowSyncManager.instance = new WindowSyncManager();
    }
    return WindowSyncManager.instance;
  }

  /**
   * Register a Zustand store to be synchronized
   * @param name Unique name for the store
   * @param store The Zustand store hook
   */
  public registerStore(name: string, store: UseBoundStore<StoreApi<any>>) {
    this.stores.set(name, store);

    // Subscribe to store changes to broadcast them
    store.subscribe((state) => {
      // We need a way to distinguish local changes from synced changes to avoid loops
      // For now, we'll just broadcast everything and rely on strict equality checks in reducers
      // or a timestamp/version system.
      // A simple optimization: only broadcast if we are the "active" window for this action?
      // Or just broadcast diffs?
      
      // For simplicity in this "homemade" solution, we broadcast the full state or key parts
      // This is heavy but functional for a prototype.
      // Ideally, we'd use a middleware.
    });
  }

  /**
   * Open a component in a new window
   * @param componentId The ID of the component/view to open
   * @param title Window title
   */
  public openWindow(componentId: string, title: string = 'AnkhWave Panel') {
    const width = 800;
    const height = 600;
    const left = window.screenX + 50;
    const top = window.screenY + 50;

    const url = new URL(window.location.href);
    url.searchParams.set('view', componentId);
    url.searchParams.set('detached', 'true');

    window.open(
      url.toString(),
      `ankhwave_${componentId}`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );
  }

  private handleMessage(data: any) {
    if (data.sender === this.windowId) return;

    switch (data.type) {
      case 'REQUEST_STATE':
        if (this.isMain) {
          // Send state of all registered stores
          this.stores.forEach((store, name) => {
            this.channel.postMessage({
              type: 'STATE_UPDATE',
              storeName: name,
              state: store.getState(),
              sender: this.windowId
            });
          });
        }
        break;

      case 'STATE_UPDATE':
        const store = this.stores.get(data.storeName);
        if (store) {
          // Apply state update
          // Note: This is dangerous if not handled carefully (infinite loops)
          // We assume the store has a setState method or we use the internal setState
          store.setState(data.state);
        }
        break;
        
      case 'ACTION':
        // Execute an action remotely
        // data.action would be a Redux-like action object
        break;
    }
  }

  public broadcastAction(action: any) {
    this.channel.postMessage({
      type: 'ACTION',
      action,
      sender: this.windowId
    });
  }
}
