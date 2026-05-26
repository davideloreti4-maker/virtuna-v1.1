/**
 * Global test setup for vitest — registers jest-dom matchers and provides
 * lightweight polyfills used by Radix UI components rendered under happy-dom.
 *
 * Loaded via `vitest.config.ts` `setupFiles` for tests that opt in to a
 * browser-like environment via the `/** @vitest-environment happy-dom *\/`
 * pragma at the top of the file.
 */

import "@testing-library/jest-dom/vitest";
import { expect } from 'vitest';
import { toHaveNoViolations } from 'vitest-axe/matchers';
expect.extend({ toHaveNoViolations });

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
