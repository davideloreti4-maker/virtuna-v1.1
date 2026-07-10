# Handoff — Composer restyle, app-wide font weights, room + mobile fixes (2026-07-10)

**Worktree:** `~/virtuna-explore-c`
**Status:** ✅ **all shipped to `main`.** Nothing here is pending.

| PR | Merged as | Scope |
|---|---|---|
| #219 | `12ab509d` | composer restyle + restore app-wide font weights + collapsed-tab hover |
| #221 | `ec9cea83` | the ranked list survives a typed ask |
| #224 | `47d6502a` | idea card no longer overflows the mobile viewport |

---

## 1. What shipped

### Composer restyle (#219)
Modelled on the Claude / Perplexity composers. Three rules:
- **One bright thing** — the cream send disc is the only high-contrast element. The verb pill lost
  its border, its terracotta `✦`, and its semibold weight.
- **Air** — field `min-h` 46→72px, `p-3.5`→`p-4`, row gap `2.5`→`3.5`.
- **Left = intent, right = metadata** — `+` far left as a bare glyph; right cluster is
  `SIM-1 Flash|Max` + send.

`ModelTag` was **exported but rendered nowhere**, so the SIM-1 tier was invisible. It is now the
right-hand metadata slot.

The **dock backdrop** is scoped to thread mode deliberately: the audience tab above is narrower
(696px vs the box's 728px) and inset, so a wrapper-level backdrop painted flat page-colour into its
rounded top corners; and on the centered home the backdrop is *positioned* while the starter chips
are not, so it would paint over them.

The **open-room control row** closed a real bug: `onSubmitForm` checks `audienceOpen` **before** the
`evidenceFile` branch, so with the room open a staged screenshot was **silently discarded** on send.
`+` and the verb pill now hide while the room owns the field, and `onDragOver`/`onDrop` are guarded
(drag-drop bypassed the button entirely). The hidden `<input type="file">` **stays mounted** —
`handleUserSelectTool("profile")` clicks it by ref, and that must ride a real user gesture.

### The font-weight fix (#219) — resolved, do not re-litigate
`font-medium` / `font-semibold` / `font-bold` were **inert app-wide** (616 usages, 223 files, all
rendering at 400). In Tailwind v4's `@theme`, `--font-*` is the font-**family** namespace, so
`--font-medium: 500` generated `.font-medium { font-family: 500 }` and shadowed the built-in weight
utility. Deleting the four tokens restored 500/600/700.

**The typography sweep came back clean. No per-component fixes were needed.** The 616 number was
misleading: almost all are small text where 400→500/600 is invisible or intended. The only large
heavy text that renders is page titles (600/22px), `/start` stat numbers (600/28px), and the landing
page (600/36px headings, 700/36px pricing numbers) — all correct. The hero is Newsreader serif and
was never affected, because `--font-serif` *is* a family.

Swept at 1440px full-page and 390px mobile across `/audience` `/feed` `/library` `/calendar`
`/start` `/home` `/settings`, the marketing landing, and `/dev/cards`.

> **`/dev/cards` is the cheapest visual gate in the repo.** It renders every skill output through its
> real thread components, so one page clears Ideas/Hooks/Script/Remix/gauges/primitives at once.

### Ranked list survives a typed ask (#221)
A typed ask sets an ad-hoc `thought` as the focus subject. A thought has no card id, so it reaches
`AmbientRoom` as `focusId === undefined` — which the compare-reset effect read as a focus **change**
and used to clear `compareOpen`. It fired twice (leaving, and returning), so "How the room ranked
your N hooks" could never come back without a manual re-tap.

The reset was never what *hid* the list — the ranked view already hides while a thought is in focus,
because the stepper needs a card id. It only destroyed the state needed to **restore** it. The guard
ignores the transient null and holds the ref: returning to the SAME card restores the list; a
different card still resets, which is the real re-target.

Locked by `audience-lens/__tests__/ambient-room-compare.test.tsx` — 4 tests, exactly one fails
without the guard.

### Mobile idea-card overflow (#224)
`/start` had a **139px horizontal scroll** at 390px. A grid item defaults to `min-width: auto`, so
`IdeaCard` could not shrink below its min-content and was floored at 513px inside a 358px column.
The same floor starved `CardReaction`'s `truncate` of shrink pressure, so the quote never ellipsized
— it just pushed the card wider. `min-w-0` fixed both. See `docs/DESIGN-SYSTEM.md` §Layout traps.

**Not a #219 regression:** flattening every weight back to 400 moves the card's width by 2px, not 155.

---

## 2. Open — the next session's work

- **`/feed` has a 35px horizontal overflow at 390px.** Found while sweeping for the `/start` bug;
  deliberately left out of #224 to keep that diff reviewable. Cause not yet investigated. Start with
  the detection recipe in `docs/DESIGN-SYSTEM.md` §Layout traps — the worst silent overflow reported
  at a class of `mb-4`. Likely the same `min-width: auto` family, but **verify, don't assume**.
- **`audience-presence.tsx:690`** — the panel header's `border-b`. Cosmetic. It was the prime suspect
  for a hairline at the panel→composer seam. **It is not the seam.** Measured there: panel
  `border-bottom: 0`, box `border-top: 0`, panel `box-shadow: none`, and the box's `shadow-float`
  up-bleed is occluded. Magnified pixel crops of the seam are flat.
- **Ranked-list `focusByThought` on `/home`** — the composer calls it on *submit of an ask*, not on
  every keystroke. Earlier notes describing it as "typing clobbers the list" overstate it.

---

## 3. Gotchas — hard-won, still true

- **Do NOT leave a dev server running.** The owner runs several sessions at once and is memory-bound;
  a Claude background task gets signalled dead but still reports **exit 0**, so "restart succeeded"
  is not evidence the server is up. `curl` the port. Prefer spinning a server up, driving it, and
  killing it inside one command. `nohup … & disown` survives if you truly need it — then kill it.
- **Playwright screenshots hang here.** `browser_take_screenshot` times out on its font/stability
  wait because the ambient-room animations never settle. Use raw Playwright with
  `animations: 'disabled'` + `caret: 'hide'` + a tight `clip`, or verify via `getComputedStyle` /
  `getBoundingClientRect`.
- **`document.documentElement.scrollWidth` lies about horizontal overflow.** The app scrolls inside a
  `relative h-full overflow-auto` div, not on the document. Measure that element.
- **`--color-hover` is an overlay tint** (`rgba(255,255,255,0.05)`), not a fill. As `hover:bg-*` on
  anything floating over scrolling content it replaces the opaque fill and content shows through.
- **A flex gap is invisible to `textContent`.** `ModelTag` renders `SIM-1` + tier as two flex items;
  the space must live inside the first span **with `whitespace-pre`**, or you ship `SIM-1Flash`.
- **`[aria-hidden]` is a terrible test selector** — it matches every decorative icon. Use a
  `data-testid`.
- **`font-mono` micro-copy on `/feed` and `/calendar` is deliberate**, not a rendering fault. Cost one
  false-alarm investigation.
- **Prove a regression test fails without the fix.** Both #221 and #224 were confirmed by removing the
  fix and watching the failure reappear, in the browser and in vitest.
- Test runner: `node ./node_modules/vitest/vitest.mjs run` (`npm test` / `npx vitest` print fake
  `PASS(0)`).
- **Baseline suite: 38 failures.** They are pre-existing on `origin/main` (a `No QueryClient set`
  provider gap plus a few API-stream tests). Confirm any new failure against `origin/main` before
  believing it is yours. `audience-presence.test.tsx` fails 2/43 on main — not a regression.
- Dev server (owner's terminal): `NODE_OPTIONS=--max-old-space-size=2048 node
  ./node_modules/next/dist/bin/next dev -p 3002` (direct node, not `npx`).
- E2E login: `e2e-test@virtuna.local` / `e2e-test-password-2026`.
- **`lane/explore-c`'s upstream is `origin/main`.** A bare `git push` from that worktree pushes to
  **main**. Always name the remote and branch.
