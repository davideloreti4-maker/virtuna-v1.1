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
 * The surface is the point. Two earlier cuts drew this as a flat Voronoi parcel map and were both
 * rejected for looking fake: what makes a brain read as a brain is the FOLDING — gyral crowns
 * catching the light, sulci cutting shadow between them — not colour and not parcel density.
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
 * that lag for free. The header says so.
 *
 * Dosage (LOCKED) survives via real neuroscience: the map is DIVERGING on the task-positive /
 * default-mode axis — the anticorrelation is a genuine phenomenon — so engaged cortex glows
 * cream→sage and only the default-mode system (mind-wandering: the audience you are losing)
 * glows coral. Coral still means exactly what it means everywhere else in the app.
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

  // The hottest network right now — the readout's subject when nothing is hovered.
  const hottest = useMemo(() => {
    let best: NetworkId = NETWORK_IDS[0]!;
    for (const id of NETWORK_IDS) if (bold[id] > bold[best]) best = id;
    return best;
  }, [bold]);
  const readNet: NetworkId = hovered ?? hottest;
  const readVal = bold[readNet];

  const u = duration > 0 ? Math.min(1, t / duration) : 0;
  const words = useMemo(() => conceptText.trim().split(/\s+/).filter(Boolean), [conceptText]);
  // The text stimulus "plays": words land over the first 70% of the encounter, then it sits and
  // the response resolves (the HRF is still catching up — that is the point).
  const wordsShown = Math.max(1, Math.round(Math.min(1, u / 0.7) * words.length));

  const stimulusLabel = mode === 'grounded' ? 'their video' : 'your concept';

  return (
    <div className="flex flex-col" data-testid="brain-view" data-mode={mode}>
      {/* Header — what this is, and the scan clock. */}
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.11em] text-[var(--color-foreground-muted)]">
          Predicted cortical response · {mode === 'grounded' ? 'modeled' : 'simulated'}
        </p>
        <p className="shrink-0 font-mono text-[10px] text-[var(--color-foreground-muted)] tabular-nums">
          t={t.toFixed(1)}s · TR {TR_S}s
        </p>
      </div>

      {/* ── The cortex — the hero — with the stimulus playing on it. A brain map with no stimulus
             is decoration; a stimulus with a thumbnail-sized brain is a diagram. ── */}
      <div
        className="relative mt-2.5 w-full overflow-hidden rounded-[12px] border border-[var(--color-border)]"
        style={{ aspectRatio: '4 / 3' }}
        data-testid="brain-surface"
      >
        <CortexCanvas seed={seed} bold={bold} t={t} reducedMotion={reducedMotion} onHover={setHovered} />

        <div className="absolute left-2.5 top-2.5 w-[62px] overflow-hidden rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)]">
          {videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              muted
              playsInline
              preload="metadata"
              data-testid="brain-stimulus-video"
              className="h-full w-full object-cover"
              style={{ aspectRatio: '9 / 16' }}
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d)) setVideoDur(d);
              }}
              onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
          ) : (
            // The text stimulus — the concept landing word by word, on the same clock.
            <p
              className="flex h-full flex-wrap content-center gap-x-1 p-2 text-[10px] leading-[1.35]"
              style={{ aspectRatio: '9 / 16' }}
              data-testid="brain-stimulus-text"
            >
              {words.map((w, i) => (
                <span
                  key={`${w}-${i}`}
                  className={
                    i < wordsShown
                      ? 'text-[var(--color-foreground)]'
                      : 'text-[var(--color-foreground-muted)] opacity-30'
                  }
                  style={reducedMotion ? undefined : { transition: 'opacity 200ms linear, color 200ms linear' }}
                >
                  {w}
                </span>
              ))}
            </p>
          )}
          {!reducedMotion && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? 'Pause the stimulus' : 'Play the stimulus'}
              className="absolute inset-0 grid place-items-center transition-opacity hover:opacity-100"
              style={{ opacity: playing ? 0 : 1 }}
            >
              <span
                className="grid h-7 w-7 place-items-center rounded-full"
                style={{ background: 'rgba(0,0,0,0.55)' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden>
                  <path d="M8 5.5v13l11-6.5L8 5.5Z" fill="var(--color-foreground)" />
                </svg>
              </span>
            </button>
          )}
        </div>

        {/* The scale + unit, the way a real figure carries them. */}
        <p className="pointer-events-none absolute bottom-2 right-3 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-foreground-muted)]">
          left hemisphere · lateral
        </p>
      </div>

      {/* Colorbar — diverging on the real axis: default-mode ⇄ task-positive. */}
      <div className="mt-2.5 flex items-center gap-2">
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-accent-text)]">
          drifting
        </span>
        <span className="flex h-[5px] min-w-0 flex-1 overflow-hidden rounded-[3px]">
          {Array.from({ length: 44 }, (_, i) => (
            // −1 = full default-mode … 0 = baseline gray … +1 = full task-positive.
            <span key={i} className="h-full flex-1" style={{ background: barFill((i / 43) * 2 - 1) }} />
          ))}
        </span>
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-[#a6bfa1]">
          engaged
        </span>
      </div>
      <p className="mt-1 text-center font-mono text-[9px] tracking-wide text-[var(--color-foreground-muted)]">
        predicted BOLD · response trails {stimulusLabel} by ~{HRF_PEAK_S}s (haemodynamic lag)
      </p>

      {/* Readout — the network under the cursor, else the one that is loudest right now. */}
      <div className="mt-3 flex h-6 items-center gap-2 border-t border-[var(--color-border)] pt-3">
        <span
          aria-hidden
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ background: netFill(readNet, Math.max(0.6, readVal)) }}
        />
        <span className="text-[12px] font-medium text-[var(--color-foreground)]">
          {NETWORK_META[readNet].label}
        </span>
        <span className="min-w-0 truncate text-[11.5px] text-[var(--color-foreground-muted)]">
          — {NETWORK_META[readNet].note}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[10px] text-[var(--color-foreground-secondary)] tabular-nums">
          {readVal.toFixed(2)}
        </span>
      </div>

      {/* The four networks the room actually speaks about. */}
      <div className="mt-2 flex flex-col gap-[3px]">
        {SPOKEN_NETWORKS.map(({ id, label, words: bandWords }) => {
          const v = bold[id];
          const isDefault = NETWORK_POLARITY[id] < 0;
          return (
            <div key={id} className="flex items-center gap-2.5">
              <span className="w-[62px] shrink-0 font-mono text-[9.5px] uppercase tracking-[0.11em] text-[var(--color-foreground-muted)]">
                {label}
              </span>
              <span className="h-[4px] min-w-0 flex-1 overflow-hidden rounded-[2px] bg-white/[0.06]">
                <span
                  className="block h-full rounded-[2px]"
                  style={{
                    width: `${Math.round(v * 100)}%`,
                    background: isDefault ? 'var(--color-accent)' : '#a6bfa1',
                    opacity: 0.8,
                    ...(reducedMotion ? {} : { transition: 'width 260ms linear' }),
                  }}
                />
              </span>
              <span
                className={
                  'w-[68px] shrink-0 text-right font-mono text-[10px] ' +
                  (isDefault && v >= 0.45
                    ? 'text-[var(--color-accent-text)]'
                    : 'text-[var(--color-foreground-secondary)]')
                }
              >
                {bandWord(v, bandWords)}
              </span>
            </div>
          );
        })}
      </div>

      {/* The verdict — the room's voice reading the scan. */}
      <p className="mt-3 font-serif text-[15px] leading-snug tracking-[-0.005em] text-foreground">
        {verdictFor(stopRatio, bold, mode)}
      </p>

      {/* Foot — the honesty line. It must survive every redesign. */}
      <p className="mt-2.5 text-center font-mono text-[9.5px] tracking-wide text-[var(--color-foreground-muted)]">
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
