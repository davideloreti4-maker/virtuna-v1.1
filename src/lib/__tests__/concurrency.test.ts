/**
 * concurrency.test.ts — invariants for mapWithConcurrency: it processes every item exactly once,
 * never exceeds the in-flight limit, and (via the shared cursor) keeps runners busy rather than
 * lock-stepping. This is the guard behind the refresh-competitors batch fitting its function window.
 */
import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "../concurrency";

/** A deferred promise whose resolve we control, to hold workers "in flight" deterministically. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("mapWithConcurrency", () => {
  it("processes every item exactly once, preserving index", async () => {
    const seen: Array<{ item: number; index: number }> = [];
    await mapWithConcurrency([10, 20, 30, 40], 2, async (item, index) => {
      seen.push({ item, index });
    });
    expect(seen.sort((a, b) => a.index - b.index)).toEqual([
      { item: 10, index: 0 },
      { item: 20, index: 1 },
      { item: 30, index: 2 },
      { item: 40, index: 3 },
    ]);
  });

  it("never exceeds the concurrency limit and drains all items", async () => {
    const gates = Array.from({ length: 6 }, deferred);
    let inFlight = 0;
    let peak = 0;
    const completed: number[] = [];

    const run = mapWithConcurrency(gates, 2, async (gate, index) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await gate.promise;
      completed.push(index);
      inFlight--;
    });

    // Let microtasks settle so the initial pool has started, then release gates one at a time.
    for (let i = 0; i < gates.length; i++) {
      await Promise.resolve();
      expect(inFlight).toBeLessThanOrEqual(2);
      gates[i]!.resolve();
    }
    await run;

    expect(peak).toBe(2); // exactly the limit, never more
    expect(completed).toHaveLength(6);
    expect([...completed].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("handles fewer items than the limit (pool sizes to item count)", async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2], 10, async (item) => {
      seen.push(item);
    });
    expect(seen.sort()).toEqual([1, 2]);
  });

  it("is a no-op on an empty list", async () => {
    let calls = 0;
    await mapWithConcurrency([], 4, async () => {
      calls++;
    });
    expect(calls).toBe(0);
  });

  it("rejects a limit below 1", async () => {
    await expect(mapWithConcurrency([1], 0, async () => {})).rejects.toThrow(/limit/);
  });
});
