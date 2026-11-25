/**
 * /referrals under each build of the flag (plan 2026-11-24-earn, step A; ruling 3): flag off, to the
 * Settings tab as before; flag on, to Earn. The flag is a build-time constant, so each case loads the page
 * fresh with it set.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  return (await import("../page")).default;
}

function digestOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? error);
  }
  return "nothing thrown";
}

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.resetModules();
});

describe("/referrals", () => {
  it("flag off: to the Settings tab, as before", async () => {
    const Page = await load(false);
    expect(digestOf(() => Page())).toMatch(/^NEXT_REDIRECT;[a-z]+;\/settings\?tab=referrals;/);
  });

  it("flag on: to Earn", async () => {
    const Page = await load(true);
    expect(digestOf(() => Page())).toMatch(/^NEXT_REDIRECT;[a-z]+;\/earn;/);
  });
});
