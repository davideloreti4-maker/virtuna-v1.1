# Plan 01-04 — coupled aggregator closeout — SUMMARY

> 2026-06-11. Wave 4. The COUPLED set (F22/F44 + F24 + F34 + hero F37/F41 + F42 persist) — all
> touch `calculateConfidence` / the final `aggregateScores` assembly, so they shipped together in
> one commit. Run inline (human-in-the-loop, D-00); audits were code-only (live runs deferred to
> 01-05's batched verification per Davide's choice). Commit `01b08752`, ENGINE_VERSION → 3.18.0.

## Co-review checkpoint decisions (Task 2, D-00)

- **Stage-10 fate (F34):** **drop dead Check #1, keep #2/#3/#4.** Audit surfaced that the plan's
  premise ("a critique whose only live check died") was inaccurate — `deriveCritique` runs FOUR
  checks and only Check #1 (`|gemini − behavioral|`) died with D-R1; #2 (score-vs-factors), #3
  (historical-flop), #4 (thin-signal) are all live + free deterministic TS. F22 also moves
  apollo-vs-fold agreement into `calculateConfidence`, so re-basing Check #1 on the same basis
  would double-count. Decision: remove Check #1 (+ its `SIGNAL_GAP_THRESHOLD`/`PENALTY_SIGNAL_DISAGREEMENT`
  constants), keep the 3 orthogonal checks.
- **verdict_line wording:** **reuse the board `bandLabel` vocabulary.** gated → "Don't post yet";
  else by `overall_score`: ≥70 "High potential", 40–69 "Solid contender", <40 "Needs work"
  (mirrors `components/board/verdict/verdict-derive.ts:25-29`; duplicated in-engine to avoid a
  component dependency).

## Shipped (commit 01b08752)

### F22/F44 — confidence rebased on apollo-vs-FOLD (the trust anchor, fixed at the source)
`calculateConfidence` agreement term (0–0.4) now compares `apollo_score` vs `fold_audience_score`
(two independent signals) instead of `apollo_score` vs `behavioral_score` (both from the same
Apollo call → self-agreement that pinned the term at its 0.4 max on every healthy run). **Fold-
unavailable fallback** (the structural trap flagged in the audit): when `foldOn` is false
(text/tiktok_url mode or a fold failure), it falls back to the prior apollo-vs-behavioral basis
rather than agreeing against a `fold_audience_score=0` (which would crater confidence on every
fold-less run). HARD-03 dual-failure LOW floor preserved. The board's "· likely lo–hi" band
(`confidenceRange`, F44) is derived from this same number, so the source fix fixes the band.

### F24 — component_scores dropped from the video output contract
The 7 component-derived fields in `feature_vector` (hookEffectiveness…originality) are now `null`
on video (`input_mode !== "text"`), populated in text/tiktok_url mode. `behavioral_score` is
computed separately (directly off `deepseek.component_scores`) and is **unchanged**, so the
text/tiktok_url fallback blend still works. Verified the live `/analyze` board is unaffected: the
only board consumer of `behavioral_score` (`impact-score.tsx` via `ResultsPanel`/`TestCreationFlow`)
has **no mount site** — it's dead/exported-only; the live board uses the redesigned frames +
`verdict-derive`, which never read it. `feature_vector` component fields otherwise feed only the
dormant ML path. FeatureVector type: 7 fields `number → number | null`.

### F34 — Stage-10 Check #1 dropped (per co-review)
Removed the `|gemini − behavioral|` signal-agreement check + its constants. Checks #2/#3/#4 kept.
File header + comments updated.

### F37/F41 — first-class hero block
`aggregateScores` now assembles a `hero` block LAST (from the FINAL post-critique result, so
verdict_line + go_no_go reflect the post-critique `anti_virality_gated` state):
```
hero: {
  verdict_line: string;          // gated → "Don't post yet"; else bandLabel(overall_score)
  ceiling: string | null;        // deepseek.ceiling_capper
  the_one_fix: string | null;    // deepseek.rewrites[0].variant
  go_no_go: "go" | "no-go";      // no-go when anti_virality_gated
  post_window: OptimalPostWindow | null;  // result.optimal_post_window
}
```
Each field individually nullable + non-throwing — ceiling/the_one_fix degrade to null together
when Apollo is unavailable; verdict_line + go_no_go always resolve. New `HeroBlock` interface +
optional `hero?` field on PredictionResult (back-compat with pre-3.18 rows).

### F42 — hero persisted to permalink
`persistApolloToVariants` (route.ts) extended with `merged.hero = hero` + the early-return guard
now includes `!hero`. **No migration** — rides the `variants` JSONB bag. `engagement_range` was
ALREADY persisted there (route.ts:249), so the hero block is the only NEW persist. V4 `.eq("user_id")`
access control preserved on read+write (T-04-04).

### Version
ENGINE_VERSION 3.17.0 → 3.18.0 + change-history comment (output-shape + confidence change →
cache invalidation, D-23). version.test.ts updated.

## Verification

- `npx vitest run aggregator.test.ts stage10-critique.test.ts version.test.ts` → **83 green** (incl.
  new F22/F24/F37 + hero-gated + Stage-10-drop tests).
- Full `npm test` → **1903 passed, 0 failed** (178 files). tsc `--noEmit` → **12 errors = baseline**
  (pre-existing `views`/EngagementRange + prediction-result fixture cast; none from this work).
- **Deferred (per Davide, batched into 01-05):** live smoke run + the F42 permalink-reload UAT
  (login-gated). Owned as HARD checkboxes in 01-05 Task 4.

## Next: 01-05 (Wave 5, depends on this)

Fold robustness (F18/F20/F19) + partial_analysis single-signal honesty + dead-tail prune
(F12/F35/F43) + F7 rehost-delete race + ENG-04 honesty LOCK tests + latency measure/reclaim +
ENGINE_VERSION → 3.19.0. Includes the deferred live phase-gate rig run + F42 UAT.

> ENG-06 (D-12 deep 3-call prompt I/O co-review = "chunk B") remains OUT — its own owning open
> plan, must land before phase close (tracked in STATE + 01-03-SUMMARY).
