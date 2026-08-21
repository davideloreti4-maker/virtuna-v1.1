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
TXT    default._domainkey   "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvo4Rd+GcNN7SdQ7Ks4fIGcYSK9kwW285/DuPFsHhI8kZ6RZakKM5Um3GYwCY5QnM4o8zXNyFeuOZ1lxz9Q7RcvuvwWnNCClyxDFE9pSkpYYN+jQKtLQL4rZibNDe19gpCj/uEthEn…"
                 ⚠️ 409 chars — TRUNCATED HERE. Re-query in full before porting:
                 dig TXT default._domainkey.numenmachines.com +short

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
