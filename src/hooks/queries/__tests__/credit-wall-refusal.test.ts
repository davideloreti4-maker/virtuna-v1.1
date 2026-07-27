// @vitest-environment happy-dom
/**
 * THE 402 IS THE DIALOG'S — no inline error under the paywall.
 *
 * Every skill hook raised the credit wall and then threw, so its catch set `error` and the thread
 * drew `SkillRunError` UNDERNEATH the modal, with the generic copy: *"The generation or SIM-1 pass
 * dropped out. Tap to retry — nothing was charged."* For a refusal both halves are false — nothing
 * dropped out, and the retry gets the same 402 forever.
 *
 * Measured on a production build (2026-07-27): an anonymous /go visitor taps "Get content ideas",
 * sends, and gets the trial wall on top of exactly that futile retry. The wall's own module always
 * said the caller "should stop its own error theatrics" — this pins it as behaviour instead of
 * prose, for all five paid stream hooks.
 *
 * The wall itself must still go up (`CREDIT_WALL_EVENT`), and a NON-quota failure must still draw
 * its inline error — that path is the funnel's honest dead-end and losing it would be worse.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { CREDIT_WALL_EVENT } from "@/lib/billing/credit-wall";
import { useIdeasStream } from "@/hooks/queries/use-ideas-stream";
import { useHooksStream } from "@/hooks/queries/use-hooks-stream";
import { useScriptStream } from "@/hooks/queries/use-script-stream";
import { useRemixStream } from "@/hooks/queries/use-remix-stream";
import { useExploreStream } from "@/hooks/queries/use-explore-stream";

const QUOTA_402 = {
  error: "credit_quota_exceeded",
  message: "$1 unlocks the whole platform for 3 days — every skill, 50 credits.",
  tier: "free",
  used: 0,
  limit: 10,
  inTrial: false,
  reason: "trial_required",
  cost: 1,
};

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Each hook with the smallest start() call that reaches the fetch. */
const HOOKS = [
  { name: "ideas", use: useIdeasStream, run: (h: never) => (h as { start: (a: string, p: string) => Promise<void> }).start("a topic", "tiktok") },
  { name: "hooks", use: useHooksStream, run: (h: never) => (h as { start: (a: string, p: string) => Promise<void> }).start("a topic", "tiktok") },
  { name: "script", use: useScriptStream, run: (h: never) => (h as { start: (a: string, p: string) => Promise<void> }).start("a topic", "tiktok") },
  { name: "remix", use: useRemixStream, run: (h: never) => (h as { start: (u: string, p: string) => Promise<void> }).start("https://www.tiktok.com/@x/video/1", "tiktok") },
  { name: "explore", use: useExploreStream, run: (h: never) => (h as { start: (p: { niche: string }) => Promise<void> }).start({ niche: "fitness" }) },
] as const;

let walls: unknown[];
const onWall = (e: Event) => walls.push((e as CustomEvent).detail);

beforeEach(() => {
  walls = [];
  window.addEventListener(CREDIT_WALL_EVENT, onWall);
});
afterEach(() => {
  window.removeEventListener(CREDIT_WALL_EVENT, onWall);
  vi.restoreAllMocks();
});

describe("a credit 402 raises the wall and draws NO inline error", () => {
  for (const { name, use, run } of HOOKS) {
    it(`${name}: the wall goes up, \`error\` stays null, streaming stops`, async () => {
      vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(respond(402, QUOTA_402))));

      const { result } = renderHook(() => use());
      await act(async () => {
        await run(result.current as never);
      });

      await waitFor(() => expect(result.current.isStreaming).toBe(false));
      // The dialog is the explanation. An inline SkillRunError here offers a retry that cannot
      // succeed, under copy ("nothing was charged", "dropped out") that misdescribes a refusal.
      expect(result.current.error, `${name} must not draw an inline error under the wall`).toBeNull();
      expect(walls).toHaveLength(1);
      expect((walls[0] as { reason: string }).reason).toBe("trial_required");
    });

    it(`${name}: a NON-quota failure still says so inline`, async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(respond(500, { error: "engine exploded" })))
      );

      const { result } = renderHook(() => use());
      await act(async () => {
        await run(result.current as never);
      });

      await waitFor(() => expect(result.current.isStreaming).toBe(false));
      expect(result.current.error, `${name} must keep its honest dead-end`).not.toBeNull();
      expect(walls).toHaveLength(0);
    });
  }
});
