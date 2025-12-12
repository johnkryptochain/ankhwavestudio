// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SongEditor } from '../../components/editors/SongEditor';
import { useSongStore, useTracks } from '../../stores/songStore';

// Mock stores
vi.mock('../../stores/songStore', () => ({
  useSongStore: Object.assign(vi.fn(), {
    getState: vi.fn(),
  }),
  useTracks: vi.fn(),
}));

vi.mock('../../stores/transportStore', () => ({
  useTransportStore: () => ({
    position: 0,
    isPlaying: false,
    loopStart: 0,
    loopEnd: 0,
    loopEnabled: false,
  }),
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: () => ({
    setActiveEditor: vi.fn(),
  }),
}));

vi.mock('../../stores/historyStore', () => ({
  useHistoryStore: () => ({
    executeCommand: (cmd: any) => cmd.execute(),
  }),
}));

// Mock AudioEngineManager
vi.mock('../../audio/AudioEngineManager', () => ({
  getAudioEngineManager: () => ({
    getAudioContext: () => ({
      currentTime: 0,
      state: 'suspended',
    }),
  }),
}));

describe('SongEditor Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render track list and allow adding a track', () => {
    const addInstrumentTrackMock = vi.fn().mockReturnValue('new-track-id');
    const removeTrackMock = vi.fn();
    
    // Mock store state
    const mockAddInstrumentTrack = vi.fn().mockReturnValue('new-track-id');
    (useSongStore as any).mockReturnValue({
      addTrack: vi.fn(),
      addInstrumentTrack: mockAddInstrumentTrack,
      updateTrack: vi.fn(),
      removeTrack: removeTrackMock,
      removeClipFromTrack: vi.fn(),
      addClipToTrack: vi.fn(),
      setSelectedTrackId: vi.fn(),
      selectedTrackId: null,
    });
    
    // Mock getState for non-hook usage
    (useSongStore as any).getState.mockReturnValue({
      addInstrumentTrack: mockAddInstrumentTrack,
      removeTrack: removeTrackMock,
    });

    (useTracks as any).mockReturnValue([]);

    render(<SongEditor />);
    
    // Find the "Add Instrument Track" button
    const addInstrumentBtn = screen.getByText('+ Piste instrument');
    fireEvent.click(addInstrumentBtn);
    
    expect(mockAddInstrumentTrack).toHaveBeenCalled();
  });
});
