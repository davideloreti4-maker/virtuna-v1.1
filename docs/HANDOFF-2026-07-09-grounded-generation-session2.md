# Handoff — Grounded Generation, session 2 (2026-07-09)

## What this session did
Session 1 (earlier 2026-07-09) produced the design brief (`docs/GROUNDED-GENERATION-VISION.md` §0–12).
**Session 2 closed the last open design threads AND validated the thesis with live spikes.**

**Status: design COMPLETE + thesis VALIDATED (GO). Real build NOT started** — the owner kept the build as
its own milestone. Still design/pre-build discipline; auto-wip daemon DISABLED (commits manual).

## Resolved this session (all in the SSOT)
- **§13 Corpus data model [LOCKED]** — TWO tables unified by `source_pool`: `outlier_teardowns` (SHARED,
  cross-user, no user_id, dedup `UNIQUE(platform,platform_video_id)` = extract-once/cache-forever;
  `source_pool ∈ {curated,competitor,scraped,expanded}` = the ladder rungs are WHERE filters) +
  `personal_teardowns` (PRIVATE, RLS owner-only, = Rung −1, own-attribution + calibration cols). ONE
  topical `vector(768)` embedding (reuse shipped gemini/HNSW) + TYPED FACET COLUMNS; structural embedding
  DEFERRED (Rung-2 = facet filter, not a vector op). Soft vocab (TEXT + versioned TS enum, **no DB
  CHECK**); adopt `scraped_videos` 10-slug niche (don't mint a 4th). Gather-once/walk-many = per-thread
  pointer, not a table. Retrieval = 2 RPCs unioned/weighted in TS (extends shipped `match_*` two-pool).
  Fit-label per-request, not stored.
- **§14 IG day-one [LOCKED]** — corrected the stale §8 claim. IG native gather IS viable (Apify:
  `instagram-hashtag-scraper` keyword-as-hashtag discovery + related-hashtags, `instagram-reel-scraper`
  transcript add-on + mp4, `instagram-profile-scraper` followers). Real delta = **orchestration** (2–3
  actors vs clockworks ~1) + follower_count not inline (fix: IG cheap-gate = `views÷median` [shipped],
  profile-scrape survivors for accurate `views÷followers`). Sequencing: **TikTok-first vertical → IG
  native fast-follow** behind a platform-generic `ScrapingProvider` → borrowed cross-platform proof =
  interim gap-filler only.
- **§15 Spike validation [GO]** — see `docs/SPIKE-2026-07-09-grounded-generation.md`. Mechanism + value
  validated live; over-copy fixed; receipts attach; 2 small findings.

## Current open threads (post-session)
- **#2 accurate outlier metric** — spike gave live evidence it must be **per-account** for a durable
  receipt (same video read 178×→208× across two pulls). Stabilize before shipping the multiplier as proof.
- **#4 per-request cost ceiling** — real prices now: clockworks free-plan search; IG ~$2.60/1k discovery
  + $1/1k reel + transcript/video add-ons. Core path ~25s / 3 LLM + 1 scrape = cheap.
- **residuals:** curated-canon dataset existence (ingestion, not schema); `template` JSONB sub-shape;
  Tier-2a mp4-plumbing (token-appended URL).

## Next move — the real build (its own milestone/worktree per worktree discipline)
Build order (§11f) + spike refinements:
1. **Retrieval/extraction subsystem:** query-expand → scrape 30 → outlier gate (**per-account metric**) →
   topical prune (embedding) → audience+transfer score → extract (`plus`, thinking-ON, silent watch on
   winners) → corpus (§13 tables).
2. **Wire Hooks** via ONE optional-additive `corpus`/`retrievedExamples` field on `AssemblerInput`
   (`assembler.ts:81`, fenced like `anchor`, `undefined`=no-op) — smallest change, biggest skill; prove
   on the current 2-frame reveal.
3. **Fan to Ideas + Script**; generalize **Remix** `AdaptInput` 1→N (cheapest — machinery exists).
4. **Three-beat streamed reveal LAST** (net-new plumbing, separable — don't couple).

## Code touchpoints verified this session (grounding is essentially ONE change)
- `src/lib/kc/assembler.ts` — `assembleBundle(input, profileRow)`; the `overrides` string is fenced into
  the user message = the grounding lever (the spike used it **zero-edit**; the real build adds a dedicated
  `corpus` field the same way). Roles for `hooks` include `voice`.
- `src/lib/tools/runners/hooks-runner.ts` — generate → batched Flash SIM → build block; grounding rides
  in via `assembleBundle`. Generate call = `QWEN_REASONING_MODEL`, json_object, temp 0, seed, thinking-off.
- `src/lib/engine/qwen/client.ts` — `QWEN_REASONING_MODEL=qwen3.7-plus` (=plus), `QWEN_SEED=7`, DashScope
  compatible-mode; thinking via `enable_thinking` cast `as never`. ⚠ thinking-ON may require `stream:true`
  (untested — the spike ran extraction thinking-OFF to guarantee completion).
- `src/lib/scraping/apify-provider.ts` — `scrapeVideos(query, 30, "search")` = niche pull (`searchQueries`);
  `resolveVideoUrl(url)` = single mp4 (⚠ needs **token-appended** URL for a model watch — finding #1).
  **`VideoData` has NO author field** → parse `@handle` from `videoUrl`.
- `src/lib/discover/outlier-compute.ts` — `rankOutliers(videos, "niche")` = `views ÷ result-set-median`
  (**JITTERY** — finding #2; stabilize to per-account).
- `src/lib/kc/profile-role-map.ts` — `ProfileRow` shape (niche/audience/goals/wins/flops/platform/voice).
- **DB:** pgvector shipped (`extensions.vector(768)`, gemini, HNSW cosine). `training_corpus` +
  `engine_training_videos` = the SCORING engine (distrusted for gen — the teardown is NET-NEW).
  `scraped_videos` / `competitor_videos` / `account_posts` hold raw rows (none store a teardown).
- **Env present:** `APIFY_TOKEN`, `DASHSCOPE_API_KEY`, `GEMINI_API_KEY` (+ Supabase). Spike bootstrap =
  dotenv + `tsconfig-paths` register (see any `scripts/*.ts` head; run via `npx tsx`).

## Reference
Sandcastles shots: `~/Downloads/Sandcastles.ai Screenshots` + `.planning/references/sandcastles` (all 26 reviewed).
SSOT: `docs/GROUNDED-GENERATION-VISION.md` (§0–15). Spikes: `docs/SPIKE-2026-07-09-grounded-generation.md`.
