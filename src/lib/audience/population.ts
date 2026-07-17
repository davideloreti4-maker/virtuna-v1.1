/**
 * Audience Sim v2 — Stage 2 population math (the honest 1,000-individual reaction).
 *
 * SSOT: docs/DESIGN-2026-07-15-audience-simulation-v2.md §4.2/§4.4. This is the PURE,
 * deterministic core that turns the frozen 10-persona `AudienceSignature` into a real
 * distribution over N sampled individuals — NOT a denser re-render of the 10's rollup
 * (that is the honest-lean `PopulationSwarm`/`lens-derive` v1 this SUPERSEDES) and NOT
 * N model calls.
 *
 *   expandSignature(signature, {N, seed})  --pure math-->  N individuals (centroid + jitter)
 *   pStop(individual, contentVector)        --pure math-->  P(stop) + auditable "why"
 *   reactPopulation(signature, vector, ...)  --pure O(N)-->  aggregate + per-segment split
 *
 * The content-side input (`ContentVector`) comes from ONE LLM call at test-time
 * (`characterize-content.ts`) — the ONLY model cost. Everything here is arithmetic, so
 * it is fully unit-testable with no network and byte-identical across runs (seeded RNG,
 * no Math.random / Date.now — the engine-determinism contract, mirrors `lens-derive`).
 *
 * Honesty spine: the axes are NAMED and scored (not an opaque embedding), so every stop
 * carries a reason (`why`). The 10 signature slots ARE the segments — each individual is
 * a jittered variation on its slot's stored `reaction` axes. Provenance stays a caller
 * concern; this module reports a projection, never a measurement.
 *
 * The scoring constants are ported verbatim from the tuned spike
 * (`scripts/spike-persona-population.ts`, design §8.2). They are eyeball-fit to a handful
 * of hooks + LLM characterization noise — the feedback loop (design §7) is what fits them
 * to truth. Do NOT hand-tune further here.
 */

import type { AudienceSignature, SignaturePersona } from "./audience-types";
import { archetypeDisplayName } from "./archetype-names";

// ─── Content-side input (produced by characterize-content.ts, one LLM call) ───

/**
 * A content candidate scored into the SAME named axes the personas react on. `topics`
 * keys are `topic_vocab` tags; a persona's `reaction.interests` uses the same vocabulary,
 * so `interestMatch` is a content-weighted dot product over shared tags.
 */
export interface ContentVector {
  /** tag → how strongly the hook engages that topic (0..1). Keys ⊂ signature topic_vocab. */
  topics: Record<string, number>;
  /** How arresting the first ~2s are (0..1). */
  hookStrength: number;
  /** How novel / trend-forward vs familiar (0..1). */
  novelty: number;
  /** How much it over-promises / makes big claims (0..1). */
  hype: number;
  /** How slow the payoff is (0 = instant, 1 = long build). */
  slowness: number;
}

// ─── The sampled reactor ──────────────────────────────────────────────────────

/** One procedurally-sampled individual — a jittered variation on its segment's centroid. */
export interface PopulationIndividual {
  id: string;
  /** The segment (= signature persona archetype slug) this individual was sampled from. */
  archetype: string;
  interests: Record<string, number>;
  hookSensitivity: number;
  noveltyBias: number;
  skepticism: number;
  attentionSpan: number;
}

// ─── Aggregate output ─────────────────────────────────────────────────────────

/** One segment's real, content-sensitive reaction (the per-archetype breakdown). */
export interface SegmentReaction {
  /** Engine archetype slug — keys the swarm anchors + the legacy breakdown. */
  archetype: string;
  /** Creator-specific label (from `display_name`), falling back to the archetype label. */
  displayName: string;
  /** This segment's share of the audience (0..1). */
  share: number;
  /** Individuals sampled into this segment. */
  total: number;
  /** How many of them stopped. */
  stop: number;
  /** stop / total × 100. */
  stopPct: number;
}

/**
 * The honest population reaction — a projection over N sampled individuals, not a
 * measurement. `total`/`stop`/`scroll` are real per-individual counts (each individual
 * gets a binary verdict), so "847 of 1,000 kept watching" is a genuine distribution and
 * not the 10's weighted rollup at higher resolution.
 */
export interface PopulationAggregate {
  /** Individuals reacted (≈ N; may differ by ±segments from rounding shares). */
  total: number;
  /** Individuals who stopped (verdict = stop). */
  stop: number;
  /** Individuals who scrolled (total − stop). */
  scroll: number;
  /** stop / total × 100, rounded. */
  stopPct: number;
  /** Per-segment split, weightiest share first. */
  segments: SegmentReaction[];
  /** Dominant-reason tally among the stoppers (the auditable "why"), most-common first. */
  reasons: Array<{ reason: string; count: number }>;
}

// ─── Tunables (named; jitter is fixed pending per-segment spread data) ─────────

/** Default population size — matches the "Population · 1,000" surface. Reaction is O(N). */
export const DEFAULT_POPULATION_N = 1000;
/**
 * Default deterministic seed. Same signature + content + seed ⇒ byte-identical aggregate.
 * A constant (not derived from the audience) keeps the projection stable across renders.
 */
export const DEFAULT_POPULATION_SEED = 12345;
/**
 * Fixed within-segment jitter (σ). The spike scaled σ off a per-segment `spread` the LLM
 * emitted; the production signature does NOT store `spread` yet, so every segment gets the
 * same moderate spread. Honest v1 limit — a future generator field can restore per-segment
 * diversity. 0.14 ≈ the spike's σ at spread≈0.27 (0.08 + 0.22·spread).
 */
export const SEGMENT_SIGMA = 0.14;

// ─── Seeded RNG (reproducible; mulberry32 + Box–Muller — copied from the spike) ─

function rng(seed: number): () => number {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard-normal sample from a uniform generator (Box–Muller). */
function gauss(rand: () => number): number {
  const u = Math.max(1e-9, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

// ─── Guard: does this signature carry the v2 axes the population math needs? ──

/**
 * True when a signature can drive the population math: a non-empty `topic_vocab` AND at
 * least one persona with scored `reaction` axes. Legacy / General / preset signatures omit
 * the v2 fields → false, and the caller falls back to the honest-lean rollup swarm.
 */
export function signatureHasPopulationAxes(
  signature: AudienceSignature | null | undefined,
): boolean {
  if (!signature) return false;
  const { topic_vocab, personas } = signature.audience;
  return (
    Array.isArray(topic_vocab) &&
    topic_vocab.length > 0 &&
    personas.some((p) => p.reaction != null)
  );
}

// ─── (1) EXPANSION — pure math, the 10 segments → N individuals ───────────────

/**
 * Sample N individuals off the signature's persona segments (centroid + seeded jitter).
 * Each persona's `share` sets its individual count; personas WITHOUT `reaction` axes are
 * skipped (legacy/General never reach here — the caller guards with
 * `signatureHasPopulationAxes`). Deterministic in `seed`.
 */
export function expandSignature(
  signature: AudienceSignature,
  opts: { N?: number; seed?: number } = {},
): PopulationIndividual[] {
  const N = opts.N ?? DEFAULT_POPULATION_N;
  const seed = opts.seed ?? DEFAULT_POPULATION_SEED;
  const rand = rng(seed);
  const people: PopulationIndividual[] = [];

  signature.audience.personas.forEach((seg: SignaturePersona, si) => {
    const axes = seg.reaction;
    if (!axes) return; // no v2 axes on this slot → cannot sample it
    const count = Math.max(1, Math.round((seg.share || 0) * N));
    const jitter = (base: number) => clamp01(base + gauss(rand) * SEGMENT_SIGMA);
    for (let i = 0; i < count; i++) {
      const interests: Record<string, number> = {};
      for (const [k, v] of Object.entries(axes.interests || {})) interests[k] = jitter(v);
      people.push({
        id: `${seg.archetype}:${si}-${i}`,
        archetype: seg.archetype,
        interests,
        hookSensitivity: jitter(axes.hookSensitivity),
        noveltyBias: jitter(axes.noveltyBias),
        skepticism: jitter(axes.skepticism),
        attentionSpan: jitter(axes.attentionSpan),
      });
    }
  });

  return people;
}

// ─── (2) THE CHEAP SCORER — transparent logit, no LLM (design §8.2, tuned) ────

/**
 * P(stop) for one individual against one content vector, plus the dominant-reason "why".
 * TWO independent stop-drivers (either can carry a stop on its own):
 *   1. TOPICAL PULL — they care about the subject (`interestMatch`).
 *   2. HOOK PULL    — the opening is arresting AND they decide on the hook
 *      (`hookAppetite = 1 − attentionSpan`: scrollers live on the hook; substance-seekers don't).
 * Frictions: a hook below their bar, a novelty mismatch, hype (repels a DISENGAGED skeptic
 * only — an engaged one leans in to scrutinize), and slowness against short patience.
 * Constants are the tuned-spike values (design §8.2) — the feedback loop fits them, not us.
 */
export function pStop(
  p: PopulationIndividual,
  c: ContentVector,
): { p: number; why: string } {
  // interestMatch = affinity for the topics THIS content actually hits (content-weighted).
  let num = 0;
  let den = 0;
  for (const [t, w] of Object.entries(c.topics || {})) {
    num += w * (p.interests[t] ?? 0);
    den += w;
  }
  const interestMatch = den > 0 ? num / den : 0;

  const hookAppetite = clamp01(1 - p.attentionSpan);
  const hookPull = c.hookStrength * hookAppetite;

  const hookGap = Math.max(0, p.hookSensitivity - c.hookStrength);
  const noveltyMismatch = Math.abs(p.noveltyBias - c.novelty);
  const hypePenalty = p.skepticism * c.hype * (1 - interestMatch);
  const patiencePenalty = (1 - p.attentionSpan) * c.slowness;

  const logit =
    -0.9 + // TikTok default is to scroll — a strong negative prior
    2.6 * interestMatch +
    2.4 * hookPull -
    1.1 * hookGap -
    1.0 * noveltyMismatch -
    1.4 * hypePenalty -
    1.4 * patiencePenalty;
  const prob = 1 / (1 + Math.exp(-logit));

  const terms: [string, number][] = [
    ["interest", 2.6 * interestMatch],
    ["strong-hook", 2.4 * hookPull],
    ["weak-hook", -1.1 * hookGap],
    ["novelty-mismatch", -1.0 * noveltyMismatch],
    ["hype-vs-skeptic", -1.4 * hypePenalty],
    ["too-slow", -1.4 * patiencePenalty],
  ];
  terms.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return { p: prob, why: terms[0]![0] };
}

// ─── (3) REACT + AGGREGATE — pure O(N) roll-up over the sampled individuals ───

/**
 * Score a full population against one content vector → the honest aggregate distribution.
 * Each individual gets a BINARY verdict (`p > 0.5`) so the counts are a real distribution,
 * not an expected value. Segments come back weightiest-share first; `reasons` tallies the
 * dominant "why" among the stoppers.
 */
export function reactPopulation(
  signature: AudienceSignature,
  content: ContentVector,
  opts: { N?: number; seed?: number } = {},
): PopulationAggregate {
  const people = expandSignature(signature, opts);
  const labelByArchetype = new Map<string, { displayName: string; share: number }>(
    signature.audience.personas.map((p) => [
      p.archetype as string,
      { displayName: p.display_name ?? archetypeDisplayName(p.archetype), share: p.share || 0 },
    ]),
  );

  const perSeg = new Map<string, { stop: number; total: number }>();
  const reasons = new Map<string, number>();
  let stop = 0;

  for (const person of people) {
    const { p: prob, why } = pStop(person, content);
    const stopped = prob > 0.5;
    if (stopped) stop++;
    const seg = perSeg.get(person.archetype) ?? { stop: 0, total: 0 };
    seg.total++;
    if (stopped) {
      seg.stop++;
      reasons.set(why, (reasons.get(why) ?? 0) + 1);
    }
    perSeg.set(person.archetype, seg);
  }

  const total = people.length;
  const segments: SegmentReaction[] = [...perSeg.entries()]
    .map(([archetype, v]) => {
      const meta = labelByArchetype.get(archetype);
      return {
        archetype,
        displayName: meta?.displayName ?? archetype,
        share: meta?.share ?? v.total / (total || 1),
        total: v.total,
        stop: v.stop,
        stopPct: v.total > 0 ? Math.round((100 * v.stop) / v.total) : 0,
      };
    })
    .sort((a, b) => b.share - a.share);

  return {
    total,
    stop,
    scroll: total - stop,
    stopPct: total > 0 ? Math.round((100 * stop) / total) : 0,
    segments,
    reasons: [...reasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}
