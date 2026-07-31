# HANDOFF — premium thread loading: what shipped, what's next

> Date: **2026-08-01** · Branch `task/thread-loading-premium` · **PR #411** (open, not merged)
> Worktree: `~/virtuna-slot-c` (slot pool), port **3003**. Base: `origin/main` `fb0a5a00`.
> Design SoT: `src/app/globals.css` + `docs/DESIGN-SYSTEM.md`.
> Reference target: `.planning/sketches/premium-thread.html` (**v3.2**, still the locked build target)
> and its copy floor `.planning/premium-thread-copy-floor.md`.
> Predecessor map: `docs/subsystems/ui-loading-states.md` (2026-06-27 audit; §5 NORTH STAR still stands).

---

## 0. Read this first

The owner's brief was: *"rework the UI for the loading states … cleaner and more premium … I want them to
actually feel the progress and what the engine does (the ChatGPT / Claude / Perplexity experience) …
every time a video gets referenced, or analysed, or a profile gets scraped, I want the user to see that in
the loading state (thumbnails, filmstrip, metric)."*

**Session 1 (this one) built the machinery and the honesty rules.** It is open as PR #411 and is
green — but the owner's verdict on the result was: *"looks good so far, the only thing I want the dot +
line loading state + possibly everything else to be cleaner and more premium … something big companies
like ChatGPT, Perplexity, Claude would release. And it's missing some stuff, for example loading state
when scrapes happen (profile, new videos etc)."*

**So session 2 has two jobs, in this order:**

1. **A visual/craft pass** on the spine itself — the dot + line is the thing the owner is still not happy
   with (§3).
2. **Close the scrape gaps** — profile scrapes, outlier pulls, the paid Apify runs, audience calibration
   (§4). These are the waits that are still blind, and several are the LONGEST waits in the product.

Then: **verify signed in as a real test user** (§5 — there is a blocker there, read it before you plan).

---

## 1. What PR #411 actually shipped

One `evidence` SSE frame and one render idiom, plus a measured clock and a rewrite of the two waits that
were not skill runs. 30 files, +1,747/−105, 10 commits.

### The architecture, end to end

```
runner (real phase boundary)
  └─ onEvidence(RunEvidence)        ← fired where the artifact actually lands
       └─ route: send("evidence", …)
            └─ stream hook: parseRunEvidence(data) → setEvidence(…)
                 └─ useActiveRun → LiveRun.evidence → <SkillProgress evidence>
                      └─ <ProgressChecklist evidence> → renders under the ACTIVE row
                           └─ <RunEvidenceRail>  (source chips │ filmstrip)
```

| Seam | File | Note |
|---|---|---|
| Wire contract | `src/lib/tools/evidence.ts` | types + `parseRunEvidence` (total) + `buildVideoEvidence` + `evidenceMetric` + `isSafeEvidenceUrl` |
| The rail | `src/components/thread/run-evidence.tsx` | chips for `video`/`profile`, filmstrip for `frame` |
| The spine | `src/components/thread/progress-checklist.tsx` | `mergePlan` · `STAGE_COPY_ROTATION` · `useStageClock` · `StageNode` |
| Grounding emit | `src/lib/grounding/gather-for-run.ts` | `emitEvidence()` / `evidenceHeadline()`, called from `settle()` |
| Remix emit | `src/lib/tools/runners/remix-runner.ts` | right after `input.onStage?.("Resolving","done")` |
| Chat-dispatch seam | `src/lib/tools/skill-dispatch.ts` | `SkillRunContext.onEvidence`, forwarded by all 3 registry runners |
| Test filmstrip | `src/components/thread/use-test-run-evidence.ts` | wraps `useReadingReveal`; reveal → `RunEvidence` |
| Routes | `api/tools/{hooks,ideas,script,remix/run,chat}/route.ts` | `onEvidence: (e) => send("evidence", e)` |
| Stream hooks | `use-{hooks,ideas,script,remix,chat}-stream.ts` | `evidence` state, cleared on start AND on chat's 2nd dispatch |
| Previews | `src/app/(app)/dev/cards/page.tsx` → `INFLIGHT_VIEWS` | 3 new states; fixtures declared ABOVE the array (TDZ) |

### Where evidence comes from today

| Surface | Shows | Lands |
|---|---|---|
| hooks · ideas · script (grounded only) | retrieved outliers: cover + `@handle` + measured multiplier | ~40s before the first card |
| remix | the resolved source post: cover + `@handle` + views | seconds in, covers the ~50s of Decoding+Adapting |
| chat (agent-dispatched skill) | whatever that skill emits — same pipeline | same |
| Test (in-thread field + composer) | scrape receipt → the real filmstrip | seconds → throughout the ~2min |

### The honesty rules (locked by tests — do not regress these)

- Nothing is invented; every string comes off a real row.
- `buildVideoEvidence` counts what **survived** the drawable filter, not what it was handed.
- The **warrant travels with the rows**: a structural batch says *"Borrowing shape from N proven videos"*.
- The multiplier passes the **same gate as the card receipt** (`MIN_OUTLIER_MULTIPLIER`); under it → views.
- The clock reports **only what it measured** — a reloaded turn replays its plan as done and gets NO stamp.
- Evidence fires **only on a grounded run**; a degrade emits nothing. No evidence ⇒ no rail, not an empty one.
- `parseRunEvidence` is **total** — it lives in the same read loop as `content`/`score`/`done`.
- `isSafeEvidenceUrl` allows only `http(s)` and app-relative; scheme-relative `//host` is refused.

### Verification already done

`npx tsc --noEmit` clean · `npx vitest run` **4939/0** · `npx next build` exit 0 (**120 app routes** —
the "1 routes / 466ms" line the terminal prints is the output formatter, not the build) · eslint clean on
every touched path (4 remaining `react-hooks/set-state-in-effect` errors in `use-analysis-stream.ts` /
`use-expert-chat.ts` are **pre-existing**, confirmed by stashing).

Visual: rendered against the real compiled CSS via a throwaway unauthenticated route (deleted before the
first commit). Published preview artifact with before/after plates:
<https://claude.ai/code/artifact/bb5f2f45-ed24-4bd2-86fd-a054ba0c3e6c>

---

## 2. Things this session learned the hard way

- **`git worktree` slot-c, port 3003.** `npm run dev` already carries `--max-old-space-size=2048`.
- **The dev gallery `/dev/cards` is auth-gated** by `src/app/(app)/layout.tsx` (server-side `getUser()`),
  so it is unreachable without a session. See §5.
- **`radius-scale.test.ts` is a real guard** and it caught two off-scale radii (`rounded-[4px]`,
  `rounded-[5px]`). The scale is 4/6/8/12/16/20/24 → `rounded-xs/sm/md/lg/xl/2xl/3xl`. Use tokens.
- **Motion guards belong in CSS, not JS.** `.text-shimmer`, `.animate-stage-breathe` and
  `.skeleton-shimmer` each self-guard `prefers-reduced-motion` in `globals.css`. A JS branch can be
  forgotten; an inline `animation` style also silently beats a `motion-reduce:` class.
- **Python `str.replace` on an indented line matches a deeper-indented line too.** A bulk patch inserted
  `setEvidence(null)` at 4-space indent inside a 14-space block. Caught and fixed; re-indent by copying
  the previous line's indentation, and always diff-read a bulk edit.
- **`SkillRunCapsule` is dead code** — nothing imports it; only `SKILL_RUN_META` from `run-capsule.tsx`
  is used. Left consistent with the live path. Retirement candidate; owner's call.

---

## 3. JOB 1 — the craft pass on the spine

**The owner is not happy with the dot + line.** Treat this as a design problem, not a tweak. The bar is
literally "something ChatGPT / Perplexity / Claude would release".

### Where the current design is
`StageNode` is a 16px ring that morphs pending → active (coral ring + breathing coral dot) → done (filled
cream disc + ✓). The connector is a 2px rail with a `spine-flow` pulse while active and a solid cream fill
when done. The label is `text-body` (13px) with `text-shimmer` while active, a rotating sub-detail line
under it, and a right-side measured stamp.

### Concrete leads (not prescriptions — the design call is yours)
- **Weight and scale.** 16px nodes + 2px rail against 13px type may simply be too heavy. Reference tools
  use much lighter marks. Try a smaller node / hairline rail and let TYPE carry the hierarchy.
- **The done state.** A filled cream disc with a ✓ is the loudest mark on the screen, on every completed
  step, forever. Reference tools de-emphasise what is finished. Consider the check receding rather than
  brightening.
- **The collapse.** The v2 sketch specifies **"Generated in 0:32 ▸"** — a Claude/Cursor pattern. What
  shipped is `✓ Ran your audience · 3 steps ▾`. Now that the clock exists, a real total is available.
  **This is a concrete, already-specified gap.**
- **Motion choreography.** The sketch's standing bar is *"smoothness can be improved everywhere"*:
  check-pop on completion, spine-fill easing into the next row, one debounced scroll choreography, cards
  arriving one-by-one. Ours does per-row `reading-reveal` at 0.06s stagger and little else.
- **Density.** Each row is `pb-3` with the rail's `min-h-[14px]`. With a 4-step plan + sub-detail +
  evidence the block is tall. Consider a tighter resting rhythm that only expands for the active row.
- **The rail's eyebrow.** `DRAFTING AGAINST 3 PROVEN VIDEOS` (11px uppercase, tracked) may be shouting
  next to a 12px sub-detail. Sentence case, or fold the count into the chip row.
- **Chip proportions.** 20×34 cover + two lines of text in a 44px chip. Check against a real 6-row
  grounded run (`maxExamples: 6` in `retrieve.ts`) — that wraps to two rows at 760px.

### Process
`docs/subsystems/ui-loading-states.md` §5 says **sketch-first**, and that is what produced the current
target. Do the same: iterate in a throwaway HTML sketch (`.planning/sketches/`) before touching
components, get the owner's eye on it, THEN build. The existing `premium-thread.html` v3.2 is the file to
open first — several of its specified behaviours are still unbuilt.

### Guardrails
Accent (`#FF6363`) appears on the **live/active node only** — never on a done check, never as a fill.
Cream text is `#ece7de` / `#c2bdb4` / `#8a857c`, never `#fff`. Matte: no glass, no glow, no inset shine.
Borders 6% (`white/[0.06]`), hover 10%. Radii on the token scale. Keep
`reading/__tests__/reskin-matte.test.ts` green.

---

## 4. JOB 2 — the scrape gaps (surveyed, with exact locations)

Every one of these is a real wait with real artifacts already in hand, and none of them currently shows
anything. Ordered by pain.

### 4a. Account read — **the biggest gap** · `~30s+` blind

- `src/app/api/account-read/route.ts` sends **one** `status` message (`"Reading your account…"`) and then
  nothing until `done`.
- `src/lib/account-read/account-read.ts:345` —
  `await Promise.all([provider.scrapeProfile(handle), provider.scrapeVideos(handle, 30)])`.
- Both halves carry exactly the evidence the finished card already renders:
  `AccountReadProfileSchema` = `{ handle, displayName, avatarUrl, verified, followerCount, videoCount }`
  and `AnalyzedVideoSchema` = `{ coverUrl?, views, … }`.
- **The change:** split the `Promise.all` so each side resolves independently, thread an `onEvidence`
  through `AccountReadDeps`, and emit twice — the **profile** the moment it lands (`kind: 'profile'` →
  the avatar disc the rail already supports but nothing currently produces), then the **analyzed posts**
  as a video rail. The route wires `onEvidence: (e) => send("evidence", e)` like the other five.
- Client: `use-account-read-stream.ts` has no `evidence` state yet (it was not in PR #411's five).
  `use-active-run.ts` already carries the field; the `account` candidate just passes `undefined` today.
- In-thread, `AccountField` renders `<SingleStageWait name={SKILL_RUN_META.account.running} />` —
  a one-row spine. Give it the evidence prop.

### 4b. The paid "Find new outliers" scrape · `~25s` blind, and the user PAID for it

- `src/lib/grounding/orchestrator.ts` `gatherAndExtract` — `scrapeVideos` (broad search) →
  `selectCandidates` → `Promise.all(survivors.map(profile-scrape))` → extract.
- Today the whole thing sits under one static `"Finding proven outliers"` row.
- This is an **explicit spend** (`allowScrape: true` only from the user's tap). A spend deserves the most
  legible wait in the product. Real sub-boundaries exist inside — emit them as stages, and emit the
  survivors' covers as evidence as they are profile-scraped.

### 4c. Explore / outlier pull · one blocking call

- `src/lib/tools/runners/explore-runner.ts:105` — `sources.map((s) => provider.scrapeVideos(s, …))`.
- The route (`api/tools/explore/route.ts`) brackets it with `Pulling outliers` active→done, so on a cache
  MISS the spine sits on one row for the whole scrape and then flashes.
- The ranked tiles carry `coverUrl`. Emit per-source completion + the first covers as they rank.

### 4d. Audience calibration · **~126s measured, and it is not even on the spine**

- `src/app/api/audiences/calibrate/route.ts:143` — `onStage: (stage) => send("status", { message: … })`.
- It has three REAL stages already (`scraping` / `watching` / `synthesizing`, `CalibrationStage` in
  `src/lib/audience/calibration.ts`) with honest copy — but they are emitted as `status` **messages**,
  so they render as a plain line instead of the spine.
- The route's own docblock records: *"scrape ~126s, watch+synthesize ~2s of wall clock after it"*.
  That is a two-minute wait in a different idiom from every other wait in the product.
- **Cheapest high-value fix in this whole list:** also `send("stage", …)` and let the calibration surface
  mount `ProgressChecklist`. Then add evidence (the follower profiles / the top videos being watched).

### 4e. Competitors — **not surveyed.** Scrape/refresh surfaces exist
(`src/components/competitors/*-skeleton.tsx`, `api/cron/refresh-account-snapshots`). Survey before scoping.

### A shared note on all of these
The rail already supports `kind: 'profile'` (circular avatar) and **nothing currently emits it.** 4a is
the first producer. Check the disc renders well at 28px with a real TikTok avatar before fanning out.

---

## 5. ⚠️ BLOCKER for "test with a test user"

**The saved e2e auth state is dead.** `~/virtuna-v1.1/e2e/auth/state.json` holds a cookie for the right
Supabase project (`qyxvxleheckijapurisj`, cookie valid until 2027) but the refresh token is gone — the
dev server logs `AuthApiError: Invalid Refresh Token: Refresh Token Not Found` and every `(app)` route
307s to `/login`.

`e2e/auth.setup.ts` regenerates it from `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`, and **neither is set in
any worktree's `.env.local`** (checked: trunk, slot-a, slot-b, onboarding, prod).

**Do this first, before planning the verification:**
- Ask the owner for the test-user credentials, then
  `E2E_USER_EMAIL=… E2E_USER_PASSWORD=… npx playwright test --config e2e/playwright.config.ts e2e/auth.setup.ts`
  (note: `baseURL` is `:3000` in that config — override for slot ports).
- Or have the owner sign in and hand over a fresh `state.json`.

**Interim technique that worked this session** (use it for pure component verification, never commit it):
a throwaway page under `src/app/zz-preview/page.tsx` — outside the `(app)` route group, so the auth layout
does not apply — mounting the real components with fixture props, screenshot with raw Playwright, then
delete the directory. For before/after, `git show origin/main:<file> > src/app/zz-preview/old-<name>.tsx`
and mount both.

**Playwright notes for this app:** `browser_take_screenshot` (MCP) hangs — the ambient animations never
settle. Use raw Playwright with `animations: 'disabled'`, `caret: 'hide'`, and an element `.screenshot()`.
`node_modules/playwright/index.mjs` must be imported by absolute path from a scratchpad script.

**A live billed run is the only way to see real evidence end-to-end.** Grounding is env-gated
(`GROUNDING_{HOOKS,IDEAS,SCRIPT}_ENABLED` — all present in slot-c `.env.local`) and the scrape is
explicit-only, so a default hooks run shows NO rail. To see one: run hooks on a subject the corpus already
covers (cache read-back is free), or tap **Find new outliers** (paid Apify, ~25s).

---

## 6. Definition of done for session 2

- [ ] Sketch iterated and owner-approved before component work (§3 Process).
- [ ] Spine craft pass landed; `radius-scale` + `reskin-matte` + `type-scale` guards green.
- [ ] Collapse shows a real measured total ("Generated in 0:32"), per the v2 sketch spec.
- [ ] 4a account-read evidence (profile + analyzed posts) — the `kind: 'profile'` producer.
- [ ] 4d calibration moved onto the spine (`stage` events, not `status` messages).
- [ ] 4b/4c scoped or landed.
- [ ] New in-flight states added to `INFLIGHT_VIEWS` in `/dev/cards` — a state with no cheap way to look
      at it will drift (the 07-14 audit's lesson, and the reason those previews exist).
- [ ] `npx tsc --noEmit` + `npx vitest run` + `npx next build` all green.
- [ ] Verified **signed in as the test user** on a real run, not only in fixtures.
- [ ] Honesty rules in §1 still hold — re-read them before adding any new emitter.
