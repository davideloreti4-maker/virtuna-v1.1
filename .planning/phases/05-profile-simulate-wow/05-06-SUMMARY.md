---
phase: 05-profile-simulate-wow
plan: 06
subsystem: composer
tags: [composer-affordance, evidence-drop, profile-inbox, one-thread-wow, additive-only, human-verify-pending]

# Dependency graph
requires:
  - phase: 05-profile-simulate-wow (plan 01)
    provides: profile-read + reaction-distribution renderers registered in BLOCK_COMPONENTS / MessageBlocks + the profile→simulate chain handoff
  - phase: 05-profile-simulate-wow (plan 04)
    provides: POST /api/tools/profile (the StimulusInput body contract — text | file_text/image base64 | video storagePath)
  - phase: 05-profile-simulate-wow (plan 05)
    provides: POST /api/tools/simulate (the reaction-distribution persisted to the SAME open thread — SIMU-03)
provides:
  - "the additive evidence-drop composer affordance (attach icon-button + drag overlay + removable chip + inline reject) wired to /api/tools/profile"
  - "in-thread rendering of profile-read + reaction-distribution blocks via MessageBlocks, gated on block presence (not activeTool)"
affects: [gsd-ui-phase, phase-05-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling additive flow on the composer: a staged evidence file routes onSubmitForm to /api/tools/profile while the creator (Socials) tool/submit handlers stay byte-identical (D-07 / vision §15.2)"
    - "Client file-kind classification (file_text/image/video) as convenience UX; the server route re-validates (T-05-18 — client is never the trust boundary)"
    - "file_text/image ride a base64 JSON body (matches the route's reconstructed-File contract); a short clip is staged to Supabase storage first then posted as a sanitized storagePath (mirrors the Test upload path)"
    - "Block rendering reuse: the returned profile-read + the card's own reaction-distribution are read back from the open thread and rendered via the shared MessageBlocks renderer (registered in 05-01), gated on block presence not a tool"
    - "Bounded self-clearing poll surfaces the reaction-distribution the profile-read card's Simulate CTA persists to the SAME thread (the card cannot call back into the composer)"

key-files:
  created:
    - .planning/phases/05-profile-simulate-wow/deferred-items.md
  modified:
    - src/components/app/home/composer.tsx
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Mounted the attach control directly in composer.tsx's control row ALONGSIDE <ComposerControls/> rather than inside ComposerControls — keeps the creator left-cluster module byte-identical (the HARD additive-only constraint)"
  - "Single render source = the open thread: after a profile POST the composer reloadProfileThread()s and renders persisted profile/reaction blocks (no separate session array → no double-render of the same block)"
  - "Evidence-staged submit takes precedence in onSubmitForm via an additive guard at the top (after the audience-chat branch) — the creator canSubmit/handleSubmit path below is untouched"
  - "A bounded 4s poll (max 45 tries, self-clears once a reaction-distribution lands) surfaces the simulate result live, because the shipped profile-read renderer is self-contained and cannot signal the composer (renderer left unmodified — additive-only)"

requirements-completed: []
requirements-pending-human-verify: [PROF-01, SIMU-03]

# Metrics
duration: ~30min
completed: 2026-06-28
status: code-complete-pending-human-verify
---

# Phase 05 Plan 06: Evidence-Drop Composer Affordance Summary

**A minimal, ADDITIVE "drop a chat / screenshot" affordance (Paperclip attach button + drag overlay + removable chip + inline muted reject) was added to the existing composer and POSTs the evidence stimulus to `/api/tools/profile`; the returned `profile-read` card and the `reaction-distribution` the card's own Simulate CTA persists to the SAME open thread render in-thread via the shared `MessageBlocks` renderer — the creator (Socials) path stays byte-identical, and the one-thread Profile→Simulate wow (SIMU-03) is now wired end-to-end pending the Task-2 human browser verification.**

## Status

- **Task 1 (composer affordance): COMPLETE + committed** (`92feb6c6`).
- **Task 2 (end-to-end human-verify in a real browser): PENDING** — returned to the orchestrator as a `checkpoint:human-verify`. Not self-approved (browser/visual verification cannot be automated).

## Performance

- **Duration:** ~30 min (Task 1)
- **Tasks:** 1 of 2 executed (Task 2 = human-verify checkpoint)
- **Files modified:** 1 source (`composer.tsx`) + 1 created planning doc (`deferred-items.md`)

## Accomplishments
- **D-07 additive affordance:** an attach icon-button (Phosphor `Paperclip`, `aria-label="Attach a chat or screenshot"`, focus ring, `pointer-coarse` ≥44px touch target) mounted in the control row ALONGSIDE `<ComposerControls/>`; a drag-over overlay (matte `bg-surface` + `shadow-float` + dashed 10% hairline, copy "Drop a chat export, screenshot, or short clip", dismiss on drop/leave); a removable selected-attachment chip (`bg-surface-elevated`, filename + ×, cream); all copy verbatim from the 05-UI-SPEC copywriting contract.
- **D-09 accept set:** `.txt`/`.md` → `file_text`, image → `image`, short video → `video`; `.docx`/`.pdf` (and any unrecognized type) → the inline muted reject ("That file type isn't supported yet — use a .txt/.md export, an image, or a short video."), never a blocking modal.
- **Wired to 05-04:** on submit the staged file routes (via an additive `onSubmitForm` guard) to `POST /api/tools/profile` — file_text/image as a base64 JSON `file` body, a clip staged to Supabase `videos` storage then posted as a sanitized `storagePath` (the route re-runs `sanitizeStoragePath`). 8 references to `tools/profile` in the file.
- **In-thread rendering (D-07 / 05-01):** the returned `profile-read` block and the `reaction-distribution` block the card's own Simulate CTA persists to the SAME open thread are read back from `/api/threads/open` and rendered via the shared `MessageBlocks` renderer — gated on block presence (there is NO "profile" tool; the evidence drop is the entry). Persisted profile/reaction blocks also rehydrate on mount.
- **SIMU-03 one-thread continuity:** a bounded, self-clearing 4s poll surfaces the reaction-distribution live after the card's Simulate CTA fires (the shipped 05-01 renderer is self-contained and left unmodified — additive-only).
- **Creator path byte-identical (T-05-19):** the new control sits beside, never inside, `ComposerControls`; the existing tool-selector / `canSubmit` / `handleSubmit` handlers are untouched (the evidence flow is a sibling guard at the top of `onSubmitForm`). Drag/drop is form-level but `VideoUpload` stops propagation on its own drop zone, so the creator video-upload path is unaffected.
- **Honesty / cut line held:** zero coral literals (reskin-matte guard green); NO front-door Audience picker, NO Mode-scoped skill menu, NO ambient reactor (all P7 — D-09).

## Task Commits

1. **Task 1: additive evidence-drop composer affordance → /api/tools/profile** — `92feb6c6` (feat)

## Files Created/Modified
- `src/components/app/home/composer.tsx` — additive evidence-drop affordance: copy constants + `classifyEvidence`/`fileToBase64` helpers; `evidenceFile`/`evidenceError`/`dragOver`/`profiling`/`persistedProfileBlocks` state + `evidenceInputRef`; `reloadProfileThread`/`acceptEvidenceFile`/`handleProfileSubmit` handlers + the bounded reaction poll; mount-rehydration of profile/reaction blocks; `hasThread`/`hasConversationContent` include profile blocks; a `ProfileThreadView` (MessageBlocks) in `threadContent`; the form drag handlers + overlay, the chip, the attach button + hidden file input, the `onSubmitForm` evidence guard, and the submit-button disabled/loading wiring.
- `.planning/phases/05-profile-simulate-wow/deferred-items.md` — the pre-existing out-of-scope `earnings-chart.tsx` build blocker (below).

## Verification (automated, per-task loop + wave gate)
- **AC1** `grep -c "tools/profile" src/components/app/home/composer.tsx` → **8** (≥1).
- **AC2** `npx tsc --noEmit` errors on `composer.tsx` → **0** (the file is type-clean; full-project count is the unchanged ~20-error pre-existing baseline).
- **AC3** reskin-matte: `grep -rcE "rgba\(255,127,80|#FF7F50" src/components/app/home/composer.tsx` → **0**; the shared reskin-matte guard → 6/6 green.
- **Existing composer tests:** `src/components/app/home/__tests__/` → **7 files / 52 tests pass** (no creator-path regression; the happy-dom teardown AbortError is pre-existing mount-fetch noise, not a failure).
- **WAVE GATE** `npm run build` → **compiles successfully** ("✓ Compiled successfully in 12.2s") — the client/server bundle-leak check (the gate's load-bearing purpose, GSI P3 BUILD-01 precedent) PASSES for the composer change. See Deferred Issues for the pre-existing type-check blocker.

## Deviations from Plan

### Out-of-scope discovery (logged, not fixed)

**1. [SCOPE BOUNDARY] Pre-existing `next build` TypeScript-step blocker in `earnings-chart.tsx`**
- **Found during:** Task 1 wave-gate `npm run build`.
- **Issue:** the build COMPILES cleanly but its subsequent full-project TypeScript step fails on `src/components/app/brand-deals/earnings-chart.tsx:98` — a recharts `<Tooltip content={…}>` type mismatch.
- **Why not fixed:** verified PRE-EXISTING on HEAD (stash test: the error is present without the 05-06 composer change) and in the brand-deals subsystem — unrelated to the Profile→Simulate surface; it is part of the ~20-error tsc baseline carried since 05-01. Per the SCOPE BOUNDARY rule (pre-existing failures in unrelated files are out of scope), it is logged to `deferred-items.md`, not fixed.
- **Impact:** none on this plan's surface — the composer change compiles (bundle gate met) and the Task-2 human-verify runs on `next dev`, which does not run the blocking full type-check. The build cannot exit 0 until the pre-existing earnings-chart typing debt is addressed (deferred).

No other deviations — the affordance was built additively exactly as the plan + 05-UI-SPEC specify.

## Known Stubs
None. The affordance is fully wired against the real 05-04 `/api/tools/profile` contract, the 05-05 same-thread `reaction-distribution`, and the 05-01 `MessageBlocks` renderers. The one accepted convenience: the primary "paste chat text" alternative from the UI-SPEC is served via a dropped/selected `.txt`/`.md` file (`file_text`) rather than a field-paste path, to avoid rerouting the creator field (the byte-identical constraint); the `kind:"text"` route branch remains available for a future field-paste entry if desired.

## Threat Flags
None — the composer control is a convenience UX layer; the authoritative validation (MIME/size/cap/storagePath) is server-side in the 05-04/05-05 routes (T-05-18). The creator path is byte-identical (T-05-19). No package installs (T-05-SC — D-05 zero-new-deps; `@phosphor-icons/react` was already a dependency).

## Human-Verify Checkpoint (Task 2 — PASSED 2026-06-29)
Verified end-to-end in a real browser (`next dev`, auth via `e2e/create-test-user.ts`) with a real chat fixture through the LIVE engine:
- **Evidence-drop affordance**: Paperclip → file chooser → staged chip → submit relabels to "Read this evidence"; `SIM-1 Flash` tag for text. ✓
- **`profile-read` card**: subject name, `person` variant, 4 behavioral tells each bound to a **verbatim** evidence quote, motivations, "How they'll react", grounded honesty caveat, `SIM-1 Flash` + `Directional` badge. **No forensic section** for a chat (D-03). **No 0-100, no N/10, zero terracotta-accent elements.** ✓
- **Chain**: "Simulate a message to {name} →" draft → `reaction-distribution` persisted to and rendered from the **SAME** open thread; person variant = single lead read (no N/10). ✓ (SIMU-03)

**Two bugs found + fixed during verify (both committed, re-verified live):**
1. **`15873d53`** — `createOpenThreadLazy` was insert-first; with the partial unique index non-enforcing it minted a new open thread per POST while the reader (`getOpenThread`/GET) returned the oldest, so the profile-read never surfaced. Fixed to **get-first** (idempotent get-or-create, 23505 race fallback kept). Root cause; shared infra — fixes the whole one-thread flow for every tool.
2. **`3a9abfe5`** — the profile-thread poll's `GET /api/threads/open` used the default fetch cache, so the reaction-distribution only appeared after a reload. Fixed with `{ cache: 'no-store' }`; reaction now auto-surfaces live in-session.

**Deferred (filed):** the Simulate reaction is **content-framed** ("Boring start… grab me with visuals") rather than reacting AS the baked person to the drafted message — an engine-layer concern in the Simulate reaction frame (05-05 runner). Filed as `.planning/todos/pending/simulate-reaction-person-framing.md`. The card honestly self-labels `Directional`, so it is not misleading in the interim.

## Self-Check: PASSED
- FOUND: src/components/app/home/composer.tsx (modified, committed 92feb6c6 + 3a9abfe5)
- FOUND: src/lib/threads/threads.ts (get-first fix, committed 15873d53)
- FOUND: .planning/phases/05-profile-simulate-wow/deferred-items.md
- FOUND commits: 92feb6c6 (feat — Task 1), 15873d53 + 3a9abfe5 (human-verify fixes)

---
*Phase: 05-profile-simulate-wow*
*Completed: 2026-06-29 — Task 1 code + Task 2 human-verify PASSED (2 fixes applied)*
