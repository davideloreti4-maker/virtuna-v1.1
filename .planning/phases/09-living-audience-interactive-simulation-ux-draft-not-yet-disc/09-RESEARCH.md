# Phase 9: Living Audience — interactive simulation UX (AudienceLens) - Research

**Researched:** 2026-06-19
**Domain:** Frontend/interaction (React 19 + Next.js 15 + Tailwind v4) over existing engine/thread infra — REUSE-heavy, near-zero new backend.
**Confidence:** HIGH (every contract below quoted from real source read this session)

## Summary

Phase 9 is a **mount + extend** phase, not a build phase. The visual substrate (`PersonaGraph` 200-dot cloud, deterministic `mulberry32` layout, `reducedMotion` gate, sr-only mirror), the reaction data (two distinct shapes — a real `segment_reactions` *timeline* from the video Test path, and flat `{archetype, verdict, quote}` from every text skill + the text Read), the persona system prompts (`ARCHETYPE_DEFINITIONS`, byte-stable), the chat pipeline (`runChatPipeline`), the chain plumbing (`CHAIN_HANDOFFS`), and the cluster derivation (`buildSegmentGroups` / `worstBadGroupKey`) all already exist and are quoted below. The job is to wire them into one reusable **AudienceLens** sheet, opened via the `PersonaCloud.onOpen` seam, and degrade it feature-by-feature where signal is thin.

**Two findings that change the wave shape:**
1. **`PersonaCloud.onOpen` is a pure stub wired NOWHERE.** The live reading surface (`reading-panels.tsx`) mounts `PersonaGraph` *directly inline* (`<PersonaGraph height={120}>`), not `PersonaCloud`. So the "single v1 entry seam" (D-04) must be *created* — the seam prop exists on `PersonaCloud` but no consumer calls it. Wave 1 must establish the AudienceLens host + the open mechanism, not just reuse it.
2. **The `segment_reactions` *timeline* exists ONLY on the video Test path** (`HeatmapPayload.personas[].attentions[]`, one value per segment, from the wave3 fold). The text Read (`/api/tools/read` → `runTwoAudienceRead`) and ALL text skills (ideas/hooks/script/remix) emit **flat per-persona verdicts only** (`{archetype, verdict: stop|scroll, quote}` + a lead `scrollQuote`) — NO timeline. This is the hard boundary of the degrade-by-feature matrix (D-06): segment-by-segment replay is Test-only; everything else is staggered cascade. Confirmed: `grep segment_reactions` returns zero hits in any text-skill runner.

**Primary recommendation:** Wave the rich-signal mount (video **Test/Reading surface**, which already has the `HeatmapPayload` timeline + already renders `PersonaGraph`) FIRST — it is the only surface that exercises replay, and it already has the cloud on screen. Then mount the flat-signal Lens (staggered cascade) on the text Read card and the four text skills. Treat `chat-runner` persona-grounding extension and Population·1,000 as the two highest-risk new builds and wave them as isolated, test-anchored slices.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AudienceLens sheet shell + scale toggle | Browser/Client | — | Pure interaction over already-fetched card/heatmap data; `'use client'` like all viz |
| Persona cloud render (Panel·10) | Browser/Client | — | SVG + `mulberry32` layout; SSR-safe deterministic, hydration-stable |
| Population·1,000 swarm | Browser/Client | — | Deterministic *visual* instantiation from the 10 (D-02) — ZERO model calls, no API tier |
| Reaction replay (segment timeline) | Browser/Client | API (read-only) | Drives off already-streamed `HeatmapPayload.attentions`; no new fetch |
| Chat-with-persona | API/Backend | Browser/Client | New persona-grounding params on existing `/api/tools/chat` runner (Qwen stream) |
| Sub-thread chat persistence | Database/Storage | API | Hangs off existing thread/message model (`insertMessage`) |
| Rewrite-for-audience loop | API/Backend | Browser/Client | Re-POSTs to originating runner via `CHAIN_HANDOFFS` endpoint; new card + Read in-thread |
| Cluster-by-segment | Browser/Client | — | Presentation over `buildSegmentGroups` (pure, no React, already shipped) |

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Panel·10 core + lean Population, phased within P9):** Waves 1–3 ship the full Panel·10 living experience (Read header reuse P8 + reaction replay + node drill-down + chat-with-persona + cluster-by-segment + Rewrite loop). Final wave ships Population·1,000 as a lean honest v1 (variance scatter + live aggregate counters + cascade-on-play + archetype breakdown with representative verbatims). **Per-dot Population tap-to-drill is DEFERRED** (archetype breakdown is the v1 drill path).
- **D-02 (Deterministic instantiation from the 10 — zero per-dot model calls):** ~1,000 dots distributed proportional to persona weights; each dot = its archetype's real Flash/SIM sentiment + bounded seeded variance via the `mulberry32` pattern already in `PersonaGraph` (no `Math.random`). 30% affinity-neighbour variance = boundary dots blend toward the adjacent archetype. Aggregate counters = a weighted rollup of the 10 (Population and Panel = same signal at different resolutions). Cascade is a deterministic *visual* animation seeded from the same data, NOT a new prediction. Honesty label: "1,000 viewers instantiated from your 10 calibrated archetypes."
- **D-03 (In-context drawer, sub-thread persisted, one persona at a time):** Tap node → "ask them why" opens an in-context drawer/sheet over the cloud, scoped to the current Read — NOT a new top-level thread (`chat` is not in the `SkillId` union). Grounding payload = persona `persona-registry` system prompt + its emitted reaction to this concept (verdict / `scrollQuote` / score) + concept text; answers in-voice via extended `chat-runner.ts`. Persisted as a lightweight sub-thread within that Read. One persona at a time.
- **D-04 (Reusable component, retrofit inline across all 6 skills, degrade by feature):** Build AudienceLens as a genuinely reusable component, mounted inline across all 6 skills (ideas/hooks/script/remix/test/chat) via each card's persona viz + the `PersonaCloud onOpen` seam. Lens degrades feature-by-feature: cloud + node-drill + chat + cluster + Population work everywhere; **replay only where a real segment timeline exists** (Test/Read with `segment_reactions`), staggered reveal elsewhere. Wave rich-signal mount (Test/Read) first.
- **D-05 (Rewrite-for-audience loop):** Sticky "Rewrite for this audience →" routes back to the skill that produced the concept (hook → hooks-runner, remix → remix-runner, etc.), carrying the Read's lever as explicit steering, producing a new card + new Read in-thread via `CHAIN_HANDOFFS`. New Read shows the delta vs prior. Rewrite on a plain chat turn (no regenerable concept) = hidden/disabled (discretion).
- **D-06 (Staggered reveal where no timeline):** Test/Read (has `segment_reactions`) replays segment-by-segment. Text concepts (ideas/hooks/script/remix) have no timeline → personas react in a staggered cascade ordered by sentiment/weight. NO synthesized pseudo-timeline.
- **D-07 (Scale toggle is per-Read, remembers last choice):** Panel·10 ⇄ Population·1,000 toggle lives on each opened Read, defaulting to last-used choice. No global setting surface.

### Claude's Discretion
- Cluster-by-segment grouping — use the existing Temperature × Disposition lens via `buildSegmentGroups`; exact grouping/label presentation is planner discretion.
- Desktop docked-pane layout of the Lens — discretion this phase; mobile-first.
- Swarm animation accessibility — gate cascade/pulse on `reducedMotion`; sr-only mirror of aggregate + archetype breakdown.
- Population dot count (~1,000 nominal) and the 70/30 archetype/variance split tuning — within D-02's deterministic shape.
- Rewrite CTA visibility on non-regenerable surfaces (chat turns) — hide/disable where there's no concept object.
- THEME-06 flat-warm is the design SSOT (cream-alpha, never pure white; coral = weak/worst cluster only).

### Deferred Ideas (OUT OF SCOPE)
- Population per-dot tap-to-drill (region → archetype) — v1 drill path is the archetype breakdown.
- "Ask the whole room" multi-persona chat — one persona at a time in v1.
- Synthesized pseudo-timeline for text concepts — rejected (honesty spine); staggered reveal instead.
- Desktop docked-pane layout — mobile-first this phase.
- Account Read / saved shelf / recalibration flywheel — Phase 10.
</user_constraints>

<phase_requirements>
## Phase Requirements

> **PROVISIONAL — NOT YET FORMALIZED.** ROADMAP §Phase 9 carries draft `LIVE-*` ids ("reaction replay, node drill-down, chat-with-persona, segment clustering. To be formalized at discuss-phase."). `.planning/REQUIREMENTS.md` contains **NO** `LIVE-*` entries yet (`grep LIVE- REQUIREMENTS.md` → zero hits). **The planner/discuss-phase MUST formalize these into REQUIREMENTS.md before locking the plan.** The CONTEXT additional-context note extends the draft set with Population·1,000, AudienceLens retrofit, and Rewrite loop.

| Provisional ID | Description (from ROADMAP draft + CONTEXT) | Research Support |
|----------------|---------------------------------------------|------------------|
| LIVE-01 reaction replay | Cloud reacts as it watches, segment-by-segment | `HeatmapPayload.personas[].attentions[]` per-segment (video Test only); staggered cascade fallback (D-06) |
| LIVE-02 node drill-down | Tap dot → archetype + verbatim reaction | `PersonaGraph` hover/tap pinned detail card (already shipped); verbatim = `quote`/`scrollQuote` |
| LIVE-03 chat-with-persona | Ask archetype why, in-voice | `runChatPipeline` extension + `ARCHETYPE_DEFINITIONS` grounding |
| LIVE-04 segment clustering | Temp × Disposition lens | `buildSegmentGroups` + `worstBadGroupKey` (pure, shipped) |
| LIVE-05 Population·1,000 | Deterministic swarm + counters + cascade | `mulberry32` scatter (D-02); weighted rollup of the 10 |
| LIVE-06 AudienceLens retrofit | One reusable Lens across 6 skills | `PersonaCloud.onOpen` seam (currently a stub — must be wired) |
| LIVE-07 Rewrite-for-audience | Lever-as-steering regenerate loop | `CHAIN_HANDOFFS` endpoint re-POST → new card + Read |
</phase_requirements>

## Standard Stack

**No new packages.** Every dependency this phase needs is already in `package.json` and in active use across 8 shipped phases. The UI-SPEC (checker-approved) confirms: "This phase has NO new design tokens" and "No third-party registries declared."

### Core (all in-repo, REUSE)
| Asset | Location | Purpose | Why Standard |
|-------|----------|---------|--------------|
| `PersonaGraph` | `src/components/board/_kit/PersonaGraph.tsx` | 200-dot cloud, links, hover/tap card, `<animate>` pulse, `mulberry32` | The exact pattern Population·1,000 scales [VERIFIED: source read] |
| `PersonaCloud` | `src/components/reading/persona-cloud.tsx` | Static hero cloud + `onOpen` seam | The v1 Lens entry point (D-04) [VERIFIED: source read] |
| `audience-derive.ts` | `src/components/board/audience/audience-derive.ts` | `buildPersonaNodes`, `buildSegmentGroups`, `worstBadGroupKey` | Cluster lens + worst-cluster coral [VERIFIED: source read] |
| `runChatPipeline` | `src/lib/tools/runners/chat-runner.ts` | P5 Qwen streaming chat | Extend for persona grounding (D-03) [VERIFIED: source read] |
| `CHAIN_HANDOFFS` | `src/lib/tools/chain-handoff.ts` | Skill→skill CTA registry + endpoints | Rewrite loop rides this (D-05) [VERIFIED: source read] |
| `ARCHETYPE_DEFINITIONS` | `src/lib/engine/wave3/persona-registry.ts` | 10 byte-stable persona system prompts | Chat grounding source (D-03) [VERIFIED: source read] |
| `MultiAudienceReadBlock` | `src/lib/tools/blocks.ts` + `multi-audience-read-block.tsx` | P8 static Read card (interpret + lever + drill) | The Lens sheet HEADER (reuse verbatim) [VERIFIED: source read] |

### Supporting (Radix primitives already installed)
| Primitive | Purpose | When to Use |
|-----------|---------|-------------|
| Radix `dialog` / sheet | Lens sheet + chat drawer container | Open over the cloud (D-03) [CITED: UI-SPEC §Design System] |
| Radix `switch` / `tabs` | Panel·10 ⇄ Population·1,000 toggle | Scale toggle (D-07) [CITED: UI-SPEC] |
| `lucide-react ^0.563.0` | Icons | Chrome only [CITED: UI-SPEC] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SVG `<circle>` × 1,000 (Population) | `<canvas>` / WebGL | SVG is what `PersonaGraph` uses; 1,000 nodes is the perf cliff — see Pitfalls. Canvas loses the per-dot hit-testing but D-01 DEFERS per-dot drill, so canvas is viable for the swarm-only render. **Recommend: SVG first, profile, fall to canvas only if jank** |
| Extend `chat-runner` | New persona-chat runner | CONTEXT D-03 + canonical refs explicitly say EXTEND `chat-runner.ts`. Do not fork. |

**Installation:** None. `npm install` adds nothing this phase.

## Package Legitimacy Audit

> **N/A — zero external packages installed this phase.** All UI is built from in-repo primitives + Radix/lucide already in `package.json` (8 phases of prior use). UI-SPEC Registry Safety section: "No third-party registries declared. No `npx shadcn view` vetting required." No legitimacy gate to run.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────┐
   USER taps cloud  ──────▶  PersonaCloud.onOpen()  [SEAM — stub]    │
   (any of 6 skills)        └──────────────────┬──────────────────────┘
                                               ▼
                              ┌────────────────────────────────────┐
                              │           AudienceLens sheet         │  (NEW reusable component)
                              │  ┌──────────────────────────────┐    │
                              │  │ HEADER = P8 Read (reuse)      │    │  interpretation + LEVER
                              │  │  MultiAudienceReadBlock data  │    │  (do NOT redesign)
                              │  └──────────────────────────────┘    │
                              │   scale toggle  Panel·10 ⇄ Pop·1000   │  per-Read, last-used (D-07)
                              │                                       │
   ┌──────────────────────┐  │  ┌─────────────┐   ┌──────────────┐   │
   │ DATA IN (degrade key):│  │  │ Panel·10    │   │ Population    │   │
   │                       │  │  │ PersonaGraph│   │ ·1,000 swarm  │   │
   │ video Test path ──────┼──┼─▶│ + REPLAY    │   │ mulberry32    │   │
   │  HeatmapPayload       │  │  │ (timeline)  │   │ scatter (D-02)│   │
   │  .attentions[]/seg    │  │  └──────┬──────┘   │ + counters    │   │
   │  = ONLY real timeline │  │         │ tap node  │ = weighted    │   │
   │                       │  │         ▼           │   rollup of 10│   │
   │ text Read / 4 skills ─┼──┼──▶ staggered        └──────────────┘   │
   │  {archetype,verdict,  │  │     cascade                            │
   │   quote}+scrollQuote  │  │  ┌──────────────────────────────┐      │
   │  = flat, NO timeline  │  │  │ chat drawer (D-03)           │      │
   └──────────────────────┘  │  │  ground: ARCHETYPE_DEFINITIONS│      │
                              │  │  + reaction-to-this-concept   │──────┼──▶ /api/tools/chat
                              │  │  + concept text → in-voice    │      │    runChatPipeline(EXTENDED)
                              │  │  persisted as SUB-THREAD      │──────┼──▶ insertMessage (existing)
                              │  └──────────────────────────────┘      │
                              │  ┌──────────────────────────────┐      │
                              │  │ sticky "Rewrite for audience"│──────┼──▶ CHAIN_HANDOFFS endpoint
                              │  │  lever-as-steering           │      │    → new card + Read in-thread
                              │  └──────────────────────────────┘      │    → show DELTA vs prior
                              └────────────────────────────────────────┘
```

### Component Responsibilities
| File | Implementation responsibility |
|------|-------------------------------|
| `AudienceLens.tsx` (NEW) | Sheet shell, scale-toggle state (per-Read, last-used), degrade switch on signal shape |
| `PopulationSwarm.tsx` (NEW) | `mulberry32` 1,000-dot scatter, counters = weighted rollup, cascade animation, sr-only mirror |
| `PersonaGraph.tsx` (reuse + extend) | Panel·10 render; add replay-driven attention animation (timeline) |
| `multi-audience-read-block.tsx` (reuse) | The sheet header (interpret + lever) — render inside the Lens, do NOT modify |
| `chat-runner.ts` (extend) | New `PersonaGroundingInput` params; persona system prompt + reaction context |
| each `*-card-block.tsx` (mount point) | Host the `onOpen`-wired cloud inline per skill |

### Recommended Project Structure
```
src/components/
├── audience-lens/              # NEW — the reusable Lens
│   ├── AudienceLens.tsx        #   sheet shell + scale toggle + degrade switch
│   ├── PopulationSwarm.tsx     #   1,000-dot deterministic swarm (D-02)
│   ├── PersonaChatDrawer.tsx   #   in-context chat drawer (D-03)
│   ├── ReplayController.tsx    #   replay (timeline) / cascade (flat) controller
│   └── lens-derive.ts          #   PURE: instantiate 1,000 from 10, weighted rollup, cascade order
├── board/_kit/PersonaGraph.tsx # REUSE (Panel·10) — extend with replay attention anim
└── reading/persona-cloud.tsx   # REUSE — the onOpen seam to wire
```

### Pattern 1: Deterministic seeded layout (the load-bearing pattern)
**What:** All dot geometry uses `mulberry32(seed)` — never `Math.random` — so SSR === client and the engine-determinism gate holds.
**When to use:** Population·1,000 scatter, cascade ordering, any per-dot variance.
**Example:**
```typescript
// Source: src/components/board/_kit/PersonaGraph.tsx L43-51 (VERIFIED)
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Per-persona seeding pattern (L95): const rnd = mulberry32(9173 + i * 31337);
// Gaussian scatter (L100-103): Box-Muller from two rnd() draws — REUSE for 1,000-dot swarm.
```

### Pattern 2: Weighted rollup = same signal, two resolutions (D-02 honesty)
**What:** Population counters are NOT a new aggregate — they are `buildSegmentGroups`/`buildPersonaNodes` weight × the 10's real verdicts. Panel·10 and Population·1,000 must render identical aggregate numbers.
**When to use:** Population live counters; the "1,000 viewers instantiated" label.
```typescript
// Source: audience-derive.ts buildPersonaNodes L422 + persona weights drive both
// node radius (Panel) AND proportional dot count (Population). Reuse the SAME nodes[].
```

### Pattern 3: onOpen interactive seam (the entry mechanism)
```typescript
// Source: persona-cloud.tsx L42, L76-95 (VERIFIED) — seam EXISTS, wired NOWHERE.
export function PersonaCloud({ heatmap, simResults, onOpen }: PersonaCloudProps) {
  const interactive = typeof onOpen === 'function';
  // role='button', tabIndex, Enter/Space keydown, ≥44px minHeight already implemented.
  // P9 job: pass onOpen={() => openLens(readData)} from each mount surface.
}
```

### Anti-Patterns to Avoid
- **`Math.random()` anywhere in dot/cascade geometry** — breaks SSR hydration AND the engine-determinism gate (D-02). Use `mulberry32`.
- **Re-rolling band/aggregate math for Population** — D-02 says weighted rollup of the existing 10. `two-audience-read.ts` comment: "reuse the band math (do NOT re-roll)."
- **Mutating `ARCHETYPE_DEFINITIONS`** — byte-stable for cache discipline (registry header: "changing a single character invalidates the cache prefix"). Chat grounding READS, never writes.
- **Synthesizing a pseudo-timeline for text concepts** — D-06 honesty spine. Flat skills cascade; they do not fake segments.
- **Adding `"chat"` to the `SkillId` union** — D-03: chat-with-persona is a sub-thread within the Read, NOT a top-level skill thread. `chat` is deliberately absent from the union.
- **Recoloring the inherited P8 Read** — UI-SPEC: reuse P8's lever treatment verbatim.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deterministic dot scatter | Custom RNG / `Math.random` | `mulberry32` + Box-Muller already in PersonaGraph | SSR + determinism gate safety |
| Persona → node mapping | New mapper | `buildPersonaNodes(heatmap, simResults, badKey)` | Handles sim-vs-heatmap join, weight normalization, tone |
| Worst-cluster coral | New threshold logic | `worstBadGroupKey(buildSegmentGroups(...))` | ≤2 coral marks, <40% rule already encoded |
| Temp×Disposition clustering | New grouping | `buildSegmentGroups` (4-slot fold) | Pure, unit-tested, slot-drift handled |
| Chat streaming | New SSE pipeline | `runChatPipeline(input, onToken)` | Qwen-only, timeout, abort, cold-start already handled |
| Skill→skill regenerate | New routing | `CHAIN_HANDOFFS` + `handoffsFor(skill)` | Endpoint registry is the SSOT; Rewrite appends one entry shape |
| Read interpretation + lever | New card | `multi-audience-read-block.tsx` | P8 shipped it; P9 reuses as header (D-01 boundary) |

**Key insight:** The "new code" surface area is tiny — one Lens shell, one Population swarm, one chat-runner param extension, one CHAIN_HANDOFFS Rewrite entry. Everything else is composition of shipped pure functions. The risk is in the *wiring* (the stubbed `onOpen` seam, sub-thread persistence) and the *perf* (1,000 SVG nodes), not in the algorithms.

## Runtime State Inventory

> Not a rename/refactor/migration phase — N/A. One forward-looking note: sub-thread chat persistence (D-03) adds message rows under an existing Read; verify the thread/message schema (`insertMessage` in `src/lib/threads/messages.ts`) can carry a sub-thread parent ref without a migration, or scope a tiny additive migration. **Flag for planner: confirm the message model supports a sub-thread parent key before locking the chat-persistence task.**

## Common Pitfalls

### Pitfall 1: The `onOpen` seam is a stub — there is no live Lens to "reuse"
**What goes wrong:** Planner assumes `PersonaCloud.onOpen` already opens something. It does not. `grep` shows `onOpen` is implemented on `PersonaCloud` and `ScoreGauge` but **no consumer ever passes it**, and the live reading surface mounts `PersonaGraph` directly (`reading-panels.tsx:205 <PersonaGraph height={120}>`), not `PersonaCloud`.
**How to avoid:** Wave 1 must (a) build the AudienceLens host, (b) decide whether the Test surface opens it from the existing inline `PersonaGraph` or swaps to `PersonaCloud`+`onOpen`, (c) wire `onOpen` at every mount surface. This is net-new wiring, budget for it.
**Warning signs:** A task that says "reuse the existing Lens open" — there isn't one.

### Pitfall 2: 1,000 SVG `<circle>` nodes — render + animation cost
**What goes wrong:** `PersonaGraph` renders 200 dots fine. 1,000 dots × an `<animate>` pulse each (5× the count) can jank on mobile, especially with the cascade. The current pulse is a per-circle SMIL `<animate>` (L207) — 1,000 SMIL animations is a known perf cliff.
**How to avoid:** For Population, (a) render dots as a single batched layer, (b) drive the cascade via one CSS/JS timeline (staggered opacity), NOT 1,000 SMIL elements, (c) gate ALL motion on `reducedMotion` (static render is the a11y + perf floor), (d) profile on a real mobile viewport. If SVG janks, the swarm-only render (no per-dot hit area — D-01 defers per-dot drill) is canvas-eligible.
**Warning signs:** Dropped frames on the cascade; main-thread blocking on Lens open.

### Pitfall 3: Hydration mismatch from non-deterministic geometry
**What goes wrong:** Any `Math.random`/`Date.now`/locale-dependent value in dot layout → server HTML ≠ client → React hydration error + the determinism gate fails.
**How to avoid:** `mulberry32` only, seeded from stable data (persona index, concept id). The existing cloud is "copied verbatim (SSR-safe, hydration-stable, no Math.random)" — keep that discipline for the 1,000-dot scale-up.

### Pitfall 4: Tailwind v4 oklch + backdrop-filter caveats (project-specific)
**What goes wrong:** (per CLAUDE.md) Very dark colors (L<0.15) compile wrong in `@theme`; Lightning CSS strips `backdrop-filter` from classes.
**How to avoid:** The Lens uses charcoal surfaces (`--color-charcoal-app` #262624, L≈0.27 — safe) and is flat-matte (no glass per UI-SPEC) — so the backdrop-filter trap is largely avoided by design. If any blur is added, apply via React inline `style={{ backdropFilter }}`, not a class.

### Pitfall 5: Persona-registry cache invalidation from chat grounding
**What goes wrong:** Building chat grounding by *editing* `ARCHETYPE_DEFINITIONS` text invalidates the whole engine cache prefix (registry warns explicitly).
**How to avoid:** Read `ARCHETYPE_DEFINITIONS[archetype]` and `ARCHETYPE_TRIGGERS[archetype]` as inputs to a *new* grounding string assembled in the chat-runner extension; never mutate the source module.

## Code Examples

### Reaction data — the two shapes (the degrade-matrix key)
```typescript
// SHAPE A — video Test path: REAL timeline (segment_reactions).
// Source: src/lib/engine/types.ts HeatmapPayload L50-57 (VERIFIED)
personas: Array<{
  id: string;
  slot_type: 'fyp' | 'niche' | 'loyalist' | 'cross_niche';
  archetype?: string;
  attentions: number[];                    // length === segments.length  ← THE TIMELINE
  swipe_predicted_at: number | null;
  segment_reasons: Record<number, string>; // sparse, inflection points
}>;
// → enables LIVE-01 segment-by-segment replay. ONLY this surface has it.

// SHAPE B — text Read + all 4 text skills: FLAT verdicts, NO timeline.
// Source: src/lib/tools/blocks.ts PersonasBlockSchema L50-61 + MultiAudienceReadBlock L307-313 (VERIFIED)
personas: z.array(z.object({
  archetype: z.string(),
  verdict: z.enum(["stop", "scroll"]),
  quote: z.string().min(1).max(160),       // the verbatim for node drill
}));
// + a lead per-card `scrollQuote: z.string()` (ideas/hooks/script/remix card blocks)
// → enables LIVE-02 drill + cascade, NOT replay. Staggered reveal ordered by verdict/weight (D-06).
```

### chat-runner extension surface (D-03)
```typescript
// Source: src/lib/tools/runners/chat-runner.ts L46-64 (VERIFIED) — current input:
export interface ChatPipelineInput {
  ask: string;
  platform: AssemblerInput["platform"];
  profileRow: ProfileRow | null;
  priorTurns?: Array<{ role: "user" | "assistant"; text: string }>;
  audience?: Audience | null;
}
// P9 ADD (D-03) — additive optional field, byte-identical for non-persona chat:
//   personaGrounding?: {
//     archetype: Archetype;                  // ARCHETYPE_DEFINITIONS lookup key
//     reactionToConcept: { verdict: "stop"|"scroll"; quote: string };  // from Shape B
//     conceptText: string;
//   }
// When present: prepend the persona system prompt + reaction context to the assembled
// bundle so Qwen answers IN-VOICE. The stream/timeout/abort machinery (L168-205) is UNTOUCHED.
```

### Rewrite loop via CHAIN_HANDOFFS (D-05)
```typescript
// Source: chain-handoff.ts (VERIFIED) — endpoints already mapped per skill:
//   hooks→script  /api/tools/script         (anchorFrom "card")
//   remix→hooks   /api/tools/ideas/develop  (anchorFrom "card")
//   idea→hooks    /api/tools/ideas/develop
//   hooks→test    null (HookTestContext)    (anchorFrom "context")
// P9 Rewrite = re-POST to the ORIGINATING skill's own runner with lever-as-steering.
// Likely ADD: one or more "rewrite" handoff entries (from: <skill>, to: <same skill>,
//   ctaLabel: "Rewrite for this audience →", endpoint: <originating route>, anchorFrom: "card").
// The lever string (from the Read header) is injected as the steering anchor; the new
// card streams in-thread; the Lens shows the delta vs the prior Read.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static persona cloud (PersonaCloud, one dot/persona) | Live interrogable AudienceLens | P9 (this phase) | Cloud becomes the entry to replay/chat/scale |
| P8 static Read card (interpret + lever) | Same card reused as Lens header | P8→P9 | Read NOT redesigned (D-01); made live around it |
| `chat-runner` profile-grounded only | + optional persona-grounding | P9 | One additive param, no fork |

**Deprecated/outdated:** none relevant. Note `PersonaCloud` is the *newer, lighter* descendant of `PersonaGraph` (one dot/persona, no canvas) — for Panel·10 the richer `PersonaGraph` (200 dots, links, hover card) is the better base; `PersonaCloud` is the hero/entry surface.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sub-thread chat persistence fits the existing thread/message model without a schema migration | Runtime State Inventory | If a migration is needed, the chat-persistence task is larger; planner must verify `insertMessage` parent-ref support |
| A2 | Rewrite loop adds same-skill `CHAIN_HANDOFFS` entries (from===to) and re-POSTs to the originating route | Code Examples / D-05 | If runners reject a self-handoff or need a new endpoint, the loop is more than a registry append |
| A3 | 1,000 SVG nodes are renderable mobile-first with a single batched motion timeline (not 1,000 SMIL) | Pitfall 2 | If SVG janks, swarm falls to canvas — a bigger build than D-02 implies |
| A4 | The video Test/Reading surface is where rich-signal replay mounts (it already has `HeatmapPayload` + an on-screen `PersonaGraph`) | Wave suggestion | If the intended "Read" surface for replay is the text Read (no timeline), replay has no data — re-confirm at discuss-phase |

## Open Questions

1. **Which concrete surface is the rich-signal "Test/Read" mount? — (RESOLVED at plan: video-Test-surface-only; 09-02 mounts the Lens on the video Test/Reading surface, text Read joins the cascade bucket.)**
   - What we know: only the video Test path (`use-analysis-stream.ts` → `HeatmapPayload.attentions[]`) carries a real segment timeline; the text `/api/tools/read` Read does NOT.
   - What's unclear: CONTEXT says "Test/Read with `segment_reactions`" as one bucket — but the text Read has no `segment_reactions`. Replay = video-Test-only; the text Read cascades like the text skills.
   - Recommendation: formalize replay as **video-Test-surface-only**; the text Read joins the staggered-cascade bucket. Wave 1 = the video Test/Reading surface (already renders `PersonaGraph`).

2. **Sub-thread persistence model (A1). — (RESOLVED at plan: 09-03 T2 verifies the threads_messages model FIRST; resolves via a `persona-chat-turn` typed block in the existing grounded thread — NO migration, with a conditional [BLOCKING] `supabase db push` only if proven otherwise.)** Verify `insertMessage` / thread schema before the chat-persistence task is planned.

3. **Rewrite self-handoff (A2). — (RESOLVED at plan: 09-04 T2 confirms originating runners accept a lever-steered re-POST self-handoff via `CHAIN_HANDOFFS`.)** Confirm originating runners accept a lever-steered re-POST.

## Environment Availability

> Pure client/UI + existing API extension; no new external tools, services, or runtimes. Qwen client (`getQwenClient`) already wired for the chat path. **No environment audit blocking items.**

## Validation Architecture

> **`workflow.nyquist_validation` is `false` in `.planning/config.json` — section is INFORMATIONAL/OPTIONAL only.** Not required this phase.

The project ships a Vitest suite (`*.test.tsx`/`*.test.ts`, `npm test`, `npm run lint`, `npm run build` per CLAUDE.md). Existing anchors the planner should keep green and extend:
- `src/components/reading/__tests__/persona-cloud.test.tsx` — cloud render anchors (extend for the Lens-open seam).
- `src/lib/tools/runners/__tests__/*` + `chain-handoff.test.ts` (payload-contract) — extend for the chat-runner persona-grounding param and the Rewrite handoff entry.
- Pure-function tests: `audience-derive` selectors and any new `lens-derive.ts` (1,000-from-10 instantiation, weighted rollup, cascade order) should be unit-tested in isolation — they are pure by design.
- Determinism assertion: a test that the 1,000-dot layout is byte-identical across two calls with the same seed (guards Pitfall 3 + the determinism gate).

## Security Domain

> `security_enforcement` is `false` in `.planning/config.json` — section omitted per protocol. One inherited guardrail to preserve: server-side concept/anchor length caps already enforced on each route (`chain-handoff.ts` security note: "anchor length is capped server-side on each endpoint (WARNING-5)"). The Rewrite re-POST rides the same capped endpoints — no new boundary. `assembleBundle` fences user content in `<<<USER_CONTENT>>>` (injection-safe) — the persona-grounding chat extension must route the concept/quote through the same fenced anchor, not raw into the system prompt.

---

## Deliverable: Reuse-Contract Table (per build area)

| # | Build area | Real file(s) | Real signature / seam | TOUCHES | LEAVES ALONE |
|---|-----------|--------------|-----------------------|---------|--------------|
| 1 | Persona cloud (Panel·10) | `board/_kit/PersonaGraph.tsx` | `PersonaGraph({ personas: PersonaNode[]; height?; reducedMotion?; className? })`; `PersonaNode = {id,label,weight,watchThrough,segment?,dropAt?,tone?}`; `mulberry32(9173+i*31337)`; 200 dots; `<animate>` gated on `reducedMotion`; sr-only `<ul>` | ADD replay-driven attention animation; possibly accept a timeline prop | Layout math, hover/tap pinned card, link drawing, seed plumbing |
| 2 | Lens entry seam | `reading/persona-cloud.tsx` | `PersonaCloud({ heatmap, simResults, onOpen? })`; `onOpen` makes it `role=button`, ≥44px, Enter/Space — **wired NOWHERE** | WIRE `onOpen` at every mount surface → opens AudienceLens | The SSR-safe layout, the empty-personas degrade (`return null`) |
| 3 | Cluster + worst-cluster | `board/audience/audience-derive.ts` | `buildSegmentGroups(heatmap, simResults): SegmentGroup[]` ({key,label,pct,desc,count}); `worstBadGroupKey(groups): SlotKey\|null` (<40% rule); `buildPersonaNodes(heatmap, simResults, badKey): PersonaNode[]` | CALL these for cluster lens + Population proportional distribution | The functions themselves (pure, shipped) — presentation only on top |
| 4 | Chat-with-persona | `lib/tools/runners/chat-runner.ts` | `runChatPipeline(input: ChatPipelineInput, onToken): Promise<{fullContent,coldStart}>`; streams Qwen `QWEN_REASONING_MODEL` temp 0.3 | ADD optional `personaGrounding` field → prepend persona prompt + reaction context | Stream/timeout/abort (L168-205), `isColdStart`, assembler fence |
| 5 | Reaction data source | `lib/engine/types.ts` (HeatmapPayload), `lib/tools/blocks.ts` (PersonasBlock/MultiAudienceReadBlock), `lib/engine/flash/two-audience-read.ts` | Shape A: `HeatmapPayload.personas[].attentions[]` (timeline, Test only). Shape B: `{archetype,verdict,quote}` + `scrollQuote` (flat, text Read + 4 skills) | READ both shapes; branch the Lens on which is present | Emitter routes/runners — read-only consumption |
| 6 | Rewrite loop / chain | `lib/tools/chain-handoff.ts` | `SkillId` union (no `chat`); `CHAIN_HANDOFFS: ChainHandoff[]` ({from,to,ctaLabel,endpoint,anchorFrom}); `handoffsFor(skill)` | ADD Rewrite handoff entry(ies); inject lever as steering anchor | Existing handoff entries, the registry shape |
| 7 | Mount surfaces | `components/thread/*-card-block.tsx`, `personas-block.tsx`, `reading/reading-panels.tsx`; `hooks/queries/use-*-stream.ts` | Card blocks render `{scrollQuote, personas[]}`; `reading-panels.tsx:205` mounts `<PersonaGraph>` inline; stream hooks feed per-card persona data | MOUNT the `onOpen`-wired cloud inline per skill; pass each card's persona data to the Lens | Card layouts, stream-hook contracts |

## Deliverable: Degrade-by-Feature Matrix

> Driven by what each surface actually emits (grep-verified: zero `segment_reactions` in any text-skill runner).

| Surface | Reaction shape | Replay (D-06) | Node drill | Chat | Cluster | Population | Rewrite |
|---------|----------------|---------------|------------|------|---------|-----------|---------|
| **Video Test / Reading** | A: `HeatmapPayload.attentions[]` (REAL timeline) | ✅ segment-by-segment | ✅ | ✅ | ✅ | ✅ | n/a (not a regenerable text concept) |
| **Text Read** (`/api/tools/read`) | B: flat `{archetype,verdict,quote}` (NO timeline) | cascade only | ✅ | ✅ | ✅ | ✅ | ✅ (re-run Read) |
| **Hooks** | B: `scrollQuote` + verdict | cascade only | ✅ | ✅ | ✅ | ✅ | ✅ (hooks-runner) |
| **Ideas** | B | cascade only | ✅ | ✅ | ✅ | ✅ | ✅ (ideas-runner) |
| **Script** | B | cascade only | ✅ | ✅ | ✅ | ✅ | ✅ (script-runner) |
| **Remix** | B | cascade only | ✅ | ✅ | ✅ | ✅ | ✅ (remix-runner) |
| **Chat turn** | none (no concept object) | — | — | (is itself chat) | — | — | ❌ hidden (D-05 discretion) |

**Rule:** Replay (true segment-by-segment) = the **video Test surface only**. Every other surface degrades to staggered cascade ordered by verdict/weight. Population instantiates from the 10 and is available everywhere (D-02). Cloud/drill/chat/cluster are universal.

## Deliverable: Wave / Dependency Suggestion

| Wave | Ships | Why this order | Risk |
|------|-------|----------------|------|
| **W1 — Lens shell + rich-signal mount** | AudienceLens host; wire `onOpen` on the video Test/Reading surface (it already renders `PersonaGraph` + has the `HeatmapPayload` timeline); reuse `multi-audience-read-block` as header; node drill-down; **reaction replay (timeline)** | Rich-signal first (D-04); the only surface that exercises replay; establishes the reusable shell + the stubbed seam | The seam is net-new wiring (Pitfall 1) |
| **W2 — Chat-with-persona** | `chat-runner` persona-grounding extension; in-context drawer; sub-thread persistence | Flagship cheatcode; isolated, test-anchored; depends on W1 shell + drill | HIGH — sub-thread persistence (A1), grounding without cache mutation (Pitfall 5) |
| **W3 — Cluster + Rewrite loop + thin-signal mounts** | Cluster-by-segment (`buildSegmentGroups`); Rewrite CTA via `CHAIN_HANDOFFS` (delta vs prior); mount the Lens (staggered cascade) on text Read + ideas/hooks/script/remix | Thin-signal skills follow rich (D-04); Rewrite needs the Lens header (lever) from W1 | Rewrite self-handoff (A2) |
| **W4 — Population·1,000** | Deterministic swarm (`mulberry32` scale-up), live counters (weighted rollup), cascade-on-play, archetype breakdown; scale toggle (per-Read, last-used) | Lean honest v1 (D-01); riskiest perf; depends on cluster + cloud from prior waves | HIGH — 1,000-node perf (Pitfall 2), determinism at scale (Pitfall 3) |

**Two highest-risk new builds (isolate + test-anchor):** W2 `chat-runner` persona-grounding extension, and W4 Population·1,000. Everything else is composition of shipped pure functions.

## Landmines (consolidated)

1. **`onOpen` is a stub** — no live Lens exists to reuse; the seam must be wired (Pitfall 1).
2. **SSR/hydration determinism** — `mulberry32` only, no `Math.random`/`Date.now` in any geometry (Pitfall 3, D-02).
3. **Engine-determinism gate** — Population must make ZERO model calls; it is a deterministic *visual* over the 10's real verdicts (D-02). STATE: same-video score-identity protected; Population is presentation, must not touch the scoring path.
4. **Persona-registry byte-stability** — chat grounding READS `ARCHETYPE_DEFINITIONS`, never mutates (Pitfall 5).
5. **`reducedMotion` a11y** — gate replay + cascade + pulse; sr-only aggregate + archetype-breakdown mirror always present (UI-SPEC).
6. **Tailwind v4 oklch / backdrop-filter** — Lens is flat-matte (no glass) so largely avoided; if blur added, inline `style`, not class (Pitfall 4, CLAUDE.md).
7. **1,000 SVG nodes perf** — single batched motion timeline, profile mobile, canvas fallback eligible (Pitfall 2).
8. **`chat` not in `SkillId` union** — sub-thread within the Read, not a top-level thread (D-03).
9. **Don't redesign the P8 Read** — reuse `multi-audience-read-block` + its lever treatment verbatim (D-01).

## Sources

### Primary (HIGH confidence — source read this session)
- `src/components/board/_kit/PersonaGraph.tsx` — full component, `mulberry32`, layout, pulse, sr-only.
- `src/components/reading/persona-cloud.tsx` — `onOpen` seam (verified wired nowhere).
- `src/components/board/audience/audience-derive.ts` — `buildPersonaNodes`/`buildSegmentGroups`/`worstBadGroupKey` signatures.
- `src/lib/tools/runners/chat-runner.ts` — `runChatPipeline` / `ChatPipelineInput`.
- `src/lib/tools/chain-handoff.ts` — `SkillId` union, `CHAIN_HANDOFFS`, endpoints.
- `src/lib/engine/wave3/persona-registry.ts` — `ARCHETYPE_DEFINITIONS` (byte-stable), `ARCHETYPE_TRIGGERS`.
- `src/lib/tools/blocks.ts` — `PersonasBlock`, `MultiAudienceReadBlock`, card `scrollQuote` shapes.
- `src/lib/engine/types.ts` — `HeatmapPayload` (timeline shape), `PersonaSimulationResult`.
- `src/lib/engine/wave3/fold.ts` — `segment_reactions: {attention}[]` (the only real timeline).
- `src/lib/engine/flash/two-audience-read.ts` — text Read = flat verdicts, no timeline.
- `src/components/thread/hook-card-block.tsx`, `personas-block.tsx`, `multi-audience-read-block.tsx` — mount surfaces + static Read card.
- `src/app/api/tools/read/route.ts` — Read emits `multi-audience-read` block on a text concept.
- `src/app/globals.css` — all UI-SPEC tokens confirmed present (charcoal-app, coral-500, cream-muted, success/warning/error, surface, hover/active, shadow-float/button, spacing-*, text-*).
- `.planning/config.json` — `nyquist_validation: false`, `security_enforcement: false`.
- `.planning/STATE.md` — Hard Constraints (engine OPEN + regression-gate, Qwen-only, determinism).

### Secondary (MEDIUM)
- `09-CONTEXT.md` (D-01..D-07 locked), `09-UI-SPEC.md` (approved tokens/copy/interaction).
- `.planning/ROADMAP.md` §Phase 9 (provisional LIVE-* draft).

## Metadata

**Confidence breakdown:**
- Reuse contracts (7 areas): HIGH — every signature quoted from source read this session.
- Degrade matrix: HIGH — timeline-vs-flat distinction grep-confirmed (zero `segment_reactions` in text runners).
- Wave suggestion: MEDIUM — depends on confirming the rich-signal surface (A4/OQ-1) at discuss-phase.
- Perf (1,000 nodes): MEDIUM — known SVG cliff, not yet profiled (A3).
- Persistence/Rewrite plumbing: MEDIUM — additive but unverified at the schema/runner boundary (A1/A2).

**Research date:** 2026-06-19
**Valid until:** ~2026-07-19 (stable — in-repo contracts; revalidate if the thread/message model or PersonaGraph changes).
