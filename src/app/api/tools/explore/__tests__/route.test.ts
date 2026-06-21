/**
 * route.test.ts — Explore SSE route integration tests (Phase 11 code-review fixes).
 *
 * Locks the CR-01 / CR-02 contracts so the route can no longer 400 the default user:
 *   - CR-01: an EMPTY body (no niche/accounts/input) → an HONEST un-niched trending pull
 *     (NOT a 400). The runner is invoked with the trending fallback query.
 *   - CR-01: a bare field-send { niche: "" } → same un-niched pull (the composer's
 *     documented "empty → un-niched pull" intent).
 *   - CR-02: { tracked: true } → the route resolves the SESSION user's tracked accounts
 *     server-side (listTrackedAccounts), caps the list, and runs a MERGED profile pull.
 *     The handles are NEVER read from the body (user_id/handles are session-derived — the
 *     CR-01 security invariant the review praised).
 *   - CR-02: { tracked: true } with ZERO tracked accounts (the race) → a clean 400, NOT a
 *     thrown 500/SSE error.
 *   - An explicit niche still classifies normally (no regression).
 *
 * Runner unit tests (the merge/dedupe/trackability math) live in:
 *   src/lib/tools/runners/explore-runner.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OutlierGridBlock } from "@/lib/tools/blocks";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/threads/threads", () => ({
  createOpenThreadLazy: vi.fn(),
}));

vi.mock("@/lib/threads/messages", () => ({
  insertMessage: vi.fn(),
}));

vi.mock("@/lib/kc/kc-stamp", () => ({
  kcStamp: vi.fn(() => ({ kcGenVersion: "gen.1.0.0" })),
}));

// csrf-guard returns null (pass) so the body branches are exercised.
vi.mock("@/lib/http/csrf-guard", () => ({
  csrfGuard: vi.fn(() => null),
}));

// audience-repo: a General audience by default; getAudience unused unless an id is set.
vi.mock("@/lib/audience/audience-repo", () => ({
  GENERAL_AUDIENCE: { id: "general", is_general: true, personas: [] },
  getAudience: vi.fn().mockResolvedValue(null),
}));

// discover-cache: force a cache MISS so the runner path runs (cap always allowed).
vi.mock("@/lib/discover/discover-cache", () => ({
  getCachedDiscover: vi.fn(() => null),
  setCachedDiscover: vi.fn(),
  checkUserCap: vi.fn(() => ({ allowed: true, used: 0, limit: 20 })),
  recordUserPull: vi.fn(),
}));

vi.mock("@/lib/tools/runners/explore-runner", () => ({
  runExplorePipeline: vi.fn(),
}));

vi.mock("@/lib/tracked-accounts/tracked-accounts-repo", () => ({
  listTrackedAccounts: vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeGridBlock(): OutlierGridBlock {
  return {
    type: "outlier-grid",
    props: {
      mode: "niche",
      tiles: [
        {
          platformVideoId: "v1",
          videoUrl: "https://www.tiktok.com/@c/video/1",
          caption: "c",
          views: 100,
          likes: 1,
          comments: 1,
          shares: 1,
          saves: 1,
          durationSeconds: 10,
          postedAt: new Date().toISOString(),
          multiplier: 2,
          baselineLabel: "vs niche",
          source: "trending",
          fit: null,
          trackable: false,
        },
      ],
    },
  };
}

function makeExploreRequest(body: unknown) {
  return new Request("http://localhost/api/tools/explore", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

/** Mount the standard authed-user mocks (user, thread, runner result). */
async function mountAuthed(userId = "user-123") {
  const { createClient } = await import("@/lib/supabase/server");
  const { createOpenThreadLazy } = await import("@/lib/threads/threads");
  const { insertMessage } = await import("@/lib/threads/messages");
  const { runExplorePipeline } = await import(
    "@/lib/tools/runners/explore-runner"
  );

  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
    },
  });
  (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "thread-1",
    user_id: userId,
    active_audience_id: null,
  });
  (insertMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "msg-1" });
  (runExplorePipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
    block: makeGridBlock(),
    ranked: [],
  });

  return { runExplorePipeline };
}

/** Drain an SSE response body to a single string. */
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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/tools/explore — CR-01 (un-niched trending pull)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const { POST } = await import("@/app/api/tools/explore/route");
    const res = await POST(makeExploreRequest({}));
    expect(res.status).toBe(401);
  });

  it("an EMPTY body runs an un-niched trending pull (NOT a 400)", async () => {
    const { runExplorePipeline } = await mountAuthed();

    const { POST } = await import("@/app/api/tools/explore/route");
    const res = await POST(makeExploreRequest({}));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    await drain(res);

    expect(runExplorePipeline).toHaveBeenCalledTimes(1);
    const input = (runExplorePipeline as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(input.mode).toBe("niche");
    expect(input.normalizedInput).toBe("trending");
    expect(input.mergeInputs).toBeUndefined();
  });

  it("a bare field-send { niche: '' } also runs the un-niched pull (composer.tsx:659 intent)", async () => {
    const { runExplorePipeline } = await mountAuthed();

    const { POST } = await import("@/app/api/tools/explore/route");
    const res = await POST(makeExploreRequest({ niche: "" }));

    expect(res.status).toBe(200);
    await drain(res);
    expect(runExplorePipeline).toHaveBeenCalledTimes(1);
    expect(
      (runExplorePipeline as ReturnType<typeof vi.fn>).mock.calls[0]![0].normalizedInput,
    ).toBe("trending");
  });

  it("an explicit niche still classifies normally (no regression)", async () => {
    const { runExplorePipeline } = await mountAuthed();

    const { POST } = await import("@/app/api/tools/explore/route");
    const res = await POST(makeExploreRequest({ niche: "fitness" }));

    expect(res.status).toBe(200);
    await drain(res);
    const input = (runExplorePipeline as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(input.mode).toBe("niche");
    expect(input.normalizedInput).toBe("fitness");
  });
});

describe("POST /api/tools/explore — CR-02 (tracked-accounts competitors pull)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the SESSION user's tracked accounts and merges them (handles never from body)", async () => {
    const { runExplorePipeline } = await mountAuthed("user-xyz");
    const { listTrackedAccounts } = await import(
      "@/lib/tracked-accounts/tracked-accounts-repo"
    );
    (listTrackedAccounts as ReturnType<typeof vi.fn>).mockResolvedValue([
      { handle: "alpha", platform: "tiktok" },
      { handle: "@Beta", platform: "tiktok" },
    ]);

    const { POST } = await import("@/app/api/tools/explore/route");
    // The body carries tracked:true ONLY — no handles, and a spoofed account/user_id
    // that MUST be ignored (CR-01 security invariant).
    const res = await POST(
      makeExploreRequest({ tracked: true, timeWindow: "week", user_id: "attacker" }),
    );

    expect(res.status).toBe(200);
    await drain(res);

    // listTrackedAccounts was called (server-side resolution).
    expect(listTrackedAccounts).toHaveBeenCalledTimes(1);

    expect(runExplorePipeline).toHaveBeenCalledTimes(1);
    const input = (runExplorePipeline as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(input.mode).toBe("profile");
    // Handles came from the repo (normalized: @-stripped, lowercased), NOT the body.
    expect(input.mergeInputs).toEqual(["alpha", "beta"]);
    expect(input.normalizedInput).toBe("alpha");
  });

  it("caps the tracked pull at 5 handles", async () => {
    const { runExplorePipeline } = await mountAuthed();
    const { listTrackedAccounts } = await import(
      "@/lib/tracked-accounts/tracked-accounts-repo"
    );
    (listTrackedAccounts as ReturnType<typeof vi.fn>).mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({
        handle: `h${i}`,
        platform: "tiktok",
      })),
    );

    const { POST } = await import("@/app/api/tools/explore/route");
    const res = await POST(makeExploreRequest({ tracked: true }));
    await drain(res);

    const input = (runExplorePipeline as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(input.mergeInputs).toHaveLength(5);
    expect(input.mergeInputs).toEqual(["h0", "h1", "h2", "h3", "h4"]);
  });

  it("returns a CLEAN 400 (not a 500/SSE error) when tracked:true but zero tracked accounts (race)", async () => {
    await mountAuthed();
    const { listTrackedAccounts } = await import(
      "@/lib/tracked-accounts/tracked-accounts-repo"
    );
    (listTrackedAccounts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { POST } = await import("@/app/api/tools/explore/route");
    const res = await POST(makeExploreRequest({ tracked: true }));

    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).not.toContain("text/event-stream");
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("no_tracked_accounts");
  });

  it("an explicit accounts handle takes precedence over tracked:true (single profile pull)", async () => {
    const { runExplorePipeline } = await mountAuthed();
    const { listTrackedAccounts } = await import(
      "@/lib/tracked-accounts/tracked-accounts-repo"
    );

    const { POST } = await import("@/app/api/tools/explore/route");
    const res = await POST(
      makeExploreRequest({ accounts: "@picked", tracked: true }),
    );
    await drain(res);

    // Explicit input wins → tracked accounts are NOT resolved.
    expect(listTrackedAccounts).not.toHaveBeenCalled();
    const input = (runExplorePipeline as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(input.mode).toBe("profile");
    expect(input.normalizedInput).toBe("picked");
    expect(input.mergeInputs).toBeUndefined();
  });
});
