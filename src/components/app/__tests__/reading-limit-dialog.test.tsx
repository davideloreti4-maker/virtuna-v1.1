/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ReadingLimitDialog } from "@/components/app/reading-limit-dialog";
import type { ReadingQuotaExceeded } from "@/lib/billing/quota-error";

/**
 * THE WALL. Three walls, and they must NOT offer the same way out — the trial one especially.
 *
 * The checkout embed is the one thing worth stubbing: it talks to Whop over the network, and
 * what this test cares about is which door we open, not what is behind it.
 */
vi.mock("@/components/app/checkout-modal", () => ({
  CheckoutModal: ({ planId, trial }: { planId: string; trial?: boolean }) => (
    <div data-testid="checkout" data-plan={planId} data-trial={String(!!trial)} />
  ),
}));

const wall = (over: Partial<ReadingQuotaExceeded> = {}): ReadingQuotaExceeded => ({
  message: "You've used all 50 Readings on your plan this month.",
  tier: "starter",
  used: 50,
  limit: 50,
  inTrial: false,
  ...over,
});

describe("the quota wall", () => {
  it("shows the server's human message, never the slug", () => {
    render(<ReadingLimitDialog open quota={wall()} onClose={vi.fn()} />);

    expect(screen.getByText(/used all 50 Readings/i)).toBeTruthy();
    // The regression this whole thing exists to prevent: `reading_quota_exceeded` on screen.
    expect(screen.queryByText(/reading_quota_exceeded/)).toBeNull();
  });

  it("offers a TRIAL customer a date, not a second purchase", () => {
    // They have already paid $1 and their plan starts on its own. Putting a checkout in front
    // of them here is a way to charge the same customer twice for the same plan.
    render(
      <ReadingLimitDialog
        open
        quota={wall({
          inTrial: true,
          limit: 5,
          used: 5,
          message: "Your $1 trial includes 5 Readings.",
        })}
        renewsAt="2026-07-16T11:00:00.000Z"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Creator allowance starts July 16/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /upgrade/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /start for/i })).toBeNull();
  });

  it("offers a customer with NO plan the $1 trial — the only door in", () => {
    render(
      <ReadingLimitDialog
        open
        quota={wall({ tier: "free", limit: 0, used: 0, message: "Start a plan to run a Reading." })}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /start for \$1/i })).toBeTruthy();
  });

  it("does not say the same sentence twice — the title states the situation, the body the action", () => {
    // The no-plan title used to BE the server's message, so the dialog rendered
    // "Start a plan to run a Reading" as both its heading and its body.
    render(
      <ReadingLimitDialog
        open
        quota={wall({ tier: "free", limit: 0, used: 0, message: "Start a plan to run a Reading." })}
        onClose={vi.fn()}
      />
    );
    expect(screen.getAllByText(/Start a plan to run a Reading/i)).toHaveLength(1);
  });

  it("offers a spent Creator the next plan up, and says when theirs resets", () => {
    render(
      <ReadingLimitDialog open quota={wall()} renewsAt="2026-08-01T00:00:00.000Z" onClose={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: /upgrade to pro/i })).toBeTruthy();
    // "Wait until the 1st" is a real answer, and it costs them nothing — so say it.
    expect(screen.getByText(/reset August 1/i)).toBeTruthy();
  });

  it("does not push a plan at a spent Pro's ceiling without one above it", () => {
    // Studio can only hit a wall inside a trial (unlimited cannot be exceeded), and a trial
    // never upsells — so there is no plan to offer.
    render(
      <ReadingLimitDialog
        open
        quota={wall({ tier: "studio", inTrial: true, limit: 5, used: 5 })}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /upgrade/i })).toBeNull();
  });
});
