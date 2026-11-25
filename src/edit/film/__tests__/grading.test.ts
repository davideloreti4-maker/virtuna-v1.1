import { afterEach, describe, expect, it, vi } from "vitest";

/** A stand-in for the browser's document, the one thing here that cannot be run in a test: it hands out canvases whose WebGL 2 answer is `answer`. */
function browser(answer: () => unknown) {
  const canvases: { width: number; height: number; asked: string[] }[] = [];
  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      expect(tag).toBe("canvas");
      const canvas = { width: 300, height: 150, asked: [] as string[], getContext: (kind: string) => (canvas.asked.push(kind), answer()) };
      canvases.push(canvas);
      return canvas;
    },
  });
  return canvases;
}

/** The module anew, as on a fresh page: its answer is kept for the life of a page. */
const fresh = async () => (vi.resetModules(), import("../grading"));

afterEach(() => vi.unstubAllGlobals());

describe("whether a browser can run the colour pass", () => {
  it("says yes where a WebGL 2 context is given, and gives that context back at once", async () => {
    const lost = vi.fn();
    const canvases = browser(() => ({ getExtension: (name: string) => (name === "WEBGL_lose_context" ? { loseContext: lost } : null) }));
    const { canGrade } = await fresh();
    expect(canGrade()).toBe(true);
    expect(canvases[0]?.asked).toEqual(["webgl2"]);
    expect(lost).toHaveBeenCalledTimes(1);
    expect([canvases[0]?.width, canvases[0]?.height]).toEqual([0, 0]);
  });

  it("says no where none is given", async () => {
    browser(() => null);
    expect((await fresh()).canGrade()).toBe(false);
  });

  it("says no where asking throws, as it can in a browser whose canvas has been tampered with", async () => {
    browser(() => {
      throw new Error("blocked");
    });
    expect((await fresh()).canGrade()).toBe(false);
  });

  it("asks once a page", async () => {
    const canvases = browser(() => null);
    const { canGrade } = await fresh();
    canGrade();
    canGrade();
    expect(canvases).toHaveLength(1);
  });
});

describe("telling a failed colour pass from any other failure of a clip", () => {
  it("knows the engine's own report that the colour pass could not run", async () => {
    const { colourPassFailed } = await fresh();
    // The engine's words, 4.0.545, with the reason beneath them as it gives it.
    const reason = new Error('Failed to acquire WebGL2 context for effects. Pass --gl=angle when using the CLI, set chromiumOptions: { gl: "angle" } when using SSR APIs');
    expect(colourPassFailed(new Error("WebGL context remained unavailable while rendering effects. Recovery failed after two retries. Try reducing rendering concurrency or GPU memory usage. " + reason.message, { cause: reason }))).toBe(true);
    expect(colourPassFailed(new Error("Could not draw the frame", { cause: new Error("WebGL context lost") }))).toBe(true);
  });

  it("does not take a clip that cannot be fetched or read for one", async () => {
    const { colourPassFailed } = await fresh();
    expect(colourPassFailed(new Error("Failed to fetch"))).toBe(false);
    expect(colourPassFailed(new Error("Cannot decode http://127.0.0.1/take.mp4", { cause: new Error("EncodingError: Decoder failure") }))).toBe(false);
    expect(colourPassFailed(new Error("No video or audio tracks found", { cause: "not an error at all" }))).toBe(false);
  });
});
