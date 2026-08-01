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
