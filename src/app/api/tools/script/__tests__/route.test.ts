/**
 * route.test.ts — POST /api/tools/script SSE route tests (Plan 06-03, Task 2).
 *
 * Tests:
 *   - 401 when user is not authenticated (T-06-06 auth-first)
 *   - 400 when ask exceeds MAX_MESSAGE_LENGTH (server-side cap, WARNING-5)
 *   - 400 when anchor exceeds MAX_ANCHOR_LENGTH (server-side cap, WARNING-5)
 *   - runScriptPipeline output persisted via insertMessage (KC_GEN_VERSION stamp)
 *   - content-first SSE (content event → score event → done)
 *   - SSE headers correct (text/event-stream)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ScriptCardBlock } from "@/lib/tools/blocks";

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

vi.mock("@/lib/tools/runners/script-runner", () => ({
  runScriptPipeline: vi.fn(),
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
  KC_SCRIPT_SYSTEM_PROMPT: "mock script system prompt",
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeScriptCard(): ScriptCardBlock {
  return {
    type: "script-card",
    props: {
      beats: [
        { label: "Hook", content: "Did you know 90% quit?", timing: "0–3s", retentionMarker: "Pattern interrupt." },
        { label: "Setup", content: "Here is what no one says.", timing: "3–15s", retentionMarker: "Curiosity gap." },
      ],
      openingBeatSeed: "Did you know 90% quit?",
      band: "Strong",
      fraction: "7/10 stop",
      scrollQuote: "This made me stop immediately.",
      model: "sim1-flash",
    },
  };
}

function makeScriptRequest(body: unknown) {
  return new Request("http://localhost/api/tools/script", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/tools/script (SSE route)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated (T-06-06 auth-first)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const { POST } = await import("@/app/api/tools/script/route");
    const res = await POST(makeScriptRequest({ ask: "Write a script" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when ask exceeds MAX_MESSAGE_LENGTH (server-side cap, WARNING-5)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }),
      },
    });

    const { POST } = await import("@/app/api/tools/script/route");
    const res = await POST(makeScriptRequest({ ask: "x".repeat(2001) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when anchor exceeds MAX_ANCHOR_LENGTH (server-side cap, WARNING-5)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }),
      },
    });

    const { POST } = await import("@/app/api/tools/script/route");
    const res = await POST(makeScriptRequest({ ask: "Write a script", anchor: "x".repeat(5001) }));
    expect(res.status).toBe(400);
  });

  it("returns 200 SSE stream with text/event-stream content type", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockUser = { id: "user-123" };
    const mockThread = { id: "thread-script-abc", user_id: "user-123" };
    const mockBlocks = [makeScriptCard()];

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    (runScriptPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: mockBlocks,
      warnings: [],
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-script-xyz" });

    const { POST } = await import("@/app/api/tools/script/route");
    const res = await POST(makeScriptRequest({
      ask: "Write a script about consistency",
      platform: "tiktok",
      anchor: "Did you know 90% quit?",
    }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
  });

  it("script-card persisted via insertMessage with KC_GEN_VERSION stamp (D-10)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockThread = { id: "thread-persist-check" };
    const mockBlocks = [makeScriptCard()];

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    (runScriptPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: mockBlocks,
      warnings: [],
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-1" });

    const { POST } = await import("@/app/api/tools/script/route");
    const res = await POST(makeScriptRequest({ ask: "Write a script", platform: "tiktok" }));

    // Consume stream
    const reader = res.body!.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    // Stage A (N-8): the USER-ACTION row persists first — the chip/pill click is a real
    // turn now, so a reload can never fold this run into the previous turn.
    expect(insertMessage).toHaveBeenCalledTimes(2);
    const [userThreadId, userRole, userBlocks] = (insertMessage as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(userThreadId).toBe("thread-persist-check");
    expect(userRole).toBe("user");
    expect((userBlocks as { type: string; props: { text: string } }[])[0]!.props.text).toBe("Write a script");
    // …then the assistant message with the blocks + kcGenVersion.
    const [threadId, role, blocks, kcGenVersion] = (insertMessage as ReturnType<typeof vi.fn>).mock.calls[1]!;
    expect(threadId).toBe("thread-persist-check");
    expect(role).toBe("assistant");
    expect(Array.isArray(blocks)).toBe(true);
    // The turn's RUN STAMP leads the message, then the card (lib/tools/run-header.ts).
    expect((blocks as unknown[]).length).toBe(2);
    expect((blocks as { type: string }[])[0]!.type).toBe("run-header");
    expect((blocks as { props: { skill: string } }[])[0]!.props.skill).toBe("script");
    expect((blocks as ScriptCardBlock[])[1]!.type).toBe("script-card");
    expect(typeof kcGenVersion).toBe("string");
    expect((kcGenVersion as string)).toMatch(/^gen\./);
  });

  it("SSE stream has content → score → done events (content-first)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockThread = { id: "thread-events" };
    const mockBlocks = [makeScriptCard()];

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-2" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    (runScriptPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: mockBlocks,
      warnings: [],
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-2" });

    const { POST } = await import("@/app/api/tools/script/route");
    const res = await POST(makeScriptRequest({ ask: "Write a script", platform: "tiktok" }));

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let rawOutput = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawOutput += decoder.decode(value, { stream: true });
    }

    expect(rawOutput).toContain("event: content");
    expect(rawOutput).toContain("event: score");
    expect(rawOutput).toContain("event: done");

    // content event must precede score event (content-first)
    const contentIdx = rawOutput.indexOf("event: content");
    const scoreIdx = rawOutput.indexOf("event: score");
    expect(contentIdx).toBeLessThan(scoreIdx);
  });

  it("content event carries beats + openingBeatSeed (script face content-first)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockThread = { id: "thread-face" };
    const mockBlocks = [makeScriptCard()];

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-3" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    (runScriptPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: mockBlocks,
      warnings: [],
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-3" });

    const { POST } = await import("@/app/api/tools/script/route");
    const res = await POST(makeScriptRequest({ ask: "Write a script" }));

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let rawOutput = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawOutput += decoder.decode(value, { stream: true });
    }

    expect(rawOutput).toContain("beats");
    expect(rawOutput).toContain("openingBeatSeed");
    expect(rawOutput).toContain("scrollQuote");
  });

  it("score event carries opener band chip (band/fraction/model)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockThread = { id: "thread-score" };
    const mockBlocks = [makeScriptCard()];

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-4" } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue(mockThread);
    (runScriptPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      blocks: mockBlocks,
      warnings: [],
    });
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-4" });

    const { POST } = await import("@/app/api/tools/script/route");
    const res = await POST(makeScriptRequest({ ask: "Write a script" }));

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let rawOutput = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawOutput += decoder.decode(value, { stream: true });
    }

    expect(rawOutput).toContain("\"band\"");
    expect(rawOutput).toContain("\"fraction\"");
    expect(rawOutput).toContain("sim1-flash");
  });
});
