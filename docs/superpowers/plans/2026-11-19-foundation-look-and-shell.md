# Foundation: New Look and App Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the accepted new look (light default, dark, Inter only, ink buttons) and the new app shell (phone tab bar, desktop sidebar) into the Maven app behind one flag, with production unchanged while the flag is off.

**Architecture:** The existing semantic token names get new values inside `:root[data-look="next"]` (and `…[data-theme="dark"]`) in `globals.css`; `@theme` only gains new names. The root layout sets the attributes when `NEXT_PUBLIC_NEW_LOOK=true`. A new shell (`src/components/shell/`) replaces the legacy `Sidebar` under the flag; `app-shell.tsx` picks one. Shared primitives are restyled in place with a `next:` Tailwind variant.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict, `noUncheckedIndexedAccess`), Tailwind v4, zustand, Radix, Phosphor icons, Vitest + Testing Library (happy-dom), raw Playwright for browser checks.

**Spec:** `docs/superpowers/specs/2026-11-18-foundation-look-and-shell-design.md` (approved 2026-11-18). Mock reference renders live in the trunk checkout, not in git: `~/virtuna-v1.1/.scratch/app-screens/renders/a-light-phone-lib-ma.png`, `a-light-desk-lib.png`, `a-dark-phone-lib-ma.png`, `a-dark-desk-lib.png`.

## Global Constraints

- Work only in the worktree `~/virtuna-next-look` on branch `design/next-look`. Never edit `~/virtuna-v1.1` (trunk).
- Flag: `NEXT_PUBLIC_NEW_LOOK=true`, env-only, off by default. **Flag off must render exactly as today.**
- No existing value inside `@theme` changes. `@theme` gains only new names.
- `src/components/sidebar/Sidebar.tsx` is not edited.
- No new dependencies. Package manager is pnpm (`pnpm install --frozen-lockfile`), although the repo CLAUDE.md says npm.
- Tests: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run <path>` (Node 25's built-in `localStorage` breaks happy-dom without the option).
- Type check: `pnpm exec tsc --noEmit`.
- Never read, print or copy `.env*` files. The owner copies `.env.local` (Task 0).
- Commits: `git -c core.hooksPath=/dev/null commit …`. The repo's post-commit hook pushes every commit; the owner's rule is "pushes only when asked". Push only when the owner says so. End each commit message with the attribution lines your session was given.
- In new-look code use `shadow-[var(--shadow-…)]`, never `shadow-float` / `shadow-button` / `shadow-rest`: Tailwind copies a shadow token's value into its utility at build time, so the utility ignores the scoped re-valuation (checked in the compiled CSS).
- `backdrop-filter` only as an inline style (Lightning CSS strips it from classes), and in the shell only in `tab-bar.tsx`.
- No colour literals (hex, `rgb()`, `rgba()`) in `src/components/shell/`. Tokens only.
- Type sizes come from role tokens (`text-micro`, `text-label`, `text-meta`, `text-reading`, `text-ui`, `text-title`, `text-heading`, `text-3xl`). No `text-[Npx]`.
- Weights: `font-[430]` text, `font-[560]` label, `font-[640]` title, `font-bold` (700) numbers and screen titles. Do not add `--font-*` tokens (in Tailwind v4 that namespace is font-family).
- Radii come from the token scale (`rounded-lg` 12, `rounded-xl` 16, `rounded-2xl` 20, `rounded-3xl` 24, `rounded-4xl` 32, `rounded-full`).
- Copy: short and plain. No uppercase labels. The action is called "New chat".
- Write `next:` first in a class (`next:hover:bg-active`, never `hover:next:bg-active`); the parity test strips classes by that prefix.
- CSS custom-property declarations stay on one line each (the token tests parse line by line).
- Class names must not collide: every new CSS class in `globals.css` is prefixed `tabbar-`.
- Do not patch legacy screens to look right inside the flag. Each is replaced by its own later part.

## Where this plan departs from the spec (owner: read these)

| # | Spec says | Plan does | Why |
|---|---|---|---|
| 1 | Scope selector `[data-look="next"]` | `:root[data-look="next"]` | `globals.css` has later `:root { … }` rules (`--focus-ring`, the `prefers-contrast` block) with the same specificity; a later rule would win and put cream focus rings and white hairlines on the light look. |
| 2 | Dark `--shadow-button: none` | `0 0 0 0 transparent` | Tailwind puts the value in a shadow list; `none` inside a list makes the whole `box-shadow` invalid and would also remove focus rings. |
| 3 | Discover route `/discover` | `/feed` | `/discover` only redirects into the hub at `/feed`; the legacy sidebar already links `/feed`. |
| 4 | "Maven" in the sidebar at 17px | 16px (`text-title`) | 17 is not on the type scale and the guard bans literals. |
| 5 | Footer shows "credits as a tag" | The existing balance from `/api/subscription` as "N left"; no tag when unlimited or unknown | The app has no credits unit yet (it meters "Readings"). Nothing is invented. |
| 6 | Pushed header "provided as a component" | The shell also shows it on phone on every screen without the tab bar | Without the drawer a phone user would be stuck on Settings or in a thread. Back from a thread returns to the blank Home. |
| 7 | Button height 50 / 56 | `lg` becomes 50 under the flag, new size `xl` is 56; `sm` and `md` keep their height | Legacy screens inside the flag do not reflow. |
| 8 | Base parts restyled with the `next:` variant | `Card` reads the flag instead | Its legacy surface is an inline style, which no class can override. |
| 9 | Flag off: screenshots identical to `main` | Token values, `<html>` attributes and landmarks must be identical; chrome screenshots are hashed and looked at | Page content is generated per load, so whole-page pixel identity cannot hold even on `main` itself. |
| 10 | Marketing, landing, onboarding "untouched" | They are not edited, but they do receive the new tokens while the flag is on | The attribute sits on `<html>` in the root layout, as the spec's mechanics require (portals render into `<body>`). |
| 11 | Phone: the reserved top band (`--mobile-nav-band`) is removed | The 46px band stays on `<main>`; the Back header sits in it | Legacy Home cancels that band with a negative margin (`composer.tsx`); removing it would push the thread off screen. It goes when Home is rebuilt (part 3). |
| 12 | Content frame: a 980 column, 720 for threads | Not built in this part | No page uses it until that page is rebuilt; `PlaceHeader` carries the 44px title offset. |
| 13 | Navigation icons from Phosphor | The reference's own six glyphs (`src/components/shell/icons.tsx`) | Owner, mid-run: built UI must align with the reference. The reference draws its own icons; Phosphor's Home and Audience look visibly different. |
| 14 | One place order for both layouts | Phone: Home, Discover, Library, Audience. Desktop sidebar: Home, Discover, Audience, Library | That is what the reference shows; on desktop Library sits next to the threads it holds. |

## Changes made during execution (2026-11-19)

The owner added one instruction mid-run: **always check the visual alignment of built UI with the reference.** From Task 5 on, every part with visible UI is rendered in the running app and compared with the v11 reference (side-by-side image and measured geometry, light and dark) before it counts as done. Where that or a code review changed what a task's code block below says, the commits are the truth:

- Task 1: the 27 themed tokens are one shared list (`NEXT_LOOK_THEMED` in `next-look-css.ts`), not two.
- Task 3: the press eases on the CSS `scale` property (Tailwind v4's `scale-*` does not write `transform`); disabled Chip and IconButton drop their shadow; IconButton sizes its icon to 18.
- Task 5: the tab bar is laid out exactly as the reference (items 66 / 66 / 50 / 66 / 66, space-around, 21px label line); the round button's touch target is 64 through a hit-area extension; icons are the reference's own (departure 13).
- Task 6: desktop place order, the compose glyph on New chat, "Recent" in the muted tone and 2px between thread rows follow the reference (departure 14 and the table in Task 6).
- Task 7: the pushed header follows the reference's Account and thread screens: white round Back button with the reference's chevron, and a round new-chat button on the right of every pushed screen (the first draft had a plain Back only).
- Owner question mid-run (2026-11-19): where do new pages such as Earn go once the phone bar is full? The reference already answers it: the avatar on Home opens Account, and Account lists Earn, the connected accounts and Appearance; Earn is a pushed page. The bar stays at four places plus new chat. Nothing in this part changes for it; the avatar and the Account page belong to parts 3 and 6. His ruling on a Stanley-style referral block on the Earn page is open.

Known and accepted inside the flag until later parts: on phone Home the legacy message field sits above the tab bar (Home is part 3); legacy thread cards use the tint fill; Settings is reached from the desktop account menu or by URL.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `scripts/next-look-probe.cjs` | Record tokens, `<html>` attributes, landmarks and screenshots per route and viewport | 0 |
| `scripts/next-look-compare.cjs` | Compare two probe folders | 0 |
| `src/app/globals.css` | Variants, new token names, scoped light and dark blocks, contrast and focus rules, `.tabbar-fade` | 1, 5 |
| `src/lib/utils.ts` | Register the new type roles with tailwind-merge | 1 |
| `src/app/__tests__/next-look-css.ts` | Test helper: parse the scoped blocks | 1 |
| `src/app/__tests__/next-look-contrast.test.ts` | Contrast, cycles, completeness | 1 |
| `src/app/__tests__/design-token-drift.test.ts` | Extended: docs rows match the scoped blocks | 1 |
| `docs/DESIGN-SYSTEM.md`, `CLAUDE.md` | The new section and the in-progress note | 1 |
| `src/lib/flags/new-look.ts` | The flag | 2 |
| `src/lib/theme/theme.ts` | Theme choice: resolve, read, paint, persist, head script | 2 |
| `src/lib/theme/use-theme.ts` | React hooks over it | 2 |
| `src/app/layout.tsx` | Attributes and head script when the flag is on | 2 |
| `src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `sheet.tsx` | Restyled in place | 3 |
| `src/components/ui/chip.tsx`, `icon-button.tsx` | New base parts | 3 |
| `src/components/shell/nav-config.ts` | The place list and the navigation rules (pure) | 4 |
| `src/stores/shell-store.ts` | "A thread is open" signal | 4 |
| `src/components/shell/use-thread-actions.ts` | New chat, open, delete | 4 |
| `src/components/shell/use-shell-shortcuts.ts` | ⌘N, ⌘\ | 4 |
| `src/components/app/home/home-page-layout.tsx` | Publishes the signal | 4 |
| `src/components/shell/tab-bar.tsx` | Phone navigation | 5 |
| `src/components/shell/thread-row.tsx`, `side-nav.tsx` | Desktop navigation | 6 |
| `src/components/shell/place-header.tsx`, `pushed-header.tsx` | The two headers | 7 |
| `src/components/app/use-command-items.tsx` | ⌘K items, moved out of `app-shell.tsx` | 7 |
| `src/components/shell/next-shell.tsx` | The frame | 7 |
| `src/components/app/app-shell.tsx` | Picks legacy or next | 7 |
| `src/components/app/settings/appearance-setting.tsx`, `settings-page.tsx` | Light / Dark / Match system | 8 |
| `scripts/next-look-thread-check.cjs` | Browser check: the bar hides in a thread | 9 |

---

### Task 0: Workspace and baseline

Nothing here changes app code. It makes the worktree runnable and records what "as today" means, so Task 9 can prove the flag-off app did not change.

**Files:**
- Create: `scripts/next-look-probe.cjs`
- Create: `scripts/next-look-compare.cjs`
- Output (gitignored): `.scratch/next-look/baseline/`

**Interfaces:**
- Produces: `node scripts/next-look-probe.cjs --base <url> --cookies <file> --out <dir> [--theme light|dark|system] [--contrast more] [--reduced-transparency] [--chrome-width <px>]` and `node scripts/next-look-compare.cjs <baselineDir> <candidateDir>` (exit 0 = same).

- [ ] **Step 1: Check the worktree and the disk**

```bash
cd ~/virtuna-next-look
git rev-parse --abbrev-ref HEAD      # expect: design/next-look
git rev-list --count HEAD..main      # expect: 0   (otherwise: git merge --ff-only main)
git status --short                   # expect: only docs/superpowers/{specs,plans} files as untracked
df -h / | tail -1                    # the Avail column must be 3Gi or more
```

If less than 3 GB is free, stop and ask the owner. Do not delete anything yourself.

- [ ] **Step 2: Install dependencies**

```bash
cd ~/virtuna-next-look && pnpm install --frozen-lockfile
```

Expected: ends with "Done". `git status --short` shows no change to `pnpm-lock.yaml`.

- [ ] **Step 3: Ask the owner for the env file**

The dev server needs `.env.local`; agents may not read or copy it. Ask the owner to run this, exactly as written, at the left margin:

```
! cp ~/virtuna-v1.1/.env.local ~/virtuna-next-look/.env.local
```

Then check it exists without reading it: `test -f ~/virtuna-next-look/.env.local && echo present`. Expected: `present`. Steps 4 and 5 do not need it; Step 8 does.

- [ ] **Step 4: Commit the spec and this plan**

```bash
cd ~/virtuna-next-look
git add docs/superpowers/specs/2026-11-18-foundation-look-and-shell-design.md docs/superpowers/plans/2026-11-19-foundation-look-and-shell.md
git -c core.hooksPath=/dev/null commit -m "docs(next-look): foundation spec and plan"
```

- [ ] **Step 5: Record the test and type-check baseline**

```bash
cd ~/virtuna-next-look && mkdir -p .scratch/next-look/baseline
NODE_OPTIONS=--no-experimental-webstorage pnpm test > .scratch/next-look/baseline/vitest.txt 2>&1; tail -8 .scratch/next-look/baseline/vitest.txt
pnpm exec tsc --noEmit > .scratch/next-look/baseline/tsc.txt 2>&1; wc -l < .scratch/next-look/baseline/tsc.txt
```

Write down the "Test Files … failed | … passed" line and the tsc line count. These are the numbers "all existing tests pass" is judged against in every later task. Failures that exist here are not yours to fix; report them.

- [ ] **Step 6: Write the probe**

Create `scripts/next-look-probe.cjs`:

```js
#!/usr/bin/env node
/* Next-look probe. For each route and viewport it records <html>'s attributes, the computed value
 * of every custom property declared in globals.css, which shell landmarks are visible, and
 * screenshots. Used to prove the flag-off app is unchanged and to look at the flag-on app.
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
    }
    await context.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 7: Write the comparer**

Create `scripts/next-look-compare.cjs`:

```js
#!/usr/bin/env node
/* node scripts/next-look-compare.cjs <baselineDir> <candidateDir>
 *
 * Exit 0 when every probed page has the same URL, <html> attributes, landmarks, body background
 * and token values as the baseline. Only tokens the BASELINE recorded are compared, so names added
 * later do not count. Chrome screenshots are compared by hash and reported: a mismatch there is a
 * prompt to open both images (thread titles in the sidebar can change), not a failure. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error("usage: next-look-compare.cjs <baselineDir> <candidateDir>");
  process.exit(2);
}

const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 12);
let failed = false;

for (const file of fs.readdirSync(a).filter((f) => f.endsWith(".json")).sort()) {
  const other = path.join(b, file);
  if (!fs.existsSync(other)) {
    console.log(`FAIL ${file}: missing in ${b}`);
    failed = true;
    continue;
  }
  const A = JSON.parse(fs.readFileSync(path.join(a, file), "utf8"));
  const B = JSON.parse(fs.readFileSync(other, "utf8"));
  const diffs = [];
  for (const key of ["url", "bodyBackground", "bodyWeight"]) {
    if (A[key] !== B[key]) diffs.push(`${key}: ${A[key]} -> ${B[key]}`);
  }
  for (const group of ["html", "landmarks", "tokens"]) {
    for (const k of Object.keys(A[group])) {
      if (A[group][k] !== B[group][k]) {
        diffs.push(`${group}.${k}: ${JSON.stringify(A[group][k])} -> ${JSON.stringify(B[group][k])}`);
      }
    }
  }
  if (diffs.length) {
    failed = true;
    console.log(`FAIL ${file}\n  ${diffs.slice(0, 20).join("\n  ")}${diffs.length > 20 ? `\n  … ${diffs.length - 20} more` : ""}`);
  } else {
    console.log(`ok   ${file} (${Object.keys(A.tokens).length} tokens)`);
  }
}

for (const file of fs.readdirSync(a).filter((f) => /-(chrome|bottom)\.png$/.test(f)).sort()) {
  const other = path.join(b, file);
  if (!fs.existsSync(other)) continue;
  const same = sha(path.join(a, file)) === sha(other);
  console.log(`${same ? "same" : "LOOK"} ${file}`);
}

process.exit(failed ? 1 : 0);
```

- [ ] **Step 8: Record the visual baseline (needs `.env.local` from Step 3)**

Start the dev server with the flag off, in the background:

```bash
cd ~/virtuna-next-look && lsof -ti:3021 || (NODE_OPTIONS='--max-old-space-size=2048 --no-experimental-webstorage' node node_modules/next/dist/bin/next dev --turbopack --port 3021 > .scratch/next-look/dev.log 2>&1 &)
```

Mint a session cookie with the trunk's helper (it loads the trunk's env itself; nothing is printed):

```bash
cd ~/virtuna-v1.1 && scripts/run-with-env.sh node_modules/.bin/tsx .scratch/platform-concept-probes/zz-mint-cookie.ts ~/virtuna-next-look/.scratch/next-look/cookie.json
```

Expected: `wrote 1 cookie chunk(s) to …` (or 2). The cookie lasts about an hour; mint again when a probe lands on `/login`.

Probe twice, so the baseline is checked against itself:

```bash
cd ~/virtuna-next-look
node scripts/next-look-probe.cjs --base http://localhost:3021 --cookies .scratch/next-look/cookie.json --out .scratch/next-look/baseline
node scripts/next-look-probe.cjs --base http://localhost:3021 --cookies .scratch/next-look/cookie.json --out .scratch/next-look/baseline-again
node scripts/next-look-compare.cjs .scratch/next-look/baseline .scratch/next-look/baseline-again
```

Expected: six `ok` lines (three routes, two viewports), each line of the probe showing `"look":null`, `"burger":true` on phone and `"appNav":true` on desktop, body background `rgb(31, 31, 30)`, `weight 400`. Exit code 0. If a `url` is `/login`, the cookie did not take: mint again.

Stop the server: `kill $(lsof -ti:3021)`.

- [ ] **Step 9: Commit**

```bash
cd ~/virtuna-next-look
git add scripts/next-look-probe.cjs scripts/next-look-compare.cjs
git -c core.hooksPath=/dev/null commit -m "chore(next-look): probe and compare scripts for the flag-off baseline"
```

---

### Task 1: Tokens

**Files:**
- Create: `src/app/__tests__/next-look-css.ts`
- Create: `src/app/__tests__/next-look-contrast.test.ts`
- Modify: `src/app/__tests__/design-token-drift.test.ts` (append one `describe`, add one import)
- Modify: `src/app/globals.css` (line 4; inside `@theme` before its closing brace at line 353; after the `:root` alias block that ends at line 369; after the focus rules that end at line 866)
- Modify: `src/lib/utils.ts:26-42` (`TYPE_ROLES`)
- Modify: `docs/DESIGN-SYSTEM.md` (append a section at the end)
- Modify: `CLAUDE.md` (a note under "Design system")

**Interfaces:**
- Produces (CSS): variants `next:` and `dark:`; utilities `bg-track`, `text-above`, `bg-above-soft`, `text-below`, `text-below-text`, `bg-below-soft`, `bg-glass`, `bg-scrim`, `text-ui`, `text-meta`, `text-figure`, `text-figure-lg`, `rounded-4xl`; custom properties `--shadow-rest|lift|press|float|button|sheet` re-valued under the scope.
- Produces (test helper): `LIGHT`, `DARK`, `CSS`, `DOC`, `ruleBlock(css, selector): Map<string,string>`, `lookTokens(theme: 'light'|'dark'): Map<string,string>`, `resolveToken(name, tokens): string`, `references(value): string[]`.

- [ ] **Step 1: Write the test helper**

Create `src/app/__tests__/next-look-css.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Shared by the next-look token tests. Not a test file itself.

const ROOT = join(__dirname, '..', '..', '..');
export const CSS = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');
export const DOC = readFileSync(join(ROOT, 'docs/DESIGN-SYSTEM.md'), 'utf8');

export const LIGHT = ':root[data-look="next"]';
export const DARK = ':root[data-look="next"][data-theme="dark"]';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The `--token: value;` declarations (one per line) of the first TOP-LEVEL rule written
 * exactly as `selector {` at the start of a line. Rules nested in an @media are indented,
 * so they are not picked up.
 */
export function ruleBlock(css: string, selector: string): Map<string, string> {
  const open = new RegExp(`^${escapeRe(selector)} \\{$`, 'm').exec(css);
  if (!open) throw new Error(`no top-level rule "${selector} {" in globals.css`);
  const start = open.index + open[0].length;
  const end = css.indexOf('\n}', start);
  if (end === -1) throw new Error(`rule "${selector}" is never closed`);
  const out = new Map<string, string>();
  for (const line of css.slice(start, end).split('\n')) {
    const m = /^\s*(--[\w-]+)\s*:\s*([^;]+);/.exec(line);
    if (m?.[1] && m[2]) out.set(m[1], m[2].trim());
  }
  return out;
}

/** What <html> resolves under the new look: @theme, then the light block, then the dark block. */
export function lookTokens(theme: 'light' | 'dark'): Map<string, string> {
  const merged = new Map(ruleBlock(CSS, '@theme'));
  for (const [k, v] of ruleBlock(CSS, LIGHT)) merged.set(k, v);
  if (theme === 'dark') for (const [k, v] of ruleBlock(CSS, DARK)) merged.set(k, v);
  return merged;
}

/** Follow whole-value `var(--x)` aliases to a literal. Throws on a cycle. */
export function resolveToken(name: string, tokens: Map<string, string>, seen: string[] = []): string {
  if (seen.includes(name)) throw new Error(`circular var() chain: ${[...seen, name].join(' -> ')}`);
  const raw = tokens.get(name);
  if (raw === undefined) throw new Error(`${name} is not declared`);
  const alias = /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw)?.[1];
  return alias ? resolveToken(alias, tokens, [...seen, name]) : raw;
}

/** Every custom property a value mentions through var(), whole-value or embedded. */
export function references(value: string): string[] {
  return [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]!);
}
```

- [ ] **Step 2: Write the failing contrast and completeness test**

Create `src/app/__tests__/next-look-contrast.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';
import { CSS, DARK, LIGHT, lookTokens, references, resolveToken, ruleBlock } from './next-look-css';

// ─────────────────────────────────────────────────────────────────────────────
// Next look (behind NEXT_PUBLIC_NEW_LOOK): the colours are judged from the CSS,
// not from the table in the spec. A value changed in globals.css that drops a
// pair under the WCAG floor fails here, in both themes.
//
// PURE FS test (default `node` env).
// ─────────────────────────────────────────────────────────────────────────────

type RGBA = [number, number, number, number];

function parseColor(value: string): RGBA {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{6})$/.exec(v)?.[1];
  if (hex) {
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 1];
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(v)?.[1];
  if (fn) {
    const p = fn.split(',').map((s) => Number(s.trim()));
    if (p.length >= 3 && p.every(Number.isFinite)) return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
  }
  throw new Error(`cannot parse colour "${value}"`);
}

function over(fg: RGBA, bg: RGBA): RGBA {
  const a = fg[3];
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
}

function luminance(c: RGBA): number {
  const f = (x: number) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

/** WCAG contrast of `fg` painted over `layers`: first layer on top, last at the bottom. */
function contrast(fg: string, layers: string[]): number {
  const ground = layers
    .map(parseColor)
    .reduceRight<RGBA>((below, layer) => over(layer, below), [255, 255, 255, 1]);
  const ink = over(parseColor(fg), ground);
  const a = luminance(ink);
  const b = luminance(ground);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** [what it is, foreground token, layers from top to bottom] */
type Pair = [string, string, string[]];

const TEXT: Pair[] = [
  ['text on the ground', '--color-foreground', ['--color-background']],
  ['text on a card', '--color-foreground', ['--color-surface']],
  ['secondary text on the ground', '--color-foreground-secondary', ['--color-background']],
  ['secondary text on a card', '--color-foreground-secondary', ['--color-surface']],
  ['secondary text on a tinted control on a card', '--color-foreground-secondary', ['--color-surface-sunken', '--color-surface']],
  ['secondary text on a tinted control on the ground', '--color-foreground-secondary', ['--color-surface-sunken', '--color-background']],
  ['secondary text on the glass bar over the ground', '--color-foreground-secondary', ['--color-glass', '--color-background']],
  ['"above" as text on a card', '--color-above', ['--color-surface']],
  ['"above" on its pill', '--color-above', ['--color-above-soft', '--color-surface']],
  ['"below" text on a card', '--color-below-text', ['--color-surface']],
  ['"below" text on its pill', '--color-below-text', ['--color-below-soft', '--color-surface']],
  ['text on the primary button', '--color-action-foreground', ['--color-action']],
];

const GRAPHIC: Pair[] = [
  ['"below" as a graphic on a card', '--color-below', ['--color-surface']],
  ['"above" as a graphic on a card', '--color-above', ['--color-surface']],
  ['muted on a card', '--color-foreground-muted', ['--color-surface']],
  ['muted on the ground', '--color-foreground-muted', ['--color-background']],
];

/** Tokens the dark block must re-declare, or dark would inherit a light value. */
const THEMED = [
  '--color-background', '--color-surface', '--color-surface-elevated', '--color-surface-sunken',
  '--color-border', '--color-border-hover',
  '--color-foreground', '--color-foreground-secondary', '--color-foreground-muted',
  '--color-action', '--color-action-foreground', '--color-hover', '--color-active',
  '--color-track', '--color-above', '--color-above-soft',
  '--color-below', '--color-below-text', '--color-below-soft',
  '--color-glass', '--color-scrim',
  '--shadow-rest', '--shadow-lift', '--shadow-press', '--shadow-float', '--shadow-button', '--shadow-sheet',
] as const;

/** Names @theme must know, so Tailwind generates their utilities. */
const NEW_NAMES = [
  '--color-track', '--color-above', '--color-above-soft', '--color-below', '--color-below-text',
  '--color-below-soft', '--color-glass', '--color-scrim',
  '--text-ui', '--text-meta', '--text-figure', '--text-figure-lg',
  '--radius-4xl', '--shadow-sheet',
] as const;

describe.each(['light', 'dark'] as const)('next look, %s theme: contrast computed from globals.css', (theme) => {
  const tokens = lookTokens(theme);
  const value = (name: string) => resolveToken(name, tokens);

  it.each(TEXT)('%s reads at 4.5:1 or better', (_label, fg, layers) => {
    expect(contrast(value(fg), layers.map(value))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GRAPHIC)('%s reads at 3:1 or better', (_label, fg, layers) => {
    expect(contrast(value(fg), layers.map(value))).toBeGreaterThanOrEqual(3);
  });

  it('has no circular var() chain (a cycle makes the property invalid, silently)', () => {
    const visit = (name: string, trail: string[]): void => {
      if (trail.includes(name)) throw new Error(`cycle: ${[...trail, name].join(' -> ')}`);
      const raw = tokens.get(name);
      if (raw === undefined) return; // set outside globals.css (--font-inter, --tw-*, …)
      for (const ref of references(raw)) visit(ref, [...trail, name]);
    };
    expect(() => { for (const name of tokens.keys()) visit(name, []); }).not.toThrow();
  });
});

describe('next look: the blocks are complete', () => {
  it.each(THEMED)('%s is declared for light and re-declared for dark', (token) => {
    expect(ruleBlock(CSS, LIGHT).has(token), `${token} missing in ${LIGHT}`).toBe(true);
    expect(ruleBlock(CSS, DARK).has(token), `${token} missing in ${DARK}`).toBe(true);
  });

  it.each(NEW_NAMES)('%s is a name @theme knows', (token) => {
    expect(ruleBlock(CSS, '@theme').has(token)).toBe(true);
  });

  it('ties the next and dark variants to the attributes the root layout sets', () => {
    expect(CSS).toContain('@custom-variant next (&:is([data-look="next"] *));');
    expect(CSS).toContain('@custom-variant dark (&:is([data-theme="dark"] *));');
  });

  it('keeps the new type roles when a colour shares the same cn() call', () => {
    // tailwind-merge drops an unknown `text-*` as a duplicate colour unless the role is registered.
    for (const role of ['text-ui', 'text-meta', 'text-figure', 'text-figure-lg']) {
      expect(cn(role, 'text-foreground')).toBe(`${role} text-foreground`);
    }
  });
});
```

- [ ] **Step 3: Extend the drift guard (also failing)**

In `src/app/__tests__/design-token-drift.test.ts` add this import under the existing imports:

```ts
import { lookTokens } from './next-look-css';
```

and append at the end of the file:

```ts
// ─────────────────────────────────────────────────────────────────────────────
// Next look (behind NEXT_PUBLIC_NEW_LOOK). Same contract as above, for the scoped
// blocks: every row of the "Next look" tables must carry the value globals.css
// declares, light and dark. The rows above keep reading the FIRST declaration of a
// token (the legacy @theme value), so the two looks are guarded side by side.
// ─────────────────────────────────────────────────────────────────────────────

const NEXT_DOCUMENTED = [
  '--color-background', '--color-surface', '--color-surface-elevated', '--color-surface-sunken',
  '--color-border', '--color-border-hover',
  '--color-foreground', '--color-foreground-secondary', '--color-foreground-muted',
  '--color-action', '--color-action-foreground', '--color-hover', '--color-active',
  '--color-track', '--color-above', '--color-above-soft',
  '--color-below', '--color-below-text', '--color-below-soft',
  '--color-glass', '--color-scrim',
  '--shadow-rest', '--shadow-lift', '--shadow-press', '--shadow-float', '--shadow-button', '--shadow-sheet',
] as const;

const normalise = (v: string) => v.replace(/`/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** The text of the "## Next look" section of the docs, up to the next "## " heading. */
function nextLookSection(): string {
  const start = DOC.indexOf('\n## Next look');
  if (start === -1) return '';
  const rest = DOC.slice(start + 1);
  const end = rest.indexOf('\n## ', 1);
  return end === -1 ? rest : rest.slice(0, end);
}

/** The cells of the row documenting `token`: | Token | Role or Use | Light | Dark | */
function nextLookRow(token: string): string[] | undefined {
  const line = nextLookSection()
    .split('\n')
    .find((l) => l.trimStart().startsWith('|') && l.includes(`\`${token}\``));
  return line?.split('|').slice(1, -1).map(normalise);
}

describe('next look: the docs tables match the scoped blocks in globals.css', () => {
  it.each(NEXT_DOCUMENTED)('%s — light and dark', (token) => {
    const cells = nextLookRow(token);
    expect(cells, `no row in the "Next look" section of docs/DESIGN-SYSTEM.md documents ${token}`).toBeDefined();
    expect(cells![2], `${token}, light`).toBe(normalise(lookTokens('light').get(token) ?? ''));
    expect(cells![3], `${token}, dark`).toBe(normalise(lookTokens('dark').get(token) ?? ''));
  });
});
```

- [ ] **Step 4: Run both files and watch them fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/app/__tests__/next-look-contrast.test.ts src/app/__tests__/design-token-drift.test.ts`

Expected: FAIL. `next-look-contrast` fails with `no top-level rule ":root[data-look="next"] {" in globals.css`; the new drift block fails with the same error. The legacy drift tests in the same file still pass.

- [ ] **Step 5: Add the variants**

In `src/app/globals.css` replace line 4

```css
@custom-variant dark (&:is(.dark *));
```

with

```css
/* `dark` follows the theme attribute (it was `.dark`, a class nothing ever applied).
   `next` targets the new look, for shape differences in shared primitives:
   `rounded-md next:rounded-xl`. Both attributes are set on <html> by the root layout
   only when NEXT_PUBLIC_NEW_LOOK is on, so with the flag off neither variant matches. */
@custom-variant dark (&:is([data-theme="dark"] *));
@custom-variant next (&:is([data-look="next"] *));
```

- [ ] **Step 6: Add the new names to `@theme`**

In `src/app/globals.css`, inside `@theme`, directly after the line `--sh-comment: #58595a;` and before the closing `}` of `@theme`, insert:

```css

  /* --- NEXT LOOK (behind NEXT_PUBLIC_NEW_LOOK) — new token NAMES only ---
   * @theme must know a name for Tailwind to generate its utility. The values are the light
   * theme's. Nothing consumes these names while the flag is off. Existing tokens are re-valued
   * in the scoped block after @theme, never here.
   * Spec: docs/superpowers/specs/2026-11-18-foundation-look-and-shell-design.md */
  --color-track: rgba(18, 18, 17, 0.07);
  --color-above: #17783b;
  --color-above-soft: #e3f3e8;
  --color-below: #ec4a35;
  --color-below-text: #c5371f;
  --color-below-soft: #fde9e4;
  --color-glass: rgba(255, 255, 255, 0.78);
  --color-scrim: rgba(0, 0, 0, 0.42);
  --text-ui: 15px;                 /* text: 15 / 21 */
  --text-ui--line-height: 1.4;
  --text-ui--letter-spacing: -0.009em;
  --text-meta: 13px;               /* meta: 13 / 18 */
  --text-meta--line-height: calc(18 / 13);
  --text-meta--letter-spacing: 0;
  --text-figure: 62px;             /* figure: 62 / 58 */
  --text-figure--line-height: calc(58 / 62);
  --text-figure--letter-spacing: -0.055em;
  --text-figure-lg: 76px;          /* large figure: 76 / 72 */
  --text-figure-lg--line-height: calc(72 / 76);
  --text-figure-lg--letter-spacing: -0.055em;
  --radius-4xl: 32px;              /* tab bar, sheet top, message field */
  --shadow-sheet: 0 -20px 50px rgba(0, 0, 0, 0.3);
```

- [ ] **Step 7: Add the scoped blocks**

In `src/app/globals.css`, directly after the `:root { … }` block under the "RAYCAST VARIABLE ALIASES" banner (it ends with `--ease-out: var(--ease-out-cubic);` and `}`) and before the "KEYFRAME ANIMATIONS" banner, insert:

```css

/* ============================================
 * NEXT LOOK — behind NEXT_PUBLIC_NEW_LOOK (2026-11-19)
 * ============================================
 * Owner ruling 2026-11-18: this look replaces the flat-warm charcoal system; light is the
 * default. While the flag is on, the root layout renders
 * <html data-look="next" data-theme="light|dark"> and these blocks re-value the SAME semantic
 * token names the app already consumes, so `bg-background`, `text-foreground`, `border-border`
 * and `bg-action` follow without edits.
 *
 * `:root[data-look="next"]`, not `[data-look="next"]`: later `:root { … }` rules in this file
 * (--focus-ring, the prefers-contrast block) have the specificity of a bare attribute selector
 * and would win by source order.
 *
 * One declaration per line (the token tests parse line by line). Dark hex stays exact hex
 * (Tailwind v4 compiles oklch with L < 0.15 wrong). Guarded by next-look-contrast.test.ts and
 * design-token-drift.test.ts. Cut-over moves these values into @theme and deletes the scope. */
:root[data-look="next"] {
  color-scheme: light;

  --color-background: #f4f3f0;
  --color-surface: #ffffff;
  --color-surface-elevated: #efeeea;
  --color-surface-sunken: rgba(18, 18, 17, 0.06);
  --color-border: rgba(17, 17, 16, 0.06);
  --color-border-hover: rgba(17, 17, 16, 0.12);
  --color-foreground: #121211;
  --color-foreground-secondary: rgba(18, 18, 17, 0.6);
  --color-foreground-muted: rgba(18, 18, 17, 0.46);
  --color-action: #121211;
  --color-action-foreground: #ffffff;
  --color-hover: rgba(18, 18, 17, 0.04);
  --color-active: rgba(18, 18, 17, 0.08);
  --color-track: rgba(18, 18, 17, 0.07);
  --color-above: #17783b;
  --color-above-soft: #e3f3e8;
  --color-below: #ec4a35;
  --color-below-text: #c5371f;
  --color-below-soft: #fde9e4;
  --color-glass: rgba(255, 255, 255, 0.78);
  --color-scrim: rgba(0, 0, 0, 0.42);
  --color-success: var(--color-above);
  --color-error: var(--color-below-text);

  /* Legacy raw tokens point at the new roles, so files that use them directly stay legible. */
  --color-charcoal-app: var(--color-background);
  --color-chrome: var(--color-background);
  --color-charcoal-sidebar: var(--color-background);
  --color-background-elevated: var(--color-background);
  --color-charcoal-thread: var(--color-surface);
  --color-charcoal-composer: var(--color-surface);
  --color-surface-thread: var(--color-surface);
  --color-charcoal-chip: var(--color-surface-elevated);
  --color-cream-primary: var(--color-foreground);
  --color-cream-secondary: var(--color-foreground-secondary);
  --color-cream-muted: var(--color-foreground-muted);
  --color-border-glass: var(--color-border);
  --color-border-subtle: var(--color-border);

  --focus-ring: var(--color-foreground);

  /* Every card shadow starts with the hairline. */
  --shadow-rest: 0 0 0 1px var(--color-border), 0 1px 1px rgba(0, 0, 0, 0.03), 0 10px 26px -12px rgba(0, 0, 0, 0.1), 0 34px 60px -34px rgba(0, 0, 0, 0.14);
  --shadow-lift: 0 0 0 1px var(--color-border-hover), 0 14px 30px -12px rgba(0, 0, 0, 0.16), 0 40px 70px -34px rgba(0, 0, 0, 0.18);
  --shadow-press: 0 0 0 1px var(--color-border), 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-float: 0 0 0 1px var(--color-border), 0 14px 34px -12px rgba(0, 0, 0, 0.3);
  --shadow-button: inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 10px 20px -10px rgba(0, 0, 0, 0.45);
  --shadow-sheet: 0 -20px 50px rgba(0, 0, 0, 0.3);
}

:root[data-look="next"][data-theme="dark"] {
  color-scheme: dark;

  --color-background: #08080a;
  --color-surface: #131315;
  --color-surface-elevated: #232326;
  --color-surface-sunken: rgba(255, 255, 255, 0.07);
  --color-border: rgba(255, 255, 255, 0.075);
  --color-border-hover: rgba(255, 255, 255, 0.14);
  --color-foreground: #f7f6f3;
  --color-foreground-secondary: rgba(247, 246, 243, 0.62);
  --color-foreground-muted: rgba(247, 246, 243, 0.38);
  --color-action: #f7f6f3;
  --color-action-foreground: #0b0b0c;
  --color-hover: rgba(255, 255, 255, 0.05);
  --color-active: rgba(255, 255, 255, 0.1);
  --color-track: rgba(255, 255, 255, 0.09);
  --color-above: #62d892;
  --color-above-soft: rgba(98, 216, 146, 0.14);
  --color-below: #ff5f4c;
  --color-below-text: #ff8778;
  --color-below-soft: rgba(255, 98, 80, 0.16);
  --color-glass: rgba(30, 30, 33, 0.78);
  --color-scrim: rgba(0, 0, 0, 0.6);

  /* Dark: depth is a step in surface tone, no glow. The button has no shadow; a zero shadow,
     not `none`, because the value sits inside Tailwind's box-shadow list. */
  --shadow-rest: 0 0 0 1px var(--color-border), inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 24px 50px -24px rgba(0, 0, 0, 0.9);
  --shadow-lift: 0 0 0 1px var(--color-border-hover), inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 24px 50px -24px rgba(0, 0, 0, 0.9);
  --shadow-press: 0 0 0 1px var(--color-border);
  --shadow-float: 0 0 0 1px var(--color-border), 0 14px 34px -12px rgba(0, 0, 0, 0.7);
  --shadow-button: 0 0 0 0 transparent;
  --shadow-sheet: 0 -20px 50px rgba(0, 0, 0, 0.6);
}

/* More contrast, new look. The legacy block at the end of this file sets white hairlines on
   `:root`; it cannot outrank the scope above, so the new look states its own. Muted text joins
   secondary, as in the legacy block. */
@media (prefers-contrast: more) {
  :root[data-look="next"] {
    --color-border: rgba(17, 17, 16, 0.2);
    --color-border-hover: rgba(17, 17, 16, 0.32);
    --color-foreground-muted: var(--color-foreground-secondary);
  }
  :root[data-look="next"][data-theme="dark"] {
    --color-border: rgba(255, 255, 255, 0.2);
    --color-border-hover: rgba(255, 255, 255, 0.3);
    --color-foreground-muted: var(--color-foreground-secondary);
  }
}
```

- [ ] **Step 8: Put the focus ring outside the control under the new look**

In `src/app/globals.css`, directly after the rule

```css
input:focus-visible,
textarea:focus-visible,
select:focus-visible,
[contenteditable]:focus-visible {
  outline: none;
}
```

insert:

```css

/* Next look: the ring sits 2px OUTSIDE the control (spec §7); its colour comes from
   --focus-ring, re-valued in the scope. `:where()` keeps this at the specificity of the
   app-wide rule above, so the text-field exception still wins. */
:where([data-look="next"]) :focus-visible {
  outline-offset: 2px;
}

/* Next look, type (spec §4.2): running text at weight 430 (Inter is variable), and every
   number tabular, so figures do not shift as they count or update. */
:where([data-look="next"]) body {
  font-weight: 430;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 9: Register the new type roles**

In `src/lib/utils.ts`, in `TYPE_ROLES`, after the line `"stat",` add:

```ts
  // Next look (behind NEXT_PUBLIC_NEW_LOOK). "figure-lg" is invisible to the guard's regex
  // (it stops at the dash), so next-look-contrast.test.ts asserts all four through cn().
  "ui",
  "meta",
  "figure",
  "figure-lg",
```

- [ ] **Step 10: Document the tokens**

Append to the end of `docs/DESIGN-SYSTEM.md`:

```md

## Next look (behind `NEXT_PUBLIC_NEW_LOOK`)

Owner ruling 2026-11-18: this look replaces the flat-warm charcoal system above; light is the
default. Until cut-over both exist. With the flag on, the root layout renders
`<html data-look="next" data-theme="light|dark">` and the scoped blocks in `globals.css`
(`:root[data-look="next"]` and `…[data-theme="dark"]`) re-value the semantic tokens. Spec:
`docs/superpowers/specs/2026-11-18-foundation-look-and-shell-design.md`.

Guards: `design-token-drift.test.ts` (every row below, both themes) and
`next-look-contrast.test.ts` (contrast computed from the CSS, cycles, completeness).

### Next look: colour

| Token | Role | Light | Dark |
|---|---|---|---|
| `--color-background` | ground | `#f4f3f0` | `#08080a` |
| `--color-surface` | card | `#ffffff` | `#131315` |
| `--color-surface-elevated` | raised control on a card, tooltip | `#efeeea` | `#232326` |
| `--color-surface-sunken` | tint fill: secondary button, chip, search field | `rgba(18, 18, 17, 0.06)` | `rgba(255, 255, 255, 0.07)` |
| `--color-border` | hairline | `rgba(17, 17, 16, 0.06)` | `rgba(255, 255, 255, 0.075)` |
| `--color-border-hover` | hairline, hovered | `rgba(17, 17, 16, 0.12)` | `rgba(255, 255, 255, 0.14)` |
| `--color-foreground` | text, icons | `#121211` | `#f7f6f3` |
| `--color-foreground-secondary` | secondary text | `rgba(18, 18, 17, 0.6)` | `rgba(247, 246, 243, 0.62)` |
| `--color-foreground-muted` | placeholder, unit, disabled | `rgba(18, 18, 17, 0.46)` | `rgba(247, 246, 243, 0.38)` |
| `--color-action` | primary button | `#121211` | `#f7f6f3` |
| `--color-action-foreground` | text on the primary button | `#ffffff` | `#0b0b0c` |
| `--color-hover` | overlay tint on hover | `rgba(18, 18, 17, 0.04)` | `rgba(255, 255, 255, 0.05)` |
| `--color-active` | overlay tint, pressed or selected | `rgba(18, 18, 17, 0.08)` | `rgba(255, 255, 255, 0.1)` |
| `--color-track` | empty part of a gauge or progress line | `rgba(18, 18, 17, 0.07)` | `rgba(255, 255, 255, 0.09)` |
| `--color-above` | 6+ above usual, graphic and text | `#17783b` | `#62d892` |
| `--color-above-soft` | its pill background | `#e3f3e8` | `rgba(98, 216, 146, 0.14)` |
| `--color-below` | 6+ below usual, graphic | `#ec4a35` | `#ff5f4c` |
| `--color-below-text` | 6+ below usual, text | `#c5371f` | `#ff8778` |
| `--color-below-soft` | its pill background | `#fde9e4` | `rgba(255, 98, 80, 0.16)` |
| `--color-glass` | floating chrome fill | `rgba(255, 255, 255, 0.78)` | `rgba(30, 30, 33, 0.78)` |
| `--color-scrim` | behind a sheet | `rgba(0, 0, 0, 0.42)` | `rgba(0, 0, 0, 0.6)` |

`--color-accent` stays `#FF6363` and is the brand mark only. `--color-success` aliases
`--color-above`; `--color-error` aliases `--color-below-text`.

Rules: one meaning per colour (green and coral only say "against your usual"; ink is action).
`--color-foreground-muted` never carries information on its own. `--color-below` is for arcs,
dots and curves; text uses `--color-below-text`. Buttons are ink (light) or white (dark), never
coral.

### Next look: elevation

| Token | Use | Light | Dark |
|---|---|---|---|
| `--shadow-rest` | card | `0 0 0 1px var(--color-border), 0 1px 1px rgba(0, 0, 0, 0.03), 0 10px 26px -12px rgba(0, 0, 0, 0.1), 0 34px 60px -34px rgba(0, 0, 0, 0.14)` | `0 0 0 1px var(--color-border), inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 24px 50px -24px rgba(0, 0, 0, 0.9)` |
| `--shadow-lift` | card hovered (desktop) | `0 0 0 1px var(--color-border-hover), 0 14px 30px -12px rgba(0, 0, 0, 0.16), 0 40px 70px -34px rgba(0, 0, 0, 0.18)` | `0 0 0 1px var(--color-border-hover), inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 24px 50px -24px rgba(0, 0, 0, 0.9)` |
| `--shadow-press` | pressed, resting control on the ground | `0 0 0 1px var(--color-border), 0 1px 2px rgba(0, 0, 0, 0.06)` | `0 0 0 1px var(--color-border)` |
| `--shadow-float` | tab bar, message field, popover | `0 0 0 1px var(--color-border), 0 14px 34px -12px rgba(0, 0, 0, 0.3)` | `0 0 0 1px var(--color-border), 0 14px 34px -12px rgba(0, 0, 0, 0.7)` |
| `--shadow-button` | primary button | `inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 10px 20px -10px rgba(0, 0, 0, 0.45)` | `0 0 0 0 transparent` |
| `--shadow-sheet` | sheet | `0 -20px 50px rgba(0, 0, 0, 0.3)` | `0 -20px 50px rgba(0, 0, 0, 0.6)` |

Consume these as `shadow-[var(--shadow-float)]`. The utilities `shadow-float`, `shadow-button`
and `shadow-rest` carry the legacy value: Tailwind copies a shadow token into its utility at
build time. Glass = `bg-glass` plus `backdrop-filter: blur(24px) saturate(1.6)` as an inline
style, only where chrome floats over content (tab bar, message field, controls on a video).

### Next look: type, radius, parts

Inter only. Four weights: `font-[430]` text, `font-[560]` label, `font-[640]` title, `font-bold`
numbers and screen titles. Every number is tabular.

| Role | Utility | Size / line |
|---|---|---|
| Screen title | `text-3xl font-bold leading-[35px] tracking-[-0.035em]` | 30 / 35 |
| Verdict line | `text-heading font-[640]` | 22 / 26 |
| Title | `text-title font-[640]` | 16 / 22 |
| Text | `text-ui` | 15 / 21 |
| Meta | `text-meta` | 13 / 18 |
| Small label | `text-label font-[560]` | 12 / 18 |
| Tab label | `text-micro font-[560]` | 10 / 14 |
| Figure | `text-figure font-bold` | 62 / 58 |
| Large figure | `text-figure-lg font-bold` | 76 / 72 |

Radius: thumbnail `rounded-lg` 12 · button `rounded-xl` 16 · tile `rounded-2xl` 20 · card
`rounded-3xl` 24 · tab bar, sheet top, message field `rounded-4xl` 32 · chip, tag, icon button
`rounded-full`.

Parts (`src/components/ui`): `Card` and `Tile`, `Button` (`primary`, `secondary`, `quiet`; `lg`
is 50 tall, `xl` is 56), `IconButton`, `Chip`, `Badge` (the tag), `Sheet`. Shell
(`src/components/shell`): `TabBar`, `SideNav`, `PlaceHeader`, `PushedHeader`, `NextShell`.
```

- [ ] **Step 11: Add the note to the repo CLAUDE.md**

In `CLAUDE.md`, directly above the line `### 🔒 Accent dosage (LOCKED 2026-06-24) — read this before adding any colour`, insert:

```md
### 🚧 New look in progress — behind `NEXT_PUBLIC_NEW_LOOK` (2026-11-19)

The flat-warm charcoal system described here is being replaced (owner ruling 2026-11-18). With the
flag on, `<html data-look="next" data-theme="light|dark">` re-values the semantic tokens: light by
default, Inter only, ink buttons, glass only on floating chrome. Tokens and rules:
`docs/DESIGN-SYSTEM.md` → "Next look". Spec:
`docs/superpowers/specs/2026-11-18-foundation-look-and-shell-design.md`. While both looks exist:

- Flag off must render exactly as before. Never change an existing `@theme` value.
- New-look code lives in `src/components/shell/` and in `next:` variants on `src/components/ui`.
- In new-look code write `shadow-[var(--shadow-float)]`, never `shadow-float`: Tailwind copies a
  shadow token's value into its utility, so the utility ignores the scoped re-valuation.
- Do not patch a legacy screen to look right inside the flag; each is replaced by its own part.

```

- [ ] **Step 12: Run the token tests and the guards they touch**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/app/__tests__ src/components/__tests__/type-scale.test.ts src/components/primitives/__tests__/command-palette-layer.test.ts`

Expected: PASS, all files. If a contrast pair fails, the CSS value was mistyped: compare it with the block in Step 7 (the pairs were computed from these values: lowest text pair 4.54, lowest graphic pair 3.05).

- [ ] **Step 13: Check that no existing declaration changed**

Run: `git diff -- src/app/globals.css | grep '^-' | grep -v '^---'`

Expected: exactly one line, `-@custom-variant dark (&:is(.dark *));`. Anything else removed is a mistake.

- [ ] **Step 14: Commit**

```bash
git add src/app/globals.css src/lib/utils.ts src/app/__tests__/next-look-css.ts src/app/__tests__/next-look-contrast.test.ts src/app/__tests__/design-token-drift.test.ts docs/DESIGN-SYSTEM.md CLAUDE.md
git -c core.hooksPath=/dev/null commit -m "feat(next-look): scoped light and dark tokens behind data-look, with contrast and drift guards"
```

---

### Task 2: The flag at the root, and the theme

**Files:**
- Create: `src/lib/flags/new-look.ts`
- Create: `src/lib/theme/theme.ts`
- Create: `src/lib/theme/use-theme.ts`
- Create: `src/lib/theme/__tests__/theme.test.ts`
- Modify: `src/app/layout.tsx:51-64`

**Interfaces:**
- Consumes: the scoped blocks of Task 1 (`data-look`, `data-theme`).
- Produces:
  - `NEW_LOOK_ENABLED: boolean` from `@/lib/flags/new-look`
  - from `@/lib/theme/theme`: `THEME_STORAGE_KEY = "maven-theme"`, `THEME_EVENT = "maven-theme-change"`, `type ThemeChoice = "light" | "dark" | "system"`, `type ResolvedTheme = "light" | "dark"`, `resolveTheme(choice, systemPrefersDark): ResolvedTheme`, `readThemeChoice(): ThemeChoice`, `paintTheme(choice): ResolvedTheme`, `applyThemeChoice(choice): ResolvedTheme`, `THEME_INIT_SCRIPT: string`
  - from `@/lib/theme/use-theme`: `useThemeChoice(): [ThemeChoice, (c: ThemeChoice) => void]`, `useThemeSync(): void`

- [ ] **Step 1: Write the failing test**

Create `src/lib/theme/__tests__/theme.test.ts`:

```ts
/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  applyThemeChoice,
  readThemeChoice,
  resolveTheme,
} from '../theme';

function systemPrefersDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query.includes('prefers-color-scheme: dark'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** A browser that refuses storage (private mode, blocked cookies): every call throws. */
function blockStorage() {
  const blocked = () => {
    throw new Error('blocked');
  };
  vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked, clear: blocked });
}

/** Runs the script exactly as the browser does from <head>. */
const runHeadScript = () => new Function(THEME_INIT_SCRIPT)();
const painted = () => document.documentElement.getAttribute('data-theme');

beforeEach(() => {
  localStorage.clear();
  // The server always renders light; the script corrects it before first paint.
  document.documentElement.setAttribute('data-theme', 'light');
  systemPrefersDark(false);
});

// Restores the real localStorage and matchMedia before the next test's beforeEach.
afterEach(() => vi.unstubAllGlobals());

describe('resolveTheme', () => {
  it('returns an explicit choice as it is', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows the system only when asked to', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('readThemeChoice', () => {
  it('is light when nothing is stored (owner ruling: light is the default)', () => {
    expect(readThemeChoice()).toBe('light');
  });

  it('ignores a value it does not know', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(readThemeChoice()).toBe('light');
  });

  it('returns the stored choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    expect(readThemeChoice()).toBe('system');
  });
});

describe('the head script (runs before first paint)', () => {
  it('leaves light in place when nothing is stored, even on a dark system', () => {
    systemPrefersDark(true);
    runHeadScript();
    expect(painted()).toBe('light');
  });

  it('paints a stored dark choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    runHeadScript();
    expect(painted()).toBe('dark');
  });

  it('follows the system when the choice is "system"', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    systemPrefersDark(true);
    runHeadScript();
    expect(painted()).toBe('dark');
  });

  it('does not throw and keeps light when storage is blocked', () => {
    blockStorage();
    expect(runHeadScript).not.toThrow();
    expect(painted()).toBe('light');
  });
});

describe('applyThemeChoice', () => {
  it('stores the choice and paints it', () => {
    expect(applyThemeChoice('dark')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(painted()).toBe('dark');
  });

  it('stores "system" itself, and paints what the system says', () => {
    systemPrefersDark(true);
    expect(applyThemeChoice('system')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('still paints when storage is blocked', () => {
    blockStorage();
    expect(applyThemeChoice('dark')).toBe('dark');
    expect(painted()).toBe('dark');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/theme`

Expected: FAIL, cannot resolve `../theme`.

- [ ] **Step 3: Write the flag**

Create `src/lib/flags/new-look.ts`:

```ts
/**
 * NEW_LOOK_ENABLED — the switch for the new look and the new app shell (owner ruling 2026-11-18).
 *
 * OFF by default: the app renders exactly as before. Set `NEXT_PUBLIC_NEW_LOOK=true` (env only,
 * like `NEXT_PUBLIC_AMBIENT_V2`) and the root layout renders
 * `<html data-look="next" data-theme="light|dark">`, which re-values the semantic tokens
 * (globals.css, "NEXT LOOK") and swaps the legacy shell for `src/components/shell`.
 *
 * Old screens inside the flag look unfinished on purpose; each is replaced by its own build part.
 * Spec: docs/superpowers/specs/2026-11-18-foundation-look-and-shell-design.md
 */
export const NEW_LOOK_ENABLED = process.env.NEXT_PUBLIC_NEW_LOOK === "true";
```

- [ ] **Step 4: Write the theme module**

Create `src/lib/theme/theme.ts`:

```ts
/**
 * Theme choice for the new look: Light (default), Dark, or Match system.
 *
 * The choice lives in localStorage; <html data-theme> carries what is painted. The server always
 * renders "light"; THEME_INIT_SCRIPT runs in <head> and corrects it before first paint, so there
 * is no flash. `color-scheme` follows through CSS (globals.css, "NEXT LOOK").
 *
 * No "use client" and no window access at module scope: the root layout imports the script
 * string on the server.
 */

export const THEME_STORAGE_KEY = "maven-theme";
/** Fired on `window` after the choice changes in this tab. */
export const THEME_EVENT = "maven-theme-change";

export const THEME_CHOICES = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export type ResolvedTheme = "light" | "dark";

function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);
}

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ResolvedTheme {
  if (choice === "system") return systemPrefersDark ? "dark" : "light";
  return choice;
}

/** The stored choice. Light when nothing valid is stored or storage is blocked. */
export function readThemeChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(stored) ? stored : "light";
  } catch {
    return "light";
  }
}

function systemPrefersDark(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** Paint `choice` on <html> without storing it. */
export function paintTheme(choice: ThemeChoice): ResolvedTheme {
  const resolved = resolveTheme(choice, systemPrefersDark());
  document.documentElement.setAttribute("data-theme", resolved);
  return resolved;
}

/** Store `choice`, paint it, and tell this tab's listeners. */
export function applyThemeChoice(choice: ThemeChoice): ResolvedTheme {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage blocked (private mode): the choice still applies for this page.
  }
  const resolved = paintTheme(choice);
  window.dispatchEvent(new Event(THEME_EVENT));
  return resolved;
}

/**
 * Inline <head> script. Plain ES5, no dependencies, wrapped in try/catch: it must never stop
 * the page. It only acts when a choice other than the default is stored.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem("${THEME_STORAGE_KEY}");var d=c==="dark"||(c==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.setAttribute("data-theme","dark")}}catch(e){}})();`;
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/theme`

Expected: PASS, 12 tests.

- [ ] **Step 6: Write the hooks**

Create `src/lib/theme/use-theme.ts`:

```ts
"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  THEME_EVENT,
  applyThemeChoice,
  paintTheme,
  readThemeChoice,
  type ThemeChoice,
} from "./theme";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const serverChoice = (): ThemeChoice => "light";

/** The stored choice and a setter that stores and paints it. For the Appearance setting. */
export function useThemeChoice(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const choice = useSyncExternalStore(subscribe, readThemeChoice, serverChoice);
  const set = useCallback((next: ThemeChoice) => {
    applyThemeChoice(next);
  }, []);
  return [choice, set];
}

/**
 * Keeps <html data-theme> right while the app is open: when the OS switches (choice "system")
 * and when another tab changes the choice. Mounted once, by the app shell.
 */
export function useThemeSync(): void {
  useEffect(() => {
    const repaint = () => {
      paintTheme(readThemeChoice());
    };
    const mq =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    mq?.addEventListener("change", repaint);
    window.addEventListener("storage", repaint);
    return () => {
      mq?.removeEventListener("change", repaint);
      window.removeEventListener("storage", repaint);
    };
  }, []);
}
```

(`useThemeChoice` is exercised through the Appearance setting in Task 8.)

- [ ] **Step 7: Switch the root layout**

In `src/app/layout.tsx` add the imports under the existing ones:

```tsx
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme";
```

and replace the `RootLayout` function with:

```tsx
// With the flag on, <html> carries the new look. The server always renders "light"; the head
// script corrects it before first paint, which is why React must not warn about the attribute.
const NEXT_LOOK_ATTRS = NEW_LOOK_ENABLED
  ? ({ "data-look": "next", "data-theme": "light", suppressHydrationWarning: true } as const)
  : {};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`} {...NEXT_LOOK_ATTRS}>
      {NEW_LOOK_ENABLED && (
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        </head>
      )}
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        {/* The funnel's event sink (DESIGN §8) — root-level so /go and / are covered. */}
        <FunnelProvider />
        <DevLocator />
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Type check**

Run: `pnpm exec tsc --noEmit 2>&1 | wc -l`

Expected: the same number as `.scratch/next-look/baseline/tsc.txt` (Task 0, Step 5).

- [ ] **Step 9: Hit the page, flag off and flag on**

Flag off:

```bash
cd ~/virtuna-next-look && (NODE_OPTIONS='--max-old-space-size=2048 --no-experimental-webstorage' node node_modules/next/dist/bin/next dev --turbopack --port 3021 > .scratch/next-look/dev.log 2>&1 &)
sleep 12; curl -s http://localhost:3021/login | grep -o '<html[^>]*>'; curl -s http://localhost:3021/login | grep -c 'maven-theme'
kill $(lsof -ti:3021)
```

Expected: an `<html lang="en" class="…">` tag with no `data-look`, then `0`.

Flag on:

```bash
cd ~/virtuna-next-look && (NEXT_PUBLIC_NEW_LOOK=true NODE_OPTIONS='--max-old-space-size=2048 --no-experimental-webstorage' node node_modules/next/dist/bin/next dev --turbopack --port 3021 > .scratch/next-look/dev.log 2>&1 &)
sleep 12; curl -s http://localhost:3021/login | grep -o '<html[^>]*>'; curl -s http://localhost:3021/login | grep -c 'maven-theme'
node scripts/next-look-probe.cjs --base http://localhost:3021 --cookies .scratch/next-look/cookie.json --out .scratch/next-look/t2-light
node scripts/next-look-probe.cjs --base http://localhost:3021 --cookies .scratch/next-look/cookie.json --out .scratch/next-look/t2-dark --theme dark
kill $(lsof -ti:3021)
```

Expected: the tag carries `data-look="next" data-theme="light"`; the count is `1` or more. The light probe prints `"look":"next","theme":"light","colorScheme":"light"`, body background `rgb(244, 243, 240)` and `weight 430`; the dark probe prints `"theme":"dark","colorScheme":"dark"` and `rgb(8, 8, 10)`. (Mint a new cookie first if the last one is older than an hour: Task 0, Step 8.)

Read `.scratch/next-look/t2-light/library-desk.png`: the page is light and the legacy sidebar is still there, unfinished. That is expected at this point.

- [ ] **Step 10: Commit**

```bash
git add src/lib/flags/new-look.ts src/lib/theme src/app/layout.tsx
git -c core.hooksPath=/dev/null commit -m "feat(next-look): NEXT_PUBLIC_NEW_LOOK sets data-look on <html>; light, dark and system theme with no flash"
```

---

### Task 3: Base parts

Card, button, icon button, chip, tag, sheet. The four that exist are restyled in place; flag off they must produce the same classes and styles as today.

**Files:**
- Create: `src/components/ui/__tests__/next-look-parity.test.tsx`
- Create: `src/components/ui/__tests__/next-look-parts.test.tsx`
- Create: `src/components/ui/__tests__/next-look-parts.flag-on.test.tsx`
- Create: `src/components/ui/chip.tsx`
- Create: `src/components/ui/icon-button.tsx`
- Modify: `src/components/ui/button.tsx:32-80`
- Modify: `src/components/ui/card.tsx:51-68` and `:141-179`
- Modify: `src/components/ui/badge.tsx:33-63`
- Modify: `src/components/ui/sheet.tsx:31-91`

**Interfaces:**
- Consumes: `NEW_LOOK_ENABLED` (Task 2); the `next:` variant and tokens (Task 1).
- Produces:
  - `Button`: new variant `quiet`, new size `xl` (56); `lg` is 50 tall under the flag.
  - `Tile` from `@/components/ui/card`: `React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>`
  - `Chip` from `@/components/ui/chip`: props `React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; surface?: "ground" | "card" }`. Sets `aria-pressed` when `selected` is given.
  - `IconButton` from `@/components/ui/icon-button`: props `Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { "aria-label": string; surface?: "ground" | "card" | "quiet" }`
  - `SheetContent side="bottom"` shows a grab handle (`[data-slot="sheet-handle"]`) under the flag.

- [ ] **Step 1: Pin today's output (a characterization test, written before any change)**

Create `src/components/ui/__tests__/next-look-parity.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { badgeVariants } from '../badge';
import { buttonVariants } from '../button';
import { Card, CardContent, CardFooter, CardHeader } from '../card';

// ─────────────────────────────────────────────────────────────────────────────
// Flag off, the base parts must look exactly as they did before the new look.
//
// A `next:` class matches nothing unless <html data-look="next"> is set, so what the flag-off
// app sees is the class list WITHOUT them. This file was written and its snapshot recorded
// BEFORE the parts were restyled. If it fails, a legacy class was changed or removed: fix the
// component. Never update this snapshot with `-u`.
// ─────────────────────────────────────────────────────────────────────────────

const legacy = (cls: string) =>
  cls.split(/\s+/).filter((c) => c && !c.startsWith('next:')).sort().join(' ');

const BUTTON_VARIANTS = ['primary', 'secondary', 'ghost', 'destructive'] as const;
const BUTTON_SIZES = ['sm', 'md', 'lg'] as const;
const BADGE_VARIANTS = ['default', 'secondary', 'accent', 'success', 'warning', 'error', 'info'] as const;
const BADGE_SIZES = ['sm', 'md'] as const;

describe('flag off: the base parts keep their legacy classes', () => {
  it.each(BUTTON_VARIANTS.flatMap((v) => BUTTON_SIZES.map((s) => [v, s] as const)))(
    'button %s / %s',
    (variant, size) => {
      expect(legacy(buttonVariants({ variant, size }))).toMatchSnapshot();
    },
  );

  it.each(BADGE_VARIANTS.flatMap((v) => BADGE_SIZES.map((s) => [v, s] as const)))(
    'badge %s / %s',
    (variant, size) => {
      expect(legacy(badgeVariants({ variant, size }))).toMatchSnapshot();
    },
  );

  it('card keeps its inline surface and its classes', () => {
    const { container } = render(
      <Card>
        <CardHeader>h</CardHeader>
        <CardContent>c</CardContent>
        <CardFooter>f</CardFooter>
      </Card>,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.getAttribute('style')).toMatchSnapshot();
    expect([card, ...Array.from(card.children)].map((el) => legacy(el.className))).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Record the snapshot from the untouched components**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/ui/__tests__/next-look-parity.test.tsx`

Expected: PASS, 27 tests, "28 snapshots written" (the card test holds two). The file `src/components/ui/__tests__/__snapshots__/next-look-parity.test.tsx.snap` now exists. From here on it must pass without being rewritten.

- [ ] **Step 3: Write the failing tests for what is new**

Create `src/components/ui/__tests__/next-look-parts.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '../button';
import { Tile } from '../card';
import { Chip } from '../chip';
import { IconButton } from '../icon-button';

describe('Chip', () => {
  it('is a button that reports whether it is selected', () => {
    render(<Chip selected>Posted</Chip>);
    expect(screen.getByRole('button', { name: 'Posted' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('carries no pressed state when it is a plain action', () => {
    render(<Chip>3 more</Chip>);
    expect(screen.getByRole('button', { name: '3 more' })).not.toHaveAttribute('aria-pressed');
  });

  it('runs its action on click, and not when disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Chip onClick={onClick}>Shorter</Chip>);
    fireEvent.click(screen.getByRole('button', { name: 'Shorter' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<Chip onClick={onClick} disabled>Shorter</Chip>);
    fireEvent.click(screen.getByRole('button', { name: 'Shorter' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('never submits a surrounding form by accident', () => {
    render(<Chip>Drafts</Chip>);
    expect(screen.getByRole('button', { name: 'Drafts' })).toHaveAttribute('type', 'button');
  });
});

describe('IconButton', () => {
  it('is named by its label, because it shows no text', () => {
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Back" onClick={onClick}>
        <svg aria-hidden />
      </IconButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('grows its touch area to 44px without growing the drawn circle', () => {
    render(<IconButton aria-label="Save"><svg aria-hidden /></IconButton>);
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('tap-44');
  });
});

describe('Button: the two additions', () => {
  it('has a quiet variant for links like "See all"', () => {
    render(<Button variant="quiet">See all</Button>);
    const cls = screen.getByRole('button', { name: 'See all' }).className;
    expect(cls).toContain('text-foreground-secondary');
    expect(cls).not.toContain('bg-action');
  });

  it('has a 56px size for the one main action of a screen', () => {
    render(<Button variant="primary" size="xl">Simulate</Button>);
    expect(screen.getByRole('button', { name: 'Simulate' }).className).toContain('h-14');
  });
});

describe('Tile', () => {
  it('renders its children and takes extra classes', () => {
    render(<Tile className="mt-2">inner</Tile>);
    expect(screen.getByText('inner').className).toContain('mt-2');
  });
});
```

Create `src/components/ui/__tests__/next-look-parts.flag-on.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

// The flag is a build-time constant; this file is the flag-on build.
vi.mock('@/lib/flags/new-look', () => ({ NEW_LOOK_ENABLED: true }));

import { Card } from '../card';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../sheet';

describe('flag on: Card', () => {
  it('takes its surface from tokens; the legacy inline style is gone', () => {
    const { container } = render(<Card>x</Card>);
    const card = container.firstElementChild as HTMLElement;
    expect(card.style.background).toBe('');
    expect(card.style.boxShadow).toBe('');
    expect(card.className).toContain('bg-surface');
    expect(card.className).toContain('shadow-[var(--shadow-rest)]');
  });

  it('still lets a caller pass its own style', () => {
    const { container } = render(<Card style={{ minHeight: 40 }}>x</Card>);
    expect((container.firstElementChild as HTMLElement).style.minHeight).toBe('40px');
  });
});

describe('flag on: Sheet', () => {
  it('a bottom sheet shows a grab handle', () => {
    render(
      <Sheet open>
        <SheetContent side="bottom">
          <SheetTitle>Skills</SheetTitle>
          <SheetDescription>Pick one.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(document.querySelector('[data-slot="sheet-handle"]')).not.toBeNull();
  });

  it('a side sheet does not', () => {
    render(
      <Sheet open>
        <SheetContent side="right">
          <SheetTitle>Panel</SheetTitle>
          <SheetDescription>Details.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(document.querySelector('[data-slot="sheet-handle"]')).toBeNull();
  });
});
```

- [ ] **Step 4: Run them and watch them fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/ui/__tests__/next-look-parts.test.tsx src/components/ui/__tests__/next-look-parts.flag-on.test.tsx`

Expected: FAIL. The first file cannot resolve `../chip`; the second fails on `card.style.background` being `transparent` and on the missing handle.

- [ ] **Step 5: Restyle the button**

In `src/components/ui/button.tsx` replace the whole `const buttonVariants = cva( … );` statement (keep the doc comment above it) with:

```tsx
const buttonVariants = cva(
  // Base styles - shared across all variants
  [
    "inline-flex items-center justify-center gap-2",
    "font-medium transition-colors",
    // Focus ring using semantic tokens
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    // Disabled state
    "disabled:pointer-events-none disabled:opacity-50",
    // Ensure cursor pointer for interactive element
    "cursor-pointer",
    // Next look (spec §7): title weight, press = scale 0.98, disabled = 40% and no shadow.
    "next:font-[640] next:duration-150 next:transition-[color,background-color,box-shadow,transform]",
    "next:active:scale-[0.98] next:disabled:opacity-40 next:disabled:shadow-none",
  ],
  {
    variants: {
      /**
       * Visual style variant
       * - `primary`: the one filled action of a card or screen (cream today, ink under the new look)
       * - `secondary`: default for most buttons (bordered today, tint fill under the new look)
       * - `ghost`: Transparent background, for tertiary/icon buttons
       * - `destructive`: Error color background, for dangerous actions
       * - `quiet`: text only, for links like "See all" (new look)
       */
      variant: {
        primary:
          "bg-action text-action-foreground shadow-button hover:bg-action/90 active:bg-action/80 next:shadow-[var(--shadow-button)]",
        secondary:
          "bg-transparent border border-white/[0.06] text-foreground hover:bg-white/[0.1] active:bg-white/[0.15] next:border-transparent next:bg-surface-sunken next:hover:bg-active next:active:bg-active",
        ghost:
          "bg-transparent text-foreground hover:bg-hover active:bg-active",
        destructive:
          "bg-error text-white hover:bg-error/90 active:bg-error/80",
        quiet:
          "bg-transparent text-foreground-secondary hover:text-foreground",
      },
      /**
       * Size variant
       * - `sm`: 36px height, compact for icon buttons
       * - `md`: 44px height, default, meets touch target
       * - `lg`: 48px height (50px under the new look), prominent actions
       * - `xl`: 56px height, the one main action of a screen (new look)
       */
      size: {
        sm: "h-9 min-h-[36px] min-w-[36px] px-3 text-sm rounded-md next:rounded-lg",
        md: "h-11 min-h-[44px] min-w-[44px] px-4 text-sm rounded-md next:rounded-xl",
        lg: "h-12 min-h-[48px] min-w-[48px] px-6 text-base rounded-md next:h-[50px] next:rounded-xl next:text-ui",
        xl: "h-14 min-h-[56px] min-w-[56px] px-6 text-ui rounded-xl",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
);
```

- [ ] **Step 6: Restyle the card and add the tile**

In `src/components/ui/card.tsx` add the import under the existing one:

```tsx
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
```

Replace the `const Card = React.forwardRef … Card.displayName = "Card";` statements with:

```tsx
// The legacy surface is an INLINE style (transparent + an inset white line), which no class can
// override. So the new look is chosen with the flag here, not with a `next:` variant.
const LEGACY_CARD_STYLE = {
  background: "transparent",
  boxShadow: "rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset",
} as const;

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        NEW_LOOK_ENABLED
          ? // Spec §7: surface, radius 24, the resting shadow (which carries the hairline), padding 16.
            "rounded-3xl bg-surface p-4 shadow-[var(--shadow-rest)]"
          : "border border-border rounded-[12px] transition-colors duration-150 hover:bg-white/[0.02]",
        className
      )}
      style={NEW_LOOK_ENABLED ? style : { ...LEGACY_CARD_STYLE, ...style }}
      {...props}
    />
  )
);
Card.displayName = "Card";

/**
 * Tile — a card inside a card (new look). Radius 20, hairline only, no shadow.
 * A card is never nested more than once; the inner one is a tile.
 */
const Tile = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-2xl border border-border p-4", className)}
      {...props}
    />
  )
);
Tile.displayName = "Tile";
```

Then give the three sub-parts their new-look padding (the card itself now pads). Change only the class strings:

- `CardHeader`: `cn("p-6", className)` → `cn("p-6 next:p-0 next:pb-3", className)`
- `CardContent`: `cn("p-6 pt-0", className)` → `cn("p-6 pt-0 next:p-0", className)`
- `CardFooter`: `cn("flex items-center p-6 pt-0", className)` → `cn("flex items-center p-6 pt-0 next:p-0 next:pt-3", className)`

and export the tile: `export { Card, GlassCard, CardHeader, CardContent, CardFooter, Tile };`

- [ ] **Step 7: Restyle the badge (the tag)**

In `src/components/ui/badge.tsx`, in `badgeVariants`, change three strings and leave the rest:

- base: `"inline-flex items-center justify-center rounded-full font-medium"` → `"inline-flex items-center justify-center rounded-full font-medium next:font-[560]"`
- `default`: `"bg-surface text-foreground-secondary border border-border"` → `"bg-surface text-foreground-secondary border border-border next:border-transparent next:bg-surface-sunken"`
- `success`: `"bg-success/10 text-success border border-success/20"` → `"bg-success/10 text-success border border-success/20 next:border-transparent next:bg-above-soft next:text-above"`
- `error`: `"bg-error/10 text-error border border-error/20"` → `"bg-error/10 text-error border border-error/20 next:border-transparent next:bg-below-soft next:text-below-text"`

- [ ] **Step 8: Restyle the sheet**

In `src/components/ui/sheet.tsx` add the import under the existing ones:

```tsx
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look"
```

In `SheetOverlay`, extend the class string by appending ` next:bg-scrim` after `data-[state=open]:fade-in-0`:

```tsx
        "fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 next:bg-scrim",
```

In `SheetContent`, replace the base class string and the `side === "bottom"` string, and render the handle. The `<SheetPrimitive.Content …>` element becomes:

```tsx
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          // --z-modal (400), above its own backdrop (300) and above the chrome.
          "fixed z-[var(--z-modal)] flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500",
          // Next look (spec §4.5, §7): card surface, slides over 300ms on ease-out-quart.
          "next:bg-surface next:ease-[var(--ease-out-quart)] next:data-[state=open]:duration-300",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom next:rounded-t-4xl next:border-t-0 next:shadow-[var(--shadow-sheet)]",
          className
        )}
        {...props}
      >
        {NEW_LOOK_ENABLED && side === "bottom" && (
          <div
            data-slot="sheet-handle"
            aria-hidden
            className="mx-auto mt-2 h-[5px] w-[38px] shrink-0 rounded-full bg-foreground-muted/50"
          />
        )}
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-secondary">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
```

- [ ] **Step 9: Add the chip**

Create `src/components/ui/chip.tsx`:

```tsx
"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Give it for a filter or a choice; leave it out for a plain action ("3 more"). */
  selected?: boolean;
  /** "ground": on the page, 36 tall. "card": a quiet next step under a card, 32 tall. */
  surface?: "ground" | "card";
}

/**
 * Chip (new look, spec §7): a pill, 14px at weight 560. On the ground it is a white pill with
 * the hairline; selected it takes the action fill. Under a card it is a tint.
 */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, selected, surface = "ground", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full",
        "text-reading font-[560] leading-none text-foreground",
        "duration-150 transition-[color,background-color,box-shadow,transform] active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-40",
        surface === "card" ? "h-8 px-3" : "h-9 px-3.5",
        selected
          ? "bg-action text-action-foreground"
          : surface === "card"
            ? "bg-surface-sunken hover:bg-active"
            : "bg-surface shadow-[var(--shadow-press)]",
        className,
      )}
      {...props}
    />
  ),
);
Chip.displayName = "Chip";
```

- [ ] **Step 10: Add the icon button**

Create `src/components/ui/icon-button.tsx`:

```tsx
"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** Required: an icon button shows no text. */
  "aria-label": string;
  /** "ground": white circle on the page. "card": tint on a card. "quiet": no fill until hovered. */
  surface?: "ground" | "card" | "quiet";
}

/**
 * Icon button (new look, spec §7): a 38px circle with an 18px icon. `.tap-44` grows the hit
 * area to 44px on touch without growing the drawn circle.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, surface = "ground", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "tap-44 inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-foreground",
        "duration-150 transition-[color,background-color,box-shadow,transform] active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-40",
        surface === "ground" && "bg-surface shadow-[var(--shadow-press)]",
        surface === "card" && "bg-surface-sunken hover:bg-active",
        surface === "quiet" && "text-foreground-secondary hover:bg-hover hover:text-foreground",
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = "IconButton";
```

- [ ] **Step 11: Run all three files**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/ui/__tests__/next-look-parity.test.tsx src/components/ui/__tests__/next-look-parts.test.tsx src/components/ui/__tests__/next-look-parts.flag-on.test.tsx`

Expected: PASS. The parity file reports 27 passed and **no** "snapshots written" or "obsolete" line. If parity fails, a legacy class was changed: restore it; do not update the snapshot.

- [ ] **Step 12: Run the rest of the ui tests and the type check**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/ui && pnpm exec tsc --noEmit 2>&1 | wc -l`

Expected: PASS; the tsc line count equals the baseline.

- [ ] **Step 13: Commit**

```bash
git add src/components/ui
git -c core.hooksPath=/dev/null commit -m "feat(next-look): base parts — card and tile, button sizes and quiet, tag, sheet, chip, icon button"
```

---

### Task 4: Shell foundations

The place list and its rules (pure), the "a thread is open" signal, the thread actions the legacy sidebar keeps private, the keyboard shortcuts, and the guard that keeps colour literals out of the shell.

**Files:**
- Create: `src/components/shell/nav-config.ts`
- Create: `src/stores/shell-store.ts`
- Create: `src/components/shell/use-thread-actions.ts`
- Create: `src/components/shell/use-shell-shortcuts.ts`
- Create: `src/components/shell/__tests__/nav-config.test.ts`
- Create: `src/components/shell/__tests__/use-thread-actions.test.tsx`
- Create: `src/components/shell/__tests__/shell-guard.test.ts`
- Modify: `src/components/app/home/home-page-layout.tsx` (one import, one effect after line 97)
- Modify: `src/components/app/home/__tests__/home-page-layout.test.tsx` (one import, one `describe`)
- Modify: `src/components/__tests__/type-scale.test.ts:42` (`GUARDED_DIRS`)
- Modify: `src/components/thread/__tests__/radius-scale.test.ts:8` (`GUARDED_DIRS`)

**Interfaces:**
- Produces from `./nav-config`:
  - `type PlaceId = "home" | "discover" | "library" | "audience"`
  - `interface Place { id: PlaceId; label: string; href: string; icon: PhosphorIcon; prefixes: readonly string[]; showsBar: (pathname: string) => boolean }`
  - `PLACES: readonly Place[]` in the order Home, Discover, Library, Audience
  - `activePlace(pathname: string): PlaceId | null`
  - `tabBarVisible(pathname: string, threadOpen: boolean): boolean`
  - `backTarget(pathname: string): string`
  - `SIDE_NAV_WIDTH = 248`, `SIDE_NAV_RAIL = 56`, `RECENT_LIMIT = 6`, `SIDEBAR_STORAGE_KEY = "virtuna-sidebar"`
  - `shouldStartCollapsed(viewportWidth: number, hasStoredChoice: boolean): boolean`
- Produces from `@/stores/shell-store`: `useShellStore` with `{ threadOpen: boolean; setThreadOpen: (open: boolean) => void }`
- Produces from `./use-thread-actions`: `interface ThreadActions { newThread: () => void; openThread: (id: string) => void; deleteThread: (id: string, wasActive: boolean) => Promise<void> }`, `useThreadActions(): ThreadActions` (a stable object)
- Produces from `./use-shell-shortcuts`: `useShellShortcuts(actions: Pick<ThreadActions, "newThread">): void`

- [ ] **Step 1: Write the failing test for the place rules**

Create `src/components/shell/__tests__/nav-config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  PLACES,
  activePlace,
  backTarget,
  shouldStartCollapsed,
  tabBarVisible,
} from '../nav-config';

describe('the place list', () => {
  it('is Home, Discover, Library, Audience, in that order', () => {
    expect(PLACES.map((p) => p.label)).toEqual(['Home', 'Discover', 'Library', 'Audience']);
  });

  it('sends Discover to the hub at /feed (/discover only redirects there)', () => {
    expect(PLACES.find((p) => p.id === 'discover')?.href).toBe('/feed');
  });
});

describe('activePlace: which place is lit', () => {
  it.each([
    ['/home', 'home'],
    ['/feed', 'discover'],
    ['/feed/discover', 'discover'],
    ['/competitors', 'discover'],
    ['/discover', 'discover'],
    ['/library', 'library'],
    ['/saved', 'library'],
    ['/audience', 'audience'],
    ['/audience/new', 'audience'],
    ['/analytics', 'audience'],
    ['/grow', 'audience'],
  ] as const)('%s lights %s', (pathname, place) => {
    expect(activePlace(pathname)).toBe(place);
  });

  it('lights nothing on a screen outside the four places', () => {
    expect(activePlace('/settings')).toBeNull();
    expect(activePlace('/calendar')).toBeNull();
  });

  it('matches whole path segments, not prefixes of a word', () => {
    expect(activePlace('/feedback')).toBeNull();
    expect(activePlace('/homework')).toBeNull();
  });
});

describe('tabBarVisible: the phone tab bar', () => {
  it('shows on the four places', () => {
    for (const pathname of ['/home', '/feed', '/feed/discover', '/library', '/audience']) {
      expect(tabBarVisible(pathname, false)).toBe(true);
    }
  });

  it('hides inside a thread, where the message field is docked (never both)', () => {
    expect(tabBarVisible('/home', true)).toBe(false);
  });

  it('a thread left open on Home does not hide the bar on another place', () => {
    expect(tabBarVisible('/library', true)).toBe(true);
  });

  it('hides on pushed screens and on screens outside the places', () => {
    for (const pathname of ['/audience/new', '/library/abc', '/settings', '/saved']) {
      expect(tabBarVisible(pathname, false)).toBe(false);
    }
  });
});

describe('backTarget: where Back leads on a screen without the tab bar', () => {
  it('goes up to the place the screen belongs to', () => {
    expect(backTarget('/audience/new')).toBe('/audience');
    expect(backTarget('/library/abc')).toBe('/library');
  });

  it('goes Home from everywhere else', () => {
    expect(backTarget('/settings')).toBe('/home');
    expect(backTarget('/home')).toBe('/home');
  });
});

describe('shouldStartCollapsed: the desktop sidebar on a narrow window', () => {
  it('starts as the rail below 1100px when the creator has not chosen', () => {
    expect(shouldStartCollapsed(1099, false)).toBe(true);
    expect(shouldStartCollapsed(1100, false)).toBe(false);
  });

  it('never overrides a stored choice', () => {
    expect(shouldStartCollapsed(900, true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/shell/__tests__/nav-config.test.ts`

Expected: FAIL, cannot resolve `../nav-config`.

- [ ] **Step 3: Write the place list**

Create `src/components/shell/nav-config.ts`:

```ts
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Compass, Folder, House, Users } from "@phosphor-icons/react";

/**
 * The one place list. The phone tab bar and the desktop sidebar both read it, so the two can
 * never disagree about what the app's places are (spec §6).
 */

export type PlaceId = "home" | "discover" | "library" | "audience";

export interface Place {
  id: PlaceId;
  label: string;
  /** Where the tab or the sidebar row navigates. */
  href: string;
  icon: PhosphorIcon;
  /** Paths that light this place, redirect doors included. */
  prefixes: readonly string[];
  /** True where the phone tab bar shows. A pushed screen under a place hides it. */
  showsBar: (pathname: string) => boolean;
}

const under = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const PLACES: readonly Place[] = [
  {
    id: "home",
    label: "Home",
    href: "/home",
    icon: House,
    prefixes: ["/home"],
    showsBar: (p) => p === "/home",
  },
  {
    id: "discover",
    label: "Discover",
    // The hub lives at /feed; /discover and /competitors only redirect into it.
    href: "/feed",
    icon: Compass,
    prefixes: ["/feed", "/competitors", "/discover"],
    // The hub's own tabs are sub-paths of /feed and are still the place itself.
    showsBar: (p) => under(p, "/feed"),
  },
  {
    id: "library",
    label: "Library",
    href: "/library",
    icon: Folder,
    prefixes: ["/library", "/saved"],
    showsBar: (p) => p === "/library",
  },
  {
    id: "audience",
    label: "Audience",
    href: "/audience",
    icon: Users,
    // Analytics was folded into Audience; /analytics and /grow redirect there.
    prefixes: ["/audience", "/analytics", "/grow"],
    showsBar: (p) => p === "/audience",
  },
];

function placeFor(pathname: string): Place | undefined {
  return PLACES.find((place) => place.prefixes.some((prefix) => under(pathname, prefix)));
}

/** The place a path belongs to, or null outside the four places. */
export function activePlace(pathname: string): PlaceId | null {
  return placeFor(pathname)?.id ?? null;
}

/**
 * Whether the phone tab bar shows. On the four places only, and never inside a thread: there the
 * message field is docked, and a docked field is never stacked on a tab bar (owner, 2026-11-18).
 */
export function tabBarVisible(pathname: string, threadOpen: boolean): boolean {
  const place = PLACES.find((candidate) => candidate.showsBar(pathname));
  if (!place) return false;
  return !(place.id === "home" && threadOpen);
}

/** Where Back leads on a phone screen that has no tab bar: up to its place, else Home. */
export function backTarget(pathname: string): string {
  const place = placeFor(pathname);
  return place && pathname !== place.href ? place.href : "/home";
}

/** Desktop sidebar geometry (spec §6.2). */
export const SIDE_NAV_WIDTH = 248;
export const SIDE_NAV_RAIL = 56;
/** Threads listed under "Recent". */
export const RECENT_LIMIT = 6;
/** zustand persist key of sidebar-store; present once the creator has toggled the sidebar. */
export const SIDEBAR_STORAGE_KEY = "virtuna-sidebar";

const AUTO_COLLAPSE_BELOW = 1100;

/** Below 1100px the sidebar starts as the rail, unless the creator already chose. */
export function shouldStartCollapsed(viewportWidth: number, hasStoredChoice: boolean): boolean {
  return !hasStoredChoice && viewportWidth < AUTO_COLLAPSE_BELOW;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/shell/__tests__/nav-config.test.ts`

Expected: PASS, 23 tests.

- [ ] **Step 5: Write the guard for the shell folder**

Create `src/components/shell/__tests__/shell-guard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// The shell is the first code written for the new look, and every later surface
// copies from it. Two rules keep it honest (spec §8):
//   1. No colour literals. A hex or rgb() here would not follow the theme, and the
//      first one invites the second.
//   2. `backdropFilter` only in the tab bar. Glass is for chrome that floats over
//      content, never for cards; Lightning CSS strips it from classes, so it can only
//      appear as an inline style, which makes this greppable.
// PURE FS test (default `node` env).
// ─────────────────────────────────────────────────────────────────────────────

const SHELL = join(__dirname, '..');

const FILES = readdirSync(SHELL, { withFileTypes: true })
  .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
  .map((e) => e.name);

/** Source with comments removed, so prose like "#559" or "rgba" in a comment cannot trip it. */
function code(file: string): string {
  return readFileSync(join(SHELL, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('shell: tokens only', () => {
  it('finds the shell (guards against a walker that matches nothing)', () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it.each(FILES)('%s carries no colour literal', (file) => {
    const src = code(file);
    expect(src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(src.match(/\brgba?\(/g) ?? []).toEqual([]);
  });

  // Glass is allowed in exactly one shell file.
  it.each(FILES.filter((file) => file !== 'tab-bar.tsx'))('%s uses no glass', (file) => {
    expect(/backdropFilter/i.test(code(file))).toBe(false);
  });
});
```

Add the shell to the two existing scale guards. In `src/components/__tests__/type-scale.test.ts` change

```ts
const GUARDED_DIRS = ['app/home', 'app/settings', 'audience', 'sidebar', 'thread'] as const;
```

to

```ts
const GUARDED_DIRS = ['app/home', 'app/settings', 'audience', 'shell', 'sidebar', 'thread'] as const;
```

and in `src/components/thread/__tests__/radius-scale.test.ts` change

```ts
const GUARDED_DIRS = ['thread', 'reading'] as const;
```

to

```ts
const GUARDED_DIRS = ['thread', 'reading', 'shell'] as const;
```

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/shell/__tests__/shell-guard.test.ts src/components/__tests__/type-scale.test.ts src/components/thread/__tests__/radius-scale.test.ts`

Expected: PASS (the shell holds one clean file so far).

- [ ] **Step 6: Write the failing test for the thread actions**

Create `src/components/shell/__tests__/use-thread-actions.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/toast';
import {
  NEW_THREAD_SENTINEL,
  clearActiveThreadCookie,
  getActiveThreadCookie,
  setActiveThreadCookie,
} from '@/lib/threads/active-thread-cookie';
import { useBoardStore } from '@/stores/board-store';

// Mocked: the router and the network. Real: the board store, the cookie, the toasts.
const push = vi.fn();
let pathname = '/home';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const archive = vi.fn();
vi.mock('@/hooks/queries', () => ({
  useArchiveThread: () => ({ mutateAsync: archive }),
}));

import { useThreadActions } from '../use-thread-actions';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
const actions = () => renderHook(() => useThreadActions(), { wrapper }).result;

beforeEach(() => {
  push.mockReset();
  archive.mockReset();
  pathname = '/home';
  clearActiveThreadCookie();
  useBoardStore.setState({ activeThreadId: null });
});

describe('useThreadActions', () => {
  it('newThread leaves the open thread and lands on the blank Home', () => {
    setActiveThreadCookie('t1');
    useBoardStore.setState({ activeThreadId: 't1' });
    const result = actions();

    act(() => result.current.newThread());

    expect(useBoardStore.getState().activeThreadId).toBeNull();
    // The sentinel, not an empty cookie: without it /home re-opens the newest thread.
    expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    expect(push).toHaveBeenCalledWith('/home');
  });

  it('openThread points the app at the thread and goes Home, where threads render', () => {
    pathname = '/library';
    const result = actions();

    act(() => result.current.openThread('t2'));

    expect(useBoardStore.getState().activeThreadId).toBe('t2');
    expect(getActiveThreadCookie()).toBe('t2');
    expect(push).toHaveBeenCalledWith('/home');
  });

  it('deleting the open thread clears the pointer', async () => {
    archive.mockResolvedValue(undefined);
    setActiveThreadCookie('t1');
    useBoardStore.setState({ activeThreadId: 't1' });
    const result = actions();

    await act(() => result.current.deleteThread('t1', true));

    expect(archive).toHaveBeenCalledWith('t1');
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(getActiveThreadCookie()).toBeNull();
  });

  it('deleting another thread leaves the open one alone', async () => {
    archive.mockResolvedValue(undefined);
    setActiveThreadCookie('t1');
    useBoardStore.setState({ activeThreadId: 't1' });
    const result = actions();

    await act(() => result.current.deleteThread('t9', false));

    expect(useBoardStore.getState().activeThreadId).toBe('t1');
    expect(getActiveThreadCookie()).toBe('t1');
  });

  it('a failed delete says so and keeps the creator on the thread, which still exists', async () => {
    archive.mockRejectedValue(new Error('500'));
    setActiveThreadCookie('t1');
    useBoardStore.setState({ activeThreadId: 't1' });
    const result = actions();

    await act(() => result.current.deleteThread('t1', true));

    expect(useBoardStore.getState().activeThreadId).toBe('t1');
    expect(getActiveThreadCookie()).toBe('t1');
    expect(screen.getByText("Couldn't delete that thread.")).toBeInTheDocument();
  });

  it('returns the same object across renders, so effects that depend on it do not rebind', () => {
    const { result, rerender } = renderHook(() => useThreadActions(), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
```

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/shell/__tests__/use-thread-actions.test.tsx`

Expected: FAIL, cannot resolve `../use-thread-actions`.

- [ ] **Step 7: Write the thread actions**

Create `src/components/shell/use-thread-actions.ts`:

```ts
"use client";

import { useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useArchiveThread } from "@/hooks/queries";
import {
  NEW_THREAD_SENTINEL,
  clearActiveThreadCookie,
  setActiveThreadCookie,
} from "@/lib/threads/active-thread-cookie";
import { useBoardStore } from "@/stores/board-store";

export interface ThreadActions {
  /** Leave the open thread for a blank one. No row is created until the first message is sent. */
  newThread: () => void;
  /** Re-open a past thread where it was; only a sent message re-orders history. */
  openThread: (id: string) => void;
  /** Archive a thread. `wasActive`: it is the one open right now. */
  deleteThread: (id: string, wasActive: boolean) => Promise<void>;
}

/**
 * The thread actions of the app chrome: the same three the legacy Sidebar keeps as private
 * handlers (Sidebar.tsx is not edited while both shells exist). A thread is not a route: the
 * open one is a cookie plus a store pointer, and /home renders it.
 */
export function useThreadActions(): ThreadActions {
  const router = useRouter();
  const pathname = usePathname();
  const archiveThread = useArchiveThread();
  const { toast } = useToast();
  const switchThread = useBoardStore((s) => s.switchThread);
  const setActiveThreadId = useBoardStore((s) => s.setActiveThreadId);

  // The object below is stable; these change every render and are read at call time.
  const live = useRef({ pathname, archiveThread, toast });
  live.current = { pathname, archiveThread, toast };

  return useMemo<ThreadActions>(
    () => ({
      newThread: () => {
        // The sentinel makes /home render blank instead of re-opening the newest thread.
        setActiveThreadCookie(NEW_THREAD_SENTINEL);
        setActiveThreadId(null);
        switchThread();
        router.push("/home");
      },
      openThread: (id) => {
        setActiveThreadCookie(id);
        setActiveThreadId(id);
        switchThread();
        router.push("/home");
      },
      deleteThread: async (id, wasActive) => {
        try {
          await live.current.archiveThread.mutateAsync(id);
        } catch {
          // The optimistic removal rolls back about two seconds later. Say so, and do NOT drop
          // the pointer: the thread still exists, and dropping it would strand the creator.
          live.current.toast({ variant: "error", title: "Couldn't delete that thread." });
          return;
        }
        if (wasActive && live.current.pathname === "/home") {
          clearActiveThreadCookie();
          setActiveThreadId(null);
          switchThread();
        }
      },
    }),
    [router, setActiveThreadId, switchThread],
  );
}
```

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/shell/__tests__/use-thread-actions.test.tsx`

Expected: PASS, 6 tests. (If the last test fails because `useRouter()` returns a new object per render in the mock, that is the mock: the real router is stable. Make the mock stable instead of weakening the hook: `const router = { push, replace: vi.fn() };` and `useRouter: () => router`.)

- [ ] **Step 8: Write the shortcuts**

Create `src/components/shell/use-shell-shortcuts.ts`:

```ts
"use client";

import { useEffect } from "react";
import { useSidebarStore } from "@/stores/sidebar-store";
import type { ThreadActions } from "./use-thread-actions";

/**
 * The two chrome shortcuts the legacy Sidebar registers itself: ⌘\ collapses the sidebar,
 * ⌘N starts a new chat. (⌘K belongs to the command palette, which listens on its own.)
 */
export function useShellShortcuts(actions: Pick<ThreadActions, "newThread">): void {
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "\\") {
        e.preventDefault();
        toggleCollapsed();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        actions.newThread();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed, actions]);
}
```

(Exercised through the shell in Task 7.)

- [ ] **Step 9: Write the failing test for the signal**

In `src/components/app/home/__tests__/home-page-layout.test.tsx` add under the existing imports of app modules (next to `import { HomePageLayout } from '../home-page-layout';`):

```tsx
import { useShellStore } from '@/stores/shell-store';
```

and append at the end of the file:

```tsx
describe('HomePageLayout — tells the app shell whether a thread is open', () => {
  // The shell hides the phone tab bar inside a thread but cannot see this component's state.
  it('reports "no thread" on the empty home', () => {
    useShellStore.setState({ threadOpen: true }); // stale value from a previous screen
    renderWithClient(<HomePageLayout />);
    expect(useShellStore.getState().threadOpen).toBe(false);
  });

  it('withdraws the signal when the creator leaves Home', () => {
    renderWithClient(<HomePageLayout />);
    useShellStore.setState({ threadOpen: true }); // as if a thread had been opened
    cleanup();
    expect(useShellStore.getState().threadOpen).toBe(false);
  });
});
```

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/app/home/__tests__/home-page-layout.test.tsx`

Expected: FAIL, cannot resolve `@/stores/shell-store`.

- [ ] **Step 10: Write the store and publish the signal**

Create `src/stores/shell-store.ts`:

```ts
import { create } from 'zustand';

interface ShellState {
  /**
   * True while /home shows a thread (not the blank arrival). Published by HomePageLayout, read
   * by the new app shell, which hides the phone tab bar inside a thread. A thread is not a route,
   * so the shell cannot derive this from the URL. Not persisted.
   */
  threadOpen: boolean;
  setThreadOpen: (open: boolean) => void;
}

export const useShellStore = create<ShellState>()((set) => ({
  threadOpen: false,
  setThreadOpen: (open) => set({ threadOpen: open }),
}));
```

In `src/components/app/home/home-page-layout.tsx` add the import with the other `@/` imports:

```tsx
import { useShellStore } from "@/stores/shell-store";
```

and directly after the line `const threadMode = hasThread || rehydrating || engaged;` insert:

```tsx
  // The new app shell hides the phone tab bar while a thread is open. It cannot see this
  // component's state, so the fact is published. Nothing reads it while NEXT_PUBLIC_NEW_LOOK is off.
  useEffect(() => {
    useShellStore.getState().setThreadOpen(threadMode);
    return () => useShellStore.getState().setThreadOpen(false);
  }, [threadMode]);
```

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/app/home/__tests__/home-page-layout.test.tsx`

Expected: PASS, including the tests that were there before.

- [ ] **Step 11: Run the folder, the home tests and the type check**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/shell src/components/app/home && pnpm exec tsc --noEmit 2>&1 | wc -l`

Expected: PASS (home tests: the same failures as the baseline, if it had any); tsc equals the baseline.

- [ ] **Step 12: Commit**

```bash
git add src/components/shell src/stores/shell-store.ts src/components/app/home/home-page-layout.tsx src/components/app/home/__tests__/home-page-layout.test.tsx src/components/__tests__/type-scale.test.ts src/components/thread/__tests__/radius-scale.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(next-look): place list and rules, thread actions, shortcuts, thread-open signal, shell guard"
```

---

### Task 5: The phone tab bar

**Files:**
- Create: `src/components/shell/tab-bar.tsx`
- Create: `src/components/shell/__tests__/tab-bar.test.tsx`
- Modify: `src/app/globals.css` (one class, after `.composer-veil`)

**Interfaces:**
- Consumes: `PLACES`, `activePlace`, `Place` (Task 4); `bg-glass`, `rounded-4xl`, `--shadow-float`, `--shadow-button`, `text-micro` (Task 1).
- Produces: `TabBar({ onNewChat }: { onNewChat: () => void })`, a `<nav aria-label="Places">` that is hidden from 768px up. The caller decides when to mount it.

- [ ] **Step 1: Write the failing test**

Create `src/components/shell/__tests__/tab-bar.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

let pathname = '/home';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { TabBar } from '../tab-bar';

beforeEach(() => {
  pathname = '/home';
});

const bar = () => screen.getByRole('navigation', { name: 'Places' });
const nameOf = (el: Element) => el.getAttribute('aria-label') ?? el.textContent ?? '';

describe('TabBar', () => {
  it('holds five slots: two places, the new-chat button, two places', () => {
    render(<TabBar onNewChat={() => {}} />);
    const controls = Array.from(bar().querySelectorAll('a, button')).map(nameOf);
    expect(controls).toEqual(['Home', 'Discover', 'New chat', 'Library', 'Audience']);
  });

  it('links each tab to its place', () => {
    render(<TabBar onNewChat={() => {}} />);
    const href = (name: string) => within(bar()).getByRole('link', { name }).getAttribute('href');
    expect(href('Home')).toBe('/home');
    expect(href('Discover')).toBe('/feed');
    expect(href('Library')).toBe('/library');
    expect(href('Audience')).toBe('/audience');
  });

  it('marks the current place, and only that one', () => {
    pathname = '/feed/discover';
    render(<TabBar onNewChat={() => {}} />);
    const current = within(bar()).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map(nameOf)).toEqual(['Discover']);
  });

  it('starts a new chat from the middle button', () => {
    const onNewChat = vi.fn();
    render(<TabBar onNewChat={onNewChat} />);
    fireEvent.click(within(bar()).getByRole('button', { name: 'New chat' }));
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it('is glass: a blur as an inline style, because Lightning CSS strips it from classes', () => {
    render(<TabBar onNewChat={() => {}} />);
    expect(bar().getAttribute('style') ?? '').toContain('blur(24px)');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/shell/__tests__/tab-bar.test.tsx`

Expected: FAIL, cannot resolve `../tab-bar`.

- [ ] **Step 3: Add the fade class**

In `src/app/globals.css`, directly after the `.composer-veil { … }` rule, insert:

```css

/* ─────────────────────────────────────────────────────────────────────────────
   .tabbar-fade — the ground under the phone tab bar (new look, spec §6.1).

   A 120px band at the bottom of the screen that fades from the page colour to nothing, so
   rows leave the screen under the floating bar instead of colliding with it. A MASK on a
   `bg-background` element, for the reason `.composer-veil` gives: the page colour is stated
   once, as the token, and follows the theme. */
.tabbar-fade {
  -webkit-mask-image: linear-gradient(to top, black 0, black 24px, transparent 100%);
  mask-image: linear-gradient(to top, black 0, black 24px, transparent 100%);
}
```

- [ ] **Step 4: Write the tab bar**

Create `src/components/shell/tab-bar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { PLACES, activePlace, type Place } from "./nav-config";

/**
 * The phone tab bar (new look, spec §6.1): a floating glass pill with five slots — Home,
 * Discover, the new-chat button, Library, Audience. Shown below 768px; the frame mounts it on
 * the four places only and never inside a thread.
 *
 * Inline style on purpose: Lightning CSS strips `backdrop-filter` from classes, and the bottom
 * offset needs `env()`. Under prefers-reduced-transparency the app-wide rule removes the blur;
 * the 0.78 fill keeps the bar legible.
 */
const FLOATING: React.CSSProperties = {
  WebkitBackdropFilter: "blur(24px) saturate(1.6)",
  backdropFilter: "blur(24px) saturate(1.6)",
  bottom: "max(12px, calc(env(safe-area-inset-bottom) - 10px))",
};

function Tab({ place, active }: { place: Place; active: boolean }) {
  const Glyph = place.icon;
  return (
    <Link
      href={place.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // Each slot is at least 64 by 64: the touch target is the slot, not the icon.
        "flex h-16 min-w-16 flex-1 flex-col items-center justify-center gap-[3px]",
        "text-micro font-[560] transition-colors duration-150",
        // No pill, no dot, no fill change: the active tab is only darker.
        active ? "text-foreground" : "text-foreground-secondary",
      )}
    >
      <Glyph size={23} aria-hidden />
      <span>{place.label}</span>
    </Link>
  );
}

export function TabBar({ onNewChat }: { onNewChat: () => void }) {
  const current = activePlace(usePathname());

  return (
    <>
      <div
        aria-hidden
        className="tabbar-fade pointer-events-none fixed inset-x-0 bottom-0 z-[calc(var(--z-sidebar)-1)] h-[120px] bg-background md:hidden"
      />
      <nav
        aria-label="Places"
        style={FLOATING}
        className="fixed inset-x-3 z-[var(--z-sidebar)] flex h-16 items-center rounded-4xl bg-glass px-1.5 shadow-[var(--shadow-float)] md:hidden"
      >
        {PLACES.slice(0, 2).map((place) => (
          <Tab key={place.id} place={place} active={current === place.id} />
        ))}
        <div className="flex h-16 min-w-16 flex-1 items-center justify-center">
          <button
            type="button"
            onClick={onNewChat}
            aria-label="New chat"
            className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-action text-action-foreground shadow-[var(--shadow-button)] transition-transform duration-150 active:scale-[0.98]"
          >
            <Plus size={22} weight="bold" aria-hidden />
          </button>
        </div>
        {PLACES.slice(2).map((place) => (
          <Tab key={place.id} place={place} active={current === place.id} />
        ))}
      </nav>
    </>
  );
}
```

- [ ] **Step 5: Run the test and the guards**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/shell src/components/__tests__/type-scale.test.ts src/components/thread/__tests__/radius-scale.test.ts src/components/primitives/__tests__/command-palette-layer.test.ts`

Expected: PASS. `shell-guard` now sees `tab-bar.tsx` use glass and accepts it there only.

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/tab-bar.tsx src/components/shell/__tests__/tab-bar.test.tsx src/app/globals.css
git -c core.hooksPath=/dev/null commit -m "feat(next-look): phone tab bar — floating glass pill with four places and new chat"
```

---

### Task 6: The desktop sidebar

**Files:**
- Create: `src/components/shell/thread-row.tsx`
- Create: `src/components/shell/side-nav.tsx`
- Create: `src/components/shell/__tests__/side-nav.test.tsx`
- Modify: `src/components/shell/nav-config.ts` (add `SIDE_NAV_ORDER`)
- Modify: `src/components/shell/__tests__/nav-config.test.ts` (one test)

**Interfaces:**
- Consumes: `PLACES`, `activePlace`, `SIDE_NAV_WIDTH`, `SIDE_NAV_RAIL`, `RECENT_LIMIT`, `SIDEBAR_STORAGE_KEY`, `shouldStartCollapsed` (Task 4); `ThreadActions` (Task 4); `ComposeIcon` and the place glyphs from `./icons` (Task 5: the shell uses the reference's own icons; `Place.icon` is a `ShellIcon`, a component that takes `size` and SVG props); `IconButton` (Task 3); existing `useThreadList`, `useRenameThread`, `usePinThread`, `ThreadSummary` from `@/hooks/queries`; `useProfile`; `useSubscription`; `useSidebarStore`; `useBoardStore`; `MavenMark`; `Avatar`; `Badge`; `Tooltip*`; `DropdownMenu*`.
- Produces:
  - `SIDE_NAV_ORDER: readonly PlaceId[]` from `./nav-config`: `["home", "discover", "audience", "library"]`.
  - `ThreadRow({ thread, isActive, onOpen, onDelete, onTogglePin, onRename })`
  - `SideNav({ actions }: { actions: ThreadActions })`, a `<nav aria-label="App navigation">` hidden below 768px. Width is `SIDE_NAV_WIDTH`, or `SIDE_NAV_RAIL` when `useSidebarStore().isCollapsed`.

**Reference (measured from the v11 mock at 1440×900, light; coordinates from the sidebar's top-left corner).** The built sidebar is compared with these numbers in a browser after this task:

| Element | Box (x, y, w × h) | Type | Other |
|---|---|---|---|
| Brand row | 14, 18, 220 × 34 | "Maven" 17 / 680 | mark 26 × 26 at 22, 22, coral |
| New chat | 14, 66, 220 × 42 | 14.5 / 620 | white, hairline + soft shadow; compose glyph 17 × 17 at 26, 78.5; shortcut hint right |
| Home | 14, 120, 220 × 38 | 14.5 / 560, secondary | glyph 18 × 18 at 26, 130 |
| Discover | 14, 160, 220 × 38 | same | |
| Audience | 14, 200, 220 × 38 | same | |
| Library | 14, 240, 220 × 38 | same; current = ink on a 7% tint, radius 12 | |
| "Recent" | 26, 298, 21 tall | 12.5 / 600, muted | |
| Thread rows | 14, 327 / 363 / 399 …, 220 × 34 | 14 / 430, secondary | 2px between rows |
| Account | 14, 840, 220 × 46 | name 14.5 / 620 | avatar 30, tag right |

On desktop the reference lists the places as Home, Discover, **Audience, Library** (Library sits next to the threads it holds); the phone tab bar keeps Home, Discover, Library, Audience. Sizes that are off the type scale snap to it (14.5 → `text-ui` 15, 12.5 → `text-label` 12, 17 → `text-title` 16), as the plan's constraints say.

- [ ] **Step 1: Write the failing test**

Create `src/components/shell/__tests__/side-nav.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useBoardStore } from '@/stores/board-store';
import { useSidebarStore } from '@/stores/sidebar-store';

// Module warm-up (icons, stores, Radix) lands on the first test; see Sidebar.recent.test.tsx.
vi.setConfig({ testTimeout: 20_000 });

// Mocked: the router, the network, auth. Real: both stores, the cookie, the components.
const router = { push: vi.fn(), replace: vi.fn() };
let pathname = '/home';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));

interface Row { id: string; title: string | null; updated_at: string; created_at: string; pinned_at: string | null }
const row = (id: string, title: string | null, pinned = false): Row => ({
  id,
  title,
  updated_at: '2026-11-18T10:00:00Z',
  created_at: '2026-11-18T09:00:00Z',
  pinned_at: pinned ? '2026-11-18T09:30:00Z' : null,
});

let threads: Row[] = [];
const rename = vi.fn();
const pin = vi.fn();
const archive = vi.fn();
vi.mock('@/hooks/queries', () => ({
  useThreadList: () => ({ data: threads, isLoading: false }),
  useArchiveThread: () => ({ mutateAsync: archive }),
  useRenameThread: () => ({ mutate: rename }),
  usePinThread: () => ({ mutate: pin }),
}));

vi.mock('@/hooks/queries/use-profile', () => ({
  useProfile: () => ({ data: { name: 'Nia Test', email: 'nia@example.com', avatar: null } }),
}));

let usage: { remaining: number | null } | null = null;
vi.mock('@/hooks/use-subscription', () => ({
  useSubscription: () => ({ usage }),
}));

const signOut = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut } }),
}));

import { SideNav } from '../side-nav';
import { useThreadActions } from '../use-thread-actions';

function Harness() {
  const actions = useThreadActions();
  return <SideNav actions={actions} />;
}

const renderNav = () =>
  render(
    <ToastProvider>
      <TooltipProvider>
        <Harness />
      </TooltipProvider>
    </ToastProvider>,
  );

const nav = () => screen.getByRole('navigation', { name: 'App navigation' });
const nameOf = (el: Element) => el.getAttribute('aria-label') ?? el.textContent ?? '';

beforeEach(() => {
  pathname = '/home';
  usage = null;
  threads = [
    row('t1', null),
    row('t2', 'Three hooks for the gym video'),
    row('t3', 'Why did Tuesday flop'),
    row('t4', 'Script: morning routine', true),
    row('t5', 'Remix the 19x one'),
    row('t6', 'Ask the audience about pricing'),
    row('t7', 'Hooks for the protein video'),
    row('t8', null),
  ];
  router.push.mockReset();
  rename.mockReset();
  pin.mockReset();
  archive.mockReset();
  signOut.mockReset();
  localStorage.clear();
  useSidebarStore.setState({ isCollapsed: false });
  useBoardStore.setState({ activeThreadId: null });
});

describe('SideNav — places', () => {
  it('lists the four places in the desktop order, after the brand: Library sits next to the threads', () => {
    renderNav();
    expect(within(nav()).getAllByRole('link').map(nameOf)).toEqual([
      'Maven home', 'Home', 'Discover', 'Audience', 'Library',
    ]);
  });

  it('marks the place the creator is in, including behind a redirect door', () => {
    pathname = '/saved';
    renderNav();
    const current = within(nav()).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map(nameOf)).toEqual(['Library']);
  });
});

describe('SideNav — recent threads', () => {
  const recent = () => within(screen.getByRole('list', { name: 'Recent' })).getAllByRole('listitem');

  it('shows six at most: the newest plus titled ones; older untitled ones are noise', () => {
    renderNav();
    expect(recent()).toHaveLength(6);
    expect(recent().map((li) => within(li).getAllByRole('button')[0]?.textContent)).toEqual([
      'New chat',
      'Three hooks for the gym video',
      'Why did Tuesday flop',
      'Script: morning routine',
      'Remix the 19x one',
      'Ask the audience about pricing',
    ]);
  });

  it('opens a thread: points the app at it and goes Home', () => {
    pathname = '/library';
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'Why did Tuesday flop' }));
    expect(useBoardStore.getState().activeThreadId).toBe('t3');
    expect(router.push).toHaveBeenCalledWith('/home');
  });

  it('marks the open thread only while it is on screen (on Home)', () => {
    useBoardStore.setState({ activeThreadId: 't3' });
    const { unmount } = renderNav();
    expect(screen.getByRole('button', { name: 'Why did Tuesday flop' })).toHaveAttribute('aria-current', 'page');
    unmount();

    pathname = '/library';
    renderNav();
    expect(screen.getByRole('button', { name: 'Why did Tuesday flop' })).not.toHaveAttribute('aria-current');
  });

  it('pins, renames and deletes from the row, and delete asks twice', () => {
    archive.mockResolvedValue(undefined);
    renderNav();

    fireEvent.click(screen.getByRole('button', { name: 'Pin Why did Tuesday flop' }));
    expect(pin).toHaveBeenCalledWith({ id: 't3', pinned: true });

    fireEvent.click(screen.getByRole('button', { name: 'Rename Why did Tuesday flop' }));
    const field = screen.getByRole('textbox', { name: 'Rename Why did Tuesday flop' });
    fireEvent.change(field, { target: { value: 'Tuesday post-mortem' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(rename).toHaveBeenCalledWith({ id: 't3', title: 'Tuesday post-mortem' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete thread: Remix the 19x one' }));
    expect(archive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Remix the 19x one' }));
    expect(archive).toHaveBeenCalledWith('t5');
  });
});

describe('SideNav — new chat', () => {
  it('leaves the open thread for a blank one', () => {
    useBoardStore.setState({ activeThreadId: 't3' });
    renderNav();
    // Two buttons are named "New chat": the action, and the untitled newest thread's row.
    // The action comes first in the sidebar.
    fireEvent.click(within(nav()).getAllByRole('button', { name: 'New chat' })[0]!);
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/home');
  });
});

describe('SideNav — the rail', () => {
  it('collapses to icons, keeps every place reachable by name, and drops the thread list', () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(useSidebarStore.getState().isCollapsed).toBe(true);
    for (const name of ['Home', 'Discover', 'Library', 'Audience']) {
      expect(within(nav()).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'New chat' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Recent' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(useSidebarStore.getState().isCollapsed).toBe(false);
  });
});

describe('SideNav — the account', () => {
  it('shows the name, and the balance only when the account has one', () => {
    usage = { remaining: 3 };
    const { unmount } = renderNav();
    expect(screen.getByText('Nia Test')).toBeInTheDocument();
    expect(screen.getByText('3 left')).toBeInTheDocument();
    unmount();

    usage = { remaining: null }; // unlimited
    renderNav();
    expect(screen.queryByText(/left$/)).toBeNull();
  });

  it('keeps Settings and Log out one menu away', () => {
    renderNav();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Account menu' }), { key: 'Enter' });

    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/shell/__tests__/side-nav.test.tsx`

Expected: FAIL, cannot resolve `../side-nav`.

- [ ] **Step 3: Add the desktop order to the place config**

In `src/components/shell/__tests__/nav-config.test.ts` add `SIDE_NAV_ORDER` to the import from `../nav-config` and append:

```ts
describe('SIDE_NAV_ORDER: the desktop sidebar order', () => {
  it('is Home, Discover, Audience, Library, and names every place once', () => {
    expect(SIDE_NAV_ORDER).toEqual(['home', 'discover', 'audience', 'library']);
    expect([...SIDE_NAV_ORDER].sort()).toEqual(PLACES.map((p) => p.id).sort());
  });
});
```

Run `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/shell/__tests__/nav-config.test.ts` — expected: FAIL (`SIDE_NAV_ORDER` is not exported). Then in `src/components/shell/nav-config.ts`, after the `PLACES` array, add:

```ts
/**
 * The order of the places in the desktop sidebar. The reference puts Library last there, next to
 * the recent threads it holds; the phone tab bar keeps the order of PLACES.
 */
export const SIDE_NAV_ORDER: readonly PlaceId[] = ["home", "discover", "audience", "library"];
```

Run the file again — expected: PASS.

- [ ] **Step 3b: Write the thread row**

Create `src/components/shell/thread-row.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Check, PencilSimple, PushPin, Trash, X } from "@phosphor-icons/react";
import type { ThreadSummary } from "@/hooks/queries";
import { FOCUS_RING, cn } from "@/lib/utils";

/**
 * One thread in the desktop sidebar's "Recent" list (new look, spec §6.2): 34 tall, 14px, one
 * line. Behaviour is the legacy row's, kept on purpose:
 *
 * - Open and the row actions are SIBLING buttons (a button cannot nest in a button).
 * - Pin, rename and delete stay hidden until the row is hovered or focused, and while hidden
 *   they take no pointer events: an invisible control must not be pressable.
 * - Delete is two-step (trash, then confirm), so one stray click never drops a thread. The
 *   confirm disarms when the pointer leaves the row.
 * - Rename replaces the row with a field. Enter and blur commit, Escape cancels. An emptied
 *   field clears the title, which hands the thread back to automatic naming.
 */
const ACTION = cn(
  "flex h-7 w-7 items-center justify-center rounded-md text-foreground-secondary",
  "transition-colors duration-150 hover:bg-active hover:text-foreground",
  FOCUS_RING,
);

export function ThreadRow({
  thread,
  isActive,
  onOpen,
  onDelete,
  onTogglePin,
  onRename,
}: {
  thread: ThreadSummary;
  isActive: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onRename: (title: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const label = thread.title?.trim() || "New chat";
  const isPinned = thread.pinned_at != null;

  if (renaming) {
    return (
      <div className="flex h-[34px] items-center rounded-lg bg-surface-sunken px-3">
        <input
          autoFocus
          defaultValue={thread.title ?? ""}
          aria-label={`Rename ${label}`}
          placeholder="Thread name"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onRename(e.currentTarget.value);
              setRenaming(false);
            } else if (e.key === "Escape") {
              setRenaming(false);
            }
          }}
          onBlur={(e) => {
            onRename(e.currentTarget.value);
            setRenaming(false);
          }}
          className="w-full min-w-0 bg-transparent text-reading text-foreground outline-none placeholder:text-foreground-muted"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/row flex h-[34px] items-center rounded-lg transition-colors duration-150",
        isActive ? "bg-active" : "hover:bg-hover",
      )}
      onMouseLeave={() => setConfirming(false)}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg pl-3 pr-1 text-left text-reading",
          FOCUS_RING,
          isActive
            ? "font-[560] text-foreground"
            : "text-foreground-secondary group-hover/row:text-foreground",
        )}
      >
        {isPinned && <PushPin size={12} weight="fill" className="shrink-0" aria-hidden />}
        <span className="truncate">{label}</span>
      </button>

      {confirming ? (
        <div className="mr-1 flex items-center gap-0.5">
          <button type="button" onClick={onDelete} aria-label={`Delete ${label}`} className={cn(ACTION, "text-error hover:text-error")}>
            <Check size={14} weight="bold" aria-hidden />
          </button>
          <button type="button" onClick={() => setConfirming(false)} aria-label="Cancel delete" className={ACTION}>
            <X size={14} weight="bold" aria-hidden />
          </button>
        </div>
      ) : (
        <div
          className={cn(
            "pointer-events-none mr-1 flex items-center gap-0.5 opacity-0 transition-opacity duration-150",
            "group-hover/row:pointer-events-auto group-hover/row:opacity-100",
            "focus-within:pointer-events-auto focus-within:opacity-100",
          )}
        >
          <button
            type="button"
            onClick={onTogglePin}
            aria-label={isPinned ? `Unpin ${label}` : `Pin ${label}`}
            aria-pressed={isPinned}
            className={cn(ACTION, isPinned && "text-foreground")}
          >
            <PushPin size={14} weight={isPinned ? "fill" : "regular"} aria-hidden />
          </button>
          <button type="button" onClick={() => setRenaming(true)} aria-label={`Rename ${label}`} className={ACTION}>
            <PencilSimple size={14} aria-hidden />
          </button>
          <button type="button" onClick={() => setConfirming(true)} aria-label={`Delete thread: ${label}`} className={ACTION}>
            <Trash size={14} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write the sidebar**

Create `src/components/shell/side-nav.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GearSix, SidebarSimple, SignOut } from "@phosphor-icons/react";
import { MavenMark } from "@/components/brand/maven-logo";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePinThread, useRenameThread, useThreadList } from "@/hooks/queries";
import { useProfile } from "@/hooks/queries/use-profile";
import { useSubscription } from "@/hooks/use-subscription";
import { createClient } from "@/lib/supabase/client";
import { FOCUS_RING, cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { ComposeIcon } from "./icons";
import {
  PLACES,
  RECENT_LIMIT,
  SIDEBAR_STORAGE_KEY,
  SIDE_NAV_ORDER,
  SIDE_NAV_RAIL,
  SIDE_NAV_WIDTH,
  activePlace,
  shouldStartCollapsed,
} from "./nav-config";
import { ThreadRow } from "./thread-row";
import type { ThreadActions } from "./use-thread-actions";

/** In the rail a control shows no text, so it gets a tooltip. */
function Hint({ label, show, children }: { label: string; show: boolean; children: React.ReactElement }) {
  if (!show) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The desktop sidebar (new look, spec §6.2). 248 wide, on the ground with no fill of its own
 * and no divider: brand, New chat, the four places, Recent, the account. Collapses to a 56px
 * icon rail with the same shortcut (⌘\) and the same persisted choice as the legacy sidebar.
 * Shown from 768px up; the phone uses the tab bar.
 */
export function SideNav({ actions }: { actions: ThreadActions }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const activeThreadId = useBoardStore((s) => s.activeThreadId);
  const { data: threads } = useThreadList();
  const renameThread = useRenameThread();
  const pinThread = usePinThread();
  const { data: profile } = useProfile();
  const { usage } = useSubscription();
  const current = activePlace(pathname);

  // Below 1100px the sidebar starts as the rail, unless the creator already chose.
  useEffect(() => {
    let hasStoredChoice = true;
    try {
      hasStoredChoice = window.localStorage.getItem(SIDEBAR_STORAGE_KEY) !== null;
    } catch {
      // Storage blocked: leave the sidebar as it is.
    }
    if (shouldStartCollapsed(window.innerWidth, hasStoredChoice)) setCollapsed(true);
  }, [setCollapsed]);

  // The newest thread always shows (it may be the open, still untitled one); beyond it only
  // titled threads, because an untitled placeholder carries no signal.
  const recent = (threads ?? [])
    .filter((thread, index) => index === 0 || Boolean(thread.title?.trim()))
    .slice(0, RECENT_LIMIT);

  const name = profile?.name ?? profile?.email ?? "Account";
  const initials = profile?.name
    ? profile.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  // The existing balance (the app meters "Readings"). null = unlimited or not loaded: no tag.
  const left = usage?.remaining ?? null;

  const collapseButton = (
    <IconButton
      surface="quiet"
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      onClick={toggleCollapsed}
    >
      <SidebarSimple size={18} aria-hidden />
    </IconButton>
  );

  return (
    <nav
      aria-label="App navigation"
      style={{ width: isCollapsed ? SIDE_NAV_RAIL : SIDE_NAV_WIDTH }}
      className={cn(
        "fixed inset-y-0 left-0 z-[var(--z-sidebar)] hidden flex-col gap-0.5 pb-3.5 pt-[18px] md:flex",
        "transition-[width] duration-150 ease-[var(--ease-out-cubic)] motion-reduce:transition-none",
        isCollapsed ? "items-center px-2" : "px-3.5",
      )}
    >
      {/* Brand */}
      <div className={cn("mb-3 flex items-center", isCollapsed ? "flex-col gap-2" : "h-[34px] justify-between pl-2")}>
        <Link href="/" aria-label="Maven home" className={cn("flex items-center gap-[9px] rounded-lg text-foreground", FOCUS_RING)}>
          <MavenMark size={26} className="text-accent" />
          {!isCollapsed && <span className="text-title font-[640] tracking-[-0.02em]">Maven</span>}
        </Link>
        {collapseButton}
      </div>

      {/* New chat */}
      <Hint label="New chat" show={isCollapsed}>
        <button
          type="button"
          onClick={actions.newThread}
          // Named explicitly so a screen reader does not read the shortcut hint as part of the name.
          aria-label="New chat"
          aria-keyshortcuts="Meta+N"
          className={cn(
            "mb-2.5 flex h-[42px] shrink-0 items-center gap-[9px] rounded-xl bg-surface text-ui font-[640] text-foreground shadow-[var(--shadow-press)]",
            "transition-transform duration-150 active:scale-[0.98]",
            FOCUS_RING,
            isCollapsed ? "w-[40px] justify-center" : "px-3",
          )}
        >
          <ComposeIcon size={17} aria-hidden />
          {!isCollapsed && (
            <>
              <span>New chat</span>
              <kbd aria-hidden className="ml-auto font-sans text-label tabular-nums text-foreground-muted">⌘N</kbd>
            </>
          )}
        </button>
      </Hint>

      {/* The four places, in the desktop order */}
      {SIDE_NAV_ORDER.map((id) => {
        const place = PLACES.find((candidate) => candidate.id === id);
        if (!place) return null;
        const Glyph = place.icon;
        const active = current === place.id;
        return (
          <Hint key={place.id} label={place.label} show={isCollapsed}>
            <Link
              href={place.href}
              aria-current={active ? "page" : undefined}
              aria-label={isCollapsed ? place.label : undefined}
              className={cn(
                "flex h-[38px] shrink-0 items-center gap-[11px] rounded-lg text-ui font-[560] transition-colors duration-150",
                FOCUS_RING,
                isCollapsed ? "w-[40px] justify-center" : "px-3",
                active
                  ? "bg-active text-foreground"
                  : "text-foreground-secondary hover:bg-hover hover:text-foreground",
              )}
            >
              <Glyph size={18} aria-hidden />
              {!isCollapsed && <span className="truncate">{place.label}</span>}
            </Link>
          </Hint>
        );
      })}

      {/* Recent */}
      {!isCollapsed && recent.length > 0 && (
        <div className="mt-[18px] flex min-h-0 flex-1 flex-col gap-0.5">
          {/* 21px line + 6 below + the 2px gap put the first thread row at y 327, as in the reference. */}
          <p id="side-nav-recent" className="mb-1.5 px-3 text-label font-[560] leading-[21px] text-foreground-muted">
            Recent
          </p>
          <ul aria-labelledby="side-nav-recent" className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
            {recent.map((thread) => {
              // The open thread is on screen only on /home.
              const isActive = pathname === "/home" && thread.id === activeThreadId;
              return (
                <li key={thread.id}>
                  <ThreadRow
                    thread={thread}
                    isActive={isActive}
                    onOpen={() => actions.openThread(thread.id)}
                    onDelete={() => { void actions.deleteThread(thread.id, isActive); }}
                    onTogglePin={() => pinThread.mutate({ id: thread.id, pinned: thread.pinned_at == null })}
                    onRename={(title) => renameThread.mutate({ id: thread.id, title })}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Account */}
      <div className="mt-auto pt-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className={cn(
                "flex items-center gap-2.5 rounded-xl p-2 text-left transition-colors duration-150 hover:bg-hover",
                FOCUS_RING,
                isCollapsed ? "justify-center" : "w-full",
              )}
            >
              <Avatar src={profile?.avatar ?? undefined} alt="" fallback={initials} size="sm" className="h-[30px] w-[30px]" />
              {!isCollapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate text-ui font-[640] text-foreground">{name}</span>
                  {left !== null && <Badge className="tabular-nums">{left} left</Badge>}
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="min-w-[200px]">
            <DropdownMenuItem onSelect={() => router.push("/settings")}>
              <GearSix size={16} aria-hidden />
              Settings
            </DropdownMenuItem>
            {/* AuthGuard's auth listener owns the redirect to /login; do not navigate here too. */}
            <DropdownMenuItem onSelect={() => { void supabase.auth.signOut(); }}>
              <SignOut size={16} aria-hidden />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/shell`

Expected: PASS (side-nav: 10 tests). Two things to know if a test fails for a reason other than the component:
- `Avatar` and `DropdownMenu*` are existing parts. Open `src/components/ui/avatar.tsx` (props near line 120) and `src/components/ui/dropdown-menu.tsx` (exports at the end) and match their real prop names; do not change those files.
- If the account menu does not open on `keyDown Enter` in happy-dom, open it the way a pointer does: `fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })`. Keep the assertion (Log out calls `signOut` once).

- [ ] **Step 6: Type check and commit**

Run: `pnpm exec tsc --noEmit 2>&1 | wc -l` — expected: the baseline number.

```bash
git add src/components/shell/thread-row.tsx src/components/shell/side-nav.tsx src/components/shell/__tests__/side-nav.test.tsx
git -c core.hooksPath=/dev/null commit -m "feat(next-look): desktop sidebar — brand, new chat, places, recent threads, account, icon rail"
```

---

### Task 7: The headers, the frame, the switch

**Files:**
- Create: `src/components/shell/place-header.tsx`
- Create: `src/components/shell/pushed-header.tsx`
- Create: `src/components/app/use-command-items.tsx`
- Create: `src/components/shell/next-shell.tsx`
- Create: `src/components/shell/__tests__/next-shell.test.tsx`
- Create: `src/components/app/__tests__/app-shell.legacy.test.tsx`
- Create: `src/components/app/__tests__/app-shell.next.test.tsx`
- Modify: `src/components/app/app-shell.tsx` (whole file, shown below)
- Modify: `src/components/shell/icons.tsx` and `src/components/shell/__tests__/icons.test.tsx` (add `BackIcon`)

**Interfaces:**
- Consumes: everything from Tasks 2 to 6.
- Produces:
  - `PlaceHeader({ title, children }: { title: string; children?: React.ReactNode })`: screen title left, up to two trailing controls right.
  - `PushedHeader({ title, onBack, trailing, titleAs }: { title: string; onBack: () => void; trailing?: React.ReactNode; titleAs?: "h1" | "div" })`: 40 tall, Back left, title centred on one line, one trailing action right.
  - `useCommandItems(): CommandItem[]` from `@/components/app/use-command-items`
  - `NextShell({ children }: { children: React.ReactNode })`
  - `AppShell` unchanged for callers; it renders `NextShell` when `NEW_LOOK_ENABLED`.

- [ ] **Step 1: Write the failing shell test**

Create `src/components/shell/__tests__/next-shell.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useBoardStore } from '@/stores/board-store';
import { useShellStore } from '@/stores/shell-store';
import { useSidebarStore } from '@/stores/sidebar-store';

vi.setConfig({ testTimeout: 20_000 });

// Mocked: the router, the network, auth. Real: the stores and every shell component.
const router = { push: vi.fn(), replace: vi.fn() };
let pathname = '/library';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));

vi.mock('@/hooks/queries', () => ({
  useThreadList: () => ({
    data: [
      { id: 't1', title: 'Three hooks for the gym video', updated_at: '2026-11-18T10:00:00Z', created_at: '2026-11-18T09:00:00Z', pinned_at: null },
    ],
    isLoading: false,
  }),
  useArchiveThread: () => ({ mutateAsync: vi.fn() }),
  useRenameThread: () => ({ mutate: vi.fn() }),
  usePinThread: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/hooks/queries/use-profile', () => ({ useProfile: () => ({ data: null }) }));
vi.mock('@/hooks/use-subscription', () => ({ useSubscription: () => ({ usage: null }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut: vi.fn() } }) }));
vi.mock('@/components/app/auth-guard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { NextShell } from '../next-shell';

const renderShell = () =>
  render(
    <ToastProvider>
      <TooltipProvider>
        <NextShell>
          <p>page content</p>
        </NextShell>
      </TooltipProvider>
    </ToastProvider>,
  );

const tabBar = () => screen.queryByRole('navigation', { name: 'Places' });
const back = () => screen.queryByRole('button', { name: 'Back' });

beforeEach(() => {
  pathname = '/library';
  router.push.mockReset();
  localStorage.clear();
  useShellStore.setState({ threadOpen: false });
  useBoardStore.setState({ activeThreadId: null });
  useSidebarStore.setState({ isCollapsed: false, commandOpen: false });
});

describe('NextShell — what frames a screen', () => {
  it('renders the page inside <main>', () => {
    renderShell();
    expect(screen.getByRole('main')).toHaveTextContent('page content');
  });

  it('a place: tab bar, no Back', () => {
    renderShell();
    expect(tabBar()).not.toBeNull();
    expect(back()).toBeNull();
  });

  it('a thread: no tab bar; Back returns to the blank Home', () => {
    pathname = '/home';
    useShellStore.setState({ threadOpen: true });
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();

    expect(tabBar()).toBeNull();
    // The thread's title names the screen.
    expect(screen.getAllByText('Three hooks for the gym video').length).toBeGreaterThan(0);

    fireEvent.click(back()!);
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/home');
  });

  it('a pushed screen under a place: no tab bar; Back goes up to the place', () => {
    pathname = '/audience/new';
    renderShell();
    expect(tabBar()).toBeNull();
    fireEvent.click(back()!);
    expect(router.push).toHaveBeenCalledWith('/audience');
  });

  it('a screen outside the places: no tab bar; Back goes Home', () => {
    pathname = '/settings';
    renderShell();
    expect(tabBar()).toBeNull();
    fireEvent.click(back()!);
    expect(router.push).toHaveBeenCalledWith('/home');
  });

  it('a pushed screen keeps a new chat one tap away, in its header', () => {
    pathname = '/settings';
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();
    const header = back()!.closest('header')!;
    fireEvent.click(within(header).getByRole('button', { name: 'New chat' }));
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/home');
  });
});

describe('NextShell — keyboard', () => {
  it('⌘N starts a new chat', () => {
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();
    fireEvent.keyDown(window, { key: 'n', metaKey: true });
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/home');
  });

  it('⌘\\ collapses the sidebar, and again expands it', () => {
    renderShell();
    fireEvent.keyDown(window, { key: '\\', metaKey: true });
    expect(useSidebarStore.getState().isCollapsed).toBe(true);
    fireEvent.keyDown(window, { key: '\\', ctrlKey: true });
    expect(useSidebarStore.getState().isCollapsed).toBe(false);
  });

  it('a plain "n" typed into the page does nothing', () => {
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();
    fireEvent.keyDown(window, { key: 'n' });
    expect(useBoardStore.getState().activeThreadId).toBe('t1');
  });
});
```

- [ ] **Step 2: Write the failing switch tests**

Create `src/components/app/__tests__/app-shell.legacy.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.setConfig({ testTimeout: 20_000 });

// The flag is not set in this file: this is the production build as it is today.
vi.mock('next/navigation', () => ({
  usePathname: () => '/library',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/hooks/queries', () => ({
  useThreadList: () => ({ data: [], isLoading: false }),
  useArchiveThread: () => ({ mutateAsync: vi.fn() }),
  useRenameThread: () => ({ mutate: vi.fn() }),
  usePinThread: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/hooks/queries/use-profile', () => ({ useProfile: () => ({ data: null }) }));
vi.mock('@/hooks/use-subscription', () => ({ useSubscription: () => ({ usage: null }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut: vi.fn() } }) }));
vi.mock('@/components/app/auth-guard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { AppShell } from '../app-shell';

describe('AppShell, flag off', () => {
  it('renders the legacy shell: the drawer opener, and no tab bar', () => {
    render(
      <ToastProvider>
        <TooltipProvider>
          <AppShell>
            <p>page content</p>
          </AppShell>
        </TooltipProvider>
      </ToastProvider>,
    );
    expect(screen.getByRole('button', { name: 'Open sidebar' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Places' })).toBeNull();
    expect(screen.getByRole('main')).toHaveTextContent('page content');
  });
});
```

Create `src/components/app/__tests__/app-shell.next.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.setConfig({ testTimeout: 20_000 });

// The flag is a build-time constant; this file is the flag-on build.
vi.mock('@/lib/flags/new-look', () => ({ NEW_LOOK_ENABLED: true }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/library',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/hooks/queries', () => ({
  useThreadList: () => ({ data: [], isLoading: false }),
  useArchiveThread: () => ({ mutateAsync: vi.fn() }),
  useRenameThread: () => ({ mutate: vi.fn() }),
  usePinThread: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/hooks/queries/use-profile', () => ({ useProfile: () => ({ data: null }) }));
vi.mock('@/hooks/use-subscription', () => ({ useSubscription: () => ({ usage: null }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut: vi.fn() } }) }));
vi.mock('@/components/app/auth-guard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { AppShell } from '../app-shell';

describe('AppShell, flag on', () => {
  it('renders the new shell: the tab bar, and no drawer opener', () => {
    render(
      <ToastProvider>
        <TooltipProvider>
          <AppShell>
            <p>page content</p>
          </AppShell>
        </TooltipProvider>
      </ToastProvider>,
    );
    expect(screen.getByRole('navigation', { name: 'Places' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open sidebar' })).toBeNull();
    expect(screen.getByRole('main')).toHaveTextContent('page content');
  });
});
```

- [ ] **Step 3: Run them**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/shell/__tests__/next-shell.test.tsx src/components/app/__tests__/app-shell.legacy.test.tsx src/components/app/__tests__/app-shell.next.test.tsx`

Expected: `next-shell` FAILS (cannot resolve `../next-shell`). `app-shell.legacy` PASSES already: it pins today's behaviour before the file is touched. `app-shell.next` FAILS (no navigation named "Places").

- [ ] **Step 4: Write the two headers**

The pushed header follows the reference, measured on the mock's Account and thread screens at 393 wide: a 40px row with 16px side padding; Back is a white round button, 38 × 38, at the left edge, with the reference's chevron (18px); the title is centred, 16 / 640, one line; the trailing control is the same round button with the compose glyph, at the right edge.

First add the chevron to the shell's glyphs. In `src/components/shell/icons.tsx` add:

```tsx
/** Back, on a pushed screen: the reference's chevron. */
export const BackIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="m14.5 6-6 6 6 6" />
  </Glyph>
);
```

and add `BackIcon` to the list of glyphs that `src/components/shell/__tests__/icons.test.tsx` runs over (run that file: it passes with one more case).

Create `src/components/shell/place-header.tsx`:

```tsx
/**
 * Place header (new look, spec §6.1): the screen title on the left, up to two trailing controls
 * on the right. Used by the four places. On desktop the title sits 44px from the top.
 */
export function PlaceHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pb-4 pt-2 md:pt-11">
      <h1 className="text-3xl font-bold leading-[35px] tracking-[-0.035em] text-foreground">{title}</h1>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </header>
  );
}
```

Create `src/components/shell/pushed-header.tsx`:

```tsx
"use client";

import { IconButton } from "@/components/ui/icon-button";
import { BackIcon } from "./icons";

/**
 * Pushed header (new look, spec §6.1): 40 tall. Back on the left, the title centred on one
 * line (it truncates), one trailing action on the right. Used by every screen that is pushed
 * on top of a place: a thread, a result, a video, settings.
 *
 * As in the reference: both controls are white round buttons (38px, hairline and a soft
 * shadow) with an 18px glyph; the title is 16 / 640.
 *
 * `titleAs="div"` where the screen below already has its own <h1> (the thread has one).
 */
export function PushedHeader({
  title,
  onBack,
  trailing,
  titleAs: Title = "h1",
}: {
  title: string;
  onBack: () => void;
  trailing?: React.ReactNode;
  titleAs?: "h1" | "div";
}) {
  return (
    <header className="grid h-10 grid-cols-[40px_minmax(0,1fr)_40px] items-center">
      <IconButton aria-label="Back" onClick={onBack}>
        <BackIcon aria-hidden />
      </IconButton>
      <Title className="truncate text-center text-title font-[640] text-foreground">{title}</Title>
      <div className="flex justify-end">{trailing}</div>
    </header>
  );
}
```

- [ ] **Step 5: Move the ⌘K items into a hook**

Both shells mount the same command palette. Create `src/components/app/use-command-items.tsx` by **moving** code out of `src/components/app/app-shell.tsx`, unchanged: the `rtf` constant and the `relativeTime` function (lines 19–37), and the two `useMemo` blocks `threadItems` and `commandItems` (lines 78–139). The file reads:

```tsx
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChatCircleText, Plus, SlidersHorizontal, UsersThree } from "@phosphor-icons/react";
import type { CommandItem } from "@/components/primitives/CommandPalette";
import { useThreadList } from "@/hooks/queries";
import {
  clearActiveThreadCookie,
  setActiveThreadCookie,
} from "@/lib/threads/active-thread-cookie";
import { useBoardStore } from "@/stores/board-store";

/** Compact relative time for a thread row's subtitle ("3d", "2mo"). */
const rtf =
  typeof Intl !== "undefined"
    ? new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "narrow" })
    : null;

function relativeTime(iso: string | undefined): string {
  if (!iso || !rtf) return "";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  const diffSec = (parsed - Date.now()) / 1000;
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), "month");
  return rtf.format(Math.round(diffSec / 31536000), "year");
}

/**
 * The items of the ⌘K palette: threads first (the only thing here that grows without bound),
 * then the actions and destinations. Shared by the legacy shell and the new shell.
 */
export function useCommandItems(): CommandItem[] {
  const router = useRouter();
  const { data: threads } = useThreadList();
  const switchThread = useBoardStore((s) => s.switchThread);
  const setActiveThreadId = useBoardStore((s) => s.setActiveThreadId);

  // The first version listed only Home / Audience / Settings / New audience, and
  // was rightly called out as pointless: every one of those is already visible in
  // a two-item sidebar, so the palette navigated you to things you could already
  // see. Threads are the only thing here that grows without bound and cannot be
  // scanned at a glance — they are what a search is FOR, and they are what the
  // trigger on the Threads header promises.
  //
  // Destinations stay, demoted below the threads: they cost nothing and they make
  // typing "set" resolve, but they are no longer the payload.
  const threadItems = useMemo<CommandItem[]>(
    () =>
      (threads ?? []).map((t) => ({
        id: `thread-${t.id}`,
        title: t.title ?? "New chat",
        subtitle: relativeTime(t.updated_at),
        group: "Threads",
        icon: <ChatCircleText size={16} />,
        // Same path the sidebar rows take — cookie, store pointer, switch, /home.
        // Anything less leaves the composer pointing at the previous thread.
        onSelect: () => {
          setActiveThreadCookie(t.id);
          setActiveThreadId(t.id);
          switchThread();
          router.push("/home");
        },
      })),
    [threads, router, setActiveThreadId, switchThread],
  );

  const commandItems = useMemo<CommandItem[]>(
    () => [
      ...threadItems,
      {
        id: "new-thread",
        title: "New thread",
        subtitle: "Start a fresh conversation",
        group: "Actions",
        icon: <Plus size={16} />,
        onSelect: () => {
          clearActiveThreadCookie();
          setActiveThreadId(null);
          switchThread();
          router.push("/home");
        },
      },
      {
        id: "new-audience",
        title: "New audience",
        subtitle: "Calibrate from a handle, an account, or a description",
        group: "Actions",
        icon: <UsersThree size={16} />,
        onSelect: () => router.push("/audience/new"),
      },
      {
        id: "audience",
        title: "Audience",
        subtitle: "Your calibrated audiences",
        group: "Go to",
        icon: <UsersThree size={16} />,
        onSelect: () => router.push("/audience"),
      },
      {
        id: "settings",
        title: "Settings",
        group: "Go to",
        icon: <SlidersHorizontal size={16} />,
        onSelect: () => router.push("/settings"),
      },
    ],
    [threadItems, router, setActiveThreadId, switchThread],
  );

  return commandItems;
}
```

This is the code as it stands in `app-shell.tsx` today; if that file changed on `main` since, move what is there rather than this copy.

- [ ] **Step 6: Write the frame**

Create `src/components/shell/next-shell.tsx`:

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/app/auth-guard";
import { useCommandItems } from "@/components/app/use-command-items";
import { CommandPalette } from "@/components/primitives/CommandPalette";
import { MOBILE_NAV_BAND } from "@/components/sidebar/Sidebar";
import { useThreadList } from "@/hooks/queries";
import { useIsMobileHydrated } from "@/hooks/useIsMobile";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useThemeSync } from "@/lib/theme/use-theme";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { IconButton } from "@/components/ui/icon-button";
import { ComposeIcon } from "./icons";
import { SIDE_NAV_RAIL, SIDE_NAV_WIDTH, backTarget, tabBarVisible } from "./nav-config";
import { PushedHeader } from "./pushed-header";
import { SideNav } from "./side-nav";
import { TabBar } from "./tab-bar";
import { useShellShortcuts } from "./use-shell-shortcuts";
import { useThreadActions } from "./use-thread-actions";

/**
 * The app frame of the new look (spec §6). Desktop: the sidebar, content beside it. Phone: the
 * tab bar on the four places; on every other screen a Back header instead, because with the
 * drawer gone a screen without the bar would be a dead end. A thread hides the bar: its message
 * field is docked, and the two are never stacked.
 *
 * Legacy pages still render inside this frame until their own build part replaces them. They
 * were laid out against the legacy phone top band (`--mobile-nav-band`, which the composer
 * cancels with a negative margin), so <main> keeps that band exactly; the Back header sits in it.
 */
export function NextShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const actions = useThreadActions();
  const commandItems = useCommandItems();
  const threadOpen = useShellStore((s) => s.threadOpen);
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const commandOpen = useSidebarStore((s) => s.commandOpen);
  const setCommandOpen = useSidebarStore((s) => s.setCommandOpen);
  const activeThreadId = useBoardStore((s) => s.activeThreadId);
  const { data: threads } = useThreadList();
  const { isMobile, hydrated } = useIsMobileHydrated();
  const reducedMotion = usePrefersReducedMotion();
  useShellShortcuts(actions);
  useThemeSync();

  const inThread = pathname === "/home" && threadOpen;
  const showBar = tabBarVisible(pathname, threadOpen);
  const threadTitle = threads?.find((t) => t.id === activeThreadId)?.title?.trim() || "New chat";

  // Until the viewport is measured assume desktop, as the legacy shell does, so the first paint
  // does not start at 0 and jump by the sidebar's width.
  const treatAsMobile = hydrated && isMobile;
  const offset = treatAsMobile ? 0 : isCollapsed ? SIDE_NAV_RAIL : SIDE_NAV_WIDTH;

  return (
    <AuthGuard>
      <div className="h-screen overflow-hidden bg-background">
        <SideNav actions={actions} />

        {!showBar && (
          <div className="fixed inset-x-0 top-0 z-[var(--z-sidebar)] bg-background px-4 pb-[3px] pt-[calc(env(safe-area-inset-top)+3px)] md:hidden">
            <PushedHeader
              // A thread's title names the screen; other screens carry their own heading.
              title={inThread ? threadTitle : ""}
              titleAs="div"
              onBack={inThread ? actions.newThread : () => router.push(backTarget(pathname))}
              // As in the reference: a new chat is one tap away on every pushed screen.
              trailing={
                <IconButton aria-label="New chat" onClick={actions.newThread}>
                  <ComposeIcon aria-hidden />
                </IconButton>
              }
            />
          </div>
        )}

        <main
          className={cn(
            "relative h-full overflow-auto pt-[calc(env(safe-area-inset-top)+var(--mobile-nav-band))] md:pt-0",
            // Content clears the floating bar: 104px plus the safe area (spec §6.1).
            showBar && "max-md:pb-[calc(104px+env(safe-area-inset-bottom))]",
          )}
          style={
            {
              marginLeft: `${offset}px`,
              "--mobile-nav-band": `${MOBILE_NAV_BAND}px`,
              transition: reducedMotion ? undefined : "margin-left 150ms var(--ease-out-cubic)",
            } as React.CSSProperties
          }
        >
          {children}
        </main>

        {showBar && <TabBar onNewChat={actions.newThread} />}

        <CommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          items={commandItems}
          placeholder="Search threads…"
        />
      </div>
    </AuthGuard>
  );
}
```

- [ ] **Step 7: Make `app-shell.tsx` pick a shell**

Replace `src/components/app/app-shell.tsx` with the following. `LegacyShell` is today's `AppShell` body, unchanged except that the palette items now come from the hook:

```tsx
"use client";

import { AuthGuard } from "./auth-guard";
import { useCommandItems } from "./use-command-items";
import { Sidebar, SidebarHamburger, MOBILE_NAV_BAND } from "@/components/sidebar/Sidebar";
import { CommandPalette } from "@/components/primitives/CommandPalette";
import { NextShell } from "@/components/shell/next-shell";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useIsMobileHydrated } from "@/hooks/useIsMobile";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Picks the app frame. With NEXT_PUBLIC_NEW_LOOK on it is the new shell
 * (src/components/shell); otherwise the legacy shell below, exactly as before.
 */
export function AppShell({ children }: AppShellProps) {
  return NEW_LOOK_ENABLED ? <NextShell>{children}</NextShell> : <LegacyShell>{children}</LegacyShell>;
}

// Sidebar geometry — kept in sync with Sidebar.tsx.
//
// The sidebar is now FLUSH to the window edge (2026-07-28), so the content offset
// is simply its width: no `left-3` inset to add, and no gutter to clear a floating
// card's right edge. Both used to be 12px, which is why this was 244 for a 220px
// panel. Content now begins exactly where the sidebar's hairline ends, as it does
// in Linear and Attio.
const SIDEBAR_EXPANDED = 220;
const SIDEBAR_RAIL = 56;
const SIDEBAR_INSET = 0;
const CONTENT_GUTTER = 0;

function LegacyShell({ children }: AppShellProps) {
  const { isCollapsed, commandOpen, setCommandOpen } = useSidebarStore();
  const { isMobile, hydrated } = useIsMobileHydrated();
  const reducedMotion = usePrefersReducedMotion();
  // ⌘K searches THREADS. The palette mounts here, as a sibling of <main> and outside <Sidebar>,
  // on purpose: the sidebar <nav> animates with translate-x, and a transformed ancestor re-bases
  // `position: fixed` onto itself — mounting the palette inside it would trap the overlay in a
  // 220px column. The items live in use-command-items.tsx, shared with the new shell.
  const commandItems = useCommandItems();

  // Mobile (D-15): the sidebar is an overlay drawer — content does not shift.
  // Desktop (D-14): content shifts right by the real sidebar width.
  // WR-03: until the viewport is measured (`hydrated`), assume DESKTOP — the
  // dominant app context — so the first paint starts at the sidebar offset
  // instead of 0px and then snapping 244px right once `useIsMobile` corrects.
  // (Mobile is the post-mount correction; an extra ~244px gutter for one frame
  // on a real phone is invisible because the drawer is an overlay anyway.)
  const treatAsMobile = hydrated && isMobile;
  const sidebarWidth = isCollapsed ? SIDEBAR_RAIL : SIDEBAR_EXPANDED;
  const offset = treatAsMobile ? 0 : SIDEBAR_INSET + sidebarWidth + CONTENT_GUTTER;

  return (
    <AuthGuard>
      <div className="h-screen overflow-hidden bg-background">
        <SidebarHamburger />
        <Sidebar />
        <main
          // Mobile reserves the top-nav band so no page renders under the fixed opener tab
          // (Sidebar.tsx). It is sized FROM that tab's own geometry — 55px, not a hand-tuned 56 that
          // drifts the next time the tab changes shape. /home cancels it and puts the audience bar
          // in the band instead (composer.tsx); every other page just starts below it.
          // Pure CSS at the same 768px boundary as the tab's `md:hidden` — it used to ride the
          // JS `treatAsMobile`, which is false until the post-mount measurement, so the pad landed
          // one frame late and anything offsetting against it jumped.
          // marginLeft stays inline: it depends on the real sidebar width, which CSS can't know.
          // The band rides a custom PROPERTY, not an inline paddingTop: an inline padding would
          // outrank `md:pt-0` and the desktop would keep the mobile band forever.
          className="relative h-full overflow-auto pt-[calc(env(safe-area-inset-top)+var(--mobile-nav-band))] md:pt-0"
          style={
            {
              marginLeft: `${offset}px`,
              "--mobile-nav-band": `${MOBILE_NAV_BAND}px`,
              transition: reducedMotion ? undefined : "margin-left 150ms var(--ease-out-cubic)",
            } as React.CSSProperties
          }
        >
          {children}
        </main>
        <CommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          items={commandItems}
          placeholder="Search threads…"
        />
      </div>
    </AuthGuard>
  );
}
```

- [ ] **Step 8: Run the tests**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/shell src/components/app/__tests__ src/components/sidebar`

Expected: PASS. `next-shell`: 8 tests. Both `app-shell` files pass. The legacy sidebar's own tests pass untouched.

- [ ] **Step 9: Type check, lint the touched files, check the legacy file was not edited**

```bash
pnpm exec tsc --noEmit 2>&1 | wc -l                                   # the baseline number
pnpm exec eslint src/components/shell src/components/app/app-shell.tsx src/components/app/use-command-items.tsx src/lib/theme src/components/ui/chip.tsx src/components/ui/icon-button.tsx
git diff --stat main -- src/components/sidebar/Sidebar.tsx              # prints nothing
```

Expected: no eslint errors in these files; the last command prints nothing.

- [ ] **Step 10: Commit**

```bash
git add src/components/shell src/components/app/app-shell.tsx src/components/app/use-command-items.tsx src/components/app/__tests__/app-shell.legacy.test.tsx src/components/app/__tests__/app-shell.next.test.tsx
git -c core.hooksPath=/dev/null commit -m "feat(next-look): the new app frame behind the flag — headers, tab bar or sidebar, Back on pushed screens"
```

---

### Task 8: The Appearance setting

**Files:**
- Create: `src/components/app/settings/appearance-setting.tsx`
- Create: `src/components/app/settings/__tests__/appearance-setting.test.tsx`
- Modify: `src/components/app/settings/settings-page.tsx:95-98` (the "account" tab)

**Interfaces:**
- Consumes: `useThemeChoice`, `ThemeChoice`, `THEME_STORAGE_KEY` (Task 2); `Chip` (Task 3); `NEW_LOOK_ENABLED` (Task 2).
- Produces: `AppearanceSetting()`, mounted in Settings → Account only when the flag is on.

- [ ] **Step 1: Write the failing test**

Create `src/components/app/settings/__tests__/appearance-setting.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { THEME_STORAGE_KEY } from '@/lib/theme/theme';
import { AppearanceSetting } from '../appearance-setting';

function systemPrefersDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query.includes('prefers-color-scheme: dark'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

const painted = () => document.documentElement.getAttribute('data-theme');
const group = () => screen.getByRole('group', { name: 'Appearance' });
const option = (name: string) => within(group()).getByRole('button', { name });
const chosen = () =>
  within(group()).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', 'light');
  systemPrefersDark(false);
});

afterEach(() => vi.unstubAllGlobals());

describe('AppearanceSetting', () => {
  it('offers Light, Dark and Match system, with Light chosen at first', () => {
    render(<AppearanceSetting />);
    expect(within(group()).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Light', 'Dark', 'Match system',
    ]);
    expect(chosen()).toEqual(['Light']);
  });

  it('Dark paints the app dark at once and is remembered', () => {
    render(<AppearanceSetting />);
    fireEvent.click(option('Dark'));
    expect(painted()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(chosen()).toEqual(['Dark']);
  });

  it('Match system follows the system, and remembers the choice rather than its result', () => {
    systemPrefersDark(true);
    render(<AppearanceSetting />);
    fireEvent.click(option('Match system'));
    expect(painted()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    expect(chosen()).toEqual(['Match system']);
  });

  it('opens on the stored choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<AppearanceSetting />);
    expect(chosen()).toEqual(['Dark']);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/app/settings/__tests__/appearance-setting.test.tsx`

Expected: FAIL, cannot resolve `../appearance-setting`.

- [ ] **Step 3: Write the setting**

Create `src/components/app/settings/appearance-setting.tsx`:

```tsx
"use client";

import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Monitor, Moon, Sun } from "@phosphor-icons/react";
import { Chip } from "@/components/ui/chip";
import type { ThemeChoice } from "@/lib/theme/theme";
import { useThemeChoice } from "@/lib/theme/use-theme";

const OPTIONS: readonly { value: ThemeChoice; label: string; icon: PhosphorIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Match system", icon: Monitor },
];

/**
 * Appearance (new look, spec §5): Light (default), Dark, or Match system. Kept in this
 * browser (localStorage "maven-theme"); it is not synced to the account yet. The choice
 * applies at once, with no save button.
 */
export function AppearanceSetting() {
  const [choice, setChoice] = useThemeChoice();

  return (
    <section className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-rest)]">
      <h3 id="appearance-heading" className="text-title font-[640] text-foreground">
        Appearance
      </h3>
      <div role="group" aria-labelledby="appearance-heading" className="mt-3 flex flex-wrap gap-2">
        {OPTIONS.map(({ value, label, icon: Glyph }) => (
          <Chip
            key={value}
            surface="card"
            selected={choice === value}
            onClick={() => setChoice(value)}
          >
            <Glyph size={16} aria-hidden />
            {label}
          </Chip>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Mount it in Settings, under the flag**

In `src/components/app/settings/settings-page.tsx` add the imports next to the other section imports:

```tsx
import { AppearanceSetting } from "./appearance-setting";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
```

and change the "account" tab from

```tsx
          <Tabs.Content value="account" className="outline-none">
            <AccountSection />
            <Credits />
          </Tabs.Content>
```

to

```tsx
          <Tabs.Content value="account" className="outline-none">
            <AccountSection />
            <Credits />
            {/* The legacy look has one theme; the choice exists only under the new look. */}
            {NEW_LOOK_ENABLED && (
              <div className="mt-8">
                <AppearanceSetting />
              </div>
            )}
          </Tabs.Content>
```

- [ ] **Step 5: Run the tests and the guards**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/app/settings src/components/__tests__/type-scale.test.ts && pnpm exec tsc --noEmit 2>&1 | wc -l`

Expected: PASS (appearance-setting: 4 tests; `app/settings` is a guarded folder for type sizes and stays clean); tsc equals the baseline.

- [ ] **Step 6: Commit**

```bash
git add src/components/app/settings/appearance-setting.tsx src/components/app/settings/__tests__/appearance-setting.test.tsx src/components/app/settings/settings-page.tsx
git -c core.hooksPath=/dev/null commit -m "feat(next-look): Appearance setting — Light, Dark, Match system"
```

---

### Task 9: Verify against "Done when"

Nothing is called done from tests alone. This task runs the whole suite, builds, and looks at the app in a browser, flag off and flag on. Report every number and attach the screenshots you looked at.

**Files:**
- Create: `scripts/next-look-thread-check.cjs`
- Output (gitignored): `.scratch/next-look/final-*/`

**Interfaces:**
- Consumes: the probe and comparer (Task 0), the baseline in `.scratch/next-look/baseline/`.

- [ ] **Step 1: The whole suite, against the baseline**

```bash
cd ~/virtuna-next-look
NODE_OPTIONS=--no-experimental-webstorage pnpm test > .scratch/next-look/final-vitest.txt 2>&1; tail -8 .scratch/next-look/final-vitest.txt
tail -8 .scratch/next-look/baseline/vitest.txt
pnpm exec tsc --noEmit 2>&1 | wc -l
```

Expected: no test file fails that passed in the baseline; the passed count is higher by the tests this plan added; tsc equals the baseline. A test that fails now and passed before is yours: fix the code, not the test.

- [ ] **Step 2: The build**

```bash
cd ~/virtuna-next-look && lsof -ti:3021 | xargs -r kill; df -h / | tail -1
pnpm build 2>&1 | tail -15
```

Expected: "Compiled successfully" and the route table. If free disk is under 2 GB before the build, stop and ask the owner.

- [ ] **Step 3: Flag off — the app is unchanged**

```bash
cd ~/virtuna-next-look && (NODE_OPTIONS='--max-old-space-size=2048 --no-experimental-webstorage' node node_modules/next/dist/bin/next dev --turbopack --port 3021 > .scratch/next-look/dev.log 2>&1 &)
sleep 12
cd ~/virtuna-v1.1 && scripts/run-with-env.sh node_modules/.bin/tsx .scratch/platform-concept-probes/zz-mint-cookie.ts ~/virtuna-next-look/.scratch/next-look/cookie.json
cd ~/virtuna-next-look
node scripts/next-look-probe.cjs --base http://localhost:3021 --cookies .scratch/next-look/cookie.json --out .scratch/next-look/final-off
node scripts/next-look-compare.cjs .scratch/next-look/baseline .scratch/next-look/final-off; echo "exit $?"
kill $(lsof -ti:3021)
```

Expected: six `ok` lines and `exit 0`: every token value, the `<html>` attributes, the landmarks and the body background are the same as before this work. For each `LOOK` line, Read both PNGs (`baseline/<name>` and `final-off/<name>`) and say what differs; a changed thread title is acceptable, a changed shape or colour is a failure.

- [ ] **Step 4: Flag on — light, dark, more contrast, less transparency**

```bash
cd ~/virtuna-next-look && (NEXT_PUBLIC_NEW_LOOK=true NODE_OPTIONS='--max-old-space-size=2048 --no-experimental-webstorage' node node_modules/next/dist/bin/next dev --turbopack --port 3021 > .scratch/next-look/dev.log 2>&1 &)
sleep 12
P="node scripts/next-look-probe.cjs --base http://localhost:3021 --cookies .scratch/next-look/cookie.json --chrome-width 248"
$P --out .scratch/next-look/final-light
$P --out .scratch/next-look/final-dark --theme dark
$P --out .scratch/next-look/final-system --theme system
$P --out .scratch/next-look/final-contrast --contrast more
$P --out .scratch/next-look/final-solid --reduced-transparency
```

Expected, from the lines the probe prints:

| Run | `html` | Phone landmarks | Desktop landmarks | Body background |
|---|---|---|---|---|
| light | `look: next, theme: light, colorScheme: light` | `tabBar: true, burger: false` on all three routes (`/home` shows `back: true, tabBar: false` instead if the account lands in a thread) | `appNav: true, tabBar: false` | `rgb(244, 243, 240)` |
| dark | `theme: dark, colorScheme: dark` | same | same | `rgb(8, 8, 10)` |
| system | `theme: light` (the headless browser reports a light system) | same | same | `rgb(244, 243, 240)` |

Then check two values by hand:

```bash
node -e 'const t=require("./.scratch/next-look/final-contrast/library-desk.json").tokens; console.log(t["--color-border"], "|", t["--color-foreground-muted"])'
node -e 'const t=require("./.scratch/next-look/final-light/library-desk.json").tokens; console.log(t["--color-border"], "|", t["--focus-ring"], "|", t["--shadow-button"])'
```

Expected: first line `rgba(17, 17, 16, 0.2) | rgba(18, 18, 17, 0.6)` (hairlines and muted text step up under more contrast). Second line `rgba(17, 17, 16, 0.06) | #121211 | inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 10px 20px -10px rgba(0, 0, 0, 0.45)`.

- [ ] **Step 5: Look at it, next to the mocks**

Read each pair and write down every difference in the chrome (the page content is legacy and will differ; that is expected):

| App | Mock |
|---|---|
| `.scratch/next-look/final-light/library-phone.png` | `~/virtuna-v1.1/.scratch/app-screens/renders/a-light-phone-lib-ma.png` |
| `.scratch/next-look/final-light/library-desk.png` | `~/virtuna-v1.1/.scratch/app-screens/renders/a-light-desk-lib.png` |
| `.scratch/next-look/final-dark/library-phone.png` | `~/virtuna-v1.1/.scratch/app-screens/renders/a-dark-phone-lib-ma.png` |
| `.scratch/next-look/final-dark/library-desk.png` | `~/virtuna-v1.1/.scratch/app-screens/renders/a-dark-desk-lib.png` |

Also read `final-light/library-phone-bottom.png`, `final-contrast/library-phone-bottom.png` and `final-solid/library-phone-bottom.png`: the tab bar must be legible in all three, with five slots, the ink circle in the middle, and labels not clipped.

Check against the spec: tab bar 12px from the sides, 64 tall, radius 32, glass; new-chat circle 50; sidebar 248 wide with no fill and no divider; New chat row 42 tall on white; place rows 38 tall, the current one tinted; "Recent" with at most six rows; account at the bottom. Fix what is wrong in the component, re-run its tests, re-probe, and look again. The spec's §11 lists four values that were changed from the mocks on purpose (muted grey 46%, radii 24 / 20 / 16, four weights); report whether any of them looks wrong, do not change them silently.

- [ ] **Step 6: The thread hides the bar; Back brings it back**

Create `scripts/next-look-thread-check.cjs`:

```js
#!/usr/bin/env node
/* node scripts/next-look-thread-check.cjs <baseUrl> <cookie.json>
 *
 * Flag-on check that cannot be done from a single page load: opening a thread hides the phone
 * tab bar and shows Back; Back returns to the blank Home and the bar. Needs the account to have
 * at least one titled thread. */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");

const [base, cookieFile] = process.argv.slice(2);
if (!base || !cookieFile) {
  console.error("usage: next-look-thread-check.cjs <baseUrl> <cookie.json>");
  process.exit(2);
}

const shown = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none";
  }, sel);

(async () => {
  const host = new URL(base).hostname;
  const cookies = JSON.parse(fs.readFileSync(cookieFile, "utf8")).map((c) => ({ ...c, domain: host, path: "/" }));
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(cookies);
  const page = await context.newPage();
  const failures = [];
  const expect = (label, actual, wanted) => {
    console.log(`${actual === wanted ? "ok  " : "FAIL"} ${label}: ${actual}`);
    if (actual !== wanted) failures.push(label);
  };

  // Desktop: open the first titled thread from "Recent".
  await page.goto(`${base}/library`, { waitUntil: "domcontentloaded" });
  const first = page.locator('nav[aria-label="App navigation"] ul li button[aria-current], nav[aria-label="App navigation"] ul li button').first();
  await first.waitFor({ timeout: 60_000 });
  await first.click();
  await page.waitForURL(/\/home$/, { timeout: 30_000 });
  await page.waitForTimeout(4000);

  // Phone: the same session now lands in that thread.
  await page.setViewportSize({ width: 393, height: 852 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("main", { timeout: 60_000 });
  await page.waitForTimeout(4000);
  expect("in a thread: tab bar hidden", await shown(page, 'nav[aria-label="Places"]'), false);
  expect("in a thread: Back shown", await shown(page, 'button[aria-label="Back"]'), true);
  await page.screenshot({ path: ".scratch/next-look/final-thread-phone.png", animations: "disabled", caret: "hide", timeout: 20_000 }).catch(() => {});

  await page.click('button[aria-label="Back"]');
  await page.waitForTimeout(2500);
  expect("after Back: tab bar shown", await shown(page, 'nav[aria-label="Places"]'), true);
  expect("after Back: Back gone", await shown(page, 'button[aria-label="Back"]'), false);

  // A screen outside the places: Back leads Home.
  await page.goto(`${base}/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main", { timeout: 60_000 });
  await page.waitForTimeout(1500);
  expect("settings: tab bar hidden", await shown(page, 'nav[aria-label="Places"]'), false);
  await page.click('button[aria-label="Back"]');
  await page.waitForURL(/\/home$/, { timeout: 30_000 });
  expect("settings: Back leads Home", new URL(page.url()).pathname, "/home");

  await browser.close();
  process.exit(failures.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Run: `node scripts/next-look-thread-check.cjs http://localhost:3021 .scratch/next-look/cookie.json; echo "exit $?"`

Expected: six `ok` lines, `exit 0`. Read `.scratch/next-look/final-thread-phone.png`: the Back header sits at the top, the legacy message field is docked at the bottom, no tab bar.

- [ ] **Step 7: Theme and keyboard, by hand in the same server**

Run this check and read its output:

```bash
node -e '
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
(async () => {
  const base = "http://localhost:3021";
  const cookies = JSON.parse(fs.readFileSync(".scratch/next-look/cookie.json", "utf8")).map((c) => ({ ...c, domain: "localhost", path: "/" }));
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(cookies);
  const page = await context.newPage();
  const theme = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));

  // Appearance: choose Dark, reload, it is dark when the document is parsed and stays dark.
  await page.goto(base + "/settings", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  console.log("after choosing Dark:", await theme());
  await page.reload({ waitUntil: "domcontentloaded" });
  console.log("on reload, document parsed:", await theme());
  await page.waitForTimeout(3000);
  console.log("on reload, after hydration:", await theme());
  await page.getByRole("tab", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  console.log("after choosing Light:", await theme());

  // Keyboard: every shell control is reachable and shows a ring.
  await page.goto(base + "/library", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("nav[aria-label=\"App navigation\"]");
  const seen = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    seen.push(await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || !el.closest("nav[aria-label=\"App navigation\"]")) return null;
      const cs = getComputedStyle(el);
      const ring = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2 || cs.boxShadow !== "none";
      return (el.getAttribute("aria-label") || el.textContent.trim().slice(0, 24)) + (ring ? "" : "  <- NO RING");
    }));
  }
  console.log("tab order in the sidebar:", seen.filter(Boolean).join(" | "));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
'
```

Expected: `dark`, `dark`, `dark` (no flash: the head script painted it before the body, and hydration left it alone), then `light`. The tab order lists Maven home, Collapse sidebar, New chat, Home, Discover, Library, Audience, then the thread rows and Account menu, and no entry ends in `<- NO RING`.

Stop the server: `kill $(lsof -ti:3021)`.

- [ ] **Step 8: Commit and report**

```bash
cd ~/virtuna-next-look
git add scripts/next-look-thread-check.cjs
git -c core.hooksPath=/dev/null commit -m "chore(next-look): thread check for the phone tab bar"
git log --oneline main..HEAD
```

Report to the owner, in this order: (1) each of the six "Done when" points of the spec with its evidence (the command and what it printed, or the screenshot you read); (2) every difference from the mocks you saw and what you did about it; (3) the twelve departures from the spec listed at the top of this plan; (4) what is still unfinished inside the flag by design; (5) that nothing was pushed. Send the four `final-light` / `final-dark` Library screenshots with the report.

---

## Spec coverage

| Spec section | Task |
|---|---|
| §4.1 colour, §4.4 elevation, measured contrast | 1 |
| §4.2 type, §4.3 radius | 1 (tokens), 3 and 5–7 (use) |
| §4.5 motion (press 0.98, sheet, no page-load animation) | 3 (button, chip, icon button, sheet), 5–6 |
| §5 mechanics: flag, attributes, scoped blocks, new names only, two variants, legacy aliases | 1, 2 |
| §5 theme: Light / Dark / Match system, localStorage, head script, `color-scheme` | 1 (`color-scheme`), 2, 8 |
| §6 place list, one config for both layouts | 4 |
| §6.1 phone: tab bar, where it shows, fade, content padding, drawer and hamburger removed, two headers | 5, 7 |
| §6.2 desktop: sidebar, rail, shortcut, auto-collapse below 1100, content frame title offset | 4, 6, 7 |
| §7 base parts and their states | 3 |
| §8 docs, drift guard, shell guard, contrast test, CLAUDE.md note, the five unread guard tests | 1, 4 (read for this plan: `type-scale`, `radius-scale`, `card-surface-consistency`, `command-palette-layer`; `audience-presence` covers a component this part does not touch) |
| §9 code layout | 2–7 |
| §10 done when | 9 |
| §11 known gaps | the departures table and the "accepted inside the flag" note at the top |

Not built here, as the spec says: page content, the gauge, the ring, the curves, the brain. Not built here although the spec lists it under the shell: the 980 / 720 content columns (departure 12).
