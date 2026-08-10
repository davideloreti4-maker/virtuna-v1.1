# Handoff — in-thread chat LIVE-RUN verification (2026-08-09, session 2)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat` · base `7088d72a` (== origin/main at session start)
**Predecessor:** `docs/HANDOFF-2026-08-09-in-thread-chat-audit.md` (22 findings, F-1…F-22). This session
verified those findings in a live browser AND ran the two skills the audit never exercised.
**Status:** AUDIT/VERIFY ONLY — no product code changed. **Two paid runs were spent** (ideas, script)
on the real prod e2e account, on top of the audit's one.

Every claim below is a browser measurement, a server-log line, or a file:line.

---

## 0. New P0s found this session (worse than anything in the audit)

### N-7 · "Write a script from #1" wrote a script about a DIFFERENT TOPIC 🔴🔴

Clicked the forward chip on the morning-routines hooks thread. Chip label: `Write a script from #1 →`
(#1 = *"Stop trying to wake up at 5 AM. It is literally destroying your dopamine receptors."*).
Live intro even said: *'Writing a script from "Stop trying to wake up at 5 AM…"'*.

**The delivered script is about a dance challenge.** Hook beat: *"You think this dance took me hours?
Wrong. It took me three seconds to realize I was doing it completely wrong."* Summary chip: *"Dance
challenge failure turned viral strategy."* Zero mention of mornings, alarms, routines.

**Mechanism (all verified in code):**
- `composer.tsx:1235 handleWriteScript` → `script.start("", platform, hookLine, intent)` — **ask is
  empty**, hook rides in `anchor`. Client side is correct.
- `assembler.ts:274–276` — the bundle emits `fenceUserContent("Creator ask", "")` (an **empty** primary
  fence) plus a fenced section labeled **"Chain anchor"** containing the hook.
- **No instruction anywhere** (grep of `compiled.ts` / KC_SCRIPT_SYSTEM_PROMPT: zero mentions) tells
  the model what a "Chain anchor" is or that the script must open from it. The model got an empty ask,
  an unexplained quoted hook, the calibrated @mrbeast/TikTok audience profile → freestyled an
  audience-flavored topic.
- Retrieval DID key off the anchor (server log: `[grounding] cache HIT for "Stop trying to wake up at
  5 AM…" (script/topical) — 6 teardowns`) — so sources were about the right topic while generation
  ignored it. The UI intro line is client-side copy (`scriptAnchorHook`) claiming an anchoring the
  backend never enforces.

**Fix shape:** state the anchor's contract in the prompt (script MUST adapt/open from it), and/or
validate the output (opening beat must reference the anchor; retry once, else surface a warning).

### N-8 · Chip-launched runs merge into the previous turn on reload 🔴🔴

After the script run, **reload** (desktop AND native-mobile context, identical):

- The thread renders as **ONE turn**: one user bubble ("give me hooks…"), one intro, one receipt.
- The intro is the **script's** — *"Wrote a script from …"* — replacing "Pulled hooks for…" above the
  five hook cards. The receipt shows the script's "2 steps".
- The script turn has **no user message** (the chip click leaves no trace), and the consumed chip row
  is gone — the causal step vanished from history.
- During the live run it was wrong differently: the new turn showed a user bubble echoing the
  **original hooks prompt**.

Mechanism: the direct one-shot routes (`/api/tools/script` via chip) append an assistant message with
no user-turn row; the reload grouping in the thread renderer folds consecutive assistant output into
the prior turn, and the later `run-header` wins the intro. (`thread-turn.tsx:124 readRunHeader`,
`run-header.ts` docblock describes one stamp per run — the grouping upstream is where it merges.)

### N-2 · SEED LINE renders the literal digits "0" / "1" / "3" 🔴

Expanding "Seed line & delivery" on the restored hooks thread shows `SEED LINE: 0` (card 1), `1`,
`3`. The model emitted the **sourceIndex into seedHook** (adjacent fields in the output schema —
`hooks-runner.ts:157–174`), and `hooks-runner.ts:454` validates only `typeof r.seedHook === "string"
&& r.seedHook` — `"0"` passes. Fix: reject digit-only/implausibly-short seedHook at validation, and
have the renderer suppress a seed line that isn't a sentence.

### N-3 · The ranking claim contradicts itself on three surfaces 🔴

Same thread, same moment:
- Composer strip: **"5 RANKED"** (later "6 RANKED")
- Audience panel (desktop full-screen takeover AND mobile): **"Not simulated yet · 5 queued · 0 sealed"**
- Turn summary: *"reacted with your 10 reactors, strongest first"*
- Panel header: **"1,000 minds"** vs the summary's "10 reactors"

Nothing was simulated; the strip and the summary both claim it was. One state, one vocabulary needed
(and "reacted with your N reactors" must not print unless sims actually ran).

### N-1 · "Proven structure" attribution is decorative 🔴

The cited template does not structurally match the content it decorates, consistently:
- Hook 2 *"Your alarm didn't fail you…"* ← cited `[Action] without a [System]? That's why you are
  [Negative Outcome].`
- Hook 3 *"If your morning routine looks like this…"* ← cited a Tutorial madlib (`Here's the #1 tip…`)
- Hook 4 *"I spent three weeks tracking…"* ← cited `The reason [successful example] does so well…`
- Script (dance) ← cited an Authority madlib from @markbouris.

The receipt asserts "this borrows that video's structure" and it demonstrably doesn't. Either enforce
structural adaptation at generation time, or stop labeling it PROVEN STRUCTURE.

### N-4 · The requested count is ignored

Thread *"**3 hooks** for my new video…"* → **5 cards** (HOOK_COUNT fixed at 5). With F-1's markdown
re-answer, that ask actually got 10 hooks in two formats.

---

## 1. Audit findings — what this session confirmed / corrected

| Finding | Status this session |
|---|---|
| F-1 pack renders twice | CONFIRMED persisted (hooks thread, survives reload). Did NOT recur on ideas or script runs → intermittent, ~1 in 3. |
| F-2 prose picks #2, button runs #1 | CONFIRMED verbatim on the old thread. The button DOES run #1 (progress named it) — the prose is the wrong half. |
| F-3 audience label flips to "General" | CONFIRMED twice live (ideas summary + hooks strip General→@mrbeast hydration flash). **Root-caused:** routes stamp `audienceLabel: activeAudience?.name` (`hooks/route.ts:296`, `ideas/route.ts:278`) and the chat-routed path has no resolved audience at stamp time; `thread-turn.tsx:220` then falls back to the literal `'General'`. The direct script one-shot stamped `@mrbeast` correctly. |
| F-4 loading promises grounding cards disclaim | CONFIRMED, and sharpened — see F-21 correction below. |
| F-5 junk meta-templates | CONFIRMED on the old thread (`This is [Subject] and [Metric-based achievement].`). |
| F-6 jittery multiplier shown | CONFIRMED — every receipt reads "vs their usual views". @markbouris receipt shows views with NO multiplier (one of the 136 null rows, F-22). |
| F-7 same source 3 of 5 cards | CONFIRMED — `@personalbrandlaunch`, same reel `DJT3cRDJqcR`, cards 2/4/5. New thread used 3 distinct sources → attribution roulette, not determinism. |
| F-8 fixed persona roster | CONFIRMED — same five names/percentages; also a "Lurker" persona is narrated in why-it-works that exists in no roster. |
| F-11 nothing streams | CONFIRMED with fresh numbers. Ideas: send → **2s nothing → 7s bare "Thinking" → 9.1s static checklist → 23.2s everything at once** (321→4,625 chars in one paint). Script: card at ~18.3s. |
| F-13 composer guillotines content | CONFIRMED visually (serif title sliced mid-glyph). |
| F-14 zero headings / unnamed rail buttons / word-per-span | CONFIRMED (0 h1–h6 in thread; 4 icon buttons `aria-label: null`). Source links have GOOD labels. |
| F-15 accent dosage clean | CONFIRMED. One amber dot on idea-card "TAKE ●" label — check against the LOCKED rule. |
| F-16 mobile composer clips typing | CONFIRMED + measured: textbox `scrollHeight 89 / clientHeight 48`, fixed at y=516; first line sliced mid-glyph. |
| F-17 ranked results desktop-only | **PARTIALLY WRONG.** Tapping the strip opens a full-screen audience panel on mobile with the queue — a mobile home EXISTS. The real problem is N-3 (it says "Not simulated yet"). On desktop 1200px the same panel is a full-viewport takeover with ~40% dead space. |
| F-18 no mobile top bar | CONFIRMED; drawer also opens with NO scrim, and shows ⌘N/⌘K hints on touch. |
| F-19 tap targets | CONFIRMED — probe: 91 elements <40px (scales with thread rows). |
| F-21 ideas/script retrieval starved by 0.50 floor | **CORRECTED.** Server log: BOTH runs retrieved **6 teardowns** (`ideas/topical` and `script/topical` cache HITs). The visible "Original — not drawn" rate (ideas: 3 of 4 cards) is the **model declining to cite** (`sourceIndex 0` honesty rule), not empty retrieval — at least for these cached topical queries. The floor may still bite elsewhere; unmeasured. The user-facing symptom stands: retrieval shows N sources, cards disclaim most of them. |

Zero console errors across every desktop/mobile walk (matches audit).

## 2. New smaller findings

- **N-5 · Two tool vocabularies on one screen.** Greeting grid says "Video test / Account teardown /
  Explore / Compare A/B"; arming a skill swaps in a second grid saying "Test a video / Read my recent
  posts" — same skills, different names, and the greeting vanishes abruptly. Typing `/` does nothing
  (no slash menu on this surface).
- Persisted progress receipt is skeletal after reload ("Generating / Simulating your audience /
  Ranking") — the live run's named sources/thumbnails/timings are client-only. The DIRECT one-shot
  script run shows a **much better live card** (elapsed timer, "Drafting against 1 proven video",
  source thumbnail) — the good progress UI already exists; chat-routed runs don't use it.
- Thread titles are raw prompt echoes, truncated ~14ch, with duplicates ("I made a $10,00…" ×2).
- Ideas outro asks *"Which one do you want to build a hook and script for?"* — no numbered affordance
  matches; per-card chips say "Write hooks for this" (for an idea!) while the outro says hook+script.
- No turn-level actions on any assistant turn (copy answer / rerun / feedback) — audit's benchmark
  table row confirmed by walk.
- `Escape` closes the audience takeover (good); sidebar toggle is labeled "Collapse sidebar" in both
  states.

## 3. How to reproduce this session

```bash
lsof -ti:3005 || (cd ~/virtuna-in-thread-chat && npm run dev -- --port 3005)
# auth: e2e/playwright setup writes e2e/auth/state.json; inject its cookie into any browser context
# threads to inspect (e2e account): "give me hooks for a video…" (merged turn, N-8, F-1),
#   "3 hooks for my new video were i didnt eat…" (F-2, F-5, F-7), "give me video ideas…" (F-3, ideas)
node scripts/probe-thread-mobile.mjs        # green: composerGrew:false · smallTargets:91 · errors:0
```

Screenshots: `.playwright-mcp/shots2/` (gitignored, ephemeral — the numbers above are the durable copy).

## 3b. Addendum — residue from the session-1 (Opus) author, on direct ask

Messaged the original audit session; its unrecorded observations, verbatim-condensed:

- **F-17 method was wrong, not just the conclusion** — it measured the DESKTOP `aside` on mobile.
  `probe-thread-mobile.mjs` has been patched (field renamed `desktopAsideHidden` + warning).
- **F-3 timing evidence:** `/api/threads/open` refetches at t+26.4s — AFTER the run settles. The
  post-run refetch swaps the in-memory turn (correct label) for the persisted one (no label). Matches
  the run-header root cause exactly.
- **The ~5s "Thinking" is the ROUTER's latency** — `/api/tools/chat` opens its stream in ~0.7s; the
  ~4.8s is the agent model deciding which tool to call, before the earliest `dispatch` SSE event.
  Fix = faster router or honest pre-dispatch copy, not a spinner.
- **The word-by-word reveal primitive exists** (summary line renders one span per word) but is spent
  on the summary; cards — the deliverable — appear in one paint.
- **Owner intent:** benchmark set is **Claude + Perplexity, explicitly NOT ChatGPT.**
- **Persona percentages sum to 57%** (10+15+10+10+12) — ~43% of the modelled audience is never
  written for. Unknown if intended.
- F-1 hunch (n=2): over-answering in markdown correlated with cards declining `sourceIndex` — the
  model may compensate in prose when it declines attribution. Cheap to test.
- Smaller: archetype pill inside the proof receipt reads as labelling the generated hook; ranked rail
  once showed a suspiciously round 50.0% from a 1,000-mind sim; rail auto-sims card 1 only, 4 stay
  queued; unexplained mid-session sidebar collapse (probably coincident with a timed-out probe click);
  "Good morning" greeting at 00:20; `Ad creative` / `Compare A/B` sit as `soon` badges in the primary
  discovery grid.
- Methodology: `page.evaluate('() => {…}')` with a STRING silently returns undefined here — pass a
  real function (four measurement passes were lost to this in session 1).

## 3c. Addendum — the corpus is far richer than what reaches prompts (owner's "we have all the videos data")

Measured in Supabase (2026-08-09):

- `outlier_teardowns` (532): beyond the fields retrieval uses, EVERY row carries `teardown.summary`,
  `teardown.narrative_structure` (**timestamped beat sections** — `structure_sections[].end_second`),
  `hook_alignment`, `format_category/flavor`, `visual_layout_category`, `outlier_score`, plus
  `spoken_hook` / `visual_hook` / `editing_style` / `why_it_works` (~578 chars avg) / `idea{seed,angle,…}`
  on 524/532. "Borrow the proven structure" could hand the model the actual beat map, not a one-line
  template — this converts N-1 (decorative attribution) from a relabeling problem into a real capability.
- `scraped_videos` (**7,439 rows**, 7,389 with embeddings, 7,420 with views): a large un-torn-down
  pool. Only 50 have multipliers, 0 have `follower_tier` — so it does NOT solve F-6's receipt basis
  by itself, but it is raw material for corpus growth/refresh.
- `teardown_collections` (592) unpacks a taxonomy already.

## 4. Suggested attack order (owner input wanted on 3/4)

1. **Contract the anchor** (N-7) — prompt instruction + output validation. Small, server-only, kills
   the worst trust-breaker.
2. **Per-turn persistence for chip runs** (N-8) — write a user-action row; stop merging on reload.
3. **Stamp the audience label on chat-routed runs** (F-3) and drop the `'General'` renderer fallback.
4. **seedHook validation** (N-2) + purge/repair the 6 meta-template corpus rows (F-5) + source
   diversity constraint in `buildProofFromSource` (F-7) + honor requested count (N-4).
5. **One ranking truth** (N-3): strip / panel / summary read the same state.
6. F-1 containment: cap the post-tool closing text server-side (a line, not a re-answer).
7. Then the feel work (F-9…F-13: type ramp, streaming, guillotine gradient) — unchanged from audit §7,
   including the open owner decisions (multiplier positioning F-6, composer.tsx split, sketch-first
   conflict).
