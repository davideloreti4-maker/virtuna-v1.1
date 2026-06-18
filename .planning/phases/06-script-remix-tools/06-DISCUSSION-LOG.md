# Phase 6: Script & Remix Tools - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 6-Script & Remix Tools
**Areas discussed:** Script SIM-test granularity, Script Diagnose mode scope, Remix entry path, Remix decode depth, Remix reuse scope

---

## Script — SIM-test granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Hook beat only | Flash scores just the opening hook beat (reuses proven hooks gate); rest rides self-judge. Cheap, honest, no new calibration. | ✓ |
| Hook beat + retention-curve read | Flash scores opener + per-beat retention read. Richer, but new SIM framing + cost. | |
| One aggregate script score | One whole-script viability band. Simplest, but implies full-watch prediction Flash can't make (honesty risk). | |

**User's choice:** Hook beat only (Recommended)
**Notes:** Keeps the honesty spine — Flash predicts scroll-stop, never full-watch. Script quality beyond the opener is caught by the bounded self-judge gate.

---

## Script — Diagnose mode scope

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to v6.1 | P6 ships generate-only (hook→script→test). Diagnose is a distinct input path + UX. | ✓ |
| Include in P6 | Ship Diagnose (paste→line-edit→drop-point) alongside generate. Bigger surface. | |

**User's choice:** Defer to v6.1 (Recommended)
**Notes:** Same split discipline that broke the mega-phases apart; earn the gate on the core chain first. Already listed deferred in STATE.

---

## Remix — entry path

| Option | Description | Selected |
|--------|-------------|----------|
| Own-winner reuses, trending decodes light | Both REMIX-01 entries: prior-Reading reuse + lightweight URL decode. | |
| Lightweight URL/text decode only | Single URL path, shallow decode. | |
| Reuse full video Reading decode only | Always requires source video Tested first. | |

**User's choice (override):** "Focus on doing the URL detailed — seems to have way higher value for creators. Sees a video on their FYP → wants to redo it for their own account."
**Notes:** Owner reframed to a single hero path — the pasted trending/competitor URL. Own-winner entry deferred to v6.1 (see follow-up below). The decode for the URL should be *detailed*, not shallow — which reshaped the decode-depth follow-up.

---

## Remix — decode depth (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Resolve + real structural decode | Reuse resolve-and-rehost + real decode (hook pattern/structure/turn/emotional beat) → niche adapt. "Detailed" = decode the real video. | ✓ |
| Lightweight metadata/transcript decode | Decode from caption/metadata only. Faster, shallower, weaker moat. | |
| Decide in planning after scout | Let the scout pick depth post-read. | |

**User's choice:** Resolve + real structural decode (Recommended)
**Notes:** "Detailed/high-value" = decode the actual video, not metadata guesses. Heavier latency accepted as the value. Scout must confirm decode's coupling to the protected SIM-1 Max path (D-05a).

---

## Remix — own-winner entry (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer own-winner to v6.1 | P6 ships URL entry only; own-winner (prior-Readings picker) is a separate UX. | ✓ |
| Include own-winner too | Ship both entries in P6. | |

**User's choice:** Defer own-winner to v6.1 (Recommended)
**Notes:** Keep P6 focused on making the URL path excellent.

---

## Remix — reuse scope

| Option | Description | Selected |
|--------|-------------|----------|
| Revive engine, rebuild card as thread block | Keep engine/remix logic, drop old board UI, new thread remix-card + remix→hooks CTA. | |
| Scout first, decide in planning | Defer revive-vs-rebuild to a reuse-scout task. | ✓ |
| Fresh text-first remix path | Discard video-coupled pipeline, build new. | |

**User's choice:** Scout first, decide in planning
**Notes:** REQUIREMENTS mandates a reuse scout. Working direction captured in CONTEXT D-06 (revive engine logic + new thread card), with the scout confirming exact seams before any build.

---

## Claude's Discretion

- Exact script beat schema, timing units, retention-marker copy (within beats+timing+retention shape).
- Whether Remix reuses `/api/remix/adapt` or gets a new `/api/tools/remix/*` route (decide post-scout).
- Remix output cardinality into Hooks (default one card; revisit if scout favors the 3-concept shape).
- Phase sequencing — recommended Script first (greenfield, mirrors Hooks), then Remix (scout-heavy).
- THEME-06 flat-warm visual SSOT for both new card blocks.

## Deferred Ideas

- Script Diagnose mode → v6.1 (D-03).
- Remix own-winner entry → v6.1 (D-04).
- Concept/script text pre-flight mode → v6.1+.
- Remix ranked-set vs single-card output → revisit post-scout.
- In-thread monetization, brand-profile, RAG-over-history, desktop dense-instrument → v6.1+.
