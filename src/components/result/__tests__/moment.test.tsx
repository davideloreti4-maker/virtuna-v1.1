/** @vitest-environment happy-dom */
/**
 * The moment (plan Task 3, spec §5 "The moment"): one row under the hero. A button that plays from
 * the named scene, only when the sentence names one. Real component and playhead, recorded runs.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import early from "@/lib/result/__tests__/fixtures/early.json";
import holds from "@/lib/result/__tests__/fixtures/holds.json";
import leak from "@/lib/result/__tests__/fixtures/leak.json";
import middle from "@/lib/result/__tests__/fixtures/middle.json";
import { Moment } from "../moment";
import { FRAME_BASE, modelOf, playhead, renderWithPlayhead } from "./hero-harness";

const DESCRIPTION = "Motorcycle drives into deep mud puddle, both riders fall in and splash.";

describe("Moment", () => {
  it("early, with frames: one button with the scene's frame, the sentence and the description", () => {
    const { container } = renderWithPlayhead(modelOf(early, { frames: true }), <Moment model={modelOf(early, { frames: true })} />);
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("A third leave by 0:03.");
    expect(button).toHaveTextContent(DESCRIPTION);
    const frame = button.querySelector("img")!;
    expect(frame.getAttribute("src")).toBe(`${FRAME_BASE}/1.jpg`);
    // A small play mark on the frame, not glass.
    const mark = button.querySelector('[data-part="mark"]')!;
    expect(mark).not.toBeNull();
    expect(mark.getAttribute("style") ?? "").not.toMatch(/blur/);
    expect(container.querySelector('[data-result="moment"]')).toBe(button);
  });

  it("pressing it plays from the start of that scene (here: no video, so it moves the playhead)", () => {
    const model = modelOf(early);
    renderWithPlayhead(model, <Moment model={model} />);
    expect(playhead.current.t).toBe(29);
    fireEvent.click(screen.getByRole("button"));
    expect(playhead.current.t).toBe(2);
  });

  it("no frame: the sentence and the description, still a button", () => {
    const model = modelOf(middle);
    renderWithPlayhead(model, <Moment model={model} />);
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("Half leave by 0:17.");
    expect(button).toHaveTextContent("Cut to man in tank top");
    expect(button.querySelector("img")).toBeNull();
  });

  it("no usable description: the sentence alone", () => {
    const model = modelOf(early, { frames: true, description: null });
    renderWithPlayhead(model, <Moment model={model} />);
    expect(screen.getByRole("button").textContent).toBe("A third leave by 0:03.");
  });

  it.each([
    ["leak", leak, "They leave bit by bit."],
    ["holds", holds, "Most watch to the end."],
  ] as const)("%s names no scene: the sentence alone, not a button", (_name, fixture, sentence) => {
    const model = modelOf(fixture, { frames: true });
    const { container } = renderWithPlayhead(model, <Moment model={model} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector('[data-result="moment"]')!.textContent).toBe(sentence);
    expect(container.querySelector("img")).toBeNull();
  });
});
