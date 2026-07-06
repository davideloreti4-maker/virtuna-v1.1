/**
 * explore-rank.test.ts — Phase 11, Plan 01, Task 1 (EXPLORE-03 / D-01 / D-02 / D-03).
 *
 * Behaviour proof for the PURE audience-relative fit re-rank (`rankWithAudienceFit`).
 * Asserts the honesty spine + the prescribed formula envelope (RESEARCH Pattern 2):
 *   - calibrated audience → every tile carries a quantized fit.level (Strong|Fair|Weak),
 *     and NO other fit field (no number, no quote, no verdict — D-02).
 *   - the degrade gate (D-02): General / preset / thin-calibration → every tile fit:null,
 *     and the order is preserved exactly as P8's rankOutliers produced it.
 *   - niche-match: a tile sharing many tokens with the audience niche vocabulary outscores
 *     a tile sharing none (Strong/Fair vs Weak at serendipity 0).
 *   - serendipity widens: raising the valve toward 1 shrinks the niche-match contribution,
 *     so an off-niche tile's level rises relative to serendipity 0.
 *   - determinism: identical inputs → identical levels AND identical order.
 *
 * The fit re-rank is honest math only — NO network, NO SIM, NO fabricated reaction.
 */
import { describe, expect, it } from "vitest";
import { rankWithAudienceFit } from "./explore-rank";
import type { FitLevel } from "./explore-rank";
import type { RankedOutlier } from "./outlier-compute";
import type {
  Audience,
  CalibratedPersona,
  Temperature,
  Disposition,
} from "@/lib/audience/audience-types";
import type { PersonaWeights } from "@/lib/engine/persona-weights";

const NOW = new Date("2026-06-19T00:00:00.000Z");
const DAY = 86_400_000;

const DEFAULT_WEIGHTS: PersonaWeights = {
  fyp: 0.65,
  niche: 0.2,
  loyalist: 0.1,
  cross_niche: 0.05,
};

// ─── Builders ──────────────────────────────────────────────────────────────────

/** A RankedOutlier (rankOutliers output) for the re-rank under test. */
function tile(
  overrides: Partial<RankedOutlier> & { platformVideoId: string },
): RankedOutlier {
  const { platformVideoId, ...rest } = overrides;
  return {
    platformVideoId,
    videoUrl: `https://tiktok.com/@x/video/${platformVideoId}`,
    caption: "",
    views: 10_000,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    hashtags: [],
    durationSeconds: 30,
    postedAt: new Date(NOW.getTime() - 5 * DAY),
    multiplier: 2,
    baselineLabel: "vs niche",
    rankKey: 1,
    ...rest,
  };
}

function persona(
  temperature: Temperature,
  disposition: Disposition,
  share: number,
): CalibratedPersona {
  return {
    archetype: "loyalist",
    repaint: "",
    temperature,
    disposition,
    share,
  };
}

/** A fully-calibrated audience (degrade gate is OPEN → fit present). */
function calibratedAudience(overrides: Partial<Audience> = {}): Audience {
  return {
    id: "aud-1",
    user_id: "user-1",
    name: "vegan meal prep",
    type: "target",
    platform: "tiktok",
    goal_label: "grow my cooking channel",
    goal_intent: "grow",
    is_general: false,
    mode: "socials",
    is_preset: false,
    persona_weights: DEFAULT_WEIGHTS,
    personas: [
      persona("warm", "collector", 0.4),
      persona("hot", "converter", 0.3),
      persona("cold", "scanner", 0.3),
    ],
    profile: {
      temperature_mix: { cold: 0.3, warm: 0.4, hot: 0.3 },
      top_dispositions: ["collector", "converter", "scanner"],
      follower_tier: "10k-100k",
    },
    calibration: { source: "scrape", handle: "chef", scraped_at: "x", thin: false },
    created_at: "x",
    updated_at: "x",
    ...overrides,
  };
}

const LEVELS: ReadonlySet<FitLevel> = new Set(["Strong", "Fair", "Weak"]);

// ─── Degrade gate (D-02) ─────────────────────────────────────────────────────────

describe("rankWithAudienceFit — degrade gate (D-02 honesty spine)", () => {
  const tiles = [
    tile({ platformVideoId: "a", rankKey: 3, caption: "vegan meal prep tips" }),
    tile({ platformVideoId: "b", rankKey: 2, caption: "random gaming clip" }),
    tile({ platformVideoId: "c", rankKey: 1, caption: "vegan recipe" }),
  ];

  it("General audience → every tile fit:null, P8 order preserved", () => {
    const aud = calibratedAudience({ is_general: true });
    const out = rankWithAudienceFit(tiles, aud, 0);
    expect(out.every((t) => t.fit === null)).toBe(true);
    expect(out.map((t) => t.platformVideoId)).toEqual(["a", "b", "c"]);
  });

  it("preset audience → every tile fit:null", () => {
    const aud = calibratedAudience({ is_preset: true });
    const out = rankWithAudienceFit(tiles, aud, 0);
    expect(out.every((t) => t.fit === null)).toBe(true);
    expect(out.map((t) => t.platformVideoId)).toEqual(["a", "b", "c"]);
  });

  it("thin-calibration audience → every tile fit:null", () => {
    const aud = calibratedAudience({
      calibration: { source: "description", thin: true },
    });
    const out = rankWithAudienceFit(tiles, aud, 0);
    expect(out.every((t) => t.fit === null)).toBe(true);
  });

  it("empty personas array → every tile fit:null (no calibrated signal)", () => {
    const aud = calibratedAudience({ personas: [] });
    const out = rankWithAudienceFit(tiles, aud, 0);
    expect(out.every((t) => t.fit === null)).toBe(true);
  });
});

// ─── Calibrated path — level quantization + shape ──────────────────────────────

describe("rankWithAudienceFit — calibrated path", () => {
  it("annotates every tile with a fit.level in {Strong,Fair,Weak} and NO other fit field", () => {
    const aud = calibratedAudience();
    const tiles = [
      tile({ platformVideoId: "a", caption: "vegan meal prep recipe", hashtags: ["vegan"] }),
      tile({ platformVideoId: "b", caption: "gaming highlights montage" }),
    ];
    const out = rankWithAudienceFit(tiles, aud, 0);
    for (const t of out) {
      expect(t.fit).not.toBeNull();
      expect(LEVELS.has(t.fit!.level)).toBe(true);
      // Honesty (D-02): the fit object carries the level WORD only — nothing else.
      expect(Object.keys(t.fit!)).toEqual(["level"]);
    }
  });

  it("the fit annotation never smuggles a number, quote, or verdict (D-02)", () => {
    const aud = calibratedAudience();
    const out = rankWithAudienceFit(
      [tile({ platformVideoId: "a", caption: "vegan meal prep" })],
      aud,
      0,
    );
    const fit = out[0]!.fit!;
    expect(fit).not.toHaveProperty("score");
    expect(fit).not.toHaveProperty("quote");
    expect(fit).not.toHaveProperty("verdict");
    expect(fit).not.toHaveProperty("fraction");
    expect(typeof fit.level).toBe("string");
  });

  it("a tile matching the audience niche vocabulary outscores a zero-overlap tile (serendipity 0)", () => {
    const aud = calibratedAudience(); // niche = "vegan meal prep" + "grow my cooking channel"
    const tiles = [
      tile({
        platformVideoId: "onNiche",
        caption: "vegan meal prep for the week",
        hashtags: ["vegan", "mealprep", "cooking"],
      }),
      tile({
        platformVideoId: "offNiche",
        caption: "extreme motocross stunts compilation",
        hashtags: ["moto", "stunts"],
      }),
    ];
    const out = rankWithAudienceFit(tiles, aud, 0);
    const on = out.find((t) => t.platformVideoId === "onNiche")!;
    const off = out.find((t) => t.platformVideoId === "offNiche")!;
    const rank: Record<FitLevel, number> = { Weak: 0, Fair: 1, Strong: 2 };
    expect(rank[on.fit!.level]).toBeGreaterThan(rank[off.fit!.level]);
  });

  it("an on-niche, calibration-matched tile quantizes to Strong at serendipity 0", () => {
    const aud = calibratedAudience();
    const out = rankWithAudienceFit(
      [
        tile({
          platformVideoId: "strong",
          caption: "vegan meal prep cooking channel grow recipe tips",
          hashtags: ["vegan", "mealprep", "cooking", "recipe"],
          // modest multiplier + high save/share rate → warm/hot demand, matches the mix
          multiplier: 1.2,
          views: 10_000,
          saves: 2_000,
          shares: 1_500,
        }),
      ],
      aud,
      0,
    );
    expect(out[0]!.fit!.level).toBe("Strong");
  });
});

// ─── Serendipity valve (D-06) ───────────────────────────────────────────────────

describe("rankWithAudienceFit — serendipity widens (D-06)", () => {
  it("raising serendipity lifts an off-niche tile's level (niche-match weight shrinks)", () => {
    // A warm-dominant audience so a strong-save (warm) play has high calibration-fit.
    const aud = calibratedAudience({
      personas: [persona("warm", "collector", 0.85), persona("cold", "scanner", 0.15)],
      profile: {
        temperature_mix: { cold: 0.15, warm: 0.85, hot: 0 },
        top_dispositions: ["collector", "scanner"],
        follower_tier: "10k-100k",
      },
    });
    // Off-niche caption (zero token overlap) but an overwhelming save (warm) signature
    // that aligns with the warm-dominant mix → calibration-fit is high.
    const offNiche = tile({
      platformVideoId: "off",
      caption: "extreme motocross stunts compilation",
      hashtags: ["moto", "stunts"],
      multiplier: 1.05, // low broad-reach (little cold pull)
      views: 10_000,
      saves: 6_000, // saveRate 0.6 → very high warm pull
      shares: 200, // shareRate 0.02 → little hot pull
    });
    const rank: Record<FitLevel, number> = { Weak: 0, Fair: 1, Strong: 2 };
    const atNiche = rankWithAudienceFit([offNiche], aud, 0)[0]!;
    const atWide = rankWithAudienceFit([offNiche], aud, 1)[0]!;
    // At serendipity 0 niche-match dominates → off-niche tile is Weak (no overlap).
    expect(atNiche.fit!.level).toBe("Weak");
    // Widening beyond niche surfaces the calibration signal → the level strictly rises.
    expect(rank[atWide.fit!.level]).toBeGreaterThan(rank[atNiche.fit!.level]);
  });

  it("serendipity is clamped to [0,1] (out-of-range inputs do not throw or distort)", () => {
    const aud = calibratedAudience();
    const t = [tile({ platformVideoId: "a", caption: "vegan meal prep" })];
    const low = rankWithAudienceFit(t, aud, -5)[0]!;
    const high = rankWithAudienceFit(t, aud, 5)[0]!;
    const atZero = rankWithAudienceFit(t, aud, 0)[0]!;
    const atOne = rankWithAudienceFit(t, aud, 1)[0]!;
    expect(low.fit!.level).toBe(atZero.fit!.level); // -5 clamps to 0
    expect(high.fit!.level).toBe(atOne.fit!.level); // 5 clamps to 1
  });
});

// ─── Determinism + measured-signal primacy ─────────────────────────────────────

describe("rankWithAudienceFit — determinism + measured primacy", () => {
  it("identical inputs return identical levels AND identical order", () => {
    const aud = calibratedAudience();
    const tiles = [
      tile({ platformVideoId: "a", rankKey: 3, caption: "vegan meal prep" }),
      tile({ platformVideoId: "b", rankKey: 2, caption: "gaming clip" }),
      tile({ platformVideoId: "c", rankKey: 1, caption: "vegan recipe cooking" }),
    ];
    const first = rankWithAudienceFit(tiles, aud, 0.3);
    const second = rankWithAudienceFit(tiles, aud, 0.3);
    expect(first.map((t) => t.platformVideoId)).toEqual(
      second.map((t) => t.platformVideoId),
    );
    expect(first.map((t) => t.fit!.level)).toEqual(second.map((t) => t.fit!.level));
  });

  it("preserves the measured signal as primary — a dominant outlier is not buried by fit", () => {
    const aud = calibratedAudience();
    const tiles = [
      // A massively measured outlier that is off-niche.
      tile({
        platformVideoId: "bigOutlier",
        rankKey: 100,
        caption: "random off topic clip",
      }),
      // A weak-measured but on-niche tile.
      tile({
        platformVideoId: "smallOnNiche",
        rankKey: 1,
        caption: "vegan meal prep cooking recipe",
        hashtags: ["vegan", "cooking"],
      }),
    ];
    const out = rankWithAudienceFit(tiles, aud, 0);
    // Measured stays primary (α small): the big outlier still ranks first.
    expect(out[0]!.platformVideoId).toBe("bigOutlier");
  });

  it("does not mutate the input array or its tiles", () => {
    const aud = calibratedAudience();
    const input = [
      tile({ platformVideoId: "a", rankKey: 2, caption: "vegan meal prep" }),
      tile({ platformVideoId: "b", rankKey: 1, caption: "gaming" }),
    ];
    const snapshotOrder = input.map((t) => t.platformVideoId);
    rankWithAudienceFit(input, aud, 0);
    expect(input.map((t) => t.platformVideoId)).toEqual(snapshotOrder);
    // tiles themselves gain no `fit` key (function spreads, never mutates).
    expect(input[0]).not.toHaveProperty("fit");
  });
});
