#!/usr/bin/env node
/* Next-look probe. For each route and viewport it records <html>'s attributes, the computed value
 * of every custom property declared in globals.css, which shell landmarks are visible, and
 * screenshots. Used to prove the flag-off app is unchanged and to look at the flag-on app. The
 * phone has no bottom tab bar: a "Places" navigation drawn on any route is reported as a FAIL and
 * the probe exits 1. Its landmark keeps the name `tabBar`, because the flag-off comparison
 * (next-look-compare.cjs) checks these keys against stored baselines.
 *
 *   node scripts/next-look-probe.cjs --base http://localhost:3021 \
 *        --cookies .scratch/next-look/cookie.json --out .scratch/next-look/baseline \
 *        [--theme light|dark|system] [--contrast more] [--reduced-transparency] [--chrome-width 220]
 */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

const base = arg("base", null);
const cookieFile = arg("cookies", null);
const outDir = arg("out", null);
const theme = arg("theme", null);
const contrast = arg("contrast", null);
const reducedTransparency = arg("reduced-transparency", false) === true;
const chromeWidth = Number(arg("chrome-width", 220));

if (!base || !cookieFile || !outDir) {
  console.error("usage: next-look-probe.cjs --base <url> --cookies <file> --out <dir> [--theme t] [--contrast more] [--reduced-transparency] [--chrome-width px]");
  process.exit(2);
}

const ROUTES = ["/home", "/library", "/feed"];
const VIEWPORTS = [
  { name: "phone", width: 393, height: 852 },
  { name: "desk", width: 1440, height: 900 },
];

const css = fs.readFileSync(path.join(__dirname, "..", "src/app/globals.css"), "utf8");
const TOKENS = [...new Set([...css.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]))].sort();

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const host = new URL(base).hostname;
  const cookies = JSON.parse(fs.readFileSync(cookieFile, "utf8")).map((c) => ({ ...c, domain: host, path: "/" }));
  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      ...(contrast ? { contrast } : {}),
    });
    await context.addCookies(cookies);
    if (theme) {
      await context.addInitScript((t) => {
        try { localStorage.setItem("maven-theme", t); } catch { /* storage blocked */ }
      }, theme);
    }
    const page = await context.newPage();
    if (reducedTransparency) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
      });
    }

    for (const route of ROUTES) {
      const slug = `${route.replace(/\W+/g, "") || "root"}-${vp.name}`;
      await page.goto(base + route, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("main", { timeout: 60_000 });
      await page.waitForTimeout(2500);

      const data = await page.evaluate((names) => {
        const root = document.documentElement;
        const cs = getComputedStyle(root);
        const tokens = {};
        for (const n of names) tokens[n] = cs.getPropertyValue(n).trim();
        const shown = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none";
        };
        return {
          url: location.pathname,
          html: {
            look: root.getAttribute("data-look"),
            theme: root.getAttribute("data-theme"),
            colorScheme: cs.colorScheme,
          },
          landmarks: {
            tabBar: shown('nav[aria-label="Places"]'),
            appNav: shown('nav[aria-label="App navigation"]'),
            back: shown('button[aria-label="Back"]'),
            burger: shown('button[aria-label="Open sidebar"]'),
          },
          bodyBackground: getComputedStyle(document.body).backgroundColor,
          bodyWeight: getComputedStyle(document.body).fontWeight,
          tokens,
        };
      }, TOKENS);
      fs.writeFileSync(path.join(outDir, `${slug}.json`), JSON.stringify(data, null, 2));

      const opts = { animations: "disabled", caret: "hide", timeout: 20_000 };
      try {
        await page.screenshot({ ...opts, path: path.join(outDir, `${slug}.png`) });
      } catch (e) {
        console.log(`${slug}: viewport screenshot skipped (${e.message.split("\n")[0]})`);
      }
      const clips =
        vp.name === "desk"
          ? { chrome: { x: 0, y: 0, width: chromeWidth, height: vp.height } }
          : {
              chrome: { x: 0, y: 0, width: vp.width, height: 66 },
              bottom: { x: 0, y: vp.height - 130, width: vp.width, height: 130 },
            };
      for (const [name, clip] of Object.entries(clips)) {
        await page.screenshot({ ...opts, clip, path: path.join(outDir, `${slug}-${name}.png`) });
      }
      console.log(slug, JSON.stringify(data.html), JSON.stringify(data.landmarks), data.bodyBackground, `weight ${data.bodyWeight}`);
      if (data.landmarks.tabBar) {
        console.log(`FAIL ${slug}: a "Places" navigation is drawn; the phone has no bottom tab bar`);
        process.exitCode = 1;
      }
    }
    await context.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
