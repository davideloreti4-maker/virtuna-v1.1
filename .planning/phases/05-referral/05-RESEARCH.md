# Phase 5: Referral - Research

**Researched:** 2026-02-13
**Domain:** Referral tracking, cookie persistence, webhook attribution, Next.js middleware
**Confidence:** HIGH

## Summary

Referral tracking systems require careful coordination between cookie persistence (surviving OAuth redirects), database attribution (linking purchases to referrers), and UI/UX (sharing and monitoring). The critical technical challenge is maintaining referral attribution through Supabase OAuth's redirect chain, which requires first-party cookies with appropriate SameSite settings.

The standard approach uses: (1) server-side cookie setting via Next.js middleware for click tracking, (2) cookie retrieval during OAuth callback to persist referral context through auth flow, (3) webhook-based conversion attribution when users purchase, and (4) wallet transaction ledger updates for bonus credits.

**Primary recommendation:** Use SameSite=Lax cookies (not Strict) for referral tracking to survive OAuth redirects. Set cookies in middleware on initial ?ref=CODE click, retrieve and re-set in /api/auth/callback after OAuth, then attribute conversions via Whop webhook by reading cookies from authenticated user sessions.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js cookies API | 15+ | Server-side cookie management | Native Next.js solution, works in middleware + route handlers |
| Supabase Auth | Latest | OAuth provider | Already integrated, provides user_id for attribution |
| Whop webhooks | V5 | Purchase event tracking | Already implemented, provides membership.went_valid events |
| PostgreSQL triggers | 14+ | Automatic wallet credit on conversion | Supabase native, ensures atomic updates |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid or crypto.randomBytes | Latest | Unique referral code generation | For short, URL-safe, collision-resistant codes |
| Next.js middleware | 15+ | Intercept ?ref= links, set cookies | Before auth, survives rewrites |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| First-party cookies | URL parameters only | Parameters lost during OAuth, not persistent across sessions |
| Database session tracking | LocalStorage | LocalStorage unavailable server-side, can't set during OAuth callback |
| Client-side cookie setting | Server-side (middleware) | Client-side cookies easier to bypass, less reliable attribution |

**Installation:**
```bash
# No new dependencies required - using Next.js native APIs
# Optional: if using nanoid for code generation
npm install nanoid
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (app)/
│   │   └── referrals/              # Referral dashboard page
│   │       ├── page.tsx             # Dashboard UI (server component)
│   │       └── components/          # Client components (copy button, share modal)
│   ├── api/
│   │   ├── referral/
│   │   │   ├── generate/route.ts    # POST: generate referral code for user
│   │   │   ├── stats/route.ts       # GET: click/conversion stats
│   │   │   └── track-click/route.ts # POST: log click (optional - can do in middleware)
│   │   ├── auth/callback/route.ts   # MODIFY: retrieve + re-set referral cookie after OAuth
│   │   └── webhooks/whop/route.ts   # MODIFY: attribute conversion to referrer
├── lib/
│   └── referral/
│       ├── cookie.ts                # Cookie name constants, expiration settings
│       └── code-generator.ts        # Unique code generation logic
├── middleware.ts                    # MODIFY: detect ?ref=CODE, set cookie
└── components/referral/
    ├── ReferralLinkCard.tsx         # Display link with copy button
    ├── ReferralStatsCard.tsx        # Show clicks, conversions, earnings
    └── ShareReferralModal.tsx       # Social share options
supabase/migrations/
└── YYYYMMDDHHMMSS_referral_tables.sql  # referral_codes, referral_clicks, referral_conversions tables
```

### Pattern 1: Server-Side Cookie Tracking Through OAuth

**What:** Set first-party cookie in middleware when ?ref=CODE is detected, retrieve cookie in OAuth callback, re-set cookie after auth completes, read cookie on purchase webhook.

**When to use:** Anytime attribution must survive multi-step redirect chains (OAuth, payment flows).

**Example:**
```typescript
// Source: Next.js docs - https://github.com/vercel/next.js/blob/canary/docs/01-app/03-api-reference/03-file-conventions/proxy.mdx
// src/middleware.ts

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const referralCode = request.nextUrl.searchParams.get("ref");

  // Detect referral link click
  if (referralCode) {
    const response = NextResponse.next();

    // Set first-party cookie with SameSite=Lax (survives OAuth redirect)
    response.cookies.set({
      name: "virtuna_referral",
      value: referralCode,
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "lax", // CRITICAL: NOT "strict" - must survive OAuth redirect
      maxAge: 60 * 60 * 24 * 30, // 30 days (standard attribution window)
    });

    // Continue to auth flow
    return updateSession(request);
  }

  return await updateSession(request);
}
```

```typescript
// Source: Next.js docs - https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/backend-for-frontend.mdx
// src/app/api/auth/callback/route.ts (MODIFY EXISTING)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Retrieve referral cookie set in middleware
      const referralCode = request.headers.get("cookie")
        ?.split(";")
        .find(c => c.trim().startsWith("virtuna_referral="))
        ?.split("=")[1];

      if (referralCode) {
        // Log referral click in database (associate with authenticated user)
        await supabase.from("referral_clicks").insert({
          referral_code: referralCode,
          referred_user_id: data.user.id,
          clicked_at: new Date().toISOString(),
        });
      }

      const response = NextResponse.redirect(`${origin}${next}`);

      // Re-set cookie after auth (ensures persistence)
      if (referralCode) {
        response.cookies.set({
          name: "virtuna_referral",
          value: referralCode,
          path: "/",
          secure: true,
          httpOnly: true,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30,
        });
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
```

**Why SameSite=Lax, not Strict:**
- SameSite=Strict blocks cookies on cross-origin navigations (OAuth callback is cross-origin from Supabase)
- SameSite=Lax allows cookies on top-level GET navigations (OAuth redirect chain)
- Source: [Bugzilla #1465402 - Cookies set with SameSite=strict are not sent in redirects](https://bugzilla.mozilla.org/show_bug.cgi?id=1465402)
- Best practice: [NextAuth.js uses SameSite=Lax by default](https://next-auth.js.org/configuration/options)

### Pattern 2: Webhook-Based Conversion Attribution

**What:** When Whop webhook fires for membership.went_valid, read referral cookie from user's session, look up referrer, credit wallet.

**When to use:** Attribution must occur server-side after external payment completes.

**Example:**
```typescript
// src/app/api/webhooks/whop/route.ts (MODIFY EXISTING)

export async function POST(request: Request) {
  // ... existing webhook verification ...

  const payload = JSON.parse(body);
  const { event, data } = payload;

  const supabase = createServiceClient();

  switch (event) {
    case "membership.went_valid": {
      const supabaseUserId = data.metadata?.supabase_user_id;

      if (!supabaseUserId) {
        console.warn("membership.went_valid: missing supabase_user_id");
        return NextResponse.json({ received: true });
      }

      // EXISTING: upsert subscription
      const { error: subError } = await supabase
        .from("user_subscriptions")
        .upsert({
          user_id: supabaseUserId,
          whop_user_id: data.user_id,
          whop_membership_id: data.id,
          whop_product_id: data.product_id,
          virtuna_tier: mapWhopProductToTier(data.product_id),
          status: "active",
          current_period_end: data.renewal_period_end,
          updated_at: new Date().toISOString(),
        });

      if (subError) {
        console.error("Failed to upsert subscription:", subError);
        return NextResponse.json({ error: subError.message }, { status: 500 });
      }

      // NEW: check for referral conversion
      const { data: clickData } = await supabase
        .from("referral_clicks")
        .select("referral_code, referrer_user_id")
        .eq("referred_user_id", supabaseUserId)
        .order("clicked_at", { ascending: false })
        .limit(1)
        .single();

      if (clickData) {
        // Check if conversion already recorded (idempotency)
        const { data: existingConversion } = await supabase
          .from("referral_conversions")
          .select("id")
          .eq("referred_user_id", supabaseUserId)
          .maybeSingle();

        if (!existingConversion) {
          // Record conversion
          const { data: conversion, error: conversionError } = await supabase
            .from("referral_conversions")
            .insert({
              referrer_user_id: clickData.referrer_user_id,
              referred_user_id: supabaseUserId,
              referral_code: clickData.referral_code,
              whop_membership_id: data.id,
              bonus_cents: 1000, // $10 bonus (business decision - parameterize later)
              converted_at: new Date().toISOString(),
            })
            .select("id, bonus_cents")
            .single();

          if (conversionError) {
            console.error("Failed to record conversion:", conversionError);
          } else {
            // Credit referrer's wallet (trigger handles balance calculation)
            await supabase.from("wallet_transactions").insert({
              user_id: clickData.referrer_user_id,
              amount_cents: conversion.bonus_cents,
              type: "referral_bonus",
              reference_type: "referral_conversion",
              reference_id: conversion.id,
              description: `Referral bonus for ${clickData.referral_code}`,
              status: "completed",
            });
          }
        }
      }

      break;
    }
    // ... other cases ...
  }

  return NextResponse.json({ received: true });
}
```

### Pattern 3: Unique Referral Code Generation

**What:** Generate short, URL-safe, collision-resistant codes using nanoid or crypto.

**When to use:** When users first access /referrals page (lazy generation).

**Example:**
```typescript
// src/lib/referral/code-generator.ts

import { customAlphabet } from "nanoid";

// Alphanumeric, uppercase only (avoid confusion: O vs 0, I vs 1, l vs 1)
const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 31 chars (no O, I, 0, 1)
const nanoid = customAlphabet(alphabet, 8); // 8 chars = 31^8 = ~850 billion combinations

export function generateReferralCode(): string {
  return nanoid();
}

// Usage in API route:
// src/app/api/referral/generate/route.ts

import { createClient } from "@/lib/supabase/server";
import { generateReferralCode } from "@/lib/referral/code-generator";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user already has a code
  const { data: existing } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ code: existing.code });
  }

  // Generate new code with collision retry
  let code: string;
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    code = generateReferralCode();

    const { error } = await supabase
      .from("referral_codes")
      .insert({
        user_id: user.id,
        code,
        created_at: new Date().toISOString(),
      });

    if (!error) {
      return NextResponse.json({ code });
    }

    // If unique constraint violation, retry
    if (error.code === "23505") {
      attempts++;
      continue;
    }

    // Other error
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: "Failed to generate unique code" }, { status: 500 });
}
```

Source: [Medium - Referral Code Generation: Contention-free, Scalable approach](https://medium.com/@siddhusingh/referral-code-generation-architecture-contention-free-scalable-approach-68ea44ee5fb0)

### Pattern 4: Copy-to-Clipboard UI Component

**What:** Client component with native Clipboard API, visual feedback, fallback for unsupported browsers.

**When to use:** Sharing referral links requires one-click copy action.

**Example:**
```typescript
// src/components/referral/CopyButton.tsx
"use client";

import { useState } from "react";
import { CheckIcon, ClipboardIcon } from "lucide-react";

interface CopyButtonProps {
  text: string;
  label?: string;
}

export function CopyButton({ text, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      // Fallback: select text for manual copy
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-2 px-4 py-2 bg-coral-500 text-accent-foreground rounded-lg hover:bg-coral-400 transition-colors"
      aria-label={label}
    >
      {copied ? (
        <>
          <CheckIcon className="w-4 h-4" />
          Copied!
        </>
      ) : (
        <>
          <ClipboardIcon className="w-4 h-4" />
          {label}
        </>
      )}
    </button>
  );
}
```

Source: [SaaSFrame - 76 SaaS Copy to clipboard UI Design Examples](https://www.saasframe.io/patterns/copy-to-clipboard)

### Anti-Patterns to Avoid

- **Using SameSite=Strict for referral cookies:** Blocks cookies on OAuth redirects, breaks attribution chain
- **Client-side-only tracking:** Easily bypassed, unreliable for financial attribution
- **Global referral code per user instead of unique:** Can't distinguish click sources, inflates fake conversions
- **No idempotency on conversion recording:** Duplicate bonus credits on webhook retries
- **Storing balance in user table instead of ledger:** Race conditions, hard to audit, no transaction history

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique code generation | Custom loop with DB check | nanoid with retry logic | Collision-resistant by design, battle-tested, 850B+ combinations with 8 chars |
| Cookie persistence | LocalStorage fallback | First-party httpOnly cookies | LocalStorage unavailable server-side, can't set during OAuth callback |
| Balance calculation | Manual SUM queries | Postgres trigger on wallet_transactions | Atomic updates, immutable ledger pattern, audit trail |
| Attribution window | Custom expiry logic | Cookie maxAge + DB timestamp checks | Browser handles expiry, DB confirms within window |

**Key insight:** Referral systems are deceptively complex—cookie lifecycle, race conditions on conversions, and double-counting are all easy to get wrong. Use proven patterns (httpOnly cookies, immutable ledgers, idempotent webhooks) instead of custom solutions.

## Common Pitfalls

### Pitfall 1: Cookie Lost During OAuth Redirect

**What goes wrong:** Cookie set with SameSite=Strict disappears after OAuth callback, referral attribution fails silently.

**Why it happens:** Modern browsers block Strict cookies on cross-origin navigations (Supabase OAuth is cross-origin).

**How to avoid:**
- Use SameSite=Lax (not Strict)
- Re-set cookie in /api/auth/callback after OAuth completes
- Log cookie presence at each step for debugging

**Warning signs:**
- Referral tracking works in dev (localhost = same-origin) but fails in prod
- Cookies present before auth, missing after auth
- Safari users report broken tracking more than Chrome users

**Source:** [Bugzilla #1465402](https://bugzilla.mozilla.org/show_bug.cgi?id=1465402), [Curity - OAuth Cookie Best Practices](https://curity.io/resources/learn/oauth-cookie-best-practices/)

### Pitfall 2: Duplicate Conversion Credits on Webhook Retry

**What goes wrong:** Whop webhook fires multiple times (network retry), referrer receives multiple $10 bonuses for one conversion.

**Why it happens:** Webhooks are designed to retry on failure (idempotency not enforced by default).

**How to avoid:**
- Check for existing conversion record before inserting: `maybeSingle()` on `referral_conversions` with `referred_user_id`
- Use database unique constraint: `UNIQUE(referred_user_id)` on `referral_conversions` table
- Log webhook event IDs to detect duplicates

**Warning signs:**
- User reports receiving multiple bonuses
- Wallet balance higher than expected
- Multiple `referral_conversions` rows with same `referred_user_id`

### Pitfall 3: Referral Cookie Expires Too Soon (Safari)

**What goes wrong:** Safari's ITP (Intelligent Tracking Prevention) expires first-party cookies after 7 days of inactivity, breaking long attribution windows.

**Why it happens:** Safari treats first-party cookies with JavaScript access as tracking cookies if not frequently refreshed.

**How to avoid:**
- Use httpOnly cookies (JavaScript can't access, less likely to be flagged)
- Set maxAge to 30 days (standard attribution window)
- Accept 7-day effective window for Safari users (document in requirements)
- Consider server-side session tracking as backup (store referral in DB, keyed by session ID)

**Warning signs:**
- Attribution works for quick signups but fails for "think about it" users
- Safari users have lower conversion attribution than Chrome
- Conversions occur but referral cookie is empty

**Source:** [What Does the Future of 3rd Party Cookies Mean for your Referral Program?](https://www.saasquatch.com/blog/the-future-of-3rd-party-cookies-and-your-referral-program/)

### Pitfall 4: Race Condition on Wallet Balance Calculation

**What goes wrong:** Two conversions credited simultaneously, wallet balance calculation is incorrect (one bonus overwritten).

**Why it happens:** Multiple transactions read current balance, calculate new balance, write simultaneously.

**How to avoid:**
- Use Postgres trigger to calculate `balance_after_cents` atomically:
  ```sql
  CREATE OR REPLACE FUNCTION calculate_balance_after()
  RETURNS TRIGGER AS $$
  DECLARE
    current_balance INTEGER;
  BEGIN
    SELECT COALESCE(balance_after_cents, 0)
    INTO current_balance
    FROM wallet_transactions
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    LIMIT 1;

    NEW.balance_after_cents := current_balance + NEW.amount_cents;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER set_balance_after
    BEFORE INSERT ON wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION calculate_balance_after();
  ```
- Never calculate balance client-side or in application code
- Use `FOR UPDATE` row-level locks if trigger not feasible

**Warning signs:**
- Balance jumps unexpectedly
- Audit trail shows gaps in `balance_after_cents`
- Multiple transactions have same `balance_after_cents` value

**Source:** Supabase Postgres triggers - [Supabase Docs](https://github.com/supabase/supabase/blob/master/examples/prompts/database-functions.md)

### Pitfall 5: No Click Deduplication

**What goes wrong:** User clicks referral link multiple times, inflates click count, skews conversion rates.

**Why it happens:** Each page load sets a new cookie, no check for existing attribution.

**How to avoid:**
- Check for existing referral cookie before setting new one in middleware
- Use database unique constraint: `UNIQUE(referred_user_id, referral_code)` on `referral_clicks`
- Track "first click wins" (earliest timestamp) for attribution

**Warning signs:**
- Click count much higher than unique user count
- Same user has multiple click records with same referral code
- Conversion rate appears artificially low

## Code Examples

### Database Schema for Referral System

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_referral_tables.sql

-- =====================================================
-- REFERRAL CODES (one per user)
-- =====================================================
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  code TEXT NOT NULL UNIQUE, -- e.g., "ABC123XY"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_referral_codes_user_id ON referral_codes(user_id);
CREATE UNIQUE INDEX idx_referral_codes_code ON referral_codes(code);

-- =====================================================
-- REFERRAL CLICKS (track when links are clicked)
-- =====================================================
CREATE TABLE referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code TEXT NOT NULL REFERENCES referral_codes(code) ON DELETE CASCADE,
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL if not yet signed up
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  -- Metadata
  referrer_url TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  -- Deduplication: one click record per referred user per code
  UNIQUE(referred_user_id, referral_code)
);

CREATE INDEX idx_referral_clicks_referral_code ON referral_clicks(referral_code);
CREATE INDEX idx_referral_clicks_referrer_user_id ON referral_clicks(referrer_user_id);
CREATE INDEX idx_referral_clicks_clicked_at ON referral_clicks(clicked_at DESC);

-- =====================================================
-- REFERRAL CONVERSIONS (track when referred users purchase)
-- =====================================================
CREATE TABLE referral_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE, -- One conversion per user
  referral_code TEXT NOT NULL REFERENCES referral_codes(code) ON DELETE CASCADE,
  whop_membership_id TEXT NOT NULL,
  bonus_cents INTEGER NOT NULL, -- Amount credited to referrer
  converted_at TIMESTAMPTZ DEFAULT NOW(),
  -- Metadata
  metadata JSONB
);

CREATE INDEX idx_referral_conversions_referrer_user_id ON referral_conversions(referrer_user_id);
CREATE INDEX idx_referral_conversions_referred_user_id ON referral_conversions(referred_user_id);
CREATE UNIQUE INDEX idx_referral_conversions_referred_user_unique ON referral_conversions(referred_user_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_conversions ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own referral code
CREATE POLICY "Users can view their own referral code"
  ON referral_codes FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create their own referral code"
  ON referral_codes FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can view clicks on their referral codes
CREATE POLICY "Users can view clicks on their codes"
  ON referral_clicks FOR SELECT
  USING (referrer_user_id = (SELECT auth.uid()));

-- Users can view conversions they generated
CREATE POLICY "Users can view their conversions"
  ON referral_conversions FOR SELECT
  USING (referrer_user_id = (SELECT auth.uid()));

-- =====================================================
-- WALLET TRANSACTION TRIGGER (calculate balance atomically)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_balance_after()
RETURNS TRIGGER AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- Get the most recent balance for this user
  SELECT COALESCE(balance_after_cents, 0)
  INTO current_balance
  FROM wallet_transactions
  WHERE user_id = NEW.user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Calculate new balance
  NEW.balance_after_cents := current_balance + NEW.amount_cents;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_balance_after
  BEFORE INSERT ON wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_balance_after();

-- =====================================================
-- UPDATE wallet_transactions reference_type CHECK constraint
-- =====================================================
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_reference_type_check;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_reference_type_check
  CHECK (reference_type IN ('deal_enrollment', 'affiliate_conversion', 'referral_conversion', 'manual'));

ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN ('deal_payment', 'affiliate_commission', 'referral_bonus', 'withdrawal', 'adjustment'));
```

### Referral Dashboard UI (Server Component)

```typescript
// src/app/(app)/referrals/page.tsx

import { createClient } from "@/lib/supabase/server";
import { ReferralLinkCard } from "@/components/referral/ReferralLinkCard";
import { ReferralStatsCard } from "@/components/referral/ReferralStatsCard";
import { redirect } from "next/navigation";

export default async function ReferralsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Fetch or generate referral code
  let { data: codeData } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("user_id", user.id)
    .maybeSingle();

  let referralCode = codeData?.code;

  if (!referralCode) {
    // Generate code (alternatively, call /api/referral/generate from client component)
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/referral/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    referralCode = data.code;
  }

  // Fetch stats
  const { data: clicks } = await supabase
    .from("referral_clicks")
    .select("id")
    .eq("referrer_user_id", user.id);

  const { data: conversions } = await supabase
    .from("referral_conversions")
    .select("bonus_cents")
    .eq("referrer_user_id", user.id);

  const totalClicks = clicks?.length || 0;
  const totalConversions = conversions?.length || 0;
  const totalEarnings = conversions?.reduce((sum, c) => sum + c.bonus_cents, 0) || 0;

  const referralLink = `${process.env.NEXT_PUBLIC_SITE_URL}/?ref=${referralCode}`;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Referral Program</h1>

      <ReferralLinkCard referralLink={referralLink} />

      <ReferralStatsCard
        clicks={totalClicks}
        conversions={totalConversions}
        earnings={totalEarnings}
      />
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Third-party cookies | First-party cookies only | 2020 (Safari ITP) | Referral systems must use own domain cookies, can't track across domains |
| SameSite=None | SameSite=Lax default | 2021 (Chrome) | Must explicitly set Lax for OAuth flows |
| 90-day attribution | 7-30 day windows | 2020-present | Safari caps at 7 days, industry settling on 30 days |
| Client-side tracking | Server-side only | 2021-present | Privacy regulations require server-side attribution |

**Deprecated/outdated:**
- UTM parameters only (without cookies): Lost during OAuth redirects, unreliable
- Client-side localStorage for attribution: Can't access during OAuth callback, inconsistent across devices
- Global referral codes (one code for all links): Can't distinguish click sources, no fraud prevention

## Open Questions

1. **Referral bonus amount**
   - What we know: Business decision (currently $10 placeholder)
   - What's unclear: One-time vs recurring, tier-dependent amount
   - Recommendation: Start with fixed $10, parameterize in environment variable for easy adjustment

2. **Attribution window edge cases**
   - What we know: 30 days standard, Safari may cap at 7 days
   - What's unclear: How to handle multi-device conversions (user clicks on phone, signs up on desktop)
   - Recommendation: Accept first-device attribution, document limitation, consider email-based backup tracking later

3. **Fraud prevention**
   - What we know: Unique constraint prevents duplicate conversions per user
   - What's unclear: Self-referrals, fake signups, disposable emails
   - Recommendation: Phase 5 focuses on happy path, defer fraud detection to Phase 6 (Polish) or post-MVP

4. **Referral dashboard real-time updates**
   - What we know: Server components fetch data on page load
   - What's unclear: Should stats update live (websocket/polling) or require refresh?
   - Recommendation: Start with static (refresh to update), add real-time if user feedback demands it

## Sources

### Primary (HIGH confidence)
- Next.js docs (Context7) - Cookie management in middleware and route handlers
- Supabase docs (Context7) - RLS policies, triggers, and functions
- Whop Developer Portal - [Webhooks V5](https://dev.whop.com/webhooks/v5)
- Next.js GitHub (official examples) - Authentication patterns

### Secondary (MEDIUM confidence)
- [PartnerStack - How are partner referral links tracked?](https://support.partnerstack.com/hc/en-us/articles/360009312753-How-are-partner-referral-links-tracked)
- [Medium - Referral Code Generation: Architecture](https://medium.com/@siddhusingh/referral-code-generation-architecture-contention-free-scalable-approach-68ea44ee5fb0)
- [Bugzilla #1465402 - SameSite cookies and redirects](https://bugzilla.mozilla.org/show_bug.cgi?id=1465402)
- [Curity - OAuth Cookie Best Practices](https://curity.io/resources/learn/oauth-cookie-best-practices/)
- [NextAuth.js Options](https://next-auth.js.org/configuration/options)

### Tertiary (LOW confidence, marked for validation)
- [SaaS Quatch - Future of 3rd Party Cookies](https://www.saasquatch.com/blog/the-future-of-3rd-party-cookies-and-your-referral-program/)
- [SaaSFrame - Copy to Clipboard UI Examples](https://www.saasframe.io/patterns/copy-to-clipboard)
- [Scaleo - Cookie Duration Best Practices](https://www.scaleo.io/blog/how-to-set-the-perfect-cookie-duration-for-your-affiliate-marketing-program/)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Next.js, Supabase, Whop are already integrated, patterns verified via Context7 and official docs
- Architecture: HIGH - Cookie persistence through OAuth is well-documented, wallet ledger pattern proven in Phase 4
- Pitfalls: MEDIUM - SameSite cookie issues verified in multiple sources, but Safari ITP edge cases need prod testing

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (30 days - stable domain, Next.js/Supabase patterns mature)
