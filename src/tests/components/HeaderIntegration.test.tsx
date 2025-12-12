// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../../components/layout/Header';
import { useTransportStore } from '../../stores/transportStore';

// Mock the stores
vi.mock('../../stores/transportStore', () => ({
  useTransportStore: vi.fn(),
}));

vi.mock('../../stores/songStore', () => ({
  useSongStore: () => ({
    metadata: { name: 'Test Project' },
    isDirty: false,
    newProject: vi.fn(),
    settings: { timeSignature: { numerator: 4, denominator: 4 } },
    tracks: [],
  }),
}));

vi.mock('../../stores/uiStore', () => ({
  useUIStore: () => ({
    toggleSidebar: vi.fn(),
    sidebarOpen: true,
    toggleBottomPanel: vi.fn(),
    bottomPanelOpen: false,
    setActiveEditor: vi.fn(),
    openDialog: vi.fn(),
    selection: { selectedClipIds: [], selectedTrackIds: [], selectedNoteIds: [] },
  }),
}));

vi.mock('../../stores/historyStore', () => ({
  useHistoryStore: () => ({
    undo: vi.fn(),
    redo: vi.fn(),
    undoStack: [],
    redoStack: [],
  }),
}));

vi.mock('../../stores/clipboardStore', () => ({
  useClipboardStore: () => ({
    hasData: () => false,
  }),
  copyClips: vi.fn(),
  cutClips: vi.fn(),
  copyTracks: vi.fn(),
}));

describe('Header Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render project title', () => {
    (useTransportStore as any).mockReturnValue({
      isPlaying: false,
      isRecording: false,
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
    });

    render(<Header />);
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('should call play when play button is clicked', () => {
    const playMock = vi.fn();
    const pauseMock = vi.fn();
    
    // Mock the store state and actions
    (useTransportStore as any).mockReturnValue({
      isPlaying: false,
      isRecording: false,
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      play: playMock,
      pause: pauseMock,
      stop: vi.fn(),
    });

    render(<Header />);
    
    // Find play button by title
    const playButton = screen.getByTitle('Lecture (Espace)');
    fireEvent.click(playButton);
    
    expect(playMock).toHaveBeenCalled();
  });
});
