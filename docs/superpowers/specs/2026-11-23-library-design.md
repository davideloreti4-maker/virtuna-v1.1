# Library: one list of your chats (part 4)

Date: 2026-11-23 · Status: scope ruled by the owner 2026-11-23 ("One list, no Posted yet"; "A Saved filter
in Library"); this spec approved by him 2026-11-23 ("Build as specified") · Plan:
`docs/superpowers/plans/2026-11-23-library.md` · Behind `NEXT_PUBLIC_NEW_LOOK` · Reference
(approved 2026-11-18, option A "one list, filter by stage"): the v11 app-screens sheet, Library A on the
phone and the Library table on desktop · How Library and its data work today, with file:line:
`.scratch/next-look/part4/library/seam-map.md`.

## 1. What this is

Today `/library`, with the flag on or off, is the shelf of saved pieces with folders. A creator's chats are
listed only in the desktop sidebar (six of them) and on Home (three). On a phone there is no list of chats
at all, and no way to rename or delete one.

The new Library is the one place for everything a creator has made: every chat as a row that says what is
in it and how it did, filtered by stage, searchable, with the saved pieces one tap away.

## 2. Rulings and facts it rests on

- Owner, 2026-11-18: Library option A, one list with stage chips. 2026-11-23: build it now without
  "Posted", "said 67" and "9 of 12 right" (nothing records what a posted video really did; that is the
  after-posting part); saved pieces become a "Saved" filter; folders are not shown under the new look
  (their data and the old screen stay); any database change needs his word.
- Standing: "Simulate", never "Test"; gauges are ink (no green or coral, no "usual"); about a dozen kinds
  of thing per screen; copy short and plain.
- What a chat holds is only in its messages and its simulation records. No summary exists. The list of
  chats the app has today carries a title, two times and the pin, for the newest 50.
- Measured on the live data (2026-11-23): reading the messages and simulation records of one page of
  chats on the server is cheap today, also for the heaviest account, so the summary needs no stored copy.
- A simulation started from a text is written to whichever chat is open, so nothing in Library may start
  one.

## 3. The screen

### 3.1 Phone

Top to bottom, the tab bar under it with Library lit:

1. **Header**: "Library" (the page's `<h1>`, 30 / 35 bold) and at the right a round search button.
   A tap turns the header into a search field with a cross; the list filters as you type.
2. **Chips**: All · Drafts · Simulated · Saved. One is always selected; All at the start.
3. **The list**, one card. A row:
   - a tile, 42 × 56: the frame of the chat's video when it has one and the frame can still be loaded;
     else the mark of what the chat holds (hooks, ideas, a script, a remix, a video, or a plain chat);
   - the title (two lines at most);
   - one quiet line: what is inside and when, for example "3 hooks · simulated 2h ago", "Script · 2h ago",
     "Video · simulated yesterday", "Chat · Oct 24";
   - at the right, for a chat with a simulation, the gauge with the number of the piece simulated last
     (46, ink). A chat with nothing simulated has no gauge.
   A tap on the row opens the chat. A tap on the gauge opens that piece's result.
4. **More**: "Show more" under the list while there are older chats.

### 3.2 Desktop

Beside the sidebar, a column up to 980 wide: "Library" with a search field (280) at its right; the chips;
the list as a table: tile, title with its line, a "Stage" column (Draft / Simulated, nothing for a plain
chat), the gauge. No "After posting" column.

### 3.3 Stages

- **Simulated**: the chat holds at least one piece with a number (a text simulated, or a video).
- **Draft**: the chat holds something made (hooks, ideas, a script, a remix, a text or a video brought in)
  and none of it has a number yet.
- A plain chat (only messages) is neither; it shows under All.
- Chats without a title are not listed (they hold no message).

### 3.4 Saved

The fourth chip lists the saved pieces, newest first. A row: the mark of its kind; the piece's own text
(two lines); "Hook · from {chat title}" (or "Video · saved in Discover" for one with no chat); at the
right a filled bookmark that removes it (with "Removed. Undo" for a few seconds). A tap on the row opens
the chat it came from; a saved video without a chat opens the video where it lives.

### 3.5 Managing a chat

Each chat row ends in a "More" control (three dots; on desktop it shows on hover and focus): Rename, Pin
or Unpin, Delete (asked twice, as in the sidebar). On the phone it opens a small sheet. These are the
sidebar's existing actions; the phone has had no place for them.

### 3.6 States

- Loading: the header, the chips and six quiet placeholder rows.
- No chats at all: "Nothing here yet." and one button, "New chat".
- A filter with nothing: "No drafts." / "Nothing simulated yet." / "Nothing saved yet. Save a hook or an
  idea from its details."
- A search with nothing: "No chat called "{query}"."
- The request failed: "Couldn't load your library." and "Try again".

## 4. Data

- One new read-only endpoint, behind the flag, returns a page of the creator's chats (30, newest message
  first, optionally only those whose title contains the search text) with a small summary per chat:
  how many hooks, ideas, scripts, remixes, videos and brought texts it holds; its stage; the piece
  simulated last with its number, what the number measures ("would stop to watch" or "watch to the
  end"), when, and what is needed to link to its result; the frame's address when there is one.
- The summary is worked out on the server when the page is read, from the chats' messages and simulation
  records. The heavy data never reaches the browser. **No database change.** One pure function does the
  reduction, so it can later be stored per chat (a database change, his call) without touching the screen.
- A video's number is the one its result page shows, computed by the same function.
- The sidebar, Home and the palette keep their own short list as it is.
- Saved pieces come from the existing saved list and its existing save and remove requests.

## 5. Behaviour

- **Filters** apply to what is loaded. With Drafts or Simulated selected and fewer than a screenful of
  matches, older pages are fetched on their own (at most four at a time) before "Show more" is offered.
- **Search** asks the server (it covers every chat, not only the loaded ones), 250 ms after typing stops;
  it applies together with the chip. Escape or the cross clears it.
- **Opening** a chat is what the sidebar does. On the phone, Back in a chat opened from Library returns to
  Library, where the creator came from (Back in a chat opened any other way starts a new chat, as today).
- **Nothing here spends credits.** No "tap to simulate" on a row.
- Rename, pin, delete and remove-saved update the row at once and roll back with a message if they fail.
- Keyboard: Tab order is search, chips, then rows (row, its gauge, its More); every control is named and
  at least 44 px to tap; the chips are a group of toggle buttons named "Filter".
- Flag off: `/library`, its folders and `/saved` render and behave exactly as before.

## 6. Home's Recent

Home's three Recent rows take their second line from the same summary ("3 hooks · simulated 2h ago") in
place of the bare time, and a gauge when there is a number, as the Home drawing showed. Tile and gauge are
the Library row's, smaller where the drawing is.

## 7. Where this departs from the reference (the owner's to overturn)

1. **No Posted chip, no "said 67", no ✓ / ✗, no "9 of 12 right"** (ruled).
2. **A fourth chip, Saved** (ruled); no folders.
3. **No empty gauge that simulates on a tap.** A simulation is written to the open chat; from Library it
   would land in the wrong one. A chat with nothing simulated shows no gauge; Simulate lives in the chat.
4. **Gauges are ink**, without the green or coral against "usual 58".
5. **The quiet line says what is inside** ("3 hooks · simulated 2h ago"), not only the stage and the time.
6. **The row shows the piece simulated last.** In the reference a chat with hooks at 66 and a video at 38
   shows the video's 38; here it shows whichever was simulated most recently, with its own measure in the
   gauge's description.
7. **"More" on a row** (rename, pin, delete) is not in the reference.
8. **"Show more"** for older chats, and a search that asks the server: the reference draws eight rows.

## 8. Not in this part

Posted and the track record; folders; saved videos' own place in Discover; a stored summary per chat;
archived chats (they cannot be listed or restored today); sorting; selecting several rows; the
simulations result pages lighting "Library" in the sidebar; starting a simulation from a row.

## 9. Open points for the owner

- Text and video numbers measure different things ("would stop to watch" and "watch to the end") and sit
  in the same gauge. The row's line and the gauge's description say which. If that is not enough, the
  gauge needs a visible word.
- Video simulations are recorded on the chat only where the app runs with its "ambient" setting on (it is
  on in development). Where it is off, a chat's video would read as a draft.

## 10. Done when

1. Flag off renders and behaves exactly as before (flag-off suites green; flag-off production build
   matches the baseline).
2. A dev page shows Library in each state (loading, empty, chats, each chip, a search, the failure;
   phone and desktop; light and dark), and it matches the reference's Library A and the desktop table in a
   full-window side-by-side, apart from §7.
3. In the real app on the test account: the list shows the account's chats with the right contents and
   numbers (checked by hand against three chats opened one by one); the chips filter; search finds a chat
   that is not on the first page; "Show more" loads older ones; a row opens its chat; a gauge opens its
   result; a saved hook shows under Saved and opens its chat; rename, pin and delete work on the phone;
   nothing on the screen sends a paid request.
4. Home's Recent shows the second line and gauge from the same data.
5. Keyboard and tap sizes as §5.
6. A review after every task, a whole-branch code review and an independent design critic on the
   full-window renders; their points applied or answered.

## 11. As built (2026-11-24)

Where the build differs from the text above, and why. Each was ruled during the build after a review, a
run of the real app or the design critic showed the need.

1. **An untitled chat is listed when it holds something** (against §3.3). A chat started with a video
   alone has no title; leaving those out hid real work. It is named by what it holds ("Video simulation"),
   and the same name shows in its header when opened from a row.
2. **Pinned chats come first** (not in the spec). Without it, pinning from a row changed nothing a creator
   could see, and the phone has no sidebar. Pinned chats lead under every chip and in a search, most
   recently pinned first; Home's Recent stays the three chats with the latest message.
3. **The chip and the search live in the address** and nowhere else, so a reload, Back and a shared link
   agree with the screen. The Library tab clears both.
4. **Removing a saved piece** shows "Removed." with Undo in the row's place and sends the removal after six
   seconds or when the creator leaves; Undo sends nothing. A refusal brings the row back with "Couldn't
   remove it."
5. **The row menu.** Rename takes 200 characters at most. The delete step names the chat, asks "Delete this
   chat?" and says what goes with it and that it can't be undone. Its buttons are laid out so the second
   tap of a double tap lands on Cancel (measured on phone and desktop).
6. **A chat that is gone never opens another.** A saved piece or a stale row whose chat was deleted lands
   on a new chat with "That chat was deleted."
7. **The list is read again after a chat was opened from it** (and Home's Recent likewise), and a rename,
   pin or delete in the sidebar reaches a Library on screen.
8. **The failure message** uses the new look's own panel, readable in light and dark.
9. **A saved piece with no chat** shows its text up to six lines and when it was saved ("Hook · Jul 28");
   it opens nothing.
10. **The simulated text never leaves the server**: a row's link to a text's result carries a key.
11. On a phone narrower than 360 the row's second line wraps; the pin mark sits at its start.

### Open for the owner (found by the design critic and the real-app run, not taken)

- The gauge shows a bare number (as the reference does). The critic asks for "%" and for a word on which
  piece of the chat the number belongs to.
- The desktop's "Stage" column repeats what the row's second line says; the critic would drop it and the
  header row.
- Untitled video chats all read "Video simulation". Naming them from the clip (its first spoken line) and
  showing the clip's length would tell them apart.
- A saved piece cannot be copied or sent to a chat from the list.
- The result pages do not light "Library" in the sidebar.
