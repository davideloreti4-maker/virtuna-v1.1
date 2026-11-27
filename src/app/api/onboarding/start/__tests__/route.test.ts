/**
 * POST /api/onboarding/start (plan 01-start-and-profile, Task 5), flag on: the answers checked, written to the
 * signed-in creator's own profile, and the way on: the app with a plan, their audience when they have one, else
 * the building screen with the first build. Stand-ins: the flag, and the Supabase session client at the route
 * boundary (the real `listAudiences` runs over the rows it answers).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { audienceToRow, GENERAL_TEMPLATES } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";
import { createClient } from "@/lib/supabase/server";

import { POST } from "../route";

const USER = { id: "00000000-0000-4000-8000-000000000001", is_anonymous: false };
const ANSWERS = { platforms: ["tiktok"], tiktokHandle: "niacooks", niche: "budget meals for students", nicheSource: "typed", goal: "growth" };
const panel = GENERAL_TEMPLATES.find((t) => (t.personas?.length ?? 0) > 0) as Audience;
const OWN_ROW = {
  ...audienceToRow({ ...panel, is_general: false, is_preset: false }, USER.id),
  id: "00000000-0000-4000-8000-0000000000a1",
  created_at: "2026-11-20T00:00:00Z",
  updated_at: "2026-11-20T00:00:00Z",
};

let user: { id: string; is_anonymous?: boolean } | null;
let profile: Record<string, unknown> | null;
let subscription: Record<string, unknown> | null;
let audienceRows: Record<string, unknown>[];
let readFails: boolean;
let writeFails: boolean;
let subscriptionFails: boolean;
let audiencesFail: boolean;
let upserts: { row: Record<string, unknown>; options: unknown }[];

function stub() {
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: (table: string) => {
      if (table === "creator_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => (readFails ? { data: null, error: { message: "column does not exist" } } : { data: profile, error: null }),
            }),
          }),
          upsert: async (row: Record<string, unknown>, options: unknown) => {
            upserts.push({ row, options });
            return { error: writeFails ? { message: "denied" } : null };
          },
        };
      }
      if (table === "user_subscriptions") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () =>
                subscriptionFails ? { data: null, error: { message: "relation unavailable" } } : { data: subscription, error: null },
            }),
          }),
        };
      }
      if (table === "audiences") {
        return {
          select: () => ({
            order: async () => (audiencesFail ? { data: null, error: { message: "timeout" } } : { data: audienceRows, error: null }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  vi.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>);
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("https://app.test/api/onboarding/start", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-26T10:00:00.000Z"));
  user = USER;
  profile = null;
  subscription = null;
  audienceRows = [];
  readFails = false;
  writeFails = false;
  subscriptionFails = false;
  audiencesFail = false;
  upserts = [];
  stub();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("refused, nothing written", () => {
  it.each([
    ["signed out", () => (user = null), 401],
    ["an anonymous session", () => (user = { ...USER, is_anonymous: true }), 403],
  ])("%s", async (_, arrange, status) => {
    arrange();
    expect((await post({ answers: ANSWERS, emailConsent: true })).status).toBe(status);
    expect(upserts).toHaveLength(0);
  });

  it("not JSON", async () => {
    const res = await POST(new Request("https://app.test/api/onboarding/start", { method: "POST", headers: { "content-type": "text/plain" }, body: "x" }));
    expect(res.status).toBe(415);
  });

  it("from another site", async () => {
    expect((await post({ answers: ANSWERS, emailConsent: true }, { origin: "https://evil.test" })).status).toBe(403);
    expect(upserts).toHaveLength(0);
  });

  it.each([
    ["no goal", { answers: { ...ANSWERS, goal: undefined }, emailConsent: true }],
    ["a bad handle", { answers: { ...ANSWERS, tiktokHandle: "nia cooks" }, emailConsent: true }],
    ["no consent field", { answers: ANSWERS }],
    ["broken JSON", "{nope"],
  ])("%s: 400", async (_, body) => {
    expect((await post(body)).status).toBe(400);
    expect(upserts).toHaveLength(0);
  });

  it("the profile cannot be read: 500", async () => {
    readFails = true;
    expect((await post({ answers: ANSWERS, emailConsent: true })).status).toBe(500);
    expect(upserts).toHaveLength(0);
  });
});

describe("saved", () => {
  it("a new creator with a TikTok handle: the profile, then the building screen with their account read", async () => {
    const res = await post({ answers: ANSWERS, emailConsent: true }, { origin: "https://app.test" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      next: "/audience/new?guide=1",
      build: { handle: "niacooks", type: "personal", platform: "tiktok", goalIntent: "grow", name: "@niacooks" },
    });
    expect(upserts).toEqual([
      {
        row: {
          user_id: USER.id,
          onboarding_step: "completed",
          onboarding_completed_at: "2026-11-26T10:00:00.000Z",
          email_consent: true,
          niche: "budget meals for students",
          niche_source: "typed",
          primary_goal: "growth",
          target_platforms: ["tiktok"],
          tiktok_handle: "niacooks",
        },
        options: { onConflict: "user_id" },
      },
    ]);
  });

  it("Instagram only: an audience described by their niche words", async () => {
    const res = await post({ answers: { platforms: ["instagram"], niche: "budget meals for students", nicheSource: "typed", goal: "brand_deals" }, emailConsent: true });
    expect((await res.json()).build).toMatchObject({ description: "budget meals for students", type: "target", platform: "custom" });
  });

  it("with a plan: the app, no build (the profile is still written)", async () => {
    subscription = { virtuna_tier: "starter" };
    expect(await (await post({ answers: ANSWERS, emailConsent: true })).json()).toEqual({ next: "/home", build: null });
    expect(upserts).toHaveLength(1);
  });

  it("with an audience of their own: that audience, guided, no build", async () => {
    audienceRows = [OWN_ROW];
    expect(await (await post({ answers: ANSWERS, emailConsent: true })).json()).toEqual({ next: "/audience?guide=1", build: null });
  });

  it("a profile with its own values keeps them (the goal Settings or You set, the platforms, the niche)", async () => {
    profile = {
      niche_source: "typed",
      primary_goal: "conversion",
      target_platforms: ["tiktok", "youtube"],
      tiktok_handle: "niacooks",
      instagram_handle: null,
      email_consent: false,
      onboarding_completed_at: null,
    };
    await post({ answers: ANSWERS, emailConsent: true });
    expect(Object.keys(upserts[0]!.row).sort()).toEqual(["email_consent", "onboarding_completed_at", "onboarding_step", "user_id"]);
  });

  it("the box left unticked: no consent written", async () => {
    await post({ answers: ANSWERS, emailConsent: false });
    expect(upserts[0]!.row.email_consent).toBe(false);
  });

  it("the plan cannot be read: counted as no plan, warned, still 200", async () => {
    subscriptionFails = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post({ answers: ANSWERS, emailConsent: true });
    expect(res.status).toBe(200);
    expect((await res.json()).next).toBe("/audience/new?guide=1");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("subscription read failed"));
  });

  it("the audiences cannot be listed: counted as none, warned, still 200", async () => {
    audiencesFail = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post({ answers: ANSWERS, emailConsent: true });
    expect(res.status).toBe(200);
    expect((await res.json()).next).toBe("/audience/new?guide=1");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("audience list failed"));
  });

  it("the write fails: 500", async () => {
    writeFails = true;
    expect((await post({ answers: ANSWERS, emailConsent: true })).status).toBe(500);
  });
});
