# Phase 12: Library & Acts/State IA - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Crystallize the **Acts/State principle** — Acts (generate/explore/test/refine/chat) live in the **thread**; State (saved work, audience, settings) lives on **surfaces**, wired together — and land the **Library** State home plus two Audience-surface power features.

**In scope (P12):**
- **IA-01** — formalize the 4-item nav: **Thread · Audience · Library · Settings**. Add the new **Library** nav item + surface; **relabel** the existing nav so the four labels are literal ("New Simulation"→"New Thread", the "Simulations" history section→"Thread").
- **LIB-01** — **Library** = saved nouns (Reads/ideas/hooks/scripts/outliers), **extending** the P10 flat `saved_items` store; **replaces** the orphaned `/saved` surface (which currently has no nav entry).
- **LIB-03** — surface↔thread wiring: every Library item actionable **into** the thread; every thread output savable **to** Library.
- **AUD-EDIT-02** — multi-select audience compare (the killer feature): pick any two saved audiences on the Audience surface → side-by-side concept Read, **reusing P8's multi-audience Read** (08-06).
- **AUD-EDIT-01** — persona editing on calibrated audiences, written to the per-audience override slot (regression-gate-safe).

**Out of scope (deferred — see Deferred Ideas):**
- **LIB-02** tracked-accounts/watchlist — DEFERRED to a future dedicated **Channels/Accounts** page (owner decision). P11's `tracked_accounts` rows stay produced but unmanaged for now.
- **AUD-EDIT-03** compact onboarding redesign (tier-C polish).
- **AUD-EDIT-04** link-social Apify metadata prefill (tier-C + blocked behind the live Apify-plan issue, STATE GAP-ENV-01).

**Engine posture:** UI/IA/text-path work only — keep the engine + KC regression suites green, preserve same-video SIM-1 Max score-identity, **no `ENGINE_VERSION` bump**. Persona-edit + compare write/read per-audience overrides; never mutate the protected General baseline.

</domain>

<decisions>
## Implementation Decisions

### Information Architecture (IA-01)
- **D-01 — Add Library + relabel to the literal 4 nouns.** The live studio sidebar (`src/components/sidebar/Sidebar.tsx`) is already near-4: ⊕ New Simulation (⌘N→/home) · Settings · Audience · @handle selector · a "Simulations" history list (rows→/analyze/[id]) · Account (bottom). P12's IA work is **narrow**: (a) add a **Library** nav item to the top group (Settings·Audience·Library); (b) **relabel** "New Simulation"→"New Thread" and the "Simulations" section→"Thread" so the four nav labels read literally **Thread · Audience · Library · Settings**; (c) Account stays bottom-anchored (Settings cluster). **No sidebar restructure** — preserve shipped D-12 (Settings/Audience/@handle) + D-13 (Simulations history) behavior; this is an additive + relabel change. Expect small test/label churn (`data-testid` rows, history-section copy).
- **D-02 — Legacy routes stay orphaned, not deleted.** `/discover`, `/competitors`, `/brand-deals`, `/referrals` are NOT in the active studio nav (and the legacy `src/components/app/sidebar.tsx` is dead). Leave them out of the 4-item nav; do **not** delete the routes/data in this phase (MVP monetization surfaces aren't superseded until P15/P16). `/saved` is folded INTO Library (D-03).

### Library (LIB-01, LIB-03)
- **D-03 — Extend the P10 SavedShelf into Library; Library REPLACES `/saved`.** Build on `src/components/saved/saved-shelf.tsx` + the `saved_items` store (P10 D-07 built it flat+typed+Library-compatible **on purpose**). Library is **one scrollable surface** with **noun-type filter chips** (All · Reads · Ideas · Hooks · Scripts · Outliers); flat within each type (NO folders/tags/CMS — honors the ROADMAP flat guard). Repoint the nav to the same store — **no second store, no rework.** Since `/saved` currently has no nav entry, Library becomes the first real entry point for saved content.
- **D-04 — Surface↔thread wiring = extend P10's, append to the open thread.** "Use in thread" **appends** the item into the active/open thread via the existing `CHAIN_HANDOFFS` mechanism (Acts-in-thread; P5 single-conversation model) — NOT a new thread per item. Every thread output stays savable to Library. Scope = **extend** the P10 save↔use wiring to the full set of saved nouns; **no new mechanics**. (If no open thread exists when "Use in thread" fires, create/route to one — planner discretion.)

### Audience surface — Compare (AUD-EDIT-02)
- **D-05 — Surface multi-select → reuse P8's multi-audience Read.** Add multi-select on the `/audience` surface: pick **any two saved audiences** (not just active-vs-General) → launch **P8's existing multi-audience concept-Read flow** (08-06) with those `audience_ids[]`. The object is already `audience_ids[]`-ready (P7). **New build = the surface multi-select entry point + arbitrary audience pair**; **REUSE** the P8 compare block + Read render. Delivers "retention-vs-growth side-by-side" with minimal net-new build.

### Audience surface — Persona editing (AUD-EDIT-01)
- **D-06 — Edit calibrated audiences only, via the per-audience override slot.** Persona editing (name / disposition / temperature / description) is allowed **only on calibrated personal/target audiences**, written to the **per-audience override slot** — **never** the General baseline (read-only; the regression gate protects it). Threads already run keep their results (future runs reflect edits). Now unblocked: P7 D-03 deferred this "until persona values tuned," and **P8 W0 tuned** `GOAL_INTENT_BIAS` + `TEMPERATURE_DISPOSITION`. Gate-safe by construction — mirrors how P10 D-05 recalibration already writes to the `analysis_override` slot. **Rejected** direct weight/distribution editing (highest gate risk, pushes scope).

### Claude's Discretion
- Exact Library layout encoding (filter-chip bar vs segmented control; section headers vs single flat list with type tags) — UI-phase; keep flat-warm + the fixed typed-renderer library.
- "Use in thread" target resolution when no open thread exists (create new vs route to most-recent) — planner.
- Whether to physically rename the `/saved` route to `/library` or keep `/saved` and relabel only — planner (preserve deep links / redirects either way).
- Persona-edit form fields' validation/clamping + how edits surface in the read-only Audience Profile view — planner/UI.
- Compare entry affordance on `/audience` (checkbox multi-select vs a "Compare" action that opens a 2-audience picker) — UI-phase.
- Whether relabeling "Simulations"→"Thread" extends to in-app copy beyond the sidebar (empty states, tooltips) — planner; keep minimal.

### Folded Todos
None — no pending todos matched this phase's scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition + strategy
- `.planning/ROADMAP.md` §"Phase 12: Library & Acts/State IA" — goal, IA-01/LIB-01..03/AUD-EDIT-01..04, depends-on P10/P7/P11, "already shipped — do NOT rebuild" note (voice-sample N1 `d2f121e7`).
- `.planning/REQUIREMENTS.md` — IA-01, LIB-01..03, AUD-EDIT-01..04 (lines ~137-145); note LIB-02 + AUD-EDIT-03/04 are deferred per this CONTEXT.
- `.planning/NEXT-MILESTONE-VISION.md` — Acts/State IA framing (acts in thread, state on surfaces); 4-item nav collapse rationale.
- `.planning/research/sandcastles-adopt-improve.md` — Acts/State IA + "everything resolves to a Read"; Saved shelf → Library-compatible; the 11→4 section collapse this phase formalizes.

### Prior-phase context (decisions that bind P12)
- `.planning/phases/10-account-read-saved-shelf-recalibration-flywheel-draft-not-ye/10-CONTEXT.md` — **D-07 Saved shelf** (flat + typed + Library-compatible → P12 EXTENDS, no rework); D-05 recalibration override slot (the persona-edit write-target precedent).
- `.planning/phases/11-explore-audience-curated-discovery-expansion-not-yet-discuss/11-CONTEXT.md` — D-08 `tracked_accounts` write (the watchlist producer P12 DEFERS surfacing); D-04/D-05 Remix→Read chain; in-thread skill chain pattern.
- `.planning/phases/08-discover-remix-read-the-competitor-niche-moat-chain-draft-no/08-CONTEXT.md` — **multi-audience Read (08-06, active-vs-General)** that D-05 compare reuses/extends to arbitrary audience pairs.
- `.planning/phases/07-audience-manager-calibrated-audience-as-shared-substrate-acr/07-CONTEXT.md` — Audience object, `audience_ids[]`-ready, PersonaWeights override slot, **D-03 persona-edit deferral** (now unblocked by P8 W0).

### Constraints
- `.planning/STATE.md` — Hard Constraints (engine OPEN but regression-gate-PROTECTED, Qwen-only, fixed typed renderers, flat-warm SSOT); GAP-ENV-01 (Apify free-plan blocker → why AUD-EDIT-04 is deferred).
- `.planning/PROJECT.md` — milestone identity + flat-warm design SSOT.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/components/sidebar/Sidebar.tsx`** — the ACTIVE studio sidebar. Top group = New Simulation (⊕, ⌘N→/home) · Settings · Audience · `SidebarAccountSelector`; "Simulations" history list (`useAnalysisHistory`, rows→/analyze/[id], score/remix chips, D-13); Account bottom-anchored (D-12). **D-01 adds a Library `NavItem` here + relabels New Simulation/Simulations.** (NOTE: `src/components/app/sidebar.tsx` is the DEAD legacy nav — ignore.)
- **`src/components/saved/saved-shelf.tsx` + `src/app/(app)/saved/page.tsx` + the `saved_items` store/API** — P10 flat typed shelf. **Base for Library (D-03)** — extend with type-filter chips; repoint nav.
- **`CHAIN_HANDOFFS` registry** + P10's save↔use-in-thread wiring — **base for D-04**; extend to all saved nouns; append into the open thread.
- **P8 multi-audience Read (08-06)** — `/api/tools/read` + the compare block/Read render. **Reuse target for D-05** with arbitrary `audience_ids[]`.
- **`src/components/audience/` (`audience-manager.tsx`, `audience-profile-view.tsx`, `audience-form.tsx`, `calibration-flow.tsx`)** + `src/app/(app)/audience/*` — the Audience surface. **D-05 adds multi-select compare entry; D-06 adds persona editing** to the profile view (calibrated audiences only).
- **`src/lib/engine/persona-weights.ts` (`analysis_override` slot, `resolveWeights` precedence)** + `persona-registry.ts` (General baseline, read-only) — **the regression-gate-safe write-target for D-06 persona edits.**

### Established Patterns
- **Acts/State IA (P10/P11):** acts in the thread, state on surfaces; "use in thread" + "save to surface" both ways (D-04).
- **(app) route group:** surfaces inherit AppShell + auth + sidebar; render a content `<div>`, never a second `<main>` (P10 saved-page note).
- **Regression gate + determinism:** per-audience overrides only; General baseline byte-stable; no `ENGINE_VERSION` bump for UI/IA work.
- **flat-warm SSOT (THEME-06) + fixed typed renderers** — Library + Audience-surface UI must follow it. UI hint = yes → a UI-SPEC is warranted.

### Integration Points
- Library nav item → `Sidebar.tsx` top group; Library surface → extend `saved-shelf` + `saved_items`; replace/redirect `/saved`.
- Use-in-thread → `CHAIN_HANDOFFS`, append to open thread.
- Compare → `/audience` multi-select → P8 `/api/tools/read` (multi-audience) with chosen `audience_ids[]`.
- Persona edit → `persona-weights.ts` per-audience override; surfaced in `audience-profile-view.tsx`.

</code_context>

<specifics>
## Specific Ideas

- **The 4 nouns are literal nav labels** (owner picked the relabel option): Thread · Audience · Library · Settings. "New Thread" replaces "New Simulation"; the history section becomes "Thread."
- **Library is the first real home for saved content** — `/saved` ships today with no nav entry; Library gives saved nouns a front door (and absorbs `/saved`).
- **Compare is the killer feature** — "wins for growth, bombs for buyers," any two saved audiences, reusing the P8 Read so it's a thin entry point over proven infra, not a rebuild.
- **Watchlist gets a proper home later** — owner wants a dedicated **Channels/Accounts page**, not tracked accounts jammed into Library or Audience. P11's `tracked_accounts` data persists meanwhile.

</specifics>

<deferred>
## Deferred Ideas

- **LIB-02 tracked-accounts/watchlist surfacing** → a future dedicated **Channels/Accounts page** (owner decision). P11's `tracked_accounts` rows stay produced (the "+ Track account" write) but unmanaged until that page exists. Tracked accounts are an INPUT, not a saved output → don't belong in the saved-nouns Library.
- **AUD-EDIT-03 compact onboarding redesign** (shorten the audience/profile create flow) — tier-C polish; not load-bearing for the IA/Library/compare spine.
- **AUD-EDIT-04 link-social → Apify metadata prefill** — tier-C AND blocked behind the live Apify-plan issue (STATE GAP-ENV-01, free plan refuses paid actors). Don't couple P12 to an unresolved infra blocker.
- **Folders/tags/CMS on Library** — explicitly out (ROADMAP flat guard); revisit only on real need.
- **Direct persona weight/distribution editing** — out (gate risk); P12 edits go through the override slot at the persona-field level (D-06).
- **Deleting/redirecting legacy monetization routes** (`/discover`, `/competitors`, `/brand-deals`, `/referrals`) — left orphaned, not removed; revisit when P15/P16 commerce supersedes them.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 12-library-acts-state-ia*
*Context gathered: 2026-06-20*
