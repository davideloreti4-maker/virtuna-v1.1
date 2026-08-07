# HANDOFF — Skill cards v9.2b (the four-band system) · continue refinement here

**Branch:** `task/skill-cards-rework` · **Worktree:** `~/virtuna-slot-a` · **Dev port:** 3001
**Tip:** `cc807d93` (pushed) · **Base:** `origin/main` @ `fb0a5a00`
**Status:** design converged after 12 iterations across two sessions. **Zero `src/` changes**
(verified `git diff --stat origin/main...HEAD -- src/` empty). Mockups only until the owner signs
off — that lock stands. No PR.

**The current candidate is v9.2b:**
- Sketch: `.planning/sketches/skill-cards-v9-2-bands.html`
- Hosted (fonts embedded): https://claude.ai/code/artifact/72584d22-dc09-42cd-b6a8-12fc77bbef09
- Review vs the REAL renderers: `.planning/sketches/skill-cards-v9-review.html` ·
  https://claude.ai/code/artifact/5fe919c9-4b68-4217-99c3-cae2523836dd

The prior handoff (`HANDOFF-2026-08-01-skill-cards-rework.md`) holds the deep audit trail
(§3 verified findings with file:line receipts, §5 early rejections). Its §1 questions are ANSWERED;
read it second, this file first.

---

## 1. The design — v9.2b, "four bands"

**The card is four full-width bands sharing one left edge.** Portrait-media-beside-text is banned
geometry (a 9:16 panel can never be filled by its neighbor text; three rounds died on this).
Mobile is the desktop layout narrowed — no special-casing anywhere.

| Band | Contents | Notes |
|---|---|---|
| **Face** | kicker row (`Top pick` chip · Copy) · serif hero (22px, quoted ONLY on spoken lines, `max-width:44ch`) · dek (13px, 2 lines) | Idea's dek carries the take: *"Go quiet on purpose, then show the receipts. **Your take:** …"* (take in cream — the one owned line, on the face full-length; shipped truncates it) |
| **Source row** | 52px 9:16 cover · `Case study · @handle` over `90.7× their usual reach · 621K views` (multiplier sage) · chevron · tappable, hover tint | ONE component on all four cards. Real TikTok covers in prod (516/532 on file). Absent → band simply missing; card stays complete |
| **Brief row** | `Full brief` + its contents named + `›` → expands to title/subtitle cells | Hook cells: Why it works · Structure (template) · Audience · First frame · Your line. Idea cells: Why it lands · Fits you · Structure · Audience · Opening line. **Five cells each — the value audit restored "Fits you" and "Why it works"; with them NOTHING real from shipped is lost** |
| **Footer** | primary (8px radius) · door `○ Not tested yet · Simulate with your audience →` · save | Door replaces the entire verdict apparatus |

**Species rule (the system):** *choice cards scan, deliverable cards read.*
- **Hook / idea** (arrive ×5/×4, job = pick one): the compact face above.
- **Script / remix** (arrive alone, job = use): keep timeline / decode map ON the face, wrapped in
  the same shell (header row `Script · 5 beats · Talking-head · …` + Copy · source row · surface ·
  How-to-film dl · footer). Map keeps its serif adapted hook inside (locked exception) and
  sentence-case cell labels; beat labels stay uppercase (timeline skeleton).
- **Third species, OUT of this lane:** Read family + video Test card are *measured* verdict cards —
  their numbers are real and STAY. They adopt only the shell, in a later lane (see §6).

**Measured heights** (real `getBoundingClientRect`, no overflow, no JS errors; "shipped" = the REAL
renderers mounted with matched fixtures, not a reproduction):

| Card | Shipped @728/@342 | v9.2b @728/@342 |
|---|---|---|
| hook collapsed | 591 / 680 | **371 / 436** |
| idea collapsed | 629 / 756 | **371 / 433** |
| idea brief open | — | 670 / 843 |
| hook no-reference | — | 254 / 319 |
| script | 958 / 1403 | 830 / 1308 |
| remix | 763 / 1038 | 708 / **1159** ← the one number above shipped (stacked map) |

---

## 2. Decisions locked THIS session (owner's words in quotes)

1. **Case-study anchor won** — the only positive pick of the series.
2. Every text-column treatment is dead: v5 colon run-ins ("feels like a document"), v6 Stage
   bold-lead-ins AND Studio glyph rows ("both just read like a document"), v7 prose-beside-panel
   ("still just unstructured text… no UI design"), v8 typed cells (right idiom, "not clean and
   premium"), v9/v9.1 portrait-panel-beside-text ("empty and unstructured… thumbnail too big…
   no reference feels even worse"). **Do not re-propose any of these.**
3. **Staging, not deletion**: face carries 4 elements; detail lives in the brief. This reconciles
   round 1's "deleting content regressed value" with the big-3 bar (they collapse sources/citations
   too).
4. The verdict stays off the face (standing lock); the door owns measurement; wording
   `Not tested yet · Simulate with your audience →`.
5. **Wording table (final):** "Case study" (row title; "Proven structure" survives as the brief's
   structure cell) · "90.7× their usual reach" never "vs followers" · "Made for" never "Written
   for" · "From your line …" never "Seed:" · no em dashes anywhere · room→audience.
6. The old "Visual label" lock is relaxed by direction: the shot lives in the dek + the "First
   frame" brief cell.
7. v8's "extracted mechanism keyword" runner field is **obsolete** — v9.2 brief cells have fixed
   titles. Only TWO additive engine follow-ups remain: the runner-authored 2-line dek (client-side
   assembly from `visualHook.onScreen` + `mechanism` ships first) and `reaction_frame` on
   `CardTargetSchema` (the audience cell's content — the only persona text with real content;
   see prior handoff finding 3).

## 3. Verified engineering facts (carry these; they cost real time)

- **`proof-unit.tsx` is shared with Simulate + the ＋door dial — never edit it.** The four cards
  stop CALLING it. (Prior handoff finding 4.)
- **`fraction` stays on block props** — `ambient-descriptors.ts:68` returns null without it.
  Remove from the face, never the schema.
- All three callers pass `personas: []` → `TargetReaction`'s receipt branch has never rendered
  (`hooks-runner.ts:637` · `ideas-runner.ts:599` · `script-runner.ts:638`).
- **The real-renderer comparison recipe that works:** throwaway `src/app/zz-preview/page.tsx`
  OUTSIDE the `(app)` group, mounting the four renderers with fixtures, wrapped in
  `QueryClientProvider` (SaveAffordance needs it). No auth needed. Delete before committing.
  Playwright: `waitUntil:'domcontentloaded'` (networkidle never settles), wait for a selector,
  `animations:'disabled'`. `NODE_PATH=<worktree>/node_modules` for scratchpad scripts.
- Measure sketches headlessly the same way off `file://` URLs (MCP playwright blocks `file:`).
- Artifact publishing: strip the Google Fonts `<link>`, inline the two `@font-face` data-URI lines
  (lift them from any `skill-cards-v*-artifact.html`; the CSP blocks CDNs).
- True card widths: 728 in-thread, 342 mobile. Judge every layout at both.

## 4. The full genealogy (sketches on the branch, one commit each)

v1/v2 hierarchy `8791018f`/`2becef40` · v3 directions `65ac656a` · v4 Document-stacked `893bcdb3` ·
v5 Answer `fcf25a1d` · v6 Stage/Studio `f2c7711e` · v7 object `9ac29490` · v8 cells `e353c68b` ·
v9 release `a1b7f73f` · v9-review (vs real renderers) `ed99ec9b` · v9.1 sign-off set `99501acb` ·
**v9.2 bands `a153b97d` · v9.2b five-cell briefs `cc807d93` ← CURRENT**.
Hosted: v5 `fd8af3c4…` · v6 `09665f95…` · v7 `7a037268…` · v8 `17268273…` · v9 `b295dea2…` ·
review `5fe919c9…` · v9.1 `940a9bc1…` · **v9.2 `72584d22-dc09-42cd-b6a8-12fc77bbef09`** (all under
claude.ai/code/artifact/<id>).

## 5. Implementation plan (on sign-off; do NOT start without it)

1. `src/components/thread/sim-door.tsx` — footer door; reuse `useOpenRoomForCard` /
   `useAmbientCardId` / `LensTrigger` exactly as ProofUnit does. States: untested / running
   (measured ③ deferred).
2. New `source-row` component (or reshape `ProofReceipt`) per §1. Four cards, one atomic commit
   each: hook, idea (choice anatomy + 5-cell brief), script, remix (shell). Drop `<ProofUnit>` and
   `<TargetReaction>` from the four faces (components stay in tree).
3. Dek assembles client-side first (no engine change); then the two additive engine follow-ups (§2.7).
4. Tests: rewrite `make-card-value-fields.test.tsx` + `idea-card-block.test.tsx` (they assert the
   removed verdict wording → assert its ABSENCE + door text). Keep green: `radius-scale` ·
   `section-label-scale` · `card-surface-consistency` (`bg-surface-sunken` stays) ·
   `proof-unit-open-room` · `ambient-card-anchors` · `no-source-note`.
5. `npx tsc --noEmit` + thread vitest + `npm run build` (the prod build is the gate, not tsc).

## 6. After this lane (do not fold into it)

Lane 2: video Test card + Read family adopt the shell, KEEPING their measured verdicts (context:
`docs/HANDOFF-2026-07-24-testcard-apollo-and-e2e-merge.md`, retired branch
`docs/handoff-read-family-cards`). Lane 3: Simulate surfaces (shared proof-unit) last. Auxiliary
blocks pick up the band vocabulary as touched.

## 7. Open items

- **Owner sign-off on v9.2b** — the only blocker for §5.
- Remix @342 is +121px vs shipped (stacked map) — accepted so far, revisit only if flagged.
- Brief open-rate is the post-ship metric to watch (if low, the staged facts are invisible).
- Legacy door question (pre-2026-07-22 measured cards) remains from the old handoff — recommend
  "Your audience reacted · See your audience →"; still unconfirmed.

## 8. Quick start for the next session

```bash
cd ~/virtuna-slot-a && git switch task/skill-cards-rework
open .planning/sketches/skill-cards-v9-2-bands.html     # ← the candidate (width toggle top-right)
open .planning/sketches/skill-cards-v9-review.html      # v9 vs the REAL renderers, with screenshots
npm run dev -- --port 3001                               # /dev/cards is auth-gated; zz-preview recipe in §3
```
Memory SSOT: `skill-cards-hierarchy-not-deletion` (+ `skill-card-target-line-is-dead`,
`proof-unit-is-shared-do-not-edit`). ⚠️ dev server is reaped after ~10 min idle; `.env.local`
credentials are a REAL prod account — browse, never generate.

---

## 9. Audit + v9.4 (added 2026-08-01, session 2) — READ BEFORE ACTING ON §5

Owner's direction: *"the current version isn't refined yet, or something Perplexity/Claude/ChatGPT
would release"* + *"clean and premium, easy to read, desktop AND mobile fit."* Two new artifacts,
both mockups only — **`src/` is still untouched on this branch** (`git diff origin/main...HEAD -- src/`
is empty).

- **Audit of v9.2b vs the REAL renderers** — `.planning/sketches/skill-cards-v9-3-audit.html`
  (source) / `-artifact.html` (fonts + screenshots inlined) ·
  https://claude.ai/code/artifact/2410dc7f-d151-4a5f-a6a3-c38a4fba6a65
- **v9.4, the integrated recommendation** — `.planning/sketches/skill-cards-v9-4-recommended.html`
  / `-artifact.html` · https://claude.ai/code/artifact/854123bb-4aae-4d75-8dea-c3ab434ad389

### 9.1 What the audit found (evidence in the artifact)

1. **At 728 no band uses the right half.** Hero capped at 44ch, dek at 58ch; the source row's stat
   ends ~288px before its own chevron. The layout was designed at 342 and stretched.
2. **The open brief is v8's typed cells + v6's bold lead-ins** — both already rejected. The one
   structured grid that survived review is the remix decode map.
3. **The set of five lost every signal you would pick on** (rank, band, fraction, quote, mechanism).
   Comparing five hooks now means opening five 670px briefs.
4. **§1's "NOTHING real from shipped is lost" is false.** Seven fields are absent, not staged:
   `rank`, `topic`, `format`, `proof.archetype`, `proof.fitLabel`, `proof.baselineLabel`, `channel`.
5. **§5's "90.7× their usual reach" states a ratio nothing computes.** `proof-schema.ts`:
   `multiplier` is views ÷ followers, and `baselineLabel` carries that basis. The wording lock is
   itself the defect → recommend `90.7× vs followers`.
6. **One brief cell has no data.** "Made for N% of your audience" needs `reaction_frame`, a deferred
   engine follow-up; all three runners also pass `personas: []`. Ship today ⇒ four cells + a heading.
7. Smaller: door has only one state (Simulate is a one-way trip); `display:none` on the brief's
   contents at 342 is the last special-case; script timeline rules cut its own rail; Save lost its
   label; chevron promises a drill-in and delivers a new tab.

### 9.2 v9.4 — the seven moves

**The core one:** an 8-word hook at 22px cannot fill a 688px column. Don't narrow the card — **set
the hero at 32px (21px at 342)**. Then: rank + one taxonomy chip per card (`visualHook.technique` /
`format`, both already populated — no engine work) · brief becomes a 2-col map (1-col at 342, sixth
cell folds under 480px) · every right edge named (`Open on TikTok ↗`) · door gets three states
(untested / testing / `8 of 10 stopped · See your audience →`, which also settles the legacy-door
question in §7) · honest multiplier + fit glyph back · footer groups [primary + Save] · [door].

### 9.3 Measured — ALL numbers re-verified two ways

⚠️ **Trap that cost real accuracy here:** the sketches animate `.stage{transition:width .18s}`. A
measure routine that flips `data-w` and reads `getBoundingClientRect` **in the same frame** reads the
stage mid-transition and **understates every 342 number** (script read 958 when it is 1359). Both
artifacts now add a `.measuring` class that kills the transition, force a reflow, and were
cross-checked headlessly with a 600ms settle — the two methods agree exactly.

| Card | Shipped 728/342 | v9.2b | v9.4 |
|---|---|---|---|
| Hook | 569 / 697 | 371 / 436 | 424 / 465 |
| Hook, brief open | — | 670 / 843 | 649 / 866 |
| Idea | 606 / 752 | 371 / 433 | 445 / 486 |
| Hook, no source | — | 254 / 319 | 306 / 347 |
| Script | 958 / 1420 | 830 / 1308 | 852 / 1359 |
| Remix | 763 / 1054 | 708 / 1159 | 686 / **1110** |

**v9.4 buys legibility with height** — it is taller than v9.2b nearly everywhere (+29…+74), and far
shorter than shipped on the choice cards (−232 / −266 at 342). **Remix @342 still sits 56px above
shipped**; neither v9.2b nor v9.4 closes that. Levers if mobile height binds: the map's cell count
and the script's per-beat retention line.

### 9.4 Still the owner's call

- Which width theory (v9.4's big hero is the recommendation; the audit's B/C/D are the alternatives —
  **C, the fact rail, costs +137px on mobile and brushes the v7 genealogy**).
- Does the "Made for" cell ship gated behind `reaction_frame`, or degrade to four cells?
- Is `vs followers` the wording users should read, or `90.7× this creator's follower count`?

### 9.5 ⚠️ The compare harness — PARKED OUTSIDE THE REPO 2026-08-07, never commit it

`src/app/zz-preview/page.tsx` (real renderers beside the v9.4 mock, width toggle, iframes self-report
their height via `postMessage`) and `public/zz-v94-cards.html` (the v9.4 cards, `?card=&w=`) exist
only to compare shipped vs mock. **Both must stay out of git** — `zz-preview` is a real Next.js route
(it builds as `○ /zz-preview`) and `public/` is served publicly, so committing either ships a dev
harness to production. The zero-`src/`-changes lock in §Status also depends on it.

They lived untracked in the `~/virtuna-slot-a` worktree, which was retired 2026-08-07. Copied to
**`~/virtuna-parked/skill-cards-harness/`** (`zz-preview/`, `zz-v94-cards.html`, `zz-shoot.js`)
before removal. To use them again: copy back into a worktree, `npm run dev -- --port 3001` →
http://localhost:3001/zz-preview, then delete them again before you commit anything.

The 12 `.planning/sketches/skill-cards-*.html` referenced above ARE now committed (same retirement)
— they had been untracked and existed nowhere else, so §9's paths above resolve from git now.
The ~23MB `zz-shots/` capture output was discarded; nothing referenced it.
