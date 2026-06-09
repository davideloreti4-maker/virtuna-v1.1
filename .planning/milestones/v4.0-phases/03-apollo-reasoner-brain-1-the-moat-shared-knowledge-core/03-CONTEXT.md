# Phase 3: Apollo Reasoner (Brain 1) — THE MOAT + shared knowledge core - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Reframe the score-mode reasoner (`src/lib/engine/deepseek.ts` — misnamed; actually Qwen `qwen3.6-plus` via DashScope) into the knowledge-grounded expert: wire the distilled `KNOWLEDGE-CORE.md` as the stable, cached system prompt (swap the generic 5-step framework), feed it Omni verbatim, and extend output with an explainable **composite score** + **hook rewrites**. Ground Remix's `decode` + `adapt` in the **same** core (R12). Single Apollo call, deterministic.

**Delivers:** R2 (Apollo reasoner with quote-grounded rewrites), R5 partial (Apollo half of the score), R12 (one brain across score + remix modes).

**NOT in this phase:** Audience-Sim (P4), audience-aware rewrites + full Apollo+Audience-Sim score rederivation + grounded engagement estimate (P5), per-segment rewrites, UI rendering of the dimension bands (P5).
</domain>

<decisions>
## Implementation Decisions

### creator-rules: supersede the prompt injection
- **D-01:** The `KNOWLEDGE-CORE` is the **single brain SSOT**. Dormant `creator-rules.ts`'s prompt-injection constants (`CREATOR_RULES_BLOCK`, `CREATOR_RULES_NUMERIC`, etc.) — they already live only in the dormant stage11 and §8 maps their substance into the core. **Do not** inject both (no dual knowledge base).
- **D-02 (guard):** BEFORE dormanting `creator-rules.ts`, verify the core's §2.0a calibration anchors actually carry the key hard numbers (hook ≈ 80% of performance, outlier = ≥5× follower count, platform length targets). If any anchor is missing from the core, **port it into the core first**, then dormant. No silent loss of a calibration number.
- **D-03:** The deterministic UI checker `creator-rulebook.ts` (`deriveCreatorRulebook()` → `CreatorRulebookCard` / `ContentAnalysisFrame`) is a **separate board-signal layer, NOT Apollo's prompt** — leave it fully untouched this phase.

### Composite score: sequencing
- **D-04:** When Apollo comes online in P3, it **replaces the gemini/visual (~35) half** of the live blend. Live blend becomes **`behavioral 40 + Apollo`** (renormalized). This unblocks the deferred gemini-judgment drop (P2 CONTEXT deferred it to P3 precisely so Apollo could replace that half).
- **D-05:** The **full Apollo + Audience-Sim score rederivation is deferred to P5** (R5's definition is Apollo **+** Audience-Sim; Audience-Sim doesn't exist until P4). Do NOT make Apollo own the entire 0–100 in P3 — that would swing the user-visible number twice and produce an Apollo-only derivation R5 never wanted. Behavioral (wave3 personas) stays its own term until P4 folds it into Audience-Sim.

### Composite score: dimensions
- **D-06:** Apollo emits the core **§4 output contract as-is**: 6 dimensions — **Hook · Retention · Clarity · Share-pull · Substance/originality · Credibility(bonus)** — each graded **Strong/Mid/Weak** with the §2 lever named + sensor signal quoted as evidence; **one** holistic, hook-weighted composite **0–100** (≈80% hook weight); **no per-dimension numeric sub-scores**, composite is a judgment **not an arithmetic sum**. This §4 composite is the "Apollo term" in the `behavioral + Apollo` blend (D-04).
- **D-07 (guard):** During P3 research, **verify the 6 dimensions are the right/complete high-leverage set** (no missing high-leverage dimension, no redundant one) against the A/B-validated evidence + best practice. Surface any better set before locking; default is adopt §4 as-is.

### Rewrites
- **D-08:** **Scope = the verbatim hook line only.** Emit **2–3 directional variants**, each fixing a **different §2 lever** per §6 (not three cosmetic edits of one fix), quote-grounded, honoring §1 voice rules. Satisfies R2 + its verify (a rewrite whose `original` matches the verbatim hook). Per-segment rewrites are **deferred**.
- **D-09:** P3 rewrites are **craft-grounded only**. Making them **audience-aware** ("viewers bounced at 0:02 → rewrite…") needs Audience-Sim and the `Omni → Audience-Sim → Apollo` sequencing — that is **P5**, out of scope here.
- **D-10:** **Single Apollo call, `temp0 + seed` for everything** (score + critique + rewrites in one deterministic call). Do NOT split rewrites into a separate temp>0 call — that adds a 4th LLM call against the ~3-call architecture that is this milestone's whole point. Determinism is a feature (reproducible + cacheable); rewrite quality comes from §6 templates + verbatim grounding, not sampling temperature. (Revisit a temp bump only if rewrite variety proves inadequate — YAGNI now.)

### Remix R12: one brain across modes
- **D-11:** **Re-ground the knowledge, preserve the output contracts.** Swap `decode.ts`'s bespoke framework → core **§5 decode lens**; swap `adapt.ts`'s `ADAPT_SYSTEM_PROMPT` framework → core **§6 + §2**. Their system prompts must reference the shared core (R12 verify: "reference the shared core; no divergent knowledge base").
- **D-12:** **Keep the existing Zod output schemas intact** — decode's `luck[]` (+ D-04/D-05 backstops) and 4 beats, adapt's `concepts` — so `/api/remix/adapt` and the Remix board do NOT break. No output-contract refactor this phase (unnecessary blast radius).
- **D-13 (guard):** Verify §5's 4 beats (`hook_pattern / structure_pacing / the_turn / emotional_beat`) map cleanly onto decode's existing output fields. The core already absorbed decode's unique "repeatable vs luck" concept (§5), so re-grounding loses nothing; if a bespoke decode field has no core grounding, add it to the core or keep minimal bespoke glue.

### Claude's Discretion / left for research (NOT user decisions)
- **Core delivery form:** how the ~29KB `KNOWLEDGE-CORE.md` becomes the **byte-stable** cached system prompt (inline TS constant vs build-time/runtime file read). DashScope input-cache hit (latency) hinges on byte-identity — mirror the existing `STABLE_SYSTEM_PROMPT` byte-stability contract in `deepseek.ts`. Researcher/planner decides.
- **Confidence indicator derivation:** per §4, confidence scopes to signal coverage (transcript-only loses visual signals, etc.). Implementation detail for planning.
- **Keep infra:** circuit breaker, retries, cache split in `deepseek.ts` are retained (roadmap "Does").
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Knowledge core (the brain — MUST read end-to-end)
- `.planning/corpus/KNOWLEDGE-CORE.md` — v1.1 validated distilled brain. **§4** = scoring rubric/dimensions (D-06), **§5** = decode lens (D-11/D-13), **§6** = rewrite lens (D-08), **§2.0a** = calibration anchors (D-02 verify target), **§1** = voice rules, **§8** = sources + the supersede-vs-merge note (D-01).
- `.planning/corpus/HOW-TO-BUILD.md` — how the core was distilled (provenance, update rules).
- `scripts/apollo-core-smoke.ts` — the A/B validation harness (Omni→reasoner, scores 26–86); the evidence behind D-07.

### Milestone SSOT + requirements
- `.planning/ENGINE-MAP.md` — engine teardown SSOT; ~3-call target, `Omni → Audience-Sim → Apollo` sequencing, Remix-as-Apollo-modes (R12).
- `.planning/REQUIREMENTS.md` — R2 (reasoner + rewrites), R5 (honest expert score), R12 (one brain across modes); R10/R11 context for P4/P5.
- `.planning/ROADMAP.md` — Phase 3 goal/does/success/risk.
- `.planning/STATE.md` — locked decisions (score = expert assessment, determinism = tolerance band).

### Source files this phase reshapes
- `src/lib/engine/deepseek.ts` — score-mode reasoner; `STABLE_SYSTEM_PROMPT` (swap target), `reasonWithDeepSeek()`, byte-stability contract, circuit breaker.
- `src/lib/engine/remix/decode.ts` — `runDecode()`, `luck[]` Zod contract (D-04/D-05 backstops), 4 beats (preserve — D-12).
- `src/lib/engine/remix/adapt.ts` — `ADAPT_SYSTEM_PROMPT`, `AdaptConceptZodSchema`, `generateAdaptConcepts()` (preserve `concepts` contract — D-12).
- `src/lib/engine/creator-rules.ts` — prompt-injection constants to dormant after D-02 verify.
- `src/lib/engine/creator-rulebook.ts` — deterministic UI checker; **do not touch** (D-03).
- `src/lib/engine/aggregator.ts` — where the score blend lives (D-04 behavioral+Apollo rewire).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `deepseek.ts` `STABLE_SYSTEM_PROMPT` + 2-message structure (stable system prefix + per-request user content) — the exact pattern for the byte-stable cached core; reuse the structure, swap the content.
- `deepseek.ts` circuit breaker + retries + cost tracking — keep.
- Verbatim payload from P2 (`verbatim.hook` + `verbatim.segments[]`, persisted JSONB) — the feed into Apollo (the real line to quote in rewrites).

### Established Patterns
- **Byte-stability contract** (creator-rules.ts header + deepseek STABLE prompt): build-time constant strings, no interpolation in the cached prefix — required for DashScope input-cache.
- **Mode switch** `mode: 'score' | 'remix'` already routes score vs remix paths — extend, don't rebuild.
- **Zod-parse + pure-TS backstop** (decode D-04/D-05) — output-contract guard pattern to preserve.

### Integration Points
- `aggregator.ts` score blend — gemini half → Apollo composite (D-04).
- Both route persist sites (P2: `route.ts:598` INSERT + `:928` SSE UPDATE) — Apollo's new output (rewrites + composite) threads here; ENGINE_VERSION bump expected.
- `/api/remix/adapt` + Remix board — consumers of decode/adapt output contracts (must stay green — D-12).
</code_context>

<specifics>
## Specific Ideas

- "Insight is the hero, score is secondary" — the rewrites + critique are P3's live value; the score-flip is lower-stakes (Apollo-direction memo).
- "Adopt + verify" discipline applied twice: core numbers (D-02) and dimension set (D-07) — trust the validated core but confirm before ripping out / locking.
- Score is a chess-engine-style position eval (expert ground truth), not an empirical performance claim.
</specifics>

<deferred>
## Deferred Ideas

- **Per-segment rewrites** — beyond R2's hook requirement; future phase if hook rewrites prove the value.
- **Audience-aware rewrites** + `Omni → Audience-Sim → Apollo` wiring → **P5**.
- **Full Apollo + Audience-Sim score rederivation** + grounded engagement estimate (R11) → **P5**.
- **temp>0 rewrite pass** — only if temp0 rewrites prove too samey (A/B later).
- **Remix output-contract refactor** — only if a contract genuinely conflicts with the core; not now.
</deferred>

---

*Phase: 3-Apollo Reasoner (Brain 1) — THE MOAT + shared knowledge core*
*Context gathered: 2026-06-05*
