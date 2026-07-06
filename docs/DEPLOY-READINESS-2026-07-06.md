# Deploy Readiness — Vercel Prod (2026-07-06)

> Read-only audit of the live Supabase project against the shipped code, to
> de-risk the first production deploy (the HARDEN-01 / Launch-Gate-1 work in
> `docs/OPEN-WORK-BACKLOG.md`). No code or DB changes were made by this audit.

**Canonical prod DB:** Supabase project `qyxvxleheckijapurisj` ("virtuna-v1.1",
eu-west-1) — the only `ACTIVE_HEALTHY` project. The other three
(imperator / langstrasse-zurich / A3 Creator Project) are INACTIVE and unrelated.

---

## TL;DR — the deploy is de-risked

| Concern | Verdict |
|---------|---------|
| **DB schema behind the code** (the backlog's "likeliest hidden landmine") | ✅ **FALSE** — the live DB is current through the latest migration (`surface_reactions`, 2026-07-05). It will **not** 500 on schema. |
| **Tables exposed with RLS off** | ✅ **None** — 0 ERROR-level security advisors; every public table has RLS enabled. |
| **Env vars set in Vercel prod** | 🔴 **The actual gate** — owner action (§2). |
| **Code health** (types drift, 21 tsc test errors) | 🟡 Non-blocking — `next build` passes; these are `as any` casts + stale test fixtures (§4). |

The scary unknown ("will it even boot?") is resolved: **schema is fine, RLS is on.
The only thing standing between us and a working prod is the env vars + pushing the button.**

---

## 1. Schema / migration verification ✅

The live DB has **every migration applied through 2026-07-05**. Latest applied =
`surface_reactions` (matches the repo's newest migration
`20260705120000_surface_reactions.sql`). Spot-checked tables all present and
populated: `audiences` (6 rows), `surface_reactions` (2), `account_snapshots` (1),
`competitor_*`, `threads`/`messages`, `analysis_results` (57), `scraped_videos` (7396).

Crucially, the `audiences` table **already has** the columns the newest code writes:
`mode` (NOT NULL), `success_criterion` (nullable), `custom_context` (jsonb NOT NULL).
So the calibration / audience-form / predict paths will work in prod.

**→ The backlog's worst case ("prod DB stuck at the Jan-27 schema") does not hold.**

## 2. Environment variables — THE gate 🔴 (owner)

Prod will not boot / will 500 without these. Copy values from local `.env.local`.

**🔴 Build/app breaks if missing**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

**🟠 Core product 500s if missing**
- `DASHSCOPE_API_KEY` · `GEMINI_API_KEY` · `DEEPSEEK_API_KEY` · `APIFY_TOKEN`

**🟡 Set if that surface is live**
- `WHOP_*` · `CRON_SECRET` · `APIFY_WEBHOOK_SECRET` · `FILMSTRIP_EXTRACT_SECRET` · `NEXT_PUBLIC_SENTRY_DSN`

**🟢 New (rate limiting — PR #172)** — optional; fail-open until set
- `UPSTASH_REDIS_REST_URL` · `UPSTASH_REDIS_REST_TOKEN` (free-tier Upstash Redis;
  the tool routes are inert-but-safe without them, and activate the moment they're set)

**⚪ Skip** — model/tuning knobs have code defaults (`FLASH_MODEL`, `QWEN_*`, `FOLD_*`, …).
No `ANTHROPIC_API_KEY` is used anywhere.

## 3. Security advisors — 0 ERROR, hygiene only 🟡

110 security lints, **0 ERROR / 0 critical**. Breakdown + launch call:

| Advisor | Count | Tables | Launch call |
|---------|-------|--------|-------------|
| `pg_graphql_{anon,authenticated}_table_exposed` | 88 | all public tables | **Ignore** — Supabase default (auto GraphQL API); RLS still governs every row. Only matters if we expose the GraphQL endpoint (we don't). |
| `function_search_path_mutable` | 8 | `update_updated_at_column`, `match_scraped_videos`, `increment_creator_analysis_count`, `calculate_balance_after`, `prevent_wallet_transaction_mutation`, +3 | **Harden** (1 migration): `ALTER FUNCTION … SET search_path = ''`. Low sev, quick. |
| `rls_policy_always_true` | 2 | `competitor_profiles`, `waitlist` | **Verify intent** — both are plausibly meant to be world-readable/insertable (public competitor data; public waitlist signup). Confirm, don't assume. |
| `rls_enabled_no_policy` | 3 | `benchmark_results`, `engine_training_videos`, `training_corpus` | **Fine** — DENY-all (locked); these are engine/internal tables reached via the service role only. |
| `public_bucket_allows_listing` | 1 | `avatars` bucket | **Minor** — anyone can enumerate avatar filenames. Tighten if avatars are private. |
| `auth_leaked_password_protection` | 1 | — | **Toggle on** in Supabase Auth (HaveIBeenPwned check). |
| `auth_insufficient_mfa_options` | 1 | — | Enable more MFA options (nice-to-have). |

None block the deploy.

## 4. Code health — non-blocking 🟡

Neither blocks `next build` (test files aren't in the build; `as any` compiles).

1. **`src/types/database.types.ts` drift** — the `audiences` Row is missing
   `mode` / `success_criterion` / `custom_context` (the DB has them; the generated
   types are stale). Forces `as any` casts in the audience query paths. **Fix:**
   regenerate types from the live DB. *(the "supabase-as-any" backlog item)*
2. **21 `tsc --noEmit` errors** across 15 test files — stale **test fixtures** that
   build `Audience` objects without the now-required domain field
   `mode: "socials" | "general"` (16 of 21) plus a few unrelated fixture-shape drifts.
   **Fix:** add `mode` to the fixtures. Test-only.

## 5. Go-live sequence

1. **Owner:** set the §2 env vars in Vercel (Production scope).
2. **Verify** (already done here): live DB schema is current — no migration backfill needed.
3. **Trigger** the first deploy (a push to `main` fires the Git-integration webhook,
   or trigger manually via the Vercel MCP / dashboard).
4. **Smoke the live URL:** load `/`, sign in, run one Reading, open `/start` — confirm
   no 500s and that the Supabase-backed surfaces (audiences, stat-row, surface_reactions) render.
5. **(optional, same day)** apply the §3 `search_path` hardening migration + flip the
   two Auth toggles.

---

*Audit method: Supabase MCP (read-only) — `list_migrations`, `list_tables`,
`information_schema.columns`, `get_advisors(security)` — against
`qyxvxleheckijapurisj`, cross-referenced with the repo at `main` tip `da54dd50`.*
