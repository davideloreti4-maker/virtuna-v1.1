# ENV — what to set on Vercel

**Companion to `.env.example`** (the local-dev template). This file answers one question: *which
environment variables belong on the Vercel production project, and which must deliberately stay off.*

Enumerated from `grep process.env` over `src/` and verified against `vercel env ls production` on
**2026-07-26**. `.env.example` was stale before that date — it omitted `DASHSCOPE_API_KEY` entirely
(the one key that throws), claimed "all 7 cron routes" when there are 10, and documented
`DEEPSEEK_API_KEY`, which has no runtime reader left. Trust this file and `.env.example` as of the
date above; re-verify with the grep if much time has passed.

Project: `virtuna-v1.1` · `prj_WUmPu9fRmFNlbj5rtGIaRmBC8Url` · team `davide-loretis-projects`
Production origin: `https://virtuna-v11.vercel.app`

---

## 0. The two rules that cause most of the confusion

1. **`NEXT_PUBLIC_*` is inlined at BUILD time.** Setting or changing one on Vercel does *nothing*
   until a redeploy. This is why flipping `NEXT_PUBLIC_AMBIENT_V2` is its own deploy, not a toggle.
2. **Vercel *Sensitive* vars cannot be read back.** `vercel env pull` writes the literal string
   `[SENSITIVE]` instead of the value, so a content grep against a pulled file returns false for
   *every* check — that is **not** evidence a value is wrong. Presence/absence is all a pull tells you.

---

## 1. Current production state (14 vars, checked 2026-07-26)

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
| `DEEPSEEK_API_KEY` | ✅ set (harmless) | **dead** — no runtime reader left |
| `GEMINI_API_KEY` | ✅ set (harmless) | only reader was the `calculate-trends` cron; crons are off |

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
| all 8 `WHOP_*` | absent **by design** — a missing product id is the checkout 503, and a missing *trial* id degrades to full price, never undercharging |
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

## 3. ⚠️ `NEXT_PUBLIC_APP_URL` — the one value worth eyeballing

It is used for Apify webhook callbacks and referral links. The local `.env.local` it was most likely
copied from holds `http://localhost:3000`; if production carries that value, both silently point at
localhost. Because it is stored Sensitive it **cannot be read back** — check it in the dashboard, or
just overwrite it:

```bash
printf 'https://virtuna-v11.vercel.app' | vercel env add NEXT_PUBLIC_APP_URL production --force
```

Being a `NEXT_PUBLIC_*`, it only takes effect on the next build.

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

## 5. Deploy order

1. Land the build gate + this config on `main` (done — `ignoreCommand`, production-only builds).
2. Reconnect the GitHub integration with `NEXT_PUBLIC_AMBIENT_V2` **unset**. Ships five weeks of
   merged work with v2 still off.
3. Verify the gate **both ways**: push a no-op to a branch → *skipped*; push to `main` → *builds*.
   The exit codes are inverted from intuition (1 = build, 0 = skip) and getting them backwards means
   silently never deploying again.
4. Verify prod is healthy. Crons: read SCHEDULED-fire logs, never a manual curl (a manual curl 401s
   by design and has been misread as "crons dead" before).
5. **Then** set `NEXT_PUBLIC_AMBIENT_V2=true` and redeploy — one isolated change, clean rollback.

Full runbook with the schema pre-flight: `docs/HANDOFF-2026-07-26-sim-surface-video-population.md` §9.
