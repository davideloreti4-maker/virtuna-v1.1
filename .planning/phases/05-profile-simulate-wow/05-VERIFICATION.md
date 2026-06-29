---
phase: 05-profile-simulate-wow
verified: 2026-06-29T00:25:00Z
status: passed
score: 4/4 roadmap success criteria verified (7/7 requirement IDs satisfied)
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification
---

# Phase 5: Profile → Simulate Wow Verification Report

**Phase Goal:** Deliver the PMF on-ramp — a user profiles a chat into a saved person/panel audience, then simulates a reply through it, as one continuous end-to-end thread.
**Verified:** 2026-06-29T00:25:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User uploads evidence (chat `.txt`/doc), SIM-1 builds a person/panel audience, shown as a Profile card backed by evidence quotes | ✓ VERIFIED | `profile-bake.ts` `bakeProfileSignature` (evidence→frozen AudienceSignature, never calls `enrichSignature`); `profile-runner.ts` fuses READ + bake; `ProfileReadBlockSchema.props.tells[].evidence` (`.min(1)`, verbatim quote, TRUST-02); `profile-read-block.tsx` renders tells bound to evidence; composer affordance POSTs to `/api/tools/profile`. Person/panel via `detectSubjectKind` (default person). |
| 2 | The Profile-built audience is saved to the General library and offers a chain CTA "Simulate a message to [them]" | ✓ VERIFIED | `runProfile` calls `createAudience(mode:"general")`, sets `block.props.savedAudienceId` (line 290); `chain-handoff.ts` `profile→simulate` entry `ctaLabel:"Simulate a message to them →"`, `endpoint:"/api/tools/simulate"`, `anchorFrom:"card"`; CTA wired in `profile-read-block.tsx` via `handoffsFor("profile")` + tested `buildSimulateRequest` seam (savedAudienceId→audienceId). |
| 3 | `simulate(audience, stimulus)` runs a stimulus through a General audience and returns reactions as a reaction-distribution card (distribution + themes) | ✓ VERIFIED | `simulate-runner.ts` `runSimulate` lifts `buildAudienceRepaint`→`runFlashTextMode`→`aggregateFlash` (band/fraction never re-rolled); branches person (single read, band/fraction suppressed) vs panel (band+fraction+themes+reactions); `ReactionDistributionBlockSchema` `.strict()` bands-only; renderer branches on `subjectKind`; route `/api/tools/simulate` resolves audience via `getAudience` (RLS). |
| 4 | The full Profile-a-chat → Simulate-a-reply flow completes end-to-end within a single thread | ✓ VERIFIED | Both routes call `createOpenThreadLazy(user.id)` → `insertMessage(openThread.id, ...)`; `createOpenThreadLazy` is GET-FIRST (commit `15873d53`) so writer/reader resolve the SAME open thread; persistence round-trip test (messages.test.ts); composer live-poll uses `cache:'no-store'` (commit `3a9abfe5`); human-verified live in a real browser 2026-06-29 (per 05-06 SUMMARY / ROADMAP). |

**Score:** 4/4 roadmap success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/tools/profile-blocks.ts` | profile-read + reaction-distribution `.strict()` bands-only schemas + types | ✓ VERIFIED | 109 lines; both `.strict()`; no numeric 0-100 field; `model` enum, `tier` literal "Directional" |
| `src/lib/tools/blocks.ts` | imports both schemas, appends to `BlockUnionSchema`, re-exports types | ✓ VERIFIED | 434 lines (< 500 limit); both in discriminatedUnion (L476-477) |
| `src/lib/tools/block-registry.ts` | profile-read + reaction-distribution in `BLOCK_REGISTRY` | ✓ VERIFIED | L48-49 both registered |
| `src/components/thread/message-blocks.tsx` | both renderers in `BLOCK_COMPONENTS` | ✓ VERIFIED | L44-45 both keyed; TS completeness against BlockType |
| `src/lib/tools/chain-handoff.ts` | SkillId + profile→simulate handoff | ✓ VERIFIED | SkillId extended (L58-59); handoff entry endpoint `/api/tools/simulate`, anchorFrom "card" |
| `src/components/thread/profile-read-block.tsx` | renderer + `buildSimulateRequest` seam | ✓ VERIFIED | 272 lines; pure helper test-enforced; forensic section gated; zero coral |
| `src/components/thread/reaction-distribution-block.tsx` | renderer branching on subjectKind | ✓ VERIFIED | 146 lines; 4 subjectKind refs; zero coral |
| `src/lib/engine/behavioral-core.ts` | byte-stable prompts + ethics + tier-gated forensic + backstop | ✓ VERIFIED | 407 lines; FLASH/MAX prompts share CORE+ethics prefix; no Date.now/Math.random/new Date; `scanForExcludedCoaching`+`EXCLUDE_REGISTRY` |
| `src/lib/audience/profile-bake.ts` | bake + detectSubjectKind + sanitizeStoragePath + watchPersonVideo | ✓ VERIFIED | 422 lines; reuses synth PARTS not `enrichSignature`; sanitize rejects absolute/`..`/bad-shape |
| `src/lib/tools/runners/profile-runner.ts` | runProfile fused READ+bake, tier-gated forensic | ✓ VERIFIED | 276 lines; `SIM1_MODEL_BY_TIER` routing; forensic gated to max (L288); subjectKind marker persisted (L272) |
| `src/app/api/tools/profile/route.ts` | POST with full security spine | ✓ VERIFIED | 129 lines; auth→csrf→cap→sanitizeStoragePath→normalize→createOpenThreadLazy→runProfile→insertMessage |
| `src/lib/tools/runners/simulate-runner.ts` | runSimulate, deterministic subjectKind, no behavioral-core | ✓ VERIFIED | 199 lines; `behavioral-core` grep === 0 (Pitfall 5); aggregateFlash reused |
| `src/app/api/tools/simulate/route.ts` | POST with security spine + same-thread persist | ✓ VERIFIED | 92 lines; auth→csrf→cap→getAudience(RLS)→runSimulate→insertMessage |
| `src/components/app/home/composer.tsx` | additive evidence-drop affordance, creator path untouched | ✓ VERIFIED | additive Paperclip + drag overlay + removable chip; `.docx`/`.pdf` D-09 reject; POSTs `/api/tools/profile`; zero coral |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| message-blocks.tsx | BLOCK_COMPONENTS | both renderer entries | ✓ WIRED |
| block-registry.ts | profile-blocks.ts | schema import + map entry | ✓ WIRED |
| profile-read-block.tsx (buildSimulateRequest) | /api/tools/simulate body | savedAudienceId→audienceId, test-enforced | ✓ WIRED |
| profile-runner.ts | behavioral-core.ts | BEHAVIORAL_SYSTEM_PROMPT_FLASH/_MAX tier-routed | ✓ WIRED |
| profile-runner.ts | profile-bake + createAudience | bake → save mode:general + subjectKind marker | ✓ WIRED |
| profile route + simulate route | createOpenThreadLazy → insertMessage | SAME open thread (get-first) | ✓ WIRED |
| simulate-runner.ts | runFlashTextMode + aggregateFlash + buildAudienceRepaint | per-audience read, delta dropped | ✓ WIRED |
| simulate-runner.ts | custom_context `__subject_kind` marker | deterministic person/panel branch | ✓ WIRED |
| composer.tsx | /api/tools/profile | attach/drop control posts evidence | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 11 phase test files pass | `vitest run` (11 files) | 11 files / 110 tests passed | ✓ PASS |
| Bands-only: numeric score rejected | grep blocks.test.ts | explicit `score:87`/`overall_score` → `success).toBe(false)` assertions present | ✓ PASS |
| Deterministic subjectKind (not persona count) | grep simulate-runner.test.ts | "person-marked audience carrying >1 persona STILL renders a person read" asserted | ✓ PASS |
| Chain seam savedAudienceId→audienceId | grep profile-read-block.test.ts | `buildSimulateRequest({savedAudienceId:'aud_x'},...)` → `audienceId).toBe('aud_x')` | ✓ PASS |
| Byte-stable behavioral prompt | grep behavioral-core.ts | no Date.now/Math.random/new Date | ✓ PASS |
| Pitfall 5: simulate-runner not importing behavioral-core | grep count | 0 | ✓ PASS |
| reskin-matte: no coral | grep 3 phase UI files | 0 across all | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROF-01 | 05-03, 05-04, 05-06 | Upload evidence → SIM-1 builds person/panel audience | ✓ SATISFIED | bakeProfileSignature + runProfile bake→createAudience + composer affordance |
| PROF-02 | 05-01, 05-02, 05-04 | Profile card shows who, backed by evidence quotes | ✓ SATISFIED | ProfileReadBlockSchema tells[].evidence + behavioral-core READ + renderer |
| PROF-03 | 05-04 | Audience saved to General library | ✓ SATISFIED | runProfile `createAudience(mode:"general")`, savedAudienceId on block |
| PROF-04 | 05-01 | Chain CTA "Simulate a message to [them]" | ✓ SATISFIED | chain-handoff profile→simulate + tested buildSimulateRequest seam + CTA |
| SIMU-01 | 05-05 | simulate runs stimulus through General audience, returns reactions | ✓ SATISFIED | runSimulate runFlashTextMode→aggregateFlash + route getAudience(RLS) |
| SIMU-02 | 05-01, 05-05 | reaction-distribution card renders distribution + themes | ✓ SATISFIED | ReactionDistributionBlockSchema + renderer subjectKind branch |
| SIMU-03 | 05-01, 05-05, 05-06 | End-to-end one thread Profile→Simulate | ✓ SATISFIED | shared createOpenThreadLazy get-first + persistence round-trip test + live human-verify |

All 7 requirement IDs declared in PLAN frontmatter are accounted for and satisfied. No orphaned requirements (REQUIREMENTS.md maps exactly PROF-01..04 + SIMU-01..03 to Phase 5).

### Security Carry-Forwards (P4 AR-04-01/02 — MUST close in P5)

| Carry | Status | Evidence |
|-------|--------|----------|
| storagePath sanitization (AR-04-01) | ✓ CLOSED | `sanitizeStoragePath` rejects absolute / `..` / bad key-shape; enforced at the route (400, L109-111) AND in profile-bake before any signed-URL dereference |
| text content cap (AR-04-02) | ✓ CLOSED | `MAX_EVIDENCE_LENGTH=8000` enforced at profile route (400, L87-90); `MAX_MESSAGE_LENGTH=2000` at simulate route |
| D-08 instruction isolation | ✓ CLOSED | evidence/goal/successCriterion isolated in USER message; byte-stable system prompts carry no user bytes (asserted in profile-runner + profile-bake tests) |

### Anti-Patterns Found

None. No TBD/FIXME/XXX debt markers in phase-modified files. No coral/glass literals. No stub renderers (both renderers render validated props with real branches). No hardcoded-empty data feeding the UI.

### Deferred Items (informational — not gaps)

| Item | Disposition |
|------|-------------|
| Simulate reaction is content-framed rather than person-framed | Filed todo `.planning/todos/pending/simulate-reaction-person-framing.md`; engine reaction-frame concern, explicitly out of scope for this UI-wiring phase. Does not block the phase goal (the reaction-distribution card renders and persists correctly). |

### Human Verification

The phase's own blocking checkpoint (05-06 Task 2) was executed in a real browser on 2026-06-29 and PASSED: real chat → forensic profile-read card (evidence-quoted tells, Directional badge, no 0-100/N-of-10, zero terracotta accent, no forensic section for a chat) → "Simulate a message →" → reaction-distribution in the SAME open thread. Two bugs were found, fixed, committed, and re-verified live (`15873d53` thread get-first, `3a9abfe5` no-store poll). No further human verification required — the user-flow check the phase demanded is satisfied and the resulting fixes are present in the codebase.

### Gaps Summary

None. All 4 ROADMAP success criteria are observably true in the codebase, all 7 requirement IDs are satisfied, all artifacts exist and are substantive + wired + data-flowing, both P4 security carry-forwards are enforced (not merely asserted), 110 phase tests pass, and the end-to-end one-thread wow was human-verified live with the resulting bug fixes committed.

---

_Verified: 2026-06-29T00:25:00Z_
_Verifier: Claude (gsd-verifier)_
