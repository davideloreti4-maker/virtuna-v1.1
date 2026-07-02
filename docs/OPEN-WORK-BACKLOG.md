# Open Work — Consolidated Backlog

> **Snapshot: 2026-07-02.** Single index of everything still **open or deferred** after the
> post-GSI refine lane (`lane/refine`) reached a clean state (0/0 with `main`, queue empty).
> All refine-lane work is shipped + merged (PRs #92–#102). What remains is below.
>
> **Provenance / detail:** `docs/OPEN-DEBT-AUDIT-2026-06-29.md` (the sprawling session log) and
> `docs/subsystems/ui-loading-states.md`. This file is the clean pick-up index; those have the
> blow-by-blow. When you close something here, update both.

---

## 🔴 Launch gates — block public launch

### 1. Vercel production deploy — THE launch blocker
Prod has served the **Jan-27 init commit (`f510cf0f`) only** — ~5 months + everything shipped
this arc (A5, A6, spinner consolidation, optimistic delete) is **undeployed**.
- **Status:** GitHub→Vercel Git integration was severed; **owner reconnected it 2026-07-02** (step 1
  done). Reconnect does NOT backfill — no deploy fires until a push to `main` or a manual trigger.
  Project ids: `prj_WUmPu9fRmFNlbj5rtGIaRmBC8Url` / team `team_4eBJIDHXvR0VGq2Nrgr9xt21`.
- **Remaining steps:**
  1. **Owner:** set Production env vars in Vercel (copy values from local `.env.local`):
     - 🔴 build/app breaks: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
       `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`.
     - 🟠 core product 500s: `DASHSCOPE_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `APIFY_TOKEN`.
     - 🟡 if live: `WHOP_*`, `CRON_SECRET`, `APIFY_WEBHOOK_SECRET`, `FILMSTRIP_EXTRACT_SECRET`, `NEXT_PUBLIC_SENTRY_DSN`.
     - ⚪ skip (code defaults): model/tuning knobs (`FLASH_MODEL`, `QWEN_*`, `FOLD_*`, …). No `ANTHROPIC_API_KEY` anywhere.
  2. **Verify prod Supabase migrations** (read-only Supabase MCP) — deployed code expects ~5mo of
     migrations; `database.types.ts` is missing `mode`/`success_criterion`/`custom_context` cols. If
     prod DB is stuck at Jan-27 schema the app errors even with keys set. **Likeliest hidden landmine.**
  3. **Trigger** the first deploy (a merge fires the webhook, or trigger via MCP) → verify it lands + smoke the live URL.
- **Note:** this is a **launch event** (5mo of never-in-prod work), not a code fix. Deferred by owner
  2026-07-02 to stay on local. Detail: audit §Blocking-1.

### 2. Rate-limiting (HARDEN-01)
6 tool routes unprotected (`src/app/api/tools/ideas/route.ts:117` has a voided TODO); only
`analyze-chat` is wired. **Needs a store decision** — in-memory won't survive serverless; pick
Vercel KV / Upstash. Size **M**. Detail: audit §Blocking-2.

---

## 🟠 Owner- / migration-gated — need a decision or a DB change (don't touch blind)

| Item | What / why gated | Size |
|------|------------------|------|
| **Bug #7 — Remix variants JSONB race** | REAL data-loss bug: concurrent remix-variant writes read-modify-write and clobber each other. Fix = atomic `jsonb_set` RPC → **migration-gated**. Pre-launch. | M |
| **supabase-as-any** | Code casts query results to `any` because generated `database.types.ts` is missing cols (`mode`/`success_criterion`/`custom_context`). Fix = **regenerate types from the live DB schema**, not strip casts. Needs DB access + which-DB-is-canonical call. | M |
| **Provider consolidation** | `src/lib/ai/*` deepseek/gemini modules look dead but are **LIVE at runtime**. Removing could break the engine. Needs owner call on which providers stay. Do NOT delete. | M |
| **Shared-primitive glass** | `ui/{card,select,toast}` still carry `backdrop-filter` glass. Removing changes appearance **everywhere**, incl. GSI-owned surfaces → coordinated pass, not unilateral. | M |
| **Coral type scaffolding** | `CoralStep`/`GradientToken 'coral'`/`colorVar('coral')` in `types/design-tokens.ts` are dead (unused outside file), but it's a foundational types file → do in a dead-code sweep you green-light. | S |
| **Worktree / branch prune** | Retire stale worktrees/branches: #60 creator-voice (closed-unmerged), `chat-ethics-gate`, cursor WT, discover-feed. Destructive → each needs a "no stranded work" confirm. | S |

---

## 🟢 In-scope but deferred — doable, lower value

| Item | What / why deferred | Size |
|------|---------------------|------|
| **`SurfaceEmptyState` extract** | ~20+ screens hand-roll their own empty state. Extract one shared component + migrate. Real refactor + shared-API design, risk of flattening intentionally-different states. | M |
| **Account-Read persistence** | `/api/account-read` doesn't `insertMessage` → the result block is **session-only, lost on reload**. Finishes the skill shipped in PR #102. Small, self-contained. | S |
| **`analyze` Reading-internal loading state** | Theme-B residual: `analyze/layout.tsx:26 fallback={null}` is inert; the real fix is a Reading-internal loading state (not a route skeleton). | M |
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
