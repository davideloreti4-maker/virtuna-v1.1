# Handoff — 2026-07-06b (code-health follow-up + Bug #7)

**main tip:** `55d966da` · `tsc --noEmit` = 0 · full suite **3201 pass / 0 fail**.
Continuation of `HANDOFF-2026-07-06-deploy-codehealth.md` (that session shipped #168/#170/#172/#173/#177/#179).
Work done in `~/virtuna-surfaces` on `verify/main-state`; each fix cut a fresh branch off `origin/main`.

## Shipped this session — 6 PRs (all merged)

| PR | Merge | What |
|----|-------|------|
| #181 | — | Drop `(supabase as any)` in the **audience query code** (10 casts / 3 files); JSONB writes use value-level `as unknown as Json` |
| #183 | `37b8c05…` | **Competitors eslint reconcile** — un-ignore `competitors/**` (stale "dead" label; #166 revived it) + fix the 7 errors (6× `static-components` → hoisted `SortableHeader`; 1× `<a>`→`<Link>`) |
| #185 | — | Drop the **remaining non-audiences** casts (threads / analysis_results writes); `src/` now has **zero droppable** `(supabase as any)` |
| #187 | — | **search_path migration** (advisor 0011, ×8 functions) — `supabase/migrations/20260706120000_harden_function_search_path.sql`. **⚠️ NOT applied to prod** (owner-gated; alters live functions) |
| #190 | `b9e4558…` | Restore tsc=0 — a pre-existing `mock.calls[0]` TS2488 regression (landed between #185 and now) |
| #191 | `55d966d…` | **Bug #7 — atomic variants merge** (see below). Migration **APPLIED** to the live DB |

The one remaining `(supabase as any)` in `src/` is `cron/sweep-orphan-videos:44` — **genuinely required** (`.schema("storage")` isn't in the generated types). Leave it.

## Bug #7 — the analysis_results.variants lost-update race (the last real pre-launch bug)

Four writers persisted into the same `variants` JSONB via read-modify-write across **separate concurrent requests** → lost updates:
`persistCraftToVariants` (craft), `persistApolloToVariants` (apollo/engagement_range/hero) — both in the score run; `persistDecodeToVariants` (remix.decode) — remix run; `filmstrip/extract` (filmstrip_segments) — fire-and-forget.

**Fix:** each writer sends only its keys as a patch; the merge happens in one atomic `UPDATE` via a new RPC. Postgres row-locking serializes concurrent `UPDATE`s on the row (READ COMMITTED re-reads the committed value) → every patch lands on top.
- Migration `20260706130000_atomic_variants_merge.sql`: `jsonb_deep_merge(a,b)` (recursive — nested `remix.decode` preserves `remix.adapt`/`filmstrip` siblings; arrays = b-wins) + `patch_analysis_variants(p_id text, p_patch jsonb, p_user_id uuid default null)` (`p_user_id` enforces CR-02 when non-null; the filmstrip secret-auth job passes null, keys on id). Both pin `search_path`.
- **APPLIED to the live DB `qyxvxleheckijapurisj`** (additive + reversible + idempotent, and *required* so the code rewire is non-breaking in the shared local/prod DB). Verified with 6 SQL merge scenarios.
- `database.types.ts` gained the 2 functions (surgical add; matches a full regen — no other drift). `decode-route` T-03-04 test rewritten to assert the narrow patch.

### Migration apply status (IMPORTANT)
- ✅ `20260706130000_atomic_variants_merge` — **applied** to `qyxvxleheckijapurisj` (live).
- 🔴 `20260706120000_harden_function_search_path` — **NOT applied**. Run `supabase db push` (or paste in the SQL editor). Idempotent + reversible.

## Environment gotchas (new this session)
- An **`rtk` tee wrapper** intercepts `tsc`/`eslint`/`vitest` and reformats output, **swallowing `-f json`**. For machine-parseable output bypass it: `node ./node_modules/eslint/bin/eslint.js -f json`.
- `get_advisors` + `generate_typescript_types` MCP outputs **exceed the tool token limit** (saved to a file) → query `pg_proc` / `pg_policies` directly and edit `database.types.ts` surgically instead of a wholesale regen.
- `analysis_results.id` is **`text`**, not uuid (`user_id` is uuid).

## What's left (reconciled — the 2026-07-02 `OPEN-WORK-BACKLOG.md` was stale)

**Owner-only:**
- 🔴 **The Vercel deploy** — Pro upgrade + prod env vars + trigger. THE gate (5mo of work has never been in prod).
- Apply **#187 search_path migration** + flip Auth toggles (leaked-password protection, MFA).
- Decisions (don't touch blind): **provider consolidation** (`ai/*` deepseek/gemini — LIVE at runtime), **shared-primitive glass** (`ui/card,select,toast` backdrop-filter — changes appearance everywhere).

**Design-gated:**
- **`SurfaceEmptyState` extract** — ~27 hand-rolled, visually DIVERGENT empty states (icon none/tiled/inline, border none/solid/dashed, title present-or-not, CTA some/none). Needs a canonical-look decision → **mocks in `docs/SURFACE-EMPTY-STATE-MOCKS` artifact** (started this session; pick a variant, then it becomes a mechanical extract + migrate).
- **Green the lint gate** — 5 `set-state-in-effect` errors in **Room-owned** components (`audience-lens/*`, `use-lazy-warm`) + ~15 other still-ignored live files (`eslint.config.mjs`). Behavioral; needs a browser pass.

**Feature tracks (not debt):** Feed Phase-3 pipeline · `analyze` Reading-internal loading state · UI Part-B per-persona modal · engine nice-to-haves.

## Memory SSOT
`rate-limit-shipped.md` carries the full rate-limit → deploy-readiness → code-health → Bug #7 trail.
