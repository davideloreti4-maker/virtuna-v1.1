/**
 * route.test.ts — Hooks API route integration tests (Plan 04-02, Task 2).
 *
 * Tests:
 *   - POST /api/tools/hooks: 401 unauth, 400 over-cap ask/anchor (server-side), content-first
 *     SSE stream with ranked card faces + lead scrollQuote + audience tag + rank, KC_GEN_VERSION stamp
 *   - POST /api/tools/ideas/develop: placeholder REMOVED, real ranked hook-card blocks persisted,
 *     pinned response shape { threadId, messageId, fencedHooksBundle, ideaId } preserved
 *
 * Runner unit tests live in: src/lib/tools/runners/__tests__/hooks-runner.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HookCardBlock } from "@/lib/tools/blocks";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/threads/messages", () => ({
  insertMessage: vi.fn(),
}));

vi.mock("@/lib/threads/threads", () => ({
  createOpenThreadLazy: vi.fn(),
  getOpenThread: vi.fn(),
  // Title write is best-effort/write-once — resolve false ("already titled").
  setThreadTitleIfEmpty: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/tools/runners/hooks-runner", () => ({
  runHooksPipeline: vi.fn(),
}));

vi.mock("@/lib/kc/assembler", () => ({
  assembleBundle: vi.fn(() => "mocked hooks bundle"),
}));

// Qwen client for the follow-up turn. DEFAULT: create rejects → the route's
// non-fatal try/catch swallows it → no `followup` event, insertMessage called once
// (preserves the existing single-persist assertions). The S2 ordering test overrides
// this once with a working stream to assert `done` precedes `followup`.
vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(() => ({
    chat: { completions: { create: vi.fn().mockRejectedValue(new Error("no qwen in test")) } },
  })),
  QWEN_REASONING_MODEL: "qwen-test",
  QWEN_SEED: 42,
}));

vi.mock("@/lib/kc/kc-stamp", () => ({
  withKcStamp: vi.fn((obj: Record<string, unknown>) => ({
    ...obj,
    kcGenVersion: "gen.1.0.0",
  })),
  KC_PROVENANCE_FIELD: "kcGenVersion",
  kcStamp: vi.fn(() => ({ kcGenVersion: "gen.1.0.0" })),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeHookCard(i: number, band: "Strong" | "Mixed" = "Strong"): HookCardBlock {
  return {
    type: "hook-card",
    props: {
      hookLine: `Executable hook line ${i} — the verbatim text`,
      audienceArchetype: `Stops the skeptic`,
      mechanism: `Attention mechanism ${i} — plain prose description`,
      seedHook: `Seed hook ${i}`,
      rank: i,
      band,
      fraction: `${6 + i}/10 stop`,
      scrollQuote: `This stopped me because ${i}`,
      model: "sim1-flash",
      channel: i % 2 === 0 ? "spoken" : null,
    },
  };
}

function makeHooksRequest(body: unknown) {
  return new Request("http://localhost/api/tools/hooks", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ─── POST /api/tools/hooks ────────────────────────────────────────────────────

describe("POST /api/tools/hooks (SSE route)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const { POST } = await import("@/app/api/tools/hooks/route");
    const res = await POST(makeHooksRequest({ ask: "hooks" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when ask exceeds MAX_MESSAGE_LENGTH (server-side cap, WARNING-5)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    });

    const { POST } = await import("@/app/api/tools/hooks/route");
    const res = await POST(makeHooksRequest({ ask: "x".repeat(2001) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when anchor exceeds MAX_ANCHOR_LENGTH (server-side cap, WARNING-5)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
      },
    });

    const { POST } = await import("@/app/api/tools/hooks/route");
    const res = await POST(makeHooksRequest({ ask: "hooks", anchor: "x".repeat(5001) }));
    expect(res.status).toBe(400);
  });

  it("generates ranked hook-card blocks, persists KC_GEN_VERSION stamped message, streams SSE content-first", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockUser = { id: "user-123" };
    const mockThread = { id: "thread-hooks-abc", user_id: "user-123" };
    const mockBlocks = [makeHookCard(1), makeHookCard(2, "Mixed"), makeHookCard(3, "Mixed")];

    const mockSvcClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSvcClient);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    (runHooksPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: mockBlocks,
      warnings: [],
      seedHookPath: "structured",
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-hooks-xyz" });

    const { POST } = await import("@/app/api/tools/hooks/route");
    const res = await POST(makeHooksRequest({
      ask: "hooks for fitness myths idea",
      platform: "tiktok",
      anchor: "5 fitness myths that sabotage your gains",
    }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let rawOutput = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawOutput += decoder.decode(value, { stream: true });
    }

    // Must have status → content → score → done events
    expect(rawOutput).toContain("event: status");
    expect(rawOutput).toContain("event: content");
    expect(rawOutput).toContain("event: score");
    expect(rawOutput).toContain("event: done");

    // insertMessage called once with blocks array + kcGenVersion
    expect(insertMessage).toHaveBeenCalledTimes(1);
    const [threadId, role, blocks, kcGenVersion] = (insertMessage as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(threadId).toBe("thread-hooks-abc");
    expect(role).toBe("assistant");
    expect(Array.isArray(blocks)).toBe(true);
    expect((blocks as unknown[]).length).toBe(3);
    expect(typeof kcGenVersion).toBe("string");
    expect((kcGenVersion as string)).toMatch(/^gen\./);
  });

  /**
   * The `content` SSE payload is hand-built field-by-field in the route — a card prop that
   * exists on the block, in the schema, in the stream parser AND in the card still renders
   * NOTHING live if this one map forgets it. `grounded` was forgotten exactly that way: the
   * runner set it, the schema allowed it, `toBlocks()` copied it, the card gated NoSourceNote
   * on it — and the route never sent it, so the note could only ever appear after a reload.
   *
   * The pre-existing coverage was `expect(rawOutput).toContain("event: content")` — a PRESENCE
   * assertion, which passes happily with every single prop dropped. This asserts the payload.
   */
  it("streams the full card face — a prop dropped from the content map renders nothing live", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    // A grounded run whose card cited NO source — the exact case NoSourceNote exists for.
    const groundedCard = makeHookCard(1);
    groundedCard.props.grounded = true;

    const mockSvcClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSvcClient);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "thread-grounded",
      user_id: "user-123",
    });
    (runHooksPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: [groundedCard],
      warnings: [],
      seedHookPath: "structured",
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-grounded" });

    const { POST } = await import("@/app/api/tools/hooks/route");
    const res = await POST(makeHooksRequest({ ask: "hooks", platform: "tiktok" }));

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let rawOutput = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawOutput += decoder.decode(value, { stream: true });
    }

    // Parse the ACTUAL content frame the browser receives — not just its presence.
    const contentFrame = rawOutput
      .split("\n\n")
      .find((frame) => frame.startsWith("event: content"));
    expect(contentFrame).toBeDefined();
    const payload = JSON.parse(contentFrame!.slice(contentFrame!.indexOf("data: ") + 6)) as {
      blocks: Array<{ props: Record<string, unknown> }>;
    };
    const streamedProps = payload.blocks[0]!.props;

    // THE ASSERTION: the live stream carries `grounded`. Delete the line from the route's
    // content map and this goes red — while every other test in the repo stays green.
    expect(streamedProps.grounded).toBe(true);

    // And the rest of the face the card actually reads, so the next dropped prop is caught too.
    expect(streamedProps.hookLine).toBe(groundedCard.props.hookLine);
    expect(streamedProps.audienceArchetype).toBe(groundedCard.props.audienceArchetype);
    expect(streamedProps.mechanism).toBe(groundedCard.props.mechanism);
    expect(streamedProps.seedHook).toBe(groundedCard.props.seedHook);
    expect(streamedProps.rank).toBe(groundedCard.props.rank);
    expect(streamedProps.scrollQuote).toBe(groundedCard.props.scrollQuote);
    expect(streamedProps.model).toBe("sim1-flash");
  });

  it("S2: emits `done` BEFORE the follow-up chat turn (chat off the critical path)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");
    const { getQwenClient } = await import("@/lib/engine/qwen/client");

    const mockUser = { id: "user-123" };
    const mockThread = { id: "thread-s2", user_id: "user-123" };
    const mockBlocks = [makeHookCard(1)];

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    (runHooksPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: mockBlocks,
      warnings: [],
      seedHookPath: "structured",
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-s2" });

    // Override the default (rejecting) qwen mock with a working follow-up stream — once.
    const followupStream = {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: "Hook #1 lands hardest" } }] };
        yield { choices: [{ delta: { content: " — refine it." } }] };
      },
    };
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      chat: { completions: { create: vi.fn().mockResolvedValue(followupStream) } },
    });

    const { POST } = await import("@/app/api/tools/hooks/route");
    const res = await POST(makeHooksRequest({ ask: "hooks", platform: "tiktok" }));
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let rawOutput = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawOutput += decoder.decode(value, { stream: true });
    }

    // The follow-up DID emit (so the ordering assertion is meaningful)…
    expect(rawOutput).toContain("event: followup");
    expect(rawOutput).toContain("event: done");
    // …and `done` precedes `followup` — the chat turn streams AFTER run completion.
    const doneIdx = rawOutput.indexOf("event: done");
    const followupIdx = rawOutput.indexOf("event: followup");
    expect(doneIdx).toBeLessThan(followupIdx);

    // Both the cards and the follow-up markdown persist (2 inserts, cards first).
    expect(insertMessage).toHaveBeenCalledTimes(2);
  });

  it("content event carries ranked card face with lead scrollQuote + audienceArchetype + rank (content-first)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockBlocks = [makeHookCard(1)];
    const mockThread = { id: "thread-face-check" };

    const mockSvcClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSvcClient);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    (runHooksPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: mockBlocks,
      warnings: [],
      seedHookPath: "structured",
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-1" });

    const { POST } = await import("@/app/api/tools/hooks/route");
    const res = await POST(makeHooksRequest({ ask: "hooks", platform: "tiktok" }));

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let rawOutput = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawOutput += decoder.decode(value, { stream: true });
    }

    // Content event must carry scrollQuote, audienceArchetype, and rank on the face
    expect(rawOutput).toContain("scrollQuote");
    expect(rawOutput).toContain("This stopped me because 1");
    expect(rawOutput).toContain("audienceArchetype");
    expect(rawOutput).toContain("rank");
  });

  it("score events contain band chip per-card (a beat after the face — content-first)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockBlocks = [makeHookCard(1), makeHookCard(2, "Mixed")];
    const mockThread = { id: "thread-score" };

    const mockSvcClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-2" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSvcClient);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    (runHooksPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: mockBlocks,
      warnings: [],
      seedHookPath: "structured",
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-2" });

    const { POST } = await import("@/app/api/tools/hooks/route");
    const res = await POST(makeHooksRequest({ ask: "hooks", platform: "tiktok" }));

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let rawOutput = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawOutput += decoder.decode(value, { stream: true });
    }

    // Two score events — one per card
    const scoreMatches = rawOutput.match(/event: score/g);
    expect(scoreMatches).not.toBeNull();
    expect(scoreMatches!.length).toBe(2);

    // score event must carry band/fraction/model
    expect(rawOutput).toContain("\"band\"");
    expect(rawOutput).toContain("\"fraction\"");
    expect(rawOutput).toContain("sim1-flash");
  });
});

// ─── POST /api/tools/ideas/develop (REAL generation, D-07) ───────────────────

describe("POST /api/tools/ideas/develop (REPLACED placeholder — real Hooks generation, D-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const req = new Request("http://localhost/api/tools/ideas/develop", {
      method: "POST",
      body: JSON.stringify({ anchor: "Fitness idea text", platform: "tiktok" }),
      headers: { "Content-Type": "application/json" },
    });

    const { POST: DEVELOP } = await import("@/app/api/tools/ideas/develop/route");
    const res = await DEVELOP(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when anchor exceeds server-side cap (WARNING-5)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } } }),
      },
    });

    const req = new Request("http://localhost/api/tools/ideas/develop", {
      method: "POST",
      body: JSON.stringify({ anchor: "x".repeat(5001), platform: "tiktok" }),
      headers: { "Content-Type": "application/json" },
    });

    const { POST: DEVELOP } = await import("@/app/api/tools/ideas/develop/route");
    const res = await DEVELOP(req);
    expect(res.status).toBe(400);
  });

  it("runs real Hooks generation (no placeholder), persists hook-card blocks, PRESERVES pinned response shape (D-07)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");
    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");

    const mockThread = { id: "thread-develop" };
    const mockMsg = { id: "msg-develop-real" };
    const mockHookBlocks = [makeHookCard(1), makeHookCard(2, "Mixed")];

    const mockSvcClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSvcClient);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    (runHooksPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: mockHookBlocks,
      warnings: [],
      seedHookPath: "structured",
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue(mockMsg);

    const req = new Request("http://localhost/api/tools/ideas/develop", {
      method: "POST",
      body: JSON.stringify({
        anchor: "5 fitness myths that sabotage your gains",
        platform: "tiktok",
        ideaId: "idea-123",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const { POST: DEVELOP } = await import("@/app/api/tools/ideas/develop/route");
    const res = await DEVELOP(req);
    expect(res.status).toBe(200);

    const json = await res.json();

    // PINNED response shape must be intact (D-07 — Plan 03's CTA depends on this)
    expect(json.threadId).toBe("thread-develop");
    expect(json.messageId).toBe("msg-develop-real");
    expect(typeof json.fencedHooksBundle).toBe("string");
    // ideaId must be returned (pass-through for the CTA)
    expect(json.ideaId).toBe("idea-123");

    // insertMessage called once with hook-card blocks (NOT the placeholder markdown)
    expect(insertMessage).toHaveBeenCalledTimes(1);
    const [threadId, role, blocks, kcGenVersion] = (insertMessage as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(threadId).toBe("thread-develop");
    expect(role).toBe("assistant");
    expect(Array.isArray(blocks)).toBe(true);

    // VERIFY PLACEHOLDER IS GONE: blocks must NOT contain any markdown type block
    const blockArr = blocks as unknown[];
    const hasMarkdownBlock = blockArr.some(
      (b) => b && typeof b === "object" && (b as { type?: string }).type === "markdown",
    );
    expect(hasMarkdownBlock).toBe(false);

    // All blocks must be hook-card type
    for (const b of blockArr) {
      expect((b as { type?: string }).type).toBe("hook-card");
    }

    // KC_GEN_VERSION stamp must be present
    expect(typeof kcGenVersion).toBe("string");
    expect((kcGenVersion as string)).toMatch(/^gen\./);
  });

  it("runHooksPipeline is called (no placeholder path)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");
    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");

    const mockSvcClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSvcClient);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "t1" });
    (runHooksPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: [makeHookCard(1)],
      warnings: [],
      seedHookPath: "structured",
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "m1" });

    const req = new Request("http://localhost/api/tools/ideas/develop", {
      method: "POST",
      body: JSON.stringify({ anchor: "an idea", platform: "tiktok" }),
      headers: { "Content-Type": "application/json" },
    });

    const { POST: DEVELOP } = await import("@/app/api/tools/ideas/develop/route");
    await DEVELOP(req);

    // runHooksPipeline MUST have been called (D-07 real generation, not placeholder)
    expect(runHooksPipeline).toHaveBeenCalledTimes(1);
    const [pipelineInput] = (runHooksPipeline as ReturnType<typeof vi.fn>).mock.calls[0]!;
    // anchor must be passed through
    expect(pipelineInput.anchor).toBe("an idea");
  });
});
