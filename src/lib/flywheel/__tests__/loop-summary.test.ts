import { describe, expect, it } from "vitest";
import { buildLoopReceipts, buildLoopAccuracy, relativeWhen } from "../loop-summary";
import type { Reconciliation } from "../reconciliation-repo";
import type { Disposition } from "@/lib/audience/audience-types";

const NOW = Date.UTC(2026, 6, 6, 12, 0, 0); // fixed reference (no Date.now in tests)

function predicted(): Record<Disposition, number> {
  return { scanner: 0.2, skeptic: 0.1, collector: 0.2, connector: 0.2, converter: 0.1, lurker: 0.2 };
}

function row(over: Partial<Reconciliation>): Reconciliation {
  return {
    id: "r",
    user_id: "u",
    outcome_signature_id: "o",
    audience_id: null,
    niche: null,
    goal_intent: null,
    follower_tier: null,
    predicted_vector: predicted(),
    realized_vector: { collector: 0.6, connector: 0.4 }, // → 90% match, savers-stronger
    divergence_vector: {},
    classification: {},
    proposal_state: "logged",
    proposed_delta: null,
    confirmed_at: null,
    created_at: new Date(NOW).toISOString(),
    ...over,
  };
}

describe("relativeWhen", () => {
  it("labels today / yesterday / days / weeks", () => {
    expect(relativeWhen(new Date(NOW).toISOString(), NOW)).toBe("today");
    expect(relativeWhen(new Date(NOW - 86_400_000).toISOString(), NOW)).toBe("yesterday");
    expect(relativeWhen(new Date(NOW - 3 * 86_400_000).toISOString(), NOW)).toBe("3d ago");
    expect(relativeWhen(new Date(NOW - 14 * 86_400_000).toISOString(), NOW)).toBe("2w ago");
  });
});

describe("buildLoopReceipts", () => {
  it("maps each row to a match %, standout, and when-label", () => {
    const receipts = buildLoopReceipts([row({ id: "a" })], NOW);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      id: "a",
      matchPct: 90,
      headline: "Your savers showed up stronger than the room predicted.",
      whenLabel: "today",
    });
  });
});

describe("buildLoopAccuracy", () => {
  it("returns null when there are no rows", () => {
    expect(buildLoopAccuracy([])).toBeNull();
  });

  it("returns null when no row is comparable (public metrics too thin)", () => {
    // single-disposition realized → no matchPct
    expect(buildLoopAccuracy([row({ realized_vector: { collector: 1.0 } })])).toBeNull();
  });

  it("averages the comparable matches and counts them", () => {
    const acc = buildLoopAccuracy([
      row({ id: "a", realized_vector: { collector: 0.6, connector: 0.4 } }), // 90
      row({ id: "b", realized_vector: { collector: 0.5, connector: 0.5 } }), // 100
    ]);
    expect(acc).not.toBeNull();
    expect(acc!.pct).toBe(95);
    expect(acc!.n).toBe(2);
    expect(acc!.trendPts).toBeNull(); // < 4 → no trend
  });

  it("computes a trend (recent − older) with >= 4 measured posts", () => {
    // newest-first: two 100% then two 80% → recent 100, older 80 → +20
    const strong = { collector: 0.5, connector: 0.5 }; // 100
    const weak = { collector: 0.7, connector: 0.3 }; // 80
    const acc = buildLoopAccuracy([
      row({ id: "a", realized_vector: strong }),
      row({ id: "b", realized_vector: strong }),
      row({ id: "c", realized_vector: weak }),
      row({ id: "d", realized_vector: weak }),
    ]);
    expect(acc!.trendPts).toBe(20);
  });
});
