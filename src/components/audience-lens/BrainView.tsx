'use client';

/**
 * BrainView — "The brain": the Room's THIRD scale (and the dock's landing view), a
 * TRIBE-style simulated neural read of the room's reaction (Meta's trimodal brain
 * encoder — fMRI response predicted from the stimulus — is the visual reference).
 * A stylized lateral cortex with parcel heat, four stimulus-locked network traces
 * (attention / emotion / memory / drift) looping over an 8s encounter (Onset →
 * Hold → Decision), and a serif verdict in the room's voice.
 *
 * Honesty spine (binding): this is an EXPLICITLY-LABELED simulation sketch — the
 * micro-label reads "simulated", the foot reads "a sketch, not a measurement". It
 * is NOT wired to the engine; the only real signal in it is the focus's stop ratio,
 * which shapes the envelopes (a strong read holds attention; a weak one lets the
 * default network take over). It never fabricates a per-persona claim.
 *
 * Dosage (LOCKED): coral is a SIGNAL, never paint — here it marks ONLY the drift
 * (the default-mode bloom = where attention dies + the drift trace). All engaged
 * activity glows CREAM (the liveness ramp: one hue, opacity-scaled — sequential
 * magnitude per the chart rules; identity always carried by a text label).
 *
 * Deterministic — seeded mulberry32 off the focus id (SSR-hydration safe: the
 * first frame is a pure function of props; the clock starts client-side only).
 * Reduced motion freezes the clock mid-Hold (no interval, no pulses).
 */

import { useEffect, useMemo, useState } from 'react';

export interface BrainViewProps {
  /** The focus's real stop-count — the ONE genuine signal shaping the sim. */
  stopCount: number;
  total: number;
  /** The concept under read (sr-only summary grounding). */
  conceptText: string;
  /** Seeds the deterministic sim (focus id, else the concept text). */
  seedKey: string;
  reducedMotion?: boolean;
}

// ── Sim clock ────────────────────────────────────────────────────────────────
/** One simulated encounter with the concept (Onset → Hold → Decision), looped. */
const PERIOD_S = 8;
const TICK_MS = 125;
const TICK_S = TICK_MS / 1000;
/** Trace window: 88 samples × 125ms = 11s (one full encounter + change). */
const TRACE_N = 88;
/** Reduced-motion freeze point — mid-Hold, after the onset spike (the characteristic frame). */
const REDUCED_T = 5.0;

/** mulberry32 — seeded PRNG (same one the swarm/constellation use; copied per
 *  client-module convention — lens-derive does not export it). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** djb2 — string → uint32 seed. */
function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const gauss = (x: number, c: number, w: number) => Math.exp(-((x - c) * (x - c)) / w);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ── Networks ─────────────────────────────────────────────────────────────────
type NetKey = 'attention' | 'emotion' | 'memory' | 'drift';
const NETS: { key: NetKey; label: string; words: [string, string, string, string] }[] = [
  { key: 'attention', label: 'Attention', words: ['quiet', 'gathering', 'holding', 'locked in'] },
  { key: 'emotion', label: 'Emotion', words: ['flat', 'warming', 'charged', 'surging'] },
  { key: 'memory', label: 'Memory', words: ['faint', 'tracing', 'encoding', 'sticking'] },
  { key: 'drift', label: 'Drift', words: ['low', 'creeping', 'rising', 'taking over'] },
];

const bandWord = (v: number, words: [string, string, string, string]) =>
  v < 0.25 ? words[0] : v < 0.5 ? words[1] : v < 0.72 ? words[2] : words[3];

// ── Cortical parcels ─────────────────────────────────────────────────────────
// Stylized lateral left hemisphere (frontal pole at LEFT), viewBox 400×250.
// `mix` weights blend the four network envelopes into the parcel's own signal.
// group 'drift' = the ONE coral bloom (default-mode / mind-wandering); the rest
// glow cream (engagement). Positions are illustrative anatomy, not a claim.
interface Region {
  id: string;
  name: string;
  note: string;
  cx: number;
  cy: number;
  r: number;
  group: 'engage' | 'drift';
  base: number;
  mix: Partial<Record<NetKey, number>>;
}

const REGIONS: Region[] = [
  { id: 'dlpfc', name: 'Prefrontal cortex', note: 'attention control', cx: 100, cy: 86, r: 11, group: 'engage', base: 0.10, mix: { attention: 0.65, memory: 0.10 } },
  { id: 'acc', name: 'Anterior cingulate', note: 'the curiosity gap', cx: 148, cy: 66, r: 8, group: 'engage', base: 0.10, mix: { attention: 0.45, emotion: 0.25 } },
  { id: 'motor', name: 'Motor cortex', note: 'the urge to act', cx: 196, cy: 48, r: 7, group: 'engage', base: 0.08, mix: { attention: 0.25, emotion: 0.15 } },
  { id: 'precuneus', name: 'Default network', note: 'mind-wandering', cx: 254, cy: 60, r: 10, group: 'drift', base: 0.08, mix: { drift: 0.75 } },
  { id: 'tpj', name: 'Temporoparietal junction', note: 'the social read', cx: 278, cy: 104, r: 9, group: 'engage', base: 0.12, mix: { emotion: 0.30, memory: 0.20, attention: 0.15 } },
  { id: 'v1', name: 'Visual cortex', note: 'imagery', cx: 326, cy: 132, r: 10, group: 'engage', base: 0.18, mix: { attention: 0.40, emotion: 0.10 } },
  { id: 'wernicke', name: "Wernicke's area", note: 'language decode', cx: 232, cy: 130, r: 9, group: 'engage', base: 0.12, mix: { attention: 0.35, memory: 0.25 } },
  { id: 'a1', name: 'Auditory cortex', note: 'voice & cadence', cx: 188, cy: 134, r: 8, group: 'engage', base: 0.14, mix: { attention: 0.45, emotion: 0.15 } },
  { id: 'broca', name: "Broca's area", note: 'inner speech', cx: 106, cy: 136, r: 8, group: 'engage', base: 0.12, mix: { attention: 0.30, memory: 0.15 } },
  { id: 'vmpfc', name: 'Ventromedial prefrontal', note: 'value & relevance', cx: 64, cy: 126, r: 9, group: 'engage', base: 0.12, mix: { emotion: 0.35, attention: 0.20 } },
  { id: 'nacc', name: 'Nucleus accumbens', note: 'reward anticipation', cx: 86, cy: 154, r: 7, group: 'engage', base: 0.10, mix: { emotion: 0.35, memory: 0.20, attention: 0.15 } },
  { id: 'amygdala', name: 'Amygdala', note: 'salience & arousal', cx: 146, cy: 158, r: 7, group: 'engage', base: 0.10, mix: { emotion: 0.55, attention: 0.15 } },
  { id: 'hippocampus', name: 'Hippocampus', note: 'memory encoding', cx: 184, cy: 164, r: 8, group: 'engage', base: 0.08, mix: { memory: 0.65 } },
  { id: 'fusiform', name: 'Fusiform gyrus', note: 'the face read', cx: 250, cy: 166, r: 8, group: 'engage', base: 0.10, mix: { emotion: 0.30, attention: 0.20 } },
];

const REGION_WORDS: [string, string, string, string] = ['quiet', 'murmur', 'strong', 'lit up'];

/** The verdict in the room's voice — banded on the ONE real signal (stop ratio). */
function verdictFor(stopRatio: number): string {
  if (stopRatio >= 0.7)
    return 'Salience spikes at the onset and the reward loop stays lit — the room keeps watching.';
  if (stopRatio >= 0.4)
    return 'The onset lands, then attention wavers into the decision — the middle does the losing.';
  return 'Early salience, then the default network takes over — minds wander before the turn.';
}

// ── The sim — every value is a pure function of (seed, stopRatio, t) ──────────
interface SimFns {
  nets: (t: number) => Record<NetKey, number>;
  region: (rg: Region, t: number, nets: Record<NetKey, number>) => number;
}

function buildSim(seedKey: string, stopRatio: number): SimFns {
  const rng = mulberry32(hashSeed(seedKey));
  // Per-network wobble phases/frequencies — the seeded "this concept" texture.
  const ph = (Object.fromEntries(
    (['attention', 'emotion', 'memory', 'drift'] as NetKey[]).map((k) => [
      k,
      { p1: rng() * Math.PI * 2, p2: rng() * Math.PI * 2, w1: 0.8 + rng() * 0.5, w2: 2.0 + rng() * 0.7 },
    ]),
  ) as Record<NetKey, { p1: number; p2: number; w1: number; w2: number }>);
  const regionPhase = new Map(REGIONS.map((rg) => [rg.id, { p: rng() * Math.PI * 2, w: 0.9 + rng() * 0.9 }]));
  const sR = stopRatio;

  const wobble = (k: NetKey, t: number) =>
    0.05 * Math.sin(t * ph[k].w1 + ph[k].p1) + 0.035 * Math.sin(t * ph[k].w2 + ph[k].p2);

  const nets = (t: number): Record<NetKey, number> => {
    const p = (((t % PERIOD_S) + PERIOD_S) % PERIOD_S) / PERIOD_S; // 0..1 through the encounter
    // Amplitudes are tuned to keep headroom: the ONSET SPIKE must visibly clear the hold
    // plateau (a saturated trace reads as a flat line and says nothing).
    const attention = clamp01(
      0.10 +
        0.58 * gauss(p, 0.09, 0.005) + // the onset spike — the hook hits
        (0.16 + 0.26 * sR) * smooth(0.10, 0.30, p) * (1 - (1 - sR) * 0.8 * smooth(0.55, 0.95, p)) + // the hold, sagging if weak
        (sR >= 0.55 ? 0.20 * sR * gauss(p, 0.86, 0.008) : -0.06 * smooth(0.78, 0.95, p)) + // the decision kick or drop
        wobble('attention', t),
    );
    const emotion = clamp01(
      0.08 +
        (0.18 + 0.34 * sR) * smooth(0.16, 0.60, p) +
        0.34 * sR * gauss(p, 0.84, 0.008) + // the payoff bump
        wobble('emotion', t),
    );
    const memory = clamp01(
      0.06 +
        0.16 * gauss(p, 0.12, 0.008) + // onset novelty
        0.58 * sR * smooth(0.45, 0.88, p) + // encoding only if it held them
        wobble('memory', t),
    );
    const drift = clamp01(
      0.05 +
        0.16 * (1 - sR) * smooth(0.20, 0.50, p) +
        0.62 * (1 - sR) * smooth(0.50, 0.95, p) + // the default network takes over
        wobble('drift', t),
    );
    return { attention, emotion, memory, drift };
  };

  const region = (rg: Region, t: number, n: Record<NetKey, number>): number => {
    const jitter = regionPhase.get(rg.id)!;
    let v = rg.base + 0.06 * Math.sin(t * jitter.w + jitter.p);
    for (const [k, w] of Object.entries(rg.mix) as [NetKey, number][]) v += n[k] * w;
    return clamp01(v);
  };

  return { nets, region };
}

// ── Component ────────────────────────────────────────────────────────────────
export function BrainView({ stopCount, total, conceptText, seedKey, reducedMotion = false }: BrainViewProps) {
  const stopRatio = total > 0 ? clamp01(stopCount / total) : 0.6;
  const sim = useMemo(() => buildSim(seedKey, stopRatio), [seedKey, stopRatio]);

  // The sim clock — starts client-side only (the t=0 / frozen first frame is a pure
  // function of props, so SSR + hydration agree byte-for-byte).
  const [now, setNow] = useState(reducedMotion ? REDUCED_T : 0);
  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setNow((n) => n + TICK_S), TICK_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const netNow = sim.nets(now);
  const regionValues = REGIONS.map((rg) => ({ rg, v: sim.region(rg, now, netNow) }));

  // Hover readout, falling back to the hottest parcel. "Hottest" is scored over a ~1s window
  // rather than the instant value: a single-frame score makes two near-tied parcels swap the
  // readout row every tick. Pure (a function of `now`) — no render-phase ref mutation.
  const [hovered, setHovered] = useState<string | null>(null);
  const hottestId = useMemo(() => {
    const window = [0, 0.25, 0.5, 0.75, 1].map((d) => {
      const t = now - d;
      return { t, n: sim.nets(t) };
    });
    let bestId = REGIONS[0]!.id;
    let best = -1;
    for (const rg of REGIONS) {
      const score = window.reduce((sum, w) => sum + sim.region(rg, w.t, w.n), 0);
      if (score > best) {
        best = score;
        bestId = rg.id;
      }
    }
    return bestId;
  }, [sim, now]);
  const readout = regionValues.find((x) => x.rg.id === (hovered ?? hottestId))!;

  // Stimulus-locked traces — each network's last 11s, sampled straight off the pure
  // sim (no buffers to drift out of sync).
  const traces = useMemo(() => {
    const out = {} as Record<NetKey, string>;
    const samples: Record<NetKey, number>[] = [];
    for (let i = 0; i < TRACE_N; i++) samples.push(sim.nets(now - (TRACE_N - 1 - i) * TICK_S));
    // A slight gamma lifts the hold plateau into the middle of the band (a linear map left every
    // trace hugging the baseline). Monotonic — the ordering between networks is untouched.
    for (const { key } of NETS) {
      out[key] = samples
        .map((s, i) => `${((i / (TRACE_N - 1)) * 100).toFixed(2)},${(26 - Math.pow(s[key], 0.8) * 23).toFixed(2)}`)
        .join(' ');
    }
    return out;
  }, [sim, now]);

  // The encounter playhead (Onset 0–15% · Hold · Decision 78–100%). On the loop wrap the
  // playhead must JUMP back, not glide right-to-left, so the transition is suppressed for the
  // first tick of a new encounter (a pure test on the phase — no cross-render ref).
  const p = (((now % PERIOD_S) + PERIOD_S) % PERIOD_S) / PERIOD_S;
  const phase = p < 0.15 ? 'onset' : p < 0.78 ? 'hold' : 'decision';
  const wrapped = p < TICK_S / PERIOD_S;

  const heatColor = (g: Region['group']) => (g === 'drift' ? 'var(--color-accent)' : 'var(--color-foreground)');
  const fade = reducedMotion ? undefined : { transition: 'opacity 150ms linear' };

  return (
    <div className="flex flex-col" data-testid="brain-view">
      {/* Micro-label — the honesty label + the stimulus clock. */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.11em] text-[var(--color-foreground-muted)]">
          Neural read · simulated
        </p>
        <p className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--color-foreground-muted)] tabular-nums">
          t+{(p * PERIOD_S).toFixed(1)}s
          <span
            aria-hidden
            className={'h-[5px] w-[5px] rounded-full bg-accent ' + (reducedMotion ? '' : 'animate-pulse')}
          />
        </p>
      </div>

      {/* The cortex — cream parcel heat; the ONE coral bloom is the default network
          (drift). Structure is matte hairline; heat is layered flat fills (no glow). */}
      <svg
        viewBox="34 22 322 200"
        role="img"
        aria-label="Simulated cortical activity map — cream marks engagement, coral marks drift"
        className="mt-1 h-auto w-full max-w-[300px] self-center"
      >
        {/* Brainstem + cerebellum + cortex silhouette. */}
        <path
          d="M 248 192 C 245 202 243 210 242 218 L 259 218 C 261 208 264 200 268 194 Z"
          fill="rgba(255,255,255,0.02)"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1"
        />
        <ellipse
          cx="296"
          cy="192"
          rx="32"
          ry="20"
          transform="rotate(-10 296 192)"
          fill="rgba(255,255,255,0.018)"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1"
        />
        <path
          d="M 48 146
             C 36 128 38 96 58 72
             C 76 50 112 34 152 30
             C 196 26 240 32 276 48
             C 306 62 330 88 340 118
             C 346 136 344 152 334 162
             C 326 170 314 173 302 172
             C 284 182 262 190 238 192
             C 206 198 168 198 138 190
             C 112 184 92 172 84 158
             C 72 152 56 152 48 146 Z"
          fill="rgba(255,255,255,0.025)"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.4"
        />
        {/* Gyri — decorative folds, recessive. The sylvian fissure sits a hair stronger. */}
        <g fill="none" stroke="rgba(255,255,255,0.075)" strokeWidth="1" strokeLinecap="round">
          <path d="M 84 96 C 116 78 156 74 194 86" />
          <path d="M 214 58 C 246 62 274 76 296 98" />
          <path d="M 300 122 C 312 132 318 144 314 156" />
          <path d="M 152 176 C 188 168 224 166 256 172" />
        </g>
        <path
          d="M 96 148 C 140 138 192 138 240 148"
          fill="none"
          stroke="rgba(255,255,255,0.11)"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* Parcel heat — three layered flat fills per parcel (matte falloff, no blur). The ramp
            is sequential (one hue, opacity-scaled): a cold parcel still reads as a faint node so
            the map never looks broken; a hot one carries real weight. */}
        {regionValues.map(({ rg, v }) => {
          const core = (0.10 + Math.pow(v, 1.15) * 0.82) * (rg.group === 'drift' ? 1 : 0.92);
          const color = heatColor(rg.group);
          return (
            <g key={rg.id}>
              <circle cx={rg.cx} cy={rg.cy} r={rg.r * 2.4} fill={color} opacity={core * 0.13} style={fade} />
              <circle cx={rg.cx} cy={rg.cy} r={rg.r * 1.5} fill={color} opacity={core * 0.30} style={fade} />
              <circle cx={rg.cx} cy={rg.cy} r={rg.r} fill={color} opacity={core} style={fade} />
              {/* Hit target — native tooltip + drives the readout row. */}
              <circle
                cx={rg.cx}
                cy={rg.cy}
                r={rg.r + 9}
                fill="transparent"
                onMouseEnter={() => setHovered(rg.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <title>{`${rg.name} — ${rg.note}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>

      {/* Parcel readout — the hovered (else hottest) region, stable-height. */}
      <div className="mt-1.5 flex h-6 items-center gap-2">
        <span
          aria-hidden
          className="h-[6px] w-[6px] shrink-0 rounded-full"
          style={{ background: heatColor(readout.rg.group), opacity: 0.5 + readout.v * 0.5, ...fade }}
        />
        <span className="text-[12px] font-medium text-[var(--color-foreground)]">{readout.rg.name}</span>
        <span className="min-w-0 truncate text-[11.5px] text-[var(--color-foreground-muted)]">
          — {readout.rg.note}
        </span>
        <span className="ml-auto h-[3px] w-[44px] shrink-0 overflow-hidden rounded-[2px] bg-white/[0.08]">
          <span
            className="block h-full rounded-[2px]"
            style={{
              width: `${Math.round(readout.v * 100)}%`,
              background: heatColor(readout.rg.group),
              opacity: 0.85,
              ...(reducedMotion ? {} : { transition: 'width 150ms linear' }),
            }}
          />
        </span>
        <span className="w-[52px] shrink-0 text-right font-mono text-[10px] text-[var(--color-foreground-secondary)]">
          {bandWord(readout.v, REGION_WORDS)}
        </span>
      </div>

      {/* The verdict — the room's voice reading the scan. */}
      <p className="mt-2.5 font-serif text-[15.5px] leading-snug tracking-[-0.005em] text-foreground">
        {verdictFor(stopRatio)}
      </p>

      {/* The encounter timeline — Onset · Hold · Decision, playhead looping. */}
      <div className="mt-3.5 border-t border-[var(--color-border)] pt-3">
        <div className="relative h-4">
          {(
            [
              ['onset', 'Onset', 'left-0'],
              ['hold', 'Hold', 'left-[46%]'],
              ['decision', 'Decision', 'right-0'],
            ] as const
          ).map(([key, label, pos]) => (
            <span
              key={key}
              className={
                `absolute top-0 font-mono text-[9.5px] uppercase tracking-[0.11em] ${pos} ` +
                (phase === key
                  ? 'text-[var(--color-foreground-secondary)]'
                  : 'text-[var(--color-foreground-muted)] opacity-60')
              }
            >
              {label}
            </span>
          ))}
        </div>
        <div className="relative mt-1 h-[2px] rounded bg-white/[0.07]">
          <span
            aria-hidden
            className="absolute top-1/2 h-[6px] w-[6px] -translate-y-1/2 rounded-full bg-[var(--color-foreground)] opacity-80"
            style={{
              left: `calc(${(p * 100).toFixed(2)}% - 3px)`,
              transition: reducedMotion || wrapped ? 'none' : 'left 130ms linear',
            }}
          />
        </div>
      </div>

      {/* Network traces — small multiples (one series per row: the row label carries
          identity, never color; coral is reserved for the drift signal). */}
      <div className="mt-2.5 flex flex-col">
        {NETS.map(({ key, label, words }) => {
          const isDrift = key === 'drift';
          const v = netNow[key];
          const word = bandWord(v, words);
          return (
            <div key={key} className="flex items-center gap-2.5">
              <span className="w-[62px] shrink-0 font-mono text-[9.5px] uppercase tracking-[0.11em] text-[var(--color-foreground-muted)]">
                {label}
              </span>
              <svg className="h-[26px] min-w-0 flex-1" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden>
                <line x1="0" y1="26.5" x2="100" y2="26.5" stroke="rgba(255,255,255,0.06)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <polyline
                  points={traces[key]}
                  fill="none"
                  stroke={isDrift ? 'var(--color-accent)' : 'var(--color-foreground)'}
                  strokeOpacity={isDrift ? 0.8 : 0.62}
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <span
                className={
                  'w-[68px] shrink-0 text-right font-mono text-[10px] ' +
                  (isDrift && v >= 0.38
                    ? 'text-[var(--color-accent-text)]'
                    : 'text-[var(--color-foreground-secondary)]')
                }
              >
                {word}
              </span>
            </div>
          );
        })}
      </div>

      {/* Foot — the honesty line. */}
      <p className="mt-3 text-center font-mono text-[10px] tracking-wide text-[var(--color-foreground-muted)]">
        modeled cortical response · a sketch, not a measurement
      </p>

      <p className="sr-only">
        Simulated neural read of &ldquo;{conceptText}&rdquo;: attention {bandWord(netNow.attention, NETS[0]!.words)},
        emotion {bandWord(netNow.emotion, NETS[1]!.words)}, memory {bandWord(netNow.memory, NETS[2]!.words)}, drift{' '}
        {bandWord(netNow.drift, NETS[3]!.words)}.
      </p>
    </div>
  );
}
