/**
 * The stored text simulation behind a result page's key (`textSealOfKey`), shared by the hook result
 * endpoint and what Maven said about a posted piece. Pure; the real `sealHashOf` and `stopNumberOf`.
 */
import { describe, expect, it } from "vitest";

import { population } from "@/components/thread-next/__tests__/fixtures/answers";
import type { SimSeal, SimSealMap } from "@/lib/threads/sim-seals";
import { sealHashOf } from "../seal-hash";
import { textSealOfKey } from "../text-seal";

const AT = "2026-11-21T00:00:00.000Z";
const text = (stopPct: number): SimSeal => ({ pct: 70, band: null, at: AT, population: population(stopPct) });

describe("textSealOfKey", () => {
  it("finds the text seal whose result-page key is the key, with its text and the number its page shows", async () => {
    const seals: SimSealMap = { "First hook line": text(30), "Second hook line": text(22.4) };
    expect(await textSealOfKey(seals, await sealHashOf("Second hook line"))).toEqual({ text: "Second hook line", seal: seals["Second hook line"], number: 22 });
    expect(await textSealOfKey(seals, await sealHashOf("First hook line"))).toEqual({ text: "First hook line", seal: seals["First hook line"], number: 30 });
  });

  it("is null for a key no text of the map has", async () => {
    expect(await textSealOfKey({ "First hook line": text(30) }, await sealHashOf("Never simulated"))).toBeNull();
    expect(await textSealOfKey({}, await sealHashOf("First hook line"))).toBeNull();
  });

  it("never matches a video seal, nor a seal without a number", async () => {
    const video: SimSeal = { ...text(40), video: { analysisId: "vid_madeup01", stopPct: 46, craftScore: null, heatmap: { weighted_curve: [1, 0.5] } as never, videoSignals: null, verbatim: null } };
    const noPopulation: SimSeal = { pct: 60, band: null, at: AT };
    const noNumber: SimSeal = { pct: 60, band: null, at: AT, population: { total: 1000, segments: [], reasons: [] } as never };
    const seals: SimSealMap = { "A video": video, "No population": noPopulation, "No number": noNumber };
    for (const key of Object.keys(seals)) expect(await textSealOfKey(seals, await sealHashOf(key))).toBeNull();
  });
});
