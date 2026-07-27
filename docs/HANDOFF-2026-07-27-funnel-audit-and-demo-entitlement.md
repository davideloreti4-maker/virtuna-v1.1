# Handoff — the funnel audit + the demo-entitlement rework (2026-07-27, session 9)

**Worktree:** `~/virtuna-onboarding` · **Branch:** `milestone/onboarding` · **Tip:** `fd05fe3c` (pushed, tree clean)
**Green:** suite 425 files / 4,662 tests / 0 fail **BOTH flag ways** · `tsc` 0 · lint 0 errors
(3 pre-existing composer warnings)

> Reads on top of `HANDOFF-2026-07-27-hero-window-and-flow.md` (session 8). The hero feedback
> trail in `HANDOFF-2026-07-27-hero-iterations.md` §3 still governs the hero.
> ⛔ `HANDOFF-2026-07-24-onboarding-funnel.md` is still the retired walkthrough.

---

## 0. 🔴 READ FIRST — the landmine that ate three hours

**Do NOT audit the funnel on `next dev`.** In dev, submitting from `/go` lands you on a `/home`
that looks catastrophically broken: no stage list, the verb reverted to `Chat`, an empty page,
no error, forever. It is **React StrictMode's double-invoke**, and it does not ship:

- The rehydrate effect (composer.tsx ~:805) sets `isFirstThreadLoadRef = false` on its first
  invoke. StrictMode then re-runs it, so the second pass enters the thread-switch wipe branch
  and executes `hasUserSelectedToolRef.current = false` (:853).
- The seed inlet (:1899) already tripped `seedConsumedRef`, so its second invoke early-returns
  and never re-sets that ref to true.
- The rehydrate fetch then resolves and `setActiveTool(restored ?? DEFAULT_TOOL)` (:966) wins —
  `DEFAULT_TOOL` is `chat`. The launched Test verb is gone and the run's UI with it.

Reproduced 3× in dev with two different scripts, including session 8's own `seam-capture.mjs`
verbatim. **Then `npm run build` + `next start` → the arrival is correct** (stage list live,
"A real video" verb, user turn echoed). Session 8's measurement was right; my first three
repros were phantoms.

**Rule for this funnel: measure against a production build.**
```bash
pkill -f "next dev -p 3000"; npm run build
nohup env NEXT_PUBLIC_AMBIENT_V2=true AMBIENT_V2_ENABLED=true npx next start -p 3000 \
  > .scratch/prod-3000.log 2>&1 &
```
(The worktree is back on `next dev -p 3000` as this handoff is written.)

---

## 1. What shipped (2 commits)

### `050271df` — a dead Test run says so (the funnel's silent dead-end)

**Measured, not inferred**: against a production build, refuse `/api/analyze` with a 500
mid-run and the entire screen wipes — progress spine, echoed link, the whole turn unmounts
and the visitor is left with an empty composer and no word of what happened.

Cause: `composer.tsx:315` does `const stream = useAnalysisStream()` and reads `phase`,
`analysisId`, `isStreaming`, `reset`, `start`, `quotaError` — and **never `stream.error`**.
Test was the ONLY skill that dropped it; hooks, ideas, script, remix and explore all render
`<SkillRunError>` off theirs. The two comments in the Test submit path (`:1859`, `:1882` —
*"stream.phase -> error transition owns the UI"*) assert a surface that was never built.

It lands on exactly the /go visitor: a private, deleted or region-locked post is an ordinary
TikTok outcome, and the page's whole promise is "paste a link, get a read".

- Renders the shared `SkillRunError` in-thread, keeping the user's echoed link, tap-to-retry.
- **"Nothing was charged" is TRUE** — `/api/analyze` calls `recordUsage` only inside its
  success branch ("BILL THE READING — inside the success branch, on purpose").
- **NOT the quota 402** — that sets `quotaError` too and the wall dialog owns it; both would
  put an inline retry under a modal that just refused them.
- **The polling-ceiling timeout is the one error where the pipeline may still be ALIVE**
  server-side, so it gets different copy and NO retry (a retry starts a second billed run).
  Discriminated on `STREAM_TIMEOUT_ERROR`, now `src/lib/engine/stream-errors.ts`.

⚠️ **Why that constant lives in its own module, not beside the hook:** ~12 suites replace
`use-analysis-stream` with a bare `vi.mock` factory. A named export added next to the hook is
missing from every one of those mocks and takes out **every Composer-mounting suite** (I did
exactly this: 7 files / 60 tests red).

Verified live: retry re-fires (2 analyze calls, spine returns, error clears, error returns on
the second failure). Test `composer-test-run-error.test.tsx` confirmed RED without the fix.

### `fd05fe3c` — the wall stops telling the /go visitor they have no plan

At the funnel's highest-intent moment the dialog opened with **"You don't have a plan yet"**
directly above its own body: *"That was your free test. $1 unlocks the simulation and 50
credits for 3 days."* An anonymous visitor is tier `free` with no plan, so they fell into the
no-plan branch — one screen after /go promised "free · no account".

The server always knew: `quota.ts` sets `reason: "demo_used"` for every anonymous refusal and
`quotaRefusalBody` forwards it verbatim, so it **has always crossed the wire** — but
`CreditQuotaExceeded.reason` was typed `"allowance" | "fair_use"`, so the one branch worth
special-casing was invisible to every client narrowing on it. Union now admits `demo_used`;
title reads "That's your free test used". The $1 door, checkout plan and trial flag: untouched.

---

## 2. 🔴 THE NEXT JOB — the demo entitlement (owner-stated, 2026-07-27)

> *"we give the demo to the user for free but to unlock the complete result/value they need to
> start their 3 day trial and unlock the complete platform"*

**That IS the intended design.** The code diverges in two places, and they are backwards from
each other.

### Divergence 1 — the demo is a 10-credit WALLET, not "one free Test"

`DEMO_CREDITS = CREDIT_COSTS.score = 10` (`lib/pricing.ts:118`). A Test costs exactly 10. The
check is `fits = used + cost <= limit` (`lib/billing/quota.ts:319`).

⇒ **One tap on "Get content ideas" (1 credit) makes it `1 + 10 > 10` and the free Test is
refused permanently.** Five of the six Start tiles do this. And the refusal then says *"That
was your free test"* (`credit-gate.ts:41`) — **to someone who never got one.** The product
lies at the conversion moment.

### Divergence 2 — only `/api/analyze` tells the gate the visitor is anonymous

`isAnonymous` is passed at exactly ONE call site: `src/app/api/analyze/route.ts:416`.
All **11** other paid routes call `creditGate(supabase, user.id, "<action>")` with no flag:

```
simulate · read · script · explore · predict · profile · hooks · refine
ideas/develop · ideas · remix/run
```

⇒ `isDemo=false` → `enforced = isQuotaEnforced()` → **BILLING_ENFORCE_QUOTA is OFF in prod** →
`refusal: null` → an anonymous visitor runs all of those **free and unmetered**. And the usage
they record (`countCreditsSince` sums real credits via the `credits_used_since` RPC) is exactly
what forecloses their free Test.

**Net: the one thing meant to be free gets blocked; the things meant to be behind the trial
run for nothing.**

### The fix, in three moves

1. **`creditGate` takes the `user` object, not `user.id`.** Anonymity stops being something a
   route can forget — omitting it becomes a compile error at all 12 sites instead of a silent
   omission. *This shape is why the bug exists; close it structurally, don't just patch 11
   calls.* Current signature (`credit-gate.ts:93`) is
   `(supabase, userId, action, log?, costOverride?, opts?)` — `opts` is 6th and optional,
   which is precisely the trap. Every one of the 11 sites already has `user` in scope.
2. **The demo stops being a wallet.** An anonymous visitor is allowed exactly ONE `score` run,
   decided by counting **prior Test runs**, not credits. Nothing else can consume it, so it
   cannot be foreclosed. Needs the `action` threaded into `getCreditQuotaVerdict`
   (`quota.ts:344`), which today receives only `cost`.
3. **Every other action refuses with the trial wall** for an anonymous visitor, instead of
   running free. Reframe `quotaRefusalMessage`'s `isDemo` branch (`credit-gate.ts:40-42`) from
   "$1 unlocks the simulation and 50 credits for 3 days" to the owner's framing: start the
   3-day trial, unlock the whole platform.

### Landmines for that job

- ⚠️ **This is the money path.** Failure modes are giving the engine away or walling paying
  customers. Wall-dialog behaviour is covered by `src/components/app/__tests__/reading-limit-dialog.test.tsx`
  (8 cases) and quota by `src/lib/billing/__tests__/`. Extend both.
- `DEMO_CREDITS`'s doc-comment in `pricing.ts:100-118` is the SSOT for the intent and will need
  rewriting — it currently describes the wallet.
- `quota.ts` fails **CLOSED** for the demo and **OPEN** for real customers, deliberately
  (`:307-316`, `:372-389`). Preserve that asymmetry.
- `reason: "demo_used"` now exists in the wire union (shipped in `fd05fe3c`) — reuse it; add a
  sibling for "this action needs the trial" rather than overloading it.

---

## 3. Still open (carried, unchanged)

1. **🔴 The hero window still needs the owner's eyes.** Reviewed at 1440 lit + settled this
   session: real Test card (77 craft, frame strip, weak-beat marker) beside the real v2
   audience rail (38.2% would stop, cohort bars), "Sample read" tag, choreography alive at the
   257px fold peek. The "abstraction" failure mode of the previous three candidates is gone.
   §3 of session 7's handoff still governs; if it misses again the lever is stronger staging,
   not another surface.
2. **First-steps surface** for a fresh anon /home visit (the starter-grid question) — largely
   subsumed by §2: today all six tiles either 402 or foreclose the Test.
3. Email-claim return marker (session 8 §2) — small, do when touching the claim dialog.
4. `/home/loading.tsx` draws the EMPTY-home furniture for <350ms for every visitor including
   returning thread-users. Shell-wide, not a funnel fix.
5. Reaper scheduling + webhook sandbox pass — owner/reconnect-gated.

**Not re-verified this session:** the happy path past a successful read (seal → $1 → checkout
→ claim → return). Needs a real billed engine run, and `.env.local` has no Whop vars so
checkout 503s locally. It stands as verified in sessions 5–6, not by this audit.

**Small open question:** no right rail was visible at 1440 during the in-flight run in my prod
captures, though session 8's notes say it mounted. Not chased.

---

## 4. Landmines (carried + new)

- 🔴 **NEW — dev StrictMode fakes a broken funnel arrival. See §0. Measure on a prod build.**
- 🔴 **NEW — `use-analysis-stream` is bare-`vi.mock`'d by ~12 suites.** Never add a named
  export beside the hook that production code imports; put shared constants in an unmocked
  module (`lib/engine/stream-errors.ts` is the precedent).
- 🔴 **NEW — run the suite BOTH flag ways before believing a UI test.** My first draft of
  `composer-test-run-error.test.tsx` passed flags-OFF while asserting **nothing** flags-ON:
  under `AMBIENT_V2_ENABLED` the thread region only renders once `hasConversationContent` is
  true, so the composer was showing the Start grid and the test was matching an absence. Land
  the funnel URL with `run=1` so a real turn exists.
- `npm test` is FAKE — `node ./node_modules/vitest/vitest.mjs run`, BOTH flag ways.
- **`npx eslint` intermittently dies with "JSON parse failed"** — that's a wrapper, not ESLint.
  Fall back to `node node_modules/eslint/bin/eslint.js <files>`. No `node_modules/.bin` here.
- **Playwright in throwaway scripts: import from `@playwright/test`.** A path-guard hook blocks
  the session scratchpad — use `.scratch/` (git-ignored).
- THREE worktrees serve /go — THIS one is :3000.
- The Playwright MCP profile persists the anon cookie; check the JWT sub.
- `.env.local` lacks ALL Whop vars — funnel checkout 503s locally.
- ⛔ Never `npx supabase config push`. ⛔ `supabase db push` is UNSAFE (48 local-only / 41
  remote-only migrations; it would recreate `threads`). Single migrations go via the SQL editor.
- Merging to main deletes 143 inherited `.planning/` files — recipe in session-4's handoff §6.
- The seeded preview thread ("Preview — tested video", `52b05aa9-…`) is still in prod DB.
- Browser walks mint throwaway anon rows in prod auth (reaper-eligible, harmless).

## 5. Scratch scripts (`.scratch/`, git-ignored)

| Script | What it does |
|---|---|
| `fold-audit.mjs` | /go fold at 1440 + 390, plus the window's fold-peek geometry |
| `audit-window.mjs` | scrolls to the hero window and shoots it settled |
| `seam-capture.mjs` | session 8's 14-frame burst of the /go → /home seam |
| `walk2.mjs` | instrumented arrival walk, samples verb + text every 2s |
| `walk-fail-modes.mjs` | `node … quota\|engine` — the two faithful 402/500 refusal shapes |
| `verify-retry.mjs` | proves the retry re-fires (asserts 2 analyze calls) |

All intercept `/api/analyze` — **no engine spend.**
