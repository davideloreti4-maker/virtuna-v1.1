import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  beginGoogleLink,
  linkEmailPassword,
  googleLinkRedirectUrl,
} from "../claim-account";

/**
 * The claim step — linking an identity onto the SAME anonymous user (§0b② last line).
 *
 * The one ordering that matters: the onboarding stamp lands BEFORE the link fires. The
 * instant the linked session returns, the auth callback and the middleware both check
 * `creator_profiles.onboarding_completed_at` and bounce an un-stamped user to /welcome —
 * so a stamp that trails the link is a stamp that loses the race on the exact page the
 * visitor just paid to see.
 */

// One chronological log across BOTH the profile write and the auth calls.
let callLog: string[];
let upsertPayload: Record<string, unknown> | null;
let upsertError: { message: string } | null;
let linkError: { message: string } | null;
let updateError: { message: string } | null;

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "anon-1" } },
        error: null,
      })),
      linkIdentity: vi.fn(async (args: unknown) => {
        callLog.push(`linkIdentity:${JSON.stringify(args)}`);
        return linkError
          ? { data: { provider: "google", url: null }, error: linkError }
          : { data: { provider: "google", url: "https://accounts.google" }, error: null };
      }),
      updateUser: vi.fn(async (args: Record<string, unknown>) => {
        callLog.push(`updateUser:${JSON.stringify(args)}`);
        return updateError
          ? { data: { user: null }, error: updateError }
          : { data: { user: { id: "anon-1" } }, error: null };
      }),
    },
    from: vi.fn((table: string) => ({
      upsert: vi.fn(async (payload: Record<string, unknown>, opts: unknown) => {
        callLog.push(`upsert:${table}:${JSON.stringify(opts)}`);
        upsertPayload = payload;
        return { error: upsertError };
      }),
    })),
  })),
}));

beforeEach(() => {
  callLog = [];
  upsertPayload = null;
  upsertError = null;
  linkError = null;
  updateError = null;
});

describe("beginGoogleLink", () => {
  it("stamps onboarding complete BEFORE firing the link — the callback checks the profile the instant the linked session returns", async () => {
    const result = await beginGoogleLink("http://localhost:3000");

    expect(result.ok).toBe(true);
    const stampIdx = callLog.findIndex((c) => c.startsWith("upsert:creator_profiles"));
    const linkIdx = callLog.findIndex((c) => c.startsWith("linkIdentity"));
    expect(stampIdx).toBeGreaterThanOrEqual(0);
    expect(linkIdx).toBeGreaterThanOrEqual(0);
    expect(stampIdx).toBeLessThan(linkIdx);
  });

  it("stamps the row the /welcome gates actually read — completed step + completed-at, keyed on user_id", async () => {
    await beginGoogleLink("http://localhost:3000");

    expect(upsertPayload).toMatchObject({
      user_id: "anon-1",
      onboarding_step: "completed",
    });
    expect(typeof upsertPayload?.onboarding_completed_at).toBe("string");
    // Upsert, not insert: the conflict target is the UNIQUE user_id.
    expect(callLog.find((c) => c.startsWith("upsert:"))).toContain('"onConflict":"user_id"');
  });

  it("links GOOGLE with a redirect through the auth callback back to /home", async () => {
    await beginGoogleLink("http://localhost:3000");

    const link = callLog.find((c) => c.startsWith("linkIdentity"))!;
    expect(link).toContain('"provider":"google"');
    expect(link).toContain(
      JSON.stringify(googleLinkRedirectUrl("http://localhost:3000")),
    );
    expect(googleLinkRedirectUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/auth/callback?next=%2Fhome",
    );
  });

  it("a failed stamp never blocks the link — the link is what they paid for; the stamp only picks the landing page", async () => {
    upsertError = { message: "rls says no" };

    const result = await beginGoogleLink("http://localhost:3000");

    expect(result.ok).toBe(true);
    expect(callLog.some((c) => c.startsWith("linkIdentity"))).toBe(true);
  });

  it("surfaces a link failure (e.g. manual linking disabled project-side) instead of a silent no-op", async () => {
    linkError = { message: "Manual linking is disabled" };

    const result = await beginGoogleLink("http://localhost:3000");

    expect(result).toEqual({ ok: false, error: "Manual linking is disabled" });
  });
});

describe("linkEmailPassword", () => {
  it("stamps first, then converts the anon user with email + password in one call", async () => {
    const result = await linkEmailPassword("v@test.local", "longenough8");

    expect(result.ok).toBe(true);
    const stampIdx = callLog.findIndex((c) => c.startsWith("upsert:creator_profiles"));
    const updateIdx = callLog.findIndex((c) => c.startsWith("updateUser"));
    expect(stampIdx).toBeLessThan(updateIdx);
    expect(callLog[updateIdx]).toContain('"email":"v@test.local"');
    expect(callLog[updateIdx]).toContain('"password":"longenough8"');
  });

  it("surfaces an update failure", async () => {
    updateError = { message: "email already registered" };

    const result = await linkEmailPassword("v@test.local", "longenough8");

    expect(result).toEqual({ ok: false, error: "email already registered" });
  });
});
