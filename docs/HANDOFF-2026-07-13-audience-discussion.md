# Handoff — /audience redesign (DISCUSSION FIRST, do not execute)

**Date:** 2026-07-13
**Worktree:** `~/virtuna-explore-b` · **Dev server:** `:3002`
**Status of everything else:** shipped or in PR #278 (below).

> ## ⛔ READ THIS FIRST
> **This session is for DISCUSSION, not execution.** The owner (Davide) explicitly wants to talk
> through every change to `/audience` *before* any code is written. Do NOT open files and start
> editing. Do NOT create a branch. Do NOT "just do the easy parts."
>
> Your job: understand the surface, bring options, ask the questions below, and converge on a
> spec with the owner. Only after he says "build it" does anything get written.
>
> Context for why this matters: a previous unsupervised agent session shipped four PRs that got
> **reverted as a batch** because the owner didn't like the result. Trust is the constraint here.
> Slow down.

---

## 1 · Where the project stands (read before anything)

The four surfaces (Calendar · Discover · Audience · Library) were audited on 2026-07-13. Full
audit — systemic issues, per-page findings, prioritized P0→P2 roadmap, evidence screenshots:

**`docs/audit-2026-07-13/AUDIT-calendar-discover-audience-library.md`** ← read this
**`docs/audit-2026-07-13/screenshots/audit-audience-01.png`** ← the surface you're redesigning
**`docs/audit-2026-07-13/screenshots/audit-audience-account-01.png`** ← its second tab

### The thesis of the audit (applies to /audience too)
These surfaces read as "AI-produced" for three reasons, and the cure is mostly **subtraction**:
1. **The app narrates itself** — marketing subtitles, instructional microcopy, "Why —" lines.
2. **Copy repeats** — the same reassurance stamped 3–4× per screen.
3. **Internal taxonomy leaks into the UI** — the user is made to learn the data model.

### Roadmap bands
- **P0 — copy & bug hygiene** (pure subtraction + 2 bug fixes) → ✅ done
- **P1 — hierarchy & density** (layout craft) → ✅ Calendar, Discover, Library done. **❌ Audience = the last one. That's this session.**
- **P2 — system-level** (needs owner direction) → not started. See §5; it partly overlaps Audience.

### Git state
| Thing | State |
|---|---|
| PRs #273/#274/#275/#276 | Merged, then **reverted as a batch** by the owner. |
| **PR #278** `fix/restore-ui-work` | **OPEN.** Restores all four (3 were sound; fixed the 1 real defect — an orphaned metric legend in the Discover toolbar). Carries the audit doc + screenshots. |
| `main` | Still has the reverts → **none of the UI work is live until #278 merges.** |

**If #278 hasn't merged yet, mention it — it's ~1,700 lines of verified work sitting idle.**

---

## 2 · What `/audience` actually is

Route `/audience` → `src/app/(app)/audience/page.tsx` → `AudienceManager`. Two tabs:
- **Audiences** (the roster) ← the redesign target
- **Your account** (folded-in analytics; `analytics-view.tsx`) ← mostly fine after P0

**Files:**
| File | Owns |
|---|---|
| `src/components/audience/audience-manager.tsx` | Container: header, tabs, sections, right rail |
| `src/components/audience/audience-card.tsx` | One roster row: avatar cluster + name + meta + pills |
| `src/components/audience/audience-status-chip.tsx` | The **calibration** pill |
| `src/components/audience/trust-badge.tsx` | The **trust** pill |
| `src/components/audience/audience-display.ts` | `CalibrationStatus` type |
| `src/lib/audience/resolve-tier.ts` | `resolveTier()` → `TrustTier` |

Product weight: this is described in-repo as **"the MOAT surface"** — the calibrated audience is
the shared substrate every Read/hook/remix is scored against. Treat it as load-bearing, not decoration.

---

## 3 · The three problems (what the audit found)

### 3a · Placeholder-grade avatars — *the most "unfinished" thing on the page*
Each audience row leads with a **scatter of grey dots**, inconsistent in count and size. They
communicate nothing and read as a placeholder nobody returned to. On a page whose whole job is
"here are the people who watch you," the mark representing those people is empty.

### 3b · The two pills look like one confused taxonomy — **⚠️ IMPORTANT CORRECTION**
The audit originally said: *"collapse the 6-term pill vocabulary (Validated · Calibrated · Needs
calibration · Baseline · Template · Directional) to ≤2 meanings."*

**That framing was wrong, and the next session must not inherit it.** Reading the code, there are
already exactly **two orthogonal axes** — the problem is they're rendered with the *identical*
`Badge` primitive at the same size, side by side, so the user can't tell they're different kinds
of information:

| Axis | Component | Values | Meaning |
|---|---|---|---|
| **Trust tier** | `trust-badge.tsx` ← `resolveTier()` | `Validated` · `Directional` | Is the prediction *backed*, or inferred? Hard rule: **General can never be Validated** (T-03-11). |
| **Calibration status** | `audience-status-chip.tsx` | `Baseline` · `Template` · `Limited data` · `Calibrated` · `Needs calibration` | Where did this audience come from / how real is its data? |

So the fix is probably **not** "fewer terms." It's: *make the two axes visually distinct* (different
form, weight, or position) so the row reads as two facts instead of one muddle — and/or surface only
the one that's actionable.

**This is a truth-claim about your product's honesty spine.** `Validated` vs `Directional` is a
statement about whether data is real. Flatten it carelessly and you quietly break the credibility
story the whole product rests on. **Do not collapse these without an explicit owner decision.**

### 3c · Scaffolding outweighs content
Four section headers — **YOURS · BASELINE · TEMPLATES · GENERAL TEMPLATES** — for ~6 rows.
Plus cryptic per-row metadata that reads like internal debug output:
`personas modeled · receipts pending` · `warm-heavy` · `Fitness 25% · Learner 20%`.

---

## 4 · Questions to put to the owner (the agenda for this session)

**On the avatars (3a):**
1. What *should* an audience look like? Real persona faces/photos? Initials? An abstract designed mark? A count?
2. Do we have real persona data to render (names? attributes?), or is an abstract mark the only honest option?
3. Should the avatar encode anything (size = audience size? tone = trust tier?), or be purely identity?

**On the pills (3b):**
4. Are both axes worth showing on the roster at all — or does one belong only on the audience *detail* view?
5. If both stay: how do we make "trust" and "calibration" read as two different kinds of fact? (different shape? one as a pill, one as text? colour reserved for the actionable one?)
6. `Needs calibration` is the only **actionable** state. Should it be the *only* thing that gets visual weight, with everything else quiet?

**On the sections (3c):**
7. Do templates belong on this page at all, or behind a "New audience" flow?
8. Can YOURS / BASELINE / TEMPLATES / GENERAL TEMPLATES collapse to 2 groups (e.g. *Yours* + *Start from*)?
9. Which row metadata is real signal vs. debug output that should just go?

**On vocabulary (P2, but it lands here):**
10. This one page calls the same concept an **audience**, a **room**, a **persona**, and a **panel** — sometimes in one viewport. Pick one noun. This is a P2 decision but it *blocks* good copy on this surface.

**Recommended method:** don't argue in the abstract — build **2–3 throwaway HTML mockups** of the
row (avatar + pill treatments), let the owner pick, *then* write real code. There's a `/gsd-sketch`
skill for exactly this, and `/dev/cards` is the in-repo precedent for a visual workbench.

---

## 5 · Constraints that bind any proposal

- **Honesty spine — non-negotiable.** This app never shows fabricated data. Empty states are honest
  ("not enough history yet"), never faked. Any avatar/pill design must not imply data we don't have.
- **Design system SSOT:** `src/app/globals.css` (`@theme`) + `docs/DESIGN-SYSTEM.md`.
  ⚠️ `BRAND-BIBLE.md`, `docs/tokens.md`, `docs/components.md` are **STALE** (dead Raycast system) — do not trust them.
  System = flat-warm charcoal, cream text `#ece7de` (never `#fff`), terracotta accent `#d97757`
  at **near-zero dosage (liveness only)**, matte — no glass, no glow, no inset-shine.
- **Reuse the `Badge` primitive** (`components/ui/badge`) rather than inventing a new visual language.
- **Guard:** `reskin-matte` test fails on any coral/glass. Keep it green.

---

## 6 · How to run & verify

```bash
# dev server (from ~/virtuna-explore-b)
NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3002
# CSS not updating? kill it, rm -rf .next node_modules/.cache, restart.
```
**Auth:** `npx tsx e2e/create-test-user.ts` → log in at `/login` with
`e2e-test@virtuna.local` / `e2e-test-password-2026`.
Has a calibrated **"Fitness Creators"** audience + a `test` audience → the roster is populated. 

**Routes:** `/audience` · `/audience?tab=account`

**Screenshots hang on this app** (ambient animations never settle). Inject before capturing:
```js
const s=document.createElement('style');
s.textContent=`*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;}`;
document.head.appendChild(s);
```

**Green-gates (before ANY commit, if we get that far):**
```bash
npx tsc --noEmit                     # must be 0
npx eslint <changed files>           # must be clean
node ./node_modules/vitest/vitest.mjs run src/components/reading/__tests__/reskin-matte.test.ts   # 38/38
```
⚠️ **Never `npm test` / `npx vitest`** — a shim prints fake results. Always the explicit binary above.

---

## 7 · Gotchas that will bite you
- `cn()` = `twMerge(clsx(...))` → later conflicting Tailwind classes win.
- Tailwind v4: `--font-*` is the font-**family** namespace. Declaring weight tokens there silently
  flattens every font weight app-wide. Use the built-in `font-medium/semibold/bold`.
- Lightning CSS strips `backdrop-filter` → apply via inline `style={{}}`, not a class.
- Auto-push hook only fires if the branch has an upstream → after `git switch -c x`, run
  `git push -u origin x` once, and **verify with `git ls-remote`** (it can silent-fail on non-FF).
- Lane convention: audience/room = "lane a". This worktree is explore-b. Coordinate if lane a is active.
- A real bug shipped in my calendar work because `lead` is an **array**, not a number — `lead + day`
  string-concatenated to `NaN` and the feature silently didn't run, while the screenshot still looked
  fine. **Verify behaviour, not just appearance.**

---

## 8 · Definition of done for THIS session
A written spec the owner has agreed to, covering: the avatar treatment, the two-axis pill treatment,
the section structure, and the vocabulary choice. **No code.** Execution is a separate session.
