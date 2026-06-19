# Phase 9: Living Audience — interactive simulation UX - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Make "tested against YOUR audience" *felt*, not numeric. Turn the static persona cloud into a living, interrogable audience — the **AudienceLens**: one reusable component, mounted across every skill, built on infra that already exists (`PersonaCloud`/`PersonaGraph`, per-persona `segment_reactions`, persona system prompts in `persona-registry.ts`, the P5 `chat-runner`).

**Locked design direction:** Sketch 005 `audience-scale` (CHOSEN — see `.planning/sketches/005-audience-scale/`). The AudienceLens spine: **The Read** (interpret + lever) leads · **Panel · 10 ⇄ Population · 1,000** scale toggle (the 10 named archetypes are the legible legend of a variance-instantiated swarm) · persistent reaction feed · audience-scoped chat · sticky **"Rewrite for this audience →"** closes the regenerate loop (the flywheel = the product).

**In scope (P9 v1):**
- The Read as the opened-sheet header (reuse P8's verdict + interpretation + lever).
- Reaction replay (segment-by-segment where a timeline exists; staggered reveal elsewhere).
- Clickable persona node drill-down (cloud dot → archetype + verbatim).
- **Chat-with-persona** (the flagship cheatcode) — grounded in-voice conversation.
- Cluster-by-segment (Temperature × Disposition lens).
- **Population · 1,000** — lean honest v1 (variance scatter + live counters + cascade + archetype breakdown).
- **AudienceLens reusable component retrofit inline across all 6 skills**, degrading by feature.
- **Rewrite-for-audience** sticky CTA → regenerate loop.

**Out of scope (→ other phases / backlog):**
- Population per-dot tap-to-drill (archetype breakdown is the v1 drill path) — fast-follow.
- "Ask the whole room" multi-persona chat (one persona at a time in v1).
- Synthesized pseudo-timelines for text concepts (honesty-spine — don't fake structure).
- Account Read / saved shelf / recalibration flywheel (Phase 10).
- Desktop docked-pane layout refinement (sketch open item) — Claude's discretion this phase.

**Honesty posture (a feature, not a caveat):** labeled SIM-1, shows the *reasoning* per persona, never fakes a focus group. The swarm derives from named, calibrated archetypes — legible simulation = the moat's credibility (anti-slop spine).

</domain>

<decisions>
## Implementation Decisions

### Area 1 — P9 cut line (scope within the fixed boundary)
- **D-01 (Panel·10 core + lean Population, phased within P9):** Waves 1–3 ship the full **Panel·10** living experience — The Read header (reuse P8) + reaction replay + node drill-down + chat-with-persona + cluster-by-segment + Rewrite loop. The final wave ships **Population·1,000 as a lean honest v1** (variance scatter + live aggregate counters + cascade-on-play + archetype breakdown with representative verbatims). **Per-dot Population tap-to-drill is DEFERRED** (the sketch itself lists per-dot interactivity as a "next refinement," not v1; archetype breakdown is the v1 drill path). **Rationale:** the moat value (interrogable, legible, chattable audience) all lives on the 10; Population is the "missing touch" you chose 005 for, so it ships — but the riskiest/heaviest part (per-dot drill) is held back. P8 already shipped The Read + verbatim + who-it's-NOT-for as *static* cards (P8 D-08: "P9 owns the live interactive cloud — do not redesign it here"); P9's job is the **live/interactive** layer.

### Area 2 — Population·1,000 honesty model
- **D-02 (Deterministic instantiation from the 10 — zero per-dot model calls):** Distribute ~1,000 dots proportional to persona weights; each dot = its archetype's **real** Flash/SIM sentiment + **bounded seeded variance** (the `mulberry32` deterministic pattern already in `PersonaGraph`, no `Math.random`). The 30% "affinity-neighbour variance" = boundary dots blend toward the adjacent archetype. Aggregate counters = a **weighted rollup of the 10** — i.e. Population and Panel render the *same underlying signal at different resolutions*. The cascade is a deterministic **visual** animation seeded from the same data, NOT a new prediction. **Honesty label:** "1,000 viewers instantiated from your 10 calibrated archetypes." **Rationale:** 1,000 independent reactions = 1,000 model calls (cost + nondeterminism, breaking the engine determinism gate) and a fake-crowd that violates the honesty spine. Deterministic instantiation is transparent, cheap, determinism-gate-safe, and honest.

### Area 3 — Chat-with-persona session model
- **D-03 (In-context drawer, sub-thread persisted, one persona at a time):** Tap a node → "ask them why" opens an **in-context drawer/sheet over the cloud**, scoped to the current Read — NOT a new top-level thread (keeps the thread list clean; `chat` is not in the `SkillId` union). Grounding payload = the persona's `persona-registry` system prompt + its emitted reaction to *this* concept (verdict / `scrollQuote` / score) + the concept text; it answers **in-voice** via the existing `chat-runner.ts` (extend to accept persona-grounding context). **Persisted as a lightweight sub-thread within that Read** so reopening shows prior Q&A. One persona at a time (the tapped node); switching persona = new sub-conversation. "Ask the whole room" deferred.

### Area 4 — AudienceLens spine + Rewrite loop
- **D-04 (Reusable component, retrofit inline across all 6 skills, degrade by feature):** Build AudienceLens as a genuinely **reusable** component and **mount it inline across all 6 skills** (ideas / hooks / script / remix / test / chat) via each card's persona viz + the `PersonaCloud onOpen` seam. Because data richness is uneven, the Lens **degrades feature-by-feature**: cloud + node-drill + chat + cluster + Population work everywhere (Population instantiates from the 10, available on any skill); **replay only where a real segment timeline exists** (Test/Read with `segment_reactions`), staggered reveal elsewhere. **Rationale:** this is the locked sketch-005 vision ("one shared component every skill mounts"); graceful degradation makes "all 6" tractable as a single component rather than six bespoke surfaces. *(Owner override of the recommended "mount on Test/Read only" — deliberate, full-vision scope; planner should wave it so the rich-signal mount [Test/Read] lands first and thin-signal skills follow.)*
- **D-05 (Rewrite-for-audience loop):** The sticky **"Rewrite for this audience →"** routes back to the skill that produced the concept (hook → hooks-runner, remix → remix-runner, etc.), carrying the Read's **lever as explicit steering**, producing a **new card + new Read in-thread** via the `CHAIN_HANDOFFS` plumbing. The new Read shows the **delta vs the prior**, so the loop honestly proves whether the lever worked (the flywheel). Rewrite behavior on a plain chat turn (no regenerable concept) = Claude's discretion (likely hidden/disabled where there's no concept object to regenerate).

### Area 5 — Reaction replay & scale toggle
- **D-06 (Staggered reveal where no timeline):** Test/Read (has `segment_reactions`) replays **segment-by-segment** as "the room watches." Text concepts (ideas/hooks/script/remix) have no timeline → personas react in a **staggered cascade** (the room "reads" it), ordered by sentiment/weight. **No synthesized pseudo-timeline** — don't fake structure the concept doesn't have (honesty spine).
- **D-07 (Scale toggle is per-Read, remembers last choice):** The Panel·10 ⇄ Population·1,000 toggle lives on **each opened Read** (scale THIS concept's audience), defaulting to the **last-used** choice so a Population-preferring user stays there. Fits the "examine this concept" framing; no global setting surface. *(Sketch's open "per-Read vs audience-level" question — resolved to per-Read.)*

### Claude's Discretion
- **Cluster-by-segment grouping** — use the existing Temperature × Disposition lens via `buildSegmentGroups` (`audience-derive.ts`); exact grouping/label presentation is planner discretion.
- **Desktop docked-pane layout** of the Lens (sketch open item) — discretion this phase; mobile-first per the design system.
- **Swarm animation accessibility** — gate the cascade/pulse on `reducedMotion` (PersonaGraph already does this); sr-only mirror of aggregate + archetype breakdown.
- **Population dot count** (~1,000 is nominal) and the 70/30 archetype/variance split tuning — within D-02's deterministic shape.
- **Rewrite CTA visibility** on non-regenerable surfaces (chat turns) — hide/disable where there's no concept object.
- **THEME-06 flat-warm** is the design SSOT (cream-alpha, never pure white; coral = weak/worst cluster only).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope & locked design
- `.planning/ROADMAP.md` §Phase 9 — goal + draft ladder (replay, node-drill, chat-with-persona, segment clustering) + reuse-vs-new + dependency on Phase 8.
- `.planning/sketches/005-audience-scale/README.md` + `index.html` — **the LOCKED design direction.** The AudienceLens spine: The Read (interpret + lever), Panel·10 ⇄ Population·1,000, persistent feed, audience-scoped chat, sticky Rewrite CTA. Includes the "still open / next refinements" list (per-dot interactivity, toggle placement, desktop layout) — several resolved in this CONTEXT.
- `.planning/sketches/MANIFEST.md` — sketch lineage (002 → 003 → 004 → 005) and why 005 won.
- `.planning/STATE.md` — Hard Constraints (engine OPEN but regression-gate-PROTECTED, Qwen-only, fixed typed renderers, flat-warm SSOT, bump `ENGINE_VERSION` only on deliberate video-scoring changes).
- `.planning/PROJECT.md` — milestone identity + key decisions.
- `.planning/REQUIREMENTS.md` — formalize Phase 9 requirements here (currently provisional LIVE-* in ROADMAP: reaction replay, node drill-down, chat-with-persona, segment clustering — extend for Population·1,000, AudienceLens retrofit, Rewrite loop).

### Cloud / node-graph primitives (the visual substrate — REUSE, do not rebuild)
- `src/components/reading/persona-cloud.tsx` — `PersonaCloud`: static hero dot-cloud with the **`onOpen` seam** (the documented "Phase-3 seam: opens the full PersonaGraph in the DrillSheet") — the v1 mount entry for AudienceLens. Golden-angle Fibonacci layout, SSR-safe.
- `src/components/board/_kit/PersonaGraph.tsx` — the Artificial-Societies node cloud: **200 viewer dots**, nearest-neighbour links, hover/tap detail card, `<animate>` pulse gated on `reducedMotion`, deterministic `mulberry32` seed. The drill-down target + the pattern to scale toward Population·1,000.
- `src/components/board/audience/audience-derive.ts` — `buildPersonaNodes`, `buildSegmentGroups`, `worstBadGroupKey` (the cluster-by-segment + worst-cluster-coral logic).
- `src/components/reading/__tests__/persona-cloud.test.tsx` — cloud render anchors.

### Persona reaction data & prompts (chat grounding + reaction source)
- `src/lib/engine/wave3/persona-registry.ts` — the **10 archetype enum** + byte-stable `ARCHETYPE_DEFINITIONS` (the persona system prompts that ground chat-with-persona; do NOT mutate — cache discipline).
- `src/lib/engine/wave3/persona-prompts.ts`, `persona-prompts-pass2.ts` — persona prompt assembly + per-audience repaint.
- `src/lib/audience/persona-repaint.ts` — per-audience persona description repaint (P7).
- `src/lib/engine/persona-weights.ts` — `PersonaWeights` (drives dot weight → radius + Population proportional distribution).
- `segment_reactions` / `scrollQuote` emitters — `src/app/api/tools/{ideas,hooks,script,refine}/route.ts`, `src/app/api/tools/remix/run/route.ts` (Flash per-persona verdicts; the replay + verbatim + drill data source).

### Chat (the flagship cheatcode — REUSE)
- `src/lib/tools/runners/chat-runner.ts` — the P5 chat-runner; extend to accept persona-grounding context (system prompt + reaction-to-this-concept). Note: `chat` is NOT in the `SkillId` union (`chain-handoff.ts`).

### Chain / thread substrate (Rewrite loop + sub-thread persistence)
- `src/lib/tools/chain-handoff.ts` — `SkillId` union + `CHAIN_HANDOFFS` (the per-thread context-carry the Rewrite-for-audience loop rides; new card + Read in-thread).
- `src/components/thread/*-thread-view.tsx`, `src/components/thread/personas-block.tsx`, the `*-card-block.tsx` family — where AudienceLens mounts inline across the 6 skills + where the sub-thread chat drawer + Rewrite CTA render.
- `src/hooks/queries/use-*-stream.ts` — per-skill streaming hooks (the per-card persona data feeds).

### Audience object (P7 — the substrate scaled by Population)
- `.planning/phases/07-audience-manager-calibrated-audience-as-shared-substrate-acr/07-CONTEXT.md` — the calibrated Audience object (10 personas, Temp×Disposition lens, `PersonaWeights` override, `audience_ids[]`-ready). The 10 personas Population·1,000 instantiates from.

### Upstream Read (P8 — what P9 makes live)
- `.planning/phases/08-discover-remix-read-the-competitor-niche-moat-chain-draft-no/08-CONTEXT.md` — D-08/D-09/D-10/D-11: P8 ships the **static** Read card + verbatim wall + who-it's-NOT-for; explicitly reserves the live interactive cloud for P9. P9 must NOT redesign the Read interpretation/lever — reuse it as the sheet header.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`PersonaCloud.onOpen` seam** — explicitly stubbed as the "Phase-3 seam: opens the full PersonaGraph in the DrillSheet." The single v1 entry point for AudienceLens.
- **`PersonaGraph`** — 200 viewer dots + links + hover/tap card + reduced-motion pulse + deterministic `mulberry32` seed already shipped. Population·1,000 is a scale-up of this exact pattern, not a new build.
- **`chat-runner.ts`** — the flagship chat is an extension (persona-grounding context), not a new runner.
- **Flash per-persona reactions** (verdict / `scrollQuote` / score / archetype) — the data for replay, drill verbatims, swarm sentiment, and chat grounding already emitted by every skill.
- **`buildSegmentGroups` / Temp×Disposition lens** — cluster-by-segment is presentation over existing derivation.
- **`CHAIN_HANDOFFS`** — the Rewrite-for-audience loop reuses the chain plumbing (new card + Read in-thread).

### Established Patterns
- **Deterministic, SSR-safe, hydration-stable layout** (`mulberry32`, golden-angle, no `Math.random`) — Population instantiation MUST follow this (D-02) to stay determinism-gate-safe.
- **`reducedMotion` gating** on pulse/cascade + sr-only mirror (PersonaGraph) — apply to replay + swarm cascade.
- **Byte-stable persona prompts** (cache discipline) — chat grounding reads them, never mutates.
- **Per-thread context carry** — sub-thread chat persistence + Rewrite loop extend this model.
- **Honesty spine** — never fake a crowd, a timeline, or a focus group (drives D-02, D-06).

### Integration Points
- `PersonaCloud onOpen` → AudienceLens sheet (The Read header + replay + cloud + chat + cluster + scale toggle).
- AudienceLens mounts inline on each `*-card-block.tsx` / `personas-block.tsx` across all 6 skills (D-04), degrading where signal is thin.
- Chat drawer → `chat-runner` with persona-grounding context; persisted as a sub-thread.
- Rewrite CTA → originating skill's runner via `CHAIN_HANDOFFS`, lever-as-steering → new card + Read.
- Population aggregate counters = weighted rollup of the 10 (same numbers as Panel, denser visual).

</code_context>

<specifics>
## Specific Ideas

- "The Read leads" — interpretation + the **lever** (what to change) is the top of the sheet, not a chart. Foresight, not data. (Reuse P8's Read.)
- The swarm is honest because Population and Panel are the **same signal at different resolutions** — the aggregate counter is literally the weighted rollup of the 10. Density earns its place; emergence is grounded.
- Chat-with-persona is "ask them why" — the persona answers **in-voice** about THIS concept, not a generic chatbot.
- The Rewrite-for-audience loop **is the product** — closing into regenerate and showing the delta is the flywheel, not a side feature.
- "All 6 skills" is the deliberate full-vision scope (owner override) — one reusable Lens, graceful degradation, rich-signal mount (Test/Read) first.

</specifics>

<deferred>
## Deferred Ideas

- **Population per-dot tap-to-drill** (region → archetype) — v1 drill path is the archetype breakdown; per-dot interactivity is a fast-follow (sketch's own "next refinement").
- **"Ask the whole room" multi-persona chat** — one persona at a time in v1.
- **Synthesized pseudo-timeline for text concepts** — rejected (honesty spine); staggered reveal instead.
- **Desktop docked-pane layout** of the Lens — sketch open item; mobile-first this phase, dense desktop later.
- **Account Read / saved shelf / recalibration flywheel** — Phase 10.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 9-living-audience-interactive-simulation-ux*
*Context gathered: 2026-06-19*
