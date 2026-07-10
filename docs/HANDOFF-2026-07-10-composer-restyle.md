# Handoff — Composer restyle + app-wide font-weight fix (2026-07-10)

**Branch:** `lane/explore-c` (rebased onto `origin/main` @ `cc401ac2`)
**Worktree:** `~/virtuna-explore-c`, dev server on **:3002**
**Status:** 3 commits, verified, **not merged**. One carries unreviewed visual risk — see §2.

---

## 1. What shipped

| Commit | Scope |
|---|---|
| `c22cdf82` | `fix(theme)` — restore `font-medium` / `font-semibold` / `font-bold` app-wide |
| `f4af0f89` | `feat(composer)` — restyle + dock backdrop + open-room control row |
| `6f3f0a76` | `fix(audience)` — collapsed room tab stays opaque on hover |

### Composer restyle
Modelled on the Claude / Perplexity composers. Three rules:
- **One bright thing** — the cream send disc (now a true circle) is the only high-contrast
  element. The verb pill lost its border, its terracotta `✦`, and its semibold weight; it is a
  quiet `rounded-full` capsule on `bg-white/[0.05]`.
- **Air** — field `min-h` 46→72px, `p-3.5`→`p-4`, row gap `2.5`→`3.5`. Empty box now ~156px.
- **Left = intent, right = metadata** — `+` moved to the far left as a bare glyph; the right
  cluster is `SIM-1 Flash|Max` + send.

Also: `ModelTag` was **exported but rendered nowhere**, so the SIM-1 tier was invisible to
users. It is now the right-hand metadata slot. `HomeStarter` chips moved below the dock.

### Dock backdrop
The floating dock wrapper was transparent, so scrolled messages stayed visible in a band under
the composer card. An opaque `bg-background` backdrop (`data-testid="composer-backdrop"`) now
sits behind the card's own footprint `+16px`. It is **scoped to thread mode** deliberately:
- the audience tab above is narrower (696px vs the box's 728px) and inset, so a wrapper-level
  backdrop painted flat page-colour into its rounded top corners;
- on the centered home the backdrop is *positioned* while the starter chips are not, so it
  would paint over them.

### Open-room control row
`onSubmitForm` checks `audienceOpen` **before** the `evidenceFile` branch (`composer.tsx`
~L1522). So with the room open, a staged screenshot was **silently discarded** on send and a
picked skill silently ignored. Fixed by hiding `+` and the verb pill while the room owns the
field (matching `ModelTag`, already hidden), and guarding `onDragOver`/`onDrop` — drag-drop
bypassed the button entirely. The hidden `<input type="file">` **stays mounted**:
`handleUserSelectTool("profile")` clicks it by ref, and that must ride a real user gesture.

---

## 2. ⚠️ THE OPEN RISK — do this first

`c22cdf82` restored real font weights across **616 usages in 223 files**.

The bug: in Tailwind v4's `@theme`, `--font-*` is the font-**family** namespace. `--font-medium: 500`
generated `.font-medium { font-family: 500 }`, shadowing the built-in weight utility. Every
`font-medium` / `font-semibold` / `font-bold` in the app rendered at **weight 400**.

**The mechanism is verified.** In-browser: `font-medium`→500, `font-semibold`→600,
`font-bold`→700, with `font-serif`→Newsreader and `font-sans`→Inter unaffected.

**The result is not.** Only `/home` has been looked at. Headings elsewhere that silently
rendered at 400 now render at 600; `font-bold` wordmarks jumped to 700.

### Next session, task 1
Browser-pass `/audience`, `/feed`, `/library`, `/calendar` (and `/start`) looking for text
that got *too heavy*. This is a taste check, not a correctness check — tests and `tsc` are green.

If something reads shouty, fix it **per-component** (drop that heading `font-semibold` →
`font-medium`). Do **not** revert `c22cdf82` — that would re-break the utilities app-wide. It is
isolated as its own commit purely so it *can* be reverted if the call goes the other way.

---

## 3. Verification performed

- `tsc --noEmit` → exit 0.
- Full suite: **38 failed / 3222 passed**. `origin/main` alone scores **exactly the same** —
  confirmed by checking out `origin/main` detached and re-running. **Zero regressions.**
  Those 38 are a pre-existing `No QueryClient set` provider gap in the `/home` tests.
- Matte guard (`reading/__tests__/reskin-matte.test.ts`) 38/38.
- Live browser (`:3002`, real Hooks run to reach the ranked-room state):
  - geometry — backdrop top == box top, width 728 == box width, 16px strip below, tab bottom ≤ backdrop top
  - hover — collapsed tab reads `rgb(50,49,46)`, alpha 1
  - open/closed room — `+`, verb pill, `SIM-1` all hide on open and restore on close
  - a dispatched `DragEvent` with a `chat.txt` payload while the room is open stages **nothing**
  - 0 console errors

---

## 4. Known-unfixed (deliberate, owner-deferred)

- **Ranked-list clobber.** Typing a thought while `How the room ranked your 5 hooks` is showing
  calls `focusByThought`, which swaps that list for a one-off reaction. Owner: "leave it, out of
  scope." One tap on the compare toggle brings it back.
- **`audience-presence.tsx:690`** — the panel header's `border-b`. Was the prime suspect for a
  hairline the owner reported at the panel→composer seam. **It is not the seam.** Measured
  there: panel `border-bottom: 0`, box `border-top: 0`, panel `box-shadow: none`, and the box's
  `shadow-float` 20px up-bleed is occluded (the panel's `z-[55]` beats the box's `auto` because
  neither `audience-presence` nor the box wrapper creates a stacking context). Magnified pixel
  crops of the seam are flat. The owner reports the line resolved after the backdrop/hover fixes.
- **`lane/explore-c`'s upstream is `origin/main`.** A bare `git push` from this worktree pushes
  to **main**. Always `git push origin lane/explore-c` explicitly. Consider `git branch
  --set-upstream-to=origin/lane/explore-c`.

---

## 5. Gotchas learned this session

- **Playwright screenshots hang here.** `browser_take_screenshot` times out on its font/stability
  wait because the ambient-room animations never settle. Use raw Playwright with
  `animations: 'disabled'` + `caret: 'hide'` + a tight `clip`, or verify via `getComputedStyle` /
  `getBoundingClientRect`.
- **`--color-hover` is an overlay tint** (`rgba(255,255,255,0.05)`), not a fill. As `hover:bg-*`
  on anything floating over scrolling content it replaces the opaque fill and the content shows
  through.
- **A flex gap is invisible to `textContent`.** `ModelTag` renders `SIM-1` + tier as two flex
  items; the space must live inside the first span **with `whitespace-pre`**, or flex layout
  collapses it and you ship `SIM-1Flash` (which it did, briefly).
- **`[aria-hidden]` is a terrible test selector** — it matches every decorative icon. Cost one
  false "backdrop present on centered home" alarm. Use a `data-testid`.
- Dev server: `NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3002`
  (direct node, not `npx`). Run it in your **own terminal** — as a Claude background task it got
  signalled dead twice mid-session.
- Test runner: `node ./node_modules/vitest/vitest.mjs run` (`npm test` / `npx vitest` print fake
  `PASS(0)`).
- E2E login: `e2e-test@virtuna.local` / `e2e-test-password-2026`.
