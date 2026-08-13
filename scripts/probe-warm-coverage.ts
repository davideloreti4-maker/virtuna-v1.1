/**
 * probe-warm-coverage.ts — is Phase 3's gate 1 ("warm-first") the common path, or a rare branch?
 *
 * WHAT THIS ANSWERS
 * The Phase 3 design (docs/superpowers/specs/2026-08-10-apify-governance-phase3-design.md) orders
 * its gates warm-first: `warmCoverage(niche)` runs BEFORE any spend gate, on the stated grounds
 * that the cache answers most asks for free. §5.1 of that same spec flags the premise as untested
 * — "measure warm-hit rate across real niches before treating gate 1 as load-bearing".
 * This is that measurement.
 *
 * WHAT "SUFFICIENT" MEANS HERE — the SHIPPED predicate, not a re-implementation
 * §1.1 defines gate 1 as "at least 3 corpus rows clearing 3× against a stated baseline". That is
 * exactly `isProofGrade` (retrieve.ts): a non-empty `baseline_label` AND
 * `outlier_multiplier >= MIN_OUTLIER_MULTIPLIER (3)`. This probe imports that function rather than
 * restating the rule, so it cannot drift from what ships.
 *
 * ⚠️ It also imports `isAdmissible` / `hasReusableSignal` / `isFreshTeardown` and the real
 * `resolveRetrieveConfig`, `embedQueryText` and `matchSharedTeardowns`. The only thing this script
 * writes itself is the QUERY SET and the tabulation.
 *
 * THE QUERY SET — pulled live from prod, never invented
 * `creator_profiles.niches` is `[]` on all 18 rows, so there are no self-reported niches to use.
 * The only real record of what creators ask is `messages` (role='user'). Three variants:
 *
 *   A  raw     — every distinct real ask, VERBATIM. No editing. The pessimistic read: a real ask
 *                carries instruction boilerplate ("give me 3 hooks for…") that an explore `niche`
 *                argument would not.
 *   B  subject — variant A with a FIXED, documented list of leading request boilerplate stripped
 *                by regex (see STRIP below). Every transformation is printed next to its original
 *                so the edit is auditable rather than trusted.
 *   C  labels  — the corpus's OWN 17 niche labels. These are the friendliest possible input; the
 *                corpus is literally indexed by them. This is an UPPER BOUND: if gate 1 misses
 *                here, it misses everywhere.
 *
 * TWO FETCH WIDTHS
 * The shipped topical config fetches 12 rows (`fetchCount: 12`) before filtering. `warmCoverage`
 * is a new function and the spec does not say it reuses that width, so both are reported:
 *   - `n12`   what a gate built on the shipped retrieval config would see
 *   - `wide`  fetchCount 600 (> the 532-row corpus) — the best gate 1 could possibly do
 *
 * COST: DashScope embeddings only (one short string per query). ZERO Apify. Nothing is written.
 *
 * Run (foreground):
 *   node node_modules/tsx/dist/cli.mjs scripts/probe-warm-coverage.ts [--limit N]
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { getCorpusClient, matchSharedTeardowns } = require("@/lib/grounding/corpus");
const { embedQueryText } = require("@/lib/grounding/embedder");
const {
  resolveRetrieveConfig,
  isAdmissible,
  isProofGrade,
  isFreshTeardown,
  hasReusableSignal,
} = require("@/lib/grounding/retrieve");

const OUT_DIR =
  "/private/tmp/claude-501/-Users-davideloreti-virtuna-v1-1/918ce35c-2108-41ac-9539-86604de6687c/scratchpad";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const LIMIT = Number(arg("--limit") ?? 0);

/** Gate 1's bar, from the spec: "at least 3 corpus rows clearing 3×". */
const SUFFICIENT_ROWS = 3;

/**
 * Leading request boilerplate stripped for variant B. FIXED list, applied in order, case-
 * insensitive. Deliberately conservative: it removes the imperative wrapper and a leading count,
 * never a subject word. Every result is printed beside its original for audit.
 */
const STRIP: RegExp[] = [
  /^(?:ok|okay|yes|and|now|also)[,\s]+/i,
  /^(?:can you|could you|i want you to|i want to|i need|i'd like|please)\s+/i,
  /^(?:write|give|show|make|generate|create|do)\s+(?:me\s+)?/i,
  /^(?:me\s+)/i,
  /^(?:some|a few|a|an|the)\s+/i,
  /^\d+\s+/,
  /^(?:more\s+)?(?:viral\s+|good\s+|scroll-stopping\s+|non-obvious\s+)?(?:hooks?|ideas?|content ideas?|video ideas?|scripts?|content)\s+/i,
  /^(?:options?|cards?)\s+/i,
  /^(?:for|about|on)\s+(?:a\s+|my\s+|the\s+)?(?:new\s+)?(?:video\s+)?(?:about\s+)?/i,
  /^(?:my\s+niche is\s+)/i,
];

function stripBoilerplate(q: string): string {
  let s = q.trim();
  for (const re of STRIP) s = s.replace(re, "").trim();
  return s;
}

/** Drop asks with no subject at all: URLs, filenames, pure thread-management. */
function isContentBearing(q: string): boolean {
  if (/^https?:\/\//i.test(q)) return false;
  if (/\.(mp4|mov|png|jpg|jpeg|webm)\s*$/i.test(q)) return false;
  const words = q.split(/\s+/).filter(Boolean);
  return words.length >= 3;
}

interface Row {
  variant: "A-raw" | "B-subject" | "C-labels";
  query: string;
  original?: string;
  n12: Score;
  wide: Score;
}

interface Score {
  matched: number;
  admissible: number;
  proof: number;
  proofStrict: number;
  sufficient: boolean;
  sufficientStrict: boolean;
  topSim: number;
}

async function pullRealAsks(supabase: unknown): Promise<string[]> {
  const sb = supabase as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
  const { data, error } = await sb.from("messages").select("body, role").eq("role", "user");
  if (error) throw new Error(`messages read failed: ${JSON.stringify(error)}`);

  const texts: string[] = [];
  for (const r of (data ?? []) as Array<{ body: unknown }>) {
    const body = r.body as { blocks?: unknown[] } | unknown[] | null;
    const blocks = Array.isArray(body) ? body : (body?.blocks ?? []);
    if (!Array.isArray(blocks)) continue;
    const parts = blocks
      .filter((b) => (b as { type?: string })?.type === "markdown")
      .map((b) => (b as { props?: { text?: string } })?.props?.text ?? "")
      .filter(Boolean);
    if (parts.length > 0) texts.push(parts.join(" ").trim());
  }
  const seen = new Set<string>();
  const distinct: string[] = [];
  for (const t of texts) {
    const k = t.toLowerCase().trim();
    if (k && !seen.has(k)) {
      seen.add(k);
      distinct.push(t.trim());
    }
  }
  return distinct;
}

async function score(
  supabase: unknown,
  embedding: number[],
  count: number,
  config_: { minSimilarity: number; freshDays: number },
): Promise<Score> {
  const rows = await matchSharedTeardowns(supabase, {
    embedding,
    count,
    filterPlatform: null,
    filterFormat: null,
    filterArchetype: null,
    filterVisual: null,
    filterEditing: null,
    filterNiche: null,
    filterHookTechnique: null,
    filterHookFamily: null,
  });

  // The real admissibility chain from retrieveCachedExamples.
  const good = rows.filter(
    (r: Record<string, unknown>) =>
      (r.similarity as number) >= config_.minSimilarity &&
      isFreshTeardown(r.proof_captured_at, config_.freshDays) &&
      isAdmissible(r) &&
      hasReusableSignal(r),
  );
  const proof = good.filter((r: Record<string, unknown>) => isProofGrade(r));
  // STRICT tier. The 0.5 floor is only ~0.05 above the corpus's own median similarity
  // (retrieve.ts: "the corpus's median similarity IS ~0.45, so that floor means 'accept a random
  // row'"), and gate 1 applies NO niche filter — so a pass at 0.5 can mean "cosine returned its
  // nearest rows" rather than "the corpus covers this subject". 0.6 separates the two.
  const proofStrict = proof.filter((r: Record<string, unknown>) => (r.similarity as number) >= 0.6);
  return {
    matched: rows.length,
    admissible: good.length,
    proof: proof.length,
    proofStrict: proofStrict.length,
    sufficient: proof.length >= SUFFICIENT_ROWS,
    sufficientStrict: proofStrict.length >= SUFFICIENT_ROWS,
    topSim: rows.length > 0 ? Number((rows[0].similarity as number).toFixed(3)) : 0,
  };
}

async function main() {
  if (!process.env.DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY missing from .env.local");

  const supabase = getCorpusClient();
  const cfg = resolveRetrieveConfig(); // no skill → the topical default: minSim 0.5, fetch 12
  console.log(
    `config: minSimilarity=${cfg.minSimilarity} freshDays=${cfg.freshDays} fetchCount=${cfg.fetchCount} rank=${cfg.rank}`,
  );
  console.log(`gate 1 bar: >= ${SUFFICIENT_ROWS} rows passing isProofGrade (basis + multiplier >= 3)\n`);

  const asks = (await pullRealAsks(supabase)).filter(isContentBearing);
  console.log(`real distinct content-bearing asks pulled from prod: ${asks.length}`);

  const { data: nicheRows } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => { eq: (a: string, b: string) => Promise<{ data: unknown }> };
      };
    }
  )
    .from("outlier_teardowns")
    .select("niche")
    .eq("status", "extracted");
  const labels = Array.from(
    new Set(((nicheRows ?? []) as Array<{ niche: string | null }>).map((r) => r.niche).filter(Boolean)),
  ) as string[];
  console.log(`corpus niche labels: ${labels.length}\n`);

  const set: Array<{ variant: Row["variant"]; query: string; original?: string }> = [];
  const capped = LIMIT > 0 ? asks.slice(0, LIMIT) : asks;
  for (const a of capped) set.push({ variant: "A-raw", query: a });
  for (const a of capped) {
    const s = stripBoilerplate(a);
    if (s.length >= 3) set.push({ variant: "B-subject", query: s, original: a });
  }
  for (const l of labels) set.push({ variant: "C-labels", query: l });

  const results: Row[] = [];
  let i = 0;
  for (const item of set) {
    i++;
    const embedding = await embedQueryText(item.query);
    const n12 = await score(supabase, embedding, cfg.fetchCount, cfg);
    const wide = await score(supabase, embedding, 600, cfg);
    results.push({ ...item, n12, wide });
    if (i % 25 === 0) console.log(`  …${i}/${set.length}`);
  }

  const summarise = (v: Row["variant"]) => {
    const rows = results.filter((r) => r.variant === v);
    const n = rows.length;
    const s12 = rows.filter((r) => r.n12.sufficient).length;
    const sw = rows.filter((r) => r.wide.sufficient).length;
    const strict = rows.filter((r) => r.wide.sufficientStrict).length;
    const zero12 = rows.filter((r) => r.n12.admissible === 0).length;
    const pct = (x: number) => (n ? `${((x / n) * 100).toFixed(1)}%` : "—");
    return { v, n, s12, sw, strict, zero12, p12: pct(s12), pw: pct(sw), ps: pct(strict), pz: pct(zero12) };
  };

  console.log(`\n${"=".repeat(92)}\nWARM-HIT RATE — gate 1 sufficiency (>= 3 rows passing isProofGrade)\n${"=".repeat(92)}`);
  console.log("variant        n    n12 @0.5        wide @0.5       wide @0.6 STRICT   zero-adm");
  for (const v of ["A-raw", "B-subject", "C-labels"] as const) {
    const s = summarise(v);
    console.log(
      `${s.v.padEnd(13)} ${String(s.n).padStart(3)}  ${String(s.s12).padStart(3)} (${s.p12.padStart(6)})   ${String(s.sw).padStart(3)} (${s.pw.padStart(6)})   ${String(s.strict).padStart(3)} (${s.ps.padStart(6)})      ${String(s.zero12).padStart(3)}`,
    );
  }

  console.log(`\n${"-".repeat(78)}\nvariant C — the upper bound, per corpus niche label\n${"-".repeat(78)}`);
  for (const r of results.filter((x) => x.variant === "C-labels")) {
    console.log(
      `${r.query.padEnd(22)} n12 ${String(r.n12.proof).padStart(2)}p ${r.n12.sufficient ? "HIT " : "miss"}  wide ${String(r.wide.proof).padStart(3)}p ${r.wide.sufficient ? "HIT " : "miss"}  strict@0.6 ${String(r.wide.proofStrict).padStart(3)}p ${r.wide.sufficientStrict ? "HIT " : "miss"}  topSim ${r.n12.topSim}`,
    );
  }

  console.log(`\n${"-".repeat(78)}\nvariant B — every strip, printed for audit (first 40)\n${"-".repeat(78)}`);
  for (const r of results.filter((x) => x.variant === "B-subject").slice(0, 40)) {
    console.log(
      `${r.n12.sufficient ? "HIT " : "miss"} ${String(r.n12.proof).padStart(2)}p/${String(r.n12.admissible).padStart(2)}a  "${r.query.slice(0, 52)}"\n       ← "${(r.original ?? "").slice(0, 62)}"`,
    );
  }

  const path = `${OUT_DIR}/warm-coverage-${Date.now()}.json`;
  writeFileSync(path, JSON.stringify({ config: cfg, results }, null, 2));
  console.log(`\nfull results: ${path}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
