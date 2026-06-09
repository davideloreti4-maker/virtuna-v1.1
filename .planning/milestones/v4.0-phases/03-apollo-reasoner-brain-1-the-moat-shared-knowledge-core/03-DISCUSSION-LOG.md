# Phase 3: Apollo Reasoner (Brain 1) — THE MOAT + shared knowledge core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 3-Apollo Reasoner (Brain 1) — THE MOAT + shared knowledge core
**Areas discussed:** creator-rules supersede-vs-merge, Composite score (sequencing + dimensions), Rewrites (scope + temperature), Remix re-grounding (R12)
**User standing instruction:** always give a thought-through recommendation, recommended option first.

---

## creator-rules: supersede vs merge

| Option | Description | Selected |
|--------|-------------|----------|
| Supersede + verify numbers | Core = SSOT; dormant creator-rules.ts prompt strings; verify §2.0a carries key hard numbers first | ✓ |
| Merge — inject both | Keep CREATOR_RULES_BLOCK live alongside the core | |
| Supersede, no verify | Dormant immediately, trust §8 mapping | |

**User's choice:** Supersede + verify numbers.
**Notes:** Reframed mid-discussion — the prompt-injection version was already unhooked (only dormant stage11 used it); live consumer `creator-rulebook.ts` is a separate deterministic UI checker, left untouched.

---

## Composite score — sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Replace gemini half → behavioral+Apollo | Apollo replaces ~35 visual term; full rederivation at P5 | ✓ |
| Apollo owns the whole score now | Apollo composite = entire 0–100 in P3 | |
| Shadow Apollo, keep old blend | Compute but don't surface; defer gemini-drop | |

**User's choice:** Replace gemini half → behavioral+Apollo.
**Notes:** Constrained by P2's deferred gemini-judgment drop; R5 defines score = Apollo + Audience-Sim (P4), so Apollo-only in P3 was rejected to avoid a double-swing.

---

## Composite score — dimensions

| Option | Description | Selected |
|--------|-------------|----------|
| Adopt core §4 as-is | 6 dims, Strong/Mid/Weak, one composite 0–100, no numeric sub-scores | ✓ (with verify) |
| Core §4 dims + numeric per-dimension | Add 0–100 per dimension for factor-bar UI | |
| Redefine the dimensions | User-specified set | |

**User's choice:** Adopt core §4 as-is — "but verify that we are looking at the best dimensions."
**Notes:** Added D-07 — P3 research confirms the 6 are the right/complete high-leverage set before locking.

---

## Rewrites — scope

| Option | Description | Selected |
|--------|-------------|----------|
| Hook, 2–3 variants, diff levers | Verbatim hook only; each variant fixes a different §2 lever | ✓ |
| Hook + per-segment rewrites | Hook plus weak segments | |
| Hook, single best rewrite | One replacement line | |

**User's choice:** Hook, 2–3 variants, different levers.
**Notes:** Per-segment deferred; audience-aware rewrites = P5 (needs Audience-Sim).

---

## Rewrites — temperature

| Option | Description | Selected |
|--------|-------------|----------|
| Single temp0+seed call, all-in | Score+critique+rewrites in one deterministic call | ✓ |
| Split: temp0 score + temp>0 rewrites | Separate creative rewrite call | |
| Single call, temp>0 throughout | Breaks score determinism | |

**User's choice:** Single temp0+seed call, all-in.
**Notes:** Protects the ~3-call architecture (Apollo = 1 call); splitting = a 4th call.

---

## Remix re-grounding (R12)

| Option | Description | Selected |
|--------|-------------|----------|
| Re-ground knowledge, keep contracts | decode→§5, adapt→§6+§2; keep Zod output schemas | ✓ |
| Full fold — rip out + reshape | Refactor output contracts too | |
| Defer Remix to a later phase | Score-mode only in P3 | |

**User's choice:** Re-ground knowledge, keep contracts.
**Notes:** Core §5 already carries decode's "repeatable vs luck"; D-13 verifies §5 beats map onto decode fields.

## Claude's Discretion

- Core delivery form (inline TS const vs file read — DashScope byte-stable cache).
- Confidence-indicator derivation (§4 signal coverage).
- Retain deepseek.ts infra (circuit breaker, retries, cache split).

## Deferred Ideas

- Per-segment rewrites; audience-aware rewrites (P5); full Apollo+Audience-Sim score rederivation + grounded engagement (P5); temp>0 rewrite pass (if needed); Remix output-contract refactor (only if it conflicts).
