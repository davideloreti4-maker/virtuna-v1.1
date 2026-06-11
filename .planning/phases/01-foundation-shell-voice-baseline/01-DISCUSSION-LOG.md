# Phase 1: Foundation, Shell & Voice Baseline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-11
**Phase:** 01-foundation-shell-voice-baseline
**Areas discussed:** Route & old-landing disposition, Nav + footer contents, Voice baseline codification, Scaffold fidelity & placeholder tokens

**Mode:** User selected all four gray areas, then directed "pick your recommendations and continue" — Claude drove each area with a recommended decision; user confirmed the full bundle ("Lock all as recommended").

---

## Route & old-landing disposition

| Option | Description | Selected |
|--------|-------------|----------|
| Rebuild `(marketing)` in place | New Numen landing owns `/`; replace marketing layout+page; new shell in `components/numen-landing/`; orphan stale `components/landing/*` + societies.io header/footer | ✓ |
| Fresh route group | Spin a new `(numen)` group owning `/` | |
| Sandbox path | New landing on a separate path (e.g. `/landing`) | |

**User's choice:** Rebuild in place (recommended).
**Notes:** Stale `(marketing)` route is societies.io / "Artificial Societies" branded — dead. Dev/showcase routes under `(marketing)` left untouched. Stale components orphaned now, deleted in Phase 4.

---

## Nav + footer contents

| Option | Description | Selected |
|--------|-------------|----------|
| Logo + anchors + CTA | NumenLogo + inline anchors (How/Honesty/Gallery) + primary CTA; mobile hamburger for anchors, logo+CTA inline | ✓ |
| Logo + CTA only | Ultra-minimal | |
| Logo + full nav | More links | |

**User's choice:** Logo + anchors + CTA (recommended).
**Notes:** Footer = logo + positioning line + anchor repeat + legal placeholders + socials (X, LinkedIn) + CTA slot + copyright. Live CTA wiring deferred to Phases 2-3.

---

## Voice baseline codification

| Option | Description | Selected |
|--------|-------------|----------|
| Both: VOICE.md + applied copy | Durable `.planning/VOICE.md` guide (canonical ref) + applied placeholder copy in scaffold | ✓ |
| Applied copy only | Voice demonstrated inline, no guide doc | |
| Guide doc only | VOICE.md without applied scaffold copy | |

**User's choice:** Both (recommended).
**Notes:** Register = calm, plain-language, confident-mentor, second-person, zero engine jargon, zero "X% accuracy", verdict = band + why. Example hero copy seeded in CONTEXT D-08a.

---

## Scaffold fidelity & placeholder tokens

| Option | Description | Selected |
|--------|-------------|----------|
| Semantic section slots + existing `.numen-surface` tokens | Anchored `<section>` slots in kero order with in-voice headings + rhythm, no real artifacts; body mounts `.numen-surface`, consumes existing globals.css tokens as placeholders (DS-02) | ✓ |
| Empty div slots | Minimal unstructured placeholders | |
| Fully skeletoned content | Build out section internals now | |

**User's choice:** Semantic slots + existing tokens (recommended).
**Notes:** Slot order Hero → How → Honesty → Gallery → Proof → Final CTA → Footer. No forked tokens (DS-01). Phase 4 swaps to final calibrated tokens (D-L3). SEO meta baseline this phase; OG card art Phase 4.

---

## Claude's Discretion

- Component file split within `src/components/numen-landing/`.
- Which `numen/` primitives to reuse in the shell.
- Precise placeholder copy wording (must obey VOICE.md).
- Anchor `id` naming convention.

## Deferred Ideas

- Hero artifact + verdict + 3-step explainer + hero CTA → Phase 2.
- Honesty/gallery/proof/conversion + waitlist capture → Phase 3.
- Final token swap, scroll-reveal motion, LCP/OG/a11y polish, delete orphaned stale components → Phase 4.
- Use-case/persona, blog, i18n → v2.
