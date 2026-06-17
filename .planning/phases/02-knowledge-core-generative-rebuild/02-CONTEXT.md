# Phase 2: Knowledge-Core Generative Rebuild - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Rebuild the Knowledge-Core from scratch as **a general content-craft intelligence** that grounds generation across the studio — authored fresh as a **content/curation workstream first, code second**. The deliverable is a shared **general base** (domain-general truth about why content works) + **per-mode slices** (Ideas, Hooks, chat) + a **per-request grounding-assembly mechanism** (GROUND-02) that hands each tool a tight curated context slice, never the whole KC. THE value, the long pole.

Requirements (locked by ROADMAP/REQUIREMENTS): **GROUND-01, GROUND-02**.

This discussion clarified **HOW** to author and assemble the KC. The tools that consume it (Ideas UI, Hooks UI, open chat) belong to Phases 3–5; the engine/thread/tool-runner seams it plugs into were locked in Phase 1. Phase 2 produces the knowledge + the assembler; it does not build tool surfaces.

**Sequencing:** Phase 2 may run in parallel with Phase 1 (content workstream, not gated on engine/thread code). It is on the critical path for Phase 3 (Ideas).
</domain>

<decisions>
## Implementation Decisions

### North Star — KC = General Craft Intelligence (the framing everything else serves)
- **D-00 (north star):** The KC is **a general craft intelligence, NOT a "generation engine" and NOT the inverse of the scoring brain.** The **base** is *domain-general truth* about why content captures attention / what makes an idea resonate / how viewers decide to keep watching — it has **no task-shape**. **Slices** point that one brain at a *purpose* on demand (Ideas, Hooks, chat now; scoring, script, decode, remix *later — same base, no re-author*). "Shape" is a property of the slice/task-lens, never of the knowledge. This is what makes the KC the milestone's compounding asset: every future tool rides the base for free.
- **D-00a (discipline this enforces):** The base must be **genuinely domain-general** — not secretly generation-only, not scoring-biased. **ALL** task-specificity lives in slices. A reviewer test: if a statement only makes sense for one mode, it belongs in that slice, not the base.

### Area 1 — KC structure & schema
- **D-01 (SSOT):** Authored content lives as **prose markdown in `.planning/corpus/`** (a base file + one file per slice) and is **compiled/embedded into byte-stable TS constants** via a **scripted regen** step (mirrors today's `apollo-core.ts` regenerate pattern, but scripted, not hand-copied). Content workstream stays in prose; code reads the compiled constants. Preserves the Qwen cache-stability contract.
- **D-02 (composition):** **Layered / additive** — `BASE` (always) + per-mode `SLICE` + `LIVE` grounding — with a **deliberately THIN base**. Author-time curation beats runtime retrieval for v1: a hand-authored slice *is* the tight bundle. (Composable craft-modules + RAG are the explicit **v2** evolution — see Deferred.)
- **D-03 (cache mapping):** **Two-tier cached prefix.** At build time, assemble **one byte-stable system prompt PER MODE = base + that mode's slice** (compiled constant). **LIVE grounding goes in the USER message only.** Each tool gets its own warm Qwen input-cache; only the cheap live part varies. Reuses the existing byte-stability contract (no `Date.now()`/`Math.random()`/per-request data in the prefix).
- **D-04 (value-forcing template — fixed schema):** Lock a consistent skeleton so slices are uniform, diff-able, and assemble predictably. Exact section names refined during authoring; the **shape** is locked:
  - **BASE** = `Voice & Stance` · `Universal Craft Principles` · `Anti-Generic Guardrails` · `Value Bar / Self-Rejection Standard`
  - **SLICE** = `Mode Job` · `Craft Patterns / Archetypes` · `Failure Modes` · `Gold-Standard Exemplar Patterns` (authored-fresh, *abstracted* — NOT scraped clips, fully compatible with the `training-data.json` ban) · `Actionability Contract` (every output carries: **named mechanism · why-it-fits-this-creator · ready-to-use form** — the actual hook line, never a description of one)
  - **Value-forcing add-ons (the antidote to slop):**
    - **Intra-batch diversity** — N outputs must be genuinely distinct angles/mechanisms, never variants of one (the #1 generation-slop failure).
    - **Flops as negative grounding** — use the profile's wins AND flops; steer *toward* proven patterns and *away* from proven failures (currently half-used signal).
  - **Why:** makes "specific + mechanism-backed + shoot-ready + grounded" a **structural requirement of the KC itself**, not a hope. The KC should *refuse to emit* generic output, not merely describe good output. (Directly answers owner: "most tools' output isn't useful, valuable, actionable, real.")
- **D-05 (GROUND-02 — live-tier assembler):** Each mode declares a **field-map** of which live sources it needs; the assembler pulls **only those, under a hard length cap**, never the whole profile/KC (avoids dilution). **Live sources (v1):** `composer ask` · `target platform` · `creator profile (mode-selected, referenced by SEMANTIC ROLE — niche/audience/goals/wins/flops)` · `per-request overrides (Tier B)` · `chain/thread anchor (the upstream idea when developing into hooks; recent turns in chat)`. **Cold-start / thin profile → degrade to universal craft + platform baseline, flagged honestly, never fabricated.** The assembler's output IS the Phase-1 tool-runner's `knowledgeBundle` field; precise input shape: `{ask, platform, profileFields[by role], overrides, anchor}`.
- **D-06 (versioning):** The KC carries its **own version tag (`KC_GEN_VERSION`-style, name TBD), decoupled from the protected Max `ENGINE_VERSION`.** Bumped on deliberate content change. Gives reproducible pilot comparison + output provenance + keeps generative-content churn off the protected video-scoring boundary.
- **D-07 (platform — first-class param):** Target platform is an **explicit, first-class request parameter** (not inferred). **Craft authored TikTok-first** with short inline "Reels/Shorts differs here" notes only where it materially changes craft (hook pacing, caption use); the live platform param selects the lens. **No full per-platform slice variants in v1.** **Single platform per generation** (multi-platform fan-out = deferred cross-platform repurposing). UX = a **persistent composer chip** next to the tool + model chips (built in P1/P3; default from profile, changeable per message) — NOT a per-thread modal (avoids friction + thread lock-in that fights the chain).

### Area 2 — Authoring source & method
- **D-08 (strictly greenfield):** Author **100% fresh — never open or lift the current scoring KC.** Craft principles are **re-derived** from owner expertise + external sources, not consulted from the existing §2. The scoring shape (§4 rubric/bands, §5 decode, §6 rewrite) is entirely absent. Rationale: the current KC's craft is *scoring-biased* ("not future-relevant" per owner) — inheriting it would re-import the bias the rebuild exists to escape.
- **D-09 (knowledge sources):** **Owner domain expertise = PRIMARY spine** (the KC is the owner's craft externalized — the taste arbiter). **External craft research** (a research agent gathers proven short-form frameworks/hook taxonomies, distilled to implementation-ready notes, **owner-curated, never copy-pasted**). **First-principles (Claude-drafted) = CONNECTIVE TISSUE ONLY** — fills gaps *under* owner+research, **never originates craft** (owner flag: "be careful" — first-principles-as-primary is the generic-slop path). **Chase Hughes behavioral layer EXCLUDED** from v1 (stays parked).
- **D-10 (workstream loop):** **Draft → owner-curate → eval loop.** Research agent + Claude draft craft INTO the template from owner steer + research; owner red-lines to the taste bar; the gate (D-12) closes the loop (generate → judge → revise the KC). Owner is the **taste arbiter, not the typist.**
- **D-11 (authoring strategy):** **Narrow & deep first, then replicate.** Author the **BASE + the pilot slice (Ideas — see D-14)** to full depth, run it through the gate, and only then replicate the **proven shape** to the remaining slices. De-risks the long pole with a real mid-point checkpoint before authoring effort is spent on every mode.

### Area 3 — Generative gate (eval deprioritized)
- **D-12 (gate, not a harness):** Eval is a **means, not the value** — the foundation (authored craft + architecture) is the value. **No eval workstream / no fixed harness in v1.** The pilot's quality gate is a **thin owner-blind comparison**: on a handful of real prompts, blind-rank **new-KC vs current-KC vs raw-LLM (no KC, profile only)**; an optional quick SIM-1 Flash delta as a sanity number. Pass = owner judges it **clearly better**.
- **D-13 (what it must beat):** The new KC must out-generate **BOTH** (1) **raw-LLM with no KC** (proves grounding/craft earns its keep vs plain ChatGPT — the real competitive bar) AND (2) the **current KC** pointed at the task (proves the fresh general-craft brain beats what exists). **Goodhart guard:** SIM-1 Flash is both the in-product ranker and the obvious judge — the **owner blind check is the independent guard** against tuning the KC to game the metric.
- **Scope note:** D-12 deliberately **relaxes ROADMAP Phase-2 success-criterion 3** from "statistical generative eval" to "owner blind comparison + optional Flash sanity-check." Flagged for the planner/verifier — this is an intentional owner call, not an omission.

### Area 4 — v1 slice coverage
- **D-14 (coverage):** Phase 2 authors **BASE + Ideas slice + Hooks slice to full depth**, plus a **THIN chat stance-slice** that mostly rides the base. Chat is base-heavy, sequenced last (P5), and gated on KC quality — a thin stance now proves the base generalizes to conversation; full chat polish lands in P5. Keeps KC authoring as **one foundation workstream**, not scattered across four phases.
- **D-15 (pilot slice = Ideas):** The deep pilot (authored first + put through the D-12 gate) is **Ideas** — the immediate next consumer (Phase 3). Authoring base + Ideas first **unblocks the critical path** and validates the full shape (base + slice + live + value-forcing) end-to-end through the first shipping tool. **Hooks replicates the proven shape** for P4. (Hooks was the close runner-up — hardest craft / sharpest signal — but ships later; with an owner-blind gate, Ideas is plenty judgeable.)

### Claude's Discretion
- Exact section wording/headings within the BASE and SLICE templates (shape locked by D-04; prose is the authoring workstream's call under owner curation).
- The per-mode field-map's exact field lists and length caps (mechanism locked by D-05; tuning is the planner/author's call).
- The compile/regen script's implementation (locked: scripted, byte-stable; D-01).
- The exact name of the version constant (D-06) and how it stamps output provenance.
- Internal type signatures for the assembler and how it satisfies the P1 tool-runner `knowledgeBundle` contract.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope & constraints
- `.planning/ROADMAP.md` §Phase 2 — goal + 3 success criteria (note D-12 relaxes criterion 3).
- `.planning/REQUIREMENTS.md` — GROUND-01, GROUND-02 + cross-cutting constraints (honesty spine, bounded cost, engine-open-but-protected, Qwen-only, fixed renderers, THEME-06). Also the `training-data.json` "Out of Scope" ban.
- `.planning/PROJECT.md` — milestone identity + locked constraints.
- `.planning/NUMEN-TOOLS-VISION.md` §4 (Grounding stack — THE value) + §5 (creator profile tiers) + §6 (de-risk) + §7 (open questions, incl. "KC new structure: what's the schema?"). EXPLORATORY input, not a spec.
- `.planning/phases/01-engine-thread-foundation/01-CONTEXT.md` — Phase 1 decisions this phase plugs into (esp. **THREAD-06 tool-runner** `{promptTemplate, knowledgeBundle, outputSchema, renderer}` — D-05's assembler produces `knowledgeBundle`; **D-09 composer model-field / tool-chip** pattern the platform chip extends; **honesty spine** D-09/D-10/D-11).

### Current KC (the pattern to MIRROR, the brain to NOT retrofit)
- `src/lib/engine/apollo-core.ts` — the current scoring KC (`KNOWLEDGE_CORE` constant) + the **byte-stability contract** + the regenerate-from-`.md` pattern. **Mirror the cache discipline; do NOT lift the craft (D-08 greenfield).**
- `src/lib/engine/corpus/corpus-version.ts` — existing versioning precedent (D-06 stays decoupled from it, not entangled).
- `src/lib/engine/training-data.json` — the 2.6MB stale exemplar dump. **Banned liability — do not lean on it** (REQUIREMENTS Out of Scope).
- `src/lib/engine/persona-weights.ts` — the 10-persona system the SIM-1 Flash judge (D-12 sanity-check) uses; referenced for the gate, not authored here.

### Grounding source (profile)
- The existing `creator_profiles` (9-card) — the v1 grounding source (REQUIREMENTS PROFILE-01 = reuse existing). **Reference profile data by semantic role** (niche/audience/goals/wins/flops), NOT by card shape — the profile is being redesigned + scrape-enriched in v6.1 (see Deferred); the field-map must tolerate that.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`apollo-core.ts` byte-stability pattern** — the *mechanism* to reuse for D-01/D-03 (compiled byte-stable constants, cache-stable prefix). The *content* is explicitly NOT reused (D-08).
- **`corpus/` versioning + (dormant) eval machinery** — precedent exists; D-06 versions independently; D-12 deliberately does NOT rebuild the heavy eval harness.
- **`creator_profiles`** — the live-tier profile source (D-05), consumed by semantic role.

### Established Patterns
- **Cache-stable system prefix vs per-request user message** — the existing Qwen input-cache discipline; D-03 follows it exactly (base+slice cached per mode, live in user message).
- **Engine OPEN but regression-gated** — Phase 2 is additive content + an assembler; it must not alter the protected Max video-scoring path. `KC_GEN_VERSION` (D-06) stays off the `ENGINE_VERSION` boundary.

### Integration Points
- **D-05 assembler → Phase-1 tool-runner `knowledgeBundle`** — the single seam: the assembler is the producer of the field the THREAD-06 runner consumes. Design the input shape `{ask, platform, profileFields[by role], overrides, anchor}` to satisfy that contract.
- **Platform param → P1 composer request contract** — D-07 adds a `platform` field to the composer/tool-runner request; flagged so P1/P3 wire it rather than retrofit.
- **Pilot (Ideas) slice → Phase 3** — base + Ideas slice + the field-map are the Phase-3 dependency; authoring them first is the critical-path unblock.
</code_context>

<specifics>
## Specific Ideas

- **"Most tools' output isn't useful, valuable, actionable, real."** — the owner's quality bar and the reason the template is *value-forcing* (D-04), not descriptive. The KC must structurally refuse slop.
- **"The knowledge grounding is the foundation for everything."** (vision §4) — output quality is THE value; this is a content/curation workstream first.
- **General craft intelligence, not a generation engine** (D-00) — owner flagged assigning the KC a single "shape" as wrong; the base is shape-agnostic truth, slices give task-shape on demand. Owner called this "extremely important."
- **Artificial Societies' per-test platform modal** — owner's reference point for platform selection; resolved to a *persistent composer chip* instead (D-07) to avoid the modal's friction + thread lock-in.
- **Profile is being redesigned** (fewer cards, different fields, + social-handle TT/IG/YT scrape) — drives the by-semantic-role field-map constraint (D-05).
</specifics>

<deferred>
## Deferred Ideas

- **Composable craft-modules library + RAG over creator history** — the v2 grounding evolution (taggable craft modules selected per request; retrieval over the creator's own scraped history / exemplar selection). Vision §7 defers RAG to post-v1. v1 uses author-time-curated slices instead (D-02).
- **Chase Hughes behavioral/persuasion layer** — excluded from the v1 generative KC (D-09). Was PARKED on the scoring path (A/B inconclusive + cost). Revisit as a possible craft input later.
- **Profile redesign** (compact cards + social-handle scrape prefill) — v6.1 (REQUIREMENTS PROFILE-01 defers it). Phase 2 only adds the forward-constraint that the field-map references profile by semantic role.
- **Multi-platform fan-out / cross-platform repurposing** — generating per-platform variants in one request. Deferred (REQUIREMENTS M2-II / vision §7). v1 = single platform per generation (D-07).
- **Live trends / trending-sounds grounding** — a separate deferred feature, not generation grounding. Not in the v1 live tier (D-05).
- **Full chat slice polish** — Phase 2 ships only a thin chat stance-slice; full chat craft lands with P5 (D-14).
- **Future task slices (scoring, script, decode, remix)** — anticipated by the general-base architecture (D-00) but NOT authored in v1; they slot onto the proven base later without re-authoring it.
- **Heavy statistical generative eval harness** — deprioritized (D-12); revisit only if generation-quality regressions become a real risk.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 2-Knowledge-Core Generative Rebuild*
*Context gathered: 2026-06-17*
