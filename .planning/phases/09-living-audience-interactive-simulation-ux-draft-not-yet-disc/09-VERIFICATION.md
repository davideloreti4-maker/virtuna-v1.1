---
phase: 09-living-audience-interactive-simulation-ux
verified: 2026-06-19T14:30:00Z
status: gaps_found
score: 4/7 must-haves verified
overrides_applied: 0
gaps:
  - truth: "LIVE-03 — chat-with-persona ('Ask them why →') is reachable: tap a persona, ask why, get an in-voice grounded answer persisted as a sub-thread"
    status: failed
    reason: >
      The full backend (chat-runner personaGrounding, /api/tools/chat route, PersonaChatDrawer,
      persona-chat-turn block, CR-01 enum gating) exists and is unit-tested, but the affordance is
      UNREACHABLE on every live surface because no mount site supplies BOTH a `conceptText` AND a
      groundable registry-enum archetype at the same time:
        (a) Video Test surface (reading-panels.tsx:234) opens <AudienceLens> with real-archetype
            nodes + heatmap but passes NO conceptText → AudienceLens gates the chat list
            (`conceptText && chatList.length > 0`, AudienceLens.tsx:256) and never mounts
            PersonaChatDrawer (line 308). Chat dead here.
        (b) The 4 text cards (idea/hook/script/remix) pass conceptText but call
            cardScrollQuoteReactions(fraction, scrollQuote) with NO leadArchetype argument →
            every persona is a `viewer_N` placeholder → chatList (ARCHETYPES.includes filter)
            is empty → chat row gated off (the CR-01 fix working as designed). Chat dead here.
        (c) PersonasBlock (text Read) is the ONLY surface whose LensTrigger passes BOTH real-enum
            `personas` AND `conceptText` (personas-block.tsx:66-68) — but it only does so when its
            own `conceptText` prop is set, and the sole renderer (MessageBlocks, message-blocks.tsx:65)
            invokes every block as `<Component block={block} />` and NEVER threads conceptText
            through. So PersonasBlockRenderer always receives conceptText=undefined → the LensTrigger
            branch is never taken → the Lens (and chat) never mounts on the text Read either.
      Net: the flagship "Ask them why →" persona-chat is not reachable on ANY of the six surfaces
      this phase targets. The CR-01 gating is correct in isolation, but no surface wires a groundable
      persona to a concept, so the gate is closed everywhere.
    artifacts:
      - path: "src/components/reading/reading-panels.tsx"
        issue: "Opens <AudienceLens> (line 234) with heatmap+simResults but omits conceptText → chat list + drawer never render on the rich-signal surface that DOES carry groundable archetypes."
      - path: "src/components/thread/message-blocks.tsx"
        issue: "Block renderer (line 65) passes only {block}; never threads conceptText to PersonasBlockRenderer, so the one chat-groundable text surface (PersonasBlock) never mounts the Lens."
      - path: "src/components/thread/idea-card-block.tsx, hook-card-block.tsx, script-card-block.tsx, remix-card-block.tsx"
        issue: "cardScrollQuoteReactions(fraction, scrollQuote) called with no leadArchetype → all personas are viewer_N placeholders → chat permanently gated off on all 4 text cards."
    missing:
      - "Pass conceptText into <AudienceLens> from reading-panels.tsx (the video Test surface) so chat is reachable where real archetype nodes already exist."
      - "Thread conceptText through MessageBlocks → PersonasBlockRenderer (or otherwise mount the Lens on the text Read with the concept) so the one chat-groundable text surface actually opens the Lens with a concept."
      - "On the text cards, supply the runner's real registry-enum archetype as leadArchetype to cardScrollQuoteReactions where one exists (else the cards remain legitimately chat-less by the CR-01 design)."
  - truth: "LIVE-07 — the sticky 'Rewrite for this audience →' CTA re-POSTs to the originating runner with the lever as steering, producing a new card + Read in-thread with a delta vs prior"
    status: failed
    reason: >
      The CHAIN_HANDOFFS same-skill self-handoff entries (idea/hooks/script/remix, from===to,
      ctaLabel "Rewrite for this audience →") exist and are test-locked (chain-handoff.test.ts green),
      and AudienceLens renders <RewriteCta> when `rewrite && hasReaction`. BUT the `rewrite: LensRewrite`
      prop is NEVER supplied by ANY mount site — neither reading-panels.tsx (video Test) nor any of the
      5 LensTrigger card/personas mounts pass a `rewrite` prop. With `rewrite` undefined everywhere, the
      sticky CTA never renders and the onRewrite re-POST + delta path is unreachable. The flywheel that
      "IS the product" (per 09-04 objective) does not close on any live surface.
    artifacts:
      - path: "src/components/audience-lens/AudienceLens.tsx"
        issue: "RewriteCta gated on `rewrite && hasReaction` (line 294); `rewrite` is optional and never supplied by any consumer."
      - path: "src/components/audience-lens/LensTrigger.tsx"
        issue: "Forwards an optional `rewrite` prop but no card-block passes it; all 5 LensTrigger mounts omit rewrite."
      - path: "src/components/reading/reading-panels.tsx"
        issue: "Video-Test <AudienceLens> mount omits rewrite entirely."
    missing:
      - "Build a LensRewrite (endpoint from handoffsFor(skill) self-handoff, lever from the Read, onRewrite that fires the re-POST + streams the new card in-thread) and pass it as `rewrite` from each regenerable surface."
      - "Wire the onRewrite re-POST + the prior→new delta readout to a live thread so the CTA produces a new card + Read."
  - truth: "LIVE-06 — one reusable AudienceLens is retrofit across all 6 skills, degrading by feature"
    status: partial
    reason: >
      The single reusable Lens + shared LensTrigger entry genuinely mount on the video Test surface and
      the 4 text cards, and cloud / cluster / Population / cascade work there. But the retrofit is
      incomplete on the text Read: the PersonasBlock LensTrigger is wired in the component yet never
      activates because MessageBlocks does not pass conceptText (same root cause as LIVE-03 (c)), so the
      text Read surface mounts NO Lens in practice. Combined with chat (LIVE-03) being dead on all
      surfaces and Rewrite (LIVE-07) dead on all surfaces, the "retrofit" delivers cloud+cluster+Population
      but not the two interaction features the phase headline ("tested against YOUR audience" tangible)
      most depends on.
    artifacts:
      - path: "src/components/thread/personas-block.tsx"
        issue: "LensTrigger mount is conditioned on a conceptText that the renderer (MessageBlocks) never supplies → text Read surface never shows the Lens."
    missing:
      - "Thread conceptText to PersonasBlockRenderer so the text Read surface actually mounts the Lens (shared with the LIVE-03 fix)."
deferred: []
---

# Phase 9: Living Audience / Interactive Simulation UX — Verification Report

**Phase Goal:** Make "tested against YOUR audience" tangible — the Living Audience / interactive simulation UX. One reusable AudienceLens spine that all skills mount, delivering reaction replay (LIVE-01), clickable persona nodes with verbatim reactions (LIVE-02), chat-with-persona (LIVE-03), segment clustering (LIVE-04), Population·1,000 (LIVE-05), AudienceLens retrofit across text skills + Reads (LIVE-06), and the Rewrite-for-audience loop (LIVE-07).
**Verified:** 2026-06-19T14:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (requirement) | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | LIVE-01 reaction replay (segment-by-segment from HeatmapPayload.attentions[]; cascade elsewhere; reducedMotion-gated + sr-only mirror) | ✓ VERIFIED | `ReplayController.tsx` drives segment index from `attentions`; PersonaGraph extended with attention input; mounted in AudienceLens panel mode; reachable on the video Test surface (reading-panels.tsx:234 opens the Lens). Determinism gate clean (no Math.random/Date.now — only in comments). Tests green. |
| 2 | LIVE-02 node drill-down (tap dot → archetype + verbatim reaction) | ✓ VERIFIED | `PersonaGraph.tsx` pinned/hover verbatim card (quote/scrollQuote) at L80-81; reachable inside the Lens on the video Test surface where real per-persona nodes + quotes flow. |
| 3 | LIVE-03 chat-with-persona reachable (tap → ask why → in-voice grounded answer, persisted sub-thread) | ✗ FAILED | Backend (chat-runner personaGrounding, /api/tools/chat route, PersonaChatDrawer, persona-chat-turn block) exists + unit-tested, but UNREACHABLE on every live surface: video surface omits conceptText (chat gated, AudienceLens.tsx:256/308); 4 text cards pass no leadArchetype → all viewer_N placeholders (chat gated by CR-01 design); PersonasBlock (only chat-groundable text surface) never receives conceptText because MessageBlocks (message-blocks.tsx:65) never threads it. The CR-01 gate is correct, but no surface wires a groundable persona + concept together → the gate is closed everywhere. |
| 4 | LIVE-04 segment clustering (Temp × Disposition via buildSegmentGroups; worst cluster coral ≤2 marks) | ✓ VERIFIED | `ClusterView.tsx` + `buildSegmentGroups`/`worstBadGroupKey` (audience-derive); WR-02 fix aligned cloud vs table coral via `archetypeToSlot`; rendered in AudienceLens panel mode; reachable on the video Test surface. |
| 5 | LIVE-05 Population·1,000 (deterministic mulberry32 swarm, counters = weighted rollup, batched cascade, sr-only mirror, archetype breakdown, zero model calls) | ✓ VERIFIED | `PopulationSwarm.tsx` consumes `instantiatePopulation`/`weightedRollup` from `lens-derive.ts`; determinism + counter-identity + a11y-mirror + no-scoring-path-import tests green; no Math.random/Date.now (comments only); wired into the scale toggle (PopulationRegion); WR-01 fix made breakdown sum to headline by construction. |
| 6 | LIVE-06 one reusable AudienceLens retrofit across all 6 skills, degrade by feature | ⚠️ PARTIAL | Single shared `AudienceLens` + `LensTrigger` mount on the video Test surface + 4 text cards (cloud/cluster/Population/cascade work). But the text-Read PersonasBlock LensTrigger never activates (conceptText not threaded by MessageBlocks), so that surface mounts no Lens; and the two flagship interactions (chat LIVE-03, Rewrite LIVE-07) are dead on all surfaces. Structural retrofit present; feature delivery incomplete. |
| 7 | LIVE-07 sticky "Rewrite for this audience →" loop (lever-as-steering re-POST → new card + Read + delta) | ✗ FAILED | CHAIN_HANDOFFS self-handoff entries (idea/hooks/script/remix, from===to) exist + test-locked; `RewriteCta` renders when `rewrite && hasReaction`. But the `rewrite: LensRewrite` prop is NEVER supplied by any mount site (reading-panels.tsx + all 5 LensTrigger mounts omit it) → the CTA never renders, the onRewrite re-POST + delta path is unreachable. The flywheel does not close on any live surface. |

**Score:** 4/7 truths verified (LIVE-03 and LIVE-07 failed; LIVE-06 partial).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/audience-lens/lens-derive.ts` | Pure deterministic Population/cascade math | ✓ VERIFIED | instantiatePopulation/weightedRollup/cascadeOrder exported; no Math.random/Date.now; tests green. |
| `src/components/audience-lens/AudienceLens.tsx` | Reusable Lens shell (header, scale toggle, panel, cluster, chat list, rewrite CTA) | ✓ EXISTS (substantive) | All regions present; chat list + drawer + RewriteCta present but gated on props never supplied by consumers (see gaps). |
| `src/components/audience-lens/ReplayController.tsx` | Segment replay (timeline) + cascade | ✓ VERIFIED | attentions-driven; reducedMotion-gated; sr-only mirror. |
| `src/components/audience-lens/PopulationSwarm.tsx` | 1,000-dot deterministic swarm + counters + breakdown | ✓ VERIFIED | Consumes lens-derive; zero scoring-path import; tests green. |
| `src/components/audience-lens/PersonaChatDrawer.tsx` | In-context persona chat over the cloud | ✓ EXISTS (substantive, unreachable) | Streams personaGrounding; CR-02/WR-03 fixes applied; mounted only when conceptText present — never on live surfaces. |
| `src/components/audience-lens/ClusterView.tsx` | Temp×Disposition cluster view | ✓ VERIFIED | buildSegmentGroups-driven; worst coral. |
| `src/components/audience-lens/flat-card-reactions.ts` | Flat Shape-B reaction derivation w/ CR-01 enum gating | ✓ VERIFIED | Enum-only groundable; placeholders otherwise — correct, but no caller supplies an enum. |
| `src/lib/tools/runners/chat-runner.ts` | Additive personaGrounding param | ✓ VERIFIED | Optional, byte-identical non-persona path; reads ARCHETYPE_DEFINITIONS, no mutation; tests green. |
| `src/app/api/tools/chat/route.ts` | Forwards/validates personaGrounding; rehydrates sub-thread | ✓ VERIFIED (backend) | parsePersonaGrounding validates against ARCHETYPES; length-capped; persona-chat-turn rehydration path present. |
| `src/lib/tools/chain-handoff.ts` | Same-skill Rewrite entries | ✓ VERIFIED | 4 from===to "Rewrite for this audience →" entries; test-locked. |
| `src/lib/tools/blocks.ts` (persona-chat-turn) | Sub-thread persistence block (no migration) | ✓ VERIFIED | persona-chat-turn block registered; round-trips loadMessages; no migration needed. |
| `.planning/REQUIREMENTS.md` | LIVE-01..07 entries + traceability | ✓ VERIFIED (minor inconsistency) | 7 bullets (L82-88, all [x]) + 7 traceability rows (L154-160). LIVE-05 row still reads "Pending (math core landed 09-01…)" while bullet is [x] — stale, cosmetic. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| reading-panels.tsx | AudienceLens | onOpen seam opens Lens w/ heatmap+simResults | ✓ WIRED | Seam wired (Pitfall 1 closed) — but conceptText omitted (breaks LIVE-03). |
| AudienceLens | multi-audience-read-block | MultiAudienceReadBlockRenderer header | ✓ WIRED | readBlock header path present. |
| ReplayController | engine/types | HeatmapPayload.attentions[] | ✓ WIRED | attentions consumed. |
| PersonaChatDrawer | /api/tools/chat | POST ask + personaGrounding | ✓ WIRED (backend) | Streams; never invoked from live UI (no conceptText/groundable persona). |
| chat-runner | persona-registry | reads ARCHETYPE_DEFINITIONS | ✓ WIRED | Read-only, byte-stable. |
| chain-handoff | AudienceLens | handoffsFor(skill) → Rewrite CTA | ✗ NOT_WIRED | No mount supplies `rewrite` prop → CTA never renders (LIVE-07). |
| PersonasBlockRenderer | AudienceLens | LensTrigger when conceptText present | ✗ NOT_WIRED | MessageBlocks never passes conceptText → text-Read Lens never mounts. |
| 4 text cards | AudienceLens | LensTrigger + cardScrollQuoteReactions | ⚠️ PARTIAL | Lens opens (cloud/cluster/Population) but no leadArchetype → chat dead; no rewrite → CTA dead. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| AudienceLens chat list | `chatList` | `nodes.filter(ARCHETYPES.includes)` | Empty on cards (viewer_N) + null conceptText on video → never rendered | ✗ HOLLOW (gated everywhere) |
| AudienceLens RewriteCta | `rewrite` prop | none — never passed | undefined at every call site | ✗ DISCONNECTED |
| PersonasBlock Lens | `conceptText` prop | MessageBlocks (passes only {block}) | undefined always | ✗ HOLLOW_PROP |
| PopulationSwarm counters | `weightedRollup(nodes)` | lens-derive (real verdicts) | Yes | ✓ FLOWING |
| ClusterView | `buildSegmentGroups` | audience-derive (real heatmap/sim) | Yes (video surface) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase test suites pass | `npx vitest run src/components/audience-lens src/components/reading/__tests__/persona-cloud.test.tsx src/lib/tools/runners/__tests__/chat-runner.test.ts src/lib/tools/__tests__/chain-handoff.test.ts` | PASS (39) FAIL (0) | ✓ PASS |
| Build compiles | `npm run build` | ✓ Compiled successfully in 5.8s | ✓ PASS |
| Determinism gate (lens-derive/PopulationSwarm) | `grep Math.random\|Date.now` | matches in comments only | ✓ PASS |

### Probe Execution

No project probes (`scripts/*/tests/probe-*.sh`) declared for this phase. SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LIVE-01 | 09-01, 09-02 | reaction replay | ✓ SATISFIED | ReplayController on video Test surface |
| LIVE-02 | 09-01, 09-02 | node drill-down | ✓ SATISFIED | PersonaGraph pinned verbatim card |
| LIVE-03 | 09-01, 09-03 | chat-with-persona | ✗ BLOCKED | Backend complete + tested; unreachable on all 6 surfaces |
| LIVE-04 | 09-01, 09-04 | segment clustering | ✓ SATISFIED | ClusterView + buildSegmentGroups |
| LIVE-05 | 09-01, 09-05 | Population·1,000 | ✓ SATISFIED | PopulationSwarm deterministic, counter-identity tested |
| LIVE-06 | 09-01, 09-02, 09-04 | AudienceLens retrofit | ⚠️ PARTIAL | Lens mounts on 5/6 surfaces (text Read dead); flagship features dead |
| LIVE-07 | 09-01, 09-04 | Rewrite-for-audience loop | ✗ BLOCKED | Handoffs + CTA exist; `rewrite` prop never wired to any surface |

No orphaned requirements: every Phase-9 ID in REQUIREMENTS.md is claimed by ≥1 plan's `requirements:` field.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| AudienceLens.tsx:256/308 | chat features gated on `conceptText` that no rich-signal caller supplies | 🛑 Blocker | LIVE-03 unreachable |
| AudienceLens.tsx:294 | RewriteCta gated on `rewrite` prop never supplied | 🛑 Blocker | LIVE-07 unreachable |
| message-blocks.tsx:65 | renderer passes only {block}; `conceptText` prop on PersonasBlockRenderer is dead | 🛑 Blocker | LIVE-06 text-Read mount + LIVE-03 (c) |
| REQUIREMENTS.md:158 | LIVE-05 traceability row "Pending" vs `[x]` bullet | ℹ️ Info | Stale status string; cosmetic |

No debt markers (TBD/FIXME/XXX) found in modified files.

### Human Verification Required

None additional — the blocking gaps are statically observable in code; no UI/visual ambiguity needs a human to confirm the wiring is absent.

### Gaps Summary

The AudienceLens **plumbing** is genuinely well-built: pure deterministic math (lens-derive), the swarm, the cluster view, the replay controller, the chat backend (route + runner + persisted persona-chat-turn block), and the CHAIN_HANDOFFS Rewrite entries all exist, are substantive, and pass their unit tests. The CR-01 fix is also correct in isolation — it properly refuses to send a display label / placeholder as a registry archetype.

The phase goal — make "tested against YOUR audience" **tangible** and **interactive** — is NOT achieved because the two most distinctive interactions are dead at the wiring layer, all from a shared root cause: **the surfaces never connect a groundable persona to a concept, and never supply the rewrite descriptor.**

1. **LIVE-03 (chat-with-persona) is unreachable on all six surfaces.** The CR-01 gating is correct, but no live surface satisfies both preconditions simultaneously: the rich-signal video surface (which has real archetypes) omits `conceptText`; the four text cards (which have `conceptText`) pass no `leadArchetype` so every persona is a `viewer_N` placeholder; and the one surface that does pass both real archetypes and `conceptText` in its LensTrigger (PersonasBlock) never receives `conceptText` because the block renderer (`MessageBlocks`) doesn't thread it. So the flagship "Ask them why →" cheatcode never appears anywhere.

   Direct answer to the review question: the CR-01 gating did NOT, by itself, make chat video-only — it made chat reachable nowhere. Even the video surface is dead because it lacks `conceptText`. The intended fallback ("chat still works on the heatmap/PersonasBlock paths") is also dead due to the unrelated `conceptText` threading gap.

2. **LIVE-07 (Rewrite loop) is unreachable on all surfaces.** The `rewrite: LensRewrite` prop is never supplied by any of the six mount points, so the sticky CTA never renders and the flywheel never closes.

3. **LIVE-06 retrofit is partial:** the Lens structurally mounts and cloud/cluster/Population work on 5 surfaces, but the text-Read surface mounts no Lens, and the two interaction features above are dead everywhere.

LIVE-01, LIVE-02, LIVE-04, LIVE-05 are genuinely delivered and reachable (on the video Test surface for 01/02/04; via the scale toggle for 05).

**Fix shape (small, wiring-level):** (a) pass `conceptText` into `<AudienceLens>` from `reading-panels.tsx`; (b) thread `conceptText` through `MessageBlocks` → `PersonasBlockRenderer`; (c) supply each regenerable surface a `rewrite` descriptor built from `handoffsFor(skill)` + the Read lever + an `onRewrite` that re-POSTs and streams the new card. None require new components — the parts all exist; they are not connected.

---

_Verified: 2026-06-19T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
