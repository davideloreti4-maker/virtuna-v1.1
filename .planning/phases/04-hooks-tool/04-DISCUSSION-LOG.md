# Phase 4: Hooks Tool - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 4-Hooks Tool
**Areas discussed:** Rank vs gate, Archetype tag, Test chain, Entry/volume/trigger

---

## Rank vs gate (HOOKS-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Gate THEN rank | Keep P3 slop-gate AND order survivors #1..N by band tier → audience-fraction; lead with scroll-quote; qualitative (no fake numeric score) | ✓ |
| Pure rank, no gate | Rank all N, show weak ones lower — ships slop | |
| Gate only (P3 parity) | Survivors unordered, band secondary — contradicts HOOKS-02 | |

**User's choice:** Gate THEN rank (Recommended)
**Notes:** Hooks are atomic/discriminable (unlike ideas), so ranking is legitimate and is the flagship demo. Honors HOOKS-02 (ranked) + honesty spine (no slop). Rank qualitatively by band+fraction.

---

## Archetype tag (HOOKS-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Audience-archetype it grabs | Surface which SIM persona stops (from Flash per-persona output); keep craft archetype private | ✓ |
| Both: private craft + visible audience | Craft drives diversity privately; audience tag visible; craft optionally on expand | |
| Emit craft-form slug | Surface BOLD/GAP/CONTRARIAN directly — overrides the slice, requires re-authoring | |

**User's choice:** Audience-archetype it grabs (Recommended)
**Notes:** Reads HOOKS-01 literally — "the archetype it GRABS" = which audience persona stops. Reuses existing Flash per-persona data, no new SIM pass; keeps craft archetype (BOLD/GAP) private per `corpus/hooks.md`. Resolves the HOOKS-01-vs-slice contradiction without re-authoring the KC.

---

## Test chain (HOOKS-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Deep-link w/ hook as context | Route to existing Reading/Test upload surface carrying the hook as the brief; Max scores the shot video | ✓ |
| Wire seam, full landing in P5 | Ship a wired stub; real pre-fill lands with P5 reframe | |
| Run Max-style scoring on text now | Rejected: Max needs video; scoring text fabricates a result | |

**User's choice:** Deep-link w/ hook as brief (Recommended)
**Notes:** User asked for clarification — confirmed SIM-1 Max only runs on a real video, so "Test full →" cannot score the text hook. It hands the hook in as the *brief* for the shot video (pre-fill the upload surface); Max scores the real upload. Honest Flash-ceiling → Max-realized ladder (ENGINE-03). The "Test" rename of that landing is P5; the destination + carry-in mechanism land in P4.

---

## Entry, volume & trigger (HOOKS-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-gen 5 on "Develop this →" | Replace placeholder; auto-fire over-gen ~8 → gate → rank top 5, content-first; Hook chip live; in-thread | ✓ |
| Auto-gen, but N=3 (Ideas parity) | Same auto-fire, 3 cards — leaner but a 3-item "ranking" is thin | |
| Placeholder + explicit button | Keep placeholder; tap "Generate hooks" to fire — most cost-bounded, extra tap | |

**User's choice:** Auto-gen 5 on "Develop this →" (Recommended)
**Notes:** "Develop" is already explicit intent; cost bounded by the buffer, not a click. N=5 so the ranking reads like a ranking. Hook composer chip flips live for own-topic (empty=auto/anchor, typed=seeded); hooks stay in-thread (P3 D-15). Replaces the P3 placeholder in `/api/tools/ideas/develop`.

---

## Claude's Discretion

- Over-generate buffer size + rank tie-breaks beyond band-tier → fraction.
- `hook-card` block prop names, card-face vs expand split, optional reveal-on-expand of the private craft form (default: keep private).
- Hooks API route shape + content-first orchestration.
- Exact pre-fill payload + deep-link target for "Test full →".
- KC_GEN_VERSION stamping on persisted Hooks outputs.

## Deferred Ideas

- "Test · powered by SIM-1 Max" landing rename → P5 (TEST-01).
- Open chat thread → P5 (THREAD-03).
- Generate → critique → regenerate quality loop → future phase.
- Emitting craft archetype slug (BOLD/GAP…) as a visible tag → deliberately not done (slice keeps it private).
- Scripts / Remix → v6.1.
- Profile redesign + social-handle prefill → v6.1.
