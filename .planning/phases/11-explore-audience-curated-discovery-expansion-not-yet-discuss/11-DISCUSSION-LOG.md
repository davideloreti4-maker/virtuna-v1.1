# Phase 11: Explore (Audience-Curated Discovery) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 11-explore-audience-curated-discovery
**Areas discussed:** Scoring + reaction, Tile → Read, Entry + params, Watchlist + scope
**Mode note:** Worktree runs max effort (Opus 4.8, `effort.default: max`, all tiers max). At user request, options were re-presented recommendation-first (grounded pick surfaced as option 1 with rationale embedded). User accepted all four recommendations + flagged the Sandcastles UI screenshots for review.

---

## Scoring + Reaction (EXPLORE-02 + EXPLORE-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Audience-relative score + SIM on tap | Honest re-ranked fit score per tile (no fake quotes); real P9 reaction + Read on tap. Satisfies EXPLORE-02/03, affordable on a habit surface, honesty-spine-safe. | ✓ |
| Measured grid, SIM on tap | Grid keeps only P8's generic measured multiplier; audience moat hidden behind every tap. | |
| Full SIM per tile eagerly | Real reaction on every card at pull time; cost/latency-prohibitive (~20–30 sims/pull). | |

**User's choice:** Audience-relative score + SIM on tap (Recommended)
**Notes:** Eager layer = honest math (re-rank measured multiplier vs audience niche+calibration), NOT a fabricated persona quote. Real reaction (quotes/verdict) computes on tap from real SIM only — honesty spine binding.

---

## Tile → Read (EXPLORE-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Remix-then-Read | Tap → generate creator's version (Remix) → SIM-test → Read. Outlier has no Read of its own; matches literal EXPLORE-02 CTA; reuses discover→remix chain. | ✓ |
| Read-the-outlier, then offer Remix | Lighter funnel, but outlier has no SIM Read beyond the measured multiplier — Remix step is the real payoff anyway. | |
| Both, creator picks | Most flexible; doubles tile-action UI, blurs the single CTA. | |

**User's choice:** Remix-then-Read (Recommended)
**Notes:** Eager fit score (Q1) already covers the cheap glance, so the tap is the committed moat action. CTA locked "Remix → Read", never "rewrite for me".

---

## Entry + Params (EXPLORE-04 + EXPLORE-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Audience-derived quick-actions + param sheet | 2–4 audience-aware quick-actions + params sheet (niche/accounts/window + serendipity slider). Only option satisfying both EXPLORE-04 and EXPLORE-01. | ✓ |
| Quick-actions only, defer serendipity | Leaner, but drops EXPLORE-01's named serendipity valve. | |
| Static quick-actions + composer params | Simplest; under-delivers EXPLORE-04's "audience-aware". | |

**User's choice:** Audience-derived quick-actions + param sheet (Recommended)
**Notes:** Explore's thread view owns its idle/empty state (ChatThreadView precedent). Serendipity valve in scope for P11.

---

## Watchlist + Scope (EXPLORE-05 + EXPLORE-06) — multi-select

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal "Track account" write in P11 | Persist watchlist row (flat/typed, Library-compatible); P12 surfaces it, no rework. | ✓ |
| Defer comment-seeding again | Keep EXPLORE-06 out of P11 — off-spine, twice-deferred. | ✓ |
| Consume-only watchlist instead | P11 only reads tracked accounts; nothing populates it until P12 (dormant). | |
| Comment-seeding in scope instead | Pull top comments to seed reactions/ideas; more scope on a large flagship phase. | |

**User's choice:** Minimal "Track account" write in P11 + Defer comment-seeding again (both Recommended)
**Notes:** User added: "check out too the sandcastles ui screenshot references." Reviewed `~/Downloads/Sandcastles.ai Screenshots/` (18 PNGs) — hook-vault borrowed-proof badges, video-detail deconstruction + "Personalize for your niche" options, format/hook ontology galleries, creation wizard, full left-nav IA. Folded into CONTEXT canonical_refs + specifics (positioning contrast: their "9.2M views (someone else)" vs Numen "pull-score N (your audience, predicted)"; Personalize-options → land on a Read).

## Claude's Discretion

- Exact eager fit-score formula (niche-match + calibration weighting of measured multiplier)
- Tile visual encoding of the fit score (dots/bar/label) — UI-phase
- Extend `outlier-grid` block with an audience-fit field vs add `explore-grid` variant (prefer extend)
- Quick-action copy + count (2–4); which audience fields drive them
- Params sheet popover vs inline — UI-phase

## Deferred Ideas

- Comment-seeding (EXPLORE-06) → later phase (twice-deferred)
- Library/watchlist management UI + 4-item IA collapse → P12
- Ambient-on-every-card + proactive drops + scheduled Explore → P13
- Idea-inbox/hook-vault/collections "on the outlier spine" (superseded Living-Research-Feed rescope) → other skills / P12
- Export / "Export for LLM" → SKIP (don't bleed the closed loop)
