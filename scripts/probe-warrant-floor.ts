/**
 * probe-warrant-floor.ts — at what floor does "proven outliers for {niche}" stop being a lie?
 *
 * WHY THIS EXISTS, AND WHY probe-warm-coverage.ts DOES NOT ANSWER IT
 * The open ruling (docs/HANDOFF-2026-08-15-live-first.md §7.2) is stated as "raising the floor to
 * 0.6 drops the pass rate to 34%". That 34% comes from `probe-warm-coverage.ts`, whose bar is
 * **>= 3 rows passing `isProofGrade`** at a `wide` fetch of 600. That is a RECALL question: how
 * often would the corpus still hand back a usable batch.
 *
 * The sentence the ruling is actually about is licensed by a different predicate with a different
 * bar. `assessWarrant("topical", …)` (warrant.ts) grounds on **`WARRANT_MIN_ROWS = 1`** row at or
 * above `warrantFloor()`, over the rows retrieval ALREADY returned — no `isProofGrade` test, no
 * second fetch. One row, not three. So the 34% measures how often we would still RETRIEVE enough,
 * not how often we would still be ENTITLED to the proof claim. Those are not the same number and
 * nothing had measured the second one.
 *
 * This probe measures the second one.
 *
 * THE TWO FLOORS ARE SEPARATE ENV KNOBS, AND THAT IS THE POINT
 *   GROUNDING_CACHE_MIN_SIMILARITY    (retrieve.ts, 0.5)  — may the model SEE this row?
 *   GROUNDING_WARRANT_MIN_SIMILARITY  (warrant.ts,  0.5)  — may we CITE it about the subject?
 * warrant.ts:17 records that they are allowed to differ and already do on the chat path (0.4/0.5).
 * Raising only the warrant floor costs the answer NOTHING — every row still reaches the model, the
 * batch just stops being called grounded and `warrantNote` switches to the honest wording. So the
 * cost of honesty here is not "two thirds of asks lose their rows"; it is "two thirds of asks lose
 * the PROOF FRAMING", and this prints that rate.
 *
 * THE NEGATIVE CONTROL IS THE WHOLE POINT (#484)
 * A pass rate alone cannot tell you a floor works. `asdfghjkl qwerty zxcvbn` clears gate 1 today.
 * A floor is only worth raising if it stops the gibberish BEFORE it stops the real asks, so the
 * controls from `probe-warm-coverage-control.ts` are carried here verbatim as variant D and scored
 * at every candidate floor alongside the real asks. Read the two columns together or not at all.
 *
 * NOTHING IS RE-IMPLEMENTED. It calls the shipped `retrieveCachedExamples` and the shipped
 * `assessWarrant`, mutating `GROUNDING_WARRANT_MIN_SIMILARITY` between assessments because
 * `warrantFloor()` reads it per call. The only things this file authors are the query set and the
 * tabulation — same discipline as probe-warm-coverage.ts.
 *
 * COST: DashScope embeddings only, ONE per query (retrieval is reused across all four floors).
 * ZERO Apify. Nothing is written to the database.
 *
 * Run:
 *   node node_modules/tsx/dist/cli.mjs scripts/probe-warrant-floor.ts [--limit N]
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { getCorpusClient } = require("@/lib/grounding/corpus");
const { resolveRetrieveConfig, retrieveCachedExamples } = require("@/lib/grounding/retrieve");
const { assessWarrant, warrantFloor } = require("@/lib/grounding/warrant");

const OUT_DIR =
  "/private/tmp/claude-501/-Users-davideloreti-virtuna-v1-1/df510fcc-c81b-4169-bb22-9e38f2aa950d/scratchpad";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const LIMIT = Number(arg("--limit") ?? 0);

/**
 * Candidate warrant floors — the FULL grid, evaluated one by one through the shipped
 * `assessWarrant`. 0.50 is today's value and anchors the table.
 *
 * ⚠️ Do not be tempted to score four floors and interpolate the rest from a stored `topSim`.
 * `grounded` at floor f is algebraically `topSim >= f`, so it looks free — but a `topSim` rounded
 * for display disagrees with the real predicate at the boundary, and the first cut of this probe
 * was off by one row at 0.60 for exactly that reason. Ask the shipped function at every floor you
 * intend to report.
 */
const FLOORS = Array.from({ length: 17 }, (_, i) => Math.round((0.5 + i * 0.01) * 100) / 100);

/**
 * The subset of variant D that is genuinely CONTENTLESS — keyboard mash and bare stopwords. These
 * are the ones #484 named, and the only controls whose passing is unambiguously a defect.
 * "carbonara recipe" is NOT here: the corpus really does hold food rows, so its warrant is earned.
 * retrieve.ts flags it for out-RANKING an on-topic query, which is a ranking fault, not a floor one.
 */
const CONTENTLESS = ["asdfghjkl qwerty zxcvbn", "yes", "ok", "the"];

/**
 * Variant D — carried VERBATIM from probe-warm-coverage-control.ts so the two probes' controls
 * cannot drift apart. "carbonara recipe" is the load-bearing one: retrieve.ts records it measuring
 * 0.673 against this corpus, ABOVE an on-topic personal-branding query. If a floor cannot reject
 * it, that floor is not measuring topicality either.
 */
const CONTROLS = [
  "asdfghjkl qwerty zxcvbn",
  "yes",
  "ok",
  "the",
  "carbonara recipe",
  "how to replace a timing belt on a 1998 diesel tractor",
  "medieval Latin manuscript palaeography",
  "settlement of the Peloponnesian War",
  "quantum chromodynamics lattice gauge theory",
  "my cat will not stop knocking things off the table",
  "conveyancing solicitor fees in rural Wales",
  "bulk carrier ballast water treatment regulations",
];

/**
 * Leading request boilerplate for variant B. Carried verbatim from probe-warm-coverage.ts — same
 * list, same order — so the A/B split means the same thing in both probes.
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

function isContentBearing(q: string): boolean {
  if (/^https?:\/\//i.test(q)) return false;
  if (/\.(mp4|mov|png|jpg|jpeg|webm)\s*$/i.test(q)) return false;
  return q.split(/\s+/).filter(Boolean).length >= 3;
}

type Variant = "A-raw" | "B-subject" | "C-labels" | "D-control";

interface Row {
  variant: Variant;
  query: string;
  original?: string;
  /** Rows retrieval returned — the set `assessWarrant` is handed. Floor-independent. */
  retrieved: number;
  /** Best similarity among them; with topical rank this is what decides a 1-row warrant. */
  topSim: number | null;
  /** floor → what the SHIPPED assessWarrant said at that floor. */
  byFloor: Record<string, { warrant: string; grounded: boolean; onSubject: number }>;
}

async function pullRealAsks(supabase: unknown): Promise<string[]> {
  const sb = supabase as {
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

async function main() {
  if (!process.env.DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY missing from .env.local");

  const supabase = getCorpusClient();
  const cfg = resolveRetrieveConfig("ideas");

  // Prove the two floors are actually distinct knobs before reporting anything about them.
  const shippedWarrant = warrantFloor();
  console.log(
    `retrieval : minSimilarity=${cfg.minSimilarity} fetchCount=${cfg.fetchCount} maxExamples=${cfg.maxExamples} rank=${cfg.rank}`,
  );
  console.log(`warrant   : shipped floor=${shippedWarrant}  WARRANT_MIN_ROWS=1 (warrant.ts:79)`);
  console.log(`floors under test: ${FLOORS.join(" / ")}\n`);

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
    new Set(
      ((nicheRows ?? []) as Array<{ niche: string | null }>).map((r) => r.niche).filter(Boolean),
    ),
  ) as string[];
  console.log(`corpus niche labels: ${labels.length}\n`);

  const set: Array<{ variant: Variant; query: string; original?: string }> = [];
  const capped = LIMIT > 0 ? asks.slice(0, LIMIT) : asks;
  for (const a of capped) set.push({ variant: "A-raw", query: a });
  for (const a of capped) {
    const s = stripBoilerplate(a);
    if (s.length >= 3) set.push({ variant: "B-subject", query: s, original: a });
  }
  for (const l of labels) set.push({ variant: "C-labels", query: l });
  for (const c of CONTROLS) set.push({ variant: "D-control", query: c });

  const results: Row[] = [];
  let i = 0;
  for (const item of set) {
    i++;
    // ONE retrieval per query. The floors are then applied to the SAME returned rows, which is
    // exactly what changing GROUNDING_WARRANT_MIN_SIMILARITY alone would do in production.
    const { examples } = await retrieveCachedExamples({
      query: item.query,
      skill: "ideas",
      platform: "tiktok",
    });

    const byFloor: Row["byFloor"] = {};
    for (const f of FLOORS) {
      process.env.GROUNDING_WARRANT_MIN_SIMILARITY = String(f);
      const a = assessWarrant("topical", examples);
      byFloor[f.toFixed(2)] = { warrant: a.warrant, grounded: a.grounded, onSubject: a.onSubject };
    }
    process.env.GROUNDING_WARRANT_MIN_SIMILARITY = String(shippedWarrant);

    const sims = examples
      .map((e: { similarity: number | null }) => e.similarity)
      .filter((s: number | null): s is number => typeof s === "number");
    results.push({
      ...item,
      retrieved: examples.length,
      // RAW, unrounded — rounding this is what put the first cut off by one at 0.60.
      topSim: sims.length ? Math.max(...sims) : null,
      byFloor,
    });
    if (i % 25 === 0) console.log(`  …${i}/${set.length}`);
  }

  const groundedAt = (rows: Row[], f: number) =>
    rows.filter((r) => r.byFloor[f.toFixed(2)]?.grounded).length;
  const cell = (x: number, n: number) =>
    n ? `${String(x).padStart(3)} (${((100 * x) / n).toFixed(1).padStart(5)}%)` : "     —      ";

  const A = results.filter((r) => r.variant === "A-raw");
  const B = results.filter((r) => r.variant === "B-subject");
  const C = results.filter((r) => r.variant === "C-labels");
  const D = results.filter((r) => r.variant === "D-control");
  const mash = D.filter((r) => CONTENTLESS.includes(r.query));

  console.log(
    `\n${"=".repeat(100)}\nWARRANT PASS RATE — may we say "proven outliers for {niche}"?  (assessWarrant, >=1 row)\n${"=".repeat(100)}`,
  );
  console.log(
    `floor    A-raw(${A.length})     B-subject(${B.length})  C-labels(${C.length})   D-control(${D.length})  contentless(${mash.length})`,
  );
  for (const f of FLOORS) {
    console.log(
      `${f.toFixed(2)}   ${cell(groundedAt(A, f), A.length)}  ${cell(groundedAt(B, f), B.length)}  ` +
        `${cell(groundedAt(C, f), C.length)}  ${cell(groundedAt(D, f), D.length)}  ${groundedAt(mash, f)}/${mash.length}`,
    );
  }
  console.log(
    `\n🔴 Read the LAST column against the first two. A floor is worth raising only if the\n` +
      `   contentless controls fall FASTER than the real asks. If they fall together, the floor\n` +
      `   is not measuring topicality — it is just measuring less.`,
  );

  const detail = (label: string, rows: Row[], width: number) => {
    console.log(`\n${"-".repeat(100)}\n${label}\n${"-".repeat(100)}`);
    console.log(
      `query`.padEnd(width) + `ret  topSim   first floor that REFUSES the proof claim`,
    );
    for (const r of rows) {
      const firstRefusing = FLOORS.find((f) => !r.byFloor[f.toFixed(2)]?.grounded);
      const verdict =
        r.retrieved === 0
          ? "no rows retrieved at all"
          : firstRefusing === undefined
            ? `never — grounded at every floor up to ${FLOORS[FLOORS.length - 1].toFixed(2)}`
            : firstRefusing.toFixed(2);
      console.log(
        `${r.query.slice(0, width - 2).padEnd(width)}${String(r.retrieved).padStart(3)}  ` +
          `${(r.topSim === null ? "—" : r.topSim.toFixed(3)).padStart(6)}   ${verdict}`,
      );
    }
  };
  detail("variant D — every control", D, 50);
  detail("variant C — corpus's own niche labels (the upper bound)", C, 30);

  const path = `${OUT_DIR}/warrant-floor-${results.length}.json`;
  writeFileSync(
    path,
    JSON.stringify({ retrieval: cfg, shippedWarrantFloor: shippedWarrant, FLOORS, results }, null, 2),
  );
  console.log(`\nfull results: ${path}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
