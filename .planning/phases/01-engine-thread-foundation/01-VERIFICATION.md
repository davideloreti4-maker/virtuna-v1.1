---
phase: 01-engine-thread-foundation
verified: 2026-06-17T10:42:00Z
status: passed
score: 16/16 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 1: Engine & Thread Foundation Verification Report

**Phase Goal:** Stand up the substrate the whole studio runs on — a SIM-1 Flash text-mode engine path, a thread model that supports grounded and open threads, a reusable tool-runner, typed-block rendering, message/block persistence, and the composer as the universal entry door.
**Verified:** 2026-06-17T10:42:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

This phase ships the **substrate / contracts**, not product wiring (plans state verbatim "P1 ships the contract only" / "Do NOT wire any UI here — Ideas/Hooks consume it in P3/P4"). Goal-backward verification is therefore assessed against "the contracts exist, are substantive, validate at their boundaries, and the protected Max path is untouched" — NOT against end-to-end product flow (which is explicitly deferred). All 5 ROADMAP success criteria + all PLAN frontmatter must-haves resolve to VERIFIED.

### Observable Truths

| # | Truth (source) | Status | Evidence |
|---|---|---|---|
| SC-1 | SIM-1 Flash reacts to text — 10 archetypes, per-persona reaction + aggregate, mode-specific framing; winning framing as inline-scoring spec | ✓ VERIFIED | `run-flash-text-mode.ts` fires ONE bounded Qwen json_object call (temp:0, seed:QWEN_SEED, AbortController); `FlashResultSchema.length(10)`; `buildFlashUserContent(text, framing)` swaps hook/idea/chat question + band verbiage (flash-prompts.ts L31-41, D-04); thresholds named as ENGINE-01 calibration constants documented as inline-scoring spec (flash-aggregate.ts L10-25). 36 flash tests pass. |
| SC-2 | Creator can start grounded or open thread from composer; routes URL/upload→Test, prompt→generator/chat; thread model carries nullable reading_id + type discriminator (migration + types live) | ✓ VERIFIED | Migration creates `threads` (type CHECK grounded\|open, nullable `reading_id text REFERENCES analysis_results(id) ON DELETE SET NULL`, partial UNIQUE idx); regenerated `database.types.ts` contains `threads` (L1502) + `messages` (L1054) with `reading_id: string \| null` (L1506); composer mounts `<ToolChips activeTool>` with 4-chip vocabulary + active-model field. |
| SC-3 | Messages render markdown OR typed blocks via fixed renderer (no model-generated UI); any tool output flows through ONE tool-runner contract (schema→typed, none→markdown) | ✓ VERIFIED | BLOCK_REGISTRY SSOT + `validateBlock` (never throws); `MessageBlocks` re-validates each block→`<UnsupportedBlock>` fallback; `ToolRunner<TOut>` with the 6 THREAD-06 fields; `dispatchToolOutput` schema-present→safeParse→assertBlocksInRegistry→typed, schema-null→markdown. No scattered `switch(.type)` (registry-dispatch only). |
| SC-4 | Messages + typed blocks persist and re-hydrate on reload (no data loss) | ✓ VERIFIED | `insertMessage` validates each block at write boundary; `loadMessages` re-validates per block on rehydration (D-14), invalid→UnsupportedBlock sentinel, message NEVER dropped; `body jsonb NOT NULL DEFAULT '[]'`; messages.test.ts (8 tests, mixed valid/invalid round-trip) pass. Migration APPLIED to live DB (types regenerated from live schema). |
| SC-5 | Flash honest as concept ceiling vs Max realized result — never fabricated score / view promise; engine suite green, same-video Max identity preserved, ENGINE_VERSION 3.19.0 | ✓ VERIFIED | band-block / flash-aggregate / flash-runner emit ZERO numeric score/percentile/views (only band word + "N/10 stop" fraction); Flash path HARD-ISOLATED (zero imports of pipeline/aggregator/version/wave3/fold); `version.ts` byte-untouched (last commit 2026-06-11, pre-phase); `ENGINE_VERSION === "3.19.0"`. Full suite per orchestrator: 2274 pass / 26 skip / 0 fail. |
| T-01a | Registered+valid block renders mapped component; unknown/invalid→static UnsupportedBlock, never executes model props | ✓ VERIFIED | `UnsupportedBlock` takes NO props (stateless, propless); MessageBlocks `validateBlock` per block (L37). |
| T-01b | Same BLOCK_REGISTRY schemas validate at tool-runner boundary AND on rehydration (one SSOT, two consumers) | ✓ VERIFIED | `validateBlock`/`assertBlocksInRegistry` imported by tool-runner.ts (L17,119), messages.ts (L27), message-blocks.tsx (L12). |
| T-01c | Schema present→typed blocks; no schema→single markdown block | ✓ VERIFIED | `dispatchToolOutput` two-branch dispatch; tool-runner.test.ts (6 tests) pass. |
| T-01d | Each Flash/Max block carries model tag (sim1-flash/sim1-max) | ✓ VERIFIED | BandBlock props include `model: enum(sim1-flash\|sim1-max)`; flash-runner tags blocks `model:"sim1-flash"`. |
| T-02a | createGroundedThreadLazy idempotent on UNIQUE(reading_id), one thread per Reading | ✓ VERIFIED (contract) | `onConflict:"reading_id", ignoreDuplicates:true` (threads.ts L55) + partial UNIQUE idx. NOTE: CR-02 (see Anti-Patterns) — onConflict vs partial-index mismatch is a latent runtime bug; helper has no caller yet. |
| T-02b | RLS enforces ownership; user_id server-side, never from request body | ✓ VERIFIED | Migration RLS `user_id = auth.uid()` on threads + EXISTS-subquery on messages; helpers take `userId` param, zero `body.user_id`/`req.user_id` reads. |
| T-03a | runFlashTextMode: ONE bounded call, 10 archetypes, stop/scroll verdict + first-person quote, registry-sourced personas | ✓ VERIFIED | Bounded envelope mirrors fold.ts; personas from `wave3/persona-registry` (D-05); FlashPersona `{archetype, verdict, quote(1-160)}`. |
| T-03b | Aggregate qualitative ONLY — band + fraction, never number | ✓ VERIFIED | `aggregateFlash` returns exactly `{band, fraction}`; grep for score/percentile/views = only suppression comments. |
| T-03c | Framing is a CALL PARAMETER (one engine path) | ✓ VERIFIED | Single `runFlashTextMode(text, framing)`; framing swaps question + verbiage only. |
| T-04a | Composer shows tool-chip row; active chip drives placeholder + action; only Test live, others disabled "coming soon" + cost slot | ✓ VERIFIED | 4 chips, `test` enabled, idea/hooks/chat `disabled`+`aria-disabled`+sr-only "coming soon"+`data-cost-slot`; active-model field Test→SIM-1 Max, others→SIM-1 Flash. tool-chips.test.tsx (13 tests) pass. |
| T-04b | Test loop preserved byte-for-behavior — chip selection NEVER arms navigation | ✓ VERIFIED | `pendingNavRef.current = true` ONLY at composer.tsx L151,171 (submit handlers); `.start()` only L153,173; chip `onSelect = setActiveTool` (no nav). composer-navigate-guard.test.tsx (4 tests, incl. 2 new chip-safety) pass. |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact | Status | Details |
|---|---|---|
| `src/lib/tools/blocks.ts` | ✓ VERIFIED | 73 lines; MarkdownBlock/BandBlock/PersonasBlock zod schemas; BandBlock has NO numeric score |
| `src/lib/tools/block-registry.ts` | ✓ VERIFIED | 68 lines; BLOCK_REGISTRY + validateBlock + assertBlocksInRegistry + BlockType; server-importable |
| `src/lib/tools/tool-runner.ts` | ✓ VERIFIED | 122 lines; ToolRunner<TOut> 6 fields + reserved stream?; dispatchToolOutput two-branch |
| `src/lib/tools/runners/flash-runner.ts` | ✓ VERIFIED | 156 lines; model:"sim1-flash", renderer:["band","personas"], assertBlocksInRegistry |
| `src/components/thread/message-blocks.tsx` | ✓ VERIFIED | 55 lines; validateBlock per block → UnsupportedBlock fallback (WIRED to registry, not yet to a page — by design) |
| `src/components/thread/{unsupported,markdown,band,personas}-block.tsx` | ✓ VERIFIED | All present + substantive; UnsupportedBlock propless |
| `src/lib/engine/flash/*.ts` (schema/aggregate/prompts/run) | ✓ VERIFIED | All present; hard-isolated from Max path |
| `src/lib/threads/threads.ts` | ✓ VERIFIED (contract) | 118 lines; lazy create + getThread + getOpenThread. CR-01/CR-02 latent bugs (no caller) |
| `src/lib/threads/messages.ts` | ✓ VERIFIED | 154 lines; insertMessage write-validate + loadMessages rehydrate-validate |
| `supabase/migrations/20260617000000_threads_messages.sql` | ✓ VERIFIED | 135 lines; threads+messages, partial UNIQUE, RLS; analysis_results untouched; APPLIED to live DB |
| `src/types/database.types.ts` | ✓ VERIFIED | Regenerated from live DB; threads (L1502) + messages (L1054), reading_id: string\|null |
| `src/components/app/home/tool-chips.tsx` | ✓ VERIFIED | 131 lines; 4 chips, model labels, cost slot |
| `src/components/app/home/composer.tsx` | ✓ VERIFIED | 298 lines; ToolChips mounted, nav guard intact |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| message-blocks.tsx | block-registry.ts | validateBlock per block | ✓ WIRED |
| tool-runner.ts | block-registry.ts | assertBlocksInRegistry on output | ✓ WIRED |
| messages.ts | block-registry.ts | validateBlock on insert + load | ✓ WIRED |
| threads.ts | threads UNIQUE(reading_id) | upsert onConflict reading_id | ⚠ WIRED-but-fragile (CR-02: onConflict can't use partial index — latent, no caller) |
| run-flash-text-mode.ts | persona-registry.ts | ARCHETYPE_DEFINITIONS | ✓ WIRED |
| flash-runner.ts | block-registry.ts | band+personas validated against registry | ✓ WIRED |
| composer.tsx | tool-chips.tsx | activeTool state drives placeholder + model field | ✓ WIRED |

### Data-Flow Trace (Level 4)

P1 ships contracts; runtime data sources (live Qwen call, live DB reads) are deliberately not yet invoked by any product caller. Flash runner / thread helpers / MessageBlocks have no caller — **expected and correct for a substrate phase** (Ideas/Hooks/Chat consume them in P3/P4/P5). The migration IS applied to the live DB (real schema confirmed via regenerated types), so the persistence layer types against real schema, not config. No HOLLOW/STATIC artifacts: every artifact's logic is substantive, not stubbed.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Phase test suites pass | `vitest run src/lib/tools src/lib/engine/flash src/lib/threads src/components/app/home` | 10 files / 93 tests passed | ✓ PASS |
| ENGINE_VERSION unchanged | grep version.ts | `ENGINE_VERSION === "3.19.0"` | ✓ PASS |
| version.ts untouched by phase | git log version.ts | last commit 2026-06-11 (pre-phase) | ✓ PASS |
| Flash isolation | grep forbidden imports in flash/ | zero matches | ✓ PASS |
| analysis_results untouched | grep ALTER/DROP in migration | zero matches | ✓ PASS |
| No scattered switch (D-14) | grep `switch(.type)` | zero matches | ✓ PASS |
| Honesty spine (no numeric) | grep score/views in band-block/aggregate/runner | only suppression comments | ✓ PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` and no probe references in PLAN/SUMMARY. Migration apply was a blocking human-action checkpoint (01-02 Task 3), confirmed applied via regenerated live-DB types containing threads + messages. Not a probe-based phase. SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| ENGINE-01 | 01-03 | SIM-1 Flash text-mode, 10 archetypes, mode framing, inline-scoring spec | ✓ SATISFIED | runFlashTextMode + framing + calibration constants |
| ENGINE-03 | 01-03 | Honest Flash/Max framing, no fabricated score | ✓ SATISFIED | qualitative band+fraction only; model tags |
| THREAD-01 | 01-02 | Generalized thread model, nullable reading_id + type discriminator | ✓ SATISFIED | migration + regenerated types |
| THREAD-02 | 01-04 | Composer = universal door, routes Test vs generator/chat | ✓ SATISFIED | ToolChips + activeTool routing |
| THREAD-04 | 01-01 | Typed-block rendering, no model-generated UI | ✓ SATISFIED | BLOCK_REGISTRY + UnsupportedBlock fallback |
| THREAD-06 | 01-01 | Tool-runner abstraction | ✓ SATISFIED | ToolRunner contract + dispatch |
| THREAD-07 | 01-02 | Message/block persistence + rehydration | ✓ SATISFIED | insert/load with double validation |

All 7 phase requirement IDs declared in PLAN frontmatter, all present in REQUIREMENTS.md traceability (all marked Complete), all satisfied. No orphaned requirements (REQUIREMENTS.md maps exactly these 7 to Phase 1).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| src/lib/threads/threads.ts | 44-72 | CR-01: service-client read-back not scoped by user_id | ⚠ Warning | Latent cross-user read; helper has NO caller in P1 — cannot trigger until P3 wires a route. Must fix before wiring. |
| src/lib/threads/threads.ts | 51-56 + migration:51 | CR-02: upsert onConflict:"reading_id" can't use partial unique index → runtime 42P10 throw | ⚠ Warning | The idempotency path throws if ever called; no caller in P1. Must fix before wiring. |
| src/lib/threads/threads.ts | 102-118 | WR-01/WR-02: getOpenThread maybeSingle can throw on 2nd open thread; reads via service client | ⚠ Warning | Latent; no caller. |
| migration | 107-136 | WR-03: no DELETE/UPDATE policy on messages | ℹ Info | Cascade covers deletes today; future edit/retract silently no-ops. |
| flash-schema.ts | 80-90 | WR-04/WR-05: coerce blanks missing archetype; verdict synonyms not folded | ℹ Info | Salvage less robust than intended; schema still rejects bad data. |
| tool-runner.ts | 21 | KnowledgeBundle "P1 placeholder" | ℹ Info | Documented Phase 2 (GROUND-*) seam, not a stub — THREAD-06 reserves it. |

No `TBD`/`FIXME`/`XXX` debt markers in any phase source file. All `placeholder`/`coming soon` matches are intentional (UnsupportedBlock static placeholder, disabled-chip copy per D-08, KnowledgeBundle Phase-2 seam) — not stubs.

**Note on review Criticals:** The 2 Criticals (CR-01, CR-02) in `threads.ts` are real bugs but are downgraded to Warnings *for the P1 goal* because the helpers have zero callers (verified: no import outside the threads module/tests). They cannot affect any observable P1 behavior. They are correctness gaps that MUST be fixed before P3 wires a route to these helpers — flag carried forward to Phase 3 planning. They do not block the P1 substrate goal.

### Human Verification Required

None. The one human-gated step (live migration apply, 01-02 Task 3) was completed by the orchestrator and is independently confirmed in the codebase: `database.types.ts` regenerated from the live DB now contains `threads` + `messages` types with the FK relationship and `reading_id: string | null`. No PLAN `<human-check>` blocks were deferred to end-of-phase. All other truths are verifiable programmatically and verified above. No visual/real-time/external-service behavior is in scope for this substrate phase (no UI is wired to product yet — by design).

### Gaps Summary

No gaps. All 5 ROADMAP success criteria, all 16 PLAN must-have truths, all required artifacts, all key links, and all 7 requirement IDs are verified against the actual codebase. 93/93 phase tests pass; the protected SIM-1 Max path is byte-untouched (ENGINE_VERSION 3.19.0, version.ts/pipeline/aggregator not modified, full suite 2274 pass / 0 fail); Flash is hard-isolated; the honesty spine (no fabricated number) is structurally enforced in the renderer, aggregate, and runner; the migration is applied to the live DB with types regenerated from it.

The phase goal — "stand up the substrate the whole studio runs on" — is achieved: the contracts (renderer registry SSOT, tool-runner, Flash engine path, thread/message persistence, composer entry door) all EXIST, are SUBSTANTIVE, VALIDATE at their boundaries, and are mutually WIRED at the contract level. The deliberate absence of product-UI wiring (no caller for Flash runner / thread helpers / MessageBlocks) is the explicit P1 scope ("ships the contract only"), with consumption scheduled for P3/P4/P5. The two review Criticals are latent (no caller) and carried forward as a pre-wiring fix for Phase 3.

---

_Verified: 2026-06-17T10:42:00Z_
_Verifier: Claude (gsd-verifier)_
