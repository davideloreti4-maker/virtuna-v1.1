# Phase 7: Audience Manager — calibrated audience as shared substrate - Research

**Researched:** 2026-06-18
**Domain:** Engine persona-weight layering + calibration pipeline + Supabase persistence + composer/thread UI wiring
**Confidence:** HIGH (codebase-verified — all seams read directly; no external API surface beyond shipped Apify infra)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Substrate + react-wiring + 1 steer proof):** P7 builds the Audience object, Manager CRUD UI, calibration pipeline, general-audience default + regression gate, and wires audience into the **SIM/react** path. Position-① **steer** is proven in **ONE skill only — `ideas-runner`** (swap profile-grounding → audience-grounding there). Steer-everywhere + value tuning = post-P7 refinement run.
- **D-02 (Layer over existing 10 — reweight + repaint, do NOT rebuild):** Keep the 10 archetype IDs and their **byte-stable** system prompts in `wave3/persona-registry.ts` untouched. Calibration produces a **`PersonaWeights` override** plus a **per-audience persona description repaint**. **Temperature (cold/warm/hot) × Disposition (scanner/skeptic/collector/connector/converter/lurker)** is a **presentation/label lens mapped onto the existing 10**, NOT a new engine vocabulary.
- **D-03 (Visible read-only profile + persona list):** After calibration, show the **Audience Profile** AND the **10 calibrated personas read-only**. **No editing in v1.**
- **D-04 (General + 2 goal-leaning templates, per-thread active):** Sidebar presets = **General** (locked default 10) + **2 ready-made templates** (growth/cold-share-leaning + conversion/converter-leaning). Active audience chosen at the **composer chip** and **pinned per-thread**. New threads pick fresh; switching mid-thread re-grounds **future turns only**.
- **D-05 (Fixed goal-intent taxonomy with free-text label):** Creator types **any goal label** (free-set, display), mapping to a **small fixed set of weight intents** — `grow / sell / authority / nurture`. Each intent = a **deterministic `PersonaWeights` bias**. Cached per-audience, not per-run.
- **D-06 (Creator's own handle → calibrate → graceful General fallback):** A **Personal** audience scrapes the **creator's OWN account** via the existing Apify follower-scrape infra. If scrape is **empty/thin/fails**, fall back to described/General calibration with an **honest notice** — **never fabricate**.

### Claude's Discretion

- Exact `PersonaWeights` bias values per goal-intent (structure now, values tuned in refinement run).
- The exact mapping table from the 10 archetypes → Temperature×Disposition labels.
- Calibration sync/async UX detail (whether scrape blocks or streams) — researcher confirms Apify shape + latency.
- Whether goal-intent is creator-picked (dropdown) vs LLM-classified-once at calibration — pick post-research; either must resolve to a cached, deterministic bias.
- Audience persistence shape (DB schema) — planner discretion, must keep `audience_id`→`audience_ids[]`-ready.
- THEME-06 flat-warm visual system is the design SSOT for the Manager UI, persona cards, composer chip.

### Deferred Ideas (OUT OF SCOPE)

- Steer position-① across the remaining skills (hook/script/test/remix/chat) — P7 proves steer in ideas-runner only.
- Persona value tuning (prompt wording, signal→score weight fitting via fold A/B).
- Persona editing by the creator (read-only in v1).
- Multi-select audience compare (object kept `audience_ids[]`-ready).
- Real social OAuth (no OAuth v1; Apify scrape + description only).
- Spread/virality prediction in the Read.
</user_constraints>

<phase_requirements>
## Phase Requirements

REQUIREMENTS.md does not yet formalize Phase 7 IDs (marked TBD). Coverage derives from CONTEXT.md decisions D-01..D-06. Proposed requirement skeleton for the planner to formalize:

| ID (proposed) | Description | Research Support |
|----|-------------|------------------|
| AUD-01 | Audience object + CRUD + persistence (`audience_id`→`audience_ids[]`-ready) | §Audience Persistence Schema — new `audiences` table mirroring `creator_persona_weights`/`threads` RLS idiom |
| AUD-02 | Calibration pipeline (scrape/description → Audience Profile → repaint + weight override) | §Calibration Pipeline — reuses `ApifyScrapingProvider.scrapeProfile`/`scrapeVideos` + `follower-tier.ts` |
| AUD-03 | General audience = default across all tools + regression gate | §Regression Gate — General = untouched `DEFAULT_PERSONA_WEIGHT_CONFIG`, gate is free by construction |
| AUD-04 | Audience wired into react (SIM/Flash) path | §React Seam — `analysis_override`/`creator_override` precedence in `resolveWeights` + niche-aware Flash prompt repaint |
| AUD-05 | One steer proof in ideas-runner | §Steer Seam — swap `buildGroundingLine(profileRow,…)` → audience-grounding in `ideas-runner.ts` |
| AUD-06 | Goal → deterministic scoring reweight (fixed intent taxonomy) | §Goal-Intent Taxonomy — reuse `WEIGHT_PRESETS` mixes; cache per-audience |
| AUD-07 | Manager CRUD UI + 3 presets + composer chip (`platform · name`), per-thread pin | §Composer Chip & Thread Pin + 07-UI-SPEC.md |
| AUD-08 | Creator profile slim to name-only | §Creator Profile Slim-Down — blast radius confined to `creator_profiles` reads |
</phase_requirements>

## Summary

Phase 7 is overwhelmingly a **wiring + persistence** phase, not a greenfield-engine phase. Every load-bearing mechanism the design needs **already ships** in this codebase: the 10 byte-stable archetypes (`wave3/persona-registry.ts`), the `PersonaWeights` precedence resolver with a `creator_override`/`analysis_override` slot literally built for calibration (`persona-weights.ts`), an `analysis_override` JSONB column + a `creator_persona_weights` table + an override write route (Phase-4 "Live Audience Node" prior art), the niche-aware Flash repaint mechanism (`buildNicheAwareSystemPrompt`), the ideas-runner steer seam (`buildGroundingLine(profileRow, platform)`), the per-thread context-carry model (`threads`/`messages` + `CHAIN_HANDOFFS`), and the Apify follower-scrape provider (`ApifyScrapingProvider`). There is also a complete **goal-intent weight preset table** (`WEIGHT_PRESETS`) ready to map onto `grow/sell/authority/nurture`.

The regression gate is **free by construction**: the General audience IS the untouched `DEFAULT_PERSONA_WEIGHT_CONFIG`. The Max video aggregator (`aggregator.ts` L1110) resolves weights with `{ niche }` only and never injects `analysis_override` for an uncalibrated/General path, so same-video score-identity is preserved as long as calibration writes its override into a **new, audience-scoped channel** and never mutates `ARCHETYPE_DEFINITIONS` or the default config. `ENGINE_VERSION` (3.19.0) must NOT bump — this phase touches the text/generation path and adds an additive weight channel, not deliberate video-scoring math.

**Primary recommendation:** Build a new `audiences` table (audience-scoped `PersonaWeights` override + repainted persona descriptions + calibration metadata, `audience_id` PK so multi-select is a later additive `audience_ids[]` change). Thread the active `audience_id` from the composer chip → per-thread pin → runner calls. In the react path, resolve the audience's stored `PersonaWeights` (goal-intent bias pre-baked at calibration via `WEIGHT_PRESETS`) and pass repainted persona descriptions into the Flash prompt builder. In the steer path, swap `ideas-runner`'s `buildGroundingLine(profileRow,…)` for an audience-grounding line. Goal-intent: **creator-picked dropdown** (more deterministic + zero LLM nondeterminism), resolving to a cached deterministic bias. Keep General = default everywhere; the gate is a single test asserting General reproduces `DEFAULT_PERSONA_WEIGHT_CONFIG` and `ENGINE_VERSION` is unchanged.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Audience object CRUD + persistence | API / Backend (Next.js route + Supabase) | — | RLS-scoped owner data; mirrors `creator_persona_weights` + `threads` |
| Calibration (scrape → profile → repaint + weights) | API / Backend (server route) | External (Apify) | Reuses `ApifyScrapingProvider`; server-only token; SSRF guard already in provider |
| PersonaWeights override resolution | API / Backend (engine `resolveWeights`) | — | Pure deterministic; precedence chain already shipped |
| Persona repaint (per-audience descriptions) | API / Backend (Flash prompt builder) | — | Layers over `buildNicheAwareSystemPrompt`; never mutates byte-stable defs |
| Goal-intent → weight bias | API / Backend (cached at calibration) | — | Deterministic table lookup; cached per-audience to keep scoring path pure |
| Manager CRUD UI + persona display | Frontend Server (Next.js page `/audience`) | Client (interactive forms) | Settings-style page scaffold; read-only profile = server-renderable |
| Composer audience chip + per-thread pin | Client (composer is `"use client"`) | API (persist pin per-thread) | Chip is interactive; pin rides the existing thread-scoped state |
| Active-audience grounding into runners | API / Backend (route loads audience, passes to runner) | — | Same place the route loads `creator_profiles` today |

## Standard Stack

### Core (all already installed — no new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `apify-client` | 2.22.1 `[VERIFIED: node_modules]` | TikTok/IG follower + video scrape | Already wraps `clockworks/*` actors in `ApifyScrapingProvider` |
| `zod` | 4.3.6 `[VERIFIED: node_modules]` | Input validation at boundaries (audience body, weights) | Project SSOT; weight-sum refine pattern already in `override/route.ts` |
| `@supabase/supabase-js` (server client) | shipped `[VERIFIED: codebase]` | Persistence + RLS | `creator_persona_weights`/`threads` RLS idiom is the template |
| Next.js 15 App Router | shipped `[VERIFIED: codebase]` | Routes (`/api/audiences`, `/api/audiences/calibrate`) + page (`/audience`) | Existing `/api/tools/*` + `/settings` patterns |

### Supporting (reuse, do not re-roll — from 07-UI-SPEC.md verified inventory)
| Component | Source | Use Case |
|-----------|--------|----------|
| `NavItem` / `SectionLabel` | `src/components/sidebar/Sidebar.tsx` | Sidebar "Audience" entry |
| `PersonaGraph` | `src/components/board/_kit/PersonaGraph.tsx` | "see your audience" hero node-cloud |
| `StatTile` / `StatTileRow` | `_kit/StatTile.tsx` | Profile stat tiles (temperature mix, dispositions) |
| `DataTable` + `Badge` | `_kit/DataTable.tsx`, `ui/badge.tsx` | Read-only persona table |
| `PlatformChip` pattern | `src/components/app/home/platform-chip.tsx` | Composer audience chip (active = coral, mirrors `on`-prefix) |
| `WEIGHT_PRESETS` | `src/components/board/audience/audience-constants.ts` | Goal-intent bias seed values |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `audiences` table | Extend `creator_persona_weights` | Rejected — that table is user-PK single-row; audiences are 1:many per user and carry repaint + calibration metadata. New table is cleaner and `audience_ids[]`-ready. |
| Creator-picked goal-intent dropdown | LLM-classify-once at calibration | LLM classification adds a failure mode + needs caching anyway; dropdown is deterministic, zero-cost, testable. **Recommend dropdown.** (See Open Q1.) |
| Apify scrape (D-06 locked) | TikTok OAuth | Out of scope (no OAuth v1). |

**Installation:** None — zero new dependencies. `[VERIFIED: node_modules]`

## Package Legitimacy Audit

> No new external packages introduced this phase. All dependencies (`apify-client`, `zod`, `@supabase/supabase-js`, Next.js) are already installed and in production use.

| Package | Registry | Source Repo | Verdict | Disposition |
|---------|----------|-------------|---------|-------------|
| apify-client | npm | github.com/apify/apify-client-js | OK (shipped, in use) | Approved — no change |
| zod | npm | github.com/colinhacks/zod | OK (shipped, in use) | Approved — no change |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
  CALIBRATION (one-shot, write path)                                    │
                         │                                              │
  Personal handle ─▶ POST /api/audiences/calibrate                      │
   or Target text   │     │                                            │
                    │     ├─▶ ApifyScrapingProvider.scrapeProfile/Videos│  (personal)
                    │     │      │  thin/empty/fail ─▶ honest General    │
                    │     │      ▼  fallback (never fabricate)           │
                    │     ├─▶ derive Audience Profile (temp mix,         │
                    │     │      dispositions, follower-tier)            │
                    │     ├─▶ goal-intent (dropdown) ─▶ WEIGHT_PRESETS   │
                    │     │      bias ─▶ cached PersonaWeights           │
                    │     └─▶ persona repaint (10 descriptions)          │
                    │            ▼                                       │
                    │     INSERT audiences { weights, repaint, profile } │
                    └──────────────────────────────────────────────────┘

  GENERATION (per-turn, read path)
                                                          ┌─ General? → DEFAULT_PERSONA_WEIGHT_CONFIG (gate-protected)
  Composer chip ─▶ active audience_id (per-thread pin)    │
        │                                                 ▼
        ▼                                  resolveWeights(config, {creator/analysis override})
  POST /api/tools/{ideas|hooks|...} ─▶ load audience by id ─┐
        │                                                   ├─▶ ② REACT: repainted personas + weights
        │                                                   │      → buildNicheAwareSystemPrompt → runFlashTextMode → aggregateFlash
        │                                                   └─▶ ① STEER (ideas-runner ONLY in P7):
        │                                                          audience-grounding line replaces buildGroundingLine(profileRow)
        ▼
   typed-block cards persist to thread (audience_id stamped on the turn)

  MAX VIDEO PATH (untouched — regression-gated)
   analyze pipeline ─▶ aggregator.ts resolveWeights({ niche }) ─▶ DEFAULT mix
                       (no audience override injected for General → score-identity preserved)
```

File-to-implementation mapping in the Component Responsibilities below.

### Recommended Project Structure
```
src/
├── app/
│   ├── audience/                  # Manager CRUD page(s) — /audience, /audience/new, /audience/[id]
│   └── api/
│       └── audiences/
│           ├── route.ts           # GET (list) / POST (create)
│           ├── [id]/route.ts      # GET / PATCH / DELETE
│           └── calibrate/route.ts # SSE calibration (scrape → profile → repaint → persist)
├── lib/
│   ├── audience/
│   │   ├── audience-types.ts      # Audience domain type + AudienceProfile
│   │   ├── audience-repo.ts       # Supabase CRUD (RLS-scoped); General + presets seeding
│   │   ├── goal-intent.ts         # grow/sell/authority/nurture → PersonaWeights bias (WEIGHT_PRESETS)
│   │   ├── temperature-disposition.ts  # 10-archetype → Temp×Disposition label lens (presentation)
│   │   ├── calibration.ts         # scrape → AudienceProfile derivation + thin-data detection
│   │   └── persona-repaint.ts     # per-audience persona description overrides
│   └── tools/runners/ideas-runner.ts  # steer swap (audience-grounding) — EDIT existing
└── components/
    └── audience/                  # Manager cards, profile display, composer audience chip
```

### Pattern 1: Audience-scoped PersonaWeights override (the calibration emit)
**What:** Calibration writes a `PersonaWeights` object into the new `audiences` row. The react path resolves it through the EXISTING precedence chain.
**When to use:** Every non-General audience.
**Example:**
```typescript
// Source: src/lib/engine/persona-weights.ts (VERIFIED — precedence chain already shipped)
// Calibration produces a PersonaWeights; the goal-intent bias is pre-baked at calibration time.
const { weights } = resolveWeights(DEFAULT_PERSONA_WEIGHT_CONFIG, {
  analysis_override: audience.persona_weights, // audience's cached, goal-biased mix
});
// General audience passes NO override → returns DEFAULT mix → regression gate holds.
```

### Pattern 2: Per-audience persona repaint over byte-stable defaults (D-02)
**What:** Replace each archetype's *description text* per-audience, reusing the niche-aware prompt builder's fold mechanism — never edit `ARCHETYPE_DEFINITIONS`.
**When to use:** React path for a calibrated audience.
**Example:**
```typescript
// Source: src/lib/engine/flash/flash-prompts.ts (VERIFIED — buildNicheAwareSystemPrompt
//   already folds per-slot niche_instantiation text into the archetype block).
// P7 adds an audience-repaint layer: substitute slot.niche_instantiation (and/or a new
// audience_instantiation field) with the calibrated per-audience description.
// The skeleton (task framing, Output Schema, TYPE RULES) stays byte-stable.
```
**Critical:** the repaint must remain *deterministic per audience* so the prompt prefix is cache-stable (D-17 cache discipline). Store the repaint text in the audience row; do not generate it per-request.

### Pattern 3: Per-thread active-audience pin (D-04)
**What:** The active `audience_id` is pinned to the thread (the studio's native unit), not a global toggle. New threads default to General; switching mid-thread re-grounds future turns only.
**When to use:** Composer chip selection + every runner call.
**Example:**
```typescript
// Source: supabase/migrations/20260617000000_threads_messages.sql (VERIFIED — threads table).
// Add a nullable threads.active_audience_id column (NULL = General default).
// Cards already generated keep the audience they ran under (stamp audience_id on the
// message turn, or accept that re-grounding is forward-only — existing blocks are immutable).
```

### Anti-Patterns to Avoid
- **Mutating `ARCHETYPE_DEFINITIONS` or `DEFAULT_PERSONA_WEIGHT_CONFIG`:** breaks cache discipline AND the regression gate. Calibration is ADDITIVE only (new row, new override channel).
- **Per-run LLM goal-intent classification:** injects nondeterminism into the scoring path; fights determinism + the gate. Cache at calibration only.
- **Reusing `creator_persona_weights` for audiences:** it is single-row-per-user (PK = user_id). Audiences are 1:many and carry repaint + profile metadata. New table.
- **Global single-active audience toggle:** fights the thread-scoped state model (D-04). Pin per-thread.
- **Introducing Temperature/Disposition as new engine vocabulary:** it is a *presentation lens* only. The engine keeps `fyp/niche_deep/loyalist/cross_niche` + the 10 archetype slugs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weight precedence/normalization | Custom resolver | `resolveWeights` + `normalizeWeights` (`persona-weights.ts`) | Precedence chain + sum-to-1 normalization + all-zero guard already shipped + unit-tested (8 cases) |
| Persona-weight DB persistence + RLS | New ad-hoc table | Mirror `creator_persona_weights` migration (`20260527…audience_overrides.sql`) | RLS policies + NUMERIC(5,4) + sum CHECK constraint are proven |
| Goal-intent bias values | Invent weight mixes | Seed from `WEIGHT_PRESETS` (audience-constants.ts) | `default/established/niche_heavy/new_creator` mixes already calibrated; map onto grow/sell/authority/nurture |
| Apify follower scrape | New scraper | `ApifyScrapingProvider.scrapeProfile`/`scrapeVideos` | SSRF allowlist, schema validation, error handling shipped |
| Follower-tier bucketing | Custom thresholds | `getFollowerTier` (`corpus/follower-tier.ts`) | Industry-standard cutoffs + null-graceful |
| Niche-instantiated persona prompt | New prompt assembler | `buildNicheAwareSystemPrompt` (`flash-prompts.ts`) | Already folds per-slot descriptions while keeping the skeleton byte-stable |
| Chip UI / active-state coral | New chip component | Extend `PlatformChip` pattern | Coral active treatment + `on`/`for` prefix + a11y already match THEME-06 |
| Weight-write validation | Custom checks | Zod `WeightsSchema` from `override/route.ts` | sum≈1.0 ±0.01 refine matches DB CHECK |

**Key insight:** This phase's risk is NOT building new engine math — it's *not breaking* the protected Max path. Almost every component is a reuse of Phase-4's "Live Audience Node" prior art (`analysis_override` + `creator_persona_weights` + override route + `audience/*` UI subsystem) generalized from a single-analysis override into a persisted, reusable Audience object.

## Runtime State Inventory

> This phase is primarily additive (new table + new columns + UI), with ONE rename/slim-down (creator profile → name only). Runtime-state audit covers the slim-down and the active-audience pin.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `creator_profiles` rows hold niche/voice/audience/wins/flops fields consumed by `ProfileRow` (read in 8 tool routes via `profile-role-map.ts`). Slimming to name-only orphans these reads. | **Code edit + data decision.** Keep columns (don't drop) — move them to per-audience calibration *inputs*. The slim-down is a *read-path* change: tools stop grounding on `creator_profiles` niche/audience and ground on the active Audience instead. No destructive migration needed in v1. |
| Live service config | Apify actor names (`clockworks/tiktok-profile-scraper`, `clockworks/tiktok-scraper`) are string constants in `apify-provider.ts`, not env-config. `APIFY_TOKEN` env var unchanged. | None — reuse as-is. |
| OS-registered state | None — web app, no OS scheduler/launchd state references the renamed concept. | None — verified by absence of any task-scheduler/pm2 reference in scrape or profile code. |
| Secrets/env vars | `APIFY_TOKEN`, `FLASH_MODEL`, `QWEN_*` — none reference "profile" or "audience" by name; no key rename. | None. |
| Build artifacts | None — no egg-info/compiled binaries; TS app. `src/types/database.types.ts` (Supabase-generated) MUST be regenerated after the `audiences` migration. | **Regenerate `database.types.ts`** after migration (existing convention — `analysis_override` etc. live there). |

**Creator profile slim-down blast radius (verified):** `ProfileRow` consumers are the 8 `/api/tools/*` routes + `grounding-line.ts` + `profile-role-map.ts` + `assembler.ts`. The slim-down is best framed as: **profile keeps name; niche/voice/audience become per-audience calibration inputs.** In P7, only `ideas-runner` actually swaps to audience-grounding (D-01 steer proof); the other runners keep reading `creator_profiles` until the post-P7 refinement run. So the blast radius this phase is confined to `ideas-runner.ts` + the calibration inputs UI. Do NOT drop `creator_profiles` columns in P7.

## Common Pitfalls

### Pitfall 1: Breaking same-video score-identity (regression gate)
**What goes wrong:** Calibration injects an `analysis_override` into the Max video aggregator, or General stops resolving to `DEFAULT_PERSONA_WEIGHT_CONFIG`, changing scores on previously-scored videos.
**Why it happens:** `aggregator.ts` L1110 resolves weights for the heatmap/retention curve. If P7 routes audience weights through this same path for General, the gate fails.
**How to avoid:** General audience injects NO override (returns DEFAULT by precedence). The Max video path stays on `{ niche }` context only. Audience weights only feed the **Flash text/react** path and per-audience video scoring is explicitly out of scope (calibration A/B opt-in, deferred). Keep `ENGINE_VERSION = "3.19.0"` unchanged.
**Warning signs:** `version.test.ts` expects `3.19.0`; any engine-suite red; a diff that touches `aggregator.ts` weight resolution for the default path.

### Pitfall 2: Cache-prefix invalidation from non-deterministic repaint
**What goes wrong:** Per-audience persona descriptions generated per-request (or with timestamps) bust the Flash system-prompt cache, inflating latency + cost.
**Why it happens:** `buildNicheAwareSystemPrompt` is byte-stable per `{niche × contentType}`. A repaint that varies per call breaks this.
**How to avoid:** Generate the repaint ONCE at calibration, store it in the audience row, and fold the stored text deterministically. Same audience → same prompt string.
**Warning signs:** Flash latency creeping up; `Date.now()`/`Math.random()` anywhere in the prompt-build path.

### Pitfall 3: Thin-scrape silently fabricating an audience (honesty spine)
**What goes wrong:** `scrapeProfile` returns a profile with `followerCount: 0`/null (clockworks does not always populate followers — see `follower-tier.ts` comment), and calibration invents personas anyway.
**Why it happens:** No explicit thin-data gate.
**How to avoid:** Define thin-data threshold explicitly (e.g. `getFollowerTier` returns null OR `scrapeVideos` returns < N videos). On thin/empty/fail → render the warning-toned "Couldn't read enough" notice (07-UI-SPEC copy) and fall back to General. Never write fabricated personas.
**Warning signs:** A calibrated audience with all-default weights and generic persona text but `type: 'personal'`.

### Pitfall 4: Apify scrape latency blocking the request
**What goes wrong:** `scrapeProfile` uses `waitSecs: 60`, `scrapeVideos` `waitSecs: 120` — a synchronous calibration call can take 1–3 minutes.
**Why it happens:** Apify actor runs are slow (cold actor boot + scrape).
**How to avoid:** Calibration must stream (SSE) with honest staged status ("Reading your followers…" → "Building your audience profile…") — the 07-UI-SPEC mandates this. Reuse the SSE route pattern from `/api/tools/ideas/route.ts`. Set `maxDuration` generously (remix route uses 300).
**Warning signs:** Calibration POST timing out at the platform's default function timeout.

### Pitfall 5: `audience_id` schema not multi-select-ready
**What goes wrong:** The runner call signature takes a single `audience_id` baked in such a way that `audience_ids[]` later requires a refactor.
**Why it happens:** Hard-coding singular throughout.
**How to avoid:** Per CONTEXT — keep the object `audience_id`→`audience_ids[]`-ready. Store a single active id on the thread now, but design the audience *resolution* function to accept an array (resolving the first in v1). The DB row is per-audience; the pin is singular; the resolver is array-shaped.
**Warning signs:** Multi-select compare would touch the runner signature.

## Code Examples

### Resolving the active audience's weights in the react path
```typescript
// Source: persona-weights.ts (VERIFIED). The audience's cached, goal-biased weights
// enter via the analysis_override slot (highest precedence). General → no override → DEFAULT.
function resolveAudienceWeights(audience: Audience | null) {
  if (!audience || audience.is_general) {
    return resolveWeights(DEFAULT_PERSONA_WEIGHT_CONFIG, {}); // gate-protected default
  }
  return resolveWeights(DEFAULT_PERSONA_WEIGHT_CONFIG, {
    analysis_override: audience.persona_weights, // PersonaWeights stored at calibration
  });
}
```

### Goal-intent → deterministic bias (seeded from WEIGHT_PRESETS)
```typescript
// Source: audience-constants.ts WEIGHT_PRESETS (VERIFIED). Structure now; values tuned later.
// grow → cold-share lean (more FYP/cross), sell → converter (niche-heavy), authority → skeptic
// (niche_deep_scout weight), nurture → loyalist lean. Cached on the audience row at calibration.
const GOAL_INTENT_BIAS: Record<'grow'|'sell'|'authority'|'nurture', PersonaWeights> = {
  grow:      WEIGHT_PRESETS.new_creator,  // fyp .75 — proxy for cold-share reach (TUNE in refinement)
  sell:      WEIGHT_PRESETS.niche_heavy,  // niche .55 — converter/buyer lean
  authority: WEIGHT_PRESETS.niche_heavy,  // niche-deep scout/skeptic lean
  nurture:   WEIGHT_PRESETS.established,  // loyalist .30 — retention lean
};
```
> `[ASSUMED]` — these specific mappings are Claude's-Discretion structure-not-values (D-05). The planner locks the table; values are tuned in the post-P7 refinement run. Flagged in Assumptions Log.

### Apify personal scrape with thin-data fallback
```typescript
// Source: apify-provider.ts (VERIFIED) — scrapeProfile/scrapeVideos shapes confirmed.
const provider = new ApifyScrapingProvider();
const profile = await provider.scrapeProfile(handle);      // ProfileData (followerCount may be 0/null)
const tier = getFollowerTier(profile.followerCount);       // null when count missing → thin signal
const videos = await provider.scrapeVideos(handle, 30);    // VideoData[] (engagement signals)
if (tier === null && videos.length < THIN_MIN_VIDEOS) {
  return { fallback: 'general', reason: 'thin' };           // honest notice, never fabricate
}
```

## Audience Persistence Schema (Claude's Discretion — proposed)

```sql
-- New table: audiences. Mirrors creator_persona_weights RLS + threads ON DELETE idiom.
CREATE TABLE IF NOT EXISTS public.audiences (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),  -- audience_id (multi-select ready)
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  type            text        NOT NULL CHECK (type IN ('personal','target')),
  platform        text        NOT NULL CHECK (platform IN ('tiktok','instagram','youtube','custom')),
  goal_label      text,                                              -- free-text display (D-05)
  goal_intent     text        CHECK (goal_intent IN ('grow','sell','authority','nurture')),
  is_general      boolean     NOT NULL DEFAULT false,                -- the locked default (one per user)
  is_preset       boolean     NOT NULL DEFAULT false,                -- the 2 templates (D-04)
  -- PersonaWeights (goal-bias already baked in at calibration) — NUMERIC like creator_persona_weights
  fyp             NUMERIC(5,4) NOT NULL DEFAULT 0.65,
  niche           NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  loyalist        NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  cross_niche     NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  -- 10 calibrated personas (repaint text + temp/disposition labels) + Audience Profile
  personas        jsonb       NOT NULL DEFAULT '[]',                 -- [{archetype, repaint, temperature, disposition, share}]
  profile         jsonb,                                             -- {temperature_mix, top_dispositions, follower_tier, ...}
  calibration     jsonb,                                             -- {source:'scrape'|'description', handle?, scraped_at, thin?:bool}
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
-- Same sum CHECK as creator_persona_weights (±0.01 epsilon).
-- RLS: select/all WHERE user_id = auth.uid() (verbatim from creator_persona_weights).
-- threads gets: active_audience_id uuid NULL REFERENCES audiences(id) ON DELETE SET NULL.
```
- **Multi-select readiness:** `id` is the audience PK; the thread stores a single `active_audience_id` now; the resolver accepts an array later → `audience_ids[]` is purely additive.
- **General + presets seeding:** seed General (`is_general=true`, DEFAULT weights) + 2 templates (`is_preset=true`, growth/conversion biases) per user on first load (or as global rows). Planner decides per-user vs global seed.
- **`[VERIFIED: codebase]`** — column types, RLS shape, and CHECK constraint all mirror `20260527000000_audience_overrides.sql`.

## Temperature × Disposition Label Lens (Claude's Discretion — proposed mapping)

> **Presentation lens only (D-02).** The engine keeps `fyp/niche_deep/loyalist/cross_niche` (Temperature) + the 10 archetype slugs. This table is the creator-facing relabel, reusing the existing labels in `audience-archetype.ts` (`'the skeptic'`, `'the connector'`, etc.).

| Archetype (engine) | SlotType → Temperature | Disposition (label) | Source label (verified) |
|--------------------|------------------------|---------------------|--------------------------|
| tough_crowd | fyp → **cold** | skeptic | `'the skeptic'` |
| lurker | fyp → **cold** | lurker | `'the silent watcher'` |
| high_engager | fyp → **warm** | connector | `'the active fan'` |
| saver | fyp → **warm** | collector | `'the utility-hunter'` |
| sharer | fyp → **warm** | connector | `'the connector'` |
| purposeful_viewer | fyp → **warm** | scanner | `'the purposeful scroller'` |
| niche_deep_buyer | niche_deep → **hot** | converter | `'your core buyer'` |
| niche_deep_scout | niche_deep → **hot** | skeptic | `'the expert'` |
| loyalist | loyalist → **hot** | connector | `'the loyalist'` |
| cross_niche_curiosity | cross_niche → **cold** | scanner | `'the curious newcomer'` |

> `[ASSUMED]` — Temperature mapping (cold/warm/hot ← SlotType) is structurally grounded in the existing `SlotType` semantics, but the cold/warm/hot assignment per slot and the disposition labels are a presentation choice the planner locks. Flagged in Assumptions Log. The temperature *palette* (cold=info/blue, warm=neutral, hot=success/green) is already fixed in 07-UI-SPEC §Color.

## State of the Art

| Old Approach (this codebase) | Current Approach (P7) | Impact |
|--------------|------------------|--------|
| Per-analysis `analysis_override` (Phase-4 Live Audience Node, single video) | Persisted reusable `audiences` object | Generalizes the override from one-shot to a reusable substrate |
| Tools ground on `creator_profiles` (9-card) | `ideas-runner` grounds on active Audience (steer proof) | GROUND-03 becomes literally true for ideas |
| 10 universal archetypes (niche-instantiated only) | + per-audience repaint + goal-biased weights | "your audience" instead of generic archetypes |

**Deprecated/outdated:** Nothing removed. `creator_persona_weights` (single default) coexists; the `audiences` table supersedes it for the studio flow but the Phase-4 board override route stays.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `grow→new_creator, sell/authority→niche_heavy, nurture→established` weight mappings | Goal-Intent / Code Examples | Low — explicitly structure-not-values (D-05); planner locks, refinement run tunes. Wrong mapping = suboptimal bias, not a break. |
| A2 | Temperature (cold/warm/hot) ← SlotType assignment + disposition labels per archetype | Temp×Disposition lens | Low — presentation only; no engine behavior depends on it. Planner locks the display table. |
| A3 | Goal-intent should be a creator-picked dropdown (not LLM-classified) | Alternatives / Open Q1 | Medium — affects UX + determinism. Recommended dropdown is the lower-risk choice; LLM-classify-once is viable if cached. |
| A4 | Thin-data threshold = `getFollowerTier === null` AND `< N` scraped videos | Calibration / Pitfall 3 | Medium — too-loose = fabrication risk; too-strict = unnecessary General fallback. Planner sets N; honesty spine favors stricter. |
| A5 | General + 2 presets seeded per-user (vs global rows) | Persistence schema | Low — either works; per-user is simpler with RLS. |
| A6 | Active audience persists as a single `threads.active_audience_id` column | Per-thread pin pattern | Low — matches D-04 per-thread model + existing threads schema. |

## Open Questions (RESOLVED)

1. **Goal-intent: dropdown vs LLM-classified-once?**
   - What we know: Both must resolve to a CACHED, DETERMINISTIC `PersonaWeights` bias (D-05). `WEIGHT_PRESETS` supplies the values.
   - What's unclear: Whether creators reliably self-classify, or whether an LLM read of the free-text label is more accurate.
   - Recommendation: **Dropdown.** Zero LLM nondeterminism, zero extra cost/failure mode, trivially testable, and the free-text label still ships for display. If product wants free-text-only, classify ONCE at calibration and cache — never per-run.
   - **RESOLVED:** Dropdown. Implemented in 07-05 (goal-intent dropdown) backed by 07-01 `GOAL_INTENT_BIAS`. No per-run LLM classification.

2. **General + presets: per-user seeded rows vs global shared rows?**
   - What we know: General must be the locked default everywhere; it must reproduce today's scores.
   - What's unclear: Whether General/presets are physical rows per user or virtual constants.
   - Recommendation: General can be a *virtual* default (no row needed — absence of `active_audience_id` = General). The 2 templates can be virtual constants too (seeded into the picker, materialized into a row only if the creator customizes). This avoids a seed migration entirely and keeps the gate trivially true (General = no override).
   - **RESOLVED:** Virtual constants. Implemented in 07-02 (virtual General/preset constants; absence of `active_audience_id` = General). No seed migration — regression gate stays trivially true.

3. **Does the Max video path ever consume a calibrated audience in P7?**
   - What we know: CONTEXT says calibration A/B is opt-in until validated; react-wiring targets the SIM/Flash text path.
   - What's unclear: Whether the planner wires audience weights into the video aggregator behind an opt-in flag this phase.
   - Recommendation: **No** for P7. Keep the Max path on DEFAULT to preserve the gate. Audience video-scoring is a deferred, opt-in, separately-gated change.
   - **RESOLVED:** No. 07-06 BLOCKING gate asserts the Max video path receives no audience override and ENGINE_VERSION stays 3.19.0. Audience video-scoring deferred (opt-in, separately gated).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `apify-client` | Personal scrape calibration (D-06) | ✓ | 2.22.1 | Target/description path (no scrape) |
| `APIFY_TOKEN` env | Apify actor calls | ✓ (used in prod scrape) | — | Thin-data → General fallback |
| Supabase (server client) | Audience persistence + RLS | ✓ | shipped | — |
| Qwen/DashScope | Flash react path + repaint generation | ✓ | shipped | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Apify scrape — D-06's graceful General fallback IS the designed fallback for thin/empty/failed scrapes.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (shipped — `*.test.ts` across `src/lib`) |
| Config file | project Vitest config (existing) |
| Quick run command | `pnpm exec vitest run src/lib/engine/__tests__/persona-weights.test.ts` |
| Full suite command | `pnpm test` (engine suite + route tests) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUD-03 | General reproduces DEFAULT mix; `ENGINE_VERSION` unchanged | unit | `pnpm exec vitest run src/lib/engine/__tests__/persona-weights.test.ts src/lib/engine/__tests__/version.test.ts` | ✅ (extend) |
| AUD-03 | Max same-video score-identity preserved | unit | engine suite green | ✅ existing engine tests |
| AUD-04 | Audience weights resolve via `analysis_override` precedence | unit | `resolveWeights` cases | ✅ (extend persona-weights.test.ts) |
| AUD-06 | goal-intent → deterministic bias (table lookup) | unit | new `goal-intent.test.ts` | ❌ Wave 0 |
| AUD-02 | thin-scrape → General fallback, never fabricate | unit | new `calibration.test.ts` (mock provider) | ❌ Wave 0 |
| AUD-01 | audience CRUD route RLS-scoped | integration | new `audiences/route.test.ts` (mirror tools route tests) | ❌ Wave 0 |
| AUD-05 | ideas-runner grounds on audience (steer) | unit | extend `ideas/__tests__/route.test.ts` | ✅ (extend) |

### Sampling Rate
- **Per task commit:** `pnpm exec vitest run <touched test file>`
- **Per wave merge:** `pnpm test` (full engine + route suite)
- **Phase gate (BLOCKING):** full suite green + `ENGINE_VERSION === "3.19.0"` + General-reproduces-DEFAULT assertion + `pnpm exec tsc --noEmit` 0 errors. Mirrors the P6-05 blocking regression gate.

### Wave 0 Gaps
- [ ] `src/lib/audience/__tests__/goal-intent.test.ts` — deterministic bias table (AUD-06)
- [ ] `src/lib/audience/__tests__/calibration.test.ts` — thin-data fallback, never-fabricate (AUD-02)
- [ ] `src/lib/audience/__tests__/temperature-disposition.test.ts` — label lens covers all 10 archetypes
- [ ] `src/app/api/audiences/__tests__/route.test.ts` — CRUD + RLS (mirror `tools/ideas/__tests__/route.test.ts`)
- [ ] Extend `persona-weights.test.ts` — audience override + General-identity case
- [ ] Regression-gate test asserting `ENGINE_VERSION` unchanged + Max default path untouched

## Security Domain

> `security_enforcement: false` in `.planning/config.json`. Section included for the high-value boundaries this phase touches (external scrape + user input + RLS).

### Applicable controls (project conventions, not full ASVS)
| Concern | Control | Source pattern |
|---------|---------|----------------|
| V5 Input Validation | Zod on audience body + weights (sum≈1.0 refine); cap name/goal length; `sanitizeText` on free-text label | `override/route.ts` WeightsSchema + `creator-profile.ts` `sanitizeText` |
| V4 Access Control | RLS `user_id = auth.uid()` on `audiences`; auth gate before any DB read in routes | `creator_persona_weights` policies + `tools/ideas/route.ts` auth-first |
| SSRF | Resolved scrape URLs already SSRF-allowlisted in provider | `apify-provider.ts` `isAllowedMp4Host` (profile scrape returns no URLs to fetch) |
| Prompt injection | Free-text goal label + handle pass through `sanitizeText` (strips control/zero-width/delimiter sentinels) before any prompt use | `creator-profile.ts` `sanitizeText` |
| User_id trust | Always from session, never request body | `tools/ideas/route.ts` CR-01 pattern |

### Known threat patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Audience-weight tampering (out-of-range / sum≠1) | Tampering | Zod refine + DB CHECK (both ±0.01) |
| Cross-user audience access | Info disclosure | RLS owner-scoped select/all |
| Injected handle/goal text into Flash prompt | Tampering | `sanitizeText` + length caps; repaint stored, not echoed |
| Scrape of an arbitrary/competitor handle | Scope creep | D-06 scopes Personal to the creator's OWN account; Target is described-only |

## Sources

### Primary (HIGH confidence — codebase, read directly this session)
- `src/lib/engine/persona-weights.ts` — `resolveWeights`, precedence chain, `DEFAULT_PERSONA_WEIGHT_CONFIG`
- `src/lib/engine/wave3/persona-registry.ts` — 10 archetypes, byte-stable defs, `SlotType`, `selectPersonaSlots`
- `src/lib/engine/flash/flash-prompts.ts` — `buildNicheAwareSystemPrompt` (repaint mechanism), `STABLE_FLASH_SYSTEM_PROMPT`
- `src/lib/engine/flash/run-flash-text-mode.ts`, `flash-aggregate.ts` — react/SIM path
- `src/lib/tools/runners/ideas-runner.ts`, `src/lib/kc/grounding-line.ts`, `profile-role-map.ts` — steer seam
- `src/lib/tools/chain-handoff.ts` — per-thread chain-carry pattern (`SkillId`, `CHAIN_HANDOFFS`)
- `src/lib/scraping/apify-provider.ts`, `types.ts`, `corpus/follower-tier.ts` — D-06 scrape infra
- `src/components/board/audience/audience-constants.ts` (`WEIGHT_PRESETS`), `audience-types.ts` — goal-bias seeds + Phase-4 prior art
- `src/app/api/analyze/[id]/override/route.ts` — calibration write prior art
- `supabase/migrations/20260527000000_audience_overrides.sql`, `20260617000000_threads_messages.sql`, `20260618000000_threads_one_open_per_user.sql` — DB/RLS conventions
- `src/lib/engine/aggregator.ts` L1095-1122 — Max-path weight resolution (regression-gate target)
- `src/components/app/home/composer.tsx`, `platform-chip.tsx` — chip surface + `showPlatformChip` gating
- `src/lib/engine/__tests__/persona-weights.test.ts`, `wave3-persona-registry.test.ts` — regression-gate anchors
- `.planning/phases/07-…/07-CONTEXT.md`, `07-UI-SPEC.md`, `ROADMAP.md`, `STATE.md`, `REQUIREMENTS.md`, `PROJECT.md`

### Secondary (MEDIUM confidence)
- `.planning/config.json` — `security_enforcement: false`, `nyquist_validation` not explicitly disabled (treated enabled)

### Tertiary (LOW confidence)
- None — no external/web sources needed; the phase is fully codebase-internal.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; all reuse verified in `node_modules` + codebase.
- Architecture: HIGH — every seam read directly; prior art (Phase-4 Live Audience Node) is a near-exact template.
- Pitfalls: HIGH — regression-gate mechanics verified against `aggregator.ts` + version tests.
- Goal-intent values / Temp×Disposition labels: structure HIGH, values LOW (explicitly deferred per D-05 — Assumptions Log A1/A2).

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (stable — internal codebase, no fast-moving external deps)
