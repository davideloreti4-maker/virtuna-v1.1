/**
 * composed-card registration — the two-map lockstep (BLOCK_REGISTRY + BLOCK_COMPONENTS).
 *
 * `message-blocks.tsx` re-validates EVERY block through `validateBlock` on render (D-14), so
 * registration is not bookkeeping: an unregistered type renders as <UnsupportedBlock> no matter
 * what the emit path produced. What this file pins beyond "the key is there":
 *
 *  1. **Registry validation is SHAPE-ONLY.** `parseComposedCard` is the recipe gate and it lives at
 *     the emit boundary; the registry holds the raw `ComposedCardBlockSchema`. A card that satisfies
 *     the shape but violates its recipe therefore PASSES here. That is deliberate — a persisted card
 *     must keep rendering even if a recipe's `legalSlots` is later narrowed — and it is exactly the
 *     kind of split a reader would otherwise mistake for a hole.
 *
 *  2. **The schema STRIPS keys it does not declare.** `validateBlock` returns `parsed.data`, and a
 *     zod object strips by default. That is what keeps a model-authored `handle` out of the DOM —
 *     and it is why a server-materialized receipt had to become a DECLARED field (`props.receipts`,
 *     Task 5b) rather than a key smuggled onto props: as an undeclared key it was deleted here, on
 *     every render, silently. Both directions are pinned below because the mechanism is one
 *     mechanism and the two consequences pull opposite ways.
 */
import { describe, it, expect } from "vitest";
import { validateBlock, BLOCK_REGISTRY } from "@/lib/tools/block-registry";
import type { HookProof } from "@/lib/tools/proof-schema";

const PROOF: HookProof = {
  handle: "corporate.bro",
  videoUrl: null,
  coverUrl: null,
  hookTemplate: null,
  archetype: null,
  multiplier: 5.7,
  views: 1_400_000,
  baselineLabel: "vs their usual views",
  fitLabel: null,
};

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

  it("registry validation is shape-only — recipe legality is parseComposedCard's job", () => {
    // `script` requires a script_timeline slot. parseComposedCard rejects this; the registry does
    // not, because a persisted card must keep rendering after a recipe is narrowed.
    const r = validateBlock({
      type: "composed-card",
      props: {
        recipe: "script",
        deliverable: { kind: "claim", text: "Open on the cost, not the tip." },
        body: [{ kind: "bullets", items: ["x"] }],
      },
    });
    expect(r.ok).toBe(true);
  });

  it("strips a key the schema does not declare — nothing rides on props uninvited", () => {
    const r = validateBlock({
      type: "composed-card",
      props: {
        recipe: "brief",
        deliverable: { kind: "claim", text: "Ship it." },
        body: [{ kind: "bullets", items: ["x"] }],
        handle: "@fabricated",
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.block)).not.toContain("fabricated");
  });

  it("carries a DECLARED receipt through the render-time re-validation (Task 5b)", () => {
    // The other side of the same strip. Until `props.receipts` was declared this assertion was its
    // exact inverse — the receipt was deleted here, on every render, and a `teardown` rendered
    // asserting proof it never showed. This is the regression test for that.
    const r = validateBlock({
      type: "composed-card",
      props: {
        recipe: "brief",
        deliverable: { kind: "claim", text: "Ship it." },
        body: [{ kind: "bullets", items: ["x"] }],
        receipts: { "row-1": PROOF },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.block)).toContain("corporate.bro");
  });

  it("rejects a half-formed receipt instead of rendering a partial proof", () => {
    // Declaring the field means a malformed receipt now invalidates the whole block rather than
    // being quietly dropped — the card falls back to <UnsupportedBlock>. That is the shipped
    // precedent, not a new rule: `proof: HookProofSchema.nullable().optional()` sits inside four
    // card schemas (blocks.ts:291/386/471/534) with exactly the same consequence. A receipt with no
    // handle is not a receipt (§0.5b) and half a proof on screen is worse than an unrendered card.
    const r = validateBlock({
      type: "composed-card",
      props: {
        recipe: "brief",
        deliverable: { kind: "claim", text: "Ship it." },
        body: [{ kind: "bullets", items: ["x"] }],
        receipts: { "row-1": { multiplier: 5.7 } },
      },
    });
    expect(r.ok).toBe(false);
  });
});
