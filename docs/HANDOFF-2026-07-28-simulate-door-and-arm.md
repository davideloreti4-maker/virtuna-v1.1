# Handoff — The ＋ door (bring your own stimulus) + the ARM screen redesign

**Date:** 2026-07-28 · **Worktree:** `~/virtuna-platform` · **Branch:** `lane/platform-surface`
**Status:** ✅ **Phase 1 LANDED** (`0f5d292c`, pushed). Phases 2–6 open. Read §0.5 before anything.

---

## §0.5 — STATUS after session 1 (2026-07-28). Read this before the rest of the doc.

**Phase 1 is done and verified: the five ARM dials now reach the engine or say why they can't.**
Commit `0f5d292c` — 13 files, suite **4787/0** flag off · **4788/0** flag on · tsc clean · prod
build passes · live-verified on a production build.

### What shipped

| dial | outcome |
|---|---|
| **lens** | ✅ **wired** — per-run directive on the volatile USER message (the `SELL_LENS_DIRECTIVE` seam). `stop` emits nothing ⇒ byte-identical to the pre-lens message. Split by domain. `buy` reuses the buying directive verbatim and does not stack under a `sell` intent. |
| **scene** | ✅ **wired** — `TikTok → socials`, `No feed → general` (`sceneToDomain`, in `flash-prompts.ts`). **Instagram REMOVED** — it had no engine frame, so picking it ran a TikTok sim under another name. |
| **slice** | ✅ **wired, but not as specced** — see the correction below. |
| **n** | derived display: `TIER_N[fidelity] × share`, which is now literally true (it equals the projection's `segment.total`). |
| **fidelity** | 🔒 **locked with a visible reason** in all three variants — `FIDELITY_LOCK` in `AmbientSimulate.tsx`. |

### ⚠️ Five things this doc got WRONG. Do not build on the originals.

1. **§5 ◆◆ / variant ① — the develop path does NOT exercise Max.** `fireSim` has only ever POSTed
   `/api/tools/react`, which is Flash-and-text-only. No variant has ever run Max, so ①'s fidelity
   dial locks too. All three lock in v1: ①/② Flash, ③ Max.
2. **§2 undersells the lens as expensive route work.** `SELL_LENS_DIRECTIVE` (`flash-prompts.ts`) was
   an exact precedent — a per-run directive on the user message that re-aims what the stop/scroll
   tokens MEAN, with no schema, coercion, cache-prefix or ENGINE_VERSION change. **The loud dial was
   the cheap one.** `buy` was already ~90% written as the sell lens.
3. **The slice cannot be a panel filter.** The 10-archetype prompt carries a "Critical Divergence
   Requirement" (verdicts MUST differ by profile), so ten copies of one archetype asks for
   divergence from identical inputs; and a fraction off the one or two matching slots is noise.
   **No panel subsetting and no share renormalization were needed:** `reactPopulation` already
   reports a real per-archetype split whose `total` is `share × N` — exactly the headcount the ARM
   screen already promised. A slice is now READ OUT of the projection that already ran. Honoured
   only where that projection exists; otherwise `{honored:false, reason}` and **nothing seals**.
4. **§4/§6 Phase 4: "text → Flash → concept row" is INCOMPLETE and will produce the orphan the same
   section warns about.** `persist:true` writes **only a seal**; the react route has no
   `insertMessage` at all. Concept rows come from `descriptors`, and descriptors derive *purely from
   rendered thread blocks* (`buildAmbientDescriptors`) — exactly 4 types (`idea-card` / `hook-card` /
   `script-card` / `remix-card`), each requiring `props.fraction`. **A brought-in text has no block ⇒
   no descriptor ⇒ the seal is orphaned and nothing renders.** The text path must ALSO insert a card
   block. `/api/tools/read` is NOT the seam — it emits `multi-audience-read`, not a descriptor type.
   *(Video is fine: video rows are read straight from the seal store, keyed by `analysisId`, and
   need no descriptor.)*
5. **§9 baseline 4717 is stale** (was already 4758 at session start) **and the §9 login recipe is
   wrong.** After clicking "Sign in with a password instead" there are **two forms**; the password
   form's button is **"Sign in"**. The first `button[type="submit"]` is the OTP form's "Continue",
   which stays permanently disabled — targeting it hangs 30s. The
   `input[placeholder="you@example.com"]` selector is correct.

### The honesty rule chosen for sliced rows (was §8.3 / task "ranking rule")

A sliced verdict carries its slice **all the way to the row**. `SimSeal` gained
`slice:{archetype,total}` (guarded in `readSimSeals` — a malformed blob DROPS the field rather than
mislabelling); `RailSnapshot` and `RankedStimulus` carry the label; `SealedRow` prints it as a chip
beside the %. Sliced rows still rank by their own pct in the same column — **the label is the
disclosure**. A sliced seal also writes `band:null`, because the band describes the 10-persona room
read and does not describe a slice.

### Owner decisions taken this session

- §8.2 **lens on video → keep it, quiet.** (Not yet implemented — that's Phase 5.)
- §8.3 **wire all three** (lens · scene · slice), not "wire the cheap ones and disable the rest".
- §8.1 price → **1 credit, under its own `react` key** (so the ledger can tell it from
  `/api/tools/read`). **Not yet implemented — this is the Phase-4 prerequisite.**

### Anti-drift guards added (each mutation-verified — a guard nobody has watched fail is a guess)

- `stop` no-op is byte-identical (breaking the default makes it fail).
- `buy` does not stack a second buying directive under a `sell` intent.
- A sliced run seals the SLICE's pct, not the room's; an un-honourable slice seals nothing.
- `SimLens["key"]` now **re-uses the engine's `BehaviorLens` union** instead of re-declaring it, and
  segments carry their engine `archetype` beside the creator-editable `label` — so the two
  namespaces cannot drift (the F-017 shape).

### Adjacent fix that fell out

`/api/tools/react` passed **no domain at all**, making it the one text-mode caller that ignored
`audience.mode` and fed a `mode:'general'` audience (analyst panel, hiring panel) the TikTok-FYP
prompt. It now agrees with `two-audience-read.ts` and `simulate-runner.ts`.

### ▶ Recommended next step

**The Phase-4 prerequisite: gate + price `/api/tools/react` (1 credit, own `react` key).** It is
decided, mechanical (mirror the four lines the other 11 paid routes use: `creditGate` → `if
(refusal) return refusal` → … → `billUsage`), and it is the only open item where being wrong costs
money. It is safe to land now — `creditGate` only refuses when `BILLING_ENFORCE_QUOTA` is on (it is
OFF in prod), so nobody sees a 402 today while `billUsage` starts recording real usage immediately.
Then **Phase 2** (the intake gaining real inputs). See §10 for why Phase 3 is blocked.

⚠️ **Gating react turns the composer's "Ask the room" (`ask` verb) from FREE into 1 credit.** That is
the owner's decision per §8.1, but it is a real product change and the second caller needs
`reportCredit402` or the paywall arrives with a futile retry under it (the `CreditWallRefusal`
lesson). That call site is `composer.tsx:2304` — a contested file, see §10.

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

~~⚠️ Still open~~ — ✅ **ALL THREE RESOLVED 2026-07-28 (session 1). Verified against the code.**
- ~~Whether the lens should stay visible for video~~ → **owner: keep it, quiet.** Phase 5 work.
- ~~Whether the `develop` path already exercises Max~~ → **NO. It never has.** `fireSim` only ever
  POSTs the Flash-and-text-only react route, so ①'s fidelity dial locks like the other two.
- ~~Whether an `/api/analyze` result can become a board row without the Test card route~~ →
  **SPLITS IN TWO.**
  - **Video: yes, no descriptor needed.** `videoSeals` is read straight from the seal store and
    `buildOverviewData` maps it into `videoRows` independently of `descriptors`
    (`ambient-v2-adapters.ts:142`). The key is the `analysisId`
    (`writeSimSeal(supabase, openThread, analysisId, …)`, `test/card` route). A `writeSimSeal`
    carrying a `video` blob is sufficient.
  - **Text: NO — and this is the §0.5 correction #4.** react persists a seal and never a message, so
    a brought-in text gets no descriptor and its seal is orphaned. The text path must insert a card
    block too.

---

## §8 — Open owner decisions

1. ~~**Pricing.**~~ ✅ **DECIDED 2026-07-28 (owner): gate + price `/api/tools/react` BEFORE the door
   ships.** It is currently ungated with no `CREDIT_COSTS` entry, and the `＋` door would promote an
   unlimited free Flash read to a primary action. This is now a Phase-4 prerequisite, not a follow-up
   — the door does not ship without it. Pick the credit price against the existing ladder
   (`read: 1` · `simulate: 2` · `score: 10`) and gate it the same way `/api/analyze` does
   (`getCreditQuotaVerdict` + `quotaRefusalBody`). ⚠️ Check what else calls `react` before gating —
   the composer's `ask` verb is one caller today and gating it silently would break that path.
2. ~~**The lens on video** — quiet, or gone?~~ ✅ **DECIDED 2026-07-28: keep it, QUIET.** Not yet
   implemented — Phase 5.
3. ~~**Which dials get wired vs disabled** in Phase 1.~~ ✅ **DECIDED 2026-07-28: wire ALL THREE**
   (lens · scene · slice), plus the ranking rule for sliced rows. **DONE — see §0.5.** The price in
   decision 1 was also settled: **1 credit, own `react` key.**

**Nothing is open for the owner right now.** The next session can build without asking.

---

## §9 — Verification protocol (this app has specific traps)

- **`/dev/cards` needs auth.** `(app)` layout redirects. Password sign-in is behind the
  "Sign in with a password instead" button — the default form is now OTP. Two `input[name="email"]`
  exist on that page; target `input[placeholder="you@example.com"]`.
  ⚠️ **The button is `Sign in`, NOT the first submit.** After the toggle there are **two forms**;
  `button[type="submit"]` resolves first to the OTP form's "Continue", which is permanently
  `disabled` — clicking it hangs for 30s. Working recipe (verified 2026-07-28):
  ```js
  await page.getByRole("button", { name: /password instead/i }).click();
  await page.locator('input[placeholder="you@example.com"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^Sign in$/ }).click();   // ← not button[type=submit]
  ```
- **`/ambient-v2` is a NO-AUTH review route** (200 without a session) and renders ④⑤① off fixtures —
  the fastest way to eyeball an ARM change. But it is fixture-driven: it does **not** exercise
  `buildSimulateData` / `audienceToMeta`, so an adapter bug is invisible there. Verify the adapter
  path through `/dev/cards → The Room → a queued row's "Simulate →"`.
- **Raw Playwright from a scratch dir needs an absolute import** —
  `import { chromium } from "/abs/path/to/virtuna-platform/node_modules/playwright/index.mjs"`.
  `NODE_PATH` does not work for ESM.
- **Importing a `src/lib/surfaces/*` module into an API route BREAKS THE PRODUCTION BUILD**
  (`TypeError: (0 , P.createContext) is not a function` at page-data collection — it drags the
  client component graph into the server bundle). `tsc` and the whole vitest suite stay green; only
  `npm run build` catches it. Engine-side helpers a route needs belong in `src/lib/engine/**`
  (this is why `sceneToDomain` + `SIMULABLE_SCENES` live in `flash-prompts.ts`).
- **Playwright screenshots hang** — the ambient-room animations never settle. Verify with
  `getBoundingClientRect` / `getComputedStyle` probes, or raw Playwright with
  `animations:'disabled'` + `caret:'hide'`. Element screenshots clip at the viewport; resize first.
- **Run E2E on a production build**, not `next dev`. Dev StrictMode double-invoke fakes a broken
  funnel on this app (cost ~3h once). `npm run build && next start`.
- **Run the suite both flag ways.** It defaults `AMBIENT_V2_ENABLED` **off**, so a green run can be
  green for the product you are not shipping. ~~Baseline **4717/0**~~ — stale. **Baseline after
  Phase 1: 4787/0 flag off · 4788/0 flag on** (`AMBIENT_V2_ENABLED=true NEXT_PUBLIC_AMBIENT_V2=true`).
  Note that count includes the other session's uncommitted tests (§10).
- **`npm run build` is a REQUIRED gate here, not optional.** See the surfaces-import trap below —
  it is the only thing that catches a client/server bundle violation.
- **`AmbientDetail` / the v2 panels need a bounded host.** An unbounded-height wrapper rendered
  2,182px instead of 800 once. `presentation="rail"` sets `height:100%` — give it a real box.
- **`tailwind-merge` silently deletes custom `text-*` classes** when a colour shares the `cn()`. The
  tell is arithmetic: `tracking-[0.08em]` computing to 1.28px means a 16px base, not your 11px.
  Guard is in `src/lib/utils.ts`.
- **`supabase db push` is UNSAFE here** — 48 local-only / 41 remote-only migrations; it would recreate
  the `threads` table. Dev and prod share ONE project. Single migrations go via the SQL editor.

---

## §10 — Coordination: read this before you touch anything

### 🔴 STILL LIVE as of session 1's end (2026-07-28) — `git status` FIRST, every time.

That second session's original batch **landed** as `4eb1ecb8` ("one renderer for every turn"), and
the tree was clean when session 1 started. **It then began writing again, mid-session.** At the end
of session 1 these were dirty and are **NOT mine — do not commit them**:

- `src/components/app/home/composer.tsx` — a late-follow-up reload fix, and a `preventDefault` on the
  Stop button (a click was firing a second *billed* run in the same 100ms).
- `src/components/app/home/use-active-run.ts` — `followupText` no longer counts as tail content
  (it was rendering every finished run twice).
- new: `src/components/app/home/__tests__/composer-stop-disc.test.tsx`,
  `src/components/app/home/__tests__/use-active-run.test.ts`
- `docs/HANDOFF-2026-07-28-one-thread-one-renderer.md`

⚠️ **Consequence for this lane:** **Phase 3 is BLOCKED.** It needs `onSimDoor` threaded through
`composer.tsx` + `AmbientStartHome`, and the Phase-4 react gating needs `reportCredit402` at
`composer.tsx:2304` — both inside the file they are actively editing. **Phase 2 (`SimulateIntake.tsx`)
and the Phase-4 route gate (`react/route.ts` + `fireSim`) touch neither contested file** — do those
first. Session 1's suite/build numbers were measured on a tree that included their uncommitted work.

### The original §10 note (their first batch, now landed as `4eb1ecb8`)

It had uncommitted work in:

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
Read docs/HANDOFF-2026-07-28-simulate-door-and-arm.md — §0.5 FIRST, then the rest.

Context: virtuna-platform, branch lane/platform-surface. Phase 1 of this lane LANDED as 0f5d292c
(the five ARM dials now reach the engine or say why they can't). §0.5 is the status block: what
shipped, and FIVE things the original spec got wrong that are corrected there. The body of the doc
below §0.5 is the original spec — trust §0.5 over it wherever they disagree.

🔴 FIRST COMMAND: `git status`. A second session shares this worktree and was still writing when
Phase 1 was committed. composer.tsx, use-active-run.ts, two new __tests__ files and their own
handoff doc were dirty and are NOT yours — never stage them (§10). Commit only files you touched.

Goal for this session, in order:

1. THE PHASE-4 PREREQUISITE — gate + price /api/tools/react at 1 credit under its own `react` key
   (owner-decided). Mechanical: mirror the four lines the other 11 paid routes use —
   `creditGate(supabase, user, "react")` → `if (refusal) return refusal` (before any engine spend)
   → … → `billUsage({userId, action:"react", tier: verdict.tier})` on delivery only. Add the
   CREDIT_COSTS entry. Safe to land now: creditGate only refuses when BILLING_ENFORCE_QUOTA is on
   (OFF in prod), so nobody sees a 402 today while billUsage starts metering immediately.
   The route has exactly TWO live callers: AmbientOverviewRail.tsx `fireSim` (yours — add
   reportCredit402) and composer.tsx:2304 the `ask` verb (CONTESTED — leave it, note it).
   ⚠️ This turns "Ask the room" from free into 1 credit. That is intended; say so in the commit.

2. PHASE 2 — SimulateIntake gains the actual inputs per door: textarea (draft) · file (video) ·
   URL (link). Reuse, do NOT rebuild: src/components/thread/input-request-block.tsx already has the
   file upload path and the link field. `cold` mode must stop reading data.stimulus.text from the
   caller. Neither file is contested.

Phase 3 is BLOCKED on the other session (it needs composer.tsx) — do not start it. If composer.tsx
is clean by the time you get there, check with me first.

Before building on any claim in the doc, verify it against the code — this spec has now been wrong
five separate times and each one was only caught by reading the source. Say what you found.

Verify per §9, which has been corrected with the traps that actually bit:
- `npm run build` is a REQUIRED gate. Importing a src/lib/surfaces/* module into an API route breaks
  the production build while tsc AND the full suite stay green. It cost a build here.
- Suite baseline 4787/0 flag off, 4788/0 with AMBIENT_V2_ENABLED=true NEXT_PUBLIC_AMBIENT_V2=true.
  Run it BOTH ways.
- E2E on a prod build (`npm run build && npx next start -p 3111`), never `next dev`.
- Playwright screenshots hang on this app — probe with getBoundingClientRect / getComputedStyle.
- /ambient-v2 is no-auth and fixture-driven (fast, but misses adapter bugs). /dev/cards needs auth;
  the working login recipe is in §9 — the button is "Sign in", NOT the first button[type=submit].
- Mutation-test every new guard: break the thing, watch the test fail, restore. A guard nobody has
  watched fail is a guess.
```
