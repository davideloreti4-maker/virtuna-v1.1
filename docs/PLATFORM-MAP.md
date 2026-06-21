# Numen — Platform End-to-End Map

> Navigable map of every user-input → output flow across the platform.
> Generated 2026-06-21 from full codebase trace. File refs are `path:line` (clickable).
>
> **How to read this:** Start at §0 for the mental model. Each skill/flow has the
> same shape — **Input → Grounding → Model call(s) → Output → Persistence**. The
> two AI backbones (§1) are shared by everything; skills differ mainly in *which
> KC slice* grounds them and *whether they run the Flash SIM gate*.

---

## 0. The Mental Model (read this first)

The platform has **two AI backbones** that everything else composes:

1. **Qwen generation/reasoning** (DashScope) — writes ideas/hooks/scripts/chat, decodes & adapts videos, scores videos. One client, several model IDs.
2. **Flash SIM** ("synthetic audience test") — the moat. Takes a piece of text (a hook/idea/opener) + the active audience's 10 personas, returns per-persona **stop/scroll** verdicts → a **band** (Strong/Mixed/Weak) + **fraction** (e.g. "6/10 stop"). Never a numeric forecast.

Everything the user does flows through **one of three lanes**:

| Lane | What it is | Routes | Backbone used |
|------|-----------|--------|---------------|
| **A. Generative skills** | ideas, hooks, script, chat, remix, refine, react, explore | `/api/tools/*` | Qwen gen + Flash SIM gate |
| **B. The Read (video analysis)** | upload/URL → full engine score | `/api/analyze/*` | Qwen Omni + Apollo + Fold |
| **C. Audience + data** | create/calibrate audiences, discover, account-read, flywheel | `/api/audiences/*`, `/api/discover`, etc. | Apify scrape + pure math (mostly no LLM) |

**The spine that connects them:** every generative skill run writes typed **blocks** into the user's single **open thread** (`type:"open"`), and reads the **active audience** pinned on that thread. The audience's 10 calibrated personas are what the Flash SIM reacts with. That's the whole product loop:

```
       ┌─────────────── active_audience_id (pinned on open thread) ───────────────┐
       │                                                                          │
   AUDIENCE ──calibrate──> 10 personas ──feed──> FLASH SIM ──band/fraction──> SKILL CARD
   (Apify scrape +                                  ▲                            │
    deterministic                          concept text from                    │
    repaint, NO LLM)                       generative skill                     ▼
                                                                          OPEN THREAD (blocks)
                                                                                │
                                                                          rendered as cards
```

**Grounding sources** (what gets injected into prompts):
- **KC (Knowledge Core)** — static owner-curated markdown, compiled to byte-stable prompt constants. The craft brain. Per-mode slices (ideas/hooks/script/chat).
- **Creator profile** — niche/audience/goals/wins/flops, assembled per-request into a fenced bundle.
- **Active audience grounding line** — derived from the audience's stored persona mix.
- **Retrieval (RAG over video corpus)** — **DISABLED in this milestone** (embedding deferred to M2). Returns empty, scored as 0 weight.

---

## 1. The Two AI Backbones

### 1.1 Qwen client (DashScope) — the only LLM provider
`src/lib/engine/qwen/client.ts:7-50`

- **Endpoint:** `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` (OpenAI-compatible SDK)
- **Auth:** `DASHSCOPE_API_KEY`
- **`maxRetries: 0`** at SDK level — all retries managed per-stage.
- **Determinism:** `QWEN_SEED = 7` + `temperature: 0` on every scoring-critical call.

**Model IDs (env-overridable):**

| Constant | Default | Used for |
|----------|---------|----------|
| `QWEN_OMNI_MODEL` | `qwen3.5-omni-flash` | Video perception (Wave 0 / Read), audio+video+content-type |
| `QWEN_REASONING_MODEL` | `qwen3.7-plus` | **Shared workhorse:** chat, ideas, hooks, script, decode, adapt, Flash SIM text-mode |
| `QWEN_APOLLO_MODEL` | `qwen3.7-plus` | Apollo scoring judge (the Read) |
| `FOLD_MODEL` | `qwen3.5-omni-flash` | 10-archetype audience fold (the Read) |
| `QWEN_FAST_MODEL` | `qwen3.6-flash` | fallback fast path |

> ⚠️ **Note vs your memory:** memory `[[engine-model-assignment]]` says read=omni-flash, fold=omni-plus(PAID), reason=qwen3.7-plus. Code currently has **FOLD_MODEL defaulting to omni-flash** (the "WRONG/unstable diversity" variant your memory flags as pending). Escape hatch `FOLD_MODEL=omni-plus` exists. This is a live gap — see §9.

### 1.2 Flash SIM — the synthetic-audience test (the moat)
`src/lib/engine/flash/` + `build-reaction-panel.ts`

- **Model:** `QWEN_REASONING_MODEL` (text-mode, no video).
- **Entry:** `runFlashTextMode(text, framing, panel, audienceRepaint)` — framing ∈ `"hook" | "idea" | "chat"` (swaps the question + verbiage only; system prompt `STABLE_FLASH_SYSTEM_PROMPT` in `flash/flash-prompts.ts`).
- **Panel:** `buildReactionPanel(profileRow, audience)` → `{ panel, audienceRepaint }`. `panel` = niche/contentType; `audienceRepaint` = per-archetype repaint words (undefined for General).
- **Output:** `{ personas: [{archetype, verdict:"stop"|"scroll", quote}] }` → aggregated:
  - **band:** ≥6 stops = **Strong**, ≥3 = **Mixed**, else **Weak** (`flash/flash-aggregate.ts:64`)
  - **fraction:** e.g. "6/10 stop"
- **Used as a GATE** in ideas/hooks/remix/script (kill Weak candidates), and standalone in `/api/tools/react`.

---

## 2. LANE A — Generative Skills (`/api/tools/*`)

> **Common envelope for ALL tool routes:** auth (`supabase.auth.getUser()`, 401) → CSRF guard (415/403) → server-side length caps → `createOpenThreadLazy(userId)` → load active audience (`thread.active_audience_id` → `getAudience()` → `GENERAL_AUDIENCE` fallback) → run pipeline → SSE stream `content` event first (card faces), `score` event a beat later (band chip = content-first UX) → `insertMessage()` persists typed blocks → KC version stamped (`kcStamp().kcGenVersion`).

### 2.1 Ideas — `/api/tools/ideas` (SSE)
`route.ts:75-309` · runner `src/lib/tools/runners/ideas-runner.ts`

- **Input:** `ask` (≤2000), `platform`.
- **Grounding:** `KC_IDEAS_SYSTEM_PROMPT` + `IDEAS_OUTPUT_CONTRACT`; user msg via `assembleBundle({mode:"idea"}, profileRow)` (profile roles: niche, audience, goals, voice, wins, flops, platform); `buildAudienceGroundingLine()` → `whyItFits`.
- **Model calls:**
  1. **Generate ~5 ideas** — Qwen `json_object`, temp 0, seed 7.
  2. **Flash SIM gate per idea** (parallel) — `runFlashTextMode(seedHook,"idea",...)` + `critiqueAgainstRubric()`. Keep if `band !== "Weak" && verdict.pass`. Up to **3 survivors**.
  3. **Follow-up chat** — Qwen stream (non-fatal observation).
- **Output blocks:** `idea-card` (×≤3) + `markdown` follow-up. SSE: `stage`/`content`/`score`/`followup`/`done`.

### 2.2 Hooks — `/api/tools/hooks` (SSE) — *flagship moat chain*
`route.ts:79-312` · runner `hooks-runner.ts`

- **Input:** `ask` (≤2000), `platform`, `anchor` (≤5000, e.g. an idea to develop).
- **Grounding:** `KC_HOOKS_SYSTEM_PROMPT` + `HOOKS_OUTPUT_CONTRACT`; `assembleBundle({mode:"hooks"})`; audience grounding line.
- **Model calls:**
  1. **Generate ~8 hooks** — Qwen `json_object`, temp 0, seed 7.
  2. **Flash SIM gate per hook** (parallel) — SIM + critic, combined gate. Keep top **5** ranked by band tier → stop-count → gen order.
  3. **Follow-up chat** — Qwen stream.
- **Output blocks:** `hook-card` (×≤5, carries rank + `scrollQuote` on face) + `markdown`.

### 2.3 Script — `/api/tools/script` (SSE)
`route.ts:67-281` · runner `script-runner.ts`

- **Input:** `ask` (≤2000), `platform`, `anchor` (≤5000).
- **Grounding:** `KC_SCRIPT_SYSTEM_PROMPT` + `SCRIPT_OUTPUT_CONTRACT`; `assembleBundle({mode:"script"})`.
- **Model calls:**
  1. **Generate 1 script** — Qwen `json_object` (beats/timing/retention/openingBeatSeed).
  2. **Flash SIM gate on the OPENER only** — `runFlashTextMode(openingBeatSeed,"hook",...)`.
  3. **Follow-up chat** — Qwen stream.
- **Output blocks:** `script-card` + `markdown`.

### 2.4 Chat — `/api/tools/chat` (SSE, GET+POST)
`route.ts:103-326` · runner `chat-runner.ts:204-311`

- **Input (POST):** `ask` (≤2000), `platform`, optional `personaGrounding` `{archetype, reactionToConcept:{verdict,quote}, conceptText}` (the "Ask them why →" persona chat).
- **GET:** rehydrates persona-chat sub-thread turns by archetype.
- **Grounding:**
  - System = `KC_CHAT_SYSTEM_PROMPT`, optionally **prefixed** with `buildPersonaSystemPrefix(archetype,verdict)` (sourced READ-ONLY from `ARCHETYPE_DEFINITIONS` + `ARCHETYPE_TRIGGERS`).
  - User = `assembleBundle({mode:"chat"})` (minimal roles: niche/audience/platform) + audience grounding line folded into overrides + **prior turns** (`serializePriorTurns`, soft cap 20) as anchor.
  - **Cold-start signal:** `isColdStart(profileRow)` → emitted as `meta` SSE frame FIRST.
- **Model call:** Qwen **streaming**, temp **0.3**.
- **Output:** SSE `meta`→`token`*→`done`. Blocks: `markdown` or `persona-chat-turn` (user + assistant turns both persisted).

### 2.5 Remix — `/api/tools/remix/run` (SSE)
`route.ts:78-268` · runner `remix-runner.ts` · engine `src/lib/engine/remix/*`

- **Input:** `url` (TikTok), `platform`. (Also a parallel `/api/remix/adapt` route — see §5.6.)
- **Pipeline (graceful per-stage errors → `resolve_failed`/`decode_failed`/`adapt_failed`):**
  1. `resolveAndRehost(url)` — Apify → mp4 → re-host to Supabase signed URL (cleanup in finally, derive-and-drop).
  2. `analyzeVideoWithOmni(signedUrl)` — Omni **perception only** (NOT the protected scoring path).
  3. `runDecode(structural)` — Qwen `qwen3.7-plus`, thinking on, → **4 beats** (hook_pattern/structure/the_turn/emotional_beat) + repeatable + luck.
  4. `generateAdaptConcepts()` — Qwen → 3 concepts; pick **one**. **Luck never mapped in** (content-leak guard).
  5. **Flash SIM gate** on the adapted hook only.
- **Output block:** `remix-card` (carries real `sourceDecode` anatomy = the moat).

### 2.6 Refine — `/api/tools/refine` (SSE)
`route.ts:66-340`

- **Input:** `skill` ("hooks"|"idea"), `instruction` (≤2000), `anchor` (≤5000, the original card), `cardRef`, `platform`.
- **Behavior:** folds instruction into a refined ask → **re-runs the full hooks/ideas pipeline** (fresh SIM gate, moat preserved) → takes TOP survivor → **append-only** (never overwrites original card). Plus a one-line chat note (user content fenced).

### 2.7 React ("type-to-room") — `/api/tools/react` (JSON, no stream)
`route.ts:62-138`

- **Input:** `text`, `framing` ("hook"|"idea"). Zod-validated.
- **Audience resolved SERVER-SIDE** from open thread (never from body — CR-01).
- **Model call:** ONE `runFlashTextMode()`. → `{fraction, scrollQuote}`. **Ephemeral, not persisted.**

### 2.8 Explore — `/api/tools/explore` (SSE) — *NO LLM*
`route.ts:155-382` · runner `explore-runner.ts`

- **Input:** `niche`/`accounts`/`input` (≤200), `serendipity` (0..1), `tracked`.
- **Hard constraint:** NO SIM, NO scoring. Pure pipeline:
  1. Apify scrape (limit 30) per source, dedup.
  2. `rankOutliers()` — recency window + half-life decay (measured multiplier).
  3. `rankWithAudienceFit()` — **pure math** re-rank (fit = "estimate", never a band).
- Per-user daily cap (`checkUserCap`/`recordUserPull`), per-day cache. **Output block:** `outlier-grid`.

### 2.9 Ideas/develop — `/api/tools/ideas/develop` (JSON)
`route.ts:48-134` — pinned chain anchor: runs the **real** hooks pipeline synchronously, returns `{threadId, messageId, fencedHooksBundle, ideaId}`.

---

## 3. LANE B — The Read (video analysis, `/api/analyze`)

`src/app/api/analyze/route.ts:397-1171` · engine `src/lib/engine/pipeline.ts`

**Input modes:** `text` | `tiktok_url` | `video_upload` | `remix`. TikTok URLs are resolved+rehosted via Apify (SSRF allowlist enforced).

**Pipeline stages → final score:**

```
validate → normalize → fetchCreatorContext (DB, no LLM)
   │
   ├─ WAVE 0: analyzeVideoWithOmni()        [QWEN_OMNI_MODEL]  → hook decomp, audio/video signals, segments
   │     └─ fires filmstrip extraction (fire-and-forget)
   │
   ├─ APOLLO: reasonWithDeepSeek()          [QWEN_APOLLO_MODEL] → 6 dims + composite_score + rewrites
   │     system = APOLLO_SYSTEM_PROMPT = KNOWLEDGE_CORE (byte-stable) + output contract
   │     composite = 0.80·hook + 0.04·(retention+clarity+share_pull+substance+credibility)
   │
   ├─ FOLD: runFold()                       [FOLD_MODEL]        → 10 archetypes × per-segment attention
   │     system = STABLE_FOLD_SYSTEM_PROMPT; persona weights fyp .65 / niche .20 / loyalist .10 / cross .05
   │
   └─ RETRIEVAL: runBenchmarkRetrieval()    [DISABLED → empty, score=null, weight 0]
   │
   ▼
aggregateScores()  (src/lib/engine/aggregator.ts)
   overall = 0.5·apollo_composite + 0.5·fold_audience  (video mode)
           = apollo_composite                          (text / no-fold)
   + confidence (signal coverage + model agreement) → HIGH/MEDIUM/LOW
```

- **Caching:** `prediction-cache.ts` — L1 memory (24h) + L2 Supabase, key = `contentHash::ENGINE_VERSION::userId`. `ENGINE_VERSION` bump auto-invalidates (currently `3.19.0`).
- **Persistence:** `analysis_results` row (placeholder INSERT before stream → UPSERT after). Sub-results in `variants` JSONB: `craft`, `apollo`, `remix.decode`/`remix.adapt`, `filmstrip_segments`.
- **Adjacent routes:** `/api/analyze/[id]/stream` (poll), `/script` (deterministic, no LLM), `/chat` (see §4.2), `/comparisons`, `/override`, `/filmstrips`.

---

## 4. Threads & Chat (the spine)

### 4.1 Data model
- **`threads`** (`database.types.ts:1728`): `type` "open"|"grounded", `reading_id` (null for open), **`active_audience_id`** (the per-thread audience pin), `user_id`.
  - **Open thread** = one per user (unique partial index), holds all generative skill output.
  - **Grounded thread** = one per reading.
  - Dedup: `createOpenThreadLazy` / `getOpenThread` (`threads.ts:134-201`) — insert-then-reselect on 23505, scoped by user_id.
- **`messages`** (`:1117`): `role`, `body` (jsonb = `Block[]` or `{kcGenVersion, blocks}`). Loaded via `loadMessages()`.
- **`analysis_chats`** (`:180`): SEPARATE table for per-reading expert chat (`role`, `content`, `scope`).

### 4.2 Two distinct chat flows
| | Open Chat (`/api/tools/chat`) | Per-Reading Expert Chat (`/api/analyze/[id]/chat`) |
|---|---|---|
| Grounding | profile + audience + prior turns + KC_CHAT slice | the analysis row (scope-narrowed: audience/engine/verdict/actions/content) |
| Model | Qwen stream temp 0.3 | Qwen stream temp 0.3, Apollo persona |
| Persistence | `messages` (open thread) | `analysis_chats` |
| Citations | n/a | **§N labels, NOT real RAG** (all context in system prompt) — see `[[chat-citations-not-grounded]]` |

### 4.3 Block discipline (D-14 double-validation)
`src/lib/tools/block-registry.ts` — every block validated at **write** (`insertMessage`) AND **rehydrate** (`loadMessages`) AND **render** (`MessageBlocks`). Invalid → `UnsupportedBlock` placeholder. Block types: markdown, idea-card, hook-card, script-card, remix-card, outlier-grid, account-read, band, personas, persona-chat-turn, multi-audience-read.

---

## 5. LANE C — Audience + Data Collection

### 5.1 Audience lifecycle (`src/lib/audience/*`, `/api/audiences/*`)

**CREATE** (`/api/audiences` POST → `createAudience`): name, type (personal|target), platform, goal_label, goal_intent (grow|sell|authority|nurture). user_id from session.

**CALIBRATE** (`/api/audiences/calibrate` SSE, `calibration.ts:172-262`):
1. **personal:** Apify `scrapeProfile` + `scrapeVideos(30)`. **Thin-data gate** (`<10 videos` or no follower tier) → honest fallback to General, **never fabricates personas**.
2. **target:** description only, zeroed profile.
3. `deriveAudienceProfile()` → temperature mix + top dispositions + follower tier.
4. `biasForGoalIntent()` → persona weights (locked table, baked ONCE).
5. `repaintPersonas()` → **10 `CalibratedPersona`** — **deterministic, NO LLM** (template: archetype base + goal-intent suffix).

**Persona model** (`audience-types.ts:63-76`): `archetype` (engine slug), `repaint` (stored for prompt fold), `temperature` (cold/warm/hot), `disposition` (scanner/skeptic/collector/connector/converter/lurker), `share`, optional `label`. Temperature×disposition is a locked 10-archetype map.

**Virtual audiences:** `GENERAL_AUDIENCE` (sentinel, default weights), 2 `PRESET_AUDIENCES`.

### 5.2 How audience feeds skills
`thread.active_audience_id` (set via AudienceChip → PATCH `/api/threads/[id]`) → runner loads it → `resolveAudienceWeights()` + `buildReactionPanel()` → Flash SIM reacts with these personas. Bias is **pre-baked at calibration, never re-applied per-call**.

### 5.3 AudienceLens (the UI spine) — `src/components/audience-lens/AudienceLens.tsx`
One component all skills mount: Panel (10 personas) ⇄ Population (1000 dots) scale, ReplayController, ClusterView, PersonaChatDrawer ("Ask them why →" → `/api/tools/chat` persona grounding), and the **Rewrite-for-audience** loop.

### 5.4 Discover — `/api/discover` (NO LLM)
Apify scrape (profile|niche) → `outlier-compute.ts` (median baseline × half-life decay → multiplier) → ranked tiles. Per-tier daily cap + per-day cache.

### 5.5 Account Read — `/api/account-read` (SSE, NO LLM)
Scrapes creator's own handle → deterministic pattern extraction (recurring hooks, format mix, drop points, working, fix) + track-record from reconciliations. Thin gate (`<10` videos). Block: `account-read`.

### 5.6 Remix Adapt — `/api/remix/adapt` (separate from §2.5)
Takes `decode` + `niche` from the wire (does NOT read DB — structural guard), `generateAdaptConcepts()` → 3 concepts → persists to `variants.remix.adapt`.

### 5.7 Flywheel — `/api/flywheel/proposals` (NO LLM)
Reconciliation divergences → `evaluateGate()` (confidence gate) → `buildOverride()` (bounded ±0.1 weight shift) → updates `audience.persona_weights` on confirm. Refuses General/preset.

### 5.8 Scraping & crons — `src/lib/scraping/apify-provider.ts`
Apify actors: `clockworks/tiktok-profile-scraper`, `clockworks/tiktok-scraper`, `apidojo/tiktok-scraper-api` (paid single-post). SSRF allowlists on mp4/post hosts. Crons: scrape-trending, calculate-trends, refresh-competitors, **refresh-corpus (STUB)**, **audience-drift** (weekly re-scrape → drift detection → reconciliation rows), delete/sweep retained videos, sync-whop.

---

## 6. Grounding (Knowledge Core)

`src/lib/kc/*` + `.planning/corpus/*.md`

- **KC = static owner-curated markdown** (`base.md` + per-mode `ideas/hooks/chat/script.md`), compiled by `scripts/regen-kc.ts` → **byte-stable** `KC_*_SYSTEM_PROMPT` constants (`compiled.ts`). Byte-stability = DashScope input-cache hits.
- **`assembleBundle()`** (`assembler.ts:214-311`) = per-request volatile tier: pulls only the mode's profile roles, fences user content (`<<<USER_CONTENT>>>`), caps at 4000 chars. Honest cold-start ("using {platform} baseline").
- **Niches** (`src/lib/niches/taxonomy.ts`): 10 primaries × sub-niches, each with persona mix + benchmark filters.
- **Retrieval/RAG: DISABLED** (`retrieval-empty.ts`) — embedding deferred to M2. The full pgvector pipeline exists dormant in `engine/retrieval/`.
- **Version provenance:** `KC_GEN_VERSION` (`gen.1.1.0`) stamped on every message.

---

## 7. Quick navigation index

| You want to find… | Go to |
|---|---|
| Which model a skill calls | §1.1 table + each skill in §2 |
| How a hook gets its band | §1.2 Flash SIM + §2.2 |
| Where the Read score comes from | §3 pipeline diagram |
| How an audience is built | §5.1 |
| Where personas come from | §5.1 (deterministic repaint, no LLM) |
| Why chat citations aren't grounded | §4.2 + `[[chat-citations-not-grounded]]` |
| What's NOT wired (gaps) | §9 |
| KC prompt source files | §6 + `.planning/corpus/*.md` |

---

## 8. Cross-cutting patterns

- **Content-first UX:** SSE always sends card face (`content`) before band chip (`score`).
- **Honesty spine:** bands/fractions only, never numeric forecasts; thin data → honest fallback, never fabricated personas/scores; estimated vs measured labels distinguished.
- **Security:** auth-first, user_id/audience_id from session/thread never body (CR-01), Zod/length caps, injection fences, CSRF, SSRF allowlists, RLS + service-client reselect guards.
- **Determinism:** temp 0 + seed 7 on scoring; byte-stable prompts; deterministic persona repaint.
- **Append-only threads:** refine never overwrites; everything is a new block.

---

## 9. Logic gaps & open questions (where to look next)

1. **FOLD_MODEL default mismatch** — code defaults `FOLD_MODEL=omni-flash`, which your memory `[[engine-model-assignment]]` flags as the unstable-diversity WRONG variant (should be omni-plus PAID). Flip + cost-fix still pending. → `src/lib/engine/wave3/fold.ts`, `qwen/client.ts`.
2. **Retrieval/RAG fully disabled** — every video score runs with retrieval weight 0; the corpus grounding moat is dormant. Re-enable = M2 embedding migration. → `engine/retrieval/`, `retrieval-empty.ts`.
3. **Chat citations are fake** — per-reading expert chat cites `§N` labels with no real retrieval; all context is stuffed in the system prompt. → §4.2, fix taxonomy or drop.
4. **refresh-corpus cron is a stub** — KC is static; no rolling refresh until P11/12. → `/api/cron/refresh-corpus`.
5. **Wins/flops grounding is URL-only** — grounding line says "your last N videos overperformed" with no mechanism (content not analyzed). Deferred to v6.1 RAG.
6. **`/api/tools/read` (multi-audience Read)** — comparison engine, bands-only; verify it isn't silently re-running SIM where it shouldn't. → `flash/two-audience-read.ts`.
7. **Two remix entry points** — `/api/tools/remix/run` (SSE, full pipeline) vs `/api/remix/adapt` (JSON, adapt-only from wire). Confirm UI uses the right one and they don't diverge.
8. **Account Read & Discover do zero LLM** — pure scrape+math. Opportunity (or intentional cost ceiling?) to add a Read/interpretation layer.
9. **Dead engine signals** — `ml_score`/`rule_score`/`trend_score`/`audio_fingerprint`/`platform_fit` are dormant (output null, removed from blend). Confirm no UI still reads them.
