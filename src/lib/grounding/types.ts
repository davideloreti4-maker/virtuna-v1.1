/**
 * grounding/types.ts — the grounded-generation bounded context, domain types +
 * the SOFT-VOCAB SSOT (§13).
 *
 * §13 locks facets/niche as free TEXT in the DB (NO CHECK — the edu↔education
 * rigid-CHECK trap) validated app-side against "a versioned TS enum, single SSOT".
 * THIS FILE is that SSOT. The migration stores whatever we write; this module is
 * the one place the vocabulary is defined, seeded (§11b Sandcastles taxonomy), and
 * normalized. The vocab is a SEED that grows — `classifyFacet` accepts unknown
 * values (returns them slugified, flagged not-known) rather than rejecting.
 *
 * Niches are NOT redefined here — §13: "adopt scraped_videos' 10-slug whitelist,
 * don't mint a 4th vocabulary." We re-export the slugs from the shipped NICHE_TREE.
 */

import { z } from "zod";
import { NICHE_TREE } from "@/lib/niches/taxonomy";

// ─── Versioning ─────────────────────────────────────────────────────────────
/**
 * Bump when the seed vocab below changes shape/meaning (not on pure additions —
 * additions are the growth path). Stored on the row as `extraction_version` context.
 */
export const FACET_VOCAB_VERSION = 1;

// ─── Niche (re-exported from the shipped SSOT, NOT minted) ───────────────────
/** The 10-slug niche whitelist (§13) — the SAME set as scraped_videos.primary_niche. */
export const NICHE_SLUGS = NICHE_TREE.map((n) => n.slug) as readonly string[];
export function isKnownNiche(slug: string): boolean {
  return NICHE_SLUGS.includes(slug);
}

// ─── Closed engineering enums (these DO have DB CHECKs — genuinely closed) ────
export type SourcePool = "curated" | "competitor" | "scraped" | "expanded";
export type HookSource = "native_transcript" | "caption_fallback" | "omni";
export type TeardownStatus = "metadata" | "extracted" | "watched" | "failed";

/** Honest per-request fit label (§11c). Computed at query, NEVER stored. ● ◐ ○ */
export type FitLabel = "in-audience" | "adjacent" | "structural";
export const FIT_GLYPH: Record<FitLabel, string> = {
  "in-audience": "●",
  adjacent: "◐",
  structural: "○",
};

// ─── Facet seed vocabulary (§11b — Sandcastles taxonomy as the seed, growable) ─
/** Hook (text/spoken) archetypes — Message dimension.
 *  Grown 2026-07-14 from the 532-row curated import: the five slugs below the rule
 *  are concepts the seed vocab lacked, observed in the wild (counts in the import). */
export const HOOK_ARCHETYPES = [
  "question",
  "personal-experience",
  "secret-reveal-breakdown",
  "authority",
  "contrarian",
  "list",
  "case-study",
  "trap-mistake",
  // ── grown from the curated corpus ──
  "tutorial",
  "scenario-hypothetical",
  "problem",
  "ranking-rating",
  "comparison",
] as const;

/** Format — the container (Form dimension).
 *  Grown 2026-07-14 from the curated import (same rule as above). */
export const FORMATS = [
  "about-me",
  "a-vs-b-comparison",
  "breakdowns-explainers",
  "case-study",
  "challenge",
  "day-in-the-life",
  "heros-journey",
  "listicle",
  "problem-solution",
  "q-and-a",
  "tier-list",
  "reaction",
  "scenarios",
  "skit",
  "tutorial",
  "yap",
  // ── grown from the curated corpus ──
  "personal-learning-epiphany",
  "episodic-series-social-show",
  "personal-update",
  "levels",
  "common-trap-mistake",
] as const;

/**
 * Visual hook — the FIRST-FRAME DEVICE (Form dimension, video-proof).
 *
 * ⚠️ Do not confuse this with the SETTING (studio / greenscreen / car / in-world).
 * This facet answers "what motion or image grabs the eye in frame one", which only an
 * omni WATCH pass can honestly fill — the text tier leaves it null. The 2026-07-14
 * curated import wrote Sandcastles' `visual_layout_category` (a setting) into this
 * column; that data is being moved to its own facet and this column nulled for those
 * rows. Never read visual_hook expecting a setting.
 */
export const VISUAL_HOOKS = [
  "crash-zoom",
  "camera-whip",
  "match-cut",
  "speed-ramp",
  "snap-pop-reveal",
  "unusual-first-image",
  "text-slide-in",
] as const;

/** Editing style (Form dimension, video-proof).
 *  Grown 2026-07-14 from the curated import — Sandcastles' visual_layout_type, which
 *  IS this dimension (unlike visual_layout_category; see VISUAL_HOOKS above). */
export const EDITING_STYLES = [
  "split-screen",
  "whiteboard",
  "stop-motion",
  "vlog-pov",
  "faceless-animation",
  "man-on-street",
  // ── grown from the curated corpus ──
  "vlog-hybrid",
  "vlog-interactive",
  "vlog-reflective",
  "vlog-music",
  "vlog-timelapse",
  "visual-greenscreen",
  "notes-article-greenscreen",
  "office-room-yap",
  "car-yap",
  "full-screen-hybrid",
  "faceless-visual-explainer",
  "faceless-physical-explainer",
  "faceless-text-conversation",
  "faceless-clipping",
  "skit-solo",
  "skit-group",
  "skit-lip-sync",
  "skit-transformation-reveal",
  "reaction",
  "comparison-clone",
  "podcast-clips",
  "static-image-slideshow",
  "man-on-street-single-interview",
  "man-on-street-multiple-interviews",
] as const;

/** Signature series — recurring-format identity (meta). */
export const SIGNATURE_SERIES = [
  "docuseries",
  "progress-journey",
  "recurring-segment",
] as const;

export type FacetKind =
  | "hook_archetype"
  | "format"
  | "visual_hook"
  | "editing_style"
  | "signature_series";

const FACET_VOCAB: Record<FacetKind, readonly string[]> = {
  hook_archetype: HOOK_ARCHETYPES,
  format: FORMATS,
  visual_hook: VISUAL_HOOKS,
  editing_style: EDITING_STYLES,
  signature_series: SIGNATURE_SERIES,
};

/**
 * Slugify a raw extractor label into the canonical facet form:
 * lowercase, spaces/underscores/slashes → hyphen, strip other punctuation,
 * collapse repeats. "Secret Reveal / Breakdown" → "secret-reveal-breakdown".
 */
export function slugifyFacet(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[\s_/]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * SOFT validation (§13): normalize a raw extractor value into the vocab. Unknown
 * values are KEPT (the vocab grows) — `known:false` just flags them for later
 * curation/telemetry. Never throws, never drops.
 */
export function classifyFacet(
  kind: FacetKind,
  raw: string | null | undefined,
): { slug: string | null; known: boolean } {
  if (!raw || !raw.trim()) return { slug: null, known: false };
  const slug = slugifyFacet(raw);
  if (!slug) return { slug: null, known: false };
  return { slug, known: FACET_VOCAB[kind].includes(slug) };
}

// ─── Extracted teardown sub-shapes (JSONB columns) ───────────────────────────
/** idea JSONB — the Message/Idea decomposition (§11b). */
export interface IdeaFacet {
  seed: string;
  angle: string;
  belief: string; // common belief to challenge
  reality: string; // contrarian reality
  evidence: string; // supporting evidence
  /** What the video is ABOUT, plainly (present on curated rows; optional for the text tier). */
  topic?: string;
}

/** One fillable slot in a template. */
export interface TemplateSlot {
  key: string;
  label: string;
  example: string;
}

/**
 * One named, TIMED beat of a proven narrative structure — the per-video blueprint a
 * real outlier actually ran (Sandcastles `narrative_structure.structure_sections`).
 * Richer than `skeleton` (which is just the ordered beat NAMES): a beat carries the
 * retention purpose and the seconds it occupied. Only a source that WATCHED the video
 * can fill this honestly, so the text tier leaves it absent.
 */
export interface TeardownBeat {
  name: string;
  description: string;
  // Optional, not merely nullable: a cheap metadata/caption extraction produces beats with only
  // name+description and no timing keys at all. Matches TeardownBeatSchema (`.nullable().optional()`)
  // so a parsed template assigns cleanly. See the schema comment for the 14/300-drop history.
  startSec?: number | null;
  endSec?: number | null;
}

/** template JSONB — the generalized reusable structure (§13 proposed sub-shape). */
export interface TeardownTemplate {
  name: string;
  slots: TemplateSlot[];
  skeleton: string[]; // ordered beat names
  guidance: string; // WHEN to use this structure (curated: Sandcastles' format_reasoning)
  /** The timed named beats behind `skeleton` — the script skill's proven scaffold. */
  beats?: TeardownBeat[];
  /** One-line specific read of the format ("rapid-fire A/B pronunciation duel"). */
  flavor?: string | null;
}

// ─── JSONB parse guards (the anti-silent-drift rule) ─────────────────────────
/**
 * `idea` and `template` are raw JSONB. A plain TS cast over them is a LIE the compiler
 * cannot catch: the 2026-07-14 curated import stored Sandcastles' own key names
 * (`common_belief`, `narrative_structure`) while this module's readers expected ours
 * (`belief`, `skeleton`) — every read silently returned `undefined`, typechecked clean,
 * and passed every test. These schemas make that failure LOUD instead. Parse the jsonb;
 * never cast it.
 */
const TemplateSlotSchema = z.object({
  key: z.string(),
  label: z.string(),
  example: z.string(),
});

const TeardownBeatSchema = z.object({
  name: z.string(),
  description: z.string(),
  // Timings are OPTIONAL, not merely nullable. A watched extraction measures them; a cheap
  // metadata/caption extraction produces beats with only name+description and no timing keys at
  // all. `.nullable()` alone rejected a MISSING key, so 14/300 rows silently dropped their whole
  // template — beats, slots, guidance and all — over an absent nice-to-have. The beat's structural
  // content (name + description) is the payload; the seconds are garnish. Match the "every field
  // optional so cheap and deep extractions share one shape" contract the Teardown interface states.
  startSec: z.number().nullable().optional(),
  endSec: z.number().nullable().optional(),
});

export const IdeaFacetSchema = z.object({
  seed: z.string(),
  angle: z.string(),
  belief: z.string(),
  reality: z.string(),
  evidence: z.string(),
  topic: z.string().optional(),
});

export const TeardownTemplateSchema = z.object({
  name: z.string(),
  slots: z.array(TemplateSlotSchema),
  skeleton: z.array(z.string()),
  guidance: z.string(),
  beats: z.array(TeardownBeatSchema).optional(),
  flavor: z.string().nullable().optional(),
});

/** Parse an `idea` JSONB value. Null on absent; null + a LOUD warn on shape drift. */
export function parseIdeaFacet(value: unknown): IdeaFacet | null {
  if (value === null || value === undefined) return null;
  const parsed = IdeaFacetSchema.safeParse(value);
  if (!parsed.success) {
    console.warn(
      `[grounding] idea JSONB failed its schema — dropping (keys: ${
        value && typeof value === "object" ? Object.keys(value).join(",") : typeof value
      })`,
    );
    return null;
  }
  return parsed.data;
}

/** Parse a `template` JSONB value. Null on absent; null + a LOUD warn on shape drift. */
export function parseTeardownTemplate(value: unknown): TeardownTemplate | null {
  if (value === null || value === undefined) return null;
  const parsed = TeardownTemplateSchema.safeParse(value);
  if (!parsed.success) {
    // Print the FAILING PATHS, not the top-level keys. The old log listed
    // `name,beats,slots,flavor,guidance,skeleton` — all valid — which said "checked" while hiding
    // that the real fault was `beats.0.startSec`. A log that names the wrong thing is worse than
    // none: it cost a session to rediscover a cause the parser already knew. Surface it.
    console.warn(
      `[grounding] template JSONB failed its schema — dropping (issues: ${parsed.error.issues
        .slice(0, 4)
        .map((i) => `${i.path.join(".")}:${i.code}`)
        .join(", ")})`,
    );
    return null;
  }
  return parsed.data;
}

/**
 * The extracted teardown core — the reusable framework torn from ONE outlier.
 * Facets are the queryable dimensions (§11b); every field optional so a cheap
 * (metadata/caption) extraction and a deep (watched) extraction share one shape.
 */
export interface Teardown {
  spokenHook: string | null;
  /** The spokenHook generalized into a reusable fill-in-the-blank with [bracketed variables]
   *  (Sandcastles-style) — the reusable structure shown on the card's proof block (§11b). */
  hookTemplate: string | null;
  hookSource: HookSource | null;
  hookArchetype: string | null;
  format: string | null;
  visualHook: string | null;
  editingStyle: string | null;
  signatureSeries: string | null;
  idea: IdeaFacet | null;
  template: TeardownTemplate | null;
  whyItWorks: string | null;
  /** Full forward-compatible superset (anything the extractor emits beyond the hoisted fields). */
  raw: Record<string, unknown> | null;
}

// ─── Frozen proof snapshot (the durable receipt) ─────────────────────────────
export interface ProofSnapshot {
  views: number | null;
  followerCount: number | null;
  outlierMultiplier: number | null;
  /** Honest basis: 'vs own' | 'vs niche' | 'vs followers' | 'vs account' — free text (finding #2). */
  baselineLabel: string | null;
  engagementRate: number | null;
  postedAt: string | null; // ISO
  proofCapturedAt: string | null;
  refreshedAt: string | null;
}

// ─── DB row shapes (manual until the migration applies + types regen) ────────
/** A row of public.outlier_teardowns (SHARED). Superseded by generated types post-apply. */
export interface OutlierTeardownRow extends Teardown, ProofSnapshot {
  id: string;
  platform: string;
  platformVideoId: string;
  videoUrl: string | null;
  coverUrl: string | null;
  creatorHandle: string | null;
  sourcePool: SourcePool;
  sourceId: string | null;
  trustWeight: number;
  niche: string | null;
  subniche: string | null;
  embedding: number[] | null;
  extractionTier: string | null;
  extractionVersion: string | null;
  model: string | null;
  status: TeardownStatus;
}

/** A row of public.personal_teardowns (PRIVATE). */
export interface PersonalTeardownRow extends Teardown, ProofSnapshot {
  id: string;
  userId: string;
  platform: string;
  platformVideoId: string;
  videoUrl: string | null;
  coverUrl: string | null;
  creatorHandle: string | null;
  sourceAccountId: string | null;
  plannedPostId: string | null;
  outcomeId: string | null;
  niche: string | null;
  subniche: string | null;
  predictedBand: string | null;
  actualOutcome: Record<string, unknown> | null;
  embedding: number[] | null;
  extractionTier: string | null;
  extractionVersion: string | null;
  model: string | null;
  status: TeardownStatus;
}

// ─── RetrievedExample — the retrieval output that feeds assembler.corpus ──────
/**
 * The unit handed to generation (§11f: the one optional-additive `corpus` field on
 * AssemblerInput). Carries the reusable structure + the frozen receipt + the
 * per-request fit label. `fromPersonal` marks a Rung −1 own-library example (weighted
 * highest). This is the honesty-spine payload: no example without a real source.
 */
export interface RetrievedExample {
  teardownId: string;
  handle: string | null;
  videoUrl: string | null;
  /** Ephemeral TikTok-CDN cover (display-only thumbnail on the card receipt; may expire). */
  coverUrl: string | null;
  platform: string;
  /** Proof receipt — the numbers shown under the "YOUR VERSION" card (§11b grammar). */
  multiplier: number | null;
  views: number | null;
  baselineLabel: string | null;
  /** Per-request honest fit (§11c) — computed at retrieval, not stored. */
  fitLabel: FitLabel;
  hookArchetype: string | null;
  format: string | null;
  spokenHook: string | null;
  /** The source hook as a reusable [bracketed] template — the proof block's fill-in-the-blank line. */
  hookTemplate: string | null;
  template: TeardownTemplate | null;
  idea: IdeaFacet | null;
  whyItWorks: string | null;
  sourcePool: SourcePool | "personal";
  trustWeight: number;
  fromPersonal: boolean;
}
