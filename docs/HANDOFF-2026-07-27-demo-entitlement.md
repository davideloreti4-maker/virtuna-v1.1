# Handoff — the demo entitlement (2026-07-27, session 10)

**Worktree:** `~/virtuna-onboarding` · **Branch:** `milestone/onboarding` · **Tip:** `31c1685a`
**Green:** suite 426 files / 4,703 (flags off) · 4,704 (flags on) / **0 fail BOTH ways** · `tsc` 0 · lint 0
(the same 3 pre-existing composer unhandled-rejections — `stream.start()` returns undefined under the
composer test's mock; unrelated to billing, present on the stashed baseline too)

> Reads on top of `HANDOFF-2026-07-27-funnel-audit-and-demo-entitlement.md` (session 9), whose §2 is
> the job this session did. §0 of that doc (**never audit this funnel on `next dev`**) still governs.

---

## 0. What shipped — 4 commits

### `4320950f` — the gate takes the USER (structural, behaviour-neutral)

`creditGate(supabase, user.id, action, log?, cost?, opts?)` carried `isAnonymous` in an optional
**sixth** argument, and eleven of the twelve paid routes never passed it. The gate now takes the user
object (`QuotaUser = { id, is_anonymous? }`), so anonymity is impossible to drop without a type error.

- `tsc` found the twelfth caller grep had missed: `/api/subscription`'s balance readout.
- Proven behaviour-neutral by running the full suite on the **stashed** tree: byte-identical
  4661 passed / 42 skipped / 3 errors.
- `route-wiring.test.ts` now asserts the user object at all eleven sites **and** that no site passes a
  bare `user.id`.

### `bd2115c5` — the demo is ONE free Test, not a wallet

- **`DEMO_ACTION` (score) is free once**, decided by `countActionRuns` — a HEAD count of delivered
  `reading_events` rows (`mode`, `billed`). Delivery-only: a Test that died mid-pipeline charged
  nothing and no longer spends the entitlement. **All-time**, not windowed — once per identity.
- **Every other action refuses `trial_required`** (new wire reason). That refusal takes **no count at
  all**: not a balance question ⇒ nothing to measure, nothing to fail open on, and `used` stays 0.
- Wall copy is the owner's framing; the dialog gets its own title, **"That one needs the trial"**,
  instead of falling into "You don't have a plan yet" (an anonymous visitor is tier `free`, no plan).
- **Bug fixed in passing:** `isDemo` was `is_anonymous` alone, so a visitor who had PAID but not yet
  claimed their email — the funnel's own post-checkout window — got the 10-credit demo pool instead of
  the trial's 50, and was refused the verdict they had just bought. `isDemo` now means anonymous AND
  unentitled. Either way the session stays metered regardless of `BILLING_ENFORCE_QUOTA`: $1 without
  an email must not buy the engine.
- Preserved deliberately: fail **CLOSED** for the demo, **OPEN** for real customers.

### `a1d81f80` — chat's back door to the paid engine, closed for the /go visitor

`CHAT_AGENT_DISPATCH` is **default ON** (shipped 2026-07-17 — its own doc-comment still says "default
OFF"), and `chat-agent-loop.ts` runs `generate_ideas` / `generate_hooks` / `write_script` **in-process**
from the FREE chat route: the pipelines behind three gated routes, reached without their gates. The
route now binds `FREE_SKILL_TOOLS` (derived by `!paid`, so a new paid skill is walled the day it is
added) for a sealed visitor — `deps.skills` drives both what the model is offered and what the loop
executes, so the filter is the whole fix. `request_input` stays bound: its submit POSTs
`/api/tools/read`, which is gated, so that path ends at the real wall.

### `31c1685a` — the paywall stops arriving with a futile retry underneath

Measured on a prod build: the trial wall opened **on top of** an inline `SkillRunError` reading
*"Couldn't finish that run. The generation or SIM-1 pass dropped out. Tap to retry — nothing was
charged."* Wrong in every clause for a refusal, and the retry gets the same 402 forever.
`credit-wall.ts` already said the caller "should stop its own error theatrics" — prose, not mechanism.
`CreditWallRefusal` (flag-identified, not `instanceof`) makes it one: the 402 branch throws it, the
catch returns on it, `finally` still resets the stream. Applied to all five paid stream hooks
(8 sites). A **non-quota** failure still draws its inline error — pinned by a second test per hook,
because that dead-end is the funnel's honest one (session 9's `050271df`).

---

## 1. Verified LIVE on a production build

`npm run build` + `next start -p 3000` with `NEXT_PUBLIC_AMBIENT_V2=true AMBIENT_V2_ENABLED=true`,
walked as a **fresh anonymous visitor** (JWT `sub` checked, `is_anonymous: true`). Scripts in
`.scratch/`: `verify-demo-entitlement.mjs`, `verify-wall-dialog.mjs`. **No engine spend anywhere.**

| Probe | Result |
|---|---|
| 11 paid routes, POSTed from the page | **10/11 → 402 `reason: "trial_required"`** + the platform copy |
| `/api/tools/simulate` | 403 `verdict_sealed` — the seal wall fires BEFORE the gate (see §2) |
| `/api/analyze` with a deliberately invalid body | **400, not 402** ⇒ the free Test is ADMITTED (the gate runs before the Zod parse, so this proves admission without running the engine) |
| `/api/subscription` | `used 0 · limit 10 · enforced true` — the demo standing, honestly |
| Start tile → send | dialog: **"That one needs the trial"** / "$1 unlocks the whole platform for 3 days — every skill, 50 credits." / `Start for $1`; **thread behind it: just the composer** |

**Against the live DB (read-only, service role):** `reading_events` really carries `mode='score',
billed=true` rows (10, from real runs 2026-07-14 → 07-26), the exact predicate `countActionRuns`
issues returns 10 for the owner's account, and RLS on the table has a SELECT policy
`user_id = auth.uid()` for PUBLIC roles — so the request's own client **can** see its rows. That
mattered: had the policy been service-only, the count would have returned a silent 0 under RLS and
**every** visitor would have had unlimited free Tests. Mocks cannot show that.

**NOT proven live:** "a delivered run forecloses the second Test". It needs a real billed engine run;
the decision logic and the count filters are unit-tested, and the predicate is verified against live
data, but the loop has not been closed end-to-end.

---

## 2. 🔴 Open — two of these are owner calls on the money path

1. **Chat-dispatched skill runs are never gated or billed for a REAL CUSTOMER.** The only leash in
   `chat-agent-loop.ts` is a per-turn RUN COUNT (`maxSkillRuns = 2`), not the meter. So the day
   `BILLING_ENFORCE_QUOTA` flips on, a Creator with zero credits left still gets ideas, hooks and
   scripts by asking chat for them, and the ledger records nothing. Fixing it means plumbing the
   supabase client + user + `billUsage` into what is a pure engine module today — and a decision about
   whether a chat-dispatched run bills at its own price. `a1d81f80` only closed the anonymous half.
2. **`/api/account-read` has no gate and no bill at all** — and it is the ONE Start tile that fires on
   tap ("Read my recent posts"), whose own comment says "it spends a Reading". It runs the same 1–3 min
   Apify profile scrape as calibration. It is not in `CREDIT_COSTS`, so gating it is a **pricing
   decision**, not a refactor. Harmless for the /go visitor (no personal audience ⇒ no handle ⇒ honest
   thin fallback, no scrape), real money for customers.
3. **`/api/tools/simulate` + `/api/tools/react` refuse anonymous sessions with `403 verdict_sealed`,
   before the credit gate.** Money-safe (refused before spend) but no client renders that slug, so it
   would surface as a raw error rather than the trial wall. Unreachable in the UI today: both verbs sit
   behind `HORIZONTAL_ENABLED = false`. Left alone on purpose — the seal is its own mechanism.
4. **A refused send loses the visitor's typed topic** (the field clears and the echoed turn unmounts,
   quota and non-quota alike). Pre-existing; restoring the draft is its own change.
5. Carried from session 9, untouched: 🔴 **hero window owner verdict** · email-claim return marker ·
   `/home/loading.tsx` blink · reaper + webhook (reconnect-gated) · the happy path past a successful
   read (needs a real billed run; `.env.local` has no Whop vars, so checkout 503s locally).

---

## 3. Landmines (new this session)

- **`noUnusedParameters` is on**, so a signature cannot be widened one commit ahead of its use. That is
  why the `action` threading and the demo semantics had to land together, and why the mechanical
  refactor was proven safe by re-running the suite on the stashed tree instead.
- **A Supabase HEAD count has no terminal call** — `.select(…, { count: 'exact', head: true }).eq().eq()`
  is awaited off the BUILDER. Every stub for it must be a **thenable**; a chain-mock that only resolves
  on `.gte()` throws mid-chain, and for the demo that throw means **fail CLOSED → a 402**. That is
  exactly how it broke the analyze route's three seal tests (they read 402 where they wanted 200).
- **`credit-wall.ts` is mocked by nobody** (checked) — safe to add exports to, unlike
  `use-analysis-flow`/`use-analysis-stream`. Still verify before adding one.
- Timestamps in test fixtures: a trial window starting "today at 10:00Z" is NOT active at 09:0x UTC.
  Two paid-anon tests failed on exactly that. Use an unambiguous past date.
- Carried: `npm test` is FAKE (`node ./node_modules/vitest/vitest.mjs run`, BOTH flag ways) ·
  `npx eslint` dies intermittently (`node node_modules/eslint/bin/eslint.js`) · Playwright scripts go in
  `.scratch/` and import from `@playwright/test` · THREE worktrees serve /go — this one is **:3000**.

## 4. Scratch scripts added (`.scratch/`, git-ignored)

| Script | What it does |
|---|---|
| `verify-demo-entitlement.mjs` | fresh anon session → probes all 11 paid routes, the analyze admission, `/api/subscription`. No spend. |
| `verify-wall-dialog.mjs` | taps a Start tile as an anon visitor, asserts the wall's heading/copy/door AND that nothing futile sits behind it; shoots `wall-trial-required.png` |
