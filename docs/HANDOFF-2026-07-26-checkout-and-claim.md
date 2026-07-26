# Handoff — checkout + the identity-linking claim step (2026-07-26, session 6)

**Worktree:** `~/virtuna-onboarding` · **Branch:** `milestone/onboarding` (pushed)
**Green:** suite both flag ways · `tsc` 0 · changed files lint clean · build (see final gate note)

> Reads on top of `HANDOFF-2026-07-26-the-wall-is-server-side.md` (session 5) and
> `HANDOFF-2026-07-26-hero-is-the-funnel.md` (session 4), both still accurate.
> ⛔ `HANDOFF-2026-07-24-onboarding-funnel.md` is still the retired walkthrough — do not build from it.
> 🔴 PORT TRAP STILL LIVE: three worktrees serve /go. THIS work runs on **:3000**
> (dev server restarted this session — the old one had died; nohup,
> `NEXT_PUBLIC_AMBIENT_V2=true AMBIENT_V2_ENABLED=true`, log in the session scratchpad).

---

## 1. What changed, in one line

The wall got its door: the sealed drill now sells the $1 unlock, payment hands off to an
identity-linking claim step onto the SAME anonymous user, and — live-verified against prod —
`enable_manual_linking` is ON and the whole chain works up to Google's consent screen.

## 2. What is BUILT (3 commits)

### The merge — `fix/whop-api-drift` is now IN this branch

The funnel checkout sits on `POST /api/whop/checkout` + the Whop webhook, and this branch
still had all three fatal drifts (v5 endpoint 404, `svix-*` headers, wrong event names).
Merged the whop lane's branch (4 commits, only Whop files, no overlap). Consequence: when
`milestone/onboarding` merges to main it CARRIES the Whop fixes; the whop lane's own PR
becomes a no-op — fine, not a conflict.

### The $1 wall CTA (`src/components/onboarding/sealed-wall-cta.tsx`)

Mounted via a new `noteAction` slot on `AmbientDetail` (a React node under BOTH honest-
absence notes — the view stays ignorant of checkout), passed by the rail's sealed-drill
branch only. So it renders exactly where a sealed wire seal renders, which only an
anonymous session ever receives — "viewer is anonymous" is true by construction.

- **Unpaid** ⇒ `Unlock the simulation — $1` + the full honest terms from the pricing SSOT:
  *"$1 for 3 days of Creator · 50 credits, then $49/mo — cancel anytime."* Both surprises
  (50-credit cap, renewal price) named before the modal ever opens.
- **The $1 SKU IS the Creator trial** — §0b③'s deal (verdict + 50 credits + 3 days) is
  literally `WHOP_TRIAL_PLAN_ID_STARTER` (`plan_OTX4xMIHYyDoY`, provisioned + live-verified
  by the whop session). No new SKU exists and none is needed.
- **Paid-but-unlinked** ⇒ the CTA becomes `Finish unlocking — link your account` and opens
  the claim dialog directly. Detection: `/api/subscription` probe on mount — any non-free
  tier on a sealed (⇒ anonymous) session means the money landed but the link didn't.
  Checkout and linking are separate steps; the visitor who bailed between them must be
  offered the LINK, **never a second charge**.

### Checkout (`CheckoutModal` + `/api/whop/checkout`, small additions)

- `heading`/`subheading` overrides used ONLY when the trial actually RESOLVES —
  the denied/full-price branches keep their honest defaults, so funnel framing can never
  dress a full-price charge.
- `funnel: true` → Whop `redirect_url` is `/home?checkout=success`, not `/settings…`
  (server-side literals both — no open-redirect surface).
- On complete: the modal fires `onComplete` THEN `onClose`; the wall's close handler only
  clears its own stage or it would clobber the claim step it just advanced to (the
  component test caught this live — it is load-bearing, don't "simplify" it).

### The claim step (`claim-account.ts` + `ClaimAccountDialog`)

§0b②'s last line, built: link onto the SAME anon user so the thread survives.

- **Google** (primary): `supabase.auth.linkIdentity({provider:"google"})` →
  `/auth/callback?next=%2Fhome`. One round-trip, room opens on return.
- **Email** (fallback): `updateUser({email, password})` — Supabase confirms the address
  before the identity lands, so the dialog's success state says honestly that the verdict
  opens on CONFIRMATION, not on submit. Password lands immediately (email+password login
  works right after confirm).
- **No signup exists on this surface.** A fresh account would strand the thread, the paid
  sub and the sealed verdict — the dialog says so.
- 🔑 **THE /welcome TRAP — why the stamp precedes the link.** The instant `is_anonymous`
  flips false, the visitor is a real un-onboarded user, and BOTH the auth callback
  (`auth/callback/route.ts:101`) and the middleware gate bounce profile-less real users to
  `/welcome` — they would pay $1 and land on a username form. So `claim-account.ts`
  upserts `creator_profiles.onboarding_completed_at` BEFORE every link (honest: the funnel
  IS the product's first run, §0's one rule). A failed stamp logs and continues — worst
  case is one /welcome detour, never a blocked link. Ordering is pinned by test.
- **There is NO read-side unlock code.** The seals open because `is_anonymous` flips.
  (Carried rule from session 5 — do not add one, do not "fix" the DB seal.)

### The reaper (`/api/cron/reap-anonymous`)

Reaps only when ALL hold: `is_anonymous === true` STRICTLY (missing claim = REAL user —
the codebase's standard polarity) · last activity (`last_sign_in_at` else `created_at`)
older than 30 days · NO `user_subscriptions` row (a paid-unlinked visitor's claim path
hangs off that id — reaping them deletes what they paid for). Per-user failures skip and
report (`wallet_transactions` is ON DELETE RESTRICT by design); 500/run cap; CRON_SECRET.
**NOT scheduled anywhere** — add in the Vercel dashboard at reconnect. The current 6 anon
rows are younger than 30 days, so the first run is a no-op by design.

## 3. How it was verified

Unit/route: 21 new assertions (claim ordering + redirect target, wall states, dialog
doors, funnel redirect, reaper spares) — plus the suite both flag ways.

**Live, real browser on :3000, against PROD Supabase, nothing billed, nothing linked:**

| Check | Result |
|---|---|
| Sealed drill | wall sentence + `Unlock the simulation — $1` + full terms; DOM carries **no 61, no 1,000** — rail row is the wire form ("Tested video · 84viral", verbatim label stripped server-side, exactly as sealed) |
| Checkout modal | funnel heading, honest terms, Whop embed iframe mounted (`/api/whop/checkout` stubbed — no local `WHOP_API_KEY`; the transport itself was live-verified by the whop session) |
| Paid-unlinked | subscription probe stubbed to `starter` ⇒ CTA became "Finish unlocking", $1 gone |
| Claim dialog | both doors present; **Google click issued the REAL OAuth flow — `enable_manual_linking` is ON in prod**, redirect chain threads `/auth/callback?next=%2Fhome`. Aborted at consent. |
| The stamp | the RLS upsert landed for the anon user seconds before the link fired |
| Cleanup | seeded thread + messages + stamp row deleted; **no new anon user minted** (the Playwright profile still held session 5's cookie and `ensureAnonymousSession` correctly reused it — still 6 rows) |

### 🔍 Observed live, know this before you "fix" it

`/api/analyze` answered **402** on this session's hero submit. NOT a funnel bug: the
browser reused session 5's anon user, which had already spent 1 credit (`reading_events`).
The demo pool is EXACTLY one Reading (10 credits), so 1+10 > 10 ⇒ refused, fail-closed,
zero engine spend. A fresh visitor fits (0+10). **The sharp edge:** the verb menu is live
for anon (§0b deliberate), so ANY pre-Test nibble — one 1-credit hook — forecloses the
free Test forever for that visitor. Working as coded; whether it should is an owner call.

## 4. NOT built — next, in order

1. **The post-link return experience.** After OAuth the visitor lands `/home` with the
   thread now UNSEALED — but nothing celebrates or auto-opens the verdict they just paid
   for. Consider `?checkout=success` / a `claimed` marker → auto-focus the drill.
2. **Reaper scheduling** — Vercel dashboard entry at reconnect (owner-gated; see
   `vercel-git-disconnected`).
3. **The webhook sandbox pass** — first real $1 purchase confirms the payload shape
   (`docs/PRICING.md` §5, unchanged; payload shape still the one unverified thing).

## 5. Owner decisions outstanding (unchanged from session 5, plus one)

- /go CTAs still read "$1" vs the hero's "free" (lane/maven-offer's conversion pass).
- The left column's void / starter-grid port.
- `overall_score` still transmits to anon — paid or free?
- Other skills stay open for anon (pool-bounded) — and NEW: the pool-vs-Test edge in §3
  above makes this sharper: hooks-first visitors lose their free Test.

## 6. Landmines (carried + new)

- `npm test` is fake — `node ./node_modules/vitest/vitest.mjs run`, BOTH flag ways.
- Dev server: running on :3000 (restarted this session). `.env.local` here lacks ALL Whop
  vars — checkout 503s locally unless you stub it or copy plan ids from the whop handoff.
- ⛔ Never `npx supabase config push`. No Management API token on this machine.
- `/api/analyze` lies three ways (cache replay / degraded-200 / >30s re-host) — and now
  also 402s honestly on a spent demo pool (§3).
- Playwright screenshots hang — a11y snapshots / `browser_run_code_unsafe` asserts. The
  MCP browser profile PERSISTS the anon cookie across sessions — your "fresh visitor" may
  not be one; check the JWT sub before trusting user counts.
- `lane/maven-offer` still conflicts on `hero-showcase.tsx` at merge.
- Merging to main still deletes 143 inherited `.planning/` files — recipe in session-4's
  handoff §6, unchanged.
- Confidence-rises-as-signals-disappear: still untraced, still behind the wall.
