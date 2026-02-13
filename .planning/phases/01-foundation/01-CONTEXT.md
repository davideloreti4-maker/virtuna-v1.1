# Phase 1: Foundation - Context

**Gathered:** 2026-02-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace mock AuthGuard with real Supabase auth + middleware redirects, remove trending page, restructure routes into (marketing)/(onboarding)/(app) groups, and update sidebar navigation to MVP-only pages. This is infrastructure wiring — no new features, no new UI beyond auth pages and nav changes.

</domain>

<decisions>
## Implementation Decisions

### Auth redirect flow
- Claude decides where unauthenticated users land (login page vs landing page — pick based on existing code)
- Show full-page skeleton (sidebar + content area layout) while auth state is being checked — no flash of content, no bare spinner
- Preserve deep links: store intended URL, redirect back after successful auth (best value for customer)
- Claude decides session expiry behavior (silent redirect vs toast + redirect)

### Sidebar navigation
- Top section: Dashboard, Content Intelligence (already named this), Earnings — in that order
- Above Content Intelligence: TikTok account selector showing avatar + @handle of currently connected account
- Bottom navbar: Pricing
- Mobile: hamburger menu (sidebar slides in), no bottom tab bar
- Content Intelligence label is already in the codebase — keep it

### Removed page handling
- Soft-hide removed routes: keep code files but remove routes and nav links (can re-enable later)
- Claude decides what /trending resolves to (404 vs redirect)
- Claude audits nav and flags/removes anything that doesn't belong in MVP scope
- 404 page: Claude's discretion — match Raycast design language, keep it clean

### Sign-in / sign-out UX
- Auth methods: Email/password + Google OAuth (both native to Supabase)
- Claude decides post-logout destination (landing page vs login page)
- Claude decides sign-out action location in UI (avatar menu, settings, etc.)
- Claude decides whether sign-up/sign-in are same page with toggle or separate routes

### Claude's Discretion
- Auth redirect target for unauthenticated users
- Session expiry handling (silent vs toast)
- Removed route resolution (404 vs redirect)
- Additional pages to remove beyond /trending (audit codebase)
- 404 page design
- Post-logout landing destination
- Sign-out action placement
- Sign-up vs sign-in page structure (toggle vs separate)

</decisions>

<specifics>
## Specific Ideas

- TikTok account selector in sidebar should show avatar + @handle — sits above Content Intelligence nav item
- Sidebar order is explicit: Dashboard → Content Intelligence → Earnings (top), Pricing (bottom)
- Mobile nav is hamburger menu, not bottom tab bar
- Full-page skeleton during auth loading — not spinner, not blank

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-13*
