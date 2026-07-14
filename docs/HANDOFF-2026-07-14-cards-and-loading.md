# Handoff — 2026-07-14 · next session: **skill cards + loading states, step by step**

> **Read this first.** Written at the close of `lane/explore-a` (2026-07-14). Everything below is
> either **SHIPPED** (on `main`, don't redo it) or **OPEN** (ranked, with the decision you'll need
> to make). Nothing is in flight; the worktree is clean and synced to `main`.
>
> Companion SSOTs — **read these, not this file, for the rules**:
> `docs/subsystems/ui-skill-cards.md` (the card contract, §0.5 + §0.6 + the new **§0.7**)
> `docs/subsystems/ui-home-composer.md` (the starter contract)

---

## The one idea worth carrying into next session

**A surface you cannot cheaply LOOK AT will drift, and reading the source will not catch it.**

That is the whole lesson of 2026-07-14. `/analyze` — the flagship, the surface the entire engine
exists to produce — had **never been rendered at 1:1 by anyone**. The 07-13 pass audited it *by
reading the code* and concluded one label primitive had drifted. Rendering it and measuring the
computed styles found **eleven** label declarations in **seven** type stacks, plus a **retired brand
colour still being painted in two places**. Source-reading undercounted it roughly tenfold.

The thread cards stayed honest because `/dev/cards` exists. Reading rotted because nothing equivalent
did. **Before auditing any surface next session: make sure you can see it, in every state.**

---

## SHIPPED today (on `main` — do not redo)

| PR | What |
|---|---|
| **#283** | The thread-card contract + home-composer contract (the 14-commit lane). |
| **#287** | **The no-source note** — a grounded run that cited no source for a card now *says so*. |
| **#288** | **The Reading audit** — 7 label stacks → 1, retired accent killed, both guarded. |
| **#290** | The `Sidebar.recent` flake (module warm-up, not a slow render). |
| **#292** | **`/dev/cards` now previews ALL NINE Reading states** — incl. the loading skeleton. |

### Two traps that are now guarded — know they exist

1. **`toBlocks()` silently drops new card props.** Every `use-*-stream.ts` hand-builds its block
   props field-by-field. A new *optional* prop that you add to the schema + runner + wire-parse but
   forget to copy into `toBlocks()` **typechecks clean, passes every persisted-block test, and does
   nothing on the live stream** — which is the only path the user actually watches. The first cut of
   #287 did exactly this. **Any new card prop = FOUR touchpoints: schema → runner → `parse*Prop` →
   `toBlocks()`.**
2. **Type + colour drift in `reading/**` is now enforced** (`reading-labels.test.ts`), the way radii
   already were (`thread/__tests__/radius-scale.test.ts`). Both are mutation-tested. Use
   `READING_LABEL` (DOM) / `SVG_LABEL` (SVG `<text>`, which cannot take a Tailwind class).

---

## OPEN — ranked for next session

### 🥇 1. The Reading's loading state (`reading-skeleton.tsx`) — **start here**

A real Read takes **~2 minutes** (the live moat run was 128s). For that entire time the user looks at
a **generic grey shimmer** — anonymous circle + bars + a static line, *"Reading your simulation…"*.
No phase. No progress. No sense that anything is happening or what.

Meanwhile **#207 already shipped a premium loading system** for the skills — a real per-phase spine,
morphing nodes, collapse-to-receipt (`docs/HANDOFF-2026-07-07-loading-states.md`). **The flagship
never got it.** The longest wait in the product has the weakest loading state in the product.

▶ **Now visible at `/dev/cards` → Reading → "Loading".** First tab, on purpose.
⚠️ Verify what the *live* `/analyze` actually shows during a real run before designing — the skeleton
may be swapped for a progress component partway. Don't design against the fixture alone.

### 🥈 2. The four Reading information-design calls (`§0.7`) — **owner decisions**

Deliberately NOT fixed on 07-14: these are design, not drift, and shouldn't be changed silently.

1. **Provenance sits in the hero eyebrow.** `TEST · [POWERED BY SIM-1 MAX]`, bordered pill, the first
   thing you read. §0.5 says *"provenance is a footnote, never a headline"*, and §0.6 flags this exact
   defect on Simulate. **But Reading is a *page*, not a card — it has no disclosure row to demote onto.**
   So this is a hero restructure, not a class swap. (Allowlisted in the guard until decided.)
2. **An empty state is wearing a verbatim's clothing.** When a persona didn't speak, the quote slot
   renders *"stopped — no words this time"* — **italic, in the quote position**, on 2 of the 4 people
   in the default fixture. It reads as something the persona *said*. We are scrupulous about never
   fabricating a quote, then style the **absence** of one to look like a quiet one.
   ▶ Reproduce at `/dev/cards` → Reading → **"Empty personas"**.
   ▶ This is the same *class* of problem #287 just solved for cards (an absence rendered as a hole /
   as a claim). **The fix pattern already exists — state the absence, don't dress it up.**
3. **Two entity types in one undifferentiated list.** Segments (*Loyal fans*, *New viewers*) and named
   personas (*Maya*, *Sam*) share identical anatomy — dot, name, quote — but **only personas are
   askable**, and the only cue is an `ask →` link on two of four rows. Nothing says why.
4. **The replay action exists twice** — a `▶ Replay the room` link and a `Replay reactions` button,
   same block, ~300px apart.

### 🥉 3. The remaining card-contract violations (§0.6) — the ranked worklist already exists

`docs/AUDIT-2026-07-13-cards-remaining-nine.md` + the §0.6 table. Still 🔴 **STRUCTURAL**:

- **Simulate** (`reaction-distribution`) — fraction stated TWICE from two sources that can disagree ·
  provenance in the eyebrow · band-word-as-hero · no ProofUnit / no "See the room →" · 2-row action
  bar, no cream primary · `text-red-400`.
- **Predict** (`prediction-gauge`) — renders `~35–60%`, which §0.5b forbids and its own UI-SPEC
  requires. **OWNER CALL.** Also uses Unlikely/Toss-up/Lean/Likely vs Strong/Mixed/Weak everywhere else.
- **Account Read** (`account-read`) — **SIX** stacked equal-weight ALL-CAPS labels (Profile Read was
  rebuilt at five) · no hero (opens on the creator's *name*) · no disclosure · forward action is a
  text link, not the cream primary.
- **Explore** (`outlier-grid`) — the tile has **no card surface**; multiplier/fit/CTA float on the
  thread background. Hero is a number. Save sits above the primary.
- 🟡 **Band primitive** — *the source of the drift.* Band colour applied **twice** (word *and*
  fraction; §1.3 says once) · no dot · its `text-2xl` coloured band word **is the hero pattern
  Simulate and Predict both copied**. Fix this one and two others get easier.
- 🟡 **Personas** — `RoomAvatars` is **hand-copied** from `proof-unit.tsx` (two copies of the flagship
  cue) · quote styling diverges from `ProofUnit` · Lens target + Show/Hide share a row (hit-area hazard).
- 🟡 **Ask** (`SkillResultCard`) — header is `text-xs`, not the contract eyebrow. Load-bearing.

### 4. Loose ends (small)

- **`Your N people`** (`10px/1.2px`) is the last off-contract label on the Reading — but it belongs to
  **`audience-lens/AmbientRoom.tsx`**, which Reading *embeds* and the ambient Room also uses (elevated
  in #257). **Do not reach across that boundary without checking the Room.**
- **`@phosphor-icons/react` is barrel-imported** (Sidebar and elsewhere) — costs **~1.4s** just to
  evaluate the module graph, which is what made `Sidebar.recent` flake. Deep per-icon imports would
  cut that *and* the app bundle. Real refactor, many files; not a flake fix. See #290.
- **72 pre-existing test failures** across `api/tools/*` route tests + `billing/quota` (`cookies()` in
  the mock-skills gate). **NOT caused by this lane** — they fail identically on a clean tree. Someone
  should own them; they make the suite useless as a gate.

---

## How to see things (use this — it is the whole point)

```bash
# dev server (this worktree)
NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3001
```

- **`/dev/cards`** — every skill card through its REAL renderer, 1:1 with the thread. Cannot drift
  from production the way a static mock would.
- **`/dev/cards#reading`** — the flagship, now with a **state switcher**: Loading · Complete · Partial ·
  Apollo-null · Empty personas · Empty heatmap · Empty segments · No-behavioral · Unavailable.
  Until 2026-07-14 **only "Complete" was ever visible to anyone** — the other eight fixtures had sat in
  the repo unrendered.
- ⚠️ **Playwright screenshots hang on this app** (ambient animations never settle). Use raw Playwright
  with `animations: 'disabled'` + a tight `clip`, or assert via `getComputedStyle` /
  `getBoundingClientRect`. Element-scoped screenshots of `/dev/cards` work fine.
- ⚠️ **Measure, don't eyeball.** Every real finding on 07-14 came from reading `getComputedStyle` off
  the rendered surface, not from looking at it. Five of the seven label stacks were invisible to the eye.
