# Composed-card output layer (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace prose answers to open-ended creator asks with one composable block type, `composed-card`, whose slot tree the model composes and a recipe registry validates — so the card contract is unbreakable by construction instead of by discipline.

**Architecture:** A new zod module owns the slot vocabulary, the card shape and the recipe registry (the recipe *is* the schema). A server-side materializer turns a model-supplied teardown row id into a real `HookProof` — the model never authors a number or a handle. A renderer sorts slots into the card-contract spine and delegates each slot to a small component, reusing `card-primitives.tsx` rather than hand-rolling the eyebrow/hero/action bar. Registration follows the existing two-map pattern (`BLOCK_REGISTRY` + `BLOCK_COMPONENTS`).

**Tech Stack:** TypeScript, zod, React 19 / Next.js 15 (client components for renderers), Tailwind v4 with `@theme` tokens, vitest + `@testing-library/react`.

**Source spec:** `docs/superpowers/specs/2026-08-10-apify-first-composed-output-design.md` §4.2 (decisions D4, D6, D7, D8, D9).

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Card contract spine order (`docs/subsystems/ui-skill-cards.md` §0.5), verbatim:** eyebrow → hero → receipt → why-teaser → proof unit → **ONE** disclosure → **ONE** action bar. *"A card may omit a row it has no data for; it may not reorder them."*
- **D8 — the renderer sorts slots into spine order; model order is ignored.**
- **D6 — the card's payoff is a typed required field, not a free-text `hero`.**
- **D7 — receipts are materialized server-side from a row id; the model never authors numbers.**
- **D9 — never print a bare multiplier without its basis label.**
- **`actions` is a closed enum — nothing that spends a credit is model-authored.**
- **Accent dosage is LOCKED** (`CLAUDE.md`): monochrome by default, **at most one** accent element visible at a time, often zero. **Never** accent on buttons, chrome, charts, or "to make it pop." Primary actions are neutral cream via `<CardPrimaryAction>`.
- **Radius from the token scale only** — 4/6/8/12/16/20/24; cards 12, inputs/buttons 8. **Never `rounded-[Npx]`.** Guarded by `src/components/thread/__tests__/radius-scale.test.ts`.
- **Section labels use `SECTION_LABEL` from `card-primitives.tsx`** (`text-caption uppercase tracking-[0.05em] text-foreground-muted`). Guarded by `src/components/thread/__tests__/section-label-scale.test.ts`.
- **Text colors are cream tokens — never `#fff`.**
- **vitest:** `node node_modules/vitest/vitest.mjs run <path>` — npx output is swallowed here and a passing run reads as a failure.
- **`npx tsc --noEmit` before every commit.** vitest does not typecheck; a green Vercel check is not a build.
- **The post-commit hook AUTO-PUSHES.** Amending after it fires needs a force-push.
- **Trunk never holds a long-lived branch.** This is multi-session work → its own worktree + branch (`superpowers:using-git-worktrees`). A new worktree needs its own `npm install` and its own `.env.local`.
- **Merging does NOT deploy** — Git has been disconnected from Vercel since 2026-08-08.

---

## ✅ Blocking decisions — RESOLVED by the owner, 2026-08-11

**B1 — The printable band. RESOLVED: one threshold, one behaviour, both surfaces.**
The conflict was real on substance, not just numbers: spec D4 said *clamp at 50×* (*"keeps all 77 out-of-band rows usable as proof"*), while shipped `src/lib/discover/corpus-reads.ts:33` declares `EXTREME_MULTIPLIER = 100` and **excludes** those rows from the outliers feed (`corpus-reads.ts:215`, `.filter((t) => t.proven && !t.extreme)`) on the grounds that a thin-baseline ratio is not a signal a card may present as proof.

**Ruling: keep 100 as the threshold, change the behaviour to CLAMP.** A row above 100× prints `100×+` and enters the feed rather than vanishing from it. D4's `50×` is superseded.

Two consequences the tasks must carry:
- The constant moves to **`src/lib/grounding/outlier-gate.ts`**, beside `MIN_OUTLIER_MULTIPLIER = 3`. Floor and ceiling of the same band belong in one module, and both `corpus-reads.ts` and `composed-card-receipt.ts` import it. That is what makes "one rule" structural rather than a coincidence of two literals.
- **This changes a shipped surface** (the Discover feed) and is scope the Phase 2 spec did not ask for — it is the cost of the "one rule" choice. It gets **its own task (Task 9)** and its own review gate, landing after the new work is green.

⚠️ **Clamping the display does not make a thin baseline trustworthy.** `CorpusVideo.extreme` and `MultiplierChip`'s ⚠ + non-proven tone (`discover-primitives.tsx:78`) **stay as they are** — the row is shown, flagged, and still never rendered in proven green. Task 9 changes *which rows reach the feed* and *what number prints*, nothing about the honesty flag. If the owner wants the flag dropped too, that is a separate call.

**B2 — `actions`: slot kind or card field? RESOLVED: card field, per §4.2.**
`scripts/spike-slot-composer.ts:107` makes `actions` an 11th slot kind; §4.2 promotes it to a top-level field and states the vocabulary is 10. §4.2 is the later decision and wins. Consequence for Task 8: once the spike imports the shipped schema, its `distinctSlotKinds` figure is **not comparable** to the §2.1 baseline. Report the comparable dimensions and say plainly that slot-kind counts changed basis.

**B3 — The `ActionId` enum. RESOLVED: derive from `SKILL_REQUESTABLE_ACTIONS`.**
The spike's six ids (`make_mine`, `write_script`, …) would have been a **third** forward-chain mechanism alongside `chat-followups.ts` (chips: `{label, prompt, skill, carryCards}`) and `skill-capabilities.ts` (the deterministic-copy registry). Rejected for that reason.

The model names an action drawn from `SKILL_REQUESTABLE_ACTIONS` (`src/lib/tools/skill-capabilities.ts:164`); **label and copy come from `SKILL_CAPABILITIES`, never from the model** — the same rule `request_input` already follows (*"NO model-generated UI: the model only chooses WHICH action"*).

Why this specific list: it is `SKILL_INPUT_ACTIONS` filtered by `HORIZONTAL_ENABLED` (currently `false` — `src/lib/flags/horizontal.ts:34`), so `predict` and `profile` are excluded automatically and a card can never offer a skill the product has deliberately shut. Its own header states the reason: *"Flip HORIZONTAL_ENABLED and they return here automatically, with no second list to remember."* Today that leaves **`remix` · `account` · `explore` · `read` · `test`**. Do not hardcode those five — derive them, or the flag stops working.

---

## File Structure

**Create:**
- `src/lib/tools/composed-card-schema.ts` — slot vocabulary (10), card shape, recipe registry, `parseComposedCard` (validation + arg repair). Pure zod, no React, server-importable.
- `src/lib/tools/composed-card-receipt.ts` — `materializeReceipt(teardownId)`: row id → `HookProof | null`. The D7 seam.
- `src/components/thread/composed-card-slots.tsx` — one small component per slot kind.
- `src/components/thread/composed-card-block.tsx` — `ComposedCardRenderer`: spine ordering + primitives.
- `src/lib/tools/emit-card-tool.ts` — the model-facing tool definition + description copy.

**Modify:**
- `src/lib/tools/block-registry.ts:42-64` — add `"composed-card"` to `BLOCK_REGISTRY`.
- `src/components/thread/message-blocks.tsx:43-65` — add `"composed-card"` to `BLOCK_COMPONENTS`.
- `src/app/(app)/dev/cards/fixtures.ts` + `page.tsx` — one gallery entry per recipe.
- `src/lib/tools/chat-agent-loop.ts` — expose `emit_card`, route its result to `onBlock`.
- `scripts/spike-slot-composer.ts` — align its tool schema to the shipped contract (B2).

**Why a separate schema module, not `blocks.ts`:** `blocks.ts:28` records a *"500-line project limit"* as the reason `profile-blocks.ts` was split out. `blocks.ts` is already 1074 lines. New schemas go in their own module and are re-exported if needed.

---

### Task 1: Slot vocabulary, card shape, recipe registry

**Files:**
- Create: `src/lib/tools/composed-card-schema.ts`
- Test: `src/lib/tools/__tests__/composed-card-schema.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module, zod only).
- Produces: `SlotSchema`, `ComposedCardBlockSchema`, `RECIPES`, `type RecipeId`, `type ActionId`, `type Slot`, `type ComposedCardBlock`, `parseComposedCard(raw: unknown): { ok: true; block: ComposedCardBlock } | { ok: false; reason: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/tools/__tests__/composed-card-schema.test.ts
import { describe, it, expect } from "vitest";
import { parseComposedCard, RECIPES } from "@/lib/tools/composed-card-schema";

const validFormatSet = {
  type: "composed-card",
  props: {
    recipe: "format-set",
    deliverable: { kind: "claim", text: "Founders who film the failure out-perform the ones who film the win." },
    body: [
      { kind: "beats", items: [
        { label: "Open", text: "Name the failure in the first line." },
        { label: "Turn", text: "Show the receipt that proves it was real." },
      ] },
    ],
  },
};

describe("parseComposedCard", () => {
  it("accepts a card whose slots satisfy its recipe", () => {
    const r = parseComposedCard(validFormatSet);
    expect(r.ok).toBe(true);
  });

  it("rejects a card missing its recipe's required slot", () => {
    const r = parseComposedCard({
      ...validFormatSet,
      props: { ...validFormatSet.props, body: [{ kind: "chips", items: ["a"] }] },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/beats/);
  });

  it("rejects the wrong deliverable kind for the recipe", () => {
    // hook-set's payoff is a LINE (the actual hook), never a claim — D6 + the spike's
    // measured hero failure, where both models wrote a label instead of the hook.
    const r = parseComposedCard({
      type: "composed-card",
      props: {
        recipe: "hook-set",
        deliverable: { kind: "claim", text: "The Faceless Case Study" },
        body: [{ kind: "bullets", items: ["x"] }],
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/line/);
  });

  it("repairs a body arriving as a JSON string (spike failure 2)", () => {
    const r = parseComposedCard({
      ...validFormatSet,
      props: { ...validFormatSet.props, body: JSON.stringify(validFormatSet.props.body) },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a model-authored action outside the closed enum", () => {
    const r = parseComposedCard({
      ...validFormatSet,
      props: { ...validFormatSet.props, actions: ["buy_credits"] },
    });
    expect(r.ok).toBe(false);
  });

  it("accepts an action the product currently offers", () => {
    const r = parseComposedCard({
      ...validFormatSet,
      props: { ...validFormatSet.props, actions: ["explore"] },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a skill the product has deliberately shut (HORIZONTAL_ENABLED=false)", () => {
    // `predict` is a REAL skill with a live route and runner — and it is closed at every composer
    // door. A card offering it would be the one back door left open, which is the exact failure
    // skill-capabilities.ts:151-162 records. This test fails the day someone hardcodes the enum.
    for (const shut of ["predict", "profile"]) {
      const r = parseComposedCard({
        ...validFormatSet,
        props: { ...validFormatSet.props, actions: [shut] },
      });
      expect(r.ok, shut).toBe(false);
    }
  });

  it("every recipe declares a deliverable kind and at least one legal slot", () => {
    for (const [id, recipe] of Object.entries(RECIPES)) {
      expect(recipe.deliverable, id).toBeDefined();
      expect(recipe.legalSlots.length, id).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/composed-card-schema.test.ts`
Expected: FAIL — cannot resolve `@/lib/tools/composed-card-schema`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/tools/composed-card-schema.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/composed-card-schema.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/tools/composed-card-schema.ts src/lib/tools/__tests__/composed-card-schema.test.ts
git commit -m "feat(composed-card): the recipe registry IS the validation schema"
```

---

### Task 1b: Close three gaps found reviewing Task 1

**Files:**
- Modify: `src/lib/tools/composed-card-schema.ts`
- Modify: `src/lib/tools/__tests__/composed-card-schema.test.ts`

**Interfaces:**
- Consumes: everything Task 1 produced.
- Produces: `Recipe.cardCount`, and `parseComposedCard` additionally validating `disclosure` slot legality.

> **Why this exists.** Task 1 was implemented exactly as planned and its 8 tests pass — the gaps are in the *plan*, found by re-reading spec §4.2 against the delivered code. Recording them as their own task keeps the trail honest instead of quietly rewriting Task 1.

**G1 — the registry is missing `cardCount`, which §4.2 explicitly requires.**
Spec §4.2: *"each declares its required deliverable kind, legal slots, **and card count**."* `Recipe` has `deliverable`, `legalSlots`, `requiredSlots` and no count, so `hook-set`'s *"receipt · 3–5 cards"* is unenforceable. Enforcement lands at the emit boundary (Task 7, which is the only place that sees a whole card array), but the **declaration belongs in the registry** — that is what "the recipe is the schema" means.

**G2 — `disclosure` slots bypass recipe legality.**
`parseComposedCard` loops `block.props.body` only, so any slot kind may appear in `disclosure` regardless of `legalSlots`. That may well be intended (§0.5 row 6 is the "collapse everything else in here" row) — but nothing states it and no test pins it, so a reader cannot tell a decision from an oversight. **Decide it and write it down.** Recommended: hold `disclosure` to the same `legalSlots`, since a disclosure that may contain anything reintroduces the unconstrained card the composer exists to prevent.

**G3 — the `comparison` recipe's required slots are ambiguous, deliberately left as-is.**
§4.2's shape column reads `comparison + bullets`; the code requires `comparison` and allows `bullets`. Requiring both would reject a legitimate two-column comparison carrying no extra points. **No change** — this note exists so the next reader knows it was considered, not missed.

- [ ] **Step 1: Write the failing tests**

```ts
// append to src/lib/tools/__tests__/composed-card-schema.test.ts
import { RECIPES } from "@/lib/tools/composed-card-schema";

describe("recipe card counts (G1)", () => {
  it("every recipe declares a card count", () => {
    for (const [id, recipe] of Object.entries(RECIPES)) {
      expect(recipe.cardCount, id).toBeDefined();
      expect(recipe.cardCount.min, id).toBeGreaterThanOrEqual(1);
      expect(recipe.cardCount.max, id).toBeGreaterThanOrEqual(recipe.cardCount.min);
    }
  });

  it("hook-set asks for 3-5 cards, per the spec table", () => {
    expect(RECIPES["hook-set"].cardCount).toEqual({ min: 3, max: 5 });
  });

  it("a single-card recipe declares exactly one", () => {
    expect(RECIPES.script.cardCount).toEqual({ min: 1, max: 1 });
  });
});

describe("disclosure slot legality (G2)", () => {
  it("holds disclosure to the same legalSlots as the body", () => {
    // `script` does not allow `comparison` anywhere. Smuggling it into disclosure must fail.
    const r = parseComposedCard({
      type: "composed-card",
      props: {
        recipe: "script",
        deliverable: { kind: "claim", text: "Open on the cost, not the tip." },
        body: [{ kind: "script_timeline", lines: [{ t: "0:00", text: "a" }, { t: "0:03", text: "b" }] }],
        disclosure: [{ kind: "comparison", columns: [
          { title: "A", points: ["x"] }, { title: "B", points: ["y"] },
        ] }],
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/comparison/);
  });

  it("allows a legal slot in disclosure", () => {
    const r = parseComposedCard({
      type: "composed-card",
      props: {
        recipe: "script",
        deliverable: { kind: "claim", text: "Open on the cost, not the tip." },
        body: [{ kind: "script_timeline", lines: [{ t: "0:00", text: "a" }, { t: "0:03", text: "b" }] }],
        disclosure: [{ kind: "note", text: "Timings assume a 30s cut." }],
      },
    });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/composed-card-schema.test.ts`
Expected: FAIL — `cardCount` undefined; the disclosure smuggling case currently returns `ok: true`.

- [ ] **Step 3: Implement**

Add `cardCount` to the `Recipe` interface and to every entry in `RECIPES`:

```ts
export interface Recipe {
  deliverable: "line" | "claim" | "name";
  legalSlots: SlotKind[];
  requiredSlots: SlotKind[];
  /**
   * How many cards this recipe emits (spec §4.2: "each declares its … card count").
   * Enforced at the emit boundary in emit-card-tool.ts — the only place that sees the whole
   * array — but DECLARED here, because the recipe is the schema.
   */
  cardCount: { min: number; max: number };
}
```

Counts, from §4.2's shape column: `hook-set` `{min:3,max:5}`; every other recipe emits one card, `{min:1,max:1}`.

Then extend the legality loop to cover both arrays:

```ts
  for (const slot of [...block.props.body, ...(block.props.disclosure ?? [])]) {
    if (!recipe.legalSlots.includes(slot.kind)) {
      return { ok: false, reason: `recipe "${block.props.recipe}" does not allow a ${slot.kind} slot` };
    }
  }
```

- [ ] **Step 4: Run to verify all pass**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/composed-card-schema.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/tools/composed-card-schema.ts src/lib/tools/__tests__/composed-card-schema.test.ts
git commit -m "fix(composed-card): declare cardCount and hold disclosure to legalSlots"
```

---

### Task 1c: Correct the card counts — the floor was wrong, and prod data proves it

**Files:**
- Modify: `src/lib/tools/composed-card-schema.ts` (the `RECIPES` counts + the `cardCount` doc comment)
- Modify: `src/lib/tools/__tests__/composed-card-schema.test.ts`

**Interfaces:** unchanged. Only the values in `RECIPES[*].cardCount` and their documentation move.

> **This is a defect in the plan (Task 1b's step 3), not in Task 1b's execution.** Task 1b implemented the counts exactly as written and its 13 tests pass. The written counts were wrong.

**What was wrong.** Task 1b set `hook-set` to `{min:3,max:5}` and *every other recipe* to `{min:1,max:1}`, on the reasoning that §4.2's shape column only annotates hook-set with a count. Both halves are wrong:

1. **A `min` of 3 on `hook-set` would reject a real, common ask.** The distinct real asks in prod `messages` include **`"just one example hook, doesn't have to be good"` — 14 occurrences**, plus `"give me 3 good hooks"` and `"one quick hook tip"`. Task 7 enforces `cardCount`, so this floor would make the product refuse a request creators actually type. §4.2's "3–5 cards" describes the *typical* shape; it is not a floor.
2. **`{min:1,max:1}` on the `-set` recipes contradicts the spec's own headline example.** §1 goal 2: *"the creator should be able to ask for anything (**'3 viral formats for young startup founders'**, angles, an ad script, a comparison)"*. A `format-set` capped at one card cannot answer the example the spec uses to motivate the whole feature. `angle-set` and `idea-set` are "-set" recipes for the same reason. The spike's own tool allowed `cards: 1..6`.

**The correction: `cardCount` is a CEILING; the floor is 1 everywhere.** The real failure mode is a model emitting twenty cards, not two. Enforcing a floor buys nothing and demonstrably rejects real asks.

- [ ] **Step 1: Write the failing tests**

```ts
// replace the two count assertions added in Task 1b
describe("recipe card counts (corrected)", () => {
  it("every recipe accepts a single card — measured: creators really do ask for one", () => {
    // "just one example hook, doesn't have to be good" appears 14x in prod messages.
    for (const [id, recipe] of Object.entries(RECIPES)) {
      expect(recipe.cardCount.min, id).toBe(1);
    }
  });

  it("hook-set tops out at 5, the spec's stated shape", () => {
    expect(RECIPES["hook-set"].cardCount).toEqual({ min: 1, max: 5 });
  });

  it("the -set recipes can emit a real set — the spec's own '3 viral formats' example", () => {
    for (const id of ["format-set", "angle-set", "idea-set"] as const) {
      expect(RECIPES[id].cardCount.max, id).toBeGreaterThanOrEqual(3);
    }
  });

  it("a single-deliverable recipe stays at one card", () => {
    for (const id of ["script", "comparison", "teardown", "brief"] as const) {
      expect(RECIPES[id].cardCount, id).toEqual({ min: 1, max: 1 });
    }
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/composed-card-schema.test.ts`
Expected: FAIL — `hook-set` min is 3; `format-set` max is 1.

- [ ] **Step 3: Correct the values**

| recipe | cardCount |
|---|---|
| `hook-set` | `{ min: 1, max: 5 }` |
| `format-set` · `angle-set` · `idea-set` | `{ min: 1, max: 6 }` |
| `script` · `comparison` · `teardown` · `brief` | `{ min: 1, max: 1 }` |

Update the `cardCount` doc comment on the `Recipe` interface to say it is a ceiling, and why the floor is 1 (the measured ask above) — so nobody restores a floor later on a reading of the §4.2 table.

- [ ] **Step 4: Run to verify all pass**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/composed-card-schema.test.ts`

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/tools/composed-card-schema.ts src/lib/tools/__tests__/composed-card-schema.test.ts
git commit -m "fix(composed-card): cardCount is a ceiling — a floor rejects asks creators really make"
```

---

### Task 2: Register the block type

**Files:**
- Modify: `src/lib/tools/block-registry.ts:42-64`
- Test: `src/lib/tools/__tests__/composed-card-registry.test.ts`

**Interfaces:**
- Consumes: `ComposedCardBlockSchema` (Task 1).
- Produces: `"composed-card"` as a valid `BlockType`; `validateBlock` accepts it.

> ⚠️ `BLOCK_COMPONENTS` in `message-blocks.tsx` is typed `Record<BlockType, …>`, so adding a key here **breaks the build** until Task 5 adds the component. That is intended — the two maps are kept in lockstep by the type system. Land Tasks 2 and 5 together if the build must stay green between commits; otherwise expect a red `tsc` at the end of this task and note it in the commit.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/tools/__tests__/composed-card-registry.test.ts
import { describe, it, expect } from "vitest";
import { validateBlock, BLOCK_REGISTRY } from "@/lib/tools/block-registry";

describe("composed-card registration", () => {
  it("is in the registry", () => {
    expect(Object.keys(BLOCK_REGISTRY)).toContain("composed-card");
  });

  it("validateBlock accepts a schema-valid composed card", () => {
    const r = validateBlock({
      type: "composed-card",
      props: {
        recipe: "brief",
        deliverable: { kind: "claim", text: "Ship the ugly version first." },
        body: [{ kind: "bullets", items: ["Post it before it is ready."] }],
      },
    });
    expect(r.ok).toBe(true);
  });

  it("validateBlock rejects a malformed composed card rather than rendering it", () => {
    const r = validateBlock({ type: "composed-card", props: { recipe: "brief" } });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/composed-card-registry.test.ts`
Expected: FAIL — `"composed-card"` not in registry.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/tools/block-registry.ts`, add the import beside the others:

```ts
import { ComposedCardBlockSchema } from "./composed-card-schema";
```

and the entry inside `BLOCK_REGISTRY` (after `"brought-card"`):

```ts
  // The composer's one block type — its slot tree is validated by a RECIPE, not by a bespoke
  // schema per card (spec §4.2). Registry-level validation here is shape-only; recipe legality
  // is enforced by parseComposedCard at the emit boundary.
  "composed-card": { schema: ComposedCardBlockSchema as z.ZodType },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/composed-card-registry.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tools/block-registry.ts src/lib/tools/__tests__/composed-card-registry.test.ts
git commit -m "feat(composed-card): register the block type"
```

---

### Task 3: Server-side receipt materialization (D7)

**Files:**
- Create: `src/lib/tools/composed-card-receipt.ts`
- Test: `src/lib/tools/__tests__/composed-card-receipt.test.ts`

**Interfaces:**
- Consumes: `getCorpusClient` (`@/lib/grounding/corpus`), `hasKnownBaseline` (`@/lib/grounding/retrieve`), `HookProof` (`@/lib/tools/proof-schema`).
- Also modifies: `src/lib/grounding/outlier-gate.ts` — adds `MAX_PRINTABLE_MULTIPLIER = 100` beside the existing `MIN_OUTLIER_MULTIPLIER = 3`.
- Produces: `materializeReceipts(ids: string[], deps?: { supabase?: SupabaseClient }): Promise<Map<string, HookProof>>`.

> **B1 is resolved: clamp at 100, and the constant lives in `outlier-gate.ts`.** Add it there, beside `MIN_OUTLIER_MULTIPLIER` — the floor and ceiling of one band belong in one module, and `corpus-reads.ts` re-points at it in Task 9. Do **not** declare a second literal in this file; two constants that happen to agree is the drift this decision exists to prevent.

> **Why this is the fabrication fix:** the spike measured 0/31 fabricated handles — *luck, not structure*. Here the model supplies only a row id. A nonexistent id yields no entry in the map and the receipt is simply omitted (spec §5), so a fabricated handle cannot reach the DOM because the model never supplies one.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/tools/__tests__/composed-card-receipt.test.ts
import { describe, it, expect } from "vitest";
import { materializeReceipts } from "@/lib/tools/composed-card-receipt";
import { MAX_PRINTABLE_MULTIPLIER } from "@/lib/grounding/outlier-gate";

function fakeSupabase(rows: Array<Record<string, unknown>>) {
  return {
    from: () => ({
      select: () => ({
        in: async () => ({ data: rows, error: null }),
      }),
    }),
  } as never;
}

const row = {
  id: "row-1",
  creator_handle: "corporate.bro",
  video_url: "https://tiktok.com/@corporate.bro/video/1",
  cover_url: "https://cdn/cover.jpg",
  hook_template: "The [thing] nobody tells you about [topic]",
  hook_archetype: "secret-reveal-breakdown",
  outlier_multiplier: 5.7,
  views: 1_400_000,
  baseline_label: "vs their usual views",
};

describe("materializeReceipts", () => {
  it("maps a corpus row onto a HookProof", async () => {
    const out = await materializeReceipts(["row-1"], { supabase: fakeSupabase([row]) });
    const proof = out.get("row-1");
    expect(proof?.handle).toBe("corporate.bro");
    expect(proof?.multiplier).toBe(5.7);
    expect(proof?.baselineLabel).toBe("vs their usual views");
  });

  it("omits an id the corpus does not have — a fabricated ref renders no receipt", async () => {
    const out = await materializeReceipts(["nope"], { supabase: fakeSupabase([]) });
    expect(out.has("nope")).toBe(false);
  });

  it("drops the number when the row cannot name its basis (D9)", async () => {
    const out = await materializeReceipts(["row-1"], {
      supabase: fakeSupabase([{ ...row, baseline_label: null }]),
    });
    expect(out.get("row-1")?.multiplier).toBeNull();
    expect(out.get("row-1")?.baselineLabel).toBeNull();
  });

  it("clamps an above-band multiplier rather than printing 20154x (B1)", async () => {
    const out = await materializeReceipts(["row-1"], {
      supabase: fakeSupabase([{ ...row, outlier_multiplier: 20154.7 }]),
    });
    expect(out.get("row-1")?.multiplier).toBe(MAX_PRINTABLE_MULTIPLIER);
  });

  it("leaves an in-band multiplier untouched", async () => {
    const out = await materializeReceipts(["row-1"], {
      supabase: fakeSupabase([{ ...row, outlier_multiplier: 57 }]),
    });
    expect(out.get("row-1")?.multiplier).toBe(57);
  });

  it("never claims a fit it did not measure", async () => {
    const out = await materializeReceipts(["row-1"], { supabase: fakeSupabase([row]) });
    expect(out.get("row-1")?.fitLabel).toBeNull();
  });

  it("returns an empty map for an empty id list without querying", async () => {
    const out = await materializeReceipts([], { supabase: fakeSupabase([]) });
    expect(out.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/composed-card-receipt.test.ts`
Expected: FAIL — cannot resolve `@/lib/tools/composed-card-receipt`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/tools/composed-card-receipt.ts
/**
 * composed-card-receipt.ts — D7: the model names a teardown row, the SERVER materializes the
 * numbers. The model never authors a handle or a multiplier.
 *
 * The spike printed 31 receipts with 0 fabricated handles. That was empirical — luck, measured
 * once, on two models. This module makes it structural: the composer's only receipt input is a
 * row id, and an id that does not resolve yields no receipt at all.
 *
 * Honesty rules are the shipped ones, imported rather than re-rolled:
 *   - no baseline_label ⇒ NO number (hasKnownBaseline; D9 "never a bare multiplier")
 *   - no handle ⇒ no receipt (§0.5b "An unattributable source is not a receipt")
 *   - fitLabel is ALWAYS null here: nothing measured this row against this creator's audience,
 *     and a fit glyph is a claim retrieval earns (§0.5b).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCorpusClient } from "@/lib/grounding/corpus";
import { hasKnownBaseline } from "@/lib/grounding/retrieve";
import { MAX_PRINTABLE_MULTIPLIER } from "@/lib/grounding/outlier-gate";
import type { HookProof } from "@/lib/tools/proof-schema";

interface TeardownReceiptRow {
  id: string;
  creator_handle: string | null;
  video_url: string | null;
  cover_url: string | null;
  hook_template: string | null;
  hook_archetype: string | null;
  outlier_multiplier: number | null;
  views: number | null;
  baseline_label: string | null;
}

function bandedMultiplier(m: number | null): number | null {
  if (typeof m !== "number" || !Number.isFinite(m) || m <= 0) return null;
  return m > MAX_PRINTABLE_MULTIPLIER ? MAX_PRINTABLE_MULTIPLIER : m;
}

export async function materializeReceipts(
  ids: string[],
  deps: { supabase?: SupabaseClient } = {},
): Promise<Map<string, HookProof>> {
  const out = new Map<string, HookProof>();
  const unique = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.length > 0)));
  if (unique.length === 0) return out;

  const supabase = deps.supabase ?? getCorpusClient();
  const { data, error } = await supabase
    .from("outlier_teardowns")
    .select(
      "id, creator_handle, video_url, cover_url, hook_template, hook_archetype, outlier_multiplier, views, baseline_label",
    )
    .in("id", unique);

  if (error || !Array.isArray(data)) return out;

  for (const row of data as TeardownReceiptRow[]) {
    // §0.5b: no handle → no receipt. An unattributable source is not a receipt.
    if (!row.creator_handle) continue;

    const basisKnown = hasKnownBaseline({ baseline_label: row.baseline_label });
    out.set(row.id, {
      handle: row.creator_handle,
      videoUrl: row.video_url,
      coverUrl: row.cover_url,
      hookTemplate: row.hook_template,
      archetype: row.hook_archetype,
      // D9: a multiplier with no nameable basis is a boast with nothing behind it.
      multiplier: basisKnown ? bandedMultiplier(row.outlier_multiplier) : null,
      baselineLabel: basisKnown ? row.baseline_label : null,
      views: typeof row.views === "number" ? row.views : null,
      fitLabel: null,
    });
  }

  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/composed-card-receipt.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/tools/composed-card-receipt.ts src/lib/tools/__tests__/composed-card-receipt.test.ts
git commit -m "feat(composed-card): materialize receipts server-side from a row id (D7)"
```

---

### Task 4: Slot renderers

**Files:**
- Create: `src/components/thread/composed-card-slots.tsx`
- Test: `src/components/thread/__tests__/composed-card-slots.test.tsx`

**Interfaces:**
- Consumes: `Slot` (Task 1), `HookProof` (proof-schema), `SECTION_LABEL` (`card-primitives.tsx`), `ProofReceipt` (`proof-receipt.tsx`).
- Produces: `<SlotRenderer slot={Slot} receipts={Map<string, HookProof>} />`.

> **`proof_strip` and playable video:** spec §4.2 says it reuses `retention-scrubber`'s player and its keyframe-flipbook degrade (§2.4). **This task renders the attributed receipt tiles only** — it delegates to the existing `<ProofReceipt>`. Wiring the real player is deliberately deferred: `retention-scrubber.tsx` is a playhead-driven component with its own data contract, and folding it in here would make this task un-reviewable. Track it as a follow-up on the Phase 2 lane.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/thread/__tests__/composed-card-slots.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SlotRenderer } from "@/components/thread/composed-card-slots";

describe("SlotRenderer", () => {
  it("renders beats as label + text pairs", () => {
    render(
      <SlotRenderer
        slot={{ kind: "beats", items: [{ label: "Open", text: "Name the failure." }, { label: "Turn", text: "Show the receipt." }] }}
        receipts={new Map()}
      />,
    );
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByText("Name the failure.")).toBeTruthy();
  });

  it("renders a proof_strip only for ids that resolved to a receipt", () => {
    const receipts = new Map([
      ["row-1", { handle: "corporate.bro", videoUrl: null, coverUrl: null, hookTemplate: null,
                  archetype: null, multiplier: 5.7, views: 1400000, baselineLabel: "vs their usual views",
                  fitLabel: null }],
    ]);
    render(<SlotRenderer slot={{ kind: "proof_strip", receiptRefs: ["row-1", "ghost-id"] }} receipts={receipts} />);
    expect(screen.getByText(/corporate\.bro/)).toBeTruthy();
    expect(screen.queryByText(/ghost-id/)).toBeNull();
  });

  it("renders nothing when no receiptRef resolves", () => {
    const { container } = render(
      <SlotRenderer slot={{ kind: "proof_strip", receiptRefs: ["ghost"] }} receipts={new Map()} />,
    );
    expect(container.textContent).toBe("");
  });

  it("renders a comparison as one column per entry", () => {
    render(
      <SlotRenderer
        slot={{ kind: "comparison", columns: [
          { title: "Talking head", points: ["Cheap"] },
          { title: "Greenscreen", points: ["Higher retention"] },
        ] }}
        receipts={new Map()}
      />,
    );
    expect(screen.getByText("Talking head")).toBeTruthy();
    expect(screen.getByText("Greenscreen")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/components/thread/__tests__/composed-card-slots.test.tsx`
Expected: FAIL — cannot resolve `@/components/thread/composed-card-slots`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/thread/composed-card-slots.tsx
'use client';

/**
 * composed-card-slots.tsx — one small renderer per slot kind (spec §4.2's vocabulary of 10).
 *
 * Every label goes through SECTION_LABEL and every corner through the token radius scale, because
 * the guards (section-label-scale.test.ts / radius-scale.test.ts) walk this tree the day it lands —
 * which is the whole point of a composer: the contract is enforced once, here, not per card.
 *
 * ZERO accent. The accent dosage is LOCKED (CLAUDE.md): a slot is body content, never a place to
 * add colour.
 */
import type { Slot } from '@/lib/tools/composed-card-schema';
import type { HookProof } from '@/lib/tools/proof-schema';
import { SECTION_LABEL } from '@/components/thread/card-primitives';
import { ProofReceipt } from '@/components/thread/proof-receipt';

export function SlotRenderer({
  slot,
  receipts,
}: {
  slot: Slot;
  /** Server-materialized receipts, keyed by teardown row id (D7). */
  receipts: Map<string, HookProof>;
}) {
  switch (slot.kind) {
    case 'proof_strip': {
      // An id the corpus did not return simply has no receipt — never a placeholder tile.
      const resolved = slot.receiptRefs.map((id) => receipts.get(id)).filter((p): p is HookProof => !!p);
      if (resolved.length === 0) return null;
      return (
        <div className="flex flex-col gap-2">
          {resolved.map((proof, i) => (
            <ProofReceipt key={`${proof.handle}-${i}`} proof={proof} />
          ))}
        </div>
      );
    }

    case 'beats':
      return (
        <div className="flex flex-col gap-2.5">
          {slot.items.map((item, i) => (
            <div key={i} className="flex flex-col gap-1">
              <span className={SECTION_LABEL}>{item.label}</span>
              <p className="text-body text-foreground-secondary">{item.text}</p>
            </div>
          ))}
        </div>
      );

    case 'stat_row':
      return (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {slot.stats.map((s, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <span className="text-heading font-semibold tabular-nums text-foreground">{s.value}</span>
              <span className={SECTION_LABEL}>{s.label}</span>
            </div>
          ))}
        </div>
      );

    case 'bullets':
      return (
        <ul className="flex flex-col gap-1.5">
          {slot.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-body text-foreground-secondary">
              <span aria-hidden="true" className="text-foreground-muted">
                ·
              </span>
              <span className="min-w-0 flex-1">{item}</span>
            </li>
          ))}
        </ul>
      );

    case 'quote':
      return (
        <figure className="flex flex-col gap-1.5 border-l border-white/[0.06] pl-3">
          <blockquote className="text-body italic text-foreground-secondary">{slot.text}</blockquote>
          {slot.attribution && <figcaption className={SECTION_LABEL}>{slot.attribution}</figcaption>}
        </figure>
      );

    case 'label_values':
      return (
        <dl className="flex flex-col gap-1.5">
          {slot.rows.map((r, i) => (
            <div key={i} className="flex items-baseline justify-between gap-4">
              <dt className={SECTION_LABEL}>{r.label}</dt>
              <dd className="min-w-0 text-right text-body text-foreground-secondary">{r.value}</dd>
            </div>
          ))}
        </dl>
      );

    case 'script_timeline':
      return (
        <ol className="flex flex-col gap-2">
          {slot.lines.map((l, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 text-label font-semibold tabular-nums text-foreground-muted">{l.t}</span>
              <span className="min-w-0 flex-1 text-body text-foreground-secondary">{l.text}</span>
            </li>
          ))}
        </ol>
      );

    case 'comparison':
      return (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${slot.columns.length}, minmax(0, 1fr))` }}>
          {slot.columns.map((col, i) => (
            <div key={i} className="flex min-w-0 flex-col gap-2 rounded-md border border-white/[0.06] p-3">
              <span className={SECTION_LABEL}>{col.title}</span>
              <ul className="flex flex-col gap-1">
                {col.points.map((p, j) => (
                  <li key={j} className="text-body text-foreground-secondary">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );

    case 'chips':
      return (
        <div className="flex flex-wrap gap-1.5">
          {slot.items.map((c, i) => (
            <span key={i} className="rounded-md border border-white/[0.06] px-2 py-1 text-label text-foreground-secondary">
              {c}
            </span>
          ))}
        </div>
      );

    case 'note':
      return <p className="text-label text-foreground-muted">{slot.text}</p>;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/components/thread/__tests__/composed-card-slots.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the design guards, then commit**

```bash
node node_modules/vitest/vitest.mjs run src/components/thread/__tests__/radius-scale.test.ts src/components/thread/__tests__/section-label-scale.test.ts
npx tsc --noEmit
git add src/components/thread/composed-card-slots.tsx src/components/thread/__tests__/composed-card-slots.test.tsx
git commit -m "feat(composed-card): the ten slot renderers"
```

---

### Task 5: The card renderer — spine ordering (D8) + registry wiring

**Files:**
- Create: `src/components/thread/composed-card-block.tsx`
- Modify: `src/components/thread/message-blocks.tsx:43-65`
- Test: `src/components/thread/__tests__/composed-card-block.test.tsx`

**Interfaces:**
- Consumes: `ComposedCardBlock` (Task 1), `SlotRenderer` (Task 4), `materializeReceipts` output shape (Task 3), `CardEyebrow` / `CardHero` / `CardActionBar` / `CardPrimaryAction` (`card-primitives.tsx`), `CaretToggle`, `SaveAffordance`.
- Produces: `ComposedCardRenderer({ block })`, registered as `BLOCK_COMPONENTS["composed-card"]`.

> **B3 is resolved.** An `ActionId` is a `SkillInputAction` key. Read its creator-facing copy from `SKILL_CAPABILITIES[action].label` — **never** write button text in this component and never take it from the model. That is the same rule `input-request-block.tsx` follows, and it is why a card cannot spoof a field.

> **Receipts on the client.** Props are JSON-serializable and persisted, so the materialized receipts ride **in the block props** (written server-side at emit time in Task 7), not fetched here. This renderer therefore takes them off `props`, keeping it a pure function of its block — the same shape every other card renderer has.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/thread/__tests__/composed-card-block.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComposedCardRenderer } from "@/components/thread/composed-card-block";

const block = {
  type: "composed-card" as const,
  props: {
    recipe: "format-set" as const,
    eyebrow: "FORMAT · 1 of 3",
    deliverable: { kind: "claim" as const, text: "Film the failure, not the win." },
    why: "The failure is the only part nobody else can copy.",
    body: [
      { kind: "note" as const, text: "Works best under 30 seconds." },
      { kind: "beats" as const, items: [
        { label: "Open", text: "Name the failure." },
        { label: "Turn", text: "Show the receipt." },
      ] },
    ],
    actions: ["write_script" as const],
  },
};

describe("ComposedCardRenderer", () => {
  it("renders the deliverable as the hero", () => {
    render(<ComposedCardRenderer block={block} />);
    expect(screen.getByText("Film the failure, not the win.")).toBeTruthy();
  });

  it("sorts slots into spine order regardless of model order (D8)", () => {
    // The model put `note` before `beats`; the spine puts structural body content first
    // and small print last. Assert on DOM order, not on the props array.
    const { container } = render(<ComposedCardRenderer block={block} />);
    const text = container.textContent ?? "";
    expect(text.indexOf("Name the failure.")).toBeLessThan(text.indexOf("Works best under 30 seconds."));
  });

  it("renders the eyebrow above the hero", () => {
    const { container } = render(<ComposedCardRenderer block={block} />);
    const text = container.textContent ?? "";
    expect(text.indexOf("FORMAT")).toBeLessThan(text.indexOf("Film the failure"));
  });

  it("renders exactly one action bar", () => {
    const { container } = render(<ComposedCardRenderer block={block} />);
    expect(container.querySelectorAll("[data-testid='composed-card-actions']").length).toBe(1);
  });

  it("omits the action bar entirely when the model named none", () => {
    const noActions = { ...block, props: { ...block.props, actions: undefined } };
    const { container } = render(<ComposedCardRenderer block={noActions} />);
    expect(container.querySelectorAll("[data-testid='composed-card-actions']").length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/components/thread/__tests__/composed-card-block.test.tsx`
Expected: FAIL — cannot resolve `@/components/thread/composed-card-block`.

- [ ] **Step 3: Write the renderer**

Create `src/components/thread/composed-card-block.tsx` with:
- a module header explaining D8 (the renderer sorts; model order is ignored) and why the spine is not negotiable;
- `const SPINE_ORDER: SlotKind[] = ['proof_strip', 'stat_row', 'beats', 'script_timeline', 'comparison', 'bullets', 'label_values', 'quote', 'chips', 'note']` with a comment that `note` is small print and therefore always last;
- `function sortToSpine(slots: Slot[]): Slot[]` returning a stable sort by `SPINE_ORDER.indexOf(kind)`;
- the card shell: `rounded-lg border border-white/[0.06] bg-[#252524]` (thread card tone, radius 12 — **never** `rounded-[12px]`);
- `<CardEyebrow kicker={props.eyebrow} />` when present;
- `<CardHero affordance={<CopyAffordance text={props.deliverable.text} aria-label="Copy this line" />}>{props.deliverable.text}</CardHero>`;
- the receipt (Task 3's materialized `HookProof` off props) via `<ProofReceipt>`;
- `props.why` as the one clamped why-teaser line (`line-clamp-1`);
- `sortToSpine(props.body).map(...)` through `<SlotRenderer>`;
- `props.disclosure` inside a single `<CaretToggle>` labelled "Why & details" — **the ONE disclosure**;
- `<CardActionBar data-testid="composed-card-actions">` with one `<CardPrimaryAction>` per `ActionId`, its child text read from `SKILL_CAPABILITIES[action].label`, plus `<SaveAffordance className="ml-auto" />` — rendered only when at least one action resolves.

Then wire it in `src/components/thread/message-blocks.tsx`:

```tsx
import { ComposedCardRenderer } from '@/components/thread/composed-card-block';
```

and add to `BLOCK_COMPONENTS`:

```tsx
  "composed-card": ComposedCardRenderer,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node node_modules/vitest/vitest.mjs run src/components/thread/__tests__/composed-card-block.test.tsx src/lib/tools/__tests__/composed-card-registry.test.ts`
Expected: PASS

- [ ] **Step 5: Run the guards, typecheck, commit**

```bash
node node_modules/vitest/vitest.mjs run src/components/thread/__tests__/radius-scale.test.ts src/components/thread/__tests__/section-label-scale.test.ts src/components/thread/__tests__/card-surface-consistency.test.ts
npx tsc --noEmit
git add src/components/thread/composed-card-block.tsx src/components/thread/message-blocks.tsx src/components/thread/__tests__/composed-card-block.test.tsx
git commit -m "feat(composed-card): renderer sorts slots into the contract spine (D8)"
```

---

### Task 5b: Give the schema somewhere to carry a materialized receipt

**Files:**
- Modify: `src/lib/tools/composed-card-schema.ts`
- Modify: `src/components/thread/composed-card-block.tsx`
- Modify: `src/lib/tools/__tests__/composed-card-schema.test.ts`, `src/components/thread/__tests__/composed-card-block.test.tsx`

**Interfaces:**
- Produces: `ComposedCardBlockSchema.props.receipts?: Record<string, HookProof>`; `ComposedCardRenderer` reads receipts from `block.props.receipts` instead of a separate prop.

> **This is the sixth plan defect, found executing Task 5, and it is load-bearing: without it D7's receipts never reach a real thread.**
>
> `message-blocks.tsx` invokes every renderer as `<Component block={block} />` and re-runs `validateBlock` **on render**. That is a zod object parse, and zod **strips undeclared keys**. So a receipt attached to `props` at emit time is silently discarded on rehydration, and the card renders with no proof — on a `teardown`, the one recipe that *requires* a `proof_strip`, that is a card asserting evidence it never shows.
>
> Task 5 correctly refused to paper over this: it takes `receipts` as an explicit prop, documents the seam in its header, and nothing wires it. That kept the renderer honest and the gap visible. This task closes it.

**Two constraints that decide the shape:**

1. **It must be a plain object, not a `Map`.** Block props are persisted to `messages.body` as JSON (`blocks.ts`: *"ISO string (block props are JSON-serializable)"*). A `Map` serializes to `{}`. Use `Record<string, HookProof>` keyed by teardown row id.
2. **D7 must survive the field existing.** A declared field is a field the model can fill. `parseComposedCard` is the *model-facing* validator, so it must **delete `props.receipts` before parsing** — the model's value is discarded unconditionally, and only the server attaches the real one afterwards (Task 7). Without that deletion, declaring this field hands the model exactly the receipt-authoring power D7 exists to remove.

- [ ] **Step 1: Write the failing tests**

```ts
// composed-card-schema.test.ts
it("discards a model-supplied receipts map — D7 survives the field existing", () => {
  const r = parseComposedCard({
    type: "composed-card",
    props: {
      recipe: "brief",
      deliverable: { kind: "claim", text: "Ship it ugly." },
      body: [{ kind: "bullets", items: ["Post before it is ready."] }],
      receipts: { "row-1": { handle: "fabricated", videoUrl: null, coverUrl: null,
                             hookTemplate: null, archetype: null, multiplier: 999,
                             views: 1, baselineLabel: "vs followers", fitLabel: null } },
    },
  });
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.block.props.receipts).toBeUndefined();
});

it("accepts server-attached receipts on an already-parsed block", () => {
  // The persisted shape must round-trip through the SCHEMA, or validateBlock strips it on render.
  const parsed = ComposedCardBlockSchema.safeParse({
    type: "composed-card",
    props: {
      recipe: "brief",
      deliverable: { kind: "claim", text: "x" },
      body: [{ kind: "bullets", items: ["y"] }],
      receipts: { "row-1": { handle: "corporate.bro", videoUrl: null, coverUrl: null,
                             hookTemplate: null, archetype: null, multiplier: 5.7,
                             views: 1400000, baselineLabel: "vs their usual views", fitLabel: null } },
    },
  });
  expect(parsed.success).toBe(true);
});
```

```tsx
// composed-card-block.test.tsx — the round-trip that actually proves the bug is dead
it("renders a receipt that survived validateBlock", () => {
  const raw = { type: "composed-card", props: { recipe: "teardown",
    deliverable: { kind: "claim", text: "Film the failure." },
    body: [{ kind: "proof_strip", receiptRefs: ["row-1"] },
           { kind: "beats", items: [{ label: "Open", text: "a" }, { label: "Turn", text: "b" }] }],
    receipts: { "row-1": { handle: "corporate.bro", videoUrl: null, coverUrl: null,
                           hookTemplate: null, archetype: null, multiplier: 5.7,
                           views: 1400000, baselineLabel: "vs their usual views", fitLabel: null } } } };
  const validated = validateBlock(raw);
  expect(validated.ok).toBe(true);
  if (!validated.ok) return;
  render(<ComposedCardRenderer block={validated.block as never} />);
  expect(screen.getByText(/corporate\.bro/)).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/composed-card-schema.test.ts src/components/thread/__tests__/composed-card-block.test.tsx`
Expected: FAIL — `receipts` is stripped by the schema, so the round-trip renders no handle.

- [ ] **Step 3: Implement**

In `composed-card-schema.ts`: import `HookProofSchema` from `@/lib/tools/proof-schema`, add to `props`:

```ts
    /**
     * Server-materialized receipts, keyed by teardown row id (D7). DECLARED so that
     * `validateBlock`'s re-parse on render does not strip it — an undeclared key does not
     * survive rehydration, which silently removed every receipt before this field existed.
     * Written ONLY by emit-card-tool.ts; `parseComposedCard` deletes any model-supplied value.
     */
    receipts: z.record(z.string(), HookProofSchema).optional(),
```

and, at the top of `parseComposedCard`, drop the model's value before parsing:

```ts
  // D7: the model may never author a receipt. The field exists for the SERVER to fill after
  // validation, so anything the model put here is discarded unconditionally — not rejected,
  // because a hallucinated receipt should cost the model a retry, not the creator their card.
  delete (repaired as { props?: Record<string, unknown> })?.props?.receipts;
```

In `composed-card-block.tsx`: read receipts from `block.props.receipts` (converting the record to lookups directly), delete the separate `receipts` prop, and update the header's "seam 1" note — it is now closed, so the note should say what the field is rather than that the gap exists.

- [ ] **Step 4: Run to verify they pass**

```bash
node node_modules/vitest/vitest.mjs run src/lib/tools src/components/thread
```

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/tools/composed-card-schema.ts src/components/thread/composed-card-block.tsx src/lib/tools/__tests__/composed-card-schema.test.ts src/components/thread/__tests__/composed-card-block.test.tsx
git commit -m "fix(composed-card): declare props.receipts so a materialized receipt survives rehydration"
```

---

### Task 6: `/dev/cards` — one entry per recipe

**Files:**
- Modify: `src/app/(app)/dev/cards/fixtures.ts`
- Modify: `src/app/(app)/dev/cards/page.tsx`

**Interfaces:**
- Consumes: `ComposedCardBlock` (Task 1), `MessageBlocks` (existing).
- Produces: `COMPOSED_CARD_FIXTURES: ComposedCardBlock[]` — one per `RecipeId` (8 entries).

> **Why this task is not optional.** `ui-skill-cards.md` §0.7: *"A surface with no cheap way to look at it will drift, and the drift will be invisible to source-reading review. `/dev/cards` is why the thread cards stayed honest. Reading has no equivalent"* — and Reading is the surface that accumulated 11 label declarations in 7 stacks. A composer with 8 recipes and no gallery is that failure waiting to repeat.

- [ ] **Step 1: Add one fixture per recipe**

In `fixtures.ts`, export `COMPOSED_CARD_FIXTURES` with one schema-valid `ComposedCardBlock` per recipe id (`hook-set`, `format-set`, `angle-set`, `idea-set`, `script`, `comparison`, `teardown`, `brief`). Each must satisfy its recipe's `requiredSlots` and use only its `legalSlots`. Include one fixture carrying a materialized receipt and one carrying `disclosure`.

- [ ] **Step 2: Assert the fixtures are valid — a fixture that drifts is worse than none**

```ts
// src/app/(app)/dev/cards/__tests__/composed-card-fixtures.test.ts
import { describe, it, expect } from "vitest";
import { COMPOSED_CARD_FIXTURES } from "../fixtures";
import { parseComposedCard, RECIPES } from "@/lib/tools/composed-card-schema";

describe("composed-card gallery fixtures", () => {
  it("covers every recipe", () => {
    const covered = new Set(COMPOSED_CARD_FIXTURES.map((f) => f.props.recipe));
    expect(covered.size).toBe(Object.keys(RECIPES).length);
  });

  it("every fixture passes the real validator", () => {
    for (const f of COMPOSED_CARD_FIXTURES) {
      const r = parseComposedCard(f);
      expect(r.ok, `${f.props.recipe}: ${r.ok ? "" : r.reason}`).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run "src/app/(app)/dev/cards/__tests__/composed-card-fixtures.test.ts"`
Expected: FAIL — `COMPOSED_CARD_FIXTURES` not exported.

- [ ] **Step 4: Mount the fixtures in the gallery**

In `page.tsx`, add a Group B section that renders `COMPOSED_CARD_FIXTURES` through `<MessageBlocks body={COMPOSED_CARD_FIXTURES} />` — the same dispatch the thread uses, so the gallery cannot drift from production. **Leave `ambientBaseIndex` and `blockOrigins` unset** (`message-blocks.tsx:91` — the gallery must never mint colliding ledger ids).

- [ ] **Step 5: Run the test, then LOOK at it**

```bash
node node_modules/vitest/vitest.mjs run "src/app/(app)/dev/cards/__tests__/composed-card-fixtures.test.ts"
lsof -ti:3000 || npm run dev -- --port 3005
```

Open `http://localhost:3005/dev/cards`, screenshot the composed-card section, and check it against §0.5: one hero, no stacked ALL-CAPS ladder, one disclosure, one action bar, zero accent. **A passing test is not a look** — `overflow-check-false-pass` and `thread-never-scrolled` are both in this repo's history.

- [ ] **Step 6: Commit**

```bash
npx tsc --noEmit
git add "src/app/(app)/dev/cards/fixtures.ts" "src/app/(app)/dev/cards/page.tsx" "src/app/(app)/dev/cards/__tests__/composed-card-fixtures.test.ts"
git commit -m "feat(composed-card): one /dev/cards entry per recipe"
```

---

### Task 7: The `emit_card` tool + loop wiring

**Files:**
- Create: `src/lib/tools/emit-card-tool.ts`
- Modify: `src/lib/tools/chat-agent-loop.ts`
- Test: `src/lib/tools/__tests__/emit-card-tool.test.ts`

**Interfaces:**
- Consumes: `parseComposedCard` (Task 1), `materializeReceipts` (Task 3).
- Produces: `EMIT_CARD_TOOL` (the OpenAI-compatible function definition) and
  `handleEmitCard(rawArgs: unknown, deps?: { materialize?: typeof materializeReceipts }): Promise<{ blocks: ComposedCardBlock[]; error?: string }>`.

> **Pattern to follow:** `src/lib/grounding/corpus-tool.ts` — a free, model-facing tool that is **not** a billed `SkillTool`. `emit_card` renders; it does not spend. Do not register it in the skills array.

> **One repair attempt, then prose (spec §5).** If `parseComposedCard` fails twice, return no block and let the model answer in prose — never a broken card.

> 🔴 **G3 (found reviewing Task 1) — repair `cards` HERE, or the measured spike failure stays unhandled.**
> Spec §4.2: *"before validation, a `cards` value arriving as a string is re-parsed once"* — and §2.1 failure 2 is exactly that, measured: flash sent `cards` as a JSON **string** instead of an array. Task 1's `repairArrayField` covers `body` and `disclosure` **inside** one card; nothing repairs the `cards` array itself, and this tool is the only place that sees it. Repair `rawArgs.cards` before iterating, or the one double-encode the spike actually observed still drops the whole answer.

> **Enforce `cardCount` here (G1).** `RECIPES[recipe].cardCount` is declared in Task 1b and corrected in Task 1c — read the corrected values. Cards in one call must share a recipe. It is a **ceiling**: the floor is 1 for every recipe, so in practice this rejects a model emitting twenty cards, never a creator asking for one. If the count exceeds `max`, return no blocks and an error naming the limit so the model can retry.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/tools/__tests__/emit-card-tool.test.ts
import { describe, it, expect } from "vitest";
import { handleEmitCard } from "@/lib/tools/emit-card-tool";

const noReceipts = async () => new Map();

describe("handleEmitCard", () => {
  it("returns a validated block for a well-formed card", async () => {
    const r = await handleEmitCard(
      { cards: [{ recipe: "brief", deliverable: { kind: "claim", text: "Ship it ugly." },
                  body: [{ kind: "bullets", items: ["Post before it is ready."] }] }] },
      { materialize: noReceipts },
    );
    expect(r.blocks.length).toBe(1);
    expect(r.blocks[0]?.type).toBe("composed-card");
  });

  it("returns no block and an error the model can act on when the recipe is violated", async () => {
    const r = await handleEmitCard(
      { cards: [{ recipe: "script", deliverable: { kind: "claim", text: "x" },
                  body: [{ kind: "bullets", items: ["y"] }] }] },
      { materialize: noReceipts },
    );
    expect(r.blocks.length).toBe(0);
    expect(r.error).toMatch(/script_timeline/);
  });

  it("materializes receipts for every receiptRef the model named (D7)", async () => {
    const called: string[][] = [];
    const materialize = async (ids: string[]) => {
      called.push(ids);
      return new Map([["row-1", { handle: "a", videoUrl: null, coverUrl: null, hookTemplate: null,
                                  archetype: null, multiplier: 4, views: 10, baselineLabel: "vs their usual views",
                                  fitLabel: null }]]);
    };
    await handleEmitCard(
      { cards: [{ recipe: "teardown", deliverable: { kind: "claim", text: "x" },
                  receiptRef: "row-1",
                  body: [{ kind: "proof_strip", receiptRefs: ["row-1"] },
                         { kind: "beats", items: [{ label: "a", text: "b" }, { label: "c", text: "d" }] }] }] },
      { materialize },
    );
    expect(called[0]).toContain("row-1");
  });

  it("repairs a `cards` array that arrived as a JSON string (spike failure 2, measured)", async () => {
    const cards = [{ recipe: "brief", deliverable: { kind: "claim", text: "Ship it ugly." },
                     body: [{ kind: "bullets", items: ["Post before it is ready."] }] }];
    const r = await handleEmitCard({ cards: JSON.stringify(cards) }, { materialize: noReceipts });
    expect(r.blocks.length).toBe(1);
  });

  it("accepts a single hook — the ask 'just one example hook' is real and common", async () => {
    const r = await handleEmitCard(
      { cards: [{ recipe: "hook-set", deliverable: { kind: "line", text: "I lost £200 a month to Deliveroo." },
                  body: [{ kind: "note", text: "x" }] }] },
      { materialize: noReceipts },
    );
    expect(r.blocks.length).toBe(1);
  });

  it("rejects a card count above the recipe's ceiling", async () => {
    const one = { recipe: "hook-set", deliverable: { kind: "line", text: "A line." },
                  body: [{ kind: "note", text: "x" }] };
    const r = await handleEmitCard(
      { cards: Array.from({ length: 6 }, () => one) },   // hook-set tops out at 5
      { materialize: noReceipts },
    );
    expect(r.blocks.length).toBe(0);
    expect(r.error).toMatch(/5/);
  });

  it("never lets a model-authored handle into a block", async () => {
    const r = await handleEmitCard(
      { cards: [{ recipe: "brief", deliverable: { kind: "claim", text: "x" },
                  body: [{ kind: "bullets", items: ["y"] }],
                  handle: "@fabricated" }] },
      { materialize: noReceipts },
    );
    expect(JSON.stringify(r.blocks)).not.toContain("fabricated");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/emit-card-tool.test.ts`
Expected: FAIL — cannot resolve `@/lib/tools/emit-card-tool`.

- [ ] **Step 3: Implement the tool**

> **Attach receipts to `props.receipts` (Task 5b's field), keyed by row id.** `parseComposedCard` deletes any model-supplied value, so attach **after** parsing, on the validated block. This is the only writer of that field.

Write `emit-card-tool.ts` exporting:
- `EMIT_CARD_TOOL` — the function definition. Its `description` must carry the recipe list, the slot vocabulary with one line each (copy the shape from `spike-slot-composer.ts:168-180`, minus `actions`), and this sentence verbatim: *"Use `proof_strip` ONLY with teardown row ids that search_corpus actually returned — never invent one, and never write a creator handle yourself."*
- `handleEmitCard` — for each card: wrap as `{ type: "composed-card", props: card }`, run `parseComposedCard`, collect `receiptRef` + every `proof_strip.receiptRefs`, call `materializeReceipts` once for the union, attach the resolved receipts to props, and return the blocks. Zod strips unknown keys, which is what keeps a model-authored `handle` out of the block — assert it, do not assume it.

Then wire it into `chat-agent-loop.ts` alongside the other non-skill tools, routing each returned block to `input.onBlock(block)` the same way `skill.run`'s blocks are routed at line 1234.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node node_modules/vitest/vitest.mjs run src/lib/tools/__tests__/emit-card-tool.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Full suite, typecheck, build, commit**

```bash
npx tsc --noEmit
node node_modules/vitest/vitest.mjs run
npm run build
git add src/lib/tools/emit-card-tool.ts src/lib/tools/chat-agent-loop.ts src/lib/tools/__tests__/emit-card-tool.test.ts
git commit -m "feat(composed-card): emit_card tool wired into the agent loop"
```

> `npm run build` is required here specifically: `surfaces-import-breaks-prod-build` records a case where `tsc` was clean and the suite green while `npm run build` failed.

---

### Task 8: Re-run the spike against the shipped contract

**Files:**
- Modify: `scripts/spike-slot-composer.ts`
- Create: `docs/superpowers/specs/2026-08-11-composed-card-spike-rerun.md` (the measured result)

**Interfaces:**
- Consumes: `SlotSchema`, `RECIPES`, `parseComposedCard` (Task 1); `EMIT_CARD_TOOL` (Task 7).
- Produces: a measured comparison against the §2.1 baseline, and the flash-vs-plus model call.

> **B2 applies here.** The spike's v0 tool has `actions` as an 11th slot; the shipped contract makes it a card field. Once the spike imports the shipped schema, the `distinctSlotKinds` figure is **not comparable** to the §2.1 baseline. Report the dimensions that ARE comparable (card emitted, schema-valid, fabricated handles, avg prose) and say plainly that slot-kind counts changed basis.

- [ ] **Step 1: Point the spike at the shipped contract**

Replace the spike's local `SlotSchema` / `CardSchema` / `EMIT_CARD_TOOL` with imports from `@/lib/tools/composed-card-schema` and `@/lib/tools/emit-card-tool`, so the harness measures what ships. Keep the 6 asks and both models unchanged — that is what makes the comparison meaningful at all.

- [ ] **Step 2: Add the hero assertion the spike could not make before**

The spike's headline finding was that **both models failed the hero rule and every failure passed schema validation** (§2.1 finding 1). D6 is supposed to fix that. Add a check that, for `hook-set`, `deliverable.text` is a usable hook line rather than a label — a practical proxy: it contains a space and is not Title-Cased throughout. Record the pass rate; this is the number that says whether D6 worked.

- [ ] **Step 3: Run it**

```bash
node node_modules/tsx/dist/cli.mjs scripts/spike-slot-composer.ts
```

Live DashScope + real pgvector. Zero Apify. Output lands in `.spike-out/` (gitignored).

- [ ] **Step 4: Write up the result**

Record in `docs/superpowers/specs/2026-08-11-composed-card-spike-rerun.md`: the comparable dimensions vs the §2.1 baseline, the D6 hero pass rate, which model tier the numbers support, and — explicitly — that slot-kind counts changed basis (B2). **If flash still fails the hero rule, say so and do not ship the recipe as "fixed"** — that is the finding, not a failure of the run.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add scripts/spike-slot-composer.ts docs/superpowers/specs/2026-08-11-composed-card-spike-rerun.md
git commit -m "test(composed-card): re-run the composition spike against the shipped contract"
```

---

### Task 9: Align the Discover feed to the one band rule (B1)

**Files:**
- Modify: `src/lib/discover/corpus-reads.ts:33` (re-point the constant), `:183` (clamp), `:215` (drop the exclusion)
- Test: `src/lib/discover/__tests__/corpus-reads-band.test.ts`

**Interfaces:**
- Consumes: `MAX_PRINTABLE_MULTIPLIER` (Task 3).
- Produces: no new exports. `EXTREME_MULTIPLIER` becomes a re-export of the grounding constant so existing importers keep compiling.

> **This is a shipped-surface behaviour change, and the only task here that is.** It is scope the Phase 2 spec did not ask for — it is the cost of B1's "one rule" ruling. Land it last, after Tasks 1–8 are green, so a reviewer can reject it without losing the composer.

> ⚠️ **The honesty flag does NOT change.** `CorpusVideo.extreme` and `MultiplierChip`'s ⚠ + non-proven tone (`discover-primitives.tsx:78`) stay exactly as they are. Clamping the printed number does not make a thin baseline trustworthy — the row is shown, flagged, and still never rendered in proven green. Only *which rows reach the feed* and *what number prints* change.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/discover/__tests__/corpus-reads-band.test.ts
import { describe, it, expect } from "vitest";
import { EXTREME_MULTIPLIER } from "@/lib/discover/corpus-reads";
import { MAX_PRINTABLE_MULTIPLIER } from "@/lib/grounding/outlier-gate";

describe("the band rule is stated once", () => {
  it("discover's threshold IS the grounding constant, not a second literal", () => {
    expect(EXTREME_MULTIPLIER).toBe(MAX_PRINTABLE_MULTIPLIER);
  });
});
```

Add a second test around `toCorpusVideo` asserting a 20,154× row yields `multiplier === MAX_PRINTABLE_MULTIPLIER` and `extreme === true`. If `toCorpusVideo` is not exported, export it — a pure mapper is the right unit to test, and reaching it through `getDiscoverCorpus` would need a live DB.

- [ ] **Step 2: Run to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/discover/__tests__/corpus-reads-band.test.ts`
Expected: FAIL — `MAX_PRINTABLE_MULTIPLIER` not exported yet, or the mapper does not clamp.

- [ ] **Step 3: Make the three changes**

In `corpus-reads.ts`:
1. Replace `export const EXTREME_MULTIPLIER = 100;` with a re-export of the grounding constant, keeping the name so importers (`discover-primitives.tsx`) are untouched:
   ```ts
   import { MAX_PRINTABLE_MULTIPLIER } from "@/lib/grounding/outlier-gate";
   /** Re-exported so Discover and the composed card cannot disagree about the band (B1). */
   export const EXTREME_MULTIPLIER = MAX_PRINTABLE_MULTIPLIER;
   ```
2. At `:183`, clamp the printed multiplier while keeping `extreme` keyed off the RAW value — the flag is about the baseline, not the display.
3. At `:215`, change `.filter((t) => t.proven && !t.extreme)` to `.filter((t) => t.proven)`. Update the header comment at `:13-15`, which currently states extreme rows are *"kept OUT of the outliers feed entirely"* — that sentence becomes false with this change and would mislead the next reader.

- [ ] **Step 4: Run the discover suite**

```bash
node node_modules/vitest/vitest.mjs run src/lib/discover src/components/discover
```

- [ ] **Step 5: LOOK at the feed**

Open `/discover` on the dev server. Confirm previously-excluded rows now appear, print `100×+`, and still carry the ⚠ chip rather than proven green. The feed gained ~31 rows; a screenshot is the check that they read as flagged, not as proof.

- [ ] **Step 6: Full gates, then commit**

```bash
npx tsc --noEmit
node node_modules/vitest/vitest.mjs run
npm run build
git add src/lib/discover/corpus-reads.ts src/lib/discover/__tests__/corpus-reads-band.test.ts
git commit -m "fix(discover): one band rule — clamp above 100x instead of dropping the row"
```

---

## Self-Review

**Spec coverage (§4.2):** block type → Task 1; 10 slots → Tasks 1 + 4; recipe registry → Task 1; `deliverable` typed field (D6) → Task 1 + verified in Task 8; `receiptRef` server-materialized (D7) → Task 3; spine ordering (D8) → Task 5; `actions` closed enum → Task 1 + 5; arg repair → Task 1; multiplier band (D4, superseded by B1) → Task 3 + Task 9. §6 testing: recipe validation ✅, arg repair ✅, spine ordering ✅, clamping ✅, receipt materialization ✅, model handles never reach the DOM ✅ (Task 7 step 1), `/dev/cards` per recipe ✅, spike re-run ✅.

**Task order and dependencies — REVISED to keep `tsc` green at every commit:**

`1 → 1b → 1c → 3 → 4 → (2+5 together) → 6 → 7 → 8 → 9`

The plan's original `2 → 3 → 4 → 5` would leave the build **red** across three commits: `BLOCK_COMPONENTS` in `message-blocks.tsx` is typed `Record<BlockType, …>`, so the moment Task 2 adds `"composed-card"` to `BLOCK_REGISTRY`, `tsc` fails until Task 5's renderer exists. That is the type system doing its job — the two maps are meant to be inseparable — so the fix is to sequence around it, not to weaken the type.

Task 3 (receipt materialization) and Task 4 (slot renderers) are both independent of the registry and stay green on their own. **Tasks 2 and 5 are then executed and committed as one unit.** Task 9 stays last: it is the only shipped-surface change and gets its own review gate.

**Known gaps, stated rather than hidden:**
- **`proof_strip` playable video is deferred.** §4.2 says it reuses `retention-scrubber`; Task 4 renders attributed receipts and delegates the player to a follow-up. Called out in Task 4.
- **Decode write-back idempotency** (§6 bullet 2) belongs to Phase 1, not here — Phase 2 reads the corpus, never writes it.
- **Live end-to-end scrape** (§6 last bullet) is Phase 1's verification; Phase 2 needs no scrape, which is exactly why it is buildable now.

**Type consistency:** `parseComposedCard` returns `{ok,reason}` in Tasks 1, 6, 7. `materializeReceipts(ids, deps)` returns `Map<string, HookProof>` in Tasks 3, 4, 7. `Slot` / `SlotKind` / `RecipeId` / `ActionId` are defined once in Task 1 and imported everywhere else.
