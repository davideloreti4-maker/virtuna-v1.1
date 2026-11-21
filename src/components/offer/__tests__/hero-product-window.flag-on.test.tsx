/** @vitest-environment happy-dom */

/**
 * The offer page's product window under the new look (plan 2026-11-20, thread field, Task 4):
 * its sample thread keeps the legacy bubble and label (spec §9: "The marketing page's sample
 * thread keeps its current look"), although it renders the shared `ThreadUserTurn` /
 * `ThreadAssistantTurn`, which change look under the flag.
 *
 * The real window. Stand-ins are browser APIs only: matchMedia answers "reduce motion", so the
 * window lands on its finished scene at once (its own reduced-motion path) instead of playing
 * its timed build.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { HeroProductWindow } from "../hero-product-window";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
  global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as Response) as typeof fetch;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("flag on: the offer window's sample thread", () => {
  it("keeps the legacy bubble and the legacy Maven label", async () => {
    render(<HeroProductWindow />);
    const bubble = await screen.findByText("test this video for me", { selector: "p" });
    expect(bubble.className).toContain("bg-white/[0.055]");
    expect(bubble.className).not.toContain("bg-surface-sunken");
    const label = screen.getByRole("heading", { level: 2, name: "Maven", hidden: true });
    expect(label.className).toContain("uppercase");
    expect(screen.queryByRole("img", { name: /^Video/, hidden: true })).toBeNull();
  });
});
