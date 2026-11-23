/** @vitest-environment happy-dom */

/**
 * VideoRunning — the live video turn while it simulates (spec §4.5, P8): the staged file's
 * thumbnail, a clock from the moment the card appeared, "uploading" until the run has an id and
 * what to expect after ("of about a minute", then "taking longer"), and "Watch it run" once there is a run to open. Timers are faked for the clock.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { VideoRunning } from "../video-running";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("VideoRunning", () => {
  it("without an id: 'uploading', a clock from 0:00, no link", () => {
    render(<VideoRunning file={null} analysisId={null} />);
    expect(screen.getByText("uploading")).toBeInTheDocument();
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Watch it run/ })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(41_000);
    });
    expect(screen.getByText("0:41")).toBeInTheDocument();
  });

  it("with an id: what to expect, and 'Watch it run' to the result", () => {
    render(<VideoRunning file={null} analysisId="run-1" />);
    expect(screen.getByText("of about a minute")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Watch it run" });
    expect(link).toHaveAttribute("href", "/simulation/run-1");
    expect(link).not.toHaveTextContent(/credit/);
  });

  it("keeps its clock when the id arrives", () => {
    const { rerender } = render(<VideoRunning file={null} analysisId={null} />);
    act(() => {
      vi.advanceTimersByTime(12_000);
    });
    rerender(<VideoRunning file={null} analysisId="run-1" />);
    expect(screen.getByText("0:12")).toBeInTheDocument();
    expect(screen.getByText("of about a minute")).toBeInTheDocument();
  });

  it("past 90 seconds it says so, and keeps counting", () => {
    render(<VideoRunning file={null} analysisId="run-1" />);
    act(() => {
      vi.advanceTimersByTime(90_000);
    });
    expect(screen.getByText("of about a minute")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByText("taking longer")).toBeInTheDocument();
    expect(screen.getByText("1:32")).toBeInTheDocument();
    expect(screen.queryByText("of about a minute")).toBeNull();
  });

  it("a slow upload does not count against the run: 'taking longer' is 90 seconds after the run's id arrived", () => {
    const { rerender } = render(<VideoRunning file={null} analysisId={null} />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    rerender(<VideoRunning file={null} analysisId="run-1" />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    // Two minutes on the clock, one of them the run's.
    expect(screen.getByText("2:00")).toBeInTheDocument();
    expect(screen.getByText("of about a minute")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(32_000);
    });
    expect(screen.getByText("taking longer")).toBeInTheDocument();
  });

  it("starts from a given moment", () => {
    render(<VideoRunning file={null} analysisId="run-1" startedAt={Date.now() - 41_000} />);
    expect(screen.getByText("0:41")).toBeInTheDocument();
  });

  it("the label is politely live; the clock is not", () => {
    render(<VideoRunning file={null} analysisId="run-1" />);
    expect(screen.getByText("of about a minute").closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("0:00").closest("[aria-live]")).toBeNull();
  });

  it("stops its clock when it goes", () => {
    const { unmount } = render(<VideoRunning file={null} analysisId={null} />);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("has no axe violations", async () => {
    vi.useRealTimers();
    const { container } = render(<VideoRunning file={null} analysisId="run-1" />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});
