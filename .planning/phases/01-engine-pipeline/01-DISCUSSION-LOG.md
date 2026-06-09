# Phase 1: Engine Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 1-Engine Pipeline
**Areas discussed:** Verification rig + triage, §-citation grounding, Latency firmness, omni-flash drift, ENG-06 Qwen prompt I/O

---

## Gray area selection

User selected ALL FOUR offered areas + free text: "i want to audit and understand
from the ground up, qwen input/outputs etc a lot of refinement we need to make."

---

## Verification rig + triage

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — audit doc first | Standalone ground-up ENGINE-AUDIT.md before fixes | |
| Audit inline per fix | Audit each call just-in-time as fixed | ✓ |
| Reuse ENGINE-MAP.md | Refresh the engine-opt teardown to as-built | |

**User's choice:** Audit inline per fix.
**Notes:** Evidence standard — "ask me always if/how we should test as we proceed.
Stay efficient: test after a couple fixes; you UAT, I do it myself, or scripts — we
decide as we move forward." Determinism — "score not that important as the current
setup is not optimized yet, so we shouldn't measure against it."

---

## §-citation grounding

| Option | Description | Selected |
|--------|-------------|----------|
| Fix in-engine now | ENG-02 owns it; rendering stays Phase 2/4 | ✓ (+ caveat) |
| Confirm-only, defer fix | Verify cites, push fix to Phase 2/4 | |

**User's choice:** Fix in-engine now — "but we need to maybe adjust or change the
system fundamentally." (→ fundamental grounding redesign on the table, D-06.)

| Option | Description | Selected |
|--------|-------------|----------|
| Audit then decide | Trace runtime cites vs lean core vs board, then restore/remap | ✓ |
| Restore dropped sections | Put §2.6/§7/§8 back in runtime core | |
| Remap to surviving § | Relabel levers to surviving sections | |

**User's choice:** Audit then decide.

---

## Latency firmness

| Option | Description | Selected |
|--------|-------------|----------|
| Under cap, quality wins | Under Vercel cap; <90s only when free; quality beats latency | ✓ |
| <90s hard target | Firm latency gate this phase | |
| Defer latency entirely | Pure quality pass, latency later | |

**User's choice:** Under cap, quality wins.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, temporarily OK | Accept regressions while refining; reclaim before close | ✓ |
| No regressions | Every change holds/improves latency | |

**User's choice:** Yes, temporarily OK.

---

## omni-flash drift

| Option | Description | Selected |
|--------|-------------|----------|
| Reopen — audit flash vs plus | Re-audit read quality; flip to plus if richer | ✓ |
| Keep flash, harden only | Lock flash, fix drift via guards | |

**User's choice:** Reopen — audit flash vs plus.

| Option | Description | Selected |
|--------|-------------|----------|
| Guard + retry + validate | Zod guard + bounded retry + validation logging | ✓ |
| Audit drift first | Catalog drifting fields N-times, then design guards | |
| You decide | Per-field strategy during implementation | |

**User's choice:** Guard + retry + validate.

---

## ENG-06 Qwen prompt I/O

| Option | Description | Selected |
|--------|-------------|----------|
| Apollo deepest, all reviewed | Most effort on Apollo (the moat) | (implied) |
| Equal depth all 3 | Systematic equal pass | |
| Follow the data flow | Review in pipeline order | |

**User's choice:** "review all together with me step by step" (co-review, in the loop).

| Option | Description | Selected |
|--------|-------------|----------|
| Reverse trims that hurt quality | Restore quality-carrying byte-cuts | |
| Keep lean, tune within | Improve via wording not bytes | |
| Audit then decide | Catalog each T3.x trim + rationale, decide per item | ✓ |

**User's choice:** Audit then decide.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — tighten + prune dead | Tighten Zod, remove dead, require critical | |
| Audit dead fields first | Map consumed-vs-dead, then prune | ✓ |
| Leave schemas as-is | Focus on prompt content | |

**User's choice:** Audit dead fields first.

---

## Wrap → milestone-level directive

When asked ready-for-context vs explore ENG-04 honesty, user gave a milestone-wide
rule instead: "in general for this milestone we don't want automated work, we want to
have me in the loop everywhere — it's important we audit and discuss interactively,
I need to understand and then we execute with accuracy." → captured as D-00 (binds all
v4.1 phases) + memory `mvp-ready-human-in-loop`. ENG-04 honesty folded into CONTEXT as
an audit thread (D-15).

## Claude's Discretion

- Per-field drift-guard strategy during implementation (within D-11), surfaced to Davide
  before applying per D-00.

## Deferred Ideas

- Score-determinism hardening / tolerance band — deprioritized (D-04).
- Net-new engine features — milestone backlog.
- Chat-side §-citation rendering — Phase 4.
- Board frame rendering of Apollo output — Phase 2.
