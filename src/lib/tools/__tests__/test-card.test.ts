/**
 * test-card.test.ts — a simulation's result card, added by the SERVER to the chat the run started in.
 *
 * The builder is real (row → card mapping, the deterministic message id, insert-once). The stand-ins
 * are its I/O: the user's Supabase client (the row read), the service client's `messages` table (a
 * fake that enforces the primary key the way Postgres does), keyframe signing, corpus search.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApolloDimension, CounterfactualSuggestionItem, HeatmapPayload } from "@/lib/engine/types";

// ─── The fake `messages` table: a primary key, like Postgres ─────────────────
const table = new Map<string, { id: string; thread_id: string; role: string; body: unknown }>();
/** The chat's last user turn, as stored (the simulation's file name, link or typed text). */
let userTurnBody: unknown = null;
const titled: Array<[string, string, unknown]> = [];
vi.mock("@/lib/threads/threads", () => ({
  setThreadTitleIfEmpty: vi.fn(async (u: string, t: string, title: unknown) => {
    titled.push([u, t, title]);
    return true;
  }),
}));
const threadsUpdated: string[] = [];

function serviceClient() {
  return {
    from(name: string) {
      if (name === "threads") {
        return {
          update: () => ({
            eq: async (_c: string, id: string) => {
              threadsUpdated.push(id);
              return { error: null };
            },
          }),
        };
      }
      return {
        insert(row: { id?: string; thread_id: string; role: string; body: unknown }) {
          return {
            select: () => ({
              single: async () => {
                await Promise.resolve(); // two writers interleave here, as on a real round-trip
                const id = row.id ?? crypto.randomUUID();
                if (table.has(id)) return { data: null, error: { code: "23505", message: "duplicate key" } };
                const stored = { id, thread_id: row.thread_id, role: row.role, body: row.body };
                table.set(id, stored);
                return { data: { ...stored, created_at: "2026-11-26T00:00:00Z" }, error: null };
              },
            }),
          };
        },
        select: () => {
          const f: Record<string, unknown> = {};
          const q = {
            eq: (c: string, v: unknown) => {
              f[c] = v;
              return q;
            },
            order: () => q,
            limit: () => q,
            maybeSingle: async () =>
              f.role === "user"
                ? { data: userTurnBody === null ? null : { body: userTurnBody }, error: null }
                : { data: table.get(f.id as string) ?? null, error: null },
          };
          return q;
        },
      };
    },
  };
}
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => serviceClient() }));
const signFrames = vi.fn(async () => ({}));
vi.mock("@/lib/engine/filmstrip/storage", () => ({ signAnalysisFrames: () => signFrames() }));
const corpusSearch = vi.fn(async (..._a: unknown[]) => ({ content: "", examples: [], citable: [], record: {} }));
vi.mock("@/lib/grounding/corpus-tool", () => ({ executeCorpusSearch: (...a: unknown[]) => corpusSearch(...a) }));
const simSeal = vi.fn(async () => true);
vi.mock("@/lib/threads/sim-seals", () => ({ writeSimSeal: () => simSeal() }));
vi.mock("@/lib/grounding/retrieve", () => ({ retrieveCachedExamples: vi.fn() }));
vi.mock("@/lib/kc/kc-stamp", () => ({ kcStamp: () => ({ kcGenVersion: "gen.1.0.0" }) }));
let ambientOn = false;
vi.mock("@/lib/flags/ambient-v2", () => ({
  get AMBIENT_V2_ENABLED() {
    return ambientOn;
  },
}));

import { addTestCardToThread, testCardMessageId } from "@/lib/tools/test-card";

const DIMENSIONS: ApolloDimension[] = [
  { name: "hook", band: "strong", score: 87, lever: "Contrast", evidence: "Strong cold open." },
  { name: "retention", band: "mid", score: 55, lever: "Momentum", evidence: "Dips at 0:08." },
  { name: "clarity", band: "strong", score: 72, lever: "One message", evidence: "Legible." },
];
const SEGMENTS: HeatmapPayload["segments"] = [
  { idx: 0, t_start: 0, t_end: 3, label: "cold open", is_hook_zone: true, keyframe_uri: null },
  { idx: 1, t_start: 3, t_end: 6, label: "setup", is_hook_zone: false, keyframe_uri: null },
];
const FIXES: CounterfactualSuggestionItem[] = [
  { type: "fix", headline: "Recut the open", detail: "Front-load the payoff.", timestamp_ms: 8000, signal_anchor: "retention" },
  { type: "fix", headline: "Add an explicit CTA", detail: "Ask for the follow.", timestamp_ms: 11000, signal_anchor: "cta" },
];
const ROW = {
  id: "an-1",
  user_id: "user-1",
  overall_score: 72,
  deleted_at: null,
  variants: { apollo: { dimensions: DIMENSIONS, rewrites: [] } },
  heatmap: { segments: SEGMENTS, personas: [] },
  counterfactuals: { suggestions: FIXES },
  verbatim: null,
};

/** The user's client: the analysis row, owned (a forged id finds nothing). */
function userClient(row: Record<string, unknown> | null = ROW) {
  return {
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        is: () => q,
        single: async () => ({ data: row, error: row ? null : { message: "not found" } }),
      };
      return q;
    },
  } as never;
}

const thread = (id: string) => ({ id, user_id: "user-1", active_audience_id: null }) as never;

beforeEach(() => {
  table.clear();
  threadsUpdated.length = 0;
  ambientOn = false;
  signFrames.mockClear();
  corpusSearch.mockClear();
  simSeal.mockClear();
  userTurnBody = null;
  titled.length = 0;
});

/** A row with a real attention curve, so the Ambient v2 video seal applies. */
const BRAIN_ROW = { ...ROW, heatmap: { ...ROW.heatmap, weighted_curve: [0.8, 0.6], weighted_hook_score: 0.6 } };

describe("addTestCardToThread", () => {
  it("adds the card to the chat it is given, not the one open now", async () => {
    const res = await addTestCardToThread({ supabase: userClient(), userId: "user-1", analysisId: "an-1", thread: thread("chat-A") });
    expect(res.kind).toBe("added");
    const rows = [...table.values()];
    expect(rows.map((r) => r.thread_id)).toEqual(["chat-A"]);
    expect(rows[0]!.id).toBe(testCardMessageId("an-1", "chat-A"));
    const blocks = (rows[0]!.body as { blocks: Array<{ type: string; props: { analysisId?: string } }> }).blocks;
    expect(blocks.map((b) => b.type)).toEqual(["run-header", "video-test-card"]);
    expect(blocks[1]!.props.analysisId).toBe("an-1");
    expect(threadsUpdated).toEqual(["chat-A"]);
  });

  it("the server at completion and the client's seal both asking: one card", async () => {
    const a = addTestCardToThread({ supabase: userClient(), userId: "user-1", analysisId: "an-1", thread: thread("chat-A") });
    const b = addTestCardToThread({ supabase: userClient(), userId: "user-1", analysisId: "an-1", thread: thread("chat-A") });
    const [ra, rb] = await Promise.all([a, b]);
    expect(table.size).toBe(1);
    expect([ra.kind, rb.kind].sort()).toEqual(["added", "exists"]);
    // Whoever came second still gets the card back (the client only reloads on it).
    expect(rb.kind === "exists" ? rb.block : ra.kind === "exists" ? ra.block : null).not.toBeNull();
  });

  it("asked again later (a retried seal): no second card, the stored one comes back", async () => {
    await addTestCardToThread({ supabase: userClient(), userId: "user-1", analysisId: "an-1", thread: thread("chat-A") });
    const again = await addTestCardToThread({ supabase: userClient(), userId: "user-1", analysisId: "an-1", thread: thread("chat-A") });
    expect(again.kind).toBe("exists");
    expect(table.size).toBe(1);
  });

  it("the same analysis in another chat (a cache hit re-run there) gets its own card", async () => {
    await addTestCardToThread({ supabase: userClient(), userId: "user-1", analysisId: "an-1", thread: thread("chat-A") });
    await addTestCardToThread({ supabase: userClient(), userId: "user-1", analysisId: "an-1", thread: thread("chat-B") });
    expect([...table.values()].map((r) => r.thread_id).sort()).toEqual(["chat-A", "chat-B"]);
  });

  it("not found, not ready, nothing to teach: no card", async () => {
    expect((await addTestCardToThread({ supabase: userClient(null), userId: "user-1", analysisId: "x", thread: thread("A") })).kind).toBe("not_found");
    expect(
      (await addTestCardToThread({ supabase: userClient({ ...ROW, overall_score: null }), userId: "user-1", analysisId: "an-1", thread: thread("A") })).kind,
    ).toBe("not_ready");
    expect(
      (
        await addTestCardToThread({
          supabase: userClient({ ...ROW, variants: null, heatmap: null, counterfactuals: null }),
          userId: "user-1",
          analysisId: "an-1",
          thread: thread("A"),
        })
      ).kind,
    ).toBe("degraded");
    expect(table.size).toBe(0);
  });

  it("names an untitled simulation chat (write-once) by the video: a dropped file's name without its extension", async () => {
    userTurnBody = { kcGenVersion: "gen.1.0.0", blocks: [{ type: "markdown", props: { text: "test-pack.mp4" } }] };
    await addTestCardToThread({ supabase: userClient(), userId: "user-1", analysisId: "an-1", thread: thread("chat-A") });
    expect(titled).toEqual([["user-1", "chat-A", "test-pack"]]);
  });

  it("a link: the post's author; typed text: the text", async () => {
    userTurnBody = [{ type: "markdown", props: { text: "https://www.tiktok.com/@chef/video/1" } }];
    await addTestCardToThread({
      supabase: userClient({ ...ROW, variants: { ...ROW.variants, source: { handle: "chef" } } }),
      userId: "user-1",
      analysisId: "an-1",
      thread: thread("chat-A"),
    });
    userTurnBody = [{ type: "markdown", props: { text: "Will this one hold people?" } }];
    await addTestCardToThread({ supabase: userClient(), userId: "user-1", analysisId: "an-1", thread: thread("chat-B") });
    expect(titled.map((t) => t[2])).toEqual(["Video by @chef", "Will this one hold people?"]);
  });

  it("only the writer that added the card names the chat; nothing to name it by: no title write", async () => {
    userTurnBody = [{ type: "markdown", props: { text: "test-pack.mp4" } }];
    await addTestCardToThread({ supabase: userClient(), userId: "user-1", analysisId: "an-1", thread: thread("chat-A") });
    await addTestCardToThread({ supabase: userClient(), userId: "user-1", analysisId: "an-1", thread: thread("chat-A") });
    expect(titled).toHaveLength(1);
    userTurnBody = null;
    await addTestCardToThread({ supabase: userClient(), userId: "user-1", analysisId: "an-1", thread: thread("chat-C") });
    expect(titled).toHaveLength(1);
  });

  it("the message id is a valid uuid, the same for the same run, different for another chat or another run", () => {
    const id = testCardMessageId("an-1", "chat-A");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(testCardMessageId("an-1", "chat-A")).toBe(id);
    expect(testCardMessageId("an-1", "chat-B")).not.toBe(id);
    const run1 = testCardMessageId("an-1", "chat-A", "run-1");
    expect(testCardMessageId("an-1", "chat-A", "run-1")).toBe(run1);
    expect(testCardMessageId("an-1", "chat-A", "run-2")).not.toBe(run1);
  });

  it("the same video run again in the same chat (a cache hit, same analysis): a new run nonce, a new card", async () => {
    await addTestCardToThread({ supabase: userClient(), userId: "user-1", analysisId: "an-1", thread: thread("chat-A"), runNonce: "run-1" });
    await addTestCardToThread({ supabase: userClient(), userId: "user-1", analysisId: "an-1", thread: thread("chat-A"), runNonce: "run-2" });
    // …and the same run asked twice (server + seal) is still one.
    await addTestCardToThread({ supabase: userClient(), userId: "user-1", analysisId: "an-1", thread: thread("chat-A"), runNonce: "run-2" });
    expect(table.size).toBe(2);
  });

  it("nothing to teach: answered before the frames are signed or anything is searched", async () => {
    const res = await addTestCardToThread({
      supabase: userClient({ ...ROW, variants: null, heatmap: null, counterfactuals: null }),
      userId: "user-1",
      analysisId: "an-1",
      thread: thread("A"),
    });
    expect(res.kind).toBe("degraded");
    expect(signFrames).not.toHaveBeenCalled();
    expect(corpusSearch).not.toHaveBeenCalled();
  });

  it("the two fix searches run at the same time, not one after the other", async () => {
    let started = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    corpusSearch.mockImplementation(async () => {
      started++;
      await gate;
      return { content: "", examples: [], citable: [], record: {} };
    });
    const p = addTestCardToThread({ supabase: userClient(), userId: "user-1", analysisId: "an-1", thread: thread("chat-A") });
    await vi.waitFor(() => expect(started).toBe(2));
    release();
    expect((await p).kind).toBe("added");
  });

  it("the Ambient v2 seal is written only by the writer that added the card", async () => {
    ambientOn = true;
    await Promise.all([
      addTestCardToThread({ supabase: userClient(BRAIN_ROW), userId: "user-1", analysisId: "an-1", thread: thread("chat-A") }),
      addTestCardToThread({ supabase: userClient(BRAIN_ROW), userId: "user-1", analysisId: "an-1", thread: thread("chat-A") }),
    ]);
    expect(table.size).toBe(1);
    expect(simSeal).toHaveBeenCalledTimes(1);
  });
});
