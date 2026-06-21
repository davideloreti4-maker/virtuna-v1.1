/**
 * account-read.test.ts — TDD RED/GREEN for generateAccountRead (10-05 Task 1, SELF-01/02/03).
 *
 * "A Read on your own account" — the know-thyself companion to Discover's know-thy-competitor.
 * Scrapes the creator's own history → recurring hook/format patterns, drop-points,
 * working-vs-fix → honest thin-history fallback (carries P7 D-06), accuracy track record
 * sourced from the flywheel's craft-error reconciliation rows.
 *
 * Covers:
 *  - thin/empty history → { fallback: 'thin' } with NO fabricated patterns (SELF-02)
 *  - scrape failure → { error: 'scrape_failed' } (distinct from thin)
 *  - rich input → an AccountReadResult with recurringHooks / formatMix / dropPoints / working / fix
 *  - "fix" derives from CRAFT-disposition reconciliation rows ONLY (D-03b, model never mutated)
 *  - track record WITHHELD below the row threshold, PRESENT above it (SELF-03)
 *  - the thin gate reuses the P7 rule exactly (getFollowerTier===null AND videos<THIN_MIN_VIDEOS)
 *  - determinism: same input → same patterns
 */

import { describe, it, expect } from "vitest";
import {
  generateAccountRead,
  THIN_MIN_VIDEOS,
  TRACK_RECORD_MIN_ROWS,
  type AccountReadResult,
} from "../account-read";
import type { ProfileData, VideoData } from "@/lib/scraping/types";
import type { Reconciliation } from "@/lib/flywheel/reconciliation-repo";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeProfile(over: Partial<ProfileData> = {}): ProfileData {
  return {
    handle: "creator",
    displayName: "Creator",
    bio: "",
    avatarUrl: "",
    verified: false,
    followerCount: 50_000,
    followingCount: 100,
    heartCount: 1_000_000,
    videoCount: 40,
    ...over,
  };
}

function makeVideo(over: Partial<VideoData> = {}): VideoData {
  return {
    platformVideoId: Math.random().toString(36).slice(2),
    videoUrl: "https://www.tiktok.com/@creator/video/1",
    caption: "How I doubled my reach in 30 days",
    views: 10_000,
    likes: 500,
    comments: 20,
    shares: 10,
    saves: 40,
    hashtags: ["growth"],
    durationSeconds: 30,
    postedAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

/** 30 rich videos with a recurring "How I/How to" hook opening + a mix of durations. */
function makeRichVideos(): VideoData[] {
  const captions = [
    "How I doubled my reach in 30 days",
    "How to grow on TikTok fast",
    "How I went viral with one hook",
    "3 things that changed my content",
    "Why your hooks are failing",
  ];
  return Array.from({ length: 30 }, (_, i) =>
    makeVideo({
      platformVideoId: `v${i}`,
      caption: captions[i % captions.length],
      views: 5_000 + i * 1_000,
      durationSeconds: i % 2 === 0 ? 22 : 58,
    }),
  );
}

function makeReconciliation(
  over: Partial<Reconciliation> = {},
): Reconciliation {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: "u1",
    outcome_signature_id: null,
    audience_id: "aud-1",
    niche: null,
    goal_intent: "grow",
    follower_tier: "micro",
    predicted_vector: { scanner: 0.5, lurker: 0.4 },
    realized_vector: { scanner: 0.2, lurker: 0.7 },
    divergence_vector: { scanner: -0.3, lurker: 0.3 },
    classification: { scanner: "craft", lurker: "craft" },
    proposal_state: "logged",
    proposed_delta: null,
    confirmed_at: null,
    created_at: "2026-02-01T00:00:00Z",
    ...over,
  };
}

/** A scraping provider stub — controls profile/videos/throw behaviour per test. */
function makeProvider(opts: {
  profile?: ProfileData;
  videos?: VideoData[];
  throwOn?: "profile" | "videos";
}) {
  return {
    async scrapeProfile(_handle: string): Promise<ProfileData> {
      if (opts.throwOn === "profile") throw new Error("apify down");
      return opts.profile ?? makeProfile();
    },
    async scrapeVideos(_handle: string, _limit?: number): Promise<VideoData[]> {
      if (opts.throwOn === "videos") throw new Error("apify down");
      return opts.videos ?? [];
    },
  };
}

const RICH_DEPS = (recs: Reconciliation[] = []) => ({
  reconciliations: recs,
  analysisHistory: [] as never[],
});

// ─── Thin gate (SELF-02) ─────────────────────────────────────────────────────

describe("generateAccountRead — thin gate (SELF-02, carries P7 D-06)", () => {
  it("thin history (no follower tier + < THIN_MIN_VIDEOS) → { fallback: 'thin' }, NO patterns", async () => {
    const provider = makeProvider({
      profile: makeProfile({ followerCount: 0 }),
      videos: [makeVideo(), makeVideo()], // 2 < THIN_MIN_VIDEOS
    });

    const result = await generateAccountRead(
      "creator",
      "u1",
      RICH_DEPS(),
      provider,
    );

    expect(result).toEqual({ fallback: "thin" });
    // NEVER fabricate patterns on a thin account.
    expect("patterns" in result).toBe(false);
    expect("recurringHooks" in result).toBe(false);
  });

  it("empty history (0 videos, 0 followers) → { fallback: 'thin' }", async () => {
    const provider = makeProvider({
      profile: makeProfile({ followerCount: 0 }),
      videos: [],
    });
    const result = await generateAccountRead("creator", "u1", RICH_DEPS(), provider);
    expect(result).toEqual({ fallback: "thin" });
  });

  it("does NOT fall back when follower tier is present even with few videos", async () => {
    const provider = makeProvider({
      profile: makeProfile({ followerCount: 50_000 }), // micro tier present
      videos: [makeVideo(), makeVideo()],
    });
    const result = await generateAccountRead("creator", "u1", RICH_DEPS(), provider);
    expect("fallback" in result).toBe(false);
  });

  it("THIN_MIN_VIDEOS matches the P7 calibration constant (10)", () => {
    expect(THIN_MIN_VIDEOS).toBe(10);
  });
});

// ─── Scrape error (distinct from thin) ───────────────────────────────────────

describe("generateAccountRead — scrape error", () => {
  it("profile scrape throws → { error: 'scrape_failed' } (NOT a thin fallback)", async () => {
    const provider = makeProvider({ throwOn: "profile" });
    const result = await generateAccountRead("creator", "u1", RICH_DEPS(), provider);
    expect("error" in result && result.error).toBe("scrape_failed");
    expect("fallback" in result).toBe(false);
  });

  it("videos scrape throws → { error: 'scrape_failed' }", async () => {
    const provider = makeProvider({ throwOn: "videos" });
    const result = await generateAccountRead("creator", "u1", RICH_DEPS(), provider);
    expect("error" in result && result.error).toBe("scrape_failed");
  });
});

// ─── Rich pattern extraction (SELF-01) ───────────────────────────────────────

describe("generateAccountRead — rich pattern extraction (SELF-01)", () => {
  it("rich input → patterns: recurringHooks / formatMix / dropPoints / working / fix", async () => {
    const provider = makeProvider({ videos: makeRichVideos() });
    const result = await generateAccountRead("creator", "u1", RICH_DEPS(), provider);

    expect("patterns" in result).toBe(true);
    const r = result as Extract<AccountReadResult, { patterns: unknown }>;
    expect(Array.isArray(r.patterns.recurringHooks)).toBe(true);
    expect(r.patterns.recurringHooks.length).toBeGreaterThan(0);
    expect(Array.isArray(r.patterns.formatMix)).toBe(true);
    expect(r.patterns.formatMix.length).toBeGreaterThan(0);
    expect(Array.isArray(r.patterns.dropPoints)).toBe(true);
    expect(Array.isArray(r.patterns.working)).toBe(true);
    expect(r.patterns.working.length).toBeGreaterThan(0);
    expect(Array.isArray(r.patterns.fix)).toBe(true);
  });

  it("surfaces the recurring 'How I/How to' hook opening from captions", async () => {
    const provider = makeProvider({ videos: makeRichVideos() });
    const result = await generateAccountRead("creator", "u1", RICH_DEPS(), provider);
    const r = result as Extract<AccountReadResult, { patterns: unknown }>;
    const joined = r.patterns.recurringHooks.join(" ").toLowerCase();
    expect(joined).toContain("how");
  });

  it("is deterministic — same input yields the same patterns", async () => {
    const videos = makeRichVideos();
    const a = await generateAccountRead("creator", "u1", RICH_DEPS(), makeProvider({ videos }));
    const b = await generateAccountRead("creator", "u1", RICH_DEPS(), makeProvider({ videos }));
    expect(a).toEqual(b);
  });
});

// ─── "fix" guidance from craft-error reconciliations (D-03b) ─────────────────

describe("generateAccountRead — fix guidance sourced from craft reconciliations (D-03b)", () => {
  it("derives 'fix' from CRAFT-disposition divergences ONLY", async () => {
    const provider = makeProvider({ videos: makeRichVideos() });
    const recs = [
      makeReconciliation({
        // craft divergence: lurker (HOW-WELL) — should surface as a fix
        divergence_vector: { lurker: 0.4 },
        classification: { lurker: "craft" },
      }),
      makeReconciliation({
        // calibration divergence: connector (WHO) — must NOT surface as a craft fix
        divergence_vector: { connector: 0.5 },
        classification: { connector: "calibration" },
      }),
    ];
    const result = await generateAccountRead("creator", "u1", RICH_DEPS(recs), provider);
    const r = result as Extract<AccountReadResult, { patterns: unknown }>;
    const fixText = r.patterns.fix.join(" ").toLowerCase();
    expect(fixText).toContain("lurker");
    // calibration disposition (connector) must never leak into the craft "fix" list
    expect(fixText).not.toContain("connector");
  });

  it("no craft reconciliations → empty fix list (never fabricated)", async () => {
    const provider = makeProvider({ videos: makeRichVideos() });
    const result = await generateAccountRead("creator", "u1", RICH_DEPS([]), provider);
    const r = result as Extract<AccountReadResult, { patterns: unknown }>;
    expect(r.patterns.fix).toEqual([]);
  });
});

// ─── Accuracy track record (SELF-03) ─────────────────────────────────────────

describe("generateAccountRead — accuracy track record (SELF-03)", () => {
  it("withholds the track record below the row threshold", async () => {
    const provider = makeProvider({ videos: makeRichVideos() });
    const fewRecs = Array.from({ length: TRACK_RECORD_MIN_ROWS - 1 }, () =>
      makeReconciliation(),
    );
    const result = await generateAccountRead("creator", "u1", RICH_DEPS(fewRecs), provider);
    const r = result as Extract<AccountReadResult, { patterns: unknown }>;
    expect(r.trackRecord).toBeNull();
  });

  it("present above the threshold — { withinPct, lastN } computed from the divergence trend", async () => {
    const provider = makeProvider({ videos: makeRichVideos() });
    const recs = Array.from({ length: TRACK_RECORD_MIN_ROWS }, () =>
      makeReconciliation({ divergence_vector: { scanner: -0.1, lurker: 0.1 } }),
    );
    const result = await generateAccountRead("creator", "u1", RICH_DEPS(recs), provider);
    const r = result as Extract<AccountReadResult, { patterns: unknown }>;
    expect(r.trackRecord).not.toBeNull();
    expect(typeof r.trackRecord!.withinPct).toBe("number");
    expect(r.trackRecord!.withinPct).toBeGreaterThanOrEqual(0);
    expect(r.trackRecord!.withinPct).toBeLessThanOrEqual(100);
    expect(r.trackRecord!.lastN).toBe(TRACK_RECORD_MIN_ROWS);
  });

  it("SELF-03 empty-track-record path: rich account, zero reconciliations → patterns present, trackRecord null", async () => {
    const provider = makeProvider({ videos: makeRichVideos() });
    const result = await generateAccountRead("creator", "u1", RICH_DEPS([]), provider);
    const r = result as Extract<AccountReadResult, { patterns: unknown }>;
    expect("patterns" in r).toBe(true);
    expect(r.trackRecord).toBeNull();
  });
});
