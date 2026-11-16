# Visual language — Stage, calmer type, coral

> **Design, 2026-11-16.** Stage 2 of the app overhaul. Stage 1 is
> `2026-11-16-platform-structure-design.md`.
> **Mockups:** https://claude.ai/artifact/W2MCUgtSm8fLGgSSyHwbVR, page "Look", boards "Chosen
> look · …" (ten phone screens and the desktop layout). The three directions it was picked from
> are above them on the same page.
> **Status: NOT APPROVED.** The owner picked the direction and the accent, then rejected the refined
> boards on 2026-11-16: "it looks like AI slop and not a billion dollar company in a lot of places".
> He also asked for the simulation overview (brain, engagement, audience), skills and the chat to be
> designed in depth, because using prediction and simulation "doesn't feel clear and smooth". The
> values below record the rejected round and are being reworked. Do not build from them.

## 1. What was decided, and by whom

| Decision | By | Date |
|---|---|---|
| Look: "Stage" with calmer type (wide heavy type only for the score and video captions) | Owner | 2026-11-16 |
| Accent: keep coral | Owner | 2026-11-16 |
| Every value in this document | Claude | 2026-11-16 |

This replaces the flat-warm charcoal system in `globals.css` and the unfinished Claude Desktop
adoption in the worktree `design/claude-adoption`. That worktree's work is not merged.

## 2. Principles

1. **Black ground, the video and the number lead.** The interface is quiet so that covers and the
   score carry the screen.
2. **One accent, three jobs.** Coral appears on the Maven mark, on score numbers, and on the one
   main action of a screen. Nowhere else.
3. **Never colour for "problem".** A wrong call, a low score and an error are said in words and
   weight. Red is not a warning colour here, because coral is the brand.
4. **One family.** Archivo everywhere. Width and weight do the work that a second typeface did.
5. **Filled shapes, not hairlines.** Cards are a darker fill on black. Borders are used only on
   inputs.
6. **Sentence case.** No uppercase labels. Capitals belong to video captions, which are content.

## 3. Colour

| Token | Value | Use | Contrast on black |
|---|---|---|---|
| `ground` | `#000000` | Page and phone ground | — |
| `surface` | `#111114` | Cards, rows, input fill | — |
| `surface-raised` | `#1A1A1E` | Chips, secondary buttons, bubbles, selected nav | — |
| `line` | `#2A2A30` | Input border only | — |
| `text` | `#FFFFFF` | Primary text | 21 : 1 |
| `text-2` | `#B2B2BB` | Secondary text | 10.0 : 1 |
| `text-3` | `#84848E` | Labels, meta, placeholders | 5.7 : 1 (5.1 : 1 on `surface`) |
| `accent` | `#FF6363` | Mark, score numbers, the main action | 7.2 : 1 |
| `on-accent` | `#0A0A0A` | Text on the accent | 6.8 : 1 on `accent` |
| `on-light` | `#000000` | Text on white pills | 21 : 1 |
| `scrim` | `rgba(0,0,0,0.55)` | Buttons over video | — |

- White is allowed. The old rule "never `#fff`" ends with the old system.
- Video covers bring their own colour. The interface never tints itself to match them.

## 4. Type

Family: **Archivo** (variable: width 62–125, weight 100–900), loaded once.

| Role | Size / line | Weight | Width | Use |
|---|---|---|---|---|
| Score | 132 / 0.78 | 900 | 125 | The headline number on Check |
| Score, small | 26–44 / 1 | 900 | 122 | Scores in rows and headers |
| Count | 96 / 0.9 | 900 | 125 | The counter while a check runs |
| Figure | 29–40 / 1 | 900 | 122 | "9 of 12", "about $19 a video" |
| Caption on video | 19–40 / 0.95 | 900 | 120–125 | Cover and feed captions |
| Screen title | 28 / 1.1 | 700 | 100 | "Today", "Results" |
| Entry headline | 36 / 1.08 | 800 | 100 | The public first screen |
| Hook | 20 / 1.3 | 700 | 100 | The hook on a video |
| Maven's voice | 16–17 / 1.4 | 500 | 100 | Sentences Maven says |
| Body | 14–15 / 1.4 | 500 | 100 | Script beats, fixes |
| Row title | 15 / 1.3 | 600 | 100 | Rows and cards |
| Meta | 13 / 1.35 | 500 | 100 | Second line of a row |
| Label | 13 | 600 | 100 | Section labels, sentence case |
| Tab label | 11 | 600 | 100 | Bottom tabs |

- Wide heavy type is reserved for numbers and video captions. Titles, labels and buttons never
  use it.
- The smallest text is 11 px, used only for tab labels. Everything else is 12 px or larger.
- Tracking: −0.02 em on titles, −0.03 to −0.04 em on large numbers, 0 elsewhere.

## 5. Shape and space

| Thing | Value |
|---|---|
| Row and card radius | 18 |
| Video tile radius | 20 |
| Thumbnail radius | 10 |
| Buttons, chips, inputs, tabs of a stage | Full pill |
| Main button height | 54 (40 when inside a row) |
| Secondary pill height | 34–36 |
| Dock field height | 52 |
| Tab bar height | 60 |
| Screen side padding | 20 |
| Gap between rows | 8 |
| Gap before a section label | 20 |
| Touch target | 44 minimum |

No shadows, no gradients, no glass, no borders on cards.

## 6. Components

- **Main action:** coral pill, text `on-accent`, weight 800. One per screen.
- **Secondary action:** `surface-raised` pill, white text, weight 700.
- **Inline action** (Apply, Open, Check on a row): white pill, black text, 34 high.
- **Chip** (suggested actions, Undo): `surface-raised` pill, 36 high, weight 600.
- **Row:** `surface` fill, radius 18, padding 13 × 16. Title, one meta line, one thing on the right:
  a white pill, a coral score, or a share in words.
- **Score header on a video:** a row with the small score, "of 10 would stop", the freshness line,
  and "Check again" as the main action when the score is out of date.
- **Stage tabs on a video:** pills. Current is white with black text. Stages that are not built yet
  look like the others; they open an explanation, not a dead end.
- **Maven dock:** `surface` pill with a `line` border, the coral mark at its left, a placeholder
  that names what it does on this screen.
- **Maven's voice:** the coral mark, then plain text with no bubble. The creator's messages sit in
  a `surface-raised` bubble at the right.
- **Bottom tabs:** icon and label. Current is white, the rest `text-3`. The accent is not used.
- **Verdict pill** (Right, Wrong): `surface-raised`, white text. Same look for both.
- **Video tile:** the cover fills the tile. A white tag at the top for an order word
  ("Strongest today"), the caption at the bottom.
- **Full-screen video:** the video fills the screen above the dock. Filter pills at the top; the
  caption, one sentence on why it works, the main action and two scrim buttons at the bottom.
- **Desktop:** left navigation 228 wide with pill items, main area, Maven pane 372 wide. The same
  components at the same sizes.

Icons: one line set, 2 px stroke, round caps, 22 px. The mockups use hand-drawn stand-ins; the
build picks one licensed set.

## 7. Video

- Covers and footage are the only large colour on a screen.
- Text over video is white on the footage with a scrim behind buttons. Sentences over video need
  4.5 : 1; where footage is too light, a bottom scrim is added.
- The mockups use flat colour blocks with caption text. **The look has to be re-judged with real
  footage** before the build of Find and Today is called done.

## 8. Motion

Not designed in this document. The rules it must follow:

- The check's count-up and the score landing are the one moment that may be theatrical.
- Everything else moves fast and short; nothing loops on an idle screen.
- `prefers-reduced-motion` removes the count-up animation and shows the number when it is ready.

## 9. What changes in the code

- `src/app/globals.css` `@theme`: surfaces, text ramp and accent values are replaced by section 3.
  The dead `--color-coral-*` and `--color-signal-*` primitives are deleted.
- Fonts: Archivo replaces Inter and Newsreader. Serif leaves the product.
- Radius scale: the six-step scale collapses to 10, 18, 20 and full.
- `docs/DESIGN-SYSTEM.md` is rewritten from this document. The guard
  `src/app/__tests__/design-token-drift.test.ts` is kept and pointed at the new table.
- `reskin-matte.test.ts` and the "never `#fff`" checks are retired with the rules they guard.
- The repo `CLAUDE.md` design section is rewritten: the accent rule becomes section 2, rule 2.
- The marketing and offer pages move to the same language in their own part.

## 10. Not decided here

- Motion, in detail.
- The icon set.
- A light theme. "Daylight" on the canvas is the candidate if one is wanted later.
- Whether the gull mark is redrawn for this weight of type.
- Charts (the watch-through curve, the account view). They need their own pass in these colours.

## 11. How a screen is accepted

A built screen is compared side by side with its board at 390 × 844 and at 1440 × 900. Colours,
type sizes and radii are read from the browser and checked against sections 3 to 5. A screen is not
done on the strength of its tests alone.
