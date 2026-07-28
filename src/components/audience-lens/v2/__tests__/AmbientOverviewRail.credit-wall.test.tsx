/** @vitest-environment happy-dom */
/**
 * THE ROOM REACTION IS A PAID ACTION — and its 402 must raise the wall.
 *
 * `/api/tools/react` was free until 2026-07-28; it is priced at 1 credit under its own `react`
 * key in CREDIT_COSTS. It had TWO callers: the composer's "Ask the room" verb, and this rail's
 * armed sim. The composer verb was deleted the same day (Lane 2 step 4 — it rendered nowhere,
 * so it billed for silence), which left `fireSim` as the ONLY door to the priced route.
 *
 * ⚠️ This file is that deletion's other half. The wall assertion used to live in
 * `composer-ask-credit-wall.test.tsx`, against the verb — so removing the verb would have taken
 * the only test of "a refused room reaction raises the wall" with it, and left the surviving,
 * owner-invested door (the ＋ cold door promotes this to a PRIMARY action) with none. The
 * behaviour moved, so the test moved.
 *
 * Why the dialog is not a nicety here: a refused sim drops the row back to honestly QUEUED, which
 * is the right resting state but says nothing about WHY. Without the wall the creator sees a row
 * that flickered and returned — indistinguishable from a misclick. The second test asserts that
 * silence directly, so the claim is measured rather than assumed.
 *
 * Nobody sees this today (BILLING_ENFORCE_QUOTA is off in production), which is exactly why it
 * needs a test rather than a walk-through — the failure is invisible until the flag flips.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { AmbientOverviewRail } from "../AmbientOverviewRail";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { CREDIT_WALL_EVENT } from "@/lib/billing/credit-wall";
import { CREDIT_QUOTA_EXCEEDED } from "@/lib/billing/quota-error";
import type { Audience } from "@/lib/audience/audience-types";
import type { AmbientCardDescriptor } from "@/components/app/home/use-ambient-focus";

const audience: Audience = { ...GENERAL_AUDIENCE, name: "Your audience" };

const descriptors: AmbientCardDescriptor[] = [
  {
    id: "hook-0",
    kind: "hook",
    conceptText: "Nobody tells you the first 10k is the hardest",
    fraction: "3/10 stop",
    scrollQuote: "",
  },
];

/** The exact 402 body the route's `quotaRefusalBody` writes — the only shape the wall recognises. */
const QUOTA_402 = {
  error: CREDIT_QUOTA_EXCEEDED,
  message: "That needs 1 credits — you have 0 credits left this month.",
  tier: "starter",
  used: 500,
  limit: 500,
  inTrial: false,
  reason: "allowance",
  cost: 1,
};

let reactStatus = 402;
let reactBody: unknown = QUOTA_402;

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input.toString();
  if (url.includes("/api/tools/react")) {
    return Promise.resolve({
      ok: reactStatus < 400,
      status: reactStatus,
      json: async () => reactBody,
    } as Response);
  }
  return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  reactStatus = 402;
  reactBody = QUOTA_402;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Fire the armed sim, the way a creator does: tap the queued row (the whole row is the
 * quick-simulate door → the develop/arm card), then press Simulate on the arming card. Two
 * steps, on purpose — the run is deliberate, which is exactly why its refusal must be legible.
 */
function simulateTheQueuedRow() {
  render(<AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />);
  fireEvent.click(screen.getByText(/Nobody tells you the first 10k/));
  fireEvent.click(screen.getByRole("button", { name: /^simulate/i }));
}

describe("the room's armed sim against a refused credit gate", () => {
  it("raises the ONE wall dialog carrying the SERVER's sentence", async () => {
    const walls: unknown[] = [];
    const onWall = (e: Event) => walls.push((e as CustomEvent).detail);
    window.addEventListener(CREDIT_WALL_EVENT, onWall);

    try {
      simulateTheQueuedRow();

      await waitFor(() =>
        expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/api/tools/react"))).toBe(true),
      );

      // Exactly once, and it relays the server's own copy — never a slug, never ours.
      await waitFor(() => expect(walls).toHaveLength(1));
      expect((walls[0] as { message: string }).message).toBe(QUOTA_402.message);
    } finally {
      window.removeEventListener(CREDIT_WALL_EVENT, onWall);
    }
  });

  it("a NON-credit failure raises no wall — and proves how silent a bare failure is", async () => {
    reactStatus = 502;
    reactBody = { error: "reaction_failed" };

    const walls: unknown[] = [];
    const onWall = (e: Event) => walls.push((e as CustomEvent).detail);
    window.addEventListener(CREDIT_WALL_EVENT, onWall);

    try {
      simulateTheQueuedRow();
      await waitFor(() =>
        expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/api/tools/react"))).toBe(true),
      );
      // A 502 is not a refusal — the wall is for 402s only.
      expect(walls).toHaveLength(0);

      // And this is what makes the wall load-bearing above: the row simply returns to queued.
      // Nothing on screen says the run was refused rather than never attempted.
      await waitFor(() =>
        expect(screen.getByText(/Nobody tells you the first 10k/)).toBeInTheDocument(),
      );
      expect(screen.queryByText(/credit/i)).toBeNull();
    } finally {
      window.removeEventListener(CREDIT_WALL_EVENT, onWall);
    }
  });
});
