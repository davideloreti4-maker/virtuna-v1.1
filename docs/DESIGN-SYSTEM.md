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
Flat-warm **charcoal** surfaces + **cream** text + a **coral-red accent used sparingly** +
**matte** depth (no glass gradients, no glow, no white inset-shine). Primary actions are
**neutral cream**, not accent. Inter for all chrome; serif **only** for voice-moments
(greeting/hero). The old cold-black `#07080a` Raycast glass system is dead. The de-Claude
break is the **near-zero dosage**, not the hue — as of **2026-07-07** the accent is
**coral-red `#FF6363`**. (Hue history: terracotta `#d97757` → signal-red `#e23b2d` trialed and
reverted → coral-red `#FF6363`. The dosage rule survived every change.) See
**"Accent dosage (LOCKED)"** below.

⚠️ `--color-coral-*` and `--color-signal-*` are **dead layer-1 primitives** — 1 file each.
The live accent is `--color-accent` (31 files). Their inline comments still claim to be the
brand accent; they are not.

## Tokens (real values — `globals.css`)

### Color
> 🔒 **This table is verified against `globals.css` by `src/app/__tests__/design-token-drift.test.ts`.**
> Do not hand-edit a value here — change `globals.css` and the guard will tell you what to update.
> (Corrected 2026-08-07: five rows had drifted — bg, sidebar, composer, chip and the accent hue.)

| Role | Token | Value |
|---|---|---|
| App background | `--color-background` / `--color-charcoal-app` | `#1f1f1e` |
| Chrome (both rails) | `--color-chrome` | `#1a1a19` |
| Sidebar | `--color-charcoal-sidebar` | `#2c2c2b` (aliases `--color-charcoal-chip`) |
| Composer surface | `--color-charcoal-composer` | `#1a1a19` |
| Chip / lifted | `--color-charcoal-chip` | `#2c2c2b` |
| In-thread result card | `--color-charcoal-thread` | `#252524` |
| Primary text | `--color-cream-primary` | `#ece7de` (**never `#fff`**) |
| Secondary text | `--color-cream-secondary` | `#c2bdb4` |
| Muted text | `--color-cream-muted` | `#8a857c` |
| Accent (solid) | `--color-accent` | `#FF6363` coral-red (**not legacy `#FF7F50`, not terracotta `#d97757`**) |
| Accent (text/icon) | `--color-accent-text` | `#ff8080` — legible on dark |
| Accent soft (tint bg) | `--color-accent-soft` | `rgba(255, 99, 99, 0.16)` |
| Accent foreground | `--color-accent-foreground` | `#2a1212` (dark glyph on solid accent) |
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

- **Thread cards stay FLAT (owner-decided 2026-07-12).** In-thread skill cards (`bg-surface-sunken`
  generate frames + `bg-transparent` read frames) deliberately take **no** `.elev-rest`/`.elev-lift`.
  Evidence from side-by-side mocks on `/dev/cards`: `--shadow-rest`/`--shadow-lift` are imperceptible
  on `#1a1a19`-on-`#262624` (dark-on-dark), and a tonal lift fights the thread's carved-in grammar —
  the cards' depth already comes from **nested tone zones** (page → sunken card → darker proof unit).
  `.elev-lift` also implies whole-card clickability, which thread cards don't have. Don't re-open
  without new evidence.

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

### Surface sectioning (zones)
Group a surface's content into discrete **matte tone-zones** — NOT a diffuse background glow.
(The `SURFACE_RADIAL_BG` top-glow was retired from `/start` in the elevation pass: a faint
radial reads as low-fidelity, not premium. Prefer discrete zones.) A zone is a subtle
lighter-charcoal panel that chunks a section's cards:
- **Fill:** a hair lighter than the page bg — `#252320` over the `#1f1f1e` app bg (~1 tone-step).
- **Shape:** `rounded-2xl`, generous padding (`px-4 py-4`), **no border, no shadow.** The tone +
  padding do the grouping; the inner cards keep their own borders + `.elev-*` depth and pop
  against the zone (avoids the double-border / stacked-shadow busyness).
- **Rhythm:** a consistent `mt-4` between stacked zones.

This gives the "lit sections" effect (cf. Stanley's glow-sectioning) with matte tone instead of
glow, and mirrors how a card-based right rail already reads as sections. The human header
(greeting) floats **above** the zones, unzoned. Reference impl: `start-page.tsx` (Numbers ·
Daily ideas · Outliers zones). Any at-a-glance chrome (e.g. the progress rings) belongs anchored
to its content (beside the greeting), not floating as a top-center band.

### Type
- Sans: `--font-inter` — all UI chrome, all weights.
- Serif: `--font-serif` — **voice-moments ONLY** (greeting line, hero). Never body/chrome.
  Currently wired to **Newsreader**. Candidate swap → **Fraunces** (more optical character,
  further from Claude's serif feel). Swapping requires `next/font` wiring in the root layout
  — until then `--font-serif` stays Newsreader. Tracked as a follow-up, not blocking.
- Mono: `--font-mono` — **deliberate** micro-copy, not a bug. Carries surface subtitles and small
  uppercase labels (`/feed`'s subtitle; `/calendar`'s day names, `TAP TO PLACE`, legend, `REEL`).
  It reads as a rendering fault at first glance; it is not. Check `font-mono` in the source before
  "fixing" it.
- Weights: never declare `--font-medium` / `--font-semibold` / `--font-bold` in `@theme`. In
  Tailwind v4 `--font-*` is the font-**family** namespace, so those generate
  `.font-medium { font-family: 500 }` and shadow the built-in weight utilities — silently flattening
  the whole app to 400. The built-in `font-{medium,semibold,bold}` utilities already work. (Fixed
  2026-07-10, `c22cdf82`; this is why `--font-serif` correctly yields Newsreader.)

### Radius scale
`4 / 6 / 8 / 12 / 16 / 20 / 24` px. Cards 12, inputs/buttons 8, header 16, modals 12.

### Layout traps
- **A grid item needs `min-w-0`.** Grid (and flex) items default to `min-width: auto`, so a card
  cannot shrink below its own min-content no matter what `w-full` claims. On a narrow viewport the
  item keeps its intrinsic width and the page grows a horizontal scroll. It also starves any inner
  `truncate` of shrink pressure, so the text never ellipsizes — it just pushes the card wider.
  Every `w-full` grid item is a candidate. (Fixed on `IdeaCard` 2026-07-10, `47d6502a`: 513px card
  in a 358px column, 139px of page scroll.)
  Detect it: at 390px, find elements where `scrollWidth > clientWidth` while `overflow-x` computes
  to `visible` — a box whose content is wider than it is, that cannot scroll. Assert the page's real
  scroll container has `scrollWidth === innerWidth`; `document.documentElement.scrollWidth` lies here,
  because the app scrolls in a `relative h-full overflow-auto` div, not on the document.

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

## Brand mark & naming (updated 2026-07-07)

**The mark is the Maven gull** — a single bird in flight drawn as one tapered ink-brush
stroke (wings arched up, tips swept out, a soft dip at the body). **Monochrome, no color** —
one closed path filled with `currentColor`, so it inherits the surrounding text color on any
ground (cream on charcoal, charcoal on cream). It replaces the retired **stele "n"** mark.

- **Component:** `src/components/brand/maven-logo.tsx` → `<MavenMark size />` (bare mark,
  sidebar/favicon) and `<MavenLogo />` (mark + **"Maven"** wordmark, Inter, sentence-case).
- **Standalone assets:** `public/brand/maven-mark.svg` (charcoal `#1c1b19`, for light grounds)
  and `public/brand/maven-mark-light.svg` (cream `#ece7de`, for dark grounds).
- **Favicons:** `src/app/icon.svg` and `src/app/apple-icon.svg` — the gull in cream on a
  charcoal `#262624` tile (self-contained so it reads on any browser chrome).
- **Path (locked):** `M34 66 Q50 30 84 24 Q106 20 120 48 Q134 20 156 24 Q190 30 206 66 Q192 38
  158 34 Q138 32 120 58 Q102 32 82 34 Q48 38 34 66 Z` on `viewBox="0 0 240 96"`.

**Naming boundary (house of brands):** **Maven** is the creator app (the product name users
see — chrome, marketing, SEO/OG titles, the wordmark). **Numen Machines** is the company (it
signs the footer `© … Numen Machines` and stays). The engine/model is **Anima**. So a
Numen→Maven rename is *not* a blind find-replace: product strings → Maven; the company name,
the internal `NumenTier` billing type, engine/system-prompt internals (e.g. the "Numen
co-pilot" voice), and the `numen.*` localStorage keys deliberately stay Numen.

## Hard rules (the guard test enforces these)
`src/components/reading/__tests__/reskin-matte.test.ts` asserts NO coral-glow / NO glass in
reading components — keep it green. Generally:
1. No `#fff` text → use `--cream-primary`.
2. No `#FF7F50` / `#07080a` / `#18191a` (dead Raycast literals).
3. No glass gradients, no glow halo (`0 0 Npx`), no inset white-shine, no coral. Matte **dark** drop-shadows via the depth scale (`--shadow-rest`/`lift`/`press`/`float`, always with a vertical offset) ARE allowed — that is the Hybrid elevation lever.
4. Consume tokens, never hardcode hex. (Known offenders to migrate: `saved-item-card.tsx:234,252`, `error.tsx`, `opengraph-image.tsx`.)

## Accessibility preferences (2026-08-21)
`globals.css` handles two OS preferences centrally — never re-implement per component:
- `prefers-contrast: more` — hairlines 6%→16% (border tokens AND the literal
  `border-white/[0.06]` family), hover borders 10%→24%, `--color-foreground-muted` steps up
  to `--color-cream-secondary`. Resting values are unchanged; the guard's colour rows still
  describe the default state.
- `prefers-reduced-transparency: reduce` — kills every `backdrop-filter` (incl. inline-styled
  ones, via `!important`). Frosted fills all ship ≥0.75 alpha so surfaces stay legible.

Motion: the signed-in interaction contract is a pending proposal in `docs/MOTION-CONTRACT.md`;
the marketing scroll-reveal layer is `docs/motion-guidelines.md`.

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

## Next look (behind `NEXT_PUBLIC_NEW_LOOK`)

Owner ruling 2026-11-18: this look replaces the flat-warm charcoal system above; light is the
default. Until cut-over both exist. With the flag on, the root layout renders
`<html data-look="next" data-theme="light|dark">` and the scoped blocks in `globals.css`
(`:root[data-look="next"]` and `…[data-theme="dark"]`) re-value the semantic tokens. Spec:
`docs/superpowers/specs/2026-11-18-foundation-look-and-shell-design.md`.

Guards: `design-token-drift.test.ts` (every row below, both themes) and
`next-look-contrast.test.ts` (contrast computed from the CSS, cycles, completeness).
Scripts: `scripts/next-look-probe.cjs` records the flag-off app (tokens, `<html>` attributes,
landmarks, chrome screenshots) and `scripts/next-look-compare.cjs` compares two recordings.

### Next look: colour

| Token | Role | Light | Dark |
|---|---|---|---|
| `--color-background` | ground | `#f4f3f0` | `#08080a` |
| `--color-surface` | card | `#ffffff` | `#131315` |
| `--color-surface-elevated` | raised control on a card, tooltip | `#efeeea` | `#232326` |
| `--color-surface-sunken` | tint fill: secondary button, chip, search field | `rgba(18, 18, 17, 0.06)` | `rgba(255, 255, 255, 0.07)` |
| `--color-border` | hairline | `rgba(17, 17, 16, 0.06)` | `rgba(255, 255, 255, 0.075)` |
| `--color-border-hover` | hairline, hovered | `rgba(17, 17, 16, 0.12)` | `rgba(255, 255, 255, 0.14)` |
| `--color-foreground` | text, icons | `#121211` | `#f7f6f3` |
| `--color-foreground-secondary` | secondary text | `rgba(18, 18, 17, 0.6)` | `rgba(247, 246, 243, 0.62)` |
| `--color-foreground-muted` | placeholder, unit, disabled | `rgba(18, 18, 17, 0.46)` | `rgba(247, 246, 243, 0.38)` |
| `--color-action` | primary button | `#121211` | `#f7f6f3` |
| `--color-action-foreground` | text on the primary button | `#ffffff` | `#0b0b0c` |
| `--color-hover` | overlay tint on hover | `rgba(18, 18, 17, 0.04)` | `rgba(255, 255, 255, 0.05)` |
| `--color-active` | overlay tint, pressed or selected | `rgba(18, 18, 17, 0.08)` | `rgba(255, 255, 255, 0.1)` |
| `--color-track` | empty part of a gauge or progress line | `rgba(18, 18, 17, 0.07)` | `rgba(255, 255, 255, 0.09)` |
| `--color-gauge-track` | empty part of a thread gauge, the pack's progress line and the mini curve | `rgba(18, 18, 17, 0.12)` | `rgba(255, 255, 255, 0.17)` |
| `--color-above` | 6+ above usual, graphic and text | `#17783b` | `#62d892` |
| `--color-above-soft` | its pill background | `#e3f3e8` | `rgba(98, 216, 146, 0.14)` |
| `--color-below` | 6+ below usual, graphic | `#ec4a35` | `#ff5f4c` |
| `--color-below-text` | 6+ below usual, text | `#c5371f` | `#ff8778` |
| `--color-below-soft` | its pill background | `#fde9e4` | `rgba(255, 98, 80, 0.16)` |
| `--color-glass` | floating chrome fill | `rgba(255, 255, 255, 0.78)` | `rgba(30, 30, 33, 0.78)` |
| `--color-scrim` | behind a sheet | `rgba(0, 0, 0, 0.42)` | `rgba(0, 0, 0, 0.6)` |

`--color-accent` stays `#FF6363` and is the brand mark only. `--color-success` aliases
`--color-above`; `--color-error` aliases `--color-below-text`.

Rules: one meaning per colour (green and coral only say "against your usual"; ink is action).
`--color-foreground-muted` never carries information on its own. `--color-below` is for arcs,
dots and curves; text uses `--color-below-text`. Buttons are ink (light) or white (dark), never
coral.

### Next look: elevation

| Token | Use | Light | Dark |
|---|---|---|---|
| `--shadow-rest` | card | `0 0 0 1px var(--color-border), 0 1px 1px rgba(0, 0, 0, 0.03), 0 10px 26px -12px rgba(0, 0, 0, 0.1), 0 34px 60px -34px rgba(0, 0, 0, 0.14)` | `0 0 0 1px var(--color-border), inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 24px 50px -24px rgba(0, 0, 0, 0.9)` |
| `--shadow-lift` | card hovered (desktop) | `0 0 0 1px var(--color-border-hover), 0 14px 30px -12px rgba(0, 0, 0, 0.16), 0 40px 70px -34px rgba(0, 0, 0, 0.18)` | `0 0 0 1px var(--color-border-hover), inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 24px 50px -24px rgba(0, 0, 0, 0.9)` |
| `--shadow-press` | pressed | `0 0 0 1px var(--color-border), 0 1px 2px rgba(0, 0, 0, 0.06)` | `0 0 0 1px var(--color-border)` |
| `--shadow-control` | control resting on the ground: icon button, chip, New chat | `0 0 0 1px var(--color-border), 0 2px 6px -2px rgba(0, 0, 0, 0.12)` | `0 0 0 1px var(--color-border), 0 2px 6px -2px rgba(0, 0, 0, 0.12)` |
| `--shadow-float` | message field, popover and menu, desktop dialog, toast | `0 0 0 1px var(--color-border), 0 14px 34px -12px rgba(0, 0, 0, 0.3)` | `0 0 0 1px var(--color-border), 0 14px 34px -12px rgba(0, 0, 0, 0.7)` |
| `--shadow-button` | primary button | `inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 10px 20px -10px rgba(0, 0, 0, 0.45)` | `0 0 0 0 transparent` |
| `--shadow-sheet` | sheet | `0 -20px 50px rgba(0, 0, 0, 0.3)` | `0 -20px 50px rgba(0, 0, 0, 0.6)` |

Consume these as `shadow-[var(--shadow-float)]`. The utilities `shadow-float`, `shadow-button`
and `shadow-rest` carry the legacy value: Tailwind copies a shadow token into its utility at
build time. Glass = `bg-glass` plus `backdrop-filter: blur(24px) saturate(1.6)` as an inline
style, only where chrome floats over content (the message field, controls on a video). The
phone has no bottom tab bar: the left drawer, an opaque panel, is its one way around.

### Next look: type, radius, parts

Inter only. Four weights: `font-[430]` text, `font-[560]` label, `font-[640]` title, `font-bold`
numbers and screen titles. Every number is tabular.

| Role | Utility | Size / line |
|---|---|---|
| Screen title | `text-3xl font-bold leading-[35px] tracking-[-0.035em]` | 30 / 35 |
| Verdict line | `text-heading font-[640]` | 22 / 26 |
| Title | `text-title font-[640]` | 16 / 22 |
| Text | `text-ui` | 15 / 21 |
| Meta | `text-meta` | 13 / 18 |
| Small label | `text-label font-[560]` | 12 / 18 |
| Micro label (no user at present) | `text-micro font-[560]` | 10 / 14 |
| Figure | `text-figure font-bold` | 62 / 58 |
| Large figure | `text-figure-lg font-bold` | 76 / 72 |

Radius: thumbnail `rounded-lg` 12 · button `rounded-xl` 16 · tile `rounded-2xl` 20 · card
`rounded-3xl` 24 · sheet top, message field `rounded-4xl` 32 · chip, tag, icon button
`rounded-full`.

Parts (`src/components/ui`): `Card` and `Tile`, `Button` (`primary`, `secondary`, `quiet`; `lg`
is 50 tall, `xl` is 56), `IconButton`, `Chip`, `Badge` (the tag), `Sheet`. Shell
(`src/components/shell`): `SideNav` (desktop), `Drawer` with its `MenuButton` (phone; no tab
bar), `PlaceHeader`, `PushedHeader`, `NextShell`.

Result page (`src/components/result`, logic in `src/lib/result`; spec
`docs/superpowers/specs/2026-11-19-result-page-design.md`): `ResultPage` (loading, running,
stalled, not found, no audience, result), `VideoResult` (phone column / desktop grid), `Hero`,
`Player`, `Gauge`, `Curve` with `SceneStrip`, `Moment`, `CompactPlayer`, `PanelSwitch`,
`BrainPanel`, `EngagementPanel`, `AudiencePanel` with `AudienceRing`. One playhead for all of them:
`PlayheadProvider` / `usePlayhead()`. Rules of that page:

- Coral (`--color-below`, text `--color-below-text`, band `--color-below-soft`) marks one thing:
  the scene the sentence names (its part of the line, its tile in the strip, its wedges and rows).
- Tokens only; `result-guard.test.ts` enforces it. Glass exists in one place, the play mark on
  the video (`PlayMark` in `player.tsx`, blur as an inline style).
- The number is `headlineOf()` and nothing else; the craft grader's score is never shown.
- While the playhead moves, the readout shows a stored value (the end of the scene under it),
  and its dot sits at that point.
- The brain's porcelain look is `look="porcelain-light" | "porcelain-dark"` on `CortexCanvas`
  (`cortex-porcelain.ts`); the default `"scan"` is the legacy look, unchanged.
- To look at it: `/dev/result?fixture=<name>` and `node scripts/result-shots.cjs --out <dir>`.
- Each panel lays itself out for the width it gets, not the window's (container queries and
  `audienceLayoutFor`), so a tablet or a narrow window never cuts a part off.
- The running screen (`Running` with `RunningRing`; what the run's stream has said so far is
  `useRunStream` over `run-progress.ts`) holds three things: the pale ring of the viewer groups,
  the picture in its centre (the creator's video, else the scene frames in turn, else none) and
  the clock. No words but the header's "Simulating", nothing coral, no stage and no percent: the
  page's stream carries none, so the screen names none. Its moments on the dev page:
  `/dev/result?fixture=early&processing=1&elapsed=<s>&groups=<n>[&arriving=<k>][&runframes=<n>][&own=1]`.

The message field and the thread frame (`src/components/thread-next`; spec
`docs/superpowers/specs/2026-11-20-thread-field-design.md`): `ThreadField` (row 1 `+` · text · send,
row 2 the pills Simulate · Hooks · Script · Remix · More), `MoreSheet` (the other skills with prices,
the audience and the platform lens), `NextUserTurn` (the bubble, with a video tile), the "Maven" label
and `FollowupChips`. Rules of these parts:

- The field is the only glass in a thread (it floats over it); blur as an inline style only, and the
  folder's guard (`thread-next-guard.test.ts`) refuses colour literals, palette names and backdrop
  utilities.
- A pill's accessible name is the skill's name and never changes; its price is drawn when selected
  and read as a description ("1 credit"). A skill picked from More shows on More the same way.
- The field holds one attachment at a time and always says what the send does: a video selects
  Simulate, a file for a profile read returns the field to chat, picking a skill clears a staged file.
- Next-step chips sit under the last answer only.
- To look at it: `/dev/field?state=rest|hooks|typed|video|simulate|more|streaming`. To send from it in
  a browser on the dev server, open `localhost`, not `127.0.0.1` (the cross-site check refuses POSTs
  from a different host name).

Rules that are not in the spec:

- Navigation glyphs come from `src/components/shell/icons.tsx` (the reference's own drawings),
  not from Phosphor.
- The keyboard ring sits 2px outside a control by default. Inside scroll or overflow containers
  use `SHELL_FOCUS` (`nav-config.ts`), which draws the same ring inside.
- Under the flag a caller's plain class loses to a primitive's `next:` default: override with a
  `next:`-prefixed class.
- Write `next:` first in a class (`next:hover:…`): the parity test strips classes by that prefix.
- A press is `motion-safe:active:scale-[0.98]`, and its transition must cover `scale`.
