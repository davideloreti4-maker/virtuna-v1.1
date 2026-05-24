# 11-04 SUMMARY: User-facing Retention UX

**Phase:** 11-existing-ui-integration-privacy-policy  
**Plan:** 04  
**Requirements:** INT-06, INT-05  
**Branch:** milestone/engine-foundation  
**Commit:** 8eec2a9

## Changes Made

### 1. video-upload.tsx — "About your data" disclosure
- Added `ChevronDown` to existing lucide-react import
- Added `dataDisclosureOpen` state variable (`React.useState(false)`)
- Added expandable disclosure below the empty-state dropzone (visible only when `!file`)
- Button shows "About your data ▾" with `ChevronDown` that rotates 180° on expand
- Expanded text: "Videos are automatically deleted after 30 days. To keep for re-analysis, go to Settings."
- `e.stopPropagation()` on button onClick prevents triggering the file picker
- Styled with `text-foreground-muted`, `hover:text-foreground`, `text-xs`

### 2. creator-profile schema
- Added `storage_retention_opted_in: z.boolean().nullable().optional()` to `creatorProfilePatchSchema`

### 3. use-creator-profile hook
- Added `storage_retention_opted_in?: boolean | null` to `CreatorProfileResponse` interface

### 4. creator-profile API route
- Added `"storage_retention_opted_in"` to `GET_COLUMNS` array

### 5. profile-settings-form.tsx — Retention toggle
- Added `storageRetentionOptedIn` state variable with sync from profile in useEffect
- Added to `handleSave` payload via `useUpdateCreatorProfile().mutateAsync()`
- Added "Keep my uploaded videos for re-analysis" toggle switch with aria-role="switch"
- Secondary text: "By default, uploaded videos are deleted after 30 days."
- Toggle disabled during `updateMutation.isPending` (loading state)
- Imported `cn` utility

### 6. Test file
- Created `src/components/app/__tests__/video-upload.test.tsx`
- 5 tests covering: disclosure renders in empty state, shows text on click,
  toggles off on second click, hidden when file selected, stopPropagation behavior

## Verification

- **LSP diagnostics:** Clean (no errors/warnings on all 6 changed files)
- **Tests:** All 5 new tests pass. 85/86 test files pass (1 pre-existing failure in
  `src/app/api/analyze/route.test.ts` — unrelated, analyze route not modified).

## Not Modified (per plan constraints)

- INT-07 (GDPR export) — deferred to M2
- Engine code or analyze route
- `storage_retention_opted_in` behavior in analyze route (Plan 02 owns that)
- Per-upload consent checkbox (D-04 chose one-time settings toggle)
