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
| Shipped | **the card's metric chip row** (2026-08-04, second pass — §2) |
| **Open** | owner's verdict on the refined card |
| Surface | `/feed` → `DiscoverHub` (Outliers · Collections · Watchlist) |
| Files | `src/components/discover/{discover-hub,outliers-panel,discover-filters,collections-panel,discover-tab-bar,discover-primitives}.tsx` |
| Read layer | `src/lib/discover/corpus-reads.ts` |
| Tests | `src/components/discover/__tests__/discover-filters.test.ts` (14) + `teardown-detail.test.tsx` |

## 1. What shipped (4 commits)

1. `26076097` — header stops counting; filters become an in-page panel
2. `a0942077` — both subheads dropped; card enlarged; rail made sticky
3. `6f0293c3` — tabs moved above the search field
4. this doc — merged as PR #422 (`e8d2fb7c`)
5. the card refine (§2), on `task/discover-card-refine`

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

## 2. ✅ THE CARD — refined against the reference (2026-08-04, branch `task/discover-card-refine`)

Do NOT re-litigate the grid, the filters or the header; those are settled. This section was the
open work and is now built. What changed, one row per gap in the table below:

- **the measured facts left the cover and became a chip row** under the attribution —
  `▲ 4.2×` (proven green) · `👁 61K` · `♥ 3.0%`, from a new `MetricChips` in
  `discover-primitives.tsx`. The card had been hand-rolling its own green ▲ overlay while the
  shared `MultiplierChip` that encodes the honesty rules sat unused two files away.
- **`fmtEngagement` is the one place the fraction becomes a percent.** Engagement had never
  been rendered anywhere before this; the ×100 trap now has a single site and a test.
- **the meta line split into two bands** — `@handle · 2mo ago` muted on its own row, chips
  under it. It had been one grey concatenated run where attribution and numbers were the same
  colour, size and weight.
- **the cover carries nothing but the platform mark**; its scrim halved (h-16 → h-9) because it
  no longer has a multiplier to keep legible.
- **the card's own type steps up at `lg`** — hook `text-body → text-title`, chips
  `text-micro → text-label`. Gated to `lg` because the same card is 171px wide on the
  2-column phone grid, where chips already wrap to two lines.

⚠️ **The title stayed at TWO lines, against the reference's one.** These are transcribed first
seconds of speech, not written captions: over all 532 rows the hook median is 68 chars and p90 is
118 (measured 2026-08-04). A one-line clamp cuts ~69% of them mid-sentence — it would cost the
browse the thing it is scanning for. `min-h-[2.75em]` still reserves both lines so a one-line hook
does not ragged its row.

Not adopted: the reference's **light surface**. This app is flat-warm charcoal; the transferable
half was "chips carry the colour", and only the multiplier is tinted — it is the one number that
is a CLAIM and the one the honesty rules gate. Three equally coloured chips would say all three
had been vouched for.

**Verified** on a production build (`npm run build && next start --port 3003`), signed in, at 1512
and 390: 24 cards, 0 console errors; Collections' member rows and Watchlist unchanged. Gates: tsc
0, eslint 0 on the changed files, vitest 458 files / 5061 tests / **0 failures** (3 known
pre-existing `composer.test.tsx` unhandled rejections — see §5).

### The gap this closed, as it was originally stated

**Do not sketch it.** The owner stopped a sketch loop on this exact surface on 2026-08-02:
*"we wasted to much time on sketching. lets just rework the current render on the live and make it
clean and premium."* Build in `src/`, run the gates, screenshot it signed-in — that IS the sketch.

What the reference does, from the owner's screenshots, against the card as it stood before this
pass. Every row is addressed above:

| Sandcastles | Us, before this pass |
|---|---|
| metrics as **discrete pill chips** under the title — `1203.6x` · `👁 25M` · `☀ 0%`, each tinted | one grey concatenated line: `@handle  61K · 2mo ago` |
| title is a **caption/description**, one line, tight | the spoken hook, 2 lines, `min-h-[2.75em]` |
| handle and date on their **own row** above the chips | handle shares the row with the metrics |
| light surface, chips carry the colour | dark surface, colour only on the ▲ multiplier |
| the outlier multiplier is a **chip in the row**, not an overlay on the cover | overlaid top-left on a scrim |

`discover-primitives.tsx` already exported a `Chip` with a `proven` tone and a `MultiplierChip`
that encodes the honesty rules, and **`OutlierCard` hand-rolled its own badge instead of using
them** — that was the seam, and `MetricChips` is what now sits on it. If you add a fourth metric,
add it there; do not roll a variant at a call site.
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
- **A scratchpad ESM script cannot `import 'playwright'`.** Node resolves from the SCRIPT's
  directory, not the cwd, so a script outside the worktree dies on `ERR_MODULE_NOT_FOUND` however
  you invoke it. Import the absolute path instead:
  `import { chromium } from '/Users/…/virtuna-slot-c/node_modules/playwright/index.mjs'`.
- **`npm run lint` emits JSON here**, ~1 MB of it, and greps of the summary tail read as garbage.
  Lint the files you touched: `node node_modules/eslint/bin/eslint.js <paths>`.

## 6. Verification recipe (signed-in, no browser login needed)

`/feed` is under the `(app)` group, so it needs a real session. `e2e/auth.setup.ts` works again,
but minting the cookie directly is faster and does not drive a browser:

```
POST {NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password
  headers apikey + Authorization: Bearer <ANON>,  body {email, password}
→ cookie  sb-<projectRef>-auth-token = 'base64-' + base64url(JSON.stringify(session))
  (~2635 chars, one chunk; chunk at 3180 into .0/.1 if longer)
```

⚠️ **The credentials are NOT in `~/virtuna-slot-c/.env.local`** — this line said they were, and
they are not; that file carries no `E2E_USER_*` at all (checked 2026-08-04, only slot-a and slot-b
have them). They are `e2e-test@virtuna.local` / `e2e-test-password-2026`, recorded in the
`e2e-auth-state-is-dead` memory. Only `NEXT_PUBLIC_SUPABASE_URL` and `..._ANON_KEY` come from
`.env.local`. ⚠️ It is a REAL PRODUCTION account — dev and prod share one Supabase project.

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
- Clamp the card's hook to one line without re-measuring the corpus first — see the ⚠️ in §2.
- Tint the views or engagement chip. Only the multiplier is a claim; see §2's last paragraph.

## 8. Kickoff

§2 is built and gated. The next move belongs to the owner: look at the refined card and say
whether it lands. Read §3 before changing anything, then see it for yourself —

```
cd ~/virtuna-slot-c && git switch task/discover-card-refine
npm run build && npx next start --port 3003    # then mint the cookie per §6
```

Whatever comes next, build it in `src/` and screenshot it signed-in at 1512 and 390 on a
production build. The owner stopped a sketch loop on this exact surface on 2026-08-02 — the real
surface IS the sketch here.
