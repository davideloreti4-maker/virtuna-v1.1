# Handoff — Teardown cache read-back SHIPPED + live-verified (2026-07-12 evening, lane explore-a)

## What shipped
**PR #253** (squash `35ca6320`) — gather-once/walk-many. Grounded runs stop paying a fresh
scrape when the §13 corpus already covers the topic. Follows the morning handoff
`docs/HANDOFF-2026-07-12-grounding-fanout.md` NEXT-SESSION spec exactly.

1. **`src/lib/grounding/embedder.ts`** — DashScope **`text-embedding-v3`, 768d** via the shared
   qwen client (**NOT gemini** — the engine's gemini-named embedders stay dead).
   `buildTeardownEmbeddingText` = the §13 topical-formula SSOT (caption + hashtags +
   on-screen-text + spoken_hook + idea.angle); batch ≤10/request (DashScope cap), dim-validated.
2. **Write path** — `orchestrator.gatherAndExtract` embeds usable teardowns at cache-write
   (ONE batched call; failure degrades to `embedding NULL`, never blocks the gather).
   `hook_template`, `caption`, `hashtags` are now **first-class columns** on both teardown
   tables: rows are self-contained for re-embed; the receipt line is queryable.
3. **Read path — `src/lib/grounding/retrieve.ts`** — embed query → `match_shared_teardowns`
   → good = similarity ≥ minSim AND `proof_captured_at` within window → `RetrievedExample[]`.
   Knobs (env, defaults in code): `GROUNDING_CACHE_MIN_ROWS=4`,
   `GROUNDING_CACHE_MIN_SIMILARITY=0.65`, `GROUNDING_CACHE_FRESH_DAYS=90`.
4. **`gather-for-run`** — read-back FIRST; `enough` → **scrape skipped** (`[grounding] cache HIT`
   console line = the observable); miss OR read-back failure → live scrape (write-through).
   User-visible warning ONLY when the scrape path also fails. Stage name unchanged + honest on
   both paths. Runners untouched (signature back-compatible; deps injectable for tests).
5. **Migration `20260712140000_teardown_read_back.sql`** — **applied to prod**: columns both
   tables, `hook_template` backfilled from teardown JSONB, both match RPCs DROP+CREATE'd to
   also return `hook_template` + `proof_captured_at`, db-hygiene `search_path` pin re-applied.
6. **`scripts/backfill-teardown-embeddings.ts`** — one-shot `embedding IS NULL` backfill;
   ran against prod: 22 rows embedded (corpus had grown 13→22 via local flag-ON runs).

## Live-verify evidence (prod tables + real DashScope; flags ON in this worktree's .env.local)
| Run | Result |
|---|---|
| Repeat "high protein breakfast ideas" | **cache HIT — scrape SKIPPED**, 6 teardowns in **1.3s** (scrape path is 40–105s); receipts complete (handle · multiplier · baseline · hookTemplate) |
| Novel "morning routines for remote workers" @0.65 | honest **miss** (2/4 good) → live Apify scrape → 5 rows written **with embedding+caption+hashtags+hook_template** (write-through verified in SQL) |
| Same novel topic re-run | **cache HIT 1.8s**, blends the 5 fresh rows with older overlapping outliers by similarity |
| RPC smoke (SQL) | self-similarity 1.0000 first; `hook_template`/`proof_captured_at` flow through |

**Similarity calibration (the load-bearing number).** Measured live on the 22-row corpus:
on-topic query → 0.66–0.83 (9 rows pass) · adjacent-topic → one 0.72 then ≤0.63 · off-topic
("how to negotiate a raise") → ≤0.50. **Default 0.6 false-HIT the adjacent query with 4 rows**
→ shipped default is **0.65**. Re-calibrate when the corpus grows dense (comment in
`retrieve.ts:resolveRetrieveConfig` carries the numbers).

## Gates
tsc 0 · grounding suite 46/46 (embedder / retrieve / gather-for-run tests new) · full vitest:
the 35 pre-main-tip failures were fixed mid-session by **#252** (another lane's
renderWithClient wrapper); **1 remains red on main: `src/app/api/tools/remix/run/__tests__/
route.test.ts` "SSE stream emits stage+content+score+done" — pre-existing, NOT this diff**
(reproduced on clean stash before my changes). Someone should claim it.

## Environment / cost state
- This worktree's `.env.local`: all 3 `GROUNDING_*_ENABLED=true` (LOCAL ONLY). Repeat-topic
  runs are now ~free (embed + RPC cents); only novel topics scrape.
- **Prod flags still UNSET** (owner gate). The read-back was the stated pre-condition for the
  flip — that condition is now met. Flip = 3 env vars in Vercel + redeploy. Standing P0
  sibling: `CRON_SECRET` (memory `vercel-crons-dead-401`) — same Vercel visit.
- Migration + backfill already live in prod; deploy of this code enables read-back wherever
  the flags are ON.

## Deferred (explicit, from this session)
- **Personal-pool union** (Rung −1): `matchPersonalTeardowns` wrapper exists but has NO
  producer and runners carry no user identity — lands with the personal-teardown producer.
- **Audience-prune real fitLabel** (`adjacent` placeholder still) · **Remix 1→N** · **IG provider**.
- Niche/archetype facet filters at retrieve time (Rung 2) — RPC supports them; TS passes NULL.

## Gotchas (this session)
- `text-embedding-v3` similarity runs HIGH on topically-dense corpora — threshold choices
  need measured distributions, not round numbers (see calibration above).
- The teardown extractor's raw JSONB does NOT echo its input — that's why caption/hashtags
  became columns (pre-migration rows embed from spoken_hook + idea.angle only; acceptable).
- DROP+CREATE on a Supabase RPC loses `ALTER FUNCTION ... SET search_path` hardening —
  re-declare it in the function body (db-hygiene §5).
- vitest npm shim still fake-passes: `node ./node_modules/vitest/vitest.mjs run <paths>`.

References: SSOT `docs/GROUNDED-GENERATION-VISION.md` §13 · memory `grounded-generation-vision`
· morning handoff `docs/HANDOFF-2026-07-12-grounding-fanout.md`.
