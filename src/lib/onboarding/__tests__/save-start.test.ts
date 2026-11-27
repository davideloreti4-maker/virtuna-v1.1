/**
 * saveStart (plan 01-start-and-profile, Task 7): the real call and its checks; `fetch` (the route) is the only
 * stand-in.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CompleteAnswers } from "../answers";
import { saveStart } from "../save-start";

const ANSWERS: CompleteAnswers = { platforms: ["tiktok"], niche: "budget meals for students", nicheSource: "typed", goal: "growth" };

const answerWith = (status: number, body: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );

afterEach(() => vi.unstubAllGlobals());

describe("saveStart", () => {
  it("posts the answers and the consent, and follows a path on this site", async () => {
    answerWith(200, { next: "/audience/new?guide=1", build: null });
    expect(await saveStart(ANSWERS, true)).toEqual({ ok: true, next: "/audience/new?guide=1", build: null });
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("/api/onboarding/start");
    expect(JSON.parse(String(init?.body))).toEqual({ answers: ANSWERS, emailConsent: true });
  });

  it.each(["https://evil.test/x", "//evil.test", "/\\evil.test", "/\t/evil.test", "/\n/evil.test", "/\r/evil.test", "home"])(
    "refuses to leave for %j",
    async (next) => {
      answerWith(200, { next, build: null });
      expect(await saveStart(ANSWERS, false)).toEqual({ ok: false });
    },
  );

  it("a failed answer or a network error is not ok", async () => {
    answerWith(500, { error: "Failed to save" });
    expect(await saveStart(ANSWERS, false)).toEqual({ ok: false });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    expect(await saveStart(ANSWERS, false)).toEqual({ ok: false });
  });
});
