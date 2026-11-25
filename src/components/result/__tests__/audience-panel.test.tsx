/** @vitest-environment happy-dom */
/**
 * The Audience panel on recorded runs (spec §5 "Audience", plan Task 4). The state function, the
 * ring's layout, the playhead and the panel are real; nothing is stood in for.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { act, render, screen, within } from "@testing-library/react";

// The flag is a build-time constant; this file is the flag-on build (the page exists only there).
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { videoStateOf } from "@/lib/result/video-model";
import { groupsAt } from "@/lib/result/group-state";
import { ringDots, wedgeLooks, wedgesOf } from "@/lib/result/ring-layout";
import type { ResultRow, VideoModel } from "@/lib/result/types";
import early from "@/lib/result/__tests__/fixtures/early.json";
import ending from "@/lib/result/__tests__/fixtures/ending.json";
import holds from "@/lib/result/__tests__/fixtures/holds.json";
import leak from "@/lib/result/__tests__/fixtures/leak.json";
import { PlayheadProvider, usePlayhead, type Playhead } from "../playhead";
import { AudiencePanel } from "../audience-panel";
import { AudienceRing } from "../audience-ring";

function modelOf(fixture: unknown): VideoModel {
  const state = videoStateOf(fixture as ResultRow);
  if (state.kind !== "result") throw new Error(`fixture is ${state.kind}, not a result`);
  return state.model;
}

const realWidth = window.innerWidth;
const setWidth = (value: number) =>
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value });
afterEach(() => setWidth(realWidth));

let playhead: Playhead;
function Probe() {
  const current = usePlayhead();
  useEffect(() => {
    playhead = current;
  });
  return null;
}

function mount(fixture: unknown, view: "phone" | "desktop" = "phone") {
  setWidth(view === "phone" ? 393 : 1440);
  const model = modelOf(fixture);
  render(
    <PlayheadProvider clipS={model.clipS} scenes={model.audience.scenes}>
      <Probe />
      <AudiencePanel model={model} />
    </PlayheadProvider>,
  );
  return model;
}

const seek = (t: number) => act(() => playhead.seek(t));
const panel = () => document.querySelector<HTMLElement>('[data-result="audience"]')!;
const rowsOf = (heading: string) => {
  const list = screen.getByRole("list", { name: heading });
  return within(list)
    .getAllByRole("listitem")
    .map((li) => [li.querySelector("[data-name]")!.textContent, li.querySelector("[data-word]")!.textContent]);
};
const allRows = () => Array.from(panel().querySelectorAll<HTMLElement>("li[data-group]"));
const centre = () => panel().querySelector<SVGElement>("[data-ring-centre]")!.textContent;
const wedges = () => Array.from(panel().querySelectorAll<SVGGElement>("[data-wedge]"));

describe("AudiencePanel, rows", () => {
  it("early at rest: who left (earliest first), then who stayed, with the time they left by", () => {
    mount(early);
    expect(rowsOf("Left")).toEqual([
      ["Tough crowd", "Left by 0:03"],
      ["Purposeful viewers", "Left by 0:03"],
      ["Savers", "Left by 0:07"],
      ["Deep fans", "Left by 0:14"],
      ["Scouts", "Left by 0:14"],
      ["Passers-by", "Left by 0:14"],
    ]);
    expect(rowsOf("Stayed")).toEqual([
      ["Commenters", "To the end"],
      ["Quiet watchers", "To the end"],
      ["Sharers", "To the end"],
      ["Regulars", "To the end"],
    ]);
    expect(screen.queryByRole("heading", { name: "Watching" })).toBeNull();
  });

  it("exactly the two groups that leave in the named scene are coral, dot and words", () => {
    mount(early);
    const coral = allRows().filter((li) => li.dataset.look === "coral");
    expect(coral.map((li) => li.querySelector("[data-name]")!.textContent)).toEqual(["Tough crowd", "Purposeful viewers"]);
    for (const li of coral) expect(li.querySelector("[data-word]")!.className).toContain("text-below-text");
    for (const li of allRows().filter((row) => row.dataset.look !== "coral")) {
      expect(li.innerHTML).not.toContain("below");
    }
  });

  it("a heavy group's dot is large and a light one's small", () => {
    mount(early);
    const dotOf = (name: string) =>
      allRows().find((li) => li.querySelector("[data-name]")!.textContent === name)!.querySelector("[data-dot]")!;
    expect(dotOf("Savers").getAttribute("data-dot")).toBe("heavy");
    expect(dotOf("Regulars").getAttribute("data-dot")).toBe("light");
  });

  it("no percentages and no head counts in a row", () => {
    for (const fixture of [early, leak, holds, ending]) {
      mount(fixture);
      for (const li of allRows()) {
        expect(li.textContent).not.toContain("%");
        expect(li.querySelector("[data-word]")!.textContent).toMatch(/^(Left by \d+:\d\d|Watching|To the end|Not in this run)$/);
      }
      document.body.innerHTML = "";
    }
  });

  it("leak: the two groups that are not in the run come last, 'Not in this run'", () => {
    mount(leak);
    const rows = allRows().map((li) => [li.querySelector("[data-name]")!.textContent, li.querySelector("[data-word]")!.textContent]);
    expect(rows.slice(-2)).toEqual([
      ["Sharers", "Not in this run"],
      ["Purposeful viewers", "Not in this run"],
    ]);
    expect(allRows().filter((li) => li.dataset.look === "absent")).toHaveLength(2);
    expect(allRows().some((li) => li.dataset.look === "coral")).toBe(false);
  });

  it("ending: everyone has left, no 'Stayed' heading", () => {
    mount(ending);
    expect(rowsOf("Left")).toHaveLength(10);
    expect(screen.queryByRole("heading", { name: "Stayed" })).toBeNull();
  });

  it("the caption", () => {
    mount(early);
    expect(screen.getByText("One simulated viewer per group.")).toBeInTheDocument();
  });
});

describe("AudiencePanel, the playhead", () => {
  it("at rest the centre reads the headline and 'stayed'", () => {
    mount(early);
    expect(centre()).toBe("46%stayed");
  });

  it("at 0:02.5 the centre reads the stored share at the scene's end, and nobody is coral yet", () => {
    mount(early);
    seek(2.5);
    expect(centre()).toBe("71%watching · 0:03");
    expect(rowsOf("Watching")).toHaveLength(4);
    expect(screen.queryByRole("heading", { name: "Stayed" })).toBeNull();
    // Who will leave is still listed under "Left", but still watching.
    expect(rowsOf("Left").slice(0, 2)).toEqual([
      ["Tough crowd", "Watching"],
      ["Purposeful viewers", "Watching"],
    ]);
    expect(allRows().some((li) => li.dataset.look === "coral")).toBe(false);
    expect(wedges().some((g) => g.dataset.look === "coral")).toBe(false);
  });

  it("at 0:03.5 the two named groups have gone and turn coral", () => {
    mount(early);
    seek(3.5);
    const coral = allRows().filter((li) => li.dataset.look === "coral");
    expect(coral.map((li) => li.querySelector("[data-name]")!.textContent)).toEqual(["Tough crowd", "Purposeful viewers"]);
    expect(wedges().filter((g) => g.dataset.look === "coral").map((g) => g.dataset.wedge)).toEqual([
      "tough_crowd",
      "purposeful_viewer",
    ]);
  });
});

describe("AudiencePanel, the ring", () => {
  it("phone: a 326 box (outer radius 158) in a 350 card, one wedge per group, 1,000 viewer dots", () => {
    mount(early);
    const svg = panel().querySelector<SVGSVGElement>("svg[data-ring]")!;
    expect(svg.getAttribute("width")).toBe("326");
    expect(svg.closest('[data-result="ring"]')).not.toBeNull();
    expect(panel().querySelector('[data-result="audience-ring"]')!.className).toContain("h-[350px]");
    expect(wedges()).toHaveLength(10);
    expect(wedges().reduce((sum, g) => sum + Number(g.dataset.dots), 0)).toBe(1000);
  });

  it("desktop: a 258 box (outer radius 124)", () => {
    mount(early, "desktop");
    expect(panel().querySelector("svg[data-ring]")!.getAttribute("width")).toBe("258");
    expect(screen.getByText("One simulated viewer per group.")).toBeInTheDocument();
  });

  // Found in review (2026-11-20): `leak` has one group three times, so "one per group" is not true there.
  it("the caption does not claim one viewer per group when a group has several", () => {
    mount(leak);
    expect(screen.queryByText("One simulated viewer per group.")).toBeNull();
    expect(screen.getByText("One to three simulated viewers per group.")).toBeInTheDocument();
  });

  it("early at rest: four wedges full, two coral, four pale", () => {
    mount(early);
    const looks = Object.fromEntries(wedges().map((g) => [g.dataset.wedge, g.dataset.look]));
    expect(looks).toEqual({
      high_engager: "full",
      saver: "pale",
      lurker: "full",
      sharer: "full",
      tough_crowd: "coral",
      purposeful_viewer: "coral",
      niche_deep_buyer: "pale",
      niche_deep_scout: "pale",
      loyalist: "full",
      cross_niche_curiosity: "pale",
    });
  });

  it("leak: the two groups that are not in the run are outlines", () => {
    mount(leak);
    expect(wedges().filter((g) => g.dataset.look === "outline").map((g) => g.dataset.wedge)).toEqual([
      "sharer",
      "purposeful_viewer",
    ]);
  });

  it("does not render again while no group's state changes", () => {
    const model = modelOf(early);
    const rows = (t: number) => groupsAt(model.audience, model.verdict, t);
    const plain = ringDots(wedgesOf(rows(model.clipS)), { r1: 74, R: 158 });
    // The ring reads its wedges once per render: count the reads.
    let renders = 0;
    const layout = {
      ...plain,
      get wedges() {
        renders += 1;
        return plain.wedges;
      },
    };
    const view = (t: number) => <AudienceRing layout={layout} looks={wedgeLooks(rows(t), plain)} />;
    const { rerender } = render(view(0.1));
    expect(renders).toBe(1);
    // New arrays every frame, the same states: no render.
    for (const t of [0.4, 0.9, 1.5, 1.99]) rerender(view(t));
    expect(renders).toBe(1);
    // 0:03 passed: two groups have gone.
    rerender(view(3.5));
    expect(renders).toBe(2);
  });
});
