/**
 * verify-population.ts — Stage 2 "run it for real" GO/NO-GO gate (Audience Sim v2).
 *
 * The spike proved the population math on SPIKE-shaped segments. This proves it on a REAL
 * baked signature: bake via enrichSignature (real synth, watch/subtitle stubbed), then for a
 * few hooks characterize the content (1 LLM call) and score all 1,000 sampled individuals with
 * the pure scorer. We are LOOKING for:
 *   - a believable OVERALL stop% (postable hooks land ~30–60%, not 0% or 100%)
 *   - DIFFERENTIATION: different hooks light up DIFFERENT segments (the lead rotates)
 *   - the 0%-segments ROTATE by hook rather than a fixed collapse
 *   - the dominant "why" flips sensibly (strong-hook vs interest)
 * If the real axes produce mush, we STOP and fix the generator — do not wire it.
 *
 * Run:  ./node_modules/.bin/tsx scripts/verify-population.ts
 * Cost: 1 synth call (bake) + 3 characterization calls. ~cents.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { register } from "tsconfig-paths";
import tsconfig from "../tsconfig.json";

config({ path: resolve(__dirname, "../.env.local") });
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths as Record<string, string[]>,
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { enrichSignature } = require("../src/lib/audience/enrich-signature");
const { characterizeContent } = require("../src/lib/audience/characterize-content");
const {
  reactPopulation,
  signatureHasPopulationAxes,
} = require("../src/lib/audience/population");

function makeVideo(i: number, views: number, saves: number, shares: number) {
  return {
    platformVideoId: `vid_${i}`,
    videoUrl: `https://www.tiktok.com/@testcreator/video/${i}`,
    caption: `Caption ${i} #adhd #productivity`,
    views,
    likes: Math.round(views * 0.05),
    comments: Math.round(views * 0.01),
    shares,
    saves,
    hashtags: ["adhd", "productivity"],
    durationSeconds: 30,
    postedAt: new Date("2026-06-01"),
    subtitleUrl: `https://www.tiktok.com/subs/${i}.vtt`,
    mediaUrl: `https://api.apify.com/v2/key-value-stores/abc/records/video-${i}`,
  };
}

const input = {
  handle: "testcreator",
  profile: {
    handle: "testcreator",
    displayName: "Test Creator",
    bio: "ADHD productivity & fast systems for founders",
    avatarUrl: "https://example.com/a.jpg",
    verified: true,
    followerCount: 142_000,
    followingCount: 300,
    heartCount: 3_200_000,
    videoCount: 87,
  },
  videos: [
    makeVideo(0, 500_000, 22_000, 8_000),
    makeVideo(1, 120_000, 3_000, 900),
    makeVideo(2, 80_000, 6_500, 400),
    makeVideo(3, 40_000, 400, 60),
  ],
  subCoverage: "0/4",
  goalIntent: "grow",
};

const deps = {
  watchVideo: async () => null,
  fetchSubtitle: async () => null,
  onStage: (s: string) => console.log(`  [stage] ${s}`),
};

const HOOKS = [
  "I deleted every productivity app and ran my whole life on one index card for 30 days.", // relatable transformation
  "The exact Notion schema I use to run 4 businesses — screen recording, no talking, no music.", // niche-deep systems, slow
  "POV: your ADHD brain at 2am remembering that embarrassing thing from 2019.", // relatable humor spectacle
];

async function main() {
  console.log("Baking a REAL signature via enrichSignature (ADHD-productivity fixture)…\n");
  const sig = await enrichSignature(input, deps);

  console.log(`\nTOPIC VOCAB: ${(sig.audience.topic_vocab ?? []).join(", ") || "(none)"}`);
  console.log(`hasPopulationAxes: ${signatureHasPopulationAxes(sig) ? "✅" : "❌ — CANNOT run population"}`);
  console.log(`\nSEGMENTS (the 10 fixed slots, custom-labelled):`);
  for (const p of sig.audience.personas as Array<Record<string, unknown>>) {
    const r = (p.reaction ?? {}) as Record<string, number>;
    console.log(
      `  ${String(Math.round((p.share as number) * 100)).padStart(3)}%  ${((p.display_name as string) || p.archetype).padEnd(30)} ` +
        `hook ${(r.hookSensitivity ?? 0).toFixed(2)} · attn ${(r.attentionSpan ?? 0).toFixed(2)} · ` +
        `skeptic ${(r.skepticism ?? 0).toFixed(2)} · interests {${Object.keys((r.interests as object) ?? {}).join(", ")}}`,
    );
  }

  if (!signatureHasPopulationAxes(sig)) {
    console.log("\n❌ NO-GO: the baked signature lacks v2 axes. Fix the generator before wiring.");
    process.exit(1);
  }

  for (const hook of HOOKS) {
    const cv = await characterizeContent(hook, sig.audience.topic_vocab ?? []);
    const agg = reactPopulation(sig, cv, { N: 1000, seed: 12345 });
    console.log(`\n${"─".repeat(76)}`);
    console.log(`HOOK: "${hook}"`);
    console.log(
      `  content: topics{${Object.entries(cv.topics)
        .map(([k, v]) => `${k}:${(v as number).toFixed(1)}`)
        .join(" ")}} hook ${cv.hookStrength.toFixed(2)} nov ${cv.novelty.toFixed(2)} hype ${cv.hype.toFixed(2)} slow ${cv.slowness.toFixed(2)}`,
    );
    console.log(`  ► OVERALL: ${agg.stop}/${agg.total} keep watching (${agg.stopPct}%)`);
    for (const s of agg.segments) {
      console.log(`      ${String(s.stopPct + "%").padStart(4)}  ${s.displayName}  (${s.stop}/${s.total})`);
    }
    console.log(`  why: ${agg.reasons.map((r: { reason: string; count: number }) => `${r.reason}(${r.count})`).join(", ")}`);
  }

  console.log(`\n${"─".repeat(76)}`);
  console.log("LOOK FOR: overall 30–60% on postable hooks · the LEAD segment ROTATES by hook ·");
  console.log("          0%-segments rotate (not a fixed collapse) · why flips strong-hook↔interest.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
