/**
 * Dev-only network shim — preloaded by the `dev` script via NODE_OPTIONS --require.
 *
 * Why this exists:
 *   On unstable/NAT-heavy networks (phone hotspots, some captive WiFi), idle
 *   keep-alive TCP sockets to Supabase get silently killed. Next's SSR fetch
 *   (e.g. supabase.auth.getUser() in the (app) layout) then reuses a dead
 *   socket and blocks on it until undici's headers timeout (~5 min), so /home
 *   appears to "hang" and login bounces back to /login. One-shot requests
 *   (curl, fresh node fetch) never hit this because they open a new socket.
 *
 * Fix: disable HTTP keep-alive for the dev server's global fetch dispatcher so
 *   every request uses a fresh socket (matching the always-working one-shots),
 *   and fail fast instead of waiting 5 minutes if a socket is dead.
 *
 * This affects ONLY the local dev server. It changes no application code and is
 * not loaded by `build`/`start`. Safe to remove once on a stable network.
 */
try {
  const { Agent, setGlobalDispatcher } = require("undici");
  setGlobalDispatcher(
    new Agent({
      pipelining: 0,
      keepAliveTimeout: 1, // close idle sockets ~immediately -> no dead-socket reuse
      keepAliveMaxTimeout: 1,
      connect: { timeout: 15_000 },
      headersTimeout: 30_000, // fail fast instead of the 5-min default
      bodyTimeout: 60_000,
    }),
  );
  // eslint-disable-next-line no-console
  console.log("[dev-fresh-conn] undici keep-alive disabled (unstable-network safe)");
} catch (e) {
  // undici not installed -> degrade gracefully; dev still runs (may hang on flaky networks).
  // eslint-disable-next-line no-console
  console.warn("[dev-fresh-conn] skipped (undici not available):", e.message);
}
