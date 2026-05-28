'use client';
/**
 * Auto-pan contract for downstream plans (2.13 Engine, future Audience):
 * - If `usePrefersReducedMotion()` is true → DO NOT call `goToPreset`.
 * - If `Date.now() - useBoardStore.getState().lastUserInteractionAt < 3000` → DO NOT call `goToPreset`.
 * - Throttle: at most one glide per wave boundary (Wave 0→1, 1→2, 2→3, complete).
 * RESEARCH Pitfall 3 + Open Question 2.
 */
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, useMemo, createRef } from 'react';
import type { RefObject } from 'react';
import { useRovingTabIndex } from '@/lib/a11y';
import { Skeleton } from '@/components/ui/skeleton';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useBoardStore } from '@/stores/board-store';
import type { BoardMachineState } from '@/stores/board-store';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { CommandBar } from '@/components/command-bar/CommandBar';
import { useCamera, serializeCamera } from './use-camera';
import { useBoardKeyboard } from './use-board-keyboard';
import { CameraOverlay } from './CameraOverlay';
import { OrientationHint } from './OrientationHint';
import { GROUP_FRAMES, CAMERA_DEFAULT_SCALE } from './board-constants';
import { GroupFrame } from './GroupFrame';
import { getFrameAntiViralityState } from './cross-group-state';
import { GroupFrameOverlay } from './GroupFrameOverlay';
import { EngineGroup } from './EngineGroup';
import { AudienceNode } from './audience/AudienceNode';
import { VerdictNode } from './verdict/VerdictNode';
import { ActionsNode } from './actions/ActionsNode';
import { ContentAnalysisFrame } from './content-analysis/ContentAnalysisFrame';
import { InputNodeShape, InputNodeOverlay } from './InputNode';
import { InputDrawer } from './InputDrawer';
import type { GroupId } from './board-types';
import type { FrameVisualState } from './GroupFrame';
import { detectInitialTier, startFpsSampler, usePerfStore, nextLowerTier } from '@/lib/perf-tier';
import { useToast } from '@/components/ui/toast';

/**
 * Derives per-frame visual state from the board machine state.
 * Anti-virality treatment applies only to Verdict + Audience frames (UI-SPEC §State Machine Transitions).
 * Extended in plan 2.13 with panelReady mapping for per-panel streaming progress.
 */
function deriveFrameVisual(
  boardMachineState: BoardMachineState,
  frameId: GroupId,
): FrameVisualState {
  return getFrameAntiViralityState(frameId, boardMachineState);
}

// CRITICAL: dynamic import with ssr:false (RESEARCH Pattern 1). Without ssr:false,
// react-konva touches `window` at module load and SSR throws.
const BoardCanvas = dynamic(
  () => import('./BoardCanvas').then((m) => ({ default: m.BoardCanvas })),
  { ssr: false, loading: () => <Skeleton className="absolute inset-0" /> },
);

export function Board() {
  const reducedMotion = usePrefersReducedMotion();

  // Performance tier (plan 2.10) — tier=low coerces reduced-motion gates
  const tier = usePerfStore((s) => s.tier);
  const setTier = usePerfStore((s) => s.setTier);
  const effectiveReducedMotion = reducedMotion || tier === 'low';
  const { toast } = useToast();

  // Board machine state for frame visual derivation (plan 2.2)
  const boardMachineState = useBoardStore((s) => s.boardState);

  // Per-frame expanded state (all start expanded; user collapses via chevron)
  const [expanded, setExpanded] = useState<Record<GroupId, boolean>>(() =>
    Object.fromEntries(GROUP_FRAMES.map((f) => [f.id, true])) as Record<GroupId, boolean>,
  );

  // Roving tabindex across group frames (plan 2.11 NF2 — arrow-key navigation).
  // Exactly one frame has tabIndex=0 at a time; all others -1.
  // Arrow keys (← → ↑ ↓) + Home/End move focus within the group.
  const frameRefs = useRef<Array<RefObject<HTMLDivElement | null>>>(
    GROUP_FRAMES.map(() => createRef<HTMLDivElement>()),
  );
  // Ensure refs array stays in sync if GROUP_FRAMES ever changes length.
  if (frameRefs.current.length !== GROUP_FRAMES.length) {
    frameRefs.current = GROUP_FRAMES.map(() => createRef<HTMLDivElement>());
  }
  const { getTabIndex, setActive } = useRovingTabIndex(frameRefs.current);

  // Camera state from board-store (Plan 2.4). Replaces prior local useState.
  const camera = useBoardStore((s) => s.camera);
  const setCamera = useBoardStore((s) => s.setCamera);
  const activePreset = useBoardStore((s) => s.activePreset);
  const setActivePreset = useBoardStore((s) => s.setActivePreset);
  const userOverrideCameraFollow = useBoardStore((s) => s.userOverrideCameraFollow);

  // ── Plan 2.6: stream→board wiring ──────────────────────────────────────────
  const stream = useAnalysisStream();
  const startStreaming = useBoardStore((s) => s.startStreaming);
  const finishStreaming = useBoardStore((s) => s.finishStreaming);
  const triggerAntiVirality = useBoardStore((s) => s.triggerAntiVirality);
  const resetToIdle = useBoardStore((s) => s.resetToIdle);

  // WR-01: track which analysisId we started streaming for, so that if the
  // user resets and a new stream starts we don't fire anti-virality against
  // a stale result from the previous run.
  const streamingAnalysisIdRef = useRef<string | null>(null);

  // Map useAnalysisStream phase → board state machine transitions.
  useEffect(() => {
    switch (stream.phase) {
      case 'analyzing':
      case 'reconnecting':
      case 'polling': {
        const current = useBoardStore.getState().boardState;
        if (current !== 'streaming') {
          startStreaming();
          streamingAnalysisIdRef.current = stream.analysisId ?? null;
        }
        break;
      }
      case 'complete': {
        finishStreaming();
        // WR-01: only trigger anti-virality when result correlates with the
        // analysis we started streaming for (guards against stale result on
        // reconnect or after resetToIdle + immediate re-analyze).
        if (
          stream.result &&
          stream.analysisId != null &&
          stream.analysisId === streamingAnalysisIdRef.current
        ) {
          const antiVir = Boolean((stream.result as { antiVirality?: unknown }).antiVirality);
          if (antiVir) triggerAntiVirality();
        }
        break;
      }
      case 'error':
        streamingAnalysisIdRef.current = null;
        resetToIdle();
        break;
      // 'idle' — no transition needed
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.phase, stream.result, stream.analysisId]);

  // CR-02: unified atomic URL update — merges the former pushState (analysisId)
  // and the debounced replaceState (camera/preset) into one effect so they can
  // never race and produce a URL missing the pathname or the query string.
  useEffect(() => {
    if (!stream.analysisId || typeof window === 'undefined') return;
    const qs = serializeCamera({ preset: activePreset, zoom: camera.scale });
    const target = `/analyze/${stream.analysisId}?${qs}`;
    if (window.location.pathname + window.location.search !== target) {
      window.history.replaceState(null, '', target);
    }
  }, [stream.analysisId, activePreset, camera.scale]);

  // Extract the latest human-readable stage slug from the stream stages array.
  // Plan 2.13 will replace slugs with a label mapping; for Phase 2 the slug is
  // passed through and falls back to "Analyzing…" when null.
  const currentStage = useMemo(() => {
    const last = [...stream.stages].reverse().find((s) => s.type === 'stage_start');
    return last ? last.stage : null;
  }, [stream.stages]);

  const handleCommandSubmit = (text: string) => {
    const isUrl = /^https?:\/\//i.test(text);
    stream.start({
      input_mode: isUrl ? 'tiktok_url' : 'text',
      content_type: isUrl ? 'video' : 'post',
      ...(isUrl ? { tiktok_url: text } : { content_text: text }),
    }).catch(() => {
      // Error handled by stream.phase → 'error' transition above.
    });
  };

  const handleCommandStop = () => {
    // Phase 2: no dedicated abort() in the hook (Phase 1 D-02 lock).
    // resetToIdle() provides immediate UI feedback. See SUMMARY known limitations.
    resetToIdle();
  };
  // ── End plan 2.6 ───────────────────────────────────────────────────────────

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Detect initial GPU tier post-mount (Pitfall 5: never block first paint)
  useEffect(() => {
    let cancelled = false;
    detectInitialTier().then((detectedTier) => {
      if (!cancelled) setTier(detectedTier);
    });
    return () => { cancelled = true; };
  }, [setTier]);

  // Runtime FPS sampler — auto-downgrades tier once on sustained low fps
  useEffect(() => {
    const cancel = startFpsSampler(() => {
      const dropped = nextLowerTier(usePerfStore.getState().tier);
      usePerfStore.getState().setTier(dropped);
      try {
        localStorage.setItem('virtuna-perf-tier', dropped);
        localStorage.setItem('virtuna-perf-tier-at', String(Date.now()));
      } catch { /* ignore */ }
      toast({ title: 'Optimized for your device', variant: 'default' });
    });
    return cancel;
  }, [toast]);

  // WR-05: viewport is real once ResizeObserver has fired (not the 800×600 default).
  const viewportReady = !(viewport.width === 800 && viewport.height === 600);

  const { goToPreset } = useCamera({
    camera, setCamera, viewport, viewportReady, activePreset, setActivePreset, reducedMotion: effectiveReducedMotion,
  });

  // Plan 2.13: EngineGroup sets activePreset on wave boundaries; Board subscribes here
  // and calls goToPreset to execute the actual camera glide (goToPreset lives in Board,
  // not accessible to EngineGroup directly).
  useEffect(() => {
    if (activePreset) goToPreset(activePreset);
  }, [activePreset, goToPreset]);

  // Auto-fit to overview on first real viewport measurement when no URL preset was applied.
  // Prevents the 1352×872 board rendering at scale=1 (overflowing viewport) on first load.
  const initialFitApplied = useRef(false);
  useEffect(() => {
    if (initialFitApplied.current) return;
    if (viewport.width === 800 && viewport.height === 600) return; // default, not yet real
    initialFitApplied.current = true;
    const cam = useBoardStore.getState().camera;
    if (cam.x === 0 && cam.y === 0 && cam.scale === CAMERA_DEFAULT_SCALE) {
      goToPreset('overview');
    }
  }, [viewport, goToPreset]);

  useBoardKeyboard({ goToPreset });

  return (
    <div
      ref={wrapperRef}
      className="relative h-screen w-full overflow-hidden bg-background"
      role="application"
      aria-label="Analysis board"
    >
      <BoardCanvas
        camera={camera}
        setCamera={setCamera}
        onUserInteract={userOverrideCameraFollow}
        width={viewport.width}
        height={viewport.height}
      >
        {GROUP_FRAMES.map((layout) => (
          <GroupFrame
            key={layout.id}
            layout={layout}
            visual={deriveFrameVisual(boardMachineState, layout.id)}
          />
        ))}
        {/* Plan 2.7: Input node Konva hit-test shape; selection wiring deferred to Phase 4 */}
        <InputNodeShape selected={false} />
      </BoardCanvas>

      {/* Plan 2.6: context-aware command bar — z=200, fixed bottom-center.
          IMPORTANT: Rendered BEFORE the frame overlay loop so its <input> is the
          first tab stop inside the canvas region (DOM order = tab order for z=0 elements).
          Tab order: Sidebar → CommandBar → Group frames (roving) → CameraOverlay presets */}
      <CommandBar
        currentStage={currentStage}
        onSubmit={handleCommandSubmit}
        onStop={handleCommandStop}
      />

      {/* DOM overlay layer: title bars, ARIA, empty-state copy. pointer-events-none
          keeps Konva pan/zoom hit-test alive; individual overlays restore pointer-events-auto.
          Group frames use roving tabindex (plan 2.11): one frame has tabIndex=0, rest -1.
          Arrow keys (←→↑↓) move focus within the group. */}
      <div className="pointer-events-none absolute inset-0">
        {GROUP_FRAMES.map((layout, i) => (
          <GroupFrameOverlay
            key={layout.id}
            ref={(el) => { frameRefs.current[i]!.current = el; }}
            tabIndex={getTabIndex(i) as 0 | -1}
            onFocus={() => setActive(i)}
            layout={layout}
            camera={camera}
            visual={deriveFrameVisual(boardMachineState, layout.id)}
            expanded={expanded[layout.id]}
            onToggleExpanded={() => setExpanded((s) => ({ ...s, [layout.id]: !s[layout.id] }))}
            reducedMotion={effectiveReducedMotion}
          >
            {layout.id === 'engine' && <EngineGroup />}
            {layout.id === 'audience' && <AudienceNode camera={camera} layout={layout} />}
            {layout.id === 'verdict' && <VerdictNode camera={camera} layout={layout} />}
            {layout.id === 'actions' && <ActionsNode camera={camera} layout={layout} />}
            {layout.id === 'content-analysis' && <ContentAnalysisFrame camera={camera} layout={layout} />}
          </GroupFrameOverlay>
        ))}
        {/* Plan 2.7: Input node DOM overlay — thumbnailUrl/snippet wired in future plan */}
        <InputNodeOverlay camera={camera} thumbnailUrl={null} snippet={null} />
      </div>

      {/* Plan 2.7: Input drawer — Radix Sheet, renders in portal above board */}
      <InputDrawer />

      {/* DOM overlay slots (filled by plans 2.6 command bar, 2.7 input node, etc.) */}
      <CameraOverlay activePreset={activePreset} onSelect={goToPreset} />

      {/* R7.4 first-board orientation hint — z=150, above board content, below command bar (z=200) */}
      <OrientationHint />
    </div>
  );
}
