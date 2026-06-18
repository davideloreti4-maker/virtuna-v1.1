'use client';

/**
 * ScriptTestContext — React context for the "Test full →" handoff callback (Plan 06-05).
 *
 * Mirrors HookTestContext exactly for the script→test seam (D-07 / P6 chain plumbing).
 *
 * Used by ScriptCardRenderer to invoke the handoff without threading a prop
 * through MessageBlocks (which only passes block to renderers).
 *
 * When null (default), ScriptCardRenderer renders the CTA as a stub (plan-01 behavior).
 * When set (by ScriptThreadView), clicking "Test full →" fires the callback with
 * the opening beat line + a compact script brief as the Test anchor (A2/Pattern 4).
 *
 * Default: null (stub — no handler wired).
 */

import { createContext, useContext } from 'react';

/**
 * Called when the creator clicks "Test full →" on a script card.
 * @param openingBeatLine  The script's opening beat text (opener line — the hook)
 * @param scriptBrief       A compact plain-text brief of the script (for the Test banner)
 */
export type OnTestScriptFn = (openingBeatLine: string, scriptBrief: string) => void;

export const ScriptTestContext = createContext<OnTestScriptFn | null>(null);

export function useOnTestScript(): OnTestScriptFn | null {
  return useContext(ScriptTestContext);
}
