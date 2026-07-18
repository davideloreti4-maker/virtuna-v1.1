# Handoff — Make-Card Polish (flagship craft sweep, cont'd)

**Date:** 2026-07-18
**Shipped this session:** PR **#329** — squash-merged to `main` as **`dc8438b2`**. Branch deleted.
**Predecessor:** Reading (Test) redesign shipped #327; this session carried that craft language to the four **Make** cards. See `docs/HANDOFF-2026-07-18-card-polish-sweep.md` for the Reading pass.

---

## TL;DR for the next session

1. The Make cards (**hook / idea / script / remix**) were not broken — the gap was flagship *craft* (boxes-within-boxes). This pass gives every Make card **one focal frame**; everything subordinate reads borderless. Same language as Reading #327.
2. Two things shipped in #329: **(a)** the shared reaction unit + Script's beat rows de-boxed, **(b)** the sparse Remix receipt tightened to a compact chip.
3. **Explore was left alone** — the audit found it already the strongest surface. Don't rework it without a reason.
4. Only **one** follow-up remains and it's **low value** — see "Deferred" below. The visible craft work on the Make cards is done.

---

## What shipped in #329

### 1 — De-box the reaction row + Script beats (`fd4314cf`)

Audit verdict (real renderer, desktop + mobile 390px), worst → best:
- **Script** — worst: **seven** bordered boxes inside the card (receipt + reaction + five individual beat boxes = spec-sheet).
- **Hook / Idea / Remix** — same shared gap, milder: two bordered sub-panels (`ProofReceipt` + `ProofUnit`) nested in the card border.
- **Explore** — strongest, left untouched.

The lever: `ProofUnit` (the "Strong · N/10 · See the room" reaction block) is **shared** by all four Make cards. De-boxing it rolls everywhere.

- **`proof-unit.tsx`** — new **`framed` prop (default `true` — unchanged everywhere else)**. `framed={false}` drops the border+fill to a borderless reaction row; keeps the 44px tap target + an inset hover for feedback (`-mx-2 px-2` keeps the content column aligned to the card's 16px edge).
- **`script-card-block.tsx`** — `framed={false}` + the five bordered beat rows → borderless, hairline-separated rows (`border-b last:border-b-0`) aligned to the card edge. **Seven inner boxes → one** (the receipt).
- **`hook` / `idea` / `remix-card-block.tsx`** — one-line `framed={false}` each. The receipt is now the single inner frame; each card goes **three container levels → two**.

Calibrated on Script FIRST (owner locked "Variant A — quiet" from ASCII previews), rendered it, then rolled the one-line change to the other three.

### 2 — Compact Remix receipt (`52fe49b5`)

The shared `ProofReceipt` renders **full-width** so the grounded cards' `[templated]` hook fills the bar. Remix's receipt is **sparse** (handle + views only — null multiplier, no template), so that full-width bar sat mostly empty on the right with a tall 9:16 thumbnail towering over three short rows.

- **`proof-receipt.tsx`** — new **`compact` prop (default `false` — grounded receipts unchanged)**. `compact` = `inline-flex` chip that hugs its content with a **square** thumbnail (`aspect-square` vs the grounded `aspect-[9/16]`). Remix passes `compact`.
- Measured **694×134 → 267×86px** (via `.scratch/measure.mjs`). No empty bleed; still the card's single inner frame.

**Verified:** `tsc` clean; **264** thread / `reskin-matte` / `section-label-scale` / `radius-scale` tests green; every card rendered desktop + mobile; grounded receipts confirmed unchanged.

---

## The reusable pattern (for the next surface)

1. **Calibration-first.** Audit through the real renderer, rank the craft gap, rework the WORST surface first, render it, lock a direction with the owner, THEN roll the language out. Don't blast N cards on a guess.
2. **Scope the shared lever with a default-off prop.** `framed` on `ProofUnit`, `compact` on `ProofReceipt` — both default to the old behaviour so the change is opt-in per card and the roll-out is one line each. This is how you calibrate on one card without touching the others.
3. **One focal frame per card.** A chat card SHOULD have its outer container, but everything inside should prefer whitespace + hairlines over nested boxes. Reserve green/amber to meaning (the band word).
4. **Measure, don't eyeball.** A screenshot made the compact receipt *look* like it still had empty space; `getBoundingClientRect` showed it was already 94px, not tall. When a visual judgement is ambiguous, measure the DOM.

---

## The harness (`.scratch/`, gitignored)

- **`.scratch/shoot.mjs`** — logs in (`e2e-test@virtuna.local` / `e2e-test-password-2026`) → `/dev/cards` → screenshots each `<section id>` at desktop 1280 + mobile 390. Env knobs: `SECTIONS=script,hooks` (scope), `SUFFIX=-before` (tag), `SCALE=1` (lighter files). Sections: `ideas` (NOTE: id is `ideas`, not `idea`), `hooks`, `script`, `remix`, `explore`.
- **`.scratch/measure.mjs`** — `getBoundingClientRect` on the remix receipt (adapt the selector for other elements). Facts over eyeballing.
- **`.scratch/card-preview.html`** + `card-preview-template.html` — the before/after Artifact builder (python inlines the PNGs as data URIs). Published at the artifact URL below.
- Raw Playwright + Chromium live at `~/virtuna-brain/node_modules/playwright`. Screenshots use `reducedMotion:'reduce'` + `animations:'disabled'` (the MCP screenshot hangs on this app's ambient rooms).
- ⚠️ **Dev server gotcha:** launching the dev server via `nohup … &` inside a Bash tool call **did not survive between tool calls** (it got terminated). Launch it with the Bash tool's `run_in_background: true` instead — that stays up across turns. Command: `NODE_OPTIONS='--max-old-space-size=3072' node node_modules/next/dist/bin/next dev --turbopack -p 3000`. This worktree = **:3000**.

**Before/after preview Artifact:** https://claude.ai/code/artifact/23500375-8939-4e18-8174-654c96dcfa73

---

## Deferred — one item, low value

**`card-primitives.tsx` extracted-but-UNUSED.** `CardEyebrow` / `CardPrimaryAction` / `CardActionBar` exist (extracted during the earlier #324 sweep) but all four Make cards still hand-roll their eyebrow + cream primary button inline. Adopting the primitives is an **invisible** refactor — no pixel changes, real behaviour-parity risk across four files, zero craft payoff. **Recommendation: leave it** until someone actually needs to touch those primitives.

---

## Where to go next
- The Make + Reading surfaces are now at the flagship bar. If the sweep continues, pick the next surface the owner names, run the same calibration loop (audit → worst-first → render → lock → roll).
- ⚠️ **Account Read** (`account-read-block.tsx` / `account-read-thread-view.tsx`) was owned by a parallel session this whole sweep — coordinate before touching it.
