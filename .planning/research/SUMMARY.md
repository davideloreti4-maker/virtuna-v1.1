# Research Summary — Viral Remix (v3.2)

**Project:** Virtuna — Viral Remix milestone
**Domain:** Non-owned TikTok structural ingestion + Qwen concept generation + analysis lineage
**Researched:** 2026-05-31
**Confidence:** HIGH on codebase findings (file+line grounded); MEDIUM on Apify Clockworks reliability (needs live confirmation)

---

## TL;DR — THE SINGLE MOST IMPORTANT FINDING

**Requirement #8 is NOT a spike. It is a verified ingestion BUILD and a HARD GATE.**

All 4 researchers independently traced `input_mode: "tiktok_url"` through `pipeline.ts:494–606`, `normalize.ts:55`, and `omni-analysis.ts` and confirmed: for a pasted TikTok URL the engine today analyzes **caption text only**. The multimodal Omni call is gated on `signedVideoUrl` (`pipeline.ts:520`), which is populated **only** for `video_upload` mode. A non-owned TikTok URL yields `video_signals: null` and all-false `signalAvailability`. There is no frame, no transcript, no segments. This is not "maybe insufficient" — structural Decode is impossible on a caption string. Req #8 is therefore a precondition BUILD phase, not a documentation artifact, and **no Decode work starts until a non-owned URL demonstrably produces Omni segments**.

---

## Executive Summary

The Viral Remix milestone adds the front half of the creator loop to Virtuna: paste a viral TikTok → Decode (why it worked, repeatable vs luck) → Adapt (3 niche-adapted concepts, format not content) → per-concept Develop and predict through the existing engine. The product spine is settled and the boundaries are locked. What research reveals is that the execution path is almost entirely about **wiring existing capabilities**, not building new infrastructure — with one hard exception: the non-owned-URL ingestion path does not exist and must be built before anything else.

No new npm packages are needed for the happy path. `apify-client`, `ffmpeg-static`, `openai` (DashScope/Qwen), `nanoid`, and `zod` are all installed. The capabilities exist: `analyzeVideoWithOmni` accepts any video URL; `extractFrameAtTimestamp` runs ffmpeg against any fetchable mp4; the Qwen text/reasoning model is live. What is missing is the wire connecting a non-owned TikTok URL to these capabilities. The `ApifyScrapingProvider` only scrapes by **handle** — no single-URL video resolver exists on the live path. One must be added (Clockworks `tiktok-scraper` with `shouldDownloadVideos: true`, read `mediaUrls[0]`), and the pipeline's `signedVideoUrl` gate must gain a `tiktok_url` branch that feeds the resolved/re-hosted URL into `analyzeVideoWithOmni`.

The key risks are: (1) Clockworks reliability/empty-rate for arbitrary URLs (MEDIUM confidence — must be confirmed live before Decode is planned); (2) Apify CDN URL TTL may be shorter than the ~90–332s pipeline (re-host via `filmstrip/storage.ts` is the fallback); (3) fixing ingestion newly introduces IP risk — derive-and-drop is mandatory, never persist source media. Once ingestion is confirmed, the remaining work is largely plumbing: a `mode` flag threaded through four hops, a mode-tagged frame registry swap in `board-constants.ts`, two new frame components, two Qwen prompt modules, one migration (`parent_id text references analysis_results(id)`), and three insert-site edits. The one-board-two-config path (mechanism B: mode-tagged frame registry) is the lowest-churn correct design — no parallel board tree, no route fork.

---

## Key Findings

### Stack — Reuse Everything, Build One Resolver

No new packages. All capabilities exist. The only missing piece is a **single-URL video resolver** on `ApifyScrapingProvider` — both current methods (`scrapeProfile`, `scrapeVideos`) take a handle.

| # | Add | Where |
|---|-----|-------|
| 1 | Single-URL resolver (Clockworks, `shouldDownloadVideos: true`, read `mediaUrls[0]`) | new method on `apify-provider.ts` + interface `scraping/types.ts:27–33` |
| 2 | `tiktok_url` ingestion branch that sets video URL for Omni | `pipeline.ts:494–525` — mirror the `video_upload` signed-URL path |
| 3 | Extend `apifyVideoSchema` to capture the mp4 field | `schemas/competitor.ts:52–69` (currently drops `mediaUrls`) |
| 4 | mp4 re-host fallback (download → Supabase `videos` bucket → signed URL) | reuse `filmstrip/storage.ts` — conditional on spike step 2 (URL TTL) |
| 5 | `src/lib/engine/remix/` — decode + adapt prompts + zod parse | new dir, two modules |
| 6 | Migration: `analysis_results.parent_id text references analysis_results(id)` + index | `supabase/migrations/` |
| 7 | (Conditional) Qwen ASR transcript helper | only if spike proves Omni output lacks hook-line fidelity |

**What NOT to use:** `yt-dlp` or standalone TikTok downloaders; non-Qwen ASR vendors; a new table for remix lineage; calling `runPredictionPipeline` for decode/adapt.

**Core technologies (all reused):**

- `apify-client ^2.22.1` — Clockworks single-URL resolver (new method, no upgrade)
- `ffmpeg-static ^5.3.0` — frame extraction; already works on remote URLs (`filmstrip/extract.ts:33–40`)
- `openai ^6.22.0` (DashScope Qwen) — Omni multimodal ingestion + Qwen text concept generation
- `@supabase/supabase-js ^2.93.1` — `parent_id` lineage; `analysis_results` table exists (`database.types.ts:180`)
- `nanoid ^5.1.6` — child analysis IDs; already used at `route.ts:578`
- `zod ^4.3.6` — remix body + decode/adapt output validation; repo already on v4

**Latency watch:** Apify resolve hop adds 30–120s on top of the existing ~90–332s pipeline against `route.ts` `maxDuration=300`. If combined budget exceeds 300s, move resolve step async.

### Feature Set

**Must-have (table stakes, SPEC-locked):**

- **TS-1 Remix toggle** — explicit "Score my content" / "Remix a viral video" segmented control; no auto-detect (SPEC §1)
- **TS-2 Named structural Decode** — 8 dimensions: `hook_pattern`, `structure`/`pacing`, `the_turn`, `emotional_beat`, `mechanism`, `virality_triggers`, `audio_text_strategy`, `repeatable_vs_luck` (SPEC §2)
- **TS-3 Repeatable-vs-luck split** — the trust lever; 5× Rule (≥5× follower count in views = true outlier) + three-lane bucketing (Repeatable / Conditional / Luck); benchmark retrieval can upgrade from LLM-reasoned to retrieval-backed post-ship without blocking (SPEC §2)
- **TS-4 Exactly 3 niche-adapted concepts** — each with concrete `hook`, `angle`, `who_its_for`, `format_borrowed` (legal proof field), `why_it_should_work`; drawn from Repeatable lane only (SPEC §3)
- **TS-5 Per-concept Develop and predict** — click-gated, never bulk; reuses `/api/analyze` SSE + `/analyze/[id]` nav (SPEC §4)
- **TS-6 Parent/child lineage** — `parent_id` column, "remixed from" chip in `InputResultCard`, child appears in Recent (free — `Sidebar.tsx:361–367` lists all rows with no filter) (SPEC §5)
- **TS-7 One-board-two-config frame swap** — Verdict+Actions → Decode+Adapt; Konva grid reflows; mobile card-stack absorbs via mode-aware `MOBILE_ORDER` + `renderBody` arms (SPEC §6)
- **TS-8 Niche source** — `creator_profiles.niche`; inline fallback prompt if empty; Decode renders first (niche-free), only Adapt gates on niche (SPEC §7)
- **TS-9 Ingestion BUILD** — HARD GATE; the milestone's phase 1 (SPEC §8 — reframed from spike to build)

**Should-have (differentiators, nearly free):**

- **DF-1 Attributable decode claims** — cite the creator/rule (Ava, Jenny, Hormozi) per Decode field; `creator-intelligence.md` 40-rule SSOT is the vocabulary; nearly free and the strongest credibility multiplier
- **DF-3 `format_borrowed` field on every concept** — on-surface legal proof
- **DF-4 One-line "why it worked" thesis** — gestalt before field breakdown; pure copy/UX
- **DF-6 Audience frame retained in remix mode** — persona retention of the viral video feeds Decode; zero new build

**Defer to v2+:** DF-2 Benchmark-backed repeatable-vs-luck (upgrade post-ship); Radar / trend feed; Pattern Playbook; Non-TikTok platforms.

**Anti-features (hard constraints):** content copying (AF-1), "redo this video" framing (AF-2), auto-detect intent (AF-3), bulk auto-scoring (AF-4), persisting source video (AF-5), treating source as user's content to "fix" (AF-6), non-Qwen model calls (AF-13).

### Architecture and Integration

The existing analyze flow is a single linear spine that Remix splices into at four seams with one schema change. Every board frame is an independent self-hydrating component reading the same shared TanStack cache keyed on analysis id. The canvas (`Board.tsx:98`) renders `resolvedFrames = resolveBoardLayout(measuredH)` — a computed list from `GROUP_FRAMES`. This list-driven rendering is the lever for one-board-two-config.

**Recommended mechanism: MODE-TAGGED FRAME REGISTRY (Mechanism B)**

Add a `modes: BoardMode[]` field to each `GroupFrameLayout` entry; select frames by active mode in both `Board.tsx` and `BoardMobile.tsx`; add `Decode`/`Adapt` as new registry entries + `GroupId`s; extend `resolveBoardLayout` + `computePresetTargets` with the remix column plan. The canvas render loop (`resolvedFrames.map(...)`, Board.tsx:435–485) needs zero change. The one contained edit: `resolveBoardLayout` hardcodes column composition by `GroupId` (board-constants.ts:107–147) and must gain a `mode`-aware remix column plan placing `decode`/`adapt` in the x=864 right column. ~30 lines, fully unit-testable, not a canvas refactor.

**Major components:**

1. **`src/lib/engine/remix/decode.ts`** — Qwen-only decode generation; consumes Omni structural output; persisted into `variants.remix`; does NOT call `runPredictionPipeline`
2. **`src/lib/engine/remix/adapt.ts`** — Qwen-only concept generation; consumes Decode repeatable lane + `creator_profiles.niche`; exactly 3 concepts; format-not-content enforced at prompt level (receives structural fields only, never source caption)
3. **`src/components/board/decode/DecodeNode.tsx`** + **`adapt/AdaptNode.tsx`** — new frame components following `{camera, layout}` contract; self-hydrate from shared cache; registered in `GROUP_FRAMES` with `modes: ['remix']`
4. **Single-URL resolver** (`apify-provider.ts` new method) — Clockworks `tiktok-scraper`, `shouldDownloadVideos: true`, reads `mediaUrls[0]`
5. **Ingestion branch** (`pipeline.ts:494–525`) — mirrors the `video_upload` signed-URL → `analyzeVideoWithOmni` path for `tiktok_url`
6. **`parent_id` migration** — `alter table analysis_results add column parent_id text references analysis_results(id) on delete set null` — must populate at all 3 insert sites in `route.ts`

**Mode flag hop-by-hop (verified):** toggle UI → `ContentFormData.mode` → `Board.tsx handleContentSubmit` → `AnalysisStreamInput.mode` → POST body (serialized whole, zero new transport) → `AnalysisInputSchema` → `buildInsertRow` + placeholder insert → `result.mode` on hydrated row → `resolveBoardLayout(measuredH, mode)` → frame selection.

**Lineage — three insert sites, one migration.** `buildInsertRow` (route.ts:460–543), SSE placeholder insert (route.ts:643–662), and the Develop child row. `parent_id` must come from the **source remix analysis id** (stable, known before Develop starts) — NOT derived from the child's `started` SSE frame (hook Pitfall #6).

**Cache aliasing guard:** include `mode` in `computeContentHash`'s input so a remix-decode and a score of the same URL do not collapse into one cache entry.

### Critical Pitfalls

1. **C1 — Decode built on the existing `tiktok_url` path = caption-only hallucination (spec-killer)** — Phase 1 owner. `video_signals: null` for `tiktok_url` is verified. Prevention: Phase 1 builds real frame/transcript ingestion; hard gate — no Decode plan written until a non-owned URL demonstrably produces Omni segments. Detection: same Decode on two structurally-different viral videos; identical structural fields = no real signal.

2. **C2 — Reusing `/api/analyze` for Decode runs the full 332s scoring pipeline** — Phase 2 owner. Prevention: Decode gets its own lightweight path — Omni segment call → one Qwen decode call. Full pipeline reused ONLY for per-concept Develop. Keep Decode off `usage_tracking`/`DAILY_LIMITS`.

3. **C4 — Source video persisted → IP violation, newly introduced by building ingestion** — Phase 1 design + Phase 2 owner. Today `tiktok_url` downloads nothing. The instant Phase 1 adds a download step, the pipeline handles third-party MP4s. Prevention: derive-and-drop (delete in `finally`, mirror `cleanupRawUpload`); never write `video_storage_path` on a remix/decode row.

4. **C3 — Accidental bulk scoring via fan-out** — Phase 4 owner. Prevention: Develop is click-gated, single concept; no `useEffect`-on-mount that starts a stream (hook Pitfall #3); acceptance test: 0 streams open until click, then exactly 1.

5. **M3 — `use-analysis-stream` pitfalls #3/#6/#8 resurface + new mode-swap staleness axis** — Phase 4 owner. Pitfall #3 (no auto-open on initialData), Pitfall #6 (`parent_id` from source id not child `started`), Pitfall #8 (90s polling ceiling vs 332s runs). Prevention: mode change = reset event (bump `newAnalysisSignal`); Decode/Adapt nodes key on `(analysisId, mode)`; lift polling ceiling for remix-developed children.

6. **m3 — Decode permalink hydration stuck on "Calculating..."** — Phase 6 owner. Decode rows have `overall_score: null`. The permalink-replay effect (`use-analysis-stream.ts:488–500`) keys on `overall_score != null`. Prevention: distinct completion marker for decode rows (e.g. `variants.remix != null`) so hydration effect recognizes a complete decode.

---

## Converged Build Order (all 4 agents agree)

P1 ingestion BUILD (HARD GATE: req #8)
- Clockworks single-URL resolver on apify-provider.ts
- `tiktok_url` branch in pipeline.ts:494–525 → analyzeVideoWithOmni
- `apifyVideoSchema` extension (mediaUrls)
- re-host fallback via filmstrip/storage.ts (conditional on TTL)
- failure-mode taxonomy (private, region-locked, carousel, 404, vm. links)
- SPIKE ARTIFACT: confirmed signal for non-owned URL

P2 mode flag plumbing (can start parallel with P1)
- mode + parent_id on AnalysisStreamInput + AnalysisInputSchema
- toggle UI on tiktok-url-input.tsx
- Board.tsx handleContentSubmit spread
- buildInsertRow + SSE placeholder carry mode + parent_id
- mode in computeContentHash (cache aliasing guard)

P3 mode-aware registry + empty frame shells
- BoardMode type; GroupId += 'decode' | 'adapt'
- modes field on GroupFrameLayout; GROUP_FRAMES entries tagged
- resolveBoardLayout + computePresetTargets: remix column plan
- Board.tsx: pass mode to layout; add decode/adapt slot arms
- BoardMobile: mode-aware MOBILE_ORDER + renderBody arms
- DecodeNode.tsx + AdaptNode.tsx (placeholder shells)
- board-constants.test.ts: remix layout coverage

P4 Decode frame (blocked on P1+P3) | P5 Adapt frame + niche (blocked on P3 only)
- engine/remix/decode.ts              | engine/remix/adapt.ts
- Qwen decode call (not scorer)       | creator_profiles.niche source
- variants.remix.decode persist       | inline fallback prompt
- repeatable-vs-luck split            | 3 concepts, repeatable lane only
- DecodeNode renders                  | AdaptNode renders

P6 Develop and predict + lineage (depends on P4+P5+schema)
- parent_id migration (SQL + database.types.ts)
- parent_id at all 3 insert sites in route.ts
- onDevelop callback lifted from Board.tsx to AdaptNode
- Develop button → stream.start() (existing path, parent_id in body)
- navigation reuses existing analysisId push (Board.tsx:273–280)
- "remixed from" chip in InputResultCard
- /api/analysis/[id] returns minimal parent summary
- decode-aware permalink hydration (m3 fix)
- polling ceiling lifted for remix-developed children

P7 Polish + regression
- Raycast styling on DecodeNode + AdaptNode
- Mobile card-stack verified at <768px
- Error boundaries on both new frames
- Grade-mode board regression confirmed unchanged
- Optional: Recent remix glyph

---

## Open Questions for Phase 1

These are the only remaining unknowns. Everything else is verified.

1. **(BLOCKING)** Does Clockworks `tiktok-scraper` with `shouldDownloadVideos: true` reliably return a fetchable mp4 (`mediaUrls[0]`) for a single arbitrary non-owned URL? What is the empty/dead-URL rate? Must be confirmed live across ≥5 varied URLs: high-view, region-locked, deleted, carousel, `vm.` short link.

2. **(BLOCKING)** Do returned URLs stay fetchable long enough (server-side) for Omni + ffmpeg across a ~90–332s pipeline? If short-TTL → Supabase re-host mandatory.

3. Does Qwen-Omni's structured output already name the hook line / spoken beats well enough for Decode, or is a Qwen ASR transcript required? (Default: do NOT add — Omni ingests audio from a video URL.)

4. What latency does the Apify resolve hop add (+30–120s documented), and does it breach `maxDuration=300`? If yes → async resolve required.

5. Should the remix path resolve/re-host the mp4 once and reuse the single URL for both Omni and filmstrip extraction, to avoid double-fetching a short-TTL URL?

6. Is the handle extractable from the pasted URL for `scrapeProfile` (needed to source follower count for the repeatable-vs-luck 5× Rule)?

---

## Requirement to Finding Traceability

| Req | Title | Key finding |
|-----|-------|-------------|
| #1 | Remix intent toggle | `mode: 'score' | 'remix'` on `AnalysisStreamInput`; toggle UI on `tiktok-url-input.tsx`; threaded through `handleContentSubmit` → route → persisted row → `resolveBoardLayout`. Zero new transport (input serialized whole at `use-analysis-stream.ts:322`). |
| #2 | Decode frame | Blocked on #8. `engine/remix/decode.ts` (Qwen text call, NOT scorer); consumes Omni structural output; 8-dimension schema + repeatable-vs-luck (5× Rule + lane bucketing); persisted into `variants.remix.decode`. `creator-intelligence.md` is the decode vocabulary SSOT. |
| #3 | Adapt frame | `engine/remix/adapt.ts`; consumes Decode repeatable lane only (format-not-content enforced at prompt level); exactly 3 concepts with `hook`/`angle`/`who_its_for`/`format_borrowed`; grounded in `creator_profiles.niche`. |
| #4 | Develop and predict | `onDevelop(concept)` callback lifted from `Board.tsx` to `AdaptNode`; calls existing `stream.start()` with `input_mode:'text'`, `content_text:<concept>`, `parent_id:<remix id>`, `mode:'score'`; reuses `analysisId → router.push('/analyze/${id}')` effect (Board.tsx:273–280). Never bulk. Click-gated (hook Pitfall #3). |
| #5 | Remix lineage | One migration: `parent_id text references analysis_results(id) on delete set null` + index. Written at `buildInsertRow` + SSE placeholder. "Remixed from" chip in `InputResultCard` when `result.parent_id != null`. Recent list: free (all rows listed, no filter at `Sidebar.tsx:361–367`). Decode-aware permalink hydration required (m3 fix). |
| #6 | One board, two configs | Mechanism B: `GroupFrameLayout` gains `modes` field; `resolveBoardLayout` + `computePresetTargets` gain remix column plan (~30 lines); `Board.tsx` slot arms += decode/adapt; `BoardMobile.tsx` MOBILE_ORDER + renderBody += remix arms. Grade board untouched. |
| #7 | Niche source | `creator_profiles` read at `route.ts:278–283`; add `niche` to select. `AnalysisStreamInput.niche` already exists (line 66). Inline fallback: gate concept generation on non-empty niche in the remix route branch; Decode renders first (niche-free). |
| #8 | Ingestion sufficiency | VERIFIED ABSENT — not a configuration tweak, a BUILD. `tiktok_url` path: caption text only (`pipeline.ts:494–606`, `normalize.ts:55`). Build: (a) single-URL resolver on `apify-provider.ts`, (b) `tiktok_url` branch in `pipeline.ts:494–525` → `analyzeVideoWithOmni`, (c) `apifyVideoSchema` extension for `mediaUrls`, (d) re-host fallback conditional on URL TTL. Blocking unknowns: Clockworks reliability + URL TTL — must be confirmed live. |

---

## Implications for Roadmap

### Phase 1: Ingestion BUILD (HARD GATE — req #8)

**Rationale:** VERIFIED: `tiktok_url` path is caption-only. No Decode work can be planned until a non-owned URL produces real Omni segments.
**Delivers:** Working frame/transcript ingestion for a non-owned TikTok URL; confirmed or designed remediation for Clockworks reliability + URL TTL; failure-mode taxonomy; derive-and-drop IP boundary designed; spike artifact documenting confirmed signal.
**Addresses:** TS-9, req #8
**Avoids:** C1 (caption hallucination), C4 (IP exposure)
**Research flag:** NEEDS live Apify actor test across ≥5 varied URLs before any Decode-phase code.

### Phase 2: Mode Flag Plumbing

**Rationale:** Pure plumbing, no engine dependency. Can start in parallel with Phase 1.
**Delivers:** `mode` + `parent_id` on `AnalysisStreamInput` + `AnalysisInputSchema`; toggle UI; `buildInsertRow` + SSE placeholder carry both fields; `mode` in `computeContentHash`; a remix-mode submit produces a row with `mode='remix'` and still renders the existing board (frames not yet swapped).
**Addresses:** req #1, req #6 (routing precondition)
**Avoids:** cache aliasing (mode in hash), mode disagreement between live/permalink
**Research flag:** Standard patterns — no deeper research needed.

### Phase 3: Mode-Aware Registry + Empty Frame Shells

**Rationale:** Establishes the one-board-two-config skeleton. Unblocks Phases 4 and 5 in parallel.
**Delivers:** `BoardMode` type; `GroupId` += `'decode' | 'adapt'`; `modes` field on `GroupFrameLayout`; `GROUP_FRAMES` entries tagged; `resolveBoardLayout` + `computePresetTargets` gain remix column plan; `Board.tsx` slot arms + `BoardMobile.tsx` MOBILE_ORDER + renderBody arms; placeholder `DecodeNode.tsx` + `AdaptNode.tsx`; `board-constants.test.ts` remix coverage. Checkpoint: remix board shows correct 6-frame layout on desktop and mobile; grade board unchanged.
**Addresses:** req #6
**Avoids:** M4 (mobile not absorbing swap), M2 (stale frame state — mode-change reset established here)
**Research flag:** Standard patterns — board-constants.ts mechanics fully understood.

### Phase 4: Decode Frame

**Rationale:** Blocked on Phase 1 (needs confirmed ingestion signal) + Phase 3 (needs frame shell).
**Delivers:** `engine/remix/decode.ts` (Qwen-only, NOT the scorer); 8-dimension structural teardown + repeatable-vs-luck split; `variants.remix.decode` persistence; `DecodeNode.tsx` renders teardown; attributable claims (DF-1) baked in from day one.
**Addresses:** req #2, TS-2, TS-3
**Avoids:** C1 (blocked on P1), C2 (scorer reuse — own lightweight path), M5 (luck hallucination — prompt must require non-empty luck column + feed follower count for 5× Rule)
**Research flag:** NEEDS Omni output inspection (Phase 1 step 3) before writing the decode prompt schema.

### Phase 5: Adapt Frame + Niche

**Rationale:** Independent of Decode generation; can run in parallel with Phase 4 after Phase 3 lands.
**Delivers:** `engine/remix/adapt.ts` (Qwen-only); `creator_profiles.niche` sourced at route; inline fallback prompt when niche empty; `AdaptNode.tsx` renders exactly 3 concepts with `hook`/`angle`/`who_its_for`/`format_borrowed`; format-not-content enforced at prompt level.
**Addresses:** req #3, req #7, TS-4, TS-8
**Avoids:** M6 (content-copying — Adapt prompt consumes structural fields only), m2 (niche-missing dead-end — inline prompt)
**Research flag:** Standard patterns — concept schema defined in FEATURES.md.

### Phase 6: Develop and Predict + Lineage

**Rationale:** Last because it composes everything. Develop path reuses existing machinery almost entirely.
**Delivers:** `parent_id` migration + `database.types.ts` update; `parent_id` at all 3 insert sites; `onDevelop(concept)` callback lifted from `Board.tsx` to `AdaptNode`; Develop button calls existing `stream.start()` with `parent_id` + `mode:'score'`; `/analyze/[id]` nav reuses existing `analysisId` push (Board.tsx:273–280); "remixed from" chip in `InputResultCard`; `/api/analysis/[id]` returns minimal parent summary; decode-aware permalink hydration (m3 fix); polling ceiling lifted for remix-developed children.
**Addresses:** req #4, req #5, TS-5, TS-6
**Avoids:** C3 (bulk scoring — click-gated), M3 (stream pitfalls — `parent_id` from source id at INSERT; ceiling lift), m3 (decode permalink stuck — distinct completion marker)
**Research flag:** Standard patterns — all mechanisms verified in code.

### Phase 7: Polish + Regression

**Rationale:** Verify no regressions; Raycast styling pass on new frames; error boundaries; mobile verification.
**Delivers:** Raycast styling on DecodeNode + AdaptNode; error boundaries on both new frames; mobile card-stack verified at <768px; grade-mode board regression confirmed unchanged; optional Recent remix glyph.
**Research flag:** None — standard styling and testing.

### Phase Ordering Rationale

- P1 gates all Decode work — VERIFIED, not assumed. Build it first, confirm signal, then plan the Decode prompt schema.
- P2 is independent of P1 and runs in parallel — pure type/schema/UI plumbing, no engine dependency.
- P3 depends only on P2 (`mode` value). Establishes the frame skeleton so P4 and P5 can develop concurrently.
- P4 and P5 can run in parallel after P3; P4 additionally blocked on P1.
- P6 composes P4+P5 output plus the migration. Must come last in the feature sequence.
- P7 is a polish/regression sweep; no new functionality.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1:** Live Apify actor test — Clockworks reliability + URL TTL are the only unresolved external unknowns. Also: Omni structured output fidelity inspection to determine if Qwen ASR transcript is needed.
- **Phase 4:** Decode prompt design depends on confirmed Omni output schema from Phase 1. Write the decode prompt after inspecting real Omni output on a non-owned URL.

Phases with standard patterns (no deeper research needed):
- **Phases 2, 3, 5, 6, 7:** All mechanics verified in code. No external unknowns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified in `package.json`; integration points grounded by file+line in `pipeline.ts`, `apify-provider.ts`, `filmstrip/extract.ts`, `omni-analysis.ts` |
| Features | HIGH | SPEC-locked 8 requirements; `creator-intelligence.md` 40-rule SSOT confirms decode vocabulary; `[domain]` tags on outside claims in FEATURES.md |
| Architecture | HIGH | `Board.tsx`, `board-constants.ts`, `BoardMobile.tsx`, `use-analysis-stream.ts`, `route.ts` all read verbatim; mechanism B grounded in verified rendering path (`resolvedFrames.map`, lines 435–485) |
| Pitfalls | HIGH (codebase) / MEDIUM (legal/IP) | Caption-only ingestion VERIFIED through full pipeline trace; latency from measured AUDIT (211s + 121s tail); legal/IP from general domain reasoning + SPEC |

**Overall confidence:** HIGH on the build plan. MEDIUM on two external unknowns: Clockworks reliability + URL TTL. Both resolve in Phase 1.

### Gaps to Address

- **Clockworks reliability** — Phase 1 live test across ≥5 varied URLs. If failure rate unacceptable: escalate to alternative Apify actor or `yt-dlp` fallback (last resort, high maintenance).
- **URL TTL** — Phase 1: `curl` the returned URL from a server context across a 300s window. Determines whether re-host is mandatory.
- **Omni structured output fidelity** — Phase 1 step 3: feed resolved URL into `analyzeVideoWithOmni`, inspect `hook_decomposition` and `segments`. Determines whether Qwen ASR transcript is needed.
- **`maxDuration` headroom** — Phase 1 latency measurement. Apify resolve (30–120s) + re-host + Omni on top of 90–332s pipeline may bust `maxDuration=300`. If yes: async resolve required.
- **Decode-row permalink hydration** — Phase 6 design: Decode rows have `overall_score: null`. Needs a distinct completion marker (e.g. `variants.remix != null`) so the permalink-replay effect recognizes a complete decode row.

---

## Sources

### Primary — HIGH confidence (file+line grounded)

- `src/app/api/analyze/route.ts` (807 lines) — URL validation, pipeline invocation, `usage_tracking`, `buildInsertRow`, `maxDuration=300`, insert sites
- `src/lib/engine/pipeline.ts` (978 lines, esp. 494–606, 871) — VERIFIED caption-only path for `tiktok_url`; Omni target `analyzeVideoWithOmni:520–547`
- `src/lib/engine/normalize.ts:55` — `video_url = tiktok_url` set but unwired downstream
- `src/hooks/queries/use-analysis-stream.ts` (589 lines) — Pitfalls #3/#6/#8, reset machinery, polling ceiling, multi-instance hydration
- `src/lib/scraping/apify-provider.ts` — handle-only; no single-URL fetch on live path
- `src/lib/scraping/types.ts:27–33` — `ScrapingProvider` interface
- `src/lib/schemas/competitor.ts:52–69` — `apifyVideoSchema` (drops `mediaUrls` today)
- `src/lib/engine/filmstrip/extract.ts:33–40` — ffmpeg on any remote URL (capability verified present)
- `src/lib/engine/filmstrip/storage.ts:16–43` — upload+sign pattern for re-host
- `src/components/board/Board.tsx` (esp. 98, 273–312, 435–485) — canvas rendering, frame registry, `handleContentSubmit`, `analysisId` push
- `src/components/board/board-constants.ts` (26–184) — `GROUP_FRAMES`, `resolveBoardLayout`, `computePresetTargets`, `AUTO_HEIGHT_FRAMES`
- `src/components/board/board-types.ts:15–21` — `GroupId` union
- `src/components/board/BoardMobile.tsx` (24–107) — registry, `MOBILE_ORDER`, `renderBody`, `MobileFrameCard`
- `src/types/database.types.ts:180` — `analysis_results` table (no `parent_id` today, confirmed)
- `src/components/sidebar/Sidebar.tsx:361–577` — Recent list (all rows, no parent filter)
- `.planning/milestones/viral-remix-SPEC.md` — 8 locked requirements, spine, boundaries, constraints, ambiguity report
- `.planning/research/creator-intelligence.md` — 40-rule decode/adapt vocabulary (Ava Yuergens, Jenny Hoyos, Alex Hormozi)
- `.planning/PROJECT.md` — existing features, latency figures, milestone placement
- `.planning/AUDIT-engine-e2e-latency-accuracy.md` — measured 211s pipeline + 121s tail = 332s; confirms caption-only `tiktok_url` path

### Secondary — MEDIUM confidence

- Apify Clockworks `tiktok-scraper` store pages + issue threads (WebSearch) — `shouldDownloadVideos: true` → `mediaUrls`; non-trivial empty/dead rate reported; must be confirmed live
  - https://apify.com/clockworks/tiktok-scraper
  - https://apify.com/clockworks/tiktok-scraper/issues/some-tiktok-videos-h-PhthzZcKdeDdnJnPR
  - https://apify.com/clockworks/free-tiktok-scraper/issues/mediaurls-is-empty-yUio0G3mpxOfrObyL
- General IP/ToS domain reasoning — transformative-use structural-analysis defense; derive-and-drop pattern
- Outside domain knowledge of decode/adapt creator tooling — tagged `[domain]` in FEATURES.md

---

*Research completed: 2026-05-31*
*Ready for roadmap: yes — Phase 1 spike answers required before Decode phase planning*
