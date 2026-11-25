/** @vitest-environment happy-dom */

/**
 * A video's card face (spec 3.2): one face for the library's card (a link) and a pulled video's (a
 * button). The count is never the part a narrow card cuts: a long handle is. Made-up creators only.
 */

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";

import type { CardVideo } from "@/lib/discover-next/hub-data";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { VideoCard } from "../video-card";

function video(over: Partial<CardVideo> = {}): CardVideo {
  return {
    id: "v1",
    coverUrl: "https://covers.example/v1.jpg",
    handle: "a.very.long.made.up.handle",
    spokenHook: "A line long enough to wrap twice on a narrow card",
    niche: "food",
    platform: "tiktok",
    views: 86_300_000,
    postedAt: null,
    multiplier: 12,
    baselineLabel: "vs their average",
    proven: true,
    extreme: false,
    formats: [],
    ...over,
  };
}

const classes = (el: Element | null) => (el?.className ?? "").split(/\s+/);

describe("the card's meta: the handle gives way, the count stays whole", () => {
  it("a long handle truncates; the count beside it does not shrink", () => {
    render(<VideoCard video={video()} href="/feed/video/v1" />);
    const card = screen.getByRole("link");
    const handle = card.querySelector('[data-part="handle"]');
    const views = card.querySelector('[data-part="views"]');
    expect(handle).toHaveTextContent("@a.very.long.made.up.handle");
    expect(classes(handle)).toEqual(expect.arrayContaining(["truncate", "min-w-0"]));
    expect(views).toHaveTextContent("· 86.3M");
    expect(classes(views)).toContain("shrink-0");
    expect(card).toHaveAccessibleDescription("12× @a.very.long.made.up.handle · 86.3M");
  });

  it("no handle: the count alone, with no dot", () => {
    render(<VideoCard video={video({ handle: null })} href="/feed/video/v1" />);
    const card = screen.getByRole("link");
    expect(card.querySelector('[data-part="handle"]')).toBeNull();
    expect(card.querySelector('[data-part="views"]')!.textContent).toBe("86.3M");
    expect(card).toHaveAccessibleDescription("12× 86.3M");
  });

  it("no count: the handle alone", () => {
    render(<VideoCard video={video({ views: 0 })} href="/feed/video/v1" />);
    const card = screen.getByRole("link");
    expect(card.querySelector('[data-part="views"]')).toBeNull();
    expect(card).toHaveAccessibleDescription("12× @a.very.long.made.up.handle");
  });
});

describe("one face for both cards, one cover for every video", () => {
  it("the pulled card draws the library card's face, and keeps no copy of it", () => {
    const src = readFileSync(join(__dirname, "..", "pull-screen.tsx"), "utf8");
    expect(src).toMatch(/\bVideoCardFace\b/);
    expect(src).not.toMatch(/COVER_LOOK|SHADE_BACKGROUND|SHADE_HEIGHT|<img\b/);
  });

  it.each(["video-screen.tsx", "pulled-sheet.tsx"])("%s draws the one cover (with its neutral tile), not a copy", (file) => {
    const src = readFileSync(join(__dirname, "..", file), "utf8");
    expect(src).toMatch(/<CoverImage\b/);
    expect(src).not.toMatch(/<img\b/);
  });
});
