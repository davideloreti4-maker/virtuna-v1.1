# Handoff — Phase 4 Outcome Loop (2026-07-06)

Cold-start handoff for the next session. The **outcome loop (predicted → posted → measured →
reconciled → recalibrate) is now live and user-reachable** on Apify/clockworks. This doc is the
consolidated record; per-fact detail lives in memory `the-room-phase3-built.md`.

## TL;DR

Phase 4 was **~80% already built** (a full `src/lib/flywheel/` backend + `outcome_signatures` /
`reconciliations` tables + two live API routes) and **dead at one line** — the outcome scrape
called the retired `apidojo/tiktok-scraper-api` actor. This session revived it and built the
missing UI. **The loop now works end-to-end.**

Composio is still **blocked** (TikTok+IG business verification not granted) → the loop runs on
**Apify/clockworks, TikTok-only**. Composio remains the future fidelity upgrade (private
retention/audience-match) when verification clears.

## Shipped this session (all merged to `main`)

| PR | Commit | What |
|----|--------|------|
| #169 | `75104f2d` | audience-switch re-warm — dock switch re-sims /start sections; producers cache-first |
| #171 | `47d7f144` | **apidojo→clockworks** single-post metric scrape (unbroke the flywheel) |
| #174 | `b8c1fc94` | **capture entry point** — `OutcomeCapture` on /start (paste posted URL) |
| #175 | `b8a32e92` | **inline predicted-vs-actual readout** at capture (the moat moment) |
| #176 | `d8506e90` | **/start "the loop" section → real** (retired the last mock chrome) |

## Architecture — how the loop works now

1. **Predict (pin).** The `hooks` + `ideas` skill runners pin the rank-1 candidate's predicted
   disposition vector → `outcome_signatures` (`pinPredictedSignature`, `predicted-pin.ts`), keyed
   by `audience_id` (`analysis_id` is usually null; **video analysis does NOT pin**).
2. **Capture (measure).** `OutcomeCapture` (`src/components/surfaces/sections/outcome-capture.tsx`,
   mounted on /start under Daily ideas) → `useOutcomeSignature` → `POST /api/outcomes/signature`:
   scrape the posted URL's public metrics (`scrapeSinglePostMetrics`, **clockworks**) → build a
   realized signature → reconcile vs the pinned prediction → write `reconciliations` row.
3. **Readout (payoff).** The `done` SSE event now carries `{ predicted, realized, metrics }`; the
   component shows an honest **match %** (`buildOutcomeReadout`, `src/lib/flywheel/outcome-readout.ts`)
   + a plain standout + the real public numbers.
4. **The loop (accrual).** `/start` reads recent `reconciliations` SSR
   (`listRecentReconciliations`) → `buildLoopReceipts`/`buildLoopAccuracy`
   (`src/lib/flywheel/loop-summary.ts`) → `TheLoop` renders receipts + running avg match %, with an
   honest empty state.
5. **Recalibrate.** `confidence-gate.ts` (N≥5) → `propose.ts` → `/api/flywheel/proposals`. The
   `RecalibrationNudge` component is **built but mounted nowhere** (see below).

### Key honesty decisions (don't regress these)
- **Attribution is audience-scoped v1** (owner-approved). Pins are rank-1 + audience-keyed, so
  reconciliation matches *the audience's latest un-realized prediction*, not a specific card. Copy
  is deliberately audience-level ("how your people reacted"). The endpoint refuses to reconcile
  without a pinned prediction → the loop only ever touches pre-tested content by construction.
- **Match % is renormalized like-for-like.** `realizedSignature` normalizes over only the channels
  public metrics can measure; `buildOutcomeReadout` renormalizes the predicted vector over that
  same support before a total-variation match % — never the skewed raw divergence. Guards: <2
  measured dispositions or a zero-sum support → no % shown (never a misleading number).
- **Public-only, TikTok-only.** No private retention/link-clicks (those are creator-supplied or
  need OAuth). Match % is scoped in copy to "what we can see."

## What's left (all optional; the loop works without them)

1. **Per-card pin ids → precise per-post attribution.** Today's pins carry no stable content id, so
   attribution is audience-coarse. Give each pinned idea/hook a stable id threaded through capture.
2. **Mount `RecalibrationNudge`** (`src/components/flywheel/recalibration-nudge.tsx`, built, unmounted)
   + `/api/flywheel/proposals` (live) so confirmed weight proposals surface to the user.
3. **Per-receipt real numbers** in the loop — join `reconciliations` → `outcome_signatures`
   (`platform_post_url`, `posted_at`, `raw_metrics`) so each receipt shows views/saves + a link.
4. **Retire dead mock fields.** `getMockStartPage`'s `receipts`/`accuracy` + the `Receipt`/`Accuracy`
   types in `mock-room.ts` are now unused (TheLoop reads real data). Trivial cleanup.
5. **IG support** — no clockworks IG single-post metrics actor wired; TikTok only. Revisit with
   Composio or an IG actor.

## Gotchas / environment

- **Dev server:** `NODE_OPTIONS=--max-old-space-size=4096 node ./node_modules/next/dist/bin/next dev -p <port>`
  (the `npx next` wrapper breaks; a background `&`+compound can get the process killed — run it as a
  sole background command).
- **Dep drift (recurring):** `@upstash/ratelimit@2.0.8` + `@upstash/redis@1.38.0` keep vanishing from
  `node_modules` (gitignored lockfile / caret drift) → `next build` fails with `Cannot find module`.
  Restore: `npm install @upstash/ratelimit@2.0.8 @upstash/redis@1.38.0 --no-save` (exact versions, no
  package.json churn). See memory `deps-pinning-gitignored-lockfile`.
- **Tests:** `node ./node_modules/vitest/vitest.mjs run <path>` (npm test / bare vitest print fake
  PASS(0)). Live browser verify via the e2e user `e2e-test@virtuna.local` (Playwright profile is
  already logged in); force the briefing with `/start?first=0`.
- **tsc baseline:** ~21 pre-existing errors (test-fixture `Audience.mode` drift) — unrelated; verify
  "0 new in touched files", not "0 total".
- **NOT live-verified:** the live `scrape→readout` path (needs a real Apify scrape + a matching
  pinned prediction). All derivations are unit-tested; UI states browser-verified except the
  populated capture-done + populated loop (need real captured reconciliations).

## Where things are

- Flywheel backend: `src/lib/flywheel/` (outcome-repo · signature · realized-signature · reconcile ·
  reconciliation-repo · confidence-gate · recalibration · propose · **outcome-readout** ·
  **loop-summary**).
- Capture UI: `src/components/surfaces/sections/outcome-capture.tsx` + hook
  `src/hooks/queries/use-outcome-signature.ts`.
- Loop UI: `src/components/surfaces/sections/the-loop.tsx`, wired in `src/app/(app)/start/page.tsx`.
- API: `POST /api/outcomes/signature` (capture) · `GET|POST /api/flywheel/proposals` (recalibrate).
- Scrape provider: `src/lib/scraping/apify-provider.ts` (`scrapeSinglePostMetrics` → clockworks).
- Memory SSOT: `the-room-phase3-built.md` (2026-07-06 a/b/c/d entries).
