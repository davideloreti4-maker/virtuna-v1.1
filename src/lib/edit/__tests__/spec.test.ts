/**
 * spec.test.ts — what is and is not an EditSpec.
 *
 * Unknown keys are an error everywhere. A typo in a stored document or in an operation's payload
 * has to be refused, not dropped: a dropped key is a change that silently did not happen.
 */
import { describe, expect, it } from "vitest";
import { EditSpecSchema, parseEditSpec } from "../spec";
import { fixture } from "./fixture";

describe("parseEditSpec", () => {
  it("reads the fixture back unchanged", () => {
    expect(parseEditSpec(JSON.parse(JSON.stringify(fixture())))).toEqual(fixture());
  });

  it("refuses an unknown key anywhere", () => {
    const top = { ...fixture(), extra: 1 };
    expect(EditSpecSchema.safeParse(top).success).toBe(false);
    const deep = fixture();
    (deep.main[0] as unknown as Record<string, unknown>).colour = "red";
    expect(EditSpecSchema.safeParse(deep).success).toBe(false);
  });

  it("refuses a segment shorter than three frames, a speed out of range and a colour that is not hex", () => {
    const short = fixture();
    short.main[0]!.len = 2;
    expect(EditSpecSchema.safeParse(short).success).toBe(false);
    const fast = fixture();
    fast.main[0]!.speed = 5;
    expect(EditSpecSchema.safeParse(fast).success).toBe(false);
    const colour = fixture();
    colour.captions.style.color = "white";
    expect(EditSpecSchema.safeParse(colour).success).toBe(false);
  });

  it("refuses an edit with no segment, and a version it does not know", () => {
    expect(EditSpecSchema.safeParse({ ...fixture(), main: [] }).success).toBe(false);
    expect(() => parseEditSpec({ ...fixture(), v: 2 })).toThrow(/version 2/);
  });
});
