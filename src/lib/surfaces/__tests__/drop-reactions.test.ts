import { describe, it, expect } from "vitest";
import { buildLiveDrops, DROP_TARGET, type BuildDropsDeps } from "../drop-reactions";
import type { SharedMatchRow } from "@/lib/grounding/corpus";
import type { Audience } from "@/lib/audience/audience-types";
import type { AdaptConcept } from "@/lib/engine/remix/decode-types";
import type { ReactionPersona } from "@/lib/tools/blocks";

const DURABLE =
  "https://x.supabase.co/storage/v1/object/public/covers/corpus/tiktok/1.jpg";

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

/** 20-row drop-ready pool across distinct archetypes. */
function pool(): SharedMatchRow[] {
  return Array.from({ length: 20 }, () => corpusRow());
}

const generalAudience = { id: "gen", is_general: true, name: "General" } as unknown as Audience;

function concepts(prefix: string): AdaptConcept[] {
  return [
    { hook: `${prefix} strong`, angle: "a1", who_its_for: "w1", format_borrowed: "f1", personaStops: 8, stopQuote: "q1" },
    { hook: `${prefix} mid`, angle: "a2", who_its_for: "w2", format_borrowed: "f2", personaStops: 5, stopQuote: "q2" },
    { hook: `${prefix} weak`, angle: "a3", who_its_for: "w3", format_borrowed: "f3", personaStops: 2, stopQuote: "q3" },
  ];
}

const personas: ReactionPersona[] = [
  { archetype: "a", verdict: "stop", quote: "real quote" },
];

/** Chainable supabase fake: surface_reactions read returns `surfaceRow`; upserts recorded. */
function fakeSupabase(surfaceRow: unknown = null) {
  const upserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const client = {
    upserts,
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({
          data: table === "surface_reactions" ? surfaceRow : null,
          error: null,
        }),
        upsert: async (row: Record<string, unknown>) => {
          upserts.push({ table, row });
          return { error: null };
        },
      };
      return chain;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as any;
}

/** Deps with call recording. `adaptFor` lets a test fail specific rows. */
function fakeDeps(over: Partial<BuildDropsDeps> = {}) {
  const calls = { embed: 0, match: 0, adapt: 0, flash: 0 };
  const deps: BuildDropsDeps = {
    resolveAudience: async () => generalAudience,
    embed: async () => {
      calls.embed++;
      return [0.1, 0.2];
    },
    match: async () => {
      calls.match++;
      return pool();
    },
    adapt: async (input) => {
      calls.adapt++;
      return concepts(input.niche);
    },
    flashBatch: (async (candidates: Array<{ id: string; text: string }>) => {
      calls.flash++;
      return {
        results: new Map(candidates.map((c) => [c.id, { personas }])),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    corpusClient: (() => ({})) as any,
    ...over,
  };
  return { deps, calls };
}

describe("buildLiveDrops", () => {
  it("builds ≤6 cards: rank-1 concept leads, real personas attached, cache upserted under kind 'drop'", async () => {
    const supabase = fakeSupabase();
    const { deps, calls } = fakeDeps();
    const cards = await buildLiveDrops(supabase, "u1", deps);
    expect(cards).toHaveLength(DROP_TARGET);
    for (const card of cards) {
      expect(card.hook).toMatch(/ strong$/); // personaStops 8 ranks first
      expect(card.concepts).toHaveLength(3);
      expect(card.concepts[0]!.personaStops).toBe(8);
      expect(card.personas).toEqual(personas);
      expect(card.coverUrl).toBe(DURABLE);
      expect(card.views).toBe("5.3M");
      expect(card.viewsRaw).toBe(5_300_000);
      expect(card.handle).toBe("creatorhandle");
    }
    expect(calls.adapt).toBe(DROP_TARGET);
    expect(calls.flash).toBe(1); // ONE batched sim
    expect(supabase.upserts).toHaveLength(1);
    expect(supabase.upserts[0].row.kind).toBe("drop");
  });

  it("returns the cached batch untouched on a fresh cache hit (no adapt/sim calls)", async () => {
    const cached = [{ contentId: "c1", hook: "cached" }];
    const supabase = fakeSupabase({ cards: cached, updated_at: new Date().toISOString() });
    const { deps, calls } = fakeDeps();
    const cards = await buildLiveDrops(supabase, "u1", deps);
    expect(cards).toEqual(cached);
    expect(calls.embed).toBe(0);
    expect(calls.adapt).toBe(0);
    expect(calls.flash).toBe(0);
  });

  it("drops a row whose adapt returned null and ships the survivors", async () => {
    let n = 0;
    const { deps } = fakeDeps({
      adapt: async (input) => (++n === 2 ? null : concepts(input.niche)),
    });
    const cards = await buildLiveDrops(fakeSupabase(), "u1", deps);
    expect(cards).toHaveLength(DROP_TARGET - 1);
  });

  it("drops a row missing from the flash result map (per-candidate salvage)", async () => {
    const { deps } = fakeDeps({
      flashBatch: (async (candidates: Array<{ id: string; text: string }>) => ({
        results: new Map(candidates.slice(1).map((c) => [c.id, { personas }])),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any,
    });
    const cards = await buildLiveDrops(fakeSupabase(), "u1", deps);
    expect(cards).toHaveLength(DROP_TARGET - 1);
  });

  it("returns [] when the batched sim throws (honest empty — never a fabricated meter)", async () => {
    const { deps } = fakeDeps({
      flashBatch: (async () => {
        throw new Error("flash down");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    });
    expect(await buildLiveDrops(fakeSupabase(), "u1", deps)).toEqual([]);
  });

  it("returns [] when embedding fails", async () => {
    const { deps, calls } = fakeDeps({
      embed: async () => {
        throw new Error("embed down");
      },
    });
    expect(await buildLiveDrops(fakeSupabase(), "u1", deps)).toEqual([]);
    expect(calls.adapt).toBe(0);
  });

  it("never leaks donor niche into a card", async () => {
    const { deps } = fakeDeps();
    const cards = await buildLiveDrops(fakeSupabase(), "u1", deps);
    expect(JSON.stringify(cards)).not.toContain("donorfitnessniche");
  });
});
