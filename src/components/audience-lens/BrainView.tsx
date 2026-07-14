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
import { NETWORK_META, NETWORK_POLARITY } from '@/lib/brain/cortex-field';
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

  // The whole encounter, sampled once — the stimulus's neural drive and the BOLD it predicts.
  const trace = useMemo(() => buildTrace(drive, duration), [drive, duration]);

  // ── The clock. The video drives it, or an internal TR-paced loop does.
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

  /**
   * OPEN ON THE CHARACTERISTIC FRAME, not on a dead cortex.
   *
   * A video waits for a tap, so the grounded panel used to open at t=0 — which is INSIDE the
   * haemodynamic lag, where by construction nothing has responded yet. The map was therefore blank
   * on arrival and the instrument looked broken. It was not: probing the model, grounded clears
   * threshold from ~6s and stays lit for 14 of 17 sampled frames. The bug was that we were showing
   * the one moment that is honestly empty.
   *
   * So the scan opens on its PEAK — the moment the audience's own retention curve says is the
   * crisis — and the video is seeked to match, so the thumbnail and the cortex agree. Press play and
   * it runs from there; the lag is then visible as the response climbing out behind the stimulus.
   * Only before the FIRST play: pausing later must not yank the clock back.
   */
  const hasPlayed = useRef(false);
  useEffect(() => {
    if (playing) hasPlayed.current = true;
  }, [playing]);

  useEffect(() => {
    if (!videoSrc || playing || hasPlayed.current) return;
    setT(trace.peakT);
    const v = videoRef.current;
    if (v && v.readyState >= 1 && Number.isFinite(v.duration)) {
      try {
        v.currentTime = Math.min(trace.peakT, v.duration - 0.05);
      } catch {
        /* a seek can throw while the media is still settling — the cortex is already correct */
      }
    }
  }, [videoSrc, playing, trace.peakT]);

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

  // Where the room sits on the diverging axis right now: task-positive attention MINUS the
  // default-mode system. This is the same anticorrelation the map is painted on, read as one number.
  const axisPct = useMemo(() => {
    const axis = Math.max(-1, Math.min(1, bold.dorsal_attention - bold.default));
    return ((axis + 1) / 2) * 100;
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
             cost no rows and the cortex gets the whole frame.

             9:8, not 11:8. The 4-up network strip below used to eat 69px; the specimen gets them.
             Measured against TRIBE: their brain is ~600x550px in a 1440px viewport — half the screen
             — while ours was ~430x310 in a 474px card, a QUARTER of the area. No mesh reads at that
             size, and no amount of geometry was ever going to fix a frame too small to show it. ── */}
      <div
        className="relative mt-2.5 w-full overflow-hidden rounded-[12px] border border-[var(--color-border)]"
        style={{ aspectRatio: '9 / 8', background: WELL_BG }}
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
            {/* THE LIVE MARKER — where the room is sitting on the axis RIGHT NOW. A legend only tells
                you how to read the map; this also tells you the reading, and it moves with the scan.
                (TRIBE's colorbar is inert. This is the cheapest place to be better than it.) */}
            <span
              aria-hidden
              className="absolute -top-[3px] h-[10px] w-[2px] rounded-full bg-[var(--cream-primary)]"
              style={{
                left: `${axisPct}%`,
                transform: 'translateX(-1px)',
                boxShadow: '0 0 0 1.5px rgba(19,18,16,0.9)',
                ...(reducedMotion ? {} : { transition: 'left 260ms linear' }),
              }}
            />
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
      <div className="mt-2.5 flex h-[72px] items-stretch gap-2.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-2">
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

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
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
          {/* ── THE TRACE. This is the instrument TRIBE has no equivalent of, and it earns its
                 place: the card CLAIMS a haemodynamic lag in words, and here you can SEE it. The
                 pale line is the stimulus's neural drive; the sage line is the BOLD it predicts,
                 visibly climbing out behind it. It replaces a plain progress bar that carried a
                 single number (where are we) with the same playhead plus the whole shape of the
                 encounter. ── */}
          <HrfTrace trace={trace} u={u} reducedMotion={reducedMotion} />
        </div>
      </div>

      {/* The verdict — the room's voice reading the scan. The ONE serif voice-moment on the card,
          and the finding everything above is evidence for. It used to be clipped off the bottom.
          It leads on size and weight because it is the answer; everything above it is the working. */}
      <p className="mt-3.5 font-serif text-[16px] leading-[1.35] tracking-[-0.01em] text-foreground">
        {verdictFor(stopRatio, bold, mode)}
      </p>

      {/* Foot — the honesty line. It must survive every redesign. */}
      <p className="mt-2.5 text-[9.5px] leading-none text-[var(--color-foreground-muted)]">
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

/** How many points the trace is sampled at. Enough to draw the HRF's shape, cheap enough to build
 *  synchronously whenever the drive changes (which is rarely — never on the scan clock). */
const TRACE_N = 56;

interface Trace {
  /** The DIVERGING AXIS over the encounter: task-positive attention MINUS the default-mode system,
   *  in −1..+1. Above zero the room is with you; below it, it is somewhere else. */
  axis: number[];
  /** The scan time of the strongest predicted response — the encounter's characteristic frame. */
  peakT: number;
  /** The y-gain that makes this encounter's biggest deflection fill the box (see TRACE_GAIN_MAX). */
  gain: number;
}

/**
 * Sample the whole encounter once, and plot THE AXIS — the same task-positive ⇄ default-mode
 * anticorrelation the cortex is painted on, and the same one the colorbar is scaled to.
 *
 * ⚠️ This is the third series I tried, and the first two were wrong for reasons worth keeping:
 *
 *  • Plotting the drive against the BOLD, each normalized to its own range, made the lag pop —
 *    and was a LIE. Measured: over a 15s encounter the drive swings 0.23→0.89 but the BOLD only
 *    moves 0.590→0.645, because the HRF is a 16-second low-pass that eats nearly all the structure.
 *    The series' own numerical wobble is ~18% of that 0.055 span, so min-max normalization was
 *    amplifying rounding noise into a full-height zigzag — a manufactured signal, drawn as data.
 *  • Re-plotting both on a common absolute scale was honest, and inert: a spiking stimulus and a
 *    flat line. True, and worth nothing to a creator.
 *
 * The axis is the series that carries the STORY, and it is well-conditioned: measured span 0.93 in
 * grounded mode, roughness ~1.4% of span (no zigzag), and it CROSSES ZERO — negative early, positive
 * through the middle, negative again at the end. That is "you lose them in the back half", drawn.
 * It also costs nothing to read, because the sage/coral it is filled with already means exactly this
 * everywhere else on the card.
 */
function buildTrace(input: DriveInput, duration: number): Trace {
  const axis: number[] = [];
  let peakT = 0;
  let peakV = -Infinity;

  for (let i = 0; i < TRACE_N; i++) {
    const t = (i / (TRACE_N - 1)) * duration;
    const b = predictedBold(input, t);
    axis.push(Math.max(-1, Math.min(1, b.dorsal_attention - b.default)));
    // The characteristic frame is the loudest MOMENT overall, not the loudest attention — a scan
    // dominated by the default network is still a scan, and its peak is still where the story is.
    const loudest = Math.max(...NETWORK_IDS.map((n) => b[n]));
    if (loudest > peakV) {
      peakV = loudest;
      peakT = t;
    }
  }

  // Auto-range, ANCHORED AT ZERO. The axis is a difference of two 0..1 networks, so ±1 is its
  // arithmetic limit but nowhere near its practical range — measured, it lives inside ±0.55, and a
  // fixed ±1 scale drew the whole story as a flat ripple in the middle of an empty box. Scaling so
  // this encounter's biggest deflection fills the box restores the shape.
  //
  // What must NOT move is the ZERO LINE: the sign is the meaning (above it the room is with you,
  // below it they are gone), so the axis is auto-ranged in AMPLITUDE only, never re-centred. The
  // floor stops a near-silent encounter from being amplified into false drama.
  const maxAbs = Math.max(TRACE_MIN_RANGE, ...axis.map(Math.abs));
  return { axis, peakT, gain: TRACE_GAIN_MAX / maxAbs };
}

/** The trace's 0..10 user space: zero in the middle, and the most a deflection may reach from it. */
const TRACE_ZERO = 5;
const TRACE_GAIN_MAX = 4.4;
/** Below this, an encounter is flat and is DRAWN flat — auto-range must not manufacture drama. */
const TRACE_MIN_RANGE = 0.25;

/**
 * The trace: engagement over the whole encounter, filled sage where the room is with you and coral
 * where it is drifting — the same two poles as the map and the colorbar, so the card speaks one
 * language. The playhead says where the scan currently is.
 *
 * Drawn in a 0..100 × 0..10 user space and stretched to fit, so it stays crisp at any card width
 * with no resize observer.
 */
function HrfTrace({ trace, u, reducedMotion }: { trace: Trace; u: number; reducedMotion: boolean }) {
  const n = trace.axis.length;
  const pts = trace.axis
    .map((v, i) => `${((i / (n - 1)) * 100).toFixed(2)},${(TRACE_ZERO - v * trace.gain).toFixed(2)}`)
    .join(' L');
  // Closed to the ZERO LINE (not the floor), so the fill reads as a signed deflection rather than a
  // quantity — which is what a diverging axis is.
  const area = `M0,${TRACE_ZERO} L${pts} L100,${TRACE_ZERO} Z`;

  return (
    <div className="relative w-full" aria-hidden>
      <svg
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        className="block h-[18px] w-full"
        data-testid="brain-hrf-trace"
      >
        <defs>
          {/* The sign of the deflection picks the colour, by clipping the SAME area path to the half
              of the box it belongs in. One path, two meanings — and no chance of the two halves
              disagreeing about where zero is. */}
          <clipPath id="trace-up">
            <rect x="0" y="0" width="100" height={TRACE_ZERO} />
          </clipPath>
          <clipPath id="trace-down">
            <rect x="0" y={TRACE_ZERO} width="100" height={10 - TRACE_ZERO} />
          </clipPath>
        </defs>

        <path d={area} clipPath="url(#trace-up)" fill={SAGE} fillOpacity="0.30" />
        <path d={area} clipPath="url(#trace-down)" fill="var(--color-accent)" fillOpacity="0.32" />

        {/* Zero — the line the room is either above or below. */}
        <line
          x1="0"
          x2="100"
          y1={TRACE_ZERO}
          y2={TRACE_ZERO}
          stroke="rgba(236,231,222,0.18)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={`M${pts}`}
          fill="none"
          stroke="rgba(236,231,222,0.55)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* The playhead. */}
      <span
        className="pointer-events-none absolute inset-y-0 w-px bg-[rgba(236,231,222,0.5)]"
        style={{ left: `${u * 100}%`, ...(reducedMotion ? {} : { transition: 'left 200ms linear' }) }}
      />
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
      {/* ⚠️ BIG AND SOFT, not small and sharp.
          Diffed against TRIBE: their head is a LARGE, low-contrast mass that the brain sits inside,
          and it fills the frame. Ours was a hard-edged path at 8.5% cream — small enough and defined
          enough that at card scale it read as "an amorphous dark smudge" rather than as a head, which
          is exactly how the owner described it. So: bigger than the specimen, blurred at the edge, and
          quieter. It should register as context in peripheral vision and never as an illustration. */}
      <defs>
        <filter id="head-soft" x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <path
        d="M262 18 C170 12 74 58 34 132 C26 148 12 156 6 172 C-3 192 20 196 22 206
           L-2 250 C-10 266 14 270 30 271 C20 284 25 294 37 300 L400 300
           C400 220 402 96 378 60 C352 22 330 22 262 18 Z"
        fill="rgba(236, 231, 222, 0.055)"
        filter="url(#head-soft)"
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
