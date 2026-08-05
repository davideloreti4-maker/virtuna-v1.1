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

/**
 * The suite's real network calls — 58 connection attempts to localhost:3000 per clean run.
 *
 * happy-dom's default document URL is `http://localhost:3000`, so a RELATIVE asset URL resolves
 * to a real socket. Traced 2026-08-05 with a fetch trap that recorded the stack of every such
 * call: they are ONE asset — `/brain/cortex.glb`, the FreeSurfer cortex mesh.
 *
 * `CortexCanvas.tsx` ends with `useGLTF.preload('/brain/cortex.glb')` at MODULE scope. That is
 * correct in a browser (warm the cache before the canvas mounts) and unconditional under vitest:
 * it fires on IMPORT, before any test body, which is why some of the trapped calls were recorded
 * "(outside a test)". Every file that transitively imports the canvas pays for it.
 *
 * They normally fail fast and are swallowed. Occasionally one lands inside a test with a 5000ms
 * budget and times it out — a DIFFERENT file each run, which is the flake that has made this
 * suite's exit code non-deterministic across four handoffs.
 *
 * Answered here rather than at the call site because the call site is not wrong: a 3D canvas
 * preloading its own mesh is the right thing for the product to do. What is wrong is a test
 * environment that turns a static-asset path into a socket. No test anywhere needs the mesh
 * bytes — the canvas is never asserted on its geometry — so the request is refused without
 * opening a connection.
 *
 * ⚠️ Scoped to a literal path prefix on purpose. A blanket localhost:3000 stub would mask the
 * NEXT leak instead of surfacing it, and the whole reason this took four handoffs to find is
 * that the noise was indistinguishable from signal.
 */
const STATIC_ASSET_PREFIX = "http://localhost:3000/brain/";
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  let url = "";
  try {
    url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
  } catch {
    /* an exotic input shape is not ours to judge — fall through to the real fetch */
  }
  if (url.startsWith(STATIC_ASSET_PREFIX)) {
    return Promise.resolve(
      new Response(null, { status: 404, statusText: "asset not served under test" }),
    );
  }
  return realFetch(input as RequestInfo, init);
}) as typeof fetch;
