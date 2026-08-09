# Handoff — v8 UI refinement + anatomy correction · lane/platform-concept

> **Written 2026-08-09 after owner review of the built v8 surfaces.** The owner's verdict on the
> work from this worktree: **the execution does not meet the bar** — *"not something billion dollar
> companies like Claude and Perplexity would release."* This doc is the correction brief.
>
> **This is not a "make it prettier" ticket.** Two of the complaints are structural spec violations
> with exact locations, and one is a duplication of machinery that already existed. Fix those first;
> the visual refinement sits on top of them.

## 0. What the previous sessions got wrong, and why the tests didn't catch it

Phases 1–3 and 5 were verified for the design **system** (accent dosage, type roles, fractional px,
page errors, zero-spend) and all of it passed. **Nothing verified anatomy fidelity against the
spec**, and both structural defects below live exactly there. A green token audit is not a design
review. The next session should read the spec's §3 composer anatomy and mock §3/§4/§6 *as a
contract* and diff the built surface against it element by element.

---

## 1. 🔴 STRUCTURAL — the composer violates "nothing above the field, ever"

**Location:** `src/components/app/home/composer.tsx:3587-3589`.

```tsx
{useHeader ? (
  <div data-testid="audience-header-slot">{audienceHeader}</div>
) : null}
<div className={...}>   {/* ← the field starts HERE, at :3590 */}
```

**The rule it breaks** — stated three times in the SSOT chain, and it is the entire Claude/Perplexity
restraint the concept is built on:

- spec §3: *"Same component on home and in thread. **Nothing above the field, ever** (the
  Claude/Perplexity anatomy)."*
- SSOT §1: *"**attached sub-bar** … Nothing above the field, ever."*
- SSOT §2, owner decision 7: *"Composer anatomy: nothing above the field (Claude/Perplexity
  restraint); premium bar."*

**What the owner is actually seeing** (their screenshot, flag ON — the v8 `SIM-1 Flash` selector is
visible in the same frame): a header row reading `@mrbeast · ● CALIBRATED · 4 RANKED ˅` sitting
**above** the field, *while* the v8 sub-bar sits below it. **Both audience affordances are mounted
at once** — the pre-v8 header that v8 was supposed to retire, and the sub-bar that replaced it.

**The fix:** under `CONCEPT_V8_ENABLED`, `useHeader` must be false. The audience lives in the
attached sub-bar (`v8/sub-bar.tsx`) and nowhere else. Flag-off keeps the header exactly as today.
**Add a test that asserts `audience-header-slot` is absent when the flag is on** — this is a
regression that a token audit will never see.

## 2. 🔴 STRUCTURAL — the three sim pages were re-implemented, not reused

**The owner's words:** *"the simulation three pages that I saw are like something that was
wrongfully implemented. We already have the three pages and the overview as well as the rail for
the simulation."*

They are right, and here is the receipt. `AmbientDetail` already owns all three pages
(`AmbientDetail.tsx:241` — `Tab = "brain" | "engagement" | "audience"`), and its Audience page is
`PopulationFrame` (`./AudienceTab`). Phase 3 then added an opt-in prop whose **own doc comment**
admits what it does:

```
/** Replaces the Audience page's <PopulationFrame> wholesale. The v8 report's personas-only
 *  … */
audienceSlot?: React.ReactNode;          // AmbientDetail.tsx:308-311
```

…and the v8 report passes `<PersonaAudienceFrame>` into it (`v8/verdict-report.tsx:130`). So the
Audience page you already had is still in the tree, and a **second** implementation renders over it.

**Why it happened, honestly:** a drop's cached read has ten personas and no `PopulationAggregate`,
so `PopulationFrame`'s terrain/pools/"1,000 simulated" strip had no data behind it. Rather than
teach the existing frame to degrade, Phase 3 built a parallel frame. **That was the wrong call** —
the fix belongs *inside* `PopulationFrame` as an honest reduced state, not in a second component.

**The correction for the next session:**
1. Teach `PopulationFrame` a personas-only grade — it renders the verdict, the ten faces and the
   real voices, and simply omits the projection strip when there is no aggregate.
2. Delete `v8/persona-audience-frame.tsx` and the `audienceSlot` prop.
3. Keep `tabOrder` (Audience-first in the report) — that one is a real spec requirement, not a fork.
4. **Do not touch the drill's own settled order** (`brain · engagement · audience`).

## 3. 🔴 CONCEPT — the pinned report IS a rail, and the sim's door is in the wrong place

**The owner's words:** *"in the screenshots you showed me there is like a rail, a new one
implemented"* … *"the simulation should open up from the composer was the thought. Right? No more
rail."*

**They are right.** Phase 3 retired `AmbientOverviewRail` and then built a pinned panel that occupies
the same column and reads identically. The spec's phrase was *"the old rail reborn as a choice"* —
but a choice that looks like the thing you deliberately killed is still that thing. If the first
impression of the product is a docked side panel, the rail shipped again under a new name.

### The above-vs-below question the owner raised

**The owner's words:** *"the Claude and Perplexity way is not something that opens up into a page
when it sits below the composer. Right? [We] wanted to set [it] above the composer, so it opens up
into a page. I don't know which one is better. What do you think?"*

**The answer is neither, and half of it is already settled in this repo.**

- **Above is dead, on the record.** Spec §6, *What dies*: *"The 2026-08-08 run-bar-above-the-field
  idea (violates the nothing-above-the-field anatomy)."* Putting the sim door above the field
  re-opens a closed decision and repeats §1's mistake in the other direction.
- **But the owner's instinct about "below" is correct, and sharper than the spec was.** A hairline
  strip under the input is a **status-and-settings idiom** — that is precisely what Claude Cowork's
  `Project · Manual · usage` strip is, and what Perplexity's foot row is. **Both open popovers.
  Neither opens a page.** Hanging a destination off that strip reads like putting "Open Dashboard"
  in a status bar.

**The actual flaw is that the sub-bar crams two different classes of action into one strip:** its
left half is a **setting** (who you're creating for → a sheet), its right half is a **destination**
(`Simulate ›` → a full surface). That mismatch is what makes the strip read as furniture.

### Recommended direction (design call — owner confirms before building)

1. **The strip below stays, for CONTEXT ONLY** — audience · platform · model. That is the Cowork
   idiom used correctly, and it reads premium precisely because it is only doing that one job.
2. **The sim's door is the CARD'S METER**, which is already built and verified: tapping a meter
   opens the report on cached personas with zero re-sim. Spec §2 already says the verdict is
   *"an event, not furniture … the reveal plays on the result card where the user is looking."*
   That is the correct door and it already works.
3. **Delete the sub-bar's `Simulate ›` half.** It is a second, weaker door whose only unique job is
   opening the sim when nothing has been simulated — which is a near-empty surface anyway.
4. **Pin becomes genuinely opt-in and OFF by default, or it goes.** Nothing about the sim may be
   permanently resident on the page.

Net effect: nothing above the field, nothing permanently resident, one honest door. The
already-shipped mobile sim dock stays the reference shape (SSOT decision 13).

## 4. 🔴 CRAFT — the composer itself is not premium, and that is the headline complaint

**The owner's words, twice:** *"the UI design inside the composer and opening up the settings and
stuff isn't really that nice, and representing the sketch even worse. I had references from
Perplexity and Claude."* … *"the complete design of the composer field looks ugly and shit and not
premium and clean and smooth like Claude and Perplexity."*

**Treat the composer as the primary deliverable of the refinement session, not a polish pass.** It
is the one object on every screen (spec §3: *"same component on home and in thread"*), so it sets
the perceived quality of the entire product. The current build is functional and passes every token
guard while still reading as unfinished — that combination is the whole problem.

Where to look, concretely — the composer box is `composer.tsx` around `:3583-3602`, and it carries
accumulated compromises visible in its own comments: a `rounded-[24px]` outer with `p-[4px] pt-0`
wrapping a `rounded-[20px]` inner *only when the header is present* (the header that §1 deletes, so
that whole nested-radius branch should collapse to one clean box); a hand-tuned
`shadow-[0_6px_16px_rgba(0,0,0,0.18)]` that replaced `--shadow-float` because the previous blur
"pooled visibly"; and `rounded-t-none border-t-0` overrides for the expanded dock. **Once the header
is gone, re-derive the composer's box from scratch** — one radius, one border, one shadow, one fill
— instead of keeping the branchy remains.

Specific things to get right, measured against the references rather than approximated:
- **The field's own proportions**: padding, line-height, placeholder colour and the vertical rhythm
  between field and foot. Claude and Perplexity both give the input generous internal space and a
  very quiet border; the current box reads tight and busy.
- **The foot row's weight**: `⊕`, the skill pill, the model selector and send should sit on one
  optical baseline with consistent hit targets. Right now they are visually unequal.
- **The send button** and the model selector are adjacent and both compete; decide which leads.
- **Motion**: focus, expand and dock transitions should be smooth and slight. Respect
  `prefers-reduced-motion`.

### The panels it opens

The built skills panel and audience sheet are functional but generic. The references are named in
the spec and must be pulled up and matched, not approximated:

- **Skills panel** (spec §2 v7 revision, mock §3): *two-pane* — a list grouped Make / Test /
  Research, workspace-ordered with ADS badges, beside a **preview pane** carrying a visual, the
  name, and a one-paragraph promise, plus a **Use** button that prefills the composer. Mobile
  renders the same content as a sheet. Typing `/` opens it as inline autocomplete; Enter turns the
  skill into a dismissible box **inside the field**.
- **Audience sheet** (spec §2 v3/v7, mock §4): audiences **with provenance**, "+ New audience", and
  the platform lens as a segmented control — one sheet, page level.
- **Composer foot** (spec §3): `⊕ · skill pill (icon + ▾, roomy — cramped chip and bare glyph were
  both rejected) · … · model selector "SIM-1 Flash ▾" · send`. The pill's proportions were an
  explicit owner call; check them against mock §3.

## 5. 🟠 CRAFT — the arrival cards and their presentation

**The owner's words:** *"the start page should also use some UI design improvements on the cards
and how everything is presented."*

The shelf works and its data is real (verified: 5 cards, real stills, views 91K–18.4M, meters
1/10–9/10). The **presentation** is the problem. Look at `docs/audit` screenshots or re-shoot: the
cards are wide, flat and evenly weighted, so nothing leads. Mock §1/§2 is the contract for card
anatomy — thumb left (9:16, view badge), serif adapted hook, meter, Remix.

Points worth the next session's judgement (all *design* calls, not spec violations):
- The hook is the content and should carry more of the card's weight; the meter and Remix are
  chrome and currently compete with it.
- Six cards of identical weight is a list, not a shelf. The mock's own framing is "six examples,
  six ways to open."
- The greeting, the shelf and the composer are the only three things on the page (spec §0b) — that
  restraint is the design; use spacing and hierarchy rather than adding furniture.

## 6. What is NOT in scope for the refinement session

- **Don't rebuild what exists.** The owner's standing instruction, now stated three times:
  *"there is content in the sketch that shouldn't be implemented — the audience page we already
  have, the sim pages we already had."* **Audit each mock section against the live product before
  touching it.** This is what §2 above cost us.
- **Phase 4 (Audience surface) and Phase 6 (advertiser flavor) stay skipped.**
- **No billing wiring** — drop economics is still open owner call #3; the v8 routes stay 404 flag-off.
- **The lane synthesizer still has no eval** — separate open item, not part of this brief.

## 7. Binding constraints (unchanged, do not re-litigate)

- Fire-on-demand: navigation never fires a sim; one run in flight; opening a drop's report reads
  the cache and never re-sims (currently true — **keep it true**).
- Accent dosage LOCKED: the live-presence dot and the brand mark are the only sanctioned accent.
  Primary actions are neutral cream. Matte — no glass, no glow.
- Type from the roles, never `text-[13px]`; no fractional px anywhere under `src/`.
- The Flash sim is platform-blind — never imply the verdict moved with the platform lens.
- No corpus multiplier numbers; donor niche/handle never rendered.
- Flag-off stays byte-identical.
- Gates before any push: `node node_modules/typescript/bin/tsc --noEmit` · `npm run build` ·
  `npx vitest run` (baseline = exactly one pre-existing `routing-cut` failure).
- Never commit the two uncommitted `/start` files; explicit `git add` paths only.

## 8. Verification the next session must do differently

The previous audit passed because it measured the wrong things. Add these:

1. **Anatomy diff.** For the composer, assert *in a test* that nothing renders above the field
   under the flag. For each mock section, list its elements and tick them off against the DOM.
2. **Look at it.** Screenshot each surface at 393×852 and 1440×900 and *judge the composition*,
   not just the token values. A surface can pass every guard and still be ugly.
3. **The e2e account cannot reach `/welcome`** (onboarding pre-completed) — use the `zz-preview`
   throwaway-page recipe for day-0 surfaces, and delete it before committing.
4. **`POST /api/surfaces/drops` is a cache read, not a spend** — blocking it yields a zero-card
   shelf that looks like a broken surface. Verify the cache is warm in SQL first:
   ```sql
   select (us.last_audience_id::text = sr.audience_key) as key_matches,
          (now() - sr.updated_at) < interval '18 hours' as within_ttl
   from user_settings us
   left join surface_reactions sr on sr.user_id = us.user_id and sr.kind='drop'
   where us.user_id = '31c5a91c-31e1-45fd-ae67-e75c21a49df1';
   ```
5. Two dev servers cannot share one `.next/dev/lock` — kill one before starting the other.

## 9. State

- Branch `lane/platform-concept` @ `ae2502c9`, pushed. `main` unmoved. Vercel git DISCONNECTED.
- **PR #458** open, covers phases 2, 3, 5. **Do not merge it until §1 and §2 are fixed** — it
  currently ships a spec violation and a duplicate component.
- Gates green: tsc clean · build clean · 5647 passed / 1 pre-existing failure.
- Prior handoffs: `docs/HANDOFF-2026-08-09-concept-v8-phase-5-and-audit.md` (audit + traps),
  `docs/HANDOFF-2026-08-08-concept-v8-implementation.md` (SSOT).
- Audit showcase (screenshots of every built surface):
  https://claude.ai/code/artifact/637c70a8-a913-4f9c-853f-eec511091636

---

## 10. Kickoff prompt for the refinement session

```
UI refinement + anatomy correction session for platform concept v8, worktree
~/virtuna-platform-concept (branch lane/platform-concept — git fetch + pull first).

Read, in order:
1. docs/HANDOFF-2026-08-09-v8-ui-refinement-kickoff.md   (THIS BRIEF — the defects and the scope)
2. docs/HANDOFF-2026-08-08-concept-v8-implementation.md  (SSOT — decisions, cautions §5-7)
3. docs/superpowers/specs/2026-08-08-platform-concept-v2-design.md  (spec — revision blocks at
   the top override the body; §3 is the composer anatomy contract)
4. docs/mockups/concept-v2-2026-08-08.html  §1 §2 §3 §4 §6  (layout/anatomy ONLY — content is
   fabricated)

The owner reviewed the built surfaces and the execution does NOT meet the bar ("not something
billion dollar companies like Claude and Perplexity would release"). Two of the four problems
are structural, not taste — fix those before any visual work:

1. 🔴 The composer renders an audience header ABOVE the field (composer.tsx:3587-3589), which
   violates "nothing above the field, ever" (spec §3, SSOT decision 7). Flag-on shows BOTH the
   retired pre-v8 header AND the v8 sub-bar. Under CONCEPT_V8_ENABLED, useHeader must be false;
   add a test asserting audience-header-slot is absent flag-on.
2. 🔴 The three sim pages were re-implemented instead of reused. AmbientDetail already owns
   brain/engagement/audience; Phase 3 added an `audienceSlot` prop that "replaces the Audience
   page's <PopulationFrame> wholesale" and injects a second frame. Teach PopulationFrame an
   honest personas-only grade instead, then delete v8/persona-audience-frame.tsx and the
   audienceSlot prop. Keep tabOrder. Do not touch the drill's own brain·engagement·audience order.
3. 🔴 The pinned report IS a rail — same column, same read as the AmbientOverviewRail it retired.
   The owner also asked whether the sim door belongs above or below the composer. The answer is
   NEITHER, and half of it is already settled: "above" is listed under What dies in spec §6
   (the run-bar-above-the-field idea). But a strip BELOW the input is a status/settings idiom —
   Claude Cowork and Perplexity both open POPOVERS from it, never a page. The real flaw is that
   the sub-bar mixes a setting (left: who you're creating for) with a destination (right:
   Simulate ›). Recommended, owner to confirm: the strip stays for CONTEXT ONLY (audience ·
   platform · model); the sim's door becomes the CARD'S METER, which is already built and
   verified and is what spec §2 already describes ("the verdict is an event, not furniture — the
   reveal plays on the result card where the user is looking"); delete the sub-bar's Simulate ›
   half; make pin genuinely opt-in and OFF by default, or drop it. See brief §3.

4. 🔴 THE COMPOSER ITSELF IS THE HEADLINE COMPLAINT — "the complete design of the composer field
   looks ugly and shit and not premium and clean and smooth like Claude and Perplexity." Treat it
   as the session's primary deliverable, not a polish pass: it is the one object on every screen,
   so it sets the perceived quality of the whole product. Once defect #1 removes the header, the
   nested-radius branch at composer.tsx:3583-3602 collapses — re-derive the box from scratch (one
   radius, one border, one shadow, one fill) rather than keeping the branchy remains and the
   hand-tuned shadow. Then the panels: mock §3/§4 and the Perplexity/Claude references in spec §2
   (two-pane list+preview with a Use button, `/` inline autocomplete, armed skill as a dismissible
   box IN the field). And the arrival cards need real hierarchy — the serif hook is the content,
   the meter and Remix are chrome. See brief §4 and §5.

⚠️ STANDING OWNER INSTRUCTION: the mock contains surfaces the product ALREADY HAS (the audience
page, the sim pages). AUDIT EACH MOCK SECTION AGAINST THE LIVE PRODUCT BEFORE BUILDING IT.
Ignoring this is what caused defect #2. Phases 4 and 6 stay skipped.

Hard rules: fire-on-demand (navigation never fires a sim; one run in flight; a drop's report
reads its cache); accent dosage locked (live dot + brand mark only, primary actions neutral
cream); type from the roles, never text-[13px], no fractional px under src/; the Flash sim is
platform-blind; no corpus multiplier numbers; donor niche never shown; flag-off byte-identical;
no billing wiring. Gates before any push: node node_modules/typescript/bin/tsc --noEmit,
npm run build, npx vitest run (baseline = exactly one pre-existing routing-cut failure). Never
commit the two uncommitted /start files; explicit git add paths only.

Verification must include an ANATOMY DIFF against the spec, not just a token audit — the previous
session's audit passed every guard and missed both structural defects. Screenshot at 393x852 and
1440x900 and judge the composition, not only the measurements. The e2e account has onboarding
pre-completed so it cannot reach /welcome (use the zz-preview recipe); POST /api/surfaces/drops
is a cache read, not a spend — verify the cache is warm in SQL rather than blocking it.

Do NOT merge PR #458 until defects 1 and 2 are fixed.
```
