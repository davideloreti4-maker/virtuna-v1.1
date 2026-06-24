'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { RetentionChart, type RetentionChartProps } from './RetentionChart';
import { formatTime, normalizeCurve } from './audience-derive';
import { VB_H, clamp01, retentionAt, yForValue } from './retention-geometry';

export interface RetentionPlayerProps extends RetentionChartProps {
  /** Playable video source (uploads only). Null → renders the static chart. */
  videoSrc: string | null;
}

/**
 * RetentionPlayer — the time-locked retention chart made *functional*.
 *
 * When a playable upload source exists it stacks a compact video preview over
 * the existing survival curve, then overlays a draggable playhead that is
 * two-way bound to the video: drag the graph (or the scrubber) → the video
 * seeks to that exact moment; press play → the playhead rides the curve. A
 * tooltip reads out `m:ss` + interpolated retention %, mirroring TikTok's
 * watch-time panel.
 *
 * Everything is driven by a single normalized position `pct` (0-1), so a video
 * whose real duration differs from the segment-derived curve total still maps
 * cleanly (curve reads at `pct·total`, video seeks at `pct·videoDuration`).
 *
 * With no source it degrades to exactly the previous static <RetentionChart/>.
 */
export function RetentionPlayer({ videoSrc, ...chartProps }: RetentionPlayerProps) {
  const { curve, heatmap, totalDurationSec, isLoading } = chartProps;

  const videoRef = useRef<HTMLVideoElement>(null);

  const [pct, setPct] = useState(0);
  const [playing, setPlaying] = useState(false);
  const scrubbingRef = useRef(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  const total = totalDurationSec > 0 ? totalDurationSec : 1;
  const normalized = useMemo(() => (curve ? normalizeCurve(curve) : []), [curve]);
  const segments = heatmap?.segments ?? null;

  // Live readouts. Time uses the real video duration when known; retention is
  // read off the curve at the equivalent curve-time (pct·total).
  const displayDuration = videoDuration ?? total;
  const displayTime = pct * displayDuration;
  const retentionV = retentionAt(normalized, segments, total, pct * total);
  const retentionPct = Math.round(retentionV * 100);

  // ── Seek (single source of truth) ───────────────────────────────────────────
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

  // Pointer-drag seeking. Reads geometry off `e.currentTarget` (the element the
  // handler is bound to — the chart band or the scrubber track), so no refs are
  // threaded through render. One handler set, spread onto both surfaces.
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
        if (!scrubbingRef.current) return;
        seekFromEl(e.currentTarget, e.clientX);
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

  // ── Video <-> playhead binding ───────────────────────────────────────────────
  const onTimeUpdate = useCallback(() => {
    if (scrubbingRef.current) return;
    const v = videoRef.current;
    if (v && v.duration && Number.isFinite(v.duration)) {
      setPct(clamp01(v.currentTime / v.duration));
    }
  }, []);

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (v && Number.isFinite(v.duration)) setVideoDuration(v.duration);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (typeof v.play === 'function') v.play()?.catch?.(() => {});
    } else if (typeof v.pause === 'function') {
      v.pause();
    }
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const stepSmall = total > 0 ? 1 / total : 0.02;
      const stepBig = total > 0 ? 5 / total : 0.1;
      if (e.key === 'ArrowRight') { e.preventDefault(); seekTo(pct + stepSmall); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo(pct - stepSmall); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); seekTo(pct + stepBig); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); seekTo(pct - stepBig); }
      else if (e.key === 'Home') { e.preventDefault(); seekTo(0); }
      else if (e.key === 'End') { e.preventDefault(); seekTo(1); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); togglePlay(); }
    },
    [pct, total, seekTo, togglePlay],
  );

  // No playable source → previous behaviour, byte-for-byte.
  if (!videoSrc) return <RetentionChart {...chartProps} />;

  const knobTop = normalized.length > 0 ? yForValue(retentionV) : VB_H / 2;
  const leftPct = `${pct * 100}%`;

  return (
    <div data-testid="retention-player" className="flex flex-col gap-[10px]">
      {/* video preview */}
      <div
        className="relative mx-auto overflow-hidden rounded-[12px] border border-white/[0.06]"
        style={{ height: 200, maxWidth: '100%', backgroundColor: 'var(--color-surface)' }}
      >
        <video
          ref={videoRef}
          src={videoSrc}
          data-testid="retention-video"
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-contain"
          onClick={togglePlay}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
        {!playing && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Play"
            className="absolute inset-0 grid place-items-center"
          >
            <span
              className="grid h-11 w-11 place-items-center rounded-full"
              style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            >
              <PlayIcon />
            </span>
          </button>
        )}
      </div>

      {/* chart + draggable playhead overlay (overlay covers only the curve band) */}
      <div className="relative">
        <RetentionChart {...chartProps} />
        {!isLoading && (
          <div
            className="absolute inset-x-0 top-0 cursor-pointer touch-none select-none"
            style={{ height: VB_H }}
            {...dragHandlers}
            aria-hidden="true"
          >
            {/* playhead line */}
            <div
              className="absolute top-0 w-px"
              style={{ left: leftPct, height: VB_H, backgroundColor: 'rgba(236,231,222,0.85)' }}
            />
            {/* knob riding the curve — solid coral + hairline coral ring (no glow) */}
            <div
              className="absolute h-[11px] w-[11px] rounded-full"
              style={{
                left: leftPct,
                top: knobTop,
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'var(--color-cream-secondary)',
                boxShadow: '0 0 0 1px oklch(0.68 0.13 33 / 0.4)',
              }}
            />
            {/* tooltip drawer */}
            <div
              className="absolute -translate-x-1/2 whitespace-nowrap rounded-[8px] border px-2 py-1 text-center tabular-nums"
              style={{
                left: leftPct,
                top: 0,
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                marginLeft: pct > 0.85 ? -28 : pct < 0.15 ? 28 : 0,
              }}
            >
              <div style={{ fontSize: 11, color: 'rgba(236,231,222,0.9)', fontWeight: 600 }}>
                {formatTime(displayTime)}
              </div>
              {normalized.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--color-cream-secondary)', fontWeight: 600 }}>{retentionPct}%</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* scrubber track */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Seek video"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100)}
        aria-valuetext={`${formatTime(displayTime)}, ${retentionPct}% retention`}
        onKeyDown={onKeyDown}
        {...dragHandlers}
        className="relative h-[18px] cursor-pointer touch-none select-none focus-visible:outline-none"
        data-testid="retention-scrubber"
      >
        {/* track */}
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full"
          style={{ height: 3, backgroundColor: 'rgba(236,231,222,0.08)' }}
        />
        {/* filled */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
          style={{ height: 3, width: leftPct, backgroundColor: 'var(--color-cream-secondary)' }}
        />
        {/* handle */}
        <div
          className="absolute top-1/2 h-[14px] w-[14px] rounded-full"
          style={{
            left: leftPct,
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'var(--color-foreground)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        />
      </div>

      {/* controls + readout */}
      <div className="flex items-center gap-3 tabular-nums" style={{ fontSize: 11 }}>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/[0.06] bg-white/[0.04] transition-colors hover:bg-white/[0.1]"
        >
          {playing ? <PauseIcon /> : <PlayIcon small />}
        </button>
        <span style={{ color: 'var(--color-cream-secondary)', fontWeight: 600 }}>
          {formatTime(displayTime)}
          {normalized.length > 0 && (
            <span style={{ color: 'rgba(236,231,222,0.45)', fontWeight: 500 }}> ({retentionPct}%)</span>
          )}
        </span>
        <span className="ml-auto" style={{ color: 'rgba(236,231,222,0.34)' }}>
          {formatTime(displayDuration)}
        </span>
      </div>
    </div>
  );
}

function PlayIcon({ small }: { small?: boolean }) {
  const s = small ? 11 : 18;
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
