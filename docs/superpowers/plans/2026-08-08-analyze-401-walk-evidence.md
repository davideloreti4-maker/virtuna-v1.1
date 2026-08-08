# Verification evidence — the `/api/analyze` 401, and the guard re-key

**Date:** 2026-08-08 · **Branch:** `lane/analyze-401` · **Worktree:** `~/virtuna-unhappy-paths`
**Build:** `next build` exit 0, served by `next start` on :3005. **Never dev.**

**Result: 40/40**, signed in, two natively-opened viewports, **zero engine spend**.

The one paid path PR #455 missed. `/api/analyze` returns 401 at `route.ts:400`, but
`use-analysis-stream.ts` had no `reportSession401`, so a dead session on the composer's flagship
paid run rendered the generic *"The generation or SIM-1 pass dropped out"*.

---

## §1 — Gates

| Gate | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | exit 0, no output |
| `./node_modules/.bin/vitest run` | **5480 passed / 0 failed**, 42 skipped (baseline 5460 + 20 new) |
| `npm run build` | exit 0 |
| Mojibake signatures (`Ã`, `â€`, `Â`) in every changed + new file | **0** |

`tsc` caught one error (`Object is possibly 'undefined'` in the new guard) that the full vitest run
did not — vitest does not typecheck. The first `tsc` invocation was piped into `tail`, so the shell
reported `tail`'s exit code and looked like a pass; re-run bare for the real status.

## §2 — How the 401 was produced without spending

The e2e account is a **real production account** on the shared Supabase project with
`BILLING_ENFORCE_QUOTA` on. The walk never completes a run: it mints a session, lands, **clears the
auth cookies**, and only then presses send. `route.ts:400` refuses above `getCreditQuotaVerdict` and
above every engine call, so the refusal is free.

That ordering is the reason the copy may say "nothing was charged" — it is a fact about the route,
not a hope. Recorded per viewport: the only `/api/analyze` call is the refused one, status 401.

## §3 — The false pass that the assertions could not see

The first walk reported **16/26**, and five of those sixteen were worthless. `/api/analyze` was
never called at all — `page.keyboard.press("Enter")` submitted nothing, because the field was never
focused and the send button is aria-labelled by the **armed tool** (`"Simulate"` for Test), not
`"Send"`. Against that empty non-event, *"does NOT accuse the video"*, *"does NOT show the generic
copy"* and *"does NOT leak the slug"* all passed, because nothing had rendered.

Fixed by asserting the event itself before anything about it: *"the run actually fired —
/api/analyze was called"*, which aborts the walk when there is no request to reason about.

Second false pass, caught by **looking at the screenshot**: `says the session ended` was asserted
against `document.body.innerText`, which the **dialog alone** satisfies. Every claim about the
*inline* failure turn was passing without the inline turn being looked at once. The rewrite queries
the two surfaces as separate elements — the Radix `[role="dialog"]` and the `SkillRunError`
`[role="alert"]` outside it — and asserts each on its own text.

Both surfaces do render, which is the intended design and not a default:

```
signedOutCount with dialog up: 2
dialog: "You’ve been signed out. / Your session ended before that run started, so nothing
         was charged. Sign in again to pick up where you left off. / Sign in again"
alert:  "You’ve been signed out. / Your session ended before that run started — nothing was
         charged. Sign in again to pick up where you left off. / Retry →"
after dismissing the dialog: 1  (the inline turn stays honest about itself)
```

## §4 — What was checked, both viewports

Each viewport gets its **own context opened at that size**.

| # | Check | Desktop 1440×900 | Mobile 390×844 |
|---|---|---|---|
| 1 | landed signed in on `/home` | ✅ | ✅ |
| 2 | cookies cleared before any run fired | ✅ 0 left | ✅ 0 left |
| 3 | composer armed for the video Test | ✅ | ✅ |
| 4 | the run actually fired — `/api/analyze` called | ✅ 401 | ✅ 401 |
| 5 | `/api/analyze` answered 401 | ✅ | ✅ |
| 6 | session dialog mounted (queried off `document`) | ✅ | ✅ |
| 7 | **inline** failure turn exists, separate from the dialog | ✅ | ✅ |
| 8 | dialog explains the session, not the credit wall | ✅ | ✅ |
| 9 | dialog does not promise the draft is still in the box | ✅ | ✅ |
| 10 | inline turn says the session ended | ✅ | ✅ |
| 11 | inline turn does **not** accuse the video | ✅ | ✅ |
| 12 | inline turn does **not** show the generic engine copy | ✅ | ✅ |
| 13 | inline turn promises nothing was charged | ✅ | ✅ |
| 14 | retry reads `"Retry after signing in"` | ✅ | ✅ |
| 15 | nowhere on the page accuses the video | ✅ | ✅ |
| 16 | nowhere on the page leaks `Unauthorized` | ✅ | ✅ |
| 17 | the words are still on screen as the sent turn | ✅ | ✅ |
| 18 | nothing navigated away | ✅ `/home` | ✅ `/home` |
| 19 | no second analyze call after the refusal | ✅ | ✅ |
| 20 | no uncaught page errors | ✅ | ✅ |

Mobile layout measured, not eyeballed — the dialog looked cut off at the right edge under the
backdrop blur, and was not: `documentElement.scrollWidth === clientWidth === 390`, **and** the
alert's own box is `x:26 → right:364` in a 390 viewport (26px gutters both sides). Both checks were
taken because an equal scrollWidth alone is not proof — an ancestor can clip instead of scrolling.

## §5 — A recorded finding that does not reproduce on this path

`unhappy-paths-walk` records the composer clearing its textarea ~150ms after submit (optimistic
clearing). **On the Test path it does not clear**: measured identical before submit and after the
refusal, `"https://www.tiktok.com/@creator/video/7460113355847362834"`. The arm chip reverts (the
one-shot disarm) but the URL stays in the box.

Nothing here depends on it — the dialog was already checked for not promising the draft survives,
and it does not make that promise — but the earlier note should not be read as universal.

## §6 — The guard, mutation-tested

`src/lib/auth/__tests__/session-401-coverage.test.ts` was re-keyed from "files that call
`reportCredit402`" to "client fetch sites whose ROUTE runs the credit gate". Five mutations, each
applied, **confirmed landed**, run, and reverted:

| Mutation | Result |
|---|---|
| M1 the fix itself reverted (`use-analysis-stream` loses its 401 check) | **CAUGHT** — `use-analysis-stream.ts:338 (/api/analyze)` named in the message |
| M2 a covered hook silently stops reporting (`use-script-stream`) | **CAUGHT** |
| M3 a known gap gets fixed but is left in `KNOWN_GAPS` | **CAUGHT** — the ratchet forces the list to shrink |
| M4 the 401 check drifts beyond the 60-line window, with a decoy call far below | **CAUGHT** — per-file counting would have passed this |
| M5 a new paid fetch site added with no 401 check | **CAUGHT** |

M1, M2 and M4 each fire the *real* assertion as well as the vacuity rail — verified by re-running
M1 alone and reading all three failures, not just the first.

## §7 — Scope actually shipped

The re-keyed guard sees **23 paid client fetch sites**; 19 now covered, **4 deferred** and named in
`KNOWN_GAPS`, asserted as an exact set so it can only shrink:

- `hooks/queries/use-analyze.ts` — dead: `useAnalyze` has no consumers, only a barrel export
- `app/(app)/feed/discover/discover-client.tsx` — a bare `catch {}`
- `components/app/home/home-starter.tsx` — fire-and-forget, no error surface
- `components/audience-lens/PersonaChatDrawer.tsx` — bespoke `setError(PERSONA_CHAT_ERROR)`

Each needs its own copy decision rather than the one-line hook fix, which is why they were deferred
rather than pattern-matched.

## §8 — A second defect fixed on the way

The composer's Test failure turn is a **bespoke** error surface: it hand-writes copy instead of
resolving it through `runErrorCopy`, so it never learned "cause beats skill". Its default body —
*"A private, deleted or region-locked post will do that"* — was being shown for **offline** runs
too, and had been since the offline half merged (#454). `use-analysis-stream` has written the
offline sentinel that whole time. Both causes now overrule the skill copy; an unnamed failure keeps
it, because for a `/go` visitor a dead TikTok link really is the likeliest truth.
