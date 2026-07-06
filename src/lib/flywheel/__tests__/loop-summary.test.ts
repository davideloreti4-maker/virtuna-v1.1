import { describe, expect, it } from "vitest";
import {
  buildLoopReceipts,
  buildLoopAccuracy,
  buildReceiptMetrics,
  compactCount,
  relativeWhen,
} from "../loop-summary";
import type { LoopRow } from "../reconciliation-repo";
import type { Disposition } from "@/lib/audience/audience-types";

const NOW = Date.UTC(2026, 6, 6, 12, 0, 0); // fixed reference (no Date.now in tests)

function predicted(): Record<Disposition, number> {
  return { scanner: 0.2, skeptic: 0.1, collector: 0.2, connector: 0.2, converter: 0.1, lurker: 0.2 };
}

function row(over: Partial<LoopRow>): LoopRow {
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

describe("compactCount", () => {
  it("formats reach honestly (no trailing .0)", () => {
    expect(compactCount(940)).toBe("940");
    expect(compactCount(12_000)).toBe("12K");
    expect(compactCount(12_400)).toBe("12.4K");
    expect(compactCount(999_000)).toBe("999K");
    expect(compactCount(1_200_000)).toBe("1.2M");
    expect(compactCount(63_900_000)).toBe("63.9M");
    expect(compactCount(0)).toBe("0");
    expect(compactCount(-5)).toBe("0"); // never a negative count
  });
});

describe("buildReceiptMetrics", () => {
  it("returns [] when nothing was captured", () => {
    expect(buildReceiptMetrics(null)).toEqual([]);
    expect(buildReceiptMetrics(undefined)).toEqual([]);
    expect(buildReceiptMetrics({})).toEqual([]);
  });

  it("picks views first then the strongest engagement signal, capped at 2", () => {
    const m = buildReceiptMetrics({ views: 12_400, likes: 800, saves: 340, shares: 20 });
    expect(m).toEqual([
      { value: "12.4K", label: "views" },
      { value: "340", label: "saves" }, // saves outranks likes/shares
    ]);
  });

  it("skips null/absent channels and falls through the priority order", () => {
    const m = buildReceiptMetrics({ views: null, saves: null, likes: 1_500, comments: 12 });
    expect(m).toEqual([
      { value: "1.5K", label: "likes" },
      { value: "12", label: "comments" },
    ]);
  });
});

describe("buildLoopReceipts", () => {
  it("maps each row to a match %, standout, when-label, real numbers, and link", () => {
    const receipts = buildLoopReceipts(
      [
        row({
          id: "a",
          outcome: {
            platform_post_url: "https://tiktok.com/@me/video/1",
            posted_at: null,
            raw_metrics: { views: 12_400, saves: 340 },
          },
        }),
      ],
      NOW,
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      id: "a",
      matchPct: 90,
      headline: "Your savers showed up stronger than the room predicted.",
      whenLabel: "today",
      metrics: [
        { value: "12.4K", label: "views" },
        { value: "340", label: "saves" },
      ],
      link: "https://tiktok.com/@me/video/1",
    });
  });

  it("degrades honestly when no signature is embedded (no numbers, no link)", () => {
    const receipts = buildLoopReceipts([row({ id: "b" })], NOW);
    expect(receipts[0]!.metrics).toEqual([]);
    expect(receipts[0]!.link).toBeNull();
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
