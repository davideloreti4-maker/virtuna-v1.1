---
phase: 03-general-population-honesty-layer
reviewed: 2026-06-27T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/app/api/audiences/route.ts
  - src/app/api/audiences/[id]/route.ts
  - src/lib/audience/audience-repo.ts
  - src/lib/audience/audience-types.ts
  - src/lib/audience/resolve-tier.ts
  - src/lib/audience/enrich-signature.ts
  - src/components/audience/audience-display.ts
  - src/components/audience/trust-badge.tsx
  - src/components/audience/audience-card.tsx
  - src/components/audience/audience-manager.tsx
  - src/components/audience/audience-form.tsx
  - src/components/thread/multi-audience-read-block.tsx
  - src/lib/tools/blocks.ts
  - src/lib/engine/flash/two-audience-read.ts
  - scripts/rebake-determinism.ts
  - supabase/migrations/20260627000000_audience_general.sql
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-27
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the Phase 03 honesty/general-population layer: the new `mode` axis, the
Validated/Directional trust tier, user-authored `success_criterion` + `custom_context`
grounding, the run-card trust badge, and the determinism change to `enrich-signature`.

The six high-risk areas called out in the brief held up under inspection:

- **Migration byte-stability (verified safe):** the dropped/re-gated
  `audiences_weights_sum_check` keeps the constraint name identical to
  `20260619000000_audiences.sql:46` and the OR-branch predicate is byte-identical
  (`< 0.01` epsilon, same `[0,1]` bounds), so backfilled `mode='socials'` rows pass
  unchanged. `mode` adds a `NOT NULL DEFAULT 'socials'` in the same `ADD COLUMN`.
- **XSS (verified safe):** `custom_context` notes / `success_criterion` are only ever
  rendered as React children (`audience-form` textarea `value`, escaped). No
  `dangerouslySetInnerHTML` touches any audience-derived string.
- **user_id (verified safe):** never read from input — Zod strips unknown keys, and
  `audienceToRow`/`createAudience`/`updateAudience` re-derive it from the session.
- **enrich-signature determinism (verified safe):** the diff is determinism-only
  (`enable_thinking:false`, `thinking_budget` removed, timeout/comment updates); no
  behavioral change beyond dropping the staging budget.
- **tier presentation-only (verified safe):** `resolve-audience-weights` references
  none of `tier`/`mode`/`success_criterion`/`custom_context` — no scoring path mutation.

Remaining concerns are an honesty-copy inconsistency, uncapped/unvalidated nested JSON
at the create/patch boundary, a defense-in-depth read-scoping gap, one dead branch, and
an inconsistent DELETE refusal. None rise to BLOCKER.

## Warnings

### WR-01: General templates show a confident "Calibrated" chip despite being ungrounded/Directional

**File:** `src/components/audience/audience-display.ts:68-76`
**Issue:** `getCalibrationStatus` returns `"calibrated"` for `mode==='general'` authored
templates (Analyst/Hiring): they are `is_general=false`, `is_preset=false`, have a
non-empty `personas` roster, and `signature=null`, so they fall through every guard to
the default `"calibrated"`. `audience-status-chip` maps `calibrated → "Calibrated"` with
the confident `default` variant. On the card this renders **alongside** the honest
`TrustBadge "Directional"` and `"Authored template — Directional"` subline — a direct
contradiction in a phase whose entire purpose is honesty about provenance. The templates
carry no scrape (`signature: null`, evidence-free personas by design) and must not read
as "Calibrated."
**Fix:** Branch general/ungrounded templates to a non-confident status before the
`"calibrated"` default, e.g.:
```ts
export function getCalibrationStatus(audience: Audience): CalibrationStatus {
  if (audience.is_general) return "baseline";
  if (audience.is_preset) return "template";
  if (audience.mode === "general" && !audience.signature) return "template"; // ungrounded by design
  const roster = getPersonaRoster(audience);
  if (!audience.signature && roster.length === 0) return "needs_calibration";
  if (audience.calibration?.thin) return "thin";
  return "calibrated";
}
```
(or add a dedicated `"directional"`/`"authored"` status label — the point is it must not
claim "Calibrated" with a confident variant).

### WR-02: Uncapped / unvalidated `personas`, `profile`, `calibration` at the create+patch boundary

**File:** `src/app/api/audiences/route.ts:69-71` and `src/app/api/audiences/[id]/route.ts:72-74`
**Issue:** While `custom_context` (`.max(50)`, note `.max(2000)`) and `success_criterion`
(`.max(2000)`) are correctly capped, the sibling fields are not:
```ts
personas: z.array(z.unknown()).optional(),   // no .max(), arbitrary element shape
profile: z.unknown().nullable().optional(),  // arbitrary unbounded JSON
calibration: z.unknown().nullable().optional(),
```
Two problems at this untrusted boundary: (1) **storage abuse / DoS** — a client can POST a
multi-MB `personas`/`profile`/`calibration` blob that is persisted verbatim; (2)
**self-targeted prompt injection** — `runTwoAudienceRead` reads `audience.personas[].repaint`
into the Flash steering map (`two-audience-read.ts:73-75`,
`Object.fromEntries(audience.personas.map((p) => [p.archetype, p.repaint]))`), which is folded
into the Flash prompt. Because `personas` elements are `z.unknown()`, a user can store an
arbitrary `repaint` string that later enters the model prompt. Blast radius is the user's own
runs (not cross-tenant), so this is WARNING, not BLOCKER — but it is an unguarded boundary in a
phase whose stated focus is "input validation + sanitization + caps."
**Fix:** Cap and shape these fields. Validate `personas` against the `CalibratedPersona`
shape (or at minimum cap length and `repaint` size) and bound `profile`/`calibration`:
```ts
personas: z.array(CalibratedPersonaSchema).max(20).optional(),
profile: AudienceProfileSchema.nullable().optional(),
calibration: CalibrationMetaSchema.nullable().optional(),
```

### WR-03: Read/update/delete scoping relies solely on RLS — docstring overclaims app-layer enforcement

**File:** `src/lib/audience/audience-repo.ts:425-429, 503-507, 531-534`
**Issue:** `getAudience`, `updateAudience`, and `deleteAudience` issue
`.eq("id", id)` with **no** `.eq("user_id", user.id)` filter — ownership is enforced only
by Postgres RLS. The route header comment claims "RLS enforced at DB layer; **also enforced
app-layer via audience-repo**" (`route.ts:11`), but the app layer only re-derives `user_id`
on *writes* (anti-mass-assignment); it does **not** scope *reads/mutations by id*. If RLS is
ever disabled, dropped, or the table is queried with a service-role client, every one of
these becomes an IDOR. The claim and the code disagree.
**Fix:** Add the explicit owner predicate as defense-in-depth, matching the documented
intent:
```ts
.eq("id", id)
.eq("user_id", user.id)   // app-layer ownership; RLS remains the primary boundary
```
(or correct the docstring to state RLS is the sole enforcement).

### WR-04: Tautological branch in the create flow — `else` is unreachable

**File:** `src/components/audience/audience-form.tsx:118-123`
**Issue:**
```ts
if (type === "personal" || type === "target") {
  setSavedAudience(data.audience);   // mount calibration
} else {
  router.push("/audience");          // DEAD: AudienceType is only "personal" | "target"
}
```
`AudienceType` is exactly `"personal" | "target"` (`audience-types.ts:45`), so the
condition is always true and the `else` is unreachable. Either the calibration step was
meant to be conditional (the comment "check if calibration is needed" implies it) and the
real predicate was lost, or the conditional is vestigial. As written it is dead code that
hides intent.
**Fix:** Drop the tautology to `setSavedAudience(data.audience)` unconditionally, or
restore the intended predicate (e.g. only `type === "personal"` mounts calibration).

### WR-05: DELETE refusal only covers General — presets/templates return a generic 500

**File:** `src/app/api/audiences/[id]/route.ts:168-182`
**Issue:** The route header states "General/preset sentinel DELETE is explicitly refused
(D-04)", but the guard only checks `id === GENERAL_AUDIENCE.id`. A DELETE of a preset
(`preset-growth`) or general-template (`template-analyst`) sentinel id falls through to
`deleteAudience`, which throws for *all* `SENTINEL_IDS` (`audience-repo.ts:526`), is caught,
and returns a generic `{ error: "delete_failed" }` **500** instead of the intended clean
**400 refusal**. Functionally the delete is still refused (no row exists), but the status
code and error contract contradict the documented behavior and would surface as a server
error to the client.
**Fix:** Refuse all sentinels at the route layer:
```ts
import { GENERAL_AUDIENCE, PRESET_AUDIENCES, GENERAL_TEMPLATES } from "@/lib/audience/audience-repo";
const VIRTUAL = new Set([GENERAL_AUDIENCE.id, ...PRESET_AUDIENCES.map(p=>p.id), ...GENERAL_TEMPLATES.map(t=>t.id)]);
if (VIRTUAL.has(id)) {
  return NextResponse.json({ error: "cannot_delete_virtual" }, { status: 400 });
}
```

## Info

### IN-01: Repo `WritableAudienceSchema` lacks the `.max(50)` custom_context cap the routes enforce

**File:** `src/lib/audience/audience-repo.ts:269-277`
**Issue:** The route schemas cap `custom_context` at `.max(50)`, but the repo-level
`WritableAudienceSchema` (the last validation gate before the DB) omits both the array cap
and any element-link cap. Today the routes are the only callers, so it is covered — but the
repo is the documented "also strip it on the application layer" boundary and should not be
weaker than its callers.
**Fix:** Mirror the `.max(50)` array cap and `persona_evidence_link` `.max(120)` in the repo
schema.

### IN-02: `success_criterion` is a future prompt-injection surface once a scorer is wired

**File:** `src/lib/audience/audience-types.ts:253-260`, `src/app/api/audiences/route.ts:55`
**Issue:** `sanitizeText` strips control chars only (correct for storage/XSS). The field is
documented to "flow into `DomainPack.scoring` for the P5/P6 General scorers." No live scorer
exists in P3 (D-02), so there is no exploit now — but when wired, this user free-text enters a
model prompt and must be treated as untrusted (delimiting / instruction-isolation), not
concatenated raw.
**Fix:** Track a hardening note on the P5/P6 scorer integration; no action required in P3.

### IN-03: Redundant `calibrated` state set immediately before navigation

**File:** `src/components/audience/audience-form.tsx:133-136`
**Issue:** `handleCalibrationDone` calls `setCalibrated(audience)` and then
`router.push(...)`. The state update only flips the `savedAudience && !calibrated` render
guard for one frame before navigation unmounts the component — a harmless redundant render.
**Fix:** Drop `setCalibrated` (or the guard) if the post-calibration view is never shown.

### IN-04: `as never` cast on the whole completion params disables typing on all params

**File:** `src/lib/audience/enrich-signature.ts:346-356`
**Issue:** The `enable_thinking:false` DashScope extension is added by casting the **entire**
params object `as never`, which suppresses type-checking on `model`, `messages`,
`response_format`, `temperature`, `seed`, and `max_tokens` too — a future typo in any of those
would not be caught. (Same pattern already exists on the omni `video_url` content at line 295.)
**Fix:** Narrow the cast to the extension only, e.g. spread a typed base and
`...( { enable_thinking: false } as Record<string, unknown> )`, or extend the client type.

---

_Reviewed: 2026-06-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
