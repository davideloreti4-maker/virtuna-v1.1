/** @vitest-environment happy-dom */

/**
 * A video's card face (spec 3.2): one face for the library's card (a link) and a pulled video's (a
 * button). The count is never the part a narrow card cuts: a long handle is. Made-up creators only.
 */

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";

import type { CardVideo } from "@/lib/discover-next/hub-data";
import type { PulledVideo } from "@/lib/discover-next/pull";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { PulledCard } from "../pulled-card";
import { VideoCard, VideoCardFace, cardDescribedBy, type CardFoot } from "../video-card";

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

/** The face inside a box it describes, as the library's card and a pulled video's both draw it. */
function Face({ video, foot }: { video: CardVideo; foot?: CardFoot }) {
  return (
    <div role="group" aria-label="card" aria-describedby={cardDescribedBy("c", video, foot)}>
      <VideoCardFace video={video} id="c" foot={foot} />
    </div>
  );
}

describe("a card's foot", () => {
  it("a card's foot: the byline by default", () => {
    for (const foot of [undefined, "byline" as const]) {
      const { unmount } = render(<Face video={video()} foot={foot} />);
      const face = screen.getByRole("group");
      expect(face.querySelector('[data-part="handle"]')).toHaveTextContent("@a.very.long.made.up.handle");
      expect(face.querySelector('[data-part="views"]')!.textContent).toBe(" · 86.3M");
      expect(face).toHaveAccessibleDescription("12× @a.very.long.made.up.handle · 86.3M");
      unmount();
    }
  });

  it("a card's foot: the views alone on a creator's page", () => {
    const first = render(<Face video={video()} foot="views" />);
    let face = screen.getByRole("group");
    expect(face.querySelector('[data-part="handle"]')).toBeNull();
    const views = face.querySelector('[data-part="views"]');
    expect(views!.textContent).toBe("86.3M views");
    expect(views).toHaveAttribute("id", "c-meta");
    expect(classes(views)).toEqual(expect.arrayContaining(["shrink-0", "whitespace-pre"]));
    expect(face.querySelectorAll("#c-meta")).toHaveLength(1);
    expect(face).toHaveAccessibleDescription("12× 86.3M views");
    first.unmount();

    // No count: no foot, and nothing of it in the description.
    const none = render(<Face video={video({ views: 0 })} foot="views" />);
    face = screen.getByRole("group");
    expect(face.querySelector('[data-part="views"]')).toBeNull();
    expect(face.querySelector("#c-meta")).toBeNull();
    expect(face).toHaveAccessibleDescription("12×");
    expect(face.textContent).not.toMatch(/view/);
    none.unmount();

    render(<Face video={video({ views: 1, proven: false })} foot="views" />);
    face = screen.getByRole("group");
    expect(face.querySelector('[data-part="views"]')!.textContent).toBe("1 view");
    expect(face).toHaveAccessibleDescription("1 view");
  });

  it("the views foot counts as Discover does: no decimal from 100K (106,100 views reads 106K views)", () => {
    render(<Face video={video({ views: 106_100 })} foot="views" />);
    const face = screen.getByRole("group");
    expect(face.querySelector('[data-part="views"]')!.textContent).toBe("106K views");
    expect(face).toHaveAccessibleDescription("12× 106K views");
  });
});

function pulled(over: Partial<PulledVideo> = {}): PulledVideo {
  return { ...video(), captioned: true, likes: 1_200, comments: 40, videoUrl: "https://www.tiktok.example/@a.very.long.made.up.handle/video/1", ...over };
}

describe("a pulled card", () => {
  it("a pulled card is a button that opens its video", () => {
    const onOpen = vi.fn();
    const shown = pulled();
    render(<PulledCard video={shown} onOpen={onOpen} />);
    const card = screen.getByRole("button", { name: "A line long enough to wrap twice on a narrow card" });
    expect(card).toHaveAttribute("type", "button");
    expect(card).toHaveAttribute("aria-haspopup", "dialog");
    expect(card).toHaveAccessibleDescription("12× @a.very.long.made.up.handle · 86.3M");
    expect(card).not.toHaveFocus();

    // A click that does not focus the button (as a tap in Safari): the card focuses itself first.
    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(shown, card);
    expect(card).toHaveFocus();
  });

  it("on a creator's page its foot is the views alone, and it is described by them", () => {
    render(<PulledCard video={pulled()} onOpen={() => {}} foot="views" />);
    const card = screen.getByRole("button", { name: "A line long enough to wrap twice on a narrow card" });
    expect(card.querySelector('[data-part="handle"]')).toBeNull();
    expect(card.querySelector('[data-part="views"]')!.textContent).toBe("86.3M views");
    expect(card).toHaveAccessibleDescription("12× 86.3M views");
  });
});

describe("one face for both cards, one cover for every video", () => {
  it("the pulled card draws the library card's face, and keeps no copy of it", () => {
    const src = readFileSync(join(__dirname, "..", "pulled-card.tsx"), "utf8");
    expect(src).toMatch(/\bVideoCardFace\b/);
    expect(src).not.toMatch(/COVER_LOOK|SHADE_BACKGROUND|SHADE_HEIGHT|<img\b/);
  });

  it.each(["video-screen.tsx", "pulled-sheet.tsx"])("%s draws the one cover (with its neutral tile), not a copy", (file) => {
    const src = readFileSync(join(__dirname, "..", file), "utf8");
    expect(src).toMatch(/<CoverImage\b/);
    expect(src).not.toMatch(/<img\b/);
  });
});
