/** @vitest-environment happy-dom */
/** @vitest-environment-options { "settings": { "disableIframePageLoading": true } } */
/**
 * ⚠️ `disableIframePageLoading` above is not cosmetic. Without it happy-dom really does fetch
 * `https://www.tiktok.com/embed/v2/…` the moment the embed test mounts its iframe — a live
 * third-party request from the unit suite, which is both slow and a flake that would only ever
 * fire on someone else's machine or in CI.
 */
/**
 * The source viewer — scrub strip, embed, and the reciprocity between the strip and the rows.
 *
 * What is load-bearing here:
 *
 *  - "renders nothing without scrub frames". Every sheet written before this lane has none, and
 *    the surface must stay byte-identical for them. This is the test that fails if the viewer
 *    ever starts rendering an empty strip, a zero-width playhead, or a dead row rule.
 *
 *  - "orders cells numerically". `Object.keys` returns strings and lexical order puts "10" before
 *    "2". Every cell would still render, the strip would still scrub, and the video would simply
 *    be shuffled — a bug with no error and no visual tell on an unfamiliar video.
 *
 *  - "the iframe is absent until asked". A thread can hold three remix cards off one run. Mounting
 *    on render opens three third-party players before anyone asks to watch anything.
 *
 * Drag is exercised through the keyboard, not pointers: happy-dom reports a 0-width
 * getBoundingClientRect, so a pointer scrub would silently seek to NaN and prove nothing.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { RemixSourceViewer } from "../remix-source-viewer";
import { RemixSourceEmbed } from "../remix-source-embed";
import { RemixBeats } from "../remix-beats";
import type { SourceBlueprint } from "@/lib/engine/remix/blueprint";
import type { AdaptedBeat } from "@/lib/engine/remix/decode-types";

const TIKTOK = "https://www.tiktok.com/@elsaspeak/video/7386776370245815560";

function frames(n: number): Record<number, string> {
  return Object.fromEntries(Array.from({ length: n }, (_, i) => [i, `https://signed/${i}.jpg`]));
}

const BEATS: SourceBlueprint["beats"] = [
  {
    index: 0, t_start: 0, t_end: 1.8, duration_s: 1.8, spoken_span_s: null,
    role: "hook", spoken: "Most people waste their first three seconds.",
    on_screen_text: null, visual_event: "tight crop", audio_event: "", cuts: 1, weakness: null,
  },
  {
    index: 1, t_start: 1.8, t_end: 14, duration_s: 12.2, spoken_span_s: null,
    role: "setup", spoken: "Here is what the numbers actually said.",
    on_screen_text: null, visual_event: "b-roll", audio_event: "", cuts: 3, weakness: null,
  },
];

const SCRIPT: AdaptedBeat[][] = [
  [
    { index: 0, spoken: "Your creatine is doing nothing.", on_screen_text: "STOP", shot: "waist-up" },
    { index: 1, spoken: "I tested 40 lifters.", on_screen_text: "", shot: "b-roll" },
  ],
];

function blueprint(over: Partial<SourceBlueprint> = {}): SourceBlueprint {
  return {
    duration_s: 14,
    words_per_second: 3.2,
    has_speech: true,
    from_fixed_buckets: false,
    beats: BEATS,
    ...over,
  };
}

afterEach(cleanup);

describe("RemixSourceViewer", () => {
  it("renders nothing without scrub frames — every pre-lane sheet is in this state", () => {
    const { container } = render(
      <RemixSourceViewer scrubFrames={{}} beats={BEATS} durationS={14} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no usable duration", () => {
    const { container } = render(
      <RemixSourceViewer scrubFrames={frames(30)} beats={[]} durationS={0} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one strip cell per frame", () => {
    render(<RemixSourceViewer scrubFrames={frames(30)} beats={BEATS} durationS={14} />);
    const strip = screen.getByTestId("remix-scrub-strip");
    expect(strip.querySelectorAll("[style*='background-image']")).toHaveLength(30);
  });

  it("orders cells NUMERICALLY, not lexically", () => {
    // Object.keys gives strings; "10" sorts before "2". The strip would render fine and simply
    // play the video out of order.
    render(<RemixSourceViewer scrubFrames={frames(12)} beats={BEATS} durationS={14} />);
    const cells = [...screen.getByTestId("remix-scrub-strip").querySelectorAll("[style*='background-image']")];
    const urls = cells.map((c) => /signed\/(\d+)\.jpg/u.exec(c.getAttribute("style") ?? "")?.[1]);
    expect(urls).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]);
  });

  it("reports the beat under the playhead, and updates it on seek", () => {
    const onActiveBeatChange = vi.fn();
    render(
      <RemixSourceViewer
        scrubFrames={frames(30)}
        beats={BEATS}
        durationS={14}
        onActiveBeatChange={onActiveBeatChange}
      />,
    );
    // Mount: the playhead is at 0, which is inside beat 0.
    expect(onActiveBeatChange).toHaveBeenLastCalledWith(0);

    // ArrowUp is the coarse step (5s) → t = 5s, which is inside beat 1.
    fireEvent.keyDown(screen.getByTestId("remix-scrub-strip"), { key: "ArrowUp" });
    expect(onActiveBeatChange).toHaveBeenLastCalledWith(1);
  });

  it("moves the playhead when the parent seeks it", async () => {
    const { rerender } = render(
      <RemixSourceViewer scrubFrames={frames(30)} beats={BEATS} durationS={14} seekToSec={0} />,
    );
    expect(screen.getByTestId("remix-scrub-strip")).toHaveAttribute("aria-valuenow", "0");

    rerender(
      <RemixSourceViewer scrubFrames={frames(30)} beats={BEATS} durationS={14} seekToSec={7} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("remix-scrub-strip")).toHaveAttribute("aria-valuenow", "50"),
    );
  });

  it("clamps at both ends rather than running past them", () => {
    render(<RemixSourceViewer scrubFrames={frames(30)} beats={BEATS} durationS={14} />);
    const strip = screen.getByTestId("remix-scrub-strip");

    fireEvent.keyDown(strip, { key: "ArrowLeft" });
    expect(strip).toHaveAttribute("aria-valuenow", "0");

    fireEvent.keyDown(strip, { key: "End" });
    expect(strip).toHaveAttribute("aria-valuenow", "100");
    fireEvent.keyDown(strip, { key: "ArrowRight" });
    expect(strip).toHaveAttribute("aria-valuenow", "100");
  });
});

describe("RemixSourceEmbed", () => {
  it("offers no toggle for a source it cannot embed", () => {
    // YouTube (owner ruling: TikTok + Instagram only) and a shortlink whose id is not in the URL.
    for (const url of ["https://youtu.be/dQw4w9WgXcQ", "https://vm.tiktok.com/ZMhKQwPqR/", null]) {
      const { container } = render(<RemixSourceEmbed sourceUrl={url} />);
      expect(container).toBeEmptyDOMElement();
      cleanup();
    }
  });

  it("does NOT mount the iframe until asked", () => {
    render(<RemixSourceEmbed sourceUrl={TIKTOK} />);
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("button", { name: /watch the source on tiktok/iu })).toBeInTheDocument();
  });

  it("mounts a sandboxed iframe on click, pointing at the right video", () => {
    render(<RemixSourceEmbed sourceUrl={TIKTOK} />);
    fireEvent.click(screen.getByRole("button", { name: /watch the source/iu }));

    const iframe = document.querySelector("iframe")!;
    expect(iframe).toHaveAttribute("src", "https://www.tiktok.com/embed/v2/7386776370245815560");
    // allow-top-navigation is the one that would let a third-party frame redirect the whole app.
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-top-navigation");
  });

  it("names Instagram as Instagram", () => {
    render(<RemixSourceEmbed sourceUrl="https://www.instagram.com/reel/DZK33LctVEo/" />);
    expect(screen.getByRole("button", { name: /watch the source on instagram/iu })).toBeInTheDocument();
  });

  it("always offers a way OUT of the panel, for when the player refuses to render", () => {
    // A third-party player can fail for reasons this app cannot see or fix — a signed-out viewer,
    // a region block, a post gone private since the run. Without this link the panel is a 560px
    // black rectangle and a dead end.
    render(<RemixSourceEmbed sourceUrl={TIKTOK} />);
    fireEvent.click(screen.getByRole("button", { name: /watch the source/iu }));

    const out = screen.getByRole("link", { name: /open on tiktok/iu });
    expect(out).toHaveAttribute("href", TIKTOK);
    expect(out).toHaveAttribute("target", "_blank");
    expect(out).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("keeps the player mounted when collapsed, so closing does not restart it", () => {
    render(<RemixSourceEmbed sourceUrl={TIKTOK} />);
    fireEvent.click(screen.getByRole("button", { name: /watch the source/iu }));
    fireEvent.click(screen.getByRole("button", { name: /hide the source/iu }));
    expect(document.querySelector("iframe")).not.toBeNull();
  });
});

describe("RemixBeats — the strip and the rows are one instrument", () => {
  it("adds NO viewer and NO row affordance to a pre-lane sheet", () => {
    const { container } = render(
      <RemixBeats
        blueprintId="preview"
        variantIndex={0}
        initialData={{ script: SCRIPT, blueprint: blueprint() }}
      />,
    );
    expect(container.querySelector("[data-source-viewer]")).toBeNull();
    // No dead left rule, no pointer cursor on a row that cannot seek anything.
    expect(container.querySelector("[data-beat-index]")).not.toHaveClass("cursor-pointer");
    // The rows themselves are untouched.
    expect(screen.getByText(/Your creatine is doing nothing/u)).toBeInTheDocument();
  });

  it("lights the beat the playhead is inside", () => {
    const { container } = render(
      <RemixBeats
        blueprintId="preview"
        variantIndex={0}
        initialData={{ script: SCRIPT, blueprint: blueprint(), scrubFrames: frames(30) }}
      />,
    );
    expect(container.querySelector("[data-beat-index='0']")).toHaveAttribute("data-beat-active");
    expect(container.querySelector("[data-beat-index='1']")).not.toHaveAttribute("data-beat-active");
  });

  it("seeks the playhead when a beat row is clicked", async () => {
    const { container } = render(
      <RemixBeats
        blueprintId="preview"
        variantIndex={0}
        initialData={{ script: SCRIPT, blueprint: blueprint(), scrubFrames: frames(30) }}
      />,
    );

    fireEvent.click(container.querySelector("[data-beat-index='1']")!);

    // Beat 1 starts at 1.8s of 14s ≈ 13%.
    await waitFor(() =>
      expect(screen.getByTestId("remix-scrub-strip")).toHaveAttribute("aria-valuenow", "13"),
    );
    await waitFor(() =>
      expect(container.querySelector("[data-beat-index='1']")).toHaveAttribute("data-beat-active"),
    );
  });

  it("shows the embed toggle from the source URL alone, with no frames", () => {
    // An older row can carry a source URL and no scrub frames. Watching it must still be possible;
    // scrubbing must not pretend to be.
    const { container } = render(
      <RemixBeats
        blueprintId="preview"
        variantIndex={0}
        initialData={{ script: SCRIPT, blueprint: blueprint(), sourceUrl: TIKTOK }}
      />,
    );
    expect(screen.getByRole("button", { name: /watch the source/iu })).toBeInTheDocument();
    expect(container.querySelector("[data-source-viewer]")).toBeNull();
  });
});
