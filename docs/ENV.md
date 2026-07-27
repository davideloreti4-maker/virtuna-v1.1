# ENV — what to set on Vercel

**Companion to `.env.example`** (the local-dev template). This file answers one question: *which
environment variables belong on the Vercel production project, and which must deliberately stay off.*

Enumerated from `grep process.env` over `src/` and verified against `vercel env ls production` on
**2026-07-27**. `.env.example` was stale before 2026-07-26 — it omitted `DASHSCOPE_API_KEY` entirely
(the one key that throws), claimed "all 7 cron routes" when there are 10, and documented
`DEEPSEEK_API_KEY`, which has no runtime reader left. Trust this file and `.env.example` as of the
date above; re-verify with the grep if much time has passed.

Project: `virtuna-v1.1` · `prj_WUmPu9fRmFNlbj5rtGIaRmBC8Url` · team `davide-loretis-projects`
Production origin: `https://virtuna-v11.vercel.app` — **use this, not the custom domain** (§6).

**Nothing is missing for the app to boot or serve.** Every var the code requires is set (22/22).
What remains is one value worth correcting (§3), DNS (§6), and two optional accounts (§1).

---

## 0. The two rules that cause most of the confusion

1. **`NEXT_PUBLIC_*` is inlined at BUILD time.** Setting or changing one on Vercel does *nothing*
   until a redeploy. This is why flipping `NEXT_PUBLIC_AMBIENT_V2` is its own deploy, not a toggle.
2. **Vercel *Sensitive* vars cannot be read back.** All 22 project vars here are Sensitive, so
   `vercel env pull` writes `NAME=""` for every one of them — an *empty string*, not the value and
   not the `[SENSITIVE]` placeholder some Vercel versions emit. A content grep against a pulled file
   therefore returns false for *every* check; that is **not** evidence a value is wrong or unset.
   Presence/absence is all a pull tells you. To actually read a value: the dashboard, or overwrite it.
   (Nor can prod output be grepped for it — the only `NEXT_PUBLIC_APP_URL` reader that renders,
   `settings/page.tsx`, is a **server** component, so the value is inlined into no client bundle.)

---

## 1. Current production state (22 vars, checked 2026-07-27)

| Var | Status | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ set | read with `!` — missing ⇒ runtime crash |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ set | same |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ set | same; service client (webhooks, filmstrip signing) |
| `DASHSCOPE_API_KEY` | ✅ set | **THROWS** without it — every LLM call routes here |
| `NEXT_PUBLIC_APP_URL` | ⚠️ set, **unverified** | see §3 |
| `CRON_SECRET` | ✅ set | still required — see §2 |
| `APIFY_TOKEN` | ✅ set | unset ⇒ all scraping fails |
| `APIFY_WEBHOOK_SECRET` | ✅ set 2026-07-26 | generated; unset ⇒ webhook route rejects everything |
| `FILMSTRIP_EXTRACT_SECRET` | ✅ set | unset ⇒ analyses run with no keyframes |
| `GROUNDING_HOOKS_ENABLED` | ✅ set | defaults OFF in code, needs explicit `"true"` |
| `GROUNDING_IDEAS_ENABLED` | ✅ set | same |
| `GROUNDING_SCRIPT_ENABLED` | ✅ set | same |
| `WHOP_API_KEY` | ✅ set 2026-07-26 | + `WHOP_WEBHOOK_SECRET`, 3× `WHOP_PRODUCT_ID_*`, 3× `WHOP_TRIAL_PLAN_ID_*` = **8 vars**, all set. Provisioned live against company `biz_LyBwGuDUAoMFco`. These were "correctly absent" in the previous revision of this file — that is no longer true. |
| `DEEPSEEK_API_KEY` | ✅ set (harmless) | **dead** — no runtime reader left (only `DEEPSEEK_THINKING_BUDGET`, which has a default) |
| `GEMINI_API_KEY` | ✅ set (harmless) | **dead** — grep finds it only in *comments*. `retrieval/embedder.ts` `embedQuery`/`embedBatch` are DEFERRED to M2 and throw by design (retrieval weight = 0, callers degrade), and the `calculate-trends` cron is unscheduled. |

### Still missing — both need an external account

| Var | Consequence today |
|---|---|
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | rate limiting is **fail-open**, so production has **none at all** (one warning logged). Fine while private; set before public traffic. |
| `NEXT_PUBLIC_SENTRY_DSN` | no error tracking — on the first deploy in five weeks, which is exactly when it is wanted. `SENTRY_ORG`/`SENTRY_PROJECT` are optional build-time extras for source-map upload. |

### Correctly ABSENT — do not add these

| Var | Why |
|---|---|
| `NEXT_PUBLIC_AMBIENT_V2` | ships as **deploy #2**, isolated, so a regression has one suspect and the flag keeps its value as a rollback lever |
| `BILLING_ENFORCE_QUOTA` | defaults OFF; enforcement is verified working but stays inert until the Whop step (`docs/PRICING.md`) |
| `AB_*`, `SWEEP_BUDGETS`, `SPIKE_REAL`, `SMOKE_ASK`, `RUN_VISION_LIVE_SMOKE`, `GATE_MODEL`, `PASS2_THINKING_BUDGET`, `QWEN_FAST_MODEL`, `OUT`, `T`, `YAW`, `PITCH` | local research scripts only |

Everything else (`FOLD_*`, `QWEN_*_MODEL`, the remaining `GROUNDING_*`, `CHAT_AGENT_DISPATCH`,
`APIFY_ACTOR_ID`, `SCRAPER_HASHTAGS`) has an in-code default — skip unless tuning.

⚠️ **Flag polarity is not uniform.** `GROUNDING_{HOOKS,IDEAS,SCRIPT}_ENABLED`,
`NEXT_PUBLIC_AMBIENT_V2` and `BILLING_ENFORCE_QUOTA` all default **OFF** (`=== "true"`), while
`CHAT_AGENT_DISPATCH`, `GROUNDING_CHAT_TOOL` and `GROUNDING_CHAT_PREFLIGHT` default **ON**
(`!== "false"`). Reading one and assuming the rest is how a flag gets set backwards.

---

## 2. `CRON_SECRET` is a security item even with every cron off

`vercel.json` schedules **no** crons (2026-07-26 — see the handoff §11e), but all 10 cron **routes**
remain publicly deployed. `verifyCronAuth` compares the incoming header against
`` `Bearer ${process.env.CRON_SECRET}` ``, so with the var unset the expected header collapses to the
literal string `"Bearer undefined"` — trivially guessable. **Keep it set.**

---

## 3. ⚠️ `NEXT_PUBLIC_APP_URL` — the one value left worth correcting

Six readers, and the blast radius is wider than "referral links":

| Reader | If the value is `http://localhost:3000` |
|---|---|
| `api/whop/checkout/route.ts:89` | **a paying customer is redirected to localhost after checkout** |
| `lib/engine/filmstrip/queue.ts:36` | the self-`fetch` to `/api/filmstrip/extract` never leaves the box ⇒ analyses run with **no keyframes**, silently (it is a `void fetch`) |
| `api/cron/scrape-trending/route.ts:71` | Apify calls back to localhost ⇒ scrape results never ingest |
| `settings/page.tsx:104` | referral links point at localhost |
| `signup/actions.ts`, `forgot-password/actions.ts` | fall back to the request `origin` first, so these two are **safe** either way |

It was most likely copied from a local `.env.local` holding `http://localhost:3000`. It is Sensitive,
so it **cannot be read back** (§0.2) and it renders in no client bundle. Check the dashboard, or just
overwrite — the write is idempotent, so overwriting costs nothing if it was already right:

```bash
printf 'https://virtuna-v11.vercel.app' | vercel env add NEXT_PUBLIC_APP_URL production --force
```

Use the `vercel.app` origin, **not** `numenmachines.com` — see §6. Being a `NEXT_PUBLIC_*`, it only
takes effect on the next build, so it needs a redeploy (empty commit on `main`, or redeploy from the
dashboard) before any of the above is actually fixed.

---

## 4. Adding a var without leaking it

Pipe the value in rather than typing or echoing it, so it never lands in a shell history or a
transcript:

```bash
# from a local env file
grep '^SOME_KEY=' ~/virtuna-v1.1/.env.local | cut -d= -f2- | vercel env add SOME_KEY production

# or generate one
openssl rand -hex 32 | tr -d '\n' | vercel env add CRON_SECRET production
```

`vercel link --yes --project virtuna-v1.1 --scope davide-loretis-projects` first if the working copy
is not linked. Note that `vercel link` appends `VERCEL_OIDC_TOKEN` to the local `.env.local`
(gitignored — harmless, but it is a real edit to that file).

---

## 5. Deploy order — steps 1–3 are DONE

1. ✅ Build gate on `main` (`ignoreCommand`, production-only builds).
2. ✅ GitHub integration reconnected, `NEXT_PUBLIC_AMBIENT_V2` still unset.
3. ✅ **Gate verified both ways in the wild**, not by reasoning about exit codes: `vercel ls` shows
   8 Preview deployments `Canceled` after 6–7s (the skip path) and one Production deployment `● Ready`
   in 2m (`dpl_HLxbrjipKheQuAVenJvxj8ZbGYD9`, 2026-07-27 00:56). The inverted exit codes
   (**1 = build, 0 = skip**) are therefore confirmed correct as written.
4. ▶ Fix `NEXT_PUBLIC_APP_URL` (§3) and redeploy — do this **before** anything depends on filmstrip
   keyframes, Apify ingest, or a Whop checkout return.
5. ▶ Verify prod is healthy. Crons: read SCHEDULED-fire logs, never a manual curl (a manual curl 401s
   by design and has been misread as "crons dead" before). Note `vercel.json` currently schedules none.
6. ▶ **Then** set `NEXT_PUBLIC_AMBIENT_V2=true` and redeploy — one isolated change, clean rollback.

Full runbook with the schema pre-flight: `docs/HANDOFF-2026-07-26-sim-surface-video-population.md` §9.

---

## 6. 🔴 `numenmachines.com` is attached to the project but DNS still points elsewhere

`vercel domains ls` shows it added (2026-07-26) and aliased onto the production deployment, which
makes it *look* live. It is not:

```
$ curl -sI https://numenmachines.com
HTTP/2 302 · server: LiteSpeed
location: https://numenmachines.com/cgi-sys/suspendedpage.cgi
```

The nameservers are still `dns{1,2}.namecheaphosting.com`, so the domain resolves to the old cPanel
host and serves a **suspended-account page**. Vercel's own check agrees (`✘` on both nameservers).

Owner action, either one:
- **A record** `numenmachines.com → 76.76.21.21` at Namecheap [Vercel-recommended], or
- switch nameservers to `ns1.vercel-dns.com` / `ns2.vercel-dns.com`.

Until that resolves, `https://virtuna-v11.vercel.app` is the only working origin — which is why §3
sets `NEXT_PUBLIC_APP_URL` to it. When DNS lands, that var must be **re-set and redeployed** (it is
build-time inlined), and the Whop redirect URLs re-checked.
