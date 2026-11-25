/**
 * render.mjs — draws the film: inside the render image, and on a developer's machine for its tests.
 *
 *   node render.mjs size   <props.json>                                prints {"frames": n, "fps": f}
 *   node render.mjs slices <props.json> <out-dir> <frames> <per> <first> <last> <browsers>
 *                                                                         writes v<NNN>.ts and a<NNN>.aac
 *   node render.mjs join   <dir> <out.mp4> <fps> <frames> <per>          joins every slice of the film
 *   node render.mjs stills <props.json> <out-dir> <frame>...             writes frame-NNNN.png (each frame in the film)
 *
 * A film is rendered in slices, each by a browser of its own with two pages (X50): one browser has
 * one GPU process, and in software every page's drawing queues through it. How long a slice is, is
 * the caller's (worker/render/plan.py): <per> frames, the last fewer. <frames> is the film's length
 * as the caller sized it; a browser here that reports another fails the render, naming both. The
 * slices follow the engine's recipe for a render in parts (its "Distributed rendering" page at
 * 4.0.545): every slice with the same options, the sound of each kept apart for a seamless join,
 * then joined. While rendering, `slices` prints {"frames": n} (frames drawn since the last such
 * line) at most once a second, and {"slice": i, "seconds": s} as each slice is done. `join` needs
 * no browser: the film's rate and length come from `size`.
 *
 * props.json is `{ "edit": <an edit>, "urls": { <file id>: <address> } }`. An address is https (a
 * signed one) or the name of a file in the folder of development files. That folder and the kit's
 * are served to this machine only, and the film is told where. Before anything is drawn, every file
 * of the edit is asked for once, so a file that is not there fails the render with its id. Where
 * frames are drawn (`slices`, `stills`), a file at an https address is first fetched whole by this
 * machine and served from here too: the browsers never read another host (`fetchFiles`, X72).
 *
 * A failure exits 1 with the whole error on stderr. Only a failure worded for the creator (a `Said`: a file that cannot be
 * read, a frame past the film's end, the film's look that cannot be drawn, a slice failed by one of these) is followed by its
 * message alone, as the last line: `EDIT_ERROR: <message>`. The worker puts that line in a job's row or the stills' answer
 * (render/script.py); any other failure it tells as its own.
 *
 * From the environment: EDIT_BUNDLE (the film bundled by scripts/edit-bundle.ts; worker/.bundle by
 * default), EDIT_KIT (the kit's folder; public/edit by default), EDIT_MEDIA (the folder of
 * development files; none by default), EDIT_GL (the browser's GL; "swangle" by default, which is
 * WebGL in software, as on a machine with no GPU), EDIT_FETCH_SECONDS (how long the fetch of the files
 * on another host may take; 300 by default, see FETCH_MS).
 */
import { combineChunks, openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const PAGES = 2;
// How every frame is encoded, the same for every slice as the recipe asks. BT.709, measured 2026-11-20
// against this Mac's stills: with the engine's default, Chromium drew the film 2.1 levels off on
// average; with BT.709 1.2. The engine calls BT.709's transfer BT.709, where Safari then draws it 7.6
// off; finish.py renames it sRGB's, as the pixels are, and Safari draws it 1.2 off (worker plan, Task 2).
// No frame format is set: the engine takes the frames as raw pixels through shared memory, so PNG,
// JPEG 80 and JPEG 95 gave the same picture, bit for bit.
const PICTURE = { colorSpace: "bt709" };
const here = fileURLToPath(new URL(".", import.meta.url));
const BUNDLE = resolve(process.env.EDIT_BUNDLE ?? join(here, "..", ".bundle"));
// The folders served: the kit's, the development files', and (`fetchFiles`) the files this run fetched.
const ROOTS = { kit: resolve(process.env.EDIT_KIT ?? join(here, "..", "..", "public", "edit")), media: process.env.EDIT_MEDIA ? resolve(process.env.EDIT_MEDIA) : null, files: null };
const chromiumOptions = { gl: process.env.EDIT_GL ?? "swangle" };
// How long fetching the files on another host may take, all of them together (`fetchFiles`). A take is at most 2 GB
// (the upload's limit); Modal stored the 90 s film's 101.5 MB to R2 in 5.6 s, 18 MB/s, at which 2 GB takes 114 s. 300 s
// fetches 2 GB down to 6.8 MB/s, a third of that, and leaves `render_slices` (600 s) the time to draw.
const FETCH_MS = 1000 * Number(process.env.EDIT_FETCH_SECONDS ?? 300);
const TYPES = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".jpg": "image/jpeg", ".png": "image/png", ".ttf": "font/ttf", ".woff2": "font/woff2" };

const say = (line) => console.log(JSON.stringify(line));
/** A failure this script words itself, for the creator: only these are marked (EDIT_ERROR) and become the worker's own words in a
 * job's row or the stills' answer. The engine's own failures (a browser that closed, a timeout, an internal address) are not
 * marked, and the worker tells them as its own failure, their words in the log only (fix round 1 of part 3's Task 6, I1). */
class Said extends Error {}
// The film's own words, which come back through the engine as its error, not as a Said: the look that cannot be drawn (X73,
// Footage.tsx), the one error the film words itself.
const FILM_SAYS = /^the look cannot be drawn on the file "/;
const said = (error) => error instanceof Said || (error instanceof Error && FILM_SAYS.test(error.message));
const pad = (n, digits) => String(n).padStart(digits, "0");
const sliceOf = (i, per, frames) => [i * per, Math.min(frames, (i + 1) * per) - 1];
const videoPart = (dir, i) => resolve(dir, `v${pad(i, 3)}.ts`);
const soundPart = (dir, i) => resolve(dir, `a${pad(i, 3)}.aac`);

/** Serves the kit and the development files to this machine only, with byte ranges, which a video needs.
 * A request it cannot read is answered 400, and a file it cannot send cuts that answer off; neither stops the render. */
function serve() {
  const server = createServer((request, response) => {
    try {
      answer(request, response);
    } catch {
      if (response.headersSent) response.destroy();
      else response.writeHead(400).end();
    }
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server)));
}

function answer(request, response) {
  const [, root = "", ...rest] = decodeURIComponent((request.url ?? "/").split("?")[0]).split("/");
  const folder = Object.hasOwn(ROOTS, root) ? ROOTS[root] : null;
  const file = folder ? normalize(join(folder, ...rest)) : "";
  if (!folder || !file.startsWith(folder + sep) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end();
    return;
  }
  const size = statSync(file).size;
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? "");
  const head = { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "Content-Range, Content-Length" };
  const send = (options) => createReadStream(file, options).on("error", () => response.destroy()).pipe(response);
  if (!range) {
    response.writeHead(200, { ...head, "Content-Length": size });
    send({});
    return;
  }
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
  response.writeHead(206, { ...head, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
  send({ start, end });
}

/** The props the film is given: the edit, the kit where this machine serves it, and an address the browser can fetch for each file. */
function propsFrom(path, base) {
  const { edit, urls } = JSON.parse(readFileSync(path, "utf8"));
  const address = ([id, at]) => {
    if (/^https?:\/\//.test(at)) return [id, at];
    if (!ROOTS.media) throw new Error(`the file "${id}" is named "${at}", and there is no folder of development files (EDIT_MEDIA)`);
    return [id, `${base}/media/${at.split("/").map(encodeURIComponent).join("/")}`];
  };
  return { edit, kit: `${base}/kit`, urls: Object.fromEntries(Object.entries(urls ?? {}).map(address)) };
}

/** Asks once for the first byte of every file of the edit, so a file that is not there fails here, by its id, and not deep in a render.
 * Where a file is fetched from follows `addressOf` in src/edit/film/props.ts, which this file cannot import: keep the two alike. */
async function checkFiles(props) {
  await Promise.all(props.edit.assets.map(async (asset) => {
    const address = "kit" in asset.at ? `${props.kit}/${asset.at.kit}` : props.urls[asset.id];
    if (!address) return; // the film itself refuses a file with no address, naming it
    let response;
    try {
      response = await fetch(address, { headers: { Range: "bytes=0-0" } });
    } catch (error) {
      throw new Said(`the file "${asset.id}" cannot be read (${error.cause?.code ?? error.message})`);
    }
    await response.body?.cancel();
    if (!response.ok) throw new Said(`the file "${asset.id}" cannot be read (${response.status} ${response.statusText})`);
  }));
}

/**
 * The props with every file on another host (an https address, as the bucket's signed reads) fetched whole into a folder
 * of this run, and served from this machine like the development files (X72). A page reads a file of another host only
 * where that host answers the page's origin, and the engine gives each browser of a run a server, so an origin, of its
 * own: localhost:3000, 3001 and on. The bucket answers the origins its CORS lists, localhost:3000 to 3005, so on Modal
 * the seventh and eighth browsers of each render container were refused the take, and the engine drew their slices by
 * its fall-back, which has no colour pass (2026-11-20). From here, no browser reads another host, whatever its CORS.
 * A file that cannot be fetched whole fails the render, by its id.
 */
async function fetchFiles(props, base, signal) {
  const why = (error) => (error?.name === "TimeoutError" ? "timed out" : (error?.cause?.code ?? error?.code ?? error?.message));
  // After `propsFrom`, an address is this machine's (a development file) or another host's.
  const elsewhere = props.edit.assets.filter((asset) => props.urls[asset.id] && !props.urls[asset.id].startsWith(`${base}/`));
  if (elsewhere.length === 0) return props;
  ROOTS.files = mkdtempSync(join(tmpdir(), "edit-files-"));
  const urls = { ...props.urls };
  // All are waited for, so that a failure is given once every fetch has stopped writing into the folder.
  const fetched = await Promise.allSettled(elsewhere.map(async (asset, i) => {
    const address = props.urls[asset.id];
    const name = `${i}${extname(new URL(address).pathname)}`; // the extension says the file's type when it is served
    let response;
    try {
      response = await fetch(address, { signal });
    } catch (error) {
      throw new Said(`the file "${asset.id}" cannot be read (${why(error)})`);
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Said(`the file "${asset.id}" cannot be read (${response.status} ${response.statusText})`);
    }
    try {
      // A file cut short fails here: the fetch holds the answer to the length it was given (tested).
      await pipeline(Readable.fromWeb(response.body), createWriteStream(join(ROOTS.files, name)));
    } catch (error) {
      throw new Said(`the file "${asset.id}" cannot be read (${why(error)})`);
    }
    urls[asset.id] = `${base}/files/${name}`;
  }));
  const failed = fetched.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
  return { ...props, urls };
}

/** Runs `work` with the files served and checked, `browsers` browsers open, and the film's composition as the first of them reports it.
 * With `fetched`, the files at https addresses are fetched to this machine first (`fetchFiles`), while the first browser opens. */
async function withFilm(propsPath, browsers, work, { fetched = false } = {}) {
  const server = await serve();
  const open = [];
  const stop = new AbortController(); // stops the fetches where the run ends before they do
  let fetching = Promise.resolve();
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const props = propsFrom(propsPath, base);
    fetching = fetched ? fetchFiles(props, base, AbortSignal.any([stop.signal, AbortSignal.timeout(FETCH_MS)])) : Promise.resolve(props);
    fetching.catch(() => {}); // it is waited for below, once the first browser is open (and can be closed)
    open.push(await openBrowser("chrome", { chromiumOptions }));
    const inputProps = await fetching;
    const composition = await selectComposition({ serveUrl: BUNDLE, id: "film", inputProps, puppeteerInstance: open[0], chromiumOptions });
    await checkFiles(inputProps);
    // All are waited for, so that where one fails to open, those that did are closed below.
    const opened = await Promise.allSettled(Array.from({ length: browsers - 1 }, () => openBrowser("chrome", { chromiumOptions })));
    open.push(...opened.filter((result) => result.status === "fulfilled").map((result) => result.value));
    const failed = opened.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
    return await work({ composition, inputProps, browsers: open });
  } finally {
    await Promise.all(open.map((browser) => browser.close({ silent: true }).catch(() => {})));
    server.close();
    stop.abort();
    await fetching.catch(() => {}); // no fetch is still writing into the folder taken away here
    if (ROOTS.files) rmSync(ROOTS.files, { recursive: true, force: true });
  }
}

async function size(propsPath) {
  await withFilm(propsPath, 1, async ({ composition }) => say({ frames: composition.durationInFrames, fps: composition.fps }));
}

async function slices(propsPath, outDir, frames, per, first, last, browsers) {
  if (!(frames > 0 && per > 0)) throw new Error(usage);
  if (!(first <= last)) throw new Error(`slices from ${first} to ${last}: two whole numbers, the first no larger`);
  const count = Math.ceil(frames / per);
  if (last >= count) throw new Error(`the film has slices 0 to ${count - 1}; asked for ${first} to ${last}`);
  const asked = Array.from({ length: last - first + 1 }, (_, k) => first + k);
  mkdirSync(outDir, { recursive: true });
  // The recipe gives every slice the composition of the main routine. Here each container sizes the
  // film again (its addresses are its own), so it must come to the same length, or nothing is drawn.
  await withFilm(propsPath, Math.min(browsers, asked.length), async ({ composition, inputProps, browsers: open }) => {
    if (composition.durationInFrames !== frames) throw new Error(`the film here is ${composition.durationInFrames} frames long; it was sized at ${frames}`);
    let drawn = 0;
    let saidAt = Date.now();
    const tell = () => {
      if (drawn > 0) say({ frames: drawn });
      drawn = 0;
      saidAt = Date.now();
    };
    await Promise.all(open.map(async (browser) => {
      for (let i = asked.shift(); i !== undefined; i = asked.shift()) {
        const started = Date.now();
        const [from, to] = sliceOf(i, per, frames);
        let mine = 0;
        // A slice that fails fails the render, and says which (the other slices are stopped with it); marked only where what
        // failed it was said (the look that cannot be drawn), not where the engine failed.
        const failed = (error) => {
          throw new (said(error) ? Said : Error)(`slice ${i} (frames ${from} to ${to}): ${error instanceof Error ? error.message : String(error)}`, { cause: error });
        };
        await renderMedia({
          composition, serveUrl: BUNDLE, inputProps, puppeteerInstance: browser, chromiumOptions, concurrency: PAGES, licenseKey: "free-license", ...PICTURE,
          frameRange: [from, to], compositionStart: 0, codec: "h264-ts", audioCodec: null, forSeamlessAacConcatenation: true,
          enforceAudioTrack: true, numberOfGifLoops: null, outputLocation: videoPart(outDir, i), separateAudioTo: soundPart(outDir, i),
          onProgress: ({ renderedFrames }) => {
            drawn += renderedFrames - mine;
            mine = renderedFrames;
            if (Date.now() - saidAt >= 1000) tell();
          },
        }).catch(failed);
        drawn += to - from + 1 - mine;
        tell();
        say({ slice: i, seconds: (Date.now() - started) / 1000 });
      }
    }));
  }, { fetched: true });
}

async function joinSlices(dir, out, fps, frames, per) {
  if (!(fps > 0 && frames > 0 && per > 0)) throw new Error(usage);
  const parts = Array.from({ length: Math.ceil(frames / per) }, (_, i) => i);
  for (const i of parts) {
    if (!existsSync(videoPart(dir, i)) || !existsSync(soundPart(dir, i))) throw new Error(`slice ${i} is missing from ${dir}`);
  }
  await combineChunks({
    outputLocation: resolve(out), videoFiles: parts.map((i) => videoPart(dir, i)), audioFiles: parts.map((i) => soundPart(dir, i)),
    codec: "h264", audioCodec: null, fps, framesPerChunk: per, preferLossless: false, compositionDurationInFrames: frames,
  });
}

async function stills(propsPath, outDir, frames) {
  if (frames.length === 0 || frames.some(Number.isNaN)) throw new Error(usage);
  mkdirSync(outDir, { recursive: true });
  await withFilm(propsPath, 1, async ({ composition, inputProps, browsers: [browser] }) => {
    // The film is sized here, and nowhere else (the worker cannot lay an edit out): every frame asked is held to its length
    // before any is drawn, so a frame past the end draws nothing.
    const past = frames.find((frame) => frame >= composition.durationInFrames);
    if (past !== undefined) throw new Said(`frame ${past} is past the film's end: it has ${composition.durationInFrames} frames`);
    for (const frame of frames) {
      await renderStill({ composition, serveUrl: BUNDLE, output: resolve(outDir, `frame-${pad(frame, 4)}.png`), frame, inputProps, puppeteerInstance: browser, chromiumOptions, licenseKey: "free-license" });
    }
  }, { fetched: true });
}

const whole = (text) => (/^\d+$/.test(text ?? "") ? Number(text) : NaN);
const [command, ...args] = process.argv.slice(2);
const commands = {
  size: () => size(args[0]),
  slices: () => slices(args[0], args[1], ...args.slice(2, 6).map(whole), Math.max(1, whole(args[6]) || 1)),
  join: () => joinSlices(args[0], args[1], Number(args[2]), whole(args[3]), whole(args[4])),
  stills: () => stills(args[0], args[1], args.slice(2).map(whole)),
};
const usage = "usage: render.mjs size <props.json> | slices <props.json> <out-dir> <frames> <per> <first> <last> <browsers> | join <dir> <out.mp4> <fps> <frames> <per> | stills <props.json> <out-dir> <frame>...";

try {
  if (!commands[command] || !args[0] || !args[1] && command !== "size") throw new Error(usage);
  await commands[command]();
  process.exit(0);
} catch (error) {
  // The whole error for the log; then, where this script or the film said it, its message alone, marked, for the worker to put in
  // a job's row or the stills' answer (render/script.py). Anything else is the worker's own failure.
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  if (error instanceof Error && error.cause instanceof Error) console.error(`Caused by: ${error.cause.stack ?? error.cause.message}`);
  if (said(error)) console.error(`EDIT_ERROR: ${error.message.split("\n").find((line) => line.trim()).trim()}`);
  process.exit(1);
}
