# Handoff — the funnel IS the platform (2026-07-26)

**Worktree:** `~/virtuna-onboarding` · **Branch:** `milestone/onboarding` · tip `8de8f1d0`
**Green:** suite **4543 / 0** with flags unset AND with `AMBIENT_V2_ENABLED` + `BILLING_ENFORCE_QUOTA`
on · `tsc` 0 · eslint 13 errors / 33 warnings, all **pre-existing** (the pre-merge tip measured 14/33).

> ⚠️ **`HANDOFF-2026-07-24-onboarding-funnel.md` is SUPERSEDED.** It describes the 4-beat walkthrough
> as the deliverable. That concept is retired — read **`ONBOARDING-FUNNEL-DESIGN.md` §0b** first, which
> supersedes §0a②, §2's checkout constraint, and all of §4's "S1 · The interactive demo".

---

## 1. What changed, in one line

The demo stopped being *a walkthrough of the product* and became **the product, run anonymously,
gated at the simulation verdict.**

Owner, three times over: *"I want a real experience, same as on the platform"* — the live composer,
the live thread, the rail. Not cards, not a fixture route, not a tour.

## 2. Why this is cheap: the spike proved it end to end

Anonymous sign-in is **live in prod** (owner enabled it 2026-07-26). Measured, not assumed:

| Check | No session | Anonymous session |
|---|---|---|
| `GET /api/profile` | 401 | **200** |
| `GET /api/subscription` | 401 | **200** |
| `GET /api/threads/open` | 401 | **200 + real `threadId`** |
| `GET /api/audiences` | 401 | **200** |
| `POST /api/analyze` | 401 | **400 — schema validation** (cleared auth AND quota) |
| RLS INSERT on `threads` | — | **✅ row persisted, verified in the DB** |

**`HomePageLayout` needs zero changes.** It takes no props and no user. The auth dependency lives
entirely above it — `(app)/layout.tsx`'s `getUser()` redirect and `AppShell → AuthGuard`, and
`AuthGuard` gates on `getSession()`, which an anonymous session satisfies.

RLS admits anonymous users because the policies are `TO authenticated ... USING (user_id =
auth.uid())` and an anon user **holds the `authenticated` role** — `is_anonymous` is only a JWT claim.
**No migration needed.**

Unplanned bonus: the shell already defaults to the **General baseline** audience, and
`general-baseline-signature.ts` exists precisely so an uncalibrated user can flow the population
projection with archetype-true (not random) axes. The anonymous visitor's audience story needs no work.

## 3. What is BUILT this session

### The merge (`ca98be27`)
This worktree was **17 commits behind main** and missing exactly the surfaces the funnel reuses:
`AmbientOverviewSheet` (the `<xl` mobile audience room — **did not exist here at all**, on ~100%
mobile traffic), `use-test-run-stages.ts`, `persisted-thread-stream.tsx`, the in-thread Test seal
(`45297788`), and — landed the same day — **`abfbab60`, the Test card's Simulate door opening the
room instead of `/analyze`**, which is precisely this design's seam.

### The anonymous demo pool (`8de8f1d0`)
`DEMO_CREDITS` = one Reading, keyed on `is_anonymous`.

🔑 **The bug this prevented was invisible.** An anonymous user resolves to tier `free`, allowance
**0**. It works today only because `BILLING_ENFORCE_QUOTA` is off. The day that flag flips for the
Whop launch, **every visitor would have hit a 402 on the conversion page**, with nothing alerting
anyone — the meter doing exactly what it was told. Same shape as the flag-forced-on suite lesson:
green for the product you are not shipping.

Three decisions inside it, each deliberate:
- keyed on `is_anonymous`, **never** tier `free` — all 9 existing users are tier free, and widening
  that allowance would have handed every one of them free engine runs;
- enforced **regardless of `BILLING_ENFORCE_QUOTA`** — that flag protects paying customers pre-Whop;
  it is not a licence for unbounded free engine spend by strangers, who are unbounded in number;
- fails **CLOSED** for the demo, **OPEN** for customers — failing open would give every visitor
  unlimited runs for as long as the ledger is down. ⚠️ *Owner may overrule: costs conversions during
  an outage.*

Guard verified to **fail against the old code** before passing (revert the always-enforce line →
`× CAPS the demo even with BILLING_ENFORCE_QUOTA off`).

## 4. What is NOT built — the next session's work

1. **`/go` → anonymous session + the real shell.** Mechanics proven by the spike; mostly composition.
   Open: does the funnel *replace* `/go`, or sit above its 17.2 screens of persuasion?
   (Recommendation: replace, keep the persuasion below for people who scroll instead of running.)
2. **The wall** — seal the sim verdict **server-side** so it is never transmitted. `sealTemplate`
   already strips exactly `unlock` / `brain.whyThisSecond` / `population`; point it at a live run.
3. **Checkout + identity linking** — needs `enable_manual_linking` (owner says in hand).
4. **Copy** — `/go` claims "1,000 viewers" twice; true for `expandSignature`, so keep it, but it must
   agree with the scale the visitor picked.
5. **An anonymous-user reaper.** They accumulate. 2 exist now (spike artifacts).

## 5. Landmines

- ⛔ **Never `npx supabase config push`** — pushes the whole `[auth]` block; would set prod
  `site_url` to `127.0.0.1` and cap auth email at 2/hour. Patch the Management API instead.
  There is **no Management API token on this machine**; the Supabase MCP does not expose auth config.
- **`/api/analyze` lies three ways** — silent cache replay (pass `bypass_cache=true`), a degraded run
  still returns 200 with a score, and `tiktok_url` re-host times out on >~30s video locally.
- **Confidence rises as signals disappear** — a scrape-failed run was labelled HIGH (0.55) while a
  full-signal run scored LOW (0.35). Not traced. It now sits in front of a paying visitor.
- **The old walkthrough's layout bug is still there**: `walkthrough.tsx:255` mounts `AmbientDetail`
  in a wrapper with **no height**, so `height:100%` collapses, `overflow-y-auto` never engages, and
  it renders **2,182px instead of 800** (whole section 3.24 screens on a phone; the `$1` button
  2.87 screens down). The reference mount `ambient-v2/page.tsx:195` bounds it with
  `AMBIENT_PANEL_HEIGHT`. One-line fix, only worth doing if the walkthrough survives as a fallback.
- **Tests:** `npm test` is fake — `node ./node_modules/vitest/vitest.mjs run`. **Run it both flag
  ways.**
- **Dev server:** `NEXT_PUBLIC_AMBIENT_V2=true`, nohup (not setsid). `.env.local` must be copied from
  `~/virtuna-v1.1/` — it does not follow a worktree.

## 6. Merge hazards (unchanged, still live)

1. Prod caps auth email at **2/hour** (`rate_limit_email_sent = 2`) — needs custom SMTP.
2. Prod `site_url = http://localhost:3000` with a localhost-only allow-list. **Unverified** whether
   OAuth / password reset currently break — check, do not assume.
3. **This branch deletes 143 inherited `.planning/` files.** Merging naively strips the Numen GSI
   milestone's docs from `main`. Recipe:
   ```bash
   cd ~/virtuna-v1.1 && git switch main && git pull
   git merge --no-ff milestone/onboarding
   git checkout HEAD^ -- .planning
   git commit --amend --no-edit
   git diff HEAD^ HEAD --stat -- .planning   # MUST be empty
   ```
