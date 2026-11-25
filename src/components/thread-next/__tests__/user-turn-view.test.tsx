/** @vitest-environment happy-dom */

/**
 * Your message in a thread (`NextUserTurn`): the bubble, the video's tile, and the turn that is
 * only its video. Rendered for real; nothing is stood in for.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { NextUserTurn, isVideoFileName } from "../user-turn";

afterEach(cleanup);

describe("isVideoFileName", () => {
  it.each([
    ["test-30s.mp4", true],
    ["  take 3 (final).MOV ", true],
    ["clip.webm", true],
    ["Simulate this", false],
    ["watch clip.mp4 and tell me why it flopped", false],
    ["notes.pdf", false],
    ["https://www.tiktok.com/@nia.tests/video/1.mp4", false],
    ["first line\nclip.mp4", false],
  ])("%s → %s", (text, is) => {
    expect(isVideoFileName(text)).toBe(is);
  });
});

describe("NextUserTurn", () => {
  it("words and a video: the tile above the bubble", () => {
    const { container } = render(<NextUserTurn text="Simulate this" video={{ posterUrl: "/frames/0.jpg", durationLabel: "0:29" }} />);
    expect(screen.getByRole("img", { name: "Video, 0:29" })).toBeInTheDocument();
    expect(screen.getByText("Simulate this")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "/frames/0.jpg");
  });

  it("a video sent without words is the tile alone: the file name is in the turn for a screen reader, never a bubble", () => {
    render(<NextUserTurn text="test-30s.mp4" video={{ posterUrl: "/frames/0.jpg", durationLabel: "0:29" }} />);
    expect(screen.getByRole("img", { name: "Video, 0:29" })).toBeInTheDocument();
    const name = screen.getByText("test-30s.mp4");
    expect(name).toHaveClass("sr-only");
    expect(name.className).not.toMatch(/bg-surface-sunken|rounded/);
    // The tile carries no gap for a bubble that is not painted.
    expect(screen.getByRole("img", { name: "Video, 0:29" }).className).not.toMatch(/mb-1\.5/);
    // The heading every turn carries stays.
    expect(screen.getByRole("heading", { name: "You" })).toBeInTheDocument();
  });

  it("a file name with no tile to stand for it stays a bubble", () => {
    render(<NextUserTurn text="test-30s.mp4" video={null} />);
    expect(screen.getByText("test-30s.mp4")).not.toHaveClass("sr-only");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("no frame, or a frame that fails to load: the video mark and the length, never an empty box", () => {
    const { container, unmount } = render(<NextUserTurn text="Simulate this" video={{ posterUrl: null, durationLabel: "0:29" }} />);
    expect(container.querySelector('[data-part="video-mark"]')).toBeInTheDocument();
    expect(screen.getByText("0:29")).toBeInTheDocument();
    unmount();

    const again = render(<NextUserTurn text="Simulate this" video={{ posterUrl: "/frames/gone.jpg", durationLabel: "0:29" }} />);
    expect(again.container.querySelector('[data-part="video-mark"]')).toBeNull();
    fireEvent.error(again.container.querySelector("img")!);
    expect(again.container.querySelector("img")).toBeNull();
    expect(again.container.querySelector('[data-part="video-mark"]')).toBeInTheDocument();
  });

  it("a link turn is the link, with no tile", () => {
    render(<NextUserTurn text="https://www.tiktok.com/@nia.tests/video/1" video={{ posterUrl: "/frames/0.jpg", durationLabel: "0:29" }} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("https://www.tiktok.com/@nia.tests/video/1")).toBeInTheDocument();
  });
});
