/**
 * The drops shelf adapts corpus rows into the creator's niche and passes no creator block (plan
 * 2026-11-24-you, Task 9): with the new look on, a creator who filled all five facts of You gets the
 * drop prompts a creator who filled none gets, character for character.
 *
 * The real `buildLiveDrops`, `corpusRowToAdaptInput` and `buildAdaptUserContent` run here. Stand-ins:
 * the Supabase client (the profile read and the shelf cache), the audience resolver, the embedding
 * and match calls, and the adapt model call, all through the function's own `deps`.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { buildLiveDrops, type BuildDropsDeps } from "../drop-reactions";
import { buildAdaptUserContent } from "@/lib/engine/remix/adapt";
import type { AdaptConcept, AdaptInput } from "@/lib/engine/remix/decode-types";
import type { SharedMatchRow } from "@/lib/grounding/corpus";
import type { Audience } from "@/lib/audience/audience-types";

let seq = 0;
function corpusRow(): SharedMatchRow {
  seq += 1;
  return {
    id: `row-${seq}`,
    similarity: 0.5,
    platform: "tiktok",
    platform_video_id: "v",
    video_url: "https://example.com/v",
    cover_url: "https://storage.example.com/storage/v1/object/public/covers/corpus/1.jpg",
    creator_handle: "someone",
    source_pool: "curated",
    trust_weight: 1.5,
    views: 5_300_000,
    follower_count: null,
    outlier_multiplier: 5,
    baseline_label: "vs their usual views",
    engagement_rate: null,
    posted_at: null,
    proof_captured_at: null,
    niche: "fitness",
    hook_archetype: `arch-${seq}`,
    format: null,
    visual_hook: null,
    editing_style: null,
    spoken_hook: "spoken line",
    hook_template: "madlib [x]",
    hook_source: null,
    idea: { seed: "s", angle: "a", belief: "more prep is better", reality: "less prep sticks", evidence: "e" },
    template: null,
    why_it_works: null,
    hook_techniques: null,
  } as SharedMatchRow;
}
const POOL = Array.from({ length: 20 }, corpusRow);

const CONCEPTS: AdaptConcept[] = [
  { hook: "h1", angle: "a1", who_its_for: "w1", format_borrowed: "f1", personaStops: 8, stopQuote: "q1" },
  { hook: "h2", angle: "a2", who_its_for: "w2", format_borrowed: "f2", personaStops: 5, stopQuote: "q2" },
  { hook: "h3", angle: "a3", who_its_for: "w3", format_borrowed: "f3", personaStops: 2, stopQuote: "q3" },
];

const PROFILE = { user_id: "7d2e9a40-1c3b-4e5f-8a6b-9c0d1e2f3a4b", niche_primary: "food-cooking", target_platforms: ["tiktok"] };
const FIVE_FILLED = {
  about: "Nurse, mum of two, started posting last year.",
  sells: "A 12-week meal plan, $49. Affiliate for two blender brands.",
  writing_voice_description: "Dry, short sentences, a bit of swearing. Never say 'guys'.",
  can_film: "Phone only, my kitchen, on camera. No b-roll, no editing beyond cuts.",
  never_do: "No before/after bodies. No giveaways. Never name a competitor.",
};

/** The profile read returns `profile`; the shelf cache is empty; writes are accepted. */
function fakeSupabase(profile: unknown) {
  const client = {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: table === "creator_profiles" ? profile : null, error: null }),
        upsert: async () => ({ error: null }),
      };
      return chain;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as any;
}

async function dropPrompts(profile: unknown, audience: Audience): Promise<{ inputs: AdaptInput[]; prompts: string[] }> {
  const inputs: AdaptInput[] = [];
  const deps: BuildDropsDeps = {
    resolveAudience: async () => audience,
    embed: async () => [0.1, 0.2],
    match: async () => POOL,
    adapt: async (input) => {
      inputs.push(input);
      return CONCEPTS;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    corpusClient: (() => ({})) as any,
  };
  await buildLiveDrops(fakeSupabase(profile), PROFILE.user_id, deps);
  return { inputs, prompts: inputs.map(buildAdaptUserContent) };
}

const AUDIENCES = {
  general: { id: "gen", is_general: true, name: "General", goal_label: null } as unknown as Audience,
  calibrated: { id: "cal", is_general: false, name: "Night-shift nurses", goal_label: "Grow" } as unknown as Audience,
};

describe("buildLiveDrops: the facts of You do not reach the drop prompts", () => {
  for (const [name, audience] of Object.entries(AUDIENCES)) {
    it(`${name} audience: all five filled gives the prompts none filled gives`, async () => {
      const without = await dropPrompts(PROFILE, audience);
      const withFacts = await dropPrompts({ ...PROFILE, ...FIVE_FILLED }, audience);
      expect(without.prompts.length).toBeGreaterThan(0);
      expect(withFacts.prompts).toEqual(without.prompts);
      for (const input of withFacts.inputs) expect(input.creator).toBeUndefined();
      for (const prompt of withFacts.prompts) {
        expect(prompt).not.toContain("THE CREATOR, IN THEIR OWN WORDS");
        expect(prompt).not.toContain("USER_CONTENT");
      }
    });
  }
});
