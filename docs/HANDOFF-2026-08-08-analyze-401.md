# Handoff — the `/api/analyze` 401, and the guard that could not see it

**Date:** 2026-08-08 · **Worktree:** `~/virtuna-unhappy-paths` · **Branch:** `lane/analyze-401`
**Read §1 first.** It is the only part that is state; everything below it is why.

Predecessor: `docs/HANDOFF-2026-08-07-unhappy-paths.md` (the offline + expired-session halves).

---

## §1 — Where this actually is

| | |
|---|---|
| **PR #456** | **OPEN** — https://github.com/davideloreti4-maker/virtuna-v1.1/pull/456 |
| Branch | `lane/analyze-401`, tip `62ae73fb`, pushed |
| vs `origin/main` | **0 behind, 3 ahead** — `main` still `1be28832` at last measure |
| Gates at the tip | `tsc` 0 · **5480 passed / 0 failed** (baseline 5460 + 20) · `next build` exit 0 |
| Browser | **40/40**, prod build, signed in, two native viewports, **zero engine spend** |

Evidence: `docs/superpowers/plans/2026-08-08-analyze-401-walk-evidence.md`

**Done:** the fix, the guard re-key, a second defect found on the way (§4), the walk.
**Open:** merge #456 (merging deploys, ~4 min), then the four deferred gaps in §5.

⚠️ **The repo's `post-commit` hook auto-pushes.** `git push` answering "Everything up-to-date"
after three fresh commits is that hook, not a failure — but verify with `git ls-remote` rather
than trusting the message either way.

---

## §2 — The defect

`/api/analyze` returns 401 at `route.ts:400`, but `use-analysis-stream.ts` had no
`reportSession401`. A dead session on the composer's flagship paid run fell through
`resolveRunError` to the route's `{ error: "Unauthorized" }` slug and rendered the generic
*"The generation or SIM-1 pass dropped out"* — the exact defect #455 removed from the other
twenty sites, left on the priciest action in the product.

The fix is the same one line the other eight stream hooks carry, placed **above** the 402 branch:

```ts
if (reportSession401(res.status)) throw new SessionExpiredRefusal();
```

The route refuses above `getCreditQuotaVerdict`, so nothing was metered and no 402 payload can
exist on that response. That ordering is what entitles the copy to say "nothing was charged" — it
is a fact about the route, not a hope.

---

## §3 — 🔑 The guard lesson (the durable part of this session)

The coverage guard enumerated **files that already call `reportCredit402`** and demanded a matching
401 check in each. That set looks identical to "the paid run paths" and is not:
`use-analysis-stream` handles its 402 through local `quotaError` state feeding the composer's own
`ReadingLimitDialog` mount, makes zero such calls, and was therefore invisible to the guard while
owning the priciest fetch in the product.

⚠️ **The blind spot had already been recorded when that guard was written.** The offline half hit
it first and rewrote `every-stream-classifies.test.ts` to read the DIRECTORY because of it. The
session guard was then keyed off the call-site list anyway and inherited the identical hole.

> **A guard keyed off what files ALREADY do is a tautology — it can only confirm what is there.**
> Key it off what they are OBLIGED to do, derived from something the client cannot silently opt
> out of.

Here that is the **route**. Re-keyed to "client fetch sites whose route runs `creditGate` /
`getCreditQuotaVerdict`" — 23 paid sites, 19 covered, 4 deferred (§5).

Mechanics worth keeping:
- **Per-site proximity, not per-file counting.** 60-line window; the widest real one is 35
  (`AmbientOverviewRail`). A per-file count is defeated by a decoy call far from its fetch —
  mutation M4 proves it.
- **`stripComments` must preserve line numbers.** Blank a block comment character-by-character;
  deleting it shifts every line below a docstring upward and silently widens the window.
- **The `UNRESOLVABLE` pin.** Two fetch URLs are built from a partial template expression and
  cannot be resolved to a route file. Pinned as a subset ceiling so a computed URL cannot become a
  place for a paid fetch to hide from the guard.
- **Five mutations**, each applied, **confirmed landed**, run and reverted — all caught. M1/M2/M4
  fire the real assertion as well as the vacuity rail; verified by re-running M1 alone and reading
  all three failures rather than the first.

---

## §4 — A second defect found on the way

The composer's Test failure turn (`testFailedTurn`) is a **bespoke** error surface: it hand-writes
its headline and body instead of resolving them through `runErrorCopy`, so it never learned rule 1
of `lib/net/run-failure.ts` (cause beats skill).

Its default body blames *"a private, deleted or region-locked post"*. That is the likeliest truth
for a `/go` visitor and worth keeping — and it is an accusation against a file that is fine when
the run died on a dead session or a dropped connection. **It has been shown for offline runs since
#454 merged**, because `use-analysis-stream` has written the offline sentinel that whole time.

Now a named cause overrules it; an unnamed failure keeps it. `runFailureCauseOf()` was added to
`run-failure.ts` for the read-back, and `runErrorCopy` routes through it so the two cannot disagree
about what counts as a named cause.

**Review focus for #456:** this is the highest-blast-radius change in the diff — the `/go` funnel's
own failure path.

---

## §5 — What is deferred, and why it is safe to defer

Four paid sites still have no 401 check, named in `KNOWN_GAPS` and asserted as an **exact set**:
fixing one fails the guard until it is delisted, and a fifth fails it too. The list can only shrink.

| Site | Surface today | Why deferred |
|---|---|---|
| `hooks/queries/use-analyze.ts` | dead — `useAnalyze` has no consumers, only a barrel export | unreachable; consider deleting instead |
| `app/(app)/feed/discover/discover-client.tsx` | bare `catch {}` | silently empty feed — needs copy |
| `components/app/home/home-starter.tsx` | fire-and-forget, no surface | nothing wrong is said — needs a surface first |
| `components/audience-lens/PersonaChatDrawer.tsx` | bespoke `setError(PERSONA_CHAT_ERROR)` | generic string — needs copy |

**None of them makes a wrong accusation**, which is the defect class this lane exists for. That
asymmetry is the whole argument for splitting them out. Each needs its own copy decision — an
owner call — rather than the one-line hook fix.

---

## §6 — ⚠️ Two false passes the gates could not see

Both were green-shaped and wrong. Neither would have been caught by any gate.

**1. Five assertions passing against a run that never fired.** The first walk read 16/26.
`/api/analyze` was never called at all — `page.keyboard.press("Enter")` submitted nothing, because
the field was never focused and **the send button is aria-labelled by the ARMED TOOL**
(`"Simulate"` for Test), not `"Send"`. Against that empty non-event, *"does NOT accuse the video"*,
*"does NOT show the generic copy"* and *"does NOT leak the slug"* all passed, because nothing had
rendered. **Assert the event fired before asserting anything about it.**

**2. The dialog satisfying every claim about the inline turn.** `says the session ended` was
asserted against `document.body.innerText` — which the **dialog alone** satisfies. Every claim
about the inline failure turn passed without the inline turn being looked at once. Caught by
**looking at the screenshot**, not by any probe. The two surfaces are separate elements — the Radix
`[role="dialog"]` and the `SkillRunError` `[role="alert"]` outside it — and must be queried
separately.

Both surfaces do render, which is the intended design (owner decision, recorded in the predecessor
handoff) and not a default: with the dialog up, "signed out" appears twice; dismissing it leaves
the inline turn honest about itself, with a retry labelled "Retry after signing in".

---

## §7 — Smaller things measured, worth not re-deriving

- **`tsc` piped into `tail` reports `tail`'s exit code.** It looked like a pass while `tsc` had a
  real error (`Object is possibly 'undefined'` in the new guard). Run it bare. vitest does not
  typecheck, so the full suite was green with the error present.
- **The composer does NOT clear its textarea on the Test path.** `unhappy-paths-walk` records
  optimistic clearing ~150ms after submit; measured identical before submit and after the refusal
  here. The arm chip reverts (the one-shot disarm), the URL stays. Nothing depends on it — the
  dialog was separately checked for not promising the draft survives — but the earlier note is not
  universal.
- **Mobile layout measured, not eyeballed.** The dialog looked cut off at the right edge under the
  backdrop blur and was not: `scrollWidth === clientWidth === 390` **and** the alert's own box is
  `x:26 → right:364`. Both checks were taken because an equal scrollWidth alone is not proof — an
  ancestor can clip instead of scrolling.
- **At 390px the sidebar is collapsed**, so "New Thread" is off-viewport and a click on it times
  out. Make a clean-thread step best-effort, and make the assertions target elements rather than
  page text so a noisy scrollback cannot satisfy one.
