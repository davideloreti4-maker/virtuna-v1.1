/**
 * Board State Machine store — Phase 2 Plan 04 (D-18, D-19, CONTEXT.md).
 *
 * State machine has 5 states:
 *   idle        — no analysis active; empty board visible
 *   streaming   — SSE stream active; Engine frames animate, camera auto-follows
 *   complete    — analysis finished; camera glides to Audience+Verdict hero pair
 *   anti-virality — complete + threshold triggered; orange treatment on Verdict+Audience
 *   edit-input  — Input drawer open; board still visible, input being edited
 *
 * Camera state lives here so Board.tsx can swap useState for store selectors (see Board.tsx comment).
 * Non-camera ephemeral UI (drawer open, selected node) also lives here.
 *
 * Anti-virality is a cross-group coordinated state (D-19).
 * User touch override cancels camera auto-follow during streaming (D-09).
 */

import { create } from 'zustand';
import { CAMERA_DEFAULT_SCALE } from '@/components/board/board-constants';
import type { Camera, CameraPresetKey } from '@/components/board/board-types';

// ── Board machine states ────────────────────────────────────────────────────

export type BoardMachineState =
  | 'idle'
  | 'streaming'
  | 'complete'
  | 'anti-virality'
  | 'edit-input';

// ── Store slice types ───────────────────────────────────────────────────────

export interface BoardState {
  /** Current board machine state (D-18) */
  boardState: BoardMachineState;

  /**
   * State to restore when the Input drawer closes without re-running.
   * Set to the state before `edit-input` was entered (idle, complete, or anti-virality).
   * Null when boardState !== 'edit-input'.
   */
  preDrawerState: BoardMachineState | null;

  /** Camera position and zoom in world-space (D-08, D-10) */
  camera: Camera;

  /** Active camera preset key, or null if user has overridden */
  activePreset: CameraPresetKey | null;

  /**
   * True while camera is auto-following SSE stages (D-09).
   * Resets to false on any user-initiated pan/zoom.
   */
  cameraAutoFollow: boolean;

  /** True if the Input node drawer is open (D-16) */
  inputDrawerOpen: boolean;

  /** ID of the focused/selected node, or null */
  selectedNodeId: string | null;

  /** True while a streaming cancellation confirmation dialog is shown (D-17) */
  cancelConfirmOpen: boolean;
}

export interface BoardActions {
  // ── Machine transitions ─────────────────────────────────────────────────

  /** Transition idle → streaming. Called when user submits an analysis. */
  startStreaming: () => void;

  /** Transition streaming → complete. Called on SSE `complete` event. */
  finishStreaming: () => void;

  /**
   * Transition complete → anti-virality. Called when overall_score crosses
   * the anti-virality threshold (checked by the consumer after `finishStreaming`).
   */
  triggerAntiVirality: () => void;

  /** Open the Input drawer: any non-streaming state → edit-input. */
  openInputDrawer: () => void;

  /** Close the Input drawer: edit-input → prior state (idle/complete). */
  closeInputDrawer: () => void;

  /** Hard reset to idle (e.g. "New analysis" CTA). */
  resetToIdle: () => void;

  // ── Camera ──────────────────────────────────────────────────────────────

  setCamera: (camera: Camera) => void;
  setActivePreset: (preset: CameraPresetKey | null) => void;

  /**
   * Called on any user-initiated pan/zoom touch. Disables auto-follow (D-09).
   * Does NOT change boardState.
   */
  userOverrideCameraFollow: () => void;

  /** Re-enable auto-follow (used when a new streaming session starts). */
  enableCameraAutoFollow: () => void;

  // ── Node selection ──────────────────────────────────────────────────────

  selectNode: (id: string | null) => void;

  // ── Cancel confirmation dialog ──────────────────────────────────────────

  openCancelConfirm: () => void;
  closeCancelConfirm: () => void;
}

// ── Default state ───────────────────────────────────────────────────────────

const DEFAULT_CAMERA: Camera = { x: 0, y: 0, scale: CAMERA_DEFAULT_SCALE };

const DEFAULT_STATE: BoardState = {
  boardState: 'idle',
  preDrawerState: null,
  camera: DEFAULT_CAMERA,
  activePreset: null,
  cameraAutoFollow: false,
  inputDrawerOpen: false,
  selectedNodeId: null,
  cancelConfirmOpen: false,
};

// ── Store ────────────────────────────────────────────────────────────────────

/**
 * Board state machine store. Import `useBoardStore` in client components.
 *
 * @example
 *   const boardState = useBoardStore(s => s.boardState);
 *   const startStreaming = useBoardStore(s => s.startStreaming);
 */
export const useBoardStore = create<BoardState & BoardActions>((set) => ({
  ...DEFAULT_STATE,

  // ── Machine transitions ─────────────────────────────────────────────────

  startStreaming: () =>
    set({
      boardState: 'streaming',
      cameraAutoFollow: true,
      inputDrawerOpen: false,
      cancelConfirmOpen: false,
    }),

  finishStreaming: () =>
    set((s) => ({
      boardState: s.boardState === 'streaming' ? 'complete' : s.boardState,
    })),

  triggerAntiVirality: () =>
    set((s) => ({
      boardState: s.boardState === 'complete' ? 'anti-virality' : s.boardState,
    })),

  openInputDrawer: () =>
    set((s) => {
      // Only allowed when not actively streaming
      if (s.boardState === 'streaming') return {};
      return {
        boardState: 'edit-input',
        preDrawerState: s.boardState,
        inputDrawerOpen: true,
      };
    }),

  closeInputDrawer: () =>
    set((s) => {
      if (s.boardState !== 'edit-input') return {};
      // Restore the state we were in before the drawer opened.
      // If preDrawerState is null (shouldn't happen), default to idle.
      return {
        boardState: s.preDrawerState ?? 'idle',
        preDrawerState: null,
        inputDrawerOpen: false,
      };
    }),

  resetToIdle: () => set({ ...DEFAULT_STATE }),

  // ── Camera ──────────────────────────────────────────────────────────────

  setCamera: (camera) => set({ camera }),

  setActivePreset: (activePreset) => set({ activePreset }),

  userOverrideCameraFollow: () => set({ cameraAutoFollow: false }),

  enableCameraAutoFollow: () => set({ cameraAutoFollow: true }),

  // ── Node selection ──────────────────────────────────────────────────────

  selectNode: (selectedNodeId) => set({ selectedNodeId }),

  // ── Cancel confirmation dialog ──────────────────────────────────────────

  openCancelConfirm: () => set({ cancelConfirmOpen: true }),

  closeCancelConfirm: () => set({ cancelConfirmOpen: false }),
}));

// ── Derived selectors ────────────────────────────────────────────────────────

/** True when any analysis is active (streaming or polling-complete). */
export const selectIsStreaming = (s: BoardState) => s.boardState === 'streaming';

/** True when the board has a completed result to display. */
export const selectIsComplete = (s: BoardState) =>
  s.boardState === 'complete' || s.boardState === 'anti-virality';

/** True when anti-virality orange treatment should be applied. */
export const selectIsAntiVirality = (s: BoardState) =>
  s.boardState === 'anti-virality';

/** True when the Input drawer is open. */
export const selectDrawerOpen = (s: BoardState) => s.inputDrawerOpen;
