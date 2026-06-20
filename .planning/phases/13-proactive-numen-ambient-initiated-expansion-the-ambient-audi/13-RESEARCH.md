# Phase 13: Ambient Numen — the living, always-present audience - Research

**Researched:** 2026-06-20
**Domain:** Frontend extension of a shipped React/Next.js reaction primitive (P9 AudienceLens) + one thin Flash text-mode reaction API route. No new libraries, no engine change.
**Confidence:** HIGH

## Summary

Phase 13 is a **pure extension** of code that already ships. There is no new technical domain to learn and no external dependency to add — the entire phase is built from primitives that exist in `src/components/audience-lens/`, `src/components/board/_kit/PersonaGraph.tsx`, `src/components/reading/persona-cloud.tsx`, and the Flash text-mode engine path in `src/lib/engine/flash/`. The research therefore focuses on the one output that matters: a precise map of the existing seams so plans extend rather than rebuild. `[VERIFIED: codebase]`

The single most important finding is that **every "door" the phase adds already has a one-line mount precedent**. The four card blocks (`idea/hook/script/remix-card-block.tsx`) already wrap their lead `scrollQuote` in `<LensTrigger flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)} …>` — Surface 3 (per-card reaction at rest) is a *promotion of this exact wrapper*, not a sibling element. The persistent presence (Surface 1) mounts in one place: the `homeThreadMode` scroll region in `composer.tsx` (the `composer-thread-region` div, L1102-1107). Type-to-room (Surface 4) is the only piece that needs **new server code** — a thin reaction route — because `/api/tools/chat` streams *markdown*, not a stop/scroll reaction. The reaction primitive it must reuse (`runFlashTextMode` → `aggregateFlash` → lead `scrollQuote` → `cardScrollQuoteReactions`) is fully built and already used by every skill runner. `[VERIFIED: codebase]`

The honesty spine and determinism gate are **enforced by existing code shapes**, not by new discipline: `cardScrollQuoteReactions` returns `[]` on unparseable input (so `LensTrigger` collapses to its plain child — the honest silent degrade), it never fabricates per-persona quotes, and per-card/spotlight reactions reuse already-emitted `fraction` + `scrollQuote` data with **zero new model calls** (determinism-gate-safe, no `ENGINE_VERSION` bump). The only model call in the whole phase is one Flash call per explicit type-to-room submit. `[VERIFIED: codebase]`

**Primary recommendation:** Build three new entry points (persistent presence component, promoted per-card cue, type-to-room input) + one thin reaction API route, all converging on the **one shipped `<AudienceLens>`**. Reuse `LensTrigger`'s mount pattern verbatim, the `PersonaCloud`/`PersonaGraph` dot-cloud + `mulberry32` + `reducedMotion` + sr-only-mirror motion family verbatim, and the `runFlashTextMode`+`aggregateFlash`+`cardScrollQuoteReactions` data path verbatim. Do not fork, restyle, or re-color any of them.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 — Persistent presence + per-card reactions; EXTEND, never duplicate.** Build a lightweight, always-docked **living-audience presence** (calibrated people, visible even between cards) **and** keep every generated skill card showing its room reacting **at rest** (the per-card layer). Both are entry points into the **one shipped `AudienceLens`** — this phase adds the always-present + addressable layer *on top of* P9, it does not rebuild the Lens. The presence **idles** (shows the roster, no reaction) when no concept is in focus — never invents a reaction to nothing.
- **D-02 — Live spotlight with a named subject; reactions are NEVER aggregated.** A thread holds many concepts (ideas → hooks → a test), each with its **own** real reaction. Blending them is forbidden (averaging across content types = slop). The persistent presence reflects **ONE in-focus concept at a time**, with a visible **"reacting to: <hooks>"** subject. It **defaults to the latest generation** and **re-focuses** when the creator taps/scrolls to a specific card or types a thought into it. Each card **keeps its own durable inline reaction** — the scrollable per-concept ledger. The presence is a **moving spotlight**, not a running average and not a dashboard.
- **D-03 — On every generated card + presence mirrors the focused concept.** Each card reacts **as it lands**, using the real data every skill already emits (the N/T stop fraction + the lead `scrollQuote`) — **no new model calls**, determinism-gate-safe. The persistent presence's reaction state = the **focused** concept's real reaction (per D-02). Reuses `flat-card-reactions`.
- **D-04 — Type a thought → the room REACTS (not conversational).** The persistent presence is **addressable**: type any concept/idea into it → a **real SIM reaction** comes back (stop/scroll fraction + real verbatim quotes), reusing the **Flash text-mode reaction primitive** every card already uses — an instant "test this against my people" without running a full skill. Typing sets the presence's spotlight **subject** to your ad-hoc thought (D-02). This is a **reaction**, **not** whole-room conversational Q&A. Conversational depth is preserved **one tap deeper** — chat a single persona via the Lens (P9 D-03). "Ask the whole room" stays deferred.
- **D-05 — Keep P9's per-card Lens as the per-artifact depth; one Lens, many doors.** Every card retains **tap → full Lens** scoped to THAT concept (persona drill · chat-one-persona · cluster · Population · Rewrite-for-audience). The ambient presence is **additive**: the **per-card tap**, the **presence spotlight**, and **type-to-room** ALL open the **same single `AudienceLens`**, scoped to their concept. "Extend the primitive, do NOT duplicate it" is honored by routing every door to the one Lens.
- **D-06 — Interact + value = reuse the shipped Lens.** The value layer (drill, chat-with-persona, cluster/Population, Rewrite-for-audience) is **P9, already built**. Ambient is the always-present **entry**; the Lens is the **depth**. Do not rebuild it.

**Honesty posture (hard-binding, carried from P9 D-02 / P11 D-02):** never fabricate a reaction or quote; reactions are **always to one real, labeled concept**; the presence **idles** when nothing is in focus; degrade gracefully on thin signal.

**Engine posture (carried):** UI / text-path work only — no `ENGINE_VERSION` bump, keep the engine + KC regression suites green, preserve same-video SIM-1 Max score-identity, Qwen-only, reuse the Flash text-mode reaction path.

### Claude's Discretion

- **Visual form + dock location** of the persistent presence (thin persona-cloud strip vs sentiment bar; thread header vs near the composer; collapsed/expanded states) — UI-phase; flat-warm SSOT (THEME-06), mobile-first, fixed typed-renderer library. *(NOTE: the approved 13-UI-SPEC.md has now DECIDED these — thin persona-cloud strip, sticky top of thread column. See `## Resolved by UI-SPEC` below.)*
- **Per-card "reaction at rest"** rendering — **prefer promoting the existing `LensTrigger` cue** (least duplication); exact encoding UI-phase. *(UI-SPEC decided: promote the existing wrapper, add fraction + thin ribbon inside it.)*
- **"reacting to: X" subject labeling** + the **re-focus interaction** (scroll-spy vs explicit tap vs both) — UI-phase. *(UI-SPEC decided: both, scroll-spy as ambient default + explicit tap wins momentarily.)*
- **Animation / motion** — reuse PersonaGraph's `mulberry32` deterministic + `reducedMotion` gating + sr-only mirror; no `Math.random`.
- **Type-to-room input** debounce / latency / loading affordance + where the input sits — planner/UI; keep it honest (label it a quick read, no fabricated voices). *(UI-SPEC decided: input inside expanded presence; SIM fires on explicit submit only — no keystroke calls.)*
- **Presence behavior vs the open-thread singleton** — planner; the presence lives in the thread, so be aware of the never-closed-singleton issue, but fixing it is not ambient scope.

### Deferred Ideas (OUT OF SCOPE)

- **→ New phase "Initiated Numen" (Phase 17):** PROACTIVE-01 morning drops, PROACTIVE-02 scheduled Explore / Automations, proactive delivery (in-thread drop + opt-in nudge). The cron + `user_settings`/notifications rails already exist — reference, do NOT build here.
- **"Ask the whole room" multi-persona conversational chat** — stays deferred (P9 D-03; v1 is one persona at a time, via the Lens's `PersonaChatDrawer`).
- **Live reaction in the MAIN composer as you type** (debounced Flash) — distinct from type-to-room; explicitly NOT chosen this pass (cost/latency/honesty bar).
- **Running-stack / dashboard view of recent reactions** — drifts toward the dashboard this phase resists.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AMBIENT-01 | The living, always-present audience — a persistent docked audience presence + per-card reactions at rest (always felt, never summoned) + type-to-room (type a thought → the room reacts, real SIM) + live spotlight on ONE in-focus labeled concept (re-focuses on tap/scroll/type; reactions never aggregated), all reusing P9's primitive. Keep P9's per-card Lens as the per-artifact depth. | Fully supported by existing seams. Persistent presence → mount in `composer.tsx` `composer-thread-region` (Surface 1, see Architecture Patterns Pattern 2). Per-card reactions → promote the existing `LensTrigger` wrapper on the 4 card blocks (Surface 3, Pattern 3). Type-to-room → NEW thin reaction route reusing `runFlashTextMode`+`aggregateFlash`+`cardScrollQuoteReactions` (Surface 4, Pattern 4) — the ONLY new server code. Spotlight → scroll-spy on the `overflow-y-auto` thread region + tap focus, reads each card's already-emitted `fraction`+`scrollQuote` (Pattern 5). One Lens many doors → all three open `<AudienceLens>` via `LensTrigger`'s mount pattern (Pattern 1). Honesty → `cardScrollQuoteReactions` returns `[]` → collapse; never fabricates (Don't Hand-Roll). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

The repo-root `CLAUDE.md` and the Virtuna project `CLAUDE.md` are authoritative. Directives that bind this phase:

- **Stack:** Next.js 15, TypeScript, Tailwind v4, Supabase. Server components by default; client only when interactive (the presence + input ARE interactive → `'use client'`, like every `audience-lens/*` file).
- **Tailwind v4 oklch inaccuracy:** very dark colors (L < 0.15) compile incorrectly in `@theme`. The flat-warm dark tokens already exist as exact values in `globals.css` — reuse the `var(--color-*)` tokens, never re-declare dark colors. `[CITED: ./CLAUDE.md]`
- **Lightning CSS strips `backdrop-filter`:** apply any blur via React inline `style={{ backdropFilter: … }}`, NEVER a CSS class. The flat-warm presence uses **no glass** anyway (matte `--color-surface`), so this likely does not arise — but if it does, inline-style it. `AudienceLens` already documents this (Pitfall 4). `[CITED: ./CLAUDE.md + AudienceLens.tsx]`
- **Raycast design language (verified 2026-02-08):** 6% borders (`--color-border` = `rgba(255,255,255,0.06)`), 10% hover, 12px card radius, Inter font, cream text never pure white. Coral is a signal only. The presence inherits all of this from the shipped components. `[CITED: ./CLAUDE.md]`
- **Dev-server CSS caching:** when CSS changes don't appear, kill dev server + clear `.next/` + `node_modules/.cache/` + browser cache. `[CITED: ./CLAUDE.md]`
- **File organization:** source in `/src`; keep files under 500 lines; typed interfaces for public APIs; validate input at system boundaries (the new reaction route must Zod-validate its body, like every `/api/tools/*` route). `[CITED: ./CLAUDE.md]`
- **Commit format:** `type(phase): description` (e.g. `feat(13): persistent audience presence`). `[CITED: ./CLAUDE.md]`
- **Test discipline:** `npm test` / `npm run build` after changes. NOTE the project's known Vitest caveat (memory `vitest-rtk-shim`): `npm test`/`npx vitest` print fake PASS(0)/FAIL(0); use `node ./node_modules/vitest/vitest.mjs run` as the authoritative runner. `[VERIFIED: project memory + STATE.md regression-gate entries]`
- **Engine regression gate (milestone hard constraint):** keep the engine + KC suites green; preserve same-video SIM-1 Max score-identity; `ENGINE_VERSION` stays **3.19.0** (this phase makes zero video-scoring changes); Qwen-only. `[CITED: STATE.md Hard Constraints]`

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Persistent presence UI (Surface 1) | Frontend Client (`'use client'`) | — | Interactive, motion-bearing, scroll-aware; mounts in `composer.tsx` client shell. No SSR data dependency beyond the audience already in client state. |
| Per-card reaction at rest (Surface 3) | Frontend Client | — | A promotion of the existing client `LensTrigger` wrapper on already-rendered card blocks. Pure presentation of already-emitted data. |
| Spotlight focus tracking (Surface 2) | Frontend Client | — | IntersectionObserver / scroll-spy + tap state over the existing `overflow-y-auto` thread region. Reads already-rendered card props. No server. |
| Type-to-room reaction (Surface 4) | **API / Backend** (new thin route) | Frontend Client (input + result wiring) | The ONLY capability needing server code — a Flash model call must run server-side (`runFlashTextMode` is server-only, imports `getQwenClient`). Client owns the input + routing the result into the spotlight + Lens. |
| Lens depth (Surface 5) | Frontend Client | — | The shipped `<AudienceLens>` (bottom `Sheet`). Already built; all three doors open it. Zero new work beyond passing `flatPersonas` + `conceptText`. |
| Active-audience load | Frontend Client (already lifted) | API (`/api/audiences` mount fetch — already exists) | The composer already loads `audiences[]` + tracks `selectedAudienceId` (L135-139). The presence reads `selectedAudience` from this lifted state — no new fetch. |

**Tier-assignment caution for the planner:** type-to-room is the one place a plan could mis-assign work to the client (calling Qwen from the browser). It MUST be a server route — `runFlashTextMode` imports `getQwenClient` and must not run client-side. Everything else is genuinely client-tier (extending already-mounted client components).

## Standard Stack

**No new packages.** This phase adds zero dependencies. Every primitive is first-party and already in the repo. `[VERIFIED: codebase — no install step exists in any plan-able task]`

### Core (existing, reused)
| Module | Path | Purpose | Why Standard |
|--------|------|---------|--------------|
| `AudienceLens` | `src/components/audience-lens/AudienceLens.tsx` | The one reusable Lens (cloud · drill · chat · cluster · Population · Rewrite). The depth all three doors open. | Shipped P9 (LIVE-06); the explicit "extend don't duplicate" mandate target. |
| `LensTrigger` | `src/components/audience-lens/LensTrigger.tsx` | The single shared per-card cue: wraps children in a ≥44px `role="button"` and opens `<AudienceLens>` in cascade mode. Built-in honest degrade: `flatPersonas.length === 0 → return <>{children}</>`. | The mount precedent for BOTH the presence and Surface 3; minimal-duplication path. |
| `cardScrollQuoteReactions(fraction, scrollQuote, leadArchetype?)` | `src/components/audience-lens/flat-card-reactions.ts` | Honest data path: real `"N/T stop"` fraction + lead `scrollQuote` → `FlatPersonaReaction[]`, never fabricating per-persona quotes. Returns `[]` on unparseable input. | Powers per-card reactions AND type-to-room result. The honesty enforcement point. |
| `runFlashTextMode(content_text, framing, panel?, audienceRepaint?)` | `src/lib/engine/flash/run-flash-text-mode.ts` | Fires ONE bounded Qwen json_object call → 10 per-persona verdicts + quotes. `temperature:0` + `seed:QWEN_SEED` (deterministic). Server-only (`getQwenClient`). | The Flash text-mode reaction primitive D-04 must reuse — same call every skill runner makes. |
| `aggregateFlash(personas)` | `src/lib/engine/flash/flash-aggregate.ts` | Pure: 10 verdicts → `{ band, fraction }` (e.g. `"6/10 stop"`). No numeric score (honesty spine). | The aggregate that feeds `cardScrollQuoteReactions`'s `fraction`. |
| `PersonaCloud` / `PersonaGraph` | `src/components/reading/persona-cloud.tsx`, `src/components/board/_kit/PersonaGraph.tsx` | The dot-cloud viz family: golden-angle Fibonacci layout, `mulberry32` seeded, cream-alpha fill, worst-cluster coral, `<animate>` pulse gated on `reducedMotion`, sr-only `<ul>` mirror. | The shipped "your audience" visual language; the presence's dot-cloud derives from this. |
| `PopulationSwarm` | `src/components/audience-lens/PopulationSwarm.tsx` | The cascade + sr-mirror + honesty-label + `"Reading the room…"` loading vocabulary precedent. | One vocabulary for "the SIM is reacting"; the type-to-room loading label reuses it. |
| `usePrefersReducedMotion()` | (imported in `composer.tsx` L113) | OS motion-preference hook; already used in the composer shell. | Source the presence's `reducedMotion` prop from this — already wired into the parent. |
| `getAudience` / `GENERAL_AUDIENCE` / `listAudiences` | `src/lib/audience/audience-repo.ts` | Loads the active audience the presence represents (name, personas, weights). General = virtual constant, `personas: []`. | The audience object the presence renders. Already loaded into composer state — no new fetch. |

### Supporting (existing, reused as-is)
| Module | Path | Purpose | When to Use |
|--------|------|---------|-------------|
| `PersonaChatDrawer` | `src/components/audience-lens/PersonaChatDrawer.tsx` | One-persona-at-a-time chat (P9 D-03). Reachable inside the Lens. | The "one tap deeper" conversational depth D-04 preserves; reused as-is via the Lens. |
| `buildFlatPersonaNodes` / `clusterFlatNodes` / `archetypeToSlot` / `FlatPersonaReaction` | `src/components/board/audience/audience-derive.ts` | The flat-reaction → node/cluster math the Lens consumes. `FlatPersonaReaction` (L490) is the shape `cardScrollQuoteReactions` returns. | Already consumed inside `AudienceLens`; the presence does not call these directly (it passes `flatPersonas` to `LensTrigger`/`AudienceLens`). |
| `Sheet` / `SheetContent` | `src/components/ui/sheet.tsx` | The bottom-sheet container the Lens renders in (`side="bottom"`, `max-h-[90vh]`, `rounded-t-[20px]`). | Inherited — do not touch; the Lens owns it. |
| `selectLeadScrollQuote(personas)` | (private in each runner, e.g. `hooks-runner.ts` L230) | Picks the lead verbatim: first stop-verdict persona's quote, else persona[0]'s. | The type-to-room route needs this logic — it is NOT exported; inline an identical copy in the route (4 runners already each duplicate it — matching that precedent is acceptable, or extract a shared helper). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A new thin reaction route for type-to-room | Reuse `/api/tools/chat` | **REJECTED.** `/api/tools/chat` streams **markdown** (`route.ts` L6, L92 `text/event-stream`, persists `markdown` blocks) — it is conversational Q&A, not a stop/scroll reaction. Type-to-room needs the **reaction** (band + fraction + quotes), which only the Flash path produces. The UI-SPEC §Surface 4 flags this explicitly. |
| A new thin reaction route | Reuse `flashRunner`/`runFlashRunner(content_text, framing)` (`flash-runner.ts` L100) | `runFlashRunner` returns `{ bandBlock, personasBlock }` — close, but the presence needs `fraction` + lead `scrollQuote` → `cardScrollQuoteReactions`. Simplest is a route that calls `runFlashTextMode` directly, `aggregateFlash` for the fraction, `selectLeadScrollQuote` for the quote, and returns `{ fraction, scrollQuote }` (mirrors what `hooks-runner`/`ideas-runner` already do per card — see `ideas-runner.ts` L367-382). |
| Promoting `LensTrigger` for Surface 3 | A separate inline reaction line above the cue | **Owner discretion already chose promotion** (D-01 discretion + UI-SPEC §Surface 3): least duplication, one wrapper, keeps the honest collapse-to-child degrade. |
| Dot-cloud strip for the presence | A flat sentiment bar | **UI-SPEC chose the dot-cloud:** a bar discards the "your people are individuals" read that is the moat; the dot-cloud is the shipped visual language for "your audience." |

**Installation:** none.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
   creator scrolls /     │  composer.tsx  (homeThreadMode branch)       │
   taps a card /         │  ┌───────────────────────────────────────┐  │
   types a thought       │  │ composer-thread-region (overflow-y-auto)│  │
        │                │  │  ┌─────────────────────────────────┐    │  │
        │   ┌────────────┼──┼─▶│ [NEW] Persistent Presence strip  │    │  │  Surface 1
        │   │ scroll-spy │  │  │  (sticky top) — dot-cloud +      │    │  │
        ▼   │ + tap focus│  │  │  "reacting to: X" + type input   │◀───┼──┼── Surface 2 (subject)
   ┌────────┴──┐         │  │  └─────────────┬───────────────────┘    │  │  Surface 4 (input)
   │ FOCUS state│◀───────┼──┼──── reads ─────┘  (focused card's        │  │
   │ (1 concept)│        │  │                    fraction + scrollQuote)│  │
   └─────┬──────┘        │  │  ┌──────────────────────────────────┐    │  │
         │               │  │  │ *-thread-view → *-card-block ×N  │    │  │
         │               │  │  │  each wraps lead quote in:        │    │  │
         │               │  │  │  <LensTrigger flatPersonas=       │◀───┼──┼── Surface 3
         │               │  │  │    cardScrollQuoteReactions(...)> │    │  │  (promote this)
         │               │  │  └──────────────┬───────────────────┘    │  │
         │               │  └─────────────────┼────────────────────────┘  │
         │               │   bottom-pinned composer form (unchanged)       │
         │               └─────────────────────┼───────────────────────────┘
         │                                      │
         │  type-to-room submit                 │  any door taps open
         ▼  (explicit only)                     ▼
   ┌──────────────────────────┐         ┌───────────────────────────────┐
   │ [NEW] POST /api/tools/    │         │  <AudienceLens>  (bottom Sheet)│  Surface 5
   │   react  (server)         │         │  ── the ONE shipped Lens ──    │  (one Lens,
   │  runFlashTextMode(text,   │         │  cloud·drill·chat·cluster·     │   many doors)
   │   "hook"/"idea", panel,   │────────▶│  Population·Rewrite            │
   │   audienceRepaint)        │ flatPer-│  (NO restyle, NO fork)         │
   │  → aggregateFlash → frac  │ sonas + └───────────────────────────────┘
   │  → selectLeadScrollQuote  │ concept
   │  → { fraction, scrollQuote}│ Text
   └──────────────────────────┘
   (the ONLY new model call; one per explicit submit; ENGINE_VERSION unchanged)
```

Trace the primary use case: creator generates hooks → each hook card lands with its `fraction`+`scrollQuote` already emitted → Surface 3 shows it at rest (promoted `LensTrigger`) → the presence (Surface 1) defaults its spotlight to the latest card and shows `reacting to: <that hook>` (Surface 2) → creator scrolls up, scroll-spy re-focuses the spotlight to the card under the focus line, swapping the subject + dot toning (no model call — reads already-emitted data) → creator types "what if I open with a question?" into the presence input (Surface 4) → POST to the new reaction route → real Flash reaction returns → spotlight subject becomes the typed thought + the Lens opens scoped to it (Surface 5).

### Recommended Project Structure

```
src/
├── components/
│   ├── audience-lens/                  # EXISTING — extend, do not fork
│   │   ├── AudienceLens.tsx            #   (unchanged — the depth)
│   │   ├── LensTrigger.tsx             #   (unchanged — reused as mount precedent)
│   │   ├── flat-card-reactions.ts      #   (unchanged — the honest data path)
│   │   └── ambient-presence.tsx        #   [NEW] Surface 1/2/4 — the persistent strip
│   │                                   #         (or under src/components/thread/ — planner choice;
│   │                                   #          audience-lens/ keeps the family together)
│   ├── thread/
│   │   ├── {idea,hook,script,remix}-card-block.tsx  # EDIT — promote the LensTrigger cue (Surface 3)
│   │   └── ... (thread views unchanged — presence mounts in composer, not per-view)
│   └── app/home/
│       └── composer.tsx                # EDIT — mount the presence in composer-thread-region;
│                                       #        pass selectedAudience + reducedMotion + openThreadId;
│                                       #        own the focus state + scroll-spy ref
└── app/api/tools/
    └── react/                          # [NEW] the thin type-to-room reaction route
        └── route.ts                    #   runFlashTextMode → aggregateFlash → lead quote → { fraction, scrollQuote }
```

*(Path names are illustrative — the planner picks final names. The load-bearing facts are: ~5 edited files + 1 new component + 1 new route.)*

### Pattern 1: One Lens, many doors (the spine of the phase)
**What:** Every entry point constructs the same `<AudienceLens>` from `flatPersonas` + `conceptText`. The cleanest reuse is `LensTrigger` itself, which already does exactly this.
**When to use:** All three doors (Surface 3 per-card tap, Surface 1/2 spotlight open, Surface 4 type-to-room result).
**Example:**
```tsx
// Source: src/components/audience-lens/LensTrigger.tsx (verbatim shipped pattern)
// LensTrigger wraps children in a ≥44px role=button and opens the Lens in cascade mode.
<LensTrigger
  flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)}  // [] ⇒ collapses to children
  conceptText={hookLine}            // grounds "Ask them why →" inside the Lens
  rewrite={buildCardRewrite({...})} // the Rewrite-for-audience loop (P9), optional
  label="See how the room reacted to this hook"
>
  <blockquote>…lead scrollQuote…</blockquote>
</LensTrigger>
```
For the **presence spotlight** and **type-to-room**, you may either reuse `<LensTrigger>` (wrapping the strip's open cue / the result affordance) OR construct `<AudienceLens open … onOpenChange … flatPersonas … conceptText … />` directly (the same props `LensTrigger` passes — see `AudienceLens.tsx` L71-81). Both are byte-identical depth.

### Pattern 2: Mount a persistent surface in the thread scroll region
**What:** The persistent presence docks at the top of the scrollable thread column, NOT on the composer form.
**When to use:** Surface 1.
**Example:**
```tsx
// Source: src/components/app/home/composer.tsx L1091-1114 (the homeThreadMode branch)
if (homeThreadMode) {
  return (
    <div className="flex h-full w-full max-w-[760px] mx-auto flex-col">
      {/* mount the presence as a sticky strip at the top of THIS scroll region */}
      <div data-testid="composer-thread-region" className="flex-1 min-h-0 overflow-y-auto">
        {/* [NEW] <AmbientPresence …/> sticky top:0 here, above threadContent */}
        {threadContent}
      </div>
      <div className="shrink-0 pb-4 pt-2">{composerForm}</div>
    </div>
  );
}
```
**Rationale (from UI-SPEC + verified layout):** the composer form is already dense (`[+] · skill pill · audience · intent · model · send` + upward-opening popovers, L1038-1068) and its slash menu + audience popover open *upward* (`absolute bottom-[calc(100%+10px)]`, L942) — docking the presence on the composer would collide. The sticky thread-header keeps the audience "always felt" as the ledger scrolls. The `overflow-y-auto` region (L1104) is also the exact scroll container Surface 2's scroll-spy must observe.
**Note (the Branch-B case):** there are TWO render branches. `homeThreadMode` (thread exists, L1091) has the scroll region above. The centered branch (L1118, empty home / permalink) stacks `threadContent` then `composerForm` with no dedicated scroll region. The presence must render an **idle roster** in the empty-home case (D-01 idle state) — confirm both branches mount it (or the planner decides idle-empty-home is acceptable to skip; the UI-SPEC implies the presence "never hides").

### Pattern 3: Promote `LensTrigger` for the per-card reaction-at-rest
**What:** Surface 3 is NOT a new component — it adds resting-state content (stop fraction + thin sentiment ribbon) *inside* the already-wrapped `LensTrigger` cue on each card block.
**When to use:** The four card blocks `idea/hook/script/remix-card-block.tsx`.
**Example (current state on each card — the thing to promote):**
```tsx
// Source: src/components/thread/hook-card-block.tsx L133-151 (identical shape on all 4)
<LensTrigger flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)} conceptText={hookLine} …>
  <blockquote className="… italic">"{scrollQuote}"</blockquote>   // ← promote: add fraction + ribbon here
</LensTrigger>
```
The promotion adds, INSIDE this wrapper (no sibling): `{stop}/{total} stop` (tabular-nums, `--color-foreground`) + a thin `h-[3px]` cream-vs-muted ribbon, keeping the existing italic verbatim. The band chip stays where it is (the existing secondary chip row, L154-171). Degrade: when `cardScrollQuoteReactions(...)` returns `[]`, `LensTrigger` already collapses to the plain child — render nothing extra.

### Pattern 4: The thin type-to-room reaction route (the ONLY new server code)
**What:** A new `POST` route that fires ONE Flash text-mode reaction and returns the fraction + lead quote.
**When to use:** Surface 4 type-to-room.
**Example (assembled from the runner precedent):**
```ts
// Source pattern: src/lib/tools/runners/ideas-runner.ts L325-382 + flash-runner.ts L100-115
// Auth-first + Zod-validate body (CLAUDE.md boundary rule), then:
const { result } = await runFlashTextMode(text, "hook", panel, audienceRepaint);
const { fraction } = aggregateFlash(result.personas);        // "N/10 stop"
const scrollQuote = selectLeadScrollQuote(result.personas);  // first stop persona's quote
return Response.json({ fraction, scrollQuote });
// Client then: cardScrollQuoteReactions(fraction, scrollQuote) → flatPersonas → spotlight + Lens.
```
**Critical details:**
- `panel`/`audienceRepaint` come from the active audience. To get a real niche-discriminating reaction (not the "all Mixed" generic failure mode — see `flash-aggregate.ts` L44-56), the route should resolve the niche panel the same way the skill runners do (via `resolveNicheKey` at the runner layer — KCQ-06, `wave3/niche-resolver.ts`, wired in 14-01) and pass the audience's stored repaint. Confirm the exact panel-build helper the runners share before planning. `[VERIFIED: codebase — ideas-runner/hooks-runner build `panel` + `audienceRepaint` before the Flash call]`
- **Framing:** `"hook"` vs `"idea"` — type-to-room is an ad-hoc thought; `"hook"` (first-2s "do you stop?") is the natural default for "test a thought," matching what every card-level reaction uses. Planner/owner confirm.
- **No streaming needed** — `runFlashTextMode` returns whole (one ~8-17s call). A simple JSON POST is fine; the client shows `"Reading the room…"` while awaiting.
- **No `ENGINE_VERSION` bump** — text path, reuses the shipped primitive, Qwen-only.
- **Determinism:** `temperature:0 + seed:QWEN_SEED` already baked into `runFlashTextMode` — same thought → same reaction.

### Pattern 5: Spotlight focus tracking (scroll-spy + tap)
**What:** Surface 2 tracks the ONE in-focus card and mirrors its already-emitted reaction (never aggregates).
**When to use:** The presence subject + dot toning.
**Example (recommended approach):**
```tsx
// IntersectionObserver over the card elements inside composer-thread-region (root = that scroll div).
// On the card crossing a focus line (nearest top under the sticky strip), set focus state to that
// card's { conceptText, fraction, scrollQuote } — all already rendered props. Tap on a card (or its
// promoted cue) sets focus immediately and wins over scroll-spy momentarily (sticky until next
// deliberate scroll). Default focus = the last/latest card on thread load.
```
**Why IntersectionObserver:** the thread region is a discrete `overflow-y-auto` container (composer.tsx L1102-1104); IO with `root` set to that element is the idiomatic, deterministic, SSR-safe scroll-spy. Throttle subject swaps. No `Math.random`, no `Date.now` in render. There is no existing scroll-spy machinery to reuse — this is genuinely new client logic (the only non-trivial new client code besides the presence shell). `[VERIFIED: codebase — no scroll-spy/IntersectionObserver currently in the thread layer]`
**Honesty:** the spotlight is a *view onto* each card's durable reaction, never a running average. Each card keeps its own reaction (Surface 3). The presence reads the focused card's data — zero new model calls on re-focus (D-03 determinism-safe).

### Anti-Patterns to Avoid
- **Forking or restyling `AudienceLens`** — the explicit ROADMAP mandate is "EXTEND, do NOT duplicate." All three doors open the ONE Lens unchanged. `[VERIFIED: ROADMAP + CONTEXT D-05/D-06]`
- **Calling Qwen from the client** — `runFlashTextMode` is server-only (`getQwenClient`). Type-to-room MUST be a server route.
- **Aggregating reactions across cards** — forbidden (D-02). The spotlight shows exactly one labeled concept; blending content types = slop.
- **Fabricating a reaction when nothing is in focus** — the presence idles (roster, no verdict). `cardScrollQuoteReactions([]) → []` and `LensTrigger`'s collapse are the enforcement.
- **Re-introducing a model call on re-focus or on card render** — per-card + spotlight reuse already-emitted data only. A new call would break the determinism gate and imply an `ENGINE_VERSION` concern.
- **Using `/api/tools/chat` for type-to-room** — it streams markdown, not a reaction (see Alternatives Considered).
- **Hardcoding `#FF7F50` coral** — see Common Pitfall 3.
- **Coral as decoration** — coral is a signal only (worst-cluster dot, inherited Rewrite CTA, MAX badge). A "good" reaction is cream, never coral. `[CITED: 13-UI-SPEC.md §Color]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Turning a card's reaction into Lens-ready personas | A new fabricated `{archetype, verdict, quote}[]` builder | `cardScrollQuoteReactions(fraction, scrollQuote)` | Already honest (real N/T counts, single real lead quote, every other persona quote-empty, `[]` on bad input). Re-implementing risks fabricating quotes — the exact honesty-spine violation the phase forbids. |
| Firing a SIM reaction to text | A new engine path / new Qwen call shape | `runFlashTextMode(text, framing, panel, audienceRepaint)` + `aggregateFlash` | Bounded, deterministic (`temp:0+seed`), Qwen-only, already isolated from the video-scoring path (no `ENGINE_VERSION` risk). Every skill runner already uses it. |
| The dot-cloud "your audience" visual | A new chart/sentiment-bar viz | `PersonaCloud` / `PersonaGraph` layout + `mulberry32` + cream-alpha fill + sr-only mirror | The shipped visual language; SSR-hydration-stable, deterministic, motion-gated, accessible. A new viz would diverge from the moat's established "individuals" read. |
| Motion that respects accessibility + determinism | A `Math.random`/`Date.now`-driven animation | The `<animate>` pulse gated on `reducedMotion` + `mulberry32` seed (PersonaGraph L231-238) | Hard-stops under `prefers-reduced-motion`, never breaks SSR hydration, always ships the sr-only mirror. The repo's MotionConfig layer + globals.css media query already enforce the OS preference. |
| The Lens depth (drill/chat/cluster/Population/Rewrite) | Any of it | `<AudienceLens>` | It is P9, shipped and tested (LIVE-01..07). The whole phase premise is reusing it. |
| Opening the Lens with a ≥44px tap target + a11y | A new button wrapper | `LensTrigger` (role=button, Enter/Space, minHeight:44, hover lift) | The shipped mount precedent; matches the reuse-contract a11y rules. |

**Key insight:** in this domain the "hard parts" (honest reaction derivation, deterministic SSR-safe motion, the Lens itself) are *already solved and already shipped*. Hand-rolling any of them is not just wasted effort — it actively risks violating the honesty spine or the determinism gate. The genuinely new code is small and presentational: a presence shell, a promotion edit on 4 cards, a scroll-spy, and one thin reaction route.

## Common Pitfalls

### Pitfall 1: Type-to-room wired to the chat (markdown) route instead of a reaction route
**What goes wrong:** A plan reuses `/api/tools/chat` (it's the obvious "type → response" route), and type-to-room returns prose, not a stop/scroll reaction.
**Why it happens:** Both are "type text → get something back"; the distinction (conversation vs reaction) is semantic, not structural.
**How to avoid:** Build the NEW thin reaction route (Pattern 4). The UI-SPEC §Surface 4 calls this out verbatim: "the `/api/tools/chat` route streams markdown, not a stop/scroll reaction — type-to-room needs the reaction route/runner (Flash text-mode), NOT the chat markdown route."
**Warning signs:** the type-to-room result has no `fraction`; the spotlight can't tone its dots; the result can't open the Lens (no `flatPersonas`).

### Pitfall 2: The Flash reaction comes back "all Mixed" (niche-blind)
**What goes wrong:** type-to-room fires `runFlashTextMode` without a resolved niche panel → the generic prompt produces ~5-7 stops on everything (the documented "all Mixed" failure mode).
**Why it happens:** `runFlashTextMode` only discriminates when `panel.niche` is non-null AND the niche is a real top-level instantiation key resolved via `resolveNicheKey` at the runner layer (14-01). Free-text `niche_primary` silently falls back to generic.
**How to avoid:** the reaction route must build `panel` (via the same `resolveNicheKey` path the skill runners use) + pass the active audience's stored `audienceRepaint`, exactly like `ideas-runner`/`hooks-runner` do before their Flash call. Confirm the shared panel-build helper before planning.
**Warning signs:** every typed thought returns a Mixed band; the discrimination the moat depends on is absent. `[VERIFIED: flash-aggregate.ts L44-61 + flash-runner/ideas-runner panel construction]`

### Pitfall 3: Re-introducing or propagating the legacy `#FF7F50` coral
**What goes wrong:** new per-card-reaction code (or the presence) hardcodes `#FF7F50` (or `rgba(255,127,80,…)`), introducing a third coral value that drifts from the THEME-06 SSOT (`--color-accent` = `#d97757`).
**Why it happens:** `hook-card-block.tsx` (L111-113, L256) and `idea-card-block.tsx` already hardcode `#FF7F50` on their archetype tag chips + CTAs — a copy-paste of the existing card code carries the legacy value forward.
**How to avoid:** new Ambient surfaces MUST use `var(--color-accent)`. The UI-SPEC says the executor SHOULD migrate any per-card-reaction code it touches to the token while promoting the cue (Surface 3) — but do not expand scope into untouched CTAs. Remember: a positive reaction is **cream**, not coral (coral would falsely read as alarm); coral on a reaction is reserved for the worst-cluster signal only.
**Warning signs:** grep for `#FF7F50` / `255,127,80` in any newly-added or edited line. `[VERIFIED: hook-card-block.tsx + idea-card-block.tsx + UI-SPEC §Color "Known inconsistency"]`

### Pitfall 4: Spotlight scroll-spy yanks focus away during deliberate examination
**What goes wrong:** the creator taps a card to focus it, but scroll-spy immediately re-focuses to whatever's under the focus line, fighting the user.
**Why it happens:** naive scroll-spy with no tap-priority.
**How to avoid:** UI-SPEC §Surface 2 decided the model: scroll-spy is the ambient default, but **explicit tap wins momentarily** — a tapped focus is sticky until the next tap or a deliberate scroll. Implement tap-priority, not last-event-wins.
**Warning signs:** subject label flickers; tapping a card doesn't "hold."

### Pitfall 5: Breaking the open-thread singleton awareness
**What goes wrong:** the presence assumes one-thread-per-render and mis-behaves across the never-closed-singleton issue (`thread-lifecycle-new-simulation-clear.md`: "New Simulation does not start a fresh thread — open thread is a never-closed singleton").
**Why it happens:** the presence lives in the thread; the thread is a singleton that "New Simulation" doesn't reset.
**How to avoid:** CONTEXT explicitly scopes this as **awareness only** — be aware the presence persists across what the user thinks are separate sessions, but **fixing the singleton is NOT ambient scope.** Don't try to fix it; just don't depend on a fresh-thread assumption.
**Warning signs:** the presence shows stale focus after "New Simulation." (Acceptable per scope — log, don't fix.) `[CITED: 13-CONTEXT.md Reviewed Todos]`

### Pitfall 6: Idle-at-rest not honored (fabricating a reaction to nothing)
**What goes wrong:** on empty home / before any card exists, the presence shows a reaction or a "0/0" placeholder.
**Why it happens:** defaulting the spotlight to a reaction state instead of the roster.
**How to avoid:** the idle state shows the roster dots at calm uniform cream, NO reaction, with the idle copy `Your people are here. Make something — or type a thought to test it.` (UI-SPEC §Surface 1). The honesty spine is a DESIGN constraint, not just engineering.
**Warning signs:** a reaction renders when no concept is in focus; an em-dash/silence is the honest degrade, never error-red.

## Resolved by UI-SPEC (decisions the planner inherits as fixed)

The approved `13-UI-SPEC.md` (AMBIENT-01, verified by gsd-ui-checker) has already converted the "Claude's Discretion" UI items into a fixed contract. The planner consumes these as locked, not open:

| Item | Decision |
|------|----------|
| Presence form | Thin **persona-cloud strip** (dot-cloud family, one dot per persona), NOT a sentiment bar. |
| Dock location | **Sticky top of the thread column** (`max-w-[760px]`, `position: sticky; top: 0`), NOT on the composer. Local stacking context, below the composer popovers (`--z-sticky` = 200). |
| Collapsed strip height | **48px** (`--spacing-12`) on mobile; expanded is self-sizing `max-h-[40vh]` with internal scroll. |
| Per-card reaction | **Promote the existing `LensTrigger`** (fraction + thin `h-[3px]` ribbon + existing italic quote, inside the same wrapper). |
| Subject label | `reacting to: {concept}` — prefix muted, concept `--color-foreground`, `truncate` one line. Required whenever a reaction shows; absent only when idle. |
| Re-focus model | **Both** — scroll-spy primary (ambient), explicit tap wins momentarily, type-to-room sets subject to the typed thought. |
| Type-to-room placement | Inside the **expanded presence**; SIM fires on **explicit submit only** (no keystroke calls). Loading label `Reading the room…`; honesty caption `A quick SIM read on your {audienceName} — not a full Test.` |
| Motion | Reuse PersonaGraph `<animate>` pulse gated on `reducedMotion`; hard-stop under reduce; always-present sr-only mirror; `mulberry32` only, no `Math.random`/`Date.now`. |
| Color law | Coral = signal only (worst-cluster dot, inherited Rewrite CTA, MAX badge, focus ring). Positive reaction = cream. No coral on the presence container/border/title/subject/input/liveness. |
| Lens continuity | All three doors open the same `<AudienceLens>` bottom Sheet (`side="bottom"`, `max-h-[90vh]`, `rounded-t-[20px]`), `conceptText` = the door's concept. No restyle/fork. |

All tokens the UI-SPEC references (`--color-foreground-secondary`, `--color-foreground-muted`, `--color-surface-elevated`, `--color-accent`, `--spacing-12` = 48px, `--z-sticky` = 200, `--duration-normal` = 200ms, `--ease-out-cubic`) are confirmed present in `src/app/globals.css`. `[VERIFIED: codebase — globals.css lines 72/88/92/93/96/184/188/197]`

## Code Examples

### Reading the active audience the presence renders
```tsx
// Source: src/components/app/home/composer.tsx L135-141 (already lifted in the parent)
const [audiences, setAudiences] = useState<Audience[]>([]);                 // loaded on mount
const [selectedAudienceId, setSelectedAudienceId] = useState<string | null>(null); // null = General
const selectedAudience = audiences.find((a) => a.id === selectedAudienceId) ?? null;
// Pass selectedAudience to the presence. General = { personas: [], name: "General", … } (virtual constant).
// Presence subtitle: `${N} calibrated people` for calibrated; "General audience · default panel" for General.
```

### The honest data path (per-card + type-to-room result)
```ts
// Source: src/components/audience-lens/flat-card-reactions.ts (cardScrollQuoteReactions)
// real "6/10 stop" + lead quote → 10 flat personas (6 stop / 4 scroll), lead carries the one real
// verbatim, every other persona quote-empty. Returns [] when the fraction can't be parsed → Lens omits.
const flatPersonas = cardScrollQuoteReactions(fraction, scrollQuote);
```

### Deterministic, motion-gated dot pulse (the presence viz)
```tsx
// Source: src/components/board/_kit/PersonaGraph.tsx L231-238 (reuse verbatim)
{!reducedMotion && (
  <animate attributeName="opacity" values="0.85;1;0.85" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
)}
// + the sr-only <ul> mirror (L287-295) and mulberry32 seed (L59-67). No Math.random.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-card Lens summoned by a tap (P9 `LensTrigger` cue) | Always-felt persistent presence + reaction-at-rest + type-to-room, all opening the same Lens | This phase (P13) | The audience becomes a companion, not a panel. The Lens is unchanged; only the entry points multiply. |
| `niche_primary` free-text → generic Flash (all-Mixed) | `resolveNicheKey` at the runner layer → real niche-discriminating panel | P14 (14-01, KCQ-06) | type-to-room MUST route through the resolved-niche path to get a discriminating reaction (Pitfall 2). |
| Coral `#FF7F50` (legacy Virtuna) | `--color-accent` = `#d97757` (THEME-06 flat-warm) | v5.0 numen-rework | New surfaces use the token; do not propagate the legacy hex (Pitfall 3). |

**Deprecated/outdated:**
- Hardcoded `#FF7F50` on card chips/CTAs — legacy; the SSOT is `var(--color-accent)`. Migrate touched code only.
- `/api/tools/chat` for anything reaction-shaped — it's markdown/conversational; reactions come from the Flash path.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Type-to-room's default framing is `"hook"` (first-2s "do you stop?"), matching every card-level reaction. | Pattern 4 | Low. If the owner wants `"idea"` framing ("in your niche, would this make you stop/share?"), it's a one-arg change in the route. Both framings are shipped in `FlashFraming`. Surface to owner in discuss/plan. |
| A2 | The reaction route resolves the niche panel via the same `resolveNicheKey`/`panel`+`audienceRepaint` construction the skill runners use (not a hand-built generic panel). | Pattern 4 / Pitfall 2 | Medium. If it skips this, type-to-room returns all-Mixed (niche-blind) — a moat-credibility miss. The planner must confirm the exact shared panel-build helper the runners call before the Flash call (it's inline in each runner today; may need light extraction). |
| A3 | The presence renders an idle roster on empty-home (Branch B), not only in `homeThreadMode`. | Pattern 2 | Low/Medium. UI-SPEC implies the presence "never hides," but the centered branch (L1118) has no scroll region. If the owner accepts no presence on truly-empty home, scope shrinks. Confirm in plan. |
| A4 | `selectLeadScrollQuote` logic is inlined/copied into the new route (it is private per-runner, not exported). | Supporting stack | Trivial. Four runners already each duplicate it; matching that precedent (or extracting one shared helper) are both fine. |
| A5 | The presence reads the active audience from lifted composer state (`selectedAudience`), not from a new `/api/threads/open` field. | Architectural Responsibility Map | Low. `/api/threads/open` returns `{ threadId, messages }` only — it does NOT return `active_audience_id`. The composer already has the audience in state; reuse it. Verified. |

**If the owner confirms A1-A3 during plan/discuss, all assumptions resolve to locked decisions.**

## Open Questions (RESOLVED at plan time — Phase 13 planning)

1. **Where exactly does the shared niche-panel build live for the reaction route?**
   - What we know: `ideas-runner.ts` (L325-382) and `hooks-runner.ts` (L355-388) build a `panel` (via `resolveNicheKey`, 14-01) + `audienceRepaint` from the active audience before `runFlashTextMode`. The Flash call itself is identical.
   - What's unclear: whether that panel-build is already a callable shared helper or inlined in each runner (would need light extraction for the new route to reuse without duplication).
   - Recommendation: the planner reads `ideas-runner.ts` / `hooks-runner.ts` panel-construction lines and either calls the existing helper or extracts a small `buildReactionPanel(audience)` shared by the runners + the new route. Keep it byte-identical to the runners so type-to-room discriminates exactly like a card reaction.
   - **RESOLVED — `buildReactionPanel` shared helper (Plan 13-01).** Verified the panel/repaint build is inlined byte-identically in both runners (ideas L284-300, hooks L313-323); Plan 13-01 Task 1 extracts `buildReactionPanel(profileRow, audience)` and refactors both runners + the new react route onto it.

2. **Does the presence persist its expanded/collapsed state across re-focus and re-render?**
   - What we know: the Lens remembers scale per-Lens (`useLensScale`); the composer popovers use an outside-click/Escape effect (`composer-controls.tsx`).
   - What's unclear: whether collapsed/expanded is session-sticky or resets.
   - Recommendation: local component state is sufficient for v1 (UI-SPEC says "collapses on outside-tap/Escape"); reuse the composer's outside-click/Escape effect pattern. Not a blocker.
   - **RESOLVED — local component state + the composer outside-click/Escape effect (Plan 13-03).** AmbientPresence owns collapsed/expanded as local state and reuses the `composer-controls.tsx` L389-403 outside-click/Escape pattern to collapse; not session-persisted in v1.

3. **Type-to-room result lifecycle — does the ad-hoc reaction persist to the thread, or is it ephemeral?**
   - What we know: skill cards persist as blocks; chat persists markdown turns. Type-to-room is "a quick read, not a full Test" (UI-SPEC caption).
   - What's unclear: whether a typed-thought reaction should leave a durable artifact or vanish after the spotlight/Lens close.
   - Recommendation: default to **ephemeral** (it's a gut-check, not a saved concept) — matches the "not a full Test" framing and avoids polluting the thread ledger. Confirm with owner; if persistence is wanted later, it's additive.
   - **RESOLVED — ephemeral (Plans 13-01 + 13-03).** The react route persists nothing and AmbientPresence holds the type-to-room result in local state only; the ad-hoc reaction vanishes when the spotlight/Lens close — no thread-ledger pollution. Persistence stays additive if wanted later.

## Validation Architecture

> `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json` — this section is **SKIPPED** per the contract. The project's own regression gate (engine + KC suites green, `ENGINE_VERSION` unchanged, full vitest suite via `node ./node_modules/vitest/vitest.mjs run`) remains the binding test discipline for any phase that touches shared code — but this phase makes zero engine/scoring changes, so the gate is satisfied by construction (no video-scoring bytes touched). The planner should still add a BLOCKING regression-gate task at phase close per the milestone pattern (every prior phase did), and component tests for the new presence + reaction route following the existing `audience-lens/__tests__` + `api/tools/*/__tests__` precedents.

## Environment Availability

> **SKIPPED (Step 2.6):** this phase is UI + one thin text-path API route. No new external tools, services, runtimes, CLIs, or databases. The only runtime dependency is the existing Qwen/DashScope client (`getQwenClient`) already used by every skill — same `DASHSCOPE_API_KEY` env the shipped Flash path uses; no new credential. (Note: prior phases observed `DASHSCOPE_API_KEY` absent in the *execution* env, which gates only the LIVE half of engine tests — it does not block building or the pure tests; UAT exercises the live call.)

## Security Domain

> `workflow.security_enforcement` is `false` in `.planning/config.json` — this section is **OMITTED** per the contract. The one boundary note that still applies (from `./CLAUDE.md`, not ASVS): the new `/api/tools/react` route MUST be auth-first + Zod-validate its request body (the active-audience id is resolved server-side under the session via `getAudience`, never trusted from the body — matching the CR-01 pattern every `/api/tools/*` route already follows). Reactions delete/mutate nothing; no destructive surface.

## Sources

### Primary (HIGH confidence — verified in codebase this session)
- `src/components/audience-lens/{AudienceLens,LensTrigger,flat-card-reactions,PopulationSwarm,PersonaChatDrawer}.tsx/.ts` — the Lens + the honest data path + the mount precedent + loading vocabulary.
- `src/components/board/_kit/PersonaGraph.tsx`, `src/components/reading/persona-cloud.tsx` — the dot-cloud + `mulberry32` + `<animate>`+`reducedMotion` + sr-only-mirror motion family.
- `src/lib/engine/flash/{run-flash-text-mode,flash-aggregate}.ts` — the Flash reaction primitive + the band/fraction aggregate + the niche-discrimination calibration notes.
- `src/lib/tools/runners/{flash,ideas,hooks}-runner.ts` — `runFlashRunner`, the per-card reaction precedent (panel + repaint + `selectLeadScrollQuote`).
- `src/components/app/home/composer.tsx` — the dock location (`composer-thread-region`, `homeThreadMode` branch), lifted audience state, `usePrefersReducedMotion`, the upward popovers that justify the dock decision.
- `src/components/thread/{hook,idea,script,remix}-card-block.tsx`, `personas-block.tsx`, `hooks-thread-view.tsx` — the `LensTrigger`+`cardScrollQuoteReactions` mount sites + the legacy `#FF7F50` inconsistency.
- `src/lib/audience/audience-repo.ts` — `getAudience` / `GENERAL_AUDIENCE` / `listAudiences` (the audience object the presence renders).
- `src/app/api/tools/chat/route.ts` — confirmed markdown-streaming (NOT a reaction route) → type-to-room needs a new route.
- `src/app/api/threads/open/route.ts` — returns `{ threadId, messages }` only (no `active_audience_id`).
- `src/app/globals.css` — confirmed every UI-SPEC token exists.
- `.planning/phases/13-…/13-CONTEXT.md`, `13-UI-SPEC.md`, `13-DISCUSSION-LOG.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` — phase scope, locked decisions, requirement IDs, constraints.

### Secondary (MEDIUM confidence)
- Project memory (`MEMORY.md` index): `vitest-rtk-shim` (authoritative test runner), `numen-tools-vision`, `phase9-audiencelens-ux` (LIVE-* lineage) — used for the test-runner caveat + lineage context.

### Tertiary (LOW confidence)
- None. This research is grounded entirely in the live codebase + the phase's own locked artifacts; no external/web sources were needed (no new libraries, no API integration, no unknowns outside the repo).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every reused module read in full this session; no new packages.
- Architecture / seams: HIGH — exact file paths, line numbers, mount precedents, and the dock location verified against live code.
- Type-to-room route: HIGH on the data path (the exact primitive + aggregate + lead-quote selector confirmed), MEDIUM on the niche-panel construction (Open Q1 — inline-vs-shared-helper to confirm at plan time).
- Pitfalls: HIGH — each grounded in a specific shipped code shape (markdown chat route, niche-blind calibration notes, hardcoded `#FF7F50`, singleton todo).

**Research date:** 2026-06-20
**Valid until:** 2026-07-20 for the codebase seams (stable, no fast-moving external deps). Re-verify the niche-panel build helper (Open Q1) at plan time in case 14-01's runner-layer wiring is refactored.
