/**
 * /settings (the server page) under each build of the flag (plan 2026-11-24-earn, step A; ruling 3).
 * Flag off: exactly as before: `?tab=referrals` opens the Referrals tab, the link is shown to Pro and
 * Studio only, its code is made on first view (now through the moved `ensureReferralCode`), and the
 * numbers are the table counts. Flag on: `?tab=referrals` leads to /earn, and the page reads nothing of
 * the referrals. Real: the page, `getUserTier`, `hasAccessToTier`, the code loop, the link. Stood in for:
 * the build-time flag and the database behind the session client and the service client
 * (`fake-referral-db.ts`; the service client only writes a new code, ruling 36). Every id and code is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

import { fakeReferralDb, type FakeReferralDb } from "@/lib/earn/__tests__/fake-referral-db";

vi.setConfig({ testTimeout: 60_000 });

const ME = "acct-nia";
let db: FakeReferralDb;
const savedUrl = process.env.NEXT_PUBLIC_APP_URL;

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => db.sessionClient() }));
  vi.doMock("@/lib/supabase/service", () => ({ createServiceClient: () => db.serviceClient() }));
  const page = await import("../page");
  const { SettingsPage } = await import("@/components/app/settings");
  return { Page: page.default, SettingsPage };
}
const open = async (flag: boolean, tab?: string) => {
  const { Page, SettingsPage } = await load(flag);
  return { element: (await Page({ searchParams: Promise.resolve(tab === undefined ? {} : { tab }) })) as ReactElement<Record<string, unknown>>, SettingsPage };
};
async function thrown(run: () => unknown): Promise<string> {
  try {
    await run();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? error);
  }
  return "nothing thrown";
}
const plan = (tier: string) => db.state.tables.user_subscriptions!.push({ user_id: ME, virtuna_tier: tier, status: "active" });
const referralTables = () => db.state.calls.filter((c) => c.table.startsWith("referral_"));

beforeEach(() => {
  db = fakeReferralDb();
  db.state.user = { id: ME };
  process.env.NEXT_PUBLIC_APP_URL = "https://maven.example.test";
});
afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.doUnmock("@/lib/supabase/server");
  vi.doUnmock("@/lib/supabase/service");
  vi.resetModules();
  if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = savedUrl;
});

describe("/settings, flag off: exactly as before", () => {
  it("?tab=referrals opens the Referrals tab; a Pro account without a code gets one, and its numbers", async () => {
    plan("pro");
    db.state.tables.referral_clicks!.push({ referrer_user_id: ME, referred_user_id: "acct-a", referral_code: "X" }, { referrer_user_id: ME, referred_user_id: "acct-b", referral_code: "X" });
    db.state.tables.referral_conversions!.push({ referrer_user_id: ME, referred_user_id: "acct-a", bonus_cents: 1000 });
    const { element, SettingsPage } = await open(false, "referrals");
    expect(isValidElement(element) && element.type).toBe(SettingsPage);
    expect(element.props.defaultTab).toBe("referrals");
    const code = (db.state.tables.referral_codes![0] as { code: string }).code;
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    // Ruling 36: the server writes the new code, for the session's own id; everything else is the session's.
    expect(db.state.calls.filter((c) => c.client === "service")).toEqual([expect.objectContaining({ table: "referral_codes", op: "insert", values: { user_id: ME, code } })]);
    expect(element.props.referral).toEqual({
      eligible: true,
      referralLink: `https://maven.example.test/?ref=${code}`,
      clicks: 2,
      conversions: 1,
      earningsCents: 1000,
    });
  });

  it("a Pro account with a code: that code, nothing written", async () => {
    plan("studio");
    db.state.tables.referral_codes!.push({ user_id: ME, code: "K349Z4QP" });
    const { element } = await open(false, "referrals");
    expect((element.props.referral as { referralLink: string }).referralLink).toBe("https://maven.example.test/?ref=K349Z4QP");
    expect(db.state.calls.filter((c) => c.table === "referral_codes" && c.op === "insert")).toEqual([]);
    expect(db.state.calls.filter((c) => c.client === "service")).toEqual([]);
  });

  it("the Pro gate and the output hold where the table takes a new code from the service client only", async () => {
    plan("pro");
    db.state.sessionAs = ME;
    db.state.serverWritesOnly = true;
    const { element } = await open(false, "referrals");
    const code = (db.state.tables.referral_codes![0] as { code: string }).code;
    expect(element.props.referral).toEqual({ eligible: true, referralLink: `https://maven.example.test/?ref=${code}`, clicks: 0, conversions: 0, earningsCents: 0 });
  });

  it("the Pro gate: a Creator-plan account sees the locked tab, and nothing of the referrals is read or made", async () => {
    plan("starter");
    const { element } = await open(false, "referrals");
    expect(element.props.defaultTab).toBe("referrals");
    expect(element.props.referral).toEqual({ eligible: false, referralLink: "", clicks: 0, conversions: 0, earningsCents: 0 });
    expect(referralTables()).toEqual([]);
  });

  it("no code could be made: the link without one, as before", async () => {
    plan("pro");
    db.state.codeTaken = 99;
    const { element } = await open(false, "referrals");
    expect((element.props.referral as { referralLink: string }).referralLink).toBe("https://maven.example.test/?ref=");
  });

  it("an unknown tab opens Profile", async () => {
    plan("pro");
    const { element } = await open(false, "nope");
    expect(element.props.defaultTab).toBe("profile");
  });
});

describe("/settings, flag on (ruling 3)", () => {
  it("?tab=referrals leads to /earn, before anything is read", async () => {
    plan("pro");
    expect(await thrown(() => open(true, "referrals"))).toMatch(/^NEXT_REDIRECT;[a-z]+;\/earn;/);
    expect(db.state.calls).toEqual([]);
    expect(db.state.authCalls).toBe(0);
  });

  it("any other tab opens as before, and the page reads nothing of the referrals (the tab is not listed)", async () => {
    plan("pro");
    const { element, SettingsPage } = await open(true, "billing");
    expect(isValidElement(element) && element.type).toBe(SettingsPage);
    expect(element.props.defaultTab).toBe("billing");
    expect(referralTables()).toEqual([]);
  });
});
