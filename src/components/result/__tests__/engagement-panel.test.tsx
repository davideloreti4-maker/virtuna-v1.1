/** @vitest-environment happy-dom */
/**
 * The Engagement page on recorded runs: the counts of 1,000 viewers, the average watch and
 * what viewers are likely to do, following the video. Real: the state function, the panel, the
 * playhead and the count under the video (the two must agree). Nothing is stood in for.
 */
import { describe, expect, it, vi } from "vitest";
import { act, cleanup, screen, within } from "@testing-library/react";

// The flag is a build-time constant; this file is the flag-on build (the page exists only there).
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import early from "@/lib/result/__tests__/fixtures/early.json";
import holds from "@/lib/result/__tests__/fixtures/holds.json";
import opening from "@/lib/result/__tests__/fixtures/opening.json";
import type { Intent, VideoModel } from "@/lib/result/types";
import { EngagementPanel } from "../engagement-panel";
import { ViewerCount } from "../viewer-count";
import { modelOf, playhead, renderWithPlayhead } from "./hero-harness";

const panel = () => document.querySelector<HTMLElement>('[data-result="engagement"]')!;
const ofViewers = () => document.querySelector<HTMLElement>('[data-result="of-viewers"]')!;
const now = () => ofViewers().querySelector<HTMLElement>('[data-part="now"]');
const marker = () => ofViewers().querySelector<HTMLElement>('[data-part="marker"]');
const fills = () => Array.from(panel().querySelectorAll<HTMLElement>("[data-fill]")).map((el) => el.style.width);
const figures = () =>
  [...ofViewers().querySelectorAll('[data-part="figure"]')].map((row) => [
    row.querySelector("dt")!.textContent,
    row.querySelector("dd")!.textContent,
  ]);
const intentRows = () => within(screen.getByRole("list", { name: "Most likely first" })).getAllByRole("listitem");
const mount = (model: VideoModel) => renderWithPlayhead(model, <EngagementPanel model={model} />);
const intents = (share: number, comment: number, rewatch: number, save: number): Intent[] => [
  { id: "share", label: "Share", value: share },
  { id: "comment", label: "Comment", value: comment },
  { id: "rewatch", label: "Rewatch", value: rewatch },
  { id: "save", label: "Save", value: save },
];

describe("Of 1,000 viewers", () => {
  it("three rows: past the first 3 seconds, watched to the end, the average watch with its bar", () => {
    const model = modelOf(early);
    mount(model);
    expect(within(ofViewers()).getByRole("heading", { name: "Of 1,000 viewers" })).toBeInTheDocument();
    expect(figures()).toEqual([
      ["Past the first 3 seconds", "708"],
      ["Watched to the end", "461"],
      ["Average watch", "0:16of 0:29"],
    ]);
    // The bar is as long as the clip, filled to the average watch.
    const bar = ofViewers().querySelector<HTMLElement>('[data-bar="avg-watch"] [data-fill]')!;
    expect(bar.style.width).toBe(`${(model.avgWatchS / model.clipS) * 100}%`);
  });

  it("a clip that ends before 0:03 has no 'Past the first 3 seconds' row: the end's count is not shown twice under an untrue name", () => {
    const model = modelOf(early);
    mount({ ...model, clipS: 2 });
    expect(figures().map(([name]) => name)).toEqual(["Watched to the end", "Average watch"]);
    // Exactly three seconds has that moment.
    cleanup();
    mount({ ...model, clipS: 3 });
    expect(figures().map(([name]) => name)).toEqual(["Past the first 3 seconds", "Watched to the end", "Average watch"]);
  });

  it("reads other runs' numbers", () => {
    mount(modelOf(opening));
    expect(figures()).toEqual([
      ["Past the first 3 seconds", "708"],
      ["Watched to the end", "708"],
      ["Average watch", "1:26of 2:01"],
    ]);
  });

  it("at rest: no Now row and no marker", () => {
    mount(modelOf(early));
    expect(now()).toBeNull();
    expect(marker()).toBeNull();
  });

  it("away from rest: Now, at the moment, how many are still watching, above the rows; a coral marker on the bar there", () => {
    mount(modelOf(early));
    act(() => playhead.current.seek(7));
    expect(now()!.firstElementChild!.textContent).toBe("Now, at 0:07");
    expect(now()!.lastElementChild!.textContent).toBe("562 still watching");
    expect(now()!.lastElementChild!.firstElementChild!.className).toMatch(/\bfont-bold\b/);
    const firstFigure = ofViewers().querySelector('[data-part="figure"]')!;
    expect(now()!.compareDocumentPosition(firstFigure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(parseFloat(marker()!.style.left)).toBeCloseTo((7 / 29) * 100, 3);
    expect(marker()!.className).toMatch(/\bbg-below\b/);
    expect(marker()!.className).toMatch(/\bw-0\.5\b/);
    expect(marker()!.className).toContain("h-[18px]");
    // On the average watch's bar, which keeps its fill.
    expect(marker()!.closest('[data-bar="avg-watch"]')).not.toBeNull();
    act(() => playhead.current.seek(29));
    expect(now()).toBeNull();
    expect(marker()).toBeNull();
  });

  it("the Now row says what the count under the video says", () => {
    const model = modelOf(early);
    const { container } = renderWithPlayhead(
      model,
      <>
        <ViewerCount audience={model.audience} />
        <EngagementPanel model={model} />
      </>,
    );
    for (const t of [0, 2.5, 7, 20]) {
      act(() => playhead.current.seek(t));
      const shown = container.querySelector('[data-part="count-number"]')!.textContent;
      expect(now()!.lastElementChild!.textContent).toBe(`${shown} still watching`);
    }
  });
});

describe("What viewers are likely to do", () => {
  it("the four actions, the longest bar first, no numbers; the single highest is Most likely", () => {
    mount(modelOf(early));
    expect(screen.getByRole("heading", { name: "What viewers are likely to do" })).toBeInTheDocument();
    const rows = intentRows();
    expect(rows.map((row) => row.textContent)).toEqual(["ShareMost likely", "Comment", "Rewatch", "Save"]);
    // early stores share 47.9, comment 29.6, rewatch 19.4, save 12.5.
    expect(fills().slice(1)).toEqual(["48%", "30%", "19%", "13%"]);
    const tags = panel().querySelectorAll('[data-part="most-likely"]');
    expect(tags).toHaveLength(1);
    // At the right end of its row, after the bar; an ink tag.
    expect(rows[0]!.lastElementChild).toBe(tags[0]);
    expect(tags[0]!.className).toMatch(/\bbg-action\b/);
    expect(tags[0]!.className).toMatch(/\btext-action-foreground\b/);
    for (const row of rows) {
      const bar = row.querySelector('[data-bar="intent"]')!;
      expect(bar.getAttribute("aria-hidden")).toBe("true");
      expect(bar.textContent).toBe("");
    }
  });

  it("follows the run's own order (holds: Save first, and most likely)", () => {
    mount(modelOf(holds));
    expect(intentRows().map((row) => row.textContent)).toEqual(["SaveMost likely", "Share", "Comment", "Rewatch"]);
  });

  it("the other three rows keep the tag's room empty, so all four tracks are the same length", () => {
    mount(modelOf(early));
    const [top, ...others] = intentRows();
    expect(top!.querySelector('[data-part="most-likely-room"]')).toBeNull();
    const tag = top!.querySelector<HTMLElement>('[data-part="most-likely"]')!;
    for (const row of others) {
      const room = row.querySelector<HTMLElement>('[data-part="most-likely-room"]')!;
      // After the bar, where the tag stands in the top row, with the tag's own box and no words of its own.
      expect(row.lastElementChild).toBe(room);
      expect(room.getAttribute("aria-hidden")).toBe("true");
      expect(room.textContent).toBe("");
      const classes = room.className.split(/\s+/);
      expect(classes).toEqual(expect.arrayContaining([...tag.className.split(/\s+/), "invisible"]));
    }
  });

  it("a tie for the highest names none, and no room is kept", () => {
    mount({ ...modelOf(early), intents: intents(40, 40, 10, 5) });
    expect(panel().querySelector('[data-part="most-likely"]')).toBeNull();
    expect(panel().querySelector('[data-part="most-likely-room"]')).toBeNull();
  });

  it("all zero names none, and each action keeps a visible stub of 4%", () => {
    mount({ ...modelOf(early), intents: intents(0, 0, 0, 0) });
    expect(panel().querySelector('[data-part="most-likely"]')).toBeNull();
    expect(fills().slice(1)).toEqual(["4%", "4%", "4%", "4%"]);
  });

  it("renders only the first card when the run stored no intents", () => {
    mount({ ...modelOf(early), intents: null });
    expect(ofViewers()).not.toBeNull();
    expect(screen.queryByText("What viewers are likely to do")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(panel().querySelectorAll('[data-result="intents"]')).toHaveLength(0);
  });
});

describe("the page as a whole", () => {
  it("its only numbers are the counts and the times: no percent, no index, no verdict", () => {
    mount(modelOf(early));
    const text = [
      panel().textContent ?? "",
      ...Array.from(panel().querySelectorAll("[aria-label]")).map((el) => el.getAttribute("aria-label") ?? ""),
    ].join(" ");
    expect(text).not.toMatch(/\b(low|high|medium|intent)\b/i);
    expect(text).not.toContain("%");
    expect(text.match(/\d[\d,]*(:\d+)?/g)).toEqual(["1,000", "3", "708", "461", "0:16", "0:29"]);
  });

  it("coral only at the video's moment: none at rest, the marker alone away from rest", () => {
    mount(modelOf(early));
    expect(panel().innerHTML).not.toMatch(/below|accent|#[0-9a-f]{3,8}\b|rgba?\(/i);
    act(() => playhead.current.seek(7));
    const coral = [...panel().querySelectorAll('[class*="below"], [fill*="below"], [stroke*="below"]')];
    expect(coral).toHaveLength(1);
    expect(coral[0]).toBe(marker());
  });

  it("two cards, 10 apart on the phone and 16 on desktop", () => {
    mount(modelOf(early));
    expect(panel().className).toMatch(/\bgap-2\.5\b/);
    expect(panel().className).toMatch(/\bmd:gap-4\b/);
    expect([...panel().children].map((el) => el.getAttribute("data-result"))).toEqual(["of-viewers", "intents"]);
  });
});
