/** @vitest-environment happy-dom */

/**
 * The video card (spec §4.5), on a RECORDED run: the result page's stored-row fixture `middle`
 * (46 watch to the end, "Half leave by 0:17.", the named scene 8 to 17 of 29) read through the
 * real `videoStateOf`, the same model `/simulation/[id]` renders. `VideoAnswer` reads the row
 * through the real `useSimulationRow` and TanStack Query; only the network (`fetch`) is stood in for.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import middle from "@/lib/result/__tests__/fixtures/middle.json";
import noAudience from "@/lib/result/__tests__/fixtures/no-audience.json";
import type { ResultRow, ResultState, VideoModel } from "@/lib/result/types";
import { videoStateOf } from "@/lib/result/video-model";
import { renderWithClient } from "@/test/render-with-client";
import { MiniCurve } from "../mini-curve";
import { VideoAnswer, VideoAnswerView } from "../video-answer";
import { video } from "./fixtures/answers";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ROW = middle as unknown as ResultRow;
const resultState = (): Extract<ResultState, { kind: "result" }> => {
  const state = videoStateOf(ROW);
  if (state.kind !== "result") throw new Error(`fixture middle reads as ${state.kind}`);
  return state;
};
const model = (): VideoModel => resultState().model;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("VideoAnswerView — a finished run", () => {
  it("shows the number, the sentence and a link to the result", () => {
    render(<VideoAnswerView state={resultState()} posterUrl={null} href="/simulation/fixture-middle" />);
    expect(screen.getByRole("img", { name: "46% watch to the end" })).toBeInTheDocument();
    expect(screen.getByText("Half leave by 0:17.")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Open simulation" });
    expect(link).toHaveAttribute("href", "/simulation/fixture-middle");
    expect(link).not.toHaveTextContent(/credit/);
  });

  it("the first paint already holds both layouts: a server render (no effects) carries the desk placement", () => {
    // No effect runs in a server render, so what it prints is the first paint: the phone and the desk
    // layout are the same tree, placed by the md: breakpoint, never switched after mount.
    const html = renderToStaticMarkup(
      <VideoAnswerView state={resultState()} posterUrl="/frames/0.jpg" href="/simulation/fixture-middle" />,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const cls = (selector: string) => doc.querySelector(selector)?.getAttribute("class")?.split(/\s+/) ?? [];
    expect(doc.body.textContent).toContain("Half leave by 0:17.");
    // The picture: 96 on a phone, 120 on a desk, down both desk rows.
    expect(cls('[data-part="thumb"]')).toEqual(expect.arrayContaining(["w-24", "md:w-[120px]", "md:row-[1/3]"]));
    // The gauge: beside the picture on both; centred on a phone, 28 from the picture on a desk.
    expect(cls('[data-part="dial"]')).toEqual(expect.arrayContaining(["col-start-2", "justify-self-center", "md:ml-7", "md:justify-self-start"]));
    // The sentence: under the line on a phone, beside the gauge on a desk.
    expect(cls('[data-part="say"]')).toEqual(expect.arrayContaining(["row-start-3", "md:row-start-1", "md:col-[3/4]"]));
    // The line: the card's width × 72 on a phone, the right column's foot × 64 on a desk.
    expect(cls('[data-part="curve-box"]')).toEqual(
      expect.arrayContaining(["col-[1/3]", "h-[72px]", "md:col-[2/4]", "md:row-start-2", "md:h-16", "md:self-end"]),
    );
    expect(doc.querySelector('[data-part="curve"]')).not.toBeNull();
    // One tree: no second layout in the markup.
    expect(doc.querySelectorAll('[data-part="thumb"]')).toHaveLength(1);
    expect(doc.querySelectorAll('[data-result="gauge"]')).toHaveLength(1);
  });

  it("the gauge's label in two lines, as drawn at 140", () => {
    const { container } = render(
      <VideoAnswerView state={resultState()} posterUrl={null} href="/simulation/fixture-middle" />,
    );
    const gauge = container.querySelector('[data-result="gauge"]')!;
    expect([...gauge.querySelectorAll("text")].slice(1).map((t) => t.textContent)).toEqual(["watch to", "the end"]);
  });

  it("draws the line with the named scene banded", () => {
    const { container } = render(
      <VideoAnswerView state={resultState()} posterUrl={null} href="/simulation/fixture-middle" />,
    );
    expect(container.querySelector('[data-part="curve"]')).toBeInTheDocument();
    expect(container.querySelector('[data-part="band"]')).toBeInTheDocument();
  });

  it("shows the poster, and a plain tile when it fails", () => {
    const { container } = render(
      <VideoAnswerView state={resultState()} posterUrl="/frames/0.jpg" href="/simulation/fixture-middle" />,
    );
    const img = container.querySelector<HTMLImageElement>('[data-part="thumb"] img');
    expect(img).toHaveAttribute("src", "/frames/0.jpg");
    fireEvent.error(img!);
    expect(container.querySelector('[data-part="thumb"] img')).toBeNull();
    expect(container.querySelector('[data-part="thumb"]')).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <VideoAnswerView state={resultState()} posterUrl="/frames/0.jpg" href="/simulation/fixture-middle" />,
    );
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("VideoAnswerView — before the result", () => {
  it.each<[string, ResultState]>([
    ["loading", { kind: "loading" }],
    ["running", { kind: "running", id: "fixture-middle", startedAt: null }],
  ])("%s: the gauge's track with no number, and the link", (_, state) => {
    const { container } = render(<VideoAnswerView state={state} posterUrl={null} href="/simulation/fixture-middle" />);
    expect(container.querySelector('[data-part="track-only"]')).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /%/ })).toBeNull();
    expect(container.textContent).not.toMatch(/\d+%/);
    expect(container.querySelector('[data-part="curve"]')).toBeNull();
    expect(screen.getByRole("link", { name: "Open simulation" })).toHaveAttribute("href", "/simulation/fixture-middle");
  });

  it.each<[string, ResultState]>([
    ["no audience", videoStateOf(noAudience as unknown as ResultRow)],
    ["stalled", { kind: "stalled", id: "fixture-middle" }],
  ])("%s: the thumbnail and the link only", (_, state) => {
    const { container } = render(<VideoAnswerView state={state} posterUrl={null} href="/simulation/fixture-middle" />);
    expect(container.querySelector('[data-part="thumb"]')).toBeInTheDocument();
    expect(container.querySelector('[data-part="track-only"]')).toBeNull();
    expect(container.querySelector("[data-result='gauge']")).toBeNull();
    expect(screen.getByRole("link", { name: "Open simulation" })).toBeInTheDocument();
  });
});

describe("MiniCurve", () => {
  it("draws the line, a tick at each scene border and the band over the named scene", () => {
    const m = model();
    const { container } = render(
      <MiniCurve points={m.audience.points} clipS={m.clipS} band={{ t0: 8, t1: 17 }} width={290} height={72} />,
    );
    // middle: scenes end at 3, 8, 17, 29 → borders at 3, 8 and 17.
    expect(container.querySelectorAll('[data-part="tick"]')).toHaveLength(3);
    const band = container.querySelector('[data-part="band"]')!;
    expect(Number(band.getAttribute("x"))).toBeCloseTo((8 / 29) * 290, 1);
    expect(Number(band.getAttribute("width"))).toBeCloseTo((9 / 29) * 290, 1);
    expect(band.getAttribute("fill")).toBe("var(--color-accent)");
    expect(container.querySelector('[data-part="line"]')?.getAttribute("stroke")).toBe("var(--color-foreground)");
    expect(container.querySelector('[data-part="loss"]')?.getAttribute("stroke")).toBe("var(--color-accent)");
    // The line starts at 100% (3 from the top) and ends at the last share.
    const d = container.querySelector('[data-part="line"]')!.getAttribute("d")!;
    expect(d.startsWith("M0.00 3.00")).toBe(true);
  });

  it("without a named scene: no band and no coral", () => {
    const m = model();
    const { container } = render(<MiniCurve points={m.audience.points} clipS={m.clipS} band={null} width={290} height={72} />);
    expect(container.querySelector('[data-part="band"]')).toBeNull();
    expect(container.querySelector('[data-part="loss"]')).toBeNull();
    expect(container.innerHTML).not.toMatch(/accent/);
  });
});

describe("VideoAnswer — the stored row behind the card", () => {
  it("lays itself out with CSS: it never asks a media query", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(middle)));
    const matchMedia = vi.spyOn(window, "matchMedia");
    renderWithClient(<VideoAnswer block={video("fixture-middle")} />);
    await screen.findByText("Half leave by 0:17.");
    expect(matchMedia).not.toHaveBeenCalled();
    matchMedia.mockRestore();
  });

  it("reads GET /api/analysis/[id] and shows the result", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("/api/analysis/fixture-middle");
      return json(middle);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<VideoAnswer block={video("fixture-middle")} />);
    expect(await screen.findByText("Half leave by 0:17.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "46% watch to the end" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open simulation" })).toHaveAttribute("href", "/simulation/fixture-middle");
  });

  it("while the row loads: the track, no number", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    const { container } = renderWithClient(<VideoAnswer block={video("fixture-middle")} />);
    expect(container.querySelector('[data-part="track-only"]')).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /%/ })).toBeNull();
  });

  it("a row that cannot be read: the thumbnail and the link only", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "not found" }, 404)));
    const { container } = renderWithClient(<VideoAnswer block={video("gone")} />);
    await waitFor(() => expect(container.querySelector('[data-part="track-only"]')).toBeNull(), { timeout: 4000 });
    expect(container.querySelector('[data-part="thumb"]')).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open simulation" })).toHaveAttribute("href", "/simulation/gone");
  });

  it("the poster: the first scene frame, else the card's first filmstrip frame", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(middle)));
    const block = video("fixture-middle", {
      filmstrip: [{ idx: 0, label: "Cold open", atMs: 0, mark: null, keyframeUrl: "/frames/strip-0.jpg" }],
    });
    const { container } = renderWithClient(<VideoAnswer block={block} />);
    await screen.findByText("Half leave by 0:17.");
    // The fixture's stored frames have expired (null): the card's filmstrip frame.
    expect(container.querySelector('[data-part="thumb"] img')).toHaveAttribute("src", "/frames/strip-0.jpg");
    cleanup();

    const withFrames = {
      ...middle,
      variants: { filmstrip_segments: middle.variants.filmstrip_segments.map((f) => ({ ...f, keyframe_uri: `/frames/scene-${f.idx}.jpg` })) },
    };
    vi.stubGlobal("fetch", vi.fn(async () => json(withFrames)));
    const second = renderWithClient(<VideoAnswer block={block} />);
    await screen.findByText("Half leave by 0:17.");
    expect(second.container.querySelector('[data-part="thumb"] img')).toHaveAttribute("src", "/frames/scene-0.jpg");
  });
});
