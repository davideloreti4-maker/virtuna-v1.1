/** @vitest-environment happy-dom */
/**
 * IdeaCard — the /start daily-idea glance card. These tests pin the GROUNDING cue (§11f):
 * a compact <ProofLine> attribution renders ONLY when the idea was attributed to a real
 * source (proof carrying a nameable handle). Ungrounded runs (flag OFF) and handle-less
 * proofs render byte-identically to the pre-grounding card — the honesty spine.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { IdeaCard } from "../idea-card";
import type { LiveIdeaCard } from "@/lib/surfaces/live-cards";
import type { HookProof } from "@/lib/tools/blocks";

afterEach(cleanup);

const personas: LiveIdeaCard["personas"] = [
  { archetype: "The Skeptic", verdict: "stop", quote: "Okay this actually got me." },
  { archetype: "The Scroller", verdict: "scroll", quote: "Seen it before." },
];

const proof: HookProof = {
  handle: "growthmentor",
  videoUrl: "https://tiktok.com/@growthmentor/video/1",
  coverUrl: null,
  hookTemplate: "The [specific thing] that makes you look [outcome]",
  archetype: "secret-reveal-breakdown",
  multiplier: 3.2,
  views: 1_200_000,
  baselineLabel: "vs followers",
  fitLabel: "adjacent",
};

const base: LiveIdeaCard = {
  contentId: "idea-0",
  type: "Reel",
  title: "The Specific Text That Makes You Look Desperate",
  personas,
};

describe("IdeaCard grounding cue", () => {
  it("shows the ProofLine attribution when the idea is grounded (proof has a handle)", () => {
    render(<IdeaCard idea={{ ...base, proof }} onOpen={() => {}} />);
    // handle + outlier multiplier are the compelling "grounded in a real winner" signal
    expect(screen.getByText("@growthmentor")).toBeTruthy();
    expect(screen.getByText(/3\.2/)).toBeTruthy();
  });

  it("shows NO attribution when ungrounded (no proof) — pre-grounding shape preserved", () => {
    render(<IdeaCard idea={base} onOpen={() => {}} />);
    expect(screen.queryByText("@growthmentor")).toBeNull();
    expect(screen.queryByText(/3\.2/)).toBeNull();
  });

  it("shows NO attribution when the proof lacks a handle (honesty spine — no nameable source)", () => {
    render(<IdeaCard idea={{ ...base, proof: { ...proof, handle: "" } }} onOpen={() => {}} />);
    // the whole ProofLine is skipped, so its distinctive multiplier never renders
    expect(screen.queryByText(/3\.2/)).toBeNull();
  });
});
