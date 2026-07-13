'use client';

/**
 * BrainView — "The brain": a predicted cortical response to the thing the room is reacting to,
 * modeled on TRIBE v2 (Meta FAIR's trimodal brain encoder, Algonauts 2025).
 *
 * We reproduce the SHAPE of that work, never its code: TRIBE is CC-BY-NC-4.0 and its fsaverage
 * geometry is FreeSurfer-derived, so neither can ship here. Our cortical surface is our own
 * (`@/lib/brain/cortex-mesh`: a folded 3D hemisphere, lit — rendered by `./CortexCanvas`), and so is
 * the response model (`@/lib/brain/cortex-sim`: per-network neural drive → canonical double-gamma
 * HRF → predicted BOLD per parcel).
 *
 * ── THE CARD IS A FIGURE, NOT A DASHBOARD (the round-4 rebuild) ───────────────────────────────
 * Three earlier cuts were rejected, and the last one for the CARD rather than the cortex: it had
 * grown into nine stacked rows — a status line, a colorbar, a caption, a readout, four progress
 * bars, a verdict, a footer — all shouting at one volume, in three fighting type systems, and it
 * overflowed its own panel (554px of content in a 516px box). Diffing against TRIBE's demo showed
 * the actual lesson, and it is not about the brain: **their chrome is three annotations and a
 * stimulus pane.** The specimen carries the message; everything else is a label on it.
 *
 * So this is built as a scientific FIGURE:
 *  • THE WELL — a near-black inset the specimen lives in. This is the one move that buys TRIBE's
 *    figure/ground: their brain is near-white on pure black, ours was mid-beige on mid-charcoal, and
 *    THAT is why it read as murky. The well is a legitimate matte tone-zone (docs/DESIGN-SYSTEM.md),
 *    so the app stays flat-warm charcoal while the instrument gets its black sky.
 *  • Its four corners carry the figure's annotations — colorbar (with ticks and a unit), the
 *    haemodynamic-lag claim, the projection, and a hover readout. None of them cost a row.
 *  • The stimulus gets its OWN pane, beneath. It used to be dumped on the frontal lobe, occluding
 *    the object it exists to accompany; TRIBE gives it a deliberate home and so do we.
 *  • Type is Inter, sentence case. The mono caps are gone — all ten of them. Mono is sanctioned for
 *    micro-copy in this system, but at ten usages in one 360px card it stopped reading as
 *    instrumentation and started reading as terminal output.
 *
 * The stimulus plays BESIDE the brain, because a brain map with no stimulus is decoration:
 *  • a real video (the Read) → the actual <video> drives the clock, and the response is GROUNDED
 *    in the audience's real retention curve (attention tracks who is still watching; salience
 *    fires at the breaks; the default network rises with the people who checked out);
 *  • a text concept (the dock) → the words "play" one by one on the same clock (TRIBE v2 feeds
 *    text with word-level timing too), and the response is an explicitly-labeled SIMULATION.
 *
 * The brain visibly LAGS the stimulus. That is not a bug and not an effect: BOLD is haemodynamic,
 * the canonical HRF peaks ~5s after the neural event, and the convolution in cortex-sim produces
 * that lag for free. The figure claims the lag on screen, which is why the claim is load-bearing
 * chrome and not decoration — it may move, it may not be deleted.
 *
 * Dosage (LOCKED) survives via real neuroscience: the map is DIVERGING on the task-positive /
 * default-mode axis — the anticorrelation is a genuine phenomenon — so engaged cortex glows
 * cream→sage and only the default-mode system (mind-wandering: the audience you are losing)
 * glows coral. Coral still means exactly what it means everywhere else in the app. There is no
 * red/yellow "hot" colormap here, which is the one thing of TRIBE's we deliberately did NOT take.
 *
 * Deterministic: seeded off the focus id; the first frame is a pure function of props (SSR-safe),
 * the clock only starts client-side. Reduced motion holds the response at the stimulus midpoint.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { NETWORK_META, NETWORK_POLARITY } from '@/lib/brain/cortex-mesh';
import {
  ACTIVATION_SPAN,
  ACTIVATION_THRESHOLD,
  NETWORK_IDS,
  SPOKEN_NETWORKS,
  TR_S,
  HRF_PEAK_S,
  bandWord,
  hashSeed,
  predictedBold,
  type DriveInput,
  type NetworkId,
  type SimMode,
} from '@/lib/brain/cortex-sim';

/**
 * The cortex is WebGL and builds a 40k-vertex mesh on mount — neither belongs on the server, and
 * `three` is a heavy chunk that must not land on any page that never opens the brain.
 */
const CortexCanvas = dynamic(() => import('./CortexCanvas'), {
  ssr: false,
  loading: () => <div className="h-full w-full" aria-hidden />,
});

/** The playback clock ticks at TR/4 — BOLD is slow (TR = 1.49s); a 60fps repaint would be a lie. */
const TICK_MS = Math.round((TR_S / 4) * 1000);
/** A text concept's simulated encounter, seconds (an unhurried scroll-past + decision). Long
 *  enough that the HRF (a 16s low-pass) cannot smear the whole loop into one flat number. */
const TEXT_STIMULUS_S = 15;

export interface BrainViewProps {
  /** The focus's real stop-count — the ONE genuine aggregate. */
  stopCount: number;
  total: number;
  /** The concept under read — the text stimulus when no video exists. */
  conceptText: string;
  /** Seeds the model (focus id, else the concept text). */
  seedKey: string;
  reducedMotion?: boolean;
  /** A real video → the response is GROUNDED and the video plays as the stimulus. */
  videoSrc?: string | null;
  /** GROUNDED only: the audience's real retention at normalized stimulus time u∈[0,1] → 0..1. */
  retentionAt?: (u: number) => number;
  /** The stimulus length. Defaults to the simulated encounter; a video overrides from metadata. */
  durationS?: number;
}

export function BrainView({
  stopCount,
  total,
  conceptText,
  seedKey,
  reducedMotion = false,
  videoSrc,
  retentionAt,
  durationS,
}: BrainViewProps) {
  const mode: SimMode = videoSrc && retentionAt ? 'grounded' : 'simulated';
  const stopRatio = total > 0 ? Math.min(1, Math.max(0, stopCount / total)) : 0.6;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoDur, setVideoDur] = useState<number | null>(null);
  const duration = videoDur ?? durationS ?? TEXT_STIMULUS_S;

  const drive: DriveInput = useMemo(
    () => ({ mode, stopRatio, durationS: duration, retentionAt, seedKey }),
    [mode, stopRatio, duration, retentionAt, seedKey],
  );

  // ── The clock. Reduced motion holds at the stimulus midpoint (the characteristic frame);
  //    otherwise the video drives it, or an internal TR-paced loop does.
  const [t, setT] = useState(reducedMotion ? TEXT_STIMULUS_S / 2 : 0);
  // The text stimulus autoplays (it IS the ambient read). A VIDEO waits for a tap — autoplaying
  // media the moment a panel opens is hostile.
  const [playing, setPlaying] = useState(() => !videoSrc && !reducedMotion);

  useEffect(() => {
    if (reducedMotion || videoSrc || !playing) return;
    const id = setInterval(() => {
      setT((prev) => {
        const next = prev + TICK_MS / 1000;
        return next >= duration ? 0 : next; // the encounter loops
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [reducedMotion, videoSrc, playing, duration]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      if (v.paused) void v.play()?.catch(() => {});
      else v.pause();
      return;
    }
    setPlaying((p) => !p);
  }, []);

  // ── Predicted BOLD, per network, at the current scan time. The HRF convolution inside
  //    `predictedBold` is what makes the map lag the stimulus.
  const bold = useMemo(() => predictedBold(drive, t), [drive, t]);

  const seed = useMemo(() => hashSeed(seedKey), [seedKey]);

  const [hovered, setHovered] = useState<NetworkId | null>(null);

  // The hottest network right now — the one the strip emphasizes when nothing is hovered.
  const hottest = useMemo(() => {
    let best: NetworkId = NETWORK_IDS[0]!;
    for (const id of NETWORK_IDS) if (bold[id] > bold[best]) best = id;
    return best;
  }, [bold]);

  const u = duration > 0 ? Math.min(1, t / duration) : 0;
  const words = useMemo(() => conceptText.trim().split(/\s+/).filter(Boolean), [conceptText]);
  // The text stimulus "plays": words land over the first 70% of the encounter, then it sits and
  // the response resolves (the HRF is still catching up — that is the point).
  const wordsShown = Math.max(1, Math.round(Math.min(1, u / 0.7) * words.length));

  const stimulusLabel = mode === 'grounded' ? 'their video' : 'your concept';

  return (
    <div className="flex flex-col" data-testid="brain-view" data-mode={mode}>
      {/* ── The figure's header: what this is, and the scan clock. One quiet line of Inter —
             this used to be two lines of mono caps that wrapped mid-phrase. ── */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[10.5px] leading-none text-[var(--color-foreground-muted)]">
          Predicted cortical response · {mode === 'grounded' ? 'modeled' : 'simulated'}
        </p>
        <p className="shrink-0 text-[10.5px] leading-none text-[var(--color-foreground-muted)] tabular-nums">
          t {t.toFixed(1)}s · TR {TR_S}s
        </p>
      </div>

      {/* ══ THE WELL ═══════════════════════════════════════════════════════════════════════════
             A near-black inset — the specimen's sky. Everything a figure needs to be read sits in
             its corners (legend, unit, lag claim, projection, hover readout), so the annotations
             cost no rows and the cortex gets the whole frame. ── */}
      <div
        className="relative mt-2.5 w-full overflow-hidden rounded-[12px] border border-[var(--color-border)]"
        style={{ aspectRatio: '4 / 3', background: WELL_BG }}
        data-testid="brain-surface"
      >
        {/* The head, ghosted. It is barely there (4% cream) and it does a lot: it gives the
            specimen scale, orientation and a body to belong to — without it a lit 3D object on
            black reads as a floating artifact rather than anatomy. Our own path. */}
        <HeadGhost />

        <div className="absolute inset-0">
          <CortexCanvas seed={seed} bold={bold} t={t} reducedMotion={reducedMotion} onHover={setHovered} />
        </div>

        {/* Top-left — the hover readout. A real surface map names the region you point at, where
            you point at it; it does not keep a permanent row reserved for the answer. */}
        {hovered && (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-[6px] w-[6px] shrink-0 rounded-full"
              style={{ background: netFill(hovered, Math.max(0.6, bold[hovered])) }}
            />
            <span className="text-[11px] font-medium leading-none text-[var(--cream-primary)]">
              {NETWORK_META[hovered].label}
            </span>
            <span className="text-[11px] leading-none text-[var(--color-foreground-muted)] tabular-nums">
              {bold[hovered].toFixed(2)}
            </span>
          </div>
        )}

        {/* Top-right — the colorbar, the way a figure carries one: poles, TICKS, and the UNIT.
            It used to be a raw red→green slider with two shouty mono words and no scale. */}
        <div className="pointer-events-none absolute right-3 top-3 w-[128px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[9px] leading-none text-[var(--color-foreground-muted)]">drifting</span>
            <span className="text-[9px] leading-none text-[var(--color-foreground-muted)]">engaged</span>
          </div>
          <div className="relative mt-[4px]">
            <span className="flex h-[4px] overflow-hidden rounded-full">
              {Array.from({ length: 40 }, (_, i) => (
                // −1 = full default-mode … 0 = baseline gray … +1 = full task-positive.
                <span key={i} className="h-full flex-1" style={{ background: barFill((i / 39) * 2 - 1) }} />
              ))}
            </span>
            {/* Ticks — a scale, not a temperature slider. */}
            {[0, 50, 100].map((pct) => (
              <span
                key={pct}
                className="absolute top-full h-[3px] w-px bg-[rgba(255,255,255,0.22)]"
                style={{ left: `${pct}%`, transform: pct === 100 ? 'translateX(-1px)' : undefined }}
              />
            ))}
          </div>
          <p className="mt-[6px] text-center text-[9px] leading-none text-[var(--color-foreground-muted)]">
            predicted BOLD
          </p>
        </div>

        {/* Bottom — the figure's footer, inside the frame: the lag claim (load-bearing: the HRF is
            real and the UI says so) and the projection. */}
        <p className="pointer-events-none absolute bottom-2.5 left-3 text-[9px] leading-none text-[var(--color-foreground-muted)]">
          trails {stimulusLabel} by ~{HRF_PEAK_S}s · haemodynamic lag
        </p>
        <p className="pointer-events-none absolute bottom-2.5 right-3 text-[9px] leading-none text-[var(--color-foreground-muted)]">
          left hemisphere · lateral
        </p>
      </div>

      {/* ── The stimulus, in its own pane. It is the thing the cortex is responding to; it does not
             belong dumped on top of the cortex, dimming the object it explains. ── */}
      {/* A FIXED height, in both modes. Left to size itself, the video thumb's intrinsic aspect drove
          the flex row and the grounded pane came out ~2× the text one — which put the grounded card
          back over its container (measured: 530px of content in a 516px box) while the simulated one
          fit. The card has to fit in BOTH modes, and the two should not be different shapes. */}
      <div className="mt-2.5 flex h-[64px] items-stretch gap-2.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-2">
        {/* A VIDEO gets a real thumbnail — it is a picture, and it earns the space. A text concept
            does NOT: an empty 9:16 box with a play glyph floating in it is a dead element that
            reads as a broken image. It gets a plain transport button, and the words — which ARE
            the stimulus — get the room instead. */}
        {videoSrc ? (
          // Sized off the pane's fixed height, at roughly the 9:16 of the vertical video it shows.
          <div className="relative h-full w-[27px] shrink-0 overflow-hidden rounded-[6px] bg-[rgba(0,0,0,0.35)]">
            <video
              ref={videoRef}
              src={videoSrc}
              muted
              playsInline
              preload="metadata"
              data-testid="brain-stimulus-video"
              className="h-full w-full object-cover"
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d)) setVideoDur(d);
              }}
              onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
            {!reducedMotion && (
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? 'Pause the stimulus' : 'Play the stimulus'}
                className="absolute inset-0 grid place-items-center transition-opacity"
                style={{ opacity: playing ? 0 : 1 }}
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[rgba(0,0,0,0.5)] text-[var(--cream-primary)]">
                  <PlayGlyph playing={playing} />
                </span>
              </button>
            )}
          </div>
        ) : (
          !reducedMotion && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? 'Pause the stimulus' : 'Play the stimulus'}
              className="grid h-7 w-7 shrink-0 place-items-center self-center rounded-full border border-[var(--color-border)] text-[var(--color-foreground-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-foreground"
            >
              <PlayGlyph playing={playing} />
            </button>
          )
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
          {/* The concept landing word by word, on the scan clock — or the video's own name. */}
          {videoSrc ? (
            <p className="line-clamp-2 text-[11.5px] leading-[1.4] text-[var(--color-foreground-secondary)]">
              {conceptText}
            </p>
          ) : (
            <p
              className="line-clamp-2 flex flex-wrap gap-x-1 text-[11.5px] leading-[1.4]"
              data-testid="brain-stimulus-text"
            >
              {words.map((w, i) => (
                <span
                  key={`${w}-${i}`}
                  className={
                    i < wordsShown
                      ? 'text-[var(--cream-primary)]'
                      : 'text-[var(--color-foreground-muted)] opacity-30'
                  }
                  style={reducedMotion ? undefined : { transition: 'opacity 200ms linear, color 200ms linear' }}
                >
                  {w}
                </span>
              ))}
            </p>
          )}
          {/* The scan head — where we are in the encounter. */}
          <span className="block h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]">
            <span
              className="block h-full rounded-full bg-[rgba(236,231,222,0.35)]"
              style={{ width: `${Math.round(u * 100)}%`, ...(reducedMotion ? {} : { transition: 'width 200ms linear' }) }}
            />
          </span>
        </div>
      </div>

      {/* ── The four systems the room speaks about — one compact instrument strip. This was four
             stacked progress bars with mono caps labels, eating 69px and reading as a debug panel;
             it is now a 4-up readout with real values, and the loudest system leads. ── */}
      <div className="mt-3 grid grid-cols-4 gap-2.5">
        {SPOKEN_NETWORKS.map(({ id, label }) => {
          const v = bold[id];
          const isDefault = NETWORK_POLARITY[id] < 0;
          const lead = id === (hovered ?? hottest);
          return (
            <div key={id}>
              <div className="flex items-baseline justify-between gap-1">
                <span
                  className={
                    'truncate text-[9.5px] leading-none ' +
                    (lead ? 'text-[var(--color-foreground-secondary)]' : 'text-[var(--color-foreground-muted)]')
                  }
                >
                  {label}
                </span>
                <span
                  className={
                    'shrink-0 text-[10px] leading-none tabular-nums ' +
                    (lead ? 'text-[var(--cream-primary)]' : 'text-[var(--color-foreground-muted)]')
                  }
                >
                  {v.toFixed(2)}
                </span>
              </div>
              <span className="mt-[5px] block h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.round(v * 100)}%`,
                    background: isDefault ? 'var(--color-accent)' : SAGE,
                    opacity: lead ? 0.95 : 0.65,
                    ...(reducedMotion ? {} : { transition: 'width 260ms linear, opacity 150ms linear' }),
                  }}
                />
              </span>
            </div>
          );
        })}
      </div>

      {/* The verdict — the room's voice reading the scan. The ONE serif voice-moment on the card,
          and the finding everything above is evidence for. It used to be clipped off the bottom. */}
      <p className="mt-3 font-serif text-[15px] leading-snug tracking-[-0.005em] text-foreground">
        {verdictFor(stopRatio, bold, mode)}
      </p>

      {/* Foot — the honesty line. It must survive every redesign. */}
      <p className="mt-2 text-[9.5px] leading-none text-[var(--color-foreground-muted)]">
        {mode === 'grounded'
          ? 'modeled from your audience’s real retention · not a brain measurement'
          : 'a modeled response · a sketch, not a measurement'}
      </p>

      <p className="sr-only">
        {mode === 'grounded' ? 'Modeled' : 'Simulated'} cortical response to “{conceptText}”:{' '}
        {SPOKEN_NETWORKS.map((n) => `${n.label} ${bandWord(bold[n.id], n.words)}`).join(', ')}.
      </p>
    </div>
  );
}

/** The stimulus transport, in both its homes (over a video thumb, and beside the words). */
function PlayGlyph({ playing }: { playing: boolean }) {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      {playing ? (
        <path d="M7 5h3.5v14H7V5Zm6.5 0H17v14h-3.5V5Z" />
      ) : (
        <path d="M8 5.5v13l11-6.5L8 5.5Z" />
      )}
    </svg>
  );
}

/**
 * The head the specimen sits in — ours, drawn as one path, facing left the way an anatomical
 * lateral view is conventionally plated. It is deliberately almost invisible: at 4% cream on the
 * near-black well it registers as context, not as an illustration. TRIBE's demo does the same thing
 * and it is most of why their brain reads as *a brain in a person* rather than a lit 3D object.
 */
function HeadGhost() {
  return (
    // Drawn in the WELL's own 4:3 frame (not a portrait box that gets sliced), so the cranial vault
    // lands exactly where the specimen sits and the face runs off the left edge the way a cropped
    // anatomical plate does. Sliced from a portrait viewBox it came out as disconnected smudges.
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      data-testid="brain-head-ghost"
    >
      <path
        d="M250 18 C160 18 82 70 74 140 C72 158 52 164 44 180 C36 194 58 197 60 205
           L34 240 C27 252 48 255 64 256 C55 267 60 276 72 281 C76 292 82 298 88 300
           L400 300 C400 220 396 90 340 48 C315 30 285 18 250 18 Z"
        fill="rgba(236, 231, 222, 0.055)"
      />
    </svg>
  );
}

// The resting cortex: a curvature-shaded gray surface — gyral crowns light, sulcal depths dark.
// This is what a surface plot shows where nothing clears threshold, and it is most of the brain
// most of the time. Painting every parcel is what makes a generated map look like stained glass.
const GYRUS: RGB = [88, 87, 84];
const SULCUS: RGB = [58, 57, 55];
// The two poles of the diverging map, at threshold → at full activation.
const TASK_LOW: RGB = [169, 198, 160];
const TASK_HIGH: RGB = [63, 122, 74]; // pale sage → deep, saturated sage
const DMN_LOW: RGB = [230, 169, 157];
const DMN_HIGH: RGB = [196, 66, 54]; // pale coral → deep coral-red

/** The sage the strip's task-positive bars take — the same pole the map uses. */
const SAGE = 'rgb(169, 198, 160)';

/**
 * THE WELL. A near-black, faintly warm sky for the specimen.
 *
 * This is not decoration and it is not a token we already had. TRIBE's brain reads as an organ
 * partly because of the geometry, but mostly because of VALUE: a near-white specimen on pure black.
 * Ours was a mid-beige specimen on mid-charcoal (`#262624`) — the same value as its surroundings,
 * so it had no silhouette and no presence, and no amount of mesh work was going to fix that.
 * Sinking the instrument into its own dark tone-zone buys the contrast without repainting the app
 * (the surrounding card, and every other scale of the Room, stays flat-warm charcoal).
 */
const WELL_BG = '#131210';

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
const css = ([r, g, b]: RGB) => `rgb(${r}, ${g}, ${b})`;

/**
 * A network's swatch: the resting cortex gray, with the activation colour composited over it ONLY
 * once it clears threshold. Diverging on the real axis — task-positive goes sage, the default-mode
 * system goes coral — so the locked dosage rule survives: coral still means "you are losing them".
 * The same ramp the shader applies to the surface, so the readout dot matches the cortex.
 */
function netFill(net: NetworkId, v: number): string {
  const base = mix(SULCUS, GYRUS, 0.6);
  const x = v < 0 ? 0 : v > 1 ? 1 : v;
  if (x <= ACTIVATION_THRESHOLD) return css(base);
  // How far above threshold, 0..1 — the alpha AND the position on the pole's ramp.
  const s = Math.min(1, (x - ACTIVATION_THRESHOLD) / ACTIVATION_SPAN);
  const hot = NETWORK_POLARITY[net] < 0 ? mix(DMN_LOW, DMN_HIGH, s) : mix(TASK_LOW, TASK_HIGH, s);
  return css(mix(base, hot, 0.35 + 0.65 * s));
}

/** The colorbar's swatch at a point on the diverging axis (−1 = drifting … +1 = engaged). */
function barFill(x: number): string {
  const base = mix(SULCUS, GYRUS, 0.5);
  const m = Math.abs(x);
  if (m < 0.06) return css(base);
  const hot = x < 0 ? mix(DMN_LOW, DMN_HIGH, m) : mix(TASK_LOW, TASK_HIGH, m);
  return css(mix(base, hot, 0.25 + 0.75 * m));
}

/** The room's voice reading the scan — banded on the real stop ratio + the live response. */
function verdictFor(stopRatio: number, bold: Record<NetworkId, number>, mode: SimMode): string {
  const drifting = bold.default > bold.dorsal_attention;
  if (drifting) {
    return mode === 'grounded'
      ? 'The default network is winning — the room is somewhere else while your video plays.'
      : 'The default network is winning — minds wander before the concept lands.';
  }
  if (stopRatio >= 0.7)
    return 'Salience spikes, attention holds, and the reward loop stays lit — the room keeps watching.';
  if (stopRatio >= 0.4)
    return 'The onset lands, then attention thins into the decision — the middle does the losing.';
  return 'A flicker of salience, then attention collapses — they are gone before the turn.';
}
