# Settings, new look (design)

Date 2026-11-26. Part 9 of the new look. New look only (`NEXT_PUBLIC_NEW_LOOK`): with the flag off
`/settings` renders exactly as before (its seven tabs, every route unchanged).

Drawing (approved direction, revised after a review): `.scratch/next-look/part9/settings/settings-drawing.png`
in `~/virtuna-next-look`; today's page captured beside it: `settings-compare.png`, `today/`. Seam map:
`.scratch/next-look/part9/settings/seam-map.md` there.

## 1. Rulings it rests on

Owner, 2026-11-26:
1. A lean page of rows in You's style: Plan and credits, Appearance, Account (email, password, log out),
   Delete account. Team, Company and Role are not shown under the new look. Name, photo and connected
   accounts stay on You; referrals on Earn.
2. The plan as Maven sells it today: $1 for 3 days (50 credits), then Creator $49 / 500 credits, Pro $99 /
   1,500, Studio $499 unlimited. The switch to a free 7-day trial and an annual plan is its own part.
3. Delete account is built in this part.
4. "Looks good so far", then "review in detail and continue": the review's changes below are part of the design.

Controller's decisions (reasons given):
5. **Notifications are not shown.** The four email switches save to `user_settings`, but nothing in the
   code sends those emails (no mail sender reads the flags). A switch that changes nothing is not shown.
6. **No plan change in the app while a plan runs.** Today's Billing "Switch to …" opens a second Whop
   checkout; the webhook then overwrites `user_subscriptions` with the new membership while the old one
   keeps billing (`src/app/api/whop/checkout/route.ts` does not look at an existing membership;
   `src/app/api/webhooks/whop/route.ts` upserts on `user_id`). Under the new look a running plan is
   changed, paid and cancelled on Whop ("Manage on Whop"); "See plans" exists only with no plan or one
   that has ended. (The flag-off Billing tab keeps the bug; its fix is a separate pull request, owner's call.)
7. **The plan's live state is read from Whop.** Maven stores no "cancelled, still running": the webhook
   receives only went-valid / went-invalid / payment-failed, and the daily sync (06:00) reads
   `cancel_at_period_end` but never writes it. Without a live read, a creator who cancelled on Whop would
   see "renews" and could not delete until the period ends.
8. **Help, Terms and Privacy are not on the page**: Maven has no support address and no terms or privacy
   pages. Listed for the owner (section 9).

## 2. The page

`/settings` under the flag: one column, at most 720 wide (You's), the pushed header on a phone titled
"Settings" (`usePushedTitle`), its own `h1` from `md` (You's heading style). Back goes to You (unchanged:
`nav-config.ts`). Reached from You's last row, the desktop account menu (unchanged) and the command palette.

Top to bottom:

### 2.1 Plan (label "Plan", one card)

The card's head: the plan's name at 20 / 720, a quiet pill, one line under it, then the credits.

| State (from the plan read, 2.6) | Name · pill | Line | Credits | Rows |
|---|---|---|---|---|
| Paid, renewing | "Creator" · "Active" | "$49 a month · renews 14 Dec" | "312 of 500 credits left" · "Resets 14 Dec", meter | Manage on Whop |
| Paid, cancelled, still running | "Creator" · "Cancelled" | "Ends 14 Dec. Nothing more is billed." | as above, "Until 14 Dec" | Manage on Whop |
| Payment failed (past due) | "Creator" · "Payment failed" | "Whop couldn't take the payment. Update your card there to keep your credits." (ink, 600) + ink button "Update on Whop" | the line, no meter | none (the button is the way) |
| In the $1 trial | "Creator" · "Trial" | "$1 for 3 days. Becomes Creator, $49 a month, on 29 Nov unless you cancel." | "30 of 50 trial credits left" · "Ends 29 Nov", meter | Manage on Whop |
| Studio (unlimited) | "Studio" · "Active" | "$499 a month · renews 2 Dec" | "Unlimited credits", no meter | Manage on Whop |
| No plan, trial unused | "No plan" | "Try any plan for $1: 50 credits over 3 days." | none | ink button "See plans" |
| No plan, trial used, or plan ended | "No plan" | "Plans from $49 a month." | none | ink button "See plans" |

- The meter: neutral ink on a quiet track, never amber or red; `role="meter"` with its numbers.
- "Manage on Whop": a row (label, line "Payment, invoices, cancel", the external mark), a link to
  `https://whop.com/hub/memberships` in a new tab; its accessible name ends ", opens Whop in a new tab".
- Loading: the card's outline, never "No plan" (a purchase button must not flash). A read that failed:
  "Couldn't load your plan." and Try again, in the card.
- Prices and credits come from `PLANS` / `TRIAL` (`src/lib/pricing.ts`); "$49 a month" is the plan's
  price word as `PLANS` writes it.

### 2.2 Appearance (one card, no label)

One row "Appearance" with the choice as its line ("Light", "Dark", "Match system"). Pressed, it opens in
place (You's one-row-open rule) into three chips in a `radiogroup` (Light, Dark, Match system, each with
its icon); a choice applies at once (`useThemeChoice`) and closes the row. Escape closes it.

### 2.3 Account (label "Account", one card)

- **Email**: the account's email, read-only, no chevron. When the account signs in with Google
  (`app_metadata.providers` holds "google"): "nia@example.com · Google". No email: the row is left out.
- **Password**: line "Set or change". Opens in place: the line becomes "Optional. A code by email always
  signs you in."; two password fields ("New password", "Type it again"), "8 characters or more" tied to
  the first (`aria-describedby`), Cancel and Save. Errors in the row: "8 characters or more" (too short),
  "The two don't match", "Couldn't save. Try again." (anything else; the server's message when it is the
  length rule). Saving: Save busy. Saved: the row closes and its line reads "Saved" until the page is left.
  Route: the existing `PATCH /api/settings/account/password` (`useChangePassword`).
- **Log out**: an action row (no chevron; the sign-out mark), `supabase.auth.signOut()`; AuthGuard sends
  the visitor to `/login`, as the sidebar's Log out does.

### 2.4 Delete account (a card of its own, set apart by 28 above)

One row "Delete account", line "Your account and everything in it". Pressed, a sheet (phone) or dialog
(from 768), by `SheetShell`:

- **A plan renews** (2.6 says `renews`): title "Cancel your plan first". "Your Creator plan renews on
  14 Dec and is billed by Whop. Deleting your account would not stop it." / "Cancel it on Whop, then come
  back: a cancelled plan does not stop you deleting." Ink button "Cancel on Whop" (new tab), and Close.
  When the page is shown again (`visibilitychange` / focus) the plan is read again; if it no longer
  renews, an open sheet becomes the confirm.
- **Otherwise**: title "Delete nia@example.com?" (no email: "Delete your account?"). "Your chats,
  audiences, simulations, uploaded and saved videos and the creators you follow are deleted; your
  connected accounts are disconnected." + "The 312 credits left are lost." when credits are left + "This
  can't be undone." A labelled field "Type DELETE" (focus lands there), the ink button "Delete account"
  (`aria-disabled` until the field is exactly DELETE, case as typed), Cancel.
  - Deleting: the button "Deleting…", busy; the sheet cannot be closed by a tap outside.
  - Refused because a plan renews (the server's check, 3.2): the sheet becomes "Cancel your plan first".
  - Whop could not be asked: "Couldn't check your plan with Whop. Try again in a minute." in the sheet.
  - Any other failure: "Couldn't delete your account. Nothing was deleted. Try again." in the sheet.
  - Done: sign out on the client, then `/login?deleted=1`, where one line above the form reads "Your
    account was deleted."

### 2.5 Foot

One quiet line: the licence credit for The Room's brain, as today ("The brain in The Room: "Brain" by
dgallichan, CC BY 4.0." with its link), kept because the licence asks for it.

### 2.6 What the page reads

- The plan: `useSubscription()` (`GET /api/subscription`), plus the live Whop state of a membership
  (3.1), as one view: `planViewOf(subscription, live)` → `{ kind: "none" | "trial" | "renews" |
  "cancelled" | "pastDue" | "unlimited", … }`, pure, in `src/lib/settings/plan-view.ts`. "No plan" is
  `tier === "free"` and not in a trial; never the `status` field (it says "active" for an account with no
  row: the bug behind today's "No plan · Active").
- The account: the signed-in user's email and providers (`supabase.auth.getUser()` on the client).
- The theme: `useThemeChoice`.

## 3. The server

### 3.1 The live plan state: `GET /api/settings/plan-state`

Signed in. Reads the caller's `user_subscriptions` row; with a `whop_membership_id`, asks Whop for the
membership (`GET https://api.whop.com/api/v1/memberships/{id}`, the request the daily sync makes, lifted
into `src/lib/whop/membership.ts` and used by both). Answers `{ membership: null }` or
`{ membership: { status, cancelAtPeriodEnd, renewsAt } }`; when Whop cannot be asked, `{ unknown: true }`
(the page then shows the stored plan as today). It writes `cancel_at_period_end` and
`current_period_end` to the caller's row when Whop's differ (so the stored row catches up), on the
service client and by the caller's `user_id` only (the table is read-only to its user). No credits.

### 3.2 Delete: `POST /api/settings/account/delete`

Body `{ confirm: "DELETE" }` (zod; anything else 400). Signed in, not an anonymous visitor. In order:

1. **The plan.** With a `whop_membership_id`, ask Whop live (3.1's helper). Whop not reachable → 503
   `{ error: "whop_unreachable" }`, nothing deleted. A membership that is active, trialing or past due and
   not `cancel_at_period_end` → 409 `{ error: "plan_renews", renewsAt }`, nothing deleted.
2. **The ledger.** Any `wallet_transactions` row for the caller (an immutable money ledger, ON DELETE
   RESTRICT; it holds no row today) → 409 `{ error: "ledger" }`, nothing deleted.
3. **The files** (before the rows that name them go). Service client:
   - `avatars/{userId}/…` and `videos/{userId}/…`: every object under the prefix (paged `list`).
   - `clips` and `filmstrips` under the ids of the caller's `remix_blueprints` and `analysis_results`
     (`{blueprintId}/…`, `{analysisId}/…`).
   A removal that fails → 500, the account is not deleted (files and rows stay together; a retry runs it
   again). Each step is logged with counts only.
4. **The account.** `auth.admin.deleteUser(userId)` (service client). Every per-user table cascades from
   `auth.users` (live catalog, 2026-11-26) except `funnel_events` and `referral_clicks.referred_user_id`
   (SET NULL: analytics), `team_members.user_id` (SET NULL) and `wallet_transactions` (step 2). A failure
   → 500 `{ error: "delete_failed" }`; the files are gone by then and are said so in the log.
5. 200 `{ deleted: true }`.

Not done (and said in the spec, not on the page): Whop's affiliate record for Earn (`referral_codes`
cascades on our side; Whop's copy stays), and `team_members.invited_email` rows another owner holds.

### 3.3 Flag off

Nothing above is reachable with the flag off: the two routes answer 404 when the flag is off, and the
page renders the old `SettingsPage`.

## 4. Where it lives

- Route: `src/app/(app)/settings/page.tsx` gains first lines under the flag (as `/you` does) that render
  `SettingsNext`; the flag-off code below is untouched. `loading.tsx`: under the flag, the new outline.
- Screen: `src/components/settings-next/` — `settings-next.tsx` (container: data and handlers),
  `settings-screen.tsx` (presentational, every state), `plan-card.tsx`, `appearance-row.tsx`,
  `password-row.tsx`, `delete-sheet.tsx`, `settings-words.ts` (every string).
- Pure rules: `src/lib/settings/plan-view.ts`.
- Server: `src/lib/whop/membership.ts`, `src/app/api/settings/plan-state/route.ts`,
  `src/app/api/settings/account/delete/route.ts`, `src/lib/account/delete-account.ts` (the steps, given
  clients, so it is testable).
- Reused: You's `RowButton`, `ErrorLine`, `EditorActions`, `CancelButton`, `cancelOnEscape`
  (`src/components/you-next/row-parts.tsx`), `Card`, `Chip`, `Button` (`next:`), `SheetShell`,
  `usePushedTitle`, `useSubscription`, `useChangePassword`, `useThemeChoice`, `CheckoutModal` (old look,
  opened from "See plans" as Billing opens it).
- Dev fixtures: `/dev/settings` (as `/dev/discover`), every state of 2.1, 2.3, 2.4, light and dark.

## 5. See plans

A sheet "Choose a plan": three rows (Creator, Pro, Studio: name, credits a month or "Unlimited credits",
price), Creator chosen first; the ink button "Start Creator for $1" (trial unused) or "Start Creator ·
$49 a month" (trial used), and under it "50 credits over 3 days, then $49 a month. Cancel any time on
Whop." (trial) or "Billed monthly by Whop. Cancel any time." The button opens `CheckoutModal` with the
plan and `trial` as Billing does. Checkout's return (`/settings?tab=billing&checkout=success`) lands on the
new page, which reads the plan again.

## 6. Words

Plain, as drawn. No "Readings", "Room" (except the licence credit), "personas", "test". Every string in
`settings-words.ts`.

## 7. Accessibility

Rows at least 64 tall, every control 44; one `h1`; labels for every field; the sheet traps focus and
gives it back to the row that opened it; the theme chips are a `radiogroup` whose choice is not shown by
colour alone; the meter is a `meter`; "Deleting…" is announced (`aria-live`).

## 8. Done when

- Flag on: every state of 2.1 to 2.4 drawn on `/dev/settings`, phone and desktop, light and dark; the real
  page on the test account (no plan): plan card, theme, password open and its errors, log out, the delete
  sheet up to the typed confirm (not sent on the test account).
- The delete route: unit tests for every step and refusal with stood-in clients (Supabase and Whop are
  the boundaries), and one real run against a throwaway account made for it (files and rows gone, the auth
  user gone), on the owner's word.
- Flag off: the comparison with the accepted baseline unchanged; `/settings` tabs as before.
- Types, the whole suite, lint, both production builds.

## 9. For the owner (not built here)

1. Help, Terms, Privacy: a support address and two pages; the App Store and Whop review ask for them.
2. Today's Billing tab (flag off, live): "Switch to …" bills twice. A small fix: no new checkout while a
   membership runs.
3. Whop's webhook does not send `cancel_at_period_end` changes; subscribing to that event in Whop's
   dashboard would let the stored row stay current without the live read.
