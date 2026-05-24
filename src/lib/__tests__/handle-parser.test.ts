import { describe, it, expect } from "vitest";
import { normalizeHandle } from "@/lib/schemas/competitor";

// Wave 0 scaffold for the Card 5 reference-creator add-flow.
// Plan 02-03 will assert these cases against `normalizeHandle` reuse (no new parser file).

describe("normalizeHandle (reused for Card 5 reference creators)", () => {
  it("extracts handle from a tiktok.com URL", () => {
    expect(normalizeHandle("https://tiktok.com/@charlidamelio")).toBe("charlidamelio");
  });

  it("strips leading @ and lowercases bare handles", () => {
    expect(normalizeHandle("@AddisonRae")).toBe("addisonrae");
  });

  it.skip("returns the same value for a bare lowercase handle", () => {
    // TODO(02-03): wired by reference-creators-input.tsx tests in Plan 02-03
    expect(normalizeHandle("user123")).toBe("user123");
  });
});
