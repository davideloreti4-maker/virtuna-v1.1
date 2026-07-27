/**
 * route.test.ts — DELETE /api/threads/[id] (the sidebar's "Delete thread").
 *
 * F-021: `archiveThread` THROWS on a DB error and this route had no catch, so the one
 * failure it did not anticipate — the `threads_type_check` drift that rejected
 * `type:'archived'` — escaped as an unhandled rejection. The creator saw a row that
 * flickered deleted and came back, forever, with no error anywhere in the chain.
 *
 * The route's contract, per its own docblock: 200 on archive · 404 when it isn't an owned
 * open thread · 401 unauthenticated. A DB failure is none of those and must be a 500 that
 * SAYS something, so the client can surface it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/threads/threads", () => ({ archiveThread: vi.fn() }));
vi.mock("@/lib/http/csrf-guard", () => ({ csrfGuard: vi.fn(() => null) }));

import { createClient } from "@/lib/supabase/server";
import { archiveThread } from "@/lib/threads/threads";
import { DELETE } from "../route";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockArchive = archiveThread as ReturnType<typeof vi.fn>;

const USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const THREAD = "00000000-0000-0000-0000-0000000000bb";

function signedIn(userId: string | null = USER) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  });
}

const call = () =>
  DELETE(new Request(`http://localhost/api/threads/${THREAD}`, { method: "DELETE" }), {
    params: Promise.resolve({ id: THREAD }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockArchive.mockReset();
});

describe("DELETE /api/threads/[id]", () => {
  it("archives an owned open thread → 200", async () => {
    signedIn();
    mockArchive.mockResolvedValue(true);

    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ threadId: THREAD });
    expect(mockArchive).toHaveBeenCalledWith(USER, THREAD);
  });

  it("404s when it is not an owned open thread", async () => {
    signedIn();
    mockArchive.mockResolvedValue(false);

    const res = await call();
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/i);
  });

  it("401s when unauthenticated — before any write", async () => {
    signedIn(null);

    const res = await call();
    expect(res.status).toBe(401);
    expect(mockArchive).not.toHaveBeenCalled();
  });

  // The F-021 guard. Pre-fix this test does not fail with a bad status — the route had no
  // catch at all, so the rejection propagated and DELETE() itself rejected.
  it("turns a DB failure into a 500 that says something, never an unhandled throw", async () => {
    signedIn();
    mockArchive.mockRejectedValue(
      new Error(
        `archiveThread: failed for threadId=${THREAD}: new row for relation "threads" violates check constraint "threads_type_check"`,
      ),
    );

    const res = await call();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/threads_type_check/);
  });
});
