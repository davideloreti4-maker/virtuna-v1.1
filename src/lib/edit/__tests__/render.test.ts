/**
 * render.test.ts — a real render, judged from the MP4.
 *
 * Everything else in this folder checks the film as text. This one draws it: ffmpeg makes two
 * clips of flat colour with a tone, a small edit is compiled into a temporary folder with the
 * kit, and OpenFilm's own `render()` turns it into an MP4 in a headless browser. Then the file is
 * read back: the frame count, the colour on each side of the cut, the caption and the label in
 * the picture, and sound in the mix.
 *
 * It needs ffmpeg, ffprobe and the headless browser on the machine. Where one is missing the
 * suite is SKIPPED and says which; part 1 is not done until this has run green on the
 * development machine, and part 2 runs it again inside the worker image.
 *
 * Nothing of ours is mocked, and neither is the renderer.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "openfilm/host";
import { render } from "openfilm/render";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compile } from "../compile";
import { DEFAULT_CAPTION_STYLE, STAGE, newSegment, newText, type EditSpec } from "../spec";

const kit = fileURLToPath(new URL("../../../../public/edit-kit/v1/", import.meta.url));

const missing: string[] = [];
for (const bin of ["ffmpeg", "ffprobe"]) {
  if (spawnSync(bin, ["-version"], { stdio: "ignore" }).error) missing.push(bin);
}
if (missing.length === 0) {
  try {
    await (await launch()).close();
  } catch (e) {
    missing.push(/Executable doesn't exist/.test(String(e)) ? "the headless browser" : `a browser that starts (${String(e).split("\n")[0]})`);
  }
}
if (missing.length) console.warn(`render.test.ts SKIPPED: this machine has no ${missing.join(", ")}`);

/** Red for 20 frames, then blue for 25: the cut is on frame 20. */
function edit(): EditSpec {
  const clip = (id: string, words: EditSpec["assets"][string]["words"]): EditSpec["assets"][string] => ({
    id, kind: "video", origin: "uploaded", at: { bucket: "takes", path: `${id}.mp4` }, ms: 2000, w: 1080, h: 1920, sound: true, words,
  });
  return {
    v: 1,
    stage: { ...STAGE },
    kit: "v1",
    assets: {
      red: clip("red", [{ t0: 0, t1: 400, text: "Red" }, { t0: 400, t1: 650, text: "clip." }]),
      blue: clip("blue", null),
      kick: { id: "kick", kind: "audio", origin: "kit", at: { kit: "sfx/kick.m4a" }, ms: 450, sound: true, words: null },
    },
    main: [newSegment({ id: "r", asset: "red", len: 20 }), newSegment({ id: "b", asset: "blue", len: 25 })],
    layers: [],
    texts: [{ ...newText({ id: "label", text: "LABEL", at: 0, len: 45 }), in: null, out: null }],
    captions: { on: true, lang: "en", style: { ...DEFAULT_CAPTION_STYLE }, fixes: {} },
    sounds: [{ id: "k", pin: "b", at: 0, len: 14, role: "sfx", asset: "kick", inMs: 0, volume: 1, fadeIn: 0, fadeOut: 0 }],
    look: { filter: null },
    cover: null,
    ref: null,
  };
}

describe.skipIf(missing.length > 0)("a real render", () => {
  let dir = "";
  let out = "";

  /** The pixels of one frame's horizontal band, as [r, g, b] triples. `top` and `height` are fractions of the picture. */
  const band = (frame: number, top: number, height: number): [number, number, number][] => {
    const raw = execFileSync("ffmpeg", [
      "-v", "error", "-i", out,
      "-vf", `select='eq(n\\,${frame})',crop=iw:ih*${height}:0:ih*${top},scale=64:16`,
      "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
    ], { maxBuffer: 1 << 24 });
    const pixels: [number, number, number][] = [];
    for (let i = 0; i + 2 < raw.length; i += 3) pixels.push([raw[i] ?? 0, raw[i + 1] ?? 0, raw[i + 2] ?? 0]);
    return pixels;
  };
  const mean = (pixels: [number, number, number][]): [number, number, number] => {
    const sum = pixels.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]] as [number, number, number], [0, 0, 0] as [number, number, number]);
    return [sum[0] / pixels.length, sum[1] / pixels.length, sum[2] / pixels.length];
  };

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "edit-render-"));
    mkdirSync(join(dir, "assets"));
    cpSync(kit, join(dir, "kit", "v1"), { recursive: true });
    for (const [name, color, hz] of [["red", "0xff0000", 440], ["blue", "0x0000ff", 880]] as const) {
      execFileSync("ffmpeg", [
        "-v", "error", "-y",
        "-f", "lavfi", "-i", `color=c=${color}:s=1080x1920:r=30:d=2`,
        "-f", "lavfi", "-i", `sine=frequency=${hz}:duration=2`,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-g", "15", "-c:a", "aac", "-shortest",
        join(dir, "assets", `${name}.mp4`),
      ]);
    }
    const compiled = compile(edit(), { file: (asset) => `assets/${asset.id}.mp4` });
    for (const [name, text] of Object.entries(compiled.files)) writeFileSync(join(dir, name), text);
    out = join(dir, "out.mp4");
    await render([dir], { out, scale: 0.25, workers: 1 });
  }, 180_000);

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("has exactly the edit's frames, at 30 frames a second", () => {
    const probe = JSON.parse(execFileSync("ffprobe", [
      "-v", "error", "-count_frames", "-select_streams", "v:0",
      "-show_entries", "stream=nb_read_frames,r_frame_rate,width,height", "-of", "json", out,
    ], { encoding: "utf8" })) as { streams: { nb_read_frames: string; r_frame_rate: string; width: number; height: number }[] };
    expect(probe.streams[0]).toMatchObject({ nb_read_frames: "45", r_frame_rate: "30/1", width: 270, height: 480 });
  });

  it("cuts on the exact frame: the frame before is the first clip, the frame of the cut the second", () => {
    /* the bottom fifth of the picture holds no caption and no label */
    const before = mean(band(19, 0.8, 0.2));
    const after = mean(band(20, 0.8, 0.2));
    expect(before[0]).toBeGreaterThan(150);
    expect(before[2]).toBeLessThan(90);
    expect(after[2]).toBeGreaterThan(150);
    expect(after[0]).toBeLessThan(90);
  });

  it("draws the caption while its line is on, and not after", () => {
    /* captions sit at 66% of the height. Red and blue have no green; the caption's words do. */
    const green = (frame: number): number => band(frame, 0.6, 0.12).filter((p) => p[1] > 120).length;
    expect(green(6)).toBeGreaterThan(10); // "Red clip." is on from 0 to 650 ms
    expect(green(40)).toBe(0); // the blue clip says nothing
  });

  it("draws the text label at the top for the whole film", () => {
    const white = (frame: number): number => band(frame, 0.09, 0.1).filter((p) => p[0] > 200 && p[1] > 200 && p[2] > 200).length;
    expect(white(5)).toBeGreaterThan(10);
    expect(white(40)).toBeGreaterThan(10);
  });

  it("has sound in the mix", () => {
    const said = spawnSync("ffmpeg", ["-v", "info", "-i", out, "-vn", "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr;
    const level = Number(/mean_volume: (-?[\d.]+) dB/.exec(said)?.[1]);
    expect(level).toBeGreaterThan(-60);
  });
});
