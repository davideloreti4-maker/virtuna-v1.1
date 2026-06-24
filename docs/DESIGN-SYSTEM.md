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
Flat-warm **charcoal** surfaces + **cream** text + a **signal-red accent used sparingly** +
**matte** depth (no glass gradients, no glow, no white inset-shine). Primary actions are
**neutral cream**, not accent. Inter for all chrome; serif **only** for voice-moments
(greeting/hero). The old cold-black `#07080a` Raycast glass system is dead — and as of
**2026-06-24** the terracotta accent is retired too (read too close to Claude). See
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
| Accent (solid) | `--signal-500` / `--color-accent` | `#e23b2d` signal red — the logo mark (**not terracotta `#d97757`, not `#FF7F50`**) |
| Accent (text/icon) | `--color-accent-text` / `--signal-400` | `#ef6e62` (legible red on dark) |
| Accent soft (tint bg) | `--color-accent-soft` | `rgba(226,59,45,0.16)` |
| Accent foreground | `--color-accent-foreground` | `#f6e9e6` (cream glyph on solid red) |
| **Primary action** | `--color-action` | `#ece7de` cream — buttons/send are NEUTRAL, not accent |
| Action foreground | `--color-action-foreground` | `#1c1b19` (dark glyph on cream) |

### Border / depth
- Borders: `rgba(255,255,255,0.06)`, hover `rgba(255,255,255,0.1)`. (6% / 10% — unchanged from before.)
- **Matte, not glass.** Glass 137° gradients, radial halos, white inset-shine, coral glow are all **REMOVED**.
- Only `--shadow-float` (`0 10px 30px rgba(0,0,0,.35)`) — and only on genuinely floating surfaces (composer, popovers). Cards are flat (solid charcoal, border only).

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

**Why this hard line:** at near-zero dosage the *hue* barely registers, so (a) the Claude
resemblance dies on any color, and (b) red's error/destructive meaning never misfires. `--color-error`
stays reserved for genuine destructive/error states; accent red ≠ error red, never conflated.

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
3. No glass gradients, no glow, no inset white-shine. Flat + border + (rarely) `--shadow-float`.
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
