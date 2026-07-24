# Handoff — Artifact-first Start (2026-07-24)

Branch `design/ambient-audience-v2` · commits `68ebf9ad`, `796a67bb`

The Start surface (④) was regrouped from the **verb** axis to the **artifact** axis, and the
empty home moved onto the thread layout. Two commits, both live-verified on `:3007`.

---

## 1. Why the axis changed

The old grid was **Make / Analyze / Discover** — verbs — with the thing you act on left implicit
(a TikTok video). That grid grows one tile per *capability*, i.e. as `verbs × artifacts`, so it
explodes the moment the product carries more than one kind of artifact.

The artifact axis grows **one tile per artifact** and lets the verbs ride the sentence, which
`chat-agent-loop` already routes from natural language ("test this", "give me ideas"). Nothing new
had to be built to make that work — the routing was already there.

### What we did NOT adopt

Artificial Societies collapses everything to one tile per artifact ("simulate a LinkedIn post").
That works because they have **one verb and the artifact already exists** — you paste it in. Most
of our skills are **generators**: the artifact is the *output*, not the input. You cannot "simulate
a script" you have not written. So Ideas / Hooks / Script / Remix stay separate tiles — they are
four different things you end up holding, not four verbs on one video.

**The model is mixed, on purpose:**

| kind | granularity | named for | examples |
|------|-------------|-----------|----------|
| generators | fine | the output | Ideas, Hooks, Script, Remix |
| things you feed in | coarse | the artifact | Video test, Ad creative, later Landing page |

Consequence worth knowing: Content will **stop growing** as the product goes horizontal. New
business artifacts land as single coarse tiles, not four each.

---

## 2. What shipped

### The grid — `START_SKILL_GROUPS` in `src/lib/surfaces/ambient-v2-adapters.ts`

| group | tiles |
|-------|-------|
| **Content** (`span: 2`) | Ideas · Hooks · Script · Remix · Video test · Ad creative `soon` |
| **Intel** (`span: 1`) | Explore · Account teardown · Compare A/B `soon` |

Renames: `Test → Video test`, `Read → Draft read` (later removed), `Account → Account teardown`.
Those three were indistinguishable from their labels alone.

**`Draft read` was removed** from the grid (owner call). The `read` runner still exists and is
still reachable through chat — only the tile is gone.

### `StartSkill.lens` now renders

The field already existed on the type and `SkillTile` was **silently dropping it** — every tile
shipped with a label and nothing else. Each lens is one line saying what you get back, and it is
what disambiguates the tiles a label cannot:

> Video test — *Frame by frame, one fix* · Draft read — *Test text before you film*

Copy is tuned to **never wrap at 760px**. If you widen or narrow the card, re-check these.

### `StartSkill.status: "soon"`

`Ad creative` and `Compare A/B` are **named but inert** — dimmed, `disabled`, no `onPick`. Neither
has a runner in `SKILL_TOOLS` / `SKILL_RUN_META`, and arming one would point the composer at
nothing. Mirrors the `status` field `INTAKE_DOORS` already uses in the same file.

**Guard:** `ambient-v2-adapters.test.ts` asserts both are `soon`, so nobody flips one live without
building the runner first.

### `SkillGroup.span`

Content carries ~2× Intel's artifacts. It takes 2 of the grid's 3 tracks and flows into 2 inner
columns; Intel takes 1. Both sides bottom out level instead of one column running twice as long.

### Icons — redrawn as one family (16-box, 1.4 stroke, no fills)

bulb (Ideas) · first-line-heavy (Hooks — the *opening* line carries the weight) · folded page
(Script) · filmstrip (Video test) · megaphone (Ad creative) · compass (Explore) · **@**
(Account teardown) · two panels (Compare A/B). The old set mixed metaphors — a diamond for Ideas,
a target for Test, a list for Account.

### Audience chip

Pill + **coral live dot** replacing the `◇`. The dot is the only accent on the surface; a live dot
is explicitly on the LOCKED accent-dosage allow-list, so this stays inside the rule.

`/ambient-v2` now passes real `GENERAL_AUDIENCE + PRESET_AUDIENCES` (through
`filterHorizontalAudiences`, so a `mode:"general"` panel cannot leak while the flag is off) — the
chip was rendering the **locked** variant purely because the dev page never passed `audiences`.
The picker code already existed.

---

## 3. The layout change (`796a67bb`)

Four separate owner asks that all reduced to one root cause: **the empty home was using the
centered layout branch.**

| ask | how it resolved |
|-----|-----------------|
| composer at the bottom like a real chat | empty home now takes the **thread layout**; panel rides the scroll region, composer sits in the existing floating bottom dock |
| skill pick → empty chat, not quick-actions | `startEngaged` drops the panel, `threadContent` takes over (empty on a fresh thread) |
| six quick actions above the field | moved into the dock wrapper, `mb-3`, post-pick empty chat only |
| rail opens on skill pick | new `onEngagedChange` signal → `threadMode = hasThread \|\| rehydrating \|\| engaged` |

### ⚠️ Why the rail needed a new signal

`composer.tsx:620` records a prior regression: flipping **`hasThread`** on skill *selection* tore
the empty home in half — greeting pinned top, composer pinned bottom, dead gap between, and
Ask/Explore/Account each looked like a different app.

`onEngagedChange` is deliberately **separate**. `hasThread` still means "real content exists". Only
the layout branch moves, and the greeting that made the old break visible is suppressed under v2
(`home-page-layout.tsx:79`). **Do not merge these two signals.**

### Other layout notes

- Card `860 → 760px` to share the composer dock's edge. Branch B clamps to `max-w-[760px]`, so the
  860 version was already being squeezed in the real app — the dev preview was lying.
- Shadow `0 24px 64px rgba(0,0,0,.4)` → `0 4px 16px rgba(0,0,0,.16)`. Once the composer sat under
  it, the heavy drop made the two read as unrelated slabs. The matte system does not want a
  floating card.
- The dock wrapper is `pointer-events-none` by design; the starter is `pointer-events-auto`. If the
  six cards ever stop responding to clicks, that is the line.
- The `/ambient-v2` composer is a **static stand-in** — the real `composerDock` lives in
  `composer.tsx` and cannot mount on a fixture page. Layout parity only; do not grow features on it.

---

## 4. State + what's next

**Verified:** `tsc` clean · 15 home + start test files pass · Start grid, audience picker (switched
to Conversion Audience live), and the inert `Ad creative` tile (click times out on
`element is not enabled`) all confirmed on `:3007`.

**Not verified by me:** the `796a67bb` layout on the authenticated `/home` — owner previewed and
approved it.

### 🔴 Blocking the merge

`src/components/audience-lens/v2/__tests__/AmbientOverviewRail.test.tsx` **fails** on
`/What carried the stop/i`. It is **pre-existing and not from this work** — proven by stashing
these edits and re-running. It arrived with the other session's commits (`f01717be` / `842b2002`)
and the string it wants still exists at `ambient-v2-population.ts:224`, so the component is not
reaching that state for a reason inside that in-flight work. **Someone who owns those commits
should resolve it before this branch lands on main.**

### Follow-ups

- **`ad` runner** — Ad creative is the first business artifact worth building: it is a short video
  with money attached, so it inherits the whole frame stack *and* the Socials calibration anchor
  (the only business artifact that stays Validated).
- **`compare` runner** — needs its own card: paired verdict + which-wins + why, not one score.
- **Drift guard** between `START_SKILL_GROUPS` and `SKILL_TOOLS`, so a renamed skill id cannot
  silently orphan a tile.
- `start-fixture.ts` mirrors the registry by hand. Keep the two in step, or fold the fixture onto
  the registry.
