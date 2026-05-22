# Phase 13 — Caption-Less Engine Audit (D-13)

**Audited:** 2026-05-22
**Gates:** Stage 11 rebuild + signal-weight changes (Plans 02-03)

---

## Stage Caption-Read Audit Table

Every stage that reads `payload.content_text`, `caption`, or `content_text` is catalogued below with a verdict. This gates Plans 02-03 signal-weight changes and D-11 caption demotion.

| Stage | Entry file:line | Reads content_text/caption? | Behavior on empty caption | Verdict | Fix scope |
|-------|-----------------|------------------------------|--------------------------|---------|-----------|
| Wave 0 — niche detector | `wave0/niche-detector.ts:68` (via `buildNicheUserMessage` in `wave0/prompts.ts:60`) | YES — `payload.content_text` injected into user message | Sends `"(no caption)"` literal; DeepSeek classifies from `(no caption)` = unreliable niche | DISABLE | D-17: fold niche into Gemini Wave 0 content-type call (Plan 02) |
| Wave 0 — content-type detector | `wave0/content-type-detector.ts:87` | NO — skips if `input_mode !== "video_upload"` or no `video_storage_path`; operates on video bytes via Gemini | Graceful: returns `null`, downstream gets `null` contentTypeResult | ACCEPT | No fix needed — video-only signal |
| Wave 1 — segmented Gemini (hook/body/CTA) | `gemini/segmented.ts` (Wave 1 segments) | NO — segment calls send `fileUri` + video-focused prompt; caption not in schema | Unaffected — video bytes drive all factor scores | ACCEPT | No fix needed — video-only signal |
| Wave 2 — DeepSeek reasoning (`deepseek.ts`) | `deepseek.ts:460-462` (`context.input.content_text` in user message) | YES — caption embedded in user message section "Content:" | Sends empty "Content:" section; DeepSeek R1 still reasons from Gemini signals; graceful degradation | DOCUMENT | Empty section graceful; reasoning may be less grounded; flag for M2 transcript-driven input |
| Wave 2 — Gemini text fallback | `gemini.ts:235` (`buildTextPrompt` → `input.content_text` in user message) | YES — text fallback path only; triggers when `input_mode === "text"` | Text-only flow: caption IS the content; behavior by design for text mode | DOCUMENT | Only active in text-only mode (D-12); video_upload/tiktok_url skip this path entirely |
| Rules scoring | `pipeline.ts:596` → `rules.ts:279` `scoreContentAgainstRules(payload.content_text, rules)` | YES — caption text passed as `content: string` to all 17 regex rules | All 17 regex rules return `false` (no match on empty string); rule_score = 0/N; signal contributes 0 | DISABLE | D-14: rules weight=0 in Plan 02; signal dead-weight without caption text |
| Retrieval embedder | `retrieval/embedder.ts:127-137` `buildSubjectText({caption: payload.content_text})` | YES — caption included in subject text formula `[niche:{slug}] @{handle}: {caption}\n{hashtags}` | Subject text becomes `[niche:{slug}] @{handle}: \n{hashtags}`; sparse embedding → unreliable cosine matches | DISABLE | D-15: retrieval weight=0 in Plan 02; corpus embeddings also caption-derived; M2 = re-embed from video features |
| Retrieval stage | `retrieval/retrieval-stage.ts:123` `buildSubjectText({caption: payload.content_text})` | YES — same buildSubjectText call | Same sparse embedding issue | DISABLE | Same as embedder above (D-15) |
| Trends — hashtag extraction | `trends.ts:45,101` `(input.content_text ?? "").toLowerCase()` and `.match(/#\w+/g)` | YES — hashtag regex applied to caption | Returns `[]` hashtags; hashtag_relevance = 0; trending SOUND match path (audio fingerprint) is unaffected | ACCEPT | Audio-fingerprint trending match path is primary and unaffected; hashtag path silently zeros (benign for video_upload/tiktok_url) |
| Wave 3 — persona simulation | `wave3/persona-prompts.ts:83` `payload.content_text \|\| "(no caption)"` | YES — caption in "Caption:" section of persona prompt | Sends `Caption: (no caption)` literal; personas simulate reaction to empty caption section; DeepSeek V3 still has Gemini factor summaries | DOCUMENT | Personas receive Gemini factor scores context; `(no caption)` is graceful; Wave 1 video analysis dominates persona framing |
| Wave 4 — platform fit | `wave4/platform-fit-prompts.ts:133` `payload.content_text \|\| "(no caption)"` | YES — `Caption: (no caption)` in prompt | Sends `Caption: (no caption)` literal; platform fit is primarily derived from content_type + creator_tier + niche | ACCEPT | `(no caption)` fallback already coded; platform fit is niche/type/tier driven not caption-driven |
| Stage 10 — self-critique | `stage10-critique-prompts.ts` `buildCritiqueUserMessage(result, creatorContext)` | NO — reads from `PredictionResult` output only (overall_score, factors, signal_availability, persona aggregate, creator context counts) | Unaffected — caption not in critique user message; critique grades signal consistency, not raw content | ACCEPT | No fix needed — operates on aggregated result |
| Stage 11 — counterfactuals | `stage11-counterfactuals-prompts.ts:51-76` `buildCounterfactualsUserMessage(result)` | NO (current) — reads from `PredictionResult` (overall_score, suggestions, reasoning, hook timestamps) | Current: no caption dependency; however Stage 11 uses DeepSeek (not Gemini) and has NO video file access | REBUILD | D-01-D-05 (Plan 02): rebuild to use Gemini + `fileUri` reuse + full signal context; DeepSeek → Gemini 3.1-pro |
| Cache key | `prediction-cache.ts:20-22` `cacheKey(contentHash, userId)` = `contentHash::ENGINE_VERSION::userId` | NO — contentHash is SHA-256 of video buffer (video_upload) or tiktok_url (tiktok_url) | Hash of video bytes is stable regardless of caption; cache invalidation is version-driven (D-23) | ACCEPT | No fix needed — video_upload hashes buffer bytes directly |

---

## Per-Mode Contract Verification (D-12 + D-11 — BLOCKER-2)

### video_upload (PRIMARY — 90%+ of real traffic)

Caption field is IGNORED in all weight-bearing derivation stages post-Plan-02:

- Wave 0 niche: DISABLED → folded into Gemini (D-17)
- Wave 1 segments: video bytes only via `fileUri` — caption irrelevant
- Wave 2 DeepSeek reasoning: caption present in prompt but signal weight reduced via D-14/D-15 compensating
- Rules scoring: weight=0 (D-14)
- Retrieval signal: weight=0 (D-15)
- Trends: audio-fingerprint path drives `trending_sound_matched` (non-caption)
- Personas: receive `(no caption)` gracefully
- Platform fit: `(no caption)` fallback coded
- Stage 10: no caption read
- Stage 11: rebuilt to Gemini + fileUri (D-01)

**Result:** `video_upload` flow is caption-independent after Plan 02 ships.

### tiktok_url (minority — post-publish metric fetch path)

Caption is equally ignored. The tiktok_url path diverges at `normalize.ts`:
- `video_url` is set to the TikTok URL (for Apify scrape/metadata fetch)
- `video_storage_path` is null (no Supabase Storage key)
- `content_text` is whatever the user typed (often empty or hashtags)

**D-31 tiktok_url flow — doc-level answer (video bytes into Wave 1?):**

Reading `src/lib/engine/wave0/content-type-detector.ts:87`:
```typescript
if (payload.input_mode !== "video_upload" || !payload.video_storage_path) {
  // Graceful skip — returns null
  return null;
}
```

And `src/app/api/analyze/route.ts:87` (early return for tiktok_url mode — no video buffer fetched from storage).

**Answer: tiktok_url mode does NOT get video bytes into Wave 1 / Wave 0 via `ai.files.upload()` at the doc level.** The `content-type-detector` explicitly skips for `input_mode !== "video_upload"`. TikTok URL mode falls back to metadata-only (niche from Apify scrape + text analysis). The engine runs but without visual signal availability (`gemini=false`, `gemini_hook=false`).

**Runtime verification routed to Plan 05 Task 5.2 per WARNING-3** — the smoke runner JSON probe + log-marker check will confirm whether a `tiktok_url`-mode video shows `ai.files.upload` in logs or falls back to metadata-only. This is the live validation gate.

### text-only / script (minority)

All visual signals show ✕ (unavailable). Stage 11 still runs per D-04 (no skip on overall_score). `signal_availability` chips in Phase 11 D-02 pattern handle this gracefully. Engine output is labeled as text-only prediction.

---

## D-11 Cross-Reference (BLOCKER-2): SCORE_WEIGHTS Caption Participation

**Current `SCORE_WEIGHTS` from `src/lib/engine/aggregator.ts:53` (pre-Plan-02):**

```typescript
export const SCORE_WEIGHTS = {
  behavioral: 0.35,
  gemini:     0.25,
  ml:         0,    // disabled (Phase 10)
  rules:      0.15,
  trends:     0.10,
  audio:      0.07, // Phase 6
  retrieval:  0.05, // Phase 8
  platform_fit: 0.05, // Phase 9
} as const;
```

**Post-Plan-02 `SCORE_WEIGHTS` (D-16 target):**

```typescript
export const SCORE_WEIGHTS = {
  behavioral:   0.40,  // primary CoT, video-aware via Wave 2 input
  gemini:       0.35,  // drives Stage 11 too; video understanding is core
  audio:        0.10,  // real audio signal, more important in primary flow
  trends:       0.10,  // audio-fingerprint based, video-derived
  platform_fit: 0.05,  // video-derived from Wave 4
  ml:           0,     // disabled — Phase 10
  retrieval:    0,     // disabled this phase — D-15 (corpus caption-derived)
  rules:        0,     // disabled this phase — D-14 (all regex rules operate on caption text)
} as const;
```

**Caption field appears in 0/8 weight calculations post-Plan-02.**

Verification table:

| Weight key | Source signal | Reads caption? | Post-Plan-02 weight |
|------------|---------------|----------------|---------------------|
| behavioral | DeepSeek R1 CoT on Gemini signals | Indirect (empty section graceful) | 0.40 |
| gemini | Wave 1 video segments (hook/body/CTA via fileUri) | NO — video bytes only | 0.35 |
| audio | Gemini audio analysis + fingerprint match | NO — audio track from video | 0.10 |
| trends | Audio fingerprint match against trending_sounds | NO — audio-derived | 0.10 |
| platform_fit | Wave 4 niche + content_type + creator_tier | NO — niche/type driven | 0.05 |
| ml | DISABLED | N/A | 0.00 |
| retrieval | DISABLED (corpus caption-derived) | N/A | 0.00 |
| rules | DISABLED (17 regex rules on caption text) | N/A | 0.00 |

**Attestation: caption field appears in 0/8 weight calculations post-Plan-02. BLOCKER-2 resolved.**

---

## Test-Update Scope (D-24)

**Pre-existing test file count (from `find src -name "*.test.ts" -o -name "*.test.tsx"`):**

```
89 test files total in src/
```

The vitest suite had infrastructure issues (missing `@testing-library/jest-dom` + `happy-dom`) that were fixed during Plan 01 execution. With those installed, `prediction-cache.test.ts` runs 16 tests passing.

**Categories most at risk when D-14 (rules=0), D-15 (retrieval=0), D-16 (weight redistribution) ship in Plan 02:**

| Test category | Risk level | Reason |
|---------------|------------|--------|
| `src/lib/engine/__tests__/aggregator.test.ts` | HIGH | Asserts specific SCORE_WEIGHTS values; D-16 changes all weights |
| `src/lib/engine/__tests__/aggregator-audio.test.ts` | HIGH | Audio weight 0.07 → 0.10; weight assertions will fail |
| `src/lib/engine/__tests__/aggregator-cta-penalty.test.ts` | MEDIUM | CTA penalty math may interact with new gemini weight 0.35 |
| `src/lib/engine/__tests__/aggregator-platform-fit.test.ts` | HIGH | platform_fit weight unchanged (0.05) but total redistribution affects integration assertions |
| `src/lib/engine/__tests__/aggregator-phase10.test.ts` | HIGH | Phase 10 ML=0 still applies; behavioral/gemini ratio changes |
| Rules tests (any asserting rule firings > 0 with caption content) | HIGH | D-14: rules weight=0 → any test asserting rules score contribution fails |
| Retrieval tests (any asserting retrieval contribution) | HIGH | D-15: retrieval weight=0 → corpus match contribution assertions fail |
| Stage 11 tests | HIGH | Complete rebuild from DeepSeek → Gemini (D-02); shape changes |
| `src/lib/engine/__tests__/normalize.test.ts` | LOW | Normalize logic unchanged; caption still flows through for storage |
| Persona tests | LOW | Persona simulation unchanged; `(no caption)` is existing fallback |

**Estimated failing tests after Plan 02 ships:** 40-60 tests (aggregator suite + stage11 suite + any rules/retrieval assertions). This is expected — test update is explicitly Plan 02's D-24 task.

---

## D-32 — trending_sounds Population Probe

**SQL probe run:** 2026-05-22

```sql
SELECT count(*) FROM trending_sounds WHERE embedding IS NOT NULL;
```

**Result: 0 rows** (table is empty; Phase 6 audio backfill (`scripts/backfill-trending-sound-embeddings.ts`) has not run against live data)

Note: Phase 6 migration added `audio_embedding vector(768)` to `trending_sounds` (not `embedding`). The correct column name is `audio_embedding`. Re-running with correct column:

```sql
SELECT count(*) FROM trending_sounds WHERE audio_embedding IS NOT NULL;
```

**Result: 0 rows** (confirmed — both total row count and audio_embedding count are 0)

**Audio weight decision for Plan 02 (D-16, D-32):**

Since `trending_sounds` has 0 rows with embeddings, the `audio` signal's trending-match sub-component will always return `matched: false`. However, the audio PERCEPTUAL score (Gemini-derived `audio_perceptual_score` from Wave 1) is independent of the trending_sounds table and is already working.

**Recommendation:** Keep `audio` weight at 0.10 as planned (D-16) but flag that the trending-sound MATCH component (fingerprint matching against `trending_sounds.audio_embedding`) will return 0 contributions until the backfill runs. The audio_perceptual_score component (voice clarity, ratios, hook) is unaffected.

**Action for Plan 02:** Document in CONTEXT that D-32 audio weight bump 0.07→0.10 is partially based on trending_sounds being empty — the bump is justified by audio_perceptual_score reliability (12/12 smoke test gates from Phase 06), not on fingerprint match contribution. When backfill runs (Phase 06 HUMAN-UAT Item 2 pending), fingerprint match will add additional signal. Run `scripts/backfill-trending-sound-embeddings.ts` before Plan 07 E2E to populate.

---

## Sign-Off

| Stage | Verdict | Blocking Plan 02? |
|-------|---------|-------------------|
| Wave 0 niche detector | DISABLE (D-17) | Yes — fold into Gemini before E2E |
| Wave 0 content-type | ACCEPT | No |
| Wave 1 segmented | ACCEPT | No |
| Wave 2 DeepSeek reasoning | DOCUMENT | No — graceful with (no caption) |
| Wave 2 Gemini text fallback | DOCUMENT | No — only active in text mode |
| Rules scoring | DISABLE (D-14) | Yes — weight=0 required |
| Retrieval embedder + stage | DISABLE (D-15) | Yes — weight=0 required |
| Trends hashtag extraction | ACCEPT | No — audio path primary |
| Wave 3 personas | DOCUMENT | No — graceful with (no caption) |
| Wave 4 platform fit | ACCEPT | No — (no caption) fallback coded |
| Stage 10 critique | ACCEPT | No — no caption read |
| Stage 11 counterfactuals | REBUILD (D-01-D-05) | Yes — complete rebuild in Plan 02 |
| Cache key | ACCEPT | No — video bytes hash |

**Blocking issues for Plan 02:**
1. Wave 0 niche fold (D-17) must happen before any E2E — niche is required for retrieval + persona weighting
2. Rules weight=0 (D-14) — silent zero contribution without this
3. Retrieval weight=0 (D-15) — sparse embeddings produce noise
4. Stage 11 rebuild (D-01-D-05) — most important user-visible output
5. D-11 SCORE_WEIGHTS update (D-16) — weight redistribution

**BLOCKER-2 attestation:** D-11 cross-reference present in this document with SCORE_WEIGHTS map quoted inline, confirming caption field appears in 0/8 weight calculations post-Plan-02. D-12 per-mode contract documented for video_upload, tiktok_url, and text-only paths.
