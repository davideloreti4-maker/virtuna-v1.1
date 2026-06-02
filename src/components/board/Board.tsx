'use client';
/**
 * Auto-pan contract for downstream plans (2.13 Engine, future Audience):
 * - If `usePrefersReducedMotion()` is true → DO NOT call `goToPreset`.
 * - If `Date.now() - useBoardStore.getState().lastUserInteractionAt < 3000` → DO NOT call `goToPreset`.
 * - Throttle: at most one glide per wave boundary (Wave 0→1, 1→2, 2→3, complete).
 * RESEARCH Pitfall 3 + Open Question 2.
 */
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, createRef } from 'react';
import type { RefObject } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/query-keys';
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
import {
  GROUP_FRAMES,
  CAMERA_DEFAULT_SCALE,
  AUTO_HEIGHT_FRAMES,
  resolveBoardLayout,
  computePresetTargets,
} from './board-constants';
import { GroupFrame } from './GroupFrame';
import { getFrameAntiViralityState } from './cross-group-state';
import { GroupFrameOverlay } from './GroupFrameOverlay';
import { EngineGroup } from './EngineGroup';
import { AudienceNode } from './audience/AudienceNode';
import { VerdictNode } from './verdict/VerdictNode';
import { ActionsNode } from './actions/ActionsNode';
import { ContentAnalysisFrame } from './content-analysis/ContentAnalysisFrame';
import { InputResultCard } from './InputResultCard';
import { DecodeShellNode } from './decode/DecodeShellNode';
import { AdaptShellNode } from './adapt/AdaptShellNode';
import { FrameErrorBoundary } from './FrameErrorBoundary';
import { nanoid } from 'nanoid';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ContentFormData } from '@/components/app/content-form';
import type { GroupId } from './board-types';
import type { FrameVisualState } from './GroupFrame';
import { detectInitialTier, startFpsSampler, usePerfStore, nextLowerTier } from '@/lib/perf-tier';
import { useToast } from '@/components/ui/toast';
import { useViewMode } from './use-view-mode';
import { BoardMobile } from './BoardMobile';
import { ViewModeToggle } from './ViewModeToggle';

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
  const { toast, dismiss } = useToast();

  // View mode: phones default to the vertical card stack, tablets/desktop to the
  // pannable canvas. The top-center board⇄cards toggle pins either mode (persisted
  // override) on any viewport.
  const { mode, setOverride } = useViewMode();

  // Board machine state for frame visual derivation (plan 2.2)
  const boardMachineState = useBoardStore((s) => s.boardState);

  // Per-frame expanded state (all start expanded; user collapses via chevron)
  const [expanded, setExpanded] = useState<Record<GroupId, boolean>>(() =>
    Object.fromEntries(GROUP_FRAMES.map((f) => [f.id, true])) as Record<GroupId, boolean>,
  );

  // Auto-height layout: each auto frame measures its natural content height and
  // reports it here; the layout reflows so frames grow to fit (no in-frame
  // scroll) and neighbours shift down. Empty = constants until first measure.
  const [measuredH, setMeasuredH] = useState<Partial<Record<GroupId, number>>>({});

  // submittedIntent — set in handleContentSubmit before stream.start() so the live
  // board reflects the user's intent immediately (A4 risk: engine complete event
  // does not populate PredictionResult.mode, so this is the live source of truth).
  // boardMode derivation (D-08 / REMIX-02) is below, after stream + permalinkQuery are declared.
  const [submittedIntent, setSubmittedIntent] = useState<'score' | 'remix'>('score');

  const handleMeasureFrame = useCallback((id: GroupId, worldH: number) => {
    setMeasuredH((prev) => (prev[id] === worldH ? prev : { ...prev, [id]: worldH }));
  }, []);

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

  // ── Permalink replay: /analyze/[id] direct nav hydrates result from API.
  // useAnalysisStream(opts.initialData) short-circuits to phase='complete' once
  // the row arrives (Pitfall #3). Without this, completed analyses sit on
  // "Calculating…" because SSE never opened.
  const params = useParams();
  const urlAnalysisId =
    params && typeof (params as { id?: unknown }).id === 'string'
      ? ((params as { id: string }).id)
      : null;
  const permalinkQuery = useQuery({
    queryKey: queryKeys.analysis.detail(urlAnalysisId ?? ''),
    queryFn: async () => {
      const r = await fetch(`/api/analysis/${urlAnalysisId}`);
      if (!r.ok) throw new Error(`Failed to load analysis ${urlAnalysisId}`);
      return r.json();
    },
    enabled: !!urlAnalysisId,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });

  // ── Plan 2.6: stream→board wiring ──────────────────────────────────────────
  const stream = useAnalysisStream({
    initialData: permalinkQuery.data ?? null,
  });

  // ── boardMode derivation (D-08 / REMIX-02 crit 5, Plan 02-03) ───────────────
  // NAMING: `boardMode` for intent (score/remix) — avoids collision with the
  // responsive view `mode` ('cards'|'desktop') from useViewMode at line 86.
  //
  // Priority:
  //   1. stream.result?.mode  — future-proof: if engine ever echoes mode in complete payload
  //   2. permalinkQuery.data?.mode — source of truth for /analyze/[id] direct nav (D-15)
  //   3. submittedIntent — live path: set in handleContentSubmit before stream.start()
  //      (A4 risk: finalResult from engine does not carry mode; this state is set at submit)
  const boardMode: 'score' | 'remix' =
    (stream.result as { mode?: 'score' | 'remix' } | null)?.mode ??
    (permalinkQuery.data as { mode?: 'score' | 'remix' } | null)?.mode ??
    submittedIntent;

  const resolvedFrames = useMemo(() => resolveBoardLayout(measuredH, boardMode), [measuredH, boardMode]);
  const presetTargets = useMemo(() => computePresetTargets(resolvedFrames), [resolvedFrames]);

  const startStreaming = useBoardStore((s) => s.startStreaming);
  const finishStreaming = useBoardStore((s) => s.finishStreaming);
  const triggerAntiVirality = useBoardStore((s) => s.triggerAntiVirality);
  const resetToIdle = useBoardStore((s) => s.resetToIdle);
  const newAnalysisSignal = useBoardStore((s) => s.newAnalysisSignal);

  // WR-01: track which analysisId we started streaming for, so that if the
  // user resets and a new stream starts we don't fire anti-virality against
  // a stale result from the previous run.
  const streamingAnalysisIdRef = useRef<string | null>(null);

  // Fix 3 (05-ux): Track the streaming toast ID so we can dismiss it on complete/error.
  const streamingToastIdRef = useRef<string | null>(null);

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

          // Fix 3 (05-ux): Show a persistent progress toast so user knows something is happening.
          // duration=0 → never auto-dismisses; we dismiss manually on complete/error.
          if (!streamingToastIdRef.current) {
            streamingToastIdRef.current = toast({
              variant: 'info',
              title: 'Analyzing your video',
              description: 'This usually takes about 90 seconds — you can keep using the app.',
              duration: 0,
              action: {
                label: 'Cancel',
                onClick: () => {
                  stream.abort();
                  if (streamingToastIdRef.current) {
                    dismiss(streamingToastIdRef.current);
                    streamingToastIdRef.current = null;
                  }
                },
              },
            });
          }
        }
        break;
      }
      case 'complete': {
        finishStreaming();
        // Dismiss streaming toast on success
        if (streamingToastIdRef.current) {
          dismiss(streamingToastIdRef.current);
          streamingToastIdRef.current = null;
        }
        // Fire anti-virality ripple on completion. WR-01 originally guarded
        // this with `analysisId === streamingAnalysisIdRef.current` so the
        // ripple only fires when the CURRENT session started the stream. That
        // misses permalink replay (no POST → ref stays null) — the AV header
        // appears on Verdict but Audience/Actions never get the cross-group
        // signal. Treat permalink replay as a valid AV trigger too, then
        // re-arm guard for fresh starts.
        if (stream.result && stream.analysisId != null) {
          const r = stream.result as {
            antiVirality?: unknown;
            anti_virality_gated?: unknown;
          };
          const antiVir = Boolean(r.antiVirality ?? r.anti_virality_gated);
          if (antiVir) triggerAntiVirality();
        }
        break;
      }
      case 'error':
        streamingAnalysisIdRef.current = null;
        // Dismiss streaming toast on error
        if (streamingToastIdRef.current) {
          dismiss(streamingToastIdRef.current);
          streamingToastIdRef.current = null;
        }
        resetToIdle();
        break;
      // 'idle' — no transition needed
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.phase, stream.result, stream.analysisId]);

  // Reset stream + board when navigating to /analyze base (New analysis).
  const prevUrlAnalysisIdRef = useRef(urlAnalysisId);
  useEffect(() => {
    if (prevUrlAnalysisIdRef.current !== null && urlAnalysisId === null) {
      stream.reset();
      resetToIdle();
    }
    prevUrlAnalysisIdRef.current = urlAnalysisId;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlAnalysisId]);

  // Reset when "New analysis" is clicked while already on /analyze (signal fires even if URL unchanged).
  const prevNewAnalysisSignalRef = useRef(newAnalysisSignal);
  useEffect(() => {
    if (prevNewAnalysisSignalRef.current !== newAnalysisSignal) {
      stream.reset();
    }
    prevNewAnalysisSignalRef.current = newAnalysisSignal;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newAnalysisSignal]);

  // CR-02: unified atomic URL update — merges the former pushState (analysisId)
  // and the debounced replaceState (camera/preset) into one effect so they can
  // never race and produce a URL missing the pathname or the query string.
  // Guard: skip when no urlAnalysisId so we don't bounce back to the old route.
  useEffect(() => {
    if (!stream.analysisId || !urlAnalysisId || typeof window === 'undefined') return;
    const qs = serializeCamera({ preset: activePreset, zoom: camera.scale });
    const target = `/analyze/${stream.analysisId}?${qs}`;
    if (window.location.pathname + window.location.search !== target) {
      window.history.replaceState(null, '', target);
    }
  }, [stream.analysisId, urlAnalysisId, activePreset, camera.scale]);

  // ContentForm submit — full multi-mode payload (video upload, text, URL).
  // Inlined from the now-removed InputDrawer so the command bar can host the
  // form directly. Navigation to /analyze/[id] is fired by the analysisId
  // null → string transition below.
  const router = useRouter();
  const prevAnalysisIdRef = useRef<string | null>(stream.analysisId);
  useEffect(() => {
    const id = stream.analysisId;
    if (id && prevAnalysisIdRef.current === null) {
      router.push(`/analyze/${id}`);
    }
    prevAnalysisIdRef.current = id;
  }, [stream.analysisId, router]);

  const handleContentSubmit = async (data: ContentFormData) => {
    // Hold the submitted intent in state for the live board (A4 risk: engine complete
    // event does not echo mode; submittedIntent is the live source of truth).
    setSubmittedIntent(data.mode ?? 'score');
    let videoStoragePath: string | null = null;
    if (data.input_mode === 'video_upload' && data.video_file) {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      const ext = (data.video_file.name.split('.').pop() ?? 'mp4').toLowerCase();
      const path = `${userId}/${nanoid()}.${ext}`;
      const { error } = await supabase.storage
        .from('videos')
        .upload(path, data.video_file, {
          contentType: data.video_file.type || 'video/mp4',
          upsert: false,
        });
      if (error) return;
      videoStoragePath = path;
    }

    stream.start({
      input_mode: data.input_mode,
      content_type: data.input_mode === 'text' ? 'post' : 'video',
      ...(data.input_mode === 'text' && { content_text: data.caption }),
      ...(data.input_mode === 'tiktok_url' && { tiktok_url: data.tiktok_url }),
      ...(data.input_mode === 'video_upload' && {
        content_text: data.video_caption,
        ...(videoStoragePath && { video_storage_path: videoStoragePath }),
      }),
      ...(data.niche && { niche: data.niche }),
      // Plan 02-03: explicit key — object is an allowlist, NOT ...data spread (Pitfall 7).
      // Missing this line silently persists the server default 'score' even for remix submits.
      mode: data.mode,
    }).catch(() => { /* stream.phase → error transition handles UI */ });
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
    presetTargets,
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

  // Auto-height reflow grows the board past its initial bounds (e.g. a tall
  // Actions column). Re-fit the overview so the whole board stays framed — but
  // ONLY while the user is on the overview preset and hasn't interacted (the
  // 3000ms guard mirrors the auto-pan contract at the top of this file). Skips
  // during streaming because EngineGroup parks activePreset on a frame preset.
  useEffect(() => {
    if (!initialFitApplied.current) return;
    if (activePreset !== 'overview') return;
    if (Date.now() - useBoardStore.getState().lastUserInteractionAt < 3000) return;
    goToPreset('overview');
  }, [resolvedFrames, activePreset, goToPreset]);

  useBoardKeyboard({ goToPreset });

  // Input scorecard data — shared by the canvas frame (InputResultCard) and the
  // mobile card stack (BoardMobile). Lifted so both views stay in sync.
  const streamResult = stream.result as {
    behavioral_predictions?: import('@/lib/engine/types').BehavioralPredictions | null;
    confidence?: number | null;
    confidence_label?: import('@/lib/engine/types').ConfidenceLevel | null;
    anti_virality_gated?: boolean | null;
  } | null;
  const inputCard = {
    behavioral: streamResult?.behavioral_predictions ?? null,
    confidence: streamResult?.confidence ?? null,
    confidenceLabel: streamResult?.confidence_label ?? null,
    gated: Boolean(streamResult?.anti_virality_gated),
    isStreaming: boardMachineState === 'streaming',
  };

  return (
    <div
      ref={wrapperRef}
      className="relative h-screen w-full overflow-hidden bg-background"
      role="application"
      aria-label="Analysis board"
    >
      {mode === 'cards' ? (
        <BoardMobile
          boardMachineState={boardMachineState}
          input={inputCard}
          // A permalink route or any non-idle state means there's something to show;
          // bare /analyze with no analysis falls through to the desktop-only hint.
          hasAnalysis={!!urlAnalysisId || boardMachineState !== 'idle' || !!stream.result}
          boardMode={boardMode}
        />
      ) : (
      <>
      <BoardCanvas
        camera={camera}
        setCamera={setCamera}
        onUserInteract={userOverrideCameraFollow}
        width={viewport.width}
        height={viewport.height}
      >
        {resolvedFrames.map((layout) => (
          <GroupFrame
            key={layout.id}
            layout={layout}
            visual={deriveFrameVisual(boardMachineState, layout.id)}
          />
        ))}
      </BoardCanvas>

      {/* Plan 2.6: context-aware command bar — z=200, fixed bottom-center.
          IMPORTANT: Rendered BEFORE the frame overlay loop so its <input> is the
          first tab stop inside the canvas region (DOM order = tab order for z=0 elements).
          Tab order: Sidebar → CommandBar → Group frames (roving) → CameraOverlay presets */}
      <CommandBar onContentSubmit={handleContentSubmit} />

      {/* DOM overlay layer: title bars, ARIA, empty-state copy. pointer-events-none
          keeps Konva pan/zoom hit-test alive; individual overlays restore pointer-events-auto.
          Group frames use roving tabindex (plan 2.11): one frame has tabIndex=0, rest -1.
          Arrow keys (←→↑↓) move focus within the group. */}
      <div className="pointer-events-none absolute inset-0">
        {resolvedFrames.map((layout, i) => (
          <GroupFrameOverlay
            key={layout.id}
            ref={(el) => { frameRefs.current[i]!.current = el; }}
            tabIndex={getTabIndex(i) as 0 | -1}
            onFocus={() => setActive(i)}
            layout={layout}
            camera={camera}
            visual={deriveFrameVisual(boardMachineState, layout.id)}
            expanded={expanded[layout.id] ?? true}
            onToggleExpanded={() => setExpanded((s) => ({ ...s, [layout.id]: !(s[layout.id] ?? true) }))}
            reducedMotion={effectiveReducedMotion}
            autoHeight={AUTO_HEIGHT_FRAMES.has(layout.id)}
            onMeasure={(worldH) => handleMeasureFrame(layout.id, worldH)}
          >
            {layout.id === 'input' && (
              <InputResultCard
                behavioral={inputCard.behavioral}
                confidence={inputCard.confidence}
                confidenceLabel={inputCard.confidenceLabel}
                gated={inputCard.gated}
                isStreaming={inputCard.isStreaming}
              />
            )}
            {layout.id === 'engine' && <EngineGroup />}
            {layout.id === 'audience' && <AudienceNode camera={camera} layout={layout} />}
            {layout.id === 'verdict' && <VerdictNode camera={camera} layout={layout} />}
            {layout.id === 'actions' && <ActionsNode camera={camera} layout={layout} />}
            {layout.id === 'content-analysis' && <ContentAnalysisFrame camera={camera} layout={layout} />}
            {layout.id === 'decode' && (
              <FrameErrorBoundary frameLabel="Decode">
                <DecodeShellNode />
              </FrameErrorBoundary>
            )}
            {layout.id === 'adapt' && (
              <FrameErrorBoundary frameLabel="Adapt">
                <AdaptShellNode camera={camera} layout={layout} />
              </FrameErrorBoundary>
            )}
          </GroupFrameOverlay>
        ))}
      </div>

      {/* DOM overlay slots (filled by plans 2.6 command bar, 2.7 input node, etc.) */}
      <CameraOverlay activePreset={activePreset} onSelect={goToPreset} />
      </>
      )}

      {/* Manual board⇄cards switch — always available (desktop + mobile), pinned
          top-center under the camera-preset toolbar. */}
      <ViewModeToggle mode={mode} onSelect={setOverride} />
    </div>
  );
}
