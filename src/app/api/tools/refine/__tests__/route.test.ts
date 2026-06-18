/**
 * route.test.ts — POST /api/tools/refine integration tests (Plan 05-05, Task 2).
 *
 * Behavior tests:
 *   1. POST with no auth session → 401 (auth gate before any DB read).
 *   2. POST { skill:"hooks", instruction, anchor } with mocked runHooksPipeline returning
 *      one scored card → persists a NEW hook-card message (one card) to the open thread
 *      AND a markdown chat-note message; SSE emits the new card content + score + the note.
 *   3. The persisted new card carries band/fraction from the fresh pipeline run (runner
 *      was invoked), not copied from the request body.
 *   4. When the mocked runner throws, the route emits `event: error { message }` (so the
 *      client renders the Plan-04 skill-run error/retry surface) and does NOT persist a card.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/threads/messages", () => ({
  insertMessage: vi.fn(),
  loadMessages: vi.fn(),
}));

vi.mock("@/lib/threads/threads", () => ({
  createOpenThreadLazy: vi.fn(),
  getOpenThread: vi.fn(),
}));

vi.mock("@/lib/tools/runners/hooks-runner", () => ({
  runHooksPipeline: vi.fn(),
}));

vi.mock("@/lib/tools/runners/ideas-runner", () => ({
  runIdeasPipeline: vi.fn(),
}));

vi.mock("@/lib/kc/kc-stamp", () => ({
  kcStamp: vi.fn(() => ({ kcGenVersion: "gen.1.0.0" })),
}));

vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(async () => ({
          [Symbol.asyncIterator]: async function* () {
            yield { choices: [{ delta: { content: "Re-ran #1 punchier — fresh SIM-1 score below." } }] };
          },
        })),
      },
    },
  })),
  QWEN_REASONING_MODEL: "qwen-test-model",
}));

vi.mock("@/lib/kc/compiled", () => ({
  KC_CHAT_SYSTEM_PROMPT: "You are a Numen co-pilot.",
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRefineRequest(body: unknown) {
  return new Request("http://localhost/api/tools/refine", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function readSSE(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let output = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
  }
  return output;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/tools/refine (SSE route)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: returns 401 when user is not authenticated (auth gate before any DB read)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const { POST } = await import("@/app/api/tools/refine/route");
    const res = await POST(
      makeRefineRequest({ skill: "hooks", instruction: "make it punchier", anchor: "```\nhookLine: Test\n```" }),
    );
    expect(res.status).toBe(401);
  });

  it("Test 2: valid hooks refine → SSE emits content + score + note; two insertMessage calls (card + chat-note)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");
    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");

    const mockUser = { id: "user-refine-123" };
    const mockThread = { id: "thread-open-456", user_id: "user-refine-123" };

    const freshCard = {
      type: "hook-card" as const,
      props: {
        hookLine: "Stop — the truth about protein shakes will surprise you",
        audienceArchetype: "Skeptic",
        mechanism: "pattern interrupt",
        seedHook: "Stop — the truth about protein shakes will surprise you",
        rank: 1,
        band: "Strong" as const,
        fraction: "8/10 stop",
        scrollQuote: "Wait, really?",
        model: "sim1-flash" as const,
        channel: "spoken",
      },
    };

    (runHooksPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: [freshCard],
      warnings: [],
      seedHookPath: "structured",
    });

    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-new" });

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);

    const { POST } = await import("@/app/api/tools/refine/route");
    const res = await POST(
      makeRefineRequest({
        skill: "hooks",
        instruction: "make hook 1 punchier",
        anchor: "```refine-anchor\nhookLine: Original hook\n---\ninstruction: make it punchier\n```",
        cardRef: 1,
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const rawOutput = await readSSE(res);

    // Must emit content event (the new card)
    expect(rawOutput).toContain("event: content");
    // Must emit score event (fresh band chip)
    expect(rawOutput).toContain("event: score");
    // Must emit done event
    expect(rawOutput).toContain("event: done");

    // insertMessage must be called at least twice (card + note)
    const insertCalls = (insertMessage as ReturnType<typeof vi.fn>).mock.calls;
    expect(insertCalls.length).toBeGreaterThanOrEqual(2);

    // First call: assistant + hook-card block
    const cardCall = insertCalls.find(
      ([, role, blocks]: [string, string, unknown[]]) =>
        role === "assistant" &&
        Array.isArray(blocks) &&
        (blocks as Array<{ type: string }>).some((b) => b.type === "hook-card"),
    );
    expect(cardCall).toBeDefined();

    // Second call: markdown chat-note
    const noteCall = insertCalls.find(
      ([, role, blocks]: [string, string, unknown[]]) =>
        role === "assistant" &&
        Array.isArray(blocks) &&
        (blocks as Array<{ type: string }>).some((b) => b.type === "markdown"),
    );
    expect(noteCall).toBeDefined();
  });

  it("Test 3: persisted card carries band from the fresh pipeline run (not copied from request)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");
    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");

    const mockUser = { id: "user-band-check" };
    const mockThread = { id: "thread-band-999", user_id: "user-band-check" };

    // Runner returns a FRESH "Strong" band — nothing in the request body carries band
    const freshCard = {
      type: "hook-card" as const,
      props: {
        hookLine: "Fresh punchy hook",
        audienceArchetype: "Skeptic",
        mechanism: "urgency",
        seedHook: "Fresh punchy hook",
        rank: 1,
        band: "Strong" as const,
        fraction: "9/10 stop",
        scrollQuote: "Wow!",
        model: "sim1-flash" as const,
        channel: null,
      },
    };

    (runHooksPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: [freshCard],
      warnings: [],
      seedHookPath: "structured",
    });

    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-band" });

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);

    const { POST } = await import("@/app/api/tools/refine/route");
    await POST(
      makeRefineRequest({
        skill: "hooks",
        instruction: "make hook 1 punchier",
        anchor: "```refine-anchor\nhookLine: Original\n---\ninstruction: punchier\n```",
      }),
    );

    // runHooksPipeline was invoked (fresh SIM run happened)
    expect(runHooksPipeline as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();

    // The card persisted via insertMessage carries band from the runner result
    const insertCalls = (insertMessage as ReturnType<typeof vi.fn>).mock.calls;
    const cardCall = insertCalls.find(
      ([, role, blocks]: [string, string, unknown[]]) =>
        role === "assistant" &&
        Array.isArray(blocks) &&
        (blocks as Array<{ type: string }>).some((b) => b.type === "hook-card"),
    );
    expect(cardCall).toBeDefined();
    const persistedBlocks = cardCall![2] as Array<{ type: string; props: { band: string } }>;
    const hookBlock = persistedBlocks.find((b) => b.type === "hook-card");
    expect(hookBlock?.props.band).toBe("Strong"); // from runner, not request body
  });

  it("Test 4: when runner throws, route emits event:error and does NOT persist a card", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");
    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");

    const mockUser = { id: "user-error-test" };
    const mockThread = { id: "thread-error-888", user_id: "user-error-test" };

    (runHooksPipeline as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Pipeline failed — SIM dropped out"),
    );

    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-should-not-persist" });

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);

    const { POST } = await import("@/app/api/tools/refine/route");
    const res = await POST(
      makeRefineRequest({
        skill: "hooks",
        instruction: "make hook 1 punchier",
        anchor: "```refine-anchor\nhookLine: Original\n---\ninstruction: punchier\n```",
      }),
    );

    expect(res.status).toBe(200); // SSE route always returns 200 then emits error event

    const rawOutput = await readSSE(res);
    expect(rawOutput).toContain("event: error");
    expect(rawOutput).toContain("Pipeline failed");

    // insertMessage must NOT have been called with hook-card blocks (no card persisted)
    const insertCalls = (insertMessage as ReturnType<typeof vi.fn>).mock.calls;
    const cardCall = insertCalls.find(
      ([, , blocks]: [string, string, unknown[]]) =>
        Array.isArray(blocks) &&
        (blocks as Array<{ type: string }>).some((b) => b.type === "hook-card"),
    );
    expect(cardCall).toBeUndefined();
  });
});
