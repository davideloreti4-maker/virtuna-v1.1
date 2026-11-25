import { describe, expect, it } from "vitest";
import { timingStart, timingEnd, clockLabel } from "@/lib/thread-next/beat-timing";

describe("timingStart / timingEnd", () => {
  it.each<[string, number | null, number | null]>([
    ["0–3s", 0, 3],
    ["3-15s", 3, 15],
    ["0:03–0:08", 3, 8],
    ["15s", 15, null],
    ["0:20", 20, null],
    ["20 to 24s", 20, 24],
    ["Hook", null, null],
  ])("%s", (s, a, b) => {
    expect(timingStart(s)).toBe(a);
    expect(timingEnd(s)).toBe(b);
  });

  it.each<[string, number | null, number | null]>([
    ["0-3s", 0, 3],
    ["0:00–0:03", 0, 3],
    ["0:03-0:08", 3, 8],
    ["3–15s", 3, 15],
    ["0s–3s", 0, 3],
    [" 0 – 3 s ", 0, 3],
    ["1:05–1:15", 65, 75],
    ["20 TO 24S", 20, 24],
    ["", null, null],
    ["0–3s–5s", null, null],
    ["0:3", null, null],
    ["0:75", null, null],
    ["about 3s", null, null],
    ["3–", null, null],
    ["0 — 3s", null, null],
  ])("%j", (s, a, b) => {
    expect(timingStart(s)).toBe(a);
    expect(timingEnd(s)).toBe(b);
  });
});

describe("clockLabel", () => {
  it("labels", () => {
    expect(clockLabel(0)).toBe("0:00");
    expect(clockLabel(24)).toBe("0:24");
    expect(clockLabel(75)).toBe("1:15");
  });
  it("floors fractions and clamps nonsense to zero", () => {
    expect(clockLabel(9.9)).toBe("0:09");
    expect(clockLabel(600)).toBe("10:00");
    expect(clockLabel(-4)).toBe("0:00");
    expect(clockLabel(Number.NaN)).toBe("0:00");
  });
});
