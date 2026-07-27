import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The anonymous-user reaper. The catastrophic failure mode is deleting a REAL user —
 * every other behavior here is bookkeeping. So the suite's spine is: real users are
 * untouchable (including a MISSING is_anonymous claim), paid anons are spared whatever
 * their status, and only old, unpaid, genuinely-anonymous rows go.
 */

const DAY = 24 * 60 * 60 * 1000;
const OLD = new Date(Date.now() - 40 * DAY).toISOString();
const FRESH = new Date(Date.now() - 2 * DAY).toISOString();

type FakeUser = {
  id: string;
  created_at: string;
  last_sign_in_at?: string | null;
  is_anonymous?: boolean;
};

let users: FakeUser[];
let paidUserIds: Set<string>;
let deleted: string[];
let failDeleteIds: Set<string>;

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    auth: {
      admin: {
        listUsers: vi.fn(async ({ page }: { page: number }) => ({
          // One page holds everything; a second page is empty (exercises the loop exit).
          data: { users: page === 1 ? users : [] },
          error: null,
        })),
        deleteUser: vi.fn(async (id: string) => {
          if (failDeleteIds.has(id)) return { data: null, error: { message: "restricted" } };
          deleted.push(id);
          return { data: null, error: null };
        }),
      },
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((_col: string, id: string) => ({
        maybeSingle: vi.fn(async () => ({
          data: paidUserIds.has(id) ? { user_id: id } : null,
          error: null,
        })),
      })),
    })),
  })),
}));

async function sweep() {
  const { GET } = await import("../route");
  return GET(
    new Request("http://test.local/api/cron/reap-anonymous", {
      headers: { authorization: "Bearer cron-secret" },
    }),
  );
}

beforeEach(() => {
  vi.resetModules();
  process.env.CRON_SECRET = "cron-secret";
  users = [];
  paidUserIds = new Set();
  deleted = [];
  failDeleteIds = new Set();
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("GET /api/cron/reap-anonymous", () => {
  it("401s without the cron secret", async () => {
    const { GET } = await import("../route");
    const res = await GET(new Request("http://test.local/api/cron/reap-anonymous"));
    expect(res.status).toBe(401);
  });

  it("reaps an old, unpaid, anonymous user", async () => {
    users = [{ id: "anon-old", created_at: OLD, is_anonymous: true }];

    const res = await sweep();
    const json = await res.json();

    expect(deleted).toEqual(["anon-old"]);
    expect(json).toMatchObject({ scanned: 1, reaped: 1, sparedPaid: 0 });
  });

  it("NEVER touches a real user, however old — and a MISSING claim reads as real", async () => {
    users = [
      { id: "real-old", created_at: OLD, is_anonymous: false },
      { id: "claimless-old", created_at: OLD }, // no is_anonymous field at all
    ];

    await sweep();

    expect(deleted).toEqual([]);
  });

  it("spares a young anonymous user, and one whose LAST SIGN-IN is recent even when created long ago", async () => {
    users = [
      { id: "anon-fresh", created_at: FRESH, is_anonymous: true },
      // The returning visitor: minted 40 days ago, was here two days ago.
      { id: "anon-returning", created_at: OLD, last_sign_in_at: FRESH, is_anonymous: true },
    ];

    await sweep();

    expect(deleted).toEqual([]);
  });

  it("spares a PAID anonymous user — their claim path hangs off this id", async () => {
    users = [{ id: "anon-paid", created_at: OLD, is_anonymous: true }];
    paidUserIds = new Set(["anon-paid"]);

    const res = await sweep();
    const json = await res.json();

    expect(deleted).toEqual([]);
    expect(json.sparedPaid).toBe(1);
  });

  it("a failed delete is reported and skipped — the sweep never aborts on one row", async () => {
    users = [
      { id: "anon-restricted", created_at: OLD, is_anonymous: true },
      { id: "anon-ok", created_at: OLD, is_anonymous: true },
    ];
    failDeleteIds = new Set(["anon-restricted"]);

    const res = await sweep();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(deleted).toEqual(["anon-ok"]);
    expect(json.failures).toEqual(["anon-restricted"]);
    expect(json.reaped).toBe(1);
  });
});
