'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PredictionResult, HeatmapPayload } from '@/lib/engine/types';
import {
  formatTime,
  normalizeCurve,
  toRetentionCurve,
  findBiggestDrop,
  totalDuration,
  buildSegmentGroups,
  worstBadGroupKey,
  cohortDropFrame,
  SLOT_GROUPS,
  type SlotKey,
} from '@/components/board/audience/audience-derive';
import { VB_H, clamp01, retentionAt, yForValue } from '@/components/board/audience/retention-geometry';
import { RetentionChart } from '@/components/board/audience/RetentionChart';
import { useUploadedVideoSource } from '@/components/board/audience/use-uploaded-video-source';
import { usePermalinkFilmstrips } from '@/hooks/queries/use-permalink-filmstrips';

import { PanelShell, LegendKey, PanelSection } from './panel-shell';
import { PanelEmpty } from './reading-panels';

// ─────────────────────────────────────────────────────────────────────────────
// RetentionScrubber — the SIGNATURE drill-down (sketch 003-A, locked 2026-06-15).
//
// The "linked watch-journey": ONE playhead drives EVERYTHING — the video frame,
// the survival curve's playhead + tooltip, the slider, the on-screen filmstrip
// cell, AND a live "leaving now: <cohort>" readout with the matching cohort row
// lighting coral. This is what TikTok's Watch-Time panel can't do: we have the
// persona sim, so we name WHO leaves, not just how many.
//
//   Frame (9:16, centred)  →  curve + playhead  →  drop note  →  slider  →
//   transport (play · m:ss(ret%) · leaving now)  →  On screen  →  Who leaves
//
// Video source (reading-ux S1): real mp4 for BOTH uploads and tiktok_url runs on
// permalink reload; when genuinely absent it degrades to a keyframe flipbook
// (the active segment's keyframe) — never a dead player. No curve / no segments →
// PanelEmpty (D-13: never an empty SVG, never a fabricated 0).
// ─────────────────────────────────────────────────────────────────────────────

interface Cohort {
  key: SlotKey;
  label: string;
  /** Watch-through % (0-100). */
  pct: number;
  /** Drop time in seconds. */
  tSec: number;
  /** Drop time as a 0-1 fraction of the total. */
  frac: number;
  /** The single worst cohort (gets coral). */
  worst: boolean;
  /** Loyal cohorts that hold through don't "leave" — they show "stays". */
  stays: boolean;
}

/** A cohort holds through (no leave highlight) at/above this watch-through %. */
const STAYS_PCT = 70;

export function RetentionScrubber({ data }: { data: PredictionResult }) {
  const filmstrips = usePermalinkFilmstrips();
  // Real video for uploads AND tiktok_url (S1). No pending blob on a permalink.
  const { src: videoSrc } = useUploadedVideoSource(data, null);

  const heatmap: HeatmapPayload | null = data.heatmap ?? null;
  const segments = useMemo(() => heatmap?.segments ?? [], [heatmap?.segments]);

  const raw = heatmap?.weighted_curve ?? null;
  const curve = useMemo(
    () => (raw && raw.length > 0 ? toRetentionCurve(normalizeCurve(raw)) : null),
    [raw],
  );
  const normalized = useMemo(() => (curve ? normalizeCurve(curve) : []), [curve]);
  const drop = useMemo(() => (curve ? findBiggestDrop(normalizeCurve(curve)) : null), [curve]);
  const total = totalDuration(heatmap?.segments, 30); // SECONDS

  const nicheCompletionPct = useMemo(() => {
    const ncp = heatmap?.niche_completion_pct;
    return ncp != null ? (ncp > 1.5 ? ncp / 100 : ncp) : null;
  }, [heatmap?.niche_completion_pct]);

  // The 4 audience cohorts (who leaves), folded + ordered by funnel slot.
  const cohorts = useMemo<Cohort[]>(() => {
    const groups = buildSegmentGroups(heatmap, data.persona_simulation_results);
    const badKey = worstBadGroupKey(groups);
    const order = SLOT_GROUPS.map((g) => g.key);
    return groups
      .filter((g) => g.count > 0)
      .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
      .map((g) => {
        const frame = cohortDropFrame(heatmap, g.key, filmstrips);
        const tSec = frame?.tSec ?? total;
        return {
          key: g.key,
          label: g.label,
          pct: Math.round(g.pct),
          tSec,
          frac: clamp01(total > 0 ? tSec / total : 0),
          worst: g.key === badKey,
          stays: g.pct >= STAYS_PCT,
        };
      });
  }, [heatmap, data.persona_simulation_results, filmstrips, total]);

  // On-screen cells — a keyframe per segment (the active one lights at the playhead).
  const cells = useMemo(
    () =>
      segments.map((seg, i) => {
        const segIdx = seg.idx ?? i;
        return { idx: segIdx, url: filmstrips[segIdx] ?? seg.keyframe_uri ?? null };
      }),
    [segments, filmstrips],
  );
  const hasFrames = cells.some((c) => c.url != null);

  // ── Playhead state (single source of truth) ──────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pct, setPct] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const scrubbingRef = useRef(false);

  const displayDuration = videoDuration ?? total;
  const displayTime = pct * displayDuration;
  const retentionV = retentionAt(normalized, segments, total, pct * total);
  const retentionPct = Math.round(retentionV * 100);

  // Active segment bucket — drives the frame (flipbook) + the on-screen cell.
  const bucket = useMemo(() => {
    if (cells.length === 0) return 0;
    return Math.min(cells.length - 1, Math.floor(pct * cells.length));
  }, [pct, cells.length]);

  // Single nearest cohort in the leave window (sketch: dp-0.015 .. dp+0.07).
  const leavingKey = useMemo<SlotKey | null>(() => {
    let best: SlotKey | null = null;
    let bestD = 1;
    for (const c of cohorts) {
      if (c.stays) continue;
      if (pct >= c.frac - 0.015 && pct <= c.frac + 0.07) {
        const d = Math.abs(pct - c.frac);
        if (d < bestD) {
          bestD = d;
          best = c.key;
        }
      }
    }
    return best;
  }, [cohorts, pct]);

  // ── Seek + scrub ─────────────────────────────────────────────────────────────
  const seekTo = useCallback(
    (p: number) => {
      const next = clamp01(p);
      setPct(next);
      const v = videoRef.current;
      if (v) {
        const d = v.duration && Number.isFinite(v.duration) ? v.duration : total;
        v.currentTime = next * d;
      }
    },
    [total],
  );

  const seekFromEl = useCallback(
    (el: HTMLElement, clientX: number) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      seekTo((clientX - rect.left) / rect.width);
    },
    [seekTo],
  );

  const dragHandlers = useMemo(
    () => ({
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        e.preventDefault();
        scrubbingRef.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        seekFromEl(e.currentTarget, e.clientX);
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        if (scrubbingRef.current) seekFromEl(e.currentTarget, e.clientX);
      },
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
        scrubbingRef.current = false;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      },
      onPointerCancel: () => {
        scrubbingRef.current = false;
      },
    }),
    [seekFromEl],
  );

  // ── Play / pause — video-driven when present, else a flipbook rAF over `total` ─
  const onTimeUpdate = useCallback(() => {
    if (scrubbingRef.current) return;
    const v = videoRef.current;
    if (v && v.duration && Number.isFinite(v.duration)) setPct(clamp01(v.currentTime / v.duration));
  }, []);

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (v && Number.isFinite(v.duration)) setVideoDuration(v.duration);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      if (v.paused) v.play?.()?.catch?.(() => {});
      else v.pause?.();
      return;
    }
    // No video → flipbook play across the curve (graceful degrade).
    if (playing) {
      setPlaying(false);
    } else {
      if (pct >= 1) setPct(0);
      setPlaying(true);
    }
  }, [playing, pct]);

  // Mirror the playhead into a ref so the flipbook rAF loop can read + advance it
  // without re-subscribing every frame (and pick up scrubs mid-play).
  const pctRef = useRef(pct);
  useEffect(() => {
    pctRef.current = pct;
  }, [pct]);

  // Flipbook auto-advance (no video): drive the playhead via rAF while playing, so
  // the keyframes + curve still animate "the audience draining". The video path
  // drives its own pct via onTimeUpdate, so this effect no-ops when a video exists.
  // setState lives in the async rAF callback (not the effect body), and the loop
  // stops itself at the end — no cascading-render setState in the effect body.
  useEffect(() => {
    if (!playing || videoSrc) return;
    let raf = 0;
    let last: number | null = null;
    const loop = (ts: number) => {
      if (last == null) last = ts;
      const dt = (ts - last) / 1000;
      last = ts;
      const dur = total > 0 ? total : 1;
      const next = Math.min(1, pctRef.current + dt / dur);
      pctRef.current = next;
      setPct(next);
      if (next >= 1) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, videoSrc, total]);

  // ── D-13 honesty gate (after hooks so hook order stays stable) ────────────────
  if (segments.length === 0 || curve == null) return <PanelEmpty />;

  const knobTop = normalized.length > 0 ? yForValue(retentionV) : VB_H / 2;
  const leftPct = `${pct * 100}%`;
  const activeFrame = cells[bucket]?.url ?? null;
  const worstCohort = cohorts.find((c) => c.worst) ?? null;
  const leaving = leavingKey ? cohorts.find((c) => c.key === leavingKey) ?? null : null;

  return (
    <PanelShell
      subtitle="Drag to replay the drop — and watch who leaves, moment by moment."
      legend={
        <>
          <LegendKey tone="accent">drops first</LegendKey>
          <LegendKey tone="cream">still watching</LegendKey>
        </>
      }
    >
      <div data-testid="retention-scrubber-cluster" className="flex flex-col gap-4">
        {/* ── Video frame (9:16, centred) ─────────────────────────────────────── */}
        <div
          className="relative mx-auto w-[108px] overflow-hidden rounded-lg border border-[var(--color-border)]"
          style={{
            aspectRatio: '9 / 16',
            backgroundColor: 'var(--color-surface)',
            backgroundImage: !videoSrc && activeFrame ? `url('${activeFrame}')` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {videoSrc && (
            <video
              ref={videoRef}
              src={videoSrc}
              data-testid="retention-scrubber-video"
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
              onClick={togglePlay}
              onTimeUpdate={onTimeUpdate}
              onLoadedMetadata={onLoadedMetadata}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
          )}
          {/* timestamp */}
          <span
            className="absolute right-1.5 top-1.5 rounded-xs px-1.5 py-px text-[10px] tabular-nums text-foreground-secondary"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            {formatTime(displayTime)}
          </span>
          {/* play affordance */}
          {!playing && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label="Play"
              className="absolute inset-0 grid place-items-center"
            >
              <span
                className="grid h-9 w-9 place-items-center rounded-full"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
              >
                <PlayIcon />
              </span>
            </button>
          )}
        </div>

        {/* ── Curve + playhead ────────────────────────────────────────────────── */}
        <div className="flex flex-col">
          <div className="relative">
            {/* The curve only — pass empty filmstrips so the baked strip is hidden
                (the on-screen strip below is the linked one). */}
            <RetentionChart
              curve={curve}
              heatmap={heatmap}
              drop={drop}
              totalDurationSec={total}
              filmstrips={{}}
              nicheCompletionPct={nicheCompletionPct}
              isLoading={false}
            />
            {/* playhead overlay (scrub surface) over the curve band only */}
            <div
              className="absolute inset-x-0 top-0 cursor-ew-resize touch-none select-none"
              style={{ height: VB_H }}
              {...dragHandlers}
              data-testid="retention-scrubber-curve"
              aria-hidden="true"
            >
              <div
                className="absolute top-0 w-px"
                style={{ left: leftPct, height: VB_H, backgroundColor: 'rgba(236,231,222,0.9)' }}
              />
              <div
                className="absolute h-[11px] w-[11px] rounded-full"
                style={{
                  left: leftPct,
                  top: knobTop,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'var(--color-cream-secondary)',
                  boxShadow: '0 0 0 1.5px var(--color-bg)',
                }}
              />
              <div
                className="absolute -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-center tabular-nums"
                style={{
                  left: leftPct,
                  top: -2,
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-surface-elevated, var(--color-surface))',
                  marginLeft: pct > 0.85 ? -28 : pct < 0.15 ? 28 : 0,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                }}
              >
                <span className="text-[11px] font-semibold text-foreground">{formatTime(displayTime)}</span>
                {normalized.length > 0 && (
                  <span className="ml-1.5 text-[11px] font-semibold" style={{ color: 'var(--color-cream-secondary)' }}>
                    {retentionPct}%
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* drop note — quiet caption; the live playhead is the hero */}
          {drop && worstCohort && (
            <p className="mt-2 text-[11px] text-foreground-muted">
              Biggest drop{' '}
              <b className="font-semibold" style={{ color: 'var(--color-cream-secondary)' }}>
                −{Math.round(drop.delta * 100)}%
              </b>{' '}
              at{' '}
              <b className="font-semibold" style={{ color: 'var(--color-cream-secondary)' }}>
                {formatTime(segments[drop.index]?.t_start ?? 0)}
              </b>{' '}
              — {worstCohort.label.toLowerCase()} leave here.
            </p>
          )}
        </div>

        {/* ── Slider ──────────────────────────────────────────────────────────── */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Seek video"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct * 100)}
          aria-valuetext={`${formatTime(displayTime)}, ${retentionPct}% retention`}
          onKeyDown={(e) => {
            const small = total > 0 ? 1 / total : 0.02;
            const big = total > 0 ? 5 / total : 0.1;
            if (e.key === 'ArrowRight') { e.preventDefault(); seekTo(pct + small); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo(pct - small); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); seekTo(pct + big); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); seekTo(pct - big); }
            else if (e.key === 'Home') { e.preventDefault(); seekTo(0); }
            else if (e.key === 'End') { e.preventDefault(); seekTo(1); }
            else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); togglePlay(); }
          }}
          {...dragHandlers}
          className="relative h-[18px] cursor-ew-resize touch-none select-none focus-visible:outline-none"
          data-testid="retention-scrubber-slider"
        >
          <div
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full"
            style={{ height: 3, backgroundColor: 'rgba(236,231,222,0.1)' }}
          />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
            style={{ height: 3, width: leftPct, backgroundColor: 'var(--color-cream-secondary)' }}
          />
          <div
            className="absolute top-1/2 h-[15px] w-[15px] rounded-full"
            style={{
              left: leftPct,
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'var(--color-foreground)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }}
          />
        </div>

        {/* ── Transport: play · m:ss(ret%) · leaving now ──────────────────────── */}
        <div className="flex items-center gap-3 tabular-nums" style={{ fontSize: 12 }}>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border border-[var(--color-border)] bg-white/[0.04] transition-colors hover:bg-white/[0.1]"
          >
            {playing ? <PauseIcon /> : <PlayIcon small />}
          </button>
          <span style={{ color: 'var(--color-cream-secondary)', fontWeight: 600 }}>
            {formatTime(displayTime)}
            {normalized.length > 0 && (
              <span style={{ color: 'rgba(236,231,222,0.45)', fontWeight: 500 }}> ({retentionPct}%)</span>
            )}
          </span>
          <span className="ml-auto text-foreground-muted" data-testid="retention-scrubber-leaving">
            {leaving ? (
              <>
                leaving now{' '}
                <b className="font-semibold" style={{ color: 'var(--color-cream-secondary)' }}>
                  {leaving.label}
                </b>
              </>
            ) : pct < 0.02 ? (
              'everyone watching'
            ) : (
              `${retentionPct}% still in`
            )}
          </span>
        </div>

        {/* ── On screen (linked filmstrip) ────────────────────────────────────── */}
        {hasFrames && (
          <PanelSection label="On screen">
            <div className="flex gap-1" aria-hidden="true">
              {cells.map((cell, i) => (
                <div
                  key={cell.idx}
                  className="flex-1 rounded-sm border bg-cover bg-center"
                  style={{
                    aspectRatio: '16 / 9',
                    backgroundImage: cell.url ? `url('${cell.url}')` : undefined,
                    backgroundColor: cell.url ? undefined : 'rgba(236,231,222,0.016)',
                    borderColor: i === bucket ? 'var(--color-border-hover)' : 'var(--color-border)',
                    filter: i === bucket ? 'brightness(1) saturate(0.95)' : 'brightness(0.5) saturate(0.7)',
                    transform: i === bucket ? 'translateY(-2px)' : undefined,
                    transition: 'filter .15s, border-color .15s, transform .15s',
                  }}
                />
              ))}
            </div>
          </PanelSection>
        )}

        {/* ── Who leaves (cohort rows, nearest lights coral) ──────────────────── */}
        {cohorts.length > 0 && (
          <PanelSection label="Who leaves">
            <div data-testid="retention-scrubber-cohorts" className="flex flex-col gap-0.5">
              {cohorts.map((c) => {
                const active = c.key === leavingKey;
                const dotColor = c.worst
                  ? 'var(--color-cream-secondary)'
                  : `rgba(236, 231, 222, ${(0.3 + clamp01(c.pct / 100) * 0.5).toFixed(2)})`;
                return (
                  <div
                    key={c.key}
                    className="flex items-center gap-3 rounded-md border px-2.5 py-2 transition-colors"
                    style={{
                      borderColor: active ? 'oklch(0.68 0.13 33 / 0.4)' : 'transparent',
                      backgroundColor: active ? 'oklch(0.68 0.13 33 / 0.12)' : 'transparent',
                    }}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor }} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{c.label}</span>
                    <span className="shrink-0 text-[12px] tabular-nums text-foreground-muted">
                      {c.stays ? 'stays' : `↓ ${formatTime(c.tSec)}`}
                    </span>
                    <span className="hidden h-[5px] w-16 shrink-0 rounded-full bg-[var(--color-border)] sm:block">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.max(0, Math.min(100, c.pct))}%`,
                          background: c.worst ? 'var(--color-cream-secondary)' : 'rgba(236,231,222,0.35)',
                        }}
                      />
                    </span>
                    <span
                      className="w-9 shrink-0 text-right text-[13px] font-semibold tabular-nums text-foreground"
                      style={c.worst ? { color: 'var(--color-cream-secondary)' } : undefined}
                    >
                      {c.pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </PanelSection>
        )}
      </div>
    </PanelShell>
  );
}

RetentionScrubber.displayName = 'RetentionScrubber';

function PlayIcon({ small }: { small?: boolean }) {
  const s = small ? 11 : 15;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5L8 5.5Z" fill="var(--color-foreground)" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" fill="var(--color-foreground)" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="var(--color-foreground)" />
    </svg>
  );
}
