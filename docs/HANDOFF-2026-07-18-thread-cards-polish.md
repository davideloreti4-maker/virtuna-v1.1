# Handoff — Thread-card polish sweep (2026-07-18)

Branch: `polish/thread-cards` → PR → main. All thread cards were rendered LIVE (authed, real
renderers via `/dev/cards`) and audited 1:1. This doc is the springboard for the next card session.

---

## TL;DR — the reframe that matters

The going-in read was "almost all thread cards are outdated drafts." **That was mostly wrong.**
After rendering all 22 card states live:

- **The Make cards — hooks · ideas · script · remix — are already the bar.** Hero-first, grounding
  receipt wired (`PROVEN STRUCTURE` → templated `[bracket]` source → `@handle` → multiplier · views),
  the `Strong 7/10` proof band with **"See the room →"**, one cream primary, Save as an icon. On-brand,
  on radius scale.
- **They look bare in the LIVE app only because grounding flags are OFF in prod** (the "honest gate",
  see [[grounding-explicit-scrape-pr319]]). That is a product/config decision, NOT a card bug. Flip +
  verify grounding and these cards light up with receipts. **Do not redesign a card to fix an empty
  state that is really an off flag.**
- **The genuine drafts were exactly three: Explore, Account Read, Simulate.** All fixed this session.

**The instrument that makes this cheap:** `/dev/cards` renders every card + every Reading state through
the REAL production renderer (HMR-live, can't drift from prod). Auth required — log in as
`e2e-test@virtuna.local` / `e2e-test-password-2026`. This is the first thing to open next session.

---

## What shipped this session (PR `polish/thread-cards`, 15 files)

### 1. Shared card primitives — the spine, written down
`src/components/thread/card-primitives.tsx` (NEW):
- `CardEyebrow` — §0.5.1 kicker row (dot + uppercase label + right meta), canonical `text-[11px]
  uppercase tracking-[0.05em]`.
- `CardPrimaryAction` — §0.5.7 the ONE cream forward-chain button (was **7 copy-pasted 200-char class
  strings**, each drifting a `transition-*`/`disabled:*`). Forwards `data-testid`.
- `CardActionBar` — §0.5.7 footer row (primary first, Save `ml-auto`).
- `SECTION_LABEL` — the canonical label className constant.

> Philosophy (from the SSOT, proven again): cards drift because each is built alone with nothing to
> conform to. These are what cards import instead of re-declaring.

### 2. The three drafts → brought to the bar
- **Account Read** (`account-read-block.tsx`) — was a **7-label spec-sheet**, no hero, payoff buried
  last, primary was a **text link** (the code comment even claimed "cream-primary" — it lied).
  → recurring-hooks / format-mix / drop-points collapsed into ONE disclosure; working/fix diagnosis
  is the focus; **"Write to my strengths →" is now the cream `CardPrimaryAction`** + Save `ml-auto`.
- **Explore** (`explore-thread-view.tsx` + `skill-result-card.tsx`) — was a bland `text-xs` caption
  over a grid. → `SkillResultCard` header upgraded to `CardEyebrow` + a count-aware framing hero
  (**"3 outliers, scored for your audience"**). The shared `OutlierTile` was left alone on purpose
  (it is ALSO the Discover browse page and is defensible there — multiplier-as-signal + full-width
  block CTA are legit for a browse tile). **Do not "fix" the tile without checking Discover.**
- **Simulate** (`proof-unit.tsx`) — the room was clickable but the **"See the room →" cue was invisible**
  because `ProofUnit` gated the whole cue on a lead `quote`, which Simulate doesn't pass (its themes
  carry the quotes). → cue now shows whenever the unit is openable, quote or not. Affects only the
  quote-less caller. NB: Simulate's greyed `Predict an outcome →` is CORRECT — it's `disabled` until
  the scenario textarea has text (same for Profile Read's `Test this message →`).

### 3. Cross-card consistency — one label stack, locked
- Normalized EVERY uppercase label across `thread/**` + `reading/**` to `tracking-[0.05em]`. The hook
  eyebrow itself was `0.06em`; proof-receipt was `10.5px/0.07em`; idea's "your take" badge `0.04em`;
  thread-shell's MAVEN label `0.08em`; reading-hero's pill `0.1em`. (Visible change ≈ nil; the point
  is the lock.)
- **Tightened `section-label-scale.test.ts` to "0.05em or nothing"** — the exact one-line follow-up
  the guard's OWN comment invited. A stray `0.06em` eyebrow now FAILS the build. Sibling of the radius
  guard; both walk the tree so a new card is guarded the day it lands.

### Verification
- `npm run build` ✅ · `tsc --noEmit` exit 0, 0 errors · **412 tests green** (thread + reading dirs,
  incl. the tightened guard 68 + radius 65 + account-read + reaction-distribution).
- Re-screenshotted every state live post-change; the 3 drafts render correctly, the bar cards unchanged.

---

## Card system map (for the next session)

- **Contract SSOT:** `docs/subsystems/ui-skill-cards.md` §0.5 (THE CARD CONTRACT — spine + honesty spine).
  §0.6 has a per-card compliance table — **it predates this session; update it as you go.**
- **Cards live in:** `src/components/thread/**` (in-thread blocks) + `src/components/reading/**` (the
  flagship `/analyze` video Read, a separate renderer system, NOT a thread block).
- **Block schemas (SSOT):** `src/lib/tools/blocks.ts` — the UI can only render what the block holds.
- **Guards (keep green):** `thread/__tests__/section-label-scale.test.ts` (label idiom, now 0.05em-or-nothing),
  `thread/__tests__/radius-scale.test.ts` (radius token scale), `reading/__tests__/reading-labels.test.ts`,
  `reading/__tests__/reskin-matte.test.ts` (no coral/glass).
- **The visual gate:** `/dev/cards` (`src/app/(app)/dev/cards/page.tsx` + `fixtures.ts`). Every card +
  every Reading state, real renderers. LOOKING here is the cheapest way to catch card drift.

### Live compliance snapshot (2026-07-18, my audit)
| Card | State |
|---|---|
| Hook / Idea / Script / Remix | ✅ the bar — grounded, hero-first, on-brand |
| Predict (`prediction-gauge`) | ✅ good (range hero, gauge, factor chips, honest disclaimer) |
| The Read (`multi-audience-read`) | ✅ dense but coherent |
| Profile Read (`profile-read`) | ✅ conforms (eyebrow → name hero → tells + verbatims → disclosure) |
| Personas / Persona-chat / Band / Markdown | ✅ small primitives, clean |
| **Account Read** | ✅ **rebuilt this session** |
| **Explore** (`outlier-grid`) | ✅ **reframed this session** (tile shared w/ Discover — untouched) |
| **Simulate** (`reaction-distribution`) | ✅ **room-cue fixed this session** |

---

## Next-session backlog (cards)

> ⚠️ The OWNER has a larger card agenda queued for the next fresh session that is NOT yet captured here
> — get that list first and fold it in. The items below are what THIS session surfaced.

1. **[Product, high-leverage] Grounding flags in prod.** The single biggest reason cards "look like
   drafts" live is grounding OFF. Flip + verify so real runs render the receipt, THEN re-judge card
   design against real output. This likely dissolves more perceived "card problems" than any redesign.
2. **[Optional DRY] Adopt the primitives in the good cards.** hook/idea/script/remix/predict still
   hand-roll their eyebrow + cream button inline. Swapping them to `CardEyebrow`/`CardPrimaryAction`/
   `CardActionBar` is a safe ~20-min mechanical pass with ZERO visible change. Deliberately skipped to
   avoid churning the bar cards; the label drift (the one thing that recurs) is already guarded.
3. **[Owner call] Account Read has no single-sentence hero.** No `headline`/`summary` field exists in
   `AccountReadBlockSchema` (`blocks.ts`), so the honest hero is the working/fix diagnosis. If a punchier
   one-line thesis is wanted, it needs a new engine synthesis field — NOT a fabricated UI string.
4. **[Reading, from the 07-14 audit] `docs/subsystems/ui-skill-cards.md` §0.7 open items** — provenance
   in the Reading hero eyebrow, an empty-state styled as a verbatim, two entity types in one list, a
   duplicated replay action. Still open (owner call, allowlisted in the reading guard).
5. **[Data-richness, Tier C] `ui-skill-cards.md` §3–§5** — cover thumbnails dropped from the scrape,
   block schemas carry metrics-only, Instagram classifier bug. Backend-dependent.

---

## Gotchas carried forward
- Dev server: `NODE_OPTIONS='--max-old-space-size=4096' node ./node_modules/next/dist/bin/next dev
  --turbopack --port 3000` (direct-node; launch with `nohup … & disown` so it survives the tool call —
  a plain `&` inside a Bash call gets reaped and the server dies).
- Screenshots hang on this app (ambient animations never settle) — use raw Playwright with
  `animations:'disabled'`, `caret:'hide'`, and screenshot per-`section` so one animating section can't
  block the rest. Capture harness pattern: log in at `/login`, iterate `section[id]`.
- `npm test` prints FAKE results — use `node ./node_modules/vitest/vitest.mjs run <paths>`.
