/**
 * route.test.ts — POST /api/tools/profile tests (Phase 5 Plan 04, Task 2).
 *
 * Locks the security spine + thread persistence of the Profile route:
 *   - Unauthorized: no user → 401, BEFORE any normalizeStimulus/runProfile (T-05-09).
 *   - Over-cap / empty text → 400 (T-05-12 / AR-04-02), runProfile not called.
 *   - Traversal storagePath ("../x") → 400 (T-05-11 / AR-04-01), runProfile not called.
 *   - Happy path (text) → 200 { block } with block.type "profile-read"; insertMessage once.
 *
 * sanitizeStoragePath is the REAL pure guard (not mocked); runProfile + normalizeStimulus
 * are mocked so no LLM/DB runs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProfileReadBlock } from "@/lib/tools/profile-blocks";
import type { Stimulus } from "@/lib/engine/stimulus/types";

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

vi.mock("@/lib/engine/stimulus/normalize", () => ({
  normalizeStimulus: vi.fn(),
}));

vi.mock("@/lib/tools/runners/profile-runner", () => ({
  runProfile: vi.fn(),
}));

vi.mock("@/lib/kc/kc-stamp", () => ({
  kcStamp: vi.fn(() => ({ kcGenVersion: "gen.1.0.0" })),
}));

import { createClient } from "@/lib/supabase/server";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { normalizeStimulus } from "@/lib/engine/stimulus/normalize";
import { runProfile } from "@/lib/tools/runners/profile-runner";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockCreateOpenThreadLazy = createOpenThreadLazy as ReturnType<typeof vi.fn>;
const mockInsertMessage = insertMessage as ReturnType<typeof vi.fn>;
const mockNormalizeStimulus = normalizeStimulus as ReturnType<typeof vi.fn>;
const mockRunProfile = runProfile as ReturnType<typeof vi.fn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSupabase(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  };
}

function makeProfileBlock(): ProfileReadBlock {
  return {
    type: "profile-read",
    props: {
      subjectName: "Alex",
      subjectKind: "person",
      identity: { traits: ["assertive"], commStyle: "direct", drivers: ["control"] },
      tells: [{ tell: "pushes deadlines", evidence: "close by Friday" }],
      howTheyReact: "reacts defensively",
      goalScope: "close the deal",
      forensic: null,
      caveat: "Directional read.",
      savedAudienceId: "aud-1",
      model: "sim1-flash",
      tier: "Directional",
    },
  };
}

function makeStimulus(): Stimulus {
  return { kind: "text", content: "evidence", source: { origin: "text" }, tier: "flash" };
}

async function callPOST(body: unknown): Promise<Response> {
  const { POST } = await import("../route");
  const req = new Request("http://localhost/api/tools/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req);
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockCreateClient.mockResolvedValue(makeSupabase("user-1"));
  mockCreateOpenThreadLazy.mockResolvedValue({ id: "thread-1", type: "open", user_id: "user-1" });
  mockInsertMessage.mockResolvedValue(undefined);
  mockNormalizeStimulus.mockResolvedValue(makeStimulus());
  mockRunProfile.mockResolvedValue(makeProfileBlock());
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/tools/profile — auth gate (T-05-09)", () => {
  it("returns 401 when not authenticated, before any run", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null));

    const res = await callPOST({ kind: "text", text: "a chat with Alex" });

    expect(res.status).toBe(401);
    expect(mockNormalizeStimulus).not.toHaveBeenCalled();
    expect(mockRunProfile).not.toHaveBeenCalled();
  });
});

describe("POST /api/tools/profile — text cap (AR-04-02 / T-05-12)", () => {
  it("returns 400 on empty text and does NOT run", async () => {
    const res = await callPOST({ kind: "text", text: "   " });
    expect(res.status).toBe(400);
    expect(mockRunProfile).not.toHaveBeenCalled();
  });

  it("returns 400 on over-cap text and does NOT run", async () => {
    const res = await callPOST({ kind: "text", text: "x".repeat(8001) });
    expect(res.status).toBe(400);
    expect(mockRunProfile).not.toHaveBeenCalled();
  });
});

describe("POST /api/tools/profile — storagePath traversal (AR-04-01 / T-05-11)", () => {
  it("returns 400 on a traversal key and does NOT run", async () => {
    const res = await callPOST({ kind: "video", storagePath: "../x" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid storagePath");
    expect(mockNormalizeStimulus).not.toHaveBeenCalled();
    expect(mockRunProfile).not.toHaveBeenCalled();
  });
});

describe("POST /api/tools/profile — video ownership (CR-01 IDOR)", () => {
  it("returns 403 on a valid-shaped path owned by another user, before any run", async () => {
    // Shape is valid (passes sanitizeStoragePath) but the owner segment != session user.
    const res = await callPOST({ kind: "video", storagePath: "user-2/clip.mp4" });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
    expect(mockNormalizeStimulus).not.toHaveBeenCalled();
    expect(mockRunProfile).not.toHaveBeenCalled();
  });

  it("allows a video the session user owns (path prefixed with their id)", async () => {
    const res = await callPOST({ kind: "video", storagePath: "user-1/clip.mp4" });
    expect(res.status).toBe(200);
    expect(mockRunProfile).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/tools/profile — happy path", () => {
  it("returns 200 { block } with a profile-read block and persists once", async () => {
    const res = await callPOST({ kind: "text", text: "Alex: close by Friday or I walk." });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("block");
    expect(body.block.type).toBe("profile-read");

    expect(mockRunProfile).toHaveBeenCalledTimes(1);
    expect(mockInsertMessage).toHaveBeenCalledTimes(1);
    const [threadId, role, blocks] = mockInsertMessage.mock.calls[0]!;
    expect(threadId).toBe("thread-1");
    expect(role).toBe("assistant");
    expect(blocks[0].type).toBe("profile-read");
  });
});
