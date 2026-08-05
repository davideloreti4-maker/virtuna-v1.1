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
   **Only `QWEN_UNBOUND_CHAT_MODEL` is still held on plus.** See §4 — the source comments were the
   reason the brief said otherwise.

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

**Still true and NOT touched:** `QWEN_UNBOUND_CHAT_MODEL` stays on **plus**. Flash opens with a
correct refusal and then writes the paid pack anyway (5/6 leaked). Cost is not a reason to touch it.

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
- Retry flash on `QWEN_UNBOUND_CHAT_MODEL`, only behind a fresh `live-chat-anon.mjs` showing
  **6/6 refused, 0 leaked**.
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
