/**
 * warrant.test.ts — guards on the SHARED citation contract (warrant.ts).
 *
 * The load-bearing block is "the provenance axis" below. Every one of those cases FAILS against the
 * obvious two-axis (topical/structural) lift of the chat tool's original `assessWarrant`, which is
 * exactly the regression they exist to stop: a freshly-scraped row carries `similarity: null`, a null
 * cannot clear a floor, so a two-axis assessment marks the run the user PAID Apify for as ungrounded.
 * Verified red against that implementation before landing (stash → run → confirm → pop).
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  assessWarrant,
  citableSubset,
  warrantFloor,
  warrantNote,
} from "@/lib/grounding/warrant";
import type { RetrievedExample } from "@/lib/grounding/types";

/** Minimal example — only `similarity` matters to the warrant, the rest is shape. */
function ex(similarity: number | null, handle = "creator"): RetrievedExample {
  return {
    handle,
    similarity,
    views: 1000,
    multiplier: null,
    baselineLabel: null,
    spokenHook: "hook",
    hookTemplate: "[x] template",
    hookArchetype: "question",
    format: null,
    visualSetting: null,
    editingStyle: null,
    niche: null,
    idea: null,
    template: null,
  } as unknown as RetrievedExample;
}

afterEach(() => {
  delete process.env.GROUNDING_WARRANT_MIN_SIMILARITY;
});

describe("warrantFloor", () => {
  it("defaults to the owner-calibrated 0.5", () => {
    expect(warrantFloor()).toBe(0.5);
  });

  it("honours a valid env override and ignores nonsense", () => {
    process.env.GROUNDING_WARRANT_MIN_SIMILARITY = "0.62";
    expect(warrantFloor()).toBe(0.62);
    process.env.GROUNDING_WARRANT_MIN_SIMILARITY = "not-a-number";
    expect(warrantFloor()).toBe(0.5);
    // Out of (0,1) is not a similarity — fall back rather than lock everything out.
    process.env.GROUNDING_WARRANT_MIN_SIMILARITY = "1.5";
    expect(warrantFloor()).toBe(0.5);
  });
});

describe("the provenance axis — freshly scraped rows stay grounded", () => {
  // orchestrator.ts sets `similarity: null` on every scraped row: it was never matched against a
  // query, so there is no cosine to state. Its warrant is the extraction pipeline, not closeness.
  it("grounds an unmeasured batch the CALLER declared as extracted", () => {
    const scraped = [ex(null), ex(null), ex(null)];
    const got = assessWarrant("provenance", scraped);
    expect(got.warrant).toBe("provenance");
    expect(got.grounded).toBe(true);
    // Nothing was measured, so nothing is claimed as measured — but that is absence, not failure.
    expect(got.onSubject).toBe(0);
    expect(got.measured).toBe(0);
  });

  it("keeps every provenance row citable — their warrant is extraction, not cosine", () => {
    const scraped = [ex(null), ex(null)];
    expect(citableSubset("provenance", scraped)).toHaveLength(2);
  });

  it("says the closeness is unquantified instead of implying it was measured", () => {
    const note = warrantNote("provenance", 0, 3);
    expect(note).toMatch(/real proven examples/i);
    expect(note).not.toMatch(/NOT GROUNDED/i);
  });

  /**
   * 🔴 The axis is DECLARED, never sniffed. An unmeasured batch that the caller called TOPICAL came
   * out of the corpus cache, where every row has a cosine — so a null there is a malfunction, not a
   * provenance signal, and it must not be waved through. This is #342's "absent is not passing"
   * guard, and it is the reason this module does not infer provenance from `measured === 0`.
   */
  it("does NOT grant provenance to an unmeasured batch that claimed the topical axis", () => {
    const got = assessWarrant("topical", [ex(null), ex(null)]);
    expect(got.warrant).toBe("none");
    expect(got.grounded).toBe(false);
  });

  it("does NOT let an unmeasured row rescue a measured-but-tangential batch", () => {
    const mixed = [ex(0.41), ex(0.39), ex(null)];
    const got = assessWarrant("topical", mixed);
    expect(got.warrant).toBe("none");
    expect(got.grounded).toBe(false);
  });
});

describe("the topical axis — cosine decides", () => {
  it("grounds when at least one row clears the floor", () => {
    const got = assessWarrant("topical", [ex(0.72), ex(0.31)]);
    expect(got).toMatchObject({ warrant: "topical", grounded: true, onSubject: 1, measured: 2 });
  });

  it("refuses when every row is below the floor — cosine always returns SOMETHING", () => {
    const got = assessWarrant("topical", [ex(0.44), ex(0.4), ex(0.38)]);
    expect(got).toMatchObject({ warrant: "none", grounded: false, onSubject: 0 });
    expect(warrantNote(got.warrant, got.onSubject, 3)).toMatch(/NOT GROUNDED/);
  });

  it("cites only the rows that cleared the floor, not the whole batch", () => {
    const batch = [ex(0.8, "kept"), ex(0.2, "dropped"), ex(0.55, "kept2")];
    expect(citableSubset("topical", batch).map((e) => e.handle)).toEqual(["kept", "kept2"]);
  });

  it("cites nothing at all on an ungrounded batch", () => {
    expect(citableSubset("none", [ex(0.44), ex(0.4)])).toEqual([]);
  });

  it("moves with the floor — a raised floor un-grounds a batch that used to pass", () => {
    const batch = [ex(0.55)];
    expect(assessWarrant("topical", batch).grounded).toBe(true);
    process.env.GROUNDING_WARRANT_MIN_SIMILARITY = "0.6";
    expect(assessWarrant("topical", batch).grounded).toBe(false);
  });
});

describe("the structural axis — curation warrants the shape, never the subject", () => {
  it("grounds on rows alone, including rows far under the topical floor", () => {
    // hooks retrieves at minSimilarity 0 on purpose (owner call 2026-07-14): structure transfers
    // across subjects. A low cosine is not a defect here, it is the point.
    const got = assessWarrant("structural", [ex(0.12), ex(0.08)]);
    expect(got).toMatchObject({ warrant: "structural", grounded: true, onSubject: 0 });
  });

  it("still reports onSubject as telemetry without letting it gate", () => {
    const got = assessWarrant("structural", [ex(0.9), ex(0.1)]);
    expect(got.onSubject).toBe(1);
    expect(got.grounded).toBe(true);
  });

  it("states the shape-only limit so a pattern is never cited as topic evidence", () => {
    const note = warrantNote("structural", 0, 2);
    expect(note).toMatch(/STRUCTURE/);
    expect(note).toMatch(/never as evidence about this specific topic/i);
  });
});

describe("the empty batch", () => {
  it("is none on either axis — nothing retrieved warrants nothing", () => {
    for (const axis of ["topical", "structural"] as const) {
      expect(assessWarrant(axis, [])).toMatchObject({
        warrant: "none",
        grounded: false,
        onSubject: 0,
        measured: 0,
      });
    }
  });
});
