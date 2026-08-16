/**
 * TikTok Studio — one-time login capture.
 *
 * Opens a real browser window. YOU log in by hand (password, 2FA, captcha —
 * whatever TikTok asks). Press ENTER here and the session is written to disk
 * so `scrape-studio-inspiration.ts` can reuse it headlessly.
 *
 * The session is YOUR creator account. The state file holds live cookies —
 * it is gitignored and must stay that way.
 *
 * Usage: node node_modules/tsx/dist/cli.mjs scripts/tiktok-studio-login.ts
 */
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

export const AUTH_STATE_PATH = path.resolve(
  process.cwd(),
  ".tiktok-auth/state.json",
);

const STUDIO_URL = "https://www.tiktok.com/tiktokstudio/inspiration";

async function captureAuth() {
  // Headed on purpose: TikTok's login flow runs bot checks that a headless
  // context reliably fails. Log in like a human, once.
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();

  await page.goto(STUDIO_URL);

  console.log("\n--- TikTok Studio login ---");
  console.log("Log in in the browser window that just opened.");
  console.log("When you can SEE the Inspiration data, press ENTER here.\n");

  await new Promise<void>((resolve) => process.stdin.once("data", () => resolve()));

  // Refuse to save a session that isn't actually signed in — a storageState
  // that authenticates nobody produces a silent empty scrape later.
  const url = page.url();
  if (/\/login|\/signup/.test(url)) {
    console.error(`\nStill on an auth page (${url}). Nothing saved.`);
    await browser.close();
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });
  await context.storageState({ path: AUTH_STATE_PATH });

  const { cookies } = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, "utf8"));
  const hasSession = cookies.some((c: { name: string }) => c.name === "sessionid");
  if (!hasSession) {
    console.error("\nNo `sessionid` cookie in the saved state — login did not stick.");
    await browser.close();
    process.exit(1);
  }

  console.log(`\nSaved ${cookies.length} cookies to ${AUTH_STATE_PATH}`);
  console.log("Sessions go stale — re-run this when the scraper reports expired auth.");
  await browser.close();
}

captureAuth().catch((err) => {
  console.error(err);
  process.exit(1);
});
