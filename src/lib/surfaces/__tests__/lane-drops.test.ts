/**
 * buildLaneDrops — the day-0 lane shelf (v8 Phase 5, spec §4.2 / mock §9 right).
 *
 * Deps are injected at the I/O boundaries only (corpus, embed, adapt, Flash); the
 * orchestration — one distinct row per lane, per-lane niche steer, ONE batched sim,
 * per-lane salvage, and the honest [] on failure — is the real code under test.
 */
import { describe, it, expect, vi } from "vitest";
import { buildLaneDrops, CARDS_PER_LANE, type BuildLaneDropsDeps } from "../lane-drops";
import type { Lane } from "@/lib/engine/lanes/lane-types";
import type { SharedMatchRow } from "@/lib/grounding/corpus";
import type { AdaptConcept } from "@/lib/engine/remix/decode-types";
import type { ReactionPersona } from "@/lib/tools/blocks";

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

const PERSONAS: ReactionPersona[] = Array.from({ length: 10 }, (_, i) => ({
  archetype: `a${i}`,
  verdict: i < 7 ? "stop" : "scroll",
  quote: i === 0 ? "that's me" : "",
})) as ReactionPersona[];

const LANES: Lane[] = [
  { name: "The numbers person", who: "receipts, not vibes", niche: "budget receipts" },
  { name: "The skeptic", who: "calls out the industry", niche: "fintech criticism" },
];

/** Supabase is only read for creator_profiles here — a thin stub is the honest boundary. */
const supabase = {
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
  }),
} as never;

function deps(over: BuildLaneDropsDeps = {}): BuildLaneDropsDeps {
  return {
    embed: vi.fn().mockResolvedValue([0.1, 0.2]),
    match: vi.fn().mockResolvedValue([corpusRow(), corpusRow(), corpusRow()]),
    adapt: vi.fn().mockResolvedValue([concept("adapted hook", 7)]),
    flashBatch: vi
      .fn()
      .mockImplementation(async (candidates: { id: string; text: string }[]) => ({
        results: new Map(candidates.map((c) => [c.id, { personas: PERSONAS }])),
        warnings: [],
      })),
    corpusClient: () => ({}) as never,
    ...over,
  } as BuildLaneDropsDeps;
}

describe("buildLaneDrops", () => {
  it("returns one shelf per lane, each carrying CARDS_PER_LANE cards", async () => {
    const shelves = await buildLaneDrops(supabase, "u1", LANES, deps());
    expect(shelves).toHaveLength(2);
    expect(shelves[0]!.lane.name).toBe("The numbers person");
    expect(shelves[0]!.cards).toHaveLength(CARDS_PER_LANE);
    expect(shelves[0]!.cards[0]!.hook).toBe("adapted hook");
    expect(shelves[0]!.cards[0]!.personas).toHaveLength(10);
  });

  it("steers each lane's adapt call with THAT lane's niche", async () => {
    const adapt = vi.fn().mockResolvedValue([concept("h")]);
    await buildLaneDrops(supabase, "u1", LANES, deps({ adapt }));
    const niches = adapt.mock.calls.map((c) => (c[0] as { niche: string }).niche);
    expect(niches).toContain("budget receipts");
    expect(niches).toContain("fintech criticism");
  });

  it("never gives two lanes the same corpus row", async () => {
    const adapt = vi.fn().mockResolvedValue([concept("h")]);
    const shelves = await buildLaneDrops(supabase, "u1", LANES, deps({ adapt }));
    const ids = shelves.flatMap((s) => s.cards.map((c) => c.contentId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fires exactly ONE batched Flash call for the whole reveal", async () => {
    const flashBatch = vi
      .fn()
      .mockImplementation(async (candidates: { id: string; text: string }[]) => ({
        results: new Map(candidates.map((c) => [c.id, { personas: PERSONAS }])),
        warnings: [],
      }));
    await buildLaneDrops(supabase, "u1", LANES, deps({ flashBatch }));
    expect(flashBatch).toHaveBeenCalledTimes(1);
  });

  it("ranks concepts so the strongest adapted hook leads the card", async () => {
    const adapt = vi.fn().mockResolvedValue([concept("weak", 2), concept("strong", 9)]);
    const shelves = await buildLaneDrops(supabase, "u1", LANES, deps({ adapt }));
    expect(shelves[0]!.cards[0]!.hook).toBe("strong");
  });

  it("drops a lane whose adapt returned nothing, keeping the others", async () => {
    let call = 0;
    const adapt = vi.fn().mockImplementation(async () => (call++ === 0 ? null : [concept("h")]));
    const shelves = await buildLaneDrops(supabase, "u1", LANES, deps({ adapt }));
    expect(shelves).toHaveLength(1);
  });

  it("returns [] when the corpus read fails — never a fabricated lane", async () => {
    const match = vi.fn().mockRejectedValue(new Error("corpus down"));
    expect(await buildLaneDrops(supabase, "u1", LANES, deps({ match }))).toEqual([]);
  });

  it("returns [] when the sim fails — a lane card without a real meter never renders", async () => {
    const flashBatch = vi.fn().mockRejectedValue(new Error("flash down"));
    expect(await buildLaneDrops(supabase, "u1", LANES, deps({ flashBatch }))).toEqual([]);
  });

  it("returns [] for an empty lane list, without touching the corpus", async () => {
    const match = vi.fn();
    expect(await buildLaneDrops(supabase, "u1", [], deps({ match }))).toEqual([]);
    expect(match).not.toHaveBeenCalled();
  });

  it("carries the source's real reach and never the donor niche", async () => {
    const shelves = await buildLaneDrops(supabase, "u1", LANES, deps());
    const card = shelves[0]!.cards[0]!;
    expect(card.views).toBe("5.3M");
    expect(JSON.stringify(card)).not.toContain("donorfitnessniche");
  });
});
