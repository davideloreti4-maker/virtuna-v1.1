#!/usr/bin/env node
/* Result page shots (plan 2026-11-20, Task 2). Opens /dev/result on a recorded run, signed in, and
 * writes a screenshot plus the measured box of every [data-result] element.
 *
 *   node scripts/result-shots.cjs --out <dir> [--fixture early] [--view phone|desktop]
 *        [--theme light|dark] [--tab brain|engagement|audience] [--scroll <px>] [--t <seconds>]
 *        [--processing] [--full] [--clean] [--no-frames] [--name <file>] [--base http://127.0.0.1:3021]
 *        [--cookies .scratch/next-look/cookie.json] [--video <url>] [--video-file <path>]
 *        [--width <px>] [--height <px>] [--reduced-motion] [--query "<k=v&k=v>"]
 *
 * Phone 393×852, desktop 1440×900, device scale 2. The scene frames are served from the local copy
 * of the reference run (.scratch/next-look/part2/frames/ZVDugmW7*), because stored frame addresses
 * expire: the page is opened with frames=https://frames.fixture/early and those requests are
 * answered from disk. Chromium runs with SwiftShader WebGL (the Brain panel is WebGL).
 *
 * Writes <out>/<name>.png and <out>/<name>.json. In the JSON each [data-result] name maps to a list
 * of boxes { x, y, width, height } relative to the page's content (the scroll container is <main>,
 * so y includes main's scrollTop), plus the viewport box at the time of the shot.
 * --full grows the window to the page's whole height before the shot.
 * --width / --height replace the view's window size (the widths between phone and desktop);
 * --reduced-motion opens the page as a visitor who asked for less motion.
 * --video plays that address as the run's video; --video-file serves a local file as that video
 * (at https://video.fixture/clip); a --video on https://video.fixture/ without a file answers 404.
 * --query appends more of the dev page's parameters to its address (the running screen's moments,
 * e.g. --processing --query "elapsed=42&groups=10&runframes=7"); the file name then carries
 * q<6 characters of the query's hash> unless --name is given.
 */
const { chromium } = require("@playwright/test");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

const ROOT = path.join(__dirname, "..");
const outDir = arg("out", null);
const base = arg("base", "http://127.0.0.1:3021");
const cookieFile = arg("cookies", path.join(ROOT, ".scratch/next-look/cookie.json"));
const fixture = arg("fixture", "early");
const view = arg("view", "phone");
const theme = arg("theme", "light");
const tab = arg("tab", null);
const scroll = Number(arg("scroll", 0)) || 0;
const t = arg("t", null);
const processing = arg("processing", false) === true;
const full = arg("full", false) === true;
// --clean hides what only a development server draws (Next's dev badge, the query devtools button).
const clean = arg("clean", false) === true;
// --no-frames opens the run without scene frames (a run whose frame addresses have expired).
const noFrames = arg("no-frames", false) === true;
const videoFile = arg("video-file", null);
const video = arg("video", videoFile ? "https://video.fixture/clip" : null);
const width = Number(arg("width", 0)) || null;
const height = Number(arg("height", 0)) || null;
const reducedMotion = arg("reduced-motion", false) === true;
const extraQuery = (() => {
  const value = arg("query", null);
  return typeof value === "string" ? value.replace(/^[?&]+/, "") : null;
})();

if (!outDir || !["phone", "desktop"].includes(view) || !["light", "dark"].includes(theme)) {
  console.error(
    "usage: result-shots.cjs --out <dir> [--fixture early] [--view phone|desktop] [--theme light|dark] [--tab brain|engagement|audience] [--scroll px] [--t s] [--processing] [--full] [--name file]",
  );
  process.exit(2);
}

const name =
  arg("name", null) ||
  [fixture, view, width ? `w${width}` : null, theme, tab, reducedMotion ? "calm" : null, scroll ? `s${scroll}` : null, t != null ? `t${t}` : null, processing ? "running" : null, extraQuery ? `q${crypto.createHash("sha1").update(extraQuery).digest("hex").slice(0, 6)}` : null, full ? "full" : null]
    .filter(Boolean)
    .join("-");

const FRAMES_HOST = "https://frames.fixture";
const framesDir = (() => {
  const dir = path.join(ROOT, ".scratch/next-look/part2/frames");
  const match = fs.readdirSync(dir).find((entry) => entry.startsWith("ZVDugmW7"));
  if (!match) throw new Error(`no ZVDugmW7* folder in ${dir}`);
  return path.join(dir, match);
})();

const VIEWPORTS = { phone: { width: 393, height: 852 }, desktop: { width: 1440, height: 900 } };

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const host = new URL(base).hostname;
  const cookies = JSON.parse(fs.readFileSync(cookieFile, "utf8")).map((c) => ({ ...c, domain: host, path: "/" }));

  const browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"],
  });
  const viewport = { width: width ?? VIEWPORTS[view].width, height: height ?? VIEWPORTS[view].height };
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    colorScheme: theme,
    ...(reducedMotion ? { reducedMotion: "reduce" } : {}),
    ...(view === "phone" ? { hasTouch: true, isMobile: true } : {}),
  });
  await context.addCookies(cookies);
  await context.addInitScript((choice) => {
    try {
      localStorage.setItem("maven-theme", choice);
    } catch {
      /* storage blocked */
    }
  }, theme);

  // The reference run's frames, from disk.
  await context.route(`${FRAMES_HOST}/**`, async (route) => {
    const file = path.join(framesDir, path.basename(new URL(route.request().url()).pathname));
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: "image/jpeg", body: fs.readFileSync(file) });
  });

  await context.route("https://video.fixture/**", async (route) => {
    if (!videoFile || !fs.existsSync(videoFile)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: "video/mp4", body: fs.readFileSync(videoFile) });
  });

  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const query = new URLSearchParams({ fixture });
  if (!noFrames) query.set("frames", `${FRAMES_HOST}/early`);
  if (processing) query.set("processing", "1");
  if (t != null) query.set("t", String(t));
  if (video) query.set("video", String(video));
  for (const [key, value] of new URLSearchParams(extraQuery ?? "")) query.set(key, value);
  const url = `${base}/dev/result?${query}`;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector("main", { timeout: 120_000 });
  // The result frame (or a state's line) is in place once any card or line rendered.
  await page
    .waitForFunction(() => document.querySelector("main [data-result], main [role='status'], main p, main [aria-busy]"), null, { timeout: 60_000 })
    .catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);

  if (tab) {
    const label = { brain: "Brain", engagement: "Engagement", audience: "Audience" }[tab];
    if (!label) throw new Error(`unknown tab ${tab}`);
    await page.getByRole("tab", { name: label }).click();
  }

  if (full) {
    const height = await page.evaluate(() => {
      const main = document.querySelector("main");
      return Math.ceil((main ? main.scrollHeight : document.body.scrollHeight) + (main ? main.getBoundingClientRect().top : 0));
    });
    await page.setViewportSize({ width: viewport.width, height: Math.max(viewport.height, height) });
  }

  if (scroll) {
    await page.evaluate((px) => {
      const main = document.querySelector("main");
      if (main) main.scrollTop = px;
    }, scroll);
  }
  await page.waitForTimeout(1200);

  // The Brain panel is WebGL: under SwiftShader the mesh and its field take several seconds. Its
  // ready signal is the canvas wrapper turning `opacity-100` (BrainStage sets it on CortexCanvas's
  // onReady: the mesh is parsed and the field built). Then give the surface time to walk to its
  // reading (the canvas eases toward it, and slow software frames ease slowly).
  if (tab === "brain") {
    const ready = await page
      .waitForFunction(() => document.querySelector('[data-result="brain-stage"] .opacity-100 canvas'), null, { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    if (ready) await page.waitForTimeout(3000);
    else console.warn(`${name}: the brain never reported ready within 20 s; the canvas in this shot may be empty`);
  }

  if (clean) {
    const devOnly = ["nextjs-portal", ".tsqd-parent-container", "[class*=\"tsqd-\"]", "div:has(> button[aria-label=\"Open dev mock panel\"])"];
    await page.addStyleTag({ content: `${devOnly.join(", ")} { display: none !important; }` });
  }
  await page.screenshot({ path: path.join(outDir, `${name}.png`), animations: "disabled", caret: "hide", timeout: 30_000 });

  const boxes = await page.evaluate(() => {
    const main = document.querySelector("main");
    const scrollTop = main ? main.scrollTop : 0;
    const scrollLeft = main ? main.scrollLeft : 0;
    const out = {};
    for (const el of document.querySelectorAll("[data-result]")) {
      const r = el.getBoundingClientRect();
      const key = el.getAttribute("data-result");
      (out[key] = out[key] || []).push({
        x: Math.round((r.left + scrollLeft) * 10) / 10,
        y: Math.round((r.top + scrollTop) * 10) / 10,
        width: Math.round(r.width * 10) / 10,
        height: Math.round(r.height * 10) / 10,
        viewport: { x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10 },
      });
    }
    return {
      url: location.pathname + location.search,
      theme: document.documentElement.getAttribute("data-theme") || "light",
      look: document.documentElement.getAttribute("data-look"),
      scrollTop,
      boxes: out,
    };
  });
  boxes.errors = errors;
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(boxes, null, 2));

  console.log(`${name}: ${Object.keys(boxes.boxes).join(", ") || "(no data-result)"}${errors.length ? ` | page errors: ${errors.join(" / ")}` : ""}`);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
