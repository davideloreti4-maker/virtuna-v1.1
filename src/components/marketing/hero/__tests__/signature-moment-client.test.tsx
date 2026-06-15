/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

import { SignatureMomentClient } from "../signature-moment-client";

/**
 * Phase 2 Wave-0 Nyquist scaffold — HERO-04 gating correctness.
 *
 * RED-by-design: `../signature-moment-client` does not exist yet (built in 02-03).
 *
 * The canvas island is the heaviest thing on the page. The correctness property
 * (UI-SPEC §Mobile resolution + §A11y) is that the GATE prevents the canvas from
 * mounting at all when EITHER reduced-motion OR mobile is true — the SSR'd
 * ComposedStill underneath stands as the full, accessible end-state. These tests
 * flip each gate independently and assert NO <canvas> is in the tree.
 *
 * Mock convention mirrors the repo (use-audience-choreography.test.ts:16-43):
 * vi.mock the hooks/perf-tier at module scope; flip per-case with vi.mocked().
 * (The canvas is dynamic(ssr:false) so it would not synchronously render in
 * happy-dom regardless — these assertions verify the gate, the real property.)
 */

vi.mock("@/hooks/usePrefersReducedMotion", () => ({
  usePrefersReducedMotion: vi.fn(() => false),
}));

vi.mock("@/hooks/useIsMobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

// perf-tier may be imported at module scope by the component; stub it benign so
// the import resolves and the tier never forces the still on its own.
vi.mock("@/lib/perf-tier", () => ({
  usePerfStore: vi.fn(
    (selector: (s: { tier: string }) => unknown) => selector({ tier: "high" })
  ),
  detectInitialTier: vi.fn(() => Promise.resolve("high")),
  startFpsSampler: vi.fn(() => () => {}),
  nextLowerTier: vi.fn((t: string) => t),
}));

describe("<SignatureMomentClient /> — HERO-04 gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mounts NO canvas under prefers-reduced-motion (the still stands)", async () => {
    const { usePrefersReducedMotion } = await import(
      "@/hooks/usePrefersReducedMotion"
    );
    const { useIsMobile } = await import("@/hooks/useIsMobile");
    vi.mocked(usePrefersReducedMotion).mockReturnValue(true);
    vi.mocked(useIsMobile).mockReturnValue(false);

    const { container } = render(<SignatureMomentClient score={87} />);

    expect(container.querySelector("canvas")).toBeNull();
  });

  it("mounts NO canvas on mobile (the still stands)", async () => {
    const { usePrefersReducedMotion } = await import(
      "@/hooks/usePrefersReducedMotion"
    );
    const { useIsMobile } = await import("@/hooks/useIsMobile");
    vi.mocked(usePrefersReducedMotion).mockReturnValue(false);
    vi.mocked(useIsMobile).mockReturnValue(true);

    const { container } = render(<SignatureMomentClient score={87} />);

    expect(container.querySelector("canvas")).toBeNull();
  });
});
