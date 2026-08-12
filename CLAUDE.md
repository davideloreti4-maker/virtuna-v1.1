# Virtuna — Project Instructions

## Identity

- **Stack:** Next.js 15, TypeScript, Tailwind v4, Supabase. Deployed on Vercel.
- **Repo:** https://github.com/davideloreti4-maker/virtuna-v1.1
- **Setup after clone:** `git config core.hooksPath .githooks`

## Design system — flat-warm charcoal

**SSOT: `src/app/globals.css` (`@theme`) + `docs/DESIGN-SYSTEM.md`.** This is a summary; when
it disagrees with `globals.css`, measure and trust the CSS.
⚠️ `BRAND-BIBLE.md`, `docs/tokens.md`, `docs/components.md` are STALE (dead Raycast system).

- Flat-warm charcoal + cream text + coral-red accent, **matte** — no glass, no glow, no inset-shine
- bg `#1f1f1e` (`--color-charcoal-app`) · chrome/composer `#1a1a19` · chip+sidebar `#2c2c2b` ·
  thread card `#252524`
- text cream `#ece7de` / `#c2bdb4` / `#8a857c` — **never `#fff`**
- accent coral-red `#FF6363` (`--color-accent`). Never the retired `#FF7F50`, never terracotta
  `#d97757`. ⚠️ `--color-coral-*` and `--color-signal-*` are **dead primitives** — their inline
  comments still claim to be the brand accent. They are not. Use `--color-accent`.
- Borders 6% (`white/[0.06]`), hover 10%. Radius 4/6/8/12/16/20/24 — cards 12, inputs/buttons 8
- Inter for chrome; Newsreader serif for voice-moments only (greeting/hero)

### 🔒 Accent dosage (LOCKED 2026-06-24) — read this before adding any colour

**Monochrome by default. Default = NO accent.** The UI is cream-on-charcoal; colour is not a
styling tool. A screen with **zero** accent is the norm, not a failure. Aim for **at most one**
accent element visible at a time; often zero. This near-zero dosage — not the hue — is what
separates this product from Claude's terracotta-everywhere look.

Every accent use must be justified by a specific high-meaning reason. If you can't name it, it
gets none. **Never** on buttons, chrome, charts, or "to make it pop."
**Primary actions are neutral cream** (`--color-action`), not accent.
Sanctioned uses only: the single live-presence dot, the lit constellation/SIM node, the brand mark.

### Guards — keep green

- `src/app/__tests__/design-token-drift.test.ts` — asserts every colour row in
  `docs/DESIGN-SYSTEM.md` matches `globals.css`. **Never hand-edit a token value in the docs**;
  change the CSS and let the guard tell you which row to update. (Five rows had silently drifted
  and misled live design sessions twice before this guard existed.)
- `reading/__tests__/reskin-matte.test.ts` — bans the *legacy* coral + glass/glow. It does not
  ban the current `#FF6363`.

## Known technical issues

- **Tailwind v4 oklch:** very dark colors (L < 0.15) compile wrong in `@theme`. Use exact hex.
- **Tailwind v4 `--font-*` is the font-FAMILY namespace — never put weights there.** `--font-medium: 500`
  generates `.font-medium { font-family: 500 }`, shadowing the built-in weight utility. This flattened
  every weight in the app to 400 (616 usages / 223 files) until `c22cdf82`. Don't declare weight tokens —
  the built-in `font-{medium,semibold,bold}` already work.
- **Lightning CSS strips `backdrop-filter`:** apply via React inline styles, not CSS classes.
- **`--color-hover` is an overlay tint, not a fill** (`rgba(255,255,255,0.05)`). As `hover:bg-*` on
  anything floating over scrolling content it replaces the opaque fill and content shows through.
  Use a solid tone in the composer dock.
- **CSS changes not appearing:** kill dev server, clear `.next/` + `node_modules/.cache/` + browser cache.
- **Playwright screenshots hang here:** ambient-room animations never settle. Use raw Playwright with
  `animations: 'disabled'` + `caret: 'hide'` + a tight `clip`, or assert via `getComputedStyle`.

## Worktrees

`~/virtuna-v1.1/` IS the repository; every sibling folder is a worktree on the same `.git`.
A commit in one is instantly visible to all. Removing a worktree folder keeps its branch + commits.

- **Trunk never holds a long-lived branch.** Multi-session work → its own worktree + branch.
  Quick fix → `git switch -c fix/<thing>` in trunk, PR + merge + delete the same session.
- **Check `git worktree list` and your branch before starting.**
- **Read refs with `git rev-parse`, never `git log --oneline`** — it omits merge commits here, so
  `main` displays as the last squashed commit while HEAD is really the merge above it.
- **`main` moves while you work.** Re-check `git rev-list --count HEAD..main` before opening a PR.
- **Is a branch dead?** `git cherry -v main <branch>` (patch-id; `-` = already in main). Three-dot
  and two-dot `git diff` both lie about this.
- **A new worktree needs its own `npm install` and its own `.env.local`** — neither is shared.
  ⚠️ `git worktree remove` deletes gitignored files, `.env.local` included. Copy it out first.
- **One dev server per port.** Check `lsof -ti:3000`, pass `--port 300X`.
- Historical inventory + superseded-branch warnings: `docs/WORKTREE-INVENTORY-ARCHIVE.md` (stale, read the header).

## Conventions

- Server components by default, client only when interactive
- Commit format: `type(scope): description`
- Merging a PR deploys to production (~4 min). Run tsc + build + tests before pushing, not after.
- A green Vercel check is not a build — `ignoreCommand` can skip and still post success. Run `tsc` yourself.
