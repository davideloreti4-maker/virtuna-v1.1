---
id: p05-code-review-followups
created: 2026-06-29
source: 05-REVIEW.md (phase-05 code review)
severity: low-medium
area: api/tools routes + composer
status: pending
---

# Phase 05 code-review follow-ups (non-blocking)

CR-01 (critical video IDOR) and WR-02 (raw error-message disclosure) were FIXED at
phase-05 close-out (see 05-REVIEW.md `resolution`). The remaining advisory findings are
filed here:

## WR-01 — text cap trivially bypassed via file upload (medium)
`MAX_EVIDENCE_LENGTH` (8000) is enforced only on `kind:"text"` in
`src/app/api/tools/profile/route.ts`. The `file_text` (~1 MB) and `image` (~10 MB) kinds
feed much larger content to both LLM calls — the small text cap is bypassed by uploading
a `.txt`. Add a decoded-size cap on the file/image branches consistent with the text DoS
posture (the P4 carry-forward intent).

## WR-03 — Simulate 500 on resolvable-but-non-General audience (low)
`src/app/api/tools/simulate/route.ts` + `simulate-runner.ts:~158-161`: a resolvable
audience that isn't General makes the runner throw → 500. Should be a 400 validation
reject (e.g. check `audience.mode === "general"` in the route, or catch the specific
runner error and map to 400).

## WR-04 — composer video path silent no-op (low)
`src/components/app/home/composer.tsx:~722-743`: when `!userId` the video evidence path
returns with no user-facing error; can also orphan an uploaded storage object if the
route later rejects the derived key. Surface an inline error; consider cleanup on reject.

## Info (acknowledged, optional)
- `detectSubjectKind` regex over-matches `https://` / `Note:` / `TODO:` lines (person→panel
  mis-detect; default-safe).
- Profile poll burns its full ~3-min budget even when no Simulate is started (cosmetic;
  the no-store fix is unrelated). Consider arming the poll only after the CTA fires.
- `assertBlocksInRegistry` is dead code (acknowledged in 05-01).
- 23505 fallback in `createOpenThreadLazy` is inert until the partial unique index is
  applied; get-first makes correctness no longer depend on it, but applying the index
  (after deduping any existing open-thread duplicates) would restore the DB-level guard.

## Not in scope for
Phase 05 close-out (the blocker is fixed). Address in a hardening pass.
