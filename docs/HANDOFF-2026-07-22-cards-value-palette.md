# Handoff — Cards value+info pass + Test-calm palette (→ next: loading states)

**Date:** 2026-07-22 · **Branch:** `lane/skill-cards-prod` · **Status:** shipped + merged, green.
**Merged:** PR **#358** → `main` (merge commit `1e1e49a9`; feature commit `ec68f7c6`). Lane
fast-forwarded to `origin/main`, clean.
**Next session:** owner will work on **LOADING STATES** and hand fresh feedback in. See §4.

Design SSOT = `src/app/globals.css` (`@theme`) — accent coral `#FF6363`, card fill `#1a1a19`
(`--color-surface-sunken`), Newsreader `--font-serif`, sage `--color-positive #8ea68a`. The
`docs/DESIGN-SYSTEM.md` doc is STALE — don't trust it.

---

## 1. What shipped (PR #358, one commit `ec68f7c6`)

Two owner-driven passes. **Fixture-first** — every new schema field is OPTIONAL + nullable, so
production runs (which don't emit them yet) render byte-identical to before. Runner wiring is a
**deferred follow-up** (see §3).

### Pass 1 — value + information on the Make cards
- **Hook** (`hook-card-block.tsx`) — a **Visual hook** row under the serif spoken hook: the
  first-frame *technique* as a chip (`crash-zoom`) + what's literally on screen at 0s. Grounded
  in the real Sandcastles first-frame-technique taxonomy (`src/lib/grounding/corpus.ts:279–316`).
  New optional schema `visualHook: { technique, onScreen }`.
- **Script** (`script-card-block.tsx`) — the big value add:
  - per-beat 📹 **filming cue** under each beat's content (camera/framing · b-roll/on-screen ·
    delivery), visible by default; `retentionMarker` stays on the caret.
  - a **topic · format** meta line beside the beat count.
  - a consolidated **"How to film"** foot block (shots · on-screen text · setup · edit).
  - New optional: per-beat `filming` + card-level `production{shots,onScreenText,setup,edit}` +
    `topic`/`format`.
- **Idea** (`idea-card-block.tsx`) — a "Make it from" header framing the Topic·Take·Format strip.
- **Topic/format placement reviewed:** Idea (had all 3, elevated) · Script (**added**) · Remix
  (`formatBorrowed` fits, topic doesn't — source-derived) · Hook (visual hook + `channel` cover it).

### Pass 2 — palette + explore + remix
- **Band palette → Test's calm system.** ONE edit: `BAND_COLOR` in
  `src/components/thread/band-block.tsx`:
  - `Strong`: `--color-success` (bright green) → **`--color-positive`** (sage `#8ea68a`)
  - `Mixed`: `--color-warning` (amber) — unchanged
  - `Weak`: `--color-error` (bright red) → **`--color-accent-text`** (`#ff8080` soft coral)
  Because the band dot+word is the ONLY colored element on each Make card, this one map recolors
  **every band surface at once** — all 4 Make cards + Flash/Max reads (`band-block`) +
  reaction-distribution + prediction-gauge. Everything converges on the Test card's restraint
  (owner: "test has a calmer vibe"). The Test card itself uses these tokens already (unaffected).
- **Explore headline moved OUT of the card** (`explore-thread-view.tsx`). The
  "N outliers, scored for your audience" line (`resultHero`) now renders as a sibling ABOVE a
  header-less `<SkillResultCard>` (under the `Maven` eyebrow, `gap-3`); the bordered grid holds
  only tiles. `SkillResultCard` still accepts `hero` (unused here now).
- **Remix radical reimagining** (`remix-card-block.tsx`) — rebuilt as a **THE ORIGINAL → YOUR
  VERSION** two-column map (`grid-cols-1 sm:grid-cols-2`, local `MapCell` helper): Hook
  (`hookPattern` → serif `adaptedHook` + Copy) · The turn (`theTurn` → `angle`) · Format
  (`formatBorrowed` → `production.shots`), a "Built for {whoItsFor}" caption, then a **"How to
  film your version"** production block. Structure + emotional beat stay on the expand. New
  optional schema `production{shots,onScreenText,setup,edit}` (mirrors the script).

### Schema + fixtures
- `src/lib/tools/blocks.ts` — added the optional fields above to `HookCardBlockSchema`,
  `ScriptCardBlockSchema`, `RemixCardBlockSchema`.
- `src/app/(app)/dev/cards/fixtures.ts` — sample data: `visualHook` on Hook #1 (omitted on #2 to
  preview the honest-absent state), `filming`/`production`/`topic`/`format` on the Script,
  `production` on the Remix.

---

## 2. Verification (all green)
- **tsc 0 · eslint 0.**
- **thread + discover 303/303** — `node ./node_modules/vitest/vitest.mjs run
  src/components/thread/__tests__ src/components/discover/__tests__`. Includes **6 new** guards in
  `make-card-value-fields.test.tsx` (visual-hook present/absent, per-beat filming, How-to-film,
  topic·format) + the palette-consuming prediction-gauge / reaction-distribution suites.
- Live-shot every card on `/dev/cards → Skills`. Screenshots this session: `.scratch/*.png`
  (gitignored).

---

## 3. Deferred / open (not blocking)
1. **Runner wiring** — `hooks-runner.ts` (visualHook), `script-runner.ts` (filming/production/
   topic/format), `remix-runner.ts` + `adapt.ts` (production). Until wired, the new fields are
   inert in prod (optional → absent → today's render). No fabricated data ships meanwhile.
2. **Remix map redundancy** — the map's "Your shots" cell and the "How to film → Shots" row show
   the same text (fixture). Reads as glance-vs-full-plan; make the map cell a shorter summary if
   the owner dislikes it.
3. **Explore tile fit-dots** (STRONG/FAIR/WEAK on the outlier tiles) use a SEPARATE fit-color
   system, NOT `BAND_COLOR` — so they stayed bright. Unify to sage only if the owner asks.

---

## 4. NEXT SESSION — LOADING STATES (start here)

The owner wants to work on **loading states** and will give feedback in the fresh session.
**Open & WAIT** for their feedback, one at a time (the flow that worked). Don't auto-plan/edit.

**Where they render — `/dev/cards` has a dedicated `Loading` tab** (the real preview surface,
alongside the `Skills` tab). Preview entries live in
`src/app/(app)/dev/cards/page.tsx` (~line 616+): `loading-hooks`, `loading-chat-dispatch`,
`loading-field-test`, `loading-scoring-card`, plus the Reading skeleton states (`loading`,
`loading-source`, `loading-frames`).

**The loading components (candidates for the work):**
- `src/components/thread/run-capsule.tsx` — the in-thread **run spine** (SkillProgress): full
  pipeline seeded up front while streaming, collapsing to a receipt line on completion. This is
  what shows while a skill generates (hooks/ideas/script/remix/explore all use it).
- `src/components/thread/progress-checklist.tsx` — the 3-step plan checklist.
- `src/components/thread/thread-loading.tsx` — thread-level loading.
- `src/components/reading/reading-skeleton.tsx` — the `/analyze` Reading skeleton (source →
  frames → scoring).
- `src/app/(app)/analyze/[id]/result-card-skeleton.tsx` — analyze result skeleton.
- `src/components/ui/skeleton.tsx` — the base skeleton primitive.
- Per-route `src/app/(app)/**/loading.tsx` — home, discover, library, feed, audience, competitors.
- `src/components/primitives/GlassProgress.tsx`, `src/components/app/card-progress-dots.tsx`.

**Prior art / memory:** `loading-states-evidence` (#295), `loading-states-premium`. The design
lever is the same as the cards: matte, calm, near-zero accent — now with the **sage** band
palette this session established. Any skeleton/spinner should feel like the Test card's restraint,
not a loud shimmer.

**Guards to keep green when touching these:** `progress-checklist.test.tsx`, and the same
`radius-scale` / `section-label-scale` / `card-surface-consistency` token guards.

---

## 5. Runtime
- Dev server **:3011** `--turbopack`. ⚠️ **16 GB machine runs 3 parallel worktree dev servers →
  ~2 GB into swap → OOM-cycles.** The `--max-old-space-size` cap does NOT reach the `next-server`
  worker and can't bound turbopack's native RSS anyway; the real lever is fewer hot servers.
  Relaunch (per memory `dev-server-launch`): direct-node, Python `os.fork()`+`setsid`, warm with
  a `curl` before Playwright. Screenshots hang on ambient animations → raw Playwright with
  `@playwright/test` import + `animations:'disabled'` (scripts in `.scratch/`).
- `/dev/cards` auth-gated (307). Test user `e2e-test@virtuna.local` / `e2e-test-password-2026`.
  Click the **Loading** tab (or **Skills**) after login — cards mount on tab activation.

Related memory: `skill-cards-prod-lane`, `test-vs-simulation-split`, `design-system-current`,
`corpus-two-visual-hook-axes`, `dev-server-launch`, `loading-states-evidence`, `loading-states-premium`.
