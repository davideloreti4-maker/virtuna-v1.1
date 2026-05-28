/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoUpload } from "@/components/app/video-upload";

/**
 * INT-06 — "About your data" disclosure in empty state (D-05).
 * Renders as an icon-only chevron button (aria-label="About your data") on the
 * compact single-row drop zone. Toggles disclosure text and never triggers the
 * file picker (stopPropagation on the disclosure button).
 */
describe("VideoUpload — data disclosure (INT-06)", () => {
  const onFileSelect = () => {};
  const DISCLOSURE_TEXT =
    "Videos auto-delete after 30 days. Keep them for re-analysis in Settings.";

  it("renders 'About your data' icon button in empty state", () => {
    render(<VideoUpload file={null} onFileSelect={onFileSelect} />);
    expect(
      screen.getByRole("button", { name: "About your data" }),
    ).toBeInTheDocument();
  });

  it("shows disclosure text when button is clicked", () => {
    render(<VideoUpload file={null} onFileSelect={onFileSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "About your data" }));
    expect(screen.getByText(DISCLOSURE_TEXT)).toBeInTheDocument();
  });

  it("hides disclosure text on second click (toggle off)", () => {
    render(<VideoUpload file={null} onFileSelect={onFileSelect} />);
    const btn = screen.getByRole("button", { name: "About your data" });
    fireEvent.click(btn);
    expect(screen.getByText(DISCLOSURE_TEXT)).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText(DISCLOSURE_TEXT)).not.toBeInTheDocument();
  });

  it("does NOT render disclosure when a file is selected", () => {
    const file = new File(["dummy"], "test.mp4", { type: "video/mp4" });
    render(<VideoUpload file={file} onFileSelect={onFileSelect} />);
    expect(
      screen.queryByRole("button", { name: "About your data" }),
    ).not.toBeInTheDocument();
  });

  it("clicking the disclosure button does NOT trigger file input click (stopPropagation)", () => {
    render(<VideoUpload file={null} onFileSelect={onFileSelect} />);
    const btn = screen.getByRole("button", { name: "About your data" });
    expect(() => {
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
    }).not.toThrow();
  });
});
