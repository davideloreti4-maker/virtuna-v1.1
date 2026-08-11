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

vi.mock("@/lib/remix/blueprint-repo", () => ({
  insertBlueprint: vi.fn(),
}));

/**
 * `createServiceClient()` reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and THROWS
 * ("supabaseUrl is required.") when they are absent — and they are absent under vitest, verified
 * by probe. Unmocked, the route's blueprint write would take its non-fatal catch on every run in
 * this file, so the tests below would silently assert the FAILURE path while reading as if they
 * covered the happy one. (`billUsage` builds its own service client too and swallows everything,
 * so the stub returned here is inert for it.)
 */
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({})),
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

/**
 * A remix card carrying the source attribution the runner really produces: the `proof` receipt
 * (@handle + views), the back-compat `coverUrl`, and the `audienceName` steer tag. These are the
 * fields the LIVE content event was silently dropping (they only reappeared after a reload from the
 * persisted block) — this factory + the guard below prove they now ride the face.
 */
function makeRemixCardWithSource(): RemixCardBlock {
  const base = makeRemixCard();
  return {
    ...base,
    props: {
      ...base.props,
      coverUrl: "https://cdn.example/source-cover.jpg",
      audienceName: "Bootstrapped Founders",
      proof: {
        handle: "@sourcecreator",
        videoUrl: "https://www.tiktok.com/@sourcecreator/video/999",
        coverUrl: "https://cdn.example/source-cover.jpg",
        hookTemplate: null,
        archetype: null,
        multiplier: null, // a remix source has no follower baseline → null (honesty spine)
        views: 1_200_000,
        baselineLabel: null,
        fitLabel: null, // you chose this video; nothing scored its fit → null
      },
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

  it("content event carries the source attribution — proof + coverUrl + audienceName (rides the FACE, not reload-only)", async () => {
    // REGRESSION GUARD: remix adapts ONE specific real video, so the source receipt IS the card's
    // core content. The runner produced + persisted it, but the content event hand-picked props
    // field-by-field and omitted proof/coverUrl/audienceName — so on the live stream (the only path
    // a user watches) the source rendered as an anonymous thumbnail until a reload. This asserts the
    // three fields now ride the face; it FAILS against the pre-fix route that dropped them.
    const { createClient } = await import("@/lib/supabase/server");
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const { createOpenThreadLazy } = await import("@/lib/threads/threads");
    const { insertMessage } = await import("@/lib/threads/messages");

    const mockThread = { id: "thread-source" };
    const mockBlocks = [makeRemixCardWithSource()];

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-src" } } }) },
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
    (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-src" });

    const { POST } = await import("@/app/api/tools/remix/run/route");
    const res = await POST(
      makeRemixRequest({ url: "https://www.tiktok.com/@creator/video/123", platform: "tiktok" }),
    );

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let rawOutput = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawOutput += decoder.decode(value, { stream: true });
    }

    // Isolate the content event payload so a later persist/followup echo can't produce a false pass.
    const contentStart = rawOutput.indexOf("event: content");
    const contentSlice = rawOutput.slice(contentStart, rawOutput.indexOf("event: score", contentStart));
    expect(contentSlice).toContain("@sourcecreator"); // proof.handle
    expect(contentSlice).toContain("audienceName");
    expect(contentSlice).toContain("Bootstrapped Founders");
    expect(contentSlice).toContain("coverUrl");
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

  // ── Blueprint wiring (phase 1) ──────────────────────────────────────────────
  describe("blueprint persistence", () => {
    const BLUEPRINT_RESULT = {
      id: "bp1234567890",
      payload: {
        duration_s: 14,
        words_per_second: 3.2,
        has_speech: true,
        beats: [
          {
            index: 0, t_start: 0, t_end: 1.8, duration_s: 1.8, role: "hook" as const,
            spoken: "source line", on_screen_text: null, visual_event: "tight crop",
            audio_event: "voice", cuts: 1, weakness: null,
          },
        ],
      },
      script: [[{ index: 0, spoken: "your line", on_screen_text: "", shot: "waist-up" }]],
      sourceVideoId: "https://www.tiktok.com/@creator/video/123",
    };

    /** Signs in a user, stubs the thread, and hands back the card the pipeline "produced". */
    async function arrange(blueprint: unknown): Promise<RemixCardBlock> {
      const { createClient } = await import("@/lib/supabase/server");
      const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
      const { createOpenThreadLazy } = await import("@/lib/threads/threads");
      const { insertMessage } = await import("@/lib/threads/messages");
      const { insertBlueprint } = await import("@/lib/remix/blueprint-repo");

      (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }) },
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "thread-remix-abc", user_id: "user-123",
      });
      // Set explicitly rather than inherited: vi.clearAllMocks() clears CALLS, not
      // implementations, so a rejection configured by one test would leak into the next.
      (insertBlueprint as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-bp" });

      const card = makeRemixCard();
      (card.props as { blueprintId?: string }).blueprintId = "bp1234567890";
      (card.props as { blueprintVariant?: number }).blueprintVariant = 2;
      (runRemixPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
        blocks: [card], warnings: [], blueprint,
      });
      return card;
    }

    async function drain(res: Response): Promise<string> {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let out = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        out += decoder.decode(value, { stream: true });
      }
      return out;
    }

    const post = async () => {
      const { POST } = await import("@/app/api/tools/remix/run/route");
      return POST(makeRemixRequest({
        url: "https://www.tiktok.com/@creator/video/123", platform: "tiktok",
      }));
    };

    it("puts blueprintId on the SSE content face, not only in the persisted block", async () => {
      // THE ASSERTION THAT MATTERS. `proof`, `production` and `provenance` were each shipped
      // persisted-but-absent from this exact face, and each produced a card that only became
      // correct after a reload. This is what stops blueprintId becoming the fourth.
      await arrange(BLUEPRINT_RESULT);
      const raw = await drain(await post());

      const contentLine = raw
        .split("\n")
        .find((l) => l.startsWith("data:") && l.includes("adaptedHook"));
      expect(contentLine).toBeDefined();

      // PARSED, not substring-matched: a `toContain` on the whole frame passes if the id shows
      // up anywhere at all, including in a field nobody reads. This asserts the props map the
      // client actually destructures.
      const payload = JSON.parse(contentLine!.slice("data:".length)) as {
        blocks: Array<{ props: { blueprintId?: string; blueprintVariant?: number } }>;
      };
      expect(payload.blocks[0]!.props.blueprintId).toBe("bp1234567890");
      // The variant rides the face too — without it every card renders the rank-1 sheet.
      expect(payload.blocks[0]!.props.blueprintVariant).toBe(2);
    });

    it("writes the blueprint row before the thread message", async () => {
      await arrange(BLUEPRINT_RESULT);
      const { insertBlueprint } = await import("@/lib/remix/blueprint-repo");
      const { insertMessage } = await import("@/lib/threads/messages");
      const order: string[] = [];
      (insertBlueprint as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        order.push("blueprint");
      });
      (insertMessage as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        order.push("message");
      });

      await drain(await post());

      expect(order).toEqual(["blueprint", "message"]);
    });

    it("passes the runner's payload straight through to the row", async () => {
      await arrange(BLUEPRINT_RESULT);
      const { insertBlueprint } = await import("@/lib/remix/blueprint-repo");

      await drain(await post());

      expect(insertBlueprint).toHaveBeenCalledTimes(1);
      const [, row] = (insertBlueprint as ReturnType<typeof vi.fn>).mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(row.id).toBe("bp1234567890");
      // user_id comes from the SESSION, never the body (CR-01); thread_id is a REAL FK now.
      expect(row.user_id).toBe("user-123");
      expect(row.thread_id).toBe("thread-remix-abc");
      expect(row.source_video_id).toBe("https://www.tiktok.com/@creator/video/123");
      expect(row.blueprint).toEqual(BLUEPRINT_RESULT.payload);
      expect(row.script).toEqual(BLUEPRINT_RESULT.script);
    });

    it("strips blueprintId — from the FACE as well as the block — and still delivers the cards when the insert fails", async () => {
      const card = await arrange(BLUEPRINT_RESULT);
      const { insertBlueprint } = await import("@/lib/remix/blueprint-repo");
      const { insertMessage } = await import("@/lib/threads/messages");
      (insertBlueprint as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("insert failed"));
      (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-bp" });

      const raw = await drain(await post());

      // The run must not die with the row: the cards are the product.
      expect(raw).toContain("event: done");
      expect(insertMessage).toHaveBeenCalled();
      expect((card.props as { blueprintId?: string }).blueprintId).toBeUndefined();
      // …and the LIVE card must not carry an id whose row does not exist. The persist has to
      // happen before the content frame for this to hold — emitting the face first and writing
      // the row afterwards leaves a dangling id on screen until a reload.
      expect(raw).not.toContain("bp1234567890");
    });

    it("does not call insertBlueprint when the runner produced no blueprint", async () => {
      await arrange(null);
      const { insertBlueprint } = await import("@/lib/remix/blueprint-repo");
      await drain(await post());
      expect(insertBlueprint).not.toHaveBeenCalled();
    });
  });
});
