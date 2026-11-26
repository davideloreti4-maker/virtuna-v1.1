/**
 * The carousel's daily six from the collection (owner 2026-11-26): which rows qualify, what a card
 * says, and that the day — not the viewer — decides the set. Real selection code, plain rows.
 */

import { describe, expect, it } from "vitest";

import type { SharedMatchRow } from "@/lib/grounding/corpus";
import { PICK_COUNT, dailyOutlierPicks, isPickable } from "../outlier-picks";

const DURABLE = "https://x.supabase.co/storage/v1/object/public/covers/corpus/tiktok/1.jpg";
const ARCHETYPES = ["question", "bold_claim", "story", "list", "contrarian", "pov"];

let seq = 0;
function row(over: Partial<SharedMatchRow> = {}): SharedMatchRow {
  const n = seq++;
  return {
    id: `row-${n}`,
    similarity: 0,
    platform: "tiktok",
    platform_video_id: `v${n}`,
    video_url: `https://www.tiktok.com/@h/video/${n}`,
    cover_url: DURABLE,
    creator_handle: " creator ",
    source_pool: "curated",
    trust_weight: 1.5,
    views: 1_250_000,
    follower_count: null,
    outlier_multiplier: 7.5,
    baseline_label: null,
    engagement_rate: null,
    posted_at: null,
    proof_captured_at: null,
    niche: null,
    hook_archetype: ARCHETYPES[n % ARCHETYPES.length]!,
    format: null,
    visual_hook: null,
    editing_style: null,
    spoken_hook: ` Line ${n} `,
    hook_template: "madlib [x]",
    hook_source: null,
    idea: null,
    template: null,
    why_it_works: null,
    hook_techniques: null,
    ...over,
  } as SharedMatchRow;
}

describe("isPickable", () => {
  it("a TikTok outlier with a durable still, a >3× receipt, a handle, a spoken hook and a link", () => {
    expect(isPickable(row())).toBe(true);
  });

  it.each<[string, Partial<SharedMatchRow>]>([
    ["Instagram (Remix fetches TikTok only)", { platform: "instagram", video_url: "https://www.instagram.com/reel/x" }],
    ["no link to remix", { video_url: null }],
    ["a template but no spoken hook", { spoken_hook: "  " }],
    ["a receipt of 3× or less", { outlier_multiplier: 3 }],
    ["a still that is not rehosted", { cover_url: "https://p16.tiktokcdn.com/x.jpg" }],
    ["no handle", { creator_handle: null }],
  ])("not %s", (_, over) => {
    expect(isPickable(row(over))).toBe(false);
  });
});

describe("dailyOutlierPicks", () => {
  const pool = Array.from({ length: 30 }, () => row());

  it("six cards, each the source's own spoken hook, its still, link, views and receipt", () => {
    const picks = dailyOutlierPicks(pool, 20_000);
    expect(picks).toHaveLength(PICK_COUNT);
    const first = picks[0]!;
    const source = pool.find((r) => r.id === first.contentId)!;
    expect(first).toEqual({
      contentId: source.id,
      hook: source.spoken_hook!.trim(),
      coverUrl: DURABLE,
      videoUrl: source.video_url,
      views: "1.3M",
      multiplier: 7.5,
      handle: "creator",
    });
    expect(new Set(picks.map((p) => p.contentId)).size).toBe(PICK_COUNT);
  });

  it("the day decides the set: the same day gives the same six, the next day another six", () => {
    const today = dailyOutlierPicks(pool, 20_000).map((p) => p.contentId);
    expect(dailyOutlierPicks([...pool].reverse(), 20_000).map((p) => p.contentId)).toEqual(today);
    const tomorrow = dailyOutlierPicks(pool, 20_001).map((p) => p.contentId);
    expect(tomorrow.some((id) => !today.includes(id))).toBe(true);
  });

  it("only pickable rows ever show", () => {
    const mixed = [...pool, ...Array.from({ length: 30 }, () => row({ platform: "instagram" }))];
    for (let day = 0; day < 20; day++) {
      for (const pick of dailyOutlierPicks(mixed, day)) {
        expect(pool.some((r) => r.id === pick.contentId)).toBe(true);
      }
    }
  });

  it("nothing pickable: no cards", () => {
    expect(dailyOutlierPicks([row({ spoken_hook: null })], 1)).toEqual([]);
  });
});
