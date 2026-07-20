/**
 * corpus-rpc-params.test.ts — the match wrappers forward EVERY filter to the RPC.
 *
 * Why exact-object (not objectContaining): the 2026-07-19 facet migration added
 * filter_format / filter_visual / filter_editing. A wrapper that silently drops
 * one still passes an objectContaining check — PostgREST would then reject the
 * call (missing arg) or, worse under a future default, silently not filter.
 * Pinning the full payload makes a dropped or misnamed param fail loudly.
 * (This test fails against the pre-migration wrappers by construction.)
 *
 * 2026-07-20: filter_hook_technique / filter_hook_family joined the shared RPC. The personal RPC
 * deliberately does NOT get them — the Sandcastles collection taxonomy is a property of the CURATED
 * library, and a creator's own uploaded videos were never catalogued by it.
 */

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { matchSharedTeardowns, matchPersonalTeardowns } from "../corpus";

function fakeSupabase() {
  const rpc = vi.fn(async () => ({ data: [], error: null }));
  return { supabase: { rpc } as unknown as SupabaseClient, rpc };
}

const EMB = [0.1, 0.2];

describe("matchSharedTeardowns → match_shared_teardowns params", () => {
  it("forwards all filters when set", async () => {
    const { supabase, rpc } = fakeSupabase();
    await matchSharedTeardowns(supabase, {
      embedding: EMB,
      count: 5,
      filterNiche: "health-fitness",
      excludeNiche: "other",
      filterPlatform: "tiktok",
      filterArchetype: "contrarian",
      filterSourcePool: "curated",
      filterFormat: "breakdowns-explainers",
      filterVisual: "greenscreen",
      filterEditing: "visual-greenscreen",
      filterHookTechnique: "camera-whip",
      filterHookFamily: "subject-motion",
    });
    expect(rpc).toHaveBeenCalledWith("match_shared_teardowns", {
      query_embedding: EMB,
      match_count: 5,
      filter_niche: "health-fitness",
      exclude_niche: "other",
      filter_platform: "tiktok",
      filter_archetype: "contrarian",
      filter_source_pool: "curated",
      filter_format: "breakdowns-explainers",
      filter_visual: "greenscreen",
      filter_editing: "visual-greenscreen",
      // The first-frame TECHNIQUE gates (teardown_collections). Distinct from filter_visual, which
      // is the staging — the whole point of the 2026-07-20 axis split.
      filter_hook_technique: "camera-whip",
      filter_hook_family: "subject-motion",
    });
  });

  it("sends explicit nulls (not absent keys) when filters are omitted", async () => {
    const { supabase, rpc } = fakeSupabase();
    await matchSharedTeardowns(supabase, { embedding: EMB, count: 3 });
    expect(rpc).toHaveBeenCalledWith("match_shared_teardowns", {
      query_embedding: EMB,
      match_count: 3,
      filter_niche: null,
      exclude_niche: null,
      filter_platform: null,
      filter_archetype: null,
      filter_source_pool: null,
      filter_format: null,
      filter_visual: null,
      filter_editing: null,
      filter_hook_technique: null,
      filter_hook_family: null,
    });
  });
});

describe("matchPersonalTeardowns → match_personal_teardowns params", () => {
  it("forwards all filters when set", async () => {
    const { supabase, rpc } = fakeSupabase();
    await matchPersonalTeardowns(supabase, {
      embedding: EMB,
      userId: "u-1",
      count: 4,
      filterNiche: "finance",
      filterPlatform: "instagram",
      filterArchetype: "tutorial",
      filterFormat: "tier-list",
      filterVisual: "studio_set",
      filterEditing: "split-screen",
    });
    expect(rpc).toHaveBeenCalledWith("match_personal_teardowns", {
      query_embedding: EMB,
      match_user_id: "u-1",
      match_count: 4,
      filter_niche: "finance",
      filter_platform: "instagram",
      filter_archetype: "tutorial",
      filter_format: "tier-list",
      filter_visual: "studio_set",
      filter_editing: "split-screen",
    });
  });

  it("sends explicit nulls when filters are omitted", async () => {
    const { supabase, rpc } = fakeSupabase();
    await matchPersonalTeardowns(supabase, { embedding: EMB, userId: "u-1", count: 2 });
    expect(rpc).toHaveBeenCalledWith("match_personal_teardowns", {
      query_embedding: EMB,
      match_user_id: "u-1",
      match_count: 2,
      filter_niche: null,
      filter_platform: null,
      filter_archetype: null,
      filter_format: null,
      filter_visual: null,
      filter_editing: null,
    });
  });
});
