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
 * ── WHAT THE MAP CLAIMS ────────────────────────────────────────────────────────────────────────
 * The surface is painted with a CONTRAST AGAINST REST, not with raw predicted BOLD — a difference
 * between two conditions, which is what an fMRI figure has always shown. The colorbar says
 * `vs rest`, because the card must claim exactly what it draws.
 *
 * ⚠️ IT IS NOT THRESHOLDED, AND THAT IS THE 2026-07-14 REBUILD. Every vertex is painted, always,
 * from one continuous diverging ramp. The previous seven rounds kept a cream anatomical base and
 * only coloured cortex whose |value| cleared ACTIVATION_THRESHOLD, on the theory that "painting
 * every parcel is what makes a generated map look like stained glass instead of an fMRI". Measured
 * on the actual render, almost nothing ever cleared it: the specimen came back cream-white with a
 * single orange smudge, which is precisely the "only one color?" the owner rejected four rounds
 * running. The reference (thesapientcompany.com/intelligence) paints its whole cortex, continuously,
 * and reads as a scan. See cortex-colormap.ts — the ramp's ten stops were measured off its pixels.
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
 * ── THE ACCENT DOSAGE, and how the specimen escapes it ─────────────────────────────────────────
 * The map is DIVERGING on the task-positive / default-mode axis — the anticorrelation is a genuine
 * phenomenon — so a warm cortex means the room is engaged and a cold one means it is drifting.
 *
 * It IS a hot/cold colormap, and we refused it for five rounds on the LOCKED near-zero accent-dosage
 * rule (docs/DESIGN-SYSTEM.md), substituting a muted sage/coral axis. That was the design system
 * talking over the reference, and it cost four rejections. OWNER OVERRIDE (2026-07-14): "just copy
 * them." The rule is not actually violated: dosage governs CHROME — the surfaces the UI is built
 * from — and the cortex is a rendered specimen inside a frame, no more bound by it than a
 * photograph would be. The app around this card is still charcoal, cream and terracotta.
 *
 * Deterministic: seeded off the focus id; the first frame is a pure function of props (SSR-safe),
 * the clock only starts client-side. Reduced motion holds the response at the stimulus midpoint.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { NETWORK_META } from '@/lib/brain/cortex-field';
import { cssRamp, rampAt, valueToRamp } from '@/lib/brain/cortex-colormap';
import {
  NETWORK_IDS,
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
import { modeledSignals, type BrainSignal } from '@/lib/brain/brain-signals';
import { SignalGrid } from './SignalGrid';

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

  /**
   * Sapient's "nine breakdown signals" grid — nine MODELED brain signals mapped 1:1 from our seven
   * networks, each graded in its own direction (see `brain-signals.ts`). The room's REAL-vote findings
   * (Core hold, Reach) are NOT in this grid — Sapient's is all brain signals, and the votes carry their
   * own weight elsewhere on the card (the SPLITS chip, the segment splits, the divergence line).
   */
  const signals = useMemo<BrainSignal[]>(() => modeledSignals(drive, duration), [drive, duration]);

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
        {/* ⚠️ THERE IS NO HEAD HERE. It was hand-authored in SVG beziers and REJECTED THREE TIMES
               ("a potato", "doesn't look real at all"), and each rewrite produced a different potato.
               The argument for it was that a lit 3D object on black "reads as a floating artifact
               rather than anatomy" — and the reference settles that empirically: it shows the
               specimen on a PLAIN background, no head, no skull, no silhouette, and reads as more
               anatomical than ours ever did with one. A bad head is worse than no head.
               DO NOT AUTHOR A FOURTH. */}

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
            // THE SPECIMEN PAINTS IN BOTH MODES AGAIN. It was benched at RESTING_BOLD because the
            // simulated drive was seeded off hash(seedKey) — so its regional pattern was arbitrary,
            // and painting it was a lie. The fix was to delete the hash (cortex-sim), NOT to delete
            // the map: the response is now a pure function of the room's REAL stop-ratio, convolved
            // with the canonical HRF. Same room → same brain. A hook IS a single event, and the
            // haemodynamic response to one event is physiology, not an invention.
            bold={bold}
            t={t}
            reducedMotion={reducedMotion}
            onHover={setHovered}
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
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] leading-none text-[var(--color-cream-primary)]">
                {NETWORK_META[hovered].label}
              </span>
              <span className="font-mono text-[10px] leading-none text-[var(--color-foreground-muted)] tabular-nums">
                Δ{response[hovered].toFixed(2)}
              </span>
            </>
          ) : (
            <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] leading-none text-[var(--color-foreground-muted)]">
              Predicted cortex
            </span>
          )}
        </div>

        {/* Top-right — the scan clock. */}
        <p className="pointer-events-none absolute right-3 top-3 font-mono text-[9.5px] uppercase tracking-[0.08em] leading-none text-[var(--color-foreground-muted)] tabular-nums">
          t {t.toFixed(1)}s · TR {TR_S}s
        </p>

        {/* Bottom — the lag claim, inside the frame. Load-bearing: the HRF is real, the brain visibly
            trails the stimulus because of it, and the figure says so out loud. */}
        <p className="pointer-events-none absolute bottom-2.5 left-3 font-mono text-[8.5px] uppercase tracking-[0.1em] leading-none text-[var(--color-foreground-muted)]">
          trails {stimulusLabel} by ~{HRF_PEAK_S}s · haemodynamic lag
        </p>
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
          {/* ⚠️ THE POLES SAY WHAT THE COLOUR MEANS, NOT WHAT IT IMPLIES. They read "drifting" and
              "engaged" while the map was an unsigned magnitude with the default-mode system flipped
              to the cold pole by hand. The map is the signed contrast now — cold is simply "this
              system is running BELOW its own resting level", and on an engaged brain that is exactly
              what the DMN does. Labelling that patch "drifting" would be precisely backwards.
              The engaged/drifting reading is the VERDICT's job, and it still says it, in words. */}
          <div className="mt-[5px] flex items-baseline justify-between">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] leading-none text-[var(--color-foreground-muted)]">below rest</span>
            <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] leading-none text-[var(--color-foreground-muted)]">above rest</span>
          </div>
        </div>
        {/* The unit, and the CLAIM — BESIDE the legend, not crushed under it. The map is a contrast
            now, not raw activity, and this is the one place that has to say which. */}
        <span className="truncate font-mono text-[8.5px] uppercase tracking-[0.1em] leading-none text-[var(--color-foreground-muted)]">
          predicted BOLD · vs rest
        </span>
      </div>

      {/* ── The stimulus, in its own pane. It is the thing the cortex is responding to; it does not
             belong dumped on top of the cortex, dimming the object it explains. ── */}
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

      {/* ══ THE READOUT (INSTANT) ═══════════════════════════════════════════════════════════════
             The instrument, on the only substrate that is real here: the ten personas actually voted.
             Counts of real votes — no score, no invented benchmark, no threshold we cannot ground. ── */}
      {readout && (
        <RoomReadoutPanel
          readout={readout}
          kindLabel={kindLabel}
          scale={scale}
          canRewrite={canRewrite}
          onRewrite={onRewrite}
          rewriteBusy={rewriteBusy}
          rewriteError={rewriteError}
          rewriteDelta={rewriteDelta}
          signals={signals}
        />
      )}

      {/* The verdict — the room's voice reading the scan. The ONE serif voice-moment on the card,
          and the finding everything above is evidence for. It used to be clipped off the bottom.
          It leads on size and weight because it is the answer; everything above it is the working. */}
      <p className="mt-2.5 font-serif text-[15.5px] leading-[1.35] tracking-[-0.01em] text-foreground">
        {instant ? instantVerdict(readout, stopRatio) : verdictFor(stopRatio, response, mode)}
      </p>

      {/* Foot — the honesty line. It must survive every redesign. Mono caps, like the reference's
          "NOT MEASURED WATCH-TIME" clarifier under every claim (GAP-4): the disclaimer earns its
          credibility by being as prominent as the claim, not by hiding in lower-case fine print. */}
      <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.09em] leading-[1.4] text-[var(--color-foreground-muted)]">
        {mode === 'grounded'
          ? 'modeled from your audience’s real retention · not a brain measurement'
          : 'a modeled response from your room’s real votes · not a brain measurement'}
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
      className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-[2px] font-mono uppercase tracking-[0.06em] ${small ? 'text-[8px]' : 'text-[9px]'} leading-none`}
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
  signals = [],
}: {
  readout: RoomReadout;
  kindLabel?: string;
  scale?: { pct: number; rank: number; of: number } | null;
  canRewrite?: boolean;
  onRewrite?: (lever: string) => void | Promise<void>;
  rewriteBusy?: boolean;
  rewriteError?: string | null;
  rewriteDelta?: { prior: { stop: number; total: number }; next: { stop: number; total: number } } | null;
  signals?: BrainSignal[];
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
        <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-[var(--color-foreground-secondary)]">
          Attention hold{scoped ? ' · opening beat' : ''}
        </span>
        <Chip {...holdChip(hold.pct)} />
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="font-serif text-[30px] leading-[1.05] tracking-[-0.02em] tabular-nums text-foreground">
          {hold.pct}
          <span className="text-[16px] text-[var(--color-foreground-muted)]">%</span>
        </span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-[var(--color-foreground-muted)] tabular-nums">
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
            <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] leading-none text-[var(--color-foreground-muted)]">
              worst of {scale.of}
            </span>
            <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] leading-none text-[var(--color-foreground-secondary)]">
              #{scale.rank} of your {scale.of}
            </span>
            <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] leading-none text-[var(--color-foreground-muted)]">
              best of {scale.of}
            </span>
          </div>
        </div>
      )}

      {/* ── THE NINE BREAKDOWN SIGNALS (GAP-3.4). Sapient's centre block, filled honestly: seven
             MODELED network signals + the real-vote cells (Core hold, Reach — the two audiences, which
             carry the only thing a creator needs to decide, a retention vs a growth play). Core/Reach
             are absent, not zeroed, when the audience has too few of that slot. ── */}
      <SignalGrid signals={signals} title="The nine breakdown signals" />
      <p className="sr-only" data-testid="brain-readout-metrics">
        {metrics.core ? `Core hold ${metrics.core.pct}%. ` : ''}
        {metrics.reach ? `Reach ${metrics.reach.pct}%.` : ''}
      </p>

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

        {/* The trace rides the SAME hot/cold axis the map and the colorbar do. It was sage/coral
            while the specimen went red/yellow — an instrument disagreeing with its own map. */}
        <path d={area} clipPath="url(#trace-up)" fill={css(TRACE_ENGAGED)} fillOpacity="0.13" />
        <path d={area} clipPath="url(#trace-down)" fill={css(TRACE_DRIFTING)} fillOpacity="0.13" />

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


// ⚠️ THE RESTING-CORTEX GREYS AND THE TWO POLES ARE GONE, with the base colour that needed them.
// GYRUS/SULCUS existed because the surface had an anatomical base that activation was composited
// over; TASK_*/DMN_* were the ends of two one-sided ramps growing out of it. The surface is now
// painted everywhere from ONE diverging ramp (CORTEX_RAMP), so there is no base and there are no
// poles — and, more to the point, no second copy of the map's colours to fall out of sync with it.
//
// The trace's two fills are literally the ends of that ramp, sampled, so the curve above the
// baseline is the colour the cortex takes when it is engaged and the curve below is the colour it
// takes when the room is drifting. Read from the ramp, never restated.
const TRACE_ENGAGED: RGB = rampAt(1);
const TRACE_DRIFTING: RGB = rampAt(0);

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
// ONE WELL, ONE SIZE — and it is BIG. The specimen yielded three times (20/19 → 4:3 → 3:2 → 16:9)
// to make room for the readout, and by 16:9 the brain was a grey thumbnail floating in an empty box:
// the exact "doesn't look real" the owner called out, side by side with the grounded card where the
// same specimen at 20/19 reads fine. The brain is the HERO of this card. The card is allowed to be
// tall instead — the Room's body scrolls in the drawer and renders at natural height in the Read
// (AmbientRoom), so the 516px "budget" was a self-imposed dev-page box, never a real constraint.
const WELL_ASPECT_INSTANT = WELL_ASPECT;

import type { RGB } from '@/lib/brain/cortex-colormap';
const css = ([r, g, b]: RGB) => `rgb(${r}, ${g}, ${b})`;

/**
 * A network's swatch — read straight off CORTEX_RAMP, which is what the surface is painted with.
 *
 * ⚠️ IT NEITHER THRESHOLDS NOR FLIPS POLARITY, for the same reason the surface no longer does. The
 * old one returned a flat resting grey until the value cleared ACTIVATION_THRESHOLD and then flipped
 * the default-mode system to the cold pole by hand. Both devices existed to prop up an UNSIGNED
 * contrast. The contrast is signed now, so the dot is simply the network's own value on the ramp:
 * warm = above its resting level, cold = below it. Same number, same ramp, same meaning as the
 * cortex it annotates — which is the entire job of a legend.
 */
function netFill(_net: NetworkId, v: number): string {
  return cssRamp(valueToRamp(v));
}

/**
 * The colorbar's swatch at a point on the diverging axis (−1 = fully below rest … +1 = fully above).
 *
 * The bar IS the ramp, laid out linearly — and it must be, because the MARKER's position is
 * `(axis + 1) / 2` of the bar's width (see axisPct). If the swatches were placed by any other
 * mapping, the marker would sit on a colour the cortex is not currently showing.
 */
function barFill(x: number): string {
  return cssRamp((x + 1) / 2);
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
