'use client';

/**
 * BrainView — "The brain": a predicted cortical response to the thing the room is reacting to,
 * modeled on TRIBE v2 (Meta FAIR's trimodal brain encoder, Algonauts 2025).
 *
 * We reproduce the SHAPE of that work, never its code: TRIBE is CC-BY-NC-4.0 and its fsaverage
 * geometry is FreeSurfer-derived, so neither can ship here. Our cortical surface is a REAL one we are
 * allowed to use (`public/brain/cortex.glb` — a FreeSurfer reconstruction of a T1-weighted MRI,
 * CC-BY dgallichan — rendered by `./CortexCanvas`), and the response model is ours
 * (`@/lib/brain/cortex-sim`: per-network neural drive → canonical double-gamma HRF → predicted BOLD).
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
 *  • THE WELL — a near-black, SQUARE inset the specimen lives in. This is the one move that buys
 *    TRIBE's figure/ground: their brain is near-white on pure black, ours was mid-beige on
 *    mid-charcoal, and THAT is why it read as murky. The well is a legitimate matte tone-zone
 *    (docs/DESIGN-SYSTEM.md), so the app stays flat-warm charcoal while the instrument gets its
 *    black sky.
 *  • THE SPECIMEN OWNS THE FRAME. Measured against TRIBE: their brain is half their viewport, ours
 *    was a quarter of the card. The well is square now and the cortex is scaled to fill it — which
 *    is only possible because the colorbar MOVED OUT of the well's top-right corner, where it used
 *    to collide with the very object it annotates.
 *  • THE INSTRUMENT ROW, beneath the well: TRIBE's pattern of one quiet row under the specimen. It
 *    carries the colorbar, which a figure's legend has always belonged under — and which had to leave
 *    the well's corner before the cortex could grow into its frame. TRIBE's `Normal | Inflated` toggle
 *    is NOT here: it was built and cut, and the row explains why.
 *  • The stimulus gets its OWN pane, beneath that. It used to be dumped on the frontal lobe,
 *    occluding the object it exists to accompany; TRIBE gives it a deliberate home and so do we.
 *  • Type is Inter, sentence case. The mono caps are gone — all ten of them. Mono is sanctioned for
 *    micro-copy in this system, but at ten usages in one 360px card it stopped reading as
 *    instrumentation and started reading as terminal output.
 *
 * ── WHAT THE MAP CLAIMS (changed 2026-07-14, owner-approved) ──────────────────────────────────
 * The surface is painted with a CONTRAST AGAINST REST, not with raw predicted BOLD. An fMRI figure
 * has never shown "activity" — it shows a difference between two conditions, thresholded, which is
 * why a real statistical map is mostly grey. Painting raw BOLD lit 57% of the cortex (six of our
 * seven networks are task-positive, so "engaged" meant "nearly all of it"), and that is the single
 * biggest reason ours read as continents while TRIBE's reads as a map. Measured on the real model:
 * a strong hook peaks at 26% (was 40%), a typical moment sits near 8%, and — the part that nearly went
 * wrong — the DEFAULT-MODE system still turns coral when the room walks out. It briefly did not, and
 * every test still passed, because the tests asserted against fixtures hotter than the model can be.
 * The colorbar says `vs rest`, because the card must claim exactly what it draws.
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
  RESTING_BOLD,
  SPOKEN_NETWORKS,
  TR_S,
  HRF_PEAK_S,
  bandWord,
  contrastBold,
  hashSeed,
  predictedBold,
  type DriveInput,
  type NetworkId,
  type SimMode,
} from '@/lib/brain/cortex-sim';
import type { PersonaNode } from '@/components/board/_kit';
import { buildBatchScale, buildRoomReadout, holdChip, type RoomReadout } from './room-readout';

/**
 * The cortex is WebGL and builds a 40k-vertex mesh on mount — neither belongs on the server, and
 * `three` is a heavy chunk that must not land on any page that never opens the brain.
 */
const CortexCanvas = dynamic(() => import('./CortexCanvas'), {
  ssr: false,
  loading: () => <WellSkeleton />,
});

/**
 * The well while the specimen is still on its way. It is 1.8MB of mesh plus a parcellation build, and
 * what used to happen in that window was NOTHING — `fallback={null}`, an empty black box, and then a
 * brain would pop into existence. An instrument that is loading should look like an instrument that is
 * loading.
 *
 * So: the frame the specimen will occupy, breathing. No spinner (a spinner says "wait"), no progress
 * bar (we cannot honestly report progress on a WebGL warm-up) — just the well, alive.
 */
function WellSkeleton() {
  return (
    <div className="grid h-full w-full place-items-center" aria-hidden data-testid="brain-skeleton">
      <span
        className="h-[46%] w-[52%] rounded-[50%] motion-safe:animate-pulse"
        style={{ background: 'rgba(236,231,222,0.045)' }}
      />
    </div>
  );
}

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
  /**
   * The room's REAL persona votes. In INSTANT mode these are the only true thing the card has, and
   * they become its instrument (see `./room-readout`). Absent → the card falls back to the figure
   * and the verdict alone; it never fabricates a room.
   */
  personas?: PersonaNode[];
  /**
   * What the room actually reacted to ("Hook" | "Idea" | "Script" | "Remix"). It exists for ONE
   * reason, and it is an honesty one: on a SCRIPT, the ten personas voted on the OPENING BEAT only
   * (`ScriptCardBlockSchema`: "band/fraction describe the OPENER beat only"). The readout must say
   * so, or a creator reads "6 of 10 stopped" as a verdict on their whole script when it is a verdict
   * on their first three seconds.
   */
  kindLabel?: string;
  // ── THE COUNTERFACTUAL (the rewrite loop, already built — see AmbientRoom's PR-3 lever) ─────────
  /**
   * Sapient's headline instrument is a counterfactual: "with the recommended cut → 74%" against
   * "as scanned → 52%". It is the move that turns a diagnosis into an action — and it is a
   * PREDICTION, which is the one thing we will not fake.
   *
   * We do it the honest way round, and it is strictly better: we do not predict what a rewrite
   * would do, we RE-RUN the skill steered by the bouncers' real words and show what it ACTUALLY
   * did. The lever is the objection verbatim — the same quote the readout is already showing, so
   * the card cannot recommend one thing and act on another.
   */
  canRewrite?: boolean;
  onRewrite?: (lever: string) => void | Promise<void>;
  rewriteBusy?: boolean;
  rewriteError?: string | null;
  /** Frozen at tap-time by the Room → the REAL before/after. Never a projection. */
  rewriteDelta?: { prior: { stop: number; total: number }; next: { stop: number; total: number } } | null;
  /**
   * The BATCH's stop-ratios (0..1), this card's included — the composer's other hooks from the same
   * run. It is the readout's SCALE. The reference labels its bar ">70 STRONG"; we cannot (§17.2 —
   * there is no corpus to take a percentile from), but "where this lands against your other four"
   * is a real benchmark we already have, and it is the question a creator is actually asking.
   */
  batchRatios?: number[];
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
  personas,
  kindLabel,
  canRewrite = false,
  onRewrite,
  rewriteBusy = false,
  rewriteError,
  rewriteDelta,
  batchRatios,
}: BrainViewProps) {
  const mode: SimMode = videoSrc && retentionAt ? 'grounded' : 'simulated';
  /**
   * ── INSTANT vs GROUNDED — the card is polymorphic on its STIMULUS, not on the skill name.
   *
   * A real video (the Read) has an encounter: real seconds, and a measured retention curve to drive
   * the response. Everything else — a hook, an idea, a raw thought — has NO encounter. It is one
   * moment.
   *
   * The card used to pretend otherwise. In simulated mode `cortex-sim` invents "a seeded encounter
   * envelope": a 15-second timeline, a TR clock ticking over it, and a haemodynamic trace — for a
   * hook that has no 15 seconds. It was honestly LABELLED, and it was still answering a "when"
   * question the stimulus never posed, which is most of why this card read as a debug panel on six
   * of the eight skills.
   *
   * So in INSTANT mode the timeline, the clock, the trace and the colorbar are GONE, and the
   * specimen renders AT REST — because its per-region activation here is a seeded function of
   * (stopRatio, hash(seedKey)), which means two different hooks with the same stop-count would get
   * different "activation" from the id hash alone. Painting that would be the same lie in a
   * prettier costume. The figure is anatomy; the truth lives in the readout below it, which is
   * built from the ten personas' REAL votes.
   */
  const instant = mode !== 'grounded';
  const stopRatio = total > 0 ? Math.min(1, Math.max(0, stopCount / total)) : 0.6;

  /** The room's real votes → the instrument. Null when there is no room (never a fabricated one). */
  const readout = useMemo(
    () => buildRoomReadout(personas ?? [], { stopCount, total }),
    [personas, stopCount, total],
  );
  /** Where this card lands against the rest of its batch. Null below two cards — a scale with one
   *  point on it is not a scale. */
  const scale = useMemo(
    () => buildBatchScale(batchRatios ?? [], total > 0 ? stopCount / total : 0),
    [batchRatios, stopCount, total],
  );

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
  /** The specimen has arrived (mesh parsed + field built) — the well fades from its skeleton to it. */
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  /**
   * THE RESPONSE, as the map paints it: a CONTRAST against the resting baseline, not raw BOLD.
   *
   * Everything on this card that reports a number now reads from here — the colorbar's live marker,
   * the hover readout, the trace, the verdict. That is not tidiness, it is the difference between a
   * figure and a dashboard: if the legend is scaled to one quantity and the surface is painted with
   * another, the card is quietly lying about what you are looking at.
   */
  const response = useMemo(() => contrastBold(bold), [bold]);

  // Where the room sits on the diverging axis right now: task-positive attention MINUS the
  // default-mode system. This is the same anticorrelation the map is painted on, read as one number.
  const axisPct = useMemo(() => ((axisOf(response) + 1) / 2) * 100, [response]);

  const u = duration > 0 ? Math.min(1, t / duration) : 0;
  const words = useMemo(() => conceptText.trim().split(/\s+/).filter(Boolean), [conceptText]);
  // The text stimulus "plays": words land over the first 70% of the encounter, then it sits and
  // the response resolves (the HRF is still catching up — that is the point).
  const wordsShown = Math.max(1, Math.round(Math.min(1, u / 0.7) * words.length));

  const stimulusLabel = mode === 'grounded' ? 'their video' : 'your concept';

  return (
    <div className="flex flex-col" data-testid="brain-view" data-mode={mode}>
      {/* ══ THE WELL ═══════════════════════════════════════════════════════════════════════════
             A near-black inset — the specimen's sky. Everything a figure needs to be read sits in
             its corners (legend, unit, lag claim, projection, hover readout), so the annotations
             cost no rows and the cortex gets the whole frame.

             9:8, not 11:8. The 4-up network strip below used to eat 69px; the specimen gets them.
             Measured against TRIBE: their brain is ~600x550px in a 1440px viewport — half the screen
             — while ours was ~430x310 in a 474px card, a QUARTER of the area. No mesh reads at that
             size, and no amount of geometry was ever going to fix a frame too small to show it. ── */}
      <div
        className="relative w-full overflow-hidden rounded-[12px] border border-[var(--color-border)]"
        style={{ aspectRatio: instant ? WELL_ASPECT_INSTANT : WELL_ASPECT, background: WELL_BG }}
        data-testid="brain-surface"
      >
        {/* The head, ghosted. It is barely there (4% cream) and it does a lot: it gives the
            specimen scale, orientation and a body to belong to — without it a lit 3D object on
            black reads as a floating artifact rather than anatomy. Our own path. */}
        <HeadGhost />

        {/* ── THE ENTRANCE, and why it lives HERE in the DOM rather than in the shader.
               The specimen used to pop into an empty well. The obvious fix was to fade it in from
               inside the render loop — and that shipped a worse bug than the one it fixed: on a page
               with several WebGL canvases, one canvas's loop stalls and freezes on the last frame it
               drew, which was the frame where the fade had not yet started. The brain sat there as a
               perfect BLACK SILHOUETTE, and nothing threw.
               So the fade is a CSS transition on the wrapper. The compositor runs it, a stalled GL
               loop cannot starve it, and the worst case is now a fully-lit brain that is not moving —
               instead of an invisible one. It waits for `onReady` (mesh parsed, field built), so what
               fades in is the specimen, never an empty canvas. */}
        {!ready && <WellSkeleton />}
        <div
          className="absolute inset-0"
          style={{
            opacity: ready ? 1 : 0,
            transform: ready || reducedMotion ? 'scale(1)' : 'scale(0.96)',
            ...(reducedMotion ? {} : { transition: `opacity 620ms ${EASE}, transform 820ms ${EASE}` }),
          }}
        >
          <CortexCanvas
            seed={seed}
            // AT REST in instant mode — and by CONSTRUCTION, not by a magic zero: `contrastBold`
            // subtracts RESTING_BOLD, so feeding it back gives a contrast of exactly 0 on every
            // network, which is below threshold everywhere. The specimen is anatomy, unpainted.
            bold={instant ? RESTING_BOLD : bold}
            t={t}
            reducedMotion={reducedMotion}
            onHover={instant ? undefined : setHovered}
            onReady={onReady}
          />
        </div>

        {/* ── TOP-LEFT — what this is, and what you are pointing at, in the SAME slot.
               The two never need to be read at once: a figure's caption is what you read until you
               start interrogating the figure, at which point the region under the cursor IS the
               caption. Sharing the slot is what let the header row leave the card body entirely —
               and the card was overflowing its 516px box by 93px, clipping the verdict off the
               bottom, which is a worse crime than a caption that yields on hover.
               The hover number is the CONTRAST (what the surface is actually painted with) — hence Δ. */}
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5">
          {hovered ? (
            <>
              <span
                aria-hidden
                className="h-[6px] w-[6px] shrink-0 rounded-full"
                style={{ background: netFill(hovered, Math.max(0.6, response[hovered])) }}
              />
              <span className="text-[11px] font-medium leading-none text-[var(--color-cream-primary)]">
                {NETWORK_META[hovered].label}
              </span>
              <span className="text-[11px] leading-none text-[var(--color-foreground-muted)] tabular-nums">
                Δ{response[hovered].toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-[10.5px] leading-none text-[var(--color-foreground-muted)]">
              {instant ? 'Cortical anatomy · at rest' : 'Predicted cortical response · modeled'}
            </span>
          )}
        </div>

        {/* Top-right — the scan clock. GROUNDED ONLY: a clock counting seconds over a hook that has
            no seconds was the card's most confident lie. */}
        {!instant && (
          <p className="pointer-events-none absolute right-3 top-3 text-[10.5px] leading-none text-[var(--color-foreground-muted)] tabular-nums">
            t {t.toFixed(1)}s · TR {TR_S}s
          </p>
        )}

        {/* Bottom — the lag claim, inside the frame. Load-bearing where it is TRUE: the HRF is real
            and the brain visibly trails a real stimulus because of it. There is no lag to claim when
            there is no encounter, so it is grounded-only. */}
        {!instant && (
          <p className="pointer-events-none absolute bottom-2.5 left-3 text-[9px] leading-none text-[var(--color-foreground-muted)]">
            trails {stimulusLabel} by ~{HRF_PEAK_S}s · haemodynamic lag
          </p>
        )}
      </div>

      {/* ══ THE INSTRUMENT ROW ══════════════════════════════════════════════════════════════════
             TRIBE puts its controls in ONE quiet row beneath the specimen. We take the PATTERN — and
             the colorbar lives here now, because it used to be crammed into the well's top-right where
             it collided with the specimen it annotates. A figure's legend belongs UNDER the figure,
             and moving it is what let the cortex grow to fill its frame.

             ⚠️ TRIBE's `Normal | Inflated` toggle IS NOT HERE, and it is the one thing of theirs we
             wanted most. It was BUILT and then CUT, for a reason worth keeping (docs, and
             scripts/build-inflated-mesh.mjs): an inflated surface has to be a real second geometry,
             and ours cannot be derived from the asset we ship. Smoothing our decimated whole-brain
             mesh turns its sulcal slivers inside out — measured, 2.3% of triangles inverted after only
             20 smoothing steps — and back-facing triangles are culled, so the "inflated" brain renders
             as a rotted, perforated shell. It looked plausible in every statistic (roughness fell 80%,
             the shape held) and was obviously broken the moment it was on screen.
             The real fix is upstream: FreeSurfer EMITS an inflated surface (lh/rh.inflated) next to the
             one this mesh came from. Source that, and the toggle is trivial and correct. ── */}
      {/* A legend for a map that is not painted is furniture. INSTANT rests the specimen, so the
          colorbar goes with it — REMOVED from the DOM, not `hidden`. A hidden legend still ships its
          live marker to assistive tech, still animates, and still reports a reading for a map that
          is not there. (The test caught this: "no colorbar" was false while the class said so.) */}
      {!instant && (
      <div className="mt-2 flex items-center gap-3">
        {/* The colorbar: poles, TICKS, the UNIT — and a LIVE MARKER, which TRIBE's does not have.
            A legend tells you how to read the map; this one also tells you the reading.

            ⚠️ IT IS NARROW ON PURPOSE. Full-bleed, this was the LOUDEST thing on the card — a
            saturated coral→sage gradient running the whole width, out-shouting the specimen it
            annotates, in a system whose accent dosage is LOCKED at near-zero. The fix is NOT to
            desaturate the ramp: `barFill` maps value→colour exactly as the shader paints it, so a
            quieter ramp would make the legend LIE about the map. So the ramp stays honest and the
            ELEMENT shrinks — TRIBE's legend is ~30% of their well's width; ours was 100%. */}
        <div className="pointer-events-none w-[62%] min-w-0 max-w-[190px]">
          <div className="relative">
            <span className="flex h-[4px] overflow-hidden rounded-full">
              {Array.from({ length: 40 }, (_, i) => (
                // −1 = full default-mode … 0 = baseline gray … +1 = full task-positive.
                <span key={i} className="h-full flex-1" style={{ background: barFill((i / 39) * 2 - 1) }} />
              ))}
            </span>
            {[0, 50, 100].map((pct) => (
              <span
                key={pct}
                className="absolute top-full h-[3px] w-px bg-[rgba(255,255,255,0.22)]"
                style={{ left: `${pct}%`, transform: pct === 100 ? 'translateX(-1px)' : undefined }}
              />
            ))}
            <span
              aria-hidden
              data-testid="brain-colorbar-marker"
              className="absolute -top-[3px] h-[10px] w-[2px] rounded-full bg-[var(--color-cream-primary)]"
              style={{
                left: `${axisPct}%`,
                transform: 'translateX(-1px)',
                boxShadow: '0 0 0 1.5px rgba(19,18,16,0.9)',
                // Not linear. The marker is riding a haemodynamic response, and the response eases —
                // so the thing that reports it should ease too. Linear is the tell of undesigned motion.
                ...(reducedMotion ? {} : { transition: `left 320ms ${EASE}` }),
              }}
            />
          </div>
          <div className="mt-[5px] flex items-baseline justify-between">
            <span className="text-[9px] leading-none text-[var(--color-foreground-muted)]">drifting</span>
            <span className="text-[9px] leading-none text-[var(--color-foreground-muted)]">engaged</span>
          </div>
        </div>
        {/* The unit, and the CLAIM — BESIDE the legend, not crushed under it. The map is a contrast
            now, not raw activity, and this is the one place that has to say which. */}
        <span className="truncate text-[9px] leading-none text-[var(--color-foreground-muted)]">
          predicted BOLD · vs rest
        </span>
      </div>
      )}

      {/* ── The stimulus, in its own pane. It is the thing the cortex is responding to; it does not
             belong dumped on top of the cortex, dimming the object it explains. ── */}
      {/* GROUNDED ONLY. The transport, the word-by-word "playback" and the trace all exist to let you
          watch an encounter unfold — and a hook has no encounter to unfold. In INSTANT mode this whole
          pane is replaced by the readout, which reports the one thing that is actually true there. */}
      {!instant && (
      <div className="mt-2 flex h-[60px] items-stretch gap-2.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-2">
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
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[rgba(0,0,0,0.5)] text-[var(--color-cream-primary)]">
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
                      ? 'text-[var(--color-cream-primary)]'
                      : 'text-[var(--color-foreground-muted)] opacity-30'
                  }
                  style={reducedMotion ? undefined : { transition: `opacity 260ms ${EASE}, color 260ms ${EASE}` }}
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
      )}

      {/* ══ THE READOUT (INSTANT) ═══════════════════════════════════════════════════════════════
             The instrument, on the only substrate that is real here: the ten personas actually voted.
             Counts of real votes — no score, no invented benchmark, no threshold we cannot ground. ── */}
      {instant && readout && (
        <RoomReadoutPanel
          readout={readout}
          kindLabel={kindLabel}
          scale={scale}
          canRewrite={canRewrite}
          onRewrite={onRewrite}
          rewriteBusy={rewriteBusy}
          rewriteError={rewriteError}
          rewriteDelta={rewriteDelta}
        />
      )}

      {/* The verdict — the room's voice reading the scan. The ONE serif voice-moment on the card,
          and the finding everything above is evidence for. It used to be clipped off the bottom.
          It leads on size and weight because it is the answer; everything above it is the working. */}
      <p className="mt-2.5 font-serif text-[15.5px] leading-[1.35] tracking-[-0.01em] text-foreground">
        {instant ? instantVerdict(readout, stopRatio) : verdictFor(stopRatio, response, mode)}
      </p>

      {/* Foot — the honesty line. It must survive every redesign. */}
      <p className="mt-2 text-[9.5px] leading-none text-[var(--color-foreground-muted)]">
        {mode === 'grounded'
          ? 'modeled from your audience’s real retention · not a brain measurement'
          : readout
            ? 'the figure is anatomy · the numbers are your room’s real votes'
            : 'a modeled response · a sketch, not a measurement'}
      </p>

      <p className="sr-only">
        {mode === 'grounded' ? 'Modeled' : 'Simulated'} cortical response to “{conceptText}”:{' '}
        {SPOKEN_NETWORKS.map((n) => `${n.label} ${bandWord(bold[n.id], n.words)}`).join(', ')}.
      </p>
    </div>
  );
}

/**
 * ── THE READOUT ───────────────────────────────────────────────────────────────────────────────────
 * The structure is Sapient's (a productised TRIBE): a named line, a real number, and a chip that
 * says what it MEANS — because a number with no sense of "good" is not useful, which is exactly what
 * a cortex map is. What is NOT theirs is the substrate. They score modeled cortical networks against
 * a benchmark; we count actual votes, so there is no benchmark to fabricate and no threshold to
 * defend. "3 of 3 core fans stopped, 0 of 3 new viewers did" is a finding no brain map can give you,
 * and it says what to DO.
 *
 * Every row here is a count. Nothing is scored, nothing is seeded, nothing is scaled.
 */
/**
 * The qualifier chip — the reference's "Moderate" / "Runs High" / "Low". DESCRIPTIVE, never
 * evaluative against an invented bar: it names the SHAPE of a real vote. Coral only where the news
 * is bad, which is the app's one accent doing exactly what it does everywhere else.
 */
function Chip({ chip, weak, small = false }: { chip: string; weak: boolean; small?: boolean }) {
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-[2px] ${small ? 'text-[8.5px]' : 'text-[9.5px]'} leading-none`}
      style={{
        color: weak ? 'var(--color-accent)' : 'var(--sage, #8aa383)',
        background: weak ? 'rgba(217,119,87,0.10)' : 'rgba(138,163,131,0.10)',
      }}
    >
      {chip}
    </span>
  );
}

function RoomReadoutPanel({
  readout,
  kindLabel,
  scale,
  canRewrite = false,
  onRewrite,
  rewriteBusy = false,
  rewriteError,
  rewriteDelta,
}: {
  readout: RoomReadout;
  kindLabel?: string;
  scale?: { pct: number; rank: number; of: number } | null;
  canRewrite?: boolean;
  onRewrite?: (lever: string) => void | Promise<void>;
  rewriteBusy?: boolean;
  rewriteError?: string | null;
  rewriteDelta?: { prior: { stop: number; total: number }; next: { stop: number; total: number } } | null;
}) {
  const { hold, metrics, objection, divergence } = readout;
  /**
   * The CTA shows only when it is HONEST and ACTIONABLE, on the same three gates the Population
   * weak-spot uses (so the two levers can never disagree): the skill is text-seedable, there is a
   * REAL bouncer quote to steer by, and there is somebody left to win back. The lever IS the
   * objection the readout is already showing — the card cannot recommend one thing and act on
   * another.
   */
  const lever = objection?.quote ?? '';
  const showRewrite = canRewrite && !!onRewrite && lever.length > 0 && hold.total > 0 && hold.pct < 90;
  const left = hold.total - hold.stopped;
  /**
   * ⚠️ SCOPE THE CLAIM. A script's ten personas voted on its OPENING BEAT — the schema says so in as
   * many words, and its per-beat retentionMarker is explicitly "prose, never a numeric score". So
   * there is no honest per-beat read, and "6 of 10 stopped" on a script is a verdict on the first
   * three seconds, not on the script. The card says which. (The beat-stepper this card was going to
   * grow — "beat 3 loses them" — is dead for exactly this reason: nobody measured beat 3.)
   */
  const scoped = kindLabel?.toLowerCase() === 'script';
  return (
    <div
      className="mt-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-2.5 py-2"
      data-testid="brain-readout"
    >
      {/* ── THE HERO METRIC. The reference leads with a DISPLAY NUMBER, and it is why their readout
             reads as a product and the segment table this replaced read as a debug dump. Same move:
             a named metric, a figure you can read across the room, and a word for what it means. ── */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-[var(--color-foreground-secondary)]">
          Attention hold{scoped ? ' · opening beat' : ''}
        </span>
        <Chip {...holdChip(hold.pct)} />
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="font-serif text-[30px] leading-[1.05] tracking-[-0.02em] tabular-nums text-foreground">
          {hold.pct}
          <span className="text-[16px] text-[var(--color-foreground-muted)]">%</span>
        </span>
        <span className="text-[10.5px] text-[var(--color-foreground-muted)]">
          {hold.stopped} of {hold.total} stopped
        </span>
      </div>

      {/* THE SCALE — "where this one lands against your other four". Not an invented benchmark: it
          is the batch the composer just generated, each with its own real stop-count. */}
      {scale && (
        <div className="mt-2" data-testid="brain-readout-scale">
          <div className="relative">
            <span className="flex h-[3px] overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]" />
            <span
              aria-hidden
              className="absolute -top-[3px] h-[9px] w-[2px] rounded-full bg-[var(--color-cream-primary)]"
              style={{ left: `${scale.pct}%`, transform: 'translateX(-1px)' }}
            />
          </div>
          <div className="mt-[5px] flex items-baseline justify-between">
            <span className="text-[9px] leading-none text-[var(--color-foreground-muted)]">
              worst of {scale.of}
            </span>
            <span className="text-[9px] leading-none text-[var(--color-foreground-secondary)]">
              #{scale.rank} of your {scale.of}
            </span>
            <span className="text-[9px] leading-none text-[var(--color-foreground-muted)]">
              best of {scale.of}
            </span>
          </div>
        </div>
      )}

      {/* ── THE TWO AUDIENCES. The single headline hides the only thing a creator needs to decide:
             is this a retention play or a growth play? Core hold and Reach are different numbers and
             they always were. Absent (not zeroed) when the audience has too few of that slot. ── */}
      {(metrics.core || metrics.reach) && (
        <div className="mt-2 grid grid-cols-2 gap-2" data-testid="brain-readout-metrics">
          {[metrics.core, metrics.reach].filter(Boolean).map((m) => (
            <div key={m!.label} className="rounded-[8px] bg-[rgba(255,255,255,0.03)] px-2 py-1">
              <div className="flex items-baseline justify-between gap-1">
                <span className="truncate text-[10px] text-[var(--color-foreground-muted)]">{m!.label}</span>
                <Chip {...m!} small />
              </div>
              <span className="mt-0.5 block font-serif text-[19px] leading-[1.15] tabular-nums text-foreground">
                {m!.pct}
                <span className="text-[11px] text-[var(--color-foreground-muted)]">%</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* The receipt. A real scroller, verbatim — never a paraphrase, and absent when nobody spoke. */}
      {objection && (
        <p className="mt-2 border-t border-[var(--color-border)] pt-1.5 text-[10.5px] leading-[1.45] text-[var(--color-foreground-muted)]">
          <span className="text-[var(--color-foreground-secondary)]">{objection.who}</span> scrolled:
          “{objection.quote}”
        </p>
      )}

      {/* ── THE COUNTERFACTUAL. Sapient's "with the recommended cut → 74%" is a PREDICTION of what a
             change would do. Ours re-runs the skill steered by that exact quote and reports what it
             ACTUALLY did — the honest version of the same move, and the only one this codebase is
             allowed to make. The prior is snapshotted at tap-time by the Room, so the before/after
             is real and frozen; it is never a projection. ── */}
      {showRewrite && !rewriteDelta && (
        <button
          type="button"
          onClick={() => void onRewrite?.(lever)}
          disabled={rewriteBusy}
          data-testid="brain-rewrite"
          className="mt-2 w-full rounded-[8px] border border-[var(--color-border)] px-2 py-[7px] text-left text-[10.5px] text-[var(--color-accent)] transition-colors hover:border-[var(--color-border-hover)] disabled:opacity-60"
        >
          {rewriteBusy
            ? 'Rewriting, and re-running the room…'
            : `Rewrite it against ${objection?.who ?? 'them'} — win back the ${left} who scrolled →`}
        </button>
      )}

      {/* The payoff. Gated on the DELTA, not the button — a rewrite that wins the whole room leaves
          nobody to win back, which hides the CTA, and the result must still be shown. */}
      {rewriteDelta && (
        <p
          className="mt-2 border-t border-[var(--color-border)] pt-1.5 text-[10.5px] leading-[1.45] text-[var(--color-foreground-secondary)]"
          data-testid="brain-rewrite-delta"
        >
          {rewriteDelta.prior.stop}/{rewriteDelta.prior.total} → {rewriteDelta.next.stop}/
          {rewriteDelta.next.total} — you re-ran it against their own words.
        </p>
      )}

      {rewriteError && (
        <p className="mt-2 text-[10.5px] leading-[1.45] text-[var(--color-foreground-muted)]">
          {rewriteError}
        </p>
      )}

      <p className="sr-only">
        {hold.stopped} of {hold.total} stopped.
        {divergence
          ? ` ${divergence.held.label} held; ${divergence.lost.label} walked.`
          : ''}
      </p>
    </div>
  );
}

/**
 * The verdict, INSTANT. It reads the room's real split — and it is deliberately allowed to say
 * nothing interesting. The divergence line only fires when a segment genuinely held AND another
 * genuinely walked; a lukewarm room gets a lukewarm sentence, because the alternative is the failure
 * this card keeps repeating: a confident story told over a flat signal.
 */
function instantVerdict(readout: RoomReadout | null, stopRatio: number): string {
  if (!readout) {
    return stopRatio >= 0.6
      ? 'Most of the room stopped.'
      : 'Most of the room kept scrolling.';
  }
  const { hold, divergence } = readout;
  if (divergence) {
    // Say ONLY what the counts say. This sentence used to end "— you are writing for the people you
    // already have", which reads beautifully and was hardcoded to a core-held/new-lost story: on the
    // first real render it fired while holding NEW viewers and losing cross-niche, and cheerfully
    // told the creator the exact opposite of what their room had just done.
    const { held, lost } = divergence;
    return `It holds ${held.label.toLowerCase()} (${held.stopped}/${held.total}) and loses ${lost.label.toLowerCase()} (${lost.stopped}/${lost.total}).`;
  }
  if (hold.pct >= 70) return 'The room stops, and it stops together.';
  if (hold.pct <= 30) return 'The room walks, and it walks together.';
  return 'The room splits, and no one segment carries it.';
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
    // The SAME axis the map is painted on and the colorbar is scaled to — a contrast against rest.
    axis.push(axisOf(contrastBold(b)));
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
        style={{ left: `${u * 100}%`, ...(reducedMotion ? {} : { transition: `left 240ms ${EASE}` }) }}
      />
    </div>
  );
}

/**
 * The card's easing curve. ONE curve, everywhere.
 *
 * Every transition on this card used to be `linear` — the colorbar marker (260ms linear), the trace
 * playhead (200ms linear), the stimulus words. Linear motion is the single most reliable tell that
 * nobody designed the motion: nothing in the physical world starts and stops at a constant rate, so
 * the eye reads it as mechanical. This is a standard ease-out — quick to commit, slow to arrive.
 */
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

/**
 * THE DIVERGING AXIS, defined once: task-positive attention MINUS the default-mode system, both read
 * as contrasts against rest. The map is painted on it, the colorbar is scaled to it, the trace plots
 * it and the verdict reads it. One definition, or they drift apart and the card contradicts itself.
 */
function axisOf(response: Record<NetworkId, number>): number {
  return Math.max(-1, Math.min(1, response.dorsal_attention - response.default));
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
    // ⚠️ THE VIEWBOX MUST BE THE WELL'S OWN ASPECT (20/19). It was 400x300 — a 4:3 box inside a
    // near-square well — and with xMidYMid meet that LETTERBOXES: the head scaled to 364x273 and
    // floated in the middle band, so the cranial vault no longer sat where the specimen sat. The
    // skull and the brain were simply not registered to each other. That, plus a specimen grown to
    // FIT_RADIUS 1.15 which covered the vault, plus 5.5% cream under a blur, is why the head was
    // reported "missing" while the element mounted and painted the whole time. 400x380 = 20/19.
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 400 380"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      data-testid="brain-head-ghost"
    >
      {/* MEASURED on TRIBE: the head is a LARGE soft mass filling the whole well (557x607 of a
          558x608 frame) while the brain is only 340x242 INSIDE it — the head is ~2.5x the brain's
          height. That ratio is most of why theirs reads as "a brain in a person" and ours read as a
          lit object on black. So the head is drawn BIGGER THAN THE WELL and cropped by it, the way an
          anatomical plate crops — and the specimen backs off (FIT_RADIUS) to leave a cranium to sit
          inside. It must register as context in peripheral vision, never as an illustration. */}
      <defs>
        {/* Barely blurred. A sigma-9 cloud at 7.5% is not a silhouette, it is a smudge — and that is
            what shipped. On TRIBE's you can read the nose, the lips, the chin and the ear: it is a
            COHERENT, defined shape held at ~7% luminance. The quietness must come from the VALUE,
            not from destroying the edge. */}
        <filter id="head-soft" x="-8%" y="-8%" width="116%" height="116%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
      {/* A left-facing profile — crown, forehead, brow, nose, lips, chin, jaw, ear, neck — sized so
          the cranial VAULT encloses the specimen's measured bbox (x 88..313, y 104..275 in these
          viewBox units, with the canvas centring the brain at 200,190). The neck and shoulder run off
          the bottom edge, the way an anatomical plate crops. */}
      <path
        d="M206 62
           C 140 62, 92 96, 78 148
           C 70 178, 66 196, 58 212
           C 44 236, 30 248, 32 258
           C 34 266, 52 264, 60 268
           C 54 280, 56 292, 66 300
           C 74 308, 78 316, 92 322
           C 118 336, 152 344, 186 346
           C 200 356, 208 366, 210 380
           L 400 380
           C 400 300, 400 200, 396 168
           C 386 104, 300 62, 206 62 Z"
        fill="rgba(236, 231, 222, 0.07)"
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

/**
 * ⚠️ THE WELL'S ASPECT IS A HEIGHT BUDGET, NOT A TASTE.
 *
 * The card lives in a 516px box, and everything in it is stacked, so the well's height is whatever is
 * left after the chrome — and if it takes more, the VERDICT (the answer the whole card exists to
 * deliver) is silently clipped off the bottom. That is exactly what a square well did: measured 573px
 * of content in the 516px box, with the verdict cut in half.
 *
 * So the specimen was given every pixel that could be TAKEN FROM THE CHROME rather than invented:
 * the header row moved into the well's corners (which the colorbar had vacated), the stimulus pane
 * lost 12px, the margins were tightened. What is left is this ratio. It is MEASURED against the box
 * (see the fit check in the verification script) — if you change anything above it, re-measure, and do
 * not let it steal from the verdict.
 */
/**
 * The well's aspect, PER MODE — and the budget is real, not stylistic.
 *
 * GROUNDED: the specimen IS the instrument (the map is painted, it moves, you scrub it), so it keeps
 * the near-square well and the frame.
 *
 * INSTANT: the specimen is at rest — it is the credibility object, and the READOUT is the instrument.
 * So the figure yields. Measured: with the readout added, instant came to 569px of content in the
 * 516px box and clipped the verdict clean off the bottom (which is how the last redesign died too).
 * A 4:3 well is 273px instead of 346px, which brings the card to ~496 with real headroom — no
 * truncation, no silent cap on the segment rows, nothing hidden.
 */
const WELL_ASPECT = '20 / 19';
// 16:9. The specimen has now yielded three times (20/19 → 4:3 → 3:2 → 16:9), and each time for the
// same honest reason: in INSTANT it is the CREDIBILITY OBJECT, and the things the creator READS and
// ACTS ON are the metric, the scale and the button. The reference agrees — Sapient's brain is a
// small hero tile and the numbers dominate the layout. Measured: the readout + scale + CTA took the
// card to 523px, clipping the verdict AND the honesty line clean off the bottom.
const WELL_ASPECT_INSTANT = '16 / 9';

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
function verdictFor(stopRatio: number, response: Record<NetworkId, number>, mode: SimMode): string {
  // Read off the CONTRAST, not raw BOLD. Raw, the default-mode system idles at 0.42 while attention
  // idles at 0.08 — so "is the DMN louder than attention?" was biased toward yes before the stimulus
  // had done anything at all. Against rest, the question is the one the card actually asks: which of
  // them has moved MORE than it normally sits at.
  const drifting = response.default > response.dorsal_attention;
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
