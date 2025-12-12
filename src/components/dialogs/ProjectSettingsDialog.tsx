// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import React, { useState, useEffect } from 'react';
import { useSongStore } from '../../stores/songStore';
import { Button } from '../common/Button';

interface ProjectSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectSettingsDialog: React.FC<ProjectSettingsDialogProps> = ({ isOpen, onClose }) => {
  const { metadata, setMetadata } = useSongStore();
  const [localMetadata, setLocalMetadata] = useState(metadata);

  useEffect(() => {
    if (isOpen) {
      setLocalMetadata(metadata);
    }
  }, [isOpen, metadata]);

  const handleSave = () => {
    setMetadata(localMetadata);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-daw-bg-elevated border border-daw-border rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-daw-border">
          <h2 className="text-lg font-semibold text-daw-text-primary">Paramètres du projet</h2>
          <button onClick={onClose} className="text-daw-text-secondary hover:text-daw-text-primary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-daw-text-secondary mb-1">Nom du projet</label>
            <input
              type="text"
              value={localMetadata.name}
              onChange={(e) => setLocalMetadata({ ...localMetadata, name: e.target.value })}
              className="w-full px-3 py-2 bg-daw-bg-surface border border-daw-border rounded focus:outline-none focus:border-daw-accent-primary text-daw-text-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-daw-text-secondary mb-1">Auteur</label>
            <input
              type="text"
              value={localMetadata.author}
              onChange={(e) => setLocalMetadata({ ...localMetadata, author: e.target.value })}
              className="w-full px-3 py-2 bg-daw-bg-surface border border-daw-border rounded focus:outline-none focus:border-daw-accent-primary text-daw-text-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-daw-text-secondary mb-1">Description</label>
            <textarea
              value={localMetadata.description}
              onChange={(e) => setLocalMetadata({ ...localMetadata, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-daw-bg-surface border border-daw-border rounded focus:outline-none focus:border-daw-accent-primary text-daw-text-primary resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-daw-border bg-daw-bg-surface/50">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleSave}>Enregistrer</Button>
        </div>
      </div>
    </div>
  );
};
