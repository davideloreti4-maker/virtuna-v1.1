# Phase 1: Engine / Pack Seam - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-26
**Phase:** 1-engine-pack-seam
**Areas discussed:** Extraction strategy, Byte-identical contract / safety bar, Pack interface shape, Scoring wrap line, Phase-1 visible scope

---

## Extraction Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| In-place, test-gated | Refactor core in place; Socials becomes Pack #1 in one move; rollback = git + smoke test, no runtime flag | ✓ |
| Strangler behind a flag | Parallel pack path behind env flag; Socials stays default until proven | |
| Incremental sub-extractions | Extract one concern at a time, each its own commit + fixture re-check | |

**User's choice:** In-place, test-gated (Recommended)
**Notes:** Socials IS Pack #1 (not "old vs new" behavior), so a parallel/flag path would just duplicate identical behavior. The byte/smoke test gives the "did I break it" signal.

---

## Byte-identical Contract / Safety Bar

| Option | Description | Selected |
|--------|-------------|----------|
| Full-output golden master, LLM stubbed | Deterministic byte-equality on full pipeline output with replayed LLM | |
| Post-LLM math only, live calls | Assert only deterministic scoring fields | |
| Persisted Reading-schema snapshot | Snapshot final persisted row | |
| **(Follow-up) Light smoke + structural check** | Socials run completes + output schema valid + overall_score in sane band; NOT exact values | ✓ |
| (Follow-up) Golden master, non-blocking | Recorded diff, informational only | |
| (Follow-up) Manual spot-check only | Eyeball one known video, no CI test | |

**User's choice:** "its not that important as the skill input and output isnt optimized / maximized either way and will get changed after this milestone" → then **Light smoke + structural check**.
**Notes:** Founder explicitly downgraded the byte-identical guarantee — relaxes ROADMAP SC#4 / PACK-04. Creator skill I/O is getting reworked next milestone, so an exact-byte fixture rig is wasted effort. Gate is cheap insurance against breakage only.

---

## Pack Interface Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Full 7-field interface, Socials-only impl | Define complete typed DomainPack now, implement only Socials | ✓ |
| Minimal interface, grow later | Only fields Socials needs today | |
| Full interface + one stub General pack | Define all 7 + scaffold empty General pack | |

**User's choice:** Full 7-field interface, Socials-only impl (Recommended)
**Notes:** Contract is the expensive, hard-to-re-cut part; roadmap already enumerates all 7 fields. Stub General pack rejected to keep scope pure (see Phase-1 scope).

---

## Scoring Wrap Line

| Option | Description | Selected |
|--------|-------------|----------|
| Whole scoring chain in the pack | apollo-core → aggregator → overall_score fold wrapped as one opaque unit; core holds zero scoring logic | ✓ |
| Core keeps aggregator, pack supplies config | Core retains fold machinery, pack supplies weights | |
| Split: apollo wrapped, aggregator parameterized | Refactor aggregator into domain-blind fold | |

**User's choice:** Whole scoring chain in the pack (Recommended)
**Notes:** PACK-01 demands no socials-specific logic on the core; overall_score/virality weighting is socials-specific → must live in the pack. apollo math wrapped unchanged. Aggregator NOT refactored (respects wrap-never-refactor).

---

## Phase-1 Visible Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Pure invisible refactor | Seam + Socials Pack #1 only; no user-facing change, no General, no second pack, no UI | ✓ |
| Refactor + General pack stub | Also scaffold empty General pack | |
| Refactor + groundwork for P3 | Sneak in non-socials data-model groundwork | |

**User's choice:** Pure invisible refactor (Recommended)
**Notes:** Keeps the diff reviewable and the "Socials still works" check clean. General population is explicitly Phase 3.

---

## Claude's Discretion

- Exact file/module layout of the `DomainPack` interface + Socials pack under `src/lib/engine/`.
- Smoke-test harness location/shape (run via `node ./node_modules/vitest/vitest.mjs run`).
- `mode` dispatch axis resolution (domain-mode vs `input_mode`) — surfaced, planner decides within P1.

## Deferred Ideas

- General pack implementation → Phase 3.
- Predict pack → Phase 6.
- Stub General pack → considered, rejected for P1 scope purity.
- Broader `mode`-routing UX → later phase.
