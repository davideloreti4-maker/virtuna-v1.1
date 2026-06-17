# Phase 2: Knowledge-Core Generative Rebuild - Research

**Researched:** 2026-06-17
**Domain:** Content-craft knowledge authoring (curation workstream) + byte-stable prompt-compile mechanism + per-request grounding assembler
**Confidence:** HIGH (codebase seams — all read at source); MEDIUM (external craft — owner is the taste arbiter, research is raw material per D-09)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-00 (north star):** KC = a **general craft intelligence**, NOT a generation engine, NOT the inverse of the scoring brain. BASE = domain-general truth (why content captures attention / why an idea resonates / why viewers keep watching), **no task-shape**. SLICEs point that one brain at a purpose on demand. Future tools (scoring, script, decode, remix) ride the same base, no re-author.
- **D-00a (discipline):** BASE must be genuinely domain-general. ALL task-specificity lives in slices. **Reviewer test:** if a statement only makes sense for one mode, it belongs in that slice, not the base.
- **D-01 (SSOT):** Authored content = prose markdown in `.planning/corpus/` (a base file + one file per slice), **compiled/embedded into byte-stable TS constants via a SCRIPTED regen** (mirrors `apollo-core.ts` pattern, but scripted not hand-copied). Code reads compiled constants. Preserves the Qwen cache-stability contract.
- **D-02 (composition):** Layered/additive — `BASE` (always) + per-mode `SLICE` + `LIVE` grounding — with a **deliberately THIN base**. Author-time curation beats runtime retrieval for v1: a hand-authored slice *is* the tight bundle. (Composable craft-modules + RAG = v2, deferred.)
- **D-03 (cache mapping):** **Two-tier cached prefix.** Build time = **one byte-stable system prompt PER MODE = base + that mode's slice** (compiled constant). **LIVE grounding goes in the USER message only.** Each tool gets its own warm Qwen input-cache; only the cheap live part varies. No `Date.now()`/`Math.random()`/per-request data in the prefix.
- **D-04 (value-forcing template — fixed schema):** BASE = `Voice & Stance` · `Universal Craft Principles` · `Anti-Generic Guardrails` · `Value Bar / Self-Rejection Standard`. SLICE = `Mode Job` · `Craft Patterns / Archetypes` · `Failure Modes` · `Gold-Standard Exemplar Patterns` (authored-fresh, *abstracted* — NOT scraped clips) · `Actionability Contract` (every output carries: named mechanism · why-it-fits-this-creator · ready-to-use form — the actual hook line, never a description). **Value-forcing add-ons:** intra-batch diversity (N outputs = genuinely distinct angles/mechanisms) + flops-as-negative-grounding (steer toward wins AND away from flops). The KC must structurally *refuse to emit* generic output.
- **D-05 (GROUND-02 — live-tier assembler):** Each mode declares a **field-map** of which live sources it needs; assembler pulls **only those, under a hard length cap**, never the whole profile/KC. **Live sources (v1):** `composer ask` · `target platform` · `creator profile (mode-selected, referenced by SEMANTIC ROLE — niche/audience/goals/wins/flops)` · `per-request overrides (Tier B)` · `chain/thread anchor`. **Cold-start/thin profile → degrade to universal craft + platform baseline, flagged honestly, never fabricated.** Output IS the Phase-1 tool-runner's `knowledgeBundle` field. Input shape: `{ask, platform, profileFields[by role], overrides, anchor}`.
- **D-06 (versioning):** KC carries its **own version tag (`KC_GEN_VERSION`-style, name TBD), decoupled from `ENGINE_VERSION`.** Bumped on deliberate content change.
- **D-07 (platform — first-class param):** Target platform is an explicit, first-class request param. Craft authored **TikTok-first** with short inline "Reels/Shorts differs here" notes only where it materially changes craft. No full per-platform slice variants in v1. Single platform per generation. UX = persistent composer chip (P1/P3), default from profile.
- **D-08 (strictly greenfield):** Author 100% fresh — **never open or lift the current scoring KC**. Craft re-derived from owner expertise + external sources. Scoring shape (§4 rubric/bands, §5 decode, §6 rewrite) entirely absent.
- **D-09 (knowledge sources):** Owner domain expertise = PRIMARY spine (taste arbiter). External craft research = distilled-to-notes, owner-curated, **never copy-pasted**. First-principles (Claude-drafted) = **CONNECTIVE TISSUE ONLY**, never originates craft. Chase Hughes layer EXCLUDED from v1.
- **D-10 (workstream loop):** Draft → owner-curate → eval loop. Owner = taste arbiter, not typist.
- **D-11 (authoring strategy):** Narrow & deep first, then replicate. Author BASE + pilot slice (Ideas) to full depth, run the gate, THEN replicate the proven shape to remaining slices.
- **D-12 (gate, not a harness):** **No eval workstream / no fixed harness in v1.** Pilot quality gate = **thin owner-blind comparison** on a handful of real prompts: blind-rank new-KC vs current-KC vs raw-LLM (no KC, profile only). Optional quick SIM-1 Flash delta as a sanity number. Pass = owner judges it clearly better.
- **D-13 (what it must beat):** BOTH (1) raw-LLM no KC AND (2) current KC pointed at the task. **Goodhart guard:** owner blind check is the independent guard (SIM-1 Flash is both in-product ranker AND obvious judge — don't tune to the metric).
- **D-14 (coverage):** Phase 2 authors **BASE + Ideas slice + Hooks slice to full depth**, plus a **THIN chat stance-slice** that mostly rides the base.
- **D-15 (pilot slice = Ideas):** The deep pilot (authored first + through the D-12 gate) is **Ideas** — unblocks the Phase-3 critical path. Hooks replicates the proven shape for P4.

### Claude's Discretion
- Exact section wording/headings within BASE/SLICE templates (shape locked by D-04; prose is the authoring workstream's call under owner curation).
- The per-mode field-map's exact field lists and length caps (mechanism locked by D-05; tuning is planner/author's call).
- The compile/regen script's implementation (locked: scripted, byte-stable; D-01).
- The exact name of the version constant (D-06) + how it stamps output provenance.
- Internal type signatures for the assembler + how it satisfies the P1 tool-runner `knowledgeBundle` contract.

### Deferred Ideas (OUT OF SCOPE)
- Composable craft-modules library + RAG over creator history (v2 grounding evolution).
- Chase Hughes behavioral/persuasion layer (parked, revisit later).
- Profile redesign (compact cards + social-handle scrape prefill) — v6.1. Phase 2 only adds the forward-constraint that the field-map references profile by semantic role.
- Multi-platform fan-out / cross-platform repurposing — v1 = single platform per generation.
- Live trends / trending-sounds grounding — not in v1 live tier.
- Full chat slice polish — P5. Phase 2 ships only a thin chat stance-slice.
- Future task slices (scoring, script, decode, remix) — anticipated by the base, NOT authored in v1.
- Heavy statistical generative eval harness — deprioritized (D-12).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GROUND-01 | KC restructured for generation — shared generative BASE + per-mode SLICEs (Ideas, Hooks, chat), authored fresh; NOT retrofitted from scoring core or stale `training-data.json`. Content/curation workstream first, code second. | Priority 1 (external craft material to curate) + Priority 2 (compile/regen pattern from `apollo-core.ts` + scripted regen design). The fixed D-04 template gives the authoring workstream its skeleton; D-08 greenfield is structurally enforced by *not importing* `KNOWLEDGE_CORE`. |
| GROUND-02 | Per-mode grounding assembly — each tool assembles a tight curated context slice (niche + relevant craft frame + the specific input), not the whole profile/KC. | Priority 3. The assembler produces the Phase-1 `KnowledgeBundle` (`src/lib/tools/tool-runner.ts:24`). `formatCreatorContext` (`src/lib/engine/creator.ts:262`) is the precedent for semantic-role field mapping + cold-start degradation + the injection-fence pattern. |
</phase_requirements>

## Summary

This phase is **two-thirds a content/curation workstream and one-third code**. The code surface is small and well-defined by Phase-1 seams; the long pole is *authoring* a domain-general craft BASE + Ideas/Hooks/thin-chat slices to the owner's taste bar. Three code artifacts exist: (1) prose `.md` files in `.planning/corpus/` (the SSOT, never built before in this repo — `.planning/corpus/` does not yet exist), (2) a **scripted regen** that compiles those `.md` files into byte-stable TS constants mirroring `apollo-core.ts`'s discipline, and (3) a **live-tier assembler** that produces the Phase-1 `KnowledgeBundle`.

The codebase already supplies near-complete templates for every code piece: `apollo-core.ts` is the byte-stability contract to mirror (but its *craft is forbidden* by D-08); `flash-prompts.ts` (`buildSystemPrompt` + `buildFlashUserContent`) is the exact cached-prefix-vs-volatile-user-message split D-03 mandates; `formatCreatorContext` (`creator.ts:262`) is a working semantic-role-mapped, null-guarded, cold-start-degrading, injection-fenced profile assembler — the assembler is essentially a per-mode-field-mapped generalization of it. The Phase-1 `ToolRunner.knowledgeBundle` field is deliberately `KnowledgeBundle | null` with an opaque `[key: string]: unknown` shape (`tool-runner.ts:24-27`), explicitly waiting for Phase 2 to define it.

**Primary recommendation:** Sequence as a content-first pilot — (1) stand up `.planning/corpus/` + the regen script + the assembler skeleton as a thin code spine early so authoring has a compile target; (2) author BASE + Ideas slice to full depth (D-15); (3) run the D-12 thin blind gate; (4) only then replicate the proven shape to Hooks + the thin chat stance-slice. Do NOT build an eval harness (D-12). Keep `KC_GEN_VERSION` a standalone constant file, never touching `version.ts`/`ENGINE_VERSION`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Authored craft knowledge (BASE + slices) | Content / authoring workstream (`.planning/corpus/*.md`) | — | D-01 SSOT is prose; content is curated, not coded. The "tier" here is editorial, not runtime. |
| Compiled byte-stable constants | Build-time / scripted regen (`scripts/`) → `src/lib/kc/*` | — | D-01: `.md` → TS constant via a script run at author-time, committed. Mirrors `apollo-core.ts` but automated. |
| Per-mode cached system prompt (base+slice) | API / backend (compiled constant, warm Qwen input-cache) | — | D-03: one byte-stable prefix per mode. Lives in the system message of each tool's Qwen call. |
| Live grounding assembly | API / backend (per-request) | DB (reads `creator_profiles`) | D-05: assembler runs per request, reads profile by semantic role, emits the volatile user-message bundle. |
| KC version provenance | Backend constant | — | D-06: standalone constant, decoupled from `ENGINE_VERSION`. |
| The blind gate | Manual / owner (not automated) | optional SIM-1 Flash call | D-12: a means not the value; minimal scaffolding, owner judges. |

## Standard Stack

This phase introduces **no new external packages**. It uses what Phase 1 + the engine already depend on.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | already in repo | Validate assembler output / any structured slice metadata | Already the validation SSOT for blocks + profile (`blocks.ts`, `creator-profile.ts`) |
| `tsx` / `ts-node` (script runner) | already used by `scripts/build-corpus.ts` | Run the scripted regen `.md` → `.ts` | The existing scripts (`scripts/build-corpus.ts:1-35`) use the `dotenv` + `tsconfig-paths/register` pattern; reuse it |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs` `readFileSync` | stdlib | Read `.planning/corpus/*.md` at regen time | The regen script reads prose, escapes backticks + `${`, writes the TS constant |
| Qwen client (`src/lib/engine/qwen/client.ts`) | repo | The generation/judge calls consume the per-mode cached prefix | Reuse `getQwenClient`, `QWEN_SEED`, `QWEN_FAST_MODEL` exactly as `run-flash-text-mode.ts` does |

**Installation:** none — no new dependencies. (Package Legitimacy Audit is therefore N/A; see below.)

## Package Legitimacy Audit

**N/A — this phase installs no external packages.** All work uses repo-existing `zod`, the Node stdlib, the existing Qwen client, and the existing script-runner toolchain. No `npm install` step appears in any task. If the planner later discovers a need for a new package (none anticipated), run the Package Legitimacy Gate before adding it.

---

## Priority 1 — External Craft Research (raw material for owner curation, D-09)

> **For the planner:** This section is **raw material**, not authored craft. Per D-09 the owner is the PRIMARY spine and taste arbiter; this research is the "research agent gathers proven frameworks, distilled to notes, owner-curated, never copy-pasted" input. **Do NOT plan a task that pastes this into the KC.** Plan a task that *hands this to the owner as steer* and a draft-into-template task that the owner red-lines (D-10). Every note below is tagged with its **D-00a tier** (BASE = shape-agnostic vs SLICE = task-specific). The tier tags are the single most planner-load-bearing output here: they pre-sort the material so the authoring tasks split cleanly into "base file" vs "Ideas slice file" vs "Hooks slice file."

### 1A — Universal "why viewers keep watching" mechanisms → **BASE tier**

These are domain-general (they explain attention regardless of mode) and pass the D-00a reviewer test — they make sense for scoring, scripting, hooks, and ideas alike. Candidate `Universal Craft Principles` for the BASE file:

- **Curiosity gap / open loop** — an unresolved question or expectation-violation the brain is compelled to close. Closure-seeking is the core retention drive. `[CITED: opus.pro/blog/youtube-shorts-hook-formulas, storyboxhq.ca]`
- **Curiosity stacking** — multiple micro-gaps opened/closed in sequence so a new question emerges as the prior resolves; sustains retention through full duration. `[CITED: virvid.ai/blog/first-3-seconds-hook-faceless-shorts-2026]`
- **Pattern interrupt** — a break from the expected feed pattern that re-captures filtered attention. `[CITED: opus.pro]`
- **Prediction / anticipation drive** — viewers stay while a prediction is pending; the spike is on the *resolution* of an open loop. `[CITED: ncbi.nlm.nih.gov/pmc/articles/PMC9792976 — neurophysiologic immersion increases viewing time]`
- **Looping architecture** — endings that flow back to the open, inviting re-watch; re-watches are a strong algorithmic quality signal. `[CITED: opus.pro]`
- **Transformation promise / stakes** — the implied "you will be different after watching"; gives the viewer a reason to invest attention. `[CITED: ridgefilms.com.au, storyboxhq.ca]`

> **Owner-spine note (D-09):** the owner's existing craft mental model (from the scoring KC era, but **re-derived fresh per D-08** — not copied) is far richer than this public-blog material. Treat the above as a *floor / checklist of coverage*, not the ceiling. The owner supplies the mechanism depth.

### 1B — Idea/concept resonance frameworks → **Ideas SLICE tier**

These are *idea-stage* specific (they evaluate a concept before execution), so by D-00a they belong in the **Ideas slice**, not the base:

- **Topic specificity beats category** — a narrow, specific subject (the "3–5-word framing") resonates; a broad category is ignored. *(Specific > general is the single most repeated resonance rule.)* `[CITED: walkersands.com, aicontentfy.com]`
- **The take, not just the topic** — a genuinely contrarian/non-obvious angle is what cuts through a converging feed. **But:** "empty contrarianism without a real take underneath gets flagged as ragebait and underperforms." `[CITED: wordstream.com, prealgo.com/blog/hook-archetypes-2026]`
- **Depth-match** — the "I went deep and found something nobody's talking about" idea frame has the highest median performance, but **only when the evidence matches the implied depth** (shallow research craters retention at 5–10s). This is a resonance *and* a failure-mode note. `[CITED: prealgo.com]`
- **Audience-desire targeting** — an idea resonates when it maps to a known audience desire/pain, not a generic interest. `[CITED: aicontentfy.com]`

### 1C — Hook taxonomies / archetypes → **Hooks SLICE tier**

Idea-execution-stage, hook-specific → **Hooks slice** (`Craft Patterns / Archetypes`). Proven short-form hook archetypes (OpusClip analyzed 34,635 clips; top type ≈2× the lowest):

| Archetype | Mechanism | Performance note |
|-----------|-----------|------------------|
| Bold Statement | Declarative claim challenging conventional wisdom → cognitive dissonance | Strong; top tier |
| Curiosity Gap | Hint without revealing → intrigue in first 3s | Strong |
| Contrarian / "wait what" | Contradicts a common belief → "wait, what?" reflex in ≤2s | Strong (guard against empty ragebait) |
| Research / Deep Dive | "I went deep on X and found something nobody's talking about" | **Highest median**, depth-match required |
| Personal Narrative | "So last week this happened…" | Safest baseline performer |
| Question | Direct curiosity question | **Most overused, lowest median** — flag as near-failure-mode |

`[CITED: opus.pro/blog/tiktok-hook-formulas, opus.pro/blog/tiktok-hooks-that-go-viral-2026, prealgo.com]`

**Timing anchors (Hooks slice + cross-cutting):** algorithm's first decision ≈1.5s; a strong hook lands in the first 3s (~10–14 words); a failed hook enters a cold start it rarely escapes. `[CITED: selfstorming.com, prealgo.com]`

### 1D — Anti-generic / anti-slop signals → **BASE tier** (`Anti-Generic Guardrails` + `Value Bar`)

These directly answer the owner bar ("most tools' output isn't useful, valuable, actionable, real") and are the **antidote-to-slop** D-04 demands. They're shape-agnostic (apply to every mode) → BASE:

- **AI takes the "linguistic path of least resistance"** → generic output by default. The KC must structurally push *off* that path. `[CITED: conductor.com/academy/ai-generated-content]`
- **Slop signals to ban:** clichés, robotic rhythm, bland/unnatural/irrelevant statements, surface-level repetition, no clear voice. `[CITED: conductor.com, strattoncraig.com]`
- **What separates real output:** *specific, recent, previously-unpublished examples / case studies / data* — concrete specifics tied to a real perspective. The differentiator is expertise + specificity, not fluency. `[CITED: conductor.com, strattoncraig.com]`
- **Value Bar / Self-Rejection translation (for the BASE file):** every emitted item must carry (a) a **named mechanism** (why it works), (b) a **specific, concrete instantiation** (not a vague superlative), (c) **fit to this creator** (not off-the-shelf). An item that is generic, mechanism-less, or could've been said about any niche **must be self-rejected** before emission. This is the structural enforcement of D-04's "refuse to emit generic output."

> **For the planner — the `Actionability Contract` (D-04 SLICE field):** every slice's output contract requires three things per item — **named mechanism · why-it-fits-this-creator · ready-to-use form** (the actual hook line, not a description of one). Note the parallel to the existing scoring KC's "name the mechanism, never a platitude; quote the actual line" discipline (`apollo-core.ts:57-64`) — the *discipline* is reusable as a pattern even though the *craft content* is forbidden by D-08. This is the cleanest example of "mirror the mechanism, not the content."

### Tier-sort summary (planner: this is your authoring-task split)

| BASE file | Ideas slice | Hooks slice | Thin chat slice |
|-----------|-------------|-------------|-----------------|
| 1A universal mechanisms · 1D anti-slop guardrails + value bar | 1B idea-resonance frameworks · depth-match failure mode | 1C hook archetype table · timing anchors | mostly rides BASE (D-14); thin stance only |

---

## Priority 2 — KC Architecture & Compile Pattern (D-01, D-03, D-06)

### 2A — The byte-stability contract to MIRROR (`apollo-core.ts`)

`src/lib/engine/apollo-core.ts:21-33` states the contract verbatim:

> "BYTE-STABILITY CONTRACT: every export here is a build-time constant string with NO interpolation of `Date.now()`/`Math.random()`/per-request data. It is safe to embed via template literal in a cache-stable prefix — the result stays byte-identical across requests, preserving Qwen automatic input-cache hits."

The constant is built by concatenation (`apollo-core.ts:254`):
```typescript
export const APOLLO_SYSTEM_PROMPT = `${KNOWLEDGE_CORE}\n\n---\n\n${APOLLO_INSTRUCTION}`;
```
The regen instruction (today **manual**, `apollo-core.ts:4-6`): "copy KNOWLEDGE-CORE.md content into KNOWLEDGE_CORE below, escaping backticks (\\`) and dollar-braces (\\${)."

**D-01 upgrade:** make that copy step a **script**. The script reads `.planning/corpus/*.md`, escapes `` ` `` → `` \` `` and `${` → `\${`, and writes the TS constant file. This removes the "update in lockstep" hazard called out at `apollo-core.ts:26`.

> **For the planner — D-08 enforcement is structural:** the new compiled module must **not import or reference `KNOWLEDGE_CORE`/`APOLLO_SYSTEM_PROMPT`** from `apollo-core.ts`. A grep-clean check (`grep -L apollo-core src/lib/kc/*`) is a cheap verification step. Mirror the *file shape and JSDoc contract*; author 100% fresh content.

### 2B — The exact two-tier cached-prefix split (D-03) — `flash-prompts.ts` is the live template

`flash-prompts.ts` already implements **exactly** the D-03 split, and is the closest analog to what each KC mode needs (it's not video-shaped, it's text-mode):

- **`STABLE_FLASH_SYSTEM_PROMPT`** (`flash-prompts.ts:61-70`, `buildSystemPrompt()`) — byte-stable cache prefix; "ALL volatile data … goes in the USER message." It interpolates only build-time constants (the archetype definitions), never per-request data.
- **`buildFlashUserContent(text, framing)`** — assembles the volatile user message; "framing swaps ONLY the persona QUESTION + band VERBIAGE."

**For the KC, the D-03 mapping is:**

```
PER-MODE SYSTEM PROMPT (compiled constant, byte-stable, warm cache):
    KC_BASE  +  separator  +  KC_SLICE_<mode>
    e.g.  KC_IDEAS_SYSTEM_PROMPT = `${KC_BASE}\n\n---\n\n${KC_IDEAS_SLICE}`
    (one constant per mode: ideas, hooks, chat — mirrors APOLLO_SYSTEM_PROMPT:254)

USER MESSAGE (per request, the only thing that varies):
    the assembled live bundle (Priority 3) — ask, platform, profile-by-role, overrides, anchor
```

This gives each tool its own warm Qwen input-cache (D-03), exactly as Flash gets one today. The call envelope to reuse is `run-flash-text-mode.ts:80-90`: `getQwenClient` + `messages:[{role:"system", content: <byte-stable prefix>}, {role:"user", content: <volatile bundle>}]` + `temperature:0` + `seed:QWEN_SEED` + `response_format:json_object` for structured slices.

> **For the planner:** the compiled-constants module should export, per mode, both the raw `KC_<MODE>_SLICE` and the assembled `KC_<MODE>_SYSTEM_PROMPT`. Generating the assembled prompt at **compile time** (not runtime concatenation) keeps the byte-stable string fixed in source — the safest form of the contract.

### 2C — `KC_GEN_VERSION` decoupling (D-06)

- `ENGINE_VERSION` lives in `src/lib/engine/version.ts` and is the protected Max-scoring boundary (`version.ts:` — currently `"3.19.0"`, ~30 bump-log entries). **Do not touch it.**
- `corpus-version.ts` is a *different* precedent — a DB-row-count snapshot keyed on a `corpus_version` string (`corpus-version.ts:8-13`). It is **not** the model for `KC_GEN_VERSION`; it's a training-corpus DB concept. D-06 wants a simpler thing.
- **Recommended shape (matches `version.ts`'s simplicity, in a NEW file):**
  ```typescript
  // src/lib/kc/kc-version.ts
  /** Generative KC content version. DECOUPLED from ENGINE_VERSION (protected Max boundary).
   *  Bump on any deliberate change to BASE or any SLICE .md. Stamps output provenance. */
  export const KC_GEN_VERSION = "gen.1.0.0";
  ```
  Stamp it on generated outputs the same way ENGINE_VERSION stamps analysis rows — a provenance field on the persisted message/block (so a blind-gate comparison can attribute which KC version produced which output, D-12).

> **For the planner — gap flag:** D-06 leaves *where* the stamp lands under-specified. The Phase-1 block shape (`blocks.ts`) has no KC-version field. Recommend stamping at the **message level** (the `messages` row, not each block) to avoid touching the frozen block schemas, OR as an opaque field carried alongside the persisted output. Confirm with the planner whether a new column/JSON field is in Phase-2 scope or deferred to Phase-3 (where outputs are first persisted in product). **This is the one architectural under-spec in Priority 2.**

---

## Priority 3 — The Live-Tier Grounding Assembler (D-05, GROUND-02 — the single code seam)

### 3A — The contract it must produce (Phase-1, read at source)

`src/lib/tools/tool-runner.ts:24-27`:
```typescript
export interface KnowledgeBundle {
  /** Opaque — Phase 2 defines the concrete fields. */
  [key: string]: unknown;
}
```
And `tool-runner.ts:50-54`: `knowledgeBundle: KnowledgeBundle | null` — "P1: null — Phase 2 fills this with KC slices per tool." `flash-runner.ts:70-71` currently sets `knowledgeBundle: null` with the comment "Phase 2 (GROUND-*) fills this."

> **For the planner:** the assembler's job is to **produce the value that goes into a runner's `knowledgeBundle`** AND/OR the volatile user message. Note an ambiguity in the Phase-1 contract: `knowledgeBundle` is a *static field on the runner object* (`flashRunner` is a module-level const), but D-05's bundle is **per-request** (depends on `ask`, profile, anchor). **Resolution:** the assembler is a per-request *function* whose output feeds the runner's `promptTemplate(input)` as the user message — NOT a value mutated onto the static runner const. Treat `knowledgeBundle` on the runner as the **slice-binding** (which compiled KC slice this tool uses, static) and the assembler output as the **live grounding** (the user message, per-request). This separation matches D-02/D-03 exactly (slice = static/cached; live = per-request/user-message). **Recommend the planner make this two-part split explicit in the assembler's type signature.**

### 3B — `formatCreatorContext` is a working precedent for the WHOLE assembler (`creator.ts:262`)

`src/lib/engine/creator.ts:262-360` (`formatCreatorContext`) already does, for the scoring path, almost everything D-05 asks for the generative path:

1. **Semantic-role mapping, null-guarded** (`creator.ts:299-353`): each profile field is pushed only `if` present — "null fields are silently omitted." This is the field-map's per-field discipline.
2. **Cold-start / thin-profile degradation** (`creator.ts:282-298`): `if (ctx.found) … else "Creator profile: not found (using platform baseline)"` + always-included platform averages. **This IS D-05's "degrade to universal craft + platform baseline, flagged honestly."** The "(using platform baseline)" string is the honest flag.
3. **Injection-fence for user-supplied text** (`creator.ts:330-337`, `354-360`): free-text fields (`reference_creators`, `pain_points`) are wrapped in `<<<USER_CONTENT>>>`/`<<<END_USER_CONTENT>>>` and sentinel-stripped (`stripUserContentSentinels`, `creator.ts:252-254`). **The assembler MUST reuse this fence** for `ask` (composer free-text), `overrides`, and `anchor` — they are all user-controlled and flow into a prompt.

> **For the planner:** the assembler is essentially `formatCreatorContext` + (a) a per-mode field-map filter + (b) a hard length cap + (c) the new live sources (`ask`, `platform`, `anchor`, `overrides`). Plan it as a *new* module (`src/lib/kc/assembler.ts`) that **reuses the fence + sanitize patterns**, not a fork of `creator.ts` (which is engine-scoped and feeds the protected path).

### 3C — Semantic-role field map (D-05) — concrete source columns

The locked semantic roles map to these existing `creator_profiles` columns (`database.types.ts:713-750`, validated shapes in `creator-profile.ts`):

| Semantic role (D-05) | Source column(s) | Shape | Notes |
|----------------------|------------------|-------|-------|
| niche | `niche_primary` + `niche_sub` | text | `creator.ts:303-305` already formats `primary > sub` |
| audience | `target_audience` (JSON) | `{age_range, gender_skew, geo, language}` | `creator-profile.ts:50-57`; `creator.ts:307-315` formats it |
| goals | `primary_goal` (+ `creator_stage`) | enum | `growth\|engagement\|brand_deals\|conversion` |
| wins | `past_wins` (JSON) | `Array<{url}>` max 2 | **currently only count is used** (`creator.ts:339-343`) — see 4B |
| flops | `past_flops` (JSON) | `Array<{url}>` max 2 | **currently only count is used** (`creator.ts:344-348`) — D-04 wants these as negative grounding |
| platform | `target_platforms` (array) OR the per-request `platform` param (D-07) | enum `tiktok\|instagram\|youtube` | D-07: live param overrides profile default |

> **For the planner — by-role NOT by-card (D-05 forward constraint):** the profile is being redesigned in v6.1 (CONTEXT Deferred). The field-map must reference by **role**, so when columns change, only the role→column lookup table changes, not every consumer. Recommend a single `PROFILE_ROLE_MAP: Record<Role, (row) => string | null>` so the redesign touches one table. The 9-card column names above are the *current* binding, expected to change.

### 3D — Per-mode field-map + hard length cap (D-05)

Each mode declares which roles it pulls (Claude's discretion on exact lists per D-05; recommended starting point):

| Mode | Roles pulled | Anchor | Rationale |
|------|-------------|--------|-----------|
| Ideas | niche, audience, goals, wins, flops, platform | seeded topic (optional) | Ideas need full creator picture to find resonant angles |
| Hooks | niche, audience, platform, wins, flops | **the upstream idea** (chain anchor) | Hooks develop a specific idea; the idea is the primary input |
| Chat | niche, audience, platform | recent turns | Thin; base-heavy (D-14) |

**Hard length cap (D-05 "never the whole profile/KC"):** enforce a character budget on the assembled bundle (the assembler truncates/drops lowest-priority roles past the cap). The cap value is the author's tuning call; recommend measuring against the warm-prefix size so the live tier stays the cheap-varying part (D-03). Precedent: `pain_points` is already capped at 500 chars at the boundary (`creator-profile.ts`).

### 3E — Platform as first-class param (D-07)

- The `platform` arrives as a **per-request param** (composer chip, P3), not inferred. Default from `target_platforms[0]` but overridable per message.
- Craft is **TikTok-first** with inline "Reels/Shorts differs here" notes (D-07) — so the *slice content* carries platform variance; the assembler just passes the selected `platform` token into the user message as a lens selector. **No per-platform slice variants** (D-07).

> **For the planner — forward-wire flag (from CONTEXT Integration Points):** D-07 adds a `platform` field to the composer/tool-runner request. Phase 2 defines the assembler *input* `{ask, platform, …}`; P1/P3 wire the actual chip. Phase 2 should define the input type so P3 wires rather than retrofits. The Phase-1 `ToolInput` is `{[key:string]:unknown}` (`tool-runner.ts:31-33`) — extend it with a typed `AssemblerInput`.

---

## Priority 4 — Value-Forcing Template + the Thin Gate (D-04, D-12)

### 4A — Intra-batch diversity (D-04, "#1 generation-slop failure")

Concrete techniques to bake into the slices + generation contract:

- **Explicit distinctness instruction in the slice's `Actionability Contract`:** require each of N outputs to fire a **different named mechanism** (e.g., one bold-statement, one curiosity-gap, one personal-narrative — never N variants of one archetype). This makes diversity a *structural output requirement*, not a hope (D-04).
- **Mechanism-tagging per item:** require each output to carry its archetype/mechanism tag (already the Hooks plan — HOOKS-01 "each tagged with the archetype it grabs"). Tagging *forces* the model to diversify because duplicate tags are visibly wrong.
- **Generation-time guard (cheap):** the assembler/prompt can instruct "no two outputs may share the same mechanism tag." A post-generation de-dup check on tags is a cheap structural verifier (no eval harness needed).

### 4B — Flops as negative grounding (D-04, "currently half-used signal")

- **Current state:** `formatCreatorContext` (`creator.ts:339-348`) emits only the **count** of `past_wins`/`past_flops` ("2 video(s)"), not their content. This is the "half-used signal" the owner flagged.
- **D-04 ask:** steer *toward* proven wins AND *away* from proven flops. The assembler should surface wins/flops as **directional grounding** in the user message — "patterns that worked for this creator" vs "patterns that flopped, avoid these."
- **Caveat (planner):** `past_wins`/`past_flops` are currently just URLs (`creator-profile.ts:71-77`), max 2 each. Without scraped content behind them (deferred to v6.1 PROFILE-01 / RAG), the assembler can only say "creator reports these as wins/flops" — it cannot extract *why*. **Honesty-spine note:** do not fabricate the mechanism behind a flop URL. v1 can pass the win/flop signal as "creator-reported, treat as directional" until scrape enrichment lands. Flag this as a known thin-signal limitation (consistent with REQUIREMENTS "voice/history is a bonus when present, not a foundation").

### 4C — The thin blind gate (D-12 — NOT an eval harness)

D-12 explicitly relaxes ROADMAP success-criterion 3 from "statistical generative eval" to "owner blind comparison + optional Flash sanity-check." **Do not build the heavy harness** (CONTEXT Deferred; `corpus/` dormant eval machinery exists but D-12 says don't rebuild it).

**Minimal scaffolding needed (the whole gate):**
1. A **handful of real prompts** (5–10 representative Ideas asks) — owner-supplied or drawn from realistic creator profiles.
2. **Three generations per prompt:** (a) new-KC (base+Ideas-slice+live), (b) current-KC pointed at the task, (c) raw-LLM (no KC, profile only) — D-13.
3. **Blind presentation:** outputs shuffled/unlabeled so the owner ranks without knowing which is which (the Goodhart guard, D-13).
4. **Optional SIM-1 Flash delta:** run each generation through `runFlashRunner(content_text, "idea")` (`flash-runner.ts:97`) and record the band/fraction as a sanity number. **Not the gate** — owner judgment is the gate (D-12/D-13).

> **For the planner:** scaffold this as a **throwaway script** (`scripts/kc-gate.ts`, following the `build-corpus.ts:1-35` dotenv+tsconfig-paths pattern), not a test suite, not a persisted harness. Its only job: produce the 3×N blind outputs for the owner to rank, optionally with a Flash number appended. Per D-12 this is "a means, not the value" — keep it minimal. The gate runs once at the Ideas-pilot midpoint (D-11), gating replication to Hooks.

> **For the verifier (flag):** D-12 is an **intentional owner relaxation** of ROADMAP criterion 3, not an omission (CONTEXT Scope note). Verification of success-criterion 3 should check for "owner judged new-KC clearly better in a blind rank," NOT for a statistical eval artifact.

---

## Architecture Patterns

### System Architecture Diagram

```
 AUTHORING (content workstream, D-01/D-09/D-10)
 ┌─────────────────────────────────────────────────────────┐
 │ owner steer + external craft notes (Priority 1)          │
 │            │  draft-into-template (D-04 fixed shape)      │
 │            ▼                                              │
 │  .planning/corpus/                                        │
 │    base.md  ideas.md  hooks.md  chat.md   ← prose SSOT    │
 └───────────────────────┬─────────────────────────────────┘
                         │  scripted regen (D-01) — escape ` and ${
                         ▼
 BUILD TIME ┌──────────────────────────────────────────────┐
            │ src/lib/kc/compiled.ts (byte-stable consts)   │
            │   KC_BASE, KC_IDEAS_SLICE, KC_HOOKS_SLICE,…   │
            │   KC_IDEAS_SYSTEM_PROMPT = BASE + IDEAS_SLICE │ ← D-03 per-mode prefix
            │ src/lib/kc/kc-version.ts  KC_GEN_VERSION       │ ← D-06 decoupled
            └───────────────────────┬──────────────────────┘
                                    │
 PER REQUEST (D-05 assembler — GROUND-02, the single code seam)
   composer: {ask, platform, overrides, anchor} ──┐
   creator_profiles (by SEMANTIC ROLE) ───────────┤
                                                   ▼
            ┌──────────────────────────────────────────────┐
            │ src/lib/kc/assembler.ts                        │
            │  • per-mode field-map (pull only needed roles) │
            │  • hard length cap                             │
            │  • cold-start → platform baseline (honest flag)│
            │  • <<<USER_CONTENT>>> fence on user text       │
            └───────────────────────┬──────────────────────┘
                                    │ → the VOLATILE user message
                                    ▼
   Qwen call:  system = KC_<MODE>_SYSTEM_PROMPT (warm cache)
               user   = assembled live bundle
               → feeds Phase-1 ToolRunner (P3/P4 consume)
```
*(File-to-responsibility mapping is in the Component Responsibilities below; the diagram shows data flow.)*

### Component Responsibilities
| File (new, recommended) | Responsibility |
|--------------------------|----------------|
| `.planning/corpus/base.md` + `ideas.md` + `hooks.md` + `chat.md` | Prose SSOT (D-01). Authored fresh (D-08). |
| `scripts/regen-kc.ts` | `.md` → byte-stable TS constant (D-01 scripted regen). |
| `src/lib/kc/compiled.ts` | Generated constants: `KC_BASE`, per-mode slices, per-mode assembled system prompts (D-03). Do NOT hand-edit. |
| `src/lib/kc/kc-version.ts` | `KC_GEN_VERSION` (D-06), decoupled from `ENGINE_VERSION`. |
| `src/lib/kc/assembler.ts` | Per-request live-tier assembler (D-05 / GROUND-02). Reuses `creator.ts` fence + cold-start patterns. |
| `src/lib/kc/profile-role-map.ts` | `Role → column` lookup (D-05 by-role constraint; isolates v6.1 redesign). |
| `scripts/kc-gate.ts` | Throwaway blind-gate generator (D-12). Not a test. |

### Pattern: cache-stable prefix + volatile user message
**What:** byte-stable per-mode system prompt (base+slice) cached by Qwen; only the assembled live bundle varies per request.
**When to use:** every KC-grounded generation call.
**Example:**
```typescript
// Source: src/lib/engine/flash/run-flash-text-mode.ts:80-90 (the exact pattern to mirror)
messages: [
  { role: "system", content: KC_IDEAS_SYSTEM_PROMPT },   // byte-stable, warm cache (D-03)
  { role: "user",   content: assembleIdeasBundle(input) } // volatile, per-request (D-05)
],
temperature: 0, seed: QWEN_SEED, response_format: { type: "json_object" }
```

### Anti-Patterns to Avoid
- **Importing `apollo-core.ts` into the new KC module** — violates D-08 greenfield. Structurally forbidden; grep-verify.
- **Mutating `knowledgeBundle` on the static runner const per request** — it's a module-level const; per-request grounding belongs in the user message (see 3A).
- **Interpolating profile/`ask`/anchor into the system prompt** — breaks the byte-stability contract (`apollo-core.ts:21-24`) and kills the warm cache. Live data lives ONLY in the user message (D-03).
- **Building an eval harness** — D-12 explicitly forbids it; the gate is a throwaway script + owner judgment.
- **Bumping or touching `ENGINE_VERSION`** — Phase 2 is additive content + assembler; it does NOT alter the Max scoring path. `KC_GEN_VERSION` is the only version this phase moves.
- **Passing raw `past_flops` content the assembler can't explain** — honesty spine; flag as creator-reported/directional until scrape enrichment (4B).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Profile → prompt formatting | A new profile formatter | Generalize the `formatCreatorContext` patterns (`creator.ts:262`) | Already solves null-guarding, cold-start, injection-fencing |
| Prompt-injection defense on user text | Custom escaping | The `<<<USER_CONTENT>>>` fence + `sanitizeText`/`stripUserContentSentinels` (`creator-profile.ts`, `creator.ts:252`) | Battle-tested; threat-model T-02-01 |
| Byte-stable prompt assembly | Runtime string-building | Compile-time constant concat (`apollo-core.ts:254`) | Keeps the byte-stable string fixed in source |
| Qwen call envelope | New client wiring | `getQwenClient` + the `run-flash-text-mode.ts:80-90` envelope | Determinism (seed+temp 0), timeout, strip+coerce already solved |
| Generative eval | A statistical harness | The throwaway blind-gate script (D-12) | D-12: eval is a means not the value |
| KC versioning | A DB-row corpus-version system | A simple constant (`version.ts` shape), NEW file | `corpus-version.ts` is training-corpus-DB scoped; overkill for content provenance |

**Key insight:** the entire *code* surface of this phase is a recombination of three existing, working patterns — the `apollo-core.ts` byte-stable constant, the `flash-prompts.ts` system/user split, and the `creator.ts` profile assembler. The genuinely new work is the **authored craft content** (Priority 1, owner-curated) and the **scripted regen** that automates the one manual step in `apollo-core.ts`.

## Common Pitfalls

### Pitfall 1: BASE leaking task-specificity (the D-00a failure)
**What goes wrong:** authoring "generation-flavored" statements into the BASE (e.g., "when generating ideas, …") — secretly making the base a generation engine, the exact thing D-00 forbids.
**Why it happens:** the immediate consumers are Ideas/Hooks, so the author drifts toward their shape.
**How to avoid:** apply the D-00a reviewer test to every BASE line — "does this make sense for scoring/decode/script too?" If not, move it to a slice.
**Warning signs:** BASE statements that name a mode, a task verb ("generate," "score"), or an output form.

### Pitfall 2: Breaking the warm cache with volatile data in the prefix
**What goes wrong:** interpolating profile/platform/ask into the per-mode system prompt → cache miss every request → cost + latency regression.
**Why it happens:** it's tempting to "personalize" the system prompt.
**How to avoid:** the per-mode system prompt is a **compiled constant**; nothing per-request enters it (D-03). Verify the compiled string has no template holes.
**Warning signs:** any `${variable}` in the compiled prompt that isn't a build-time constant.

### Pitfall 3: Accidentally re-importing the scoring craft (D-08 breach)
**What goes wrong:** "just look at how the scoring KC phrases hooks" → the scoring bias the rebuild exists to escape leaks back in.
**Why it happens:** `apollo-core.ts` is right there and well-written.
**How to avoid:** author from owner steer + Priority-1 notes only; never open `KNOWLEDGE_CORE`. Grep-verify no import of `apollo-core`.
**Warning signs:** slice language that reads scoring-shaped ("Strong/Mid/Weak bands," "dock for anti-patterns").

### Pitfall 4: Treating the assembler bundle as a static runner field
**What goes wrong:** trying to set the per-request bundle on the module-level `flashRunner` const → either shared mutable state or a contract mismatch.
**Why it happens:** the Phase-1 field is literally named `knowledgeBundle` on the runner.
**How to avoid:** runner `knowledgeBundle` = static slice-binding; assembler output = per-request user message (3A). Make the split explicit in types.
**Warning signs:** any per-request write to a shared runner object.

### Pitfall 5: The gate becoming a harness (D-12 scope creep)
**What goes wrong:** the "optional Flash delta" grows into a scored eval pipeline; effort goes to measurement instead of craft.
**Why it happens:** the dormant `corpus/` eval machinery is tempting to revive.
**How to avoid:** the gate is a throwaway script producing 3×N blind outputs for owner ranking. Stop there (D-12).
**Warning signs:** persisting gate results, computing aggregate scores, "tuning to the Flash number."

## Code Examples

### Scripted regen (the one new mechanism — automates `apollo-core.ts`'s manual step)
```typescript
// Source pattern: scripts/build-corpus.ts:1-35 (dotenv + tsconfig-paths) + apollo-core.ts:4-6 (escape rule)
// scripts/regen-kc.ts (recommended)
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function escapeForTemplate(md: string): string {
  return md.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}
const CORPUS = resolve(__dirname, "../.planning/corpus");
const base   = escapeForTemplate(readFileSync(`${CORPUS}/base.md`, "utf-8"));
const ideas  = escapeForTemplate(readFileSync(`${CORPUS}/ideas.md`, "utf-8"));
// … hooks, chat …
const out = `// GENERATED by scripts/regen-kc.ts — do not hand-edit. Source: .planning/corpus/*.md
// BYTE-STABILITY CONTRACT: no Date.now()/Math.random()/per-request data (mirrors apollo-core.ts).
export const KC_BASE = \`${base}\`;
export const KC_IDEAS_SLICE = \`${ideas}\`;
export const KC_IDEAS_SYSTEM_PROMPT = \`\${KC_BASE}\\n\\n---\\n\\n\${KC_IDEAS_SLICE}\`;
`;
writeFileSync(resolve(__dirname, "../src/lib/kc/compiled.ts"), out);
```

### Assembler skeleton (generalizes `formatCreatorContext`)
```typescript
// Source patterns: src/lib/engine/creator.ts:262-360 (null-guard + cold-start + fence)
// src/lib/kc/assembler.ts (recommended)
type Role = "niche" | "audience" | "goals" | "wins" | "flops" | "platform";
interface AssemblerInput {
  ask: string;                 // composer free-text — FENCE this
  platform: "tiktok" | "instagram" | "youtube";  // D-07 first-class
  mode: "idea" | "hooks" | "chat";
  overrides?: string;          // Tier B — FENCE
  anchor?: string;             // upstream idea / recent turns — FENCE
}
const MODE_ROLES: Record<AssemblerInput["mode"], Role[]> = {
  idea:  ["niche","audience","goals","wins","flops","platform"],
  hooks: ["niche","audience","platform","wins","flops"],
  chat:  ["niche","audience","platform"],
};
// pull only MODE_ROLES[mode] from profile-role-map, under a hard char cap;
// cold-start → "creator profile: thin (using {platform} baseline)" honest flag (D-05);
// fence ask/overrides/anchor with <<<USER_CONTENT>>> per creator.ts:330-337.
```

## Runtime State Inventory

> This phase is **additive greenfield** (new `.planning/corpus/` + new `src/lib/kc/` + new scripts). It is NOT a rename/refactor of existing runtime state. The one cross-system touchpoint:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 2 reads `creator_profiles` (existing) by role; writes no data. | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | Optional `FLASH_MODEL` env already exists (`run-flash-text-mode.ts:44`) for the gate's optional Flash call; no new secrets. | None |
| Build artifacts | `src/lib/kc/compiled.ts` is GENERATED — stale after a `.md` edit if regen isn't re-run. | Re-run `scripts/regen-kc.ts` after any corpus `.md` change (the lockstep hazard `apollo-core.ts:26` flags, now scripted). |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-copy `.md` → TS constant (`apollo-core.ts:4-6`) | Scripted regen (D-01) | This phase | Removes the lockstep-drift hazard |
| Single scoring-biased KC (`KNOWLEDGE_CORE`) | General base + per-mode slices (D-00) | This phase | Future tools ride the base free |
| Profile count-only for wins/flops (`creator.ts:339-348`) | Wins/flops as directional grounding (D-04) | This phase (partial; full content awaits v6.1 scrape) | Closes the "half-used signal" gap as far as v1 data allows |

**Deprecated/outdated for this phase:**
- The dormant `corpus/` eval machinery — D-12 deliberately does NOT revive it.
- `training-data.json` (2.6MB) — banned liability (REQUIREMENTS Out of Scope); exemplar patterns are authored-fresh + abstracted (D-04).

## Project Constraints (from CLAUDE.md)

From `./CLAUDE.md` + `~/CLAUDE.md` + `~/virtuna-numen-tools/CLAUDE.md`:
- **Files under 500 lines; typed interfaces for public APIs; DDD bounded contexts** — the new `src/lib/kc/` module is its own bounded context.
- **NEVER save working files/tests/md to root** — corpus `.md` → `.planning/corpus/`; code → `src/lib/kc/`; scripts → `scripts/`; gate is a script not a root file.
- **Validate input at system boundaries; sanitize to prevent injection** — the assembler MUST fence `ask`/`overrides`/`anchor` (reuse `sanitizeText`/`<<<USER_CONTENT>>>`).
- **TypeScript over JS; pnpm; run tests + lint before commit; verify, don't assume.**
- **Qwen-only** (no Gemini/DeepSeek) — gate's optional Flash call uses the existing Qwen client.
- **Engine OPEN but regression-gated** — do not touch `ENGINE_VERSION` / the Max path.
- **No model-generated UI** — N/A to Phase 2 (no UI), but the KC feeds the fixed typed renderers downstream.
- **No project skills found:** `.claude/skills/` and `.agents/skills/` do not exist in this worktree (verified). No `SKILL.md` to honor.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended `src/lib/kc/` module layout + file names | Component Responsibilities | LOW — Claude's discretion per CONTEXT; planner may rename |
| A2 | Recommended per-mode role lists + that a char cap (vs token cap) is acceptable | 3D | LOW — D-05 explicitly leaves field lists + caps to planner/author tuning |
| A3 | `KC_GEN_VERSION` stamps at the message level (not block) | 2C | MEDIUM — D-06 under-specifies *where* the stamp lands; confirm scope (Phase-2 vs Phase-3) with owner/planner |
| A4 | The runner `knowledgeBundle` field = static slice-binding; live grounding = user message | 3A | MEDIUM — Phase-1 contract is ambiguous (static field vs per-request data); recommend planner confirm the split. If wrong, the assembler integration point shifts |
| A5 | Wins/flops can only be passed as "creator-reported/directional" in v1 (no scraped content) | 4B | LOW — consistent with REQUIREMENTS (history is a bonus, not foundation) + v6.1 deferral; honesty-spine-safe either way |
| A6 | External craft notes (Priority 1) are accurate enough to be *owner steer*, not authoritative craft | Priority 1 | LOW by design — D-09 makes the owner the taste arbiter; research is explicitly raw material, never copy-pasted |

## Open Questions

1. **Where does `KC_GEN_VERSION` provenance get stamped, and is that Phase-2 or Phase-3 scope?**
   - What we know: D-06 wants the tag decoupled + stamping output provenance; Phase-1 block/message schemas have no KC-version field.
   - What's unclear: whether persisting the stamp is in Phase-2 (which produces no product output) or Phase-3 (first product persistence).
   - Recommendation: define the constant in Phase 2; defer the *persistence wiring* to Phase 3 where outputs are first stored. Flag for planner.

2. **Does the per-mode system prompt get assembled at compile time or runtime?**
   - What we know: D-03 wants a byte-stable per-mode prefix; both forms produce the same bytes.
   - Recommendation: assemble at **compile time** (in `regen-kc.ts`) so the byte-stable string is fixed in source — strictest form of the contract. Low-risk either way.

3. **What is the hard length cap value for the live bundle (D-05)?**
   - What we know: D-05 mandates a cap; the value is explicitly the author's tuning call.
   - Recommendation: set after the BASE+Ideas slice exist, sized so the live tier stays the cheap-varying part relative to the warm prefix. Not a blocker for planning.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + tsx/ts-node script runner | Scripted regen + gate script | ✓ (used by existing `scripts/*`) | repo toolchain | — |
| `zod` | assembler output validation | ✓ (repo dep) | repo | — |
| Qwen client + `FLASH_MODEL` env | optional gate Flash delta | ✓ (`run-flash-text-mode.ts`) | repo | gate works without it (owner blind rank is the gate) |
| `creator_profiles` table | assembler live tier | ✓ (existing) | live DB | cold-start → platform baseline (D-05) |
| `.planning/corpus/` directory | corpus SSOT | ✗ — **does not exist yet** | — | First authoring task creates it (no fallback needed; it's a new dir) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `.planning/corpus/` is created by the first task; the optional Flash gate-delta degrades to owner-only blind ranking.

## Sources

### Primary (HIGH confidence — read at source this session)
- `src/lib/engine/apollo-core.ts` — byte-stability contract (`:21-33`), manual regen rule (`:4-6`), constant concat (`:254`), mechanism-naming discipline (`:57-64`).
- `src/lib/engine/flash/flash-prompts.ts` — the exact D-03 system/user split (`buildSystemPrompt:61`, `buildFlashUserContent`, framing maps `:30-58`).
- `src/lib/engine/flash/run-flash-text-mode.ts` — Qwen call envelope (`:80-90`), `FLASH_MODEL` env (`:44`).
- `src/lib/tools/tool-runner.ts` — `KnowledgeBundle` opaque shape (`:24-27`), `knowledgeBundle: …|null` (`:50-54`), `ToolInput` (`:31`), `dispatchToolOutput` (`:94`).
- `src/lib/tools/runners/flash-runner.ts` — `knowledgeBundle: null` Phase-2 placeholder (`:70-71`), `runFlashRunner` (`:97`).
- `src/lib/tools/blocks.ts` + `block-registry.ts` — frozen block schemas (no KC-version field).
- `src/lib/engine/creator.ts` — `formatCreatorContext` (`:262-360`): semantic-role null-guarding, cold-start baseline (`:282-298`), injection fence (`:330-337`, `:252-254`), wins/flops count-only (`:339-348`).
- `src/lib/schemas/creator-profile.ts` — profile field shapes + `sanitizeText` + caps.
- `src/types/database.types.ts:713-750` — `creator_profiles` columns.
- `src/lib/engine/version.ts` — `ENGINE_VERSION` (protected, do-not-touch).
- `src/lib/engine/corpus/corpus-version.ts` — the DB-corpus-version precedent (NOT the model for `KC_GEN_VERSION`).
- `scripts/build-corpus.ts:1-35` — script runner dotenv+tsconfig-paths pattern.
- `.planning/config.json` — `nyquist_validation:false`, `security_enforcement:false`.

### Secondary (MEDIUM confidence — external craft, owner-curated per D-09)
- opus.pro (TikTok/Shorts hook formulas; 34,635-clip analysis) · prealgo.com (hook archetypes 2026) · selfstorming.com (timing) · storyboxhq.ca + ridgefilms.com.au + virvid.ai (retention psychology) · ncbi.nlm.nih.gov/PMC9792976 (neurophysiologic immersion) · walkersands.com + aicontentfy.com + wordstream.com (idea resonance / contrarian take) · conductor.com + strattoncraig.com (anti-slop signals).

### Tertiary (LOW confidence)
- None relied upon. External craft is explicitly *raw material for owner curation* (D-09), not authoritative.

## Metadata

**Confidence breakdown:**
- Code seams / architecture: HIGH — every contract read at source; the three reuse patterns (apollo-core / flash-prompts / creator.ts) are verified working.
- Compile/regen + assembler design: HIGH — direct generalizations of existing working code.
- External craft (Priority 1): MEDIUM — sound public frameworks, but D-09 makes the owner the arbiter; it's steer, not spec.
- Gate design: HIGH — D-12 is prescriptive; the recommendation is "do less," low risk.

**Research date:** 2026-06-17
**Valid until:** ~2026-07-17 (code seams stable; external craft is durable but owner-curated regardless).

## RESEARCH COMPLETE
