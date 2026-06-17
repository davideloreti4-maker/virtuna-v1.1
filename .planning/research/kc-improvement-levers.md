# KC Improvement Levers — beating standard LLM by a lot

> Captured 2026-06-17, after the 02-04 cold-start blind gate showed prose-craft alone is a thin edge.
> Purpose: backlog for a future **"KC Grounding & Quality-Loop"** phase (post-Phase-2). Phase 2 ships the
> static corpus (discipline); these levers add *rightness* (data + quality loop) — the durable moat.

## The core insight
The gate ran **cold-start (no profile)** — the corpus's floor. There, KC ≈ raw LLM (margin only),
because every model gets better at generic craft for free. Two buckets of advantage:
- **Discipline** (what the corpus does): anti-slop, specificity, honesty, mechanism-naming, output cleanliness. Caps out ~20-30% better than raw.
- **Rightness** (what data + a quality loop do): grounding in real creator data + real high-performers + executed self-rejection. This is where the "wow / structurally-cannot-be-copied" delta lives.

## Levers, ranked by impact × cost

| # | Lever | Why it beats raw LLM structurally | Cost | Lives in | Status |
|---|---|---|---|---|---|
| 1 | **Real-exemplar retrieval (RAG)** | Inject 2-3 *actual recent high-performers* in the creator's niche (hook/format/why-it-worked). Raw LLM can't know what went viral this week. (= Sandcastles' moat) | Med-High | data + assembler | future phase |
| 2 | **Live profile grounding** | Ground in *this* creator's real wins/flops/audience/past videos. Raw LLM has zero memory of them. Assembler arg exists (02-02) but needs real data + the gate must test WITH it. | Med | assembler | partially built |
| 3 | **Generate → critique → regenerate loop** | Actually execute the Value Bar: over-generate, score each (mechanism? non-fakeable concrete? fit? not reckless? not trope?), kill failures, regenerate. Best-of-N w/ rubric beats single-shot. Raw LLM is one-pass. | Med | pipeline | future phase |
| 4 | **Anti-slop negative grounding** | Forbid the niche's done-to-death tropes; raw LLM regresses straight to them. | Low | corpus ✅ + assembler (per-niche trope list) | **corpus DONE (BASE Prohibition 6); runtime trope-injection = future** |
| 5 | **Specificity-forcing slots** | Require a non-fakeable concrete (number/tool/moment/metric) per item; auto-reject "swap-the-niche-name" output. | Low | corpus ✅ + critique pass | **corpus DONE (BASE Value Bar Test B); enforced loop = future (see #3)** |
| 6 | **"Will this flop?" adversarial pass** | Predict each idea's failure mode for *this* audience before emitting (flops data + failure modes). Raw LLM is relentlessly positive. | Med | pipeline | future phase |
| 7 | **Creator-voice calibration** | Ground in the creator's own transcripts so output sounds like *them*, not generic. | Med | data + assembler | future phase |
| 8 | **Performance feedback flywheel** | Log shipped ideas + their real performance → feeds back; the KC *learns this creator*. Raw LLM never improves. The compounding moat. | High | infra | future phase |

## Done now (Phase 2 corpus — the two free levers)
- **#4 → BASE Prohibition 6** "No predictable-for-the-niche output" + the "obvious list" test.
- **#5 → BASE Value Bar Test B** strengthened to require a non-fakeable concrete.
Both in BASE → inherited by ideas/hooks/chat/scoring. Committed; byte-stable.

## Proposed future phase: "KC Grounding & Quality-Loop"
Sequence by impact × cost: **#4/#5 runtime enforcement → #3 generate-critique-regenerate → #2 real profile grounding → #1 exemplar RAG → #6 flop-prediction → #7 voice → #8 flywheel.**
Levers 1-3 are the real differentiators; they are pipeline/data work, NOT corpus prose — their own phase.

## Immediate implication for the 02-04 re-gate
Re-run the gate **WITH a realistic profile + 1-2 real exemplars**, not cold-start. The cold-start number is misleadingly pessimistic — it measures the corpus floor, not the product's true delta (corpus + grounding). See `RESUME-HERE.md`.
