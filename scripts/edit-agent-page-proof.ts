/**
 * edit-agent-page-proof.ts — part 3 Task 13b's proof: the page where a creator tries the edit agent, `/dev-edit/agent`, walked
 * in a real browser against the real routes, in one command: a dev server of its own bound to 127.0.0.1 (a port from 3000 to
 * 3005, the origins the bucket's CORS lists), the e2e test account signed in, and Playwright's Chromium (`channel: "chromium"`:
 * the Player's looks need WebGL 2) at 1280 × 800 and at 390 × 844, each a walk of its own from a fresh page:
 *   1. the page as it opens (our pick chosen, the button on), and each of the four rows chosen;
 *   2. a first cut in the preset `clean`: working, then the cut with its match row, and a mark opened;
 *   3. the change "Black and white": out, then answered; the Player keeps its frame;
 *   4. the change "Bigger captions": on the test take it mostly changes nothing and says why, shown as a plain reply (when
 *      the agent does find room, the walk says so and goes on);
 *   5. things to check opened, and "Show" moving the Player;
 *   6. undo, back one edit and then to the first cut;
 *   7. download: the bar (only Download gives way while the video is made), the saved link, and the film saved to a file
 *      (`--no-download` leaves it out);
 *   8. start over, asked once; then a first cut from the words "fast with zooms", and one in our pick;
 *   9. with `--reference=<video file>`: a first cut in the style of that video, uploaded and read for real (one to three
 *      minutes; an analysis on the worker, metered on Modal), its wait shown at each stage, and once as a phone shows it;
 *  10. the page at 360 px wide, before and after a cut: nothing wider than the screen.
 * A screenshot of each step goes into the output folder, named `<step>-<width>.png`, and the times of the real calls into
 * `times.json` there. What the walk checks besides (every control off while a call of the agent's is out, Enter sends, the arrow keys move
 * between the rows, no pulse with reduced motion, nothing wider than the screen) is listed at the end; any that failed fails
 * the run after all the screenshots are taken.
 *
 * Usage:  pnpm exec tsx scripts/edit-agent-page-proof.ts [--only=1280|390] [--no-download] [--reference=<video file>
 *         [--reference-only]] [<out-dir>]
 *         (by default both sizes, with the download, no reference, into .scratch/agent-page; `--reference-only` makes the
 *         reference's cut alone, from the page as it opens)
 * It loads `.env.local` itself and prints no value of it, nor an id, nor the take's words. It signs in with E2E_USER_EMAIL and
 * E2E_USER_PASSWORD: the e2e test account's, never the owner's, and uses that account's newest ready take. Each walk makes
 * three first cuts and two changes (Qwen, a few tenths of a cent) and one render (Modal, metered): run it on purpose.
 */
import { chromium, type Browser, type BrowserContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withDevServer } from "./edit-dev-server";

/** The origins the bucket's CORS lists: only from these can the page's Player read the take. */
const PORTS = [3000, 3001, 3002, 3003, 3004, 3005];
const MINUTE = 60_000;
const SIZES = { 1280: { width: 1280, height: 800 }, 390: { width: 390, height: 844 } } as const;
type Width = keyof typeof SIZES;

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
  return (value.match(/.{1,3180}/g) ?? []).map((chunk, i) => ({ name: `sb-${ref}-auth-token.${i}`, value: chunk }));
}

/**
 * Next lets one dev server run in a folder at a time (its lock, `.next/dev/lock`), and other scripts of the edit tool start
 * their own here too. So this waits, up to half an hour, until no process holds the lock (`lsof` exits 1 when none does).
 */
async function devServerFree(): Promise<void> {
  const held = () => {
    try {
      execFileSync("lsof", ["--", ".next/dev/lock"], { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  };
  for (let waited = 0; held(); waited += 5) {
    if (waited === 0) console.log("another dev server is running in this folder; waiting for it to end");
    if (waited >= 30 * 60) throw new Error("another dev server has been running in this folder for half an hour");
    await new Promise((done) => setTimeout(done, 5000));
  }
}

interface Options {
  out: string;
  download: boolean;
  reference: string | null;
  /** Only the reference's cut, from the page as it opens. */
  referenceOnly: boolean;
}

/** What an agent call answered, as the times keep it: never its words. */
interface Called {
  seconds: number;
  rounds: number;
  cents: number;
  changed: boolean;
  findings: number;
  match: string | null;
}

/** One walk of the page at one size. Gives the times of its real calls; what it found wrong goes into `wrong`. */
async function walk(context: BrowserContext, base: string, width: Width, { out, download, reference, referenceOnly }: Options, wrong: string[]): Promise<Record<string, unknown>> {
  const page = await context.newPage();
  const times: Record<string, unknown> = {};
  page.on("pageerror", (error) => wrong.push(`${width}: the page reported ${String(error)}`));
  const check = (ok: boolean, what: string) => {
    console.log(`  ${ok ? "ok  " : "FAIL"} ${what}`);
    if (!ok) wrong.push(`${width}: ${what}`);
  };
  let shots = 0;
  /** A screenshot of what is on the screen, and the check that nothing is wider than it. */
  const shoot = async (name: string) => {
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const file = `${String(++shots).padStart(2, "0")}-${name}-${width}.png`;
    await page.screenshot({ path: join(out, file), animations: "disabled", caret: "hide" });
    const over = await page.evaluate(() => Math.max(document.documentElement.scrollWidth - window.innerWidth, ...[...document.querySelectorAll("main")].map((main) => main.scrollWidth - main.clientWidth)));
    if (over > 0) wrong.push(`${width}: at ${name} the page is ${over} px wider than the screen`);
    console.log(`  screenshot ${file}${over > 0 ? `  <-- ${over} px wider than the screen` : ""}`);
  };
  /** The page has settled: two pictures of the screen in a row are the same (the Player draws its footage after its words). */
  const settled = async () => {
    let before = await page.screenshot({ animations: "disabled", caret: "hide" });
    for (let tries = 0; tries < 40; tries++) {
      await page.waitForTimeout(250);
      const now = await page.screenshot({ animations: "disabled", caret: "hide" });
      if (now.equals(before)) return;
      before = now;
    }
  };
  /** The agent's next call held before it leaves the browser, so that the page can be looked at while it is out. */
  const held = async (): Promise<() => Promise<void>> => {
    let release = () => {};
    const gate = new Promise<void>((open) => (release = open));
    await page.route("**/api/edit/agent", async (route) => {
      await gate;
      await route.continue();
    });
    return async () => {
      release();
      await page.unrouteAll({ behavior: "wait" }); // once the held call has gone on its way
    };
  };
  /** The agent's next answer, read as it passes: its time from `from`, and its facts. */
  const answered = async (from: () => number, within = 4 * MINUTE): Promise<Called> => {
    const response = await page.waitForResponse((one) => one.url().endsWith("/api/edit/agent") && one.request().method() === "POST", { timeout: within });
    const seconds = Math.round((Date.now() - from()) / 100) / 10;
    if (!response.ok()) throw new Error(`the agent's route answered ${response.status()}: ${JSON.stringify(await response.json().catch(() => null))}`);
    const body = (await response.json()) as { rounds: number; cost: number; changed: boolean; findings: unknown[]; match: { fields: { verdict: string }[] } | null };
    const match = body.match ? ["matched", "near", "not"].map((verdict) => `${verdict} ${body.match!.fields.filter((field) => field.verdict === verdict).length}`).join(", ") : null;
    return { seconds, rounds: body.rounds, cents: Math.round(body.cost * 1000) / 1000, changed: body.changed, findings: body.findings.length, match };
  };
  /** The newest answer, with its undo, is on screen and above the field (which sticks to the screen's foot on a phone). */
  const inView = () =>
    page.evaluate(() => {
      const turn = [...document.querySelectorAll("[data-part=thread] li[data-changed]")].at(-1)?.getBoundingClientRect();
      const field = document.querySelector("[data-part=request]")?.getBoundingClientRect();
      const video = document.querySelector("#edit-stage")?.getBoundingClientRect();
      const held = window.innerWidth < 900 && video ? video.bottom : 0; // on a phone the video is held above the thread
      return Boolean(turn && field && turn.bottom <= field.top + 1 && turn.bottom > held && turn.bottom <= window.innerHeight);
    });
  const frame = () => page.evaluate(() => window.__editPlayer?.getCurrentFrame() ?? -1);
  const frames = async () => Number(await page.getAttribute("#edit-stage", "data-frames"));
  const row = (name: string) => page.getByRole("radio", { name: new RegExp(`^${name}`) });
  const make = page.getByRole("button", { name: "Make the first cut" });
  const under = page.locator("[data-part=under-phone]");
  const field = page.getByRole("textbox", { name: "Ask for a change" });
  /** A first cut, from the click to the cut on the page; held first when the working state is to be looked at. */
  const firstCut = async (name: string, look?: () => Promise<void>): Promise<Called> => {
    const release = look ? await held() : null;
    let from = Date.now();
    const answer = answered(() => from);
    await make.click();
    if (look && release) {
      await page.waitForSelector("[data-working]");
      await look();
      from = Date.now();
      await release();
    }
    const called = await answer;
    await page.waitForSelector("main[data-state=cut][data-busy=false]", { timeout: MINUTE });
    await settled();
    times[name] = called;
    console.log(`  ${name}: ${called.seconds} s, ${called.rounds} rounds, ${called.cents} ¢${called.match ? `; ${called.match}` : ""}; ${called.findings} to check`);
    return called;
  };
  const startOver = async (look?: () => Promise<void>) => {
    await under.getByRole("button", { name: "Start over" }).click();
    if (look) await look();
    await under.getByRole("button", { name: "Start over" }).click();
    await page.waitForSelector("main[data-state=picking]");
    await settled();
  };

  /**
   * The page as a creator with one take meets it (the test account has several, so its list is cut to its first in the
   * browser; everything else is the routes' own): no row of takes above the phone.
   */
  const oneTake = async () => {
    const alone = await context.newPage();
    await alone.route("**/api/edit/takes", async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as { takes: { status: string }[] };
      await route.fulfill({ response, json: { takes: body.takes.filter((take) => take.status === "ready").slice(0, 1) } });
    });
    await alone.goto(`${base}/dev-edit/agent`, { waitUntil: "networkidle" });
    await alone.waitForFunction(() => Boolean(window.__editPlayer), undefined, { timeout: MINUTE });
    await alone.waitForTimeout(2500);
    await alone.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const file = `${String(++shots).padStart(2, "0")}-opening-one-take-${width}.png`;
    await alone.screenshot({ path: join(out, file), animations: "disabled", caret: "hide" });
    console.log(`  screenshot ${file}`);
    await alone.close();
  };

  /**
   * A first cut in the style of a video: uploaded from the page as it asks how it should look, read for real, then cut. Each
   * line of the wait is a screenshot as it first shows, the first of the read once more as a phone shows it; what the read's
   * route answers is printed as it changes (its state, stage and share: no id).
   */
  const referenceCut = async (video: string) => {
    await row("Like a video").check({ force: true });
    await page.setInputFiles("input[type=file]", video);
    await shoot("row-video-file");
    const began = Date.now();
    const since = () => Math.round((Date.now() - began) / 100) / 10;
    let last = "";
    page.on("response", (response) => {
      if (!/\/api\/edit\/references\/[^/]+$/.test(response.url()) || response.request().method() !== "GET") return;
      void response.json().then(
        (body: { status?: string; stage?: string; progress?: number; error?: string }) => {
          const line = `${body.status ?? response.status()}${body.stage ? ` (${body.stage}, ${Math.round((body.progress ?? 0) * 100)} %)` : ""}${body.error ? `: ${body.error}` : ""}`;
          if (line !== last) console.log(`    ${since()} s: the read answers ${(last = line)}`);
        },
        () => {},
      );
    });
    const cutting = answered(() => began, 12 * MINUTE).catch((error: unknown) => {
      wrong.push(`${width}: the reference's cut was not answered: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
      return null;
    });
    await make.click();
    const seen: Record<string, number> = {};
    const working = page.locator("[data-working] p").first();
    for (let phoned = false; since() < 10 * 60; await page.waitForTimeout(400)) {
      if ((await page.getAttribute("main", "data-state")) === "cut" || (await page.locator("main [role=alert]").count()) > 0) break;
      const stage = ((await working.textContent({ timeout: 1000 }).catch(() => null)) ?? "").replace("…", "");
      if (stage === "" || stage in seen) continue;
      seen[stage] = since();
      await shoot(`wait-${stage.toLowerCase().replaceAll(" ", "-")}`);
      if (!phoned && stage.startsWith("Reading") && width !== 390) {
        phoned = true; // the same wait as a phone shows it, where the creator pressed the button
        await page.setViewportSize(SIZES[390]);
        await page.locator("[data-working]").scrollIntoViewIfNeeded();
        await shoot("wait-on-a-phone");
        await page.setViewportSize(SIZES[width]);
      }
    }
    const failed = page.locator("main [role=alert]");
    if ((await failed.count()) > 0) {
      wrong.push(`${width}: the reference was not read: the page says "${(await failed.first().textContent())?.replace("Try again", "").trim()}"`);
      await shoot("reference-failed");
      times.reference = { stagesSeenAt: seen, failedAt: since() };
      return;
    }
    const cut = await cutting;
    await page.waitForSelector("main[data-state=cut][data-busy=false]", { timeout: MINUTE });
    await settled();
    times.reference = { stagesSeenAt: seen, toTheCut: since(), cut };
    console.log(`  the reference: lines first seen at ${JSON.stringify(seen)} s; the cut on the page ${since()} s after the click${cut?.match ? `; ${cut.match}` : ""}`);
    await shoot("cut-reference");
    const off = page.locator("[data-part=match] button:not([data-verdict=matched])").first();
    if ((await off.count()) > 0) {
      await off.click();
      await shoot("cut-reference-mark");
    }
  };

  console.log(`\nat ${width} × ${SIZES[width].height}`);

  // 1. The page as it opens, and each of the four rows.
  await page.goto(`${base}/dev-edit/agent`, { waitUntil: "networkidle" });
  await page.waitForSelector("main[data-state=picking]", { timeout: MINUTE });
  await page.waitForFunction(() => Boolean(window.__editPlayer), undefined, { timeout: MINUTE });
  await settled();
  check((await page.getAttribute("main", "data-colour")) === "exact", "the Player draws the looks exactly in this browser");
  check((await row("Our pick").isChecked()) && (await make.isEnabled()), "our pick is chosen as the page opens, and the button is on");
  check(await page.evaluate(() => !document.querySelector("#edit-stage")?.contains(document.activeElement)), "the Player does not take the keyboard's focus as the page opens");
  if (referenceOnly && reference) {
    await referenceCut(reference);
    await page.close();
    return times;
  }
  await shoot("opening");
  await oneTake();

  // The rows are one radio group: Tab reaches it, the arrow keys move between its rows.
  await row("Our pick").focus();
  await page.keyboard.press("ArrowDown");
  check(await row("Like a video").isChecked(), "the arrow keys move between the rows");
  check(await make.isDisabled(), "the button is off while the video's row has neither a link nor a file");
  await shoot("row-video");
  await page.getByRole("textbox", { name: "A TikTok link" }).fill("https://example.com/not-tiktok");
  await page.getByRole("textbox", { name: "A TikTok link" }).blur();
  check(await page.getByText("That is not a link to a TikTok video.").isVisible(), "a link that is not TikTok's is said to be none, and the button stays off");
  await page.getByRole("textbox", { name: "A TikTok link" }).fill("");

  await row("In your words").check({ force: true });
  await page.getByRole("textbox", { name: "The look in your words" }).fill("fast with zooms");
  await shoot("row-words");

  await row("Our pick").check({ force: true });
  check(await make.isEnabled(), "the button is on again for our pick");
  await shoot("row-pick");

  await row("A preset").check({ force: true });
  check(await make.isDisabled(), "the button is off until a preset is chosen");
  await page.getByRole("radio", { name: "Clean" }).check({ force: true });
  await shoot("row-preset");

  // 2. A first cut in the preset `clean`: working, the cut with its match row, a mark opened.
  await firstCut("first cut, preset clean", async () => {
    check(await row("Our pick").isDisabled(), "the rows are off while the cut is made");
    await shoot("working");
  });
  check((await frame()) === 15, "the first cut stands half a second in, where its title and first captions are on");
  // The keyboard's focus follows the work: to the request field, or on a touch screen to the cut's panel (no keyboard over the video).
  const focused = await page.evaluate(() => (document.activeElement?.getAttribute("aria-label") ?? "") + "");
  check(focused === (width === 390 ? "Your cut" : "Ask for a change"), `the cut lands with the keyboard's focus on ${width === 390 ? "its panel (a touch screen)" : "the request field"}`);
  check((await page.locator("[data-part=match] button").count()) === 5, "the match row has its five marks");
  check(await under.getByRole("button", { name: "Undo" }).isDisabled(), "undo is off at the first cut");
  await shoot("cut");
  await page.evaluate(() => window.__editPlayer?.play());
  await page.waitForTimeout(300);
  const playing = await frame();
  await page.evaluate(() => window.__editPlayer?.pause());
  check(playing < 15, `played, the cut starts from its start (at frame ${playing} after 0.3 s)`);
  // The film ends while a request is being typed: the field keeps the keyboard's focus, and every letter typed.
  const typed = "Tighter cuts, please";
  await page.evaluate((to) => window.__editPlayer?.seekTo(to), (await frames()) - 10);
  await field.focus();
  await page.evaluate(() => window.__editPlayer?.play());
  await field.pressSequentially(typed, { delay: 60 }); // 1.2 s of typing over the film's last third of a second
  const ended = await page.evaluate(() => window.__editPlayer?.isPlaying() === false);
  const kept = (await field.evaluate((node) => node === document.activeElement)) && (await field.inputValue()) === typed;
  check(ended && kept, "the film ends while a request is typed: the field keeps the keyboard's focus and every letter");
  await field.fill("");
  await field.blur();
  await page.evaluate(() => window.__editPlayer?.seekTo(15));
  await settled();
  const mark = page.locator("[data-part=match] button:not([data-verdict=matched])").first();
  await ((await mark.count()) > 0 ? mark : page.locator("[data-part=match] button").first()).click();
  await shoot("mark-opened");

  // 3. "Black and white": the request shows at once, everything is off while it is out, the Player keeps its frame.
  const total = await frames();
  const place = Math.min(40, total - 1);
  await page.evaluate((to) => window.__editPlayer?.seekTo(to), place);
  await page.getByRole("button", { name: "Black and white" }).click();
  check((await field.inputValue()) === "Black and white", "a suggestion fills the field");
  const release = await held();
  let from = Date.now();
  const mono = answered(() => from);
  await field.press("Enter");
  await page.waitForSelector("[data-pending]");
  const off = await Promise.all([
    field.isDisabled(), page.getByRole("button", { name: "Send" }).isDisabled(), page.getByRole("button", { name: "Tighter cuts" }).isDisabled(),
    under.getByRole("button", { name: "Start over" }).isDisabled(), under.getByRole("button", { name: "Download" }).isDisabled(),
  ]);
  check(off.every(Boolean), "Enter sends, and every control is off while the change is out");
  const pulse = () => page.locator("[data-pending] [role=status]").evaluate((node) => getComputedStyle(node).animationName);
  const moving = await pulse();
  await page.emulateMedia({ reducedMotion: "reduce" });
  check(moving !== "none" && (await pulse()) === "none", "the answer's place pulses, and not with reduced motion");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await shoot("change-out");
  from = Date.now();
  await release();
  times["change, black and white"] = await mono;
  await page.waitForSelector("main[data-busy=false]", { timeout: MINUTE });
  await settled();
  const after = await frames();
  check((await frame()) === (place < after ? place : 0), `the Player kept its place (frame ${place} of ${after})`);
  check((await page.locator("[data-part=thread] li[data-changed=true]").count()) === 1, "the answer is under its request, with its own undo");
  check(await inView(), "the answer is on screen whole, clear of the field");
  await shoot("answer");

  // 4. "Bigger captions": on this take nothing changes and the reply says why: a plain reply, not an error.
  from = Date.now();
  const bigger = answered(() => from);
  await field.fill("Bigger captions");
  await page.getByRole("button", { name: "Send" }).click();
  const called = await bigger;
  times["change, bigger captions"] = called;
  await page.waitForSelector("main[data-busy=false]", { timeout: MINUTE });
  await settled();
  if (!called.changed) {
    const reply = page.locator("[data-part=thread] li[data-changed=false]");
    check((await reply.count()) === 1 && (await reply.getByRole("button", { name: "Undo" }).count()) === 0 && (await page.locator("main [role=alert]").count()) === 0, "a change that changed nothing is a plain reply: no undo of its own, no alert");
  } else console.log("  note: this time \"Bigger captions\" changed the edit");
  check(await inView(), "and it is on screen whole, clear of the field");
  await shoot(called.changed ? "answer-second" : "answer-unchanged");

  // 5. Things to check, opened; "Show" moves the Player to the finding's frame.
  const things = page.locator("[data-part=findings]");
  if ((await things.count()) > 0) {
    await things.getByRole("button", { name: /to check$/ }).click();
    await things.scrollIntoViewIfNeeded();
    await shoot("things-to-check");
    await page.evaluate(() => window.__editPlayer?.seekTo(60));
    await things.getByRole("button", { name: "Show" }).first().click();
    await page.waitForTimeout(300);
    check((await frame()) !== 60, `"Show" moves the Player (to frame ${await frame()})`);
    await things.getByRole("button", { name: /to check$/ }).click();
  } else console.log("  note: this edit has nothing to check");
  // The dev's facts: closed until asked for.
  const facts = page.locator("[data-part=details]");
  await facts.getByRole("button", { name: "Details" }).click();
  await facts.scrollIntoViewIfNeeded();
  check(await facts.getByText(/^The last call: \d+ rounds?, [\d.]+ s, [\d.]+ ¢\.$/).isVisible(), "the details give the last call's rounds, seconds and cost in cents");
  await shoot("details");
  await facts.getByRole("button", { name: "Details" }).click();

  // 6. Undo: back one edit, then to the first cut, where it is off again.
  const changes = () => page.locator("[data-part=thread] li[data-changed=true]").count();
  const undo = under.getByRole("button", { name: "Undo" });
  const made = await changes();
  await undo.click();
  await settled();
  check((await changes()) === made - 1, `undo goes back one edit (${made} changes, then ${made - 1})`);
  while ((await changes()) > 0) await undo.click();
  await settled();
  check((await page.locator("[data-part=thread] li[data-changed]").count()) === 0 && (await undo.isDisabled()), "at the first cut nothing is left of the thread, and undo is off");
  await shoot("undo");

  // 7. Download: the bar, the saved link, the film saved.
  if (download) {
    const started = Date.now();
    await under.getByRole("button", { name: "Download" }).click();
    await page.waitForFunction(() => Number(document.querySelector("[data-part=under-phone] [role=progressbar]")?.getAttribute("data-share")) >= 0.2, undefined, { timeout: 10 * MINUTE });
    check((await field.isEnabled()) && (await under.getByRole("button", { name: "Start over" }).isEnabled()) && (await under.getByRole("button", { name: "Download" }).count()) === 0, "while the video is made only Download gives way: the field and Start over stay on");
    await shoot("download-bar");
    const save = under.getByRole("link", { name: "Save video" });
    await save.waitFor({ timeout: 15 * MINUTE });
    times.render = Math.round((Date.now() - started) / 100) / 10;
    await shoot("saved");
    const [saved] = await Promise.all([page.waitForEvent("download"), save.click()]);
    const film = join(out, `film-${width}.mp4`);
    await saved.saveAs(film);
    console.log(`  rendered in ${times.render} s; saved ${(statSync(film).size / 1e6).toFixed(1)} MB to ${film}`);
  }

  // 8. Start over, asked once; then the words, then our pick.
  await startOver(() => shoot("start-over-asked"));
  check((await frame()) === 0, "after starting over the take is at its start");
  await row("In your words").check({ force: true });
  await page.getByRole("textbox", { name: "The look in your words" }).fill("fast with zooms");
  await firstCut("first cut, words");
  await shoot("cut-words");
  await startOver();
  await row("Our pick").check({ force: true });
  await firstCut("first cut, our pick");
  check((await page.locator("[data-part=match]").count()) === 0, "our pick has no match row");
  await shoot("cut-pick");

  // 9. A first cut in the style of a video, uploaded and read for real.
  if (reference) {
    await startOver();
    await referenceCut(reference);
  }

  // The worker's page, whose helpers this page now shares, still opens as it did.
  if (width === 1280) {
    const worker = await context.newPage();
    const errors: string[] = [];
    worker.on("pageerror", (error) => errors.push(String(error)));
    await worker.goto(`${base}/dev-edit/worker`, { waitUntil: "networkidle" });
    check((await worker.getByRole("heading", { name: "The edit worker" }).count()) === 1 && (await worker.locator("#take-file").count()) === 1 && errors.length === 0, "the worker's page still opens, with its file field and no error");
    await worker.close();
  }

  // 10. Nothing wider than the screen at 360 px, after a cut and before one.
  if (width === 390) {
    await page.setViewportSize({ width: 360, height: 780 });
    await settled();
    await shoot("cut-at-360");
    await startOver();
    await row("A preset").check({ force: true });
    await shoot("picking-at-360");
  }
  await page.close();
  return times;
}

async function proof(browser: Browser, base: string, widths: Width[], options: Options): Promise<void> {
  const cookies = (await sessionCookies()).map((cookie) => ({ ...cookie, url: base }));
  const wrong: string[] = [];
  const times: Record<string, unknown> = {};
  for (const width of widths) {
    const context = await browser.newContext({ viewport: SIZES[width], deviceScaleFactor: 2, locale: "en-US", acceptDownloads: true, ...(width === 390 ? { isMobile: true, hasTouch: true } : {}) });
    await context.addCookies(cookies);
    try {
      times[width] = await walk(context, base, width, options, wrong);
    } catch (error) {
      wrong.push(`${width}: the walk stopped: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await context.close();
    }
  }
  writeFileSync(join(options.out, "times.json"), `${JSON.stringify(times, null, 2)}\n`);
  if (wrong.length > 0) throw new Error(`the page's proof found:\n  ${wrong.join("\n  ")}`);
  console.log(`\nthe page proved at ${widths.join(" and ")}: the screenshots and times.json are in ${options.out}`);
}

async function main(): Promise<void> {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local"); // in-process; what is already set stays as it is
  const flags = process.argv.slice(2).filter((arg) => arg.startsWith("--"));
  const [out = ".scratch/agent-page"] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const flag = (name: string) => flags.find((one) => one === `--${name}` || one.startsWith(`--${name}=`))?.split("=")[1];
  const only = flag("only");
  const widths = only ? [Number(only) as Width] : ([1280, 390] as Width[]);
  if (!widths.every((width) => width in SIZES)) throw new Error("--only is 1280 or 390");
  const reference = flag("reference") ?? null;
  if (reference && !existsSync(reference)) throw new Error(`no video at ${reference}`);
  mkdirSync(out, { recursive: true });
  await devServerFree();
  await withDevServer(async (base) => {
    const browser = await chromium.launch({ channel: "chromium", args: ["--lang=en-US"] });
    try {
      await proof(browser, base, widths, { out, download: !flags.includes("--no-download"), reference, referenceOnly: flags.includes("--reference-only") });
    } finally {
      await browser.close();
    }
  }, { port: freePort(), name: "localhost" });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
