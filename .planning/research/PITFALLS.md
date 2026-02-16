# Domain Pitfalls

**Domain:** TikTok Creator Intelligence SaaS (MVP Launch Features)
**Researched:** 2026-02-13

---

## Critical Pitfalls

Mistakes that cause rewrites, lost revenue, or user trust damage.

### Pitfall 1: Whop-Supabase User Identity Mismatch

**What goes wrong:** The checkout session passes `supabase_user_id` via Whop metadata, and the webhook reads it from `data.metadata?.supabase_user_id`. If the metadata is missing (timeout, mobile browser session loss, direct Whop page access), the webhook silently accepts the event but cannot link payment to a Supabase user. User pays but gets no tier upgrade.
**Why it happens:** The current webhook handler (lines 57-63) logs a warning and returns `{ received: true }` with 200 status when `supabase_user_id` is missing. Whop considers this a successful delivery and never retries.
**Consequences:** User pays but remains on "free" tier. Silent failure. No diagnostic trail. Cron sync cannot fix it because it only syncs existing records.
**Prevention:**
1. Add a `whop_orphan_events` table to store webhook payloads where `supabase_user_id` is missing
2. Implement email-based reconciliation: when user logs in post-checkout, check for orphaned Whop memberships by email match
3. Use `supabase_email` in metadata (already sent) as fallback identifier
4. Consider returning non-200 for missing metadata so Whop retries
**Detection:** Monitor for users who completed checkout (Whop dashboard shows payment) but whose `user_subscriptions.virtuna_tier` is still "free". Alert on the warning log.

### Pitfall 2: AuthGuard is a Mock -- Real Auth Not Wired

**What goes wrong:** The `AuthGuard` component uses a 350ms `setTimeout` mock and renders children unconditionally. Building onboarding/payments on top of this means the entire pipeline is built on a fake foundation.
**Why it happens:** App was built as a frontend prototype with Supabase SDK installed but auth guard not wired to actual session checks.
**Consequences:** Unauthenticated users can access the dashboard. Onboarding has no real user to associate state with. Subscription tier checks have no real user ID.
**Prevention:** Replace the mock AuthGuard with real Supabase session verification BEFORE building any other feature. Wire to `supabase.auth.getUser()` server-side. This is the first task in the entire milestone.
**Detection:** Open the app in incognito without logging in. If dashboard loads, auth is still mocked.

### Pitfall 3: Referral Attribution Lost on OAuth Redirect

**What goes wrong:** User clicks referral link (`virtuna.com/?ref=ABC123`), lands on landing page, clicks "Sign Up", goes through OAuth (Google), returns to app. The `?ref=` parameter is lost during the OAuth redirect chain (app -> Supabase -> Google -> Supabase callback -> app).
**Why it happens:** OAuth flows involve multiple redirects. Query parameters from the original URL are not preserved through the chain.
**Consequences:** Referrers don't get credited. Program trust collapses. Revenue attribution inaccurate.
**Prevention:**
1. Capture `?ref=` in middleware on landing page visit and set a server-side cookie (30-day, httpOnly) BEFORE any auth redirect
2. Also store in localStorage as backup
3. After auth callback, read cookie and create attribution record
4. Pass ref code in Whop checkout metadata for server-side conversion attribution
**Detection:** Click a referral link, sign up via Google OAuth, check if referral_conversions has a record.

### Pitfall 4: Trial Configuration Mismatch Between Whop and App

**What goes wrong:** Trial doesn't auto-convert to paid, or user gets charged on day 1, or trial length is wrong because Whop dashboard config doesn't match app expectations.
**Why it happens:** Whop trial setup is done in their dashboard, not in code. The app assumes specific plan IDs and trial behavior.
**Consequences:** Users charged unexpectedly = chargebacks. Or trial never converts = zero revenue.
**Prevention:**
1. Document exact Whop dashboard configuration in a CONFIGURATION.md
2. Verify in Whop sandbox environment before going live
3. Test FULL flow end-to-end: signup -> trial start -> 7 days -> auto-charge -> webhook
4. Add defensive check: on went_valid, verify trial period matches expectations
**Detection:** Monitor subscription status transitions. Alert if went_valid fires within 24 hours of signup (shouldn't for 7-day trial).

---

## Moderate Pitfalls

### Pitfall 5: Canvas Demo Kills Mobile Performance

**What goes wrong:** Interactive Canvas visualization runs at 60fps on desktop but stutters or crashes on mobile. TikTok creators are 80%+ mobile users.
**Why it happens:** Existing hive renders 1300+ nodes with d3-quadtree physics. Directly porting this to landing page creates 5+ second load on mobile.
**Consequences:** Bounce rate spikes. The demo that should sell the product becomes the reason people leave.
**Prevention:**
- Create SEPARATE lightweight demo component (50-100 nodes, pre-computed positions, no physics)
- Use requestAnimationFrame with visibility check (pause when not in viewport)
- Lazy-load inside Suspense boundary with ssr: false
- Set performance budget: < 50KB JS, < 16ms per frame
- Test on real iPhone SE and mid-range Android
**Detection:** Lighthouse mobile score below 80. Time to Interactive > 3 seconds on 4G.

### Pitfall 6: Canvas Touch Events Block Page Scroll on Mobile

**What goes wrong:** Canvas uses `touchAction: 'none'` and `preventDefault()` on touch events. On mobile, touch on the canvas prevents scrolling past the hero section.
**Why it happens:** Canvas interaction requires capturing touch events, but mobile browsers stop scroll propagation when touchAction is 'none'.
**Consequences:** Users get "stuck" on hero section. Cannot scroll to pricing. Bounce rate spikes.
**Prevention:**
- Landing page demo: create read-only autoplay variant with NO touch event handlers
- Remove `touchAction: 'none'` from landing demo version
- Set max-height on canvas container (max-h-[60vh])
- Test on real iOS Safari
**Detection:** Try to scroll past canvas hero section on iPhone Safari with finger on canvas element.

### Pitfall 7: Webhook Replay Causes Duplicate Bonuses

**What goes wrong:** Whop retries webhooks on non-2xx responses. Current handler has no duplicate event detection. If membership.went_valid replays after adding referral bonus logic, bonuses are credited multiple times.
**Why it happens:** HTTP webhooks provide at-least-once delivery, not exactly-once. Handler assumes exactly-once.
**Consequences:** Double referral bonuses, duplicate wallet transactions, incorrect analytics.
**Prevention:**
1. Store `svix-id` header in a `processed_webhooks` table. Check before processing
2. Make all side effects idempotent: INSERT ... ON CONFLICT DO NOTHING for one-time records
3. The upsert on user_subscriptions already handles duplicates (good). Apply same pattern to referral records
**Detection:** Search logs for duplicate svix-id values.

### Pitfall 8: Subscription State Stale After Upgrade

**What goes wrong:** User purchases Pro, modal closes via onComplete callback, but page still shows upgrade prompts because getUserTier() is cached.
**Why it happens:** Server Components in Next.js can be cached. Webhook processing is asynchronous and may not complete before user's browser navigates.
**Consequences:** User pays but sees no immediate change. Panics, contacts support.
**Prevention:**
1. After onComplete, call `router.refresh()` to re-run Server Components
2. Also re-fetch /api/subscription and update any client state
3. Add optimistic UI: immediately show Pro UI after onComplete
4. Consider short polling (3 attempts, 2s apart) after checkout to wait for webhook processing
**Detection:** Purchase subscription, do NOT refresh page, check if Pro features accessible immediately.

### Pitfall 9: Referral Bonus Abuse via Self-Referral

**What goes wrong:** Users create multiple accounts to self-refer and farm bonuses. With card-upfront trials, they can get credit before first payment.
**Why it happens:** One-time bonuses are exploitable if triggered on trial start rather than first payment.
**Consequences:** Bonus payouts without real conversions. Budget drain.
**Prevention:**
- Trigger bonus ONLY after referred user's first successful PAYMENT (not trial start)
- Rate limit: max 10 referrals per user per month
- Deduplicate: one bonus per referred email address ever
- Monitor patterns: same IP, same device, same payment method
**Detection:** Check for referral clusters (multiple referred accounts from same IP/device).

### Pitfall 10: Onboarding Blocks Returning Users

**What goes wrong:** Onboarding state stored only in localStorage/cookie. Returning user on new device or after clearing browser data sees onboarding again.
**Why it happens:** Using client-side storage instead of database for completion state.
**Consequences:** Power users frustrated. Repeat onboarding on every device.
**Prevention:**
1. Store completion in database (creator_profiles.onboarding_completed_at)
2. Cookie is fast-path cache, DB is source of truth
3. Always provide Skip button
4. Make onboarding idempotent (going through twice doesn't break anything)
**Detection:** Complete onboarding, clear cookies, sign in again. If onboarding reappears, storage is wrong.

### Pitfall 11: Trending Page Removal Leaves Orphaned References

**What goes wrong:** Deleting `/app/(app)/trending/` removes the route but leaves sidebar nav item, mock data, types, and hooks scattered across 11 files.
**Why it happens:** Trending page is wired into sidebar, types, mock data, and hooks.
**Consequences:** Sidebar shows "Trending Feed" link to 404. Dead code confuses future developers.
**Prevention:**
1. Remove all 11 files (trending page, components, types, mock data, hooks)
2. Remove "Trending Feed" from sidebar navItems
3. Add 301 redirect in next.config.ts: /trending -> /dashboard
4. Run build after removal to catch import errors
**Detection:** After removal, grep for "trending" across src/ -- zero results except redirect config.

---

## Minor Pitfalls

### Pitfall 12: Whop Checkout Embed Dark Theme Mismatch

**What goes wrong:** WhopCheckoutEmbed's dark theme doesn't perfectly match Virtuna's #07080a background and Raycast tokens. Embedded iframe looks visually disconnected.
**Prevention:** Accept slight mismatch (it's an iframe). Wrap in container with visual transition padding. Test dark theme on actual Virtuna background. Already using `theme="dark"`.

### Pitfall 13: FAQ Accordion Accessibility

**What goes wrong:** FAQ built with custom divs instead of proper accordion semantics.
**Prevention:** Use Radix AccordionPrimitive (already installed: @radix-ui/react-accordion). Not custom div + onClick.

### Pitfall 14: Tooltip Z-Index Wars

**What goes wrong:** Contextual tooltips appear behind modals, dropdowns, or sidebar.
**Prevention:** Set tooltip z-index above all other layers. Test with sidebar open, modals open, dropdowns open. Define z-index scale in design tokens.

### Pitfall 15: Referral Link Missing OG Tags for Social Preview

**What goes wrong:** Sharing referral link on TikTok/Instagram shows nothing or generic 404 because /invite/[code] route doesn't generate proper OG meta tags.
**Prevention:** Generate dynamic OG meta tags in /invite/[code] page with Next.js metadata API. Include referrer name, Virtuna branding, compelling preview image.

### Pitfall 16: Safari ITP Blocks JS-Set Referral Cookies

**What goes wrong:** Safari ITP limits JS-set first-party cookies to 7 days (24h if referrer is classified as tracker). Referral attribution lost if user converts after 7 days.
**Prevention:** Set referral cookie SERVER-SIDE via middleware (Set-Cookie header). Server-set first-party cookies are not limited by ITP. Already recommended in middleware pattern.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Foundation (auth fix) | Mock AuthGuard left in place (Pitfall 2) | Replace before ANY other feature work |
| Foundation (page removal) | Orphaned trending references (Pitfall 11) | Use 11-file removal checklist |
| Landing Page | Canvas blocks mobile scroll (Pitfall 6) | Create read-only HiveDemo variant |
| Landing Page | Canvas performance on low-end devices (Pitfall 5) | Static fallback for mobile, performance budget |
| Onboarding | Blocks returning users (Pitfall 10) | DB flag + cookie fast-path + skip button |
| Payments (Whop) | User identity mismatch (Pitfall 1) | Orphan event table + email fallback |
| Payments (Whop) | Trial config mismatch (Pitfall 4) | Document config, sandbox test, e2e verify |
| Payments (Whop) | Webhook replay duplicates (Pitfall 7) | Store svix-id, idempotent operations |
| Tier Gating | Stale cache after upgrade (Pitfall 8) | router.refresh() + polling after checkout |
| Referral Program | Attribution lost on OAuth redirect (Pitfall 3) | Server-side cookie before auth redirect |
| Referral Program | Bonus abuse (Pitfall 9) | Bonus after first payment, not trial start |
| Referral Program | Safari ITP blocks cookies (Pitfall 16) | Server-side cookie setting in middleware |

---

## Sources

### Verified in Codebase (HIGH confidence)
- `src/components/app/auth-guard.tsx` -- mock auth guard confirmed
- `src/app/api/webhooks/whop/route.ts` -- silent metadata failure on line 57-63
- `src/components/app/checkout-modal.tsx` -- WhopCheckoutEmbed with onComplete
- `src/types/database.types.ts` -- full schema with affiliate tables
- `src/app/(app)/trending/` -- trending page and related files

### Official Documentation (MEDIUM-HIGH confidence)
- [Whop Checkout Embed Docs](https://docs.whop.com/payments/checkout-embed) -- sessionId, affiliateCode, metadata
- [Whop Affiliate Program Docs](https://docs.whop.com/manage-your-business/growth-marketing/affiliate-program) -- commission structure, payout rules
- [Safari ITP Documentation](https://webkit.org/blog/category/privacy/) -- cookie limitations
- [Next.js CVE-2025-29927 Postmortem](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass) -- middleware bypass risk

### Industry Research (MEDIUM confidence)
- [SaaS Referral Attribution Best Practices](https://impact.com/referral/saas-referral-program-guide/)
- [SaaS Trial Conversion Pitfalls](https://www.f22labs.com/blogs/saas-free-trial-best-practices-pitfalls/)
- [SaaS Onboarding Mistakes](https://www.sales-hacking.com/en/post/best-practices-onboarding-saas)
