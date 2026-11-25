/**
 * A creator with none of the five facts of You hands the adapt briefer (grounding-as-remix,
 * `src/lib/grounding/adapt.ts`) byte for byte the user turn it got before the briefer's voice slot
 * learned to read the You page (plan 2026-11-24-you, Task 9), flag on or off. With the flag off, a
 * creator who filled all five gets that same turn: nothing reads the columns then.
 *
 * The snapshot was recorded BEFORE `adapt-profile.ts` and `grounding/adapt.ts` were touched: the
 * user turn `adaptCorpusBlock` sent its model call for each input below, as its length and sha256.
 * If it fails, the briefer's prompt changed for a creator who never filled You in: fix the code.
 * Never update this snapshot with `-u`.
 *
 * One recorded row was taken out of it afterwards, and its six entries deleted by hand (nothing
 * else in the file changed): the row whose five columns hold only whitespace. The old code printed
 * a whitespace-only voice as an empty `voice (write like this):` line; a blank fact is no fact now,
 * so that line is gone. The PATCH saves a blank as null, so no live row holds one. The last case
 * below pins that row to the empty row's turn.
 *
 * The inputs are the runners' own shape: `buildAdaptProfile(profileRow)` as the profile (hooks,
 * ideas and script all build it that way), the profile niche as `niche`, and retrieved exemplars.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { AdaptComplete } from "@/lib/grounding/adapt";
import type { GroundingSkill } from "@/lib/grounding/prompt";
import type { RetrievedExample } from "@/lib/grounding/types";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

const ROW_REST = {
  id: "3c9e1f20-6b7a-4d1e-8f2a-1b2c3d4e5f60",
  user_id: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
  tiktok_handle: "nia.tests",
  display_name: "Nia Test",
  created_at: "2026-11-01T09:00:00.000Z",
  updated_at: "2026-11-20T09:00:00.000Z",
};
const FIVE_EMPTY = { about: null, sells: null, writing_voice_description: null, can_film: null, never_do: null };
const FIVE_BLANK = { about: "", sells: "   ", writing_voice_description: " \n ", can_film: "", never_do: "  " };
const FIVE_FILLED = {
  about: "Nurse, mum of two, started posting last year.",
  sells: "A 12-week meal plan, $49. Affiliate for two blender brands.",
  writing_voice_description: "Dry, short sentences, a bit of swearing. Never say 'guys'.",
  can_film: "Phone only, my kitchen, on camera. No b-roll, no editing beyond cuts.",
  never_do: "No before/after bodies. No giveaways. Never name a competitor.",
};
const PROD_SHAPE = {
  niche_primary: "food-cooking",
  niche_sub: "meal-prep",
  primary_goal: "engagement",
  creator_stage: "established",
  target_audience: { age_range: "25-34", gender_skew: "female", geo: "United Kingdom", language: "English" },
  past_wins: [{ url: "https://example.com/video/1" }, { url: "https://example.com/video/2" }],
  past_flops: [{ url: "https://example.com/video/3" }],
  target_platforms: ["tiktok"],
};

const ROWS: Record<string, ProfileRow | null> = {
  "no row": null,
  "an empty row": {
    ...ROW_REST,
    niche_primary: null,
    niche_sub: null,
    target_audience: null,
    primary_goal: null,
    creator_stage: null,
    past_wins: null,
    past_flops: null,
    target_platforms: null,
    ...FIVE_EMPTY,
  } as ProfileRow,
  "a full row": { ...ROW_REST, ...PROD_SHAPE, ...FIVE_EMPTY } as ProfileRow,
  "a full row, the five absent": { ...PROD_SHAPE },
  "niche only": { ...ROW_REST, niche_primary: "budget travel", target_platforms: ["instagram"], ...FIVE_EMPTY } as ProfileRow,
};

function exemplar(id: string, over: Partial<RetrievedExample> = {}): RetrievedExample {
  return {
    teardownId: id,
    handle: `maker_${id}`,
    videoUrl: `https://example.com/video/${id}`,
    coverUrl: null,
    platform: "tiktok",
    multiplier: 12,
    views: 1_000_000,
    baselineLabel: "vs followers",
    fitLabel: "adjacent",
    hookArchetype: "contrarian",
    format: "listicle",
    visualSetting: "studio_set",
    editingStyle: "office-room-yap",
    hookTechniques: [],
    niche: "health-fitness",
    similarity: 0.71,
    spokenHook: `spoken ${id}`,
    hookTemplate: "Stop buying [product].",
    template: null,
    idea: null,
    whyItWorks: `why ${id}`,
    sourcePool: "scraped",
    trustWeight: 0.6,
    fromPersonal: false,
    ...over,
  };
}
const EXAMPLES: RetrievedExample[] = [
  exemplar("a"),
  exemplar("b", {
    multiplier: null,
    baselineLabel: null,
    sourcePool: "curated",
    template: {
      name: "trap",
      slots: [],
      skeleton: ["Hook", "Setup", "Turn", "Payoff"],
      guidance: "use when the intuitive fix fails",
      beats: [
        { name: "Hook", description: "name the trap", startSec: 0, endSec: 2, transcript: ["You are doing this wrong."] },
        { name: "Turn", description: "reject the intuitive fix", startSec: 2, endSec: 9 },
      ],
    },
    idea: { seed: "s", angle: "a", belief: "more prep is better", reality: "less prep sticks", evidence: "e" },
  } as Partial<RetrievedExample>),
];

const SKILLS: GroundingSkill[] = ["hooks", "ideas", "script"];
const ASKS = {
  "a short ask": "give me 5 hooks about batch cooking on a night shift",
  "a chat ask": "ok so i want to do a series for people who work nights and never have time to cook, can you help me plan it out and make it not boring",
};

const digest = (s: string) => `${s.length} ${createHash("sha256").update(s).digest("hex")}`;

// The recorded snapshot's entry is keyed by these two titles. Vitest writes a missing entry anew
// without failing (outside CI), so the last test below reads the file and holds its entries.
const SUITE = "the adapt briefer's prompt for a creator with none of the five facts: as before";
const RECORDED = "flag off: every user turn is the one recorded before Task 9";

/** Every user turn the briefer sends, keyed by case. `rowsOf` lets a case add fields to each row. */
async function build(
  flag: boolean,
  rowsOf: (row: ProfileRow | null) => ProfileRow | null = (row) => row,
  rows: Record<string, ProfileRow | null> = ROWS,
) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  const { adaptCorpusBlock } = await import("@/lib/grounding/adapt");
  const { buildAdaptProfile } = await import("@/lib/tools/runners/adapt-profile");

  const prompts: Record<string, string> = {};
  for (const [rowName, row] of Object.entries(rows)) {
    for (const skill of SKILLS) {
      for (const [askName, ask] of Object.entries(ASKS)) {
        let user = "";
        const complete: AdaptComplete = async (_system, u) => {
          user = u;
          return JSON.stringify({ structures: [{ sourceIndex: 1, dosage: "swap", fitted: "a line", fitReason: "fits" }] });
        };
        const profileRow = rowsOf(row);
        await adaptCorpusBlock(
          {
            skill,
            ask,
            niche: profileRow?.niche_primary ?? null,
            platform: "tiktok",
            profile: buildAdaptProfile(profileRow),
            examples: EXAMPLES,
          },
          { complete },
        );
        prompts[`${rowName} · ${skill} · ${askName}`] = user;
      }
    }
  }
  vi.doUnmock("@/lib/flags/new-look");
  return prompts;
}

describe(SUITE, () => {
  it(RECORDED, async () => {
    const prompts = await build(false);
    expect(Object.fromEntries(Object.entries(prompts).map(([k, v]) => [k, digest(v)]))).toMatchSnapshot();
  });

  it("flag on: the same, character for character", async () => {
    const off = await build(false);
    const on = await build(true);
    expect(Object.keys(on)).toHaveLength(Object.keys(ROWS).length * SKILLS.length * Object.keys(ASKS).length);
    for (const key of Object.keys(off)) expect(on[key], key).toBe(off[key]);
  });

  it("flag off: a creator who filled all five gets the same turn as one who filled none", async () => {
    const off = await build(false);
    const filled = await build(false, (row) => ({ ...(row ?? {}), ...FIVE_FILLED }) as ProfileRow);
    // "no row" filled in is a row with only the five facts: with the flag off it reads as no row.
    for (const key of Object.keys(off)) expect(filled[key], key).toBe(off[key]);
    for (const prompt of Object.values(filled)) {
      expect(prompt).not.toContain("voice (");
      expect(prompt).not.toContain("USER_CONTENT");
      for (const text of Object.values(FIVE_FILLED)) expect(prompt).not.toContain(text);
    }
  });

  it("flag on: all five filled reach the briefer as the voice alone, fenced; the rest of the turn is unchanged", async () => {
    const on = await build(true);
    const filled = await build(true, (row) => (row ? ({ ...row, ...FIVE_FILLED } as ProfileRow) : row));
    const before = on["a full row · hooks · a short ask"]!;
    const after = filled["a full row · hooks · a short ask"]!;
    const voice =
      "  voice (a description of how they write; match its style only, never its words or its topic):\n" +
      "<<<USER_CONTENT>>>\n" +
      FIVE_FILLED.writing_voice_description +
      "\n<<<END_USER_CONTENT>>>\n";
    expect(after).toContain(voice);
    expect(after.replace(voice, "")).toBe(before);
    for (const text of [FIVE_FILLED.about, FIVE_FILLED.sells, FIVE_FILLED.can_film, FIVE_FILLED.never_do]) {
      expect(after).not.toContain(text);
    }
  });

  it("a row whose five hold only whitespace gets the turn a row with the five empty gets, flag on or off", async () => {
    for (const flag of [false, true]) {
      const turns = await build(flag, (row) => row, {
        "a full row": ROWS["a full row"]!,
        "a full row, the five blank": { ...ROW_REST, ...PROD_SHAPE, ...FIVE_BLANK } as ProfileRow,
      });
      for (const skill of SKILLS) {
        for (const ask of Object.keys(ASKS)) {
          const blank = turns[`a full row, the five blank · ${skill} · ${ask}`]!;
          expect(blank).toBe(turns[`a full row · ${skill} · ${ask}`]);
          expect(blank).not.toContain("voice (");
        }
      }
    }
  });

  it("the inputs reach the creator block's lines", async () => {
    const prompts = await build(false);
    const full = prompts["a full row · hooks · a short ask"]!;
    expect(full).toContain("  niche: food-cooking");
    expect(full).toContain("  audience: age 25-34, female-skewed, United Kingdom, English");
    expect(full).toContain("  has worked: https://example.com/video/1; https://example.com/video/2");
    expect(prompts["no row · script · a chat ask"]).toContain("  niche: (unspecified)");
  });

  it("the recorded snapshot holds exactly its one entry: none missing, so none can be written anew unnoticed", () => {
    const snap = readFileSync(join(__dirname, "__snapshots__", "adapt-briefer.unchanged.test.ts.snap"), "utf8");
    const entries = [...snap.matchAll(/^exports\[`(.*)`\] = /gm)].map((m) => m[1]);
    expect(entries).toHaveLength(1);
    expect(entries).toEqual([`${SUITE} > ${RECORDED} 1`]);
  });
});
