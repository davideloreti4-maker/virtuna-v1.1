# HANDOFF — the sim rail's dead drill, closed. And what it was really about.

**Written** 2026-08-05 · **Worktree** `~/virtuna-slot-b` · **Shipped as** PR **#437** (`07d4d352`, LIVE)
**Supersedes** `docs/HANDOFF-2026-08-04-sim-rail-population-hole.md` — several of that document's
claims were wrong. Read this instead; the corrections are in §3.

---

## 1. The one-line answer

**The engine was healthy the whole time. The account was pinned to a pre-signature audience row.**

The owner reported: *"the brain, viewer, engagement dont seem to open up… does the api call even
fire?"* Yes it fires, it is a real Qwen simulation, and on an audience built by the **current**
calibrate path all three depth pages open. What was broken was the *account*, not the product —
`user_settings.last_audience_id` pointed at "Fitness Creators" (created 2026-06-20, `signature: null`),
which predates the signature pipeline and can never produce a population.

Measured end-to-end with real model calls (`scripts/fired-sim-drill-harness.ts`):

| audience | created | result |
|---|---|---|
| `@mrbeast` | 2026-08-04 | N=1000 · 10 segments · Brain ✓ Engagement ✓ Audience ✓ |
| `@zachking` | 2026-07-14 | N=1000 · 10 segments · all ✓ |
| General (virtual) | — | N=1000 · 10 segments · all ✓ |
| `Maya`, `Fitness Creators` | ≤2026-07-02 | `wantPopulation: false` → nothing opens |

---

## 2. What shipped (PR #437, merged + deployed)

Two defects, both the same disease — **the product claiming more than it measured.**

### 2a. The silence
A run that cannot project returned `population: null`, and the row still sealed, because `pct` comes
from the flash reaction which is **independent** of the projection. So the Overview looked healthy
while the depth behind it was dead. Three stacked silences hid it:

```
characterizeContent(...).catch(() => null)     // route.ts
try { reactPopulation(...) } catch { null }    // route.ts
if (snap?.population) …; else if (!snap) …     // openStimulus — the sealed-but-no-population case
                                               //   was an EMPTY ELSE
```

Now: all three log (`module: tools.react`), and the warn distinguishes the two legacy shapes
(`no_signature_and_not_general` vs `signature_has_no_population_axes`). The board no longer dresses
such a row as a door — `noDepth` rides the sealed row, the button is `disabled`, and a `verdict only`
tag names the state. This follows the rule `AmbientDetail`'s tab strip already stated: **say "nothing
behind this" BEFORE the tap, not after.**

### 2b. The unmeasured rank
`#N` on a hook card came from sorting on `hook.personaStops` — the hook-writing model's estimate of
its **own** hooks (`hooks-runner.ts:669`: *"the WRITER'S self-estimate, not a measured room reaction"*).
Printing "#1" asserted a ranking nothing measured. Dropped on projected cards; a measured card keeps
its numeral. **The order is untouched** — an order claims sequence, a numeral claims a measurement.
This finished a retirement the board (`AmbientOverview.tsx:46`) and the sim door (`sim-door.tsx:118`)
had already performed on the same number.

> 🔑 **A defect the suite could not see.** The card's `aria-label` still read `Hook #1: …` on a
> projected card — a screen reader was told the rank the sighted card had just stopped claiming.
> Found by opening a browser and measuring the DOM, with 5,298 tests green. Same lesson as the
> thread-scroll bug: **wire-level verification cannot see a surface.**

---

## 3. ⚠️ Corrections to the 2026-08-04 handoff — do not re-derive these

- Its §2 table has **three** rows. There is a **fourth** case: a signature present but with **no
  population axes** (`mode: general` — no `topic_vocab`, no persona with `reaction`). Its proposed
  one-line fix at `route.ts:257` would **not** have covered it, because `audience?.signature ?? (…)`
  never fires when `signature` is non-null.
- **`is_general: true` never exists in the DB.** Every row is `false`; General is a virtual constant
  (`audience-repo.ts:51`, `user_id: "__virtual__"`). That fallback branch can only ever rescue the
  virtual audience — it can never rescue a persisted row.
- Its §2 inference is now **proved**, not inferred: the three working seals carry archetype totals
  `lurker 220 · tough_crowd 140 · high_engager 100 · saver 80 · sharer 60 · purposeful_viewer 50`,
  an exact match for `GENERAL_BASELINE_SIGNATURE`'s `.22/.14/.10/.08/.06/.05`.
- **The break date was wrong.** Each seal carries its own `at`; the handoff read the thread's
  `updated_at`. The real line is 2026-07-26 ~15:16, not 07-28.
- Its two 2026-07-26 "populated" seals are **N=10 video-path** seals, not `reactPopulation` (N=1000).
- The inert `else` is annotated **"owner-caught"** — a deliberate decision firing in a case it was
  not written for, not an oversight.
- **§5's design question is settled and did NOT reverse the 2026-07-23 call.** The owner confirmed:
  *"when the user selects simulate and configures their run in arm … a real call happens at that
  point."* That is exactly what `fireSim` already does. **Config-first stands.**

---

## 4. Owner decisions recorded this session

1. **Legacy audiences deleted.** Four rows (`Fitness Creators`, `test`, `Marcus Reyes`, `Maya`)
   removed for user `31c5a91c`. Backed up first. `@zachking` kept — it is from the current pipeline
   and projects fine. All four FKs are `ON DELETE SET NULL`, so nothing cascaded.
   `last_audience_id` is now NULL → resolves to General → **projects**.
2. **The /10 is dead and stays dead.** Confirmed by the owner; verified in code — `sim-door.tsx:118`
   renders band/fraction only when `!projected`, so a current card shows neither.
3. **Two fixtures added to `/dev/cards`**, because neither changed state was representable:
   `hooks-projected` (the shape every generated card has had since 2026-07-22 — the existing `Hooks`
   fixture has no `provenance`, so the gallery was showing a MEASURED card as canonical), and a
   sealed seal with no `population` in `ROOM_V2_SEALS`.

---

## 5. Repo + deployment state at close

- `origin/main` = **`07d4d352`** (merge of #437). Trunk `~/virtuna-v1.1` fast-forwarded to it, clean.
- `~/virtuna-slot-b` detached at `origin/main`, clean, ready for new work.
- Vercel `dpl_6YrDks7nDp1kBJ9hgzbBd23p8yv3` — **READY, production**, sha `07d4d352`.
  `numenmachines.com` and `/go` both 200.
- ⚠️ `main` moved **three times** during this session under a co-session (#438 mobile Library, #439
  chat guard, then #437). Always `git fetch` + `git rev-parse` before acting.

### Worktree survey — "is work from other worktrees missing?"

**No work is lost.** Nothing uncommitted is at risk: only `~/virtuna-slot-a` (16 untracked
`zz-*`/sketch preview artifacts — throwaway) and `~/virtuna-ui-opt` (one modified
`.planning/config.json`) are dirty. Every other worktree is clean with zero stashes.

**65 commits sit unmerged across 13 branches** (`git cherry main <branch>`, patch-id — the only tool
that answers this; `git rev-list --count` and three-dot `diff` both lie here):

| branch | commits | last | src files |
|---|---|---|---|
| `feat/audience-sim-v2` | 20 | 2026-07-17 | 51 |
| `audit/e2e-walkthrough` | 18 | 2026-07-30 | **0 (docs only)** |
| `feat/thread-cards` | 12 | 2026-07-21 | 12 |
| `feat/per-persona-ideas-script` | 3 | 2026-07-15 | 16 |
| `milestone/onboarding` | 2 | 2026-07-27 | 21 |
| `polish/cards-next` | 2 | 2026-06-27 | 13 |
| `milestone/ui-opt` | 2 | 2026-06-01 | 14 |
| `feat/grounding-reference-cards` | 2 | 2026-07-20 | 9 |
| `design/start-composer-v2` | 2 | 2026-07-20 | 8 |
| `docs/handoff-make-card-polish` | 1 | 2026-07-27 | 0 |
| `task/onboarding-ui-refinement` | 1 | 2026-08-04 | 0 |

⚠️ **A `+` from `git cherry` does NOT mean the work is valuable and unshipped.** Strong prior that
several are **superseded** — `feat/audience-sim-v2` predates the shipped ambient-v2, and
`milestone/onboarding` predates the onboarding activation that shipped as #429. `CLAUDE.md` records
that merging a superseded branch has already nearly resurrected ~51k lines of dead code once.
**This survey was not verified per-branch** — that is the open task, and it should be done branch by
branch (title-grep against `git log main` + `comm -13` of the file lists) before anything is merged
or deleted.

---

## 6. Still open, unfixed, live in prod

- **The omni read tells Apollo a 90%-dialogue video is 0% voice** — the three audio ratios sum to
  0.05. The refine that would catch it sits on the legacy Gemini schema (`types.ts:637`), not
  `qwen/schemas.ts` which is in the path. See `HANDOFF-2026-08-04-omni-modality-split.md` §7.
- **Suite flakiness.** Across six full runs, two different one-off failure sets appeared
  (`resolve-video`, then `reading.no-cut-data` + two composer files). All passed in isolation;
  `origin/main` also ran clean. Looks like parallel-load ordering. **A single red full-suite run in
  this repo should be re-run before it is believed.**

## 7. Tools left behind

- `scripts/fired-sim-drill-harness.ts` — runs the real fired path (characterize + flash panel +
  reactPopulation), feeds `buildDomainTemplate`, and evaluates `AmbientDetail`'s own tab predicates.
  Turns "do the 3 pages open" into a measurement. Add `--no-flash` to skip the paid panel call.
- `scripts/dump-audiences-backup.ts` — dumps a user's audience rows to JSON before a destructive edit.
