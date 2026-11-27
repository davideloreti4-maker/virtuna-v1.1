/**
 * let-go-runs: a run let go (a thread switch, or leaving /home) reads to its end in the background,
 * but not without end: its request is ended after the route's own limit (maxDuration 300 s, plus a
 * margin), and at most three are held at once (a fourth ends the oldest).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { holdLetGo, LET_GO_LIMIT_MS, LET_GO_MAX } from "@/lib/thread-next/let-go-runs";

afterEach(() => {
  vi.useRealTimers();
});

describe("holdLetGo", () => {
  it("ends a request still held at the limit, and not before", () => {
    vi.useFakeTimers();
    const run = new AbortController();
    const release = holdLetGo(run);
    expect(LET_GO_LIMIT_MS).toBe(330_000);
    vi.advanceTimersByTime(LET_GO_LIMIT_MS - 1);
    expect(run.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(run.signal.aborted).toBe(true);
    release();
  });

  it("a request released (it ended) is never aborted later", () => {
    vi.useFakeTimers();
    const run = new AbortController();
    holdLetGo(run)();
    vi.advanceTimersByTime(LET_GO_LIMIT_MS * 2);
    expect(run.signal.aborted).toBe(false);
  });

  it("a long hold (a Test simulation's run) is kept out of the three-slot FIFO, with its own limit", () => {
    vi.useFakeTimers();
    const test = new AbortController();
    const releaseTest = holdLetGo(test, { long: true });
    const others = [0, 1, 2, 3].map(() => new AbortController());
    const releases = others.map((r) => holdLetGo(r));
    expect(test.signal.aborted).toBe(false);
    // The FIFO still counts only the one-argument holds: a fourth of them ends their oldest.
    expect(others.map((r) => r.signal.aborted)).toEqual([true, false, false, false]);
    // The same limit as every hold: the analyze route's maxDuration (300 s) plus a margin.
    expect(LET_GO_LIMIT_MS).toBe(330_000);
    vi.advanceTimersByTime(LET_GO_LIMIT_MS - 1);
    expect(test.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(test.signal.aborted).toBe(true);
    releaseTest();
    releases.forEach((r) => r());
  });

  it("a long hold released (its run ended) is never aborted later", () => {
    vi.useFakeTimers();
    const test = new AbortController();
    holdLetGo(test, { long: true })();
    vi.advanceTimersByTime(LET_GO_LIMIT_MS * 2);
    expect(test.signal.aborted).toBe(false);
  });

  it("holds three at most: a fourth ends the oldest", () => {
    vi.useFakeTimers();
    expect(LET_GO_MAX).toBe(3);
    const runs = [0, 1, 2, 3].map(() => new AbortController());
    const releases = runs.map((r) => holdLetGo(r));
    expect(runs.map((r) => r.signal.aborted)).toEqual([true, false, false, false]);
    releases.forEach((r) => r());
  });
});
