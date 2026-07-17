/** P4 live pass 2 retry — connect door @zachking with route logging live. */
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3002";
const OUT = "/Users/davideloreti/virtuna-prod/.planning/sketches/p4-live";

const consoleErrors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

await page.goto(`${BASE}/login`);
await page.locator('input[name="email"]').fill("e2e-test@virtuna.local");
await page.locator('input[name="password"]').fill("e2e-test-password-2026");
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 30000 });
console.log("LOGIN OK");

await page.goto(`${BASE}/audience/new`);
await page.waitForSelector("text=Connect account", { timeout: 20000 });
await page.locator('input[aria-label="Your @handle"]').fill("@zachking");
await page.locator("button", { hasText: /^Continue$/ }).click();
console.log("STARTED", new Date().toISOString());

try {
  await page.waitForURL((u) => /\/audience\/[0-9a-f-]{36}/.test(u.pathname), { timeout: 300000 });
  console.log("DONE →", page.url());
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/04-detail.png`, animations: "disabled", caret: "hide" });
  const detailText = await page.locator("body").innerText();
  console.log("DETAIL SOURCE zone:", /SOURCE/i.test(detailText), "| personas:", /personas/i.test(detailText));
} catch {
  console.log("NO NAVIGATION — final page state:");
  const err = await page.locator('[data-testid="create-error"]').innerText().catch(() => "(no error line)");
  console.log("ERROR LINE:", err);
  await page.screenshot({ path: `${OUT}/04-failed.png`, animations: "disabled", caret: "hide" });
}
console.log("CONSOLE ERRORS:", consoleErrors.length, consoleErrors.slice(0, 5));
await browser.close();
