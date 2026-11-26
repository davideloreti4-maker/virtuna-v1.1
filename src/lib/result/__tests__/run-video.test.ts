import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetRunVideos, rememberRunStill, rememberRunVideo, runStillOf, runVideoOf } from "../run-video";

afterEach(() => {
  forgetRunVideos();
  vi.restoreAllMocks();
});

describe("the video of a run this device started", () => {
  it("is known for the run it was remembered for, and for no other", () => {
    rememberRunVideo("run-1", "blob:video-1");
    expect(runVideoOf("run-1")).toBe("blob:video-1");
    expect(runVideoOf("run-2")).toBeNull();
  });

  it("is unknown after a reload (nothing was remembered)", () => {
    expect(runVideoOf("run-1")).toBeNull();
  });

  it("lets go of a blob: video it drops: the one replaced and the ones pushed out", () => {
    // The browser keeps an object URL's file in memory until it is revoked.
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    rememberRunVideo("run-1", "blob:first");
    rememberRunVideo("run-1", "blob:second");
    expect(revoke).toHaveBeenCalledWith("blob:first");
    expect(runVideoOf("run-1")).toBe("blob:second");

    revoke.mockClear();
    for (let i = 2; i <= 8; i++) rememberRunVideo(`run-${i}`, `https://videos.test/${i}.mp4`);
    rememberRunVideo("run-9", "blob:ninth");
    // Eight are kept: run-1 is pushed out and its blob is let go; https addresses are not revoked.
    expect(runVideoOf("run-1")).toBeNull();
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:second");

    revoke.mockClear();
    rememberRunVideo("run-10", "blob:tenth");
    expect(runVideoOf("run-2")).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
  });

  it("does not let go of a video remembered again for the same run", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    rememberRunVideo("run-1", "blob:same");
    rememberRunVideo("run-1", "blob:same");
    expect(revoke).not.toHaveBeenCalled();
    expect(runVideoOf("run-1")).toBe("blob:same");
  });

  it("keeps only the last few runs", () => {
    for (let i = 0; i < 12; i++) rememberRunVideo(`run-${i}`, `blob:${i}`);
    expect(runVideoOf("run-0")).toBeNull();
    expect(runVideoOf("run-11")).toBe("blob:11");
  });
});

describe("the picture a run's running screen showed", () => {
  it("is known for the run it was remembered for, the latest one, and for no other", () => {
    rememberRunStill("run-1", "https://f.test/0.jpg");
    expect(runStillOf("run-1")).toBe("https://f.test/0.jpg");
    rememberRunStill("run-1", "https://p.test/cover.jpg");
    expect(runStillOf("run-1")).toBe("https://p.test/cover.jpg");
    expect(runStillOf("run-2")).toBeNull();
  });

  it("keeps only the last few runs, and is forgotten with the videos", () => {
    for (let i = 0; i < 12; i++) rememberRunStill(`run-${i}`, `https://f.test/${i}.jpg`);
    expect(runStillOf("run-0")).toBeNull();
    expect(runStillOf("run-3")).toBeNull();
    expect(runStillOf("run-4")).toBe("https://f.test/4.jpg");
    expect(runStillOf("run-11")).toBe("https://f.test/11.jpg");
    forgetRunVideos();
    expect(runStillOf("run-11")).toBeNull();
  });

  it("is not a video: remembering one lets no video go", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    rememberRunVideo("run-1", "blob:clip-1");
    rememberRunStill("run-1", "https://f.test/0.jpg");
    expect(runVideoOf("run-1")).toBe("blob:clip-1");
    expect(revoke).not.toHaveBeenCalled();
  });
});
