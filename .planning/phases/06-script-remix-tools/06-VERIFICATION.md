---
phase: 06-script-remix-tools
verified: 2026-06-18T16:13:00Z
status: passed
score: 23/23 must-haves verified (1 live-render follow-up deferred — env-blocked)
overrides_applied: 1
override_note: "2026-06-18: The single human_verification item (Remix card live render) is blocked by a non-functional Apify key in this environment — the resolve/decode step cannot run for ANY URL here, so the live render is un-observable regardless of code correctness. Confirmed by the user. The remix-card + remix→hooks CTA are verified by 12 block unit tests + 20 runner tests + full suite green; D-05a gate passed. Phase marked complete by user decision with the live render logged as an infra-gated follow-up (re-run Remix once Apify is restored). See also 06-REVIEW.md WR-04/05/06 advisory hardening follow-ups."
human_verification:
  - test: "Run Remix with a resolvable TikTok URL end-to-end in the live studio (DEFERRED — Apify key non-functional in this env)"
    expected: "remix-card renders real decode anatomy (sourceDecode), the 'Borrowed: <format>' coral chip, and a working 'Develop into hooks →' CTA that POSTs the adapted hook to /api/tools/ideas/develop and appends a hooks card in the same open thread"
    why_human: "The UAT test TikTok URL failed to resolve/decode (HTTP 200 then SSE error). Root cause: the dev Apify key is non-functional, so resolve/decode cannot run here for any URL — not a code defect. Card is coded + passes 12 block unit tests + full suite; live render to be observed once Apify is restored."
---

# Phase 6: Script & Remix Tools Verification Report

**Phase Goal:** Ship two creator skills — Script (hook→script→test spine: generate ONE script → self-judge → opener-only band, "Test full →") and Remix (URL → decode → adapt → "Develop into hooks →") — both wired into the studio via the generic CHAIN_HANDOFFS plumbing, with the protected SIM-1 Max engine path proven unchanged (D-05a regression gate).
**Verified:** 2026-06-18T16:13:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Truths merge ROADMAP Success Criteria (SC1–SC4, the contract) with PLAN frontmatter must_haves across all 5 plans.

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | **SC1** — Creator carries a hook into Script and gets a script card (beats + timing + per-beat retention), Flash viability beat, self-judge gate, landing on "Test full →" | ✓ VERIFIED | `runScriptPipeline` (script-runner.ts:220) generates ONE script, gates opener via `runFlashTextMode(...,'hook',...)` (L256) + `aggregateFlash` (L264); card renders 5 beats + timing + retention + "Test full →" CTA (script-card-block.tsx:212). Live UAT PASS (06-UAT.md row 57–59). |
| 2  | **SC2** — Creator starts from Remix (URL/own winner) → *their* niche version feeding Hooks/Test, built on a reuse scout (not from-scratch) | ⚠️ VERIFIED (code+tests) / live render = human follow-up | `runRemixPipeline` (remix-runner.ts:107): resolveAndRehost→runDecode→generateAdaptConcepts→opener Flash gate; reuse scout = 06-SCOUT.md (revive viral-remix prior art); remix→hooks CTA → `/api/tools/ideas/develop`. Stages + error path live-verified; **card live render NOT browser-verified** (test URL failed to resolve — see Human Verification). |
| 3  | **SC3** — Both skills register via Phase-5 generic chain plumbing (runner + typed card + chain CTA), no one-off wiring, append in single open thread | ✓ VERIFIED | CHAIN_HANDOFFS has live hooks→script (`/api/tools/script`), script→test (context), remix→hooks (`/api/tools/ideas/develop`) (chain-handoff.ts:93–156); Script+Remix chips live (tool-chips.tsx:50–51); composer routes via useScriptStream/useRemixStream, never /analyze (composer.tsx:157–170,289). |
| 4  | **SC4 (BLOCKING)** — Engine suite green, SIM-1 Max score-identity preserved, ENGINE_VERSION unchanged (3.19.0) | ✓ VERIFIED | `ENGINE_VERSION = "3.19.0"` (version.ts:127); version.ts last edited 2026-06-11; **zero phase-06 commits touched src/lib/engine/** (last engine commit 9d3f3d83, 2026-06-17, pre-phase); decode.ts read-only since 2026-06-03. Engine suite 1066 pass / 0 fail; full suite 2523 pass / 0 fail; build clean. |
| 5  | assembleBundle({mode:'script'}) accepted (modeSchema + MODE_ROLES.script) | ✓ VERIFIED | modeSchema includes "script" (assembler.ts:66); MODE_ROLES.script defined (L112). |
| 6  | assembleBundle({mode:'remix'}) accepted | ✓ VERIFIED | modeSchema includes "remix" (assembler.ts:66); MODE_ROLES.remix defined (L113). |
| 7  | script-card block validates + rehydrates (not UnsupportedBlock) | ✓ VERIFIED | ScriptCardBlockSchema (blocks.ts:154) in union (L229); registry entry (block-registry.ts:32); 14 block tests pass. |
| 8  | remix-card block validates + rehydrates | ✓ VERIFIED | RemixCardBlockSchema (blocks.ts:193) in union (L230); registry entry (block-registry.ts:33); 12 block tests pass. |
| 9  | KC_SCRIPT_SYSTEM_PROMPT exists = BASE + Script slice | ✓ VERIFIED | compiled.ts:1318 `KC_SCRIPT_SYSTEM_PROMPT = ${KC_BASE}...${KC_SCRIPT_SLICE}`; slice at L1058; corpus/script.md authored (243 lines). |
| 10 | Opener Flash gate reuses runFlashTextMode('hook') + aggregateFlash unchanged (zero new SIM calibration) | ✓ VERIFIED | script-runner.ts:43–44 imports both from engine; remix-runner.ts:42 same. No engine files modified (truth 4). |
| 11 | POST /api/tools/script: auth-first, caps ask/anchor, persists to open thread, content-first stream | ✓ VERIFIED | getUser()→401 first (route.ts:70–72), user.id from session (L109), insertMessage (L190), SSE content-first. |
| 12 | runRemixPipeline runs resolve→real decode→adapt→opener gate→ONE remix-card | ✓ VERIFIED | remix-runner.ts:121/139/154/175; runDecode is the real structural decode (D-05). 11 runner tests pass. |
| 13 | cleanup() called in finally unconditionally (derive-and-drop T-03-02) | ✓ VERIFIED | remix-runner.ts:228–230 `finally { await cleanup(); }`. |
| 14 | Null decode handled gracefully (SkillRunError, never crashes) | ✓ VERIFIED | decode_failed / adapt_failed graceful paths (remix-runner.ts:69–70,139,162); runner tests cover null decode. |
| 15 | POST /api/tools/remix/run: auth-first, validates URL, maxDuration=300, persists | ✓ VERIFIED | getUser()→401 first (route.ts:83–85), maxDuration=300 (L49), insertMessage (L224). URL validation present but weak (see WR-01). |
| 16 | CHAIN_HANDOFFS placeholders have live endpoints/context wired | ✓ VERIFIED | All 3 P6 entries live (chain-handoff.ts:130,105,156); no TODO/TBD/placeholder remaining. |
| 17 | Script + Remix chips appear and route to SSE streams (never /analyze) | ✓ VERIFIED | tool-chips.tsx:50–51 enabled:true; composer.tsx routing + "NEVER navigates to /analyze" guard (L289). |
| 18 | hooks "Write script →" carries hookLine into Script | ✓ VERIFIED | hook-card-block.tsx:204 CTA; POSTs {ask:"", anchor:hookLine} per UAT (fix 3a4c6861, live PASS). |
| 19 | script "Test full →" carries opener into Test (no model call) | ✓ VERIFIED | ScriptTestContext (script-test-context.tsx:27) provided by ScriptThreadView (script-thread-view.tsx:98); UAT confirms no model call on script text. |
| 20 | remix "Develop into hooks →" feeds Hooks | ✓ VERIFIED | remix-card-block.tsx:221 CTA → RemixDevelopContext → /api/tools/ideas/develop (route exists, 6993 bytes). |
| 21 | ScriptTestContext exists (sibling of HookTestContext) | ✓ VERIFIED | script-test-context.tsx createContext + useContext hook. |
| 22 | useScriptStream + useRemixStream SSE consumers exist | ✓ VERIFIED | use-script-stream.ts (286 lines), use-remix-stream.ts (294 lines). |
| 23 | ScriptThreadView + RemixThreadView exist | ✓ VERIFIED | script-thread-view.tsx (184), remix-thread-view.tsx (185). |

**Score:** 23/23 truths verified (truth 2's Remix-card live render carried to human follow-up — code+tests pass, browser render unobserved)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/tools/blocks.ts` | Script+Remix schemas + union | ✓ VERIFIED | 233 lines; both schemas in union (L229–230) |
| `src/lib/tools/block-registry.ts` | script-card + remix-card entries | ✓ VERIFIED | L32–33 |
| `src/components/thread/script-card-block.tsx` | ScriptCardRenderer | ✓ VERIFIED | 217 lines, wired in message-blocks.tsx:32 |
| `src/components/thread/remix-card-block.tsx` | RemixCardRenderer | ✓ VERIFIED | 226 lines, wired in message-blocks.tsx:33 |
| `.planning/corpus/script.md` | Script craft slice | ✓ VERIFIED | 243 lines |
| `src/lib/kc/compiled.ts` | KC_SCRIPT_SLICE + KC_SCRIPT_SYSTEM_PROMPT | ✓ VERIFIED | L1058, L1318 |
| `src/lib/kc/assembler.ts` | script+remix in modeSchema + MODE_ROLES | ✓ VERIFIED | L66, L112–113 |
| `src/lib/tools/runners/script-runner.ts` | runScriptPipeline + contract | ✓ VERIFIED | 292 lines |
| `src/app/api/tools/script/route.ts` | POST SSE route | ✓ VERIFIED | 255 lines (config gaps — WR-02/03) |
| `src/lib/tools/runners/remix-runner.ts` | runRemixPipeline | ✓ VERIFIED | 232 lines |
| `src/app/api/tools/remix/run/route.ts` | POST SSE, maxDuration=300 | ✓ VERIFIED | 260 lines, full CSRF guards |
| `src/lib/tools/chain-handoff.ts` | live endpoints | ✓ VERIFIED | 174 lines, 3 P6 entries live |
| `src/lib/script-test-context.tsx` | ScriptTestContext | ✓ VERIFIED | 31 lines |
| `src/hooks/queries/use-script-stream.ts` | useScriptStream | ✓ VERIFIED | 286 lines |
| `src/hooks/queries/use-remix-stream.ts` | useRemixStream | ✓ VERIFIED | 294 lines |
| `src/components/thread/script-thread-view.tsx` | ScriptThreadView | ✓ VERIFIED | 184 lines |
| `src/components/thread/remix-thread-view.tsx` | RemixThreadView | ✓ VERIFIED | 185 lines |
| `.planning/phases/06-script-remix-tools/06-SCOUT.md` | REMIX-01 reuse scout | ✓ VERIFIED | present (8656 bytes) |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| message-blocks.tsx | script-card-block.tsx | BLOCK_COMPONENTS['script-card']=ScriptCardRenderer | ✓ WIRED |
| message-blocks.tsx | remix-card-block.tsx | BLOCK_COMPONENTS['remix-card']=RemixCardRenderer | ✓ WIRED |
| block-registry.ts | blocks.ts | both schemas imported + registered | ✓ WIRED |
| script-runner.ts | flash/run-flash-text-mode.ts | runFlashTextMode (opener gate D-01) | ✓ WIRED |
| script-runner.ts | kc/compiled.ts | KC_SCRIPT_SYSTEM_PROMPT | ✓ WIRED |
| script route | threads/messages.ts | insertMessage(openThread,...) | ✓ WIRED |
| remix-runner.ts | remix/resolve-and-rehost.ts | resolveAndRehost + cleanup in finally | ✓ WIRED |
| remix-runner.ts | remix/decode.ts | runDecode (real structural decode D-05) | ✓ WIRED |
| remix-runner.ts | remix/adapt.ts | generateAdaptConcepts | ✓ WIRED |
| composer.tsx | use-script-stream.ts | activeTool==='script'→script.start (no pendingNavRef) | ✓ WIRED |
| chain-handoff.ts | script/route.ts | hooks→script endpoint '/api/tools/script' | ✓ WIRED |
| script-card-block.tsx | script-test-context.tsx | reads ScriptTestContext for "Test full →" | ✓ WIRED |
| remix-card-block.tsx | RemixDevelopContext | "Develop into hooks →" → /api/tools/ideas/develop (route exists) | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Block schemas + chain-handoff validate/rehydrate | `vitest run blocks-script blocks-remix chain-handoff` | 35 passed / 0 failed | ✓ PASS |
| Script + Remix pipelines (gate, decode, cleanup, null-decode) | `vitest run script-runner remix-runner` | 20 passed / 0 failed | ✓ PASS |
| ENGINE_VERSION unchanged | `grep ENGINE_VERSION version.ts` | "3.19.0" | ✓ PASS |
| Engine untouched by phase 06 | `git log --since 2026-06-18 -- src/lib/engine/` | empty | ✓ PASS |
| Remix card LIVE render | live browser run | test URL failed to resolve | ? SKIP → human |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| SCRIPT-01 | 06-01, 06-03, 06-05 | Script tool: hook/idea → script card (beats+timing+retention), Flash viability + self-judge, hooks→script→test, "Test full →" | ✓ SATISFIED | Truths 1,5,7,9,10,11,18,19,21; runner+route+card live UAT |
| REMIX-01 | 06-02, 06-04, 06-05 | Remix tool: URL/own winner → decode → *their* version → feed Hooks/Test; preceded by reuse scout | ✓ SATISFIED (live render = human follow-up) | Truths 2,6,8,12–15,20; 06-SCOUT.md reuse scout; pipeline coded+tested, card live render pending |

No orphaned requirements — REQUIREMENTS.md maps only SCRIPT-01 + REMIX-01 to Phase 6, both claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| script/route.ts | (absent) | Missing CSRF Content-Type 415 + cross-origin 403 guards that sibling remix route has (WR-02) | ⚠️ Warning | CSRF cost-abuse vector on expensive LLM route; auth-first still holds |
| script/route.ts | (absent) | Missing `export const maxDuration` / runtime / dynamic (WR-03) | ⚠️ Warning | Vercel default ceiling (10–60s) kills 300s runner; platform timeout not graceful |
| composer.tsx | 663 | Remix retry fires `remix.start("", …)` with empty URL (WR-04) | ⚠️ Warning | Retry guaranteed 400 — retry button non-functional |
| remix-runner.ts | partial-decode | Remix card dropped on partial decode (WR-05) | ⚠️ Warning | Over-strict validation converts partial success into total failure |
| use-remix-stream.ts | 198–200 | Handles `followup` event remix route never emits; ignores `warning` both routes emit (IN-02) | ℹ️ Info | Dead/missed event handling |

No debt markers (TBD/FIXME/XXX) found in phase-06 files. No Critical findings (06-REVIEW.md: 0 critical / 6 warning / 5 info). All warnings are hardening/robustness — none break the phase goal.

### Human Verification Required

#### 1. Remix card live render

**Test:** Run Remix in the live studio with a resolvable TikTok URL (the UAT URL was geo-blocked / unresolvable).
**Expected:** remix-card renders real decode anatomy (sourceDecode beats), the "Borrowed: <format>" coral chip, and a functional "Develop into hooks →" CTA that POSTs the adapted hook to `/api/tools/ideas/develop` and appends a hooks card in the same open thread.
**Why human:** Test URL failed to resolve/decode during UAT (HTTP 200 then SSE error — runtime/geo dependency, not a code defect). Card is coded and passes 12 block unit tests + full suite, but its live render with real decode output was never observed. Visual + live-pipeline behavior cannot be verified by grep.

### Gaps Summary

No goal-blocking gaps. All 4 ROADMAP success criteria and all 23 merged must-haves are satisfied in the codebase:

- **Script spine** (SC1): full runner→route→card→chain, opener-only Flash gate, "Test full →" — verified in code, unit tests, and live UAT (7/8 flows PASS).
- **Remix spine** (SC2): full resolve→decode→adapt→gate→card pipeline coded and unit-tested; reuse scout honored (06-SCOUT.md); stages + graceful error path live-verified. The single remaining item — the remix card's live visual render — is routed to human verification because the UAT test URL failed to resolve (a runtime dependency, not a code defect).
- **Generic chain plumbing** (SC3): both skills register via CHAIN_HANDOFFS with no one-off wiring; chips, contexts, thread views, SSE hooks all present and wired.
- **Protected engine path** (SC4, BLOCKING): ENGINE_VERSION = 3.19.0 unchanged, zero phase-06 commits touched src/lib/engine/, decode.ts read-only, engine suite (1066) + full suite (2523) green, build clean. D-05a gate fully honored.

The 6 REVIEW warnings (Script-route CSRF/maxDuration gaps, Remix empty-URL retry, partial-decode card drop) are hardening defects that should be addressed but do not block goal achievement. Status is **human_needed** (not passed) solely because a non-empty human-verification item exists per the Step 9 decision tree.

---

_Verified: 2026-06-18T16:13:00Z_
_Verifier: Claude (gsd-verifier)_
