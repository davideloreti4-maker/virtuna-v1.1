---
phase: 12-library-acts-state-ia
reviewed: 2026-06-20T18:30:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/components/sidebar/Sidebar.tsx
  - src/components/sidebar/__tests__/Sidebar.a11y.test.tsx
  - src/components/sidebar/__tests__/Sidebar.collapse.test.tsx
  - src/components/sidebar/__tests__/Sidebar.recent.test.tsx
  - src/app/(app)/library/page.tsx
  - src/app/(app)/saved/page.tsx
  - src/components/saved/saved-shelf.tsx
  - src/components/saved/saved-item-card.tsx
  - src/components/thread/multi-audience-read-block.tsx
  - src/app/api/tools/read/route.ts
  - src/app/api/tools/read/__tests__/route.test.ts
  - src/components/audience/audience-manager.tsx
  - src/components/audience/persona-edit-form.tsx
  - src/components/audience/audience-profile-view.tsx
  - src/components/audience/__tests__/persona-edit.test.tsx
  - src/lib/audience/audience-types.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
resolutions:
  - "CR-01 (Critical CSRF) — RESOLVED in commit 6a695078: csrfGuard added to PATCH/DELETE /api/audiences/[id]."
  - "WR-01 (persona_weights editable via raw API) — ACCEPTED/by-design: the schema field backs P10's legitimate recalibration write (audience-repo.ts:215); General is a virtual row (no DB record) so the regression gate holds. Not a Phase 12 regression."
---

# Phase 12: Code Review Report

**Reviewed:** 2026-06-20T18:30:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found (CR-01 fixed post-review in 6a695078; WR-01 accepted by-design; WR-02/03/04 + Info deferred)

## Summary

Phase 12 (Library & Acts/State IA) is a well-executed, mostly-additive phase. The four
focus-area risks were scrutinized directly and three of them are clean by construction:

- **Explicit-pair Read authz (`/api/tools/read`):** SOUND. Both `audienceIds` are resolved
  through `getAudience(supabase, id)` under the session; real ids hit `.eq("id", id).single()`
  gated by the `audiences_all_own` RLS policy (`FOR ALL … USING auth.uid()=user_id`), and a
  bad/foreign id returns `400 audience_not_found` with no silent General fallback and no
  `runTwoAudienceRead` call (verified by the route test). Virtual sentinels short-circuit
  before any DB read. No injection surface (parameterized Supabase query, no raw SQL).
- **Persona-edit write target:** SOUND. The form sends the full `personas[]` via `...p` spread
  so `archetype`/`share` stay byte-stable; the repo's `audienceToRow` only writes weight
  columns `if (a.persona_weights !== undefined)`, so omitting weights preserves the engine-read
  fields. General/preset are *structurally* unwritable (no DB row → `UPDATE .eq("id","general")`
  matches zero rows) AND UI-guarded twice (affordance hidden + form returns null). The new
  `label` field is presentation-only and outside the gate surface.
- **`saved-item-card` "Use in thread":** SOUND. `snapshot` is non-nullable (`z.record` in the
  shelf repo), `anchorFromSnapshot` defends with fallbacks, the `read` fallback only routes to
  `/home` (no fabricated endpoint), and `router.push` navigates same-app (no `window.location`,
  no open-redirect surface).
- **Sidebar relabel a11y / coral discipline:** SOUND. Only `New Thread` carries `accent`
  (line 315); Library/Settings/Audience render matte `white/[0.06]` active states. `aria-current`,
  `aria-label`, and collapsed-rail tooltips are all present. The a11y test passes axe with zero
  violations.

The one real defect is a **CSRF gap on the persona-edit write route** — `PATCH /api/audiences/[id]`
is the state-mutating endpoint this phase newly drives from the browser, yet it lacks the
`csrfGuard` that every other mutating route in the codebase applies. The remaining items are
robustness/quality warnings. All 32 in-scope tests pass; `tsc --noEmit` is clean in scope.

## Critical Issues

### CR-01: Persona-edit write route `PATCH /api/audiences/[id]` is missing the CSRF guard

**File:** `src/app/api/audiences/[id]/route.ts:89-122` (PATCH); driven by `src/components/audience/persona-edit-form.tsx:116-120`

**Issue:** AUD-EDIT-01 (this phase) makes the browser write audience state through
`PATCH /api/audiences/[id]` (persona override). Auth on this route is cookie-based
(`supabase.auth.getUser()`), so a cross-origin form/fetch POST from a malicious page carries the
victim's session cookie and passes the auth gate. The route then mutates persisted state
(`personas`, and — via the same Zod schema — `persona_weights`, `name`, `goal_intent`, etc.).

Every other state-mutating route in this codebase applies the shared `csrfGuard` immediately after
the auth gate (`tools/read`, `tools/chat`, `tools/hooks`, `tools/script`, `tools/explore`,
`tools/remix/run`, `discover`, `tracked-accounts`). `PATCH /api/audiences/[id]` (and its sibling
`DELETE`) do **not** — confirmed by `grep -rn "csrfGuard" src/app/api/audiences/` returning nothing.
The CSRF guard's own JSDoc names exactly this class of route as the target ("routes mutate state…
the CSRF exposure is real"). A cross-origin attacker could silently rewrite a victim's calibrated
audience personas (or, via raw body, their `persona_weights`), corrupting every future Read/test
run for that audience — a stored-data-integrity hit, not just a nuisance.

This is pre-existing (the route shipped in P7) but P12 is what turns it into a live browser write
path for persona editing, so it is in-scope to fix here.

**Fix:** Apply the shared guard right after the auth gate on PATCH (and DELETE), mirroring
`tools/read/route.ts:57-59`:

```ts
import { csrfGuard } from "@/lib/http/csrf-guard";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const guard = csrfGuard(req);   // ← add: 415 on bad Content-Type, 403 cross-origin
  if (guard) return guard;

  // …existing body parse + PatchAudienceSchema + updateAudience…
}
```

Add the same two lines to `DELETE`. The persona-edit form already sends
`Content-Type: application/json` and the delete fetch in `audience-manager.tsx` is same-origin, so
no client change is needed.

## Warnings

### WR-01: `PatchAudienceSchema` still accepts `persona_weights`, leaving the engine-read field editable via raw API

**File:** `src/app/api/audiences/[id]/route.ts:45-57`

**Issue:** D-06 explicitly **rejected** direct weight/distribution editing ("highest gate risk").
The `PersonaEditForm` correctly omits any weight field, but the PATCH route's Zod schema still
permits `persona_weights`, and `audienceToRow` will write the four weight columns when present.
A user (or the CR-01 CSRF vector) can therefore mutate the engine-read `persona_weights` on their
own calibrated audiences through a raw `PATCH` body, bypassing the product decision that this
phase's UI was built to honor. The General baseline stays protected (no DB row), so the regression
gate is safe — but the "no weight editing" invariant is enforced only in the form, not at the
boundary.

**Fix:** Either drop `persona_weights` from `PatchAudienceSchema` (recalibration writes weights
through its own dedicated path, not this generic PATCH), or gate it behind an explicit server-side
allow so persona-edit PATCHes cannot touch weights:

```ts
const PatchAudienceSchema = z.object({
  name: z.string().min(1).max(80).transform(sanitizeText).optional(),
  type: z.enum(["personal", "target"]).optional(),
  platform: z.enum(["tiktok", "instagram", "youtube", "custom"]).optional(),
  goal_label: z.string().max(120).transform(sanitizeText).nullable().optional(),
  goal_intent: z.enum(["grow", "sell", "authority", "nurture"]).nullable().optional(),
  // persona_weights REMOVED — recalibration owns the weight write path (D-06: no direct edit).
  personas: z.array(z.unknown()).optional(),
  profile: z.unknown().nullable().optional(),
  calibration: z.unknown().nullable().optional(),
}).partial();
```

If recalibration genuinely PATCHes through this same route, confirm that and downgrade; otherwise
the field is an unintended write surface for the engine-read weights.

### WR-02: `personas: z.array(z.unknown())` accepts arbitrary JSONB — no shape/`share`-sum validation at the write boundary

**File:** `src/app/api/audiences/[id]/route.ts:53` and `src/lib/audience/audience-repo.ts` (`WritableAudienceSchema.personas: z.array(z.unknown())`)

**Issue:** The persona override is persisted with zero structural validation — `z.unknown()` lets
any caller write malformed persona objects (missing `archetype`/`share`, `share` values that don't
sum to 1.0, extra keys, wrong types). The trusted form always sends well-formed personas, but the
boundary does not enforce it. A malformed write would later surface as a runtime error in
`audience-profile-view.tsx` (`p.archetype.replace(...)`, `Math.round(p.share*100)`) or skew the
engine's repaint map. This is an input-validation gap at a system boundary (CLAUDE.md: "Always
validate user input at system boundaries").

**Fix:** Validate the persona array shape on PATCH (archetype slug ∈ known set, `share` 0..1,
`temperature`/`disposition` enums, optional `label` string with a length cap), and ideally assert
`Σ share ≈ 1.0 (±0.01)` to match the weights invariant. A `CalibratedPersonaSchema` mirroring the
existing `WeightsSchema` refinement keeps the override honest regardless of caller.

### WR-03: Explicit-pair `audienceIds` with 1 (or >2) valid entries silently degrades to the default active-vs-General path

**File:** `src/app/api/tools/read/route.ts:91-93, 107`

**Issue:** `audienceIds` is filtered to strings, then only the exact `length === 2` case takes the
explicit-pair branch. Any other count (e.g. a client bug sends `["aud-a"]`, or `["a","b","c"]`, or
a 2-element array where one entry was a non-string and got filtered to length 1) silently falls
through to the **default** active-vs-General path and runs a *different* comparison than the caller
asked for — without any error. CR-01's stated discipline ("an explicitly-requested pick that fails
to resolve must surface, never hide behind General") is only enforced for the resolve step, not for
a malformed-arity `audienceIds`. The result is a confusing wrong-Read rather than a clear 400.

**Fix:** Treat a *present-but-not-exactly-2* `audienceIds` as a bad request rather than falling
through:

```ts
const rawIds = body.audienceIds;
if (rawIds !== undefined && rawIds !== null) {
  const ids = Array.isArray(rawIds) ? rawIds.filter((x): x is string => typeof x === "string") : [];
  if (ids.length !== 2) {
    return Response.json({ error: "audienceIds must be exactly 2 audience ids" }, { status: 400 });
  }
  // …explicit-pair resolve…
}
// else: default active-vs-General path
```

This keeps the default path reachable only when `audienceIds` is genuinely absent.

### WR-04: `await res.json() as { audience: Audience }` trusts the server shape — an unexpected `{}` propagates `undefined` into component state

**File:** `src/components/audience/persona-edit-form.tsx:127-129` (also `audience-manager.tsx:104-105` is guarded; this site is not)

**Issue:** On a 2xx response the form does `const data = (await res.json()) as { audience: Audience }`
then `onSaved(data.audience)`. The `as` cast asserts a shape the parser does not verify. If the
route ever returns 200 with a body lacking `audience` (or a transient proxy returns 200 + HTML/empty
body), `data.audience` is `undefined` and flows into `setAudience(undefined)` in
`AudienceProfileView`, which then dereferences `audience.personas` / `audience.platform` and crashes
the profile view. The current server contract always returns `{ audience }`, so this is latent, but
the cast hides it.

**Fix:** Validate before handing off:

```ts
const data = (await res.json()) as { audience?: Audience };
if (!data?.audience) { setStatus("error"); return; }
setStatus("success");
onSaved(data.audience);
```

(`audience-manager.tsx:104` already does the equivalent `if (data.block)` guard — apply the same
defensive read here for parity.)

## Info

### IN-01: `Sidebar` a11y/recent tests emit `act(...)` warnings from `SidebarAccountSelector`

**File:** `src/components/sidebar/__tests__/Sidebar.a11y.test.tsx:39` (render) — warning originates in `SidebarAccountSelector`

**Issue:** Running the sidebar suites logs "An update to SidebarAccountSelector inside a test was
not wrapped in act(...)" — an async state update (the stubbed `getUser()` promise resolving) lands
after the synchronous `render`. Tests pass, but the unwrapped-update warning is noise that can mask
a real future regression and indicates the async settle isn't awaited.

**Fix:** Wrap the render/assert in `await act(async () => { … })` or `await screen.findBy…` so the
post-mount state settle is flushed, or mock `SidebarAccountSelector` in these structural tests since
it isn't the unit under test.

### IN-02: Saved-card timestamp renders in the host machine locale (non-deterministic display)

**File:** `src/components/saved/saved-item-card.tsx:148-152`

**Issue:** `new Date(item.created_at).toLocaleDateString(undefined, …)` honors the *environment*
locale (e.g. `de-DE` → "20. Juni 2026"), already flagged as a cosmetic carry-over in the 12-02
SUMMARY. Not a correctness defect, but it makes the Library surface render differently per machine
and complicates snapshot/visual testing.

**Fix:** Pin a locale (`"en-US"`) for product-surface dates, or thread the user's locale explicitly,
so the Library card date is deterministic.

### IN-03: `Formats` filter chip always renders though no path produces a `format` saved item yet

**File:** `src/components/saved/saved-shelf.tsx:29`

**Issue:** The `FILTERS` array unconditionally includes `{ id: "format", label: "Formats" }`, but
`ITEM_TYPE_TO_SKILL` in `saved-item-card.tsx` has no `format` launch and no thread output currently
saves a `format` noun, so the chip filters to a permanently-empty list ("Nothing of this type yet").
Flagged in the 12-02 SUMMARY as a known follow-up; it reads as a dead/aspirational control to users.

**Fix:** Either render the `Formats` chip conditionally (only when `data.items` contains a `format`),
or document it as a deliberate forward-looking slot. Low priority.

---

_Reviewed: 2026-06-20T18:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
