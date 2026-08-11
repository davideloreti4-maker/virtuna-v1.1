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
  }),
});
export type ComposedCardBlock = z.infer<typeof ComposedCardBlockSchema>;
export type RecipeId = ComposedCardBlock["props"]["recipe"];

export interface Recipe {
  /** What this recipe's payoff must BE. */
  deliverable: "line" | "claim" | "name";
  /** Slot kinds this recipe may use. */
  legalSlots: SlotKind[];
  /** Slot kinds it MUST have. */
  requiredSlots: SlotKind[];
}

/** Spec §4.2's registry. Each recipe declares its deliverable kind, legal slots and requirements. */
export const RECIPES: Record<RecipeId, Recipe> = {
  "hook-set":   { deliverable: "line",  legalSlots: ["proof_strip", "note", "chips"], requiredSlots: [] },
  "format-set": { deliverable: "claim", legalSlots: ["proof_strip", "beats", "note", "chips"], requiredSlots: ["beats"] },
  "angle-set":  { deliverable: "claim", legalSlots: ["beats", "bullets", "note"], requiredSlots: ["beats"] },
  "idea-set":   { deliverable: "claim", legalSlots: ["beats", "bullets", "note"], requiredSlots: ["beats"] },
  script:       { deliverable: "claim", legalSlots: ["script_timeline", "note", "label_values"], requiredSlots: ["script_timeline"] },
  comparison:   { deliverable: "claim", legalSlots: ["comparison", "bullets", "note"], requiredSlots: ["comparison"] },
  teardown:     { deliverable: "claim", legalSlots: ["proof_strip", "beats", "quote", "note"], requiredSlots: ["proof_strip", "beats"] },
  brief:        { deliverable: "claim", legalSlots: ["bullets", "label_values", "beats", "stat_row", "quote", "chips", "note"], requiredSlots: [] },
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
  const repaired =
    asRecord && typeof asRecord === "object" && asRecord.props
      ? {
          ...asRecord,
          props: {
            ...asRecord.props,
            body: repairArrayField(asRecord.props.body),
            disclosure: repairArrayField(asRecord.props.disclosure),
          },
        }
      : raw;

  const parsed = ComposedCardBlockSchema.safeParse(repaired);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "invalid shape" };

  const block = parsed.data;
  const recipe = RECIPES[block.props.recipe];

  if (block.props.deliverable.kind !== recipe.deliverable) {
    return {
      ok: false,
      reason: `recipe "${block.props.recipe}" requires a ${recipe.deliverable} deliverable, got ${block.props.deliverable.kind}`,
    };
  }

  const kinds = new Set(block.props.body.map((s) => s.kind));
  for (const required of recipe.requiredSlots) {
    if (!kinds.has(required)) {
      return { ok: false, reason: `recipe "${block.props.recipe}" requires a ${required} slot` };
    }
  }
  for (const slot of block.props.body) {
    if (!recipe.legalSlots.includes(slot.kind)) {
      return { ok: false, reason: `recipe "${block.props.recipe}" does not allow a ${slot.kind} slot` };
    }
  }

  return { ok: true, block };
}
