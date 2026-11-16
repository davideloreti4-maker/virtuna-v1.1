# UX / UI audit of the Maven app — 2026-11-16

Input for the platform overhaul. Tested live, not read from code.

## How it was tested

- `main` @ `0efcddd6`, local dev server, flags `NEXT_PUBLIC_CONCEPT_V8=true` and `NEXT_PUBLIC_AMBIENT_V2=true`.
- Signed in as the e2e test account. Phone size 390×844 first, desktop 1440×900 second.
- Runs fired on the test account: one simulation (1 credit), one hooks request, one remix from the home
  feed. Two new threads now exist in that account. Loading `/home` also generates the six home cards.
- Screenshots: `.scratch/audit-2026-11-16/` (90 files, gitignored). File names are given per finding.
- Structure facts (routes, redirects, dead code) come from a code map of the same commit.

**Not tested:** onboarding (`/welcome` redirects an onboarded account to `/home`), the video test
(10 credits + an upload), "Pull live" (Apify free plan), payment, a real iPhone, widths 768–1279,
and the arrival with the v8 flag off. Speeds are dev-server numbers, not production.

Severity: **S1** blocks a launch · **S2** hurts daily use · **S3** polish.

## Verdict

The engine produces useful output and some of it is fast. The product around it is a chat window with
a status column, and it shows its machinery to the user: pipeline steps, model names, internal labels,
five different score scales. On a phone, which is the launch device, the main input is off screen on
arrival and a single result card is taller than the visible thread. The look is a copy of Claude
Desktop's shell with no visual identity of its own, and video, the thing the product is about, appears
as 96-pixel thumbnails.

The largest problem is structural, not visual: nothing in the app represents a video. Find, Write,
Check and Learn are the ruled product loop; the app has surfaces for the first three as chat skills
and no surface for the fourth.

---

## A. Structure

| # | Sev | Finding | Evidence |
|---|---|---|---|
| A1 | S1 | **No object for a video.** Everything a creator makes is a message in a thread. The thread list shows the prompts typed ("give me 3 hooks…" eight times). Library is a flat list of saved cards with no link back to where they came from. A hook, its script, its test and its result are four unconnected things. | `desktop-arrival-01-top`, `mobile-pages-76-library` |
| A2 | S2 | **One address for everything.** `/home` is the arrival and every thread; which thread is open is a cookie. No link to a thread, no working back button, nothing to share or bookmark. | URL stayed `/home` in every thread run |
| A3 | S1 | **The simulation lives in three places and reports in a fourth.** Each card has "Simulate with your audience →". The panel lists the same cards again as a queue with "Simulate →". Clicking either opens a form (question, audience, platform, model) before the run. The result lands in the panel only; the card that was tested still says "Simulate with your audience →" afterwards. | `desktop-thread-b-31-s1`, `desktop-rail-arm-40-arm`, `mobile-detail-61-thread-s1` |
| A4 | S2 | **Dead doors on desktop.** "See the room →" on a card changes nothing in the panel. A result row marked "verdict only" is not clickable. | `desktop-rail-detail-41-see-room`, step failed on the row click |
| A5 | S2 | **The panel is a permanent 400 px column (28 % of 1440)** whose resting content is ten audience-group paragraphs. It has been removed and restored at least four times since July. It is also the planned home of the edit timeline. | `desktop-arrival-01-top`, handoffs 07-07 → 08-11 |
| A6 | S1 | **"Audience" means four things.** Your own followers, another creator's followers (@mrbeast, @zachking), presets ("Growth Audience"), and "General · baseline". It is chosen in the composer foot, shown in the panel header, managed on its own page and chosen again in the simulation form. With @mrbeast selected, a request about student meal prep returned hooks written for "Jimmy". | `mobile-m-lens-14-lens`, `mobile-thread-new-result-96-result-top` |
| A7 | S2 | **The same ten groups have three sets of names.** Panel: "Regulars, Quiet Watchers, Commenters". Audience page: "Skeptical Scrollers, Passive Viewers, Reaction Chasers" plus tags SKEPTIC / LURKER / CONNECTOR. Cards: "Made for Jimmy's Crew · 18 %". | `mobile-m-audience-12-audience-room`, audience detail text dump |
| A8 | S1 | **No Learn surface.** Predicted vs actual is the ruled moat and a launch stage. Nothing in the navigation shows a posted video, its prediction or its result. | navigation outline, product map |
| A9 | S1 | **Instagram is absent where it matters.** Audience page: "Simulation isn't available for Instagram yet." The ruling is both platforms on every stage before launch. | `mobile-pages-74-audience` |
| A10 | S1 | **Entry does not match the ruled trial.** Sign-up is email + password + confirm, subtitle "Start growing your TikTok presence". Billing sells "$1 — 50 credits over 3 days" and a $499 Studio plan, and shows "No plan" next to "Active". The ruled entry is connecting an account that starts a free 7-day trial. | `mobile-entry-90-signup`, billing text dump |
| A11 | S2 | **Two arrivals exist behind a flag**, and ten routes only redirect (`/calendar`, `/start`, `/grow`, `/analytics`, `/referrals`, `/saved`, `/discover`, `/analyze`, `/feed/hooks`, `/dashboard`). Eight component folders and six stores have no live importer. `composer.tsx` is 4,119 lines and holds the thread, the dock, the panel wiring and the arrival. | code map |
| A12 | S3 | **No place for Make and Post.** Releases 2 and 3 add an editor and publishing. The shell has three nav items and a chat list; neither stage has an obvious home. | product map |

## B. Phone (the launch device)

| # | Sev | Finding | Evidence |
|---|---|---|---|
| B1 | S1 | **The input is off screen on arrival.** The first viewport shows a greeting and the first two of six cards. The composer sits after all six, about 1,500 px down. | `mobile-arrival-loaded-10-top`, `-11-bottom` |
| B2 | S1 | **Six empty boxes for 7–10 seconds.** The home cards are generated on load: 10.5 s on the first visit, 6.8 s on the second. | server log, `mobile-arrival-01-top` |
| B3 | S2 | **The top 100 px of every page hold only a menu button.** No title bar, no tab bar. Page titles start at about 117 px. | `mobile-pages-70-feed`, `-74-audience`, `-76-library` |
| B4 | S2 | **Navigation is the desktop sidebar as a 220 px drawer.** Thread titles are cut to about ten characters ("give me hoo…") because hidden hover buttons reserve half the row. It shows ⌘N and ⌘K. | `mobile-m-drawer-17-drawer` |
| B5 | S1 | **"Test a draft" breaks the composer.** The foot row overflows: "TikTok" and "SIM-1 Max · 10 cr" collide and the send button is cut off. The chips cover the last home card. The copy says "Drop video or click to upload". | `mobile-flow-test-chip-87-test-chip` |
| B6 | S2 | **One hook card is about 850 px tall; about 600 px of thread are visible above the dock.** Three hooks are roughly four screens of scrolling, a three-version remix more. | `mobile-thread-new-result-96/97`, `mobile-remix-drop-103-remix-t8` |
| B7 | S2 | **The dock takes 200 of 844 px at rest** (chips, audience bar, field, five controls) and sits flush on the bottom edge. | `mobile-thread-a-21-top` |
| B8 | S2 | **Sheets are readouts, not tools.** The audience sheet is ten paragraphs with percentages and no action. The skills sheet lists slash commands on a device without a slash habit. | `mobile-m-audience-12-audience-room`, `mobile-m-skills-13-skills` |
| B9 | S2 | **Discover shows one tile per screen, and the first one was in Sinhala** for an English account. Tapping opens a sheet whose button reads "Remix → Read". | `mobile-pages-70-feed`, `mobile-feed-tile-101-tile-tap` |
| B10 | S3 | **Settings is eight tabs in a sideways scroller**, with Company and Role fields, a Team tab and a dead Creator Profile tab. | `mobile-pages-77-settings` |

## C. Waiting

| # | Sev | Finding | Evidence |
|---|---|---|---|
| C1 | S1 | **A three-hook request took 47 seconds.** At 12 s the screen read "Looks like a hooks run…". At 45 s the progress card showed 0:33 and was still on step 1 of 4 ("Finding proven outliers · Measuring each against its baseline"). | server log, `mobile-flow-type-83-t12`, `-85-t45` |
| C2 | S2 | **The agent refused a plain request.** "give me hooks for 5 video ideas" got: "'5 video ideas' isn't a topic… Which is it?" | `mobile-thread-a-21-top` |
| C3 | — | **What is fast:** a simulation returned in 6.4 s, a remix from a home card in 0.9 s (prepared ahead). | server log |

## D. Words and numbers

| # | Sev | Finding | Evidence |
|---|---|---|---|
| D1 | S1 | **The verdict contradicts its own number.** Headline "The idea holds." sits on "74.2 % scroll past", with six of eight signals marked WEAK. | `desktop-detail-61-detail-a` |
| D2 | S1 | **A heading says the opposite of its content.** "Why they scrolled": "Strong hook 62 %, On-topic interest 38 %, coded from 258". Those are the 258 who stopped. | same |
| D3 | S1 | **Five scales for one question.** "7/10 stopped" on a card, "70 %" and "25.8 %" in the panel, "74.2 % scroll past" in the detail, signals 0–100 with deltas, network values in σ, "confidence 0.72". No scale says what is good. | `desktop-thread-c-32-top`, detail text dump |
| D4 | S2 | **A 3D brain for one line of text.** The Brain tab is first. Its own footnote: "Visual, Audio, Face carry no signal — a text concept has no video substrate." | `mobile-detail-64-sheet-detail` |
| D5 | S2 | **Ranked or not?** The reply says "ranked by projected stop-power", the progress listed "Simulating your audience → Ranking", the dock says "3 ranked", and every card still offers "Simulate with your audience". | `mobile-thread-new-result-96-result-top` |
| D6 | S2 | **Internal vocabulary on screen:** room, sealed, queued, calibrated, baseline, verdict only, concept, draft, SIM-1 Flash / Max, Auto routing, lever, read, proven structure, seed line, match-cut, funnel-top. | throughout |
| D7 | S1 | **Leaks.** "niche_deep_buyer" printed inside a card. "@@themakeshiftproject". Asked which model it runs on, the agent answers "I'm built on Qwen." | `desktop-thread-b-31-s1`, `desktop-thread-d-33-top`, thread "what ai model…" |
| D8 | S2 | **Home cards do not explain themselves.** The text is a rewritten hook, the picture is someone else's video, the number is "19× their usual views". Two of six hooks were near-duplicates ("Your comedy isn't unfunny…", "Your comedy isn't bad…"). | `mobile-arrival-loaded-10-top` |

## E. Visual design

| # | Sev | Finding |
|---|---|---|
| E1 | S1 | **The shell is Claude Desktop's:** left sidebar with chat list, centred thread, floating composer, serif greeting. The 2026-08-21 ruling made the copy explicit. A product cannot look like its own company inside another company's layout. |
| E2 | S2 | **Four surfaces within a few percent of each other** (`#1a1a19`, `#1f1f1e`, `#252524`, `#2c2c2b`) and 6 % borders. Hierarchy rests on hairlines; cards, panels and page are one grey. |
| E3 | S2 | **Three type voices without a rule.** Inter for chrome, serif on card titles in the thread, spaced mono capitals on the Audience page. A hook card carries six uppercase micro-labels. |
| E4 | S1 | **Video is small and never plays.** 96×133 px on the arrival, 56 px in the remix card, a static tile in Discover. For a short-form video product the media is decoration. |
| E5 | S2 | **Colour only says "problem".** The accent rule leaves the UI monochrome, so the only colour a user meets is the red "74.2 %", the amber "Synced 102d ago" and the red running dot. |
| E6 | S3 | **The offer page speaks another language** (serif hero, coral italics, coral button, dotted ground) than the app it leads to. |
| E7 | S3 | **Controls are inconsistent.** Filled cream, outlined, and text-with-arrow buttons ("→", "↑", "▸") share one card. Three segmented-control styles, three chip styles. |

## F. Page by page (product map, open item 2)

| Page | Loop stage | State today | Call |
|---|---|---|---|
| `/home` arrival + thread | Write, Check | Works | Rebuild around a video object |
| Discover · Outliers | Find | Works for TikTok; not filtered to the user's niche by default | Keep, make it personal |
| Discover · Collections | Find | Renders ("Signature series", "11 proven"); not judged in depth | Decide after the concept |
| Discover · Watchlist + `/competitors` + compare | Find | Two pages for the same creators; newest data 4 months old; "Scrape failed" seen 2026-10-21 | Merge into one; needs a working refresh |
| "Pull live" | Find | Not tested | Fold into search |
| `/audience`, `/audience/[id]`, `/audience/new` | Check (setup), Learn (account numbers) | Works for TikTok; Instagram refuses | Becomes "your account"; other creators' audiences leave the main path |
| `/library`, projects | — | Flat list of saved cards | Becomes the list of videos |
| `/analyze/[id]` | Check | Not tested | Becomes the video's test view |
| `/settings` | — | Eight tabs | Cut Team, Creator Profile, Company, Role; rebuild Billing for the ruled trial |
| `/calendar`, `/start`, `/grow`, `/analytics`, `/referrals`, `/saved` | — | Redirects | Delete; calendar returns with Post in Release 3 |

## G. Worth keeping

- **Home cards as a mechanic:** a proven video turned into your version, ready before you ask. The remix opens in under a second.
- **The simulation's speed** and the "1,000 minds deciding" wait.
- **The remix card's shot plan** ("how to film your version", beat by beat). It is the most practical output in the product.
- **The outlier library** and the teardown sheet's "reusable template".
- **Restraint.** Few colours and no decoration is the right base; it needs hierarchy and media, not more ornament.

## What the overhaul has to do

1. **Make the video the object.** One thing that carries its source, script, test and result, with its own address.
2. **Navigate by the loop.** Find, Create (Write + Check), Learn at launch; Make and Post get reserved places.
3. **Put the result on the thing tested.** One score, one scale, a plain sentence, depth on request. No permanent panel.
4. **One audience by default: the connected account.** Other audiences are an advanced option, not a control in every bar.
5. **Build the phone shell first:** title bar, bottom tabs, the input always reachable, cards that fit a screen.
6. **Speak creator language** and never print pipeline terms, model names or internal labels.
7. **Give video the screen.** Large, playable, vertical.
8. **Never wait on an empty box.** Prepared content on arrival; long runs show output as it arrives.
