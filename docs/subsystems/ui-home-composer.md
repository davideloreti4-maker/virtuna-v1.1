# Subsystem: The home composer — starter, skill selection, audience

> Written 2026-07-14, from operating the dev server on `lane/explore-a`.
> SSOT for the `/home` empty state and the composer's selection model.
> Sibling doc: `docs/subsystems/ui-skill-cards.md` (§0.5 THE CARD CONTRACT — what a *result*
> card looks like). This doc is about what the creator sees **before** a result exists.

---

## 1. What it is

`/home` is the whole app's front door: a greeting, a grid of things you can do, and a
composer. Every skill (Chat · Ideas · Hooks · Script · Remix · Explore · Test · Account)
runs from that one composer — there is no per-skill page. So the composer has to answer
three questions at all times, and for a long time it answered none of them:

| The question | Answered by | What it used to do |
|---|---|---|
| What can this app do? | the **starter grid** | redrew itself per skill — the six things became four different things |
| What is armed **right now**? | the **skill chip** | named the VERB GROUP: pick "Script", it said **"Make"** |
| What does that skill want from me? | the **placeholder** | vague ("Ask anything…"), and the app booted into Test |

Those three are now a deliberate division of labour. **Change one, and you must check the
other two still tell the truth** — that is the whole contract.

---

## 2. THE STARTER CONTRACT (`src/components/app/home/home-starter.tsx`)

### The shape — one, for every skill

```
greeting        ← HomePageLayout (centered, serif)
starter grid    ← THE SIX. 2-col ≥sm. One card anatomy.
composer        ← the field the grid ramps INTO
```

### The six are CONSTANT

They do **not** change with the armed skill. The grid is the map of what the app *does*, and
a map that redraws itself when you turn is not a map.

| # | Card | Action |
|---|---|---|
| 1 | Get content ideas | ARM `idea` |
| 2 | Write scroll-stopping hooks | ARM `hooks` |
| 3 | Script a video | ARM `script` |
| 4 | Remix a viral video | ARM `remix` |
| 5 | Test a video | ARM `test` |
| 6 | Read my recent posts | **RUN** `account` |

Card 6 is the only one that *runs* rather than *arms*, because Account is the only skill that
takes no input — arming it alone would leave the creator in front of a field with nothing to
type. It spends a Reading, so it fires from the creator's tap and **never** from a render.

### Rules

1. **One card anatomy** — `StarterCard`. Icon left, filled sunken surface, r12, title
   14px/medium, and nothing else. Never a second card component.
2. **No prose.** No lede above the grid, no sub-line under a title. The titles are verbs.
3. **Nothing auto-fires** (D-05/D-07). `onSelect` runs on tap, only on tap.
4. **Matte, no accent** (dosage rule).
5. A card either **arms** a skill or **runs** one. No card is a dead end.

### Where it renders

Fresh home only (`!hasConversationContent`), above the composer. It does **not** follow the
creator into thread mode — it used to, purely to keep Account reachable, and that is no
longer necessary (see §4).

---

## 3. The skill chip — it names the SKILL

`composer-controls.tsx`. The chip renders `getSkill(activeTool).label` and the skill's own
icon. It previously rendered `VERB_BY_TOOL[activeTool]`, i.e. the group — so "Script",
"Hooks", "Ideas", "Remix" and "Explore" **all rendered as "Make"**, and the armed skill was
stated nowhere on screen except a checkmark inside a closed popover.

The verb groups (Make / Test / Ask) still **head** the menu — they organise the list. They
never stand in for the skill on the chip face again.

### The menu

- **No filter header.** ("type to filter · ↵ to select" is gone; typing still filters.)
- **Short descriptions stay** — they teach the skill.
- **ONE right slot per row, never two.** The check **replaces** the `/command` on the armed
  row. Previously every row reserved an empty check column that only one row ever used.
- **Selection reads harder than hover**: `bg-white/[0.10]` + inset ring, vs `0.035` hover.
- **The armed row scrolls into view on open** (`block: "nearest"`). The list overflows the
  popover's `max-h-[60vh]`, and Chat — the default — sits in the last group, so without this
  the app's own default state opened a picker that appeared to have nothing selected.

---

## 4. Per-skill entry points (what each skill needs from the field)

`PLACEHOLDER_BY_TOOL` in `composer.tsx` is **load-bearing copy, not flavour.** Since the grid
is constant, the placeholder is the *only* per-skill cue left. Each line must answer "what do
I type, and what happens if I don't?".

| Skill | Field | Empty send | Notes |
|---|---|---|---|
| `chat` | a question | ✗ disabled | **the default** (`DEFAULT_TOOL`) |
| `idea` / `hooks` | topic | ✓ Auto mode | empty = we pick the angles |
| `script` | topic | ✓ carries the picked hook | |
| `remix` | TikTok URL | ✗ required | |
| `explore` | niche | ✓ un-niched pull | richer entry = the **params popover** (magnifier, `onRunExplore`): niche · accounts · time-window · serendipity |
| `test` | TikTok URL / upload | ✗ required | the only skill that navigates (`/analyze/[id]`) |
| `account` | **none** | ✓ **runs the read** | the empty field is not a missing input |

### Account is sendable — and that is what let the six go constant

Account used to be `canSubmit: false`, so an in-view CTA inside its thread view was its
**only door**. That CTA is precisely what forced the starter to carry a bespoke per-skill
card. Making send run the read gives the skill a door in every state (fresh home, live
thread, keyboard) and deletes the special case rather than relocating it.

---

## 5. The default skill, and the New Thread trap

`DEFAULT_TOOL = "chat"`.

The app used to open on `test`, so a brand-new thread greeted the creator with *"Paste a
TikTok link or drop a video…"* — a demand for an asset before they had said a word, and the
narrowest of the eight skills as the front door. Chat is the one skill that takes a plain
sentence.

**The trap:** on rehydration, the composer restores the tool of the most recent persisted
card (so reloading a hooks thread lands you back in Hooks). That restore only called
`setActiveTool` **when it found a card** — and an empty thread has nothing to find. So
"New Thread" silently inherited the previous thread's skill: open a hooks thread, hit New
Thread, get a blank page still armed with Hooks. The restore now falls back to `DEFAULT_TOOL`
when nothing is restorable. **If you touch the restore, keep the else-branch.**

---

## 6. The audience — General is a default, not an accident

**"No audience" is not reachable.** `GENERAL_AUDIENCE` is a *real* audience — the default
socials baseline every creator gets before calibrating, and what the regression gate scores
against. It is never null-in-effect.

The risk is subtler: General is named innocuously enough that a creator can spend a week of
Readings against a generic crowd while believing they are testing against their own people.
So the presence chip tags it **NOT CALIBRATED** (`audience-presence.tsx`, gated on
`isGeneral`) — a quiet muted tag, **not a warning**. Correct, just not yours yet.

> ⚠️ Do not conflate `is_general` with `mode: "general"`. `GENERAL_AUDIENCE` (`is_general:
> true`, `mode: "socials"`) is the creator baseline and must stay. `GENERAL_TEMPLATES`
> (`mode: "general"`) are the hidden horizontal. See `src/lib/flags/horizontal.ts`.

---

## 7. What is locked, and where

| Invariant | Test |
|---|---|
| The six are constant; no per-skill knob exists on the API | `app/home/__tests__/home-starter.test.tsx` |
| Account RUNS on tap; nothing auto-fires on render | `home-starter.test.tsx` + `composer-selection.test.tsx` |
| No prose; one card anatomy | `home-starter.test.tsx` |
| The chip names the SKILL, never the verb group | `composer-selection.test.tsx` + `composer-controls.test.tsx` |
| Boots into Chat; a card-less thread resets to Chat | `composer-selection.test.tsx` |
| Account send enables on an empty field and runs the read | `composer-selection.test.tsx` |
| One right slot: the check replaces the `/command` | `composer-controls.test.tsx` |
| General is tagged NOT CALIBRATED; calibrated audiences are not | `audience-lens/__tests__/audience-presence.test.tsx` |
| Explore's thread view owns **no** idle state | `thread/explore-thread-view.test.tsx` |

---

## 8. History (why any of this looks the way it does)

The `/home` empty state was rebuilt across three passes on `lane/explore-a`, 2026-07-14:

1. **Four empty states → one shape.** Make had a centered grid, Ask a left-aligned prose
   block, Explore its own bespoke card (icon *above* the text, no fill, `p-5`, 16/14px),
   Account a centered `<Button>`. Three alignments, two card anatomies, three type scales.
   Underneath was a real bug: `hasThread` flipped on **tool selection alone** for the three
   skills that owned an idle view, and `HomePageLayout` reads `hasThread` and
   `hasConversation` separately — so arming one of them dropped the centering and stretched
   the composer to the bottom *while the greeting kept rendering*. Greeting pinned top,
   composer pinned bottom, dead gap between.
2. **The prose went.** Lede and sub-lines cut; cards 69px → 53px.
3. **The sets went.** Same shape, different *contents* per skill was still a surface moving
   under the creator. The six went constant, and the chip + placeholder took over the job of
   saying what is armed.

The through-line, and the reason this doc exists: **each surface was built alone, with
nothing written down to conform to.** Same root cause as the thread-card drift
(`ui-skill-cards.md` §0.5). A contract with a test behind it is the only thing that has
actually stopped it recurring.
