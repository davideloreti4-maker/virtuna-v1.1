/** @vitest-environment happy-dom */
/**
 * The Brain page on recorded runs: the brain picture as built, and the signals card in
 * words. The model, the track, the reading in words, the playhead and the panel are real. Stand-ins:
 * the WebGL canvas (there is no GL in happy-dom: it records what it is handed, which is what the user
 * would see painted), the motion setting (matchMedia) and, for the widths, the card's measured width
 * (`clientWidth`: happy-dom lays nothing out).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

// The flag is a build-time constant; this file is the flag-on build (the page exists only there).
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

interface CanvasProps {
  seed: number;
  bold: Record<string, number>;
  t: number;
  reducedMotion?: boolean;
  look?: string;
}
const handed: CanvasProps[] = [];
vi.mock("@/components/audience-lens/CortexCanvas", () => ({
  default: (props: CanvasProps) => {
    handed.push(props);
    return <div data-testid="cortex-stand-in" data-look={props.look} />;
  },
}));

import { predictedBold } from "@/lib/brain/cortex-sim";
import { brainTrackOf } from "@/lib/result/brain-track";
import { videoStateOf } from "@/lib/result/video-model";
import type { ResultRow, VideoModel } from "@/lib/result/types";
import early from "@/lib/result/__tests__/fixtures/early.json";
import middle from "@/lib/result/__tests__/fixtures/middle.json";
import { PlayheadProvider, usePlayhead, type Playhead } from "../playhead";
import { BrainPanel } from "../brain-panel";

function modelOf(fixture: unknown): VideoModel {
  const state = videoStateOf(fixture as ResultRow);
  if (state.kind !== "result") throw new Error(`fixture is ${state.kind}, not a result`);
  return state.model;
}

let playhead: Playhead;
function Probe() {
  const current = usePlayhead();
  useEffect(() => {
    playhead = current;
  });
  return null;
}

const model = modelOf(early);
const drive = brainTrackOf(model).drive;
const IDS = ["visual", "dorsal_attention", "limbic", "default"] as const;

function mount(m: VideoModel = model) {
  return render(
    <PlayheadProvider clipS={m.clipS} scenes={m.audience.scenes}>
      <Probe />
      <BrainPanel model={m} />
    </PlayheadProvider>,
  );
}

const lastHanded = () => handed[handed.length - 1]!;
const part = (c: HTMLElement, name: string) => c.querySelector<HTMLElement>(`[data-part="${name}"]`)!;
const stage = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-result="brain-stage"]')!;
const words = (c: HTMLElement) => IDS.map((id) => c.querySelector(`[data-signal="${id}"] [data-word]`)?.textContent);
const marks = (c: HTMLElement) => [...c.querySelectorAll('[data-part="moment-mark"]')];
const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

const realMatchMedia = window.matchMedia;
/** The user's motion setting, as the browser reports it. */
function prefersReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("no-preference") ? !reduce : reduce,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** The signals card's inside as a browser would measure it. */
function cardInside(width: number) {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.result === "brain-signals" ? width : 0;
    },
  });
}

beforeEach(() => {
  handed.length = 0;
  document.documentElement.removeAttribute("data-theme");
  prefersReducedMotion(false);
});
afterEach(() => {
  cleanup();
  window.matchMedia = realMatchMedia;
  document.documentElement.removeAttribute("data-theme");
  Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
});

describe("BrainPanel: the signals card", () => {
  it("one sentence from Focus, the moment line, the four signals and what each stands for; the picture and the caption as built", async () => {
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    expect(part(container, "focus-sentence").textContent).toBe("Focus is highest at 0:07 and lowest at 0:16.");
    expect(part(container, "moment-line").textContent).toBe("At 0:29 · the dashed line is at rest");
    const rows = [...container.querySelectorAll("[data-signal]")];
    expect(rows.map((row) => row.querySelector("[data-label]")!.textContent)).toEqual(["Eyes", "Focus", "Feeling", "Wandering"]);
    expect(rows.map((row) => row.querySelector("[data-meaning]")!.textContent)).toEqual([
      "what there is to look at",
      "how closely they follow",
      "how much it moves them",
      "how far the mind drifts",
    ]);
    expect(follows(part(container, "focus-sentence"), part(container, "moment-line"))).toBe(true);
    expect(follows(part(container, "moment-line"), rows[0]!)).toBe(true);
    // No bare numbers in the rows, no legend row.
    expect(container.querySelector("[data-value]")).toBeNull();
    expect(screen.queryByText("at rest")).toBeNull();
    expect(screen.getByText("calm")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    expect(screen.getByText("A model of attention, not a scan.")).toBeTruthy();
  });

  it("draws the sentence of the run it shows (middle: a fall that ends before the cut names no scene)", async () => {
    const { container } = mount(modelOf(middle));
    await screen.findByTestId("cortex-stand-in");
    expect(part(container, "focus-sentence").textContent).toBe("Focus is highest at 0:10 and lowest at 0:23.");
  });

  it("at rest: no time in the corner, no moment line on the curves, the words and the brain at the clip's end", async () => {
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    expect(stage(container).textContent).not.toMatch(/At \d+:\d\d/);
    expect(marks(container)).toHaveLength(0);
    expect(words(container)).toEqual(["above rest", "above rest", "above rest", "above rest"]);
    expect(lastHanded().t).toBe(29);
    expect(lastHanded().bold).toEqual(predictedBold(drive, 29));
  });

  it("away from rest: the time in the corner and the moment line, the words at the moment, a coral line at it on every curve", async () => {
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    act(() => playhead.seek(7));
    expect(stage(container).textContent).toContain("At 0:07");
    expect(part(container, "moment-line").textContent).toBe("At 0:07 · the dashed line is at rest");
    expect(words(container)).toEqual(["above rest", "above rest", "above rest", "below rest"]);
    expect(lastHanded().t).toBe(7);
    expect(lastHanded().bold).toEqual(predictedBold(drive, 7));
    expect(marks(container)).toHaveLength(4);
    for (const id of IDS) {
      const row = container.querySelector(`[data-signal="${id}"]`)!;
      const mark = row.querySelector('[data-part="moment-mark"]')!;
      expect(mark.getAttribute("stroke")).toBe("var(--color-below)");
      // At the video's moment, where the curve's dot stands.
      expect(parseFloat(mark.getAttribute("d")!.slice(1))).toBeCloseTo(Number(row.querySelector("circle")!.getAttribute("cx")), 1);
    }
    act(() => playhead.seek(29));
    expect(marks(container)).toHaveLength(0);
    expect(stage(container).textContent).not.toMatch(/At \d+:\d\d/);
  });

  it("at 0:00 every signal is at rest", async () => {
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    act(() => playhead.seek(0));
    expect(words(container)).toEqual(["at rest", "at rest", "at rest", "at rest"]);
    expect(part(container, "moment-line").textContent).toBe("At 0:00 · the dashed line is at rest");
  });

  it("coral only at the video's moment: none at rest, the four moment lines alone away from it", async () => {
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    expect(container.innerHTML).not.toContain("--color-below");
    act(() => playhead.seek(3));
    const coral = [...container.querySelectorAll('[stroke*="below"], [fill*="below"], [class*="below"]')];
    expect(coral).toHaveLength(4);
    for (const el of coral) expect(el.getAttribute("data-part")).toBe("moment-mark");
  });

  it("a card with room: the name's column 112, the word's 74, the curve the rest", async () => {
    // Not the width the panel assumes before it has measured (325): the measured one must be what is used.
    cardInside(340);
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    const row = container.querySelector('[data-signal="visual"]')!;
    expect(row.querySelector<HTMLElement>("[data-label]")!.parentElement!.style.width).toBe("112px");
    expect(row.querySelector<HTMLElement>("[data-word]")!.style.width).toBe("74px");
    expect(row.querySelector("svg")!.getAttribute("width")).toBe("134");
  });

  it("a 320 phone: the name's column narrows to 96 (the meaning on two lines); the word never wraps", async () => {
    cardInside(252);
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    const row = container.querySelector('[data-signal="visual"]')!;
    expect(row.querySelector<HTMLElement>("[data-label]")!.parentElement!.style.width).toBe("96px");
    expect(row.querySelector("svg")!.getAttribute("width")).toBe("62");
    expect(row.querySelector("[data-word]")!.className).toMatch(/\bwhitespace-nowrap\b/);
    expect(row.querySelector("[data-meaning]")!.className).toMatch(/\bblock\b/);
  });

  it("a wide panel: the cards side by side as tall as their content; the brain at the phone's size, centred", async () => {
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    const grid = container.querySelector('[data-result="brain"]')!.firstElementChild!;
    expect(grid.className).toContain("@min-[520px]:grid");
    expect(grid.className).not.toContain("h-[216px]");
    expect(stage(container).className).toContain("@min-[520px]:h-auto");
    const canvasBox = screen.getByTestId("cortex-stand-in").parentElement!;
    expect(canvasBox.className).toContain("h-[232px]");
    expect(canvasBox.className).not.toMatch(/@min-\[520px\]:h-/);
    expect(canvasBox.className).toContain("@min-[520px]:top-[calc(50%-116px)]");
    const signals = container.querySelector('[data-result="brain-signals"]')!;
    expect(signals.className).not.toMatch(/min-h-0/);
    for (const row of container.querySelectorAll("[data-signal]")) expect(row.className).not.toMatch(/flex-1/);
  });
});

describe("BrainPanel: the brain, as built", () => {
  it("hands the brain a new reading at most every quarter second", async () => {
    mount();
    await screen.findByTestId("cortex-stand-in");
    act(() => playhead.seek(7.1));
    const first = lastHanded().bold;
    expect(lastHanded().t).toBe(7);
    act(() => playhead.seek(7.2));
    expect(lastHanded().bold).toBe(first);
    act(() => playhead.seek(7.3));
    expect(lastHanded().t).toBe(7.25);
    expect(lastHanded().bold).toEqual(predictedBold(drive, 7.25));
  });

  it("renders the brain once per quarter second while the playhead moves, not once per frame", async () => {
    mount();
    await screen.findByTestId("cortex-stand-in");
    // At rest nothing moves: a new playhead value that changes nothing renders nothing below.
    handed.length = 0;
    act(() => playhead.seek(29));
    expect(handed).toHaveLength(0);
    // Frames inside one quarter second (7.00 to 7.24): one render, on entering it.
    for (const t of [7, 7.04, 7.09, 7.13, 7.18, 7.22]) act(() => playhead.seek(t));
    expect(handed).toHaveLength(1);
    // Crossing into the next quarter (7.25): one more.
    for (const t of [7.26, 7.3, 7.35]) act(() => playhead.seek(t));
    expect(handed).toHaveLength(2);
    expect(lastHanded().t).toBe(7.25);
    // The corner alone: the moment line holds the whole sentence, so an exact match misses it.
    expect(screen.getByText("At 0:07")).toBeTruthy();
  });

  it("paints porcelain for the theme, and follows a change of theme", async () => {
    mount();
    expect((await screen.findByTestId("cortex-stand-in")).dataset.look).toBe("porcelain-light");
    act(() => document.documentElement.setAttribute("data-theme", "dark"));
    await waitFor(() => expect(screen.getByTestId("cortex-stand-in").dataset.look).toBe("porcelain-dark"));
  });

  it("does not drift when the user asks for reduced motion", async () => {
    prefersReducedMotion(true);
    mount();
    await screen.findByTestId("cortex-stand-in");
    await waitFor(() => expect(lastHanded().reducedMotion).toBe(true));
    cleanup();
    handed.length = 0;
    prefersReducedMotion(false);
    mount();
    await screen.findByTestId("cortex-stand-in");
    await waitFor(() => expect(lastHanded().reducedMotion).toBe(false));
  });
});
