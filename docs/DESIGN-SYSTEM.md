# Numen Design System — CURRENT (flat-warm charcoal)

> **Single source of truth for design.** Authored 2026-06-22 from the only authoritative
> runtime source: `src/app/globals.css` (`@theme` block, `:42–233`).
>
> ⚠️ **Every other design doc is STALE** and describes the *retired* Raycast/coral/glass
> system. Do NOT trust them: `CLAUDE.md` "Raycast Design Language Rules", `BRAND-BIBLE.md`,
> `docs/tokens.md`, `docs/components.md`, `docs/design-specs.json`, `docs/usage-guidelines.md`,
> `docs/motion-guidelines.md`, `docs/brand/`. They predate the v5.0/v6.0 migration.
> **`globals.css` + this file are the only current references.**

## The system in one line
Flat-warm **charcoal** surfaces + **cream** text + a **terracotta accent used sparingly** +
**matte** depth (no glass gradients, no glow, no white inset-shine). Primary actions are
**neutral cream**, not accent. Inter for all chrome; serif **only** for voice-moments
(greeting/hero). The old cold-black `#07080a` Raycast glass system is dead. The de-Claude
break is the **near-zero dosage**, not the hue — so as of **2026-06-24** the accent hue is
**terracotta `#d97757`** (signal-red `#e23b2d` was trialed and reverted; dosage rule kept). See
**"Accent dosage (LOCKED)"** below.

## Tokens (real values — `globals.css`)

### Color
| Role | Token | Value |
|---|---|---|
| App background | `--color-background` / `--charcoal-app` | `#262624` (warm charcoal) |
| Sidebar | `--charcoal-sidebar` | `#1a1a18` |
| Composer surface | `--charcoal-composer` | `#1e1d1b` |
| Chip / lifted | `--charcoal-chip` | `#2f2e2b` |
| Primary text | `--cream-primary` | `#ece7de` (**never `#fff`**) |
| Secondary text | `--cream-secondary` | `#c2bdb4` |
| Muted text | `--cream-muted` | `#8a857c` |
| Accent (solid) | `--coral-500` / `--color-accent` | `#d97757` terracotta/clay — the brand accent (**not legacy `#FF7F50`**) |
| Accent (text/icon) | `--color-accent-text` / `--coral-400` | terracotta, legible on dark |
| Accent soft (tint bg) | `--color-accent-soft` | `oklch(0.68 0.13 33 / 0.16)` (terracotta tint) |
| Accent foreground | `--color-accent-foreground` | `#f6e9e6` (cream glyph on solid accent) |
| **Primary action** | `--color-action` | `#ece7de` cream — buttons/send are NEUTRAL, not accent |
| Action foreground | `--color-action-foreground` | `#1c1b19` (dark glyph on cream) |

### Border / depth
- Borders: `rgba(255,255,255,0.06)`, hover `rgba(255,255,255,0.1)`. (6% / 10% — unchanged from before.)
- **Matte, not glass.** Glass 137° gradients, radial halos, white inset-shine, coral glow are all **REMOVED** and stay banned.
- **Depth is a soft DARK drop-shadow — never light, never glow.** This is the one lever the Hybrid elevation pass added (2026-07-05): cards are no longer flat, but the depth is monochrome (black-alpha drops with a vertical offset), so near-zero accent is untouched. The distinction the guard enforces: a matte drop has a **non-zero Y offset** (`0 10px 26px …`); a banned glow is a **zero-offset halo** (`0 0 Npx`).

### Matte depth scale (Hybrid elevation — LOCKED 2026-07-05)
A three-step resting/interactive scale plus the pre-existing float, all soft dark drops:

| Token | Value | Use |
|---|---|---|
| `--shadow-rest` | `0 1px 2px rgba(0,0,0,.28)` | Card **floor** — resting elevation on every elevated card |
| `--shadow-lift` | `0 10px 26px -8px rgba(0,0,0,.5)` | **Hover raise** — tight matte; negative spread keeps it under the card, no bloom |
| `--shadow-press` | `0 2px 6px rgba(0,0,0,.3)` | **Press settle** — collapses back toward the floor |
| `--shadow-float` | `0 10px 30px rgba(0,0,0,.35)` | Genuinely **floating** chrome only (composer, popovers) — unchanged |

**Consume via utilities, don't hand-roll the shadows:**
- `.elev-rest` — resting floor only, for elevated-but-**static** cards (stat tiles, calendar day cells).
- `.elev-lift` — **interactive** cards: floor at rest → −1px lift + `--shadow-lift` on hover → settle + `--shadow-press` on `:active`. Ships the shared 150ms transition (see Motion).

Pair `.elev-lift` with colour feedback in Tailwind (`hover:border-white/[0.10] hover:bg-white/[0.03]`) — the utility's transition animates those props too, so surfaces get smooth feedback for free. Depth stays monochrome; the hover **border/bg brighten is neutral white-alpha, never accent**.

### Motion
Motion is **calm and physical** — short, eased, purposeful; it confirms an action or reveals content, never decorates. Reduced-motion is a first-class state: every animation has a `prefers-reduced-motion: reduce` branch that snaps to rest.

**Tokens (`globals.css` `@theme`):**
- Durations: `--duration-fast: 150ms` (hover/press feedback), `--duration-normal: 200ms` (state changes), `--duration-slow: 300ms` (larger transitions).
- Easings: `--ease-out` (`cubic-bezier(0.215,0.61,0.355,1)` — the default for entrances/lifts), `--ease-out-quart`, `--ease-in-out`, `--ease-spring` (reserve for the rare sanctioned bounce, e.g. a liveness badge-pop).

**The interaction patterns:**
- **Hover-lift / press-settle** — `.elev-lift` (above). 150ms `--ease-out`; lift −1px, settle to 0. This is the standard for any clickable card.
- **Entrance** — `.rv-in` (`juno-fade-up`, 0.55s): staggered fade-up on first paint. The shared surface reveal; stagger children, not the sticky container.
- **Liveness** — `constell-dot` breathe / `badge-pop` (the one sanctioned accent-fill, a genuine liveness event only). Motion + tone, never coral chrome.

**Rules:** never animate `width`/`height`/`top`/`left` (layout thrash) — use `transform`/`opacity`/`box-shadow`. No infinite non-liveness loops. No bounce except `--ease-spring` on a real liveness moment. Every hover/entrance must degrade under reduced-motion.

### Type
- Sans: `--font-inter` — all UI chrome, all weights.
- Serif: `--font-serif` — **voice-moments ONLY** (greeting line, hero). Never body/chrome.
  Currently wired to **Newsreader**. Candidate swap → **Fraunces** (more optical character,
  further from Claude's serif feel). Swapping requires `next/font` wiring in the root layout
  — until then `--font-serif` stays Newsreader. Tracked as a follow-up, not blocking.

### Radius scale
`4 / 6 / 8 / 12 / 16 / 20 / 24` px. Cards 12, inputs/buttons 8, header 16, modals 12.

## Accent dosage (LOCKED 2026-06-24)
**Monochrome by default. Accent is the rare exception — used REALLY sparingly, if at all.**
The UI is cream-on-charcoal; color is not a styling tool. This is the rule that separates us from
Claude (which floods its terracotta everywhere). Goal posture: a screen with **zero** accent is the
norm, not a failure. Pattern is the quiet end of Linear / Vercel / Whop.

**Default = NO accent.** Every accent use must be *justified* and is opt-in, not a default. If you
can't name the specific high-meaning reason, it gets none. Aim for **at most one** accent element
visible on a screen at a time; often zero.

**The only sanctioned uses (and even these are optional):**
- The single live "presence/liveness" signal (e.g. the audience "personas ready" dot) — one per view
- The lit node in the constellation / SIM mark
- The brand mark / logo itself
- (Active-state ticks, selection, focus → prefer NEUTRAL; do not reach for accent here)

**Accent is NEVER allowed on:**
- Primary buttons / the composer send → `--color-action` (neutral cream)
- Icon buttons, skill pills, chevrons, placeholders, tabs, toggles → cream / muted
- Links, borders, large fills, hover states, charts, badges, progress — all neutral
- Anything "to make it pop" — that instinct is the thing we are removing

**Why this hard line:** at near-zero dosage the *hue* barely registers, so the Claude
resemblance dies on any color — this is why the hue itself (terracotta vs red) is not the
de-Claude lever; the dosage is. `--color-error` stays reserved for genuine destructive/error
states; accent ≠ error, never conflated.

**Emphasis without color:** weight, *italic* (serif voice-moments), size, spacing, and hierarchy —
never paint.

**Identity load-bearing parts** (the brand lives here, since color is essentially absent): the
**constellation / SIM motif**, the **serif voice**, copy, and layout. Invest there — that is where
distinctiveness comes from, not the accent.

## Hard rules (the guard test enforces these)
`src/components/reading/__tests__/reskin-matte.test.ts` asserts NO coral-glow / NO glass in
reading components — keep it green. Generally:
1. No `#fff` text → use `--cream-primary`.
2. No `#FF7F50` / `#07080a` / `#18191a` (dead Raycast literals).
3. No glass gradients, no glow halo (`0 0 Npx`), no inset white-shine, no coral. Matte **dark** drop-shadows via the depth scale (`--shadow-rest`/`lift`/`press`/`float`, always with a vertical offset) ARE allowed — that is the Hybrid elevation lever.
4. Consume tokens, never hardcode hex. (Known offenders to migrate: `saved-item-card.tsx:234,252`, `error.tsx`, `opengraph-image.tsx`.)

## Component map (target UI surfaces)
| Surface | Location |
|---|---|
| Ambient audience / AudienceLens | `src/components/audience-lens/` (`AudienceLens.tsx`, `audience-presence.tsx`, `PopulationSwarm.tsx`) |
| Audience creation flow | `src/components/audience/` (`audience-form`, `calibration-flow`, `persona-edit-form`); routes `src/app/(app)/audience/*` |
| Library page | route `src/app/(app)/library/page.tsx`; cards `src/components/saved/` |
| Skills UI / thread cards | `src/components/thread/` (`message-blocks.tsx` dispatcher + `*-card-block.tsx`); reading `src/components/reading/` |
| Composer | `src/components/app/home/composer.tsx` + `composer-controls.tsx` |

## Follow-up (stale-doc cleanup — not blocking)
`CLAUDE.md` branding line + "Raycast Design Language Rules" section are wrong and should be
replaced with a pointer here. `BRAND-BIBLE.md` + `docs/tokens.md` etc. should be regenerated
from `globals.css` or deleted. Tracked, not yet done.
