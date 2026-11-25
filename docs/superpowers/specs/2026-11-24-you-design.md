# You: what Maven knows about you (part 5)

Date: 2026-11-24 · Status: approved by the owner 2026-11-24, section 10's four points included ("yes
sounds good"): the database change, the writers using the facts, the avatar opening You, the skill's
rename afterwards · Plan: `docs/superpowers/plans/2026-11-24-you.md` · Behind `NEXT_PUBLIC_NEW_LOOK` · How the app holds and uses creator facts
today, with file:line: `.scratch/next-look/part-you/seam-map.md` · Reference he sent: the "Brain" page of
a competitor (a wiki the product writes about the creator).

## 1. What this is

Today what Maven knows about a creator is split in three and mostly invisible:

- A form in Settings › Creator Profile (niche, platforms, audience, goal, style). Hardly anyone fills it.
- A description Maven writes itself when it reads the creator's account: what they make, how they sound,
  their formats, what to avoid. It already steers hooks, ideas and scripts, but only while the creator's
  own audience is selected, and the creator can neither see it nor correct it.
- Connected accounts, in a Settings tab.

Nothing holds what the creator sells, how they sound in their own words, what they are able to film, or
what they never do.

You is one page for all of it: what Maven read from your account, what you told it, and your accounts.
Every item on it changes what Maven writes. Nothing on it is decoration.

## 2. Rulings and facts it rests on

- Owner, 2026-11-24: an own page named "You", with connected accounts inside it. Earn is a separate page
  (affiliate only). The Money read later lives in the "what you sell" card. Order of parts: Library, You,
  the after-posting loop with account connections, Earn, Discover and Audience.
- Standing: consumer-simple, about a dozen kinds of thing per screen; show it through the interface;
  copy short and plain; ink, no accent; any database change needs his word.
- Measured 2026-08-12 (`docs/superpowers/specs/2026-08-12-exemplar-fence-design.md`): an example line in
  the voice slot is copied. A pasted caption gave its topic to 43 % of a hook pack; a better line came
  back word for word in 13 %. So "how you sound" is a description, never examples.
- Checked on the live database 2026-11-24: the creator's row has no column for any of the five free
  facts below. The account read's description exists per calibrated audience (one sentence on what the
  creator makes; one line on audience, voice, formats, expertise and what to avoid).
- The writers take creator facts through one seam (`PROFILE_ROLE_MAP` and `MODE_ROLES` in `src/lib/kc/`)
  for hooks, ideas, script and chat. Remix builds its own line. The bundle has about 415 characters of
  room under its 6,000 cap. A profile judged "thin" gets no facts at all, and three copies of that check
  exist.

## 3. The screen

### 3.1 Phone

Reached from the avatar at the top left of Home (today it opens Settings). A pushed screen: Back returns
to Home, no tab bar.

1. **Header**: Back, "You".
2. **Who**: the avatar (56), the name, and under it the primary account, "@handle · 12.4K followers", or
   "No account connected". A tap edits name and photo.
3. **From your account** (only when Maven has read an account): the sentence on what you make, then the
   line it wrote about how you sound, your formats and what to avoid. Quiet foot: "Read from @handle,
   3 days ago". Not editable. One line under the card: "Something off? Say it below. Your words win."
   Without an account the card is one line and one button: "Connect your account. Maven reads what you
   make and writes like it." · "Connect".
4. **In your words**: one card of rows. A row is its name, what is saved in one or two lines (or a quiet
   "Add"), and opens in place into one field with Save and Cancel. One row is open at a time.
   - **Niche**: a pick from the existing list of niches.
   - **About you**: who you are, in a line. "Nurse, mum of two, started posting last year."
   - **What you sell**: your offers. "A 12-week meal plan, $49. Affiliate for two blender brands."
   - **How you sound**: a description. "Dry, short sentences, a bit of swearing. Never say 'guys'."
     Hint under the field: "Describe it. Don't paste a post: Maven would copy its topic."
   - **What you can film**: "Phone only, my kitchen, on camera. No b-roll, no editing beyond cuts."
   - **Never**: "No before/after bodies. No giveaways. Never name a competitor."
   - **Goal**: one of four chips (Grow, Engage, Brand deals, Sell), the existing setting.
5. **Accounts**: a row per connected account (platform mark, @handle, "Primary", "synced 2d ago") with
   More (Make primary; Disconnect, asked twice, with the existing warning about what goes with it), and
   a last row "Connect an account" (TikTok, Instagram or YouTube by @handle, as today).
6. **Settings**: one row at the foot. Billing, notifications, appearance and Log out stay there.

### 3.2 Desktop

A fifth row "You" in the sidebar, after Library. Beside the sidebar a column up to 720 wide with the same
sections in the same order. Rows open in place as on the phone.

### 3.3 States

- Loading: the header and quiet placeholders for the three cards.
- Nothing told yet: every row reads "Add". No banner, no progress meter, no "profile 40 % complete".
- A save that fails: the row stays open with the text kept and "Couldn't save. Try again."
- An account that fails to connect: the existing messages (not found, private, too few videos).

## 4. What each item is and where it lives

| Item | Stored | Limit | Read by |
|---|---|---|---|
| Name, photo | existing settings row | as today | greeting, sidebar |
| From your account | existing, per calibrated audience | — | hooks, ideas, script, while that audience is selected (as today) |
| Niche | existing column | — | every writer, remix, the simulation |
| About you | **new column** | 200 | hooks, ideas, script, chat, remix |
| What you sell | **new column** | 300 | hooks, ideas, script, chat, remix |
| How you sound | **new column** | 200 | hooks, ideas, script, remix (not chat, as today) |
| What you can film | **new column** | 200 | ideas, script, remix |
| Never | **new column** | 300 | every writer and remix |
| Goal | existing column | — | ideas (as today) |
| Accounts | existing table and requests | — | the account read, the audience |

One set of facts per creator, not one per account or per platform.

Not shown on You, and left as they are: the legacy form's audience fields (age, gender, place, language),
stage, content style, cadence, past wins and flops. The audience a creator writes for is the Audience
page's job.

## 5. How the facts reach what Maven writes

Without this section the page is a form that does nothing. It ships in the same part.

- Five new lines in the writers' creator block, each fenced as the creator's own text and cleaned on
  save by the existing cleaner (control characters, zero-width characters and the fence's own markers
  are stripped).
- Order of importance, which is also what is dropped last when a bundle is too long: niche, audience,
  never, how you sound, what you sell, about you, what you can film, then the lines that exist today.
- "Never" is printed as a rule: it holds over everything else in the bundle, the account read included.
- Remix gets never, what you sell, about you and how you sound in its own block.
- A creator who filled any of the five is no longer "thin". The three copies of that check become one.
- The five limits add up to 1,200 characters. The bundle's cap rises from 6,000 to 7,200, so nothing
  that fits today is dropped because a creator filled in You.
- The account read keeps steering as today. Where it and the creator's words disagree, both are in the
  bundle and the creator's are marked as theirs.

Checked with real runs on the test account before it is called done: the same asks for hooks, ideas and
a script with nothing filled and with all five filled. Pass means: a "never" is broken in none of the
results; the offer shows up when the ask is about selling and does not when it is not; nothing from "how
you sound" comes back word for word; results with nothing filled are unchanged. About a dozen paid runs.

## 6. The database change

One migration, additive only: five empty text columns on the creator's row (`about`, `sells`,
`writing_voice_description`, `can_film`, `never_do`), each with its length limit. No data is moved or
rewritten, no access rule changes (the row is already readable and writable only by its owner), and
nothing reads the columns while the flag is off. Undone by dropping the five columns.

It is applied to the one live database, so it needs the owner's word before it runs. The repository
holds an older migration for a voice column the live database never got; this one is applied alone.

## 7. Where it sits in the app

- Desktop: a sidebar row, not a tab-bar slot. The phone's tab bar keeps its five slots.
- Phone: Home's avatar opens You. Settings moves one tap further (the row at the foot of You). The
  desktop's account menu keeps Settings and Log out.
- `/you` is a signed-in page. With the flag off it does not exist.
- Settings itself is not touched in this part. Its Creator Profile and Connected accounts tabs go on
  working and write the same data, until Settings gets its own part.

## 8. Where this departs from the reference he sent

1. **One screen, not a wiki.** The reference shows many generated pages about the creator. Here it is
   one card of what was read and seven rows. A creator should see all of it without navigating.
2. **What Maven read is shown but not edited.** The creator corrects it by saying the fact in their own
   words, which then holds for every audience and every tool.
3. **No completeness meter and no nagging.** An empty row costs nothing.

## 9. Not in this part

The Money read. Keeping the paid account read's result (it lives only in the chat it ran in). Facts
learned from chats on their own (memory). Facts per account or per platform. Signing in to a platform
(connections stay "type your @handle"; the after-posting part changes that). Earn. A new Settings.
Suggesting the five facts from the account read.

## 10. For the owner to rule

1. **The database change of section 6.** Recommended: yes. Without it the page can show only what Maven
   read, the niche, the goal and the accounts: nothing new for the creator to say, and little value.
2. **Writers use the facts in this part, with about a dozen paid test runs and the cap raised by 1,200
   characters** (section 5). Recommended: yes. A page whose facts change nothing is the kind of feature
   to avoid.
3. **Phone: the avatar opens You, and Settings is one tap further.** Recommended: yes.
4. **The skill "Your account" keeps its name for now.** With a page called You that lists Accounts, the
   skill's name will confuse more than it does today. Recommended: rename it "Read my account" as its own
   small change after this part.

## 11. Done when

1. Flag off renders and behaves exactly as before (suites green; the flag-off production build matches
   the baseline).
2. A dev page shows You in each state (loading, nothing told, everything told, no account, an account
   with a read, a row open, a failed save; phone and desktop; light and dark).
3. In the real app on the test account: each of the five facts saves, survives a reload and shows on
   the row; the niche and goal save; an account connects, becomes primary and disconnects; the read card
   shows what the database holds for that account; nothing on the page spends credits.
4. The runs of section 5 pass.
5. Keyboard and tap sizes as on Library: every control named and at least 44 px to tap.
6. A review after every task, a whole-branch code review and an independent design critic on the
   full-window renders; their points applied or answered.

## 12. As built (2026-11-24)

Built as specified, with the differences below. Each was ruled during the build. The three marked ◆
were put to the owner, who accepted all three as built on 2026-11-24; a check of every answer against
"never" after writing is its own later part.

**The page**

- An account row's second line is the platform only ("TikTok"), with no "synced …" time: nothing
  refreshes an account's snapshot on a schedule today, so the time would stand still.
- A connected account Maven has not read yet says so in the card ("Maven hasn't read @handle yet. It
  reads an account when you set up its audience.") with one link, "Set up audience".
- Two accounts with the same handle are told apart by platform in the menu and its question ("@handle
  on Instagram"). A refused action says which one ("Couldn't disconnect @handle. Try again.").
- Disconnect is asked twice, and the confirming button ignores presses for half a second after the
  question appears, so a double tap cannot disconnect.
- A connect holds only its own form while the account is read. The rest of the page stays usable.
- Connect's messages are the route's own two sentences (section 3.3 named messages that belong to
  setting up an audience).
- The anonymous visitor's card has no button: the new look has no sign-up path for an anonymous session
  yet. The Settings row sits under it.
- The command palette lists a place named exactly first, so typing "You" opens You.

**How the facts reach what Maven writes (section 5)**

- ◆ **The cap.** Not "6,000 to 7,200". Everything that is not one of the five facts keeps the 6,000 it
  has today, and the facts ride on top: a bundle's cap is 6,000 plus the characters its fact lines take,
  and no fact line is ever dropped. With their headers and fences the five facts take about 2,350
  characters at their limits, more than the planned raise, and a fixed raise let a long ask push the
  creator's own facts out. Worst case 8,354 characters (ideas or a script, every fact at its limit, an
  ask to sell). A creator with none of the facts gets the same bundle as before, byte for byte.
- ◆ **"What you sell" is given to hooks, ideas and script only for a selling ask**: a selling word in
  the ask or in the piece being developed, or the ask names the offer. Chat always has it. From the real
  runs: with the line always present, one idea in four for a non-selling ask pitched the offer; with
  stronger "leave it out" wording the offer vanished from selling asks too.
- ◆ **"Never" is an instruction to the model, not a guarantee.** In the real runs a banned word came
  back in 6 of 19 answers, each time as a denial or in quotes ("No hacks."), under three wordings. A
  guarantee needs a check of the answer after it is written, which is its own part. Chat has its own
  wording, so it can still talk about the rules.
- "What you can film" says it wins over the account read where the two differ.
- Remix takes never, how you sound, about you, and what you sell when the brief is about selling. It
  does not take "what you can film" (section 4's table said it would): a remix's shots come from the
  source video.
- The adapt briefer's voice slot reads the same column, fenced, as a description of style.
- Not carrying the facts yet: the step that revises a remix line, and the one-line note after a run.

**The database change (section 6)**

Applied to the live database on 2026-11-24, recorded as
`supabase/migrations/20261124022536_creator_profile_you_facts.sql`.

**The runs (section 5)**

24 real answers on the test account: hooks, ideas and a script, with nothing filled and with all five
filled. The offer shows for a selling ask and not otherwise: met, with the rule in code. Nothing from
"how you sound" came back word for word: met. Nothing filled is unchanged: met. A "never" broken in
none: not met for a banned word (above).

**Not done**

- A real photo upload on the test account (the app has no way to clear a photo afterwards). A refused
  upload was checked.
- A live anonymous session on `/you` (each one is a new visitor row). The card was rendered on the dev
  page.
- A real remix run with the facts.
- With the flag off, a signed-in request to `/you` gets the app's not-found screen with status 200, as
  the dev pages do, where an unknown path gets 404.
