/** @vitest-environment happy-dom */
/**
 * The Engagement panel on recorded runs (spec §5 "Engagement", plan Task 5). The state function and
 * the panel are real; nothing is stood in for. The panel is rendered without a PlayheadProvider:
 * it does not move with the playhead, so it must not need one.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

// The flag is a build-time constant; this file is the flag-on build (the page exists only there).
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { videoStateOf } from "@/lib/result/video-model";
import type { ResultRow, VideoModel } from "@/lib/result/types";
import early from "@/lib/result/__tests__/fixtures/early.json";
import holds from "@/lib/result/__tests__/fixtures/holds.json";
import opening from "@/lib/result/__tests__/fixtures/opening.json";
import { EngagementPanel } from "../engagement-panel";

function modelOf(fixture: unknown): VideoModel {
  const state = videoStateOf(fixture as ResultRow);
  if (state.kind !== "result") throw new Error(`fixture is ${state.kind}, not a result`);
  return state.model;
}

const panel = () => document.querySelector<HTMLElement>('[data-result="engagement"]')!;
const fills = () =>
  Array.from(panel().querySelectorAll<HTMLElement>("[data-fill]")).map((el) => el.style.width);

describe("EngagementPanel", () => {
  it("shows the average watch of the reference run as a time of the clip's length", () => {
    const model = modelOf(early);
    render(<EngagementPanel model={model} />);
    expect(screen.getByText("Avg watch")).toBeInTheDocument();
    expect(screen.getByText("0:16")).toBeInTheDocument();
    expect(screen.getByText("of 0:29")).toBeInTheDocument();
    // The bar is as long as the clip, filled to the average watch.
    const bar = panel().querySelector<HTMLElement>('[data-bar="avg-watch"] [data-fill]')!;
    expect(bar.style.width).toBe(`${(model.avgWatchS / model.clipS) * 100}%`);
  });

  it("reads other runs' numbers", () => {
    render(<EngagementPanel model={modelOf(opening)} />);
    expect(screen.getByText("1:26")).toBeInTheDocument();
    expect(screen.getByText("of 2:01")).toBeInTheDocument();
  });

  it("lists what viewers are likely to do, the longest bar first, without numbers", () => {
    render(<EngagementPanel model={modelOf(early)} />);
    expect(screen.getByRole("heading", { name: "What viewers are likely to do" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Most likely first" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual(["Share", "Comment", "Rewatch", "Save"]);
    // early stores share 47.9, comment 29.6, rewatch 19.4, save 12.5.
    expect(fills().slice(1)).toEqual(["48%", "30%", "19%", "13%"]);
    // The bars carry no text of their own: the row's label names it, the list's order ranks it.
    for (const row of rows) {
      const bar = row.querySelector('[data-bar="intent"]')!;
      expect(bar.getAttribute("aria-hidden")).toBe("true");
      expect(bar.textContent).toBe("");
    }
  });

  it("follows the run's own order (holds: Save first)", () => {
    render(<EngagementPanel model={modelOf(holds)} />);
    const rows = within(screen.getByRole("list", { name: "Most likely first" })).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual(["Save", "Share", "Comment", "Rewatch"]);
  });

  it("gives a near-zero intent a visible stub of 4%", () => {
    const model = modelOf(early);
    render(
      <EngagementPanel
        model={{
          ...model,
          intents: [
            { id: "share", label: "Share", value: 3.2 },
            { id: "comment", label: "Comment", value: 0 },
            { id: "rewatch", label: "Rewatch", value: 0 },
            { id: "save", label: "Save", value: 0 },
          ],
        }}
      />,
    );
    expect(fills().slice(1)).toEqual(["4%", "4%", "4%", "4%"]);
  });

  it("says no verdict, no index and no percentage", () => {
    render(<EngagementPanel model={modelOf(early)} />);
    const text = [
      panel().textContent ?? "",
      ...Array.from(panel().querySelectorAll("[aria-label]")).map((el) => el.getAttribute("aria-label") ?? ""),
    ].join(" ");
    expect(text).not.toMatch(/\b(low|high|medium|intent)\b/i);
    expect(text).not.toContain("%");
    // The only numbers are the two times.
    expect(text.match(/\d+(:\d+)?/g)).toEqual(["0:16", "0:29"]);
  });

  it("is not coral anywhere", () => {
    render(<EngagementPanel model={modelOf(early)} />);
    expect(panel().innerHTML).not.toMatch(/below|accent|#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  it("renders only the average watch when the run stored no intents", () => {
    render(<EngagementPanel model={{ ...modelOf(early), intents: null }} />);
    expect(screen.getByText("0:16")).toBeInTheDocument();
    expect(screen.queryByText("What viewers are likely to do")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(panel().querySelectorAll('[data-result="avg-watch"]')).toHaveLength(1);
    expect(panel().querySelectorAll('[data-result="intents"]')).toHaveLength(0);
  });
});
