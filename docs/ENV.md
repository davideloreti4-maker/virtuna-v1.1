# ENV — what to set on Vercel

> 🔴 **THE ACCOUNT IS MOVING (open as of 2026-08-16). READ §8 AND §9 BEFORE BUILDING THE NEW ONE.**
> §1's 22-var table is what the *old* project has. It is **not** the list to set on the new one —
> it omits every feature flag merged since 2026-07-27, including several that gate finished,
> measured, tested work. Setting only §1 rebuilds the exact failure `NEXT_PUBLIC_AMBIENT_V2` had
> (§7): six merged phases rendering for nobody because the flag they hung off was never set.
> §8 is the full flag ledger. §9 is the move checklist.
>
> 🔑 **Re-run §8's grep before you trust §8** (the command is in §8d). Enumerated 2026-08-16,
> re-verified 2026-08-21 @ `79375d59`. It has been wrong once already, sixteen minutes after it was
> written, on its own headline row — §8d.

**Companion to `.env.example`** (the local-dev template). This file answers one question: *which
environment variables belong on the Vercel production project, and which must deliberately stay off.*

Enumerated from `grep process.env` over `src/` and verified against `vercel env ls production` on
**2026-07-27**. `.env.example` was stale before 2026-07-26 — it omitted `DASHSCOPE_API_KEY` entirely
(the one key that throws), claimed "all 7 cron routes" when there are 10, and documented
`DEEPSEEK_API_KEY`, which has no runtime reader left. Trust this file and `.env.example` as of the
date above; re-verify with the grep if much time has passed.

Project: `virtuna-v1.1` · `prj_WUmPu9fRmFNlbj5rtGIaRmBC8Url` · team `davide-loretis-projects`
Production origin: **`https://numenmachines.com`** (live 2026-07-27 — §6). `https://virtuna-v11.vercel.app` still works.

**Nothing is missing for the app to boot or serve.** Every var the code requires is set (22/22), and
`NEXT_PUBLIC_APP_URL` + DNS were resolved 2026-07-27 (§3, §6). What remains is two optional accounts
(§1) and the cron decision (§5, step 5).

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
| `NEXT_PUBLIC_APP_URL` | ✅ `https://numenmachines.com` | overwritten + redeployed 2026-07-27; see §3 for why it matters |
| `NEXT_PUBLIC_AMBIENT_V2` | ✅ `true` — set 2026-07-29 | **deploy #2, done.** Set on `main` @ `80a2cb29`, then that production deployment was REDEPLOYED so the value inlined (`dpl_J6TwHG38yJ1tmowSTWQJQQDHEuHe`). The v2 rail is now the default surface; see §7 |
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
| `BILLING_ENFORCE_QUOTA` | ⚠️ **this row is stale — the var IS set in Production** (observed in `vercel env ls production`, created ~2026-07-27). Left here because nobody has re-verified *why*; treat the reason column, not the presence, as the open question |
| `AB_*`, `SWEEP_BUDGETS`, `SPIKE_REAL`, `SMOKE_ASK`, `RUN_VISION_LIVE_SMOKE`, `GATE_MODEL`, `PASS2_THINKING_BUDGET`, `QWEN_FAST_MODEL`, `OUT`, `T`, `YAW`, `PITCH` | local research scripts only |

Everything else (`FOLD_*`, `QWEN_*_MODEL`, the remaining `GROUNDING_*`, `CHAT_AGENT_DISPATCH`,
`APIFY_ACTOR_ID`, `SCRAPER_HASHTAGS`) has an in-code default — skip unless tuning.

⚠️ **Flag polarity is not uniform.** `GROUNDING_{HOOKS,IDEAS,SCRIPT}_ENABLED`,
`NEXT_PUBLIC_AMBIENT_V2` and `BILLING_ENFORCE_QUOTA` all default **OFF** (`=== "true"`), while
`CHAT_AGENT_DISPATCH` and `GROUNDING_CHAT_TOOL` default **ON** (`!== "false"`). Reading one and
assuming the rest is how a flag gets set backwards.

> 🔴 **CORRECTED 2026-08-16 — this paragraph did it to itself.** It listed
> `GROUNDING_CHAT_PREFLIGHT` as default **ON**. It is `=== "true"` — default **OFF**
> (`chat-runner.ts:73`), and its own comment two lines up says *"Nothing sets it; this path stays
> dead by [design]"* (`:67`). The one paragraph in this file warning that polarity gets read
> backwards had a backwards flag in it for three weeks. **Check the read site, not this table.**

---

## 2. `CRON_SECRET` is a security item even with every cron off

`vercel.json` schedules **no** crons (2026-07-26 — see the handoff §11e), but all 10 cron **routes**
remain publicly deployed. `verifyCronAuth` fails closed since 2026-08-21: with the var unset **every**
request 401s (before that, the expected header collapsed to the literal `"Bearer undefined"` —
trivially guessable). **Keep it set** — an unset secret now disables the routes rather than opening them,
and local cron testing needs it in `.env.local`.

---

## 3. ✅ `NEXT_PUBLIC_APP_URL` — resolved, and worth understanding

Six readers, and the blast radius is wider than the "referral links" this file used to claim:

| Reader | If the value is `http://localhost:3000` |
|---|---|
| `api/whop/checkout/route.ts:89` | **a paying customer is redirected to localhost after checkout** |
| `lib/engine/filmstrip/queue.ts:36` | the self-`fetch` to `/api/filmstrip/extract` never leaves the box ⇒ analyses run with **no keyframes**, silently (it is a `void fetch`) |
| `api/cron/scrape-trending/route.ts:71` | Apify calls back to localhost ⇒ scrape results never ingest |
| `settings/page.tsx:104` | referral links point at localhost |
| `signup/actions.ts`, `forgot-password/actions.ts` | fall back to the request `origin` first, so these two are **safe** either way |

It is Sensitive, so it **cannot be read back** (§0.2) and it renders in no client bundle — there was
no way to learn its old value short of the dashboard. It was overwritten twice on 2026-07-27: first
to the `vercel.app` origin, then to `https://numenmachines.com` once DNS landed (§6).

```bash
printf 'https://numenmachines.com' | vercel env add NEXT_PUBLIC_APP_URL production --force
```

The write is idempotent, so overwriting costs nothing if the value was already right — which is the
cheapest way to resolve an unreadable var. Being a `NEXT_PUBLIC_*` it only takes effect on the next
build, so each write needs a redeploy (empty commit on `main`, or redeploy from the dashboard). **Set
it again if the production origin ever changes.**

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

## 5. Deploy order — steps 1–4 and 6 are DONE

1. ✅ Build gate on `main` (`ignoreCommand`, production-only builds).
2. ✅ GitHub integration reconnected. (`NEXT_PUBLIC_AMBIENT_V2` was still unset at this step — it
   shipped later, as step 6.)
3. ✅ **Gate verified both ways in the wild**, not by reasoning about exit codes: `vercel ls` shows
   8 Preview deployments `Canceled` after 6–7s (the skip path) and one Production deployment `● Ready`
   in 2m (`dpl_HLxbrjipKheQuAVenJvxj8ZbGYD9`, 2026-07-27 00:56). The inverted exit codes
   (**1 = build, 0 = skip**) are therefore confirmed correct as written.
4. ✅ `NEXT_PUBLIC_APP_URL` corrected — `https://virtuna-v11.vercel.app`, then
   `https://numenmachines.com` once DNS landed (§6). Two writes, two builds; that is the cost of a
   build-time-inlined value.
5. ▶ Verify prod is healthy. Crons: read SCHEDULED-fire logs, never a manual curl (a manual curl 401s
   by design and has been misread as "crons dead" before). ⚠️ `vercel.json` currently schedules
   **none**, and `sync-whop` is one of the ten — billing has no drift reconciliation until that is
   decided.
6. ✅ **DONE 2026-07-29** — `NEXT_PUBLIC_AMBIENT_V2=true` set on Production, then the `main`
   @ `80a2cb29` production deployment redeployed so the value inlined. Build was real (3m, not the
   6s skip path); new deployment `dpl_J6TwHG38yJ1tmowSTWQJQQDHEuHe` holds the `numenmachines.com`
   alias. See §7 for the rollback lever and the verification boundary.

⚠️ Step 5 (verify prod healthy / the cron decision) was NOT completed before step 6 — the flag went
out ahead of it. The two are independent (the rail is not cron-fed), but `vercel.json` still
schedules **no** crons, so `sync-whop` still gives billing no drift reconciliation. That decision is
untouched and still open.

Full runbook with the schema pre-flight: `docs/HANDOFF-2026-07-26-sim-surface-video-population.md` §9.

---

## 6. ✅ `numenmachines.com` — DNS migrated to Vercel nameservers 2026-07-27

Live: apex + `www` both 200, both certs issued, every public resolver (1.1.1.1 / 8.8.8.8 / 9.9.9.9)
returns Vercel anycast. `NEXT_PUBLIC_APP_URL` is now `https://numenmachines.com`.

**Before**: the domain was attached to the project and aliased onto the production deployment, which
made it *look* live while it served a cPanel **suspended-account page**. `vercel domains ls` showing
an alias is not evidence of DNS — `curl` it.

### Why the A-record route was not available

The nameservers were `dns{1,2}.namecheaphosting.com` — the *hosting's* nameservers, not Namecheap's
own DNS. Namecheap's Advanced DNS tab only edits records when nameservers are BasicDNS/PremiumDNS, so
the zone lived inside a cPanel behind a suspended account. Nameservers were the only available lever,
which forces full delegation and a zone rebuild either way. (Namecheap's **PERSONAL DNS SERVER**
panel — the one asking for a host + IP — is glue-record registration for running your own
nameservers. Unrelated; skip it.)

### The zone was captured before the switch, and re-created after

Once delegation moves the old records are unreadable — AXFR is refused, so the zone was assembled by
per-record-type query against `dns1.namecheaphosting.com` and saved to
`.vercel/zone-backup-numenmachines.txt` (gitignored). Ported to Vercel DNS:

| Record | Note |
|---|---|
| `MX` ×3 → `mx{1,2,3}-hosting.jellyfish.systems` @ 5/10/20 | mail delivery |
| `TXT` SPF | **`+a` deliberately dropped** — see below |
| `_dmarc` `v=DMARC1; p=none;` · `default._domainkey` (409-char DKIM) | verbatim |
| `mail` / `webmail` / `autodiscover` / `autoconfig` A → `162.213.255.22` | verbatim |
| `cpanel` / `whm` / `ftp` | **dropped** — dead admin endpoints on the suspended box |

Apex and `www` need no records: with Vercel nameservers, a domain attached to a project is wired
automatically. `www` did have to be **added to the project** (`vercel domains add`) or the hostname
serves nothing.

⚠️ **Porting the SPF verbatim would have been the bug.** The record was `v=spf1 +a +mx …`. `+a`
authorizes *whatever the apex A record points at* to send mail as the domain — formerly the owner's
own cPanel box, now Vercel's **shared** anycast IPs. A faithful copy would have silently authorized
infrastructure we do not control. `+mx` and the two `ip4` literals still cover the real mail path.
**A record can be byte-identical and still mean something new once what it points at changes.**

### Certificate timing — do not panic-fix it

`www` (added after delegation) got its cert in seconds; the **apex** took ~10 minutes longer because
Vercel's own domain check kept reading the cached `dns{1,2}.namecheaphosting.com` delegation while
the `.com` registry had already flipped. During that window the apex failed TLS with *"no alternative
certificate subject name matches"* while `www` served fine. Re-adding the domain would not have
helped; waiting did.

### If a mail provider is added later (Resend/Postmark)

Its records go in Vercel DNS now (`vercel dns add numenmachines.com …`). Resend verifies on a `send.`
subdomain plus `resend._domainkey`, so it does **not** collide with the apex MX/SPF or the ported
`default._domainkey` above.

---

## 7. ✅ `NEXT_PUBLIC_AMBIENT_V2` — flipped ON in production 2026-07-29

The v2 ambient surfaces stopped being dark. Six phases of ＋door / ambient-v2 work were merged and
rendering for nobody, because the flag they hang off had never been set in Production.

**What was done, in order:**

1. `vercel env add NEXT_PUBLIC_AMBIENT_V2 production` → `true`. Confirmed present in
   `vercel env ls production` (it was genuinely absent before — 23 vars, no such row).
2. Redeployed the existing production deployment for `main` @ `80a2cb29`
   (`dpl_Hqd5Z9JUDC3Sb6cTJktK3BW1RVH2`), because a `NEXT_PUBLIC_*` value is inlined at BUILD time and
   an env write alone changes nothing (§0, rule 1).
3. New deployment `dpl_J6TwHG38yJ1tmowSTWQJQQDHEuHe` — **Ready in 3m**, aliased to
   `numenmachines.com`. The 3m duration is itself the evidence it really built: the skip path
   finishes in 6–7s (§5, step 3).

**Rollback, and it is cheap.** Two levers, in increasing cost:

- *Instant, no build:* promote the previous deployment `dpl_Hqd5Z9JUDC3Sb6cTJktK3BW1RVH2` — same
  source commit, flag-off build, already Ready.
- *Permanent:* `vercel env rm NEXT_PUBLIC_AMBIENT_V2 production`, then redeploy (another ~3m build).

Keeping the flag rather than cutting over in code is what makes the first lever exist at all.

### ⚠️ The verification boundary — read before trusting "it is on"

What is **proven**: the var exists in the Production scope; a real production build ran *after* it
was set; that build holds the live alias; and `/`, `/home`, `/go`, `/login`, `/ambient-v2`,
`/pricing` all serve 200.

What is **not proven**: that the v2 rail visually renders for a signed-in creator. There is no
public surface that reads the flag, so this could not be measured without credentials:

- `/dev/cards` prints the inlined value (`NEXT_PUBLIC_AMBIENT_V2={String(AMBIENT_V2_ENABLED)}`) but
  sits behind auth — it 302s to `/login`.
- `/ambient-v2` is **not** a verifier despite the name: it renders the v2 components from *fixtures*,
  unconditionally, so it looks identical either way.
- A client-bundle grep does **not** work either. `composer.tsx` builds *both* branches into
  variables (`audienceRail` / `audienceRailV2`) before the ternary picks one, so neither side is
  dead-code-eliminated and both strings ship regardless of the flag.

⇒ **The one remaining check is a human loading `/home` signed in on ≥xl and confirming the rail is
the v2 Overview, not the legacy `AudiencePresence`.** Until someone does that, "the flag is on" is a
statement about the build, not about what a creator sees.

---

## 8. 🔴 The flag ledger — enumerated 2026-08-16, re-verified 2026-08-21 (`79375d59`)

§1 was enumerated on **2026-07-27** and has not been re-run since. Nineteen days of merged work
added flags it does not mention. This section is the re-run.

**Method.** `grep -rhoE 'process\.env\.[A-Z0-9_]+' src/` → 80 names, minus platform-provided
(`NODE_ENV`, `NEXT_RUNTIME`, `VERCEL_ENV`), minus tuning constants with in-code defaults, minus test
assignments. Each survivor's **read site** was opened to get its polarity — not inferred from a name.

⚠️ **That grep has one blind spot, and it hides three flags.** `checkable-judge.ts:34` reads a
**computed** key — ``process.env[`ENGINE_JUDGE_${skill.toUpperCase()}`]`` — so
`ENGINE_JUDGE_HOOKS` / `_IDEAS` / `_SCRIPT` appear in `src/` **only inside comments and tests**. A
literal grep for any one of them finds no production reader and reads as dead. They are live.
Enumerating by `process.env.NAME` cannot see a key built at runtime.

### 8a. OFF by default, and holding merged work (`=== "true"`, set nowhere)

**These are the ones that make this section worth reading.** Each is finished, merged and tested
code that no creator has ever reached.

> 🔴 **`NEXT_PUBLIC_ENGINE_ONE_BRAIN` LEFT THIS TABLE ON 2026-08-16 — see §8d.** It is now
> **ON by default** (#538, owner-approved). It is listed in **§8b**, and there is nothing to set.

| Var | Build-time? | What it gates | Recorded evidence |
|---|---|---|---|
| `ENGINE_GUESS_PIN` | no | the guess pin (`guess-pin.ts:48`) | 183 real generations: product/format-shaped subjects dispatch **7/31 (23%)** vs **30/30** for scenario subjects |
| `ENGINE_REPEAT_ASK_PIN` | no | the repeat-ask pin (`repeat-ask.ts:49`) | trigger is 3 conditions not 2, so the one known false alarm can't force a billed wrong run |
| `ENGINE_PROSE_CALL_PIN` | no | the prose-call pin (`prose-call.ts:116`) | the pattern task #31 would reuse |
| `NEXT_PUBLIC_CONCEPT_V8` | 🔴 **YES** | v8 platform-concept surfaces (`flags/concept-v8.ts:16`) | ⚠️ **layers on top of `AMBIENT_V2`** — the v8 arrival swap lives inside the v2 mounts, so **both** must be on. Flag-off is byte-identical *including no new routes*: `/api/surfaces/{drops,drops/remix,lanes}` 404 by design |
| `ENGINE_JUDGE_{HOOKS,IDEAS,SCRIPT}` | no | per-skill checkable judge (`checkable-judge.ts:34`) | the computed-key blind spot above |
| `GROUNDING_{HOOKS,IDEAS,SCRIPT}_ADAPT` | no | the adapt stage per skill | paired with the `_ENABLED` vars §1 already lists |
| `LIVE_SCRAPE_DEFAULT` | no | live scrape as the default path (`scrape-default.ts:47`) | 💰 cost-bearing — Apify is a $5/mo capped account |
| `GROUNDING_CHAT_PREFLIGHT` | no | nothing — **dead by design** | `chat-runner.ts:67`: *"Nothing sets it; this path stays dead."* ✅ **Correctly absent. Do not set it.** |

### 8b. ON by default (`!== "false"`) — nothing to set, but do not set them to `"false"`

**`NEXT_PUBLIC_ENGINE_ONE_BRAIN`** (Stage B — ON since 2026-08-16, #538, owner-approved) ·
`COMPOSED_CARDS` (ON since 2026-08-14, owner ruling) · `ENGINE_AUDIO_SPLIT` ·
`ENGINE_CHAT_CARDS_ON_SCREEN` · `ENGINE_COMPARE_HINT` · `ENGINE_COUNT_HINT` ·
`ENGINE_GEN_CONVERSATION` · plus `CHAT_AGENT_DISPATCH` and `GROUNDING_CHAT_TOOL` from §1.

These need **no action** on the new project — a var that is simply absent is ON. The failure mode
here is the opposite of §8a: a half-copied env that sets one of them to `"false"` turns a shipped
feature off with no other signal.

⚠️ **`NEXT_PUBLIC_ENGINE_ONE_BRAIN` is the one to watch in this list**, because it is the only
**build-time** entry: `NEXT_PUBLIC_`, inlined by the build (§0, rule 1). Absent is still ON, so the
new project needs nothing — but a stray `=false` carried over from anywhere goes dark *and* takes a
rebuild to undo.

### 8c. ⚠️ Setting §8a does not mean it works

Every row above is **merged and tested**, and most were measured on a dev server. That is not the
same as *verified in production*, and §7's boundary applies to all of them: a var existing in the
Vercel scope proves the build inlined it, never that a creator sees the feature.

One caveat worth reading before flipping any of them:

- **`ENGINE_*` pins** — each was measured **alone**. No run has ever had all three on at once.
  Exercise that combination locally before it debuts in production.

And one that now applies to a **shipping** feature rather than a dark one:

- **Stage B (`ONE_BRAIN`)** — one of B2's five rewrites came back essentially verbatim. A craft
  issue, not a wiring one, but it is real, it is in Stage B's own handoff, and as of #538 it reaches
  creators on the next build rather than waiting behind a switch.

### 8d. 🔴 What the ONE_BRAIN row cost, and the rule it earns

This section was written on **2026-08-16** with `NEXT_PUBLIC_ENGINE_ONE_BRAIN` in §8a as
*"OFF by default, set nowhere."* **#538 flipped it to ON sixteen minutes after §8 merged**, and this
file was not touched — so the ledger's headline row said the opposite of the truth, in the one
document written to be followed during the account move.

That is precisely the failure §8 exists to prevent, reproduced by §8 itself. The mechanism is the
one §2 of `docs/NEXT-SESSION-2026-08-17.md` names: **a table only gets corrected when someone
measures, so it can never record a change that landed from another lane.** Being *about* that
failure bought no immunity from it.

🔑 **The rule: re-run §8's grep before trusting §8.** It is four seconds and it is the only thing
that makes this section worth more than the memory of whoever last read it.

```bash
grep -rhoE 'process\.env\.[A-Z0-9_]+' src/ | sed 's/process\.env\.//' | sort -u | wc -l   # 80 on 2026-08-21
# then, for any flag you are about to act on, read its polarity off the CALL SITE:
grep -rn "process.env.<NAME>" src/ | grep -v __tests__
```

Re-run on **2026-08-21** against `79375d59`: still 80 names; `ONE_BRAIN` is the **only** polarity
that moved. Every other row in §8a and §8b verified unchanged.

---

## 9. 🔴 Moving to a new Vercel account — the checklist

**The account move is exactly the moment §8's flags get lost**, because whoever builds the new
project will copy what the old one *has*, and the old one has none of them.

### 9a. The values cannot be copied from the old account

All 22 vars are **Sensitive** (§0, rule 2), so `vercel env pull` writes `NAME=""` for every one.
There is no CLI path that reads the old values out. They must come from **`.env.local`** (§4's pipe
recipe) or the old **dashboard**, before the old project goes away.

> ⚠️ Do this *first*. Once the old project is deleted, any secret not in a local `.env.local` and
> not re-issuable from its own provider is gone.

### 9b. Values that change with the account — not copied, re-derived

| Thing | Old value | Note |
|---|---|---|
| Project ID | `prj_WUmPu9fRmFNlbj5rtGIaRmBC8Url` | new project, new ID — §1's header is stale on the new account the moment it exists |
| Team scope | `davide-loretis-projects` | every `vercel … --scope` in this file needs the new one |
| `NEXT_PUBLIC_APP_URL` | `https://numenmachines.com` | 🔴 **build-time.** Re-set it *and rebuild*, or a paying customer is redirected to localhost after checkout (§3) |

### 9c. 🔴 The domain is the item most likely to be missed

`numenmachines.com` is delegated to **Vercel nameservers under the old account** (§6). Moving the
*project* does not move the *domain*. Miss it and the new deploy is healthy, green, and serving
nothing at the address anyone uses — the same "looks live, isn't" shape §6 already documents once,
when an alias pointed at a suspended cPanel page.

The zone was rebuilt by hand and the backup is at `.vercel/zone-backup-numenmachines.txt`
(**gitignored — it exists only in `~/virtuna-v1.1`; copy it out before any `worktree remove`**).
It holds MX ×3, SPF, DMARC, a 409-char DKIM and four A records.

⚠️ **Re-read §6's SPF warning before re-creating the zone.** The original `+a` was deliberately
dropped, and the reason is not obvious from the record: `+a` authorizes whatever the apex A record
points at to send mail as the domain. A faithful copy authorizes Vercel's shared anycast IPs.

### 9d. Order

1. **Extract every secret from the old account** while it still exists (9a).
2. Create the project; set §1's 22 vars, minus the two `DEEPSEEK`/`GEMINI` dead ones if you want the
   list honest, plus the **§8a** flags you intend to run.
   ⚠️ **Nothing from §8b belongs here** — those are ON when absent. Setting them is harmless;
   setting one to `"false"` by accident is not. Stage B (`ONE_BRAIN`) is in §8b as of #538: it
   arrives on the first build with **no env step at all**.
3. Re-set `NEXT_PUBLIC_APP_URL` (9b) and any **build-time** flag you chose in step 2 — currently
   `NEXT_PUBLIC_CONCEPT_V8` is the only one left in §8a. These need a **rebuild**, not just a write.
4. Move the domain and re-create the zone (9c).
5. `curl` the apex and `www`. An alias in `vercel domains ls` is **not** evidence (§6).
6. Sign in and load `/home` on ≥xl — the check §7 still owes.

⚠️ **The build gate travels with the repo, not the account.** `ignoreCommand`'s exit codes are
inverted (**1 = build, 0 = skip**, §5 step 3). A new project that builds in 6–7s took the skip path
and shipped nothing; a real build is ~3m. Time the first one.
