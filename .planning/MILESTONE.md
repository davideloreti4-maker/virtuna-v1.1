# MILESTONE — Numen GSI (horizontal pivot)

> Immutable worktree identity. Created 2026-06-26.

- **Worktree:** `~/virtuna-numen-gsi`
- **Branch:** `milestone/numen-gsi`
- **Milestone:** Numen GSI — reframe Numen as a synthetic-population simulator
  (Profile / Simulate / Predict), horizontal across domains.
- **Input vision:** `.planning/NUMEN-GSI-VISION.md` (copied from trunk 2026-06-26).

## Phase 0 status — DONE + production-verified (engine-rework)
Engine-rework is GSI Phase 0 and it is COMPLETE + merged to `main`:
the SIM primitive (AudienceSignature), fold↔calibrated-audience unification,
the 2-model stack, and the dissection cuts all landed (#49,#53–#58). The
pre-GSI production-readiness sprint ran 2026-06-26 — no blocker (RLS/concurrency
GREEN; GAP-REMIX-01 fixed #63; dead /api/outcomes cut #64; SSRF low).
SSOTs on `main`: `docs/DISSECTION-BACKLOG.md`, `docs/WORKTREE-DEBT-LEDGER.md`,
`docs/MODEL-POLICY.md`, `docs/HANDOFF-R1-engine.md` (tsc baseline now 4).

## Next (in THIS worktree, fresh session)
Run the GSD flow here: `/gsd-new-milestone` → requirements → roadmap.
Phase 0 scope per the vision: extract Socials → Anchor Pack #1, generalize
`audiences` → domain-agnostic SIM, make scoring pluggable (the hard bet).
Do NOT `git merge rework/engine-core` (squash-dangling; content already on main).

## Engine debt carried (noted on main, NONE GSI-blocking)
- Low-value polish: E2, A6, A-T (folds into GSI audience work), S6, R3, R5, G3,
  G-D (M2 RAG cut), `enrich-signature` stale header.
- Launch-gate: rate-limiting (HARDEN-01, before any public traffic).
- Ongoing: gen-latency. Optional: gen-retry backoff, SSRF bare-apex tighten,
  apify try/catch.
- `feat/creator-voice-sample` = PR #60 OPEN (rebase + review or close).
