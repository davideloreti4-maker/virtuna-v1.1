import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/team answered 500 for every signed-in user — `42P17 infinite recursion detected in
 * policy for relation "team_members"`. The policy is fixed in 20260727150000; what is pinned
 * here is the ROUTE's half of it, because the route is what turned a loud database error into
 * a silent one.
 *
 * The membership lookup discarded its error. A failed read is indistinguishable from "no team
 * yet" once you throw the error away, so every request fell through to the auto-create path
 * and tried to mint a team. Both error paths below were unchecked; a recurrence of the RLS
 * bug would once again present as teams multiplying rather than as a failure.
 */

type QueryResult = { data: unknown; error: unknown };

/** What each table's terminal call resolves to. Set per test. */
let membershipRead: QueryResult;
let teamInsert: QueryResult;
let memberInsert: QueryResult;

function makeBuilder(table: string) {
  // One thenable chain per table: every filter returns `this`, and the promise resolves to
  // whatever this table's scenario says.
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  for (const m of ["select", "eq", "in", "limit", "order", "single"]) {
    builder[m] = vi.fn(self);
  }
  builder.maybeSingle = vi.fn(async () => membershipRead);
  builder.insert = vi.fn(() => {
    const res = table === "teams" ? teamInsert : memberInsert;
    const inserted: Record<string, unknown> = {
      select: vi.fn(() => inserted),
      single: vi.fn(async () => res),
      then: (resolve: (v: QueryResult) => unknown) => resolve(res),
    };
    return inserted;
  });
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "u1", email: "u1@test.local" } },
        error: null,
      })),
    },
    from: vi.fn((table: string) => makeBuilder(table)),
  })),
}));

/** The shape PostgREST returns when the roster policy recurses. */
const RECURSION = {
  code: "42P17",
  message: 'infinite recursion detected in policy for relation "team_members"',
};

beforeEach(() => {
  membershipRead = { data: null, error: null };
  teamInsert = { data: { id: "team-1" }, error: null };
  memberInsert = { data: null, error: null };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/team", () => {
  it("fails loudly when the roster read errors — it must NOT read as 'no team yet'", async () => {
    membershipRead = { data: null, error: RECURSION };

    const { GET } = await import("@/app/api/team/route");
    const res = await GET();

    // The bug was a 500 from further down the auto-create path. The distinction that matters
    // is that we never GOT there: a broken read must not look like an absent team.
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: "Failed to load team" });
  });

  it("does not leave an orphan team behind when the owner's membership row fails", async () => {
    // The team INSERT succeeds, its membership row does not. The lookup goes through
    // team_members, so a team without one is invisible forever — and the next request makes
    // another. Reporting success here is how they multiply.
    memberInsert = { data: null, error: { code: "42501", message: "row-level security" } };

    const { GET } = await import("@/app/api/team/route");
    const res = await GET();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: "Failed to create team" });
  });

  it("returns the roster on the happy path", async () => {
    membershipRead = { data: { team_id: "team-1", role: "owner" }, error: null };

    const { GET } = await import("@/app/api/team/route");
    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ currentUserId: "u1" });
  });
});
