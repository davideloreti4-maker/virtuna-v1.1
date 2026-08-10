/**
 * adapt-deep-anatomy.test.ts — C3 remainder: the deep anatomy reaches the script BRIEFER.
 *
 * Measured 2026-08-10 (SQL over the live corpus): `template.beats` is populated AND timed on
 * 504/532 rows and already renders in the raw script slice — the proposal's "never rendered"
 * claim was stale for names/timings. What genuinely never reached any model:
 *
 *   1. the TIMINGS in the briefer's decode view — renderExemplar rendered beats as
 *      "name — description" while its own brief header claims "torn down to the timed rhythm"
 *   2. `teardown.narrative_structure.structure_sections[].transcript_sentences` — what the
 *      outlier actually SAID per timed beat (the per-beat content density/pacing evidence)
 *
 * The transcripts feed the BRIEFER ONLY, never the raw slice and never the writer: showing a
 * writer proven verbatim lines is the MEASURED drift cause the hooks surface flag exists for
 * (AB-GROUNDING-BLIND-2026-07-14). The briefer re-voices by design (provenance-by-chain), so
 * it may study the words; the fitted arc it emits must not contain them.
 */

import { describe, it, expect, vi } from "vitest";
import { adaptCorpusBlock, type AdaptComplete, type AdaptCorpusInput } from "../adapt";
import { fetchBeatTranscripts } from "../corpus";
import { gatherCorpusForRun } from "../gather-for-run";
import type { RetrievedExample, TeardownBeat } from "../types";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function example(id: string, beats: TeardownBeat[]): RetrievedExample {
  return {
    teardownId: id,
    handle: `maker_${id}`,
    videoUrl: `https://tiktok.com/@maker/video/${id}`,
    coverUrl: null,
    platform: "tiktok",
    multiplier: 12,
    views: 1_000_000,
    baselineLabel: "vs followers",
    fitLabel: "adjacent",
    hookArchetype: "contrarian",
    format: "breakdowns-explainers",
    visualSetting: "studio_set",
    editingStyle: "office-room-yap",
    hookTechniques: [],
    niche: "health-fitness",
    similarity: 0.71,
    spokenHook: `spoken ${id}`,
    hookTemplate: null,
    template: {
      name: "binary-question-reveal",
      slots: [],
      skeleton: beats.map((b) => b.name),
      guidance: "when the subject splits into a clean either/or",
      beats,
    },
    idea: null,
    whyItWorks: `why ${id}`,
    sourcePool: "curated",
    trustWeight: 1,
    fromPersonal: false,
  };
}

const TIMED_BEATS: TeardownBeat[] = [
  { name: "The Hook", description: "Pose a binary question.", startSec: 0, endSec: 2 },
  { name: "The Breakdown", description: "Walk the evidence.", startSec: 2, endSec: 21 },
];

function scriptInput(examples: RetrievedExample[]): AdaptCorpusInput {
  return {
    skill: "script",
    ask: "why lifting heavy beats cardio",
    niche: "health-fitness",
    platform: "tiktok",
    profile: { niche_primary: "health-fitness", writing_voice_sample: "plain, direct" },
    examples,
  };
}

/** A complete() that keeps one structure so the brief renders, and CAPTURES the decode view. */
function capturingComplete() {
  const complete = vi.fn<AdaptComplete>(async () =>
    JSON.stringify({
      structures: [
        { sourceIndex: 1, dosage: "swap", fitted: "Hook: … → Setup: … → Turn: … → Payoff: … → CTA: …", fitReason: "fits" },
      ],
    }),
  );
  return complete;
}

// ─── 1 · timings reach the decode view ────────────────────────────────────────

describe("renderExemplar (via adaptCorpusBlock) — timed rhythm in the decode view", () => {
  it("beats render WITH their measured seconds", async () => {
    const complete = capturingComplete();
    await adaptCorpusBlock(scriptInput([example("t1", TIMED_BEATS)]), { complete });
    const user = complete.mock.calls[0]![1];
    expect(user).toContain("The Hook (0–2s)");
    expect(user).toContain("The Breakdown (2–21s)");
  });

  it("untimed beats render without a timing parenthesis (cheap-tier rows)", async () => {
    const complete = capturingComplete();
    const untimed: TeardownBeat[] = [{ name: "The Hook", description: "Pose a binary question." }];
    await adaptCorpusBlock(scriptInput([example("t2", untimed)]), { complete });
    const user = complete.mock.calls[0]![1];
    expect(user).toContain("The Hook — Pose a binary question.");
    expect(user).not.toContain("The Hook (");
  });
});

// ─── 2 · per-beat transcripts reach the decode view (briefer only) ───────────

describe("renderExemplar (via adaptCorpusBlock) — per-beat transcript for the briefer", () => {
  const SAID_BEATS: TeardownBeat[] = [
    {
      name: "The Hook",
      description: "Pose a binary question.",
      startSec: 0,
      endSec: 2,
      transcript: ["Is this good content or bad content?", "Duffel bags."],
    },
    { name: "The Breakdown", description: "Walk the evidence.", startSec: 2, endSec: 21 },
  ];

  it("a beat carrying transcript renders a 'said' line with the spoken words", async () => {
    const complete = capturingComplete();
    await adaptCorpusBlock(scriptInput([example("t3", SAID_BEATS)]), { complete });
    const user = complete.mock.calls[0]![1];
    expect(user).toContain("said");
    expect(user).toContain("Is this good content or bad content?");
  });

  it("no transcript anywhere → no 'said (verbatim' line at all", async () => {
    const complete = capturingComplete();
    await adaptCorpusBlock(scriptInput([example("t4", TIMED_BEATS)]), { complete });
    const user = complete.mock.calls[0]![1];
    expect(user).not.toContain("said (verbatim");
  });

  it("a chatty beat transcript is clipped, not rendered whole", async () => {
    const complete = capturingComplete();
    const chatty: TeardownBeat[] = [
      {
        name: "The Hook",
        description: "Pose a binary question.",
        transcript: ["x".repeat(600)],
      },
    ];
    await adaptCorpusBlock(scriptInput([example("t5", chatty)]), { complete });
    const user = complete.mock.calls[0]![1];
    expect(user).not.toContain("x".repeat(300));
  });
});

// ─── 3 · fetchBeatTranscripts — the code-only DB read ────────────────────────

describe("fetchBeatTranscripts", () => {
  function fakeSupabase(rows: unknown, error: unknown = null): SupabaseClient {
    return {
      from: () => ({
        select: () => ({
          in: () => Promise.resolve({ data: rows, error }),
        }),
      }),
    } as unknown as SupabaseClient;
  }

  it("maps id → per-section transcript sentences", async () => {
    const rows = [
      {
        id: "td-1",
        sections: [
          { section_name: "The Hook", transcript_sentences: ["Line one.", "Line two."] },
          { section_name: "The Turn", transcript_sentences: ["Line three."] },
        ],
      },
    ];
    const map = await fetchBeatTranscripts(fakeSupabase(rows), ["td-1"]);
    expect(map.get("td-1")).toEqual([["Line one.", "Line two."], ["Line three."]]);
  });

  it("rows with no usable sentences are omitted; malformed shapes never throw", async () => {
    const rows = [
      { id: "td-2", sections: [{ transcript_sentences: [] }] },
      { id: "td-3", sections: "not an array" },
      { id: "td-4", sections: [{ transcript_sentences: [42, "  ", "Real line."] }] },
    ];
    const map = await fetchBeatTranscripts(fakeSupabase(rows), ["td-2", "td-3", "td-4"]);
    expect(map.has("td-2")).toBe(false);
    expect(map.has("td-3")).toBe(false);
    expect(map.get("td-4")).toEqual([["Real line."]]);
  });

  it("empty ids → no query, empty map; DB error → empty map, never a throw", async () => {
    expect((await fetchBeatTranscripts(fakeSupabase([]), [])).size).toBe(0);
    expect((await fetchBeatTranscripts(fakeSupabase(null, { message: "boom" }), ["x"])).size).toBe(0);
  });
});

// ─── 4 · gather-for-run threads transcripts into the SCRIPT adapt branch only ─

describe("gatherCorpusForRun — transcript enrichment (script + adapt only)", () => {
  function retrieveReturning(examples: RetrievedExample[]) {
    return vi.fn(async () => ({
      examples,
      enough: true,
      stats: { rank: "topical", archetypes: 3, good: examples.length, matched: 6, minRows: 2 },
    })) as never;
  }

  const baseInput = {
    enabled: true,
    platform: "tiktok" as const,
    queryCandidates: ["why lifting heavy beats cardio"],
    niche: "health-fitness",
    adapt: true,
    adaptProfile: { niche_primary: "health-fitness" },
    warnings: [] as string[],
  };

  it("script: examples handed to the briefer carry per-beat transcripts, positionally merged", async () => {
    const ex = example("td-9", TIMED_BEATS);
    let briefedExamples: RetrievedExample[] = [];
    const adapt = vi.fn(async (input: { examples: RetrievedExample[] }) => {
      briefedExamples = input.examples;
      return { corpus: "BRIEF", used: input.examples, adapted: true };
    });
    const transcripts = vi.fn(async () => new Map([["td-9", [["Spoken hook line."], ["Evidence line."]]]]));

    await gatherCorpusForRun(
      { ...baseInput, skill: "script" },
      { retrieve: retrieveReturning([ex]), adapt: adapt as never, transcripts },
    );

    expect(transcripts).toHaveBeenCalledWith(["td-9"]);
    const beats = briefedExamples[0]!.template!.beats!;
    expect(beats[0]!.transcript).toEqual(["Spoken hook line."]);
    expect(beats[1]!.transcript).toEqual(["Evidence line."]);
    // The ORIGINAL example object is never mutated — enrichment copies.
    expect(ex.template!.beats![0]!.transcript).toBeUndefined();
  });

  it("hooks: the transcript fetch is never made", async () => {
    const adapt = vi.fn(async (input: { examples: RetrievedExample[] }) => ({
      corpus: "BRIEF",
      used: input.examples,
      adapted: true,
    }));
    const transcripts = vi.fn(async () => new Map());

    await gatherCorpusForRun(
      { ...baseInput, skill: "hooks" },
      { retrieve: retrieveReturning([example("td-8", TIMED_BEATS)]), adapt: adapt as never, transcripts },
    );

    expect(transcripts).not.toHaveBeenCalled();
  });

  it("a transcript fetch failure degrades to the un-enriched brief, never a crash", async () => {
    let briefedExamples: RetrievedExample[] = [];
    const adapt = vi.fn(async (input: { examples: RetrievedExample[] }) => {
      briefedExamples = input.examples;
      return { corpus: "BRIEF", used: input.examples, adapted: true };
    });
    const transcripts = vi.fn(async () => {
      throw new Error("DB down");
    });

    const result = await gatherCorpusForRun(
      { ...baseInput, skill: "script" },
      { retrieve: retrieveReturning([example("td-7", TIMED_BEATS)]), adapt: adapt as never, transcripts },
    );

    expect(result.corpus).toBe("BRIEF");
    expect(briefedExamples[0]!.template!.beats![0]!.transcript).toBeUndefined();
  });
});
