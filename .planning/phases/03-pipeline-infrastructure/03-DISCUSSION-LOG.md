# Phase 3: Pipeline Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 3-Pipeline Infrastructure
**Areas discussed:** Stage event granularity, Versioning & provenance, Cache UX + freshness, Phase 3 scope

---

## Gray Area Selection

Claude presented 4 gray areas as a multi-select. User answered freeform: "i don't have much technical knowledge ask me all questions you need to know" — interpreted as "discuss all areas, frame in user-vision terms, take technical decisions as Claude's discretion." Carries forward Phase 2's D-15 stance.

All 4 areas were then walked through, one user-vision question per area.

---

## Stage event granularity (Q1)

| Option | Description | Selected |
|--------|-------------|----------|
| Live signal dashboard | Each engine signal lights up as it completes; cost ticker + ETA. Matches M2 "live audience viz" vision. Phase 3 emits events; M2 designs UI. | ✓ |
| Progress bar + status text | Single progress bar (0→100%) with current stage label. Less data shown, but concrete. | |
| Coarse status messages only | Just better wording on existing 3-5 high-level phases. Simplest. M2 viz would need a later Phase 3 expansion. | |
| Spinner only | Hide the work — single spinner, final result. Minimalist. Loses "feel of engine working." | |

**User's choice:** Live signal dashboard
**Notes:** Strongest user-vision signal of the discussion. Implication: every parallel Wave 1 sibling must emit its own events; no bundling. Drives D-01 + D-02 event-shape design.

---

## Engine version label (Q2)

| Option | Description | Selected |
|--------|-------------|----------|
| Clean v3.0.0 at milestone gate (Recommended) | "3.0.0-dev" during Phases 3-11, flips to "3.0.0" when Phase 12 acceptance gate passes. Clean "we shipped v3" moment. | ✓ |
| Bump per phase (2.2 → 2.3 → ... → 3.0) | Minor version per phase. Granular telemetry, but no clean v3 launch. | |
| Strict semver (3.0.0-pre.3 → -pre.4 → -rc.1 → 3.0.0) | Semver-correct pre-release tags. Awkward labels in UI / marketing. | |

**User's choice:** Clean v3.0.0 at milestone gate
**Notes:** Marketing/communication moment matters. The "-dev" suffix is the user-visible artifact during build; the flip happens once. Phase 12's gate commit edits the constant. Drives D-05.

---

## Re-upload / cache UX (Q3)

| Option | Description | Selected |
|--------|-------------|----------|
| Silent instant replay (Recommended) | Cached result in <2s with no banner. Feels like fast analysis. TTL = 24h. Lowest friction. | ✓ |
| Transparent replay with banner | Cached result in <2s with small banner: "Returning your prior analysis (3h ago) — [Re-analyze]". | |
| Prompt before replay | Modal: "We have a recent analysis. View or run new?" Most explicit, but adds a click. | |

**User's choice:** Silent instant replay
**Notes:** Cache scope decided as Claude's discretion: user-scoped (different CreatorContext per user means cross-user reuse is wrong). Drives D-09 through D-15.

---

## Phase 3 scope: scaffolding for future waves (Q4)

| Option | Description | Selected |
|--------|-------------|----------|
| Light scaffolding (Recommended) | Phase 3 ships hooks + scaffolding: onStageEvent, SSE schema, version, provenance, cache, PLUS Wave 0 / Wave 3 / Stage 10–11 no-op pass-through stubs. Future phases plug in their real logic. | ✓ |
| Hooks-only minimum | Phase 3 ships only the strict requirements; future phases expand pipeline.ts themselves. Smallest Phase 3, more work later. | |
| Aggressive scaffolding | Stub all future waves with full no-op implementations + types. Largest Phase 3, trivial later phases. | |

**User's choice:** Light scaffolding
**Notes:** The right balance for the non-technical framing — future phases stay small without overcommitting Phase 3. Drives D-16 through D-19.

---

## Claude's Discretion

Captured as a section in CONTEXT.md but listed here for the audit trail:

- Event payload exact shape (settled as `{type, stage, wave, ...}` discriminated union — D-02).
- SSE-vs-not branching on `Accept` header (settled to satisfy SC#2 — D-03).
- `ENGINE_VERSION` constant relocation to `src/lib/engine/version.ts` (D-06).
- Cache key composition `(content_hash, engine_version, user_id)` (D-10).
- Two-tier cache lookup pattern (L1 in-memory + L2 Supabase analysis_results query) (D-11).
- DeepSeek input-cache header exact directive (researcher to confirm against DeepSeek API docs — D-12).
- `bypassCache?: boolean` option for eval harness (D-15).
- Stub file organization (Claude's recommendation: separate files per future wave — see Claude's Discretion list in CONTEXT.md).
- Migration filename + structure.
- Pipeline options bag shape (`{ requestId, onStageEvent, bypassCache }`).
- Content-hash computation location (route vs pipeline) — planner picks.
- Event timestamp source (`Date.now()` vs `performance.now()`) — planner picks.
- Test surface design (Vitest units + integration; no live-DB CI test).

---

## Deferred Ideas

All deferred to other phases or post-milestone (full list in CONTEXT.md `<deferred>`):

- Persistent cache tier (Vercel KV / Redis / dedicated `prediction_cache` table) — revisit if L2 SELECT proves slow post-launch.
- Cross-user cache reuse for trending videos — rejected here; M2 retrospective consideration.
- Per-stage cost telemetry table — kept in SSE only for now.
- M2 live signal dashboard UI — consumer of Phase 3's event schema.
- DeepSeek prompt-prefix engineering for Phase 7's 10 personas.
- Cache invalidation reasons beyond engine-version bump (taxonomy edits, rule-library changes, calibration retraining).
- Vercel cold-start mitigation if L1 wipes hurt the <2s SC#4 budget.
- SSE-vs-not Accept-header equivalence test surface.
