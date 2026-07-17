/**
 * §P BUILD step 4 — calibration.ts (real signature) + legacy helpers.
 *
 * calibrateFromScrape now scrapes a bundle → enriches → frozen AudienceSignature. All I/O
 * is injected via CalibrationDeps (scrapeBundle / scrapeNiche / enrich) so tests run with
 * zero network/LLM. Covers:
 *   1. success path → audience + signature + 10 reactors + reality-first weights
 *   2. scrape throw → scrape_failed (distinct from thin)
 *   3. enrich throw → scrape_failed
 *   4. thin account + thin niche → general fallback (honesty spine, never fabricates)
 *   5. thin account + rich niche → success via niche fallback (NOT dead-end to General)
 *   6. legacy deriveAudienceProfile / repaintPersonas unchanged
 */

import { describe, it, expect, vi } from "vitest";
import type { ProfileData, VideoData, ProfileBundle } from "@/lib/scraping/types";
import type { AudienceSignature } from "../audience-types";

import {
  calibrateFromScrape,
  THIN_MIN_VIDEOS,
} from "../calibration";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeProfile(followerCount: number): ProfileData {
  return {
    handle: "testcreator",
    displayName: "Test Creator",
    bio: "Making content daily #productivity #adhd",
    avatarUrl: "https://example.com/avatar.jpg",
    verified: false,
    followerCount,
    followingCount: 500,
    heartCount: 100_000,
    videoCount: 50,
  };
}

function makeVideos(count: number): VideoData[] {
  return Array.from({ length: count }, (_, i) => ({
    platformVideoId: `vid_${i}`,
    videoUrl: `https://tiktok.com/@testcreator/video/${i}`,
    caption: `Video caption ${i} #content #creator`,
    views: 1000 + i * 100,
    likes: 100 + i * 10,
    comments: 10 + i,
    shares: 5 + i,
    saves: 3 + i,
    hashtags: ["content", "creator"],
    durationSeconds: 30,
    postedAt: new Date("2026-06-01"),
  }));
}

function makeBundle(followerCount: number, videoCount: number): ProfileBundle {
  const videos = makeVideos(videoCount);
  return { profile: makeProfile(followerCount), videos, subCoverage: `${videos.length}/${videos.length}` };
}

function makeSignature(): AudienceSignature {
  return {
    creator_persona: {
      content_description: "ADHD productivity",
      context: "Audience: founders. Voice: blunt. AVOID: hype.",
      writing_style_sample: "Hook alignment...",
      format_signature: "fast-cut talking head",
    },
    audience: {
      follower_tier: "mid",
      maturity: "established",
      temperature_mix: { cold: 0.2, warm: 0.5, hot: 0.3 },
      interest_tags: ["adhd", "productivity"],
      what_resonates: "step-by-step saves",
      what_falls_flat: "storytime",
      persona_weights: { fyp: 0.55, niche: 0.3, loyalist: 0.1, cross_niche: 0.05 },
      personas: ARCHETYPES.map((archetype) => ({
        archetype,
        share: 0.1,
        temperature: "warm" as const,
        disposition: "connector" as const,
        reaction_frame: `frame ${archetype}`,
        evidence: "saves 2x",
      })),
    },
    summary: "warm save-heavy crowd",
    provenance: { handle: "testcreator", scraped_at: "2026-06-24T00:00:00.000Z", videos_analyzed: 15, videos_watched: 5, sub_coverage: "6/8" },
  };
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    scrapeBundle: vi.fn(async () => makeBundle(50_000, 15)),
    scrapeNiche: vi.fn(async () => makeVideos(20)),
    enrich: vi.fn(async () => makeSignature()),
    ...overrides,
  };
}

const BASE_INPUT = {
  handle: "testcreator",
  type: "personal" as const,
  platform: "tiktok" as const,
  goalIntent: "grow" as const,
  name: "My Audience",
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("THIN_MIN_VIDEOS", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(THIN_MIN_VIDEOS)).toBe(true);
    expect(THIN_MIN_VIDEOS).toBeGreaterThan(0);
  });
});

describe("calibrateFromScrape — success path (real signature)", () => {
  it("returns { audience } with the frozen signature + 10 reactors", async () => {
    const deps = makeDeps();
    const result = await calibrateFromScrape(BASE_INPUT, deps);

    expect(result).toHaveProperty("audience");
    const { audience } = result as { audience: { signature: AudienceSignature; personas: unknown[]; creator_persona: unknown } };
    expect(audience.signature.audience.personas).toHaveLength(10);
    expect(audience.personas).toHaveLength(10); // legacy back-compat populated too
    expect(audience.creator_persona).toBeTruthy();
  });

  // v2 (Audience Sim v2, Stage 1): the roster's presentation label is seeded from the generator's
  // custom display_name, so the ambient audience shows "The Archive Builder", not "Saver".
  it("seeds each roster persona's label from the signature persona's display_name", async () => {
    const sig = makeSignature();
    sig.audience.personas = sig.audience.personas.map((p, i) => ({ ...p, display_name: `Custom ${i}` }));
    const result = await calibrateFromScrape(BASE_INPUT, makeDeps({ enrich: vi.fn(async () => sig) }));
    const { audience } = result as { audience: { personas: Array<{ label?: string }> } };
    expect(audience.personas[0]!.label).toBe("Custom 0");
    expect(audience.personas.every((p, i) => p.label === `Custom ${i}`)).toBe(true);
  });

  it("is legacy-safe — a signature without display_name leaves roster labels undefined (falls back to archetype)", async () => {
    const result = await calibrateFromScrape(BASE_INPUT, makeDeps());
    const { audience } = result as { audience: { personas: Array<{ label?: string }> } };
    expect(audience.personas[0]!.label).toBeUndefined();
  });

  it("bakes the DERIVED weights into persona_weights (reality first, P-5 — not goal-intent bias)", async () => {
    const result = await calibrateFromScrape(BASE_INPUT, makeDeps());
    const { audience } = result as unknown as { audience: { persona_weights: Record<string, number> } };
    expect(audience.persona_weights).toEqual({ fyp: 0.55, niche: 0.3, loyalist: 0.1, cross_niche: 0.05 });
  });

  it("calls scrapeBundle (1-scrape collapse), not the legacy parallel pair", async () => {
    const deps = makeDeps();
    await calibrateFromScrape(BASE_INPUT, deps);
    expect(deps.scrapeBundle).toHaveBeenCalledWith("testcreator");
    expect(deps.enrich).toHaveBeenCalledTimes(1);
  });
});

describe("calibrateFromScrape — scrape_failed (distinct from thin)", () => {
  it("returns { error:'scrape_failed' } when the bundle scrape throws", async () => {
    const deps = makeDeps({ scrapeBundle: vi.fn(async () => { throw new Error("Network timeout"); }) });
    const result = await calibrateFromScrape(BASE_INPUT, deps);
    expect(result).toHaveProperty("error", "scrape_failed");
    expect(result).not.toHaveProperty("audience");
  });

  it("returns { error:'scrape_failed' } when enrichment throws", async () => {
    const deps = makeDeps({ enrich: vi.fn(async () => { throw new Error("synthesis validation failed"); }) });
    const result = await calibrateFromScrape(BASE_INPUT, deps);
    expect(result).toHaveProperty("error", "scrape_failed");
  });
});

describe("calibrateFromScrape — thin fallback (honesty spine D-06)", () => {
  it("falls back to General ONLY when both the account AND the niche are thin", async () => {
    const deps = makeDeps({
      scrapeBundle: vi.fn(async () => makeBundle(0, THIN_MIN_VIDEOS - 1)),
      scrapeNiche: vi.fn(async () => makeVideos(THIN_MIN_VIDEOS - 1)),
    });
    const result = await calibrateFromScrape(BASE_INPUT, deps);
    expect(result).toEqual({ fallback: "general", reason: "thin" });
    expect(result).not.toHaveProperty("audience");
  });

  it("does NOT dead-end to General: thin account + rich niche → success via niche fallback", async () => {
    const deps = makeDeps({
      scrapeBundle: vi.fn(async () => makeBundle(0, THIN_MIN_VIDEOS - 1)),
      scrapeNiche: vi.fn(async () => makeVideos(20)),
    });
    const result = await calibrateFromScrape(BASE_INPUT, deps);
    expect(result).toHaveProperty("audience");
    expect(deps.scrapeNiche).toHaveBeenCalledTimes(1);
    expect(deps.enrich).toHaveBeenCalledTimes(1);
  });
});

describe("calibrateFromScrape — target path", () => {
  it("target with a reference handle scrapes that profile", async () => {
    const deps = makeDeps();
    await calibrateFromScrape(
      { ...BASE_INPUT, type: "target", handle: "refcreator", description: "productivity founders" },
      deps,
    );
    expect(deps.scrapeBundle).toHaveBeenCalledWith("refcreator");
  });

  it("target with no handle runs a niche search from the description", async () => {
    const deps = makeDeps();
    const result = await calibrateFromScrape(
      { ...BASE_INPUT, type: "target", handle: undefined, description: "small business productivity tools" },
      deps,
    );
    expect(deps.scrapeBundle).not.toHaveBeenCalled();
    expect(deps.scrapeNiche).toHaveBeenCalledTimes(1);
    expect(result).toHaveProperty("audience");
  });
});

// ─── Progress staging (2026-07-14) ──────────────────────────────────────────────
//
// calibrateFromScrape is the ONLY thing that can see the scrape→enrich boundary; the SSE route
// awaits it as one opaque promise. Before this, the route guessed — and guessed wrong (see
// CalibrationStage's docblock). These tests pin the announcement to the work.

describe("calibrateFromScrape — onStage", () => {
  it("announces 'scraping' BEFORE it hits Apify", async () => {
    const timeline: string[] = [];
    const deps = makeDeps({
      scrapeBundle: vi.fn(async () => {
        timeline.push("work:scrape");
        return makeBundle(50_000, 15);
      }),
      onStage: (stage: string) => timeline.push(`stage:${stage}`),
    });

    await calibrateFromScrape(BASE_INPUT, deps);

    expect(timeline[0]).toBe("stage:scraping");
    expect(timeline.indexOf("stage:scraping")).toBeLessThan(timeline.indexOf("work:scrape"));
  });

  it("THREADS onStage into enrichment — the arg that was never passed at all", async () => {
    // The bug in miniature: `enrich(...)` was called with NO deps, so the watch/synthesize
    // phases had no way to report themselves even once a reporter existed.
    const onStage = vi.fn();
    const enrich = vi.fn(async () => makeSignature());
    await calibrateFromScrape(BASE_INPUT, makeDeps({ enrich, onStage }));

    expect(enrich).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ onStage }),
    );
  });

  it("is optional — omitting onStage does not throw (back-compat for every caller)", async () => {
    const result = await calibrateFromScrape(BASE_INPUT, makeDeps());
    expect("audience" in result).toBe(true);
  });
});

// ─── PLATFORM guard — the scrape stack is TikTok-only ──────────────────────────
//
// Live bug (2026-07-14): platform:"instagram" ran a TIKTOK scrape and returned HTTP 200 with a
// full audience, a connected account marked `instagram`, and a snapshot carrying TikTok's
// follower count. `platform` was written onto every row and passed to NOTHING. Because a handle
// is not one identity across platforms, that builds a stranger's audience and calls it yours.
//
// The load-bearing assertion in each test below is `scrapeBundle` NOT being called: an error
// return alone would still pass if we scraped first and threw the result away.
describe("calibrateFromScrape — platform guard", () => {
  for (const platform of ["instagram", "youtube"] as const) {
    it(`refuses ${platform} WITHOUT scraping — no Apify spend, no TikTok data`, async () => {
      const deps = makeDeps();

      const result = await calibrateFromScrape({ ...BASE_INPUT, platform }, deps);

      expect(result).toMatchObject({ error: "platform_unsupported" });
      // THE assertion: the TikTok scraper never ran.
      expect(deps.scrapeBundle).not.toHaveBeenCalled();
      expect(deps.scrapeNiche).not.toHaveBeenCalled();
      expect(deps.enrich).not.toHaveBeenCalled();
    });

    it(`tells the user the truth about ${platform} — never "check the handle"`, async () => {
      const result = await calibrateFromScrape({ ...BASE_INPUT, platform }, makeDeps());
      const { message } = result as { message: string };
      expect(message).toMatch(/TikTok/);
      expect(message).not.toMatch(/check the handle/i);
    });
  }

  it("still calibrates TikTok — the guard does not break the path that works", async () => {
    const deps = makeDeps();
    const result = await calibrateFromScrape({ ...BASE_INPUT, platform: "tiktok" }, deps);
    expect("audience" in result).toBe(true);
    expect(deps.scrapeBundle).toHaveBeenCalledWith("testcreator");
  });

  it("still allows `custom` — the DESCRIBED path claims no platform provenance", async () => {
    const deps = makeDeps();
    const result = await calibrateFromScrape({ ...BASE_INPUT, platform: "custom" }, deps);
    expect("error" in result).toBe(false);
  });
});

describe("calibrateFromScrape — onEvidence (the ~2min wait shows the account it read)", () => {
  it("reports the scraped account + its covers as soon as the scrape returns", async () => {
    const onEvidence = vi.fn();
    const deps = makeDeps({ onEvidence });
    await calibrateFromScrape(BASE_INPUT, deps);

    expect(onEvidence).toHaveBeenCalledTimes(1);
    const evidence = onEvidence.mock.calls[0]![0];
    expect(evidence.handle).toBeTruthy();
    expect(evidence.followerCount).toBe(50_000);
    expect(evidence.videos).toHaveLength(15);
  });

  it("fires BEFORE enrichment — it is proof during the wait, not a result of it", async () => {
    const order: string[] = [];
    const deps = makeDeps({
      onEvidence: vi.fn(() => order.push("evidence")),
      enrich: vi.fn(async () => {
        order.push("enrich");
        return makeSignature();
      }),
    });
    await calibrateFromScrape(BASE_INPUT, deps);

    // The whole point: the account is on screen while the ~2min enrichment is still running.
    expect(order).toEqual(["evidence", "enrich"]);
  });

  it("reports NO evidence on the niche fallback — that profile is synthetic", async () => {
    // A thin account falls back to a niche search and SYNTHESISES a profile. Showing that as
    // "the account we read" would put a face on the screen that we never scraped.
    const onEvidence = vi.fn();
    const deps = makeDeps({
      // Thin = NO follower tier AND too few videos (isThin) → the niche fallback path.
      scrapeBundle: vi.fn(async () => makeBundle(0, THIN_MIN_VIDEOS - 1)),
      scrapeNiche: vi.fn(async () => makeVideos(20)),
      onEvidence,
    });
    const result = await calibrateFromScrape(BASE_INPUT, deps);

    expect("audience" in result || "fallback" in result).toBe(true);
    expect(onEvidence).not.toHaveBeenCalled();
  });

  it("carries the profile's heart + video counts — the reveal figures come from the scrape", async () => {
    const onEvidence = vi.fn();
    const deps = makeDeps({ onEvidence });
    await calibrateFromScrape(BASE_INPUT, deps);

    const evidence = onEvidence.mock.calls[0]![0];
    expect(evidence.heartCount).toBe(100_000);
    expect(evidence.videoCount).toBe(50);
  });
});

describe("calibrateFromScrape — onBundle (one scrape feeds persistence too)", () => {
  it("hands the RAW scraped bundle to the caller on the real-scrape path", async () => {
    // P4 one-scrape: the route persists account_posts from the SAME bundle the
    // calibration read — not a second Apify run. onBundle is that seam.
    const onBundle = vi.fn();
    const deps = makeDeps({ onBundle });
    await calibrateFromScrape(BASE_INPUT, deps);

    expect(onBundle).toHaveBeenCalledTimes(1);
    const bundle = onBundle.mock.calls[0]![0];
    expect(bundle.videos).toHaveLength(15);
    expect(bundle.profile.followerCount).toBe(50_000);
  });

  it("fires NO bundle on the niche fallback — those videos are not the account's", async () => {
    // Niche-search videos belong to strangers; persisting them as the creator's own
    // account_posts would fabricate an archive.
    const onBundle = vi.fn();
    const deps = makeDeps({
      scrapeBundle: vi.fn(async () => makeBundle(0, THIN_MIN_VIDEOS - 1)),
      scrapeNiche: vi.fn(async () => makeVideos(20)),
      onBundle,
    });
    await calibrateFromScrape(BASE_INPUT, deps);

    expect(onBundle).not.toHaveBeenCalled();
  });
});
