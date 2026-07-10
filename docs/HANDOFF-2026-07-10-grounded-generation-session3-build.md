# Handoff — Grounded Generation, session 3 (BUILD STARTED, 2026-07-10)

## What this session did
Sessions 1–2 (2026-07-09) produced + validated the design (SSOT `docs/GROUNDED-GENERATION-VISION.md`
§0–15, spikes, GO). **Session 3 STARTED THE REAL BUILD** and took it from zero to a working,
prod-connected, live-verified gather pipeline wired into Hooks behind an off-by-default flag.

**Status: §11f build step 1 (retrieval/extraction subsystem) + step 2 (Hooks wiring) DONE and
LIVE-VERIFIED. Migration APPLIED to prod. Gate is OFF by default.** Auto-wip daemon disabled →
commits are manual.

## Branch & commits
- Branch: **`milestone/grounded-generation`** (cut off `lane/explore-b` at the design-docs commit;
  the design docs ride in the base). Explore-b lane left clean.
- 10 grounding commits (`git log --oneline main..HEAD`): docs → migration → foundation → gemini-fix
  → extract → outlier-gate → orchestrator → assembler-field → hooks-wiring → verify-harness.
- **NOT pushed, no PR.** tsc 0. 55 tests green (39 grounding/assembler + 16 hooks-runner).
- 2 unrelated dirty files (`src/app/(onboarding)/layout.tsx`, `src/components/brand/maven-logo.tsx`)
  left UNTOUCHED throughout — not ours.

## ⚠️ CORRECTION baked in (do not repeat)
Early in the session I wrongly proposed reviving a **gemini** embedder. **We are Qwen/DashScope ONLY**
(memory: qwen-only-pipeline; `qwen/client.ts` = DashScope compatible-mode). The legacy gemini-named
embedders (`engine/{retrieval,corpus}/embedder.ts`) are the **dead/deferred** ones being migrated FROM;
their own note targets a DashScope re-embed. `GEMINI_API_KEY`/`DEEPSEEK_API_KEY` sit in `.env.local` but
are legacy. When vectors are wanted, the producer is **DashScope `text-embedding-v3` (dims 768)** via the
existing qwen client. The committed code is provider-agnostic (`vector(768)` column + `number[]` RPC
param), so nothing needed ripping out.

## LIVE on prod (Supabase project `qyxvxleheckijapurisj` = virtuna-v1.1)
**§13 migration APPLIED** (via MCP `apply_migration`; file also at
`supabase/migrations/20260710000000_grounded_generation_teardowns.sql`). Verified: 2 tables + 2 RPCs +
13 indexes + RLS on; security advisors = all **baseline-consistent, zero new risk** (the shipped
`match_corpus_videos`/`match_scraped_videos` carry the identical `search_path` flag; graphql-exposed +
rls-no-policy are project-wide patterns).
- `outlier_teardowns` — SHARED cross-user cache (no user_id, RLS-enabled/no-policy = service-role only).
  Global dedup `UNIQUE(platform, platform_video_id)`.
- `personal_teardowns` — PRIVATE Rung −1 (user_id, own-rows RLS, owner-gated attribution + calibration).
- `match_shared_teardowns` / `match_personal_teardowns` — vector RPCs (dark until an embedder lands).
- **Contains 1 real row** from the live-verify (`@braedan.health`, 90.7× vs followers).

## Subsystem built — `src/lib/grounding/` (Qwen/Apify/Supabase, zero gemini)
| file | role |
|---|---|
| `types.ts` | soft-vocab SSOT (facets §11b, growable via `classifyFacet`) + domain types (`Teardown`, `RetrievedExample`, `FitLabel`). Niches imported from shipped `NICHE_TREE` (no 4th vocab). |
| `corpus.ts` | DB access — mirrors `pgvector-client.ts` (plain `SupabaseClient` so new table/RPC names typecheck pre-regen). Upserts (extract-once dedup), `findCachedVideoIds`, the 2 match-RPC wrappers. |
| `extract.ts` | Qwen `qwen3.7-plus` teardown extraction (thinking-off, temp0+seed). Pure `mapExtractionResponse` factored out + tested. `hookSource` derived from opening-presence (honest). |
| `outlier-gate.ts` | `selectCandidates` (cheap result-set-median, jitter-OK, selection only) vs `accountMultiplier` (durable `views÷followers`, the shown receipt) + `passesOutlierGate` (§12 ≥3×). Pure. |
| `orchestrator.ts` | `gatherAndExtract`: scrape 30 → select → profile-scrape survivors for followers → durable gate → extract → **cache-write** (`embedding` NULL) → `RetrievedExample[]`. Injectable provider+supabase. |
| `prompt.ts` | `formatCorpusForPrompt` → the corpus block (spike's "translate the structure, don't copy" + per-example receipt). Empty → undefined. |

**Enabler:** `src/lib/kc/assembler.ts` gained the optional-additive **`corpus`** field (fenced like
`anchor`, `undefined` = **byte-identical no-op** → preserves warm cache + regression gates; tested).

**Wiring:** `src/lib/tools/runners/hooks-runner.ts` — when `GROUNDING_HOOKS_ENABLED=true` AND
`platform=tiktok`, `gatherAndExtract` → `formatCorpusForPrompt` → the `corpus` field. ANY failure
degrades to ungrounded (honesty spine). **Flag OFF by default → zero prod behavior change** (16 existing
hooks-runner tests still green).

## Live-verify (PASSED, 2026-07-10)
`npx tsx scripts/verify-grounding.ts "high protein breakfast" 3` — E2E in 67.5s: scraped 30 → selected 3
→ per-account gate → **1 durable teardown written to prod** (`@braedan.health · 90.7× vs followers ·
621K views`, generalized `[slot]` template + why-it-works).
- **Finding #2 proven live**: the durable `views÷followers` receipt, and the ≥3× gate correctly dropped
  2 cheap-metric "outliers" that weren't durable per-account.
- **Honest yield note**: 1/3 usable this run (gate drops + some profile-scrape timeouts). Query-expansion
  + the degradation ladder (both DEFERRED) are what lift yield; expected for a raw single-query MVP.

## What's next (nothing half-done — clean stopping point)
1. **Receipts-on-cards** — add proof fields to `HookCardBlock` + renderer (`proof:{handle,videoUrl,
   thumbnail,multiplier,fitLabel}` per §11f). The visible "sell the receipt" payoff — grounding currently
   shapes GENERATION but the receipt isn't shown on the card yet.
2. **Fan to Ideas + Script** (same `corpus` field, 1:1) + generalize **Remix** `AdaptInput` 1→N (cheapest).
3. **Qwen `text-embedding-v3` (dims 768)** → fills `embedding` at cache-write + lights up the vector
   RPCs = the walk-many cache payoff (topical prune §11c + cross-request reuse).
4. **Audience-aware prune** (§11c stage 2) → the REAL per-request fit label (today defaulted 'adjacent').
5. **3-beat streamed reveal** (§11) — net-new plumbing, LAST, don't couple.

## Deferred (flagged in-code, each separable)
Audience-prune (real fit) · Qwen embeddings + vector cache-walk · cache read-back/dedup-skip · IG native
provider (TikTok-first vertical, §14) · Tier-2a omni watch (token-appended mp4, finding #1).

## Resume / re-run
- Re-run the live verify: `npx tsx scripts/verify-grounding.ts "<query>" <topN>` (writes real prod rows +
  spends Apify/LLM).
- Enable grounded hooks in the app: set `GROUNDING_HOOKS_ENABLED=true` (TikTok only).
- Env present: `APIFY_TOKEN`, `DASHSCOPE_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- SSOT stays `docs/GROUNDED-GENERATION-VISION.md`. Memory: `grounded-generation-vision.md`
  (has BUILD PROGRESS + LIVE-VERIFIED notes).

## Gotchas
- `VideoData` (search mode) has **no** author/follower — handle parsed from `videoUrl`, followers from a
  per-survivor `scrapeProfile` (survivors-only, §14). Native subs absent on search → Option B caption.
- Migration applied via MCP; the repo file is the same SQL (idempotent — safe if `supabase db push` re-runs).
- Tests: use `node ./node_modules/vitest/vitest.mjs run <path>` (the npm shim prints fake PASS(0)).
- tsc: `NODE_OPTIONS=--max-old-space-size=4096 node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`.
