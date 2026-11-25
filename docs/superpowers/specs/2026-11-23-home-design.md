# Home: the new chat screen (part 3, slice 5)

Date: 2026-11-23 · Status: approved by the owner 2026-11-23 ("Build as specified") · Plan:
`docs/superpowers/plans/2026-11-23-home.md` · Behind `NEXT_PUBLIC_NEW_LOOK` · Drawing (approved 2026-11-21 on
the answer-system sheet): **P1** Home (`.scratch/next-look/part3/answers/renders/ax-p1.png`), **P2** Home
with a skill picked (`ax-p2.png`), **D1** desktop (`ax-d1.png`) · Seam map (how Home works today, with
file:line): `.scratch/next-look/part3/home/seam-map.md`.

## 1. What this is

Home is what `/home` shows when no thread is open: the first screen of every session and of every new
chat. Today, with the flag on, it is still the old arrival inside the new shell: a serif greeting under a
black mark, a grey status line, the old chip row ("Remix a proven video", "Test a draft", "Find outliers")
stacked on the new field's own pills, and the field floating mid-screen.

The new Home is one greeting, one field, four skills that say what they do, and the last chats.

## 2. Rulings and facts it rests on

- Owner: Home stays skill cards, no "Today" stack and no prepared drops (2026-11-18). The field is docked
  only inside a thread; on Home it is part of the page under the greeting, and a docked field never sits
  above the tab bar (2026-11-18). Skills and the audience choice must explain themselves (2026-11-18).
  "+" adds a video to simulate (2026-11-20). "Simulate", never "Test". Copy short and plain.
- Every send runs inside the composer (`src/components/app/home/composer.tsx`): there is no send outside
  it. Home is therefore drawn by the composer, in place of today's arrival, and moves no request logic.
- The thread list gives a row its title and times, nothing else. "3 hooks · best 45% would stop" and a
  video picture (as drawn) have no source without a server change.
- The balance the sidebar shows as "N left" is credits (`useSubscription().usage.remaining`; none for an
  unlimited plan).
- Today's Home warms "drops" on every visit (up to nine model calls on a cold day) that the new Home never
  shows.

## 3. The screen

### 3.1 Phone (P1)

Top to bottom, in one scrolling column with the tab bar under it:

1. **Top row**: the account's avatar at the left (36, initials when there is no picture; opens Settings),
   the balance at the right as a quiet pill, "30 credits" (not shown for an unlimited plan or while it
   loads). In the 46 band the shell keeps free at the top. No title.
2. **Greeting**: "Good morning, Nia." (afternoon from 12:00, evening from 18:00; the first name; without a
   name "Good morning."). The page's `<h1>`, 30 / 35 bold.
3. **The field**, a card in the page (solid surface, resting shadow; not glass: nothing scrolls under it):
   - the text, two lines tall at rest, placeholder "Ask anything, or pick a skill";
   - under it one row: "+" (add a video), the audience ("Audience: @nia.tests", a dot before, a chevron
     after; opens the audience sheet, §4), and send at the right.
   - No skill pills and no More here: the cards under it are the skills.
4. **Four skill cards**, two by two: an icon in a small circle, the name, one line.
   Simulate "See who keeps watching" · Hooks "Openings for an idea" · Script "A full script, timed" ·
   Remix "Rebuild a proven video". A tap picks the skill and puts the cursor in the field.
5. **Recent**: the header "Recent" with "Library" at its right (opens Library), then up to three chats, one
   line each: the title, and when it was last written to ("2h ago") at the right. A tap opens the chat.
   The chats last written to, newest first, pinned or not (the sidebar's own list puts pinned chats
   first; under the word "Recent", with no pin on the rows, an old pinned chat above today's reads as
   a fault). Untitled ones are left out: a chat without a title has no message in it. Past a week a
   row shows its date ("Oct 24") instead of "118d ago". Not shown while there are none.

### 3.2 A skill picked (P2)

- The skill sits in the field above the text as an ink pill with its price and a cross: "Hooks · 1 credit ×".
  The cross (or Backspace in an empty field) lets it go.
- The placeholder asks for what that skill needs: Hooks and Script "What's the video about?", Simulate
  "Add a video or paste a link", Remix "Paste a TikTok link".
- The four cards are not shown while a skill is picked; Recent moves up. Letting the skill go brings them
  back.
- Adding a video with "+" picks Simulate, as in a thread.

### 3.3 Desktop (D1)

Beside the sidebar, one centred column: the greeting centred (36 / 40), the field 720 wide (its width in
a thread), the four cards in one row up to 980 wide (two by two while the column is under 760). No top row
(the sidebar has the account and the balance). The greeting starts at a fixed distance from the top
(about a fifth of the window), so nothing moves when the cards give way to a picked skill.

**Recent is shown in the page only when the sidebar's own list is not on screen** (the sidebar as a rail).
With the sidebar open, the same chats are already listed beside the page.

### 3.4 What a send does

Unchanged: the first send creates the chat and the screen becomes the thread, with the field docked at the
bottom. The text typed on Home is the text sent.

## 4. The audience sheet

Opened from the field's audience control on Home, and from the "Audience" row of the thread's More sheet
(it replaces the old picker there too, under the flag).

- Phone: a bottom sheet titled "Audience". Desktop: a popover under the control.
- The creator's own audiences, one row each: the name ("@nia.tests"), under it what it is modeled on
  ("TikTok"), a check on the one in use. A tap selects it and closes the sheet.
- "General" and the two shipped presets are listed only when the creator has no audience of their own, or
  one of them is the one in use (owner ruling 2026-11-16: presets and General are cut as choices).
- Last row: "New audience" (opens today's flow).
- Under the list, the platform: TikTok · Instagram · YouTube (the control the More sheet has).
- No uppercase labels; the new look's rows, sheet and segmented control.

## 5. Behaviour

- **Home shows only once the app knows no chat is open.** Today a reload into a chat paints the arrival
  first and the chat a moment later. With the flag on: while the first load is still out and the browser
  was last in a chat, the thread's loading outline shows, never Home.
- **Anything that opens from the field opens downward on Home** (the skill menu on "/", the audience
  popover on desktop): the field is near the top of the page, and today they open upward only.
- **"New chat" on a blank Home** (the tab bar's "+", ⌘N, the sidebar button) puts the cursor in the field.
  Today it reloads the screen, and the tab bar blinks.
- **The drops are not warmed** with the flag on, and the old chip row and arrival are not rendered.
- Keyboard: Tab order is top row, field (text, "+", audience, send), cards, Recent; every control is named
  and at least 44 px to tap; the picked skill's cross is "Remove Hooks".

## 6. Where this departs from the drawing (the owner's to overturn)

1. **Recent rows are a title and a time, with no picture tile and no second line.** The drawn "3 hooks ·
   best 45% would stop" and the video picture need data the list does not carry. A tile with a generic
   icon on every row would say nothing.
2. **No Recent in the page on desktop while the sidebar lists the same chats** (the drawing shows both).
3. **The picked skill's pill carries its price** ("Hooks · 1 credit"; drawn "Hooks"): on Home nothing else
   says what a send will cost.
4. **The audience sheet is new** (the drawing shows only its control): the old picker has uppercase labels,
   a washed-out control and the cut presets.
5. **No "More" on Home**: Ideas, Explore and "Your account" are reached by asking in words, by "/" in the
   field, or inside a thread. As drawn; named here because it is a choice.
6. **The picked skill's pill has no icon** (drawn with the card's pencil): the name and the price say it,
   and a skill picked with "/" has no card icon to carry over.
7. **A first visit with no chat yet shows the loading outline for one request, then Home**: until the
   server answers, the app cannot tell "no chat" from "the newest chat is about to open".

## 7. Not in this slice

A second line or picture for a recent chat (needs the server to summarise a thread); titles written by a
model; a first-day "Start here"; prepared or proven videos on Home; buying credits; the Simulate card
opening the camera roll directly; the legacy arrival with the flag off (unchanged).

## 8. Done when

1. Flag off renders and behaves exactly as before (flag-off suites green; flag-off production build matches
   the baseline; the drops still warm there).
2. A dev page shows Home in each state (empty, with chats, a skill picked, no name, unlimited plan; phone
   and desktop; light and dark) and it matches P1, P2 and D1 in a full-window side-by-side, apart from §6.
3. In the real app: a reload on a new chat shows Home with no old chips, no status line and no request to
   warm drops; a reload inside a chat never shows Home first; a card picks its skill; "+" stages a video and
   picks Simulate; the audience sheet changes the audience and the field shows it; a chat row opens its
   chat; a message sent from Home lands in a new chat with the field docked; "New chat" on a blank Home
   focuses the field.
4. One real send from Home (a chat message) and one real skill run from Home (Hooks, 1 credit) on the test
   account.
5. Keyboard and tap sizes as §5; nothing opens off the top of the screen.
6. An independent critic reviewed the full-window renders; its points applied or answered.

## 9. As built (2026-11-23)

Built as specified, with these changes. Each is the owner's to overturn.

1. **"More skills" under the cards** (overturns §6.5). A design critic's first finding: Ideas, Explore and
   "Your account" could only be reached by typing "/", which nobody does on a phone. One quiet link under
   the four cards opens the More sheet the thread already has.
2. **Recent is by last message, newest first** (§3.1 said the sidebar's order). The sidebar puts pinned
   chats first; under the word "Recent", with no pin on the rows, old pinned chats above today's read as a
   fault. Past a week a row shows its date instead of a count of days.
3. **The "/" list is new** (not in the drawing or the first spec). The old one said "MAKE", "TEST" and
   "A real video MAX". Seven skills, one line and a price each; the name that starts with what was typed
   comes first; Enter takes the marked row; send is off while it is open.
4. **Simulate picked, nothing staged: the "+" becomes an ink "Add video" pill**, and the audience control
   drops its "Audience:" prefix where room is short, so the handle stays whole.
5. **The balance is shown only for a paid plan or a trial**, on the phone's top row and in the sidebar
   (which now says "30 credits", as drawn). An account without a plan showed "0 credits" while its skills
   still ran.
6. **A video send that fails before its run starts comes back to Home** with the clip still staged, the
   reason by the field and "No credits used." Inside a chat it puts back the question that was showing.
7. **Arriving**: the heading and the avatar hold until the profile has answered (no nameless greeting
   that grows a name); a reload into a chat shows that chat's loading outline, its title and no tab bar
   from the first frame; "New chat" on a blank Home drops a picked skill, a staged clip and an error,
   keeps the typed text and puts the cursor in the field, with no reload.
8. **Leaving**: a send from the keyboard keeps the cursor in the field once the thread shows; other
   keyboard exits (send on its button, a Recent row) land in the docked field's text; a pointer is left
   alone.
9. **The audience sheet**: the platform control is headed "Simulating for"; a run for another platform
   than the audience's says "Modeled on TikTok. On Instagram this is an estimate."; "New audience" has its
   plus at the right edge.
10. **Sizes as measured on the drawing, not as first written**: the field 720 wide, the cards up to 980,
    card corners 20, card lines 13 px, the greeting 36 / 40 on desktop starting 24% down the window; Recent
    capped at 720 on desktop.
11. **Explore's own run control is not drawn on Home** (the field's send runs it), and in a thread it now
    goes through the same one-at-a-time send path as the field.

Not done, and why: a second line or picture on a Recent row (the list has no such data); the two names a
critic found confusing ("Explore" beside the Discover tab, "Your account" reading as settings: both were
approved earlier); a way to tell, after a failed first load, that the next send joins an existing chat.

