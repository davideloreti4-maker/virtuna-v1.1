# Phase 2: Hero & Signature Moment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 2-Hero & Signature Moment
**Areas discussed:** Signature mechanic, Hero composition, Headline & voice, Motion & still fallback

> The human selected **all four** offered gray areas and asked that each answer option
> carry an explicit thought-through recommendation. **Every decision below was the
> recommended option** — the human accepted the full proposed direction.

---

## Signature mechanic ("crowd → score") — HERO-03

**Q1 — What is the synthetic audience made of?**

| Option | Description | Selected |
|--------|-------------|----------|
| Particle / dot field | Hundreds of soft charcoal/cream dots in a flocking field; abstract, refined, scales, renders on canvas/R3F | ✓ |
| Avatar / face crowd | Small creator-avatar portraits reacting; more literal but busy/stocky, asset-heavy | |
| Persona node-cloud (10–50) | Labelled persona chips; mirrors product but reads 'panel' not 'crowd' | |
| Hybrid — dots + a few faces | Particle field seeded with a few faces; best-of-both but most complex | |

**Q2 — How does the crowd resolve into a score?**

| Option | Description | Selected |
|--------|-------------|----------|
| Coalesce into the score | Crowd flows inward and assembles into the score — one continuous 'wow' motion | ✓ |
| Gauge fills alongside | Crowd stays static while a separate ring fills + number ticks; cleaner, less dramatic | |
| Sentiment-sort then read out | Particles sort +/- and the ratio resolves; most literal but busiest | |

**Q3 — What form does the resolved score take?**

| Option | Description | Selected |
|--------|-------------|----------|
| Arc ring + number | Gauge with number centered; matches product instrument, gives particles a home | ✓ |
| Bare number, counts up | Large number ticking up; cleanest but less 'instrument' | |
| Number + verdict band | Number + qualitative band; adds meaning but a 2nd text element | |

**Q4 — Is there a source 'video' in the scene? (HERO-03 'reacts to a video')**

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder phone frame | `<Placeholder variant="video">` TikTok phone the crowd reacts to; legible, reuses slot | ✓ |
| Abstract — no explicit source | Implied video, nothing shown; cleaner but weaker narrative | |
| Thumbnail chip, then recedes | Compact chip kicks off then fades; middle ground | |

**User's choice:** Particle field · Coalesce into the score · Arc ring + number · Placeholder phone frame.
**Notes:** Coral reserved as the reaction accent only (lone-accent flat-warm rule). Abstract chosen over literal throughout.

---

## Hero composition — HERO-01/03

**Q1 — Overall composition?**

| Option | Description | Selected |
|--------|-------------|----------|
| Centered stack | Headline → subcopy → CTA → large centered stage; serif spotlight, full-width particles, clean mobile | ✓ |
| Split — copy left, moment right | Product-led Raycast; but choked particle field + copy competes with motion | |
| Full-bleed particle backdrop | Immersive/sandcastles; but legibility risk + fights the calm | |

**Q2 — How is the moment contained?**

| Option | Description | Selected |
|--------|-------------|----------|
| Contained stage / bordered scene | Flat-warm card (6% border, 12px radius, tone-step); defined arena, reads 'instrument' | ✓ |
| Edge-to-edge bleed | Cinematic but less contained, no particle boundary | |
| Freeform / floating | Airy, no container; no arena for the coalesce to land in | |

**Q3 — First-viewport (fold) strategy?**

| Option | Description | Selected |
|--------|-------------|----------|
| Moment shares the fold | Headline + subcopy + CTA + stage in first screen (desktop); immediate wow | ✓ |
| Hero runs taller — scroll into it | Moment gets its own screen below; delays payoff | |
| Compact — copy-forward, moment teased | Copy dominates, moment a reward below; weakest for a signature hero | |

**User's choice:** Centered stack · Contained bordered stage · Moment shares the fold.
**Notes:** On mobile everything stacks tall, headline first.

---

## Headline & voice — HERO-01

**Q1 — Headline message angle (H1)?**

| Option | Description | Selected |
|--------|-------------|----------|
| "Know if it'll pop before you post" | Locked positioning; benefit-first, already page title/meta; avoids barred 'viral'/'AI' | ✓ |
| "Simulate your audience before you post" | Capability-framed; leads with the how not the payoff | |
| "See how your audience reacts — before you post" | Process-framed, ties to the viz; longer, less punchy | |

**Q2 — Newsreader serif vs Inter split?**

| Option | Description | Selected |
|--------|-------------|----------|
| Full serif H1 + Inter subcopy | Whole headline = voice moment (Phase-1 D-05); serif/sans contrast = the hybrid voice | ✓ |
| Serif on a key phrase only | One italic word; very Claude/Linear but trickier + off the Phase-1 framing | |
| Serif headline + serif subcopy | Over-uses serif, dilutes the hybrid contrast | |

**Q3 — What job does the subcopy do?**

| Option | Description | Selected |
|--------|-------------|----------|
| Tight mechanism line | Names how + real outputs (watch-through, hook, retention, score); sets up Phase 3 | ✓ |
| Short + punchy | Tighter/Linear but says less about what you get | |
| Emotional / benefit | Punchy but explains less mechanism | |

**Q4 — Anything alongside the primary CTA?**

| Option | Description | Selected |
|--------|-------------|----------|
| Primary + soft scroll cue | "Try it free" + subtle "See how it works ↓" → `#how-it-works`; aids single-scroll | ✓ |
| Primary + reassurance microcopy | Trust line under CTA; wording placeholder-ish (pricing is Phase 4) | |
| Single primary CTA only | Cleanest but no soft scroll path | |

**User's choice:** "Know if it'll pop before you post" · Full serif H1 + Inter subcopy · Tight mechanism line · Primary + soft scroll cue.
**Notes:** Use the product noun "Simulation" (carried Phase-1 D-23). Exact copy is planner/executor's within this intent.

---

## Motion & still fallback — HERO-03/04

**Q1 — When does the moment play?**

| Option | Description | Selected |
|--------|-------------|----------|
| Autoplay once → rest, replayable | Plays on mount, settles on score, replays on hover/click; calm/earned | ✓ |
| Loop continuously | More alive but pulls focus + heavier | |
| Replay only on interaction | Maximally calm but wow hidden until interaction | |

**Q2 — Rested-state behavior?**

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle ambient drift | Slow low-amplitude drift, score fixed; live instrument, must be cheap + reduced-motion-gated | ✓ |
| Fully static | Calmest/most performant; loses 'alive' touch | |
| Periodic re-pulse | Risks a distracting tic next to the CTA | |

**Q3 — Static fallback frame (HERO-04)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Resolved end-state | Phone + settled crowd + ring + score; full payoff, zero motion; rest == fallback | ✓ |
| Pre-reaction start-state | Withholds payoff from reduced-motion users; weaker a11y | |
| Flat illustrative poster | Simple but a separate asset to keep in sync | |

**Q4 — How to avoid blocking first paint? (HERO-04 + FOUND-06)**

| Option | Description | Selected |
|--------|-------------|----------|
| Still first → lazy-hydrate anim | SSR still, then `dynamic(ssr:false)` mounts canvas/R3F + plays once | ✓ |
| Mount on scroll-into-view | Defers JS, but hero is first on screen so still-first is stronger | |
| Always client-render the animation | Simplest but heavier first paint, CLS risk | |

**User's choice:** Autoplay once → rest, replayable · Subtle ambient drift · Resolved end-state · Still first → lazy-hydrate.
**Notes:** Rest state == fallback == resolved frame (one composed still serves all three). Page stays RSC; moment is a client island.

---

## Wrap-up

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context | Vision comprehensively locked; remainder is technical/art-direction | ✓ |
| Explore more gray areas | Mobile sim behavior, motion refs, score value, custom-vs-lib now | |

## Claude's Discretion

Deferred to researcher (feasibility/perf) + planner/executor (within taste bar):
- Build approach — custom canvas-2D vs R3F/three vs a particle lib (lean: custom canvas-2D; avoid heavy generic particle libs).
- Particle count/density, palette steps, easing + timing of the coalesce.
- Mobile sim behavior — reduced-density field vs resolved still on small screens (perf).
- Phone-frame content — static poster vs looping muted placeholder video.
- Exact score value (strong high-80s 'will pop'), exact subcopy + scroll-cue wording, ring tick/label microcopy.

## Deferred Ideas

- Live "paste a real link → engine demo" — OUT OF SCOPE (needs live engine); moment is a canned cinematic.
- Real hero asset swap (product screenshot/video in the phone) — v2 EXPND-02.
- Hero-variant A/B testing — v2 EXPND-03.
- Audio/sound on the moment — project-wide "future polish".
- Removing redundant `framer-motion` dep — carried Phase-1 deferral; Phase 5.
