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

> ⚠️ **ORDER CORRECTION (2026-07-17, after the forks closed): do P2 BEFORE P1.**
> The doc originally had craft first, on the reasoning that it's placement-agnostic. That's wrong for
> **2 of the 6 items**: §3.5 (dead wells) is *deleted* by P2, and §3.6 (the header) is *reshaped* by it —
> a header in a rail is not a header on a band. Craft-then-move = craft twice. P2 is a **re-parent, not
> a rewrite** (every component in §7 survives), so the risk is lower than it reads.
> **Run order: P0 → P2 → P1 → P3.**

### P1 — Panel craft pass (do AFTER P2, in the final container)
Take the ranked view's grammar as the bar.
1. Kill the truncation (§3.1)
2. De-duplicate the repeated facts (§3.2)
3. Row-as-target, drop the repeated CTAs (§3.3)
4. Hierarchy: bounces surface above stays (§3.4)
5. ~~Reclaim the dead wells (§3.5)~~ — **CLOSED by §6.2.** The rail has no input; the well is deleted,
   not redesigned. Don't fix this separately.
6. Rebuild the header (§3.6)
7. Add a `not`-line to the people view — the population view already has one
   (`1,000 MODELED FROM YOUR 10`), the others don't. Steal Sapient's move: *every card states what it
   is not.*

### P2 — Placement (structural) — all decisions in, build it
1. Re-parent the room out of `composer.tsx` (mount @1939–1978, `presenceCommonProps` @1950) to thread level
2. Desktop: the rail · Mobile: the audience header — **both owner-approved**
3. Kill the scrim + the bloom. It occupies; it does not overlay.
4. **Kill the panel's `Ask your audience…` field entirely** and add `Ask` to the composer's verb chip
   (§6.2). Do this *with* the re-parent, not after — the always-open panel makes the current
   composer-becomes-room-input mode unshippable the moment step 2 lands.
5. Drop the rank numerals; name true ties (§6.3).

### P3 — Bugs (separable, some are one-liners)
See §5. `/dev/cards` and the orphaned routes are independent of everything else and can ship first
as easy wins.

---

## 5. Bugs found during the session (unverified against current main — check first)

**Panel-adjacent:**

- 🔴 **`ambientDescriptors` gates on the CHIP, not on the CARDS — and PR #316 just made it bite.**
  **VERIFIED on current main `4a648e83`, 2026-07-17** (not a stale-screenshot claim):
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
  **Fix: branch on the blocks that exist, not on the chip.** Small, high-value, and independent of
  P1/P2 — a candidate to ship first. Coordinate with [[chat-as-agent-premium-pass]] (active track).
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
