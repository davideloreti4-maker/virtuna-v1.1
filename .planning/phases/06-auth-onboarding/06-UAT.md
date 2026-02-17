---
status: complete
phase: 06-auth-onboarding
source: 06-01-SUMMARY.md, 06-02-SUMMARY.md
started: 2026-02-16T21:25:00Z
updated: 2026-02-17T08:02:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Ambient Coral Glow Background
expected: Visit the login page (/login). Behind the form card, a subtle coral-tinted radial gradient glow should be visible on the dark background — warm but not overpowering.
result: issue
reported: "not really something visible"
severity: cosmetic

### 2. Login Glass Card Styling
expected: The login form should be displayed in a glass-style card with ~400px max width, rounded corners (12px radius), and generous padding. Card should feel consistent with Raycast design language.
result: pass

### 3. Signup Card Matches Login
expected: Visit the signup page (/signup). The form card should have identical dimensions, border radius, and padding as the login card.
result: pass

### 4. Login Banner Icons
expected: On the login page, trigger an info banner (e.g., arrive via signup success redirect or session expired). The banner should display a Lucide icon (Info or Clock) next to the message text.
result: pass

### 5. Onboarding Pill Step Indicators
expected: Visit the welcome/onboarding page. Step progress should be shown as pill-shaped indicators (wider rectangles, not small dots). Active step should be visually distinct (coral/highlighted).
result: pass

### 6. Onboarding Layout Stability
expected: Navigate between onboarding steps (connect, goal, preview). The card should NOT resize or jump between steps — a consistent min-height keeps the layout stable.
result: pass

### 7. Skeleton Loading on Onboarding
expected: Hard-refresh the welcome page. During hydration, a skeleton loading state (pulsing placeholders in a glass card shell) should appear briefly instead of a blank flash.
result: pass

### 8. Login Error — Wrong Credentials
expected: Try logging in with incorrect credentials. The error message should be user-friendly (e.g., "Invalid email or password") — NOT a raw Supabase error string.
result: pass

### 9. Signup Error — Existing Email
expected: Try signing up with an email that already has an account. Should show a friendly message like "An account with this email already exists" with a suggestion to sign in instead.
result: pass

## Summary

total: 9
passed: 8
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Coral ambient glow visible behind auth form card"
  status: failed
  reason: "User reported: not really something visible"
  severity: cosmetic
  test: 1
  root_cause: "rgba(255,127,80,0.06) at 6% opacity is too subtle to be perceptible on dark background"
  artifacts:
    - path: "src/app/(onboarding)/layout.tsx"
      issue: "Ambient glow opacity too low at 6%"
  missing:
    - "Increase coral glow opacity to ~12-15% for visible warmth"
  debug_session: ""
