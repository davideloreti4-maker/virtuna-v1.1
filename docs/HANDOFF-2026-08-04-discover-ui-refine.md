# HANDOFF — Discover UI refine: the card is the open work

**Branch:** merged to `main` (see §1) · **Worktree used:** `~/virtuna-slot-c` · **Dev port:** 3003
**Owner ask (verbatim, 2026-08-04):** *"cards not looking that good yet compared to sandcastles.
improve and refine the ui design for the /discover page"*

⚠️ **Merging to `main` IS deploying.** Production builds ~3s after the merge and there are no
preview URLs — branch deployments are CANCELED by `ignoreCommand`. Verify BEFORE you merge.

---

## 0. State in one screen

| | |
|---|---|
| Shipped | header de-counted · filter panel · bigger cards · subheads cut · tabs-before-search |
| **Open** | **the card visual design — the owner still judges it short of Sandcastles** |
| Surface | `/feed` → `DiscoverHub` (Outliers · Collections · Watchlist) |
| Files | `src/components/discover/{discover-hub,outliers-panel,discover-filters,collections-panel,discover-tab-bar,discover-primitives}.tsx` |
| Read layer | `src/lib/discover/corpus-reads.ts` |
| Tests | `src/components/discover/__tests__/discover-filters.test.ts` (14) + `teardown-detail.test.tsx` |

## 1. What shipped (4 commits)

1. `26076097` — header stops counting; filters become an in-page panel
2. `a0942077` — both subheads dropped; card enlarged; rail made sticky
3. `6f0293c3` — tabs moved above the search field
4. this doc

**Numbers removed from the first screen**, all three clusters: the subtitle
(`230 proven outliers · 105 collections · 408 creators`), the per-tab counts, and the counted
niche chip row (`All 230 · Content Creation 86 · … +11 more`).

**Filter panel** (`discover-filters.tsx`) — in-page, left of the grid, per the owner's Sandcastles
reference. Creator · Niche · Platform · Views · Outlier score · Engagement · Posted-in-last.
Sticky from `lg`; collapses behind a Filters button below it.

**Card** — one column fewer at every breakpoint (438×673 at 1512), hook leads at `text-body`,
platform badge top-right, one gradient scrim instead of two solid pills, meta row split.

**Tabs before search** — `query` is passed to whichever panel is mounted and each filters its own
list. There is no cross-tab search, so the field belongs under the tabs.

## 2. 🔴 THE OPEN WORK — the card still is not Sandcastles

The owner has now rejected the card twice. Do NOT re-litigate the grid, the filters or the header;
those are settled. The gap is the card's own visual design.

**Do not sketch it.** The owner stopped a sketch loop on this exact surface on 2026-08-02:
*"we wasted to much time on sketching. lets just rework the current render on the live and make it
clean and premium."* Build in `src/`, run the gates, screenshot it signed-in — that IS the sketch.

What the reference does that we do not, from the owner's screenshots:

| Sandcastles | Us today |
|---|---|
| metrics as **discrete pill chips** under the title — `1203.6x` · `👁 25M` · `☀ 0%`, each tinted | one grey concatenated line: `@handle  61K · 2mo ago` |
| title is a **caption/description**, one line, tight | the spoken hook, 2 lines, `min-h-[2.75em]` |
| handle and date on their **own row** above the chips | handle shares the row with the metrics |
| light surface, chips carry the colour | dark surface, colour only on the ▲ multiplier |
| the outlier multiplier is a **chip in the row**, not an overlay on the cover | overlaid top-left on a scrim |

`discover-primitives.tsx` already exports a `Chip` with a `proven` tone and a `MultiplierChip` that
encodes the honesty rules. **`OutlierCard` hand-rolls its own badge instead of using them** — that
is the natural seam for a chip row. Reuse the primitive; do not roll a third variant.
See [[skill-cards-hierarchy-not-deletion]]: every card head on this project comes from a shared
primitive, and hand-rolling one is how the surface drifted last time.

Data available on `CorpusVideo` for chips: `views`, `multiplier`, `engagement` (fraction, 531/532),
`platform`, `postedAt`, `handle`, `niche`, `archetype`. `follower_count` is **0/532 — empty**.

## 3. Honesty rules that constrain any redesign

These are not style choices. They are the shipped gate, imported not re-rolled.

- **A row with no baseline makes NO claim.** 136 of 532 rows have `multiplier === null`. Never
  render `0×` for them. `MultiplierChip` renders `curated` instead — use it.
- **Above 100× is a thin-baseline artifact** (corpus max 20,154×). Excluded from the feed pool,
  flagged inside collections, never shown in proven green.
- **`matchesFilters` excludes null-multiplier rows** from a touched outlier range rather than
  scoring them zero. Covered by test — do not "fix" it to include them.
- **`engagement` is a FRACTION (0.041), the control is PERCENT (4.1).** A direct comparison is
  wrong by 100× and still renders a plausible grid. Covered by test.
- **The corpus is FROZEN** — newest post 2026-06-10, one bulk insert, 8 of 11 cron routes not in
  `vercel.json`. Any "trending / this week / fresh" framing would be a lie. This is why
  "Posted in last" defaults to **years**, and why the grid footer states the newest-video date.
- **Engagement is capped at 25% in the UI** — the corpus maximum is 24%, so the reference's
  0–100% range leaves three quarters of the track dead.

## 4. Measured corpus facts (2026-08-04, all 532 rows)

```
rows 532 · extracted 524 · creators 413
views          532/532   691 → 879,300,000
engagement     531/532   0 → 0.24          (max 24%)
multiplier     396/532   0.4 → 20,154
posted_at      532/532   2020-05-05 → 2026-06-10
platform       instagram 333 (63%) · tiktok 177 (33%) · youtube 22 (4%)
follower_count 0/532     EMPTY — no follower chip is possible
niche 17 · format 20 · hook_archetype 13 · visual_hook 6 · editing_style 30
```

⚠️ `corpus-reads.ts` deliberately does NOT select `why_it_works` or the taxonomy columns — they are
DETAIL fields fetched per-row by `app/actions/discover/teardown.ts`. Shipping all 524 cost 38KB
gzip for text nothing rendered. If a chip needs `format`/`visual_hook`, widen the select
deliberately and measure the payload.

## 5. Traps that will cost you time

- **`npm test` is fake here** — use `node ./node_modules/vitest/vitest.mjs run`. And never pipe it
  into `tail`: a pipeline returns TAIL's exit code, which is always 0. That faked a green gate on
  this very lane once.
- **slot-c carries vitest 4.1.10 against trunk's 4.0.18.** A non-zero exit with **0 failures** is
  expected: 3 pre-existing unhandled rejections in `composer.test.tsx:2013`. Judge by the FAILURE
  COUNT, not the exit code. Baseline on `main`: 457 files / 5054 tests / 0 failures / 3 errors.
- **A wandering ~5.5s failure set is the machine, not the code.** `composer-fold-on-close` and
  `composer-stop-disc` time out under load and pass in 3.5s together in isolation. Reproduce in
  isolation before believing any failure.
- **Playwright screenshots hang on this app** — the ambient animations never settle. Use raw
  Playwright with `animations:'disabled'`, `caret:'hide'`, and `domcontentloaded` (NEVER
  `networkidle` — the HMR socket never settles).
- **Verify on a PRODUCTION build.** Dev StrictMode double-invokes effects and fakes broken funnels.
  `npm run build && npx next start --port 3003`.
- **The path guard pins Edit/Write to the session's worktree.** Write scratch scripts with a Bash
  heredoc, not the Write tool, if they live outside it.

## 6. Verification recipe (signed-in, no browser login needed)

`/feed` is under the `(app)` group, so it needs a real session. `e2e/auth.setup.ts` works again,
but minting the cookie directly is faster and does not drive a browser:

```
POST {NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password
  headers apikey + Authorization: Bearer <ANON>,  body {email, password}
→ cookie  sb-<projectRef>-auth-token = 'base64-' + base64url(JSON.stringify(session))
  (~2635 chars, one chunk; chunk at 3180 into .0/.1 if longer)
```

Credentials are in `~/virtuna-slot-c/.env.local` (`E2E_USER_EMAIL` / `E2E_USER_PASSWORD`).
⚠️ It is a REAL PRODUCTION account — dev and prod share one Supabase project.

Working scripts from this session (regenerate if gone — scratchpads are session-scoped):
`shoot-feed.mjs` (screenshot + console errors), `drive-filters.mjs` (asserts filters narrow),
`mobile.mjs` (390/834 breakpoints + overflow).

## 7. Do NOT

- Re-add counts to the header, the tabs, or the niche row.
- Re-add the subheads under the Discover h1 or the Collections headings.
- Remove the FAILURE subtitles — they are the only way the surface reports an unreadable corpus.
- Derive collections from the teardown taxonomy columns. `teardown_collections` is the curated
  source of truth; deriving produced a worse, different 82 once already.
- Sort collections by multiplier — the least trustworthy rows would lead every list. Sort by views.
- Widen `PageShell` globally. The 1200px override is scoped to Discover; reading surfaces want 880.

## 8. Kickoff

Read §2 and §3, then look at the live surface before changing anything:

```
cd ~/virtuna-slot-c && git switch -c task/discover-card-refine origin/main
npm run build && npx next start --port 3003    # then mint the cookie per §6
```

Build the card refinement in `outliers-panel.tsx` + `discover-primitives.tsx`, screenshot it
signed-in at 1512 and 390, and show the owner the real surface — not a mockup.
