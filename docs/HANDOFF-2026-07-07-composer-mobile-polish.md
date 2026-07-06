# Handoff — Composer + mobile ambient-audience polish (2026-07-07)

Worktree: `~/virtuna-explore-a` (branch `lane/explore-a`). Dev server: `:3001`.
Merged to `main` via PR (this doc ships with it). Resume from `lane/explore-a` after
syncing to `origin/main`.

## What shipped

Redesigned the `/home` composer to the Claude/Perplexity two-row pattern and optimized
the mobile ambient-audience cap. All changes are `/home` empty-state + composer + the
audience presence peek — no engine/skill logic touched.

### Composer (`src/components/app/home/composer.tsx`)
- **Bottom-pinned on empty home** (desktop + mobile): the greeting centers in a `flex-1`
  hero region above; the composer dock is the `shrink-0` bottom of the column. Starter
  chips (Test / Profile / Predict) render as a suggestion row **above** the composer.
- **Two-row layout**: the textarea owns the full-width top row (`min-h-[46px]`,
  `text-[15px]`); controls sit on a bottom row — verb chip left, attach + send right.
- **Send button**: forced `boxShadow:none` inline so the primary variant's dark
  `--shadow-button` 2px ring can't render as a border → clean cream disc (Claude-style),
  40px `rounded-xl`.
- **Attach**: paperclip → **Plus** icon (`lucide` `Plus`, `h-5`), 40px hit target.
- Dock: `rounded-[22px]`, border `white/[0.08]`.

### Composer controls (`src/components/app/home/composer-controls.tsx`)
- Skill/verb chip: fixed `h-[38px]`, `bg-surface` (darker than the dock so it reads as a
  distinct control), and a proper `focus-visible` ring (replaces the browser's default
  blue outline that made it look "off").

### Home layout (`src/components/app/home/home-page-layout.tsx`)
- Empty state: greeting in `flex-1 justify-center`, composer pinned bottom.

### Ambient audience (`src/components/audience-lens/audience-presence.tsx`)
- **Mobile switcher is now discoverable**: the audience name is a **bordered chip with a
  caret** (`General ⌄`) → obviously tappable to switch (was an invisible affordance).
- **Killed the duplicated name**: the peek caption dropped the `{name} ·` prefix (it was
  showing `Fitness Creators … Fitness Cr…` truncated). Dock uses a **compact** readiness
  (`dockPulse` → "10 ready" / live "6 of 10 would stop"); the desktop rail uses the fuller
  `peekPulse` ("10 personas ready"). Name lives only in the switcher chip now.
- Constellation mark tightened to 44px in the dock cap; divider removed.

## Verification
- `tsc --noEmit`: **0 errors**.
- Tests: **120 passing** (`audience-presence` + all `app/home/__tests__`). Test copy for
  the audience captions updated to the new compact/name-less strings.
- Desktop + mobile screenshots (logged in as the E2E user on `:3001`) confirm: clean send,
  Plus icon, bordered/caret audience chip, "N ready" caption, bottom-pinned two-row composer.

## Env fix folded in (was a live blocker)
`@upstash/ratelimit` + `@upstash/redis` are declared in `package.json` (exact-pinned) but
were **not installed** in this worktree's `node_modules` → navigating `/home` compiled
`/api/tools/profile` → `src/lib/http/rate-limit.ts` and threw a Turbopack **Build Error**
overlay. Fix: `pnpm install` synced `node_modules` (added both `@upstash/*`, and corrected
`recharts` 3.7.0 → **3.9.1**, the version `package.json` pins). If the build error returns
in a fresh worktree, run `pnpm install`.

## Resume tomorrow (from `~/virtuna-explore-a`)
1. `git fetch origin && git checkout lane/explore-a && git reset --hard origin/main`
   (this work is in `main`; the old auto-wip commit `40b0e750` is superseded — discard it).
2. `pnpm install` (ensures `@upstash/*` + recharts are present).
3. Dev server: `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack`
   (npx wrapper breaks dev; port 3000 may be taken by the `explore-b` worktree → uses 3001).

## Possible next polish (owner-gated, not done)
- Tone down the audience chip's terracotta accent dot if it reads too loud.
- Composer box height / chip styling fine-tuning toward the Claude/Perplexity feel.
- The audience switcher chip is now consistent dock vs rail — could unify the two render
  paths further if it drifts.
