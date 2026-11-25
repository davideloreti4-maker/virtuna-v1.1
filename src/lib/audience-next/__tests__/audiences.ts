/**
 * Made-up audiences, accounts, posts and snapshots for the audience-next tests. Every handle and
 * name here is invented (`nia.tests`, `leo.makes`); nothing stands for a real account.
 */
import type { AccountSnapshot } from "@/lib/account-metrics/account-metrics";
import type { AccountPost } from "@/lib/account-metrics/account-posts-repo";
import type { Audience, AudienceSignature, SignaturePersona } from "@/lib/audience/audience-types";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";
import type { AccountRef } from "../audience-model";

/** A made-up uuid, one per number. */
export const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** The ten shares the dev preview's own audience uses (they add up to 1). */
export const SHARES = [0.13, 0.11, 0.105, 0.1, 0.1, 0.095, 0.09, 0.09, 0.09, 0.09] as const;

/** One complete audience; each builder spreads its own fields over it. */
const BASE: Audience = {
  id: uuid(900),
  user_id: "u-1",
  name: "Base",
  type: "target",
  mode: "socials",
  platform: "tiktok",
  goal_label: null,
  goal_intent: null,
  is_general: false,
  is_preset: false,
  source_account_id: null,
  persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
  personas: [],
  profile: null,
  calibration: null,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};

export const audience = (over: Partial<Audience> = {}): Audience => ({ ...BASE, ...over });

/** One read persona per share, in the app's group order, each with its own made-up texts. */
export function readPersonas(shares: readonly number[], texts = true): SignaturePersona[] {
  return shares.map((share, i) => ({
    archetype: ARCHETYPES[i % ARCHETYPES.length]!,
    share,
    temperature: "warm",
    disposition: "lurker",
    reaction_frame: texts ? `Judges by the first beat ${i}.` : "",
    evidence: texts ? `Saves 2.${i}× the category.` : "",
    ...(texts ? { blurb: `"Made-up line ${i}."` } : {}),
  }));
}

export interface SignatureSpec {
  personas?: SignaturePersona[];
  handle?: string;
  scrapedAt?: string;
  videos?: number;
  works?: string;
  flat?: string;
}

export function signature(spec: SignatureSpec = {}): AudienceSignature {
  return {
    creator_persona: { content_description: "", context: "", writing_style_sample: "", format_signature: "" },
    audience: {
      follower_tier: null,
      maturity: "growing",
      temperature_mix: { cold: 0.3, warm: 0.5, hot: 0.2 },
      interest_tags: [],
      what_resonates: spec.works ?? "",
      what_falls_flat: spec.flat ?? "",
      persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
      personas: spec.personas ?? readPersonas(SHARES),
    },
    summary: "",
    provenance: {
      handle: spec.handle ?? "",
      scraped_at: spec.scrapedAt ?? "2026-08-14T10:00:00Z",
      videos_analyzed: spec.videos ?? 12,
      videos_watched: 6,
      sub_coverage: "6/8",
    },
  };
}

export const account = (over: Partial<AccountRef> = {}): AccountRef => ({
  id: uuid(100),
  handle: "nia.tests",
  platform: "tiktok",
  is_primary: true,
  ...over,
});

/** The creator's own account's audience, tied to `account()`. */
export const own = (over: Partial<Audience> = {}, spec: SignatureSpec = {}): Audience =>
  audience({
    id: uuid(1),
    name: "@nia.tests",
    type: "personal",
    source_account_id: uuid(100),
    calibration: { source: "scrape", handle: "nia.tests", scraped_at: "2026-08-14T10:00:00Z", thin: false },
    signature: signature({ handle: "nia.tests", ...spec }),
    ...over,
  });

/** Another creator's audience, read from their handle. */
export const other = (over: Partial<Audience> = {}, spec: SignatureSpec = {}): Audience =>
  audience({
    id: uuid(2),
    name: "@leo.makes",
    type: "target",
    calibration: { source: "scrape", handle: "leo.makes", scraped_at: "2026-08-14T10:00:00Z", thin: false },
    signature: signature({ handle: "leo.makes", ...spec }),
    ...over,
  });

/** A described audience: what `calibration.ts` stores (its own name lower-cased as the provenance handle). */
export const described = (over: Partial<Audience> = {}, spec: SignatureSpec = {}): Audience =>
  audience({
    id: uuid(3),
    name: "Busy parents who meal-prep",
    type: "target",
    platform: "custom",
    goal_label: "Parents who cook for the week on Sunday.",
    calibration: { source: "description", scraped_at: "2026-08-14T10:00:00Z", thin: false },
    signature: signature({ handle: "busy parents who meal-prep", ...spec }),
    ...over,
  });

export const post = (over: Partial<AccountPost> = {}): AccountPost => ({
  post_id: "7300000000000000001",
  caption: "A made-up caption",
  posted_at: "2026-08-01T10:00:00Z",
  views: 1000,
  likes: 10,
  comments: 1,
  shares: 1,
  saves: 1,
  hashtags: [],
  is_pinned: false,
  pillar_id: null,
  ...over,
});

/** Posts with these views, ids in order. */
export const posts = (views: readonly number[], pinned: readonly number[] = []): AccountPost[] =>
  views.map((v, i) => post({ post_id: `73000000000000000${String(i + 10)}`, views: v, caption: `Post ${i}`, is_pinned: pinned.includes(i) }));

export const snapshot = (over: Partial<AccountSnapshot> = {}): AccountSnapshot => ({
  snapshot_date: "2026-11-24",
  follower_count: 424_000,
  heart_count: 20_612_345,
  video_count: 613,
  recent_views: null,
  ...over,
});
