/**
 * spike-slot-composer.ts — can the model COMPOSE a card, not just call a tool?
 *
 * THE QUESTION. The architecture replaces "one bespoke React block per output type" with a single
 * `composed-card` block whose props are a validated SLOT TREE. The model picks which slots, in what
 * order, with what content; the design system owns every pixel; `actions` is a closed enum so
 * nothing that spends a credit is ever model-authored.
 *
 * ─── RE-RUN, 2026-08-12 (Task 8) ────────────────────────────────────────────────────────────────
 * The v0 run (spec §2.1) measured a DRAFT schema written inside this file. This run measures WHAT
 * SHIPS: the tool definition, the recipe registry, the validator and the emit boundary are all
 * imported, so a green number here is a statement about production and not about a fixture.
 *
 * FOUR BASES CHANGED. None of them are the harness being sloppy; each is the contract moving under
 * the spike, and each makes one v0 figure non-comparable:
 *   1. B2 — `actions` was an 11th SLOT KIND in v0 and is a CARD FIELD in the shipped contract, so
 *      `distinctSlotKinds` counts a different population. Do not compare it to §2.1.
 *   2. D6 — v0 had a free-text `hero`; the contract has a TYPED `deliverable`. This is the change
 *      §2.1 finding 1 demanded, and `heroUsable` below is the number that says whether it worked.
 *   3. D7 — v0 let the model write a `handle` into a proof_strip. The contract takes ROW IDS and
 *      the server materializes the numbers, so "fabricated handles" is no longer a thing the model
 *      CAN do. What is measurable now is a fabricated row ID, which is strictly weaker evidence of
 *      honesty and strictly stronger evidence of safety. Both are reported.
 *   4. Retrieval — v0 wrapped `retrieveCachedExamples` by hand. This run calls the shipped
 *      `executeCorpusSearch` with `includeRowIds: true`, because row ids are the only thing a
 *      proof_strip can consume and the hand-rolled wrapper does not emit them.
 *
 * NEW INSTRUMENT: the §5 repair ladder. When a tree fails validation the model is handed the real
 * error and one retry, exactly as `chat-agent-loop.ts` does it. `repaired` records whether that
 * retry actually recovered the card — the number that says whether "one repair attempt, then
 * prose" is a real degrade path or just a comment.
 *
 * WHAT IS REAL HERE: real DashScope, real pgvector retrieval over the real 532-row corpus, real
 * multi-round tool loop, real receipt materialization from Supabase. The only thing that does not
 * happen is React rendering — we capture the validated block instead.
 *
 * Run (FOREGROUND, sandbox OFF — rtk silently drops DashScope/Supabase network):
 *   node node_modules/tsx/dist/cli.mjs scripts/spike-slot-composer.ts
 * Needs .env.local: DASHSCOPE_API_KEY + SUPABASE_SERVICE_ROLE_KEY (+ URL).
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { getQwenClient, QWEN_SEED } = require("@/lib/engine/qwen/client");
const { retrieveCachedExamples } = require("@/lib/grounding/retrieve");
const { SEARCH_CORPUS_TOOL, executeCorpusSearch } = require("@/lib/grounding/corpus-tool");
const { EMIT_CARD_TOOL, handleEmitCard } = require("@/lib/tools/emit-card-tool");
const { RECIPES } = require("@/lib/tools/composed-card-schema");

const PLATFORM = "tiktok";
const MAX_ROUNDS = 6;
const MODELS = ["qwen3.7-flash", "qwen3.7-plus"] as const;

const OUT_DIR = resolve(__dirname, "../.spike-out");

/**
 * The system prompt is the v0 one with ONE sentence changed: the contract's unit is a recipe, not a
 * free hero line, so the model has to be told that much or the run measures a misunderstanding
 * rather than a capability. Everything else is held constant against §2.1 on purpose.
 */
const SYSTEM = [
  "You are Maven, a strategist for short-form video creators.",
  "You have two tools: search_corpus (real evidence) and emit_card (how you SHOW your answer).",
  "Ground claims in search_corpus before calling anything proven.",
  "Then call emit_card to render the answer as cards: pick the RECIPE that fits the ask and compose",
  "it from the slots that recipe allows. Keep your prose to ONE short line —",
  "the cards carry the answer, so never restate a card's contents in prose.",
].join(" ");

// ─── Cases: deliberately varied output SHAPES, not variations of one ask ─────
// Unchanged from v0. `expect` is the recipe a competent composer should reach for — recorded, never
// enforced: a model that solves "compare these" with a `brief` has made a defensible call, and the
// point of the column is to show what it actually reached for.

const CASES: Array<{ id: string; ask: string; wants: string; expect: string }> = [
  {
    id: "formats",
    ask: "find me 3 viral video formats that went viral for young startup founders",
    wants: "3 cards, each a format with proof + structural beats",
    expect: "format-set",
  },
  {
    id: "hooks",
    ask: "give me 5 hooks for a video about raising my SaaS prices",
    wants: "hook cards — short, one line each",
    expect: "hook-set",
  },
  {
    id: "angles",
    ask: "what angles could I take on 'I fired my best engineer'?",
    wants: "several angle cards, no proof necessarily",
    expect: "angle-set",
  },
  {
    id: "ad",
    ask: "write me a 30 second ad script for a productivity app aimed at students",
    wants: "one card with a script_timeline",
    expect: "script",
  },
  {
    id: "compare",
    ask: "greenscreen vs talking head for explaining a technical product — which works better and why?",
    wants: "one card with a comparison slot",
    expect: "comparison",
  },
  {
    id: "teardown",
    ask: "what's the strongest way to open a personal failure story? show me the proof",
    wants: "one card, proof_strip + beats",
    expect: "teardown",
  },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

interface CaseResult {
  model: string;
  caseId: string;
  ask: string;
  expectedRecipe: string;
  rounds: number;
  searchCalls: number;
  searchQueries: string[];
  /** Teardown row ids retrieval actually handed the model — the only legal proof_strip input. */
  idsReturned: string[];
  emitted: boolean;
  /** How many times the model called emit_card (>1 means it used its repair attempt). */
  emitAttempts: number;
  /** Blocks that would actually render, after the shipped emit boundary. */
  cardCount: number;
  valid: boolean;
  recipesUsed: string[];
  validationErrors: string[];
  /**
   * The RAW arguments of every emit_card call that produced nothing. Without these a failure reads
   * as "the model is weak" when it may be "our JSON schema is confusing" — and those two findings
   * point at opposite fixes.
   */
  failedArgs: string[];
  /** A first attempt that failed and a later one that succeeded — §5's ladder, measured. */
  repaired: boolean;
  slotKinds: string[];
  distinctSlotKinds: number;
  /** D6: is each `hook-set` deliverable a usable LINE rather than a label? */
  heroChecked: number;
  heroUsable: number;
  heroSamples: string[];
  /** Row ids the model named that retrieval never returned. */
  fabricatedRefs: string[];
  /** Ids that survived into a real server-materialized receipt. */
  receiptsResolved: number;
  /** Receipts that printed a NUMBER (the rest render handle + views only). */
  receiptsWithNumber: number;
  /** Belt and braces on D7: a `handle` key anywhere in the model's raw args. */
  modelWroteAHandle: boolean;
  badActions: string[];
  /** `length` here means the model was CUT OFF, not that it composed badly. */
  finishReasons: string[];
  proseChars: number;
  cards: unknown;
  error?: string;
}

const norm = (s: string) => s.replace(/^@/, "").trim().toLowerCase();

/**
 * D6's practical proxy (plan Task 8 step 2): a hook is a LINE someone could say out loud, not a
 * label. Two cheap discriminators — it has a space, and it is not Title-Cased throughout ("Raise
 * Your Prices Confidently" is a heading; "I raised my prices 40% and nobody left" is a hook).
 */
function isUsableLine(text: string): boolean {
  const trimmed = text.trim();
  if (!/\s/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  if (words.length < 3) return false;
  const capitalised = words.filter((w) => /^[A-Z]/.test(w));
  return capitalised.length < words.length;
}

/** Walk the model's RAW args — before zod strips anything — looking for a key it must not write. */
function rawHasHandleKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(rawHasHandleKey);
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "handle" || k === "clips") return true;
      if (rawHasHandleKey(v)) return true;
    }
  }
  return false;
}

function collectFromCards(raw: unknown): { slotKinds: string[]; recipes: string[]; refs: string[]; actions: string[] } {
  const out = { slotKinds: [] as string[], recipes: [] as string[], refs: [] as string[], actions: [] as string[] };
  let list = (raw as { cards?: unknown })?.cards;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      /* the emit boundary reports it */
    }
  }
  if (!Array.isArray(list)) return out;
  for (const c of list) {
    const card = c as Record<string, unknown>;
    if (typeof card?.recipe === "string") out.recipes.push(card.recipe);
    if (typeof card?.receiptRef === "string") out.refs.push(card.receiptRef);
    if (Array.isArray(card?.actions)) for (const a of card.actions) if (typeof a === "string") out.actions.push(a);
    for (const slot of [...(Array.isArray(card?.body) ? card.body : []), ...(Array.isArray(card?.disclosure) ? card.disclosure : [])]) {
      const s = slot as Record<string, unknown>;
      if (typeof s?.kind === "string") out.slotKinds.push(s.kind);
      if (Array.isArray(s?.receiptRefs)) for (const r of s.receiptRefs) if (typeof r === "string") out.refs.push(r);
    }
  }
  return out;
}

async function runCase(model: string, c: (typeof CASES)[number]): Promise<CaseResult> {
  const client = getQwenClient();
  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: SYSTEM },
    { role: "user", content: c.ask },
  ];

  const res: CaseResult = {
    model,
    caseId: c.id,
    ask: c.ask,
    expectedRecipe: c.expect,
    rounds: 0,
    searchCalls: 0,
    searchQueries: [],
    idsReturned: [],
    emitted: false,
    emitAttempts: 0,
    cardCount: 0,
    valid: false,
    recipesUsed: [],
    validationErrors: [],
    failedArgs: [],
    repaired: false,
    slotKinds: [],
    distinctSlotKinds: 0,
    heroChecked: 0,
    heroUsable: 0,
    heroSamples: [],
    fabricatedRefs: [],
    receiptsResolved: 0,
    receiptsWithNumber: 0,
    modelWroteAHandle: false,
    badActions: [],
    finishReasons: [],
    proseChars: 0,
    cards: null,
  };

  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      res.rounds = round;
      const completion = await client.chat.completions.create({
        model,
        messages,
        tools: [SEARCH_CORPUS_TOOL, EMIT_CARD_TOOL],
        tool_choice: "auto",
        temperature: 0.3,
        seed: QWEN_SEED,
        max_tokens: 3000,
        enable_thinking: false,
      });

      const finish = completion.choices?.[0]?.finish_reason;
      if (finish) res.finishReasons.push(String(finish));
      const msg = completion.choices?.[0]?.message;
      if (!msg) break;
      res.proseChars += (msg.content ?? "").length;
      messages.push(msg as Record<string, unknown>);

      const calls = msg.tool_calls ?? [];
      if (calls.length === 0) break;

      let rendered = false;
      for (const call of calls) {
        const name = call.function?.name;
        const rawArgs = call.function?.arguments ?? "{}";

        if (name === "search_corpus") {
          res.searchCalls++;
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(rawArgs);
          } catch {
            /* an empty query is recorded below */
          }
          res.searchQueries.push(String(parsedArgs.query ?? ""));
          // The SHIPPED seam, with ids on — that is the only configuration in which a proof_strip
          // has anything to point at.
          const out = await executeCorpusSearch(parsedArgs, PLATFORM, round, retrieveCachedExamples, {
            includeRowIds: true,
          });
          try {
            const payload = JSON.parse(out.content);
            for (const row of payload.results ?? []) if (row?.id) res.idsReturned.push(String(row.id));
          } catch {
            /* a retrieval error is already inside out.content */
          }
          messages.push({ role: "tool", tool_call_id: call.id, content: out.content });
          continue;
        }

        if (name === "emit_card") {
          res.emitted = true;
          res.emitAttempts++;
          const attemptedBefore = res.emitAttempts > 1;

          let parsed: unknown = null;
          try {
            parsed = JSON.parse(rawArgs);
          } catch (e) {
            res.validationErrors.push(`emit_card args not JSON: ${e instanceof Error ? e.message : String(e)}`);
            res.failedArgs.push(rawArgs);
            messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "bad json" }) });
            continue;
          }

          if (rawHasHandleKey(parsed)) res.modelWroteAHandle = true;
          const collected = collectFromCards(parsed);

          // The REAL boundary: recipe legality, cardCount, arg repair, receipt materialization.
          const { blocks, error } = await handleEmitCard(parsed);

          if (blocks.length > 0) {
            if (attemptedBefore) res.repaired = true;
            res.cards = parsed;
            res.valid = true;
            res.cardCount = blocks.length;
            res.recipesUsed = collected.recipes;
            res.slotKinds = collected.slotKinds;
            res.distinctSlotKinds = new Set(collected.slotKinds).size;
            res.badActions = collected.actions.filter(
              (a) => !blocks.some((b: { props: { actions?: string[] } }) => (b.props.actions ?? []).includes(a)),
            );

            const returned = new Set(res.idsReturned.map(norm));
            res.fabricatedRefs = [...new Set(collected.refs)].filter((r) => !returned.has(norm(r)));

            for (const b of blocks as Array<{ props: Record<string, unknown> }>) {
              const receipts = (b.props.receipts ?? {}) as Record<string, { multiplier: number | null }>;
              res.receiptsResolved += Object.keys(receipts).length;
              res.receiptsWithNumber += Object.values(receipts).filter((p) => p.multiplier !== null).length;

              // D6, on the recipe whose payoff MUST be a usable line.
              if (b.props.recipe === "hook-set") {
                const text = String((b.props.deliverable as { text?: unknown })?.text ?? "");
                res.heroChecked++;
                if (isUsableLine(text)) res.heroUsable++;
                res.heroSamples.push(text);
              }
            }

            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({ shown: `${blocks.length} card(s)`, note: "cards are on screen" }),
            });
            rendered = true;
            continue;
          }

          // Failed. Hand back the real error and one retry — the shipped §5 ladder, verbatim.
          res.validationErrors.push(error ?? "unknown emit failure");
          res.failedArgs.push(rawArgs);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(
              res.emitAttempts === 1
                ? { error, note: "fix exactly that and call emit_card once more — you get one retry, then answer in prose" }
                : { error, note: "do not call emit_card again this turn — answer the creator directly in prose instead" },
            ),
          });
          continue;
        }

        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "unknown tool" }) });
      }

      if (rendered) {
        // One more round so the model can write its closing line, then stop.
        const closing = await client.chat.completions.create({
          model,
          messages,
          tools: [SEARCH_CORPUS_TOOL, EMIT_CARD_TOOL],
          tool_choice: "none",
          temperature: 0.3,
          seed: QWEN_SEED,
          max_tokens: 300,
          enable_thinking: false,
        });
        res.proseChars += (closing.choices?.[0]?.message?.content ?? "").length;
        break;
      }
    }
  } catch (e) {
    res.error = e instanceof Error ? e.message : String(e);
  }
  return res;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const results: CaseResult[] = [];

  const onlyModel = process.env.SPIKE_MODEL;
  const onlyCase = process.env.SPIKE_CASE;
  for (const model of MODELS.filter((m) => !onlyModel || m === onlyModel)) {
    for (const c of CASES.filter((x) => !onlyCase || x.id === onlyCase)) {
      process.stdout.write(`▸ ${model.padEnd(14)} ${c.id.padEnd(10)} `);
      const r = await runCase(model, c);
      results.push(r);
      const verdict = r.error
        ? `ERROR ${r.error}`
        : !r.emitted
          ? "NO CARD (prose only)"
          : `${r.cardCount} card(s) · ${r.valid ? "VALID" : "INVALID"} · ${r.recipesUsed[0] ?? "—"}` +
            ` · ${r.distinctSlotKinds} slot kinds · ${r.searchCalls} search` +
            (r.emitAttempts > 1 ? ` · ${r.emitAttempts} attempts${r.repaired ? " (REPAIRED)" : ""}` : "") +
            (r.fabricatedRefs.length ? ` · ⚠ ${r.fabricatedRefs.length} FABRICATED REF` : "");
      process.stdout.write(`${verdict}\n`);
    }
  }

  writeFileSync(resolve(OUT_DIR, "slot-composer-results.json"), JSON.stringify(results, null, 2));

  // ── Report ────────────────────────────────────────────────────────────────
  const lines: string[] = ["", "═".repeat(78), "SLOT COMPOSER SPIKE — re-run against the SHIPPED contract", "═".repeat(78), ""];
  for (const model of MODELS) {
    const rs = results.filter((r) => r.model === model);
    const emitted = rs.filter((r) => r.emitted);
    const valid = rs.filter((r) => r.valid);
    const usedProof = rs.filter((r) => r.receiptsResolved > 0);
    const fabricated = rs.filter((r) => r.fabricatedRefs.length > 0);
    const firstTry = rs.filter((r) => r.valid && r.emitAttempts === 1);
    const needed = rs.filter((r) => r.emitAttempts > 1);
    const rightRecipe = rs.filter((r) => r.recipesUsed[0] === r.expectedRecipe);
    const kinds = new Set(rs.flatMap((r) => r.slotKinds));
    const heroChecked = rs.reduce((a, r) => a + r.heroChecked, 0);
    const heroUsable = rs.reduce((a, r) => a + r.heroUsable, 0);
    lines.push(
      `${model}`,
      `  emitted a card        ${emitted.length}/${rs.length}`,
      `  rendered (valid)      ${valid.length}/${rs.length}`,
      `    …on the first try   ${firstTry.length}/${rs.length}`,
      `    …needed a repair    ${needed.length}  (recovered: ${rs.filter((r) => r.repaired).length})`,
      `  picked the expected recipe  ${rightRecipe.length}/${rs.length}`,
      `  D6 hero rule (hook-set deliverable is a usable LINE)  ${heroUsable}/${heroChecked}`,
      `  resolved a real receipt     ${usedProof.length}/${rs.length}` +
        `  (${rs.reduce((a, r) => a + r.receiptsResolved, 0)} receipts, ` +
        `${rs.reduce((a, r) => a + r.receiptsWithNumber, 0)} carrying a number)`,
      `  FABRICATED row ids    ${fabricated.length}/${rs.length}  ${fabricated.length ? "⚠️" : "✓"}`,
      `  model wrote a handle  ${rs.filter((r) => r.modelWroteAHandle).length}/${rs.length}  ${rs.some((r) => r.modelWroteAHandle) ? "⚠️ (stripped, but it tried)" : "✓"}`,
      `  searched corpus       ${rs.filter((r) => r.searchCalls > 0).length}/${rs.length}`,
      `  slot kinds used       ${[...kinds].sort().join(", ") || "(none)"}`,
      `  avg prose chars       ${Math.round(rs.reduce((a, r) => a + r.proseChars, 0) / rs.length)}`,
      "",
    );
  }
  lines.push("─".repeat(78), "PER CASE", "─".repeat(78));
  for (const c of CASES) {
    lines.push("", `${c.id} — "${c.ask}"`, `  wants: ${c.wants}  (expected recipe: ${c.expect})`);
    for (const model of MODELS) {
      const r = results.find((x) => x.model === model && x.caseId === c.id);
      if (!r) continue;
      lines.push(
        `  ${model.padEnd(14)} ${r.emitted ? `${r.cardCount} card(s)` : "NO CARD"} · ` +
          `${r.valid ? "valid" : "INVALID"} · recipe: ${r.recipesUsed[0] ?? "—"} · ` +
          `slots: ${[...new Set(r.slotKinds)].join("+") || "—"}` +
          (r.receiptsResolved ? ` · ${r.receiptsResolved} receipt(s)` : "") +
          (r.fabricatedRefs.length ? ` · ⚠ fabricated ref: ${r.fabricatedRefs.slice(0, 2).join(", ")}` : "") +
          (r.heroSamples.length ? `\n      hero: ${r.heroSamples.slice(0, 2).map((h) => `"${h}"`).join(" | ")}` : "") +
          (r.validationErrors.length ? `\n      errors: ${r.validationErrors.slice(0, 3).join(" | ")}` : ""),
      );
    }
  }
  lines.push(
    "",
    "─".repeat(78),
    "BASIS CHANGES vs the §2.1 baseline — read before comparing any number",
    "─".repeat(78),
    "  · distinctSlotKinds: NOT comparable (B2 — `actions` left the slot vocabulary).",
    "  · fabricated handles: no longer measurable (D7 — the model supplies row ids, not handles).",
    "  · hero: v0 measured a free-text field; this measures a TYPED deliverable (D6).",
    "  · retrieval: shipped executeCorpusSearch with row ids, not the v0 hand-rolled wrapper.",
    "  Comparable: emitted-a-card, schema-valid, searched-corpus, avg prose chars.",
    `  Recipes in the shipped registry: ${Object.keys(RECIPES).join(", ")}`,
  );
  const report = lines.join("\n");
  writeFileSync(resolve(OUT_DIR, "slot-composer-report.txt"), report);
  console.log(report);
  console.log(`\nfull trees → ${resolve(OUT_DIR, "slot-composer-results.json")}`);
}

main().catch((e) => {
  console.error("SPIKE FAILED:", e);
  process.exit(1);
});
