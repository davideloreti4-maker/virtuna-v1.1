# Handoff — 2026-08-13: the dock reserve moves with the chips, and the phone names the room

> **Session of 2026-08-13, worktree `~/virtuna-platform-concept`, branch `lane/platform-concept`.**
> **Nothing is deployed** — Vercel git is disconnected because the owner is switching accounts.
> That is deliberate; do not "fix" it.
>
> **Precedence.** This doc is the ruling record for both items below and outranks
> `docs/HANDOFF-2026-08-12-day0-meter-and-rail-rows.md` on them. Doc 2026-08-12 still rules
> everything else it covers; `docs/HANDOFF-2026-08-11-v8-rail-restored.md` still rules the v8 shape.

---

## 1. Owner ruling 1 — the reserve moves with the chips, it does not get bumped

Doc 2026-08-12 §4.1 left this open because the fix touches `composer-thread-region`, which hosts
**every chat thread**, and asked for the dock to be measured in a live thread before a number was
picked. It was. **The reserve turned out not to be wrong for chat threads at all.**

Measured in-browser, signed-in, v8 ON, native contexts, **at true max scroll**:

| surface | viewport | dock band | reserve was | verdict |
|---|---|---|---|---|
| **v8 arrival** | 393×852 | **238px** | `pb-[184px]` | **54px SHORT → 30px overlap** |
| chat thread | 393×852 | **184px** | `pb-[184px]` | **exact, to the pixel** |
| v8 arrival | 1440×900 | 187px | `pb-[184px]` | 3px short — moot, that surface never scrolls |
| chat thread | 1440×900 | **133px** | `pb-[184px]` | **51px over-reserved already** |

**The whole 54px is the chips row** — `mt-2.5` (10) + chips (34) + `mb-2.5` (10) — which renders
only under `CONCEPT_V8_ENABLED && !hasConversationContent && !roomExpanded`, i.e. never in a chat
thread. So the reserve follows the chips instead of being raised for surfaces that don't have them.

**Ruled: `pb-[240px]` under `showV8Chips`, `pb-[184px]` otherwise.**

A static bump to 240 was rejected on the measurement: the desktop thread is *already* 51px generous,
and paying for the chips there would rest its last message **107px** above the composer. A runtime
`ResizeObserver` was rejected as a re-layout inside the app's most load-bearing layout for a
deficit with one named, declarable cause.

### What changed

- `composer.tsx` — `showV8Chips` **hoisted** above the layout branches; the scroll region's
  `className` became a `cn()` with the conditional pad, and the chips render off the same const.
  Two copies of that expression is exactly how the overlap comes back silently: **no padding value
  announces which element it was measured against.**

### The symptom, for the record

At max scroll the sixth drop card ran 30px under the band and **the chips row bisected its Remix
button**. Worse than the number: the band is transparent above the composer box (the opaque backdrop
lives on the box, not the wrapper), so the card showed **through** the chips rather than behind them
— and the chips wrapper is `pointer-events-auto`, so it ate the tap as well.

### Verified

Four combinations, at true max scroll, before and after:

- **arrival 393×852** — 30px overlap → **26px clearance**; receipt and Remix whole and above the chips.
- **thread 393×852** — `maxScroll` 38557 → **38557**, band 184, unchanged.
- **arrival 1440×900** — content column bottom 643 → **643**, unchanged.
- **thread 1440×900** — `maxScroll` 26185 → **26185**, unchanged.

Re-verified after §2 landed (the +25px of content moves nothing relative): still 26px.

---

## 2. Owner ruling 2 — the phone's first screen names the room

Doc 2026-08-12 §4.2 left this as a design call. Measured at 393×852, `scrollY 0`: the first screen
was hamburger · brand mark (y 86) · serif greeting (y 128) · one 11px caption (y 193) · four whole
cards. **Nothing named the audience.** `audience-header-slot` is mounted, but at **y=1,133** — and
it states the CREATOR's handle (`@mrbeast · calibrated`), not the room.

**Ruled: name it — one muted line under the greeting, and make it a door.**

The argument is the one r3 accepted for the desktop rail (*"the arrival was a greeting, a shelf and
a composer — the shape of every chat app"*), and it lands harder here: on desktop the rail is on
screen at rest; a phone has no 400px column to put one in. So the phone gets **the fact plus a door
to the board**, not a board.

### What changed

- `arrival.tsx` — a room line under the greeting, composed from **`audienceToMeta`**, the same meta
  the rail header reads: `1,000 viewers · calibrated · simulating for TikTok`. A `<button>` when an
  opener is wired (it calls `handleRoomExpandedChange` — the **same sheet** the dock's plate opens,
  not a second surface), a `<p>` when not, and **nothing at all without an audience** — a fabricated
  headcount is worse than silence.
- **`xl:hidden`.** At ≥xl the rail states these facts verbatim in its own header; printing the
  sentence twice on one screen is what the foot chip's `showName={!useHeader && !useRail}` rule
  already exists to prevent.
- **`TIER_VIEWERS` + `roomHeadcount` moved into `ambient-v2-audience-meta.ts`**, and
  `AmbientOverview.tsx` now imports them instead of defining `TIER_N` locally. Two surfaces state
  the owner-ruled headcount; a second literal is how they stop agreeing.
  ⚠️ **`AmbientSimulate` keeps its own copy on purpose** — there the number is multiplied by a
  segment's share to size a panel, which is a different claim than "this is how big the room is".
- The role is the shelf caption's (`text-caption text-foreground-muted`, 11px, `#8a857c`),
  deliberately: **the greeting stays the arrival's only heading** (r5). Zero accent — dosage LOCKED,
  and this is not one of the three sanctioned uses.

### Verified

- **393×852** — line present, `BUTTON`, **one line** at 266px in a 373px box, 11px Inter,
  `rgb(138,133,124)`. Sits y 167–183, between greeting (ends 157) and caption (starts 219).
  First card 221 → **246**; **four whole cards still above the fold**.
- **Tapping it** opens the full-screen room sheet on the real resting board — "In the room ·
  10 groups", the ten curated names with their verbatim repaints.
- **1440×900** — line is `display:none` (0×0, so not clickable either), rail present, and
  greeting / caption / first card sit at **106 / 175 / 203**, identical to before.

---

## 3. Traps this session paid for

1. **`composer-thread-region` is the scroller on the mobile THREAD and NOT on the mobile ARRIVAL.**
   Same testid, two roles. On the arrival `<main>` scrolls (`canScroll: 408`) and the region is
   1,260px tall with `maxScroll: 0` — so setting `region.scrollTop` is a **no-op** there and the
   overlap never reproduces. Walk `*` and scroll every element with `scrollHeight > clientHeight`.
2. **A cloned-node wrap probe measures padding too.** `height / lineHeight` reported "2 lines" for a
   string that visibly renders on one (the caption carries ~12px of bottom pad). Compare the
   candidate's height against a **known one-liner's** height instead of dividing.
3. **The local `main` ref was stale** — `6f344876` while `origin/main` was `b5d9f0db`, so
   `git diff main...HEAD` read as 19 changed files when the real content diff vs `origin/main` is
   **zero**. `git fetch` before measuring anything against main.
4. **The `scripts/zz-*.ts` dead `DIR` is real** (doc 2026-08-12 §5.5) — confirmed and updated. The
   reaper killed the dev server **twice** mid-verification; both times it read as a Playwright
   `ERR_CONNECTION_REFUSED`, not as a crash.
5. All prior traps still hold: `NEXT_PUBLIC_CONCEPT_V8` is not in `.env.local` · the arrival is a
   **cookie** state (`maven_active_thread=__new__`) · no named helpers inside `page.evaluate()` ·
   `npm run build` clobbers a running dev server's `.next`.

---

## 4. Gates

`tsc --noEmit` clean · `npm run build` clean · vitest run **twice, identical both times**:
**5811 passed / 1 failed** = the `routing-cut` baseline from the two protected uncommitted `/start`
files. **Zero flakes in either run.** (+8 on the 5803 baseline = the 8 tests added below.)

**Tests added** — 6 in `v8/__tests__/arrival.test.tsx` (facts composed from the meta, `xl:hidden`,
it is a button and calls the opener, static `<p>` without one, silent without an audience, no
accent) and 2 in `__tests__/composer-v8.test.tsx` (the reserve is `pb-[240px]` exactly where the
chips are; opening the room drops the chips **and** the reserve back to 184).

**Flag-off:** both changes sit behind `CONCEPT_V8_ENABLED` (`showV8Chips` includes it; `ArrivalV8`
only mounts under it). The `TIER_VIEWERS` move is value-identical on both flags. The whole suite
runs flag-off by default and is green.

## 5. State of the tree

**Nothing is committed.** Working tree carries the six files above plus, as always:

- `src/app/(app)/start/page.tsx` and `src/components/surfaces/start-page.tsx` — **NEVER COMMIT.**
  The sole cause of the 1 baseline failure.
- `scripts/zz-*.ts` — untracked throwaways, now nine of them (`zz-dock`, `zz-dock2`, `zz-first`,
  `zz-gap`, `zz-room-line` are this session's). **Explicit `git add` paths only. Never `git add -A`.**
- `.githooks/post-commit` **AUTO-PUSHES**. Gates before commit, always.

## 6. Still open

- **Phases 4 and 6 stay SKIPPED.** Audit the live product before building any mock section.
- The repaint prose is analyst third person ("Consumes content passively"). Improving it means
  changing the generator prompt in `enrich-signature.ts`, which changes what the model receives and
  needs recalibration of existing audiences. Separate job, not a display fix.
- The desktop chat thread over-reserves its dock by **51px** (band 133 vs `pb-[184px]`). Harmless —
  it only means the last message rests further above the composer — and left alone deliberately:
  narrowing it is a change to the shared region for no defect.

Do **not** reopen: the last 88px composer gap · truncating the ten archetype rows · the rail
scrolling at 900px · the day-0 lane meter. All ruled.
