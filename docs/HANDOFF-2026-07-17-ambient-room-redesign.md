# The ambient audience — placement + craft redesign

**Worktree:** `~/virtuna-ambient-room` · **Branch:** `milestone/ambient-room-v2` · off `main` @ `1bdb5f53`
**Written:** 2026-07-17 (design session, no code written) · **Status:** plan only, nothing built

---

## 0. Read this first — I was wrong twice, and you will be too

This plan came out of a design session that reviewed the panel **from screenshots**, and got it
materially wrong **twice**:

1. I claimed the at-rest panel was a dead string (`General · 10 personas ready`). **False.** The
   at-rest panel already renders all ten by name with traits and a `say hi →` per person. I was
   reading the *collapsed band* and assuming the panel behind it matched.
2. I claimed "silence is louder than speech" — that the room is mostly `stopped — no words this
   time`. **False as a general claim.** That is the **uncalibrated `General`** fallback. With a
   calibrated audience (Zach King), *every* persona speaks with a differentiated quote.

Both errors have the same cause: **I reviewed the wrong state and never ran the thing.**

> ⛔ **P0 below is not optional.** Run the app, calibrate an audience, and look — before you touch
> a line. Re-verify every claim in this document against what's on screen. Cross-ref
> `[[green-test-is-the-accomplice]]` and the standing rule: *run it for real · measure your instrument.*

---

## 1. Scope

**In:** where the ambient audience lives (placement), and the craft of the panel itself.

**Out — do not start here:**
- **The persona voice.** The quotes read like a model grading homework, not people talking
  (*"Classic contrarian stance from this creator. I trust their analysis on audience psychology."*).
  This is the single biggest quality problem in the product and it is **a prompt problem, not a
  design one.** Owner has scoped it to its own session. Don't fix it here.
- Engine, grounding flags, corpus restoration, audience generation. All separately owned.

---

## 2. The decision

**The audience stops being attached to the composer.**

The composer is where you *type*. The room is who you're *talking to*. Fusing them makes the audience
a setting on a text field — which is why it reads as chrome no matter how well it's styled.
**The audience is a property of the thread, not of the input.** Every card in a thread was made for
those people.

| | Today | Target |
|---|---|---|
| **Desktop** | 40px band on the composer → blooms over the thread behind a scrim | **Rail** — its own column beside the thread. Never blooms, never dismisses |
| **Mobile** | same band → full-screen modal | **Header** — ~68px above the thread. Survives the keyboard |
| **Owner** | `composer.tsx` (~1939–1978) | thread-level |

**Owner approved the mobile header** (2026-07-17). Desktop rail is **proposed, not confirmed.**

### Why the header wins on mobile — the arithmetic that settled it

Keyboard up on a 390×844 phone, you have **458px** after the status bar (50) and keyboard (336):

| | Bottom deck | Header |
|---|---|---|
| Composer | 56 | 56 |
| **The audience** | **0** | **68** |
| The thread | 402 | 334 |
| Cards visible @ ~150px | 2 | 2 |

A bottom deck is bottom-anchored, so when the keyboard opens it rides off-screen with the composer or
collapses to give the thread room. **The instant you start writing, the thing you're writing *for*
disappears.** And it doesn't even buy a third card — 68px was never the difference between 2 and 3.
**The audience is free. You currently pay zero and get zero.**

Precedent: iMessage, WhatsApp, Slack all put *who you're talking to* at the top and the input at the
bottom. Nobody has ever put the recipient on the text field.

---

## 3. The craft problems (all verified in owner screenshots, 2026-07-17)

Owner's words: *"doesn't look like something clean and something a premium company would release."*

1. **Mid-word truncation in 4 of 10 roster rows.** `Likes, comments, tags fri…` ·
   `Watches silently, never r…` · `DMs relatable stuff to frie…` · `Knows the niche, spots c…`
   → Either write traits to a fixed budget (3–4 words) or give them the width. Not both-and-neither.
2. **Everything is stated 3–5×.** The population view says 70/30 as: the header fraction, two big
   numerals, a 1,000-dot matrix, a split bar, *and* `300 OF 1,000`. The at-rest view says
   `10 ready` in the header and `10 people ready` again as the headline.
   → **Premium is confidence. Repetition is anxiety.** Say it once.
3. **Repeated CTAs.** `say hi →` ×10, `ask →` ×8. When every row has the same button, the button is
   texture. → Make the row the target.
4. **No hierarchy inside lists.** Eight quotes at identical weight and length — and Robin, the *only*
   bounce, is last, in the same type as everyone else. → The bounce is the most valuable line on the
   page. Surface it.
5. **Dead wells.** Every view ends in a large empty `Ask your audience…` area — ~25% of the panel
   doing nothing, on all four screens.
6. **The header is a junk drawer.** glyph + name + live dot + `NOT CALIBRATED` pill + chevron +
   `10 ready` + chevron = 7 elements, two of them chevrons doing different jobs.
   → `10 ready` (ready for *what?*) becomes the count. One chevron. The pill becomes the empty state.

### The reference is already in the product

**The ranked view is the standard.** `IDEAS · RANKED` → one serif headline → ranked rows → one number
each → chevron. No repeated CTA, no truncation, no wall of text. **It's a *document*.** The other
three views are *forms* — rows of labels, buttons and bars. That's the entire gap.

> Its one flaw: ranks 1 and 2 are both `7/10` with identical bars — the ordering is asserted but never
> justified. Break the tie visibly, or don't number them.

### The zoom model you already have

Two real axes, already built:
- **Which candidate** — `‹ Idea 1 of 4 ›` / `⤺ all 4`
- **What resolution** — `The people` → `Population · 1,000`

Add the brain and axis 2 is a clean magnification: **1,000 → 10 → 1 cortex.** Present them as
*zoom levels*, not tabs — tabs say "three features", zoom says "one truth, three resolutions."
You don't need to invent this. It's missing its deepest stop.

---

## 4. The plan

### P0 — Look at it. Non-negotiable. (½ session)
- Run the dev server. Calibrate a real audience (**not** `General`). Drive: type → cards → band →
  panel → the people → population → rewrite.
- **Re-verify §3 against the screen.** The screenshots that produced this doc were from an old dev
  server and predate the brain.
- ⚠️ **Screenshots hang on this app** (ambient animation never settles). Read the DOM via
  `browser_evaluate`, or raw Playwright with `animations: 'disabled'`. See CLAUDE.md.
- Note what §3 got wrong. Amend this doc before building.

### P1 — Panel craft pass (placement-agnostic, safe, visible)
Internal to the panel; survives whatever placement wins. Take the ranked view's grammar as the bar.
1. Kill the truncation (§3.1)
2. De-duplicate the repeated facts (§3.2)
3. Row-as-target, drop the repeated CTAs (§3.3)
4. Hierarchy: bounces surface above stays (§3.4)
5. Reclaim the dead wells (§3.5)
6. Rebuild the header (§3.6)
7. Add a `not`-line to the people view — the population view already has one
   (`1,000 MODELED FROM YOUR 10`), the others don't. Steal Sapient's move: *every card states what it
   is not.*

### P2 — Placement (structural)
1. Re-parent the room out of `composer.tsx` to thread level
2. Mobile: the audience header (**owner-approved**)
3. Desktop: the rail (**needs owner sign-off first — do not build on spec**)
4. Kill the scrim + the bloom. It occupies; it does not overlay.
5. **Resolve the two-input problem** (§6) before writing the mobile sheet.

### P3 — Bugs (separable, some are one-liners)
See §5. `/dev/cards` and the orphaned routes are independent of everything else and can ship first
as easy wins.

---

## 5. Bugs found during the session (unverified against current main — check first)

**Panel-adjacent:**
- `DEFAULT_TOOL = "chat"` (`composer.tsx:155`) and Chat emits **no** ambient descriptors
  (`ambientDescriptors`, `composer.tsx:1730`, returns `[]` for everything except
  hooks/idea/script/remix) → **the moat is idle on arrival by default.**
- The collapsed band read `8 of 10` for an off-screen card while the visible card said `7/10`
  (scroll-spy focus resolving to something out of the viewport). A rail/header makes this
  impossible — they'd be side by side.
- `MADE FOR YOUR AUDIENCE` + *"Your audience over-indexes on budget + macros"* rendered over a
  `General · NOT CALIBRATED` audience. **A confident claim riding on nothing** — same shape as
  `[[read-ships-high-confidence-with-no-audience]]`. Check whether that eyebrow gates on calibration.
- The brain was absent from all four screenshots (only `The people` / `Population · 1,000`).
  Owner confirms those shots predate the brain — **verify on current main in P0.**

**Elsewhere:**
- `/dev/cards` ships to production — auth-gated only, **no `NODE_ENV` gate**, despite its header
  comment. `DevMockPanel` and `/api/dev/mock/*` both gate correctly; this doesn't.
- Four orphaned live pages — `/feed/hooks`, `/feed/channels`, `/competitors/[handle]`,
  `/competitors/compare`. The launch cut redirected the parents; Next sub-routes don't inherit.
- `/analyze` → `/start` → `/home` — stale two-hop; the comment still names `/start` as
  *"where every Read begins"*, which no longer exists.
- `/competitors` → `/feed?tab=competitors` — the redirect silently drops the query param.
- `account-read` is rated **STRUCTURAL** (worst tier) in `docs/subsystems/ui-skill-cards.md` §0.6
  *and* is starter card #6 — the one card that **runs on tap**.

**Token drift — resolve before styling anything:**
- `CLAUDE.md` says the accent is terracotta `#d97757`. `globals.css` says
  `--color-accent: #FF6363` (coral-red, dated 2026-07-07). **globals.css is the declared SSOT**, so
  the design work assumes `#FF6363` — but one of the two is stale and should be fixed.

---

## 6. Open questions — owner input needed

1. **Desktop rail — confirmed or not?** Mobile header is approved. The rail costs ~35% of width
   permanently and narrows the thread. Not built on spec.
2. **Two inputs.** Today the composer field *becomes* the audience chat input when the panel opens
   (`askAudience` → `/api/tools/react`, `composer.tsx:1887`). With a header + sheet there are two
   inputs on screen — the sheet's `Ask the room` and the composer's. **Must collapse one way.**
3. **The ranked view's tie.** Two 7/10s ranked 1 and 2 with identical bars. Break the tie or drop
   the numbering.

---

## 7. What's already built (don't rebuild — re-host)

| Piece | Where |
|---|---|
| The band + panel | `src/components/audience-lens/audience-presence.tsx` (46.6K) |
| The room body + segments | `src/components/audience-lens/AmbientRoom.tsx` (45.9K) |
| The brain | `BrainView.tsx` (65.1K) + `CortexCanvas.tsx` (27.4K) + `public/brain/cortex.glb` |
| PR #311 instruments | `SignalGrid` · `SigmaBars` · `SignalHeatmap` · `AttentionCurve` · `HowToRead` |
| Anchored focus + stepper | `use-ambient-focus.ts` → `resolveAmbientFocus` |
| Population math | `src/lib/audience/population.ts` (merged to main in `5900deee`) |
| The mount to move | `composer.tsx:1939–1978`, `presenceCommonProps` @1950 |

**P2 is a re-parent, not a rebuild.** Every component survives; only its owner changes.

---

## 8. Design system (SSOT = `src/app/globals.css` @theme + `docs/DESIGN-SYSTEM.md`)

⚠️ `BRAND-BIBLE.md`, `docs/tokens.md`, `docs/components.md` are **STALE** — do not trust them.

```
--charcoal-app       #1f1f1e   dominant app surface
--charcoal-chip      #2c2c2b   lifted matte (panel, composer, sidebar)
--charcoal-thread    #252524   in-thread skill cards
--charcoal-composer  #1a1a19   composer / dark modal tone
--cream-primary      #ece7de   brightest text — NEVER #fff
--cream-secondary    #c2bdb4   default chrome
--cream-muted        #8a857c   placeholders, labels
--color-accent       #FF6363   liveness ONLY — see drift note §5
```
Borders 6% (`white/[0.06]`), hover 10%. Radius: cards 12, inputs/buttons 8. Inter for chrome,
Newsreader **serif for voice-moments only** (the verdict, the verbatims). **Matte** — no glass, no
glow, no inset-shine. Guard: `reading/__tests__/reskin-matte.test.ts` — keep green.

**Accent dosage is LOCKED:** accent = a liveness signal, not paint. A screen with **zero** accent is
the norm. In this panel the sanctioned use is **the settling dots while the room reads** — and
nothing else.

---

## 9. Setup

```bash
cd ~/virtuna-ambient-room
git config core.hooksPath .githooks     # already done
cp ~/virtuna-v1.1/.env.local .          # gitignored
# node_modules: symlink from a sibling worktree, or install fresh
```

**Gotchas (from memory, verify):**
- Some worktrees need `next dev --webpack` — Turbopack rejects an out-of-root `node_modules`
  symlink. Webpack then chokes on `react-scan` via `src/components/dev/locator.tsx` (`DevLocator`,
  in the root layout) → temporarily neutralize that import for a live look.
- `npm test` prints **fake** results — use `node ./node_modules/vitest/vitest.mjs run`.
- vitest does **not** load `.env.local`.
- Dev-server CSS caching: kill server + `rm -rf .next/` when CSS changes don't appear.

---

## 10. Artifacts from the design session

- **Placement A/B/C** (page-level schematics, the core argument):
  https://claude.ai/code/artifact/88fa19b1-7123-4a01-9b3c-132fb09ee394
- **Mobile + the keyboard test** (real 390×844 frames, the arithmetic):
  https://claude.ai/code/artifact/63b0b98f-187e-450f-a540-091f8728ecb3

Both are built in the real tokens and are the visual spec for P2. **They are sketches, not code**, and
they were drawn against stale screenshots — treat them as direction, not as truth. P0 wins any
disagreement.
