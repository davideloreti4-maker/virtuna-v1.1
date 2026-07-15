/**
 * route.test.ts — POST /api/tools/remix/run SSE route tests (Plan 06-04, Task 2).
 *
 * Tests:
 *   - 401 when user is not authenticated (T-06-13 auth-first)
 *   - 415 on non-JSON Content-Type (T-06-14 CSRF)
 *   - 403 on cross-origin request (T-06-14 CSRF)
 *   - 400 on missing / bad URL (Zod body validation)
 *   - remix-card persisted via insertMessage on success (D-10 KC_GEN_VERSION stamp)
 *   - SSE stream has stage + content + score + done events
 *   - error event emitted when runRemixPipeline returns an error field
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RemixCardBlock } from "@/lib/tools/blocks";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/threads/messages", () => ({
  insertMessage: vi.fn(),
}));

vi.mock("@/lib/threads/threads", () => ({
  createOpenThreadLazy: vi.fn(),
}));

vi.mock("@/lib/tools/runners/remix-runner", () => ({
  runRemixPipeline: vi.fn(),
}));

vi.mock("@/lib/kc/kc-stamp", () => ({
  kcStamp: vi.fn(() => ({ kcGenVersion: "gen.1.0.0" })),
}));

vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(),
  QWEN_REASONING_MODEL: "qwen3.7-plus",
}));

vi.mock("@/lib/kc/compiled", () => ({
  KC_CHAT_SYSTEM_PROMPT: "mock chat system prompt",
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "mock-request-id-abc"),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRemixCard(): RemixCardBlock {
  return {
    type: "remix-card",
    props: {
      adaptedHook: "The real reason 90% of fitness beginners quit",
      angle: "Cold-open pattern interrupt reveals hidden truth",
      whoItsFor: "Beginner fitness creators targeting 18-30 demographic",
      formatBorrowed: "open-loop cold open",
      sourceDecode: {
        hookPattern: "A direct question that challenges conventional wisdom",
        structure: "Cold open → 3-point breakdown → actionable payoff",
        theTurn: "The pivot from problem to solution at the 15s mark",
        emotionalBeat: "Aspiration via competence — viewer feels capable",
      },
      band: "Strong",
      fraction: "7/10 stop",
      scrollQuote: "This actually made me stop and think.",
      model: "sim1-flash",
    },
  };
}

function makeRemixRequest(
  body: unknown,
  options: { origin?: string; contentType?: string } = {},
) {
  const { origin, contentType = "application/json" } = options;
  const headers: Record<string, string> = {
    "Content-Type": contentType,
  };
  if (origin) {
    headers["Origin"] = origin;
  }
  return new Request("http://localhost/api/tools/remix/run", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/tools/remix/run (SSE route)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated (T-06-13 auth-first)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const { POST } = await import("@/app/api/tools/remix/run/route");
    const res = await POST(makeRemixRequest({ url: "https://www.tiktok.com/@creator/video/123" }));
    expect(res.status).toBe(401);
  });

  it("returns 415 on non-JSON Content-Type (T-06-14 CSRF content-type guard)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }) },
    });

    const { POST } = await import("@/app/api/tools/remix/run/route");
    const res = await POST(
      makeRemixRequest(
        { url: "https://www.tiktok.com/@creator/video/123" },
        { contentType: "text/plain" },
      ),
    );
    expect(res.status).toBe(415);
  });

  it("returns 403 on cross-origin request (T-06-14 CSRF cross-origin guard)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }) },
    });

    const { POST } = await import("@/app/api/tools/remix/run/route");
    const res = await POST(
      makeRemixRequest(
        { url: "https://www.tiktok.com/@creator/video/123" },
        { origin: "https://attacker.example.com" },
      ),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 on missing url in body (Zod validation T-04-06)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }) },
    });

    const { POST } = await import("@/app/api/tools/remix/run/route");
    const res = await POST(makeRemixRequest({ platform: "tiktok" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 SSE stream with text/event-stream on success", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockUser = { id: "user-123" };
    const mockThread = { id: "thread-remix-abc", user_id: "user-123" };
    const mockBlocks = [makeRemixCard()];

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    (runRemixPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: mockBlocks,
      warnings: [],
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-remix-xyz" });

    const { POST } = await import("@/app/api/tools/remix/run/route");
    const res = await POST(
      makeRemixRequest({
        url: "https://www.tiktok.com/@creator/video/123",
        platform: "tiktok",
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
  });

  it("remix-card persisted via insertMessage with KC_GEN_VERSION stamp (D-10)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockThread = { id: "thread-persist-check" };
    const mockBlocks = [makeRemixCard()];

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    (runRemixPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: mockBlocks,
      warnings: [],
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-1" });

    const { POST } = await import("@/app/api/tools/remix/run/route");
    const res = await POST(
      makeRemixRequest({
        url: "https://www.tiktok.com/@creator/video/123",
        platform: "tiktok",
      }),
    );

    // Consume stream
    const reader = res.body!.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    // insertMessage must have been called with the blocks + kcGenVersion
    expect(insertMessage).toHaveBeenCalledTimes(1);
    const mockCall = (insertMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, unknown[], string];
    const [threadId, role, blocks, kcGenVersion] = mockCall;
    expect(threadId).toBe("thread-persist-check");
    expect(role).toBe("assistant");
    expect(Array.isArray(blocks)).toBe(true);
    expect((blocks as unknown[]).length).toBe(1);
    expect((blocks as RemixCardBlock[])[0]!.type).toBe("remix-card");
    expect(typeof kcGenVersion).toBe("string");
    expect(kcGenVersion).toMatch(/^gen\./);
  });

  it("SSE stream emits stage + content + score + done events (real pipeline phases — D-02)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockThread = { id: "thread-events" };
    const mockBlocks = [makeRemixCard()];

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-2" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    // The route wires `onStage: (name, status) => send("stage", …)` (route.ts:195) and the REAL
    // runner fires it at four boundaries (Resolving → Decoding → Adapting → Simulating). A plain
    // mockResolvedValue never invokes the callback it is handed — so this test asserted
    // `event: stage` while mocking away the only thing that emits it. It survived for months
    // solely because it never ran (see src/test/setup.ts). The mock now behaves like the runner,
    // so the assertion actually proves the route's onStage → SSE wiring.
    (runRemixPipeline as ReturnType<typeof vi.fn>).mockImplementation(
      async (input: { onStage?: (name: string, status: "active" | "done") => void }) => {
        input.onStage?.("Resolving", "active");
        input.onStage?.("Resolving", "done");
        input.onStage?.("Simulating your audience", "active");
        input.onStage?.("Simulating your audience", "done");
        return { blocks: mockBlocks, warnings: [] };
      },
    );
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-2" });

    const { POST } = await import("@/app/api/tools/remix/run/route");
    const res = await POST(
      makeRemixRequest({
        url: "https://www.tiktok.com/@creator/video/123",
        platform: "tiktok",
      }),
    );

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let rawOutput = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawOutput += decoder.decode(value, { stream: true });
    }

    expect(rawOutput).toContain("event: stage");
    expect(rawOutput).toContain("event: content");
    expect(rawOutput).toContain("event: score");
    expect(rawOutput).toContain("event: done");

    // content must precede score (content-first, Pitfall 5)
    const contentIdx = rawOutput.indexOf("event: content");
    const scoreIdx = rawOutput.indexOf("event: score");
    expect(contentIdx).toBeLessThan(scoreIdx);
  });

  it("emits error event when runRemixPipeline returns an error field (SkillRunError surface)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-3" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "thread-err" });
    (runRemixPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: [],
      warnings: ["Decode returned null"],
      error: "decode_failed",
    });

    const { POST } = await import("@/app/api/tools/remix/run/route");
    const res = await POST(
      makeRemixRequest({
        url: "https://www.tiktok.com/@creator/video/123",
      }),
    );

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let rawOutput = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawOutput += decoder.decode(value, { stream: true });
    }

    expect(rawOutput).toContain("event: error");
    expect(rawOutput).toContain("decode_failed");
  });

  it("maxDuration = 300 is exported from the route module", async () => {
    const routeModule = await import("@/app/api/tools/remix/run/route");
    expect((routeModule as Record<string, unknown>).maxDuration).toBe(300);
  });
});
