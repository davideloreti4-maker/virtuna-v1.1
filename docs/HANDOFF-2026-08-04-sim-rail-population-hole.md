# HANDOFF — the sim rail's dead drill, and why it is NOT what it looks like

**Written** 2026-08-04, session close · **Worktree** `~/virtuna-slot-b` · **Base** `main` @ `a9315ebf`

> ⚠️ `main` moved **twice** during this session (a co-session merged the thread-scroll fix + corpus
> restore mid-flight). `git fetch` and re-measure every sha here. Read refs with `git rev-parse` —
> `git log --oneline` elides merge commits in this repo.

> 🔴 **This investigation is UNFINISHED and the owner believes there are still misconceptions in
> it. Treat §5 as the live question, not settled fact. Nothing below has been fixed.**

---

## 1. The symptom, in the owner's words

> "the brain, viewer, engagement dont seem to open up? does the api call even fire to make a
> simulation when i click on simulate in overview?"
>
> "it loads and appears as ranked but the 3 pages dont open up when i click on it"

Concretely: on the ambient Overview rail, a queued hook is simulated, the row seals and shows a
real rank/percentage — and then **clicking that sealed row does nothing at all.** No error, no
console noise, no network call. The Brain / Engagement / Audience pages never open.

⚠️ **Naming**: the three pages are **Brain · Engagement · Audience** (`AmbientDetail.tsx:245`).
There is no "Viewer" tab. The attention scrubber the owner may mean by "viewer" lives *inside* Brain.

---

## 2. ROOT CAUSE (proved) — a hole in the audience fallback

`api/tools/react/route.ts:257`:

```js
const populationSignature =
  audience?.signature ?? (audience?.is_general ? GENERAL_BASELINE_SIGNATURE : null);
const wantPopulation = !!populationSignature && signatureHasPopulationAxes(populationSignature);
```

Three kinds of audience hit this line, and **one of them falls through the floor**:

| audience | `signature` | `is_general` | result |
|---|---|---|---|
| calibrated (e.g. `@mrbeast`) | present | false | ✅ its own signature |
| General / uncalibrated-default | null | **true** | ✅ `GENERAL_BASELINE_SIGNATURE` |
| **an old user-made audience, never calibrated** | **null** | **false** | 🔴 **null → no population, ever** |

The owner's active audience is the third kind. Replayed live through the real resolver:

```
thread "hooks for my video about why startups mostly fail"
  active_audience_id : null
        ↓ resolveThreadAudience → no thread pin → resolveUserAudience (LAST-USED audience)
  resolved: "Fitness Creators"  (b0bbcfd9…, created 2026-06-20)
    is_general : false
    signature  : null          ← never calibrated

  → populationSignature : NULL
  → wantPopulation      : false
  → population stays null → the 3 depth pages can never open
```

The row still seals, because `pct` comes from the flash reaction, which is independent. So the
Overview looks completely healthy while the depth behind it is dead.

### Why a click does literally nothing

`AmbientOverviewRail.tsx` `openStimulus`:

```js
const snap = snapshotFor(id);
if (snap?.population) setDetailId(id);   // the 3 pages
else if (!snap) openDevelop(id);         // queued row → the ARM panel
// SEALED but NO population → INERT. This branch has no body. That is the bug's whole UX.
```

And `sim-seals.ts:150` only restores the field `if (isPopulationLike(val.population))` — a JSON
`null` fails that test, so a reloaded seal comes back with `population: undefined` too.

### The DB confirms it, with a date

`threads.sim_seals`, `jsonb_typeof(value->'population')`:

| thread | date | population |
|---|---|---|
| hooks for my video about why startups mostly fail | **2026-08-04** | `null` |
| i want to make a video about launching my first… | **2026-08-04** | `null` |
| Door probe… | **2026-07-28** | `null` |
| give me 3 good hooks | 2026-07-26 | **`object`** ✅ |
| 3 hooks for my saas software… | 2026-07-26 | **`object`** ✅ (4 of them) |

It worked, then stopped. ⚠️ **What actually changed on/around 2026-07-28 was NOT identified** —
the most likely explanation is simply that the owner's *last-used* audience changed to "Fitness
Creators", since `active_audience_id` is `null` on every thread in the table and the resolver
therefore falls back to last-used. **That is an inference, not a proof. Verify it.**

---

## 3. Why nobody noticed — two silent catches

```js
// route.ts:262
characterizeContent(...).catch(() => null)      // swallows every throw
// route.ts:309-314
try { population = reactPopulation(...) }
catch { population = null }                      // "never let the projection break the reaction"
```

Both are defensible individually. Together with the empty `else` in `openStimulus`, they make a
dead drill completely invisible: no log, no Sentry, no UI state. **Whatever else is fixed, the
null-population case should announce itself.**

---

## 4. Ruled OUT, with evidence — do not re-investigate these

A first hypothesis (a cheap model silently failing a structured task, i.e. the CALIBRATE pattern)
was **WRONG**. Measured with `scripts/characterize-content-harness.ts`:

| suspect | result |
|---|---|
| `characterizeContent` on **flash** | ✅ 3/3, every topic key in-vocab, 1.2–1.6s (faster than plus) |
| `characterizeContent` on **plus** | ✅ 3/3, 4.6–4.8s |
| `reactPopulation` (calibrated `@mrbeast` sig) | ✅ 10 segments, N=1000 |
| `reactPopulation` (`GENERAL_BASELINE_SIGNATURE`) | ✅ 10 segments, N=1000 |
| `signatureHasPopulationAxes` on both | ✅ true |
| audience data quality | ✅ recent audiences carry `topic_vocab` 10–12 and 10/10 personas with `reaction` |

The machinery is **entirely healthy**. The failure is purely which audience object reaches it.

---

## 5. 🔴 THE OPEN DESIGN QUESTION — and a conflict the next session must resolve

Owner, at session close:

> "shouldnt the simulation call just happen when you click on simulate? it shouldnt be auto
> generated thats the old way. we want the real results on simulate"

**Today's behaviour** (`handleQuickSimulate`, `AmbientOverviewRail.tsx:453`):

```js
if (sealedVideos[id]) return setDetailId(id);   // sealed video → the wall
if (videoSeals[id])   return revealVideo(id);   // video → reveal the measured %
return openDevelop(id);                          // ← a CONCEPT opens the ARM panel, no API call
```

So **no, the API does not fire on that click** for a hook/concept. It opens the ARM panel
(lens / slice / scene), whose own "Simulate ↑" then calls `fireSim` → `POST /api/tools/react`.

⚠️ **This is config-first BY AN EXPLICIT OWNER CALL recorded in the code (2026-07-23):**

> *"config BEFORE the run, never a run that back-fills into a config — the loading-then-config
> order was backwards."*

The owner now appears to want the opposite. **That is their call to reverse** — but the next
session must confirm it deliberately rather than treat the old comment as stale, and should
preserve a route to the lens/slice dials for when tuning IS wanted.

🔑 **Fixing the flow does NOT fix the dead pages.** Even firing immediately, `population` comes
back null while the active audience is "Fitness Creators". §2 is the actual blocker. The owner's
phrase *"it shouldnt be auto generated"* may also point at something this session did not pin down —
possibly the **projected** rank a row shows before any real run. **Clarify what "auto generated"
refers to before building anything.**

---

## 6. Proposed fix order (NOT implemented, NOT agreed)

1. **Close the fallback hole** — an uncalibrated non-General audience should fall back to
   `GENERAL_BASELINE_SIGNATURE` instead of null. Roughly one line at `route.ts:257`.
   ⚠️ Touches the **live money path** — `/api/tools/react` is priced at 1 credit. Gates before push.
2. **Make the silence loud** — log/Sentry when `population` lands null, and give the inert
   `openStimulus` branch a real UI state instead of an empty `else`.
3. **Then** the click-to-run change, only once §5 is settled.

Also worth deciding: should the ARM panel be reachable for a **sealed** row at all? Right now a
sealed-but-population-less row is simply inert, which is the worst of both.

---

## 7. Tool left behind

`scripts/characterize-content-harness.ts` — drives the real `characterizeContent` **and**
`reactPopulation` against a real audience signature, on flash and plus back to back. Reports two
distinct failure modes: a throw (swallowed upstream) and the nastier one, a vector that parses
cleanly but whose `topics` keys are all **out-of-vocab** — which projects onto nothing while
passing tsc, the suite and the schema. Usage:

```
npx tsx scripts/characterize-content-harness.ts [audienceId] [--runs N]
```

Spends a few hundredths of a cent per call on DashScope. Zero Apify spend.
