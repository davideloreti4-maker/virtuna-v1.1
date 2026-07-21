# Handoff — Cards UI session (Test card rework + buttons + follow-ups)

**Date:** 2026-07-22 · **Branch:** `lane/skill-cards-prod` → merged to `main` · **Status:** shipped, green.
**Next:** owner wants to continue on **cards UI** first, from feedback they have.

This session (1) built the reworked in-thread **Test card**, then (2) did two owner-driven UX
passes across **all** skill cards: quiet tonal buttons + clearer copy, and curated follow-up
pills on every skill. All three landed as separate commits and merged.

---

## 1. What shipped (3 commits)

### `feat(test-card)` — the video CRAFT teardown ("the editor's cut")
The `/test` card was rebuilt from a thin verdict card (that navigated out to `/analyze`) into a
frame-by-frame CRAFT read that renders **fully in-thread**. Reception (retention curve, the crowd,
reach, who-stops) is NOT on this card — it leaves for the separate **Simulation** surface (parallel
session). The only door out is **"Simulate with your audience →"**.

Card, top→bottom: **craft score ring** (owner-locked KEEP the number; the mean of the craft-subset
Apollo dims — hook/clarity/substance/credibility, **retention excluded**) + **driver bars** → a
**filmstrip** of their video (● asset / ▲ weak-beat marks, `0:06 drop` timeline) → **working /
not-working** ledger → **director's fixes** (each = their frame + diagnosis + a NEUTRAL psychological
"why" + the move + an optional **PROVEN** corpus receipt on the top 1–2 fixes, honest-bare otherwise)
→ the Simulate seam.

Files:
- `src/lib/tools/proof-schema.ts` **(new leaf)** — extracted `HookProofSchema` out of `blocks.ts`
  so `profile-blocks.ts` (where the Test schema lives) can reference it **without an import cycle**;
  `blocks.ts` re-exports it for back-compat.
- `src/lib/tools/profile-blocks.ts` — `VideoTestCardBlockSchema` rewritten (craftScore nullable,
  drivers[], filmstrip[], working/notWorking, fixes[] with optional grounded `proof`). All reception
  fields dropped; `.strict()` now rejects a smuggled *reception* field, NOT the number.
- `src/lib/tools/video-test-card.ts` — pure craft mapper (craft-subset mean; `WHY_BY_ANCHOR` neutral
  mechanism library keyed by `signal_anchor`; hook-fix move = the Apollo rewrite; exports
  `deriveFixGroundingQueries`, structural axis).
- `src/lib/engine/filmstrip/storage.ts` — `signAnalysisFrames()` re-signs persisted keyframes
  server-side; `/api/analyze/[id]/filmstrips` route now reuses it (DRY).
- `src/app/api/tools/test/card/route.ts` — reads `variants.apollo` + `heatmap` + `counterfactuals` +
  `verbatim`, signs frames, maps, grounds the top 2 fixes best-effort; degrade = `no_craft`.
- `src/components/thread/video-test-card-block.tsx` — fully rebuilt (reuses ProofReceipt + CoverFill
  + card-primitives).
- Dev gallery fixture + mapper/route tests rewritten for the craft contract.

### `style(cards)` — quiet tonal buttons + clearer CTA copy + no hover tooltip
Owner: "not a fan of all the white buttons." Retired the loud **cream** fill on the shared
`CardPrimaryAction` (the forward CTA on every card) for a quiet **matte tonal** button (white-5% fill,
hairline border, cream text + arrow, gentle hover lift). One primitive → all cards + inline submits.
**The global `--color-action` cream is untouched** (calendar/discover/feed keep it — only the in-thread
cards changed).

Copy: `Develop into hooks →` → **`Write hooks for this →`** (idea + remix); `Write script →` →
**`Write the script →`** (hook); `Test full script →` → **`Test this script →`** (script);
`Simulate it against your audience →` → **`Simulate with your audience →`** (test).

`ProofReceipt`: removed the native `title` tooltips — the match + stats are already in the aria-label,
and the browser tooltip ("adjacent audience — open the source video") overlapped the card on hover.

### `feat(cards)` — curated follow-up pills on every skill, a distinct type from the buttons
Owner: "add followup actions everywhere in a different type than the buttons on all skills and optimize
for the best actions." Follow-up chips used to appear only after chat-agent turns keyed to
ideas/hooks/script/remix — so a **Test** or **Account** turn fell through to the generic "Give me ideas"
set (the exact bug the owner screenshotted). Now every skill has its own curated set.

- `src/lib/tools/chat-followups.ts` — classifier + registry extended from 5 kinds → **all 10** (adds
  test/account/explore/predict/profile). Each set is the **alternatives** to the card's single forward
  CTA, never a repeat of it (locked by a test). Test now offers **"Rewrite the hook · Fix the pacing ·
  Script a better cut."**
- `src/components/thread/followup-row.tsx` **(new)** — the pills: **ghost pills** (rounded-full,
  transparent, secondary text) — a clearly different TYPE from the solid tonal forward button.
- `src/lib/followup-context.ts` **(new)** — `FollowupContext` (mirrors `HookWriteScriptContext`): the
  composer supplies the chat-send handler once, so **no `onFollowup` prop threads through** 6 views +
  every gallery call site. A view with no provider (the gallery) renders the pills inert for review;
  ChatThreadView still passes its handler explicitly.
- Rendered in `ChatThreadView` AND the 6 standalone skill views (via the shared `ThreadOutro`; inline
  for explore + account). Composer wraps its view region in the Provider.

The 8 distinct sets (live-verified in the gallery Skills tab):

| skill | follow-ups |
|---|---|
| ideas | More ideas · Script the best one · Sharper angles |
| hooks | More hooks · Which is strongest? · Punch them up |
| script | Make it punchier · Different angle · Hooks for this |
| remix | More like this · Write hooks · Draft a script |
| explore | Remix the best one · Ideas from this · Find more |
| account | Ideas that fit me · Where am I weakest? · Hooks in my voice |
| test | Rewrite the hook · Fix the pacing · Script a better cut |
| chat | Give me ideas · Write hooks · Draft a script |
| predict | Predict another · Why this result? · Improve the odds |
| profile | Draft a message · What do they want? · Test another |

---

## 2. Verification

- **tsc 0 · eslint 0** (3 pre-existing composer warnings, not mine).
- **Full suite: 4358 passed / 41 skipped / 1 failed.** The one failure —
  `composer.test.tsx > "renders a persisted Read block after rehydration"` — is **pre-existing**:
  it fails identically on `699c5f79` (before any change this session). Flaky `waitFor` for "The Read"
  (multi-audience-read); untouched by this work. **Fix it or quarantine it** as a small follow-up.
- Live-verified in `/dev/cards` → **Skills** tab (test user `e2e-test@virtuna.local` /
  `e2e-test-password-2026`): the Test card matches its mockup; the tonal buttons + pill hierarchy read
  correctly; all 8 gallery follow-up sets render.

---

## 3. Open follow-ups (candidates for the next session)

**Test card:**
1. `/analyze/[id]` route not yet dissolved — the card's "Simulate with your audience →" links there as
   the **interim** reception surface until the parallel Simulation session ships. Swap the href then.
2. The card is tall (~1700px). Fork: collapse the fixes to `fix 1 + "2 more →"`.
3. Frame tiles show play-tile placeholders off-route (no signed keyframes in the gallery); live runs
   get real frames via `signAnalysisFrames`.
4. Old persisted `video-test-card` blocks fail the new strict schema → skipped on rehydration (no crash;
   acceptable for dev threads).

**Buttons / follow-ups:**
5. `predict` + `profile` follow-up sets exist + are tested but aren't shown in the gallery Skills tab
   (those skills render elsewhere) — add gallery entries if you want to review them.
6. `CHAIN_HANDOFFS[].ctaLabel` in `chain-handoff.ts` still reads the old copy ("Write script →") — it's
   an internal lookup key, NOT rendered (cards use literals), so it's harmless, but align it if you want
   zero drift.

**Pre-existing:**
7. Quarantine/fix the flaky composer "persisted Read rehydration" test (see §2).

---

## 4. Runtime

- Dev server: **`:3011`** (relaunch per memory `dev-server-launch`: direct-node, 2GB cap, `setsid`
  detach; dies on memory pressure). `rm -rf .next` after branch switches.
- `/dev/cards` is the real renderer (auth-gated → 307 to /login). `.env.local` is per-worktree gitignored.
- Test user: `e2e-test@virtuna.local` / `e2e-test-password-2026`.
- Screenshots hang on this app (ambient animations) — use raw Playwright with `animations: 'disabled'`
  + `reducedMotion: 'reduce'` + `addStyleTag` killing transitions (scripts in the scratchpad this session).

Related memory: `test-vs-simulation-split`, `skill-cards-prod-lane`, `skill-card-run-capsule`,
`grounding-corpus-as-a-service`, `dev-server-launch`.
