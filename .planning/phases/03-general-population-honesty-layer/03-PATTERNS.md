# Phase 03: General Population + Honesty Layer - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 13 (3 new lib + 1 new migration + 2 new tests + 1 new script + 6 modified)
**Analogs found:** 13 / 13 (all in-repo — this is a build-on-substrate phase)

> Every mechanism P3 needs already has a working exemplar in `src/lib/audience/`, `src/components/audience/`, and `supabase/migrations/`. The genuinely new code is one migration, one ~12-line resolver, two authored constants, a badge variant + provenance render, and a live re-bake harness. Everything else is field-additive.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| NEW `src/lib/audience/resolve-tier.ts` | utility (pure predicate) | transform | `__tests__/signature-determinism.test.ts:105-110` (test-local predicate) + `packs/socials.ts:67-69` | exact (promote verbatim) |
| MOD `src/lib/audience/audience-types.ts` | model (domain SSOT) | transform | `Audience` / `SignatureProvenance` / `CalibratedPersona` shapes (same file) | exact |
| MOD `src/lib/audience/audience-repo.ts` | service (CRUD + virtual constants) | CRUD | `GENERAL_AUDIENCE`/`PRESET_AUDIENCES` + `rowToAudience`/`audienceToRow`/`WritableAudienceSchema` (same file) | exact |
| MOD `src/components/audience/audience-display.ts` | utility (presentation helpers) | transform | `getCalibrationStatus`/`groupAudiences` (same file) | exact |
| MOD `src/lib/audience/enrich-signature.ts` | service (bake synth call) | request-response (LLM) | `defaultSynthesize` options (same file, line 338-368) | exact (one-line edit) |
| NEW `supabase/migrations/<ts>_audience_general.sql` | migration | DDL | `20260619000000_audiences.sql` (CHECK) + `20260624000000_audience_signature.sql` (additive) + `20260601000000_add_mode_to_analysis_results.sql` (mode col) | exact (3 exemplars) |
| MOD `src/components/audience/audience-status-chip.tsx` (or NEW `trust-badge.tsx`) | component | request-response | `AudienceStatusChip` (same file, full) | exact |
| MOD `src/components/audience/audience-card.tsx` | component | request-response | `AudienceCard` render + chip mount (same file) | exact |
| MOD `src/components/audience/audience-form.tsx` | component (form) | request-response | `goalLabel` field + PATCH/POST submit (same file) | exact |
| MOD `src/components/audience/audience-manager.tsx` | component | CRUD/list | `groupAudiences` consumer + section rendering (same file) | exact |
| MOD `src/lib/tools/blocks.ts` (+ result block renderer) | model (zod block schema) | event-driven (render) | `BandBlockSchema` model-tag pattern + `RemixCardBlock.audienceName` (lines 34-43, 242-245) | role-match (Open Q A5) |
| NEW `src/lib/audience/__tests__/resolve-tier.test.ts` | test | transform | `signature-determinism.test.ts:112-126` (tier rule describe block) | exact |
| NEW `src/lib/audience/__tests__/audience-repo-mode.test.ts` | test | CRUD | `signature-determinism.test.ts` mock-first structure + repo round-trip | role-match |
| NEW `scripts/<re-bake-harness>.ts` | script | request-response (paid LLM) | `scripts/spike/trustworthy-sim-probe.ts` (torn down — restore from git `git show 13d6e1fc`) | role-match (restore) |

## Pattern Assignments

### NEW `src/lib/audience/resolve-tier.ts` (utility, transform) — D-06

**Analog A:** `src/lib/audience/__tests__/signature-determinism.test.ts:105-110` (the locked test-local predicate to promote verbatim)
**Analog B:** `src/lib/engine/packs/socials.ts:67-69` (the calibration baseline the socials branch reads)

**Predicate to promote (verbatim):**
```typescript
// signature-determinism.test.ts:105-110
type TrustTier = "Validated" | "Directional";
function resolveTier(calibration?: { baselineRef?: string }): TrustTier {
  return calibration?.baselineRef ? "Validated" : "Directional";
}
```

**Pack calibration shape it keys off (NOT `Audience.calibration`):**
```typescript
// packs/socials.ts:67-69
calibration: {
  baselineRef: "src/lib/engine/calibration-baseline.json",
  ...
}
```

**Production shape (from RESEARCH §Code Examples — split rule + audience resolver):**
```typescript
import type { Audience } from "./audience-types";
import { SOCIALS_PACK } from "@/lib/engine/packs/socials";
export type TrustTier = "Validated" | "Directional";
export function tierFromCalibration(calibration?: { baselineRef?: string }): TrustTier {
  return calibration?.baselineRef ? "Validated" : "Directional";
}
export function resolveTier(audience: Pick<Audience, "mode">): TrustTier {
  if (audience.mode === "socials") return tierFromCalibration(SOCIALS_PACK.calibration);
  return "Directional"; // no General pack in P3 (D-02) → Directional by rule, never Validated
}
```
**KEY:** Reads `SOCIALS_PACK.calibration` (the pack), NOT `Audience.calibration` (which is scrape provenance). No General pack object exists in P3 — resolver returns Directional for non-socials directly. Do NOT widen `DomainPack`.

---

### MOD `src/lib/audience/audience-types.ts` (model, transform) — D-04/D-03/D-07

**Analog:** the `Audience` interface (lines 184-236) + `SignatureProvenance` (151-158) + `CalibratedPersona` (63-76) in the same file.

**Existing additive-field idiom to mirror** (note how `creator_persona?`/`signature?` were added optional so existing literals stay valid):
```typescript
// audience-types.ts:219, 226 — additive optional guardrail
creator_persona?: CreatorPersona | null;
signature?: AudienceSignature | null;
```

**New fields to add to `Audience`** (from RESEARCH — `mode` is required-with-default-stable, the other two optional):
```typescript
mode: "socials" | "general";              // first-class axis (D-04) — NOT derived from is_general
success_criterion?: string | null;        // free-text "what good means" (D-03)
custom_context?: CustomContext[] | null;  // top-level column (D-07) — works when signature is null
```

**New `CustomContext` interface (D-07):**
```typescript
export interface CustomContext {
  source: "user";
  note: string;
  persona_evidence_link?: string; // optional archetype-slug linkage
}
```
**PITFALL (RESEARCH Pitfall 2):** `custom_context` must be top-level on `Audience`, NOT nested in `SignatureProvenance` — General/template audiences carry `signature: null` by design and would have nowhere to store it. "Provenance-level" = semantics, not physical nesting.

---

### MOD `src/lib/audience/audience-repo.ts` (service, CRUD) — D-04/D-07/D-08

**Analog:** `GENERAL_AUDIENCE` (36-53) + `PRESET_AUDIENCES` (64-99) + `SENTINEL_IDS`/`VIRTUAL_BY_ID` (102-111) + `AudienceRow`/`rowToAudience`/`audienceToRow` (155-235) + `WritableAudienceSchema` (135-150) — all same file.

**Virtual-constant pattern (D-08 analyst/hiring mirror this exactly):**
```typescript
// audience-repo.ts:101-111
const SENTINEL_IDS = new Set<string>([GENERAL_AUDIENCE.id, ...PRESET_AUDIENCES.map((p) => p.id)]);
const VIRTUAL_BY_ID = new Map<string, Audience>([
  [GENERAL_AUDIENCE.id, GENERAL_AUDIENCE],
  ...PRESET_AUDIENCES.map((p): [string, Audience] => [p.id, p]),
]);
// listAudiences:261  return [GENERAL_AUDIENCE, ...PRESET_AUDIENCES, ...userRows];
// getAudience:274    const virtual = VIRTUAL_BY_ID.get(id); if (virtual !== undefined) return virtual;
// deleteAudience:379 if (SENTINEL_IDS.has(id)) throw new Error(...);
```
P3 adds `GENERAL_TEMPLATES = [ANALYST_AUDIENCE, HIRING_AUDIENCE]` (`mode:'general'`, `signature:null`, sentinel ids, personas as ungrounded `CalibratedPersona[]`), extends `SENTINEL_IDS`/`VIRTUAL_BY_ID`/`listAudiences` prepend.

**CRITICAL collision trap (RESEARCH Pitfall 1):** `GENERAL_AUDIENCE.mode = 'socials'` and `PRESET_AUDIENCES[].mode = 'socials'` — they run the socials pack. ONLY the new analyst/hiring templates are `mode:'general'`. Add an asserting comment.

**Row-mapper additive idiom (copy for `mode`/`success_criterion`/`custom_context`):**
```typescript
// rowToAudience:187 (enum cast) + 198 (jsonb ?? null fallback)
goal_intent: row.goal_intent as Audience["goal_intent"],
calibration: (row.calibration as Audience["calibration"]) ?? null,
// audienceToRow:218 ("in" guard for nullable) + 220 (undefined guard for required)
if ("goal_label" in a) row.goal_label = a.goal_label ?? null;
if (a.is_general !== undefined) row.is_general = a.is_general;
```
Add: `if (a.mode !== undefined) row.mode = a.mode;`, `if ("success_criterion" in a) row.success_criterion = a.success_criterion ?? null;`, `if ("custom_context" in a) row.custom_context = a.custom_context ?? [];` + matching `AudienceRow` fields + `rowToAudience` reads.

**Zod seam (V5 input validation, Security Domain):**
```typescript
// WritableAudienceSchema:135-150 — extend with:
mode: z.enum(["socials", "general"]).optional(),
success_criterion: z.string().max(2000).nullable().optional(),
custom_context: z.array(z.object({
  source: z.literal("user"),
  note: z.string().max(2000),
  persona_evidence_link: z.string().optional(),
})).optional(),
```
Render as plain text (React escapes); never `dangerouslySetInnerHTML`. `user_id` stays session-derived (CR-01, line 212/353). Cast convention `(supabase as any).from("audiences")` stays until `database.types.ts` regen.

---

### MOD `src/components/audience/audience-display.ts` (utility, transform) — D-05/D-08

**Analog:** `getCalibrationStatus` (57-65), `groupAudiences` (109-124), `getPersonaRoster` (33-38) — same file.

**Ungrounded predicate to add (D-05) (from RESEARCH §Code Examples):**
```typescript
export function isPersonaGrounded(p: { evidence?: string }): boolean {
  return typeof p.evidence === "string" && p.evidence.trim().length > 0;
}
```
Mirrors the existing evidence-presence assertion in `signature-determinism.test.ts:88-90` (`p.evidence.trim().length > 0`).

**`groupAudiences` extension (A6 — add a `templates`/general bucket):**
```typescript
// groupAudiences:109-124 currently buckets baseline / templates(is_preset) / yours.
// Add a distinct general-templates bucket keyed off mode==='general' (or a virtual is_template flag)
// so analyst/hiring don't mix into the is_preset "templates" bucket.
```
**PITFALL 5:** template personas live in `audience.personas` (`CalibratedPersona[]`, no `evidence`) → `isPersonaGrounded` returns false → they render "no evidence — Directional / ungrounded-by-design", exactly D-08's intent. Keep `signature:null`.

---

### MOD `src/lib/audience/enrich-signature.ts` (service, LLM request-response) — D-01 (Wave-0)

**Analog:** `defaultSynthesize` options block (same file, lines 343-358).

**Exact edit (lines 354-355):**
```typescript
// CURRENT:
enable_thinking: true,        // DashScope extension — suppressed by `as never` cast below
thinking_budget: 2000,
// AFTER D-01:
enable_thinking: false,       // D-01: greedy temp:0 is the determinism lever; drop thinking-mode (Pitfall 3)
// (drop thinking_budget line)
```
`temperature: 0` (351) + `seed: QWEN_SEED` (352) stay. Verify by **live double-bake** (NOT `signature-determinism.test.ts` — that replays recorded outputs, zero-network, deterministic regardless). A/B synth quality vs socials control.

---

### NEW `supabase/migrations/<ts>_audience_general.sql` (migration, DDL) — D-04/D-03/D-07

**Analog A (mode-column backfill idiom):** `20260601000000_add_mode_to_analysis_results.sql:6-7`
```sql
ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'score' CHECK (mode IN ('score', 'remix'));
-- "DEFAULT backfills all historical rows in the same ADD COLUMN — no separate UPDATE"
```
**Analog B (additive `IF NOT EXISTS`, never-touch-weights discipline):** `20260624000000_audience_signature.sql:22-24`
```sql
ALTER TABLE public.audiences
  ADD COLUMN IF NOT EXISTS creator_persona jsonb,
  ADD COLUMN IF NOT EXISTS signature       jsonb;
```
**Analog C (the CHECK to gate — copy predicate VERBATIM):** `20260619000000_audiences.sql:45-53`
```sql
ALTER TABLE public.audiences
  ADD CONSTRAINT audiences_weights_sum_check
  CHECK (
    fyp >= 0 AND fyp <= 1 AND
    niche >= 0 AND niche <= 1 AND
    loyalist >= 0 AND loyalist <= 1 AND
    cross_niche >= 0 AND cross_niche <= 1 AND
    ABS((fyp + niche + loyalist + cross_niche) - 1.0) < 0.01
  );
```

**Migration to write (RESEARCH Pattern 2 — mode-gated CHECK via logical implication):**
```sql
ALTER TABLE public.audiences
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'socials'
    CHECK (mode IN ('socials','general'));
ALTER TABLE public.audiences
  ADD COLUMN IF NOT EXISTS success_criterion text,
  ADD COLUMN IF NOT EXISTS custom_context     jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.audiences DROP CONSTRAINT IF EXISTS audiences_weights_sum_check;
ALTER TABLE public.audiences
  ADD CONSTRAINT audiences_weights_sum_check
  CHECK (
    mode <> 'socials'
    OR ( <VERBATIM 4-weight predicate from 20260619000000:47-52> )
  );
```
**PITFALL 4:** copy the weight predicate verbatim (same `< 0.01` epsilon) so Socials rows pass identically → byte-stable. Keep the 4 weight cols NOT-NULL-with-defaults (do NOT drop NOT NULL). General-specific population/weights belong in a new jsonb col, never overloading the 4 socials slots. Do NOT touch `analysis_results` / `creator_persona_weights` / `ENGINE_VERSION`.

---

### MOD `src/components/audience/audience-status-chip.tsx` (component) — D-06

**Analog:** the full `AudienceStatusChip` (lines 1-41) — `Badge` from `@/components/ui/badge` + label/variant record maps.
```typescript
// audience-status-chip.tsx:31-40 — the exact shape a <TrustBadge> mirrors
export function AudienceStatusChip({ status, className }: AudienceStatusChipProps) {
  return <Badge variant={STATUS_VARIANTS[status]} size="sm" className={cn("shrink-0", className)}>
    {STATUS_LABELS[status]}
  </Badge>;
}
```
Add a Validated/Directional variant (new sibling `TrustBadge` or a chip variant). Use the existing flat-warm `@/components/ui/badge` variants — don't build a new primitive.

---

### MOD `src/components/audience/audience-card.tsx` (component) — D-05/D-06

**Analog:** `AudienceCard` header (lines 34-59) — already imports `AudienceStatusChip` (7) and computes `getCalibrationStatus(audience)` (48). Mount `<TrustBadge tier={resolveTier(audience)} />` beside the existing status chip; add inline evidence + ungrounded muted state reading `isPersonaGrounded` over `getPersonaRoster(audience)`.

---

### MOD `src/components/audience/audience-form.tsx` (component, form) — D-03/D-07

**Analog:** the `goalLabel` controlled field + submit payload (lines 47, 72, 68-89).
```typescript
// audience-form.tsx:47 state + 72 payload — mirror for success_criterion + custom_context
const [goalLabel, setGoalLabel] = useState(existing?.goal_label ?? "");
// payload: goal_label: goalLabel.trim() || null,
// PATCH/POST to /api/audiences/[id] | /api/audiences (lines 78-88)
```
Add `successCriterion` textarea + a `custom_context[]` add/edit affordance, flow into the same PATCH/POST payload. Render custom-context distinctly from scraped grounding ("user-added grounding").

---

### MOD `src/components/audience/audience-manager.tsx` (component, list) — POP-03

**Analog:** consumes `groupAudiences` (imported line 16) + `listAudiences` (11) + renders sectioned cards via `SectionLabel` (39-45) + `AudienceCard` (15). Surface the new general-templates bucket in the existing manager (Mode-sectioning proper is P7).

---

### MOD `src/lib/tools/blocks.ts` + result block renderer (model/component) — TRUST-01 "each run" (Open Q A5)

**Analog A (on-block provenance-tag idiom):** `BandBlockSchema` (lines 34-43) — `model: z.enum(["sim1-flash","sim1-max"])` rides ON the block "so provenance survives scroll-away" (D-10). The tier badge mirrors this: an additive `tier`/`mode`/`audienceName` field on the block the run renders.

**Analog B (audience-ref already on a block):** `RemixCardBlock.audienceName` (lines 242-245) — `z.string().min(1).optional()`, "Populated only when a non-general audience is active." Precedent for threading the active audience onto a result block.

**A5 task:** grep the result-block schema (`MultiAudienceReadBlock`, `AccountReadBlock`, etc.) for an existing `audienceId`/`mode` field; if absent, add one small additive presentation-only field so the renderer calls `resolveTier`. No new run path (D-02).

---

### NEW tests — `src/lib/audience/__tests__/`

**Analog:** `signature-determinism.test.ts` — mock-first (`replayDeps`, lines 31-35), `describe/it/expect`, runner quirk header (16-17). The tier `describe` block (112-126) is the literal truth table to port into `resolve-tier.test.ts`.

`resolve-tier.test.ts`: socials→Validated; general/undefined/`{}`/`{baselineRef:""}`→Directional never Validated (mirror lines 112-126).
`audience-repo-mode.test.ts`: `mode`/`success_criterion`/`custom_context` round-trip through `rowToAudience`/`audienceToRow`; `GENERAL_TEMPLATES` present in `listAudiences`; `deleteAudience` throws on their sentinel ids.

**Run command (REPO QUIRK):** `node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/<file>.test.ts` — never `npm test`/`npx vitest` (fake PASS(0)/FAIL(0)).

---

### NEW `scripts/<re-bake-harness>.ts` (script, paid LLM) — D-01 Wave-0

**Analog:** the torn-down `scripts/spike/trustworthy-sim-probe.ts` — restore from git history: `git show 13d6e1fc:scripts/spike/trustworthy-sim-probe.ts` (introduced) / removed in `362ef8df`. Minimal live double-bake: `enrichSignature` with real `defaultSynthesize` × the frozen `khaby.lame` fixture, assert `signatureEqual(a,b) === true` + A/B synth quality. Reuse frozen `socials-bundle.fixture.json` (Apify-free). Requires `DASHSCOPE_API_KEY`; manual, human-approved (~10 Qwen calls / <$0.50).

## Shared Patterns

### Additive-migration discipline
**Source:** `20260624000000_audience_signature.sql:13-20` + `20260601000000_add_mode_to_analysis_results.sql:5`
**Apply to:** the D-04 migration. `ADD COLUMN IF NOT EXISTS`, NOT-NULL-DEFAULT backfills in-place, never alter weight cols/`analysis_results`/`creator_persona_weights`, NULL/`[]` for General/presets so the regression gate stays free by construction.

### Virtual-constant plumbing (sentinel ids)
**Source:** `audience-repo.ts:101-111, 261, 274, 379`
**Apply to:** D-08 analyst/hiring templates. Prepend on read, short-circuit `getAudience`, throw on write/delete. Never hits the DB.

### Tier keys off the PACK, never the audience
**Source:** `signature-determinism.test.ts:104-110` + `packs/socials.ts:67-69`
**Apply to:** `resolve-tier.ts` + every badge mount. Read `DomainPack.calibration.baselineRef`, NOT `Audience.calibration` (scrape provenance).

### CR-01 session-derived user_id + Zod boundary
**Source:** `audience-repo.ts:212, 302-313, 353` + `WritableAudienceSchema:135-150`
**Apply to:** all new writable fields. `user_id` from session never input; validate `mode`/`success_criterion`/`custom_context` (length caps, enum); plain-text render (no `dangerouslySetInnerHTML`).

### On-block provenance tag (survives scroll-away)
**Source:** `blocks.ts:34-43, 242-245`
**Apply to:** the "each run" trust badge (TRUST-01). Additive field on the result block, presentation-only.

### Flat-warm Badge primitive
**Source:** `audience-status-chip.tsx:1-41`
**Apply to:** the Validated/Directional `<TrustBadge>`. Reuse `@/components/ui/badge` variants — no new primitive.

## No Analog Found

None. Every file maps to an in-repo exemplar. The only MEDIUM-confidence seam is the "each run" badge mount (Open Q A5) — the *pattern* exists (`BandBlock` model-tag, `RemixCardBlock.audienceName`) but the planner must grep the live result-block schema to confirm which block carries the active audience ref.

## Metadata

**Analog search scope:** `src/lib/audience/`, `src/components/audience/`, `src/lib/engine/packs/`, `src/lib/engine/domain-pack.ts`, `src/lib/tools/blocks.ts`, `supabase/migrations/`, git history (`scripts/spike/`)
**Files scanned:** 14 read in full/targeted + git log
**Pattern extraction date:** 2026-06-27
</content>
</invoke>
