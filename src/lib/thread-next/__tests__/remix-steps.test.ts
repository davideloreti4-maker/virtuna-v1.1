import { describe, expect, it } from "vitest";
import { formatSteps } from "@/lib/thread-next/remix-steps";
import { REMIX_CAMERA } from "@/components/thread-next/__tests__/fixtures/answers";

describe("formatSteps", () => {
  it("splits on arrows, drops the prefix, keeps four", () => {
    expect(formatSteps("Borrowed: Visual Hook → Concept Definition → Tools Required → Footage")).toEqual(["Visual Hook", "Concept Definition", "Tools Required", "Footage"]);
    expect(formatSteps("A -> B → C → D → E")).toEqual(["A", "B", "C", "D"]);
  });
  it("reads the drawing's remix", () => {
    expect(formatSteps(REMIX_CAMERA.props.formatBorrowed)).toEqual(["Visual Hook", "Concept", "Tools", "Footage"]);
  });
  it("drops empty steps and a lower-case prefix", () => {
    expect(formatSteps("borrowed:  A →  → B ->")).toEqual(["A", "B"]);
  });
  it("one step without arrows", () => {
    expect(formatSteps("Talking head")).toEqual(["Talking head"]);
  });
  it("nothing gives nothing", () => {
    expect(formatSteps("")).toEqual([]);
    expect(formatSteps("Borrowed:")).toEqual([]);
  });
});
