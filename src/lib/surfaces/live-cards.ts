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
