/** @vitest-environment happy-dom */
/**
 * Board state machine store tests.
 *
 * Covers the 4-state machine (idle / streaming / complete / anti-virality),
 * camera accessors, input-bar focus pulse (the openInputDrawer surface), and
 * derived selectors.
 */
import { describe, it, expect, beforeEach } from 'vitest';

let useBoardStore: typeof import('@/stores/board-store').useBoardStore;
let selectIsStreaming: typeof import('@/stores/board-store').selectIsStreaming;
let selectIsComplete: typeof import('@/stores/board-store').selectIsComplete;
let selectIsAntiVirality: typeof import('@/stores/board-store').selectIsAntiVirality;

beforeEach(async () => {
  const mod = await import('@/stores/board-store');
  useBoardStore = mod.useBoardStore;
  selectIsStreaming = mod.selectIsStreaming;
  selectIsComplete = mod.selectIsComplete;
  selectIsAntiVirality = mod.selectIsAntiVirality;
  useBoardStore.setState({
    boardState: 'idle',
    camera: { x: 0, y: 0, scale: 1 },
    activePreset: null,
    cameraAutoFollow: false,
    selectedNodeId: null,
    cancelConfirmOpen: false,
    lastUserInteractionAt: 0,
    currentStageLabel: null,
    inputBarFocusPulse: 0,
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

  it('starts with no auto-follow, no selection, no focus pulse', () => {
    const s = useBoardStore.getState();
    expect(s.cameraAutoFollow).toBe(false);
    expect(s.selectedNodeId).toBeNull();
    expect(s.cancelConfirmOpen).toBe(false);
    expect(s.inputBarFocusPulse).toBe(0);
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
    useBoardStore.getState().finishStreaming();
    expect(useBoardStore.getState().boardState).toBe('complete');
  });

  it('is a no-op when in a terminal non-idle/streaming state', () => {
    useBoardStore.getState().startStreaming();
    useBoardStore.getState().finishStreaming();
    useBoardStore.getState().triggerAntiVirality();
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
    useBoardStore.getState().triggerAntiVirality();
    expect(useBoardStore.getState().boardState).toBe('anti-virality');
  });

  it('is a no-op during streaming', () => {
    useBoardStore.getState().startStreaming();
    useBoardStore.getState().triggerAntiVirality();
    expect(useBoardStore.getState().boardState).toBe('streaming');
  });
});

describe('openInputDrawer (input-bar focus pulse)', () => {
  it('pulses focus counter and stays idle when called from idle', () => {
    useBoardStore.getState().openInputDrawer();
    const s = useBoardStore.getState();
    expect(s.boardState).toBe('idle');
    expect(s.inputBarFocusPulse).toBe(1);
  });

  it('coerces complete → idle and pulses focus', () => {
    useBoardStore.getState().startStreaming();
    useBoardStore.getState().finishStreaming();
    useBoardStore.getState().openInputDrawer();
    const s = useBoardStore.getState();
    expect(s.boardState).toBe('idle');
    expect(s.inputBarFocusPulse).toBe(1);
  });

  it('is a no-op during streaming', () => {
    useBoardStore.getState().startStreaming();
    const before = useBoardStore.getState().inputBarFocusPulse;
    useBoardStore.getState().openInputDrawer();
    const s = useBoardStore.getState();
    expect(s.boardState).toBe('streaming');
    expect(s.inputBarFocusPulse).toBe(before);
  });

  it('pulse counter increments monotonically across repeated calls', () => {
    useBoardStore.getState().openInputDrawer();
    useBoardStore.getState().openInputDrawer();
    useBoardStore.getState().openInputDrawer();
    expect(useBoardStore.getState().inputBarFocusPulse).toBe(3);
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
    expect(s.selectedNodeId).toBeNull();
    expect(s.cancelConfirmOpen).toBe(false);
    expect(s.inputBarFocusPulse).toBe(0);
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
    useBoardStore.getState().startStreaming();
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
});
