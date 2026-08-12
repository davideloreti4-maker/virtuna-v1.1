/** #312 merge live proof — a real ideas run must carry BOTH target AND population. */
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3002";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(`${BASE}/login`);
await page.locator('input[name="email"]').fill("e2e-test@virtuna.local");
await page.locator('input[name="password"]').fill("e2e-test-password-2026");
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 30000 });
console.log("LOGIN OK");

await page.goto(`${BASE}/home`);
await page.waitForSelector("textarea, [role=textbox]", { timeout: 20000 });
// Slash-select the ideas skill deterministically, then ask.
const box = page.locator("textarea").first();
await box.click();
await box.pressSequentially("/ideas", { delay: 40 });
await page.waitForTimeout(600);
await page.keyboard.press("Enter"); // pick the slash item
await page.waitForTimeout(400);
await box.pressSequentially("impossible everyday magic with household objects", { delay: 10 });
await page.keyboard.press("Enter");
console.log("SUBMITTED", new Date().toISOString());

// Wait for idea cards to land (real engine run).
await page.waitForSelector('text=/WRITTEN FOR|Idea|angle/i', { timeout: 240000 }).catch(() => {});
await page.waitForTimeout(120000); // let the full stream + persist finish
console.log("CONSOLE ERRORS:", errors.length, errors.slice(0, 3));
await page.screenshot({ path: "/Users/davideloreti/virtuna-prod/.planning/sketches/p4-live/05-312-ideas.png", animations: "disabled" });
await browser.close();
