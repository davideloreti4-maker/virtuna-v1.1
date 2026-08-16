/**
 * TikTok Studio → Inspiration scraper.
 *
 * Reuses the session captured by `tiktok-studio-login.ts` and records the
 * JSON XHRs the Inspiration page fires, rather than reading the DOM. Two
 * reasons: the payloads carry fields the UI never paints, and an internal
 * API shape survives a CSS reshuffle where selectors do not.
 *
 * First run is reconnaissance — read `endpoints.json` to see which paths
 * actually returned rows, then narrow RECORD_PATTERNS to those.
 *
 * ⚠ The data here is PERSONALISED to the signed-in account (its niche,
 * region, history). It is one creator's slice, not a shared library.
 *
 * Usage:
 *   node node_modules/tsx/dist/cli.mjs scripts/scrape-studio-inspiration.ts
 *   HEADLESS=1 node node_modules/tsx/dist/cli.mjs scripts/scrape-studio-inspiration.ts
 */
import { chromium, type Response, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { AUTH_STATE_PATH } from "./tiktok-studio-login";

const OUT_DIR = path.resolve(process.cwd(), ".tiktok-auth/out");

/** Tabs worth visiting; each fires its own set of XHRs. */
const TABS = [
  { name: "inspiration", url: "https://www.tiktok.com/tiktokstudio/inspiration" },
  // Creator Search Insights — search demand vs supply. No public equivalent.
  { name: "search-insights", url: "https://www.tiktok.com/tiktokstudio/inspiration/search" },
];

/** Only record responses whose URL looks like a data call. */
const RECORD_PATTERNS = [/\/api\//, /\/aweme\//, /creator/i, /inspiration/i, /trend/i];

interface Captured {
  url: string;
  status: number;
  method: string;
  body: unknown;
}

async function recordTab(
  tabName: string,
  url: string,
  captured: Captured[],
  page: Page,
) {
  const onResponse = async (res: Response) => {
    const u = res.url();
    if (!RECORD_PATTERNS.some((re) => re.test(u))) return;
    if (!/json/i.test(res.headers()["content-type"] ?? "")) return;
    try {
      captured.push({
        url: u,
        status: res.status(),
        method: res.request().method(),
        body: await res.json(),
      });
    } catch {
      /* non-JSON body despite the header — skip it */
    }
  };

  page.on("response", onResponse);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // Fail loudly on a stale session. A silent empty scrape is worse than a crash.
  await page.waitForTimeout(3000);
  if (/\/login|\/signup/.test(page.url())) {
    throw new Error(
      `Bounced to ${page.url()} — the saved session expired. Re-run tiktok-studio-login.ts`,
    );
  }

  // Nudge lazy-loaded rows into fetching.
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(2000);
  page.off("response", onResponse);
  console.log(`  ${tabName}: ${captured.length} JSON responses so far`);
}

async function main() {
  if (!fs.existsSync(AUTH_STATE_PATH)) {
    console.error(
      `No session at ${AUTH_STATE_PATH}.\nRun: node node_modules/tsx/dist/cli.mjs scripts/tiktok-studio-login.ts`,
    );
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: process.env.HEADLESS === "1" });
  const context = await browser.newContext({
    storageState: AUTH_STATE_PATH,
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();
  const captured: Captured[] = [];

  try {
    for (const tab of TABS) {
      console.log(`Visiting ${tab.name}…`);
      await recordTab(tab.name, tab.url, captured, page);
    }
  } finally {
    await browser.close();
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "raw-responses.json"),
    JSON.stringify(captured, null, 2),
  );

  // Endpoint census: which paths returned something with rows in it?
  const census = captured.map((c) => {
    const u = new URL(c.url);
    const body = c.body as Record<string, unknown> | null;
    const arrays = body
      ? Object.entries(body).flatMap(([k, v]) =>
          Array.isArray(v) ? [`${k}[${v.length}]`] : [],
        )
      : [];
    return {
      path: u.pathname,
      params: [...u.searchParams.keys()],
      status: c.status,
      topLevelArrays: arrays,
      bytes: JSON.stringify(c.body).length,
    };
  });
  census.sort((a, b) => b.bytes - a.bytes);
  fs.writeFileSync(path.join(OUT_DIR, "endpoints.json"), JSON.stringify(census, null, 2));

  console.log(`\nWrote ${captured.length} responses to ${OUT_DIR}/raw-responses.json`);
  console.log("Biggest payloads (these are your data endpoints):");
  for (const c of census.slice(0, 8)) {
    console.log(
      `  ${String(c.bytes).padStart(8)}B  ${c.path}  ${c.topLevelArrays.join(",") || "—"}`,
    );
  }
  if (captured.length === 0) {
    console.error("\nNothing captured. Widen RECORD_PATTERNS or check the session.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
