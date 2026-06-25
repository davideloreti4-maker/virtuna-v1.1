/**
 * route.test.ts — Ideas API route integration tests (Plan 03-03, Task 2).
 *
 * Tests:
 *   - POST /api/tools/ideas: 401 unauth, 400 over-cap ask, SSE stream with
 *     content-first events (card faces + lead scrollQuote), KC_GEN_VERSION stamp
 *   - POST /api/tools/ideas/develop: 401, 400 over-cap anchor, in-thread Hooks placeholder
 *
 * Runner unit tests live in: src/lib/tools/runners/__tests__/ideas-runner.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IdeaCardBlock } from "@/lib/tools/blocks";

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
}));

vi.mock("@/lib/tools/runners/ideas-runner", () => ({
  runIdeasPipeline: vi.fn(),
}));

// /develop route now calls runHooksPipeline (D-07 real generation)
vi.mock("@/lib/tools/runners/hooks-runner", () => ({
  runHooksPipeline: vi.fn().mockResolvedValue({
    blocks: [
      {
        type: "hook-card",
        props: {
          hookLine: "Test hook line",
          audienceArchetype: "Stops the skeptic",
          mechanism: "Test mechanism prose",
          seedHook: "Test seed",
          rank: 1,
          band: "Strong",
          fraction: "7/10 stop",
          scrollQuote: "This stopped me",
          model: "sim1-flash",
          channel: null,
        },
      },
    ],
    warnings: [],
    seedHookPath: "structured",
  }),
}));

vi.mock("@/lib/kc/assembler", () => ({
  assembleBundle: vi.fn(() => "mocked bundle"),
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

function makeIdeaCard(i: number): IdeaCardBlock {
  return {
    type: "idea-card",
    props: {
      title: `Idea ${i}`,
      angle: `Angle ${i}`,
      whyItFits: "Because: fitness",
      mechanism: `Mechanism ${i}`,
      seedHook: `Hook ${i}`,
      needsTake: false,
      topic: `Topic ${i}`,
      take: `Take ${i}`,
      format: null,
      band: "Mixed",
      fraction: "6/10 stop",
      scrollQuote: `This stopped me because ${i}`,
      model: "sim1-flash",
    },
  };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/tools/ideas", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ─── POST /api/tools/ideas ────────────────────────────────────────────────────

describe("POST /api/tools/ideas (route)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const { POST } = await import("@/app/api/tools/ideas/route");
    const res = await POST(makeRequest({ ask: "ideas" }));
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

    const { POST } = await import("@/app/api/tools/ideas/route");
    const res = await POST(makeRequest({ ask: "x".repeat(2001) }));
    expect(res.status).toBe(400);
  });

  it("generates 3 idea-card blocks, persists stamped message, streams content-first", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockUser = { id: "user-123" };
    const mockThread = { id: "thread-abc", user_id: "user-123" };
    const mockBlocks = [makeIdeaCard(1), makeIdeaCard(2), makeIdeaCard(3)];

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
    (runIdeasPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: mockBlocks,
      warnings: [],
      seedHookPath: "structured",
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-xyz" });

    const { POST } = await import("@/app/api/tools/ideas/route");
    const res = await POST(makeRequest({ ask: "fitness ideas", platform: "tiktok" }));

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

    expect(rawOutput).toContain("event: status");
    expect(rawOutput).toContain("event: content");
    expect(rawOutput).toContain("event: score");

    // KC_GEN_VERSION stamp persisted via insertMessage: blocks array is the 3rd arg
    // (canonical body), kcGenVersion the 4th arg (insertMessage stores the wrapper).
    expect(insertMessage).toHaveBeenCalledTimes(1);
    const [threadId, role, blocks, kcGenVersion] = (insertMessage as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(threadId).toBe("thread-abc");
    expect(role).toBe("assistant");
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks as unknown[]).toHaveLength(3);
    expect(typeof kcGenVersion).toBe("string");
    expect(kcGenVersion as string).toMatch(/^gen\./);
  });

  it("content event carries lead scrollQuote on the card face (D-04/WARNING-4)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockBlocks = [makeIdeaCard(1)];
    const mockThread = { id: "thread-def" };

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
    (runIdeasPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: mockBlocks,
      warnings: [],
      seedHookPath: "structured",
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-1" });

    const { POST } = await import("@/app/api/tools/ideas/route");
    const res = await POST(makeRequest({ ask: "ideas", platform: "tiktok" }));

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let rawOutput = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawOutput += decoder.decode(value, { stream: true });
    }

    expect(rawOutput).toContain("scrollQuote");
    expect(rawOutput).toContain("This stopped me because 1");
  });
});

// ─── POST /api/tools/ideas/develop ───────────────────────────────────────────

describe("POST /api/tools/ideas/develop (chain-anchor route)", () => {
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

  it("appends Hooks placeholder to open thread and returns threadId + messageId", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createServiceClient } = await import("@/lib/supabase/service");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockThread = { id: "thread-hooks" };
    const mockMsg = { id: "msg-hooks" };

    const mockSvcClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    // The /develop route now loads creator_profiles (real Hooks generation, D-07).
    // Provide a createClient mock with .from() chain so the profile load succeeds.
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSvcClient);
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue(mockMsg);

    const req = new Request("http://localhost/api/tools/ideas/develop", {
      method: "POST",
      body: JSON.stringify({
        anchor: "5 fitness myths busted",
        platform: "tiktok",
        ideaId: "idea-123",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const { POST: DEVELOP } = await import("@/app/api/tools/ideas/develop/route");
    const res = await DEVELOP(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.threadId).toBe("thread-hooks");
    expect(json.messageId).toBe("msg-hooks");

    expect(insertMessage).toHaveBeenCalledTimes(1);
    const [threadId, role, blocks] = (insertMessage as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(threadId).toBe("thread-hooks");
    expect(role).toBe("assistant");
    expect(Array.isArray(blocks)).toBe(true);
    const blockText = JSON.stringify(blocks);
    expect(blockText.toLowerCase()).toContain("hook");
  });
});
