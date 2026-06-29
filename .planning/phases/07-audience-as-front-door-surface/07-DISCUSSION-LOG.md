# Phase 7: Audience-as-Front-Door Surface - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 7-audience-as-front-door-surface
**Areas discussed:** Skill-menu mechanism, Picker promotion shape, Build-an-audience paths, Empty-state & first-run demo, Intent scope, Ambient reactor coverage

---

## Skill-menu mechanism (UX-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-skill `modes[]` tag | Each skill declares its modes; menu filters by `audience.mode`. Pack-driven seam, no registry refactor, smallest change to the one hardcoded site. | ✓ |
| Pack-declared verbs | Skills come entirely from `pack[mode].skills`. Fullest horizontal but over-builds ahead of a third pack. | |
| Hardcoded mode-filter | `if mode==='general'` show Profile/Simulate/Predict. Fast but bakes the two-vertical fork. | |

**User's choice:** Per-skill `modes[]` tag (recommended)
**Notes:** The tag IS the seam — upgrading to fully pack-declared later is trivial. Removes the only hardcoded-socials site in the surface (`composer-controls.tsx` creator/marketing split).

---

## Picker promotion shape (UX-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Compact dropdown, reuse rows | Promote retired AudienceChip → in-composer dropdown opening audience-manager rows, sectioned Socials/General + Build entry. No surface hop; creator byte-identical. | ✓ |
| Full takeover picker | Dedicated picker surface. Surface-hop that risks the creator path; manager page already exists for browsing. | |
| Inline segmented sections | Always-visible sections above composer. Clutters the slim composer, fights §15.1. | |

**User's choice:** Compact dropdown, reuse rows (recommended)
**Notes:** Content was already locked by VISION §16.1 (Mode = section header, not a pill); only the form was open. Reuses audience-manager UI per §16.5 step 1.

---

## Build-an-audience paths (UX-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Unified entry, all save a SIM | One `+ Build` chooser → description / evidence / template; all converge on a saved named General SIM. Template = clone-and-edit; evidence reuses P5 profile-drop. | ✓ |
| Three separate entry points | description in form, evidence via composer, template via manager. Scatters the build mental model. | |
| Defer template path | Ship description + evidence only. UX-04 lists template and clone-and-edit is cheap. | |

**User's choice:** Unified entry, all save a SIM (recommended)
**Notes:** Matches §16.4 ("Profile = build a General Audience that fills the library"). Clone-and-edit turns select-only presets into owned SIMs.

---

## Empty-state & first-run demo (UX-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Chips + pre-seeded example | 3 locked chips + a one-tap pre-loaded sample chat that runs Profile→Read. Cold-start wow with no chat-export friction. Show-once, dismissable. | ✓ |
| Chips only | Just the 3 chips. Wow gated behind the user having a chat export. Under-delivers §15.5. | |
| Guided walkthrough | Multi-step coachmark tour. Over-built, brittle, off-style. | |

**User's choice:** Chips + pre-seeded example (recommended)
**Notes:** Chip copy is locked by §15.5; only the "first-run demo" was open. Home empty state was LOCKED empty in P5 (D-18/D-25); P7 unlocks it.

---

## Intent scope (added)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer (leave the seam) | No composer intent chip in P7. `success_criterion` already authorable on the P3 form; §16.5 step 6 breadth; not in UX-01..05; would touch the locked creator composer. | ✓ |
| Pull into P7 | Ship the success-criterion/intent chip now. Adds scope, touches the locked composer, duplicates P3 form authoring. | |

**User's choice:** Defer (recommended)
**Notes:** Leaves the seam open for the brand vertical (customer-SIM + sell-intent) without building it now.

---

## Ambient reactor coverage (UX-03, added)

| Option | Description | Selected |
|--------|-------------|----------|
| Generalize live, reuse mechanism | Active Audience reacts live for General too (the §15.3 "Alex reacts live" moat-touch). Rename+wiring (§16.5 step 3); `buildAudienceRepaint` already pack-driven; person-SIM = single reactor; keep existing throttle. | ✓ |
| Socials-only live; General on-submit | Cheaper but breaks the live moat-touch on the profile-chat wow. Under-delivers UX-03. | |

**User's choice:** Generalize live, reuse mechanism (recommended)
**Notes:** UX-03 is in-scope; deferring would drop a requirement. Cost bounded by the existing Socials debounce/throttle.

---

## Claude's Discretion

- The `modes[]` tag shape + the `SkillRows` filter mechanics + no-audience default (→ Socials).
- The dropdown/popover primitive + composer anchor + in-menu `+ Build` rendering.
- The Build chooser UI (modal vs inline) + SIM auto-naming + template→owned-SIM clone mechanics.
- The pre-seeded sample chat content + show-once persistence + dismiss affordance.
- The reactor rename/wiring + person-SIM single-reactor framing + throttle reuse.
- Cross-mode mid-thread behavior (default to existing thread behavior).

## Deferred Ideas

- Intent → success-criterion composer chip (§16.5 step 6) → later breadth.
- Discover / Apify corpus surface → future milestone, as a pack capability, never a top-level page.
- Brand vertical as a distinct surface tree → later, as customer-SIM + sell-intent; picker/intent seam left open.
- SIM marketplace, self-calibration (CAL-01), Anchor Pack #2 → v2.
- Multi-stimulus/batch, `.docx`/`.pdf` ingest → already deferred upstream.
