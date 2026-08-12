/**
 * The hero → thread file handoff (ONBOARDING-FUNNEL-DESIGN.md §0b④).
 *
 * The load-bearing property is CONSUME-ONCE. The /home seed inlet arms a one-shot auto-run from
 * whatever this returns, and that run is a billed engine call against the anonymous visitor's
 * 10-credit demo pool — so a second read handing back the same File would spend their entire
 * free run twice on one video, and the second one would look like a legitimate replay.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  stagePendingUpload,
  consumePendingUpload,
  hasPendingUpload,
  clearPendingUpload,
} from "../pending-upload";

function videoFile(name = "clip.mp4"): File {
  return new File([new Uint8Array([0, 1, 2])], name, { type: "video/mp4" });
}

beforeEach(() => {
  clearPendingUpload();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pending upload handoff", () => {
  it("hands back the staged file", () => {
    const f = videoFile();
    stagePendingUpload(f);
    expect(consumePendingUpload()).toBe(f);
  });

  it("consumes ONCE — a second read is empty, never a replayed billed run", () => {
    stagePendingUpload(videoFile());
    expect(consumePendingUpload()).not.toBeNull();
    expect(consumePendingUpload()).toBeNull();
  });

  it("returns null when nothing was staged (the pasted-URL / hard-reload path)", () => {
    expect(consumePendingUpload()).toBeNull();
  });

  it("keeps only the latest pick when the visitor changes their mind", () => {
    const first = videoFile("first.mp4");
    const second = videoFile("second.mp4");
    stagePendingUpload(first);
    stagePendingUpload(second);
    expect(consumePendingUpload()).toBe(second);
  });

  it("expires a stale file rather than dropping it into an unrelated later run", () => {
    vi.useFakeTimers();
    stagePendingUpload(videoFile());
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(consumePendingUpload()).toBeNull();
  });

  it("clears the slot even when the staged file has expired", () => {
    vi.useFakeTimers();
    stagePendingUpload(videoFile());
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    consumePendingUpload();
    // Rolling time back must not resurrect it — the slot is gone, not merely hidden.
    vi.setSystemTime(Date.now() - 5 * 60 * 1000);
    expect(consumePendingUpload()).toBeNull();
  });

  it("reports presence without consuming", () => {
    stagePendingUpload(videoFile());
    expect(hasPendingUpload()).toBe(true);
    expect(hasPendingUpload()).toBe(true);
    expect(consumePendingUpload()).not.toBeNull();
    expect(hasPendingUpload()).toBe(false);
  });

  it("clears an abandoned stage", () => {
    stagePendingUpload(videoFile());
    clearPendingUpload();
    expect(consumePendingUpload()).toBeNull();
  });
});
