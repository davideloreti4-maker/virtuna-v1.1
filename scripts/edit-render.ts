/**
 * edit-render.ts — the real renderer for the edit tool's own scripts: bundles the film once,
 * serves the kit and `.scratch/media/` to this machine only, and renders demo edits: a still of
 * one frame, or the whole film as a file.
 *
 * A demo is `.scratch/media/<name>.json`: `{ "edit": <an edit>, "files": { "<file id>": "<name in .scratch/media>" } }`.
 */
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { FilmPropsSchema } from "../src/edit/film/props";

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".jpg": "image/jpeg", ".png": "image/png", ".ttf": "font/ttf" };
const ROOTS: Record<string, string> = { kit: resolve("public/edit"), media: resolve(".scratch/media") };

/** Serves the kit and the media folder to this machine only, with byte ranges, which a video needs. */
function serve(): Promise<{ base: string; close: () => void }> {
  const server = createServer((request, response) => {
    const [, root, ...rest] = decodeURIComponent((request.url ?? "/").split("?")[0] ?? "/").split("/");
    const folder = ROOTS[root ?? ""];
    const file = folder ? normalize(join(folder, ...rest)) : "";
    if (!folder || !file.startsWith(folder + sep) || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    const size = statSync(file).size;
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? "");
    const head = { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "Content-Range, Content-Length" };
    if (!range) {
      response.writeHead(200, { ...head, "Content-Length": size });
      createReadStream(file).pipe(response);
      return;
    }
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
    response.writeHead(206, { ...head, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
    createReadStream(file, { start, end }).pipe(response);
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done({ base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => server.close() })));
}

export interface Renderer {
  /** One frame of one demo edit into one picture. Gives the film's length in frames. */
  still: (demoPath: string, frame: number, output: string) => Promise<number>;
  /** A whole demo edit into one file: a video with its sound (`.mp4`), or its sound alone (`.wav`). Gives the film's length in frames. */
  film: (demoPath: string, output: string) => Promise<number>;
}

/** Runs `work` with the renderer ready: the film bundled once (58 MB, taken away again after), one browser, and the files served for as long as it runs. */
export async function withRenderer<T>(work: (renderer: Renderer) => Promise<T>): Promise<T> {
  const { base, close } = await serve();
  const built = mkdtempSync(join(tmpdir(), "edit-render-"));
  let puppeteerInstance: Awaited<ReturnType<typeof openBrowser>> | undefined;
  try {
    const browser = (puppeteerInstance = await openBrowser("chrome"));
    const serveUrl = await bundle({ entryPoint: resolve("src/edit/film/root.tsx"), outDir: built });
    /** A demo edit as the film is given it, and the film's own account of its size and length. */
    const open = async (demoPath: string, output: string) => {
      const demo = JSON.parse(readFileSync(demoPath, "utf8")) as { edit: unknown; files: Record<string, string> };
      const urls = Object.fromEntries(Object.entries(demo.files).map(([id, name]) => [id, `${base}/media/${name}`]));
      const inputProps = FilmPropsSchema.parse({ edit: demo.edit, kit: `${base}/kit`, urls });
      mkdirSync(dirname(output), { recursive: true });
      return { inputProps, composition: await selectComposition({ serveUrl, id: "film", inputProps, puppeteerInstance: browser }) };
    };
    return await work({
      still: async (demoPath, frame, output) => {
        const { inputProps, composition } = await open(demoPath, output);
        await renderStill({ composition, serveUrl, output, frame, inputProps, puppeteerInstance: browser });
        return composition.durationInFrames;
      },
      film: async (demoPath, output) => {
        const { inputProps, composition } = await open(demoPath, output);
        await renderMedia({ composition, serveUrl, outputLocation: output, codec: output.endsWith(".wav") ? "wav" : "h264", inputProps, puppeteerInstance: browser });
        return composition.durationInFrames;
      },
    });
  } finally {
    await puppeteerInstance?.close({ silent: true });
    close();
    rmSync(built, { recursive: true, force: true });
  }
}

export const stillName = (frame: number) => `frame-${String(frame).padStart(4, "0")}.png`;
