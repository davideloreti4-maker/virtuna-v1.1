# The phone's drawer (new look)

Status: ruled by the owner 2026-11-25 ("drawer plus bottom bar is the right"; on the control inside a
chat: "go with your rec"). Drawn first: the sheet shown to him that day. This spec is the build's
source; where it differs from the drawing, section 7 says so.

Behind `NEXT_PUBLIC_NEW_LOOK`. Flag off renders exactly as before.

## 1. What this is

On a phone the app has a bottom bar with the four places and a New chat button. That bar stays. It is
joined by a drawer that slides in from the left and carries what the desktop sidebar carries, so the
phone and the desktop have one way around: a new chat, the places, You, Earn, the recent chats, and
the account with Settings and Log out.

It closes three gaps a phone has today: there is no way to log out, no way from inside a chat to
another chat or a place without first leaving the chat, and Earn and Settings are reachable only
through You.

## 2. Rulings and facts it rests on

- The owner: a left drawer AND the bottom bar. Inside a chat: a chat opened from Library keeps Back
  at the top left (it returns to Library where he left it); every other chat shows the menu there.
- The desktop sidebar (`components/shell/side-nav.tsx`) is the model for what the drawer holds and in
  which order. It is not changed by this part.
- Below 768 the desktop sidebar is mounted and hidden, so the chat list, the profile and the balance
  are already loaded on a phone. The drawer reads the same queries.
- A chat is not a route: the open one is a pointer, and `/home` shows it. `useThreadActions` holds
  New chat and opening a chat.
- The only overlay part is the Radix dialog (`components/ui/sheet.tsx` has a left side). No gesture
  library is installed.
- Layers: the bar and the phone's top band 250, a scrim 300, a panel 400, a toast 500.

## 3. The screens

### 3.1 The opener

- **On the four places** (Home, Discover, Library, Audience), phone only: the creator's picture, round,
  36, at the top left of the place's own top row, before its title. On Home it is where the picture is
  today; there it stops being a link to You and opens the drawer instead (You is a row in the drawer).
  Its name for a screen reader: `Open menu`. It has a 44 touch area.
- Library's search, when open, takes the row: the picture is hidden until the search closes.
- **Inside a chat**, the phone's top band:
  - opened from Library: Back, as today (it returns to Library with its chip, search and scroll);
  - opened any other way, or started new: the menu button (three lines), `Open menu`, in Back's place.
    New chat stays at the right.
- **Every other pushed page** (a result, a video, a collection, a pull, You, Earn, Settings, a new
  audience) keeps Back.
- From 768 up none of this shows: the sidebar is there.

### 3.2 The drawer

A panel from the left over a scrim. Its width is 86% of the screen, at most 320. It is on the page's
ground, flush with the left edge, full height, with the safe areas kept free. No glass.

Top to bottom:

1. **Maven** (the mark and the word). Not a link.
2. **New chat**: the one raised row, as the sidebar's.
3. **The places** in the sidebar's order: Home, Discover, Audience, Library. The current one is lit.
   Inside a chat whose row is listed under Recent, that row is lit and Home is not (as the sidebar).
4. A hairline, then **You** and **Earn** (the name alone, as the sidebar's rows).
5. **Recent**: the label, then up to six chats by the sidebar's own rule (the newest always, then only
   named ones). A row is 44 tall and shows the chat's name on one line. The open chat is lit. Under
   them, **All chats** opens Library. With no chat, or while the list loads, the label, the rows and
   All chats are not drawn.
6. At the bottom, held there when the list is short: a hairline, then **the account**: the picture,
   the name, and under it the balance as the sidebar's tag words it (`30 credits`), or nothing when
   there is no countable balance. It is not a control. Then **Settings** and **Log out**.

The middle (3 to 5) scrolls when it does not fit; the top two rows and the account block stay.

Pin, rename and delete are not in the drawer: they are in Library's row menu.

### 3.3 Opening and closing

- It opens from the opener only. No edge swipe (the edge is the system's Back).
- It closes on: a tap on the scrim, Escape, any row (also when the row leads to where the creator
  already is), New chat (also on a blank Home, where New chat only puts the cursor in the field),
  the open chat's own row, Log out, and when the window becomes 768 or wider.
- Opening moves the focus into the drawer, to its title (`Menu`, shown to a screen reader only). The
  rest of the page is not reachable while it is open. Closing without choosing a row returns the focus
  to the opener.
- A `Close` button, visible only when focused, serves a screen reader on touch (as the app's sheets).
- It slides 300 ms; with reduced motion it appears and goes without the slide.
- While it is open the page behind does not scroll.

### 3.4 What each row does

| Row | Does |
|---|---|
| New chat | the shell's New chat (a blank Home, the cursor in the field) |
| A place, You, Earn, Settings, All chats | opens it |
| A recent chat | opens it on Home. No way back to Library is recorded: its top left then shows the menu |
| Log out | signs out; the app's own guard leads to the sign-in page |

### 3.5 Loading and failure

- The picture falls back to the initials, then `?`, as the sidebar. The name falls back to the email,
  then `Account`.
- A chat list that failed to load draws no Recent block (as the sidebar). Library says what failed.

## 4. Data

Nothing new is read or written: the chat list, the profile and the subscription queries the sidebar
already uses. The drawer's open state lives in memory (the shell's store) and is never stored: a
reload starts closed.

## 5. What is not offered

- A swipe to open or close.
- Pin, rename, delete on a drawer row.
- A search in the drawer (Library has it).
- A theme switch in the drawer (Settings holds Appearance).

## 6. Words

New: `Open menu` (the opener's name), `Menu` (the drawer's title), `All chats`. Reused as they are:
`New chat`, the places' names, `You`, `Earn`, `Recent`, `Settings`, `Log out`, `Close`, and the balance
words of the sidebar's tag.

## 7. Departures from the drawing

- **Earn shows its name alone**, not an amount: the sidebar's row is the name alone, and most creators
  would read `$0`. The amount stays on Home's "Money made" row and on Earn.
- **No plan word** beside the balance (the drawing said `Creator · 30 credits`): the app holds no such
  word for a plan today. The balance alone.
- **No sun button**: the theme is a choice of three (light, dark, the system's) in Settings; a
  two-way switch would not say which it is.
- **Settings is a row** above Log out (the drawing named it in its caption only).
- **Inside a chat** the drawing showed two options; the owner's ruling is the mix in 3.1.

## 8. Not in this part

The desktop sidebar, the bottom bar, the pushed pages' Back, Library's return, and every screen's
content are as they are. A new Competitors page, Settings and the plans pages are their own parts.

## 9. Decided by the controller (the owner said to go with the recommendation)

The five points of section 7, the closing rules of 3.3, the 44 row height, and leaving pin, rename and
delete to Library. Each is small and can be turned round without touching the rest.

## 10. Done when

- On a phone (320, 375, 393), light and dark: the opener is on the four places and in a chat that was
  not opened from Library; the drawer opens, shows its rows, marks where the creator is, and every row
  does what 3.4 says; a chat opened from Library still has Back and returns to Library at its scroll.
- Log out works from a phone.
- Keyboard and screen reader: focus goes in on open and back to the opener on close; Escape closes;
  nothing behind is reachable while it is open.
- At 768 and wider nothing of it shows, and an open drawer closes when the window grows.
- Types, the whole test suite, lint and both production builds pass; flag off matches the baseline.

## 11. As built (2026-11-25)

Where the build differs from the sections above, this section is what stands. The plan
(`docs/superpowers/plans/2026-11-25-phone-drawer.md`) was written before these points were settled.

- **Initials (3.5).** One rule for the opener and the drawer's account, Home's: the initials of the
  name, else the email's first letter, else `?`; empty while the first read of the profile is out. Not
  the sidebar's rule.
- **The balance (2, 4).** It is not already loaded on a phone. The balance line asks for it when the
  drawer opens, once per opening, and shows the last value it had while the new one is on its way.
  The account block keeps one height with or without the line.
- **All chats (3.2).** At the right end of the Recent label's row, not under the list: under the list
  it sat below the fold on a common phone.
- **Home inside a chat (3.4).** The Home row leaves the chat for the blank Home. The sidebar's Home
  link keeps the chat on screen; on a phone that read as a row that does nothing.
- **New chat (3.3, 3.4).** The drawer closes in the tap and the new chat starts in the same tap, so on
  a blank Home the cursor is in the field without waiting for the slide (a phone raises its keyboard
  only for a focus inside the tap).
- **Back on You, Earn and Settings (8).** Section 8 left the pushed pages' Back as it was. With the
  drawer these three pages open from anywhere, so their Back now goes back to where the creator was
  (in history), and up to its old target only when there is nothing to go back to. Settings opened
  from You still returns to You. A list returned to this way opens at its top (Library keeps its
  scroll only for a chat opened from it).
- **The opener's picture.** The drawer's frame reads the profile once (the read the sidebar already
  makes) and publishes the picture and initials in the shell's store; the openers read the store and
  send nothing.
- **Audience's title** is 24 px on every phone (it was only under 360 wide): its row holds the
  opener, the title, the audience's pill and More, and with the 30 px title the audience's name was
  cut to a few letters at 375 and 390. At 320 the name is still cut.
- **Leaving the app's frame** (signing out, or Back out of the app) closes the drawer and forgets the
  published picture, so nothing of it is there on the next entry.

## 12. Later the same day: no bottom bar

The owner ruled, after seeing the drawer built: "lets just keep the drawer no more bottom nav." Under
the new look a phone has no bottom tab bar. The drawer is the phone's one way around: its opener is at
the top left of the four places and of a chat. New chat is the drawer's first row and the button at the
top right of a chat. This replaces section 1's "That bar stays" and the first ruling in section 2. The
four places keep the safe area clear at their foot.

Not in this part, noted for later (section 11): Log out with no connection says nothing (the sidebar's does the
same); the phone's Back with the menu open goes back a page and the menu closes with it; the desktop
sidebar's Home inside a chat still changes nothing; the rules the drawer shares with the sidebar
(Recent, the lit row) are written in both.
