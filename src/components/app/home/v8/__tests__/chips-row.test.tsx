/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChipsRow } from "../chips-row";

describe("ChipsRow", () => {
  it("chips arm real composer ToolIds", () => {
    const onArm = vi.fn();
    render(<ChipsRow onArm={onArm} onMore={vi.fn()} />);
    fireEvent.click(screen.getByText("Remix a proven video"));
    expect(onArm).toHaveBeenCalledWith("remix");
    fireEvent.click(screen.getByText("Test a draft"));
    expect(onArm).toHaveBeenCalledWith("test");
  });

  it("More opens the skills panel", () => {
    const onMore = vi.fn();
    render(<ChipsRow onArm={vi.fn()} onMore={onMore} />);
    fireEvent.click(screen.getByText("More ▸"));
    expect(onMore).toHaveBeenCalled();
  });
});
