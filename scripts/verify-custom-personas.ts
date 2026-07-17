/**
 * verify-custom-personas.ts — Stage 1 "run it for real" gate (Audience Sim v2).
 *
 * Drives a REAL synthesis call through enrichSignature (watch/subtitle stubbed to null so we
 * exercise only the synth path) and prints the resulting personas. We are LOOKING for:
 *   - each persona has a CUSTOM display_name (not the raw archetype word) + a blurb
 *   - each persona carries scored reaction/behavior axes
 *   - the hard invariants still hold: exactly 10, one per fixed slug, shares ≈ 1
 *   - a topic_vocab is emitted
 *
 * Run:  ./node_modules/.bin/tsx scripts/verify-custom-personas.ts
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
const { ARCHETYPES } = require("../src/lib/engine/wave3/persona-registry");

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
  watchVideo: async () => null, // stub — exercise the synth path only
  fetchSubtitle: async () => null,
  onStage: (s: string) => console.log(`  [stage] ${s}`),
};

async function main() {
  console.log("Running real synthesis via enrichSignature (ADHD-productivity fixture)…\n");
  const sig = await enrichSignature(input, deps);
  const personas = sig.audience.personas as Array<Record<string, unknown>>;

  console.log(`TOPIC VOCAB: ${(sig.audience.topic_vocab ?? []).join(", ") || "(none)"}\n`);
  console.log(`PERSONAS (${personas.length}):`);
  for (const p of personas) {
    const r = (p.reaction ?? {}) as Record<string, number>;
    const name = (p.display_name as string) || "(no display_name)";
    console.log(
      `  ${String(Math.round((p.share as number) * 100)).padStart(3)}%  ${String(p.archetype).padEnd(22)} → ${name}`,
    );
    console.log(`        blurb: ${(p.blurb as string) || "(none)"}`);
    if (p.reaction) {
      console.log(
        `        axes: hook ${(r.hookSensitivity ?? 0).toFixed(2)} · novelty ${(r.noveltyBias ?? 0).toFixed(2)} · skeptic ${(r.skepticism ?? 0).toFixed(2)} · attn ${(r.attentionSpan ?? 0).toFixed(2)} · interests {${Object.keys((r.interests as object) ?? {}).join(", ")}}`,
      );
    } else {
      console.log(`        axes: (NONE — model omitted reaction)`);
    }
  }

  // Invariant checks
  const slugs = personas.map((p) => p.archetype);
  const uniqueSlugs = new Set(slugs);
  const shareSum = personas.reduce((s, p) => s + (p.share as number), 0);
  const allArchetypes = new Set(ARCHETYPES);
  const withName = personas.filter((p) => (p.display_name as string)?.length > 0).length;
  const withAxes = personas.filter((p) => p.reaction).length;
  const genericNames = personas.filter(
    (p) => String(p.display_name ?? "").toLowerCase().replace(/[_\s]/g, "") === String(p.archetype).toLowerCase().replace(/[_\s]/g, ""),
  ).length;

  console.log("\n─── INVARIANTS ───");
  console.log(`  exactly 10:            ${personas.length === 10 ? "✅" : "❌ " + personas.length}`);
  console.log(`  one per fixed slug:    ${uniqueSlugs.size === 10 && [...uniqueSlugs].every((s) => allArchetypes.has(s as never)) ? "✅" : "❌"}`);
  console.log(`  shares Σ ≈ 1:          ${Math.abs(shareSum - 1) < 0.02 ? "✅" : "❌ " + shareSum.toFixed(3)}`);
  console.log(`  custom display_names:  ${withName}/10 ${withName === 10 ? "✅" : "⚠️"}  (generic/echoed: ${genericNames})`);
  console.log(`  scored axes present:   ${withAxes}/10 ${withAxes === 10 ? "✅" : "⚠️"}`);
  console.log(`  topic_vocab emitted:   ${(sig.audience.topic_vocab ?? []).length > 0 ? "✅" : "⚠️ none"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
