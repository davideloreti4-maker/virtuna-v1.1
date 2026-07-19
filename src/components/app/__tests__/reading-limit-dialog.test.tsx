/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ReadingLimitDialog } from "@/components/app/reading-limit-dialog";
import type { CreditQuotaExceeded } from "@/lib/billing/quota-error";

/**
 * THE WALL. Four walls, and they must NOT offer the same way out — the trial one especially.
 *
 * The checkout embed is the one thing worth stubbing: it talks to Whop over the network, and
 * what this test cares about is which door we open, not what is behind it.
 */
vi.mock("@/components/app/checkout-modal", () => ({
  CheckoutModal: ({ planId, trial }: { planId: string; trial?: boolean }) => (
    <div data-testid="checkout" data-plan={planId} data-trial={String(!!trial)} />
  ),
}));

const wall = (over: Partial<CreditQuotaExceeded> = {}): CreditQuotaExceeded => ({
  message: "You've used all 500 credits on your plan this month.",
  tier: "starter",
  used: 500,
  limit: 500,
  inTrial: false,
  reason: "allowance",
  cost: 10,
  ...over,
});

describe("the quota wall", () => {
  it("shows the server's human message, never the slug", () => {
    render(<ReadingLimitDialog open quota={wall()} onClose={vi.fn()} />);

    expect(screen.getByText(/used all 500 credits/i)).toBeTruthy();
    // The regression this whole thing exists to prevent: the machine slug on screen.
    expect(screen.queryByText(/credit_quota_exceeded/)).toBeNull();
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
          limit: 50,
          used: 50,
          message: "Your $1 trial includes 50 credits.",
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
    // ...and the offer is priced in the unit being sold.
    expect(screen.getByText(/1,500 credits a month/i)).toBeTruthy();
  });

  it("gives a Studio team at the fair-use ceiling a TIME — no upsell, no misleading reset date", () => {
    // There is nothing above Studio to sell, and the wall resets at midnight UTC — showing
    // the monthly renewal date next to it would be the wrong date.
    render(
      <ReadingLimitDialog
        open
        quota={wall({
          tier: "studio",
          limit: null,
          used: 300,
          reason: "fair_use",
          message: "You've hit today's fair-use ceiling of 300 credits. It resets at midnight UTC.",
        })}
        renewsAt="2026-08-01T00:00:00.000Z"
        onClose={vi.fn()}
      />
    );

    // Title AND body both name the wall — assert each in its own role.
    expect(screen.getByRole("heading", { name: /fair-use ceiling/i })).toBeTruthy();
    expect(screen.getByText(/midnight UTC/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /upgrade/i })).toBeNull();
    expect(screen.queryByText(/reset August 1/i)).toBeNull();
  });

  it("does not push a plan at a trialling Studio's ceiling — a trial never upsells", () => {
    render(
      <ReadingLimitDialog
        open
        quota={wall({ tier: "studio", inTrial: true, limit: 50, used: 50 })}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /upgrade/i })).toBeNull();
  });
});
