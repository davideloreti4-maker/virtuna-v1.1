---
phase: 13-proactive-numen-ambient-initiated-expansion-the-ambient-audi
verified: 2026-06-20T22:07:30Z
status: human_needed
score: 24/24 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Sticky presence felt on scroll (both branches) — open a thread with generated cards (390px mobile + desktop); the presence strip sits at the top of the thread column and stays sticky as the ledger scrolls; on empty/centered home (Branch B) it still shows the roster + idle copy with NO reaction (the presence never hides)."
    expected: "Presence strip visible + sticky atop the thread column; idle roster (no reaction) on empty home; never hidden."
    why_human: "Sticky positioning, visual layout, and 'always felt' are visual/scroll behaviors grep cannot verify; the homeThreadMode + Branch B mounts are wired (composer.tsx L845, L1220) but the felt result needs a device."
  - test: "Moving spotlight follows scroll WITH PIXEL PRECISION — scroll the card ledger and confirm the 'reacting to: {concept}' subject + dot toning track the card actually under the focus line (not just crossing markers in card order)."
    expected: "Spotlight subject + dot toning follow the visible card under the focus line, with no flicker and zero network requests on scroll."
    why_human: "KNOWN LIMITATION (IN-03 / 13-04 Known Limitation): the data-ambient-card markers are sr-only zero-height rows stacked at the top of the scroll region (composer.tsx L871), NOT co-located with the real card DOM (which renders inside the thread views, out of the 13-04 files_modified scope). The IntersectionObserver therefore measures collapsed markers, so continuous scroll-spy precision is degraded to 'crosses markers in card order'. A human must judge whether the moving-spotlight-on-scroll promise (D-02) is acceptably met or whether the additive follow-up (tag real card roots) is required before this reads as 'the touch'."
  - test: "Tap-priority + simultaneous Lens-open — tap a card; the spotlight holds on that card (not yanked away by scroll) until you tap another card or deliberately scroll past ~64px; the SAME tap also opens the AudienceLens bottom sheet."
    expected: "Tapped card stays focused (sticky); the same tap opens the one AudienceLens scoped to that card (focus + Lens both run)."
    why_human: "Capture-phase tap seam (onClickCapture, composer.tsx L867) + tap-sticky release-on-scroll (use-ambient-focus.ts L180) are wired and unit-tested in the pure core, but the real capture-vs-bubble interaction with the shipped LensTrigger and the 64px scroll release are runtime/touch behaviors."
  - test: "Type-to-room end-to-end — expand the presence, type a thought, submit; 'Reading the room…' shows, then the subject becomes your thought + the honesty caption 'A quick SIM read on your {audience} — not a full Test.' appears, and the AudienceLens opens scoped to the thought. Exactly ONE request to /api/tools/react fires on submit (none on keystroke)."
    expected: "One POST /api/tools/react on explicit submit; honest loading + caption; spotlight becomes the typed thought; Lens opens scoped to it. WATCH: after submitting, then tapping/scrolling to a DIFFERENT card — does the spotlight re-point, or stay stuck on the typed thought? (See WR-01 below.)"
    why_human: "The full network + render flow needs a live server; critically, WR-01 (typedFocus never cleared in ambient-presence.tsx) means after one type-to-room submit the local typedFocus override may keep the spotlight frozen on the typed thought, so a subsequent tap/scroll may NOT re-point the presence — a partial D-02 'moving spotlight' violation that only manifests at runtime."
  - test: "One-Lens continuity — confirm the per-card tap, the presence cue (when focused), and a type-to-room result ALL open the SAME AudienceLens bottom sheet (no second/forked Lens, no restyle)."
    expected: "All three doors open the identical shipped AudienceLens scoped to their concept."
    why_human: "Wiring verified (AudienceLens mounted in ambient-presence.tsx L471-481 + the card LensTriggers unchanged; LensTrigger un-forked since 09-04) but visual identity of the three entry points is a UX judgment."
  - test: "Reduced-motion hard-stop + coral-as-signal-only — with the OS reduce-motion setting on, the dot pulse + cross-fade hard-stop, content stays legible, and the screen reader still announces the roster + subject. Confirm coral appears ONLY on the worst-cluster dot / inherited Rewrite CTA — never on the presence container/border/title/subject/input."
    expected: "Motion hard-stops under reduce; sr-only mirror present; coral only on the single worst-scroll dot (data-driven) and inherited CTAs, never on chrome."
    why_human: "reducedMotion gating (ambient-presence.tsx L304) + the worst-slot coral (L163) are wired, but motion-stop, legibility, screen-reader output, and the absence of stray coral are visual/AT behaviors requiring a real device + OS setting."
---

# Phase 13: Ambient Numen (AMBIENT-01) Verification Report

**Phase Goal:** Turn "tested against YOUR audience" from a summoned tap (P9's per-card Lens cue) into an always-felt, reacting, addressable presence — the 10 calibrated personas become a persistent companion the creator can see, watch react to what they make, and type to. This phase delivers the AMBIENT layer only (the Initiated half was split to Phase 17).
**Verified:** 2026-06-20T22:07:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal is **achieved in the codebase**. All three ambient doors — per-card reaction at rest, the persistent spotlight presence, and type-to-room — are built, substantive, wired into the composer, and read **real already-emitted reaction data** (verified at the descriptor layer, not just SUMMARY claims). The "extend, don't duplicate" mandate (D-05/D-06) is honored by construction: `LensTrigger.tsx` is un-forked (last touched 09-04) and `AudienceLens` is the single shipped component every door opens. ENGINE_VERSION is held at 3.19.0 (determinism gate intact). The honesty spine (one labeled concept, idle at rest, never fabricate, degrade to silence) is implemented as a render constraint throughout.

Status is **human_needed** (not `passed`) because the phase's defining value — "always-felt," a "moving spotlight," tap-priority, and type-to-room — are visual/real-time/touch behaviors that cannot be verified programmatically, and because two issues (one a partial D-02 runtime gap, one a self-documented scroll-spy precision limitation) require a human to judge whether they undercut the "moving spotlight" promise or are acceptable additive follow-ups. The 13-04 PLAN deliberately deferred a 6-point device check to end-of-phase; those items are surfaced below.

### Observable Truths

| # | Truth (source) | Status | Evidence |
|---|----------------|--------|----------|
| 1 | (13-01) POST /api/tools/react returns a real Flash reaction `{ fraction, scrollQuote }` scoped to the active audience | ✓ VERIFIED | `route.ts` L62-138: auth→Zod→profile→server-resolved audience→`buildReactionPanel`→`runFlashTextMode`→`aggregateFlash`→`{ fraction, scrollQuote }`. Route test 7/7 green. |
| 2 | (13-01) Reaction route resolves its niche panel via `buildReactionPanel` (not a hand-built generic panel) | ✓ VERIFIED | `route.ts` L117 calls `buildReactionPanel(profileRow, audience)`; `build-reaction-panel.ts` reproduces the runners' niche/repaint byte-identically. Route test L146-172 asserts `panel.niche` non-null for a real niche. |
| 3 | (13-01) A typed thought in a real niche returns a discriminating band (not "all Mixed" niche-blind) | ✓ VERIFIED | `resolveNicheKey` runs unmocked in the route test; L171 `expect(panel.niche).not.toBeNull()`. Pitfall 2 closed. |
| 4 | (13-01) Both runners build their Flash panel byte-identically via the shared helper; ENGINE_VERSION 3.19.0 | ✓ VERIFIED | `ideas-runner`/`hooks-runner` consume `buildReactionPanel` (inline `Object.fromEntries(audience.personas.map` removed). `version.ts:127` = "3.19.0"; version.test.ts green. |
| 5 | (13-02) Every generated card (idea/hook/script/remix) shows its room reacting AT REST — stop fraction + ribbon — without a tap | ✓ VERIFIED | `CardReactionAtRest` rendered inside LensTrigger on all 4 cards (grep: hook=3, idea=3, script=2, remix=2; hook card L152 between LensTrigger L134 and blockquote L153). |
| 6 | (13-02) Resting reaction reuses each card's already-emitted fraction — zero new model calls | ✓ VERIFIED | `card-reaction-at-rest.tsx` parses `{ fraction }` only; no fetch/model call. Card data sourced from `cardDescriptor` (composer.tsx L797-811, real props). |
| 7 | (13-02) Unparseable/no-signal fraction → collapses to plain child (silence, no "0/0") | ✓ VERIFIED | `card-reaction-at-rest.tsx` L45-47 `if (!parsed) return null`; mirrors `cardScrollQuoteReactions([])` LensTrigger collapse. Test asserts null render on bad/empty input. |
| 8 | (13-02) Tapping the promoted cue still opens the SAME shipped AudienceLens scoped to that card (D-05) | ✓ VERIFIED | `flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)}` unchanged on all 4 cards; LensTrigger un-forked (09-04). |
| 9 | (13-02) Positive reaction renders cream via `var(--color-foreground)`, never `#FF7F50` | ✓ VERIFIED | Fill = `var(--color-foreground)` (L71), track `var(--color-foreground-muted)`. Grep `#FF7F50`/`255,127,80` = 0 in net-new files. |
| 10 | (13-03) Persistent thin persona-cloud strip — one cream-alpha dot per calibrated persona — always visible (D-01) | ✓ VERIFIED | `ambient-presence.tsx` L141-184 derives one `<circle>` per persona (L298-314); cream-alpha fill (L168/172). |
| 11 | (13-03) When focused, strip shows `reacting to: {concept}` subject + tones dots to ONE concept; NEVER aggregates (D-02) | ✓ VERIFIED | `effectiveFocus` is ONE concept (L116); `flatPersonas` from that one concept (L127-133); subject L320-331; subject ABSENT at idle. No blend path exists. |
| 12 | (13-03) At idle, roster dots at calm uniform cream + idle copy, NO reaction (D-01 honesty) | ✓ VERIFIED | L170-173: `focus===null` → all dots `rgba(236,231,222,0.45)`, no verdict, no coral; idle copy L354-361. |
| 13 | (13-03) Typing + submit fires /api/tools/react ONCE (explicit submit only), shows "Reading the room…", sets subject + tones dots (D-04) | ✓ VERIFIED | `submitThought` L217-246: one `fetch('/api/tools/react')` on explicit submit (button L397 / Enter L384, not keystroke); loading aria-live L407-416; sets `typedFocus` + `onFocusChange`. Test asserts no-fetch-on-keystroke. |
| 14 | (13-03) All motion gates on reducedMotion + sr-only roster/subject mirror always present | ✓ VERIFIED | `<animate>` gated `{!reducedMotion && ...}` L304; sr-only `role="status"` mirror always rendered L454-466. |
| 15 | (13-03) Opening the presence opens the SAME shipped AudienceLens scoped to the in-focus concept (D-05) | ✓ VERIFIED | Shipped `AudienceLens` mounted L471-481 with `conceptText={effectiveFocus.conceptText}`, `flatPersonas` from the one concept. No fork/restyle. |
| 16 | (13-04) Presence mounted sticky at top of the thread scroll region, always felt as the ledger scrolls (D-01) | ⚠ VERIFIED (code) / human (felt) | Mounted FIRST child of `composer-thread-region`, `className="sticky top-0 z-[1]"` (composer.tsx L840-850). Felt-on-scroll needs device (see human items). |
| 17 | (13-04) Presence NEVER hides: renders idle in Branch B (empty home) too (D-01) | ✓ VERIFIED | Second mount L1220-1224 with `focus={null}` in the centered/empty-home branch. |
| 18 | (13-04) Scroll-spy re-focuses to the card crossing the focus line; zero new model calls on re-focus (D-02/D-03) | ⚠ PARTIAL (see WR/IN-03) | IntersectionObserver rooted on the region (use-ambient-focus.ts L189-213, `root: el`, rootMargin `-48px 0px -60% 0px`); reads descriptors, no model call. BUT markers are sr-only zero-height rows (composer.tsx L871), so scroll-spy precision is degraded to "crosses markers in card order" — see IN-03. |
| 19 | (13-04) Explicit tap focuses immediately (capture-phase, before LensTrigger opens) and wins over scroll-spy momentarily (D-02, Pitfall 4) | ✓ VERIFIED | `onClickCapture={() => focusByTap(d.id)}` (L867) on the data-ambient-card wrapper; `focusByScroll` no-ops while `tapId` sticky (use-ambient-focus.ts L138); release on 64px scroll (L180). Pure core tested 14/14. |
| 20 | (13-04) Default focus on thread load is the latest/last card (D-02) | ✓ VERIFIED | `resolveAmbientFocus` L87 returns `descriptors[length-1]` when nothing selected. Test asserts default-latest. |
| 21 | (13-04) A type-to-room reaction sets the spotlight subject to the typed thought (D-04 into the same focus state) | ⚠ PARTIAL (see WR-01) | `onFocusChange={focusByThought}` wired (composer.tsx L849); `focusByThought` sets `thought` (use-ambient-focus.ts L143). BUT `AmbientPresence` keeps a second `typedFocus` copy never cleared (WR-01) → after one submit the spotlight can stick on the typed thought even after a tap/scroll. |
| 22 | (13-04) Presence persists across the open-thread singleton without a fresh-thread assumption (Pitfall 5 — awareness only) | ✓ VERIFIED | Hook re-defaults to latest on descriptor change; no `newSimulation/resetThread/clearThread` logic added (grep clean). Awareness-only honored. |
| 23 | (cross-cut) ENGINE_VERSION held at 3.19.0; no new model calls except one explicit type-to-room submit | ✓ VERIFIED | `version.ts:127` = "3.19.0"; only model call is the server react route's single Flash call; per-card + spotlight re-focus read emitted data. |
| 24 | (cross-cut, D-05/D-06) LensTrigger NOT forked; all three doors open the ONE AudienceLens | ✓ VERIFIED | `git log 1c2e4413..HEAD -- LensTrigger.tsx` empty (last touched 09-04). Single `AudienceLens.tsx`; no `AmbientLens`/duplicate. |

**Score:** 24/24 truths verified in code (2 carry runtime/visual caveats: #18 IN-03 scroll-spy precision, #21 WR-01 stuck spotlight — flagged for human judgment, not coded as failures).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/engine/flash/build-reaction-panel.ts` | Shared niche/repaint helper, exports `buildReactionPanel` | ✓ VERIFIED | 82 lines; byte-identical lift; consumed by both runners + the route. |
| `src/app/api/tools/react/route.ts` | POST type-to-room route, exports `POST` | ✓ VERIFIED | 138 lines; auth-first, Zod, server-resolved audience, 401/400/502, `{ fraction, scrollQuote }`. WIRED to `runFlashTextMode` + `buildReactionPanel`. |
| `src/components/audience-lens/card-reaction-at-rest.tsx` | Resting readout, exports `CardReactionAtRest` | ✓ VERIFIED | 76 lines; parse-or-null degrade, cream ribbon. WIRED into 4 card LensTriggers. |
| `src/components/audience-lens/ambient-presence.tsx` | Strip + spotlight + type-to-room, exports `AmbientPresence` | ✓ VERIFIED | 484 lines; idle/focus/type-to-room states, sr-only mirror, opens shipped Lens. WIRED into composer. |
| `src/components/audience-lens/ambient-presence-types.ts` | Focus contract, exports `AmbientFocus`, `AmbientPresenceProps` | ✓ VERIFIED | 55 lines; consumed by component + hook. |
| `src/components/app/home/use-ambient-focus.ts` | Focus hook, exports `useAmbientFocus` (+ pure `resolveAmbientFocus`) | ✓ VERIFIED | 244 lines; pure decision core + IO wiring. WIRED into composer (L830). |

All 6 net-new source artifacts + 5 test files exist, are substantive (no stubs), and are wired. No MISSING, no STUB, no ORPHANED.

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `react/route.ts` | `run-flash-text-mode.ts` | `runFlashTextMode(text, framing, panel, audienceRepaint)` | ✓ WIRED (route.ts L125) |
| `react/route.ts` | `build-reaction-panel.ts` | `buildReactionPanel(profileRow, audience)` | ✓ WIRED (route.ts L117) |
| `ideas-runner.ts` / `hooks-runner.ts` | `build-reaction-panel.ts` | shared helper replacing inline construction | ✓ WIRED (inline removed, helper called) |
| `hook/idea/script/remix-card-block.tsx` | `card-reaction-at-rest.tsx` | `CardReactionAtRest` inside `<LensTrigger>` above blockquote | ✓ WIRED (all 4) |
| `ambient-presence.tsx` | `react/route.ts` | `fetch POST` on explicit type-to-room submit | ✓ WIRED (L224) |
| `ambient-presence.tsx` | `AudienceLens.tsx` | renders `<AudienceLens open … flatPersonas conceptText>` | ✓ WIRED (L471-481) |
| `ambient-presence.tsx` | `flat-card-reactions.ts` | `cardScrollQuoteReactions(fraction, scrollQuote)` → flatPersonas + dot toning | ✓ WIRED (L130) |
| `composer.tsx` | `ambient-presence.tsx` | `<AmbientPresence>` sticky in thread region + idle in Branch B | ✓ WIRED (L845 + L1220) |
| `composer.tsx` | `use-ambient-focus.ts` | `useAmbientFocus(ambientDescriptors)` drives focus | ✓ WIRED (L830) |
| `composer.tsx` (data-ambient-card wrapper) | `use-ambient-focus.ts` (focusByTap) | `onClickCapture` fires focusByTap before LensTrigger opens | ✓ WIRED (L867, capture phase, no fork) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AmbientPresence` (spotlight) | `focus` prop / `effectiveFocus` | `ambientFocus` ← `useAmbientFocus(ambientDescriptors)` ← `cardDescriptor(block.props)` real fraction/scrollQuote | Yes — reads emitted card data | ✓ FLOWING |
| `CardReactionAtRest` (ribbon) | `fraction` prop | each card block's already-emitted `fraction` | Yes | ✓ FLOWING |
| Type-to-room result | `typedFocus` | `POST /api/tools/react` → real Flash `{ fraction, scrollQuote }` | Yes — real SIM call | ✓ FLOWING |
| `data-ambient-card` descriptors | `ambientDescriptors` | active tool's persisted + streaming card blocks (composer.tsx L812-823), null-skip on missing data | Yes (honest skip on empty) | ✓ FLOWING |

No HOLLOW props, no hardcoded-empty data sources. `cardDescriptor` returns `null` when concept/fraction aren't real strings (L804) — honest, not a stub.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 13 own suites green | `vitest run` (6 phase suites) | 63 passed / 0 failed | ✓ PASS |
| ENGINE_VERSION determinism | `vitest run version.test.ts` | 3 passed | ✓ PASS |
| Build succeeds | `npm run build` | exit 0, "Compiled successfully in 12.9s" | ✓ PASS |
| Pre-existing failures isolated to Phase-12 csrfGuard | `vitest run audiences/route.test.ts` | 3 failed (DELETE→415), 16 passed — matches documented Phase-12 ancestor, NOT a Phase 13 file | ✓ PASS (out of scope, confirmed) |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| AMBIENT-01 | 13-01, 13-02, 13-03, 13-04 (all four declare `requirements: [AMBIENT-01]`) | The living, always-present audience — persistent docked presence + per-card reactions at rest + type-to-room + live spotlight on ONE in-focus concept (never aggregated), reusing P9's primitive | ✓ SATISFIED | All 24 truths above; REQUIREMENTS.md:151 marked `[x]`; maps to Phase 13 (REQUIREMENTS.md:295). |

**No orphaned requirements.** REQUIREMENTS.md maps ONLY AMBIENT-01 to Phase 13; PROACTIVE-01/02 are explicitly split to Phase 17 (REQUIREMENTS.md:296, ROADMAP.md:36) — correctly out of scope per the 13-CONTEXT.md narrowing. Every plan's `requirements` field is accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ambient-presence.tsx` | 102 (via `route.ts` L102) | (route) `createOpenThreadLazy` get-or-create writes an open-thread row on a "read-shaped, ephemeral" endpoint | ⚠️ Warning (WR-02) | Contradicts the route's documented "NO persistence / ephemeral" guarantee; user-scoped (not a security hole). Does not block AMBIENT-01. |
| `ambient-presence.tsx` | 116, 236 | `typedFocus` never cleared (dual source-of-truth with parent `focus`) | ⚠️ Warning (WR-01) | After one type-to-room submit, the local override can freeze the spotlight on the typed thought, so a later tap/scroll may not re-point — partial D-02 "moving spotlight" violation at runtime. |
| `ambient-presence.tsx` | 181 | `r: r * clamp01(1)` — dead no-op arithmetic | ℹ️ Info (IN-02) | Obscures intent; no behavioral effect. |
| `ambient-presence.tsx` | 168, 172 | hardcoded `rgba(236, 231, 222, …)` cream literal bypasses `--color-foreground` token | ℹ️ Info (IN-01) | Correct today (matches `--color-cream-primary`); future token drift risk. |
| `composer.tsx` | 854-875 | `data-ambient-card` markers are zero-height `sr-only` rows, not on the real card DOM | ℹ️ Info (IN-03) | Scroll-spy measures collapsed markers, not visible cards → continuous scroll-spy precision degraded to "crosses markers in card order". Self-documented in 13-04 Known Limitation; tap/default-latest/type-to-room ARE wired. Needs human judgment on whether D-02 "moving spotlight" reads acceptably. |

No 🛑 blockers. No debt markers (TBD/FIXME/XXX) in any net-new file. No TODO/HACK/PLACEHOLDER. No legacy coral. No client-side Qwen. (Findings mirror 13-REVIEW.md: 0 Critical / 4 Warning / 3 Info; WR-03/WR-04 are additional in-flight/error-state lifecycle robustness warnings in the same file, not goal-blocking.)

### Human Verification Required

See the `human_verification` frontmatter (6 items) for the full device-test checklist — these are the visual/real-time/touch behaviors that define the phase's value and cannot be verified by grep, merged with the `<human-check>` block the 13-04 PLAN deliberately deferred to end-of-phase. The two highest-leverage judgments:

1. **Moving spotlight precision on scroll (IN-03):** the scroll-spy markers are sr-only rows, not the real card DOM, so the spotlight "crosses markers in card order" rather than tracking the visible card under the focus line. Decide: acceptable additive follow-up, or required before "the touch" reads true?
2. **Spotlight re-points after type-to-room (WR-01):** verify on a device whether, after submitting a typed thought, tapping/scrolling to a different card re-points the presence — or whether it stays frozen on the typed thought (the dual `typedFocus`/`focus` divergence).

### Gaps Summary

**No coded gaps that block the AMBIENT-01 goal.** Every must-have is wired, substantive, and reads real data; the determinism gate (ENGINE_VERSION 3.19.0) and the "extend, don't duplicate" mandate (LensTrigger un-forked, one AudienceLens) are honored; the honesty spine is implemented as a render constraint. All 4 plans' own test suites are green (63/63) and the build passes.

The phase is **human_needed**, not `passed`, for two reasons: (a) the phase's defining qualities — "always-felt," moving spotlight, tap-priority, type-to-room, reduced-motion, one-Lens continuity — are inherently visual/real-time and were deferred to an end-of-phase device check; and (b) two surfaced issues (WR-01 stuck-spotlight-after-type, IN-03 scroll-spy-on-sr-only-markers) are partial D-02 "moving spotlight" gaps whose severity can only be judged at runtime. Neither is a falsification of the goal in code — both are bounded, self-documented (IN-03) or single-line-fixable (WR-01) follow-ups — but a human must confirm they do not undercut the "moving spotlight" promise before the phase is declared complete. If the device check passes and the owner accepts WR-01/IN-03 as additive follow-ups, this converts cleanly to `passed`.

---

_Verified: 2026-06-20T22:07:30Z_
_Verifier: Claude (gsd-verifier)_
