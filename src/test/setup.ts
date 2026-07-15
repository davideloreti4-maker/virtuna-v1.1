/**
 * Global test setup for vitest — registers jest-dom matchers and provides
 * lightweight polyfills used by Radix UI components rendered under happy-dom.
 *
 * Loaded via `vitest.config.ts` `setupFiles` for tests that opt in to a
 * browser-like environment via the `/** @vitest-environment happy-dom *\/`
 * pragma at the top of the file.
 */

import "@testing-library/jest-dom/vitest";
import "vitest-axe/extend-expect";
import { expect, vi } from "vitest";
import * as axeMatchers from "vitest-axe/matchers";
expect.extend(axeMatchers);

/**
 * `next/headers` — a DISARMED default cookie store for every test.
 *
 * WHY: every `/api/tools/*` route begins with `maybeMockSkillRun(skill, userId)` (the mock-skill
 * sandbox), whose first line is `await cookies()`. Outside a Next request scope that THROWS
 * ("`cookies` was called outside a request scope"), and no test file anywhere mocked it — so the
 * throw happened before any route body ran. The entire tools route-test surface was dead:
 * **73 failed / 15 passed across `src/app/api/tools`** on `main`, in isolation, including the
 * 7/8 explore failures previously logged as unexplained. They were all this one line.
 *
 * That dead layer is exactly why the route's hand-built SSE `content` map could silently drop a
 * card prop (`grounded`) and stay green: nothing was guarding the routes at all.
 *
 * An empty store is the correct default — `isMockSkillsEnabled(undefined)` is false, so
 * `maybeMockSkillRun` returns null and the real route body runs, which is what these tests mean
 * to exercise. A test that needs an armed sandbox or a real cookie overrides this with its own
 * `vi.mock("next/headers", …)`.
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set: () => {},
    delete: () => {},
  }),
  headers: async () => new Headers(),
  draftMode: async () => ({ isEnabled: false, enable: () => {}, disable: () => {} }),
}));

// Radix UI's Popover / Select / Dialog primitives use ResizeObserver and
// matchMedia. happy-dom does not implement either. Stub both with no-op
// shims so component renders do not throw during mount.
if (typeof globalThis.ResizeObserver === "undefined") {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

if (typeof globalThis.matchMedia === "undefined") {
  (globalThis as unknown as { matchMedia: unknown }).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

// happy-dom DOMRect is missing fromRect; Radix uses it via positioning math.
if (typeof globalThis.DOMRect !== "undefined" && !("fromRect" in DOMRect)) {
  // @ts-expect-error — happy-dom omits the static factory
  DOMRect.fromRect = (other?: { x?: number; y?: number; width?: number; height?: number }) => {
    return new DOMRect(other?.x ?? 0, other?.y ?? 0, other?.width ?? 0, other?.height ?? 0);
  };
}
