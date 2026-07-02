# HANDOFF — Numen Backend Audit + Grounding-Improvement Effort

> **What this is:** the resume point for the in-depth backend audit of Numen's engine (the in-thread skills, the SCORE/video pipeline, and the grounding that drives output quality). Started 2026-06-27 on `main`.
> **North star:** understand the backend deeply, then *improve output quality via better grounding*.
> **How it was built:** code-verified — 14 parallel deep-trace agents + direct reads. Every claim in the linked docs cites `file:line`.

---

## Paste this into a fresh session to resume

```
Resuming the Numen backend audit + grounding-improvement effort.

Read first, in order:
1. docs/HANDOFF-backend-audit.md      — this handoff (state + prioritized backlog + resume plan)
2. docs/subsystems/skills-grounding.md — GENERATE path: in-thread skills + grounding; the "barbell" finding
3. docs/subsystems/score-pipeline.md   — SCORE path: the video engine / "the Read"
   (memory: skills-grounding-audit has the condensed version)

State: both engine brains fully mapped (GENERATE skills + SCORE pipeline). Two SSOT docs written.
North star = improve output quality via grounding. Keep GSI in mind: DON'T refactor the brains
(GSI wraps them as DomainPack); improve the live grounding tier + brain content in-place.

Mental model: two LLM brains, never shared. SCORE = Apollo (apollo-core.ts KNOWLEDGE_CORE, thinking ON)
via pipeline.ts. GENERATE = KC (kc/compiled.ts, thinking OFF) via api/tools/* runners. Both use a
two-tier prompt: byte-stable brain (cached) + volatile assembleBundle() live grounding (capped 4000 chars).
THE CORE FINDING (barbell): brain is heavy+excellent, live grounding tier is near-empty → model forced
toward the generic output the brain forbids. Ceiling is in the pipe, not the brain.

Recommended next: scope A2 — inject the already-baked audience signature signal
(what_resonates/what_falls_flat/evidence) into assembleBundle; the bake pays for it, the generate
pipe drops it. Cheap, high-value, GSI-safe. Companion: A0 (normalize generation-side audience
steering across ideas/remix/ideas-develop — also fixes real bugs).

Remaining audit slices not yet done: audience moat lifecycle (bake→drift→flywheel REFINE) + backend
infra (auth/RLS/rate-limit/Apify/storage/cost).

Pick up by: <choose — scope A2 into a change plan | audit the audience moat lifecycle | start a fix>
```

---

## What's been done

| Deliverable | Path | Covers |
|---|---|---|
| GENERATE-path SSOT | `docs/subsystems/skills-grounding.md` | the two-brain architecture, the gen→sim→rank pipeline, all 10 skill contract cards, the Qwen model layer, the grounding deep-dive, the improvement surface, dead/dormant, GSI delta |
| SCORE-path SSOT | `docs/subsystems/score-pipeline.md` | `/api/analyze` end-to-end: Wave-0 sensor → Apollo → fold → aggregator + anti-virality; the corrected scoring math; the score-side grounding map; dead/dormant; GSI wrap |
| Memory (condensed) | `memory/skills-grounding-audit.md` | one-file recall of both, with the headline findings |

**Coverage:** GENERATE (skills + grounding) ✅ · SCORE (video engine) ✅ — the full engine core, both brains.
**Not yet audited:** the audience moat *lifecycle* (we mapped the bake + injection, not the drift cron + flywheel REFINE loop) · backend infra (auth/RLS/rate-limit/Apify/storage/cost/Whop).

---

## The mental model in 6 lines

1. **Two LLM brains, never shared.** SCORE = Apollo (`apollo-core.ts` `KNOWLEDGE_CORE`, thinking ON). GENERATE = KC (`kc/compiled.ts`, thinking OFF).
2. **Two-tier prompt (both):** byte-stable brain (cached) + volatile `assembleBundle()` live grounding (capped 4000 chars).
3. **The barbell:** brain is heavy + excellent; live grounding tier is near-empty → output ceiling is in the pipe, not the brain.
4. **Skill pipeline:** GENERATE → SIMULATE (SIM-1 Flash, 10 personas) → RANK (math) → BUILD (typed blocks) → PIN (flywheel).
5. **The Read (video):** `overall_score = 0.5·apollo + 0.5·fold`. Pure 0–100 quality read (no follower multiplier). Apollo is audience-agnostic; the audience moves the score only through the fold.
6. **GSI:** wraps both brains as a pluggable `DomainPack` (Phases 1–3 already on `main`). Don't *refactor* the brains; improve the live tier + brain *content* in-place.

---

## Consolidated findings backlog (prioritized)

Ranked across both docs by leverage × effort × GSI-safety. IDs (A2/A0/…) match the skills-grounding doc.

### Tier 1 — Quality levers (the north star)
1. **A2 — inject the baked signature signal** (`what_resonates`/`what_falls_flat`/`evidence`) into `assembleBundle`. The bake already pays for it; the generate pipe drops ~70% of the signature. Cheap, high, GSI-safe. **← recommended first build.**
2. **A0 — normalize generation-side audience+creator steering.** Wired only on hooks/script; ideas surfaces the line display-only, remix + ideas/develop drop it. Almost free; also fixes bug #6/#7 below.
3. **A1 — enrich `past_wins`/`past_flops`** (count-only today → scrape + pattern-extract real mechanisms). Med effort, high. The brain explicitly demands this signal.
4. **A3 — re-tune `BUNDLE_CHAR_CAP`** from measured slice sizes (never done; code admits placeholder). Low.
5. **Close the SCORE text-path self-judge asymmetry** — the no-video path still emits judgment `factors` (bypasses the pure-sensor D-R1 the video path enforces). Med.
6. **(Design call) Thread the audience repaint into Apollo** — today the craft verdict is audience-agnostic; the audience only moves the fold's 50%. Wiring change if the audience should also move the craft read.

### Tier 2 — Bugs / correctness
7. **ideas/develop drops audience/intent/pin** → the "Develop this →" chain always generates General-grounded hooks. (Fixed by A0.)
8. **remix has no creator steering** + voids the grounding line → adapt grounded by `KNOWLEDGE_CORE` + niche string only. (Fixed by A0.)
9. **`ai/deepseek.ts` + `ai/gemini.ts` are live but documented-dead** and drift (thinking-ON, unbounded, no seed) — contradicts MODEL-POLICY.md. Fix or kill.
10. **Fold slot↔archetype mis-bucketing** on non-talking-head content (b_roll/action/vlog) — per-archetype weights can be miscategorized.
11. **read uses a flat band** (`aggregateFlash` without weighting) — calibration moves the verdict only via repaint. Confirm intended.

### Tier 3 — Enablers / hygiene (quality-neutral)
12. **Regen pipeline broken on `main`** — KC/Apollo `.md` sources absent; `compiled.ts`/`apollo-core.ts` are the live committed artifacts. **Resolve before any brain-content work (lever C).** Important enabler.
13. **Dead-code deletion** — retrieval (not even in the blend), Stage-11 counterfactuals, ml/rules/trends/audio-fingerprint/platform_fit, `persona-prompts*.ts` (fully dead), `applyCtaPenalty`, `weighted-aggregator-client.ts`, `creator-rulebook.ts`, orphaned JSONs (`training-data.json` 2.6 MB, `ml-weights.json`, `calibration-baseline.json`).
14. **Stale comments/docstrings** — model names (omni-plus/qwen3.6 → omni-flash/3.7-plus), runner headers (ideas "no ranking", remix "concepts[0]").
15. **No rate-limit on chat/refine** (and `void`ed in hooks/ideas) — launch-gate item.
16. **`predicted_engagement` not persisted** — null on reload; needs a column if product-visible.

### Tier 4 — Bigger bets
17. **Revive RAG** (lever B) — the full retrieval stack exists + ingest writes embeddings, but the read side is stubbed empty. High effort; aligns with GSI's `DomainPack.grounding`.

---

## Recommended resume paths (pick one)

- **Build the quality win:** scope **A2 + A0** into a concrete change plan (no GSI conflict; attacks the barbell with data you already own). Start: `kc/assembler.ts` + the runners + `audience-types.ts` signature fields.
- **Finish the engine map:** audit the **audience moat lifecycle** (`audiences/calibrate` route → `enrich-signature` bake → `cron/audience-drift` re-bake → `flywheel/` recalibration/proposals/confidence-gate). This is the moat's *learning loop* — the one core piece not yet traced.
- **Then:** backend infra slice, or start clearing Tier-3 hygiene to unblock brain-content work (especially #12, the regen pipeline).

---

## Guardrails (don't regress)

- **Don't refactor the brains** — GSI extracts them into `DomainPack`; structural refactor fights the milestone. Improve live grounding + brain *content* in-place.
- **Don't `git merge rework/engine-core`** (GSI Phase 0 content already on `main` piecemeal).
- **Byte-stability** — KC/Apollo system prompts are cached prefixes; per-request data goes in the user message only.
- **Honesty spine** — never fabricate a mechanism from a URL / a grade from a thin profile; cold-start uses honest baselines.
- **General/null audience must stay a byte-identical no-op** (the regression gate) — any new injection must short-circuit on `is_general`.
</content>
