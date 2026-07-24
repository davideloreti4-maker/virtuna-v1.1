import { describe, it, expect } from "vitest";
import {
  predictionResultToVideoTestCard,
  deriveFixGroundingQueries,
  type VideoTestSource,
} from "@/lib/tools/video-test-card";
import { VideoTestCardBlockSchema } from "@/lib/tools/profile-blocks";
import type {
  ApolloDimension,
  ApolloRewrite,
  CounterfactualSuggestionItem,
  HeatmapPayload,
} from "@/lib/engine/types";

// dimensions[] fixed order [hook, retention, clarity, share_pull, substance, credibility].
// Craft subset = hook/clarity/substance/credibility → mean(87,72,70,80)=77.25→77. retention (55)
// is RECEPTION and must never reach the craft score or the drivers.
const DIMENSIONS: ApolloDimension[] = [
  { name: "hook", band: "strong", score: 87, lever: "Contrast / curiosity gap (§2.1)", evidence: "Strong cold open — visual stop power high." },
  { name: "retention", band: "mid", score: 55, lever: "Momentum / pattern interrupt (§2.3)", evidence: "Attention dips sharply around 0:08." },
  { name: "clarity", band: "strong", score: 72, lever: "Single clear message (§2.4)", evidence: "One legible idea, minimal overlay clutter." },
  { name: "share_pull", band: "mid", score: 64, lever: "Social currency (§2.5)", evidence: "Relatable but not identity-signalling." },
  { name: "substance", band: "strong", score: 70, lever: "Payoff / value density (§2.6)", evidence: "Delivers a concrete takeaway." },
  { name: "credibility", band: "strong", score: 80, lever: "Trust / authenticity (§2.7)", evidence: "Natural delivery, no over-production." },
];

const REWRITES: ApolloRewrite[] = [
  {
    original: "Here are three things nobody tells you about freelancing",
    variant: "The freelancing advice that doubled my rate (most people get this backwards)",
    lever_fixed: "Contrast / curiosity gap (§2.1)",
  },
];

const SEGMENTS: HeatmapPayload["segments"] = [
  { idx: 0, t_start: 0, t_end: 3, label: "cold open", is_hook_zone: true, keyframe_uri: null },
  { idx: 1, t_start: 3, t_end: 6, label: "setup", is_hook_zone: false, keyframe_uri: null },
  { idx: 2, t_start: 6, t_end: 9, label: "stall", is_hook_zone: false, keyframe_uri: null },
  { idx: 3, t_start: 9, t_end: 12, label: "payoff", is_hook_zone: false, keyframe_uri: null },
  { idx: 4, t_start: 12, t_end: 15, label: "close", is_hook_zone: false, keyframe_uri: null },
];

const FIXES: CounterfactualSuggestionItem[] = [
  { type: "fix", headline: "Recut the open", detail: "You lose them at 0:08 — front-load the payoff.", timestamp_ms: 8000, signal_anchor: "retention" },
  { type: "fix", headline: "Tighten the text overlay", detail: "Move the first card up to 0:01 so it lands with the hook.", timestamp_ms: 1000, signal_anchor: "hook" },
  { type: "fix", headline: "Add an explicit CTA", detail: "The final 0:02 should ask for the follow.", timestamp_ms: 14000, signal_anchor: "cta" },
  { type: "reinforcement", headline: "Keep the cold open", detail: "The visual stop power is your asset.", timestamp_ms: 0, signal_anchor: "hook" },
];

const OPTS = { analysisId: "an-1", audienceName: "Skincare buyers", tier: "Directional" as const };

// ── Apollo-fallback fixtures — the LIVE pipeline emits NO counterfactuals, so fixes/notWorking are
//    derived from the weak/mid craft dims. No 'stall' label here → the weak beat is the curve dip. ──
const APOLLO_ONLY_DIMS: ApolloDimension[] = [
  { name: "hook", band: "mid", score: 50, lever: "Contrast (§2.1)", evidence: "Opens on a low-stakes line; nothing at risk in the first second." },
  { name: "retention", band: "mid", score: 45, lever: "Momentum (§2.3)", evidence: "Attention bottoms out mid-video; no open loop holds the middle." },
  { name: "clarity", band: "strong", score: 80, lever: "One message (§2.4)", evidence: "One legible idea, clean overlay." },
  { name: "substance", band: "mid", score: 55, lever: "Payoff (§2.6)", evidence: "Executes a familiar trope without a fresh angle." },
  { name: "credibility", band: "weak", score: 40, lever: "Proof (§2.7)", evidence: "No proof point anchors the claim; stands on delivery alone." },
];
const APOLLO_SEGMENTS: HeatmapPayload["segments"] = [
  { idx: 0, t_start: 0, t_end: 3, label: "cold open", is_hook_zone: true, keyframe_uri: null },
  { idx: 1, t_start: 3, t_end: 6, label: "setup", is_hook_zone: false, keyframe_uri: null },
  { idx: 2, t_start: 6, t_end: 9, label: "middle", is_hook_zone: false, keyframe_uri: null },
  { idx: 3, t_start: 9, t_end: 12, label: "payoff", is_hook_zone: false, keyframe_uri: null },
  { idx: 4, t_start: 12, t_end: 15, label: "close", is_hook_zone: false, keyframe_uri: null },
];
// weighted_curve minimum at idx 2 (0.20) → maps to segment idx 2 (t_start 6s) = the measured dip.
const CURVE_HEATMAP = { segments: APOLLO_SEGMENTS, personas: [], weighted_curve: [0.8, 0.5, 0.2, 0.6, 0.7] } as unknown as HeatmapPayload;
function apolloOnlySource(over: Partial<VideoTestSource> = {}): VideoTestSource {
  return {
    apollo_reasoning: { dimensions: APOLLO_ONLY_DIMS, rewrites: REWRITES },
    heatmap: CURVE_HEATMAP,
    counterfactuals: null, // the live pipeline no longer emits counterfactuals (Plan 02 R9)
    verbatim: { hook: { spoken_words: "Here are three things nobody tells you about freelancing", on_screen_text: null } },
    ...over,
  };
}

function healthySource(over: Partial<VideoTestSource> = {}): VideoTestSource {
  return {
    apollo_reasoning: { dimensions: DIMENSIONS, rewrites: REWRITES },
    heatmap: { segments: SEGMENTS, personas: [] } as unknown as HeatmapPayload,
    counterfactuals: { suggestions: FIXES },
    verbatim: { hook: { spoken_words: "Here are three things nobody tells you about freelancing", on_screen_text: null } },
    ...over,
  };
}

describe("predictionResultToVideoTestCard (craft teardown)", () => {
  it("maps a healthy result → a schema-valid craft card (sim1-max)", () => {
    const block = predictionResultToVideoTestCard(healthySource(), OPTS);
    expect(block).not.toBeNull();
    expect(VideoTestCardBlockSchema.safeParse(block).success).toBe(true);
    expect(block!.props.model).toBe("sim1-max");
    expect(block!.props.audienceName).toBe("Skincare buyers");
  });

  it("craftScore = mean of the CRAFT subset only (retention excluded)", () => {
    const block = predictionResultToVideoTestCard(healthySource(), OPTS)!;
    // mean(hook 87, clarity 72, substance 70, credibility 80) = 77.25 → 77
    expect(block.props.craftScore).toBe(77);
    // retention (55) never appears as a driver.
    expect(block.props.drivers.some((d) => d.name.toLowerCase() === "retention")).toBe(false);
    expect(block.props.drivers).toHaveLength(4);
    // drivers sorted by score descending.
    expect(block.props.drivers.map((d) => d.name)).toEqual(["Hook", "Credibility", "Clarity", "Substance"]);
  });

  it("builds the filmstrip: cold open = asset, stall = weak, drop + duration labels", () => {
    const block = predictionResultToVideoTestCard(healthySource(), OPTS)!;
    expect(block.props.filmstrip).toHaveLength(5);
    expect(block.props.filmstrip[0]!.mark).toBe("asset"); // is_hook_zone
    expect(block.props.filmstrip[2]!.mark).toBe("weak"); // the stall
    expect(block.props.filmstrip.filter((f) => f.mark === null)).toHaveLength(3);
    expect(block.props.dropLabel).toBe("0:06 drop"); // stall t_start = 6s
    expect(block.props.durationLabel).toBe("0:15"); // last t_end
  });

  it("resolves keyframe URLs from the frames option (their frames, ephemeral)", () => {
    const frames = { 0: "https://signed/0.jpg" };
    const block = predictionResultToVideoTestCard(healthySource(), { ...OPTS, frames })!;
    expect(block.props.filmstrip[0]!.keyframeUrl).toBe("https://signed/0.jpg");
    expect(block.props.filmstrip[1]!.keyframeUrl).toBeNull(); // no frame for idx 1
    // The hook fix at 1000ms sits in segment 0 [0,3) → resolves to frame 0.
    const hookFix = block.props.fixes.find((f) => f.lever === "Stakes")!;
    expect(hookFix.keyframeUrl).toBe("https://signed/0.jpg");
  });

  it("emits the director's fixes with lever + neutral why; the hook fix gets a rewrite move", () => {
    const block = predictionResultToVideoTestCard(healthySource(), OPTS)!;
    expect(block.props.fixes).toHaveLength(3);
    const [momentum, stakes, cta] = block.props.fixes;
    expect(momentum!.lever).toBe("Momentum");
    expect(momentum!.why).toContain("open loops");
    expect(momentum!.move).toBeNull(); // only hook fixes carry a rewrite move
    // The hook fix quotes their verbatim open + carries the Apollo rewrite as the move.
    expect(stakes!.lever).toBe("Stakes");
    expect(stakes!.diagnosis).toContain("Here are three things nobody tells you");
    expect(stakes!.move).toBe(REWRITES[0]!.variant);
    expect(cta!.lever).toBe("CTA");
    // Grounding is the route's job — the mapper leaves every proof null.
    expect(block.props.fixes.every((f) => f.proof === null)).toBe(true);
  });

  it("ledger: working blends reinforcements + strong drivers; not-working carries the fix timestamps", () => {
    const block = predictionResultToVideoTestCard(healthySource(), OPTS)!;
    expect(block.props.working[0]).toBe("Keep the cold open"); // the reinforcement leads
    expect(block.props.working.length).toBeGreaterThan(0);
    expect(block.props.working.length).toBeLessThanOrEqual(3);
    expect(block.props.notWorking).toEqual([
      { text: "Recut the open", atMs: 8000 },
      { text: "Tighten the text overlay", atMs: 1000 },
      { text: "Add an explicit CTA", atMs: 14000 },
    ]);
  });

  it("derives per-fix grounding queries aligned to the fixes (structural; hook uses the rewrite)", () => {
    const queries = deriveFixGroundingQueries(healthySource());
    expect(queries).toHaveLength(3);
    expect(queries[0]).toEqual({ query: "Recut the open", axis: "structural" });
    expect(queries[1]).toEqual({ query: REWRITES[0]!.variant, axis: "structural" }); // hook → rewrite
    expect(queries[2]).toEqual({ query: "Add an explicit CTA", axis: "structural" });
  });

  it("degrades gracefully when Apollo is down but the filmstrip + fixes survive (craftScore null)", () => {
    const block = predictionResultToVideoTestCard(healthySource({ apollo_reasoning: null }), OPTS)!;
    expect(block.props.craftScore).toBeNull();
    expect(block.props.drivers).toHaveLength(0);
    expect(block.props.filmstrip).toHaveLength(5); // still shows their video
    expect(block.props.fixes).toHaveLength(3);
    expect(VideoTestCardBlockSchema.safeParse(block).success).toBe(true);
  });

  it("returns null when there is NO craft material at all (caller degrades to the link-out)", () => {
    const empty: VideoTestSource = { apollo_reasoning: null, heatmap: null, counterfactuals: null, verbatim: null };
    expect(predictionResultToVideoTestCard(empty, OPTS)).toBeNull();
  });

  it("carries no reception field — no band/fraction/reactions leak into the strict schema", () => {
    const block = predictionResultToVideoTestCard(healthySource(), OPTS)!;
    const keys = Object.keys(block.props);
    expect(keys).not.toContain("band");
    expect(keys).not.toContain("fraction");
    expect(keys).not.toContain("reactions");
    expect(keys).not.toContain("goNoGo");
  });
});

describe("predictionResultToVideoTestCard — Apollo fallback (no counterfactuals, the live path)", () => {
  it("derives the director's fixes from the weak/mid craft dims, weakest first", () => {
    const block = predictionResultToVideoTestCard(apolloOnlySource(), OPTS)!;
    expect(VideoTestCardBlockSchema.safeParse(block).success).toBe(true);
    // weak/mid dims among the fix set, sorted asc: credibility 40, retention 45, hook 50 (substance 55 capped)
    expect(block.props.fixes.map((f) => f.title)).toEqual([
      "Anchor a proof point",
      "Hold the middle",
      "Sharpen the open",
    ]);
    expect(block.props.fixes.map((f) => f.lever)).toEqual(["Proof", "Momentum", "Stakes"]);
    // The hook fix quotes their verbatim open + carries the Apollo rewrite; the others carry no move.
    const hookFix = block.props.fixes.find((f) => f.lever === "Stakes")!;
    expect(hookFix.move).toBe(REWRITES[0]!.variant);
    expect(hookFix.diagnosis).toContain("Here are three things nobody tells you");
    expect(block.props.fixes.filter((f) => f.move === null)).toHaveLength(2);
    // The diagnosis is the dim's REAL evidence (video-specific) — never a fabricated claim.
    expect(block.props.fixes[0]!.diagnosis).toContain("No proof point anchors the claim");
    expect(block.props.fixes.every((f) => f.proof === null)).toBe(true);
  });

  it("anchors the retention fix to the MEASURED attention dip; other dims carry no timestamp", () => {
    const block = predictionResultToVideoTestCard(apolloOnlySource(), OPTS)!;
    const retention = block.props.fixes.find((f) => f.lever === "Momentum")!;
    expect(retention.atMs).toBe(6000); // curve min at idx 2 → segment t_start 6s
    // the dip also marks the weak beat + drives the drop label, with NO 'stall' label present.
    expect(block.props.filmstrip[2]!.mark).toBe("weak");
    expect(block.props.dropLabel).toBe("0:06 drop");
    // Apollo dims aren't time-coded → the non-retention fixes have no frame.
    expect(block.props.fixes.find((f) => f.lever === "Proof")!.atMs).toBeNull();
    expect(block.props.fixes.find((f) => f.lever === "Stakes")!.atMs).toBeNull();
  });

  it("not-working ledger mirrors the fix dims with their real evidence; working keeps strong dims", () => {
    const block = predictionResultToVideoTestCard(apolloOnlySource(), OPTS)!;
    expect(block.props.notWorking).toHaveLength(3);
    expect(block.props.notWorking[0]!.text).toContain("Credibility —");
    expect(block.props.notWorking.find((n) => n.text.startsWith("Retention"))!.atMs).toBe(6000);
    expect(block.props.working.some((w) => w.startsWith("Clarity"))).toBe(true); // strong dim (80)
  });

  it("grounding queries align to the Apollo fixes (hook → rewrite, others → the craft move)", () => {
    expect(deriveFixGroundingQueries(apolloOnlySource())).toEqual([
      { query: "Anchor a proof point", axis: "structural" },
      { query: "Hold the middle", axis: "structural" },
      { query: REWRITES[0]!.variant, axis: "structural" },
    ]);
  });

  it("shows NO fixes when every craft dim is strong (never invents a weakness)", () => {
    const allStrong = APOLLO_ONLY_DIMS.map((d) => ({ ...d, band: "strong" as const, score: 85 }));
    const block = predictionResultToVideoTestCard(
      apolloOnlySource({ apollo_reasoning: { dimensions: allStrong, rewrites: REWRITES } }),
      OPTS,
    )!;
    expect(block.props.fixes).toHaveLength(0);
    expect(block.props.notWorking).toHaveLength(0);
    // still a valid card — the craft ring + drivers + filmstrip + working carry it.
    expect(VideoTestCardBlockSchema.safeParse(block).success).toBe(true);
    expect(block.props.craftScore).not.toBeNull();
  });
});
