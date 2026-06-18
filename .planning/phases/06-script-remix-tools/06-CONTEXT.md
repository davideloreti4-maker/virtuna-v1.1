# Phase 6: Script & Remix Tools - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the two remaining generative skills that plug into the P5 chain plumbing, each earning its own success-criteria gate (as Ideas/Hooks did):

1. **Script** (SCRIPT-01) — mid-chain. From a chosen hook (or a topic) → **one script card** (beats + timing + per-beat retention markers), content-first with a SIM-1 Flash viability beat + self-judge gate, sitting **hooks → script → test**, landing on "Test full →".
2. **Remix** (REMIX-01) — alternate funnel-top entry. Paste a **trending/competitor URL** (the FYP-video-I-want-to-redo flow) → **decode why it worked** (real structural anatomy) → generate **the creator's niche/voice version** (new hook + script angle) → Flash score → feed the **Hooks/Test** chain.

Both run the Qwen pipeline + SIM-1 Flash gate, both mirror the ideas/hooks runner pattern (content-first stream → self-judge gate → legible grounding → typed card → chain CTA), both register in `CHAIN_HANDOFFS` (filling the pre-staged hooks→script, script→test, remix→hooks placeholders) and join the fixed block-registry as new typed card blocks.

**Requirements (locked by ROADMAP/REQUIREMENTS):** SCRIPT-01, REMIX-01.

**In scope:** Script generate-mode (hook→script→test, one script card, hook-beat Flash gate); Remix URL-entry (resolve → real structural decode → niche adapt → Flash → feed Hooks); new thread typed-card blocks for both; CHAIN_HANDOFFS endpoint/renderer wiring; a mandated reuse-scout of the existing remix engine before any remix build.

**Out of scope (this phase):** Script **Diagnose mode** (paste existing script → line-edits + drop-point) → v6.1; Remix **own-winner entry** (pick from creator's prior Readings) → v6.1; any change to the protected SIM-1 Max video-scoring path (`ENGINE_VERSION` unchanged); concept/script text pre-flight as a standalone mode; in-thread monetization, brand-profile, RAG-over-history (v6.1+).
</domain>

<decisions>
## Implementation Decisions

### Area 1 — Script: SIM-test granularity (the moat on a non-hook output)
- **D-01 (Flash scores the hook beat only):** A script is not a first-2s hook, so SIM-1 Flash scores **only the opening hook beat** — reusing the **exact proven Hooks gate** (first-2s "do you stop scrolling?" framing). Honest claim ("this script's opener stops the scroll"), cheapest, **zero new SIM calibration**. The rest of the script's quality is caught by the **bounded self-judge gate** (same as Ideas/Hooks), not a fabricated full-watch score. Honesty spine intact — Flash was built for scroll-stop, never claims to predict full retention.
- **D-02 (Card anatomy — bounded by SCRIPT-01, planner discretion within):** The script card carries **beats + per-beat timing + per-beat retention markers** (the "why this beat holds attention" line per beat). **One script per run** (not N cards like Hooks). Lands on **"Test full →"** carrying the script as the brief into the Test reframe. Exact beat schema / retention-marker copy is planner discretion within this shape.

### Area 2 — Script: Diagnose mode scope
- **D-03 (Diagnose deferred to v6.1):** P6 ships **generate-only** (hook→script→test). The paste-existing-script Diagnose mode (line-edits + drop-point) is a **distinct input path + different UX** — deferred to keep the phase tight and earn the gate on the core chain first (same split discipline that broke the mega-phases apart). Already noted deferred in STATE.

### Area 3 — Remix: entry path (owner override)
- **D-04 (URL entry is the hero; own-winner deferred):** Owner reframed REMIX-01's two entries to a **single high-value path: the pasted trending/competitor URL** — "creator sees a video on their FYP → wants to redo it for their own account." This is the funnel-top entry P6 ships. The **own-winner entry** (pick from the creator's prior Readings) is **deferred to v6.1** — a separate picker UX; keep P6 focused on making the URL path excellent.

### Area 4 — Remix: decode depth
- **D-05 (Resolve + real structural decode — "detailed" = decode the real video):** For a pasted URL, Remix **resolves the video** (reuse `engine/remix/resolve-and-rehost.ts`, URL→video) then runs the **real structural decode** (hook pattern, structure, the turn, emotional beat — the actual anatomy via `engine/remix/decode.ts`), then **adapts to the creator's niche/voice** (`engine/remix/adapt.ts`) → Flash score → feed Hooks. "Detailed/high-value" means decoding the **actual video**, not metadata/transcript guesses (which would be a generic rewrite, weak moat). Accepted heavier latency (video fetch + decode) as the value.
- **D-05a (decode-vs-protected-path — MUST resolve in scout):** The reuse-scout MUST confirm whether `decode.ts` requires a **full SIM-1 Max Reading** (which would touch the protected video-scoring path) or runs on the resolved video directly. Reuse must be **read-only over the protected path** — no `ENGINE_VERSION` bump, engine suite stays green, same-video Max score-identity preserved. Flag loudly if decode can't run without the protected pipeline.

### Area 5 — Remix: reuse scope
- **D-06 (Scout first; direction = revive engine logic + new thread card):** REQUIREMENTS mandates a **reuse scout** before any remix build. The reuse-scout task reads `src/lib/engine/remix/*` + `src/app/api/remix/adapt/route.ts` + the `milestone/viral-remix` / `viral-remix-adapt` worktrees, then confirms seams. **Working direction (revive, don't rebuild):** keep the `engine/remix` decode+adapt **logic**, **drop the dead old-board UI** (`components/board/adapt/AdaptConceptCard.tsx`, `RemixedFromChip.tsx` — pre-numen-rework), and build a **new thread `remix-card` typed block** wired to the `remix→hooks` CTA. The scout confirms how far the existing pipeline is reusable vs needs a thin text-first wrapper.

### Area 6 — Chain wiring & sequencing
- **D-07 (Fill the P5 placeholders — zero structural plumbing):** Both skills register by **appending** to the existing `CHAIN_HANDOFFS` registry (the placeholders `hooks→script`, `script→test`, `remix→hooks` are pre-staged). Add `"script" | "remix"` to the `SkillId` union, set each placeholder's `endpoint` (script route, remix route) or context-handoff (`script→test` mirrors the `hooks→test` HookTestContext pattern), implement the runner + register the new typed card block. No edits to existing card components.

### Claude's Discretion
- Exact script beat schema, timing units, and retention-marker copy (within D-02's beats+timing+retention shape).
- Whether the Remix runner reuses the `/api/remix/adapt` route as-is or gets a new `/api/tools/remix/*` route fitting the tools convention (decide post-scout, D-06).
- Remix output cardinality into Hooks (the existing adapt generates 3 concepts; for the studio thread, decide 1 chosen remix card → Hooks vs a small ranked set — keep consistent with the one-card-per-run studio feel unless scout shows otherwise).
- **Phase sequencing (recommendation):** ship **Script first** (greenfield, mirrors the proven Hooks pattern closely, fast spine win) then **Remix** (scout-heavy, revive existing engine). Planner may parallelize the disjoint files.
- THEME-06 flat-warm visual system is the design SSOT for both new card blocks + any progress affordance.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope & constraints
- `.planning/ROADMAP.md` §Phase 6 — goal: "Script (hook→script→test) + Remix (alt funnel-top: trending/own-winner → ideas/hooks), both on the same Qwen pipeline as Test, plugging into P5's chain plumbing."
- `.planning/REQUIREMENTS.md` — **SCRIPT-01, REMIX-01** (REMIX-01 explicitly mandates "Preceded by a reuse scout of `milestone/viral-remix` + `viral-remix-adapt` + `src/app/api/remix/adapt/` — revive, don't rebuild"); plus THREAD-06 (tool-runner), STUDIO-03 (CHAIN_HANDOFFS SSOT) + cross-cutting constraints (honesty spine, bounded cost, engine-open-but-protected, Qwen-only, fixed renderers, THEME-06).
- `.planning/STATE.md` — Hard Constraints (engine regression gate, Qwen-only, fixed typed renderers, flat-warm SSOT) + Deferred Items (Diagnose mode, own-winner now confirmed v6.1 per D-03/D-04).
- `.planning/PROJECT.md` — milestone identity + locked constraints.

### The chain plumbing P6 plugs into (P5 — built for this)
- `src/lib/tools/chain-handoff.ts` — the `CHAIN_HANDOFFS` SSOT with **pre-staged P6 placeholders** (`hooks→script`, `script→test`, `remix→hooks`); the file's header documents the exact 4-step extend procedure (D-07). Append-only; no structural edits.
- `.planning/phases/05-open-chat-test-reframe/05-CONTEXT.md` — D-00 (this phase's origin/split), D-09 (chain spine [Remix or Idea]→Hooks→Script→Test), the generic anchor-carry handoff contract.

### The shape both skills mirror (Script = greenfield, follow these verbatim)
- `src/lib/tools/runners/hooks-runner.ts` — the over-generate→gate→RANK→top-N + Flash pull-score pipeline (Script's hook-beat Flash gate D-01 reuses this exact gate; Remix's adapt→Flash mirrors it).
- `src/lib/tools/runners/ideas-runner.ts` — the generate→SIM-gate→self-judge→build-card pipeline + content-first stream + seedHook structured generation (the canonical runner template).
- `src/lib/tools/runners/flash-runner.ts`, `src/lib/engine/flash/run-flash-text-mode.ts`, `flash-aggregate.ts` (`aggregateFlash`, `MIXED_THRESHOLD`) — the Flash text-mode SIM the hook-beat gate (D-01) calls.
- `.planning/phases/04-hooks-tool/04-CONTEXT.md` — hook-card block, "Test full →" handoff, `testBrief`/`handleTestHook` carry-in seam (Script→Test rides the same context-handoff, D-07).
- `.planning/phases/03-ideas-tool/03-CONTEXT.md` — content-first stream, self-judge gate, legible grounding, in-thread append, the chain-CTA seam.

### Typed cards, blocks, tool-runner, persistence
- `src/lib/tools/blocks.ts` + `src/lib/tools/block-registry.ts` — where the new `script-card` + `remix-card` typed blocks are defined + registered (double-validated, fixed renderer — THREAD-04). Mirror `IdeaCardBlockSchema` / hook-card.
- `src/lib/tools/tool-runner.ts` — THREAD-06 contract + content-first `stream?` seam (named stage events for the P5 progress checkmarks).
- `src/components/thread/` — `idea-card-block.tsx`, `hook-card-block.tsx`, `*-thread-view.tsx` — the render substrate the two new cards extend.
- `src/lib/kc/assembler.ts` — `assembleBundle` (per-mode tight grounding; a `script` / `remix` mode-role map may be added — confirm against GROUND-02 anti-dilution).
- `src/lib/kc/compiled.ts` — KC system prompts (a Script/Remix slice or reuse of Hooks slice — check P2 corpus).

### Remix prior art — SCOUT TARGET (revive, don't rebuild — D-06)
- `src/lib/engine/remix/resolve-and-rehost.ts` — URL → resolved/rehosted video (D-05 entry).
- `src/lib/engine/remix/decode.ts`, `decode-prompts.ts`, `decode-types.ts`, `decode.fixture.ts` — the real structural decode (hook pattern, structure, the turn, emotional beat). **Scout MUST confirm decode's coupling to the protected SIM-1 Max path (D-05a).**
- `src/lib/engine/remix/adapt.ts` (`generateAdaptConcepts`) + `src/app/api/remix/adapt/route.ts` — niche-adapt generator (currently 3 concepts; Qwen-only; auth/ownership/CSRF controls to preserve).
- `src/lib/engine/remix/__tests__/` — existing remix tests (keep green if logic revived).
- `src/components/board/adapt/AdaptConceptCard.tsx`, `AdaptFrameBody.tsx`, `RemixedFromChip.tsx` — **old-board UI, NOT reused** (pre-numen-rework); reference only for the concept shape, then build a fresh thread `remix-card`.
- Worktrees `~/virtuna-viral-remix` (`milestone/viral-remix` — Ingestion + Remix Mode COMPLETE) + `~/virtuna-viral-remix-adapt` — the REQUIREMENTS-mandated scout sources.

### Engine — protected SIM-1 Max path (do NOT regress)
- `src/lib/engine/version.ts` — `ENGINE_VERSION`; **do NOT bump** (Script = text-path Flash; Remix decode must stay read-only over Max — D-05a).
- `src/lib/engine/__tests__/` — suite that MUST stay green (same-video Max score-identity preserved).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`CHAIN_HANDOFFS` placeholders** (`chain-handoff.ts`) — P6 fills `endpoint` + wires renderer for `hooks→script`, `script→test`, `remix→hooks`; the extend procedure is documented in-file. Zero structural plumbing.
- **ideas/hooks runners** (`ideas-runner.ts`, `hooks-runner.ts`) — the generate→SIM-gate→self-judge→content-first→typed-card template Script follows verbatim and Remix's adapt→Flash mirrors.
- **Hooks Flash gate** (`flash/run-flash-text-mode.ts` + `aggregateFlash`/`MIXED_THRESHOLD`) — Script's hook-beat score (D-01) reuses it unchanged; no new SIM calibration.
- **`testBrief` / `handleTestHook` + HookTestContext** (P4 composer) — the context-handoff Script→Test rides (D-07), identical to hooks→test.
- **engine/remix decode+adapt pipeline** (`resolve-and-rehost.ts`, `decode.ts`, `adapt.ts`) — the Remix logic to revive (D-05/D-06); already Qwen-only with auth/ownership/CSRF controls.
- **block-registry + typed cards** (`blocks.ts`, `block-registry.ts`, `components/thread/*-card-block.tsx`) — pattern for the two new `script-card` / `remix-card` blocks.

### Established Patterns
- **Honesty spine** — Flash scores only what it can predict (hook-beat scroll-stop, D-01); no fabricated full-watch/view-count score; real decode over metadata guesses (D-05).
- **Earn-the-gate slices** — each generative skill is its own success-criteria phase (D-00 from P5); Diagnose + own-winner deferred to stay tight (D-03/D-04).
- **Engine OPEN but regression-gated** — both skills are text-path/Flash; Remix decode reuse must be read-only over the protected Max path, no `ENGINE_VERSION` bump, suite green (D-05a).
- **Anti-dilution grounding (GROUND-02)** — Script/Remix grounding is a tight per-request niche+craft slice, not whole-profile.
- **Fixed typed-renderer library (THREAD-04)** — new cards are registered, double-validated blocks, never model-generated UI.
- **Revive, don't rebuild** (REMIX-01) — scout the existing remix engine before writing new code (D-06).

### Integration Points
- **Script run** → hook anchor (or topic) → `assembleBundle` (script grounding) → Qwen generate (beats+timing+retention) → hook-beat Flash gate (D-01) → self-judge → `script-card` block in the open thread → "Test full →" via context handoff.
- **Remix run** → pasted URL → `resolve-and-rehost` → `decode` (real anatomy) → `adapt` (niche/voice) → Flash → `remix-card` block → "Develop into hooks →" feeding the Hooks chain.
- **Both** append to the single open thread (P5 D-01) with full running context; cards stream content-first; progress checkmarks ride the P5 named-stage SSE seam.

### Watch-outs
- **Protected SIM-1 Max path** — the Remix decode reuse is the risk surface (D-05a). Scout MUST confirm decode doesn't mutate or version-bump the Max path; keep engine suite green.
- **Old-board remix UI is dead** — do NOT wire `components/board/adapt/*` into the studio thread; build a fresh `remix-card` (D-06).
- **Latency/cost** — Remix's resolve+real-decode is heavy (video fetch + decode); honor bounded-cost; the `adapt` route already sets `maxDuration = 300` for the ~65s adapt generation — Script's hook-beat-only gate keeps Script cheap.
- **Script prior art cited in 05-CONTEXT does NOT exist on this branch** (`analyze/[id]/script/route.ts` absent) — Script is greenfield; mirror ideas/hooks, don't hunt for missing prior art.

</code_context>

<specifics>
## Specific Ideas

- **"Sees a video on their FYP → wants to redo it for their own account"** (owner, 2026-06-18) — the hero Remix flow; drove D-04 (URL entry is the priority, own-winner deferred) and D-05 (decode the real video, detailed, not a generic rewrite).
- **"Focus on doing the URL detailed — way higher value for creators"** (owner, 2026-06-18) — Remix URL path quality over breadth; defer own-winner.
- **Script scores honestly on its opener, not a fake full-watch number** (owner accepted, 2026-06-18) — D-01; the moat holds via the hook-beat Flash gate + self-judge, never a fabricated retention score.

</specifics>

<deferred>
## Deferred Ideas

- **Script Diagnose mode** (paste existing script → line-edits + drop-point) → **v6.1** (D-03). Distinct input path + UX; ship generate-only first.
- **Remix own-winner entry** (pick from the creator's prior Readings) → **v6.1** (D-04). Separate picker UX; URL path is the P6 focus.
- **Concept/script text pre-flight mode** (Test concept/script text before shooting) → v6.1 or later (REQUIREMENTS open item; may land with Script later).
- **Remix output as a ranked set vs single card** — kept as Claude's discretion now (default: one remix card → Hooks for studio consistency); revisit if the scout shows the 3-concept adapt shape is better.
- **In-thread monetization, brand-profile entity, RAG-over-creator-history, desktop dense-instrument** — v6.1+ (per STATE Deferred Items).

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 6-Script & Remix Tools*
*Context gathered: 2026-06-18*
