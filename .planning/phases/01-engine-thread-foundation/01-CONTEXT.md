# Phase 1: Engine & Thread Foundation - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the substrate the whole studio runs on: a **SIM-1 Flash text-mode** engine path (personas react to text, no video), a **generalized thread model** (grounded vs open), a reusable **tool-runner** contract, **typed-block rendering** through the fixed numen-rework renderer library, **message/block persistence**, and the **composer as the universal entry door**.

Requirements (locked by ROADMAP/REQUIREMENTS): ENGINE-01, ENGINE-03, THREAD-01, THREAD-02, THREAD-04, THREAD-06, THREAD-07.

Discussion here clarified **HOW**, not what. New capabilities (Ideas/Hooks/Chat tools, credit metering, custom personas) belong to later phases — Phase 1 builds the seams they plug into.
</domain>

<decisions>
## Implementation Decisions

### Text-mode Flash output (ENGINE-01)
- **D-01:** Output is **aggregate-forward** — lead with one band headline + a 1-line verdict; the 10 persona reactions live behind a tap/expand (reuses `persona-cloud`). Chosen so ranked lists in P3/P4 stay scannable.
- **D-02:** The pull-score is **banded + relative** — `Strong / Mixed / Weak pull` — with a supporting **audience-fraction** ("4/10 stop"). NO fabricated 0-100 number (honesty spine: text discrimination is coarse). The band maps to the existing `score-gauge` renderer (distinct styling from Max — see D-09).
- **D-03:** Each persona (behind the expand) returns a **stop/scroll verdict + a one-line first-person voice quote** ("seen this myth-bust 100x, scrolling"). The verdict drives the aggregate band math; the quote is the audience texture that sells the moat. This is also the exact data shape custom personas will emit later.
- **D-04:** **Mode framing (Hook / Idea / chat) is a tool-runner parameter**, not a separate engine function. The caller passes the framing; it swaps the persona *question* and the band *verbiage*, not the personas themselves. One engine path. Rides the THREAD-06 contract so Scripts/Remix framings slot in later without new functions.
- **D-05 (forward constraint):** Architect the text-mode path so **personas are data-driven / swappable (config rows), NOT hardcoded** — so user-creatable custom audiences (v6.1+) drop in without an engine rewrite. (See Deferred.)

> **Amendment (2026-06-17, plan-phase):** D-01's "reuses `persona-cloud`" and D-02's "maps to the existing `score-gauge` renderer" are superseded in implementation by **thin Flash-specific renderers** (`band-block.tsx`, `personas-block.tsx`) that reuse only `score-gauge`'s **zone-color tokens** — not the gauge component or `persona-cloud`. Rationale (RESEARCH A5 + Pitfall #1): `ScoreGauge` hardcodes the 0-100 number D-11 forbids, and `PersonaCloud` consumes video-shaped `HeatmapPayload`, not the `{archetype, verdict, quote}` shape (D-03). The **intent** of D-01/D-02 (aggregate-forward band headline + tap-to-expand personas, distinct-from-Max styling) is fully preserved.

### Composer & routing (THREAD-02)
- **D-06:** **Explicit tool selection — NOT auto-detect.** Owner rationale: creators must know which tool/skill they're invoking because it consumes credits. Auto-routing a prompt to a credit-spending tool is a trust violation.
- **D-07:** Selection via **tool chips on the composer** (Test · Idea · Hooks · Chat). Active tool is always visible; selecting one updates the placeholder + send action; a **cost slot** is reserved on the chip. URL/upload may hard-route to Test as a convenience, but the active tool stays shown.
- **D-08:** **Phase-1 chip scope:** ship the chip component + routing contract with **only Test wired live** (the existing Reading, via URL/upload). Ideas/Hooks/Chat chips render **disabled / "coming soon."** Each later phase flips its own chip live. No half-built tool ships in P1.

### Honesty spine (ENGINE-03)
- **D-09:** Flash-vs-Max distinction is carried at the **composer's active-model field** (model-selector pattern) — the tool chip drives the model: **Test → SIM-1 Max, Ideas/Hooks → SIM-1 Flash**. The creator sees which engine judges *before* firing. Not heavy per-output caveats.
- **D-10:** Each persisted output block carries a **lightweight model tag** (`SIM-1 Flash` / `SIM-1 Max`) — same vocabulary as the composer field. Composer field = intent (before); block tag = provenance (after, once scrolled away). Flash and Max use **distinct band styling** so they're never visually identical.
- **D-11:** **Flash claims are qualitative ONLY** — the band, the audience-fraction, and the "worth shooting?" verdict. **NO** predicted views, engagement %, reach tiers, or niche percentiles (those imply a forecast text-mode Flash can't back). Any real metric forecast would be a deliberate Max-path feature only.

### Thread / Reading data model (THREAD-01, THREAD-04, THREAD-07)
- **D-12:** **Reading stays the artifact; the thread WRAPS it.** `analysis_results` is left untouched (protects the regression-gated Max score-identity). Add a new **`threads`** table: `type` discriminator (`grounded` | `open`) + **nullable `reading_id` → analysis_results**. Grounded thread points at its Reading; open thread has `reading_id` null.
- **D-13:** **Persistence shape:** a **`messages`** table (`thread_id`, `role`, `created_at`); the body is a **typed-blocks JSON array** — each block `{type, props}`. Markdown is just a `markdown` block type. One atomic row per message (mirrors the existing `analysis_results` JSONB pattern; avoids per-block join fan-out). The block `type` is the contract the renderer keys off.
- **D-14:** **Fixed renderer registry is the SSOT** (`type → component`). Every block is validated against its renderer's schema **at the tool-runner boundary AND on rehydration**. Unknown type / invalid props → **skip or render a tiny "unsupported block" placeholder, never executed.** This is the *structural* enforcement of THREAD-04's "no model-generated UI" — the model can only emit block types already in the registry. **Same registry the THREAD-06 tool-runner `outputSchema` validates against.**
- **D-15:** Existing Readings get their wrapping grounded thread **lazily on first open** (idempotent on the unique `reading_id`). No bulk backfill — the migration only adds the `threads`/`messages` tables + the `reading_id` link; data fills in as used.

### Cross-cutting seams (how the decisions interlock)
- The **renderer registry** (D-14) is shared by THREAD-04 (rendering) and THREAD-06 (tool-runner output validation) — author it once as the SSOT.
- The **tool chip** (D-07) drives both routing (THREAD-02 / D-08) and the model-field honesty (ENGINE-03 / D-09).
- The **tool-runner framing parameter** (D-04) and the **persona/output data shape** (D-02, D-03) must be designed together so the band/fraction/verdict/quote payload is renderer-ready.

### Claude's Discretion
- Exact `threads` / `messages` column lists, indexes, and RLS policies (follow the established `analysis_chats` RLS pattern — user owns thread, server never trusts `user_id` from body).
- The internal tool-runner type signature for `{promptTemplate, knowledgeBundle, outputSchema, renderer}` — shape is locked by THREAD-06; field types are the planner's call.
- Placeholder copy/visual for disabled "coming soon" chips and "unsupported block."
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope & constraints
- `.planning/ROADMAP.md` §Phase 1 — goal + 5 success criteria for this phase.
- `.planning/REQUIREMENTS.md` — ENGINE-01/03, THREAD-01/02/04/06/07 + cross-cutting constraints (honesty spine, bounded cost, engine-open-but-protected, Qwen-only, fixed renderers, THEME-06).
- `.planning/PROJECT.md` — milestone identity + locked constraints.
- `.planning/NUMEN-TOOLS-VISION.md` — EXPLORATORY discuss input (vision, not spec).

### Engine (SIM-1 Flash text-mode, protected Max path)
- `src/lib/engine/persona-weights.ts` — 10-persona / audience-mix weighting (FYP/niche/loyalist/cross). Text-mode reuses persona definitions; keep them data-driven (D-05).
- `src/lib/engine/version.ts` — `ENGINE_VERSION`; bump ONLY on a deliberate, reviewed Max scoring change.
- `src/lib/engine/pipeline.ts`, `src/lib/engine/aggregator.ts` — current scoring pipeline + aggregation (the protected Max path; text-mode is a new branch, not a rewrite).
- `src/lib/engine/__tests__/` — the engine suite that must stay green.

### Typed renderers (fixed numen-rework library)
- `src/components/reading/` — the fixed renderer set: `score-gauge.tsx` (band gauge), `persona-cloud.tsx` (expanded personas), `reading.tsx`, `reading-panels.tsx`, `index.ts`. The renderer registry (D-14) is assembled from these.

### Persistence (existing → new thread model)
- `supabase/migrations/20260213000000_content_intelligence.sql` §`analysis_results` — the Reading artifact (kept untouched; thread wraps it).
- `supabase/migrations/20260607000000_analysis_chats.sql` — existing chat-turn persistence + the RLS pattern to mirror for `messages`.
- `supabase/migrations/20260602000000_add_parent_id_to_analysis_results.sql` — precedent for nullable lineage FK with `ON DELETE SET NULL`.
- `supabase/migrations/20260601000000_add_mode_to_analysis_results.sql` — existing `mode` column precedent.

### Composer / chat surface
- `src/app/(app)/home/page.tsx` — current entry composer (gains the tool chips).
- `src/components/reading/reading-chat.tsx` — sticky follow-up composer + `useExpertChat` SSE pattern (content-first streaming reference).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `persona-weights.ts` + the 10-archetype system: reuse persona definitions for text-mode; expose framing as a parameter (D-04), keep personas as data (D-05).
- `score-gauge.tsx` / `persona-cloud.tsx`: the band headline and expanded-persona views map directly onto these — no new renderers needed for the Flash output.
- `analysis_chats` RLS + `useExpertChat` SSE engine: the persistence + content-first streaming patterns to generalize into `messages` + the thread surface.

### Established Patterns
- Structured engine output already persists as **JSONB on `analysis_results`** (factors/personas/variants) — D-13's typed-blocks-JSON-on-the-row follows the same grain.
- Nullable FK with `ON DELETE SET NULL` (parent_id) is the precedent for `threads.reading_id`.
- Engine is **OPEN but regression-gated**: text-mode is a *new branch*; keep the suite green and preserve same-video Max score-identity; bump `ENGINE_VERSION` only on deliberate scoring change.

### Integration Points
- New `threads` + `messages` tables link to existing `analysis_results` via nullable `reading_id`.
- The tool-runner's `renderer` field resolves against the same fixed registry the `messages` rehydration uses (D-14).
- The composer (`home/page.tsx`) is where tool chips + active-model field land; Test routes to the existing analyze/Reading path unchanged.
</code_context>

<specifics>
## Specific Ideas

- "The current persona system is not that accurate or the end state we want" — owner flagged the 10-archetype set as interim; design for replacement, don't entrench it.
- "In the composer we have a field showing the active model; when the user changes the skill/tool, the model changes too" — the model-selector pattern (D-09) is the owner's explicit mental model for the honesty spine.
- Credits are the *reason* for explicit tool selection — cost transparency is a first-class UX concern even though metering itself is deferred.
</specifics>

<deferred>
## Deferred Ideas

- **User-creatable / customizable personas (audiences)** — v6.1+. Phase 1 constraint: keep personas data-driven/swappable so this slots in later without an engine rewrite (D-05).
- **Persona-system quality redo** — the current 10-archetype set isn't the end-state (accuracy gap); a dedicated rework, not Phase 1.
- **Credit-metering system** — per-tool credit cost + balance ledger (Whop/tier-coupled). Phase 1 only *reserves the chip cost affordance* (D-07); the live ledger is its own phase.
- **Early open-chat** — considered for P1 to exercise the runner end-to-end, but THREAD-03 deliberately sequences chat LAST (only as good as the rebuilt KC). Stays in Phase 5.

</deferred>

---

*Phase: 1-Engine & Thread Foundation*
*Context gathered: 2026-06-17*
