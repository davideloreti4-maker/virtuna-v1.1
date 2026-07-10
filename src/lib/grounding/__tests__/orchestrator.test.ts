import { describe, it, expect } from "vitest";
import { handleFromUrl, toRetrievedExample } from "../orchestrator";
import type { RankedOutlier } from "@/lib/discover/outlier-compute";
import type { Teardown } from "../types";

describe("handleFromUrl", () => {
  it("parses a bare lowercased handle from a TikTok url", () => {
    expect(handleFromUrl("https://www.tiktok.com/@SreneStrawberry/video/123")).toBe("srenestrawberry");
    expect(handleFromUrl("https://tiktok.com/@a.b_c/video/9")).toBe("a.b_c");
  });
  it("returns null when no handle is present", () => {
    expect(handleFromUrl("https://tiktok.com/video/1")).toBeNull();
    expect(handleFromUrl(null)).toBeNull();
    expect(handleFromUrl(undefined)).toBeNull();
  });
});

const ranked = (): RankedOutlier => ({
  platformVideoId: "123",
  videoUrl: "https://tiktok.com/@srenestrawberry/video/123",
  caption: "cottage cheese eggs",
  views: 14_700_000,
  likes: 100,
  comments: 10,
  shares: 5,
  saves: 2,
  hashtags: ["highprotein"],
  durationSeconds: 20,
  postedAt: new Date("2026-07-01T00:00:00Z"),
  multiplier: 178.3,
  baselineLabel: "vs niche",
  rankKey: 178.3,
});

const teardown = (): Teardown => ({
  spokenHook: "Stop buying protein bars.",
  hookSource: "caption_fallback",
  hookArchetype: "contrarian",
  format: "problem-solution",
  visualHook: null,
  editingStyle: null,
  signatureSeries: null,
  idea: { seed: "s", angle: "a", belief: "b", reality: "r", evidence: "e" },
  template: { name: "Myth-swap", slots: [], skeleton: ["myth", "swap"], guidance: "g" },
  whyItWorks: "pattern interrupt",
  raw: null,
});

describe("toRetrievedExample", () => {
  it("carries the durable receipt + structure + honest source metadata", () => {
    const ex = toRetrievedExample({
      teardownId: "td-1",
      platform: "tiktok",
      ranked: ranked(),
      teardown: teardown(),
      multiplier: 9.2, // durable views÷followers, distinct from the cheap 178.3×
      baselineLabel: "vs followers",
      fitLabel: "adjacent",
      sourcePool: "scraped",
      trustWeight: 0.6,
    });
    expect(ex.handle).toBe("srenestrawberry");
    expect(ex.multiplier).toBe(9.2);
    expect(ex.baselineLabel).toBe("vs followers");
    expect(ex.views).toBe(14_700_000);
    expect(ex.template?.skeleton).toEqual(["myth", "swap"]);
    expect(ex.hookArchetype).toBe("contrarian");
    expect(ex.sourcePool).toBe("scraped");
    expect(ex.fromPersonal).toBe(false);
    expect(ex.fitLabel).toBe("adjacent");
  });
});
