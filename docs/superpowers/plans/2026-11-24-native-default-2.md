# The native default, second slice: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** remove the three things that still read as "made by a tool" in the default first cut: caption pages cut by a
fixed count (a full page followed by a page of one or two words), a two-line label drawn as two stacked boxes, and a
call-out in the bold template look on a plain film.

**Architecture:** the craft stays in code. Paging is one pure function the kit, the review and the fit all call, so what
is judged is what is drawn. The label's shape is pure geometry (lines in, an SVG path out) drawn by the title part; no
box the review reads moves. The call-out gains the optional weight the title got in the first slice, and the agent is
told by its craft lines to set it as a label where the film's captions carry no colour.

**Tech stack:** TypeScript, zod, React, Remotion 4.0.545 (pinned), vitest with happy-dom. No new package.

**Where this comes from:** the controller's review by eye of the first slice's film on 2026-11-24 (the owner's files in
`.scratch/native-default/for-the-owner/`), the first slice's own "next slice" list (its ledger's last line), and the spec
`docs/superpowers/specs/2026-11-24-native-look-design.md` (3.1 "short rows", 3.3 "the merged box"). The owner's word:
"review and continue". Scope decided by the controller, for the owner to overturn.

## Rulings (the controller's, 2026-11-24)

- **S1. Sentence captions are paged evenly.** For captions set as a sentence (`sentenceSet`: plain with a weight) a
  stretch of speech (the words between two pauses of four tenths of a second or two sentence ends) is set on the fewest
  pages of at most `maxWords` words, and those pages are evened out: no page of one word beside a full one. A break after
  a comma, a semicolon or a colon is preferred, then a break in the longer silence, then the earlier break. Every other
  look pages exactly as before.
- **S2. One function pages for everyone.** The kit's drawing, the review and the captions fit call the same paging
  function with the captions' own settings. No caller decides by itself whether pages are evened.
- **S3. A label of two or three lines is one shape.** Each line keeps its own width; the joins are rounded as the apps'
  own text box is. Where two neighbouring lines' edges on a side are closer than one corner radius, both are drawn at the
  outer edge. The corner radius stays `round(0.24 × size)`. A label of one line is drawn exactly as before.
- **S4. No box moves.** `titleBox`, `calloutBox` and `captionPages` return the same boxes for the same settings as
  before. The shape is drawing only.
- **S5. A call-out may carry a weight** (the closed set, 400 to 900 in hundreds); left out, it is 800 as before.
- **S6. On a film whose captions have no highlight colour, a call-out is a label** in the title's colour and weight, 72
  to 96 px, unless the creator names a look or a colour. Told to the model in the craft lines; measured by the live runs.
- **S7. Nothing old changes** but what S3 names: an edit whose captions carry no weight pages as before; a one-line
  label, every title that is not a label, every caption page and every call-out with no weight draw exactly as before
  (`as-before.test.tsx` passes unchanged). A label of two or three lines changes at its joins only.
- **S8. One deploy, at the end,** from a clean tree, only on the owner's word. Until then the deployed worker pages
  sentence captions the old way and refuses a call-out with a weight.

## Global Constraints

- Worktree `/Users/davideloreti/virtuna-edit`, branch `feat/edit`. Commit only with
  `git -c core.hooksPath=/dev/null commit -m "<message>" -- <your paths>`, by named paths; never `git add -A`; never push.
- `remotion` and `@remotion/*` stay at exactly 4.0.545. No package is added, removed or updated.
- The repository is public: no real id, link, creator name, word shown on a reference video or word of the owner's take
  in any committed file (tests, fixtures, comments, docs, commit messages). Every text a test writes is made up.
- Never read, cat, grep or list `.env*`; never `modal token info`, `modal config show`, or read `~/.modal.toml`.
- The agent calls only Qwen and writes operations, never code. Every change passes the one door (`applyOps`, then
  `checkEdit`). What is seen is what is posted: the kit's drawing and the review read the same functions.
- Tests exercise the real code; mocks only at network boundaries and for the browser's text measure in happy-dom (as
  `label-light.test.tsx` does). Written first, seen to fail, then made to pass.
- Vitest: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run <path>`. Types: `pnpm exec tsc --noEmit` and
  `pnpm exec tsc -p scripts/tsconfig.edit.json`. Lint: `pnpm exec eslint <your files>`.
- Disk: check `df -h /` before a render or a bundle; under 1.2 GB free, stop and report.
- Sheets, stills and films for the controller's eye go under `.scratch/native-default-2/<task>/` (git-ignored).

## Files

| File | Task | What changes |
|---|---|---|
| `src/edit/film/pages.ts` | 1 | `pagesOf` gains `balanced`; new `evenGroups`, `pagesFor` |
| `src/edit/film/Film.tsx`, `src/lib/edit/review.ts`, `src/lib/edit/recipes/captions.ts` | 1 | call `pagesFor` |
| `src/edit/film/__tests__/pages.test.ts` | 1 | the even pages' tests |
| `src/edit/film/shape.ts` (new) | 2 | `snapped`, `labelShape` |
| `src/edit/film/parts/Title.tsx` | 2 | a label of two or three lines draws one path |
| `src/edit/film/__tests__/shape.test.ts`, `label-shape.test.tsx` (new) | 2 | geometry and drawing tests |
| `src/lib/edit/parts.ts`, `src/edit/film/layout.ts` | 3 | the call-out's optional weight |
| `src/lib/edit/agent/catalogue.ts`, `src/lib/edit/agent/prompt.ts` | 3 | the weight's line; the craft lines of S6 |
| their tests | 3 | named in the task |

---

### Task 1: Sentence captions paged evenly

**Files:**
- Modify: `src/edit/film/pages.ts`
- Modify: `src/edit/film/Film.tsx` (the one `pagesOf` call, about line 101)
- Modify: `src/lib/edit/review.ts` (the one `pagesOf` call, about line 277)
- Modify: `src/lib/edit/recipes/captions.ts` (`countsTried`, about line 84)
- Test: `src/edit/film/__tests__/pages.test.ts`

**Interfaces:**
- Consumes: `sentenceSet(captions)` from `src/edit/film/layout.ts` (true for plain captions with a weight); `SaidWord`
  from `src/lib/edit` (`{ text, from, to, stress }`, frames counted from the run's first frame).
- Produces: `pagesOf(words, maxWords, runFrames, balanced = false): CaptionPage[]` (the fourth argument is new) and
  `pagesFor(captions: Pick<Captions, "look" | "weight" | "maxWords">, words: readonly SaidWord[], runFrames: number): CaptionPage[]`,
  which is `pagesOf(words, captions.maxWords, runFrames, sentenceSet(captions))`. After this task nothing outside
  `pages.ts` and its test calls `pagesOf` directly.

- [ ] **Step 1: Write the failing tests.** Append to `src/edit/film/__tests__/pages.test.ts` (the file's `word` helper
  makes a word with no stress; the words are made up):

```ts
import { pagesFor } from "../pages";

/** The words said back to back, ten frames each, from frame 0; `gaps` puts a silence of so many frames before a word. */
const said = (texts: string[], gaps: Record<number, number> = {}): SaidWord[] => {
  let at = 0;
  return texts.map((text, i) => {
    at += gaps[i] ?? 0;
    const made = word(text, at, at + 10);
    at += 10;
    return made;
  });
};
const even = (words: SaidWord[], maxWords: number) => pagesOf(words, maxWords, 6000, true).map((page) => page.words.map((w) => w.text).join(" "));

describe("caption pages, evened out", () => {
  it("sets a stretch on the fewest pages and leaves no page of one word beside a full one", () => {
    expect(even(said(["Your", "plan", "is", "ready", "this", "week."]), 5)).toEqual(["Your plan is", "ready this week."]);
    expect(even(said(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]), 5)).toEqual(["a b c d e", "f g h i j"]);
    expect(even(said(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"]), 5)).toEqual(["a b c", "d e f g", "h i j k"]);
    expect(even(said(["a", "b", "c"]), 5)).toEqual(["a b c"]);
  });

  it("takes the earlier break when two cuts are as even", () => {
    expect(even(said(["a", "b", "c", "d", "e", "f", "g"]), 5)).toEqual(["a b c", "d e f g"]);
  });

  it("prefers a break after a comma, a semicolon or a colon, but never for a page of one word", () => {
    expect(even(said(["a", "b", "c,", "d", "e", "f", "g", "h"]), 5)).toEqual(["a b c,", "d e f g h"]);
    expect(even(said(["a", "b;", "c", "d", "e", "f"]), 5)).toEqual(["a b;", "c d e f"]);
    expect(even(said(["a:", "b", "c", "d", "e", "f"]), 5)).toEqual(["a: b c", "d e f"]);
    expect(even(said(["a", "b", "c", "d,", "e", "f", "g", "h", "i", "j"]), 5)).toEqual(["a b c d, e", "f g h i j"]); // the cap comes first
  });

  it("prefers the break in the longer silence between two cuts as even", () => {
    expect(even(said(["a", "b", "c", "d", "e", "f", "g"], { 4: 8 }), 5)).toEqual(["a b c d", "e f g"]); // 8 frames before the fifth word
  });

  it("still starts a page after a pause of four tenths of a second and after the end of a sentence", () => {
    expect(even(said(["a", "b", "c", "d", "e", "f"], { 4: 12 }), 5)).toEqual(["a b c d", "e f"]);
    expect(even(said(["a", "b.", "c", "d", "e", "f", "g", "h"]), 5)).toEqual(["a b.", "c d e", "f g h"]);
  });

  it("times an evened page as every page is timed", () => {
    const pages = pagesOf(said(["a", "b", "c", "d", "e", "f"]), 5, 6000, true);
    expect(pages.map((page) => [page.from, page.to])).toEqual([[0, 30], [30, 70]]); // the second holds a third of a second after its last word
  });

  it("pages as before without the word", () => {
    const words = said(["a", "b", "c", "d", "e", "f"]);
    expect(pagesOf(words, 5, 6000).map((page) => page.words.length)).toEqual([5, 1]);
    expect(pagesOf(words, 5, 6000, false)).toEqual(pagesOf(words, 5, 6000));
  });
});

describe("pagesFor", () => {
  const words = said(["a", "b", "c", "d", "e", "f"]);
  const lengths = (captions: Parameters<typeof pagesFor>[0]) => pagesFor(captions, words, 6000).map((page) => page.words.length);

  it("evens the pages of captions set as a sentence, and of no others", () => {
    expect(lengths({ look: "plain", weight: 600, maxWords: 5 })).toEqual([3, 3]);
    expect(lengths({ look: "plain", weight: undefined, maxWords: 5 })).toEqual([5, 1]);
    expect(lengths({ look: "pill", weight: 600, maxWords: 5 })).toEqual([5, 1]);
    expect(lengths({ look: "pop", weight: 800, maxWords: 5 })).toEqual([5, 1]);
  });
});
```

- [ ] **Step 2: Run them and see them fail.**
  `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/edit/film/__tests__/pages.test.ts`
  Expected: the new tests fail (`pagesFor` is not exported; `pagesOf` ignores its fourth argument), the five old ones pass.

- [ ] **Step 3: Implement in `src/edit/film/pages.ts`.** Keep `PAUSE`, `HOLD`, `CaptionPage` and the timing as they are.
  The old grouping stays, untouched, as the `balanced === false` branch.

```ts
import type { SaidWord } from "../../lib/edit";
import type { Captions } from "../../lib/edit/doc";
import { sentenceSet } from "./layout";

/** A sentence's end at a word's end. */
const SENTENCE_END = /[.!?]$/;
/** A clause's end at a word's end: a comma, a semicolon or a colon. */
const CLAUSE_END = /[,;:]$/;
/** What a break after a clause's end is worth, in words of unevenness squared: two and a half. So it moves a break by a word, never to a page of one word. */
const CLAUSE_WORTH = 2.5;

/**
 * One stretch of speech on the fewest pages of at most `maxWords` words, evened out (ruled 2026-11-24, S1): the cut whose
 * pages are nearest alike in length, less what its breaks are worth (a break after a clause's end, and a break in a
 * silence, by its length up to `PAUSE`); between cuts that come out alike, the earlier break. Whole numbers throughout
 * (every cost times 24 k²), so that a tie is a tie in every engine.
 */
export function evenGroups(stretch: readonly SaidWord[], maxWords: number): SaidWord[][] {
  const [n, cap] = [stretch.length, Math.max(1, Math.floor(maxWords))];
  const k = Math.ceil(n / cap);
  if (k <= 1) return n > 0 ? [[...stretch]] : [];
  const uneven = (length: number) => 24 * (length * k - n) ** 2;
  const worth = (after: number) => {
    const [last, next] = [stretch[after]!, stretch[after + 1]!];
    return (CLAUSE_END.test(last.text) ? 24 * CLAUSE_WORTH * k * k : 0) + 2 * k * k * Math.max(0, Math.min(PAUSE, next.from - last.to));
  };
  // cost[j][i]: the least cost of setting the words from `i` on, on `j` pages; first[j][i]: that cut's first page's length.
  const cost = Array.from({ length: k + 1 }, () => Array<number>(n + 1).fill(Number.POSITIVE_INFINITY));
  const first = Array.from({ length: k + 1 }, () => Array<number>(n + 1).fill(0));
  cost[0]![n] = 0;
  for (let j = 1; j <= k; j++) {
    for (let i = n - j; i >= 0; i--) {
      for (let length = 1; length <= cap && i + length <= n; length++) { // from the shortest: between equals the earlier break stands
        const rest = cost[j - 1]![i + length]!;
        if (rest === Number.POSITIVE_INFINITY) continue;
        const total = uneven(length) + rest - (j > 1 ? worth(i + length - 1) : 0);
        if (total < cost[j]![i]!) {
          cost[j]![i] = total;
          first[j]![i] = length;
        }
      }
    }
  }
  const groups: SaidWord[][] = [];
  for (let j = k, i = 0; j >= 1; j--) {
    const length = first[j]![i]!;
    groups.push(stretch.slice(i, i + length));
    i += length;
  }
  return groups;
}
```

  `pagesOf` gains the argument and the branch; its `return groups.flatMap(...)` stays as it is:

```ts
/**
 * A run's words as caption pages of at most `maxWords` words, none shown past the run's `runFrames`. With `balanced`,
 * each stretch between two pauses or sentence ends is evened out over its pages (`evenGroups`); without, a page is
 * filled before the next starts, as every edit made before 2026-11-24 is paged.
 */
export function pagesOf(words: readonly SaidWord[], maxWords: number, runFrames: number, balanced = false): CaptionPage[] {
  const groups: SaidWord[][] = [];
  if (balanced) {
    let stretch: SaidWord[] = [];
    for (const word of words) {
      const before = stretch[stretch.length - 1];
      if (before && (word.from - before.to >= PAUSE || SENTENCE_END.test(before.text))) {
        groups.push(...evenGroups(stretch, maxWords));
        stretch = [];
      }
      stretch.push(word);
    }
    groups.push(...evenGroups(stretch, maxWords));
  } else {
    for (const word of words) {
      const page = groups[groups.length - 1];
      const before = page?.[page.length - 1];
      const starts = !page || !before || page.length >= maxWords || word.from - before.to >= PAUSE || SENTENCE_END.test(before.text);
      if (starts) groups.push([word]);
      else page.push(word);
    }
  }
  return groups.flatMap(/* unchanged */);
}

/** The pages of a run's words for these captions: evened out where they are set as a sentence (`sentenceSet`), else filled. The one way in for the kit, the review and the fit (S2). */
export function pagesFor(captions: Pick<Captions, "look" | "weight" | "maxWords">, words: readonly SaidWord[], runFrames: number): CaptionPage[] {
  return pagesOf(words, captions.maxWords, runFrames, sentenceSet(captions));
}
```

  Update the file's header comment: a page starts when it is full or, for a sentence, where its stretch is evenly cut.
  If importing `layout.ts` into `pages.ts` makes an import cycle (check with `pnpm exec tsc --noEmit` and the tests),
  stop and report NEEDS_CONTEXT; do not move `sentenceSet`.

- [ ] **Step 4: Run the file's tests and see them pass.** Same command as Step 2. Expected: all pass.

- [ ] **Step 5: Move the three callers to `pagesFor`.**
  - `Film.tsx`: `pagesFor(edit.captions, runWords(edit, run), run.frames)`.
  - `review.ts`: the same call with its own `edit` and `run`.
  - `recipes/captions.ts` `countsTried`: `pagesFor({ ...edit.captions, maxWords: count }, runWords(edit, run), run.frames)`.
  Then `grep -rn "pagesOf(" src --include='*.ts' --include='*.tsx' | grep -v __tests__ | grep -v "src/lib/edit/style/text.ts"`
  must print only `pages.ts` (the function in `style/text.ts` is another one of the same name; leave it).

- [ ] **Step 6: A test that the review and the fit see the evened pages.** In
  `src/lib/edit/recipes/__tests__/recipes.test.ts`, beside the `countsTried` tests, add one on a made-up take whose run
  holds one six-word sentence said back to back (use the file's own fixtures and helpers; read how its `countsTried`
  tests build an edit): with captions `{ look: "plain", weight: 600, maxWords: 5 }` the counts tried are `[5, 4]`'s
  distinct pagings as `countsTried` reports them, and with `weight` left out they are what they were before this task.
  Write the expected values from what the rule gives (six words at five a page are 3 + 3, at four a page 3 + 3 too, so
  `countsTried` returns `[5]`; with no weight five a page are 5 + 1 and four a page 4 + 2, so it returns `[5, 4]`).
  Run it, see it pass; then put `false` in place of `sentenceSet(captions)` in `pagesFor`, see it fail, and put it back.

- [ ] **Step 7: The whole edit suites, the types, the lint.**
  `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/edit src/lib/edit src/app/api/edit src/app/dev-edit`
  Expected: every test passes; `as-before.test.tsx` unchanged and green. A test that fails because it pinned the old
  5 + 1 paging of sentence captions is updated to the new pages and named in the report with its old and new values; a
  test of any other look that fails is a defect in this task. The two timing tests of `recipes.test.ts` (ceilings 1,000
  and 3,500 ms) must still pass: report their measured times. Then both `tsc` commands and `eslint` on the changed files.

- [ ] **Step 8: Commit.**
  `git -c core.hooksPath=/dev/null commit -m "feat(edit): sentence captions paged evenly: the fewest pages, no page of one word beside a full one" -- src/edit/film/pages.ts src/edit/film/Film.tsx src/lib/edit/review.ts src/lib/edit/recipes/captions.ts src/edit/film/__tests__/pages.test.ts src/lib/edit/recipes/__tests__/recipes.test.ts <any test updated in Step 7>`

---

### Task 2: A label of two or three lines is one shape

**Files:**
- Create: `src/edit/film/shape.ts`
- Modify: `src/edit/film/parts/Title.tsx`
- Test: `src/edit/film/__tests__/shape.test.ts` (new), `src/edit/film/__tests__/label-shape.test.tsx` (new)

**Interfaces:**
- Consumes: `titleBox` (layout.ts) as it is: `laid.lines[i].width` (the letters' width), `laid.side` (the padding at each
  end), `laid.room` (the title's own box, which each line is centred in), `laid.pitch` (a line's height); `labelFill`.
- Produces: `labelShape(lines: readonly LineSpan[], pitch: number, radius: number): string` (an SVG path's `d`) and
  `snapped(lines, radius): LineSpan[]`, with `LineSpan = { left: number; right: number }` in px inside the title's box.

- [ ] **Step 1: Write the failing geometry tests** in `src/edit/film/__tests__/shape.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { labelShape, snapped } from "../shape";

/** The arcs of a path: each one's radius and whether it turns outward (1) or inward (0). */
const arcs = (d: string) => [...d.matchAll(/A([\d.]+) [\d.]+ 0 0 ([01]) /g)].map((arc) => ({ r: Number(arc[1]), out: arc[2] === "1" }));
/** Every x and y a path names. */
const points = (d: string) => [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)(?=[ALZ])/g)].map((at) => [Number(at[1]), Number(at[2])] as const);

describe("a label's shape", () => {
  it("is a rounded box for one line", () => {
    expect(labelShape([{ left: 0, right: 200 }], 100, 20)).toBe("M0 20A20 20 0 0 1 20 0L180 0A20 20 0 0 1 200 20L200 80A20 20 0 0 1 180 100L20 100A20 20 0 0 1 0 80Z");
  });

  it("joins a narrower line to a wider one with one corner turned outward and one inward at each side", () => {
    const d = labelShape([{ left: 50, right: 150 }, { left: 0, right: 200 }], 100, 20);
    expect(arcs(d)).toHaveLength(8);
    expect(arcs(d).filter((arc) => !arc.out)).toHaveLength(2);
    expect(arcs(d).every((arc) => arc.r === 20)).toBe(true);
    expect(labelShape([{ left: 0, right: 200 }, { left: 50, right: 150 }], 100, 20)).not.toBe(d); // the wider line above works too
    expect(arcs(labelShape([{ left: 0, right: 200 }, { left: 50, right: 150 }], 100, 20)).filter((arc) => !arc.out)).toHaveLength(2);
  });

  it("makes the corners of a short step smaller, half the step each", () => {
    const d = labelShape([{ left: 30, right: 170 }, { left: 0, right: 200 }], 100, 20);
    expect(arcs(d).map((arc) => arc.r).sort((a, b) => a - b)).toEqual([15, 15, 15, 15, 20, 20, 20, 20]);
  });

  it("draws two lines whose edges are closer than a radius as one edge, the outer one", () => {
    expect(snapped([{ left: 12, right: 188 }, { left: 0, right: 200 }], 20)).toEqual([{ left: 0, right: 200 }, { left: 0, right: 200 }]);
    expect(labelShape([{ left: 12, right: 188 }, { left: 0, right: 200 }], 100, 20)).toBe(labelShape([{ left: 0, right: 200 }, { left: 0, right: 200 }], 100, 20));
    expect(arcs(labelShape([{ left: 12, right: 188 }, { left: 0, right: 200 }], 100, 20))).toHaveLength(4);
    expect(snapped([{ left: 20, right: 180 }, { left: 0, right: 200 }], 20)).toEqual([{ left: 20, right: 180 }, { left: 0, right: 200 }]); // a whole radius apart: a step
  });

  it("snaps each side by itself, and through three lines", () => {
    expect(snapped([{ left: 10, right: 150 }, { left: 0, right: 200 }], 20)).toEqual([{ left: 0, right: 150 }, { left: 0, right: 200 }]);
    expect(snapped([{ left: 20, right: 180 }, { left: 10, right: 190 }, { left: 0, right: 200 }], 20)).toEqual([{ left: 0, right: 200 }, { left: 0, right: 200 }, { left: 0, right: 200 }]);
  });

  it("never leaves the lines' own box, and is empty for no lines", () => {
    const d = labelShape([{ left: 40, right: 160 }, { left: 0, right: 200 }, { left: 70, right: 130 }], 100, 20);
    for (const [x, y] of points(d)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(200);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(300);
    }
    expect(labelShape([], 100, 20)).toBe("");
  });
});
```

- [ ] **Step 2: Run them and see them fail** (the module does not exist):
  `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/edit/film/__tests__/shape.test.ts`

- [ ] **Step 3: Write `src/edit/film/shape.ts`.**

```ts
/**
 * shape.ts — the apps' own text box: the lines of a label drawn as one shape, each line its own width, the joins rounded
 * (ruled 2026-11-24, S3). Pure geometry: the lines' edges in, an SVG path out. Nothing here measures or draws.
 */

/** A line's box across: its left and right edge in px, inside the label's own block. */
export interface LineSpan {
  left: number;
  right: number;
}

/** A number as a path names it: to a hundredth of a pixel. */
const named = (value: number): string => String(Math.round(value * 100) / 100);

/** The lines as they are drawn: where two neighbours' edges on a side are closer than `radius`, both take the outer one. */
export function snapped(lines: readonly LineSpan[], radius: number): LineSpan[] {
  const spans = lines.map((line) => ({ ...line }));
  for (let moved = true; moved; ) {
    moved = false;
    for (let i = 0; i + 1 < spans.length; i++) {
      const [upper, lower] = [spans[i]!, spans[i + 1]!];
      if (upper.left !== lower.left && Math.abs(upper.left - lower.left) < radius) {
        upper.left = lower.left = Math.min(upper.left, lower.left);
        moved = true;
      }
      if (upper.right !== lower.right && Math.abs(upper.right - lower.right) < radius) {
        upper.right = lower.right = Math.max(upper.right, lower.right);
        moved = true;
      }
    }
  }
  return spans;
}

/**
 * The outline of a label's lines as one SVG path: line `i` runs from `i × pitch` down to `(i + 1) × pitch`, between its
 * own edges (`snapped`). Every corner is an arc of `radius`, or of half its shorter side where that is less, so the two
 * corners of a short step share it. "" for no lines.
 */
export function labelShape(lines: readonly LineSpan[], pitch: number, radius: number): string {
  const spans = snapped(lines, radius);
  if (spans.length === 0) return "";
  const last = spans.length - 1;
  // The outline's corners, clockwise from the first line's top left (y grows downward).
  const corners: [number, number][] = [[spans[0]!.left, 0], [spans[0]!.right, 0]];
  for (let i = 0; i < last; i++) {
    if (spans[i]!.right !== spans[i + 1]!.right) corners.push([spans[i]!.right, (i + 1) * pitch], [spans[i + 1]!.right, (i + 1) * pitch]);
  }
  corners.push([spans[last]!.right, (last + 1) * pitch], [spans[last]!.left, (last + 1) * pitch]);
  for (let i = last; i > 0; i--) {
    if (spans[i]!.left !== spans[i - 1]!.left) corners.push([spans[i]!.left, i * pitch], [spans[i - 1]!.left, i * pitch]);
  }
  const drawn = corners.map(([x, y], at) => {
    const [beforeX, beforeY] = corners[(at + corners.length - 1) % corners.length]!;
    const [afterX, afterY] = corners[(at + 1) % corners.length]!;
    const [into, out] = [Math.hypot(x - beforeX, y - beforeY), Math.hypot(afterX - x, afterY - y)];
    const r = Math.min(radius, into / 2, out / 2);
    const from = [x + ((beforeX - x) / into) * r, y + ((beforeY - y) / into) * r] as const;
    const to = [x + ((afterX - x) / out) * r, y + ((afterY - y) / out) * r] as const;
    const outward = (x - beforeX) * (afterY - y) - (y - beforeY) * (afterX - x) > 0; // a right turn, going clockwise with y downward
    return `${at === 0 ? "M" : "L"}${named(from[0])} ${named(from[1])}A${named(r)} ${named(r)} 0 0 ${outward ? 1 : 0} ${named(to[0])} ${named(to[1])}`;
  });
  return `${drawn.join("")}Z`;
}
```

- [ ] **Step 4: Run the geometry tests and see them pass.** Same command as Step 2.

- [ ] **Step 5: Write the failing drawing tests** in `src/edit/film/__tests__/label-shape.test.tsx`. Set the file up
  exactly as `label-light.test.tsx` does (its `@vitest-environment happy-dom` line, its `vi.mock("../fonts", …)` block
  that measures with the server's width tables, its `Thumbnail` render of `Title` one frame at a time, its `title()` and
  `shown` helpers: read that file first and reuse its pattern, with made-up words). The tests:
  1. A label whose text sets on two lines of different width (pick the text and size with `titleBox` in the test and
     assert `laid.lines.length === 2` first) draws exactly one `svg path` inside `[data-part="title"]`; the path's `fill`
     is `labelFill(color, 0.78)` for that colour; its `d` equals `labelShape(spans, laid.pitch, Math.round(0.24 * laid.size))`
     where `spans` are built from `laid` as Step 6 builds them; and no `[data-line]` has a `background-color` or a
     `border-radius` of its own.
  2. The same for dark letters (`#111111`: the light box) and for light letters (`#ffffff`: the dark box).
  3. A label of one line draws no `svg`, and its one `[data-line]` has the `background-color` and `border-radius` it has
     today (`labelFill(color, 0.78)`, `round(0.24 × size)` px).
  4. A title in the `bold` look on two lines draws no `svg` and no background.
  5. The letters are painted above the shape: each `[data-line]` of a two-line label has `position: relative`.

- [ ] **Step 6: Implement in `Title.tsx`.** Inside the component, after `laid`:

```tsx
  const radius = Math.round(0.24 * fontSize);
  // A label of two or three lines is one shape (shape.ts); one line keeps its own box, as it always had.
  const merged = label && laid.lines.length > 1;
  const spans = laid.lines.map((line) => {
    const wide = line.width + 2 * side;
    const left = Math.max(0, (laid.room - wide) / 2); // as `margin: 0 auto` sets it: one wider than the room starts at its left
    return { left, right: left + wide };
  });
```

  In the returned tree, as the first child of the `data-part="title"` div, when `merged`:

```tsx
      {merged ? (
        <svg aria-hidden width={laid.room} height={laid.lines.length * pitch} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <path d={labelShape(spans, pitch, radius)} fill={labelFill(settings.color, LABEL)} />
        </svg>
      ) : null}
```

  and each line's div takes its own box only when the label is not merged, and sits above the shape when it is:

```tsx
            ...(label && !merged ? { backgroundColor: labelFill(settings.color, LABEL), borderRadius: radius } : {}),
            ...(merged ? { position: "relative" as const } : {}),
```

  Import `labelShape` from `../shape`. Update the file's header comment (a label of several lines is one shape).
  `titleBox` and `layout.ts` are not touched (S4).

- [ ] **Step 7: Run the drawing tests, then the kit's suites.**
  `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/edit/film`
  Expected: all pass, `as-before.test.tsx` and `label-light.test.tsx` among them. If one of those two fails, read why:
  a test that asserted a per-line background on a label of two or more lines is updated to the shape and named in the
  report; anything else is a defect in this task. Then both `tsc` commands and `eslint` on the changed files.

- [ ] **Step 8: A sheet for the controller's eye.** With `scripts/edit-still.ts` (read its usage line; local render, no
  Modal; check `df -h /` first), render at full size one frame each of a made-up edit with: a two-line light label, a
  two-line dark label, a three-line label with the middle line widest, a two-line label whose lines are nearly as wide
  (the snap), and a one-line label; each at 72 px and at 110 px. Tile them into
  `.scratch/native-default-2/task-2/label-shapes.jpg` (ffmpeg or the script's own way), plus
  `.scratch/native-default-2/task-2/label-joins-crop.png`: the joins at true size, not scaled. Look at both with the
  Read tool and write what you see in the report (is the join smooth, is there a seam or a gap between the lines, do the
  letters sit where they sat). If `edit-still.ts` cannot draw a made-up edit without the owner's take, use the take in
  `.scratch/media/` as the picture and say so.

- [ ] **Step 9: Commit.**
  `git -c core.hooksPath=/dev/null commit -m "feat(edit): a label of two or three lines is one shape, the joins rounded as the apps' own text box" -- src/edit/film/shape.ts src/edit/film/parts/Title.tsx src/edit/film/__tests__/shape.test.ts src/edit/film/__tests__/label-shape.test.tsx <any test updated in Step 7>`

---

### Task 3: A call-out in the film's own voice

**Files:**
- Modify: `src/lib/edit/parts.ts` (the call-out's props)
- Modify: `src/edit/film/layout.ts` (`calloutBox`, the header's call-out lines)
- Modify: `src/lib/edit/agent/catalogue.ts` (the call-out's fields)
- Modify: `src/lib/edit/agent/prompt.ts` (two craft lines)
- Test: `src/lib/edit/__tests__/parts.test.ts`, `src/edit/film/__tests__/layout.test.ts`,
  `src/edit/film/__tests__/weights.test.tsx`, `src/lib/edit/agent/__tests__/catalogue.test.ts`,
  `src/lib/edit/agent/__tests__/prompt.test.ts`

**Interfaces:**
- Consumes: `Weight` from `src/lib/edit/atoms.ts` (the closed set 400 to 900 in hundreds, as the title's `weight` uses it).
- Produces: `PARTS.callout.props` with `weight: Weight.optional()`; `calloutWeight(props: Pick<CalloutProps, "weight">): number`
  exported from `layout.ts` (its own, else 800), used by `calloutBox`. `Callout.tsx` already draws `laid.weight`.

- [ ] **Step 1: Write the failing tests** (each in the file named, in that file's own style, with made-up words):
  1. `parts.test.ts`: a call-out with `weight: 600` parses; with `weight: 650` and with `weight: 300` it is refused;
     with no weight it parses as before.
  2. `layout.test.ts`: `calloutWeight({})` is 800 and `calloutWeight({ weight: 600 })` is 600; `calloutBox` of the same
     label call-out is narrower at 600 than at 800 (lighter letters are narrower) and returns `weight: 600`; with no
     weight it returns exactly the box it returned before this task (pin the numbers from the code as it stands, before
     you change it).
  3. `weights.test.tsx` (the file already draws a title at a weight; follow it): a label call-out with `weight: 600`
     is drawn with `font-weight: 600`; with none, 800.
  4. `catalogue.test.ts`: the catalogue's text holds the call-out's weight line
     `weight: "letters' weight; left out 800"`, and its length guard stands at the new number (Step 3).
  5. `prompt.test.ts`: the system prompt holds the two sentences of Step 4 word for word, and no longer holds
     `a call-out's letters are white`.

- [ ] **Step 2: Run them and see them fail.**
  `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/parts.test.ts src/edit/film/__tests__/layout.test.ts src/edit/film/__tests__/weights.test.tsx src/lib/edit/agent/__tests__/catalogue.test.ts src/lib/edit/agent/__tests__/prompt.test.ts`

- [ ] **Step 3: The kit and the catalogue.**
  - `parts.ts`, the call-out's props, after `color: Hex,`: `weight: Weight.optional(), // left out: 800`.
  - `layout.ts`: `export const calloutWeight = (props: Pick<CalloutProps, "weight">): number => props.weight ?? 800;`
    with a one-line comment in the file's manner; in `calloutBox`, `const weight = calloutWeight(props);`. In the header,
    the call-out's first line becomes `Weight (calloutWeight): its own; with none, 800.`
  - `catalogue.ts`, the call-out's fields, after `color`: `weight: "letters' weight; left out 800",`.
  - The catalogue's length guard (`catalogue.test.ts`, `toBeLessThan(21_000)`): the catalogue stood at about 20,958
    characters. If the new line passes the guard, raise the guard to the catalogue's new length rounded up to the next
    hundred, no further, and say both numbers in the report. It is a cost guard (the spec's 3.7); do not cut other text.

- [ ] **Step 4: The craft lines** in `prompt.ts` (`LOOKS`). Replace the "One voice" line's second sentence, so that the
  line reads, word for word:

  `- One voice: new text takes the captions' font, and an accent or a call-out takes the captions' highlight colour, unless the creator names another. Where the captions have no highlight colour (highlight null), a call-out is a label in the title's colour and weight, 72 to 96 px (with no title: #111111 at the captions' weight), and a title's accent is null, unless the creator names a look or a colour.`

  and in the call-out's line, replace `in the pop look in the captions' highlight colour, or as a label` by
  `in the pop look in the captions' highlight colour, or as a label (always a label where the captions have no highlight colour)`.
  Nothing else in the prompt changes.

- [ ] **Step 5: Run Step 2's command and see it pass; then the whole edit suites, both `tsc` commands, `eslint`.**
  `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/edit src/lib/edit src/app/api/edit src/app/dev-edit`
  A test elsewhere that listed the call-out's fields or the prompt's sentences and now fails is updated and named in the
  report. `as-before.test.tsx` passes unchanged.

- [ ] **Step 6: What the facts and the says tell.** Read how the title's weight is told in the agent's facts and says
  (`effectOf`, `saidOf` in `src/lib/edit/agent/context.ts`; search for `weight`). If a call-out's weight change would be
  told wrongly or not at all by them, do not build it: write in the report what a creator would be told today when a
  call-out's weight changes, in one paragraph. (The first slice left the title's the same way, as a deferred minor.)

- [ ] **Step 7: Commit.**
  `git -c core.hooksPath=/dev/null commit -m "feat(edit): a call-out may carry a weight, and is a label in the title's voice on a film with no highlight colour" -- src/lib/edit/parts.ts src/edit/film/layout.ts src/lib/edit/agent/catalogue.ts src/lib/edit/agent/prompt.ts <the test files changed>`

---

### Task 4: The proofs, and the owner's files

**Files:**
- Modify: `scripts/edit-preview-vs-render.ts` only if Step 2 needs a demo line it lacks
- Create (git-ignored): `.scratch/native-default-2/` sheets, films and `for-the-owner/`
- Modify: this plan's **Results** section (below), committed

**Interfaces:**
- Consumes: Tasks 1 to 3 committed. The scripts as they are: `scripts/edit-preview-vs-render.ts` (the kit's proof in
  Chromium and WebKit), `scripts/edit-agent-proof.ts` (a first cut and the requests, live on Qwen),
  `scripts/edit-film.ts` (a whole edit to mp4, local). Read each script's usage lines before running it. The first
  slice's Results in `docs/superpowers/plans/2026-11-24-native-default.md` (its Tasks 4 and 9) show the exact commands
  that were run; use the same.

- [ ] **Step 1: The suites on the final code.** The four edit suites, both `tsc` commands, `eslint` on `src/edit` and
  `src/lib/edit`. Record the counts.

- [ ] **Step 2: The kit's proof.** Run the preview-against-render proof in Chromium and WebKit as the first slice's
  Task 4 did. It must hold a frame with a two-line label and a frame with an evened sentence page; if its demos have
  neither, add one demo line for each (made-up words) and say so. Expected: every frame within the script's own limits
  (0.4 % of pixels far apart). Name each old frame line that moved and why (only a label of two or more lines may).

- [ ] **Step 3: The first cut, for the controller's eye. STOP after it.** One first cut of the owner's take with no
  style, live, on the final code; render it with `scripts/edit-film.ts` to
  `.scratch/native-default-2/first-cut/native-default-2.mp4`. Make
  `.scratch/native-default-2/first-cut/before-after.jpg`: the first slice's film
  (`.scratch/native-default/for-the-owner/native-default.mp4`) above, the new one below, at the same eight moments
  spread over the film, each frame 405 px wide; and `pages.txt`: every caption page's words, old and new, side by side.
  Look at the sheet with the Read tool; write what you see. Report DONE_WITH_CONCERNS with the paths and STOP: the
  controller rules before the requests are run.

- [ ] **Step 4: The requests.** After the controller's word: the 27 requests three times each on that first cut, as the
  first slice's Task 9 ran them. Judge from the ops and the facts; make sheets only for r05, r06, r07 and r20, and for
  any run whose ops differ in kind from what its request asks. The gate line, beside the first slice's final (done as
  asked 54 of 66, looks right 66 of 66, refusals 13 of 15, median 1.6 s, 0.0442 c a change): every miss named with its
  cause; for r06 and r20, the call-out's look, colour, weight and size in each run.

- [ ] **Step 5: The owner's files** in `.scratch/native-default-2/for-the-owner/`: `native-default-2.mp4`,
  `before-after.jpg`, `call-out.jpg` (r06 before and after, with the tool's sentence), and `notes.md`: what changed, in
  a creator's words, the numbers beside the last ones, and what was not done. No more than one page.

- [ ] **Step 6: Results.** Write this plan's Results (below): the counts, the proof's lines, the gate line, what was not
  done. No word of the owner's take, no reference wording. Commit the plan file alone.

**The deploy is not in this task.** It is made only on the owner's word, by the controller's order, after the final
review, from a clean tree (S8).

## Results

(Written by Task 4, 2026-11-24, on `eea7a7c4`. Task 4 changed no code: the proof script needed no demo line.)

- **Step 1, the suites:** the four edit suites (`src/edit src/lib/edit src/app/api/edit src/app/dev-edit`), 63 files,
  1,438 tests passed; both `tsc` commands and `eslint src/edit src/lib/edit` exit 0.
- **Step 2, the kit's proof** (the first slice's Task 4 command, the same 149 frames): "preview and render agree (298
  frames compared in the browsers held)" and "the kit draws the boxes layout.ts gives". At worst Chromium 0.292 % of
  pixels far apart (`demo-title-label` frame 3), colours 0.76 levels (`demo-cut-fade-long` frame 187); WebKit 0.340 %
  (`demo-title-outline` frame 259), colours 1.65 (`demo-title-outline` frame 268): the first slice's worst numbers. The
  boxes: title, call-out and captions each 19 checked, at worst 0.000 px apart, the emoji string skipped as before; drawn
  with a weight: 3 sentence pages, 9 titles.
  - The demos already hold both kinds of frame asked: labels of several lines (`demo-title-label` frames 0, 3, 24, 47,
    three lines; `demo-kit1-label-accent` and `-accent-dark` frames 3, 24, 44, two lines) and evened sentence pages
    (`demo-native-600` frames 3, 20, 192, 262). So no demo line was added.
  - Frame lines that moved against the first slice's run: 8 of 298, each by a hundredth or less. Of the 286 old lines, 4,
    all labels of several lines (S3): Chromium `demo-kit1-label-accent` 3 and `demo-title-label` 3, WebKit
    `demo-title-label` 3 and 24, colours 0.01 levels each, pixels unchanged. Of `demo-native-600`, the four WebKit lines of
    the frames whose pages evening changed (S1); its Chromium lines read 0.000 % both days.
  - One summary line moved: pages held by a taller page of their run, 1 at the top (was 2), 3 at the bottom. Rebuilt
    outside the browser, filled against evened: only string 15 (plain at a weight, so set as a sentence) differs; evened,
    no page of its run is held, so the check takes the first page shown. Both edges are still crossed, as the run requires.
- **Step 3, the first cut** (`first-cut --style none`, live; rendered with `edit-film.ts`): 1 round, 2.2 s, 0.0070 ¢.
  11.27 s from 12.7 s (the first slice's cut: 11.10 s; this run's cuts sit 25 ms earlier, the title's settings are the
  same), 3 shots, 1 punch-in. Captions plain 64 px at 600, five words, y 0.76; the label 72 px at 600, two lines, held to
  the end; natural. No errors, one on-face warning at 0.2 s. Its pages: 9, of 2, 3, 4, 4, 3, 3, 3, 3 and 2 words (the
  first slice's film: 2, 5, 2, 5, 2, 3, 5, 1, 2); no page of one word; the breaks fall at a comma and between phrases
  where the old pages split them. The label, seen at full size: one shape, the joins curved; the old two boxes' notch
  is gone. The controller looked at the sheet and accepted the cut.
  - Known property, recorded by the controller's ruling and not changed: where two breaks give equally even pages, the
    longer silence decides and then the earlier break, so one frame of silence can choose between them (the same seven
    words broke 4/3 on the first slice's cut and 3/4 on this one).
- **Step 4, the requests** (27 × 3 on this first cut, live, no stills, no Modal), judged from the ops and the facts, with
  sheets for r05, r06, r07 and r20 (no run's ops differ in kind from its request). The gate line beside the first slice's:

  | | done as asked | looks right | refusals | median / worst | a change |
  |---|---|---|---|---|---|
  | part 3's last | 55/66 | 66/66 | 15/15 | 1.5 / 4.7 s | 0.042 ¢ |
  | first slice, final | 54/66 | 66/66 | 13/15 | 1.6 / 6.1 s | 0.0442 ¢ |
  | **this slice** | **55/66** | **66/66** | **15/15** | **1.8 / 4.6 s** | **0.0416 ¢** |

  The says: 0 kit terms, 0 second sentences, 0 numbers not given; 80 the model's own, 1 the code's.
  - Misses (11): r02 × 3 (no room above the chin: once said so; once the same height sent, so nothing changed and the
    code's sentence says so; once the captions made bigger, 92 px, and the say claims they now sit above the chin). r09 × 3
    (no pause in the first seconds; it names the nearest clean cut), as in part 3. r21 × 3 (the pill is set; the height is
    already the lowest clear place), as in part 3. r13 runs 1 and 3 (the middle shot, about 40 % of the film, does not
    zoom, and the say reads "throughout"); run 2 zoomed all three shots.
  - Refusals 15 of 15: r22 refused all three times, naming both reasons, with no op (the first slice: 1 of 3).
  - **r06, the call-out, each run** (1 round; 1.9, 2.1, 1.8 s): pop, `#ffffff`, weight 800 (sent by the model), 130 px,
    y 0.22, above the head. Not the label of S6 in any run: the craft lines were in the model's prompt, and it sent the
    pop look all three times. The prompt is unchanged (ruled). The label gave way: the code ended it at frame 180, the
    call-out comes in at 186, and the code's clause in the say tells it once.
  - **r20, the moved call-out, each run** (2 rounds, the first place, y 0.55, sent back by the review as on the eyes;
    2.7, 2.6, 4.1 s): moved from y 0.66 to 0.2, 0.22 and 0.2; still pop, `#ffffff`, no weight (800), 120 px, as the setup
    made it (only its place was asked). The label gave way at 180, told once by the code's clause.
  - r05: the new hook is a label in dark letters, no colour (run 1 marks it with no accent, runs 2 and 3 with the letters'
    own colour as accent; it draws the same). r07: the closing line is a label in dark letters at 600 with no colour; the
    code ends the hook at 272, six frames before it. r16: the highlight turns on and the word is yellow.
- **S6 by code (Task 4b, on `4fbad27e`).** S6 told by the prompt alone failed 3 of 3 (r06 above), so the controller moved
  it into code: `calloutVoice`, one of the loop's own moves, sets a call-out an answer added, white, on captions that
  draw every word alike, as a label in the colour and weight of the film's label title, its size held in 72 to 96 px; a
  call-out only moved is left as sent. r06 and r20 were run again, three times each, on the same first cut with the same
  script and settings (tag `callout-code`):

  | run | look | colour | weight | size | y | label gave way | done as asked | looks right | time |
  |---|---|---|---|---|---|---|---|---|---|
  | r06-1 | label | #111111 | 600 | 96 | 0.22 | ends at 190, call-out at 196 | no: on the next word | yes | 4.5 s, 1 round |
  | r06-2 | label | #111111 | 600 | 96 | 0.22 | ends at 190, call-out at 196 | no: on the next word | yes | 2.7 s, 1 round |
  | r06-3 | pop | #ffffff | 800 | 130 | 0.22 | ends at 180, call-out at 186 | no: an op not asked | yes | 2.5 s, 1 round |
  | r20-1 | pop | #ffffff | none (800) | 120 | 0.22 | ends at 180 | yes | yes | 4.8 s, 2 rounds |
  | r20-2 | pop | #ffffff | none (800) | 120 | 0.2 | ends at 180 | yes | yes | 4.9 s, 2 rounds |
  | r20-3 | pop | #ffffff | none (800) | 120 | 0.22 | ends at 180 | yes | yes | 2.7 s, 1 round |

  - The code's move works where it applies: in r06 runs 1 and 2 the model sent the template call-out (pop, white, 800,
    130 px) and it ends as a label in the title's voice. Both runs, though, set it on the word after the named one (it
    comes in 0.36 s after the named word starts; every earlier run set it on the named word): the model's own choice,
    which the move does not touch, judged a miss. In run 3 the model also set the captions' highlight colour to white,
    which is not asked and draws nothing on these captions, but takes the film out of the rule, so the call-out stays
    as sent; judged a miss for the op not asked. The says do not mention either.
  - r20 as ruled: only moved, left as the setup made it. Runs 1 and 2 had their first place (y 0.55) sent back by the
    review as on the eyes, as in the gate's runs; run 3 placed it in one round.
  - No run has a review error or warning the gate's run of the same request did not have (none left in any of the six).
  - **The gate's totals after Task 4b**, from these 6 fresh runs and the 75 kept ones (tag `requests-4b`): **done as asked
    52/66, looks right 66/66, refusals 15/15, median 1.8 s, worst 4.9 s, 0.0412 ¢ a change.** The three new misses are r06's
    three runs; r20 stays 3 of 3.
- **The final review and its fix wave.** No Critical; two Important fixed: a call-out where the creator names a colour,
  look or weight stays as sent, and even paging leaves no page of one word at three a page (`6c354377`, `8c58cbb5`); the
  white-highlight dodge of 4b is undone by code (`6c354377`). `ae06582c` moves a label's line spans into one function.
- **The final proofs (Task 4c, on `ae06582c`).**
  - The stored first cut paged again with this code: identical to Step 3's pages, so its film and sheet stand.
  - The kit's proof, the same command: "preview and render agree (298 frames compared in the browsers held)" and "the
    kit draws the boxes layout.ts gives". All 298 frame lines identical to Step 2's run. Worst: Chromium 0.292 %
    (`demo-title-label` frame 3), colours 0.76; WebKit 0.340 % (`demo-title-outline` frame 259), colours 1.65. Pass.
  - r06 three times, live, the same first cut, script and settings (tag `callout-fix`):

    | run | model sent | ends in the edit | highlight | word | label title | done as asked | looks right |
    |---|---|---|---|---|---|---|---|
    | 1 | pop, #ffffff, 800, 130, y 0.22 | label, #111111, 600, 96, y 0.22 (by code) | none | the named word | ends at 180, call-out at 186 | yes | yes |
    | 2 | pop, #111111, 800, 130, y 0.22 | as sent (not white, so left) | none | the next word (0.36 s late) | ends at 190, call-out at 196 | no | no |
    | 3 | pop, #ffffff, 800, 130, y 0.22 | label, #111111, 600, 96, y 0.22 (by code) | none | the named word | ends at 180, call-out at 186 | yes | yes |

    Run 2: the model sent pop in the label's ink; the code restyles only a white call-out, so it stays as sent: black
    letters with a dark edge over dark hair, hardly readable at full size, and the review raised nothing. No captions op
    was sent in any run; no review error or warning in any. 5.5, 2.8 and 2.9 s; 0.0329, 0.0333, 0.0329 ¢.
  - r06's timing over the nine runs of this slice: on the named word 6 of 9 (the gate 3 of 3, Task 4b 1 of 3, this round 2
    of 3); the other three on the next word, the model's own `atMs`.
  - Totals after Task 4c, from these 3 runs, Task 4b's three r20 runs and the gate's 75 others (tag `requests-4c`): done
    as asked 54/66, looks right 65/66, refusals 15/15, median 1.8 s, worst 5.5 s, 0.0412 ¢ a change. The misses: r02 × 3,
    r09 × 3, r21 × 3, r13 × 2 (as above), and r06 run 2 (the one that does not look right). Superseded by Task 4d.
- **The dark call-out, and the final gate line (Task 4d, on `1d8decf6`).** 4c's run 2 showed a new call-out the model
  sent in a dark colour left as sent and hardly readable. Ruled: on a film whose captions draw every word alike, where the
  request names no colour, look or weight, every call-out an answer adds is set as the label in the title's voice,
  whatever colour the model gave it; its timing stays the model's (parked as the next slice's first item). r06 three times
  more (tag `callout-any`): each on the named word (frame 186), each ending as a label, #111111, 600, 96 px, y 0.22, the
  highlight none at the end, the title ending at 180; done as asked and looks right 3 of 3. The model sent the white pop
  call-out with an unasked white highlight in runs 1 and 3 (the code set the highlight back to none: the 4b dodge, now
  undone live) and the pop look in #111111 in run 2 (now restyled). 6.3, 4.7 and 5.5 s, one round each. r06's timing over
  the slice's twelve runs: on the named word 9 of 12, a word late 3. **The final totals**, from these 3 runs, Task 4b's
  three r20 runs and the gate's 75 others (tag `requests-4d`): **done as asked 55/66, looks right 66/66, refusals 15/15,
  median 1.8 s, worst 6.3 s, 0.0412 ¢ a change.** The 11 misses: r02 × 3, r09 × 3, r21 × 3, r13 × 2, as above.
- **Step 5, for the owner** (git-ignored, `.scratch/native-default-2/for-the-owner/`): `native-default-2.mp4`,
  `before-after.jpg` (the first slice's film above, this one below, eight moments), `call-out.jpg` (Task 4c's r06 run 1:
  on the named word, as a label; before and after at 540 px a frame, with the tool's sentence), `call-out-before.jpg`
  (the gate's r06 run 1, kept to compare), `notes.md`.
- **Not done:** the second take's first cut and the page's check in a browser (both need the test account's login, not
  set on this machine). Not deployed (S8): until the worker is deployed again it pages sentence captions filled, draws a
  label of several lines as stacked boxes, and refuses a call-out with a weight. No Modal job ran; the spend was not read.
- **Deployed** (2026-11-24, on the owner's word, by the controller's order). Commit `574a79d8`, the tree clean; the bundle
  takes 29 files of the repo (`shape.ts` new), its digest (`shasum -a 256 worker/.bundle/*.js | shasum -a 256`)
  `0bc8ea28967e844eba0930724a0cc1001fcf2dff5604923e49442d29d474dab4`. The image's tests: 430 passed, 29 skipped.
  Before the deploy the worker refused the check edit (r06 run 1's final edit: even caption pages, the two-line label, a
  label call-out at 600) with its own 500 line; the same edit with the call-out's weight left out gave its stills, so the
  refusal was the old strict schema and the call-out's weight. After: the check edit's frames 60 (the two-line label and a
  caption page), 198 (the call-out in) and 300 (a late caption page) from the deployed worker against this Mac's render
  (scaled to the worker's half stage): 0.178 %, 0.019 % and 0.016 % of pixels far apart (0.4 % allowed), colours 1.39,
  1.27 and 1.53 levels apart (reported, one side a JPEG); alike by eye. r06 once more with stills on, on this slice's
  first cut: one round, the call-out a label (#111111, 600), the title ending at 180, no error left; the model asked for no
  stills, so the loop drew none. Modal, metered as read: $4.21 before, $4.27 after the image's tests, $4.26 after the
  deploy and its checks (the summary lags); billed $0.00.
