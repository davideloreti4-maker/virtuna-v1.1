'use client';
/**
 * Auto-pan contract for downstream plans (2.13 Engine, future Audience):
 * - If `usePrefersReducedMotion()` is true → DO NOT call `goToPreset`.
 * - If `Date.now() - useBoardStore.getState().lastUserInteractionAt < 3000` → DO NOT call `goToPreset`.
 * - Throttle: at most one glide per wave boundary (Wave 0→1, 1→2, 2→3, complete).
 * RESEARCH Pitfall 3 + Open Question 2.
 */
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, createRef } from 'react';
import type { RefObject } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/query-keys';
import { useRovingTabIndex } from '@/lib/a11y';
import { Skeleton } from '@/components/ui/skeleton';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useBoardStore } from '@/stores/board-store';
import { MobileBoardBanner } from './MobileBoardBanner';
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
import { nanoid } from 'nanoid';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ContentFormData } from '@/components/app/content-form';
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
  const { toast, dismiss } = useToast();

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
  const startStreaming = useBoardStore((s) => s.startStreaming);
  const finishStreaming = useBoardStore((s) => s.finishStreaming);
  const triggerAntiVirality = useBoardStore((s) => s.triggerAntiVirality);
  const resetToIdle = useBoardStore((s) => s.resetToIdle);
  const pendingVideoThumbnail = useBoardStore((s) => s.pendingVideo?.thumbnail ?? null);

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
      <CommandBar onContentSubmit={handleContentSubmit} />

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
        {/* Input node — TikTok-style vertical card showing the uploaded video
            + predicted engagement metrics overlay (derived from overall_score
            + behavioral_predictions). */}
        {(() => {
          const r = stream.result as {
            video_storage_path?: string | null;
            behavioral_predictions?: import('@/lib/engine/types').BehavioralPredictions | null;
          } | null;
          return (
            <InputNodeOverlay
              camera={camera}
              videoStoragePath={r?.video_storage_path ?? null}
              videoUrl={null}
              thumbnailUrl={stream.filmstrips?.[0] ?? pendingVideoThumbnail ?? null}
              behavioral={r?.behavioral_predictions ?? null}
              isStreaming={boardMachineState === 'streaming'}
            />
          );
        })()}
      </div>

      {/* DOM overlay slots (filled by plans 2.6 command bar, 2.7 input node, etc.) */}
      <CameraOverlay activePreset={activePreset} onSelect={goToPreset} />

      {/* Mobile/narrow viewport banner — z=160, above OrientationHint (z=150), below command bar (z=200) */}
      <MobileBoardBanner />

      {/* R7.4 first-board orientation hint — z=150, above board content, below command bar (z=200) */}
      <OrientationHint />
    </div>
  );
}
