# Phase 3: Ideas Tool - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the **funnel-top generator** — idea cards grounded on the creator's `creator_profiles` + the rebuilt KC Ideas slice, **content-first** with a streaming SIM-1 Flash viability hint, a **bounded self-judge gate**, **legible "why-it-fits" grounding**, and a **"Develop this →" chain into Hooks**. This is the first phase where inline Flash scoring is exercised in product, and where the Idea composer chip (built-disabled in P1) flips live.

Requirements (locked by ROADMAP/REQUIREMENTS): **IDEAS-01, IDEAS-02, IDEAS-03, ENGINE-02, GROUND-03, PROFILE-01, THREAD-05**.

This discussion clarified **HOW** to wire the Ideas tool onto the P1 substrate (tool-runner, flash-runner, typed-block registry, composer) + the P2 KC (BASE + Ideas slice + assembler). New capabilities (Hooks UI = P4, open chat + Test reframe = P5, Scripts/Remix = v6.1) are out of scope — Phase 3 builds the Ideas surface and the one engine task that makes its gate trustworthy.

**Sequencing:** Depends on Phase 1 (Flash text-mode + tool-runner + typed renderers + composer) and Phase 2 (KC Ideas slice + grounding assembler). On the critical path for Phase 4 (Hooks replicates the proven Ideas card + gate shape).
</domain>

<decisions>
## Implementation Decisions

### Area 1 — Viability score: what Flash judges + gate-vs-hint (IDEAS-02, ENGINE-02)
- **D-01 (Flash target = the seed hook, ONE pass):** SIM-1 Flash reacts to the **idea's seed hook** (the KC Ideas slice already emits exactly one seed hook per concept), not the raw concept. A hook is a real content piece the SIM can react to — this resolves the backlog **altitude flag** ("don't bolt raw-concept SIM-scoring onto Ideas") honestly. The single Flash reaction yields band + audience-fraction + per-persona scroll-quotes, surfaced as a **concept *ceiling*** ("worth shooting?"), never an idea-quality verdict.
- **D-02 (two bounded gates, ONE SIM pass):** Ideas has two distinct quality gates that share **no extra Flash cost**:
  1. **KC self-rejection (generation-time, prose):** the concept must clear the BASE Value Bar — specific + named-mechanism + non-fakeable concrete (lever #5, already authored) — or it is never emitted. This gates **concept quality** independently of its hook.
  2. **SIM hook-pull floor (one Flash pass):** the card's seed hook must clear the recalibrated slop floor (see D-04) or the card is dropped. The *same* band drives both the hidden gate AND the displayed hint — no second pass.
- **D-03 (bounded regeneration = over-generate + filter, NO regen loop):** Generate an over-generated buffer (~5 for N=3 — see D-09), Flash-react once per candidate, **drop sub-floor cards**, present the survivors. **No generate→critique→regenerate loop in v1** — that is backlog lever #3, an explicitly *future* phase. Keeping it out is what makes ENGINE-02 "bounded" real (cost + latency controlled).
- **D-04 (card leads with the scroll-quote — SIM is a GATE, not a ranker):** Per the owner reframe, the SIM doesn't discriminate finely enough to *order* good ideas and shouldn't try. The card **leads with the sharp per-persona scroll-quote** ("why they'd stop/scroll" texture = the actionable signal that sells the moat); band/fraction is **secondary**. "All Mixed" is a valid gate answer, not a failure.

### Area 2 — Niche-instantiate the text SIM (lever #10 — the top Phase-3 engine task)
- **D-05 (lever #10 IS in Phase 3, full):** Thread **niche/content-type into `runFlashTextMode`** and build the persona panel via **`selectPersonaSlots`** (gives niche-true personas — e.g. "fitness saver" — AND the ~30% FYP/tough-crowd weighting for free) **instead of** the generic `STABLE_FLASH_SYSTEM_PROMPT` block. Rationale: without this the text SIM is **niche-blind** and scores flat (the prototype returned 6/6/6/6/5, all "Mixed") — the entire Area-1 gate is **inert** without it. The rich `NICHE_INSTANTIATION` table + FYP weighting already exist; the text path simply never calls them.
- **D-06 (recalibrate thresholds, proven by a slop-vs-strong test):** `STRONG_THRESHOLD` / `MIXED_THRESHOLD` were never empirically set — **recalibrate them**, and prove the gate works with a **slop-vs-strong test** (feed obvious garbage vs a known-great idea; if garbage doesn't score clearly lower, retune). This test **validates the gate itself** (the thing that matters) and is the **acceptance check** for this engine task.
- **D-07 (regression guardrail — text path ONLY):** This is a **text-path** change. The SIM-1 Max (video) scoring path stays **untouched**: engine suite green, same-video Max score-identity preserved, **`ENGINE_VERSION` NOT bumped** (no deliberate video-scoring change). No silent regressions.

### Area 3 — Idea card anatomy + legible grounding (IDEAS-01, GROUND-03)
- **D-08 (concept-forward card face):** Card **face** (always visible) = **title · angle · why-it-fits + the lead scroll-quote** (D-04). **Behind a tap/expand:** named mechanism, the seed hook, and the Topic×Take×Format breakdown. Rationale: the KC slice insists **the concept is the deliverable, not the hook** ("ship the film, not the trailer") — but a ranked/stacked list must stay scannable (mirrors P1 D-01 aggregate-forward).
- **D-09 (legible grounding = a dedicated line from REAL profile fields):** GROUND-03's "why it fits you" renders as a **visually distinct element**, e.g. "Because: 18-25 gym beginners · last 3 myth-busts overperformed" — populated from the **assembler's actual profile fields by semantic role**, with the honest cold-start fallback (D-12) when thin. This is the explicit **"not a generic chatbot"** differentiator and must NOT be folded invisibly into the angle prose.
- **D-10 (new `idea-card` typed block in the registry):** Add a single schema-validated **`idea-card`** block to the fixed renderer registry (extends P1 D-14) carrying `{title, angle, whyItFits, mechanism, seedHook, needsTake, topic/take/format}` and **embedding** the band + scroll-quote. No model-generated UI; validated at the tool-runner boundary AND on rehydration. **This is the card+gate shape Hooks replicates in Phase 4.**
- **D-11 (visible "needs your first-hand take" badge):** The KC slice already distinguishes ideas that lean on a take the creator must supply from ones the evidence already supports — surface this as a **visible badge** on the card. Honest + actionable (tells the creator where they must add themselves).

### Area 4 — Entry mode, volume, cold-start, chain (IDEAS-01, PROFILE-01, IDEAS-03, THREAD-05)
- **D-12 (Auto vs seeded rides the universal composer):** Idea chip active + **empty send → Auto** (generate from the profile); Idea chip + **typed topic/angle → seeded** around it. One composer, no new UI — rides P1 D-06/D-07 (explicit tool selection + universal door).
- **D-13 (N = 3 cards; over-generate ~5, gate to 3):** Present **3 cards** — enough for the KC's **intra-batch diversity** requirement (genuinely distinct angles/mechanisms) without overwhelming the list or the buffer cost. Pairs with D-03: generate ~5, drop sub-floor, present the best 3. (Exact buffer size = planner's tuning call against cost.)
- **D-14 (cold-start → platform baseline + honest flag):** Thin/no profile → the assembler **degrades to universal craft + platform baseline** (already built); the card's grounding line reads honestly ("Based on TikTok baselines — add your profile for tailored ideas") instead of a fabricated "because your audience…". Matches the honesty spine + the assembler cold-start path. **Never block Ideas behind onboarding** (preserves the cold-start funnel-top entry).
- **D-15 ("Develop this →" stays in-thread):** The chain CTA **appends Hooks below the idea in the SAME thread** (THREAD-05). The assembler's **`anchor`** field already carries the upstream idea into the Hooks bundle; staying in-thread preserves context + the conversational spine and reuses persistence. (Hooks UI itself is Phase 4 — Phase 3 ships the CTA + the in-thread chain seam + the anchor handoff.)

### Claude's Discretion
- Exact over-generate buffer size and the precise numeric slop-floor / `STRONG`/`MIXED` threshold values (mechanism locked by D-03/D-06; tuning is the planner/calibration call against the slop-vs-strong test).
- The `idea-card` block's exact prop names, the expand interaction, and the grounding-line/badge visual treatment (THEME-06 flat-warm SSOT; shape locked by D-08/D-09/D-10/D-11).
- The Ideas API route shape + how the over-generate→gate→stream orchestration threads content-first (the content renders, the scroll-quote/band streams a beat later — IDEAS-02 latency pattern; runner `stream?` seam reserved in P1).
- Internal signatures for threading niche/content-type into `runFlashTextMode` + the `selectPersonaSlots` wiring (mechanism locked by D-05).
- KC_GEN_VERSION stamping on persisted Ideas outputs (P1 deferred this stamping to Phase 3 — the first phase where outputs are persisted).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope & constraints
- `.planning/ROADMAP.md` §Phase 3 — goal + 5 success criteria for this phase.
- `.planning/REQUIREMENTS.md` — IDEAS-01/02/03, ENGINE-02, GROUND-03, PROFILE-01, THREAD-05 + cross-cutting constraints (honesty spine, bounded cost, engine-open-but-protected, Qwen-only, fixed renderers, THEME-06).
- `.planning/PROJECT.md` — milestone identity + locked constraints.
- `.planning/phases/01-engine-thread-foundation/01-CONTEXT.md` — P1 seams Ideas plugs into (tool-runner THREAD-06, composer chip/model-field D-06/D-07/D-09, honesty spine D-10/D-11, renderer registry D-14, Flash band/personas D-01/D-02/D-03).
- `.planning/phases/02-knowledge-core-generative-rebuild/02-CONTEXT.md` — P2 KC decisions (BASE/slice shape D-04, live-tier assembler D-05, platform first-class param D-07, KC_GEN_VERSION D-06, Ideas = pilot slice D-15).

### Phase-3 backlog (the two flags that shaped this phase — MUST read)
- `.planning/research/kc-improvement-levers.md` — the **altitude flag** ("don't bolt raw-concept SIM-scoring onto Ideas"; loop bites at the hook stage), the **SIM-audit** (text path is niche-blind → flat 6/6/6 root cause), **lever #10** (niche-instantiate the text SIM — top Phase-3 engine task: niche panel + threshold recalibration + slop-vs-strong test), and the **SIM-is-a-gate-not-ranker** reframe (lead with scroll-quote). Also lever #3 (generate→critique→regenerate) = deferred future phase (basis for D-03 "no regen loop").

### Engine — SIM-1 Flash text-mode (protected Max path)
- `src/lib/engine/flash/run-flash-text-mode.ts` — the text-mode entry the niche thread-through (D-05) modifies; current signature `runFlashTextMode(text, framing)` takes NO niche.
- `src/lib/engine/flash/flash-prompts.ts` — `FlashFraming` + `STABLE_FLASH_SYSTEM_PROMPT` (the generic block to replace) + `STRONG`/`MIXED` thresholds (recalibrate, D-06).
- `src/lib/engine/flash/flash-aggregate.ts` — `aggregateFlash` (verdicts → band + fraction, D-02).
- `src/lib/engine/persona-weights.ts` + the niche path — `selectPersonaSlots` + the `NICHE_INSTANTIATION` table + FYP/tough-crowd weighting that the text path must now call (D-05).
- `src/lib/engine/version.ts` — `ENGINE_VERSION`; do NOT bump (D-07, text-path-only change).
- `src/lib/engine/__tests__/` — the engine suite that must stay green.
- `scripts/ideas-sim-rank.ts` — the existing per-idea SIM prototype (the 6/6/6 flat-distribution evidence; reference for the slop-vs-strong calibration test).

### Tool-runner, blocks, threads (P1 substrate)
- `src/lib/tools/tool-runner.ts` — the THREAD-06 contract + `dispatchToolOutput` (the `stream?` seam reserved for IDEAS-02).
- `src/lib/tools/runners/flash-runner.ts` — `runFlashRunner` + `mapFlashResultToBlocks` (the Ideas tool's Flash producer; `id` currently "hooks" — Ideas adds the "idea" path).
- `src/lib/tools/block-registry.ts` (+ `src/components/thread/`) — the fixed registry the new `idea-card` block (D-10) joins; `band-block.tsx`, `personas-block.tsx`, `markdown-block.tsx`, `unsupported-block.tsx`, `message-blocks.tsx`.
- `src/lib/threads/threads.ts`, `src/lib/threads/messages.ts` — thread/message persistence the in-thread chain (D-15) reuses.

### Grounding (KC + assembler + profile)
- `.planning/corpus/base.md` + `.planning/corpus/ideas.md` — the BASE (Value Bar / self-rejection, lever #5) + the Ideas slice (concept-is-the-deliverable, Topic×Take×Format, seed-hook, needs-your-take flag). The source of D-01/D-02/D-08/D-11.
- `src/lib/kc/assembler.ts` (+ `assembler.test.ts`) — the GROUND-02 live-tier assembler: per-mode field-map, `BUNDLE_CHAR_CAP`, cold-start degradation (D-14), `anchor` field for the chain (D-15), `{ask, platform, mode, overrides, anchor}` input.
- `src/lib/kc/profile-role-map.ts` — `PROFILE_ROLE_MAP` / `ProfileRow` — `creator_profiles` accessed by semantic role (D-09 grounding line source; PROFILE-01).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`runFlashRunner` / `mapFlashResultToBlocks`** (flash-runner.ts) — the Flash producer Ideas consumes; emits band+personas blocks tagged `sim1-flash`. The `idea-card` block embeds this output.
- **`assembleBundle`** (assembler.ts) — produces the volatile per-request user message (the `knowledgeBundle` live grounding); already supports `mode:"idea"`, `platform`, cold-start, and `anchor`. The grounding-line (D-09) reads the same profile fields it pulls.
- **`selectPersonaSlots` + `NICHE_INSTANTIATION`** (persona-weights path) — the niche-true persona machinery the video path uses; D-05 routes the text path through it.
- **Composer tool chips** (`src/components/app/home/tool-chips.tsx`) — the Idea chip exists disabled ("coming soon"); Phase 3 flips it live (D-12).
- **Fixed renderer registry + double-validation** (D-14) — the `idea-card` block (D-10) joins it and is validated at write + rehydration.

### Established Patterns
- **Content-first, scores-stream** — the IDEAS-02 latency pattern; the `stream?` seam is reserved in the tool-runner (P1) for exactly this. Reference: `useExpertChat` SSE in `reading-chat.tsx`.
- **Two-tier Qwen cache** (D-03/P2) — byte-stable per-mode system prompt (cached) + volatile assembler user message (per-request). Ideas rides the warm Ideas-mode prefix.
- **Engine OPEN but regression-gated** — D-05/D-06 are text-path changes; keep the suite green, preserve Max score-identity, do NOT bump `ENGINE_VERSION` (D-07).
- **KC self-rejection as a structural gate** (BASE Value Bar / lever #5) — D-02's concept-quality gate is prose discipline already authored, not new code.

### Integration Points
- **Idea chip → live Ideas pipeline:** the composer routes an Idea-chip send (empty=Auto / typed=seeded, D-12) → assembler (`mode:"idea"`) → Qwen generate (over-generate buffer) → Flash hook-pull gate (D-01/D-03) → `idea-card` blocks → persist + render.
- **Niche thread-through:** `runFlashTextMode` gains a niche/content-type param sourced from the profile (D-05); the gate's discrimination depends on it.
- **Chain anchor → Hooks:** "Develop this →" writes the chosen idea into the same thread and seeds the assembler `anchor` for the Phase-4 Hooks call (D-15).
- **KC_GEN_VERSION stamping** lands here — first phase persisting generative outputs.

</code_context>

<specifics>
## Specific Ideas

- **"Don't bolt raw-concept SIM-scoring onto the Ideas tool"** (owner backlog flag) — the altitude insight that drove D-01 (score the seed hook, not the raw concept).
- **"The SIM is a quality/resonance GATE, not a ranker"** (owner reframe, 2026-06-17) — drove D-04 (lead with scroll-quote, band secondary) and dissolves the flat-distribution worry ("all Mixed" = a gate answer).
- **Lever #10 named the "top Phase-3 engine task"** — the niche-blind text SIM is the single highest-impact fix; the gate is inert without it (D-05/D-06).
- **"Most tools' output isn't useful/valuable/actionable/real"** (owner quality bar, carried from P2) — why the KC self-rejection gate (D-02) + legible grounding (D-09) + "needs your take" badge (D-11) are structural, not cosmetic.
- **GROUND-03 example copy** — "because your audience is 18-25 gym beginners and your last 3 myth-busting videos overperformed" — the literal shape of the grounding line (D-09).

</specifics>

<deferred>
## Deferred Ideas

- **Generate → critique → regenerate quality loop** (backlog lever #3) — a future "KC Grounding & Quality-Loop" phase. v1 uses over-generate + filter, NO regen loop (D-03).
- **Real-exemplar retrieval / RAG** (lever #1), **performance-feedback flywheel** (lever #8), **creator-voice calibration** (lever #7), **flop-prediction adversarial pass** (lever #6) — all future-phase rightness levers (kc-improvement-levers.md); not Phase 3.
- **4-outcome SIM model** (stop + save/share/comment, richer than binary stop/scroll) — flagged "honesty-spine-careful" optional in lever #10 step 3; not v1 unless trivially free.
- **Hooks UI** (Phase 4), **open chat + Test reframe** (Phase 5), **Scripts/Remix** (v6.1) — downstream/deferred per ROADMAP.
- **Profile redesign + social-handle scrape prefill** (v6.1, PROFILE-01 defers) — Phase 3 reuses the existing 9-card `creator_profiles` by semantic role; the field-map already tolerates the future redesign.
- **Per-card independent SIM concept-judgment** (separate from the hook) — deliberately not done; concept quality is gated by KC self-rejection at generation time instead (D-02), keeping it to one SIM pass.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 3-Ideas Tool*
*Context gathered: 2026-06-17*
