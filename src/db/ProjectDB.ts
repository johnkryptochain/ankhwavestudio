// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * ProjectDB - IndexedDB wrapper for project persistence
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ProjectData } from '../types/song';

interface AnkhWaveStudioDBSchema extends DBSchema {
  projects: {
    key: string;
    value: {
      id: string;
      name: string;
      data: ProjectData;
      createdAt: number;
      updatedAt: number;
      thumbnail?: string;
    };
    indexes: {
      'by-name': string;
      'by-updated': number;
    };
  };
  samples: {
    key: string;
    value: {
      id: string;
      name: string;
      data: ArrayBuffer;
      mimeType: string;
      duration: number;
      sampleRate: number;
      channels: number;
      createdAt: number;
    };
    indexes: {
      'by-name': string;
    };
  };
  presets: {
    key: string;
    value: {
      id: string;
      name: string;
      instrumentType: string;
      data: Record<string, unknown>;
      createdAt: number;
    };
    indexes: {
      'by-instrument': string;
      'by-name': string;
    };
  };
  settings: {
    key: string;
    value: {
      key: string;
      value: unknown;
    };
  };
}

const DB_NAME = 'AnkhWaveStudio-web';
const DB_VERSION = 1;

export class ProjectDB {
  private db: IDBPDatabase<AnkhWaveStudioDBSchema> | null = null;
  private static instance: ProjectDB | null = null;

  private constructor() {}

  static getInstance(): ProjectDB {
    if (!ProjectDB.instance) {
      ProjectDB.instance = new ProjectDB();
    }
    return ProjectDB.instance;
  }

  async initialize(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<AnkhWaveStudioDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Projects store
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('by-name', 'name');
          projectStore.createIndex('by-updated', 'updatedAt');
        }

        // Samples store
        if (!db.objectStoreNames.contains('samples')) {
          const sampleStore = db.createObjectStore('samples', { keyPath: 'id' });
          sampleStore.createIndex('by-name', 'name');
        }

        // Presets store
        if (!db.objectStoreNames.contains('presets')) {
          const presetStore = db.createObjectStore('presets', { keyPath: 'id' });
          presetStore.createIndex('by-instrument', 'instrumentType');
          presetStore.createIndex('by-name', 'name');
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
  }

  // Project methods
  async saveProject(project: ProjectData): Promise<void> {
    if (!this.db) await this.initialize();
    
    const now = Date.now();
    await this.db!.put('projects', {
      id: project.id,
      name: project.name,
      data: project,
      createdAt: project.createdAt || now,
      updatedAt: now,
    });
  }

  async getProject(id: string): Promise<ProjectData | undefined> {
    if (!this.db) await this.initialize();
    
    const record = await this.db!.get('projects', id);
    return record?.data;
  }

  async getAllProjects(): Promise<Array<{ id: string; name: string; updatedAt: number; thumbnail?: string }>> {
    if (!this.db) await this.initialize();
    
    const projects = await this.db!.getAll('projects');
    return projects.map(p => ({
      id: p.id,
      name: p.name,
      updatedAt: p.updatedAt,
      thumbnail: p.thumbnail,
    }));
  }

  async deleteProject(id: string): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.delete('projects', id);
  }

  // Sample methods
  async saveSample(
    id: string,
    name: string,
    data: ArrayBuffer,
    mimeType: string,
    duration: number,
    sampleRate: number,
    channels: number
  ): Promise<void> {
    if (!this.db) await this.initialize();
    
    await this.db!.put('samples', {
      id,
      name,
      data,
      mimeType,
      duration,
      sampleRate,
      channels,
      createdAt: Date.now(),
    });
  }

  async getSample(id: string): Promise<ArrayBuffer | undefined> {
    if (!this.db) await this.initialize();
    
    const record = await this.db!.get('samples', id);
    return record?.data;
  }

  async getAllSamples(): Promise<Array<{ id: string; name: string; duration: number }>> {
    if (!this.db) await this.initialize();
    
    const samples = await this.db!.getAll('samples');
    return samples.map(s => ({
      id: s.id,
      name: s.name,
      duration: s.duration,
    }));
  }

  async deleteSample(id: string): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.delete('samples', id);
  }

  // Preset methods
  async savePreset(
    id: string,
    name: string,
    instrumentType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    if (!this.db) await this.initialize();
    
    await this.db!.put('presets', {
      id,
      name,
      instrumentType,
      data,
      createdAt: Date.now(),
    });
  }

  async getPreset(id: string): Promise<Record<string, unknown> | undefined> {
    if (!this.db) await this.initialize();
    
    const record = await this.db!.get('presets', id);
    return record?.data;
  }

  async getPresetsByInstrument(instrumentType: string): Promise<Array<{ id: string; name: string }>> {
    if (!this.db) await this.initialize();
    
    const presets = await this.db!.getAllFromIndex('presets', 'by-instrument', instrumentType);
    return presets.map(p => ({
      id: p.id,
      name: p.name,
    }));
  }

  async deletePreset(id: string): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.delete('presets', id);
  }

  // Settings methods
  async setSetting(key: string, value: unknown): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.put('settings', { key, value });
  }

  async getSetting<T>(key: string): Promise<T | undefined> {
    if (!this.db) await this.initialize();
    
    const record = await this.db!.get('settings', key);
    return record?.value as T | undefined;
  }

  async deleteSetting(key: string): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.delete('settings', key);
  }

  // Utility methods
  async clearAllData(): Promise<void> {
    if (!this.db) await this.initialize();
    
    await this.db!.clear('projects');
    await this.db!.clear('samples');
    await this.db!.clear('presets');
    await this.db!.clear('settings');
  }

  async getStorageEstimate(): Promise<{ usage: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { usage: 0, quota: 0 };
  }
}

export default ProjectDB;