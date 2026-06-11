# Virtuna engine — as-built pipeline map (v3.13.0)

> Reference snapshot captured 2026-06-11 for the Phase 1 step-by-step walkthrough.
> Source: direct read of pipeline.ts, omni-analysis.ts, deepseek.ts, apollo-core.ts,
> fold-prompts.ts, fold.ts, aggregator.ts, version.ts. No live runs.
> This is a READ MAP, not the audit-decision deliverable (D-01 keeps audits inline).

## Flow (one SSE response, ~70s, under Vercel 300s cap)

```
runPredictionPipeline (pipeline.ts)
│
├─ 1. validate + normalize (Zod)
├─ 2. pre_creator_context     → DB read creator profile (follower_count, niche…)
├─ 3. resolve video URL
│     • video_upload → sign storage path (1h)
│     • tiktok_url   → Apify resolve → download w/ token → re-host → sign → derive-and-drop
│
├─ 4. READ  (BLOCKS — everything downstream needs its segments/verbatim)
│     analyzeVideoWithOmni()   qwen3.5-omni-FLASH, watches video
│
├─ 5. parallel:
│     ├─ APOLLO  reasonWithDeepSeek()   qwen3.6-plus, SIGHTED   (Wave 2)
│     └─ FOLD    runFold()              qwen3.5-omni-PLUS, SIGHTED (Wave 3)
│
└─ 6. aggregateScores (pure TS) → PredictionResult
      + Stage-10 self-critique (deterministic, trims confidence)
```

Critical path = Read (~17s) + max(Fold ~54s, Apollo ~49s) ≈ 70s. Fold gates.

> Naming traps: `deepseek.ts` / `DEEPSEEK_MODEL` = **qwen3.6-plus** (Apollo).
> `gemini*` / `geminiResult` = **omni-flash** (Read). All legacy strings; pipeline is Qwen-only.

---

## The 3 LLM calls

### 1. READ — `qwen/omni-analysis.ts` (omni-flash, watches video)
- **System prompt** = byte-stable JSON schema spec (`buildSystemPrompt`). Niche/content-type hints moved to USER msg (T3.4, cache-stable).
- **Output (one JSON):** content_type, niche, 5 factors (Scroll-Stop/Completion/Rewatch/Share/Emotional, 0-10), hook_decomposition (4 modality scores + weakest_modality), video_signals, cta_segment, audio_signals + audio_perceptual_score, **emotion_arc** (3-8 pts), **hook_verbatim** (spoken/on-screen, no translation), **segments** (scene grid w/ per-segment verbatim).
- **Guards:** Zod `OmniAnalysisZodSchema`, temp0+seed, 2 attempts / 60s. Fail → **all-null → pipeline substitutes zeroed `DEFAULT_GEMINI_RESULT`** (silent, warning only).
- This is the substrate the other two reason over.

### 2. APOLLO — `deepseek.ts` + `apollo-core.ts` (qwen3.6-plus, sighted) — THE MOAT
- **System prompt** = `APOLLO_SYSTEM_PROMPT` = **LEAN** `KNOWLEDGE_CORE` (§1–§6, **§2.6/§7/§8 dropped** T3.1) + `APOLLO_INSTRUCTION`.
- **User msg** (`buildDeepSeekUserMessage`) = verbatim hook + omni signals (numeric scores stripped to prevent anchoring) + creator context + full JSON output contract. Video prepended → Apollo *watches*.
- **Output:** 6 dimensions (band + 85/50/20 score + `lever` §-cite + `evidence`), component_scores(7), `composite_score` **overwritten in TS by deterministic hook-weighted rubric-sum** (HOOK_WEIGHT 0.80), rewrites(2-3, verbatim-grounded), `ceiling_capper`, `confidence_scope`, suggestions, platform_note.
- **Guards:** Zod `DeepSeekResponseSchema` + post-parse backstop (composite clamp, rubric-sum, R2 verbatim-copy enforce), temp0+seed, thinking_budget 1500, 3 attempts + circuit breaker. Fail → **null**.

### 3. FOLD — `wave3/fold.ts` + `fold-prompts.ts` (omni-plus, sighted) — audience sim
- **System prompt** = `STABLE_FOLD_SYSTEM_PROMPT` = 10 archetype defs + "Critical Divergence Requirement" (tough_crowd drops first, loyalist last).
- **User msg** = video + text skeleton (verbatim + segment grid + emotion arc + 10 slot assignments).
- **Output:** 10 personas, each = behavioral intents (watch_through/share/comment/save/rewatch_pct + scroll_past_second) + per-segment reactions (attention[0,1] + swipe_predicted).
- **Guards:** Zod `FoldResponseSchema.length(10)`, **1 attempt, NO retry**, 90s hard ceiling. Fail → foldOutcome **null**.

---

## Scoring blend — `aggregator.ts`

| Term | Source | Formula |
|---|---|---|
| `apollo_score` | Apollo composite (rubric-sum) | hook-weighted sum of 6 dim scores |
| `fold_audience_score` | fold persona aggregate | 0.50·completion + 0.25·share + 0.15·save + 0.10·comment |
| `behavioral_score` | **avg of Apollo's 7 component_scores** ×10 | (NOT fold — see note) |

**`overall_score`:**
- video + Apollo + Fold → **`0.5·apollo + 0.5·fold_audience`** ← the true ensemble
- Apollo only (text/url) → `behavioral·0.53 + apollo·0.47`
- Fold only (Apollo dead) → fold 100%
- both dead → `0` + `analysis_unavailable=true`

Tail: confidence (signal availability + Apollo-vs-behavioral direction agreement, LOW floor on dual-fail) → behavioral_predictions (fold→deepseek→zeros) → `predicted_engagement` (follower × quality², or null) → heatmap (fold pass2) → Stage-10 critique trims confidence.

---

## Open observations (flagged, not fixed)

1. **No runtime validation that Apollo's §-cites resolve** (ENG-02). Lean core has §1–§6; Apollo emits free-text §-cites. Danglers possible: §2.6 (empty+dropped), §7/§8 (dropped), hallucinated §9 → flows verbatim to `dimension.lever`. Board renders cites as opaque strings, so it's an *engine honesty* gap, not a render bug.
2. **`fold-prompts.ts:9-10` header is stale** — says "fold reasons over Omni's TEXT; does NOT consume video frames." Code now passes `video_url` and omni-plus *watches* (sense-complete, v3.9.0). Doc contradicts code.
3. **Single-signal death is silent** (ENG-01). Fold fails *or* Apollo fails → score basis silently halves, only a `warnings[]` entry that `InsightHeroFrame` filters out. Only *dual* death surfaces `analysis_unavailable`.
4. **Dead constants still on `PredictionResult`:** `rule_score:50`, `trend_score:0`, `ml_score:0`, `platform_fit:null`, `audio_fingerprint:null` — hardcoded from stripped stages. Harmless unless the board renders them as real.
5. **`predicted_engagement` is live-only, not persisted** — permalink reload shows no range.
6. **Read drift guards are drop-to-undefined, no retry-on-empty-critical-field, no drift logging** (ENG-05). `MAX_RETRIES=1` only fires on whole-response Zod fail, not a valid-but-empty `emotion_arc`/`hook_verbatim`.
7. **Fold has zero retry** — one transient parse fail drops the entire audience half of the score.
8. **`behavioral_score` = avg of Apollo's components, not the fold** — in video mode it does NOT enter `overall_score` (fold replaces it); it only feeds confidence agreement + persisted FeatureVector + text-mode fallback. Easy to misread as audience signal.

---

## Apollo §-scheme map (ENG-02 reference)

- **Scheme 1 — full corpus** (`KNOWLEDGE-CORE.md`): §1 Persona · §2.0/2.0a/2.1 Hooks/2.2 Retention/2.3 Share/2.4 CTA/2.5 Substance/**2.6 Behavioral (empty, reserved)** · §3 Anti-Patterns · §4 Rubric (§4.1 Platform) · §5 Decode · §6 Rewrite · **§7 Audience** · **§8 Sources**.
- **Scheme 2 — LEAN runtime** (`apollo-core.ts`): T3.1 dropped §2.6/§7/§8 + header meta. Runtime prefix = §1–§6 only (craft layer byte-unchanged).
- **Scheme 3 — what Apollo emits** (`deepseek.ts` + `APOLLO_INSTRUCTION`): free-text §-cites into §2.x and §4 — all present in lean core.
- **Scheme 4 — board** (`InsightHeroFrame.tsx`): renders cites as OPAQUE strings; only §-aware line is `rw.lever_fixed.includes('§2.2')`. No board fix needed.
- **Scheme 5 — chat** (`chat/seed-context.ts`): flat fake §1–§10 legend — PHASE 4, do not touch.

Whitelist of sections actually present in the lean runtime core:
`§1, §2.0, §2.0a, §2.1, §2.2, §2.3, §2.4, §2.5, §3, §4, §4.1, §5, §6` (NO §2.6/§7/§8).
