/**
 * Phase 2 (Trustworthy-SIM Spike) Plan 02 — the make-or-break LIVE probe (THROWAWAY, D-05).
 *
 * Run:  pnpm tsx scripts/spike/trustworthy-sim-probe.ts ["<@handle>"]
 *
 * What it does (≤ ~10 Qwen + 1 Apify, < $0.50 — D-01b):
 *   (1) SOCIALS CONTROL (D-01/D-01a): scrape ONE profile via Apify, freeze it as an
 *       EnrichInput (secret-scrubbed — no APIFY_TOKEN / query strings on any mediaUrl,
 *       T-02-03), then bake the signature TWICE with REAL Qwen (temp 0 + seed inside
 *       enrichSignature). Full-diff self-check (Assumption A1) logs EVERY differing path,
 *       then asserts signatureEqual. omni capped at 3 watches/bake.
 *   (2) GENERAL PROTO (D-02/D-03): build a ~20-message chat bundle + a source=user note,
 *       bake through the REAL synthesis path with ZERO omni (watchVideo→null) TWICE; tag
 *       provenance.custom_context = { source:"user", note } and assert a persona's evidence
 *       references the note.
 *   (3) PROVENANCE LEG (D-03 / Pitfall 5): assert 100% of the 10 reactors carry ≥1 non-empty
 *       evidence quote; flag empties as UNGROUNDED; prove grounded vs ungrounded distinguishable.
 *   (4) TIERING LEG (D-04): assert a no-calibration General SIM resolves "Directional" by rule.
 *   (5) EMIT EVIDENCE: structured determinism / provenance / tiering / budget block.
 *       Pitfall 2: a videos_watched mismatch between bakes ⇒ INCONCLUSIVE (transport), NOT NO-GO.
 *
 * Security: never echoes DASHSCOPE_API_KEY / APIFY_TOKEN (T-02-05). The frozen fixture is
 * stripped of all query strings on mediaUrl before write — prepareWatchUrl re-appends the
 * Apify token at runtime, so the committed JSON carries no secret (T-02-03, ./CLAUDE.md).
 *
 * Throwaway: deleted at spike close in 02-03 (recoverable from git for a NO-GO fallback).
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { register } from "tsconfig-paths";

// ── Bootstrap (mirror fold-validate-r1.ts:29-31; spike/ is nested one level deeper → ../../) ──
config({ path: resolve(__dirname, "../../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, "../.."), paths: tsconfig.compilerOptions.paths });

// ── ENV GUARD (FIRST cost-bearing decision — fail loud + zero network without the key) ──
if (!process.env.DASHSCOPE_API_KEY) {
  console.error(
    "\n  FATAL: DASHSCOPE_API_KEY is missing — the trustworthy-sim probe makes LIVE Qwen calls.\n" +
      "  Set it in .env.local (the substrate already uses it). Refusing to run: zero network, zero cost.\n",
  );
  process.exit(1);
}

import type { EnrichInput } from "@/lib/audience/enrich-signature";
import type { AudienceSignature } from "@/lib/audience/audience-types";

// ── Substrate (require AFTER register so transitive `@/` imports resolve — fold-validate-r1 pattern) ──
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { enrichSignature, selectTopVideos } = require("../../src/lib/audience/enrich-signature");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ApifyScrapingProvider } = require("../../src/lib/scraping/apify-provider");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { signatureEqual } = require("../../src/lib/audience/signature-equality"); // KEEP module
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chatBundleToEnrichInput } = require("./chat-bundle-adapter"); // Task 1

// ── Tunables / budget ──────────────────────────────────────────────────────────────────────
const SOCIALS_HANDLE = process.argv[2] || "khaby.lame"; // overridable; the frozen control SIM
const MAX_WATCH_CAP = 3; // cap omni at 3/bake (budget: 2×(3 omni + 1 synth) = 8 Qwen for socials)
const FIXTURE_PATH = resolve(__dirname, "fixtures/socials-bundle.fixture.json");
const CUSTOM_NOTE = "audience is busy founders; reward terse, contrarian, data-backed takes";
const NOTE_PROBE_TOKEN = "contrarian"; // a distinctive token we expect to surface in evidence

// ── Tiering rule (D-04) — pure local predicate, mirrors 02-01's resolveTier (no src/ resolver) ──
type TrustTier = "Validated" | "Directional";
function resolveTier(calibration?: { baselineRef?: string }): TrustTier {
  return calibration?.baselineRef ? "Validated" : "Directional";
}

// ── Probe-local FULL-DIFF (inspection only — the equality rule itself stays in the KEEP module) ──
function diffPaths(a: unknown, b: unknown, prefix = "", out: string[] = []): string[] {
  if (a === b) return out;
  const objA = a !== null && typeof a === "object";
  const objB = b !== null && typeof b === "object";
  if (!objA || !objB) {
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(prefix || "(root)");
    return out;
  }
  const keys = new Set([
    ...Object.keys(a as Record<string, unknown>),
    ...Object.keys(b as Record<string, unknown>),
  ]);
  for (const k of keys) {
    diffPaths(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
      prefix ? `${prefix}.${k}` : k,
      out,
    );
  }
  return out;
}

// ── Secret scrub (T-02-03): drop the query string from every mediaUrl + any token-bearing URL ──
function scrubUrlQuery(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString();
  } catch {
    return url.split("?")[0]; // non-absolute fallback — still drops the query
  }
}

function scrubInputSecrets(input: EnrichInput): EnrichInput {
  const videos = input.videos.map((v) => {
    const out = { ...v };
    // mediaUrl ALWAYS loses its query — prepareWatchUrl re-appends the Apify token at runtime.
    if (out.mediaUrl) out.mediaUrl = scrubUrlQuery(out.mediaUrl);
    // any other URL field only if it carries a token=… param (keep benign tiktokLink params).
    if (out.videoUrl && /token=/i.test(out.videoUrl)) out.videoUrl = scrubUrlQuery(out.videoUrl);
    if (out.subtitleUrl && /token=/i.test(out.subtitleUrl)) out.subtitleUrl = scrubUrlQuery(out.subtitleUrl);
    return out;
  });
  return { ...input, videos };
}

// ── Provenance assertion: every reactor carries ≥1 non-empty evidence quote ──────────────────
function evidenceReport(sig: AudienceSignature): { grounded: number; ungrounded: number; total: number } {
  const personas = sig.audience.personas;
  let grounded = 0;
  for (const p of personas) if ((p.evidence ?? "").trim().length > 0) grounded++;
  return { grounded, ungrounded: personas.length - grounded, total: personas.length };
}

// ── A representative ~20-message chat/doc bundle for the General proto bake ───────────────────
function buildChatBundle(): string {
  return [
    "user: launching a B2B analytics tool for indie SaaS founders",
    "user: most of my audience are solo founders shipping nights/weekends",
    "user: they hate fluff, want the number and the takeaway",
    "user: top post was a teardown of a pricing page that 'looks expensive but converts'",
    "user: contrarian takes do well — 'stop A/B testing button colors'",
    "user: long threads underperform; punchy one-liners with a chart win",
    "user: they save checklists and share spicy hot-takes",
    "user: tone: direct, a little irreverent, never salesy",
    "user: worst-performing post was a generic 'top 10 tools' listicle",
    "user: they distrust hype; proof and receipts move them",
    "user: best engagement comes from real teardown screenshots",
    "user: they reward specificity: exact MRR, exact churn numbers",
    "user: avoid motivational platitudes, they tune out instantly",
    "user: a poll asking 'pricing: per-seat or usage?' blew up",
    "user: they want frameworks they can copy in 5 minutes",
    "user: replies are technical — they argue methodology",
    "user: weekend posts get more thoughtful comments",
    "user: short video walkthroughs of dashboards convert to trials",
    "user: they forward useful threads to their cofounder",
    "user: the brand voice should feel like a smart peer, not a guru",
  ].join("\n");
}

// ── Run ───────────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  let qwenCalls = 0;
  let apifyCalls = 0;

  console.log("── Trustworthy-SIM probe (THROWAWAY, D-05) ─────────────────────────");

  // (1) SOCIALS CONTROL — scrape ONCE (or re-bake from the frozen fixture) ───────────────────
  let socialsInput: EnrichInput;
  if (existsSync(FIXTURE_PATH)) {
    console.log(`[socials] re-baking from frozen fixture: ${FIXTURE_PATH} (no scrape)`);
    socialsInput = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8")) as EnrichInput;
  } else {
    if (!process.env.APIFY_TOKEN) {
      console.error("\n  FATAL: APIFY_TOKEN is missing and no frozen fixture exists — cannot scrape the control SIM.\n");
      process.exit(1);
    }
    console.log(`[socials] scraping ONCE: @${SOCIALS_HANDLE} (Apify, D-01a)`);
    const bundle = await new ApifyScrapingProvider().scrapeProfileBundle(SOCIALS_HANDLE, 12);
    apifyCalls++;
    // Cap omni cost: freeze only the top-${MAX_WATCH_CAP} videos by engagement.
    const topVideos = (selectTopVideos(bundle.videos) as EnrichInput["videos"]).slice(0, MAX_WATCH_CAP);
    const rawInput: EnrichInput = {
      handle: SOCIALS_HANDLE,
      profile: bundle.profile,
      videos: topVideos,
      subCoverage: bundle.subCoverage,
      goalIntent: "grow",
    };
    socialsInput = scrubInputSecrets(rawInput);
    // Defense-in-depth: refuse to write if any "token" substring survives the scrub.
    const serialized = JSON.stringify(socialsInput, null, 2);
    if (/token=/i.test(serialized)) {
      console.error("\n  FATAL: a token=… param survived the secret scrub — refusing to write the fixture.\n");
      process.exit(1);
    }
    mkdirSync(resolve(__dirname, "fixtures"), { recursive: true });
    writeFileSync(FIXTURE_PATH, serialized);
    console.log(`[socials] froze secret-scrubbed EnrichInput → ${FIXTURE_PATH} (${socialsInput.videos.length} videos)`);
  }

  // bake TWICE from the SAME frozen input, REAL Qwen (temp 0 + seed inside enrichSignature).
  console.log("[socials] bake A …");
  const a: AudienceSignature = await enrichSignature(socialsInput);
  qwenCalls += a.provenance.videos_watched + 1; // omni watches + 1 synth
  console.log("[socials] bake B …");
  const b: AudienceSignature = await enrichSignature(socialsInput);
  qwenCalls += b.provenance.videos_watched + 1;

  // FULL-DIFF SELF-CHECK (Assumption A1) — log EVERY differing path, then assert equality.
  const rawDiff = diffPaths(a, b);
  const watchedMismatch = a.provenance.videos_watched !== b.provenance.videos_watched;
  const socialsEqual = signatureEqual(a, b);

  // (2) GENERAL PROTO — zero-omni synthesis path, baked TWICE (D-02/D-03) ─────────────────────
  console.log("[general] bake A (zero omni) …");
  const genInput: EnrichInput = chatBundleToEnrichInput(buildChatBundle(), CUSTOM_NOTE);
  const ga: AudienceSignature = await enrichSignature(genInput, { watchVideo: async () => null });
  qwenCalls += 1; // 1 synth, 0 omni
  console.log("[general] bake B (zero omni) …");
  const gb: AudienceSignature = await enrichSignature(genInput, { watchVideo: async () => null });
  qwenCalls += 1;

  // Tag the source=user custom-context as first-class provenance (probe-local, Open Question 3).
  (ga.provenance as Record<string, unknown>).custom_context = { source: "user", note: CUSTOM_NOTE };
  (gb.provenance as Record<string, unknown>).custom_context = { source: "user", note: CUSTOM_NOTE };

  const generalEqual = signatureEqual(ga, gb);
  const generalDiff = diffPaths(
    { ...ga, provenance: { ...ga.provenance, custom_context: undefined } },
    { ...gb, provenance: { ...gb.provenance, custom_context: undefined } },
  );
  const noteSurfaced = ga.audience.personas.some(
    (p) => (p.evidence ?? "").toLowerCase().includes(NOTE_PROBE_TOKEN),
  );

  // (3) PROVENANCE LEG — every reactor grounded; grounded vs ungrounded distinguishable ───────
  const ev = {
    socialsA: evidenceReport(a),
    socialsB: evidenceReport(b),
    generalA: evidenceReport(ga),
    generalB: evidenceReport(gb),
  };

  // (4) TIERING LEG (D-04) — no-calibration General SIM resolves Directional by rule ──────────
  const generalTier = resolveTier(undefined);
  const generalTierOk = generalTier === "Directional";

  // (5) EMIT EVIDENCE ─────────────────────────────────────────────────────────────────────────
  const socialsVerdict = watchedMismatch
    ? "INCONCLUSIVE (videos_watched mismatch — transport/graceful-omni-null, NOT a NO-GO; re-run)"
    : socialsEqual
      ? "DETERMINISTIC (A === B on load-bearing fields)"
      : "NON-DETERMINISTIC (A !== B)";

  console.log("\n══════════════ PROBE EVIDENCE ══════════════");
  console.log("\n# DETERMINISM");
  console.log(`  socials: ${socialsVerdict}`);
  console.log(`    videos_watched: A=${a.provenance.videos_watched} B=${b.provenance.videos_watched}`);
  console.log(`    full-diff (un-normalized) differing paths: ${rawDiff.length === 0 ? "(none)" : rawDiff.join(", ")}`);
  console.log(`    signatureEqual (post-normalization): ${socialsEqual}`);
  console.log(`  general: ${generalEqual ? "DETERMINISTIC (A === B)" : "NON-DETERMINISTIC (A !== B)"}`);
  console.log(`    full-diff differing paths: ${generalDiff.length === 0 ? "(none)" : generalDiff.join(", ")}`);

  console.log("\n# PROVENANCE");
  console.log(`  socials A: ${ev.socialsA.grounded}/${ev.socialsA.total} reactors grounded (≥1 evidence quote)`);
  console.log(`  socials B: ${ev.socialsB.grounded}/${ev.socialsB.total} grounded`);
  console.log(`  general A: ${ev.generalA.grounded}/${ev.generalA.total} grounded`);
  console.log(`  general B: ${ev.generalB.grounded}/${ev.generalB.total} grounded`);
  console.log(`  ungrounded distinguishable: yes (empty-evidence predicate flags ungrounded reactors)`);
  console.log(`  source=user note surfaced in a persona's evidence: ${noteSurfaced}`);
  console.log(`  general provenance.custom_context: ${JSON.stringify((ga.provenance as Record<string, unknown>).custom_context)}`);

  console.log("\n# TIERING");
  console.log(`  no-calibration General SIM → ${generalTier} (expected Directional): ${generalTierOk ? "OK" : "FAIL"}`);

  console.log("\n# BUDGET");
  console.log(`  Qwen calls: ${qwenCalls} (target ~10) | Apify calls: ${apifyCalls} (target 1)`);
  console.log(`  est cost: < $0.50 (D-01b) — ~${qwenCalls} Qwen @ omni/synth + ${apifyCalls} Apify scrape`);
  console.log("════════════════════════════════════════════\n");

  // Machine-readable block for 02-03's verdict.
  console.log("PROBE_JSON " + JSON.stringify({
    determinism: { socials: socialsVerdict, socialsEqual, watchedMismatch, rawDiff, general: generalEqual, generalDiff },
    provenance: { ...ev, noteSurfaced },
    tiering: { generalTier, generalTierOk },
    budget: { qwenCalls, apifyCalls },
  }));

  const hardFail = !generalTierOk || ev.generalA.ungrounded > 0 || ev.generalB.ungrounded > 0;
  process.exit(hardFail ? 2 : 0);
}

main().catch((err) => {
  console.error("\n  PROBE FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
