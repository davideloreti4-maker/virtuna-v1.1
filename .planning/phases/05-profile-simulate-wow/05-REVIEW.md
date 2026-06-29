---
phase: 05-profile-simulate-wow
reviewed: 2026-06-28T22:29:57Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - src/app/api/tools/profile/route.ts
  - src/app/api/tools/simulate/route.ts
  - src/components/app/home/composer.tsx
  - src/components/thread/profile-read-block.tsx
  - src/components/thread/reaction-distribution-block.tsx
  - src/components/thread/message-blocks.tsx
  - src/lib/engine/behavioral-core.ts
  - src/lib/audience/profile-bake.ts
  - src/lib/tools/runners/profile-runner.ts
  - src/lib/tools/runners/simulate-runner.ts
  - src/lib/tools/profile-blocks.ts
  - src/lib/tools/blocks.ts
  - src/lib/tools/block-registry.ts
  - src/lib/tools/chain-handoff.ts
  - src/lib/threads/threads.ts
  - src/components/thread/__tests__/profile-read-block.test.ts
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
resolution: "CR-01 (video IDOR) FIXED — owner-segment guard added to /api/tools/profile (mirrors /api/videos/sign). WR-02 (raw err.message disclosure) FIXED in both routes. Remaining WR-01/WR-03/WR-04 + info filed as .planning/todos/pending/p05-code-review-followups.md."
status: resolved
---

# Phase 5: Code Review Report

**Reviewed:** 2026-06-28T22:29:57Z
**Depth:** deep
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the Profile→Simulate "wow" surface: the two untrusted-boundary routes
(`/api/tools/profile`, `/api/tools/simulate`), the fused runners, `profile-bake`,
the behavioral core, the get-first thread fix (15873d53), the composer evidence-drop
+ no-store poll (3a9abfe5 / 92feb6c6), the two new block schemas, and renderer wiring.

Overall the security spine is well-considered: auth-before-DB/LLM, CSRF guard, prompt
isolation (D-08, evidence-as-data with treat-as-data directives in the USER message and
byte-stable system prompts), bands-only `.strict()` schemas (no numeric-score leak), and
correct three-rail block registration (`blocks.ts` union + `block-registry.ts` + `message-blocks.tsx`
components, plus the `profile→simulate` chain handoff). The get-first change correctly mirrors
the reader and keeps the 23505 fallback ownership-scoped (CR-01).

The headline defect is an authorization gap on the person-video path: `/api/tools/profile`
signs and watches **any well-shaped `storagePath`** with the service client (which bypasses
RLS) and never checks that the path belongs to the caller — a check the codebase's own
`/api/videos/sign` route performs (`ownerId === user.id`). Secondary findings concern an
evidence-length cap that is trivially bypassed via the file/image kinds, verbose error
disclosure, and a wrong-status-code degrade in Simulate.

## Structural Findings (fallow)

No `<structural_findings>` block was supplied with this review; none to normalize.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Person-video `storagePath` is signed/watched without an ownership check (cross-tenant IDOR)

**File:** `src/app/api/tools/profile/route.ts:105-120` (with `src/lib/audience/profile-bake.ts:388-398, 450-460`)

**Issue:** For `kind: "video"`, the route validates only the *shape* of `storagePath`
via `sanitizeStoragePath` (which checks `<id>/<file>`, rejects `..`/absolute — but does
NOT check the owner segment). The path then flows to `runProfile` → `watchPersonVideo` →
`defaultCreateSignedUrl`, which signs the object with `createServiceClient()` — the service
role **bypasses RLS**. Nothing verifies that the `<id>` segment equals the authenticated
`user.id`. An authenticated user can therefore submit `storagePath: "<otherUserId>/<file>"`
and have the server sign and omni-watch another tenant's private video, returning a behavioral
read of it.

This codebase already establishes the correct pattern in `src/app/api/videos/sign/route.ts`:
```ts
const ownerId = path.split("/")[0];
if (ownerId !== user.id) {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}
```
The Profile route omits that guard. Mitigating factor: the file segment is a 21-char `nanoid`
(~121 bits), so blind path-guessing is impractical — but the authorization check is absent by
design, not merely hard to reach, and the service-client signing makes it a genuine
cross-tenant access path.

**Fix:** Enforce the owner segment against the session user BEFORE any signing, in the route
(it has `user.id` in scope):
```ts
case "video": {
  const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
  try {
    sanitizeStoragePath(storagePath);
  } catch {
    return Response.json({ error: "invalid storagePath" }, { status: 400 });
  }
  // Ownership guard — mirror /api/videos/sign (service client bypasses RLS).
  if (storagePath.split("/")[0] !== user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  ...
}
```
Optionally also pass `userId` into `watchPersonVideo`/`sanitizeStoragePath` so the guard is
enforced at the dereference leaf as defense-in-depth.

## Warnings

### WR-01: `MAX_EVIDENCE_LENGTH` (8000) is bypassed by the file_text / image kinds

**File:** `src/app/api/tools/profile/route.ts:34-35, 82-104`

**Issue:** The 8000-char evidence cap (documented as the AR-04-02 / DoS guard) is enforced
**only on `kind: "text"`**. The `file_text` path accepts up to `MAX_TEXT_BYTES = 1 MB`
(`ingest.ts:20`) and `image` up to `MAX_IMG_BYTES = 10 MB` (`vision.ts`), and the resulting
`stimulus.content` is fed to BOTH LLM calls (`runBehavioralRead` + `bakeProfileSignature`)
with no length cap. A user wanting to push ~1 MB of text through the dual-LLM pipeline simply
uploads a `.txt` instead of pasting — the small text cap is trivially defeated. This is a
cost/DoS-amplification gap at the untrusted boundary, and the cap is inconsistent across kinds.

**Fix:** Apply a single evidence-length cap after normalization, regardless of kind:
```ts
const stimulus = await normalizeStimulus(input);
if (stimulus.tier !== "max" && stimulus.content.length > MAX_EVIDENCE_LENGTH) {
  return Response.json(
    { error: `evidence must be at most ${MAX_EVIDENCE_LENGTH} characters` },
    { status: 400 },
  );
}
```
(or truncate before the runner). Keep the leaf byte-caps as the first gate.

### WR-02: Routes return raw `err.message` to the client (verbose error disclosure)

**File:** `src/app/api/tools/profile/route.ts:134-138` and `src/app/api/tools/simulate/route.ts:96-100`

**Issue:** Both catch-alls return `err instanceof Error ? err.message : "..."` in the 500 body.
Thrown messages here include Zod validation detail (`profile READ validation failed: <zod>`),
Supabase/DB messages (surfaced from `getOpenThread`/`createAudience`), and the
`createOpenThreadLazy` ownership-violation string that interpolates the user id. Echoing
internal error strings to the client is an information-disclosure smell and can aid an attacker
mapping the backend.

**Fix:** Log the real error server-side; return a stable generic message:
```ts
} catch (err) {
  log.error("profile_failed", { error: err instanceof Error ? err.message : String(err) });
  return Response.json({ error: "Profile failed" }, { status: 500 });
}
```

### WR-03: Simulate returns 500 for a resolvable-but-non-General audience instead of a 400

**File:** `src/app/api/tools/simulate/route.ts:78-92` with `src/lib/tools/runners/simulate-runner.ts:158-161`

**Issue:** The route validates that `audienceId` resolves under the session, but not that the
resolved row is a General/Directional baked SIM. If a user supplies an `audienceId` for one of
their own Validated (calibrated) audiences, `runSimulate` throws
`"simulate runs against General (Directional) audiences only"`, which the route's try/catch
converts into a 500 ("Simulate failed"). This is a validation failure (caller supplied an
unsupported-but-owned id) being reported as a server error — confusing to clients and noisy in
monitoring.

**Fix:** Resolve the tier in the route (or check `audience.mode === "general"`) and return a
400 before invoking the runner:
```ts
if (resolveTier(audience) !== "Directional") {
  return Response.json({ error: "audience_not_simulatable" }, { status: 400 });
}
```

### WR-04: Composer video-evidence path silently no-ops when the user id is missing

**File:** `src/components/app/home/composer.tsx:722-743`

**Issue:** In `handleProfileSubmit`, the `kind === 'video'` branch fetches the session user and,
when `!userId`, does `setProfiling(false); return;` with **no `setEvidenceError`**. The user
clicked submit and gets zero feedback (the staged chip stays, nothing happens). Separately, if
the route later rejects the path shape (e.g., a filename whose extension contains a non-`\w`
char produces a key that fails `STORAGE_KEY_RE`), the file has already been uploaded to storage
→ an orphaned object with a generic error.

**Fix:** Surface an error on the missing-session branch (`setEvidenceError(EVIDENCE_RUN_FAILED)`
or a "please sign in" copy), and sanitize/whitelist the derived `ext` before upload so a
rejected path never leaves an orphaned object.

## Info

### IN-01: `detectSubjectKind` speaker regex over-matches non-speaker lines

**File:** `src/lib/audience/profile-bake.ts:63-77`

**Issue:** The leading-label regex `^([A-Za-z][\w .'-]{0,30}?)\s*:` treats any line beginning
with a word followed by `:` as a distinct speaker. Lines like `https://example.com`,
`Note: ...`, `TODO: ...`, `Subject: ...` register as speakers and can push the distinct-speaker
count to ≥2, mis-detecting a `person` as a `panel`. The default is honest-safe (person), but a
mixed paste can flip it. Low impact because Simulate reads the persisted marker, not a re-infer.

**Fix:** Exclude common non-speaker prefixes (URL schemes, `note`/`todo`/`subject`/`re`/`from`/`to`)
and/or require the label to recur across multiple lines before counting it as a participant.

### IN-02: Profile reaction poll runs the full 3-minute budget even when no Simulate is initiated

**File:** `src/components/app/home/composer.tsx:785-800`

**Issue:** `awaitingReaction` is true whenever a `profile-read` exists without a
`reaction-distribution`. If the user views the read but never clicks "Simulate", the interval
still fires `reloadProfileThread` every 4 s up to 45 times (~3 min) of `no-store` GETs that can
never succeed. Bounded and self-clearing, so not a leak — but it is wasted polling.

**Fix:** Gate the poll on an explicit "simulate requested" signal (the card already tracks
`simulated`), or lower the try budget. Acceptable as-is for an advisory gate.

### IN-03: `assertBlocksInRegistry` has no production caller (dead code)

**File:** `src/lib/tools/block-registry.ts:82-93`

**Issue:** The header comment acknowledges the former caller (`dispatchToolOutput`) was cut in
S4; the export is retained "for re-use" with no current call site. Harmless but dead.

**Fix:** Remove, or add a lint-ignore/usage note; no action required for this phase.

### IN-04: `createOpenThreadLazy` 23505 fallback is inert if the partial unique index is absent

**File:** `src/lib/threads/threads.ts:60-100`

**Issue:** The get-first change is a correct improvement, but the doc itself notes the partial
unique index may be "absent or non-enforcing." In that state, two concurrent first-opens both
miss the select and both insert successfully (no 23505) → duplicate open-thread rows. Read
alignment is preserved (both reader and writer take the oldest), so behavior stays correct, but
duplicates can still accumulate. Pre-existing/acknowledged, not introduced by this change.

**Fix:** Ensure migration `20260618000000` (threads_open_user_unique_idx) is applied in all
environments; no code change needed.

---

_Reviewed: 2026-06-28T22:29:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
