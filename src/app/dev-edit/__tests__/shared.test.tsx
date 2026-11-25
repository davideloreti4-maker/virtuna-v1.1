/** @vitest-environment happy-dom */
/**
 * shared.test.tsx — the job reader the dev pages share (`useJob`), run for real with only the network stood in (`fetch`) and
 * the clock moved by hand. Without a bound it is the worker page's reader, as it always was: every failed read is tried
 * again, for ever, and only a job that is not there stops it. With a bound (the agent's page, whose download must not be
 * waited on for ever) it gives up after so many failed reads in a row, at once when the creator is no longer let in, and says
 * at which status.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJob } from "../shared";

type Answer = { status: number; body: unknown } | "down";
const running = (progress: number): Answer => ({ status: 200, body: { status: "running", stage: "rendering", progress, error: null } });
const DONE: Answer = { status: 200, body: { status: "done", stage: null, progress: 1, error: null, filmUrl: "https://films.example/film.mp4" } };
const BROKEN: Answer = { status: 500, body: { error: "something went wrong" } };

/** `fetch`, answering each read from the list in order (the last one again once the list is spent), and counting the reads. */
function network(answers: Answer[]): { reads: () => number; paths: string[] } {
  const paths: string[] = [];
  vi.stubGlobal("fetch", async (path: string) => {
    paths.push(path);
    const answer = answers.length > 1 ? answers.shift()! : answers[0]!;
    if (answer === "down") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { "Content-Type": "application/json" } });
  });
  return { reads: () => paths.length, paths };
}

/** The clock moved on, with every read that falls due answered. */
const pass = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useJob, as the worker page uses it (no bound)", () => {
  it("reads the job every second until it has ended", async () => {
    const net = network([running(0.2), running(0.6), DONE]);
    const { result } = renderHook(() => useJob("job-1"));
    await pass(0);
    expect(result.current.job).toMatchObject({ status: "running", progress: 0.2 });
    await pass(1000);
    expect(result.current.job).toMatchObject({ progress: 0.6 });
    await pass(1000);
    expect(result.current).toMatchObject({ job: { status: "done", filmUrl: "https://films.example/film.mp4" }, unread: null, lost: null });
    await pass(60_000);
    expect(net.reads()).toBe(3);
    expect(net.paths[0]).toBe("/api/edit/jobs/job-1");
  });

  it("tries a failed read again for as long as it fails, later each time, and says so; a good read ends the saying", async () => {
    const net = network([running(0.2), BROKEN, "down", BROKEN, BROKEN, BROKEN, BROKEN, BROKEN, running(0.9)]);
    const { result } = renderHook(() => useJob("job-1"));
    await pass(0);
    await pass(1000); // the first failed read
    expect(result.current).toMatchObject({ job: { progress: 0.2 }, unread: "the job could not be read (something went wrong); reading it again", lost: null });
    await pass(1000 + 2000 + 4000 + 8000 + 15_000 + 15_000); // six more failed reads: nothing gives up
    expect(net.reads()).toBe(8);
    expect(result.current.lost).toBeNull();
    expect(result.current.unread).toMatch(/reading it again$/);
    await pass(15_000);
    expect(result.current).toMatchObject({ job: { progress: 0.9 }, unread: null, lost: null });
  });

  it("stops at a job that is not there", async () => {
    const net = network([{ status: 404, body: { error: "no such job" } }]);
    const { result } = renderHook(() => useJob("job-1"));
    await pass(0);
    expect(result.current).toEqual({ job: null, unread: "this job is not there", lost: 404 });
    await pass(60_000);
    expect(net.reads()).toBe(1);
  });

  it("shows nothing of one job as another's, and nothing with no job", async () => {
    network([DONE]);
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useJob(id), { initialProps: { id: "job-1" as string | null } });
    await pass(0);
    expect(result.current.job).toMatchObject({ status: "done" });
    rerender({ id: "job-2" });
    expect(result.current).toEqual({ job: null, unread: null, lost: null }); // before job-2 is read: not job-1's film
    rerender({ id: null });
    expect(result.current).toEqual({ job: null, unread: null, lost: null });
  });
});

describe("useJob with a bound (the agent's page)", () => {
  const bound = { most: 5 };

  it("gives up after five failed reads in a row, 15 s after the first, with the status it stopped at, and reads no more", async () => {
    const net = network([running(0.4), BROKEN]);
    const { result } = renderHook(() => useJob("job-1", bound));
    await pass(0);
    await pass(1000); // the first failed read
    expect(result.current.lost).toBeNull();
    await pass(1000 + 2000 + 4000); // the second, third and fourth
    expect(result.current.lost).toBeNull();
    expect(net.reads()).toBe(5);
    await pass(8000); // the fifth
    expect(result.current).toMatchObject({ job: { progress: 0.4 }, unread: "the job could not be read (something went wrong)", lost: 500 });
    expect(net.reads()).toBe(6);
    await pass(120_000);
    expect(net.reads()).toBe(6);
  });

  it("counts a call that never got there like any failed read, and stops at status 0", async () => {
    network(["down"]);
    const { result } = renderHook(() => useJob("job-1", bound));
    await pass(0);
    await pass(1000 + 2000 + 4000 + 8000);
    expect(result.current.lost).toBe(0);
  });

  it("starts the count again at a good read: four failed, one good, four failed is not yet given up", async () => {
    const net = network([BROKEN, BROKEN, BROKEN, BROKEN, running(0.5), BROKEN, BROKEN, BROKEN, BROKEN, running(0.8)]);
    const { result } = renderHook(() => useJob("job-1", bound));
    await pass(0);
    await pass(1000 + 2000 + 4000 + 8000); // the good read, after four failed
    expect(result.current).toMatchObject({ job: { progress: 0.5 }, lost: null });
    await pass(1000 + 1000 + 2000 + 4000 + 8000);
    expect(result.current).toMatchObject({ job: { progress: 0.8 }, lost: null });
    expect(net.reads()).toBe(10);
  });

  it.each([401, 403])("gives up at once when the creator is no longer let in (%i)", async (status) => {
    const net = network([running(0.4), { status, body: { error: "sign in to use the edit tool" } }]);
    const { result } = renderHook(() => useJob("job-1", bound));
    await pass(0);
    await pass(1000);
    expect(result.current.lost).toBe(status);
    await pass(60_000);
    expect(net.reads()).toBe(2);
  });

  it("reads the same job anew when asked again, from nothing", async () => {
    const net = network([{ status: 401, body: { error: "sign in to use the edit tool" } }, DONE]);
    const { result, rerender } = renderHook(({ again }: { again: number }) => useJob("job-1", { most: 5, again }), { initialProps: { again: 0 } });
    await pass(0);
    expect(result.current.lost).toBe(401);
    rerender({ again: 1 });
    expect(result.current).toEqual({ job: null, unread: null, lost: null });
    await pass(0);
    expect(result.current).toMatchObject({ job: { status: "done", filmUrl: "https://films.example/film.mp4" }, lost: null });
    expect(net.reads()).toBe(2);
  });

  it("stops at a job that is not there, as without a bound", async () => {
    network([{ status: 404, body: { error: "no such job" } }]);
    const { result } = renderHook(() => useJob("job-1", bound));
    await pass(0);
    expect(result.current.lost).toBe(404);
  });
});
