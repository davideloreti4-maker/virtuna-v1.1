# Phase 2: Top Bar Account Selector + Instagram Support

## Context

The Virtuna dashboard currently has TikTok-only account support tucked inside a collapsible sidebar. On mobile, the sidebar is hidden — users have no way to see or switch accounts. This phase adds a persistent top-right account chip visible on all pages/viewports, extends the account system to support Instagram alongside TikTok, and maintains backward compatibility for Phase 1 (running in parallel).

**Requirements:** ACC-1 (Top Bar Chip), ACC-2 (Mobile-First Visibility), ACC-3 (Instagram Support)

---

## Plan 02-01: Database Migration — Add `platform` Column

**Files:** `supabase/migrations/20260311000000_add_platform_to_tiktok_accounts.sql` (CREATE), `src/types/database.types.ts` (MODIFY)

Add `platform TEXT NOT NULL DEFAULT 'tiktok'` to `tiktok_accounts` table. Update unique constraint from `(user_id, handle)` to `(user_id, handle, platform)` so the same handle can exist on different platforms.

```sql
ALTER TABLE tiktok_accounts ADD COLUMN platform TEXT NOT NULL DEFAULT 'tiktok';
ALTER TABLE tiktok_accounts DROP CONSTRAINT tiktok_accounts_user_id_handle_key;
ALTER TABLE tiktok_accounts ADD CONSTRAINT tiktok_accounts_user_id_handle_platform_key UNIQUE(user_id, handle, platform);
```

Manually update `database.types.ts` — add `platform: string` to `tiktok_accounts.Row`, `platform?: string` to `Insert`/`Update`.

**Verify:** `pnpm tsc --noEmit`

---

## Plan 02-02: Create `use-social-accounts.ts` Hook

**File:** `src/hooks/use-social-accounts.ts` (CREATE)

Evolution of `use-tiktok-accounts.ts` with these changes:

- **Type:** `SocialAccount` with `platform: 'tiktok' | 'instagram'` field
- **`addAccount(handle, platform)`** — takes platform param, inserts with it
- **Cross-instance sync:** Dispatch `CustomEvent('social-accounts-changed')` after mutations. Listen for it in a `useEffect` to re-fetch — ensures top bar chip and sidebar selector stay in sync without Zustand.
- **Legacy migration:** Same `creator_profiles.tiktok_handle` migration, sets `platform: 'tiktok'`
- **Return shape:** `{ accounts, activeAccount, isLoading, switchAccount, addAccount, removeAccount }` — same as before plus `platform` on each account

**Key reusable code:**
- `createClient()` from `src/lib/supabase/client.ts`
- All Supabase query patterns from existing `use-tiktok-accounts.ts`

**Verify:** Import from another file, TypeScript compiles

---

## Plan 02-03: Backward-Compatible Re-export in `use-tiktok-accounts.ts`

**File:** `src/hooks/use-tiktok-accounts.ts` (MODIFY — full replacement)

Replace the 156-line hook with a thin re-export facade:

```typescript
"use client";
export { useSocialAccounts as useTiktokAccounts } from "./use-social-accounts";
export type { SocialAccount as TiktokAccount } from "./use-social-accounts";
```

This preserves `import { useTiktokAccounts } from "@/hooks/use-tiktok-accounts"` for:
- `tiktok-account-selector.tsx` (current consumer)
- Phase 1's ModelSelector (parallel worker, imports for MOD-4 persona text)

The return shape is identical — only additive `platform` field.

**Verify:** `pnpm tsc --noEmit` — all existing imports still resolve

---

## Plan 02-04: Update Sidebar Account Selector with Platform Support

**File:** `src/components/app/tiktok-account-selector.tsx` (MODIFY)

Changes:
1. **Import** `TiktokLogo`, `InstagramLogo` from `@phosphor-icons/react` and `Platform` type
2. **New state:** `const [newPlatform, setNewPlatform] = useState<Platform>("tiktok")`
3. **Trigger button:** Add platform icon before `@{handle}` text based on `activeAccount.platform`
4. **Account list rows:** Add platform icon (h-3.5 w-3.5) before each `@handle`
5. **Add account section:** Platform toggle above input — two small icon buttons (TikTok/Instagram), selected gets `bg-white/[0.1]`
6. **`addAccount` call:** Change from `addAccount(trimmed)` to `addAccount(trimmed, newPlatform)`
7. **Fallback text:** Change `"Add TikTok Account"` to `"Add Account"`

**Also in `sidebar.tsx` line 149:** Change label from `"TikTok Account"` to `"Social Account"`

**Verify:** Build passes, platform icons render, toggle works

---

## Plan 02-05: Create `top-bar-account-chip.tsx` Component

**File:** `src/components/app/top-bar-account-chip.tsx` (CREATE)

Fixed-position chip at `top-4 right-4` (mirrors `SidebarToggle` at `top-4 left-4`). No full top bar needed — keeps Raycast minimal chrome aesthetic.

**Chip trigger:**
- Pill shape: `h-9 rounded-full px-3 border border-white/[0.06]`
- Inline `backdropFilter: "blur(12px)"` (Lightning CSS limitation)
- Connected: platform icon + `@handle` + `CaretDown`
- Not connected: `"Connect Account"` + `CaretDown`
- Z-index: `var(--z-sticky)` (200) — above sidebar (50), above content

**Dropdown:**
- Desktop: `absolute right-0 top-full mt-2 w-[260px]`
- Mobile (via `useIsMobile()`): `fixed left-4 right-4 top-14` (full-width)
- Glass styling: same as existing selector dropdown (rgba(17,18,20,0.95), blur(12px), border 6%, inset shadow)
- Account rows: 44px min-height for touch targets (ACC-2)
- Same dropdown content pattern as sidebar selector: account list → divider → add account section with platform toggle + input

**State:** Uses `useSocialAccounts()` hook directly. Custom DOM event sync keeps it in sync with sidebar selector.

**Handlers:** Click-outside + Escape close (same pattern as existing selector).

**Key reuse:**
- `useIsMobile()` from `src/hooks/useIsMobile.ts` — mobile dropdown positioning
- `TiktokLogo`, `InstagramLogo` from `@phosphor-icons/react`
- Glass dropdown pattern from `tiktok-account-selector.tsx`

**Verify:** Chip renders top-right, dropdown opens, add/switch works

---

## Plan 02-06: Integrate Chip into AppShell

**File:** `src/components/app/app-shell.tsx` (MODIFY)

Add import and render `<TopBarAccountChip />` inside the root div:

```tsx
<div className="h-screen bg-background">
  <SidebarToggle />
  <Sidebar />
  <TopBarAccountChip />
  <main ...>{children}</main>
</div>
```

Chip is fixed-position so no layout impact on main content.

**Verify:** `pnpm build`, chip visible on all dashboard pages

---

## Plan 02-07: Final Verification

1. `pnpm tsc --noEmit` — zero errors
2. `pnpm build` — successful build
3. Desktop: chip at top-right, sidebar selector works, both show platform icons
4. Mobile (375px): chip visible, sidebar hidden, dropdown full-width, 44px rows
5. Add account from chip → sidebar updates (and vice versa)
6. Switch account from chip → sidebar reflects change
7. Platform toggle works when adding accounts
8. Phase 1's `useTiktokAccounts` import still compiles

---

## Execution Order

| Step | Plan | Files | Depends On |
|------|------|-------|------------|
| 1 | 02-01 | migration SQL + database.types.ts | - |
| 2 | 02-02 | use-social-accounts.ts | 02-01 |
| 3 | 02-03 | use-tiktok-accounts.ts | 02-02 |
| 4a | 02-04 | tiktok-account-selector.tsx, sidebar.tsx | 02-03 |
| 4b | 02-05 | top-bar-account-chip.tsx | 02-02 |
| 5 | 02-06 | app-shell.tsx | 02-05 |
| 6 | 02-07 | - (verification only) | all |

Steps 4a and 4b can run in parallel.

## Pitfalls

- **Inline backdropFilter:** Both chip and dropdown MUST use `style={{ backdropFilter: "blur(Xpx)" }}` — Tailwind `backdrop-blur-*` gets stripped by Lightning CSS
- **Z-index:** Chip at `--z-sticky` (200) floats above sidebar overlay (49) on mobile — this is intentional so users see active account while sidebar is open
- **DOM event sync:** `useSocialAccounts` instances fire/listen for `social-accounts-changed` CustomEvent to stay in sync without a shared store
- **`addAccount` signature change:** Now takes `(handle, platform)` instead of `(handle)` — tiktok-account-selector must be updated in same commit as the hook
