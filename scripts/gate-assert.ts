/**
 * GATE-01 automated assertion harness (Phase 3 / 03-01, D-06).
 *
 * Reads a captured live `complete` payload (a real PredictionResult dumped from
 * the authenticated browser-fetch path — see scripts/capture-reading-fixture.ts)
 * and emits deterministic GREEN/RED over the four honesty assertions. This is the
 * automated half of the smoke gate: it proves the live contract is honest (not a
 * confident lie) and not truncated. Latency + same-video variance are recorded
 * manually in 03-GATE-RUNS.md (Task 2), NOT asserted here.
 *
 * It reads a LOCAL JSON file only — no Supabase client, no engine import. The
 * dotenv bootstrap mirrors capture-reading-fixture.ts for rig parity; nothing in
 * here actually needs the env (kept dependency-free on purpose).
 *
 * Usage:
 *   pnpm tsx scripts/gate-assert.ts <live-<id>.json>
 *
 * Exit 0 + `GATE_ASSERT=GREEN ...` when honest; exit 1 + `GATE_ASSERT=RED REASON=...`
 * on any failed assertion. A valid non-§2 cite (e.g. §4.x) is honest (taxonomy-valid
 * per D-06) and stays GREEN — it only emits a NON-FATAL `GATE_ASSERT_WARN=NO_S2_CITES`
 * when zero §2.x cites are present. RED-ing a valid §4.x read would punish an honest
 * read as if it were a confident lie, violating the D-07 honest-vs-confident-lie axis.
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";

config({ path: resolve(__dirname, "../.env.local") });

const [livePayloadPath] = process.argv.slice(2);
if (!livePayloadPath) {
  console.error("Usage: pnpm tsx scripts/gate-assert.ts <live-<id>.json>");
  process.exit(1);
}

/** Canonical engine confidence labels (engine emits MEDIUM, not MED). */
const CONFIDENCE_SET = new Set(["HIGH", "MEDIUM", "LOW"]);
/** A well-formed Apollo citation is ANY §N.N family, not §2-only (D-06). */
const CITE_WELLFORMED = /^§\d+\.\d+$/;
/** Greedy capture of every §-led token so a malformed `§2` / `§abc` is caught. */
const CITE_TOKEN = /§[\w.]+/g;

/** Read the live payload; tolerate the MCP double-encoding (string-of-JSON). */
function readLivePayload(path: string): Record<string, unknown> {
  let parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed as Record<string, unknown>;
}

/** Emit a RED summary line + non-zero exit. */
function red(reason: string): never {
  console.log("  FAIL  " + reason);
  console.log(`GATE_ASSERT=RED REASON=${reason}`);
  process.exit(1);
}

function pass(line: string): void {
  console.log("  PASS  " + line);
}

const live = readLivePayload(livePayloadPath);

// (1) Not truncated — `hero` AND `apollo_reasoning` both present TOP-LEVEL (F46/F47).
const hero = live.hero;
const apollo = live.apollo_reasoning;
if (hero == null) red("TRUNCATED_NO_HERO");
if (apollo == null) red("TRUNCATED_NO_APOLLO_REASONING");
pass("not truncated — hero + apollo_reasoning both present top-level");

// (2) confidence_label strictly in {HIGH, MEDIUM, LOW}; MED is an alias of MEDIUM (F22).
const rawLabel = String(live.confidence_label ?? "").toUpperCase();
const label = rawLabel === "MED" ? "MEDIUM" : rawLabel;
if (!CONFIDENCE_SET.has(label)) red(`BAD_CONFIDENCE_LABEL=${rawLabel || "<missing>"}`);
pass(`confidence_label ${label} in {HIGH, MEDIUM, LOW}`);

// (3) §-cites present + taxonomy-VALID (D-06 = present + well-formed, NOT §2-only).
//     RED only if NO well-formed cite exists OR any §-led token is malformed.
const apolloStr = JSON.stringify(apollo);
const allCites = apolloStr.match(CITE_TOKEN) ?? [];
const malformed = allCites.filter((c) => !CITE_WELLFORMED.test(c));
const wellFormed = allCites.filter((c) => CITE_WELLFORMED.test(c));
if (malformed.length > 0) red(`MALFORMED_CITE=${malformed[0]}`);
if (wellFormed.length === 0) red("NO_SECTION_CITES");
const s2Cites = wellFormed.filter((c) => /^§2\./.test(c));
pass(`§-cites taxonomy-valid (${wellFormed.length} well-formed, ${s2Cites.length} §2.x)`);

// (4) overall_score non-null + finite number (F45).
const score = live.overall_score;
if (typeof score !== "number" || !Number.isFinite(score)) {
  red(`OVERALL_SCORE_NOT_FINITE=${String(score)}`);
}
pass(`overall_score ${score} is a finite number`);

// Non-fatal expected-dominant-family warning (D-06): §2.x is expected-dominant but
// not the sole legal family — warn, never RED, when zero §2.x cites are present.
if (s2Cites.length === 0) {
  console.log("GATE_ASSERT_WARN=NO_S2_CITES");
}

console.log(
  `GATE_ASSERT=GREEN OVERALL_SCORE=${score} CONFIDENCE=${label} CITES=${wellFormed.length} S2_CITES=${s2Cites.length}`
);
process.exit(0);
