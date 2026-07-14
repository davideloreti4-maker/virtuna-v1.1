# Audit — the nine remaining cards vs THE CARD CONTRACT (2026-07-13)

**Read-only.** No code changed. Canon = `docs/subsystems/ui-skill-cards.md` §0.5 (spine),
§0.5b (honesty spine), §0.6 (coverage). Worktree `~/virtuna-explore-a`, branch `lane/explore-a`
@ `d195dc10`.

---

## The headline

**The primitive the contract rates "low risk" is the only thing that is actually broken.**
`markdown` renders through `prose prose-invert prose-sm` — and those classes generate **zero CSS**.
`@tailwindcss/typography` is not a dependency and Tailwind v4 requires an explicit `@plugin`
directive, which `globals.css` does not have. Meanwhile Preflight *is* active, so it strips
headings and lists. Net effect, browser-verified against the app's real compiled stylesheet:

| what the model emits | what the user sees |
|---|---|
| `## A heading` | body text — `16px / 400`, computed **identical** to `<p>` |
| blank line between paragraphs | nothing — `margin-bottom: 0px`, one run-on wall |
| `1.` `2.` `3.` numbered list | **the numbers disappear** — `list-style: none`, `padding-left: 0` |

The `/dev/cards` chat fixture is literally a numbered three-item list ("Three angles worth
posting: 1… 2… 3…"). It renders as three unnumbered, unindented lines.

The other eight cards are *drifted*. This one is *broken*, and it sits under Ask, Explore,
`/chat`, and the model follow-up beneath every single card.

> **Method note.** Proven, not inferred: `@tailwindcss/typography` absent from `package.json` and
> `node_modules/@tailwindcss/`; zero occurrences of `prose` across every compiled stylesheet in
> `.next`; then a standalone page linking the app's **real compiled `globals.css`**, containing
> the exact `markdown-block.tsx` DOM, probed with `getComputedStyle` in a browser. The table above
> is measured output.

---

## Ranked worklist — one card per session

Ordered by damage × cheapness. Ranks are the fix's *shape*, not its size.

### 1 — `markdown` + the dead prose classes · ✅ **FIXED 2026-07-13** (`.md` layer, globals.css)
- Was: `markdown-block.tsx` + `conversational-frame.tsx` used `prose prose-invert prose-sm` → no-ops.
  `reading-chat.tsx` used `reading-chat-prose`, `ExpertChatThread.tsx` uses `prose-chat` — neither
  class defined anywhere (`globals.css` is the repo's only stylesheet).
- **Fixed by writing the `.md` layer** rather than installing the typography plugin — `prose-invert`
  paints cold grey (Tailwind `gray.300`), which §1.2 forbids, and theming the plugin back to the cream
  tokens is more config than the ~40 lines the app actually needs.
- **A second ordered-list bug surfaced during the fix.** `reading-chat` hand-rolled its own element
  overrides, and its shared `li` renderer forced EVERY item to a dot span — so an ordered list
  rendered as identical bullets and `1. 2. 3.` lost its numbers *there too*, by a completely
  different mechanism. Both paths destroyed enumeration. Its overrides are gone; `.md` owns it.
- **`ExpertChatThread.tsx` deliberately NOT touched — it is dead code.** `CommandBar` (its only
  consumer) is not mounted anywhere in the app; `reskin-matte.test.ts` already exempts it as legacy.
  It still carries `bg-coral/70` (the retired system). Delete the folder or leave it; do not style it.
- **Verified in a browser against the production stylesheet**: heading now `18.4px/600` vs body
  `16px/400` · paragraph gap `11.2px` · `<ol>` → `decimal` (numbers back) · `<ul>` → `disc` ·
  markers cream-muted `#8a857c` · body cream `#ece7de`, not cold grey.

### 2 — The old-stack label sweep · **SMALL FIX ×4 files** · one commit, app-wide
The contract says section labels are `text-[11px] tracking-[0.05em]` — "NOT `10px`/`0.14em`
(that was the old stack)". Eight sites still run the old stack:

| file | sites | why it matters |
|---|---|---|
| `reading/reading-section.tsx` | 1 | **the section-label primitive every `/analyze` block is built from** — one line re-labels the entire Reading surface |
| `thread/prediction-gauge-block.tsx` | 3 | |
| `thread/reaction-distribution-block.tsx` | 1 | |
| `reading/fix-first-list.tsx` | 2 | |
| `reading/reading-chat.tsx` | 1 | |

Bundle with the `band-block` primitive fix (below) — same commit, same idea: **fix the primitive
and the copies follow.**

### 3 — `band-block` (primitive) · **SMALL FIX** · it is the source of the drift
- **Band color is applied twice**: the word is band-colored *and* the fraction is band-colored at
  `opacity: 0.8`. §1.3: "Band color used ONCE (a dot + the word), never double-applied."
- No dot. The contract's band is `dot + word`.
- Its `text-2xl` colored band word is the pattern Simulate and Predict both copied as their *hero*.
- `reaction-distribution-block.tsx` re-declares its own local `BAND_COLOR` map instead of importing
  the one `band-block.tsx` explicitly exports for reuse. Two maps, one meaning.

### 4 — `reaction-distribution` (Simulate) · **STRUCTURAL** · carries a real honesty bug
- **The fraction is stated twice, from two different sources.** The top row prints `fraction`
  (from `aggregateFlash`, never re-rolled). The drill recomputes `{stopCount}/{total}` client-side
  from `reactions`. **These can disagree** — the card can show `8/10` up top and `7/10 react`
  below, on the one surface whose job is to be believed. §1.3 says state it once; this is why.
- Provenance sits in the **eyebrow** (model label + `TrustBadge`). §0.5.1: "Provenance does NOT go
  here." §6: demote the model tag onto the disclosure line.
- Hero = the band WORD at `text-2xl`. §0.5.2: the hero is the deliverable — "not a label, not a
  name, not a score." (The `person` variant *does* lead with a sentence — but at 15px, not 17px.)
- No `<ProofUnit>`, no "See the room →" — on the card whose entire subject **is** the room.
- Action bar is two stacked rows: Save alone, then a `<textarea>` + a text-link "Predict an
  outcome →". No cream primary; Save is not `ml-auto`.
- `text-red-400` (line 229) — the **only** raw Tailwind color left in `thread/**` + `reading/**`.
  Cold red, off-token.

### 5 — `account-read` · **STRUCTURAL** · the exact bug Profile Read was just rebuilt for
- **Six stacked equal-weight ALL-CAPS labels**: Posts we read · What's working · What to fix ·
  Recurring hooks · Format mix · Drop-points. §0.5: "A stacked ladder of equal-weight ALL-CAPS
  labels is the failure mode… If a card has four or five of them, it has no hierarchy and reads as
  a spec sheet." Profile Read was fixed at five. This has six.
- **No hero.** The card opens on the creator's *name* at 15px semibold — §0.5.2 names this exactly:
  "not a label, not a **name**, not a score." An Account Read's payoff (the one thing that's
  working, the one thing to fix) is never promoted; it's a bullet in a two-column grid.
- **No disclosure.** Everything is on the face; nothing collapses into "Why & details" — which is
  precisely where three of those six labels belong.
- "Write to my strengths →" is a bare text link, not the cream primary (`--color-action`) §7 requires.

### 6 — `outlier-grid` / `OutlierTile` (Explore) · **STRUCTURAL** · the tile has no card
- **No card surface.** The tile is a bare `space-y-2` stack. The only border inside it belongs to
  the *nested* `VideoCard` (the metrics). So the multiplier, the fit bar and the CTA float on the
  thread background **around** a bordered sub-card — the border is around the wrong thing.
  Tell: `OutlierTileSkeleton` draws a bordered card that the real tile never delivers.
- Hero = the multiplier number at 20px. The actual deliverable — the video and its caption — sits
  below, small, inside `VideoCard`.
- Two action rows: Save + Track, then a full-width Remix CTA *below* them. Save sits **above** the
  primary. Contract: one bar, cream primary + `<SaveAffordance className="ml-auto">`.
- Stale in-file comment (line 21) still claims "Remix → Read: the SINGLE **coral** element on the
  tile". The code is cream. The comment is the retired system talking.
- **Honest where it counts** ✅ — multiplier never bare (always with `baselineLabel`), fit omitted
  entirely when null, no SIM band or quote on measured data.

### 7 — `prediction-gauge` (Predict) · **STRUCTURAL — but blocked on an owner call**
- **The owner call: this card renders `~35–60%`.** §0.5b: "Bands only… **Never a 0–100 score** —
  except the video Read's engine score, the one place a number is honest." But the gauge's own spec
  (06-UI-SPEC) made the *feathered numeric range* its honesty device — the whole point is that it
  reads "somewhere in here," not "exactly here," and the `.strict()` schema forbids a point-score.
  **Two written rules conflict.** Don't silently fix either one. See "Owner calls" below.
- Vocabulary collision: `band` here means Unlikely/Toss-up/Lean/Likely. `band` everywhere else means
  Strong/Mixed/Weak. Same prop name, two vocabularies, one thread.
- Provenance in the eyebrow again; three old-stack labels (covered by item 2).
- Hero = band word at 24px (off the 17px scale), with the scenario *above* it at body weight —
  eyebrow and hero inverted.

### 8 — The nits · **SMALL FIX** · batch them into one commit
- **`SkillResultCard` (Ask/Explore wrapper — load-bearing, used by `chat-thread-view` +
  `explore-thread-view`).** Its header is `{skill} · {audience}` at `text-xs` — not the contract
  eyebrow (11px uppercase `0.05em` + 6px dot). One line. It also wraps markdown payloads, so it
  inherits item 1.
- **`personas`.** Has a genuine Lens entry (avatars + "See the room →") ✅ — but the `RoomAvatars`
  markup is **hand-copied** from `proof-unit.tsx` (same `[0,1,2].map`, 15px, `-5` margin). Two
  copies of the flagship cue is where the next drift starts; extract it. Quote styling also
  diverges from `ProofUnit` (muted, no left rule — vs `foreground/80` + `border-l-2`). And the
  header puts a Lens click-target and a Show/Hide button side by side — a hit-area hazard.
- **`persona-chat-turn`.** Essentially **conformant** ✅ — contract eyebrow, no fabricated band or
  score, minimal. One question, below.

### 9 — `reading/**` · **the doc's #2 priority is partly a GHOST**
- 🔴 **"Serif quotes" does not exist.** `docs/subsystems/ui-skill-cards.md` §0.6 and
  `HANDOFF-2026-07-13-thread-cards.md` §2 both send the next session to fix Reading rendering
  audience quotes in Newsreader serif. **There is no `serif` anywhere in `reading/**`, and no
  `blockquote` / `&ldquo;` either.** The serif that *does* exist is in
  `audience-lens/AmbientRoom.tsx` — and it is on **headlines** ("How the room ranked your 3
  hooks", "{n} of {total} would stop"), which the design system explicitly sanctions
  (Newsreader = voice-moments). Do not spend a session on this.
- The real Reading finding is item 2: `reading-section.tsx`, the primitive every `/analyze` block
  is built from, still runs the old label stack.
- Radii are on-scale and guarded ✅. The 0–100 engine score here is the **sanctioned** one ✅.
- Still genuinely unaudited *visually* — but it is no longer the scary unknown the handoff implies.
  It is structurally closer to the contract than Simulate, Predict, Account Read or Explore are.

---

## Owner calls (decisions, not code)

1. **Does Predict keep its `~35–60%`?** §0.5b forbids 0–100 numbers outside the video Read; the
   Predict spec makes a feathered *range* its central honesty device. My read: the range is honest
   *because* it's feathered and can't collapse to a point — so §0.5b should be amended to name the
   second exception, rather than the card being stripped. But it is your call, and it must be
   written down either way, or the next audit re-opens it.
2. **Persona chat: bubble or no bubble?** §2 says the chat language is "Numen = flush-left prose
   (**no bubble**)" and that persona chat reuses it. `persona-chat-turn-block.tsx` gives the
   persona's answer a **bordered bubble**. One of the two is stale.
3. **The ragged receipt stack** (already open, carried from the handoff): a live Ideas run yields
   card-with-receipt above card-without. Honest, reads as broken.

---

## What I did not find

Worth saying, so nobody re-runs it:

- **No doubled quotes** anywhere in the nine. `stripWrappingQuotes()` is applied at every model-text
  boundary I checked (9 component sites).
- **No fabricated claims.** Every card degrades honestly: Account Read's thin-history fallback,
  the outlier tile omitting `fit` entirely when null, Simulate's `person` variant refusing to show
  a fraction for a single human, `prediction-gauge`'s `.strict()` schema forbidding a point-score.
  The honesty spine is in better shape than the visual spine.
- **No off-scale radii.** The guard test (`thread/__tests__/radius-scale.test.ts`) holds, and it
  covers `reading/**` too. Note it deliberately allows *on-scale* arbitrary syntax (`rounded-[8px]`
  ≡ `rounded-md`), so those are **not** findings — the hook card itself uses one.
- **No legacy coral**, and exactly **one** raw Tailwind color (`text-red-400`, item 4).
- **`font-mono` is sanctioned** — checked, not flagged (per the handoff's own trap list).
