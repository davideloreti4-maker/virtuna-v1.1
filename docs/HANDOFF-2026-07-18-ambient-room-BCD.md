# HANDOFF — Ambient room · P2 cleanups (B → C → D), 2026-07-18

Fresh-session handoff. **P2 PLACEMENT IS DONE + SHIPPED** (the re-parent). What remains are three
copy/mode cleanups. Full history: `docs/HANDOFF-2026-07-17-ambient-room-redesign.md` (§4 = P2 status).
Memory: `ambient-room-redesign.md`.

## Where to work
- Worktree `~/virtuna-ambient-room` · branch `milestone/ambient-room-v2` (clean, pushed to origin).
- Dev server **:3002**. Real `pnpm install` here → Turbopack runs clean; keep it that way.
- Launch the server detached (survives foreground commands): `node .scratch/start-dev.cjs` then poll
  `curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/`.

## THE STANDING RULE (do not skip)
**LOOKING IS NOT MEASURING.** Every real finding this milestone came from `getBoundingClientRect` /
`getComputedStyle` / a DOM read. Playwright screenshots HANG on this app (animations never settle).
Drive it with raw Playwright + DOM reads. **Make every new guard FAIL against the old code before you
trust it green.**

## ✅ What shipped this session (placement — the re-parent, all LIVE-verified)
- **A1 `28f8ed27`** — `AudiencePresence variant='rail'`: the panel body persistent + IN-FLOW (no
  `bottom-full` bloom, no z-55, no collapse). The desktop rail was DELETED in #208, so this rebuilt
  that container. Preview at `/dev/cards#room` (ranked + brain-drill boxes).
- **A2a `4644ebee`** — desktop right rail (≥xl). `HomePageLayout` grows a `hidden xl:flex` `<aside>` +
  passes `railHost`; the composer `createPortal`s `variant='rail'` there — **state stays in the
  composer**. Thread reflows to a centered pair. 🔑 **scroll-spy survived: focus tracked 9/10 → 3/10.**
- **A2b `03395fcd`** — the `<xl` HEADER: `variant='header'`, a ~68px bar above the thread that expands
  DOWNWARD (`top-full` z-55 sheet). Rendered at the top of the composer's thread branch. Top-anchored
  → survives the keyboard.
- **ONE mount, routed by breakpoint/mode** in `composer.tsx`: `useRail` (≥xl thread) → portal rail ·
  `useHeader` (<xl thread) → header · else → dock peek. `isXl = useMediaQuery('(min-width:1280px)')`.
- Docs commit `b28fdee6`. tsc 0, suites green, every guard ran red-first.

---

## ▶ B — kill the `Ask your audience…` MODE + add `Ask` as a verb  (do FIRST)

**Not a copy tweak — a composer-input refactor.** Today, "asking the room" is a hidden MODE toggled by
`audienceOpen`: while it's true, the composer field stops making content and instead posts to the room.
After placement the room is ALWAYS visible, so this mode is pointless — replace it with an explicit
`Ask` verb in the chip (Make · Test · **Ask** are the 3 locked verbs).

**What `Ask` does (settled by §6.2 — no new decision):** type a thought → the room reacts to it →
result shown in focus. Mechanically that's the existing `askAudience` (`composer.tsx:1928`, POSTs
`/api/tools/react`), just triggered by the `Ask` verb instead of the `audienceOpen` mode. Per-person
`ask →` on a row stays a TAP → `PersonaChatDrawer` (untouched).

**The `audienceOpen` sites to unwind (17), current lines in `src/components/app/home/composer.tsx`:**
- `380` — `const [audienceOpen, setAudienceOpen]` (the mode state)
- `1692`, `1757` — Enter/submit early-returns: `if (audienceOpen) { askAudience(url); return; }` (the
  "forcing function" — this is what makes the field ask instead of make)
- `1714` — `slashActive = !audienceOpen && …`
- `1770` — `activePlaceholder = audienceOpen ? "Ask your audience…" : PLACEHOLDER_BY_TOOL[activeTool]`
- `2009` — `open: audienceOpen` in `presenceCommonProps` (drives the dock bloom / header expand)
- `2285`, `2294` — drag-drop guards `if (audienceOpen) return;`
- `2477`, `2503` — hide chrome while open (`ModelTag` etc.)
- `2515-2517` — submit button `aria-label` / `disabled` / `loading` branch on `audienceOpen`
- `2597-2598` — composer box rounding when open

**The verb system lives in `src/components/app/home/composer-controls.tsx`** (`SKILLS`, `ToolId`,
`SkillRows`, `VERB_BY_TOOL`, `PLACEHOLDER_BY_TOOL` is in `composer.tsx:169`). Adding `Ask` = a new
`ToolId` entry + its placeholder + wiring `selectSkill`/send to route to `askAudience` when active.

**⚠️ Decouple the header's visual expand from the input mode.** Right now the `<xl` header's expand
uses `open: audienceOpen` (`2009`), so tapping it to SEE the room also flips the input into ask-mode.
After B, expanding the header must be visual-only — give the bloom presentations their own local
`open` state (or a `roomExpanded` flag), separate from "the composer is asking." The rail (≥xl) already
ignores `open`, so it's unaffected.

**Verify B live:** with the server up, drive `/home` at ≥xl AND <xl (see recipe below). Assert: no
`"Ask your audience…"` placeholder anywhere; selecting the `Ask` verb + typing + send posts to
`/api/tools/react` and focuses the room; making content (Ideas/Hooks/etc.) still works; the header
expands WITHOUT hijacking the composer. Guard that fails-first: e.g. the composer no longer has an
`audienceOpen` early-return path / the `Ask` verb routes to `askAudience`.

**⚠️ Residual, pre-existing, DEFERRED (do not fix casually):** `openRoomForCard` matches a tapped card
by concept STRING, so two cards with an identical concept open the FIRST. Its own task (thread the
descriptor `id` through `ProofUnit`). Not part of B.

---

## ▶ C — re-copy `"Type a thought below…"`  (trivial, after B)
`src/components/audience-lens/audience-presence.tsx`, the idle body (`focus == null` branch): the line
`` `Type a thought below and watch the whole room react.` `` — "below" is false now (the room is a rail
on the right / a header on top, the composer is elsewhere). Re-word to be placement-neutral (e.g.
"Type a thought and watch the whole room react."). One line. Note `variant='surface'` already uses a
different idle sub-copy (`SURFACE_IDLE_SUB`); consider whether rail/header want their own.

## ▶ D — drop the rank numerals; keep the sort; name true ties  (§6.3)
In `src/components/audience-lens/AmbientRoom.tsx`, the ranked/compare view (the "Hooks · ranked / How
the room ranked your N" list — visible in the A1 dev preview at `/dev/cards#room`, showing `1 … 2 … 3`).
- Remove the big serif rank numerals. The sort + bar + score already carry the order.
- When two genuinely tie, SAY so ("Your top two are tied at 7/10 — the room can't separate them").
- 🔴 **NEVER break a tie with the population number** (e.g. 700 vs 683). That is exactly **PR #306** —
  displaying `7/10` while ranking on `700/1000` will one day ship a #2 that visibly beats its #1.

---

## Verify-live recipe (reusable — this is how every placement fix was proven)
1. **Mint a session cookie, no interactive login.** `.env.local` has `SUPABASE_SERVICE_ROLE_KEY` →
   `admin.generateLink({type:'magiclink'})` → anon `verifyOtp({token_hash,type:'email'})` → session.
   Cookie name `sb-<projectRef>-auth-token`, value `base64-` + base64url(JSON(session)), chunk @3180
   (@supabase/ssr 0.8.0). See `.scratch/verify-a2a.cjs` for the exact working code — copy it.
2. **Test data already exists:** user `e2e-test@virtuna.local`, a chat thread of 20 idea-cards; `/home`
   auto-loads the most-recent open thread.
3. **Raw Playwright:** `@playwright/test` is installed but the bundled browser build mismatches — pass
   `executablePath: ~/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell`.
   Do NOT `waitForLoadState('networkidle')` (animations never settle) — `waitForSelector` the node you
   want, then `page.evaluate` DOM reads.
4. Selectors: scroll region `[data-testid="composer-thread-region"]`; rail
   `[data-testid="audience-presence"][data-variant="rail"]` inside `aside[aria-label="Your audience"]`;
   header slot `[data-testid="audience-header-slot"]`; pulse `[data-testid="audience-pulse"]`; dock
   `[data-testid="composer-dock"]`.
5. **Reusable drivers in `.scratch/` (gitignored, no persisted tokens):** `start-dev.cjs`,
   `verify-rail.cjs` (dev-gallery rail), `verify-a2a.cjs` (desktop /home), `verify-a2b.cjs` (mobile
   /home). Copy + adapt for B/C/D. Delete `.scratch/` at session end if you want (it holds no secrets,
   but the mint code reads the service-role key at runtime).

## Gotchas
- Dev server dies (SIGURG) when a foreground command runs IF launched with a plain `&`/nohup. Use
  `.scratch/start-dev.cjs` (spawn `detached:true` + `unref()` = new session) — it survives.
- `npm test` prints FAKE results — use `node ./node_modules/vitest/vitest.mjs run <files>`.
- After `git switch`/stash under a running dev server, Turbopack HMR-recompiles; usually fine, but
  `rm -rf .next` + relaunch if live output looks stale.
- Accent is `#ff6363` (globals.css SSOT; CLAUDE.md's terracotta is stale). Near-zero dosage in this
  panel — only the settling dots.
- tsc gate: `npx tsc --noEmit -p tsconfig.json` must stay 0.

## Run order (fixed): B → C → D → then P1 (panel craft) → P3 (separable bugs, some one-liners)
