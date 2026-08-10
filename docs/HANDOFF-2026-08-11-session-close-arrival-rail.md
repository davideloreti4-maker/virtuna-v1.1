# Handoff — session close: the arrival rail, the welcome, and what's left

> **Session of 2026-08-11, worktree `~/virtuna-platform-concept`, branch `lane/platform-concept`.**
> Everything below is **MERGED to `main`** (`0edbc933`). Nothing is deployed — see §6.
>
> **Precedence.** `docs/HANDOFF-2026-08-11-v8-rail-restored.md` is still the **RULING RECORD** for
> v8 and outranks every older v8 doc; its §5c/§5d/§6 were written by this session. THIS doc is the
> session close + next-session kickoff. Where they overlap, the ruling record wins on *what was
> decided*; this doc wins on *what is still open*.

---

## 1. What shipped

Two PRs, both merged, both true merges (house method — never squash).

| PR | Merge | What |
|----|-------|------|
| **#462** | `0f2effd9` | The audience rail mounts on the desktop arrival + a real welcome section |
| **#464** | `0edbc933` | A picked lane seeds the audience description with its `niche` |

### 1a. The rail on the desktop arrival (owner ruling r3)

The arrival was a greeting, a shelf and a composer — the shape of every chat app. The one fact that
makes this a different product, that a thousand calibrated people read what you write, was invisible
until after the first send and carried only by a ~200px chip in the composer foot.

**The trap that shaped the build:** the rail's ranked board is built from the OPEN THREAD's
descriptor ledger, so on the arrival it has no rows. Mounting it as-is gives an honest header over a
700px void — the failed-to-load read, *worse* than the chip. And it cannot be filled by running
something: navigation never fires a sim (LOCKED). So the board got a **resting state** answering what
it can answer for free — who is in the room — from `audience.personas`.

- **Resolves the cast question parked at the ruling record's §8.** The cast returns with **names and
  shares**. `CastMember` / `deriveCast` / `castOverflow` are DELETED. Initials were tried in the
  audience sheet and cut the same day (no information, and they collide).
- Percentages use **largest-remainder apportionment targeting `round(sum)`**, never a hardcoded 100.
  A column that doesn't add up makes a real number look fabricated; inflating a signature that
  genuinely sums to 0.9 would invent coverage. Three tests: adds-up / never-inflates / no-slices.
- **Adjacent fix:** the board rendered `Ranked · 0 sealed` unconditionally, so a queued-only thread
  opened on an empty section head over a void. A section with no rows is not a section.
- Layout is `home-page-layout.tsx` only (`arrivalRail`), every class `xl:`-gated. Flag-gated;
  flag-off byte-identical.

### 1b. The welcome section (owner rulings r4 + r5)

`arrival.tsx` rendered a SINGLE `h1` that **swapped identity** — the time greeting until drops
existed, then `"Tonight's remixes."` So the screen a creator actually meets, drops present, had **no
welcome at all**. Split: `arrival.tsx` = brand mark over a serif greeting, centered, always;
`drop-shelf.tsx` = one muted provenance caption and **no heading** (r5 killed the wording rather than
rewording it — the cards already say what they are).

The mark renders **cream, not its default accent**: the sidebar already spends the one allowed accent
element on that screen (dosage LOCKED).

**The gap.** `pb-40` was 160px of dead space, and `justify-end` was inert — that box is `min-h-full`
inside a **height:auto** ancestor, so the percentage never resolves and there was nothing to push
against. v8 takes `pt-10 sm:pt-16 pb-2`; flag-off `AmbientStartHome` keeps `pt-6 pb-40`.
**Headroom 24 → 64px, gap 221 → 88px.**

### 1c. The lane prefill

`pickLane` seeded the audience description with `shelf.lane.who` — a posture shorthand capped at six
lowercase words (`"receipts, not vibes"`). The schema defines `niche` as "the creator niche this lane
writes for". The day-0 "not sure yet?" door was handing calibration a fragment that **names no
subject**, the one input that flow cannot do without.

---

## 2. Open — needs an owner ruling

1. **Day-0 lane cards still carry the pre-score meter** (`lane-reveal.tsx`, `buildLaneDrops`'s Flash
   batch). **Recommendation: kill it** — that score runs against `GENERAL_AUDIENCE`, because a
   day-zero user has no audience yet, so it is a number that *looks* personal and isn't, on the first
   screen where you teach what your numbers mean. It also spends a billed batch on unconverted
   traffic. ⚠️ **Caveat: nobody has read `lane-reveal.tsx` yet this lane** — check what is left on the
   card once the meter goes before committing to the removal.
2. **The mobile arrival's composer is 225px BELOW THE FOLD.** Measured 393×852: field at y=1138 in an
   852px viewport, `scrollY` 0. The single-column shelf is 875px tall and the dock is not pinned on
   this surface, so you scroll past six cards to reach the thing you type into. Pre-existing. May be
   the intended "content-first arrival" (it is in the concept SSOT) or a real defect.
3. **Copy review + drop economics** — `docs/OWNER-REVIEW-2026-08-10-v8-copy-and-economics.md`.
   **Recommendation: split it.** Do the ARRIVAL copy now (first screen, just settled, ~6 lines
   including `"Nothing simulated yet. Results land here, ranked."` and `"Proven videos, rebuilt for
   your niche"`), and **add the archetype labels to that pass** — rows read "The Passive Dopamine Hit
   — 12%", which comes out of calibration, not out of anything written for a reader. Leave the rest
   of the inventory until near launch. Also still owed: `AUTO_LABEL` / `AUTO_DESC` and the rewritten
   `PROMISE_BY_TOOL.chat`.

## 3. Open — recommended CLOSED, do not spend time here

4. **The last 88px above the composer. Recommendation: leave it.** 220px was a hole; 88px above a
   docked composer is ordinary breathing room. Closing it needs `min-h-full` to resolve, i.e. an
   `h-full` on the shared wrapper at `composer.tsx:3794` **which also hosts every chat thread**. The
   failure mode is a broken scroll on the main surface — a thing that has gone unnoticed here before.
   Not worth it for ~60px of redistribution.
5. **The ten archetype rows read flat** (15/12/12/10/10/10/8/8/8/7). **Recommendation: do NOT
   truncate.** The flatness is the truth; trimming to a top three implies a concentration that does
   not exist, which is exactly the drift this project keeps getting bitten by. If the board still
   feels wrong, it is a **copy** problem (the labels), not a row-count problem — see §2.3.

## 4. Closed this session — do not re-open

- ~~"The mobile arrival states the audience nowhere until you tap."~~ **FALSE — it already does.**
  Measured 393×852: `audience-header-slot` is mounted, 45px, `"@mrbeast · calibrated"`.
  ⚠️ **Do not reason about `useHeader` from the branch name.** `useHeader = homeThreadMode && !isXl`,
  and **the arrival renders INSIDE the `homeThreadMode` branch** (`composer.tsx` ~L3805), not the
  centered one. This nearly cost a rebuild of a shipped feature.
- ~~The tall shelf→composer gap~~ — 221 → 88px, see §1b and §3.4.
- ~~`pickLane` prefill~~ — fixed, §1c.

---

## 5. Traps this session paid for

1. **`NEXT_PUBLIC_CONCEPT_V8` is NOT in `.env.local`.** Pass it inline or you verify the flag-OFF UI
   and conclude v8 regressed. Cost a full verification pass.
2. **The arrival is a COOKIE state**, `maven_active_thread=__new__`, not localStorage. Without it the
   server rehydrates the newest open thread, which *looks* like the arrival unless you check the
   sidebar. Cost a second pass.
3. **`min-h-full` silently does nothing** under a height:auto ancestor — and so does the `justify-*`
   that depends on it. Measure `getBoundingClientRect`, never trust the class.
4. **No named helpers inside `page.evaluate()`** — tsx/esbuild injects a `__name` shim that does not
   exist in the page realm and the call dies with `ReferenceError: __name is not defined`. Pass the
   body as a **string**, or use `function` expressions.
5. **`window.scrollTo(0, body.scrollHeight)` does not move the home surface** — the scroll lives in an
   inner `overflow-y-auto` region, so a body-scroll probe reports it as unscrollable.
6. **Suite flakes are WIDER than previously documented.** `composer-offline-gate`,
   `composer-stop-disc`, `composer-fold-on-close`, `omni-analysis-*` all time out under full-suite
   load and pass isolated, and **the failing set differs between runs**. **Run the suite twice before
   believing a new failure.** Baseline is exactly **1** real failure (`routing-cut`).
7. **The drops route is a real POST.** A 2.5s wait screenshots an empty shelf and lies about it; use
   ≥6s.

---

## 6. State of the world

- **`main` = `0edbc933`.** Lane branch `lane/platform-concept` = `47c23c79`, pushed, content-diff vs
  main is **zero**.
- **NOTHING IS DEPLOYED, and that is deliberate.** Vercel git is disconnected because the **owner is
  switching accounts** (stated 2026-08-11). Do not try to "fix" the disconnection, and do not assume
  merging ships anything.
- **Working tree carries changes that must NEVER be committed:**
  - `src/app/(app)/start/page.tsx` and `src/components/surfaces/start-page.tsx` — the restored
    `/start` review build. These are the sole cause of the 1 baseline test failure.
  - `scripts/zz-mint-cookie.ts`, `zz-shot.ts`, `zz-measure.ts`, `zz-devpage.ts`, `zz-mobile.ts` —
    untracked verification throwaways. **Explicit `git add` paths only. Never `git add -A`.**
- **`.githooks/post-commit` AUTO-PUSHES.** On this repo, commit = push. **Run every gate BEFORE
  committing.**
- Phases 4 and 6 stay **SKIPPED**. **Audit the live product before building any mock section.**

## 7. How to see it

```bash
# 1. dev, with the flag ON (it is NOT in .env.local)
NEXT_PUBLIC_CONCEPT_V8=true npm run dev -- --port 3010

# 2. sign in + land on the ARRIVAL (cookie, not localStorage)
npx tsx scripts/zz-mint-cookie.ts /tmp/cookies.json   # e2e account
# then in the browser: open /home and press ⌘N (New Thread) — that sets maven_active_thread=__new__

# 3. automated: both native viewports + the thread state, with probes
npx tsx scripts/zz-shot.ts        # writes desktop-arrival / mobile-arrival / desktop-thread
npx tsx scripts/zz-measure.ts     # box geometry: headroom, gap, dock position
```
A launchd reaper kills idle dev servers after ~10 min — check the log before debugging a "crash".
`npm run build` clobbers a running dev server's `.next`; restart dev after building.

## 8. Gates at close

`tsc --noEmit` clean · `npm run build` clean · vitest **5796 passed / 1 failed** = the `routing-cut`
baseline from the two protected `/start` files. Flaky files re-run isolated and passed.
