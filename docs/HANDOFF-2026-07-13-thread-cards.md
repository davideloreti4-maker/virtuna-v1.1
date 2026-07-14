# Handoff — thread cards: audit + the first three fixes (2026-07-13)

**Worktree:** `~/virtuna-explore-a` · **Branch:** `lane/explore-a` · **Port:** 3001
**Design canon:** `docs/subsystems/ui-skill-cards.md` **§0.5 THE CARD CONTRACT** ← read this first.

---

## The one-paragraph version

The cards are not uniformly bad. The **hook card is genuinely good and is the bar**; ideas and script
already match it. Everything else drifted, each in its own direction, because each was built alone
with no written contract to conform to. So the fix is not "restyle all the cards" — it is *write the
contract down, then bring each card to it.* The contract is now written (§0.5). Three cards are now
at it. Nine are not yet audited, and two cannot be seen at all.

---

## Shipped this session (3 commits on `lane/explore-a`)

| Commit | What |
|---|---|
| `5ce8dc24` | **A remix names the video it remixed.** |
| `a8c583ed` | **Doubled quotes killed at the boundary** (11 sites). |
| `c480b902` | **Profile Read + The Read brought to the card language.** |

**Remix (`5ce8dc24`).** The most source-derived card we ship rendered its source as an anonymous grey
thumbnail — you could see the post, never learn whose it was. The data was never missing:
`resolveVideoUrl` parses the very Apify item carrying `authorMeta.name` and `playCount`, destructured
`{ mediaUrls, videoMeta }`, and dropped the rest. Now threaded through to the same `<ProofReceipt>` the
grounded cards use — **but under its own eyebrow, with `multiplier`/`baselineLabel`/`fitLabel` null**,
because "Proven structure" and the fit glyph are claims retrieval earns and a pasted video has not.
`fitLabel` is now nullable for exactly this. (See §0.5b — do not "unify" this away.)

**Quotes (`a8c583ed`).** Profile Read rendered `""I'd need to double-check.""` — the component wraps in
typographic quotes AND the model quoted itself. Profile Read was just where the fixture exposed it:
**eleven** sites wrap model text this way. One shared `stripWrappingQuotes()` at the boundary. It
strips at most one matched pair — an internal quotation (`He said "no"`) and a lone apostrophe survive.

**Profile Read + The Read (`c480b902`).** Profile Read had **five ALL-CAPS labels stacked at identical
weight** (so nothing led) and its payoff sentence sitting *third* at body weight; it now leads. The
Read **had no card container at all** — a bare `flex flex-col`, the only skill output with no surface,
floating loose on the thread background. And **the verbatim wall repeated itself**: two audiences ×
the same archetype → the identical line printed twice (3 of 8 quotes were dupes). Quotes now merge on
`(quote, archetype)` and tag both audiences — merged, not dropped, because "both audiences said it" is
real information. A focus group that repeats itself word-for-word reads as fabricated, on the one
surface whose whole job is to be believed.

**Verified:** 3085 tests green (293 files); `tsc` clean; every claim browser-checked, not assumed.

---

## Do this next, in this order

### 1. FOUNDATION (small — do it before any redesign)
- **Close the gallery hole.** `/dev/cards` covers **12 of 14** blocks. `personas` and
  `persona-chat-turn` — *the ambient-audience surfaces* — are absent from
  `src/app/(app)/dev/cards/fixtures.ts`. They are currently **unauditable**. This blocks the ambient
  audience batch entirely.
- **Add a radius guard test.** Fail the build on `rounded-[Npx]` in `src/components/thread/**`, the
  way `reading/__tests__/reskin-matte.test.ts` guards against coral. Without it the drift returns.
  Known offenders remaining: `18px` + `11px` (Reading panel), `5px` (remix legacy cover fallback).
- Contract is already written: `docs/subsystems/ui-skill-cards.md` §0.5.

### 2. THE READING CLUSTER (biggest surface, share the band language)
`Test/Reading` (`src/components/reading/**`) + `Simulate` (`reaction-distribution`) + `Predict`
(`prediction-gauge`). Reading is the **core product surface and is completely unaudited** — I only ever
saw it downscaled. Known: off-scale `18px`/`11px` radii, and it renders audience quotes in **Newsreader
serif** while every other surface uses Inter italic (same semantic thing, two typefaces).

### 3. THE AMBIENT AUDIENCE (lane-a charter — blocked on Foundation)
`personas`, `persona-chat-turn`, `AmbientRoom.tsx`, `audience-presence.tsx`.

### 4. THE STRAGGLERS
`account-read`, `outlier-grid` (Explore), `SkillResultCard` (Ask/Explore wrapper — it IS load-bearing,
not dead).

---

## Traps — these cost me time, they will cost you time

- **`font-mono` is SANCTIONED, not a bug.** `docs/DESIGN-SYSTEM.md` §Type says so explicitly and warns
  against "fixing" it. I nearly filed it as drift. Check the source before touching it. (The one I'd
  still question: `ask →` is an *action* rendered in mono, not a label.)
- **Playwright screenshots hang on this app** — ambient animations never settle. Inject
  `* { animation: none !important; transition: none !important }` via `browser_evaluate` first. Works.
- **`fullPage: true` does not work.** The app scrolls in `main.relative.h-full.overflow-auto`, not on
  the document, so a full-page shot captures only the viewport. Tag sections with a `data-*` attribute
  via `browser_evaluate`, then screenshot **per element**.
- **Tall elements (>2000px) downscale into illegibility.** For those, **probe the DOM instead of
  looking** — `getComputedStyle` for fonts/radii, and count repeated `textContent` to catch duplicate
  quotes. The DOM probe found things the screenshots could not.
- **`npm test` / `npx vitest` print fake results.** Use
  `node ./node_modules/vitest/vitest.mjs run <paths>`.
- **The Playwright MCP browser has its own profile** — it is NOT logged in even when your Chrome is.
  Someone must sign in once at `localhost:3001/login`; `/dev/cards` sits inside the authed `(app)`
  layout with no bypass.
- **`.env.local` is permission-denied to the agent.** Don't try to read it.

## Verification recipe (cheap, and it actually catches things)

1. `NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3001`
2. Browser → `localhost:3001/dev/cards` (renders **every** block 1:1 through the REAL components).
3. Freeze animations, tag sections, screenshot per element (see traps).
4. DOM-probe the invariants: off-scale radii, font-family, duplicate quote text.
5. `node ./node_modules/vitest/vitest.mjs run src/lib src/components` + `npx tsc --noEmit`.

## Open product question (needs an owner call, not a code change)

When grounding finds no source, a card renders **no receipt** — so a live Ideas run gives a **ragged
stack**: card 1 with a receipt, card 2 without. It is honest, but it reads as broken. Options: accept
it; render a quiet "no source" state so the absence looks deliberate; or require grounding. Visible
today in `/dev/cards` → Ideas.
