/** @vitest-environment happy-dom */

/**
 * THE MOUNT IS THE FEATURE.
 *
 * `session-expired.ts` and `SessionExpiredListener` are both fully tested in isolation and both
 * stay green if nobody ever mounts the listener — the event would be dispatched into an empty
 * room and every 401 would render the generic engine copy again, which is the exact defect this
 * lane removes. Nothing else in the suite renders `Providers`, so this is the only thing standing
 * between "wired" and "written".
 *
 * It renders the real `Providers` and drives the real event, rather than asserting on the source
 * text: a grep for `<SessionExpiredListener />` also passes when it is mounted inside a branch
 * that never runs.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";

import { Providers } from "@/app/(app)/providers";
import { raiseSessionExpired } from "@/lib/auth/session-expired";

/**
 * `Providers` also mounts `CreditWallListener`, whose `useSubscription` fetches on mount. That is
 * a genuine I/O boundary this test cannot run — unstubbed it opens real sockets to :3000 and
 * prints five ECONNREFUSED traces per run. Stubbed at the boundary only; nothing about the unit
 * under test (the mount wiring) is mocked.
 */
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("(app) providers", () => {
  it("mounts the session listener, so a 401 raised anywhere is explained", () => {
    render(
      <Providers>
        <div>app</div>
      </Providers>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      raiseSessionExpired();
    });

    expect(screen.getByRole("dialog").textContent).toMatch(/signed out|session/i);
  });
});
