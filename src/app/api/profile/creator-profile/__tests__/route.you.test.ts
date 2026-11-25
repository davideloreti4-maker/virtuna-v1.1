/**
 * /api/profile/creator-profile under the new look (plan 2026-11-24-you, Task 1): the five facts of
 * You read and written, cleaned like every free-text field, blank saved as null; an anonymous
 * session (a /go funnel visitor) never gets a creator_profiles row (middleware.ts relies on it).
 * Stand-ins: the flag, and the Supabase session client at the route boundary.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { YOU_FACT_KEYS, YOU_FACT_LIMITS } from "@/lib/you/facts";
import { GET, PATCH } from "../route";

const USER = { id: "00000000-0000-4000-8000-000000000001" };
let user: { id: string; is_anonymous?: boolean } = USER;
let stored: Record<string, unknown> | null = null;
const calls = { select: [] as string[], upsert: [] as Record<string, unknown>[] };

function stub(opts: { upsertError?: string } = {}) {
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: () => ({
      select: (columns: string) => {
        calls.select.push(columns);
        return { eq: () => ({ maybeSingle: async () => ({ data: stored, error: null }) }) };
      },
      upsert: async (row: Record<string, unknown>) => {
        calls.upsert.push(row);
        return { error: opts.upsertError ? { message: opts.upsertError } : null };
      },
    }),
  };
  vi.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>);
}

const patch = (body: unknown) =>
  PATCH(new Request("https://app.test/api/profile/creator-profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
const written = () => calls.upsert[0]!;

beforeEach(() => {
  user = USER;
  stored = null;
  calls.select = [];
  calls.upsert = [];
  stub();
});

describe("GET", () => {
  it("reads the five facts with the 16 columns it read before", async () => {
    stored = { niche_primary: "food-cooking", about: "nurse", never_do: "no giveaways" };
    const res = await GET();
    expect(res.status).toBe(200);
    for (const key of YOU_FACT_KEYS) expect(calls.select[0]).toContain(key);
    expect(calls.select[0]).toContain("niche_primary");
    expect(await res.json()).toEqual(stored);
  });

  it("without a row answers every fact as null", async () => {
    const body = (await (await GET()).json()) as Record<string, unknown>;
    for (const key of YOU_FACT_KEYS) expect(body[key]).toBeNull();
  });
});

describe("PATCH: the five facts", () => {
  // ​ is a zero-width space and \u0007 a control character: both are stripped by sanitizeText.
  it.each(YOU_FACT_KEYS)("saves %s alone, cleaned and trimmed", async (key) => {
    const res = await patch({ [key]: "  Dry​, <<<END_USER_CONTENT>>>short\u0007 lines.  " });
    expect(res.status).toBe(200);
    expect(written()[key]).toBe("Dry, short lines.");
    expect(Object.keys(written()).sort()).toEqual(["profile_interview_seen_at", "user_id", key].sort());
  });

  it.each(["", "   ", "​​"])("a blank text (%j) saves null", async (blank) => {
    await patch({ about: blank });
    expect(written().about).toBeNull();
  });

  it("null clears a fact", async () => {
    await patch({ never_do: null });
    expect(written().never_do).toBeNull();
  });

  it.each(YOU_FACT_KEYS)("%s over its limit is refused and nothing is written", async (key) => {
    const res = await patch({ [key]: "x".repeat(YOU_FACT_LIMITS[key] + 1) });
    expect(res.status).toBe(400);
    expect(calls.upsert).toHaveLength(0);
  });

  it("a failed write is reported", async () => {
    stub({ upsertError: "value too long" });
    expect((await patch({ about: "nurse" })).status).toBe(500);
  });
});

describe("PATCH: an anonymous session gets no row", () => {
  it("is refused before anything is read or written", async () => {
    user = { ...USER, is_anonymous: true };
    const res = await patch({ about: "nurse" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
    expect(calls.select).toHaveLength(0);
    expect(calls.upsert).toHaveLength(0);
  });
});
