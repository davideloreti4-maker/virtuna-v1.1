---
phase: 09-living-audience-interactive-simulation-ux
verified: 2026-06-19T18:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/7
  gaps_closed:
    - "LIVE-03 — chat-with-persona reachable on the video Test surface + text-Read PersonasBlock"
    - "LIVE-06 — text-Read PersonasBlock now mounts the reusable AudienceLens (conceptText threaded)"
    - "LIVE-07 — Rewrite CTA renders + re-POSTs on all 4 regenerable card surfaces"
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
---

# Phase 9: Living Audience / Interactive Simulation UX — Verification Report (Re-verification)

**Phase Goal:** Make "tested against YOUR audience" tangible AND interactive via one reusable AudienceLens spine — reaction replay (LIVE-01), node drill-down (LIVE-02), chat-with-persona (LIVE-03), segment clustering (LIVE-04), Population·1,000 (LIVE-05), AudienceLens retrofit across text skills + Reads (LIVE-06), Rewrite-for-audience loop (LIVE-07).
**Verified:** 2026-06-19T18:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (was gaps_found 4/7; the 3 wiring gaps LIVE-03 / LIVE-06 / LIVE-07 are now closed in code).

## Re-verification Outcome

The three previously-failing items were all wiring-level gaps (the components, backend, CHAIN_HANDOFFS entries, and CR-01 gating already existed and were unit-tested). The gap closure connected them. All three are confirmed closed against the actual source:

- **LIVE-03 — closed.** `reading-panels.tsx:270` now passes `conceptText={readingConceptText(data)}` into the video-Test `<AudienceLens>`. `readingConceptText` (lines 189-208) derives the concept HONESTLY from the real engine `verbatim` (hook spoken/on-screen text → first segment fallback → `undefined` when no verbatim). The video surface already carries real registry-enum archetype nodes, so the chat gate `conceptText && chatList.length > 0` (AudienceLens.tsx:256) now opens → `PersonaChatDrawer` mounts (line 308). For the text-Read surface, `message-blocks.tsx` now threads a concept (explicit `conceptText` prop OR an in-band markdown fallback `inBandConceptText`, lines 62-79) into `PersonasBlockRenderer` (line 108), which passes BOTH the real-enum `personas` AND `conceptText` to `LensTrigger` (personas-block.tsx:65-72). `buildFlatPersonaNodes` preserves `archetype` (audience-derive.ts:523), so PersonasBlock's registry-enum archetypes pass `ARCHETYPES.includes(...)` → chat reachable. The 4 text cards (idea/hook/script/remix) remain honestly chat-less: `cardScrollQuoteReactions` is called with no `leadArchetype`, so every persona is a `viewer_N` placeholder and the gate stays closed — exactly the CR-01 honesty design (display labels are never coerced into the grounding enum). **Chat is reachable on the video Test surface AND the PersonasBlock text-Read surface — both required surfaces confirmed.**

- **LIVE-07 — closed.** New `card-rewrite.ts` `buildCardRewrite({ skill, fraction, scrollQuote, conceptText, platform, leverRidesAnchor? })` sources `endpoint` from `handoffsFor(skill)` self-handoff (from===to, "Rewrite for this audience →") — the CHAIN_HANDOFFS SSOT, never hard-coded (chain-handoff.ts:194-223 holds all 4 self-handoff entries). It parses `priorStopCount/priorTotal` from the card's REAL `fraction`, uses the real verbatim `scrollQuote` as the lever, and returns an `onRewrite` that re-POSTs the pinned `{ ask?, anchor?, platform }` contract to the real runner (`/api/tools/ideas`, `/api/tools/hooks`, `/api/tools/script`, `/api/tools/ideas/develop` for remix). All 4 card blocks supply `rewrite={buildCardRewrite(...)}` (idea-card-block.tsx:153, hook-card-block.tsx:132, script-card-block.tsx:106, remix-card-block.tsx:156). `RewriteCta` gates on `rewrite && hasReaction` (AudienceLens.tsx:294) — NOT the chat gate — so it renders on all 4 text cards (each carries flat personas). A `null` synchronous delta (no fabricated before/after number) is returned by design; the regenerated card surfaces via the existing thread stream. **CTA renders and the re-POST is a real functional fetch, not a dead stub — accepted per constraint.** The video Test surface correctly receives no `rewrite` (it carries a heatmap timeline, not a regenerable concept card — honest).

- **LIVE-06 — closed.** Same root cause as LIVE-03(b). The text-Read PersonasBlock now mounts the reusable Lens via the `MessageBlocks → PersonasBlockRenderer` conceptText threading. All 6 surfaces now mount the single shared `AudienceLens`.

## Goal Achievement

### Observable Truths

| # | Truth (requirement) | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | LIVE-01 reaction replay (segment-by-segment from HeatmapPayload.attentions[]; reducedMotion-gated + sr-only mirror) | ✓ VERIFIED | `ReplayController.tsx` attentions-driven; mounted in AudienceLens panel mode; reachable on the video Test surface. Unchanged since prior PASS. |
| 2 | LIVE-02 node drill-down (tap dot → archetype + verbatim reaction) | ✓ VERIFIED | `PersonaGraph` pinned/hover verbatim card; reachable inside the Lens on the video Test surface. Unchanged since prior PASS. |
| 3 | LIVE-03 chat-with-persona reachable (tap → ask why → in-voice grounded answer) | ✓ VERIFIED | NOW REACHABLE. Video Test: `reading-panels.tsx:270` passes `readingConceptText(data)` + real-enum nodes → gate opens (AudienceLens.tsx:256/308). Text-Read: `message-blocks.tsx:108` threads conceptText (explicit or in-band markdown) → PersonasBlock's LensTrigger passes both real-enum personas + conceptText. 4 text cards stay honestly chat-less (CR-01). Locked by `lens-chat-gate.test.tsx` (3 tests). |
| 4 | LIVE-04 segment clustering (Temp × Disposition; worst cluster coral) | ✓ VERIFIED | `ClusterView` + `buildSegmentGroups`/`worstBadGroupKey`; reachable on the video Test surface. Unchanged since prior PASS. |
| 5 | LIVE-05 Population·1,000 (deterministic mulberry32 swarm; weighted rollup; cascade; sr-only mirror; zero model calls) | ✓ VERIFIED | `PopulationSwarm` consumes `instantiatePopulation`/`weightedRollup`; determinism + counter-identity tests green; no Math.random/Date.now. Unchanged since prior PASS. |
| 6 | LIVE-06 one reusable AudienceLens retrofit across all 6 skills, degrade by feature | ✓ VERIFIED | Single shared `AudienceLens` + `LensTrigger` now mounts on all 6 surfaces: video Test (heatmap) + 4 text cards + text-Read PersonasBlock (the previously-dead surface, now mounted via conceptText threading). Locked by `message-blocks-concept.test.tsx`. |
| 7 | LIVE-07 sticky "Rewrite for this audience →" loop (lever-as-steering re-POST → new card + Read) | ✓ VERIFIED | `card-rewrite.ts` builds `LensRewrite` from the CHAIN_HANDOFFS self-handoff SSOT; supplied at all 4 regenerable card mounts; `RewriteCta` renders (gated on `rewrite && hasReaction`); `onRewrite` re-POSTs the pinned `{ask?,anchor?,platform}` contract to the real runner. Null synchronous delta accepted (no fabrication). Locked by `card-rewrite.test.ts` (5 tests). |

**Score:** 7/7 truths verified (was 4/7).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/reading/reading-panels.tsx` | Video-Test Lens mount supplies conceptText | ✓ VERIFIED | `readingConceptText(data)` (L189-208) derives honest concept from real verbatim; passed at L270. |
| `src/components/thread/message-blocks.tsx` | Threads conceptText to PersonasBlockRenderer | ✓ VERIFIED | Optional `conceptText` prop + in-band markdown fallback (L62-79); personas branch passes it (L101-110); all other renderers byte-identical (L113). |
| `src/components/audience-lens/card-rewrite.ts` (new) | Builds LensRewrite from self-handoff SSOT | ✓ VERIFIED | Endpoint from `handoffsFor(skill)`; real-fraction priors; real-verbatim lever; functional re-POST `onRewrite`. |
| `src/components/thread/{idea,hook,script,remix}-card-block.tsx` | Supply rewrite prop | ✓ VERIFIED | All 4 pass `rewrite={buildCardRewrite(...)}` (idea:153, hook:132, script:106, remix:156). |
| `src/components/audience-lens/AudienceLens.tsx` | Chat gate + RewriteCta render on supplied props | ✓ VERIFIED | Chat gate (L256/308) opens with conceptText+enum; RewriteCta (L294) renders on `rewrite && hasReaction`. |
| `src/components/thread/personas-block.tsx` | Mounts Lens when conceptText present | ✓ VERIFIED | LensTrigger passes real-enum `personas` + `conceptText` (L65-72). |
| `src/lib/tools/chain-handoff.ts` | 4 self-handoff Rewrite entries | ✓ VERIFIED | from===to "Rewrite for this audience →" for idea/hooks/script/remix (L194-223). |
| `src/components/audience-lens/flat-card-reactions.ts` | CR-01 enum-only grounding | ✓ VERIFIED | `groundable` only when a real ARCHETYPES enum; placeholders otherwise (correct). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| reading-panels.tsx | AudienceLens | conceptText=readingConceptText(data) | ✓ WIRED | Concept now supplied; chat gate opens on video Test. |
| message-blocks.tsx | PersonasBlockRenderer | conceptText (explicit or in-band markdown) | ✓ WIRED | Threaded; PersonasBlock LensTrigger now activates. |
| PersonaChatDrawer | /api/tools/chat | POST ask + personaGrounding | ✓ WIRED | Reachable now that conceptText + real-enum persona co-occur. |
| chain-handoff | card-rewrite → AudienceLens | handoffsFor(skill) → rewrite prop → RewriteCta | ✓ WIRED | All 4 mounts supply rewrite; CTA renders. |
| card-rewrite onRewrite | originating runner | re-POST pinned {ask?,anchor?,platform} | ✓ WIRED | Real fetch to /api/tools/{ideas,hooks,script,ideas/develop}. |
| 4 text cards | AudienceLens | LensTrigger + cardScrollQuoteReactions + rewrite | ✓ WIRED | Lens opens (cloud/cluster/Population) + Rewrite CTA renders; chat honestly gated (CR-01). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| AudienceLens chat list (video) | `chatList` | real-enum nodes + readingConceptText | Yes (real verbatim concept + registry-enum archetypes) | ✓ FLOWING |
| AudienceLens chat list (text-Read) | `chatList` | PersonasBlock real-enum personas + threaded conceptText | Yes | ✓ FLOWING |
| AudienceLens RewriteCta | `rewrite` prop | buildCardRewrite (self-handoff SSOT + real fraction/verbatim) | Yes | ✓ FLOWING |
| card onRewrite re-POST | payload | real runner endpoint, pinned contract | Yes (functional fetch) | ✓ FLOWING |
| 4 text cards chat list | `chatList` | viewer_N placeholders (no enum) | Empty — honestly gated (CR-01) | ✓ INTENTIONAL (chat-less by design) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase test suites pass | `npx vitest run src/components/audience-lens src/components/reading/__tests__/persona-cloud.test.tsx src/components/thread src/lib/tools/runners/__tests__/chat-runner.test.ts src/lib/tools/__tests__/chain-handoff.test.ts` | PASS (61) FAIL (0) | ✓ PASS |
| New regression tests | `npx vitest run lens-chat-gate.test.tsx card-rewrite.test.ts message-blocks-concept.test.tsx` | PASS (12) FAIL (0) | ✓ PASS |
| Production build | `npm run build` | ✓ Compiled successfully in 10.8s; 66/66 pages generated; TypeScript passed | ✓ PASS |
| Determinism gate (lens paths) | `grep Math.random\|Date.now\|new Date( src/components/audience-lens/` | NO_EXECUTABLE_MATCHES | ✓ PASS |

### Probe Execution

No project probes (`scripts/*/tests/probe-*.sh`) declared for this phase. SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LIVE-01 | 09-01, 09-02 | reaction replay | ✓ SATISFIED | ReplayController on video Test surface |
| LIVE-02 | 09-01, 09-02 | node drill-down | ✓ SATISFIED | PersonaGraph pinned verbatim card |
| LIVE-03 | 09-01, 09-03 | chat-with-persona | ✓ SATISFIED | Reachable on video Test + text-Read PersonasBlock; CR-01 honesty preserved on text cards |
| LIVE-04 | 09-01, 09-04 | segment clustering | ✓ SATISFIED | ClusterView + buildSegmentGroups |
| LIVE-05 | 09-01, 09-05 | Population·1,000 | ✓ SATISFIED | PopulationSwarm deterministic, counter-identity tested |
| LIVE-06 | 09-01, 09-02, 09-04 | AudienceLens retrofit | ✓ SATISFIED | Single shared Lens mounts on all 6 surfaces (text-Read now wired) |
| LIVE-07 | 09-01, 09-04 | Rewrite-for-audience loop | ✓ SATISFIED | rewrite supplied at all 4 card mounts; CTA renders; onRewrite re-POSTs the pinned contract |

No orphaned requirements: every Phase-9 ID in REQUIREMENTS.md is claimed by ≥1 plan's `requirements:` field. Traceability rows for LIVE-03 / LIVE-06 / LIVE-07 updated to Complete.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| — | — | — | None. Prior blockers (conceptText not threaded, rewrite unsupplied) are resolved. No TBD/FIXME/XXX debt markers in modified files. No Math.random/Date.now in lens paths. |

### Regression Verification

- **Non-persona open chat:** byte-identical — `MessageBlocks` only branches for `block.type === 'personas' && personaConcept`; every other block renders via `<Component block={block} />` (message-blocks.tsx:113). The in-band concept computation does not alter non-personas output.
- **Deterministic math / swarm:** untouched — lens-derive / PopulationSwarm unchanged; counter-identity + determinism tests green.
- **No Math.random/Date.now** in lens/swarm/card-rewrite paths (grep clean — comments only).
- **Existing card renderers:** the added `rewrite`/`conceptText` props are additive; absent props degrade to prior behavior.

### Human Verification Required

None. The gap closures are statically verifiable in code and locked by 12 new regression tests; the chat-gate test renders the actual AudienceLens and asserts the affordance mounts/gates correctly. Build + suites green. No UI/visual ambiguity blocks the goal.

> Optional (not blocking): a live end-to-end smoke (tap "Ask them why →" on a real Read → in-voice answer; tap "Rewrite for this audience →" → new card streams into the thread) would confirm the runtime round-trip, but the wiring, contract, and gate behavior are all proven in code + tests.

### Gaps Summary

No gaps. All 3 previously-failing wiring gaps are closed in the actual source and locked by regression tests:

1. **LIVE-03** — chat reachable on the two required surfaces (video Test via `readingConceptText`; text-Read PersonasBlock via `MessageBlocks` conceptText threading). Text cards stay honestly chat-less per CR-01.
2. **LIVE-07** — `card-rewrite.ts` supplies a functional `LensRewrite` (self-handoff SSOT endpoint, real priors/lever, real re-POST) at all 4 card mounts; `RewriteCta` renders. Null synchronous delta accepted.
3. **LIVE-06** — text-Read PersonasBlock now mounts the shared Lens; all 6 surfaces wired.

The phase goal — make "tested against YOUR audience" tangible AND interactive via one reusable AudienceLens spine — is achieved. Score 7/7.

---

_Verified: 2026-06-19T18:00:00Z (re-verification after gap closure)_
_Verifier: Claude (gsd-verifier)_
