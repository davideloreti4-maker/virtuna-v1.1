/**
 * Engine version — single source of truth.
 * Flipped 3.0.0-dev → 3.0.0 by Phase 13 Plan 08 per D-27 + D-28 (10-video cadence superseded
 * by Qwen-migration deviation sign-off; see 13-FINAL-VALIDATION-REPORT.md).
 * Bumped 3.1.0 → 3.2.0 by Phase 2 Plan 02 (R1 verbatim threading): stale pre-verbatim
 * cached rows must not serve a verbatim-less result after this plan ships.
 * Bumped 3.2.0 → 3.3.0 by Phase 3 Plan 04 (Apollo blend rewire, D-04): stale pre-Apollo
 * cached rows must not serve an old gemini-term score after this plan ships.
 * Bumped 3.3.0 → 3.4.0 by Phase 4 Plan 05 (10-pass deletion): fold is now the sole
 * audience-sim path; stale rows produced by the 10-pass era must not mix with fold-era rows.
 * Bumped 3.4.0 → 3.5.0 by Phase 4 Plan 05 (fold model flip): fold default → qwen3.6-flash,
 * no-thinking (A/B-validated); behavioral scores shift from the plus-thinking era, so stale
 * 3.4.0 rows must not mix with flash-era rows.
 * Bumped 3.5.0 → 3.6.0 by quick/20260605-engine-latency-quality-spine-ab (latency+quality A/B):
 * fold per-segment `reason` dropped (dead weight) + FOLD_MAX_TOKENS 8000→4000 + Apollo
 * thinking_budget 3000→1500 (sweep-validated: insight depth held, latency 76→49s). Apollo
 * composite shifts within provider noise across the era boundary, so isolate the cache.
 * Bumped 3.6.0 → 3.7.0 by the same quick task (omni model flip): default omni read
 * qwen3.5-omni-plus → qwen3.5-omni-flash (A/B-validated, 2 videos: 36→17s, substrate held/
 * richer). omni is the substrate the whole engine reasons over → scores shift across the
 * boundary; stale plus-era rows must not mix with flash-era rows.
 * Bumped 3.7.0 → 3.8.0 by Phase 5 Plan 01 (D-01 rubric-sum): Apollo composite_score is now
 * a deterministic hook-weighted sum of per-dimension scores (HOOK_WEIGHT=0.80) rather than a
 * separately-asked holistic LLM judgment. Scores shift for any video where the LLM's holistic
 * composite diverged from the arithmetic sum; stale 3.7.0 rows must not mix with rubric-sum-era
 * rows. Auto-invalidates all 3.7.0 L1+L2 cached rows on next analyze-route call (D-23).
 *
 * Bumped 3.8.0 → 3.9.0 (2026-06-06, sense-complete perception): the fold moved from the
 * deaf+blind qwen3.6-flash TEXT call to qwen3.5-omni-plus WATCHING the video (video+audio),
 * and the reasoner (qwen3.6-plus) now WATCHES the video too (sighted hook judgment instead of
 * blind). Both behavioral and apollo terms shift because the models now perceive the video
 * directly rather than reasoning over the read's text compression. Stale 3.8.0 rows (text-fold
 * + blind-reason era) must not mix with sighted-era rows.
 *
 * Bumped 3.9.0 → 3.10.0 (2026-06-06, T1.1 fold→score): overall_score is now a TRUE ensemble
 * of the Apollo composite (expert read) and a fold-derived audience score (0.5·apollo +
 * 0.5·fold_audience on video). Previously the fold (the real audience sim) was excluded and
 * the score was one Apollo call graded twice. Scores shift on every video row; text/tiktok_url
 * mode is unchanged (Apollo-only fallback). Stale 3.9.0 rows must not mix with ensemble-era rows.
 *
 * Bumped 3.10.0 → 3.11.0 (2026-06-06, T3.2 phantom-injection removal): deleted the dead
 * "## Rule Matches" + "## Trend Context" sections from the Apollo user message (both stages
 * were removed from the pipeline; they injected phantom-system text). Apollo's prompt changes
 * slightly, so its composite/dimensions may shift; isolate the cache.
 *
 * Bumped 3.11.0 → 3.12.0 (2026-06-07, Tier-3 prompt trims — bundled):
 *   - T3.1 (KNOWLEDGE_CORE lean variant): dropped §2.6/§7/§8 + header provenance meta from
 *     the Apollo/decode/adapt cached system prefix (sections the rubric never scores against).
 *     Craft layer §1–§6 byte-unchanged, but the system-prefix bytes change → isolate the cache.
 *   - T3.3 (Apollo behavioral_predictions gated to text mode): on video runs the fold owns
 *     audience prediction, so the Apollo prompt no longer asks for the 4 numbers; schema made
 *     optional. Apollo's prompt + (rarely) its output shape change on video → isolate the cache.
 *   - T3.4 (Omni read prompt byte-stable): niche/content-type hints moved from the omni SYSTEM
 *     prefix to the volatile USER message (prefix-cache no longer busts per niche). The omni
 *     system prompt bytes change once → isolate the cache.
 *
 * Bumped 3.12.0 → 3.13.0 (2026-06-07, T1.5 degradation honesty): PredictionResult gains a
 * REQUIRED `analysis_unavailable` flag — true when BOTH core signals die (Omni read + Apollo
 * reasoning), where overall_score collapses to a fabricated, confident-looking 0. The board
 * now renders a distinct "couldn't analyze" state instead of that 0. Invalidate so stale
 * 3.12.0 cached rows (which lack the flag) don't deserialize as a real-looking 0 verdict.
 * The flag is also derivable from the persisted signal_availability JSONB on permalink reload.
 *
 * Bumped 3.13.0 → 3.14.0 (2026-06-11, ENG-02 §-cite honesty — plan 01-01): two changes to the
 * Apollo path. (1) Prose-discipline: APOLLO_INSTRUCTION (in the cached system prefix) + the
 * user-message JSON contract now instruct Apollo to keep § tokens OUT of user-facing prose
 * (ceiling_capper/confidence_scope/suggestions/rewrite variant) and only in the auditable
 * lever/evidence/lever_fixed metadata. The system-prefix bytes change → isolate the cache.
 * (2) Cite-resolution guard: a post-parse backstop strips danglers (§-cites that don't resolve
 * to the lean KNOWLEDGE_CORE — §2.6/§7/§8/hallucinated) from metadata and strips ALL § tokens
 * from prose, so the faithful-runtime leak (7 prose cites observed on the test video) can't reach
 * the board. Apollo's prose output shape changes (cites removed) → stale 3.13.0 rows must not mix.
 *
 * Bumped 3.14.0 → 3.15.0 (2026-06-11, Apollo model flip — harness A/B): the Apollo reasoner
 * moved qwen3.6-plus → qwen3.7-plus (scoped via new QWEN_APOLLO_MODEL, separate from the shared
 * QWEN_REASONING_MODEL so chat/decode/adapt/text-mode stay on 3.6-plus). A/B on the test video:
 * faster (50s vs 64s) + cheaper (output $1.6 vs $2.4/M) at identical insight quality, §-cites,
 * and guard behavior; deaf like 3.6-plus (no capability lost). Apollo composite may shift within
 * provider noise across the model boundary, so isolate the cache. Fold stays qwen3.5-omni-plus
 * (sense-complete + free in preview + fastest; omni-flash rejected — malformed JSON + collapsed
 * curves; 3.7-plus rejected for fold — deaf + 65s on the gating call).
 *
 * Bumped 3.15.0 → 3.16.0 (2026-06-11, fold model flip — harness A/B): the fold (audience-sim)
 * moved qwen3.5-omni-plus → qwen3.5-omni-FLASH (default; FOLD_MODEL=omni-plus rolls back). A/B on
 * 2 clean videos: flash is 5–6× faster on the gating call (8s vs 40–52s) + ~3.5× cheaper, with
 * diversity tracking plus within ±0.04 (no collapse — the old spike's collapse was the bare-
 * JSON.parse bug, fixed via stripModelOutput in runFold). Both stay omni → audio retained. The
 * behavioral/audience term feeds 0.5 of overall_score on video, so scores shift across the model
 * boundary; isolate the cache. Deferred (noted): persona-split + segment cap for long-video output.
 *
 * D-23 cache invariant: prediction-cache.ts keys on ENGINE_VERSION; this bump auto-invalidates
 * all `3.15.0` cached rows on next analyze-route call (L1 in-memory + L2 Supabase filter).
 */
export const ENGINE_VERSION = "3.16.0";
