# Phase 10: Account Read, Saved Shelf & Recalibration Flywheel - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the studio inward and make the moat **compound over time**. Three deliverables on top of P7's calibrated Audience object:

1. **Account Read** — a "Read on your own account": from the creator's own scraped history, surface recurring hook/format patterns, drop-points, and what's-working-vs-what-to-fix.
2. **Saved shelf** — a flat, typed saved-items surface (connective tissue across skills), built Acts/State-compatible so a future P12 Library extends it.
3. **Recalibration flywheel (the moat — the hero of this phase)** — the per-creator learning loop that error-corrects the Audience object against real post outcomes: predict → post → measure → reconcile → correct → compound.

**Cut line (D-01):** the **flywheel is built deep**; Saved shelf and Account Read **ride existing infra lean** (bookmarks, outcomes, reading, analysis/history already exist); **Drift→recalibrate folds into the flywheel's recalibration trigger** (not a separate mechanism).

**Strategic source:** this phase is the concrete build of the moat thesis from the Sandcastles competitive review — *calibration accuracy compounding via the outcome loop* (their corpus is static; our SIM learns YOUR audience). See `.planning/research/sandcastles-adopt-improve.md`.

</domain>

<decisions>
## Implementation Decisions

### Area 1 — Cut line / hero
- **D-01 (Flywheel hero; shelf + Account Read lean; Drift folds in):** Build the per-creator Outcome→recalibration loop to full depth — it is the differentiation. Saved shelf extends existing bookmark infra; Account Read reuses existing scrape + reading render. Drift→recalibrate is the same mechanic as the loop's recalibration trigger (scheduled/accumulated divergence), so it is folded in, not built separately. **Rationale:** concentrate net-new depth where the moat is; the surfaces have prior art.

### Area 2 — The recalibration flywheel (the moat mechanic) — FULLY SPECIFIED
The naive "predicted 7, got 9, bump weights" loop is explicitly REJECTED: (a) scale mismatch — the SIM pull-score is a concept ceiling, not a view-count prediction (honesty spine); (b) single-outcome noise; (c) can't tell whether the audience model or the content was wrong. The real design:

- **D-02 (Compare engagement SIGNATURES, not scores):** The SIM emits structure — which dispositions drive a concept and *how* (shares / saves / watch-through / conversion). The real outcome also has structure (retention curve, saves, shares, comments, link-clicks) that maps onto the same dispositions. Reconcile predicted signature vs realized signature, NOT score-vs-views.

- **D-03 (Separate calibration-error from craft-error — the key refinement):** Reconciliation classifies the divergence into TWO kinds and routes them to TWO different outputs:
  - **Calibration error** (audience MIX is off, e.g. "saves over-index, savers under-weighted") → feeds the **Audience object**.
  - **Craft error** (audience was right, content under/over-delivered, e.g. "hook predicted to stop scanners but retention craters at 2s") → feeds the **creator** as Account-Read guidance, NEVER mutates the model.
  This stops content flops from corrupting the audience object.

- **D-04 (Outcome capture = paste posted URL → scrape public + optional private add):** Creator pastes the posted video URL → Apify scrapes public metrics (views/likes/comments/shares — existing infra) → creator optionally adds private signals from their own analytics (saves, retention, link-clicks). Low-friction, reuses scrape, yields a real signature; honest about public-vs-creator-supplied. (Manual full-entry rejected = friction; public-only rejected = misses saver/converter dispositions.)

- **D-05 (Recalibration = confidence-gated after N consistent posts → PROPOSE → creator confirms):** Only propose a PersonaWeights recalibration when a disposition's realized share diverges from modeled **consistently across ≥N posts** (noise-resistant threshold), then surface an honest nudge ("we said 7, your buyers ran warmer — recalibrate?") that the creator **confirms**. No single-post mutation; no silent auto-recalibration. **Rationale:** preserves determinism + the regression gate + human-in-the-loop (memory: no autonomous fire-and-forget). The correction target is P7's `PersonaWeights` override (the calibration knob already built for exactly this).

- **D-06 (Two flywheel levels; only the per-creator loop is actuated in v1):**
  - **Per-creator learning loop (BUILT in P10):** predict → post → measure → reconcile (D-02/03) → correct (D-05 audience + D-03b creator) → compound (audience converges on the real audience; Account Read accrues a visible accuracy track record).
  - **Cross-creator data flywheel (SEEDED, not actuated):** P10 *logs* structured reconciliation data so aggregated, privacy-safe patterns can later sharpen the base persona priors (e.g. "fitness-cold audiences under-predict saves"). The prior-fitting mechanism itself is deferred — it needs volume + the fold/A-B engine work already deferred from P7. **Lay the rails, don't fake it.**

### Area 3 — Saved shelf
- **D-07 (Flat shelf SURFACE, typed items, thread↔shelf wiring, P12-extendable):** Extend existing bookmark infra into a flat shelf surface (own nav item). Stay flat per the ROADMAP guard (**NO folders/tags/CMS**) BUT use a typed item model (Read / idea / hook / script / outlier / format) + **every thread output savable-to-shelf** + **every shelf item actionable-into-thread**. Flat ≠ throwaway → the future P12 Library *extends* it (adds watchlist + Explore wiring) rather than reworking it. Implements the session's Acts/State IA (acts in the thread, state on surfaces). (Minimal sidebar list rejected = P12 rework risk; full-Library-now rejected = pulls P11/P12 scope in = scope creep.)

### Area 4 — Account Read output
- **D-08 (Thread card reusing the `reading/` render, savable to shelf):** "A Read on your own account" is generated from the Apify personal-scrape + analysis/history and surfaced as a **thread card that reuses the existing `reading/` components** (consistency + less build; honors the session north-star "everything resolves to a Read"). It is an **Act** (runs in the thread) whose output is **State** (savable to the shelf, D-07). Surfaces recurring hook/format patterns, drop-points, working-vs-fix. **Reuses Apify scrape — NOT new Connectors/OAuth** (the Sandcastles "verified ownership" prereq is already satisfied by P7's personal-scrape; do not import their OAuth model). (Dedicated standing-report surface rejected = new surface + drifts toward the dashboard metaphor we're avoiding; lightweight summary rejected = underwhelms vs the Test Read.)

### Claude's Discretion
- Exact `N` threshold + confidence/divergence math for D-05 (noise-resistance vs responsiveness) — planner/researcher pick; must stay deterministic + cache-stable + not violate the regression gate.
- The disposition→engagement-proxy mapping table (saves→savers, shares→sharers, clicks→converters, drop-curve→tough-crowd/scanners, etc.) — structure now; exact mapping is research/planner discretion against the existing 10 archetypes.
- DB schema for outcome capture + reconciliation logging (must be structured enough to later feed cross-creator priors per D-06) — planner discretion.
- Saved-shelf persistence shape (extend `bookmarks` table vs new typed table) — planner discretion; keep typed + P12-extendable.
- Whether Account Read scrape blocks or streams — confirm Apify latency at research (reuse P7 D-06 flow).
- Drift re-scrape cadence (the scheduled half of the trigger) — planner; reuse existing `cron/` infra.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope, strategy & locked constraints
- `.planning/ROADMAP.md` §Phase 10 — goal + draft scope (Account Read, Saved shelf flat-guard, Drift, Outcome loop), backlog-adjacent list, depends-on P7/P8/P9.
- `.planning/research/sandcastles-adopt-improve.md` — **the strategic source for this phase**: moat = calibration compounding via the outcome loop; Acts/State IA; "everything resolves to a Read"; Saved shelf → Library-compatible; Account Read uses scrape not Connectors. READ before planning the flywheel.
- `.planning/REQUIREMENTS.md` — formalize Phase 10 requirements here (currently TBD: SELF-* account read, SAVE-* saved shelf, FLYWHEEL-* drift + outcome loop).
- `.planning/STATE.md` — Hard Constraints: engine OPEN but **regression-gate-PROTECTED**, Qwen-only, fixed typed renderers, flat-warm SSOT, bump `ENGINE_VERSION` only on deliberate video-scoring changes. The flywheel's recalibration must NOT silently change scoring (D-05).
- `.planning/PROJECT.md` — milestone identity + key decisions.
- `.planning/phases/07-audience-manager-calibrated-audience-as-shared-substrate-acr/07-CONTEXT.md` — the Audience object + PersonaWeights override + Apify personal-scrape (D-06) this phase extends/corrects.
- Memory `audience-manager-phase7.md` — locked Audience design + reusable foundations.

### The Audience object — the recalibration TARGET (D-05, regression-gate-critical)
- `src/lib/engine/persona-weights.ts` — `PersonaWeights` + `resolveWeights` precedence (`analysis > creator > niche > default`). **The flywheel emits a recalibration override HERE** (the `analysis_override` slot is built for this). `DEFAULT_PERSONA_WEIGHT_CONFIG` = General-audience baseline the gate protects.
- `src/lib/engine/wave3/persona-registry.ts` — the 10 archetype enum + byte-stable definitions (do NOT mutate; cache discipline). Disposition mapping (D-03/D-02 signatures) layers over these.
- `src/app/api/audiences/calibrate/route.ts` — existing calibration endpoint; recalibration extends this path.

### Outcome loop — existing prior art to extend (D-02/D-04/D-05)
- `src/app/api/outcomes/route.ts`, `src/hooks/queries/use-outcomes.ts`, `src/components/app/simulation/outcome-form.tsx` — existing outcome capture; extend to capture the engagement BREAKDOWN (signature), not just views.
- `src/app/api/analysis/history/route.ts` — analysis history (feeds Account Read + reconciliation).
- `src/lib/scraping/apify-provider.ts`, `src/app/api/webhooks/apify/route.ts`, `src/lib/scraping/types.ts` — scrape infra for outcome-URL public metrics (D-04) + Account Read (D-08).
- `src/app/api/cron/validate-rules/route.ts`, `src/app/api/cron/scrape-trending/route.ts` — existing cron patterns for the Drift scheduled re-scrape.

### Saved shelf — existing prior art to extend (D-07)
- `src/app/api/bookmarks/route.ts`, `src/stores/bookmark-store.ts`, `src/hooks/queries/use-bookmarks.ts` — existing bookmark/save infra; extend into the typed flat shelf surface.

### Account Read render — reuse target (D-08)
- `src/components/reading/` (`reading.tsx`, `reading-hero.tsx`, `reading-panels.tsx`, `reading-section.tsx`, `reading-accordion.tsx`, `panel-shell.tsx`) — reuse for the Account Read card.

### Grounding (N1 just-merged awareness)
- `src/lib/kc/profile-role-map.ts`, `src/lib/kc/assembler.ts` — N1 added the `voice` role (`writing_voice_sample`) merged into milestone/numen-tools (commit `d2f121e7`). P10 grounding/scrape work should be aware the voice role + field now exist.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Bookmarks** (`api/bookmarks`, `bookmark-store`, `use-bookmarks`): foundation for the Saved shelf — extend to typed items + a surface.
- **Outcomes** (`api/outcomes`, `outcome-form`, `use-outcomes`): foundation for outcome capture — extend to the engagement breakdown/signature.
- **Apify scrape** (`apify-provider`, `webhooks/apify`): powers both outcome-URL public metrics and Account Read history (reuses P7 personal-scrape).
- **Reading components** (`src/components/reading/*`): reuse for the Account Read card.
- **PersonaWeights** (`persona-weights.ts`): the recalibration write-target via the `analysis_override` slot.
- **Cron** (`cron/validate-rules`, `cron/scrape-trending`): pattern for the Drift scheduled re-scrape.
- **analysis/history** route: source for own-account pattern analysis + prediction-vs-actual reconciliation.

### Established Patterns
- **Regression gate + determinism (STATE):** recalibration must be confidence-gated + creator-confirmed + cache-stable — never a silent scoring mutation (D-05).
- **Honesty spine:** pull-score is a concept ceiling, not a view promise (drives D-02 signatures-not-scores); never fabricate.
- **Per-thread active audience (P7 D-04):** the audience a Read was generated under is pinned per-thread; recalibration affects future runs.
- **Acts/State IA (this session):** acts in the thread, state on surfaces; shelf + Account Read follow it (D-07/D-08).

### Integration Points
- Recalibration override → `persona-weights.ts` `analysis_override`.
- Outcome capture → extend `api/outcomes` + `outcome-form`.
- Shelf → extend `api/bookmarks` + `bookmark-store`; savable from thread cards, actionable back into thread.
- Account Read → `reading/` render + Apify scrape + analysis/history.

</code_context>

<specifics>
## Specific Ideas

- The flywheel must be **demonstrably sound, not hand-wavy** (owner's explicit requirement): signatures-not-scores (D-02), separate audience-error from craft-error (D-03), aggregate-before-correct + confidence-gate + human-confirm (D-05). The "we said 7, it hit 9 → recalibrate?" nudge is the *surfaced* form, but the underlying signal is the per-disposition signature delta, not the headline number.
- Two compounding assets to make visible: a sharper per-creator SIM (private, un-copyable) + a Read accuracy track record ("within X% on your last 10") that builds trust.
- Account Read framing = "know thyself" companion to Discover's "know thy competitor."

</specifics>

<deferred>
## Deferred Ideas

- **Cross-creator prior-fitting** (the actuated cross-creator data flywheel) — P10 only SEEDS it via structured reconciliation logging; the prior-update mechanism needs volume + the deferred fold/A-B engine work. Future phase.
- **Re-scrape automation for outcome capture** (auto video↔Read attribution) — v1 is paste-URL + scrape-on-demand; automatic attribution is hard, defer.
- **Full P12 Library** (watchlist + Explore wiring + surface↔thread launchpad beyond the shelf) — P10 builds the shelf P12-extendable; the rest is P11/P12.
- **remix-your-own-winner** (idea E) — already on v6.1 backlog.
- **generate→critique→regenerate quality loop** (backlog lever #3, "improve-against-weakest-segment") — backlog.
- **RAG over creator history** — backlog (P7 PROFILE-01 deferral).
- **Persona editing by the creator** — stays read-only until persona values are tuned (P7 D-03 deferral).
- **Shelf folders/tags/CMS** — explicitly out (ROADMAP flat guard); revisit only if a real need emerges post-P12.

None of these block P10.

</deferred>

---

*Phase: 10-account-read-saved-shelf-recalibration-flywheel*
*Context gathered: 2026-06-19*
