/**
 * A creator with none of the five facts of You, or any creator while the new look is off, gets
 * remix's adapt prompt byte for byte as it was before remix learned to read them (plan
 * 2026-11-24-you, Task 9).
 *
 * The snapshot was recorded BEFORE `decode-types.ts`, `adapt.ts` and `remix-runner.ts` were
 * touched: every user turn `buildAdaptUserContent` built for the inputs below, with the code of that
 * day, as its length and sha256. If it fails, a remix prompt changed for a creator who never filled
 * You in: fix the code. Never update this snapshot with `-u`.
 *
 * The inputs are the four callers' own shapes, built by the callers' own builders:
 * - the remix runner: `decodeResultToAdaptInput` on the audience-steered niche, the timed blueprint,
 *   the brief as the target and, since Task 9, `creator: remixCreatorOf(profileRow, brief)` (the lines
 *   around `const profileNiche` in `remix-runner.ts`; the creator was added to this file after the
 *   recording, and the recorded bytes did not move);
 * - `POST /api/remix/adapt`: the wire decode, the niche, an empty blueprint, no target;
 * - the drops pipe and the lane drops: `corpusRowToAdaptInput` on a corpus row and a niche.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { DECODE_FIXTURE, DECODE_RESULT_FIXTURE } from "@/lib/engine/remix/decode.fixture";
import { buildBlueprint, emptyBlueprint, type SourceBlueprint } from "@/lib/engine/remix/blueprint";
import type { AdaptInput, OmniStructuralInput } from "@/lib/engine/remix/decode-types";
import type { SharedMatchRow } from "@/lib/grounding/corpus";
import type { Audience } from "@/lib/audience/audience-types";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

/** The other columns `select("*")` returns, invented. Remix reads none of them. */
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
/** All five at the shapes the You page saves. Used only where the flag is off, or by drops. */
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
  past_wins: [{ url: "https://example.com/video/1" }],
  past_flops: null,
  target_platforms: ["tiktok"],
};

const ROWS: Record<string, ProfileRow | null> = {
  "no row": null,
  "a full row": { ...ROW_REST, ...PROD_SHAPE, ...FIVE_EMPTY } as ProfileRow,
  "a full row, the five blank": { ...ROW_REST, ...PROD_SHAPE, ...FIVE_BLANK } as ProfileRow,
  "no niche": { ...ROW_REST, ...PROD_SHAPE, niche_primary: null, ...FIVE_EMPTY } as ProfileRow,
};

const AUDIENCES: Record<string, Audience | null> = {
  "no audience": null,
  "the general audience": { id: "a-general", is_general: true, name: "General", goal_label: null } as unknown as Audience,
  "a calibrated audience": { id: "a-cal", is_general: false, name: "Night-shift nurses", goal_label: "Grow" } as unknown as Audience,
  "a calibrated audience, no goal": { id: "a-cal2", is_general: false, name: "New parents", goal_label: null } as unknown as Audience,
};

const BRIEFS: Record<string, string | null | undefined> = {
  "no brief": undefined,
  "a brief": "my 12-week meal plan launch",
  "an empty brief": "",
};

function seg(t_start: number, t_end: number, over: Record<string, unknown> = {}) {
  return {
    t_start,
    t_end,
    visual_event: `visual ${t_start}`,
    audio_event: `audio ${t_start}`,
    is_hook_zone: t_start < 3,
    spoken_text: `source words at ${t_start}`,
    on_screen_text: null,
    ...over,
  };
}
const STRUCTURAL = {
  hook_decomposition: {
    visual_stop_power: 8, audio_hook_quality: 7, text_overlay_score: 5, first_words_speech_score: 6,
    weakest_modality: "text", visual_audio_coherence: 7, cognitive_load: 3,
  },
  factors: [{ name: "Completion Pull", score: 4, rationale: "drags", improvement_tip: "cut 1.2s earlier" }],
  video_signals: { visual_production_quality: 7, pacing_score: 6, transition_quality: 5 },
  content_summary: "A talking-head video",
  overall_impression: "Good",
  content_type: "talking_head",
  niche_primary_slug: "fitness",
};
const BLUEPRINTS: Record<string, SourceBlueprint> = {
  "a segment-less source": buildBlueprint(STRUCTURAL as unknown as OmniStructuralInput),
  "a timed source": buildBlueprint({
    ...STRUCTURAL,
    segments: [seg(0, 3), seg(3, 8, { on_screen_text: "WAIT" }), seg(8, 14)],
  } as unknown as OmniStructuralInput),
  "a silent source": buildBlueprint({
    ...STRUCTURAL,
    segments: [seg(0, 2, { spoken_text: null, on_screen_text: "LOOK" }), seg(2, 7, { spoken_text: null })],
  } as unknown as OmniStructuralInput),
};

/** The runner's adapt input, as `remix-runner.ts` builds it around `const profileNiche`. */
function runnerInput(
  toAdaptInput: (decode: typeof DECODE_RESULT_FIXTURE, niche: string) => AdaptInput,
  creatorOf: (row: ProfileRow | null, brief: string | null | undefined) => AdaptInput["creator"],
  row: ProfileRow | null,
  audience: Audience | null,
  brief: string | null | undefined,
  blueprint: SourceBlueprint,
): AdaptInput {
  const profileNiche = row?.niche_primary ?? "general";
  const isCalibrated = Boolean(audience && !audience.is_general);
  const audienceNiche =
    isCalibrated && audience
      ? `${profileNiche} · ${audience.name}${audience.goal_label ? ` (${audience.goal_label})` : ""}`
      : profileNiche;
  return {
    ...toAdaptInput(DECODE_RESULT_FIXTURE, audienceNiche),
    blueprint,
    target: brief ?? null,
    creator: creatorOf(row, brief),
  };
}

/** The route's adapt input, as `POST /api/remix/adapt` builds it from the wire decode. */
function routeInput(niche: string): AdaptInput {
  const { hook_pattern, structure, the_turn, emotional_beat, repeatable } = DECODE_FIXTURE;
  return { hook_pattern, structure, the_turn, emotional_beat, repeatable, niche, blueprint: emptyBlueprint(), target: null };
}

const CORPUS_ROW: SharedMatchRow = {
  id: "t1",
  similarity: 0.5,
  platform: "tiktok",
  platform_video_id: "v1",
  video_url: "https://t.example/v",
  cover_url: "https://s.example/c.jpg",
  creator_handle: "someone",
  source_pool: "curated",
  trust_weight: 1.5,
  views: 100,
  follower_count: null,
  outlier_multiplier: 5,
  baseline_label: "vs their usual views",
  engagement_rate: null,
  posted_at: null,
  proof_captured_at: null,
  niche: "fitness",
  hook_archetype: "trap-mistake",
  format: "problem-solution",
  visual_hook: null,
  editing_style: null,
  spoken_hook: "If you have X, don't do Y.",
  hook_template: "If you have [problem], don't just [fix].",
  hook_source: "caption_fallback",
  idea: { seed: "s", angle: "a", belief: "forcing posture works", reality: "it compensates", evidence: "e" },
  template: {
    name: "n",
    slots: [],
    skeleton: ["The Trap", "The Turn", "The Fix"],
    guidance: "use when the intuitive fix fails",
    beats: [{ name: "The Turn", description: "reject the intuitive fix" }],
  },
  why_it_works: "prose that must never render",
  hook_techniques: null,
};
const CORPUS_ROWS: Record<string, SharedMatchRow> = {
  "a full teardown": CORPUS_ROW,
  "a madlib only": { ...CORPUS_ROW, id: "t2", template: null, idea: null },
};
/** drop-reactions passes the audience-steered niche; lane-drops passes each lane's own niche. */
const DROP_NICHES = ["general", "food-cooking", "food-cooking · Night-shift nurses (Grow)", "budget travel"];
/** Which of the recorded briefs asks to sell (`asksToSell`): only the launch. */
const BRIEF_ASKS_TO_SELL: Record<string, boolean> = { "no brief": false, "a brief": true, "an empty brief": false };

const digest = (s: string) => `${s.length} ${createHash("sha256").update(s).digest("hex")}`;

// The recorded snapshot's entry is keyed by these two titles. Vitest writes a missing entry anew
// without failing (outside CI), so the last test below reads the file and holds its entries.
const SUITE = "remix's adapt prompt for a creator with none of the five facts: as before";
const RECORDED = "flag off: every caller's prompt is the one recorded before Task 9";

/** Every caller's prompt, keyed by case. `rowsOf` lets a case add fields to each profile row. */
async function build(flag: boolean, rowsOf: (row: ProfileRow | null) => ProfileRow | null = (row) => row) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  const { buildAdaptUserContent } = await import("@/lib/engine/remix/adapt");
  const { decodeResultToAdaptInput } = await import("@/lib/engine/remix/decode-types");
  const { corpusRowToAdaptInput } = await import("@/lib/surfaces/drop-adapt-input");
  const { remixCreatorOf } = await import("@/lib/tools/runners/remix-creator");

  const prompts: Record<string, string> = {};
  for (const [rowName, baseRow] of Object.entries(ROWS)) {
    const row = rowsOf(baseRow);
    for (const [audienceName, audience] of Object.entries(AUDIENCES)) {
      for (const [briefName, brief] of Object.entries(BRIEFS)) {
        for (const [bpName, bp] of Object.entries(BLUEPRINTS)) {
          prompts[`runner · ${rowName} · ${audienceName} · ${briefName} · ${bpName}`] = buildAdaptUserContent(
            runnerInput(decodeResultToAdaptInput, remixCreatorOf, row, audience, brief, bp),
          );
        }
      }
    }
  }
  for (const niche of ["fitness", "personal finance", "n".repeat(200)]) {
    prompts[`route · ${niche.slice(0, 20)}`] = buildAdaptUserContent(routeInput(niche));
  }
  for (const [rowName, corpusRow] of Object.entries(CORPUS_ROWS)) {
    for (const niche of DROP_NICHES) {
      prompts[`drops · ${rowName} · ${niche}`] = buildAdaptUserContent(corpusRowToAdaptInput(corpusRow, niche)!);
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
    expect(Object.keys(on)).toHaveLength(Object.keys(ROWS).length * 4 * 3 * 3 + 3 + 2 * DROP_NICHES.length);
    for (const key of Object.keys(off)) expect(on[key], key).toBe(off[key]);
  });

  it("flag off: a creator who filled all five gets the same prompts as one who filled none", async () => {
    const off = await build(false);
    const filled = await build(false, (row) => ({ ...(row ?? {}), ...FIVE_FILLED }) as ProfileRow);
    // "no row" filled in has no niche either, so it still steers to "general": the same prompt.
    for (const key of Object.keys(off)) expect(filled[key], key).toBe(off[key]);
    for (const prompt of Object.values(filled)) {
      expect(prompt).not.toContain("THE CREATOR, IN THEIR OWN WORDS");
      for (const text of Object.values(FIVE_FILLED)) expect(prompt).not.toContain(text);
    }
  });

  it("flag on: only the runner's prompt gains the creator's block, and nothing else in it moves", async () => {
    const { creatorFactsBlock } = await import("@/lib/engine/remix/adapt");
    const on = await build(true);
    const filled = await build(true, (row) => (row ? ({ ...row, ...FIVE_FILLED } as ProfileRow) : row));
    for (const key of Object.keys(on)) {
      if (key.startsWith("runner · ") && !key.startsWith("runner · no row · ")) {
        // What they sell is printed only under a brief that asks to sell: of the recorded briefs,
        // "a brief" (a launch). Without a brief, or under an empty one, the block has three facts.
        const selling = BRIEF_ASKS_TO_SELL[key.split(" · ")[3]!]!;
        const block = creatorFactsBlock({
          never: FIVE_FILLED.never_do,
          sells: selling ? FIVE_FILLED.sells : null,
          about: FIVE_FILLED.about,
          voice: FIVE_FILLED.writing_voice_description,
        });
        expect(filled[key], key).toContain(block);
        expect(filled[key]!.replace(block, ""), key).toBe(on[key]);
        expect(filled[key], key).not.toContain(FIVE_FILLED.can_film);
        if (!selling) expect(filled[key], key).not.toContain("WHAT THEY SELL");
        if (!selling) expect(filled[key], key).not.toContain(FIVE_FILLED.sells);
      } else {
        expect(filled[key], key).toBe(on[key]);
      }
    }
  });

  it("flag on: a creator whose only fact is what they sell gets the recorded prompt unless the brief asks to sell", async () => {
    const { creatorFactsBlock } = await import("@/lib/engine/remix/adapt");
    const on = await build(true);
    const sellsOnly = await build(true, (row) => (row ? ({ ...row, sells: FIVE_FILLED.sells } as ProfileRow) : row));
    const block = creatorFactsBlock({ never: null, sells: FIVE_FILLED.sells, about: null, voice: null });
    for (const key of Object.keys(on)) {
      const selling = key.startsWith("runner · ") && !key.startsWith("runner · no row · ") && BRIEF_ASKS_TO_SELL[key.split(" · ")[3]!];
      if (selling) {
        expect(sellsOnly[key], key).toContain(block);
        expect(sellsOnly[key]!.replace(block, ""), key).toBe(on[key]);
      } else {
        expect(sellsOnly[key], key).toBe(on[key]);
      }
    }
  });

  it("the inputs reach both target lines and both prompt shapes", async () => {
    // Without this a fixture drift could leave every case on one branch and the snapshot would
    // prove nothing about the other.
    const prompts = await build(false);
    const runner = (rest: string) => prompts[`runner · a full row · ${rest}`]!;
    expect(runner("a calibrated audience · no brief · a timed source")).toContain("CREATOR NICHE: food-cooking · Night-shift nurses (Grow)");
    expect(runner("no audience · a brief · a timed source")).toContain("MAKE IT ABOUT: my 12-week meal plan launch");
    expect(runner("no audience · a brief · a timed source")).toContain("TIMED BEAT MAP");
    expect(runner("no audience · a brief · a silent source")).toContain("NO SPEECH");
    expect(runner("no audience · an empty brief · a segment-less source")).not.toContain("TIMED BEAT MAP");
    expect(prompts["runner · no row · no audience · no brief · a timed source"]).toContain("CREATOR NICHE: general");
  });

  it("the recorded snapshot holds exactly its one entry: none missing, so none can be written anew unnoticed", () => {
    const snap = readFileSync(join(__dirname, "__snapshots__", "remix-prompt.unchanged.test.ts.snap"), "utf8");
    const entries = [...snap.matchAll(/^exports\[`(.*)`\] = /gm)].map((m) => m[1]);
    expect(entries).toHaveLength(1);
    expect(entries).toEqual([`${SUITE} > ${RECORDED} 1`]);
  });
});
