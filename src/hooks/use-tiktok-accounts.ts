"use client";

// Backward-compatible re-export.
// Phase 1 (ModelSelector) imports useTiktokAccounts from this file.
// The real implementation is now in use-social-accounts.ts.
export { useSocialAccounts as useTiktokAccounts } from "./use-social-accounts";
export type { SocialAccount as TiktokAccount } from "./use-social-accounts";
