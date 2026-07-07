/**
 * Board State Machine store — Phase 2 Plan 04 (D-18, D-19, CONTEXT.md).
 *
 * State machine has 4 states:
 *   idle          — no analysis active; empty board visible
 *   streaming     — SSE stream active; Engine frames animate, camera auto-follows
 *   complete      — analysis finished; camera glides to Audience+Verdict hero pair
 *   anti-virality — complete + threshold triggered; orange treatment on Verdict+Audience
 *
 * Camera state lives here so Board.tsx can swap useState for store selectors
 * (see Board.tsx comment). Non-camera ephemeral UI (selected node, cancel
 * confirmation, input-bar focus pulse) also lives here.
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
  | 'anti-virality';

// ── Store slice types ───────────────────────────────────────────────────────

export interface PendingVideo {
  thumbnail: string;
  duration: number;
  frames: Record<number, string>;
  /**
   * Object URL (`URL.createObjectURL`) for the locally selected file, kept for
   * frame-accurate scrubbing on the board before the analysis is persisted. Set
   * by content-form for video_upload mode only. Revoked when replaced/cleared.
   */
  objectUrl?: string;
}

export interface BoardState {
  /** Current board machine state (D-18) */
  boardState: BoardMachineState;

  /** Camera position and zoom in world-space (D-08, D-10) */
  camera: Camera;

  /** Active camera preset key, or null if user has overridden */
  activePreset: CameraPresetKey | null;

  /**
   * True while camera is auto-following SSE stages (D-09).
   * Resets to false on any user-initiated pan/zoom.
   */
  cameraAutoFollow: boolean;

  /** ID of the focused/selected node, or null */
  selectedNodeId: string | null;

  /** True while a streaming cancellation confirmation dialog is shown (D-17) */
  cancelConfirmOpen: boolean;

  /**
   * Epoch ms of the last user-initiated camera interaction (pan / zoom).
   * Used by auto-pan callers (e.g. EngineGroup plan 2.13) to suppress glides within 3s of
   * user touch (RESEARCH Pitfall 3, auto-pan contract in Board.tsx JSDoc).
   */
  lastUserInteractionAt: number;

  /**
   * Human-readable label of the currently active pipeline stage, or null when idle/complete.
   * Set by EngineGroup via `transition({ type: 'STAGE_UPDATE', stage })` so command bar
   * placeholder (plan 2.6) reflects the current stage (UI-SPEC §Streaming Placeholder).
   */
  currentStageLabel: string | null;

  /**
   * Monotonic counter that increments when something requests the input bar
   * receive focus (Input node tap, "Run another analysis", etc). The CommandBar
   * watches this and focuses its textarea on change.
   */
  inputBarFocusPulse: number;

  /** Thumbnail + frames extracted from the locally selected video file before analysis. */
  pendingVideo: PendingVideo | null;

  /**
   * Monotonic counter incremented each time the user clicks "New analysis".
   * Board.tsx watches this to reset stream + state even when already on /analyze.
   */
  newAnalysisSignal: number;

  /**
   * Monotonic counter incremented when the ACTIVE chat thread changes (sidebar
   * "New Thread" or re-opening a past thread). The home composer watches this to
   * clear its rendered thread content and refetch the now-active open thread —
   * the in-memory equivalent of a remount when navigating /home → /home.
   */
  activeThreadSignal: number;

  /**
   * The id of the currently-open chat thread (null on a fresh/blank new thread).
   * Drives the sidebar's active-row highlight — decoupled from list position, so
   * re-opening an OLD thread highlights it without jumping it to the top (the
   * highlight no longer assumes "active == row 0"). Set by the sidebar on open /
   * new, and synced by the composer from the rehydrated thread id on refresh.
   */
  activeThreadId: string | null;
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

  /**
   * Request that the bottom command bar receive focus. Pulses
   * `inputBarFocusPulse`; coerces `boardState` to `idle` from complete/AV (no-op
   * while streaming). Name kept for call-site stability after the input drawer
   * was removed in favour of an always-visible CommandBar form.
   */
  openInputDrawer: () => void;

  /** Hard reset to idle (e.g. "New analysis" CTA). */
  resetToIdle: () => void;

  /** Increment newAnalysisSignal so Board resets even when already on /analyze. */
  triggerNewAnalysis: () => void;

  /**
   * Switch the active chat thread: hard-reset board state AND pulse
   * activeThreadSignal so the home composer reloads the now-active thread.
   * Called after the server-side new/activate request resolves.
   */
  switchThread: () => void;

  /** Set the currently-open thread id (drives the sidebar active-row highlight). */
  setActiveThreadId: (id: string | null) => void;

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

  // ── Stage label ──────────────────────────────────────────────────────────

  /**
   * Dispatches a board transition event.
   * Currently supports: `{ type: 'STAGE_UPDATE'; stage: string }` — sets `currentStageLabel`
   * for command bar placeholder (plan 2.6) and future consumers.
   */
  transition: (event: { type: 'STAGE_UPDATE'; stage: string }) => void;

  // ── Pending video ────────────────────────────────────────────────────────────
  setPendingVideo: (v: PendingVideo | null) => void;
  clearPendingVideo: () => void;
}

// ── Default state ───────────────────────────────────────────────────────────

const DEFAULT_CAMERA: Camera = { x: 0, y: 0, scale: CAMERA_DEFAULT_SCALE };

const DEFAULT_STATE: BoardState = {
  boardState: 'idle',
  camera: DEFAULT_CAMERA,
  activePreset: null,
  cameraAutoFollow: false,
  selectedNodeId: null,
  cancelConfirmOpen: false,
  lastUserInteractionAt: 0,
  currentStageLabel: null,
  inputBarFocusPulse: 0,
  pendingVideo: null,
  newAnalysisSignal: 0,
  activeThreadSignal: 0,
  activeThreadId: null,
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
      cancelConfirmOpen: false,
    }),

  finishStreaming: () =>
    // Idle → complete permitted for permalink replay (user lands on
    // /analyze/[id] directly; no streaming phase happened). Keeps streaming
    // → complete identical to before.
    set((s) => ({
      boardState:
        s.boardState === 'streaming' || s.boardState === 'idle'
          ? 'complete'
          : s.boardState,
    })),

  triggerAntiVirality: () =>
    // Same permalink-replay relaxation: allow idle → anti-virality so the
    // cross-group ripple lights up Audience + Actions even when no streaming
    // phase preceded.
    set((s) => ({
      boardState:
        s.boardState === 'complete' || s.boardState === 'idle'
          ? 'anti-virality'
          : s.boardState,
    })),

  openInputDrawer: () =>
    // Legacy name retained for call-site stability. With the drawer removed, this
    // now (a) coerces complete/AV back to idle so the bar's form is editable,
    // and (b) pulses the focus counter so the CommandBar focuses its textarea.
    // Streaming is left alone.
    set((s) => {
      if (s.boardState === 'streaming') return {};
      return {
        boardState: 'idle',
        inputBarFocusPulse: s.inputBarFocusPulse + 1,
      };
    }),

  resetToIdle: () => set({ ...DEFAULT_STATE }),

  triggerNewAnalysis: () => set((s) => ({ ...DEFAULT_STATE, newAnalysisSignal: s.newAnalysisSignal + 1 })),

  switchThread: () =>
    set((s) => ({
      ...DEFAULT_STATE,
      newAnalysisSignal: s.newAnalysisSignal + 1,
      activeThreadSignal: s.activeThreadSignal + 1,
      // Preserve the active-thread id across the reset — the caller sets it
      // explicitly right after (open → id, new → null); keeping it here avoids a
      // one-frame highlight flicker between the switch and the caller's set.
      activeThreadId: s.activeThreadId,
    })),

  setActiveThreadId: (id) => set({ activeThreadId: id }),

  // ── Camera ──────────────────────────────────────────────────────────────

  setCamera: (camera) => set({ camera }),

  setActivePreset: (activePreset) => set({ activePreset }),

  userOverrideCameraFollow: () => set({ cameraAutoFollow: false, lastUserInteractionAt: Date.now() }),

  enableCameraAutoFollow: () => set({ cameraAutoFollow: true }),

  // ── Node selection ──────────────────────────────────────────────────────

  selectNode: (selectedNodeId) => set({ selectedNodeId }),

  // ── Cancel confirmation dialog ──────────────────────────────────────────

  openCancelConfirm: () => set({ cancelConfirmOpen: true }),

  closeCancelConfirm: () => set({ cancelConfirmOpen: false }),

  // ── Stage label ──────────────────────────────────────────────────────────

  transition: (event) => {
    if (event.type === 'STAGE_UPDATE') {
      set({ currentStageLabel: event.stage });
    }
  },

  // ── Pending video ────────────────────────────────────────────────────────────
  // Revoke the prior object URL before replacing/clearing so a stream of file
  // selections (or "New analysis") doesn't leak blob handles for the session.
  setPendingVideo: (pendingVideo) =>
    set((s) => {
      const prev = s.pendingVideo?.objectUrl;
      if (prev && prev !== pendingVideo?.objectUrl) revokeObjectUrl(prev);
      return { pendingVideo };
    }),
  clearPendingVideo: () =>
    set((s) => {
      if (s.pendingVideo?.objectUrl) revokeObjectUrl(s.pendingVideo.objectUrl);
      return { pendingVideo: null };
    }),
}));

/** Best-effort blob URL revoke — guarded for SSR / non-DOM test envs. */
function revokeObjectUrl(url: string): void {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* no-op */
    }
  }
}

// ── Derived selectors ────────────────────────────────────────────────────────

/** True when any analysis is active (streaming or polling-complete). */
export const selectIsStreaming = (s: BoardState) => s.boardState === 'streaming';

/** True when the board has a completed result to display. */
export const selectIsComplete = (s: BoardState) =>
  s.boardState === 'complete' || s.boardState === 'anti-virality';

/** True when anti-virality orange treatment should be applied. */
export const selectIsAntiVirality = (s: BoardState) =>
  s.boardState === 'anti-virality';
