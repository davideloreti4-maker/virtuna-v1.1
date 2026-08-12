/**
 * emit-card-tool.ts — the model-facing door to `composed-card`, and the ONLY writer of
 * `props.receipts`.
 *
 * A FREE tool, deliberately. It follows `search_corpus` (corpus-tool.ts), not `SkillTool`:
 * `emit_card` renders an answer the model has already thought of — it spends nothing, runs no
 * generator, and must never be registered in the skills array or reach the credit gate.
 *
 * Two things happen here that can happen nowhere else:
 *
 *  1. **The `cards` array is repaired.** `parseComposedCard` repairs `body`/`disclosure` *inside*
 *     one card; nothing repairs the array that holds them. The composition spike measured flash
 *     sending `cards` as a JSON **string** (spec §2.1 failure 2) — this boundary is the only code
 *     that ever sees that value, so the one double-encode actually observed is repaired here or
 *     not at all.
 *  2. **Receipts are attached.** The model names a teardown row id; `materializeReceipts` turns it
 *     into a real `HookProof` (D7). Attached AFTER validation, because `parseComposedCard` deletes
 *     any model-supplied `receipts` unconditionally — that deletion is the security property, and
 *     writing the server's receipts before it would throw them away.
 *
 * Degrade rule (spec §5): *"model emits an invalid tree → one repair attempt, then degrade to prose
 * (never a broken card)."* Invalid input returns **no blocks and an error**; the caller relays the
 * error and the model retries once or answers in prose. It never returns a partial card.
 */
import {
  ACTION_IDS,
  RECIPES,
  parseComposedCard,
  type ComposedCardBlock,
  type RecipeId,
  type Slot,
  type SlotKind,
} from "@/lib/tools/composed-card-schema";
import { materializeReceipts } from "@/lib/tools/composed-card-receipt";
import type { HookProof } from "@/lib/tools/proof-schema";

/**
 * One line per slot kind, as the model reads it. A `Record<SlotKind, …>` on purpose: add a kind to
 * `SlotSchema` and this fails to compile until it is documented, so the tool description cannot
 * silently fall behind the schema it describes.
 *
 * `actions` is absent because it is a CARD FIELD, not a slot (B2). The spike's 11th slot kind was
 * promoted to a top-level field by spec §4.2 and must not come back through this door.
 */
const SLOT_DOC: Record<SlotKind, string> = {
  proof_strip:
    "real outlier videos that prove this, as tiles (needs `receiptRefs`: teardown ROW IDS from search_corpus).",
  beats: "the structural moments of a format (needs `items` of {label,text}, 2-6).",
  stat_row: "1-4 headline numbers (needs `stats` of {value,label}).",
  bullets: "short unordered points (needs `items`, 1-6 strings).",
  quote: "one verbatim line (needs `text`; optional `attribution`).",
  label_values: "a compact spec table (needs `rows` of {label,value}).",
  script_timeline: "timed script beats (needs `lines` of {t,text}, 2-12).",
  comparison: "2-3 columns side by side (needs `columns` of {title,points}).",
  chips: "short tags (needs `items`, 1-8 strings).",
  note: "one line of small print or a caveat (needs `text`).",
};

const SLOT_KINDS = Object.keys(SLOT_DOC) as SlotKind[];
const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];

/**
 * The recipe menu, generated from `RECIPES`. Written by hand it would be a second list to
 * remember — the exact failure B3 rejected for `ActionId` — and it would drift the first time a
 * recipe's legal slots changed.
 */
function recipeMenu(): string {
  return RECIPE_IDS.map((id) => {
    const r = RECIPES[id];
    const requires = r.requiredSlots.length > 0 ? `must include ${r.requiredSlots.join(" + ")}` : "no required slot";
    const count = r.cardCount.max > 1 ? `up to ${r.cardCount.max} cards` : "exactly 1 card";
    return `• ${id} — deliverable is a ${r.deliverable}; slots: ${r.legalSlots.join(", ")}; ${requires}; ${count}.`;
  }).join(" ");
}

/** OpenAI/DashScope tool schema. Handed to `chat.completions.create({ tools: [EMIT_CARD_TOOL] })`. */
export const EMIT_CARD_TOOL = {
  type: "function" as const,
  function: {
    name: "emit_card",
    description:
      "Render your answer as CARDS in the creator's thread instead of writing it as prose. Prefer a " +
      "card whenever the answer has structure (hooks, formats, angles, ideas, a script, a comparison, " +
      "a teardown, a brief). Pick ONE recipe and compose the card from the slots that recipe allows — " +
      "the recipe decides what the payoff must be and which slots are legal, and a card that breaks it " +
      "is rejected rather than shown. `deliverable` is the one thing the creator takes away: a `line` " +
      "is a usable sentence they can post, a `claim` is an assertion, a `name` is a label. " +
      "All cards in one call must use the SAME recipe. " +
      "RECIPES: " +
      recipeMenu() +
      " SLOTS: " +
      SLOT_KINDS.map((k) => `${k}: ${SLOT_DOC[k]}`).join(" ") +
      " Put a second labelled section in `disclosure` (the drawer) — it obeys the same recipe " +
      "vocabulary. Never write a number, a view count or a multiplier yourself: name the row and the " +
      "server fills in the real figures. " +
      "Use `proof_strip` ONLY with teardown row ids that search_corpus actually returned — never " +
      "invent one, and never write a creator handle yourself.",
    parameters: {
      type: "object",
      properties: {
        cards: {
          type: "array",
          minItems: 1,
          maxItems: Math.max(...RECIPE_IDS.map((id) => RECIPES[id].cardCount.max)),
          description: "One or more cards, all using the same recipe.",
          items: {
            type: "object",
            properties: {
              recipe: {
                type: "string",
                enum: RECIPE_IDS,
                description: "Which recipe this card follows. Decides the legal slots and the deliverable kind.",
              },
              eyebrow: { type: "string", description: "Quiet uppercase kicker, e.g. 'FORMAT · 1 of 3'." },
              deliverable: {
                type: "object",
                description: "The ONE thing the creator takes away. Required.",
                properties: {
                  kind: { type: "string", enum: ["line", "claim", "name"] },
                  text: { type: "string" },
                },
                required: ["kind", "text"],
              },
              receiptRef: {
                type: "string",
                description:
                  "A teardown ROW ID from search_corpus that this whole card rests on. The server " +
                  "materializes the handle and the numbers — never write them yourself.",
              },
              why: { type: "string", description: "One line on why this works. Optional." },
              body: {
                type: "array",
                minItems: 1,
                maxItems: 8,
                description: "The card body. Compose it from the slots this recipe allows.",
                items: {
                  type: "object",
                  properties: {
                    kind: { type: "string", enum: SLOT_KINDS, description: SLOT_KINDS.map((k) => `${k}: ${SLOT_DOC[k]}`).join(" ") },
                    receiptRefs: { type: "array", items: { type: "string" }, description: "proof_strip: teardown row ids, 1-4." },
                    // Untyped on purpose: `items` is a string list for bullets/chips and an
                    // object list for beats. A JSON-schema union here is worse understood by the
                    // model than no constraint — the zod parse is the real gate either way.
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
                        properties: {
                          title: { type: "string" },
                          points: { type: "array", items: { type: "string" } },
                        },
                        required: ["title", "points"],
                      },
                    },
                    text: { type: "string", description: "quote / note: the line itself." },
                    attribution: { type: "string", description: "quote: who said it. Optional." },
                  },
                  required: ["kind"],
                },
              },
              disclosure: {
                type: "array",
                maxItems: 4,
                description: "A second labelled section, shown in a drawer. Same slot vocabulary as the body.",
                items: { type: "object", properties: { kind: { type: "string", enum: SLOT_KINDS } }, required: ["kind"] },
              },
              actions: {
                type: "array",
                maxItems: 3,
                description:
                  "Next steps to offer at the foot of the card. You choose WHICH — the button's label " +
                  "and copy come from the product, never from you.",
                items: { type: "string", enum: [...ACTION_IDS] },
              },
            },
            required: ["recipe", "deliverable", "body"],
          },
        },
      },
      required: ["cards"],
    },
  },
};

export interface EmitCardResult {
  /** Validated, receipt-bearing blocks. Empty whenever `error` is set — never a partial set. */
  blocks: ComposedCardBlock[];
  /** A sentence the model can act on: what was wrong, in its own vocabulary. */
  error?: string;
}

/**
 * G3 — the `cards` array itself, re-parsed once when it arrives double-encoded. Mirrors
 * `repairArrayField` in composed-card-schema.ts, one level up, because the model can double-encode
 * at either level and the spike measured this one.
 */
function repairCardsArray(value: unknown): unknown {
  if (!Array.isArray(value) && typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through — the shape guard below reports it */
    }
  }
  return value;
}

function readRecipe(card: unknown): string | undefined {
  if (!card || typeof card !== "object") return undefined;
  const value = (card as { recipe?: unknown }).recipe;
  return typeof value === "string" ? value : undefined;
}

function isRecipeId(value: string | undefined): value is RecipeId {
  return value !== undefined && Object.prototype.hasOwnProperty.call(RECIPES, value);
}

/** Every teardown row id a validated card refers to — the card-level ref plus every proof_strip. */
function receiptRefsOf(block: ComposedCardBlock): string[] {
  const slots: Slot[] = [...block.props.body, ...(block.props.disclosure ?? [])];
  const fromStrips = slots.flatMap((slot) => (slot.kind === "proof_strip" ? slot.receiptRefs : []));
  return block.props.receiptRef ? [block.props.receiptRef, ...fromStrips] : fromStrips;
}

/**
 * Validate a model `emit_card` call and return renderable blocks.
 *
 * All-or-nothing by design. A set is one answer — three hooks where the creator asked for three —
 * so emitting the two that parsed would silently hand over a different, smaller answer than the
 * model composed, with no way for the creator to know. Returning the error instead costs one round
 * and keeps §5's promise: never a broken card.
 */
export async function handleEmitCard(
  rawArgs: unknown,
  deps: { materialize?: typeof materializeReceipts } = {},
): Promise<EmitCardResult> {
  const materialize = deps.materialize ?? materializeReceipts;

  const cards = repairCardsArray((rawArgs as { cards?: unknown } | null | undefined)?.cards);
  if (!Array.isArray(cards) || cards.length === 0) {
    return { blocks: [], error: "emit_card needs a non-empty `cards` array" };
  }

  const recipe = readRecipe(cards[0]);
  if (!isRecipeId(recipe)) {
    return { blocks: [], error: `unknown recipe "${recipe ?? "(missing)"}" — choose one of: ${RECIPE_IDS.join(", ")}` };
  }
  if (cards.some((card) => readRecipe(card) !== recipe)) {
    return { blocks: [], error: "every card in one emit_card call must use the same recipe" };
  }

  // A CEILING, never a floor (see Recipe.cardCount): this stops a model emitting twenty cards and
  // must never stop a creator asking for one.
  const { max } = RECIPES[recipe].cardCount;
  if (cards.length > max) {
    return {
      blocks: [],
      error: `recipe "${recipe}" renders at most ${max} card(s) per call — you sent ${cards.length}`,
    };
  }

  const blocks: ComposedCardBlock[] = [];
  for (const card of cards) {
    const parsed = parseComposedCard({ type: "composed-card", props: card });
    if (!parsed.ok) return { blocks: [], error: parsed.reason };
    blocks.push(parsed.block);
  }

  // D7 — one round-trip for the whole call, then attach. `materializeReceipts` already de-dupes,
  // and an id that does not resolve is simply absent: the card renders without that receipt rather
  // than with a placeholder.
  const refs = Array.from(new Set(blocks.flatMap(receiptRefsOf)));
  if (refs.length > 0) {
    const resolved = await materialize(refs);
    for (const block of blocks) {
      const receipts: Record<string, HookProof> = {};
      for (const id of receiptRefsOf(block)) {
        const receipt = resolved.get(id);
        if (receipt) receipts[id] = receipt;
      }
      // Left undefined when nothing resolved, so a card never carries an empty receipts object
      // that reads, to every later consumer, as "we looked and found none" rather than "no refs".
      if (Object.keys(receipts).length > 0) block.props.receipts = receipts;
    }
  }

  return { blocks };
}
