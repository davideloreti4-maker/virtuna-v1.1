'use client';

/**
 * HookTestContext — React context for the "Test full →" handoff callback.
 *
 * Used by HookCardRenderer to invoke the handoff without threading a prop
 * through MessageBlocks (which only passes block to renderers).
 *
 * When null (default), HookCardRenderer renders the CTA as a stub (Plan 01 behavior).
 * When set (by HooksThreadView), clicking "Test full →" fires the callback with
 * the chosen hookLine + audienceArchetype (Plan 03 deep-link handoff — D-05/D-06).
 *
 * Default: null (stub — no handler wired).
 */

import { createContext, useContext } from 'react';

export type OnTestHookFn = (hookLine: string, audienceArchetype: string) => void;

export const HookTestContext = createContext<OnTestHookFn | null>(null);

export function useOnTestHook(): OnTestHookFn | null {
  return useContext(HookTestContext);
}

/**
 * HookWriteScriptContext — React context for the "Write script →" handoff (hooks→script).
 *
 * Mirrors HookTestContext: HookCardRenderer reads this to fire the hooks→script chain
 * handoff without threading a prop through MessageBlocks. When set (by HooksThreadView),
 * clicking "Write script →" switches to the Script tool and starts a script run anchored
 * on the chosen hookLine (CHAIN_HANDOFFS hooks→script — /api/tools/script { anchor }).
 *
 * Default: null (CTA renders as a stub — no handler wired).
 */
export type OnWriteScriptFn = (hookLine: string, audienceArchetype: string) => void;

export const HookWriteScriptContext = createContext<OnWriteScriptFn | null>(null);

export function useOnWriteScriptHook(): OnWriteScriptFn | null {
  return useContext(HookWriteScriptContext);
}
