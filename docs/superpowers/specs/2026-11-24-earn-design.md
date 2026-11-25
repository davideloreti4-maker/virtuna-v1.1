# Earn: get paid for the creators you bring

Date: 2026-11-24 · Status: APPROVED by the owner 2026-11-24 ("Build as specified"; the rate is 50%, his
number; payout by hand, monthly, from $50; how long the 50% runs is still to be said) · Part 7 of the new look (flag
`NEXT_PUBLIC_NEW_LOOK`). Ruled 2026-11-24: Earn is the affiliate page only, like Stanley's. Facts with
file and line: `.scratch/next-look/part7/earn/seam-map.md`. Drawing:
`.scratch/next-look/part7/earn/drawing/earn-drawing.png`.

## 1. What exists, and what does not

A referral feature exists as a tab in Settings: a link (`/?ref=CODE`), a Copy button and four numbers. A
visit through the link sets a 30-day cookie, and a sign-up with that cookie is recorded. That is all that
is real:

- The link is shown to Pro and Studio accounts only.
- The page promises "$10 for every creator who joins". Nothing in the code ever records a paying
  referral or an amount, so "Earnings" can only say $0. Nobody can be paid.
- "Clicks" counts sign-ups, not visits.

So an Earn page cannot just be a new look for that tab. It needs a rule for the money and something that
records it.

## 2. The rule (the owner's call, section 9)

Ruled by the owner: **50% of everything a creator you brought pays.** Plain sums: Creator at $49 a month
pays the referrer $24.50 a month; Pro at $99, $49.50. Whether that runs for as long as they pay or for a
set time is one setting in the code and is still to be said; the page's sentence follows the setting.

- Counted on each successful payment (the payment provider tells us about each one).
- A payment's share is "pending" for 30 days (refunds), then "ready".
- **Payout by hand at first:** once a month the owner pays what is ready, from $50, and marks it paid.
  The page says so: "Paid out monthly once you reach $50." No payout tooling in this part.
- Everyone with an account gets a link, not only Pro and Studio.
- A creator cannot refer themselves; the first link a visitor came through counts, for 30 days (as today).

## 3. What the creator sees

One page, `/earn`, about a dozen things:

1. **The number:** "$0 earned", and under it "0 creators joined through your link". With money:
   "$58.80 earned" and "$39.20 ready · $19.60 pending".
2. **Your link:** the sentence "Earn 50% of everything they pay, for as long as they stay.", the link,
   Copy, and Share (the phone's own share sheet where there is one).
3. **A card to share:** dark, with Maven's mark, the creator's name, "You earn 50%", and a QR code of
   the link. "Save image".
4. **How it works:** three short lines (share your link or the card; a creator opens it and subscribes
   within 30 days, on the same device; you earn 50% of their first month).
5. **Your creators** (only when there are any): one row each: when they joined, "Joined" or "Paying", and
   what they have earned you. No names or emails of other people: "Creator 1", "Creator 2".

Where it lives: its own row "Earn" in the sidebar under You, with the amount at the right ("$0"). On the
phone it is a row on the You page, above Settings (You sits behind Home's avatar). `/referrals` and the
Settings tab lead to it under the new look (the tab itself is not shown there: two places must not make
two different promises).

A referred visitor sees no change in this part.

## 4. Data (a database change, his word needed)

One new table, `referral_earnings`: one row per payment of a referred creator.

| Column | What |
|---|---|
| `id`, `created_at` | |
| `referrer_user_id`, `referred_user_id` | who earns, and whose payment it was |
| `payment_id` | the payment provider's id, unique: one payment is never counted twice |
| `paid_cents`, `currency` | what the creator paid |
| `rate_pct`, `earned_cents` | 50, and the share |
| `paid_at` | when the payment happened |
| `status` | "pending", "ready", "paid" or "void" (refunded) |
| `paid_out_at` | when the owner paid it out |

Own rows readable by the referrer; every write through the server. The existing tables stay:
`referral_codes` (the link), `referral_clicks` (sign-ups through it). `referral_conversions` (one row per
referred person, never written) is left alone.

The payment provider's webhook gains one case, "a payment succeeded": if the paying person signed up
through somebody's link, one row is written. The other cases are not touched.

## 5. Rules

- Flag off: no `/earn`, no new route answers, the Settings tab is exactly as before.
- Nothing invented: the page shows only recorded payments. Until the first one it says $0.
- No other person's name, email or handle is ever shown to a referrer.
- The link's code is made as today (8 characters), for any account on first view.

## 6. What cannot be proven today

Production is not deployed and no real payment can be made from here, so the webhook case is proven
with recorded payload shapes only. The provider's event names have changed before (the code is full of
notes on that). The first real payment after deploy has to be watched; if its shape differs, earnings
would be missing, never wrong, and can be filled in afterwards from the provider's list of payments.

## 7. Departures from the reference

No "get paid for reach" (ruled out). No gift codes. No "customise this code". No total earned by all
creators. A QR library is added (none in the project); the share card is drawn in the page, not on a
server.

## 8. Not in this part

Payout tooling (the owner pays by hand and marks rows paid in the database). Tax forms. A page for the
referred visitor. Showing Earn to a signed-out visitor.

## 9. Ruled by the owner (2026-11-24)

1. **The rate: 50%** of what a creator you brought pays (his number, in place of the proposed 20%). How
   long it runs is still to be said; it is one setting.
2. **Payout by hand, monthly, from $50.**
3. **Everyone gets a link.**
4. **The new table** `referral_earnings`.

## 10. Done when

1. Flag off renders and behaves exactly as before.
2. The page on the test account: the link, Copy, Share, the card with a QR code that opens the link,
   phone and desktop, light and dark, keyboard.
3. A recorded "payment succeeded" for a referred test user writes one row and the page shows it; the
   same payment sent twice writes one row; a payment of somebody who was not referred writes none.
4. Types, lint, the whole suite, both production builds.

## 11. As ruled and built (2026-11-24, evening): this section wins over sections 2 to 9

The owner changed the rule and the way the money moves the same evening, so most of sections 2, 4 and 9
no longer hold. What is true:

**The rule.** 50% of a referred creator's first month (their first payment). The page's headline says
"Earn 50%"; the line under it and "How it works" say "of their first month". For now.

**Whop does the money.** Whop, the payment partner, has its own affiliate system. It tracks a referred
sale and pays the referrer itself, into their Whop account, 14 to 30 days after the payment. So there is
no earnings table of ours, no new case in the payment webhook, and no payout by hand.

- A creator enrols on Earn, in the card "Get paid": a paying customer with one button ("Set up
  payouts"), anyone else by typing their Whop username. An email address is never sent to Whop.
- Enrolling creates (or finds) their affiliate record at Whop and sets a 50% commission on the first
  payment of each plan the app sells. Enrolled means every plan has it.
- When a creator who was referred starts their FIRST checkout, the checkout carries the referrer's
  Whop username, and Whop does the rest. Who referred a buyer is decided at that moment by the server,
  from the referral cookie in the buyer's own browser: the link's owner, never the buyer themselves,
  only an enrolled owner, and only for an account created after the link was opened. If Whop refuses a
  checkout because of the referral, the checkout is sent again without it: a referral never costs a
  sale.
- One Whop account belongs to one creator.
- The earned number is what Whop reports for that affiliate, read at most every five minutes. Until
  there is one the page says "Earn 50%"; on Home a row "Money made" above the message field shows the
  same number and leads to Earn.
- Stored by us: two new columns on `referral_codes` (`whop_username`, `whop_affiliate_id`).

**Who counts as referred.** Only an account created after it opened the link. The link's first opening
is remembered beside the code (a second cookie). At sign-in a referral row is written, by the server,
only for an account at most 24 hours old; the checkout writes the same row for a buyer it credits, so
people who sign in with an email code and funnel buyers count too.

**What was wrong before.** No referral had ever been recorded: the sign-in looked up the link's owner
with the new account's own rights, which cannot see another person's code. The server now looks the
owner up itself and writes the row.

**The page as built.** No list of "your creators" and no split into ready and pending (Whop holds
that). The count of creators who joined is ours.

**Open, the owner's call**

1. **The $1 trial.** The trial plans charge $1 first and renew at the monthly price three days later.
   Whop's "first payment" on a trial plan is that $1. A referred creator who starts with the trial
   therefore earns the referrer $0.50, not half a month. Half of the first month for trial starters
   needs the free trial ruled on 2026-11-16, or a commission on all payments, or a fixed amount per
   plan (which invites people to start trials only for the commission).
2. **Nothing here is proven against Whop.** The owner chose Whop's sandbox for real calls; the sandbox
   shares no account, key or plan with production, so it needs its own account, a product with plans
   and an API key with the affiliate permissions, and the settings `WHOP_API_BASE_URL`,
   `WHOP_API_KEY`, `WHOP_COMPANY_ID` and the plan ids pointed at it. Until then every call is tested
   against Whop's documentation only.
3. **A typed Whop username is not proven to be the creator's own.** The card shows which account is
   paid and offers "Change". Proving it would need a sign-in with Whop.
4. **The Whop wiring is switched off until it is configured** (`WHOP_COMPANY_ID`): until then nobody can
   enrol and the card says "Payouts aren't available yet." The new look must not reach creators before
   that, or the page promises what cannot be paid. A sale made before a creator set up payouts is not
   credited afterwards; the card says so.
5. **A plan id that changes** after creators enrolled leaves them without a commission on the new plan
   until they press "Change" and "Save" once more.
