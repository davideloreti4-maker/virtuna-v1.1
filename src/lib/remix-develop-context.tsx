'use client';

/**
 * RemixDevelopContext — React context for the "Develop into hooks →" handoff callback (Plan 06-05).
 *
 * Mirrors HookTestContext / ScriptTestContext for the remix→hooks seam.
 *
 * Used by RemixCardRenderer to invoke the card-level fetch without threading a prop
 * through MessageBlocks (which only passes block to renderers).
 *
 * When null (default), RemixCardRenderer renders the CTA as a stub (plan-02 behavior).
 * When set (by RemixThreadView), clicking "Develop into hooks →" fires the callback with
 * the adapted hook line — the card POSTs this anchor to /api/tools/ideas/develop and
 * the composer switches to the hooks view to render the result.
 *
 * Default: null (stub — no handler wired).
 */

import { createContext, useContext } from 'react';

/**
 * Called when the creator clicks "Develop into hooks →" on a remix card.
 * @param adaptedHook  The adapted hook line (sent as anchor to /api/tools/ideas/develop)
 * @param platform     The current platform (required by the develop endpoint)
 */
export type OnDevelopRemixFn = (adaptedHook: string, platform: string) => void;

export const RemixDevelopContext = createContext<OnDevelopRemixFn | null>(null);

export function useOnDevelopRemix(): OnDevelopRemixFn | null {
  return useContext(RemixDevelopContext);
}
