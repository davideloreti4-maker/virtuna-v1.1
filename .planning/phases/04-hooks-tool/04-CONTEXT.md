# Phase 4: Hooks Tool - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the **flagship moat demo** — from an idea (via the P3 "Develop this →" chain) or a creator's own topic, generate **N hook cards**, each tagged with the **audience archetype it grabs**, **gated then ranked** by a SIM-1 Flash pull-score (first-2s "do you stop scrolling?" framing), content-first, each chaining into **Test** (the full Reading). This completes the **Ideas → Hooks → Test** spine.

Requirements (locked by ROADMAP/REQUIREMENTS): **HOOKS-01, HOOKS-02, HOOKS-03**.

This discussion clarified **HOW** to wire Hooks onto the proven P3 substrate (the `idea-card` card+gate shape, content-first SSE, niche-instantiated text SIM, the `/develop` anchor seam) + the P2 Hooks KC slice. The P3 `/develop` endpoint already ships the in-thread anchor write + `fencedHooksBundle` — Phase 4 replaces its **placeholder** with real generation.

**Sequencing:** Depends on Phase 3 (chain seam, tool-runner, self-judge gate, legible-grounding, content-first stream patterns) and Phase 2 (Hooks KC slice `corpus/hooks.md`). On the critical path for Phase 5 (the Test reframe lands the "Test full →" handoff built here). Out of scope: open chat + the "Test · powered by SIM-1 Max" rename (P5), Scripts/Remix (v6.1).
</domain>

<decisions>
## Implementation Decisions

### Area 1 — Rank vs gate (HOOKS-02)
- **D-01 (Gate THEN rank):** Hooks resolve the apparent P3-vs-HOOKS-02 tension by doing **both**. Keep the P3 slop-gate (the seed-hook must clear the recalibrated floor or the card is dropped) **AND** order the survivors **#1..N by pull-score** (band tier → audience-fraction). Unlike ideas, hooks are atomic, discriminable first-2s units, so ranking them is legitimate and IS the demo ("who'll actually stop scrolling"). The gate keeps slop out (honesty spine); the ranking orders survivors (the flagship demo). The lead/top card still surfaces the sharp per-persona **scroll-quote** texture (P3 D-04 carries forward).
- **D-02 (rank qualitatively — no fabricated numeric score):** Ranking is by **band tier then audience-fraction**, presented qualitatively (band word + fraction + `sim1-flash` tag, per P1 D-11 BandBlock honesty). No fabricated fine-grained numeric pull-score, no view-count promise (ENGINE-03).

### Area 2 — Archetype tag (HOOKS-01)
- **D-03 (tag = the AUDIENCE archetype it grabs, not the craft form):** Resolve the HOOKS-01-vs-slice contradiction by reading "the archetype it **grabs**" literally — it's **which SIM persona stops scrolling** (e.g. "stops the skeptic," "grabs the gym-beginner"), sourced from the **Flash per-persona output** that already exists. No new data, no extra SIM pass.
- **D-04 (craft archetype stays PRIVATE):** The hook **craft** archetypes (BOLD / GAP / CONTRARIAN / RESEARCH / NARRATIVE / QUESTION) remain **private reasoning** per `corpus/hooks.md` — they drive **intra-batch diversity** (each of the N hooks uses a distinct archetype/mechanism) but are **never emitted as a `[SLUG]` tag or field label**. No re-authoring of the KC slice. (Whether to optionally reveal the craft form on card-expand is Claude's discretion — default: keep private.)

### Area 3 — Test chain (HOOKS-03)
- **D-05 ("Test full →" = handoff, NOT a Max run):** SIM-1 Max only runs on a **real video**; a hook is text, so P4 must **never score the hook on Max** (fabrication / honesty-spine break). Instead "Test full →" **deep-links to the existing Reading/Test upload surface carrying the chosen hook as anchored context (the brief)** — pre-fills/anchors the upload affordance, framed "shoot the video on this hook → upload → SIM-1 Max scores the real thing."
- **D-06 (honest Flash-ceiling → Max-realized ladder, ENGINE-03):** Flash on the text hook = the **concept ceiling** ("worth shooting? who stops in 2s?"); Max on the shot video = the **realized result**. P4 ships the **wired handoff + hook-as-context pre-fill** into the current Reading; the "Test · powered by SIM-1 Max" **rename of that landing is P5** — destination + carry-in mechanism land here, the rename does not.

### Area 4 — Entry, volume & trigger (HOOKS-01)
- **D-07 (Auto-generate on "Develop this →" — replace the placeholder):** "Develop this →" **auto-fires** Hooks generation (no extra "Generate hooks" tap). "Develop" is already explicit intent; cost is bounded by the over-generate buffer, not by a click. This replaces the P3 placeholder message in `/api/tools/ideas/develop`.
- **D-08 (N = 5 ranked cards; over-generate ~8 → gate → rank top 5):** Present **5** ranked hooks — enough for the ranking to *read* like a ranking and demonstrate discrimination (3 reads thin for a flagship "ranked hooks" demo). Generate an over-generate buffer (~8), gate sub-floor, rank the top 5. (Exact buffer size = planner's tuning call against cost, mirrors P3 D-03/D-13.)
- **D-09 (own-topic via the Hook composer chip):** Flip the disabled **Hook chip** live (mirrors P3 D-12): Hook chip + **empty send** → generate from the anchored idea / profile; Hook chip + **typed topic** → seeded around it. One composer, no new entry UI.
- **D-10 (stays in-thread):** Hooks **append below the idea in the SAME open thread** (P3 D-15 / THREAD-05) — preserves the conversational spine + reuses persistence. The `assembleBundle({mode:"hooks", anchor})` fence + `fencedHooksBundle` from `/develop` carries the upstream idea in.
- **D-11 (`hook-card` typed block replicates `idea-card`):** Add a single schema-validated **`hook-card`** block to the fixed registry (extends P3 D-10), validated at the tool-runner write boundary AND on rehydration (D-14 double-validation). Carries the hook line, the audience-archetype tag (D-03), the embedded band + scroll-quote, and the "Test full →" CTA.

### Claude's Discretion
- Exact over-generate buffer size and the precise rank ordering tie-breaks beyond band-tier → fraction (mechanism locked by D-01/D-02/D-08).
- The `hook-card` block's exact prop names, the card-face vs expand split (default: hook line + audience-archetype tag + band/scroll-quote on the face; mechanism/seed reasoning behind expand — mirror P3 D-08), and whether to optionally reveal the private craft form on expand (default: keep private per D-04). THEME-06 flat-warm SSOT.
- The Hooks API route shape + how over-generate → gate → rank → stream threads content-first (content renders, scroll-quote/band streams a beat later — IDEAS-02 pattern; reuses the `stream?` seam).
- Exact pre-fill payload + deep-link target for the "Test full →" handoff into the existing Reading entry (D-05/D-06).
- KC_GEN_VERSION stamping on persisted Hooks outputs (same stamp helper as P3).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope & constraints
- `.planning/ROADMAP.md` §Phase 4 — goal + 4 success criteria for this phase.
- `.planning/REQUIREMENTS.md` — HOOKS-01/02/03 + the cross-cutting constraints (honesty spine, bounded cost, engine-open-but-protected, Qwen-only, fixed renderers, THEME-06).
- `.planning/PROJECT.md` — milestone identity + locked constraints.
- `.planning/phases/03-ideas-tool/03-CONTEXT.md` — **the shape Hooks replicates** (card+gate D-08/D-10, content-first stream, niche text SIM D-05/D-06, legible grounding D-09, "Develop this →" chain seam D-15, anchor handoff).
- `.planning/phases/01-engine-thread-foundation/01-CONTEXT.md` — P1 seams (tool-runner THREAD-06, composer chip/model-field D-06/D-07/D-09, honesty spine + BandBlock D-10/D-11, renderer registry + double-validation D-14, Flash band/personas).
- `.planning/phases/02-knowledge-core-generative-rebuild/02-CONTEXT.md` — P2 KC (BASE/slice shape, live-tier assembler, platform param, KC_GEN_VERSION; Hooks slice replicated the proven Ideas shape).

### Knowledge-Core — the Hooks slice (MUST read)
- `.planning/corpus/hooks.md` — the Hooks generative slice: **craft archetype vocabulary (BOLD/GAP/CONTRARIAN/RESEARCH/NARRATIVE/QUESTION) is PRIVATE — never emitted as a `[SLUG]` tag** (the source of D-03/D-04); the deliverable is the executable hook; intra-batch diversity rule (distinct archetype per item); Question-archetype near-failure-mode; Actionability Contract; wins/flops steering.
- `.planning/corpus/base.md` — the shared BASE (Value Bar / self-rejection, Output Discipline) the gate (D-01) rides.
- `.planning/research/kc-improvement-levers.md` — the altitude flag + SIM-is-a-gate reframe (P3 origin; Hooks extends gate → gate+rank per D-01).

### Engine — SIM-1 Flash text-mode (protected Max path)
- `src/lib/engine/flash/run-flash-text-mode.ts` — niche-instantiated text SIM (P3 D-05) Hooks reuses with the **Hook framing** ("scrolling, first 2s, do you stop?").
- `src/lib/engine/flash/flash-prompts.ts` — `FlashFraming` (Hook framing) + recalibrated `STRONG`/`MIXED` thresholds (P3 D-06).
- `src/lib/engine/flash/flash-aggregate.ts` — `aggregateFlash` (verdicts → band + fraction; the rank key for D-01/D-02 and the per-persona output for the audience-archetype tag D-03).
- `src/lib/engine/version.ts` — `ENGINE_VERSION`; **do NOT bump** (Hooks adds Flash pull-scoring, text-path only — Max untouched).
- `src/lib/engine/__tests__/` — the engine suite that MUST stay green.

### Tool-runner, blocks, threads, chain seam (P1/P3 substrate)
- `src/lib/tools/runners/flash-runner.ts` — `runFlashRunner` + `mapFlashResultToBlocks`; `id` already `"hooks"` — this is the Hooks Flash producer.
- `src/lib/tools/tool-runner.ts` — the THREAD-06 contract + `dispatchToolOutput` + the `stream?` seam (content-first, IDEAS-02).
- `src/lib/tools/block-registry.ts` — the fixed registry the new `hook-card` block (D-11) joins.
- `src/components/thread/idea-card-block.tsx` — **the block `hook-card` replicates**; `ideas-thread-view.tsx`, `message-blocks.tsx`, `band-block.tsx`, `personas-block.tsx`, `markdown-block.tsx`, `unsupported-block.tsx`.
- `src/app/api/tools/ideas/develop/route.ts` — the PINNED chain-anchor endpoint: writes the **placeholder** Hooks message + returns `{threadId, messageId, fencedHooksBundle, ideaId}`. **Phase 4 replaces the placeholder with real generation** (the contract is pinned; honor it).
- `src/lib/kc/assembler.ts` — `assembleBundle` already supports `mode:"hooks"` + `anchor` + the injection fence (the P3 `/develop` proves the fence is applied).
- `src/components/app/home/tool-chips.tsx` — the Hook chip exists **disabled**; Phase 4 flips it live (D-09).
- `src/lib/threads/threads.ts` (`createOpenThreadLazy`), `src/lib/threads/messages.ts` (`insertMessage`) — the in-thread persistence Hooks reuses (D-10).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`/api/tools/ideas/develop` (placeholder + `fencedHooksBundle`)** — the anchor seam is already built; Hooks generation replaces the placeholder message and consumes the already-fenced `assembleBundle({mode:"hooks", anchor})` (no re-assembly needed; the injection fence is applied).
- **`runFlashRunner` / `mapFlashResultToBlocks`** (flash-runner.ts, `id:"hooks"`) — the Flash producer Hooks consumes; emits band + per-persona blocks tagged `sim1-flash`. The per-persona output feeds the audience-archetype tag (D-03) and the rank key (D-01).
- **`idea-card-block.tsx` + double-validation** — the exact card+gate shape `hook-card` (D-11) clones.
- **`assembleBundle({mode:"hooks", anchor})`** (assembler.ts) — Hooks-mode grounding + the anchor fence; already exercised by the P3 develop seam.
- **Hook composer chip** (tool-chips.tsx) — exists disabled; flip live (D-09), mirrors P3 Idea-chip flip.

### Established Patterns
- **Content-first, scores-stream** — IDEAS-02 latency pattern; the `stream?` seam is reserved in the tool-runner. Hook content renders, scroll-quote/band/rank streams a beat later.
- **Engine OPEN but regression-gated** — Hooks is a **text-path** change (Flash pull-scoring); keep the suite green, preserve Max same-video score-identity, **do NOT bump `ENGINE_VERSION`**.
- **KC self-rejection + intra-batch diversity** — the gate (D-01) rides BASE Value Bar prose discipline; diversity (D-04) is the slice's private-archetype rule, already authored.
- **In-thread chain** (P3 D-15) — Hooks append in the same open thread; "Test full →" is the next chain CTA in that thread.

### Integration Points
- **"Develop this →" → live Hooks pipeline:** the P3 CTA calls `/develop` → (now) auto-generate → assembler (`mode:"hooks"`, anchor) → Qwen generate (over-gen ~8) → Flash gate+rank (D-01) → top 5 `hook-card` blocks → persist + render content-first, in-thread.
- **Own-topic → Hooks:** Hook chip send (empty=from anchor/auto, typed=seeded) → same pipeline (D-09).
- **"Test full →" → existing Reading:** the chosen hook deep-links into the current Reading/Test upload surface as anchored context/brief (D-05); P5 renames that landing.
- **Audience-archetype tag** is read from the Flash per-persona reactions (no new SIM pass); **craft archetype** is private generation-time reasoning (D-03/D-04).

</code_context>

<specifics>
## Specific Ideas

- **"Gate THEN rank"** (owner, 2026-06-18) — Hooks are atomic/discriminable so ranking is legitimate where ideas weren't; keep the honesty gate AND order survivors. Resolves the P3-gate-vs-HOOKS-02-rank tension.
- **"The archetype it GRABS = which audience persona stops"** (owner, 2026-06-18) — the user-facing tag is the SIM persona captured, NOT the private craft form (BOLD/GAP). Honors HOOKS-01 literally without breaking the slice's private-reasoning discipline.
- **"Full test (Max) is only possible on video"** (owner, 2026-06-18) — drove D-05/D-06: "Test full →" hands the hook in as the *brief* for the shot video; Max scores the real upload, never the text. The honest Flash-ceiling → Max-realized ladder.
- **N = 5** so the ranking reads like a ranking (3 is too thin for the flagship "ranked hooks" demo).

</specifics>

<deferred>
## Deferred Ideas

- **"Test · powered by SIM-1 Max" landing rename** — Phase 5 (TEST-01). P4 ships the handoff + hook-as-context pre-fill into the *current* Reading; the rename is P5.
- **Open chat thread (no anchoring Reading)** — Phase 5 (THREAD-03).
- **Generate → critique → regenerate quality loop** (backlog lever #3) — future phase; Hooks v1 uses over-generate + gate + rank, no regen loop (carries P3 D-03).
- **Emitting the craft archetype slug (BOLD/GAP…) as a visible tag** — deliberately NOT done; craft archetype stays private per `corpus/hooks.md` (D-04). Optional reveal-on-expand left to Claude's discretion, default private.
- **Scripts / Remix tools** — v6.1.
- **Profile redesign + social-handle prefill** — v6.1 (PROFILE-01 reuses existing `creator_profiles`).

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 4-Hooks Tool*
*Context gathered: 2026-06-18*
