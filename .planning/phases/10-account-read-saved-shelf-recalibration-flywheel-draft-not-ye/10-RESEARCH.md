# Phase 10: Account Read, Saved Shelf & Recalibration Flywheel - Research

**Researched:** 2026-06-19
**Domain:** Per-creator learning loop (outcome → reconcile → recalibrate); typed saved-items surface; self-account analysis. All on the existing Numen Studio stack (Next.js 15 + Supabase + Apify + the SIM-1 Flash 10-archetype engine).
**Confidence:** HIGH on integration seams (every prior-art file read + confirmed in-session). HIGH on math/schema proposals (derived from byte-stable engine definitions already in the repo). MEDIUM on Apify latency exact numbers (inferred from existing `waitSecs` config + calibrate route's 300s budget).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Flywheel hero; shelf + Account Read lean; Drift folds in):** Build the per-creator Outcome→recalibration loop to full depth. Saved shelf extends existing bookmark infra; Account Read reuses existing scrape + reading render. Drift→recalibrate is the same mechanic as the loop's recalibration trigger (scheduled/accumulated divergence) — folded in, not built separately. Concentrate net-new depth on the moat.
- **D-02 (Compare engagement SIGNATURES, not scores):** The SIM emits structure — which dispositions drive a concept and how (shares/saves/watch-through/conversion). The real outcome also has structure (retention curve, saves, shares, comments, link-clicks) that maps onto the same dispositions. Reconcile predicted signature vs realized signature, NOT score-vs-views.
- **D-03 (Separate calibration-error from craft-error):** Reconciliation classifies divergence into TWO kinds routed to TWO outputs: **Calibration error** (audience MIX off, e.g. "saves over-index, savers under-weighted") → feeds the Audience object. **Craft error** (audience right, content under/over-delivered) → feeds the creator as Account-Read guidance, NEVER mutates the model. This stops content flops from corrupting the audience object.
- **D-04 (Outcome capture = paste posted URL → scrape public + optional private add):** Creator pastes the posted video URL → Apify scrapes public metrics (views/likes/comments/shares — existing infra) → creator optionally adds private signals from their own analytics (saves, retention, link-clicks). Low-friction, reuses scrape, yields a real signature; honest about public-vs-creator-supplied.
- **D-05 (Recalibration = confidence-gated after N consistent posts → PROPOSE → creator confirms):** Only propose a PersonaWeights recalibration when a disposition's realized share diverges from modeled consistently across ≥N posts (noise-resistant threshold), then surface an honest nudge ("we said 7, your buyers ran warmer — recalibrate?") the creator confirms. No single-post mutation; no silent auto-recalibration. Correction target = P7's `PersonaWeights` override.
- **D-06 (Two flywheel levels; only the per-creator loop is actuated in v1):** Per-creator learning loop BUILT in P10 (predict→post→measure→reconcile→correct→compound). Cross-creator data flywheel SEEDED, not actuated — P10 logs structured reconciliation data so aggregated patterns can later sharpen base priors. The prior-fitting mechanism is deferred. **Lay the rails, don't fake it.**
- **D-07 (Flat shelf SURFACE, typed items, thread↔shelf wiring, P12-extendable):** Extend bookmark infra into a flat shelf surface (own nav item). Stay flat (**NO folders/tags/CMS**) but use a typed item model (Read / idea / hook / script / outlier / format) + every thread output savable-to-shelf + every shelf item actionable-into-thread. Implements the Acts/State IA. P12 Library *extends* it, does not rework.
- **D-08 (Thread card reusing the `reading/` render, savable to shelf):** "A Read on your own account" generated from the Apify personal-scrape + analysis/history, surfaced as a thread card reusing existing `reading/` components. An Act (runs in the thread) whose output is State (savable to the shelf). Surfaces recurring hook/format patterns, drop-points, working-vs-fix. Reuses Apify scrape — NOT new Connectors/OAuth. Honesty fallback (carries P7 D-06): thin/empty/unscrapeable history → honest "not enough history to read yet" state — NEVER fabricate.

### Claude's Discretion
- Exact `N` threshold + confidence/divergence math for D-05 — must stay deterministic + cache-stable + not violate the regression gate.
- The disposition→engagement-proxy mapping table — structure now; exact mapping research/planner discretion against the existing 10 archetypes.
- DB schema for outcome capture + reconciliation logging — must be structured enough to later feed cross-creator priors per D-06.
- Saved-shelf persistence shape (extend `bookmarks` table vs new typed table) — keep typed + P12-extendable.
- Whether Account Read scrape blocks or streams — confirm Apify latency at research.
- Drift re-scrape cadence (the scheduled half of the trigger) — reuse existing `cron/` infra.

### Deferred Ideas (OUT OF SCOPE)
- Cross-creator prior-fitting (the actuated cross-creator data flywheel) — P10 only SEEDS via structured reconciliation logging.
- Re-scrape automation for outcome capture (auto video↔Read attribution) — v1 is paste-URL + scrape-on-demand.
- Full P12 Library (watchlist + Explore wiring + surface↔thread launchpad beyond the shelf).
- remix-your-own-winner (idea E) — v6.1 backlog.
- generate→critique→regenerate quality loop — backlog.
- RAG over creator history — backlog (P7 PROFILE-01 deferral).
- Persona editing by the creator — read-only until persona values are tuned.
- Shelf folders/tags/CMS — explicitly out (ROADMAP flat guard).
</user_constraints>

<phase_requirements>
## Phase Requirements (proposed — for REQUIREMENTS.md adoption)

The planner + REQUIREMENTS.md should adopt these concrete IDs (CONTEXT/ROADMAP carry only the provisional SELF-*/SAVE-*/FLYWHEEL-* families).

| ID | Description | Research Support |
|----|-------------|------------------|
| **FLYWHEEL-01** | Outcome capture extended to engagement SIGNATURE: paste posted URL → Apify public scrape (views/likes/comments/shares) + optional creator-supplied private signals (saves/retention/link-clicks). Honest about public-vs-supplied provenance. | §Outcome Capture seam; `apify-provider.resolveVideoUrl` + `scrapeVideos`; outcomes table extension §DB Schema. |
| **FLYWHEEL-02** | Predicted-signature persistence: at SIM-1 run time, persist the per-disposition predicted share (the 10 verdicts rolled into the 6 dispositions) alongside the analysis/card so reconciliation has the predicted side to compare against. | §Signature Math; `flash-schema.FlashPersona[]` + `TEMPERATURE_DISPOSITION` lens. |
| **FLYWHEEL-03** | Reconciliation engine: compare predicted vs realized disposition signature → per-disposition divergence vector → classify each divergence as **calibration-error** (route to Audience) vs **craft-error** (route to Account Read). Deterministic, pure function. | §Divergence Math; §Calibration-vs-Craft Classifier. |
| **FLYWHEEL-04** | Confidence-gated PROPOSE: accumulate reconciliation rows; when a disposition diverges consistently across ≥N posts past a confidence gate, surface an honest nudge → creator confirms → write a `PersonaWeights` `analysis_override` to the active Audience. No silent mutation; no single-post change. | §Divergence + Confidence Math; `persona-weights.resolveWeights` `analysis_override`; `PATCH /api/audiences/[id]`. |
| **FLYWHEEL-05** | Reconciliation logging (cross-creator SEED): every reconciliation writes a structured row (audience snapshot id, niche, goal_intent, predicted vs realized disposition vector, classification, confirmed/declined) so a FUTURE phase can fit cross-creator priors. Rails only. | §DB Schema reconciliation table; D-06. |
| **FLYWHEEL-06** | Drift trigger (folds into D-05): scheduled re-scrape of the creator's own account on a cron cadence → composition-shift detection feeds the SAME recalibration PROPOSE path as outcome divergence. | §Drift Trigger; `cron/scrape-trending` pattern; `vercel.json` crons. |
| **SELF-01** | Account Read generation: from Apify personal-scrape + analysis/history → recurring hook/format patterns, drop-points, working-vs-fix. Thread card reusing `reading/` components. An Act → State (savable). | §Account Read Generation; `reading/` components; `apify-provider.scrapeVideos`. |
| **SELF-02** | Account Read honesty/thin-history fallback (carries P7 D-06): empty/thin/unscrapeable own-history → honest "not enough history to read yet" state — never fabricate. Same graceful degradation as P7 calibration. | §Account Read Generation; P7 `calibration.ts` THIN_MIN_VIDEOS gate. |
| **SELF-03** | Account Read accuracy track record: surface a visible "within X% on your last N" trust signal sourced from accumulated reconciliation rows (craft-error side). | §Account Read; §DB Schema reconciliation. |
| **SAVE-01** | Typed flat Saved shelf: extend bookmark infra into a typed saved-items table (Read/idea/hook/script/outlier/format) with its own nav item. Flat — NO folders/tags. | §Saved Shelf Persistence. |
| **SAVE-02** | Thread↔shelf wiring: every thread card savable-to-shelf; every shelf item actionable-into-thread (launch a skill). P12-extendable. | §Saved Shelf seams; `CHAIN_HANDOFFS`. |
</phase_requirements>

## Summary

Phase 10 is overwhelmingly a **data-modeling + deterministic-math** phase, not a new-library phase. Every external capability it needs (Apify scrape, SIM-1 Flash 10-archetype output, the `analysis_override` write-path, cron, the `reading/` renderer, bookmark infra) **already exists in the repo and was confirmed in this session.** No new npm packages are required. The risk is not "can we build it" — it is "is the math sound, deterministic, and regression-gate-safe," which is exactly where the owner demanded depth.

The single most important discovery: **the engagement signature the flywheel needs is already half-built.** The 10 archetype definitions in `wave3/persona-registry.ts` carry explicit, byte-stable engagement signatures in their prose (saver = "heavily save-weighted, comment ~10% of save intent"; sharer = "share intent 2-3× average"; lurker = "watch-through 60-100%, overt engagement near-zero"; etc.). The P7 `temperature-disposition.ts` lens already collapses those 10 archetypes into 6 dispositions (scanner/skeptic/collector/connector/converter/lurker). The SIM-1 Flash output (`FlashPersona[]` — per-archetype stop/scroll verdict) is the *predicted* signature. The realized signature comes from real engagement metrics mapped onto the same 6 dispositions. **Reconciliation is therefore a deterministic comparison of two 6-element disposition vectors — no model call, cache-stable, regression-gate-free by construction.**

The second key finding is a **landmine: there are two conflicting `outcomes` table definitions in migration history.** The live table (from `20260213000000_content_intelligence.sql`) is the `actual_views/actual_likes/predicted_score/actual_score/delta` + `user_id` shape that `/api/outcomes/route.ts` actually writes. A later forward-compat migration (`20260526000000`) redefined `outcomes` with a *different* `real_*` shape and *no* `user_id` — and the `cron/validate-rules` route is a documented no-op because of the mismatch. **P10 must extend the LIVE (`actual_*`) shape, and the planner must reconcile/ignore the dead `real_*` definition.** Recommendation below: add a sibling `outcome_signatures` table rather than widening the contested `outcomes` table, plus a `reconciliations` table for the cross-creator seed.

**Primary recommendation:** Build the flywheel as a deterministic pipeline of pure functions over two new tables (`outcome_signatures`, `reconciliations`), writing recalibration only through the existing `analysis_override` slot behind a creator-confirm gate. Reuse Apify, the `reading/` renderer, and bookmark infra wholesale for the lean surfaces. Add zero new packages.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Outcome capture (paste URL → public scrape) | API / Backend (SSE route, reuse calibrate pattern) | CDN/Apify (scrape) | Apify runs 1-3 min; must stream like `calibrate/route.ts`, not block the client. |
| Realized-signature derivation | API / Backend (pure fn) | — | Deterministic mapping of metrics → disposition vector. No model, no client trust. |
| Predicted-signature persistence | API / Backend (at SIM run) | Database | Must be written when the SIM runs so reconciliation has the pinned prediction. |
| Reconciliation + classification | API / Backend (pure fn) | Database (log) | Regression-gate-critical determinism; must never touch scoring silently. |
| Confidence gate + PROPOSE | API / Backend (aggregate query) | Frontend (nudge UI) | Aggregate over ≥N rows server-side; surface as a confirm UI. |
| Recalibration write | API / Backend (`PATCH /api/audiences/[id]`) | Database (audiences row) | The `analysis_override`/persona_weights slot is the ONLY write target. |
| Drift scheduled re-scrape | API / Backend (cron route) | CDN/Apify | Mirror `cron/scrape-trending` + webhook pattern. |
| Account Read generation | API / Backend (SSE route) | CDN/Apify + Database (analysis/history) | Scrape own account + read analysis history → patterns. |
| Account Read render | Frontend (reuse `reading/`) | — | Fixed typed renderer reuse; flat-warm SSOT for any new chrome. |
| Saved shelf persistence | Database + API | Frontend (surface + nav) | Typed flat table; thread↔shelf wiring is client+API. |

## Standard Stack

**No new packages.** Every dependency this phase needs is already installed and exercised in the codebase.

### Core (existing — reuse, do not add)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `apify-client` | ^2.22.1 `[VERIFIED: package.json]` | Public-metric scrape for outcome URLs + Account Read history scrape | Already the project's only scrape provider; `ApifyScrapingProvider` wraps it. |
| `@supabase/supabase-js` | (installed) `[VERIFIED: package.json + repo usage]` | New tables (`outcome_signatures`, `reconciliations`, `saved_items`), RLS, cron | The entire persistence layer; migrations dir is the established pattern. |
| `zod` | (installed) `[VERIFIED: repo usage]` | Input validation on all new routes (mirror `calibrate/route.ts` + `outcomes/route.ts`) | Every route in the codebase validates with zod. |
| `@tanstack/react-query` | (installed) `[VERIFIED: use-outcomes.ts/use-bookmarks.ts]` | Shelf + outcome + reconciliation query hooks | Established `src/hooks/queries/*` pattern. |
| `zustand` | (installed) `[VERIFIED: bookmark-store.ts]` | Optional optimistic shelf store (mirror `bookmark-store.ts`) | Existing store idiom. |

### Supporting (existing modules to extend, not rebuild)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `src/lib/engine/persona-weights.ts` | `resolveWeights` + `analysis_override` slot | The ONLY recalibration write target (D-05). |
| `src/lib/audience/temperature-disposition.ts` | 10 archetypes → 6 dispositions lens | The spine of signatures-not-scores (D-02). |
| `src/lib/audience/audience-repo.ts` + `audience-types.ts` | Audience CRUD + `persona_weights`/`personas[].share` | Recalibration reads/writes here via `updateAudience`. |
| `src/lib/scraping/apify-provider.ts` | `resolveVideoUrl` (single URL), `scrapeProfile`/`scrapeVideos` (own account) | Outcome public metrics + Account Read. |
| `src/components/reading/*` | The Read renderer | Account Read card reuses (D-08). |
| `src/app/api/bookmarks/route.ts` + `bookmark-store.ts` | Save infra | Extend into typed shelf (D-07). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extend the contested `outcomes` table | New `outcome_signatures` sibling table | RECOMMENDED — `outcomes` has a dual-definition history (see Pitfall 1) and a unique constraint on `analysis_id`; a sibling table avoids the landmine and is cleaner for the signature shape. |
| Deterministic metric→disposition mapping | LLM-classified signature | REJECTED — non-deterministic, breaks cache discipline + regression gate; the disposition mapping is mechanical (saves→collector, shares→connector). |
| Reuse `bookmarks` (video-id only) for the shelf | New typed `saved_items` table | RECOMMENDED new table — `user_bookmarks` is `(user_id, video_id)` only; the shelf needs `(type, ref_id, snapshot)`. Keep bookmarks for Discover videos. |

**Installation:** None. (Confirm in plan: `npm install` adds nothing.)

## Package Legitimacy Audit

> No new external packages are introduced by this phase. All capabilities reuse already-installed, already-exercised dependencies.

| Package | Registry | Status | Verdict | Disposition |
|---------|----------|--------|---------|-------------|
| (none) | — | Phase adds zero packages | — | N/A |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
THE RECALIBRATION FLYWHEEL (the moat — D-02..D-06)

  [SIM-1 run]                                      [Real post]
  text/video → Flash → FlashPersona[10]            creator pastes posted URL
       │  (stop/scroll per archetype)                    │
       ▼                                                 ▼
  collapse via TEMPERATURE_DISPOSITION lens        Apify scrapeVideo (public:
  → PREDICTED disposition vector (6)                 views/likes/comments/shares)
       │                                             + optional creator-supplied
       │  persist (FLYWHEEL-02)                        private (saves/retention/clicks)
       ▼                                                 │
  outcome_signatures.predicted_vector                    ▼
       │                                          map metrics → REALIZED
       │                                          disposition vector (6)  ← deterministic
       └──────────────┬───────────────────────────────────┘
                       ▼
            RECONCILE (FLYWHEEL-03, pure fn)
            per-disposition divergence = realized − predicted (normalized shares)
                       │
        ┌──────────────┴───────────────┐
        ▼ classify each divergence       ▼
  CALIBRATION ERROR                  CRAFT ERROR
  (audience MIX off:                 (audience right, content
   savers under-weighted)             under/over-delivered)
        │                                 │
        ▼ append row                      ▼ append row
  reconciliations (FLYWHEEL-05, cross-creator SEED)
        │                                 │
        ▼ aggregate ≥N consistent          ▼ surface as guidance
  CONFIDENCE GATE (FLYWHEEL-04)        Account Read "what to fix"
        │                              (NEVER mutates model — SELF-03 track record)
        ▼ passes → honest nudge
  "we said 7, your buyers ran warmer — recalibrate?"
        │
        ▼ creator CONFIRMS (human-in-the-loop)
  PATCH /api/audiences/[id] → persona_weights (analysis_override slot)
        │
        ▼  COMPOUND
  audience converges on the real audience; future SIM runs use the corrected mix

  DRIFT half (FLYWHEEL-06): cron re-scrapes own account on cadence →
    composition-shift detection → SAME confidence-gate → SAME PROPOSE path.

ACCOUNT READ (SELF-01/02)            SAVED SHELF (SAVE-01/02)
  Apify scrapeVideos(ownHandle)        thread card → "Save" → saved_items(type, ref, snapshot)
  + analysis/history                   shelf item → "Use in thread" → CHAIN_HANDOFFS launch
  → patterns/drops/fix
  → reading/ renderer (thread card)    flat, typed, NO folders (P12 extends)
  thin → honest empty state
```

### Recommended Project Structure (additions)
```
src/lib/flywheel/
├── signature.ts            # PREDICTED: FlashPersona[] → disposition vector (pure)
├── realized-signature.ts   # REALIZED: outcome metrics → disposition vector (pure)
├── reconcile.ts            # divergence + calibration-vs-craft classifier (pure)
├── confidence-gate.ts      # aggregate ≥N rows → PROPOSE | hold (pure)
└── recalibration.ts        # build the analysis_override from confirmed proposals (pure)

src/lib/account-read/
└── account-read.ts         # scrape + analysis/history → pattern extraction (thin gate)

src/lib/shelf/
└── shelf-repo.ts           # typed saved_items CRUD (mirror audience-repo.ts)

src/app/api/
├── outcomes/signature/route.ts   # SSE: paste URL → scrape → realized signature (mirror calibrate)
├── flywheel/proposals/route.ts   # GET pending proposals; POST confirm/decline
├── account-read/route.ts         # SSE: own-account Read (mirror calibrate SSE)
├── saved/route.ts                # GET/POST/DELETE typed shelf items
└── cron/audience-drift/route.ts  # scheduled re-scrape → drift PROPOSE (mirror scrape-trending)

src/components/thread/account-read-block.tsx   # thread card wrapping reading/ render
src/app/(app)/saved/page.tsx                   # flat shelf surface (in route group for AppShell)

supabase/migrations/
├── <ts>_outcome_signatures.sql   # predicted + realized vectors per analysis
├── <ts>_reconciliations.sql      # cross-creator seed log
└── <ts>_saved_items.sql          # typed flat shelf
```

### Pattern 1: SSE route for any Apify-latency operation
**What:** Apify runs take 1-3 min. Outcome scrape, Account Read scrape, and (server-side) drift all must stream staged status, never block opaquely.
**When to use:** Every route that calls `ApifyScrapingProvider`.
**Example:**
```typescript
// Source: src/app/api/audiences/calibrate/route.ts (verbatim pattern, in-repo)
export const maxDuration = 300;            // Apify headroom (Pitfall 4 in P7)
const stream = new ReadableStream({
  async start(controller) {
    const send = (event: string, data: unknown) =>
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    send("status", { message: "Reading the post…" });
    // ... scrape ...
    send("done", { signature });   // or send("fallback", {reason:"thin"}) / send("error", ...)
  },
});
return new Response(stream, { headers: { "Content-Type": "text/event-stream", ... } });
```

### Pattern 2: Recalibration writes ONLY through `analysis_override`
**What:** The flywheel's correction target is the `PersonaWeights` `analysis_override` slot — never `DEFAULT_PERSONA_WEIGHT_CONFIG`, never the archetype definitions, never the scoring path directly.
**When to use:** FLYWHEEL-04 confirm step.
**Example:**
```typescript
// Source: src/lib/engine/persona-weights.ts (resolveWeights precedence: analysis > creator > niche > default)
// The audience row already stores fyp/niche/loyalist/cross_niche (P7). A confirmed
// recalibration is just an UPDATE of those 4 fields on the active audience via:
await updateAudience(supabase, audienceId, { persona_weights: corrected });  // audience-repo.ts
// resolveWeights() then picks it up as source:"analysis_override" on future runs.
// General audience (is_general) is NEVER recalibrated — regression gate free by construction.
```

### Pattern 3: Cron + webhook for scheduled scrape (Drift)
**What:** Drift re-scrape mirrors the trending scraper: a cron route starts an Apify run with a webhook callback; the webhook upserts results.
**When to use:** FLYWHEEL-06.
**Example:**
```typescript
// Source: src/app/api/cron/scrape-trending/route.ts + vercel.json crons
// verifyCronAuth(request) first; createServiceClient(); client.actor(...).start({...}, {webhooks:[...]});
// Add a crons[] entry to vercel.json, e.g. weekly: "0 5 * * 1".
```

### Anti-Patterns to Avoid
- **Bumping weights from the headline number ("predicted 7, got 9, +weight").** Explicitly REJECTED in D-02 (scale mismatch, single-outcome noise, can't tell audience-vs-content). Always reconcile the disposition VECTOR.
- **Mutating archetype definitions or `DEFAULT_PERSONA_WEIGHT_CONFIG`.** Byte-stable; breaks cache + regression gate. Recalibration is per-audience `analysis_override` only.
- **LLM-classifying the realized signature per-request.** Non-deterministic; breaks cache discipline. The metric→disposition mapping is a fixed table.
- **Auto-applying a recalibration.** Violates human-in-the-loop (memory). Always PROPOSE→confirm.
- **Widening the `outcomes` table.** It has a dual-definition history (Pitfall 1) and a `UNIQUE(analysis_id)` constraint. Use a sibling table.
- **Folders/tags on the shelf.** ROADMAP flat guard; explicit out-of-scope.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Single posted-URL → public metrics | A new TikTok scraper | `ApifyScrapingProvider.resolveVideoUrl` (clockworks, single-URL) → reuse `apifyVideoSchema` which already parses views/likes/comments/shares | Single-post URL mode is a documented edge: apidojo FORBIDS single URLs; clockworks is the one that takes `postURLs:[url]`. Already SSRF-guarded. |
| Own-account history | A new follower scraper | `ApifyScrapingProvider.scrapeProfile` + `scrapeVideos(handle, 30)` | Exactly what P7 personal calibration uses; returns `VideoData[]` with `saves` (apidojo `bookmarks`). |
| Disposition vocabulary | A new behavior taxonomy | `TEMPERATURE_DISPOSITION` (6 dispositions over 10 archetypes) | Already locked in P8 W0; the signatures-not-scores spine maps onto it directly. |
| Weight precedence / override write | Custom recalibration store | `persona-weights.resolveWeights` + `audience-repo.updateAudience` | The `analysis_override` slot was built in P7 "literally for this." |
| Thin-history honest fallback | New empty-state logic | P7 `calibration.ts` thin gate (`THIN_MIN_VIDEOS=10`, follower-tier null) + `reading.tsx` D-13 honesty gates | Same graceful degradation; D-08 says carry P7 D-06. |
| Thread card rendering | New Read UI | `src/components/reading/*` (Reading, ReadingHero, accordions, panel-shell) | D-08 mandates reuse; consistency + less build. |
| SSE staged status | New streaming plumbing | `calibrate/route.ts` ReadableStream pattern | Verbatim-reusable; same Apify latency profile. |
| Cron scrape | New scheduler | `cron/scrape-trending` + `vercel.json` crons + `verifyCronAuth` | Established; webhook path exists at `/api/webhooks/apify`. |

**Key insight:** This phase's value is entirely in the *math and data model*, which cannot be borrowed — but every *plumbing* concern (scrape, stream, persist, render, schedule, override) already has a proven in-repo implementation. The plan should be almost all "wire X into Y" tasks plus the pure-function math modules.

## Runtime State Inventory

> P10 is additive (new tables/routes/UI). It does NOT rename or migrate existing runtime state. The one cross-cutting concern is data-shape conflict, not renamed state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Live `outcomes` table = `actual_*` shape (`content_intelligence` migration) with `UNIQUE(analysis_id)` + `user_id`. A SECOND migration (`20260526000000`) declares a conflicting `real_*` `outcomes` with no `user_id`. `cron/validate-rules` is a documented no-op because of this. `audiences` table stores `personas[].share` + flat weight columns. `user_bookmarks` = `(user_id, video_id)` only. | New sibling tables (`outcome_signatures`, `reconciliations`, `saved_items`) — do NOT touch the contested `outcomes` definition. Planner should note the dead `real_*` migration but leave it (a destructive reconciliation is out of scope). |
| Live service config | Apify actors are env-configured (`APIFY_TOKEN`, `APIFY_ACTOR_ID`, `APIFY_WEBHOOK_SECRET`, `SCRAPER_HASHTAGS`, `NEXT_PUBLIC_APP_URL`). No new external service. | New drift cron entry in `vercel.json` (in git). No UI-only config drift. |
| OS-registered state | Vercel Crons declared in `vercel.json` (in git, not OS). | Add one `crons[]` entry for `/api/cron/audience-drift`. |
| Secrets/env vars | `APIFY_*`, `CRON_SECRET` (via `verifyCronAuth`), Supabase keys — all existing; no new secret required. | None — reuse `verifyCronAuth` + `APIFY_TOKEN`. |
| Build artifacts | `database.types.ts` is regenerated after each migration push (P7 left `(supabase as any)` casts pending regen). | After new migrations: regenerate `database.types.ts` and remove the `as any` casts for the new tables (same step P7 deferred). |

## Common Pitfalls

### Pitfall 1: The dual `outcomes` table definition
**What goes wrong:** A plan that "extends the outcomes table" picks the wrong schema and breaks, or collides with the `UNIQUE(analysis_id)` constraint (one outcome per analysis — but a creator may report multiple signature passes).
**Why it happens:** Migration `20260213000000_content_intelligence.sql` defines `outcomes(actual_views, actual_likes, predicted_score, actual_score, delta, user_id, UNIQUE(analysis_id))` — this is what `/api/outcomes/route.ts` writes. A later migration `20260526000000_outcomes_and_filmstrips.sql` redefines `outcomes(real_views, real_share_pct, real_save_pct, creator_rating, source)` with NO `user_id`. `cron/validate-rules` comments confirm the live table is the `actual_*` shape and the route is a no-op.
**How to avoid:** Add a **new** `outcome_signatures` table keyed by `analysis_id` (FK, NOT unique — allow re-reports) + `user_id`. Leave `outcomes` alone. Do not depend on `real_*` columns existing.
**Warning signs:** Any plan task that runs `ALTER TABLE outcomes` or references `real_save_pct`.

### Pitfall 2: Apify single-URL vs multi-URL actor confusion
**What goes wrong:** Pasting a single posted URL into `scrapeVideos` (apidojo) fails — apidojo FORBIDS single-post URLs (requires ≥10 posts/query).
**Why it happens:** Two actors: `DISCOVER_*` = apidojo (profile/multi); `VIDEO_ACTOR` = clockworks (single URL via `postURLs:[url]`).
**How to avoid:** Outcome public-metric capture from ONE posted URL must use the clockworks single-URL path. `resolveVideoUrl` already uses it but returns only `mp4Url` — for outcome capture you want the *metrics* item, so either (a) add a `scrapeSinglePostMetrics(url)` method on `ApifyScrapingProvider` that runs the same clockworks call and returns the parsed `VideoData` (views/likes/comments/shares), or (b) extend `apifyVideoSchema` reads. Account Read (own account, many posts) correctly uses apidojo `scrapeVideos`.
**Warning signs:** `not_found`/`empty_dataset` IngestError on a valid public URL = wrong actor.

### Pitfall 3: Saves are public on TikTok-via-apidojo but absent elsewhere
**What goes wrong:** Assuming saves/retention/link-clicks are always scrapable.
**Why it happens:** apidojo maps `bookmarks`→`saves` (public on TikTok), but retention curves and link-clicks are NOT in any public scrape; views/likes/comments/shares are. Instagram/YouTube field availability differs.
**How to avoid:** The realized-signature builder must treat each disposition channel as **present-or-absent**, never zero-filled. A missing channel = "unknown," excluded from divergence (honesty spine). D-04's "optional private add" exists precisely because saves/retention/clicks are creator-supplied. Mark provenance per metric (`public_scrape` vs `creator_supplied`).
**Warning signs:** A divergence computed on a disposition with no realized signal → false recalibration proposal.

### Pitfall 4: Single-post noise triggering recalibration
**What goes wrong:** One viral or flop post yanks the weights.
**Why it happens:** Naive per-post correction (the rejected design).
**How to avoid:** D-05's confidence gate: require ≥N posts where the SAME disposition diverges in the SAME direction past a per-disposition threshold (math below). Never propose on n<N.
**Warning signs:** A proposal appearing after 1-2 outcomes.

### Pitfall 5: Recalibration silently changing scoring (regression-gate violation)
**What goes wrong:** A confirmed recalibration alters the General audience or the engine's video-scoring identity → regression gate fails.
**Why it happens:** Writing to the wrong slot.
**How to avoid:** Recalibration only ever writes `persona_weights` on a NON-general, NON-preset user audience row (the `analysis_override` precedence). General has `is_general:true` and is never recalibrated. The SIM-1 Max video path and `ENGINE_VERSION` are untouched. Add a regression test asserting General weights are unchanged after a flywheel run (mirror P7's `persona-weights.test.ts` AUD-03 anchor).
**Warning signs:** `DEFAULT_PERSONA_WEIGHT_CONFIG`, `ARCHETYPE_DEFINITIONS`, or `ENGINE_VERSION` appearing in a flywheel diff.

### Pitfall 6: Predicted signature not pinned at SIM time
**What goes wrong:** Reconciliation has no predicted side, or recomputes it later under a *changed* audience (after recalibration) → comparing against the wrong baseline.
**Why it happens:** Treating the predicted signature as derivable on demand.
**How to avoid:** Persist the predicted disposition vector (and the `audience_id` it was generated under — mirrors P7 D-04 per-thread pin) at the moment the SIM runs (FLYWHEEL-02). Reconciliation reads the pinned prediction, never recomputes.
**Warning signs:** Predicted vector computed inside the reconcile function instead of read from a row.

## Code Examples

### Signature derivation (PREDICTED) — pure, deterministic
```typescript
// Source: src/lib/audience/temperature-disposition.ts (TEMPERATURE_DISPOSITION lens)
//         + src/lib/engine/flash/flash-schema.ts (FlashPersona[])
import { TEMPERATURE_DISPOSITION } from "@/lib/audience/temperature-disposition";
import type { Disposition } from "@/lib/audience/audience-types";
import type { FlashPersona } from "@/lib/engine/flash/flash-schema";

const DISPOSITIONS: Disposition[] =
  ["scanner","skeptic","collector","connector","converter","lurker"];

/** PREDICTED signature = share of STOPS attributable to each disposition. */
export function predictedSignature(personas: FlashPersona[]): Record<Disposition, number> {
  const stopByDisp: Record<Disposition, number> = Object.fromEntries(
    DISPOSITIONS.map(d => [d, 0]),
  ) as Record<Disposition, number>;
  let totalStops = 0;
  for (const p of personas) {
    if (p.verdict !== "stop") continue;
    const arch = p.archetype as keyof typeof TEMPERATURE_DISPOSITION;
    const disp = TEMPERATURE_DISPOSITION[arch]?.disposition;
    if (!disp) continue;                 // honesty: skip unknown archetype, never fabricate
    stopByDisp[disp] += 1;
    totalStops += 1;
  }
  // normalize to shares; all-zero stays all-zero (no NaN)
  if (totalStops === 0) return stopByDisp;
  for (const d of DISPOSITIONS) stopByDisp[d] = stopByDisp[d] / totalStops;
  return stopByDisp;
}
```

### Realized signature (engagement metrics → disposition vector) — pure
```typescript
// The disposition→engagement-proxy mapping (see §Disposition→Engagement-Proxy Table).
// Each realized metric is a per-mille rate over views; absent channels = null (excluded).
type RealizedMetrics = {
  views: number | null;
  saves: { value: number; source: "public_scrape"|"creator_supplied" } | null;     // collector
  shares: { value: number; source: ... } | null;                                   // connector
  comments: { value: number; source: ... } | null;                                 // connector (secondary)
  watch_through_pct: { value: number; source: "creator_supplied" } | null;         // lurker / scanner
  link_clicks: { value: number; source: "creator_supplied" } | null;              // converter
};
// realizedSignature() returns Partial<Record<Disposition, number>> — only channels with signal.
// Convert each present channel to a rate, then normalize ACROSS PRESENT channels only.
```

### Reconcile + classify (calibration vs craft) — pure
```typescript
// divergence[d] = realized[d] - predicted[d], over dispositions present in BOTH.
// Classification rule (see §Calibration-vs-Craft Classifier):
//   - If the AUDIENCE-MIX dispositions (collector/connector/converter — who, not how-well)
//     diverge consistently → CALIBRATION error → Audience override.
//   - If the CRAFT dispositions (scanner/skeptic = hook stopped them? lurker = retention)
//     diverge → CRAFT error → Account Read guidance (no model mutation).
```

### Confidence gate (≥N consistent) — pure aggregate
```typescript
// See §Divergence + Confidence Math for the exact thresholds.
// Input: reconciliations rows for one audience. Output: ProposalSet | null.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Outcome = `actual_score` vs `predicted_score` headline delta (`/api/outcomes`, `outcome-form.tsx`) | Engagement-SIGNATURE reconciliation per disposition (D-02) | P10 | The existing outcome form/route stays for legacy single-number reporting but the flywheel uses the new signature path. The form should be extended (or a new card built) to capture the per-channel breakdown. |
| `cron/validate-rules` global rule-weight EMA (no-op, schema-dead) | Per-audience disposition recalibration via `analysis_override` | P10 | Do not revive `validate-rules`; the flywheel is the live learning loop. |
| Audience calibration = one-shot at creation (P7) | Audience self-corrects over outcomes (P10) | P10 | `audiences.persona_weights` becomes a living value, written by confirmed proposals. |

**Deprecated/outdated:**
- `outcomes` `real_*` columns (migration `20260526000000`): dead/conflicting. Ignore.
- `cron/validate-rules`: documented no-op. Do not depend on or revive.

---

## DEEP RESEARCH: The Flywheel Math & Schema (Claude's Discretion items)

### 1. Disposition → Engagement-Proxy Mapping Table (D-02 / D-03)

The 10 archetypes already encode engagement signatures in their byte-stable definitions (`wave3/persona-registry.ts`). Collapsing through the P8-locked `TEMPERATURE_DISPOSITION` lens yields 6 dispositions. Below maps each disposition to the **realized engagement signal** that proves it fired, with the archetype evidence quoted from the registry. `[VERIFIED: persona-registry.ts + temperature-disposition.ts]`

| Disposition | Archetypes (from lens) | Realized signal (proxy) | Channel availability | Registry evidence |
|-------------|------------------------|-------------------------|----------------------|-------------------|
| **collector** | saver | **saves / views** (save rate) | public on TikTok (apidojo `bookmarks`); else creator-supplied | saver: "engagement signature is heavily save-weighted; comment intent ~10% of save intent" |
| **connector** | high_engager, sharer, loyalist | **shares / views** (primary) + **comments / views** (secondary) | shares+comments public | sharer: "share intent 2-3× the average"; high_engager: "likes, comments, follows actively"; loyalist: "comment more" |
| **converter** | niche_deep_buyer | **link-clicks** (primary) + **saves on relevant** (secondary) | clicks creator-supplied only | niche_deep_buyer: "save intent on RELEVANT content very high … ready to convert" |
| **scanner** | purposeful_viewer, cross_niche_curiosity | **watch-through to value point** / completion of utility | retention creator-supplied | purposeful_viewer: "watch-through correlates strongly with whether the video delivered" |
| **lurker** | lurker | **watch-through %** (high, with near-zero overt engagement) | retention creator-supplied; low like/comment public corroborates | lurker: "watch-through 60-100% … overt engagement near-zero" |
| **skeptic** | tough_crowd, niche_deep_scout | **early drop-off / low first-3s retention** (inverse signal — did the hook survive the filter?) | retention curve creator-supplied; low overall engagement public corroborates | tough_crowd: "scroll past in <3 seconds unless the hook lands"; niche_deep_scout: "watch-through short if surface-level" |

**Design notes for the planner:**
- **collector / connector / converter = the "WHO" dispositions → calibration signal.** They tell you *which segment actually showed up* relative to the modeled mix. Persistent divergence here = the audience MIX is wrong → recalibrate.
- **scanner / lurker / skeptic = the "HOW WELL" dispositions → craft signal.** They tell you whether the *content delivered* to the audience that showed up (retention, hook survival). Divergence here = craft, route to Account Read, NEVER recalibrate. (This is the mechanical basis of D-03.)
- This split is a proposal grounded in the registry semantics; mark `[ASSUMED]` for the exact collector/connector/converter-vs-scanner/lurker/skeptic assignment to calibration-vs-craft — it is the single most important value for the owner to confirm at plan/discuss time.

### 2. Divergence + Confidence Math (D-05) — deterministic, cache-stable

All quantities are pure functions of stored rows; no model calls, no `Date.now`/`Math.random` in the math.

**Per-post per-disposition divergence** (over dispositions present in BOTH predicted and realized, normalized to shares):
```
div_post[d] = realized_share[d] − predicted_share[d]        ∈ [−1, 1]
```

**Per-disposition consistency aggregate** over a creator's last K reconciliation rows for one audience:
```
n[d]        = count of posts where channel d had a realized signal           (presence)
mean[d]     = (1/n[d]) Σ div_post[d]                                          (signed mean divergence)
agree[d]    = fraction of those posts with sign(div_post[d]) == sign(mean[d]) (directional consistency)
```

**Proposed gate constants** (tunable — `[ASSUMED]`, flagged for owner confirmation; chosen for noise-resistance over responsiveness per D-05):
```
N_MIN           = 5     // minimum posts with a realized signal for that disposition
DIV_THRESHOLD   = 0.12  // |mean[d]| must exceed 12 percentage-points of share to matter
AGREE_THRESHOLD = 0.70  // ≥70% of posts must diverge in the same direction (consistency)
```
**PROPOSE a recalibration for disposition d iff:**
```
n[d] ≥ N_MIN  AND  |mean[d]| ≥ DIV_THRESHOLD  AND  agree[d] ≥ AGREE_THRESHOLD
AND d is a CALIBRATION disposition (collector/connector/converter)
```

**Translating a confirmed proposal into a weight delta** (bounded, deterministic):
- Map the diverging disposition back to its `PersonaWeights` slot via the existing `ARCHETYPES_PER_SLOT` grouping in `persona-repaint.ts` (collector→saver→`fyp` slot members; converter→niche_deep_buyer→`niche` slot; connector spans fyp+loyalist; etc.).
- Apply a **bounded nudge**: `slot_weight_new = clamp(slot_weight_old + ASSUMED_STEP * sign(mean[d]), 0, 1)` with `ASSUMED_STEP = 0.05`, then **re-normalize all four weights to sum 1.0** via the existing `normalizeWeights()`.
- The creator sees the human-readable nudge ("your buyers ran warmer — recalibrate?"); the math under it is the disposition delta, not the headline band.
- Because the write goes through `normalizeWeights` and the `audiences_weights_sum_check` CHECK constraint (`ABS(sum−1.0)<0.01`), the result is always a valid, cache-stable weight vector.

**Determinism guarantee:** every input (predicted vector, realized vector, K rows) is read from tables; the gate and the delta are pure arithmetic; the only non-deterministic act is the human confirm. The General audience is excluded (`is_general` short-circuit), so the regression gate is satisfied by construction (same proof as P7 AUD-03).

### 3. Calibration-error vs Craft-error Classifier (D-03)

```
For each diverging disposition d (passing the per-post divergence test):
  if d ∈ {collector, connector, converter}:   // the WHO — segment showed up differently
       → CALIBRATION error  → contributes to the confidence gate → may PROPOSE override
  if d ∈ {scanner, lurker, skeptic}:           // the HOW-WELL — content delivery to who showed up
       → CRAFT error  → append to Account Read guidance ("hook predicted to stop scanners
                         but retention craters at 2s") → NEVER touches the model
```
**Tie-break / both-diverge case:** if calibration dispositions AND craft dispositions both diverge on the same post, log both rows; the calibration side feeds the gate, the craft side feeds Account Read. They are not mutually exclusive — a post can have both a mis-modeled audience and weak craft. This is the explicit D-03 protection: a content flop (craft) never reaches the override path.

**Rationale grounded in the registry:** collector/connector/converter are defined by *what action the viewer takes* (save/share/buy) = identity of the segment present. scanner/lurker/skeptic are defined by *how far/whether they watch* = a verdict on the content's delivery. The first answers "did we model who's here?"; the second answers "was the content good for them?"

### 4. DB Schema (D-04 / D-06) — Supabase migrations

**Recommendation: two NEW tables + reuse the live `outcomes` only for the legacy headline path.** Do NOT widen `outcomes` (Pitfall 1). All mirror the established RLS + `user_id`-from-session idiom (`audiences.sql`, `audience_overrides.sql`).

```sql
-- <ts>_outcome_signatures.sql  (FLYWHEEL-01/02)
CREATE TABLE public.outcome_signatures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id     text,                  -- FK semantics: analysis_results.id is TEXT (STATE note)
  audience_id     uuid REFERENCES public.audiences(id) ON DELETE SET NULL,  -- pin (Pitfall 6)
  platform_post_url text,
  posted_at       timestamptz,
  -- PREDICTED disposition vector (pinned at SIM time, normalized shares)
  predicted_vector jsonb NOT NULL,       -- {scanner, skeptic, collector, connector, converter, lurker}
  -- REALIZED disposition vector + per-channel provenance (null channel = unknown)
  realized_vector  jsonb,                -- partial; only channels with signal
  realized_provenance jsonb,             -- {saves:"public_scrape", retention:"creator_supplied", ...}
  raw_metrics      jsonb,                -- {views, likes, comments, shares, saves, watch_through_pct, link_clicks}
  source           text NOT NULL DEFAULT 'paste_url',  -- 'paste_url' | 'drift_scrape'
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outcome_signatures_user_idx     ON public.outcome_signatures(user_id);
CREATE INDEX outcome_signatures_audience_idx ON public.outcome_signatures(audience_id);
ALTER TABLE public.outcome_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY os_all_own ON public.outcome_signatures
  FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- <ts>_reconciliations.sql  (FLYWHEEL-03/05 — the cross-creator SEED, D-06)
CREATE TABLE public.reconciliations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outcome_signature_id uuid REFERENCES public.outcome_signatures(id) ON DELETE CASCADE,
  audience_id     uuid REFERENCES public.audiences(id) ON DELETE SET NULL,
  -- ── cross-creator prior-fitting rails (D-06): denormalized, privacy-safe aggregables ──
  niche           text,                  -- from creator profile / audience
  goal_intent     text,                  -- grow|sell|authority|nurture (the bias context)
  follower_tier   text,                  -- bucket, not raw count (privacy)
  predicted_vector jsonb NOT NULL,
  realized_vector  jsonb NOT NULL,
  divergence_vector jsonb NOT NULL,      -- realized − predicted per disposition
  classification   jsonb NOT NULL,       -- {collector:"calibration", scanner:"craft", ...}
  proposal_state   text NOT NULL DEFAULT 'logged',  -- 'logged'|'proposed'|'confirmed'|'declined'
  proposed_delta   jsonb,                -- the bounded weight delta if proposed
  confirmed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reconciliations_user_idx     ON public.reconciliations(user_id);
CREATE INDEX reconciliations_audience_idx ON public.reconciliations(audience_id);
-- Cross-creator seed query (FUTURE phase, not built now): aggregate divergence_vector
-- GROUP BY (niche, goal_intent, follower_tier) → the prior-fitting input. Rails only.
ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY rec_all_own ON public.reconciliations
  FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
```
**Why this seeds D-06 correctly:** `reconciliations` carries the *denormalized, aggregable, privacy-safe* fields (niche, goal_intent, follower_tier bucket, divergence vector, classification) that a future cross-creator prior-fitting job needs — without building that job. The future phase queries `GROUP BY (niche, goal_intent, follower_tier)`; P10 just guarantees the rows exist with those columns. Lay the rails, don't fake it.

> **FK note:** `analysis_results.id` is TEXT on the live DB (STATE Decisions: "reading_id FK is text not uuid"). Use `text` for `analysis_id`, not `uuid`.

### 5. Saved-shelf Persistence (D-07) — NEW typed table (recommend)

`user_bookmarks` is `(user_id, video_id)` only — too narrow for typed cross-skill items. Add a `saved_items` table; keep `user_bookmarks` for Discover video bookmarks.

```sql
-- <ts>_saved_items.sql  (SAVE-01/02)
CREATE TABLE public.saved_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type    text NOT NULL CHECK (item_type IN
                 ('read','idea','hook','script','outlier','format')),  -- typed (D-07)
  ref_id       text,            -- analysis_id / message_id / video_id the item points at
  thread_id    uuid REFERENCES public.threads(id) ON DELETE SET NULL,  -- thread↔shelf wiring
  title        text,
  snapshot     jsonb NOT NULL,  -- the saved block props (so the shelf renders without re-fetch)
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_items_user_type_idx ON public.saved_items(user_id, item_type);
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_all_own ON public.saved_items
  FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
-- FLAT by construction: no folder_id, no tags. P12 EXTENDS (adds watchlist/collection
-- as SEPARATE tables or columns) — never reworks this flat shape (D-07).
```
**Thread↔shelf wiring seams:**
- **Save (Act→State):** thread card components (`hook-card-block.tsx`, `idea-card-block.tsx`, `script-card-block`, `remix-card-block`, `outlier-grid-block`, the new `account-read-block`) gain a "Save" affordance → `POST /api/saved` with `{item_type, ref_id, thread_id, snapshot}`. `snapshot` = the block's props so the shelf renders the same typed renderer without a re-fetch.
- **Use (State→Act):** shelf surface items launch back into the thread via the existing `CHAIN_HANDOFFS` SSOT (`chain-handoff.ts`) — e.g. a saved hook → "Test full →" / "Develop →". This is the P12-extendable launchpad pattern; P10 wires the minimal set.
- **Surface placement:** new route under `src/app/(app)/saved/` (MUST be inside the `(app)` route group to inherit `AppShell`/auth/sidebar — STATE 07-05 note) + a sidebar nav item.

### 6. Account Read Generation (D-08) — reuse `reading/`, honest thin fallback

- **Inputs:** `ApifyScrapingProvider.scrapeProfile(handle)` + `scrapeVideos(handle, 30)` (own account — apidojo multi-post, NOT single-URL) ∪ `GET /api/analysis/history` (the creator's prior Reads).
- **Pattern extraction (deterministic + light LLM):** from `VideoData[]` derive recurring hook openings, format mix (content types), and drop-points; from analysis/history surface prior Read scores and the craft-error guidance accumulated in `reconciliations`. The "working-vs-fix" framing comes from: top-performing patterns (working) + craft-error dispositions (fix).
- **Render:** a new `account-read-block` thread card that composes `reading/` components (`ReadingHero` repurposed for the account summary, accordions for pattern sections). Register in `BLOCK_REGISTRY` + `block-registry.ts` like every other typed block (`multi-audience-read` is the closest precedent — a static composed card). This keeps it a fixed typed renderer (no model-generated UI).
- **Honesty / thin fallback (SELF-02, carries P7 D-06):** reuse the P7 thin gate — `getFollowerTier === null AND videos < THIN_MIN_VIDEOS` (or scrape error) → honest "not enough history to read yet" state (warning-toned, never error, never fabricated), exactly like `calibration.ts` returns `{fallback:'thin'}` and `reading.tsx` D-13 gates render `CouldNotAnalyze`. NEVER fabricate account patterns.
- **Sync vs stream:** **Stream.** Apify multi-post scrape on an own account is the same 1-3 min profile of P7 calibration (`waitSecs:120` for `scrapeVideos`, `maxDuration=300`). Use the `calibrate/route.ts` SSE pattern verbatim (`status` → `done`/`fallback`/`error`). `[VERIFIED: apify-provider waitSecs config + calibrate maxDuration=300]`
- **Accuracy track record (SELF-03):** "within X% on your last N" computed from `reconciliations` (the craft-error magnitude trend) — a compounding trust signal that builds over outcomes.

### 7. Drift Trigger (folds into D-05, FLYWHEEL-06)

- **Cadence (proposed, `[ASSUMED]`):** weekly — `"0 5 * * 1"` in `vercel.json` crons. Audience composition shifts slowly; weekly balances freshness vs Apify cost. (Trending scraper runs every 6h; drift is far less urgent.)
- **Mechanism:** new `src/app/api/cron/audience-drift/route.ts` mirrors `cron/scrape-trending`: `verifyCronAuth` → `createServiceClient` → for each personal audience, re-scrape the own account (`scrapeProfile`+`scrapeVideos`) → derive a fresh composition (the same `deriveAudienceProfile` from P7) → compute a **composition-shift vector** (new disposition mix − stored audience mix).
- **Folds into the SAME PROPOSE path:** a composition shift is just another source of disposition divergence. Write an `outcome_signatures` row with `source='drift_scrape'` (realized = fresh composition, predicted = stored audience mix) and run it through the SAME `reconcile` + `confidence-gate`. The drift half and the outcome half converge on one recalibration PROPOSE path — this is exactly D-01's "folded in, not built separately."
- **Webhook vs inline:** `cron/scrape-trending` uses the webhook-on-completion pattern (`/api/webhooks/apify`). For per-audience drift you can either reuse the webhook (add a `purpose:'drift'` discriminator to the payload) or run inline with `.call({waitSecs})` since the cron route itself can tolerate the latency (no client waiting). Inline is simpler for v1; webhook is more scalable — planner's call, but note `vercel.json` function maxDuration limits.

### 8. Cross-creator Seed (D-06) — what the log MUST carry

Covered by the `reconciliations` table above. The non-negotiable fields for a future prior-fitting job: `niche`, `goal_intent`, `follower_tier` (bucket, not raw), `predicted_vector`, `realized_vector`, `divergence_vector`, `classification`, `proposal_state`. With these, a future job runs `aggregate divergence_vector GROUP BY (niche, goal_intent, follower_tier)` to surface systematic base-prior errors (e.g. "fitness-cold audiences under-predict saves"). **P10 builds none of the fitting; it only guarantees the rows.**

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Apify (`apify-client`) | Outcome scrape, Account Read, drift | ✓ | ^2.22.1 | Outcome capture degrades to creator-supplied-only (D-04 already allows this). |
| `APIFY_TOKEN` / `APIFY_WEBHOOK_SECRET` env | Scrape + webhook | ✓ (existing) | — | — |
| Supabase + migrations dir | New tables, RLS, cron | ✓ | — | — |
| Vercel Cron (`vercel.json`) | Drift schedule | ✓ (8 crons configured) | — | Manual trigger route. |
| `verifyCronAuth` + `CRON_SECRET` | Drift auth | ✓ (existing) | — | — |
| `reading/` components | Account Read render | ✓ | — | — |
| SIM-1 Flash output (`FlashPersona[]`) | Predicted signature | ✓ | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** retention/saves/link-clicks public scrape — not universally available; D-04's creator-supplied add is the designed fallback (honesty spine: absent channel = excluded, never zero-filled).

## Project Constraints (from CLAUDE.md + STATE Hard Constraints)

- **Engine OPEN but regression-gate-PROTECTED:** recalibration must be confidence-gated + creator-confirmed + cache-stable; never silent scoring mutation; never touch `DEFAULT_PERSONA_WEIGHT_CONFIG`, `ARCHETYPE_DEFINITIONS`, or `ENGINE_VERSION`. Add a General-weights-unchanged regression test.
- **Qwen-only** pipeline — any LLM step (e.g. optional Account Read pattern naming) uses the existing Qwen path, no Gemini/DeepSeek.
- **Fixed typed renderers** — Account Read + shelf items are typed blocks in `BLOCK_REGISTRY`; NO model-generated UI.
- **flat-warm SSOT (THEME-06)** — design authority for ALL new UI (shelf surface + Account Read chrome). Account Read additionally reuses fixed `reading/` renderers. A UI-SPEC is warranted (CONTEXT flags "UI hint = yes").
- **Files < 500 lines; DDD bounded contexts; typed public APIs; input validation at boundaries (zod); auth-first on every route** — all per CLAUDE.md + the existing route idiom.
- **No autonomous fire-and-forget** (memory + CLAUDE.md human-in-the-loop) — PROPOSE→confirm everywhere; drift never auto-applies.
- **Reuse Apify scrape — NOT new Connectors/OAuth** (D-08; do not import Sandcastles' OAuth ownership model — P7 personal-scrape satisfies ownership).
- **Per-thread active audience pin** (P7 D-04) — predicted signature pins the `audience_id` it was generated under (Pitfall 6).

## Assumptions Log

> Claims tagged `[ASSUMED]` needing owner/discuss confirmation before they become locked decisions.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Calibration dispositions = {collector, connector, converter}; craft dispositions = {scanner, lurker, skeptic} | §Disposition Table, §Classifier | This is the heart of D-03; a wrong split routes craft flops into the audience override (the exact failure D-03 prevents). HIGHEST-VALUE to confirm. |
| A2 | Gate constants N_MIN=5, DIV_THRESHOLD=0.12, AGREE_THRESHOLD=0.70 | §Divergence Math | Too loose → noisy recalibration; too tight → loop never fires. Tunable; start conservative. |
| A3 | Bounded weight step ASSUMED_STEP=0.05 per confirmed proposal | §Divergence Math | Too large → over-correction; structure (clamp+normalize) is sound regardless of value. |
| A4 | Drift cron cadence = weekly (`0 5 * * 1`) | §Drift Trigger | Wrong cadence = stale audiences or Apify cost; trivially tunable. |
| A5 | Saves public via apidojo `bookmarks` on TikTok; retention/link-clicks creator-supplied only | §Pitfall 3, §Disposition Table | If saves are NOT reliably public, the collector calibration channel becomes creator-supplied-dependent. Verify against a live apidojo run during plan. |
| A6 | Apify own-account scrape latency ≈ P7 calibration (1-3 min, fits maxDuration=300) | §Account Read | If slower, need webhook-async for Account Read too. Inferred from `waitSecs` config, not timed this session. |
| A7 | Single posted-URL metrics obtainable via clockworks `resolveVideoUrl` path (extend to return VideoData not just mp4Url) | §Pitfall 2 | If clockworks single-URL doesn't return full metrics, outcome public capture needs a different actor call. Verify with a live run. |

## Open Questions

1. **Does clockworks single-URL mode return full public metrics (views/likes/comments/shares), or only the media URL?**
   - What we know: `resolveVideoUrl` uses clockworks single-URL and parses `mediaUrls`; `apifyVideoSchema` exists and the apidojo path extracts full metrics.
   - What's unclear: whether the clockworks single-post item carries the metric fields (it should — it's the same scraper family) — not confirmed with a live run this session.
   - Recommendation: a plan Wave-0 spike: one clockworks `postURLs:[url]` run, inspect the item for `playCount/diggCount/shareCount/commentCount/collectCount`. Add `scrapeSinglePostMetrics(url)` to `ApifyScrapingProvider`.

2. **Are TikTok saves (`collectCount`/`bookmarks`) reliably present in public scrape across accounts?**
   - apidojo maps `bookmarks→saves` for multi-post; single-post via clockworks may differ.
   - Recommendation: same Wave-0 spike; if absent, collector becomes a creator-supplied channel (D-04 already supports).

3. **Should the legacy `outcome-form.tsx` / `/api/outcomes` path be retired, extended, or left parallel?**
   - The flywheel uses the new signature path; the old form captures a headline score.
   - Recommendation: leave `/api/outcomes` as-is (don't break it), build the signature capture as a NEW card/route; revisit consolidation post-P10.

## Validation Architecture

> `workflow.nyquist_validation` is `false` for this milestone — section optional. Included lightly because the flywheel math is the highest-risk surface.

The flywheel math modules (`signature.ts`, `realized-signature.ts`, `reconcile.ts`, `confidence-gate.ts`, `recalibration.ts`) are **pure functions** and should carry unit tests regardless of the nyquist setting:
- `predictedSignature` / `realizedSignature`: deterministic vector output for fixed input; absent-channel exclusion; all-zero → no NaN.
- `reconcile` + classifier: calibration-vs-craft routing for crafted divergence fixtures.
- `confidence-gate`: fires at exactly N_MIN, holds below; direction-consistency respected.
- **Regression anchor (mandatory):** assert that a full flywheel run NEVER changes General audience weights or `DEFAULT_PERSONA_WEIGHT_CONFIG` (mirror P7 `persona-weights.test.ts` AUD-03). This is the regression-gate guarantee.

## Security Domain

> `security_enforcement` is `false` in config — section optional. Key controls (the codebase already enforces these idioms; the plan must keep them):
- **Auth-first** on every new route (`getUser()` before any DB read) — mirror `outcomes`/`calibrate`/`audiences` routes.
- **RLS own-rows-only** on all three new tables (`auth.uid()=user_id`) — mirror `audiences.sql`.
- **`user_id` from session, NEVER from input** — mirror `createAudience` CR-01.
- **zod validation** on all bodies; `sanitizeText` on any handle/URL echoed.
- **SSRF guard** on any scrape URL — `resolveVideoUrl` already enforces the HTTPS allowlist; outcome paste-URL must route through the same guard.
- **Cron auth** — `verifyCronAuth` on the drift route; webhook secret via `safeSecretEqual` (timing-safe) if the drift uses the webhook path.

## Sources

### Primary (HIGH confidence — read in-session)
- `src/lib/engine/persona-weights.ts` — `resolveWeights` precedence + `analysis_override` slot (recalibration target).
- `src/lib/engine/wave3/persona-registry.ts` — 10 archetype definitions with embedded engagement signatures (disposition mapping source).
- `src/lib/audience/temperature-disposition.ts` — locked 10→6 disposition lens.
- `src/lib/audience/{calibration,audience-repo,audience-types,persona-repaint}.ts` — Audience object + thin gate + share computation.
- `src/lib/engine/flash/{flash-schema,flash-aggregate}.ts` + `src/lib/tools/runners/flash-runner.ts` — predicted-signature source (FlashPersona[]).
- `src/lib/scraping/{apify-provider,types}.ts` — single-URL (clockworks) vs multi-post (apidojo) actors; SSRF guard; `saves`=apidojo `bookmarks`.
- `src/app/api/audiences/calibrate/route.ts` + `[id]/route.ts` — SSE pattern + recalibration write path.
- `src/app/api/outcomes/route.ts` + `src/components/app/simulation/outcome-form.tsx` + `src/hooks/queries/use-outcomes.ts` — legacy outcome path to extend.
- `src/app/api/{bookmarks,analysis/history,webhooks/apify,cron/scrape-trending,cron/validate-rules}/route.ts` — shelf, Account Read source, webhook + cron patterns.
- `src/components/reading/reading.tsx` (+ component listing) — D-13 honesty gates, reuse target.
- `supabase/migrations/{20260213000000_content_intelligence,20260526000000_outcomes_and_filmstrips,20260619000000_audiences}.sql` — the dual `outcomes` landmine + RLS idiom.
- `vercel.json` — cron config. `.planning/config.json` — nyquist/security flags off.

### Secondary (MEDIUM confidence)
- Inferred Apify latency from `waitSecs` (60/120/180) + `calibrate` `maxDuration=300` — not timed live this session (A6).

### Tertiary (LOW confidence)
- Gate/step constants (A2/A3) and drift cadence (A4) — engineering proposals, tune in plan/discuss.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; all reuse confirmed in-session.
- Architecture / seams: HIGH — every integration point read and mapped.
- Flywheel math: HIGH on structure (derived from byte-stable registry + locked lens), MEDIUM on exact constants (flagged A2/A3).
- Schema: HIGH — mirrors established migration idiom; dual-`outcomes` landmine confirmed.
- Apify single-URL metric availability: MEDIUM — needs a Wave-0 live spike (Open Q1/Q2).

**Research date:** 2026-06-19
**Valid until:** ~2026-07-19 (stable internal codebase; the only external dependency, Apify actor field shapes, can drift — re-verify the single-URL metric spike at plan time).
