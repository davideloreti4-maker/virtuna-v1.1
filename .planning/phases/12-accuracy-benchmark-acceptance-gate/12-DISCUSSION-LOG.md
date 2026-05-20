# Phase 12: Accuracy Benchmark + Acceptance Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 12-Accuracy Benchmark + Acceptance Gate
**Areas discussed:** Benchmark run strategy, Version flip timing, Failure response plan, Sign-off checklist, Corpus baseline comparison

---

## Benchmark Run Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Single run, no staging | Run the full corpus once. Fastest but risk of wasting $30-40 if something fails. | |
| Staged: smoke first, then full | Small subset (20-25 rows) as dry-run, then decide on full run. | ✓ |

**User's choice:** Staged approach
**Notes:** User confirmed: smoke run first (20-25 rows, full metrics preview). Then decide whether to do a full run.

| Option | Description | Selected |
|--------|-------------|----------|
| Cost + crash only | Validate no crashes and cost is within budget. | |
| Full metrics preview | Compute macro_f1, per-signal contribution, calibration. | ✓ |

**User's choice:** Full metrics preview on smoke run

| Option | Description | Selected |
|--------|-------------|----------|
| Clear pass or clear fail | Skip full run if smoke results are unambiguous. Full run only if borderline. | |
| Always full run | Smoke is just a sanity check. Always run full corpus. | |

**User's choice:** User will decide how to proceed after seeing smoke results.

---

## Version Flip Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Before benchmark | Flip to 3.0.0 before running. Results tagged with real version. | |
| After benchmark passes | Keep at 3.0.0-dev throughout. Flip only if gate passes. | ✓ |

**User's choice:** After benchmark passes
**Recommended:** After benchmark passes — avoids having to revert version tag if benchmark fails.

---

## Failure Response Plan

| Option | Description | Selected |
|--------|-------------|----------|
| Soft gate — accept with note | Document the gap, ship as-is if close to target. | |
| Hard gate — block milestone | Target is target. Don't ship if not met. | |

**User's choice:** User is the gate — will decide when they see the results.

| Option | Description | Selected |
|--------|-------------|----------|
| Disable that signal, re-run | Set offending signal weight to 0, re-run. | |
| Note and ship | Document negative signal, ship anyway. | |
| Block milestone | BENCH-06 requires all signals positive. | ✓ |

**User's choice:** Block milestone if any signal subtracts from accuracy (BENCH-06 hard gate).

---

## Sign-Off Checklist

| Option | Description | Selected |
|--------|-------------|----------|
| Benchmark report only | JSON report + summary markdown. Merge directly. | ✓ |
| Full milestone summary | Report + CHANGELOG + release notes. More ceremony. | |

**User's choice:** Benchmark report only. No extra ceremony.

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic after passing | Merge straight to main once benchmark passes. | |
| User reviews report first | User reads report, then gives go-ahead. | ✓ |

**User's choice:** User reviews the report first before merge.

---

## Corpus Baseline Comparison

| Option | Description | Selected |
|--------|-------------|----------|
| Re-measure v2.1 on current corpus | Run baseline on current corpus for apples-to-apples comparison. | ✓ |
| Restrict v3 to original 225 rows | Compare on same dataset as original baseline. Free but loses signal. | |
| Work with what we have | Compare to existing baseline doc. Approximate. | |

**User's choice:** Re-measure v2.1 on current corpus.

---

## Claude's Discretion

None — all areas were discussed explicitly.

## Deferred Ideas

None.
