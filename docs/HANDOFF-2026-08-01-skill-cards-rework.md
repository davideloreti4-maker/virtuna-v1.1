# HANDOFF — Skill-card rework (in-thread generation cards)

> ## ▶ START HERE — DO NOT WRITE CODE YET
>
> **The owner has an open decision and asked to be consulted before any further work.**
> Read this file end to end, open the two mocks, then **ask the owner the questions in §1**
> and wait for answers. Do not implement, do not "just start with the safe parts".
> The last two sessions both burned a full cycle by acting before the owner had chosen.

**Branch:** `task/skill-cards-rework` · **Worktree:** `~/virtuna-slot-a` · **Dev port:** 3001
**Base:** `origin/main` @ `fb0a5a00` · **Tip:** `65ac656a` (pushed)
**Date:** 2026-08-01
**Status:** design exploration. **Zero `src/` files changed** — verified with
`git diff --stat origin/main...HEAD -- src/` (empty). `tsc` and vitest have not been run because
nothing compiles differently yet. No PR.

⚠️ **Check the base with `origin/main`, not `main`.** Local `main` in this worktree is stale
(`ebd3e0db` vs `origin/main` `fb0a5a00`). `git cherry -v main HEAD` therefore lists
`d173a978 fix(mobile): the audience bar…` as unmerged **and it is not** —
`git merge-base --is-ancestor d173a978 origin/main` returns true. It shipped in PR #410.
This is the exact trap `CLAUDE.md` documents; it cost time again this session.

| Commit | What |
|---|---|
| `1a4b5704` | Sketch 1 — `.planning/sketches/skill-cards-rework.html` |
| `9e8cdbb5` | Sketch 1 — audit sections appended |
| `eac31e96` | Sketch 2 — `.planning/sketches/skill-cards-premium.html` (**REJECTED**, §5) |
| `678f53aa` | This handoff, first version |
| `8791018f` | **v1** — `.planning/sketches/skill-cards-hierarchy.html` (superseded by v2 in the same file) |
| `2becef40` | **v2** — same file, owner's four notes + the information inventory |
| `65ac656a` | **v3** — `.planning/sketches/skill-cards-v3-directions.html`, two directions |

**Scope, locked by the owner:** in-thread generation only — `hook-card` · `idea-card` ·
`script-card` · `remix-card`. Library/saved, the ambient room and wiring are other sessions' work.

---

## 1. ASK THE OWNER THESE FIRST

### Q1 — Which visual direction? *(blocking; everything else waits on it)*

Open `.planning/sketches/skill-cards-v3-directions.html` (or the artifact link in §7). Two
directions are mocked for hook **and** idea, at 728px and 342px:

- **A · Editorial** — zero uppercase anywhere. Supporting lines self-read: *"Open on a crash-zoom:
  hard cut to your face mid-sentence…"*, *"It works as a pattern-interrupt…"*. On the idea card,
  topic/take/format stop being three labelled cells and become one sentence with the three
  variables in cream.
- **B · Document** — sentence-case labels, 12px muted, quiet left column that stacks at 342px.
  Same `dl` idiom already shipped in the script/remix "How to film" blocks.

The trade: **A reads better, B scans better.** B's cost shows on the idea card — seven labelled
rows, closer to a spec sheet than an editorial object. B also steps off the `SECTION_LABEL`
uppercase idiom the rest of the thread uses, so these four cards would look different from the
Read and Account cards until those follow.

A hybrid is on the table and was offered: A's prose for hook and remix, B's labels for the
fact-dense idea and script. The owner had not answered when the session ended.

### Q2 — The door on a legacy card that really did run a panel *(asked twice, never answered)*

Door state ③ (a completed sim writing its verdict back onto the card) is deferred. But a
persisted pre-2026-07-22 card genuinely carries a measured panel. Either:

- **"Your audience reacted · See your audience →"** — honest for data that exists, still prints no
  number, so the card carries no verdict. *(recommended)*
- **"Not tested yet" on every card** — simpler and uniform, but claims untested about a real
  measurement.

This decides whether the door reads `provenance` at all, so settle it before writing the component.

### Q3 — Sweep "room" → "audience" beyond these four cards?

The owner asked for the rename. It is done on the four cards (§4). The word survives in
`proof-unit.tsx` (shared, out of scope — see §3 finding 4), in Simulate, in the ＋door dial and in
the ambient room itself. Ask whether that broader sweep is wanted as a separate lane.

---

## 2. What the owner has decided (locked — do not re-litigate)

1. **The card shows no verdict; the simulation owns it.** Strip band word, `N/10` fraction,
   magnitude ribbon, generated scroll quote, provenance tag and the `#1–#5` rank badge from every
   card face. Keep best-first **ordering**; mark only the lead card, once, as "Top pick".
2. **The card's sim door goes to ⑤ `AmbientSimulate`** in `develop` mode, pre-filled — not the
   docked room. *(That target is wiring, and wiring is another session's job. The mocks keep the
   existing `openRoomForCard`/`LensTrigger` plumbing so nothing is half-rewired.)*
3. **Deferred:** door state ③. The slot ships ready; nothing writes to it.
4. **`fraction` stays on the block props.** `ambient-descriptors.ts:68` returns `null` without it
   and silently unhooks the card from the ambient ledger + scroll-spy anchors. Remove from the
   **face**, never the **schema**.
5. **NO two-column card interiors** — rejected for mobile. (The remix decode map is the one
   pre-existing exception and it stays; see §5.)
6. **NO uppercase mono micro-labels, no big-number-over-tiny-caps stat blocks.** Owner called that
   "AI slop". Aim premium, not AI-SaaS.
7. **Idea card:** the **angle leads** in 14px cream, `whyItFits` second at 13px secondary.
   *(Owner overruled the opposite proposal.)*
8. **Hook card:** keep a **"Visual" label** on the shot line. The box and the technique pill go.
9. **No em dashes anywhere** in anything we author. En dashes in numeric ranges (`0–3s`, `11–14px`)
   are correct typography and stay.
10. **"Room" becomes "audience"** in card-facing copy.
11. **Do not worry about** honesty gating, provenance wording, or whether something is wired. The
    goal is "best wow and cheatcode perception", a premium tool.
12. **Mockups only until the owner signs off.** Owner said explicitly: *"no implementation yet i
    want mockups first."*

---

## 3. Verified findings — the durable part of this work

Every one traced to a file and line, and **re-verified this session** where marked ✅.

**Root cause.** On 2026-07-22 the four Make runners collapsed onto a single Qwen call and the
persona SIM left the generation path — `personas + population INTENTIONALLY OMITTED`
(`hooks-runner.ts:667`, `ideas-runner.ts:626`, `script-runner.ts:659`, `remix-runner.ts:361`).
Right call for cost/latency. What did not follow is the presentation: several surfaces still read
those fields and render their degraded half while keeping chrome that promised a measured result.

| # | Finding | Evidence |
|---|---|---|
| 1 | **The whole visible verdict is one self-estimated number in five costumes.** `personaStops` is emitted by the writer about its own output; band, fraction, ribbon, quote and rank all derive from it. Cards sort on it. | `hooks-runner.ts:605–615`, `:475` |
| 2 | **"See the room →" opens a room of nobody.** With `personas` absent the room expands the fraction into `viewer_1…viewer_10` placeholders; none is a registry enum so `isGroundable` fails and "Ask them why →" is gated off. | `audience-presence.tsx:255–259`, `flat-card-reactions.ts:88`, `AmbientRoom.tsx:159` |
| 3 ✅ | **`TargetReaction` is not half-dead, it is structurally dead.** All three callers pass `personas: []`, so `CardTarget.verdict`/`.quote` are **always null** and the receipt branch at `target-reaction.tsx:45` has never rendered in production. What ships is the aim with the receipt permanently missing. Worse: `script-runner.ts:632` states script targeting is **dormant** so `target` is null on every route today, and `remix-runner` never emits `target` at all. | `hooks-runner.ts:637`, `ideas-runner.ts:599`, `script-runner.ts:638`, `target-assignment.ts` `bindTarget` |
| 4 ✅ | **`ProofUnit` is shared with two OUT-OF-SCOPE surfaces** — `reaction-distribution-block.tsx` (Simulate) and `brought-card-block.tsx` (the ＋door dial) — where the fraction **is** the measured product. It also hardcodes the visible `See the room →` at `proof-unit.tsx:165,176` and its avatar cluster is `RoomAvatars`. **Therefore: the four cards stop calling `ProofUnit` and call the new door instead. Do not edit `ProofUnit`.** That is what keeps Simulate from regressing. | `proof-unit.tsx:165,176`; consumers grepped |
| 5 | **`fraction` must stay on the block props.** `toAmbientDescriptor` returns `null` without it. | `ambient-descriptors.ts:68` |
| 6 | **True in-thread card width is ~728px** (`max-w-[760px]` + `px-4`). Mobile ≈ 342px. Judge every layout at both. | `thread-shell.tsx:30` |
| 7 | `visualHook` and `production` **are** emitted in prod — the "inert until the runner emits it" comments in `blocks.ts` are stale. | `hooks-runner.ts:664`, `script-runner.ts:665`, `remix-runner.ts:335` |
| 8 | Script and Remix emit **exactly one** card; hooks fan out ×5, ideas ×4. A card in a stack is a choice; a card that arrives alone is a document. | `HOOK_COUNT=5`, `IDEA_COUNT=4`, `script-runner.ts:687` |

**Out of scope but real** (hand to whoever owns Library): `saved-item-card.tsx:254/:408` print
"stopped" unconditionally with no `provenance` gate; `radius-scale.test.ts:37` has
`GUARDED_DIRS = ['thread','reading']` so `saved/**` escapes the radius guards and carries
`rounded-[10px]` ×2; no card passes `thread_id` to `SaveAffordance`, and `handleForward` ends in a
bare `router.push("/home")`.

---

## 4. The exact edits the mocks imply

### Chrome removed (nested bordered boxes — the bulk of the noise)

| Card | Boxes removed |
|---|---|
| hook | the `visualHook` box · the `TargetReaction` box · the `ProofReceipt` box |
| idea | the 3-cell recipe strip (plus its 3 caps labels and 2 dividers) · `TargetReaction` box · `ProofReceipt` box · the amber "your take" pill |
| script | the `ProofReceipt` box. **The beat timeline is untouched.** |
| remix | the decode map's outer cage + tinted header fill · the compact receipt box. **The map itself is untouched.** |

Also: the technique pill, the archetype pill, the views pill, the `#1–#5` rank badge, and both
carets on hook and idea (their contents moved onto the face, so the expand became empty).

### Content removed from the face

Only the verdict, per §2.1: band word · fraction · scroll quote · provenance tag · the "Scoring…"
shimmer · the numeric rank. **Plus the targeting line** (finding 3) — `target` stays on props and
`TargetReaction` stays in the tree, so it can earn its place if a fired run ever writes a real
verdict back.

### Em dashes to remove (six rendered strings; comments never reach the DOM, leave them)

| File:line | Today | Becomes |
|---|---|---|
| `idea-card-block.tsx:130` | `{angle} — {whyItFits}` | two separate lines, no joiner |
| `idea-card-block.tsx:245` | `Hooks queued — check the thread below.` | `Hooks queued. Check the thread below.` |
| `target-reaction.tsx:50` | `— “{quote}”` | `· “{quote}”` |
| `proof-receipt.tsx:218` | `Original — not drawn from a retrieved video.` | `Original. Not drawn from a retrieved video.` |
| `proof-receipt.tsx:174` | aria `… — match: {fit}` | aria `…, match: {fit}` |
| `proof-receipt.tsx:238` | title `join(' — ')` | title `join(' · ')` |

⚠️ **The model writes em dashes too** and a component cannot strip them without rewriting model
output (an honesty violation elsewhere in this codebase). Owner chose **"chrome now, flag the
prompts"**. The follow-up is one line in each of `hooks-runner.ts` · `ideas-runner.ts` ·
`script-runner.ts` · `remix-runner.ts`. Fields carrying them: `angle`, `mechanism`, `whyItFits`,
`sourceDecode.*`, `beats[].content`, `production.edit`, `scrollQuote`.

### "room" → "audience" (all 8 rendered strings on the four cards)

`hook-card-block.tsx:194` · `idea-card-block.tsx:197` · `script-card-block.tsx:245` ·
`remix-card-block.tsx:202` — each has a `projected ? … : …` pair, so 8 strings total.
Pattern: *"See how the room would react to this hook"* → *"See how your audience would react to
this hook"*. `proof-unit.tsx` is NOT edited (finding 4).

### Layout refinements carried by both v3 directions

- Card padding `16px` → `20px`; the one section break `20px` → `24px`.
- The door row and the action bar were two full-width bands with two dividers → **one footer row**.
- The receipt becomes one media object with a single sage number (the multiplier), not five chips
  and pills. Views demote to plain text.
- `.src { align-items: center }` — a 56px 9:16 cover is ~100px tall against a ~75px text column, so
  top-aligning leaves a dead wedge under the stats.

---

## 5. What was REJECTED, and why — do not re-propose

- ❌ **Sketch 2 (`skill-cards-premium.html`, `eac31e96`) as a whole.** Owner: the visual language
  "reads as AI slop". Concretely: uppercase mono micro-labels on every zone · the
  big-number-over-tiny-caps stat block · generic dark card + hairline border + faint tint zones ·
  label chrome on content that self-reads.
- ❌ **Two-column "theirs ↔ yours" card interiors.** *"doesn't work for mobile."* Measurements said
  they held at 342px; **the owner overruled that and the owner is the decider.**
- ❌ **Mono in the card vocabulary.** Dead with the above. `section-label-scale.test.ts` does not
  need changing.
- ❌ **Deleting content to fix "overloaded".** Sketches 1–2 did this and the owner's verdict was
  that user value **regressed** versus the shipped cards. The reframe that replaced it:
  > **The problem was never "too much information". It was that everything carried the same weight.**
- ❌ **v1's idea-card order** (`whyItFits` leading). Owner chose angle-first.
- ❌ **v1's label-free visual hook.** Owner wants the "Visual" label kept.
- ❌ **v2's overall treatment.** It removed the boxes but kept the labelled-zone *pattern* — a hook
  card still carried four uppercase micro-labels plus a run-on meta line. Owner: *"not something
  perplexity, claude or chatgpt would release."* That is what v3 exists to fix.
- ❌ **An 80px receipt thumbnail.** The 9:16 tower then runs ~30px taller than its text column and
  opens a dead gap. Taking the box off is what gives the cover presence, not extra width.
- ❌ **Promoting remix's adapted hook to a serif hero.** The hook then appears twice, because
  deleting its "Your hook" map cell orphans the "Hook / why it worked" row opposite it. **Remix is
  the deliberate exception: its hero lives inside the map.**

---

## 6. Implementation plan (only after Q1 and Q2 are answered)

1. **New component** `src/components/thread/sim-door.tsx` — the footer door. Reuses
   `useOpenRoomForCard` / `useAmbientCardId` / `LensTrigger` exactly as `ProofUnit` does, so the tap
   target, `conceptText`, `flatPersonas`, `population` and `rewrite` are unchanged. Three states:
   untested / running / measured(③ deferred).
2. **Four cards**, one atomic commit each: drop `<ProofUnit>`, drop `<TargetReaction>` from the
   face, de-box per §4, apply the chosen direction, rename room→audience, remove em dashes.
3. **`ProofReceipt`** — de-box (`-mx-2 … hover:bg-white/[0.03]`), fold the archetype into the
   eyebrow, one sage chip, views as text. Shared with nothing out of scope; safe to edit.
4. **Do NOT touch `proof-unit.tsx`.** Finding 4.

### Guards that must stay green

`thread/__tests__/radius-scale.test.ts` · `section-label-scale.test.ts` (unchanged if direction A;
**direction B's sentence-case labels are not "section labels" and trip none of its three rules** —
it bans `tracking-[0.14em]`, uppercase at 10px, and uppercase with arbitrary tracking ≠ 0.05em) ·
`card-surface-consistency.test.ts` (every card must keep `bg-surface-sunken`) ·
`proof-unit-open-room.test.tsx` · `ambient-card-anchors.test.tsx` · `no-source-note.test.tsx`.

### Tests that WILL need rewriting (they assert exactly what is being removed)

- **`make-card-value-fields.test.tsx`** — 4 of its 6 describe blocks assert the projected/measured
  wording: `toContain('would stop')`, `toContain('SIM-1 Flash')`, `toMatch(/\d+\/10 stopped/)`.
  All of that leaves the face. Rewrite to assert the **absence** of any fraction/band/provenance on
  the face and the presence of the door's state text. Its `visualHook` and `filming`/`production`
  tests still stand (keep them; `getByText('Visual')` stays valid per §2.8).
- **`idea-card-block.test.tsx`** — same treatment.

Then: `npx tsc --noEmit` + the thread vitest files, atomic commits, PR.

---

## 7. How to look at things

```bash
cd ~/virtuna-slot-a && git switch task/skill-cards-rework

open .planning/sketches/skill-cards-v3-directions.html   # ← v3, the DIRECTION CHOICE (start here)
open .planning/sketches/skill-cards-hierarchy.html       # ← v2 + the information inventory
open .planning/sketches/skill-cards-rework.html          # sketch 1 (throwaway)
open .planning/sketches/skill-cards-premium.html         # sketch 2 (REJECTED, kept for the record)

npm run dev -- --port 3001    # then /dev/cards — the real renderer, every card + degraded state
```

**Hosted copies** (private artifacts, fonts embedded so nothing silently falls back):
- v3 directions — https://claude.ai/code/artifact/1636b4f3-25c1-4c72-9b1f-f37668106047
- v2 + inventory — https://claude.ai/code/artifact/c1921048-bc8e-48b3-a822-21e1f4c9e9dc

⚠️ **`/dev/cards` is auth-gated** and 307s to `/login` when signed out. Credentials are in
`~/virtuna-slot-a/.env.local` as `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`, and in the memory
`e2e-auth-state-is-dead`. **That account is a real production account** — dev and prod share one
Supabase project, so a generation run signed in as it spends real credits. Browse; do not generate.

⚠️ Dev-server notes: an idle server is reaped after ~10 min — re-check with `lsof -ti:3001` before
hitting it. Cap it at 2 GB. Playwright screenshots hang on this app's ambient animations: use raw
Playwright with `animations:'disabled'` + `caret:'hide'`, and run node with
`NODE_PATH=/Users/davideloreti/virtuna-slot-a/node_modules` if the script lives in a scratchpad.

**SSOT:** `docs/subsystems/ui-skill-cards.md` (THE CARD CONTRACT §0.5). Design SSOT is
`src/app/globals.css` `@theme` + `docs/DESIGN-SYSTEM.md` — **not** `BRAND-BIBLE.md`/`docs/tokens.md`,
which are stale.

---

## 8. Measurements (both real widths, no horizontal overflow, no JS errors)

Current shipped card → reworked, in px:

| Card | 728px | 342px |
|---|---|---|
| hook | 575 → 483 (v2) → **393 A / 436 B** (v3) | 679 → 571 → **616 A / 678 B** |
| idea | 633 → 595 | 849 → 814 · v3: **538 A / 574 B** @728, **809 A / 930 B** @342 |
| script | 774 → 726 | 1120 → 1052 |
| remix | 746 → 702 | 1170 → 1127 |

Every card is shorter than today while hook and idea carry **more** on the face (their caret
contents moved up). The height came out of the chrome, not the content.

**Information inventory** (v2 mock, still current): across all four cards — **5 fields promoted,
24 kept, 7 deliberately demoted, 6 removed**, and every removal is the verdict the locked decision
hands to the simulation. Nothing a creator can use is deleted.
