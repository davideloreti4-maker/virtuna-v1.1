# Handoff — in-thread chat audit (2026-08-09)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Base:** HEAD == `origin/main` == `7088d72a` at audit time (0 ahead, 0 behind — clean start).
**Status:** AUDIT ONLY. **No product code was changed.** Nothing here is fixed.
**Sibling session:** `virtuna-platform-concept` (`lane/platform-concept`) is live in herdr and owns the
v8 concept lane. This audit deliberately stayed inside the thread/chat surface.

**What this is:** a measured audit of the in-thread chat — UI, UX, user value, user flow, desktop +
mobile, plus the quality of what the auto-routed skills actually emit and how the 500-video corpus
feeds them. Every claim below is either a browser measurement, a SQL result, or a file:line. Where
something is unverified it says so.

---

## 0. How to get back to where this session was

```bash
# dev server (3005 was free; check first — one server per port)
lsof -ti:3005 || (cd ~/virtuna-in-thread-chat && npm run dev -- --port 3005)

# signed-in Playwright state. NOTE: this worktree's .env.local does NOT carry E2E_USER_*,
# so pass them inline (credentials are the real prod test account — see memory e2e-auth-state-is-dead)
set -a; . ./.env.local; set +a
E2E_BASE_URL=http://localhost:3005 \
E2E_USER_EMAIL=e2e-test@virtuna.local E2E_USER_PASSWORD=e2e-test-password-2026 \
  node node_modules/@playwright/test/cli.js test --project=setup --config=e2e/playwright.config.ts

# the two probes written this session (tracked, so they survive `git worktree remove`).
# BOTH VERIFIED GREEN 2026-08-09 against a live :3005.
node scripts/probe-thread-mobile.mjs
#   → composerGrew:false · asideHidden:true · docOverflowX:0 · smallTargets:62 · consoleErrors:0
node scripts/probe-chat-bench.mjs --mobile --local http://localhost:3005/home
#   → perplexity 16px/26 36ch · virtuna 22px/28.6 (hero) · roles 9 vs 19
node scripts/probe-chat-bench.mjs --claude https://claude.ai/share/<uuid>   # fills the missing column
```

⚠️ The dev server dies on its own after ~10 min idle — a launchd reaper, not a crash
(memory `dev-server-reaper`). `ERR_CONNECTION_REFUSED` from a probe usually means restart the server,
not debug the probe.

Screenshots from this session live in `.playwright-mcp/shots/` — **gitignored and therefore
ephemeral**. Everything they proved is written out as numbers below; re-run the probes to regenerate.

⚠️ Driving the app signed in as the e2e user **spends real credits on a real prod account**
(`BILLING_ENFORCE_QUOTA` is true in prod, and dev + prod share one Supabase project). One paid hooks
run was spent producing this audit. Budget deliberately.

---

## 1. THE MAP — what renders a turn

```
composer.tsx (3802 lines — owns routing, the dock, the rail AND the thread)
 └─ [data-testid="composer-thread-region"]   ← THE scroll container. Everything measures off this.
     └─ ThreadTurn (thread-turn.tsx, 379)    ← one renderer, every skill, live or reloaded
         ├─ ThreadUserTurn / ThreadAssistantTurn   thread-shell.tsx
         ├─ ThreadIntro                            conversational-frame.tsx
         ├─ SkillProgress + STAGE_PLANS            progress-checklist.tsx (844)
         ├─ MessageBlocks                          message-blocks.tsx → 18 block types
         │    ├─ hook-card-block / idea-card-block / script-card-block
         │    ├─ ProofReceipt                      proof-receipt.tsx  ← the grounding receipt
         │    ├─ CorpusReferencesBlockRenderer     corpus-references-block.tsx
         │    └─ markdown-block.tsx                ← the model's own prose (see F-1)
         └─ ThreadOutro (followup text + forward chip + followupsForKind)
```

Server side: `/api/tools/chat` → `chat-agent-loop.ts` → `SKILL_TOOLS` → `lib/tools/runners/*`.
Grounding: `lib/grounding/{retrieve,rank,corpus,outlier-gate}.ts` → `outlier_teardowns` (532 rows).

---

## 2. FINDINGS — P0, the answer is wrong

### F-1 · The pack renders twice, in two different design languages 🔴

Live run, prompt *"give me hooks for a video about why most morning routines fail"*. The thread
rendered 5 premium hook cards, then **immediately re-answered in raw markdown**:

> Here are 5 hooks tailored to your **comedy storytelling angle**. …
> **Hook 1: The "I Was Lying" Confession** — *"I spent three years pretending…"*
> … Hook 5 …
> **#1 is your strongest. Want me to turn it into a script?**

Ten hooks, two formats, different content, a niche framing ("comedy storytelling") that matches
neither the ask nor the connected audience, and a closing question duplicating the chip directly
below it.

**Mechanism:** `ChatAgentStreamResult` (`chat-agent-loop.ts:259`) returns **both** `text` (the model's
streamed prose) and `skillRuns` (the cards). The route persists and renders both. The interface
comment says the model *"must be free to write the closing line once the tool has returned"* — but
nothing constrains it to a *line*. When it over-answers you get the product twice.

**Intermittent** — the older restored thread's outro was a single correct sentence. Intermittent is
worse than always: it can't be trusted and it can't be spot-checked.

### F-2 · The follow-up prose contradicts its own button 🔴

Restored thread, verbatim:

> "Hook #1 wins on visceral stakes, but **#2's** 'exact moment' promise offers superior retention
> architecture. **Write the script for #2** to test if…"

Button underneath: **`Write a script from #1 →`**. The prose picks one and the affordance runs the
other. (a11y refs `e333` / `e335`.)

### F-3 · The audience name flips mid-run 🔴

- During the run: *"Pulling hooks for **@mrbeast** — I'll react each one with your 10 reactors…"*
- Once persisted: *"Pulled hooks for **General** — reacted with your 10 reactors, strongest first."*

The live→persisted transition loses the audience label and substitutes the literal string `General`.
The older restored thread says `@mrbeast` in both, so this is new or conditional.

### F-4 · The loading state promises grounding the cards don't deliver 🔴

Progress spine during the run said **"Borrowing shape from 5 proven videos"** and named
`@thegrowthconsultant_ 4×`, `@marie_mag_ 29×`, `@shannonmckinstrie 5.7×`. Final cards: **2 of 5** read
*"Original — not drawn from a retrieved video."* The creator watched three sources get retrieved and
then two fifths of the answer disclaims having used any.

`NoSourceNote` is deliberate and honest (proof-receipt.tsx:194–220) — the defect is upstream: the
loading copy asserts an outcome before it is known.

### F-5 · Unfilled template placeholders shipped to screen 🔴

Rendered verbatim inside `PROVEN STRUCTURE`:

```
This is a [hook type] hook. [Example of hook type applied to topic].
This is [Subject] and [Metric-based achievement].
```

`proof-receipt.tsx:58 TemplatedHook` correctly renders `[bracketed]` slots as chips — the data is the
problem. **Six corpus rows are meta-templates** — hooks *about* hooks, harvested from
creator-education accounts, whose "template" is a description of a template:

| handle | hook_template |
|---|---|
| personalbrandlaunch | `This is a [hook type] hook. [Example of hook type applied to topic].` |
| thepostprotocol | `This is [Subject] and [Metric-based achievement].` |
| peter.visuals | `Don't [common excuse or belief]. This is a [hook type] hook.` |
| shortformstrategies | `This is a [category name] hook.` |
| taibifindss | `This is a [Format Name] of [Niche Topic].` |
| ryanspenner.tv | `This is a [specific technique] hook.` |

### F-6 · The multiplier on screen is the one the code says never to show 🔴

`outlier-gate.ts:9–21` defines two metrics and is explicit:

- **SELECTION** = views ÷ result-set median — *"Sample-jittery — the SAME video read 178×→208× across
  two pulls… it only picks WHICH survivors to tear down, **never shown as proof**."*
- **RECEIPT** = views ÷ follower_count, label `"vs followers"` — the durable number, the one to show.

Measured on the live corpus: `follower_count` is **NULL on all 532 rows** and `baseline_label` is
`"vs their usual views"` on every printed row. So every `52.8× vs their usual views` on a card is the
jittery selection metric, rendered by a component whose docblock is headed *"Honesty spine"*.
The tell: the corpus max is **20,154.7×** (`kis_noemi`, case-study, 7.3M views).

This restates memory `corpus-multiplier-basis-contradiction` with the UI-side consequence attached.

### F-7 · The same source is cited on 3 of 5 cards 🔴 (the repeat you reported)

Restored `@mrbeast` thread — `@personalbrandlaunch`, `52.8×`, `2.3M`, same thumbnail, same junk
template, on cards **2, 4 and 5 of 5**. Same `instagram.com/reel/DJT3cRDJqcR/` three times.

**It is not retrieval.** `selectStructuralExamples` (`rank.ts:89`) round-robins across all 13
archetypes and hands the model 6 distinct rows (`retrieve.ts:102 maxExamples: 6`). The model then
emits a `sourceIndex` per card and **`buildProofFromSource` (`build-proof.ts:31`) has no diversity
constraint** — nothing prevents the same index three times, and 2 of 6 retrieved sources went unused.
Fix belongs at attribution, not retrieval.

### F-8 · Two "personalisation" lines carry no signal

- `fitLabel` read **`◐ adjacent audience` on 8 of 8** sources across both runs. The glyph never varies,
  so it teaches nothing.
- `Made for The Daily Ritualist · 10% of your audience` — both runs used the **identical five personas
  with the identical five percentages** (Daily Ritualist 10 · Algorithm Feeder 15 · Trend Chaser 10 ·
  Brand Evangelist 10 · Passive Dopamine Hit 12), only the card→persona pairing rotated. It reads as
  bespoke matching; it is a fixed roster.

---

## 3. FINDINGS — P1, why it doesn't feel like Claude

All measured at **1200 × 729**, same query on each product, by `scripts/probe-chat-bench.mjs`.

> **Method note on `ch`:** characters-per-line = column width ÷ the rendered width of `0` in that
> exact font. `0` is wider than the average proportional glyph, so these values UNDERSTATE real
> characters per line by roughly 30%. The method is identical across products, so the comparison is
> sound; treat the absolute numbers as a consistent index, not as a typographic measure.

| | **Virtuna** | **Perplexity** | **Claude** |
|---|---|---|---|
| body type | Inter **14px** / 22.75 (1.625) | pplxSerif 16px / 26 (1.625) | **not measured** |
| measure | **75 ch** | 71 ch | **not measured** |
| content column | 662px (x=297) | 720px (x=360) | **not measured** |
| body colour | `#c2bdb4` on `#1a1a19` (9.3:1) | `rgb(39,37,30)` on white | — |
| distinct text sizes in ONE answer | **11 · 12 · 13 · 14 · 16 · 22** | ~3 | — |
| time to first content after send | **~5.5s of bare "Thinking…"** | streams immediately | — |
| time to cards | **~19.5s** | — | — |
| answer settled | **~23.5s** | ~8s | — |
| one answer's scroll height | **3663px ≈ 4 screens** | ~1 screen | — |
| citations | 5 × ~150px cards inline | one `10 Quellen` chip + a Links **tab** | — |
| follow-ups | 3 generic chips ("More hooks") | 3 answer-specific full questions | — |
| assistant-turn actions | **none** | share · download · copy · rerun · 👍 👎 · … | — |
| composer edge | solid `bg-background`, **hard cut** | floating card, hard cut | — |

> **Claude was NOT measured.** `claude.ai/new` redirects to `/logout` in an automated browser and no
> indexed public `claude.ai/share/...` URL was findable. **To finish this column:** get a
> `claude.ai/share/...` link (Share → Create link on any chat with prose + a list + a code block),
> then `node scripts/probe-chat-bench.mjs --claude <url>`. Read-only share pages render the real
> thread UI without auth.
>
> ChatGPT *was* measured (16px/26, 66ch, 640px column, h3 18/28) but the owner explicitly did not
> want it in the comparison. Kept here only as a second data point that 16px/1.625/~66ch is the
> convergent norm.

### Same comparison, MOBILE (393 × 660 native, `--mobile`)

| | **Virtuna** | **Perplexity** | **Claude** |
|---|---|---|---|
| body type | Inter **13px** / 21.13 | pplxSerif **16px** / 26 | **not measured** |
| smallest text role | **10px** | 10px (one, chrome only) | — |
| distinct text roles in one thread | **19** | **9** | — |
| hero | Newsreader 22 / 28.6 in a 248px column | — | — |

Virtuna's body type goes **DOWN** on the small screen (14px → 13px) where Perplexity holds 16px, and
the role count goes **UP** (14 → 19). Both moves are backwards. Ten distinct sizes appear on a 393px
screen: 10, 11, 12, 13, 14, 16, 22.

### The three that compound

**F-9 · Reading text is small, wide and grey at once.** 14px, 75 characters per line, in
`foreground-secondary`. Both benchmarks sit at 16px / ~66–71ch. 75ch is past the top of the
comfortable range; each of the three is defensible alone, together they are the "harder to read"
feeling.

**F-10 · Fourteen text roles in one answer.** Six sizes × three colours × weights 400/500/600.
Worse, the tool cards render body at **14px Inter** while the model's markdown prose in the *same
turn* renders at **16px Inter with 16px bold headings** — two type systems inside one answer.

**F-11 · Nothing streams.** ~5.5s of a bare "Thinking…", then ~14s of a static checklist, then five
cards appear at once. Compare Perplexity: tokens immediately.
`/api/tools/chat` returned 200 at **5189ms**; `/api/saved` refetched at 22470ms; `/api/threads/open`
at 26353ms. Note `.planning/sketches/premium-thread.html` v3.2 already specifies *"cards arriving
one-by-one"* and *"Generated in 0:32 ▸"* — still unbuilt (memory `premium-thread-sketch-is-the-target`).

**F-12 · The wait happens in a void.** During the run the progress card sits pinned to the TOP of the
viewport with ~600px of empty space between it and the composer. Both benchmarks keep the live turn
anchored near the composer so the eye never moves.

**F-13 · The composer guillotines content.** `composer.tsx:3416`:

```tsx
<div aria-hidden data-testid="composer-backdrop"
     className="pointer-events-none absolute inset-x-0 -bottom-4 top-0 bg-background" />
```

`bg-background` is a **solid fill, not a gradient**. Content slides under it and is sliced mid-glyph
at a hard horizontal line at every scroll position. A gradient mask is a one-line change.

**F-14 · Structure and a11y.**
- **Zero `h1`–`h4` in the entire thread.** Every hook title is a `<p>`. No screen-reader navigation,
  no document outline.
- Collapsed-rail nav buttons have **no accessible names** (4 icon-only buttons, `aria-label: null`).
- Desktop tap targets: `Copy` 47×18 · `Save to shelf` 55×20 · `Expand hook details` 131×18.
  18 elements under 32px tall in `main` + `aside`.
- One AA contrast failure: `"3 steps"` at **1.27:1** (`oklab(0.618… / 0.6)`). Everything else passes;
  the 11px `#8a857c` roles sit exactly on the 4.5 floor.
- The assistant summary line is rendered **one `<span>` per word** for the reveal animation.

**F-15 · Accent dosage is CLEAN.** Zero accent-coloured elements visible in the thread. The LOCKED
rule is holding — don't "fix" this.

---

## 4. FINDINGS — P2, mobile (native iPhone 14 Pro context, 393 × 660)

Measured in a fresh context opened at that size (never a resized desktop page — memory
`screenshot-viewport-must-be-native`).

**F-16 · You cannot see what you type.** 🔴 The composer is a fixed **48px** at `y=516`. Typing ~130
characters scrolls the text up and it is **clipped by the composer's own top edge** — the first line
renders sliced in half. It does not grow. This is the single worst mobile defect.

**F-17 · The audience rail is `0×0` on mobile.** Every ranked simulation result — the product's
differentiator — is desktop-only with no mobile equivalent. There is a `@mrbeast · CALIBRATED · 5
RANKED ⌄` strip fused to the composer top, but the ranked list itself has no mobile home.

**F-18 · No top bar.** A floating ☰ overlays thread text with no scrim; the first line of content
renders underneath it. No thread title, no orientation.

**F-19 · Tap targets.** **62–84 elements under 40px** on home (the count scales with how many
thread-history rows are rendered — each row contributes three). Thread-history rows are 30px tall
with **22×22** pin / rename / delete buttons. Apple HIG minimum is 44×44.

**F-20 · ~96px of dead space below the composer** (composer bottom 564, viewport 660).

**Good:** `docOverflowX = 0` — no horizontal overflow anywhere. Zero console errors across the whole
mobile walk. The off-canvas drawer at `x=-220` is a correct pattern (the 207 "overflowing" elements
the probe reports are that drawer's children — a false positive, not a bug).

---

## 5. THE CORPUS — `outlier_teardowns`, 532 rows

```sql
select count(*) rows, count(distinct creator_handle) handles,
       count(distinct hook_archetype) archetypes,
       count(*) filter (where hook_template is null or btrim(hook_template)='') no_template,
       count(*) filter (where outlier_multiplier is null) no_multiplier,
       count(*) filter (where cover_url is null) no_cover,
       count(*) filter (where niche is null) no_niche
from outlier_teardowns;
```

| rows | handles | archetypes | no_template | no_multiplier | no_cover | no_niche |
|---|---|---|---|---|---|---|
| 532 | 413 | 13 (+8 null) | 8 | **136** | 0 | 8 |

Archetype distribution (n · avg mult · max mult · null mult):

```
personal-experience 164 · 139.4 · 3234.7 · 64      case-study            24 · 876.5 · 20154.7 · 0
tutorial             62 ·  31.1 ·  475.0 · 16      list                  24 · 347.5 ·  5216.5 · 1
question             50 ·  75.7 · 1226.3 · 14      problem               23 ·   8.4 ·    49.5 · 3
secret-reveal-break  40 · 237.3 · 6093.0 ·  7      ranking-rating        23 ·  60.8 ·   615.0 · 4
authority            37 · 480.1 ·10889.5 · 12      contrarian            18 ·  23.7 ·   182.1 · 3
scenario-hypothetical30 ·  61.1 ·  267.5 ·  7      comparison            17 ·  75.9 ·   490.2 · 1
                                                    trap-mistake          12 · 228.4 ·  1960.4 · 3
                                                    (null)                 8 ·  33.6 ·   170.0 · 1
```

**F-21 · The structural ranker fix was applied to `hooks` ONLY.** `retrieve.ts:116` gives hooks
`minSimilarity: 0`, the whole 532-row pool and archetype round-robin. `ideas` and `script` still run
the **0.50 topical floor** that `retrieve.ts:123–135` documents against itself:

> *"⚠️ 0.58 is MIS-CALIBRATED and known to be so… The floor does not separate relevant from
> irrelevant, it detects whether the corpus happens to hold your subject."*

The measured damage on hooks before the fix (8 of 10 real asks retrieved zero rows; 515 of 532 madlibs
unreachable) is presumably still live on ideas and script. **Unverified** — no probe was run against
ideas/script this session. `scripts/probe-hook-transfer.ts` is the pattern to copy.

**F-22 · 136 rows (26%) carry no multiplier**, so they can never show a receipt. **F-5's six
meta-template rows** should be purged or repaired.

---

## 6. What I did NOT verify — do not treat as settled

- **Claude's thread UI.** Blocked on a share link. §3 table has a hole.
- **`ideas` / `script` retrieval quality** under the mis-calibrated floor (F-21). Inferred from code
  + the hooks measurement, not measured.
- **F-3 (`@mrbeast` → `General`)** was seen once, on a new thread. Not root-caused.
- **F-1 frequency.** Seen on 1 of 2 threads. No repeat count.
- **Tier-2/3 skills** (`remix`, `account-read`, `explore`, `read`, `test`, `predict`, `profile`,
  `simulate`, `refine`) were **not exercised**. Only `hooks` ran. `docs/HANDOFF-2026-08-04-thread-experience.md`
  §1 has the tier map; the paid-scrape skills were left alone on purpose (Apify $5/mo hard cap).
- **Error / unhappy paths** in-thread were not exercised this session (see
  `docs/HANDOFF-2026-08-07-unhappy-paths.md`, merged).
- **The sidebar collapsed 220px→56px mid-session** and I could not attribute it to an action. Not
  reported as a bug; re-check if it recurs.

### Two things that LOOK like bugs in screenshots and are not

1. The black **"N" circle** bottom-left overlapping the sidebar footer / the mobile composer is the
   **Next.js Dev Tools indicator**.
2. The **⚙ bottom-right** is the app's own **dev mock panel** (`Open dev mock panel`).

Both are dev-only. I nearly filed both as product defects.

---

## 7. Open decisions for the owner

1. **Which slice first?** Suggested order: F-1…F-8 (output correctness) → F-9…F-15 (feel) →
   F-16…F-20 (mobile) → F-21/F-22 (corpus). The P0s actively mislead; polish over them is wasted.
2. **Blast radius.** `composer.tsx` is **3802 lines** and owns routing, the dock, the rail *and* the
   thread. Several defects live in it. Split as part of the work, or surgical fixes only?
3. **Process conflict to resolve before building.** `premium-thread-sketch-is-the-target` says this
   surface is **sketch-first** (`.planning/sketches/premium-thread.html` v3.2 is the locked target).
   `owner-rejects-sketch-first` says the owner rejects sketch-first when the surface already exists.
   Both are in memory; they disagree for exactly this surface. Ask before sketching.
4. **F-6 is a positioning decision, not a bug fix.** Either backfill `follower_count` and print the
   durable receipt, or stop printing a multiplier, or relabel it honestly as a sample statistic.
   Printing a jittery number under "Proven structure" is the current state.

---

## 8. Evidence index

| what | where |
|---|---|
| Probe: native-mobile walk + measurements | `scripts/probe-thread-mobile.mjs` |
| Probe: competitor render measurements | `scripts/probe-chat-bench.mjs` |
| Screenshots (⚠️ gitignored, ephemeral) | `.playwright-mcp/shots/` |
| Thread scroll container | `[data-testid="composer-thread-region"]` |
| Predecessor: tier map, routing, model stack | `docs/HANDOFF-2026-08-04-thread-experience.md` |
| Predecessor: one renderer, why ThreadTurn exists | `docs/HANDOFF-2026-07-28-one-thread-one-renderer.md` |
| Locked loading target | `.planning/sketches/premium-thread.html` (v3.2) |
| Corpus decision record | `docs/DECISION-outlier-corpus-2026-08-07.md` |
