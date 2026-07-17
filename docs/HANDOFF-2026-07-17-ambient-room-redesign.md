# The ambient audience — placement + craft redesign

**Worktree:** `~/virtuna-ambient-room` · **Branch:** `milestone/ambient-room-v2` · rebased on `main` @ `4a648e83`
**Written:** 2026-07-17 (design session, no code written)
**Status (2026-07-17):** ✅ **P0 RAN — §3 + §5 amended in place from measurements.** One fix shipped
(`57288baa`, the chat-ledger bug, verified live). P2 → P1 → P3 still to build.

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

> ✅ **P0 HAS NOW RUN (2026-07-17).** It found a **third** instance of the same error, and it was
> structural: **§3 as a whole describes the UNCALIBRATED `General` state**, and one of its screenshots
> was the **mock sandbox**, not a live run. §3.5 turned out not to exist at all. See §4 P0 for the
> full account; §3 and §5 are amended in place.
>
> **The rule that replaces P0 for the rest of this milestone: measure the DOM, don't eyeball the
> render.** Every real finding came from `getComputedStyle`/`getBoundingClientRect` — a 3px
> truncation, byte-identical rows, a 489px label, an absent scrim, a scroll-spy that never fires. Not
> one was visible in a picture. Cross-ref `[[green-test-is-the-accomplice]]` and the standing rule:
> *run it for real · measure your instrument.*

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

**Both placements owner-approved 2026-07-17** — mobile header *and* desktop rail. Build to them.

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

## 3. The craft problems

> ### ✅ P0 RAN — measured on screen 2026-07-17, dev :3002, calibrated `@zachking`, real thread
>
> Every item below is now **measured**, not read off a screenshot. Five of the six survive; **§3.5 is
> deleted** (it does not exist); three had wrong numbers; two got *worse*. Method: DOM +
> `getComputedStyle`/`getBoundingClientRect` via `browser_evaluate` (screenshots hang — CLAUDE.md).
>
> **The doc's own thesis proved itself twice.** §3.1 missed a 5th truncated row because it overflows
> by **3px** — invisible to the eye, obvious to `scrollWidth`. And §3.4 is not "no hierarchy": the
> rows are *byte-identical*, which no screenshot can prove and one `getComputedStyle` can.
>
> Verdicts: **§3.1 ✅ (4→5)** · **§3.2 ✅ +new bug** · **§3.3 ✅ (×8→×10, +a 3rd)** ·
> **§3.4 ✅ worse** · **§3.5 ❌ DELETED — does not exist** · **§3.6 ✅ (7→5) +new**

Owner's words: *"doesn't look like something clean and something a premium company would release."*

1. **Mid-word truncation — ✅ CONFIRMED, but it is 5 of 10, not 4.** The trait cell is a fixed
   **160px** `truncate`; the five that overflow measure **163–181px**:
   `Knows the niche, spots clichés` (181) · `Likes, comments, tags friends` (176) ·
   `Watches silently, never reacts` (175) · `DMs relatable stuff to friends` (171) ·
   **`Loyal follower, roots for you` (163)** ← the one the screenshots missed, over by 3px.
   → **The fork is closed by arithmetic: give them the width.** Worst case is 181px, so **+24px
   (160→184) fits all ten** with no copy rewrite. Only the **at-rest** roster shows traits; the
   reacted roster shows full, untruncated quotes (no truncation there).
2. **Everything is stated 3–5× — ✅ CONFIRMED, exactly this shape.** The population view states one
   40/60 split **five times**: header `4 of 10 would stop` → `400 would stay`/`600 would bounce` →
   `40% loved`/`60% bounced` → `600 OF 1.000` → the bar/matrix. At rest: `10 ready` (header) +
   `10 people ready` (headline), and `@zachking` twice.
   → **Premium is confidence. Repetition is anxiety.** Say it once.
   🔴 **NEW BUG the restatements are not even consistent — and this is the PR #306 family.**
   `AmbientRoom.tsx:859` renders `{roomSize.toLocaleString()}` (**locale-dependent**) while `:132`
   (`label: 'Population · 1,000'`) and `:797` (`` `1,000 modeled from your ${tot}` ``) are
   **hardcoded** en-US commas. On any European locale the same view reads *"Population · 1,000"* and
   *"600 OF **1.000**"* — where `1.000` means **one**. The hardcoded label can never localize, so
   outside en-US `toLocaleString()` can only ever *disagree* with it. **Same fact, two sources that
   can disagree** — precisely what §6.3 forbids. (Measured under `de-DE`; client-only, so no
   hydration mismatch. Fix: one formatter, or drop the restatement per §3.2 and the bug dies with it.)
3. **Repeated CTAs — ✅ CONFIRMED; the counts are ×10/×10, and there is a THIRD.**
   `say hi →` **×10** at rest; `ask →` **×10** reacted (not ×8); and — on a surface §3 never saw —
   **`WHY THIS SCORE →` ×9** in the brain's nine-signal grid. When every row has the same button, the
   button is texture. → Make the row the target. **Include the brain grid in this pass.**
4. **No hierarchy inside lists — ✅ CONFIRMED, and it is worse than "no hierarchy".**
   Measured on a real 4/10 card: **all ten rows are byte-identical** — quote `rgb(236,231,222)`
   (`--cream-primary`, the *brightest* tier), 15px, weight 400, opacity 1, no border; name weight 600.
   The 4 who **stopped** and the 6 who **bounced** render *pixel-identically*.
   → The defect is not weak hierarchy, it is that **the row does not encode its verdict at all.** The
   card says "4 of 10 would stop" and then shows ten identical rows: you cannot see *which* four
   without reading all ten quotes. Ten rows at max brightness = no hierarchy by construction.
   ⚠️ **"Robin, the *only* bounce" mis-framed the problem.** Bounces are sorted last (confirmed), but
   on a 4/10 card **6 of 10 are bounces — the majority**; on a 10/10 card there are none. "Surface the
   bounce" is state-dependent. **Encode the verdict per row; let the sort follow.**
5. ~~**Dead wells.**~~ ❌ **DELETED — THIS DOES NOT EXIST.** There is **no `Ask your audience…` field
   in the panel** (`/Ask your audience/` matches nothing inside `[role=dialog]`). It is the
   **composer's placeholder**, which flips when `audienceOpen` (`activePlaceholder`, composer.tsx).
   The screenshots showed the composer *below* the panel, not a well *inside* it.
   §6.2 already closed this item — but for the wrong reason. **Nothing to reclaim; nothing to delete.
   No work here.**
6. **The header is a junk drawer — ✅ CONFIRMED in spirit; it is 5 elements, not 7.** Measured
   calibrated + at rest (54px × 726px): constellation `svg` + `@zachking` + chevron ¹ (all inside one
   `button` aria=*"Audience: @zachking. Switch audience"*) + `10 ready` + chevron ² (`button`
   aria=*"Collapse your audience"*). **"Two chevrons doing different jobs" is exactly right** (switch
   audience vs collapse panel). The missing two — **live dot** and **`NOT CALIBRATED` pill** — are
   *uncalibrated-state* elements, so the "7" was the **General** header (the same wrong-state error
   §0 flags).
   🔴 **NEW, and sharper than the count:** `10 ready` is `min-w-0 flex-1 truncate` and is allotted
   **489px of the 726px header — 67% of the width.** The least informative string owns two-thirds of
   the header.
   → `10 ready` (ready for *what?*) becomes the count. One chevron. The pill becomes the empty state.

### Also measured in P0 — two structural claims elsewhere in this doc are WRONG

- 🔴 **§2 / P2.3 "blooms over the thread behind a scrim" → THERE IS NO SCRIM.** Zero fixed
  full-viewport overlays, no Radix overlay, `aria-modal` **absent**. The panel is a **non-modal**
  `role="dialog"`, `position: relative`, `z-index: 55`, in normal flow inside `relative w-full`,
  anchored above the composer. **P2.3 "kill the scrim" is a no-op against something that does not
  exist.** The *bloom* is real; the scrim is not. Delete the scrim from the plan.
- ⚠️ **Placement-coupled copy P2 must carry:** the at-rest headline reads *"Type a thought **below**
  and watch the whole room react."* In a right-hand **rail** the composer is not "below" the roster.
  This string breaks on contact with P2 — it is not a craft nicety, it is a P2 task.

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

### ~~P0 — Look at it. Non-negotiable.~~ ✅ **DONE 2026-07-17.** Findings are in §3 + §5.

Ran on dev `:3002`, calibrated `@zachking` (10 named personas), a real 5-card thread, DOM measured via
`browser_evaluate`. **§3 amended in place; §5 amended in place.** Headline: **§3.5 does not exist**,
**there is no scrim**, **scroll-spy has never worked**, the numbers in §3.1/§3.3/§3.6 were all wrong,
and §3.2/§3.4 are worse than written. The brain is now the DEFAULT view and §3 never looked at it.

> 🔑 **What P0 actually proved — read this before P1.** The doc's §0 said "I reviewed the wrong state
> and never ran the thing", and the P0 pass shows that error had a **third** form nobody named:
> **§3 systematically describes the UNCALIBRATED `General` state.** §3.6's "7 elements" counts a
> `NOT CALIBRATED` pill + live dot that a calibrated header does not render (it has 5). §3.5's "dead
> well" was the composer, not the panel. And the *"over-indexes on budget + macros"* quote is a
> string from **`mock/fixtures.ts`** — that screenshot was the mock skill sandbox, not a live run.
> **§0 caught two instances of this; it was the whole document's water supply.**
>
> Corollary, and the reason P0 is a stop block: **looking is not measuring.** A screenshot could never
> have found the 5th truncated row (3px), the byte-identical rows, the 489px `10 ready`, the absent
> scrim, or a dead scroll-spy. Every one came from `getComputedStyle`/`getBoundingClientRect`.
> **For the rest of this milestone: measure the DOM, don't eyeball the render.**

Setup that worked (supersedes §9's warnings): **do a real `pnpm install` in the worktree.** The
`node_modules` symlink hard-fails Turbopack (`Symlink node_modules is invalid, it points out of the
filesystem root`) and forces the `--webpack` → `react-scan` workaround. A real install costs ~1 min,
runs Turbopack clean, and **also fixes** the `@gltf-transform/*` gap that made `cortex-field.test.ts`
fail (declared in package.json; absent from main's older `node_modules`).

> ⚠️ **ORDER CORRECTION (2026-07-17, after the forks closed): do P2 BEFORE P1.**
> The doc originally had craft first, on the reasoning that it's placement-agnostic. That's wrong for
> **2 of the 6 items**: §3.5 (dead wells) is *deleted* by P2, and §3.6 (the header) is *reshaped* by it —
> a header in a rail is not a header on a band. Craft-then-move = craft twice. P2 is a **re-parent, not
> a rewrite** (every component in §7 survives), so the risk is lower than it reads.
> **Run order: P0 → P2 → P1 → P3.**

### P1 — Panel craft pass (do AFTER P2, in the final container) — **re-scoped by P0**
Take the ranked view's grammar as the bar.
1. Kill the truncation (§3.1) — **decided: 160→184px.** Five rows, not four; +24px clears the 181px
   worst case. No copy rewrite.
2. De-duplicate the repeated facts (§3.2) — **five restatements of one split.** Killing them also
   kills the `1.000` locale bug for free; if any survive, they must share one formatter.
3. Row-as-target, drop the repeated CTAs (§3.3) — **three sets now: `say hi →`×10, `ask →`×10, and
   `WHY THIS SCORE →`×9 in the brain.**
4. **Encode the verdict in the row (§3.4)** — reframed by P0: the rows are *byte-identical*, so this
   is not "add hierarchy", it is "the row never says whether that person stopped." Do that first; the
   sort follows. (Do **not** build around "the only bounce" — bounces are often the majority.)
5. ~~Reclaim the dead wells (§3.5)~~ — ❌ **DELETED. The well does not exist** (P0). Not "closed by
   §6.2" — there was never anything there. No work.
6. Rebuild the header (§3.6) — 5 elements, not 7; the real prize is the **489px (67%) `10 ready`**.
7. Add a `not`-line to the people view — the population view already has one
   (`1,000 MODELED FROM YOUR 10`), the others don't. Steal Sapient's move: *every card states what it
   is not.*
8. 🆕 **The brain is the DEFAULT view and §3 never saw it.** Before P1 closes, give it the same pass
   the other three got — it is the first thing the creator looks at.

### P2 — Placement (structural) — all decisions in, build it — **corrected by P0**
1. Re-parent the room out of `composer.tsx` (mount @1939–1978, `presenceCommonProps` @1950) to thread level
2. Desktop: the rail · Mobile: the audience header — **both owner-approved**
3. ~~Kill the scrim~~ + kill the bloom. **There is no scrim** (P0 — non-modal `role=dialog`, z=55,
   in-flow, no overlay, `aria-modal` absent). Only the **bloom** is real. It occupies; it does not overlay.
4. **Kill the composer's `Ask your audience…` MODE** and add `Ask` to the composer's verb chip (§6.2).
   ⚠️ **P0 correction:** this is the *composer's* placeholder + `audienceOpen` early-return — **not a
   field inside the panel** (§3.5 is deleted). The mode is still unshippable the moment step 2 lands
   (§6.2's arithmetic is confirmed in code), so still do it *with* the re-parent — just know you are
   deleting a **mode**, not a widget.
5. Drop the rank numerals; name true ties (§6.3).
6. 🆕 **Re-anchor the scroll-spy to the real cards** (§5) — `[data-ambient-card]` are `sr-only` 1×1
   markers at y=-1, so the observer watches nothing and the band is stuck on the last card forever.
   **P2 does not fix this by itself** (the old note claiming a rail makes it "impossible" is wrong).
   It belongs in P2 because the fix is the same re-parent: put the markers on the real card wrappers,
   or observe the cards directly. **Ship it with a guard that fails against today's code first.**
7. 🆕 **Re-copy `"Type a thought below…"`** — "below" is false in a rail (§3, end).

### P3 — Bugs (separable, some are one-liners)
See §5. `/dev/cards` and the orphaned routes are independent of everything else and can ship first
as easy wins.

---

## 5. Bugs — ✅ all panel-adjacent entries verified in P0 (2026-07-17)

> The panel-adjacent list below is no longer "unverified": each entry was checked against the running
> app or the source on `4a648e83`. One is **fixed** (`57288baa`), one is **stale** (the brain), one was
> **materially mis-described** (scroll-spy), one is **bigger than it looked** (the eyebrow), and two
> are **new**. The **Elsewhere** entries below are still un-rechecked — they were static-source finds
> and are independent of the panel.

**Panel-adjacent:**

- ✅ **FIXED + verified live, 2026-07-17 (`57288baa`) — `ambientDescriptors` gated on the CHIP.**
  **Proven on screen before/after**, not just in tests: opening a real chat thread whose agent had
  dispatched 5 hook cards, the chip reads `Chat` and the room now shows **5 descriptors** with real
  fractions (10/10, 8/10, 6/10, 5/10, 4/10), the band reacts, and the stepper reads
  **"‹ Hook 1 of 5 ›"** — the label came from the **block type** while the chip still says "chat".
  Pre-fix that thread produced **0**.
  Fix: the ledger moved out of the 2,800-line component into a pure
  `buildAmbientDescriptors` (`ambient-descriptors.ts`, mirroring `resolveAmbientFocus`) keyed on the
  **blocks the mounted view rendered** — for chat, every persisted turn's blocks then this turn's
  stream, i.e. exactly what `ChatThreadView` renders, so it stays faithful by construction on both the
  live and reload paths. Kind derives from each block's own `type`, so a mixed chat batch indexes
  across the ledger (`idea-0`, `hook-1`) and is labelled "Card".
  The guard was **run against the old logic first and failed on exactly the 3 chat cases** while the
  other 9 passed. Locked both ways: a card you CAN see must move the room; one you CANNOT must not.
  <details><summary>The original defect (kept for the record)</summary>
  ```js
  // composer.tsx:1803
  if (activeTool === "hooks")  return pick(persistedHookBlocks,  hooksBlocks,  "hook");
  if (activeTool === "idea")   return pick(persistedIdeaBlocks,  ideasBlocks,  "idea");
  if (activeTool === "script") return pick(persistedScriptBlocks, scriptBlocks, "script");
  if (activeTool === "remix")  return pick(persistedRemixBlocks, remixBlocks,  "remix");
  return [];   // ← chat lands here
  ```
  `DEFAULT_TOOL = "chat"` (`:155`). **Chat-as-agent (PR #316, `4a648e83`, shipped 2026-07-17,
  `CHAT_AGENT_DISPATCH` default-ON) now dispatches real hook/idea/script cards inline from chat** —
  but `activeTool` is still `"chat"`, so the room returns `[]`.
  ⇒ **The product's DEFAULT path now generates cards the audience never reacts to.** The moat is not
  merely idle on arrival — it is silent on the main road.
  Same defect in `ambientKindLabel` (`:1815`): chat → `"Concept"`.
  </details>
- 🔴 **SCROLL-SPY IS DEAD — root-caused + measured in P0. This entry was wrong twice.**
  The symptom was described as "scroll-spy focus resolving to something out of the viewport". It does
  not *resolve to the wrong card* — **it never resolves at all.** The band is permanently pinned to
  the LAST descriptor via `resolveAmbientFocus`'s default-latest fallback.
  **Measured** (real thread, 5 hook cards): scrolled card 1 (`10/10`) under the focus line → band
  still `4 of 10`. Scrolled card 2 (`8/10`) → band still `4 of 10`. It never moves.
  **Cause:** `useAmbientFocus` roots its IntersectionObserver on `[data-ambient-card]`, but those
  wrappers are the **`sr-only` synthetic markers** (`composer.tsx`, `ambientFocusMarkers`) — all five
  measure **1×1 at y=-1**, stacked in one `sr-only` box at the top of the thread region, while the
  real cards sit at **y=1147…2529** (334px each). The observer watches five zero-height boxes above
  the focus line; the real cards scroll past unobserved. `focusByScroll` is never called.
  (`focusByTap` **does** work — "See the room →" moves the band correctly, so the ledger + focus +
  stepper are otherwise sound. The defect is isolated to the scroll-spy axis.)
  ⛔ **"A rail/header makes this impossible — they'd be side by side" is FALSE.** The markers are
  decoupled from the cards *regardless of where the panel lives*. A rail would sit there showing the
  stale last card while you read card 1. **P2 does not fix this; only re-anchoring the observer to the
  real card DOM does.**
  🔑 `[[green-test-is-the-accomplice]]` again: `use-ambient-focus.test.ts` is fully green over a dead
  feature because it calls `focusByScroll(id)` **directly** — it asserts the decision core, and never
  once asks whether anything in the product ever calls it.
- 🔴 **`MADE FOR YOUR AUDIENCE` over a `General · NOT CALIBRATED` audience — ✅ CONFIRMED in P0, and
  it is not a one-liner.** The eyebrow **does not gate on anything**: `idea-card-block.tsx:100`
  hardcodes the string, unconditionally, on every idea card.
  **It cannot gate — the `idea-card` block schema (`blocks.ts:208`) carries no calibration field at
  all**, so the card has no way to know. Fixing it means threading calibration through the full
  touchpoint chain (schema → runner → parse → toBlocks → **the route's SSE emit** — the five, see
  `[[per-persona-hook-generation]]`), not editing one line. **Scope it as its own task.**
  A confident claim riding on nothing — same shape as
  `[[read-ships-high-confidence-with-no-audience]]`. (The *"over-indexes on budget + macros"* half is
  `whyItFits`, and the exact string in the screenshot is from **`lib/tools/mock/fixtures.ts:108`** —
  i.e. that shot was the **mock**, not a live run. Verify the live copy before quoting it as evidence.)
- ✅ **RESOLVED in P0 — the brain is present and is the DEFAULT room view.** The toggle reads
  `The brain · The people · Population · 1,000`, and the brain lands first (PREDICTED CORTEX → HOW TO
  READ → nine signals → THE ROOM readout). The "absent from all four screenshots" note is **stale**,
  as suspected. ⚠️ Consequence for P1: the brain is the surface the creator sees FIRST, and §3 was
  written without ever looking at it (that is where the third repeated CTA lives — §3.3).

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

**Found in P0 (new — measured, not from screenshots):**
- 🔴 **`600 OF 1.000` — the population view disagrees with itself outside en-US.**
  `AmbientRoom.tsx:859` uses `roomSize.toLocaleString()` (locale-dependent) while `:132`
  (`'Population · 1,000'`) and `:797` (`` `1,000 modeled from your ${tot}` ``) hardcode en-US commas.
  On `de-DE`/`it-IT` the same view reads `Population · 1,000` **and** `600 OF 1.000`. Detail in §3.2.
  Client-only → no hydration mismatch. **Dies for free if §3.2 (say it once) is done properly.**
- ⚠️ **`use-ambient-focus.test.ts` is green over a dead feature.** It asserts the pure decision core by
  calling `focusByScroll(id)` directly, so it can never notice that nothing in the product calls it
  (see the scroll-spy entry above). Any scroll-spy fix must add a guard that **fails first**.

**Token drift — resolve before styling anything:**
- `CLAUDE.md` says the accent is terracotta `#d97757`. `globals.css` says
  `--color-accent: #FF6363` (coral-red, dated 2026-07-07). **globals.css is the declared SSOT**, so
  the design work assumes `#FF6363` — but one of the two is stale and should be fixed.
  ✅ **P0 settled which:** measured at runtime, `getComputedStyle(document.documentElement)
  .getPropertyValue('--color-accent')` → **`#ff6363`**. globals.css wins; **the app ships coral-red,
  and `CLAUDE.md` (+ the memory note that repeats it) is the stale one.** Design to `#FF6363`, and fix
  CLAUDE.md so the next session isn't misled again. ⚠️ Under the LOCKED near-zero dosage rule this is
  nearly moot in this panel — the only sanctioned accent here is the settling dots (§8).

---

## 6. Resolved by owner, 2026-07-17

### 6.1 Placement — BOTH APPROVED ✅
Desktop rail **and** mobile header. Build to §2.

### 6.2 The two inputs — ONE INPUT. `Ask` becomes a verb in the composer chip. ✅

**The forcing function — CONFIRMED IN CODE on main `4a648e83`**, it's an early return:
```js
if (e.key === "Enter" && !e.shiftKey) {
  e.preventDefault();
  if (audienceOpen) { if (url.trim()) { void askAudience(url); setUrl(""); } return; }  // ← handleSubmit unreachable
  if (canSubmit) void handleSubmit();
}
// and: const activePlaceholder = audienceOpen ? "Ask your audience…" : PLACEHOLDER_BY_TOOL[activeTool];
```
A rail/header is **permanently open** ⇒ `audienceOpen` is permanently true ⇒ `handleSubmit` is
**permanently unreachable** ⇒ you could never make anything again. **The mode dies whether we like it
or not.** Not a preference — arithmetic.

**The resolution:** `Ask` is already one of the three locked verbs (**Make · Test · Ask**). Verbs live
in the composer's chip. So it's the *same field* with an *explicit target*:

```
[Ideas ▾]  → makes ideas
[Hooks ▾]  → makes hooks
[Ask ▾]    → asks the room about whatever's in focus
```

The rail shows **who** and **what's in focus**. The composer **types**. (Same messaging-app model that
produced the header answer — third time this session it's been right.)

Falls out for free:
- **§3.5 dead wells DIE.** The rail simply has no input. That craft item is now closed by this decision
  — don't fix it separately.
- **The mode error dies.** No more "where does my text go? depends on a panel."
- **Per-person ask is untouched.** `ask →` on a row stays a *tap* → `PersonaChatDrawer.tsx` (exists).
  Different object, correctly a different affordance.

Cost: opening the room no longer auto-arms asking — one extra click. Accepted: a click for the user
always knowing where their words go.

### 6.3 The ranked view's tie — DROP THE NUMERALS. Keep the sort. Name true ties. ✅

**Ties are the NORM, not an edge case.** 10 personas × stop/no-stop = 11 possible scores, over 4 ideas.
You will tie constantly. This is the common path.

- **The numerals are the bug.** A big serif `1` asserts a strict order the data refuses — two 7/10s with
  identical bars ranked 1 and 2 is a lie of typography. The sort + bar + score already carry the order.
- **When two genuinely tie, say so.** *"Your top two are tied at 7/10 — the room can't separate them"*
  is more honest **and more interesting** than a fabricated winner. It invites the drill, which is where
  the value is.
- 🔴 **DO NOT break the tie with the population number** (700 vs 683). That is **exactly PR #306** —
  Simulate stating the fraction twice from two sources that can disagree. A card that *displays* `7/10`
  while *ranking* on `700/1000` will one day ship a #2 that visibly beats its #1.
  See [[read-ships-high-confidence-with-no-audience]] for the family of bug.

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
