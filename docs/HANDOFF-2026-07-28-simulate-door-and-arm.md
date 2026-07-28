# Handoff — The ＋ door (bring your own stimulus) + the ARM screen redesign

**Date:** 2026-07-28 · **Worktree:** `~/virtuna-platform` · **Branch:** `lane/platform-surface`
**Status:** specced, not started. No code written for this lane yet.

---

## §0 — The brief in one paragraph

Today a creator can only simulate something a **skill generated**. There is no way to bring your own
hook, script, video file, or link and put it in front of the room. The door for that was designed —
two components' docstrings describe it as if it exists — and was **never built**. This lane builds it:
a `＋` door in the room rail (and on Start) that opens a three-input intake (text · video file ·
link), then the ARM screen, then fires the real run and lands the result as a row on the same board.
Along the way it fixes the ARM screen, which currently collects five dials and **throws all five
away**.

---

## §1 — Finding 1: the door was designed, never built

`AmbientStart.tsx` docstring, line ~19:

> *"ONE visually-distinct SIMULATE DOOR — 'Test something against your audience →' — the separate,
> deliberate screening act (a video / a draft / ask the room). Kept its own act so simulation never
> reads as one more maker in the list."*

`AmbientSimulate.tsx` docstring also refers to *"the ④ 'Test something against your audience →' door"*
as an existing entry point.

**It does not exist.** Evidence:

- `AmbientStart.tsx` has exactly **one** `onSkill?.()` call site — the skill tiles. No door element.
- `AmbientStartHome.tsx` (the real app mount, `composer.tsx:3126` / `:3184`) passes only
  `onSkill` / `onSubmit`. There is no door handler to pass.
- The rail's equivalent is mis-wired. `AmbientOverviewRail.tsx`:
  ```js
  onTestVariant={() => descriptors[0] && openDevelop(descriptors[0].id)}
  ```
  - **Empty rail → dead button.** `descriptors[0]` is `undefined`, `&&` short-circuits.
    *Verified live 2026-07-28:* clicked "＋ Test a new variant" on a `descriptors={[]}` rail in
    `/dev/cards`; nothing happened. It is the only control on a new creator's whole panel.
  - **Non-empty rail → the label lies.** It opens `develop` mode pre-filled with `descriptors[0]` —
    re-arming your *first existing card*, not testing a new variant.
- `mode="cold"` (the intake step) is unreachable in the shipped app. Only `/ambient-v2/page.tsx:201`
  routes to it — a dev review page.
- Even `cold` couldn't accept a new stimulus if you reached it:
  ```js
  const stimulus = picked?.stimulusKind ? { text: data.stimulus.text, kind: picked.stimulusKind } : data.stimulus;
  ```
  It swaps the **kind** and keeps whatever text the *caller* passed. There is exactly **one `<input>`
  in the entire arm panel** (`AmbientSimulate.tsx:371`) and it is the custom-*lens* field
  ("or ask your own question…"), not the stimulus. `SimulateIntake.tsx` has zero inputs.

**Coverage today:**

| you bring | path |
|---|---|
| a video | ✅ the `test` "Video test" skill tile (the `/analyze` pipeline) |
| a hook / script / draft text | ❌ **nothing** — you must generate one with a skill first |

---

## §2 — Finding 2: the ARM screen's dials are decorative

This is the bigger one, and it is the screen the owner wants to redesign.

`AmbientSimulate` collects five dials into a `SimulateConfig` and emits it correctly:

```ts
export interface SimulateConfig {
  lensKey: SimLens["key"];   // stop | finish | share | follow | buy
  custom?: string;           // the free-text question, compiled to the nearest lens
  segment: string;           // THE SLICE
  n: number;                 // how many minds
  scene: string;             // TikTok / IG / no feed
  fidelity: SimTier;         // flash | max
}
onSimulate?: (config: SimulateConfig) => void;   // emitted at AmbientSimulate.tsx:466
```

The rail's caller **discards it**:

```js
onSimulate={() => fireSim(armedId)}          // AmbientOverviewRail — config dropped on the floor
```

and `fireSim` posts:

```js
body: JSON.stringify({ text, pin: true, persist: true, ...(framing ? { framing } : {}) })
// `framing` comes from framingOf(d?.kind) — the DESCRIPTOR's kind, not the picked lens.
```

So the lens you pick, the slice, the N, the scene and the fidelity **never reach the engine**. Every
run is the audience default.

Worse, the route can't receive most of them. `ReactBodySchema` accepts exactly:

```ts
{ text: string, framing?: "hook" | "idea", intent?: "grow" | "sell", pin?, persist? }
```

| ARM dial | route-side equivalent today |
|---|---|
| lens (5 values) | ❌ effectively none — see below |
| slice / segment | ❌ none |
| n (minds) | ❌ none |
| scene | ❌ none |
| fidelity | ❌ none — but see §4, it should be the **route switch** |

**On the lens specifically** (verified 2026-07-28 — an earlier draft of this doc got it wrong):
`framing: "hook" | "idea"` is the only lens-adjacent field, and it is set from the *descriptor's kind*,
not the picked lens. **`intent` is NOT a second half of the lens** — `intent-lens.ts` defines
`IntentLens = "grow" | "sell"`, an *audience-goal* axis derived from `audience.goal_intent` via
`goalIntentToLens()`, and it is gated to calibrated audiences only. Conflating it with the behavior
lens (stop/finish/share/follow/buy) would be a category error. So the loud dial has **no route-side
home at all** — honoring it is new route work.

⚠️ **Consequence for planning:** making the dials real is **route work, not UI work.** Do not scope
this lane as "restyle a panel". Either wire them or visibly disable them — but a control that silently
does nothing is worse than no control.

---

## §3 — The decided design (owner-confirmed 2026-07-28)

### Flow

```
＋ Test something of your own
        ↓
   "What are you testing?"
   [ paste text ] · [ drop a video file ] · [ paste a link ]
        ↓
   ARM A SIMULATION          ← one screen, three variants (§5)
        ↓  Simulate ↑
   lands as a row on the same board
```

### Decisions locked

1. **Straight to ARM. Never queue a brought stimulus.** — *owner call, and forced by the code.*
   `parsePersonaStops("")` returns **`0`**. A pasted draft has no projection (nothing generated it,
   so there's no self-estimated `personaStops`). Queue it and `buildOverviewData` gives it
   `personaStops: 0, state: "queued"`, and `queuedRankKey` sorts it **dead last showing 0/10** — a
   fabricated "the room hates this" verdict on something the room has never seen. Avoiding that
   would mean inventing a third row state ("unranked") in the adapter, the sort and the Overview.
   Not worth it, and it contradicts the surface's honesty spine.

2. **Three inputs: text + video file + link.** — *owner call.*

3. **One ARM screen, not two.** The fidelity dial IS the route switch (§4). Video is not a separate
   pipeline — it's the same engine on a different `input_mode`.

4. **`develop` mode is meaningless on this path.** Its premise is *"deepening your rank — refines it,
   never overturns it."* There is no rank to deepen, so the tie-back band must not render.

5. **Mount the same intake twice:** the rail `＋` (in-thread) and a real door on `AmbientStart`
   (pre-thread). A new creator holding a script shouldn't have to run a skill first. Same component,
   two mounts — which is what the docstring intended all along.

---

## §4 — The route table

`AnalysisInputSchema` (`src/lib/engine/types.ts:157`) already carries all three inputs on one axis:

```ts
input_mode: z.enum(["text", "tiktok_url", "video_upload"])
```

| stimulus | Flash | Max |
|---|---|---|
| text | ✅ `POST /api/tools/react` | ⚠️ `POST /api/analyze` `input_mode:"text"` — **no live caller** |
| video file | — *(no Flash video path)* | ✅ `POST /api/analyze` `input_mode:"video_upload"` |
| link | — | ✅ `POST /api/analyze` `input_mode:"tiktok_url"` |

**`/api/tools/react` is text-only** — `ReactBodySchema.text: z.string().trim().min(1)`. It cannot
take a video. That is why video has no Flash row and the fidelity dial locks to Max for video.

⚠️ **text → Max is schema-valid but unproven in the product** (verified 2026-07-28). The only things
passing `input_mode: "text"` are a test fixture, `eval-runner.ts`, and `content-form.tsx` — and
`ContentForm` **is not mounted anywhere in `src/app`** (legacy, dead). So that cell is a *new path*,
not a wiring job.

➡️ **Scoping consequence: descope text → Max from v1.** Ship text→Flash and video/link→Max. The
fidelity dial then reads honestly in both cold variants — locked to Flash for text, locked to Max for
video — and no untested engine path ships. Unlocking text→Max is a clean follow-up.

### Spend — read this before wiring

| route | credit gate | cost |
|---|---|---|
| `/api/analyze` | ✅ gated — imports `getCreditQuotaVerdict` + `quotaRefusalBody` | `CREDIT_COSTS.score = 10` |
| `/api/tools/react` | ❌ **no gate import, no `CREDIT_COSTS` entry** | apparently free |

⚠️ Making the `＋` door prominent turns an **ungated, unmetered** Flash room read into a primary
action. There is precedent for this being a real problem on this codebase (chat-dispatched runs and
`/api/account-read` are both known ungated). **This is an owner pricing decision (§8), not an
implementation detail — do not silently ship it either way.**

---

## §5 — The ARM screen: what to redesign

### The measured problem

Measured live on the rail at a real 858px panel (`/dev/cards` → The Room → rail → tap a queued row):

| band | px | share |
|---|---|---|
| preamble (kicker · tie-back · stimulus card) | 286 | **33%** |
| **THE LENS** | 166 | **19%** |
| THE SLICE | 184 | 21% |
| footer + actions | ~130 | 15% |
| trailing dead space | 92 | 11% |

The preamble outweighs the lens **1.7 : 1** — but the component's own docstring states the design law:

> *"The LENS is the one loud dial; everything else is quiet."*

The screen contradicts its own spec, measurably.

### Two more defects, both visible in the owner's screenshot

- **The footer restates 5 of 5 facts already on screen.** "Screening **1,000** of **General** for
  **"would they stop"** · on **TikTok** · **SIM-1 Flash**" — every one of those five appears above it.
- **The audience is named three ways at once:** "Everyone" (the slice chip) · "the whole room" (the
  caption) · "in General" (the conditions line). Same thing, three registers.

### The three variants (one layout, bands toggling)

| band | ① develop (from a rank) | ② cold · text | ③ cold · video |
|---|---|---|---|
| tie-back ("STRONG 9/10 · deepening your rank") | **on** | off | off |
| stimulus block | the card's text | the pasted text | filename / thumbnail / the link |
| **THE LENS** | live — the loud dial | live — the loud dial | **quiet** ▲ |
| THE SLICE | live | live | live |
| scene (TikTok/IG) | live | live | live, or inferred from the link |
| fidelity Flash/Max | live | **locked to Flash** in v1 ◆◆ | **locked to Max** ◆ |
| wait | seconds | seconds | 1–3 min |
| lands as | concept row | concept row | video row |

◆ **Measured, not opinion.** There is no Flash video path (`react` is text-only), and the rail already
hardcodes `tier: "max"` for video seals with the comment *"a Test is the Max video pipeline, never
Flash."* Render it **locked with a reason** — a control that silently vanishes reads as a bug.

◆◆ **v1 only.** text→Max has no live caller (§4), so shipping the Max option for text would ship an
unexercised engine path. Lock it with a reason, unlock in the follow-up. *(Variant ① keeps a live
dial only if the develop path already exercises Max — confirm before wiring.)*

▲ **Design call, not the code's.** A Max video read returns the whole attention curve *and* all action
intents at once, so the lens isn't selecting what gets measured — everything does. It stays meaningful
as "what am I optimising for", so keep it visible but quiet rather than deleting it. **Owner may
overrule.**

**Design variant ② first.** ① is ② plus one band; ③ is ② with two dials changed. Both cold variants
drop the tie-back, which reclaims the top of that 286px preamble and moves the LENS up toward the
budget its own law demands.

---

## §6 — Build plan

### Phase 1 — make the dials honest *(do this first; it is the trust floor)*
Either wire `SimulateConfig` through to the run, or visibly disable what can't be honored.
- Decide per dial using the §2 table.
- `fireSim` currently ignores the config argument entirely — start there.
- Any dial that can't reach the engine must render disabled-with-a-reason, never silently inert.

### Phase 2 — the intake collects a stimulus
- `SimulateIntake` gains the actual input per door: textarea (draft) · file (video) · URL (link).
- Reuse, **do not rebuild**: `src/components/thread/input-request-block.tsx` already has the file
  upload path (`:483`, handles `video/mp4`) and the link field (`:569`, `https://tiktok.com/…`
  placeholder). The composer's own upload path is at `composer.tsx:1405` / `:1842`.
- `cold` mode must stop reading `data.stimulus.text` from the caller.

### Phase 3 — wire the doors
- Rail: `onTestVariant` → open cold intake (**not** `openDevelop(descriptors[0].id)`).
- Relabel: "＋ Test a new variant" → "＋ Test something of your own" (the current copy promises a
  variant of an existing row and delivers something else).
- `AmbientStart`: add the real SIMULATE DOOR element its docstring describes; thread a new handler
  through `AmbientStartHome` (`onSimDoor`) to the composer.

### Phase 4 — route + land
- **PREREQUISITE (owner call, §8):** gate + price `/api/tools/react` first. It has no gate and no
  `CREDIT_COSTS` entry today; this door must not ship on top of an unmetered route. Mirror
  `/api/analyze` (`getCreditQuotaVerdict` + `quotaRefusalBody`) and price against the existing ladder.
  ⚠️ Enumerate every caller of `react` before gating — the composer's `ask` verb is one, and silently
  gating it would break that path.
- Text → Flash: `/api/tools/react` `{ text, pin:true, persist:true }` → concept row.
- Video / link → Max: `/api/analyze` with `input_mode: "video_upload"` / `"tiktok_url"` → video row.
  Reuse the composer's storage upload and the Test skill's `/api/tools/test/card` seam (§7).
- **Text → Max is OUT of v1** — no live caller (§4). Lock the dial, ship, unlock in a follow-up.
- ⚠️ **Orphan-seal trap:** seals are only ever read *through* a descriptor —
  `snapshotFor` does `descriptors.find(...)` then `persistedSeals[d.conceptText.trim()]`. Writing a
  seal for a stimulus that has no descriptor produces a row **nothing renders**. The descriptor must
  exist too.

### Phase 5 — the redesign
Variant ② first, per §5.

### Phase 6 — pin it in `/dev/cards`
Add a `room-simulate` section to The Room tab with all three ARM variants + the intake states, so this
screen stops being reachable only by clicking through. Follow the pattern already there (the tab reads
`AMBIENT_V2_ENABLED` and labels itself; keep that).

---

## §7 — Verified vs assumed

**The single most expensive mistake on this codebase is planning work on an unverified finding.**
Everything below marked ✅ was checked against the code or the running app on 2026-07-28.

✅ Verified
- The `＋` button is dead on an empty rail (clicked it live, nothing happened).
- `AmbientStart` has no door element (one `onSkill` call site).
- `cold` mode cannot accept a stimulus (one `<input>` in the file, it's the lens field).
- `onSimulate` emits a full `SimulateConfig`; `fireSim` discards it.
- `ReactBodySchema` is text-only and accepts none of slice/n/scene/fidelity.
- `parsePersonaStops("")` → `0`.
- `AnalysisInputSchema` carries all three input modes.
- `/api/analyze` is credit-gated; `/api/tools/react` has no gate import and no `CREDIT_COSTS` entry.
- `input-request-block.tsx` has working file + link intake.

✅ Resolved in a second pass, same day — *three items that were open in the first draft*
- **`intent` is NOT a lens.** `IntentLens = "grow" | "sell"` (`intent-lens.ts`) is an *audience-goal*
  axis derived from `audience.goal_intent` via `goalIntentToLens()`, gated to calibrated audiences.
  The first draft treated it as half a lens mapping — that was wrong. The behavior lens
  (stop/finish/share/follow/buy) has **no route-side home at all**.
- **The video upload path is real and reusable.** `composer.tsx` uploads to
  `supabase.storage.from("videos")` at `${userId}/${nanoid()}.${ext}`, then runs analyze. The Test
  skill validates a TikTok URL (`isValidTikTok`) and on completion `POST`s
  `/api/tools/test/card { analysisId }` to mint the thread card. Both halves reusable.
- **text → Max has no live caller.** Only a test fixture, `eval-runner.ts`, and the *unmounted* legacy
  `content-form.tsx`. ⇒ descoped from v1 (§4).

⚠️ Still open — **check before building on these**
- Whether the lens should stay visible for video (§5 ▲) — a design call, owner may overrule.
- Whether the `develop` path already exercises Max, which decides whether variant ①'s fidelity dial
  can stay live in v1 (§5 ◆◆).
- Whether an `/api/analyze` result reached from the `＋` door can become a board row **without** going
  through the Test skill's card route. The pieces exist; that seam was not traced.

---

## §8 — Open owner decisions

1. ~~**Pricing.**~~ ✅ **DECIDED 2026-07-28 (owner): gate + price `/api/tools/react` BEFORE the door
   ships.** It is currently ungated with no `CREDIT_COSTS` entry, and the `＋` door would promote an
   unlimited free Flash read to a primary action. This is now a Phase-4 prerequisite, not a follow-up
   — the door does not ship without it. Pick the credit price against the existing ladder
   (`read: 1` · `simulate: 2` · `score: 10`) and gate it the same way `/api/analyze` does
   (`getCreditQuotaVerdict` + `quotaRefusalBody`). ⚠️ Check what else calls `react` before gating —
   the composer's `ask` verb is one caller today and gating it silently would break that path.
2. **The lens on video** — quiet, or gone? (§5 ▲)
3. **Which dials get wired vs disabled** in Phase 1. Wiring slice/n/scene/fiditely means route work on
   `/api/tools/react`; disabling them is honest and cheap. Recommend: wire what's cheap, disable the
   rest visibly, ship, then revisit.

---

## §9 — Verification protocol (this app has specific traps)

- **`/dev/cards` needs auth.** `(app)` layout redirects. Password sign-in is behind the
  "Sign in with a password instead" button — the default form is now OTP. Two `input[name="email"]`
  exist on that page; target `input[placeholder="you@example.com"]`.
- **Playwright screenshots hang** — the ambient-room animations never settle. Verify with
  `getBoundingClientRect` / `getComputedStyle` probes, or raw Playwright with
  `animations:'disabled'` + `caret:'hide'`. Element screenshots clip at the viewport; resize first.
- **Run E2E on a production build**, not `next dev`. Dev StrictMode double-invoke fakes a broken
  funnel on this app (cost ~3h once). `npm run build && next start`.
- **Run the suite both flag ways.** It defaults `AMBIENT_V2_ENABLED` **off**, so a green run can be
  green for the product you are not shipping. Baseline on this branch: **4717/0**.
- **`AmbientDetail` / the v2 panels need a bounded host.** An unbounded-height wrapper rendered
  2,182px instead of 800 once. `presentation="rail"` sets `height:100%` — give it a real box.
- **`tailwind-merge` silently deletes custom `text-*` classes** when a colour shares the `cn()`. The
  tell is arithmetic: `tracking-[0.08em]` computing to 1.28px means a 16px base, not your 11px.
  Guard is in `src/lib/utils.ts`.
- **`supabase db push` is UNSAFE here** — 48 local-only / 41 remote-only migrations; it would recreate
  the `threads` table. Dev and prod share ONE project. Single migrations go via the SQL editor.

---

## §10 — Coordination: read this before you touch anything

A **second session** is working in this same worktree on the thread/chat UX
(`docs/PLAN-one-thread-one-renderer.md`). As of 2026-07-28 it has uncommitted work in:

`composer.tsx` · `message-blocks.tsx` · `outlier-grid-block.tsx` · `persisted-thread-stream.tsx` ·
`hook-test-context.tsx` · `block-registry.ts` · `blocks.ts` · new `thread-turn.tsx` /
`run-header-block.tsx` / `use-active-run.ts` / `use-outlier-grid-actions.ts`, and it **deleted all
seven `*-thread-view.tsx` components**.

**Also uncommitted and shared: `src/app/(app)/dev/cards/page.tsx`.** It holds *both* this session's
Room-tab rebuild (v2 rail · sheet · depth drill · flag banner) and their `ThreadTurn` adapter. Land
that file before adding the Phase-6 section to it.

Their plan lists as **out of scope / ships after**: deleting the composer skill pill and the `ask`
"Ask the room" skill — but notes **`/api/tools/react` stays, because the room rail is its other
caller.** That is why this lane's door does not depend on the `ask` verb and is safe to build now.

---

## §11 — Copy-paste kickoff prompt for a fresh context

```
Read docs/HANDOFF-2026-07-28-simulate-door-and-arm.md end to end before doing anything.

Context: virtuna-platform, branch lane/platform-surface. A second session shares this worktree and
has uncommitted work in composer.tsx + the thread/* files + dev/cards/page.tsx — do not touch those
without checking git status first (§10).

Goal: build the "＋ Test something of your own" door — the bring-your-own-stimulus path into the
room — and fix the ARM screen it opens.

Two findings drive this lane, both verified 2026-07-28:
1. The door is documented in two components' docstrings and was never built. The rail's ＋ is dead on
   an empty rail and mis-wired on a full one.
2. The ARM screen collects five dials into a SimulateConfig and the caller discards all five. Making
   them real is ROUTE work, not UI work.

Start with Phase 1 (§6) — make the dials honest — because everything else sits on top of it. §7 has a
short "still open" list; confirm those against the codebase before you build on them and tell me what
you found. If any of it is wrong, say so and re-plan rather than building on it (an earlier draft of
this doc got the `intent`-is-a-lens claim wrong and it is corrected in §2 — expect the same).

Scope note: text → Max is deliberately OUT of v1 (§4) — it has no live caller, so shipping it would
ship an unexercised engine path. Lock that dial with a visible reason; don't quietly drop it.

Do not restyle anything until Phase 1 lands. Verify per §9 — this app hangs Playwright screenshots and
fakes broken funnels on `next dev`, so probe with getBoundingClientRect and run E2E on a prod build.
Suite baseline is 4717/0; run it with AMBIENT_V2_ENABLED both on and off.

§8 decision 1 is DECIDED: /api/tools/react gets gated + priced BEFORE this door ships — that is a
Phase-4 prerequisite, not a follow-up. Two smaller decisions there are still open; ask before
assuming an answer on those.
```
