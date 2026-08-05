# Handoff — walking the product on a phone, and the invisible button that spent credits (2026-08-05)

**Base:** `origin/main` @ **`bd307ae5`**. **Branch:** `task/prod-ready-walk`. **Worktree:** `~/virtuna-slot-a`.
Read refs with `git rev-parse` — `git log` elides merge commits in this repo.

Continues `docs/HANDOFF-2026-08-04-thread-scroll-and-corpus.md`, whose §7 P1/P2 said: walk every
route, signed in, desktop **and** mobile, because the scroll defect existed only because nobody had
looked. That is what this session did. Mobile is where the product was broken.

---

## 0. ⚠️ Two corrections to the brief this session was handed

1. **The stated base `27a66748` was 8 commits stale.** Real `origin/main` was `bd307ae5` — PRs
   **#431** (Apollo + CALIBRATE → flash), **#433** (omni modality split), **#436** (sim-rail docs)
   had landed. Work was branched off the real tip. Always `git fetch` + `git rev-parse` first.
2. **"FIVE model constants, three deliberately on qwen3.7-plus" is no longer true, and had not been
   for a day.** #431 moved Apollo and CALIBRATE to **flash** by fixing our own prompt/parse layer.
   `QWEN_UNBOUND_CHAT_MODEL` was the last one held on plus — and **this session retired that too, by
   fixing the guard it was covering for (§12). The platform now runs ZERO model holdouts.** See §4:
   stale source comments were the reason the brief said otherwise.

---

## 1. What shipped

| # | defect | severity | where |
|---|---|---|---|
| **1** | An **invisible button that spends credits** on touch | **high — revenue** | `saved-row.tsx` |
| **2** | `/library` titles collapse to one word per line on mobile | high | `saved-row.tsx` |
| **3** | `/library` header painted through its own search field | high | `surface-header.tsx` |
| **4** | The engine's follow-up prose used a second, wider measure | medium | `conversational-frame.tsx` |
| **5** | The 3 "pre-existing" unhandled rejections — **retired**, suite now reaches EXIT=0 | medium | `composer.test.tsx` |
| **6** | Model-constant comments stated the opposite of their values | medium | `qwen/client.ts` |
| **7** | The live probe could not open the signed-out half of the app | — (harness) | `probe-surface-live.mjs` |
| **8** | The artefact guard was blind to an **unquoted** pack — the paid product, free, to anonymous visitors | **high — revenue** | `chat-agent-loop.ts` |
| **9** | The anon harness reported prose *between* two quotes as a leak, inflating both arms | — (harness) | `live-chat-anon.mjs` |
| **10** | The guard armed itself by INFERENCE — a free tier would have switched it off silently | **high — revenue** | `chat-agent-loop.ts` |

---

## 2. 🔴 THE ONE THAT MATTERS — an invisible tap target on a billable action

`SavedRow`'s forward action (`Write script →`, `Read it →`, …) is revealed by hover:
`opacity-0 … group-hover:opacity-100`. **A touch pointer has no hover, so it could never be
revealed — and it was never removed either.** Measured on `/library` at 390×844, before the fix:

```
opacity: "0"            visibility: "visible"     pointerEvents: "auto"
box: 88×20 at x=260     document.elementFromPoint(centre) → the button itself
```

`onClick` runs `handleForward()`, which POSTs `forward.endpoint` — **a billable skill run**, with a
402 credit-wall path of its own. So on a phone, a creator tapping the right-hand side of any Library
row spent their credits on a run they never asked for and could not see.

Fixed in two independent layers, because one is not enough:

- `hidden sm:block` on the cell — below `sm` the column is not laid out at all.
- `pointer-events-none group-hover:pointer-events-auto` on the button — this is the one that closes
  a **touch tablet**, which is wide enough to render the column and still has no hover to reveal it.

Verified at three widths, and the hover path re-verified so the fix did not just delete the feature:

```
✓ safe  phone   390x844  touch   inLayout:false  pointerEvents:"none"  tapLandsOnIt:false
✓ safe  tablet  820x1180 touch   inLayout:true   pointerEvents:"none"  tapLandsOnIt:false
✓ safe  desktop 1440x900 mouse   inLayout:true   pointerEvents:"none"  tapLandsOnIt:false
before hover : {"opacity":"0","pointerEvents":"none","tapLandsOnIt":false}
hovering row : {"opacity":"1","pointerEvents":"auto","tapLandsOnIt":true}   ✓ still works
```

> 🔑 **`opacity-0` is not "hidden" — it is "invisible and still clickable".** Any hover-revealed
> control that *does something costly* needs `pointer-events-none` in the same breath. Grep for
> `opacity-0` next to `group-hover:` before trusting another one.

---

## 3. Mobile — measured, not eyeballed

`/library` at 390×844. Every number here is from `getBoundingClientRect`, not a screenshot:

| | before | after | desktop (unchanged) |
|---|---|---|---|
| `h1` box for the 59px word "Library" | **16px** (overflowed) | 358px | 72px |
| row title button | **12px** | 176px | 486px |
| hero lines per row | **10–11** | 2–3 | 1 |
| rail width | 282px | 118px | 282px |

**Two independent causes, same family — a `shrink-0` sibling eating a `min-w-0` flex item:**

1. `SurfaceHeader` never stacked. Its actions are `shrink-0` (correctly — a search field that
   collapses to nothing is worse than one that wraps), so at 390px they took **330px of a 358px**
   content width and left the title 16px. It now stacks below `sm`; above it nothing moves.
2. `SavedRow`'s rail is `shrink-0` with fixed columns totalling 282px — of which **152px was the
   hover-only action** from §2, space that could never be used on the pointer that reached it. The
   action column is now reserved only from `sm` up.

Also: the disclosure caret was `opacity-0 group-hover:opacity-100`, so on mobile there was **no cue
at all that a row expands**. Now always drawn below `sm`.

> 🔑 **Why the probe said "✓ nothing flagged" through all of this.** There is no horizontal
> overflow — the text *wraps* instead, so `scrollWidth === clientWidth` reads clean. And jsdom has
> no layout, so no unit test can see it. **A layout that fails by wrapping is invisible to every
> automated check in this repo.** You have to look at the screenshot, or measure the box.

---

## 4. The model comments said the opposite of the model constants

`e22196bdd91b` (#431) changed **exactly two lines** — the `QWEN_APOLLO_MODEL` and
`QWEN_CALIBRATE_MODEL` values, plus→flash — and left ~30 lines of comment above them reading
**"⚠️ Apollo STAYS ON 3.7-PLUS"** and **"⚠️ CALIBRATE STAYS ON 3.7-PLUS"**, plus a header claiming
"TWO scoped holdouts … both on 3.7-plus".

That drift had already misled a reader: the brief for **this** session repeated it as fact. Someone
debugging an Apollo score would rule the model out as a variable on the strength of a comment that
is wrong. Corrected — **comment-only, no behaviour change** — keeping the evidence history (which is
genuinely valuable) but leading with what is true now, including the accepted ~30-point harsher
grading and the one-env-var rollback.

**Then the same thing happened to the third comment.** `QWEN_UNBOUND_CHAT_MODEL`'s block said
"THE UNBOUND CHAT PATH STAYS ON 3.7-PLUS" — true when written, and **no longer true as of this
session**: the leak it described was a gap in `createArtefactGuard`, not a property of the model, and
closing that gap retired the holdout. See **§12** for the measurement. The comment now leads with
what is true and keeps the history underneath, same as the other two.

---

## 5. The "3 pre-existing errors" were a mock, not the product — and the suite can now exit 0

They have been called pre-existing across at least three handoffs and made **every** suite run end
`EXIT=1`, which trains everyone to ignore the exit code. All three were one line:

```js
const start = vi.fn();          // returns undefined
```

The real `useAnalysisStream().start` is `async` (`use-analysis-stream.ts:629`), and `composer.tsx`
chains `.catch()` onto its return at both Test-send sites. Reading `.catch` off `undefined` throws
a TypeError inside an async callback nobody awaits — an unhandled rejection. **Nothing was wrong
with the product; the mock's return type disagreed with the function it stood in for.** Fixed at the
mock (`mockResolvedValue(undefined)`), not by making the product defensive against a bad double.

`composer.test.tsx` alone: **27 passed, 0 unhandled, EXIT=0.** Full suite: **`Unhandled Errors` is
gone in every run since**, and a clean run now reaches **474 files / 5296 passed / 0 failures /
EXIT=0** — the first zero exit across these handoffs.

### ⚠️ But EXIT=1 is not fully dead, and the remaining cause is NOT this

Three full runs on this branch:

| run | conditions | failures | unhandled | `ECONNREFUSED` | exit |
|---|---|---|---|---|---|
| 1 | dev server + probes running | 2 (`tiktok-url-branch`, `derive-and-drop`, ~5007ms) | 3 | 435 | 1 |
| 2 | clean | 1 (`composer-stop-disc`, 5009ms) | **0** | 485 | 1 |
| 3 | clean | **0** | **0** | 375 | **0** |

A *different* file fails each time and each failure is a 5s timeout, which is the shape of a flake,
not a regression — `composer-stop-disc` passes **3/3** run alone.

> 🔑 **The suite makes 375–485 real network connections to `localhost:3000` per run.** The
> environment is `happy-dom`, whose default document URL is `http://localhost:3000`, so any
> relative-URL `fetch` that escapes a per-file stub — typically a pending request landing after
> `afterEach`'s `vi.unstubAllGlobals()` — becomes a real socket. They normally fail fast and are
> swallowed; occasionally one lands inside a test with a 5000ms budget and times it out.
>
> **This is pre-existing** (435 of them in run 1, before any change here) and **is now the sole
> remaining source of a non-zero exit.** It also means: **never run the suite while a dev server is
> on :3000** — those hundreds of requests would hit a real app against the real Supabase project
> instead of being refused. That is a much better reason for the "slot worktrees must not use :3000"
> rule than port collision.
>
> Deliberately not chased here: finding which file leaks a fetch is its own investigation, and the
> brief's P4 was the three unhandled rejections, which are done and verified.

---

## 6. Looked at, and deliberately NOT changed

- **`/discover` renders 758 chars signed in** — the lead from the previous handoff. **Not a defect
  in Discover.** `/discover` is a deep-link redirect to `/feed/discover`, the paid *Pull* tool. The
  real hub — Outliers · Collections · Watchlist, the 500+ item corpus — is at **`/feed`** and is
  healthy (6,424 chars, 8,623px, full grid + filters). The sidebar correctly links to `/feed`.
  ▶ **Open, owner's call:** a `/discover` *bookmark* lands on a 5-credit pull tool rather than the
  browsable library it used to be. One line in `(app)/discover/page.tsx` if you want it at `/feed`.
- **`/pricing` logs a 401 for anonymous visitors** — `GET /api/subscription` correctly refusing an
  anonymous caller. The page renders every price and CTA. Console noise, not a defect; left alone
  rather than touch the billing path for cosmetics.
- **"Maven" vs "Numen"** — not stale branding. **Maven** is the product (27 page titles, the OG
  image, the signup card); **Numen Machines** is the company ("© Numen Machines", "a Numen Machines
  product"), which is why the domain is numenmachines.com. Coherent. Nothing to fix.
- **The "N" badge overlapping the sidebar account row** in every screenshot is **Next.js's dev
  indicator** (`<nextjs-portal>`, shadow DOM — which is why the DOM probe saw nothing). Dev-only.

---

## 7. The probe got two fixes — it could not open the signed-out half

`scripts/probe-surface-live.mjs`:

1. It waited on `main, textarea, [data-testid]`. **The onboarding routes have none of the three** —
   `/login` renders `<LoginForm />` straight out of the page — so it burned 120s and reported
   `✗ did not load` on a page that renders fine. Now also accepts `form, h1`.
2. Its stale-state check was `page.url().includes('/login')`, which fired **while probing /login**,
   the one route where arriving at /login is a pass. Now compares against the requested route and
   says which of the two causes it is.

Anonymous sweep: `STATE=<empty state file> node scripts/probe-surface-live.mjs /go,/pricing,/login,/signup`.

---

## 8. Routes walked

Signed in, desktop **1440×900** and mobile **390×844**, navigating at each viewport (never resizing
— components measure at MOUNT):
`/home` `/feed` `/library` `/saved` `/audience` `/analytics` `/settings` `/start` `/grow`
`/referrals` `/calendar` `/competitors` `/analyze` `/discover`.
Anonymous: `/go` `/pricing` `/login` `/signup` `/welcome`.

Clean everywhere else: no horizontal page overflow at either width, console clean, and the thread's
autoscroll contract still holds (`composer-thread-region` `below=0` at both widths).

---

## 9. Gates

```bash
node node_modules/typescript/bin/tsc --noEmit        # 0 errors
node node_modules/vitest/vitest.mjs run              # never pipe through `| tail`
```

**At `bd307ae5` + this branch: tsc 0 · 474 files · 5296 passed · 42 skipped · 0 failures ·
0 errors · EXIT=0.**

⚠️ **Run the suite with the dev server STOPPED.** A run alongside a dev server + live probes failed
`tiktok-url-branch` and `derive-and-drop` at exactly ~5007ms each. Both pass alone (`7 passed`), in
engine code this branch never touches. That is the CPU-contention signature the previous handoff
warned about, and it cost time again — **suspect the harness before the product.** See §5 for the
second, unrelated flake that survives a clean run about one time in three.

---

## 10. Still open

- **P3 of the previous handoff — the unhappy paths.** Empty states, a failed scrape, an expired
  session mid-stream, offline. **The credit wall mid-dispatch is still untriggered** — the test
  account has credits. It is a revenue surface with no verification history. This is the top
  remaining item.
- The four blind scrape waits (25–126s each); calibration is the cheapest fix — it HAS real stages,
  it just sends them as `status`.
- ~~Retry flash on `QWEN_UNBOUND_CHAT_MODEL`~~ — **DONE 2026-08-05.** It failed on first measurement,
  then passed once the guard gap it was covering was closed. Zero holdouts remain. See §12.
- Should a pinned chip show its price? Product call.
- The `/discover` bookmark target (§6).
- **The suite's 375–485 real connections to `localhost:3000` per run** (§5) — now the only thing
  standing between this repo and a deterministic exit code.

---

## 11. Ground rules that paid off again

1. **Open it on a phone.** Every desktop check was green while a core surface rendered one word per
   line and hid a billable button under a transparent box.
2. **A layout can fail without overflowing.** Wrapping is invisible to `scrollWidth`, to jsdom, and
   to every probe in `scripts/`. Measure the box or look at the picture.
3. **Suspect the harness first** — twice again this session: two "failing" tests were CPU
   contention, and a "broken" `/login` was the probe's own wait selector.
4. **Verify the comment against the value.** A two-line commit left thirty lines of comment saying
   the opposite, and it propagated into the next session's brief as fact.
5. **A test double must match the signature it stands in for.** Three unhandled rejections across
   three handoffs were one `vi.fn()` that forgot to be async.

---

## 12. The flash flip: refused on the first measurement, then EARNED by fixing the guard

The owner asked for `QWEN_UNBOUND_CHAT_MODEL` to move to flash, then pushed back on the answer with
the right objection: *"there has to be another fix for this, can't just rely on the model."* That
was correct, and chasing it found the actual defect.

### First pass — the gate failed, so the flip was not made

| arm | refused | leaked |
|---|---|---|
| `qwen3.7-plus` | 6/6 | 1/6 |
| `qwen3.7-flash` | 6/6 | **6/6** |

### Then: the guard was blind to the shape the pack actually arrives in

`createArtefactGuard` redacts a **quoted** candidate line. The pack carries **no quotation marks**:

```
### 1. The "Subscription Vampire" Audit
*   **Concept:** A screen-recording walkthrough showing how to find and cancel hidden charges…
*   **Mechanism:** Utility & Fear of Loss. People hate losing money they didn't know they spent…
*   **CTA:** Save this for your next bank statement check.
```

It arrives as **STRUCTURE** — an enumerated list of content units — and a quote-scoped redactor
streams straight past it. Plus was not safer; it just hit the gap less often. **The model was the
last thing standing between a gap in the guard and the customer**, at ~10× the cost of that path.

The guard now judges an enumerated span the same way it already judged a quoted one: a list item or
heading whose body reaches `LEAK_MIN_STRUCTURED_LENGTH` (30) is redacted, a contiguous run collapses
to one marker, and short items are untouched. It **withholds** the line until the newline rather than
post-filtering — a streamed token cannot be recalled.

### Measured: the model stops being the variable

| arm | guard | leaked |
|---|---|---|
| flash | quote-only | **6/6** (every one a real `list-of-N`) |
| flash | **+ structure** | **0/6 · 0/6 · 0/6** (3 runs) |
| plus | **+ structure** | **0/6 · 0/6** (2 runs) |

`QWEN_UNBOUND_CHAT_MODEL` is now **`qwen3.7-flash`**, and the platform runs **zero holdouts**. The
gate that governs the line is unchanged and still binds — move it only behind a fresh
`live-chat-anon.mjs` at 6/6 refused, 0 leaked. What changed is that flash passes it.

Answer quality was checked, not assumed: the refusals still name the reason, still teach the
mechanism in prose, and short terms of art (`"save money"`, `"the $5 latte tax"`) survive untouched.
8 unit tests lock the rule, including that a **signed-in** creator's stream stays byte-for-byte
identical — they paid for those lines.

### ⚠️ The harness was inflating both arms, and the earlier numbers here were wrong

`live-chat-anon.mjs` detected a quoted leak with `"([^"\n]{25,})"`. A straight `"` is the same
character opening and closing, so that regex matched from one term's **closing** quote to the next
term's **opening** quote and reported the ordinary prose between them as a leaked line:

```
Most students hate "budgeting" because it feels restrictive… By renaming it to "spending plan"
                              └────────── reported as a leaked hook ──────────┘
```

That was the **whole** of plus's apparent 1/6 — plus was clean. Straight quotes are now paired by
**parity** (split on `"`, odd segments are inside a quotation), which cannot cross from one
quotation into the next. Typographic quotes keep the regex; they have distinct open/close characters.

> 🔑 **A model holdout is a mitigation, not a fix.** It hides a defect behind a more expensive model,
> bills you for the privilege, and fails silently the moment someone swaps a constant. When a cheap
> model "fails" a safety property, check whether it is exposing a gap the expensive one was papering
> over. Twice now the answer was yes — Apollo's §-cites in #431, and this.


---

## 13. The guard's ON switch — a free tier would have disarmed it silently

Found by asking the obvious follow-up to §12: the guard is now what keeps an unpaid visitor safe,
so **what turns it on?**

It armed from `splitSkills(skills).generators.length === 0` — from the CONSEQUENCE of being
anonymous, not from the fact. That holds only while `FREE_SKILL_TOOLS` is empty, and that list is
**derived**:

```js
export const FREE_SKILL_TOOLS = SKILL_TOOLS.filter((s) => !s.billable);   // empty TODAY
```

Empty by accident of pricing, not by design. Add **one** non-billable skill whose `primaryArg` is
`"topic"` (the default) and `generators.length` becomes 1, `unbound` flips to `false`, and the
artefact guard **switches off for every anonymous visitor**. Nothing fails, nothing logs.

That is not hypothetical. **A free tier is exactly what makes a skill non-billable**, so the planned
credits→limits move is the most likely thing to arm it — you would ship a free allowance and disable
a revenue guard in the same PR, with a green suite.

The guard now keys on the **fact** (`sealedVisitor`, the caller's own `isSealedVisitor`), stated on
the line directly below the one that decides what to bind, so binding and guarding cannot drift.
`unbound` is kept as a fallback for a caller that binds nothing, and still drives the directive and
the model choice — those really are about what the model can do this turn.

3 tests pin it, and the first was **confirmed to fail against the old inference** before being kept:

```
× stays ON for a sealed visitor even when a FREE generator is bound     (old switch)
✓ stays ON for a sealed visitor even when a FREE generator is bound     (fact switch)
✓ still arms with nothing bound, even if the caller forgets to say so
✓ stays OFF for a paying creator — their stream is byte-for-byte their own product
```

> 🔑 **Arm a safety control on the FACT, never on a side effect of the fact.** The side effect was
> true when written and stayed true only by coincidence. This is the same shape as the stale model
> comments in §4: something correct at the time, silently invalidated by a later change, with
> nothing in the build able to notice.

---

## 14. 🚚 Handing over — the credits→limits migration

**Your billing model is already limit-based.** `pricing.ts` is `{ limit, used }` with `limit: null`
meaning unlimited; "credits" is the noun printed on top of a counter (`formatBalance` →
`"X of Y credits left"`). So credits→limits is largely a **re-pricing and a relabel** — the gate,
the 402, `quota-error.ts` and `credit-wall.ts` all survive. What changes is what increments `used`
and the copy.

Two things to carry into that lane:

1. **§13 is why it matters.** A free tier makes a skill non-billable, which is the exact trigger
   that would have disarmed the artefact guard. That is fixed — keep it fixed; do not "simplify"
   `sealedVisitor` back into an inference from what is bound.
2. **The credit-wall surface still has ZERO verification history** and could not be triggered here
   (the test account has credits). The plumbing survives the migration, so verifying it now would be
   doing the work twice — do it **once, after**, against the new units, and do it in a browser
   signed in, not at the wire. Every expensive bug in this repo has lived on the money path.
