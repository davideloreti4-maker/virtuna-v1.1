# Phase 13: Ambient Numen — the living, always-present audience - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

> **Phase narrowed during discussion.** ROADMAP names this phase "Proactive Numen
> (Ambient + Initiated)". The owner cut it to the **Ambient** layer only. The entire
> **Initiated** half — PROACTIVE-01 (morning drops), PROACTIVE-02 (scheduled
> Explore / Automations), and the proactive delivery/notification mechanism — is
> **deferred to a new future phase "Initiated Numen."** See Deferred Ideas.
> **⚠ ROADMAP reconciliation required:** rename Phase 13 → "Ambient Numen" (AMBIENT-01
> only) and add the new "Initiated Numen" phase carrying PROACTIVE-01/02 + delivery
> (run `/gsd-phase` to apply before planning the Initiated work).

<domain>
## Phase Boundary

Make the audience **alive and always present** — turn "tested against YOUR audience"
from a *summoned tap* (P9's per-card Lens cue) into an **always-felt, reacting,
addressable presence** in the thread. The 10 calibrated personas become a persistent
companion: you can see them, watch them react to what you make, and **type to them**
to test a thought — all without summoning a panel.

This is the **AMBIENT-01** requirement only. It **EXTENDS** the shipped P9 reaction
primitive (`AudienceLens` / `LensTrigger`) — it does **NOT** duplicate or replace it.

**In scope (P13 Ambient):**
- A persistent, always-docked **living-audience presence** (your calibrated people,
  felt even between cards) — D-01.
- **Per-card reactions** on every generated skill card, shown at rest (not hidden
  behind a tap) — D-01/D-03.
- The presence as a **live spotlight** on the in-focus concept, with a named subject,
  re-focusing as the creator navigates the thread — D-02.
- **Type-to-room**: type any thought into the presence → real SIM reaction returns — D-04.
- **Retain** P9's per-card Lens as the per-artifact depth; every entry opens the **same
  single Lens** — D-05.

**Out of scope (→ deferred, see Deferred Ideas):**
- PROACTIVE-01 morning drops, PROACTIVE-02 scheduled Explore / Automations, proactive
  delivery (in-thread drop + opt-in nudge) → **new phase "Initiated Numen."**
- "Ask the whole room" multi-persona **conversational** chat (stays deferred, P9 D-03).
- Live reaction in the **main composer** as you type (distinct from type-to-room).
- A running-stack / dashboard view of recent reactions (the phase resists dashboards).

**Honesty posture (hard-binding, carried from P9 D-02 / P11 D-02):** never fabricate a
reaction or quote; reactions are **always to one real, labeled concept**; the presence
**idles** when nothing is in focus; degrade gracefully on thin signal.

**Engine posture (carried):** UI / text-path work only — no `ENGINE_VERSION` bump, keep
the engine + KC regression suites green, preserve same-video SIM-1 Max score-identity,
Qwen-only, reuse the Flash text-mode reaction path.

</domain>

<decisions>
## Implementation Decisions

### Area 1 — Ambient surface (AMBIENT-01)
- **D-01 — Persistent presence + per-card reactions; EXTEND, never duplicate.** Build a
  lightweight, always-docked **living-audience presence** (your calibrated people,
  visible even between cards) **and** keep every generated skill card showing its room
  reacting **at rest** (the per-card layer). Both are entry points into the **one shipped
  `AudienceLens`** — this phase adds the always-present + addressable layer *on top of*
  P9, it does not rebuild the Lens. The presence **idles** (shows the roster, no reaction)
  when no concept is in focus — never invents a reaction to nothing.

### Area 2 — Differentiating many concepts in one thread (the core honesty question)
- **D-02 — Live spotlight with a named subject; reactions are NEVER aggregated.** A thread
  holds many concepts (ideas → hooks → a test), each with its **own** real reaction.
  Blending them is forbidden (averaging across content types = slop). So the persistent
  presence reflects **ONE in-focus concept at a time**, with a visible **"reacting to:
  &lt;hooks&gt;"** subject. It **defaults to the latest generation** and **re-focuses**
  when the creator taps/scrolls to a specific card or types a thought into it. Each card
  **keeps its own durable inline reaction** — the scrollable per-concept ledger (this hook
  6/10, that idea 3/10) — so differentiation is permanent per card. The presence is a
  **moving spotlight**, not a running average and not a dashboard.

### Area 3 — Reaction trigger (when/what it reacts to)
- **D-03 — On every generated card + presence mirrors the focused concept.** Each card
  reacts **as it lands**, using the real data every skill already emits (the N/T stop
  fraction + the lead `scrollQuote`) — **no new model calls**, determinism-gate-safe. The
  persistent presence's reaction state = the **focused** concept's real reaction (per D-02).
  Honest, cheap, reuses `flat-card-reactions`.

### Area 4 — Type-to-room (the "interact + feel real" cheatcode)
- **D-04 — Type a thought → the room REACTS (not conversational).** The persistent presence
  is **addressable**: type any concept/idea into it → a **real SIM reaction** comes back
  (stop/scroll fraction + real verbatim quotes), reusing the **Flash text-mode reaction
  primitive** every card already uses — an instant **"test this against my people"** without
  running a full skill. Typing sets the presence's spotlight **subject** to your ad-hoc
  thought (D-02). This is a **reaction**, **not** whole-room conversational Q&A. *Rationale:*
  reaction = the moat (foresight, not a chatbot), the right **tempo** for an always-on
  ambient layer (fast, glanceable, many-times-a-day), the **honest** path (one real aggregate
  vs N fabricated voices), and the smallest build. Conversational depth is preserved **one
  tap deeper** — chat a single persona via the Lens (P9 D-03). "Ask the whole room" stays
  deferred.

### Area 5 — Relationship to P9 (extend, don't duplicate)
- **D-05 — Keep P9's per-card Lens as the per-artifact depth; one Lens, many doors.** Every
  card retains **tap → full Lens** scoped to THAT concept (persona drill · chat-one-persona ·
  cluster · Population · Rewrite-for-audience). This **is** how the creator examines hooks vs
  the test separately and goes deep. The ambient presence is **additive**: the **per-card
  tap**, the **presence spotlight**, and **type-to-room** ALL open the **same single
  `AudienceLens`**, scoped to their concept. Nothing P9 shipped is discarded — "extend the
  primitive, do NOT duplicate it" (ROADMAP mandate) is honored by routing every door to the
  one Lens.
- **D-06 — Interact + value = reuse the shipped Lens.** The value layer (drill, chat-with-
  persona, cluster/Population, Rewrite-for-audience) is **P9, already built**. Ambient is the
  always-present **entry**; the Lens is the **depth**. Do not rebuild it.

### Claude's Discretion
- **Visual form + dock location** of the persistent presence (thin persona-cloud strip vs
  sentiment bar; thread header vs near the composer; collapsed/expanded states) — UI-phase;
  flat-warm SSOT (THEME-06), mobile-first, fixed typed-renderer library.
- **Per-card "reaction at rest"** rendering — **prefer promoting the existing `LensTrigger`
  cue** to show live sentiment over adding a separate inline line (least duplication); exact
  encoding (fraction + ribbon + lead quote) is UI-phase.
- **"reacting to: X" subject labeling** + the **re-focus interaction** (scroll-spy vs explicit
  tap vs both) — UI-phase.
- **Animation / motion** — reuse PersonaGraph's `mulberry32` deterministic + `reducedMotion`
  gating + sr-only mirror; no `Math.random`.
- **Type-to-room input** debounce / latency / loading affordance + where the input sits on the
  presence — planner/UI; keep it honest (label it a quick read, no fabricated voices).
- **Presence behavior vs the open-thread singleton** (see Reviewed Todos) — planner; the
  presence lives in the thread, so be aware of the never-closed-singleton issue, but fixing it
  is not ambient scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition + strategy
- `.planning/ROADMAP.md` §"Phase 13: Proactive Numen (Ambient + Initiated)" — original goal +
  AMBIENT-01 / PROACTIVE-01 / PROACTIVE-02 + the "EXTEND the shipped reaction primitive, do
  NOT duplicate it" mandate. **⚠ Now narrowed** — see this CONTEXT's header (P13 = Ambient
  only; Initiated split out).
- `.planning/REQUIREMENTS.md` — AMBIENT-01 (the only requirement this phase delivers);
  PROACTIVE-01/02 move to the new Initiated Numen phase.
- `.planning/PROJECT.md` — milestone identity (SIM-1-on-everything = the moat; foresight not
  generation; anti-slop spine), flat-warm design SSOT.
- `.planning/STATE.md` — Hard Constraints (engine OPEN but regression-gate-PROTECTED, Qwen-only,
  fixed typed renderers, flat-warm SSOT, no `ENGINE_VERSION` bump for UI/text work).

### The P9 primitive this phase EXTENDS (REUSE — do not rebuild)
- `.planning/phases/09-living-audience-interactive-simulation-ux-draft-not-yet-disc/09-CONTEXT.md`
  — the AudienceLens spine: D-03 chat-with-persona (one persona at a time; "ask the whole room"
  deferred), D-04 reusable Lens mounted inline across all skills, D-05 Rewrite-for-audience,
  D-06 staggered reveal, honesty spine (D-02). **The ambient presence routes every door to this
  Lens.**
- `src/components/audience-lens/AudienceLens.tsx` — the shipped reusable Lens (the depth all
  three ambient doors open).
- `src/components/audience-lens/LensTrigger.tsx` — the SINGLE shared per-card entry (D-04 in P9):
  the cue to **promote** for the per-card "reaction at rest"; the mount precedent for the new
  presence.
- `src/components/audience-lens/flat-card-reactions.ts` — derives flat honest reactions from a
  card's real `fraction` + lead `scrollQuote`, **never fabricating** per-persona quotes — the
  data path for per-card reactions AND type-to-room.
- `src/components/audience-lens/{PersonaChatDrawer,PopulationSwarm,ClusterView,ReplayController,card-rewrite,lens-derive,use-lens-scale}.tsx/.ts`
  — the Lens internals (chat / Population / cluster / replay / Rewrite / scale) reused as-is.

### Reaction data source + persona substrate
- `src/lib/engine/wave3/persona-registry.ts` — the 10 archetype enum + byte-stable definitions
  (chat grounding; do NOT mutate — cache discipline).
- `src/lib/engine/persona-weights.ts` — `PersonaWeights` (dot weight → presence proportions).
- `src/components/board/audience/audience-derive.ts` — `FlatPersonaReaction`, `buildSegmentGroups`
  (cluster lens).
- `src/lib/tools/runners/chat-runner.ts` — the Flash text-mode path; type-to-room reuses the
  reaction route, not a new runner.
- `src/lib/audience/audience-repo.ts` (`getAudience`, `GENERAL_AUDIENCE`, `active_audience_id`)
  — loads the active audience the presence represents.

### Where the ambient presence + per-card reactions mount
- `src/components/thread/{idea,hook,script,remix}-card-block.tsx`, `personas-block.tsx`,
  `message-blocks.tsx` — current `LensTrigger` mount points (per-card layer).
- `src/components/thread/*-thread-view.tsx`, `src/components/app/home/composer-controls.tsx`
  — the thread + composer shell where the persistent presence docks.

### Audience object
- `.planning/phases/07-audience-manager-calibrated-audience-as-shared-substrate-acr/07-CONTEXT.md`
  — the calibrated Audience (10 personas, Temp×Disposition, `PersonaWeights` override) the
  presence renders.

### For the DEFERRED Initiated Numen phase (rails already exist — reference, do NOT build here)
- `.planning/phases/11-explore-audience-curated-discovery-expansion-not-yet-discuss/11-CONTEXT.md`
  — Explore (the source of PROACTIVE-01 morning drops + PROACTIVE-02 scheduled pulls).
- `vercel.json` (crons) + `src/app/api/cron/audience-drift/route.ts` — the cron + `verifyCronAuth`
  + service-client + honesty-gate precedent the Initiated phase reuses.
- `src/app/api/settings/notifications/route.ts` + the `user_settings` store
  (`weeklyDigest`/`testResults`/`emailUpdates` opt-in flags) — the delivery-nudge opt-in.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`AudienceLens` + the whole `src/components/audience-lens/` dir** — the shipped P9 Lens
  (chat / Population / cluster / replay / Rewrite / scale). The ambient presence is **three new
  doors into this one component**, not a new surface.
- **`LensTrigger`** — the per-card cue to **promote** (show live sentiment at rest) and the mount
  pattern for the presence. `flatPersonas.length === 0 → return children` is the built-in honest
  degrade.
- **`flat-card-reactions.ts`** — turns a card's real `fraction` + lead `scrollQuote` into honest
  flat reactions **without fabricating** — powers per-card reactions and the type-to-room result.
- **`chat-runner.ts` / Flash text-mode reaction route** — type-to-room reuses this; no new engine.
- **`PersonaGraph` (`mulberry32` + `reducedMotion`)** — the deterministic, SSR-safe, motion-gated
  animation pattern the presence must follow.

### Established Patterns
- **One reusable Lens, many entry points** (P9 D-04) — the ambient presence extends this exactly:
  per-card tap, presence spotlight, type-to-room → same Lens, scoped to a concept.
- **Honesty spine** — never fake a crowd/quote/timeline; idle at rest; one real labeled concept.
- **Determinism gate** — per-card reactions reuse already-emitted data → no new model calls, no
  `ENGINE_VERSION` bump.
- **flat-warm SSOT + fixed typed renderers** — the presence UI follows it; UI hint = yes → a
  UI-SPEC is warranted.

### Integration Points
- Persistent presence docks in the thread/composer shell (`*-thread-view.tsx` /
  `composer-controls.tsx`), reads the active audience via `getAudience` / `active_audience_id`.
- Per-card reactions extend the existing `LensTrigger` mounts on each `*-card-block.tsx` /
  `personas-block.tsx`.
- Spotlight re-focus reads the in-focus card's already-emitted reaction; subject label tracks it.
- Type-to-room → Flash reaction route → `flat-card-reactions` → presence spotlight + opens Lens.

</code_context>

<specifics>
## Specific Ideas

- **"Always present and reacting, the audience feels real, you can interact and get value"**
  (owner's framing) — the north star: a persistent companion, not a summoned panel.
- **The honesty crux the owner surfaced:** with many concepts in one thread, the presence must
  **spotlight one labeled concept**, never blend — and each card keeps its own durable reaction.
- **Type a thought → the room reacts** = an instant gut-check against your people without running
  a full skill. Reaction (foresight), not a chatbot.
- **One Lens, many doors** — the ambient layer adds entry points; it never forks the Lens.

</specifics>

<deferred>
## Deferred Ideas

### → New future phase "Initiated Numen" (the cut "Initiated" half of original P13)
- **PROACTIVE-01 — proactive morning drops** ("3 things stirring your people would bite on").
  Owner-leaning shape if/when built: **audience-curated Explore pull, cron pre-computed** (mirrors
  the `audience-drift` cron) so it's instant on app-open. (Deferred this pass.)
- **PROACTIVE-02 — scheduled Explore = "Automations equivalent."** Owner-leaning shape: the morning
  drop as a **pre-enabled default automation** + **one lightweight schedule surface** to tune
  cadence / add recurring pulls (reuse cron infra + `verifyCronAuth`); avoid a dashboard.
- **Proactive delivery** — owner-leaning shape: **in-thread drop card + opt-in return nudge**
  (reuse `user_settings` flags + `/api/settings/notifications`); thread stays canonical.

### Other deferred
- **"Ask the whole room" multi-persona conversational chat** — stays deferred (P9 D-03; v1 is one
  persona at a time). Revisit after the ambient reaction loop proves the habit.
- **Live reaction in the MAIN composer as you type** (debounced Flash) — distinct from type-to-room;
  tempting "feel real" stretch, not chosen for this pass (cost/latency/honesty bar).
- **Running-stack / dashboard view of recent reactions** — drifts toward the dashboard this phase
  resists.

### Reviewed Todos (not folded)
- **`thread-lifecycle-new-simulation-clear.md`** — "New Simulation does not start a fresh thread —
  open thread is a never-closed singleton." Tangential: the presence lives in the thread, so the
  planner should be **aware** of it, but fixing the singleton is not ambient scope.
- **`empty-generation-latency-and-ux.md`** — ideas/hooks latency + empty-state UX. Keyword match
  only; not ambient scope.
- **`gap-remix-01-decode-failed.md`** — remix decode failure. Not ambient scope.
- **`p10-single-post-metrics-to-clockworks.md`** — low-relevance; unrelated.

</deferred>

---

*Phase: 13-proactive-numen-ambient-initiated (narrowed → "Ambient Numen")*
*Context gathered: 2026-06-20*
