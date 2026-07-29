# Handoff — The ＋ door (bring your own stimulus) + the ARM screen redesign

**Date:** 2026-07-28 (last session 2026-07-29) · **Worktree:** `~/virtuna-platform` · **Branch:** `lane/platform-surface`
**Status:** ✅ **ALL SIX PHASES ARE MERGED TO MAIN. This lane is COMPLETE.**
Read §0.2 first, then §0.3, §0.4, §0.5. §11 is the copy-paste kickoff for whatever comes next.

---

## §0.2 — STATUS after session 4 (2026-07-29). This supersedes everything below it.

✅ **PHASES 5 AND 6 ARE MERGED TO MAIN — PR #401, commit `69414a16`, merge `e3dcbb23`.**
The lane's six phases are done. There is no Phase 7 in this doc; §11 is now a next-session brief,
not a phase kickoff.

⚠️ **`origin/main` moved BETWEEN this session's first two commands** (`be4c34e6` → `5e351be0`).
Both were docs-only, so §0.3's code verification at `18950c59` still held. The re-baseline
reproduced §0.3's numbers exactly — **4849/0 flag off · 4850/0 flag on** — which is the useful
signal: when the baseline reproduces, the tree really did not move.

### 🔑 §5's band table did not survive re-measurement. Two of its three numbers were wrong.

This is wrong claim #9 and #10, and both would have mis-costed the phase. Measured on a
**production build** at real geometry, 1512×900:

| §5 claimed | actually |
|---|---|
| trailing dead space **92px / 11%** | **41px / 4.8%**, and ONLY on the develop entry |
| preamble outweighs the lens **1.7 : 1** | **0.60 / 0.82 / 1.58 : 1** at a 42 / 120 / 430-char draft |

1. **The three ARM variants do not share a container, and §5 measured one and described all
   three.** ① `develop` mounts `connected` INSIDE the rail — a 400px column at a fixed 858px, so it
   *can* end in dead space. ② and ③ come through `SimulateDoorHost` **un-`connected`, as a floating
   460px sheet exactly as tall as its content** — they have NO trailing dead space, structurally,
   and cannot have any. §11 said "design ② first"; ② is the one geometry the table never described.
2. **The 1.7 : 1 ratio is not a property of the layout.** The preamble is 112 → 153 → **295px**
   across draft lengths while THE LENS is fixed at **187px**. The ratio only crosses 1:1 past
   ~250 characters. §5 measured at the long end and reported it as the screen's shape.

**So the fix matched the cause: CLAMP the echo, don't rebalance the bands.** Three lines, full text
still in the DOM, "Show all" restores it. A draft can be 2,000 chars (`DRAFT_MAX`), so the unbounded
case was reachable, not hypothetical — and on ① the footer carries the SPEND BUTTON, which a long
stimulus scrolls out of the rail. Measured after: **295 → 177px**, lens is the loudest band at every
length, and ① with a 350-char stimulus lands at **843/858, `scrollH === clientH`, no overflow.**

### The other two §5 defects were real, and are fixed as stated

- **The footer restated 5 of 5 facts already on screen** (145–161px = 16–20% of the card). Every one
  of "Screening 1,000 of General for 'would they stop' · on TikTok · SIM-1 Flash" appears above it —
  the tier on a locked chip six pixels to its right. It now states **THE WAIT** (seconds vs 1–3
  minutes): the only fact the screen never carried, and the only one that differs between the two
  runs a `Simulate ↑` can start.
- **The audience was named three ways at once** — "Everyone" (slice chip) · "the whole room"
  (caption) · "General" (conditions, and again in the footer). The conditions line keeps the name;
  the caption now states arithmetic only and no longer echoes the chip's own label back at it.

### ⚠️ Three more things this session found

1. **§11's fixture pointer was wrong (#10).** The drift guard reads **`src/app/(app)/dev/cards/fixtures.ts`**
   (`ALL_FIXTURE_BLOCKS` → `dev/cards/__tests__/fixtures.test.ts`). `src/lib/tools/mock/fixtures.ts`
   has no `ALL_FIXTURE_BLOCKS` and feeds no drift guard at all.
2. **A new guard PASSED AGAINST ITS OWN MUTATION.** The "caption must not echo the slice chip"
   test counted `"Builders"` case-sensitively; the echo renders it **lowercased**, so restoring the
   defect left the test green. It was caught only because the mutation was verified to have APPLIED —
   two earlier `perl` mutations had silently no-op'd and reported a meaningless "19 passed".
   🔑 **A mutation you did not confirm landed is not a mutation test.** Assert the substitution
   found its target before you trust the result.
3. **`happy-dom` silently drops `-webkit-line-clamp` and `display:-webkit-box`** from inline styles —
   only `overflow: hidden` survives. A guard reading the style attribute would have asserted nothing
   and passed with the clamp deleted. The clamp states itself via `data-clamp` instead.

### Verified on a production build (`npm run build && next start -p 3111`)

- `/dev/cards` → The Room → `#room-simulate`: **1 intake · 2 collect · 3 arm**, 3 `sim-locked` on the
  video variant, **no ＋ door anywhere in the tab** (by design), no "Screening", no "10,000".
- The brought-card fixture renders through the real registry: "You brought this", and the count is
  worded in the RUN's lens (`finish` → "watched it through", not "stopped").
- ⚠️ **Probe traps that cost time here:** `/login` renders TWO email inputs once the password form is
  revealed (it is behind **"Sign in with a password instead"**) — filling the FIRST one fills the OTP
  form and the sign-in silently does nothing. Fill `input[type=email]` **last**, then "Sign in".

### Baselines — RE-BASELINE AGAIN, main moves daily

| | measured on this tree |
|---|---|
| before this work | **4849/0** flag off · **4850/0** flag on · 444 files |
| after (merged) | **4855/0** flag off · **4856/0** flag on · 444 files |

+6 = **5 new guards + 1 fixture block** (the brought-card entry grows `ALL_FIXTURE_BLOCKS`). No new
test FILE, so the file count is unchanged. tsc clean · `npm run build` passes · the **3** unhandled
`reading 'catch'` rejections in `composer.test.tsx` are unchanged in message and count.

**All 5 new guards mutation-verified** — room-named-once, slice-chip echo (after the fix above),
footer-restates, video wait, and the clamp.

### ▶ Next — see §11. Nothing in this lane is left.

### Owner-owed, still open after four sessions

- 🔴 **`/api/account-read` is ungated with no `CREDIT_COSTS` entry** — 1–3 minutes of Apify per call.
  **The only item on this board that costs real money on every call.** A pricing decision.
- 🔴 **`/api/tools/react` is a THREE-caller paid route** (rail sim · composer `ask` · the ＋ door).
  A fourth caller needs `reportCredit402` or the refusal is silent.
- 🎨 **A design question, not a defect:** on the VIDEO variant THE LENS is now the *smallest* band
  (102px, 14.8%) while THE SLICE is the largest (150px, 21.7%). All three dials are locked there, so
  ③ is a receipt wearing a dial board's layout. Left alone deliberately — collapsing the three locks
  would change the mutation-verified `sim-locked` ×3 guard, and §11 rules that re-litigating locks is
  a route change, not a design change. Owner's call.

---

## §0.3 — STATUS after session 3 (2026-07-28). This supersedes §0.4, §0.5 and the body.

✅ **PHASES 3 AND 4 ARE MERGED TO MAIN — PR #399, commit `257fecbf`.** Live-verified on a production
build before merge. They landed together, as required: the door and the thing behind it are one unit.

⚠️ **Main moved twice more the same hour, from a SECOND lane** (`#398` "the skill pill goes, and an
arm lasts exactly one send" — the composer-chrome lane's steps 3+5, which rewrote ~558 lines of
`composer.tsx`). Neither lane was verified against the other before merging, so this session merged
`origin/main` back into the lane and re-ran everything on the COMBINED tree:

- **tsc clean · suite 4849/0 flag off · 4850/0 flag on (444 files) · `npm run build` passes.**
- All four ＋-door call sites survived their rewrite (`onTestVariant` ×2, `onSimDoor` ×2, plus the
  `SimulateDoorHost` mount and `ensureThread`).
- The 3 unhandled errors are still the pre-existing `composer.test.tsx` ones — the site moved to
  `composer.tsx:2003` from their edits; the code did not change.
- ⚠️ Verified at **`18950c59`**. `origin/main` had already advanced to `e050bd84` by the end of the
  session — **re-sync and re-run before trusting these numbers.** The next session's FIRST command
  after `git status` should be `git fetch && git log --oneline -3 origin/main`.

**The door now exists, twice, and what comes through it runs:**

| piece | what shipped |
|---|---|
| board `＋` | `onTestVariant` is a real host handler. The old one-liner carried TWO defects — dead on an empty rail (`descriptors[0]` undefined), and on a full one it re-armed the creator's FIRST EXISTING CARD. Copy is now "＋ Test something of your own". |
| Start door | The SIMULATE DOOR its docstring described since 2026-07-21 and never had. `onSimDoor` → `AmbientStartHome` → composer. |
| no dead doors | **Both doors render ONLY when a host can run them.** No handler ⇒ no door — the dead-button class is removed at the source, not relocated. |
| the run | `SimulateConfig.stimulus` carries the brought draft/file/link out. Draft → `/api/tools/react`; video file/link → the composer's existing `/api/analyze` + `test/card` seams (not re-implemented). |
| the row | A new `brought-card` block. **This is the anti-orphan half** — see below. |

### 🔑 The orphan-seal trap, and why it needed a NEW block type

§0.5 correction #4 was right: a brought text needs a card block or its seal is orphaned. What it did
not say is that **none of the four existing card types can carry one honestly.** `hook-card` REQUIRES
`mechanism` (a named attention mechanism) and `rank` — neither exists for a text nobody generated, so
reusing it means inventing both. So `brought-card` was added instead: registry + renderer +
`KIND_BY_BLOCK_TYPE` (kind `concept`, the generic rank kind that was already in the vocabulary and
unreachable until now) + a title headline. It claims exactly what ran.

- The route gained opt-in **`card: true`** (+ `cardKind`, `segmentLabel`). Default off ⇒ type-to-room
  and the composer's `ask` verb stay byte-identical and ephemeral; the rail's own "Simulate →" must
  NOT set it (its stimulus already has a card — the generated one it is sealing).
- The card is inserted **BEFORE** the seal write. Both writes are non-fatal, and the failure
  directions are not equal: a card with no seal is an honest QUEUED row; a seal with no card is the
  orphan. So the card goes first.
- **No `run-header` rides with it.** That stamp's `skill` is the DISPLAY namespace and a brought
  stimulus is none of those skills — inventing an id there is the exact cast that shipped F-017.
  Without it `classifyTurn` reads the turn as plain and the card renders alone, which is correct.

### ⚠️ Three things this session found that the spec did not say

1. **A brought VIDEO's ARM screen was about to grow three decorative dials.** `/api/analyze` accepts
   NO lens, NO segment and NO scene — it resolves the audience server-side and reads the whole fold.
   Phase 4 made that screen reachable for the first time, so shipping live dropdowns there would have
   re-created the exact defect Phase 1 removed. All three now render LOCKED with their reason
   (`VIDEO_LOCK`), the same treatment fidelity already had.
2. **`TIER_N.max` (10,000) would have been a fabrication on the video variant.** A video fold is a
   **10-reactor panel** — `ambient-v2-video-population.ts` §1 says so in as many words and REFUSES to
   clone those ten into a thousand. The 1,000/10,000 numbers are the TEXT projection's
   (`reactPopulation`), which a video run never calls. The video variant states **10 reactors**.
3. **The brought paths needed `ensureThreadForSend`, which lived inside `handleSubmit`.** While the
   client pointer sits on the new-thread sentinel, every server-side `createOpenThreadLazy` mints its
   OWN row, so the card lands in a thread the client is not pointing at — **F-019 exactly**. Hoisted
   to component scope and awaited before BOTH brought runs (the text one too: it is a server write).
   Also: `reloadChatThread` does **not** refresh `sim_seals`, so the new row would have appeared
   honestly QUEUED until the next full reload. `reloadThreadAndSeals` re-reads both.

### Verified live on a production build (`npm run build && next start -p 3111`)

Start door → intake → collect → ARM → **one real billed react run** (1 credit, 1 POST, 200):

- `brought-card` in the thread carrying the draft, "You brought this", **Strong 7/10 stopped**
  (the lens's own verb, not a hardcoded "stopped").
- The board: **`1 SEALED` · the draft · `CONCEPT` · 70.0%** — and it **survives a reload** (the block
  rehydrates → descriptor; the seal rehydrates → the %). That is the orphan trap closed end to end.
- The board `＋` opens the intake and **not** the develop card (no tie-back band).
- The video variant: 3 locked dials, "reactors", no 10,000 claim, tier `max`. **Not fired** — a
  ~2-minute 10-credit Max run; its wiring is asserted by test, not by spend.

### Baselines — the §9/§0.4 numbers were STALE (as flagged, PR #395 added tests)

| | measured on this tree |
|---|---|
| before this work | **4813/0** flag off · **4814/0** flag on · 442 files |
| after | **4838/0** flag off · **4839/0** flag on · 444 files |

+25 = 14 door guards + 5 renderer guards + 4 route guards + **2 auto-generated** (two file-scanning
idiom guards pick up each new component file — both pass). tsc clean. `npm run build` passes.
The **3 unhandled errors are the pre-existing `composer.test.tsx` ones** — same count, same single
site (`stream.start(...).catch` on the mocked tiktok_url path; the line number moved 1913→1922 from
the hoist, the code did not).

**Every new guard is mutation-verified** — 9 mutations, each caught by the intended test: reverting
the broken `onTestVariant` one-liner (caught by 3), breaking the block↔seal key identity, removing the
insert entirely, inserting without the flag, dropping `stimulus` from the config (caught by 4),
`TIER_N` for video, unlocking the video dials, an inert Start door, dropping `card:true`, fetching
before the thread exists, and collapsing the lens verbs to "stopped".

### ▶ Next

Phases 5 (the ARM redesign — variant ② first, §5) and 6 (`/dev/cards` pinning) are open and
independent. **§11 is the copy-paste kickoff prompt for them.**

Phase 5 is now **smaller than §5 describes**: the video variant's lens/slice/scene treatment landed
here out of necessity (the route honours none of them), so what remains is the LAYOUT/budget work —
the 286px preamble that outweighs the lens 1.7:1, the footer that restates 5 of 5 facts already on
screen, and the audience named three ways at once. **Re-measure before designing:** those numbers were
taken on the pre-Phase-3/4 screen and the cold variants now render differently.

### Owner-owed, unchanged by this session

- 🔴 **`/api/tools/react` is now a THREE-caller paid route** (the rail sim · the composer's `ask`
  verb · the ＋ door). Any fourth caller needs `reportCredit402` or the refusal is silent.
- 🔴 **`/api/account-read` is still ungated with no `CREDIT_COSTS` entry** — 1–3 minutes of Apify per
  call. Open across three sessions; a pricing decision, not an implementation detail.

---

## §0.4 — STATUS after session 2 (2026-07-28). This supersedes §0.5 and §10.

✅ **MERGED TO MAIN: PR #394, merge commit `79b3e635`.** It carried Phase 1 too — that had landed
on the lane in session 1 but was never merged. The lane is now level with `main`.

⚠️ **This is live in production.** `billUsage` writes `react` rows from the moment it deployed, so
"Ask the room" and every armed rail sim now consume ledger credits. No customer sees a 402
(`BILLING_ENFORCE_QUOTA` is off) — but the usage numbers change, and that is expected, not a bug.

Four commits on `lane/platform-surface`, plus a merge of `origin/main` (the lane was 6 behind):

| commit | what |
|---|---|
| `fe067d1b` | **the Phase-4 prerequisite** — `/api/tools/react` gated + priced at **1 credit**, own `react` key |
| `e29d3930` | **Phase 2** — the cold door collects a real stimulus instead of arming the caller's text |
| `90591647` | merge `origin/main` — brings in `9902b45f` (Stop no longer fires a second BILLED run) |
| `39fc42d7` | the react gate's client half — a refused "Ask the room" raises the wall instead of vanishing |

**Baselines (measured on this tree, both flag ways):** **4800/0 flag off · 4801/0 flag on**
(`AMBIENT_V2_ENABLED=true NEXT_PUBLIC_AMBIENT_V2=true`). tsc clean. `npm run build` passes.

### ⚠️ Three MORE things this doc got wrong. That is eight across two sessions.

1. **§10's contention warning is STALE, and was already stale when session 2 started.** The other
   session's work did NOT land in this worktree — it went to `main` via PR #392 (`9902b45f`).
   `git status` was CLEAN at session start; `composer.tsx` was never contested here, it was just
   **6 commits behind**, still carrying the Stop-double-billing bug. The lane has now merged
   `origin/main`. **Phase 3 is UNBLOCKED and `composer.tsx` is current.**
2. **"`creditGate` only refuses when `BILLING_ENFORCE_QUOTA` is on" is INCOMPLETE, and the gap is
   a live 402.** `enforced = isAnonymous || isQuotaEnforced()` (`quota.ts`) — an anonymous visitor
   is metered *regardless of the flag*, and `react` is **not** the `DEMO_ACTION`, so they'd be
   refused `trial_required`. React is safe only because **THE WALL (`isSealedVisitor`) 403s them
   first**. That ORDERING is load-bearing and nothing asserted it. It does now
   (`route-wiring.test.ts`). **Check this before gating any other route.**
3. **The `CreditWallRefusal` "futile retry under the paywall" does NOT apply to the `ask` verb.**
   A failed ask records `error: true` and the only consumer of the ask trail **filters errored
   asks out** (`audience-presence.tsx:417`) — so a refused ask rendered *nothing at all*. The
   defect was total SILENCE, not a bad retry. The fix is the same line; the reasoning was wrong,
   and the test asserts the silence rather than assuming it.

### One honest caveat on a new guard

The file/link exclusivity in `CollectStep` is enforced **three times over** (clear-on-select · the
field unmounts while a file is held · `submit` reads the file first) and the three **mask each
other**: mutation-tested, breaking any ONE leaves the tests green. The test catches the compound
break and the unmount. It is redundancy, not three guards — do not read that green as coverage.

### ▶ Next: Phases 3 and 4 must land TOGETHER

Deliberately not started. The rail's `＋` currently either does nothing (empty rail) or lies
(re-arms `descriptors[0]`), and wiring it to the new cold intake **without** Phase 4's routing
would open a real door onto a dead "Simulate" — the same class of defect this lane exists to
remove. They are one unit of work:

- **Phase 3:** `onTestVariant` → cold intake (not `openDevelop`); relabel `＋ Test a new variant`
  → `＋ Test something of your own`; the `AmbientStart` door + `onSimDoor` through
  `AmbientStartHome` → composer (all now unblocked).
- **Phase 4:** route the `BroughtStimulus` — draft → `/api/tools/react`, file/link →
  `/api/analyze`. `ArmCard` already holds the stimulus; it is not yet on the emitted
  `SimulateConfig` (left off deliberately — add the field WITH its consumer).
- ⚠️ **§0.5 correction #4 still stands and is the trap:** a brought TEXT needs a card block
  inserted as well as a seal, or the seal is orphaned and nothing renders. Video is fine.

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

### ▶ Recommended next step — ✅ DONE in session 2 (`fe067d1b`). See §0.4 for what is next.

~~**The Phase-4 prerequisite: gate + price `/api/tools/react` (1 credit, own `react` key).**~~ It is
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

> 🛑 **THE BAND TABLE BELOW IS WRONG AND THE PHASE IT SPECIFIED IS DONE (PR #401). See §0.2.**
> Two of its three numbers did not survive re-measurement: trailing dead space is **41px / 4.8%**
> (not 92 / 11%) and exists on the develop entry ONLY — the two cold variants are content-height
> sheets and cannot have any. And "the preamble outweighs the lens 1.7 : 1" is not a property of
> the layout at all: it runs **0.60 → 0.82 → 1.58 : 1** as the stimulus grows, so the table
> measured one long draft and reported it as the screen's shape. **Do not re-derive a budget from
> the numbers below.** The two defects it got RIGHT — the footer restating 5 of 5 facts, and the
> audience named three ways — are fixed and guarded.

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

1. ~~**Pricing.**~~ ✅ **DECIDED — and ✅ SHIPPED in session 2 (`fe067d1b`): 1 credit, own `react`
   key, gate + bill + both callers handled.** Original note below.
   ~~**gate + price `/api/tools/react` BEFORE the door ships.**~~ It is currently ungated with no `CREDIT_COSTS` entry, and the `＋` door would promote an
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
  green for the product you are not shipping. ~~Baseline **4717/0**~~ · ~~**4787/4788**~~ — both
  stale. **Baseline after session 2: 4800/0 flag off · 4801/0 flag on**
  (`AMBIENT_V2_ENABLED=true NEXT_PUBLIC_AMBIENT_V2=true`).
  ⚠️ The 4787/4788 figures were measured on a tree holding another session's uncommitted tests
  that **never landed here** — they went to `main` via PR #392. A fresh clone of this lane read
  4781. If your count is *below* the baseline, suspect a stale number before you suspect a
  deletion; this doc has now published a wrong one twice.
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

### ✅ RESOLVED in session 2 — this section is HISTORY. Read §0.4 instead.

`git status` was **clean** at session 2's start and stayed clean. The second session never wrote
into this worktree again: its batch went to `main` as PR #392 (`9902b45f`), which this lane has
now merged (`90591647`). **Nothing here is contested.** `composer.tsx`, `use-active-run.ts` and
their two test files are all present and current. Phase 3 is unblocked.

Keep running `git status` first anyway — it cost nothing and it is how this was caught.

<details><summary>The original session-1 warning, kept for the record</summary>

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

</details>

---

## §11 — Copy-paste kickoff prompt for a fresh context

⚠️ The Phases-5+6 prompt that lived here is **spent** — both are merged (PR #401, `69414a16`,
merge `e3dcbb23`). **This lane is COMPLETE: all six phases are on `main`.** What follows is a
next-session brief, not a phase kickoff. Everything in it was verified on 2026-07-29.

```
Read docs/HANDOFF-2026-07-28-simulate-door-and-arm.md — §0.2 FIRST. Stop there unless you need
history; §0.3/§0.4/§0.5 are earlier sessions' and the body below them is the ORIGINAL spec, which
has now been wrong TEN times. Trust §0.2 > §0.3 > §0.4 > §0.5 > body, and verify any claim against
the source before you build on it. Say what you found.

Context: virtuna-platform, branch lane/platform-surface. The ＋ door lane is DONE — all six
phases merged. The lane branch is level with main; there is no half-finished work in this tree.

FIRST COMMANDS: `git status`, then `git fetch && git log --oneline -3 origin/main`, then
`git rev-list --count HEAD..origin/main`. Main moves DAILY and has moved mid-session before
(twice inside one session on 2026-07-29, between two consecutive commands). If you are behind,
merge origin/main FIRST and re-baseline before touching anything.

BASELINE to reproduce before you change anything (measure, don't assume — this doc has published
a stale number four times):
  tsc clean · suite 4855/0 flag off · 4856/0 flag on · 444 files
  (`AMBIENT_V2_ENABLED=true NEXT_PUBLIC_AMBIENT_V2=true` for the flag-on run)
  `npm run build` passes — this is a REQUIRED gate: a `src/lib/surfaces/*` import into an API
  route breaks the production build while tsc AND the whole suite stay green.
  PRE-EXISTING, not yours: composer.test.tsx emits exactly 3 unhandled rejections
  ("Cannot read properties of undefined (reading 'catch')"). Match on the MESSAGE and the count
  of 3 — the line number moves whenever composer.tsx changes (1913 → 1922 → 2003 so far).

THERE IS NO ASSIGNED NEXT PHASE. Pick with the owner. The open items, highest-cost first:

1. 🔴 `/api/account-read` — ungated, no CREDIT_COSTS entry, 1–3 minutes of Apify per call. The
   only thing on this board that costs real money on every call, open across FOUR sessions. It
   is a PRICING decision, not an implementation detail: do not just gate it. Get the owner's
   call on price-it / gate-it / accept-the-cost, then implement.
   ⚠️ Before gating ANY route here: `enforced = isAnonymous || isQuotaEnforced()`, so a gate
   meters ANONYMOUS users the moment it lands, flag or no flag. Check whether the action is the
   DEMO_ACTION and whether anything refuses anonymous sessions earlier in the handler.

2. 🎨 The VIDEO ARM variant (③) is a receipt wearing a dial board's layout. Measured 2026-07-29:
   THE LENS is the SMALLEST band (102px, 14.8%) while THE SLICE is the largest (150px, 21.7%),
   and all three dials are LOCKED there. Grouping them would change the mutation-verified
   `sim-locked` ×3 guard in sim-door.test.tsx, so it needs an owner decision, not a refactor.
   DO NOT make the locks live — /api/analyze honours no lens, slice or scene. That is a route
   change, not a design change.

3. 🔴 `/api/tools/react` is a THREE-caller paid route (rail sim · composer `ask` · the ＋ door).
   A fourth caller needs `reportCredit402` or the refusal is silent. Constraint, not a task.

HOW TO VERIFY ANYTHING ON THIS SURFACE (all confirmed 2026-07-29):
- E2E on a PRODUCTION build (`npm run build && ./node_modules/.bin/next start -p 3111`), never
  `next dev`. Use ./node_modules/.bin/vitest and ./node_modules/.bin/next directly — the npx
  wrapper here SWALLOWS stderr, so unhandled rejections are invisible through it.
- /dev/cards needs auth. The login page renders TWO email inputs once the password form is
  revealed (it is behind "Sign in with a password instead"). Filling the FIRST one fills the OTP
  form and the sign-in silently does nothing — fill input[type=email] LAST, then click "Sign in"
  (NOT the first button[type=submit]; that is the OTP form's disabled "Continue").
    Creds: e2e-test@virtuna.local / e2e-test-password-2026
- Every ARM state is now PINNED at /dev/cards → The Room → #room-simulate (Phase 6). Use it —
  it is the measuring rig, and each variant is boxed at the geometry ITS OWN host gives it.
  ⚠️ The three ARM variants DO NOT share a container. ① develop is `connected` inside the rail
  (400px × fixed 858px, can end in dead space); ② and ③ are a floating 460px sheet sized to
  their content and CANNOT have trailing dead space. Measuring one and describing all three is
  exactly the mistake §5 made.
- /ambient-v2 is no-auth + fixture-driven and drives the REAL cold flow (intake → collect → arm),
  which is the cheapest way to measure the ARM screen at several stimulus lengths.
- Playwright screenshots hang on this app — probe with getBoundingClientRect / getComputedStyle.
  Raw Playwright from a scratch dir needs an ABSOLUTE import of node_modules/playwright/index.mjs.
- The board rail is PORTALED into an <aside> OUTSIDE <main> — reading main.innerText finds no
  board at all. Probe `[data-testid="ambient-overview"]` directly.
- happy-dom DROPS `-webkit-line-clamp` and `display:-webkit-box` from inline styles. A guard
  reading the style attribute asserts nothing and passes with the clamp deleted. Assert an
  explicit attribute instead (the echo carries `data-clamp`).
- Mutation-test every new guard: break it, WATCH it fail, restore — and CONFIRM THE MUTATION
  ACTUALLY APPLIED. On 2026-07-29 two `perl -0pi` substitutions silently no-op'd and reported a
  meaningless "19 passed", and a third guard genuinely passed against its own mutation (it
  counted a label case-sensitively; the code lowercases it). A mutation you did not confirm
  landed is not a mutation test.
```
