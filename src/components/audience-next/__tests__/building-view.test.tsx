/** @vitest-environment happy-dom */
/**
 * BuildingView — a read while it runs, and its outcomes (spec 2026-11-25-audience, 3.6). The states are
 * the real reducer's (`startBuild` + `applyEvent` on events as the stream reader gives them), with the
 * server's own step names. Stand-ins: the build-time flag (on). The handlers are spies.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { AUDIENCE_STRINGS as S, fromVideos, readCount } from "@/lib/audience-next/audience-words";
import { buildRequestOf, type BuildRequest } from "@/lib/audience-next/build-request";
import { applyEvent, startBuild, type BuildState } from "@/lib/audience-next/build-state";
import type { BuildEvent } from "@/lib/audience-next/build-stream";

import { BuildingView, type BuildingViewProps } from "../building-view";

afterEach(cleanup);

const OWN = buildRequestOf("own", "nia.tests")!;
const DESCRIBED = buildRequestOf("describe", "Busy parents who meal-prep")!;
const READ = "Reading your followers";
const WATCH = "Watching your videos";
const BUILD = "Building your audience profile";
const SYNTHESIS = "We read @nia.tests fine — building the audience from it is what failed. Nothing is wrong with the handle; try again.";

const stage = (name: string, status: "active" | "done"): BuildEvent => ({ type: "stage", name, status });
const covers = (n: number) => Array.from({ length: n }, (_, i) => `https://cdn.example.test/cover-${i}.jpg`);
const evidence = (count: number, picture: string | null = null): BuildEvent => ({ type: "evidence", handle: "nia.tests", picture, covers: covers(count), count });
const stateOf = (events: BuildEvent[], request: BuildRequest = OWN): BuildState => events.reduce(applyEvent, startBuild(request));

const AT_WATCH = [stage(READ, "active"), stage(READ, "done"), stage(WATCH, "active")];

function show(props: Partial<BuildingViewProps> & { state: BuildState }) {
  const handlers = { onTryAgain: vi.fn(), onUseGeneral: vi.fn(), onTryAnother: vi.fn(), onClose: vi.fn() };
  const view = render(<BuildingView slow={false} mode="new" whose="your" initial="N" {...handlers} {...props} />);
  return { ...view, ...handlers };
}

const fullWedges = (container: HTMLElement) => [...container.querySelectorAll('[data-wedge][data-look="full"]')].map((w) => w.getAttribute("data-wedge"));
const stepRows = () => within(screen.getByRole("list", { name: S.building })).getAllByRole("listitem");

describe("BuildingView: while the read runs", () => {
  it("the title, the ring of ten pale wedges, the initial in the middle, the three steps all next", () => {
    const { container } = show({ state: startBuild(OWN) });
    expect(screen.getByRole("heading", { level: 2, name: S.building })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-wedge]")).toHaveLength(10);
    expect(fullWedges(container)).toEqual([]);
    expect(container.querySelector("[data-face]")).toHaveTextContent("N");
    const rows = stepRows();
    expect(rows.map((r) => r.getAttribute("data-step"))).toEqual(["next", "next", "next"]);
    expect(rows.map((r) => r.textContent)).toEqual([`${READ} (${S.stepNext})`, `${WATCH} (${S.stepNext})`, `${BUILD} (${S.stepNext})`]);
  });

  it("the steps follow the server: done, now (the stronger weight), next; the status line names the step now", () => {
    show({ state: stateOf(AT_WATCH) });
    const rows = stepRows();
    expect(rows.map((r) => r.getAttribute("data-step"))).toEqual(["done", "now", "next"]);
    expect(rows[0]).toHaveTextContent(`${READ} (${S.stepDone})`);
    expect(rows[1]).toHaveTextContent(`${WATCH} (${S.stepNow})`);
    expect(within(rows[1]!).getByText(WATCH).className).toMatch(/font-\[620\]/);
    expect(within(rows[2]!).getByText(BUILD).className).toMatch(/text-foreground-muted/);
    expect(screen.getByRole("status")).toHaveTextContent(WATCH);
  });

  it("wedges light clockwise from the top as steps finish: 3, then 7, then all 10 once the audience is made", () => {
    const { container, rerender } = show({ state: stateOf(AT_WATCH) });
    expect(fullWedges(container)).toEqual(["0", "1", "2"]);
    const props = { slow: false, mode: "new" as const, whose: "your" as const, initial: "N", onTryAgain: vi.fn() };
    rerender(<BuildingView {...props} state={stateOf([...AT_WATCH, stage(WATCH, "done"), stage(BUILD, "active")])} />);
    expect(fullWedges(container)).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
    rerender(<BuildingView {...props} state={stateOf([...AT_WATCH, { type: "done", audienceId: "a-1" }])} />);
    expect(fullWedges(container)).toHaveLength(10);
    expect(stepRows().map((r) => r.getAttribute("data-step"))).toEqual(["done", "done", "done"]);
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("asks to keep the page open, under the steps", () => {
    show({ state: stateOf(AT_WATCH) });
    expect(screen.getByText(S.keepOpen)).toBeInTheDocument();
  });

  it("no count of viewers, no percent, no time left", () => {
    const { container } = show({ state: stateOf([...AT_WATCH, evidence(12)]) });
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/%|1,000|viewers|\d+:\d\d|minute|second/);
  });

  it("the picture the read delivers shows in the middle, over the initial", () => {
    const { container } = show({ state: stateOf([evidence(0, "https://cdn.example.test/nia.jpg")]) });
    const face = container.querySelector("[data-face]")!;
    expect(face.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example.test/nia.jpg");
    expect(face).toHaveTextContent("N");
  });

  it("once videos have come: “From your videos” over “12 read”, with four covers", () => {
    const { container } = show({ state: stateOf([...AT_WATCH, evidence(12)]) });
    const card = container.querySelector("[data-evidence]") as HTMLElement;
    expect(within(card).getByText(fromVideos("your"))).toBeInTheDocument();
    expect(within(card).getByText(readCount(12))).toBeInTheDocument();
    const imgs = [...card.querySelectorAll("img")];
    expect(imgs.map((i) => i.getAttribute("src"))).toEqual(covers(4));
    expect(imgs.every((i) => i.getAttribute("alt") === "")).toBe(true);
  });

  it("another creator's: “From their videos”; fewer covers than four show as they are", () => {
    const { container } = show({ state: stateOf([evidence(2)]), whose: "their" });
    const card = container.querySelector("[data-evidence]") as HTMLElement;
    expect(card).toHaveTextContent(fromVideos("their"));
    expect(card).toHaveTextContent(readCount(2));
    expect(card.querySelectorAll("img")).toHaveLength(2);
  });

  it("no card before videos have come, with no videos, or for a description", () => {
    const { container, rerender } = show({ state: stateOf(AT_WATCH) });
    expect(container.querySelector("[data-evidence]")).toBeNull();
    rerender(<BuildingView state={stateOf([evidence(0, "https://cdn.example.test/nia.jpg")])} slow={false} mode="new" whose="your" initial="N" onTryAgain={vi.fn()} />);
    expect(container.querySelector("[data-evidence]")).toBeNull();
    rerender(<BuildingView state={stateOf([evidence(5)], DESCRIBED)} slow={false} mode="new" whose={null} initial="B" onTryAgain={vi.fn()} />);
    expect(container.querySelector("[data-evidence]")).toBeNull();
  });

  it("two videos with the same cover address both show, with no clash of keys", () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const same = "https://cdn.example.test/same.jpg";
      const { container } = show({ state: stateOf([{ type: "evidence", handle: "nia.tests", picture: null, covers: [same, same, covers(1)[0]!], count: 3 }]) });
      const imgs = [...container.querySelector("[data-evidence]")!.querySelectorAll("img")].map((i) => i.getAttribute("src"));
      expect(imgs).toEqual([same, same, covers(1)[0]]);
      expect(warn.mock.calls.filter((c) => String(c[0]).includes("same key"))).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it("a cover that fails to load is removed", () => {
    const { container } = show({ state: stateOf([evidence(3)]) });
    const card = container.querySelector("[data-evidence]") as HTMLElement;
    fireEvent.error(card.querySelectorAll("img")[1]!);
    expect([...card.querySelectorAll("img")].map((i) => i.getAttribute("src"))).toEqual([covers(3)[0], covers(3)[2]]);
  });

  it("slow and still running: “Taking longer than usual.”; not once the audience is made", () => {
    const { rerender } = show({ state: stateOf(AT_WATCH), slow: true });
    expect(screen.getByText(S.slow)).toBeInTheDocument();
    rerender(<BuildingView state={stateOf([{ type: "done", audienceId: "a-1" }])} slow mode="new" whose="your" initial="N" onTryAgain={vi.fn()} />);
    expect(screen.queryByText(S.slow)).toBeNull();
    rerender(<BuildingView state={stateOf(AT_WATCH)} slow={false} mode="new" whose="your" initial="N" onTryAgain={vi.fn()} />);
    expect(screen.queryByText(S.slow)).toBeNull();
  });

  it("the title takes the focus when the view opens (the form's button is gone)", () => {
    show({ state: startBuild(OWN) });
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2, name: S.building }));
  });
});

describe("BuildingView: too little to read", () => {
  const thin = stateOf([stage(READ, "active"), { type: "fallback" }]);

  it("new: the title, the sentence, Use general viewers (ink) and Try another account", () => {
    const { onUseGeneral, onTryAnother } = show({ state: thin });
    expect(screen.getByRole("heading", { level: 2, name: S.thinTitle })).toBeInTheDocument();
    expect(screen.getByText("@nia.tests doesn't have enough public videos to read yet.")).toBeInTheDocument();
    const general = screen.getByRole("button", { name: S.useGeneral });
    expect(general.className).toMatch(/bg-action/);
    fireEvent.click(general);
    expect(onUseGeneral).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: S.tryAnother }));
    expect(onTryAnother).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(S.keptAsWas)).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("new, for a creator who already has an audience in use (no Use general viewers given): Try another account is the main button, ink", () => {
    const { onTryAnother } = show({ state: thin, onUseGeneral: undefined });
    expect(screen.queryByRole("button", { name: S.useGeneral })).toBeNull();
    const another = screen.getByRole("button", { name: S.tryAnother });
    expect(another.className).toMatch(/bg-action/);
    fireEvent.click(another);
    expect(onTryAnother).toHaveBeenCalledTimes(1);
  });

  it("a description's: Change the description", () => {
    show({ state: stateOf([{ type: "fallback" }], DESCRIBED), whose: null, tryAnotherLabel: S.changeDescription });
    expect(screen.getByText("There weren't enough videos for that description yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: S.changeDescription })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: S.tryAnother })).toBeNull();
  });

  it("again: the title, the sentence, The groups stay as they were., Close", () => {
    const { onClose } = show({ state: thin, mode: "again" });
    expect(screen.getByRole("heading", { level: 2, name: S.thinTitle })).toBeInTheDocument();
    expect(screen.getByText(S.keptAsWas)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: S.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: S.useGeneral })).toBeNull();
    expect(screen.queryByRole("button", { name: S.tryAnother })).toBeNull();
  });

  it("the title takes the focus", () => {
    const { rerender } = show({ state: stateOf(AT_WATCH) });
    rerender(<BuildingView state={thin} slow={false} mode="new" whose="your" initial="N" onTryAgain={vi.fn()} onUseGeneral={vi.fn()} onTryAnother={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2, name: S.thinTitle }));
  });
});

describe("BuildingView: a failed read", () => {
  it("new: the server's synthesis sentence as an alert, and Try again", () => {
    const { onTryAgain } = show({ state: stateOf([{ type: "error", message: SYNTHESIS }]) });
    expect(screen.getByRole("alert")).toHaveTextContent(SYNTHESIS);
    fireEvent.click(screen.getByRole("button", { name: S.tryAgain }));
    expect(onTryAgain).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: S.close })).toBeNull();
  });

  it("new: under Try again, the quiet way to change what was typed (a mistyped handle is not a dead end)", () => {
    const { onTryAnother } = show({ state: stateOf([{ type: "error", message: null }]), tryAnotherLabel: S.tryAnother });
    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual([S.tryAgain, S.tryAnother]);
    expect(screen.getByRole("button", { name: S.tryAnother }).className).not.toMatch(/bg-action/);
    fireEvent.click(screen.getByRole("button", { name: S.tryAnother }));
    expect(onTryAnother).toHaveBeenCalledTimes(1);
  });

  it("new, a description's: Change the description", () => {
    show({ state: stateOf([{ type: "error", message: null }], DESCRIBED), whose: null, tryAnotherLabel: S.changeDescription });
    expect(screen.getByRole("button", { name: S.changeDescription })).toBeInTheDocument();
  });

  it("new: the local sentence", () => {
    show({ state: stateOf([{ type: "error", message: "Calibration failed. Check the handle and try again." }]) });
    expect(screen.getByRole("alert")).toHaveTextContent(S.accountNotFound);
  });

  it("again: the sentence, Try again, Close", () => {
    const { onTryAgain, onClose } = show({ state: stateOf([{ type: "error", message: null }]), mode: "again" });
    expect(screen.getByRole("alert")).toHaveTextContent(S.accountNotFound);
    fireEvent.click(screen.getByRole("button", { name: S.tryAgain }));
    fireEvent.click(screen.getByRole("button", { name: S.close }));
    expect(onTryAgain).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Try again takes the focus", () => {
    show({ state: stateOf([{ type: "error", message: null }]) });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: S.tryAgain }));
  });
});

describe("BuildingView: a cover that failed before the page woke up", () => {
  /** The image's load state, as a browser reports it for an image that finished loading. */
  function loaded(complete: boolean, naturalWidth: number) {
    const c = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "complete");
    const w = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "naturalWidth");
    Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => complete });
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", { configurable: true, get: () => naturalWidth });
    return () => {
      if (c) Object.defineProperty(HTMLImageElement.prototype, "complete", c);
      else delete (HTMLImageElement.prototype as { complete?: boolean }).complete;
      if (w) Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", w);
      else delete (HTMLImageElement.prototype as { naturalWidth?: number }).naturalWidth;
    };
  }

  it("finished with no width: removed", () => {
    const restore = loaded(true, 0);
    try {
      const { container } = show({ state: stateOf([evidence(3)]) });
      expect(container.querySelector("[data-evidence]")!.querySelectorAll("img")).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it("finished and drawn, or still loading: kept", () => {
    for (const [complete, width] of [
      [true, 120],
      [false, 0],
    ] as const) {
      const restore = loaded(complete, width);
      try {
        const { container, unmount } = show({ state: stateOf([evidence(3)]) });
        expect(container.querySelector("[data-evidence]")!.querySelectorAll("img")).toHaveLength(3);
        unmount();
      } finally {
        restore();
      }
    }
  });
});

describe("BuildingView: axe", () => {
  it.each([
    ["running with evidence", { state: stateOf([...AT_WATCH, evidence(12, "https://cdn.example.test/nia.jpg")]), slow: true }],
    ["settling", { state: stateOf([{ type: "done", audienceId: "a-1" }]) }],
    ["thin", { state: stateOf([{ type: "fallback" }]) }],
    ["failed", { state: stateOf([{ type: "error", message: SYNTHESIS }]) }],
    ["again, thin", { state: stateOf([{ type: "fallback" }]), mode: "again" as const }],
    ["again, failed", { state: stateOf([{ type: "error", message: null }]), mode: "again" as const }],
  ])("%s is clean", async (_name, props) => {
    const { container } = show(props);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});
