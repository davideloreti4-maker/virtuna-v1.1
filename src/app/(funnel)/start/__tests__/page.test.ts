/**
 * /start under each build of the flag (plan 01-start-and-profile, Task 8). The flag is a build-time constant,
 * so each case loads the page fresh. Stand-ins: the session client and `redirect`.
 * - Flag off: as before, a redirect to /home.
 * - Flag on: the flow; signed in (not anonymous) it carries the email; onboarded, the app.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

let user: { id: string; email?: string; is_anonymous?: boolean } | null;
let onboardedAt: string | null;

beforeEach(() => {
  user = null;
  onboardedAt = null;
});

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  vi.doMock("next/navigation", () => ({
    redirect: (to: string) => {
      throw new Error(`redirect:${to}`);
    },
    useRouter: () => ({}),
  }));
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user } }) },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { onboarding_completed_at: onboardedAt }, error: null }) }) }) }),
    }),
  }));
  const page = await import("../page");
  const { StartFlow } = await import("@/components/start/start-flow");
  return { Page: page.default, StartFlow };
}

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.doUnmock("next/navigation");
  vi.doUnmock("@/lib/supabase/server");
  vi.resetModules();
});

type FlowElement = ReactElement<{ account: { email: string | null } | null }>;

describe("/start", () => {
  it("flag off: to /home, as before", async () => {
    const { Page } = await load(false);
    await expect(Page()).rejects.toThrow("redirect:/home");
  });

  it("flag on, signed out: the flow, no account", async () => {
    const { Page, StartFlow } = await load(true);
    const el = (await Page()) as FlowElement;
    expect(isValidElement(el) && el.type).toBe(StartFlow);
    expect(el.props.account).toBeNull();
  });

  it("flag on, an anonymous session counts as signed out", async () => {
    user = { id: "anon-1", is_anonymous: true };
    const { Page } = await load(true);
    expect(((await Page()) as FlowElement).props.account).toBeNull();
  });

  it("flag on, signed in without onboarding: the flow with their email", async () => {
    user = { id: "user-1", email: "nia@hey.com" };
    const { Page } = await load(true);
    expect(((await Page()) as FlowElement).props.account).toEqual({ email: "nia@hey.com" });
  });

  it("flag on, onboarded: the app", async () => {
    user = { id: "user-1", email: "nia@hey.com" };
    onboardedAt = "2026-11-26T10:00:00Z";
    const { Page } = await load(true);
    await expect(Page()).rejects.toThrow("redirect:/home");
  });
});
