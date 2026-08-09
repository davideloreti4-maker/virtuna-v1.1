# Handoff — Phase 4 (the Audience surface) kickoff · lane/platform-concept

> **Written 2026-08-09 at the end of the Phase-3 implementation session.** Phase 3 (the report)
> is BUILT, browser-VERIFIED and pushed onto `lane/platform-concept`, stacked on Phase 2's
> PR #458. This doc is the fresh-session kickoff for Phase 4 and records the seams Phase 3 left,
> the defects it found but did not fix, and the traps that cost time.
>
> **Precedence chain is unchanged:** `docs/HANDOFF-2026-08-08-concept-v8-implementation.md`
> (SSOT — decisions, build order, cautions) → the spec (revision blocks override the body) →
> the mock (layout/anatomy ONLY). This doc ADDS Phase-3 outcomes; it overrides nothing.

## 1. What Phase 3 shipped (and where Phase 4 plugs in)

All behind `CONCEPT_V8_ENABLED` (+ requires `NEXT_PUBLIC_AMBIENT_V2=true`). 12 commits
`2150e1e6..ae9b65ba`, 21 files, +3586/−136. Plan with full task detail:
`docs/superpowers/plans/2026-08-09-composer-v8-phase-3-report.md`.

| Piece | Where | Phase-4 relevance |
|---|---|---|
| The report shell | `src/components/app/home/v8/verdict-report.tsx` — sheet `<xl` · overlay panel `≥xl` · **pinned** panel portaled into the layout's rail host | Exports **`ReportSubject`** `{id, title, personas, population?, stopPct?}` — the shape any Phase-4 surface hands the report. |
| The personas-only read | `src/lib/surfaces/v8-report.ts` (`personasToReportRead`, `buildPersonaReportTemplate`) — PURE | The Audience surface's "ten people" can reuse `ReportRead`'s grouping; it is the honest boundary on a cached Flash read. |
| The personas-only Audience tab | `src/components/app/home/v8/persona-audience-frame.tsx` | The closest existing thing to the Audience surface's people list. Reuse or extend; do not fork the voice grammar. |
| Fire-on-demand | `v8/use-fire-sim.ts` + pure `v8/fire-sim.ts` | ONE run in flight at a time (the guard IS the debounce). Recalibration must not bypass it. |
| Drill props | `AmbientDetail` gained `tabOrder` + `audienceSlot`, both default-off; `REPORT_TAB_ORDER` exported | Any Phase-4 surface that wants the drill gets the same two doors. The nav strip now self-omits when there is no back button and no pager. |
| Rail retirement | `composer.tsx` `≥xl` portal is `null` under the flag; `RoomOverlay` deleted from `v8/sub-bar.tsx` | **Done.** The `≥xl` column is free and hosts the pinned report. |
| The pinned column | `home-page-layout.tsx` — `railMounted = threadMode \|\| reportPinned`; the aside is `sticky top-0 h-dvh` outside thread mode | A Phase-4 surface that wants to dock beside the work uses the same column + the `onReportPinnedChange` pattern. |
| Card doors | `sim-door.tsx` routes a **projected** card to the host under the flag | The seam the Audience surface's "test this against them" would reuse. |

## 2. Phase 4 scope (SSOT §4.4) — and the thing that makes it NOT greenfield

**The concept:** the Audience surface is the sim's *permanent* home — the ten people with their
behaviours, the **accuracy ledger** (predicted vs actual from real reconciliations), and
**recalibration**. Linked from the sub-bar's left half and from the report.

> ⚠️ **`/audience` ALREADY EXISTS and is not what the concept describes.**
> `src/app/(app)/audience/page.tsx` (68 lines) + `[id]/page.tsx` (198 lines) render
> **`AudienceManager`** — the roster/"MOAT surface": connected accounts, audience list, per-audience
> detail with a SOURCE zone. The sidebar already links to it (visible on every screen). The v8
> concept's Audience surface is a *different* job: who your ten people are, how right the sim has
> been, and recalibration.
>
> **This is an owner call before any building:** does v8's Audience surface (a) become a new zone
> inside the existing `/audience` detail page, (b) replace the Manager's landing view, or (c) live
> somewhere else and leave the Manager alone? Picking wrong means two surfaces with the same name
> in the sidebar. **Do not guess.**

> ⚠️ **The accuracy ledger's only renderer is on a DEAD page.** `buildLoopReceipts` /
> `buildLoopAccuracy` (`src/lib/flywheel/loop-summary.ts`) are real and tested, but their sole
> consumer is `TheLoop` (`src/components/surfaces/sections/the-loop.tsx`), rendered **only** by
> `src/components/surfaces/start-page.tsx` — the unreferenced `/start` review build whose two files
> are the standing uncommitted owner call (#7). So the ledger's producer is live, its renderer is
> orphaned, and lifting it is a real Phase-4 task, not a re-mount. Recalibration primitives live in
> `src/lib/flywheel/recalibration.ts` + `reconcile.ts` + `confidence-gate.ts`.

Existing machinery to reuse, not rebuild: `AudienceManager` · `loop-summary.ts` ·
`recalibration.ts` · `audienceToMeta` · the report (`ReportSubject`) · `useFireSim` ·
mock §7 (Audience surface) — **direction, not spec** (SSOT §5 marks its persona one-liners and
ledger wording as such).

## 3. Binding constraints that bite Phase 4 specifically

- **Fire-on-demand is the law.** A recalibration or a "meet them" reveal must not fire sims as a
  side effect of navigation. One run in flight; debounce; every room reaction costs credits.
- **The accuracy ledger prints REAL reconciliations only.** "87% match" is a measured number or it
  does not render — the mock's figure is fabricated (§11 of the mock says so explicitly).
- **The Flash SIM is platform-blind** — never imply the verdict moved with the platform lens.
- **No corpus multiplier numbers; donor niche never shown; accent dosage locked** (live dot only).
- Flag-off byte-identical; gates before any push (`node node_modules/typescript/bin/tsc --noEmit` ·
  `npm run build` · `npx vitest run` with pipefail); never commit the two `/start` files;
  explicit `git add` paths only.
- Drop economics (#3) still an open owner call — nothing billed, routes 404 in prod. Keep it so.

## 4. Defects Phase 3 found and did NOT fix (deliberate — flag them, don't inherit them silently)

1. **`drop-seed.ts` silently drops an angle.** `drop-seed.ts:68` writes
   `scrollQuote: concept.stopQuote?.trim() ?? ""`, but `RemixCardBlockSchema` requires
   `min(1)` — so an adapt concept with no `stopQuote` fails `safeParse` and is dropped from the
   seeded thread (`continue` at `:77`). A drop whose adapt output had no stop quotes seeds a
   thread with fewer than three angles, or none, which fails the whole remix request. Same family
   as the Phase-2 adapt-Zod-cap trap. **Left alone: it changes persisted block content, which is
   Phase-2 scope and deserves its own review.**
2. **A card's door goes stale after an in-session run.** It keeps reading "Simulate with your
   audience →" because the seal lands in composer state (`simSnapshots`) while the persisted block
   keeps `provenance:"projected"`. Behaviourally correct — re-tapping opens the snapshot with no
   second billed call (tested) — but the copy lies. Fixing it means threading session seals into
   the card renderer.
3. **Tab order is split by design.** `AmbientDetail`'s header calls its `brain · engagement ·
   audience` order settled over twelve revisions; the spec §2 and mock §6 both order the *report*
   Audience-first. Phase 3 followed the spec for the report via the opt-in `tabOrder` and left the
   drill alone. If the owner wants one order everywhere, that is a decision, not a cleanup.
4. **The mock's `×4` coded-reason counts are not producible.** Nothing codes reasons for a Flash
   text run, so the report's groups print counts of PEOPLE (real tallies of the ten). Producing
   coded reasons would need a second model call per card — which collides with owner call #3.

## 5. Traps hit in the Phase-3 session (avoid re-paying)

1. **Two dev servers cannot share one `.next/dev/lock`.** Starting a flag-off server while the
   flag-on one runs dies with "Unable to acquire lock". Kill the first (`lsof -ti:PORT | xargs kill`).
2. **The `type-scale` guard is real and it will fail your build-adjacent gate, not your unit test.**
   New components under `components/app/home/**` must take type from the ROLES
   (`text-micro|caption|label|body|reading|title|subhead|heading|stat`), never `text-[13px]`, and
   **no fractional px anywhere under `src/`** (`text-[13.5px]` is banned repo-wide).
3. **The composer-v8 test harness needs `/api/saved` routed.** A thread with cards mounts
   `SaveAffordance` → `useSavedItemByRef` → `data?.items.find(...)`; the harness's catch-all `{}`
   makes that throw and React unmounts the whole tree, leaving `<body><div /></body>` with no
   visible error. Route it to `{ items: [] }`.
4. **`MessageBlocks`' prop is `body`, not `blocks`.** Passing `blocks` throws
   "body is not iterable" — a wasted probe.
5. **A seeded remix fixture needs `stopQuote`** (see §4.1), or `dropCardToRemixBlocks` returns `[]`
   and your thread renders nothing.
6. **`findByRole("button", {name: /…/})` on a drop meter is ambiguous** — the fixture ships two
   drops with the same tally. Scope by `data-testid="drop-meter-<id>"`.
7. **A `SimDoor` row's accessible name is the CARD's label**, not the door text. Click by text.
8. **Vitest suppresses `console.log`.** To see a value, assert it into a failing `expect`.
9. Full-suite baseline: exactly ONE failure, `routing-cut.test.ts` (the uncommitted `/start`
   restore, owner call §7.2 — pre-existing, this worktree only). Same count before/after = green.
10. Verified probe scripts live in this session's scratchpad
    (`/private/tmp/claude-501/-Users-davideloreti-virtuna-platform-concept/c7db8119-*/scratchpad/`):
    `mint-auth.mjs` (Supabase REST → storage-state.json), `shoot-report.mjs` (two contexts AT size,
    sentinel cookie, accent sweep, overlap + sticky measurement), `flagoff.mjs`. Rewrite ≈5 min if
    the tmp dir is gone. E2e user is a REAL PROD account: render/open only, never fire runs.

## 6. State at handoff (2026-08-09)

- Branch `lane/platform-concept` @ `ae9b65ba`, pushed (a repo hook pushes on commit — verify with
  `git rev-parse HEAD origin/lane/platform-concept`, never assume). **PR #458 open**, and its
  title/body still describe **Phase 2 only** — it under-counts what is on the branch. Update it.
- `main` unmoved at `1be28832`; `git rev-list --count HEAD..main` = 0 at handoff. **Re-measure
  before any new push.** Vercel git DISCONNECTED — merging does not deploy.
- Gates at handoff: `tsc --noEmit` clean · `npm run build` clean · `vitest` 5608 passed, 42
  skipped, **1 failed** (the routing-cut baseline).
- **Browser-verified signed-in, flag ON**, at 393×852 and 1440×900 with the
  `maven_active_thread=__new__` sentinel: verdict matches the meter exactly (7/10), 10 faces /
  7 lit, **0 `/api/tools/react` requests when a drop's report opens**, **0 accent-coloured
  elements** in the report, Brain+Engagement dimmed at 0.5, Esc closes, pin docks flush right
  (report `[1040,1440]` vs composer `[266,994]`, no intersection) and survives a 600px scroll
  (`top: 0`), unpin clears the column, 0 page errors. **Flag OFF at 1440×900**: zero v8 surfaces,
  `AmbientOverviewRail` still mounted, 0 page errors.
- **No new DB side effects this phase.** No migrations, no new rows, no paid runs fired (the
  drop cache was read, never re-warmed).
- The two uncommitted `/start` files remain uncommitted (owner call #7 — leave them).
- Memory updated: `platform-concept-lane.md` (Phase 3 state + findings).
- Owner calls riding with the branch: economics #3 · multiplier basis #1 · copy (direction-grade,
  marked) · skills-panel taxonomy (§7.6) · **§2's `/audience` collision** · the four §4 items.
  Still open from the concept doc: #4 decode cross-domain test, #5 corpus cadence/saturation,
  #8 day-0 lane synthesis producer.

## 7. Kickoff prompt for the fresh Phase-4 session

```
Phase-4 implementation session for platform concept v8, worktree
~/virtuna-platform-concept (branch lane/platform-concept — git fetch + pull first; Phases 2+3
are stacked on PR #458, possibly merged).

Read, in order:
1. docs/HANDOFF-2026-08-09-composer-v8-phase-4-kickoff.md  (Phase-3 seams, defects, traps, scope)
2. docs/HANDOFF-2026-08-08-concept-v8-implementation.md    (SSOT — decisions, cautions §5–7)
3. docs/superpowers/specs/2026-08-08-platform-concept-v2-design.md  (spec — revision blocks
   at the top override the body)
4. docs/mockups/concept-v2-2026-08-08.html §7  (Audience-surface anatomy ONLY — SSOT §5 marks
   its persona one-liners and ledger wording as DIRECTION, not spec; content is fabricated)

The concept is SETTLED — do not re-litigate. Phase 4 is the Audience surface (SSOT §4.4): the
ten people with their behaviours, the accuracy ledger (predicted vs actual from REAL
reconciliations only), and recalibration — linked from the composer sub-bar's left half and
from the verdict report, behind the existing CONCEPT_V8_ENABLED flag.

⚠️ BLOCKING OWNER CALL FIRST (kickoff §2): /audience ALREADY EXISTS as the AudienceManager
roster + [id] detail, and the sidebar links to it. Ask the owner whether the v8 Audience
surface becomes a zone inside that detail page, replaces the Manager's landing view, or lives
elsewhere — before building anything. Also note the accuracy ledger's only renderer (TheLoop)
sits on the dead start-page.tsx, so lifting it is real work, not a re-mount.

Plan it first (superpowers:writing-plans), then build TDD, then verify signed-in in a real
browser at 393×852 and 1440×900 (render-only — the e2e user is a real prod account; set the
maven_active_thread=__new__ sentinel cookie or the empty-home arrival never mounts).

Hard rules: fire-on-demand (navigation never fires a sim; one run in flight); the accuracy
ledger prints REAL reconciliations or nothing; never imply the verdict moved with the platform
lens (Flash is platform-blind); no corpus multiplier numbers; donor niche never shown; zero
accent beyond the live dot; flag-off stays byte-identical; type comes from the roles, never
text-[13px] (the type-scale guard). Drop economics (#3) stays an open owner call — no billing
wiring. Gates before any push: node node_modules/typescript/bin/tsc --noEmit, npm run build,
npx vitest run (pipefail; baseline = exactly one pre-existing routing-cut failure). Never
commit the two uncommitted /start files; explicit git add paths only.
```
