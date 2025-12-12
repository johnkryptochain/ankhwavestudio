// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Settings Dialog - Application settings similar to AnkhWaveStudio SetupDialog
 * Features: General, Performance, Audio, MIDI, and Paths settings tabs
 */

import React, { useState, useCallback, memo, useEffect } from 'react';
import { Button } from '../common';
import { useUIStore } from '../../stores/uiStore';
import type { UserPreferences } from '../../types/ui';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'performance' | 'audio' | 'midi' | 'paths';

interface TabButtonProps {
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = memo(({ id, label, icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 w-full px-4 py-3 text-left rounded-lg transition-colors ${
      isActive
        ? 'bg-daw-accent-primary text-white'
        : 'text-daw-text-secondary hover:text-daw-text-primary hover:bg-daw-bg-surface'
    }`}
  >
    <span className="w-5 h-5">{icon}</span>
    <span className="font-medium">{label}</span>
  </button>
));

TabButton.displayName = 'TabButton';

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, description, children }) => (
  <div className="flex items-center justify-between py-3 border-b border-daw-border last:border-b-0">
    <div className="flex-1">
      <div className="text-sm text-daw-text-primary font-medium">{label}</div>
      {description && (
        <div className="text-xs text-daw-text-muted mt-0.5">{description}</div>
      )}
    </div>
    <div className="ml-4">{children}</div>
  </div>
);

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      checked ? 'bg-daw-accent-primary' : 'bg-daw-bg-surface'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

export const SettingsDialog: React.FC<SettingsDialogProps> = memo(({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const preferences = useUIStore((state) => state.preferences);
  const setPreferences = useUIStore((state) => state.setPreferences);
  const [settings, setSettings] = useState<UserPreferences>(preferences);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset local settings when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSettings(preferences);
      setHasChanges(false);
    }
  }, [isOpen, preferences]);

  const updateSetting = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    setPreferences(settings);
    setHasChanges(false);
    onClose();
  }, [settings, setPreferences, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);


  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'general',
      label: 'Général',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      id: 'audio',
      label: 'Audio',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      ),
    },
    {
      id: 'midi',
      label: 'MIDI',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      ),
    },
    {
      id: 'paths',
      label: 'Chemins',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
    },
  ];

  const renderGeneralSettings = () => (
    <div className="space-y-1">
      <h3 className="text-lg font-semibold text-daw-text-primary mb-4">Paramètres généraux</h3>
      
      <SettingRow label="Afficher les infobulles" description="Afficher des infobulles utiles au survol">
        <ToggleSwitch
          checked={settings.showTooltips}
          onChange={(v) => updateSetting('showTooltips', v)}
        />
      </SettingRow>
      
      <SettingRow label="Afficher les formes d'onde" description="Afficher les formes d'onde dans les clips audio">
        <ToggleSwitch
          checked={settings.displayWaveform}
          onChange={(v) => updateSetting('displayWaveform', v)}
        />
      </SettingRow>
      
      <SettingRow label="Afficher les noms des notes" description="Afficher les noms des notes dans le piano roll">
        <ToggleSwitch
          checked={settings.showNoteLabels}
          onChange={(v) => updateSetting('showNoteLabels', v)}
        />
      </SettingRow>
      
      <SettingRow label="Boutons de piste compacts" description="Utiliser des boutons de contrôle de piste plus petits">
        <ToggleSwitch
          checked={settings.compactTrackButtons}
          onChange={(v) => updateSetting('compactTrackButtons', v)}
        />
      </SettingRow>
      
      <SettingRow label="Barre latérale à droite" description="Déplacer la barre latérale à droite de la fenêtre">
        <ToggleSwitch
          checked={settings.sidebarOnRight}
          onChange={(v) => updateSetting('sidebarOnRight', v)}
        />
      </SettingRow>
      
      <SettingRow label="Ouvrir le dernier projet au démarrage" description="Charger automatiquement le dernier projet ouvert">
        <ToggleSwitch
          checked={settings.openLastProject}
          onChange={(v) => updateSetting('openLastProject', v)}
        />
      </SettingRow>
      
      <SettingRow label="Langue">
        <select
          value="fr"
          disabled
          className="bg-daw-bg-surface border border-daw-border rounded px-3 py-1.5 text-sm text-daw-text-primary focus:outline-none focus:ring-1 focus:ring-daw-accent-primary opacity-75 cursor-not-allowed"
        >
          <option value="fr">Français</option>
        </select>
      </SettingRow>
    </div>
  );

  const renderPerformanceSettings = () => (
    <div className="space-y-1">
      <h3 className="text-lg font-semibold text-daw-text-primary mb-4">Paramètres de performance</h3>
      
      <SettingRow label="Activer la sauvegarde automatique" description="Enregistrer automatiquement le projet à intervalles réguliers">
        <ToggleSwitch
          checked={settings.autoSaveEnabled}
          onChange={(v) => updateSetting('autoSaveEnabled', v)}
        />
      </SettingRow>
      
      <SettingRow label="Intervalle de sauvegarde automatique" description="Minutes entre les sauvegardes automatiques">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={30}
            value={settings.autoSaveInterval}
            onChange={(e) => updateSetting('autoSaveInterval', parseInt(e.target.value))}
            disabled={!settings.autoSaveEnabled}
            className="w-24"
          />
          <span className="text-sm text-daw-text-secondary w-8">{settings.autoSaveInterval}m</span>
        </div>
      </SettingRow>
      
      <SettingRow label="Défilement fluide" description="Activer les animations de défilement fluide">
        <ToggleSwitch
          checked={settings.smoothScroll}
          onChange={(v) => updateSetting('smoothScroll', v)}
        />
      </SettingRow>
      
      <SettingRow label="Animer le processeur de fichiers audio" description="Afficher les formes d'onde animées pendant la lecture">
        <ToggleSwitch
          checked={settings.animateAudioFileProcessor}
          onChange={(v) => updateSetting('animateAudioFileProcessor', v)}
        />
      </SettingRow>
    </div>
  );

  const renderAudioSettings = () => (
    <div className="space-y-1">
      <h3 className="text-lg font-semibold text-daw-text-primary mb-4">Paramètres audio</h3>
      
      <SettingRow label="Interface audio" description="Sélectionner le périphérique de sortie audio">
        <select
          value={settings.audioInterface}
          onChange={(e) => updateSetting('audioInterface', e.target.value)}
          className="bg-daw-bg-surface border border-daw-border rounded px-3 py-1.5 text-sm text-daw-text-primary focus:outline-none focus:ring-1 focus:ring-daw-accent-primary"
        >
          <option value="Web Audio API">Web Audio API (Par défaut)</option>
        </select>
      </SettingRow>
      
      <SettingRow label="Fréquence d'échantillonnage" description="Fréquence d'échantillonnage audio en Hz">
        <select
          value={settings.sampleRate}
          onChange={(e) => updateSetting('sampleRate', parseInt(e.target.value))}
          className="bg-daw-bg-surface border border-daw-border rounded px-3 py-1.5 text-sm text-daw-text-primary focus:outline-none focus:ring-1 focus:ring-daw-accent-primary"
        >
          <option value={22050}>22050 Hz</option>
          <option value={44100}>44100 Hz</option>
          <option value={48000}>48000 Hz</option>
          <option value={96000}>96000 Hz</option>
        </select>
      </SettingRow>
      
      <SettingRow label="Taille du tampon" description="Plus petit = moins de latence, plus grand = plus stable">
        <select
          value={settings.bufferSize}
          onChange={(e) => updateSetting('bufferSize', parseInt(e.target.value))}
          className="bg-daw-bg-surface border border-daw-border rounded px-3 py-1.5 text-sm text-daw-text-primary focus:outline-none focus:ring-1 focus:ring-daw-accent-primary"
        >
          <option value={128}>128 échantillons</option>
          <option value={256}>256 échantillons</option>
          <option value={512}>512 échantillons</option>
          <option value={1024}>1024 échantillons</option>
          <option value={2048}>2048 échantillons</option>
        </select>
      </SettingRow>
      
      <div className="mt-4 p-3 bg-daw-bg-surface rounded-lg">
        <div className="text-xs text-daw-text-muted">
          <strong>Note :</strong> Les paramètres audio sont limités par les capacités du navigateur. 
          Pour de meilleures performances, utilisez Chrome ou Firefox avec une configuration audio à faible latence.
        </div>
      </div>
    </div>
  );

  const renderMidiSettings = () => (
    <div className="space-y-1">
      <h3 className="text-lg font-semibold text-daw-text-primary mb-4">Paramètres MIDI</h3>
      
      <SettingRow label="Interface MIDI" description="Sélectionner le périphérique d'entrée MIDI">
        <select
          value={settings.midiInterface}
          onChange={(e) => updateSetting('midiInterface', e.target.value)}
          className="bg-daw-bg-surface border border-daw-border rounded px-3 py-1.5 text-sm text-daw-text-primary focus:outline-none focus:ring-1 focus:ring-daw-accent-primary"
        >
          <option value="Web MIDI API">Web MIDI API (Par défaut)</option>
          <option value="none">Aucun</option>
        </select>
      </SettingRow>
      
      <SettingRow label="Quantification automatique de l'entrée MIDI" description="Quantifier automatiquement les notes MIDI enregistrées">
        <ToggleSwitch
          checked={settings.midiAutoQuantize}
          onChange={(v) => updateSetting('midiAutoQuantize', v)}
        />
      </SettingRow>
      
      <div className="mt-4 p-3 bg-daw-bg-surface rounded-lg">
        <div className="text-xs text-daw-text-muted">
          <strong>Note :</strong> Web MIDI nécessite un contexte sécurisé (HTTPS) et la prise en charge du navigateur. 
          Connectez un périphérique MIDI et actualisez pour le détecter.
        </div>
      </div>
    </div>
  );

  const handleBrowse = async (settingKey: keyof UserPreferences) => {
    try {
      // @ts-ignore - File System Access API
      if ((window as any).showDirectoryPicker) {
        const handle = await (window as any).showDirectoryPicker();
        if (handle) {
          updateSetting(settingKey, handle.name);
        }
      } else {
        alert('Votre navigateur ne supporte pas la sélection de dossier.');
      }
    } catch (err) {
      console.log('Directory picker cancelled or failed', err);
    }
  };

  const renderPathsSettings = () => (
    <div className="space-y-1">
      <h3 className="text-lg font-semibold text-daw-text-primary mb-4">Paramètres des chemins</h3>
      
      <SettingRow label="Répertoire de travail" description="Emplacement par défaut pour les projets">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={settings.workingDirectory}
            readOnly
            placeholder="Non défini (stockage navigateur)"
            className="w-48 bg-daw-bg-surface border border-daw-border rounded px-3 py-1.5 text-sm text-daw-text-primary focus:outline-none focus:ring-1 focus:ring-daw-accent-primary cursor-default"
          />
          <Button size="sm" variant="secondary" onClick={() => handleBrowse('workingDirectory')}>
            Parcourir...
          </Button>
        </div>
      </SettingRow>
      
      <SettingRow label="Répertoire VST" description="Emplacement des plugins VST (WASM/WebAudio)">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={settings.vstDirectory}
            readOnly
            placeholder="Non défini"
            className="w-48 bg-daw-bg-surface border border-daw-border rounded px-3 py-1.5 text-sm text-daw-text-primary focus:outline-none focus:ring-1 focus:ring-daw-accent-primary cursor-default"
          />
          <Button size="sm" variant="secondary" onClick={() => handleBrowse('vstDirectory')}>
            Parcourir...
          </Button>
        </div>
      </SettingRow>
      
      <SettingRow label="Répertoire des échantillons" description="Emplacement par défaut pour les échantillons audio">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={settings.samplesDirectory}
            readOnly
            placeholder="Non défini (stockage navigateur)"
            className="w-48 bg-daw-bg-surface border border-daw-border rounded px-3 py-1.5 text-sm text-daw-text-primary focus:outline-none focus:ring-1 focus:ring-daw-accent-primary cursor-default"
          />
          <Button size="sm" variant="secondary" onClick={() => handleBrowse('samplesDirectory')}>
            Parcourir...
          </Button>
        </div>
      </SettingRow>
      
      <div className="mt-4 p-3 bg-daw-bg-surface rounded-lg">
        <div className="text-xs text-daw-text-muted">
          <strong>Note :</strong> En tant qu'application web, AnkhWave utilise le stockage du navigateur pour les fichiers. 
          L'accès au système de fichiers est limité par rapport aux applications de bureau.
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralSettings();
      case 'performance':
        return renderPerformanceSettings();
      case 'audio':
        return renderAudioSettings();
      case 'midi':
        return renderMidiSettings();
      case 'paths':
        return renderPathsSettings();
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-daw-bg-elevated border border-daw-border rounded-xl shadow-2xl w-[800px] max-h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-daw-border">
          <h2 className="text-xl font-bold text-daw-text-primary">Paramètres</h2>
          <button
            onClick={handleCancel}
            className="text-daw-text-muted hover:text-daw-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar tabs */}
          <div className="w-48 bg-daw-bg-secondary p-3 space-y-1 border-r border-daw-border">
            {tabs.map((tab) => (
              <TabButton
                key={tab.id}
                id={tab.id}
                label={tab.label}
                icon={tab.icon}
                isActive={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {renderTabContent()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-daw-border bg-daw-bg-secondary">
          <div className="text-xs text-daw-text-muted">
            {hasChanges && '• Modifications non enregistrées'}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={handleCancel}>
              Annuler
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Enregistrer les paramètres
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

SettingsDialog.displayName = 'SettingsDialog';

export default SettingsDialog;
