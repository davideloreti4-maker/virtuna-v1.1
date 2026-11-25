# Maven's pick: which hook it would post, and why (step 3)

Date: 2026-11-25. Follows `2026-11-25-thread-feel-design.md` and the two depth specs. The line and the
sheet are new look only (`NEXT_PUBLIC_NEW_LOOK`); the hooks writer's one new field is written for
every run and the old look ignores it.

## 1. Why

After three or five hooks land, the creator has to choose one before spending a credit to simulate.
Maven already ranks them (row 1 is its own first choice) and never says so. And the one place that
explains a hook, "Why it works" in its sheet, reads like this in a real run today: "The Bold
Statement fires cognitive dissonance by framing a standard student behavior as an active financial
loss rather than just a missed opportunity. It appeals to the loyalist's trust in…". That is the
writer's working note (`mechanism`), not something to show a creator.

The owner approved the drawing on the review page (section "Next: Maven's pick", 2026-11-25): one
line under the hooks saying which one Maven would post and why, and the same plain reason in the
hook's sheet.

## 2. What a hooks run writes

One more field for each hook, **`why`**: one plain sentence, at most 14 words, saying why a viewer
stops on this hook. Short, everyday words; the viewer is "you". No theory terms, no names for kinds
of viewers, no quoting the hook back, no dash.

- It is asked for in the same call that writes the hooks (all three shapes of the writer's
  contract). No new call, no new cost.
- The writer's `mechanism` stays as it is: it is the writer's own reasoning, and the old look shows it.
- On the card's block it is optional (`why?: string`), stored only when the writer gave one. A pack
  written before this has none. Nothing about validation gets stricter: a long or odd `why` never
  costs a card.

## 3. On screen (new look)

A `why` is **usable** when, trimmed, it is one line of at most 140 characters, has at least three
words with a letter in them (in writing without spaces: at least 8 letters), is not a web address, and is not the hook's own words again. It is
shown as a sentence: a first word in lower case gets its capital (a word like "iPhone" stays as
written), a dash becomes a comma, and it ends with a full stop unless it already ends with one, a
question mark or an exclamation mark. A reason that is not usable is treated as none.

### 3.1 The line under a pack of hooks

"Maven would post hook 1." and then the reason of that hook, in the place where the measured line
goes today (under the card, above the chips; the measured line's own type, 15 / 22, the ink, so
the swap moves nothing):

> Maven would post hook 1. It dares a friend by name, so you wait to hear why.

- The hook is the one the writer ranked first (the lowest `rank` on the card: 1 in every normal
  run); the number is its row on the card.
- It shows for a pack of two or more hooks whose first-ranked hook has a usable `why`, until every
  hook of the pack is simulated. Then the measured line takes the place, as today ("Hook 2 leads by
  5 points."), also when it names another hook: the numbers win.
- Otherwise there is no line, as today. Ideas have none.
- In a landing it comes in right after the card's button, before the chips.

### 3.2 The hook's sheet

"Why it works" shows the hook's `why`, whole, when it is usable. Without one it shows what it shows
today (the folded `mechanism`), so an older pack is unchanged.

## 4. Not in this part

The remix's "Why the original worked" in plain words (its text comes from the video's decode; a
separate, small change to what the remix writer returns). Ideas. A tag on the picked row.

## 5. How it is checked

Unit tests for the writer's parsing and the block; component tests on real markup for the line (each
of its conditions) and the sheet; the dev page `/dev/answers` with a pack that has reasons and one
that has none; then real hooks runs in the real app: read what the writer returns for `why` on at
least three runs (plain, short, true to the hook), see the line under the pack on a phone and a
desktop, simulate one pack to the end and see the measured line take its place, open a hook's sheet.
