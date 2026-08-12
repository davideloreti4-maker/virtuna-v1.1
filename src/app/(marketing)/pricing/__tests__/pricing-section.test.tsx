/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { PricingSection } from "../pricing-section";
import { PLANS, TRIAL, getPlan } from "@/lib/pricing";

/**
 * /pricing must never promise a price checkout will refuse.
 *
 * `/api/whop/checkout` has always denied a second $1 trial (`trial_used_at`). This page had
 * no idea: it rendered "Start for $1" for every signed-in account, so a returning customer
 * clicked a dollar and met $99 in the embed. That is a chargeback shape, not a copy nit —
 * the assertions below are about the CHARGE, and they belong to the money path.
 *
 * The embed is stubbed: which door we open is the subject, not what is behind it.
 */
vi.mock("@/components/app/checkout-modal", () => ({
  CheckoutModal: ({ planId, trial }: { planId: string; trial?: boolean }) => (
    <div data-testid="checkout" data-plan={planId} data-trial={String(!!trial)} />
  ),
}));

let signedIn = true;

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: signedIn ? { id: "u1", email: "u1@test.local" } : null },
      }),
    },
  }),
}));

/** The one field under test: has this account already spent its dollar? */
function mockSubscription(over: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          tier: "free",
          status: "active",
          isTrial: false,
          trialEndsAt: null,
          trialUsed: false,
          whopConnected: false,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
          usage: null,
          ...over,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
  );
}

beforeEach(() => {
  signedIn = true;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<PricingSection /> — the price on the button is the price we charge", () => {
  it("offers the $1 trial to an account that still has one", async () => {
    mockSubscription({ trialUsed: false });
    render(<PricingSection />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: `Start for ${TRIAL.price}` })).toHaveLength(
        PLANS.length
      );
    });
  });

  it("names the MONTHLY price once the trial is spent — never '$1'", async () => {
    mockSubscription({ trialUsed: true });
    render(<PricingSection />);

    // Every card switches to the price that will actually be charged.
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: `Upgrade · ${getPlan("pro").price}/month` })
      ).toBeTruthy();
    });
    for (const plan of PLANS) {
      expect(
        screen.getByRole("button", { name: `Upgrade · ${plan.price}/month` })
      ).toBeTruthy();
    }

    // The whole page has to stop saying it — the CTA, the subhead and the microcopy under
    // each card all promised the dollar independently.
    expect(screen.queryByRole("button", { name: /start for \$1/i })).toBeNull();
    expect(screen.queryByText(TRIAL.microcopy)).toBeNull();
    expect(screen.queryByText(/every plan starts at \$1/i)).toBeNull();
    expect(screen.getByText(/already used your \$1 trial/i)).toBeTruthy();
  });

  it("still offers the dollar to a signed-OUT visitor — no account, no history", async () => {
    signedIn = false;
    mockSubscription({ trialUsed: true }); // irrelevant: nobody is signed in
    render(<PricingSection />);

    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: `Start for ${TRIAL.price}` })).toHaveLength(
        PLANS.length
      );
    });
  });
});
