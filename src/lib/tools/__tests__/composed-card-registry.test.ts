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
 *     zod object strips by default. This is what keeps a model-authored `handle` out of the DOM —
 *     and it is also why anything the SERVER wants to attach to a card (a materialized receipt) has
 *     to be a declared field, not a key smuggled onto props. Pinned here because it is load-bearing
 *     in both directions.
 */
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
        receipts: { "row-1": { handle: "corporate.bro" } },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(JSON.stringify(r.block)).not.toContain("fabricated");
      // The same mechanism drops a server-attached receipt: it must be a DECLARED field or it
      // never survives the render-time re-validation.
      expect(JSON.stringify(r.block)).not.toContain("corporate.bro");
    }
  });
});
