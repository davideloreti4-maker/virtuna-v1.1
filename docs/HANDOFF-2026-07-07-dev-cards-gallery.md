# Handoff — `/dev/cards` thread design gallery (2026-07-07)

**Branch:** shipped via PR from `lane/explore-a` → `main`
**Status:** ✅ complete, verified in Playwright, merged
**Dev server:** `NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev --port 3001`

## What this is

A **dev-only design workbench** at **`/dev/cards`** that renders **every skill output a thread can produce**, 1:1 with the real chat, so you can edit thread UI and see all card designs update live (HMR) — no need to generate content or run each skill. Replaces the stale static sketch `.planning/sketches/all-skill-cards-refined.html` (which had drifted — e.g. missing the account-read analyzed-video refinement).

**Why it can't go stale:** it imports the *real* renderer components and flows every block through the live `validateBlock()` dispatch (`MessageBlocks`) + mounts the real `*-thread-view` wrappers. Change a component → the gallery changes with it. A colocated test fails if any fixture stops validating.

URL-only (no nav link — intentional, per owner).

## Coverage (15 sections)

**Group A — real skill thread views, just-completed state** (user turn → intro → progress receipt → cards → outro/CTAs):
`ideas · hooks · script · remix · chat (Ask) · explore · account-read`

**Group C — the Test/real-video Reading surface:** the full `<Reading>` (score drivers, The Audience, the Room replay, follow-up chat), via a new additive `overrideData` prop.

**Group B — in-thread blocks via `MessageBlocks`:** `profile-read (Profile) · reaction-distribution (Simulate) · prediction-gauge (Predict) · multi-audience-read (Text Read) · band · markdown`

## Files

- `src/app/(app)/dev/cards/page.tsx` — the gallery. Group A mounts each `*-thread-view` with the fresh-run-complete prop combo (`streamingBlocks` populated + `isStreaming:false` + done `stages` + `followupText`). Group C mounts `<Reading overrideData={…}>`. Group B renders `<MessageBlocks>`.
- `src/app/(app)/dev/cards/fixtures.ts` — **typed to the block schemas** (`IdeaCardBlock[]`, etc.), so wrong props fail `tsc`. Cover/avatar images use `picsum.photos` seeds; one analyzed-video omits its cover to exercise the placeholder-degrade path.
- `src/app/(app)/dev/cards/__tests__/fixtures.test.ts` — drift guard: validates every fixture block through the live `BLOCK_REGISTRY` (17 tests).
- `src/components/reading/reading.tsx` — **only production change.** Added additive `overrideData?: PredictionResult` prop. Default `undefined` → the live `/analyze/[id]` path is byte-identical (the permalink hook still runs, result used as before). This is also a legit test/preview seam.

## Key implementation facts (for the next editor)

- **Backgrounds** use `bg-background` (`--color-charcoal-app` `#1f1f1e`) = the real chat surface. (Earlier draft used `#1a1a19` composer tone — corrected.)
- Thread views **self-provide their contexts** (`PlatformContext`, `HookTestContext`, `ScriptTestContext`, `RemixDevelopContext`), so they mount standalone. `SaveAffordance` needs the QueryClient → that's why the route lives in the `(app)` group (inherits `providers.tsx`).
- The progress **receipt** ("✓ Ran your audience · N steps") only renders when `stages` is non-empty + `!isStreaming` — fixtures pass a done-stage array via `doneStages([...])`.
- **Reading's `ReadingChat` is `position: fixed`** — the gallery wraps the Reading section in a `transform: translateZ(0)` + `overflow-hidden` div so it docks inside the section instead of floating over the whole page. If you embed `<Reading>` elsewhere, remember this.

## Verification done

- Playwright (headless Chromium, authenticated as `e2e-test@virtuna.local`, :3001): **STATUS 200, all 14 sections present, 0 UnsupportedBlocks, 0 console errors, 0 page errors.** Eyeballed ideas / reading / account / explore — all render 1:1; account shows the full refinement (avatar + verified header, "POSTS WE READ" cover strip w/ view counts incl. expired-cover placeholder, format-mix bars, track record).
- `tsc --noEmit` clean · 17/17 drift-guard tests pass.
- e2e test user provisioning: `./node_modules/.bin/tsx e2e/create-test-user.ts` (idempotent; creds `e2e-test@virtuna.local` / `e2e-test-password-2026`).

## Known gaps / follow-ups (all intentional, not bugs)

1. **Content is fixture data** — layout/style is exact; the words are representative samples. To make content literally production-emitted, capture a real run's stored blocks from the DB and swap them in.
2. **URL-only** — no sidebar/nav link by design.
3. The Reading **hero** (poster + score gauge) sits above the drivers; verified drivers/audience/Room render — give the hero a glance if you touch `reading-hero.tsx`.
4. Could add **idle/empty + error/streaming states** per thread view (currently shows the just-completed state only).

## Gotchas hit this session

- Shell `grep`/`rg` are shadowed by an `rtk` wrapper that chokes on some flags — use `command grep`.
- `tsx` binary is a shell wrapper; run it directly (`./node_modules/.bin/tsx`), not via `node`.
- Node ESM ignores `NODE_PATH` — throwaway Playwright scripts must live inside the repo to resolve `@playwright/test`.
- Auto-wip Stop hook is **disabled** (owner removed it 2026-07-07) — no orphan-commit hazard this session.
