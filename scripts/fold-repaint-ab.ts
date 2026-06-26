/**
 * R1′b repaint A/B — does the audience repaint actually MOVE the fold? (the moat proof)
 *
 * Part B wires the calibrated audience's per-archetype reaction frames into the Read fold
 * (route → pipeline → runFold). Unit tests prove General is byte-identical + the frame is
 * injected — but NOT that the MODEL reacts to it. This rig answers that with a CONTROLLED
 * experiment: a FIXED synthetic skeleton (identical input), then the REAL runFold fired TWICE —
 *   A = no repaint (General — generic archetypes)
 *   B = a synthetic CALIBRATED repaint map (a sharp, expertise-driven niche audience)
 * — and compares diversity / intents / curves. A visible divergence = the repaint is live,
 * not inert (the moat isn't theater). Text-only (videoUrl=null) so the ONLY variable is the
 * repaint — the sighted-fold latency/diversity was already proven by scripts/fold-validate-r1.ts.
 *
 * Usage: pnpm tsx scripts/fold-repaint-ab.ts
 * Evidence-only: edits NO engine file. No upload (no omni read — sidesteps omni output flakiness).
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runFold, computeAvgCurveRange, DIVERSITY_FLOOR } = require("../src/lib/engine/wave3/fold");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { selectPersonaSlots } = require("../src/lib/engine/wave3/persona-registry");

// Fixed synthetic skeleton — a plausible 5-segment short video. IDENTICAL for A and B, so the
// ONLY thing that differs between the two folds is the repaint map (the controlled variable).
const SEGMENTS = [
  { idx: 0, t_start: 0, t_end: 2, visual_event: "creator on camera, quick smile", audio_event: "upbeat hook line", is_hook_zone: true },
  { idx: 1, t_start: 2, t_end: 5, visual_event: "text overlay appears", audio_event: "claim stated", is_hook_zone: false },
  { idx: 2, t_start: 5, t_end: 9, visual_event: "b-roll demo", audio_event: "explanation continues", is_hook_zone: false },
  { idx: 3, t_start: 9, t_end: 13, visual_event: "cut to result", audio_event: "payoff revealed", is_hook_zone: false },
  { idx: 4, t_start: 13, t_end: 16, visual_event: "creator wraps up", audio_event: "soft call to follow", is_hook_zone: false },
];
const VERBATIM = "Here's the one thing nobody tells you about this — watch til the end.";
const EMOTION_ARC = [
  { t: 0, valence: 0.6, arousal: 0.7 },
  { t: 5, valence: 0.5, arousal: 0.5 },
  { t: 16, valence: 0.6, arousal: 0.4 },
];

// A synthetic CALIBRATED audience: a sharp, expertise-driven niche audience whose reactors
// judge content very differently from generic TikTok archetypes. Keyed by the 10 engine slugs.
const SYNTHETIC_REPAINT: Record<string, string> = {
  high_engager: "Domain insider who engages HARD only when a claim is novel + specific; generic intros bore them instantly.",
  saver: "Saves only rigorous, reference-grade breakdowns to revisit; ignores anything casual or vibes-driven.",
  lurker: "Silent expert; watches fully when there's depth, vanishes the second it turns into fluff.",
  sharer: "Shares ONLY content that makes them look smart to peers; will not share casual storytime.",
  tough_crowd: "Ex-practitioner skeptic; demands evidence in the first 2s, bails on unsourced claims or hype.",
  purposeful_viewer: "Here to learn one concrete thing; abandons the moment it's clear there's no payoff.",
  niche_deep_buyer: "Ready to buy recommended tools but ONLY after a credible, specific rationale — not a personal anecdote.",
  niche_deep_scout: "Scanning for the one expert worth following; rewards precision, punishes filler.",
  loyalist: "Trusts THIS creator's rigor; gives long benefit-of-the-doubt but expects substance to land eventually.",
  cross_niche_curiosity: "Outsider intrigued only if the hook reframes the topic in a surprising, transferable way.",
};

const num = (x: unknown) => (typeof x === "number" ? x : 0);

async function fold(slots: any, segments: any, verbatim: string, emotionArc: any, repaint?: Record<string, string>) {
  const t = Date.now();
  // videoUrl=null → text-only fold (the repaint is the only variable). onStageEvent omitted.
  const outcome = await runFold(slots, segments, verbatim, emotionArc, null, undefined, repaint);
  const ms = Date.now() - t;
  const personas = outcome.personaSimResults ?? [];
  const pass2 = outcome.pass2Results ?? [];
  const mean = (f: (p: any) => number) => personas.length ? +(personas.reduce((s: number, p: any) => s + f(p), 0) / personas.length).toFixed(1) : 0;
  const nSeg = segments.length;
  const curve: number[] = [];
  for (let i = 0; i < nSeg; i++) {
    const vals = pass2.map((p: any) => p.segment_reactions[i]?.attention).filter((x: any) => typeof x === "number");
    curve.push(vals.length ? +(vals.reduce((x: number, y: number) => x + y, 0) / vals.length).toFixed(2) : 0);
  }
  const byArch: Record<string, number> = {};
  for (const p of personas) byArch[String(p.archetype)] = num(p.watch_through_pct);
  return {
    ms, success: outcome.fold_success, cost: outcome.cost_cents,
    diversity: computeAvgCurveRange(pass2),
    watch: mean((p) => num(p.watch_through_pct)),
    share: mean((p) => num(p.share_intent)),
    save: mean((p) => num(p.save_intent)),
    comment: mean((p) => num(p.comment_intent)),
    curve, byArch, warnings: outcome.warnings ?? [],
  };
}

async function main() {
  console.log(`\n████ R1′b REPAINT A/B ████  (controlled: fixed synthetic skeleton, text-only fold)`);
  const slots = selectPersonaSlots(null, null);
  console.log(`  skeleton: segments=${SEGMENTS.length} slots=${slots.length}\n`);

  {
    console.log("  [A] fold WITHOUT repaint (General) …");
    const A = await fold(slots, SEGMENTS, VERBATIM, EMOTION_ARC);
    console.log(`      ${(A.ms / 1000).toFixed(1)}s · success=${A.success} · diversity=${A.diversity} · watch=${A.watch}% · cost=${A.cost}¢`);

    console.log("  [B] fold WITH synthetic calibrated repaint …");
    const B = await fold(slots, SEGMENTS, VERBATIM, EMOTION_ARC, SYNTHETIC_REPAINT);
    console.log(`      ${(B.ms / 1000).toFixed(1)}s · success=${B.success} · diversity=${B.diversity} · watch=${B.watch}% · cost=${B.cost}¢`);

    // Divergence metrics
    const archs = [...new Set([...Object.keys(A.byArch), ...Object.keys(B.byArch)])];
    const watchDeltas = archs.map((k) => Math.abs(num(A.byArch[k]) - num(B.byArch[k])));
    const meanWatchDelta = watchDeltas.length ? +(watchDeltas.reduce((x, y) => x + y, 0) / watchDeltas.length).toFixed(1) : 0;
    const maxWatchDelta = watchDeltas.length ? Math.max(...watchDeltas) : 0;
    const curveDelta = A.curve.length === B.curve.length
      ? +(A.curve.reduce((s, v, i) => s + Math.abs(v - B.curve[i]!), 0) / Math.max(1, A.curve.length)).toFixed(3)
      : NaN;

    console.log("\n  ═══════════════ A (General) vs B (Calibrated) ═══════════════");
    const row = (label: string, av: any, bv: any, d?: any) =>
      console.log(`  ${label.padEnd(20)} A=${String(av).padEnd(10)} B=${String(bv).padEnd(10)}${d !== undefined ? `Δ=${d}` : ""}`);
    row("diversity", A.diversity, B.diversity, +(B.diversity - A.diversity).toFixed(2));
    row("mean watch %", A.watch, B.watch, +(B.watch - A.watch).toFixed(1));
    row("mean share", A.share, B.share, +(B.share - A.share).toFixed(1));
    row("mean save", A.save, B.save, +(B.save - A.save).toFixed(1));
    row("mean comment", A.comment, B.comment, +(B.comment - A.comment).toFixed(1));
    console.log(`  per-archetype watch% mean|Δ| = ${meanWatchDelta}   max|Δ| = ${maxWatchDelta}`);
    console.log(`  mean |curve Δ| per segment   = ${curveDelta}`);
    console.log(`  A curve: [${A.curve.join(", ")}]`);
    console.log(`  B curve: [${B.curve.join(", ")}]`);
    console.log("  ── per-archetype watch% (A → B) ──");
    for (const k of archs) console.log(`    ${k.padEnd(26)} ${num(A.byArch[k])}% → ${num(B.byArch[k])}%`);
    console.log("  ════════════════════════════════════════════════════════════\n");

    const moved = meanWatchDelta >= 5 || maxWatchDelta >= 15 || Math.abs(B.watch - A.watch) >= 3;
    const bothOk = A.success && B.success && A.diversity >= DIVERSITY_FLOOR && B.diversity >= DIVERSITY_FLOOR;
    console.log(`R1B_REPAINT_AB success=${bothOk} meanWatchΔ=${meanWatchDelta} maxWatchΔ=${maxWatchDelta} watchΔ=${+(B.watch - A.watch).toFixed(1)} VERDICT=${moved && bothOk ? "REPAINT MOVES THE FOLD ✅" : moved ? "moved but a fold flagged" : "NO VISIBLE MOVE — investigate"}`);
  }
}

main().catch((e) => { console.error("\n[fold-repaint-ab] FATAL:", e?.stack ?? e?.message ?? e); process.exit(1); });
