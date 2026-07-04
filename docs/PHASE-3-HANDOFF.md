# The Room — Phase 3 handoff (start COLD)

> Written 2026-07-04 at ~44% context, end of a long session. **Phases 1 & 2 are shipped to
> `main`.** This hands off **Phase 3** (the three-verb IA + the Test→Room embed). The design is
> approved in principle — the sketch is the spec. **Read this + open the sketch, then build.**

## 0. Start here
```bash
cd ~/virtuna-the-room
git fetch origin && git switch -c feat/the-room-phase3 origin/main   # branch off the latest main
# dev server (gotchas: 768MB heap OOMs; the npx wrapper breaks dev — node bin + big heap):
NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack
# → http://localhost:3000/home  · logged in as e2e-test@virtuna.local / e2e-test-password-2026
```
**The sketch (the spec):** https://claude.ai/code/artifact/35d773ab-a194-431c-99f1-96e03b28a696
Local copy: `docs/prototypes/the-room-phase3-sketch.html` (serve `cd docs/prototypes && python3 -m http.server 8899`).
The mobile Room spec stays `docs/prototypes/the-room-prototype-v6.html`.

## 1. State (what's already done)
- **Phase 1** (ambient Room + desktop rail) — MERGED to `main` (PR #125).
- **Phase 2** (reactions-arrive dopamine: "Reading the room…" + constellation blink + "✦ N new" badge + count-up + rise-in) — MERGED to `main` (PR #127, merge `c63f21ae`). All client-side.
- `main` keeps advancing (the sister **surfaces** session merges often — it owns `/start`, `/calendar`, `/analytics`, `/grow`, `/feed`, account ingestion). **Always branch off the latest `origin/main`.** Zero file overlap so far.
- tsc baseline = **21 errors, ALL in `__tests__`, 0 production**. Keep production at 0.

## 2. Phase 3 = two parts

### Part 1 — collapse the skill menu into Make / Test / Ask
**Today:** Task C (already shipped) made the composer *chip* show "Make ▾" on its face, but the
popover still lists ~9–13 skills flat. **Phase 3 groups the popover under three verbs.**

**LOCKED mapping (owner-confirmed this session):**
- **Make** — Hooks · Ideas · Script · Remix · **Explore** *(kept, per owner)*
- **Test** — A real video · **Your account** (Account Read) *(kept, per owner)*
- **Ask** — The room (chat / a raw thought)
- **General-SIM mode swaps in** Profile · Simulate · Predict (already mode-gated in the data — the menu is audience-aware).
- **Hidden until enabled:** Offer Validation, Ad Creative (`enabled: false`).

Nothing is deleted — every skill keeps a home; it's reorganized by **intent** (Make = create net-new · Test = judge something real · Ask = converse). Default stays: type a topic + ↑ = Make (the 90% path; the menu never opens). Two levels (verb → flavor), not lossy.

- **SSOT:** `src/components/app/home/composer-controls.tsx` — `SKILLS[]` (~L77), `VERB_BY_TOOL`, `SkillRows`. The rows already carry `group` + `modes`; add the Make/Test/Ask grouping + section headers to the popover render. Preserve the popover-portal fix (don't regress it).
- `src/components/app/home/composer.tsx` — mounts the controls / handles tool selection + the Test upload affordance (already reveals on intentional Test entry).

### Part 2 — the video Test's Read: embed the Room (Option A, owner-confirmed)
**The video Test lands on a DEDICATED page** — `src/app/(app)/analyze/[id]/page.tsx` → the `Reading`
view (`src/components/reading/reading.tsx`). It is NOT a home-thread card. Its sections (in order):
1. **Hero** — score gauge · virality · watch% · biggest-drop (`ReadingHero`)
2. **Score drivers** — Hook · Retention · Shareability (`ScoreDriversSection`, `reading-accordion.tsx`)
3. **Audience & context** — *TODAY just a niche-rank distribution; the persona deep-dive is **deferred/stub*** (`AudienceContextSection`, `reading.tsx` ~L212)  ⬅ **THIS is the only thing Phase 3 changes**
4. **Fix First** (`FixFirstList`) · 5. **Deeper Read** (`DeeperRead`) · 6. **Follow-up Chat** (`ReadingChat`)

**Option A (embed):** rebuild the **Audience & context** section to render the **v6 Room** inline —
named voices + `ask →` + Population · 1,000 + weak-spot — reusing `AmbientRoom.tsx` (or its parts).
**Nothing else on the Read page changes; nothing is removed** (the audience section is a stub today,
so we're *filling a deferred slot*, not ripping out a rich panel). The retention scrubber, hook,
score, fix-first, deeper-read, chat all stay.

**The video earns a timeline Replay** the text Room can't have: a real video carries a per-second
`HeatmapPayload.personas[].attentions[]` trace → voices light up **as the video plays**. The plumbing
exists — `src/components/audience-lens/ReplayController.tsx` **TIMELINE mode** (vs the flat CASCADE
mode text uses). Wire the embedded Room's replay to that timeline for a video Test.

- Data: `buildAudienceNodes(data)` (`reading.tsx` L156 / `reading-panels.tsx`), `buildFlatPersonaNodes`, `persona-names.ts` (`resolvePersonaName`), `persona-registry.ts` (`ARCHETYPES`).
- Reuse: `AmbientRoom.tsx` (People + Population + weak-spot) — parametrize it to mount inside the Read (it currently assumes the presence Bloom/rail context; may need a `layout`/embedded variant). `PersonaChatDrawer` for `ask →` (already reused elsewhere).
- ⚠ The old `AudienceLensContent` / `AudienceLens` still mounts in the Reading personas path — Phase 1/2 said "don't touch it." **Phase 3 IS where you replace it** with the Room.

## 3. Key files
| File | Role in Phase 3 |
|---|---|
| `src/components/app/home/composer-controls.tsx` | **Part 1** — SKILLS SSOT + the verb menu popover (group into Make/Test/Ask) |
| `src/components/app/home/composer.tsx` | Part 1 — tool selection, Test upload affordance |
| `src/components/reading/reading.tsx` | **Part 2** — the Read page; swap `AudienceContextSection` → the Room (~L212) |
| `src/components/reading/reading-accordion.tsx` | Part 2 — `ScoreDriversSection` + `AudienceContextSection` live here |
| `src/components/reading/reading-panels.tsx` | Part 2 — `buildAudienceNodes`, `PersonasPanel`, panel switch |
| `src/components/audience-lens/AmbientRoom.tsx` | Part 2 — the Room body to embed (People/Population/weak-spot) |
| `src/components/audience-lens/ReplayController.tsx` | Part 2 — TIMELINE mode for the video timeline replay |
| `src/app/(app)/analyze/[id]/page.tsx` | Part 2 — the Read route |

## 4. Gotchas (learned this milestone)
- **Vitest:** `node ./node_modules/vitest/vitest.mjs run <file>` — `npx vitest` prints a fake PASS(0).
- **tsc gate:** keep production errors at **0** (21 test-baseline is fine). `npx tsc --noEmit`.
- **Matte guard:** `src/components/reading/__tests__/reskin-matte.test.ts` — keep green (no coral/glass). The one sanctioned accent-fill is the liveness badge; sage `#8ea68a` = stop/loved.
- **Design tokens:** bg `#262624`, cream `#ece7de`, terracotta `#d97757`, sage `#8ea68a`, 6% borders, radius 12 cards / 8 inputs, Inter chrome + Newsreader serif for voice moments. Build to the v6 prototype **exactly** — don't re-derive (a past green→cream swap was reverted).
- **Auto-wip daemon is LIVE** in this worktree — commit deliberately, **never force-push** under it.
- **Live-verify the video Test** needs a REAL video (Test = SIM-1 **Max**, slow + costs a call). UAT video: `~/Downloads/TikTok Video Downloader.mp4` → copy into `./.playwright-mcp/` to upload. Test General + a calibrated audience. Screenshots land in the worktree root as `*.jpeg` (gitignored) → Read then `rm`.
- **Prototype/sketch encoding:** when serving a partial HTML without `<meta charset>`, special glyphs mojibake — use **HTML entities** (`&rarr;` `&mdash;` `&#9654;`); in CSS `content:` use unicode escapes (`\25B6`), NOT entities.

## 5. Verify (prove it, don't assume)
- **Part 1:** real browser — open the composer chip menu, confirm the Make/Test/Ask grouping + headers, each skill still launches, the General-SIM audience swaps to Profile/Simulate/Predict, Offer/Ad hidden. `composer-controls` unit tests + tsc.
- **Part 2:** real browser — run a REAL video Test → the `/analyze/[id]` Read page → confirm the Audience section is now the Room (named voices, `ask →` answers in-voice, Population/weak-spot), the timeline Replay lights voices as the video plays, and Hero/Score-drivers/Fix-First/Deeper/Chat are **unchanged**. tsc + matte + presence green.

## 6. Suggested order
1. **Part 1 first** (self-contained, cheap, no model calls) → its own PR. 2. **Part 2** (backing the Room into the Read + timeline replay) → its own PR (heavier; budget a real-video browser loop).
Small PR per part, off the latest `main`.

## 7. Open / not-in-scope
- `variant='surface'` (app-wide read-only presence) + `mode='embedded'`/`onLaunch` start-page seam — still deferred, cross into the **surfaces** session. NOT Phase 3.
- Phase 4 (outcome loop: predicted-vs-actual → recalibrate) — blocked on surfaces for account-connect. After Phase 3.
