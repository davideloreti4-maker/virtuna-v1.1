import { describe, it, expect } from "vitest";
import { COMPOSED_CARD_FIXTURES, COMPOSED_CARD_SECTIONS } from "../fixtures";
import { parseComposedCard, RECIPES } from "@/lib/tools/composed-card-schema";

/**
 * Drift guard for the composed-card gallery.
 *
 * The sibling `fixtures.test.ts` validates every fixture through `validateBlock`, which is
 * SHAPE-ONLY: the registry entry is `ComposedCardBlockSchema`, and recipe legality (required slots,
 * legal slots, the typed deliverable kind) lives in `parseComposedCard`. So a fixture could pass the
 * registry while being a card the composer can never emit — a gallery showing an impossible shape is
 * worse than no gallery, because it is the reference a design session measures against. This file
 * runs the REAL model-facing validator over each one.
 */
describe("composed-card gallery fixtures", () => {
  it("covers every recipe", () => {
    const covered = new Set(COMPOSED_CARD_FIXTURES.map((f) => f.props.recipe));
    expect(covered.size).toBe(Object.keys(RECIPES).length);
    for (const id of Object.keys(RECIPES)) expect(covered.has(id as never), id).toBe(true);
  });

  it("every fixture passes the real validator", () => {
    for (const f of COMPOSED_CARD_FIXTURES) {
      const r = parseComposedCard(f);
      expect(r.ok, `${f.props.recipe}: ${r.ok ? "" : r.reason}`).toBe(true);
    }
  });

  it("every fixture has a gallery header", () => {
    for (const f of COMPOSED_CARD_FIXTURES) {
      expect(COMPOSED_CARD_SECTIONS[f.props.recipe]?.label, f.props.recipe).toBeTruthy();
      expect(COMPOSED_CARD_SECTIONS[f.props.recipe]?.note, f.props.recipe).toBeTruthy();
    }
  });

  it("at least one fixture carries a materialized receipt, and one a disclosure", () => {
    // Both are rows of the card contract (§0.5 rows 3 and 6) that render only when data is present.
    // Unpreviewed, they are exactly the rows that drift unseen — and `props.receipts` in particular
    // is the field whose absence silently emptied every teardown before Task 5b.
    expect(COMPOSED_CARD_FIXTURES.some((f) => Object.keys(f.props.receipts ?? {}).length > 0)).toBe(true);
    expect(COMPOSED_CARD_FIXTURES.some((f) => (f.props.disclosure ?? []).length > 0)).toBe(true);
  });

  it("no fixture claims an audience fit — materializeReceipts never measures one", () => {
    // `materializeReceipts` hard-codes `fitLabel: null` (§0.5b: a fit glyph is a claim retrieval
    // earns). A fixture with ●/◐/○ would preview a receipt the composer cannot produce.
    for (const f of COMPOSED_CARD_FIXTURES) {
      for (const [id, proof] of Object.entries(f.props.receipts ?? {})) {
        expect(proof.fitLabel, `${f.props.recipe}/${id}`).toBeNull();
      }
    }
  });

  it("no fixture prints a multiplier without a basis (D9)", () => {
    for (const f of COMPOSED_CARD_FIXTURES) {
      for (const [id, proof] of Object.entries(f.props.receipts ?? {})) {
        if (proof.multiplier !== null) expect(proof.baselineLabel, `${f.props.recipe}/${id}`).toBeTruthy();
      }
    }
  });

  it("every receipt id a fixture names is either materialized or deliberately absent", () => {
    // Not an equality check: the teardown fixture names a ref with no row ON PURPOSE, because an
    // unresolvable id must render nothing rather than a placeholder tile. What must never happen is
    // the reverse — a receipts map carrying a row no slot or `receiptRef` ever asks for, which would
    // be a receipt the card pays to persist and never shows.
    for (const f of COMPOSED_CARD_FIXTURES) {
      const named = new Set<string>(f.props.receiptRef ? [f.props.receiptRef] : []);
      for (const slot of [...f.props.body, ...(f.props.disclosure ?? [])]) {
        if (slot.kind === "proof_strip") for (const ref of slot.receiptRefs) named.add(ref);
      }
      for (const id of Object.keys(f.props.receipts ?? {})) {
        expect(named.has(id), `${f.props.recipe}: receipts["${id}"] is never referenced`).toBe(true);
      }
    }
  });
});
