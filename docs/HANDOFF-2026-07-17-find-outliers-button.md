# Handoff — "Find new outliers" button, end-to-end on all 3 grounded skills

**Date:** 2026-07-17
**Status:** ✅ SHIPPED — 2 PRs merged to `main`. One open thread (a live-verify, below).
**PRs:** #322 (`6ed8e44c`, hooks) · #323 (`1ab65df6`, ideas + script)

---

## Why

Grounding's live outlier scrape was made **explicit-only** in #319 (`allowScrape`, default
false) to stop a silent Apify bill on cache miss. But **nothing set `allowScrape`** — it was a
dead switch (the `society_id` anti-pattern: a flag nothing upstream writes). The scrape was off
with no way to turn it on. This session built the affordance that reaches it.

## The design (the load-bearing idea)

**The server decides whether a scrape is worth offering; the glass never guesses.**

`gatherCorpusForRun` now returns `scrapeAvailable` — true **only** when a run degraded (or
grounded on a thin partial) *purely because* `allowScrape` was false **on a scrapable platform**.
It is false on a full cache hit (already grounded), a non-scrapable platform (IG/YT — nothing to
reach for), grounding-off (button would no-op), or while a scrape is already running. The route
forwards it as `event: outliers { available }`, and the client renders the "Find new outliers"
button only when told. No client-side guessing about grounding state or platform.

Tapping it re-runs the **same subject** with `allowScrape: true` → the scrape runs → its
write-through repopulates the corpus cache → this run is grounded, and the **next** normal run on
that subject is grounded for free (the gather-once / walk-many loop, driven by intent).

## The chain (identical across hooks / ideas / script)

| Layer | File(s) |
|---|---|
| `scrapeAvailable` computed | `src/lib/grounding/gather-for-run.ts` (shared) |
| runner: `allowScrape` in → `scrapeAvailable` out | `src/lib/tools/runners/{hooks,ideas,script}-runner.ts` |
| route: parse `body.allowScrape === true`, emit `outliers` event | `src/app/api/tools/{hooks,ideas,script}/route.ts` |
| stream: `start()` carries `allowScrape`; `findOutliers()` replays last send; reads `outliers` → `outliersAvailable` | `src/hooks/queries/use-{hooks,ideas,script}-stream.ts` |
| offer UI (shared) | `src/components/thread/outliers-offer.tsx` |
| thread view: `outliersAvailable` + `onFindOutliers` → `<OutliersOffer>` | `src/components/thread/{hooks,ideas,script}-thread-view.tsx` |
| composer wiring | `src/components/app/home/composer.tsx` |
| previews | `src/app/(app)/dev/cards/page.tsx` (`#hooks-outliers`, `#ideas-outliers`, `#script-outliers`) |

### Notes for the next reader
- **`findOutliers()` must replay the REAL ask** (and, for script, the **anchor**) — not `""`.
  The scrape query is derived from ask→anchor→niche, so replaying Auto ("") would scrape on the
  niche only and lose the subject. Each stream stores `lastRunRef` on every `start()`.
- **`allowScrape` is never stored** in `lastRunRef` — each `findOutliers()` sets it explicitly, so
  a scrape authorization can't leak into a later normal run.
- **`OutliersOffer` is a single shared component** — one source of truth for the money-action copy.
  hooks-thread-view imports it now instead of defining it locally.
- The offer's CTA uses `bg-[var(--color-action)]` (cream primary, dark glyph) — the same treatment
  as the ForwardChip primary. Authorizing a spend is a genuine liveness moment, so the primary
  action dosage is warranted. `role="status"` (a note), never the error `role="alert"`.
- Route coercion is strict: `body.allowScrape === true` — anything non-`true` is false.
- The gate lives at the scrape fall-through in `gatherCorpusForRun`, **not** on `finalize()`
  (finalize also runs on the cache-hit path).

## Verification (done, not claimed)

- **tsc:** 0 new errors (5 pre-existing `src/lib/brain` `@gltf-transform` errors only).
- **Tests:** 583 runner/route/grounding/thread green, including new guards:
  - `src/lib/grounding/__tests__/gather-for-run.test.ts` — `scrapeAvailable` semantics (6 cases).
  - `src/components/thread/__tests__/hooks-thread-view-warnings.test.tsx` — hooks OutliersOffer.
  - `src/components/thread/__tests__/outliers-offer-views.test.tsx` — parametrized ideas + script.
  - All UI guards proven **FAIL-FIRST** (button tests go red when the render is removed).
- **Lint:** 0 errors.
- **Browser (authed as `e2e-test@virtuna.local`):** `/dev/cards` shows **3** outlier CTAs
  (hooks + ideas + script); each renders `role="status"`, aria-label "Find new outliers with a
  live scan", tappable, on-brand. (Raw Playwright, `channel: 'chrome'`, element-clip — /dev/cards
  doesn't hang.)

## ▶ Open thread (the ONLY thing left)

**Live-verify the Apify scrape on tap.** The whole chain is unit- + browser-verified, but the
actual `tap → allowScrape:true → gatherAndExtract → real Apify scrape → cache write-through` has
**not** been exercised — it costs real Apify money and needs a calibrated-TikTok run that misses
cache. It rides the already-proven #284 moat scrape path, so risk is low, but it is
plumbing-verified, not live-verified. To do it: a real TikTok run on a subject the corpus is thin
on, tap "Find new outliers", confirm (a) the scrape runs, (b) the cards come back grounded, and
(c) a second normal run on the same subject is grounded for free (proves the write-through).

## Gotchas confirmed this session

- **`git checkout <file>` reverts to HEAD, not to your uncommitted edits.** Mid-session I used it
  to restore two thread views after a fail-first probe — it wiped the uncommitted OutliersOffer
  edits back to main's version. The **fail-first guard tests caught it** (they stayed red), and the
  edits were re-applied. Use a `cp` backup for uncommitted files, not `git checkout`.
- Dev server: start from this worktree, `rm -rf .next` first after any branch switch. Launch:
  `NODE_OPTIONS='--max-old-space-size=2048' node ./node_modules/next/dist/bin/next dev -p 3000`
  (detach via `python os.fork+setsid`). `/dev/cards` is auth-gated.
- Playwright browser: repo's `node_modules/playwright` expects build 1208 but only 1228 is
  installed → launch with `{ channel: 'chrome' }` (system Chrome) to sidestep the mismatch.
