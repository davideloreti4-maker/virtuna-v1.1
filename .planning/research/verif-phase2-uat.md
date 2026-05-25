# VERIF-01 — Phase 2 Creator Profile UAT

**REQ:** VERIF-01 (Phase 18, milestone Engine Hardening)
**Target:** live Vercel deploy — https://virtuna-v11.vercel.app
**Date executed:** _to fill in_
**Executed by:** Davide Loreti

## Goal

Confirm the M1 Phase 2 creator-profile flow works end-to-end against the deployed app:
1. 9-card interview modal completes on first upload
2. All 9 fields persist to `creator_profiles` table
3. Reference-creator side effect fires after submission

## Preconditions

- [ ] Live deploy URL reachable: https://virtuna-v11.vercel.app
- [ ] Test account credentials available (or fresh signup ready — use a Google account not previously used on the app)
- [ ] Supabase dashboard access for `creator_profiles` row inspection (project: `qyxvxleheckijapurisj`)
- [ ] A short test video (any TikTok-shape mp4, ≤30s) ready for upload

## Steps

### A. First-upload interview modal

1. Sign in / sign up with a fresh account — one with no existing `creator_profiles` row. (If reusing an account, delete its `creator_profiles` row first via Supabase dashboard.)
2. Upload the test video via the main upload flow.
3. Expected: 9-card interview modal opens automatically. Record observed: ___
4. Step through all 9 cards, providing realistic answers (do not skip or submit blank).
5. Submit the modal. Expected: modal closes, upload analysis continues. Record observed: ___

### B. creator_profiles persistence

1. Open Supabase dashboard → Table Editor → `creator_profiles`.
2. Filter by the test account's `user_id` (visible in Auth → Users).
3. Expected: exactly one row exists for this user, with all 9 interview-collected columns populated (no nulls). Record column-by-column: ___
4. Snapshot the row contents (paste below for record):

```
[paste row here]
```

### C. Reference-creator side effect

1. After modal submission, check one of: (a) application logs / Vercel log drain, (b) Supabase dashboard for any side-effect row/function triggered, (c) app UI indicator (if exposed).
2. Expected: reference-creator side effect runs once, idempotently (no duplicate rows / events on repeat upload from same user).
3. Record observed: ___

## Result

Choose ONE:
- [ ] **PASS** — all three sections (A, B, C) green. VERIF-01 closed as MET.
- [ ] **FAIL** — at least one section red. Open follow-up ticket; do NOT close VERIF-01.
- [ ] **DEFERRED PERMANENTLY** — live-deploy blocker / feature gated / premise invalidated.

### Defer-permanently rationale (only if chosen above)

- **What was attempted:** ___
- **Blocker:** ___
- **Why it's acceptable to leave deferred:** ___
