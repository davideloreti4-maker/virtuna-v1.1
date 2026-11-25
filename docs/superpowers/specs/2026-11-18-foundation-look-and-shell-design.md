# Foundation: the new look and the app shell

Date: 2026-11-18 · Status: approved by the owner 2026-11-18 ("go") · Build part 1 of 6
Plan: `docs/superpowers/plans/2026-11-19-foundation-look-and-shell.md` (on branch `design/next-look`; it lists where the build departs from this spec)

Supersedes `2026-11-16-visual-language-design.md` (rejected) and the tab set in
`2026-11-16-platform-structure-design.md`. The accepted mocks are the reference:
`.scratch/app-screens/app-v11-phone.jpg`, `app-v11-desktop.jpg` (source
`.scratch/app-screens/design/app.html`, handoff `.scratch/app-screens/HANDOFF.md`).

## 1. What this part delivers

1. The new look as design tokens (colour, type, radius, elevation, motion), light and dark.
2. A switch that turns the new look on without changing production: one flag.
3. The app shell in the new look: the phone tab bar, the desktop sidebar, the page frame.
4. The six base parts every later surface is built from: card, button, icon button, chip, tag, sheet.
5. Docs and guards updated so the next agent or designer reads the right system.

Not in this part: any page content (Home, threads, the result page, Library, Audience, Discover,
first run, plans, account), the gauge, the ring, the curves and the brain. Those come with the
surface that owns them. Marketing, landing, onboarding and offer route groups are untouched.

## 2. Rulings this rests on (owner, 2026-11-18)

| Ruling | Source |
|---|---|
| The new look replaces the locked flat-warm charcoal system | "yes" |
| Light is the default | "light" |
| Places: Home, Discover, Library, Audience, plus one button for a new chat | v11, Library option A picked |
| The tab bar shows on the four places only; a message field is docked only inside a thread; never both | 2026-11-18 |
| Buttons are ink (light) or white (dark), never coral | standing rule |
| Green = 6+ points above usual, coral = 6+ below, otherwise neutral | standing rule |
| About a dozen things per screen; show it through UI, not text; copy short and plain | standing rules |

## 3. Principles

1. **The ground is neutral. Footage and state carry the colour.** No decorative colour, no gradients as decoration.
2. **One meaning per colour.** Green and coral only say "against your usual". Ink is action. The coral mark is the brand and nothing else.
3. **Depth is quiet.** Light: a hairline plus a soft layered shadow. Dark: a step in surface tone, no glow.
4. **Glass only where chrome floats over content:** the tab bar, the message field, controls on a video. Never on cards.
5. **One primary action per card and per screen.** It is the only filled ink button in view.
6. **One typeface.** Inter. Every number is tabular. The serif leaves the app.

## 4. Tokens

`src/app/globals.css` stays the only authority. The new look reuses the existing semantic token
names wherever the role is the same, so screens that already consume `text-foreground`,
`bg-surface`, `border-border` and `bg-action` follow without edits. New roles get new names.

### 4.1 Colour

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
| `--color-track` (new) | empty part of a gauge or progress line | `rgba(18, 18, 17, 0.07)` | `rgba(255, 255, 255, 0.09)` |
| `--color-above` (new) | 6+ above usual, graphic and text | `#17783b` | `#62d892` |
| `--color-above-soft` (new) | its pill background | `#e3f3e8` | `rgba(98, 216, 146, 0.14)` |
| `--color-below` (new) | 6+ below usual, graphic | `#ec4a35` | `#ff5f4c` |
| `--color-below-text` (new) | 6+ below usual, text | `#c5371f` | `#ff8778` |
| `--color-below-soft` (new) | its pill background | `#fde9e4` | `rgba(255, 98, 80, 0.16)` |
| `--color-glass` (new) | floating chrome fill | `rgba(255, 255, 255, 0.78)` | `rgba(30, 30, 33, 0.78)` |
| `--color-scrim` (new) | behind a sheet | `rgba(0, 0, 0, 0.42)` | `rgba(0, 0, 0, 0.6)` |
| `--color-accent` | the brand mark only | `#FF6363` | `#FF6363` |

Rules:

- `--color-foreground-muted` never carries information on its own (3.1:1 in light). Use it for
  placeholders, the "%" beside a number, disabled controls. Under `prefers-contrast: more` it steps
  up to `--color-foreground-secondary` (the existing mechanism).
- `--color-below` is for arcs, dots and curves. Text uses `--color-below-text`.
- `--color-success` aliases `--color-above`; `--color-error` aliases `--color-below-text`.
  `--color-warning` and `--color-info` keep their values and appear in system toasts only.
- Dark hex values stay exact hex (Tailwind v4 compiles oklch with L < 0.15 wrong).

Measured contrast (WCAG ratio, text needs 4.5, graphics 3):

| Pair | Light | Dark |
|---|---|---|
| text on ground / on card | 16.9 / 18.7 | 18.5 / 17.2 |
| secondary text on ground / on card | 4.7 / 4.9 | 7.3 / 7.1 |
| muted on card | 3.1 | 3.4 |
| above, as text on card | 5.6 | 10.4 |
| below-text on card / on its pill | 5.3 / 4.6 | 7.9 |
| below, as graphic on card | 3.8 | 6.2 |
| text on the primary button | 18.7 | 18.2 |

### 4.2 Type

Inter variable (already loaded in `src/app/layout.tsx`). Newsreader is no longer used inside the app
under the new look. `font-variant-numeric: tabular-nums` on every number.

Four weights: 430 text, 560 label, 640 title, 700 number and screen title.

| Role | Token | Size / line | Weight | Tracking |
|---|---|---|---|---|
| Screen title (Library, Audience) | `--text-3xl` (exists) | 30 / 35 | 700 | -0.035em |
| Verdict line | `--text-heading` (exists) | 22 / 26 | 640 | -0.02em |
| Title: nav title, card title | `--text-title` (exists) | 16 / 22 | 640 | -0.01em |
| Text | `--text-ui` (new) | 15 / 21 | 430 | -0.009em |
| Meta | `--text-meta` (new) | 13 / 18 | 430 or 560 | 0 |
| Small label | `--text-label` (exists) | 12 / 18 | 560 | 0 |
| Tab label | `--text-micro` (exists) | 10 / 14 | 560 | 0.01em |
| Figure | `--text-figure` (new) | 62 / 58 | 700 | -0.055em |
| Large figure | `--text-figure-lg` (new) | 76 / 72 | 700 | -0.055em |

No uppercase labels. No label above content that the content already explains.

### 4.3 Radius

The existing scale stays; one step is added. Nested corners follow inner = outer minus the gap.

| Use | Token | Value |
|---|---|---|
| Thumbnail, small media | `--radius-lg` | 12 |
| Button, media inside a card | `--radius-xl` | 16 |
| Tile, card inside a card | `--radius-2xl` | 20 |
| Card | `--radius-3xl` | 24 |
| Tab bar, sheet top, message field | `--radius-4xl` (new) | 32 |
| Chip, tag, icon button | `--radius-full` | pill |

### 4.4 Elevation

The existing depth tokens keep their names and get new values under the new look. Every card
shadow starts with the hairline.

| Token | Use | Light | Dark |
|---|---|---|---|
| `--shadow-rest` | card | `0 0 0 1px var(--color-border), 0 1px 1px rgba(0,0,0,.03), 0 10px 26px -12px rgba(0,0,0,.10), 0 34px 60px -34px rgba(0,0,0,.14)` | `0 0 0 1px var(--color-border), inset 0 1px 0 rgba(255,255,255,.045), 0 24px 50px -24px rgba(0,0,0,.9)` |
| `--shadow-lift` | card hovered (desktop) | `0 0 0 1px var(--color-border-hover), 0 14px 30px -12px rgba(0,0,0,.16), 0 40px 70px -34px rgba(0,0,0,.18)` | as rest, with `--color-border-hover` |
| `--shadow-press` | pressed | `0 0 0 1px var(--color-border), 0 1px 2px rgba(0,0,0,.06)` | `0 0 0 1px var(--color-border)` |
| `--shadow-float` | tab bar, message field, popover | `0 0 0 1px var(--color-border), 0 14px 34px -12px rgba(0,0,0,.30)` | `0 0 0 1px var(--color-border), 0 14px 34px -12px rgba(0,0,0,.7)` |
| `--shadow-button` | primary button | `inset 0 1px 0 rgba(255,255,255,.16), 0 10px 20px -10px rgba(0,0,0,.45)` | `none` |
| `--shadow-sheet` (new) | sheet | `0 -20px 50px rgba(0,0,0,.3)` | `0 -20px 50px rgba(0,0,0,.6)` |

Glass = `--color-glass` plus `backdrop-filter: blur(24px) saturate(1.6)`. Lightning CSS strips
`backdrop-filter` from classes, so it is applied as an inline style (existing repo rule). Under
`prefers-reduced-transparency: reduce` the central rule already removes the blur; the 0.78 fill
keeps the bar legible.

### 4.5 Space and motion

Spacing uses the existing 4-based scale. Phone page gutter 16. Gap between cards 12. Card padding 16.

Motion uses the existing duration and easing tokens. No new system.

| Moment | Motion |
|---|---|
| Press | scale to 0.98, `--duration-fast` |
| Tab or place change | no content animation; icon and label colour over `--duration-fast` |
| Sheet | slides up over `--duration-slow` with `--ease-out-quart`; scrim fades over `--duration-normal` |
| Sidebar collapse | as today |
| Page load | nothing animates in |

Reduced motion: fades only, no transforms (the existing central handling).

## 5. How the new look is switched on

### Options considered

| Option | What it means | Verdict |
|---|---|---|
| A. Same token names, new values under a scope | 300+ files that use the semantic tokens follow at once; old screens look rough inside the flag until rebuilt | **Chosen** |
| B. A second, parallel token set | Old screens stay dark inside a light shell; two systems and duplicate primitives for months | Rejected |
| C. Replace the values with no flag | Production changes look on the first merge | Rejected |

### Mechanics

- Flag: `NEXT_PUBLIC_NEW_LOOK=true`. Off by default, env-only like `NEXT_PUBLIC_AMBIENT_V2`.
- Flag on: the root layout renders `<html data-look="next" data-theme="light">`.
- `globals.css` gets two scoped blocks after `@theme`: `[data-look="next"] { … }` with the light
  values of section 4 and `[data-look="next"][data-theme="dark"] { … }` with the dark values.
- `@theme` gains only the new token names (`--color-track`, `--color-above*`, `--color-below*`,
  `--color-glass`, `--color-scrim`, `--text-ui`, `--text-meta`, `--text-figure*`, `--radius-4xl`,
  `--shadow-sheet`) so Tailwind generates their utilities. No existing value in `@theme` changes,
  and nothing uses the new names while the flag is off, so flag off renders exactly as today.
- Two custom variants: `@custom-variant next (&:is([data-look="next"] *));` for shape differences
  in shared primitives (`rounded-md next:rounded-xl`), and `dark` repointed from `.dark` to
  `[data-theme="dark"]` (4 `dark:` usages exist in `src`; no `.dark` class is applied anywhere).
- Legacy raw tokens are aliased inside the scope so files that use them directly stay legible:

| Legacy token | Points to |
|---|---|
| `--color-charcoal-app`, `--color-chrome`, `--color-charcoal-sidebar`, `--color-background-elevated` | `--color-background` |
| `--color-charcoal-thread`, `--color-charcoal-composer`, `--color-surface-thread` | `--color-surface` |
| `--color-charcoal-chip` | `--color-surface-elevated` |
| `--color-cream-primary` / `-secondary` / `-muted` | `--color-foreground` / `-secondary` / `-muted` |
| `--color-border-glass`, `--color-border-subtle` | `--color-border` |

- Old screens inside the flag are expected to look unfinished (literal `white/[0.06]` borders
  vanish on light, the serif greeting stays). Nobody patches them; each is replaced by its own part.
- Cut-over, after the last part: the scoped values move into `@theme`, the scope, the `next:`
  variant, the aliases and the dead tokens (`--color-coral-*`, `--color-signal-*`,
  `--color-charcoal-*`, `--color-cream-*`) are deleted.

### Theme

- Setting "Appearance": Light (default), Dark, Match system. Stored in `localStorage`
  (`maven-theme`); syncing it to the account is not part of this part.
- A small inline script in `<head>` sets `data-theme` before first paint, so there is no flash.
- `color-scheme` follows the theme so native controls and scrollbars match.

## 6. The shell

One place list feeds both layouts (`nav-config`):

| Place | Route | Icon (Phosphor, regular) |
|---|---|---|
| Home | `/home` | House |
| Discover | `/discover` | Compass |
| Library | `/library` | Folder |
| Audience | `/audience` | Users |
| New chat | the existing new-chat action | Plus |

Other signed-in routes (`analytics`, `calendar`, `competitors`, `feed`, `grow`, `referrals`,
`settings`, `saved`, `start`, `analyze`) keep working and are not in the navigation.

### 6.1 Phone (below 768px)

Tab bar:

- Floating pill: 12 from the left and right edges, `bottom: max(12px, calc(env(safe-area-inset-bottom) - 10px))`, height 64, `--radius-4xl`, glass, `--shadow-float`.
- Five slots: Home, Discover, the new-chat button, Library, Audience.
- A tab: icon 23, label in `--text-micro`, 3 apart. Inactive `--color-foreground-secondary`, active `--color-foreground`. No pill, no dot, no fill change.
- New chat: a 50 circle, `--color-action` fill, plus icon 22 in `--color-action-foreground`, `--shadow-button`.
- Each slot is at least 64 wide and 64 tall (touch target).
- Content under the bar: bottom padding 104 plus the safe area, and a 120 tall fade from `--color-background` to transparent so rows do not collide with the bar.

Where it shows:

| Screen | Tab bar | Docked message field |
|---|---|---|
| Home, Discover, Library, Audience | yes | no |
| A thread | no | yes |
| A result, a video, a sheet, first run, plans, account | no | no |

Removed under the new look on phone: the slide-in drawer, the hamburger tab and the reserved top
band (`--mobile-nav-band`). The list of threads lives in Library.

Two header patterns, provided by the shell as components:

- **Place header:** screen title left (`--text-3xl`), up to two trailing controls right.
- **Pushed header:** 40 tall; back button left, title centred (`--text-title`, one line, truncates), one trailing action right.

### 6.2 Desktop (768px and up)

Sidebar, 248 wide, on `--color-background` with no fill of its own and no divider:

1. Brand row: the mark at 26 in `--color-accent`, "Maven" at 17, weight 640.
2. New chat: 42 tall, `--radius-xl`, `--color-surface`, `--shadow-press`, icon 17, the existing shortcut hint at the right if one exists.
3. The four places: rows 38 tall, `--radius-lg`, icon 18, `--text-ui` at weight 560. Active row: `--color-active` fill and `--color-foreground`. Others `--color-foreground-secondary`.
4. "Recent": up to six threads, rows 34 tall, 14px, one line, truncated. The open thread uses the active style. Pin, rename and delete stay available on hover, as today.
5. Footer: avatar 30, name, credits as a tag. Opens account.

Kept from today: collapse to a 56 icon rail with the same shortcut and the persisted choice.
Below 1100 wide the sidebar starts collapsed.

Content frame: pages centre a column of at most 980; threads and reading use 720. A page title
sits 44 from the top in `--text-3xl`. Result and video pages use the two-column frame from the
mocks (their own parts).

## 7. Base parts

Each exists once. `src/components/ui` already has `button`, `card`, `badge` and `sheet`; those are
restyled in place with the `next:` variant, no forks. Chip and icon button are added there if no
existing part fills the role.

| Part | Spec |
|---|---|
| **Card** | `--color-surface`, `--radius-3xl`, `--shadow-rest`, padding 16. Never nested more than once; the inner one is a tile (`--radius-2xl`, no shadow, hairline only). |
| **Button, primary** | `--color-action` / `--color-action-foreground`, height 50 (56 when it is the screen's main action), `--radius-xl`, weight 640, `--shadow-button`. Icon left, optional chip right. One per card and per screen. |
| **Button, secondary** | `--color-surface-sunken`, text `--color-foreground`, same heights and radius, no shadow. |
| **Button, quiet** | text only, `--color-foreground-secondary`, for links like "See all". |
| **Icon button** | 38 circle, `--color-surface` with `--shadow-press` on the ground, or `--color-surface-sunken` on a card. Icon 18. Hit area 44. |
| **Chip** | height 36, pill, 14px at weight 560. On the ground: `--color-surface` with the hairline. Selected: `--color-action` fill. Under a card (next steps): `--color-surface-sunken`, height 32. |
| **Tag** | height 24, pill, 12px at weight 560, `--color-surface-sunken`, `--color-foreground-secondary`. State tags use the soft state colours. |
| **Sheet** | `--color-surface`, top corners `--radius-4xl`, `--shadow-sheet`, grab handle 38 by 5, over `--color-scrim`. |

States for every interactive part:

- Hover (pointer only): `--color-hover` overlay, or `--shadow-lift` for cards.
- Pressed: scale 0.98 and `--color-active`.
- Focus: a 2px ring in `--color-foreground`, 2px offset, on keyboard focus only.
- Disabled: 40% opacity, no shadow.

## 8. Docs and guards

- `docs/DESIGN-SYSTEM.md`: a new section "Next look (behind `NEXT_PUBLIC_NEW_LOOK`)" with the tables
  of section 4, light and dark. The current section stays as the record of the legacy look until
  cut-over, then goes.
- `src/app/__tests__/design-token-drift.test.ts`: extended to read the two scoped blocks and check
  every row of the new tables, both themes. The existing rows keep passing untouched.
- `src/components/reading/__tests__/reskin-matte.test.ts`: unchanged; it scans legacy files only.
- New guard, pure file-system test: under `src/components/shell/`, no hex literals, and
  `backdropFilter` only in the tab bar and the message field.
- New test: the contrast table in 4.1 is computed from the CSS and asserted (text pairs at least
  4.5, graphic pairs at least 3).
- Repo `CLAUDE.md`: a short "new look in progress behind a flag" note under the design section now;
  the section is rewritten at cut-over.
- Not yet read, to be read before touching anything they cover: `type-scale.test.ts`,
  `radius-scale.test.ts`, `card-surface-consistency.test.ts`, `command-palette-layer.test.ts`,
  `audience-presence.test.tsx`.

## 9. Code layout

| Unit | Does | Depends on |
|---|---|---|
| `globals.css` scoped blocks | the look | nothing |
| `src/lib/theme` | reads and sets the theme; the head script | `localStorage` |
| `src/components/shell/nav-config.ts` | the place list | nothing |
| `src/components/shell/tab-bar.tsx` | phone navigation | nav-config, router |
| `src/components/shell/side-nav.tsx` | desktop navigation; reuses the sidebar store and the thread hooks | nav-config, existing stores |
| `src/components/shell/place-header.tsx`, `pushed-header.tsx` | the two headers | base parts |
| `src/components/shell/next-shell.tsx` | the frame; decides bar or sidebar, and where the bar hides | the above |
| `src/components/app/app-shell.tsx` | picks the legacy shell or `next-shell` by the flag | flag |

`Sidebar.tsx` (910 lines) is not edited; the legacy shell keeps using it.

## 10. Done when

1. Flag off: `/home`, `/library`, `/discover` screenshots are identical to `main` before the change; all existing tests pass.
2. Flag on, 393 by 852: the tab bar shows on the four places, hides in a thread, and matches the mock crop side by side (`.scratch/app-screens/renders/a-light-phone-lib-ma.png`).
3. Flag on, 1440 by 900: the sidebar matches the mock crop (`a-light-desk-lib.png`); collapse and the thread actions work.
4. Light on first load with no flash; Dark and Match system work and persist.
5. The token and contrast tests pass for both themes; `tsc`, build and the full test run are green.
6. Keyboard: every shell control is reachable and shows the focus ring. `prefers-contrast: more` and `prefers-reduced-transparency: reduce` both render legibly.

Checked with raw Playwright (`animations: 'disabled'`, `caret: 'hide'`), per the repo rule.

## 11. Known gaps and risks

- On phone, with the drawer gone, Settings is reachable by URL only until the Home part adds the account entry.
- Old pages inside the flag look unfinished by design.
- The muted grey moved from 40% (mocks) to 46% for legibility; cards from radius 26 to 24, tiles 22 to 20, buttons 17 to 16, to stay on the existing scale; weights from a dozen to four. Visual checks against the mocks decide whether any of these needs to go back.
- The dark theme is the near-black of the mocks, not the old warm charcoal.
- The existing new-chat action and whether it has a shortcut were not located for this spec; the plan starts by finding them. The hint shows only if a shortcut exists.
- The five guard tests listed in section 8 were not read for this spec.

## 12. Build parts after this one

2. Result page on real simulation data (starts with a check of which mock numbers the engine produces).
3. Home, thread cards and the message field.
4. Library.
5. Audience, Discover and the video page.
6. First run, plans, account, the after-posting loop; then cut-over.
