# Handoff — concept v8 after Phase 5, plus the full-worktree browser audit · lane/platform-concept

> **Written 2026-08-09 at the end of the Phase-5 session.** Phases 2, 3 and 5 are BUILT,
> browser-VERIFIED and pushed. **Phases 4 and 6 were SKIPPED by the owner.** With that, the v8
> build order in SSOT §4 is complete — this doc is the state of the lane, not a kickoff for a
> next phase.
>
> **Precedence chain unchanged:** `docs/HANDOFF-2026-08-08-concept-v8-implementation.md` (SSOT) →
> the spec (revision blocks override the body) → the mock (layout/anatomy ONLY). This doc adds
> Phase-5 outcomes and the audit; it overrides nothing.

## 1. The ruling that shaped this session

**The owner skipped Phase 4 (the Audience surface) and Phase 6 (advertiser flavor), and issued a
standing instruction that outranks the build order:**

> *"there is some content that shouldn't be implemented from the mock — for example the audience
> page which we already have, or the sim pages (brain, audience, engagement) which we also already
> had."*

**Audit the mock section against the live product before building any of it.** Phase 4 was dropped
because the product already ships it:

| Mock §7 "Audience surface" job | Already live |
|---|---|
| the ten people with their behaviours | `audience-detail.tsx:386-441` — roster with name · repaint · share% · disposition · evidence receipt, over a `PopulationField` hero |
| recalibration | `audience-detail.tsx:614-637` — `CalibrationFlow` in a dialog off the Sync rail |
| the accuracy ledger | **the only genuinely missing piece — and it has no data either** |

Asking a second design question after that ruling read as re-litigating a settled concept and drew
a sharp correction. **The sketch is the design. Audit, then build what is missing.**

## 2. ⚠️ The accuracy ledger is a dead end today — measured, not inferred

Queried against the live shared project (`qyxvxleheckijapurisj`) on 2026-08-09:

```
reconciliations       0 rows     ← the ledger's ONLY input. Empty, always has been.
outcome_signatures  134 rows     ← predictions pinned…
  realized_vector     0          ← …and not one was ever closed
  platform_post_url   0
audiences            13 · threads 228   ← the app is otherwise genuinely used
```

**The loop is orphaned at both ends.** `buildLoopReceipts`/`buildLoopAccuracy` are live and tested,
but their only renderer (`TheLoop`) *and* the only affordance that can produce a row
(`OutcomeCapture` → `POST /api/outcomes/signature`) are both mounted solely by
`src/components/surfaces/start-page.tsx` — the unreferenced `/start` build whose two files are the
standing uncommitted owner call (#7). Nothing in the shipping product can close a loop.

Two more facts for whoever picks this up:
- `listReconciliations(supabase, audienceId)` filters by audience but does **not** embed
  `outcome_signatures` — no real counts, no post link. `listRecentReconciliations` embeds but is
  user-wide. An audience-scoped receipt needs a new query.
- `TheLoop` cannot be re-mounted. It is raw px throughout (`text-[15px]`/`[12px]`/`[10px]`/`[25px]`)
  — legal in `components/surfaces/`, banned the moment it moves into `audience/`, `app/home/`,
  `sidebar/` or `thread/` (`type-scale.test.ts` GUARDED_DIRS). Lifting it is a rewrite onto the roles.

**Consequence:** any "87% match" surface renders its empty state for every user, permanently. The
honesty rule is satisfied by rendering nothing, but a zone that structurally cannot fill is a design
problem, not an edge case. **Do not scope an accuracy ledger without also scoping where capture lives.**

## 3. What Phase 5 shipped (`12e24e8d..43b3dd62`, 5 commits)

Plan: `docs/superpowers/plans/2026-08-09-composer-v8-phase-5-lanes.md`.

The same audit discipline applied first: `/welcome` **already** ships both doors (`ConnectStep`
handle|describe), the real `CalibrationFlow`, and the "Meet your people" reveal (`AudienceReveal` at
`calibration-flow.tsx:431`). So only the LANES were unbuilt.

| Piece | Where |
|---|---|
| Lane synthesis — one Qwen JSON call, structural clone of `adapt.ts`, Zod `min(2).max(3)` | `src/lib/engine/lanes/synthesize-lanes.ts` + `lane-types.ts` |
| One pre-scored card per lane — Phase-2 pipe with each lane's niche as the adapt steer, sims against `GENERAL_AUDIENCE`, ONE batched Flash, no cache | `src/lib/surfaces/lane-drops.ts` |
| The route, 404 flag-off | `src/app/api/surfaces/lanes/route.ts` |
| The one question (serif voice moment) | `src/components/onboarding/lane-question.tsx` |
| The grouped reveal (whole card is the pick) | `src/components/onboarding/lane-reveal.tsx` |
| The opt-in door + the `lanes` stage | `connect-step.tsx` · `welcome/page.tsx` |

**The two calls worth knowing:**
1. **Picking a lane re-enters the EXISTING describe flow** with the lane's own line as the
   description. The lane never bypasses calibration; onboarding keeps its one contract (it ends in a
   calibrated audience). The branch is additive, not a fork.
2. **The flag gate lives in `welcome/page.tsx`, not in `ConnectStep`.** The door is driven by the
   PRESENCE of the `onNotSure` prop — that is what makes flag-off byte-identical, and it is what the
   test locks. Never default that prop to a no-op.

**Deliberately NOT built** (stated, not silently dropped): the Creator/Brand/Ads **role toggle** —
its only consumer is workspace flavor, i.e. Phase 6, which was skipped, so it would flavor nothing;
and **Connect Instagram** — `ConnectStep` is TikTok-only because the calibrate pipeline is
(`audience-detail.tsx:369`), which is pipeline scope, not day-0.

**⚠️ `synthesizeLanes` has NO EVAL.** SSOT open owner call #8 wants a real producer (prompt + eval).
This is the producer and its unit tests. Read real output against 5–10 varied answers in a sandbox
before it leaves the flag. This is the single biggest open risk on the lane.

## 4. The full-worktree browser audit (2026-08-09)

Signed in as the e2e user, flag ON, at **393×852** and **1440×900**, native context per viewport.
Spend routes (`/api/tools/react`, `/api/surfaces/lanes`, `/api/outcomes/signature`) hard-blocked at
the Playwright layer; **zero attempts fired**. `/api/surfaces/drops` was allowed deliberately —
see the trap below.

| Surface | Result |
|---|---|
| Arrival (`/home`) | **5 drop cards** — real rehosted stills, real views (91K→18.4M), serif adapted hooks, real meters spanning 1/10→9/10. Shelf + sub-bar + live dot all present, both viewports. |
| Skills panel | opens from the skill pill, both viewports, clean |
| Audience sheet | opens from the sub-bar's left half, both viewports, clean |
| Verdict report | `variant=sheet` mobile / `variant=panel` desktop · **7/10** · 10 faces / **7 lit** · **0 `/api/tools/react` calls on open** (fire-on-demand law holds) |
| Pinned report (desktop) | `data-pinned=true` · report `[1040,1440]` vs composer `[267,993]` — **no overlap** · `top:0` after a 600px scroll |
| Day-0 lanes | question + reveal render correctly at both sizes (via `zz-preview`) |

**Design-system measurements, every surface, both viewports:**
- **Accent: 3 elements — all sanctioned.** The `sub-bar-live-dot`, plus the brand mark
  (`src/components/brand/maven-logo.tsx`, whose `<svg>` and its child `<path>` each compute to the
  accent, so one visual element counts twice). CLAUDE.md sanctions both. **Zero unsanctioned accent.**
- **Fractional px: 0** on every surface.
- **Font sizes: 10 · 11 · 12 · 13 · 14 · 16 · 26 · 27px** — all type roles, except 26px which is the
  allowlisted serif greeting (`type-scale.test.ts` ALLOWLIST, `app/home/v8/arrival.tsx`).
- **Horizontal scroll: none.** **Page errors: 0.**

### Traps this audit paid for

1. **`POST /api/surfaces/drops` is NOT a spend — blocking it is worse than allowing it.** The route
   calls `getFreshSurfaceCards` server-side and returns the cache on a hit. The first audit run
   blocked it as a "spend route" and got a **0-card shelf**, which looks exactly like a broken
   surface. Check the cache first (below), then allow it.
2. **How to know the cache is warm before you open a browser:**
   ```sql
   select us.last_audience_id, sr.audience_key,
          (us.last_audience_id::text = sr.audience_key) as key_matches,
          (now() - sr.updated_at) < interval '18 hours' as within_ttl
   from user_settings us
   left join surface_reactions sr on sr.user_id = us.user_id and sr.kind='drop'
   where us.user_id = '31c5a91c-31e1-45fd-ae67-e75c21a49df1';
   ```
   TTL is **18h on `updated_at`** (`surface-reactions-repo.ts:24`), keyed `user × audience_key × kind`.
   Both true ⇒ opening `/home` is free. Either false ⇒ it fires ≤6 adapt + 1 Flash of real spend.
3. **The e2e account cannot reach `/welcome`** — it has onboarding pre-completed, so it redirects to
   `/home` before any day-0 surface mounts. Phase 5's UI was verified with the repo's `zz-preview`
   recipe (a throwaway page outside the route groups, real components, deleted after). **The
   `/welcome` wiring itself is covered by unit tests, not by a browser.** Anyone who wants a real
   day-0 walk needs an account with `onboarding_completed_at IS NULL` (8 exist, none are ours).
4. The `<svg>` and its `<path>` both report the accent colour, so a naive accent count reads 3 where
   there are 2 visual elements. Count distinct hosts, not nodes.

Probe scripts (rewrite ≈10 min if the tmp dir is gone):
`/private/tmp/claude-501/-Users-davideloreti-virtuna-platform-concept/14ef4bc1-*/scratchpad/` —
`mint-auth.mjs` (Supabase REST → storage-state + the `maven_active_thread=__new__` sentinel),
`audit.mjs` (both viewports, all surfaces, accent/type/spend measurement), `shoot-lanes.mjs`.

## 5. State at handoff

- Branch `lane/platform-concept` @ `43b3dd62`, pushed. **`main` unmoved**; `git rev-list --count
  HEAD..origin/main` = 0. Vercel git DISCONNECTED — merging does not deploy.
- **PR #458 updated this session** — retitled *"phases 2, 3 and 5"* and its body now covers all
  three phases, the gates, the browser verification and the four known-unfixed items. It previously
  described Phase 2 only across 32 commits.
- Gates: `tsc --noEmit` clean · `npm run build` clean · `vitest` **5647 passed, 42 skipped, 1 failed**
  — the `routing-cut.test.ts` baseline only (worktree-only, from the uncommitted `/start` restore).
- **No DB side effects.** No migrations, no new rows, no paid runs. The drop cache was read, never
  re-warmed.
- The two uncommitted `/start` files remain uncommitted (owner call #7).

## 6. What is actually open

1. **`synthesizeLanes` has no eval** (§3) — the biggest risk on this lane.
2. **The accuracy ledger / outcome capture** (§2) — needs a home for capture before any ledger UI is
   worth scoping. No longer "Phase 4"; it is its own question.
3. **Does this lane close?** Phases 1, 2, 3, 5 are built; 4 and 6 are skipped. The v8 build order is
   complete. The decision is whether #458 merges as-is, and what the lane becomes after.
4. Carried, unchanged: drop economics (#3, nothing billed) · multiplier basis (#1) · direction-grade
   copy · skills-panel taxonomy (§7.6) · the four Phase-3 defects (`drop-seed.ts` stop-quote drop,
   the stale card door, split tab order, non-producible coded reasons).
