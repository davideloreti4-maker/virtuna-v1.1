# Open Work — Consolidated Backlog

> **⚠️ RECONCILED 2026-07-06** (`docs/HANDOFF-2026-07-06b-codehealth-bug7.md`). Since the 07-02 snapshot,
> the deploy-readiness + code-health arc CLOSED: **rate-limiting** (#172), **supabase-as-any** (types
> regen #179 + casts #181/#185), **coral scaffolding + JSDoc** (#170, file deleted), **Bug #7 variants
> race** (#191, migration applied), plus tsc backlog (#177), db-types (#179), competitors eslint (#183),
> search_path migration (#187, *authored not applied*). What TRULY remains: the **Vercel deploy** (still
> the one launch gate), owner decisions (provider/glass), and design-gated (`SurfaceEmptyState` — mocks
> started; lint-gate greening of Room components). Items below are struck ✅ where closed.
>
> **Snapshot: 2026-07-02.** Single index of everything still **open or deferred** after the
> post-GSI refine lane (`lane/refine`) reached a clean state (0/0 with `main`, queue empty).
> All refine-lane work is shipped + merged (PRs #92–#102). What remains is below.
>
> **Provenance / detail:** `docs/OPEN-DEBT-AUDIT-2026-06-29.md` (the sprawling session log) and
> `docs/subsystems/ui-loading-states.md`. This file is the clean pick-up index; those have the
> blow-by-blow. When you close something here, update both.

---

## 🔴 Launch gates — block public launch

### 1. ~~Vercel production deploy — THE launch blocker~~ ✅ RESOLVED — prod auto-deploys `main` (verified 2026-07-11)
The GitHub→Vercel integration is live: **every merge to `main` auto-deploys to production**
(verified via Vercel MCP: the production deployment at main tip `523415a7` is READY, and the
last ~20 deploys — production + previews — are all READY, zero failures). Prod no longer serves
the Jan-27 init commit. Project ids: `prj_WUmPu9fRmFNlbj5rtGIaRmBC8Url` / team `team_4eBJIDHXvR0VGq2Nrgr9xt21`.
- **Also superseded:** the "prod DB stuck at Jan-27 schema" fear — migrations have been
  MCP-applied to the live Supabase project throughout this arc (variants RPC #191, planned_posts,
  grounding §13, connected_accounts + backfill, …).
- **What actually remains — a smoke, not a launch event:**
  1. **Runtime env vars:** builds pass (so `NEXT_PUBLIC_*` exist), but engine/API routes 500 in
     prod if `DASHSCOPE_API_KEY` / `GEMINI_API_KEY` / `DEEPSEEK_API_KEY` / `APIFY_TOKEN` (+ `WHOP_*`,
     `CRON_SECRET`, `UPSTASH_*`, webhook secrets) are unset — check the Vercel dashboard.
  2. **One live prod smoke** of the core flow (sign in → run a skill → Reading renders) before
     calling it launched.

### 2. ~~Rate-limiting (HARDEN-01)~~ ✅ DONE (PR #172, 2026-07-06)
All 11 `/api/tools/*` routes rate-limited via Upstash sliding window (`src/lib/http/rate-limit.ts`,
fail-open). INERT until `UPSTASH_REDIS_REST_URL`/`_TOKEN` set in prod. See `rate-limit-shipped.md`.

---

## 🟠 Owner- / migration-gated — need a decision or a DB change (don't touch blind)

| Item | What / why gated | Size |
|------|------------------|------|
| ~~**Bug #7 — Remix variants JSONB race**~~ ✅ **DONE (PR #191)** | Fixed with an atomic deep-merge RPC (`patch_analysis_variants` + `jsonb_deep_merge`); all 4 writers rewired. Migration **applied** to `qyxvxleheckijapurisj`. | — |
| ~~**supabase-as-any**~~ ✅ **DONE (#179/#181/#185)** | Types regenerated from the live DB; casts dropped across audience + non-audiences code. Only the required `.schema("storage")` cast remains. | — |
| **Provider consolidation** | `src/lib/ai/*` deepseek/gemini modules look dead but are **LIVE at runtime**. Removing could break the engine. Needs owner call on which providers stay. Do NOT delete. | M |
| **Shared-primitive glass** | `ui/{card,select,toast}` still carry `backdrop-filter` glass. Removing changes appearance **everywhere**, incl. GSI-owned surfaces → coordinated pass, not unilateral. | M |
| ~~**Coral type scaffolding**~~ ✅ **DONE (#170)** | `types/design-tokens.ts` deleted wholesale (0 importers) — supersedes the scaffolding + stale-JSDoc items. | — |
| **Worktree / branch prune** | Retire stale worktrees/branches: #60 creator-voice (closed-unmerged), `chat-ethics-gate`, cursor WT, discover-feed. Destructive → each needs a "no stranded work" confirm. | S |

---

## 🟢 In-scope but deferred — doable, lower value

| Item | What / why deferred | Size |
|------|---------------------|------|
| **`SurfaceEmptyState` extract** | ~27 screens hand-roll their own empty state (icon none/tiled/inline, border none/solid/dashed, title present-or-not, CTA some/none). 🎨 **Mocks started 2026-07-06** (canonical-look options artifact) — pick a variant, then it's a mechanical extract + migrate. | M |
| **Account-Read persistence** | `/api/account-read` doesn't `insertMessage` → the result block is **session-only, lost on reload**. Finishes the skill shipped in PR #102. Small, self-contained. | S |
| ~~**`analyze` Reading-internal loading state**~~ ✅ **STALE — already exists** (verified 2026-07-11) | `ReadingSkeleton` IS the Reading-internal loading state: `reading.tsx` renders it for `isLoading` AND in-flight processing rows (`overall_score:null` + `engine_version:'pending'`), with real liveness via `use-reading-reveal` (SSE persona/keyframe counts). The `fallback={null}` at `analyze/layout.tsx:26` is inert **by design** — all UI lives in `<Reading>`. Shipped with the Phase-4 reveal work; predates this backlog's reconcile. | — |
| **Stale coral JSDoc** | Comment-level cleanup in `design-tokens.ts` (same file as the coral scaffolding above) — fold into that sweep. | XS |

### ⛔ Deferred = "won't do as filed" (documented so nobody re-opens them)
- **toast/card inset-shine cleanup** — editing would be **wrong**: the matte gate SANCTIONS
  `inset 0 1px 0 0 rgba(255,255,255,0.05)` (billing/card gold-standard). toast's real issue is
  `backdrop-filter` glass = the owner-gated shared-primitive item above. (⚠️ `CLAUDE.md` "no inset-shine"
  contradicts the enforced gate — reconcile the docs when convenient.)
- **A6 statusMessage plumbing** — a visual no-op (skeleton is gated out at the first stage event).
  Shipped the honest fix instead (static skeleton captions, PR #101).

---

## ⚪ Bigger deferred — out of the refine lane's scope (real features / large tracks)

| Track | Notes | Size |
|-------|-------|------|
| **Feed Phase-3 analyze pipeline** | Hooks-vault / analyzed-filter / create-from-video / Channels Describe backend. | M+ |
| **Post-GSI refactor debt** | ~20 live components sit in eslint `globalIgnores` — refactor + un-ignore. | M |
| **Engine nice-to-haves** | R3 / R5 / G3 / S6 / D-R1 · A-T model · gen-latency ~110s → target · RAG cut (~2.4K LOC). | varies |
| **UI Part-B** | Per-persona reaction modal on the Read hero. | M |

---

## Status line
- **Refine lane:** `lane/refine` = 0/0 with `origin/main` (tip `108bf9bd`). Working tree clean. Queue empty.
- **Recommended next:** the **Vercel prod deploy** (§Launch gate 1) — highest leverage, makes all
  shipped work real. Best done in a **fresh session** (clean context). If not deploying: rate-limiting (§2).
