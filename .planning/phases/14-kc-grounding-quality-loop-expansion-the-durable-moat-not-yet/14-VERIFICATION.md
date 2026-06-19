---
phase: 14-kc-grounding-quality-loop-expansion-the-durable-moat-not-yet
verified: 2026-06-20T01:45:00Z
status: human_needed
score: 9/9 must-have truths verified
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
human_verification:
  - test: "LIVE slop-vs-strong recalibration on the resolved-niche production path"
    expected: "Run DASHSCOPE_API_KEY=… npx vitest run src/lib/engine/flash/__tests__/slop-vs-strong.test.ts — LIVE half resolves a non-placeholder niche via resolveNicheKey('fitness'), ≥5 known-slop land < MIXED_THRESHOLD, ≥5 known-strong land ≥ STRONG_THRESHOLD, strongStops - slopStops >= 2. Record observed stop-counts and confirm 6/3 thresholds hold (or adjust + update drift gate in lockstep)."
    why_human: "DASHSCOPE_API_KEY is absent in the execution + verification environment. The LIVE half is describe.skipIf-gated; the gate's real discrimination on actual model output cannot be exercised programmatically here. Pure-half margin (slop 1 stop / strong 8 stops) + drift gate pass, but the production distribution is unvalidated."
  - test: "Live rubric-critic verdict quality on known-slop vs known-strong items (KCQ-02/04/07)"
    expected: "With a key, fire critiqueAgainstRubric against ≥3 known-slop and ≥3 known-strong Ideas/Hooks; slop → pass:false with a sensible predictedFailureMode, strong → pass:true with null. Confirms the Value Bar rubric prompt actually discriminates on real Flash output, not just that the wiring/fail-safe/coercion are correct."
    why_human: "No DASHSCOPE_API_KEY. Unit tests prove wiring, fail-safe, strict coercion, and parallelism — but the CONTENT quality of the rubric judgment on live model output is unexercised."
  - test: "Voice + 26-exemplar grounding produce on-voice, non-templated output end-to-end"
    expected: "Generate Ideas/Hooks for a creator with a writing_voice_sample under a real BUNDLE_CHAR_CAP load; output sounds like the creator (voice survived the cap) and hooks are pattern-inspired by the 26 exemplars WITHOUT emitting any template verbatim or any [placeholder]/[SLUG] leak."
    why_human: "Generation quality / voice fidelity / no-verbatim-leak are subjective, model-dependent behaviors that grep + unit tests cannot confirm. Requires a live generation read."
  - test: "Idea/hook card surface — visual + interaction (KCQ-09 + KCQ-04)"
    expected: "On a rendered idea card: 'Made for you — {whyItFits}' reads as plain-language micro-copy (muted, no coral, scroll-quote still leads). The 'If this could flop →' affordance is hidden on the face, reachable inside the disclosure, warning-toned, and reveals predictedFailureMode only on the second drill. Hook card shows the flop reveal but no made-for-you line."
    why_human: "Visual appearance, tone (positive-but-honest), and the two-stage opt-in interaction are UX qualities verifiable only by a human looking at the rendered card."
  - test: "Operator-facing review decision on the 6 code-review warnings (WR-01..WR-06)"
    expected: "Human decides whether the 6 standing warnings from 14-REVIEW.md are acceptable for this phase or must be closed before proceeding. Most material: WR-02/WR-03 (resolver mis-route / non-resolution on common short free-text niche inputs) and WR-01 (critic-only infra failure silently drops Strong candidates with no warning)."
    why_human: "These are quality/robustness regressions, not goal-blockers — the phase goal truths are achieved for the canonical inputs. Whether the residual edge-case quality risk is acceptable is a product/operator judgment, not a programmatic pass/fail."
---

# Phase 14: KC Grounding & Quality-Loop Expansion — Verification Report

**Phase Goal:** The moat levers — generate→critique→regenerate (best-of-N rubric critique), flop-prediction, SIM-rank verification, niche-blind fix, runtime trope/specificity enforce, voice calibration, owner hook-template grounding, field-level legibility (inline rationale + opt-in flop reveal), honesty-spine (delete fake citations).
**Verified:** 2026-06-20T01:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All must-have truths were drawn from the four PLAN frontmatter `must_haves` blocks (the contract for this phase — the markdown ROADMAP has no `success_criteria` array). All 9 distinct truths verified against the actual codebase, not SUMMARY claims.

| #   | Truth (source plan)                                                                                                                                  | Status     | Evidence |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 1   | Sub-slug / free-text niche gets niche-instantiated personas, not the generic fallback (14-01)                                                        | ✓ VERIFIED | `niche-resolver.ts` exists, `resolveNicheKey` exported with correct 5-step order (null→direct→sub-slug→contains→null); wired at panel build in `ideas-runner.ts:284` + `hooks-runner.ts:313`; 20 unit assertions pass incl. `personal-finance`→education, `fitness`→fitness, prose→null. |
| 2   | The text SIM gate can say no — slop lands Weak, known-great lands Strong, real margin (14-01)                                                        | ✓ VERIFIED (pure) / ? LIVE | `flash-aggregate.ts` STRONG=6/MIXED=3 named constants; combined gate `band === "Weak" continue` in both runners; pure-half margin asserted (slop 1 / strong 8, ≥3). LIVE half DASHSCOPE-gated → human verify (item 1). |
| 3   | General (null-niche) path byte-identical — STABLE_FLASH_SYSTEM_PROMPT + 61/0 baseline untouched (14-01)                                              | ✓ VERIFIED | persona-registry diff purely additive (read-only `NICHE_INSTANTIATION_KEYS` + `isNicheInstantiationKey` only, :372,:375); `run-flash-text-mode.ts`/`version.ts` not in phase-14 diff; ENGINE_VERSION last touched 2026-06-11. |
| 4   | Ideas+Hooks over-generate then parallel rubric-critic; only candidates that pass rubric AND clear SIM band ship (14-02)                              | ✓ VERIFIED | `rubric-critic.ts` `critiqueAgainstRubric` called inside per-candidate `Promise.all` (ideas:326-333, hooks:354-361); combined gate `if(band==="Weak")continue; if(!verdict.pass)continue` (ideas:349-350, hooks:375-376). |
| 5   | When EVERY candidate fails, regenerate once — never an unbounded serial loop (14-02)                                                                 | ✓ VERIFIED | Bounded single regen: `if(survivors.length===0){ secondBatch; if(>0) gatePass }` (ideas:405-410, hooks:416-419); best-of-n.test.ts asserts exactly 2 generation calls. |
| 6   | Each surviving card carries predictedFailureMode, null on clean pass (14-02)                                                                        | ✓ VERIFIED | `blocks.ts:99,144` `z.string().nullable().optional()` on both schemas; carried onto card props (ideas:375, hooks:396); critic returns null on pass via `coerceVerdict`. |
| 7   | Latency ~1x — over-generation + critique parallel (Promise.all), never serial (14-02)                                                               | ✓ VERIFIED | SIM + critic are a `Promise.all` pair per candidate inside the candidate `Promise.all`; no `await critiqueAgainstRubric` in a loop (SUMMARY grep 0; code confirms). Fail-safe try/catch wraps full critic body, returns FAIL_SAFE — never throws into gather. |
| 8   | Voice survives the BUNDLE_CHAR_CAP drop + explicit write-in-this-voice instruction (14-03)                                                           | ✓ VERIFIED | `assembler.ts:118-122` voice precedes wins/flops/platform for idea/hooks/script/remix (not tail); chat excluded; `profile-role-map.ts:157` "Write in this voice…" directive retains "do NOT reuse specific content" + `<<<USER_CONTENT>>>` fence. |
| 9   | 26 owner hook templates ground Hooks as silent private-reasoning exemplar layer — never verbatim, no pills; recompiles byte-stable + bumps KC_GEN_VERSION (14-03) | ✓ VERIFIED | `hooks.md:346` OWNER EXEMPLAR PATTERNS block, framed "PRIVATE REASONING ONLY", ":357 NEVER emit any of these verbatim"; `compiled.ts` carries the block (KC_HOOKS_SLICE); re-run of regen-kc.ts produces ZERO diff (byte-stable); `kc-version.ts:26` KC_GEN_VERSION = gen.1.1.0; ENGINE_VERSION unchanged. |
| 10  | Fake §N citation pills gone — no decorative render/tooltip map, real-code + board-frame pills intact (14-03)                                         | ✓ VERIFIED | `grep CORPUS_SECTIONS|insertCitationMarkers|§cite ExpertChatThread.tsx` = 0; board-frame `VALID_FRAMES|parseFrameTag` = 6 (intact). |
| 11  | Inline made-for-you rationale (whyItFits) on the card; scroll-quote still leads; fixed renderer only (14-04)                                         | ✓ VERIFIED | `idea-card-block.tsx:152-154` "Made for you — {whyItFits}" inline micro-copy; scroll-quote leads (test asserts); 0 `dangerouslySetInnerHTML`. |
| 12  | predictedFailureMode available on-demand via opt-in drill — never on face, never silent-only (14-04)                                                | ✓ VERIFIED | idea:254-272 + hook:217-235 gated by `predictedFailureMode != null` + `flopOpen` state, inside disclosure, `--color-warning`; renders nothing when null/absent. |

**Score:** 9/9 distinct must-have truths verified at the code level (truths 2 + 4-12 fully; truth 2's LIVE discrimination routed to human verify — its pure-half + wiring are verified).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/engine/wave3/niche-resolver.ts` | resolveNicheKey free-text→key/null | ✓ VERIFIED | 98 lines, pure/deterministic, isolated; exports resolveNicheKey; wired into both runners. |
| `src/lib/engine/wave3/__tests__/niche-resolver.test.ts` | resolver unit coverage | ✓ VERIFIED | 20 assertions pass (direct/sub-slug/contains/prose→null/purity). |
| `src/lib/engine/flash/rubric-critic.ts` | critiqueAgainstRubric → {pass, predictedFailureMode} | ✓ VERIFIED | Parallel, fail-safe (try/catch→FAIL_SAFE), strict coercion, hard isolation (qwen/client + utils/strip + flash-prompts types only); 5 tests pass. |
| `src/lib/tools/blocks.ts` | predictedFailureMode optional on both card schemas | ✓ VERIFIED | `.nullable().optional()` :99 + :144; whyItFits required on idea :83. |
| `.planning/corpus/hooks.md` | 26-template private-reasoning exemplar block | ✓ VERIFIED | OWNER EXEMPLAR PATTERNS block, never-emit framing. |
| `src/lib/kc/kc-version.ts` | bumped KC_GEN_VERSION minor | ✓ VERIFIED | gen.1.0.0 → gen.1.1.0; ENGINE_VERSION untouched. |
| `src/lib/kc/compiled.ts` | regenerated byte-stable | ✓ VERIFIED | regen-kc.ts re-run → no diff. |
| `src/components/command-bar/ExpertChatThread.tsx` | citation-pill render removed | ✓ VERIFIED | 0 refs; board-frame + real-code intact. |
| `src/components/thread/idea-card-block.tsx` | inline whyItFits + opt-in flop reveal | ✓ VERIFIED | Both present; warning-toned; 9 render tests pass. |
| `src/components/thread/hook-card-block.tsx` | opt-in flop reveal (no whyItFits) | ✓ VERIFIED | Flop reveal present; no made-for-you line (correct per plan). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| ideas-runner.ts | resolveNicheKey | panel niche = resolveNicheKey(profileRow.niche_primary) | ✓ WIRED | :284 |
| hooks-runner.ts | resolveNicheKey | panel niche = resolveNicheKey(...) | ✓ WIRED | :313 |
| ideas-runner.ts | critiqueAgainstRubric | parallel pair in Promise.all + combined gate | ✓ WIRED | :332 + gate :348-350 |
| hooks-runner.ts | critiqueAgainstRubric | parallel pair in Promise.all + combined gate | ✓ WIRED | :360 + gate :374-376 |
| hooks.md | compiled.ts | regen-kc.ts recompile of KC_HOOKS_SLICE | ✓ WIRED | OWNER EXEMPLAR in compiled.ts; byte-stable |
| idea-card-block.tsx | predictedFailureMode | drill reveal rendered only when present | ✓ WIRED | :254-272 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| idea-card-block | whyItFits | runner sets from `groundingLine` (GROUND-03), required prop | Yes (runner-populated) | ✓ FLOWING |
| idea/hook-card | predictedFailureMode | critic verdict via runner → card props | Yes (live critic; null on pass) | ✓ FLOWING (code-level); content quality → human verify (item 2) |
| SIM panel | niche | resolveNicheKey(profileRow.niche_primary) | Yes for canonical inputs; ⚠ short bare terms fall through (WR-03) | ⚠ FLOWING with edge-case gaps |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| niche-resolver unit suite | `vitest run niche-resolver.test.ts` | 20 passed | ✓ PASS |
| rubric-critic fail-safe + coercion | `vitest run rubric-critic.test.ts` | 5 passed | ✓ PASS |
| best-of-N combined gate + bounded regen | `vitest run best-of-n.test.ts` | 5 passed | ✓ PASS |
| idea-card render (KCQ-09/04) | `vitest run idea-card-block.test.tsx` | 9 passed | ✓ PASS |
| voice non-tail + cap-drop survival | `vitest run assembler.test.ts` | 14 passed | ✓ PASS |
| compiled.ts byte-stability | `regen-kc.ts && git diff` | no diff | ✓ PASS |
| production build | `npm run build` | succeeded | ✓ PASS |
| LIVE gate discrimination | (DASHSCOPE-gated) | skipped — no key | ? SKIP → human (item 1) |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` declared or implied by this phase (text-path / corpus / UI work, not a migration/tooling probe phase). Step 7c: SKIPPED (no probes declared).

### Requirements Coverage

Every requirement ID declared in PLAN frontmatter cross-referenced against REQUIREMENTS.md. KCQ-03 is mapped to Phase 14 in REQUIREMENTS.md but is NOT in any plan's `requirements` field — confirmed DEFERRED, not orphaned (see note below).

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| KCQ-01 | 14-01 | Live-profile grounding — gate tests with real profile, not cold-start | ✓ SATISFIED | resolveNicheKey feeds real profileRow.niche_primary into the panel (same niche-layer fix as KCQ-06). |
| KCQ-02 | 14-02 | Generate→critique→regenerate, best-of-N w/ rubric | ✓ SATISFIED | rubric-critic + combined gate + bounded single regen in both runners. |
| KCQ-04 | 14-02, 14-04 | "Will this flop?" adversarial pass | ✓ SATISFIED | predictedFailureMode from shared critic call; opt-in card reveal. |
| KCQ-05 | 14-01 | SIM-rank verification loop (formalize/extend Flash gate) | ✓ SATISFIED | gate floor `band !== "Weak"` formalized + drift-locked (STRONG===6/MIXED===3). |
| KCQ-06 | 14-01 | SIM niche-blind fix (wire persona-registry into text Flash path) | ✓ SATISFIED | resolveNicheKey at runner layer resolves free-text/sub-slug → instantiation key. |
| KCQ-07 | 14-02 | Runtime trope-injection + specificity auto-reject | ✓ SATISFIED | Prohibition 6 trope clause + Test B non-fakeable in the critic prompt; gate rejects. |
| KCQ-08 | 14-03 | Voice calibration (extends N1 voice sample) | ✓ SATISFIED | voice non-tail in MODE_ROLES + "Write in this voice" directive. |
| KCQ-09 | 14-04 | Field-level legibility (thin surface) | ✓ SATISFIED | inline "Made for you — {whyItFits}"; full surface deferred to P12 (D-04, declared scope). |
| HONESTY-01 | 14-03 | Delete fake §N citation pills | ✓ SATISFIED | All citation-pill code removed; board-frame + real-code intact. |
| KCQ-03 | (none — REQUIREMENTS only) | Real-exemplar RAG + N2 cited-research | ⊘ DEFERRED (not a gap) | ROADMAP:430 "KCQ-03 is DEFERRED to a future grounding phase (D-15) — out of P14 scope"; REQUIREMENTS still `[ ]` unchecked. Not claimed by any plan. Correctly out of scope. |

### Scope Boundaries — Honored (verified, not flagged as gaps)

- **No ENGINE_VERSION bump (3.19.0):** verified — version.ts not in phase-14 diff; persona-registry edit purely additive read-only export.
- **KC_GEN_VERSION bumped (gen.1.0.0 → gen.1.1.0):** verified.
- **"Real-exemplar" grounding = owner's 26 templates as silent exemplar layer (NOT live RAG):** verified — exemplar block in hooks.md, private-reasoning-only framing, per 14-03 / D-16/17/18.
- **Full field-level legibility deferred to P12 (D-04):** honored — 14-04 ships only the thin whyItFits micro-copy + opt-in flop reveal.
- **best-of-N rubric critique + flop pass scoped to Ideas + Hooks only (D-09):** verified — wiring present only in ideas-runner + hooks-runner.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| niche-resolver.ts | 95 | `void NICHE_INSTANTIATION_KEYS` no-op (IN-01) | ℹ️ Info | Unused-import suppression; cosmetic. |
| ideas-runner.ts / hooks-runner.ts | 293 / 320 | `void resolvedWeights` dead-compute every run (WR-05) | ⚠️ Warning | Dead computation; maintainability/intent smell, not a goal-blocker. |
| niche-resolver.ts | 74-92 | substring contains pass mis-routes on cross-niche token collision (WR-02) | ⚠️ Warning | `"history of fashion"`→education not fashion-style; mis-grounds the whole generation for those inputs. Canonical cases unaffected. |
| niche-resolver.ts | 64-92 | bare common terms (`finance`, `tech`, `food`) fall through to null (WR-03) | ⚠️ Warning | Short single-word free-text — likely the most common production input — silently hits the generic path, partially defeating the discrimination this phase restores. |
| ideas-runner.ts | 332,348-350 | critic-only infra failure silently drops Strong candidates, no warning (WR-01) | ⚠️ Warning | Under backend pressure (shared DashScope, maxRetries:0) a rate-limited critic can zero out a SIM-Strong generation with no diagnostic. |
| ideas-runner.ts | 345,421 | FLYWHEEL pin can fall back to firstSimPersonas (a critic-rejected candidate) (WR-04) | ⚠️ Warning | Pollutes the flywheel's predicted-signature substrate when zero candidates pass. |
| ExpertChatThread.tsx | 57-60 | reducedMotion captured once, no change listener (WR-06) | ⚠️ Warning | a11y correctness gap; unrelated to phase goal levers. |

No TBD/FIXME/XXX debt markers in any phase-14-modified file (debt-marker gate: PASS). No critical/blocker anti-patterns. 6 warnings are robustness/quality regressions documented in 14-REVIEW.md (0 critical), not goal-blockers.

### Human Verification Required

See frontmatter `human_verification` for the 5 items in detail. Summary:

1. **LIVE slop-vs-strong recalibration** — gate discrimination on real model output (no DASHSCOPE_API_KEY in env).
2. **Live rubric-critic verdict quality** — does the Value Bar prompt actually judge slop vs strong on real Flash output.
3. **Voice + 26-exemplar end-to-end** — on-voice output, no verbatim/placeholder leak (subjective generation quality).
4. **Card surface visual + interaction** — Made-for-you micro-copy + two-stage opt-in flop reveal tone/UX.
5. **Operator decision on the 6 review warnings** — especially WR-02/WR-03 (resolver edge-case mis-route / non-resolution) and WR-01 (silent Strong-drop on critic infra failure).

### Gaps Summary

**No blocking gaps.** All 9 phase requirements are SATISFIED in the codebase; all 9/9 distinct must-have truths are verified at the code level; all declared scope boundaries are honored; 53 phase-14 tests pass; build is green; compiled.ts is byte-stable; KCQ-03 is correctly deferred (not orphaned).

Status is **human_needed** (not passed) for two reasons, per the Step 9 decision tree (human items take priority over a clean score):

1. **Environment-gated LIVE validation.** The DASHSCOPE-dependent paths — the slop-vs-strong gate's real discrimination and the rubric-critic's verdict quality — cannot be exercised without a key. The wiring, fail-safe, parallelism, gate logic, and pure-half margin are all verified; the live-model quality of the moat levers is not. This is the phase's load-bearing value claim ("the gate can say no" / "rightness over discipline") and must be confirmed by a key-holder before the moat is considered proven.
2. **Six standing review warnings** warranting an operator decision. The most material — WR-02/WR-03 — sit on the very resolver this phase introduced: short, single-word free-text niche values (the most common production input) and cross-niche token collisions can still mis-route or fall through to the generic path. The canonical inputs (`personal-finance`, `fitness`, sub-slugs) resolve correctly and are tested, so the goal truth holds — but the residual edge-case quality risk is a product judgment, not a programmatic pass/fail.

---

_Verified: 2026-06-20T01:45:00Z_
_Verifier: Claude (gsd-verifier)_
