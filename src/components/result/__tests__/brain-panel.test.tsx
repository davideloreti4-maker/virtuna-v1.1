/** @vitest-environment happy-dom */
/**
 * The Brain panel on recorded runs (spec §5 "Brain", plan Task 6). The model, the track, the
 * playhead and the panel are real. Only the WebGL canvas is a stand-in (there is no GL in
 * happy-dom): it records what it is handed, which is what the user would see painted.
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

function mount() {
  return render(
    <PlayheadProvider clipS={model.clipS} scenes={model.audience.scenes}>
      <Probe />
      <BrainPanel model={model} />
    </PlayheadProvider>,
  );
}

const lastHanded = () => handed[handed.length - 1]!;
const valueOf = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-signal="${id}"] [data-value]`)?.textContent;

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

beforeEach(() => {
  handed.length = 0;
  document.documentElement.removeAttribute("data-theme");
  prefersReducedMotion(false);
});
afterEach(() => {
  cleanup();
  window.matchMedia = realMatchMedia;
  document.documentElement.removeAttribute("data-theme");
});

describe("BrainPanel", () => {
  it("shows the four signals in order, the rest key, the legend and the caption", async () => {
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    const labels = [...container.querySelectorAll("[data-signal] [data-label]")].map((el) => el.textContent);
    expect(labels).toEqual(["Eyes", "Focus", "Feeling", "Wandering"]);
    expect(screen.getByText("at rest")).toBeTruthy();
    expect(screen.getByText("calm")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    expect(screen.getByText("A model of attention, not a scan.")).toBeTruthy();
  });

  it("at rest: no time in the corner, the values and the brain at the clip's end", async () => {
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    expect(container.textContent).not.toMatch(/At \d+:\d\d/);
    const end = predictedBold(drive, 29);
    expect(lastHanded().t).toBe(29);
    expect(lastHanded().bold).toEqual(end);
    // Read on the recorded run before building: 54 · 26 · 29 · 50.
    expect(["visual", "dorsal_attention", "limbic", "default"].map((id) => valueOf(container, id))).toEqual(["54", "26", "29", "50"]);
  });

  it("while the playhead moves: the time in the corner, the values and the brain at the playhead", async () => {
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    act(() => playhead.seek(7));
    expect(screen.getByText("At 0:07")).toBeTruthy();
    const at7 = predictedBold(drive, 7);
    expect(lastHanded().t).toBe(7);
    expect(lastHanded().bold).toEqual(at7);
    expect(valueOf(container, "visual")).toBe(String(Math.round(at7.visual * 100)));
    expect(valueOf(container, "default")).toBe(String(Math.round(at7.default * 100)));
    act(() => playhead.seek(29));
    expect(container.textContent).not.toMatch(/At \d+:\d\d/);
  });

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

  it("carries no coral", async () => {
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    act(() => playhead.seek(3));
    expect(container.innerHTML).not.toContain("--color-below");
  });
});
