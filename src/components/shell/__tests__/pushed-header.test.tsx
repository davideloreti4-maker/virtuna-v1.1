/** @vitest-environment happy-dom */
/**
 * The pushed screen's 40 band: Back (or what the band is given in its place), the title, one
 * trailing action.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PushedHeader } from "../pushed-header";

const columns = () => Array.from(screen.getByRole("banner").children) as HTMLElement[];

describe("PushedHeader", () => {
  it("without leading: Back in the first column, and a tap calls onBack", () => {
    const onBack = vi.fn();
    render(<PushedHeader title="Video · 0:29" onBack={onBack} trailing={<button type="button">New chat</button>} />);
    const [first, title, last] = columns();
    expect(first).toBe(screen.getByRole("button", { name: "Back" }));
    expect(title).toHaveTextContent("Video · 0:29");
    expect(within(last!).getByRole("button", { name: "New chat" })).toBeInTheDocument();

    fireEvent.click(first!);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("with leading: the node in Back's column, no Back; title, subtitle and trailing as before", () => {
    const onBack = vi.fn();
    render(
      <PushedHeader
        title="Hooks for the dream headset video"
        subtitle="For @nia.tests"
        onBack={onBack}
        leading={<button type="button">Open menu</button>}
        trailing={<button type="button">New chat</button>}
      />,
    );
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    const header = screen.getByRole("banner");
    // Still three columns, in the same 40px grid: the node sits where Back sat.
    expect(header.className.split(/\s+/)).toEqual(expect.arrayContaining(["grid", "h-10", "grid-cols-[40px_minmax(0,1fr)_40px]"]));
    const [first, middle, last] = columns();
    expect(columns()).toHaveLength(3);
    expect(first).toBe(screen.getByRole("button", { name: "Open menu" }));
    expect(within(middle!).getByRole("heading", { level: 1, name: "Hooks for the dream headset video" })).toBeInTheDocument();
    expect(within(middle!).getByText("For @nia.tests")).toBeInTheDocument();
    expect(within(last!).getByRole("button", { name: "New chat" })).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
  });
});
