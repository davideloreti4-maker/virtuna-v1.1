/** @vitest-environment happy-dom */
/**
 * Settings' tab list under each build of the flag (plan 2026-11-24-earn, step A; ruling 3): flag off, the
 * eight tabs as before, Referrals among them and its locked tab when opened; flag on, Referrals is not
 * listed (the link lives on Earn). Rendered for real (Radix tabs, the sections, a real QueryClient).
 * Stand-ins: the build-time flag, `fetch` (the profile read of the open tab) and the router.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.setConfig({ testTimeout: 20_000 });

const h = vi.hoisted(() => ({ flag: false }));
vi.mock("@/lib/flags/new-look", () => ({
  get NEW_LOOK_ENABLED() {
    return h.flag;
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/settings", useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }) }));

import { SettingsPage } from "../settings-page";

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ name: "Nia Carter", email: "nia@example.test", notifications: {} }), { status: 200 })));
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
  h.flag = false;
});

const renderSettings = (defaultTab: "notifications" | "referrals" = "notifications") =>
  render(
    <QueryClientProvider client={client}>
      <SettingsPage defaultTab={defaultTab} />
    </QueryClientProvider>,
  );
const tabs = () => screen.getAllByRole("tab").map((t) => t.textContent);

describe("Settings' tabs", () => {
  it("flag off: the eight tabs as before, Referrals after Billing", () => {
    renderSettings();
    expect(tabs()).toEqual(["Profile", "Account", "Connected accounts", "Notifications", "Billing", "Referrals", "Team", "Creator Profile"]);
  });

  it("flag off: ?tab=referrals opens the Referrals tab (the Pro gate's locked preview for a free account)", () => {
    renderSettings("referrals");
    expect(screen.getByRole("tab", { name: "Referrals" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Unlock your referral link")).toBeInTheDocument();
  });

  it("flag on: Referrals is not listed; the other seven are, in their order", () => {
    h.flag = true;
    renderSettings();
    expect(tabs()).toEqual(["Profile", "Account", "Connected accounts", "Notifications", "Billing", "Team", "Creator Profile"]);
    expect(screen.queryByText("Unlock your referral link")).toBeNull();
  });
});
