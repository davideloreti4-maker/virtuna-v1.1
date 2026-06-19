# Phase 14: KC Grounding & Quality-Loop - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Move generation from **discipline** (prose-craft, ~20–30% over raw LLM — shipped in the P2 corpus) to **rightness** — real grounding + executed self-rejection, the durable moat ("foresight, not generation").

**Reshaped during discussion (2026-06-19):** the original 9-lever scope (KCQ-01..09) was deliberately narrowed. The phase now ships a tight **SIM-foresight spine + quality loop + voice**, and **defers all exemplar grounding** (live RAG, cited-research, curated template library) to a future "grounding" phase. Rationale threaded through every decision below: prefer **cheap + certain + controllable** over **expensive + unproven**.

**In scope (P14 core, full depth):** KCQ-06 (SIM niche-blind fix + threshold recalibration) → KCQ-05 (formalize the SIM gate), KCQ-01 (live-profile grounding), KCQ-02 (best-of-N generate→critique→regenerate, Ideas+Hooks only), KCQ-04 (flop-prediction pass), KCQ-08 (voice calibration). **Thin:** KCQ-07 (runtime trope/specificity reject), KCQ-09 (plain-language "made-for-you" rationale), **+ the owner's 26 ready hook templates folded in as silent corpus grounding.** **Honesty fix:** HONESTY-01 (delete the fake `§N` citation pills — not re-lit).

**Out of scope (deferred → future "grounding" phase):** KCQ-03 live-exemplar RAG, its N2 cited-research pass, and any *large* scraped/curated exemplar library beyond the 26 templates. (The 26 ready owner-owned templates are IN — see D-16; the big-library/live-data build stays deferred.)

**Engine note:** grounding/pipeline/data work — keep the regression gate green. Bump `ENGINE_VERSION` only if Max video-scoring output deliberately changes (most of this is the text path). **UI:** minimal (mostly pipeline).
</domain>

<decisions>
## Implementation Decisions

### Phase scope & sequencing (Area 4 — must-ship core)
- **D-01:** **Core tier (full depth) = SIM spine + grounding + loop + voice:** KCQ-06 + KCQ-05 + KCQ-01 + KCQ-02 + KCQ-04 + KCQ-08. Coherent, mutually reinforcing, pure pipeline — no new data infra.
- **D-02:** **KCQ-06 → KCQ-05 is the moat spine and a hard sequence.** The text SIM is currently *niche-blind* (flat 6/6/6/6/5, "all Mixed") because `runFlashTextMode` uses generic equal-weighted personas instead of the rich `persona-registry`. **Formalizing the SIM gate (KCQ-05) is pointless until KCQ-06 fixes this.** KCQ-06 also includes **threshold recalibration** (slop-vs-strong test) that validates the gate can actually say "no" — without it the gate is unusable. Build KCQ-06 first.
- **D-03:** **SIM = quality/resonance GATE, not a ranker** (owner reframe, carried from levers doc). It clears the slop floor + gives per-persona "why they scrolled" texture; it does NOT finely order good ideas. Card UX leads with a sharp scroll-quote, not the fraction.
- **D-04:** **Tail: thin KCQ-07 + KCQ-09; KCQ-08 promoted to core.** KCQ-07 = thin runtime trope/specificity auto-reject (the P2 corpus floor already covers most — BASE Prohibition 6 + Value Bar Test B). KCQ-09 = thin inline **plain-language "made-for-you" rationale** (e.g. *"because your audience is 18–25 gym beginners and your last 3 myth-busting videos overperformed"* — GROUND-03 style); full surface deferred to P12 IA. **This is NOT source-citation** (see D-14): it's personalization-trust + a steering lever, which has user value; citation-of-source does not.

### Quality loop (Area 2 — KCQ-02 + KCQ-04)
- **D-05:** **Best-of-N loop = PARALLEL over-generate, not serial.** Fire N candidates in parallel (≈1× latency), Flash-critique against the Value Bar rubric (mechanism? non-fakeable concrete? fit? not trope?), ship the best passer. **This is the key reframe** — the "2–4× latency" objection only applies to serial regeneration; parallel generation keeps it snappy, cost = cheap Flash tokens not wall-clock.
- **D-06:** **Conditional regeneration only.** Regenerate **only when ALL candidates fail the rubric floor** (rare). In that one case the user prefers a beat's wait over slop. Common path = ≈1× latency. No unbounded loop.
- **D-07:** **N = 3.** Best-of-N sweet spot — meaningful spread over one-pass without much token cost.
- **D-08:** **Critic model = SIM-1 Flash** (`run-flash-text-mode.ts` already exists). Cheap + fast keeps best-of-N affordable; an explicit rubric doesn't need Max-tier reasoning, and an independent judge beats generator self-critique.
- **D-09:** **Loop scope = Ideas + Hooks ONLY.** The Value-Bar rubric is a content-item rubric. **Excluded:** Script (full-script best-of-N is costly + rubric is weak for long-form → keep one-pass for now; revisit), Test (judges *existing* input content — its lever is KCQ-05's SIM loop, nothing to over-generate), Chat (conversational turns aren't discrete artifacts; 3× cost/latency per message breaks chat — its quality comes from grounding + corpus).
- **D-10:** **KCQ-04 flop pass = internal filter + opt-in reveal.** Flop-prediction runs as an internal gate (kills/regenerates likely-floppers before emitting) AND the per-item predicted failure-mode is available on-demand (drill/expand) — not shoved in the user's face. Honest + actionable without breaking the positive-but-honest tone (no always-visible flop card; not silent-only).

### Voice calibration (Area 4 — KCQ-08, promoted to core)
- **D-11:** **KCQ-08 is in the CORE, not deferred — and it's cheap.** Code evidence corrected an earlier mis-tiering: the **N1 voice sample is already shipped** (merge `d2f121e7`), `profileRow.writing_voice_sample` is a real populated field, and `assembler.ts:111–115` **already plumbs `voice`** into Ideas/Hooks/Script/Remix grounding. **No own-data scrape needed.**
- **D-12:** **The work is prompt calibration, not new infra.** Today voice is "appended last, **drops first under cap**" (assembler comment) and is a raw sample, not an enforced style. So output often *doesn't* sound like the creator. KCQ-08 = (a) **promote voice priority** (stop dropping it first), (b) add an explicit **"write in this voice"/style-match instruction**, (c) optionally **few-shot** the voice sample. Different mechanism from RAG: own-voice ("sound like me") vs others'-virality ("what's winning"). The Sandcastles persona/voice parallel; directly counters the "robotic/generic" weakness (same enemy as KCQ-09).

### Honesty fix + citation philosophy (Area 1 — HONESTY-01)
- **D-13:** **Delete the fake `§N` citation pills.** In `ExpertChatThread.tsx` the model sprinkles `§N` markers that render as coral-outline pills with a static tooltip map — **decorative, no retrieval behind them** (memory `chat-citations-not-grounded`). Honesty-spine violation. Remove this phase.
- **D-14:** **Do NOT re-light citation pills — the user doesn't need to know what was cited** (owner call). For content (a hook/idea), "cited template #N" is internal plumbing, not value — visual noise about how the sausage was made. The user judges the hook directly. **Source-citation only ever earns its place for *verifiable factual claims*** (the deferred N2 cited-research pass — "is this true? where's the source?"), and even there it's optional. Template/corpus grounding is used **silently**. HONESTY-01 = delete, full stop; no positive re-light. (Distinct from KCQ-09 "made-for-you" rationale, which DOES have value — see D-04.)

### Curated grounding — the owner's 26 hook templates (Area 1 follow-up)
- **D-16:** **Fold the owner's 26 ready hook templates into P14 as a THIN grounding addition** (used silently — no pills). Materially different from the deferred "build a curated library": **owner-owned (no IP risk) + already curated (no build cost)** — the cheapest grounding win available. Add them as a **concrete exemplar layer UNDER the `hooks.md` archetype table** (they're concrete instances of mechanisms it already names — reinforce, don't duplicate); ship via the existing **compile pipeline** (`hooks.md` → `compiled.ts` → `kc-version.ts` bump, byte-stable, tested). Sits alongside KCQ-07/08 in the corpus-enrichment lane.
- **D-17:** **Templates feed PRIVATE REASONING, never emitted verbatim.** A 26-template set used mad-libs/fill-in-the-blank = the exact anti-slop enemy P2 fought. Ride the discipline `hooks.md` already enforces on archetypes ("never an emitted `[SLUG]` tag"): pattern inspiration for the model's reasoning, not output scaffolds. Primary surface = Hooks (+ Ideas where relevant).
- **D-18:** **Map-before-merge.** Before wiring, eyeball the 26 against the archetype table to confirm clean fit (instances under existing mechanisms, no contradiction). Owner shares the list at planning/execution. Discipline-tier quality lever, **NOT the structural moat** (copyable) — the structural moat stays SIM foresight + owned audience + flywheel.

### Deferred grounding decisions (Area 1 + 3 — captured for the future phase)
- **D-15:** **Live/large/factual grounding deferred to a future "grounding" phase** (the 26 templates excepted — D-16): (a) **KCQ-03 live-exemplar RAG** — deprioritized: lift is *asserted not measured*, priciest lever, parrot/slop downside; cheaper KCQ-01/02 more certain. **If ever built: validate-first** (cheap corpus-only vs corpus+2-exemplars spike, owner-judge delta). (b) **N2 cited-research pass** — travels with RAG (best home is Script, which stays one-pass; no web-search infra — brave/firecrawl/exa all off). (c) **Large scraped/curated exemplar library beyond the owner's 26** — deferred; the 26 are the cheap first step that proves the lane.

### Claude's Discretion
- Exact rubric wording for the Flash critic (extend the existing Value Bar / BASE Test B), the precise threshold values from the slop-vs-strong recalibration, and the inline-legibility (KCQ-09) micro-copy/placement are left to research + planning, within the decisions above.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase source & requirements
- `.planning/research/kc-improvement-levers.md` — **THE source doc.** Levers ranked by impact×cost, the discipline-vs-rightness thesis, the SIM "gate not ranker" reframe, and the niche-blind SIM audit (lever #10) that grounds KCQ-06.
- `.planning/REQUIREMENTS.md` — KCQ-01..09 definitions (lines 158–166) + HONESTY-01 (line 195).
- `.planning/ROADMAP.md` §Phase 14 (lines 426–432) — goal, dependencies, requirement sequencing, engine/UI hints.

### SIM gate / niche-blind fix (KCQ-06 → KCQ-05)
- `src/lib/engine/flash/run-flash-text-mode.ts` — the text Flash path; currently can't receive a niche. **KCQ-06 target.**
- `src/lib/engine/flash/flash-prompts.ts` — `STABLE_FLASH_SYSTEM_PROMPT` (generic personas), `STRONG_THRESHOLD`/`MIXED_THRESHOLD` (never empirically set — KCQ-06 recalibrates), and the idea-question reframe ("judge the idea AS THE FINISHED VIDEO").
- `src/lib/engine/wave3/persona-registry.ts` — `selectPersonaSlots`, the `NICHE_INSTANTIATION` table, and FYP/`tough_crowd` ~30% weighting. **Exists but the text path never calls it — KCQ-06 wires it in.**
- `src/lib/engine/flash/__tests__/` — the regression gate. Keep green (61/0 baseline noted in source doc).

### Grounding & voice (KCQ-01, KCQ-08)
- `src/lib/kc/assembler.ts` — per-mode grounding assembly (lines 111–115 role sets incl. `voice`; `hasVoice` from `writing_voice_sample`). KCQ-01 (profile grounding) + KCQ-08 (promote voice priority).
- `src/stores/profile-interview-store.ts` — voice-sample capture (N1, shipped `d2f121e7`).

### Honesty (HONESTY-01)
- `src/components/command-bar/ExpertChatThread.tsx` — `§N` → `§cite:N` pill rendering + static corpus-section tooltip map (line 26+, 332–374). Remove for D-13.
- Memory `chat-citations-not-grounded` — the original flag.

### Corpus (KCQ-07 thin reject + the 26-template fold-in, D-16)
- `.planning/corpus/hooks.md` (357 lines) + `src/lib/kc/compiled.ts` (`KC_HOOKS_SLICE`) + `src/lib/kc/kc-version.ts` — existing hook craft discipline (archetype table = private reasoning, never emitted). **The 26 owner templates slot UNDER the archetype table here**; the compile pipeline (`hooks.md` → `compiled.ts` → `kc-version.ts` bump, byte-stable, tested) is the pattern both the 26-template fold-in and KCQ-07's thin reject follow.

### Deferred-phase infra (KCQ-03 RAG, when picked up later)
- `src/lib/engine/_dormant/retrieval/` (pgvector-client, retrieval-stage) + `src/lib/supabase/pgvector.ts` + migration `supabase/migrations/20260518000000_phase8_pgvector.sql` + `20260524000000_niche_post_windows.sql` — dormant retrieval stack + niche windows; the foundation for the future exemplar-RAG phase.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`persona-registry.ts` (`selectPersonaSlots` + `NICHE_INSTANTIATION` + FYP weighting):** the rich niche-true persona engine already exists for the video path — KCQ-06 just threads niche/content-type into `runFlashTextMode` and builds the panel via `selectPersonaSlots` instead of the flat generic block (gets niche-true personas AND the ~30% FYP/tough_crowd weight "for free").
- **`run-flash-text-mode.ts` (SIM-1 Flash text-mode):** doubles as (a) the gate to formalize (KCQ-05) and (b) the cheap critic for best-of-N (D-08). Already proven the synthetic audience can react to text.
- **`assembler.ts` voice plumbing:** `writing_voice_sample` shipped + already assembled into grounding — KCQ-08 is a priority/instruction change, not new infra.
- **Dormant retrieval stack (`_dormant/retrieval/`):** untouched this phase, but the ready foundation for the deferred RAG phase.

### Established Patterns
- **Corpus-compile pipeline:** any corpus/prose change goes `*.md` → `compiled.ts` → `kc-version.ts` bump, recompiled byte-stable, with flash+kc tests green. KCQ-07's thin runtime reject and the deferred curated library both follow this.
- **Archetype = private reasoning, never emitted:** the anti-slop discipline `hooks.md` enforces (no `[SLUG]`/template leakage). Any exemplar/template grounding MUST feed reasoning, not become fill-in-the-blank output.
- **Regression gate green + `ENGINE_VERSION` discipline:** bump only if Max video-scoring output deliberately changes; most of P14 is the text path.

### Integration Points
- **KCQ-06:** `runFlashTextMode(text, framing)` → add niche/content-type param; build panel via `selectPersonaSlots`; recalibrate thresholds via slop-vs-strong test.
- **KCQ-02:** wrap the Ideas + Hooks runners with a parallel N=3 Flash-critique selector; conditional regen on all-fail.
- **KCQ-08:** reorder voice priority in `assembler.ts` + add style-match instruction in the Hooks/Ideas slice or flash-prompts.
- **26 templates (D-16):** add a concrete exemplar block under the archetype table in `.planning/corpus/hooks.md`; recompile `KC_HOOKS_SLICE`; bump `kc-version.ts`; keep flash+kc tests byte-stable. Private-reasoning use only (D-17).
- **HONESTY-01:** strip `§N` → `§cite:N` pill rendering in `ExpertChatThread.tsx` (delete, no replacement).
</code_context>

<specifics>
## Specific Ideas

- **The "all Mixed" flatness is a GATE answer, not a failure** (owner reframe). Don't chase fine-grained ranking; chase a gate that can say "no" (the slop-vs-strong recalibration is what proves it).
- **Best-of-N exemplar blueprint (for the deferred RAG phase, captured so it isn't re-litigated):** source = P8 Discover scraped outliers; pool **niche-keyed & shared across users** (public videos, not user data) + background apidojo pre-fetch on cold niche; inject **2–3** exemplars as **hook + format + why-it-worked** (pattern not prose); retrieval = **hybrid niche-filter → semantic rank** (reuse `niche_post_windows` + dormant retrieval-stage); empty-pool fallback = **silent corpus-floor** (skip RAG, no pill, never block).
- **Owner's standing instinct (drove every call):** cheap + certain + controllable beats expensive + unproven. Validate before paying for big spends.
</specifics>

<deferred>
## Deferred Ideas

- **KCQ-03 live-exemplar RAG** → future "grounding" phase. Deprioritized: unproven lift, priciest lever, parrot/slop risk. **Validate-first** if revived (cheap corpus-only vs corpus+exemplars spike). Full blueprint captured in `<specifics>`.
- **N2 cited-research pass** → future grounding phase (travels with RAG). Needs web-search infra (none wired); best home is Script (one-pass this phase).
- **Owner's 26 hook templates → NOW IN P14** (D-16/17/18), not deferred — the cheapest grounding win (owner-owned, pre-curated). The **larger** scraped/curated library *beyond* the 26 stays deferred → candidate to extend the future grounding phase (same shape: concrete exemplar layer under the `hooks.md` archetype table, compile pipeline, private-reasoning use, **build-our-own / never lift competitor content** — copyright/brand risk). The 26 prove the lane cheaply first. Used **silently** — no citation pills (D-14).
- **KCQ-08 deeper voice (own-transcript RAG)** → the broader "RAG over the creator's OWN scraped history" item (REQUIREMENTS line 222, usage-gated) stays deferred; P14 KCQ-08 uses only the shipped voice sample.
- **KCQ-09 full field-legibility surface** → P12 IA (only minimal inline attribution in P14).
- **Performance-feedback flywheel (lever #8)** → already its own track; P10 reconciliation data feeds it later.

### Reviewed Todos (not folded)
None — no pending-todo matches surfaced for this phase.
</deferred>

---

*Phase: 14-kc-grounding-quality-loop*
*Context gathered: 2026-06-19*
