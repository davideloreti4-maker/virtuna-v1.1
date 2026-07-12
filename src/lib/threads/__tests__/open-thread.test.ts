/**
 * open-thread.test.ts — multi-thread helpers (migration 20260626120000).
 *
 * Covers the active-thread model:
 *   - createOpenThreadLazy returns the ACTIVE (newest) open thread when one exists.
 *   - Inserts a fresh open thread when none exists.
 *   - Recovers via re-select on a concurrent first-open race (no unique index now).
 *   - getOpenThread orders by updated_at DESC (newest = active), scoped by user_id.
 *   - createNewThread / touchThread / listOpenThreads basics + ownership scoping.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "@/lib/supabase/service";
import {
  createOpenThreadLazy,
  getOpenThread,
  createNewThread,
  touchThread,
  listOpenThreads,
  archiveThread,
  setThreadTitleIfEmpty,
} from "../threads";
import type { ThreadRow } from "../threads";

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function makeOpenRow(overrides: Partial<ThreadRow> = {}): ThreadRow {
  return {
    id: "00000000-0000-0000-0000-0000000000bb",
    user_id: USER_A,
    type: "open",
    reading_id: null,
    active_audience_id: null,
    title: null,
    created_at: "2026-06-17T00:00:00Z",
    updated_at: "2026-06-17T00:00:00Z",
    ...overrides,
  };
}

/**
 * Chainable mock client supporting every query shape used by threads.ts:
 *   insert().select().single()
 *   select().eq().eq().is().order().order().limit().maybeSingle()
 *   update().eq().eq().eq().select().maybeSingle()
 *   select().eq().eq().is().order().order().limit()  → resolves as a thenable
 */
function buildChain() {
  return {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    // Returns the chain by default (getOpenThread: .limit(1).maybeSingle()).
    // listOpenThreads awaits .limit() as the terminal call → that test overrides
    // it with mockResolvedValueOnce.
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
}

describe("createOpenThreadLazy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the active (newest) open thread when one exists", async () => {
    const row = makeOpenRow();
    const chain = buildChain();
    chain.maybeSingle.mockResolvedValueOnce({ data: row, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await createOpenThreadLazy(USER_A);

    expect(result).toEqual(row);
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("inserts a fresh open thread when none exists", async () => {
    const row = makeOpenRow();
    const chain = buildChain();
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // getOpenThread → none
    chain.single.mockResolvedValueOnce({ data: row, error: null }); // insert
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await createOpenThreadLazy(USER_A);

    expect(result).toEqual(row);
    const insertArg = chain.insert.mock.calls[0]![0];
    expect(insertArg.type).toBe("open");
    expect(insertArg.reading_id).toBeNull();
    expect(insertArg.user_id).toBe(USER_A);
  });

  it("recovers via re-select on a concurrent first-open race", async () => {
    const existing = makeOpenRow();
    const chain = buildChain();
    chain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null }) // first getOpenThread → none
      .mockResolvedValueOnce({ data: existing, error: null }); // re-select after race
    chain.single.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "dup" } });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await createOpenThreadLazy(USER_A);

    expect(result).toEqual(existing);
  });

  it("throws when insert fails and no thread can be re-selected", async () => {
    const chain = buildChain();
    chain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    chain.single.mockResolvedValueOnce({ data: null, error: { code: "23503", message: "fk" } });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    await expect(createOpenThreadLazy(USER_A)).rejects.toThrow(/failed to create/);
  });
});

describe("getOpenThread", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the newest open thread (updated_at DESC) scoped by user", async () => {
    const newest = makeOpenRow({ updated_at: "2026-06-20T00:00:00Z" });
    const chain = buildChain();
    chain.maybeSingle.mockResolvedValueOnce({ data: newest, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await getOpenThread(USER_A);

    expect(result).toEqual(newest);
    expect(chain.order).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(1);
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_A);
    expect(chain.eq).toHaveBeenCalledWith("type", "open");
    expect(chain.is).toHaveBeenCalledWith("reading_id", null);
  });

  it("returns null when no open thread exists", async () => {
    const chain = buildChain();
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    expect(await getOpenThread(USER_A)).toBeNull();
  });

  it("throws on a real query error", async () => {
    const chain = buildChain();
    chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    await expect(getOpenThread(USER_A)).rejects.toThrow(/getOpenThread: failed/);
  });
});

describe("createNewThread", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts and returns a new open thread", async () => {
    const row = makeOpenRow({ id: "new-1" });
    const chain = buildChain();
    chain.single.mockResolvedValueOnce({ data: row, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await createNewThread(USER_A);

    expect(result).toEqual(row);
    const insertArg = chain.insert.mock.calls[0]![0];
    expect(insertArg.type).toBe("open");
    expect(insertArg.user_id).toBe(USER_A);
  });
});

describe("touchThread", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true and scopes the update by user + thread + type", async () => {
    const chain = buildChain();
    chain.maybeSingle.mockResolvedValueOnce({ data: { id: "t1" }, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const ok = await touchThread(USER_A, "t1");

    expect(ok).toBe(true);
    expect(chain.update).toHaveBeenCalledTimes(1);
    expect(chain.eq).toHaveBeenCalledWith("id", "t1");
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_A);
    expect(chain.eq).toHaveBeenCalledWith("type", "open");
  });

  it("returns false when no owned open thread matches", async () => {
    const chain = buildChain();
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    expect(await touchThread(USER_B, "t1")).toBe(false);
  });
});

describe("listOpenThreads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns newest-first summaries scoped by user", async () => {
    const rows = [
      { id: "t2", title: "hooks for my launch", created_at: "2026-06-19T00:00:00Z", updated_at: "2026-06-21T00:00:00Z" },
      { id: "t1", title: null, created_at: "2026-06-17T00:00:00Z", updated_at: "2026-06-18T00:00:00Z" },
    ];
    const chain = buildChain();
    chain.limit.mockResolvedValueOnce({ data: rows, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const result = await listOpenThreads(USER_A);

    expect(result).toEqual(rows);
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_A);
    expect(chain.order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });
});

describe("setThreadTitleIfEmpty", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets a cleaned title, guarded by title IS NULL + ownership scoping", async () => {
    const chain = buildChain();
    chain.maybeSingle.mockResolvedValueOnce({ data: { id: "t1" }, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const ok = await setThreadTitleIfEmpty(USER_A, "t1", "  hooks   for\nmy launch  ");

    expect(ok).toBe(true);
    expect(chain.update).toHaveBeenCalledWith({ title: "hooks for my launch" });
    expect(chain.eq).toHaveBeenCalledWith("id", "t1");
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_A);
    // Write-once: only fills an empty title (first meaningful signal wins).
    expect(chain.is).toHaveBeenCalledWith("title", null);
  });

  it("no-ops on an empty/unusable candidate without touching the DB", async () => {
    const chain = buildChain();
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    expect(await setThreadTitleIfEmpty(USER_A, "t1", "   \n ")).toBe(false);
    expect(await setThreadTitleIfEmpty(USER_A, "t1", undefined)).toBe(false);
    expect(chain.update).not.toHaveBeenCalled();
  });

  it("returns false when the thread is already titled (no matching row)", async () => {
    const chain = buildChain();
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    expect(await setThreadTitleIfEmpty(USER_A, "t1", "second signal")).toBe(false);
  });

  it("never throws — a query error resolves false (titles are cosmetic)", async () => {
    const chain = buildChain();
    chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    await expect(setThreadTitleIfEmpty(USER_A, "t1", "hooks")).resolves.toBe(false);
  });
});

describe("archiveThread", () => {
  beforeEach(() => vi.clearAllMocks());

  it("flips type open→archived, scoped by user + thread + open-only, returns true", async () => {
    const chain = buildChain();
    chain.maybeSingle.mockResolvedValueOnce({ data: { id: "t1" }, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const ok = await archiveThread(USER_A, "t1");

    expect(ok).toBe(true);
    const updateArg = chain.update.mock.calls[0]![0];
    expect(updateArg.type).toBe("archived");
    // Ownership + open-only scoping (can't archive someone else's or a non-open thread).
    expect(chain.eq).toHaveBeenCalledWith("id", "t1");
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_A);
    expect(chain.eq).toHaveBeenCalledWith("type", "open");
  });

  it("returns false when no owned open thread matches", async () => {
    const chain = buildChain();
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    expect(await archiveThread(USER_B, "t1")).toBe(false);
  });

  it("throws on a real query error", async () => {
    const chain = buildChain();
    chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    });
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    await expect(archiveThread(USER_A, "t1")).rejects.toThrow(/archiveThread: failed/);
  });
});
