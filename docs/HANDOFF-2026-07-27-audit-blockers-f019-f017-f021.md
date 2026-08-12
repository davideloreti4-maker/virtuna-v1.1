# Handoff — the E2E audit's three blockers, fixed and live (2026-07-27)

**Status: DONE.** All three shipped to `main`, all three deployed READY to production,
all three verified in a real browser against a real DB — not just green tests.

| # | Finding | Commit | PR |
|---|---|---|---|
| F-019 | The paid video-Test card sealed into a thread the UI could never open | `d4298335` | #384 |
| F-017 | The Ideas tile armed the **paid** video Test | `f0c8a501` | #385 |
| F-021 | "Delete thread" could never succeed | `91054754` | #386 |

Findings SSOT: `docs/AUDIT-E2E-2026-07-26.md` in the `~/virtuna-e2e-audit` worktree
(branch `audit/e2e-walkthrough`). ⚠️ **That doc still lists all three as open** — it was
not updated when these landed. Read it with this handoff beside it.

Suite at the end: **4573/0** with `NEXT_PUBLIC_AMBIENT_V2=true`, **4572/0** with it off.
`tsc` clean. 14 new guards total, every one verified failing against its own pre-fix code.

---

## F-019 — a ~3-minute paid Max run completing into a blank screen

Two independent breaks, one symptom. Fixing either alone renders nothing.

**Layer 1 — the thread never materialised.** `test` was excluded from `ensureThreadForSend`,
justified by a comment predating the D-05 seal-in-thread rework (*"Test/video navigates to
/analyze and owns no chat thread"*). The active-thread pointer stayed on
`NEW_THREAD_SENTINEL` for the whole run, so every server-side `createOpenThreadLazy` minted a
**fresh row — three per run** — and the seal landed in a thread the client never pointed at.
`test` was also outside `USER_TURN_TOOLS`, so no question persisted and the thread stayed
untitled ("New chat") in the sidebar.

**Layer 2 — the Start grid rendered over the card.** `hasConversationContent` counted every
per-skill bucket but never `persistedChatTurns`, and `video-test-card` is the one block type
outside all of them — so a Test-only thread read as EMPTY and `composer.tsx:3090` mounted
`AmbientStartHome` on top of a correctly-loaded paid card. `TYPE_TO_TOOL` omitted it too.

Fixed on the **client** contract, not the server: `threads.ts:98` returning null on the
sentinel is intentional for every other flow.

**Live proof:** pointer `__new__` → `ce2a4b04`, ONE `POST /api/threads/new`, DB confirms
exactly one thread created (titled `test-30s.mp4`), seal 200 at +169 s, URL never left `/home`,
card renders → survives cold reload → **opens from the sidebar row**. The card the audit had
already stranded (`e1b47ade`, craft 76) became recoverable rather than lost.

### Traps worth keeping
- **Verifying it cheaply:** the repo ships its own fixture at
  `src/lib/engine/__tests__/fixtures/test-30s.mp4` (5.4 MB, 30 s, vertical). Upload path, no
  Apify spend, no TikTok decode gamble — and it *is* the audit's original repro.
- **Writing the layer-2 RTL guard: do NOT put a user message in the fixture.** `lastUserTurn`
  alone flips `hasConversationContent`, so the test passes against the broken build. The real
  stranded thread has ONLY the card.
- Trunk's `.env.local` has **no** `NEXT_PUBLIC_AMBIENT_V2`. Layer 2 lives behind that flag —
  without it the bug is invisible locally.

---

## F-017 — the app's primary CTA ran a paid skill

The Start grid emitted `{ id: "ideas" }`. The composer consumes tile ids as `ToolId`, where
the same skill is **`idea`**, singular. `"ideas"` matched no `handleSubmit` branch, and that
function's final `else` is the video Test — so clicking **Ideas**, typing an idea, and pasting
a TikTok URL to "make the button work" bought a SIM-1 Max run.

Three things had to agree for this to ship silently, so all three were fixed:

1. **the data** — `ambient-v2-adapters.ts:272` now emits `idea` (+ the hand-mirrored
   `start-fixture`, pinned to the registry by its own test)
2. **the cast** — `pickStartSkill` did `handleUserSelectTool(id as ToolId)`. A cast cannot
   fail, so `tsc` never saw it. It now resolves against `SKILLS` and returns early on an
   unknown id, so the worst a future tile typo can do is make its own tile inert.
3. **the drift test** — `start-registry-drift.test.ts` existed *specifically* to catch "a tile
   with a typo'd id", and was **green**.

### 🔑 The lesson: a guard aimed at the wrong SSOT certifies the bug
That test asserted `s.id in SKILL_RUN_META` — the run-capsule's **display** namespace, which
spells the skill `ideas` and therefore accepted the broken value. Nothing in the app indexes
`SKILL_RUN_META` by tile id; every consumer uses a literal key or the stream's dispatch
`skillKey`. A tile id has exactly two consumers, both `ToolId`.

**When a guard exists and the bug shipped anyway, suspect the guard's premise before its
coverage.** Re-pointed at `SKILLS` and tightened: an active tile must resolve to an **enabled**
skill; a `soon` tile must not (`ad` exists but `enabled:false`; `compare` has no ToolId).

Four comments asserted the false invariant and the grid followed them — corrected in place.

### Trap
**Drive Start tiles by their LENS (`"Concepts worth making"`), never their label.** The tile,
the skill-menu row, and any sidebar thread title beginning "ideas…" all collide on
`startsWith("Ideas")`, and the two doors behave differently — which is what hid this.

### Ordering, which was backwards from the obvious
Fixing F-019 first made F-017 **quieter**: once Test seals correctly, a mis-routed Ideas→Test
run creates a proper thread and renders a card, so the wrong-billing bug starts *looking like
it worked*. Ship that pair together.

---

## F-021 — Delete never worked, and three layers hid it

`archiveThread` writes `type: 'archived'`, but the table still declared
`CHECK (type IN ('grounded','open'))` from `20260617000000_threads_messages.sql:30`. Every
delete hit Postgres **23514** — a guaranteed 500, for every user, since the feature shipped.

The DB was only half of it:

| layer | behavior |
|---|---|
| route | no try/catch → the throw escaped as an unhandled 500 with no usable body |
| `useArchiveThread.onError` | rolled the cache back, said nothing |
| `Sidebar` catch | **empty**, justified by *"the refetch reconciles the sidebar either way"* |

The optimistic drop removed the row instantly and the rollback restored it ~2 s later, so a
hard server failure read as a **UI flicker**. That empty catch also fell through to the
active-thread cleanup, clearing the pointer for a thread that still existed — a failed delete
could strand the creator off a live thread. It returns early now.

**Applied to the live DB 2026-07-27** (owner ran the SQL). Verified after: archive succeeds,
distribution went `129 open / 0 archived` → `128 open / 1 archived`.

### 🔴 `supabase db push` is NOT safe on this project
The remote migration ledger is badly out of sync with the repo: **48 local-only, 41
remote-only**. `db push` would replay all 48 — including the migration that *creates* the
`threads` table. The schema itself is healthy; only the bookkeeping drifted. The CLI has no
single-file apply, and there is no `psql`/`pg`/DB-password in this environment, so
`20260727090000_threads_allow_archived.sql` went in via the **SQL editor**.

**This drift is its own latent problem and is exactly why F-021 survived.** It deserves a
dedicated session (`supabase migration repair --status applied <version>` to reconcile
history). Prod-metadata surgery — do not bolt it onto a bug fix.

### 🔑 Why the suite could never have caught this
Every unit test mocks the Supabase client, and **a mock has no CHECK constraint** — schema
drift is invisible to the suite by construction. The new
`src/lib/threads/__tests__/threads-type-drift.test.ts` reads the migration files and asserts
the schema permits every `type` value the code writes.

⚠️ Its own first draft scoped by *file* containing `public.threads`, which let an unrelated
table's `type` CHECK win the "last wins" race — passing for the wrong reason, the same failure
mode as F-017's drift test one fix earlier. Now scoped to the constraint itself.

### Note
`Sidebar` now requires the `ToastProvider` it always has in `(app)/layout.tsx`; its 4 test
files mounted it bare. Wrapped — including `Sidebar.recent`, where `vi.resetModules()` means
the provider must come from the **same dynamic import** or it is a different React context.

---

## Deployment

Vercel git was reconnected by the owner on 2026-07-27. Confirmed working end-to-end:
all three commits deployed `READY` to production, and the `ignoreCommand` build gate is doing
its job — every non-`main` branch deployment shows `CANCELED`, only `main` builds run.

---

## What's still open from the audit

*Reconciled against the code 2026-07-30. Each item below says whether it was re-measured or
merely carried forward, because three items on this list had already been resolved and were
still costing sessions time — one of them resolved in the OPPOSITE direction to what it asked.*

- ~~**F-014** (owner call) — delete ~8,300 lines behind the route tombstones?~~
  ✅ **OBSOLETE 2026-07-30 — decided the other way, by shipping.** PR #407 (2026-07-29)
  **reactivated** Discover and Library rather than deleting them, so there are no tombstones
  left to clear. Verified: `src/components/discover` is imported by **8 live files**
  (`feed/page.tsx`, the discover/hooks/channels clients, `discover-hub.tsx`,
  `use-outlier-grid-actions.ts`, `outlier-grid-block.tsx`, `hook-test-context.tsx`);
  `/feed` and `/library` render. `/discover` and `/competitors` are still one-liners but are
  now deliberate deep-link redirects **into** the live hub (`/feed/discover`,
  `/feed?tab=competitors`) — not stubs. Nothing to delete; no owner call needed.
- **F-015** (owner call) — the SIM-1 Flash/Max selector is wired to nobody. Bug, or unbuilt?
  ⚠️ **Carried forward, NOT re-verified.** A 2026-07-30 grep finds Flash/Max across five v2
  files (`AmbientStart`, `AmbientOverview`, `AmbientSimulate`, `start-fixture.ts`,
  `composer-controls.tsx`), which is enough to show the question needs tracing from the
  selector's handler to the run, and not enough to answer it. Treat the claim as unconfirmed
  until someone follows that path.
- **F-018 / F-020 / F-022** — minors: a failed run's error doesn't survive reload; the Test
  skill has two names across its two doors; the upload path shows a static spinner for minutes.
  ⚠️ Carried forward, not re-verified.
- **The migration ledger** — see F-021 above.
- `~/virtuna-e2e-audit`'s `AUDIT-E2E-2026-07-26.md` should be marked up with these three
  closures. ⚠️ Still true — that doc lives only on `audit/e2e-walkthrough` and still lists
  F-019/F-017/F-021 as open.

## Closed elsewhere, previously tracked as open here or in session notes

- ✅ **`/pricing` promised a $1 trial to an account that had already used one** — fixed
  `d8b0b6fa` (2026-07-27). `hasUsedTrial` is now one predicate with two callers
  (`/api/whop/checkout` denies the SKU, `/api/subscription` tells the UI what it may promise).
  Session notes listed this as open for three days after it shipped.
- ✅ **`shot-stages.tsx` captured the LEGACY room, so the how-it-works stills were stale
  against v2** — fixed `43444fec` (2026-07-27). Source and regenerated `.webp`s landed in the
  same commit; no legacy room imports remain under `src/components/offer/`.
- ✅ **`/pricing` metadata promised "a 7-day free Pro trial"** against a $1 / 3-day trial —
  found and fixed 2026-07-30 (PR #408). Same class as `d8b0b6fa` and missed by it because
  every *rendered* surface already read `TRIAL` and was correct; the stale copy survived only
  in the string the page never displays, which is also the one search results show.
