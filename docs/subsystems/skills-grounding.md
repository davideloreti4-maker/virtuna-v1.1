# Numen Backend — In-Thread Skills + Grounding Audit

> **Scope:** how the in-thread skills (hooks · ideas · script · remix · react · read · chat · refine · explore · ideas/develop) are wired end-to-end — grounding, Qwen I/O, the generate→simulate→rank pipeline, and the per-skill differences.
> **Branch:** `main` · **Date:** 2026-06-27 · **Method:** code-verified (9 parallel deep-trace agents + direct reads of `assembler.ts`, `apollo-core.ts`, `compiled.ts`, `profile-role-map.ts`, `grounding-line.ts`). Every claim cites `file:line`.
> **Related SSOTs:** `docs/MODEL-POLICY.md` (model layer), `docs/subsystems/audience.md` (audience moat), `.planning/NUMEN-GSI-VISION.md` (future-state).
> **⚠️ This is an audit snapshot, not a contract.** When code and this doc disagree, code wins — re-verify before acting.

---

## 0. TL;DR — the barbell finding

Numen's grounding is a **barbell**: one end (the authored craft brain) is heavy and excellent; the other end (live per-creator / per-video signal) is nearly empty. The brain repeatedly **demands creator-specific grounding the live tier cannot supply**, so the model is structurally forced back toward the generic output the brain explicitly forbids. **The quality ceiling is in the pipe, not the brain.**

The single sharpest illustration: `KC_BASE`'s Value Bar **Test C** requires output to be *"different because of what is known about this creator… the niche name is not fit — it is a find-and-replace"* — but for a hook generation the live tier delivers only a niche string, audience **demographics**, and **count-only** wins/flops (`"3 videos worked"` — never *what* or *why*; URLs stored, never scraped). The model is ordered to ground in win-patterns, handed a number, and the only fallback (niche-name insertion) is the exact failure the brain names.

---

## 1. The two-brain architecture

Numen has **two LLM brains that never share context** (bounded-context isolation, "D-08"):

| | **SCORE path** ("the Read") | **GENERATE path** (in-thread skills) |
|---|---|---|
| Fires when | analyze a video (`/api/analyze`, the `test` chip) | run a skill (hooks/ideas/script/chat/remix) |
| Entry | `pipeline.ts` → `deepseek.ts` (Apollo) | `api/tools/*/route.ts` → `runners/*` |
| Model | `qwen3.7-plus`, **thinking ON** | `qwen3.7-plus`, **thinking OFF** |
| Brain (system prompt) | `apollo-core.ts` → `APOLLO_SYSTEM_PROMPT` | `compiled.ts` → `KC_<MODE>_SYSTEM_PROMPT` |
| Live grounding (user msg) | omni **sensor JSON** + verbatim | `assembleBundle()` (profile + audience-steer), capped 4000 chars |

### Two-tier prompt design (both paths)

Every call splits context into two tiers, deliberately, for Qwen automatic input-cache hits:

- **Tier 1 — the brain.** Byte-stable system prompt. NO interpolation of per-request data / timestamps / randomness → byte-identical across requests → warm cache. This is the reusable craft IP.
- **Tier 2 — the live grounding.** The volatile user message. The per-request case file (this creator, this video, this audience).

The model reasons over Tier 1, applied to Tier 2. **The brains are not the problem; Tier 2 is thin.** (§5, §7.)

### Audio enters exactly once

`qwen3.5-omni-flash` (the **sensor**) is the only audio-capable model, used in only two places: the Wave-0 video read and the audience bake-watch. Everything downstream reasons over distilled text. That's the whole 2-model stack (`docs/MODEL-POLICY.md`).

---

## 2. The skill pipeline

No shared class — a **replicated convention** across `src/lib/tools/runners/*`. Canonical shape (hooks/ideas):

```
GENERATE  → Qwen authors N candidates   (qwen3.7-plus, thinking OFF, temp0+seed7, json_object)
SIMULATE  → SIM-1 Flash reacts as 10 personas, per candidate  (the "room")
RANK      → pure math: band tier → stop-fraction numerator → generation order
BUILD     → typed <Card>Block (zod-validated at write boundary) → persisted → streamed (SSE)
PIN       → flywheel: void pinPredictedSignature(rank-1 personas)  (fire-and-forget, non-fatal)
```

### Per-skill variation

| Skill | Pattern | Generate | Simulate | Rank | Output block | Response |
|---|---|---|---|---|---|---|
| **hooks** | Gen+Sim+Rank | 5 candidates | batched, all | yes | `hook-card` ×N | SSE |
| **ideas** | Gen+Sim+Rank | 4 candidates | batched, all | yes | `idea-card` ×N | SSE |
| **script** | Gen+Sim | 1 script | **opener only**, single | no | `script-card` ×1 | SSE |
| **remix** | Decode+Gen+Sim+Rank | 3 adapted | batched, all | yes | `remix-card` ×≤3 | SSE |
| **react** | **Sim only** | — | 1 call, ephemeral | — | none (JSON `{fraction,scrollQuote}`) | JSON |
| **read** | **Sim only ×2** | — | 1 per audience | delta (math) | `multi-audience-read` ×1 | JSON |
| **chat** | **Gen only** | streamed markdown | — | — | `markdown`/`persona-chat-turn` | SSE |
| **refine** | Gen+Sim+Rank (scoped) | re-runs hooks/ideas pipeline | yes | top survivor only | appends 1 card | SSE |
| **explore** | **No LLM** | — | — | scrape+math | `outlier-grid` ×1 | SSE |
| **ideas/develop** | Gen+Sim (inline) | runs hooks pipeline | yes | yes | `hook-card` ×N | JSON |

### UX entry (composer → route → thread)

One universal composer (`composer.tsx`). `/`-slash or chip picks `activeTool`; each tool has its own stream hook → `POST /api/tools/<skill>` → SSE → typed blocks rendered via `block-registry.ts` (schema SSOT) → `message-blocks.tsx` (component map, 11 block types). All in-thread skills write to **one** `type:"open"` thread (`reading_id:null`, `createOpenThreadLazy`). Audience is pinned per-thread (`thread.active_audience_id`, resolved server-side, **never from request body** — CR-01). The `test` chip is the exception: it POSTs `/api/analyze` (the SIM-1 Max video pipeline) and navigates to `/analyze/[id]`.

**Chain handoffs** (skill→skill CTAs): declarative SSOT `chain-handoff.ts` (`CHAIN_HANDOFFS`). Key edges: `idea→hooks` (`/tools/ideas/develop`), `hooks→script` (card anchor), `hooks/script→test` (React context, no endpoint), `remix→hooks`, `discover→remix`, same-skill "Rewrite for this audience".

---

## 3. Skill-by-skill contract cards

Common substrate (hooks/ideas/script/remix generate): model `QWEN_REASONING_MODEL` = `qwen3.7-plus` (`qwen/client.ts:41`), `temperature:0`, `seed:7`, `enable_thinking:false`, `response_format:json_object`, `GENERATE_TIMEOUT_MS=300_000`. SIM tag on every card = the literal `"sim1-flash"` — a **provenance label**, not the model id; the real Flash call runs on `FLASH_MODEL` defaulting to `qwen3.7-plus` (`run-flash-text-mode.ts:51`). Shared audience plumbing: `buildReactionPanel(profileRow, audience)` → `{panel, audienceRepaint}`; `buildFlashWeighting(audience)`; `simIntent` gated calibrated-only; FLYWHEEL `pinPredictedSignature`.

### hooks (reference template)
- **Route** `api/tools/hooks/route.ts`: POST `{ask, platform, anchor?, intent?}`; auth→CSRF→caps (`MAX_MESSAGE_LENGTH 2000`, `MAX_ANCHOR_LENGTH 5000`); profile by session id; active audience from thread; SSE (`stage`/`content`/`score`/`done`/`followup`); persists `hook-card` blocks + a second `markdown` follow-up.
- **Runner** `hooks-runner.ts:285` `runHooksPipeline`: STEER (`buildAudienceGroundingLine` + `applyCreatorPersona` → overrides) → GENERATE (`generateHooksStructured`, Qwen `:164`, `max_tokens 1500`, system `KC_HOOKS_SYSTEM_PROMPT + HOOKS_OUTPUT_CONTRACT`) → RATE (batched `runFlashTextModeBatch`, `:373`) → keep-all → RANK (band → fraction → gen order) → BUILD (`HookCardBlockSchema.safeParse`) → PIN.
- **Block** `blocks.ts:133` `hook-card`: `hookLine, audienceArchetype, mechanism, seedHook, rank, band, fraction, scrollQuote, model, channel, personas?`.

### ideas
- **Route** `api/tools/ideas/route.ts`: POST `{ask?, platform?, intent?}` — **no `anchor`** (ideas is the chain head). Same envelope as hooks.
- **Generate** `generateIdeasStructured` (Qwen `ideas-runner.ts:181`, `max_tokens 2000`), `IDEA_COUNT=4`, system `KC_IDEAS_SYSTEM_PROMPT`. Slice essence: idea = Topic × Take × Format; deliverable is the *concept*, not the hook; `needsTake` flag for takes the creator must supply first-hand.
- **SIM/rank** identical batched path to hooks (framing `"idea"`).
- **Block** `blocks.ts:82` `idea-card`: adds `whyItFits, topic, take, format, needsTake` over hooks.
- **Grounding divergence ⚠️:** `whyItFits` (`buildAudienceGroundingLine().line`) is **display-only** — baked onto the card, **NOT folded into the generation prompt**. Overrides into `assembleBundle` = `creatorSteer` only (`:309`). Hooks/script instead inject the line into generation. `MODE_ROLES.idea` is the only mode pulling all 7 roles incl `goals`.

### script
- **Route** `api/tools/script/route.ts`: POST `{ask?, platform?, anchor?, intent?}` (anchor = chosen hookLine, Hooks→Script).
- **Generate ONE** `generateScriptStructured` (Qwen `:141`, `max_tokens 2000`) → `StructuredScript | null`. Beats: Hook(0–3s)→Setup(3–20s)→Turn(20–45s)→Payoff(45–55s)→CTA, each with a private `retentionMarker` (prose, never a number). "Self-judge" = a structural empty-beats drop, **not** an LLM judge.
- **SIM (opener-only)** `runFlashTextMode(openingBeatSeed, "hook", …)` (`:304`) — single call, scores the opener AS a hook, **no rank**. Honesty spine: band/fraction are opener-only, not full-watch.
- **Block** `blocks.ts:177` `script-card`: `beats[], openingBeatSeed, band, fraction, scrollQuote, personas?`. No `whyItFits`, no `rank`.
- **Grounding:** folds `"Write for this audience — {line}"` + `creatorSteer` into generation overrides (like hooks). `MODE_ROLES.script` excludes `goals`.

### remix (most complex)
- **Route** `api/tools/remix/run/route.ts`: POST `{url, platform?, intent?}`; `maxDuration=300`; SSE stages are emitted as active-then-done around a single pipeline call (no true per-phase telemetry); persists `remix-card` blocks.
- **Pipeline** `remix-runner.ts:131`: RESOLVE (`resolveAndRehost`, Apify download + 1h signed mp4, SSRF-validated, **no LLM**) → PERCEIVE (`analyzeVideoWithOmni`, **`qwen3.5-omni-flash`**, the only video-perception call in any in-thread skill) → DECODE (`runDecode`, `qwen3.7-plus`, KC §5, 4-beat anatomy + repeatable/luck lanes) → ADAPT (`generateAdaptConcepts`, `qwen3.7-plus`, KC §6, 3 concepts; **luck NEVER passed**, D-01) → RATE (batched Flash on adapted hooks) → RANK → BUILD (≤3 cards, shared `sourceDecode`) → `cleanup()` in `finally`.
- **Block** `blocks.ts:218` `remix-card`: `adaptedHook, angle, whoItsFor, formatBorrowed, sourceDecode{hookPattern,structure,theTurn,emotionalBeat}, band, fraction, scrollQuote, audienceName?, personas?`.
- **Grounding asymmetry ❌ (worst of the generate family):** remix-runner does **NOT** call `applyCreatorPersona` (no creator voice, no `creatorSteer`) AND computes `buildAudienceGroundingLine` then **discards it** (`void groundingLine`, `:142`). The adapt generation is grounded by **`KNOWLEDGE_CORE` + a niche string only**; audience/creator reach generation never as steer text, only as a `· {name} ({goal})` niche suffix and at the downstream SIM gate.
- **Stale:** header comments say "Pick concepts[0] / 0-or-1 block" — code emits up to 3 (keep-all).

### react (pure SIM, ephemeral)
- **Route** `api/tools/react/route.ts`: POST `{text, framing?, intent?}`; the "test a thought" cheatcode. ONE `runFlashTextMode` (`:142`) → `aggregateFlash` + `selectLeadScrollQuote` → `Response.json({fraction, scrollQuote})`. **No blocks, no persistence.** Reuses the same `buildReactionPanel` as the runners (identical room). Driven by the audience-presence panel in the composer.

### read (2-audience pure SIM)
- **Route** `api/tools/read/route.ts`: POST `{concept, secondAudienceId?, audienceIds?}`; compares active vs General (or an explicit pair); returns `{block}` JSON (not SSE); persists `multi-audience-read`.
- **Runner** `two-audience-read.ts:159`: per audience `runFlashTextMode(concept, "idea", …)` → `aggregateFlash` → `deriveWhoNotFor`; `buildDelta` is pure band-rank arithmetic (no model call) producing `interpretation` + the **Lever**. **No Qwen generation.**
- **Quirk:** `aggregateFlash` is called **without** `FlashWeighting` (`:82`) → flat stop-count band, not the weighted-mass path; calibration moves the verdict only through repaint-steered persona prompts. `resolveAudienceWeights` computed then `void`ed (dead).
- **Block** `blocks.ts:338` `multi-audience-read`, `.strict()` (forbids any numeric `score` — bands-only honesty).

### chat (generate-only, streamed)
- **Route** `api/tools/chat/route.ts`: POST streams tokens (`meta`/`token`/`done`), persists `markdown` (open) or `persona-chat-turn` (in-voice) blocks; GET rehydrates a persona sub-thread by `?archetype=`.
- **Qwen** `chat-runner.ts:279`: `qwen3.7-plus`, `enable_thinking:false`, **`temperature:0.3`, NO seed**, `max_tokens:2000`, streamed. **No SIM, no scoring core, no cards.**
- **Grounding:** `KC_CHAT_SYSTEM_PROMPT` (BASE-heavy; thin stance slice) + `assembleBundle(mode:"chat")`. **Voice-free by design** — `MODE_ROLES.chat = [niche, audience, platform]` (no `voice`). Persona-grounded chat prepends `buildPersonaSystemPrefix(archetype)`; concept+quote ride the fenced `overrides`.

### refine (the hybrid)
- **Route** `api/tools/refine/route.ts`: re-runs the **full** `runHooksPipeline`/`runIdeasPipeline` (with Flash SIM) scoped to one card (instruction + anchor), takes `allBlocks[0]` (top survivor), appends ONE freshly-scored card. Band/fraction always from the fresh run.
- **Routing:** composer fires refine only in `activeTool==="chat"` when `detectRefineIntent(ask)` matches (bounded heuristic: refine-verb + card-noun + ordinal-bound-to-noun, all three). Else plain chat.
- **Follow-up note:** `temp:0.4`, no seed, `KC_CHAT_SYSTEM_PROMPT`, off critical path.

### explore (no LLM)
- **Route** `api/tools/explore/route.ts`: POST `{niche?, accounts?, input?, tracked?, serendipity?, timeWindow?}`; daily cap (`checkUserCap` → 429); SSE; persists `outlier-grid`.
- **Runner** `explore-runner.ts:87`: `provider.scrapeVideos` (Apify) → `rankOutliers` (recency half-life × view-multiplier) → `rankWithAudienceFit` (Jaccard niche-match + temperature-mix dot-product). **Zero LLM** (verified — no qwen/flash imports). Real persona reaction is deferred to lazy on-tap remix-cards.
- **Block** `blocks.ts:269` `outlier-grid`: measured tiles (`multiplier, baselineLabel, fit?{level}`), deliberately no `model`/`band`/`score`.
- **Quirk:** `timeWindow` param accepted then `void`ed (unimplemented).

### ideas/develop (chain anchor)
- **Route** `api/tools/ideas/develop/route.ts`: POST plain JSON (no SSE). Runs `runHooksPipeline({ask:"", platform, profileRow, anchor})` inline with the idea as anchor, persists `hook-card`s, returns `{threadId, messageId, …}`.
- **Gap ❌:** does **not** load the active audience and does **not** pass `audience`/`intent`/`pin`. The "Develop this →" chain always generates **General-grounded, intent-less hooks with no flywheel pin** — silently dropping the calibration the direct Hooks route applies. Likely unintended debt.

---

## 4. The Qwen model layer

Central client `qwen/client.ts`: a single DashScope-Intl OpenAI-compatible instance, `maxRetries:0` (each stage owns its retry), `QWEN_SEED=7`. Env seams: `QWEN_OMNI_MODEL`=omni-flash (sensor), `QWEN_REASONING_MODEL`=3.7-plus (everything), `QWEN_APOLLO_MODEL`=3.7-plus (scoped). Determinism = `temperature:0 + seed:7` on every scoring/generation site; `enable_thinking:false` applied via the `@ts-expect-error`/cast pattern. Thinking ON only at Apollo + Calibrate-synth.

| Role | Call site | Model | Think | max_tok | Modality | Out schema |
|---|---|---|---|---|---|---|
| SENSOR (Wave-0) | `qwen/omni-analysis.ts:259` | omni-flash | off | 8000 | video+audio | `OmniAnalysisZodSchema` (+coerce, 1 retry) |
| SENSOR (bake-watch) | `enrich-signature.ts:283` | omni-flash | off | 600 | video+audio | `WatchNoteSchema` (→null) |
| CALIBRATE synth | `enrich-signature.ts:340` | 3.7-plus | **ON** (2000) | 6000 | text | `SynthSchema` (throws) |
| FOLD (Read audience) | `wave3/fold.ts:352` | 3.7-plus | off | 8000 | video (deaf) or text | `FoldResponseSchema` (+coerce, salvage) |
| APOLLO | `engine/deepseek.ts:537` | 3.7-plus | **ON** (1500) | 3000 | video (deaf) or text | `DeepSeekResponseSchema` (3 retries, breaker) |
| TEXT-ANALYZE (no-video) | `pipeline.ts:635` | 3.7-plus | off | 2000 | text | manual shape check |
| SIM N=1 | `run-flash-text-mode.ts:147` | 3.7-plus | off | 1000 | text | `FlashResultSchema` (10, throws) |
| SIM batch | `run-flash-text-mode.ts:256` | 3.7-plus | off | 3500 | text | per-candidate safeParse (bad drops itself) |
| GENERATE hooks/ideas/script | runners | 3.7-plus | off | 1500/2000/2000 | text | inline shape map |
| DECODE / ADAPT | `remix/decode.ts`, `remix/adapt.ts` | 3.7-plus | off | 1200 | text | Zod + coerce |
| CONVERSE chat/refine/analyze-chat | runners/routes | 3.7-plus | off | 2000 | text, streamed | token deltas, **temp 0.3/0.4, no seed** |

**Drift from MODEL-POLICY.md (flag):** `src/lib/ai/deepseek.ts` + `gemini.ts` (competitor-intelligence) are documented as "dead deletion candidates" but are **LIVE** (via `ai/intelligence-service.ts` → `competitors/[handle]/page.tsx` + `api/intelligence/[id]/route.ts`) and **drift**: no `temperature`/`seed`/`enable_thinking`/`max_tokens` set → run thinking-ON + unbounded + non-deterministic, outside the two-place thinking policy. Either fix or actually kill.

---

## 5. Grounding deep-dive

### 5.1 The generation brain — `src/lib/kc/compiled.ts` (86 KB)

`KC_<MODE>_SYSTEM_PROMPT = KC_BASE + "---" + KC_<MODE>_SLICE` (`:1371-1380`).

- **`KC_BASE`** (`:15`, domain-general, shared by all 4 generate modes): Voice/Stance → How to Read These Mechanisms → 6 Universal Craft Principles (comprehension, open loop, prediction error, pattern interrupt, stakes, re-hook) → Distribution Mechanisms (watch-time/comments/shares/saves, each with distinct drivers) → Funnel → **Output Discipline** (scaffolding is private) → **6 Anti-Generic Guardrails** → **Value Bar** (3 self-rejection tests: A named-mechanism, B concrete-instantiation, C fit-to-creator).
- **Slices** (`:321` ideas, `:587` hooks, `:1009` chat, `:1120` script): point BASE at the specific job + output shape.

This is genuinely strong, hand-authored craft IP. It is the moat content.

### 5.2 The scoring brain — `src/lib/engine/apollo-core.ts` (31 KB)

`APOLLO_SYSTEM_PROMPT = KNOWLEDGE_CORE + "---" + APOLLO_INSTRUCTION` (`:254`).

- **`KNOWLEDGE_CORE`** (`:40`, runtime-lean variant — §2.6/§7/§8 omitted): §1 Persona/Voice → §2 Craft Frameworks as detailed *detect-triples* (Signal · Mechanism · Strong/Mid/Weak) → §2.0a **hard calibration anchors** (≤3s hook, 90% retention, hook≈80% of outcome, 5× follower-count outlier) → §3 anti-patterns → §4 scoring rubric → §5 decode lens → §6 rewrite lens.
- **`APOLLO_INSTRUCTION`** (`:235`): the §4 output contract — band anchors **Strong→85 / Mid→50 / Weak→20** (the fixed mapping that makes the TS-computed composite deterministic); cite §-tokens ONLY in metadata fields. `PRESENT_SECTIONS` (`:264`) is the §-cite whitelist; the deepseek.ts guard strips danglers.

Both brains share the decode/adapt prefix (remix's decode + adapt import `KNOWLEDGE_CORE`).

### 5.3 The live grounding tier — `src/lib/kc/assembler.ts`

`assembleBundle(input, profileRow)` produces the **volatile user message** (Tier 2). `BUNDLE_CHAR_CAP=4000` (`:53`). Pulls only `MODE_ROLES[mode]` roles (`:117`), drops lowest-priority roles from the **tail** when over cap (whole-line, never mid-field); `voice` is deliberately NOT last so a routine cap-drop doesn't silently strip the creator's voice. User text (ask/overrides/anchor) is injection-fenced in `<<<USER_CONTENT>>>` and never dropped.

`MODE_ROLES`:
- `idea`: niche, audience, goals, voice, wins, flops, platform (all 7 — only mode with `goals`)
- `hooks` / `script` / `remix`: niche, audience, voice, wins, flops, platform (no goals)
- `chat`: niche, audience, platform (**no voice** — base-neutral by design)

### 5.4 What the profile roles actually pull — `src/lib/kc/profile-role-map.ts`

| Role | What reaches the prompt |
|---|---|
| niche | `"Niche: {primary} > {sub}"` — a string |
| audience | demographics only: age/gender/geo/language. **No psychographics, no interests.** |
| goals | `primary_goal` + `creator_stage` |
| **wins** | **COUNT ONLY** — `"Past wins (creator-reported, directional): 3 videos — steer toward patterns that worked"`. No content. URLs stored, never scraped. |
| **flops** | COUNT ONLY — same caveat, as negative grounding. |
| voice | verbatim `writing_voice_sample`, fenced, "emulate STYLE only" (this one's good) |

Comments explicitly flag wins/flops enrichment as deferred: *"Full content enrichment deferred to v6.1 (PROFILE-01 / RAG)."* No scrape/enrich path exists in code.

### 5.5 The audience signature — rich object, ~70% wasted

The bake (`enrich-signature.ts`: 1 scrape → omni-watch 3–5 videos → 1 thinking-ON synth) produces a frozen `AudienceSignature`: `creator_persona` + 10 reactor personas, each with `reaction_frame` + `evidence`, plus `what_resonates` / `what_falls_flat` / `interest_tags` / `temperature_mix` / `persona_weights` / `summary`.

**Only 3 projections ever reach a prompt:**
- `reaction_frame` → SIM/fold repaint (`build-reaction-panel.ts` substitutes per-archetype description)
- `creator_persona` → generation steer/voice (`applyCreatorPersona`)
- `persona_weights` → band weighting (`buildFlashWeighting` → `aggregateFlash`)

Everything else — `evidence`, `what_resonates`, `what_falls_flat`, `interest_tags`, `temperature_mix`, `maturity` — is storage/UI/reveal only. **The bake already pays for the exact "fit to this creator" signal Test C demands; the generate pipe drops it.**

Also: the hot path reads the back-compat projection (`audience.personas[].repaint`, `audience.creator_persona`), **never** `audience.signature` directly — desync risk if a signature is written without re-deriving `personas`.

---

## 6. The generation-side audience-steering matrix (asymmetry finding)

Whether the calibrated audience + creator persona actually **steer generation** (not just SIM scoring) is **inconsistent across skills**:

| Skill | `applyCreatorPersona` (voice + creatorSteer) | audience grounding line → generation |
|---|---|---|
| hooks | ✅ | ✅ folded into overrides |
| script | ✅ | ✅ folded into overrides |
| ideas | ✅ | ⚠️ **display-only** (`whyItFits` card prop; NOT in prompt) |
| chat | n/a (voice-free by design) | ✅ folded into overrides (calibrated only) |
| remix | ❌ **not called** | ❌ computed then `void`ed |
| ideas/develop | ❌ (doesn't load audience at all) | ❌ |

So generation-side audience+creator steering is fully wired only on hooks/script. Ideas surfaces the line but doesn't steer with it; remix and ideas/develop drop it entirely. **Normalizing this is a concrete, low-risk grounding win** independent of any new data.

---

## 7. The improvement surface (ranked)

Given the goal (improve output quality via grounding) and GSI (which wraps the brains as `DomainPack`, so deep brain *refactoring* now fights the extraction; improving the **live tier** is GSI-safe; improving brain **content** in-place survives as pack content):

| | Lever | Leverage | Effort | GSI |
|---|---|---|---|---|
| **A2** | Pipe the already-baked signature signal (`what_resonates`/`what_falls_flat`/`evidence`) into `assembleBundle` | High | **Low** (data exists, just inject) | Safe |
| **A0** | Normalize generation-side steering (§6) — give ideas/remix/develop the hooks treatment | Med-High | **Low** | Safe |
| **A1** | Scrape + pattern-extract `past_wins`/`past_flops` → real mechanisms into the bundle | High | Med | Safe |
| **A3** | Re-tune `BUNDLE_CHAR_CAP` from measured slice sizes (never done — code comment admits it) | Med | Low | Safe |
| **C** | Sharpen brain *content* (KC slices / KNOWLEDGE_CORE) — gated on restoring the regen sources (§8) | Broad | Med + friction | Survives as pack content |
| **B** | Revive RAG exemplar grounding (re-weight from 0.05; ingest already writes vectors) | High | **High** | Aligns w/ `DomainPack.grounding` |

**Recommended first move: A2** — cheapest high-value win; the bake already paid for the signal, the pipe drops it; directly attacks the Test-C gap with data you already own. **A0** is an almost-free companion (consistency bug fix). A1 is the fuller version of A2 for wins/flops.

---

## 8. Dead / dormant — don't chase ghosts

- **RAG / retrieval = dead.** `pipeline.ts` always feeds `createEmptyRetrievalResult()` at weight 0.05 → contributes nothing. Ingest *writes* pgvector embeddings nothing reads. `runBenchmarkRetrieval` has no live caller.
- **Score-calibration JSONs orphaned:** `training-data.json` (2.6 MB), `ml-weights.json`, `calibration-baseline.json` — written by offline scripts, read by no runtime. Live band anchors are **hardcoded text** in `apollo-core.ts`, not JSON.
- **`corpus/*` + `learning/*`** = offline eval harness, not in any request path.
- **`creator-rulebook.ts`** = dead (only its own test imports it).
- **`resolveAudienceWeights` / `resolvedWeights`** = `void`ed in several runners (read/chat) — wired for a future Max path, dead today.
- **`predictedFailureMode`** = always `null` (rubric critic removed); kept nullable for rehydration.
- **`seedHookPath`** = always `"structured"` (markered fallback unreachable).
- **Rate-limit constants** = `void`ed in hooks/ideas routes; no rate-limit on chat/refine (launch-gate item).
- **⚠️ Regen pipeline broken on `main`:** `compiled.ts` says "do not hand-edit, source = `.planning/corpus/*.md`" and `scripts/regen-kc.ts` reads `base.md/ideas.md/hooks.md/chat.md/script.md` — **but `.planning/corpus/` does not exist on `main`** (sources live only in sibling worktrees). Same for Apollo's `KNOWLEDGE-CORE.md`. To edit a brain today: restore the `.md` sources first, or hand-edit the committed `.ts` (against the header). **Resolve this before any brain-content work (lever C).**

---

## 9. GSI delta (current → future)

GSI extracts the socials-specific assumptions into a pluggable **`DomainPack`** = `{populations, grounding, stimulusTypes, reactionFrame, scoring, outputSchema, calibration}`. **Phases 1–3 already on `main`:** `engine/domain-pack.ts`, `packs/socials.ts` (`SOCIALS_PACK`), `packs/index.ts` (`resolvePack(mode)`), the `audiences`→general migration (`mode`/`success_criterion`/`custom_context` columns; 4-weight CHECK re-gated to `mode='socials'`), and Validated-vs-Directional trust tiers (`resolveTier` + `TrustBadge`).

Load-bearing facts for grounding work:
- The Apollo/virality scoring math is **wrapped by reference** (`SOCIALS_PACK.scoring.run = aggregateScores`), **NOT refactored** — and refactoring it is explicitly out-of-scope. → improving brain *content* in-place is fine; deep structural refactor is not.
- Grounding flips from "Numen authors one TikTok core" to **two tiers**: Validated anchor packs (the socials brain becomes **Anchor Pack #1**) + BYO Directional SIMs (crowd-supplied, honestly labeled). → grounding-quality work on the socials core stays valuable.
- The signature substrate + assembler are **kept untouched** by GSI → the live-tier levers (A0/A1/A2/A3) are squarely GSI-safe.
- OUT-OF-SCOPE: open-world prediction; SIM-1 as a user-selectable model; `git merge rework/engine-core`.
- Next GSI phase = 4 (Input Adapter). Phases 4–7 are the still-future deltas. **P5 security flag:** `simulate()` is the first place user-authored `success_criterion`/`custom_context` hit a model prompt → treat as untrusted / prompt-injection-isolate.

---

## 10. Open findings / drift to fix (running list)

1. **Generation-side steering asymmetry** (§6) — ideas display-only; remix + ideas/develop drop audience+creator steer. Normalize. *(low-risk quality win)*
2. **ideas/develop drops audience/intent/pin** entirely — Develop chain always General-grounded. *(likely unintended debt)*
3. **Signature signal ~70% unused** (§5.5) — `what_resonates`/`what_falls_flat`/`evidence` never injected into generation. *(lever A2)*
4. **wins/flops count-only** (§5.4) — no content enrichment path exists. *(lever A1; brain demands it)*
5. **`BUNDLE_CHAR_CAP` never tuned** from measured slice sizes (code comment admits placeholder). *(lever A3)*
6. **Regen pipeline broken on `main`** (§8) — KC/Apollo source `.md` absent; brain-editing path unclear.
7. **`ai/deepseek.ts` + `ai/gemini.ts` drift** (§4) — documented dead but live; thinking-ON + unbounded + non-deterministic. Fix or kill.
8. **read uses flat band** (`aggregateFlash` without weighting) — calibration moves the verdict only via repaint, not persona-weight mass. Confirm intended.
9. **Stale runner docstrings/comments** — ideas "no ranking"/"Weak gate floor", remix "concepts[0]/0-or-1 block", `decode-types.ts` "coral chip" — contradict live keep-all code.
10. **No rate-limit** on chat/refine (and `void`ed in hooks/ideas) — launch-gate item.
</content>
</invoke>
