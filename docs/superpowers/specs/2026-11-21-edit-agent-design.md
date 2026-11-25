# Design: the edit agent (part 3) · 2026-11-21

Part 3 of the edit tool (`docs/superpowers/specs/2026-11-19-edit-design.md` §8 and §12): the agent that turns a plain request into a change, and the first cut. The design's "done when": **the owner's takes come back cut, captioned and reviewed, and a plain request changes the edit in seconds.**

Parts 1 and 2 are done. Part 1 built the document, the operations and the door, the kit and the Player. Part 2 built the worker: analysis, render, stills, jobs and storage; its handoff is `docs/HANDOFF-2026-11-20-edit-worker.md`. Part 4, the editor's screens, comes after this.

## 1. The owner's rulings for this part (2026-11-21, his words)

| # | Ruling |
|---|---|
| P1 | "lets use just qwen": the agent runs on the platform's model, Qwen, with no second model and no comparison arm. |
| P2 | "go with your rec": one model answer per round (approach A below). |
| P3 | "review and go": this design. |
| P4 | "ideally we want user to implement of a reference outlier video, so that the user either gets from our platform or provides himself. And in that exact style, his raw video will be edited." … "Other option would be through the chat or thread … they just say, okay, I want a video cut that and that way. Or they say, for example, Alex Hormozy style. Or they say, I want these and these animations" … "what we want essentially is qwen to have the tool belt with Remotion and other tools to edit and animate the videos, and provides a great and full experience to the user." |
| P5 | "review in detail and continue": styles (§12) are part of this part. |
| P6 | "idk if you can use mavens videos maybe find new ones were you can test": tests use openly licensed references or his own, not Maven's outliers, until he says. |
| P7 | Asked "looks if maven has a good video to test", then "sounds good" to five TikTok talking-to-camera outliers from Maven's library: those five are the tests' references, fetched through Remix's path, read and dropped. Maven has no posted videos of its own. |

The rulings of 2026-11-19 still stand (E1–E5 in the first design); E1 leads: *"i want the ai agent to be able to edit it to the requirements of the user for example with animations etc. this editor needs to be good, clean and smooth"*.

## 2. The approach

**A. One answer per round.** Qwen is given everything it needs in one call and answers once with `{say, ops}`. Code runs the door and `review`. Problems go back as a repair, and there are at most three rounds in all.

Two other approaches were weighed and not taken:
- **B, a tool-calling loop:** too many turns for a change in seconds, and the app's chat loop records Qwen naming the wrong tool in 3 of 8 recorded cases.
- **C, intent only, compiled by code:** robust, but it cannot do open requests ("animate a call-out when I say *free*") unless every request is coded ahead of time.

C's idea is kept for the first cut, where recipes do the craft and the model only chooses (§5).

## 3. The pieces

Each piece has one job, an interface, and its own tests.

| Piece | Where | Does | Depends on |
|---|---|---|---|
| `review` | `src/lib/edit/review.ts` | Reads an edit and its takes' analyses and returns findings (§4). Pure. | the edit library, the analysis rows (X62) |
| Recipes | `src/lib/edit/recipes/` | `tighten`, `placeCaptions` and `levelVoice`, each from an edit plus analysis to basic ops. Pure. | the edit library, the analysis |
| Catalogue | `src/lib/edit/catalogue.ts` | The kit's parts and the operations written out for the model, generated from their zod schemas and `PARTS`, so the model and the door cannot disagree. | `ops.ts`, `parts.ts`, `doc.ts` |
| Agent | `src/lib/edit/agent/` | Builds the prompt, calls Qwen, parses `{say, ops}` with zod, and runs the loop (§6). | the Qwen client (`src/lib/engine/qwen/client.ts`), the door, `review`, stills |
| Stills on the worker | `worker/` | A second route on the worker's web address, `POST /stills`. It draws given frames of an edit with the existing `stills` function and returns them. Its auth, signing and ownership rules are the same as `/start` (X41, X63, X81). | the deployed worker |
| Route | `src/app/api/edit/agent/route.ts` | `POST` with `{edit, takes, request}` or `{takes, firstCut: true}`. Returns `{say, ops, edit, findings, rounds, ms}`. | `creator()` (the `EDIT_CREATORS` gate), the take rows |
| Styles | `src/lib/edit/style/` | `StyleProfileSchema`; `styleOfReference` (measures and a sighted reading to a profile); `styleOfWords`; the presets; `profileOf(edit)` and the match check (§12). | the analysis, `/stills`, Qwen |
| Worker, `cuts` and `picture` | `worker/media/` | Two new analysis stages for every take, and reference mode (X97, X98). | ffmpeg |
| Dev page | `src/app/dev-edit/agent/` | Tries it all (§8). 404 in production. | the route, the Player, the render route |

**Stateless.** The page sends the current edit and gets the new one back. The route checks the take facts in the edit against the rows server-side, exactly as `POST /api/edit/renders` does (X78), so a client cannot hand the agent a forged length or forged word times. Storing edits, with undo across sessions, comes with part 4's screens; this part needs no migration.

## 4. `review`

`review(edit, analyses) → Finding[]`. A finding is `{ code, severity: "error" | "warn", where: { frame, shot?, mark?, item? }, says }`, where `says` is one plain sentence the model and a person can both read. The agent must clear every error and tries to clear the warnings. Part 4 shows findings as marks on the strip.

| Code | Severity | Finding |
|---|---|---|
| `on-face` | error | A caption or a part over the face or the mouth, against the face boxes at their time (X48), on any frame. |
| `under-buttons` | error | Text or a part inside TikTok's or Instagram's overlay zones. The zones are one constant set, measured from both apps' current screens, with the source and date written beside them. |
| `text-fits` | error | Text that does not fit its box at its size, measured with the kit's own line breaker (`src/edit/film/lines.ts`). |
| `two-titles` | error | Two titles on screen at once. |
| `cut-outside-pause` | error | A cut between shots of one take that does not land in a measured pause (X54). |
| `empty-start` | error | Frame 0 shows no footage. |
| `mark-hidden` | warn | A mark whose moment its shot no longer shows. |
| `fade-both` | warn | A shot fading in and out at once. |
| `soft-zoom` | warn | A punch-in past twice the take's own pixels (part 1's measure: 1.33 on 720p). |

## 5. Recipes and the first cut

- **`tighten(edit, analysis, { pauseMs })`** shortens every pause longer than `pauseMs` to `pauseMs`, cutting at the pause's quietest point (X47) and never outside the measured silence. The head and the tail are trimmed to `pauseMs` as well.
- **`placeCaptions(edit, analysis)`** sets the caption line's `y` and width so the line keeps clear of the face boxes and the overlay zones for the whole film. One position per film; if no single position works, the best one, which then leaves a `review` finding.
- **`levelVoice(edit, analysis)`** sets each shot's volume from the measured loudness, so shots of one film sit within 1 LU of each other before the posted file is levelled (X49).

**The first cut** is the agent with one request of its own, run on a fresh edit of the take (the whole take, its captions, the `natural` look), **in a style** (§12). With a style, the style sets the pace, the captions, the title's place and length, the punch-ins and the look, and Qwen chooses only the hook title's words and the words to stress. With no style (the default), Qwen chooses only these:
- the hook title's words, or no title;
- up to five words to stress, as call-outs or highlights;
- the look;
- the pause length for `tighten`, from 120 to 400 ms.

Code then runs `tighten`, `placeCaptions` and `levelVoice`, applies Qwen's choices as ops through the door, and reviews. Qwen gets the same repair rounds as any change.

## 6. One change, step by step

1. **The prompt:**
   - a fixed system part: the role, the catalogue and the rules (N2, N3, N8 in short);
   - per request:
     - the edit, compact;
     - each take's words as `index:text@startMs`;
     - the pauses;
     - the face boxes, summarized to a few per second;
     - the current findings;
     - the request.
2. **Qwen:**
   - the reasoning model (`QWEN_REASONING_MODEL`, today `qwen3.7-flash`), with `response_format: json_object`, `temperature: 0` and `QWEN_SEED`;
   - whether thinking is on, and the token budget, are set from the proof's measures (§7), as `docs/MODEL-POLICY.md` asks.
3. **Parse** `{say, ops}` with zod. A reply that does not parse is a failed round, and the parse error goes back as the repair.
4. **The door:** `applyOps`, all or none, then `checkEdit`, then `review`.
5. **Repair:** if the door refused, or `review` found an error, the problems go back word for word, with the edit as it stood. There are at most three rounds in all.
6. **Stills:** only when the round added or moved something seen (a part, a mark, the captions' place or look, a framing).
   - One sheet of frames, chosen at the changed things' moments, is drawn by the worker's `/stills` and shown to Qwen.
   - Qwen may answer with one repair. That repair goes through the door and `review` again, but not through more stills.
7. **The answer:** `say`, the ops applied, the new edit, the findings left, the rounds and the time.
   - If every round failed, the answer is the edit as it was, with `say` explaining what could not be done, and the findings.
   - A change is never half applied.

**Limits:**
- **A change:** the route has `maxDuration` 60, and the loop stops at 50 s with the best valid edit.
- **A first cut:** `maxDuration` 180, and the loop stops at 170 s. The aim is under two minutes for a 90 s take.
- One live agent call per creator: a second is refused with 409.
- Every call is logged with its rounds, tokens, cost (`src/lib/engine/qwen/cost.ts`) and time.

## 7. The proof (part 3's gate)

- **The request set:** about 20 plain requests on the owner's take, written down in the repo. They cover:
  - captions: look, size and place;
  - a title, a call-out on a word and an end line;
  - a cut, a trim and the pace;
  - a look and a zoom;
  - a sound on a word;
  - removing something;
  - two requests that cannot be done ("make me taller"), which must be refused in `say` with the edit unchanged.
  
  It includes the five requests of the 2026-11-19 agent proof.
- **First cuts:** the owner's takes: today the 12.7 s take, and his further takes as he gives them (test 6's iPhone take among them).
- **Each request and each first cut runs 3 times.** Qwen does not give the same answer twice (`MODEL-POLICY.md`), so results are rates.
- **Gates:**
  - at least 90 % of runs end with an edit that passes `checkEdit` with no `review` errors, and does what was asked, judged by reading the ops and looking at the stills;
  - the median change takes under 10 s without stills and under 20 s with them;
  - a first cut of a 90 s take takes under two minutes;
  - cost per change and per first cut are recorded (no gate; the owner sees the numbers).
- **Looked at:** the stills of every run and the rendered film of each first cut, by the controller; a sheet and two films go to the owner.
- **The refusals' gate:** both impossible requests are refused, in all runs.
- **Styles (§12):**
  - **Ground truth.** Six films are rendered with the kit from six known style profiles. The style read must recover each one:
    - pace within 15 %;
    - caption `y` within 0.05;
    - the caption look right;
    - the title, its presence and its timing within 0.5 s;
    - the look preset right in at least 5 of 6.
  - **Real references.** Three to five real references are read, and the owner's take is cut in each style. The match check is reported, and the controller looks at each cut. One goes to the owner, beside its reference.
    - The references are the five Maven outliers the owner approved (P7), named in git only as "reference 1" to "reference 5".
    - Three free talking-to-camera clips, under a licence that allows editing them, are added as test takes.
  - **From words.** Ten phrases, among them a named creator's style, "calm and clean" and "fast with zooms", each give a valid profile. The controller judges whether each is sensible; the person's name is answered with the nearest preset, said in `say`.

If a gate fails, the prompt, the catalogue's wording and the repair messages are fixed first, as the model policy says ("fix our layer, not a bigger model"). A failing gate is reported with its numbers; there is no second model (P1).

## 8. The page to try it: `/dev-edit/agent`

- 404 in production, behind `EDIT_CREATORS`.
- Plain, in the app's charcoal look; no new design work.
- A list of the creator's ready takes. **First cut** on one.
- The Player with the edit.
- A request box, the answer (`say`), the findings, and the rounds and time.
- **A style for the first cut:** none; a preset; a few words; a reference, uploaded or linked. The profile and its match check are shown.
- **Undo:** the page keeps the edits it was given, back to the first cut.
- **Render:** through the existing render route, with its progress and download.

Part 4 replaces this page with the real screens.

## 9. What it does not do

- No edits table, and no undo across sessions (part 4).
- No chat thread integration ("Edit this moment" is part 4, on the new look's pages).
- No new kit parts. The end card, the arrow, the sticker and the kit's own CC0 sounds are a kit plan of their own. A request that needs one is answered in `say` as not possible yet.
- No music (product ruling: no platform music in the file).
- No second model (P1).
- **Not the tool belt's growth.** The kit's new parts (animated caption styles, emoji and stickers, arrows, highlight boxes, moving text, licensed sound effects, B-roll) and a recipe that removes "um" and "uh" are the next plan. They are ordered by how often the style reads of real outliers find each one. Until then, a reference's feature the kit cannot draw is listed in the match check as not matched.
- **Not reordering what is said** (a cold open). The reference's structure (its beats and its hook) is what Remix gives at the script stage, and the creator's take already follows it. The edit copies the style.
- **Not the thread's entry points** ("Edit like this" on an outlier card, a take sent in a thread): part 4.

## 10. Decisions taken here (the owner's to overturn; numbered on from part 2's X82)

| # | Decision | Why |
|---|---|---|
| X83 | The agent route is stateless; take facts are checked against the rows server-side. | No migration now; a forged edit cannot reach the agent (X78's rule). |
| X84 | Stills for the agent come from the worker's new `/stills` route, same auth as `/start`. | The design (§8 of the first design): each look also proves that preview and render agree. |
| X85 | A round's stills only when something seen was added or moved; one repair after them. | Stills cost seconds; text-only changes need none. |
| X86 | `review`'s overlay zones are one measured constant set for TikTok and Instagram, with source and date. | The apps change their screens; one place to update. |
| X87 | The first cut is the agent with recipes; Qwen chooses title, stressed words, look and pause length only. | N8: the craft is in code. |
| X88 | Thinking mode and token budget are set from the proof's measures. **Measured 2026-11-23 (Task 14): thinking stays off, the budget stays 4,000 tokens.** | The model policy: measured, not guessed. On the same eight requests, three runs each, thinking took a change from a median of 8.8 s to 25.9 s (with stills 9.3 s to 32.8 s; without 1.2 s to 8.1 s) and from 0.060 to 0.079 cents; six runs of twenty-four ran into the 50 s and ended with no answer; the rest answered as with it off, but for two runs. The longest answer was 181 tokens for a change and 91 for a first cut, and no call was cut short: the budget is a rail. With thinking on a call wrote up to 2,667 tokens. |
| X89 | At most three rounds; a change stops at 50 s and a first cut at 170 s; one live agent call per creator. | A change in seconds; the spending gate of X81 carried on. |
| X94 | The kit sets text with ligatures and contextual alternates off (and, if Task 1's check finds it the cause, optical sizing off), in what it measures and in what it draws. | The server's table, Chromium and WebKit then agree; the kit's own two browsers already disagreed by 18 px on Inter's "->" (Task 1). |
| X95 | A style is one `StyleProfile` in the kit's own terms, whatever its source: a reference, a preset, the creator's words, or the default. | One shape for the agent and the first cut; every way a creator asks ends in it. |
| X96 | A reference is read as a temporary take and dropped: its files in R2 and its rows are deleted once its profile is made; only the profile is kept. | The platform's derive-and-drop rule for other people's videos (T-03-02 in `resolve-and-rehost.ts`). |
| X97 | Every take's analysis gains two stages: `cuts` (scene changes) and `picture` (brightness, saturation and warmth every 500 ms). | A reference's pace and look are measured, not guessed; a creator's own take with cuts in it needs them too. |
| X98 | A reference is at most three minutes. Its analysis runs in reference mode: a language outside en, de and it is not a failure; its words are skipped, and its pace comes from cuts and pauses. | Outliers are short and in any language; X55's refusal is about captions the creator posts, not a reference's pace. |
| X99 | The presets are named by what they look like ("bold word-pop, fast cuts"), never after a person, and are measured from real outliers. A creator may type a name; Qwen answers with the nearest preset and says so. | A preset sold under a real creator's name invites trouble. |
| X100 | Punch-ins are made at cuts that land in pauses: the shot after the cut is framed tighter (zoom 1.1 to 1.3, the face kept in frame), at the profile's rate. A slow zoom is a framing move within a shot. | Cuts only in pauses (X54); this is how talking-head creators punch in. |
| X101 | A reference's text is measured, not guessed (2026-11-23). The worker gains a `text` stage for references: a text reader (RapidOCR) on up to 40 of its frames gives each line's box, words and colours. Code reads the captions (place, size, font, words a page, colours, look) and the title from those measures. Qwen's sighted call only judges what cannot be measured (the grade, and what else is drawn), and a failed judgement no longer fails the read. This replaces §12.2's steps 4 and 5 as first written. | Read by Qwen from one sheet of twelve small frames, the first ground-truth film's captions came back at size 200 for 72, with the highlight missed and the wrong font, while the gates of the time passed. The reader got every caption's words and its place to 0.004. The plan's own rule N8: the craft is measured in code, the model chooses. |
| X102 | A reference's look is `mono` when measured grey; otherwise the grade Qwen judges from its frames, `natural` unless plainly graded. The thresholds measured on one take are gone. | On one take the kit's natural, warm and cool lie 0.008 to 0.015 apart in mean warmth: less than two rooms differ. One take's absolute values cannot tell a grade on another video, and a wrong grade on a face is worse than none. |
| X103 | A reference's words are never heard: in reference mode the worker runs no listening model and no aligner, and keeps only the pauses (2026-11-23). This narrows X98. | With X101 a reference's captions come from its picture, so nothing uses its transcript. Hearing it was over half the analysis time and a paid call on someone else's video, and it stored their words. |
| X104 | A reference's pace is read as its quiet share: the share of its spoken span that is pause (2026-11-23). The first cut tightens the creator's take to the pause length, 120 to 400 ms, that brings his own quiet share nearest the reference's. `pauseMs` stays for presets and words, and as the fallback. | One pause's length cannot be read from an edited sound: the six ground-truth films show 136 ms pauses repeating where the edit kept 300, because the measure splits a kept pause at the cut. A sum over all pauses is steadier than a median of nine, and it adapts to how the creator himself speaks. |
| X105 | The presets are designed by hand and judged by eye on a real take, not measured as medoids of about twenty outliers; the hunt for openly licensed videos is dropped (2026-11-23). A style from words is Qwen choosing the nearest preset and what to change, with code building the profile. This replaces §12.3's "measured from three real outliers" and narrows X99 to its naming rule. | A preset is good when it looks good on a creator's take. The five approved references check that the set covers what real videos do. Asked for a whole profile, a model invents numbers; asked to choose and adjust, it cannot. |
| X106 | After five real references were read (2026-11-23): a reference's grade is no longer judged (its look is `mono` by measure, at a tighter cut-off, else `natural`; this amends X102); a box behind text is told from a flat scene by a second ring further out; a hook that stays for the whole video is a title that stays; size falls back to the rows' height for a typeface unlike the kit's; punch-ins need the same scene on both sides of the cut; a profile never quotes a reference's words. | Qwen called a blue screen cool and bright B-roll vivid. Plain text over a curtain, skin and a desk read as a pill on 3 of 5. A whole-video hook label read as "other text". A condensed serif read as 32 px for about 110. Every cut to B-roll counted as a punch-in. The lines of what the kit cannot draw carried up to 40 characters of the reference's own text. |
| X107 | A reference's analysis is made light: only the preview copy and the sound, its text read from the source file, nothing stored but the analysis and one sheet of twelve frames the worker makes for the judgement. | A creator waited 127 to 197 s for a reference of 60 to 137 s: the fetch 33 to 93 s, the copies 23 s, storing them 9 s, and the app's sheet through the film renderer 17 to 20 s. None of the copies is used once the profile is made, and the reference is dropped anyway (X96). |
| X108 | The kit's first growth is pulled into this part: caption pages of up to 16 words in up to three rows, titles from 48 px, and a label that is light when its letters are dark. | Counted over the five references: captions of 8 to 15 words a page on 4, a hook label under 84 px on 2, dark letters on a light label on 2. Without them a cut in the style of four of the five would not look like its reference. |
| X109 | The agent is told how a change should look (2026-11-23, Task 14): a section "How it should look" between its role and the catalogue, with the craft's numbers in code (`CRAFT`: nothing under 44 px, a call-out 110 to 160 px for 0.9 to 1.5 s, a title of at most five words on two lines for 2 to 3 s, call-outs three seconds apart, "bigger" is a third). It also says how a say reads: one short sentence in the creator's own kind of words about what they will see ("It's black and white now."), with no preset, operation, setting or number the creator did not use; a refusal is one sentence that says what would work instead. | The catalogue explained every operation and said nothing of taste. On five requests, three runs each, 5 of 15 runs changed the edit before it, 8 with it, 15 with it and X110. A say read like a changelog ("I applied a mono look preset to the entire film…"); over 24 requests, three runs each, says naming a kit term went from 3 of 72 to 0, says of more than one sentence from 21 to 0. |
| X110 | The context carries `room`: where the captions and a new text have room, the larger caption settings that fit (ready to send), how tight each shot may zoom, and how much pause the cuts keep. Every line is `review`'s own verdict on candidate places, asked in code; nothing is estimated. A refusal is answered with the room for what was refused. | The model does not find a place from a face's box: asked for bigger captions it tried three sizes the review refused (0 of 3); asked for a call-out it set a small white word on the face (0 of 3). Given the places, 3 of 3 each. N8: the craft is measured in code, the model chooses. |
| X111 | Three things the model asks for and the code makes: `pauses.tighten` (the tighten recipe at a pause length), `shot.zoom` (a punch-in or slow zoom up to what the shot's face allows, from a word if asked: the shot is split at the pause before it), and the captions' fit (when the size or place it sent is refused and a fit in the asked direction exists, the code sets it and the say tells it). They are written out as ordinary ops before the door. | By hand the model trimmed one pause shorter and another longer (0 of 3), wrote framings that put the title on the eyes (0 of 6), and tried pill captions three times at a size only bare words fit (0 of 6). With the moves: 3 of 3, 5 of 6 and 6 of 6 in the last run. |
| X112 | After a change that is seen (stills) or that risks the words (a word cut or brought back, a part taken out), the model is shown what its ops did as measured (the film's length, the words gone, each text's size and place) and may send `{"op":"undo"}`. When no answer was taken and at least one was judged, one more call asks for the say alone: what could not be done and what would work. This amends X85 (the look also runs without stills) and adds one say-only call to X89's three rounds, inside the same 50 s. | The say and the ops did not always agree: "cut the first second" took 3.2 s and said one; a refused change ended in the loop's own line, which named nothing that would work. |
| X113 | What the model is not shown, and what a say may not hold: the warnings an edit came with are kept from it (it is shown every error, and only the warnings its own change brings); a say with a size in pixels or a height as a number is unreadable; a say that tells the opposite of its captions op is refused. | Shown the first cut's standing warnings, it moved the title and the captions in answers that asked for neither. Its says read "size 90px", "y=0.25"; one said "moved up" over an op that moved down. |
| X114 | `review` warns of a title or a call-out on screen for less than 0.8 s (`short-text`). | A part takes 0.4 s to come in; the morning's call-out was up for 0.3 s and passed every gate. |
| X115 | The model's look at a change that is seen is off (2026-11-23, Task 14b; the controller's ruling; amends X85 and X112): no stills are drawn for the model and it is not asked again (`AGENT_LIMITS.look`, off; its code path and tests stay, run with it on). A change that is seen is judged as an unseen one: by the door, the review and the measures of what it did, which the model is still told of, with `undo`, when it cut or brought back words or took a part out. The stills route stays, for the creator's eyes. | Of 86 looks over two full runs, 75 answered "no change", 3 sent again what was set, 7 could not be used and 1 took back a zoom nobody had asked for; none made an edit better, and a look cost about 7 of a seen change's 10 s. Measured after: a seen change takes 1.4 s at the middle (it was 10.1 s), 44 changes each; the task's last run, 1.3 s over 81 changes. |
| X116 | A say is held to what happened and to the creator's own words (Task 14b). When nothing was changed, a say that tells of a change is sent back once with that reason, and if the next does so too the loop writes its own plain line: for an answer with no ops, for the say after an `undo`, and for the closing call. A say that names the kit's words (a preset, a look by its name, an op, a mark, an item, a shot's id, px, ms) is sent back once while an answer is left. What the code did itself joins the say's one sentence. Every example in the prompt is made up, of no take and unlike the proof's requests, and a test holds it so. Amended in the final fix wave (2026-11-23, the controller's ruling after its rerun): where an answer changes only the captions, the say is also held to this: a word of where something is ("above", "below", "bottom") is no move, so it neither makes a true say untrue nor switches the check off for a move named beside it; "lowest", "highest" or "moved" with the height as the ops left it is told, as "higher" and "lower" are, unless the say tells that the captions stayed or could not go; a count of words a page the ops do not set is told, unless the say names the count they have as well. Not read by any check: the moment a say gives a punch-in, and a say of a sound that was not added. | On the second take the closing say claimed a change that was not made, 4 of 4; says read like a changelog; the prompt's examples were the owner's words and the proof's own cases, and the says copied them. Measured: says naming a kit term 0 of 78, in one sentence 78 of 78; the claim is told in English only. |
| X117 | A cut asked by time is a move the code makes (`time.cut`): each end lands on the nearest clean cut within one second (`CUT_NEAR_MS`, kept in one place and quoted by the prompt), and the say is given how much went; with none in reach it is refused with the nearest clean cuts and the words they follow, and the say tells where in the creator's words, not in seconds. A `word.set` that gives a word a new text keeps the punctuation the old one closed with. The film's ends are a move too (`ends.trim`): what comes before the first word or after the last is cut by the tighten recipe's rule for the head and the tail, and the model says only which end. | "Cut out the first second" was cut into a word, or three seconds on, or by a tenth of a second, and then refused by rule, over five versions; the controller ruled that a creator who asks for a second wants the opening shorter, not a clipped word. A word written for another that closed a sentence lost its full stop, 3 of 3, and the captions ran two sentences together; with the carry, 3 of 3 right. "Remove everything after the last word" was right in 1, 2, 2, 1, 3 and 0 of 3 runs over six wordings of the prompt, and took the whole last shot out on a second take; as a move, 3 of 3 on both takes, and its mirror too. |
| X118 | One rule for the captions' own errors, used by the room and by the loop (`captionsRule`): on an edit whose captions carry none they may get none; on one whose captions already carry one (a first cut that found no place clear of every shot) it may not get worse, no new code and no more frames covered, and the room names where it is least. A zoom is held to it too. The zoom's least is 1.08 in the schema, the catalogue and the search. Amended in the final fix wave (2026-11-23): "no worse" is no error that reads otherwise than one the captions had (the loop's own test of an error an edit came with, its sentence with the numbers blanked: the eyes for the mouth is another error) and no more frames covered; the room keeps no band of its own for the nose, since the review now finds an error from the brow to the lower lip, so the room is the review's verdict at every height tried and names exactly what the loop takes (tested on a clean edit and on one that starts with a captions error, forty heights each through the real loop). A captions' fit (X111's placing by code) never goes above the size the answer asked nor above what the room looks up to for the edit as it stood (1.6 times its size), keeps the answer's count of words, and goes to fewer only when the answer set them larger and that count cannot be. Known limit, not in this wave: where an error of theirs stands on every frame, the rule counts frames and not how much of the face is covered, so larger captions on the same part of the face are "no worse". | The code review of Task 14: with a captions error standing, the room said "no size has a place" while the loop took any setting; `shot.zoom` took 1.05 to 1.07 and refused them with a false reason. |
| X119 | The first cut's hook is what the video is about or promises, in words its first sentence does not use: when more than half of a hook's words are among the take's first six it is asked for once more, and what comes then is kept. The match no longer counts the cuts a minute; the profile keeps the number. Requests about the person or the place they are in are named in the craft section as no change to the edit. The first cut's own say is at most two short sentences: its length and what it carries, then only what the creator has to know. | The owner's first cut carried his own opening words as its title, on screen twice for two seconds. A single take cannot meet a reference's cuts between scenes: "not" on 5 of 5; without the field the five read 100, 87, 80, 100 and 64 %. "Make me taller" got a zoom, 3 of 3; after the line it is not steady (refused 3 of 3 on the owner's take in the last run, 2 of 3 a zoom in the one before; on a second take a zoom 3 of 3, then refused 3 of 3), and two fresh requests of the kind are refused 12 of 12 over both takes. The first cut's say was up to five sentences, with the title's words and each step. |
| X120 | `say` is English in this part, whatever language the request is in (2026-11-23, the final fix wave; the controller's ruling). A request in German or Italian is understood and done as any other; the prompt and the catalogue ask for the say in English, and a say that is not (told, outside what it quotes, by the words German and Italian sentences are made with and by letters English does not write, against English's own small words) is sent back once a change with that reason, never on the last round, and the closing say is held to it too. So the checks on a say (`claimsChange`, `contradicts`, the kit's words) read what they are given and the code's own parts of a say join a sentence of their language. A length in milliseconds or a size as "90 Pixel" is refused every time, as pixels are (`MEASURES`), outside what the say quotes. Until the product is localised. | The final review (C-I1, C-I2): the claim check and the contradiction check know English alone, so "Ich habe die Untertitel vergrößert." passed over an unchanged edit, and the code's part of a say was joined in English onto a German or Italian sentence. Not held: a say sent in another language a second time is taken as it is. |
| X121 | The edit and the sentence are judged apart (2026-11-24, the last correction; the controller's ruling). The door and the review judge the edit, and nothing about `say` undoes an edit they took or spends a round. When the rounds are over the say is checked once (`sayFault`: blank or over 600 characters; not English; more than one sentence; a size, a length or a height as the kit counts them; the kit's words the request did not use; with nothing changed, a claim of a change; with the captions alone changed, what `contradicts` tells, which is strict and excuses no word by another). A say that cannot be shown is asked for once, alone, with why and with what the ops did as measured; if that fails too, or under two seconds are left, the code writes the sentence from the two edits (`saidOf`: what differs, in a creator's words, with no number but a count of words a page), or, with nothing changed, its own line of why. A change is at most three rounds and that one call, and the result tells whose sentence the creator reads (`sayBy`). **The one exception and its bound:** an answer whose own say contradicts its ops is sent back once in a change, never on the last round, never twice, and not for captions the code placed; after that the edit stands whatever the sentence says. This replaces how X113, X116 and X120 were enforced (a say in the kit's numbers made an answer unreadable; a say in the kit's words, not in English, or claiming a change was returned to the model during the rounds); what a say may hold is as they say. | The re-review of the fix wave: a true say ("sit at the lowest clear height") was sent back on every round until the change was lost; a word such as "can't" or "already" anywhere in a say switched the no-move check off; a German say passed unread the second time and on the last round. And, with the sentence judged apart and no exception: asked for captions higher with no room higher, the model sent larger captions and said "higher", and the swap was taken, 3 runs of 3; a say its own ops contradict is the one say fault that is evidence about the edit. The send-back's words are the measured ones (18 runs of 18 end with no ops and the true reason; told to send ops that do what its say tells, or none, 0 of 3; told to do only the part that can be done, 4 of 6). Known and not held: a sentence that is inexact in a way no check reads (the moment of a punch-in, "slowly" over a zoom that does not move), 4 of 81; a request in two parts whose impossible part is sent back can lose its possible part when the next answer fails the review, 2 of 9. |

## 11. What the owner owes for this part

- His further takes, for first cuts (the iPhone take of test 6 among them).
- A look at the proof's sheet and two first-cut films.
- Reading X83 to X89 and X94 to X119.
- **X94's one visible change:** with contextual alternates off, Inter no longer raises its punctuation (hyphens, colons, brackets) between capitals in all-caps text, and its digit colon sits as in lower case. Nothing else drawn changes; no demo text moved.
- **His own or his fleet's posted, edited videos**, if he has any: they are the cleanest references. Otherwise openly licensed ones are found (P6). **His word on Maven's outliers:** the product flow reads them as Remix already does (fetched, read, dropped), but tests leave them out until he says.

## 12. Styles (added 2026-11-21, P4 and P5)

A creator can have his take edited **in a style**:
- the style of a reference video, an outlier from Maven or one he brings himself, uploaded or linked;
- a named or described style ("Hormozi style", "fast cuts, big yellow captions, zoom when I make a point").

Every source ends in one shape (X95).

### 12.1 The profile

`StyleProfile`, in the kit's own terms:

| Field | What | From a reference |
|---|---|---|
| `pace.pauseMs` | the pause length between phrases, 120–400 | the median pause between the reference's own phrases (its pauses) |
| `pace.cutsPerMin` | cuts a minute | the scene changes (`cuts`) |
| `captions` | `on`, `look`, `font`, `size`, `y`, `maxWords`, `highlight`, as the kit's `Captions` | read from frames by Qwen, mapped to the nearest the kit can draw |
| `title` | `on`, `y`, `frames`, `look`, `size`; or null | read from frames: when, where and how long text sits over the opening |
| `punchIns` | `perMin`, `zoom`; or null | the face's size jumping at the reference's cuts (`faces`) |
| `look` | `preset` and `adjust` | the nearest preset to the picture's brightness, saturation and warmth (`picture`) |
| `notMatched` | what the reference does that the kit cannot draw: emoji, stickers, arrows, sound effects, music, B-roll, other cuts | read from frames by Qwen |
| `source` | `reference`, `preset`, `words` or `default`, with the reference's or preset's name | |

### 12.2 Reading a reference

1. **The file:**
   - an outlier from Maven, or a link the creator pastes, is fetched as Remix fetches one (`resolveAndRehost`);
   - a file he uploads comes in through the takes' signed upload.

   Either way it goes into R2 as a temporary take of his.
2. **The worker analyses it in reference mode (X98):**
   - its copies;
   - words where its language is supported;
   - pauses, faces and loudness;
   - and, for every take (X97), `cuts` and `picture`.
3. **Twelve frames** are drawn from it by the worker's `/stills`: its whole length as one shot, captions off, the natural look. They are taken at its cuts and spread through its first five seconds and the rest.
4. **Qwen looks at the frames** (one sighted call) and reports what text sits on them:
   - caption-like text: where it is, how big, its colours, its words per line, its box style and whether it is in capitals;
   - title-like text over the opening;
   - anything the kit cannot draw.
5. **Code makes the profile** from the measures and that reading. It maps each reading to the nearest value the kit can draw (pill, pop, highlight or plain; one of the three fonts), and lists what it cannot.
6. **Dropped (X96):** the reference's R2 files and rows are deleted, and only the profile is kept.

### 12.3 From words, and the presets

- **The presets:** about six, each measured from three real outliers with 12.2 and stored in the repo as numbers only, named by look (X99).
- **From words:** given the creator's words and the presets as examples, Qwen writes a `StyleProfile`, which zod checks. A person's name is answered with the nearest preset, said in `say`.

### 12.4 Applying a style

The first cut (§5) in a style:
- `tighten` at `pace.pauseMs`;
- the captions set to the profile's, then `placeCaptions` moves them only if they would cover the face or the apps' buttons;
- the title placed and timed as the profile says, its words chosen by Qwen from the take;
- `punchIns` at the profile's rate (X100);
- the look set;
- Qwen chooses the words to stress.

`review` still judges it all: the creator's face is not the reference's.

### 12.5 The match check

`profileOf(edit)` reads the same fields back from the finished edit. It is compared field by field with the target, as matched, near (within the tolerances of §7) or not. The `notMatched` features are listed. The answer says it plainly: "the pace, the captions and the title match; the emoji and the whoosh are not in the kit yet".
