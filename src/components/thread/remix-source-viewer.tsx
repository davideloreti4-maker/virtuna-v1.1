"use client";

/**
 * RemixSourceViewer — the scrubbable stills of the remixed source.
 *
 * ── The interaction, and where it comes from ─────────────────────────────────────────────────
 * ONE playhead drives everything: the stage frame, the lit strip cell, and (via `onSeek` in the
 * parent) the lit beat row. That is the structure of `components/reading/retention-scrubber.tsx`
 * — locked sketch 003-A, *"ONE playhead drives EVERYTHING"* — reused because it is the interaction
 * the owner asked for and it is already designed and shipped once.
 *
 * What is NOT reused is its video source. `RetentionScrubber` plays a real `<video>` because that
 * file is the user's own upload. A scraped remix source is dropped by `cleanup()` before the run
 * ends, so there is nothing to play; the "play" here is a flipbook over stills, and the sound
 * lives in the embed below.
 *
 * ── Why the strip cells are tiny ─────────────────────────────────────────────────────────────
 * At a 390px viewport the content box is ~358px, so 30 portrait cells are ~12px wide. That is
 * intentional: the strip is a TRACK, communicating position and rate of visual change the way an
 * editor's timeline does, and the stage above it is where you actually read the frame. It is not
 * trying to be 30 legible thumbnails.
 *
 * NO ACCENT ANYWHERE. The dosage rule is LOCKED and the card already spends its one on the
 * Borrowed chip. Emphasis is carried by cream, brightness and a left rule — never by hue.
 *
 * Phase 4: for the ≤8 windows a run's clips cover, the stage overlays ONE `<video>` (muted — the
 * audio track itself is stripped) and the flipbook remains everywhere else. No clips ⇒ this file
 * behaves byte-identically to phase 3.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause } from "@phosphor-icons/react";
import type { BlueprintBeat } from "@/lib/engine/remix/blueprint";
import { CoverFill } from "@/components/primitives/CoverFill";

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export interface ClipWindow {
  beatIndex: number;
  url: string;
  start: number;
  duration: number;
}

/**
 * One window per clip-backed beat. `measured` (from loadedmetadata) beats the prediction: a clip
 * the budget truncated must shrink its window rather than freeze on its last frame (spec §4.2).
 */
export function clipWindows(
  beats: BlueprintBeat[],
  clips: Record<number, string>,
  measured: Record<number, number>,
): ClipWindow[] {
  return beats
    .filter((b) => clips[b.index])
    .map((b) => ({
      beatIndex: b.index,
      url: clips[b.index]!,
      start: b.t_start,
      // 4 mirrors MAX_CLIP_DURATION_S in beat-clips.ts, NOT imported: that module pulls
      // node:child_process, which must never enter a client bundle. Change both together.
      duration: measured[b.index] ?? Math.min(4, Math.max(0, b.duration_s)),
    }));
}

/** The window covering `t`, half-open — at the window's end the stage is back on stills. */
export function windowAt(windows: ClipWindow[], t: number): ClipWindow | null {
  return windows.find((w) => t >= w.start && t < w.start + w.duration) ?? null;
}

/** The next window strictly ahead of `t` — what the gap preloads. */
export function windowAfter(windows: ClipWindow[], t: number): ClipWindow | null {
  let next: ClipWindow | null = null;
  for (const w of windows) {
    if (w.start > t && (!next || w.start < next.start)) next = w;
  }
  return next;
}

export interface RemixSourceViewerProps {
  /** `{ gridIndex → signed URL }`. Sparse is normal — a frame that failed to cut is simply absent. */
  scrubFrames: Record<number, string>;
  /** The beats, for the boundary ticks and for reporting which one the playhead is inside. */
  beats: BlueprintBeat[];
  /** Video duration in seconds. Falsy/0 falls back to the last beat's end. */
  durationS: number;
  /** Raised whenever the playhead moves, with the index of the beat it now sits inside. */
  onActiveBeatChange?: (beatIndex: number | null) => void;
  /** Seconds to seek to. Changing this moves the playhead — the parent's row clicks come in here. */
  seekToSec?: number | null;
  /**
   * PHASE 4 — `{ beatIndex → signed clip URL }`, ≤8 muted ≤4s fragments. Absent/empty is the
   * normal case (every pre-lane sheet) and must render byte-identically to phase 3.
   */
  clips?: Record<number, string>;
}

export function RemixSourceViewer({
  scrubFrames,
  beats,
  durationS,
  onActiveBeatChange,
  seekToSec,
  clips,
}: RemixSourceViewerProps) {
  // Sorted numerically. `Object.keys` gives strings, and lexical order puts "10" before "2" —
  // which would shuffle the strip into visual nonsense while every cell still rendered fine.
  const cells = useMemo(() => {
    return Object.keys(scrubFrames)
      .map(Number)
      .filter(Number.isFinite)
      .sort((a, b) => a - b)
      .map((idx) => ({ idx, url: scrubFrames[idx]! }));
  }, [scrubFrames]);

  // The beats always span the video, so their tail is a sound fallback for a degenerate duration.
  const total = useMemo(() => {
    const fromBeats = beats.length > 0 ? Math.max(...beats.map((b) => b.t_end)) : 0;
    return durationS > 0 ? durationS : fromBeats;
  }, [durationS, beats]);

  const [pct, setPct] = useState(0);
  const [playing, setPlaying] = useState(false);
  const scrubbingRef = useRef(false);

  const displayTime = pct * total;

  // ── PHASE 4: the clip layer ──────────────────────────────────────────────────
  // One <video> over the still. The rAF clock LEADS (pct is the single source of truth); the
  // video follows — seeked into place, drift-corrected past 0.15s, never driving pct.
  const clipMap = clips ?? {};
  const hasClips = Object.keys(clipMap).length > 0;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Measured clip durations (loadedmetadata) — replaces the min(4, duration_s) prediction.
  const [measured, setMeasured] = useState<Record<number, number>>({});
  // Which src has finished loadeddata — the still stays until the CURRENT src is ready.
  const [readySrc, setReadySrc] = useState<string | null>(null);

  const windows = useMemo(
    () => clipWindows(beats, clipMap, measured),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clipMap is derived from `clips`
    [beats, clips, measured],
  );
  const active = hasClips ? windowAt(windows, displayTime) : null;
  // Load the ACTIVE clip; in an uncovered gap, preload the NEXT one — the swap cost lands where
  // a still is showing anyway (spec §4.2).
  const loadWindow = active ?? (hasClips ? windowAfter(windows, displayTime) : null);
  const showVideo = Boolean(active && readySrc === active.url);

  // The element follows the clock: seek into the window, play/pause with the flipbook.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active || readySrc !== active.url) return;
    const target = Math.max(0, displayTime - active.start);
    if (playing) {
      if (Math.abs(video.currentTime - target) > 0.15) video.currentTime = target;
      void video.play().catch(() => {});
    } else {
      video.pause();
      // Scrubbing: the paused frame at exact-time beats the nearest grid still.
      video.currentTime = target;
    }
  }, [active, readySrc, playing, displayTime]);

  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const duration = e.currentTarget.duration;
      const w = loadWindow;
      if (!w || !Number.isFinite(duration) || duration <= 0) return;
      setMeasured((m) => (m[w.beatIndex] === duration ? m : { ...m, [w.beatIndex]: duration }));
    },
    [loadWindow],
  );

  // Which strip cell the playhead is over. Cells are an even grid, so this is positional.
  const activeCell = cells.length === 0 ? -1 : Math.min(cells.length - 1, Math.floor(pct * cells.length));

  // Which BEAT the playhead is inside — by time, not by cell, because beats are uneven.
  const activeBeatIndex = useMemo(() => {
    if (beats.length === 0 || total <= 0) return null;
    const t = pct * total;
    // The last beat wins on the trailing edge: at pct === 1, t === t_end of the final beat, and a
    // half-open test would report "no beat" exactly when the playhead is parked at the end.
    const hit = beats.find((b) => t >= b.t_start && t < b.t_end) ?? beats[beats.length - 1];
    return hit?.index ?? null;
  }, [pct, total, beats]);

  useEffect(() => {
    onActiveBeatChange?.(activeBeatIndex);
  }, [activeBeatIndex, onActiveBeatChange]);

  // Parent-driven seek (a beat row was clicked).
  useEffect(() => {
    if (seekToSec == null || total <= 0) return;
    setPct(clamp01(seekToSec / total));
  }, [seekToSec, total]);

  const seekTo = useCallback((p: number) => setPct(clamp01(p)), []);

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

  // Flipbook playback. Mirrors the playhead into a ref so the rAF loop can advance it without
  // re-subscribing every frame, and stops itself at the end — no cascading setState in the effect
  // body. Same shape as RetentionScrubber's no-video path, which is the only path that exists here.
  const pctRef = useRef(pct);
  useEffect(() => {
    pctRef.current = pct;
  }, [pct]);

  useEffect(() => {
    if (!playing || total <= 0) return;
    let raf = 0;
    let last: number | null = null;
    const loop = (ts: number) => {
      if (last == null) last = ts;
      const dt = (ts - last) / 1000;
      last = ts;
      const next = Math.min(1, pctRef.current + dt / total);
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
  }, [playing, total]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      if (!p && pctRef.current >= 1) setPct(0);
      return !p;
    });
  }, []);

  // No frames → no viewer. Every sheet written before this lane is in exactly this state, and it
  // must render byte-identically to what it rendered before.
  if (cells.length === 0 || total <= 0) return null;

  const leftPct = `${pct * 100}%`;
  const stageUrl = cells[activeCell]?.url;

  return (
    // ONE layout at every width: stage centred above a full-width strip.
    //
    // A side-by-side variant was built and measured at 1440 and is deliberately NOT here. Making
    // the strip fill the stage's height turns each cell into a ~26x171 slice, and `bg-cover` on
    // that aspect crops a 9:16 frame to its centre band — which is exactly where a TikTok's baked
    // caption sits. Thirty cells then render the same caption thirty times as a garbled text
    // ribbon. Calm whitespace either side of a centred stage is the better trade, and it is one
    // layout to reason about instead of two.
    <div data-source-viewer className="flex flex-col gap-2.5">
      {/* ── Stage: the frame under the playhead ─────────────────────────────────── */}
      <div className="relative mx-auto block aspect-[9/16] w-24 shrink-0 overflow-hidden rounded-md border border-white/[0.06] @min-[480px]:w-28">
        <CoverFill coverUrl={stageUrl} playSize={16} alt="" />
        {hasClips && (
          <video
            ref={videoRef}
            data-testid="remix-clip-video"
            key="clip-stage"
            src={loadWindow?.url}
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={handleLoadedMetadata}
            onLoadedData={(e) => setReadySrc(e.currentTarget.currentSrc || loadWindow?.url || null)}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: showVideo ? 1 : 0, transition: "opacity .12s" }}
          />
        )}
        <span className="absolute right-1 top-1 rounded-xs bg-black/55 px-1 py-px text-micro tabular-nums text-foreground-secondary">
          {formatTime(displayTime)}
        </span>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play the source stills"}
          className="absolute inset-0 grid place-items-center transition-opacity hover:opacity-100"
          style={{ opacity: playing ? 0 : 1 }}
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-black/55 text-foreground">
            {playing ? <Pause size={13} weight="fill" /> : <Play size={13} weight="fill" />}
          </span>
        </button>
      </div>

      {/* ── Strip + playhead ────────────────────────────────────────────────────── */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Scrub the source video"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100)}
        aria-valuetext={formatTime(displayTime)}
        onKeyDown={(e) => {
          const small = total > 0 ? 1 / total : 0.02;
          const big = total > 0 ? 5 / total : 0.1;
          if (e.key === "ArrowRight") { e.preventDefault(); seekTo(pct + small); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); seekTo(pct - small); }
          else if (e.key === "ArrowUp") { e.preventDefault(); seekTo(pct + big); }
          else if (e.key === "ArrowDown") { e.preventDefault(); seekTo(pct - big); }
          else if (e.key === "Home") { e.preventDefault(); seekTo(0); }
          else if (e.key === "End") { e.preventDefault(); seekTo(1); }
          else if (e.key === " " || e.key === "Enter") { e.preventDefault(); togglePlay(); }
        }}
        {...dragHandlers}
        data-testid="remix-scrub-strip"
        className="relative h-11 min-w-0 cursor-ew-resize touch-none select-none rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
      >
        <div className="flex h-full gap-px overflow-hidden rounded-sm" aria-hidden="true">
          {cells.map((cell, i) => (
            <span
              key={cell.idx}
              className="min-w-0 flex-1 bg-cover bg-center"
              style={{
                backgroundImage: `url('${cell.url}')`,
                // Everything past the playhead is dimmed, so the strip reads as a progress track
                // as well as a filmstrip. Brightness, never hue — the dosage rule is LOCKED.
                filter: i <= activeCell ? "brightness(1)" : "brightness(0.42) saturate(0.7)",
                transition: "filter .12s",
              }}
            />
          ))}
        </div>

        {/* Beat boundary ticks — where the source actually cut between beats. This is what makes
            the strip legible as a SHOT LIST rather than as an undifferentiated ribbon. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {beats.slice(1).map((b) => (
            <span
              key={b.index}
              className="absolute top-0 h-full w-px bg-black/50"
              style={{ left: `${clamp01(b.t_start / total) * 100}%` }}
            />
          ))}
        </div>

        {/* The playhead. Cream, per RetentionScrubber — never accent. */}
        <div
          className="pointer-events-none absolute top-0 h-full w-px"
          style={{ left: leftPct, backgroundColor: "rgba(236,231,222,0.9)" }}
          aria-hidden="true"
        />
        {/* The grab handle is INSET by its own radius, so it stays whole at both extremes — at
            pct 0 a centred knob is half outside the strip and renders as a clipped semicircle.
            The line above is not inset: it marks a time position against the cells and has to be
            exact. The ≤5px divergence at the very ends is the conventional slider trade. */}
        <div
          className="pointer-events-none absolute h-2.5 w-2.5 rounded-full"
          style={{
            left: `calc(5px + ${pct} * (100% - 10px))`,
            top: "100%",
            transform: "translate(-50%, -60%)",
            backgroundColor: "var(--color-foreground)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
