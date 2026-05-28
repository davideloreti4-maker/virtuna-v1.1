/** @vitest-environment happy-dom */
/**
 * Board state machine store — Phase 2 Plan 04 tests.
 *
 * Tests cover the 5-state machine transitions (idle/streaming/complete/
 * anti-virality/edit-input), camera accessors, and derived selectors.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Reset store between tests by re-importing a fresh instance
let useBoardStore: typeof import('@/stores/board-store').useBoardStore;
let selectIsStreaming: typeof import('@/stores/board-store').selectIsStreaming;
let selectIsComplete: typeof import('@/stores/board-store').selectIsComplete;
let selectIsAntiVirality: typeof import('@/stores/board-store').selectIsAntiVirality;
let selectDrawerOpen: typeof import('@/stores/board-store').selectDrawerOpen;

beforeEach(async () => {
  // Re-import fresh Zustand store instance each test (reset module cache)
  const mod = await import('@/stores/board-store');
  useBoardStore = mod.useBoardStore;
  selectIsStreaming = mod.selectIsStreaming;
  selectIsComplete = mod.selectIsComplete;
  selectIsAntiVirality = mod.selectIsAntiVirality;
  selectDrawerOpen = mod.selectDrawerOpen;
  // Reset to default state
  useBoardStore.setState({
    boardState: 'idle',
    preDrawerState: null,
    camera: { x: 0, y: 0, scale: 1 },
    activePreset: null,
    cameraAutoFollow: false,
    inputDrawerOpen: false,
    selectedNodeId: null,
    cancelConfirmOpen: false,
    lastUserInteractionAt: 0,
    currentStageLabel: null,
  });
});

// ── Initial state ──────────────────────────────────────────────────────────

describe('initial state', () => {
  it('starts in idle state', () => {
    expect(useBoardStore.getState().boardState).toBe('idle');
  });

  it('starts with default camera at origin, scale 1', () => {
    const { camera } = useBoardStore.getState();
    expect(camera).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it('starts with no auto-follow, no drawer, no selection', () => {
    const s = useBoardStore.getState();
    expect(s.cameraAutoFollow).toBe(false);
    expect(s.inputDrawerOpen).toBe(false);
    expect(s.selectedNodeId).toBeNull();
    expect(s.cancelConfirmOpen).toBe(false);
  });
});

// ── State machine transitions ──────────────────────────────────────────────

describe('startStreaming', () => {
  it('transitions idle → streaming', () => {
    useBoardStore.getState().startStreaming();
    expect(useBoardStore.getState().boardState).toBe('streaming');
  });

  it('enables cameraAutoFollow', () => {
    useBoardStore.getState().startStreaming();
    expect(useBoardStore.getState().cameraAutoFollow).toBe(true);
  });

  it('closes any open drawer', () => {
    // Set up drawer-open state first
    useBoardStore.setState({ inputDrawerOpen: true });
    useBoardStore.getState().startStreaming();
    expect(useBoardStore.getState().inputDrawerOpen).toBe(false);
  });

  it('closes any open cancel confirm', () => {
    useBoardStore.setState({ cancelConfirmOpen: true });
    useBoardStore.getState().startStreaming();
    expect(useBoardStore.getState().cancelConfirmOpen).toBe(false);
  });
});

describe('finishStreaming', () => {
  it('transitions streaming → complete', () => {
    useBoardStore.getState().startStreaming();
    useBoardStore.getState().finishStreaming();
    expect(useBoardStore.getState().boardState).toBe('complete');
  });

  it('transitions idle → complete for permalink replay', () => {
    // /analyze/[id] direct nav lands user on idle, then result hydrates and
    // the board jumps straight to complete (no streaming phase to finish).
    useBoardStore.getState().finishStreaming();
    expect(useBoardStore.getState().boardState).toBe('complete');
  });

  it('is a no-op when in a terminal non-idle/streaming state', () => {
    useBoardStore.getState().startStreaming();
    useBoardStore.getState().finishStreaming();
    useBoardStore.getState().triggerAntiVirality(); // anti-virality
    useBoardStore.getState().finishStreaming();
    expect(useBoardStore.getState().boardState).toBe('anti-virality');
  });
});

describe('triggerAntiVirality', () => {
  it('transitions complete → anti-virality', () => {
    useBoardStore.getState().startStreaming();
    useBoardStore.getState().finishStreaming();
    useBoardStore.getState().triggerAntiVirality();
    expect(useBoardStore.getState().boardState).toBe('anti-virality');
  });

  it('transitions idle → anti-virality for permalink replay', () => {
    // Permalink replay of an anti-virality-gated analysis: board hydrates
    // directly into anti-virality without passing through streaming.
    useBoardStore.getState().triggerAntiVirality();
    expect(useBoardStore.getState().boardState).toBe('anti-virality');
  });

  it('is a no-op during streaming (anti-virality only fires after completion)', () => {
    useBoardStore.getState().startStreaming();
    useBoardStore.getState().triggerAntiVirality();
    expect(useBoardStore.getState().boardState).toBe('streaming');
  });
});

describe('openInputDrawer / closeInputDrawer', () => {
  it('opens drawer in edit-input state from idle', () => {
    useBoardStore.getState().openInputDrawer();
    const s = useBoardStore.getState();
    expect(s.boardState).toBe('edit-input');
    expect(s.inputDrawerOpen).toBe(true);
  });

  it('stores preDrawerState when opening from idle', () => {
    useBoardStore.getState().openInputDrawer();
    expect(useBoardStore.getState().preDrawerState).toBe('idle');
  });

  it('stores preDrawerState when opening from complete', () => {
    useBoardStore.getState().startStreaming();
    useBoardStore.getState().finishStreaming();
    useBoardStore.getState().openInputDrawer();
    expect(useBoardStore.getState().preDrawerState).toBe('complete');
  });

  it('restores preDrawerState on close — idle → edit-input → idle', () => {
    useBoardStore.getState().openInputDrawer();
    useBoardStore.getState().closeInputDrawer();
    const s = useBoardStore.getState();
    expect(s.boardState).toBe('idle');
    expect(s.inputDrawerOpen).toBe(false);
    expect(s.preDrawerState).toBeNull();
  });

  it('restores preDrawerState on close — complete → edit-input → complete', () => {
    useBoardStore.getState().startStreaming();
    useBoardStore.getState().finishStreaming();
    useBoardStore.getState().openInputDrawer();
    useBoardStore.getState().closeInputDrawer();
    expect(useBoardStore.getState().boardState).toBe('complete');
  });

  it('openInputDrawer is a no-op during streaming', () => {
    useBoardStore.getState().startStreaming();
    useBoardStore.getState().openInputDrawer();
    const s = useBoardStore.getState();
    expect(s.boardState).toBe('streaming');
    expect(s.inputDrawerOpen).toBe(false);
  });

  it('closeInputDrawer is a no-op when not in edit-input', () => {
    useBoardStore.getState().closeInputDrawer();
    expect(useBoardStore.getState().boardState).toBe('idle');
  });
});

describe('resetToIdle', () => {
  it('resets from streaming back to idle', () => {
    useBoardStore.getState().startStreaming();
    useBoardStore.getState().resetToIdle();
    expect(useBoardStore.getState().boardState).toBe('idle');
  });

  it('resets all state to defaults', () => {
    useBoardStore.getState().startStreaming();
    useBoardStore.getState().finishStreaming();
    useBoardStore.setState({ selectedNodeId: 'node-1', cancelConfirmOpen: true });
    useBoardStore.getState().resetToIdle();
    const s = useBoardStore.getState();
    expect(s.boardState).toBe('idle');
    expect(s.cameraAutoFollow).toBe(false);
    expect(s.inputDrawerOpen).toBe(false);
    expect(s.selectedNodeId).toBeNull();
    expect(s.cancelConfirmOpen).toBe(false);
  });
});

// ── Camera actions ─────────────────────────────────────────────────────────

describe('camera actions', () => {
  it('setCamera updates camera position and scale', () => {
    useBoardStore.getState().setCamera({ x: 100, y: 200, scale: 1.5 });
    expect(useBoardStore.getState().camera).toEqual({ x: 100, y: 200, scale: 1.5 });
  });

  it('setActivePreset updates activePreset', () => {
    useBoardStore.getState().setActivePreset('audience');
    expect(useBoardStore.getState().activePreset).toBe('audience');
  });

  it('userOverrideCameraFollow sets cameraAutoFollow to false', () => {
    useBoardStore.getState().startStreaming(); // sets autoFollow true
    expect(useBoardStore.getState().cameraAutoFollow).toBe(true);
    useBoardStore.getState().userOverrideCameraFollow();
    expect(useBoardStore.getState().cameraAutoFollow).toBe(false);
  });

  it('enableCameraAutoFollow sets cameraAutoFollow to true', () => {
    useBoardStore.getState().enableCameraAutoFollow();
    expect(useBoardStore.getState().cameraAutoFollow).toBe(true);
  });
});

// ── Node selection ─────────────────────────────────────────────────────────

describe('selectNode', () => {
  it('sets selectedNodeId', () => {
    useBoardStore.getState().selectNode('node-abc');
    expect(useBoardStore.getState().selectedNodeId).toBe('node-abc');
  });

  it('clears selectedNodeId when passed null', () => {
    useBoardStore.getState().selectNode('node-abc');
    useBoardStore.getState().selectNode(null);
    expect(useBoardStore.getState().selectedNodeId).toBeNull();
  });
});

// ── Cancel confirm dialog ──────────────────────────────────────────────────

describe('cancelConfirm dialog', () => {
  it('opens and closes', () => {
    useBoardStore.getState().openCancelConfirm();
    expect(useBoardStore.getState().cancelConfirmOpen).toBe(true);
    useBoardStore.getState().closeCancelConfirm();
    expect(useBoardStore.getState().cancelConfirmOpen).toBe(false);
  });
});

// ── Derived selectors ──────────────────────────────────────────────────────

describe('derived selectors', () => {
  it('selectIsStreaming is true only during streaming', () => {
    expect(selectIsStreaming(useBoardStore.getState())).toBe(false);
    useBoardStore.getState().startStreaming();
    expect(selectIsStreaming(useBoardStore.getState())).toBe(true);
    useBoardStore.getState().finishStreaming();
    expect(selectIsStreaming(useBoardStore.getState())).toBe(false);
  });

  it('selectIsComplete is true for complete + anti-virality', () => {
    useBoardStore.getState().startStreaming();
    useBoardStore.getState().finishStreaming();
    expect(selectIsComplete(useBoardStore.getState())).toBe(true);
    useBoardStore.getState().triggerAntiVirality();
    expect(selectIsComplete(useBoardStore.getState())).toBe(true);
  });

  it('selectIsAntiVirality is true only for anti-virality', () => {
    expect(selectIsAntiVirality(useBoardStore.getState())).toBe(false);
    useBoardStore.getState().startStreaming();
    useBoardStore.getState().finishStreaming();
    expect(selectIsAntiVirality(useBoardStore.getState())).toBe(false);
    useBoardStore.getState().triggerAntiVirality();
    expect(selectIsAntiVirality(useBoardStore.getState())).toBe(true);
  });

  it('selectDrawerOpen matches inputDrawerOpen', () => {
    expect(selectDrawerOpen(useBoardStore.getState())).toBe(false);
    useBoardStore.getState().openInputDrawer();
    expect(selectDrawerOpen(useBoardStore.getState())).toBe(true);
  });
});
