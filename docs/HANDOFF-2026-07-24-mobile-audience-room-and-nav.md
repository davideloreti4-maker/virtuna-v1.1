# Handoff — mobile audience room + mobile top navigation (2026-07-24)

**Branch:** `fix/mobile-audience-v2` · **PR** #382 · **Worktree** `~/virtuna-mobile-audience` (dev :3021)
**Base:** `main` @ `99c494d1`
**Run the dev server with `NEXT_PUBLIC_AMBIENT_V2=true`** — everything below is behind that flag.

---

## 1. The bug that started it

`AMBIENT_V2_ENABLED` gated **exactly one line** in `composer.tsx`:

```tsx
createPortal(AMBIENT_V2_ENABLED ? audienceRailV2 : audienceRail, railHost)   // ≥xl ONLY
```

The `<xl` header slot immediately below it rendered `<AudiencePresence variant="header">`
**unconditionally**. So a phone showed the RETIRED room — constellation crown, "General · 10 people
ready", the two-column "say hi →" cast — while a desktop on the same account showed the ranked v2
board. One product, two rooms, for as long as the flag has existed.

> **A feature flag that swaps one breakpoint ships two products.** `grep AMBIENT_V2_ENABLED` found
> 12 call sites; the one that mattered was the site that *didn't* appear. When a report says "mobile
> still has the old design", check the breakpoint fork before you check the flag.

## 2. What shipped

### The room (`AmbientOverviewSheet` — new)

A collapsed **bar** that opens the room **full screen**. Inside is the *same* `AmbientOverviewRail`
the desktop rail mounts — same live audience, same projected-card ledger, same persisted seals, same
Overview ⇄ ARM ⇄ Detail flow. Mobile is not a lesser room.

- **Full screen, not a dropdown.** First pass capped it at 72dvh; every v2 surface is TALL (the cortex
  figure, the attention scrubber, a 20-row board) and each became a letterbox — the ARM panel's
  "Simulate ↑" sat below the fold. The room is a place you go on a phone.
- **Portalled to `<body>`.** `position: fixed` is trapped by any ancestor with a transform /
  will-change; the thread and dock both use them, so anchored in place the overlay would have pinned
  itself to the composer instead of the viewport.
- **`z-[var(--z-modal)]` (400).** At `z-[80]` the fixed sidebar chrome (`--z-sidebar` = 250) floated
  on top and sat straight across the room's own title.
- The board keeps its **own header** in sheet mode (the bar that opened it is covered), and that
  header's caret is the way out at a 44px target — the only exit. The bar underneath goes `disabled`
  + `aria-hidden` while open: two controls both labelled "close" is a worse room.
- Escape closes; `body` scroll locks and is always restored; safe-area padding top/bottom.
- Rise-in is a CSS keyframe (`.ambient-room-in`), **not** a state-driven transition — the overlay
  mounts already-open, so there is no "before" frame, and faking one needs exactly the
  `setState-in-effect` the lint rule forbids.

### `presentation: "rail" | "sheet"`

New prop on `AmbientOverview` / `AmbientDetail` / `AmbientSimulate`, threaded through
`AmbientOverviewRail`. `sheet` drops the rail chrome its host now owns (440 cap, left hairline, own
`#181817` ground) and tightens the gutter to 18px. **Rail mode is byte-identical to before** —
verified live: `max-width 440px`, `border-left 1px`, own ground, 26px gutters, inert switch caret.

**Reuse this prop for any new v2 mount rather than forking a surface.**

### The mobile top navigation

The hamburger (`left-4 top-4`, 34px) is **gone**. It forced `<main>` to reserve a blanket 56px of top
padding on *every* mobile page purely to keep content out from under it.

It is now a **tab in the top row**, immediately left of the audience bar: same 45px height, same 12px
radius, same `#181817` ground, caret pointing right (the sidebar slides in from that edge). The two
read as one navigation row.

**The geometry is shared, not eyeballed twice.** `MOBILE_NAV` in `Sidebar.tsx` holds
gutter/top/height/width/gap; the fixed tab and the composer's in-flow header slot both lay themselves
out from it:

| export | value | who reads it |
|---|---|---|
| `MOBILE_NAV` | `{gutter:10, top:10, height:45, width:32, gap:8}` | the tab |
| `MOBILE_NAV_BAR_INSET` | `gutter + width + gap` = 50 | composer header slot `pl` |
| `MOBILE_NAV_BAND` | `top + height` = 55 | `<main>` top reservation, and the slot's `-mt` |

`AppShell` reserves the band on mobile so pages **without** an audience bar (`/audience`, `/settings`)
still clear the tab; `/home` cancels it so the bar sits *in* the band. Change a number in one place
and the row stays together.

⚠️ **Both the band and the slot insets ride CSS custom properties, not inline margin/padding.** An
inline value outranks the `md:` overrides and desktop would inherit the phone's geometry forever.

### The Start card

- **Ground `#1f1f1e` → `#181817`.** It was byte-identical to the page behind it, so the card had no
  surface of its own — only its 6% hairline said it was a card. Now darker than the page: a well the
  chips and tiles sit inside.
- **Conditions are TWO STACKED ROWS** — `Audience` / `Scene`, mono label left, dial right. (First pass
  put them side by side as two columns; the owner's read was that two columns still *are* one row.
  Corrected.) The old inline "General as TikTok · SIM-1 Flash" run had no per-control labels — the
  reader inferred what each pill WAS from its value — and at 390px it wrapped mid-sentence, breaking
  "as" away from what it joined.
- **The SIM fidelity dial left Start**, desktop and mobile. The model is a per-run choice and it lives
  on the composer, where the run is fired. `onFidelity` was removed from `AmbientStart` /
  `AmbientStartHome` rather than left dangling.
- Chip triggers take the **skill tile's `#242422`** fill (were `#262624`), so every tappable thing on
  Start is one family against the new ground. Pills hug their values — stretched to the full track
  they read as empty input boxes on a 640px desktop card.

### Mobile gutters: 32px → 10px per side

The headline finding is **not** that one value was too big — the empty Start was paying the gutter
**twice**, once from `HomePageLayout`'s wrapper and again from the Composer's own column. The
wrapper's padding is gone; the Composer's columns own the page gutter alone. The Start card's inner
padding also drops 28 → 20 below `sm`.

Desktop is untouched: the Start card and the composer dock still share their edge exactly
(both `x=478, w=728`) — the whole point of that 760 column.

---

## 3. Verification

Live, authenticated, against a real thread at **390 / 900 / 1440**:

| check | result |
|---|---|
| mobile room | `data-presentation="sheet"`, overlay 390×844, scroll 711 of 2109, close caret 44×44, body locked |
| ARM in the room | fits without scrolling (was below the fold at 72dvh) |
| round trip | bar → room → ARM → back → close → thread |
| nav row | tab `(10,10,32×45)`, bar `(50,10,330×45)` — same top, same height, exact 8px gap, both 12px radius |
| tab opens the drawer | yes |
| other mobile pages | `/audience` h1 at y=79 clears the tab's bottom at y=55 |
| gutters | card 10px left and right |
| desktop rail | `presentation="rail"`, max-w 440, left hairline 1px, own ground, 26px gutters — unchanged |
| desktop Start | tab hidden, `main` padding-top 0, card padding 28px, card/dock share x=478 w=728 |
| model dial | absent from Start; present in the composer (`Model: SIM-1 Flash`) |

`tsc` 0 · full suite **4449 passed / 0 failed** · `lint` 0 errors on every touched file
(`composer.tsx` keeps its 3 pre-existing `exhaustive-deps` warnings).

11 tests in `AmbientOverviewSheet.test.tsx`, including a **rail-mode contrast case** — without it the
`not.toMatch(/max-w-\[440px\]/)` guards are unfalsifiable (a selector that never matched anything
passes a negation for free).

---

## 4. Known, NOT fixed here

- **The Overview's "cast on call" footer renders zero avatars** on both rail and sheet — the label
  dangles alone. Present on `main` before this branch; left alone to keep the diff scoped.
- Removing the 56px band moved content up on **every** mobile page, not only `/home`. Intended, but
  wider than the original ask — worth a look at `/settings` and `/analyze` on a real phone.

## 5. Session hazard worth remembering

Work started in `~/virtuna-ambient-audience-v2` (it had the running dev server). Mid-session a
**second Claude session** began a thread-unification refactor in that same worktree — `composer.tsx`,
`chat-thread-view.tsx`, a new `persisted-thread-stream.tsx` — interleaving with these edits in one
working tree. The changes here were backed out of it surgically, its original branch
(`design/ambient-audience-v2`) restored, and this work rebuilt in a dedicated worktree.

**One branch ↔ one worktree ↔ one session.** A shared dev server is not a reason to share a worktree.
