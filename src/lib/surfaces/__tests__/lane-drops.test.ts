/**
 * buildLaneDrops — the day-0 lane shelf (v8 Phase 5, spec §4.2 / mock §9 right).
 *
 * Deps are injected at the I/O boundaries only (corpus, embed, adapt); the orchestration
 * — one distinct row per lane, per-lane niche steer, per-lane salvage, and the honest []
 * on failure — is the real code under test.
 *
 * ⚠️ NO SIM (owner ruling 2026-08-12): the day-0 pre-score against GENERAL_AUDIENCE is
 * dead, and the card's number is the outlier receipt off the corpus row. The "never sims"
 * test below is the guard — this producer must not grow a billable call back.
 */
import { describe, it, expect, vi } from "vitest";
import { buildLaneDrops, CARDS_PER_LANE, type BuildLaneDropsDeps } from "../lane-drops";
import type { Lane } from "@/lib/engine/lanes/lane-types";
import type { SharedMatchRow } from "@/lib/grounding/corpus";
import type { AdaptConcept } from "@/lib/engine/remix/decode-types";

const DURABLE = "https://x.supabase.co/storage/v1/object/public/covers/corpus/tiktok/1.jpg";

let seq = 0;
function corpusRow(over: Partial<SharedMatchRow> = {}): SharedMatchRow {
  return {
    id: `row-${seq++}`,
    similarity: 0.5,
    platform: "tiktok",
    platform_video_id: "v",
    video_url: "https://t/v",
    cover_url: DURABLE,
    creator_handle: "creatorhandle",
    source_pool: "curated",
    trust_weight: 1.5,
    views: 5_300_000,
    follower_count: null,
    outlier_multiplier: 5,
    baseline_label: null,
    engagement_rate: null,
    posted_at: null,
    proof_captured_at: null,
    niche: "donorfitnessniche",
    hook_archetype: `arch-${seq}`,
    format: null,
    visual_hook: null,
    editing_style: null,
    spoken_hook: "spoken line",
    hook_template: "madlib [x]",
    hook_source: null,
    idea: null,
    template: null,
    why_it_works: null,
    hook_techniques: null,
    ...over,
  } as SharedMatchRow;
}

function concept(hook: string, stops = 7): AdaptConcept {
  return {
    hook,
    angle: "an angle",
    who_its_for: "someone",
    format_borrowed: "a format",
    personaStops: stops,
  } as AdaptConcept;
}

const LANES: Lane[] = [
  { name: "The numbers person", who: "receipts, not vibes", niche: "budget receipts" },
  { name: "The skeptic", who: "calls out the industry", niche: "fintech criticism" },
];

function deps(over: BuildLaneDropsDeps = {}): BuildLaneDropsDeps {
  return {
    embed: vi.fn().mockResolvedValue([0.1, 0.2]),
    match: vi.fn().mockResolvedValue([corpusRow(), corpusRow(), corpusRow()]),
    adapt: vi.fn().mockResolvedValue([concept("adapted hook", 7)]),
    corpusClient: () => ({}) as never,
    ...over,
  } as BuildLaneDropsDeps;
}

describe("buildLaneDrops", () => {
  it("returns one shelf per lane, each carrying CARDS_PER_LANE cards", async () => {
    const shelves = await buildLaneDrops(LANES, deps());
    expect(shelves).toHaveLength(2);
    expect(shelves[0]!.lane.name).toBe("The numbers person");
    expect(shelves[0]!.cards).toHaveLength(CARDS_PER_LANE);
    expect(shelves[0]!.cards[0]!.hook).toBe("adapted hook");
  });

  it("steers each lane's adapt call with THAT lane's niche", async () => {
    const adapt = vi.fn().mockResolvedValue([concept("h")]);
    await buildLaneDrops(LANES, deps({ adapt }));
    const niches = adapt.mock.calls.map((c) => (c[0] as { niche: string }).niche);
    expect(niches).toContain("budget receipts");
    expect(niches).toContain("fintech criticism");
  });

  it("never gives two lanes the same corpus row", async () => {
    const adapt = vi.fn().mockResolvedValue([concept("h")]);
    const shelves = await buildLaneDrops(LANES, deps({ adapt }));
    const ids = shelves.flatMap((s) => s.cards.map((c) => c.contentId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("carries the outlier receipt off the row — the card's only number besides views", async () => {
    const match = vi
      .fn()
      .mockResolvedValue([corpusRow({ outlier_multiplier: 7.2, baseline_label: "vs usual" })]);
    const shelves = await buildLaneDrops(LANES, deps({ match }));
    const card = shelves[0]!.cards[0]!;
    expect(card.multiplier).toBe(7.2);
    expect(card.baselineLabel).toBe("vs usual");
  });

  it("NEVER sims a day-0 lane card — no personas, no billable reaction (2026-08-12 ruling)", async () => {
    const shelves = await buildLaneDrops(LANES, deps());
    // A pre-score against GENERAL_AUDIENCE looks personal and isn't. If this ever fails,
    // a sim came back into the producer — that is the regression, not the assertion.
    // Cast: `personas` is no longer ON LiveDropCard, and this still asserts the built
    // object doesn't smuggle one in at runtime.
    for (const s of shelves) {
      for (const card of s.cards) {
        expect((card as unknown as Record<string, unknown>).personas).toBeUndefined();
      }
    }
  });

  it("ranks concepts so the strongest adapted hook leads the card", async () => {
    const adapt = vi.fn().mockResolvedValue([concept("weak", 2), concept("strong", 9)]);
    const shelves = await buildLaneDrops(LANES, deps({ adapt }));
    expect(shelves[0]!.cards[0]!.hook).toBe("strong");
  });

  it("drops a lane whose adapt returned nothing, keeping the others", async () => {
    let call = 0;
    const adapt = vi.fn().mockImplementation(async () => (call++ === 0 ? null : [concept("h")]));
    const shelves = await buildLaneDrops(LANES, deps({ adapt }));
    expect(shelves).toHaveLength(1);
  });

  it("returns [] when the corpus read fails — never a fabricated lane", async () => {
    const match = vi.fn().mockRejectedValue(new Error("corpus down"));
    expect(await buildLaneDrops(LANES, deps({ match }))).toEqual([]);
  });

  it("returns [] for an empty lane list, without touching the corpus", async () => {
    const match = vi.fn();
    expect(await buildLaneDrops([], deps({ match }))).toEqual([]);
    expect(match).not.toHaveBeenCalled();
  });

  it("carries the source's real reach and never the donor niche", async () => {
    const shelves = await buildLaneDrops(LANES, deps());
    const card = shelves[0]!.cards[0]!;
    expect(card.views).toBe("5.3M");
    expect(JSON.stringify(card)).not.toContain("donorfitnessniche");
  });
});
