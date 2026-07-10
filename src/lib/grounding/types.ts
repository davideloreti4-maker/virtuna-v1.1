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
/** Hook (text/spoken) archetypes — Message dimension. */
export const HOOK_ARCHETYPES = [
  "question",
  "personal-experience",
  "secret-reveal-breakdown",
  "authority",
  "contrarian",
  "list",
  "case-study",
  "trap-mistake",
] as const;

/** Format — the container (Form dimension). */
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
] as const;

/** Visual hook — the first-frame device (Form dimension, video-proof). */
export const VISUAL_HOOKS = [
  "crash-zoom",
  "camera-whip",
  "match-cut",
  "speed-ramp",
  "snap-pop-reveal",
  "unusual-first-image",
  "text-slide-in",
] as const;

/** Editing style (Form dimension, video-proof). */
export const EDITING_STYLES = [
  "split-screen",
  "whiteboard",
  "stop-motion",
  "vlog-pov",
  "faceless-animation",
  "man-on-street",
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
}

/** One fillable slot in a template. */
export interface TemplateSlot {
  key: string;
  label: string;
  example: string;
}

/** template JSONB — the generalized reusable structure (§13 proposed sub-shape). */
export interface TeardownTemplate {
  name: string;
  slots: TemplateSlot[];
  skeleton: string[]; // ordered beats
  guidance: string;
}

/**
 * The extracted teardown core — the reusable framework torn from ONE outlier.
 * Facets are the queryable dimensions (§11b); every field optional so a cheap
 * (metadata/caption) extraction and a deep (watched) extraction share one shape.
 */
export interface Teardown {
  spokenHook: string | null;
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
  template: TeardownTemplate | null;
  idea: IdeaFacet | null;
  whyItWorks: string | null;
  sourcePool: SourcePool | "personal";
  trustWeight: number;
  fromPersonal: boolean;
}
