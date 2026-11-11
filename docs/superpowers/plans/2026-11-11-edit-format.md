# Auto-edit part 1: edit format, compiler and operations — Implementation Plan

> **Executed 2026-11-11. Do not run this plan again and do not copy its code blocks.** The branch
> `feat/openfilm-edit` no longer matches them: reviews during the build found defects in the plan's
> code, and each was fixed with a failing test first. What was built is described by the spec
> (`docs/superpowers/specs/2026-11-11-edit-format-design.md`): the changes are its §9, F7 to F13,
> and what is still open is its §10. Task 7 step 1's install command fails against the pinned
> `playwright-core`; the working form is in the spec's §10.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A saved edit (`EditSpec`) that compiles to an OpenFilm film folder and can only be changed through a closed list of operations, proven by a real render.

**Architecture:** Pure TypeScript under `src/lib/edit/` with no database, storage or UI. `spec.ts` is the zod-validated document counted in frames; `compile/` turns it into `film.html` and `captions.vtt`, the same code for the browser preview and the worker's render; `ops.ts` is the only way to change a document. Static files every film needs live in `public/edit-kit/v1/`.

**Tech Stack:** TypeScript 5 (strict, `noUncheckedIndexedAccess`), zod 4, vitest 4, `openfilm@0.3.2` as a dev dependency (its reader and renderer run in the tests), ffmpeg on the PATH for the render test.

**Spec:** `docs/superpowers/specs/2026-11-11-edit-format-design.md`. Map and rulings: `docs/superpowers/specs/2026-11-11-auto-edit-overview-design.md`.

**Where this code came from:** every file below was written as a prototype in `.scratch/openfilm-spike/proto/` and run there on 2026-11-11: `tsc` clean under this repo's compiler options, ESLint clean, 71 of 71 tests green including the real render. With `frameMs` changed from floor to round, the render test's cut-frame assertion and two time tests fail, as they should. The code blocks are those files unchanged. The work here is to bring them into the repo test-first and see the same results.

## Global Constraints

- Work in the worktree `/Users/davideloreti/virtuna-openfilm` on branch `feat/openfilm-edit`. Never `cd` to `~/virtuna-v1.1`.
- **Commits and pushes only when the owner asks.** Each task ends by staging its files. Before Task 1, ask the owner once whether he wants a commit per task on this branch; without a yes, stage only.
- Package manager is pnpm. `openfilm` is pinned exactly: `0.3.2`. No app code imports it in this part; only tests and `scripts/build-edit-kit.mjs`.
- On this Mac every vitest command needs `NODE_OPTIONS=--no-experimental-webstorage` (Node 25's built-in `localStorage` breaks 31 unrelated tests otherwise).
- Positions and lengths on the film are whole frames at 30 frames/s; positions in a source file are whole milliseconds. A frame becomes a film time by flooring: `frameMs(f) = Math.floor(f * 1000 / 30)`. Never round.
- A clip never takes more source than its length allows: source used is `Math.floor(lengthMs * speed)`.
- The film's `<head>` is identical for every edit except the keyframes block. Clip ids come from the document: `seg-<id>`, `blur-<id>`, `txt-<id>`, `lay-<id>`, `snd-<id>`, `wipe-<id>`.
- A film references only files inside its own folder: `assets/...` and `kit/v1/...`. No URL to anywhere else.
- No identifier, file or folder is named after OpenFilm. It may be named in comments and docs as the engine.
- Tests mock nothing of ours. OpenFilm's reader (`readFilmFile`) and renderer (`render`) are the real ones.
- No database change, no route, no UI, no change to existing source files in this part.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/edit/time.ts` | Frames to milliseconds; the floor rule. |
| `src/lib/edit/kit.ts` | The closed lists (filters, wipes, motions, fonts, sounds) and the kit's version. |
| `src/lib/edit/spec.ts` | The `EditSpec` zod schema, its types, `parseEditSpec`, `migrate`, factories for new items. |
| `src/lib/edit/derive.ts` | What follows from a document: segment starts, film length, a pinned item's frame. |
| `src/lib/edit/check.ts` | `checkEditSpec`: the rules zod cannot say. `EditSpecError`. |
| `src/lib/edit/compile/html.ts` | Escaping, track packing, the film's head. |
| `src/lib/edit/compile/keyframes.ts` | A segment's move as CSS keyframes. |
| `src/lib/edit/compile/main.ts` | The main sequence as clips; dissolve, dip and wipe; blurred fill. |
| `src/lib/edit/compile/captions.ts` | Caption lines from words; the WebVTT file. |
| `src/lib/edit/compile/items.ts` | Text, layers and sounds as clips. |
| `src/lib/edit/compile/index.ts` | `compile(spec, opts)`: track order and the result. |
| `src/lib/edit/ops.ts` | `OpSchema`, `parseOps`, `applyOps`, `EditOpError`. |
| `src/lib/edit/__tests__/*` | One test file per module, a shared fixture, a real render, a type shim. |
| `public/edit-kit/v1/*` | `text.html` (ours) plus wipes, sounds and the font copied from the pinned package. |
| `scripts/build-edit-kit.mjs` | Copies the third-party kit files. Run once per kit version; output is committed. |
| `THIRD_PARTY_NOTICES.md` | The MIT notice for the pinned package. |

---

### Task 1: The pinned engine, the kit and its lists

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (through pnpm)
- Create: `src/lib/edit/kit.ts`, `src/lib/edit/__tests__/kit.test.ts`, `public/edit-kit/v1/text.html`, `scripts/build-edit-kit.mjs`, `THIRD_PARTY_NOTICES.md`
- Generated by the script and kept: `public/edit-kit/v1/wipes/*.html` (6), `public/edit-kit/v1/sfx/*.m4a` (20), `public/edit-kit/v1/fonts/inter-latin-wght.woff2`, `public/edit-kit/v1/NOTICE.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `KIT` (`"v1"`), `KIT_DIR` (`"kit/v1"`), `FILTERS`, `FilterId`, `FILTER_IDS`, `WIPES` (`{ frames, tint }` per id), `WipeId`, `WIPE_IDS`, `MOTION_IDS`, `MotionId`, `FONTS` (`{ family, file }` per id), `FontId`, `FONT_IDS`, `SFX`, `SfxId`. The text page reads these CSS variables from its `#t` element: `--x --y --w --font --weight --size --color --fill --pad --radius --stroke --stroke-color --align --case --rotate --in --out --len`.

- [ ] **Step 1: Add the pinned dev dependency**

```bash
cd /Users/davideloreti/virtuna-openfilm
pnpm add -D --save-exact openfilm@0.3.2
node -p "require('openfilm/package.json').version"
```

Expected: the last line prints `0.3.2`, and `package.json` holds `"openfilm": "0.3.2"` under `devDependencies` with no caret.

- [ ] **Step 2: Write the failing test**

Create `src/lib/edit/__tests__/kit.test.ts`:

```ts
/**
 * kit.test.ts — the lists in kit.ts and the files in public/edit-kit/v1 say the same thing.
 *
 * A wipe named in kit.ts with no page behind it would compile to a film that fails only at
 * render time, on the worker. This fails here instead.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FONTS, KIT, SFX, WIPES } from "../kit";

const kit = fileURLToPath(new URL(`../../../../public/edit-kit/${KIT}/`, import.meta.url));

describe(`the kit (${KIT})`, () => {
  it("holds a page for every wipe", () => {
    for (const id of Object.keys(WIPES)) expect(existsSync(`${kit}wipes/${id}.html`), id).toBe(true);
  });

  it("holds a file for every sound effect and every font", () => {
    for (const name of SFX) expect(existsSync(`${kit}sfx/${name}.m4a`), name).toBe(true);
    for (const font of Object.values(FONTS)) expect(existsSync(`${kit}${font.file}`), font.file).toBe(true);
  });

  it("has a text page that is a film page reading the clip's variables", () => {
    const page = readFileSync(`${kit}text.html`, "utf8");
    expect(page).toContain("window.film =");
    expect(page).toContain("frameReadsOverrides: true");
    expect(page).toContain('id="t"');
  });

  it("says where its files came from", () => {
    expect(readFileSync(`${kit}NOTICE.md`, "utf8")).toMatch(/CC0/);
  });
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/kit.test.ts`
Expected: FAIL, the import of `../kit` cannot be resolved.

- [ ] **Step 4: Write the lists**

Create `src/lib/edit/kit.ts`:

```ts
/**
 * kit.ts — the closed lists an edit may name, and where each lives in the kit.
 *
 * The kit is the set of static files every film needs (`public/edit-kit/v1/`): the text page, the
 * font, the wipes and the sound effects. This file is versioned WITH the kit: once an edit has
 * been rendered with a kit version, no value here changes for that version. A new look is `v2`.
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §3.5 and §5.6.
 */
export const KIT = "v1" as const;
/** Where the kit sits inside a film folder. */
export const KIT_DIR = `kit/${KIT}` as const;

/** Whole-clip looks, as CSS filter strings. */
export const FILTERS = {
  vivid: "saturate(1.25) contrast(1.06)",
  warm: "sepia(.18) saturate(1.12)",
  cool: "hue-rotate(-10deg) saturate(1.06) brightness(1.02)",
  mono: "grayscale(1) contrast(1.08)",
  fade: "contrast(.9) brightness(1.06) saturate(.85)",
  punch: "contrast(1.18) saturate(1.1)",
} as const;
export type FilterId = keyof typeof FILTERS;
export const FILTER_IDS = Object.keys(FILTERS) as [FilterId, ...FilterId[]];

/**
 * Wipes: pages of OpenFilm's bundled library (CC0), copied unchanged to `wipes/<id>.html`. Each
 * draws itself for a fixed length and covers the cut at its middle. `tint`: whether the page
 * reads a `--color`.
 */
export const WIPES = {
  "swipe-blur": { frames: 18, tint: true },
  glitch: { frames: 18, tint: false },
  "flare-whip": { frames: 21, tint: false },
  shutter: { frames: 24, tint: true },
  "rgb-split": { frames: 18, tint: false },
  datamosh: { frames: 21, tint: false },
} as const;
export type WipeId = keyof typeof WIPES;
export const WIPE_IDS = Object.keys(WIPES) as [WipeId, ...WipeId[]];

/** How a text comes in or goes out. Drawn by the text page from the film time, 9 frames each. */
export const MOTION_IDS = ["pop", "fade", "rise"] as const;
export type MotionId = (typeof MOTION_IDS)[number];

export const FONTS = {
  inter: { family: "inter", file: "fonts/inter-latin-wght.woff2" },
} as const;
export type FontId = keyof typeof FONTS;
export const FONT_IDS = Object.keys(FONTS) as [FontId, ...FontId[]];

/** The bundled sound effects, at `sfx/<name>.m4a` (OpenFilm's library, CC0). */
export const SFX = [
  "boom", "buzz", "click", "ding", "drop", "heartbeat", "hit", "kick", "notify", "pop",
  "rain", "riser", "shutter", "swish", "tick", "typing", "whoosh-low", "whoosh", "wind", "zap",
] as const;
export type SfxId = (typeof SFX)[number];
```

- [ ] **Step 5: Run it and see it fail on the missing files**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/kit.test.ts`
Expected: FAIL, 4 tests, `expected false to be true` for `swipe-blur` and a missing `text.html`.

- [ ] **Step 6: Write the text page and the kit script, then build the kit**

Create `public/edit-kit/v1/text.html`:

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Text</title>
<style>
  @font-face { font-family: 'inter'; src: url('fonts/inter-latin-wght.woff2') format('woff2'); font-weight: 100 900; }
  html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; }
  /*
   * One page for every text on a film. What it says and how it looks arrive from the clip's
   * `overrides`: the words as #t's text, everything else as CSS variables on #t. The page covers
   * the stage and places the text itself, so moving a text is a change of two variables.
   */
  #t {
    position: absolute;
    left: calc(var(--x, .5) * 100%);
    top: calc(var(--y, .5) * 100%);
    width: max-content;
    max-width: calc(var(--w, .8) * 100vw);
    translate: -50% -50%;
    rotate: var(--rotate, 0deg);
    box-sizing: border-box;
    white-space: pre-line;
    font: var(--weight, 800) var(--size, 62px)/1.15 var(--font, 'inter'), sans-serif;
    color: var(--color, #111111);
    background: var(--fill, transparent);
    padding: var(--pad, 0);
    border-radius: var(--radius, 0);
    text-align: var(--align, center);
    text-transform: var(--case, none);
    -webkit-text-stroke: var(--stroke, 0) var(--stroke-color, transparent);
    paint-order: stroke fill;
  }
</style>
</head>
<body>
<div id="t">Text</div>
<script type="module">
const el = document.getElementById('t');
const read = (name) => getComputedStyle(el).getPropertyValue(name).trim();
const ease = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
/* a motion lasts 9 frames at 30 frames/s */
const MOVE = 0.3;

window.film = {
  /* the clip's variables are set before frame() runs, so frame() can read them */
  frameReadsOverrides: true,
  ready: document.fonts.load("800 62px 'inter'"),
  frame(t) {
    const len = parseFloat(read('--len'));
    const coming = read('--in');
    const going = read('--out');
    const a = coming && coming !== 'none' ? ease(t / MOVE) : 1;
    const b = going && going !== 'none' && Number.isFinite(len) ? ease((len - t) / MOVE) : 1;
    const p = Math.min(a, b);
    const kind = a <= b ? coming : going;
    el.style.opacity = String(kind === 'pop' || kind === 'fade' || kind === 'rise' ? p : 1);
    el.style.scale = kind === 'pop' ? String(0.82 + 0.18 * p) : '1';
    el.style.translate = kind === 'rise' ? `-50% calc(-50% + ${(1 - p) * 40}px)` : '-50% -50%';
  },
};
</script>
</body>
</html>
```

Create `scripts/build-edit-kit.mjs`:

```js
#!/usr/bin/env node
// Copies the kit's third-party files out of the pinned openfilm package into public/edit-kit/v1/.
// Run once per kit version; the output is committed, so nothing at run time depends on node_modules.
// text.html is ours and is not touched. usage: node scripts/build-edit-kit.mjs
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = dirname(createRequire(import.meta.url).resolve("openfilm/package.json"));
const version = createRequire(import.meta.url)("openfilm/package.json").version;
const out = join(root, "public", "edit-kit", "v1");

const WIPES = ["swipe-blur", "glitch", "flare-whip", "shutter", "rgb-split", "datamosh"];
const SFX = [
  "boom", "buzz", "click", "ding", "drop", "heartbeat", "hit", "kick", "notify", "pop",
  "rain", "riser", "shutter", "swish", "tick", "typing", "whoosh-low", "whoosh", "wind", "zap",
];

for (const dir of ["wipes", "sfx", "fonts"]) mkdirSync(join(out, dir), { recursive: true });
for (const id of WIPES) copyFileSync(join(pkg, "library", "transitions", id, "files", `${id}.html`), join(out, "wipes", `${id}.html`));
for (const name of SFX) copyFileSync(join(pkg, "library", "sounds", `${name}.m4a`), join(out, "sfx", `${name}.m4a`));

const fonts = join(pkg, "studio", "ui", "dist", "assets");
const inter = readdirSync(fonts).find((file) => /^inter-latin-wght-normal-.*\.woff2$/.test(file));
if (!inter) throw new Error("Inter (latin, variable) was not found in the openfilm package");
copyFileSync(join(fonts, inter), join(out, "fonts", "inter-latin-wght.woff2"));

writeFileSync(join(out, "NOTICE.md"), `# Edit kit v1: what is in it and where it came from

- \`text.html\`: written for this project.
- \`fonts/inter-latin-wght.woff2\`: Inter by Rasmus Andersson, SIL Open Font License 1.1
  (https://openfontlicense.org). Copied from openfilm ${version}, which bundles it via
  @fontsource-variable/inter.
- \`wipes/*.html\` and \`sfx/*.m4a\`: from the library of openfilm ${version}
  (https://github.com/openfilm/openfilm), dedicated to the public domain under CC0 1.0. Copied
  unchanged.

A kit version is never edited once an edit has been rendered with it. A change makes v2.
`);
console.log(`kit v1 written to ${out} (from openfilm ${version})`);
```

```bash
node scripts/build-edit-kit.mjs
find public/edit-kit/v1 -type f | wc -l
```

Expected: `kit v1 written to .../public/edit-kit/v1 (from openfilm 0.3.2)` and a count of `29`.

- [ ] **Step 7: Run the test and see it pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/kit.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 8: Write the third-party notice**

```bash
{
  printf '# Third-party notices\n\n'
  printf '## openfilm 0.3.2 (MIT)\n\n'
  printf 'A development dependency. Its film reader and renderer run in the edit tests, and the edit kit\n'
  printf 'copies files from its library (see `public/edit-kit/v1/NOTICE.md`). It depends on playwright-core\n'
  printf '(Apache License 2.0), which downloads a headless Chromium on first use.\n\n'
  printf '```\n'
  cat node_modules/openfilm/LICENSE
  printf '```\n'
} > THIRD_PARTY_NOTICES.md
head -12 THIRD_PARTY_NOTICES.md
```

Expected: the file starts with the heading and holds the MIT licence text of the package.

- [ ] **Step 9: Stage**

```bash
git add package.json pnpm-lock.yaml src/lib/edit/kit.ts src/lib/edit/__tests__/kit.test.ts public/edit-kit scripts/build-edit-kit.mjs THIRD_PARTY_NOTICES.md
git status --short
```

---

### Task 2: Time

**Files:**
- Create: `src/lib/edit/time.ts`
- Test: `src/lib/edit/__tests__/time.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `FPS = 30`, `MIN_LEN = 3`, `MAX_FRAMES = 18_000`, `frameMs(frame: number): number`, `spanMs(start: number, len: number): number`, `sourceMs(start: number, len: number, speed: number): number`, `sec(ms: number): string`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/edit/__tests__/time.test.ts`:

```ts
/**
 * time.test.ts — the rounding rules everything else stands on.
 *
 * The measured failure these guard against (2026-11-11): cut times rounded to the millisecond put
 * 5 of 10 cuts one frame late, because frame 56 is at 1866.67 ms and a clip written to start at
 * 1867 is not yet on at that frame.
 */
import { describe, expect, it } from "vitest";
import { FPS, MAX_FRAMES, frameMs, sec, sourceMs, spanMs } from "../time";

describe("frameMs", () => {
  it("is 1866 for frame 56, not 1867", () => {
    expect(frameMs(56)).toBe(1866);
  });

  it("is never after the frame it stands for, and never a whole millisecond before it", () => {
    for (let f = 0; f <= MAX_FRAMES; f++) {
      const exact = (f * 1000) / FPS;
      expect(frameMs(f)).toBeLessThanOrEqual(exact);
      expect(exact - frameMs(f)).toBeLessThan(1);
    }
  });
});

describe("spanMs", () => {
  it("makes consecutive clips touch: where one ends the next begins", () => {
    let at = 0;
    for (const len of [56, 47, 136, 40, 78, 71, 81, 25, 86, 220, 73]) {
      expect(frameMs(at) + spanMs(at, len)).toBe(frameMs(at + len));
      at += len;
    }
  });
});

describe("sourceMs", () => {
  it("never takes more source than the clip's time on the film allows, at any speed", () => {
    for (const speed of [0.25, 0.3, 0.5, 0.77, 1, 1.5, 2, 3.3, 4]) {
      for (let start = 0; start < 400; start += 7) {
        for (const len of [3, 10, 31, 100]) {
          expect(sourceMs(start, len, speed) / speed).toBeLessThanOrEqual(spanMs(start, len));
        }
      }
    }
  });
});

describe("sec", () => {
  it("writes seconds with at most three decimals and no trailing zeros", () => {
    expect(sec(1866)).toBe("1.866");
    expect(sec(9300)).toBe("9.3");
    expect(sec(0)).toBe("0");
    expect(sec(28000)).toBe("28");
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/time.test.ts`
Expected: FAIL, the import of `../time` cannot be resolved.

- [ ] **Step 3: Write the module**

Create `src/lib/edit/time.ts`:

```ts
/**
 * time.ts — how an edit counts time.
 *
 * On the film, positions and lengths are whole FRAMES at 30 frames/s. Inside a source file they
 * are whole MILLISECONDS. OpenFilm writes film times in milliseconds and puts a clip on from the
 * first frame AT OR AFTER its start, so a frame's time is FLOORED to the millisecond, never
 * rounded: frame 56 is 1866.67 ms; written as 1867 the cut lands on frame 57 (measured
 * 2026-11-11: 5 of 10 cuts one frame late).
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §2 (R1 to R3).
 */
export const FPS = 30;
/** The shortest clip an edit may hold, in frames. */
export const MIN_LEN = 3;
/** The longest film: 10 minutes, TikTok's API limit. */
export const MAX_FRAMES = 18_000;

/** A frame's time on the film in whole milliseconds, floored (R2). */
export function frameMs(frame: number): number {
  return Math.floor((frame * 1000) / FPS);
}

/** How long the frames [start, start + len) last on the film, in milliseconds. */
export function spanMs(start: number, len: number): number {
  return frameMs(start + len) - frameMs(start);
}

/** The source milliseconds a clip over those frames uses at a speed, floored so it never overruns (R3). */
export function sourceMs(start: number, len: number, speed: number): number {
  return Math.floor(spanMs(start, len) * speed);
}

/** Milliseconds as film.html writes seconds: at most three decimals, no trailing zeros. */
export function sec(ms: number): string {
  return String(Number((ms / 1000).toFixed(3)));
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/time.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Stage**

```bash
git add src/lib/edit/time.ts src/lib/edit/__tests__/time.test.ts
```

---

### Task 3: The document

**Files:**
- Create: `src/lib/edit/spec.ts`, `src/lib/edit/__tests__/fixture.ts`
- Test: `src/lib/edit/__tests__/spec.test.ts`

**Interfaces:**
- Consumes: `FILTER_IDS`, `FONT_IDS`, `MOTION_IDS`, `WIPE_IDS` from `./kit`; `MAX_FRAMES`, `MIN_LEN` from `./time`.
- Produces: the schemas `IdSchema`, `WordSchema`, `AssetSchema`, `FramingSchema`, `MoveSchema`, `CutOutSchema`, `SegmentSchema`, `LayerSchema`, `TextStyleSchema`, `TextItemSchema`, `SoundSchema`, `CaptionStyleSchema`, `CaptionsSchema`, `RefSchema`, `EditSpecSchema`; the types `Word`, `Asset`, `Framing`, `Move`, `CutOut`, `Segment`, `Layer`, `TextStyle`, `TextItem`, `Sound`, `CaptionStyle`, `Captions`, `EditSpec`; `migrate(json: unknown): unknown`; `parseEditSpec(json: unknown): EditSpec`; `STAGE`; `newSegment({ id, asset, len, inMs?, beat? }): Segment`; `newText({ id, text, at, len, pin? }): TextItem`; `DEFAULT_CAPTION_STYLE`; `DEFAULT_TEXT_STYLE`. From the fixture: `WORDS: Word[]`, `fixture(): EditSpec` (five segments, 298 frames), `file(asset): string`.

- [ ] **Step 1: Write the fixture and the failing test**

Create `src/lib/edit/__tests__/fixture.ts`:

```ts
/**
 * fixture.ts — one edit that uses every feature the compiler knows, for the edit tests.
 *
 * The words are the real Whisper (base) transcript of a 12.7 s phone take, mishearings included:
 * "Cloud" for Claude and "Bertuna" for Virtuna. The fixture corrects both through `captions.fixes`.
 *
 *   s1  take   frames   0-56    punched in                       → cut
 *   s2  take   frames  56-103                                    → dissolve, 12 frames
 *   s3  broll  frames 103-163   landscape, blurred fill          → shutter wipe, coral
 *   s4  photo  frames 163-208   still, push-in, mono             → cut
 *   s5  take   frames 208-298   "Virtuna App will soon be ..."
 */
import { DEFAULT_CAPTION_STYLE, STAGE, newSegment, newText, type EditSpec, type Word } from "../spec";

const W = (t0: number, t1: number, text: string): Word => ({ t0, t1, text });

export const WORDS: Word[] = [
  W(0, 420, "Hello"), W(420, 930, "guys,"), W(930, 1100, "we"), W(1100, 1350, "are"), W(1350, 1690, "back"),
  W(1690, 1860, "in"), W(1860, 2110, "the"), W(2110, 2520, "booth"), W(2520, 4000, "again."), W(4000, 4190, "We"),
  W(4190, 4470, "can"), W(4470, 4750, "see"), W(4750, 5160, "here"), W(5160, 5710, "working"), W(5710, 5880, "on"),
  W(5880, 6100, "some"), W(6100, 6670, "Cloud"), W(6670, 7070, "Code"), W(7070, 8280, "projects."), W(8280, 9050, "Bertuna"),
  W(9050, 9410, "App"), W(9410, 9820, "will"), W(9820, 10260, "soon"), W(10260, 10520, "be"), W(10520, 11340, "available."),
  W(11340, 11630, "Stay"), W(11630, 12700, "tuned."),
];

export function fixture(): EditSpec {
  return {
    v: 1,
    stage: { ...STAGE },
    assets: {
      take: { id: "take", kind: "video", origin: "filmed", at: { bucket: "takes", path: "u1/take.mov" }, ms: 12700, w: 1080, h: 1920, sound: true, words: WORDS },
      broll: { id: "broll", kind: "video", origin: "uploaded", at: { bucket: "takes", path: "u1/broll.mp4" }, ms: 8000, w: 1280, h: 720, sound: true, words: null },
      photo: { id: "photo", kind: "image", origin: "uploaded", at: { bucket: "takes", path: "u1/photo.jpg" }, w: 1280, h: 720, sound: false, words: null },
      kick: { id: "kick", kind: "audio", origin: "kit", at: { kit: "sfx/kick.m4a" }, ms: 450, sound: true, words: null },
      song: { id: "song", kind: "audio", origin: "uploaded", at: { bucket: "takes", path: "u1/song.mp3" }, ms: 30000, sound: true, words: null },
    },
    main: [
      { ...newSegment({ id: "s1", asset: "take", len: 56, beat: 0 }), framing: { zoom: 1.3, x: 0, y: -0.24 } },
      { ...newSegment({ id: "s2", asset: "take", len: 47, inMs: 1866, beat: 0 }), cutOut: { kind: "fade", style: "dissolve", len: 12 } },
      { ...newSegment({ id: "s3", asset: "broll", len: 60, inMs: 1000, beat: 1 }), fit: "blur", cutOut: { kind: "wipe", id: "shutter", color: "#ff6363" } },
      { ...newSegment({ id: "s4", asset: "photo", len: 45, beat: 2 }), move: { kind: "push-in", amount: 0.5 }, filter: "mono" },
      newSegment({ id: "s5", asset: "take", len: 90, inMs: 8280, beat: 3 }),
    ],
    layers: [
      { id: "l1", pin: null, at: 120, len: 30, kind: "sticker", asset: "photo", inMs: 0, speed: 1, volume: 1, box: { x: 0.6, y: 0.1, w: 0.3, h: 0.17 }, rotate: 8, opacity: 1, radius: 24, z: 1 },
    ],
    texts: [
      newText({ id: "t1", text: "POV: back in the booth", at: 0, len: 56, pin: "s1" }),
      { ...newText({ id: "t2", text: "Stay tuned", at: 250, len: 48 }), style: { preset: "outline", font: "inter", weight: 800, size: 96, color: "#ffe14a", fill: null, stroke: { color: "#000000", w: 12 }, align: "center", uppercase: true }, box: { x: 0.5, y: 0.5, w: 0.8 }, in: null, out: null },
    ],
    captions: { on: true, lang: "en", style: { ...DEFAULT_CAPTION_STYLE }, fixes: { take: { "16": "Claude", "19": "Virtuna" } } },
    sounds: [
      { id: "k1", pin: "s2", at: 0, len: 14, role: "sfx", asset: "kick", inMs: 0, volume: 0.6, fadeIn: 0, fadeOut: 0 },
      { id: "m1", pin: null, at: 0, len: 298, role: "music", asset: "song", inMs: 0, volume: 0.4, fadeIn: 0, fadeOut: 30 },
    ],
    look: { filter: null },
    cover: { frame: 20 },
    ref: null,
  };
}

/** Where a test's assets live inside the film folder. */
export const file = (asset: { id: string; kind: string }): string =>
  `assets/${asset.id}.${asset.kind === "image" ? "jpg" : asset.kind === "audio" ? "mp3" : "mp4"}`;
```

Create `src/lib/edit/__tests__/spec.test.ts`:

```ts
/**
 * spec.test.ts — what is and is not an EditSpec.
 *
 * Unknown keys are an error everywhere. A typo in a stored document or in an operation's payload
 * has to be refused, not dropped: a dropped key is a change that silently did not happen.
 */
import { describe, expect, it } from "vitest";
import { EditSpecSchema, parseEditSpec } from "../spec";
import { fixture } from "./fixture";

describe("parseEditSpec", () => {
  it("reads the fixture back unchanged", () => {
    expect(parseEditSpec(JSON.parse(JSON.stringify(fixture())))).toEqual(fixture());
  });

  it("refuses an unknown key anywhere", () => {
    const top = { ...fixture(), extra: 1 };
    expect(EditSpecSchema.safeParse(top).success).toBe(false);
    const deep = fixture();
    (deep.main[0] as unknown as Record<string, unknown>).colour = "red";
    expect(EditSpecSchema.safeParse(deep).success).toBe(false);
  });

  it("refuses a segment shorter than three frames, a speed out of range and a colour that is not hex", () => {
    const short = fixture();
    short.main[0]!.len = 2;
    expect(EditSpecSchema.safeParse(short).success).toBe(false);
    const fast = fixture();
    fast.main[0]!.speed = 5;
    expect(EditSpecSchema.safeParse(fast).success).toBe(false);
    const colour = fixture();
    colour.captions.style.color = "white";
    expect(EditSpecSchema.safeParse(colour).success).toBe(false);
  });

  it("refuses an edit with no segment, and a version it does not know", () => {
    expect(EditSpecSchema.safeParse({ ...fixture(), main: [] }).success).toBe(false);
    expect(() => parseEditSpec({ ...fixture(), v: 2 })).toThrow(/version 2/);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/spec.test.ts`
Expected: FAIL, the import of `../spec` cannot be resolved.

- [ ] **Step 3: Write the schema**

Create `src/lib/edit/spec.ts`:

```ts
/**
 * spec.ts — EditSpec, the saved edit.
 *
 * One JSON document per edit: zod-validated, versioned, counted in frames. It is the stored truth;
 * OpenFilm's film.html is compiled from it and never edited by hand. Unknown keys are an error
 * everywhere (strict objects), so a typo in a stored document or in an operation's payload is
 * refused instead of silently dropped.
 *
 * No field has a schema default: a stored document says everything. The defaults a NEW item
 * starts with are the factories at the bottom.
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §3 and §4.
 */
import { z } from "zod";
import { FILTER_IDS, FONT_IDS, MOTION_IDS, WIPE_IDS } from "./kit";
import { MAX_FRAMES, MIN_LEN } from "./time";

/** Ids are short and safe to use as an HTML id and in a file name. */
export const IdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,24}$/);
/** Colours are six-digit hex only, so they can be written into CSS and JSON as they are. */
const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const Frame = z.number().int().min(0).max(MAX_FRAMES);
const Len = z.number().int().min(1).max(MAX_FRAMES);
const Ms = z.number().int().min(0);
const Unit = z.number().min(0).max(1);

export const WordSchema = z.strictObject({ t0: Ms, t1: Ms, text: z.string().min(1).max(80) });

export const AssetSchema = z.strictObject({
  id: IdSchema,
  kind: z.enum(["video", "image", "audio"]),
  origin: z.enum(["filmed", "uploaded", "generated", "kit"]),
  generator: z.string().min(1).max(80).optional(),
  at: z.union([
    z.strictObject({ bucket: z.string().min(1).max(60), path: z.string().min(1).max(400) }),
    z.strictObject({ kit: z.string().regex(/^[a-z0-9][a-z0-9/_.-]{0,80}$/) }),
  ]),
  ms: Ms.optional(),
  w: z.number().int().positive().optional(),
  h: z.number().int().positive().optional(),
  sound: z.boolean(),
  words: z.array(WordSchema).nullable(),
});

export const FramingSchema = z.strictObject({
  zoom: z.number().min(1).max(4),
  x: z.number().min(-1).max(1),
  y: z.number().min(-1).max(1),
});

export const MoveSchema = z.strictObject({
  kind: z.enum(["push-in", "push-out", "pan-left", "pan-right", "shake"]),
  amount: Unit,
});

export const CutOutSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("cut") }),
  z.strictObject({ kind: z.literal("fade"), style: z.enum(["dissolve", "dip-black"]), len: z.number().int().min(2).max(60) }),
  z.strictObject({ kind: z.literal("wipe"), id: z.enum(WIPE_IDS), color: Hex.optional() }),
]);

export const SegmentSchema = z.strictObject({
  id: IdSchema,
  beat: z.number().int().min(0).nullable(),
  asset: IdSchema,
  inMs: Ms,
  len: z.number().int().min(MIN_LEN).max(MAX_FRAMES),
  speed: z.number().min(0.25).max(4),
  volume: z.number().min(0).max(2),
  fit: z.enum(["cover", "blur"]),
  framing: FramingSchema,
  move: MoveSchema.nullable(),
  filter: z.enum(FILTER_IDS).nullable(),
  cutOut: CutOutSchema,
});

/** What every item placed on the film by time carries. `pin`: the segment its `at` counts from. */
const timed = { id: IdSchema, pin: IdSchema.nullable(), at: Frame, len: Len };

export const LayerSchema = z.strictObject({
  ...timed,
  kind: z.enum(["clip", "sticker"]),
  asset: IdSchema,
  inMs: Ms,
  speed: z.number().min(0.25).max(4),
  volume: z.number().min(0).max(2),
  box: z.strictObject({
    x: z.number().min(-2).max(3),
    y: z.number().min(-2).max(3),
    w: z.number().gt(0).max(4),
    h: z.number().gt(0).max(4),
  }),
  rotate: z.number().min(-180).max(180),
  opacity: Unit,
  radius: z.number().min(0).max(960),
  z: z.number().int(),
});

export const TextStyleSchema = z.strictObject({
  preset: z.enum(["label", "outline", "plain"]),
  font: z.enum(FONT_IDS),
  weight: z.number().int().min(100).max(900),
  size: z.number().min(12).max(400),
  color: Hex,
  fill: Hex.nullable(),
  stroke: z.strictObject({ color: Hex, w: z.number().min(0).max(40) }).nullable(),
  align: z.enum(["left", "center", "right"]),
  uppercase: z.boolean(),
});

export const TextItemSchema = z.strictObject({
  ...timed,
  text: z.string().min(1).max(280),
  style: TextStyleSchema,
  box: z.strictObject({ x: Unit, y: Unit, w: z.number().gt(0).max(1) }),
  rotate: z.number().min(-180).max(180),
  in: z.enum(MOTION_IDS).nullable(),
  out: z.enum(MOTION_IDS).nullable(),
});

export const SoundSchema = z.strictObject({
  ...timed,
  role: z.enum(["music", "sfx", "voiceover"]),
  asset: IdSchema,
  inMs: Ms,
  volume: z.number().min(0).max(2),
  fadeIn: Frame,
  fadeOut: Frame,
});

export const CaptionStyleSchema = z.strictObject({
  font: z.enum(FONT_IDS),
  weight: z.number().int().min(100).max(900),
  size: z.number().min(12).max(400),
  color: Hex,
  highlight: Hex.nullable(),
  dimAhead: Unit,
  stroke: z.strictObject({ color: Hex, w: z.number().min(0).max(40) }).nullable(),
  fill: Hex.nullable(),
  uppercase: z.boolean(),
  maxWords: z.number().int().min(1).max(6),
  y: Unit,
  width: z.number().gt(0).max(1),
});

export const CaptionsSchema = z.strictObject({
  on: z.boolean(),
  lang: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/),
  style: CaptionStyleSchema,
  /** asset id → word index → the corrected word, or null to hide it */
  fixes: z.record(IdSchema, z.record(z.string().regex(/^\d{1,6}$/), z.string().min(1).max(80).nullable())),
});

export const RefSchema = z.strictObject({
  blueprintId: z.string().min(1).max(40),
  cuts: z.array(Frame),
  beats: z.array(Frame),
});

export const EditSpecSchema = z.strictObject({
  v: z.literal(1),
  stage: z.strictObject({ w: z.literal(1080), h: z.literal(1920), fps: z.literal(30) }),
  assets: z.record(IdSchema, AssetSchema),
  main: z.array(SegmentSchema).min(1),
  layers: z.array(LayerSchema),
  texts: z.array(TextItemSchema),
  captions: CaptionsSchema,
  sounds: z.array(SoundSchema),
  look: z.strictObject({ filter: z.enum(FILTER_IDS).nullable() }),
  cover: z.strictObject({ frame: Frame }).nullable(),
  ref: RefSchema.nullable(),
});

export type Word = z.infer<typeof WordSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type Framing = z.infer<typeof FramingSchema>;
export type Move = z.infer<typeof MoveSchema>;
export type CutOut = z.infer<typeof CutOutSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type TextStyle = z.infer<typeof TextStyleSchema>;
export type TextItem = z.infer<typeof TextItemSchema>;
export type Sound = z.infer<typeof SoundSchema>;
export type CaptionStyle = z.infer<typeof CaptionStyleSchema>;
export type Captions = z.infer<typeof CaptionsSchema>;
export type EditSpec = z.infer<typeof EditSpecSchema>;

/**
 * An older document brought forward to this version. v1 has nothing to migrate; the function is
 * here so a stored document never needs a breaking change.
 */
export function migrate(json: unknown): unknown {
  const v = typeof json === "object" && json !== null ? (json as { v?: unknown }).v : undefined;
  if (v === 1) return json;
  throw new Error(`EditSpec version ${String(v)} is not one this code can read`);
}

/** A stored document, migrated and validated. Throws a ZodError when it is not an EditSpec. */
export function parseEditSpec(json: unknown): EditSpec {
  return EditSpecSchema.parse(migrate(json));
}

/* ── what a new item starts with ─────────────────────────────────────────────────────────────── */

export const STAGE = { w: 1080, h: 1920, fps: 30 } as const;

export function newSegment(a: { id: string; asset: string; len: number; inMs?: number; beat?: number | null }): Segment {
  return {
    id: a.id, beat: a.beat ?? null, asset: a.asset, inMs: a.inMs ?? 0, len: a.len,
    speed: 1, volume: 1, fit: "cover", framing: { zoom: 1, x: 0, y: 0 }, move: null, filter: null,
    cutOut: { kind: "cut" },
  };
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  font: "inter", weight: 800, size: 84, color: "#ffffff", highlight: "#ffe14a", dimAhead: 0.65,
  stroke: { color: "#000000", w: 10 }, fill: null, uppercase: true, maxWords: 3, y: 0.66, width: 0.86,
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
  preset: "label", font: "inter", weight: 800, size: 62, color: "#111111", fill: "#ffffff",
  stroke: null, align: "center", uppercase: false,
};

export function newText(a: { id: string; text: string; at: number; len: number; pin?: string | null }): TextItem {
  return {
    id: a.id, pin: a.pin ?? null, at: a.at, len: a.len, text: a.text, style: { ...DEFAULT_TEXT_STYLE },
    box: { x: 0.5, y: 0.14, w: 0.8 }, rotate: 0, in: "pop", out: "fade",
  };
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/spec.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Stage**

```bash
git add src/lib/edit/spec.ts src/lib/edit/__tests__/fixture.ts src/lib/edit/__tests__/spec.test.ts
```

---

### Task 4: What follows from a document, and its checks

**Files:**
- Create: `src/lib/edit/derive.ts`, `src/lib/edit/check.ts`
- Test: `src/lib/edit/__tests__/check.test.ts`

**Interfaces:**
- Consumes: `EditSpec`, `Asset` from `./spec`; `frameMs`, `sourceMs`, `spanMs`, `MAX_FRAMES` from `./time`; `fixture` from the test fixture.
- Produces: `starts(spec): number[]` (one entry more than there are segments; the last is the film's length), `total(spec): number`, `windowOf(spec, index): SegmentWindow` (`{ start, atMs, lenMs, inMs, usedMs }`), `frameOf(spec, { pin, at }): number | null`; `checkEditSpec(spec): Problem[]`, `Problem` (`{ code, at, message }`), `ProblemCode` (`asset-key | generator-missing | asset-facts | asset-missing | asset-kind | source-overrun | pin-missing | fix-missing | dup-id | too-long`), `EditSpecError` (has `problems`).

- [ ] **Step 1: Write the failing test**

Create `src/lib/edit/__tests__/check.test.ts`:

```ts
/**
 * check.test.ts — what follows from an EditSpec, and the rules zod cannot say.
 *
 * Every `checkEditSpec` rule gets a document that breaks exactly that rule, so a rule that stops
 * firing is seen here and not as a film that renders wrong.
 */
import { describe, expect, it } from "vitest";
import { checkEditSpec } from "../check";
import { frameOf, starts, total, windowOf } from "../derive";
import { fixture } from "./fixture";

describe("derive", () => {
  it("places segments end to end", () => {
    expect(starts(fixture())).toEqual([0, 56, 103, 163, 208, 298]);
    expect(total(fixture())).toBe(298);
  });

  it("gives a segment its place on the film and in its source", () => {
    expect(windowOf(fixture(), 1)).toEqual({ start: 56, atMs: 1866, lenMs: 1567, inMs: 1866, usedMs: 1567 });
    expect(windowOf(fixture(), 3)).toEqual({ start: 163, atMs: 5433, lenMs: 1500, inMs: 0, usedMs: 0 });
  });

  it("counts a pinned item from its segment and an unpinned one from the film's start", () => {
    const spec = fixture();
    expect(frameOf(spec, { pin: "s2", at: 0 })).toBe(56);
    expect(frameOf(spec, { pin: null, at: 250 })).toBe(250);
    expect(frameOf(spec, { pin: "gone", at: 0 })).toBeNull();
  });
});

describe("checkEditSpec", () => {
  const codes = (spec: ReturnType<typeof fixture>): string[] => checkEditSpec(spec).map((p) => p.code);

  it("passes the fixture", () => {
    expect(checkEditSpec(fixture())).toEqual([]);
  });

  it("asset-key: an asset stored under another id", () => {
    const spec = fixture();
    spec.assets.take!.id = "other";
    expect(codes(spec)).toContain("asset-key");
  });

  it("generator-missing: a generated asset that names no generator", () => {
    const spec = fixture();
    spec.assets.take!.origin = "generated";
    expect(codes(spec)).toEqual(["generator-missing"]);
    spec.assets.take!.generator = "heygen";
    expect(codes(spec)).toEqual([]);
  });

  it("asset-facts: a picture with no size, a video with no length", () => {
    const size = fixture();
    delete size.assets.photo!.w;
    expect(codes(size)).toEqual(["asset-facts"]);
    const length = fixture();
    delete length.assets.broll!.ms;
    expect(codes(length)).toContain("asset-facts");
  });

  it("asset-missing and asset-kind: a segment that names nothing, or a sound", () => {
    const missing = fixture();
    missing.main[0]!.asset = "nope";
    expect(codes(missing)).toEqual(["asset-missing"]);
    const kind = fixture();
    kind.main[0]!.asset = "song";
    expect(codes(kind)).toEqual(["asset-kind"]);
    const sound = fixture();
    sound.sounds[0]!.asset = "take";
    expect(codes(sound)).toEqual(["asset-kind"]);
  });

  it("source-overrun: a segment that takes more than its file holds", () => {
    const spec = fixture();
    spec.main[4]!.inMs = 9800; // 90 frames = 3000 ms from 9800 runs past 12700
    expect(codes(spec)).toEqual(["source-overrun"]);
    const exact = fixture();
    exact.main[4]!.inMs = 9700; // ends on the file's last millisecond
    expect(codes(exact)).toEqual([]);
  });

  it("pin-missing: a text pinned to a segment that is not there", () => {
    const spec = fixture();
    spec.texts[0]!.pin = "gone";
    expect(codes(spec)).toEqual(["pin-missing"]);
  });

  it("fix-missing: a correction for a word the asset does not have", () => {
    const spec = fixture();
    spec.captions.fixes.take!["99"] = "x";
    expect(codes(spec)).toEqual(["fix-missing"]);
    const silent = fixture();
    silent.captions.fixes.broll = { "0": "x" };
    expect(codes(silent)).toEqual(["fix-missing"]);
  });

  it("dup-id: two segments with one id", () => {
    const spec = fixture();
    spec.main[1]!.id = "s1";
    expect(codes(spec)).toContain("dup-id");
  });

  it("too-long: a film past ten minutes", () => {
    const spec = fixture();
    spec.main[3]!.len = 18_000; // the still: no source to overrun
    expect(codes(spec)).toEqual(["too-long"]);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/check.test.ts`
Expected: FAIL, the imports of `../check` and `../derive` cannot be resolved.

- [ ] **Step 3: Write the two modules**

Create `src/lib/edit/derive.ts`:

```ts
/**
 * derive.ts — what follows from an EditSpec without being stored in it.
 *
 * The film's length is the main sequence (spec §3): segments play in order with no gaps, so a
 * segment's first frame is the sum of the lengths before it.
 */
import type { EditSpec } from "./spec";
import { frameMs, sourceMs, spanMs } from "./time";

/** The first frame of each main segment; one entry more than there are segments, the last being the film's length. */
export function starts(spec: EditSpec): number[] {
  const out = [0];
  let at = 0;
  for (const seg of spec.main) {
    at += seg.len;
    out.push(at);
  }
  return out;
}

/** The film's length in frames. */
export function total(spec: EditSpec): number {
  return spec.main.reduce((n, seg) => n + seg.len, 0);
}

export interface SegmentWindow {
  /** its first frame on the film */
  start: number;
  /** its start and length on the film, in milliseconds */
  atMs: number;
  lenMs: number;
  /** where in the source it starts, and how much of the source it uses (0 for an image) */
  inMs: number;
  usedMs: number;
}

/** Where the segment at `index` sits on the film and what it takes from its source (spec §3.2). */
export function windowOf(spec: EditSpec, index: number): SegmentWindow {
  const seg = spec.main[index];
  if (!seg) throw new RangeError(`the edit has no segment ${index}`);
  const start = starts(spec)[index] ?? 0;
  const image = spec.assets[seg.asset]?.kind === "image";
  return {
    start,
    atMs: frameMs(start),
    lenMs: spanMs(start, seg.len),
    inMs: image ? 0 : seg.inMs,
    usedMs: image ? 0 : sourceMs(start, seg.len, seg.speed),
  };
}

/**
 * The frame an item starts on, counted from the film's first frame. A pinned item counts from its
 * segment's first frame; null when the pin names no segment.
 */
export function frameOf(spec: EditSpec, item: { pin: string | null; at: number }): number | null {
  if (item.pin == null) return item.at;
  const index = spec.main.findIndex((seg) => seg.id === item.pin);
  if (index < 0) return null;
  return (starts(spec)[index] ?? 0) + item.at;
}
```

Create `src/lib/edit/check.ts`:

```ts
/**
 * check.ts — the rules of an EditSpec that zod cannot say.
 *
 * zod checks each field alone. These rules are about fields that have to agree: an asset that
 * exists and is the right kind, a source window that fits its file, a pin that names a segment.
 * The compiler and `applyOps` both refuse a document that fails any of them.
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §4.
 */
import { frameOf, starts, total } from "./derive";
import type { Asset, EditSpec } from "./spec";
import { MAX_FRAMES, sourceMs, spanMs } from "./time";

export type ProblemCode =
  | "asset-key" | "generator-missing" | "asset-facts" | "asset-missing" | "asset-kind"
  | "source-overrun" | "pin-missing" | "fix-missing" | "dup-id" | "too-long";

export interface Problem {
  code: ProblemCode;
  /** where in the document, e.g. `main[2]` */
  at: string;
  message: string;
}

/** Thrown by the compiler for a document that fails `checkEditSpec`. */
export class EditSpecError extends Error {
  constructor(readonly problems: Problem[]) {
    super(problems.map((p) => `${p.at}: ${p.message}`).join("; "));
    this.name = "EditSpecError";
  }
}

export function checkEditSpec(spec: EditSpec): Problem[] {
  const out: Problem[] = [];
  const say = (code: ProblemCode, at: string, message: string): void => { out.push({ code, at, message }); };

  for (const [key, asset] of Object.entries(spec.assets)) {
    const at = `assets.${key}`;
    if (asset.id !== key) say("asset-key", at, `is stored under "${key}" but its id is "${asset.id}"`);
    if (asset.origin === "generated" && !asset.generator) say("generator-missing", at, "is generated and names no generator");
    if (asset.kind !== "audio" && (!asset.w || !asset.h)) say("asset-facts", at, "is a picture with no size");
    if (asset.kind !== "image" && asset.ms == null) say("asset-facts", at, "has no length");
  }

  /** The asset `id` names when it is one of `kinds`; otherwise the problem is said and null returned. */
  const assetOf = (id: string, kinds: Asset["kind"][], at: string): Asset | null => {
    const asset = spec.assets[id];
    if (!asset) { say("asset-missing", at, `names the asset "${id}", which is not in the edit`); return null; }
    if (!kinds.includes(asset.kind)) { say("asset-kind", at, `needs ${kinds.join(" or ")}, and "${id}" is ${asset.kind}`); return null; }
    return asset;
  };
  const unique = (ids: string[], list: string): void => {
    const seen = new Set<string>();
    ids.forEach((id, i) => {
      if (seen.has(id)) say("dup-id", `${list}[${i}]`, `the id "${id}" is used twice in ${list}`);
      seen.add(id);
    });
  };

  const at = starts(spec);
  spec.main.forEach((seg, i) => {
    const asset = assetOf(seg.asset, ["video", "image"], `main[${i}]`);
    if (asset?.kind === "video" && seg.inMs + sourceMs(at[i] ?? 0, seg.len, seg.speed) > (asset.ms ?? 0)) {
      say("source-overrun", `main[${i}]`, `takes more of "${seg.asset}" than the file holds`);
    }
  });
  unique(spec.main.map((s) => s.id), "main");
  if (total(spec) > MAX_FRAMES) say("too-long", "main", `the film is ${total(spec)} frames; the most is ${MAX_FRAMES}`);

  spec.layers.forEach((layer, i) => {
    const where = `layers[${i}]`;
    const frame = frameOf(spec, layer);
    if (frame == null) say("pin-missing", where, `is pinned to "${layer.pin}", which is not a segment`);
    const asset = assetOf(layer.asset, ["video", "image"], where);
    if (asset?.kind === "video" && frame != null && layer.inMs + Math.floor(spanMs(frame, layer.len) * layer.speed) > (asset.ms ?? 0)) {
      say("source-overrun", where, `takes more of "${layer.asset}" than the file holds`);
    }
  });
  unique(spec.layers.map((l) => l.id), "layers");

  spec.texts.forEach((text, i) => {
    if (frameOf(spec, text) == null) say("pin-missing", `texts[${i}]`, `is pinned to "${text.pin}", which is not a segment`);
  });
  unique(spec.texts.map((t) => t.id), "texts");

  spec.sounds.forEach((sound, i) => {
    const where = `sounds[${i}]`;
    if (frameOf(spec, sound) == null) say("pin-missing", where, `is pinned to "${sound.pin}", which is not a segment`);
    const asset = assetOf(sound.asset, ["audio"], where);
    if (asset && sound.inMs >= (asset.ms ?? 0)) say("source-overrun", where, `starts after the end of "${sound.asset}"`);
  });
  unique(spec.sounds.map((s) => s.id), "sounds");

  for (const [assetId, fixes] of Object.entries(spec.captions.fixes)) {
    const words = spec.assets[assetId]?.words;
    for (const index of Object.keys(fixes)) {
      if (!words || Number(index) >= words.length) {
        say("fix-missing", `captions.fixes.${assetId}.${index}`, `corrects word ${index} of "${assetId}", which has no such word`);
      }
    }
  }

  return out;
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/check.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Stage**

```bash
git add src/lib/edit/derive.ts src/lib/edit/check.ts src/lib/edit/__tests__/check.test.ts
```

---

### Task 5: The compiler

**Files:**
- Create: `src/lib/edit/compile/html.ts`, `src/lib/edit/compile/keyframes.ts`, `src/lib/edit/compile/main.ts`, `src/lib/edit/compile/captions.ts`, `src/lib/edit/compile/items.ts`, `src/lib/edit/compile/index.ts`
- Test: `src/lib/edit/__tests__/compile.test.ts`
- Written by the first green run and kept: `src/lib/edit/__tests__/__snapshots__/fixture.film.html`, `src/lib/edit/__tests__/__snapshots__/fixture.captions.vtt`

**Interfaces:**
- Consumes: everything Tasks 1 to 4 produce; `readFilmFile` from `openfilm/film-doc` in the test.
- Produces: `compile(spec: EditSpec, opts: CompileOptions): Compiled` where `CompileOptions = { file: (asset: Asset) => string }` and `Compiled = { files: { "film.html": string; "captions.vtt"?: string }; assets: { id: string; file: string }[]; kit: "v1"; frames: number }`, imported as `../compile`. Also used by tests: `cuesOf(spec): Cue[]` and `vttOf(spec, cues): string` from `compile/captions`, `boxOf(asset, framing, whole)` from `compile/main`. Track order, top first: captions, text, wipes, layers, main B, its blur track, main A, its blur track, sounds.

What the reader gives back, which the test relies on: a clip's `src` is the file alone and its `#t=` window is `time: [in, out]` in seconds; `at` is seconds; a lower track index is drawn on top.

- [ ] **Step 1: Write the failing test**

Create `src/lib/edit/__tests__/compile.test.ts`:

```ts
/**
 * compile.test.ts — the compiler, judged by OpenFilm's own reader.
 *
 * The load-bearing assertion is `readFilmFile(...).problems` being empty: the reader is strict (a
 * misspelled attribute, two clips overlapping on a track, a clip longer than its file are all
 * problems), and it is the same code the renderer and the in-page player read a film with. The
 * expected film.html is also kept as a file snapshot, so any change to the output shows up as a
 * diff to read.
 *
 * Nothing of ours is mocked. The reader is the real one from the pinned package.
 */
import { readFilmFile } from "openfilm/film-doc";
import { describe, expect, it } from "vitest";
import { EditSpecError } from "../check";
import { compile } from "../compile";
import { cuesOf } from "../compile/captions";
import { boxOf } from "../compile/main";
import { frameMs } from "../time";
import { file, fixture } from "./fixture";

/** A clip as the reader gives it: `src` is the file alone, the `#t=` window is `time`. */
type Clip = { id: string; src: string; at?: number; time?: number[]; speed?: number; overrides?: { at?: string; text?: string; fade?: number[]; style?: Record<string, string> }[] };

/** The film as OpenFilm reads it: its problems and every clip by id, with the index of its track (0 is on top). */
function read(text: string): { problems: string[]; clips: Map<string, Clip & { track: number }>; keyframes: string[] } {
  const result = readFilmFile(text);
  const clips = new Map<string, Clip & { track: number }>();
  const tracks = (result.value?.tracks ?? []) as unknown as { clips?: Clip[] }[];
  tracks.forEach((track, index) => {
    for (const clip of track.clips ?? []) clips.set(clip.id, { ...clip, track: index });
  });
  const keyframes = (result.value as unknown as { keyframes?: Record<string, unknown> } | undefined)?.keyframes ?? {};
  return { problems: result.problems, clips, keyframes: Object.keys(keyframes) };
}

const get = (clips: Map<string, Clip & { track: number }>, id: string): Clip & { track: number } => {
  const clip = clips.get(id);
  if (!clip) throw new Error(`the film has no clip "${id}"`);
  return clip;
};

describe("compile", () => {
  const out = compile(fixture(), { file });
  const film = read(out.files["film.html"]);

  it("makes a film OpenFilm's reader accepts with no problems", () => {
    expect(film.problems).toEqual([]);
  });

  it("is the same bytes for the same document", () => {
    expect(compile(fixture(), { file })).toEqual(out);
  });

  it("matches the film kept on file", async () => {
    await expect(out.files["film.html"]).toMatchFileSnapshot("./__snapshots__/fixture.film.html");
    await expect(out.files["captions.vtt"]).toMatchFileSnapshot("./__snapshots__/fixture.captions.vtt");
  });

  it("says the film's length and which files the folder needs, leaving kit files out", () => {
    expect(out.frames).toBe(298);
    expect(out.kit).toBe("v1");
    expect(out.assets).toEqual([
      { id: "take", file: "assets/take.mp4" },
      { id: "broll", file: "assets/broll.mp4" },
      { id: "photo", file: "assets/photo.jpg" },
      { id: "song", file: "assets/song.mp3" },
    ]);
    expect(get(film.clips, "snd-k1").src).toBe("kit/v1/sfx/kick.m4a");
  });

  it("starts every segment on its frame, floored to the millisecond", () => {
    expect(get(film.clips, "seg-s1").at ?? 0).toBe(0);
    expect(get(film.clips, "seg-s2").at).toBe(frameMs(56) / 1000);
    expect(get(film.clips, "seg-s4").at).toBe(frameMs(163) / 1000);
    expect(get(film.clips, "seg-s5").at).toBe(frameMs(208) / 1000);
    expect(get(film.clips, "seg-s2").time).toEqual([1.866, 3.633]); // 1.866 + 1.567 s, plus the dissolve's 0.2 s tail
  });

  it("dissolves by overlapping on two tracks, and only the upper clip fades", () => {
    const outgoing = get(film.clips, "seg-s2");
    const incoming = get(film.clips, "seg-s3");
    expect(incoming.track).toBeLessThan(outgoing.track); // a lower index is drawn on top
    expect(incoming.at).toBe(frameMs(103 - 6) / 1000); // six frames before the cut
    expect(incoming.time?.[0]).toBe(0.8); // 1000 ms in-point less the 200 ms lead-in
    expect(incoming.overrides).toEqual([{ fade: [0.4, 0] }]); // 12 frames
    expect(outgoing.overrides).toBeUndefined();
  });

  it("puts a wipe page over its cut, centred, in its colour", () => {
    const wipe = get(film.clips, "wipe-s3");
    expect(wipe.src).toBe("kit/v1/wipes/shutter.html");
    expect(wipe.time).toEqual([0, 0.8]); // the page's own 24 frames
    expect(wipe.at).toBe(frameMs(163 - 12) / 1000);
    expect(wipe.overrides).toEqual([{ at: "html", style: { "--color": "#ff6363" } }]);
  });

  it("shows a landscape clip whole over a blurred copy of itself", () => {
    expect(boxOf({ w: 1280, h: 720 } as never, { zoom: 1, x: 0, y: 0 }, true)).toEqual({ left: 0, top: 656, width: 1080, height: 608 });
    expect(boxOf({ w: 1280, h: 720 } as never, { zoom: 1, x: 0, y: 0 }, false)).toEqual({ left: -1166, top: 0, width: 3413, height: 1920 });
    expect(film.clips.has("blur-s3")).toBe(true);
    /* directly beneath its own clip and above the outgoing one, so picture and fill dissolve in together */
    expect(get(film.clips, "blur-s3").track).toBe(get(film.clips, "seg-s3").track + 1);
    expect(get(film.clips, "blur-s3").track).toBeLessThan(get(film.clips, "seg-s2").track);
    expect(get(film.clips, "blur-s3").overrides).toEqual(get(film.clips, "seg-s3").overrides);
    expect(out.files["film.html"]).toContain("filter: blur(40px) brightness(.7)");
  });

  it("punches in around the framing's point", () => {
    expect(boxOf({ w: 1080, h: 1920 } as never, { zoom: 1.3, x: 0, y: -0.24 }, false)).toEqual({ left: -162, top: -219, width: 1404, height: 2496 });
  });

  it("gives a still its length, a move its keyframes and a filter its CSS", () => {
    expect(get(film.clips, "seg-s4").src).toBe("assets/photo.jpg");
    expect(get(film.clips, "seg-s4").time).toEqual([0, 1.5]);
    expect(film.keyframes).toEqual(["mv-push-in-50"]);
    expect(out.files["film.html"]).toContain("animation: mv-push-in-50 var(--clip-length) linear both");
    expect(out.files["film.html"]).toContain("filter: grayscale(1) contrast(1.08)");
  });

  it("carries a text's words and look in the clip, so the reader gives them back", () => {
    const text = get(film.clips, "txt-t1");
    expect(text.src).toBe("kit/v1/text.html");
    expect(text.time).toEqual([0, 1.866]);
    expect(text.overrides?.[0]?.text).toBe("POV: back in the booth");
    expect(text.overrides?.[0]?.style?.["--fill"]).toBe("#ffffff");
    expect(text.overrides?.[0]?.style?.["--len"]).toBe("1.866");
  });

  it("cuts off what runs past the film's end", () => {
    const text = get(film.clips, "txt-t2"); // frames 250 to 298, one more than the film has
    expect(text.at).toBe(frameMs(250) / 1000);
    expect(text.time).toEqual([0, (frameMs(298) - frameMs(250)) / 1000]);
  });

  it("ends a sound when its file does, and fades the music out", () => {
    expect(get(film.clips, "snd-k1").time).toEqual([0, 0.45]); // 14 frames asked, the file is 450 ms
    expect(get(film.clips, "snd-m1").overrides).toEqual([{ fade: [0, 1] }]); // 30 frames
  });

  it("keeps the head the same across an edit, apart from the keyframes", () => {
    const edited = fixture();
    edited.main[0]!.len = 40;
    edited.texts[0]!.text = "changed";
    const head = (text: string): string => text.slice(0, text.indexOf("</head>"));
    expect(head(compile(edited, { file }).files["film.html"])).toBe(head(out.files["film.html"]));
  });

  it("refuses a document that fails the checks", () => {
    const broken = fixture();
    broken.main[0]!.asset = "nope";
    expect(() => compile(broken, { file })).toThrow(EditSpecError);
  });
});

describe("captions", () => {
  it("are worked out from the words on the film, with the corrections applied", () => {
    const cues = cuesOf(fixture());
    const lines = cues.map((cue) => cue.words.map((w) => w.text).join(" "));
    expect(lines).toEqual([
      "Hello guys, we", "are back in",           // s1: the take's first 1.866 s
      "the booth again.",                         // s2
      "Virtuna App will", "soon be available.",   // s5, "Bertuna" corrected
    ]);
  });

  it("stay inside the segment that says them, one line at a time", () => {
    const cues = cuesOf(fixture());
    cues.forEach((cue, i) => {
      expect(cue.end).toBeGreaterThan(cue.start);
      const next = cues[i + 1];
      if (next) expect(cue.end).toBeLessThanOrEqual(next.start);
      for (const word of cue.words) expect(word.at >= cue.start && word.at < cue.end).toBe(true);
    });
    expect(cues[2]?.start).toBe(frameMs(56)); // "the" starts 6 ms before the cut in the take: held to the segment's start
    expect(cues[3]?.start).toBe(frameMs(208));
  });

  it("follow a trim without being made again, and a hidden word is gone", () => {
    const spec = fixture();
    spec.main[4]!.inMs = 9050; // s5 now starts at "App"
    spec.captions.fixes.take!["20"] = null;
    const lines = cuesOf(spec).map((cue) => cue.words.map((w) => w.text).join(" "));
    expect(lines.slice(3)).toEqual(["will soon be", "available.", "Stay"]); // a sentence end closes a line
  });

  it("write a caption track only when they are on and there is something to show", () => {
    const off = fixture();
    off.captions.on = false;
    const film = compile(off, { file });
    expect(film.files["captions.vtt"]).toBeUndefined();
    expect(film.files["film.html"]).not.toContain("<track");
    expect(readFilmFile(film.files["film.html"]).problems).toEqual([]);
  });

  it("escape what WebVTT would read as markup", () => {
    const spec = fixture();
    spec.captions.fixes.take!["0"] = "<Hi> & co";
    expect(compile(spec, { file }).files["captions.vtt"]).toContain("&lt;Hi&gt; &amp; co");
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/compile.test.ts`
Expected: FAIL, the import of `../compile` cannot be resolved.

- [ ] **Step 3: Write the helpers for film text and tracks**

Create `src/lib/edit/compile/html.ts`:

```ts
/**
 * html.ts — writing film.html text, and packing clips onto tracks.
 *
 * Escaping mirrors OpenFilm's own writer (`filmHtml` in its film-doc module): `&` and `"` in a
 * double-quoted attribute; `&` and `'` in the single-quoted `overrides` JSON. Its strict reader
 * reads both back exactly (checked 2026-11-11 with quotes, angle brackets and a line break).
 */

/** The stage, fixed in v1 (spec F5). */
export const W = 1080;
export const H = 1920;

/** Text inside a double-quoted attribute. */
export const attr = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** JSON inside a single-quoted attribute (a clip's `overrides`). */
export const jsonAttr = (value: unknown): string => JSON.stringify(value).replace(/&/g, "&amp;").replace(/'/g, "&#39;");

/** A number as CSS writes it: at most four decimals, no trailing zeros. */
export const num = (value: number): string => String(Number(value.toFixed(4)));

/** A clip ready to be written, with the film milliseconds it covers. */
export interface Placed {
  from: number;
  to: number;
  html: string;
}

/** Order by start, then by end: the order `pack` is given for items that have no order of their own. */
export const byStart = (a: Placed, b: Placed): number => a.from - b.from || a.to - b.to;

/**
 * First-fit packing, in the order given: an item goes on the first track where it overlaps
 * nothing. A film's track may not hold overlapping clips, and the same input always gives the
 * same tracks.
 */
export function pack(items: Placed[]): Placed[][] {
  const tracks: Placed[][] = [];
  for (const item of items) {
    const free = tracks.find((track) => track.every((other) => other.to <= item.from || item.to <= other.from));
    if (free) free.push(item);
    else tracks.push([item]);
  }
  for (const track of tracks) track.sort(byStart);
  return tracks;
}

export function section(items: Placed[]): string {
  return `<section>\n${items.map((item) => `  ${item.html}`).join("\n")}\n</section>`;
}

/**
 * The film's head. Identical for every edit except the keyframes block (spec R5): the in-page
 * player applies a changed film in place only when everything else in the head is unchanged.
 */
export function head(keyframes: string[]): string {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8">',
    `<meta name="viewport" content="width=${W}, height=${H}">`,
    "<style>",
    ...keyframes,
    "</style>",
    "</head>",
  ].join("\n");
}
```

Create `src/lib/edit/compile/keyframes.ts`:

```ts
/**
 * keyframes.ts — a segment's move as CSS keyframes.
 *
 * A film clip moves by CSS animation with `translate`, `scale` and `rotate` only (never `left`,
 * `top` or `transform`), on its own time. The name is derived from the move, so equal moves
 * share one block and the film's keyframes are the same for the same edit.
 *
 * Pans and the shake carry a small constant scale: without it the move would uncover the stage
 * at the clip's edge.
 */
import type { Move } from "../spec";
import { num } from "./html";

export function moveName(move: Move): string {
  return `mv-${move.kind}-${Math.round(move.amount * 100)}`;
}

/** The body of the move's `@keyframes` block. */
export function moveKeyframes(move: Move): string {
  const a = move.amount;
  switch (move.kind) {
    case "push-in":
      return `from { scale: 1 } to { scale: ${num(1 + 0.2 * a)} }`;
    case "push-out":
      return `from { scale: ${num(1 + 0.2 * a)} } to { scale: 1 }`;
    case "pan-left":
      return `from { scale: ${num(1 + 0.08 * a)}; translate: ${num(4 * a)}vw 0 } to { scale: ${num(1 + 0.08 * a)}; translate: ${num(-4 * a)}vw 0 }`;
    case "pan-right":
      return `from { scale: ${num(1 + 0.08 * a)}; translate: ${num(-4 * a)}vw 0 } to { scale: ${num(1 + 0.08 * a)}; translate: ${num(4 * a)}vw 0 }`;
    case "shake": {
      const s = num(1 + 0.03 * a);
      const d = num(1.2 * a);
      const stops: [number, string][] = [
        [0, "0 0"], [20, `${d}vw -${d}vw`], [40, `-${d}vw ${d}vw`], [60, `${d}vw ${d}vw`], [80, `-${d}vw -${d}vw`], [100, "0 0"],
      ];
      return stops.map(([at, translate]) => `${at}% { scale: ${s}; translate: ${translate} }`).join(" ");
    }
  }
}

/** One line of the film's keyframes block. */
export function keyframesLine(move: Move): string {
  return `@keyframes ${moveName(move)} { ${moveKeyframes(move)} }`;
}
```

- [ ] **Step 4: Write the main sequence**

Create `src/lib/edit/compile/main.ts`:

```ts
/**
 * main.ts — the main sequence as film clips, and how one segment hands over to the next.
 *
 * Segments play in order with no gaps, on "main A". A dissolve needs both pictures at once, so
 * the two segments overlap around the cut and sit on different tracks: each dissolve switches
 * between main A (below) and main B (above). ONLY THE UPPER CLIP FADES; the lower one is whole
 * beneath it. Two half-transparent pictures over black would dip in brightness at the middle.
 *
 * The cut itself never moves: the outgoing clip runs a few frames past it and the incoming one
 * starts a few frames before it, each only as far as its source file allows.
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §5.2 and §5.3.
 */
import { starts, total } from "../derive";
import { FILTERS, KIT_DIR, WIPES } from "../kit";
import type { Asset, EditSpec, Framing, Segment } from "../spec";
import { FPS, frameMs, sec, sourceMs } from "../time";
import { H, W, attr, jsonAttr, type Placed } from "./html";
import { moveName } from "./keyframes";

interface MainClip {
  seg: Segment;
  asset: Asset;
  /** 0: main A, below. 1: main B, above. */
  track: 0 | 1;
  /** the frames it covers on the film, after any dissolve */
  fromF: number;
  toF: number;
  /** frames it starts before its own first frame (a dissolve's lead-in) */
  leadF: number;
  fadeInF: number;
  fadeOutF: number;
}

/** The clip's box in stage pixels (spec §5.2). `whole`: show the whole picture instead of filling the stage. */
export function boxOf(asset: Asset, framing: Framing, whole: boolean): { left: number; top: number; width: number; height: number } {
  const w = asset.w ?? W;
  const h = asset.h ?? H;
  const fit = whole ? Math.min(W / w, H / h) : Math.max(W / w, H / h);
  const width = Math.round(w * fit * framing.zoom);
  const height = Math.round(h * fit * framing.zoom);
  return {
    width,
    height,
    /* `+ 0`: a centred box would otherwise be -0 */
    left: Math.round((-(width - W) * (1 + framing.x)) / 2) + 0,
    top: Math.round((-(height - H) * (1 + framing.y)) / 2) + 0,
  };
}

/** Whole frames of source that lie before a segment's in-point, or after its out-point. */
function spare(seg: Segment, asset: Asset, start: number, side: "before" | "after"): number {
  if (asset.kind === "image") return Number.MAX_SAFE_INTEGER;
  const perFrame = (1000 / FPS) * seg.speed;
  if (side === "before") return Math.floor(seg.inMs / perFrame);
  const left = (asset.ms ?? 0) - seg.inMs - sourceMs(start, seg.len, seg.speed);
  return Math.max(0, Math.floor(left / perFrame));
}

function plan(spec: EditSpec): { clips: MainClip[]; wipes: Placed[] } {
  const at = starts(spec);
  const end = total(spec);
  const clips: MainClip[] = spec.main.map((seg, i) => {
    const asset = spec.assets[seg.asset];
    if (!asset) throw new Error(`segment "${seg.id}" names a missing asset`);
    return { seg, asset, track: 0, fromF: at[i] ?? 0, toF: at[i + 1] ?? 0, leadF: 0, fadeInF: 0, fadeOutF: 0 };
  });
  const wipes: Placed[] = [];

  for (let i = 0; i + 1 < clips.length; i++) {
    const a = clips[i];
    const b = clips[i + 1];
    if (!a || !b) continue;
    const cut = a.seg.cutOut;
    b.track = a.track;

    if (cut.kind === "wipe") {
      const frames = WIPES[cut.id].frames;
      const fromF = Math.max(0, (at[i + 1] ?? 0) - Math.floor(frames / 2));
      const toF = Math.min(end, fromF + frames);
      const tint = cut.color && WIPES[cut.id].tint ? ` overrides='${jsonAttr([{ at: "html", style: { "--color": cut.color } }])}'` : "";
      wipes.push({
        from: frameMs(fromF),
        to: frameMs(toF),
        html: `<iframe id="wipe-${a.seg.id}" src="${KIT_DIR}/wipes/${cut.id}.html#t=0,${sec(frameMs(toF) - frameMs(fromF))}" at="${sec(frameMs(fromF))}"${tint}></iframe>`,
      });
      continue;
    }
    if (cut.kind !== "fade") continue;

    const half = Math.floor(cut.len / 2);
    if (cut.style === "dip-black") {
      a.fadeOutF = Math.min(half, Math.floor(a.seg.len / 2));
      b.fadeInF = Math.min(cut.len - half, Math.floor(b.seg.len / 2));
      continue;
    }
    /* a dissolve: each side as far as its source allows, and never past the middle of its neighbour */
    const tail = Math.min(half, Math.floor(b.seg.len / 2), spare(a.seg, a.asset, at[i] ?? 0, "after"));
    const lead = Math.min(cut.len - half, Math.floor(a.seg.len / 2), spare(b.seg, b.asset, at[i + 1] ?? 0, "before"));
    if (tail + lead === 0) continue; // no spare source on either side: a cut
    a.toF += tail;
    b.fromF -= lead;
    b.leadF = lead;
    b.track = a.track === 0 ? 1 : 0;
    if (b.track === 1) b.fadeInF = tail + lead;
    else a.fadeOutF = tail + lead;
  }
  return { clips, wipes };
}

/** A clip's place on the film and in its source, in milliseconds. */
function windowOf(clip: MainClip): { fromMs: number; toMs: number; inMs: number; outMs: number; fadeIn: number; fadeOut: number } {
  const fromMs = frameMs(clip.fromF);
  const toMs = frameMs(clip.toF);
  let fadeIn = frameMs(clip.fromF + clip.fadeInF) - fromMs;
  let fadeOut = toMs - frameMs(clip.toF - clip.fadeOutF);
  if (fadeIn + fadeOut > toMs - fromMs) fadeOut = Math.max(0, toMs - fromMs - fadeIn);
  if (fadeIn > toMs - fromMs) fadeIn = toMs - fromMs;
  if (clip.asset.kind === "image") return { fromMs, toMs, inMs: 0, outMs: toMs - fromMs, fadeIn, fadeOut };
  const ownStart = frameMs(clip.fromF + clip.leadF);
  const inMs = Math.max(0, clip.seg.inMs - Math.floor((ownStart - fromMs) * clip.seg.speed));
  const outMs = Math.min(clip.asset.ms ?? Number.MAX_SAFE_INTEGER, inMs + Math.floor((toMs - fromMs) * clip.seg.speed));
  return { fromMs, toMs, inMs, outMs, fadeIn, fadeOut };
}

function clipHtml(clip: MainClip, file: string, look: EditSpec["look"], blur: boolean): Placed {
  const { seg, asset } = clip;
  const win = windowOf(clip);
  const image = asset.kind === "image";
  const box = blur ? boxOf(asset, { zoom: 1, x: 0, y: 0 }, false) : boxOf(asset, seg.framing, seg.fit === "blur");
  const style = [`left: ${box.left}px`, `top: ${box.top}px`, `width: ${box.width}px`, `height: ${box.height}px`];
  const filter = seg.filter ?? look.filter;
  if (blur) style.push("filter: blur(40px) brightness(.7)");
  else if (filter) style.push(`filter: ${FILTERS[filter]}`);
  if (!blur && seg.move) style.push(`animation: ${moveName(seg.move)} var(--clip-length) linear both`);

  const src = image ? `${file}#t=0,${sec(win.toMs - win.fromMs)}` : `${file}#t=${sec(win.inMs)},${sec(win.outMs)}`;
  const parts = [`id="${blur ? "blur" : "seg"}-${seg.id}"`, `src="${attr(src)}"`, `at="${sec(win.fromMs)}"`];
  if (!image) {
    if (seg.speed !== 1) parts.push(`speed="${seg.speed}"`);
    if (blur || seg.volume === 0) parts.push("muted");
    else if (seg.volume !== 1) parts.push(`volume="${seg.volume}"`);
  }
  parts.push(`style="${attr(style.join("; "))}"`);
  if (win.fadeIn || win.fadeOut) parts.push(`overrides='${jsonAttr([{ fade: [win.fadeIn / 1000, win.fadeOut / 1000] }])}'`);
  return { from: win.fromMs, to: win.toMs, html: image ? `<img ${parts.join(" ")}>` : `<video ${parts.join(" ")}></video>` };
}

export interface MainTracks {
  /** main B: the upper track, used only when the edit has a dissolve */
  b: Placed[];
  /** the blurred copies behind main B's segments with `fit: "blur"`: directly beneath them, so they dissolve together */
  blurB: Placed[];
  a: Placed[];
  blurA: Placed[];
  wipes: Placed[];
}

/** The main sequence as film clips. `file` gives the path of an asset inside the film folder. */
export function mainTracks(spec: EditSpec, file: (assetId: string) => string): MainTracks {
  const { clips, wipes } = plan(spec);
  const out: MainTracks = { a: [], blurA: [], b: [], blurB: [], wipes };
  for (const clip of clips) {
    const path = file(clip.seg.asset);
    (clip.track === 0 ? out.a : out.b).push(clipHtml(clip, path, spec.look, false));
    if (clip.seg.fit === "blur") (clip.track === 0 ? out.blurA : out.blurB).push(clipHtml(clip, path, spec.look, true));
  }
  return out;
}
```

- [ ] **Step 5: Write captions, then text, layers and sounds**

Create `src/lib/edit/compile/captions.ts`:

```ts
/**
 * captions.ts — captions worked out from words.
 *
 * An edit stores no caption lines. Every source that can be heard carries its transcript (words
 * timed in the source's own milliseconds); the lines are worked out from the part of each source
 * that is on the film. So a trim moves the captions with it, with no re-transcription, and a
 * correction is kept by asset and word index, which survive trims and reorders (spec F2).
 *
 * The file is WebVTT on the film's time, as OpenFilm's caption track reads it: one STYLE block,
 * one cue per line, a timestamp before every word so the player can tell said from still to come.
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §3.4 and §5.4.
 */
import { frameOf, starts } from "../derive";
import { FONTS, KIT_DIR } from "../kit";
import type { EditSpec, Word } from "../spec";
import { frameMs, sourceMs, spanMs } from "../time";
import { num } from "./html";

/** Shorter than this, a line is a flicker, not a caption. */
const MIN_CUE_MS = 120;

export interface Cue {
  /** film milliseconds */
  start: number;
  end: number;
  words: { at: number; text: string }[];
}

interface Heard {
  assetId: string;
  words: Word[];
  /** the part of the source on the film, in the source's milliseconds */
  inMs: number;
  usedMs: number;
  /** where that part starts and ends on the film */
  atMs: number;
  endMs: number;
  speed: number;
}

/** Every source that is heard and has words, in film order. */
function heard(spec: EditSpec): Heard[] {
  const out: Heard[] = [];
  const at = starts(spec);
  spec.main.forEach((seg, i) => {
    const asset = spec.assets[seg.asset];
    if (!asset || asset.kind !== "video" || !asset.words || seg.volume === 0) return;
    const start = at[i] ?? 0;
    out.push({
      assetId: asset.id, words: asset.words, inMs: seg.inMs, usedMs: sourceMs(start, seg.len, seg.speed),
      atMs: frameMs(start), endMs: frameMs(start + seg.len), speed: seg.speed,
    });
  });
  for (const sound of spec.sounds) {
    const asset = spec.assets[sound.asset];
    const start = frameOf(spec, sound);
    if (sound.role !== "voiceover" || !asset?.words || sound.volume === 0 || start == null) continue;
    out.push({
      assetId: asset.id, words: asset.words, inMs: sound.inMs, usedMs: spanMs(start, sound.len),
      atMs: frameMs(start), endMs: frameMs(start + sound.len), speed: 1,
    });
  }
  return out.sort((a, b) => a.atMs - b.atMs);
}

/** The caption lines of the edit, on the film's time. */
export function cuesOf(spec: EditSpec): Cue[] {
  const { maxWords } = spec.captions.style;
  const cues: Cue[] = [];

  for (const src of heard(spec)) {
    const fixes = spec.captions.fixes[src.assetId] ?? {};
    let group: { at: number; end: number; text: string }[] = [];
    const close = (): void => {
      const first = group[0];
      const last = group[group.length - 1];
      if (first && last) {
        const start = Math.max(src.atMs, first.at);
        const end = Math.min(src.endMs, last.end);
        if (end - start >= MIN_CUE_MS) {
          cues.push({ start, end, words: group.map((w) => ({ at: Math.min(end - 1, Math.max(start, w.at)), text: w.text })) });
        }
      }
      group = [];
    };

    src.words.forEach((word, index) => {
      const middle = (word.t0 + word.t1) / 2;
      if (middle < src.inMs || middle >= src.inMs + src.usedMs) return;
      const fixed = fixes[String(index)];
      if (fixed === null) return; // hidden
      const text = fixed ?? word.text;
      group.push({
        at: src.atMs + Math.floor((word.t0 - src.inMs) / src.speed),
        end: src.atMs + Math.floor((word.t1 - src.inMs) / src.speed),
        text,
      });
      if (group.length === maxWords || /[.!?]$/.test(text)) close();
    });
    close();
  }

  /* one line at a time: a line ends where the next begins */
  cues.sort((a, b) => a.start - b.start);
  cues.forEach((cue, i) => {
    const next = cues[i + 1];
    if (next && cue.end > next.start) cue.end = next.start;
  });
  return cues.filter((cue) => cue.end - cue.start >= MIN_CUE_MS);
}

/** `00:00:01.866` */
function stamp(ms: number): string {
  const pad = (n: number, width = 2): string => String(n).padStart(width, "0");
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
}

const vttText = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The caption track's file for those lines. */
export function vttOf(spec: EditSpec, cues: Cue[]): string {
  const style = spec.captions.style;
  const font = FONTS[style.font];
  const lines = [
    "WEBVTT",
    "",
    "STYLE",
    `@font-face { font-family: '${font.family}'; src: url('${KIT_DIR}/${font.file}') format('woff2'); font-weight: 100 900; }`,
    `::cue { --box: ${style.fill ?? "none"}; --font: '${font.family}', sans-serif; --weight: ${style.weight}; --size: ${num((style.size / 1920) * 100)}cqh; `
      + `--color: ${style.color}; --stroke: ${style.stroke ? `${num(style.stroke.w)}px` : "0"}; --stroke-color: ${style.stroke?.color ?? "transparent"}; `
      + `text-transform: ${style.uppercase ? "uppercase" : "none"}; }`,
    `::cue(:future) { opacity: ${num(1 - style.dimAhead)}; }`,
    ...(style.highlight ? [`::cue(:past:not(:has(~ :past))) { color: ${style.highlight}; }`] : []),
    "",
  ];
  const place = `line:${num(style.y * 100)}%,center size:${num(style.width * 100)}%`;
  cues.forEach((cue, i) => {
    lines.push(`c${i + 1}`, `${stamp(cue.start)} --> ${stamp(cue.end)} ${place}`, cue.words.map((w) => `<${stamp(w.at)}>${vttText(w.text)}`).join(" "), "");
  });
  return lines.join("\n");
}
```

Create `src/lib/edit/compile/items.ts`:

```ts
/**
 * items.ts — text, layers and sounds as film clips.
 *
 * Text is ONE kit page (`text.html`) for every text item. What a text says, how it looks, where
 * it sits and how it comes and goes all travel in the clip's `overrides`, as its words and as CSS
 * variables on the page's `#t` element. So editing a text changes film.html only, never a file,
 * and the in-page player applies it in place (spec F3, proved 2026-11-11).
 *
 * Anything that runs past the film's end is cut off there.
 */
import { frameOf, total } from "../derive";
import { FONTS, KIT_DIR } from "../kit";
import type { EditSpec, Layer, Sound, TextItem } from "../spec";
import { frameMs, sec, spanMs } from "../time";
import { H, W, attr, jsonAttr, num, type Placed } from "./html";

/** The film milliseconds an item covers, cut at the film's end; null when it is not on the film at all. */
function span(spec: EditSpec, item: { pin: string | null; at: number; len: number }): { from: number; to: number; start: number; len: number } | null {
  const start = frameOf(spec, item);
  const end = total(spec);
  if (start == null || start >= end) return null;
  const len = Math.min(item.len, end - start);
  return { from: frameMs(start), to: frameMs(start + len), start, len };
}

function textVars(text: TextItem, lenMs: number): Record<string, string> {
  const style = text.style;
  return {
    "--x": num(text.box.x),
    "--y": num(text.box.y),
    "--w": num(text.box.w),
    "--font": `'${FONTS[style.font].family}'`,
    "--weight": String(style.weight),
    "--size": `${num(style.size)}px`,
    "--color": style.color,
    "--fill": style.fill ?? "transparent",
    "--pad": style.preset === "label" ? "18px 30px" : "0",
    "--radius": style.preset === "label" ? "22px" : "0",
    "--stroke": style.stroke ? `${num(style.stroke.w)}px` : "0",
    "--stroke-color": style.stroke?.color ?? "transparent",
    "--align": style.align,
    "--case": style.uppercase ? "uppercase" : "none",
    "--rotate": `${num(text.rotate)}deg`,
    "--in": text.in ?? "none",
    "--out": text.out ?? "none",
    "--len": num(lenMs / 1000),
  };
}

export function textClips(spec: EditSpec): Placed[] {
  const out: Placed[] = [];
  for (const text of spec.texts) {
    const at = span(spec, text);
    if (!at) continue;
    const overrides = [{ at: "#t", text: text.text, style: textVars(text, at.to - at.from) }];
    out.push({
      from: at.from,
      to: at.to,
      html: `<iframe id="txt-${text.id}" src="${KIT_DIR}/text.html#t=0,${sec(at.to - at.from)}" at="${sec(at.from)}" overrides='${jsonAttr(overrides)}'></iframe>`,
    });
  }
  return out;
}

function layerClip(spec: EditSpec, layer: Layer, file: (assetId: string) => string): Placed | null {
  const at = span(spec, layer);
  const asset = spec.assets[layer.asset];
  if (!at || !asset) return null;
  const image = asset.kind === "image";
  const style = [
    `left: ${Math.round(layer.box.x * W)}px`, `top: ${Math.round(layer.box.y * H)}px`,
    `width: ${Math.round(layer.box.w * W)}px`, `height: ${Math.round(layer.box.h * H)}px`,
    "object-fit: cover",
  ];
  if (layer.rotate) style.push(`rotate: ${num(layer.rotate)}deg`);
  if (layer.opacity !== 1) style.push(`opacity: ${num(layer.opacity)}`);
  if (layer.radius) style.push(`border-radius: ${num(layer.radius)}px`);

  const lenMs = at.to - at.from;
  const outMs = Math.min(asset.ms ?? Number.MAX_SAFE_INTEGER, layer.inMs + Math.floor(lenMs * layer.speed));
  const src = image ? `${file(layer.asset)}#t=0,${sec(lenMs)}` : `${file(layer.asset)}#t=${sec(layer.inMs)},${sec(outMs)}`;
  const parts = [`id="lay-${layer.id}"`, `src="${attr(src)}"`, `at="${sec(at.from)}"`];
  if (!image) {
    if (layer.speed !== 1) parts.push(`speed="${layer.speed}"`);
    if (layer.volume === 0) parts.push("muted");
    else if (layer.volume !== 1) parts.push(`volume="${layer.volume}"`);
  }
  parts.push(`style="${attr(style.join("; "))}"`);
  return { from: at.from, to: at.to, html: image ? `<img ${parts.join(" ")}>` : `<video ${parts.join(" ")}></video>` };
}

/** Layers, the highest `z` first: packed in that order, a higher layer always lands on a track above a lower one it overlaps. */
export function layerClips(spec: EditSpec, file: (assetId: string) => string): Placed[] {
  return [...spec.layers]
    .sort((a, b) => b.z - a.z)
    .map((layer) => layerClip(spec, layer, file))
    .filter((clip): clip is Placed => clip !== null);
}

function soundClip(spec: EditSpec, sound: Sound, file: (assetId: string) => string): Placed | null {
  const at = span(spec, sound);
  const asset = spec.assets[sound.asset];
  if (!at || !asset) return null;
  /* a sound shorter than its place on the film ends when its file does */
  const outMs = Math.min(asset.ms ?? Number.MAX_SAFE_INTEGER, sound.inMs + (at.to - at.from));
  if (outMs <= sound.inMs) return null;
  const lenMs = outMs - sound.inMs;
  let fadeIn = Math.min(lenMs, spanMs(at.start, Math.min(sound.fadeIn, at.len)));
  let fadeOut = Math.min(lenMs, at.to - frameMs(at.start + at.len - Math.min(sound.fadeOut, at.len)));
  if (fadeIn + fadeOut > lenMs) { fadeIn = Math.floor(lenMs / 2); fadeOut = lenMs - fadeIn; }

  const parts = [`id="snd-${sound.id}"`, `src="${attr(`${file(sound.asset)}#t=${sec(sound.inMs)},${sec(outMs)}`)}"`, `at="${sec(at.from)}"`];
  if (sound.volume === 0) parts.push("muted");
  else if (sound.volume !== 1) parts.push(`volume="${sound.volume}"`);
  if (fadeIn || fadeOut) parts.push(`overrides='${jsonAttr([{ fade: [fadeIn / 1000, fadeOut / 1000] }])}'`);
  return { from: at.from, to: at.from + lenMs, html: `<audio ${parts.join(" ")}></audio>` };
}

export function soundClips(spec: EditSpec, file: (assetId: string) => string): Placed[] {
  return spec.sounds.map((sound) => soundClip(spec, sound, file)).filter((clip): clip is Placed => clip !== null);
}
```

- [ ] **Step 6: Write the entry point**

Create `src/lib/edit/compile/index.ts`:

```ts
/**
 * compile — an EditSpec as the files of an OpenFilm film folder.
 *
 * ONE compiler for the live preview (in the browser) and the render (in Node). The only thing
 * that differs between them is which file stands for each asset, and that is the caller's:
 * `opts.file`. The compiler reads no file and looks at no clock, so the same document always
 * gives the same bytes.
 *
 * It refuses a document that fails `checkEditSpec`, so nothing downstream ever sees a film made
 * from a broken edit.
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §5.
 */
import { EditSpecError, checkEditSpec } from "../check";
import { total } from "../derive";
import { KIT, KIT_DIR } from "../kit";
import type { Asset, EditSpec, Move } from "../spec";
import { cuesOf, vttOf } from "./captions";
import { attr, byStart, head, pack, section, type Placed } from "./html";
import { layerClips, soundClips, textClips } from "./items";
import { keyframesLine, moveName } from "./keyframes";
import { mainTracks } from "./main";

export interface CompileOptions {
  /** The path, inside the film folder, of the file that stands for an asset: `assets/<id>.mp4`. Never asked about kit assets. */
  file: (asset: Asset) => string;
}

export interface Compiled {
  files: { "film.html": string; "captions.vtt"?: string };
  /** What has to be put in the film folder, beside the kit. */
  assets: { id: string; file: string }[];
  kit: typeof KIT;
  /** The film's length. */
  frames: number;
}

export function compile(spec: EditSpec, opts: CompileOptions): Compiled {
  const problems = checkEditSpec(spec);
  if (problems.length) throw new EditSpecError(problems);

  const used = new Map<string, string>();
  const file = (assetId: string): string => {
    const asset = spec.assets[assetId];
    if (!asset) throw new Error(`the edit names a missing asset "${assetId}"`);
    if ("kit" in asset.at) return `${KIT_DIR}/${asset.at.kit}`;
    const known = used.get(assetId);
    if (known) return known;
    const path = opts.file(asset);
    used.set(assetId, path);
    return path;
  };

  const sections: string[] = [];
  const add = (track: Placed[]): void => { if (track.length) sections.push(section(track)); };

  const cues = spec.captions.on ? cuesOf(spec) : [];
  if (cues.length) {
    sections.push(`<section>\n  <track kind="captions" src="captions.vtt" srclang="${attr(spec.captions.lang)}" label="Captions">\n</section>`);
  }
  const main = mainTracks(spec, file);
  for (const track of pack(textClips(spec).sort(byStart))) add(track);
  for (const track of pack(main.wipes.sort(byStart))) add(track);
  for (const track of pack(layerClips(spec, file))) add(track);
  add(main.b);
  add(main.blurB);
  add(main.a);
  add(main.blurA);
  for (const track of pack(soundClips(spec, file).sort(byStart))) add(track);

  const moves = new Map<string, Move>();
  for (const seg of spec.main) if (seg.move) moves.set(moveName(seg.move), seg.move);
  const keyframes = [...moves.keys()].sort().map((name) => keyframesLine(moves.get(name) as Move));

  const film = `${head(keyframes)}\n<body>\n${sections.join("\n")}\n</body>\n</html>\n`;
  return {
    files: cues.length ? { "film.html": film, "captions.vtt": vttOf(spec, cues) } : { "film.html": film },
    assets: [...used].map(([id, path]) => ({ id, file: path })),
    kit: KIT,
    frames: total(spec),
  };
}
```

- [ ] **Step 7: Run the test and see it pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/compile.test.ts`
Expected: PASS, 20 tests, and `Snapshots 2 written`.

- [ ] **Step 8: Read the two snapshots, then run again**

Open `src/lib/edit/__tests__/__snapshots__/fixture.film.html`. Check by eye:
- `seg-s3` is on a section above `seg-s2`, starts at `3.233` and carries `overrides='[{"fade":[0.4,0]}]'`; `blur-s3` is on the section directly below it with the same fade.
- `seg-s2` reads `#t=1.866,3.633`.
- `wipe-s3` is `kit/v1/wipes/shutter.html#t=0,0.8` at `5.033`.
- `snd-k1` reads `kit/v1/sfx/kick.m4a#t=0,0.45` at `1.866`.

Open `fixture.captions.vtt`: cue `c3` starts at `00:00:01.866` and cue `c4` reads `Virtuna App will`.

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/compile.test.ts`
Expected: PASS, 20 tests, no snapshot written.

- [ ] **Step 9: Stage**

```bash
git add src/lib/edit/compile src/lib/edit/__tests__/compile.test.ts src/lib/edit/__tests__/__snapshots__
```

---

### Task 6: The operations

**Files:**
- Create: `src/lib/edit/ops.ts`
- Test: `src/lib/edit/__tests__/ops.test.ts`

**Interfaces:**
- Consumes: the schemas and types of Task 3, `checkEditSpec` of Task 4, `starts` of Task 4, `compile` and `cuesOf` of Task 5 (in the test).
- Produces: `OpSchema`, `Op` (a union discriminated by `op`: `segment.trim | segment.split | segment.remove | segment.move | segment.insert | segment.replace | segment.set | text.add | text.set | text.remove | layer.add | layer.set | layer.remove | sound.add | sound.set | sound.remove | captions.set | captions.fix | asset.add | asset.words | look.set | cover.set | ref.set`), `parseOps(json: unknown): Op[]`, `applyOps(spec: EditSpec, ops: Op[]): EditSpec`, `EditOpError` (`code`, `index`). Refusal codes of its own: `not-found`, `id-taken`, `split-range`, `last-segment`, `asset-missing`, `source-too-short`; plus every `ProblemCode`, and `invalid` for a value the schema refuses.

- [ ] **Step 1: Write the failing test**

Create `src/lib/edit/__tests__/ops.test.ts`:

```ts
/**
 * ops.test.ts — the operations, and the promise that they cannot break an edit.
 *
 * The second half is the one that matters most: 500 seeded random sequences of operations. Every
 * sequence either is refused, leaving the edit exactly as it was, or gives an edit that passes
 * the checks and compiles to a film OpenFilm's reader accepts. The chat and the auto-edit will
 * produce operations nobody has tried by hand; this is what stands between them and a broken film.
 */
import { readFilmFile } from "openfilm/film-doc";
import { describe, expect, it } from "vitest";
import { checkEditSpec } from "../check";
import { compile } from "../compile";
import { cuesOf } from "../compile/captions";
import { frameOf, total } from "../derive";
import { EditOpError, applyOps, parseOps, type Op } from "../ops";
import { newSegment, newText, type EditSpec } from "../spec";
import { file, fixture } from "./fixture";

const refusal = (fn: () => unknown): EditOpError => {
  try {
    fn();
  } catch (e) {
    if (e instanceof EditOpError) return e;
    throw e;
  }
  throw new Error("the operation was not refused");
};

describe("segment operations", () => {
  it("trim changes where a segment starts in its source and how long it is", () => {
    const spec = applyOps(fixture(), [{ op: "segment.trim", id: "s1", inMs: 300, len: 40 }]);
    expect(spec.main[0]).toMatchObject({ inMs: 300, len: 40 });
    expect(total(spec)).toBe(282);
  });

  it("split makes two segments that play the same frames as before", () => {
    const spec = applyOps(fixture(), [{ op: "segment.split", id: "s2", at: 20, newId: "s2b" }]);
    expect(spec.main.map((s) => s.id)).toEqual(["s1", "s2", "s2b", "s3", "s4", "s5"]);
    expect(spec.main[1]).toMatchObject({ len: 20, inMs: 1866, cutOut: { kind: "cut" } });
    expect(spec.main[2]).toMatchObject({ len: 27, inMs: 1866 + 667, cutOut: { kind: "fade", style: "dissolve", len: 12 } });
    expect(total(spec)).toBe(298);
  });

  it("split hands what was pinned past it to the second half", () => {
    const base = applyOps(fixture(), [{ op: "text.add", item: newText({ id: "late", text: "x", at: 30, len: 10, pin: "s2" }) }]);
    const spec = applyOps(base, [{ op: "segment.split", id: "s2", at: 20, newId: "s2b" }]);
    expect(spec.texts.find((t) => t.id === "late")).toMatchObject({ pin: "s2b", at: 10 });
    expect(spec.sounds.find((s) => s.id === "k1")).toMatchObject({ pin: "s2", at: 0 });
    expect(frameOf(spec, spec.texts.find((t) => t.id === "late")!)).toBe(frameOf(base, base.texts.find((t) => t.id === "late")!));
  });

  it("split refuses to leave under three frames on a side", () => {
    expect(refusal(() => applyOps(fixture(), [{ op: "segment.split", id: "s2", at: 45, newId: "x" }])).code).toBe("split-range");
  });

  it("remove takes what was pinned to the segment with it, and never the last segment", () => {
    const spec = applyOps(fixture(), [{ op: "segment.remove", id: "s1" }]);
    expect(spec.texts.map((t) => t.id)).toEqual(["t2"]);
    const one = applyOps(fixture(), ["s1", "s2", "s3", "s4"].map((id) => ({ op: "segment.remove", id }) as Op));
    expect(refusal(() => applyOps(one, [{ op: "segment.remove", id: "s5" }])).code).toBe("last-segment");
  });

  it("move reorders, and a pinned text travels with its segment", () => {
    const spec = applyOps(fixture(), [{ op: "segment.move", id: "s1", to: 4 }]);
    expect(spec.main.map((s) => s.id)).toEqual(["s2", "s3", "s4", "s5", "s1"]);
    expect(frameOf(spec, spec.texts[0]!)).toBe(298 - 56);
  });

  it("replace keeps the length when the new source is long enough and shortens it when not", () => {
    const kept = applyOps(fixture(), [{ op: "segment.replace", id: "s1", asset: "broll", inMs: 0 }]);
    expect(kept.main[0]).toMatchObject({ asset: "broll", len: 56 });
    const cut = applyOps(fixture(), [{ op: "segment.replace", id: "s5", asset: "broll", inMs: 6000 }]);
    expect(cut.main[4]).toMatchObject({ asset: "broll", inMs: 6000, len: 60 }); // 2 s left in an 8 s file
    expect(refusal(() => applyOps(fixture(), [{ op: "segment.replace", id: "s5", asset: "broll", inMs: 7990 }])).code).toBe("source-too-short");
  });

  it("a speed change keeps the stretch of source and changes the length on the film", () => {
    const spec = applyOps(fixture(), [{ op: "segment.set", id: "s1", patch: { speed: 2 } }]);
    expect(spec.main[0]).toMatchObject({ speed: 2, len: 28 });
  });

  it("set changes framing, move, filter and the hand-over", () => {
    const spec = applyOps(fixture(), [{
      op: "segment.set", id: "s1",
      patch: { framing: { zoom: 2, x: 0.5, y: 0 }, move: { kind: "shake", amount: 1 }, filter: "warm", cutOut: { kind: "wipe", id: "glitch" } },
    }]);
    expect(spec.main[0]).toMatchObject({ framing: { zoom: 2, x: 0.5, y: 0 }, move: { kind: "shake", amount: 1 }, filter: "warm", cutOut: { kind: "wipe", id: "glitch" } });
  });

  it("insert adds a segment at an index", () => {
    const spec = applyOps(fixture(), [{ op: "segment.insert", index: 1, segment: newSegment({ id: "new", asset: "photo", len: 30 }) }]);
    expect(spec.main.map((s) => s.id)).toEqual(["s1", "new", "s2", "s3", "s4", "s5"]);
    expect(refusal(() => applyOps(fixture(), [{ op: "segment.insert", index: 0, segment: newSegment({ id: "s1", asset: "photo", len: 30 }) }])).code).toBe("id-taken");
  });
});

describe("text, sound, layer and caption operations", () => {
  it("add, set and remove a text", () => {
    let spec = applyOps(fixture(), [{ op: "text.add", item: newText({ id: "t3", text: "new", at: 10, len: 20 }) }]);
    spec = applyOps(spec, [{ op: "text.set", id: "t3", patch: { text: "changed", box: { x: 0.2, y: 0.8, w: 0.5 } } }]);
    expect(spec.texts.find((t) => t.id === "t3")).toMatchObject({ text: "changed", box: { x: 0.2, y: 0.8, w: 0.5 }, at: 10 });
    spec = applyOps(spec, [{ op: "text.remove", id: "t3" }]);
    expect(spec.texts.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("set a sound's level and a layer's place", () => {
    const spec = applyOps(fixture(), [
      { op: "sound.set", id: "m1", patch: { volume: 0.2 } },
      { op: "layer.set", id: "l1", patch: { box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } } },
    ]);
    expect(spec.sounds[1]?.volume).toBe(0.2);
    expect(spec.layers[0]?.box).toEqual({ x: 0.1, y: 0.1, w: 0.2, h: 0.2 });
  });

  it("change part of the caption style and leave the rest", () => {
    const spec = applyOps(fixture(), [{ op: "captions.set", patch: { style: { size: 120, highlight: null } } }]);
    expect(spec.captions.style).toMatchObject({ size: 120, highlight: null, weight: 800, uppercase: true });
  });

  it("correct a word, hide a word, and undo a correction", () => {
    let spec = applyOps(fixture(), [{ op: "captions.fix", asset: "take", word: 0, text: "Hey" }, { op: "captions.fix", asset: "take", word: 1, text: null }]);
    expect(cuesOf(spec)[0]?.words.map((w) => w.text)).toEqual(["Hey", "we", "are"]);
    spec = applyOps(spec, [{ op: "captions.fix", asset: "take", word: 0 }, { op: "captions.fix", asset: "take", word: 1 }]);
    expect(cuesOf(spec)[0]?.words.map((w) => w.text)).toEqual(["Hello", "guys,", "we"]);
    expect(refusal(() => applyOps(fixture(), [{ op: "captions.fix", asset: "take", word: 99, text: "x" }])).code).toBe("fix-missing");
  });

  it("add an asset and give it words later", () => {
    let spec = applyOps(fixture(), [{ op: "asset.add", asset: { id: "vo", kind: "audio", origin: "uploaded", at: { bucket: "takes", path: "u1/vo.m4a" }, ms: 2000, sound: true, words: null } }]);
    spec = applyOps(spec, [{ op: "asset.words", id: "vo", words: [{ t0: 0, t1: 500, text: "Hi" }] }]);
    expect(spec.assets.vo?.words).toEqual([{ t0: 0, t1: 500, text: "Hi" }]);
    expect(refusal(() => applyOps(spec, [{ op: "asset.add", asset: spec.assets.vo! }])).code).toBe("id-taken");
  });
});

describe("applyOps", () => {
  it("is all or nothing, and never touches the edit it was given", () => {
    const before = fixture();
    const given = fixture();
    const error = refusal(() => applyOps(given, [{ op: "segment.trim", id: "s1", len: 30 }, { op: "segment.remove", id: "nope" }]));
    expect(error).toMatchObject({ code: "not-found", index: 1 });
    expect(given).toEqual(before);
    applyOps(given, [{ op: "segment.trim", id: "s1", len: 30 }]);
    expect(given).toEqual(before);
  });

  it("refuses a result the checks reject, with the check's code", () => {
    expect(refusal(() => applyOps(fixture(), [{ op: "segment.trim", id: "s5", inMs: 12000 }])).code).toBe("source-overrun");
    expect(refusal(() => applyOps(fixture(), [{ op: "text.set", id: "t1", patch: { pin: "gone" } }])).code).toBe("pin-missing");
  });

  it("refuses a value out of range as invalid", () => {
    expect(refusal(() => applyOps(fixture(), [{ op: "segment.set", id: "s1", patch: { speed: 9 } as never }])).code).toBe("invalid");
  });
});

describe("parseOps", () => {
  it("accepts operations and refuses unknown ones and unknown keys", () => {
    expect(parseOps([{ op: "segment.remove", id: "s1" }])).toEqual([{ op: "segment.remove", id: "s1" }]);
    expect(() => parseOps([{ op: "segment.explode", id: "s1" }])).toThrow();
    expect(() => parseOps([{ op: "segment.remove", id: "s1", force: true }])).toThrow();
  });
});

/* ── random sequences ────────────────────────────────────────────────────────────────────────── */

/** A small seeded generator (mulberry32): the same seed gives the same sequence on every machine. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomOp(spec: EditSpec, rnd: () => number, n: number): Op {
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)] as T;
  const int = (lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));
  const seg = pick(spec.main);
  const assets = Object.keys(spec.assets);
  switch (int(0, 15)) {
    case 0: return { op: "segment.trim", id: seg.id, len: int(3, 200) };
    case 1: return { op: "segment.trim", id: seg.id, inMs: int(0, 13000) };
    case 2: return { op: "segment.split", id: seg.id, at: int(3, 120), newId: `n${n}` };
    case 3: return { op: "segment.remove", id: seg.id };
    case 4: return { op: "segment.move", id: seg.id, to: int(0, 8) };
    case 5: return { op: "segment.replace", id: seg.id, asset: pick(assets), inMs: int(0, 9000) };
    case 6: return { op: "segment.set", id: seg.id, patch: { speed: pick([0.25, 0.5, 1, 1.5, 2, 4]) } };
    case 7: return { op: "segment.set", id: seg.id, patch: { cutOut: pick([{ kind: "cut" }, { kind: "fade", style: "dissolve", len: int(2, 60) }, { kind: "fade", style: "dip-black", len: int(2, 60) }, { kind: "wipe", id: pick(["swipe-blur", "glitch", "flare-whip", "shutter", "rgb-split", "datamosh"] as const) }] as const) } };
    case 8: return { op: "segment.set", id: seg.id, patch: { fit: pick(["cover", "blur"] as const), framing: { zoom: 1 + rnd() * 3, x: rnd() * 2 - 1, y: rnd() * 2 - 1 }, move: pick([null, { kind: "push-in", amount: rnd() }, { kind: "pan-left", amount: rnd() }, { kind: "shake", amount: rnd() }] as const), filter: pick([null, "vivid", "mono"] as const), volume: pick([0, 0.5, 1]) } };
    case 9: return { op: "segment.insert", index: int(0, 8), segment: newSegment({ id: `n${n}`, asset: pick(assets), len: int(3, 90), inMs: int(0, 5000) }) };
    case 10: return { op: "text.add", item: newText({ id: `x${n}`, text: `text ${n} & "more"`, at: int(0, 320), len: int(1, 200), pin: pick([null, seg.id]) }) };
    case 11: return { op: "text.remove", id: pick(spec.texts.length ? spec.texts.map((t) => t.id) : ["none"]) };
    case 12: return { op: "sound.add", item: { id: `y${n}`, pin: pick([null, seg.id]), at: int(0, 300), len: int(1, 200), role: pick(["music", "sfx", "voiceover"] as const), asset: pick(["kick", "song"]), inMs: int(0, 400), volume: rnd() * 2, fadeIn: int(0, 40), fadeOut: int(0, 40) } };
    case 13: return { op: "captions.set", patch: { on: rnd() > 0.3, style: { maxWords: int(1, 6), y: rnd(), dimAhead: rnd() } } };
    case 14: return { op: "captions.fix", asset: "take", word: int(0, 30), text: pick(["fixed", null, undefined]) };
    default: return { op: "layer.add", item: { id: `z${n}`, pin: pick([null, seg.id]), at: int(0, 300), len: int(1, 120), kind: "clip", asset: pick(["take", "broll", "photo"]), inMs: int(0, 3000), speed: pick([0.5, 1, 2]), volume: 1, box: { x: rnd(), y: rnd(), w: 0.1 + rnd(), h: 0.1 + rnd() }, rotate: rnd() * 40 - 20, opacity: rnd(), radius: int(0, 60), z: int(-3, 3) } };
  }
}

describe("500 random sequences of operations", () => {
  it("each either is refused and changes nothing, or leaves an edit that compiles to a film with no problems", () => {
    let applied = 0;
    let refused = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const rnd = random(seed);
      let spec = fixture();
      for (let step = 0; step < 12; step++) {
        const before = structuredClone(spec);
        const op = randomOp(spec, rnd, step);
        let next: EditSpec;
        try {
          next = applyOps(spec, [op]);
        } catch (e) {
          if (!(e instanceof EditOpError)) throw new Error(`seed ${seed}, step ${step}: ${JSON.stringify(op)} threw ${String(e)}`);
          expect(spec).toEqual(before);
          refused++;
          continue;
        }
        expect(spec).toEqual(before);
        expect(checkEditSpec(next), `seed ${seed}, step ${step}: ${JSON.stringify(op)}`).toEqual([]);
        const film = compile(next, { file }).files["film.html"];
        expect(readFilmFile(film).problems, `seed ${seed}, step ${step}: ${JSON.stringify(op)}`).toEqual([]);
        spec = next;
        applied++;
      }
    }
    /* the generator has to exercise both outcomes, or this test says nothing */
    expect(applied).toBeGreaterThan(1500);
    expect(refused).toBeGreaterThan(300);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/ops.test.ts`
Expected: FAIL, the import of `../ops` cannot be resolved.

- [ ] **Step 3: Write the operations**

Create `src/lib/edit/ops.ts`:

```ts
/**
 * ops.ts — the closed list of changes anyone can make to an EditSpec.
 *
 * Buttons, the chat and the auto-edit all change an edit the same way: a list of operations
 * through `applyOps`. It is pure and all-or-nothing. The result has to be a valid EditSpec that
 * passes `checkEditSpec`; otherwise it throws `EditOpError` and the document it was given is
 * untouched. Undo is a snapshot of the document kept by the caller, so there are no inverse
 * operations (spec F4).
 *
 * `parseOps` is the door for operations that come from outside the type system (a model's
 * output, a request body): unknown operations and unknown keys are refused.
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §6.
 */
import { z } from "zod";
import { checkEditSpec } from "./check";
import { starts } from "./derive";
import { FILTER_IDS } from "./kit";
import {
  AssetSchema, CaptionStyleSchema, CaptionsSchema, EditSpecSchema, IdSchema, LayerSchema, RefSchema,
  SegmentSchema, SoundSchema, TextItemSchema, WordSchema, type EditSpec, type Segment,
} from "./spec";
import { FPS, MAX_FRAMES, MIN_LEN, sourceMs } from "./time";

const Ms = z.number().int().min(0);
const Index = z.number().int().min(0);

export const OpSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("segment.trim"), id: IdSchema, inMs: Ms.optional(), len: z.number().int().min(MIN_LEN).max(MAX_FRAMES).optional() }),
  z.strictObject({ op: z.literal("segment.split"), id: IdSchema, at: z.number().int().min(MIN_LEN), newId: IdSchema }),
  z.strictObject({ op: z.literal("segment.remove"), id: IdSchema }),
  z.strictObject({ op: z.literal("segment.move"), id: IdSchema, to: Index }),
  z.strictObject({ op: z.literal("segment.insert"), segment: SegmentSchema, index: Index }),
  z.strictObject({ op: z.literal("segment.replace"), id: IdSchema, asset: IdSchema, inMs: Ms }),
  z.strictObject({
    op: z.literal("segment.set"),
    id: IdSchema,
    patch: SegmentSchema.pick({ speed: true, volume: true, fit: true, framing: true, move: true, filter: true, cutOut: true, beat: true }).partial(),
  }),
  z.strictObject({ op: z.literal("text.add"), item: TextItemSchema }),
  z.strictObject({ op: z.literal("text.set"), id: IdSchema, patch: TextItemSchema.omit({ id: true }).partial() }),
  z.strictObject({ op: z.literal("text.remove"), id: IdSchema }),
  z.strictObject({ op: z.literal("layer.add"), item: LayerSchema }),
  z.strictObject({ op: z.literal("layer.set"), id: IdSchema, patch: LayerSchema.omit({ id: true }).partial() }),
  z.strictObject({ op: z.literal("layer.remove"), id: IdSchema }),
  z.strictObject({ op: z.literal("sound.add"), item: SoundSchema }),
  z.strictObject({ op: z.literal("sound.set"), id: IdSchema, patch: SoundSchema.omit({ id: true }).partial() }),
  z.strictObject({ op: z.literal("sound.remove"), id: IdSchema }),
  z.strictObject({
    op: z.literal("captions.set"),
    patch: z.strictObject({ on: z.boolean().optional(), lang: CaptionsSchema.shape.lang.optional(), style: CaptionStyleSchema.partial().optional() }),
  }),
  /** `text`: the corrected word; null hides the word; left out, the correction is undone. */
  z.strictObject({ op: z.literal("captions.fix"), asset: IdSchema, word: Index, text: z.string().min(1).max(80).nullable().optional() }),
  z.strictObject({ op: z.literal("asset.add"), asset: AssetSchema }),
  z.strictObject({ op: z.literal("asset.words"), id: IdSchema, words: z.array(WordSchema).nullable() }),
  z.strictObject({ op: z.literal("look.set"), filter: z.enum(FILTER_IDS).nullable() }),
  z.strictObject({ op: z.literal("cover.set"), frame: z.number().int().min(0).max(MAX_FRAMES).nullable() }),
  z.strictObject({ op: z.literal("ref.set"), ref: RefSchema.nullable() }),
]);
export type Op = z.infer<typeof OpSchema>;

/** Operations from outside the type system, validated. Throws a ZodError when one is not an operation. */
export function parseOps(json: unknown): Op[] {
  return z.array(OpSchema).parse(json);
}

/** Why `applyOps` refused. `index`: which operation; `code`: a refusal's own code, or a `checkEditSpec` code, or `invalid`. */
export class EditOpError extends Error {
  constructor(readonly code: string, readonly index: number, message: string) {
    super(message);
    this.name = "EditOpError";
  }
}

class Refusal extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

function segmentAt(spec: EditSpec, id: string): { seg: Segment; index: number } {
  const index = spec.main.findIndex((seg) => seg.id === id);
  const seg = spec.main[index];
  if (!seg) throw new Refusal("not-found", `there is no segment "${id}"`);
  return { seg, index };
}

function itemAt<T extends { id: string }>(list: T[], id: string, what: string): { item: T; index: number } {
  const index = list.findIndex((item) => item.id === id);
  const item = list[index];
  if (!item) throw new Refusal("not-found", `there is no ${what} "${id}"`);
  return { item, index };
}

function addItem<T extends { id: string }>(list: T[], item: T, what: string): void {
  if (list.some((other) => other.id === item.id)) throw new Refusal("id-taken", `the id "${item.id}" is already a ${what}`);
  list.push(item);
}

/** The given fields onto the target; a field left undefined is left alone. */
function patch<T extends object>(target: T, values: Partial<T>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) (target as Record<string, unknown>)[key] = value;
  }
}

/** The longest a segment can be, up to its own length, with `ms` of source from its in-point. */
function fitLen(seg: Segment, start: number, ms: number): number {
  let len = Math.min(seg.len, Math.floor((ms - seg.inMs) / ((1000 / FPS) * seg.speed)) + 1);
  while (len > 0 && seg.inMs + sourceMs(start, len, seg.speed) > ms) len--;
  return Math.max(0, len);
}

function applyOne(spec: EditSpec, op: Op): void {
  switch (op.op) {
    case "segment.trim": {
      const { seg } = segmentAt(spec, op.id);
      if (op.inMs !== undefined) seg.inMs = op.inMs;
      if (op.len !== undefined) seg.len = op.len;
      return;
    }
    case "segment.split": {
      const { seg, index } = segmentAt(spec, op.id);
      if (op.at < MIN_LEN || op.at > seg.len - MIN_LEN) throw new Refusal("split-range", `a split leaves at least ${MIN_LEN} frames on each side`);
      if (spec.main.some((other) => other.id === op.newId)) throw new Refusal("id-taken", `the id "${op.newId}" is already a segment`);
      const start = starts(spec)[index] ?? 0;
      const image = spec.assets[seg.asset]?.kind === "image";
      const second: Segment = {
        ...structuredClone(seg),
        id: op.newId,
        len: seg.len - op.at,
        inMs: image ? 0 : seg.inMs + sourceMs(start, op.at, seg.speed),
      };
      seg.len = op.at;
      seg.cutOut = { kind: "cut" };
      spec.main.splice(index + 1, 0, second);
      /* what was pinned past the split now belongs to the second half */
      for (const item of [...spec.texts, ...spec.layers, ...spec.sounds]) {
        if (item.pin === op.id && item.at >= op.at) {
          item.pin = op.newId;
          item.at -= op.at;
        }
      }
      return;
    }
    case "segment.remove": {
      const { index } = segmentAt(spec, op.id);
      if (spec.main.length === 1) throw new Refusal("last-segment", "an edit keeps at least one segment");
      spec.main.splice(index, 1);
      spec.texts = spec.texts.filter((item) => item.pin !== op.id);
      spec.layers = spec.layers.filter((item) => item.pin !== op.id);
      spec.sounds = spec.sounds.filter((item) => item.pin !== op.id);
      return;
    }
    case "segment.move": {
      const { seg, index } = segmentAt(spec, op.id);
      spec.main.splice(index, 1);
      spec.main.splice(Math.min(op.to, spec.main.length), 0, seg);
      return;
    }
    case "segment.insert": {
      if (spec.main.some((other) => other.id === op.segment.id)) throw new Refusal("id-taken", `the id "${op.segment.id}" is already a segment`);
      spec.main.splice(Math.min(op.index, spec.main.length), 0, op.segment);
      return;
    }
    case "segment.replace": {
      const { seg, index } = segmentAt(spec, op.id);
      const asset = spec.assets[op.asset];
      if (!asset) throw new Refusal("asset-missing", `the asset "${op.asset}" is not in the edit`);
      seg.asset = op.asset;
      seg.inMs = asset.kind === "image" ? 0 : op.inMs;
      if (asset.kind === "video") {
        const len = fitLen(seg, starts(spec)[index] ?? 0, asset.ms ?? 0);
        if (len < MIN_LEN) throw new Refusal("source-too-short", `"${op.asset}" has under ${MIN_LEN} frames after ${op.inMs} ms`);
        seg.len = len;
      }
      return;
    }
    case "segment.set": {
      const { seg } = segmentAt(spec, op.id);
      const { speed, ...rest } = op.patch;
      if (speed !== undefined && speed !== seg.speed) {
        /* the same stretch of source at another speed: its length on the film changes */
        seg.len = Math.min(MAX_FRAMES, Math.max(MIN_LEN, Math.round((seg.len * seg.speed) / speed)));
        seg.speed = speed;
      }
      patch(seg, rest);
      return;
    }
    case "text.add": addItem(spec.texts, op.item, "text"); return;
    case "text.set": patch(itemAt(spec.texts, op.id, "text").item, op.patch); return;
    case "text.remove": spec.texts.splice(itemAt(spec.texts, op.id, "text").index, 1); return;
    case "layer.add": addItem(spec.layers, op.item, "layer"); return;
    case "layer.set": patch(itemAt(spec.layers, op.id, "layer").item, op.patch); return;
    case "layer.remove": spec.layers.splice(itemAt(spec.layers, op.id, "layer").index, 1); return;
    case "sound.add": addItem(spec.sounds, op.item, "sound"); return;
    case "sound.set": patch(itemAt(spec.sounds, op.id, "sound").item, op.patch); return;
    case "sound.remove": spec.sounds.splice(itemAt(spec.sounds, op.id, "sound").index, 1); return;
    case "captions.set": {
      const { style, ...rest } = op.patch;
      patch(spec.captions, rest);
      if (style) patch(spec.captions.style, style);
      return;
    }
    case "captions.fix": {
      const fixes = (spec.captions.fixes[op.asset] ??= {});
      if (op.text === undefined) delete fixes[String(op.word)];
      else fixes[String(op.word)] = op.text;
      if (Object.keys(fixes).length === 0) delete spec.captions.fixes[op.asset];
      return;
    }
    case "asset.add": {
      if (spec.assets[op.asset.id]) throw new Refusal("id-taken", `the id "${op.asset.id}" is already an asset`);
      spec.assets[op.asset.id] = op.asset;
      return;
    }
    case "asset.words": {
      const asset = spec.assets[op.id];
      if (!asset) throw new Refusal("not-found", `there is no asset "${op.id}"`);
      asset.words = op.words;
      return;
    }
    case "look.set": spec.look.filter = op.filter; return;
    case "cover.set": spec.cover = op.frame == null ? null : { frame: op.frame }; return;
    case "ref.set": spec.ref = op.ref; return;
  }
}

/** The edit after the operations, in order. All of them, or none: on a refusal the edit given is untouched. */
export function applyOps(spec: EditSpec, ops: Op[]): EditSpec {
  const next = structuredClone(spec);
  ops.forEach((op, index) => {
    try {
      applyOne(next, op);
    } catch (e) {
      if (e instanceof Refusal) throw new EditOpError(e.code, index, e.message);
      throw e;
    }
  });
  const last = Math.max(0, ops.length - 1);
  const parsed = EditSpecSchema.safeParse(next);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new EditOpError("invalid", last, issue ? `${issue.path.join(".")}: ${issue.message}` : "the result is not an EditSpec");
  }
  const problem = checkEditSpec(parsed.data)[0];
  if (problem) throw new EditOpError(problem.code, last, `${problem.at}: ${problem.message}`);
  return parsed.data;
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/ops.test.ts`
Expected: PASS, 20 tests. The random-sequence test takes about five seconds.

- [ ] **Step 5: Stage**

```bash
git add src/lib/edit/ops.ts src/lib/edit/__tests__/ops.test.ts
```

---

### Task 7: A real render

**Files:**
- Create: `src/lib/edit/__tests__/openfilm.d.ts`
- Test: `src/lib/edit/__tests__/render.test.ts`

**Interfaces:**
- Consumes: `compile` of Task 5, the factories of Task 3, the kit of Task 1; `render` from `openfilm/render` and `launch` from `openfilm/host`.
- Produces: nothing other tasks use. This is the proof that the compiler's output draws what the document says.

- [ ] **Step 1: Make sure the machine can render**

```bash
ffmpeg -version | head -1 && ffprobe -version | head -1
node "$(node -p "require.resolve('playwright-core/cli.js', { paths: [require.resolve('openfilm/package.json')] })")" install chromium-headless-shell
```

Expected: both versions print, and the install either downloads the browser (about 100 MB, once) or says it is already there.

- [ ] **Step 2: Write the type shim and the test**

Create `src/lib/edit/__tests__/openfilm.d.ts`:

```ts
/**
 * openfilm.d.ts — the one entry of the pinned package that ships no types of its own.
 * Only what the edit tests call. `openfilm/film-doc` and `openfilm/host` bring their own.
 */
declare module "openfilm/render" {
  export function render(
    args: string[],
    opts?: {
      out?: string;
      scale?: number;
      workers?: number;
      fps?: number;
      loudness?: number;
      hardware?: boolean;
      onProgress?: (done: number, total: number) => void;
      signal?: AbortSignal;
    },
  ): Promise<{ out: string; encoder: string; lines: string[] }>;
}
```

Create `src/lib/edit/__tests__/render.test.ts`:

```ts
/**
 * render.test.ts — a real render, judged from the MP4.
 *
 * Everything else in this folder checks the film as text. This one draws it: ffmpeg makes two
 * clips of flat colour with a tone, a small edit is compiled into a temporary folder with the
 * kit, and OpenFilm's own `render()` turns it into an MP4 in a headless browser. Then the file is
 * read back: the frame count, the colour on each side of the cut, the caption and the label in
 * the picture, and sound in the mix.
 *
 * It needs ffmpeg, ffprobe and the headless browser on the machine. Where one is missing the
 * suite is SKIPPED and says which; part 1 is not done until this has run green on the
 * development machine, and part 2 runs it again inside the worker image.
 *
 * Nothing of ours is mocked, and neither is the renderer.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "openfilm/host";
import { render } from "openfilm/render";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compile } from "../compile";
import { DEFAULT_CAPTION_STYLE, STAGE, newSegment, newText, type EditSpec } from "../spec";

const kit = fileURLToPath(new URL("../../../../public/edit-kit/v1/", import.meta.url));

const missing: string[] = [];
for (const bin of ["ffmpeg", "ffprobe"]) {
  if (spawnSync(bin, ["-version"], { stdio: "ignore" }).error) missing.push(bin);
}
if (missing.length === 0) {
  try {
    await (await launch()).close();
  } catch (e) {
    missing.push(/Executable doesn't exist/.test(String(e)) ? "the headless browser" : `a browser that starts (${String(e).split("\n")[0]})`);
  }
}
if (missing.length) console.warn(`render.test.ts SKIPPED: this machine has no ${missing.join(", ")}`);

/** Red for 20 frames, then blue for 25: the cut is on frame 20. */
function edit(): EditSpec {
  const clip = (id: string, words: EditSpec["assets"][string]["words"]): EditSpec["assets"][string] => ({
    id, kind: "video", origin: "uploaded", at: { bucket: "takes", path: `${id}.mp4` }, ms: 2000, w: 1080, h: 1920, sound: true, words,
  });
  return {
    v: 1,
    stage: { ...STAGE },
    assets: {
      red: clip("red", [{ t0: 0, t1: 400, text: "Red" }, { t0: 400, t1: 650, text: "clip." }]),
      blue: clip("blue", null),
      kick: { id: "kick", kind: "audio", origin: "kit", at: { kit: "sfx/kick.m4a" }, ms: 450, sound: true, words: null },
    },
    main: [newSegment({ id: "r", asset: "red", len: 20 }), newSegment({ id: "b", asset: "blue", len: 25 })],
    layers: [],
    texts: [{ ...newText({ id: "label", text: "LABEL", at: 0, len: 45 }), in: null, out: null }],
    captions: { on: true, lang: "en", style: { ...DEFAULT_CAPTION_STYLE }, fixes: {} },
    sounds: [{ id: "k", pin: "b", at: 0, len: 14, role: "sfx", asset: "kick", inMs: 0, volume: 1, fadeIn: 0, fadeOut: 0 }],
    look: { filter: null },
    cover: null,
    ref: null,
  };
}

describe.skipIf(missing.length > 0)("a real render", () => {
  let dir = "";
  let out = "";

  /** The pixels of one frame's horizontal band, as [r, g, b] triples. `top` and `height` are fractions of the picture. */
  const band = (frame: number, top: number, height: number): [number, number, number][] => {
    const raw = execFileSync("ffmpeg", [
      "-v", "error", "-i", out,
      "-vf", `select='eq(n\\,${frame})',crop=iw:ih*${height}:0:ih*${top},scale=64:16`,
      "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
    ], { maxBuffer: 1 << 24 });
    const pixels: [number, number, number][] = [];
    for (let i = 0; i + 2 < raw.length; i += 3) pixels.push([raw[i] ?? 0, raw[i + 1] ?? 0, raw[i + 2] ?? 0]);
    return pixels;
  };
  const mean = (pixels: [number, number, number][]): [number, number, number] => {
    const sum = pixels.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]] as [number, number, number], [0, 0, 0] as [number, number, number]);
    return [sum[0] / pixels.length, sum[1] / pixels.length, sum[2] / pixels.length];
  };

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "edit-render-"));
    mkdirSync(join(dir, "assets"));
    cpSync(kit, join(dir, "kit", "v1"), { recursive: true });
    for (const [name, color, hz] of [["red", "0xff0000", 440], ["blue", "0x0000ff", 880]] as const) {
      execFileSync("ffmpeg", [
        "-v", "error", "-y",
        "-f", "lavfi", "-i", `color=c=${color}:s=1080x1920:r=30:d=2`,
        "-f", "lavfi", "-i", `sine=frequency=${hz}:duration=2`,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-g", "15", "-c:a", "aac", "-shortest",
        join(dir, "assets", `${name}.mp4`),
      ]);
    }
    const compiled = compile(edit(), { file: (asset) => `assets/${asset.id}.mp4` });
    for (const [name, text] of Object.entries(compiled.files)) writeFileSync(join(dir, name), text);
    out = join(dir, "out.mp4");
    await render([dir], { out, scale: 0.25, workers: 1 });
  }, 180_000);

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("has exactly the edit's frames, at 30 frames a second", () => {
    const probe = JSON.parse(execFileSync("ffprobe", [
      "-v", "error", "-count_frames", "-select_streams", "v:0",
      "-show_entries", "stream=nb_read_frames,r_frame_rate,width,height", "-of", "json", out,
    ], { encoding: "utf8" })) as { streams: { nb_read_frames: string; r_frame_rate: string; width: number; height: number }[] };
    expect(probe.streams[0]).toMatchObject({ nb_read_frames: "45", r_frame_rate: "30/1", width: 270, height: 480 });
  });

  it("cuts on the exact frame: the frame before is the first clip, the frame of the cut the second", () => {
    /* the bottom fifth of the picture holds no caption and no label */
    const before = mean(band(19, 0.8, 0.2));
    const after = mean(band(20, 0.8, 0.2));
    expect(before[0]).toBeGreaterThan(150);
    expect(before[2]).toBeLessThan(90);
    expect(after[2]).toBeGreaterThan(150);
    expect(after[0]).toBeLessThan(90);
  });

  it("draws the caption while its line is on, and not after", () => {
    /* captions sit at 66% of the height. Red and blue have no green; the caption's words do. */
    const green = (frame: number): number => band(frame, 0.6, 0.12).filter((p) => p[1] > 120).length;
    expect(green(6)).toBeGreaterThan(10); // "Red clip." is on from 0 to 650 ms
    expect(green(40)).toBe(0); // the blue clip says nothing
  });

  it("draws the text label at the top for the whole film", () => {
    const white = (frame: number): number => band(frame, 0.09, 0.1).filter((p) => p[0] > 200 && p[1] > 200 && p[2] > 200).length;
    expect(white(5)).toBeGreaterThan(10);
    expect(white(40)).toBeGreaterThan(10);
  });

  it("has sound in the mix", () => {
    const said = spawnSync("ffmpeg", ["-v", "info", "-i", out, "-vn", "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr;
    const level = Number(/mean_volume: (-?[\d.]+) dB/.exec(said)?.[1]);
    expect(level).toBeGreaterThan(-60);
  });
});
```

- [ ] **Step 3: Run it and see it pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/render.test.ts`
Expected: PASS, 5 tests, in about ten seconds. If the output says `render.test.ts SKIPPED`, the machine is missing what the message names; fix that and run again. A skip is not a pass.

- [ ] **Step 4: Prove the test can fail**

This test passes on its first run because the code it exercises already exists. Show that it is able to catch the bug it is there for:

```bash
keep="$(mktemp)" && cp src/lib/edit/time.ts "$keep"
sed -i '' 's|return Math.floor((frame \* 1000) / FPS);|return Math.round((frame * 1000) / FPS);|' src/lib/edit/time.ts
NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/render.test.ts src/lib/edit/__tests__/time.test.ts
cp "$keep" src/lib/edit/time.ts && rm "$keep"
grep -c "Math.floor((frame" src/lib/edit/time.ts
```

Expected: 3 failed tests, among them `cuts on the exact frame` with `expected 0 to be greater than 150`. Then the file is back as it was and the last line prints `1`.

- [ ] **Step 5: Run it once more and stage**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/render.test.ts`
Expected: PASS, 5 tests.

```bash
git add src/lib/edit/__tests__/openfilm.d.ts src/lib/edit/__tests__/render.test.ts
```

---

### Task 8: The whole part, checked together

**Files:** none created.

**Interfaces:**
- Consumes: everything above.
- Produces: the evidence that part 1 is done.

- [ ] **Step 1: Type-check the repo**

Run: `pnpm exec tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 2: Lint the new code**

Run: `pnpm exec eslint src/lib/edit`
Expected: no output, exit code 0.

- [ ] **Step 3: Run the edit suite**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit`
Expected: `Test Files 7 passed (7)`, `Tests 71 passed (71)`, and no `SKIPPED` line.

- [ ] **Step 4: Run the whole suite**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm test`
Expected: no failed file and no failed test. Before this part the suite had 577 files and 6,768 tests (one file and 42 tests of those skipped); it now has 584 files and 6,839 tests.

- [ ] **Step 5: Build**

Run: `pnpm build`
Expected: the build completes. Nothing in the app imports `src/lib/edit` yet, so the bundle is unchanged; this confirms that adding the dev dependency and `public/edit-kit` broke nothing.

- [ ] **Step 6: Report**

Tell the owner, with the output of steps 1 to 5: what passed, anything that did not, and that the files are staged and not committed. Do not say it works without the output.

---

## Self-Review

**Spec coverage.** §1 three deliverables: Tasks 3 (document), 5 (compiler), 6 (operations). §2 R1 to R3: Task 2; R4: `compile`'s `opts.file`, Task 5; R5: head test in Task 5; R6: kit paths and `assets/` only, Task 5; R7: names throughout. §3 the document: Task 3; closed lists §3.5: Task 1. §4 `parseEditSpec`, `checkEditSpec`, `migrate`: Tasks 3 and 4. §5.1 to §5.5: Task 5; §5.6 the kit: Task 1. §6 every operation: Task 6. §7 the five test groups: Tasks 2 to 7, with the checks split into `check.test.ts` and the kit given a test of its own. §8 files and the dev dependency: Tasks 1 and 8.

**Not built here, by the spec's own choice.** Screens for layers (release 2); music ducking (F6); a shipped emoji font (§10).

**Placeholders.** None: every step that writes code shows the file whole.

**Names.** `frameMs`, `spanMs`, `sourceMs`, `sec`, `starts`, `total`, `windowOf`, `frameOf`, `checkEditSpec`, `EditSpecError`, `compile`, `cuesOf`, `vttOf`, `boxOf`, `applyOps`, `parseOps`, `EditOpError` are spelled the same in the task that defines them and in every task that uses them; the code blocks were type-checked together.
