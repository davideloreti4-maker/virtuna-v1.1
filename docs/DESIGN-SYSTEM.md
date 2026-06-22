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
Flat-warm **charcoal** surfaces + **cream** text + **terracotta** accent + **matte** depth
(no glass gradients, no glow, no white inset-shine). Inter for all chrome; Newsreader serif
**only** for voice-moments (greeting/hero). The old cold-black `#07080a` Raycast glass system is dead.

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
| Accent | `--coral-500` / `--color-accent` | `oklch(0.68 0.13 33)` ≈ `#d97757` terracotta (**not `#FF7F50`**) |
| Accent foreground | | `#1a0f0a` (dark brown) |

### Border / depth
- Borders: `rgba(255,255,255,0.06)`, hover `rgba(255,255,255,0.1)`. (6% / 10% — unchanged from before.)
- **Matte, not glass.** Glass 137° gradients, radial halos, white inset-shine, coral glow are all **REMOVED**.
- Only `--shadow-float` (`0 10px 30px rgba(0,0,0,.35)`) — and only on genuinely floating surfaces (composer, popovers). Cards are flat (solid charcoal, border only).

### Type
- Sans: `--font-inter` — all UI chrome, all weights.
- Serif: `--font-newsreader` — **voice-moments ONLY** (greeting line, hero). Never body/chrome.

### Radius scale
`4 / 6 / 8 / 12 / 16 / 20 / 24` px. Cards 12, inputs/buttons 8, header 16, modals 12.

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
