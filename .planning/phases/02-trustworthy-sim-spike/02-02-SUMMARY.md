---
phase: 02-trustworthy-sim-spike
plan: 02
subsystem: testing
tags: [spike, audience, enrich-signature, qwen, apify, determinism, provenance, throwaway]

# Dependency graph
requires:
  - phase: 02-01
    provides: signature-equality.ts (signatureEqual/normalizeSignature) + Directional-by-rule tiering predicate
  - phase: 00-engine-rework
    provides: AudienceSignature substrate (enrichSignature 2-model bake, prepareWatchUrl, ApifyScrapingProvider)
provides:
  - "Live make-or-break evidence for the trustworthy-SIM-without-calibration verdict (TRUST-03)"
  - "DETERMINISM finding: live thinking-mode synthesis (qwen-3.7-plus, temp 0 + seed) is NON-DETERMINISTIC across bakes of identical frozen input — matched watch counts (A=3 B=3), so NOT the Pitfall-2 transport/INCONCLUSIVE case"
  - "PROVENANCE finding: GREEN — 10/10 reactors grounded on all four bakes; source=user note surfaces in evidence; ungrounded distinguishable"
  - "TIERING finding: GREEN — no-calibration General SIM resolves Directional by rule"
  - "Two production bug fixes surfaced by the live run (subtitleLinks:null schema, synth 60s→120s timeout)"
affects: [02-03, 03, trustworthy-sim, calibration, determinism-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Throwaway live probe (D-05): scrape-once → freeze secret-scrubbed fixture → re-bake offline ×N (no per-bake re-scrape)"
    - "Deep token-URL scrub + path-reporting defense-in-depth guard (T-02-03/T-02-05)"

key-files:
  created:
    - scripts/spike/chat-bundle-adapter.ts
    - scripts/spike/trustworthy-sim-probe.ts
    - scripts/spike/fixtures/socials-bundle.fixture.json
  modified:
    - src/lib/schemas/competitor.ts
    - src/lib/schemas/__tests__/competitor.test.ts
    - src/lib/audience/enrich-signature.ts

key-decisions:
  - "Live thinking-mode synth is non-deterministic across bakes — recorded as a genuine finding (matched watch counts rule out transport); the go/no-go verdict is 02-03's call, not rendered here"
  - "Scrape ONCE then re-bake from the frozen fixture (D-01a) — every retry/iteration re-baked offline, holding Apify to the single make-or-break scrape"
  - "Fixed two latent PRODUCTION bugs the live run exposed (subtitleLinks:null, synth timeout) rather than working around them in throwaway code"

patterns-established:
  - "Spike probe re-bakes from a frozen, secret-scrubbed fixture so cost stays bounded across debugging iterations"

requirements-completed: [TRUST-03]

# Metrics
duration: ~40min (Task 3 continuation session)
completed: 2026-06-26
---

# Phase 02 Plan 02: Trustworthy-SIM Live Probe Summary

**Live make-or-break probe RUN: thinking-mode synthesis is NON-DETERMINISTIC across bakes (temp 0 + seed insufficient; matched watch counts → genuine, not transport), while PROVENANCE (10/10 grounded + source=user surfaced) and TIERING (Directional-by-rule) both pass — verdict deferred to 02-03.**

## Performance

- **Duration:** ~40 min (Task 3 continuation; Tasks 1-2 committed in a prior session)
- **Completed:** 2026-06-26
- **Tasks:** 3 (Task 3 = the live cost-gated run; Tasks 1-2 pre-committed)
- **Files modified:** 6 (3 spike throwaway + 3 production: schema, schema test, enrich-signature)

## Accomplishments
- Ran the live ×2 double-bake against a frozen Apify scrape of the DEFAULT control SIM (`khaby.lame`, no handle override, per human approval) with real Qwen.
- Captured the structured determinism / provenance / tiering / budget evidence block + the machine-readable `PROBE_JSON` line for 02-03's verdict (pasted verbatim below).
- Froze a secret-scrubbed `socials-bundle.fixture.json` (0 `token=`, no APIFY_TOKEN) and re-baked from it on every iteration (D-01a honored).
- Surfaced and fixed two latent PRODUCTION bugs the live run exposed (schema null-drop + too-tight synth timeout).

## CAPTURED PROBE EVIDENCE (verbatim — for 02-03's verdict)

Final clean run (`pnpm tsx scripts/spike/trustworthy-sim-probe.ts`, re-baked from frozen fixture, exit 0):

```
══════════════ PROBE EVIDENCE ══════════════

# DETERMINISM
  socials: NON-DETERMINISTIC (A !== B)
    videos_watched: A=3 B=3
    full-diff (un-normalized) differing paths: creator_persona.content_description, creator_persona.context, creator_persona.format_signature, audience.temperature_mix.cold, audience.temperature_mix.warm, audience.temperature_mix.hot, audience.interest_tags.2, audience.interest_tags.3, audience.interest_tags.4, audience.interest_tags.5, audience.interest_tags.6, audience.what_resonates, audience.what_falls_flat, audience.persona_weights.fyp, audience.persona_weights.niche, audience.persona_weights.loyalist, audience.persona_weights.cross_niche, audience.personas.0.share, audience.personas.0.reaction_frame, audience.personas.0.evidence, audience.personas.1.share, audience.personas.1.reaction_frame, audience.personas.1.evidence, audience.personas.2.reaction_frame, audience.personas.2.evidence, audience.personas.3.share, audience.personas.3.reaction_frame, audience.personas.3.evidence, audience.personas.4.share, audience.personas.4.reaction_frame, audience.personas.4.evidence, audience.personas.5.share, audience.personas.5.reaction_frame, audience.personas.5.evidence, audience.personas.6.share, audience.personas.6.reaction_frame, audience.personas.6.evidence, audience.personas.7.share, audience.personas.7.reaction_frame, audience.personas.7.evidence, audience.personas.8.share, audience.personas.8.reaction_frame, audience.personas.8.evidence, audience.personas.9.reaction_frame, audience.personas.9.evidence, summary, provenance.scraped_at
    signatureEqual (post-normalization): false
  general: NON-DETERMINISTIC (A !== B)
    full-diff differing paths: creator_persona.context, creator_persona.writing_style_sample, creator_persona.format_signature, audience.temperature_mix.cold, audience.temperature_mix.warm, audience.temperature_mix.hot, audience.interest_tags.3, audience.interest_tags.4, audience.what_falls_flat, audience.persona_weights.fyp, audience.persona_weights.niche, audience.personas.0.share, audience.personas.0.reaction_frame, audience.personas.0.evidence, audience.personas.1.share, audience.personas.1.reaction_frame, audience.personas.1.evidence, audience.personas.2.share, audience.personas.2.reaction_frame, audience.personas.2.evidence, audience.personas.3.share, audience.personas.3.reaction_frame, audience.personas.3.evidence, audience.personas.4.share, audience.personas.4.reaction_frame, audience.personas.4.evidence, audience.personas.5.share, audience.personas.5.reaction_frame, audience.personas.5.evidence, audience.personas.6.share, audience.personas.6.reaction_frame, audience.personas.6.evidence, audience.personas.7.share, audience.personas.7.reaction_frame, audience.personas.7.evidence, audience.personas.8.share, audience.personas.8.reaction_frame, audience.personas.8.evidence, audience.personas.9.share, audience.personas.9.reaction_frame, audience.personas.9.evidence, summary, provenance.scraped_at

# PROVENANCE
  socials A: 10/10 reactors grounded (≥1 evidence quote)
  socials B: 10/10 grounded
  general A: 10/10 grounded
  general B: 10/10 grounded
  ungrounded distinguishable: yes (empty-evidence predicate flags ungrounded reactors)
  source=user note surfaced in a persona's evidence: true
  general provenance.custom_context: {"source":"user","note":"audience is busy founders; reward terse, contrarian, data-backed takes"}

# TIERING
  no-calibration General SIM → Directional (expected Directional): OK

# BUDGET
  Qwen calls: 10 (target ~10) | Apify calls: 0 (target 1)
  est cost: < $0.50 (D-01b) — ~10 Qwen @ omni/synth + 0 Apify scrape
════════════════════════════════════════════
```

```
PROBE_JSON {"determinism":{"socials":"NON-DETERMINISTIC (A !== B)","socialsEqual":false,"watchedMismatch":false,"rawDiff":["creator_persona.content_description","creator_persona.context","creator_persona.format_signature","audience.temperature_mix.cold","audience.temperature_mix.warm","audience.temperature_mix.hot","audience.interest_tags.2","audience.interest_tags.3","audience.interest_tags.4","audience.interest_tags.5","audience.interest_tags.6","audience.what_resonates","audience.what_falls_flat","audience.persona_weights.fyp","audience.persona_weights.niche","audience.persona_weights.loyalist","audience.persona_weights.cross_niche","audience.personas.0.share","audience.personas.0.reaction_frame","audience.personas.0.evidence","audience.personas.1.share","audience.personas.1.reaction_frame","audience.personas.1.evidence","audience.personas.2.reaction_frame","audience.personas.2.evidence","audience.personas.3.share","audience.personas.3.reaction_frame","audience.personas.3.evidence","audience.personas.4.share","audience.personas.4.reaction_frame","audience.personas.4.evidence","audience.personas.5.share","audience.personas.5.reaction_frame","audience.personas.5.evidence","audience.personas.6.share","audience.personas.6.reaction_frame","audience.personas.6.evidence","audience.personas.7.share","audience.personas.7.reaction_frame","audience.personas.7.evidence","audience.personas.8.share","audience.personas.8.reaction_frame","audience.personas.8.evidence","audience.personas.9.reaction_frame","audience.personas.9.evidence","summary","provenance.scraped_at"],"general":false,"generalDiff":["creator_persona.context","creator_persona.writing_style_sample","creator_persona.format_signature","audience.temperature_mix.cold","audience.temperature_mix.warm","audience.temperature_mix.hot","audience.interest_tags.3","audience.interest_tags.4","audience.what_falls_flat","audience.persona_weights.fyp","audience.persona_weights.niche","audience.personas.0.share","audience.personas.0.reaction_frame","audience.personas.0.evidence","audience.personas.1.share","audience.personas.1.reaction_frame","audience.personas.1.evidence","audience.personas.2.share","audience.personas.2.reaction_frame","audience.personas.2.evidence","audience.personas.3.share","audience.personas.3.reaction_frame","audience.personas.3.evidence","audience.personas.4.share","audience.personas.4.reaction_frame","audience.personas.4.evidence","audience.personas.5.share","audience.personas.5.reaction_frame","audience.personas.5.evidence","audience.personas.6.share","audience.personas.6.reaction_frame","audience.personas.6.evidence","audience.personas.7.share","audience.personas.7.reaction_frame","audience.personas.7.evidence","audience.personas.8.share","audience.personas.8.reaction_frame","audience.personas.8.evidence","audience.personas.9.share","audience.personas.9.reaction_frame","audience.personas.9.evidence","summary","provenance.scraped_at"]},"provenance":{"socialsA":{"grounded":10,"ungrounded":0,"total":10},"socialsB":{"grounded":10,"ungrounded":0,"total":10},"generalA":{"grounded":10,"ungrounded":0,"total":10},"generalB":{"grounded":10,"ungrounded":0,"total":10},"noteSurfaced":true},"tiering":{"generalTier":"Directional","generalTierOk":true},"budget":{"qwenCalls":10,"apifyCalls":0}}
```

### Interpretation notes for 02-03 (evidence only — NOT the verdict)

- **DETERMINISM = genuine NON-DETERMINISTIC, not the Pitfall-2 escape hatch.** `videos_watched` MATCHED (A=3, B=3 → `watchedMismatch:false`), so the divergence is NOT transport / graceful-omni-null. The thinking-mode synth (qwen-3.7-plus, `enable_thinking:true`, `thinking_budget:2000`) produced different load-bearing fields (personas, weights, temperature_mix, summary, evidence) across two bakes of the IDENTICAL frozen input despite `temperature:0` + fixed `seed`. Per the Pitfall-2 rule this was the conclusive case, so **no extra re-run was spent** (instruction: don't keep spending; the matched watch count already rules out the INCONCLUSIVE branch).
- **`signatureEqual` (02-01's KEEP gate) returns `false`** on the live pair — the gate correctly distinguishes the two non-identical bakes (it is working; the inputs to it are genuinely different).
- **Material for the verdict (left to 02-03):** production bakes ONCE and FREEZES the signature on the row — it never re-bakes the same input — so cross-bake LLM non-determinism may be a theoretical rather than operational concern. 02-03 should weigh: (a) NO-GO on the determinism dimension, vs (b) accept-with-mitigation (bake-once-freeze makes re-bake moot; or disable `enable_thinking` for synth; or field-tolerance in the equality rule). PROVENANCE + TIERING are unambiguously GREEN.
- **PROVENANCE = GREEN:** 10/10 reactors grounded on all four bakes; the source=user custom-context note (`"contrarian"` probe token) surfaced in a General-proto persona's evidence; `provenance.custom_context = {source:"user", note}` tagged.
- **TIERING = GREEN:** no-calibration General SIM → `Directional` by rule.

## Task Commits

1. **Task 1: chat-bundle-adapter.ts** — `5c856a28` (feat, prior session)
2. **Task 2: trustworthy-sim-probe.ts + fixture writer** — `13d6e1fc` (feat, prior session)
3. **Task 3: RUN live probe + capture evidence** — this session (evidence above; fixture committed via auto-wip `3b36c1d3`)

Deviation commits (this session): `dbbcf46c`, `34c69266`, `aa783456`, `543eac2b` (see below).
Auto-wip daemon snapshot (on-branch, linear, harmless): `3b36c1d3` (committed the token-free fixture + probe WIP).

## Files Created/Modified
- `scripts/spike/fixtures/socials-bundle.fixture.json` — frozen secret-scrubbed khaby.lame scrape (3 videos, 0 `token=`) — THROWAWAY (02-03 deletes)
- `scripts/spike/trustworthy-sim-probe.ts` — deep token-URL scrub + path-reporting guard + retry-on-abort — THROWAWAY
- `src/lib/schemas/competitor.ts` — `subtitleLinks` now `.nullable()` (PRODUCTION fix)
- `src/lib/schemas/__tests__/competitor.test.ts` — regression test for `subtitleLinks: null`
- `src/lib/audience/enrich-signature.ts` — `SYNTH_TIMEOUT_MS` 60s → 120s (PRODUCTION fix)

## Decisions Made
- Recorded determinism as a genuine NON-DETERMINISTIC finding (matched watch counts); deferred the go/no-go verdict to 02-03 per the plan's task boundary.
- Fixed the two PRODUCTION bugs the live run exposed rather than masking them in throwaway code — both are latent calibration-path failures that would have bitten production.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] clockworks `subtitleLinks: null` dropped ALL videos of subtitle-less profiles**
- **Found during:** Task 3 (first live scrape of `khaby.lame`)
- **Issue:** `apifyVideoSchema.videoMeta.subtitleLinks` was `.optional()` only; clockworks returns `null` (not `undefined`) for wordless videos. khaby.lame (famously silent) returned `subtitleLinks: null` on every video → every video failed Zod → empty bundle → no socials control to bake. Latent in production: ANY subtitle-less profile silently lost ALL videos during calibration.
- **Fix:** Added `.nullable()`; `remapClockworksVideo` already coalesces `?? []`. Added a regression test.
- **Files modified:** `src/lib/schemas/competitor.ts`, `src/lib/schemas/__tests__/competitor.test.ts`
- **Verification:** schema + scraping suites green (81 tests); live re-scrape then yielded 3 videos.
- **Committed in:** `dbbcf46c`

**2. [Rule 1 - Bug] Synth 60s timeout aborted thinking-mode bakes systematically**
- **Found during:** Task 3 (live double-bake)
- **Issue:** The qwen-3.7-plus thinking-mode synthesis empirically runs ~60-90s for a full socials bake; `SYNTH_TIMEOUT_MS=60_000` aborted it reliably ("Request was aborted" on every second bake). Latent in production: slower calibration synths were failing silently.
- **Fix:** `SYNTH_TIMEOUT_MS` 60s → 120s (covers observed p95 + headroom; fast calls unaffected).
- **Files modified:** `src/lib/audience/enrich-signature.ts`
- **Verification:** audience suite green (135 tests); the live double-bake then completed both bakes (exit 0).
- **Committed in:** `aa783456`

**3. [Rule 3 - Blocking] Secret scrub missed `profile.avatarUrl` token; no diagnostics**
- **Found during:** Task 3 (first two fixture-write attempts)
- **Issue:** The field-list scrub covered `mediaUrl/videoUrl/subtitleUrl` but not `profile.avatarUrl` (TikTok signed avatar URL carried a token-ish query param). The defense-in-depth `/token=/i` guard correctly REFUSED to write (no leak) but blocked the run with no indication of which field.
- **Fix:** Added `deepScrubTokenUrls` (walk every string; strip the query of any absolute http(s) URL whose query mentions a token-ish param; leave non-URL captions untouched) + a guard that reports the offending JSON path + host only (never the value, T-02-05).
- **Files modified:** `scripts/spike/trustworthy-sim-probe.ts`
- **Verification:** fixture wrote with 0 `token=`, no APIFY_TOKEN; only residual query string is the no-auth TikTok-CDN subtitle `tiktokLink` (params `a, bti, bt, ft, mime_type, rc, l, btag` — CDN routing, no secret).
- **Committed in:** `34c69266` (+ broadened in `543eac2b`)

**4. [Rule 3 - Blocking] Probe retry-on-abort wrapper (throwaway resilience)**
- **Found during:** Task 3
- **Issue:** Belt-and-suspenders for the transient synth abort alongside the prod timeout widen, so a single slow call doesn't kill the whole make-or-break run.
- **Fix:** `bakeWithRetry` — up to 3 attempts on an abort message; a timeout abort is transport, not a determinism signal.
- **Files modified:** `scripts/spike/trustworthy-sim-probe.ts`
- **Committed in:** `543eac2b`

---

**Total deviations:** 4 auto-fixed (2 Rule-1 production bugs, 2 Rule-3 blocking). 2 production fixes carry regression coverage / suite-green verification.
**Impact on plan:** No scope creep — all four were prerequisites to running the user-pinned `khaby.lame` make-or-break probe at all. The two production fixes are genuine latent-bug remediations the live run uncovered.

## Issues Encountered
- **Auto-wip daemon active in this worktree** (per CLAUDE.md hazard note): commit `3b36c1d3 chore(auto-wip)` snapshotted the fixture + probe mid-work. It is on-branch (`milestone/numen-gsi`), linear, and harmless — it captured the token-free fixture. No co-option / force-push remediation was needed; subsequent proper commits sit cleanly on top.
- **Cost:** the FINAL clean run used exactly the plan budget (10 Qwen + 0 Apify, re-baked from the frozen fixture). Across the full debugging session there were ~3 Apify scrapes (the schema/scrub bugs aborted the first two before a fixture was frozen) + extra omni/synth on aborted bakes — estimated total still in the ~$0.30-0.50 range the human approved. Once the fixture froze, every iteration was Apify-free (D-01a).

## User Setup Required
None — `DASHSCOPE_API_KEY` + `APIFY_TOKEN` already present in `.env.local`.

## Next Phase Readiness
- **02-03 (verdict + spike close):** has the verbatim evidence above to render the go/no-go. Headline: determinism leg RED (genuine, matched watch counts), provenance + tiering GREEN. The bake-once-freeze production reality is flagged as material for an accept-with-mitigation path vs a hard NO-GO.
- **Throwaway scaffolding LEFT INTACT** (`scripts/spike/*` + fixture) for 02-03 to quote then delete (D-05). Do NOT delete here.
- **Two production fixes (`dbbcf46c`, `aa783456`)** are real and should survive the spike teardown (they are NOT throwaway — they live in `src/`).

## Self-Check: PASSED

All claimed files present on disk; all 7 referenced commits found in git history (`5c856a28`, `13d6e1fc`, `dbbcf46c`, `34c69266`, `3b36c1d3`, `aa783456`, `543eac2b`).
