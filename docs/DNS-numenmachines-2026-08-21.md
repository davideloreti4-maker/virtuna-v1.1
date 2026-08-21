# `numenmachines.com` — live zone, measured 2026-08-21

**Why this file exists.** `ENV.md` §9c points at `.vercel/zone-backup-numenmachines.txt`, which is
**gitignored and exists in exactly one worktree** (`~/virtuna-v1.1`). A `git worktree remove` deletes
it. This capture is committed, dated, and measured from public DNS — every value below is
world-readable, so nothing here is a secret.

Captured with `dig` against the live zone **before** any account-move change.

---

## 0. 🔴 The fact that decides the whole migration

```
$ dig NS numenmachines.com +short
ns1.vercel-dns.com.
ns2.vercel-dns.com.
```

**The domain is delegated to Vercel's nameservers, and that zone lives inside the OLD Vercel
account.** Two consequences, both easy to get wrong:

1. **Namecheap is not authoritative.** Its *Advanced DNS* tab only edits records when the
   nameservers are BasicDNS/PremiumDNS. Records typed there today do nothing — the resolver never
   asks Namecheap. Any instruction of the form *"add these records in Namecheap"* is a no-op until
   the nameservers move.
2. **Moving the Vercel *project* does not move the *domain*.** The new account cannot serve this
   hostname until either the zone moves with it or the delegation changes.

## 1. Current state (all measured, 2026-08-21)

| Record | Name | Value |
|---|---|---|
| NS | apex | `ns1.vercel-dns.com.` · `ns2.vercel-dns.com.` |
| A | apex | `216.150.1.129` · `216.150.1.193` |
| A | `www` | `216.150.16.65` · `216.150.16.129` |
| TXT | `_vercel` | **absent** — no verification record exists yet |

**Both apex and `www` return HTTP 404.** That is the documented expected state while the deploy is
off — not a symptom of the migration. It also means **there is no live traffic to protect**, which
makes this the cheapest possible moment to change delegation.

## 2. 🔴 Mail — the part that breaks silently

Nothing about the website depends on these. **Email does.** If delegation moves and these are not
re-created, mail stops and nothing on the web surface will indicate it.

```
MX      5 mx1-hosting.jellyfish.systems.
MX     10 mx2-hosting.jellyfish.systems.
MX     20 mx3-hosting.jellyfish.systems.

TXT    @         "v=spf1 +mx +ip4:162.213.255.20 +ip4:162.213.255.25 include:spf.web-hosting.com ~all"
TXT    _dmarc    "v=DMARC1; p=none;"
TXT    default._domainkey   ← 409 chars, given IN FULL in §2b below. Do not retype by hand.

A      mail            162.213.255.22
A      webmail         162.213.255.22
A      autodiscover    162.213.255.22
A      autoconfig      162.213.255.22
```

✅ **The SPF `+a` hazard §6 warns about is already resolved.** The live record contains **no `+a`** —
it was correctly dropped during the 2026-07-27 rebuild. This zone is now safe to port **verbatim**,
which was not true of the pre-2026-07-27 record.

⚠️ `cpanel` and `ftp` resolve to the *Vercel* IPs rather than the old host — they have no records of
their own. They were deliberately dropped in 2026-07-27 as dead admin endpoints on a suspended box.
**Do not re-create them.**

### 2b. The DKIM key, in full (409 chars)

Copy this verbatim. A hand-retyped DKIM key is a silently broken one — the signature simply fails
and mail keeps sending, unsigned.

```
v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvo4Rd+GcNN7SdQ7Ks4fIGcYSK9kwW285/DuPFsHhI8kZ6RZakKM5Um3GYwCY5QnM4o8zXNyFeuOZ1lxz9Q7RcvuvwWnNCClyxDFE9pSkpYYN+jQKtLQL4rZibNDe19gpCj/uEthEnrJQX0JCqDf+UqL+m/vTka1gpv0Fb6jMIyvbu+kU8KtbjSySQRxFS4TYw6r5+ODFEe/TJ85xmySwJCQ55f0qHaUUjPBThRoLQTdjv41R/Nw+gWqH2AyWLUQQ+xkujxylICNf3fcsBmEiFrWNYdytr6JzVv80iVA2nj0FIXz3REHtnHB3jndOerewDA6mb4xzvGKQ9IobtF+BYwIDAQAB;
```

Re-derive it any time with:

```bash
dig TXT default._domainkey.numenmachines.com +short | tr -d '" \n'
```

⚠️ `dig` prints a long TXT as **multiple quoted chunks**. They must be concatenated with **no
separator** — the `tr -d '" \n'` above does exactly that. Pasting the chunks with spaces between
them produces a key that looks right and validates as nothing.

⚠️ No other DKIM selectors exist (`google`, `selector1/2`, `k1`, `s1` all return empty), so this one
record is the whole of DKIM.

### 2d. 🔴 Resend — a SECOND, independent mail system on the same domain

The zone carries **two unrelated mail setups**, and reading only the apex records hides one of them:

| | apex (`@`) | `send.` subdomain |
|---|---|---|
| purpose | **inbound** — the human mailbox | **outbound** — application email via Resend |
| MX | `mx{1,2,3}-hosting.jellyfish.systems` | `feedback-smtp.eu-west-1.amazonses.com` (bounces) |
| SPF | `v=spf1 +mx +ip4:162.213.255.20 +ip4:162.213.255.25 include:spf.web-hosting.com ~all` | `v=spf1 include:amazonses.com ~all` |
| DKIM | `default._domainkey` (2048-bit, §2b) | `resend._domainkey` (**1024-bit**, below) |

**Resend DKIM, in full (218 chars):**

```
p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDnQul0P1+DDxm7wKZmmG9EElRO3MpgiFhjj1hGDLOfiajNMtjcMfGRl/uIod3zwdpf9zYG7bhm8bFHoB8jb9QWg4LN+wTruSccPcVmvbr31ZrZ7hfuGob8Pdu/+nkmwoS6xFMLHRP04z1oFufzxGGRhOhzI2CMbbAfFGOm32hvAwIDAQAB
```

⚠️ **The apex SPF does not authorise Resend, and that is correct** — Resend's envelope sender is the
`send.` subdomain, which has its own SPF. Adding `include:amazonses.com` to the apex is **not** a fix
and spends one of SPF's hard limit of 10 DNS lookups for nothing.

> 🔑 **This whole section exists because a stated cause was measured instead of believed.** The
> report was *"Resend has no auth, that's why mail lands in spam."* Measured: **SPF, DKIM and a
> bounce MX are all present and correctly delegated to the `send.` subdomain.** Authentication is
> not the defect. See §2e for what the evidence actually supports.

### 2e. Why mail may still land in spam — ranked, and what would settle it

**Nothing below is proven.** Placement cannot be diagnosed from DNS alone; these are ranked by how
well the measured posture supports them.

1. **No DMARC reporting.** The record is `v=DMARC1; p=none;` — no `rua=`, so **no receiver feedback
   has ever been collected**. There is no data about what Gmail or Outlook actually think.
   *Cheapest real fix, and it is a prerequisite for judging the rest.*
2. **The website returns 404.** Filters weigh the sending domain's web presence, and this domain
   currently serves nothing at apex or `www`. A domain with no site that sends mail is a recognised
   spam signal — and it is **fixed for free by the deploy that is already pending.**
3. **`p=none` is the weakest DMARC posture.** It satisfies the Gmail/Yahoo bulk-sender rule but
   signals an unmanaged domain. Move to `p=quarantine` only **after** `rua` data shows legitimate
   mail passing — never before, or real mail gets quarantined.
4. **1024-bit Resend DKIM.** Below the 2048-bit norm. A weak signal, not a cause. Rotate if Resend
   offers it; do not prioritise it.
5. **Reputation / warmup.** A new sending domain on shared IPs at low volume.

🔑 **The one measurement that ends the guessing:** open a message that landed in spam and read its
`Authentication-Results:` header. It states outright whether SPF, DKIM and DMARC passed and whether
they **aligned**. Every item above is a hypothesis until that header is read — and if it shows all
three passing, the cause is content or reputation, and no DNS change will help.

### 2c. 🔴 CAA records exist — and they were nearly missed

```
CAA    @    0 issue "letsencrypt.org"
CAA    @    0 issue "sectigo.com"
CAA    @    0 issue "pki.goog"
```

CAA restricts **which Certificate Authorities may issue** for the domain. Vercel issues through
**Let's Encrypt**, which is on the list — so the current set is compatible and certificates work.

**On the new zone you may simply omit them.** Absent CAA means *any* CA may issue, which is
permissive, not blocking — nothing breaks. If you prefer to keep the restriction, port all three,
and **never drop `letsencrypt.org`** or Vercel's certificate issuance fails with an error that reads
like a DNS problem.

> 🔑 These were found only because the check was run. The probe that looked for them printed
> *"(empty = none, good)"* **unconditionally**, beside three lines of output saying otherwise — the
> third time in one session that a label, not the answer, was the thing that lied. Read the output,
> not the label you wrote above it.

## 3. What the NEW account is asking for

From its Domains panel — both hostnames read **"Verification Required · This domain is linked to
another Vercel account."**

| For | Type | Name | Value |
|---|---|---|---|
| apex | A | `@` | `216.198.79.1` |
| apex | TXT | `_vercel` | `vc-domain-verify=numenmachines.com,cd5043ee11658cf0aa89` |
| `www` | CNAME | `www` | `c109f47807574213.vercel-dns-017.com.` |
| `www` | TXT | `_vercel` | `vc-domain-verify=www.numenmachines.com,fbc699ed6a2ef44680fe` |

Two TXT records share the name `_vercel`. That is legal — a name may hold multiple TXT records, and
both must be present to verify both hostnames.

⚠️ **These are the records to add *wherever the zone actually lives*** — which today is the old
Vercel account, **not** Namecheap. See §0.

## 3b. ▶️ THE CHOSEN PATH — move DNS to Namecheap BasicDNS (owner decision, 2026-08-21)

DNS stops depending on any Vercel account, so this migration never has to happen again.

### Step 1 — Namecheap → *Domain* tab → Nameservers → **BasicDNS**

This is what makes Namecheap authoritative. Until it is done, nothing in the *Advanced DNS* tab has
any effect.

### Step 2 — 🔴 Delete Namecheap's default parking records FIRST

Switching to BasicDNS auto-creates a **CNAME `www` → `parkingpage.namecheap.com`** and a **URL
Redirect on `@`**. Both collide with the records below, and the parking CNAME will win on `www`.
**Delete both before adding anything.**

### Step 3 — *Advanced DNS* → add exactly this set

| Type | Host | Value | Priority |
|---|---|---|---|
| A Record | `@` | `216.198.79.1` | — |
| CNAME Record | `www` | `c109f47807574213.vercel-dns-017.com.` | — |
| TXT Record | `_vercel` | `vc-domain-verify=numenmachines.com,cd5043ee11658cf0aa89` | — |
| TXT Record | `_vercel` | `vc-domain-verify=www.numenmachines.com,fbc699ed6a2ef44680fe` | — |
| MX Record | `@` | `mx1-hosting.jellyfish.systems.` | 5 |
| MX Record | `@` | `mx2-hosting.jellyfish.systems.` | 10 |
| MX Record | `@` | `mx3-hosting.jellyfish.systems.` | 20 |
| TXT Record | `@` | `v=spf1 +mx +ip4:162.213.255.20 +ip4:162.213.255.25 include:spf.web-hosting.com ~all` | — |
| TXT Record | `_dmarc` | `v=DMARC1; p=none;` | — |
| TXT Record | `default._domainkey` | the 409-char key in §2b — **paste, never retype** | — |
| A Record | `mail` | `162.213.255.22` | — |
| A Record | `webmail` | `162.213.255.22` | — |
| A Record | `autodiscover` | `162.213.255.22` | — |
| A Record | `autoconfig` | `162.213.255.22` | — |
| **TXT Record** | **`send`** | **`v=spf1 include:amazonses.com ~all`** | — |
| **TXT Record** | **`resend._domainkey`** | **the Resend key in §2d — paste, never retype** | — |
| **MX Record** | **`send`** | **`feedback-smtp.eu-west-1.amazonses.com.`** | **10** |

🔴 **The last three rows are RESEND, and an earlier revision of this table omitted them.** They are
what makes outbound application email authenticate. Porting the zone without them does not degrade
delivery — it **breaks sending outright**, and the website gives no sign, because the two systems
share nothing but the domain name. See §2d.

**CAA:** optional — see §2c. Omitting is safe. Do **not** create `cpanel`, `whm` or `ftp`.

> 🔴 **The `_vercel` TXT records ARE required, despite the nameserver move.** Changing delegation
> does not release the domain from the old Vercel account, and that is what the *"linked to another
> Vercel account"* banner is about. Either add both TXT records above, **or** remove the domain from
> the old account — then the banner disappears on its own. Vercel says the TXT may be deleted once
> verification completes.

### Step 4 — verify with the resolver, never with a panel

```bash
dig NS numenmachines.com +short        # expect Namecheap's (dns1/dns2.registrar-servers.com)
dig A numenmachines.com +short         # expect 216.198.79.1
dig CNAME www.numenmachines.com +short # expect c109f47807574213.vercel-dns-017.com.
dig MX numenmachines.com +short        # ← THE ONE THAT MATTERS: 3 records, or mail is down
dig TXT default._domainkey.numenmachines.com +short | tr -d '" \n' | wc -c   # expect 409
curl -sI https://numenmachines.com | head -1
```

⚠️ **Delegation changes can take up to 48h**, though it is usually far faster. Until the NS line
shows Namecheap, every other check reads the OLD zone and tells you nothing about your new records.

⚠️ **Certificate timing — do not panic-fix it.** §6 records that on the last delegation change,
`www` got its certificate in seconds while the **apex** took ~10 minutes longer, failing TLS with
*"no alternative certificate subject name matches"* in the meantime. Re-adding the domain does not
help. Waiting does.

## 4. Re-measure before trusting any of this

```bash
dig NS numenmachines.com +short          # ← always check this FIRST; it decides where records go
dig A numenmachines.com +short
dig CNAME www.numenmachines.com +short
dig TXT _vercel.numenmachines.com +short
dig MX numenmachines.com +short
dig TXT numenmachines.com +short
dig TXT default._domainkey.numenmachines.com +short
curl -s -o /dev/null -w '%{http_code}\n' https://numenmachines.com
```

🔑 **An entry in a provider's domain panel is not evidence of DNS.** §6 records the case where an
alias made the domain *look* live while it served a suspended-account page. `dig` and `curl` are the
evidence; a green panel is not.
