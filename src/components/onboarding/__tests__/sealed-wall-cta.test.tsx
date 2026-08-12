/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SealedWallCta } from "../sealed-wall-cta";

/**
 * The sealed drill's $1 dressing (§0b② THE WALL → "$1").
 *
 * Two states, one guard: checkout and identity-linking are SEPARATE steps, so a visitor who
 * paid and bailed on the link must be offered the LINK again — never a second charge. The
 * /api/subscription probe decides which door the one CTA opens.
 */

// The checkout modal is real (its copy is under test); only the Whop embed is stubbed —
// its "complete" button stands in for a finished payment.
vi.mock("@whop/checkout/react", () => ({
  WhopCheckoutEmbed: ({ onComplete }: { onComplete?: () => void }) => (
    <button type="button" onClick={onComplete}>
      finish-payment
    </button>
  ),
}));

// The claim dialog's mechanics live in the lib (own test file); here only the door matters.
vi.mock("@/lib/onboarding/claim-account", () => ({
  beginGoogleLink: vi.fn(async () => ({ ok: true })),
  linkEmailPassword: vi.fn(async () => ({ ok: true })),
}));

let subscriptionTier: string;

beforeEach(() => {
  subscriptionTier = "free";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes("/api/subscription")) {
        return new Response(JSON.stringify({ tier: subscriptionTier }), { status: 200 });
      }
      if (u.includes("/api/whop/checkout")) {
        return new Response(
          JSON.stringify({ checkoutConfigId: "ch_test", planId: "starter", trialApplied: true }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 200 });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SealedWallCta — the unpaid visitor", () => {
  it("offers the $1 unlock with the honest trial terms (SSOT figures, both surprises named)", async () => {
    render(<SealedWallCta />);

    expect(screen.getByRole("button", { name: /unlock the simulation — \$1/i })).toBeTruthy();
    // The two surprises a buyer could hit: the 50-credit cap and the $49/mo renewal.
    expect(screen.getByText(/50 credits/i)).toBeTruthy();
    expect(screen.getByText(/\$49\/mo/)).toBeTruthy();
    expect(screen.getByText(/cancel anytime/i)).toBeTruthy();
  });

  it("opens checkout on tap, and payment completing advances STRAIGHT to the claim step", async () => {
    const user = userEvent.setup();
    render(<SealedWallCta />);

    await user.click(screen.getByRole("button", { name: /unlock the simulation/i }));
    // The funnel-framed checkout heading (trial resolved server-side).
    expect(await screen.findByText(/unlock the simulation — \$1/i, { selector: "h2" })).toBeTruthy();

    await user.click(await screen.findByRole("button", { name: "finish-payment" }));
    // Payment done ⇒ the linking step — the unlock IS the link (is_anonymous flips on it).
    expect(await screen.findByText(/make this room yours/i)).toBeTruthy();
  });
});

describe("SealedWallCta — paid but not yet linked", () => {
  it("offers the LINK, not a second charge", async () => {
    subscriptionTier = "starter";
    render(<SealedWallCta />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /finish unlocking/i })).toBeTruthy(),
    );
    expect(screen.queryByRole("button", { name: /unlock the simulation — \$1/i })).toBeNull();
  });

  it("the CTA opens the claim dialog directly — no checkout in between", async () => {
    subscriptionTier = "starter";
    const user = userEvent.setup();
    render(<SealedWallCta />);

    await user.click(
      await screen.findByRole("button", { name: /finish unlocking/i }),
    );
    expect(await screen.findByText(/make this room yours/i)).toBeTruthy();
    expect(screen.queryByText("finish-payment")).toBeNull();
  });
});
