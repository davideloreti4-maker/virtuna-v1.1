/**
 * video-test-card.ts — the pure mapper PredictionResult → the CRAFT-teardown card (TEST-01).
 *
 * "The editor's cut." The /test flow runs the full /api/analyze Max video pipeline UNTOUCHED
 * and hands its result here to be shaped into a static, technical read of how well-MADE the
 * video is (see VideoTestCardBlockSchema for the reworked contract). This module owns the
 * mapping ONLY — engine types in, block type out, nothing route/thread/network.
 *
 * Reworked 2026-07-21 (the Test/Simulation split — docs/HANDOFF-2026-07-21-test-card-rework.md):
 *   - Reception is GONE from this card. No band/fraction/reactions (who stopped), no goNoGo,
 *     no verdict sentence, no retention curve — anything that draws a curve over time or splits
 *     an audience belongs to the separate Simulation surface. This mapper reads only the CRAFT
 *     slice of the result (Apollo dims, the filmstrip segments, the counterfactual fixes).
 *   - The card CARRIES a number again — `craftScore`, the mean of the craft-subset dimensions
 *     (hook / clarity / substance / credibility), retention EXCLUDED. It is a technical grade,
 *     NOT the /analyze overall_score (which blends reception). Nullable: Apollo can be down.
 *
 * Grounding is a ROUTE concern (it is async/network): this mapper emits every fix with
 * `proof: null`, and the route attaches a real corpus HookProof to the top 1–2 fixes via
 * `deriveFixGroundingQueries` (below) + executeCorpusSearch. Honest absence otherwise.
 */

import type {
  ApolloDimension,
  ApolloRewrite,
  CounterfactualSuggestionItem,
  HeatmapPayload,
  VerbatimPayload,
} from "@/lib/engine/types";
import type { VideoTestCardBlock } from "@/lib/tools/blocks";
import type { TrustTier } from "@/lib/audience/resolve-tier";
import { resolveKeyframeUrl, type KeyframeSegmentLike } from "@/components/board/_kit/keyframe";

/**
 * The narrow CRAFT slice of a video PredictionResult this mapper reads. A full PredictionResult
 * is structurally assignable, and so is the object the /test route assembles from the persisted
 * analysis_results row (apollo lives in variants.apollo; heatmap/counterfactuals/verbatim are
 * first-class columns). Reception fields (persona_simulation_results, weighted_curve, dropoff)
 * are DELIBERATELY absent — they are Simulation's, not Test's.
 */
export interface VideoTestSource {
  apollo_reasoning?: {
    dimensions?: ApolloDimension[] | null;
    rewrites?: ApolloRewrite[] | null;
  } | null;
  heatmap?: HeatmapPayload | null;
  counterfactuals?: { suggestions?: CounterfactualSuggestionItem[] | null } | null;
  verbatim?: VerbatimPayload | null;
}

export interface VideoTestCardOptions {
  /** The row id — powers the "Simulate it →" door (→ /analyze/[id] until the Sim surface ships). */
  analysisId: string;
  /** The active audience's display name (resolved by the route; "General" default). */
  audienceName: string;
  /** The run-level trust tier (resolveTier of the active audience). */
  tier: TrustTier;
  /**
   * Signed keyframe URLs by segment idx (route-resolved; ephemeral). Absent in unit tests → every
   * frame is null and the renderer shows a play-tile. Never fabricated: a missing frame stays null.
   */
  frames?: Record<number, string>;
}

/** The craft-subset dimensions — retention EXCLUDED (retention is reception → Simulation). */
const CRAFT_DIMS = ["hook", "clarity", "substance", "credibility"] as const;
type CraftDimName = (typeof CRAFT_DIMS)[number];

/** How many fixes the card shows (the card is tall; the top notes carry the leverage). */
const MAX_FIXES = 3;
/** How many working / not-working ledger items (the glance, not the full remediation). */
const MAX_LEDGER = 3;

/** "hook" → "Hook" (driver + fix labels). */
function cap(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** seconds → "M:SS" clock label. */
function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** Trim a driver's evidence to a card-legible ledger line (no mid-word cut, no trailing period). */
function clip(text: string, cap = 64): string {
  const t = text.trim().replace(/\.$/, "");
  if (t.length <= cap) return t;
  const cut = t.slice(0, cap);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 24 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** The video's own opening line (spoken words, else on-screen text) — for the hook fix diagnosis. */
function verbatimHook(verbatim: VerbatimPayload | null | undefined): string | null {
  const hook = verbatim?.hook;
  const text = (hook?.spoken_words ?? hook?.on_screen_text ?? "").trim();
  return text.length > 0 ? text.slice(0, 200) : null;
}

/** signal_anchor → the named craft lever shown on the fix (mockup: Momentum / Stakes / CTA). */
const LEVER_BY_ANCHOR: Record<string, string> = {
  retention: "Momentum",
  hook: "Stakes",
  cta: "CTA",
};

/**
 * The NEUTRAL psychological "why" per fix — a general, well-established mechanism keyed to the
 * fix's signal, NOT a fabricated claim about this specific video (so it is styled neutral, not as
 * a coral warning). null when we have no principled mechanism for the anchor (the fix stands on
 * its diagnosis + move alone). Curiosity-gap / Zeigarnik open-loops / peak-end — textbook, honest.
 */
const WHY_BY_ANCHOR: Record<string, string> = {
  hook:
    "A low-stakes open is a cheap skip — nothing is at risk, so there's little reason to stay. Naming a concrete stake widens the curiosity gap.",
  retention:
    "Attention holds on open loops. When a beat resolves nothing and opens nothing, the mind is free to leave — a pattern interrupt reopens the loop.",
  cta:
    "The end of a watch is the moment a viewer remembers most. An explicit ask, made while attention is still high, turns that peak into an action.",
};

/** The counterfactual fixes this card renders — filtered to `type:'fix'`, capped, order preserved. */
function selectFixSuggestions(source: VideoTestSource): CounterfactualSuggestionItem[] {
  const all = source.counterfactuals?.suggestions ?? [];
  return all.filter((s) => s.type === "fix").slice(0, MAX_FIXES);
}

// ── Apollo-derived fixes (the fallback when the pipeline emits NO counterfactuals) ──────────────
// The analyze pipeline stopped generating counterfactuals (Plan 02 R9), so on real runs the fix
// source above is empty and the card lost its two signature sections. The Apollo craft read is
// always present and carries a per-dimension `evidence` (a REAL, video-specific diagnosis) + a
// `lever`. So a weak/mid craft dim IS a director's fix: the video-specific read is its evidence;
// the title/lever/why are the neutral craft frame (honest general mechanism, never a fabricated
// claim about this video — mirrors WHY_BY_ANCHOR). Retention is a craft FIX (the mid-video dip)
// even though it is excluded from the craft SCORE (reception), matching the old counterfactual set.

/** Dims eligible to become a director's fix, in priority order (the improvable craft levers). */
const FIX_DIMS = ["hook", "retention", "substance", "credibility", "clarity"] as const;

/** dim → the named craft lever shown on the fix (extends LEVER_BY_ANCHOR to the craft dims). */
const LEVER_BY_DIM: Record<string, string> = {
  hook: "Stakes",
  retention: "Momentum",
  substance: "Payoff",
  credibility: "Proof",
  clarity: "Clarity",
};

/** dim → the neutral craft MOVE (a general directive; the video-specific read is the dim evidence). */
const FIX_TITLE_BY_DIM: Record<string, string> = {
  hook: "Sharpen the open",
  retention: "Hold the middle",
  substance: "Deepen the take",
  credibility: "Anchor a proof point",
  clarity: "Tighten the read",
};

/** dim → the neutral psychological "why" (textbook mechanism, keyed to the dim; null → stands on its
 *  evidence + move alone). Reuses the WHY_BY_ANCHOR lines where they already say it well. */
const WHY_BY_DIM: Record<string, string> = {
  hook: WHY_BY_ANCHOR.hook!,
  retention: WHY_BY_ANCHOR.retention!,
  substance:
    "A familiar take earns a nod, not a send. One non-obvious angle is what makes a viewer feel they learned something worth passing on.",
  clarity:
    "Every extra beat a viewer spends decoding is a beat they can spend leaving. The fewer the reads, the longer the hold.",
};

/** The weak/mid craft dims → the fix source, weakest first, capped. Empty when Apollo is strong all
 *  round (nothing to fix — the card then shows no fixes, honestly, rather than inventing a weakness). */
function apolloFixDims(source: VideoTestSource): ApolloDimension[] {
  const dims = source.apollo_reasoning?.dimensions ?? [];
  return FIX_DIMS.map((n) => dims.find((d) => d.name === n))
    .filter((d): d is ApolloDimension => Boolean(d) && d!.band !== "strong")
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_FIXES);
}

/** The segment at the attention curve's minimum (the MEASURED dip) — the weak beat when there is no
 *  labelled 'stall' segment and no counterfactual. Maps the curve-index min → its segment
 *  proportionally (curve resolution may differ from the segment count). undefined when no curve. */
function curveDipSegment(heatmap: HeatmapPayload | null | undefined): HeatmapPayload["segments"][number] | undefined {
  const curve = heatmap?.weighted_curve;
  const segs = heatmap?.segments ?? [];
  if (!Array.isArray(curve) || curve.length === 0 || segs.length === 0) return undefined;
  let minI = 0;
  for (let i = 1; i < curve.length; i++) if ((curve[i] ?? 1) < (curve[minI] ?? 1)) minI = i;
  const segI = Math.min(segs.length - 1, Math.round((minI / (curve.length - 1 || 1)) * (segs.length - 1)));
  return segs[segI];
}

/** The craft-subset dimensions present in the result, in the fixed craft order (retention dropped). */
function craftDimensions(source: VideoTestSource): ApolloDimension[] {
  const dims = source.apollo_reasoning?.dimensions ?? [];
  return CRAFT_DIMS.map((name) => dims.find((d) => d.name === name)).filter(
    (d): d is ApolloDimension => Boolean(d),
  );
}

/** Bridge heatmap segments to the resolveKeyframeUrl shape. */
function asKeyframeSegments(segments: HeatmapPayload["segments"] | undefined): KeyframeSegmentLike[] {
  return (segments ?? []).map((s, i) => ({
    idx: s.idx ?? i,
    t_start: s.t_start,
    t_end: s.t_end,
    keyframe_uri: s.keyframe_uri,
  }));
}

/**
 * The per-fix corpus queries the ROUTE runs (aligned by index to the fixes this mapper emits, so
 * `queries[i]` grounds `fixes[i]`). Structural axis on purpose: a craft fix wants the SHAPE of a
 * proven move (a stronger hook, a tighter cut) across niches, not a same-subject match. null when
 * a fix has nothing searchable. The route grounds only the top 1–2 — this returns them all in order.
 */
export function deriveFixGroundingQueries(
  source: VideoTestSource,
): Array<{ query: string; axis: "topical" | "structural" } | null> {
  const rewrites = source.apollo_reasoning?.rewrites ?? [];
  const cf = selectFixSuggestions(source);
  if (cf.length > 0) {
    return cf.map((fix) => {
      const anchor = fix.signal_anchor;
      // A hook fix grounds best on a concrete hook line (the sharpened rewrite); others on the headline.
      const query = anchor === "hook" ? rewrites[0]?.variant ?? fix.headline : fix.headline;
      const q = query.trim();
      return q ? { query: q, axis: "structural" as const } : null;
    });
  }
  // Apollo fallback — aligned to `apolloFixDims` order so `queries[i]` still grounds `fixes[i]`.
  return apolloFixDims(source).map((dim) => {
    const query = dim.name === "hook" ? rewrites[0]?.variant ?? FIX_TITLE_BY_DIM.hook! : FIX_TITLE_BY_DIM[dim.name] ?? dim.name;
    const q = query.trim();
    return q ? { query: q, axis: "structural" as const } : null;
  });
}

/**
 * Map a completed video PredictionResult → the craft-teardown card, or null when the run carries
 * NO craft material at all (no Apollo dims, no filmstrip segments, no fixes) — the caller then
 * degrades to the link-out rather than emitting an empty card. Fixes emit with `proof: null`; the
 * route attaches real corpus proofs to the top fixes.
 */
export function predictionResultToVideoTestCard(
  source: VideoTestSource,
  opts: VideoTestCardOptions,
): VideoTestCardBlock | null {
  const dims = craftDimensions(source);
  const segments = source.heatmap?.segments ?? [];
  const fixSuggestions = selectFixSuggestions(source);

  // Nothing to show — no craft grade, no filmstrip, no notes → let the caller degrade.
  if (dims.length === 0 && segments.length === 0 && fixSuggestions.length === 0) return null;

  const frames = opts.frames ?? {};
  const keyframeSegments = asKeyframeSegments(segments);

  // ── Header — craft score + drivers (retention excluded) ──
  const craftScore =
    dims.length > 0
      ? Math.round(dims.reduce((sum, d) => sum + d.score, 0) / dims.length)
      : null;
  const drivers = [...dims]
    .sort((a, b) => b.score - a.score)
    .map((d) => ({ name: cap(d.name as CraftDimName), score: d.score, band: d.band }));

  // Fixes come from the counterfactuals when the pipeline produced them; else fall back to the
  // Apollo craft read (the pipeline stopped emitting counterfactuals — Plan 02 R9).
  const apolloFixes = fixSuggestions.length === 0 ? apolloFixDims(source) : [];
  const useApollo = apolloFixes.length > 0 && fixSuggestions.length === 0;

  // ── Filmstrip — the weak beat is the 'stall' segment, else the retention fix's segment, else the
  //    MEASURED attention-curve dip (so the frame story survives with no counterfactual) ──
  const retentionFix = fixSuggestions.find((f) => f.signal_anchor === "retention");
  const stallSeg = segments.find((s) => (s.label ?? "").toLowerCase().includes("stall"));
  const weakSeg =
    stallSeg ??
    (retentionFix
      ? segments.find(
          (s) =>
            retentionFix.timestamp_ms / 1000 >= s.t_start &&
            retentionFix.timestamp_ms / 1000 < s.t_end,
        )
      : undefined) ??
    (useApollo ? curveDipSegment(source.heatmap) : undefined);
  const filmstrip = segments.map((s) => ({
    idx: s.idx,
    label: cap(s.label ?? `Segment ${s.idx + 1}`),
    atMs: Math.round(s.t_start * 1000),
    mark: (s.is_hook_zone ? "asset" : weakSeg && s.idx === weakSeg.idx ? "weak" : null) as
      | "asset"
      | "weak"
      | null,
    keyframeUrl: frames[s.idx] ?? s.keyframe_uri ?? null,
  }));
  const dropSeconds = weakSeg?.t_start ?? (retentionFix ? retentionFix.timestamp_ms / 1000 : null);
  const dropLabel = dropSeconds != null ? `${fmtClock(dropSeconds)} drop` : null;
  const lastSeg = segments[segments.length - 1];
  const durationLabel = lastSeg ? fmtClock(lastSeg.t_end) : null;

  // ── Working / not-working ledger ──
  const reinforcements = (source.counterfactuals?.suggestions ?? [])
    .filter((s) => s.type === "reinforcement")
    .map((s) => s.headline.trim())
    .filter(Boolean);
  const strongLines = dims
    .filter((d) => d.band === "strong")
    .sort((a, b) => b.score - a.score)
    .map((d) => `${cap(d.name)} — ${clip(d.evidence)}`);
  const working: string[] = [];
  for (const line of [...reinforcements, ...strongLines]) {
    if (working.length >= MAX_LEDGER) break;
    if (!working.includes(line)) working.push(line);
  }
  // ── The director's fixes + the not-working ledger ──
  // Counterfactual path (kept for when the stage returns) vs Apollo-craft fallback (the live path).
  const rewrites = source.apollo_reasoning?.rewrites ?? [];
  const hookLine = verbatimHook(source.verbatim);
  // The measured dip drives the retention fix's frame when we're on the Apollo path.
  const dipMs = weakSeg ? Math.round(weakSeg.t_start * 1000) : null;

  const notWorking = useApollo
    ? apolloFixes.map((d) => ({
        text: `${cap(d.name)} — ${clip(d.evidence)}`,
        atMs: d.name === "retention" ? dipMs : null,
      }))
    : fixSuggestions.map((f) => ({
        text: f.headline.trim(),
        atMs: f.timestamp_ms > 0 ? f.timestamp_ms : null,
      }));

  const fixes = useApollo
    ? apolloFixes.map((d) => {
        const isHook = d.name === "hook";
        const atMs = d.name === "retention" ? dipMs : null; // Apollo dims aren't time-coded (bar the dip)
        const diagnosis =
          isHook && hookLine ? `Your open — “${hookLine}”. ${clip(d.evidence, 180)}` : clip(d.evidence, 200);
        return {
          title: FIX_TITLE_BY_DIM[d.name] ?? `Strengthen ${cap(d.name)}`,
          lever: LEVER_BY_DIM[d.name] ?? null,
          atMs,
          keyframeUrl: atMs != null ? resolveKeyframeUrl(frames, keyframeSegments, atMs) : null,
          diagnosis,
          why: WHY_BY_DIM[d.name] ?? null,
          move: isHook ? rewrites[0]?.variant?.trim() ?? null : null,
          proof: null, // the route grounds the top 1–2 fixes; honest absence otherwise
        };
      })
    : fixSuggestions.map((fix) => {
        const anchor = fix.signal_anchor;
        const isHook = anchor === "hook";
        const diagnosis =
          isHook && hookLine ? `Your open — “${hookLine}”. ${fix.detail.trim()}` : fix.detail.trim();
        return {
          title: fix.headline.trim(),
          lever: LEVER_BY_ANCHOR[anchor] ?? null,
          atMs: fix.timestamp_ms > 0 ? fix.timestamp_ms : null,
          keyframeUrl:
            fix.timestamp_ms > 0 ? resolveKeyframeUrl(frames, keyframeSegments, fix.timestamp_ms) : null,
          diagnosis,
          why: WHY_BY_ANCHOR[anchor] ?? null,
          move: isHook ? rewrites[0]?.variant?.trim() ?? null : null,
          proof: null, // the route grounds the top 1–2 fixes; honest absence otherwise
        };
      });

  return {
    type: "video-test-card",
    props: {
      craftScore,
      drivers,
      filmstrip,
      dropLabel,
      durationLabel,
      working,
      notWorking,
      fixes,
      audienceName: opts.audienceName,
      analysisId: opts.analysisId,
      model: "sim1-max",
      tier: opts.tier,
    },
  };
}
