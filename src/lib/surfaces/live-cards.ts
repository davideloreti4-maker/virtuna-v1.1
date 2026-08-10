/**
 * live-cards — the REAL, Flash-simmed /start card view-models + the Seam-1 glance-face
 * adapter (docs/SURFACE-SEAM-SPEC.md §1). Replaces the hand-authored `mock-room.ts`
 * fixtures for the daily-ideas + outliers sections.
 *
 * The honesty spine (binding, mirrors `read-to-card-reaction.ts`): a card carries the REAL
 * per-audience Flash sim (`personas: {archetype,verdict,quote}` — the exact shape the ambient
 * Room already renders). The glance-tier face (`{tone,stop,lead}`) and the opened Room are
 * BOTH derived from those personas — never fabricated — so "7/10 would watch" on the tile
 * matches the Room's header when it opens. Video metadata (handle/caption/mult/views/cover)
 * is real `scraped_videos` data; nothing here is invented.
 *
 * Pure + deterministic (no wall-clock / PRNG) — SSR + engine-determinism-gate safe.
 */

import type { ReactionPersona, HookProof } from "@/lib/tools/blocks";
import type { Tone } from "@/lib/room-contract/types";
import type { AdaptConcept } from "@/lib/engine/remix/decode-types";

/** 118000 → "118K", 1_200_000 → "1.2M" (honest compaction; real scraped views).
 *  Moved here from outlier-reactions.ts (2026-08-08) so the v8 drop cards share it —
 *  pure + client-safe, same contract. */
export function compactViews(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

/**
 * A real outlier card for /start — a competitor/feed video simmed against the user's audience.
 * Video fields are real `scraped_videos` data; `personas` is the real Flash sim (Seam 1/2 both
 * derive from it). `light` is a presentation flag kept for the caption-fallback gradient when
 * a real `coverUrl` is absent.
 */
export interface LiveOutlierCard {
  contentId: string; // platform_video_id — stable card id
  handle: string;
  caption: string;
  mult: string; // "1.8x" outlier multiplier
  views: string; // "118K"
  coverUrl?: string; // real video cover (shown when present; gradient+caption fallback otherwise)
  personas: ReactionPersona[]; // the real per-audience Flash reaction (10 archetypes)
}

/** A real daily-idea card — a generated concept carrying its own Flash sim (S3′ personas). */
export interface LiveIdeaCard {
  contentId: string;
  type: "Carousel" | "Reel";
  title: string;
  personas: ReactionPersona[];
  /**
   * GROUNDING (§11f) — the frozen receipt for the real outlier video whose proven STRUCTURE this
   * idea adapted. Present ONLY when grounded generation was ON (GROUNDING_IDEAS_ENABLED) AND the
   * pipeline attributed this idea to a real source. Absent/null on ungrounded runs (flag OFF) and
   * on pre-grounding cached rows → the card renders exactly as before (honesty spine, no fabricated
   * source). The glance card shows a compact <ProofLine>; the opened Room shows the full receipt.
   */
  proof?: HookProof | null;
}

/**
 * A v8 drop card (Phase 2 — the shelf): ONE proven corpus outlier (multiplier > 3×
 * only — owner ruling 2026-08-10), its hook already adapted into the user's niche
 * (the real adapt.ts 3-concept output, rank-1 leading). Drops arrive UNSCORED: no
 * sim runs for remixes — the sim is a completely separate surface (same ruling; the
 * old "drops are the only pre-scored surface" law is dead). The card's number is the
 * RECEIPT: the source's real views + its outlier multiplier ("N× their usual views" —
 * the owner settled the basis 2026-08-10; follower baselines don't exist in the data).
 * Video fields are real outlier_teardowns data with a DURABLE rehosted cover
 * (isDropReady gates the rest out). No donor niche ever crosses over.
 */
export interface LiveDropCard {
  contentId: string;
  hook: string;
  coverUrl: string;
  videoUrl: string | null;
  views: string;
  viewsRaw: number;
  handle: string;
  archetype: string | null;
  hookTemplate: string | null;
  /**
   * The receipt: outlier multiplier vs the creator's own usual views (> 3 by
   * selection). Optional ONLY for back-compat — cache rows and lane cards written
   * before 2026-08-10 predate the field; the shelf guards its render.
   */
  multiplier?: number;
  /** Honest basis for the multiplier (corpus `baseline_label`; "vs their usual views"). */
  baselineLabel?: string | null;
  concepts: AdaptConcept[];
  /**
   * ⚠️ There is deliberately NO `personas` field. A drop card carries no sim — not on the
   * shelf (2026-08-10) and, since 2026-08-12, not on the day-0 lane reveal either, which
   * was the last holdout. Cached rows written before those rulings may still have the key
   * on disk; nothing reads it. If you are about to add it back, you are re-introducing a
   * pre-score, and the sim is a separate surface.
   */
}

/** The glance-tier face a card shows inline — derived from the real personas. */
export interface CardFace {
  tone: Tone;
  stop: number; // headline metric, of 10
  lead: string; // one real reaction verbatim, in a persona's voice ('' when none carried words)
  fraction: string; // "N/T stop" — the honest aggregate the opened Room reads
}

/**
 * Band the /10 `stop` headline into the glance tone — the SAME ≥6 loved / ≤4 bounced bands
 * `readToCardReaction` uses, so a card face derived here agrees with one derived from a full Read.
 */
function toneFromStop(stop: number): Tone {
  if (stop >= 6) return "loved";
  if (stop <= 4) return "bounced";
  return "neutral";
}

/**
 * Pick one real lead verbatim in a persona's voice. Prefer a persona whose verdict AGREES with
 * the card tone (a bounced card leads with a scroller's words, a loved/neutral card with a
 * stopper's), else the first real quote, else '' — a card whose sim carried no words shows no
 * fabricated lead (honesty spine). Flash verdicts are binary (stop|scroll).
 */
function pickLead(personas: ReactionPersona[], tone: Tone): string {
  const wantScroll = tone === "bounced";
  const agree = personas.find(
    (p) => (wantScroll ? p.verdict === "scroll" : p.verdict === "stop") && p.quote.trim().length > 0,
  );
  if (agree) return agree.quote;
  const any = personas.find((p) => p.quote.trim().length > 0);
  return any?.quote ?? "";
}

/**
 * Derive the glance-tier `CardFace` from a card's real Flash personas. Total (never throws):
 * an empty persona set yields `stop:0`, `tone:'bounced'`, empty `lead`, `"0/0 stop"`.
 *
 * `stop` = stoppers/total normalized to /10 (the ≥50% "would stop" headline the Room also reads).
 * `fraction` = the raw "N/T stop" the ambient Room's score header parses.
 */
export function personasToCardFace(personas: ReactionPersona[]): CardFace {
  const total = personas.length;
  const stops = personas.filter((p) => p.verdict === "stop").length;
  const stop = total > 0 ? Math.round((stops / total) * 10) : 0;
  const tone = toneFromStop(stop);
  return {
    tone,
    stop,
    lead: pickLead(personas, tone),
    fraction: `${stops}/${total} stop`,
  };
}
