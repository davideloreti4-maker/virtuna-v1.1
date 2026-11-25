# Home: the chats first, one field (new look)

Date: 2026-11-25. Changes `2026-11-23-home-design.md` (sections 3 and 6 there; where the two disagree,
this one holds). New look only; with the flag off nothing changes.

## 1. Why

Home today opens with "Money made $0", then the field, then four skill cards that fill a phone's
screen. Recent, the part with a creator's own work, scores and footage, starts at the fold. Home's
field is the thread's field in a second layout: its own pill for a picked skill, the audience inside
it, no skill buttons. Picking a skill takes the cards away and Recent jumps up.

The owner approved the redraw on the review page (section "Home, and the start of a new chat",
2026-11-25): the chats come first; the field is the chat's own field with the same skill buttons;
the audience sits under the greeting; money shows once there is some; the four cards stay only while
there is nothing else to show. That overturns two points of the 2026-11-23 spec: "No skill pills and
no More" on Home, and the cards on every visit.

## 2. The screen

Top to bottom. Phone first; desktop differs only where it says so.

1. **Top row** (phone only): unchanged. The avatar that opens the menu, the balance pill.
2. **Greeting**: unchanged.
3. **The audience**, one line under the greeting: "For @handle" and a small chevron pointing down.
   15 / 22, the secondary ink; the name at weight 560 in the ink; 5 between the words and the chevron
   (14). It is a button: it opens the audience sheet. Its name for a screen reader is its
   words, then ", change audience" ("For @handle, change audience"), so the name holds what is on
   screen. The general audience reads "For a general audience". 5 under the greeting on a
   phone, 8 on desktop; left on a phone, centred on desktop, as the greeting is. At least 44 to tap.
   The sheet: a bottom sheet on a phone as today; from 768 a popover centred under this line, and
   closing it puts the focus back on this line.
4. **The field**: the thread's field, same layout, same parts.
   - Row 1: "+" (add a video), the text (one line at rest, growing as in a thread), send.
   - Row 2: Simulate, Hooks, Script, Remix, More. A picked skill is the selected button with its
     price ("Hooks · 1"), a second tap lets it go, More names an armed skill, all as in a thread.
   - One difference: on Home the field is a solid card with the resting shadow (nothing scrolls
     under it); in a thread it stays glass.
   - Placeholder with no skill picked: "Ask anything". With a skill picked: the thread's own words
     for that skill.
   - Gone from Home's field: the ink pill above the text, the audience control, the "Add video"
     pill, the two-line text.
   - 14 under the audience line on a phone, 22 on desktop. 720 wide at most, as today.
   - Whatever opens from the field opens downward on Home: the "/" menu (as today) and More (from
     768; a bottom sheet on a phone).
5. **Under the field, one of three**:
   - **Not known yet** (the chat list has not answered): nothing. No cards flash for a creator who
     has chats.
   - **The creator has chats** (at least one titled chat): **Recent**. The header and "Library" as
     today, then up to five chats (three today), rows as today (tile, title, the line under it, the
     gauge). On desktop it shows whether the sidebar is open or not (today only with the sidebar
     closed): with the cards gone, the page would otherwise be empty under the field.
   - **No chats**: the **four skill cards**, as today, with three changes. The row is as wide as
     the field (720 at most; today 980). All four cards are the same height (a caption that wraps
     makes its row taller today, and the two rows differ). A tap on a card picks that skill in the
     field and the cards stay; nothing on the page moves. There is no "More skills" under them: More
     is in the field.
6. **Money made**, last: the row as today, only when the amount earned is above zero. At $0, with
   no amount, or while it loads: no row and no held space. 12 above it.

Opening a chat from Recent, a send, the loading outline on arrival, the greeting's copy, the balance
pill: unchanged.

## 3. Smaller things fixed with it

- More's "Read a file" says what comes out of it in plain words (today: "Reads a person from a
  screenshot").
- The guard against a second tap landing on Recent after the cards vanish goes: nothing vanishes.

## 4. Not in this part

What the app opens on a fresh visit (the last chat or Home); a picture for more kinds of chat in
Recent; anything about the thread's own field.

## 5. How it is checked

Component tests on real markup for the page and the field; the composer's Home tests rewritten to the
new behaviour (a card picks without hiding, the audience line opens the sheet, a send still becomes a
thread, focus still lands where it did); the dev page `/dev/home` with: no chats, chats, not known
yet, a skill picked, money above zero; flag-off tests untouched and green; a look in the real app on
a phone and a desktop, with the sidebar open and closed.
