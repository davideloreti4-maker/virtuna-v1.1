/**
 * spike-slot-composer.ts — can the model COMPOSE a card, not just call a tool?
 *
 * THE QUESTION. The proposed architecture replaces "one bespoke React block per output type" with a
 * single `composed-card` block whose props are a validated SLOT TREE. The model picks which slots, in
 * what order, with what content; the design system owns every pixel; `actions` is a closed enum so
 * nothing that spends a credit is ever model-authored.
 *
 * That architecture is only as good as the model's ability to compose. `corpus-tool.ts` carries an
 * explicit warning that its tool-calling-initiative claim was measured on qwen3.7-PLUS and that the
 * platform moved to qwen3.7-FLASH on 2026-08-04 with nothing re-validating it. Composing a 6-slot tree
 * is strictly harder than picking one tool. So: measure both, on the real corpus, before specing.
 *
 * WHAT IS REAL HERE: real DashScope, real pgvector retrieval over the real 532-row corpus, real
 * multi-round tool loop. The ONLY mock is that `emit_card` renders nothing — we capture the tree and
 * validate it instead.
 *
 * INSTRUMENTS, per case × model:
 *   · did it call emit_card at all, and how many cards did it emit?
 *   · does every card VALIDATE against the draft Zod schema? (the real write-boundary test)
 *   · slot vocabulary actually used — is the model reaching for variety or defaulting to bullets?
 *   · GROUNDING: every handle in a proof_strip is checked against the handles retrieval ACTUALLY
 *     returned. A fabricated handle is the failure that matters most — it is a fake receipt.
 *   · did it invent an action outside the enum? (schema should reject; recorded either way)
 *
 * Run (FOREGROUND, sandbox OFF — rtk silently drops DashScope/Supabase network):
 *   node node_modules/.bin/tsx scripts/spike-slot-composer.ts
 * Needs .env.local: DASHSCOPE_API_KEY + SUPABASE_SERVICE_ROLE_KEY (+ URL).
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { register } from "tsconfig-paths";
import { z } from "zod";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { getQwenClient, QWEN_SEED } = require("@/lib/engine/qwen/client");
const { retrieveCachedExamples } = require("@/lib/grounding/retrieve");

const PLATFORM = "tiktok";
const MAX_ROUNDS = 6;
const ROWS_RETURNED = 6;
const MODELS = ["qwen3.7-flash", "qwen3.7-plus"] as const;

const OUT_DIR = resolve(__dirname, "../.spike-out");

// ─── The draft slot vocabulary (v0 — this is the thing under test) ───────────
// Deliberately ~11 kinds. Fewer and the model cannot express variety; more and it will not learn the
// vocabulary from one description. `actions` is a CLOSED ENUM on purpose — see the module header.

const ACTIONS = [
  "make_mine",
  "write_script",
  "generate_hooks",
  "test_with_audience",
  "see_proof",
  "refine",
] as const;

const SlotSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("proof_strip"),
    clips: z
      .array(
        z.object({
          handle: z.string().min(1),
          multiplier: z.number().optional(),
          baselineLabel: z.string().optional(),
          note: z.string().optional(),
        }),
      )
      .min(1)
      .max(4),
  }),
  z.object({
    kind: z.literal("beats"),
    items: z.array(z.object({ label: z.string().min(1), text: z.string().min(1) })).min(2).max(6),
  }),
  z.object({
    kind: z.literal("stat_row"),
    stats: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) })).min(1).max(4),
  }),
  z.object({ kind: z.literal("bullets"), items: z.array(z.string().min(1)).min(1).max(6) }),
  z.object({ kind: z.literal("quote"), text: z.string().min(1), attribution: z.string().optional() }),
  z.object({
    kind: z.literal("label_values"),
    rows: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).min(1).max(6),
  }),
  z.object({
    kind: z.literal("script_timeline"),
    lines: z.array(z.object({ t: z.string().min(1), text: z.string().min(1) })).min(2).max(12),
  }),
  z.object({
    kind: z.literal("comparison"),
    columns: z
      .array(z.object({ title: z.string().min(1), points: z.array(z.string().min(1)).min(1).max(5) }))
      .min(2)
      .max(3),
  }),
  z.object({ kind: z.literal("chips"), items: z.array(z.string().min(1)).min(1).max(8) }),
  z.object({ kind: z.literal("note"), text: z.string().min(1) }),
  z.object({ kind: z.literal("actions"), actions: z.array(z.enum(ACTIONS)).min(1).max(3) }),
]);

const CardSchema = z.object({
  eyebrow: z.string().optional(),
  hero: z.string().min(1),
  subtitle: z.string().optional(),
  slots: z.array(SlotSchema).min(1).max(8),
});

const EmitArgsSchema = z.object({ cards: z.array(CardSchema).min(1).max(6) });

// ─── The emit_card tool, as the model sees it ────────────────────────────────

const EMIT_CARD_TOOL = {
  type: "function",
  function: {
    name: "emit_card",
    description:
      "Render your answer as CARDS in the creator's thread instead of writing it as prose. Each card " +
      "is composed from SLOTS you choose — pick the slots that actually fit what you are showing, in " +
      "the order they should be read. A card is not a paragraph: `hero` is the one line the creator " +
      "takes away, and each slot carries one kind of information. Prefer a card over prose whenever " +
      "the answer has structure (formats, hooks, angles, a script, a comparison, a teardown). " +
      "Use `proof_strip` ONLY with handles that search_corpus actually returned — never invent one.",
    parameters: {
      type: "object",
      properties: {
        cards: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              eyebrow: { type: "string", description: "Quiet uppercase kicker, e.g. 'FORMAT · 1 of 3'." },
              hero: { type: "string", description: "The ONE line the creator takes away. Required." },
              subtitle: { type: "string", description: "Optional single clarifying line under the hero." },
              slots: {
                type: "array",
                minItems: 1,
                maxItems: 8,
                description: "The card body, in reading order. Choose the kinds that fit.",
                items: {
                  type: "object",
                  properties: {
                    kind: {
                      type: "string",
                      enum: [
                        "proof_strip",
                        "beats",
                        "stat_row",
                        "bullets",
                        "quote",
                        "label_values",
                        "script_timeline",
                        "comparison",
                        "chips",
                        "note",
                        "actions",
                      ],
                      description:
                        "proof_strip: real videos that prove this, as playable tiles (needs `clips`). " +
                        "beats: the structural moments of a format (needs `items` of {label,text}). " +
                        "stat_row: 1-4 headline numbers (needs `stats` of {value,label}). " +
                        "bullets: short unordered points (needs `items`). " +
                        "quote: one verbatim line (needs `text`). " +
                        "label_values: a compact spec table (needs `rows` of {label,value}). " +
                        "script_timeline: timed script beats (needs `lines` of {t,text}). " +
                        "comparison: 2-3 columns side by side (needs `columns` of {title,points}). " +
                        "chips: short tags (needs `items`). " +
                        "note: one line of small print or a caveat (needs `text`). " +
                        "actions: the buttons at the foot of the card (needs `actions`).",
                    },
                    clips: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          handle: { type: "string" },
                          multiplier: { type: "number" },
                          baselineLabel: { type: "string" },
                          note: { type: "string" },
                        },
                        required: ["handle"],
                      },
                    },
                    items: { type: "array", items: {} },
                    stats: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { value: { type: "string" }, label: { type: "string" } },
                        required: ["value", "label"],
                      },
                    },
                    rows: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { label: { type: "string" }, value: { type: "string" } },
                        required: ["label", "value"],
                      },
                    },
                    lines: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { t: { type: "string" }, text: { type: "string" } },
                        required: ["t", "text"],
                      },
                    },
                    columns: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { title: { type: "string" }, points: { type: "array", items: { type: "string" } } },
                        required: ["title", "points"],
                      },
                    },
                    text: { type: "string" },
                    attribution: { type: "string" },
                    actions: {
                      type: "array",
                      items: { type: "string", enum: [...ACTIONS] },
                      description: "Buttons. ONLY these values — never invent an action.",
                    },
                  },
                  required: ["kind"],
                },
              },
            },
            required: ["hero", "slots"],
          },
        },
      },
      required: ["cards"],
    },
  },
} as const;

// ─── search_corpus: the REAL retrieval primitive, thinly wrapped ─────────────

const SEARCH_TOOL = {
  type: "function",
  function: {
    name: "search_corpus",
    description:
      "Search a curated library of decoded high-performing short videos. Returns real creators, real " +
      "view multipliers, and the decoded structure of each. Call it before claiming anything is proven.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "A topic, hook style, or narrative structure." },
        limit: { type: "integer", description: `1–${ROWS_RETURNED}.` },
      },
      required: ["query"],
    },
  },
} as const;

const SYSTEM = [
  "You are Maven, a strategist for short-form video creators.",
  "You have two tools: search_corpus (real evidence) and emit_card (how you SHOW your answer).",
  "Ground claims in search_corpus before calling anything proven.",
  "Then call emit_card to render the answer as cards. Keep your prose to ONE short line —",
  "the cards carry the answer, so never restate a card's contents in prose.",
].join(" ");

// ─── Cases: deliberately varied output SHAPES, not variations of one ask ─────

const CASES: Array<{ id: string; ask: string; wants: string }> = [
  {
    id: "formats",
    ask: "find me 3 viral video formats that went viral for young startup founders",
    wants: "3 cards, each a format with proof + structural beats",
  },
  {
    id: "hooks",
    ask: "give me 5 hooks for a video about raising my SaaS prices",
    wants: "hook cards — short, one line each",
  },
  {
    id: "angles",
    ask: "what angles could I take on 'I fired my best engineer'?",
    wants: "several angle cards, no proof necessarily",
  },
  {
    id: "ad",
    ask: "write me a 30 second ad script for a productivity app aimed at students",
    wants: "one card with a script_timeline",
  },
  {
    id: "compare",
    ask: "greenscreen vs talking head for explaining a technical product — which works better and why?",
    wants: "one card with a comparison slot",
  },
  {
    id: "teardown",
    ask: "what's the strongest way to open a personal failure story? show me the proof",
    wants: "one card, proof_strip + beats",
  },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

interface CaseResult {
  model: string;
  caseId: string;
  ask: string;
  rounds: number;
  searchCalls: number;
  searchQueries: string[];
  handlesReturned: string[];
  emitted: boolean;
  cardCount: number;
  valid: boolean;
  validationErrors: string[];
  slotKinds: string[];
  distinctSlotKinds: number;
  proofHandles: string[];
  fabricatedHandles: string[];
  badActions: string[];
  proseChars: number;
  cards: unknown;
  error?: string;
}

function collectSlotKinds(cards: unknown): string[] {
  const out: string[] = [];
  const list = Array.isArray((cards as { cards?: unknown[] })?.cards) ? (cards as { cards: unknown[] }).cards : [];
  for (const c of list) {
    const slots = (c as { slots?: unknown[] })?.slots;
    if (!Array.isArray(slots)) continue;
    for (const s of slots) {
      const k = (s as { kind?: unknown })?.kind;
      if (typeof k === "string") out.push(k);
    }
  }
  return out;
}

function collectProofHandles(cards: unknown): string[] {
  const out: string[] = [];
  const list = Array.isArray((cards as { cards?: unknown[] })?.cards) ? (cards as { cards: unknown[] }).cards : [];
  for (const c of list) {
    const slots = (c as { slots?: unknown[] })?.slots;
    if (!Array.isArray(slots)) continue;
    for (const s of slots) {
      if ((s as { kind?: unknown })?.kind !== "proof_strip") continue;
      const clips = (s as { clips?: unknown[] })?.clips;
      if (!Array.isArray(clips)) continue;
      for (const cl of clips) {
        const h = (cl as { handle?: unknown })?.handle;
        if (typeof h === "string") out.push(h);
      }
    }
  }
  return out;
}

function collectActions(cards: unknown): string[] {
  const out: string[] = [];
  const list = Array.isArray((cards as { cards?: unknown[] })?.cards) ? (cards as { cards: unknown[] }).cards : [];
  for (const c of list) {
    const slots = (c as { slots?: unknown[] })?.slots;
    if (!Array.isArray(slots)) continue;
    for (const s of slots) {
      if ((s as { kind?: unknown })?.kind !== "actions") continue;
      const acts = (s as { actions?: unknown[] })?.actions;
      if (!Array.isArray(acts)) continue;
      for (const a of acts) if (typeof a === "string") out.push(a);
    }
  }
  return out;
}

const norm = (h: string) => h.replace(/^@/, "").trim().toLowerCase();

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
    rounds: 0,
    searchCalls: 0,
    searchQueries: [],
    handlesReturned: [],
    emitted: false,
    cardCount: 0,
    valid: false,
    validationErrors: [],
    slotKinds: [],
    distinctSlotKinds: 0,
    proofHandles: [],
    fabricatedHandles: [],
    badActions: [],
    proseChars: 0,
    cards: null,
  };

  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      res.rounds = round;
      const completion = await client.chat.completions.create({
        model,
        messages,
        tools: [SEARCH_TOOL, EMIT_CARD_TOOL],
        tool_choice: "auto",
        temperature: 0.3,
        seed: QWEN_SEED,
        max_tokens: 3000,
        enable_thinking: false,
      });

      const msg = completion.choices?.[0]?.message;
      if (!msg) break;
      res.proseChars += (msg.content ?? "").length;
      messages.push(msg as Record<string, unknown>);

      const calls = msg.tool_calls ?? [];
      if (calls.length === 0) break;

      for (const call of calls) {
        const name = call.function?.name;
        const rawArgs = call.function?.arguments ?? "{}";

        if (name === "search_corpus") {
          res.searchCalls++;
          let q = "";
          let limit = ROWS_RETURNED;
          try {
            const p = JSON.parse(rawArgs);
            q = String(p.query ?? "");
            limit = Math.min(Number(p.limit) || ROWS_RETURNED, ROWS_RETURNED);
          } catch {
            /* malformed args — recorded by the empty query below */
          }
          res.searchQueries.push(q);
          let rows: Array<Record<string, unknown>> = [];
          try {
            // Real signature: (RetrieveInput, deps) → RetrieveResult. `skill: "hooks"` selects the
            // STRUCTURAL ranking axis — a spread of shapes rather than a subject match, which is what
            // a "what format works" ask actually wants (see RetrieveInput.skill).
            const rr = await retrieveCachedExamples({ query: q, platform: PLATFORM, skill: "hooks" });
            rows = (rr?.examples ?? []).slice(0, limit);
          } catch (e) {
            rows = [];
            res.validationErrors.push(`retrieval threw: ${e instanceof Error ? e.message : String(e)}`);
          }
          const returned = rows.map((r) => String(r.handle ?? "")).filter(Boolean);
          res.handlesReturned.push(...returned);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              count: rows.length,
              examples: rows.map((r) => ({
                handle: r.handle,
                multiplier: r.multiplier,
                baselineLabel: r.baselineLabel,
                hookTemplate: r.hookTemplate,
                spokenHook: r.spokenHook,
                format: r.format,
                hookArchetype: r.hookArchetype,
                visualSetting: r.visualSetting,
              })),
            }),
          });
          continue;
        }

        if (name === "emit_card") {
          res.emitted = true;
          let parsed: unknown = null;
          try {
            parsed = JSON.parse(rawArgs);
          } catch (e) {
            res.validationErrors.push(`emit_card args not JSON: ${e instanceof Error ? e.message : String(e)}`);
            messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "bad json" }) });
            continue;
          }
          res.cards = parsed;
          res.slotKinds = collectSlotKinds(parsed);
          res.distinctSlotKinds = new Set(res.slotKinds).size;
          res.proofHandles = collectProofHandles(parsed);
          const returnedSet = new Set(res.handlesReturned.map(norm));
          res.fabricatedHandles = res.proofHandles.filter((h) => !returnedSet.has(norm(h)));
          res.badActions = collectActions(parsed).filter((a) => !(ACTIONS as readonly string[]).includes(a));

          const check = EmitArgsSchema.safeParse(parsed);
          res.valid = check.success;
          res.cardCount = Array.isArray((parsed as { cards?: unknown[] })?.cards)
            ? (parsed as { cards: unknown[] }).cards.length
            : 0;
          if (!check.success) {
            res.validationErrors.push(
              ...check.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`),
            );
          }
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ rendered: res.cardCount, note: "cards are on screen" }),
          });
          continue;
        }

        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "unknown tool" }) });
      }

      if (res.emitted) {
        // One more round so the model can write its closing line, then stop.
        const closing = await client.chat.completions.create({
          model,
          messages,
          tools: [SEARCH_TOOL, EMIT_CARD_TOOL],
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

  for (const model of MODELS) {
    for (const c of CASES) {
      process.stdout.write(`▸ ${model.padEnd(14)} ${c.id.padEnd(10)} `);
      const r = await runCase(model, c);
      results.push(r);
      const verdict = r.error
        ? `ERROR ${r.error}`
        : !r.emitted
          ? "NO CARD (prose only)"
          : `${r.cardCount} card(s) · ${r.valid ? "VALID" : "INVALID"} · ${r.distinctSlotKinds} slot kinds` +
            ` · ${r.searchCalls} search` +
            (r.fabricatedHandles.length ? ` · ⚠ ${r.fabricatedHandles.length} FABRICATED` : "");
      process.stdout.write(`${verdict}\n`);
    }
  }

  writeFileSync(resolve(OUT_DIR, "slot-composer-results.json"), JSON.stringify(results, null, 2));

  // ── Report ────────────────────────────────────────────────────────────────
  const lines: string[] = ["", "═".repeat(78), "SLOT COMPOSER SPIKE", "═".repeat(78), ""];
  for (const model of MODELS) {
    const rs = results.filter((r) => r.model === model);
    const emitted = rs.filter((r) => r.emitted);
    const valid = rs.filter((r) => r.valid);
    const grounded = rs.filter((r) => r.proofHandles.length > 0);
    const fabricated = rs.filter((r) => r.fabricatedHandles.length > 0);
    const kinds = new Set(rs.flatMap((r) => r.slotKinds));
    lines.push(
      `${model}`,
      `  emitted a card      ${emitted.length}/${rs.length}`,
      `  schema-valid        ${valid.length}/${rs.length}`,
      `  used proof_strip    ${grounded.length}/${rs.length}`,
      `  FABRICATED handles  ${fabricated.length}/${rs.length}  ${fabricated.length ? "⚠️" : "✓"}`,
      `  searched corpus     ${rs.filter((r) => r.searchCalls > 0).length}/${rs.length}`,
      `  slot kinds used     ${[...kinds].sort().join(", ") || "(none)"}`,
      `  avg prose chars     ${Math.round(rs.reduce((a, r) => a + r.proseChars, 0) / rs.length)}`,
      "",
    );
  }
  lines.push("─".repeat(78), "PER CASE", "─".repeat(78));
  for (const c of CASES) {
    lines.push("", `${c.id} — "${c.ask}"`, `  wants: ${c.wants}`);
    for (const model of MODELS) {
      const r = results.find((x) => x.model === model && x.caseId === c.id);
      if (!r) continue;
      lines.push(
        `  ${model.padEnd(14)} ${r.emitted ? `${r.cardCount} card(s)` : "NO CARD"} · ` +
          `${r.valid ? "valid" : "INVALID"} · slots: ${[...new Set(r.slotKinds)].join("+") || "—"}` +
          (r.fabricatedHandles.length ? ` · ⚠ fabricated: ${r.fabricatedHandles.join(", ")}` : "") +
          (r.validationErrors.length ? `\n      errors: ${r.validationErrors.slice(0, 3).join(" | ")}` : ""),
      );
    }
  }
  const report = lines.join("\n");
  writeFileSync(resolve(OUT_DIR, "slot-composer-report.txt"), report);
  console.log(report);
  console.log(`\nfull trees → ${resolve(OUT_DIR, "slot-composer-results.json")}`);
}

main().catch((e) => {
  console.error("SPIKE FAILED:", e);
  process.exit(1);
});
