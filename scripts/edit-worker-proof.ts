/**
 * edit-worker-proof.ts — part 2's "done when" (worker plan, Task 7), end to end on this Mac, in one command:
 * a dev server of its own bound to 127.0.0.1, the e2e test account signed in, and Playwright's Chromium on
 * `/dev-edit/worker`:
 *   1. the take is uploaded from the page and comes back analysed, its progress shown;
 *   2. it plays in the Player with its own captions;
 *   3. its first edit renders on the worker with a progress bar;
 *   4. the page reloaded halfway through the render shows the same job going on;
 *   5. the film is downloaded, and five of its frames, decoded exactly, are compared with the Player's
 *      pictures of the same frames by the measure of `edit-preview-vs-render.ts`, twice, each held to its
 *      own limits (`LIMITS`): the Player fed the take's full copy, which the render reads, and the Player as
 *      a creator sees it, on the preview copy (design §8).
 * Each step is a screenshot in the output folder, and the times are written to `times.json` there.
 *
 * The dev server's port is one of 3000 to 3005, the origins the bucket's CORS lists, and the page is opened
 * at `localhost`, where the session's cookie is set. The Player draws the look with WebGL 2, which Chromium
 * has and Playwright's headless shell does not, so the browser is `channel: "chromium"`.
 *
 * Usage:  pnpm exec tsx scripts/edit-worker-proof.ts [<take>] [<out-dir>]
 *         (by default .scratch/media/take.mp4 and .scratch/worker-proof/page)
 * It loads `.env.local` itself and prints no value of it. It signs in with E2E_USER_EMAIL and
 * E2E_USER_PASSWORD from the environment: the e2e test account's, never the owner's. It writes one take,
 * one analysis and one render into that account, in production: run it on purpose, and Modal is metered.
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { READ_SECONDS, signed } from "../src/lib/edit/worker/signing";
import { withDevServer } from "./edit-dev-server";

/**
 * The posted film's frames against the Player's pictures of them: the share of pixels far apart, and how many
 * levels of 255 the colours are apart on average.
 * - `full`, the Player fed the take's full copy, which the render reads: Task 2's limits, as both draw one file.
 * - `seen`, the Player as a creator sees it, on the preview copy (X44: CRF 28, long side 960): the same share
 *   far apart, and levels up to 3.0. That copy alone is 1.7 to 2.8 levels from the full copy (ffmpeg, no
 *   browser, measured 2026-11-21), so 3.0 is its own 2.8 and 0.2 more (X77, the controller's ruling).
 */
const LIMITS = { full: { farApart: 0.004, levels: 1.6 }, seen: { farApart: 0.004, levels: 3.0 } };
/** The origins the bucket's CORS lists: only from these can the page's Player read the take. */
const PORTS = [3000, 3001, 3002, 3003, 3004, 3005];
const MINUTE = 60_000;

function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** The first port of the bucket's list that nothing listens on (`lsof` exits 1 when nothing does). */
function freePort(): number {
  for (const port of PORTS) {
    try {
      execFileSync("lsof", ["-ti", `:${port}`], { stdio: "pipe" });
    } catch {
      return port;
    }
  }
  throw new Error("no port from 3000 to 3005 is free, and the bucket's CORS lists only those");
}

/** The test account's session, as the cookies Supabase's server client reads (`@supabase/ssr`). Nothing of it is printed. */
async function sessionCookies(): Promise<{ name: string; value: string }[]> {
  const url = need("NEXT_PUBLIC_SUPABASE_URL");
  const anon = need("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: need("E2E_USER_EMAIL"), password: need("E2E_USER_PASSWORD") }),
  });
  if (!response.ok) throw new Error(`the test account could not sign in: Supabase answered ${response.status}`);
  const value = `base64-${Buffer.from(JSON.stringify(await response.json())).toString("base64url")}`;
  const ref = new URL(url).hostname.split(".")[0];
  const chunks = value.match(/.{1,3180}/g) ?? [];
  return chunks.map((chunk, i) => ({ name: `sb-${ref}-auth-token.${i}`, value: chunk }));
}

const seconds = (from: number) => Math.round((Date.now() - from) / 100) / 10;
const idIn = (page: Page, name: string) => new URL(page.url()).searchParams.get(name);
const progressOf = async (page: Page, bar: string) => Number(await page.getAttribute(bar, "data-progress"));

/**
 * The Player's picture of a frame, once three pictures in a row are the same: the words are drawn at once and
 * the footage when it is decoded, which from R2 may take longer than two pictures (a seek's footage was seen
 * to arrive after them, 2026-11-21).
 */
async function playerPicture(page: Page, frame: number): Promise<Buffer> {
  await page.evaluate((to) => {
    window.__editPlayer?.pause();
    window.__editPlayer?.seekTo(to);
  }, frame);
  await page.waitForTimeout(500);
  let [before, same] = [await page.screenshot({ clip: { x: 0, y: 0, width: 1080, height: 1920 } }), 0];
  for (let tries = 0; tries < 60 && same < 2; tries++) {
    await page.waitForTimeout(250);
    const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    same = shot.equals(before) ? same + 1 : 0;
    before = shot;
  }
  return before;
}

/** How far two pictures of one size are apart (`edit-preview-vs-render.ts`'s measure). */
function apart(a: PNG, b: PNG): { farApart: number; levels: number } {
  const pixels = a.width * a.height;
  const far = pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0.1 });
  let levels = 0;
  for (let i = 0; i < a.data.length; i += 4) for (let c = 0; c < 3; c++) levels += Math.abs((a.data[i + c] ?? 0) - (b.data[i + c] ?? 0));
  return { farApart: far / pixels, levels: levels / (pixels * 3) };
}

async function proof(browser: Browser, base: string, take: string, out: string): Promise<void> {
  const times: Record<string, number | string> = {};
  const context = await browser.newContext({ viewport: { width: 1000, height: 1700 }, locale: "en-US", acceptDownloads: true });
  await context.addCookies((await sessionCookies()).map((cookie) => ({ ...cookie, url: base })));
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const shoot = async (name: string) => {
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.screenshot({ path: join(out, name), fullPage: true, animations: "disabled", caret: "hide" });
    console.log(`  screenshot ${name}`);
  };

  // 1. Upload, and the analysis watched.
  await page.goto(`${base}/dev-edit/worker`, { waitUntil: "networkidle" });
  await shoot("01-page.png");
  const chosen = Date.now();
  const putting = page.waitForEvent("requestfinished", { predicate: (request) => request.method() === "PUT", timeout: 5 * MINUTE });
  await page.setInputFiles("#take-file", take);
  times.put = Math.round((await putting).timing().responseEnd) / 1000;
  await page.waitForFunction(() => new URL(location.href).searchParams.has("analysis"), undefined, { timeout: 5 * MINUTE });
  times.chosenToAnalysing = seconds(chosen);
  const takeId = idIn(page, "take") ?? "";
  console.log(`1. uploaded ${(statSync(take).size / 1e6).toFixed(1)} MB: the PUT to R2 took ${times.put} s, and the analysis was started ${times.chosenToAnalysing} s after the file was chosen`);
  const analysing = Date.now();
  await page.waitForFunction(() => Number(document.querySelector("#analysis")?.getAttribute("data-progress")) > 0.3, undefined, { timeout: 10 * MINUTE });
  await shoot("02-analysing.png");
  await page.waitForSelector("#analysis[data-status=done], #analysis[data-status=failed]", { timeout: 30 * MINUTE });
  if ((await page.getAttribute("#analysis", "data-status")) !== "done") {
    await shoot("02-analysis-failed.png");
    throw new Error(`the analysis failed: ${await page.textContent("#analysis + p")}`);
  }
  times.analysis = seconds(analysing);
  console.log(`   analysed in ${times.analysis} s`);

  // 2. The take in the Player, with its own captions.
  await page.waitForFunction(() => Boolean(window.__editPlayer), undefined, { timeout: MINUTE });
  const { asset } = (await page.evaluate((id) => fetch(`/api/edit/takes/${id}`).then((response) => response.json()), takeId)) as { asset: { at: { path: string }; words: { text: string; startMs: number }[] | null } };
  const word = asset.words?.[Math.min(3, (asset.words?.length ?? 1) - 1)];
  if (!word) throw new Error("the take came back with no words, so it has no captions to show");
  await page.evaluate((frame) => window.__editPlayer?.seekTo(frame), Math.round(((word.startMs + 60) * 30) / 1000));
  await page.click("#edit-stage"); // a click plays it, as a person's would
  await page.waitForTimeout(1500);
  const playing = await page.evaluate(() => [window.__editPlayer?.isPlaying(), window.__editPlayer?.getCurrentFrame()] as const);
  await page.evaluate((frame) => {
    window.__editPlayer?.pause();
    window.__editPlayer?.seekTo(frame);
  }, Math.round(((word.startMs + 60) * 30) / 1000));
  await page.waitForTimeout(1500);
  const shown = (await page.textContent("#edit-stage")) ?? "";
  if (!shown.includes(word.text)) throw new Error(`the Player's captions do not show "${word.text}" when it is said: they show "${shown}"`);
  if (!playing[0]) throw new Error("the Player did not play");
  if ((await page.getAttribute("#edit-stage", "data-colour")) !== "exact") throw new Error("this browser cannot run the colour pass, so the Player is not what is being proved");
  await shoot("03-player-captions.png");
  console.log(`2. the Player plays (at frame ${playing[1]} after 1.5 s) and its captions show "${word.text}" when it is said`);

  // 3 and 4. The render with its progress bar, and a reload halfway.
  const rendering = Date.now();
  await page.click("#render");
  await page.waitForFunction(() => Number(document.querySelector("#render-progress")?.getAttribute("data-progress")) >= 0.25, undefined, { timeout: 10 * MINUTE });
  const job = idIn(page, "render");
  const before = await progressOf(page, "#render-progress");
  await shoot("04-rendering.png");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("#render-progress", { timeout: MINUTE });
  const after = { job: idIn(page, "render"), progress: await progressOf(page, "#render-progress"), status: await page.getAttribute("#render-progress", "data-status") };
  await shoot("05-after-reload.png");
  if (after.job !== job || after.progress < before || after.status === "failed") throw new Error(`after the reload the page shows ${JSON.stringify(after)}, not the same job going on from ${before}`);
  console.log(`3. rendering: ${Math.round(before * 100)} % before the reload, ${Math.round(after.progress * 100)} % (${after.status}) after it, the same job`);
  await page.waitForSelector("#download, #render-progress[data-status=failed]", { timeout: 15 * MINUTE });
  if ((await page.getAttribute("#render-progress", "data-status")) === "failed") {
    await shoot("06-render-failed.png");
    throw new Error(`the render failed: ${await page.textContent("#render-progress + p")}`);
  }
  times.render = seconds(rendering);
  await shoot("06-rendered.png");
  console.log(`4. rendered in ${times.render} s from the click`);

  // 5. The film downloaded, and five frames compared with the Player's: as a creator sees it, and fed the full copy.
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#download")]);
  const film = join(out, "film.mp4");
  await download.saveAs(film);
  if (errors.length > 0) throw new Error(`the page reported: ${errors.join(" | ")}`);
  const frames = Number(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", film], { encoding: "utf8" }).trim());
  console.log(`5. downloaded ${download.suggestedFilename()}, ${(statSync(film).size / 1e6).toFixed(1)} MB, ${frames} frames`);

  const picked = [0, Math.round(frames / 4), Math.round(frames / 2), Math.round((3 * frames) / 4), frames - 1];
  for (const folder of ["film", "player", "player-full", "side"]) mkdirSync(join(out, folder), { recursive: true });
  const name = (frame: number) => `frame-${String(frame).padStart(4, "0")}.png`;
  execFileSync("ffmpeg", ["-nostdin", "-loglevel", "error", "-y", "-i", film, "-vf", `select=${picked.map((frame) => `eq(n\\,${frame})`).join("+")},scale=flags=accurate_rnd+full_chroma_int+full_chroma_inp,format=rgb24`, "-fps_mode", "passthrough", join(out, "film", "f-%d.png")]);
  picked.forEach((frame, i) => execFileSync("mv", [join(out, "film", `f-${i + 1}.png`), join(out, "film", name(frame))]));

  /** The bare Player's pictures of the picked frames, playing the preview copy as the page gives it, or fed the full copy in its place. */
  const pictures = async (folder: string, copy: "preview" | "full") => {
    const bare = await context.newPage(); // the same session; one pixel of the page is one of the film's
    await bare.setViewportSize({ width: 1080, height: 1920 });
    if (copy === "full") {
      // The page is told the full copy's address in the preview copy's place, and the Player reads it from R2 itself.
      // Signed here with the keys loaded from .env.local: r2.ts is the app's, server only.
      const r2 = { account: need("R2_ACCOUNT_ID"), keyId: need("R2_ACCESS_KEY_ID"), secret: need("R2_SECRET_ACCESS_KEY"), bucket: need("R2_BUCKET") };
      const full = await signed(r2, "GET", asset.at.path, READ_SECONDS);
      await bare.route(`${base}/api/edit/takes/${takeId}`, async (route) => {
        const response = await route.fetch();
        await route.fulfill({ response, json: { ...(await response.json()), previewUrl: full } });
      });
    }
    await bare.goto(`${base}/dev-edit/worker?bare=1&take=${takeId}`, { waitUntil: "networkidle" });
    await bare.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await bare.waitForFunction(() => Boolean(window.__editPlayer), undefined, { timeout: MINUTE });
    const playerFrames = Number(await bare.getAttribute("#edit-stage", "data-frames"));
    if (playerFrames !== frames) throw new Error(`the Player's film is ${playerFrames} frames long and the posted one ${frames}`);
    for (const frame of picked) writeFileSync(join(out, folder, name(frame)), await playerPicture(bare, frame));
    if ((await bare.getAttribute("#edit-stage", "data-colour")) !== "exact") throw new Error("the bare Player could not run the colour pass");
    await bare.close();
  };
  await pictures("player", "preview");
  await pictures("player-full", "full");
  const worst = { seen: { farApart: 0, levels: 0 }, full: { farApart: 0, levels: 0 } };
  const over: number[] = [];
  const read = (folder: string, frame: number) => PNG.sync.read(readFileSync(join(out, folder, name(frame))));
  const percent = (share: number) => `${(share * 100).toFixed(3)} %`;
  const within = (measured: { farApart: number; levels: number }, limit: { farApart: number; levels: number }) => measured.farApart <= limit.farApart && measured.levels <= limit.levels;
  for (const frame of picked) {
    const seen = apart(read("film", frame), read("player", frame));
    const full = apart(read("film", frame), read("player-full", frame));
    for (const [key, measured] of [["seen", seen], ["full", full]] as const) worst[key] = { farApart: Math.max(worst[key].farApart, measured.farApart), levels: Math.max(worst[key].levels, measured.levels) };
    if (!within(full, LIMITS.full) || !within(seen, LIMITS.seen)) over.push(frame);
    execFileSync("ffmpeg", ["-nostdin", "-loglevel", "error", "-y", "-i", join(out, "film", name(frame)), "-i", join(out, "player", name(frame)), "-filter_complex", "hstack,scale=1080:-1", join(out, "side", name(frame).replace(".png", ".jpg"))]);
    console.log(`   frame ${frame}: fed the full copy ${percent(full.farApart)} far apart, ${full.levels.toFixed(2)} levels; as seen (the preview copy) ${percent(seen.farApart)}, ${seen.levels.toFixed(2)} levels${over.includes(frame) ? "  <-- over a limit" : ""}`);
  }
  const told = (key: "full" | "seen") => `at worst ${percent(worst[key].farApart)} far apart and ${worst[key].levels.toFixed(2)} levels (${percent(LIMITS[key].farApart)} and ${LIMITS[key].levels} allowed)`;
  times.frames = `the Player fed the full copy: ${told("full")}; as seen, on the preview copy: ${told("seen")}`;
  writeFileSync(join(out, "times.json"), `${JSON.stringify(times, null, 2)}\n`);
  console.log(`   ${times.frames}; the film (left) and the Player as seen (right) side by side in ${join(out, "side")}`);
  if (over.length > 0) throw new Error(`the film and the Player differ over a limit on frames ${over.join(", ")}`);
  console.log("part 2 proved: uploaded, analysed, played with its captions, rendered through a reload, downloaded, and the same as the Player");
}

async function main(): Promise<void> {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local"); // in-process; what is already set stays as it is
  const [take = ".scratch/media/take.mp4", out = ".scratch/worker-proof/page"] = process.argv.slice(2);
  if (!existsSync(take)) throw new Error(`no take at ${take}`);
  mkdirSync(out, { recursive: true });
  const port = freePort();
  await withDevServer(async (base) => {
    const browser = await chromium.launch({ channel: "chromium", args: ["--lang=en-US"] });
    try {
      await proof(browser, base, take, out);
    } finally {
      await browser.close();
    }
  }, { port, name: "localhost" });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
