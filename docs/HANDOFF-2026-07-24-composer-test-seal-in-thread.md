# Handoff — Composer video-Test seals in-thread (2026-07-24)

**Status: ✅ SHIPPED + MERGED to `main` (`45297788`, GREEN). Live billed E2E verified.**
Branch `design/ambient-audience-v2` (FF-merged into `main`; branch tip == main tip).

---

## What shipped

The composer's **Test** path used to `router.push('/analyze/[id]')` the moment the `started`
SSE flipped `analysisId` (1–3s). It now **stays in-thread for the whole Max run** and, on
`phase: 'complete'`, POSTs the analysisId to `/api/tools/test/card` — the cheap adapter that
turns the persisted analysis row into the honest **video-test-card** and drops it in the open
thread (`createOpenThreadLazy` + `insertMessage`, server-side). `reloadChatThread()` then
surfaces that card through `PersistedThreadStream`. **No navigate-out.** Test now behaves 1:1
with every other skill (owner contract: "all skills 1:1 in thread"), mirroring the already-shipped
in-thread `UploadField` (`input-request-block.tsx`) exactly — same seal, same degrade.

This closes ranked NEXT item #3 from the thread-unification handoff.

## Files (4)

| File | Change |
|------|--------|
| `src/components/thread/use-test-run-stages.ts` | **NEW** — extracted the 3-step run-capsule spine (elapsed-floor stage progression, `SKILL_RUN_META.test.plan` names) so BOTH Test entry points share it. Previously private to `input-request-block.tsx`. |
| `src/components/thread/input-request-block.tsx` | Imports the shared hook; dropped its local `useTestRunStages` + `TEST_STEP_FALLBACK_MS` copies and the now-unused `StageState` import. |
| `src/components/app/home/composer.tsx` | `pendingNavRef` → `pendingSealRef`; **navigate-on-id effect replaced by a seal-on-complete effect**; `carding` state; in-flight `testSubmitTurn` renders `ProgressChecklist` (the spine) instead of a bare spinner. |
| `src/components/app/home/__tests__/composer-navigate-guard.test.tsx` | Rewritten for the new contract (seals on complete, navigates only on degrade, hydration/chip guards hold). Drives `phase` + a `fetch` mock for the seal POST. |

## How the seal path works (composer.tsx)

1. **Submit** (Test branch of `handleSubmit`, file OR TikTok URL): stages the clip to Supabase
   (file path) → `pendingSealRef.current = true; sealHandledRef.current = false` → `stream.start(...)`.
   No nav armed. `captureUserTurn(...)` drives the optimistic echo + the run spine.
2. **Seal-on-complete effect** (replaces the old navigate-on-id effect, ~L1455):
   fires when `stream.phase === 'complete' && stream.analysisId && pendingSealRef.current &&
   !sealHandledRef.current`. Sets `sealHandledRef`, clears `pendingSealRef`, then:
   - `POST /api/tools/test/card { analysisId }`
   - `!res.ok || data.degraded` → **`router.push('/analyze/[id]')`** (honest fallback: nothing
     to card in-thread → the full frame-by-frame page). Same on a thrown/network error.
   - success → `await reloadChatThread()` (surfaces the card in the unified stream).
   - `carding` toggles the card-adapter tail on the spine.
3. **In-flight UI** (`testSubmitPending` / `testSubmitTurn`, ~L2387): staging shows a lone
   spinner ("Uploading your video…"); once `analyzing`/`reconnecting`/`polling`/`carding`, the
   `ProgressChecklist` 3-step spine carries the ~2-min wait (same plan names as `/analyze`).

## 🔑 Invariants respected (don't break)

- **Hydration-sourced completes never seal.** `pendingSealRef` is armed ONLY in `handleSubmit`'s
  Test branch — a permalink/hydration `analysisId` that surfaces via `useAnalysisStream` (or a chip
  click) never seals or navigates. This is the same guard rationale as the old `pendingNavRef`.
  Tests cover both (hydration-no-seal, chip-no-seal).
- **Seal is Test-exclusive.** Idea/hooks/script/remix/explore/simulate/predict branches must never
  arm `pendingSealRef` or call `stream.start` (comments updated to the new ref name).
- **Card renders through the unified stream** — no `show*View` / `hasThread` changes (respects the
  documented thread-unification tears).
- The degrade fallback to `/analyze/[id]` is the ONLY surviving navigate-out, and only when the
  route says there's genuinely no craft material to card.

## Live E2E (billed, verified)

- Uploaded the UAT clip via the composer Test drop zone → real `POST /api/analyze` (`input_mode:
  video_upload`), `analysisId -pCnMyJKF6zz`, pipeline complete in **83s** (`cost_cents 2.15`).
- `POST /api/tools/test/card 200` fired on complete.
- **Card sealed in-thread on `/home`** (no navigate): `[data-card-id]` present, craft read
  ("The craft is here"), director's fixes incl. a **grounded** ProofReceipt (`@tom 27.4× · 39.8M`),
  working/not-working ledger, `Simulate with your audience →` CTA.
- The `deriveFixGroundingQueries` grounding path fired live (real corpus receipt attached).
- ⚠️ Known dev-only noise: `filmstrip trigger failed {error: fetch failed}` — a localhost
  self-fetch quirk in `next dev`, best-effort/non-fatal, filmstrip still renders from persisted
  keyframes on the card. Not a regression.

## Gates

- `tsc --noEmit`: **0 errors**
- `eslint` (touched files): **0 errors** (3 pre-existing composer warns: 2 unused-disable at
  L1891/L1920 + 1 exhaustive-deps at L2177 — all pre-existing, not mine)
- Full vitest suite: **4454 passed / 0 failed** (41 skipped)

## Follow-ups (not done, deliberate)

1. **"Simulate with your audience →"** on the sealed card still links to `/analyze/[id]` as the
   INTERIM reception surface until the parallel Sim session ships — swap the href then
   (same follow-up already tracked in `test-vs-simulation-split`).
2. `/analyze` route not yet dissolved (unchanged by this work — the composer just stops routing
   there on the happy path; it's still the degrade fallback + the card's Simulate door).
3. Minor: the sealed card carries no "you asked" user-turn bubble (the route inserts only the
   assistant block; Test isn't in `USER_TURN_TOOLS`). Matches the in-thread UploadField. The
   optimistic echo disappears when the spine ends. Acceptable — the card is self-describing.
4. Swap-on-switch flicker (~50-150ms) — pre-existing, unrelated, still open from thread-unification.
