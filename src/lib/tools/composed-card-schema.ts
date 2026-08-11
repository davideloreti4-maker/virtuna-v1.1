/**
 * composed-card-schema.ts — THE RECIPE IS THE SCHEMA.
 *
 * `docs/subsystems/ui-skill-cards.md` §0.6 marks 5 of 16 hand-built cards 🔴 STRUCTURAL and states
 * the cause: "cards drifted precisely because each was built alone with nothing to conform to."
 * A composer fixes that by construction: the model picks slots, and a recipe decides which slots
 * are legal and what the payoff must BE (D6) — so a card cannot be malformed and still render.
 *
 * Lives outside blocks.ts on purpose (blocks.ts:28 records the 500-line limit that split
 * profile-blocks.ts out; blocks.ts is already 1074 lines).
 */
import { z } from "zod";
import {
  SKILL_REQUESTABLE_ACTIONS,
  isSkillInputAction,
  type SkillInputAction,
} from "@/lib/tools/skill-capabilities";
import { HookProofSchema } from "@/lib/tools/proof-schema";

/**
 * CLOSED ENUM (spec §4.2, B3). Nothing that spends a credit is model-authored — the model may only
 * name a forward-chain step that already exists, and only ever the KEY: the label and copy come
 * from SKILL_CAPABILITIES, exactly as `request_input` does ("the model only chooses WHICH action").
 *
 * DERIVED, never hardcoded. SKILL_REQUESTABLE_ACTIONS is SKILL_INPUT_ACTIONS filtered by
 * HORIZONTAL_ENABLED (false today), so `predict` and `profile` are excluded automatically and a
 * card cannot offer a skill the product has deliberately shut. Writing the five out by hand is
 * exactly the "second list to remember" that module's header warns against.
 */
export const ACTION_IDS = SKILL_REQUESTABLE_ACTIONS;
export type ActionId = SkillInputAction;

/**
 * `z.enum` needs a literal tuple and ACTION_IDS is a runtime-filtered array, so the membership
 * test is a refinement. It checks BOTH halves: a known action (isSkillInputAction) that is also
 * currently offerable (ACTION_IDS) — so `predict`/`profile` fail while HORIZONTAL_ENABLED is false.
 */
const ActionIdSchema = z.custom<ActionId>(
  (v) => isSkillInputAction(v) && (ACTION_IDS as readonly ActionId[]).includes(v),
  { message: "unknown or currently unavailable action" },
);

/** The 10-slot vocabulary (spec §4.2). `actions` is a CARD FIELD, not a slot — see B2. */
export const SlotSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("proof_strip"),
    /** Teardown row ids ONLY. The server materializes handle + numbers (D7). */
    receiptRefs: z.array(z.string().min(1)).min(1).max(4),
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
]);
export type Slot = z.infer<typeof SlotSchema>;
export type SlotKind = Slot["kind"];

/** D6 — the payoff is TYPED. A `line` is a usable sentence; a `name` is a label. */
export const DeliverableSchema = z.object({
  kind: z.enum(["line", "claim", "name"]),
  text: z.string().min(1),
});

export const ComposedCardBlockSchema = z.object({
  type: z.literal("composed-card"),
  props: z.object({
    recipe: z.enum(["hook-set", "format-set", "angle-set", "idea-set", "script", "comparison", "teardown", "brief"]),
    eyebrow: z.string().optional(),
    deliverable: DeliverableSchema,
    /** A teardown row id — the server materializes the numbers (D7). */
    receiptRef: z.string().min(1).optional(),
    why: z.string().optional(),
    body: z.array(SlotSchema).min(1).max(8),
    /** The contract's ONE disclosure (§0.5 row 6). */
    disclosure: z.array(SlotSchema).max(4).optional(),
    actions: z.array(ActionIdSchema).min(1).max(3).optional(),
    /**
     * Server-materialized receipts, keyed by the teardown row id the model named in `receiptRef` or
     * in a `proof_strip`. Written ONLY by the emit boundary, from `materializeReceipts` (D7).
     *
     * ⚠️ DECLARED HERE FOR A REASON THAT IS EASY TO UNDO. `message-blocks.tsx` re-runs
     * `validateBlock` on every render (D-14), and that is a zod object parse — zod STRIPS undeclared
     * keys. A receipt attached to `props` after validation therefore did not survive the first
     * rehydration: it was silently deleted, and a `teardown` — the one recipe that REQUIRES a
     * `proof_strip` — rendered asserting evidence it never displayed. Removing this field restores
     * that bug, and restores it *silently*, which is why the round-trip is pinned by a test that
     * goes through `validateBlock` rather than straight into the renderer.
     *
     * A `Record`, never a `Map`: block props are persisted to `messages.body` as JSON and a `Map`
     * serializes to `{}`.
     *
     * ⚠️ A DECLARED FIELD IS A FIELD THE MODEL CAN FILL. This schema is also the REHYDRATION
     * validator, so it must accept a receipt — meaning it cannot be the thing that keeps the model
     * out. `parseComposedCard` is the model-facing door and it deletes this unconditionally. Any
     * future path that takes model output MUST go through `parseComposedCard`; validating model
     * output with `ComposedCardBlockSchema` alone hands the model exactly the receipt-authoring
     * power D7 exists to remove.
     */
    receipts: z.record(z.string(), HookProofSchema).optional(),
  }),
});
export type ComposedCardBlock = z.infer<typeof ComposedCardBlockSchema>;
export type RecipeId = ComposedCardBlock["props"]["recipe"];

export interface Recipe {
  /** What this recipe's payoff must BE. */
  deliverable: "line" | "claim" | "name";
  /** Slot kinds this recipe may use — in `body` AND in `disclosure` alike. */
  legalSlots: SlotKind[];
  /** Slot kinds it MUST have, in the VISIBLE body. A required slot in a drawer is not shown. */
  requiredSlots: SlotKind[];
  /**
   * How many cards this recipe emits (spec §4.2: "each declares its … card count").
   * Enforced at the emit boundary in emit-card-tool.ts — the only place that sees the whole
   * array — but DECLARED here, because the recipe is the schema.
   *
   * ⚠️ `max` is a CEILING; `min` is 1 everywhere and must stay 1. The failure worth stopping is a
   * model emitting twenty cards, never one. A floor only rejects asks creators really make: prod
   * `messages` holds "just one example hook, doesn't have to be good" 14 times, alongside "give me
   * 3 good hooks" and "one quick hook tip". §4.2's "3–5 cards" describes the TYPICAL shape of a
   * hook-set — read as a floor it makes the product refuse the single-hook ask outright.
   * Do not restore a floor on a re-reading of the §4.2 table.
   */
  cardCount: { min: number; max: number };
}

/** Spec §4.2's registry. Each recipe declares its deliverable kind, legal slots, requirements and count. */
export const RECIPES: Record<RecipeId, Recipe> = {
  // Ceilings: 5 is §4.2's own stated shape for hook-set. The `-set` recipes carry the spike's
  // measured ceiling (`cards: 1..6`, spike-slot-composer.ts:117) because a set is the point —
  // §1 goal 2's motivating ask is literally "3 viral formats for young startup founders".
  "hook-set":   { deliverable: "line",  legalSlots: ["proof_strip", "note", "chips"], requiredSlots: [], cardCount: { min: 1, max: 5 } },
  "format-set": { deliverable: "claim", legalSlots: ["proof_strip", "beats", "note", "chips"], requiredSlots: ["beats"], cardCount: { min: 1, max: 6 } },
  "angle-set":  { deliverable: "claim", legalSlots: ["beats", "bullets", "note"], requiredSlots: ["beats"], cardCount: { min: 1, max: 6 } },
  "idea-set":   { deliverable: "claim", legalSlots: ["beats", "bullets", "note"], requiredSlots: ["beats"], cardCount: { min: 1, max: 6 } },
  // The single-deliverable recipes stay at exactly one card — the spike's own case list says so
  // ("one card with a script_timeline" / "one card with a comparison slot" / "one card,
  // proof_strip + beats"), and `comparison` carries its multiplicity in COLUMNS, not in cards.
  script:       { deliverable: "claim", legalSlots: ["script_timeline", "note", "label_values"], requiredSlots: ["script_timeline"], cardCount: { min: 1, max: 1 } },
  // G3, considered and left alone: §4.2's shape column reads "comparison + bullets", the code
  // requires only `comparison`. Requiring both would reject a legitimate two-column comparison
  // that carries no extra points. Deliberate, not an oversight.
  comparison:   { deliverable: "claim", legalSlots: ["comparison", "bullets", "note"], requiredSlots: ["comparison"], cardCount: { min: 1, max: 1 } },
  teardown:     { deliverable: "claim", legalSlots: ["proof_strip", "beats", "quote", "note"], requiredSlots: ["proof_strip", "beats"], cardCount: { min: 1, max: 1 } },
  brief:        { deliverable: "claim", legalSlots: ["bullets", "label_values", "beats", "stat_row", "quote", "chips", "note"], requiredSlots: [], cardCount: { min: 1, max: 1 } },
};

/**
 * Arg repair (§4.2): a `body`/`disclosure` arriving as a JSON string is re-parsed ONCE. The spike
 * measured flash double-encoding an array exactly this way (§2.1 failure 2).
 */
function repairArrayField(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

export function parseComposedCard(
  raw: unknown,
): { ok: true; block: ComposedCardBlock } | { ok: false; reason: string } {
  const asRecord = raw as { props?: Record<string, unknown> } | null;

  let candidate: unknown = raw;
  if (asRecord && typeof asRecord === "object" && asRecord.props) {
    // A FRESH props object. Never reach into the caller's argument: the emit boundary still holds
    // the raw tool args and may log them, and a log that disagrees with what the model actually
    // sent is worse than no log.
    const props: Record<string, unknown> = { ...asRecord.props };
    props.body = repairArrayField(props.body);
    props.disclosure = repairArrayField(props.disclosure);

    // D7 — THE MODEL MAY NEVER AUTHOR A RECEIPT. `props.receipts` exists for the SERVER to fill
    // after validation, so whatever the model put there is discarded unconditionally, before the
    // parse and without inspecting it: a hallucinated receipt that happens to be well-formed is the
    // dangerous one, and nothing in the payload distinguishes it from a real row. Provenance is the
    // only usable test, so the answer cannot depend on the value.
    //
    // Dropped, not rejected: a fabricated receipt should cost the model a retry, not cost the
    // creator the card — the rest of which is still what they asked for. The card then renders with
    // no proof, which is the honest outcome, and the emit boundary attaches the real receipts next.
    delete props.receipts;

    candidate = { ...asRecord, props };
  }

  const parsed = ComposedCardBlockSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "invalid shape" };

  const block = parsed.data;
  const recipe = RECIPES[block.props.recipe];

  if (block.props.deliverable.kind !== recipe.deliverable) {
    return {
      ok: false,
      reason: `recipe "${block.props.recipe}" requires a ${recipe.deliverable} deliverable, got ${block.props.deliverable.kind}`,
    };
  }

  // Required slots must be in the VISIBLE body — satisfying `proof_strip` from inside a collapsed
  // drawer would let a card claim proof the reader never sees.
  const kinds = new Set(block.props.body.map((s) => s.kind));
  for (const required of recipe.requiredSlots) {
    if (!kinds.has(required)) {
      return { ok: false, reason: `recipe "${block.props.recipe}" requires a ${required} slot` };
    }
  }
  // Legality covers `disclosure` too (G2). The contract's §0.5 row 6 says *where* a second labelled
  // section goes — into the drawer — not that it escapes the recipe's vocabulary. A drawer that may
  // hold any slot is the unconstrained card the composer exists to prevent; if a recipe genuinely
  // needs a kind in its disclosure, widen its legalSlots here, where the decision is reviewable.
  for (const slot of [...block.props.body, ...(block.props.disclosure ?? [])]) {
    if (!recipe.legalSlots.includes(slot.kind)) {
      return { ok: false, reason: `recipe "${block.props.recipe}" does not allow a ${slot.kind} slot` };
    }
  }

  return { ok: true, block };
}
