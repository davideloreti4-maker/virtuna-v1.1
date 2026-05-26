'use client';
/**
 * Auto-pan contract for downstream plans (2.13 Engine, future Audience):
 * - If `usePrefersReducedMotion()` is true → DO NOT call `goToPreset`.
 * - If `Date.now() - useBoardStore.getState().lastUserInteractionAt < 3000` → DO NOT call `goToPreset`.
 * - Throttle: at most one glide per wave boundary (Wave 0→1, 1→2, 2→3, complete).
 * RESEARCH Pitfall 3 + Open Question 2.
 */
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useBoardStore } from '@/stores/board-store';
import type { BoardMachineState } from '@/stores/board-store';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { CommandBar } from '@/components/command-bar/CommandBar';
import { useCamera } from './use-camera';
import { useBoardKeyboard } from './use-board-keyboard';
import { CameraOverlay } from './CameraOverlay';
import { OrientationHint } from './OrientationHint';
import { GROUP_FRAMES } from './board-constants';
import { GroupFrame } from './GroupFrame';
import { GroupFrameOverlay } from './GroupFrameOverlay';
import { EngineGroup } from './EngineGroup';
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
  if (boardMachineState === 'idle' || boardMachineState === 'edit-input') return 'idle';
  if (boardMachineState === 'streaming') return 'streaming';
  // complete or anti-virality
  if (boardMachineState === 'anti-virality' && (frameId === 'verdict' || frameId === 'audience')) {
    return 'anti-virality';
  }
  return 'complete';
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

  // Map useAnalysisStream phase → board state machine transitions.
  useEffect(() => {
    switch (stream.phase) {
      case 'analyzing':
      case 'reconnecting':
      case 'polling': {
        const current = useBoardStore.getState().boardState;
        if (current !== 'streaming') startStreaming();
        break;
      }
      case 'complete': {
        finishStreaming();
        if (stream.result) {
          const antiVir = Boolean((stream.result as { antiVirality?: unknown }).antiVirality);
          if (antiVir) triggerAntiVirality();
        }
        break;
      }
      case 'error':
        resetToIdle();
        break;
      // 'idle' — no transition needed
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.phase, stream.result]);

  // URL pushState on analysisId assignment (D-01: pushState for id transitions).
  useEffect(() => {
    if (stream.analysisId && typeof window !== 'undefined') {
      const targetPath = `/analyze/${stream.analysisId}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  }, [stream.analysisId]);

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
      content_type: isUrl ? 'tiktok_url' : 'text',
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

  const { goToPreset } = useCamera({
    camera, setCamera, viewport, activePreset, setActivePreset, reducedMotion: effectiveReducedMotion,
  });

  // Plan 2.13: EngineGroup sets activePreset on wave boundaries; Board subscribes here
  // and calls goToPreset to execute the actual camera glide (goToPreset lives in Board,
  // not accessible to EngineGroup directly).
  useEffect(() => {
    if (activePreset) goToPreset(activePreset);
  }, [activePreset, goToPreset]);

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
      </BoardCanvas>

      {/* DOM overlay layer: title bars, ARIA, empty-state copy. pointer-events-none
          keeps Konva pan/zoom hit-test alive; individual overlays restore pointer-events-auto. */}
      <div className="pointer-events-none absolute inset-0">
        {GROUP_FRAMES.map((layout) => (
          <GroupFrameOverlay
            key={layout.id}
            layout={layout}
            camera={camera}
            visual={deriveFrameVisual(boardMachineState, layout.id)}
            expanded={expanded[layout.id]}
            onToggleExpanded={() => setExpanded((s) => ({ ...s, [layout.id]: !s[layout.id] }))}
            reducedMotion={effectiveReducedMotion}
          >
            {layout.id === 'engine' && <EngineGroup />}
          </GroupFrameOverlay>
        ))}
      </div>

      {/* DOM overlay slots (filled by plans 2.6 command bar, 2.7 input node, etc.) */}
      <CameraOverlay activePreset={activePreset} onSelect={goToPreset} />

      {/* R7.4 first-board orientation hint — z=150, above board content, below command bar (z=200) */}
      <OrientationHint />

      {/* Plan 2.6: context-aware command bar — z=200, fixed bottom-center */}
      <CommandBar
        currentStage={currentStage}
        onSubmit={handleCommandSubmit}
        onStop={handleCommandStop}
      />
    </div>
  );
}
