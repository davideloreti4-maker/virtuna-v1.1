# Phase 3: General Population + Honesty Layer - Research

**Researched:** 2026-06-27
**Domain:** Codebase-internal extension of an existing audience/signature substrate (Next.js 15 + TS + Supabase/Postgres). Additive Postgres migration with mode-gated CHECK; virtual-constant template panels; trust-tier resolver + badge; provenance surfacing; a one-line determinism close-out.
**Confidence:** HIGH (substrate fully read in-session; the one external idiom — mode-gated CHECK — verified against Postgres docs)

## Summary

This is a **build-on-substrate** phase, not a greenfield one. Every mechanism P3 needs already has a working exemplar in `src/lib/audience/` and `supabase/migrations/`. The job is to (a) close the P2 determinism leg with a one-line config change + a live re-bake, then (b) generalize `audiences` along a new explicit `mode` axis, add an editable success-criterion + first-class `custom_context`, ship two unbaked General template panels as virtual constants, and (c) productionize the spike-proven tier *rule* into a real `resolveTier` resolver + a Validated/Directional badge, plus surface persona provenance honestly. **No General scoring/run path** is built (D-02 — that is P5/SIMU-01); the General audience is *runnable-READY*, never run.

The single highest-risk area is **D-04 migration mechanics** — making the existing unconditional weight-sum CHECK conditional on `mode='socials'` while keeping Socials rows byte-stable. The repo already contains both halves of the answer: the `add_mode_to_analysis_results` migration (the `ADD COLUMN … NOT NULL DEFAULT … CHECK (… IN (…))` backfill idiom) and the `audience_signature` migration (the additive `ADD COLUMN IF NOT EXISTS` + "never touch weight cols/CHECK/analysis_results" discipline). The new wrinkle — gating a CHECK by a sibling column — is a standard SQL logical-implication idiom (`CHECK (mode <> 'socials' OR <predicate>)`), confirmed safe by Postgres docs.

Two non-obvious collisions surfaced that the planner must resolve up front: (1) the existing `GENERAL_AUDIENCE` constant is **mode `'socials'`**, NOT mode `'general'` — "the General default audience" and "General mode" are different axes (exactly the conflation D-04's rejected alternative warned about); and (2) `custom_context` (D-07) cannot live *only* inside `signature.provenance`, because the General audiences it targets carry **`signature: null`** by design (regression-gate-free). It must be a top-level audience column that is *conceptually* provenance-level.

**Primary recommendation:** Run D-01 as a Wave-0 live gate (it cannot be proven by the existing zero-network test). Then do D-04 as one additive migration: `ADD COLUMN mode` (default `'socials'`) + DROP/recreate the weight-sum CHECK as `mode <> 'socials' OR (<original predicate>)` + new top-level `success_criterion text` and `custom_context jsonb` columns. Keep the 4 weight cols NOT-NULL-with-defaults untouched. Promote the test-local `resolveTier` predicate verbatim into `src/lib/audience/resolve-tier.ts`. Author analyst/hiring as a new `GENERAL_TEMPLATES` virtual-constant array mirroring `PRESET_AUDIENCES`, `signature: null`, personas authored as ungrounded-by-design.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Wave-0 gate):** Drop thinking-mode on the synthesis bake + re-confirm. Set `enable_thinking:false` (drop `thinking_budget`) on the `qwen-3.7-plus` synthesis call in `enrich-signature.ts`, re-run the live double-bake, expect `signatureEqual:true`. Runs as a P3 Wave-0 prerequisite before any General-surface work. Guard: A/B the synth output against the socials control to confirm no synthesis-quality regression. Rejected: scope-to-frozen-artifact; both.
- **D-02 (phase boundary):** Object + library + honesty layer ONLY — **no General scoring/run path in P3**. The General Simulate path (`simulate(audience, stimulus)`) is P5 (SIMU-01). ROADMAP SC#3 "runs with zero setup" = **runnable-READY with zero setup**. Rejected: minimal-runnable-General-scorer-in-P3.
- **D-03 (success-criterion):** Free-text prose field, stored + editable; P5/P6 scorers consume it. A single editable string on the General audience. Socials keeps its implicit fixed virality fold (unchanged). **No live scorer wired in P3** — the field flows into the `DomainPack.scoring` input contract for later. Rejected: structured/selectable metric; free-text-now-plus-structured-later.
- **D-04 (POP-01 data-model):** Additive explicit `mode` column (`'socials' | 'general'`) + mode-gated constraints. Socials rows default `'socials'` and stay byte-stable (4-weight cols + sum-CHECK untouched). General rows carry `'general'`, socials enums (platform) + fixed 4-weight model **optional / pack-supplied**, weight-sum CHECK **gated to `mode='socials'`**. Continue the additive-migration idiom. Existing Socials audiences migrate by defaulting `mode='socials'`. Mode is **first-class**. Rejected: derive-Mode-from-`is_general`.
- **D-05 (provenance surfacing, TRUST-02):** Inline evidence + an explicit ungrounded state. Each grounded persona shows evidence quote(s) inline; an ungrounded persona renders in a distinct muted "no evidence — Directional" state. Honest at a glance. Fine visual detail → `/gsd-ui-phase`. Rejected: evidence-behind-expand/disclosure.
- **D-06 (trust badge, TRUST-01):** Validated/Directional badge on BOTH the audience (card + library) AND the run/result card. Build the real `resolveTier` resolver + badge component on top of the spike-locked rule (`DomainPack.calibration` populated → Validated; General / `undefined` / `{}` / `{baselineRef:""}` → Directional, never Validated).
- **D-07 (custom-context, D-defer-01):** First-class SIM-scoped `custom_context[]` field with full input + edit, surfaced as "user-added grounding." Provenance-level, SIM-scoped, with `source` + `note` + optional per-persona evidence linkage. Input + edit affordance on any General audience; render distinctly from scraped grounding. Strengthens provenance, never fakes it. Rejected: read-only-display-in-P3.
- **D-08 (POP-04 templates):** Two hand-authored virtual-constant panels: **analyst + hiring**. Mirror `PRESET_AUDIENCES` — authored synthetic persona panels, no bake / no scrape, `tier=Directional` by rule, runnable with zero setup. Provenance reads as authored/template grounding (visibly ungrounded-by-design where no evidence backs a persona, per D-05). Rejected: generate-personas-via-bake-at-first-use; ship-just-one.

### Claude's Discretion
- Exact migration mechanics for D-04 (column type/default, how the weight-sum CHECK is made conditional, whether General population/weights live in a new jsonb vs nullable cols). Lock: **additive + socials byte-stable + Mode first-class**.
- Exact shape/location of `resolveTier` (D-06) and the badge component; the storage shape of `custom_context[]` (D-07) beyond "provenance-level, SIM-scoped, `source`+`note`+optional persona linkage."
- The authored persona content for the analyst/hiring panels (D-08) — pick representative, defensible panels; structure mirrors `PRESET_AUDIENCES`.
- Whether the success-criterion (D-03) is a column or lives in the signature/profile jsonb — must be editable + flow into `DomainPack.scoring`'s input contract.
- Where the General library extends `audience-manager.tsx` (Mode-sectioning is P7; P3 surfaces General in the existing manager).
- Test-runner quirk: use `node ./node_modules/vitest/vitest.mjs run`.

### Deferred Ideas (OUT OF SCOPE)
- General Simulate verb (`simulate(audience, stimulus)`) → **P5 (SIMU-01/02)**.
- Profile verb (build a person/panel from uploaded evidence) → **P5 (PROF-\*)**. D-08's analyst/hiring are authored templates, NOT Profile output.
- Predict verb → **P6 (PRED-\*)**; the success-criterion feeds its scorer.
- Input adapter (text/file/image → `Stimulus`) → **P4 (IN-\*)**.
- Audience-as-front-door promotion (picker primary, Mode-sectioned library, Mode-scoped skills, generalized ambient reactor, empty-state chips) → **P7 (UX-\*)**. P3 adds the `mode` field + surfaces General in the existing manager.
- Structured success-criterion metrics → revisit post-P5/P6.
- Re-bake / drift determinism + self-calibration (Directional→Validated promotion) → **v2 (CAL-01)**.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POP-01 | `audiences` generalized into a domain-agnostic population (socials enums + fixed 4-weight model become optional/pack-supplied); existing Socials audiences migrate cleanly | D-04 migration: `ADD COLUMN mode` + mode-gated weight-sum CHECK + new jsonb/text cols; `rowToAudience`/`audienceToRow` + `WritableAudienceSchema` extended; Socials byte-stable by `DEFAULT 'socials'` + gated-CHECK socials-branch identical to today's predicate |
| POP-02 | A General audience carries its Mode, a success-criterion, and a trust tier | `Audience.mode` (D-04), `Audience.success_criterion` (D-03), `resolveTier(audience)` (D-06). Mode is first-class on the row + domain object |
| POP-03 | Save, name, browse, reuse General audiences in a General library | Existing CRUD in `audience-repo.ts` already supports save/name; `audience-manager.tsx` + `groupAudiences` surface them. `mode='general'` user rows persist via the existing create/update path |
| POP-04 | Built-in General default template panel(s) (analyst / hiring) run with zero setup | D-08: new `GENERAL_TEMPLATES` virtual-constant array mirroring `PRESET_AUDIENCES`; `signature:null`, no bake; tier Directional; prepended in `listAudiences`, write-path skips via SENTINEL_IDS |
| POP-05 | Author + edit a General audience's success-criterion | D-03 free-text field + input/edit affordance on `audience-form.tsx` (mirrors `goal_label` field); persisted via PATCH `/api/audiences/[id]` |
| TRUST-01 | Each audience AND each run carries a Validated vs Directional badge, surfaced in the UI | D-06: `resolveTier` resolver + `<TrustBadge>` component on `audience-card.tsx` + library + the run/result block renderer. Run badge derives from the active audience's mode→pack→calibration |
| TRUST-02 | Provenance surfaced — personas show evidence; ungrounded personas read as visibly ungrounded | D-05: read existing `SignaturePersona.evidence` inline; empty-evidence predicate → muted "no evidence — Directional" state. D-07 `custom_context` rendered distinctly as "user-added grounding" |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `mode` column + gated CHECK + new cols | Database (Postgres migration) | — | Schema invariants belong in the DB; the CHECK is the byte-stability guarantee |
| Row ↔ domain mapping for new fields | API/lib (`audience-repo.ts`) | — | `rowToAudience`/`audienceToRow` + Zod are the only seam between DB rows and the `Audience` object |
| `resolveTier` resolver | API/lib (`src/lib/audience/`) | — | Pure predicate keyed off pack calibration; no I/O; must be unit-testable + reused server+client |
| Trust badge + provenance/ungrounded UI | Client (React components) | — | Presentation-only; reads `Audience`/persona fields. Interactive surfaces are client components |
| Success-criterion + custom-context input/edit | Client (form) → API (PATCH) | DB (persist) | Editable affordance is a client form; persistence flows through the existing audiences route + RLS |
| Template panels (analyst/hiring) | API/lib (virtual constants) | Client (render) | Virtual constants live in `audience-repo.ts`, never touch the DB; rendered by the existing card/manager |
| D-01 determinism close-out | API/lib (`enrich-signature.ts`) | — | A synthesis call config; verified by a **live** bake (not the zero-network test) |

## Standard Stack

**No new external packages.** This phase extends existing in-repo modules only. Stack already present and load-bearing:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | (in `package.json`) | Validate new writable fields (`success_criterion`, `custom_context`) at the repo boundary | Already the validation layer in `audience-repo.ts` (`WritableAudienceSchema`) `[VERIFIED: codebase grep]` |
| `@supabase/supabase-js` | (in `package.json`) | The audiences table client + RLS | Existing CRUD substrate `[VERIFIED: codebase grep]` |
| `vitest` | (in `node_modules`) | Determinism gate + new unit tests | The kept regression gate runs on it `[VERIFIED: codebase grep]` |
| Tailwind v4 + flat-warm tokens | — | Badge + ungrounded-state styling | Project design system (`globals.css`) `[CITED: ./CLAUDE.md]` |

**Installation:** none. No `npm install`. (Database schema change ships as a new file under `supabase/migrations/`.)

## Package Legitimacy Audit

**N/A — this phase installs zero external packages.** All work extends existing in-repo TypeScript modules and adds one SQL migration. No registry lookups required.

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────────────────────┐
  WAVE 0 (gate)         │  enrich-signature.ts  defaultSynthesize()    │
  ─────────────         │   enable_thinking:false (drop thinking_budget)│
  live double-bake ────▶│   → re-bake khaby fixture ×2                  │
  (PAID, manual)        │   → signatureEqual(a,b) === true ?  GO/STOP   │
                        └─────────────────────────────────────────────┘
                                          │ GO
                                          ▼
  DATA MODEL (D-04/03/07)
  ┌──────────────────────────────────────────────────────────────────┐
  │ supabase/migrations/2026MMDD_audience_general.sql                  │
  │  ADD COLUMN mode text NOT NULL DEFAULT 'socials'                   │
  │            CHECK (mode IN ('socials','general'))                   │
  │  DROP audiences_weights_sum_check;                                 │
  │  ADD  audiences_weights_sum_check                                  │
  │       CHECK (mode <> 'socials' OR (<original 4-weight predicate>)) │
  │  ADD COLUMN success_criterion text                                 │
  │  ADD COLUMN custom_context  jsonb  DEFAULT '[]'                    │
  └──────────────────────────────────────────────────────────────────┘
                    │
                    ▼
  LIB SEAM (audience-repo.ts / audience-types.ts)
  ┌──────────────────────────────────────────────────────────────────┐
  │ Audience += mode, success_criterion?, custom_context?             │
  │ AudienceRow += same;  rowToAudience / audienceToRow map them      │
  │ WritableAudienceSchema += success_criterion, custom_context (zod) │
  │ GENERAL_AUDIENCE.mode='socials'  PRESET_AUDIENCES[].mode='socials' │ ◀── collision trap
  │ NEW: GENERAL_TEMPLATES = [analyst, hiring]  mode='general'         │
  │      signature:null, is_template:true, sentinel ids               │
  │ NEW: resolve-tier.ts → resolveTier(audience): 'Validated'|'Directional'
  └──────────────────────────────────────────────────────────────────┘
        │                                   │
        ▼                                   ▼
  UI (client components)            RUN / RESULT card (existing Read blocks)
  ┌────────────────────────┐       ┌────────────────────────────────────┐
  │ audience-card.tsx      │       │ result block renderer reads active  │
  │  + <TrustBadge>        │       │ audience → resolveTier → <TrustBadge>│
  │  + inline evidence     │       │ (TRUST-01 "each run")               │
  │  + ungrounded state    │       └────────────────────────────────────┘
  │ audience-form.tsx      │
  │  + success-criterion   │
  │  + custom-context I/O   │
  │ audience-manager.tsx   │
  │  + General section      │
  └────────────────────────┘
```

### Recommended Project Structure (where new/changed code lands)

```
supabase/migrations/
└── 2026MMDD000000_audience_general.sql   # NEW — D-04/03/07 additive migration
src/lib/audience/
├── audience-types.ts                     # EDIT — Audience += mode/success_criterion/custom_context; new CustomContext type
├── audience-repo.ts                      # EDIT — row mappers, Zod, GENERAL_TEMPLATES, mode on constants
├── resolve-tier.ts                       # NEW — production resolveTier (promotes test-local predicate)
├── enrich-signature.ts                   # EDIT — D-01 enable_thinking:false (one line)
└── __tests__/
    ├── signature-determinism.test.ts     # KEEP (free determinism gate) — already green
    └── resolve-tier.test.ts              # NEW — tier truth table
src/components/audience/
├── audience-card.tsx                     # EDIT — mount <TrustBadge>, inline evidence, ungrounded state
├── audience-status-chip.tsx             # EDIT or sibling — Validated/Directional variant (or NEW trust-badge.tsx)
├── audience-display.ts                   # EDIT — ungrounded predicate, template grouping helper
├── audience-form.tsx                     # EDIT — success-criterion + custom-context fields
└── audience-manager.tsx                  # EDIT — surface General audiences (Mode-sectioning is P7)
```

### Pattern 1: Additive migration with backfilling DEFAULT
**What:** Add a NOT-NULL column whose `DEFAULT` backfills every existing row in the same `ALTER`, plus a value-enum CHECK — no separate `UPDATE`.
**When to use:** D-04's `mode` column.
**Example (exact in-repo precedent):**
```sql
-- Source: supabase/migrations/20260601000000_add_mode_to_analysis_results.sql
ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'score' CHECK (mode IN ('score', 'remix'));
-- "DEFAULT 'score' backfills all historical rows in the same ADD COLUMN — no separate UPDATE needed."
```
`[VERIFIED: codebase]` — apply verbatim shape to `audiences` with `DEFAULT 'socials' CHECK (mode IN ('socials','general'))`.

### Pattern 2: Mode-gated CHECK via logical implication
**What:** Make an existing unconditional CHECK apply only to a subset of rows by rewriting it as `CHECK (<not-in-subset> OR <predicate>)` — SQL's encoding of "if subset then predicate."
**When to use:** D-04's weight-sum CHECK must hold for `mode='socials'` rows only.
**Example:**
```sql
-- The existing constraint is UNCONDITIONAL (20260619000000_audiences.sql:45-53).
-- It must be DROPPED and recreated gated. Socials rows pass identically → byte-stable.
ALTER TABLE public.audiences DROP CONSTRAINT IF EXISTS audiences_weights_sum_check;
ALTER TABLE public.audiences
  ADD CONSTRAINT audiences_weights_sum_check
  CHECK (
    mode <> 'socials'
    OR (
      fyp >= 0 AND fyp <= 1 AND
      niche >= 0 AND niche <= 1 AND
      loyalist >= 0 AND loyalist <= 1 AND
      cross_niche >= 0 AND cross_niche <= 1 AND
      ABS((fyp + niche + loyalist + cross_niche) - 1.0) < 0.01
    )
  );
```
**Safety:** at migration time every existing row is `mode='socials'` with valid weights, so the recreated constraint validates without violation; the scan passes immediately. Because the table is new/small and known-clean, a plain (validating) `ADD CONSTRAINT` is fine. If you prefer zero validation scan / future-proofing, add it `NOT VALID` then `VALIDATE CONSTRAINT` — Postgres confirms NOT VALID skips the table scan and validation later takes only a `SHARE UPDATE EXCLUSIVE` lock. `[VERIFIED: postgresql.org/docs ALTER TABLE]` `[CITED: squawkhq.com/docs/constraint-missing-not-valid]`

**Important:** keep the four weight columns **NOT NULL with their existing defaults** — do *not* drop NOT NULL (that would weaken/alter the weight cols). A `mode='general'` row simply inherits the harmless default mix `{0.65,0.20,0.10,0.05}` (which sums to 1.0, so it is valid under either branch). General-*specific* population/weights that are not the four socials slots belong in a **new jsonb column**, not by overloading the 4 weight cols (mirrors the `personas`/`profile`/`calibration`/`signature` jsonb idiom). `[VERIFIED: codebase]`

### Pattern 3: Virtual-constant panels (no DB row)
**What:** Sentinel-id constants prepended to the user list, short-circuited on read, skipped on every write path.
**When to use:** D-08 analyst/hiring templates.
**Example:**
```typescript
// Source: src/lib/audience/audience-repo.ts  (GENERAL_AUDIENCE / PRESET_AUDIENCES)
const SENTINEL_IDS = new Set<string>([GENERAL_AUDIENCE.id, ...PRESET_AUDIENCES.map(p => p.id)]);
// listAudiences: return [GENERAL_AUDIENCE, ...PRESET_AUDIENCES, ...userRows];
// getAudience:   VIRTUAL_BY_ID.get(id) short-circuits before any DB query.
// deleteAudience: throws on SENTINEL_IDS.
```
P3 adds `GENERAL_TEMPLATES = [ANALYST_AUDIENCE, HIRING_AUDIENCE]`, extends `SENTINEL_IDS`/`VIRTUAL_BY_ID`/`listAudiences` prepend, and groups them in `groupAudiences`. `[VERIFIED: codebase]`

### Pattern 4: Tier predicate keyed off the PACK, never the audience's `calibration` jsonb
**What:** `resolveTier` reads `DomainPack.calibration.baselineRef`, never `Audience.calibration` (which is scrape provenance).
**Example (the test-local predicate to promote verbatim):**
```typescript
// Source: src/lib/audience/__tests__/signature-determinism.test.ts:105-110
type TrustTier = "Validated" | "Directional";
function resolveTier(calibration?: { baselineRef?: string }): TrustTier {
  return calibration?.baselineRef ? "Validated" : "Directional";
}
```
Promote to `src/lib/audience/resolve-tier.ts`. In P3 the practical input is the audience's **mode** → pack: `mode==='socials'` → read `SOCIALS_PACK.calibration` (baselineRef present → **Validated**); else (`'general'` / templates / no pack) → **Directional**. There is **no General pack object in P3** (D-02), so the resolver returns Directional for non-socials without needing one. `[VERIFIED: codebase]`

### Anti-Patterns to Avoid
- **Setting `GENERAL_AUDIENCE.mode = 'general'`.** It is the *socials* zero-calibration default (platform tiktok, 4-weight, runs the socials pack) → **mode `'socials'`**. Conflating the constant's *name* with the *mode* axis is the exact muddiness D-04's rejected `derive-from-is_general` alternative warned about.
- **Storing `custom_context` only inside `signature.provenance`.** General audiences carry `signature: null` by design — they would have nowhere to store it. Use a top-level audience column (see Open Question / D-07 below).
- **Wiring a General scorer / threading `success_criterion` into `DomainPackScoring.run`.** D-02 forbids a General run path in P3. Store + surface the field; the scoring input-contract plumbing is P5/P6.
- **Trying to prove D-01 with `signature-determinism.test.ts`.** That test replays *recorded* LLM outputs (zero network) — it is deterministic by construction regardless of thinking-mode. D-01 can only be confirmed by a **live paid double-bake**.
- **Widening `DomainPack` (`id:"socials"` literal, `calibration: CalibrationSpec` required) to add a General pack.** Not needed in P3 and out of scope — the resolver handles non-socials directly.
- **Bumping `ENGINE_VERSION` or touching `aggregator.ts` / `analysis_results`.** Regression-gate and cache invariants (carry-forward from P1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Signature key-order / volatile-field normalization | A new equality routine | `signature-equality.ts` (`normalizeSignature`/`signatureEqual`/`stableStringify`) | Already the complete, test-locked rule (only `scraped_at` is volatile) |
| Tier resolution | A fresh classifier | Promote the test-local `resolveTier` predicate | Proven PASS in the spike; the rule is locked |
| Virtual constant plumbing | A new "templates" persistence path | The `SENTINEL_IDS` / `VIRTUAL_BY_ID` / prepend pattern | Templates must never hit the DB (zero-setup, gate-free) |
| Audience CRUD + RLS + user_id stripping | New routes | `createAudience`/`updateAudience` (session-derived `user_id`, CR-01) | Security + RLS already enforced |
| Persona roster / temperature display | New display helpers | `audience-display.ts` (`getPersonaRoster`, `getCalibrationStatus`, `getTemperatureMix`) | Already handles signature→personas→empty fallbacks |
| Badge chrome | New badge primitive | `@/components/ui/badge` (used by `audience-status-chip.tsx`) | Existing flat-warm badge variants |

**Key insight:** Nearly every "new" P3 capability is a *thin extension* of an existing, tested seam. The genuinely new code is one migration, one ~10-line resolver, two authored constants, and a badge variant + provenance render. Everything else is field-additive.

## Runtime State Inventory

> This phase **adds** schema/state rather than renaming it, but the migration + new fields touch persisted state. Inventory of what must move/initialize:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `audiences` table rows (existing Socials audiences). Adding `mode NOT NULL DEFAULT 'socials'` backfills them in-place. | Data migration is **automatic** via DEFAULT — no separate UPDATE. Verify with a post-migration row read that existing rows are `mode='socials'` + still satisfy the gated CHECK. |
| Stored data | New `success_criterion text` (nullable) + `custom_context jsonb DEFAULT '[]'` columns. | Existing rows get NULL / `[]` — no backfill needed; both are additive-nullable. |
| Live service config | None — no external service holds an audience string. | None — verified: audiences are DB-only; virtual constants are code. |
| OS-registered state | None. | None. |
| Secrets / env vars | `DASHSCOPE_API_KEY` (for D-01 live bake), `APIFY_TOKEN` (only if re-scraping; the spike re-baked from a frozen fixture). | None changed. D-01 re-bake should reuse the frozen `socials-bundle.fixture.json` path (Apify-free) per the spike's budget discipline. |
| Build artifacts | `database.types.ts` (Supabase generated types) — currently bypassed via `(supabase as any)` casts in `audience-repo.ts`. | Regenerate after the migration (or keep the `as any` cast convention the repo already uses). The repo comment notes types are added manually until regen — follow that. |

**Nothing found** in Live-service / OS-registered categories — verified by reading the substrate (audiences are DB rows + code constants only).

## Common Pitfalls

### Pitfall 1: The `GENERAL_AUDIENCE` ≠ `mode='general'` trap
**What goes wrong:** A planner/executor sets the existing `GENERAL_AUDIENCE` constant to `mode:'general'` because of its name, breaking the socials creator default (it would resolve Directional and lose its 4-weight socials pack path).
**Why it happens:** Two orthogonal axes share the word "General": the *constant* (the universal zero-calibration Socials default) vs the *mode* (socials/general domain).
**How to avoid:** `GENERAL_AUDIENCE.mode = 'socials'`; `PRESET_AUDIENCES[].mode = 'socials'`; only the **new** analyst/hiring templates are `mode='general'`. Add a code comment asserting this.
**Warning signs:** the existing General baseline card shows a "Directional" badge, or its persona weights stop resolving.

### Pitfall 2: `custom_context` has nowhere to live on unbaked General audiences
**What goes wrong:** Following the spike literally and putting `custom_context` on `SignatureProvenance` makes it impossible to attach to General/template/user-General audiences — they carry `signature: null` by design.
**Why it happens:** The spike's probe baked a *general-proto* signature; P3's real General audiences are not baked (D-08, regression-gate-free).
**How to avoid:** Store `custom_context` as a **top-level audience column** (`custom_context jsonb`), surfaced as `Audience.custom_context: CustomContext[]`. It is *conceptually* provenance-level (the "provenance-level, SIM-scoped" lock = semantics, not physical nesting). Optionally mirror into `signature.provenance.custom_context` for baked Socials audiences — but the top-level column is the source of truth so it works when `signature` is null.
**Warning signs:** custom-context input on a General audience silently drops on save.

### Pitfall 3: D-01 "passes" against the wrong gate
**What goes wrong:** Someone runs `signature-determinism.test.ts`, sees green, and declares D-01 closed — but that test never exercises the live LLM.
**Why it happens:** The test replays recorded outputs (zero network) → byte-deterministic by construction, thinking-mode or not.
**How to avoid:** D-01's confirmation is a **live double-bake** (`enrichSignature` with real `defaultSynthesize`, the same frozen `khaby.lame` fixture ×2) asserting `signatureEqual(a,b) === true`, plus an A/B of synth quality vs the socials control. The spike's probe (`scripts/spike/trustworthy-sim-probe.ts`) was torn down — P3 Wave-0 must re-create a minimal live re-bake harness (or restore it from git history) under `scripts/`.
**Warning signs:** no paid Qwen calls in the D-01 task's evidence.

### Pitfall 4: Dropping the weight-sum CHECK without recreating the socials branch identically
**What goes wrong:** The recreated gated CHECK uses a slightly different epsilon or predicate, so a previously-valid Socials row now fails validation, or the byte-stability guarantee is subtly broken.
**Why it happens:** Hand-retyping the predicate instead of copying it.
**How to avoid:** Copy the predicate **verbatim** from `20260619000000_audiences.sql:47-52` into the `mode <> 'socials' OR (...)` branch. Same `< 0.01` epsilon, same column bounds.
**Warning signs:** migration errors on `ADD CONSTRAINT` (existing-row violation) — means the socials branch diverged.

### Pitfall 5: Template personas need an evidence-bearing shape but templates carry no signature
**What goes wrong:** D-05 surfacing reads `signature.audience.personas[].evidence`, but D-08 templates have `signature:null` → no evidence to read.
**Why it happens:** `evidence` lives on `SignaturePersona` (inside the frozen signature), not on `CalibratedPersona` (the `audience.personas` field templates can populate).
**How to avoid:** Author template personas as `CalibratedPersona[]` in the `personas` field (so card preview / temp-bar work) with **no evidence** → D-05 renders them in the "no evidence — Directional / ungrounded-by-design" state, which is exactly what D-08 prescribes ("visibly ungrounded-by-design where no evidence backs a persona"). Surface an audience-level "authored template — Directional" provenance label. Keep `signature:null` so the gate stays free.
**Warning signs:** trying to author a fake `signature` on a template (breaks the regression-gate-free invariant).

## Code Examples

### Promoted tier resolver (D-06)
```typescript
// src/lib/audience/resolve-tier.ts  (NEW — promotes the spike's test-local predicate)
import type { Audience } from "./audience-types";
import { SOCIALS_PACK } from "@/lib/engine/packs/socials";

export type TrustTier = "Validated" | "Directional";

/** Core rule: a pack carrying a non-empty calibration baseline is Validated; else Directional. */
export function tierFromCalibration(calibration?: { baselineRef?: string }): TrustTier {
  return calibration?.baselineRef ? "Validated" : "Directional";
}

/** Audience-facing resolver: socials → socials pack calibration; general/templates → Directional by rule. */
export function resolveTier(audience: Pick<Audience, "mode">): TrustTier {
  if (audience.mode === "socials") return tierFromCalibration(SOCIALS_PACK.calibration);
  return "Directional"; // no General pack in P3 (D-02) → Directional by rule, never Validated
}
```

### Ungrounded predicate (D-05) — extend `audience-display.ts`
```typescript
// A persona is ungrounded iff it has no non-empty evidence quote (mirrors the spike's empty-evidence predicate).
export function isPersonaGrounded(p: { evidence?: string }): boolean {
  return typeof p.evidence === "string" && p.evidence.trim().length > 0;
}
```

### CustomContext type (D-07)
```typescript
// audience-types.ts — provenance-level, SIM-scoped (top-level column; works when signature is null)
export interface CustomContext {
  source: "user";
  note: string;
  /** Optional linkage to a persona this context grounds (archetype slug). */
  persona_evidence_link?: string;
}
// Audience += custom_context?: CustomContext[] | null;  success_criterion?: string | null;  mode: "socials" | "general";
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Thinking-mode synthesis (`enable_thinking:true, thinking_budget:2000`) on the bake | Greedy `temp:0` only (`enable_thinking:false`) | P3 D-01 | Closes the determinism leg (Pitfall-3 jitter source) + cuts cost & latency |
| Audience is socials-locked (4 weights mandatory) | Mode-axed; 4-weight model optional/pack-supplied for General | P3 D-04 | The substrate becomes domain-agnostic without touching Socials byte-stability |
| Tier asserted as a test-local predicate (spike) | Production `resolveTier` resolver + badge | P3 D-06 | The honesty layer becomes user-visible |

**Deprecated/outdated:** thinking-mode on the audience synthesis call (`enrich-signature.ts:354-355`) — removed by D-01.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Dropping thinking-mode yields `signatureEqual:true` on the live re-bake (the spike's recommended, but unconfirmed, fix) | D-01 / Pitfall 3 | If residual prose jitter remains, fall back to spike §Fallback option 3 (bounded prose tolerance) or option 2 (scope to frozen artifact). Wave-0 gate catches it before General work. |
| A2 | Dropping thinking-mode does not regress synthesis quality vs the socials control | D-01 | Worse personas/summary. Mitigated by the D-01 A/B guard (locked). |
| A3 | The `audiences` table currently contains only `mode='socials'`-equivalent rows (all carry valid summing weights), so the recreated gated CHECK validates without violation | D-04 / Pitfall 4 | If a pre-existing row has invalid weights, the validating `ADD CONSTRAINT` errors → use `NOT VALID` + fix-then-`VALIDATE`. Low risk: existing CHECK already enforced this. |
| A4 | `custom_context` belongs in a top-level column, not nested in `signature.provenance` (the lock's "provenance-level" = semantic) | D-07 / Pitfall 2 | If the planner reads "provenance-level" as physical nesting, custom-context breaks on unbaked General audiences. Recommend confirming with the founder if ambiguous. |
| A5 | The "each run" badge (TRUST-01) attaches to existing Read/result block renderers by resolving the active audience's tier at render (no new run path) | D-06 / TRUST-01 | If no result surface currently carries the active audience, a small plumbing task is needed to thread `mode`/tier onto the block. Verify the result-block schema during planning. |
| A6 | A new `is_template` virtual flag (vs reusing `is_preset`) cleanly separates general persona-templates from socials weight-presets in `groupAudiences` | D-08 | Reusing `is_preset` would mix them in the "Templates" bucket. Low risk; planner's call. |

**This table is non-empty:** A1/A2 are the Wave-0 gate's whole point; A4/A5 are the two integration decisions the planner should lock early.

## Open Questions (RESOLVED)

1. **Where does the "each run" Validated/Directional badge mount? (A5)**
   - What we know: TRUST-01 requires it on "each run"; P3 builds no new run path (D-02). The only live run path in P3 is the existing Socials Read.
   - What's unclear: which result/block renderer carries the active audience reference today (`blocks.ts` has `MultiAudienceReadBlock`, `AccountReadBlock`, etc.).
   - RESOLVED (03-07): added a TOP-LEVEL additive presentation-only `tier: z.enum(["Validated","Directional"]).optional()` on `MultiAudienceReadBlockSchema.props`; the renderer mounts `TrustBadge` from it, falling back to "Directional". Presentation-only, no new run path (D-02).

2. **`is_template` flag vs `is_preset` reuse for analyst/hiring (A6)**
   - What we know: `groupAudiences` buckets by `is_general`/`is_preset`; templates should be a visible, distinct group.
   - RESOLVED (03-04 / 03-05): the analyst/hiring templates are `mode==="general"` virtual constants (03-04, `GENERAL_TEMPLATES`); `groupAudiences` routes `mode==="general"` into a distinct `generalTemplates` bucket BEFORE the `is_preset` check (03-05) — no separate `is_template` flag needed, `mode` is the discriminator.

3. **Does `success_criterion` ever need to reach `DomainPackScoring` in P3?**
   - What we know: `DomainPackScoring` is `{ systemPrompt, run(pipelineResult, …) }` — no success-criterion input today. D-02 forbids wiring a General scorer.
   - RESOLVED (03-02 / 03-06, per D-02): **store + surface only** in P3 — no scorer wired. `success_criterion` rides on the `Audience` type (03-02) and is authored/edited + persisted via the form + routes (03-06); `DomainPackScoring` is untouched this phase. The P5/P6 General scorer adds it to its input contract later.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Postgres / Supabase (apply migration) | D-04/03/07 | ✓ (project DB) | — | — |
| DashScope (Qwen) API | D-01 live double-bake | ✓ if `DASHSCOPE_API_KEY` set | `qwen3.7-plus` | None — D-01 cannot be confirmed without a live call |
| Frozen `socials-bundle.fixture.json` (Apify-free re-bake) | D-01 | ✓ (referenced by spike) | — | Re-scrape via `APIFY_TOKEN` (more cost) |
| `vitest` | new unit tests + kept gate | ✓ | in `node_modules` | run via `node ./node_modules/vitest/vitest.mjs run` (the `npm test` quirk) |

**Missing dependencies with no fallback:** none — but D-01 requires a paid live Qwen run; budget ~10 Qwen calls / <$0.50 (spike actuals). Treat as a manual, human-approved Wave-0 task.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | (repo `vitest` config) — runner quirk: `npm test`/`npx vitest` print fake PASS(0)/FAIL(0) |
| Quick run command | `node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/<file>.test.ts` |
| Full suite command | `node ./node_modules/vitest/vitest.mjs run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | live double-bake yields `signatureEqual:true` + no quality regression | manual / live (NOT automatable cheaply) | re-bake harness under `scripts/` (paid) | ❌ Wave 0 (re-create probe) |
| POP-01 | Socials audience round-trips byte-stable post-migration (`mode='socials'`, weights + gated CHECK satisfied) | unit | `… resolve-tier.test.ts` + a repo-mapping test asserting `rowToAudience`/`audienceToRow` carry `mode` losslessly | ❌ Wave 0 |
| POP-01 | existing assembly/normalization determinism still green | unit | `… signature-determinism.test.ts` | ✅ (kept, free) |
| POP-02 | `resolveTier(audience)` truth table (socials→Validated, general→Directional, never Validated for undefined/`{}`/`{baselineRef:""}`) | unit | `… resolve-tier.test.ts` | ❌ Wave 0 |
| POP-03 | General user audience saves/lists/reuses | unit | repo test on create/list with `mode='general'` | ❌ Wave 0 |
| POP-04 | analyst + hiring constants present, prepended, `signature:null`, tier Directional, skipped on write | unit | repo test asserting `GENERAL_TEMPLATES` in `listAudiences` + `deleteAudience` throws on their ids | ❌ Wave 0 |
| POP-05 | success-criterion authored + edited persists | unit/integration | repo/route test on PATCH with `success_criterion` | ❌ Wave 0 |
| TRUST-01 | badge derives correct tier for each audience + run | unit (resolver) + component (render) | `resolve-tier.test.ts` + a card snapshot | ❌ Wave 0 |
| TRUST-02 | grounded persona shows evidence; empty-evidence persona reads ungrounded | unit (`isPersonaGrounded`) + component | display-helper test + card test | ❌ Wave 0 |
| TRUST-02 | `custom_context` persists + renders distinctly | unit | repo test on `custom_context` round-trip | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the touched module's test (`resolve-tier.test.ts` / repo test) via the quick command.
- **Per wave merge:** full audience-lib suite `node ./node_modules/vitest/vitest.mjs run src/lib/audience`.
- **Phase gate:** full suite green + the manual D-01 live re-bake evidence (`signatureEqual:true`) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `scripts/<re-bake-harness>.ts` — D-01 live double-bake (re-create the torn-down probe; reuse frozen fixture)
- [ ] `src/lib/audience/__tests__/resolve-tier.test.ts` — tier truth table (POP-02/TRUST-01)
- [ ] `src/lib/audience/__tests__/audience-repo-mode.test.ts` (or extend an existing repo test) — `mode`/`success_criterion`/`custom_context` round-trip + template constants + sentinel skip (POP-01/03/04/05/TRUST-02)
- [ ] Component test(s) for badge + ungrounded state (TRUST-01/02) — lands **in-phase** as `src/components/audience/__tests__/honesty-render.test.tsx` (03-05); UI-SPEC was `--skip-ui`'d so there is NO `/gsd-ui-phase` to defer to. (Authoritative: 03-VALIDATION.md.)
- Existing `signature-determinism.test.ts` already covers assembly/normalization determinism + 10-persona evidence presence — **free, keep green**.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Supabase session (unchanged) |
| V3 Session Management | no | unchanged |
| V4 Access Control | yes | Existing RLS (`audiences_all_own`, `audiences_select_own`) + `user_id` always session-derived (CR-01). New columns inherit row-level RLS — no new policy needed |
| V5 Input Validation | yes | Extend `WritableAudienceSchema` (zod) for `success_criterion` (max-length string) + `custom_context` (array of `{source:'user', note: maxlen, persona_evidence_link?}`). The `mode` value is constrained by the DB CHECK + a zod enum |
| V6 Cryptography | no | — |

### Known Threat Patterns for {Next.js + Supabase audience CRUD}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Mass-assignment of `user_id`/`mode` via request body | Elevation / Tampering | `audienceToRow` already strips `user_id` (session-derived); validate `mode` against a zod enum and never trust client `is_template`/sentinel ids (write path skips SENTINEL_IDS) |
| Stored XSS via free-text `success_criterion` / `custom_context.note` | Tampering | Render as plain text (React escapes by default); cap length in zod; never `dangerouslySetInnerHTML` |
| Writing to a virtual constant (template/General) | Tampering | Existing SENTINEL_IDS guard in `getAudience`/`deleteAudience`; ensure create/update also reject sentinel ids |

## Sources

### Primary (HIGH confidence)
- Codebase (read in-session): `audience-types.ts`, `audience-repo.ts`, `enrich-signature.ts`, `calibration.ts`, `signature-equality.ts`, `__tests__/signature-determinism.test.ts`, `domain-pack.ts`, `packs/socials.ts`, `audience-display.ts`, `audience-card.tsx`, `audience-manager.tsx`, `audience-status-chip.tsx`, `audience-form.tsx`, `qwen/client.ts` — the substrate to extend.
- Migrations: `20260619000000_audiences.sql`, `20260624000000_audience_signature.sql`, `20260601000000_add_mode_to_analysis_results.sql` — the additive + mode-column + conditional-CHECK exemplars.
- `.planning/phases/02-trustworthy-sim-spike/SPIKE-VERDICT.md`, `.planning/phases/03-…/03-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/NUMEN-GSI-VISION.md` — locked decisions + the tier rule.
- [PostgreSQL Docs — ALTER TABLE / Constraints (NOT VALID, VALIDATE CONSTRAINT, lock levels)](https://www.postgresql.org/docs/current/sql-altertable.html), [Constraints chapter](https://www.postgresql.org/docs/current/ddl-constraints.html)

### Secondary (MEDIUM confidence)
- [Squawk — constraint-missing-not-valid (migration-safety lint rule)](https://squawkhq.com/docs/constraint-missing-not-valid)
- [Bytebase — Enforce NOT VALID in CHECK](https://www.bytebase.com/blog/sql-review-rule-explained-enforce-not-valid-in-check/)

### Tertiary (LOW confidence)
- none — every load-bearing claim is verified against the codebase or Postgres docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all modules read in-session.
- Architecture / migration mechanics: HIGH — exact in-repo exemplars + Postgres docs confirm the gated-CHECK idiom.
- D-01 outcome (A1/A2): MEDIUM — the fix is the spike's recommendation but unconfirmed until the live re-bake runs (that is the Wave-0 gate's purpose).
- Pitfalls: HIGH — derived directly from substrate invariants (signature-null templates, mode/constant collision, replay-test blindness).

**Research date:** 2026-06-27
**Valid until:** ~2026-07-27 (stable, codebase-internal; re-verify only if `audiences` schema or the DomainPack contract changes).
