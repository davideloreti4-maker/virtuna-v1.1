# The native default (the native look, first slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every first cut made without a style looks as if it was made in TikTok's or Instagram's own editor (plain white sentence captions, a white label that stays, few punch-ins, natural colour), and nothing made before it draws differently.

**Architecture:** Lighter weights enter the width tables first, then a closed `weight` setting on the captions and the title, read by the kit's one layout function (`src/edit/film/layout.ts`) that the parts draw from and `review` judges from. Plain captions that carry a weight are set as a sentence (the typeface's own space, a thinner edge). The kit is then proved and the worker's render bundle deployed, before any first cut carries a weight. Meanwhile `placeCaptions` learns to take words off a page before it makes plain and pill letters smaller, Bold pop keeps today's look under its own name, and the hook becomes a claim of up to eight words on two lines. Last, the house's sizes are ruled from a sheet, the house style changes, and the agent is proved.

**Tech Stack:** TypeScript, zod 4, vitest (happy-dom for the kit's components), Remotion 4.0.545 (kit, Player and renderer), Playwright (Chromium and WebKit) for the browser proofs, Qwen 3.7-flash through `askQwen`, the worker on Modal.

**Requirements:** `.scratch/tool-belt/slice1-rulings.md` (the controller's rulings for this slice; git-ignored), with the rulings on this plan below. The owner approved the slice on 2026-11-24: "the default changes, the label stays", scope "default only". **Spec:** `docs/superpowers/specs/2026-11-24-native-look-design.md`, sections 1, 2.4, 3.1 and the lighter weights of 3.2; the rest is later work. **The code's map:** `.scratch/tool-belt/seams.md` (written at `2887e8a4`; every line this plan cites was read again at `8f859e3d`). **The mock this slice answers:** `.scratch/native-look/notes.md`.

---

## Order and lanes

Two implementers can work at once, in this one worktree, on disjoint files:

| | Tasks, in order | Files only this lane touches |
|---|---|---|
| **Lane A, the kit** | 1 → 2 → 3 → 4 (the kit's proof; then the deploy, on the controller's word) | `scripts/edit-font-widths.ts`, `src/edit/film/{widths,spaces}.json`, `src/lib/edit/{atoms,doc,parts}.ts`, `src/edit/film/{layout.ts,Captions.tsx}`, `src/lib/edit/style/profile.ts`, `src/lib/edit/agent/{catalogue,context}.ts`, `scripts/edit-preview-vs-render.ts`, and their tests (`measure`, `doc`, `parts`, `ops`, `review`, `layout`, `as-before`, `weights`, `catalogue`, `context`, `loop`, `profile`) |
| **Lane B, the recipe, the presets, the hook** | 5 → 6 → 7. **Task 7 starts only once Task 2 is committed**: it sets a hook as a title at a weight (`titleBox` with `weight`, `StyleProfile["title"]["weight"]`), which Task 2 brings | `src/lib/edit/recipes/{captions,index}.ts`, `src/lib/edit/style/{presets.json,presets.ts,words.ts}`, `src/lib/edit/agent/{first-cut,prompt}.ts`, and their tests (`recipes`, `presets`, `words`, `first-cut`, `prompt`, `agent-route`, `parts.test.tsx`) |
| **Then, one implementer** | 8 (**only after Task 4's deploy and Tasks 5 to 7**) → 9 → 10 | |

Checked against every file each task names: no file is in both lanes. `layout.ts`, `Captions.tsx` and `catalogue.ts` are touched by Tasks 2 and 3 only; `recipes/captions.ts` by Task 5 only (Task 3 does not touch it, and Task 5 does not touch `layout.ts`); `first-cut.ts` by Tasks 6, 7 and 8, in that order; `parts.test.tsx` by Tasks 6 and 8. Task 5's fixtures carry no weight, so it can run before Task 2 is in.

Working side by side:
- Each lane stages and commits only its own named paths. One commit at a time: a `.git/index.lock` means the other lane is committing; wait and retry.
- While the other lane has uncommitted work, a lane runs its own tests. Every task's "every suite" step and both type checks are run again after the other lane's next commit and before the task's review; a failure is placed with the lane whose files cause it.
- Renders and browser proofs (lane A's stills and proof runs, lane B's `--render` cuts in Task 7) run one at a time on the machine: the lane that comes second waits.

---

## Rulings (2026-11-24)

Each was a place where the code makes a ruling harder than it reads. The controller ruled each; the reasoning is kept.

**R1. Plain's own space and thinner edge only when the captions carry a weight. Ruled (a).**
Three presets and every stored edit made in them use `plain` today: Sentences, Key words and Black and white (`src/lib/edit/style/presets.json`), and the demos `demo-captions-plain`, `demo-t10b-stress-plain` and `demo-kit1-plain-12`. Ruling 2 changed plain's gap and edge; ruling 8 says they draw exactly as before. (a) Only plain captions that carry a weight are set as a sentence; plain with none keeps the 0.34 em gap and the 0.09 edge. (Not taken: (b) every plain page, which moves those presets and stored edits; (c) a fifth caption look, about fourteen places and more catalogue text than the guard leaves.) Task 3.

**R2. "Two lines" is measured by code. Ruled (a).**
Measured with the width tables (TikTok Sans 700; 600 is about 2 % narrower): a 44-character hook is about 1,700 px wide at 84 px; two lines of the label hold about 1,550 px (842 px of box less 2 × 34 px of padding, twice), so about 38 to 40 characters. At 76 px two lines hold about 42 to 44 characters, at 68 px about 50 (the label's size is ruled in Task 8). The kit sets a title on up to three lines. (a) The model is told 8 words, 44 characters and two lines; the code measures the hook as the title will be set (the profile's look, size and weight); a hook over two lines is sent back once, with how many characters of it two lines hold, and whatever comes next is kept, as a hook that repeats the opening is today. It holds for every first cut's hook: at Bold pop's 130 px two lines hold about the 28 characters its hooks have today. (Not taken: (b) a cap of about 36 characters; (c) three lines.) Task 7; six tests whose made-up hook is 28 Ws get a second scripted answer.

**R3. The stressed word one step heavier, checked by eye. Ruled (a), with a check.**
Today a stressed word is 900 over 800. With a set weight it is one step heavier, at most 900 (600 gives 700; X123). Task 8's sheet shows one candidate twice, the stresses one step heavier and at the same weight. If the controller rules "the same", a plain page with a weight and no highlight colour draws every word at the captions' weight: Task 8 builds it, with its test, and since that changes `layout.ts` (the render bundle), Task 10's second deploy follows.

**R4. Today's house values stay where presets use them. Ruled as recommended.**
Bold pop was built from `HOUSE_STYLE` (`presets.json` `"from": "house"`, `src/lib/edit/style/presets.ts:47-49`); a preset's or a words style's title whose captions have no colour marks its key word in the house's yellow (`src/lib/edit/agent/first-cut.ts:303`); a words style that adds a title to a preset with none takes the house's title (`src/lib/edit/style/words.ts:101`). So: Bold pop gets today's values in its own entry; the yellow mark is kept, by name, for preset and words styles only (the house gets none, as ruled); a words style's added title is Bold pop's. No preset changes. Task 6.

**R5. Ruling 3 holds for every plain and pill captions. Ruled (a).**
Sentences, Clean, Black and white and Key words are placed by `placeCaptions` like the house; where their captions must move off the face they now lose words before size. Their profiles and their drawing do not change; their placements on the owner's take are recorded before and after. Task 5.

**R6. At every size, words from the asked count down to four. Ruled (a).**
Only this reading makes "a larger size asked never ends smaller than a smaller size asked" hold: from any size down, two asked sizes try the same settings in the same order. (Not taken: four words at every smaller size, where asked 64 can end at 64 with six words and asked 72 at 60 with four.) Task 5.

**R7. The agent's room and `captionsFit` stay. Ruled (a).**
They describe what the review allows at each count of words and size (`src/lib/edit/agent/context.ts:524-611`); the prompt already says "Fewer words a page is how captions grow" (`prompt.ts:74`); nothing the model reads names `placeCaptions`' order. No task changes them.

**R8. A closing line under a hook that stays: no prompt change for now, measured. Ruled (a), measured.**
The default's label stays to the end; a closing line is a title over the last seconds (`prompt.ts:64`); two titles at once are an error whose fix the review names ("end the first before the second starts"). The judge counts ending the hook where the closing line starts as part of the asked change. Task 9 reports, for r07, each of its three runs' rounds and seconds and what happened to the hook; the controller then rules on a prompt line or a code-made move.

**R9. The house's sizes are ruled from a sheet (the controller's change, 2026-11-24).**
By eye on reference 4 its label is about 66 px and its captions about 50 px (the "65" of the rulings was a row's pitch, not a letter size). So no size of the house is fixed in this plan: Task 8 starts with a sheet of three candidates, captions 52, 58 and 64 px, each with its label at 1.3 times (68, 76, 84), and stops for the controller's ruling.

**R10. The deploy comes before any first cut carries a weight (the controller's change).**
The deployed bundle's schema is strict, so an edit with a `weight` cannot be rendered, stilled or downloaded until the worker is redeployed. The bundle changes in Tasks 2 and 3 only, and an old edit draws the same on the new one. So the deploy is Task 4's, after Task 3's review and the kit's proof, on the controller's word; Task 8, the first to make a first cut carry a weight, does not start before it.

Decisions X122 to X131 stand as proposed.

---

## Global Constraints

The rulings' own words where they bind (`slice1-rulings.md`, "Rules carried over"):
- The agent calls only Qwen; it writes operations, never code.
- Every change passes the one door (`applyOps`, then `checkEdit`).
- What is seen is what is posted: any change to the kit (`src/edit/film/`) keeps `scripts/edit-preview-vs-render.ts` saying "preview and render agree" in Chromium and WebKit.
- The craft is in code.
- The repository is public: no real id, link, creator name, reference wording or word of the owner's take in any committed file. References are "reference 3" and "reference 4"; the takes are "the owner's take" and "the second take". Every text a test or this plan writes is made up. Other people's frames stay in `.scratch` and are never committed.
- Never read `.env*` or `~/.modal.toml`. Scripts load `.env.local` programmatically and print no value of it.
- `remotion` and `@remotion/*` stay at exactly 4.0.545. No package is added in this slice.
- Commit only with `git -c core.hooksPath=/dev/null commit` on `feat/edit`, by named paths; never push.
- Tests exercise the real code; mocks only at network boundaries (Qwen's `ask`, the worker's `stills`). The kit's component tests stand the tables in for the browser's `measureText`, which happy-dom cannot run, as `sentence-pages.test.tsx` and `label-light.test.tsx` already do; nothing else is stood in for.
- Vitest runs as `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run <path>`. The type checks are `pnpm exec tsc --noEmit` and `pnpm exec tsc -p scripts/tsconfig.edit.json`. The machine is shared: a test that times out is run again alone before it is judged.

The slice's exact values, verbatim from the rulings:
- Weights: the width tables gain **400, 500 and 600** for `inter`, `montserrat` and `tiktok`. Captions and titles may carry a weight, **a closed set: 400 to 900 in hundreds**; where none is given, **each look keeps the weight it has today, so no existing edit changes by a pixel.**
- Plain captions: **the typeface's own space at that size and weight, not the 0.34 em gap**; **the dark edge thinner for `plain`**, chosen by eye from **0.05, 0.06, 0.07 of the size**; **the same numbers in the kit's drawing and in review's box (one function, as today).**
- The fit, plain and pill: **the place first (as today), then fewer words a page down to four, only then smaller letters**; sizes **absolute and descending (the asked size, then steps down to a floor of 44 px)**. `pop` and `highlight` keep today's order.
- The house: captions **`plain`, `tiktok`**, weight **600**, **five words a page, no highlight colour**, at a size **ruled at Task 8's sheet** (candidates 52, 58, 64 px); title **the label look with dark letters on the light box, weight 600**, at **1.3 times the captions** (candidates 68, 76, 84 px), ruled at the same sheet, **placed by the title recipe**, **staying to the end of the film**, **no marked word in colour**; punch-ins **4 a minute at zoom 1.10**; colour look **natural, not chosen by the model**; **the pace stays the model's choice.**
- The hook: **up to eight words, 44 characters, two lines: a claim or a direct statement about what the video gives, never a question, in words the opening sentence does not use. The short fallback stays.**
- The picker: **Bold pop moves to the end of the styles.**
- The deploy: **only on the controller's word, from a clean tree, under the plan's Modal cap ($5.00).** Part 3 left Modal at $4.12.

Running things:
- Dev servers bind to 127.0.0.1. A browser proof is one command that starts its own server; one browser proof or render run at a time (`next dev` allows one server per folder). Stop under 1.2 GB of free disk.
- Throwaway scripts and their outputs go in `.scratch/native-default/` (git-ignored). Demo edits go in `.scratch/media/` (git-ignored).

---

## Decisions taken in this plan (stand as proposed)

Numbered after part 3's last (X121).

| # | Decision | Why |
|---|---|---|
| X122 | A `weight` is optional on the captions and on a title, one of the closed set; left out, the look's own (captions 800, a stressed word 900; a title 700 as a label, 800 otherwise). The title's size limits stay 48 to 220, the captions' 44 to 200. | An optional field is the only form every stored edit still parses under; every candidate size (52 to 84 px) sits inside today's limits. |
| X123 | A stressed word is one step (100) heavier than the captions' weight, at most 900 (R3, checked by eye in Task 8). | The step today's 800 and 900 already are. |
| X124 | Plain captions with a weight are set as a sentence; plain with none as before (R1). | Rulings 2 and 8 both hold. |
| X125 | The typeface's own space is the width tables' advance of U+0020 at that weight, written beside them by the same script as `src/edit/film/spaces.json` (ems), read by `layout.ts` for the kit and the review alike; the gap is round(space × the page's size). | One number for both, by construction (ruling 2). The kit never carries the whole tables (`src/lib/edit/index.ts`'s header: the Player holds nothing heavy); this file is 18 numbers. The browser's `measureText(" ")` could round apart from the table's. |
| X126 | Plain and pill sizes are tried on a grid of 4 px: the asked size, then each multiple of 4 below it, down to 44. At each size, words from the asked count down to four (R6); at each count, the places of the band. | Within 4 px of the largest clear size; at most about 160 reviews a placement (under half a second on 90 s), measured in Task 5. |
| X127 | Bold pop holds today's house values itself; a preset's or a words style's title marks its key word in today's yellow, by name; a words style's added title is Bold pop's (R4). | No preset changes in this slice. |
| X128 | The hook is checked by code against two lines at its title's size and sent back once when over (R2); a hook with a question mark is repaired like any bad answer. | The model cannot measure; a question mark is the one sign of a question code can read in three languages. |
| X129 | With no style, the model is told the look is natural, and the code sets natural whatever it answers. | Ruling 4, and the model is told the truth. The answer keeps its `look` field, so no other prompt or schema moves. |
| X130 | The change loop's titles follow the hook's word count (now eight), as `prompt.test.ts:73-78` already ties them. | One voice for a title, as before. |
| X131 | "Nothing old changes" is held three ways: a digest of every box the kit lays out for settings with no weight, frozen before the change; the stills of the 40 old demo edits rendered before and after, pixel for pixel; and the preview-against-render proof's old frame lines, as ruled. | The digest is fast and runs with every suite; the stills catch what a box does not (an edge, a weight); the proof is the ruling's own check. |

---

## File Structure

| File | What changes | Task |
|---|---|---|
| `scripts/edit-font-widths.ts` | Weights 400 to 900; also writes `spaces.json` | 1, 3 |
| `src/edit/film/widths.json` | Regenerated: six weights a typeface | 1 |
| `src/edit/film/spaces.json` | New, generated: each typeface's space, in ems, by weight | 3 |
| `src/lib/edit/atoms.ts` | `WEIGHTS`, `Weight` | 2 |
| `src/lib/edit/doc.ts` | `CaptionsSchema.weight` (optional); the header's "no default" sentence | 2 |
| `src/lib/edit/parts.ts` | The title's `weight` (optional) | 2 |
| `src/edit/film/layout.ts` | `captionWeights`, `titleWeight`; then `spaceEm`, `sentenceSet`, `PLAIN_EDGE`, `edgeOf`; on R3 "the same", `captionWeights` again | 2, 3, (8) |
| `src/edit/film/Captions.tsx` | Weights from `captionWeights`; then the edge from `edgeOf` | 2, 3 |
| `src/lib/edit/agent/catalogue.ts` | The meaning of `weight` (Captions, title.props) | 2, 3, (8) |
| `src/lib/edit/agent/context.ts` | `effectOf` and `saidOf` name a weight that changed | 2 |
| `src/lib/edit/style/profile.ts` | A style's captions and title may hold a weight | 2 |
| `scripts/edit-preview-vs-render.ts` | The box check sets weights and counts sentence pages and weighted titles | 4 |
| `src/lib/edit/recipes/captions.ts` | `captionSizes`, `wordCounts`, the turned-round fit | 5 |
| `src/lib/edit/style/presets.json`, `presets.ts` | Bold pop's own values, last; no `"from": "house"` | 6 |
| `src/lib/edit/style/words.ts` | A words style's added title is Bold pop's | 6 |
| `src/lib/edit/agent/first-cut.ts` | `MARKED`; the hook's rules and prompt; the title's weight; natural look | 6, 7, 8 |
| `src/lib/edit/agent/prompt.ts` | `COUNTS` to eight; `CRAFT.title.words` 8 | 7 |
| `src/lib/edit/style/house.ts` | The native house style, at the ruled sizes | 8 |
| `src/app/dev-edit/agent/StylePicker.tsx`, `Sample.tsx` | "Our pick" says what the default is; the sample's weight | 8 |
| Tests, new | `src/edit/film/__tests__/as-before.test.tsx`, `src/edit/film/__tests__/weights.test.tsx` | 2, 3 |

The worker's render bundle (entry `src/edit/film/root.tsx`) is built from `src/edit/film/**` and, through the barrel, `src/lib/edit/{index,time,parts,doc,derive,check,ops,analysis,atoms}.ts`; the image also carries `public/edit/**` and `worker/**`. Of this plan only **Tasks 2 and 3** change any of them (and Task 8 only if R3 is ruled "the same"). No file under `public/edit` changes: every font file already holds 400 to 900 (`src/edit/film/fonts.ts:24-28`).

---

### Task 1 (lane A): Weights 400, 500 and 600 in the width tables

**Files:**
- Modify: `scripts/edit-font-widths.ts:12-17` (the header's list of weights), `:36` (`WEIGHTS`)
- Regenerate: `src/edit/film/widths.json`
- Test: `src/lib/edit/__tests__/measure.test.ts:78-81`, `:95-97`

**Interfaces:**
- Consumes: the font files under `public/edit/fonts/`, `FONT_FILES` and `OPSZ` (`src/edit/film/fonts.ts`).
- Produces: `MEASURED_WEIGHTS[font]` is `[400, 500, 600, 700, 800, 900]` for each of `inter`, `montserrat`, `tiktok` (`src/lib/edit/measure.ts:26-30`, read from the file, no code change); `measure(text, font, weight, size)` for every weight of that list.

- [ ] **Step 1: Write the failing tests** in `src/lib/edit/__tests__/measure.test.ts`:
  - rename "holds every weight the kit draws with, in every typeface: 700, 800 and 900" to "…: 400 to 900 in hundreds", expecting `[400, 500, 600, 700, 800, 900]` for every font;
  - "refuses a weight the table does not hold": 400 is held now, so it becomes 300 (`inter` and `tiktok` both draw 300; the table does not hold it): `expect(() => measure("Hello", "inter", 300, 72)).toThrow(/inter.*300/)`, with the 850 case kept;
  - new, "sets lighter letters no wider than heavier ones": for each font, the width of the made-up line "Stop and look at this" at 64 px rises or stays from 400 to 900, and 400 is narrower than 900.
- [ ] **Step 2: Run them; they fail.**
  `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/measure.test.ts`
  Expected: FAIL, "expected [ 700, 800, 900 ] to deeply equal [ 400, 500, 600, 700, 800, 900 ]" and "no widths for inter at weight 400".
- [ ] **Step 3: Change the script.** In `scripts/edit-font-widths.ts`:
  ```ts
  /** The weights each typeface is tabled at: every weight a caption or a title may be set in (400 to 900 in hundreds, X122). */
  const WEIGHTS = [400, 500, 600, 700, 800, 900] as const;
  ```
  and rewrite the header's list (lines 12-17): captions 800 and a stressed word 900, or the captions' own weight and one step more; a title 700 as a label, else 800, or its own weight; a call-out 800; so each typeface is tabled at 400 to 900.
- [ ] **Step 4: Make the tables.** `pnpm exec tsx scripts/edit-font-widths.ts`
  Expected: eighteen lines `<font> <weight>: <n> characters…` and `wrote src/edit/film/widths.json`.
- [ ] **Step 5: The old tables are as they were.**
  ```bash
  mkdir -p .scratch/native-default && git show HEAD:src/edit/film/widths.json > .scratch/native-default/widths-before.json
  node -e 'const [a,b]=[".scratch/native-default/widths-before.json","src/edit/film/widths.json"].map(f=>JSON.parse(require("fs").readFileSync(f,"utf8")));for(const f of Object.keys(a))for(const w of ["700","800","900"])if(JSON.stringify(a[f][w])!==JSON.stringify(b[f][w]))throw new Error(f+" "+w);console.log("the 700, 800 and 900 tables are as before")'
  ```
  Expected: `the 700, 800 and 900 tables are as before`.
- [ ] **Step 6: Run the tests; they pass.** The same command as Step 2, then the trees that read the tables: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit src/edit`. Expected: all pass (`text.test.ts` reads references at 800 and does not move).
- [ ] **Step 7: The browser against the table.** `pnpm exec tsx scripts/edit-measure-proof.ts` (Chromium and WebKit; it serves its own page on a port from 3000 to 3005 and covers every weight of `MEASURED_WEIGHTS` by itself).
  Expected last line: `the table measures as the browser does: every width within 0.5 px, in chromium and webkit, and the film draws those lines alike in both`.
- [ ] **Step 8: Type checks.** `pnpm exec tsc --noEmit` and `pnpm exec tsc -p scripts/tsconfig.edit.json`: no errors.
- [ ] **Step 9: Commit.**
  ```bash
  git add scripts/edit-font-widths.ts src/edit/film/widths.json src/lib/edit/__tests__/measure.test.ts
  git -c core.hooksPath=/dev/null commit -m "feat(edit): width tables at 400, 500 and 600 for the kit's three typefaces"
  ```

**Nothing old changes:** Step 5; nothing reads the new weights yet. **Bundle:** unchanged (the kit does not import the tables).

**Results:** (2026-11-24) Commit `4b9933f8`.
- Tests before: `measure.test.ts` 2 failed, 11 passed: "expected [ 700, 800, 900 ] to deeply equal [ 400, 500, 600, 700, 800, 900 ]" and "no widths for inter at weight 400". The 300 refusal passes before and after (300 was never held). After: 13 of 13; `src/lib/edit` and `src/edit` 45 files, 1,024 tests passed. Step 5: "the 700, 800 and 900 tables are as before" (`widths.json` +9 lines, −0).
- Step 7, by the controller's ruling: the proof now leaves out, by rule, a string with a character the tables do not hold, and prints the count. Before that it failed at every weight, old ones too, on two such fixture strings from `review.test.ts` (an emoji). Run: "left out, 2 of 300"; 298 of 298 strings within 0.5 px in both browsers; last line "the table measures as the browser does: every width within 0.5 px, in chromium and webkit, and the film draws those lines alike in both".
- Worst apart, at 100 / 44 / 31 / 20 / 12 px: Chromium 0.0188 / 0.0177 / 0.0164 / 0.0159 / 0.0159 px, 0 widths over 0.05 px; WebKit 0.1094 / 0.0590 / 0.0464 / 0.0325 / 0.0271 px, 19 over 0.05 px, all Montserrat at 700 to 900 on three random mixes. At the new weights 400, 500 and 600: at worst 0.0188 px (Chromium, Inter 600) and 0.0196 px (WebKit), none over 0.05 px.

---

### Task 2 (lane A): A weight for captions and titles

**Files:**
- Modify: `src/lib/edit/atoms.ts`; `src/lib/edit/doc.ts:5-7` (the header's "No field has a default"), `:182-196` (`CaptionsSchema`); `src/lib/edit/parts.ts:42-51` (the title's props); `src/edit/film/layout.ts:13-47` (the header's rules), `:106-107`, `:146-147` (`setPage`), `:209-211` (`titleBox`); `src/edit/film/Captions.tsx:14`, `:45`, `:62`; `src/lib/edit/style/profile.ts:30`, `:35-40`; `src/lib/edit/agent/catalogue.ts:133-144`, `:173-184`; `src/lib/edit/agent/context.ts:1096-1110` (`effectOf`), `:1168-1183` (`saidOf`)
- Create: `src/edit/film/__tests__/as-before.test.tsx`, `src/edit/film/__tests__/weights.test.tsx`; throwaway `.scratch/native-default/same-stills.ts`
- Test: `src/lib/edit/__tests__/doc.test.ts`, `parts.test.ts`, `ops.test.ts`, `review.test.ts`; `src/edit/film/__tests__/layout.test.ts`; `src/lib/edit/agent/__tests__/catalogue.test.ts` (the helper `written`, `:27-42`), `context.test.ts` (`effectOf`, `:1026`), `loop.test.ts` (`saidOf`'s table, `:1572`); `src/lib/edit/style/__tests__/profile.test.ts`

**Interfaces:**
- Consumes: the tables at 400 to 900 (Task 1).
- Produces:
  ```ts
  // src/lib/edit/atoms.ts
  /** The weights text may be set in: 400 (regular) to 900 (black), in hundreds (X122). */
  export const WEIGHTS = [400, 500, 600, 700, 800, 900] as const;
  export const Weight = z.literal(WEIGHTS); // JSON Schema: an enum, which the catalogue writes 400|500|600|700|800|900
  // If the installed zod 4 takes no list here: z.union(WEIGHTS.map((weight) => z.literal(weight))), which the catalogue writes the same.
  // Captions gains `weight?: 400 | … | 900`; TitleProps gains `weight?: 400 | … | 900`.
  // src/edit/film/layout.ts
  export const CAPTION_WEIGHTS = { plain: 800, stressed: 900 } as const; // unchanged: the weights when the captions set none
  export const STRESS_STEP = 100; // X123
  export function captionWeights(captions: Pick<Captions, "weight">): { plain: number; stressed: number };
  export function titleWeight(props: Pick<TitleProps, "look" | "weight">): number;
  ```
  Task 7 (lane B) waits for this commit: it uses `titleBox` with a `weight` and a style title's `weight`.

- [ ] **Step 1: The old stills, before anything changes.** Write the throwaway `.scratch/native-default/same-stills.ts`:
  ```ts
  /** same-stills.ts (throwaway): `base` renders every job's frames; `compare` renders them again and counts differing pixels. */
  import { mkdirSync, readFileSync } from "node:fs";
  import { join } from "node:path";
  import pixelmatch from "pixelmatch";
  import { PNG } from "pngjs";
  import { stillName, withRenderer } from "../../scripts/edit-render";

  async function main(): Promise<void> {
    const [mode, jobsFile = "", dir = ""] = process.argv.slice(2);
    if (mode !== "base" && mode !== "compare") throw new Error("usage: same-stills.ts base|compare <jobs file> <dir>");
    const jobs = readFileSync(jobsFile, "utf8").trim().split(/\s+/).map((job) => {
      const [demo = "", frames = ""] = job.split(":");
      return { demo, frames: frames.split(",").map(Number) };
    });
    const out = join(dir, mode === "base" ? "base" : "now");
    let [frames, differ] = [0, 0];
    await withRenderer(async ({ still }) => {
      for (const { demo, frames: list } of jobs) for (const frame of list) {
        mkdirSync(join(out, demo), { recursive: true });
        await still(`.scratch/media/${demo}.json`, frame, join(out, demo, stillName(frame)));
        if (mode === "base") continue;
        const [a, b] = ["base", "now"].map((side) => PNG.sync.read(readFileSync(join(dir, side, demo, stillName(frame)))));
        const count = pixelmatch(a!.data, b!.data, null, a!.width, a!.height, { threshold: 0 });
        frames += 1;
        if (count > 0) {
          differ += 1;
          console.log(`${demo} frame ${frame}: ${count} pixels differ`);
        }
      }
    });
    if (mode === "compare") {
      console.log(`${frames} frames compared, ${differ} differ`);
      if (frames === 0 || differ > 0) process.exit(1);
    }
  }
  main().catch((error: unknown) => { console.error(error); process.exit(1); });
  ```
  Run on the unchanged code: `pnpm exec tsx .scratch/native-default/same-stills.ts base .scratch/kit1/proof-jobs-fix2.txt .scratch/native-default/stills` (the 40 demo edits and 143 frames of the last full preview-against-render run, whose 286 lines are `.scratch/kit1/wave-lines.txt`). Then once `compare` on the same code: expected `143 frames compared, 0 differ`. If the renderer alone differs between two runs, record by how much: that is then the limit, and it is named in the Results.
- [ ] **Step 2: Write the digest of today's boxes, and run it green on the unchanged code** (`src/edit/film/__tests__/as-before.test.tsx`, happy-dom, with the tables standing in for `measuredIn` as `sentence-pages.test.tsx:22-28` does):
  - "lays out every caption page, title and call-out of an edit with no weight exactly as before this slice": for each of `CAPTION_LOOKS` × `FONTS` × sizes `[44, 64, 96, 150]` × pages of the first 3, 8 and 16 words of a made-up sentence (words 2 and 8 stressed), `captionPages` with the tables; for each title look × `FONTS` × sizes `[48, 84, 130, 220]` × the texts "Make it *count*" and "Here is the one change that makes it work", `titleBox`; for each call-out look × `FONTS` × sizes `[44, 120, 200]`, `calloutBox`. The JSON of every box, through `createHash("sha256")` from `node:crypto`, equals `AS_BEFORE`, a constant in the test. Write the test with `AS_BEFORE = ""`, run it on the unchanged code, and write the received digest in.
  - "draws captions with no weight as before": for each look at 44, 64 and 96 px (drawn with `Thumbnail` as `sentence-pages.test.tsx:46-58`), the drawn element's `fontWeight` is `"800"`, a stressed word's `"900"`, a row's `columnGap` is `round(0.34 × size)` px, and, but for the pill, `WebkitTextStroke` is `${size * 0.09}px rgba(0, 0, 0, 0.9)`.
  - "draws a title with no weight as before": `fontWeight` `"700"` for a label, `"800"` for bold and outline.
  Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/edit/film/__tests__/as-before.test.tsx`. Expected: PASS on the unchanged code.
- [ ] **Step 3: Write the failing tests.**
  - `doc.test.ts`, "lets the captions carry a weight of 400 to 900 in hundreds, or none": each of 400 to 900 is accepted; 300, 450, 1000 and the string "600" are refused at `captions.weight`; an edit with none parses with no `weight` key.
  - `parts.test.ts`, "lets a title carry a weight of 400 to 900 in hundreds, or none": the same on `PARTS.title.props`.
  - `ops.test.ts`, "sets a weight with captions.set and item.set, and keeps it when another setting changes": `captions.set {weight: 600}` gives 600; a later `captions.set {size: 70}` leaves 600; `item.set {props: {weight: 500}}` on a title gives 500.
  - `layout.test.ts`, "sets caption words at the captions' weight, a stressed word one step heavier, at most 900": `captionWeights({})` is `{plain: 800, stressed: 900}`; `{weight: 600}` gives `{600, 700}`; `{weight: 900}` gives `{900, 900}`; with a measure that grows with the weight, a page at 600 is narrower than the same page with none.
  - `layout.test.ts`, "sets a title at its own weight, and with none at 700 for a label and 800 for the others": `titleBox(title({ weight: 600 }), fixed).weight` is 600 for every look; `titleWeight` with none is 700 for `label`, 800 for `bold` and `outline`.
  - `weights.test.tsx` (new, happy-dom, the same stand-in), "draws captions at their weight and a stressed word one step heavier, and a title at its weight": captions at 600 draw `fontWeight` `"600"` and a stressed word `"700"`; a title at 600 draws `"600"`.
  - `review.test.ts`, "judges captions and titles at every weight the schema allows, in every typeface": for each font × `WEIGHTS`, `review` of an edit whose captions and title carry that weight does not throw and finds no `unmeasured`.
  - `catalogue.test.ts`: the helper `written` (`:27-42`) learns a `ZodLiteral` (its `values` joined by `|`) and marks an optional field with `?`, so the existing "names every part and each of its settings…" (`:68-80`) and "writes the captions' settings…" (`:82-91`) check `weight? 400|500|600|700|800|900`; new expectations that `lineOf("  weight: ")` (Captions) and `lineOf("    weight: ")` (title.props) are the meanings of Step 4; and "is the same every time, and compact" (`:221-228`) stays under 21,000.
  - `context.test.ts` (`effectOf`, `:1026`): `captions.set {weight: 600}` on an edit with none gives the line `the captions: weight 800 to 600 (lighter)`; a title set to 600 from a label with none gives `the title "<its words>": weight 700 to 600 (lighter)`.
  - `loop.test.ts` (`saidOf`'s table of kinds, `:1572`): a row `["captions lighter", clean, [{ op: "captions.set", weight: 600 }], "The captions are lighter."]`.
  - `profile.test.ts`, "holds a weight in a style's captions and title, or none": a style with `captions.weight` 600 and `title.weight` 600 parses; 650 is refused; `DEFAULT_STYLE` has no weight.
  Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__ src/edit/film/__tests__ src/lib/edit/agent/__tests__/catalogue.test.ts src/lib/edit/agent/__tests__/context.test.ts src/lib/edit/agent/__tests__/loop.test.ts src/lib/edit/style/__tests__/profile.test.ts`. Expected: the new tests FAIL (no `weight` in the schemas, no `captionWeights`), the digest passes.
- [ ] **Step 4: Implement.**
  - `doc.ts`, at the end of `CaptionsSchema`:
    ```ts
    /** How heavy the letters are; left out, the look's own: 800, a stressed word 900 (X122). Every edit made before 2026-11-24 has none. */
    weight: Weight.optional(),
    ```
    and the header's sentence becomes: "No field has a default but one: a `weight` left out (the captions', a title's) is the look's own, so that no edit stored before the weights came changes."
  - `parts.ts`, at the end of the title's props: `weight: Weight.optional(), // left out: 700 for a label, else 800`.
  - `layout.ts`:
    ```ts
    export function captionWeights(captions: Pick<Captions, "weight">): { plain: number; stressed: number } {
      if (captions.weight === undefined) return CAPTION_WEIGHTS;
      return { plain: captions.weight, stressed: Math.min(900, captions.weight + STRESS_STEP) };
    }
    export const titleWeight = (props: Pick<TitleProps, "look" | "weight">): number => props.weight ?? (props.look === "label" ? 700 : 800);
    ```
    `setPage` measures each word at `captionWeights(captions)`' plain or stressed weight; `titleBox` takes `const weight = titleWeight(props)`. The header's "Weights" lines say so.
  - `Captions.tsx`: `const weights = captionWeights(settings);` in place of `CAPTION_WEIGHTS` at `:45` and `:62`. `Title.tsx` already draws `laid.weight`.
  - `profile.ts`: `CaptionsSchema.pick({ …, weight: true })`; the title's object gains `weight: Title.weight`.
  - `catalogue.ts`: `Captions.fields.weight`: `"letters' weight; left out 800; a stressed word one step heavier, up to 900"`; `title.fields.weight`: `"letters' weight; left out 700 for a label, else 800"`.
  - `context.ts`, `effectOf`: `way` says `heavier`/`lighter` for `weight`; the captions are compared with `weight: captionWeights(captions).plain` and the key `"weight"`; a title's props with `weight: titleWeight(props)` (null for a call-out) and the key `"weight"`. `saidOf`: `how` gains `heavier`/`lighter` when `captionWeights(…).plain` differs.
- [ ] **Step 5: Run the tests; they pass**, the digest unchanged. The same command as Step 3. Expected: PASS.
- [ ] **Step 6: The catalogue's length.** Print `catalogue().length` before (on `HEAD`, 20,655 at `2887e8a4`; `catalogue.ts` has not changed since) and after: `pnpm exec tsx -e 'import("./src/lib/edit/agent/catalogue").then(({catalogue})=>console.log(catalogue().length))'`. Expected: under 21,000 (about 20,870 with these meanings). If it is over, shorten the two meanings; the guard is not raised in this slice without the controller's word.
- [ ] **Step 7: Every suite and the checks** (side by side: see "Order and lanes"). `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit src/edit src/app/api/edit src/app/dev-edit`: all pass. Both type checks; `pnpm exec eslint` on the files touched.
- [ ] **Step 8: The old stills again.** `pnpm exec tsx .scratch/native-default/same-stills.ts compare .scratch/kit1/proof-jobs-fix2.txt .scratch/native-default/stills`. Expected: `143 frames compared, 0 differ`.
- [ ] **Step 9: Commit.**
  ```bash
  git add src/lib/edit/atoms.ts src/lib/edit/doc.ts src/lib/edit/parts.ts src/edit/film/layout.ts src/edit/film/Captions.tsx src/lib/edit/style/profile.ts src/lib/edit/agent/catalogue.ts src/lib/edit/agent/context.ts src/edit/film/__tests__/as-before.test.tsx src/edit/film/__tests__/weights.test.tsx src/edit/film/__tests__/layout.test.ts src/lib/edit/__tests__/doc.test.ts src/lib/edit/__tests__/parts.test.ts src/lib/edit/__tests__/ops.test.ts src/lib/edit/__tests__/review.test.ts src/lib/edit/agent/__tests__/catalogue.test.ts src/lib/edit/agent/__tests__/context.test.ts src/lib/edit/agent/__tests__/loop.test.ts src/lib/edit/style/__tests__/profile.test.ts
  git -c core.hooksPath=/dev/null commit -m "feat(edit): captions and titles may carry a weight, 400 to 900; left out, each look's own"
  ```

**Nothing old changes:** the digest of Step 2 (every box for settings with no weight) and the drawn weights and edges of Step 2; Step 8's 143 stills. **Bundle:** changed (the schemas, `layout.ts`, `Captions.tsx`). From this commit the deployed worker refuses an edit with a weight; nothing makes one before Task 8, which waits for Task 4's deploy.

**Results:** (2026-11-24) Commit `76c87280`.
- Step 1: 143 stills of the 40 demo edits rendered at `987b4e8f`; a second render on the same code: "143 frames compared, 0 differ", so the renderer alone differs by nothing and the limit is 0 pixels.
- Step 2: the digest of 234 boxes (48 caption runs of three pages, 72 titles, 18 call-outs), frozen at `987b4e8f`: `AS_BEFORE = 30bef614…c76ee3e`. With it, the drawn weights (800, a stressed word 900, a title 700 as a label, else 800), the gap round(0.34 × size) and the 0.09 edge. 3 of 3 pass before the change and after it.
- Tests before (Step 3, 30 files): 13 failed, 606 passed; the 13 are the new tests and the exports guard of `layout.test.ts`, which now lists `captionWeights` beside `captionPages` (it gives weights, not a box). The digest passed. After (Step 5): 619 of 619. Step 7: `src/lib/edit src/edit src/app/api/edit src/app/dev-edit` 60 files, 1,352 tests passed, with lane B's uncommitted recipe files in the tree; both type checks and eslint on the 19 files clean.
- Step 6: the catalogue 20,655 characters before, 20,870 after (guard 21,000).
- Step 8: "143 frames compared, 0 differ".

---

### Task 3 (lane A): Plain captions with a weight read as a sentence (the edge judged by eye)

**Files:**
- Modify: `scripts/edit-font-widths.ts` (also writes `src/edit/film/spaces.json`); `src/edit/film/layout.ts` (`setPage`'s gap at `:152`, the header's rules); `src/edit/film/Captions.tsx:46`; `src/lib/edit/agent/catalogue.ts` (`Captions.fields.weight`)
- Create: `src/edit/film/spaces.json` (generated); throwaway `.scratch/native-default/make-demos.ts`, `.scratch/native-default/sheets.py`; `.scratch/media/demo-native-600.json`
- Test: `src/lib/edit/__tests__/measure.test.ts`, `src/edit/film/__tests__/layout.test.ts`, `weights.test.tsx`, `as-before.test.tsx` (must not move), `src/lib/edit/agent/__tests__/catalogue.test.ts`

**Interfaces:**
- Consumes: `captionWeights` (Task 2), the tables at 400 to 900 (Task 1).
- Produces:
  ```ts
  // src/edit/film/layout.ts
  /** True for captions set as a sentence: plain, with a weight set (X124). */
  export const sentenceSet = (captions: Pick<Captions, "look" | "weight">): boolean => captions.look === "plain" && captions.weight !== undefined;
  /** A typeface's own space at a weight, in ems (`spaces.json`, beside the width tables). Throws for a weight it does not hold. */
  export function spaceEm(font: Captions["font"], weight: number): number;
  /** The plain sentence's dark edge, as a share of the size: provisional until the controller's ruling (Step 8). */
  export const PLAIN_EDGE = 0.06;
  /** The dark edge round caption letters, in px: 0 for the pill (its box), PLAIN_EDGE of the size for a sentence, else 0.09 of it. */
  export function edgeOf(captions: Pick<Captions, "look" | "weight">, size: number): number;
  ```

- [ ] **Step 1: Write the failing tests.**
  - `measure.test.ts`, "writes each typeface's own space beside the width tables": for each font × `MEASURED_WEIGHTS[font]`, `spaces[font][weight]` equals `widths[font][weight].advances[" "] / widths[font][weight].unitsPerEm` exactly.
  - `layout.test.ts`, "sets plain captions with a weight as a sentence: the typeface's own space between words": with the tables (`tiktok`, 600, 64 px, five made-up words), the page's `gap` is `Math.round(spaceEm("tiktok", 600) * 64)` (about 14 px, where 0.34 em is 22) and its row is the words' whole widths plus four such gaps; with a word too long for the row, the gap is the one at the page's own smaller size.
  - `layout.test.ts`, "keeps the 0.34 em gap for plain with no weight, and for pill, pop and highlight with or without one": `gap` is `round(0.34 × size)` for those.
  - `layout.test.ts`, "gives a sentence a thinner edge than the bold looks": `edgeOf({ look: "plain", weight: 600 }, 64)` is `PLAIN_EDGE * 64` and under `0.09 * 64`; pop, highlight and plain with no weight give `0.09 × size`; the pill 0; `PLAIN_EDGE` is one of 0.05, 0.06 and 0.07.
  - `weights.test.tsx`, "draws a sentence page with the gap and the edge layout.ts gives": a drawn row's `columnGap` is the page's `gap` px, and the element's `WebkitTextStroke` is `${edgeOf(settings, size)}px rgba(0, 0, 0, 0.9)`.
  - `catalogue.test.ts`: `lineOf("  weight: ")` ends with `"; plain with one sits closer, thinner-edged"`.
  Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/measure.test.ts src/edit/film/__tests__ src/lib/edit/agent/__tests__/catalogue.test.ts`. Expected: the new tests FAIL (no `spaces.json`, no `spaceEm`, `edgeOf`, `PLAIN_EDGE`).
- [ ] **Step 2: Implement.**
  - The script writes, after `widths.json`, `src/edit/film/spaces.json`: `{ "<font>": { "<weight>": <advance of U+0020 ÷ unitsPerEm> } }`, from the same instances (`tableOf`). Run `pnpm exec tsx scripts/edit-font-widths.ts`; `widths.json` comes out byte for byte as in Task 1 (`git diff --exit-code src/edit/film/widths.json`).
  - `layout.ts` imports `./spaces.json`; in `setPage`:
    ```ts
    const gap = sentenceSet(captions) ? Math.round(spaceEm(captions.font, weights.plain) * size) : Math.round(0.34 * size);
    ```
    and `edgeOf`:
    ```ts
    export function edgeOf(captions: Pick<Captions, "look" | "weight">, size: number): number {
      if (captions.look === "pill") return 0;
      return (sentenceSet(captions) ? PLAIN_EDGE : 0.09) * size;
    }
    ```
    The header's "Between words" rule says both.
  - `Captions.tsx:46`: `WebkitTextStroke: \`${edgeOf(settings, size)}px ${DARK}\`` for every look but the pill; the shadow stays as it is.
  - `catalogue.ts`: the meaning of Step 1.
- [ ] **Step 3: Run the tests; they pass**, and `as-before.test.tsx`'s digest has not moved (plain with no weight is set as before). The same command as Step 1.
- [ ] **Step 4: The demo for the eye and the proof.** Write `.scratch/native-default/make-demos.ts`:
  ```ts
  import { readFileSync, writeFileSync } from "node:fs";
  import { applyOps, parseEdit } from "../../src/lib/edit";
  const demo = JSON.parse(readFileSync(".scratch/media/demo.json", "utf8")) as { edit: unknown; files: Record<string, string> };
  const edit = parseEdit(demo.edit);
  const made = applyOps(edit, [
    { op: "captions.set", look: "plain", font: "tiktok", size: 64, y: 0.72, maxWords: 5, highlight: null, weight: 600 },
    { op: "item.set", id: "hook", frames: null, props: { look: "label", size: 84, y: 0.2, color: "#111111", accent: null, weight: 600 } },
  ], edit.assets);
  if (!made.ok) throw new Error(JSON.stringify(made.problems));
  writeFileSync(".scratch/media/demo-native-600.json", JSON.stringify({ edit: made.edit, files: demo.files }, null, 2));
  console.log("wrote .scratch/media/demo-native-600.json");
  ```
  Run: `pnpm exec tsx .scratch/native-default/make-demos.ts`. (64 and 84 px are the demo's, the largest candidates; the house's sizes are ruled in Task 8.)
- [ ] **Step 5: The three edges.** For each share in 0.05, 0.06 and 0.07: set `PLAIN_EDGE` to it (an uncommitted edit of that one line), then `pnpm exec tsx scripts/edit-still.ts .scratch/media/demo-native-600.json .scratch/native-default/edge-<share> 20 100 192`. Put `PLAIN_EDGE` back to 0.06 and check `git diff src/edit/film/layout.ts` shows only this task's change.
- [ ] **Step 6: The sheet.** Write `.scratch/native-default/sheets.py` (ffmpeg, as `.scratch/native-look/sheets.py` does; labels carry no apostrophe, which `drawtext` quotes with):
  ```python
  """sheets.py (throwaway): the native default's sheets, with ffmpeg. Run from the repo root:
    python3 -I .scratch/native-default/sheets.py edge                -> edge-sheet.jpg and edge-crops.jpg
    python3 -I .scratch/native-default/sheets.py sizes <take>        -> sizes-<take>.jpg (Task 8)
    python3 -I .scratch/native-default/sheets.py reference           -> default-vs-reference.jpg (Task 9)"""
  import glob, json, subprocess, sys
  FF, FONT, OUT, BAND = "/opt/homebrew/bin/ffmpeg", "/System/Library/Fonts/Supplemental/Arial.ttf", ".scratch/native-default", 64
  FIT = "scale=540:960:force_original_aspect_ratio=decrease,pad=540:960:(ow-iw)/2:(oh-ih)/2,setsar=1"
  def run(args): subprocess.run([FF, "-y", "-v", "error", *args], check=True)
  def label(text): return f"pad=iw:ih+{BAND}:0:{BAND}:color=0x161616,drawtext=fontfile={FONT}:text='{text}':x=20:y=({BAND}-th)/2:fontsize=34:fontcolor=white"
  def cell(src, out, frame=None, crop=None):
      chain = ([f"select='eq(n\\,{frame})'"] if frame is not None else []) + ([f"crop=1080:{crop[1]}:0:{crop[0]},scale=540:-2"] if crop else [FIT])
      run(["-i", src, "-vf", ",".join(chain), "-frames:v", "1", *(["-fps_mode", "vfr"] if frame is not None else []), out])
  def blank(out): run(["-f", "lavfi", "-i", "color=c=0x161616:s=540x960", "-frames:v", "1", out])
  def column(title, cells, out): run([*sum((["-i", c] for c in cells), []), "-filter_complex", f"vstack=inputs={len(cells)}," + label(title), out])
  def sheet(columns, out): run([*sum((["-i", c] for c in columns), []), "-filter_complex", f"hstack=inputs={len(columns)}", "-q:v", "3", out])
  def references(rows):
      """Reference 3 and 4 as two columns of `rows` cells: their frames in name order, then blank cells."""
      cols = []
      for n in ("3", "4"):
          frames = sorted(glob.glob(f".scratch/task14/styled/ref-{n}/frame-*.jpg"))
          cells = []
          for k in range(rows):
              cells.append(f"{OUT}/ref{n}-{k}.png")
              cell(frames[k], cells[-1]) if k < len(frames) else blank(cells[-1])
          cols.append(f"{OUT}/ref{n}-col.png"); column(f"Reference {n}", cells, cols[-1])
      return cols
  if sys.argv[1] == "edge":
      for name, crop in (("edge-sheet.jpg", None), ("edge-crops.jpg", (1240, 300))):
          cols = []
          for share in ("0.05", "0.06", "0.07"):
              cells = []
              for frame in (20, 100, 192):
                  cells.append(f"{OUT}/cell-{share}-{frame}.png"); cell(f"{OUT}/edge-{share}/frame-{frame:04d}.png", cells[-1], crop=crop)
              cols.append(f"{OUT}/col-{share}.png"); column(f"edge {share} of the size", cells, cols[-1])
          sheet(cols, f"{OUT}/{name}")
  ```
  (`sizes` mode is written in Task 8, `reference` mode in Task 9.) The crop's top (1,240 px) is the captions' line at 0.72 less half the 300 px strip; if the demo's pages sit elsewhere, use the page's box from `captionPages` and say so in the Results. Run `python3 -I .scratch/native-default/sheets.py edge`.
  Output: `.scratch/native-default/edge-sheet.jpg` (three columns, the moments 0.7 s, 3.3 s and 6.4 s) and `.scratch/native-default/edge-crops.jpg` (the caption row at full size).
- [ ] **Step 7: Every suite, the checks, the old stills; commit with the provisional 0.06.** `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit src/edit src/app/api/edit src/app/dev-edit`; both type checks; eslint on the files touched; `same-stills.ts compare …`: `143 frames compared, 0 differ`.
  ```bash
  git add scripts/edit-font-widths.ts src/edit/film/spaces.json src/edit/film/layout.ts src/edit/film/Captions.tsx src/lib/edit/agent/catalogue.ts src/lib/edit/__tests__/measure.test.ts src/edit/film/__tests__/layout.test.ts src/edit/film/__tests__/weights.test.tsx src/lib/edit/agent/__tests__/catalogue.test.ts
  git -c core.hooksPath=/dev/null commit -m "feat(edit): plain captions with a weight read as a sentence: the typeface's own space, a thinner edge"
  ```
- [ ] **Step 8: STOP for the controller's ruling on the edge.** Send the controller the two sheets' paths and the three edges at 64 px (3.2, 3.84 and 4.48 px). While waiting, lane A waits (Task 4 deploys the edge) and lane B goes on. When the ruling comes: set `PLAIN_EDGE` to the ruled share, run `src/edit/film/__tests__` and `same-stills.ts compare`, and commit `src/edit/film/layout.ts` alone, its message naming the ruled share: `fix(edit): the plain sentence's edge at <the ruled share> of the size, as ruled`. Then Task 3's review.

**Nothing old changes:** the digest (plain with no weight keeps its gap), the old stills, and `as-before.test.tsx`'s drawn edges (0.09) for every look with no weight. **Bundle:** changed (`layout.ts`, `Captions.tsx`, `spaces.json`).

**Results:** (2026-11-24) Commits `1de13106` (the sentence: the space, the edge at a provisional 0.06), `ab5d3b42` (the edge at 0.05, as ruled), `7384d360` (the stress, as ruled).
- Tests first: 5 failed as expected (no `spaces.json`, `spaceEm`, `edgeOf`, `PLAIN_EDGE`; the catalogue line), then 127 of 15 files passed; the stress tests failed 3 (600 against 700 twice, the catalogue line), then passed. Every suite after the rulings: 1,373 tests, all pass but two that timed out on a loaded machine and passed alone (`ops.test.ts`, `context.test.ts`) and one in `prompt.test.ts` beside lane B's uncommitted `prompt.ts`. Both type checks and eslint clean. `as-before.test.tsx`'s digest did not move. The old stills: "143 frames compared, 0 differ" after each change.
- `widths.json` regenerated byte for byte; `spaces.json` holds U+0020 over the em at 400 to 900. At 600: tiktok 0.2154, inter 0.2261, montserrat 0.2756 em. The gap at 64 px, tiktok 600: 14 px (0.34 em: 22); at 58 px: 12 (20). Inter 600 at 64: 14; Montserrat 600 at 64: 18.
- The edge: ruled **0.05** of the size by eye at true size (3.2 px at 64; the bold looks' 0.09 is 5.76). 0.07 began to thicken the letters toward the bold look.
- The stress (the controller's addendum, judged on the same sheet): ruled **the same weight**. A plain page with a weight and no highlight colour sets every word at the captions' weight; a highlight colour set keeps the step (one step heavier, at most 900); no weight keeps 800 and 900; pill, pop and highlight keep the step. `captionWeights` holds it (`STRESS_STEP` unchanged; the cap is named `HEAVIEST`). The catalogue's captions weight line says "plain with one sits closer, thinner-edged, stress shown only by highlight": 20,945 of the 21,000 guard.
- Sheets (git-ignored, `.scratch/native-default/`): `edge-sheet.jpg` (three edges on `demo-native-600`, and the stress at 700 and 600 over the owner's take, a mid grey and a true-size crop), `edge-crops.jpg` (the brief's crops, at half size), `edge-full-size.jpg` (the row at true size, the three edges stacked; the sheet that decided the edge).
- The pale letters behind the label on the sheet's frame 192 are the old demo's own call-out mark, which the throwaway edit kept while its hook stayed to the end at the same height: review reports both as `on-text` at 6.2 s. Not something a first cut makes.

---

### Task 4 (lane A): The kit's proof, then the deploy on the controller's word

Starts after Task 3's ruled edge is committed and Task 3's review has passed. Nothing else renders or runs a browser on the machine meanwhile.

**Files:**
- Modify: `scripts/edit-preview-vs-render.ts` (the header, `boxOps` at `:154-180`, the counters in `boxesIn` at `:268`, `:334-347`)
- Create: throwaway `.scratch/native-default/deploy-check.ts`

**Interfaces:**
- Consumes: the kit as Tasks 2 and 3 left it; `stillsOf(user, edit, frames)` (`src/lib/edit/worker/stills.ts:91`).
- Produces: the render bundle of this commit deployed; its commit and the bundle's digest, recorded for Task 10.

- [ ] **Step 1: The box check sets weights.** In `boxOps`, for strings 10 to 19 only: the captions get `weight: pick([600, 400, 500, 900, 700], i)` and the title's props `weight: pick([500, 600, 900, 400, 700], i)` (a weight set stays on the demo for the strings after it; strings 0 to 9 stay as they are). In `boxesIn`, two counters: a caption page checked whose captions are plain with a weight (`drew.sentencePage`; strings 11, 15 and 19 are plain), and a title checked with a weight (`drew.weightedTitle`); either at 0 fails the run. The header says so.
- [ ] **Step 2: The proof.**
  ```bash
  pnpm exec tsx scripts/edit-preview-vs-render.ts .scratch/native-default/pvr $(cat .scratch/kit1/proof-jobs-fix2.txt) demo-native-600:3,20,56,100,192,262 2>&1 | tee .scratch/native-default/pvr.log
  ```
  Expected: `preview and render agree (298 frames compared in the browsers held)` and `the kit draws the boxes layout.ts gives`.
- [ ] **Step 3: The old frame lines have not moved.**
  ```bash
  grep -E '^(chromium|webkit) .* frame [0-9]+:' .scratch/native-default/pvr.log | grep -v ' demo-native-600 ' | sort > .scratch/native-default/old-lines.txt
  diff .scratch/kit1/wave-lines.txt .scratch/native-default/old-lines.txt && echo "the 286 old lines are as they were"
  ```
  Expected: `the 286 old lines are as they were`.
- [ ] **Step 4: The old stills.** `pnpm exec tsx .scratch/native-default/same-stills.ts compare .scratch/kit1/proof-jobs-fix2.txt .scratch/native-default/stills`. Expected: `143 frames compared, 0 differ`.
- [ ] **Step 5: Commit the proof script.**
  ```bash
  git add scripts/edit-preview-vs-render.ts
  git -c core.hooksPath=/dev/null commit -m "test(edit): the preview-against-render box check sets weights, and fails unless a sentence page and a weighted title were drawn"
  ```
- [ ] **Step 6: The check edit, and the deployed worker before.** Write `.scratch/native-default/deploy-check.ts`: it loads `.env.local` and stands `server-only` in as `scripts/edit-stills-proof.ts:37-45` does; reads the owner's ids from `.scratch/stills-proof/ids.json`; takes the edit of part 3's last house first cut (`.scratch/task14/first-cut/house-d-1.json`, whose ids the proof script wrote as `<user>` and `<take>`) with the real ids put back in memory only; applies `captions.set {look: "plain", size: 64, maxWords: 5, highlight: null, weight: 600}` and, on its title, `item.set {frames: null, props: {look: "label", size: 84, color: "#111111", accent: null, weight: 600}}`; calls `stillsOf(user, edit, [20, 140, 290])` and writes the JPEGs to the folder it is given; and writes, for the local render, `.scratch/native-default/deploy-check-demo.json` with the take's id as `take` and `files: { take: "task6-full.mp4" }`. It prints no id. Run it into `.scratch/native-default/deployed-before`: expected, the worker refuses the edit (its schema has no `weight`). Record the line, masked.
- [ ] **Step 7: STOP for the controller's word to deploy.** Send the controller Steps 2 to 4's lines and Step 6's refusal. Nothing is deployed without the word.
- [ ] **Step 8: The tree is clean and the bundle is HEAD's.**
  ```bash
  git status --porcelain -- src/edit src/lib/edit worker public/edit   # prints nothing (lane B's own uncommitted files under src/lib/edit: wait for its commit)
  git rev-parse HEAD                                                    # recorded as the deployed commit
  pnpm exec tsx scripts/edit-bundle.ts                                  # worker/.bundle from HEAD
  shasum -a 256 worker/.bundle/*.js | shasum -a 256                     # recorded as the bundle's digest
  ```
- [ ] **Step 9: The image's tests.** `modal run worker/dev.py::media_suite`. Expected: no failure (part 3: 430 passed, 29 skipped).
- [ ] **Step 10: Deploy.** Read the Modal spend. `modal deploy worker/app.py` from the worktree root.
- [ ] **Step 11: After the deploy.** Run `deploy-check.ts` into `.scratch/native-default/deployed-after`: three JPEGs. Render the same frames on this Mac: `pnpm exec tsx scripts/edit-still.ts .scratch/native-default/deploy-check-demo.json .scratch/native-default/deployed-local 20 140 290`; hold each pair to the preview-against-render proof's measure (pixelmatch, threshold 0.1): at most 0.4 % of pixels far apart, the colour shift reported, not held (a JPEG). Put the pairs side by side in `.scratch/native-default/deployed-vs-local.jpg` and look at them: plain captions at 600 with the ruled edge, the light label in dark letters. Read the spend again.
- [ ] **Step 12: Record.** Write this task's Results into the plan and commit it alone:
  ```bash
  git add docs/superpowers/plans/2026-11-24-native-default.md
  git -c core.hooksPath=/dev/null commit -m "docs(edit): the kit's proof for the native default, and the worker deployed: the commit, the checks and the spend"
  ```

**Nothing old changes:** Steps 3 and 4; an old edit draws the same on the new bundle (the same checks, on the same code). **Bundle:** deployed from this task's HEAD.

**Results:** (2026-11-24) Commits `f31482b4` (Task 3's review: the edge's comment, the catalogue's weight line true in every case, a test's closing line), `deaa3399` (the box check sets weights).
- The proof (Step 2): "preview and render agree (298 frames compared in the browsers held)" and "the kit draws the boxes layout.ts gives". At worst Chromium 0.292 % of pixels far apart (`demo-title-label` frame 3), colours 0.76 levels; WebKit 0.340 % (`demo-title-outline` frame 259), colours 1.65; both old demos. `demo-native-600`: Chromium 0.000 % on all six frames, WebKit at most 0.122 %. The boxes: title, call-out and captions each 19 checked, at worst 0.000 px apart, one skipped each (the emoji string, as before). Drawn with a weight: 3 caption pages set as a sentence (strings 11, 15, 19), 9 titles.
- Step 3: "the 286 old lines are as they were". Step 4: "143 frames compared, 0 differ".
- Step 6, before the deploy: the deployed worker refused the weighted edit with its own 500 line ("the stills failed on our side; try again", the line for any failure the renderer does not word itself); a control, the same edit with no weight, gave its three stills, so the weight was what it refused.
- Deployed commit `eeeda02e` (HEAD at the deploy; lane B's last commits touch only `src/lib/edit/agent/` and this plan). None of the 28 files the bundle takes (as esbuild lists them from `src/edit/film/root.tsx`), nor `public/edit`, `worker/render`, `worker/media`, `worker/store.py`, `worker/app.py`, `worker/dev.py`, the requirements files or `scripts/edit-bundle.ts` was uncommitted or changed since `f31482b4`, the code the proof ran on. The bundle's digest (`shasum -a 256 worker/.bundle/*.js | shasum -a 256`): `bacfd3eca8c094ffb15068d7fe1e508c4c62c5a96bc0122edad6c8f671fe7c76`, the same built at `048d5930` and at `eeeda02e`.
- The image's tests (`modal run worker/dev.py::media_suite`): 430 passed, 29 skipped, as in part 3. `modal deploy worker/app.py`: deployed.
- Step 11, after the deploy: the weighted edit gave its three stills. Against this Mac's render of the same frames (scaled to the worker's half stage with lanczos, as the worker scales): frame 20 0.028 %, frame 140 0.033 %, frame 290 0.022 % of pixels far apart (0.4 % allowed), colours 1.40, 1.63 and 1.52 levels apart (reported, one side a JPEG). The same edit with no weight: the same bytes before and after the deploy, frame for frame. That is stills only: no whole old film was rendered on the deployed worker. By eye (`deployed-vs-local.jpg`): plain captions at 600 with the 0.05 edge, the light label in dark letters at 600, the two sides alike.
- Modal, metered as `modal billing summary` read it: $4.12 before this task; $4.13 after Step 6's calls; $4.19 after the image's tests; $4.18 after the deploy and Step 11 (the summary lags or rounds). Billed $0.00. Under the plan's $5.00.

---

### Task 5 (lane B): Short rows before small letters

**Files:**
- Modify: `src/lib/edit/recipes/captions.ts:1-20` (the header), `:34-42`, `:58-86` (`placeCaptions`); `src/lib/edit/recipes/index.ts:8` (exports)
- Create: throwaway `.scratch/native-default/presets-place.ts`, `.scratch/native-default/time-place.ts`
- Test: `src/lib/edit/recipes/__tests__/recipes.test.ts` (a new block, and the cases at `:595-604`, `:621-630`, `:632-644`, `:646-655`, `:684-698`); `recipes.real.test.ts` (the owner's take; skips without `.scratch/`)

**Interfaces:**
- Consumes: `review`, `judged`, `sizesFrom`, `LEAST` (as today). Nothing of lane A: the fixtures carry no weight.
- Produces:
  ```ts
  // src/lib/edit/recipes/captions.ts
  /** Plain and pill sizes are tried on this grid, in px (X126). */
  export const SIZE_STEP = 4;
  /** Plain and pill pages lose words down to this many before their letters are made smaller (ruled). */
  export const FEWEST_WORDS = 4;
  /** The sizes captions are tried at, largest first: plain and pill the asked size then each multiple of SIZE_STEP below it down to 44; pop and highlight `sizesFrom` (today's). */
  export function captionSizes(size: number, look: Captions["look"]): number[];
  /** The words a page tried at each size: plain and pill from the asked count down to FEWEST_WORDS (the asked alone when it is no more); pop and highlight the asked. */
  export function wordCounts(maxWords: number, look: Captions["look"]): number[];
  ```

- [ ] **Step 1: Record the four presets' placements on the code before this task.** Write `.scratch/native-default/presets-place.ts`: read the owner's take as `recipes.real.test.ts:17-30` does (`.scratch/worker-proof/batch/analysis-scribe.json`, `rowOf`, `assetOf`, `analysisOf`); for each of `sentences`, `clean`, `mono` and `key-words`, from `firstEdit(asset)` tightened at the preset's pause, with `captions.set` to its captions: print `placeCaptions`' ops and the final `y`, `size`, `maxWords`. Run `pnpm exec tsx .scratch/native-default/presets-place.ts > .scratch/native-default/place-before.txt`.
- [ ] **Step 2: Write the failing tests** (a new block in `recipes.test.ts`, "placeCaptions: short rows before small letters (plain and pill)", using the file's own `take`, `editOf`, `samples`, `LIPPED`, `through` and `review`; no weight anywhere):
  - "tries plain and pill on one grid down to 44 px, and pop and highlight as today": `captionSizes(64, "plain")` is `[64, 60, 56, 52, 48, 44]`; `captionSizes(66, "pill")` is `[66, 64, 60, 56, 52, 48, 44]`; `captionSizes(44, "plain")` is `[44]`; `captionSizes(72, "pop")` and `(72, "highlight")` are `[72, 61, 52]`. `wordCounts(8, "plain")` is `[8, 7, 6, 5, 4]`; `wordCounts(3, "pill")` is `[3]`; `wordCounts(8, "pop")` is `[8]`.
  - "takes words off a page before it makes the letters smaller": a made-up take of eight short words in one breath (300 ms apart, no pause, no sentence's end), the `LIPPED` face (room under the lip for one row, 84 px), plain captions at 64 px, 8 words a page, y 0.8. In the test, first: at 64 px with 8 words every place of `CAPTION_YS` from 0.5 down has an error (a page runs to two rows, 2 × 74 + 8 = 156 px); and `k`, the most words at which every page is one row at 64 px (found with `captionPages` and the tables), is 4 or more, with 0.76 clear at `k`. Then `placeCaptions` gives `[{ op: "captions.set", y: 0.76, maxWords: k }]`: no `size`.
  - "goes down to four words and no further before smaller letters": the same face, words of ten made-up letters, so that four words take two rows at 64 px. In the test, first: no low place is clear at 64 px with 8 to 4 words. Then the op has `maxWords` of 4 or more and a `size` from `captionSizes(64, "plain")` below 64, and at every size above it no count from 8 to 4 is clear.
  - "never ends smaller for a larger size asked": plain, 5 words, the `LIPPED` face; for the asked sizes `[56, 60, 64, 66, 72, 80, 96]` the size each ends at (the op's, or the asked) never falls as the asked size rises. (Today's steps give 52 for 72 and 54 for 64 on such a face; a comment says so.)
  - "places pop as it did": the `LIPPED` case of `:595-604` with `look: "pop"`. Write its expected op from a run on the code before this task (as Step 1 did), and it must hold after.
  Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/recipes/__tests__/recipes.test.ts`. Expected: FAIL (`captionSizes` is not exported; the plain case shrinks the letters).
- [ ] **Step 3: Implement.** In `placeCaptions`, after the first step (pages of three rows at most) and the "clear as they are" return, unchanged:
  ```ts
  const at = (y: number, size = edit.captions.size, maxWords = edit.captions.maxWords): Edit => ({ ...edit, captions: { ...edit.captions, y, size, maxWords } });
  const bands = edit.captions.y >= LOW ? [LOW_YS, HIGH_YS] : [HIGH_YS, LOW_YS];
  for (const band of bands) {
    for (const size of captionSizes(edit.captions.size, edit.captions.look)) {
      for (const words of wordCounts(edit.captions.maxWords, edit.captions.look)) {
        const free = band.find((y) => clear(at(y, size, words)));
        if (free !== undefined) return set({ y: free, ...(size !== edit.captions.size && { size }), ...(words !== given.captions.maxWords && { maxWords: words }) });
      }
    }
  }
  ```
  with
  ```ts
  export function captionSizes(size: number, look: Captions["look"]): number[] {
    if (look === "pop" || look === "highlight") return sizesFrom(size, LEAST);
    const below: number[] = [];
    for (let step = Math.ceil(size / SIZE_STEP) * SIZE_STEP - SIZE_STEP; step >= LEAST; step -= SIZE_STEP) below.push(step);
    return [size, ...below];
  }
  export function wordCounts(maxWords: number, look: Captions["look"]): number[] {
    if (look === "pop" || look === "highlight" || maxWords <= FEWEST_WORDS) return [maxWords];
    return Array.from({ length: maxWords - FEWEST_WORDS + 1 }, (_, i) => maxWords - i);
  }
  ```
  The last resort (the fewest error frames, at their own size and words) stays as it is. For pop and highlight the loop is today's (one count of words, `sizesFrom`). The header says the new order; `index.ts` exports `captionSizes` and `wordCounts`.
- [ ] **Step 4: Run the tests; the new ones pass. Then the old cases.** Run the whole `recipes.test.ts`. The cases at `:595-604` and `:621-630` (the pill at 72 px) are expected to hold: 52 px is on the grid and the first clear (the pill's box is 90 px at 56 px and 84 px at 52 px, under a room of 84 px). `:632-644` loops `[72, 61, 52]` to show no size is clear: make the loop `captionSizes(72, "pill")`, so it covers every size the rule now tries; if one of them is clear, the expectation becomes that op and the test's name says so. `:646-655` and K1's `:684-698` are run as they are. Any expectation that moves is explained in its test's name by the new order; none is loosened to pass.
- [ ] **Step 5: The four presets after.** `pnpm exec tsx .scratch/native-default/presets-place.ts > .scratch/native-default/place-after.txt`; `diff .scratch/native-default/place-before.txt .scratch/native-default/place-after.txt`. Record every line that moved, by preset, in the Results (R5).
- [ ] **Step 6: The time.** Write `.scratch/native-default/time-place.ts`: a made-up 90 s take (162 words, 34 pauses, a face throughout, as part 3's fix round 3 timed), plain at 64 px, 8 words, under a face that clears nothing low at 64 px; `placeCaptions` five times; print the middle time. Ceiling: 500 ms (part 3 measured 11 ms for today's).
- [ ] **Step 7: Every suite and the checks** (side by side: see "Order and lanes"). `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit src/edit src/app/api/edit src/app/dev-edit` (the first cut's and the route's tests use `placeCaptions` through real recipes and compare with what the same code gives); both type checks; eslint.
- [ ] **Step 8: Commit.**
  ```bash
  git add src/lib/edit/recipes/captions.ts src/lib/edit/recipes/index.ts src/lib/edit/recipes/__tests__/recipes.test.ts
  git -c core.hooksPath=/dev/null commit -m "feat(edit): plain and pill captions lose words before size, on one grid of sizes down to 44 px"
  ```

**Nothing old changes:** no drawing changes (the recipe is server code). Pop and highlight are placed by today's order (the pop case pinned from the old code; `wordCounts` and `captionSizes` give today's lists). The four presets' placements before and after are in the Results (R5). **Bundle:** unchanged.

**Results:** (2026-11-24) Commit `dcfbc43c`.
- Tests written first (made-up words, no weight). On the code before:
  - "tries plain and pill on one grid": `captionSizes is not a function`.
  - "takes words off a page" (eight short words, 64 px): `{y 0.76, size 46}`; after, `{y 0.76, maxWords 6}`.
  - "goes down to four words and no further" (ten-letter words): `{y 0.3}`, high; after, `{y 0.76, size 52, maxWords 4}`. Three words a page would be clear at 64 px.
  - "never ends smaller" (asked 56, 60, 64, 66, 72, 80, 96, five words): ended 56, 51, 54, 56, 52, 80 (high), 96 (high); after, 56, 60, 64, 66, 72, 72, 72.
  - After review (I1): off the grid, "never ends smaller" is false (asked 63 can end at 63 and asked 64 at 60). As ruled, the claim is now "a larger size asked never ends more than 3 px smaller than a smaller size asked" (the step less one), in the header and the test.
    - The test checks every pair of asked sizes from 48 to 80 px, on two takes: five six-letter words a page, whose largest clear size is 72 px, on the grid; and eight ten-letter words a page, whose largest clear size is 54 px, off it (asked 55 ends at 52, a drop of 2).
    - It fails with a step of 8: 78 pairs drop more than 3 px.
  - "places pop as it did": pinned from the code before, and holds.
  - After: `recipes.test.ts` 81/81; every suite 1357/1357 (60 files) before lane A's next test-first file; both type checks and eslint clean.
- Old cases:
  - `:595` and `:621` (the pill at 72 px under `LIPPED`) moved from 52 to 56 px. 56 px is on the grid and tried first. Its 90 px box at 0.76 reaches 3 px over the lip, under review's 4 % overlap, so it "touches the chin" (a warning) and is clear. The names say so; the preconditions now cover every grid size above 56 px and 61 px.
  - `:632` loops over `captionSizes(72, "pill")`: no size is clear, and it holds.
  - `:646` and K1's `:684` hold as they are.
- Step 5, the four presets on the owner's take (R5):
  - sentences: no op, before and after.
  - clean: no op, before and after.
  - mono: `{y 0.76}`, before and after.
  - **key-words: `{y 0.76, size 75}` → `{y 0.76, size 76}`** (75 was 0.85 of 88; 76 is the grid's first clear size).
- Step 6, the time, ruled (b) and a measured ceiling.
  - The made-up 90 s take (162 words, 34 pauses), plain, 8 words a page. As the brief wrote it, every count was tried: 876 ms at 64 px with nothing low clear; 2.0 s at 96 px; 2.9 s with nothing clear anywhere (the old code: 90 to 160 ms).
  - So a count whose pages come out the same as the count before's is not tried again (`countsTried`). This is exact: review reads `maxWords` only through `pagesOf`.
  - After: at 64 px, 323 ms with nothing low clear and 487 ms with nothing clear anywhere; at 96 px, 734 and 1,079 ms; at 200 px, 1,577 ms with nothing clear. The presets' and house candidates' own settings on the low face: 164 to 324 ms.
  - The test holds two ceilings, each the fastest of three runs in the process's CPU time, since the suite's other files run beside it. In the whole suite, wall time reached 951 to 996 ms at 64 px.
    - The house's range (64 px, eight words, nothing clear): under 1,000 ms; 627 ms in the whole suite.
    - The schema's largest size (200 px, nothing clear): under 3,500 ms; 1,904 ms in the whole suite.
    - Measured after review, with no test: 200 px with sixteen words a page and nothing clear took 2,066 ms (the middle of five, load average 9). K1 first takes a page down to three words, so one count is tried. This is under 3,500 ms.
- **Known cost for the next slice:** each try is one full `review`, about 3.2 ms on a 90 s take, 2.0 ms of it for everything but the captions. A captions-only judgment in `review.ts` (each size and count laid out once, every place tried by moving the boxes) would cut it several times over. It was left out of this slice because `review.ts` is in neither lane.

---

### Task 6 (lane B): The old default kept where it is used, and Bold pop last

**Files:**
- Modify: `src/lib/edit/style/presets.json` (Bold pop's entry, moved last), `src/lib/edit/style/presets.ts:1-10` (header), `:26` (`PRESET_IDS`), `:32-35` (`EntrySchema`), `:47-49` (`presetFrom`); `src/lib/edit/agent/first-cut.ts:294-308` (`titleOp`); `src/lib/edit/style/words.ts:101`
- Test: `src/lib/edit/style/__tests__/presets.test.ts:77-80`, `:124-133`; `src/lib/edit/style/__tests__/words.test.ts:291-296`; `src/lib/edit/agent/__tests__/first-cut.test.ts:670-690`; `src/app/dev-edit/agent/__tests__/parts.test.tsx:69`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  ```ts
  // src/lib/edit/agent/first-cut.ts
  /** The colour a preset's or a words style's title marks its key word in when its captions have none: the yellow the house's
   *  captions had until the native default (X127). The house and a reference's style get no colour their captions do not have. */
  export const MARKED = "#ffe14a";
  // PRESET_IDS = ["sentences", "clean", "one-word", "highlighter", "key-words", "mono", "bold-pop"]
  ```

- [ ] **Step 1: Write the failing tests.**
  - `presets.test.ts`, "are the seven, in the order the page shows them, Bold pop last": ids `["sentences", "clean", "one-word", "highlighter", "key-words", "mono", "bold-pop"]`, names in that order.
  - `presets.test.ts`, the test "build bold-pop from the house style, with a pace of its own" becomes "hold Bold pop's own numbers: the house's until the native default": `pace {pauseMs: 220, cutsPerMin: null}`; captions `{ on: true, look: "pop", font: "tiktok", size: 96, y: 0.72, maxWords: 3, highlight: "#ffe14a" }`; title `{ on: true, y: 0.2, frames: 75, look: "bold", size: 130 }`; punch-ins `{ perMin: 8, zoom: 1.15 }`; look natural. Literal values, not `HOUSE_STYLE`'s.
  - `words.test.ts:294-295`: a title added to `mono` equals Bold pop's title (`presetOf("bold-pop")!.profile.title`), and is not that object.
  - `first-cut.test.ts:682-685`, "takes Bold pop's yellow for a preset or words whose captions have none": `toBe(MARKED)`, and `MARKED` is `"#ffe14a"`.
  - `parts.test.tsx`, "offers Bold pop last among the presets": the last chip's text is "Bold pop".
  Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/style src/lib/edit/agent/__tests__/first-cut.test.ts src/app/dev-edit/agent/__tests__/parts.test.tsx`. Expected: FAIL on the order and on `MARKED`.
- [ ] **Step 2: Implement.** Bold pop's entry in `presets.json`, moved to the end:
  ```json
  {
    "id": "bold-pop",
    "name": "Bold pop",
    "description": "Big white words, the one being said in yellow. A hook up top, light zooms.",
    "pauseMs": 220,
    "captions": { "on": true, "look": "pop", "font": "tiktok", "size": 96, "y": 0.72, "maxWords": 3, "highlight": "#ffe14a" },
    "title": { "on": true, "y": 0.2, "frames": 75, "look": "bold", "size": 130 },
    "punchIns": { "perMin": 8, "zoom": 1.15 },
    "look": "natural"
  }
  ```
  `PRESET_IDS` in the new order; `EntrySchema` keeps only the entry with its own captions, title, punch-ins and look (no entry says `"from": "house"` any more), and `presetFrom` loses that branch; the header says Bold pop holds what the house was until 2026-11-24. In `titleOp`:
  ```ts
  const accent = profile.captions.highlight ?? (profile.source.kind === "preset" || profile.source.kind === "words" ? MARKED : null);
  ```
  (Today the house's own highlight is yellow and comes through `profile.captions.highlight`; a style of kind "default" gets none.) In `words.ts:101`: `style.title ??= presetOf("bold-pop")!.profile.title;` with the line above it saying the parse below gives fresh objects.
- [ ] **Step 3: Run the tests; they pass**, then every suite (side by side: see "Order and lanes"): `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit src/edit src/app/api/edit src/app/dev-edit`. Both type checks; eslint.
- [ ] **Step 4: Commit.**
  ```bash
  git add src/lib/edit/style/presets.json src/lib/edit/style/presets.ts src/lib/edit/style/words.ts src/lib/edit/agent/first-cut.ts src/lib/edit/style/__tests__/presets.test.ts src/lib/edit/style/__tests__/words.test.ts src/lib/edit/agent/__tests__/first-cut.test.ts src/app/dev-edit/agent/__tests__/parts.test.tsx
  git -c core.hooksPath=/dev/null commit -m "refactor(edit): Bold pop holds the old house's numbers itself and comes last; presets' titles keep their yellow mark"
  ```

**Nothing old changes:** every preset's profile is pinned by `presets.test.ts` (`:93-122` for the six, Step 1 for Bold pop, literal); the first cut's tests on the house still pass unchanged (the house has not changed yet). The style-from-words prompt lists the presets in the new order (`words.ts:227`); its tests do not depend on the order. **Bundle:** unchanged.

**Results:** (2026-11-24) Commit `1b32accd`.
- Tests written first. On the code before: "are the seven, … Bold pop last" failed on the order (`[ 'bold-pop', 'sentences', … ]`); "takes Bold pop's yellow …" failed (`MARKED` undefined); "offers Bold pop last among the presets" failed (`expected 'Black and white' to be 'Bold pop'`). "hold Bold pop's own numbers" (literal) and the words test (Bold pop's title, a fresh object) passed before too: the values are the house's, as they should be.
- After: the three files' suites 262 passed; every suite (`src/lib/edit src/edit src/app/api/edit src/app/dev-edit`) 60 files, 1,363 passed, run twice (the second after `a077d2b4`, with lane A's uncommitted files present). Both type checks clean; eslint clean on the eight files.
- Nothing old changes: every preset's profile, name and description, and a words style's added title, printed before and after (a throwaway script, `.scratch/native-default/task-6/`): identical; only the order differs. The marked word's colour is `#ffe14a` before and after for presets and words styles; a reference's stays none; the house still takes its captions' yellow (it has not changed yet). `presets.json` holds no `"from"` any more. **Bundle:** unchanged.

---

### Task 7 (lane B): The hook: a claim of up to eight words on two lines

**Starts only once Task 2 is committed** (it uses `titleBox` with a `weight` and a style title's `weight`).

**Files:**
- Modify: `src/lib/edit/agent/first-cut.ts:57-68` (`HOOK`, `hookOf`, `HOOK_EXAMPLE`), `:165-173` (`ROLE`), `:251-290` (`choose`), `:503` (its call); `src/lib/edit/agent/prompt.ts:41`, `:46`
- Create: throwaway `.scratch/native-default/hook-check.json`
- Test: `src/lib/edit/agent/__tests__/first-cut.test.ts` (`:206-207`, `:431`, `:440`, `:461`, `:535`, `:551`, `:561-591`, `:661-667`, and new); `src/lib/edit/agent/__tests__/prompt.test.ts:73-78`; `src/app/api/edit/__tests__/agent-route.test.ts:529-546`

**Interfaces:**
- Consumes: `titleBox`, `titleWeight` and a style title's `weight` (Task 2), `measureWide` (`src/lib/edit/measure.ts`).
- Produces:
  ```ts
  export const HOOK = { title: { words: 8, chars: 44, lines: 2 }, short: { words: 3, chars: 18 } } as const;
  /** Made up, a claim within HOOK and two lines at the largest candidate label (84 px, 600); its short form within HOOK.short. */
  export const HOOK_EXAMPLE = { title: "One *change* makes your bread rise", short: "Bread that *rises*" } as const;
  /** The lines a hook is set on as `title` sets it (its look, size and weight; TikTok Sans), by the server's tables. */
  export function hookLines(text: string, title: NonNullable<StyleProfile["title"]>): number;
  ```
  In the tests, `LARGEST_LABEL = { on: true, y: 0.2, frames: 75, look: "label", size: 84, stays: true, ink: "#111111", weight: 600 }`: the largest of Task 8's candidate labels, so the tests hold whatever size is ruled there.

- [ ] **Step 1: Write the failing tests.**
  - `ChoicesSchema` (`:561-591`): "a title of six words" and "a title over 28 characters" are now taken; refused: a title of nine words ("One two three four five six seven eight nine"), one of 45 characters, and a question ("Why does your bread never rise?") at `title`.
  - "takes the prompt's own example pair": six words and three; `hookLines(HOOK_EXAMPLE.title, LARGEST_LABEL)` is 2 or fewer; `:665` reads `(six words)`.
  - `:206-207`: the system prompt says `at most 8 words and 44 characters, on at most two lines`, a claim or a direct statement, never a question, and still `at most 3 words and 18 characters`.
  - New, "sends a hook over two lines back once, with how much of it two lines hold, and keeps what comes next": with a style whose title is `LARGEST_LABEL`, a first answer whose hook is 44 made-up characters in eight words that `hookLines` sets on three lines (asserted in the test first): round 1 is "refused", the second message says `takes 3 lines at its size; at most two: two lines hold about <n> characters of it`, where `<n>` is the length of the longest start of the hook, in whole words, that `hookLines` sets on two; a second answer of three lines is kept.
  - The six tests whose hook is 28 Ws (`first-cut.test.ts:431`, `:440`, `:461`, `:535`, `:551`; `agent-route.test.ts:533`): the hook sets on three lines everywhere, so it is sent back once; each script gets the same wide answer a second time before its change's answers, and each keeps its point (the title left out as text that does not fit).
  - `prompt.test.ts:73-78`: `CRAFT.title.words` is `HOOK.title.words` and the craft says `at most eight words`.
  Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/agent/__tests__ src/app/api/edit/__tests__/agent-route.test.ts`. Expected: FAIL.
- [ ] **Step 2: Implement.**
  - `HOOK` and `HOOK_EXAMPLE` as above. `hookOf` refuses a `?` for both forms: `.refine((text) => !text.includes("?"), "is a question: give a claim, or a direct statement of what the video gives")`. The short form still turns into null rather than being asked again.
  - `ROLE`'s title line:
    `- title: the hook shown over the opening, at most ${HOOK.title.words} words and ${HOOK.title.chars} characters, on at most two lines, in the take's own language: a claim, or a direct statement of what the video gives the viewer; never a question. In words its first sentence does not use (the captions show that sentence at the same moment). Put *asterisks* around the one or two words that carry it. null for none.`
    The short line's example says `(six words)`.
  - `hookLines`:
    ```ts
    export function hookLines(text: string, title: NonNullable<StyleProfile["title"]>): number {
      const props: TitleProps = { text, font: TITLE.font, look: title.look, y: title.y, size: title.size, color: TITLE.color, accent: null, ...(title.weight !== undefined && { weight: title.weight }) };
      return titleBox(props, (line, weight, size, tracking) => measureWide(line, TITLE.font, weight, size, tracking).width).lines.length;
    }
    ```
  - `choose` takes the profile's title (null with none). After a readable answer, while a round is left and nothing was sent back yet (the one flag `asked`, shared with the repeated opening), a title with `hookLines > HOOK.title.lines` is sent back: `round.outcome = "refused"`, `round.error = "the title takes more than two lines"`, and the message:
    `The title "<its words>" takes ${lines} lines at its size; at most two: two lines hold about ${n} characters of it. Answer again with one JSON object only: ${ANSWER}.`
  - `prompt.ts`: `COUNTS` gains "seven" and "eight"; `CRAFT.title.words` is 8.
- [ ] **Step 3: Run the tests; they pass**, then every suite (side by side: see "Order and lanes"): `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit src/edit src/app/api/edit src/app/dev-edit`. Both type checks; eslint.
- [ ] **Step 4: The prompt's examples hold no word of the take.** `pnpm exec tsx scripts/edit-agent-proof.ts examples --base .scratch/task14/first-cut/house-d-1.json`. Expected: exit 0.
- [ ] **Step 5: Three real first cuts, carrying no weight.** Write `.scratch/native-default/hook-check.json`, a profile with the house's look but no weight anywhere (before the deploy no first cut carries one): `source {kind: "default", name: null}`, pace `{pauseMs: 250, cutsPerMin: null}`, captions `{on: true, look: "plain", font: "tiktok", size: 64, y: 0.72, maxWords: 5, highlight: null}`, title `{on: true, y: 0.2, frames: 75, look: "label", size: 84, stays: true, ink: "#111111"}`, punch-ins `{perMin: 4, zoom: 1.1}`, look natural, `notMatched: []`. Then `pnpm exec tsx scripts/edit-agent-proof.ts first-cut --style profile:.scratch/native-default/hook-check.json --runs 3 --name hook --out .scratch/native-default/first-cut --render` (rendered on this Mac). Record for each: the hook's words, characters and lines, whether it is a claim or a statement, whether it repeats the opening, whether it was sent back and why, the rounds, the time and the cents; look at each sheet.
- [ ] **Step 6: Commit.**
  ```bash
  git add src/lib/edit/agent/first-cut.ts src/lib/edit/agent/prompt.ts src/lib/edit/agent/__tests__/first-cut.test.ts src/lib/edit/agent/__tests__/prompt.test.ts src/app/api/edit/__tests__/agent-route.test.ts
  git -c core.hooksPath=/dev/null commit -m "feat(edit): the hook is a claim of up to eight words on two lines, never a question"
  ```

**Nothing old changes:** no drawing changes. The hook's rule is every first cut's (one prompt, X128): at a preset's large title two lines hold about what its hooks hold today; the styled first-cut tests pass. The change loop's titles now say "at most eight words" (X130). **Bundle:** unchanged.

**Results:** `97416076` (on `47bf4049`; lane A's Task 3 commits came in between).
- Before: the new and changed tests failed, 14 in `first-cut.test.ts` and 1 in `prompt.test.ts`. After: `src/lib/edit/agent/__tests__` and `agent-route.test.ts`, 344 passed in 7 files; every suite (`src/lib/edit src/edit src/app/api/edit src/app/dev-edit`), 1373 passed in 60 files, run again after Task 3's commits; both type checks and eslint clean. Step 4: `examples` exit 0, 64 examples, no hits.
- **Not as the brief said:** the hook of 28 Ws is one word, and one word is one line however wide (`fitLines` breaks only between words), so `hookLines` gives 1 and the six tests of it are never sent back: they pass unchanged, and `agent-route.test.ts` is not changed. A new test pins that (`hookLines("W".repeat(28), …)` is 1). The one test that is sent back is the short-hook test's five wide words (`first-cut.test.ts`, three lines at truth 3's 110 px label): its script gets the same answer twice and it expects rounds `refused, chosen`.
- At today's bold house title (130 px), `HOOK_EXAMPLE.title` (32 characters) takes three lines, so a house first cut with a hook that long is sent back once until Task 8 changes the house.
- Step 5 (`hook-check.json`, no weight: the label at 700), three runs on the owner's take:

| run | 1st hook (words, chars, lines) | sent back | 2nd hook (words, chars, lines) | kept at | rounds | time | cost |
|---|---|---|---|---|---|---|---|
| 1 | 8, 40, 3 | yes, three lines | 6, 33, 3 | 71 px, 2 lines (made smaller by `placeTitle`, clear of the buttons) | 2 | 2.7 s | 0.015 ¢ |
| 2 | 8, 40, 3 | yes, three lines | 7, 34, 2 | 84 px, 2 lines | 2 | 2.7 s | 0.015 ¢ |
| 3 | 8, 40, 3 | yes, three lines | 7, 34, 2 | 84 px, 2 lines | 2 | 2.5 s | 0.0149 ¢ |

  No hook was a question; none repeated the opening by `repeatsOpening`; no errors left; films 11.1 s. All six hooks state the take's setting (where and with what) rather than claim what the video gives, and the kept ones share 1 to 2 words with the take's first six words and 3 to 4 with its first twelve, which the captions show at the same moment. Five of six short forms had four words and were left out. Films and sheets: `.scratch/native-default/first-cut/hook-{1,2,3}.mp4` and `-sheet.jpg`.
- **The controller's ruling on the hook's content** (`53c94f3f`): the title line now says the hook is a claim of what the viewer gets (its news, its result or its promise), from the most concrete thing the take says, wherever it says it; never the greeting, where the speaker is, that they have returned or what they are doing; nothing the take does not say. It replaces the old clause, and the line goes from 420 to 600 characters. There is no code check for what a hook says: a test pins that a scripted hook naming a place is taken in one round. Every suite: 1374 passed in 60 files; both type checks and eslint clean; `examples` exit 0, no hits. The same three runs again (`hook-news-{1,2,3}`):

| run | hook (words, chars, lines at 84 px) | sent back | rounds | time | cost | what it states |
|---|---|---|---|---|---|---|
| 1 | 4, 26, 2 | no | 1 | 1.8 s | 0.0074 ¢ | the take's news, from its last sentences |
| 2 | 4, 26, 2 | no | 1 | 1.8 s | 0.0074 ¢ | the same |
| 3 | 4, 26, 2 | no | 1 | 1.5 s | 0.0074 ¢ | the same |

  The three runs gave the same answer. The short form (2 words, 12 characters) is within its limit and kept, where 5 of 6 were left out before. As the label stays to the end, the hook stands over the captions of the take's last sentence, which say nearly the same thing.

---

### Task 8: The native house style: its sizes ruled from a sheet, then the house

**Starts only after Task 4's deploy is done and Tasks 5, 6 and 7 are committed.** It is the first task whose first cuts carry a weight.

**Files:**
- Modify: `src/lib/edit/style/house.ts`; `src/lib/edit/agent/first-cut.ts:193-201` (`takeMessage`), `:300-308` (`titleOp`: the weight), `:536` (the look); `src/app/dev-edit/agent/StylePicker.tsx:83`; `src/app/dev-edit/agent/Sample.tsx:49-58`; on R3 "the same" only: `src/edit/film/layout.ts` (`captionWeights`), `src/lib/edit/agent/catalogue.ts` (`Captions.fields.weight`)
- Create: throwaway `.scratch/native-default/sizes.ts`, `.scratch/native-default/size-<px>.json` (three profiles), `sheets.py`'s `sizes` mode
- Test: `src/lib/edit/style/__tests__/house.test.ts`; `src/lib/edit/agent/__tests__/first-cut.test.ts` (`expectedCut` `:156-170`, `:214-240`, `:285`, `:328`, `:338-347`, `:354`, `:359-365`, `:541-545`); `src/app/api/edit/__tests__/agent-route.test.ts:428-443`, `:529-546`; `src/app/dev-edit/agent/__tests__/parts.test.tsx`; on R3 "the same" only: `src/edit/film/__tests__/layout.test.ts`, `weights.test.tsx`, `src/lib/edit/agent/__tests__/catalogue.test.ts`

**Interfaces:**
- Consumes: the weight (Task 2), the sentence (Task 3), the deployed worker (Task 4), the fit (Task 5), `MARKED` (Task 6), the hook (Task 7).
- Produces: `HOUSE_STYLE` at the ruled sizes (Step 4's box).

- [ ] **Step 1: The second take, up for this task and Task 9.** As the e2e account: `pnpm exec tsx scripts/edit-agent-proof.ts extra-upload --file task14-extra.mp4 --out .scratch/native-default` (the free clip; its analysis is metered on Modal: read the spend before and after). Its ids go to `.scratch/native-default/extra/ids.json`; it stays up until Task 9 takes it away.
- [ ] **Step 2: The candidates' cuts.** Three profiles, `.scratch/native-default/size-52.json`, `size-58.json` and `size-64.json`, each: `source {kind: "default", name: null}` (no colour on any word, R4), pace `{pauseMs: 250, cutsPerMin: null}`, captions `{on: true, look: "plain", font: "tiktok", size: <52|58|64>, y: 0.72, maxWords: 5, highlight: null, weight: 600}`, title `{on: true, y: 0.2, frames: 75, look: "label", size: <68|76|84>, stays: true, ink: "#111111", weight: 600}`, punch-ins `{perMin: 4, zoom: 1.1}`, look natural, `notMatched: []`. Write `.scratch/native-default/sizes.ts` from `.scratch/native-look/native.ts` (the same loader, the take's row by the service key, `firstCut` with the profile, the ids masked in what it writes), with three differences:
  - it takes `--ids <file>`, `--take <index>`, `--take-file <name in .scratch/media>` and `--name owner|second`;
  - the 64 px candidate asks Qwen; the 58 and 52 px candidates are given the answer it kept (its last readable one) by an `ask` at the network boundary that answers the first cut's own question (its system message starts "You make the first cut") with that text every time, and passes any other call (a last resort's change) to `askQwen`; so the three rows carry the same hook and the same stresses;
  - for each cut it writes `.scratch/native-default/sizes/<name>-<px>.json` (style, choices, rounds, findings, the edit, its pages with stressed words marked) and `<name>-<px>-demo.json` (`{edit, files: {take: <take file>}}`, the take's id as `take`), and prints a line: the asked and placed captions size, words a page and `y`; the label's placed size and lines; the findings by severity and code.
  Run: `pnpm exec tsx .scratch/native-default/sizes.ts --name owner` (the owner's take: `.scratch/stills-proof/ids.json`, take 0, `task6-full.mp4`) and `pnpm exec tsx .scratch/native-default/sizes.ts --name second --ids .scratch/native-default/extra/ids.json --take-file task14-extra.mp4`.
- [ ] **Step 3: The sheet, and the stress both ways.** For each take, four moments from its 64 px cut: frame 20 (the hook and the first page), the first frame of the first page holding a stressed word, and the frames at 60 % and 90 % of the film; the same frames for the three candidates (their cuts share the pause, so their frames line up). Render stills: `pnpm exec tsx scripts/edit-still.ts .scratch/native-default/sizes/<name>-<px>-demo.json .scratch/native-default/sizes/<name>-<px> <the four frames>` for 52, 58 and 64. Then the 58 px cut once more with stressed words at the captions' weight: set `STRESS_STEP` to 0 in `layout.ts` (an uncommitted edit of that one line), render into `.scratch/native-default/sizes/<name>-58-same`, put it back, and check `git diff --quiet src/edit/film/layout.ts`. Add `sizes` mode to `sheets.py`:
  ```python
  if sys.argv[1] == "sizes":
      take = sys.argv[2]
      folder = f"{OUT}/sizes"
      runs = (("52 px, label 68", f"{take}-52"), ("58 px, label 76", f"{take}-58"), ("58 px, stress same weight", f"{take}-58-same"), ("64 px, label 84", f"{take}-64"))
      cols = []
      for title, run_dir in runs:
          frames = sorted(glob.glob(f"{folder}/{run_dir}/frame-*.png"))
          cells = []
          for k, frame in enumerate(frames):
              cells.append(f"{OUT}/sz-{run_dir}-{k}.png"); cell(frame, cells[-1])
          cols.append(f"{OUT}/sz-{run_dir}-col.png"); column(title, cells, cols[-1])
      sheet(cols + references(4), f"{OUT}/sizes-{take}.jpg")
  ```
  Run `python3 -I .scratch/native-default/sheets.py sizes owner` and `… sizes second`. Output: `.scratch/native-default/sizes-owner.jpg` and `sizes-second.jpg`, each six columns (the four runs, references 3 and 4 at the same scale) by four moments; and `.scratch/native-default/sizes.txt`, one line a cut from Step 2 (what the fit ended with, and the review's findings).
- [ ] **Step 4: STOP for the controller's ruling** on the captions' size, the label's size and the stressed word. Send the two sheets' paths and `sizes.txt`. While waiting: nothing else of this task. When the ruling comes, the implementer writes it here, and every later step uses these three and no other number:

  | Ruled value | From the controller's ruling of … |
  |---|---|
  | `CAPTIONS_PX`, the house's captions size | **64** (the controller's ruling, `task-8-ruling.md`, from `sizes-owner.jpg` and `sizes-owner-crops.png`) |
  | `LABEL_PX`, the house's label size | **72** (the same ruling: between references 3 and 4, and the largest size at which a 44-character hook sets on two lines) |
  | The stressed word | the same weight on a plain page with a weight and no highlight colour: ruled and built in Task 3 (`captionWeights`), so Step 5 is not built here |

- [ ] **Step 5: Only if the stressed word is ruled "the same weight": build it, test first.**
  - `layout.test.ts`, "sets a stressed word of plain captions with a weight and no highlight colour at the captions' weight": `captionWeights({ look: "plain", weight: 600, highlight: null })` is `{600, 600}`; with a highlight colour, or in pop, pill or highlight, `{600, 700}`; with no weight `{800, 900}` as before. `weights.test.tsx`: such a page draws its stressed word at `"600"`. `catalogue.test.ts`: the weight's meaning says so. Run them; they fail.
  - `layout.ts`:
    ```ts
    export function captionWeights(captions: Pick<Captions, "look" | "weight" | "highlight">): { plain: number; stressed: number } {
      if (captions.weight === undefined) return CAPTION_WEIGHTS;
      const alike = captions.look === "plain" && captions.highlight === null; // the controller's ruling (Task 8, Step 4)
      return { plain: captions.weight, stressed: alike ? captions.weight : Math.min(900, captions.weight + STRESS_STEP) };
    }
    ```
    `catalogue.ts`'s meaning: `"letters' weight; left out 800; a stressed word one step heavier, up to 900, but alike in plain with no colour; plain with one sits closer, thinner-edged"`, the length still under 21,000. Run the tests; they pass; `as-before.test.tsx` unchanged; the old stills (`same-stills.ts compare`): 0 differ. Then the box check and the new demo once more: `pnpm exec tsx scripts/edit-preview-vs-render.ts .scratch/native-default/pvr-same demo:4,20,100 demo-native-600:3,20,56,100,192,262`: "preview and render agree". This changes the render bundle: Task 10's second deploy is owed, and no first cut of the new house is downloaded from the page before it.
- [ ] **Step 6: Write the failing tests**, with the ruled values of Step 4.
  - `house.test.ts`, "is the native default": `HOUSE_STYLE` parses and equals
    ```ts
    {
      source: { kind: "default", name: null },
      pace: DEFAULT_STYLE.pace,
      captions: { on: true, look: "plain", font: "tiktok", size: CAPTIONS_PX, y: 0.72, maxWords: 5, highlight: null, weight: 600 },
      title: { on: true, y: 0.2, frames: 75, look: "label", size: LABEL_PX, stays: true, ink: "#111111", weight: 600 },
      punchIns: { perMin: 4, zoom: 1.1 },
      look: { preset: "natural" },
      notMatched: [],
    }
    ```
    with `CAPTIONS_PX` and `LABEL_PX` the numbers of Step 4's box, written as numbers. The values the rulings name no number for: `y` 0.72 for the captions and 0.2 for the title (today's house places, where `placeCaptions` and `placeTitle` start); `frames` 75 (a title that stays ignores it: `titleOp` sets `frames: null`); `ink` `#111111`, the Sentences preset's dark letters, which give the light box (`labelFill`, `layout.ts:291-293`).
  - `first-cut.test.ts`: `expectedCut` follows `titleOp` (a title that stays has `frames: null`; `color` the ink or white; `weight` when the profile has one; the accent `MARKED` only for preset and words kinds), and its look is the profile's for the house too. The house test at `:214-240` becomes "cuts with the native captions, a label that stays to the end in dark letters at 600, no colour on any word, Qwen's pace and the natural look, and no errors": the captions `{ look: "plain", font: "tiktok", maxWords: 5, highlight: null, weight: 600 }` with the `size` and `maxWords` the fit leaves; the title `{ id: "hook", anchor: "start", at: 0, frames: null, props: { look: "label", color: "#111111", accent: null, weight: 600 } }`, its `size` as `placeTitle` leaves it (`LABEL_PX` where it finds a place at its own size, as on this fixture's face from 0.3 to 0.5); `look.preset` natural though Qwen answered vivid; the say ends `; its captions are plain white words.`; the line `expect(punchedOf(result.edit)).toBe(1)` goes (the equality with `expectedCut`, real recipes at 4 a minute and 1.10, holds the punch-ins). `:285`, `:328`, `:354` follow `expectedCut`. `:346` and `:362` end `its captions are plain white words.`. `:541-545` ("names a look as a creator would") runs in a style whose look is mono, since the house's is always natural.
  - `first-cut.test.ts`, new, "tells Qwen the look is natural with no style, and sets natural whatever it answers": the user message holds `answer look "natural"`; with `chose({ look: "warm" })` the edit's look is natural and `result.choices.look` is "warm" as read.
  - `first-cut.test.ts`, new, "keeps the house's title to the film's end after a later cut": the first cut's edit, then `shot.trim` of its last shot by a second through `applyOps`: `placed(edit)` gives the title `at` 0 and `frames` equal to `layout(edit).frames`.
  - `agent-route.test.ts:439`: `expect(got.edit.look.preset).toBe("natural")`. `:532` (a label made from the house's title): the house's title is a label already; the test keeps its point (a 28-W hook set under the least size at every place and size is left out).
  - `parts.test.tsx`, new, "says what our pick is, and draws its sample at the house's weight": the row "Our pick" reads "Clean white captions and a label that stays."; the sample's words have `font-weight` 600.
  Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/style/__tests__/house.test.ts src/lib/edit/agent/__tests__ src/app/api/edit/__tests__/agent-route.test.ts src/app/dev-edit/agent/__tests__/parts.test.tsx`. Expected: FAIL.
- [ ] **Step 7: Implement.**
  - `house.ts`: the value of Step 6 (with the two ruled numbers), and the header says what each value is and why (references 3 and 4; the rulings of 2026-11-24; the sizes from the sheet of Step 3).
  - `titleOp`: `props: { …, ...(profile.title.weight !== undefined && { weight: profile.title.weight }) }`.
  - `:536`: `step([{ op: "look.set", preset: profile.look.preset }], "look")` (the style's, or the house's natural).
  - `takeMessage`, with no style: `sections.push(\`look:\nThe film's look is ${HOUSE_STYLE.look.preset}: answer look "${HOUSE_STYLE.look.preset}".\`)`.
  - `StylePicker.tsx:83`: `says="Clean white captions and a label that stays."`. `Sample.tsx` `Words`: `style={{ …, ...(captions.weight !== undefined && { fontWeight: captions.weight }) }}`; with none, `font-extrabold` as today.
- [ ] **Step 8: Run the tests; they pass**, then every suite: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit src/edit src/app/api/edit src/app/dev-edit`. Both type checks; eslint.
- [ ] **Step 9: A real first cut.** `pnpm exec tsx scripts/edit-agent-proof.ts first-cut --style none --runs 1 --name house-t8 --out .scratch/native-default/first-cut --render` (the owner's take; rendered on this Mac). Look at `house-t8-1-sheet.jpg`. Expected: no errors; plain captions at 600 and the light label in dark letters on every frame. Record the captions' placed `y`, `size` and `maxWords`, the title's place, size and lines, the punch-ins, the say, the rounds and the cents.
- [ ] **Step 10: The page, in a browser.** `pnpm exec tsx scripts/edit-agent-page-proof.ts --only=390 --no-download .scratch/native-default/page` (the e2e account; Qwen only, no render). Look at the page as it opens: the row "Our pick" with its new line and its sample. Expected: exit 0.
- [ ] **Step 11: Commit** (with Step 5's files when it was built).
  ```bash
  git add src/lib/edit/style/house.ts src/lib/edit/agent/first-cut.ts src/app/dev-edit/agent/StylePicker.tsx src/app/dev-edit/agent/Sample.tsx src/lib/edit/style/__tests__/house.test.ts src/lib/edit/agent/__tests__/first-cut.test.ts src/app/api/edit/__tests__/agent-route.test.ts src/app/dev-edit/agent/__tests__/parts.test.tsx
  git -c core.hooksPath=/dev/null commit -m "feat(edit): the native default: plain sentence captions at 600, a light label that stays, four light punch-ins a minute, natural colour"
  ```

**Nothing old changes:** presets and styles take nothing from the house now (Task 6); `presets.test.ts` and the styled first-cut tests pass unchanged; with Step 5, `as-before.test.tsx` and the old stills again. **Bundle:** unchanged, unless Step 5 was built (then Task 10 deploys again).

**Results:** (the second take and Step 10 not done: see the last two lines.)
- First, Task 7's review in one commit, `ca5dc00f`. A hook's question is read from `?`, `？` or `؟` at its end (the message says "ends in a question mark"), and a `firstCut` test shows its repair round. `sentBack` and `heldOnTwo` measure the same string. The send-back test asserts how the cut ends. 3 failed first, then every suite passed (1378).
- The sizes sheet, the owner's take: `.scratch/native-default/sizes-owner.jpg` and `sizes-owner-crops.png` (labels and captions at one scale). It is on the code as it stood, through `.scratch/native-default/sizes.ts` and three profiles, with local stills. The title was set to 600 after the cut, since `titleOp` had no weight yet. `sizes.txt`: at 52, 58 and 64 px the fit kept the asked size and five words a page, at y 0.76. The label set at 68 px on 1 line, at 76 and 84 px on 2. Each cut had one warning (the captions touch the chin at 0.1 s) and no error.
- The ruling (`task-8-ruling.md`): captions 64 px, label 72 px; the stress was ruled and built in Task 3, so Step 5 is not built. The second take gets one first cut at the ruled sizes, not a sheet.
- `33a1c029`: the house as Step 6 (`house.test.ts`). `titleOp` passes the title's weight, the look is the profile's (natural for the house) and Qwen is told so, the picker's line reads "Clean white captions and a label that stays.", and the sample is at the captions' weight. Also: a Task 7 test that used the house as "the bold 130 px title" now reads Bold pop's title. A new test sets both of its 44-character hooks on two lines at the house's 72 px, 600. Before: 10 failed. After: the named tests, 386 passed in 9 files; every suite, 1382 passed in 60 files; both type checks and eslint clean. The bundle is unchanged.
- Step 9 (`house-t8-1`, the owner's take): 1 round, 1.8 s, 0.0069 ¢. 11.1 s from 12.7 s, 3 shots, 1 punch-in. Captions plain 64 px at 600, five words, y 0.76. The label is 72 px at 600, y 0.2, on 2 lines, held to the end. The hook is 4 words, 26 characters. The look is natural. No errors; one warning (on-face at 0.1 s). The say: "…with a title and a punch-in; its captions are plain white words." Sheet: `.scratch/native-default/first-cut/house-t8-1-sheet.jpg`. A full-size crop of the captions over the cream top: `.scratch/native-default/task-8/caption-on-cream-full-size.png`.
- The second take's first cut at the ruled sizes was NOT made: the test account's login is not set in this worktree, and the take's analysis lived only in its row (no copy under `.scratch`). It waits for the owner's login.
- Step 10 (the page in a browser) was NOT run, for the same reason: it signs in as the test account. The picker's line and the sample's weight are held by `parts.test.tsx` only.

---

### Task 9: The agent's proofs, and the sheet for the owner

Nothing else runs on the machine meanwhile.

**Files:**
- Create: `sheets.py`'s `reference` mode; `.scratch/native-default/for-the-owner/`

**Interfaces:**
- Consumes: everything above.
- Produces: the slice's gate numbers, in this task's Results.

- [ ] **Step 1: The base first cut, on the final code.** `pnpm exec tsx scripts/edit-agent-proof.ts first-cut --style none --runs 1 --name house --out .scratch/native-default/first-cut --render`. Expected: no errors in its findings. It is the requests' base and the owner's film.
- [ ] **Step 2: The requests, three times.** `pnpm exec tsx scripts/edit-agent-proof.ts requests --tag requests --base .scratch/native-default/first-cut/house-1.json --out .scratch/native-default` (27 requests × 3; no Modal), then `sheets --tag requests --out .scratch/native-default`. Judge every run from its sheet and its facts into `.scratch/native-default/requests/judged.json` (did it do what was asked; does it look right), as part 3 judged. For r07, ending the hook where the closing line starts is part of the asked change (R8). Then `summary --tag requests --out .scratch/native-default`.
  The gate: done as asked at least 55 of 66, refusals 15 of 15, looks right 66 of 66, each no worse than part 3's last run. Every miss is named with its request and why. Also the median and worst time and the cents of a change against part 3's 1.5 s, 4.7 s and 0.042 c.
  **For r07 (R8)**, from `.scratch/native-default/requests/r07-<k>.json`, each of the three runs: its rounds and its seconds, and what happened to the hook (ended where the closing line starts; left to the end and the closing line refused; the closing line made a call-out; or else, said plainly).
- [ ] **Step 3: The second take, cut and taken away.**
  ```bash
  pnpm exec tsx scripts/edit-agent-proof.ts first-cut --ids .scratch/native-default/extra/ids.json --take-file task14-extra.mp4 --style none --runs 3 --name second --out .scratch/native-default/second --render
  pnpm exec tsx scripts/edit-agent-proof.ts extra-delete --out .scratch/native-default
  pnpm exec tsx scripts/edit-agent-proof.ts extra-left --out .scratch/native-default
  ```
  Expected: each first cut with no review error, or each error named with its cause (part 3's cuts of this clip kept one: captions on the mouth in its close-up, since the captions are one setting for the whole film); `extra-left` counts nothing left.
- [ ] **Step 4: The sheet for the owner.** Add `reference` mode to `sheets.py`: four columns, three rows. The columns: "Default today" (`.scratch/task14/first-cut/house-d-1.mp4`, part 3's last house first cut), "New default" (`.scratch/native-default/first-cut/house-1.mp4`), "Reference 3" and "Reference 4" (the three `frame-*.jpg` of `.scratch/task14/styled/ref-3/` and `ref-4/`, in name order). The rows, for the two films: frames 20, 140 and 290 (0.7 s: the hook and the first page; the middle; near the end). Each cell 540 by 960, with no word of a reference on the labels.
  ```python
  if sys.argv[1] == "reference":
      films = (("Default today", ".scratch/task14/first-cut/house-d-1.mp4"), ("New default", f"{OUT}/first-cut/house-1.mp4"))
      cols = []
      for n, (title, film) in enumerate(films):
          cells = []
          for frame in (20, 140, 290):
              cells.append(f"{OUT}/ref-cell-{n}-{frame}.png"); cell(film, cells[-1], frame=frame)
          cols.append(f"{OUT}/ref-col-{n}.png"); column(title, cells, cols[-1])
      sheet(cols + references(3), f"{OUT}/default-vs-reference.jpg")
  ```
  Run `python3 -I .scratch/native-default/sheets.py reference`; copy `default-vs-reference.jpg` and `first-cut/house-1.mp4` (as `new-default.mp4`) into `.scratch/native-default/for-the-owner/`. Other people's frames stay in `.scratch`; nothing of them is committed.
- [ ] **Step 5: STOP for the controller's eye and the owner's.** Send the controller the two files' paths, the gate line of Step 2 with every miss, r07's three runs, and Step 3's findings. While waiting: write this task's Results into the plan (the only file committed in this step).
  ```bash
  git add docs/superpowers/plans/2026-11-24-native-default.md
  git -c core.hooksPath=/dev/null commit -m "docs(edit): the native default's proofs and gate line in the plan"
  ```

**Results:** (at the STOP, for the controller's eye)
- Step 1, the base first cut (`house-1`, the owner's take, on `afd2c5f9`): 1 round, 1.8 s, 0.0068 ¢. It runs 11.0 s from 12.7 s, 3 shots, 1 punch-in. Captions plain 64 px at 600, five words, y 0.76; the label 72 px on 2 lines, held to the end; natural. No errors; one warning (on-face at 0.1 s).
- Step 2, the requests, **run 1, before the repair** (81 runs, live model, no Modal; `AGENT_LIMITS.look` is off, so no stills): **the gate fails.** Done as asked **42 of 66** (part 3: 55); looks right **65 of 66** (66); refusals 15 of 15 (15). Median change 1.5 s (1.5), worst 7.9 s (4.7, r22 run 3, four calls), 0.048 ¢ a change (0.042). The says: 0 kit terms, 0 second sentences, 0 numbers not given; 77 the model's own, 2 asked again, 2 the code's.
- Every miss (24), from `requests/judged.json`:
  - Thirteen are new, and come from the house, not the model. r06 × 3: no call-out (no room; the label that stays takes the room above the face; part 3: 3 of 3). r07 × 3: the hook is removed from the whole film, not ended where the closing line starts; run 2's say does not tell it. r20 × 3: run 1 leaves the set-up call-out on the lip and chin (also the one "looks" miss), runs 2 and 3 remove it rather than move it (part 3: moved 3 of 3). r16 × 3: the stress is set, but on plain captions with a weight and no colour it draws at the same weight (Task 3's ruling), so nothing shows, while the say says it is stressed (part 3 counted "hardly seen" as done). r13: 3 of 3 now (part 3: 2 of 3); the middle shot (about 40 % of the film) does not zoom, and runs 2 and 3 say "throughout".
  - Eleven are as in part 3, the take's own limits: r02 × 3, r09 × 3, r21 × 3, and two of r13's three.
- r07 (R8), each run: run 1, 3 rounds, 5.3 s; run 2, 3 rounds, 5.9 s; run 3, 3 rounds, 6.0 s. Each first put the closing line under the hook that stays, and the review refused it ("two titles at once", "on-text" at 9.0 s). The next answer removed the hook (`item.remove`) and added the closing line over the last 2 s. So neither "ended where the closing line starts", nor refused, nor made a call-out: the hook is taken off the whole film. Runs 1 and 3 say so; run 2 does not. Run 3 marks "Follow" in coral.
- Step 3, the second take: NOT DONE. The test account's login is not set in this worktree, and its analysis lived only in its row.
- The page's browser proof (Task 8, Step 10): NOT DONE, for the same reason.
- The kit has not changed since Task 4's proof: `git diff --stat f31482b4 HEAD -- src/edit/film src/lib/edit/{analysis,atoms,check,derive,doc,index,ops,parts,time}.ts` prints nothing. The brief does not ask for the preview-against-render proof, and it was not run.
- Step 4, for the owner, in `.scratch/native-default/for-the-owner/`:
  - `default-vs-reference.jpg`: "Default today" (part 3's `for-the-owner/first-cut.mp4`), "New default" (`house-1.mp4`) at frames 20, 140 and 290, and references 3 and 4 from the clean top rows of their side-by-side images (cells 1, 3 and 4).
  - `native-default.mp4` (`house-1.mp4`) and `notes.md`.
- Modal: no job ran in this task, and the spend was not read.
- A run on `dc1212cc` (the repair before its fix round, which landed during that run) gave 55/66, 66/66, 13/15. It is superseded by the final run below and is not counted.
- **The final run, after the repair and its fix round** (Task 9b: `a33570e0`, `dc1212cc`, `f4ddd401`. A label that stays gives way by code to a later text; an asked stress turns the colour on). Base `house-final-1` on `c8b3bfbd` (code at `f4ddd401`): 1 round, 1.7 s, 0.0069 ¢. 11.1 s from 12.7 s; no errors, one on-face warning at 0.1 s; no stress marks in the edit. The 81 runs, judged into `requests-final/judged.json`:
  - The gate line, three runs side by side: part 3's last, 55/66 done, 66/66 looks right, 15/15 refusals; run 1 before the repair, 42/66, 65/66, 15/15; **the final run, 55/66, 66/66, 12/15**. Median change 1.8 s, worst 5.3 s, 0.0429 ¢ a change. The says: 0 kit terms, 0 second sentences, 0 numbers not given; 78 the model's own, 3 the code's.
  - Misses (14):
    - r02 × 3: runs 1 and 2 found no room above the chin; run 3 made the captions bigger (92 px) for "higher", and the code's sentence tells the size.
    - r09 × 3 and r21 × 3: as in part 3.
    - r13 runs 1 and 3: one shot does not zoom (the middle, then the last); run 1 says "throughout", run 3 says which.
    - r22 × 3, not refused. After its zoom on the word was refused for room, runs 1 and 2 set the other two shots closer (not asked) and say so. Run 3 added a call-out "Claude" above the head (not asked; the label gave way for it) and says the whoosh is missing.
  - r06, 1 round each, 1.9, 3.5, 1.8 s: the call-out goes above the head (coral pop) at frame 183, 183 and 194; the code ends the label at 177, 177 and 188.
  - r07, 1 round each, 2.3, 1.8, 2.3 s. Runs 1 and 2: the code ends the hook at 267, 6 frames before the closing line at 273. Run 3: the model itself ends the hook at 273, where the closing line starts, and the say does not tell it (as the fix round rules).
  - r16, 1 round each, 2.1, 1.6, 2.0 s: the colour turns `MARKED`; the word is yellow and one step heavier (seen at frame 303); the label is untouched.
  - r20, 2 rounds each (the first place refused), 2.9, 3.3, 2.8 s: the call-out moves to y 0.2; the code ends the label at 177.
  - No say tells the label's end twice. The code's clause appears exactly where the code moved the label: r06, r07 runs 1 and 2, r20, r22 run 3. The hook is removed only in r18, which asks for it.
  - For the owner, in `.scratch/native-default/for-the-owner/`:
    - `native-default.mp4`: now `house-final-1.mp4`.
    - `changes.jpg`: six final runs, before and after with the agent's sentence: bigger captions, a call-out, the closing line, the asked stress, black and white, the call-out moved.
    - `notes.md`: these numbers, what the label does, and what was not done.
    - `default-vs-reference.jpg`: stands as made.
  - Still NOT DONE: the second take's first cut and the page's browser proof (the test account's login).
- **The last run, after the colour fix** (`7df43b14`: where the captions have no highlight colour, a call-out's letters are white and a title has no accent unless the creator names a colour; the catalogue's colour example is white). Same base `house-final-1`: the first cut's prompt does not quote the changed line, and only the change loop's prompt and catalogue changed since `f4ddd401`. The 81 runs (`requests-coral`) were judged from their ops and facts, with sheets opened for r05, r06, r07 and r22 (the one run whose ops differ in kind from the run before).
  - The gate line, four runs side by side: part 3's last, 55/66, 66/66, 15/15; run 1 before the repair, 42/66, 65/66, 15/15; after the repair, 55/66, 66/66, 12/15; **after the colour fix, 54/66 done, 66/66 looks right, 13/15 refusals**. Median change 1.6 s, worst 6.1 s, 0.0442 ¢ a change. The says: 0 kit terms, 0 second sentences, 0 numbers not given; 76 the model's own, 5 the code's.
  - Misses (14):
    - r02 × 3: run 2 found no room. Runs 1 and 3 made the captions bigger (92 px) for "higher" and say they sit "above your chin", which they did before.
    - r09 × 3, as in part 3.
    - r13 × 3: in all three the middle shot (about 40 % of the film) does not zoom, and every say reads "throughout". The run before had 1 of 3 done, part 3 1 of 3. This is the label's limit on a zoom, a known cost (Task 9b), and the one thing that got worse.
    - r21 × 3: run 1 also made the captions 72 px, not asked, and the code's sentence tells it.
    - r22 runs 1 and 3, not refused: they zoomed other shots (not asked) and say so. Run 2 refused properly, naming both reasons.
  - The colour, per run. r05: "Day one" with no mark, so the label stays dark letters on light (3 of 3). r06: the call-out is white (3 of 3). r07: the closing line is a label in dark letters with no accent (3 of 3). No new text in any of the 81 runs carries a colour; the bar of r15 is white too. In r06 the model's say named "pop" and was sent back each time, so the code's own true sentence is shown and the change takes one call more (3.6, 3.7, 5.5 s).
  - The label: the code ends it at 177/177/188 (r06), 267 (r07) and 177 (r20). No say tells it twice; the hook is removed only in r18.
  - For the owner: `changes.jpg`'s call-out and closing-line panels are now from this run (no colour); `notes.md` carries this line. `native-default.mp4` and `default-vs-reference.jpg` stand.

---

### Task 10: What remains after the proofs

No task after Task 4 changes the render bundle's inputs (Tasks 5 to 9 touch the recipes, the styles, the agent, the app's page, the proof scripts and the plan), so **no second deploy is owed**, unless Task 8's Step 5 was built (the stressed word ruled "the same", a change to `layout.ts`).

- [ ] **Step 1: Check it.**
  ```bash
  git diff --name-only <the deployed commit of Task 4> HEAD -- src/edit src/lib/edit/index.ts src/lib/edit/time.ts src/lib/edit/parts.ts src/lib/edit/doc.ts src/lib/edit/derive.ts src/lib/edit/check.ts src/lib/edit/ops.ts src/lib/edit/analysis.ts src/lib/edit/atoms.ts public/edit worker
  ```
  Expected: nothing printed (only test files under `src/edit/film/__tests__` may be, which the bundle does not hold; name them).
- [ ] **Step 2: Only if a bundle input changed:** a second deploy, on the controller's word, by Task 4's Steps 6 to 12 (the check edit before, the clean tree and the bundle from HEAD with its digest, the image's tests, the deploy, the check after, the spend), the Modal cap still $5.00 for the plan.
- [ ] **Step 3: Close.** The plan's Results complete; commit the plan alone:
  ```bash
  git add docs/superpowers/plans/2026-11-24-native-default.md
  git -c core.hooksPath=/dev/null commit -m "docs(edit): the native default slice closed: what the bundle holds and what was deployed"
  ```

**Results:** (Step 1's output; Step 2 if run; the spend at the close.)

---

## Done when

- A first cut with no style, on the owner's take, has plain sentence captions at weight 600 and the ruled size with the ruled edge, a light label in dark letters at 600 and the ruled size that stays to the end, at most four punch-ins a minute at 1.10, the natural look, a hook that is a claim of up to eight words on two lines, and no review errors; its say is true of it.
- Every preset's profile, every stored edit and every old demo draws as before: the digest, the 143 stills and the 286 frame lines.
- The requests proof is at or above part 3's numbers, every miss named, r07's three runs reported; the second take's first cut has no error, or its error is named with its cause.
- The controller has ruled the edge from `edge-sheet.jpg`, the sizes and the stressed word from `sizes-owner.jpg` and `sizes-second.jpg`, and looked at `default-vs-reference.jpg` and the film; the worker was deployed on the controller's word before any first cut carried a weight, and again only if the bundle changed after it, with the spend under $5.00.
