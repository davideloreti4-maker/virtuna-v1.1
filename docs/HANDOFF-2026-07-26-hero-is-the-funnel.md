# Handoff — the hero IS the funnel entry (2026-07-26, session 4)

**Worktree:** `~/virtuna-onboarding` · **Branch:** `milestone/onboarding` · tip `1a0a9163`
**Green:** suite **4573 / 0** with flags unset AND with `NEXT_PUBLIC_AMBIENT_V2` +
`AMBIENT_V2_ENABLED` + `BILLING_ENFORCE_QUOTA` on · `tsc` 0 · `npm run build` OK ·
new/changed files lint clean.

> Reads on top of `HANDOFF-2026-07-26-funnel-is-the-platform.md` and
> `ONBOARDING-FUNNEL-DESIGN.md` **§0b**, both still accurate. Nothing here supersedes them.
> ⛔ `HANDOFF-2026-07-24-onboarding-funnel.md` is still the retired 4-beat walkthrough. Do not build from it.

---

## 0. First, the thing that wasted twenty minutes

**This worktree was strictly behind `main` and did not have PR #383.** `main` had already merged
`milestone/onboarding` (as `1bd36b66`) *and* the `/go` below-hero rebuild. Fast-forwarded at the
start of this session, so the `/go` edited here is the shipped one, not a stale copy.

**There is a THIRD worktree not in the CLAUDE.md table: `~/virtuna-maven-offer`, branch
`lane/maven-offer`, dev server on port 3020.** The owner reviewed the work there twice and saw the
*old* page both times, because 3020 serves a worktree without these commits. **This session's work
is on port 3000.** That lane still has `ProductRender` in the slot replaced here, so it **will
conflict on `hero-showcase.tsx`** when it merges.

---

## 1. What changed, in one line

The funnel's entry stopped being a CTA and became the hero itself: `/go`'s hero now mounts the
**live composer**, signs the visitor in anonymously on submit, and hands them the real thread.

Owner picked this over a separate `/try` route when offered the choice — *"or do you think this
should be embedded in the hero?"* — and it is the better shape: no route, no click, and the seam
that carries it (`buildThreadLaunchHref` → the /home seed inlet) already existed.

## 2. What is BUILT (2 commits)

### `92e27639` — the live product in the hero

`HeroEntry` (`src/components/offer/hero-entry.tsx`) replaces `ProductRender`, a *fixture* of the
Test card with a guided build-motion. `ProductRender` stays in the tree, unreferenced from the hero.

```
/go hero → EmbeddedComposer → signInAnonymously (silent, ON SUBMIT)
        → /home?v=Test&seed=…&run=1     ← the pre-existing Seam-4 handoff
        → real thread, real SSE, Test card seals in-thread    ← FREE
```

**Why `EmbeddedComposer` and not the real `Composer`:** the /home Composer is 3,184 lines of thread
machinery — stream hooks, `useParams`, portals, the rail, `AmbientDetail`. Mounting that in a
scrolling page is exactly what rendered the retired walkthrough at 2,182px. `EmbeddedComposer` is
the Room-owned atom built for a surface with no thread and holds none of it.

**🔑 THE BLOCKER THE SPIKE MISSED — `middleware.ts` bounced every anonymous visitor to `/welcome`.**
`/home` is a `PROTECTED_PREFIX`, so every navigation into it passes the onboarding gate, which
redirects any authenticated user without a completed `creator_profiles` row. An anonymous visitor
can never satisfy that gate — no such row is ever written for them — so the funnel did not detour,
it **looped**, on the one page it exists to convert. Invisible because the spike measured **API
routes** with an anon session (all 200) and never navigated a **page** through middleware.
The exemption is narrow on purpose: a real un-onboarded user still goes to `/welcome`, and a session
with **no** `is_anonymous` claim reads as real (the permissive reading would silently drop
onboarding for every legacy signed-up user). Guard verified RED against the old code — 3 fail, while
the narrowness assertions stay green, so they cannot pass vacuously.

**🔑 A FILE CANNOT RIDE A QUERY STRING.** Seam 4 hands intent off as a URL, and the seed inlet
documented Test as degrading to pre-fill without one: *"a video upload needs a file the surface
can't carry."* Wrong behaviour for this funnel — §0b④ makes upload first-class **because** visitors
with nothing posted are the best customers. `src/lib/onboarding/pending-upload.ts` stages the File
in module scope; it survives because `router.push` is a client-side nav (same JS runtime). Consumed
in the seed inlet. **Consume-once + 5-min TTL** — a second read would replay one video into two
billed runs against the visitor's 10-credit pool, and the replay would look legitimate.

**Verb menu left live, not pinned to Test.** "Same as on the platform" is the point and spend is
bounded either way: `DEMO_CREDITS = CREDIT_COSTS.score` is a **credit** pool that every skill draws
from, enforced regardless of `BILLING_ENFORCE_QUOTA`. Checked before allowing it — not a spend hole.

### `1a0a9163` — the room dressed as the platform's room

Owner on seeing it: *"doesn't look clean and the rail on the right side still renders separately and
its old ui"* → *"make it accurate to the actual platform ui not this stale and separate design."*

**Why it read as separate — the panel said so itself.** `ambient-panel.tsx` carried the comment
*"header — mirrors the card's browser-window chrome so the pair reads as a set."* It mirrored
`ProductRender`. `92e27639` deleted that card, so it was echoing a component that no longer existed.

**Why it read as stale — it was a reproduction, not the thing.** The room a logged-in creator sees
is the **≥xl right rail in `audience-presence.tsx`** (the `isRail` branch): *"Persistent rail card:
static, full-height, matte (12px radius, no shadow, no bloom transform)."* The offer panel had
invented its own treatment on every axis:

| | Platform rail | Offer panel (before) |
|---|---|---|
| Radius | `rounded-[12px]` | `rounded-2xl` |
| Fill | `surface-elevated` | `surface-sunken` |
| Shadow | `shadow-none` | **`shadow-2xl`** ← also a design-system violation; the system is matte |

Header is now the rail's own switcher bar (`px-3 py-2.5`, bottom border, `ConstellationMark` →
name → liveness dot → tag), reading **General · NOT CALIBRATED**. That is not a placeholder: it is
what an anonymous visitor genuinely gets, and the tag is verbatim from the rail, where it exists to
stop a creator spending Readings against a generic crowd believing it is their own. The switcher is
deliberately **not interactive** — a dead control on a landing page is worse than an absent one.

It also retires a **"1,000 simulated viewers"** header that sat directly above a fixture reading
**"6 of 10 would stop"** — the 10-vs-1,000 conflation §0b③ warns about, contradicting itself inside
one panel. The rail makes no such claim, so matching the rail removed it.

Two self-inflicted fixes from the prior commit: a **box in a box** (my wrapper was radius 16 / 6%
border / elevated around the composer's own radius 24 / 6% border / elevated — larger radius nested
inside smaller), and columns measuring **262px vs 620px** at `align-items:start`.

## 3. How it was verified (nothing was billed)

Real browser against the dev server, with `/api/analyze` intercepted by a Playwright route:

| Check | Result |
|---|---|
| Link path | anon sign-in, cookie set, `/home`, **no `/welcome` bounce**, run armed |
| File path | File survived the push, filename rendered in the thread, run armed |
| Bad link | rejected **before** an account is minted (no auth token created) |
| DB | all 5 `auth.users` rows created are `is_anonymous = true` |
| Layout after | columns **620/620 at top 547**; one bordered box in the left column, not two |
| Room shell after | radius 12px, bg `surface-elevated`, `box-shadow: none`, border 6% |

## 4. What is NOT built — next session's work

1. **The wall** — seal the sim verdict **server-side** so it is never transmitted. `sealTemplate`
   already strips exactly `unlock` / `brain.whyThisSecond` / `population`; point it at a live run.
   *This is the next task.*
2. **Checkout + identity linking** — needs `enable_manual_linking` (owner says in hand).
3. **An anonymous-user reaper.** Now **5** rows: 2 from the spike, 3 from this session's
   verification. Left in place deliberately — deleting rows unprompted is not mine to do.
4. **The left column's void.** Height-matching the columns leaves the composer floating in 620px
   with ~200px dead above and below. The platform's own empty home is *greeting → 6-card starter
   grid → composer*, and `home-starter.tsx` is explicit the grid "ramps INTO" the field. Porting it
   would fill the space with the real composition — but six skill cards on cold traffic may be more
   app than a first visit wants. **Owner call, raised and not yet answered.**

## 5. 🔴 Owner decisions outstanding

- **`/go`'s CTAs contradict the product.** Every CTA still reads *"Test your first video — $1"* →
  `/signup`, while the hero composer directly above says *"free, no account"*. Under §0b the Test is
  **free** and the $1 buys the simulation verdict. Owned by `lane/maven-offer`, whose conversion
  pass is still open — flagged, deliberately not edited from here.
- **The starter-grid question** in §4.4 above.

## 6. Landmines (carried forward, still live)

- **Confidence rises as signals disappear** — a scrape-failed run was labelled HIGH (0.55) while a
  full-signal run scored LOW (0.35). Still untraced. It now sits in front of a paying visitor's own
  video, immediately before the wall. **This is the one that should worry you.**
- ⛔ **Never `npx supabase config push`** — pushes the whole `[auth]` block; would set prod
  `site_url` to `127.0.0.1` and cap auth email at 2/hour. No Management API token on this machine;
  the Supabase MCP does not expose auth config.
- **`/api/analyze` lies three ways** — silent cache replay (pass `bypass_cache=true`), a degraded
  run still returns 200 with a score, `tiktok_url` re-host times out on >~30s video locally.
- **Tests:** `npm test` is fake — `node ./node_modules/vitest/vitest.mjs run`. **Run both flag ways.**
- **Dev server:** `NEXT_PUBLIC_AMBIENT_V2=true`, **nohup** (not setsid), port 3000. `.env.local`
  must be copied from `~/virtuna-v1.1/` — it does not follow a worktree. (This worktree's copy is
  missing only `WHOP_API_KEY`.)
- **Playwright screenshots hang on this app** — the ambient animations never settle. Use raw
  Playwright with `animations: 'disabled'` + `caret: 'hide'` and a clip that fits the viewport, or
  assert via `getComputedStyle` / `getBoundingClientRect`.
- **Merging to main still deletes 143 inherited `.planning/` files.** Recipe unchanged:
  ```bash
  cd ~/virtuna-v1.1 && git switch main && git pull
  git merge --no-ff milestone/onboarding
  git checkout HEAD^ -- .planning
  git commit --amend --no-edit
  git diff HEAD^ HEAD --stat -- .planning   # MUST be empty
  ```
