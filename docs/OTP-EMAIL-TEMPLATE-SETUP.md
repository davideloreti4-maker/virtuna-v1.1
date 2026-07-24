# OTP email templates — required Supabase config

**Project:** `virtuna-v1.1` · ref `qyxvxleheckijapurisj` · eu-west-1
**Blocks:** S0 (email OTP identity). The code is shipped; without this change it cannot work.

## The problem

`supabase.auth.signInWithOtp()` sends a magic **link** by default. Our funnel needs a **6-digit
code**, because the traffic is inside TikTok/Instagram webviews where following a link abandons the
session (see `docs/ONBOARDING-FUNNEL-DESIGN.md` §2a).

Supabase picks the template by whether the address is already known:

| Address | Template used | Matters because |
|---|---|---|
| **new** | **Confirm signup** | ← this is essentially all cold funnel traffic |
| known | **Magic Link** | returning users signing in |

**Both need `{{ .Token }}`.** Confirm signup is the critical one — miss it and every first-time
visitor gets a link with nothing to type.

## Option A — the CLI, from the repo ← **preferred**

The templates are now **version-controlled**, so this stops being a dashboard click nobody can audit:

- `supabase/templates/otp-confirmation.html` — the new-address path (all cold traffic)
- `supabase/templates/otp-magic-link.html` — the returning-user path
- wired up in `supabase/config.toml` under `[auth.email.template.confirmation]` and
  `[auth.email.template.magic_link]`

`config.toml` already sets `otp_length = 6` and `otp_expiry = 3600`, matching `lib/auth/otp.ts`.

Run these yourself — `supabase login` is interactive and the token must not enter an agent session:

```bash
npx supabase login                          # opens a browser, stores the token locally
npx supabase link --project-ref qyxvxleheckijapurisj
npx supabase config push                    # pushes [auth.*] incl. both templates
```

If the installed CLI predates `config push`, fall back to Option C below.

## Option B — dashboard (2 minutes)

1. Open **Authentication → Emails** for project `qyxvxleheckijapurisj`.
2. Select **Confirm signup**. Replace the `{{ .ConfirmationURL }}` link with the code, e.g.

   ```html
   <h2>Your Maven code</h2>
   <p>Enter this code to continue:</p>
   <p style="font-size:28px;letter-spacing:6px;font-weight:600">{{ .Token }}</p>
   <p>It expires in 60 minutes. If you didn't request it, ignore this email.</p>
   ```

3. Repeat for the **Magic Link** template.

## Option C — Management API

Requires a Supabase personal access token. **Run this yourself** so the token stays out of the
session — paste it into the prompt prefixed with `!`, or run it in your own shell.

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...   # your PAT — do not paste into chat

curl -X PATCH "https://api.supabase.com/v1/projects/qyxvxleheckijapurisj/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mailer_subjects_confirmation": "Your Maven code",
    "mailer_templates_confirmation_content": "<h2>Your Maven code</h2><p>Enter this code to continue:</p><p style=\"font-size:28px;letter-spacing:6px;font-weight:600\">{{ .Token }}</p><p>It expires in 60 minutes. If you did not request it, ignore this email.</p>",
    "mailer_subjects_magic_link": "Your Maven code",
    "mailer_templates_magic_link_content": "<h2>Your Maven code</h2><p>Enter this code to sign in:</p><p style=\"font-size:28px;letter-spacing:6px;font-weight:600\">{{ .Token }}</p><p>It expires in 60 minutes. If you did not request it, ignore this email.</p>"
  }'
```

Field names verified against the Supabase Management API docs, 2026-07-24.

## Verify

1. Sign out. Go to `/login`, enter an address **never used before** (the Confirm-signup path).
2. The email must contain a 6-digit number, not a button or link.
3. Type it — the session should open without leaving the page.
4. Then repeat with a **known** address to exercise the Magic Link template.
5. Finally, the one that actually matters: open the link from a TikTok or Instagram bio on a real
   phone and run steps 1–3 inside the in-app browser.

> ⚠️ Rate limits: Supabase's default is low (a handful of emails/hour on the built-in SMTP). Custom
> SMTP is required before this sees real traffic, or legitimate signups will hit "Too many codes
> requested" — which `otp.ts` surfaces honestly, but which still costs the conversion.
