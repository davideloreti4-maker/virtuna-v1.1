# Platform structure — Studio with Maven on every screen

> **Design, 2026-11-16.** Stage 1 of the app overhaul (structure). Stage 2 is the visual language,
> stage 3 the rebuild, part by part.
> **Evidence:** `docs/AUDIT-2026-11-16-ux-ui.md`.
> **Mockups:** https://claude.ai/artifact/W2MCUgtSm8fLGgSSyHwbVR — boards "Chosen · Studio with Maven
> on every screen" (phone), "Chosen · desktop", "Chosen · Earn" and "Chosen · simulation and
> prediction". The mockups show structure; their look is a placeholder.
> **Status:** structure picked by the owner; the details below are open for his review.

## 1. What was decided, and by whom

| Decision | By | Date |
|---|---|---|
| Launch user is the solo creator on a phone; desktop is the larger version | Owner | 2026-11-16 |
| The "chat stays the main surface" rule may be broken | Owner | 2026-11-16 |
| Structure A (Studio) with a full-screen feed in Find, and the assistant integrated more than drawn | Owner | 2026-11-16 |
| Product loop Find → Write → Check → Learn at launch; Make and Post later; TikTok and Instagram on every stage; connecting an account starts the free 7 days | Owner | 2026-11-16 (vault `40 Maven/`) |
| Earn is a loop stage. Its "Money read" is the first screen of the product, public, with no sign-up; a thin version ships at launch; Maven never holds money | Owner | 2026-11-16 (vault `Maven money read`) |
| Earn is the fifth tab | Owner | 2026-11-16 |
| "Ready to make" is included in every plan and the trial, not charged as credits, one set a day | Owner | 2026-11-16 |
| The default audience is the connected account; another creator's audience stays as an option inside Check; presets and "General" are cut | Owner | 2026-11-16 |
| Nothing is simulated unless the creator fires it; prepared drafts arrive without a score (the 2026-08-11 rule stays) | Owner | 2026-11-16 |
| Each check makes one gradable call: below, around or above your usual | Owner | 2026-11-16 |
| Maven is docked on every screen and is the voice of the simulated audience; it is not the home screen | Owner | 2026-11-16 |
| Everything else in this document | Claude | 2026-11-16 |

## 2. The model

Seven things exist. Every screen shows one of them or a list of them.

| Thing | What it is | Today |
|---|---|---|
| **Account** | A connected TikTok or Instagram account. It is the default audience and the baseline ("your usual"). | Split across audiences, connected accounts, creator profile |
| **Source video** | A proven video from the library or a pasted link | Outlier tiles, home cards |
| **Draft** | Something Maven produced that nobody opened yet (a hook, a remix, a prepared card on Today) | Thread cards |
| **Video** | The creator's own video in progress. One hook, one script, its checks, its post, its result. Has its own address and its own conversation. | Does not exist |
| **Check** | One test of a video's script or footage for one platform. Belongs to the video. | Lives in the side panel |
| **Result** | Predicted vs actual for a posted video | Code exists, no screen |
| **Offer** | A paid offer on an outside rail (a pay-per-view campaign or an affiliate program). Once picked it belongs to a video. | Does not exist |

Rules:

- An offer is never free-floating work. "Make the video" on an offer creates a video that carries
  it: its brief, its rate, its minimum views and the ad label.

- A draft becomes a video when the creator opens or saves it. Unopened drafts stay in the
  conversation that produced them and do not appear under Videos.
- A video moves through **Script → Check → Posted → Result**. Edit and Post are reserved stages that
  appear with Releases 2 and 3.
- A check never exists without a video. Pasting a link or uploading footage to test creates the
  video first.

## 3. Navigation

**Before sign-in.** The first screen is the Money read: public, one field, no account.

**Phone (below 768 px).** Five tabs: **Today · Find · Videos · Results · Earn**. Above the tabs, on every
tab screen, sits the Maven dock: one field. A screen title bar replaces today's floating menu
button. Account and settings open from the account chip in the title bar.

**Desktop (1024 px and up).** Left navigation with the same five items and the account at the bottom.
Main area in the middle. Maven is the right-hand pane, collapsible, and it remembers whether it is
open. From 768 to 1023 px the left navigation shrinks to icons and Maven opens as a sheet.

**Addresses.**

| Address | Screen |
|---|---|
| `/today` | Today |
| `/find`, `/find?tab=watching\|saved`, `/find?q=` | Find |
| `/videos`, `/videos/[id]`, `/videos/[id]?stage=check\|result` | Videos, one video |
| `/results` | Results |
| `/earn` | Signed out: the Money read entry. Signed in: the Earn tab. |
| `/c/[id]` | A conversation that is not tied to a video |
| `/account` | Account, plan, connected accounts |

Every old address redirects to its new one. `/home` goes to `/today`.

## 4. Screens

### Today
- Two sentences from Maven about the account's last day, with up to two actions.
- **Ready to make:** prepared drafts built from proven videos, as tall video tiles. Prepared before
  the visit; never an empty box on arrival. They carry no score, only an order ("Strongest today").
- **Continue:** videos that are not posted, with their next step in words.
- Maven dock: "Paste a video or describe an idea".

### Find
- **For you:** proven videos from the account's niche, full screen, playing, one at a time. Main
  button "Make my version"; Save and Next beside it.
- **Watching:** accounts the creator follows in Maven (today's Watchlist and Competitors, merged).
- **Saved:** saved source videos.
- Maven dock: search, and questions such as "what is working in budget cooking?".
- "Pull live" becomes what search does when the library has no answer; it is not a separate page.

### Videos
- The creator's videos grouped by where they stand: to script, to check, to post, posted.
- Each row: thumbnail or placeholder, title, score if checked, next step.

### One video
- Header: title, platform switch, stage tabs **Script · Check · Edit · Post · Result**.
- **Script:** the source it is based on, the hook, the script in timed beats, how to film it.
  Quick actions above the dock (Shorter, More direct, 3 other hooks). Main button "Check".
- **Score header:** on every stage, the latest score with Maven's track record under it. An edit
  marks it out of date and offers "Check again".
- **Check:** the number, the call against the creator's usual, who stayed and who left, at most
  three fixes with "Apply". Buttons "Test my footage" and "I posted this". Section 6 has the rules.
- **Result:** the call next to what happened once the post has settled, graded Right or Wrong,
  plus one sentence on why.
- On desktop, Script and Check sit side by side.
- "I posted this" links a post: pick it from the account's recent posts or paste its link. When the
  account posts something that matches a video, Maven offers the link itself.

### Results
- One line on accuracy ("9 of 12 calls were right") and how it is graded.
- Maven's reading of the latest miss or win, with an action.
- Posted videos with the call, what happened against the creator's usual, and Right or Wrong. Wrong
  calls are listed like right ones.
- A card to share for a call that was right ("Maven called it").
- "What is working" as one pattern with a button to make another like it.

### Earn
- **Money read:** what the account's views are worth at the most common rate, in one number, with
  the rate and the fee stated beside it.
- **Offers you can join today:** a short list. Each row: who pays, how (per 1,000 views or per
  sale), the minimum views if any, and "Make the video".
- A line that the offer pays the creator directly and Maven holds no money.
- At launch the list is hand-picked and includes Maven's own affiliate offer, which replaces the
  dead referrals page.
- A video with an offer shows it at the top of Script with "Ad label on". The ad label is written
  into the script for the creator's market and Maven's edits never remove it.

### Account
- Connected accounts, plan and credits, sign out. Nothing else at launch.

### Entry
1. **Money read, public.** Paste a handle and choose TikTok or Instagram, or pick a niche when
   there are no posts. No sign-up.
2. **The read and the offers**, as on the Earn tab.
3. **Picking an offer is where sign-up happens.** With a connected account that has recent posts
   the free 7 days start.
4. The new user lands on the video for the offer they picked, not on an empty Today.
- A visitor who skips the offers can still sign up and connect; they land on Today.
- No form about niche. The trial's rules are in the vault note "Maven pricing and trial"; what a
  visitor without posts gets is open in the vault note "Maven money read".

## 5. Maven

One assistant, present in four ways.

1. **The dock.** A field above the tabs on every tab screen. Its placeholder says what it does
   there. Tapping opens the conversation over the screen.
2. **The conversation.** Full height on a phone, the right pane on desktop. A chip at the top says
   what it is about ("New video", "This video", "Your results"). Results appear as short cards with
   a score and "Open". A clock icon lists earlier conversations.
3. **On a video.** Each video has its own conversation. Maven changes the page itself. Each change
   is named in place ("Maven moved the price into the first line") and has Undo.
4. **Unprompted.** Maven writes the two sentences on Today and the reading on Results.

Rules:

- Maven knows what is on screen. Nobody picks a tool, a model or an audience before asking.
- A plain request gets a result. If something is missing, Maven assumes the obvious, says what it
  assumed, and offers to change it. It never answers a request with a quiz.
- Anything that takes more than a few seconds shows its output as it arrives. Progress names what
  the creator will get, never the pipeline step.
- The skill menu, slash commands and the model picker leave the main path. Attaching a file or a
  link stays, as one button in the open conversation.

## 6. Simulation and prediction

The simulation is what no competitor has, and the graded record of its calls is the moat. It is
not one tab among five: the score rides on the video, and Maven speaks for the simulated audience.
Mockup board: "Chosen · simulation and prediction".

**The score**
- **It sits in the video's header on every stage,** with Maven's track record on this account under
  it ("right on 9 of your last 12 videos").
- **One headline number, one scale:** "N of 10 would stop scrolling".
- **One call that can be graded:** below, around or above your usual. Results checks exactly this
  statement against the post's public numbers 72 hours after posting.
- **One sentence** that agrees with the number.
- **An edit marks the score out of date.** "Check again" is one tap, and Maven reports the change
  ("6 → 7").

**The check**
- **It is a deliberate act and an event.** The creator presses Check; "1,000 viewers like yours are
  watching" counts up for a few seconds; the number appears when the last one has decided. A thing
  nobody checked shows no number. Lists of unchecked drafts are ordered strongest first, in words.
- **Two depths.** A script check before filming, in seconds. A footage check before posting: the
  creator uploads the take and gets the watch-through second by second. The brain view belongs to
  the footage check and sits behind "see more".
- **Compare.** Two hooks or two versions head to head. Ranking is what a simulation does most
  reliably.

**The audience**
- **Shown as people:** named groups, each with its share and one line in its own words ("Skeptics ·
  left at 0:09 · 'Another haul video.'").
- **Ask them.** From the Check tab the creator can ask a group why, through Maven.
- **Fixes come from them.** At most three, each a concrete change with "Apply".

**Honesty**
- Until five posts of an account are graded, the call is labelled "early" and no track record is
  shown.
- The engine today compares the predicted and the realized mix of reactions and reports a match
  percentage. Turning that into a graded below / around / above call is engine work inside part 7.
- Production held no graded posts on 2026-11-05. The fleet's own posts should seed the record
  before launch.

**Rules that carry over**
- **The tested thing shows its result.** A checked video shows its score wherever it is listed.
- **Per platform.** A check is for TikTok or for Instagram; "Test for Instagram too" runs the other.
- **Audience:** the connected account of that platform. Testing against another audience is an
  option inside the Check sheet, not a control in every bar.
- **With an offer, Check answers a second question:** is the video likely to clear the offer's
  minimum views. It is shown as one line under the score.
- Group names for viewers come from one list and are the same on every screen.

## 7. Words

Use what a creator says: video, hook, script, check, score, fix, post, result, your usual, viewers,
offer, ad label.

Not on screen: room, sealed, queued, calibrated, baseline, verdict, concept, read, lever, proven
structure, seed line, run, routing, SIM-1, Flash, Max, model names, internal identifiers.

Maven does not name the model it runs on.

## 8. From today's app to this

| Today | Becomes |
|---|---|
| `/home` arrival (home cards) | Today → Ready to make |
| `/home` thread + composer | Maven conversation and dock |
| Thread cards (hook, idea, script, remix) | Drafts as short cards; opened ones are videos |
| Side panel: queue, simulation form, results | The video's Check tab and its sheet. The panel is removed. |
| `/analyze/[id]` | The video's Check tab for uploaded footage |
| Discover · Outliers | Find → For you |
| Discover · Collections | Rows inside Find → Saved, if kept at all |
| Watchlist, `/competitors`, compare, `/feed/channels` | Find → Watching |
| `/feed/discover` (Pull live) | Search in Find |
| `/library`, saved items, projects | Videos, and Find → Saved for source videos |
| `/audience`, audience detail, new audience | Account, plus the "another audience" option in Check |
| Outcome loop, account read | Results, and the two sentences on Today |
| `/settings` (8 tabs) | Account. Team, Creator Profile, Company, Role are removed. |
| Skill menu, slash menu, model picker, platform chip, audience chip | Removed from the bar. Platform lives on the video. |
| Sidebar thread list | The clock icon in Maven |
| Sign-up, `/welcome`, the `/go` offer page | The Money read entry, then sign-up at the pick |
| `/referrals` stub, referral code | Maven's own offer on the Earn tab |
| `/calendar`, `/start`, `/grow`, `/analytics`, `/saved` stubs | Deleted |

Code that stays: the skills behind hooks, ideas, script, remix, explore; the simulation and video
test; the outlier library; the account read and the outcome loop; threads and messages as the
store for conversations.

## 9. Parts and order

Each part gets its own plan. The visual language is decided before part 1 starts.

| # | Part | Depends on | Why here |
|---|---|---|---|
| 0 | Visual language (own spec) | — | Every later part is drawn in it |
| 1 | Shell: tabs, title bar, desktop layout, addresses, redirects | 0 | Everything mounts in it |
| 2 | The video object and the Videos list | 1 | The thing every other part reads and writes |
| 3 | One video: Script and Check tabs, on the existing skills and simulation | 2 | The core of Write and Check |
| 4 | Maven: dock, conversation, per-video conversation, changes with Undo | 2, 3 | Replaces the composer and thread |
| 5 | Today | 2, 4 | Needs drafts and videos |
| 6 | Find | 1, 2 | Needs "Make my version" to create a video |
| 7 | Results, and linking a post to a video | 2 | Needs the outcome loop running in production |
| 8 | Earn: the offer list, an offer on a video, the ad label, the minimum-views line in Check | 2, 3 | Needs the video page |
| 9 | Entry: the public Money read, sign-up at the pick, connect an account, the free trial, Account screen | 1, 8 | Ruled entry and trial rebuild; replaces sign-up, welcome, the offer page and billing |

Instagram on every stage is a requirement on parts 3, 6, 7, 8 and 9, and needs the engine audit
named in the product map before those parts are planned.

## 10. Not in this document

- The visual language.
- The Instagram engine audit.
- The trial's billing internals.
- Which offers are on the list, who refreshes it, and the rails' permissions (vault note "Maven
  money read").
- The editor (Release 2) and posting (Release 3), beyond their reserved stage tabs.
- Several accounts per user and the agency tier.
- The production deploy.

## 11. Questions for the owner

All structure questions put to the owner on 2026-11-16 are answered and listed in section 1. Two
defaults were set without asking and can be overturned:

1. **"Your usual" needs account history.** The comparison is hidden until ten posts are read.
2. **Find at launch.** The existing library filtered by the account's niche and language, saying so
   on screen when the match is thin.

## 12. Risks

- **Size.** This replaces the shell, the home, the thread and the panel. The parts are ordered so
  each one ships something usable, but nothing ships before part 4.
- **The 4,119-line composer.** Parts 3 and 4 take it apart. Its behaviour has to be re-proved on the
  new screens; tests that only exercise the old layout do not carry over.
- **Results depend on data that does not exist yet.** Production held no predicted-vs-actual rows on
  2026-11-05. The Results screen needs a first-week state that is honest about that.
- **The ad label is a legal duty that falls on Maven too.** A script for a paid offer without the
  label for the creator's market must not be producible, by generation or by a later edit.
- **The auto-edit work planned its editor panel for the removed side panel.** It moves to the
  video's Edit stage; that plan needs the update before its part 4 starts.
