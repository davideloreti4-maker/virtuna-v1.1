/**
 * Stage B "one brain" — the CLIENT half of the flag (default ON since 2026-08-16;
 * set NEXT_PUBLIC_ENGINE_ONE_BRAIN=false to go dark).
 *
 * `NEXT_PUBLIC_ENGINE_ONE_BRAIN` is ONE lever for the whole stage: the server half
 * (/api/tools/chat) reads the same variable at request time for the `cards` schema slot, the
 * data riders and the `predispatch` frame; this constant is what the client bundles inline at
 * BUILD time for the routing half (card CTAs → the agent loop, chips carrying their pack).
 * Flipping the env var therefore needs a redeploy to reach the client — which env changes need
 * here anyway (memory: env vars are write-only + need a redeploy).
 */
export const ONE_BRAIN_ENABLED = process.env.NEXT_PUBLIC_ENGINE_ONE_BRAIN !== "false";
