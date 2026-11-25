/** @vitest-environment happy-dom */
/**
 * Maven's pick (spec 2026-11-25-maven-pick-design.md): the hooks writer now stores a plain reason
 * (`why`) on every hook card. The old look ignores it: a legacy hook card renders exactly as before,
 * on its face and expanded. The real renderer, compared markup for markup.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { HookCardRenderer } from "@/components/thread/hook-card-block";
import type { HookCardBlock } from "@/lib/tools/blocks";

// The card's own reads (its save state) go to the network: held open here, so nothing leaves the test.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function makeHook(overrides: Partial<HookCardBlock["props"]> = {}): HookCardBlock {
  return {
    type: "hook-card",
    props: {
      hookLine: "Stop editing your videos. Do this instead.",
      audienceArchetype: "lurker",
      mechanism: "Pattern-interrupt via a permission to quit a painful task.",
      seedHook: "Stop editing your videos.",
      rank: 1,
      band: "Strong",
      fraction: "7/10 stop",
      scrollQuote: "Fast and to the point.",
      model: "sim1-flash",
      provenance: "projected",
      channel: "spoken",
      ...overrides,
    },
  };
}

/** The card's markup, face and expanded, with React's generated ids made neutral. */
function markupOf(block: HookCardBlock): { face: string; expanded: string } {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container, unmount } = render(
    <QueryClientProvider client={qc}>
      <HookCardRenderer block={block} />
    </QueryClientProvider>,
  );
  const neutral = (html: string) => html.replace(/«[^»]*»|:r[0-9a-z]+:/g, "id");
  const face = neutral(container.innerHTML);
  for (const toggle of container.querySelectorAll<HTMLElement>("[aria-expanded='false']")) fireEvent.click(toggle);
  const expanded = neutral(container.innerHTML);
  unmount();
  return { face, expanded };
}

describe("the old look's hook card and why", () => {
  it("renders the same with and without why on its block", () => {
    const without = markupOf(makeHook());
    const withWhy = markupOf(makeHook({ why: "It dares a friend by name, so you wait to hear why." }));
    expect(withWhy.face).toBe(without.face);
    expect(withWhy.expanded).toBe(without.expanded);
    expect(withWhy.expanded).not.toContain("dares a friend");
    // The comparison sees a real difference: another hook line changes the markup.
    expect(markupOf(makeHook({ hookLine: "Another line." })).face).not.toBe(without.face);
  });
});
