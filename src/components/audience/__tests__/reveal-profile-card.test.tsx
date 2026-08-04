/** @vitest-environment happy-dom */
/**
 * Regression lock — the reveal's profile card must not be shrinkable.
 *
 * ORIGIN (2026-08-04): the card rendered SLICED on the payoff screen of a ~2 minute wait —
 * "GaryVee ✓" cut through horizontally at 1512 and at 390. Measured on a live @garyvee
 * calibration: the card's box was 34px tall while the 48px avatar inside it ran 177.5→225.5,
 * and `READING_CARD` leads with `overflow-hidden`, so the card clipped its own content.
 *
 * The cause is flex shrink in the reveal's bounded column, NOT scrolling — `scrollTop` was 0 on
 * every measurement. A flex item's `min-height: auto` resolves to its content height, which is
 * what protects the column's five other children; the spec zeroes that minimum for any item
 * whose `overflow` is not `visible`, and this card is the only child carrying `overflow-hidden`.
 * So it alone absorbed the column's entire overage: 56→34px at 1512, 61→34px at 390.
 *
 * ⚠️ This asserts the CLASS, not the geometry, and that limit is the point: happy-dom has no
 * layout engine, so `offsetHeight` is 0 here and the squash is invisible to any DOM assertion.
 * The real gate is a browser measurement (card height 82px @1512 / 92px @390, zero clipped
 * cards) — this test only stops the class from being deleted between those runs.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import type { Audience } from "@/lib/audience/audience-types";
import type { RevealData } from "@/lib/audience/calibration";
import { AudienceReveal } from "../audience-reveal";

const AUDIENCE = {
  id: "aud-reveal",
  name: "@garyvee",
  calibration: { handle: "garyvee" },
  signature: {
    summary: "A summary.",
    audience: {
      personas: [
        {
          share: 0.5,
          archetype: "loyalist",
          display_name: "The Day One Disciple",
          reaction_frame: "Defends him against critics.",
        },
      ],
      interest_tags: ["tough_love"],
      what_resonates: "Aggressive hooks.",
    },
    provenance: {
      handle: "garyvee",
      videos_analyzed: 12,
      videos_watched: 4,
      sub_coverage: "12/12",
    },
  },
} as unknown as Audience;

const REVEAL: RevealData = {
  profile: {
    handle: "garyvee",
    displayName: "GaryVee",
    bio: "",
    avatarUrl: "",
    verified: true,
    followerCount: 15_400_000,
    heartCount: 369_700_000,
    videoCount: 6_400,
  },
  posts: [{ plays: 128_000, saveRate: 4, shareRate: 1, caption: "" }],
};

describe("AudienceReveal — profile card", () => {
  it("cannot be shrunk by the bounded column it sits in", () => {
    const { container } = render(
      <AudienceReveal audience={AUDIENCE} reveal={REVEAL} onUse={() => {}} />,
    );

    const column = container.querySelector(".overflow-y-auto");
    expect(column).not.toBeNull();

    const card = Array.from(column!.children).find((el) =>
      el.textContent?.includes("GaryVee"),
    );
    expect(card, "the profile card is a direct child of the bounded column").toBeDefined();

    // `overflow-hidden` is what zeroes this item's automatic minimum size — it is the whole
    // reason the guard is needed, so assert it is still the condition being guarded against.
    expect(card!.className).toContain("overflow-hidden");
    expect(card!.className).toContain("shrink-0");
  });

  it("leaves the column's other children alone — they keep a content-based minimum", () => {
    const { container } = render(
      <AudienceReveal audience={AUDIENCE} reveal={REVEAL} onUse={() => {}} />,
    );

    const column = container.querySelector(".overflow-y-auto")!;
    const unprotected = Array.from(column.children).filter(
      (el) => el.className.includes("overflow-hidden") && !el.className.includes("shrink-0"),
    );

    expect(
      unprotected.map((el) => el.className),
      "a new overflow-hidden child of this column inherits the squash — give it shrink-0",
    ).toEqual([]);
  });
});
