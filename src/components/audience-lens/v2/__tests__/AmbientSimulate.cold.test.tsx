/** @vitest-environment happy-dom */
/**
 * The COLD intake — bring your own stimulus (Phase 2, 2026-07-28).
 *
 * The defect this locks shut: cold entry used to jump from the intake door straight to the arm
 * card and take its stimulus from `data.stimulus.text` — the CALLER's text — swapping only the
 * `kind` to the door's. There was not one `<input>` in the intake, so "Screen a draft" armed a
 * run against whatever the host happened to be holding, and a creator could not put their own
 * hook in front of the room at all. Every test here fails if that fallback comes back.
 *
 * `develop` entry is the control: it is SUPPOSED to read `data.stimulus`, and must keep doing so.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AmbientSimulate } from "../AmbientSimulate";
import { SIMULATE_R4 } from "../simulate-fixture";

afterEach(cleanup);

/** The caller's pre-filled text — the thing cold mode must NEVER show as the stimulus. */
const CALLER_TEXT = SIMULATE_R4.stimulus.text;

/** Walk the cold path to the collect step for one door, by its visible label. */
function openDoor(label: string) {
  render(<AmbientSimulate data={SIMULATE_R4} mode="cold" />);
  fireEvent.click(screen.getByText(label));
}

describe("cold intake — the stimulus is the one the creator brought", () => {
  it("lands on the doors, not the arm card", () => {
    render(<AmbientSimulate data={SIMULATE_R4} mode="cold" />);
    expect(screen.getByTestId("ambient-simulate").dataset.phase).toBe("intake");
    expect(screen.getByText("What are you testing?")).toBeTruthy();
  });

  it("a picked door asks for the stimulus instead of arming the caller's text", () => {
    openDoor("Screen a draft");
    const panel = screen.getByTestId("ambient-simulate");
    expect(panel.dataset.phase).toBe("collect");
    expect(panel.dataset.door).toBe("draft");
    // THE REGRESSION: the caller's text must not have become the stimulus under test.
    expect(screen.queryByText(CALLER_TEXT)).toBeNull();
  });

  it("arms the TYPED draft — and never the caller's text", () => {
    openDoor("Screen a draft");
    const box = screen.getByLabelText("Paste the draft to screen");
    fireEvent.change(box, { target: { value: "  My own hook, typed here.  " } });
    fireEvent.click(screen.getByText("Continue →"));

    expect(screen.getByTestId("ambient-simulate").dataset.phase).toBe("arm");
    expect(screen.getByText("My own hook, typed here.")).toBeTruthy(); // trimmed
    expect(screen.queryByText(CALLER_TEXT)).toBeNull();
  });

  it("will not arm an empty draft", () => {
    openDoor("Screen a draft");
    fireEvent.click(screen.getByText("Continue →"));
    expect(screen.getByTestId("ambient-simulate").dataset.phase).toBe("collect");

    // Whitespace is not a stimulus either.
    fireEvent.change(screen.getByLabelText("Paste the draft to screen"), { target: { value: "   " } });
    fireEvent.click(screen.getByText("Continue →"));
    expect(screen.getByTestId("ambient-simulate").dataset.phase).toBe("collect");
  });

  it("arms a pasted link, and rejects a URL the server would reject", () => {
    openDoor("Test a real video");
    const url = screen.getByLabelText("Paste a TikTok link");

    // Same regex as the /api/analyze trust boundary — a URL this step accepts, the server accepts.
    fireEvent.change(url, { target: { value: "https://youtube.com/watch?v=1" } });
    fireEvent.click(screen.getByText("Continue →"));
    expect(screen.getByTestId("ambient-simulate").dataset.phase).toBe("collect");
    expect(screen.getByText(/doesn't look like a TikTok video URL/)).toBeTruthy();

    fireEvent.change(url, { target: { value: "https://tiktok.com/@me/video/123" } });
    fireEvent.click(screen.getByText("Continue →"));
    expect(screen.getByTestId("ambient-simulate").dataset.phase).toBe("arm");
    expect(screen.getByText("https://tiktok.com/@me/video/123")).toBeTruthy();
    expect(screen.queryByText(CALLER_TEXT)).toBeNull();
  });

  it("a dropped file wins the door and clears a half-typed link", () => {
    // The two are different `input_mode`s (video_upload vs tiktok_url) and a stimulus holding
    // both has no honest answer.
    //
    // ⚠️ Read this before trusting it: THREE things in CollectStep enforce this and they mask
    // each other (clear-on-select · the field unmounts · submit reads the file first). Mutation-
    // tested — breaking any single one leaves this green. It catches the compound break, and the
    // unmount; it is not three guards.
    openDoor("Test a real video");
    fireEvent.change(screen.getByLabelText("Paste a TikTok link"), {
      target: { value: "https://tiktok.com/@me/video/123" },
    });
    const file = new File(["x"], "my-clip.mp4", { type: "video/mp4" });
    fireEvent.change(screen.getByLabelText("Upload video file"), { target: { files: [file] } });

    // The link field is gone with the file selected — nothing left to disagree with.
    expect(screen.queryByLabelText("Paste a TikTok link")).toBeNull();

    fireEvent.click(screen.getByText("Continue →"));
    expect(screen.getByTestId("ambient-simulate").dataset.phase).toBe("arm");
    // A video's stimulus text is its NAME — the filename, never the link it replaced.
    expect(screen.getByText("my-clip.mp4")).toBeTruthy();
    expect(screen.queryByText("https://tiktok.com/@me/video/123")).toBeNull();
  });

  it("going back to the doors drops what was collected under the old one", () => {
    openDoor("Screen a draft");
    fireEvent.change(screen.getByLabelText("Paste the draft to screen"), { target: { value: "draft text" } });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    // Re-entering the VIDEO door must not carry the draft across — they are different stimuli.
    fireEvent.click(screen.getByText("Test a real video"));
    expect(screen.getByTestId("ambient-simulate").dataset.door).toBe("video");
    expect(screen.queryByText("draft text")).toBeNull();
  });

  it("back from the arm card returns to collect, keeping the door", () => {
    openDoor("Screen a draft");
    fireEvent.change(screen.getByLabelText("Paste the draft to screen"), { target: { value: "typo herr" } });
    fireEvent.click(screen.getByText("Continue →"));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    const panel = screen.getByTestId("ambient-simulate");
    expect(panel.dataset.phase).toBe("collect");
    expect(panel.dataset.door).toBe("draft");
  });

  it("a deferred door does not open — it has no arm or output yet", () => {
    render(<AmbientSimulate data={SIMULATE_R4} mode="cold" />);
    fireEvent.click(screen.getByText("Compare two"));
    expect(screen.getByTestId("ambient-simulate").dataset.phase).toBe("intake");
  });
});

describe("develop entry — the control", () => {
  it("still arms the caller's pre-filled stimulus, with no intake in the way", () => {
    render(<AmbientSimulate data={SIMULATE_R4} mode="develop" />);
    expect(screen.getByTestId("ambient-simulate").dataset.phase).toBe("arm");
    expect(screen.getByText(CALLER_TEXT)).toBeTruthy();
  });
});
