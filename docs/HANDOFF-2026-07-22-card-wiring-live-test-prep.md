# Handoff — 7-card wiring audit shipped → next: LIVE skill-by-skill card verification

**Date:** 2026-07-22 (session 2) · **Branch:** `lane/skill-cards-prod` (FF-synced to `main`) · **Status:** shipped + merged, green.
**Merged this session:** PR **#364** (remix live-drop fix + loading unify) · PR **#365** (dev-gallery target/population).
**Next session:** **live testing** — fire every skill on the test user with a fresh API key and eyeball that all cards render correctly IN THE THREAD (live stream, not just after reload). See §5.

Design SSOT = `src/app/globals.css` (`@theme`) — accent coral `#FF6363`, card fill `#1a1a19`
(`--color-surface-sunken`), sage `--color-positive #8ea68a`, Newsreader `--font-serif`.

---

## 1. What shipped this session

### PR #364 — remix live-drop fix + loading unify
- **🔴 Remix source attribution was dropping on the live stream** (`de62eb6f`). The remix runner
  produces + persists `proof` (the source-video `@handle` + views receipt), `coverUrl`, and
  `audienceName` (steer tag) — but ALL 4 stream layers omitted them (route content event +
  `PartialRemixCard` + content mapper + `toBlocks`), so on the live run the adapted source rendered
  as an anonymous thumbnail until a page reload. The EXACT 3-layer hazard #361 fixed on
  script/hooks/ideas, still open on remix. Fixed all 4 layers + a route guard (`route.test.ts`) that
  **fails against the pre-fix route, passes with the fix**.
- **Loading unify** (`3dda410e`): the last 4 route loaders (`audience`, `audience/[id]`,
  `competitors/[handle]`, `competitors/compare` `loading.tsx`) still hand-rolled the old cool
  `animate-pulse bg-white/*`; swapped to the shared `Skeleton` primitive → warm shimmer + a
  reduced-motion a11y fix (the old pulse kept animating for reduced-motion users).

### PR #365 — dev gallery previews target + Population·1,000 (`e5506933`)
`/dev/cards` fixtures exercised every current card FIELD except two shipped features with **zero**
preview: `target` (the "Written for The Aspirant → they stopped" per-persona line) and `population`
(the Audience Sim v2 → Population·1,000 Sheet). Added shared `TARGET_*`/`POPULATION_1K` fixtures
(totals reconcile: shares→1.00, segment totals→1,000, stops→544) wired onto idea[0]/hook[0]/script/
remix. **Verified LIVE** on this worktree's dev server: the ideas card now shows
"Written for **The Aspirant** · 14% of your audience / **They stopped** — …".

---

## 2. THE 7-CARD AUDIT RESULT (this session's core deliverable)

Audited every skill card's live field path (schema → route `content` event → stream hook). **6 of 7
were already fully wired.** Remix was the one defect (now fixed).

| Skill | Live path | Field-drop hazard | Verdict |
|-------|-----------|-------------------|---------|
| **ideas** | face-rebuild stream (`use-ideas-stream`) | possible | ✅ wired — proof/grounded/target/population/personas ride all 4 layers |
| **hooks** | face-rebuild stream | possible | ✅ wired — visualHook + all optional fields ride live (#361) |
| **script** | face-rebuild stream | possible | ✅ wired — filming/topic/format/production + all ride live (#361) |
| **remix** | face-rebuild stream | 🔴 **WAS DROPPING** | ✅ **FIXED #364** — proof/coverUrl/audienceName now ride the face |
| **explore** | whole-block stream | none | ✅ safe — outlier-grid streamed whole, no hand-pick |
| **test** | whole-block persist+reload | none | ✅ safe — `predictionResultToVideoTestCard` sets every field |
| **read/account** | whole-block persist+reload | none | ✅ safe — whole block |

**🔑 Key mental model:** the field-drop hazard exists ONLY on the FACE-REBUILD streams
(ideas/hooks/script/remix rebuild a `PartialXCard` field-by-field across 3 layers — miss one and the
field is reload-only). `explore` streams the outlier-grid block WHOLE; `test`/`read` persist then
reload the WHOLE block. Those three can't drop a field. So future card-field work only needs the
3-layer discipline on the four generative streams.

---

## 3. 🔴 GOTCHA THAT COST TIME — the :3011 dev server was a DIFFERENT worktree

For most of the session, `:3011` was serving `~/virtuna-ambient-audience-v2`, NOT this worktree — so
`/dev/cards` fixture edits "didn't appear" and several screenshot rounds verified the wrong files
(older fields showed because they're on main → in both worktrees; new ones didn't).

**Before trusting ANY visual check, confirm the server cwd matches your worktree:**
```bash
lsof -tiTCP:3011 -sTCP:LISTEN                 # the LISTENING pid (filter -sTCP:LISTEN — plain -ti:3011 also returns Chrome/Playwright clients)
lsof -a -p <pid> -d cwd                       # its working directory
```
Recorded in memory `dev-server-launch`. When code is unit-provable (schema `validateBlock` keeps the
field + render is unconditional), trust that over a cross-worktree screenshot.

---

## 4. Verification status (all green)
- **tsc 0 · eslint 0.**
- **Full suite: 4369 passed.** ONE failure — `src/components/app/home/__tests__/composer.test.tsx`
  — is **PRE-EXISTING** on the clean baseline (`b4f60dbb`): an unmocked `fetch` to `:3000`
  (`ECONNREFUSED`), a test-harness mock gap, unrelated to any card wiring. Left as-is (flagged to
  owner; fixable separately).
- Remix guard: `src/app/api/tools/remix/run/__tests__/route.test.ts` (10 tests) — the source-
  attribution guard verified fail-against-old / pass-with-fix.

---

## 5. NEXT SESSION — LIVE skill-by-skill card verification (owner's plan)

Owner has a **fresh API key** for live testing. Goal: fire EVERY skill on the test user and confirm
each card renders correctly **in the thread, on the LIVE stream** (not just after a reload). The
remix source-attribution (#364) is the specific regression to eyeball live.

### 5.1 Setup
1. **Fresh API key** → put it in `.env.local` as `DASHSCOPE_API_KEY=` (Qwen — powers
   ideas/hooks/script/remix/read generation; the likely-exhausted one). `DEEPSEEK_API_KEY` (Apollo /
   video Test craft) and `APIFY_TOKEN` (scrape: remix/explore/account/test) are already set — only
   swap what's fresh. ⚠️ `.env.local` is loaded by the **dev server**, NOT by vitest (memory
   `vitest-env-live-smoke-gotcha`). Live runs go through the dev server.
2. **Restart the dev server clean from THIS worktree** (`.env.local` is read at boot):
   ```bash
   cd ~/virtuna-skill-cards-prod
   kill $(lsof -tiTCP:3011 -sTCP:LISTEN)     # confirm cwd first (§3)!
   rm -rf .next
   # detached launch (survives later Bash commands) — Python fork+setsid, NODE_OPTIONS heap cap 2048:
   #   node ./node_modules/next/dist/bin/next dev -p 3011 --turbopack
   # (see memory dev-server-launch for the exact os.fork() launcher)
   ```
   Then confirm cwd = `~/virtuna-skill-cards-prod` (§3) and warm with `curl :3011/dev/cards`.
3. **Test user:** `e2e-test@virtuna.local` / `e2e-test-password-2026`.
4. **Live-run harness:** `.scratch/live-run.mjs {script|hooks}` logs in + fires the real SSE from the
   authed page and prints stages + emitted card props. Extend it per skill (remix needs a real
   TikTok URL). Screenshots hang on ambient animations → use raw `@playwright/test` with
   `reducedMotion:'reduce'` + `animations:'disabled'` + a tight `clip` (pattern in
   `.scratch/verify-cards.mjs`, this session's working script).

### 5.2 Per-skill live checklist (fire in the composer/thread, watch the LIVE face)
Cheap→expensive order (mind the fresh key's budget):
- **ideas** (Qwen, cheap) — title · angle · whyItFits · mechanism · Topic·Take·Format recipe ·
  band+fraction (arrives on the `score` event, a beat after the face) · scrollQuote · proof (if
  grounded) · `target` (if calibrated audience active) · population Sheet · personas → room.
- **hooks** (Qwen, cheap) — hookLine · audienceArchetype · mechanism · rank · band · `visualHook`
  (first-frame technique) · proof · target · population.
- **script** (Qwen, cheap) — beats Hook→Setup→Turn→Payoff→CTA each with a **`filming`** cue ·
  topic·format meta · **`production`** "How to film" block · opener band · proof · population.
- **remix** (Qwen + **Apify scrape + omni video decode = slow/costly**) — adaptedHook · angle ·
  whoItsFor · formatBorrowed · **⭐ source attribution `proof` (@handle + views) — THE #364 FIX,
  confirm it rides the LIVE face, not reload-only** · `sourceDecode` (expand) · **`production`**
  "ready to film" YOUR-VERSION column · band · `audienceName` steer tag.
- **explore** (Apify scrape) — outlier grid tiles, each with a MEASURED multiplier + its baseline
  label (STRONG/FAIR/WEAK fit-dots; owner may want them unified to sage — §3.3 of the old handoff).
- **test** (full `/api/analyze` Max pipeline — **billed, heaviest**; DeepSeek Apollo + omni) — craft
  ring + driver bars · filmstrip · working/notWorking ledger · director's fixes (top 1–2 grounded
  with proof) · tier · "Simulate it →". Persist+reload path — verify the card appears after the
  in-thread run completes.
- **read** (concept read) — multi-audience-read card. **account** (Apify, own handle) — account-read
  patterns + thin-history fallback.

### 5.3 What "renders correctly" means
Every field the runner emits must appear on the LIVE face (the whole point of the audit). Cross-check
against `/dev/cards` (Skills tab) which now shows the full-field reference for each card. If a field
shows in `/dev/cards` (fixture) but NOT on a live run, the runner isn't emitting it (a producer gap,
not a wiring gap — wiring is now audited clean). If it shows after reload but not live, that's a
NEW 3-layer drop (shouldn't exist post-#364, but that's exactly the class of bug to watch for).

### 5.4 Note: chat-agent dispatch only covers 3 of 7
`SKILL_TOOLS` in `src/lib/tools/skill-dispatch.ts` registers ONLY ideas/hooks/script as chat tools —
remix/explore/test/read run via the composer selector / in-thread fields, NOT by typing in chat. If
"all 7 in the chat thread" is wanted, that's a separate feature (adding entries to `SKILL_TOOLS`),
not a card-wiring bug. Confirm with owner whether that's in scope.

---

## 6. Runtime quick-reference
- Dev server **:3011** `--turbopack`, launched from `~/virtuna-skill-cards-prod` this session (leave
  it or restart clean after adding the key). 16 GB box → ONE hot server at a time (OOM). Memory
  `dev-server-launch` has the heap cap + os.fork launcher + the wrong-worktree check.
- `/dev/cards` auth-gated (307). **Skills** tab = the 7 skill cards (full-field reference). Test user
  above.
- Working scratch scripts (gitignored): `.scratch/live-run.mjs` (SSE harness),
  `.scratch/verify-cards.mjs` (this session's DOM+screenshot verifier).

Related memory: `skill-cards-prod-lane`, `dev-server-launch`, `test-vs-simulation-split`,
`corpus-two-visual-hook-axes`, `green-test-is-the-accomplice`, `vitest-env-live-smoke-gotcha`,
`grounding-warrant-contract`.
