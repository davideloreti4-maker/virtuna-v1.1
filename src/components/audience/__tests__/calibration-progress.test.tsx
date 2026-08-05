/** @vitest-environment happy-dom */
/**
 * CalibrationProgress — the shared calibration wait card.
 *
 * What is pinned here is the HONESTY, because every figure on this card is scraped and the
 * component's whole job is to render scraped data without embellishing it:
 *
 *  - the account's own totals, never the scrape window (the @mrbeast "12 VIDEOS" bug)
 *  - a zero figure is OMITTED, never drawn as "0" (Instagram/YouTube expose no total likes)
 *  - no count of what the pipeline pulled or watched appears anywhere (owner call 2026-08-05)
 *  - the verified tick reflects the platform's flag and is never inferred
 *  - a missing avatar/cover degrades to a placeholder, never a broken image
 */

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CalibrationProgress } from "../calibration-progress";
import { CALIBRATION_PLAN } from "@/lib/audience/calibration-stages";
import type { CalibrationEvidence } from "@/lib/audience/calibration";

const EVIDENCE: CalibrationEvidence = {
  handle: "mrbeast",
  displayName: "MrBeast",
  avatarUrl: "https://cdn.example/avatar.jpg",
  followerCount: 132_100_000,
  heartCount: 1_400_000_000,
  videoCount: 4_231,
  verified: true,
  videos: Array.from({ length: 12 }, (_, i) => ({
    coverUrl: `https://cdn.example/${i}.jpg`,
    views: 2_100_000,
  })),
};

function renderCard(evidence: CalibrationEvidence | null, stages = []) {
  return render(
    <CalibrationProgress evidence={evidence} stages={stages} plan={[...CALIBRATION_PLAN]} />,
  );
}

describe("CalibrationProgress — the account's figures", () => {
  it("renders the profile total, not the scraped window", () => {
    renderCard(EVIDENCE);
    const figures = screen.getByTestId("reveal-figures");

    // 4,231 posts, of which 12 were scraped. The card is about the ACCOUNT.
    expect(within(figures).getByText("4.2K")).toBeInTheDocument();
    expect(within(figures).queryByText("12")).not.toBeInTheDocument();
    expect(within(figures).getByText("132.1M")).toBeInTheDocument();
    expect(within(figures).getByText("1.4B")).toBeInTheDocument();
  });

  it("omits a zero figure rather than printing '0'", () => {
    // Instagram and YouTube expose no profile-level total likes, so their remaps set
    // heartCount: 0. That is an absent measurement, not an account with no likes — printing
    // "0 LIKES" would turn one into the other.
    renderCard({ ...EVIDENCE, heartCount: 0 });
    const figures = screen.getByTestId("reveal-figures");

    expect(within(figures).queryByText("Likes")).not.toBeInTheDocument();
    expect(within(figures).queryByText("0")).not.toBeInTheDocument();
    expect(within(figures).getByText("Posts")).toBeInTheDocument();
    expect(within(figures).getByText("Followers")).toBeInTheDocument();
  });

  it("drops the whole figure row when the profile carries nothing measurable", () => {
    renderCard({ ...EVIDENCE, videoCount: 0, followerCount: 0, heartCount: 0 });
    expect(screen.queryByTestId("reveal-figures")).not.toBeInTheDocument();
    // The identity still stands — we did read the account, it just has no totals to show.
    expect(screen.getByTestId("calibration-identity")).toBeInTheDocument();
  });

  it("states no count of what the pipeline pulled or watched", () => {
    renderCard(EVIDENCE);
    const text = screen.getByTestId("calibration-identity").closest("div")?.parentElement
      ?.textContent ?? "";
    expect(text).not.toMatch(/\b12\b/); // the scrape window
    expect(text).not.toMatch(/\b(posts|videos) (pulled|watched|read|analysed|analyzed)\b/i);
    expect(text).not.toMatch(/\d+\s*(of|\/)\s*\d+/); // "5 of 12"
  });
});

describe("CalibrationProgress — identity", () => {
  it("shows the verified tick only when the platform flag says so", () => {
    const { unmount } = renderCard(EVIDENCE);
    expect(screen.getByLabelText("Verified")).toBeInTheDocument();
    unmount();

    renderCard({ ...EVIDENCE, verified: false });
    expect(screen.queryByLabelText("Verified")).not.toBeInTheDocument();
  });

  it("treats an absent `verified` the same as false — never inferred from reach", () => {
    const { verified: _dropped, ...noFlag } = EVIDENCE;
    renderCard(noFlag as CalibrationEvidence);
    // 132M followers and it still gets no tick: we do not know, so we do not claim.
    expect(screen.queryByLabelText("Verified")).not.toBeInTheDocument();
  });

  it("falls back to the handle when the account has no display name", () => {
    renderCard({ ...EVIDENCE, displayName: "" });
    expect(screen.getAllByText("@mrbeast").length).toBeGreaterThan(0);
  });
});

describe("CalibrationProgress — the wait itself", () => {
  it("draws the whole plan before any account or stage frame arrives", () => {
    // The scrape takes ~126s to return. This is what stands there for all of it.
    renderCard(null);
    expect(screen.queryByTestId("calibration-identity")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Reading your followers: active")).toBeInTheDocument();
    expect(screen.getByLabelText("Watching your videos: pending")).toBeInTheDocument();
    expect(screen.getByLabelText("Building your audience profile: pending")).toBeInTheDocument();
  });

  it("overlays live stage frames onto the plan", () => {
    render(
      <CalibrationProgress
        evidence={EVIDENCE}
        stages={[
          { name: "Reading your followers", status: "done" },
          { name: "Watching your videos", status: "active" },
        ]}
        plan={[...CALIBRATION_PLAN]}
      />,
    );
    expect(screen.getByLabelText("Reading your followers: done")).toBeInTheDocument();
    expect(screen.getByLabelText("Watching your videos: active")).toBeInTheDocument();
    expect(screen.getByLabelText("Building your audience profile: pending")).toBeInTheDocument();
  });

  it("falls back to the status line only when there is no plan either", () => {
    render(
      <CalibrationProgress
        evidence={null}
        stages={[]}
        plan={[]}
        statusMsg="Reading the account…"
      />,
    );
    expect(screen.getByTestId("calibration-status")).toHaveTextContent("Reading the account…");
  });
});

describe("CalibrationProgress — the posts", () => {
  it("renders a cover per scraped post with its measured views", () => {
    renderCard(EVIDENCE);
    expect(screen.getAllByTestId("calibration-cover")).toHaveLength(12);
    expect(screen.getAllByText("2.1M").length).toBe(12);
  });

  it("keeps the slot for a post whose cover URL is missing", () => {
    renderCard({
      ...EVIDENCE,
      videos: [{ coverUrl: null, views: 4_000 }],
    });
    const covers = screen.getAllByTestId("calibration-cover");
    expect(covers).toHaveLength(1);
    expect(covers[0]!.querySelector("img")).toBeNull(); // placeholder shows through
    expect(screen.getByText("4K")).toBeInTheDocument();
  });

  it("omits the view overlay when the post has no measured views", () => {
    renderCard({ ...EVIDENCE, videos: [{ coverUrl: null, views: 0 }] });
    expect(screen.getAllByTestId("calibration-cover")).toHaveLength(1);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("caps the grid rather than drawing an unbounded wall of covers", () => {
    renderCard({
      ...EVIDENCE,
      videos: Array.from({ length: 40 }, () => ({ coverUrl: null, views: 100 })),
    });
    expect(screen.getAllByTestId("calibration-cover")).toHaveLength(12);
  });
});
