/**
 * rollupReadsForAudience — the /audience workspace's data spine (ROLLUP-01, P2).
 *
 * These tests are aimed at the bug class this subsystem keeps shipping: THE ONE INPUT THAT
 * MAKES THE FEATURE THE FEATURE, DROPPED IN SILENCE, WITH EVERY TEST GREEN. So they assert
 * the shape the CALLER ACTUALLY WRITES, not a convenient one:
 *
 *  - the persisted body is `{kcGenVersion, blocks:[…]}`, NOT a bare array. Every Read in the
 *    live DB (7/7) uses the wrapper, because every tools route passes a KC stamp. A rollup
 *    that only understands the array shape returns 0 and looks exactly like "no Reads yet".
 *  - attribution is by `audienceId`, NEVER by `name`. A same-name/different-id block must NOT
 *    be counted, and a different-name/same-id block MUST be — that is the whole point of the
 *    id, and a name-keyed implementation passes every other test in this file.
 *  - a single-audience Read is compared against NOTHING and must never be scored as agreement.
 *  - pre-ROLLUP-01 blocks carry no id: they are reported, never guessed at.
 *
 * Bands only (F3) — no assertion here should ever involve a numeric score.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rollupReadsForAudience, SCAN_LIMIT } from "../read-rollup";

const MINE = "aud-mine-uuid";
const OTHER = "general";

interface EntrySpec {
  name: string;
  audienceId?: string;
  band: "Strong" | "Mixed" | "Weak";
  personas?: Array<{ archetype: string; verdict: "stop" | "scroll"; quote: string }>;
}

/** A schema-valid `multi-audience-read` block — the exact shape runTwoAudienceRead emits. */
function makeBlock(entries: EntrySpec[], concept?: string) {
  return {
    type: "multi-audience-read",
    props: {
      audiences: entries.map((e) => ({
        name: e.name,
        ...(e.audienceId ? { audienceId: e.audienceId } : {}),
        band: e.band,
        fraction: "6/10 stop",
        interpretation: `${e.name} splits (${e.band}).`,
        lever: "Sharpen the hook.",
        whoNotFor: "",
        personas: e.personas ?? [{ archetype: "skeptic", verdict: "scroll", quote: "Seen it." }],
      })),
      model: "sim1-flash",
      ...(concept ? { concept } : {}),
    },
  };
}

/** THE REAL WRITE SHAPE: insertMessage wraps blocks whenever a KC stamp is passed — always. */
function wrapped(blocks: unknown[]) {
  return { kcGenVersion: "kc-2026-07-01", blocks };
}

interface Row {
  id: string;
  created_at: string;
  body: unknown;
}

function makeSupabase(rows: Row[], error: { message: string } | null = null) {
  const calls: Array<[string, unknown]> = [];
  const builder = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      calls.push([col, val]);
      return builder;
    },
    order: () => builder,
    limit: () => Promise.resolve({ data: rows, error }),
  };
  return {
    supabase: { from: () => builder } as unknown as SupabaseClient,
    eqCalls: () => calls,
  };
}

describe("rollupReadsForAudience", () => {
  it("reads blocks out of the {kcGenVersion, blocks} WRAPPER — the shape every live Read uses", async () => {
    // If this regresses, the endpoint returns an empty rollup that is indistinguishable from
    // a user who has never run a Read. All 7 blocks in the live DB are in this shape.
    const { supabase } = makeSupabase([
      {
        id: "m1",
        created_at: "2026-07-14T10:00:00Z",
        body: wrapped([makeBlock([{ name: "Zach King", audienceId: MINE, band: "Strong" }])]),
      },
    ]);

    const rollup = await rollupReadsForAudience(supabase, MINE);

    expect(rollup.reads).toBe(1);
  });

  it("also reads the bare-array body shape (unstamped writes)", async () => {
    const { supabase } = makeSupabase([
      {
        id: "m1",
        created_at: "2026-07-14T10:00:00Z",
        body: [makeBlock([{ name: "Zach King", audienceId: MINE, band: "Strong" }])],
      },
    ]);

    expect((await rollupReadsForAudience(supabase, MINE)).reads).toBe(1);
  });

  it("attributes by ID, not by NAME — a renamed audience keeps its history", async () => {
    // Same audience (id), different display name than the one it was read under.
    const { supabase } = makeSupabase([
      {
        id: "m1",
        created_at: "2026-07-14T10:00:00Z",
        body: wrapped([makeBlock([{ name: "Old Name", audienceId: MINE, band: "Mixed" }])]),
      },
    ]);

    expect((await rollupReadsForAudience(supabase, MINE)).reads).toBe(1);
  });

  it("does NOT attribute a DIFFERENT audience that happens to share the name", async () => {
    // The name-keyed implementation passes every other test in this file and fails this one.
    // Deleting an audience and recreating one under the same name must not inherit its Reads.
    const { supabase } = makeSupabase([
      {
        id: "m1",
        created_at: "2026-07-14T10:00:00Z",
        body: wrapped([
          makeBlock([{ name: "My Audience", audienceId: "some-other-uuid", band: "Strong" }]),
        ]),
      },
    ]);

    const rollup = await rollupReadsForAudience(supabase, MINE);

    expect(rollup.reads).toBe(0);
    // It belongs to a real other audience — it is NOT a legacy un-attributed block.
    expect(rollup.legacyUnattributed).toBe(0);
  });

  it("EXCLUDES pre-ROLLUP-01 blocks (no id anywhere) and reports them out loud", async () => {
    // These 7 live blocks predate #281: both sides ran the identical prompt, so their
    // "agreement" is an artifact. Counting them would render a bug as a finding.
    const { supabase } = makeSupabase([
      {
        id: "m1",
        created_at: "2026-07-13T12:16:00Z",
        body: wrapped([
          makeBlock([
            { name: "Fitness Creators", band: "Strong" },
            { name: "General", band: "Strong" },
          ]),
        ]),
      },
    ]);

    const rollup = await rollupReadsForAudience(supabase, MINE);

    expect(rollup.reads).toBe(0);
    expect(rollup.compared).toBe(0);
    expect(rollup.legacyUnattributed).toBe(1);
  });

  it("counts a two-sided Read where the bands DIFFER as a divergence", async () => {
    const { supabase } = makeSupabase([
      {
        id: "m1",
        created_at: "2026-07-14T10:00:00Z",
        body: wrapped([
          makeBlock(
            [
              { name: "Zach King", audienceId: MINE, band: "Weak" },
              { name: "General", audienceId: OTHER, band: "Strong" },
            ],
            "a magic trick with a jump cut",
          ),
        ]),
      },
    ]);

    const rollup = await rollupReadsForAudience(supabase, MINE);

    expect(rollup.compared).toBe(1);
    expect(rollup.diverged).toBe(1);
    expect(rollup.cases).toHaveLength(1);
    expect(rollup.cases[0]).toMatchObject({
      concept: "a magic trick with a jump cut",
      agreed: false,
      mine: { name: "Zach King", band: "Weak" },
      other: { name: "General", band: "Strong" },
    });
  });

  it("counts matching bands as agreement, not divergence", async () => {
    const { supabase } = makeSupabase([
      {
        id: "m1",
        created_at: "2026-07-14T10:00:00Z",
        body: wrapped([
          makeBlock([
            { name: "Zach King", audienceId: MINE, band: "Mixed" },
            { name: "General", audienceId: OTHER, band: "Mixed" },
          ]),
        ]),
      },
    ]);

    const rollup = await rollupReadsForAudience(supabase, MINE);

    expect(rollup.compared).toBe(1);
    expect(rollup.diverged).toBe(0);
    expect(rollup.cases[0]?.agreed).toBe(true);
  });

  it("never scores a SINGLE-audience Read as agreement — it was compared against nothing", async () => {
    // The self-pair collapse (two-audience-read.ts) emits ONE entry. It contributes persona
    // reactions but must not manufacture a second opinion that was never asked for.
    const { supabase } = makeSupabase([
      {
        id: "m1",
        created_at: "2026-07-14T10:00:00Z",
        body: wrapped([makeBlock([{ name: "Zach King", audienceId: MINE, band: "Strong" }])]),
      },
    ]);

    const rollup = await rollupReadsForAudience(supabase, MINE);

    expect(rollup.reads).toBe(1);
    expect(rollup.compared).toBe(0);
    expect(rollup.diverged).toBe(0);
    expect(rollup.cases).toHaveLength(0);
  });

  it("keeps each persona's LATEST reaction and drops the stale one", async () => {
    const { supabase } = makeSupabase([
      {
        id: "m2", // newest first — this is the order the query returns
        created_at: "2026-07-14T12:00:00Z",
        body: wrapped([
          makeBlock([
            {
              name: "Zach King",
              audienceId: MINE,
              band: "Strong",
              personas: [{ archetype: "skeptic", verdict: "stop", quote: "Okay, that got me." }],
            },
          ]),
        ]),
      },
      {
        id: "m1",
        created_at: "2026-07-14T09:00:00Z",
        body: wrapped([
          makeBlock([
            {
              name: "Zach King",
              audienceId: MINE,
              band: "Weak",
              personas: [{ archetype: "skeptic", verdict: "scroll", quote: "Stale take." }],
            },
          ]),
        ]),
      },
    ]);

    const rollup = await rollupReadsForAudience(supabase, MINE);

    expect(rollup.reads).toBe(2);
    expect(rollup.personas).toHaveLength(1);
    expect(rollup.personas[0]).toMatchObject({
      archetype: "skeptic",
      verdict: "stop",
      quote: "Okay, that got me.",
      at: "2026-07-14T12:00:00Z",
    });
  });

  it("skips non-Read blocks and unparseable rows without dropping the rest", async () => {
    const { supabase } = makeSupabase([
      { id: "m1", created_at: "2026-07-14T10:00:00Z", body: wrapped([{ type: "markdown", props: { text: "hi" } }]) },
      { id: "m2", created_at: "2026-07-14T09:00:00Z", body: null },
      { id: "m3", created_at: "2026-07-14T08:00:00Z", body: wrapped([{ type: "multi-audience-read", props: { junk: true } }]) },
      {
        id: "m4",
        created_at: "2026-07-14T07:00:00Z",
        body: wrapped([makeBlock([{ name: "Zach King", audienceId: MINE, band: "Strong" }])]),
      },
    ]);

    const rollup = await rollupReadsForAudience(supabase, MINE);

    expect(rollup.reads).toBe(1);
    expect(rollup.scanned).toBe(4);
  });

  it("scans only ASSISTANT messages and reports an un-capped scan honestly", async () => {
    const { supabase, eqCalls } = makeSupabase([]);

    const rollup = await rollupReadsForAudience(supabase, MINE);

    expect(eqCalls()).toContainEqual(["role", "assistant"]);
    expect(rollup.scanCapped).toBe(false);
    expect(rollup.reads).toBe(0);
  });

  it("flags scanCapped when the window is full — older Reads exist beyond it", async () => {
    const rows: Row[] = Array.from({ length: SCAN_LIMIT }, (_, i) => ({
      id: `m${i}`,
      created_at: "2026-07-14T10:00:00Z",
      body: wrapped([]),
    }));
    const { supabase } = makeSupabase(rows);

    expect((await rollupReadsForAudience(supabase, MINE)).scanCapped).toBe(true);
  });

  it("catches persona flips even when the BANDS COLLIDE — offsetting flips are still disagreement", async () => {
    // OBSERVED LIVE (2026-07-14, the first real Read of this feature): Zach King and General
    // BOTH landed Strong at 7/10 — while flatly disagreeing about who stopped. A band-only
    // panel calls this "agreed" and throws the actual finding away.
    const { supabase } = makeSupabase([
      {
        id: "m1",
        created_at: "2026-07-14T10:00:00Z",
        body: wrapped([
          makeBlock([
            {
              name: "Zach King",
              audienceId: MINE,
              band: "Strong",
              personas: [
                { archetype: "niche_deep_buyer", verdict: "stop", quote: "The wire — where is it?" },
                { archetype: "tough_crowd", verdict: "scroll", quote: "Seen this trick." },
                { archetype: "lurker", verdict: "stop", quote: "Satisfying." },
              ],
            },
            {
              name: "General",
              audienceId: OTHER,
              band: "Strong", // SAME band — the flips below cancel out in the aggregate
              personas: [
                { archetype: "niche_deep_buyer", verdict: "scroll", quote: "Not for me." },
                { archetype: "tough_crowd", verdict: "stop", quote: "Okay that's clever." },
                { archetype: "lurker", verdict: "stop", quote: "Satisfying." },
              ],
            },
          ]),
        ]),
      },
    ]);

    const rollup = await rollupReadsForAudience(supabase, MINE);

    expect(rollup.compared).toBe(1);
    expect(rollup.diverged).toBe(0); // the aggregate band agreed …
    expect(rollup.personaDiverged).toBe(1); // … but the people did NOT
    expect(rollup.cases[0]?.agreed).toBe(true);
    expect(rollup.cases[0]?.personaFlips).toEqual([
      { archetype: "niche_deep_buyer", mine: "stop", other: "scroll" },
      { archetype: "tough_crowd", mine: "scroll", other: "stop" },
    ]);
  });

  it("pairs personas by ARCHETYPE, not array position — a reordered side invents no flips", async () => {
    // The two sides are INDEPENDENT Flash runs with no ordering guarantee. Zipping by index
    // would compare a saver against a lurker and fabricate flips that never happened.
    const { supabase } = makeSupabase([
      {
        id: "m1",
        created_at: "2026-07-14T10:00:00Z",
        body: wrapped([
          makeBlock([
            {
              name: "Zach King",
              audienceId: MINE,
              band: "Mixed",
              personas: [
                { archetype: "saver", verdict: "stop", quote: "Saving this." },
                { archetype: "lurker", verdict: "scroll", quote: "Meh." },
              ],
            },
            {
              name: "General",
              audienceId: OTHER,
              band: "Mixed",
              personas: [
                // same verdicts, REVERSED order
                { archetype: "lurker", verdict: "scroll", quote: "Meh." },
                { archetype: "saver", verdict: "stop", quote: "Saving this." },
              ],
            },
          ]),
        ]),
      },
    ]);

    const rollup = await rollupReadsForAudience(supabase, MINE);

    expect(rollup.cases[0]?.personaFlips).toEqual([]);
    expect(rollup.personaDiverged).toBe(0);
  });

  it("skips an archetype the other side never rated rather than guessing a flip", async () => {
    const { supabase } = makeSupabase([
      {
        id: "m1",
        created_at: "2026-07-14T10:00:00Z",
        body: wrapped([
          makeBlock([
            {
              name: "Zach King",
              audienceId: MINE,
              band: "Mixed",
              personas: [{ archetype: "only_mine", verdict: "stop", quote: "Love it." }],
            },
            {
              name: "General",
              audienceId: OTHER,
              band: "Mixed",
              personas: [{ archetype: "only_theirs", verdict: "scroll", quote: "Nope." }],
            },
          ]),
        ]),
      },
    ]);

    const rollup = await rollupReadsForAudience(supabase, MINE);

    expect(rollup.cases[0]?.personaFlips).toEqual([]);
    expect(rollup.personaDiverged).toBe(0);
  });

  it("throws on a query error rather than reporting an empty history", async () => {
    const { supabase } = makeSupabase([], { message: "boom" });

    await expect(rollupReadsForAudience(supabase, MINE)).rejects.toThrow(/boom/);
  });
});
