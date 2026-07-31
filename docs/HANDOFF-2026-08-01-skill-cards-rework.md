# HANDOFF — Skill-card rework (in-thread generation cards)

**Branch:** `task/skill-cards-rework` (cut from `origin/main` @ `fb0a5a00`)
**Worktree:** `~/virtuna-slot-a`, dev port 3001
**Date:** 2026-08-01
**Status:** design exploration only — **zero `src/` files changed.** `npx tsc --noEmit` and vitest
have NOT been run because nothing compiles differently yet. No PR opened.

| Commit | What |
|---|---|
| `1a4b5704` | Sketch 1 — `.planning/sketches/skill-cards-rework.html` (density + ranking reframe) |
| `9e8cdbb5` | Sketch 1 — audit sections appended |
| `eac31e96` | Sketch 2 — `.planning/sketches/skill-cards-premium.html` (**REJECTED**, see §4) |

Scope is **in-thread generation only**: `hook-card` · `idea-card` · `script-card` · `remix-card`.
Library/saved, the ambient room, and wiring are **other sessions' problem** — owner said so explicitly.

---

## 1. What the owner decided (locked)

Answered via AskUserQuestion, treat as settled:

1. **The card shows no verdict; the simulation owns it.** Strip band word, `N/10` fraction,
   magnitude ribbon, the generated "verbatim" quote, and the `#1–#5` rank badge from every card
   face. Keep best-first **ordering** (free honest steer); mark only the lead card, once, as
   "Top pick" — a suggestion, not a placement.
2. **The card's sim door goes straight to ⑤ `AmbientSimulate`** in `develop` mode, pre-filled —
   not to the docked room.
3. **Density:** face = hero + one why-line + door + actions; everything else behind one expand.
   ⚠️ *This is the decision the owner later pushed back on — see §5.*
4. **Deferred:** door state ③ (a completed sim writing its verdict back onto the card). The slot
   ships ready; nothing writes to it.
5. **Do not worry about** honesty gating, provenance wording, or whether something is wired.
   Goal is "best wow and cheatcode perception", premium tool.

---

## 2. Verified findings — the durable part of this session

Every one traced to a file and line. **These are the reason the rework is correct, not just prettier.**

**Root cause.** On 2026-07-22 the four Make runners collapsed onto a single Qwen call and the
persona SIM left the generation path. The runners say so outright:
`personas + population INTENTIONALLY OMITTED` — `hooks-runner.ts:667`, `ideas-runner.ts:626`,
`script-runner.ts:659`, `remix-runner.ts:361`. Right call for cost/latency. What did not follow is
the presentation: several surfaces still read those fields and render their degraded half while
keeping chrome that promised a measured result.

| # | Finding | Evidence |
|---|---|---|
| 1 | **The whole visible verdict is one self-estimated number in five costumes.** `personaStops` is emitted by the writer about its own output; band, fraction, ribbon, quote and rank all derive from it. Cards sort on it. | `hooks-runner.ts:605–615` (the sort), `:475` |
| 2 | **"See the room →" opens a room of nobody.** With `personas` absent, the room falls back to expanding the fraction into `viewer_1…viewer_10` placeholders; none is a registry enum so `isGroundable` fails and **"Ask them why →" is gated off**. | `audience-presence.tsx:255–259`, `flat-card-reactions.ts:88`, `AmbientRoom.tsx:159` |
| 3 | **`TargetReaction` is half-dead.** Its header promises "here is what your skeptics said"; all three callers pass an empty panel so `verdict` is always null and that branch never renders. Ships as an *aim* wearing a *receipt's* border. | `hooks-runner.ts:637`, `ideas-runner.ts:599`, `script-runner.ts:638`, `target-reaction.tsx:44` |
| 4 | **`fraction` must stay on the block props.** `toAmbientDescriptor` returns `null` without it, which silently unhooks the card from the ambient ledger + scroll-spy anchors. Remove it from the **face**, never from the **schema**. | `ambient-descriptors.ts:68` |
| 5 | **True in-thread card width is ~728px** (`max-w-[760px]` + `px-4`). Mobile ≈ 342px. Judge every layout at both. | `thread-shell.tsx:30` |
| 6 | `visualHook` and `production` **are** emitted in prod — the "inert until the runner emits it" comments in `blocks.ts` are stale. | `hooks-runner.ts:664`, `script-runner.ts:665`, `remix-runner.ts:335` |
| 7 | Script and Remix emit **exactly one** card; hooks fan out ×5, ideas ×4. A card in a stack is a choice; a card that arrives alone is a document. They should not get identical density treatment. | `HOOK_COUNT=5` `hooks-runner.ts:85`, `IDEA_COUNT=4` `ideas-runner.ts:92`, `script-runner.ts:687` |

**Out of scope but real** (hand to whoever owns Library): `saved-item-card.tsx:254/:408` print
"stopped" unconditionally with no `provenance` gate, so a projected card claims a measured reaction
on the shelf; `radius-scale.test.ts:37` has `GUARDED_DIRS = ['thread','reading']` so `saved/**`
escapes the radius/type guards and carries `rounded-[10px]` ×2; no card passes `thread_id` to
`SaveAffordance` and `handleForward` ends in a bare `router.push("/home")`.

---

## 3. Assets the cards already hold and under-use

This is the "cheatcode" material — all real, all measured, none of it invented:

- `proof.coverUrl` — real TikTok cover, currently rendered at **34×60px**
- `proof.multiplier` — e.g. **144.9×** vs follower baseline
- `proof.views` — e.g. 2.0M
- `proof.hookTemplate` — **the source hook as a fill-in-the-blank**: *"Stop [doing the hard thing].
  Do [the easier thing] instead."* Already chip-rendered by `TemplatedHook` in `proof-receipt.tsx`.
  Strongest single asset on the surface.
- `proof.fitLabel` — in your audience / adjacent / cross-niche structure
- `whyItFits` (idea) — derived from the creator's **own scraped posts**; the "how does it know
  that" line. Currently a muted em-dash clause at the end of a sentence.
- `visualHook` (hook) — first-frame technique + what is literally on screen at 0s
- `production` + per-beat `filming` (script/remix) — an actual shoot plan

⚠️ **`proof` is conditional.** Present only when grounded generation ran AND the model attributed
that card to a source carrying a handle. Design the no-source shape first, not last.

---

## 4. What was REJECTED, and why (do not re-propose)

**Sketch 2 (`skill-cards-premium.html`, commit `eac31e96`) — rejected by the owner.**

- ❌ **Two-column "theirs ↔ yours" layouts (variants C and D).** *"doesn't work for mobile."*
  My own measurements said C/D held at 342px and were 37% shorter — **the owner overruled that and
  the owner is the decider.** Two-column card interiors are OUT. It is A or B.
- ❌ **The visual language of sketch 2 reads as "AI slop."** Owner's words. Concretely what to
  avoid: uppercase mono micro-labels sprinkled on every zone · the big-number-over-tiny-caps-label
  stat block · generic dark card + hairline border + faint tint zones · label chrome on content
  that self-reads. That is the default AI-SaaS look, not premium.
- ❌ **Mono in the card vocabulary** — dead with the above. `section-label-scale.test.ts` does not
  need changing.
- ⚠️ **User value regressed versus the OLD cards.** Owner's read, and it is fair: the old hook card
  told you the line, the visual execution, who it was for, where the structure came from, why it
  works, how the room reacted, the seed and the delivery channel. Both my sketches replaced most of
  that with a hero, one line, and a door. Cleaner ≠ more valuable.

### The reframe the next session should start from

> **The problem was never "too much information." It was that everything carried the same weight.**

The original complaint — *"overloaded with information and hard to read"* — has two possible fixes,
and this session picked the wrong one. Deleting content fixed the reading and destroyed the value.
The other fix is **hierarchy**: keep the substance, make one thing per card obviously primary and
let the rest recede through type, spacing and colour rather than through a caret. A card can carry
nine facts and still be scannable if only two of them are loud. Today all nine are 11–14px grey.

---

## 5. Recommended direction for the fresh session

1. **Start from the CURRENT card, not from my sketches.** Open `/dev/cards` (the gallery mounts
   every card + every degraded state) and work subtractively on chrome, not on content.
2. **Keep the locked decisions from §1 items 1, 2, 4, 5.** The verdict/rank removal is settled and
   is supported by finding #1. Treat §1 item 3 (aggressive collapse) as **overturned** by §4.
3. **Fix hierarchy first, chrome second, and only then consider moving anything behind a caret.**
   Candidate hierarchy per card, keeping everything on the face:
   - hook → the LINE is primary; visual hook + proof secondary; mechanism tertiary
   - idea → the TITLE + `whyItFits` primary (the account-knowledge flex); recipe secondary
   - script → the BEAT SHEET is the whole card; filming cues secondary
   - remix → the adapted hook + the decode map (already the best card here — leave it largely alone)
4. **Kill nested bordered boxes** — this survives the rejection. A hook card currently nests up to
   four bordered boxes inside a bordered card, which is most of the visual noise. Replace with
   spacing and tone, not with new labels.
5. **The door** (the "Not tested yet → Simulate with your audience →" row) survived review across
   both sketches and is the mechanism that makes the simulation worth paying for. Keep it. Three
   states designed: untested / running / measured — ③ deferred.
6. **Verify at 728px AND 342px before forming any opinion about a layout.** This session formed a
   confident wrong opinion from a 340px gallery column.

---

## 6. How to look at things

```bash
cd ~/virtuna-slot-a && git switch task/skill-cards-rework

# the sketches (throwaway; sketch 2 is rejected, kept for the record)
open .planning/sketches/skill-cards-rework.html
open .planning/sketches/skill-cards-premium.html

# the real cards + every degraded state
npm run dev -- --port 3001    # then /dev/cards
```

⚠️ Dev-server notes: an idle server is reaped after ~10 min — re-check it is listening before
hitting it (`lsof -ti:3001`). Cap it at 2 GB RAM. Playwright screenshots hang on this app's ambient
animations — use raw Playwright with `animations:'disabled'` + `caret:'hide'`, or assert via
`getComputedStyle`.

**Guards that must stay green when code finally changes:**
`thread/__tests__/radius-scale.test.ts` (tokens-only radii) ·
`thread/__tests__/section-label-scale.test.ts` (Inter 11px/0.05em label idiom — **no longer needs
changing**, mono is rejected) · `thread/__tests__/make-card-value-fields.test.tsx` and
`idea-card-block.test.tsx` (**both assert the projected/measured wording and the fraction appearing
exactly once — they will need rewriting, since that wording is what gets removed**) ·
`proof-unit-open-room.test.tsx` · `ambient-card-anchors.test.tsx`.

**SSOT:** `docs/subsystems/ui-skill-cards.md` (THE CARD CONTRACT §0.5). Design SSOT is
`src/app/globals.css` `@theme` + `docs/DESIGN-SYSTEM.md` — **not** `BRAND-BIBLE.md`/`docs/tokens.md`,
which are stale.
